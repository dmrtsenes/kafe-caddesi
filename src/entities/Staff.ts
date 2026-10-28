import { Actor } from './Actor';
import { CarryStack } from './CarryStack';
import { createCharacter } from '../chars';
import type { ItemId } from '../data/items';
import type { StaffRole } from '../data/staff';
import {
  baristaCapacity,
  baristaSpeed,
  busserCapacity,
  busserSpeed,
  busserWorkTime,
  cashierSpeed,
  waiterCapacity,
  waiterHandInterval,
  waiterSpeed,
} from '../data/staff';
import type { StationEntity } from '../sim/Station';
import { createStaffStatusBadge, type StaffStatus, type StaffStatusBadge } from '../world/StaffStatusView';

/**
 * `serve`  → garson: vitrinden aldığını masaya götürüyor
 * `mop`    → komi: zemindeki lekeyi siliyor
 * `supply` → komi: tuvalete peçete/kâğıt koyuyor
 */
export type StaffJob = 'rest' | 'fetch' | 'deliver' | 'station' | 'collect' | 'serve' | 'mop' | 'supply';

/** Personel rolünden karakter görünümüne eşleme (bire bir). */
const STAFF_CHAR_ROLE = {
  waiter: 'waiter',
  cashier: 'cashier',
  barista: 'barista',
  busser: 'busser',
} as const;

/**
 * Personel: rolüne göre farklı bir görev döngüsü koşturur.
 * Görev seçimi StaffManager'da, yürüme/animasyon burada.
 */
export class Staff extends Actor {
  readonly role: StaffRole;
  readonly index: number;
  /** Job searches read this hundreds of times per frame; built once. */
  readonly uid: string;

  level = 0;
  job: StaffJob = 'rest';

  readonly stack: CarryStack;
  carryItem: ItemId | null = null;
  carryCount = 0;
  capacity = 3;
  private readonly statusBadge: StaffStatusBadge;

  /** fetch → nereden alacak · deliver → nereye bırakacak */
  source: StationEntity | null = null;
  dest: StationEntity | null = null;
  /**
   * fetch → bankodan alınacak BELİRLİ ürün. Bankolar karma tampondur;
   * bu alan yokken garson "üstteki her neyse" alıyordu, eldekiyle tip
   * uyuşmayınca da alıp geri koyarak bankonun başında sonsuza dek
   * dönüyordu (soak: 68 sn'lik fetch kilidi).
   */
  fetchItem: ItemId | null = null;
  /** cashier/barista → sabit istasyon */
  assigned: StationEntity | null = null;
  /** mop → hedef lekenin kimliği (−1 = yok). Kimlik tutuluyor ki sim/Spills'e bağ oluşmasın. */
  spillId = -1;
  /**
   * Lekeye YAKLAŞMA ölçümü. Ulaşılamayan bir lekeye takılan komiyi
   * kurtarmak için kullanılır: en yakın mesafe ilerlemiyorsa iş bırakılır.
   */
  mopBestDist = Infinity;
  /** Lekenin en düşük görülen miktarı — temizlik ilerliyor mu ölçer. */
  mopBestAmount = Infinity;
  mopStallTimer = 0;

  /**
   * ZEMİN TURU İÇİN ÖNCEKİ KARE KONUMU (yalnız komi kullanır).
   *
   * Trafik kiri zemine YAYILARAK üretilir — her hareketli aktör bastığı
   * hücreye yazar. Bu yüzden sökümün de yayılması gerekir: tek noktada
   * duran bir temizlikçi, ölçümde 36 kat hızlandırıldığında bile kaplamayı
   * kıpırdatamadı (0,382 → 0,391). Komi artık YÜRÜDÜĞÜ İZİ siler; bunun
   * için iki kare arasındaki doğru parçası gerekiyor.
   *
   * NaN = henüz konum alınmadı (ilk kare atlanır).
   */
  grimePrevX = NaN;
  grimePrevZ = NaN;


