import { clamp01 } from '../core/MathUtils';

/**
 * TRAFİK KİRİ — zeminin kendi kullanım izi.
 *
 * Bu katman `SpillField`'ın (sayılı, yuvarlak lekeler) yerini ALMAZ, altına
 * serilir. Fark şu: leke bir OLAYDIR (müşteri kalktı, bardak devrildi), bu
 * ise bir SÜREÇTİR — kafenin çok yürünen yerleri zamanla kararır.
 *
 * NEDEN BÖYLE: türün alışılmış çözümü zemini baştan komple kirli doğurup
 * oyuncuya sildirmektir. O, temizliği bir kere yapılıp bitirilen bir göreve
 * çevirir. Burada kir kafenin KENDİ İŞLEYİŞİNDEN doğar: kapı→bar hattı,
 * sipariş kuyruğunun durduğu yer ve masa çevreleri en çok basılan yerlerdir
 * ve ilk onlar kararır. Oyuncu zemine bakınca "buradan çok geçiliyor"
 * bilgisini okur; temizlik de mekânın nasıl kullanıldığını öğretir.
 *
 * Ucuzluk şart: her karede binlerce hücre gezilemez. Bu yüzden
 *  · toplam kirlilik çalışan bir toplamda tutulur (`sum`), taranmaz;
 *  · doku yalnız `dirty` işaretliyken yüklenir;
 *  · trafik yalnız aktörün BASTIĞI hücreye yazılır (komşulara yayılmaz —
 *    hücre zaten 0,6 birim, bir ayak izinden büyük).
 */

/** Hücre kenarı (birim). 0,6 → 18×39 mekânda 30×66 = 1980 hücre. */
export const GRIME_CELL = 0.6;

/** Bir hücrenin taşıyabileceği en yüksek kir. */
const MAX = 255;

/**
 * Yerçekimiyle çöken tozun ULAŞABİLECEĞİ TAVAN.
 *
 * Trafiksiz köşeler de hafifçe tozlanmalı (mekân "yeni açılmış" gibi
 * durmasın) ama asla ana yollar kadar kararmamalı — yoksa iz okunmaz ve
 * kir "her yer eşit pis" bilgisine düşer. Trafik bu tavanın üstüne çıkar.
 */
const SETTLE_CAP = 70;

export interface GrimeSave {
  /** Hücre kenarı — yükleme sırasında ızgara değiştiyse kayıt atılır. */
  c: number;
  w: number;
  h: number;
  /** Base64'lenmiş hücre dizisi. */
  d: string;
}

export class GrimeField {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  /**
   * Hücre kirliliği 0..255 — ONDALIKLI olmak ZORUNDA.
   *
   * Önce `Uint8Array` idi ve sessizce bozuktu: trafik kare başına
   * `traffic * dt` = 40/60 ≈ 0,67 ekler, tam sayı diziye yazınca 0'a
   * kırpılır. Sonuç: hücreler sonsuza dek 0 kalıyor ama çalışan toplam
   * (`sum`) büyüyordu — kaplama %19,9 okunurken ızgaranın 1980 hücresinin
   * hepsi sıfırdı, yani hijyen düşüyor ama zeminde hiçbir şey görünmüyordu.
   * Doku baytları yalnız ÇİZİM sırasında üretilir (bkz. GrimeView).
   */
  readonly data: Float32Array;
  readonly x0: number;
  readonly z0: number;

  /** Doku yeniden yüklenmeli mi (görsel katman okur ve sıfırlar). */
  dirty = true;

  /** Çalışan toplam — `coverage` bunu kullanır, dizi taranmaz. */
  private sum = 0;
  /** `SETTLE_CAP` üstündeki ağır kir toplamı — `heavyCoverage` O(1) çalışır. */
  private heavySum = 0;
  private saveDirty = true;
  private cachedSave: GrimeSave | null = null;
  private readonly saveBytes: Uint8Array;

  /** Yürünebilirlik sınayıcısı — World bağlar. Duvar/tezgâh altı kirlenmez. */
  walkable: ((x: number, z: number) => boolean) | null = null;

  /** Yürünemez hücreler bir kez işaretlenir; her karede sorgu yapılmaz. */
  private blocked: Uint8Array;
  private maskBuilt = false;

  constructor(bounds: { x0: number; z0: number; x1: number; z1: number }, cell = GRIME_CELL) {
    this.cell = cell;
    this.x0 = bounds.x0;
    this.z0 = bounds.z0;
    this.cols = Math.max(1, Math.ceil((bounds.x1 - bounds.x0) / cell));
    this.rows = Math.max(1, Math.ceil((bounds.z1 - bounds.z0) / cell));
    const len = this.cols * this.rows;
    this.data = new Float32Array(len);
    this.blocked = new Uint8Array(len);
    this.saveBytes = new Uint8Array(len);
  }

