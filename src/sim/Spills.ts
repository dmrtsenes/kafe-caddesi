import { BALANCE } from '../data/balance';
import { clamp01 } from '../core/MathUtils';

/**
 * Leke türü — görsel ve hijyen ağırlığı buna göre değişir.
 *
 * 'toz' diğer ikisinden farklıdır: kendiliğinden, düzenli aralıklarla ve
 * RASTGELE yerlerde birikir (müşteriye bağlı değil) ve paspasla değil
 * ELEKTRİKLİ SÜPÜRGEYLE hızlı temizlenir. Kafeye "arada bir turla" diye
 * ikinci bir ritim katar.
 */
export type SpillKind = 'liquid' | 'crumbs' | 'toz';

/**
 * KİR HÜCRE IZGARASI — iz bırakan temizliğin temeli.
 *
 * Leke tek bir skaler değil, `CELLS × CELLS`'lik bir kaplama maskesidir.
 * Eskiden `amount` tek bir sayıydı ve menzile girince topluca eriyordu:
 * oyuncu lekenin YANINDAN koşarak geçerken bile leke komple siliniyordu
 * ("nerenin üzerinden geçersem orası temizlensin" geri bildirimi).
 *
 * Artık temizlik bir FIRÇA: süpürge başlığının geçtiği hücreler silinir,
 * geri kalan kir olduğu yerde durur. `amount` = kalan hücre oranı, yani
 * hijyen ve ödül hesabı hiç değişmeden çalışmaya devam eder.
 *
 * 11×11 = 121 hücre: 1,7 birim çapındaki bir lekede hücre kenarı ~0,15
 * birim (ekranda ~5 piksel) — fırça izi okunaklı, maske yeniden çizimi ucuz.
 */
export const CELLS = 11;

export interface Spill {
  id: number;
  x: number;
  z: number;
  kind: SpillKind;
  /** Kalan kirlilik 0..1 — 0 olunca silinir. `cellsLeft / cellsTotal`. */
  amount: number;
  /** Görsel büyüme 0..1 (yeni doğan leke yayılarak belirir) */
  grow: number;
  radius: number;
  /** Bir personel bu lekeyi üstlendi mi */
  reservedBy: string | null;
  reserveTimer: number;
  /** Kaplama maskesi: 1 = kirli, 0 = temizlenmiş. Satır-öncelikli. */
  cells: Uint8Array;
  /** Kalan kirli hücre sayısı. */
  cellsLeft: number;
  /** Doğuştaki kirli hücre sayısı (amount paydası). */
  cellsTotal: number;
  /** Maske değişti → görsel katman kendi dokusunu yeniden çizsin. */
  maskDirty: boolean;
  /** Personel aşınmasında hücre kesirlerini biriktirir. */
  erodeAcc?: number;
}

/** Hücre merkezinin leke-yerel koordinatı (−1..1). */
function cellCenter(i: number): number {
  return ((i + 0.5) / CELLS) * 2 - 1;
}

/**
 * Yeni bir kaplama maskesi. Hücreler daire içinde kalanlardan seçilir;
 * kenar `wobble` ile hafifçe düzensizleştirilir — kusursuz daire "yapay"
 * görünüyor (görsel katmandaki blob biçimiyle aynı gerekçe).
 */
function buildCells(seed: number): { cells: Uint8Array; count: number } {
  const cells = new Uint8Array(CELLS * CELLS);
  let count = 0;
  for (let r = 0; r < CELLS; r++) {
    const cz = cellCenter(r);
    for (let c = 0; c < CELLS; c++) {
      const cx = cellCenter(c);
      const d = Math.hypot(cx, cz);
      const a = Math.atan2(cz, cx);
      const edge = 0.92 + Math.sin(a * 3 + seed) * 0.09 + Math.sin(a * 5 - seed * 1.7) * 0.05;
      if (d <= edge) {
        cells[r * CELLS + c] = 1;
        count++;
      }
    }
  }
  return { cells, count };
}

export interface SpillSave {
  s: { x: number; z: number; k: number; a: number }[];
}

/**
 * ZEMİN KİRİ.
 *
 * Masadan kalkan müşteri arkasında iz bırakır, servis sırasında bardak
 * devrilir. Leke yürümeyi engellemez — sadece HİJYENİ düşürür ve bu doğrudan
 * müşteri akışına yansır. Görünmez bir ceza olmasın diye zeminde apaçık
 * durur: oyuncu "burası kirli" bilgisini bakışla alır.
 *
 * Temizleme yakınlık tabanlıdır (oyunun geri kalanı gibi): lekenin üstünde
 * durursan silinir.
 */
