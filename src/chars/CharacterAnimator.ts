import * as THREE from 'three';
import { Rng } from '../core/Rng';
import { clamp, clamp01, damp, lerp, smoothstep, TAU } from '../core/MathUtils';
import {
  ANKLE_Y,
  BROW_Y,
  HIP_Y,
  LEG_L,
  LEG_U,
  PONYTAIL_REST_X,
  SHOULDER_Y,
  type Rig,
} from './CharacterRig';
import type { AppearanceSpec } from './Appearance';
import type { AnimState, CarryMode, WorkKind } from './types';

/**
 * Prosedürel karakter animatörü.
 *
 * Her durum bir "poz" üretir, pozlar ağırlıklarla harmanlanır (damp'lenmiş,
 * ~0.15 sn) — hiçbir geçiş sıçramaz. Taşıma ayrı bir *katman*tır: idle/walk
 * üstüne bindirilir, kendi durumu yoktur.
 *
 * İŞARET KURALI — karakter +Z'ye bakar, iki uzuv sınıfı TERS çalışır:
 *  • AŞAĞI sarkan uzuvlar (kol, ön kol, bacak, baldır):
 *      `rotation.x` NEGATİF = öne salınır.
 *  • YUKARI bakan parçalar (bob, gövde, kafa):
 *      `rotation.x` POZİTİF = öne eğilir.
 * Bu yüzden yürüyüşte gövde POZİTİF `torsoRx` (öne yaslanır) alırken kafa
 * NEGATİF `headRx` ile karşı döner ve bakış seviyede kalır.
 */

/* ------------------------------------------------------- poz alanları */

const K = {
  bobY: 0,
  bobRx: 1,
  bobRz: 2,
  hipsRx: 3,
  hipsRy: 4,
  hipsRz: 5,
  torsoRx: 6,
  torsoRy: 7,
  torsoRz: 8,
  breath: 9,
  headRx: 10,
  headRy: 11,
  headRz: 12,
  shLy: 13,
  shRy: 14,
  aULx: 15,
  aULy: 16,
  aULz: 17,
  aLLx: 18,
  aURx: 19,
  aURy: 20,
  aURz: 21,
  aLRx: 22,
  lULx: 23,
  lULz: 24,
  lLLx: 25,
  ftLx: 26,
  lURx: 27,
  lURz: 28,
  lLRx: 29,
  ftRx: 30,
  mouthX: 31,
  mouthY: 32,
  browY: 33,
  browT: 34,
  tint: 35,
  tail: 36,
} as const;

const POSE_LEN = 37;

const POSE_DEFAULT = new Float32Array(POSE_LEN);
POSE_DEFAULT[K.mouthX] = 1;
POSE_DEFAULT[K.mouthY] = 1;

// Kare başına tahsis YOK — tüm geçici pozlar modül kapsamında.
const POSE_MAIN = new Float32Array(POSE_LEN);
const POSE_LOCO = new Float32Array(POSE_LEN);
const POSE_EXTRA = new Float32Array(POSE_LEN);
const ANGRY_COLOR = new THREE.Color(0xd2543c);
/** Öfke lerp'inin sonucu — `setHeadTint` onu okuyup kopyalar, saklamaz. */
const TINT_TMP = new THREE.Color();

function reset(p: Float32Array): void {
  p.set(POSE_DEFAULT);
}

function blend(a: Float32Array, b: Float32Array, t: number): void {
  for (let i = 0; i < POSE_LEN; i++) a[i] += (b[i] - a[i]) * t;
}

/* ------------------------------------------------------ durum öncelik */

const LEG_REST_Z = 0.025;
/** −ln(0.88)·60 ≈ 7.67 — 60 fps'te kare başına %12 sönüme denk gelir. */
const LIFT_LAMBDA = 7.67;
const CHEER_HOLD = 1.35;
const ANGRY_HOLD = 1.55;
/**
 * Süpürme salınım frekansı (Hz). Kollar, gövde ve süpürge BAŞLIĞI aynı
 * sayıyı kullanır — üç ayrı frekans kullanıldığında (eskiden 2,0 ve 1,43)
 * eller sapla hiçbir karede buluşmuyordu.
 */
export const SWEEP_HZ = 1.43;
/** Öfke çevrimi kilit süresine tam bölünsün — sürekli 'angry' gelirse dikişsiz döner. */
const ANGRY_F = 2 / ANGRY_HOLD;

/* -------------------------------------------------------- oturma pozu */

/**
 * Kalça rig orijininde kalır — sim `root`'u sandalyenin oturma noktasına koyar.
 * Gövde AŞAĞI ötelenmez; yalnızca BACAKLAR katlanır.
 */
const SIT_THIGH = -1.5; // uyluk öne, ~yatay (aşağı uzuv ⇒ negatif = öne)
const SIT_SHIN = 1.45; // baldır tekrar dikey aşağı → alt bacak sandalyeden sarkar
const SIT_KNEE_Z = 0.075; // dizler hafif ayrık
const SIT_ARM_X = -0.34; // üst kol hafifçe öne
const SIT_ELBOW = -1.55; // dirsek bükük → eller masa yüksekliğinde
const SIT_BITE_ARM = -1.0; // ısırık: üst kol daha öne
const SIT_BITE_ELBOW = -2.05; // ısırık: ön kol ağza doğru kalkar
const SIT_BITE_DUR = 1.2;
/** Oturma ağırlığı bunu aşınca zemin çözücü tamamen kapanır (yumuşak geçişli). */
const SIT_GROUND_OFF = 0.85;

/* Ayak tabanının bilek eklemine göre sınırları — zemin çözücü bunları kullanır. */
const SOLE_DOWN = 0.08; // taban, bileğin bu kadar altında
const SOLE_BACK = -0.09; // topuk
const SOLE_FRONT = 0.19; // burun
const SOLE_OUT = 0.22; // dış kenarın merkez hattına uzaklığı
const LEG_SPAN = 0.115; // kalça ekleminin merkez hattına uzaklığı

/**
 * Ayak tabanının en alçak köşesinin yüksekliği. `side` = -1 sol, +1 sağ;
 * gövdenin öne eğimi ve yana yatması 1. mertebeden hesaba katılır.
 */
function soleLow(
  ankleY: number,
  ankleZ: number,
  phi: number,
  side: number,
  sinLean: number,
  sinRoll: number,
  sinHip: number,
): number {
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const yH = ankleY - SOLE_DOWN * cp - SOLE_BACK * sp;
  const zH = ankleZ - SOLE_DOWN * sp + SOLE_BACK * cp;
  const yT = ankleY - SOLE_DOWN * cp - SOLE_FRONT * sp;
  const zT = ankleZ - SOLE_DOWN * sp + SOLE_FRONT * cp;
  // Yana yatmada yalnızca alçalan taraf sayılır (diğeri zaten yükseliyor).
  let side_ = side * SOLE_OUT * sinRoll + side * LEG_SPAN * sinHip;
  if (side_ > 0) side_ = 0;
  const h = yH - zH * sinLean + side_;
  const t = yT - zT * sinLean + side_;
  return h < t ? h : t;
}

function holdOf(s: AnimState): number {
  if (s === 'cheer') return CHEER_HOLD;
  if (s === 'angry') return ANGRY_HOLD;
  return 0;
}

function priorityOf(s: AnimState): number {
  switch (s) {
    case 'panic':
      return 3;
    case 'cheer':
    case 'angry':
      return 2;
    case 'work':
      return 1;
    default:
      return 0;
  }
}

/* ---------------------------------------------------------- animatör */

export class CharacterAnimator {
  private readonly rig: Rig;
  private readonly rng: Rng;
  private readonly hunch: number;
  private readonly heightMul: number;
  private readonly armRestZ: number;

  private state: AnimState = 'idle';
  private pending: AnimState | null = null;
  private hold = 0;
  private stateTime = 0;

  private t = 0;
  private phase = 0;
  private phaseOff = 0;
  private spd = 0;
  private amp = 0.3;
  private run = 0;
  private gait = 0;
  /** -1 otomatik; oyuncuda yükseltme kademesi 0 yürüyüş, 1 jog, 2 koşu. */
  private locomotionTier = -1;

