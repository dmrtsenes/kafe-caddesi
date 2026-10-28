import * as THREE from 'three';
import { TAU, clamp01, easeOutCubic } from '../core/MathUtils';
import { cyl, mat, plane, sph, torus } from './Materials';
import { flushInstances, hideInstance, makeInstanced, setInstance, setInstanceQ } from './ProductMesh';

/**
 * Havuzlanmış parçacık sistemi. update() içinde HİÇ tahsis yapmaz;
 * tüm geçici nesneler modül seviyesindedir. Her parçacık türü tek bir
 * InstancedMesh → tür başına 1 çizim çağrısı.
 */

/* ------------------------------------------------------------------ *
 *  Modül seviyesi geçiciler + emoji atlası (bir kez üretilir)
 * ------------------------------------------------------------------ */

const _col = new THREE.Color();
const _q = new THREE.Quaternion();

const COIN_N = 60;
const PUFF_N = 90;
const SPARK_N = 64;
const RING_N = 12;
const EMOTE_N = 16;
const SMOKE_N = 6;
const BUBBLE_N = 64;
const DISH_N = 10;

const ATLAS_PX = 256;
const CELL = 128;

type EmoteKind = 'happy' | 'angry' | 'money' | 'star';
const EMOTE_ORDER: EmoteKind[] = ['happy', 'angry', 'money', 'star'];

