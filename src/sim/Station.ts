import type { ItemId } from '../data/items';
import { tableServiceAngle } from '../data/seating';
import { cashierOrderTime } from '../data/staff';
import { ITEMS, isProduct, isSupply } from '../data/items';
import { STATION_BODY, type StationDef } from '../data/stations';
import {
  stationCapBonus,
  stationSpeedMult,
  stationUpgradeCost,
  STATION_CAP_GROWTH,
  STATION_SPEED_GROWTH,
  STATION_CAP_MAX,
  STATION_SPEED_MAX,
} from '../data/upgrades';
import { BALANCE } from '../data/balance';
import { TOILET_LAYOUT } from '../data/restrooms';
import { bus } from '../core/EventBus';
import { clamp01 } from '../core/MathUtils';

export interface StationSave {
  s: number; // speedLevel
  c: number; // capLevel
  o: number; // hazır çıkış adedi
  p: number; // progress
  m: number; // tezgâhta biriken nakit yığını (adet)
  mv?: number; // yığının toplam değeri (₺) — yoksa yığın taşınmaz
  t: number; // ömür boyu üretim
  d?: number; // masadaki bulaşık
  k?: number; // tuvalet kirliliği
  cl?: number; // masa tamamen hazır olduğunda ödenecek temizlik birimi
  u?: Record<string, number>; // tuvaletteki sarf stoğu
  ct?: ItemId[]; // teslim bankosunun içeriği
}

/**
 * Masada oturan misafirin istasyona gösterdiği yüz.
 * Customer bu arayüzü yapısal olarak karşılar; böylece Station ↔ Customer
 * arasında gerçek bir import bağı kurulmaz.
 */
export interface TableGuest {
  needsItem(item: ItemId): boolean;
  receiveItem(item: ItemId): boolean;
}

const _local = { x: 0, z: 0 };

/**
 * Tek sınıf, yedi davranış: makine, sarf deposu, teslim bankosu, sipariş
 * tezgâhı, masa, kova, tuvalet.
 *
 * ZİNCİR YOK: makineler girdisiz üretir. Eskiden burada bir `input` tamponu
 * ve `hasAllInputs()` vardı; "su al → semavere koy → çayı al" üç adımlı
 * hattı oyunun akışını öldürdüğü için kaldırıldı.
 */
export class StationEntity {
  readonly def: StationDef;
  readonly id: string;
  readonly x: number;
  readonly z: number;

  speedLevel = 0;
  capLevel = 0;

  /** machine/supply → biriken çıkış · pickup → bankodaki adet */
  output = 0;
  /** pickup → bankoda duran ürünler (output ile senkron tutulur) */
  readonly contents: ItemId[] = [];
  /** 0..1 mevcut çevrim */
  progress = 0;
  working = false;
  broken = false;
  breakTimer = 0;

  /** counter → toplanmamış nakit yığını */
  cash = 0;
  cashValue = 0;
  /** counter → sipariş alma sayacı */
  orderTimer = 0;
  /** counter → sipariş sırası (Customer[]; döngüsel bağımlılık olmasın diye gevşek) */
  readonly queue: unknown[] = [];

  /** Baristanın verdiği hız çarpanı (World günceller) */
  baristaBoost = 1;
  /** v5 — oyuncu makinenin başında mı ("el ver" bonusu; World her tik yazar) */
  playerNear = false;
  /** Tezgâhta duran kasiyer var mı */
  hasCashier = false;

  producedTotal = 0;
  locked = true;

  /* ---- masa ---- */
  readonly seatedGuests: TableGuest[] = [];
  /** Toplanmayı bekleyen bulaşık. >0 ise yeni müşteri oturamaz. */
  dishes = 0;
  readonly seatTaken: boolean[] = [];
  /** Masada duran servis (görsel) */
  servedVisual = 0;
  /** Son kabul edilen masa servisi; World ödeme ve sayaçları buradan işler. */
  private lastServedGuest: TableGuest | null = null;
  /** Oyuncu son parlatmayı bitirince tek seferde ödenecek iş miktarı. */
  cleanValue = 0;
  /** Silme yayınının başladığı kir seviyesi; ilerleme 0'dan 1'e doğru okunur. */
  cleanStartSoil = 0;
  /** Oyuncuya ilk müdahale hakkı vermek için masanın kirli kaldığı süre. */
  dirtyAge = 0;

