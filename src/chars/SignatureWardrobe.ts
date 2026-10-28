import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharRole } from './types';
import type { WorkwearPalette } from './Workwear';

export const FINCAN_STYLE_VERSION = 'sokak-atolyesi-1';
const CUSTOMER_LOOKS = [
  [0x386e67, 0xf2e5cb, 0xc58c50, 0x343e42, 0xe9decb, 0x35261e],
  [0xb4664a, 0xf3dfc8, 0x3e655d, 0x3a3c43, 0x3b302b, 0x51372b],
  [0xe5d7bd, 0x37596a, 0x9b683f, 0x35566d, 0xe7dcca, 0x302b29],
  [0x64774a, 0xe9d8b3, 0xae6d44, 0x353d32, 0x3b342b, 0x5b3d27],
  [0x8f6475, 0xf2e3d6, 0x385d62, 0x49424e, 0xe8dfd1, 0x513029],
  [0x517e99, 0xebdcc1, 0xb97949, 0x424e60, 0xf1e6d4, 0x3d2d24],
  [0xc08f43, 0xf5e8d1, 0x47695f, 0x3d4946, 0x44352a, 0x6c4229],
  [0x414b59, 0xdac6a7, 0xb37b57, 0x39403e, 0xe6dbc7, 0x282323],
] as const;

export function customerLook(seed = 0): { id: number; pattern: number; palette: WorkwearPalette } {
  const id = (seed >>> 0) % CUSTOMER_LOOKS.length;
  const [main, edge, cap, pants, shoes, hair] = CUSTOMER_LOOKS[id];
  return { id, pattern: id % 3, palette: { main, edge, cap, pants, shoes, hair,
    badge: 0xc08b55, apron: cap, strap: id % 2 ? 0x374a43 : 0x95623f } };
}

/** Stable coordinates in the untouched bind pose, for cloth-only knit/stripe panels. */
export function addClothCoordinates(mesh: T.Mesh, unit: number): void {
  const p = mesh.geometry.attributes.position, xy = new Float32Array(p.count * 2), v = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
    xy[i * 2] = v.x / unit; xy[i * 2 + 1] = v.y / unit;
  }
  mesh.geometry.setAttribute('fincanPattern', new T.BufferAttribute(xy, 2));
}

/** Only named clothing/hair meshes receive colors; the face/body mesh stays untouched. */
export function addCustomerCloth(mesh: T.Mesh, unit: number): void {
  const name = mesh.name.replace(/_\d+$/, ''), p = mesh.geometry.attributes.position;
  const channels = new Float32Array(p.count), v = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
    channels[i] = name.startsWith('A_Shirt') ? 1 : name === 'A_Pants01' ? (v.y / unit < .12 ? 6 : 5)
      : name === 'HatCustomer01' ? 3 : name === 'HairCustomer01' ? 9 : 0;
  }
  mesh.geometry.setAttribute('fincanCloth', new T.BufferAttribute(channels, 1));
  addClothCoordinates(mesh, unit);
}

/** New cafe garments are authored in normalized bind space and attached to bones.
 * They are merged into the existing skin, keeping one draw per character. */