export class SpillField {
  readonly list: Spill[] = [];
  private seq = 1;
  /** Bu karede yeni leke doğdu mu / silindi mi — görsel katman bunu dinler */
  dirtyVisual = true;

  get count(): number {
    return this.list.length;
  }

  /** Toplam kirlilik miktarı (hijyen hesabı bunu kullanır). */
  get totalAmount(): number {
    let t = 0;
    for (const s of this.list) t += s.amount;
    return t;
  }

  /**
   * Yürünebilirlik sınayıcısı — World kurulumda bağlar.
   *
   * NEDEN VAR: leke, masanın ya da tezgâhın gövdesinin içine doğabiliyordu.
   * Oraya gönderilen komi lekeye ASLA ulaşamıyor ama `findPath` "başarılı"
   * dönüp tek adımlık kısa bir yol veriyor; komi o adımı atıyor, duruyor,
   * tekrar deniyor — sonsuza kadar. Soak testinde bir komi tam olarak böyle
   * 600 saniye boyunca ölü kaldı ve leke hiç temizlenmedi.
   */
  walkable: ((x: number, z: number) => boolean) | null = null;

  /**
   * Yürünemez bir noktayı en yakın yürünebilir noktaya kaydırır.
   * Bulunamazsa null döner ve leke hiç doğmaz.
   */
  private snapToWalkable(x: number, z: number): { x: number; z: number } | null {
    const ok = this.walkable;
    if (!ok || ok(x, z)) return { x, z };
    // Genişleyen halkalar hâlinde ara: 8 yön × 3 yarıçap.
    for (const r of [0.5, 1.0, 1.6]) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const nx = x + Math.cos(a) * r;
        const nz = z + Math.sin(a) * r;
        if (ok(nx, nz)) return { x: nx, z: nz };
      }
    }
    return null;
  }

  spawn(x: number, z: number, kind: SpillKind = 'liquid'): Spill | null {
    if (this.list.length >= BALANCE.dirt.maxSpills) return null;
    const spot = this.snapToWalkable(x, z);
    if (!spot) return null;
    x = spot.x;
    z = spot.z;
    /**
     * Aynı noktaya üst üste leke yığmak yerine mevcut olanı BÜYÜT: kaplama
     * maskesinde silinmiş hücrelerin bir kısmı geri kirlenir (yeni dökülen
     * içecek temizlenmiş yeri yeniden kirletir — beklenen davranış).
     */
    const near = this.nearest(x, z, 0.9);
    if (near) {
      const want = Math.min(near.cellsTotal, Math.ceil(near.cellsLeft + near.cellsTotal * 0.35));
      const { cells } = buildCells(near.id * 1.9);
      for (let i = 0; i < cells.length && near.cellsLeft < want; i++) {
        if (cells[i] === 1 && near.cells[i] === 0) {
          near.cells[i] = 1;
          near.cellsLeft++;
        }
      }
      near.amount = near.cellsLeft / near.cellsTotal;
      near.maskDirty = true;
      return near;
    }
    const id = this.seq++;
    const { cells, count } = buildCells(id * 1.9);
    const s: Spill = {
      id,
      x,
      z,
      kind,
      amount: 1,
      grow: 0,
      // Toz daha geniş yayılır: süpürgeyle "bir tur atılacak" alan hissi
      // verir ve açık zeminde tek başına daha görünür olur.
      radius: BALANCE.dirt.spillRadius * (kind === 'crumbs' ? 0.85 : kind === 'toz' ? 1.35 : 1),
      reservedBy: null,
      reserveTimer: 0,
      cells,
      cellsLeft: count,
      cellsTotal: count,
      maskDirty: true,
    };
    this.list.push(s);
    this.dirtyVisual = true;
    return s;
  }

  byId(id: number): Spill | null {
    for (const s of this.list) if (s.id === id) return s;
    return null;
  }

  nearest(x: number, z: number, maxDist: number, uid?: string): Spill | null {
    let best: Spill | null = null;
    let bestD = maxDist * maxDist;
    for (const s of this.list) {
      if (uid && s.reservedBy !== null && s.reservedBy !== uid) continue;
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  reserve(s: Spill, who: string): void {
    s.reservedBy = who;
    s.reserveTimer = BALANCE.staff.reserveTimeout;
  }

  /** Rezervasyonu bırak (yalnızca sahibi bırakabilir). */
  clearReserve(s: Spill, who: string): void {
    if (s.reservedBy === who) {
      s.reservedBy = null;
      s.reserveTimer = 0;
    }
  }

  /** Kalan hücre sayısından `amount`'ı tazeler. */
  private refresh(s: Spill): void {
    s.amount = s.cellsTotal > 0 ? s.cellsLeft / s.cellsTotal : 0;
    s.maskDirty = true;
  }

  /**
   * FIRÇA. Dünya koordinatındaki bir daireye denk gelen hücreleri siler —
   * oyuncunun temizliği budur: süpürge başlığının GEÇTİĞİ yer temizlenir.
   * Temizlenen hücre sayısını döner (0 = fırça boşa geçti).
   */
  carveAt(s: Spill, wx: number, wz: number, radius: number): number {
    if (s.cellsLeft <= 0) return 0;
    const inv = 1 / s.radius;
    const lx = (wx - s.x) * inv;
    const lz = (wz - s.z) * inv;
    const br = radius * inv;
    if (Math.hypot(lx, lz) > 1 + br) return 0; // fırça lekeye hiç değmiyor
    const br2 = br * br;
    // Yalnız fırçanın kapsadığı hücre aralığını tara.
    const lo = (v: number): number => Math.max(0, Math.floor(((v - br + 1) / 2) * CELLS));
    const hi = (v: number): number => Math.min(CELLS - 1, Math.ceil(((v + br + 1) / 2) * CELLS));
    let cleared = 0;
    for (let r = lo(lz); r <= hi(lz); r++) {
      const dz = cellCenter(r) - lz;
      for (let c = lo(lx); c <= hi(lx); c++) {
        const i = r * CELLS + c;
        if (s.cells[i] === 0) continue;
        const dx = cellCenter(c) - lx;
        if (dx * dx + dz * dz > br2) continue;
        s.cells[i] = 0;
        cleared++;
      }
    }
    if (cleared > 0) {
      s.cellsLeft -= cleared;
      this.refresh(s);
    }
    return cleared;
  }

  /**
   * Fırçayı bir DOĞRU PARÇASI boyunca gezdirir. Tek noktada fırçalamak
   * yüksek hızda delikli bir iz bırakıyordu: 5,6 birim/sn koşarken kare
   * başına 0,19 birim yol var, fırça yarıçapı 0,45 — sorun değil gibi
   * görünse de kare atlamalarında (dt tavanı 0,1 sn) 0,56 birimlik boşluk
   * oluşuyor. Örnekleme adımı yarıçapın yarısıdır.
   */
  carveStroke(s: Spill, x0: number, z0: number, x1: number, z1: number, radius: number): number {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.min(8, Math.max(1, Math.ceil(d / (radius * 0.5))));
    let cleared = 0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      cleared += this.carveAt(s, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, radius);
    }
    return cleared;
  }

  /**
   * OVMA — bir noktada DURARAK temizleme.
   *
   * Fırça tek başına yeterli değil: oyuncu lekenin üstünde durduğunda
   * (rehber okunu takip edip merkeze gelmek en doğal davranış) fırça aynı
   * hücreleri tekrar tekrar tarıyor, hiçbir şey ilerlemiyordu — bot 50
   * dakikada TEK bir leke bile bitiremedi ve lekenin başında kilitlendi.
   *
   * Durunca fırçanın MERKEZİNDEN dışa doğru zamanla aşınır: iz bırakma
   * hissi korunur (kir hep başlığın olduğu yerden açılır) ama ilerleme
   * garanti altındadır. Süpürerek geçmek yine belirgin şekilde hızlıdır.
   */
  scrubAt(s: Spill, wx: number, wz: number, dt: number, rate: number): number {
    if (s.cellsLeft <= 0) return 0;
    /**
     * SÜRE LEKENİN BÜYÜKLÜĞÜNE BAĞLI.
     *
     * `rate` artık REFERANS boyuttaki (BALANCE.dirt.spillRadius) bir leke
     * için geçerlidir; gerçek leke ne kadar genişse o kadar uzun sürer.
     *
     * Neden gerekti: bütün lekelerin hücre sayısı ~81'dir (maske hep 11×11
     * bir daire), boyut farkı `radius`tadır. Ölçümde 1,15 yarıçaplı bir toz
     * ile 0,85'lik bir sıvı TAM OLARAK aynı sürede (1,72 sn) siliniyordu —
     * yani büyük pislik küçüğüyle aynı emeği istiyordu. Alanla ölçekleyince
     * toz sıvının 1,83 katı sürer.
     */
    const ref = BALANCE.dirt.spillRadius;
    const areaMult = (s.radius / ref) ** 2;
    s.erodeAcc = (s.erodeAcc ?? 0) + (dt * rate * s.cellsTotal) / areaMult;
    let n = Math.floor(s.erodeAcc);
    if (n <= 0) return 0;
    s.erodeAcc -= n;
    const inv = 1 / s.radius;
    const lx = (wx - s.x) * inv;
    const lz = (wz - s.z) * inv;
    let cleared = 0;
    while (n > 0 && s.cellsLeft > 0) {
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < s.cells.length; i++) {
        if (s.cells[i] === 0) continue;
        const dx = cellCenter(i % CELLS) - lx;
        const dz = cellCenter((i / CELLS) | 0) - lz;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best < 0) break;
      s.cells[best] = 0;
      s.cellsLeft--;
      cleared++;
      n--;
    }
    if (cleared > 0) this.refresh(s);
    return cleared;
  }

  /**
   * ZAMAN TABANLI AŞINMA — personel için. Komi lekenin başında durup
   * çalışır; fırça mantığı ona uymaz (yerinde durduğu için asla bitiremezdi).
   * Merkeze en yakın hücreden dışa doğru, saniyede `rate` oranında siler.
   * Tamamen silindiyse true döner.
   */
  erode(s: Spill, dt: number, rate: number): boolean {
    if (s.cellsLeft <= 0) {
      this.remove(s);
      return true;
    }
    s.erodeAcc = (s.erodeAcc ?? 0) + dt * rate * s.cellsTotal;
    let n = Math.floor(s.erodeAcc);
    if (n > 0) {
      s.erodeAcc -= n;
      // Merkezden dışa: en yakın kirli hücreyi bul, sil, tekrarla.
      while (n > 0 && s.cellsLeft > 0) {
        let best = -1;
        let bestD = Infinity;
        for (let i = 0; i < s.cells.length; i++) {
          if (s.cells[i] === 0) continue;
          const cx = cellCenter(i % CELLS);
          const cz = cellCenter((i / CELLS) | 0);
          const d = cx * cx + cz * cz;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        if (best < 0) break;
        s.cells[best] = 0;
        s.cellsLeft--;
        n--;
      }
      this.refresh(s);
    }
    if (s.cellsLeft > 0) return false;
    this.remove(s);
    return true;
  }

  remove(s: Spill): void {
    const i = this.list.indexOf(s);
    if (i >= 0) {
      this.list.splice(i, 1);
      this.dirtyVisual = true;
    }
  }

  update(dt: number): void {
    const g = BALANCE.dirt.spillGrow;
    for (const s of this.list) {
      if (s.grow < 1) {
        s.grow = clamp01(s.grow + dt / g);
        this.dirtyVisual = true;
      }
      if (s.reserveTimer > 0) {
        s.reserveTimer -= dt;
        if (s.reserveTimer <= 0) s.reservedBy = null;
      }
    }
  }

  clear(): void {
    if (this.list.length === 0) return;
    this.list.length = 0;
    this.dirtyVisual = true;
  }

  /**
   * Tür kodu: 0 = liquid, 1 = crumbs, 2 = toz. Eskiden yalnız 0/1 vardı ve
   * toz da 0 yazılıyordu: her kayıt/yükleme döngüsünde tozlar sıvı lekeye
   * dönüşüyor, süpürge gerektirmeyen kire çevrilip "toz = süpürge işi"
   * kuralını deliyordu. Eski kayıtlarla geriye uyumlu (0/1 aynı anlamda).
   */
  private static kindCode(k: SpillKind): number {
    return k === 'crumbs' ? 1 : k === 'toz' ? 2 : 0;
  }

  private static codeKind(c: number): SpillKind {
    return c === 1 ? 'crumbs' : c === 2 ? 'toz' : 'liquid';
  }

  save(): SpillSave {
    return {
      s: this.list.map((s) => ({ x: s.x, z: s.z, k: SpillField.kindCode(s.kind), a: s.amount })),
    };
  }

  load(data: Partial<SpillSave> | undefined): void {
    this.clear();
    if (!Array.isArray(data?.s)) return;
    for (const raw of data.s.slice(0, BALANCE.dirt.maxSpills)) {
      const s = this.spawn(raw.x, raw.z, SpillField.codeKind(raw.k));
      if (s) {
        // Yarım temizlenmiş leke: kaplamayı kayıttaki orana indir (dıştan
        // içe silinir; tam ters yönde silmek "ortası açılmış" tuhaf bir
        // maske bırakırdı).
        const keep = Math.max(1, Math.round(s.cellsTotal * clamp01(raw.a)));
        while (s.cellsLeft > keep) {
          let far = -1;
          let farD = -1;
          for (let i = 0; i < s.cells.length; i++) {
            if (s.cells[i] === 0) continue;
            const cx = cellCenter(i % CELLS);
            const cz = cellCenter((i / CELLS) | 0);
            const d = cx * cx + cz * cz;
            if (d > farD) {
              farD = d;
              far = i;
            }
          }
          if (far < 0) break;
          s.cells[far] = 0;
          s.cellsLeft--;
        }
        s.amount = s.cellsLeft / s.cellsTotal;
        s.grow = 1;
        s.maskDirty = true;
      }
    }
  }
}
