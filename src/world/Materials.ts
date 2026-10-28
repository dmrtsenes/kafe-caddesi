import * as THREE from 'three';

/**
 * Paylaşılan malzeme + geometri önbelleği.
 * Tüm 3D modüller SADECE buradan malzeme/geometri almalı — aksi halde
 * draw-call ve GPU bellek patlar.
 */

const matCache = new Map<string, THREE.MeshStandardMaterial>();
const geoCache = new Map<string, THREE.BufferGeometry>();

export interface MatOpts {
  rough?: number;
  metal?: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  flatShading?: boolean;
  side?: THREE.Side;
  depthWrite?: boolean;
  polygonOffset?: boolean;
  polygonOffsetFactor?: number;
  polygonOffsetUnits?: number;
}

/** Renk + ayarlara göre önbellekli MeshStandardMaterial. */
export function mat(color: number, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${o.rough ?? 0.82}|${o.metal ?? 0}|${o.emissive ?? 0}|${o.emissiveIntensity ?? 1}|${
    o.transparent ? 1 : 0
  }|${o.opacity ?? 1}|${o.flatShading ? 1 : 0}|${o.side ?? 0}|${o.depthWrite === false ? 0 : 1}|${
    o.polygonOffset ? 1 : 0
  }|${o.polygonOffsetFactor ?? 0}|${o.polygonOffsetUnits ?? 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.82,
      metalness: o.metal ?? 0,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.emissiveIntensity ?? 1,
      transparent: o.transparent ?? false,
      opacity: o.opacity ?? 1,
      flatShading: o.flatShading ?? false,
      side: o.side ?? THREE.FrontSide,
      depthWrite: o.depthWrite ?? true,
      polygonOffset: o.polygonOffset ?? false,
      polygonOffsetFactor: o.polygonOffsetFactor ?? 0,
      polygonOffsetUnits: o.polygonOffsetUnits ?? 0,
    });
    matCache.set(key, m);
  }
  return m;
}

/** Işıksız düz renk (ikon, gösterge, UI-in-world). */
const basicCache = new Map<string, THREE.MeshBasicMaterial>();
export function basic(color: number, opacity = 1, depthWrite = true): THREE.MeshBasicMaterial {
  const key = `${color}|${opacity}|${depthWrite ? 1 : 0}`;
  let m = basicCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite,
      toneMapped: false,
    });
    basicCache.set(key, m);
  }
  return m;
}

export function box(w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `b${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  let g = geoCache.get(key) as THREE.BoxGeometry | undefined;
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(key, g);
  }
  return g;
}

export function cyl(rTop: number, rBot: number, h: number, seg = 10): THREE.CylinderGeometry {
  const key = `c${rTop.toFixed(3)}_${rBot.toFixed(3)}_${h.toFixed(3)}_${seg}`;
  let g = geoCache.get(key) as THREE.CylinderGeometry | undefined;
  if (!g) {
    g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
    geoCache.set(key, g);
  }
  return g;
}

export function sph(r: number, wSeg = 10, hSeg = 8): THREE.SphereGeometry {
  const key = `s${r.toFixed(3)}_${wSeg}_${hSeg}`;
  let g = geoCache.get(key) as THREE.SphereGeometry | undefined;
  if (!g) {
    g = new THREE.SphereGeometry(r, wSeg, hSeg);
    geoCache.set(key, g);
  }
  return g;
}

export function cone(r: number, h: number, seg = 10): THREE.ConeGeometry {
  const key = `k${r.toFixed(3)}_${h.toFixed(3)}_${seg}`;
  let g = geoCache.get(key) as THREE.ConeGeometry | undefined;
  if (!g) {
    g = new THREE.ConeGeometry(r, h, seg);
    geoCache.set(key, g);
  }
  return g;
}

export function torus(r: number, tube: number, radSeg = 8, tubSeg = 14): THREE.TorusGeometry {
  const key = `t${r.toFixed(3)}_${tube.toFixed(3)}_${radSeg}_${tubSeg}`;
  let g = geoCache.get(key) as THREE.TorusGeometry | undefined;
  if (!g) {
    g = new THREE.TorusGeometry(r, tube, radSeg, tubSeg);
    geoCache.set(key, g);
  }
  return g;
}

export function plane(w: number, h: number): THREE.PlaneGeometry {
  const key = `p${w.toFixed(3)}_${h.toFixed(3)}`;
  let g = geoCache.get(key) as THREE.PlaneGeometry | undefined;
  if (!g) {
    g = new THREE.PlaneGeometry(w, h);
    geoCache.set(key, g);
  }
  return g;
}

/** Yuvarlatılmış köşeli kutu — chibi karakter uzuvları ve mobilya için. */
export function roundBox(w: number, h: number, d: number, r = 0.08, seg = 2): THREE.BufferGeometry {
  const key = `rb${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}_${r.toFixed(3)}_${seg}`;
  let g = geoCache.get(key);
  if (g) return g;

  // Küreyi kutu biçimine "şişirerek" ucuz bir yuvarlatılmış kutu üretir.
  const rr = Math.min(r, w / 2, h / 2, d / 2);
  const sphere = new THREE.SphereGeometry(1, 8 + seg * 4, 6 + seg * 3);
  const pos = sphere.attributes.position as THREE.BufferAttribute;
  const hx = w / 2 - rr;
  const hy = h / 2 - rr;
  const hz = d / 2 - rr;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setXYZ(i, Math.sign(x) * hx + x * rr, Math.sign(y) * hy + y * rr, Math.sign(z) * hz + z * rr);
  }
  pos.needsUpdate = true;
  sphere.computeVertexNormals();
  g = sphere;
  geoCache.set(key, g);
  return g;
}

/** Hızlı mesh kurucu. */
export function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Gölge vermeyen hafif mesh (küçük detaylar için). */
export function detail(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

/** Renk tonunu koyulaştır/açar (0.8 → %20 koyu). */
export function shade(color: number, factor: number): number {
  const c = new THREE.Color(color);
  c.multiplyScalar(factor);
  return c.getHex();
}

/** İki rengi karıştır. */
export function mix(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

export function disposeCaches(): void {
  for (const m of matCache.values()) m.dispose();
  for (const m of basicCache.values()) m.dispose();
  for (const g of geoCache.values()) g.dispose();
  matCache.clear();
  basicCache.clear();
  geoCache.clear();
}

export function cacheStats(): { materials: number; geometries: number } {
  return { materials: matCache.size + basicCache.size, geometries: geoCache.size };
}