  /* ---- tuvalet ---- */
  soil = 0;
  occupied = false;
  readonly supply = new Map<ItemId, number>();

  /** Bir başka personel bu istasyonu hedeflemiş mi (çakışma önleme) */
  reservedBy: string | null = null;
  reserveTimer = 0;

  constructor(def: StationDef) {
    this.def = def;
    this.id = def.id;
    this.x = def.x;
    this.z = def.z;
    if (def.kind === 'table') {
      for (let i = 0; i < this.seats; i++) this.seatTaken.push(false);
    }
    if (def.supplies) {
      for (const s of def.supplies) this.supply.set(s.item, s.cap);
    }
  }

  /* ================= masa ================= */

  get seats(): number {
    // Görsel ve dolaşım düzeni en fazla dört sandalye destekler.
    return this.seatsAt(this.capLevel);
  }

  seatsAt(level: number): number {
    return (this.def.seats ?? 0) + Math.min(Math.max(0, level), this.capMax);
  }

  /** Masa yeni müşteri alabilir mi? Kirliyse ALMAZ. */
  get canSeat(): boolean {
    return this.def.kind === 'table' && !this.locked && this.dishes <= 0 && this.soil <= 0.02 && this.freeSeat >= 0;
  }

  get freeSeat(): number {
    if (this.def.kind !== 'table') return -1;
    const n = this.seats;
    for (let i = 0; i < n; i++) {
      if (!this.seatTaken[i]) return i;
    }
    return -1;
  }

  takeSeat(index: number): void {
    while (this.seatTaken.length < Math.max(this.seats, index + 1)) this.seatTaken.push(false);
    this.seatTaken[index] = true;
  }

  releaseSeat(index: number): void {
    while (this.seatTaken.length < this.seats) this.seatTaken.push(false);
    if (index >= 0 && index < this.seatTaken.length) this.seatTaken[index] = false;
  }

  get isDirty(): boolean {
    return this.dishes > 0 || this.soil > 0.02;
  }

  takeDish(): boolean {
    if (this.dishes <= 0) return false;
    this.dishes--;
    return true;
  }

  guestNeeds(item: ItemId): boolean {
    for (const g of this.seatedGuests) if (g.needsItem(item)) return true;
    return false;
  }

  serveGuest(item: ItemId): TableGuest | null {
    for (const g of this.seatedGuests) {
      if (g.receiveItem(item)) {
        return g;
      }
    }
    return null;
  }

  takeLastServedGuest(): TableGuest | null {
    const g = this.lastServedGuest;
    this.lastServedGuest = null;
    return g;
  }

  /* ================= teslim bankosu ================= */

  /** Bankoda bu üründen var mı? */
  hasItem(item: ItemId): boolean {
    return this.contents.includes(item);
  }

  /** Bankodan BELİRLİ bir ürünü al. */
  takeItem(item: ItemId): boolean {
    const i = this.contents.indexOf(item);
    if (i < 0) return false;
    this.contents.splice(i, 1);
    this.output = this.contents.length;
    return true;
  }

  /** Bankodaki ürün çeşitleri (görsel ve UI için). */
  distinctItems(out: ItemId[]): ItemId[] {
    out.length = 0;
    for (const c of this.contents) if (!out.includes(c)) out.push(c);
    return out;
  }

  /* ================= tuvalet ================= */

  get toiletSupplied(): boolean {
    return (this.def.supplies ?? []).every(s => this.supplyOf(s.item) >= BALANCE.toilet.supplyPerUse);
  }

  get canUseToilet(): boolean {
    return this.def.kind === 'toilet' && !this.locked && !this.occupied &&
      this.soil < BALANCE.toilet.maxSoilForUse && this.toiletSupplied;
  }

  toiletSeatPoint(out: { x: number; y: number; z: number }): void {
    this.rotate(TOILET_LAYOUT.seat.x, TOILET_LAYOUT.seat.z, out);
    out.y = TOILET_LAYOUT.seat.y;
  }

  supplyOf(item: ItemId): number {
    return this.supply.get(item) ?? 0;
  }

  supplyCap(item: ItemId): number { return this.supplyCapAt(item, this.capLevel); }

  supplyCapAt(item: ItemId, level: number): number {
    const s = this.def.supplies?.find((x) => x.item === item);
    return s ? s.cap + Math.min(Math.max(0, level), this.capMax) : 0;
  }

