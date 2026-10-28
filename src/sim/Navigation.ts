import { clamp } from '../core/MathUtils';
import { overlaps, sweep, type Contact } from './Collision';

/**
 * Kaba ızgara üstünde A*. Dükkân içi engeller (istasyonlar, kilitli bölgeler,
 * duvarlar) işaretlenir; müşteriler ve personel bu ızgarada yol bulur.
 * Gövde çarpışması ve yol kenarları gerçek geometriyle ayrıca sınanır.
 */

/**
 * Sandalye aralarını örneklemek için 0,25 birim. Örneklerin arasına düşen
 * gerçek geçitler ayrıca uç noktalarıyla bağlanır; hitboxlar şişirilmez.
 */
const CELL = 0.25;
const SQRT2 = Math.SQRT2;

/** İkili yığın (min-heap) — A* açık listesi. */
class Heap {
  private items: number[] = [];
  private costs: number[] = [];

  get size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
    this.costs.length = 0;
  }

  push(node: number, cost: number): void {
    this.items.push(node);
    this.costs.push(cost);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.costs[p] <= this.costs[i]) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop()!;
    const lastCost = this.costs.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.costs[0] = lastCost;
      let i = 0;
      const n = this.items.length;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let s = i;
        if (l < n && this.costs[l] < this.costs[s]) s = l;
        if (r < n && this.costs[r] < this.costs[s]) s = r;
        if (s === i) break;
        this.swap(i, s);
        i = s;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const ti = this.items[a];
    this.items[a] = this.items[b];
    this.items[b] = ti;
    const tc = this.costs[a];
    this.costs[a] = this.costs[b];
    this.costs[b] = tc;
  }
}

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly x0: number;
  readonly z0: number;

  private blocked: Uint8Array;
  /** Yeniden kurarken kullanılan sabit engeller (duvarlar) */
  private staticBlocked: Uint8Array;
  /** Gerçek engellerden 0,34 birim gövde açıklığı sağlayan A* hücreleri. */
  private padded: Uint8Array;
  private components: Int32Array;
  private componentsReady = false;

  private gScore: Float32Array;
  private fScore: Float32Array;
  private cameFrom: Int32Array;
  private stamp: Int32Array;
  private closed: Uint8Array;
  private runId = 0;
  private open = new Heap();
  private bfsQueue: Int32Array;
  private edgeCache: Uint16Array;
  private edgeStamp: Int32Array;
  private topologyId = 1;

  constructor(bounds: { x0: number; z0: number; x1: number; z1: number }, pad = 2) {
    this.x0 = Math.floor(bounds.x0 - pad);
    this.z0 = Math.floor(bounds.z0 - pad);
    this.cols = Math.ceil((bounds.x1 + pad - this.x0) / CELL) + 1;
    this.rows = Math.ceil((bounds.z1 + pad - this.z0) / CELL) + 1;
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.staticBlocked = new Uint8Array(n);
    this.padded = new Uint8Array(n);
    this.components = new Int32Array(n);
    this.gScore = new Float32Array(n);
    this.fScore = new Float32Array(n);
    this.cameFrom = new Int32Array(n);
    this.stamp = new Int32Array(n);
    this.closed = new Uint8Array(n);
    this.bfsQueue = new Int32Array(n);
    this.edgeCache = new Uint16Array(n);
    this.edgeStamp = new Int32Array(n);
  }

  idx(cx: number, cz: number): number {
    return cz * this.cols + cx;
  }

  colOf(x: number): number {
    return clamp(Math.round((x - this.x0) / CELL), 0, this.cols - 1);
  }

  rowOf(z: number): number {
    return clamp(Math.round((z - this.z0) / CELL), 0, this.rows - 1);
  }

  worldX(cx: number): number {
    return this.x0 + cx * CELL;
  }

  worldZ(cz: number): number {
    return this.z0 + cz * CELL;
  }

  /** Dinamik engelleri temizler, sabitleri geri koyar. */
  beginRebuild(): void {
    this.blocked.set(this.staticBlocked);
    this.solids.length = 0;
    this.corners.length = 0;
    this.oriented.length = 0;
    this.bridges = null;
    this.componentsReady = false;
    this.topologyId++;
  }

  /** Tüm engellerden sonra, hücreleri gerçek gövde yarıçapıyla örnekler. */
  finishRebuild(): void {
    this.topologyId++;
    // Sample actual solid bounds at the same radius used by character movement.
    // Whole-cell inflation was too large at service points; falling back to the
    // unpadded grid then routed characters through every obstacle corner.
    // Each solid visits only the cells its padded box can reach, with the same
    // exact overlap test, instead of every cell testing every solid.
    this.padded.set(this.staticBlocked);
    const s = this.solids, r = 0.34;
    for (let i = 0; i < s.length; i += 4) {
      const c0 = Math.max(0, Math.floor((s[i] - r - this.x0) / CELL));
      const c1 = Math.min(this.cols - 1, Math.ceil((s[i + 2] + r - this.x0) / CELL));
      const r0 = Math.max(0, Math.floor((s[i + 1] - r - this.z0) / CELL));
      const r1 = Math.min(this.rows - 1, Math.ceil((s[i + 3] + r - this.z0) / CELL));
      for (let z = r0; z <= r1; z++)
        for (let x = c0; x <= c1; x++) {
          const cell = this.idx(x, z);
          if (!this.padded[cell] && this.overlapsSolid(i, this.worldX(x), this.worldZ(z), r)) this.padded[cell] = 1;
        }
    }
    // Broad connectivity cheaply rejects disconnected grid islands before A*.
    // Exact segment checks still decide movement and each passage connection.
    this.components.fill(0);
    const queue = this.bfsQueue;
    let component = 0;
    for (let start = 0; start < this.padded.length; start++) {
      if (this.padded[start] || this.components[start]) continue;
      component++; let head = 0, tail = 1; queue[0] = start; this.components[start] = component;
      while (head < tail) {
        const cur = queue[head++], x = cur % this.cols, z = (cur / this.cols) | 0;
        for (let d = 0; d < 8; d++) {
          const nx = x + NEIGH[d * 2], nz = z + NEIGH[d * 2 + 1];
          if (nx < 0 || nz < 0 || nx >= this.cols || nz >= this.rows) continue;
          const next = this.idx(nx, nz);
          if (this.padded[next] || this.components[next]) continue;
          this.components[next] = component; queue[tail++] = next;
        }
      }
    }
    this.componentsReady = true;
  }

  bodyLineClear(ax: number, az: number, bx: number, bz: number, radius = 0.34, ignore = -1): boolean {
    if (this.solidAt(ax, az, radius, ignore) >= 0 || this.solidAt(bx, bz, radius, ignore) >= 0) return false;
    this.firstContact(ax, az, bx - ax, bz - az, radius, ignore);
    if (this.contact.time < 1 - 1e-9) return false;
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps,
        x = ax + (bx - ax) * t,
        z = az + (bz - az) * t;
      if (this.staticBlocked[this.idx(this.colOf(x), this.rowOf(z))])
        return false;
    }
    return true;
  }

  /**
   * Bir kez çağrılır: dükkân dışını kapat.
   *
   * Pay 0,35 — duvarın iç yüzü sınırdan 0,34 içeride. Eskiden 0,6 idi ve
   * üstüne A* şişirmesi 0,5 daha ekleyince duvar boyunca 1,1 birimlik ÖLÜ
   * bir bant oluşuyordu: oraya konan her şey (duvar dibindeki bulaşık
   * kovası gibi) personel için ulaşılmaz hâle geliyordu.
   */
  markStaticWalls(bounds: { x0: number; z0: number; x1: number; z1: number }): void {
    this.topologyId++;
    for (let cz = 0; cz < this.rows; cz++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const x = this.worldX(cx);
        const z = this.worldZ(cz);
        const outside =
          x < bounds.x0 + 0.35 || x > bounds.x1 - 0.35 || z < bounds.z0 + 0.35 || z > bounds.z1 - 0.35;
        if (outside) this.staticBlocked[this.idx(cx, cz)] = 1;
      }
    }
    this.blocked.set(this.staticBlocked);
  }

  /**
   * Duvarda kalıcı bir kapı boşluğu açar: hem dinamik hem SABİT engeli siler.
   * `unblockRect` sabit engellere dokunmaz, bu yüzden kapı için ayrı gerekir.
   */
  carveDoor(x0: number, z0: number, x1: number, z1: number): void {
    this.topologyId++;
    const c0 = this.colOf(Math.min(x0, x1));
    const c1 = this.colOf(Math.max(x0, x1));
    const r0 = this.rowOf(Math.min(z0, z1));
    const r1 = this.rowOf(Math.max(z0, z1));
    for (let cz = r0; cz <= r1; cz++) {
      for (let cx = c0; cx <= c1; cx++) {
        const i = this.idx(cx, cz);
        this.staticBlocked[i] = 0;
        this.blocked[i] = 0;
      }
    }
  }

  /**
   * Dikdörtgenin İÇİNDE MERKEZİ olan hücre aralığı.
   *
   * `colOf` en YAKIN hücreye yuvarlar; blockRect'te kullanılırsa her kenardan
   * yarım hücreye kadar fazladan engel yazar. 2,3 birimlik bir istasyon böylece
   * 3,3 birimlik görünmez duvara dönüşüyordu ("hitbox çok yer kaplıyor").
   * Merkez-içeride testi engeli gerçek gövdeye oturtur.
   */
  private cellRange(a: number, b: number, origin: number, max: number, out: [number, number]): boolean {
    const lo = Math.ceil((Math.min(a, b) - origin) / CELL - 1e-6);
    const hi = Math.floor((Math.max(a, b) - origin) / CELL + 1e-6);
    out[0] = lo < 0 ? 0 : lo;
    out[1] = hi > max ? max : hi;
    return out[0] <= out[1];
  }

  blockRect(x0: number, z0: number, x1: number, z1: number): void {
    // Gerçek dikdörtgeni sakla: gövde çarpışması ızgarayı değil bunu kullanır.
    this.pushSolid(x0, z0, x1, z1);
    this.stampRect(x0, z0, x1, z1);
  }

  /** The visible tabletop keeps its full size; only its empty corners disappear. */
  blockRoundedRect(x0: number, z0: number, x1: number, z1: number, corner: number): void {
    this.pushSolid(x0, z0, x1, z1, corner);
    this.stampSolid(this.solids.length - 4);
  }

  /** Rotated furniture keeps its actual footprint instead of an oversized AABB. */
  blockOrientedRect(x: number, z: number, hx: number, hz: number, angle: number, corner = 0): number {
    const c = Math.cos(angle), s = Math.sin(angle);
    const wx = Math.abs(c) * hx + Math.abs(s) * hz, wz = Math.abs(s) * hx + Math.abs(c) * hz;
    this.pushSolid(x - wx, z - wz, x + wx, z + wz, corner);
    const i = this.solids.length - 4;
    this.oriented[i / 4] = { x, z, hx, hz, c, s };
    this.stampSolid(i);
    return i;
  }

  private stampSolid(i: number): void {
    const s = this.solids, corner = this.corners[i / 4];
    if (corner === 0 && !this.oriented[i / 4]) { this.stampRect(s[i], s[i + 1], s[i + 2], s[i + 3]); return; }
    if (!this.cellRange(s[i], s[i + 2], this.x0, this.cols - 1, RANGE_X) ||
        !this.cellRange(s[i + 1], s[i + 3], this.z0, this.rows - 1, RANGE_Z)) return;
    for (let z = RANGE_Z[0]; z <= RANGE_Z[1]; z++)
      for (let x = RANGE_X[0]; x <= RANGE_X[1]; x++)
        if (this.overlapsSolid(i, this.worldX(x), this.worldZ(z), 0))
          this.blocked[this.idx(x, z)] = 1;
  }

  /**
   * İNCE DUVAR TUZAĞI. Izgara "merkezi içeride olan hücre" kuralıyla
   * işaretlenir; 0,28 kalınlığındaki bir duvar iki hücre merkezinin ARASINA
   * düşerse HİÇBİR hücreyi işaretlemez. Gövde çarpışması onu görür ama A*
   * görmez: personel duvarın içinden geçen bir yol bulur, her karede geri
   * itilir ve sonsuza kadar orada titrer. (Tuvalet odasının duvarında tam
   * olarak bu oldu — üç garson yedi dakika köşede kaldı.)
   *
   * Bu yüzden ızgara için dikdörtgen en az bir hücre kalınlığına şişirilir.
   * Gövde listesine yazılan ölçü değişmez; yalnız A* daha temkinli olur.
   */
  private stampRect(x0: number, z0: number, x1: number, z1: number): void {
    const gx0 = x1 - x0 < CELL ? (x0 + x1) / 2 - CELL / 2 : x0;
    const gx1 = x1 - x0 < CELL ? (x0 + x1) / 2 + CELL / 2 : x1;
    const gz0 = z1 - z0 < CELL ? (z0 + z1) / 2 - CELL / 2 : z0;
    const gz1 = z1 - z0 < CELL ? (z0 + z1) / 2 + CELL / 2 : z1;
    if (!this.cellRange(gx0, gx1, this.x0, this.cols - 1, RANGE_X)) return;
    if (!this.cellRange(gz0, gz1, this.z0, this.rows - 1, RANGE_Z)) return;
    for (let cz = RANGE_Z[0]; cz <= RANGE_Z[1]; cz++) {
      for (let cx = RANGE_X[0]; cx <= RANGE_X[1]; cx++) this.blocked[this.idx(cx, cz)] = 1;
    }
  }

  /**
   * BANT/GÖVDE UYUŞMAZLIĞI SİGORTASI. unblockRect ızgarayı temizler ama
   * gövde (solids) listesine dokunmaz: koridor bandına taşan bir istasyon
   * gövdesinde A* "yürünür" der, gövde çarpışması geçirmez — aktör o
   * noktada sonsuza kadar duvara iter (ince duvar tuzağının aynası).
   * Bot ölçümü bunu batı şeridindeki süpürge dolabında CANLI yakaladı:
   * frontAisle bandı dolabın hücrelerini açıyor, findPath dolabın içinden
   * tek adımlık yol veriyor, oyuncu z≈-0,7'de sonsuza dek itiyordu.
   *
   * Bant temizliklerinin ardından çağrılır: tüm gerçek gövdeler ızgaraya
   * yeniden damgalanır. Koridor garantisi fiziksel gövdeye karşı garanti
   * DEĞİLDİR; bantların işi şişirme taşmalarını ve bayat blokları silmek.
   */
  restampSolids(): void {
    const s = this.solids;
    for (let i = 0; i < s.length; i += 4) {
      this.stampSolid(i);
    }
  }

  unblockRect(x0: number, z0: number, x1: number, z1: number): void {
    if (!this.cellRange(x0, x1, this.x0, this.cols - 1, RANGE_X)) return;
    if (!this.cellRange(z0, z1, this.z0, this.rows - 1, RANGE_Z)) return;
    for (let cz = RANGE_Z[0]; cz <= RANGE_Z[1]; cz++) {
      for (let cx = RANGE_X[0]; cx <= RANGE_X[1]; cx++) {
        const i = this.idx(cx, cz);
        if (!this.staticBlocked[i]) this.blocked[i] = 0;
      }
    }
  }

  /**
   * Verilen noktadan yürüyerek ulaşılabilen tüm hücreler (4 yönlü taşma).
   * Yerleşim doğrulaması için: erişilemeyen istasyon = oyun durdurucu hata.
   */
  reachableMask(sx: number, sz: number): Uint8Array {
    const mask = new Uint8Array(this.cols * this.rows);
    const start = { x: sx, z: sz };
    if (this.isBlocked(sx, sz) && !this.nearestFree(sx, sz, start)) return mask;
    // Every cell enters at most once, so the grid-sized scratch queue suffices.
    const queue = this.bfsQueue;
    let tail = 0;
    queue[tail++] = this.idx(this.colOf(start.x), this.rowOf(start.z));
    mask[queue[0]] = 1;
    for (let head = 0; head < tail; head++) {
      const cur = queue[head];
      const cx = cur % this.cols;
      const cz = (cur / this.cols) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = cx + NEIGH[d * 2];
        const nz = cz + NEIGH[d * 2 + 1];
        if (nx < 0 || nz < 0 || nx >= this.cols || nz >= this.rows) continue;
        const ni = this.idx(nx, nz);
        if (mask[ni] || this.blocked[ni]) continue;
        mask[ni] = 1;
        queue[tail++] = ni;
      }
    }
    return mask;
  }

  /** Bir dünya noktası verilen erişim maskesinde mi (yakın hücreler dahil)? */
  maskHas(mask: Uint8Array, x: number, z: number, tolerance = 1): boolean {
    const cx = this.colOf(x);
    const cz = this.rowOf(z);
    for (let dz = -tolerance; dz <= tolerance; dz++) {
      for (let dx = -tolerance; dx <= tolerance; dx++) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= this.cols || nz >= this.rows) continue;
        if (mask[this.idx(nx, nz)]) return true;
      }
    }
    return false;
  }

  /** Bir z bandı boyunca en dar serbest geçit genişliği (birim). */
  narrowestGap(z0: number, z1: number, x0: number, x1: number): number {
    let worst = Infinity;
    const r0 = this.rowOf(z0);
    const r1 = this.rowOf(z1);
    for (let cz = r0; cz <= r1; cz++) {
      let free = 0;
      let best = 0;
      for (let cx = this.colOf(x0); cx <= this.colOf(x1); cx++) {
        if (this.blocked[this.idx(cx, cz)]) {
          if (free > best) best = free;
          free = 0;
        } else free++;
      }
      if (free > best) best = free;
      const width = best * CELL;
      if (width < worst) worst = width;
    }
    return worst === Infinity ? 0 : worst;
  }

  isBlockedCell(cx: number, cz: number): boolean {
    if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) return true;
    return this.blocked[this.idx(cx, cz)] === 1;
  }

  isBlocked(x: number, z: number): boolean {
    return this.isBlockedCell(this.colOf(x), this.rowOf(z));
  }

  /** Verilen noktaya en yakın serbest hücrenin dünya koordinatı. */
  nearestFree(x: number, z: number, out: { x: number; z: number }): boolean {
    return this.nearestFreeIn(x, z, out, this.blocked);
  }

  private nearestFreeIn(x: number, z: number, out: { x: number; z: number }, grid: Uint8Array): boolean {
    const cx = this.colOf(x);
    const cz = this.rowOf(z);
    const blockedAt = (ax: number, az: number) =>
      ax < 0 || az < 0 || ax >= this.cols || az >= this.rows || grid[this.idx(ax, az)] === 1;
    if (!blockedAt(cx, cz)) {
      out.x = x;
      out.z = z;
      return true;
    }
    for (let r = 1; r <= 12; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (!blockedAt(nx, nz)) {
            out.x = this.worldX(nx);
            out.z = this.worldZ(nz);
            return true;
          }
        }
      }
    }
    return false;
  }

  /** İki nokta arasında engel var mı (yol düzleştirme için). */
  lineOfSight(ax: number, az: number, bx: number, bz: number, grid?: Uint8Array): boolean {
    const g = grid ?? this.blocked;
    const hit = (x: number, z: number) => {
      const cx = this.colOf(x);
      const cz = this.rowOf(z);
      return cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows || g[this.idx(cx, cz)] === 1;
    };
    if (grid === this.padded && !this.bodyLineClear(ax, az, bx, bz)) return false;
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.5));
    if (steps <= 1) return !hit(bx, bz);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (hit(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  /**
   * A* yolu. Sonuç `out` dizisine [x0,z0, x1,z1, ...] olarak yazılır.
   * Başlangıç noktası dahil edilmez. Bulunamazsa false.
   */
  findPath(sx: number, sz: number, tx: number, tz: number, out: number[]): boolean {
    out.length = 0;
    // Crowd contact may place a .30 body in the planner's .04 safety margin.
    // Walk out of that margin first; never teleport or give up on a usable route.
    if (this.solidBlocked(sx, sz, .34) && !this.solidBlocked(sx, sz, .3)) {
      const start = { x: sx, z: sz };
      this.resolve(start, .34);
      if (!this.bodyLineClear(sx, sz, start.x, start.z, .3) ||
          !this.findClearPath(start.x, start.z, tx, tz, out)) return false;
      out.unshift(start.x, start.z);
      return true;
    }
    return this.findClearPath(sx, sz, tx, tz, out);
  }

  private findClearPath(sx: number, sz: number, tx: number, tz: number, out: number[]): boolean {
    // Exact clearance also admits straight narrow aisles between grid centers.
    if (this.bodyLineClear(sx, sz, tx, tz)) { out.push(tx, tz); return true; }
    // A raw-grid final approach still checks every segment against the body.
    if (this.search(sx, sz, tx, tz, out, this.padded)) return true;
    // A usable aisle can lie entirely between grid samples. Its exact midpoint
    // joins the regular grid on either side without shrinking any obstacle.
    if (!this.solidBlocked(tx, tz, .34)) {
      const candidates = this.passageBridges().filter(p => p.toX !== undefined || this.bodyLineClear(p.x, p.z, tx, tz));
      candidates.sort((a, b) => Math.hypot(sx - a.x, sz - a.z) + Math.hypot(tx - a.x, tz - a.z)
        - Math.hypot(sx - b.x, sz - b.z) - Math.hypot(tx - b.x, tz - b.z));
      for (const p of candidates) {
        if (!this.search(sx, sz, p.x, p.z, out, this.padded) ||
            Math.hypot(out[out.length - 2] - p.x, out[out.length - 1] - p.z) > 1e-4) continue;
        if (p.toX !== undefined && p.toZ !== undefined) {
          const tail: number[] = [];
          if (!this.search(p.toX, p.toZ, tx, tz, tail, this.padded) ||
              Math.hypot(tail[tail.length - 2] - tx, tail[tail.length - 1] - tz) > 1e-4) continue;
          out.push(p.toX, p.toZ, ...tail); return true;
        }
        out.push(tx, tz); return true;
      }
    }
    // Only relax the final approach when the target itself is inside the
    // clearance band but remains physically free. A genuinely narrow
    // corridor must still be rejected; otherwise actors would be sent into
    // a route that the movement solver can never traverse.
    const ti = this.idx(this.colOf(tx), this.rowOf(tz));
    if (this.padded[ti] === 1 && this.blocked[ti] === 0)
      return this.search(sx, sz, tx, tz, out, this.blocked);
    out.length = 0;
    return false;
  }

  private bridges: { x: number; z: number; toX?: number; toZ?: number }[] | null = null;
  private passageBridges(): NonNullable<NavGrid['bridges']> {
    if (this.bridges) return this.bridges;
    const out = this.bridges = [] as NonNullable<NavGrid['bridges']>, s = this.solids;
    const add = (x: number, z: number) => {
      if (!this.solidBlocked(x, z, .34)) out.push({ x, z });
    };
    const join = (x: number, z: number, toX: number, toZ: number) => {
      if (this.bodyLineClear(x, z, toX, toZ)) {
        out.push({ x, z, toX, toZ }, { x: toX, z: toZ, toX: x, toZ: z });
      }
    };
    for (let i = 0; i < s.length; i += 4) for (let j = i + 4; j < s.length; j += 4) {
      const x0 = Math.max(s[i], s[j]), x1 = Math.min(s[i + 2], s[j + 2]);
      const z0 = Math.max(s[i + 1], s[j + 1]), z1 = Math.min(s[i + 3], s[j + 3]);
      if (x0 - x1 >= .64 && x0 - x1 <= 1.4 && z1 >= z0) {
        for (const t of [.2, .5, .8]) add((x0 + x1) / 2, z0 + (z1 - z0) * t);
        join((x0 + x1) / 2, z0 - .4, (x0 + x1) / 2, z1 + .4);
      }
      if (z0 - z1 >= .64 && z0 - z1 <= 1.4 && x1 >= x0) {
        for (const t of [.2, .5, .8]) add(x0 + (x1 - x0) * t, (z0 + z1) / 2);
        join(x0 - .4, (z0 + z1) / 2, x1 + .4, (z0 + z1) / 2);
      }
    }
    return out;
  }

  private search(sx: number, sz: number, tx: number, tz: number, out: number[], grid: Uint8Array): boolean {
    out.length = 0;
    if (this.bodyLineClear(sx, sz, tx, tz)) { out.push(tx, tz); return true; }
    const start = this.idx(this.colOf(sx), this.rowOf(sz));
    let goalCol = this.colOf(tx);
    let goalRow = this.rowOf(tz);
    const targetClear = !this.solidBlocked(tx, tz, .34);
    if (targetClear && (grid[this.idx(goalCol, goalRow)] === 1 ||
        !this.bodyLineClear(this.worldX(goalCol), this.worldZ(goalRow), tx, tz))) {
      let best = Infinity, bestCol = -1, bestRow = -1;
      for (let r = 1; r <= 8 && bestCol < 0; r++) {
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const cx = goalCol + dx, cz = goalRow + dz;
          if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows || grid[this.idx(cx, cz)]) continue;
          const x = this.worldX(cx), z = this.worldZ(cz), d = Math.hypot(x - tx, z - tz);
          if (d < best && this.bodyLineClear(x, z, tx, tz)) { best = d; bestCol = cx; bestRow = cz; }
        }
      }
      if (bestCol < 0) return false;
      goalCol = bestCol; goalRow = bestRow;
    } else if (grid[this.idx(goalCol, goalRow)] === 1) {
      const tmp = { x: 0, z: 0 };
      if (!this.nearestFreeIn(tx, tz, tmp, grid)) return false;
      goalCol = this.colOf(tmp.x);
      goalRow = this.rowOf(tmp.z);
    }
    let goal = this.idx(goalCol, goalRow);
    if (grid === this.padded && this.componentsReady && !grid[start] &&
        this.components[start] !== this.components[goal]) return false;
    if (start === goal) {
      if (!this.bodyLineClear(sx, sz, tx, tz)) return false;
      out.push(tx, tz);
      return true;
    }

    this.runId++;
    const run = this.runId;
    const topo = this.topologyId;
    this.open.clear();

    this.stamp[start] = run;
    this.gScore[start] = 0;
    this.fScore[start] = this.heuristic(start, goal);
    this.cameFrom[start] = -1;
    this.closed[start] = 0;
    this.open.push(start, this.fScore[start]);

    let found = false;
    let guard = 0;
    while (this.open.size > 0 && guard++ < 20000) {
      const cur = this.open.pop();
      if (cur === goal) {
        found = true;
        break;
      }
      const cx = cur % this.cols;
      const cz = (cur / this.cols) | 0;
      const wx = cur === start ? sx : this.worldX(cx);
      const wz = cur === start ? sz : this.worldZ(cz);
      if (targetClear && cur !== start && Math.abs(wx - tx) <= 2.5 && Math.abs(wz - tz) <= 2.5 &&
          this.bodyLineClear(wx, wz, tx, tz)) {
        goal = cur; found = true; break;
      }
      if (this.closed[cur] === 1 && this.stamp[cur] === run) continue;
      this.closed[cur] = 1;

      let edgeCache = 0;
      if (cur !== start) {
        if (this.edgeStamp[cur] === topo) {
          edgeCache = this.edgeCache[cur];
        } else {
          this.edgeStamp[cur] = topo;
          this.edgeCache[cur] = 0;
        }
      }

      for (let d = 0; d < 8; d++) {
        const nx = cx + NEIGH[d * 2];
        const nz = cz + NEIGH[d * 2 + 1];
        if (nx < 0 || nz < 0 || nx >= this.cols || nz >= this.rows) continue;
        const ni = this.idx(nx, nz);
        if (grid[ni]) continue;
        // Rounded/rotated corners are decided by the exact edge sweep below;
        // blocking both orthogonal neighbours would close diagonal chair gaps.
        if (this.stamp[ni] === run && this.closed[ni] === 1) continue;
        // Every edge, including the raw-grid final approach, must fit the body.
        if (cur === start) {
          if (!this.bodyLineClear(sx, sz, this.worldX(nx), this.worldZ(nz))) continue;
        } else {
          const bit = 1 << d;
          if ((edgeCache & bit) === 0) {
            const clear = this.bodyLineClear(wx, wz, this.worldX(nx), this.worldZ(nz));
            edgeCache |= bit | (clear ? bit << 8 : 0);
            this.edgeCache[cur] = edgeCache;
          }
          if ((edgeCache & (bit << 8)) === 0) continue;
        }

        const step = d >= 4 ? SQRT2 : 1;
        const tentative = this.gScore[cur] + step;
        if (this.stamp[ni] !== run) {
          this.stamp[ni] = run;
          this.closed[ni] = 0;
          this.gScore[ni] = Infinity;
        }
        if (tentative < this.gScore[ni]) {
          this.cameFrom[ni] = cur;
          this.gScore[ni] = tentative;
          const f = tentative + this.heuristic(ni, goal);
          this.fScore[ni] = f;
          this.open.push(ni, f);
        }
      }
    }

    if (!found) return false;

    // Geri sar
    RAW.length = 0;
    let node = goal;
    while (node !== -1 && node !== start) {
      RAW.push(node);
      node = this.cameFrom[node];
      if (RAW.length > 4000) break;
    }
    RAW.reverse();

    // Görüş hattı ile düzleştir
    let curX = sx;
    let curZ = sz;
    let i = 0;
    while (i < RAW.length) {
      let best = i;
      for (let j = RAW.length - 1; j > i; j--) {
        const n = RAW[j];
        const wx = this.worldX(n % this.cols);
        const wz = this.worldZ((n / this.cols) | 0);
        if (this.bodyLineClear(curX, curZ, wx, wz)) {
          best = j;
          break;
        }
      }
      const n = RAW[best];
      const wx = this.worldX(n % this.cols);
      const wz = this.worldZ((n / this.cols) | 0);
      if (!this.bodyLineClear(curX, curZ, wx, wz)) { out.length = 0; return false; }
      out.push(wx, wz);
      curX = wx;
      curZ = wz;
      i = best + 1;
    }

    // Son adımı gerçek hedefe çek
    if (out.length >= 2 && this.bodyLineClear(curX, curZ, tx, tz)) {
      // Keep the final safe corner. Replacing it with the target can cut
      // through an obstacle even when corner-to-target is clear.
      if (Math.hypot(curX - tx, curZ - tz) > 1e-4) out.push(tx, tz);
    }
    return out.length > 0;
  }

  private heuristic(a: number, b: number): number {
    const ax = a % this.cols;
    const az = (a / this.cols) | 0;
    const bx = b % this.cols;
    const bz = (b / this.cols) | 0;
    const dx = Math.abs(ax - bx);
    const dz = Math.abs(az - bz);
    return dx > dz ? dx + (SQRT2 - 1) * dz : dz + (SQRT2 - 1) * dx;
  }

  /* ================================================================ *
   *  GÖVDE ÇARPIŞMASI — ızgara DEĞİL, gerçek dikdörtgenler
   *
   *  Izgara A* için doğru araç ama çarpışma için felaket: 0,5'lik hücre
   *  yuvarlaması her kenara 0,25, oyuncu yarıçapı 0,32 daha ekliyordu;
   *  2,3 birimlik bir tezgâh 3,4 birimlik görünmez duvara dönüşüyordu.
   *  Oyuncu "boşlukta koşarken bloklanıyorum" diyorsa sebebi budur.
   *
   *  Bu yüzden `blockRect` çağrıları AYNI ZAMANDA gerçek dikdörtgen olarak
   *  saklanır ve gövde çarpışması doğrudan onlarla çözülür. Kenar artık
   *  görünen gövdenin tam kendisidir.
   * ================================================================ */

  /** Düz liste: x0, z0, x1, z1, x0, z0, … */
  private solids: number[] = [];
  private corners: number[] = [];
  private oriented: ({ x: number; z: number; hx: number; hz: number; c: number; s: number } | null)[] = [];
  private contact: Contact = { time: 1, nx: 0, nz: 0 };
  private localContact: Contact = { time: 1, nx: 0, nz: 0 };

  get solidCount(): number {
    return this.solids.length / 4;
  }

  /** Dikdörtgeni hem ızgaraya hem gövde listesine yazar. */
  private pushSolid(x0: number, z0: number, x1: number, z1: number, corner = 0): void {
    this.topologyId++;
    this.solids.push(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1));
    this.corners.push(Math.max(0, Math.min(corner, Math.abs(x1 - x0) / 2, Math.abs(z1 - z0) / 2)));
    this.oriented.push(null);
  }

  /** Yalnız gövde çarpışması (duvar gibi) — A* ızgarasına dokunmaz. */
  addSolid(x0: number, z0: number, x1: number, z1: number): void {
    this.pushSolid(x0, z0, x1, z1);
  }

  /** Nokta hangi gövdenin içinde? (yarıçap kadar şişirilmiş test) */
  solidAt(x: number, z: number, radius: number, ignore = -1): number {
    const s = this.solids;
    for (let i = 0; i < s.length; i += 4) {
      if (i === ignore) continue;
      if (this.overlapsSolid(i, x, z, radius)) {
        return i;
      }
    }
    return -1;
  }

  private overlapsSolid(i: number, x: number, z: number, radius: number): boolean {
    const s = this.solids;
    if (x <= s[i] - radius || x >= s[i + 2] + radius || z <= s[i + 1] - radius || z >= s[i + 3] + radius) return false;
    const idx = i >> 2;
    const o = this.oriented[idx];
    if (!o) return overlaps(x, z, radius, s[i], s[i + 1], s[i + 2], s[i + 3], this.corners[idx]);
    const dx = x - o.x, dz = z - o.z;
    return overlaps(dx * o.c - dz * o.s, dx * o.s + dz * o.c, radius,
      -o.hx, -o.hz, o.hx, o.hz, this.corners[idx]);
  }

  /** Hand reach uses the same shapes; even a very thin partition blocks it. */
  interactionLineClear(ax: number, az: number, bx: number, bz: number): boolean {
    if (!Number.isFinite(ax) || !Number.isFinite(az) || !Number.isFinite(bx) || !Number.isFinite(bz)) return false;
    if (this.solidBlocked(ax, az, 1e-5) || this.solidBlocked(bx, bz, 1e-5)) return false;
    this.firstContact(ax, az, bx - ax, bz - az, 1e-5);
    return this.contact.time === 1;
  }

  solidBlocked(x: number, z: number, radius: number): boolean {
    return this.solidAt(x, z, radius) >= 0;
  }

  private firstContact(x: number, z: number, dx: number, dz: number, radius: number, ignore = -1): void {
    this.contact.time = 1; this.contact.nx = 0; this.contact.nz = 0;
    const s = this.solids;
    const xEnd = x + dx, zEnd = z + dz;
    const minX = (x < xEnd ? x : xEnd) - radius;
    const maxX = (x > xEnd ? x : xEnd) + radius;
    const minZ = (z < zEnd ? z : zEnd) - radius;
    const maxZ = (z > zEnd ? z : zEnd) + radius;
    for (let i = 0; i < s.length; i += 4) {
      if (i === ignore) continue;
      if (maxX < s[i] || minX > s[i + 2] || maxZ < s[i + 1] || minZ > s[i + 3]) continue;
      const idx = i >> 2;
      const o = this.oriented[idx];
      if (!o) { sweep(x, z, dx, dz, radius, s[i], s[i + 1], s[i + 2], s[i + 3], this.corners[idx], this.contact); continue; }
      const px = x - o.x, pz = z - o.z, hit = this.localContact;
      hit.time = this.contact.time; hit.nx = 0; hit.nz = 0;
      sweep(px * o.c - pz * o.s, px * o.s + pz * o.c, dx * o.c - dz * o.s, dx * o.s + dz * o.c,
        radius, -o.hx, -o.hz, o.hx, o.hz, this.corners[idx], hit);
      if (hit.nx || hit.nz) {
        this.contact.time = hit.time;
        this.contact.nx = hit.nx * o.c + hit.nz * o.s;
        this.contact.nz = -hit.nx * o.s + hit.nz * o.c;
      }
    }
  }

  /**
   * Sürekli temas ve teğet kayma; eksen sırasından ve kare hızından bağımsızdır.
   */
  slideMove(pos: { x: number; z: number }, dx: number, dz: number, radius: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return;
    if (this.solidBlocked(pos.x, pos.z, radius)) this.resolve(pos, radius);
    // Sweep the entire displacement: a slow frame must never jump a thin wall.
    for (let pass = 0; pass < 6 && Math.hypot(dx, dz) > 1e-7; pass++) {
      this.firstContact(pos.x, pos.z, dx, dz, radius);
      const { time, nx, nz } = this.contact;
      pos.x += dx * time; pos.z += dz * time;
      if (time === 1) return;
      pos.x += nx * 1e-5; pos.z += nz * 1e-5;
      dx *= 1 - time; dz *= 1 - time;
      // Remove only movement into the surface; retain the user's tangent input.
      const inward = Math.min(0, dx * nx + dz * nz);
      dx -= nx * inward; dz -= nz * inward;
    }
  }

  /**
   * Bir varlığı gövdenin dışına iter — EN KISA kenardan.
   *
   * Eski sürüm sekiz sonda atıp bileşke vektör hesaplıyordu; tam içeride
   * kalındığında bileşke sıfıra yakınsıyor ve varlık her kare rastgele bir
   * yöne fırlıyordu. Dikdörtgende doğru cevap belli: dört kenara olan
   * mesafeyi ölç, en yakınından çık.
   */
  resolve(pos: { x: number; z: number }, radius: number): void {
    const startX = pos.x, startZ = pos.z;
    for (let iter = 0; iter < 12; iter++) {
      const i = this.solidAt(pos.x, pos.z, radius);
      if (i < 0) return;
      const s = this.solids;
      const corner = this.corners[i / 4];
      const o = this.oriented[i / 4];
      if (o) {
        const px = pos.x - o.x, pz = pos.z - o.z;
        const x = px * o.c - pz * o.s, z = px * o.s + pz * o.c;
        const cx = clamp(x, -o.hx + corner, o.hx - corner), cz = clamp(z, -o.hz + corner, o.hz - corner);
        let dx = x - cx, dz = z - cz;
        const distance = Math.hypot(dx, dz);
        if (distance > 1e-8) {
          const push = (corner + radius + 1e-5 - distance) / distance; dx *= push; dz *= push;
        } else {
          const ex = o.hx + radius - Math.abs(x), ez = o.hz + radius - Math.abs(z);
          dx = ex <= ez ? (x < 0 ? -1 : 1) * (ex + 1e-5) : 0;
          dz = ez < ex ? (z < 0 ? -1 : 1) * (ez + 1e-5) : 0;
        }
        pos.x += dx * o.c + dz * o.s; pos.z += -dx * o.s + dz * o.c;
        continue;
      }
      const cx = clamp(pos.x, s[i] + corner, s[i + 2] - corner);
      const cz = clamp(pos.z, s[i + 1] + corner, s[i + 3] - corner);
      const dx = pos.x - cx, dz = pos.z - cz, distance = Math.hypot(dx, dz);
      if (distance > 1e-8) {
        const push = (corner + radius + 1e-5 - distance) / distance;
        pos.x += dx * push; pos.z += dz * push;
        continue;
      }
      const left = pos.x - (s[i] - radius);
      const right = s[i + 2] + radius - pos.x;
      const up = pos.z - (s[i + 1] - radius);
      const down = s[i + 3] + radius - pos.z;
      const m = Math.min(left, right, up, down);
      if (m === left) pos.x = s[i] - radius - 1e-3;
      else if (m === right) pos.x = s[i + 2] + radius + 1e-3;
      else if (m === up) pos.z = s[i + 1] - radius - 1e-3;
      else pos.z = s[i + 3] + radius + 1e-3;
    }
    // Overlapping furniture can bounce a shortest-edge projection back and forth.
    // Select the closest completely free escape around the original point.
    let best = Infinity, bestX = pos.x, bestZ = pos.z;
    const consider = (x: number, z: number): void => {
      const d = (x - startX) ** 2 + (z - startZ) ** 2;
      if (d >= best || this.solidBlocked(x, z, radius) ||
          this.staticBlocked[this.idx(this.colOf(x), this.rowOf(z))]) return;
      best = d; bestX = x; bestZ = z;
    };
    for (let i = 0; i < this.solids.length; i += 4) {
      const s = this.solids, x0 = s[i] - radius - .001, x1 = s[i + 2] + radius + .001;
      const z0 = s[i + 1] - radius - .001, z1 = s[i + 3] + radius + .001;
      const x = clamp(startX, x0, x1), z = clamp(startZ, z0, z1);
      consider(x0, z); consider(x1, z); consider(x, z0); consider(x, z1);
      consider(x0, z0); consider(x0, z1); consider(x1, z0); consider(x1, z1);
    }
    if (best < Infinity) { pos.x = bestX; pos.z = bestZ; }
  }
}

const RAW: number[] = [];
const RANGE_X: [number, number] = [0, 0];
const RANGE_Z: [number, number] = [0, 0];
// sağ, sol, aşağı, yukarı, sonra çaprazlar
const NEIGH = [1, 0, -1, 0, 0, 1, 0, -1, 1, 1, 1, -1, -1, 1, -1, -1];