let atlasTexture: THREE.CanvasTexture | null = null;
let emoteMaterials: Record<EmoteKind, THREE.MeshBasicMaterial> | null = null;
let starTexture: THREE.Texture | null = null;

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function buildAtlas(): void {
  const cv = document.createElement('canvas');
  cv.width = ATLAS_PX;
  cv.height = ATLAS_PX;
  const ctx = cv.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, ATLAS_PX, ATLAS_PX);

    // 0 — mutlu (sol üst)
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(64, 64, 46, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2b1d10';
    ctx.beginPath();
    ctx.arc(50, 54, 7, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(78, 54, 7, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#2b1d10';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(64, 68, 20, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();

    // 1 — kızgın (sağ üst)
    ctx.fillStyle = '#e2453a';
    star(ctx, 64 + CELL, 64, 50, 0.72);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 68px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 64 + CELL, 66);

    // 2 — para (sol alt)
    ctx.fillStyle = '#ffc84a';
    ctx.beginPath();
    ctx.arc(64, 64 + CELL, 46, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8a5a12';
    ctx.font = '700 66px system-ui, sans-serif';
    ctx.fillText('₺', 64, 66 + CELL);

    // 3 — yıldız (sağ alt)
    ctx.fillStyle = '#ffe38a';
    star(ctx, 64 + CELL, 64 + CELL, 54, 0.45);
    ctx.fillStyle = '#fffdf0';
    star(ctx, 64 + CELL, 64 + CELL, 30, 0.45);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  atlasTexture = tex;

  const mats = {} as Record<EmoteKind, THREE.MeshBasicMaterial>;
  for (let i = 0; i < 4; i++) {
    const kind = EMOTE_ORDER[i];
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(0.5, 0.5);
    t.offset.set((i % 2) * 0.5, i < 2 ? 0.5 : 0);
    mats[kind] = new THREE.MeshBasicMaterial({
      map: t,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      side: THREE.DoubleSide,
      // Flat billboard: one visible face, so three's two-sided transparent
      // pass (two program re-resolves per draw) adds nothing.
      forceSinglePass: true,
    });
    if (kind === 'star') starTexture = t;
  }
  emoteMaterials = mats;
}

function atlasMaterials(): Record<EmoteKind, THREE.MeshBasicMaterial> {
  if (!emoteMaterials) buildAtlas();
  return emoteMaterials as Record<EmoteKind, THREE.MeshBasicMaterial>;
}

/* ------------------------------------------------------------------ *
 *  Parçacık kayıtları
 * ------------------------------------------------------------------ */

interface Particle {
  on: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  life: number;
  s0: number;
  s1: number;
  a: number;
  av: number;
  color: number;
}

function newParticle(): Particle {
  return { on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, life: 1, s0: 1, s1: 1, a: 0, av: 0, color: 0xffffff };
}

interface EmoteSlot {
  m: THREE.Mesh;
  on: boolean;
  x: number;
  y: number;
  z: number;
  t: number;
  life: number;
}

interface SmokeSrc {
  on: boolean;
  x: number;
  y: number;
  z: number;
  ttl: number;
  acc: number;
}

interface DishFlight {
  on: boolean;
  x0: number;
  y0: number;
  z0: number;
  tx: number;
  ty: number;
  tz: number;
  t: number;
  life: number;
  peakH: number;
  rx: number;
  ry: number;
  rz: number;
}

export interface VFXSystem {
  root: THREE.Group;
  coinBurst(x: number, y: number, z: number, count?: number): void;
  puff(x: number, y: number, z: number, color: number, count?: number): void;
  sparkle(x: number, y: number, z: number, color: number): void;
  /** Çoklu parıltı çeşmesi (temizlik doruk anı). */
  sparkleBurst(x: number, y: number, z: number, count?: number, color?: number): void;
  /** Masadan ele uçan tabak yayı (dish pick-up lerp arc). */
  flyDish(x0: number, y0: number, z0: number, tx: number, ty: number, tz: number): void;
  /** Temizlik sabun köpüğü / baloncuk patlaması (Clean It hissi). */
  foamBurst(x: number, y: number, z: number, count?: number): void;
  /** Yükseltme/açılış halkası. */
  ring(x: number, y: number, z: number, color: number, maxRadius?: number): void;
  /** Arıza dumanı için sürekli kaynak. */
  smoke(x: number, y: number, z: number): void;
  /** Kalp / öfke bulutu gibi ikonlu pop. */
  emote(x: number, y: number, z: number, kind: 'happy' | 'angry' | 'money' | 'star'): void;
  hasLive(): boolean;
  update(dt: number, cameraQuat: THREE.Quaternion): void;
  dispose(): void;
}

export function createVFX(): VFXSystem {
  const root = new THREE.Group();
  root.name = 'vfx';
  const emoteMats = atlasMaterials();

  /* --- kendi ürettiğimiz (önbellek dışı) malzemeler --- */
  const sparkMat = new THREE.MeshBasicMaterial({
    map: starTexture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  const ringMat = new THREE.MeshBasicMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const bubbleMat = new THREE.MeshBasicMaterial({
    color: 0xebffff,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    toneMapped: false,
  });
  const ownMaterials: THREE.Material[] = [sparkMat, ringMat, bubbleMat];

  /* --- havuzlar --- */
  const coinMesh = makeInstanced(cyl(0.08, 0.08, 0.024, 8), mat(0xffc84a, { rough: 0.32, metal: 0.5, emissive: 0x6a4a00, emissiveIntensity: 0.5 }), COIN_N);
  const puffMesh = makeInstanced(sph(0.14, 8, 6), mat(0xffffff, { rough: 1, transparent: true, opacity: 0.78, depthWrite: false }), PUFF_N);
  const sparkMesh = makeInstanced(plane(0.34, 0.34), sparkMat, SPARK_N);
  const ringMesh = makeInstanced(torus(1, 0.04, 5, 26), ringMat, RING_N);
  const bubbleMesh = makeInstanced(sph(0.065, 8, 6), bubbleMat, BUBBLE_N);
  const dishMesh = makeInstanced(cyl(0.13, 0.105, 0.025, 10), mat(0xf3efe6, { rough: 0.45 }), DISH_N);

  puffMesh.renderOrder = 3;
  sparkMesh.renderOrder = 4;
  ringMesh.renderOrder = 4;
  bubbleMesh.renderOrder = 5;
  dishMesh.renderOrder = 5;
  // Parçacıklar zaten hep aksiyonun (ve kameranın) yanında — her kare
  // sınır küresi hesaplamaya gerek yok.
  coinMesh.frustumCulled = false;
  puffMesh.frustumCulled = false;
  sparkMesh.frustumCulled = false;
  ringMesh.frustumCulled = false;
  bubbleMesh.frustumCulled = false;
  dishMesh.frustumCulled = false;

  root.add(coinMesh, puffMesh, sparkMesh, ringMesh, bubbleMesh, dishMesh);

  const coins: Particle[] = [];
  const puffs: Particle[] = [];
  const sparks: Particle[] = [];
  const rings: Particle[] = [];
  const bubbles: Particle[] = [];
  const dishes: DishFlight[] = [];
  for (let i = 0; i < COIN_N; i++) coins.push(newParticle());
  for (let i = 0; i < PUFF_N; i++) puffs.push(newParticle());
  for (let i = 0; i < SPARK_N; i++) sparks.push(newParticle());
  for (let i = 0; i < RING_N; i++) rings.push(newParticle());
  for (let i = 0; i < BUBBLE_N; i++) bubbles.push(newParticle());
  for (let i = 0; i < DISH_N; i++) {
    dishes.push({ on: false, x0: 0, y0: 0, z0: 0, tx: 0, ty: 0, tz: 0, t: 0, life: 0.28, peakH: 0.38, rx: 0, ry: 0, rz: 0 });
  }

  // instanceColor tamponlarını baştan ayır
  _col.setHex(0xffffff);
  for (let i = 0; i < PUFF_N; i++) puffMesh.setColorAt(i, _col);
  for (let i = 0; i < SPARK_N; i++) sparkMesh.setColorAt(i, _col);
  for (let i = 0; i < RING_N; i++) ringMesh.setColorAt(i, _col);
  if (puffMesh.instanceColor) puffMesh.instanceColor.needsUpdate = true;
  if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;
  if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;

  /* --- emote havuzu (ayrı meshler: 4 farklı doku hücresi) --- */
  const emotes: EmoteSlot[] = [];
  const emoteGeo = plane(0.62, 0.62);
  for (let i = 0; i < EMOTE_N; i++) {
    const m = new THREE.Mesh(emoteGeo, emoteMats.happy);
    m.castShadow = false;
    m.receiveShadow = false;
    m.visible = false;
    m.renderOrder = 6;
    m.frustumCulled = false;
    root.add(m);
    emotes.push({ m, on: false, x: 0, y: 0, z: 0, t: 0, life: 1 });
  }

  const smokes: SmokeSrc[] = [];
  for (let i = 0; i < SMOKE_N; i++) smokes.push({ on: false, x: 0, y: 0, z: 0, ttl: 0, acc: 0 });

  let coinLive = 0;
  let puffLive = 0;
  let sparkLive = 0;
  let ringLive = 0;
  let bubbleLive = 0;
  let dishLive = 0;

  function freeSlot(list: Particle[]): Particle | null {
    for (let i = 0; i < list.length; i++) if (!list[i].on) return list[i];
    return null;
  }

  /* ---------------- genel API ---------------- */

  function coinBurst(x: number, y: number, z: number, count = 8): void {
    for (let i = 0; i < count; i++) {
      const p = freeSlot(coins);
      if (!p) return;
      const a = Math.random() * TAU;
      const sp = 1.1 + Math.random() * 1.5;
      p.on = true;
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = 3.1 + Math.random() * 1.9;
      p.t = 0;
      p.life = 0.85 + Math.random() * 0.35;
      p.s0 = 0.9 + Math.random() * 0.35;
      p.s1 = p.s0;
      p.a = Math.random() * TAU;
      p.av = 9 + Math.random() * 7;
      coinLive++;
    }
  }

  function spawnPuff(
    x: number,
    y: number,
    z: number,
    color: number,
    size: number,
    life: number,
    vy: number,
    drift: number,
  ): void {
    const p = freeSlot(puffs);
    if (!p) return;
    const a = Math.random() * TAU;
    p.on = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = Math.cos(a) * drift;
    p.vz = Math.sin(a) * drift;
    p.vy = vy;
    p.t = 0;
    p.life = life;
    p.s0 = size * 0.35;
    p.s1 = size;
    p.color = color;
    puffLive++;
  }

  function puff(x: number, y: number, z: number, color: number, count = 5): void {
    for (let i = 0; i < count; i++) {
      spawnPuff(
        x + (Math.random() - 0.5) * 0.24,
        y + (Math.random() - 0.5) * 0.2,
        z + (Math.random() - 0.5) * 0.24,
        color,
        0.75 + Math.random() * 0.6,
        0.45 + Math.random() * 0.3,
        0.9 + Math.random() * 0.7,
        0.5,
      );
    }
  }

  function sparkle(x: number, y: number, z: number, color: number): void {
    for (let i = 0; i < 4; i++) {
      const p = freeSlot(sparks);
      if (!p) return;
      const a = Math.random() * TAU;
      p.on = true;
      p.x = x + (Math.random() - 0.5) * 0.3;
      p.y = y + (Math.random() - 0.5) * 0.25;
      p.z = z + (Math.random() - 0.5) * 0.3;
      p.vx = Math.cos(a) * 0.7;
      p.vz = Math.sin(a) * 0.7;
      p.vy = 1.15 + Math.random() * 0.7;
      p.t = 0;
      p.life = 0.5 + Math.random() * 0.28;
      p.s0 = 0.35 + Math.random() * 0.45;
      p.s1 = p.s0;
      p.color = color;
      sparkLive++;
    }
  }

  function sparkleBurst(x: number, y: number, z: number, count = 10, color = 0xffe066): void {
    for (let i = 0; i < count; i++) {
      const p = freeSlot(sparks);
      if (!p) return;
      const a = Math.random() * TAU;
      const sp = 0.8 + Math.random() * 1.6;
      p.on = true;
      p.x = x + (Math.random() - 0.5) * 0.22;
      p.y = y + (Math.random() - 0.5) * 0.16;
      p.z = z + (Math.random() - 0.5) * 0.22;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = 1.3 + Math.random() * 1.7;
      p.t = 0;
      p.life = 0.55 + Math.random() * 0.32;
      p.s0 = 0.45 + Math.random() * 0.45;
      p.s1 = p.s0;
      p.color = color;
      sparkLive++;
    }
  }

  function flyDish(x0: number, y0: number, z0: number, tx: number, ty: number, tz: number): void {
    for (let i = 0; i < DISH_N; i++) {
      const p = dishes[i];
      if (!p.on) {
        p.on = true;
        p.x0 = x0;
        p.y0 = y0;
        p.z0 = z0;
        p.tx = tx;
        p.ty = ty;
        p.tz = tz;
        p.t = 0;
        p.life = 0.26 + Math.random() * 0.05;
        p.peakH = 0.35 + Math.random() * 0.1;
        p.rx = Math.random() * 0.3;
        p.ry = Math.random() * TAU;
        p.rz = Math.random() * 0.3;
        dishLive++;
        return;
      }
    }
  }

  function foamBurst(x: number, y: number, z: number, count = 4): void {
    for (let i = 0; i < count; i++) {
      const p = freeSlot(bubbles);
      if (!p) return;
      const a = Math.random() * TAU;
      const sp = 0.28 + Math.random() * 0.42;
      p.on = true;
      p.x = x + (Math.random() - 0.5) * 0.24;
      p.y = y + 0.03;
      p.z = z + (Math.random() - 0.5) * 0.24;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = 0.8 + Math.random() * 0.6;
      p.t = 0;
      p.life = 0.35 + Math.random() * 0.28;
      p.s0 = 0.25 + Math.random() * 0.3;
      p.s1 = 0.95 + Math.random() * 0.35;
      bubbleLive++;
    }
  }

  function ring(x: number, y: number, z: number, color: number, maxRadius = 2): void {
    const p = freeSlot(rings);
    if (!p) return;
    p.on = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.t = 0;
    p.life = 0.72;
    p.s0 = 0.12;
    p.s1 = maxRadius;
    p.color = color;
    ringLive++;
  }

  function smoke(x: number, y: number, z: number): void {
    for (let i = 0; i < SMOKE_N; i++) {
      const s = smokes[i];
      if (s.on && Math.abs(s.x - x) < 0.4 && Math.abs(s.y - y) < 0.4 && Math.abs(s.z - z) < 0.4) {
        s.ttl = 0.3;
        return;
      }
    }
    for (let i = 0; i < SMOKE_N; i++) {
      const s = smokes[i];
      if (!s.on) {
        s.on = true;
        s.x = x;
        s.y = y;
        s.z = z;
        s.ttl = 0.3;
        s.acc = 0.14;
        return;
      }
    }
  }

  function emote(x: number, y: number, z: number, kind: EmoteKind): void {
    for (let i = 0; i < EMOTE_N; i++) {
      const e = emotes[i];
      if (e.on) continue;
      e.on = true;
      e.x = x;
      e.y = y;
      e.z = z;
      e.t = 0;
      e.life = 1.05;
      e.m.material = emoteMats[kind];
      e.m.visible = true;
      e.m.position.set(x, y, z);
      e.m.scale.setScalar(0.01);
      return;
    }
  }

  /* ---------------- güncelleme ---------------- */

  function update(dt: number, cameraQuat: THREE.Quaternion): void {
    // --- paralar ---
    if (coinLive > 0) {
      let maxIdx = -1;
      for (let i = 0; i < COIN_N; i++) {
        const p = coins[i];
        if (!p.on) continue;
        p.t += dt;
        if (p.t >= p.life) {
          p.on = false;
          coinLive--;
          hideInstance(coinMesh, i);
          continue;
        }
        maxIdx = i;
        p.vy -= 9.6 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.a += p.av * dt;
        const k = p.t / p.life;
        const s = p.s0 * (k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1);
        setInstance(coinMesh, i, p.x, p.y, p.z, p.a * 0.6, p.a, 0.5, s);
      }
      coinMesh.count = maxIdx + 1;
      flushInstances(coinMesh);
    }
    coinMesh.visible = coinLive > 0;

    // --- duman kaynakları ---
    for (let i = 0; i < SMOKE_N; i++) {
      const s = smokes[i];
      if (!s.on) continue;
      s.ttl -= dt;
      s.acc += dt;
      while (s.acc >= 0.15) {
        s.acc -= 0.15;
        spawnPuff(
          s.x + (Math.random() - 0.5) * 0.16,
          s.y,
          s.z + (Math.random() - 0.5) * 0.16,
          0x8d949a,
          0.85 + Math.random() * 0.4,
          1.15,
          0.75,
          0.16,
        );
      }
      if (s.ttl <= 0) s.on = false;
    }

    // --- puflar ---
    if (puffLive > 0) {
      let maxIdx = -1;
      for (let i = 0; i < PUFF_N; i++) {
        const p = puffs[i];
        if (!p.on) continue;
        p.t += dt;
        if (p.t >= p.life) {
          p.on = false;
          puffLive--;
          hideInstance(puffMesh, i);
          continue;
        }
        maxIdx = i;
        p.vy *= 1 - 0.6 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vx *= 1 - 1.8 * dt;
        p.vz *= 1 - 1.8 * dt;
        const k = p.t / p.life;
        const grow = p.s0 + (p.s1 - p.s0) * easeOutCubic(k);
        const fade = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
        setInstance(puffMesh, i, p.x, p.y, p.z, 0, p.a, 0, grow * fade);
        _col.setHex(p.color);
        puffMesh.setColorAt(i, _col);
      }
      puffMesh.count = maxIdx + 1;
      flushInstances(puffMesh);
      if (puffMesh.instanceColor) puffMesh.instanceColor.needsUpdate = true;
    }
    puffMesh.visible = puffLive > 0;

    // --- kıvılcımlar (billboard) ---
    if (sparkLive > 0) {
      let maxIdx = -1;
      for (let i = 0; i < SPARK_N; i++) {
        const p = sparks[i];
        if (!p.on) continue;
        p.t += dt;
        if (p.t >= p.life) {
          p.on = false;
          sparkLive--;
          hideInstance(sparkMesh, i);
          continue;
        }
        maxIdx = i;
        p.vy -= 1.2 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const k = p.t / p.life;
        const fade = 1 - k;
        setInstanceQ(sparkMesh, i, p.x, p.y, p.z, cameraQuat, p.s0 * (0.6 + fade * 0.6));
        _col.setHex(p.color).multiplyScalar(0.25 + fade * 0.95);
        sparkMesh.setColorAt(i, _col);
      }
      sparkMesh.count = maxIdx + 1;
      flushInstances(sparkMesh);
      if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;
    }
    sparkMesh.visible = sparkLive > 0;

    // --- halkalar ---
    if (ringLive > 0) {
      let maxIdx = -1;
      for (let i = 0; i < RING_N; i++) {
        const p = rings[i];
        if (!p.on) continue;
        p.t += dt;
        if (p.t >= p.life) {
          p.on = false;
          ringLive--;
          hideInstance(ringMesh, i);
          continue;
        }
        maxIdx = i;
        const k = p.t / p.life;
        const r = p.s0 + (p.s1 - p.s0) * easeOutCubic(k);
        setInstance(ringMesh, i, p.x, p.y, p.z, -Math.PI / 2, 0, 0, r, r, r);
        _col.setHex(p.color).multiplyScalar(clamp01(1 - k) * 1.1);
        ringMesh.setColorAt(i, _col);
      }
      ringMesh.count = maxIdx + 1;
      flushInstances(ringMesh);
      if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
    }
    ringMesh.visible = ringLive > 0;

    // --- sabun köpüğü / baloncuklar (Clean It tatmini) ---
    if (bubbleLive > 0) {
      let maxIdx = -1;
      for (let i = 0; i < BUBBLE_N; i++) {
        const p = bubbles[i];
        if (!p.on) continue;
        p.t += dt;
        if (p.t >= p.life) {
          p.on = false;
          bubbleLive--;
          hideInstance(bubbleMesh, i);
          continue;
        }
        maxIdx = i;
        p.vy *= 1 - 0.5 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vx *= 1 - 1.2 * dt;
        p.vz *= 1 - 1.2 * dt;
        const k = p.t / p.life;
        // İlk %35'te kabarır, %85'e kadar hafif salınır, son %15'te anlık "pop" yapar
        const s = k < 0.35
          ? p.s0 + (p.s1 - p.s0) * (k / 0.35)
          : k < 0.85
          ? p.s1 * (1 + 0.08 * Math.sin(k * 22))
          : p.s1 * (1 + 0.35 * ((k - 0.85) / 0.15));
        const fade = k < 0.85 ? 1 : 1 - (k - 0.85) / 0.15;
        setInstance(bubbleMesh, i, p.x, p.y, p.z, 0, 0, 0, s * fade);
      }
      bubbleMesh.count = maxIdx + 1;
      flushInstances(bubbleMesh);
    }
    bubbleMesh.visible = bubbleLive > 0;

    // --- uçan tabaklar (lerp arc) ---
    if (dishLive > 0) {
      let maxIdx = -1;
      for (let i = 0; i < DISH_N; i++) {
        const p = dishes[i];
        if (!p.on) continue;
        p.t += dt;
        if (p.t >= p.life) {
          p.on = false;
          dishLive--;
          hideInstance(dishMesh, i);
          spawnPuff(p.tx, p.ty, p.tz, 0xffffff, 0.2, 0.3, 0.4, 0.06);
          continue;
        }
        maxIdx = i;
        const k = clamp01(p.t / p.life);
        const ek = easeOutCubic(k);
        const x = p.x0 + (p.tx - p.x0) * ek;
        const z = p.z0 + (p.tz - p.z0) * ek;
        const y = p.y0 + (p.ty - p.y0) * ek + Math.sin(k * Math.PI) * p.peakH;
        p.ry += 14 * dt;
        p.rx += 5 * dt;
        const scale = 1.0 - k * 0.22;
        setInstance(dishMesh, i, x, y, z, p.rx, p.ry, p.rz, scale, scale, scale);
      }
      dishMesh.count = maxIdx + 1;
      flushInstances(dishMesh);
    }
    dishMesh.visible = dishLive > 0;

    // --- emoteler (billboard) ---
    for (let i = 0; i < EMOTE_N; i++) {
      const e = emotes[i];
      if (!e.on) continue;
      e.t += dt;
      if (e.t >= e.life) {
        e.on = false;
        e.m.visible = false;
        continue;
      }
      const k = e.t / e.life;
      e.y += (1.05 - k * 0.7) * dt;
      const pop = k < 0.18 ? easeOutCubic(k / 0.18) * 1.14 : 1.14 - Math.min(1, (k - 0.18) / 0.82) * 0.2;
      const out = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      e.m.position.set(e.x, e.y, e.z);
      e.m.quaternion.copy(cameraQuat);
      e.m.scale.setScalar(pop * out);
    }
  }

  function dispose(): void {
    root.removeFromParent();
    coinMesh.dispose();
    puffMesh.dispose();
    sparkMesh.dispose();
    ringMesh.dispose();
    bubbleMesh.dispose();
    dishMesh.dispose();
    for (const m of ownMaterials) m.dispose();
    root.clear();
  }

  function hasLive(): boolean {
    if (coinLive > 0 || puffLive > 0 || sparkLive > 0 || ringLive > 0 || bubbleLive > 0 || dishLive > 0) return true;
    for (let i = 0; i < EMOTE_N; i++) if (emotes[i].on) return true;
    for (let i = 0; i < SMOKE_N; i++) if (smokes[i].on) return true;
    return false;
  }

  return { root, coinBurst, puff, sparkle, sparkleBurst, flyDish, foamBurst, ring, smoke, emote, hasLive, update, dispose };
}

/** Uygulama kapanışında atlas dokusunu bırakır (modül ömürlü tekil kaynak). */
export function disposeVFXAtlas(): void {
  if (emoteMaterials) {
    for (const k of EMOTE_ORDER) {
      const m = emoteMaterials[k];
      if (m.map) m.map.dispose();
      m.dispose();
    }
    emoteMaterials = null;
  }
  if (atlasTexture) {
    atlasTexture.dispose();
    atlasTexture = null;
  }
  starTexture = null;
}