  neediestSupply(): ItemId | null {
    if (!this.def.supplies) return null;
    let best: ItemId | null = null;
    let bestRatio = 0.999;
    for (const s of this.def.supplies) {
      const cap = this.supplyCap(s.item);
      if (cap <= 0) continue;
      const ratio = this.supplyOf(s.item) / cap;
      if (ratio < bestRatio) {
        bestRatio = ratio;
        best = s.item;
      }
    }
    return best;
  }

  /** Tuvalette GERÇEKTEN tükenmiş sarf var mı — itibar cezasının kaynağı. */
  get hasEmptySupply(): boolean {
    if (!this.def.supplies) return false;
    for (const s of this.def.supplies) {
      if (this.supplyOf(s.item) < 0.05) return true;
    }
    return false;
  }

  /** Sarf eksikliği 0..1 (en boş kalemin oranı üzerinden). */
  get supplyShortfall(): number {
    if (!this.def.supplies) return 0;
    let worst = 0;
    for (const s of this.def.supplies) {
      const cap = this.supplyCap(s.item);
      if (cap <= 0) continue;
      worst = Math.max(worst, 1 - clamp01(this.supplyOf(s.item) / cap));
    }
    return worst;
  }

  /**
   * Bir kullanımın sarf tüketimi. Tükendiyse true döner (ceza yazılır).
   *
   * EŞİK TÜKETİM MİKTARIYLA HİZALI. Eski kural "have < 1" idi ama kullanım
   * başına 0,5 tüketiliyor ve depo tam sayı dolduruluyordu: stok
   * ...1,0 → 0,5 dizisiyle 0,5'te KİLİTLENİYOR, 0,5 hiçbir zaman 1'in
   * üstüne çıkmadığı için sonraki HER kullanım "peçete bitti" cezası
   * yazıyordu — depoda sarf görünürken itibar eriyordu. "Gerçekten bitti"
   * tanımı zaten başka yerde 0,05 (bkz. hasEmptySupply).
   */
  consumeSupplies(amount: number): boolean {
    let ranOut = false;
    if (!this.def.supplies) return false;
    for (const s of this.def.supplies) {
      const have = this.supplyOf(s.item);
      if (have < amount) {
        ranOut = true;
        continue;
      }
      this.supply.set(s.item, Math.max(0, have - amount));
    }
    return ranOut;
  }

  /* ================= kapasite / hız ================= */

  get outputCap(): number {
    return this.outputCapAt(this.capLevel);
  }

  outputCapAt(level: number): number {
    return this.def.outputCap + stationCapBonus(Math.min(Math.max(0, level), this.capMax));
  }

  get cycleTime(): number { return this.cycleTimeAt(this.speedLevel); }

  cycleTimeAt(level: number): number {
    const t = this.def.time * stationSpeedMult(level) * this.prestigeSpeed;
    return Math.max(0.12, t / this.baristaBoost);
  }

  /** Checkout uses the same station/prestige reduction displayed by its upgrade card. */
  counterOrderTime(actor: 'player' | 'cashier', cashierLevel = 0, speedLevel = this.speedLevel): number {
    const base = actor === 'player' ? this.def.time * BALANCE.orders.playerOrderMult : cashierOrderTime(cashierLevel);
    return Math.max(0.12, base * stationSpeedMult(speedLevel) * this.prestigeSpeed);
  }

  /** Kalıcı prestij hız çarpanı — World her kurulumda yazar. */
  prestigeSpeed = 1;

  get speedUpgradeCost(): number {
    if (this.def.speedCost === undefined) return 0;
    const cost = stationUpgradeCost(this.def.speedCost, this.speedLevel, STATION_SPEED_GROWTH);
    // Second milkshake speed step only. Growth stays 1.52; the first step is already ~40 min.
    if (this.def.id === 's_shake' && this.speedLevel === 1 && this.def.time > 0) {
      const cap = Math.round(ITEMS.milkshake.price / this.def.time * 60 * 40);
      return Math.min(cost, cap);
    }
    return cost;
  }

  get capUpgradeCost(): number {
    return this.def.capCost === undefined
      ? 0
      : stationUpgradeCost(this.def.capCost, this.capLevel, STATION_CAP_GROWTH);
  }

  get canUpgradeSpeed(): boolean {
    return this.def.speedCost !== undefined && this.speedLevel < STATION_SPEED_MAX;
  }

