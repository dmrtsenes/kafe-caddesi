import assert from 'node:assert/strict';
import { it } from 'node:test';
import * as THREE from 'three';
import { createPremiumVacuum, VACUUM_DESIGN } from './VacuumAsset';
import { BALANCE } from '../data/balance';

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  root.traverse(o => { if (o instanceof THREE.Mesh) result.push(o); });
  return result;
}

it('keeps the original tool within a fixed draw, triangle and buffer budget', () => {
  const v = createPremiumVacuum(0x376152), parts = meshes(v.root);
  assert.equal(v.root.userData.vacuumAsset, VACUUM_DESIGN);
  assert.equal(parts.length, 4);
  let triangles = 0, bytes = 0;
  for (const part of parts) {
    const g = part.geometry, m = part.material as THREE.MeshStandardMaterial;
    triangles += g.index!.count / 3;
    bytes += g.index!.array.byteLength;
    for (const a of Object.values(g.attributes)) bytes += a.array.byteLength;
    assert.equal(g.groups.length, 0);
    assert.equal(m.transparent, false);
    assert.equal(m.map, null);
    assert.equal(part.castShadow, false);
    assert.equal(part.layers.mask, 2);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)));
      assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-5);
    }
  }
  assert.ok(triangles <= 1800, String(triangles));
  assert.ok(bytes < 80000, String(bytes));
  v.dispose();
});

it('places the wide floor shoe around the actual simulated brush', () => {
  const v = createPremiumVacuum(0x376152);
  const head = new THREE.Box3().setFromObject(v.root.getObjectByName('vacuumHead')!);
  const mouth = v.root.getObjectByName('vacuumMouth')!;
  assert.ok(Math.abs(head.min.y) < 1e-5);
  assert.ok(Math.abs(head.max.x - head.min.x - 1.5) < 1e-5);
  assert.equal(mouth.position.z, BALANCE.vacuum.brushForward);
  assert.ok(head.containsPoint(mouth.position));
  v.dispose();
});

it('shares buffers across repeated equipment changes without disposing another instance', () => {
  const parked = createPremiumVacuum(0x376152), original = meshes(parked.root);
  const stage = new THREE.Group(); stage.add(parked.root);
  let resourceDisposals = 0;
  for (const part of original) part.geometry.addEventListener('dispose', () => resourceDisposals++);
  for (let cycle = 0; cycle < 30; cycle++) {
    const held = createPremiumVacuum(0x376152);
    stage.add(held.root);
    meshes(held.root).forEach((part, i) => {
      assert.equal(part.geometry, original[i].geometry);
      assert.equal(part.material, original[i].material);
    });
    held.rod.scale.y = 1.3;
    assert.equal(parked.rod.scale.y, 1);
    held.dispose(); held.dispose();
    assert.equal(held.root.parent, null);
    assert.equal(stage.children.length, 1);
  }
  assert.equal(resourceDisposals, 0);
  parked.dispose();
});
