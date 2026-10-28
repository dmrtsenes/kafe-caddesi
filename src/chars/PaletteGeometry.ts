import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const layouts = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/** Shared, indexed topology. Material seams remain distinct even when two
 * current outfit colors happen to match. Build once, before gameplay starts. */
export function paletteGeometry(
  source: THREE.BufferGeometry,
): THREE.BufferGeometry {
  const existing = layouts.get(source);
  if (existing) return existing;
  const expanded = source.index ? source.toNonIndexed() : source.clone();
  const count = expanded.attributes.position.count;
  const slots = new Float32Array(count).fill(-1);
  const groups = expanded.groups.length
    ? expanded.groups
    : [{ start: 0, count, materialIndex: 0 }];
  for (const group of groups)
    slots.fill(
      group.materialIndex ?? 0,
      group.start,
      Math.min(count, group.start + group.count),
    );
  expanded.deleteAttribute("color");
  expanded.setAttribute("paletteSlot", new THREE.BufferAttribute(slots, 1));
  expanded.clearGroups();
  const indexed = Object.keys(expanded.morphAttributes).length
    ? expanded
    : mergeVertices(expanded, 1e-6);
  if (indexed !== expanded) expanded.dispose();
  layouts.set(source, indexed);
  return indexed;
}