  /**
   * Kapasite yükseltmesinin tavanı.
   *
   * MASALARDA 2 İLE SINIRLI, iki ayrı sebeple:
   *
   *  1. EKONOMİ. Sandalye zaten fazlasıyla bol: son yerleşimde 74 koltuk
   *     varken aynı anda mekânda olabilecek müşteri 16'dır. 21 masanın 8
   *     kademe kapasitesi ₺3,94 MİLYARLIK bir harcama kalemi yaratıyordu
   *     ve karşılığında SIFIR gelir getiriyordu — oyunun en büyük tuzağı.
   *  2. GEOMETRİ. Sandalye halkasının yarıçapı sabittir; 12 misafir aynı
   *     halkaya dizilince gövdeler iç içe geçiyor, kenardaki masalarda
   *     (VIP Loca) sandalyeler duvarın İÇİNE düşüyor ve o koltuklara
   *     hiçbir müşteri ulaşamıyordu. Yerleşim doğrulaması bunu yakaladı.
   */
  get capMax(): number {
    return this.def.kind === 'table' ? Math.max(0, 4 - (this.def.seats ?? 0)) : STATION_CAP_MAX;
  }

  get canUpgradeCap(): boolean {
    return this.def.capCost !== undefined && this.capLevel < this.capMax;
  }

  /* ================= yaklaşma noktaları ================= *
   *
   * Yerel uzayda +z MÜŞTERİ tarafı, −z PERSONEL tarafıdır; ikisi de
   * `def.rot` ile döndürülür. Böylece tezgâh duvara paralel olmak zorunda
   * kalmaz — plan değiştiğinde kodu değil, veriyi değiştirmek yeter.
   */

  private rotate(lx: number, lz: number, out: { x: number; z: number }): void {
    const a = (this.def.rot * Math.PI) / 180;
    const s = Math.sin(a);
    const c = Math.cos(a);
    out.x = this.x + lx * c + lz * s;
    out.z = this.z - lx * s + lz * c;
  }

  /**
   * Verilen dünya noktası istasyonun hangi yüzünde? +1 = ÖN (müşteri
   * tarafı, `frontPoint` yönü), −1 = ARKA (personel tarafı). Teslim
   * bankosunda iki yüz iki ayrı fiildir: önden ALINIR, arkadan BIRAKILIR —
   * aynı noktada hem al hem bırak mümkün olsaydı niyet okunamazdı.
   */
  sideOf(x: number, z: number): number {
    const a = (this.def.rot * Math.PI) / 180;
    const s = Math.sin(a);
    const c = Math.cos(a);
    const lz = (x - this.x) * s + (z - this.z) * c;
    return lz >= 0 ? 1 : -1;
  }

  /** Müşteri tarafı. */
  frontPoint(out: { x: number; z: number }): void {
    const k = this.def.kind;
    if (k === 'toilet') {
      this.rotate(TOILET_LAYOUT.approach.x, TOILET_LAYOUT.approach.z, out);
      return;
    }
    const dz = k === 'counter' ? 1.3 : k === 'pickup' ? 1.65 : 2.15;
    this.rotate(0, dz, out);
  }

