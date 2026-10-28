import assert from 'node:assert/strict';
import { it } from 'node:test';
import { Group, Matrix4, Object3D, Vector3 } from 'three';
import { cacheLocalMatrices } from './LocalMatrixCache';
import { StaticTransformRoot } from './StaticTransformRoot';

it('avoids forcing unchanged furniture through its static geometry', () => {
  const root = new Group(), batch = new StaticTransformRoot(), leaf = new Object3D();
  root.add(batch); batch.add(leaf); leaf.position.set(2, 1, 3);
  cacheLocalMatrices(root); root.updateMatrixWorld(true);
  let visits = 0;
  const original = leaf.updateMatrixWorld.bind(leaf);
  leaf.updateMatrixWorld = force => { visits++; original(force); };
  for (let frame = 0; frame < 120; frame++) root.updateMatrixWorld();
  assert.equal(visits, 0);
  root.position.x = 7; root.updateMatrixWorld();
  assert.equal(visits, 1);
  assert.deepEqual(new Vector3().setFromMatrixPosition(leaf.matrixWorld).toArray(), [9, 1, 3]);
  root.updateMatrixWorld(true); assert.equal(visits, 2);
});

it('matches ordinary transforms during animation, reparenting and both matrix update APIs', () => {
  const expected = new Group(), actual = new Group();
  for (const root of [expected, actual]) {
    const inner = new Group(), leaf = new Object3D();
    root.add(inner); inner.add(leaf); leaf.position.set(2, 3, 4);
  }
  cacheLocalMatrices(actual);
  for (let frame = 0; frame < 100; frame++) {
    for (const root of [expected, actual]) {
      root.position.set(frame / 5, 2, -3);
      root.rotation.set(.2, frame / 30, -.1);
      root.children[0].scale.set(1, .92 + frame / 1250, 1);
      root.children[0].children[0].position.z = 4 + Math.sin(frame);
      if (frame % 2) root.updateWorldMatrix(true, true);
      else root.updateMatrixWorld();
    }
    assert.deepEqual(actual.children[0].children[0].matrixWorld.elements,
      expected.children[0].children[0].matrixWorld.elements);
  }
  for (const root of [expected, actual]) {
    const parent = new Group(); parent.position.y = 12; parent.add(root); parent.updateMatrixWorld();
  }
  assert.deepEqual(actual.children[0].matrixWorld.elements, expected.children[0].matrixWorld.elements);
});

it('preserves manual matrices and recomposes after automatic updates are restored', () => {
  const root = new Group(); root.position.x = 3; cacheLocalMatrices(root); root.updateMatrixWorld();
  root.matrixAutoUpdate = false;
  root.matrix.makeTranslation(7, 8, 9); root.matrixWorldNeedsUpdate = true;
  root.updateMatrixWorld(); assert.deepEqual(root.matrixWorld.elements, root.matrix.elements);
  root.matrixAutoUpdate = true; root.updateMatrixWorld();
  assert.deepEqual(root.matrixWorld.elements, new Matrix4().makeTranslation(3, 0, 0).elements);
  root.matrix.makeTranslation(99, 0, 0); root.updateMatrix();
  assert.deepEqual(root.matrix.elements, new Matrix4().makeTranslation(3, 0, 0).elements);
});

it('updates newly attached children and keeps explicitly dirty matrices dirty', () => {
  const root = new Group(); cacheLocalMatrices(root); root.updateMatrixWorld();
  const leaf = new Object3D(); leaf.position.y = 4; root.add(leaf); root.updateMatrixWorld();
  assert.equal(leaf.matrixWorld.elements[13], 4);
  root.matrixWorldNeedsUpdate = true; root.updateMatrix(); assert.equal(root.matrixWorldNeedsUpdate, true);
  leaf.position.y = 6; root.updateMatrixWorld(true); assert.equal(leaf.matrixWorld.elements[13], 6);
});

it('installs once and leaves custom updateMatrix implementations intact', () => {
  const root = new Group(), custom = new Object3D(); root.add(custom);
  const fn = custom.updateMatrix = () => { custom.matrix.makeTranslation(1, 2, 3); };
  cacheLocalMatrices(root); const cached = root.updateMatrix; cacheLocalMatrices(root);
  assert.equal(root.updateMatrix, cached); assert.equal(custom.updateMatrix, fn);
});
