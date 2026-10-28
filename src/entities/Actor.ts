import * as THREE from 'three';
import type { CharacterHandle } from '../chars/types';
import type { NavGrid } from '../sim/Navigation';
import { angleTowards, damp, dist, wrapAngle } from '../core/MathUtils';

const _tmp = { x: 0, z: 0 };

/**
 * Yol takip eden ortak taban. Karakter rig'ini konumlandırır,
 * gerçek yatay hızı hesaplayıp animatöre verir.
 */
export class Actor {
  x = 0;
  z = 0;
  angle = 0;
  speed = 4;
  /** Ölçülen gerçek hız — animasyon buna göre idle/walk seçer. */
  planarSpeed = 0;
  /** Önceki karenin bakış açısı — viraja yatış dönüş hızını bundan türetir. */
  private leanPrevAngle = 0;

  readonly char: CharacterHandle;
  protected path: number[] = [];
  protected pathIndex = 0;
  protected repathTimer = 0;
  protected targetX = 0;
  protected targetZ = 0;
  hasTarget = false;

  constructor(char: CharacterHandle) {
    this.char = char;
  }

  setPosition(x: number, z: number): void {
    this.x = x;
    this.z = z;
    this.char.root.position.set(x, 0, z);
    this.path.length = 0;
    this.pathIndex = 0;
    this.hasTarget = false;
  }

  /** Hedefe yol kur. Aynı hedefe tekrar çağırmak ucuzdur. */
  moveTo(nav: NavGrid, x: number, z: number, force = false): void {
    if (!force && this.hasTarget && dist(this.targetX, this.targetZ, x, z) < 0.35) return;
    this.targetX = x;
    this.targetZ = z;
    this.hasTarget = true;
    this.repath(nav);
  }

  /**
   * Mevcut hedefi KORUYARAK yolu yeniden kur. Izgara değiştiğinde
   * (bölge açılışı) `stop()` çağırmak `arrived`'ı anında true yapıyordu:
   * masaya yürüyen misafir sandalyeye ışınlanıyor, çıkışa yürüyen
   * misafir salonun ortasında yok oluyordu. Hedef dururken yol tazelenir.
   */
  replan(nav: NavGrid): void {
    if (this.hasTarget) this.repath(nav);
  }

  /**
   * `replan` without the same-frame search: the path is refreshed within
   * `delay` seconds by the regular repath timer. Body collision already uses
   * the new solids, so the short wait never walks through new furniture.
   */
  scheduleReplan(delay: number): void {
    if (this.hasTarget && this.repathTimer > delay) this.repathTimer = delay;
  }

  protected repath(nav: NavGrid): void {
    this.path.length = 0;
    this.pathIndex = 0;
    nav.resolve(this, 0.3);
    nav.findPath(this.x, this.z, this.targetX, this.targetZ, this.path);
    this.repathTimer = 1.4 + Math.random() * 0.6;
  }

  stop(): void {
    this.path.length = 0;
    this.pathIndex = 0;
    this.hasTarget = false;
    this.vel = 0;
  }

  get distanceToTarget(): number {
    return this.hasTarget ? dist(this.x, this.z, this.targetX, this.targetZ) : 0;
  }

  get arrived(): boolean {
    return !this.hasTarget;
  }

  /** Komut hızı — ivmeli kalkış ve varışta yavaşlama için (u/sn). */
  protected vel = 0;

