
import * as THREE from 'three';
import { box, cyl, detail, mat, roundBox } from './Materials';
import type { HeldVacuum } from './StationView';
import { markDynamic } from './layers';

export const MOP_FORWARD = 0.58;

/** Compact floor tool; its head stays on the floor and its grip follows both hands. */
export function createFloorMop(): HeldVacuum {
  const root = new THREE.Group();
  root.name = 'floorMop';
  const sweep = new THREE.Group();
  root.add(sweep);
  const pad = detail(roundBox(0.78, 0.024, 0.33, 0.03), mat(0xeaf4f0, { rough: 0.92 }), 0, 0.012, MOP_FORWARD);
  sweep.add(pad);
  const head = detail(roundBox(0.74, 0.042, 0.29, 0.045), mat(0x2d6b5f, { rough: 0.65 }), 0, 0.036, MOP_FORWARD);
  head.name = 'mopHead';
  sweep.add(head);
  sweep.add(detail(roundBox(0.54, 0.048, 0.18, 0.03), mat(0xf3ead8, { rough: 0.48 }), 0, 0.072, MOP_FORWARD));
  sweep.add(detail(cyl(0.042, 0.052, 0.045, 10), mat(0xe3a64d, { rough: 0.34, metal: 0.65 }), 0, 0.095, MOP_FORWARD));
  const rodPivot = new THREE.Group();
  rodPivot.position.set(0, 0.09, MOP_FORWARD);
  sweep.add(rodPivot);
  const rod = new THREE.Group();
  const shaft = detail(cyl(0.018, 0.018, 1, 8), mat(0xb6c4c4, { rough: 0.4, metal: 0.55 }), 0, 0.5, 0);
  rod.add(shaft);
  rodPivot.add(rod);
  const grip = new THREE.Group();
  grip.name = 'mopGrip';
  grip.add(detail(box(0.48, 0.045, 0.06), mat(0x24554e, { rough: 0.7 }), 0, 0, 0));
  rodPivot.add(grip);
  markDynamic(root);
  root.visible = false;
  // Geometry/materials come from the shared Materials cache.
  return { root, sweep, rodPivot, rod, grip, rodLen: 1, gripWidth: 0.48, dispose: () => root.removeFromParent() };
}
