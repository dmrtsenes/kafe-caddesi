import * as THREE from 'three';
import { BALANCE } from '../data/balance';
import { angleTowards, dist, wrapAngle } from '../core/MathUtils';
import type { World } from './World';
import { markDynamic } from '../world/layers';

/**
 * SÜPÜRGE ROBOTU — ödüllü reklamın süreli yardımcısı.
 *
 * Neden AYRI BİR MODÜL: robot dünyanın hiçbir şeyini değiştirmez, yalnız
 * onun açık API'lerini kullanır (`grime`, `spills`, `nav`, `root`). Bu
 * sayede `World` sınıfına tek satır eklemeden yaşar ve süresi bitince
 * hiçbir iz bırakmadan yok olur. Geçici bir yardımcının kalıcı bir sistemin
 * içine karışmaması, sonradan kaldırmayı da bedava kılar.
 *
 * TASARIM: robot oyuncunun YERİNE GEÇMEZ, ona zaman kazandırır.
 *  · Yalnız ZEMİN işi yapar (trafik kiri + yerdeki leke). Sipariş taşımaz,
 *    bulaşık toplamaz, tuvalete bakmaz — oyunun çekirdek döngüsü el
 *    değmeden kalır.
 *  · Süresi dolunca kaybolur; kalıcı güç vermez (bkz. core/Ads.ts, ödül
 *    seçiminin üç şartı).
 *  · Oyuncunun süpürgesinden YAVAŞTIR: robot rahatlık satar, verim değil.
 */

/** Hedefe bu kadar yaklaşınca "vardı" sayılır. */
const ARRIVE = 0.42;
/** Ara yol noktasına varış eşiği. */
const WAYPOINT_ARRIVE = 0.12;
/** Hedef en fazla bu kadar sürede yenilenir (sn). */
const RETARGET = 6;
/** Çarpışma yarıçapı (NavGrid 0.30 koridor sınırı içinde rahat kayar). */
const RADIUS = 0.24;
/** İlerleme yoksa takılma sayacı eşiği (sn). */
const STUCK_LIMIT = 0.55;
/** Takılan hedefin kara listede kalma süresi (sn). */
const SKIP_DURATION = 12;
const SKIP_SLOTS = 4;

const _freePt = { x: 0, z: 0 };

export class RobotVacuum {
  private readonly root: THREE.Group;
  private readonly world: World;
  x = 0;
  z = 0;
  private tx = 0;
  private tz = 0;
  private angle = 0;
  private retarget = 0;
  private spin = 0;
  private disposed = false;

  /** A* yol noktaları [x0, z0, x1, z1, ...] — GC üretmemek için yeniden kullanılır. */
  private readonly path: number[] = [];
  private pathIndex = 0;

  /** Gerçek yer değiştirme takibi — olduğu yerde patinaj yaparsa hedefi kara listeye alır. */
  private anchorX = 0;
  private anchorZ = 0;
  private stuckTimer = 0;
  private clock = 0;

  /** Takılan hedeflerin geçici kara listesi (sabit boyutlu halka tampon, sıfır tahsis). */
  private readonly skipX = new Float32Array(SKIP_SLOTS);
  private readonly skipZ = new Float32Array(SKIP_SLOTS);
  private readonly skipUntil = new Float32Array(SKIP_SLOTS);
  private skipHead = 0;

  constructor(world: World) {
    this.world = world;
    this.root = buildMesh();
    markDynamic(this.root);
    // Robot mekânın kendi kökünde yaşar: şube değişiminde onunla birlikte
    // gizlenir, `World.dispose` çağrılırsa onunla birlikte sahneden çıkar.
    world.root.add(this.root);

    const start = world.loc.playerStart;
    this.x = start.x;
    this.z = start.z;
    world.nav.resolve(this, RADIUS);
    this.tx = this.x;
    this.tz = this.z;
    this.anchorX = this.x;
    this.anchorZ = this.z;
    this.root.position.set(this.x, 0, this.z);
  }

