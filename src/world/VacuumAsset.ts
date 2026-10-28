import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BALANCE } from '../data/balance';
import { markDynamic } from './layers';
import type { HeldVacuum } from './StationView';

/** Original SERA floor tool: four opaque draws, no textures, lights or downloads. */
export const VACUUM_DESIGN = 'fincan-sera-v1';
type Template = { head: THREE.BufferGeometry; motor: THREE.BufferGeometry; rod: THREE.BufferGeometry; grip: THREE.BufferGeometry };
const templates = new Map<number, Template>();
const satin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.18 });
const metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.62 });
const C = { ink: 0x233b3c, rubber: 0x182a2e, silver: 0xc4d4cf, brass: 0xcbb689, window: 0x527a76, mint: 0xb3f3d8 };

/** Four rounded perimeter rings; curvature only where it changes the silhouette. */
function shell(w: number, h: number, d: number, radius: number, bevel: number): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [];
  const n = 16, inset = Math.min(bevel, h * 0.35, radius * 0.65);
  for (const [y, shrink] of [[-h / 2, inset], [-h / 2 + inset, 0], [h / 2 - inset, 0], [h / 2, inset]]) {
    for (let corner = 0; corner < 4; corner++) {
      const cx = (corner === 0 || corner === 3 ? 1 : -1) * (w / 2 - radius);
      const cz = (corner < 2 ? 1 : -1) * (d / 2 - radius);
      for (let step = 0; step < 4; step++) {
        const a = (corner + step / 3) * Math.PI / 2;
        positions.push(cx + Math.cos(a) * (radius - shrink), y, cz + Math.sin(a) * (radius - shrink));
      }
    }
  }
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < n; i++) {
    const a = ring * n + i, b = ring * n + (i + 1) % n;
    indices.push(a, a + n, b, b, a + n, b + n);
  }
  for (let i = 1; i < n - 1; i++) indices.push(0, i, i + 1, 3 * n, 3 * n + i + 1, 3 * n + i);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function template(accent: number): Template {
  const cached = templates.get(accent);
  if (cached) return cached;
  const head: THREE.BufferGeometry[] = [], motor: THREE.BufferGeometry[] = [], rod: THREE.BufferGeometry[] = [], grip: THREE.BufferGeometry[] = [];
  const jade = new THREE.Color(accent).lerp(new THREE.Color(0x34796a), 0.65).getHex();
  function add(out: THREE.BufferGeometry[], geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rotateZ = 0) {
    geometry.deleteAttribute('uv');
    if (rotateZ) geometry.rotateZ(rotateZ);
    geometry.translate(x, y, z);
    const tint = new THREE.Color(color);
    const colors = new Uint8Array(geometry.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = Math.round(tint.r * 255); colors[i + 1] = Math.round(tint.g * 255); colors[i + 2] = Math.round(tint.b * 255);
    }
    geometry.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3, true));
    out.push(geometry);
  }
  const z = BALANCE.vacuum.brushForward;
  add(head, shell(1.5, 0.17, 0.46, 0.12, 0.036), C.rubber, 0, 0.105, z);
  add(head, shell(1.39, 0.09, 0.37, 0.10, 0.025), C.brass, 0, 0.178, z - 0.005);
  add(head, shell(1.32, 0.09, 0.34, 0.095, 0.025), jade, 0, 0.212, z - 0.013);
  add(head, shell(0.45, 0.10, 0.30, 0.09, 0.025), C.ink, 0, 0.26, z - 0.025);
  add(head, new THREE.BoxGeometry(1.04, 0.022, 0.012), C.mint, 0, 0.167, z + 0.221);
  for (const x of [-0.62, 0.62]) {
    add(head, new THREE.CylinderGeometry(0.103, 0.103, 0.12, 12), C.rubber, x, 0.103, z - 0.095, Math.PI / 2);
    add(head, new THREE.CylinderGeometry(0.062, 0.062, 0.124, 10), C.silver, x, 0.103, z - 0.095, Math.PI / 2);
  }
  add(head, new THREE.CylinderGeometry(0.1, 0.1, 0.24, 12), C.brass, 0, 0.275, z - 0.045, Math.PI / 2);
  // A rigid motor pod tilts at the shoe joint. Only the telescopic shaft stretches.
  add(motor, shell(0.31, 0.52, 0.27, 0.07, 0.04), C.ink, 0, 0.30, 0);
  add(motor, shell(0.285, 0.28, 0.19, 0.06, 0.025), C.window, 0, 0.235, 0.070);
  add(motor, shell(0.32, 0.15, 0.285, 0.075, 0.025), jade, 0, 0.50, 0);
  add(motor, shell(0.28, 0.032, 0.25, 0.065, 0.009), C.brass, 0, 0.41, 0.015);
  for (const y of [0.465, 0.5, 0.535]) add(motor, new THREE.BoxGeometry(0.14, 0.012, 0.008), C.rubber, 0, y, 0.145);
  add(motor, new THREE.BoxGeometry(0.06, 0.025, 0.012), C.mint, 0, 0.37, 0.17);
  add(rod, new THREE.CylinderGeometry(0.028, 0.032, 1, 10), C.silver, 0, 0.5, 0);
  add(rod, new THREE.CylinderGeometry(0.036, 0.036, 0.10, 10), C.brass, 0, 0.92, 0);
  add(grip, new THREE.CylinderGeometry(0.048, 0.048, 0.39, 12), C.rubber, 0, 0, 0, Math.PI / 2);
  for (const x of [-0.182, 0.182]) add(grip, new THREE.CylinderGeometry(0.05, 0.05, 0.026, 12), C.brass, x, 0, 0, Math.PI / 2);
  function bake(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const geometry = mergeGeometries(parts, false)!;
    parts.forEach(part => part.dispose()); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  }
  const result = { head: bake(head), motor: bake(motor), rod: bake(rod), grip: bake(grip) };
  templates.set(accent, result);
  return result;
}

/** Instances own transforms only. Shared geometry survives pickup/drop and station rebuilds. */
export function createPremiumVacuum(accent: number): HeldVacuum {
  const asset = template(accent);
  const root = new THREE.Group(); root.name = 'cafeVacuum'; root.userData.vacuumAsset = VACUUM_DESIGN;
  const sweep = new THREE.Group(); sweep.name = 'vacuumSweep'; root.add(sweep);
  const head = new THREE.Mesh(asset.head, satin); head.name = 'vacuumHead'; sweep.add(head);
  const mouth = new THREE.Object3D(); mouth.name = 'vacuumMouth'; mouth.position.set(0, 0.018, BALANCE.vacuum.brushForward); sweep.add(mouth);
  const rodPivot = new THREE.Group(); rodPivot.name = 'vacuumRodPivot';
  rodPivot.position.set(0, 0.275, BALANCE.vacuum.brushForward - 0.045); sweep.add(rodPivot);
  const motor = new THREE.Mesh(asset.motor, satin); motor.name = 'vacuumMotor'; rodPivot.add(motor);
  const rod = new THREE.Mesh(asset.rod, metal); rod.name = 'vacuumRod'; rodPivot.add(rod);
  const grip = new THREE.Group(); grip.name = 'vacuumGrip';
  grip.add(new THREE.Mesh(asset.grip, satin)); grip.position.y = 1; rodPivot.add(grip);
  rodPivot.rotation.x = -0.22;
  markDynamic(root);
  let disposed = false;
  return { root, sweep, rodPivot, rod, grip, rodLen: 1, gripWidth: 0.39, dispose() {
    if (disposed) return;
    disposed = true; root.removeFromParent(); root.clear();
  } };
}