  /** Closest exposed edge for player service and clearing; routes may keep a fixed staff point. */
  playerPoint(x: number, z: number, out: { x: number; z: number }, clearance = 0.4): void {
    const body = STATION_BODY[this.def.visual] ?? { x: 0.72, z: 0.72 };
    const a = (this.def.rot * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // Convert world (x, z) to station local coordinates (lx, lz)
    const lx = (x - this.x) * c - (z - this.z) * s;
    const lz = (x - this.x) * s + (z - this.z) * c;

    const hx = body.x + clearance;
    const hz = body.z + clearance;
    let px = Math.max(-hx, Math.min(hx, lx));
    let pz: number;

    const k = this.def.kind;
    if (k === 'machine' || k === 'supply') {
      // Machine/supply front is at +z; if player is hugging the counter front, snap directly
      pz = lz <= hz ? Math.max(body.z, lz) : hz;
    } else if (k === 'counter') {
      // Cashier is behind counter (-z), customer in front (+z)
      pz = lz <= 0
        ? (lz >= -hz ? Math.min(-body.z, lz) : -hz)
        : (lz <= hz ? Math.max(body.z, lz) : hz);
    } else if (k === 'pickup') {
      // Drop-off is behind (-z), pickup is front (+z)
      pz = lz <= 0
        ? (lz >= -hz ? Math.min(-body.z, lz) : -hz)
        : (lz <= hz ? Math.max(body.z, lz) : hz);
    } else {
      // Tables, bins, toilets: 360 degree reach
      if (Math.abs(lx) < hx && Math.abs(lz) < hz) {
        px = lx;
        pz = lz;
      } else {
        pz = Math.max(-hz, Math.min(hz, lz));
      }
    }

    // Convert local target (px, pz) back to world coordinates
    out.x = this.x + px * c + pz * s;
    out.z = this.z - px * s + pz * c;
  }

  /** Personel/oyuncu tarafı. */
  serviceAccess: { x: number; z: number } | null = null;
  servicePoint(out: { x: number; z: number }): void {
    if (this.serviceAccess) { out.x = this.serviceAccess.x; out.z = this.serviceAccess.z; return; }
    switch (this.def.kind) {
      case 'pickup':
      case 'counter':
        // Barın arkası
        this.rotate(0, -1.7, out);
        break;
      case 'table':
        // Service stands between physical chairs, never at a chair's center.
        { const a = tableServiceAngle(this.def.visual, this.seats);
          this.rotate(Math.sin(a) * 1.6, Math.cos(a) * 1.6, out); }
        break;
      case 'bin':
        /**
         * Kovaya ÖN yüzünden yaklaşılır (kapağın olduğu taraf) — kova
         * artık salona bakacak şekilde döndürüldüğü için arka yüz duvara
         * gelir; eski -1,6 orada servis noktasını duvarın İÇİNE atıyordu
         * (doğrulayıcı: "SERVİS NOKTASI ERİŞİLEMEZ").
         */
        this.rotate(0, 1.6, out);
        break;
      default:
        this.rotate(0, 2.15, out);
        break;
    }
  }

  /**
   * Sipariş sırasının i. yeri (0 = tezgâha en yakın).
   * Sıra SALONA doğru uzanır: müşteri kapıdan gelir, tezgâha bakar,
   * sipariş verince masasına döner.
   *
   * Sıra MEKÂNIN İÇİNDE KALMALI: uzunluk sınırsız hesaplanınca 17. kişinin
   * yeri z=23'e, yani binanın dışına düşüyordu; oraya yol bulunamadığı için
   * kimse ilerleyemiyor ve tüm kuyruk kilitleniyordu. Belli bir sıradan
   * sonra herkes hattın sonunda yan yana bekler.
   */
  /**
   * Sıra KATLANIR — düz uzamaz.
   *
   * Eski hâli her müşteriyi 1,3 birim daha geriye koyuyordu: 6. slot
   * tezgâhın 10 birim arkasına, yani ön koridoru aşıp salonun içine
   * düşüyordu. Yerleşim doğrulaması bunu yakaladı — İkinci Tezgâh'ın 6. ve
   * 7. slotları Masa 7'nin GÖVDESİNİN içindeydi; oraya gönderilen müşteri
   * her karede dışarı itilip titriyordu.
   *
   * Artık sıra üçerli sütunlar hâlinde katlanır (0, +1, −1 yana): en derin
   * nokta 4,8 birim, yani ön koridor bandının içinde kalır. Gerçek bir
   * kafede de sıra böyle durur.
   */
  queueSlot(i: number, out: { x: number; z: number }): void {
    /**
     * Derinlik İKİ ile sınırlıdır çünkü ön koridor bandı (frontAisle) o
     * kadardır: bar z = −1,0, ilk slot z = 1,2, ikinci slot z = 2,5 ve
     * bandın sonu z = 2,8. Üçüncü sıra z = 3,8'e düşerdi — yani koridoru
     * aşıp salon masalarının üstüne. Doğrulayıcı bunu da yakaladı.
     *
     * Sıra bu yüzden DERİNE değil YANA büyür; iki tezgâh 7,2 birim
     * aralıklı olduğu için ±1,6 birimlik yayılma çakışmaya yol açmaz.
     */
    const PER_COL = 2;
    const col = Math.floor(i / PER_COL);
    const depth = i % PER_COL;
    // Sütunlar sırayla sağa ve sola açılır: 0, +1,6, −1,6, +3,2…
    const lateral = col === 0 ? 0 : (col % 2 === 1 ? 1 : -1) * Math.ceil(col / 2) * 1.6;
    // The front pair stands close to the counter. Overflow stays behind
    // the counter wings so it cannot occupy the adjacent hiring square.
    const front = col === 0 ? 1.3 : 2.2;
    this.rotate(lateral, front + depth * BALANCE.customers.queueSpacing, out);
  }

  /* ================= envanter ================= */

  canAccept(item: ItemId): boolean {
    if (this.locked) return false;
    switch (this.def.kind) {
      case 'bin':
        /**
         * Kova atığı HER ZAMAN, ürünü ve sarfı da kabul eder — bir şey
         * atmak "elimi boşaltamıyorum" çıkmazının son çaresidir. Fark
         * davranışta: atık ve sarf anlık atılır (nearestAccepting), ürün
         * ise yalnız niyet kapılı boşaltma adımından gelir (World, unload
         * adımı). Sarf kovaya atılabilmelidir; iki tuvalet de doluyken
         * eldeki peçete başka hiçbir yere bırakılamıyor ve el 3/3 doluysa
         * oyunun ana döngüsü tamamen kilitleniyordu.
         */
        return ITEMS[item].tier === 'waste' || isProduct(item) || isSupply(item);
      case 'pickup':
        /**
         * v5 — RAF ÜRÜNE ÖZELDİR: `def.item` doluysa yalnız o ürün konur.
         * (Eski ortak banko davranışı, item'sız tanım için yedek olarak
         * durur; üretimde tüm raflar item'lıdır.)
         */
        if (!isProduct(item) || this.contents.length >= this.outputCap) return false;
        return !this.def.item || this.def.item === item;
      case 'toilet': {
        const cap = this.supplyCap(item);
        return cap > 0 && this.supplyOf(item) < cap - 0.01;
      }
      /** Masa yalnız orada oturan bir müşterinin doğru siparişini kabul eder. */
      case 'table':
        return this.guestNeeds(item);
      default:
        return false;
    }
  }

  accept(item: ItemId): boolean {
    if (!this.canAccept(item)) return false;
    switch (this.def.kind) {
      case 'bin':
        // Kova dipsizdir; sadece görsel doluluk için sayaç tutar.
        this.output = Math.min(this.output + 1, 12);
        this.producedTotal++;
        return true;
      case 'pickup':
        this.contents.push(item);
        this.output = this.contents.length;
        return true;
      case 'toilet':
        this.supply.set(item, Math.min(this.supplyCap(item), this.supplyOf(item) + 1));
        return true;
      case 'table':
        this.lastServedGuest = this.serveGuest(item);
        return this.lastServedGuest !== null;
      default:
        return false;
    }
  }

  /** Çıkıştan bir birim al (makine, sarf deposu ve banko). */
  takeOutput(): ItemId | null {
    if (this.locked || this.output <= 0) return null;
    if (this.def.kind === 'pickup') {
      const it = this.contents.shift();
      if (!it) return null;
      this.output = this.contents.length;
      return it;
    }
    const it = this.def.item;
    if (!it) return null;
    this.output--;
    return it;
  }

  /* ================= güncelleme ================= */

  update(dt: number): void {
    if (this.reserveTimer > 0) {
      this.reserveTimer -= dt;
      if (this.reserveTimer <= 0) this.reservedBy = null;
    }
    if (this.servedVisual > this.seatedGuests.length) this.servedVisual = this.seatedGuests.length;

    if (this.locked || this.broken) {
      this.working = false;
      return;
    }

    const kind = this.def.kind;
    if (kind === 'pickup' || kind === 'counter' || kind === 'bin') {
      this.working = false;
      return;
    }

    if (kind === 'table') {
      this.working = this.seatedGuests.length > 0;
      return;
    }

    if (kind === 'toilet') {
      this.working = this.occupied;
      return;
    }

    // machine · supply — girdisiz üretim
    if (this.output >= this.outputCap) {
      this.working = false;
      return;
    }

    this.working = true;
    /**
     * v5 — "EL VER" BONUSU: oyuncu makinenin başında duruyorsa çevrim
     * 2× hızlanır (World her tik `playerNear` bayrağını yazar). Barista
     * çarpanıyla TOPLANMAZ; büyük olan geçerlidir — oyuncunun istasyon
     * başında durması her evrede anlamlı kalsın, otomasyon onu geçmesin.
     */
    // cycleTime baristayı zaten bölmüş durumda; max(2, barista)'yı elde
    // etmek için oyuncu varken eksik kalan payı burada tamamlarız.
    const near = this.playerNear ? Math.max(2 / this.baristaBoost, 1) : 1;
    this.progress += (dt * near) / this.cycleTime;
    if (this.progress >= 1) {
      this.progress -= 1;
      this.output++;
      this.producedTotal++;
      if (this.def.item) bus.emit('item:produced', { item: this.def.item, stationId: this.id });
    }
  }

  /** Saniyede kaç adet hazırlayabilir (offline ve UI tahmini için). */
  theoreticalRate(): number {
    const k = this.def.kind;
    if (k !== 'machine' && k !== 'supply') return 0;
    return 1 / this.cycleTime;
  }

  get progress01(): number {
    return clamp01(this.progress);
  }

  reserve(who: string): void {
    this.reservedBy = who;
    this.reserveTimer = BALANCE.staff.reserveTimeout;
  }

  isReservedByOther(who: string): boolean {
    return this.reservedBy !== null && this.reservedBy !== who;
  }

  clearReserve(who: string): void {
    if (this.reservedBy === who) {
      this.reservedBy = null;
      this.reserveTimer = 0;
    }
  }

  /* ================= kayıt ================= */

  save(): StationSave {
    const u: Record<string, number> = {};
    for (const [k2, v] of this.supply) u[k2] = v;
    return {
      s: this.speedLevel,
      c: this.capLevel,
      o: this.output,
      p: this.progress,
      m: this.cash,
      mv: this.cashValue,
      t: this.producedTotal,
      d: this.dishes,
      k: this.soil,
      cl: this.cleanValue,
      u,
      ct: this.def.kind === 'pickup' ? [...this.contents] : undefined,
    };
  }

  load(s: Partial<StationSave> | undefined): void {
    if (!s) return;
    this.speedLevel = s.s ?? 0;
    this.capLevel = s.c ?? 0;
    this.progress = clamp01(s.p ?? 0);
    this.cash = s.m ?? 0;
    /**
     * Yığının DEĞERİ de kayda girer; girmezse toplama anında birim değer
     * 0/N = 0 hesaplanıyor, oyuncu yığın başına 0₺ alıyordu (coin efekti
     * yine oynuyordu). `mv` alanı olmayan eski kayıtta değeri bilinmeyen
     * yığını taşımak yerine yığını da sıfırla — görsel ile değer tutarlı.
     */
    this.cashValue = Math.max(0, s.mv ?? 0);
    if (this.cashValue <= 0) this.cash = 0;
    this.producedTotal = s.t ?? 0;
    this.dishes = Math.max(0, Math.min(s.d ?? 0, BALANCE.dirt.maxDishesPerTable));
    this.soil = clamp01(s.k ?? 0);
    this.cleanValue = Math.max(0, s.cl ?? 0);
    this.cleanStartSoil = this.soil;

    this.contents.length = 0;
    if (this.def.kind === 'pickup' && Array.isArray(s.ct)) {
      for (const it of s.ct.slice(0, this.outputCap)) {
        if (ITEMS[it]) this.contents.push(it);
      }
      this.output = this.contents.length;
    } else if (this.def.kind === 'pickup') {
      // `ct` alanı olmayan eski v7 kaydı: output'u içerikle senkron tut,
      // yoksa raf var olmayan stok bildirir ve hayalet ürün "çalınır".
      this.output = 0;
    } else if (this.def.kind === 'vacuum') {
      /**
       * SÜPÜRGE İSTİSNASI. `outputCap` 0 olduğu için `min(s.o, cap)` her
       * yüklemede 0 veriyordu: ikinci oturumdan itibaren dolaptaki süpürge
       * görseli kalıcı olarak kayboluyor, mekanik keşfedilemez hâle
       * geliyordu. Elde taşıma kayda girmediği için süpürge her açılışta
       * dolabına döner.
       */
      this.output = 1;
    } else {
      this.output = Math.min(s.o ?? 0, this.outputCap);
    }

    this.seatTaken.length = 0;
    for (let i = 0; i < this.seats; i++) this.seatTaken.push(false);
    this.seatedGuests.length = 0;
    this.servedVisual = 0;
    this.occupied = false;

    if (this.def.supplies) {
      for (const sup of this.def.supplies) {
        const saved = s.u?.[sup.item];
        this.supply.set(
          sup.item,
          saved === undefined ? this.supplyCap(sup.item) : Math.min(saved, this.supplyCap(sup.item)),
        );
      }
    }
    this.working = this.progress > 0;
    void _local;
  }
}
