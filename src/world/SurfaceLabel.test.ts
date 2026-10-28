import { it } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { compactPadLabel, createSurfaceLabel, renderSurfaceLabels } from './SurfaceLabel';
import { LAYER_SURFACE_LABEL, markDynamic } from './layers';
import { SettledVisual } from './SettledVisual';

it('keeps the purchase name and exact price on two short lines', () => {
  assert.deepEqual(compactPadLabel('Tezgâhtar · ₺1,4B'), { title: 'Tezgâhtar', price: '₺1,4B' });
  assert.deepEqual(compactPadLabel('Kasiyer · ₺11B'), { title: 'Kasiyer', price: '₺11B' });
});

it('shortens side-area names while retaining their level and price', () => {
  assert.deepEqual(compactPadLabel('Bahçe Çay Evi · ↑ 2 · ₺785', 'Bahçe'), { title: 'Bahçe ↑2', price: '₺785' });
  assert.deepEqual(compactPadLabel('Avlu Paket Servisi · AÇ · ₺2,2B', 'Avlu'), { title: 'Avlu', price: '₺2,2B' });
});

it('uses a fixed, depth-tested surface instead of a camera-facing overlay', () => {
  const before = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) } as unknown as Document;
  try {
    const floor = createSurfaceLabel(1.7, .92), stock = createSurfaceLabel(.98, .36, false);
    floor.mesh.position.set(.14, .092, 1.13); floor.mesh.updateMatrix();
    const matrix = floor.mesh.matrix.clone();
    floor.setText('Barista', '₺18B'); floor.setActive(true); floor.update(1);
    floor.mesh.updateMatrix(); assert.deepEqual(floor.mesh.matrix.elements, matrix.elements);
    assert.ok(new T.Vector3(0, 0, 1).applyQuaternion(floor.mesh.quaternion).distanceTo(new T.Vector3(0, 1, 0)) < 1e-7);
    for (const label of [floor, stock]) {
      const material = label.mesh.material as T.MeshBasicMaterial;
      assert.equal(material.depthTest, true); assert.equal(material.depthWrite, false); assert.equal(material.toneMapped, false);
      assert.equal(material.map!.anisotropy, 16); assert.equal(material.map!.image.width, 1024);
      const parent = new T.Group(); parent.add(label.mesh); markDynamic(parent);
      const settled = new SettledVisual([parent]); settled.set(true);
      assert.equal(label.mesh.layers.mask, 1 << LAYER_SURFACE_LABEL);
      settled.dispose(); assert.equal(label.mesh.layers.mask, 1 << LAYER_SURFACE_LABEL);
      label.dispose();
    }
  } finally { globalThis.document = before; }
});

it('keeps the scene depth and restores render state even when the lettering pass fails', () => {
  const scene = new T.Scene(), camera = new T.Camera();
  const background = new T.Color('red'); scene.background = background; camera.layers.mask = 3;
  const renderer = { autoClear: true, render() {
    assert.equal(this.autoClear, false); assert.equal(scene.background, null);
    assert.equal(scene.matrixWorldAutoUpdate, false); assert.equal(camera.layers.mask, 1 << LAYER_SURFACE_LABEL);
    throw new Error('test renderer');
  } };
  assert.throws(() => renderSurfaceLabels(renderer as unknown as T.WebGLRenderer, scene, camera), /test renderer/);
  assert.equal(scene.background, background); assert.equal(renderer.autoClear, true);
  assert.equal(camera.layers.mask, 3); assert.equal(scene.matrixWorldAutoUpdate, true);
});
