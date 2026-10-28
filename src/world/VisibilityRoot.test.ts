import assert from "node:assert/strict";
import { it } from "node:test";
import { Group, Object3D, Vector3 } from "three";
import { VisibilityRoot } from "./VisibilityRoot";
import { StaticTransformRoot } from "./StaticTransformRoot";
import { cacheLocalMatrices } from './LocalMatrixCache';

it('refreshes cached children when reparented between already settled station roots', () => {
  const a=new VisibilityRoot(),b=new VisibilityRoot(),leaf=new Object3D();
  a.position.x=3;b.position.x=9;leaf.position.z=2;a.add(leaf);
  cacheLocalMatrices(a);cacheLocalMatrices(b);a.updateMatrixWorld();b.updateMatrixWorld();
  assert.equal(leaf.matrixWorld.elements[12],3);
  b.add(leaf);b.updateMatrixWorld();
  assert.equal(leaf.matrixWorld.elements[12],9);assert.equal(leaf.matrixWorld.elements[14],2);
});

it('skips hidden station subtrees under automatic cached roots without losing later motion', () => {
  const root=new VisibilityRoot(),body=new VisibilityRoot(),hidden=new VisibilityRoot(),leaf=new Object3D();
  root.add(body);body.add(hidden);hidden.add(leaf);cacheLocalMatrices(root);
  root.updateMatrixWorld(true);hidden.visible=false;
  let visits=0;const old=leaf.updateMatrixWorld.bind(leaf);
  leaf.updateMatrixWorld=force=>{visits++;old(force);};
  for(let i=0;i<120;i++)root.updateMatrixWorld();assert.equal(visits,0);
  leaf.position.z=7;hidden.visible=true;root.updateMatrixWorld();
  assert.equal(leaf.matrixWorld.elements[14],7);assert.equal(visits,1);
  hidden.visible=false;body.scale.y=.92;root.updateMatrixWorld();assert.equal(visits,2);
  leaf.position.y=4;root.updateMatrixWorld(true);assert.equal(visits,3);
  assert.equal(leaf.matrixWorld.elements[13],4*.92);
});

it('skips stable static trees but refreshes added geometry, parent moves and forced updates', () => {
  const parent = new Group(), root = new StaticTransformRoot(), branch = new Object3D();
  parent.matrixAutoUpdate = false;
  parent.add(root); root.add(branch); branch.position.set(2, 1, 3);
  parent.updateMatrixWorld(true);
  let visits = 0;
  const original = branch.updateMatrixWorld.bind(branch);
  branch.updateMatrixWorld = force => { visits++; original(force); };
  for (let i = 0; i < 60; i++) parent.updateMatrixWorld();
  assert.equal(visits, 0);
  parent.position.x = 7; parent.updateMatrix(); parent.updateMatrixWorld();
  assert.equal(visits, 1);
  assert.deepEqual(new Vector3().setFromMatrixPosition(branch.matrixWorld).toArray(), [9, 1, 3]);
  const added = new Object3D(); added.position.z = 5; root.add(added);
  parent.updateMatrixWorld();
  assert.deepEqual(new Vector3().setFromMatrixPosition(added.matrixWorld).toArray(), [7, 0, 5]);
  branch.position.y = 4; root.updateMatrixWorld(true);
  assert.deepEqual(new Vector3().setFromMatrixPosition(branch.matrixWorld).toArray(), [9, 4, 3]);
  root.clear(); root.add(added); added.position.z = 8; parent.updateMatrixWorld();
  assert.deepEqual(new Vector3().setFromMatrixPosition(added.matrixWorld).toArray(), [7, 0, 8]);
});

it("skips hidden branches, then updates them immediately when visible again", () => {
  const root = new VisibilityRoot(),
    branch = new Group(),
    tip = new Object3D();
  root.matrixAutoUpdate = false;
  root.add(branch);
  branch.add(tip);
  root.updateMatrixWorld(true);
  let visits = 0;
  const original = tip.updateMatrixWorld.bind(tip);
  tip.updateMatrixWorld = (force) => {
    visits++;
    original(force);
  };
  branch.visible = false;
  branch.position.x = 4;
  tip.position.y = 2;
  for (let i = 0; i < 30; i++) root.updateMatrixWorld();
  assert.equal(visits, 0);
  branch.visible = true;
  root.updateMatrixWorld();
  assert.equal(visits, 1);
  assert.deepEqual(
    new Vector3().setFromMatrixPosition(tip.matrixWorld).toArray(),
    [4, 2, 0],
  );
});

it("preserves explicit forced bounds updates and changed parent transforms", () => {
  const parent = new Group(),
    root = new VisibilityRoot(),
    branch = new Object3D();
  root.matrixAutoUpdate = false;
  parent.add(root);
  root.add(branch);
  branch.visible = false;
  parent.updateMatrixWorld(true);
  parent.position.x = 7;
  branch.position.y = 3;
  parent.updateMatrixWorld();
  assert.deepEqual(
    new Vector3().setFromMatrixPosition(branch.matrixWorld).toArray(),
    [7, 3, 0],
  );
  branch.position.z = 5;
  root.updateMatrixWorld(true);
  assert.deepEqual(
    new Vector3().setFromMatrixPosition(branch.matrixWorld).toArray(),
    [7, 3, 5],
  );
});