  /**
   * Bir kare ilerlet. `Game.tick` çağırır; süre yönetimi orada.
   */
  update(dt: number): void {
    if (this.disposed) return;
    const w = this.world;
    const nav = w.nav;
    this.clock += dt;

    // Bölge açılışı veya mobilya yerleşimi robotun üstüne denk geldiyse dışarı çıkar.
    if (nav.solidBlocked(this.x, this.z, RADIUS)) {
      nav.resolve(this, RADIUS);
    }

    this.retarget -= dt;
    const reachedGoal = dist(this.x, this.z, this.tx, this.tz) < ARRIVE;
    const pathDone = this.pathIndex * 2 >= this.path.length;
    if (reachedGoal || pathDone || this.retarget <= 0) {
      this.pickTarget();
      this.retarget = RETARGET;
    }

    const prevX = this.x;
    const prevZ = this.z;

    // --- hareket: A* yol noktalarını slideMove ile takip et ---
    let budget = BALANCE.vacuum.robotSpeed * dt;
    while (budget > 0 && this.pathIndex * 2 < this.path.length) {
      const wx = this.path[this.pathIndex * 2];
      const wz = this.path[this.pathIndex * 2 + 1];
      const dx = wx - this.x;
      const dz = wz - this.z;
      const d = Math.hypot(dx, dz);
      const isLast = (this.pathIndex + 1) * 2 >= this.path.length;
      const reach = isLast ? ARRIVE : WAYPOINT_ARRIVE;

      if (d <= reach) {
        this.pathIndex++;
        continue;
      }

      const step = Math.min(budget, d);
      nav.slideMove(this, (dx / d) * step, (dz / d) * step, RADIUS);
      budget -= step;

      if (dist(this.x, this.z, wx, wz) <= WAYPOINT_ARRIVE && !isLast) {
        this.pathIndex++;
      } else {
        break;
      }
    }

    nav.resolve(this, RADIUS);

    // --- takılma tespiti: gerçek ilerleme yoksa hedefi kara listeye al ve yeni rota kur ---
    if (dist(this.x, this.z, this.anchorX, this.anchorZ) > 0.12) {
      this.anchorX = this.x;
      this.anchorZ = this.z;
      this.stuckTimer = 0;
    } else {
      this.stuckTimer += dt;
      if (this.stuckTimer >= STUCK_LIMIT) {
        this.markSkipped(this.tx, this.tz);
        this.stuckTimer = 0;
        this.anchorX = this.x;
        this.anchorZ = this.z;
        this.pickTarget();
        this.retarget = RETARGET;
      }
    }

    // --- temizlik: geçtiği izi siler ---
    w.grime.cleanStroke(
      prevX,
      prevZ,
      this.x,
      this.z,
      BALANCE.vacuum.robotSweepRadius,
      BALANCE.vacuum.robotSweepRate * dt,
    );

    /**
     * Yerdeki lekeye denk gelirse onu da aşındırır. Ödül oyuncuya
     * ÖDENMEZ: trafik kirinin ve lekenin para karşılığı oyuncunun kendi
     * emeğine aittir (bkz. BALANCE.dirt.busserGrime* gerekçesi). Robot
     * zaman kazandırır, gelir üretmez.
     */
    const sp = w.spills.nearest(this.x, this.z, 0.95, 'robot');
    if (sp) w.spills.erode(sp, dt, 1 / (BALANCE.vacuum.scrubSeconds * 0.5));

    this.root.position.set(this.x, 0, this.z);
    const moveDX = this.x - prevX;
    const moveDZ = this.z - prevZ;
    if (Math.hypot(moveDX, moveDZ) > 0.002) {
      this.angle = angleTowards(this.angle, Math.atan2(moveDX, moveDZ), dt * 10);
    }
    this.spin += dt * 6;
    this.root.rotation.y = wrapAngle(this.angle + Math.sin(this.spin) * 0.04);
  }

  private isSkipped(x: number, z: number): boolean {
    for (let i = 0; i < SKIP_SLOTS; i++) {
      if (this.skipUntil[i] > this.clock && dist(x, z, this.skipX[i], this.skipZ[i]) < 0.85) {
        return true;
      }
    }
    return false;
  }

  private markSkipped(x: number, z: number): void {
    const idx = this.skipHead;
    this.skipX[idx] = x;
    this.skipZ[idx] = z;
    this.skipUntil[idx] = this.clock + SKIP_DURATION;
    this.skipHead = (idx + 1) % SKIP_SLOTS;
  }

