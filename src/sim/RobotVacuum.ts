import * as THREE from 'three';
import { BALANCE } from '../data/balance';
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
 *
 * Hareket bilinçli olarak BASİT: en kirli noktaya doğru düz gider. A*
 * kullanmaz çünkü robot bir aktör değil bir efekttir; duvara denk gelirse
 * hedefini değiştirir. Karmaşık dolaşım burada görünür bir fayda üretmez,
 * yalnız hata yüzeyi açar.
 */

/* Temizlik gücü ve tempo merkezî dengede: ayarlanabilir ve ölçülebilir
 * olmalı (bkz. BALANCE.vacuum.robot*). */
/** Hedefe bu kadar yaklaşınca "vardı" sayılır. */
const ARRIVE = 0.45;
/** Hedef en fazla bu kadar sürede yenilenir (sn) — takılmaya karşı. */
const RETARGET = 4;

export class RobotVacuum {
  private readonly root: THREE.Group;
  private readonly world: World;
  private x = 0;
  private z = 0;
  private tx = 0;
  private tz = 0;
  private retarget = 0;
  private spin = 0;
  private disposed = false;

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
    this.tx = this.x;
    this.tz = this.z;
    this.root.position.set(this.x, 0, this.z);
  }

  /**
   * Bir kare ilerlet. `Game.tick` çağırır; süre yönetimi orada.
   */
  update(dt: number): void {
    if (this.disposed) return;
    const w = this.world;

    this.retarget -= dt;
    const varmis = Math.hypot(this.tx - this.x, this.tz - this.z) < ARRIVE;
    if (varmis || this.retarget <= 0) {
      this.pickTarget();
      this.retarget = RETARGET;
    }

    // --- hareket: hedefe doğru düz ---
    const dx = this.tx - this.x;
    const dz = this.tz - this.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.001) {
      const step = Math.min(d, BALANCE.vacuum.robotSpeed * dt);
      const nx = this.x + (dx / d) * step;
      const nz = this.z + (dz / d) * step;
      /**
       * Duvar/istasyon gövdesine girme. Robot bir aktör olmadığı için
       * `nav.resolve` ile itilmez; engel varsa yeni hedef arar. Böylece
       * kenarda titreme (bu projede aktörlerde defalarca görülen hata
       * sınıfı) burada yapısal olarak imkânsız.
       */
      if (!w.nav.solidBlocked(nx, nz, 0.22)) {
        this.x = nx;
        this.z = nz;
      } else {
        this.retarget = 0;
      }
    }

    // --- temizlik: geçtiği izi siler ---
    const before = this.root.position;
    w.grime.cleanStroke(before.x, before.z, this.x, this.z, BALANCE.vacuum.robotSweepRadius, BALANCE.vacuum.robotSweepRate * dt);

    /**
     * Yerdeki lekeye denk gelirse onu da aşındırır. Ödül oyuncuya
     * ÖDENMEZ: trafik kirinin ve lekenin para karşılığı oyuncunun kendi
     * emeğine aittir (bkz. BALANCE.dirt.busserGrime* gerekçesi). Robot
     * zaman kazandırır, gelir üretmez.
     */
    const sp = w.spills.nearest(this.x, this.z, 0.9, 'robot');
    if (sp) w.spills.erode(sp, dt, 1 / (BALANCE.vacuum.scrubSeconds * 0.5));

    this.root.position.set(this.x, 0, this.z);
    this.spin += dt * 6;
    this.root.rotation.y = Math.atan2(dx, dz) + Math.sin(this.spin) * 0.05;
  }

  /** En kirli yer ya da en yakın leke; ikisi de yoksa rastgele gezin. */
  private pickTarget(): void {
    const w = this.world;
    const sp = w.spills.nearest(this.x, this.z, 999, 'robot');
    if (sp) {
      this.tx = sp.x;
      this.tz = sp.z;
      return;
    }
    const spot = w.grime.worstSpot(90);
    if (spot) {
      this.tx = spot.x;
      this.tz = spot.z;
      return;
    }
    // Temizse mekânda dolaş: durup bekleyen robot "bozuk" okunur.
    const b = w.loc.bounds;
    this.tx = b.x0 + Math.random() * (b.x1 - b.x0);
    this.tz = b.z0 + Math.random() * (b.z1 - b.z0);
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