  /** Hücre merkezinin dünya koordinatı. */
  cellX(c: number): number {
    return this.x0 + (c + 0.5) * this.cell;
  }

  cellZ(r: number): number {
    return this.z0 + (r + 0.5) * this.cell;
  }

  private index(x: number, z: number): number {
    const c = Math.floor((x - this.x0) / this.cell);
    const r = Math.floor((z - this.z0) / this.cell);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  /**
   * Yürünemez hücreleri bir kez tarar. `rebuildNav` sonrası çağrılır:
   * bölge açılınca yeni tezgâh gelir, altındaki kir artık erişilemez
   * olurdu — o hücreler temizlenip kilitlenir.
   */
  rebuildMask(): void {
    const ok = this.walkable;
    if (!ok) return;
    this.freeCells = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        const free = ok(this.cellX(c), this.cellZ(r));
        this.blocked[i] = free ? 0 : 1;
        if (!free && this.data[i] > 0) {
          const v = this.data[i];
          this.sum -= v;
          if (v > SETTLE_CAP) this.heavySum = Math.max(0, this.heavySum - (v - SETTLE_CAP));
          this.data[i] = 0;
          this.dirty = true;
          this.saveDirty = true;
        }
      }
    }
    this.maskBuilt = true;
  }

  /** Bir aktörün bastığı hücreye kir ekler. */
  addTraffic(x: number, z: number, amount: number): void {
    const i = this.index(x, z);
    if (i < 0 || this.blocked[i] === 1) return;
    const v = this.data[i];
    const nv = Math.min(MAX, v + amount);
    if (nv === v) return;
    this.sum += nv - v;
    if (nv > SETTLE_CAP) {
      this.heavySum += nv - Math.max(SETTLE_CAP, v);
    }
    this.data[i] = nv;
    if ((nv | 0) !== (v | 0)) this.dirty = true;
    this.saveDirty = true;
  }

  /**
   * ÇÖKEN TOZ. Tüm yürünebilir hücreleri `SETTLE_CAP`'e kadar yavaşça
   * karartır. Her karede 1980 hücre gezmemek için ızgara `stride` parçaya
   * bölünür ve her çağrıda yalnız bir dilim işlenir.
   */
  private settlePhase = 0;
  settle(dt: number, rate: number): void {
    if (!this.maskBuilt) return;
    const STRIDE = 8;
    const add = rate * dt * STRIDE;
    if (add <= 0) return;
    this.settlePhase = (this.settlePhase + 1) % STRIDE;
    let byteChanged = false;
    let changed = false;
    for (let i = this.settlePhase; i < this.data.length; i += STRIDE) {
      if (this.blocked[i] === 1) continue;
      const v = this.data[i];
      if (v >= SETTLE_CAP) continue;
      const nv = Math.min(SETTLE_CAP, v + add);
      if (nv !== v) {
        this.sum += nv - v;
        this.data[i] = nv;
        changed = true;
        if ((nv | 0) !== (v | 0)) byteChanged = true;
      }
    }
    if (byteChanged) this.dirty = true;
    if (changed) this.saveDirty = true;
  }

  /**
   * FIRÇA. Bir dünya dairesindeki hücreleri siler. Dönen değer temizlenen
   * kir MİKTARIDIR (hücre sayısı değil) — ödül ve hijyen bunu kullanır.
   */
  cleanAt(wx: number, wz: number, radius: number, strength: number): number {
    const c0 = Math.max(0, Math.floor((wx - radius - this.x0) / this.cell));
    const c1 = Math.min(this.cols - 1, Math.ceil((wx + radius - this.x0) / this.cell));
    const r0 = Math.max(0, Math.floor((wz - radius - this.z0) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.ceil((wz + radius - this.z0) / this.cell));
    const rr = radius * radius;
    let removed = 0;
    let heavyRemoved = 0;
    let byteChanged = false;
    for (let r = r0; r <= r1; r++) {
      const dz = this.cellZ(r) - wz;
      for (let c = c0; c <= c1; c++) {
        const i = r * this.cols + c;
        const v = this.data[i];
        if (v === 0) continue;
        const dx = this.cellX(c) - wx;
        if (dx * dx + dz * dz > rr) continue;
        const nv = Math.max(0, v - strength);
        removed += v - nv;
        if (v > SETTLE_CAP) {
          heavyRemoved += v - Math.max(SETTLE_CAP, nv);
        }
        if ((nv | 0) !== (v | 0)) byteChanged = true;
        this.data[i] = nv;
      }
    }
    if (removed > 0) {
      this.sum = Math.max(0, this.sum - removed);
      if (heavyRemoved > 0) this.heavySum = Math.max(0, this.heavySum - heavyRemoved);
      if (byteChanged) this.dirty = true;
      this.saveDirty = true;
    }
    return removed;
  }

  /** Fırçayı bir doğru parçası boyunca gezdirir (kare atlamalarına karşı). */
  cleanStroke(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    radius: number,
    strength: number,
  ): number {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.min(8, Math.max(1, Math.ceil(d / (radius * 0.6))));
    let removed = 0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      removed += this.cleanAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, radius, strength / steps);
    }
    return removed;
  }

  /** Ortalama kirlilik 0..1 (yalnız yürünebilir hücreler üzerinden). */
  private freeCells = 0;
  private countFree(): number {
    if (this.freeCells <= 0) {
      let n = 0;
      for (let i = 0; i < this.blocked.length; i++) if (this.blocked[i] === 0) n++;
      this.freeCells = Math.max(1, n);
    }
    return this.freeCells;
  }

  get totalSum(): number {
    return this.sum;
  }

  get coverage(): number {
    return clamp01(this.sum / (this.countFree() * MAX));
  }

  /**
   * AĞIR KİR — yalnız `SETTLE_CAP`'in ÜSTÜNDEKİ pay, 0..1.
   *
   * Hijyen bunu kullanır, `coverage`'ı değil. Neden: çöken toz tüm zemini
   * kaplar ve tek başına kaplamayı %30'a çıkarır; hijyene o da sayılınca
   * oyuncunun HİÇBİR ZAMAN kurtulamayacağı kalıcı bir vergi doğuyordu
   * (ölçüm: kaplama %30,6 iken bunun 26 puanı çöken tozdu, hijyen 14'e
   * indi). İnce toz filmi GÖRSELDİR; hijyeni yalnız çok basılan yerlerde
   * biriken ağır kir düşürür — yani süpürgenin gerçekten işe yaradığı yer.
   *
   * Artımlı `heavySum` ile O(1) sürede okunur.
   */
  get heavyCoverage(): number {
    return clamp01(this.heavySum / (this.countFree() * (MAX - SETTLE_CAP)));
  }

  /**
   * En kirli hücrenin dünya konumu — rehber oku buraya bakar.
   *
   * Tek hücre yeter: komşuları da kirlidir (kir kümeler hâlinde birikir,
   * tek tek serpilmez), oyuncu oraya varınca zaten çevresini süpürür.
   * `min` altındaki hiçbir şey gösterilmez ki ok zaten temiz bir zeminde
   * anlamsızca gezinmesin.
   */
  worstSpot(min: number): { x: number; z: number; v: number } | null {
    let best = -1;
    let bestV = min;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] > bestV) {
        bestV = this.data[i];
        best = i;
      }
    }
    if (best < 0) return null;
    return { x: this.cellX(best % this.cols), z: this.cellZ((best / this.cols) | 0), v: bestV };
  }

  clear(): void {
    if (this.sum === 0 && this.heavySum === 0) return;
    this.data.fill(0);
    this.sum = 0;
    this.heavySum = 0;
    this.dirty = true;
    this.saveDirty = true;
  }

  save(): GrimeSave {
    if (!this.saveDirty && this.cachedSave) return this.cachedSave;
    // Kayıtta bayt yeter: 1/255'lik yuvarlama hatası görünmez.
    const bytes = this.saveBytes;
    const data = this.data;
    const len = data.length;
    for (let i = 0; i < len; i++) {
      bytes[i] = Math.round(data[i]) & 255;
    }
    let s = '';
    const CHUNK = 1024;
    for (let i = 0; i < len; i += CHUNK) {
      s += String.fromCharCode(...bytes.subarray(i, Math.min(len, i + CHUNK)));
    }
    this.cachedSave = { c: this.cell, w: this.cols, h: this.rows, d: btoa(s) };
    this.saveDirty = false;
    return this.cachedSave;
  }

  load(data: Partial<GrimeSave> | undefined): void {
    this.clear();
    if (!data || data.c !== this.cell || data.w !== this.cols || data.h !== this.rows) return;
    if (typeof data.d !== 'string') return;
    try {
      const s = atob(data.d);
      const n = Math.min(s.length, this.data.length);
      let sum = 0;
      let heavy = 0;
      for (let i = 0; i < n; i++) {
        const v = s.charCodeAt(i) & 255;
        this.data[i] = v;
        sum += v;
        if (v > SETTLE_CAP) heavy += v - SETTLE_CAP;
      }
      this.sum = sum;
      this.heavySum = heavy;
      this.dirty = true;
      this.saveDirty = true;
    } catch {
      this.clear();
    }
  }
}