  /** Verilen hedefe geçerli bir A* rotası kurmayı dener; başarılıysa hedefi günceller. */
  private tryRouteTo(rawX: number, rawZ: number): boolean {
    const nav = this.world.nav;
    let gx = rawX;
    let gz = rawZ;
    if (nav.isBlocked(gx, gz) || nav.solidBlocked(gx, gz, RADIUS)) {
      if (!nav.nearestFree(gx, gz, _freePt)) return false;
      gx = _freePt.x;
      gz = _freePt.z;
    }
    if (this.isSkipped(gx, gz) || dist(this.x, this.z, gx, gz) < ARRIVE) return false;
    if (!nav.findPath(this.x, this.z, gx, gz, this.path) || this.path.length < 2) {
      return false;
    }
    this.pathIndex = 0;
    this.tx = this.path[this.path.length - 2];
    this.tz = this.path[this.path.length - 1];
    return true;
  }

  /** En yakın erişilebilir leke, en kirli erişilebilir zemin ya da serbest devriye noktası. */
  private pickTarget(): void {
    const w = this.world;

    // 1. Erişilebilir en yakın leke
    const spills = w.spills.list;
    let bestSpill = null;
    let bestDistSq = Infinity;
    for (let i = 0; i < spills.length; i++) {
      const s = spills[i];
      if (s.reservedBy !== null && s.reservedBy !== 'robot') continue;
      if (this.isSkipped(s.x, s.z)) continue;
      const d2 = (s.x - this.x) ** 2 + (s.z - this.z) ** 2;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestSpill = s;
      }
    }
    if (bestSpill && this.tryRouteTo(bestSpill.x, bestSpill.z)) {
      return;
    }
    for (let i = 0; i < spills.length; i++) {
      const s = spills[i];
      if (s === bestSpill || (s.reservedBy !== null && s.reservedBy !== 'robot')) continue;
      if (this.tryRouteTo(s.x, s.z)) return;
    }

    // 2. Erişilebilir en kirli trafik izi (worstSpot kara listedeyse doğrudan ızgaradan seç)
    const spot = w.grime.worstSpot(90);
    if (spot && this.tryRouteTo(spot.x, spot.z)) {
      return;
    }
    const grime = w.grime;
    let bestGrimeIdx = -1;
    let bestGrimeVal = 90;
    for (let i = 0; i < grime.data.length; i++) {
      const v = grime.data[i];
      if (v <= bestGrimeVal) continue;
      const gx = grime.cellX(i % grime.cols);
      const gz = grime.cellZ((i / grime.cols) | 0);
      if (this.isSkipped(gx, gz)) continue;
      bestGrimeVal = v;
      bestGrimeIdx = i;
    }
    if (bestGrimeIdx >= 0) {
      const gx = grime.cellX(bestGrimeIdx % grime.cols);
      const gz = grime.cellZ((bestGrimeIdx / grime.cols) | 0);
      if (this.tryRouteTo(gx, gz)) return;
    }

    // 3. Temizse açık ve yürünebilir zeminde devriye gez (kilitli odaları ve mobilya içini reddet)
    const b = w.loc.bounds;
    for (let attempt = 0; attempt < 16; attempt++) {
      const rx = b.x0 + 1 + Math.random() * Math.max(1, b.x1 - b.x0 - 2);
      const rz = b.z0 + 1 + Math.random() * Math.max(1, b.z1 - b.z0 - 2);
      if (w.nav.isBlocked(rx, rz)) continue;
      if (this.tryRouteTo(rx, rz)) return;
    }

    // Son çare: oyuncu başlangıç noktası
    const start = w.loc.playerStart;
    this.tryRouteTo(start.x, start.z);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      }
    });
  }
}

/**
 * Robotun gövdesi — kodla üretilir (bu projede ikili varlık yoktur).
 * Yassı bir disk, üstünde küçük bir kubbe, önünde fırça şeridi ve mavi
 * bir gösterge ışığı: gerçek robot süpürgelerin silueti.
 */
function buildMesh(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'robot_vacuum';

  const body = new THREE.MeshStandardMaterial({ color: 0x3a4450, roughness: 0.45 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xd8cfbb, roughness: 0.6 });
  const glow = new THREE.MeshStandardMaterial({
    color: 0x6fd6ff,
    emissive: 0x3fb8ff,
    emissiveIntensity: 1.6,
    roughness: 0.3,
  });

  const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.13, 16), body);
  disk.position.y = 0.07;
  g.add(disk);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), trim);
  dome.scale.y = 0.45;
  dome.position.y = 0.15;
  g.add(dome);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), glow);
  eye.position.set(0, 0.15, 0.28);
  g.add(eye);

  // fırça şeridi: önde, zemine değen ince bant
  const brush = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.06), trim);
  brush.position.set(0, 0.015, 0.3);
  g.add(brush);

  return g;
}
