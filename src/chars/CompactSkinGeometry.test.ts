import assert from 'node:assert/strict';
import {it} from 'node:test';
import * as THREE from 'three';
import {compactSkinGeometry} from './CompactSkinGeometry';

function fixture(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(1,1).toNonIndexed();
  const count = g.attributes.position.count;
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4).fill(3),4));
  const weights = new Float32Array(count*4);
  for(let n=0;n<count;n++)weights[n*4]=1;
  g.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));
  g.setAttribute('fincanCloth',new THREE.Float32BufferAttribute(new Float32Array(count).fill(6),1));
  return g;
}

function assertCornersEqual(before: THREE.BufferGeometry, after: THREE.BufferGeometry): void {
  const count=before.index?.count??before.attributes.position.count;
  assert.equal(after.index?.count??after.attributes.position.count,count);
  for(let n=0;n<count;n++)for(const key of Object.keys(before.attributes)){
    const a=before.attributes[key],b=after.attributes[key];
    for(let k=0;k<a.itemSize;k++)assert.equal(
      a.getComponent(before.index?.getX(n)??n,k),b.getComponent(after.index?.getX(n)??n,k),`${key} corner ${n}`);
  }
}

it('indexes exact duplicate corners and packs integer fields without changing triangle attributes',()=>{
  const before=fixture(); before.addGroup(0,3,0);before.addGroup(3,3,1);before.setDrawRange(0,3);
  const after=compactSkinGeometry(before);
  assert.equal(before.index,null);assert.equal(after.attributes.position.count,4);
  assert.ok(after.attributes.skinIndex.array instanceof Uint8Array);
  assert.ok(after.attributes.fincanCloth.array instanceof Uint8Array);
  assert.deepEqual(after.groups,before.groups);assert.deepEqual(after.drawRange,before.drawRange);
  assertCornersEqual(before,after);
});

it('preserves UV seams, distinct weights, clothing and sub-micrometre positions exactly',()=>{
  for(const [attribute,component,value] of [['uv',0,.123],['skinWeight',0,.999],['fincanCloth',0,5],['position',2,1e-8]] as const){
    const before=fixture();before.attributes[attribute].setComponent(3,component,value);
    assertCornersEqual(before,compactSkinGeometry(before));
  }
});

it('retains large bone indices and leaves morph-target topology untouched',()=>{
  const before=fixture();before.attributes.skinIndex.setX(0,300);
  const after=compactSkinGeometry(before);assert.ok(after.attributes.skinIndex.array instanceof Uint16Array);
  assertCornersEqual(before,after);
  before.morphAttributes.position=[before.attributes.position.clone()];
  assert.equal(compactSkinGeometry(before),before);
});

it('preserves signed zero and skips half-float attribute encoding',()=>{
  const source=fixture();source.attributes.fincanCloth.setX(0,-0);
  const compact=compactSkinGeometry(source);assertCornersEqual(source,compact);
  assert.ok(Object.is(compact.attributes.fincanCloth.getX(compact.index!.getX(0)),-0));
  source.setAttribute('uv',new THREE.Float16BufferAttribute(new Uint16Array(source.attributes.position.count*2),2));
  assert.equal(compactSkinGeometry(source),source);
});
