import { HandActionClock } from '../sim/HandActionClock';
import { createFloorMop } from '../world/FloorMop';
import { markDynamic } from '../world/layers';
import * as THREE from 'three';
import type { ItemId } from '../data/items';
import type { NavGrid } from '../sim/Navigation';
import type { MoveInput } from '../input/InputManager';
import { Actor } from './Actor';
import { CarryStack } from './CarryStack';
import { createCharacter } from '../chars';
import type { HeldVacuum } from '../world/StationView';
import { BALANCE } from '../data/balance';
import { angleTowards, clamp } from '../core/MathUtils';
import { sfx } from '../core/EventBus';
import type { WorkKind } from '../chars/types';
import { box, cyl, detail, mat, sph, torus } from '../world/Materials';

/** Hazır paketin push klibiyle elektrikli süpürge başlığının ortak ritmi. */
const SWEEP_HZ = 1.43;

const YAW = (BALANCE.camera.yaw * Math.PI) / 180;
const COS_Y = Math.cos(YAW);
const SIN_Y = Math.sin(YAW);

/** Süpürge sapı nişanı için yeniden kullanılan tamponlar — kare başına tahsis yok. */
const VEC_HAND = new THREE.Vector3();
const VEC_AIM = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const GRIP_X = new THREE.Vector3(1, 0, 0);
const VEC_GRIP = new THREE.Vector3();
const QUAT_GRIP = new THREE.Quaternion();

/**
 * Süpürme pozunun ve başlık salınımının ORTAK hız eşiği (birim/sn).
 * Tek sabit: iki eşik ayrı olduğunda aradaki bantta gövde ve alet
 * birbirinden kopuyordu.
 */
const SWEEP_SPEED = 1.2;

export class Player extends Actor {
  readonly stack: CarryStack;

  /**
   * KARMA TAŞIMA. Eldeki yığın tek tip değildir: 1 çay + 2 tost aynı anda
   * taşınabilir. `slots[0]` en alttaki, son eleman en üstteki kasadır.
   * Eski model (`carryItem` + `carryCount`) oyuncuyu "3 slotun 3'ü de aynı
   * ürün olmak zorunda" diye kısıtlıyordu — gerçek siparişler karışık.
   */
  readonly slots: ItemId[] = [];
  capacity = 3;
  /** distinctItems() için yeniden kullanılan tampon — referans tutma. */
  private readonly distinctScratch: ItemId[] = [];

  /** Alma/bırakma sayacı */
  handTimer = 0;
  /** Bu karede bir istasyonla etkileşimde mi (animasyon için) */
  interacting = false;
  interactionKind: WorkKind = 'generic';
  private readonly handAction = new HandActionClock();
  private handActionTouched = false;

  /** Visual phase and item transfer use exactly the same upgrade interval. */
  tryHandContact(key: string, kind: WorkKind, dt: number, duration = 0.52): boolean {
    this.handActionTouched = true;
    this.interactionKind = kind;
    // The intent ring can fill while approaching, but the actual item contact
    // begins only after stopping. Moving away cancels a half-completed reach.
    if (this.planarSpeed > .45) {
      this.handAction.reset();
      this.char.setWorkPhase(-1);
      return false;
    }
    const contact = this.handAction.contact(key, dt, duration);
    this.char.setWorkPhase(this.handAction.phase);
    return contact;
  }

  /**
   * PİNG-PONG KİLİDİ. Vitrin hem alınacak hem bırakılacak bir istasyondur;
   * kilit olmasa oyuncu önünde durduğu sürece "al → bırak → al" döngüsüne
   * girerdi. Kilitler yalnızca oyuncu istasyondan uzaklaşınca açılır (World).
   */
  noTakeFrom: string | null = null;
  noDropTo: string | null = null;

  private vx = 0;
  private vz = 0;
  private stepTimer = 0;
  private locomotionTier: 0 | 1 | 2 = 0;
  private readonly handMilestones: THREE.Object3D[][] = [];
  private readonly charmMilestones: THREE.Object3D[][] = [];
  private readonly cleaningCloth: THREE.Object3D;
  private readonly floorMop = createFloorMop();
  private readonly cashReceipt: THREE.Object3D;