export function addSignatureWardrobe(scene: T.Object3D, role: CharRole, unit: number,
  material: T.Material, look = 0): void {
  scene.updateMatrixWorld(true);
  const bone = (name: string) => {
    const found = scene.getObjectByName('mixamorig' + name);
    if (!found) throw new Error('Wardrobe joint missing: ' + name);
    return found;
  };
  const chest = bone('Spine2'), hips = bone('Hips'), head = bone('Head');
  const inverse = new T.Matrix4();
  let pieces = 0;
  const part = (joint: T.Object3D, geometry: T.BufferGeometry, x: number, y: number, z: number,
    channel: number, rotation = 0) => {
    geometry.rotateZ(rotation); geometry.translate(x, y, z); geometry.scale(unit, unit, unit);
    const positions = geometry.attributes.position, pattern = new Float32Array(positions.count * 2);
    for (let i = 0; i < positions.count; i++) {
      pattern[i * 2] = positions.getX(i) / unit; pattern[i * 2 + 1] = positions.getY(i) / unit;
    }
    geometry.setAttribute('fincanPattern', new T.BufferAttribute(pattern, 2));
    geometry.setAttribute('fincanCloth', new T.BufferAttribute(new Float32Array(positions.count).fill(channel), 1));
    if (!geometry.attributes.uv) geometry.setAttribute('uv', new T.BufferAttribute(new Float32Array(positions.count * 2), 2));
    inverse.copy(joint.matrixWorld).invert(); geometry.applyMatrix4(inverse);
    const mesh = new T.Mesh(geometry, material); mesh.name = 'fincanWardrobe';
    mesh.userData.signatureGarment = true; mesh.frustumCulled = false; mesh.receiveShadow = true;
    joint.add(mesh); pieces++;
  };
  const slab = (joint: T.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, channel: number, rot = 0) =>
    part(joint, new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * .24), x, y, z, channel, rot);
  const ribbon = (joint: T.Object3D, ax: number, ay: number, bx: number, by: number, z: number, width: number, channel: number) => {
    const dx = bx - ax, dy = by - ay;
    slab(joint, (ax + bx) / 2, (ay + by) / 2, z, width, Math.hypot(dx, dy), .008, channel, -Math.atan2(dx, dy));
  };
  const cup = (joint: T.Object3D, x: number, y: number, z: number, size = 1) => {
    slab(joint, x, y, z, .048 * size, .034 * size, .006, 2);
    part(joint, new T.TorusGeometry(.012 * size, .0038 * size, 4, 10), x + .026 * size, y + .004 * size, z, 2);
    slab(joint, x, y - .021 * size, z, .059 * size, .005 * size, .006, 4);
    ribbon(joint, x - .009 * size, y + .024 * size, x - .002 * size, y + .039 * size, z, .004 * size, 2);
  };
  const scarf = () => {
    slab(chest, 0, .672, .054, .148, .030, .092, 8);
    slab(chest, .024, .630, .124, .034, .068, .008, 8, -.28);
    slab(chest, -.003, .630, .126, .033, .054, .009, 8, .3);
  };
  const pocket = (full: boolean) => {
    slab(hips, .018, .40, .124, .122, .072, .010, 7);
    slab(hips, .018, .434, .129, .123, .008, .008, 8);
    if (full) slab(hips, .073, .426, .133, .008, .064, .007, 4, -.06);
  };

  if (role !== 'customer' && role !== 'dasher' && role !== 'investor') {
    if (role === 'cashier') {
      slab(chest, -.085, .572, .100, .073, .195, .038, 7);
      slab(chest, .085, .572, .100, .073, .195, .038, 7);
      ribbon(chest, -.075, .658, -.026, .594, .122, .022, 2);
      ribbon(chest, .075, .658, .026, .594, .122, .022, 2);
      for (const y of [.572, .539, .506]) slab(chest, .01, y, .120, .01, .01, .008, 4);
      cup(chest, -.077, .592, .122, .7);
    } else {
      slab(chest, 0, .554, .112, .198, .200, .016, 7);
      slab(hips, 0, .398, .115, .248, .172, .018, 7);
      slab(hips, 0, .477, .115, .266, .024, .026, 8);
      for (const x of [-.070, .070]) ribbon(chest, x, .646, x * .8, .548, .122, .018, 8);
      pocket(true); cup(chest, 0, .58, .122, 1.0);
      if (role === 'player' || role === 'barista') scarf();
      if (role === 'waiter' || role === 'busser') {
        slab(hips, -.116, .383, .122, .058, .140, .014, 2, -.05);
        for (const y of [.33, .344]) slab(hips, -.118, y, .129, .054, .006, .006, 8);
      }



    }
    // Fincan badge on the existing cap; its original geometry remains present.
    slab(head, 0, .985, .126, .058, .039, .011, 7);
    cup(head, 0, .985, .134, .6);
  } else {
    if (look % 3 === 0) scarf();
    if (look % 3 === 1 || role === 'dasher') {
      ribbon(chest, -.09, .655, .10, .447, .126, .022, 8);
      slab(hips, .115, .411, .107, .107, .117, .072, 7);
      slab(hips, .115, .438, .148, .108, .02, .01, 8);
      slab(hips, .115, .435, .157, .019, .017, .007, 4);
    }
    if (look % 4 === 2) {
      for (const x of [-.051, .051]) part(head, new T.TorusGeometry(.037, .006, 5, 14), x, .879, .132, 6);
      slab(head, 0, .887, .134, .034, .007, .006, 6);
    }
    if (look % 3 === 2) {
      slab(chest, -.065, .585, .123, .045, .058, .009, 2);
      slab(chest, -.065, .613, .13, .046, .007, .007, 4);
    }
  }
  // Preserve source geometry ownership while disposing only generated temporary pieces after batching.
  scene.userData.signatureStyle = FINCAN_STYLE_VERSION;
  scene.userData.signaturePieces = pieces;
}
