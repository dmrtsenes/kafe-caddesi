import assert from 'node:assert/strict';
import {it} from 'node:test';
import * as T from 'three';
import {canBakeMaterial,batchMaterial,bakeMaterialAttributes} from './BatchMaterial';

it('keeps exact linear colors and PBR values while sharing a draw material',()=>{
  const a=new T.MeshStandardMaterial({color:0x275c53,roughness:.62,metalness:.1});
  const b=new T.MeshStandardMaterial({color:0xe3a64d,roughness:.32,metalness:.65});
  assert.equal(batchMaterial(a),batchMaterial(b));
  const source=new T.BoxGeometry(), geometry=source.clone();
  bakeMaterialAttributes(geometry,b);
  assert.equal(source.getAttribute('color'),undefined);
  const color=geometry.getAttribute('color'),surface=geometry.getAttribute('batchSurface');
  assert.ok(Math.abs(color.getX(0)-b.color.r)<1e-6);
  assert.ok(Math.abs(color.getY(0)-b.color.g)<1e-6);
  assert.ok(Math.abs(surface.getX(0)-.32)<1e-6);
  assert.ok(Math.abs(surface.getY(0)-.65)<1e-6);
  assert.notEqual(batchMaterial(a),a);
  source.dispose();geometry.dispose();a.dispose();b.dispose();
});

it('does not flatten textures, mutable cosmetics, emission, glass or custom shaders',()=>{
  const ordinary=new T.MeshStandardMaterial();assert.ok(canBakeMaterial(ordinary));
  const cases=[new T.MeshStandardMaterial({map:new T.Texture()}),new T.MeshStandardMaterial({transparent:true,opacity:.14}),new T.MeshStandardMaterial({emissive:0xffd590}),new T.MeshPhysicalMaterial()];
  const mutable=new T.MeshStandardMaterial();mutable.userData.mutableColor=true;cases.push(mutable);
  const custom=new T.MeshStandardMaterial();custom.onBeforeCompile=()=>{};cases.push(custom);
  for(const m of cases){assert.equal(canBakeMaterial(m),false);m.dispose();}ordinary.dispose();
});

it('preserves existing vertex shading and separates render states',()=>{
  const geometry=new T.BoxGeometry(),m=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true});
  const colors=new Float32Array(geometry.attributes.position.count*3).fill(.6);
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  bakeMaterialAttributes(geometry,m);assert.ok(Math.abs(geometry.attributes.color.getX(0)-.6)<1e-6);
  const twoSided=m.clone();twoSided.side=T.DoubleSide;
  assert.notEqual(batchMaterial(m),batchMaterial(twoSided));
  geometry.dispose();m.dispose();twoSided.dispose();
});