  handTimer = 0;
  thinkTimer = 0;
  workTimer = 0;
  atStation = false;
  /** İstasyonda hazır beklemekle gerçekten çalışmak aynı görsel değildir. */
  workingVisual = false;

  /**
   * "Vardım ama yetişemiyorum" sayacı.
   *
   * A* hedefi dar bir yere düşerse yol hedefin bir adım berisinde biter;
   * varlık orada durur, `atStation` hiç true olmaz ve iş sonsuza kadar
   * askıda kalır (komi elinde bulaşıkla kovanın 1,3 birim yanında dört
   * dakika bekliyordu). Bu sayaç dolunca uzanma mesafesi genişletilir:
   * kilitlenmektense bir adım uzaktan uzanmak yeğdir.
   */
  stallTimer = 0;

  /**
   * İLERLEME BEKÇİSİ — hız ölçümünün kör noktası.
   *
   * İki personel aynı noktaya yürüyünce gövde ayrıştırma ikisini de her
   * karede itiyor; planarSpeed 0,7 civarında kalıyor ve "kıpırdamıyor"
   * şartı hiç tutmuyordu — soak testinde iki komi 486 saniye boyunca
   * kovanın dibinde birbirini itti. Bu üçlü, hedefe olan EN İYİ mesafeyi
   * izler: mesafe 2,5 saniye boyunca iyileşmiyorsa hız ne olursa olsun
   * personel takılı sayılır ve stallTimer işler.
   */
  private progressBest = Infinity;
  private progressTimer = 0;
  private progressTX = 0;
  private progressTZ = 0;

  /** Sıkışmışsa uzanma mesafesine eklenecek pay. */
  get reachBonus(): number {
    return this.stallTimer > 1.5 ? 1.2 : 0;
  }

  /**
   * `uniform` yalnız GÖRSELDİR (bkz. data/cosmetics.ts): hiçbir hız,
   * kapasite veya süre hesabı bu değeri okumaz — `setLevel` aşağıda
   * istatistikleri yalnız `level`'dan türetir.
   */
  constructor(role: StaffRole, index: number, level: number, uniform?: string) {
    super(
      createCharacter(STAFF_CHAR_ROLE[role], {
        variant: index,
        seed: (role.charCodeAt(0) * 977 + index * 131) | 0,
        level,
        uniform,
      }),
    );
    this.role = role;
    this.index = index;
    this.uid = `${role}#${index}`;
    this.stack = new CarryStack(this.char.carryAnchor);
    this.statusBadge = createStaffStatusBadge();
    this.setLevel(level);
    this.thinkTimer = Math.random() * 0.4;
  }

  setStatus(status: StaffStatus, dt: number): void {
    this.statusBadge.set(status, dt);
  }

  setLevel(level: number): void {
    this.level = level;
    switch (this.role) {
      case 'waiter':
        this.speed = waiterSpeed(level);
        this.capacity = waiterCapacity(level);
        break;
      case 'cashier':
        this.speed = cashierSpeed(level);
        this.capacity = 2;
        break;
      case 'barista':
        this.speed = baristaSpeed(level);
        this.capacity = baristaCapacity(level);
        break;
      case 'busser':
        this.speed = busserSpeed(level);
        this.capacity = busserCapacity(level);
        break;
    }
    if (this.carryCount > this.capacity) {
      this.carryCount = this.capacity;
      this.stack.set(this.carryItem, this.carryCount);
    }
  }

  /** Bir birim alma/bırakma süresi — rol bazlı. */
  get handInterval(): number {
    switch (this.role) {
      case 'waiter':
        return waiterHandInterval(this.level);
      case 'busser':
        return busserWorkTime(this.level);
      default:
        return waiterHandInterval(this.level);
    }
  }

  get isFull(): boolean {
    return this.carryCount >= this.capacity;
  }

  canTake(item: ItemId): boolean {
    if (this.isFull) return false;
    return this.carryItem === null || this.carryItem === item;
  }

  give(item: ItemId): boolean {
    if (!this.canTake(item)) return false;
    this.carryItem = item;
    this.carryCount++;
    this.stack.set(this.carryItem, this.carryCount);
    this.char.setCarryCount(this.carryCount);
    return true;
  }