  private moveW = 0;
  /** Viraja yatış ağırlığı (rad) — dönüş hızından süzülür. */
  private leanW = 0;
  private wWork = 0;
  private wCheer = 0;
  private wAngry = 0;
  private wPanic = 0;
  private wSit = 0;

  private carry = 0;
  private carryMode: CarryMode = 'none';
  private workKind: WorkKind = 'generic';
  private workPhase = -1;
  private carryW = 0;
  private cartW = 0;
  private heavyW = 0;

  /** Elde itilen alet (süpürge) var mı — 0/1 hedef, `pushW` sönümlü ağırlık. */
  private push = 0;
  private pushW = 0;
  /** Süpürme (temizlik) yoğunluğu: gövde salınımı buna göre açılır. */
  private sweep = 0;
  private sweepW = 0;

  private ticTimer = 2;
  private ticTime = 0;
  private ticKind = 0;
  private ticDir = 1;

  private blinkTimer = 1.5;
  private blinkTime = 0;
  private blink = 1;

  /** Otururken "ısırık/yudum" jesti — yalnız `sit` ağırlığı varken işler. */
  private sipTimer = 1.5;
  private sipTime = 0;
  private sipSide = 1;

  private footL = 0;
  private footR = 0;
  private lift = 0;

  private lastTint = 0;
  private dead = false;

  constructor(rig: Rig, spec: AppearanceSpec, seed: number, playerJog = false) {
    this.rig = rig;
    this.rng = new Rng(seed >>> 0);
    this.hunch = spec.hunch;
    // root.scale bacak uzunluğunu dünya ölçeğinde büyütür; kadans hesabı
    // aynı çarpanı bilmezse kısa/uzun arketipler kayar (bkz. stride).
    this.heightMul = Math.max(0.5, spec.heightMul || 1);
    this.armRestZ = rig.armRestZ;
    if (playerJog) this.locomotionTier = 0;
    // Aynı anda çok karakter varken hepsi aynı ritimde nefes almasın.
    this.phaseOff = this.rng.next() * TAU;
    this.t = this.rng.next() * 14;
    this.ticTimer = 1.5 + this.rng.next() * 3;
    this.blinkTimer = this.rng.next() * 3;
    // Aynı masadaki iki misafir aynı anda ısırmasın.
    this.sipTimer = this.rng.next() * 2.5;
  }

  getState(): AnimState {
    return this.state;
  }

  setState(s: AnimState): void {
    if (this.dead) return;
    if (s === this.state) {
      // Aynı durum: tek atımlık animasyon ancak bitmişse baştan başlar.
      if (this.hold <= 0 && holdOf(s) > 0) this.commit(s);
      return;
    }
    // cheer/angry tek atımlıktır: sahibi her karede 'idle' yollasa bile
    // kilit süresi dolana kadar tutulur, sonra bekleyen durum devreye girer.
    if (this.hold > 0 && priorityOf(s) < priorityOf(this.state)) {
      this.pending = s;
      return;
    }
    this.commit(s);
  }

  private commit(s: AnimState): void {
    this.state = s;
    this.stateTime = 0;
    this.hold = holdOf(s);
    this.pending = null;
  }

  setCarryCount(n: number): void {
    this.carry = n < 0 ? 0 : n;
  }

  setCarryMode(mode: CarryMode): void {
    this.carryMode = mode;
  }

  setLocomotionLevel(level: number): void {
    this.locomotionTier = level >= 6 ? 2 : level >= 3 ? 1 : 0;
  }

  setWorkKind(kind: WorkKind): void {
    this.workKind = kind;
  }

  setWorkPhase(phase: number): void {
    this.workPhase = phase;
  }

  /**
   * Elde İTİLEN bir alet var mı (süpürge) ve şu an süpürüyor mu.
   *
   * Süpürge daha önce karakterin KÖKÜNE eklenen ama hiçbir uzva bağlı
   * olmayan bir mesh'ti: eller kabzadan 0,39 birim (boyun %22'si) uzakta
   * boşta sallanıyor, temizlik sırasında karakter tezgâh için tasarlanmış
   * genel "work" pozunu oynuyordu — "süpürgeyi elleriyle tutmuyor, nasıl
   * süpürüyor?" geri bildirimi tam olarak buydu. Bu katman iki kolu da
   * kabzaya kilitler; süpürgenin sapı da her karede ellere nişan alır
   * (bkz. Player.update → aimVacuumRod).
   */
  setPush(on: boolean, sweeping = false): void {
    this.push = on ? 1 : 0;
    this.sweep = on && sweeping ? 1 : 0;
  }