  constructor() {
    // Oyuncu oyunun tanınan kahramanıdır: model, ten, saç ve kıyafet her
    // açılışta bire bir aynıdır. Müşteri kalabalığı çeşitlenebilir; oyuncu
    // sayfa yenilenince başka birine dönüşmez.
    super(createCharacter('player', { seed: 0x46494e43 }));
    this.stack = new CarryStack(this.char.carryAnchor, this.char.root);
    this.char.root.add(this.floorMop.root);
    const clothGroup = new THREE.Group();
    clothGroup.name = 'cleaningCloth';
    const clothMain = detail(box(0.22, 0.034, 0.18), mat(0x2dd4bf, { rough: 0.92 }), 0, -0.015, 0);
    const clothSeam = detail(box(0.225, 0.016, 0.03), mat(0x0f766e, { rough: 0.95 }), 0, -0.005, 0.07);
    const clothFold = detail(box(0.14, 0.02, 0.12), mat(0x5eead4, { rough: 0.9 }), 0.02, 0.01, -0.01);
    clothGroup.add(clothMain, clothSeam, clothFold);
    clothGroup.rotation.x = 0.12;
    clothGroup.visible = false;
    this.cleaningCloth = clothGroup;
    this.char.handAnchor.add(this.cleaningCloth);
    this.cashReceipt = detail(box(0.13, 0.012, 0.22), mat(0xfff2cf, { rough: 0.82 }), 0, 0, 0);
    this.cashReceipt.rotation.x = Math.PI / 2;
    this.cashReceipt.visible = false;
    this.char.handAnchor.add(this.cashReceipt);
    this.buildMilestoneAccessories();
    // Taban hız data/upgrades.ts playerSpeed(0) ile AYNI olmalı — World
    // her kurulumda oradan yeniden yazar, bu satır yalnız ilk kare için.
    this.speed = 2.7;
  }

  private buildMilestoneAccessories(): void {
    // Hazır Quaternius rig adları birinci yol; eski prosedürel adlar kayıtlı
    // geliştirme sahneleri için geri dönüş olarak kalır.
    const armL = this.char.root.getObjectByName('LowerArmL') ?? this.char.root.getObjectByName('armLowerL');
    const armR = this.char.root.getObjectByName('LowerArmR') ?? this.char.root.getObjectByName('armLowerR');
    const torso = this.char.root.getObjectByName('Torso') ?? this.char.root.getObjectByName('torso');

    const stageParts = (list: THREE.Object3D[][]): THREE.Object3D[] => {
      const parts: THREE.Object3D[] = [];
      list.push(parts);
      return parts;
    };

    const hand1 = stageParts(this.handMilestones);
    const hand2 = stageParts(this.handMilestones);
    const hand3 = stageParts(this.handMilestones);
    if (armL && armR) {
      for (const arm of [armL, armR]) {
        const band = detail(torus(0.07, 0.014, 5, 10), mat(0xe2703a, { rough: 0.42 }), 0, -0.17, 0);
        band.rotation.x = Math.PI / 2;
        arm.add(band);
        hand1.push(band);
        const cuff = detail(cyl(0.075, 0.075, 0.055, 10), mat(0x4fb59a, { rough: 0.4 }), 0, -0.19, 0);
        arm.add(cuff);
        hand2.push(cuff);
        const gem = detail(sph(0.03, 8, 6), mat(0xffc84a, { rough: 0.25, metal: 0.6 }), 0, -0.2, 0.07);
        arm.add(gem);
        hand3.push(gem);
      }
    }

    const charm1 = stageParts(this.charmMilestones);
    const charm2 = stageParts(this.charmMilestones);
    const charm3 = stageParts(this.charmMilestones);
    if (torso) {
      const bronze = detail(cyl(0.065, 0.065, 0.025, 12), mat(0xc98243, { rough: 0.4, metal: 0.45 }), 0.16, 0.23, 0.245);
      bronze.rotation.x = Math.PI / 2;
      torso.add(bronze);
      charm1.push(bronze);
      const silver = detail(torus(0.075, 0.018, 6, 12), mat(0xd7e0e5, { rough: 0.25, metal: 0.7 }), 0.16, 0.23, 0.26);
      torso.add(silver);
      charm2.push(silver);
      const gold = detail(sph(0.045, 8, 6), mat(0xffc84a, { rough: 0.22, metal: 0.75 }), 0.16, 0.23, 0.275);
      torso.add(gold);
      charm3.push(gold);
    }
    this.setUpgradeMilestones(0, 0, 0);
  }