  /** Yolu ilerlet. Dönen değer: bu karede alınan mesafe. */
  protected advance(dt: number, nav: NavGrid, arriveDist: number): number {
    if (!this.hasTarget) {
      // Dururken hız komutu söner; animatör kalan planarSpeed'i yumuşakça indirir.
      this.vel = 0;
      this.planarSpeed = damp(this.planarSpeed, 0, 14, dt);
      if (this.planarSpeed < 0.02) this.planarSpeed = 0;
      return 0;
    }

    this.repathTimer -= dt;
    if (this.repathTimer <= 0) this.repath(nav);

    const startX = this.x;
    const startZ = this.z;

    /**
     * İVME MODELİ. Eskiden `budget = speed * dt` idi: karakter ilk karede
     * tam hızda fırlıyor, son karede tam hızdan taş gibi duruyordu —
     * "stop-motion kukla" hissinin ana kaynağı. Şimdi:
     *  - kalkış: hız komutu λ=12 ile tam hıza tırmanır (~0,2 sn),
     *  - varış: kalan mesafeye göre v = √(2·a·d) eğrisiyle iner
     *    (a≈9 u/sn²), tabanı 0,9 u/sn — asimptota takılıp hedefe
     *    varamama riski yok, çünkü yarıçapa bu hızla kesin girilir.
     */
    const remaining = dist(this.x, this.z, this.targetX, this.targetZ);
    const slow = Math.sqrt(Math.max(0, 2 * 9 * (remaining - arriveDist + 0.15)));
    const targetSpeed = Math.min(this.speed, Math.max(0.9, slow));
    this.vel = Math.min(damp(this.vel, targetSpeed, 12, dt), targetSpeed);
    let budget = this.vel * dt;

    while (budget > 0 && this.pathIndex * 2 < this.path.length) {
      const wx = this.path[this.pathIndex * 2];
      const wz = this.path[this.pathIndex * 2 + 1];
      const dx = wx - this.x;
      const dz = wz - this.z;
      const d = Math.hypot(dx, dz);
      const isLast = (this.pathIndex + 1) * 2 >= this.path.length;
      const reach = isLast ? arriveDist : 0.04;

      if (d <= reach) {
        this.pathIndex++;
        if (isLast) {
          // A path ending at a nearby free cell is not arrival at a blocked goal.
          if (this.distanceToTarget <= arriveDist) this.hasTarget = false;
          break;
        }
        continue;
      }

      const step = Math.min(budget, d);
      nav.slideMove(this, (dx / d) * step, (dz / d) * step, 0.3);
      budget -= step;

      if (dist(this.x, this.z, wx, wz) <= 1e-4 && !isLast) this.pathIndex++;
      else break;
    }

    /**
     * Yön, çarpışma çözülmeden ÖNCEKİ yol-takip vektöründen okunur.
     * resolve() itmesi de vektöre karışınca karakter mobilyaya sıkışınca
     * duvara dönüp seğiriyordu.
     */
    const pathDX = this.x - startX;
    const pathDZ = this.z - startZ;

    /**
     * 0,3 = chibi gövdenin gerçek yarıçapı. Eski 0,42 ızgara çarpışmasına
     * göre ayarlanmıştı; gövde kutuları gerçek ölçüye inince aynı değer
     * misafiri sandalyesinden (1,05) dışarı itiyordu.
     */
    nav.resolve(this, 0.3);

    const moved = dist(startX, startZ, this.x, this.z);
    const inst = dt > 0 ? moved / dt : 0;
    // Tek, kare hızından bağımsız filtre (eski `dt*14` lerp'i 30 fps'te
    // iki kat gevşiyordu ve animatördeki ikinci filtreyle üst üste binince
    // duran karakter ~0,3 sn yerinde yürüyordu).
    this.planarSpeed = damp(this.planarSpeed, Math.min(inst, this.vel + 0.6), 16, dt);

    if (Math.hypot(pathDX, pathDZ) > 0.004) {
      const desired = Math.atan2(pathDX, pathDZ);
      this.angle = angleTowards(this.angle, desired, dt * 12);
    }
    return moved;
  }

  /**
   * Bu karedeki dönüş hızı (rad/sn) — `char.update`in üçüncü parametresi.
   * Çağıran her karede TAM BİR KEZ çağırmalı (iki kez çağırmak farkı
   * sıfırlar); animatör hedefi zaten kelepçeleyip süzdüğü için ekran-dışı
   * atlanan karelerden dönen büyük açı farkları tepe yapmaz.
   */
  protected turnRate(dt: number): number {
    const delta = wrapAngle(this.angle - this.leanPrevAngle);
    this.leanPrevAngle = this.angle;
    return dt > 0 ? delta / dt : 0;
  }

  /** Belirli bir yöne bak (kasada, istasyonda çalışırken). */
  faceTowards(x: number, z: number, dt: number, rate = 9): void {
    const dx = x - this.x;
    const dz = z - this.z;
    if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return;
    this.angle = angleTowards(this.angle, Math.atan2(dx, dz), dt * rate);
  }

  /**
   * GÖRSEL zemin kotu (yükseltilmiş oda). Navigasyon iki boyutludur; bu
   * değer yalnız çizime girer. Sahibi (World) her karede yumuşatarak
   * yazar — merdivenden çıkarken karakter zıplamasın.
   */
  floorY = 0;

  protected syncTransform(): void {
    this.char.root.position.x = this.x;
    this.char.root.position.z = this.z;
    this.char.root.position.y = this.floorY;
    this.char.root.rotation.y = wrapAngle(this.angle);
  }

  distanceTo(x: number, z: number): number {
    return dist(this.x, this.z, x, z);
  }

  addTo(parent: THREE.Object3D): void {
    parent.add(this.char.root);
  }

  dispose(): void {
    this.char.dispose();
  }
}

export { _tmp as scratchPoint };