  update(dt: number, planarSpeed: number, turnRate = 0): void {
    if (this.dead) return;
    const d = dt > 0.1 ? 0.1 : dt < 0 ? 0 : dt;
    this.t += d;
    this.stateTime += d;

    if (this.hold > 0) {
      this.hold -= d;
      if (this.hold <= 0) {
        this.hold = 0;
        if (this.pending) this.commit(this.pending);
      }
    }

    // 60 fps'teki 0.88'e denk gelen kare hızından bağımsız sönüm.
    this.liftRelease = Math.exp(-LIFT_LAMBDA * d);

    this.spd = damp(this.spd, planarSpeed, 12, d);
    // Hız yükseltmesi yalnız rakamı değil hareket dilini de değiştirir.
    // Geçiş damp'lidir; seviye alınca poz tek karede sıçramaz.
    const speedTier = this.spd < 4.2 ? 0 : this.spd < 6.4 ? 1 : 2;
    const gaitTarget = this.locomotionTier >= 0 ? Math.min(this.locomotionTier, speedTier) : speedTier;
    this.gait = damp(this.gait, gaitTarget, 5.5, d);
    this.run = clamp01(this.gait - 1);

    /**
     * VİRAJA YATIŞ ("daha akıcı hareket etse" geri bildirimi).
     *
     * Koşarken dönen gövde içeri yatar — hızı okutan en ucuz ikinci
     * ipucu (birincisi kadans). Hedef sert kelepçeli (±0,11 rad ≈ 6°) ve
     * hızla ölçekli: yerinde dönüş yatırmaz, tam koşuda tam yatar.
     * Ağırlık damp'li olduğu için yol kırılmalarındaki tek karelik açı
     * sıçramaları tepe yapmaz; ekran-dışı atlanan karelerden dönen
     * müşteride birikmiş açı farkı da aynı kelepçeye takılır.
     */
    const steadyLoad = this.carryMode === 'cart' ? 0.35 : this.carry > 0 ? 0.62 : 1;
    const leanT = clamp(turnRate * 0.045, -0.11, 0.11) * clamp01(this.spd / 3.5) * steadyLoad;
    this.leanW = damp(this.leanW, leanT, 8, d);

    const trayOn = this.carry > 0 && this.carryMode !== 'cart';
    const cartOn = this.carry > 0 && this.carryMode === 'cart';
    this.carryW = damp(this.carryW, trayOn ? 1 : 0, 8, d);
    this.cartW = damp(this.cartW, cartOn ? 1 : 0, 8, d);
    this.heavyW = damp(this.heavyW, trayOn ? clamp01((this.carry - 3) / 4) : 0, 5, d);
    this.pushW = damp(this.pushW, this.push, 9, d);
    this.sweepW = damp(this.sweepW, this.sweep, 7, d);

    const isPanic = this.state === 'panic';
    this.moveW = damp(this.moveW, clamp01(this.spd / 0.75), 11, d);
    this.wWork = damp(this.wWork, this.state === 'work' && this.workKind !== 'reach' ? 1 : 0, 11, d);
    this.wCheer = damp(this.wCheer, this.state === 'cheer' ? 1 : 0, 11, d);
    this.wAngry = damp(this.wAngry, this.state === 'angry' ? 1 : 0, 11, d);
    this.wPanic = damp(this.wPanic, isPanic ? 1 : 0, 9, d);
    // sit tutulan bir durumdur (idle gibi): iki yönde de aynı sönümle harmanlanır.
    this.wSit = damp(this.wSit, this.state === 'sit' ? 1 : 0, 11, d);

    /**
     * Taşırken adım kısalır; 4 kasadan sonra belirgin şekilde ağırlaşır.
     * ÇARPAN KLEMPTEN İÇERİDE: eski hâlde kısaltma klempin DIŞINDAYDI —
     * adım kısalıyor ama kadans tavana takılı kaldığı için hız düşmüyordu:
     * 3 ürün taşıyan oyuncu %25, 8. seviye garson %67'ye varan ayak
     * kaymasıyla buz pateni yapıyordu. İçeride olunca kısalan adım kadans
     * denklemine girer ve ayak/zemin hızı eşitlenir.
     */
    /**
     * KADANS ÖLÇÜMÜ — NASIL ÖLÇÜLECEĞİ DAHİL (2026-08-11).
     *
     * Çevrim başına kare sayısı TEPE SAYARAK ölçülür ve ölçümden önce
     * animatör OTURTULMALIDIR (≥240 kare boşa çevir): `spd` ve `amp`
     * damp'li olduğu için soğuk başlangıçta yapılan ölçüm kadansı OLDUĞUNDAN
     * KÜÇÜK gösterir. Bu tuzağa bir kez düşüldü — soğuk ölçüm 3,5 birim/sn
     * için 17,1 kare/çevrim dedi, oysa oturmuş gerçek değer 26'dır. Sıfır
     * geçişi saymak da güvenilmez (dalga biçimi simetrik değil);
     * otokorelasyon kullanılacaksa gecikmeye göre normalize edilmeli, yoksa
     * uzun gecikmeler şişer ve saçma periyotlar (109-178 kare) çıkar.
     *
     * Oturmuş gerçek değerler (60 fps, taşımasız):
     *   2,6 birim/sn (müşteri)  → 31 kare/çevrim
     *   3,5 (personel)          → 26
     *   6,2 (oyuncu tabanı)     → 19
     *   12,6 (hız yükseltmesi tepe) → 10   ← TEK sorunlu nokta
     *
     * Yani normal hızlarda animasyon okunaklıdır; "kare kare" riski
     * yalnızca hız yükseltmesinin sonunda doğar.
     *
     * DENENDİ VE GERİ ALINDI: eğimi 0,155'e, tavanı 1,35'e çıkarmak. Düşük
     * hızlarda %14-16 kazandırıyor ama 12,6'da HİÇ etkisi yok — çünkü
     * `poseAmp` aşağıda ayrıca 1,15'te kelepçeli, yani stride zaten doymuş.
     * Sorunlu tek noktayı düzeltmediği için ayarlı sabitleri kurcalamaya
     * değmedi.
     *
     * Gerçek çözüm ikisinden biri ve İKİSİ DE TASARIM KARARIDIR:
     *  (a) bacak oranını büyütmek — stride = 4·bacak·sin(genlik)·heightMul
     *      ve bacak yalnızca 0,42 birim (boyun %24'ü); kısa bacak zorunlu
     *      olarak yüksek kadans demektir,
     *  (b) kadansa tavan koyup ayak kaymasını kabul etmek — 12,6'da 4 Hz
     *      tavanı %34 kayma demek. Kaymayı sıfırlayan ölçümlü çalışmayı
     *      geri alır; karakter ekranda ~52 piksel olduğu için kayma
     *      görünmeyebilir ama bu göz kararıyla verilecek bir karardır.
     */
    const walkAmp = clamp(0.28 + this.spd * 0.105, 0.3, 0.72);
    const jogAmp = clamp(0.5 + this.spd * 0.075, 0.58, 0.93);
    const runAmp = clamp(0.65 + this.spd * 0.04, 0.76, 1.06);
    const jogW = clamp01(this.gait);
    const runW = clamp01(this.gait - 1);
    const gaitAmp = lerp(lerp(walkAmp, jogAmp, jogW), runAmp, runW);
    this.amp = clamp(gaitAmp * (1 - 0.22 * this.carryW - 0.12 * this.heavyW - 0.1 * this.cartW), 0.3, 1.08);

    /**
     * ÇEVRİM BAŞINA YOL = 4 · bacak · sin(genlik).
     *
     * Bir yürüyüş ÇEVRİMİ İKİ ADIMDIR (önce sol, sonra sağ). Adım uzunluğu
     * ≈ 2·bacak·sin(genlik) olduğuna göre çevrim başına yol bunun iki katı,
     * yani 4·bacak·sin(genlik)'tir.
     *
     * Eski formül `2·bacak·sin(genlik)·1,2` yazıyordu — yani çevrimi tek
     * adım sayıyordu. Sonucu ÖLÇÜLDÜ ve hata beklenenin tersi yöndeydi:
     *
     *   hız 1,5 → ayaklar zeminden %67 HIZLI dönüyor
     *   hız 2,6 → %34 hızlı   (müşteri yürüme hızı: ekranda en sık görülen)
     *   hız 3,6 → %10 hızlı   (personel)
     *   hız 6,2 → %19 yavaş   (oyuncu; kadans tavanı yüzünden)
     *
     * Yani karakterler kaymıyordu, TEPİNİYORDU. Eski yorumdaki "bir miktar
     * ayak kaymasını kabul ediyoruz" gerekçesi yanlış formülü savunuyordu.
     * Doğru formülle kayma 5,2 birim/sn'ye kadar sıfır, oyuncunun tepe
     * hızında ise %7'dir. Kadans da tipik hızlarda DÜŞER (2,6'da 2,70 →
     * 1,91 çevrim/sn), yani çevrim daha okunur hâle gelir.
     */
    /**
     * Kadans, POZUN GERÇEK genliğinden hesaplanır:
     *  - panik pozu genliği 1,4× ölçekler (buildPanic → buildWalk(p, 1.4));
     *    eski formül ölçeksiz genlikten frekans hesaplayıp üstüne 1,18 daha
     *    bindiriyordu — kaçan hırsızın ayakları zeminden %35 hızlı dönüyordu;
     *  - `root.scale = heightMul` dünya yer değiştirmesini büyütür (0,92–1,09);
     *    kadans da aynı çarpana bölünmezse kısa boylu %8 kayar, uzun %9 tepinir;
     *  - tavan 2,9 → 4,2 çevrim/sn: 2,9 tempolu bir yürüyüştür, hızlı koşuda
     *    kadans doyunca kayma başlıyordu (4,2 gerçek sprint kadansı);
     *  - `heavyW` frekansı KISMAZ (ağırlık hissi genlik ve gövde salınımında) —
     *    kısınca kayma geri geliyordu.
     */
    const poseAmp = Math.min(this.amp * (isPanic ? 1.4 : 1), 1.15);
    const stride = 4 * (LEG_U + LEG_L) * Math.sin(poseAmp) * this.heightMul;
    /**
     * KADANS TAVANI HIZLA BİRLİKTE YÜKSELİR.
     *
     * Sabit 4,2 tavanı YÜKSELTMESİZ hızlar için doğruydu; yükseltme
     * tablosuyla hiç çarpılmamıştı. Ölçüm: kaymasız azami ayak hızı
     * 4,2 × 2,081 = 8,74 birim/sn, ama hız yükseltmesinin 10. seviyesinde
     * oyuncu 12,6, garson 11,5 birim/sn'ye çıkıyor — %22-36 ayak kayması,
     * yani reddedilen "buz pateni" görünümünün geri dönüşü. Eşik oyuncuda
     * 4. seviyede, garsonda 6. seviyede aşılıyordu.
     *
     * Taban 0,75 korunur (çok yavaşta tepinmeyi önler); tavan artık
     * "kaymasız gereken frekans" ile yarışır: hız ne olursa olsun ayak
     * zemin hızına kilitlenir. 6+ çevrim/sn'lik koşu bu çizgi-film
     * stilinde doğal durur.
     */
    // Faz bir çevrimde iki adım üretir. Sınırsız değer yükseltilmiş
    // oyuncunun ayaklarını titretiyordu; küçük ve kontrollü kayma, saniyede
    // 12 adımlık mekanik koşudan çok daha doğal görünür.
    const gaitForCadence = isPanic ? 2 : this.gait;
    const cadenceCap = gaitForCadence < 0.5 ? 2.05 : gaitForCadence < 1.5 ? 2.45 : isPanic ? 3.2 : 2.9;
    const freq = clamp(this.spd / Math.max(0.25, stride), 0.75, cadenceCap);
    this.phase += freq * TAU * d;
    if (this.phase > TAU) this.phase -= TAU;

    this.tickTic(d);
    this.tickBlink(d);
    if (this.wSit > 0.002) this.tickSip(d);

    this.buildIdle(POSE_MAIN);
    if (this.moveW > 0.002) {
      this.buildWalk(POSE_LOCO, 1);
      blend(POSE_MAIN, POSE_LOCO, this.moveW);
    }
    // Oturma yürüyüşün üstüne biner: sandalyeye varırken moveW sönerken wSit yükselir.
    if (this.wSit > 0.002) {
      this.buildSit(POSE_EXTRA);
      blend(POSE_MAIN, POSE_EXTRA, this.wSit);
    }
    if (this.wWork > 0.002) {
      this.buildWork(POSE_EXTRA);
      blend(POSE_MAIN, POSE_EXTRA, this.wWork * (1 - this.moveW * 0.9));
    }
    if (this.wCheer > 0.002) {
      this.buildCheer(POSE_EXTRA);
      blend(POSE_MAIN, POSE_EXTRA, this.wCheer);
    }
    if (this.wAngry > 0.002) {
      this.buildAngry(POSE_EXTRA);
      blend(POSE_MAIN, POSE_EXTRA, this.wAngry);
    }
    if (this.wPanic > 0.002) {
      this.buildPanic(POSE_EXTRA);
      blend(POSE_MAIN, POSE_EXTRA, this.wPanic);
    }

    if (Math.abs(this.leanW) > 0.0015) {
      // Gövde içeri yatar, kafa yarısını geri alır (bakış ufukta kalır).
      POSE_MAIN[K.bobRz] += -this.leanW;
      POSE_MAIN[K.headRz] += this.leanW * 0.45;
    }

    this.applyCarry(POSE_MAIN);
    this.applyCart(POSE_MAIN);
    this.applyPush(POSE_MAIN);
    this.apply(POSE_MAIN);
  }

  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    /**
     * SAHİPLİK ÇAPASI — karaktere ait GPU kaynakları burada, yalnız burada
     * bırakılır; `dead` bayrağı ikinci çağrıyı yutar. `disposeOwned` birleşik
     * tamponu ve `Skeleton`in kemik dokusunu bırakır (karakter başına bir
     * geometri, bir DataTexture — ikisi de bir kez sızmıştı: Task 5 geometriyi,
     * Task 6 dokuyu kapattı). Önbellekteki paylaşımlı materyal/geometri
     * (world/Materials.ts) hiç etkilenmez, asla dispose EDİLMEZ.
     *
     * TEK DAL (Task 10). Task 7'de burada üç dal vardı: `disposeOwned` →
     * legacy'nin `headMat` klonu → ikisi de yoksa `throw`. İki kurucu birden
     * yaşarken anlamlıydı; `buildRigLegacy` silinince ikinci dalın karşılığı
     * kalmadı ve `throw` da onunla gitti. Gitmesi ayrıca DOĞRU: patlama
     * yarıçapı korumaya çalıştığı sızıntıdan büyüktü — `World.dispose()`
     * karakterleri bir döngüde söküyor, ortada fırlayan bir hata geri kalan
     * karakterlerin sökümünü tamamen iptal ederdi. `disposeOwned` artık
     * `Rig`de ZORUNLU alan, yani eksikliği çalışma anında değil tip
     * denetiminde yakalanıyor.
     */
    this.rig.disposeOwned();
    this.rig.ponytail = null;
  }

  /* ------------------------------------------------------ küçük ritimler */

  private tickTic(d: number): void {
    if (this.ticTime > 0) {
      this.ticTime -= d;
      return;
    }
    this.ticTimer -= d;
    if (this.ticTimer <= 0) {
      this.ticTimer = 3.4 + this.rng.next() * 2.6;
      this.ticTime = 0.95;
      this.ticKind = this.rng.int(0, 2);
      this.ticDir = this.rng.sign();
    }
  }

  private tickBlink(d: number): void {
    if (this.blinkTime > 0) {
      this.blinkTime -= d;
      this.blink = 0.12;
      return;
    }
    this.blink = 1;
    this.blinkTimer -= d;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.2 + this.rng.next() * 3.6;
      this.blinkTime = 0.1;
    }
  }

  /** Bekleme + jest süresi ≈ 2,5-4 sn; taraf ve süre karaktere özel. */
  private tickSip(d: number): void {
    if (this.sipTime > 0) {
      this.sipTime -= d;
      return;
    }
    this.sipTimer -= d;
    if (this.sipTimer <= 0) {
      this.sipTimer = 1.3 + this.rng.next() * 1.5;
      this.sipTime = SIT_BITE_DUR;
      this.sipSide = this.rng.sign();
    }
  }

  /* -------------------------------------------------------------- idle */

  private buildIdle(p: Float32Array): void {
    reset(p);
    const t = this.t + this.phaseOff;
    const br = Math.sin(t * 1.9);
    const sway = Math.sin(t * 0.85);

    // nefes
    p[K.breath] = 0.032 * br;
    p[K.shLy] = 0.014 * br;
    p[K.shRy] = 0.014 * br;
    p[K.bobY] = 0.005 * (0.5 + 0.5 * br);

    // ağırlık aktarma
    p[K.hipsRz] = sway * 0.038;
    p[K.torsoRz] = -sway * 0.026;
    p[K.torsoRy] = sway * 0.02;
    p[K.headRz] = sway * 0.022;
    p[K.headRy] = -sway * 0.05;
    p[K.lLLx] = 0.03;
    p[K.lLRx] = 0.03;

    // kollar hafifçe salınır
    p[K.aULx] = Math.sin(t * 0.8 + 0.5) * 0.07;
    p[K.aURx] = Math.sin(t * 0.8 + 1.1) * 0.07;
    p[K.aULz] = -sway * 0.02;
    p[K.aURz] = -sway * 0.02;
    p[K.aLLx] = -0.13;
    p[K.aLRx] = -0.13;
    p[K.tail] = sway * 0.07;

    if (this.ticTime > 0) {
      const u = 1 - this.ticTime / 0.95;
      const env = Math.sin(u * Math.PI);
      if (this.ticKind === 0) {
        // etrafa bakınır
        p[K.headRy] += env * 0.62 * this.ticDir;
        p[K.torsoRy] += env * 0.14 * this.ticDir;
        p[K.headRz] += env * 0.07 * this.ticDir;
      } else if (this.ticKind === 1) {
        // kasketini/saçını düzeltir
        p[K.aURx] = lerp(p[K.aURx], -0.2, env);
        p[K.aURz] = lerp(p[K.aURz], 2.0, env);
        p[K.aLRx] = lerp(p[K.aLRx], -1.5, env);
        p[K.headRx] += env * 0.09;
        p[K.shRy] += env * 0.03;
      } else {
        // ayağını tıklatır
        p[K.lURx] += env * -0.2;
        p[K.lLRx] += env * 0.42;
        p[K.ftRx] += env * -0.25;
        p[K.hipsRz] += env * 0.045;
      }
    }
  }

  /* -------------------------------------------------------------- walk */

  private buildWalk(p: Float32Array, ampMul: number): void {
    reset(p);
    const ph = this.phase;
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    const a = Math.min(this.amp * ampMul, 1.15);
    const ampN = clamp01(a / 0.9);
    const gait = this.state === 'panic' ? 2 : this.gait;
    const jog = clamp01(gait);
    const run = clamp01(gait - 1);

    // İki kemikli bacak: üst bacak salınır, alt bacak gecikir (diz geçiş anında bükülür).
    // Diz eğrisi C1 SÜREKLİ olmalı: yarım dalga kırpma (max(c,0)) tepe noktasında
    // türev sıçraması yaratıp bacağı "klik"leterek mekanik gösteriyordu.
    // Yükseltilmiş kosinüsün karesi hep >= 0 ve her yerde türevlenebilir.
    const kneeL = (1 + c) * 0.5;
    const kneeR = (1 - c) * 0.5;
    p[K.lULx] = -s * a;
    p[K.lURx] = s * a;
    const kneeLift = 1.18 + jog * 0.18 + run * 0.24;
    p[K.lLLx] = kneeL * kneeL * a * kneeLift;
    p[K.lLRx] = kneeR * kneeR * a * kneeLift;
    // Stil açısı; apply() bunu yere yakınken taban-düz açıya doğru çeker.
    p[K.ftLx] = -(p[K.lULx] + p[K.lLLx]) * 0.45;
    p[K.ftRx] = -(p[K.lURx] + p[K.lLRx]) * 0.45;

    // kollar bacaklara ters
    // Taban hızda sakin, yükseltmelerde giderek atletik: kollar artık
    // omuzdan pervane gibi savrulmaz; koşu arttıkça dirsekler toplanır.
    const armSwing = 0.32 + jog * 0.08 + run * 0.12;
    p[K.aULx] = s * a * armSwing;
    p[K.aURx] = -s * a * armSwing;
    const elbL = (1 + s) * 0.5;
    const elbR = (1 - s) * 0.5;
    const elbowBase = 0.08 + jog * 0.16 + run * 0.34;
    p[K.aLLx] = -(elbowBase + elbL * elbL * (0.2 + run * 0.16)) * ampN - 0.04;
    p[K.aLRx] = -(elbowBase + elbR * elbR * (0.2 + run * 0.16)) * ampN - 0.04;

    // kalça karşı-rotasyonu
    p[K.hipsRy] = -s * (0.075 + jog * 0.025) * ampN;
    p[K.torsoRy] = s * (0.05 + jog * 0.02) * ampN;
    p[K.hipsRz] = -s * (0.02 + jog * 0.014 + run * 0.01) * ampN;
    p[K.torsoRz] = s * (0.022 + jog * 0.01) * ampN;
    p[K.shLy] = -s * 0.012;
    p[K.shRy] = s * 0.012;

    // Dikey yaylanma adım frekansının 2 katı ve DAİMA >= 0 → ayak yere batmaz.
    // Genlik boyun ~%3'ü: gerçek koşuda ~%4'tür, biraz abartı iyi ama fazlası
    // saniyede 5+ kez seken bir titreşime dönüşüyordu.
    const bounce = 0.009 + jog * 0.008 + run * 0.01;
    p[K.bobY] = bounce * ampMul * (0.5 + 0.5 * Math.cos(2 * ph));
    // Öne eğim ağırlıklı olarak gövdede taşınır: bob'un pivotu yerde olduğu için
    // orada çok eğim ayakları zemine gömer.
    // DİKKAT İŞARET: uzuvlar aşağı, gövde/kafa yukarı bakar. Bu yüzden
    // yukarı bakan parçalarda POZİTİF rotation.x = ÖNE eğilme (+Z yönü),
    // aşağı sarkan uzuvlarda ise NEGATİF = öne salınım.
    // bob'un pivotu YERDE: burada eğim, öndeki ayağı zemine gömüp zemin
    // çözücüsünü tetikliyor ve gövde her adımda zıplıyordu. Eğimi neredeyse
    // tamamen gövdeye bıraktık.
    p[K.bobRx] = 0.008 + run * 0.006;
    p[K.torsoRx] = 0.035 + jog * 0.06 + run * 0.14;
    // Kafa gövdenin eğimini kısmen geri alır → bakış ileride ve seviyede kalır.
    p[K.headRx] = -(0.02 + jog * 0.03 + run * 0.07);
    p[K.headRy] = -s * 0.05;
    p[K.breath] = 0.014;
    p[K.tail] = s * 0.2 + 0.08;
    p[K.mouthY] = 1 + run * 0.5;
  }

  /* -------------------------------------------------------------- work */

  private buildWork(p: Float32Array): void {
    reset(p);
    // Kontrollü çevrim: hızlı pompalama yerine ağırlık aktarımı ve temas okunur.
    const w = this.t * TAU * 1.55 + this.phaseOff;
    const sw = Math.sin(w);
    const slow = Math.sin(w * 0.5);

    p[K.bobY] = 0.004 + 0.007 * Math.abs(sw);
    p[K.bobRx] = 0.02;
    p[K.torsoRx] = 0.22 + 0.08 * slow; // tezgâhın üstüne eğilir
    p[K.torsoRy] = 0.05 * Math.sin(w * 0.5 + 1);
    p[K.headRx] = 0.08 + 0.07 * sw; // işe bakar (gövdenin eğimini katlamaz)
    p[K.headRy] = 0.05 * slow;
    p[K.breath] = 0.02 * sw;

    // Dönüşümlü uzanma; eller hedefte kalırken omuzlar küçük karşı hareket yapar.
    p[K.aULx] = -0.92 + 0.32 * sw;
    p[K.aLLx] = -0.92 - 0.24 * sw;
    p[K.aULz] = 0.05;
    p[K.aURx] = -0.92 - 0.32 * sw;
    p[K.aLRx] = -0.92 + 0.24 * sw;
    p[K.aURz] = -0.05;
    p[K.shLy] = 0.022 * sw;
    p[K.shRy] = -0.022 * sw;

    if (this.workKind === 'reach') {
      const contact = this.workPhase >= 0 ? Math.sin(Math.PI * clamp01(this.workPhase)) : (0.5 + 0.5 * sw);
      // Alma/bırakma: bir el hedefe uzanır, diğer el yükü dengeler.
      p[K.aULx] = -0.42;
      p[K.aLLx] = -0.7;
      p[K.aURx] = -0.72 - 0.7 * contact;
      p[K.aLRx] = -0.45 - 0.45 * contact;
      p[K.torsoRy] = -0.1;
    } else if (this.workKind === 'wipe') {
      // Masa/tuvalet silme: dairesel ve dinamik ovma/parlatma hareketi (circular scrub & polish)
      const cw = Math.cos(w);
      p[K.aURx] = -0.84 + 0.22 * cw;
      p[K.aLRx] = -1.18 + 0.18 * sw;
      p[K.aURy] = 0.32 * sw;
      p[K.aURz] = -0.16 * cw;
      p[K.aULx] = -0.78 - 0.14 * cw;
      p[K.aLLx] = -1.12 - 0.14 * sw;
      p[K.aULy] = 0.22 * sw;
      p[K.aULz] = 0.12 * cw;
      p[K.torsoRy] = 0.28 * sw;
      p[K.torsoRx] = 0.33 + 0.06 * cw;
      p[K.hipsRy] = -0.12 * sw;
      p[K.hipsRz] = -0.06 * sw;
    } else if (this.workKind === 'cash') {
      const contact = this.workPhase >= 0 ? Math.sin(Math.PI * clamp01(this.workPhase)) : (0.5 + 0.5 * sw);
      // Kasa: sağ el POS/para tepsisine kısa ve kontrollü dokunur.
      p[K.aULx] = -0.25;
      p[K.aLLx] = -0.65;
      p[K.aURx] = -0.62 - 0.62 * contact;
      p[K.aLRx] = -0.72 - 0.5 * contact;
      p[K.torsoRx] = 0.18;
    } else if (this.workKind === 'machine') {
      p[K.aULx] = -0.72 + 0.1 * sw;
      p[K.aLLx] = -1.0;
      p[K.aURx] = -0.72 - 0.1 * sw;
      p[K.aLRx] = -1.0;
      p[K.torsoRx] = 0.2;
    }

    // ayaklar sabit, dizler hafif bükük
    p[K.lULx] = -0.1;
    p[K.lURx] = 0.09;
    p[K.lLLx] = 0.16;
    p[K.lLRx] = 0.13;
    p[K.lULz] = -0.05;
    p[K.lURz] = 0.05;
    if (this.workKind === 'wipe' || this.workKind === 'machine') {
      // Temizlik hareketinde ağırlık destek ayağına geçer; gövde havada dönmez.
      p[K.lULx] += 0.035 * sw;
      p[K.lURx] -= 0.035 * sw;
      p[K.lLLx] += 0.045 * Math.max(0, sw);
      p[K.lLRx] += 0.045 * Math.max(0, -sw);
      p[K.bobRz] += 0.028 * sw;
    }
    p[K.ftLx] = -(p[K.lULx] + p[K.lLLx]) * 0.6;
    p[K.ftRx] = -(p[K.lURx] + p[K.lLRx]) * 0.6;
    p[K.tail] = 0.06 * sw;
    p[K.mouthY] = 0.85;
    p[K.browY] = -0.012;
  }

  /* --------------------------------------------------------------- sit */

  /**
   * Sandalyede oturma. Kalça rig orijininde kalır (sahibi `root.position.y`'yi
   * oturma yüksekliğine yazar), gövde aşağı ötelenmez — yalnızca bacaklar katlanır:
   * uyluk öne yatay, baldır tekrar dikey aşağı, taban yere paralel.
   * `bobRx` sıfırdır: bob'un pivotu YERDE, otururken oradan eğmek gövdeyi savurur.
   */
  private buildSit(p: Float32Array): void {
    reset(p);
    const t = this.t + this.phaseOff;
    const br = Math.sin(t * 1.35); // yavaş nefes
    const sway = Math.sin(t * 0.45); // çok yavaş ağırlık kaydırma

    p[K.bobY] = 0.045 + 0.004 * (0.5 + 0.5 * br);
    p[K.breath] = 0.026 * br;
    p[K.shLy] = 0.011 * br;
    p[K.shRy] = 0.011 * br;

    // gövde dik, kıl payı öne (yukarı bakan parça ⇒ pozitif = öne)
    p[K.torsoRx] = 0.07 + 0.012 * br;
    p[K.torsoRy] = sway * 0.018;
    p[K.torsoRz] = sway * 0.014;
    p[K.hipsRz] = sway * 0.012;
    // kafa gövdenin eğimini geri alır → bakış seviyede
    p[K.headRx] = -0.05;
    p[K.headRy] = sway * 0.05;
    p[K.headRz] = sway * 0.016;

    // bacaklar katlanır; dizler hafif ayrık
    p[K.lULx] = SIT_THIGH;
    p[K.lURx] = SIT_THIGH;
    p[K.lLLx] = SIT_SHIN;
    p[K.lLRx] = SIT_SHIN;
    p[K.lULz] = -SIT_KNEE_Z;
    p[K.lURz] = SIT_KNEE_Z;
    // zincir toplamının tersi = taban tam yatay
    p[K.ftLx] = -(SIT_THIGH + SIT_SHIN);
    p[K.ftRx] = -(SIT_THIGH + SIT_SHIN);

    // kollar masaya doğru: üst kol hafif öne, dirsek bükük
    p[K.aULx] = SIT_ARM_X + 0.02 * br;
    p[K.aURx] = SIT_ARM_X + 0.02 * br;
    p[K.aLLx] = SIT_ELBOW;
    p[K.aLRx] = SIT_ELBOW;
    p[K.aULz] = 0.05;
    p[K.aURz] = -0.05;
    p[K.tail] = 0.05 + sway * 0.03;

    // ısırık / yudum — bir ön kol ağza kalkar ve geri iner
    let bite = 0;
    if (this.sipTime > 0) {
      const u = 1 - this.sipTime / SIT_BITE_DUR;
      // Trapez zarf: kalk → tut → indir. İki uçta da türev SIFIR, jest sıçramaz.
      bite = Math.min(smoothstep(u / 0.3), 1 - smoothstep((u - 0.62) / 0.3));
      if (this.sipSide > 0) {
        p[K.aURx] = lerp(p[K.aURx], SIT_BITE_ARM, bite);
        p[K.aLRx] = lerp(p[K.aLRx], SIT_BITE_ELBOW, bite);
        p[K.shRy] += bite * 0.022;
      } else {
        p[K.aULx] = lerp(p[K.aULx], SIT_BITE_ARM, bite);
        p[K.aLLx] = lerp(p[K.aLLx], SIT_BITE_ELBOW, bite);
        p[K.shLy] += bite * 0.022;
      }
      p[K.headRx] += bite * 0.05; // ağız ele doğru iner
      p[K.torsoRx] += bite * 0.03;
      p[K.mouthY] = 1 + bite * 0.26 * (0.5 + 0.5 * Math.sin(this.t * 13)); // çiğneme
    }

    // nadir etrafa bakış — mevcut tik zamanlayıcısına takılır (ısırıkta bastırılır)
    if (this.ticTime > 0 && this.ticKind !== 1) {
      const u = 1 - this.ticTime / 0.95;
      const look = (0.5 - 0.5 * Math.cos(u * TAU)) * (1 - bite);
      p[K.headRy] += look * 0.5 * this.ticDir;
      p[K.headRz] += look * 0.05 * this.ticDir;
      p[K.torsoRy] += look * 0.08 * this.ticDir;
    }
  }

  /* ------------------------------------------------------------- cheer */

  private buildCheer(p: Float32Array): void {
    reset(p);
    const u = this.stateTime;
    // İki zıplama, sonra yerine oturur. Zarf, kesme anıyla (1,15 sn) AYNI yerde
    // sıfırlanmalı: bölen 1,25 iken hop 0,065'ten 0'a sıçrayıp gövdeyi ve
    // bacakları tek karede kırpıyordu (değer süreksizliği).
    const hop = u < 1.15 ? Math.abs(Math.sin(u * Math.PI * 2)) * clamp01(1 - u / 1.15) : 0;
    const wig = Math.sin(this.t * 11);

    p[K.bobY] = 0.02 + hop * 0.26;
    p[K.aULz] = -2.3 - wig * 0.16;
    p[K.aURz] = 2.3 + wig * 0.16;
    p[K.aULx] = -0.18;
    p[K.aURx] = -0.18;
    p[K.aLLx] = -0.3;
    p[K.aLRx] = -0.3;
    p[K.shLy] = 0.045;
    p[K.shRy] = 0.045;
    p[K.torsoRx] = -0.14; // göğüs havaya
    p[K.headRx] = -0.24; // yukarı bakar
    p[K.headRz] = wig * 0.05;
    p[K.breath] = 0.035;

    p[K.lULx] = -hop * 0.5;
    p[K.lURx] = -hop * 0.5;
    p[K.lLLx] = hop * 1.0;
    p[K.lLRx] = hop * 1.0;
    p[K.ftLx] = -hop * 0.3;
    p[K.ftRx] = -hop * 0.3;

    // kocaman gülümseme
    p[K.mouthX] = 1.55;
    p[K.mouthY] = 2.0;
    p[K.browY] = 0.035;
    p[K.browT] = 0.16;
    p[K.tail] = hop * 0.4;
  }

  /* ------------------------------------------------------------- angry */

  private buildAngry(p: Float32Array): void {
    reset(p);
    const u = this.stateTime;
    const shake = Math.sin(this.t * 33);
    const armUp = 0.5 + 0.5 * Math.cos(u * TAU * ANGRY_F); // kollar havaya, sonra aşağı
    // Tepinme darbesi de C1 SÜREKLİ olmalı: yarım dalga kırpma (max(sin,0)) her
    // sıfır geçişinde türev sıçratıp ayağı "klik"letiyordu. Kare hem >= 0 hem
    // her yerde türevlenebilir (diz eğrileriyle aynı çözüm) ve çevrim yine dikişsiz.
    const st = Math.sin(u * TAU * ANGRY_F * 1.5);
    const stomp = st > 0 ? st * st : 0; // yere tepinme

    p[K.aULz] = -(0.3 + armUp * 1.95);
    p[K.aURz] = 0.3 + armUp * 1.95;
    p[K.aULx] = -0.1 + shake * 0.05;
    p[K.aURx] = -0.1 - shake * 0.05;
    p[K.aLLx] = -0.35;
    p[K.aLRx] = -0.35;
    p[K.shLy] = 0.03;
    p[K.shRy] = 0.03;

    p[K.lURx] = -stomp * 0.5;
    p[K.lLRx] = stomp * 0.95;
    p[K.ftRx] = -stomp * 0.28;
    p[K.bobY] = stomp * 0.05;

    p[K.torsoRx] = -0.08;
    p[K.torsoRz] = shake * 0.05;
    p[K.hipsRy] = shake * 0.045;
    p[K.hipsRz] = -shake * 0.03;
    p[K.headRx] = -(0.26 + shake * 0.03); // baş geriye
    p[K.headRz] = shake * 0.04;

    p[K.mouthX] = 1.4;
    p[K.mouthY] = 0.55;
    p[K.browY] = -0.05;
    p[K.browT] = -0.45;
    p[K.tint] = 1;
  }

  /* ------------------------------------------------------------- panic */

  private buildPanic(p: Float32Array): void {
    // Abartılı koşu tabanı + savrulan kollar + arkaya bakan kafa.
    this.buildWalk(p, 1.4);
    const t = this.t;
    p[K.aULz] = -1.75 + Math.sin(t * 17) * 0.55;
    p[K.aURz] = 1.75 - Math.sin(t * 16 + 1.1) * 0.55;
    p[K.aULx] = -0.5 + Math.sin(t * 15) * 0.6;
    p[K.aURx] = -0.5 + Math.sin(t * 15 + 2.1) * 0.6;
    p[K.aLLx] = -1.35 + Math.sin(t * 19) * 0.35;
    p[K.aLRx] = -1.35 + Math.sin(t * 18 + 1) * 0.35;
    p[K.shLy] = 0.05;
    p[K.shRy] = 0.05;
    p[K.headRy] = Math.sin(t * 3.6) * 0.85;
    p[K.headRx] = -0.2; // arkaya göz atarken kafa dik
    p[K.headRz] = Math.sin(t * 7) * 0.06;
    p[K.bobRx] = 0.02;
    p[K.bobY] *= 1.4;
    p[K.torsoRx] = 0.42; // kaçarken belirgin öne eğim
    p[K.mouthX] = 0.75;
    p[K.mouthY] = 1.9;
    p[K.browY] = 0.05;
    p[K.browT] = 0.28;
  }

  /* -------------------------------------------------------- taşıma katmanı */

  private applyCarry(p: Float32Array): void {
    /**
     * KUTLAMA TAŞIMAYI TAMAMEN SÖNDÜRMEZ.
     *
     * Eski çarpan `(1 − wCheer)` idi: hedef tamamlanınca kollar havaya
     * açılırken tepsi kulesi göğüste asılı kalıyordu — 1,35 saniye boyunca
     * 8 tepsilik yığın hiçbir uzva temas etmeden havada duruyordu. Hedefler
     * çoğunlukla servis sırasında (eller doluyken) tamamlandığı için sık
     * görünen bir hataydı. Taban ağırlık bırakılınca bir kol yığında kalır,
     * kutlama yine okunur.
     */
    const cheerKeep = this.carry > 0 ? 1 - 0.55 * this.wCheer : 1 - this.wCheer;
    const w = this.carryW * cheerKeep * (1 - this.wAngry) * (1 - this.wPanic) * (1 - this.wSit);
    if (w < 0.002) return;
    const heavy = this.heavyW;
    // Products appear at hand contact: keep the grasp valid from that first frame.
    const grasp = this.carry > 0 && this.carryMode !== 'cart' ? 1 : w;

    // Dirsekler bükülü, eller carryAnchor hizasında yığını kucaklar.
    p[K.aULx] = lerp(p[K.aULx], -0.55, grasp);
    p[K.aURx] = lerp(p[K.aURx], -0.55, grasp);
    p[K.aULz] = lerp(p[K.aULz], 0.16, grasp);
    p[K.aURz] = lerp(p[K.aURz], -0.16, grasp);
    p[K.aLLx] = lerp(p[K.aLLx], -0.9, grasp);
    p[K.aLRx] = lerp(p[K.aLRx], -0.9, grasp);

    // gövde yükü dengelemek için GERİYE yaslanır (negatif = arkaya)
    p[K.torsoRx] = lerp(p[K.torsoRx], -(0.045 + heavy * 0.025), w);
    // kafa öne gelip bakışı yolda tutar
    p[K.headRx] = lerp(p[K.headRx], 0.16 + heavy * 0.08, w);
    p[K.shLy] += 0.022 * w;
    p[K.shRy] += 0.022 * w;
    p[K.lLLx] += 0.12 * heavy * w;
    p[K.lLRx] += 0.12 * heavy * w;

    // Yük varken adımın karşı-rotasyonunu azalt, gövdeyi yığına kilitle.
    const carryStep = Math.sin(this.phase) * this.moveW * w;
    p[K.hipsRy] *= 1 - 0.45 * w;
    p[K.torsoRy] = lerp(p[K.torsoRy], -carryStep * 0.025, 0.6 * w);
    p[K.headRy] += carryStep * 0.018;

    // 4 kasadan sonra görünür sallanma
    if (heavy > 0.01) {
      const wob = Math.sin(this.t * 4.6) * heavy * w;
      p[K.hipsRz] += wob * 0.07;
      p[K.torsoRz] += wob * 0.045;
      p[K.bobRz] += Math.sin(this.t * 3.7 + 1.2) * 0.05 * heavy * w;
    }
  }

  /** Servis arabasında kollar tepsi pozuna girmez; iki el tutamağa kilitlenir. */
  private applyCart(p: Float32Array): void {
    const w = this.cartW * (1 - this.wCheer) * (1 - this.wAngry) * (1 - this.wPanic) * (1 - this.wSit);
    if (w < 0.002) return;

    const stepCounter = Math.sin(this.phase) * this.moveW;
    p[K.aULx] = lerp(p[K.aULx], -0.58 + stepCounter * 0.025, w);
    p[K.aURx] = lerp(p[K.aURx], -0.58 - stepCounter * 0.025, w);
    p[K.aULz] = lerp(p[K.aULz], 0.25, w);
    p[K.aURz] = lerp(p[K.aURz], -0.25, w);
    p[K.aLLx] = lerp(p[K.aLLx], -0.48, w);
    p[K.aLRx] = lerp(p[K.aLRx], -0.48, w);
    p[K.torsoRx] = lerp(p[K.torsoRx], 0.13, w);
    p[K.headRx] = lerp(p[K.headRx], -0.04, w);
    p[K.shLy] += 0.012 * w;
    p[K.shRy] += 0.012 * w;
  }

  /* -------------------------------------------------------- itme katmanı */

  /**
   * SÜPÜRGE TUTUŞU. İki kol da öne uzanıp kabzayı kavrar; gövde itme
   * yönünde hafifçe öne yaslanır.
   *
   * Sabitler el konumunu belirler, süpürgenin sapı da o konuma nişan alır
   * (Player.aimVacuumRod) — yani poz değişirse sap kendiliğinden takip eder,
   * "el ile kabza arasında boşluk" hatası yapısal olarak imkânsız hâle gelir.
   *
   * Taşıma katmanının ÜSTÜNE gelir ve onu bastırır: süpürge artık bir
   * "mod" değil ALET olduğu için elde ürün taşınamaz; yine de kayıttan
   * dönüşte iki durum çakışırsa itme kazanır.
   */
  private applyPush(p: Float32Array): void {
    const w = this.pushW * (1 - this.wCheer) * (1 - this.wAngry) * (1 - this.wPanic) * (1 - this.wSit);
    if (w < 0.002) return;

    /**
     * Süpürme salınımı: temizlerken gövde ve kollar sağa-sola geniş,
     * yürürken yalnızca hafif bir eşlik. Süpürgenin başlık salınımıyla
     * AYNI frekanstan (1,43 Hz) sürülür — eskiden başlık 1,43 Hz'de,
     * kollar 2,0 Hz'de gidiyor ve hiçbir karede buluşmuyorlardı.
     */
    const sw = Math.sin(this.t * SWEEP_HZ * TAU);
    const s = this.sweepW * w;

    // Kollar öne uzanır (aşağı uzuv ⇒ negatif = öne), dirsek hafif bükük.
    p[K.aULx] = lerp(p[K.aULx], -0.62 + sw * 0.06 * this.sweepW, w);
    p[K.aURx] = lerp(p[K.aURx], -0.62 - sw * 0.06 * this.sweepW, w);
    // İçe doğru: iki el gövdenin ortasında, kabzanın iki tutamağında buluşur.
    p[K.aULz] = lerp(p[K.aULz], 0.3, w);
    p[K.aURz] = lerp(p[K.aURz], -0.3, w);
    p[K.aLLx] = lerp(p[K.aLLx], -0.5, w);
    p[K.aLRx] = lerp(p[K.aLRx], -0.5, w);

    // Gövde itmeye yaslanır; kafa yere/başlığa bakar.
    p[K.torsoRx] = lerp(p[K.torsoRx], 0.2 + 0.05 * this.sweepW, w);
    p[K.torsoRy] += sw * 0.1 * s;
    p[K.headRx] = lerp(p[K.headRx], 0.16, w);
    p[K.headRy] += sw * 0.07 * s;
    p[K.hipsRy] += sw * 0.05 * s;
    p[K.hipsRz] -= sw * 0.04 * s;
    p[K.shLy] += 0.014 * w;
    p[K.shRy] += 0.014 * w;
    // Süpürürken ağırlık ayaktan ayağa geçer.
    p[K.bobRz] += sw * 0.03 * s;
    p[K.lULx] += sw * 0.045 * s;
    p[K.lURx] -= sw * 0.045 * s;
    p[K.lLLx] += Math.max(0, sw) * 0.06 * s;
    p[K.lLRx] += Math.max(0, -sw) * 0.06 * s;
  }

  /* ------------------------------------------------------------- uygula */

  /**
   * Zemin çözücü. Her bacak için ileri kinematikle bilek konumunu bulur:
   *  1) bilek yere yakınsa taban yere paralel çekilir (havadayken stil açısı serbest),
   *  2) kalan gömülme (yana yatma / öne eğim kaynaklı) kadar gövde yukarı kaldırılır.
   * Böylece "ayak y=0'ın altına inmez" şartı her durumda garanti altındadır.
   *
   * OTURURKEN GEÇERSİZ: karakter sandalyede, zeminin ÜSTÜNDEDİR ve bacaklar
   * boşta sarkar — zorlanan "taban düz" ile kaldırma pozla kavga eder, gövdeyi
   * sandalyeden yukarı iterdi. `wSit` baskınken çözücü tamamen kapanır; `wSit`
   * yumuşak söndüğü için kapanma/açılma sıçramaz.
   */
  private solveFeet(p: Float32Array): void {
    const ground = 1 - smoothstep(this.wSit / SIT_GROUND_OFF);
    if (ground <= 0) {
      this.footL = p[K.ftLx];
      this.footR = p[K.ftRx];
      this.lift *= this.liftRelease; // yavaş bırakma korunur → 0'a süzülür
      return;
    }

    const sinLean = Math.sin(p[K.bobRx]);
    const sinRoll = Math.sin(p[K.bobRz]);
    const sinHip = Math.sin(p[K.hipsRz]);

    const t1L = p[K.lULx];
    const t2L = t1L + p[K.lLLx];
    const ayL = HIP_Y - LEG_U * Math.cos(t1L) - LEG_L * Math.cos(t2L);
    const azL = -LEG_U * Math.sin(t1L) - LEG_L * Math.sin(t2L);
    this.footL = lerp(p[K.ftLx], -t2L, clamp01(1 - (ayL - ANKLE_Y) / 0.16) * ground);
    const lowL = soleLow(ayL, azL, this.footL, -1, sinLean, sinRoll, sinHip);

    const t1R = p[K.lURx];
    const t2R = t1R + p[K.lLRx];
    const ayR = HIP_Y - LEG_U * Math.cos(t1R) - LEG_L * Math.cos(t2R);
    const azR = -LEG_U * Math.sin(t1R) - LEG_L * Math.sin(t2R);
    this.footR = lerp(p[K.ftRx], -t2R, clamp01(1 - (ayR - ANKLE_Y) / 0.16) * ground);
    const lowR = soleLow(ayR, azR, this.footR, 1, sinLean, sinRoll, sinHip);

    // 4 mm pay: yatma+eğim bileşimi 1. mertebeden çözülüyor, artık hata payı
    // yukarı yazılsın (görünmez) — aşağı taşarsa ayak zemine girer (kabul edilemez).
    const low = lowL < lowR ? lowL : lowR;
    const need = low < 0 ? (0.004 - low) * ground : 0;
    // Kaldırma ANINDA uygulanır (ayak asla zemine girmez) ama yavaş bırakılır.
    // Ham değer çevrim içinde 0 ↔ 0.05 arasında sıçrıyor ve gövdeyi zıplatıyordu.
    if (need > this.lift) this.lift = need;
    else this.lift = need + (this.lift - need) * this.liftRelease;
  }

  /**
   * Kaldırma bırakma katsayısı. `update()` her karede `exp(-LIFT_LAMBDA*dt)`
   * ile tazeler → 144 Hz'de de 30 Hz'de de aynı gerçek-zaman sönümü.
   * (Sabit 0.88 kullanılırsa yüksek tazeleme hızında bırakma yavaşlar.)
   */
  private liftRelease = 0.88;

  private apply(p: Float32Array): void {
    const r = this.rig;
    this.solveFeet(p);

    // Yaylanma daima >= 0, üstüne zemin çözücünün gerektirdiği kaldırma eklenir.
    r.bob.position.y = (p[K.bobY] > 0 ? p[K.bobY] : 0) + this.lift;
    r.bob.rotation.set(p[K.bobRx], 0, p[K.bobRz]);

    r.hips.rotation.set(p[K.hipsRx], p[K.hipsRy], p[K.hipsRz]);
    r.torso.rotation.set(p[K.torsoRx] + this.hunch, p[K.torsoRy], p[K.torsoRz]);
    r.torsoMesh.scale.y = 1 + p[K.breath];
    r.head.rotation.set(p[K.headRx] - this.hunch * 0.65, p[K.headRy], p[K.headRz]);

    r.shoulderL.position.y = SHOULDER_Y + p[K.shLy];
    r.shoulderR.position.y = SHOULDER_Y + p[K.shRy];
    r.armUpperL.rotation.set(p[K.aULx], p[K.aULy], p[K.aULz] - this.armRestZ);
    r.armUpperR.rotation.set(p[K.aURx], p[K.aURy], p[K.aURz] + this.armRestZ);
    r.armLowerL.rotation.x = p[K.aLLx];
    r.armLowerR.rotation.x = p[K.aLRx];

    r.legUpperL.rotation.set(p[K.lULx], 0, p[K.lULz] - LEG_REST_Z);
    r.legUpperR.rotation.set(p[K.lURx], 0, p[K.lURz] + LEG_REST_Z);
    r.legLowerL.rotation.x = p[K.lLLx];
    r.legLowerR.rotation.x = p[K.lLRx];
    r.footL.rotation.x = this.footL;
    r.footR.rotation.x = this.footR;

    r.mouth.scale.set(p[K.mouthX], p[K.mouthY], 1);
    r.browL.position.y = BROW_Y + p[K.browY];
    r.browR.position.y = BROW_Y + p[K.browY];
    r.browL.rotation.z = p[K.browT];
    r.browR.rotation.z = -p[K.browT];
    r.eyeL.scale.y = this.blink;
    r.eyeR.scale.y = this.blink;

    if (r.ponytail) r.ponytail.rotation.x = PONYTAIL_REST_X + p[K.tail];

    /**
     * ÖFKEDE KAFA KIZARIR. Karakterin kendi materyali yok (Task 7): renk kafa
     * VERTEX aralığına yazılıyor — global materyali mutasyona uğratmak
     * sahnedeki HERKESİ kızdırırdı.
     *
     * KOŞUL "DEĞER DEĞİŞTİ Mİ" (eskiden "sıfırdan büyük mü"): öfke kilidi
     * boyunca tint sabit 1'de duruyor ve eski koşul aynı rengi her kare
     * yeniden yazıyordu — 221 vertex + tampon yüklemesi, bedavaya. Yazılan
     * DEĞERLER değişmedi (aynı kare, aynı renk), yalnız gereksiz tekrarlar
     * düştü.
     *
     * Kadansı seyreltmek (ör. yalnız durum değişiminde yazmak, brief'in
     * önerisi) rampayı basamaklandırır ve özdeşlik kapısının renk kolunda
     * legacy'den sapardı — o yüzden rampa hâlâ kare kare. Legacy gitti ama
     * karar kalıcı: basamaklı bir kızarma oyunda da görünür.
     */
    const tint = p[K.tint];
    if (tint !== this.lastTint) {
      const t = tint > 1 ? 1 : tint;
      r.setHeadTint(t > 0 ? TINT_TMP.copy(r.headBaseColor).lerp(ANGRY_COLOR, t) : null);
      this.lastTint = tint;
    }
  }
}