  setUpgradeMilestones(_speed: number, hands: number, charm: number): void {
    const apply = (stages: THREE.Object3D[][], level: number): void => {
      const highest = Math.min(stages.length - 1, Math.floor(level / 3) - 1);
      for (let i = 0; i < stages.length; i++) {
        const on = i === highest;
        for (const p of stages[i]) p.visible = on;
      }
    };
    // Rahat Ayakkabı yalnız hız/animasyon gelişimidir. Karakterin ayakkabısı
    // ve genel görünümü seviye alınca değişmez.
    apply(this.handMilestones, hands);
    apply(this.charmMilestones, charm);
  }

  /** Anlık hız bileşenleri — kamera öne-bakışı için. */
  get velX(): number {
    return this.vx;
  }
  get velZ(): number {
    return this.vz;
  }

  get carryCount(): number {
    return this.slots.length;
  }

  /** En üstteki ürün — eski tek-tip API ile uyumluluk (öğretici, HUD). */
  get carryItem(): ItemId | null {
    return this.slots.length > 0 ? this.slots[this.slots.length - 1] : null;
  }

  get isFull(): boolean {
    return this.slots.length >= this.capacity;
  }

  get isEmpty(): boolean {
    return this.slots.length <= 0;
  }

  /** Karma taşıma: tek kısıt kapasitedir, tip kısıtı BİLEREK yok. */
  canTake(_item: ItemId): boolean {
    return !this.isFull;
  }

  hasItem(item: ItemId): boolean {
    return this.slots.includes(item);
  }