  take(): ItemId | null {
    if (this.carryCount <= 0 || !this.carryItem) return null;
    const it = this.carryItem;
    this.carryCount--;
    if (this.carryCount <= 0) {
      this.carryItem = null;
      this.stack.clear();
    } else {
      this.stack.set(this.carryItem, this.carryCount);
    }
    this.char.setCarryCount(this.carryCount);
    return it;
  }

  /**
   * Elde taşınanı stoğa İADE ETMEDEN siler — yalnız SON ÇARE (kilitlenme
   * sigortası). Çağıran taraf ÖNCE gerçekten hiçbir teslim yeri kalmadığını
   * doğrulamalı (bkz. `World.ts` → updateBarista/updateWaiter/updateBusser):
   * personel tavanı (`bestConsumer`'ın `forStaff` parametresi) bir HEDEF
   * SEÇME kuralıdır, elde kalmış ürünü imha etme sebebi değildir.
   */
  dropAll(): void {
    this.carryCount = 0;
    this.carryItem = null;
    this.stack.clear();
    this.char.setCarryCount(0);
  }

  /** Görev hedeflerini bırak (şube değişimi / işten çıkarma). */
  clearJob(): void {
    if (this.source) this.source.clearReserve(this.uid);
    if (this.dest) this.dest.clearReserve(this.uid);
    this.source = null;
    this.dest = null;
    this.fetchItem = null;
    this.spillId = -1;
    this.job = 'rest';
  }

  /** Yürüme + animasyon. İş mantığı StaffManager'da.
   *  `animate` — kadraj dışındaki personelin iskeleti güncellenmez ve
   *  çizilmez (müşterilerdeki kuralın aynısı; sim aynen koşar). */
  step(dt: number, nav: import('../sim/Navigation').NavGrid, animate = true): void {
    this.advance(dt, nav, 0.5);

    // İlerleme bekçisi: hedef değiştiyse sıfırla, yaklaşamıyorsa say.
    if (this.job !== 'rest' && this.hasTarget) {
      if (Math.hypot(this.targetX - this.progressTX, this.targetZ - this.progressTZ) > 0.5) {
        this.progressTX = this.targetX;
        this.progressTZ = this.targetZ;
        this.progressBest = Infinity;
        this.progressTimer = 0;
      }
      const d = this.distanceToTarget;
      if (d < this.progressBest - 0.15) {
        this.progressBest = d;
        this.progressTimer = 0;
      } else {
        this.progressTimer += dt;
      }
    } else {
      this.progressBest = Infinity;
      this.progressTimer = 0;
    }

    /**
     * İşi var, yerinde sayıyor ve istasyonda değil → sıkışmış. İki ayrı
     * belirti aynı sayaca akar: (a) hız yok, (b) hız var ama hedefe
     * yaklaşmıyor (itiş savaşı).
     *
     * Not: "yolu bitmiş olsun" şartı KASITLI olarak yok. A* bazen hedefin
     * berisinde tek noktalık bir yol döndürüyor; varlık `hasTarget` true
     * kalarak yerinde donuyordu ve o şartla sayaç hiç çalışmıyordu.
     */
    if (this.job !== 'rest' && !this.atStation && (this.planarSpeed < 0.2 || this.progressTimer > 2.5)) {
      this.stallTimer += dt;
    } else {
      this.stallTimer = 0;
    }

    if (this.workingVisual && this.planarSpeed < 0.5) this.char.setState('work');
    else this.char.setState('idle');

    this.char.root.visible = animate;
    if (animate) {
      this.char.update(dt, this.planarSpeed, this.turnRate(dt));
      this.stack.update(dt, Math.min(1, this.planarSpeed / Math.max(1, this.speed)), this.planarSpeed);
    }
    this.syncTransform();
  }

  dispose(): void {
    this.statusBadge.dispose();
    this.stack.dispose();
    super.dispose();
  }
}