  /**
   * Eldeki FARKLI ürünler, üstten alta doğru. Dönen dizi bir sonraki
   * çağrıda yeniden kullanılır — referans saklama.
   */
  distinctItems(): readonly ItemId[] {
    const out = this.distinctScratch;
    out.length = 0;
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const it = this.slots[i];
      if (!out.includes(it)) out.push(it);
    }
    return out;
  }

  /** Bir birim al. */
  give(item: ItemId): boolean {
    if (this.isFull) return false;
    this.slots.push(item);
    this.syncStack();
    return true;
  }

  /** En üstteki birimi ver. */
  take(): ItemId | null {
    const it = this.slots.pop() ?? null;
    if (it) this.syncStack();
    return it;
  }

  /** Belirli üründen bir birim ver (en üstteki eşleşen kasa). */
  takeItem(item: ItemId): boolean {
    const i = this.slots.lastIndexOf(item);
    if (i < 0) return false;
    this.slots.splice(i, 1);
    this.syncStack();
    return true;
  }

  dropAll(): void {
    this.slots.length = 0;
    this.syncStack();
  }

  /** Kapasite yükseltilince fazlalık taşınmaz — sadece sınır uygulanır. */
  setCapacity(c: number): void {
    this.capacity = c;
    if (this.slots.length > c) {
      this.slots.length = c;
      this.syncStack();
    }
  }

  setCarrierLevel(level: number): void {
    this.stack.setPresentationStage(level);
    this.syncStack();
  }

  setLocomotionLevel(level: number): void {
    this.locomotionTier = level >= 6 ? 2 : level >= 3 ? 1 : 0;
    this.char.setLocomotionLevel(level);
  }

  private syncStack(): void {
    if (this.slots.length > 0) {
      this.floorMop.root.visible = false;
      this.cleaningCloth.visible = false;
    }
    this.stack.setSlots(this.slots);
    this.char.setCarryCount(this.slots.length);
    this.char.setCarryMode(this.slots.length === 0 ? 'none' : this.stack.usesCart ? 'cart' : 'tray');
  }

  /**
   * Elinde elektrikli süpürge var mı.
   *
   * Süpürge bir ALETTİR: eldeyken ürün/bulaşık alınamaz (World bunu
   * uygular), iki elle tutulur ve hareket hızını biraz düşürür. Eskiden
   * "yığını işgal etmeyen bir mod"du ve karakter süpürge iterken göğsünde
   * çay kulesi taşıyabiliyordu.
   */
  hasVacuum = false;
  private vac: HeldVacuum | null = null;
  private vacTime = 0;
  /** Başlık salınım genliği — süzülür, taban yok (bkz. update). */
  private vacAmp = 0;

  /** Visible floor-head yaw, also used by the cleaning simulation. */
  get vacuumYaw(): number { return this.vac?.sweep.rotation.y ?? 0; }

  /**
   * Süpürgeyi tak / bırak. Model dışarıdan verilir çünkü `entities/`
   * katmanı mesh üretmez; `world/` üretir, burada yalnız takılıp çıkarılır.
   * KÖKE eklenir (carryAnchor'a değil): süpürge yerde, karakterin önünde
   * itilen bir gövdedir — göğüste asılı bir kutu değil. Kök ayak
   * hizasındadır ve karakterle birlikte döner; +z yerel ileri yöndür.
   */
  setVacuumMesh(v: HeldVacuum | null): void {
    if (this.vac) this.vac.dispose();
    this.vac = v;
    this.vacTime = 0;
    this.vacAmp = 0;
    if (v) {
      markDynamic(v.root);
      this.char.root.add(v.root);
    }
    this.char.setPush(!!v, false);
    if (v) this.aimVacuumRod(v);
  }

  /**
   * SAPI ELLERE NİŞANLA.
   *
   * Kabzanın nerede duracağı ellerden türetilir, elle yazılmış bir sabitten
   * değil: animasyon pozu değişse bile sap elleri takip eder. Denetimde
   * ölçülen "el ile kabza arası 0,39 birim boşluk" hatası bu yüzden
   * yapısal olarak imkânsız — hedef zaten ellerin orta noktası.
   */
  private aimVacuumRod(v = this.vac): void {
    if (!v) return;
    const hand = this.char.handMidLocal(VEC_HAND);
    // Pivotun kök-yerel konumu: sweep yalnız Y ekseninde döner, o yüzden
    // matris çarpımına gerek yok — düz trigonometri (kare başına tahsis yok).
    const py = v.rodPivot.position.y;
    const pz = v.rodPivot.position.z;
    const sy = Math.sin(v.sweep.rotation.y);
    const cy = Math.cos(v.sweep.rotation.y);
    const px = pz * sy;
    const pzr = pz * cy;

    const dx = hand.x - px;
    const dy = hand.y - py;
    const dz = hand.z - pzr;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.05) return;
    /**
     * Yön KÖK uzayında hesaplandı ama `rodPivot`'ın dönüşü EBEVEYNİNE
     * (sweep) göredir. Sweep yalnız Y'de döndüğü için yönü −θ kadar geri
     * döndürmek yeterli; tam matris tersine çevirmeye gerek yok.
     */
    VEC_AIM.set((dx * cy - dz * sy) / len, dy / len, (dx * sy + dz * cy) / len);
    v.rodPivot.quaternion.setFromUnitVectors(UP, VEC_AIM);
    v.rod.scale.y = len / v.rodLen;
    v.grip.position.set(0, len, 0);
    // Fit the actual hand span, including its tilt: the head may swing while
    // each palm still meets the grip. Undo sweep + shaft rotation first.
    this.char.handSpanLocal(VEC_GRIP);
    const span = VEC_GRIP.length();
    if (span > 0.001) {
      const gx = VEC_GRIP.x * cy - VEC_GRIP.z * sy;
      const gz = VEC_GRIP.x * sy + VEC_GRIP.z * cy;
      VEC_GRIP.set(gx, VEC_GRIP.y, gz).normalize();
      QUAT_GRIP.copy(v.rodPivot.quaternion).invert();
      VEC_GRIP.applyQuaternion(QUAT_GRIP);
      v.grip.quaternion.setFromUnitVectors(GRIP_X, VEC_GRIP);
      v.grip.scale.x = (span + 0.08) / v.gripWidth;
    }
  }

  update(dt: number, input: MoveInput, nav: NavGrid, bounds: { x0: number; z0: number; x1: number; z1: number }): void {
    if (!this.handActionTouched) {
      this.handAction.reset();
      this.char.setWorkPhase(-1);
    }
    this.handActionTouched = false;
    // Ekran girdisini kamera açısına göre dünya yönüne çevir.
    const ix = input.x;
    const iy = input.y;
    const dirX = COS_Y * ix - SIN_Y * iy;
    const dirZ = -SIN_Y * ix - COS_Y * iy;

    const p = BALANCE.player;
    const target = this.speed * (this.hasVacuum ? BALANCE.vacuum.carrySpeedMult : 1);
    let tx = 0;
    let tz = 0;
    let tau: number = p.decelTau;

    if (input.active) {
      const len = Math.hypot(dirX, dirZ) || 1;
      tx = (dirX / len) * target * input.mag;
      tz = (dirZ / len) * target * input.mag;
      // Mevcut hıza TERS bir giriş geldiyse daha kısa sabitle çevikleş.
      const sp = Math.hypot(this.vx, this.vz);
      const opposed = sp > 0.5 && (this.vx * tx + this.vz * tz) / (sp * target) < -0.15;
      tau = opposed ? p.reverseTau : p.accelTau;
    }

    // Kare hızından VE hedef hızdan bağımsız üstel yaklaşım.
    const k = 1 - Math.exp(-dt / tau);
    this.vx += (tx - this.vx) * k;
    this.vz += (tz - this.vz) * k;
    if (!input.active && Math.abs(this.vx) < 0.02) this.vx = 0;
    if (!input.active && Math.abs(this.vz) < 0.02) this.vz = 0;

    const fromX = this.x;
    const fromZ = this.z;
    nav.slideMove(this, this.vx * dt, this.vz * dt, p.radius);

    // Duvar iç yüzü sınırdan 0,34 içeride; + gövde yarıçapı = 0,7.
    this.x = clamp(this.x, bounds.x0 + 0.7, bounds.x1 - 0.7);
    this.z = clamp(this.z, bounds.z0 + 0.7, bounds.z1 - 0.7);
    // Bölge kilidi açıldığında altımızda eşya belirebilir; içeride kaldıysa dışarı it.
    if (nav.solidBlocked(this.x, this.z, p.radius)) nav.resolve(this, p.radius);

    /**
     * HIZ GERÇEK YER DEĞİŞTİRMEDEN ÖLÇÜLÜR, komut hızından değil.
     *
     * Eskiden `hypot(vx, vz)` kullanılıyordu: duvara bastıran oyuncunun
     * hızı 5,5 okunuyor ama fiilen yerinde duruyordu. Sonuçları ağırdı —
     * (1) niyet kapıları (`still = planarSpeed < 2.2`) HİÇ dolmuyordu:
     *     duvara sıkışmış bir ödeme pedine basan oyuncu parasını hiç
     *     akıtamıyor, ilerleme sessizce kilitleniyordu (bot bunu 50
     *     dakikada 4 bölge açarak yakaladı);
     * (2) animasyon: yerinde duran karakterin bacakları tam hızda
     *     dönüyordu — tepinme.
     * Gerçek yer değiştirme ikisini de kendiliğinden düzeltir.
     */
    const moved = Math.hypot(this.x - fromX, this.z - fromZ);
    const sp = dt > 0 ? moved / dt : 0;
    this.planarSpeed += (sp - this.planarSpeed) * Math.min(1, dt * 16);

    /**
     * Yön GİRDİYE bakar, hıza değil. Hıza bakınca ters dönüşte hız sıfırdan
     * geçerken açı savruluyor ve karakter bir an "geri geri yürüyor" gibi
     * görünüyordu. Ayrıca yavaşken dönüş hızı artırılır — dar yerde çevik.
     */
    const facingX = input.active ? dirX : this.vx;
    const facingZ = input.active ? dirZ : this.vz;
    if (Math.hypot(facingX, facingZ) > 0.05) {
      const slow = 1 - Math.min(1, sp / Math.max(0.001, target));
      const rate = p.turnSpeed + (p.turnSpeedSlow - p.turnSpeed) * slow;
      this.angle = angleTowards(this.angle, Math.atan2(facingX, facingZ), dt * rate);
    }

    // Adım sesi animasyon kademesiyle aynı ritimde: yürüyüş ağır ve sakin,
    // koşu hızlı ama makineli tüfek gibi değildir.
    if (this.planarSpeed > 1.2) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        const base = this.locomotionTier === 0 ? 0.48 : this.locomotionTier === 1 ? 0.36 : 0.29;
        const effort = clamp(this.planarSpeed / Math.max(1, target), 0.62, 1.15);
        this.stepTimer = base / effort;
        sfx('step', 0.28);
      }
    } else {
      this.stepTimer = 0;
    }

    /**
     * SÜPÜRGE: tek eşik.
     *
     * Eskiden temizlik pozu 0,6 birim/sn'de, başlık salınımı 2,0 birim/sn'de
     * açılıyordu: aradaki bantta süpürge geniş geniş süpürürken karakter düz
     * yürüme döngüsündeydi. Artık iki eşik de aynı sabittir ve poz "work"
     * (tezgâh üstüne eğilme) değil, itme katmanıdır.
     */
    const sweeping = this.hasVacuum && this.interacting && this.planarSpeed < SWEEP_SPEED;
    const mopping = !this.hasVacuum && this.isEmpty && this.interacting && this.interactionKind === 'mop';
    this.floorMop.root.visible = mopping;
    this.cleaningCloth.visible = false;
    this.cashReceipt.visible = false;
    if (this.hasVacuum || mopping) {
      this.char.setCarryMode('none');
      this.char.setPush(true, sweeping);
      this.char.setState('idle');
    } else {
      this.char.setCarryMode(this.carryCount === 0 ? 'none' : this.stack.usesCart ? 'cart' : 'tray');
      this.char.setPush(false, false);
      this.char.setWorkKind(this.interactionKind);
      this.char.setState(this.interacting && this.planarSpeed < 0.6 ? 'work' : 'idle');
    }
    this.char.update(dt, this.planarSpeed, this.turnRate(dt));
    this.stack.update(dt, Math.min(1, this.planarSpeed / this.speed), this.planarSpeed);
    if (mopping) this.aimVacuumRod(this.floorMop);
    if (this.stack.usesCart) this.stack.fitCartGrip(this.char.handMidLocal(VEC_HAND), this.char.handSpanLocal(VEC_GRIP));

    /**
     * SÜPÜRGE ANİMASYONU. Başlık temizlerken sağa sola geniş süpürür,
     * yürürken hafif salınır. Salınım frekansı kolların/gövdenin kullandığı
     * `SWEEP_HZ` ile AYNI: eskiden başlık 1,43 Hz, kollar 2,0 Hz'de gidiyor
     * ve hiçbir karede buluşmuyorlardı. Sap ayrıca her karede ellere nişan
     * alır, yani salınım ne olursa olsun kabza avuçta kalır.
     */
    if (this.vac && this.hasVacuum) {
      this.vacTime += dt;
      /**
       * DURAN OYUNCUDA SÜPÜRGE DURUR.
       *
       * HATA (oyuncu bildirdi: "sabit dururken süpürge titriyor"): genlik
       * `0,04 + hız·0,018` idi, yani hız sıfırken bile sabit 0,04 rad
       * kalıyordu ve başlık 1,43 Hz'de sonsuza kadar sallanıyordu. Duran
       * bir cismin kendi kendine titremesi "boşta salınım" değil ARIZA
       * okunur.
       *
       * Genlik artık tamamen hızdan türüyor (taban yok) ve ayrıca
       * SÜZÜLÜYOR: hız birden kesilince salınım kırpılmaz, yumuşakça
       * sıfıra iner. Sönüm kare hızından bağımsız.
       */
      const hedefAmp = sweeping ? 0.5 : Math.min(0.14, this.planarSpeed * 0.024);
      this.vacAmp += (hedefAmp - this.vacAmp) * (1 - Math.exp(-dt * 9));
      if (this.vacAmp < 0.002) this.vacAmp = 0;
      this.vac.sweep.rotation.y = Math.sin(this.vacTime * SWEEP_HZ * Math.PI * 2) * this.vacAmp;
      this.aimVacuumRod();
    }

    this.syncTransform();
    this.interacting = false;
    this.interactionKind = 'generic';
  }

  celebrate(): void {
    this.char.setState('cheer');
  }

  dispose(): void {
    this.setVacuumMesh(null);
    this.floorMop.dispose();
    this.stack.dispose();
    super.dispose();
  }
}
