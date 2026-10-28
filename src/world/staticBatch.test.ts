import assert from 'node:assert/strict';
import { it } from 'node:test';
import * as THREE from 'three';
import { createStaticBatch } from './staticBatch';
it('batches grouped single-material boxes without losing transformed bounds or touching shared geometry', () => {
 const source=new THREE.Group();source.position.set(3,2,1);
 const geometry=new THREE.BoxGeometry(2,1,3), material=new THREE.MeshStandardMaterial();
 const a=new THREE.Mesh(geometry,material),b=new THREE.Mesh(geometry,material);
 b.position.set(4,0,-2);source.add(a,b);source.updateMatrixWorld(true);
 const before=new THREE.Box3().setFromObject(source);const groups=geometry.groups.length;
 const batch=createStaticBatch(source);assert.equal(batch.callsBefore,2);assert.equal(batch.callsAfter,1);
 batch.setActive(true);assert.equal(a.visible,false);assert.equal(b.visible,false);
 source.updateMatrixWorld(true);const after=new THREE.Box3().setFromObject(batch.root);
 assert.ok(before.min.distanceTo(after.min)<1e-6);assert.ok(before.max.distanceTo(after.max)<1e-6);
 assert.equal(geometry.groups.length,groups);
 batch.dispose();assert.equal(a.visible,true);assert.equal(b.visible,true);
 geometry.dispose();material.dispose();
});
it('retains material-array, dynamic and hidden meshes outside the static batch', () => {
 const source=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();
 const multi=new THREE.Mesh(geometry,[material,material]),dynamic=new THREE.Mesh(geometry,material),hidden=new THREE.Mesh(geometry,material);
 dynamic.userData.dynamic=true;hidden.visible=false;source.add(multi,dynamic,hidden);
 const batch=createStaticBatch(source);assert.equal(batch.callsBefore,0);batch.setActive(true);
 assert.equal(multi.visible,true);assert.equal(dynamic.visible,true);assert.equal(hidden.visible,false);
 batch.dispose();geometry.dispose();material.dispose();
});

it('combines differently colored PBR parts while preserving their exact surface attributes',()=>{
 const source=new THREE.Group(),geometry=new THREE.BoxGeometry();
 const a=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x275c53,roughness:.62}));
 const b=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xe3a64d,roughness:.32,metalness:.65}));
 b.position.x=2;source.add(a,b);
 const batch=createStaticBatch(source);assert.equal(batch.callsAfter,1);
 const g=batch.geometries[0];assert.ok(g.attributes.color);assert.ok(g.attributes.batchSurface);
 const roughness=new Set(Array.from(g.attributes.batchSurface.array).filter((_,i)=>i%2===0).map(v=>Math.round(v*100)));
 assert.deepEqual([...roughness].sort(),[32,62]);
 assert.equal(geometry.attributes.color,undefined);
 batch.dispose();geometry.dispose();a.material.dispose();b.material.dispose();
});

it('keeps remote architecture in separately culled cells without dropping geometry',()=>{
 const source=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();
 for(const x of [-40,0,40]){const m=new THREE.Mesh(geometry,material);m.position.x=x;source.add(m);}
 const batch=createStaticBatch(source,{cellSize:8});batch.setActive(true);
 assert.equal(batch.callsAfter,3);
 const bounds=batch.geometries.map(g=>{g.computeBoundingBox();return g.boundingBox!;});
 assert.equal(bounds.filter(b=>b.intersectsBox(new THREE.Box3(new THREE.Vector3(-4,-4,-4),new THREE.Vector3(4,4,4)))).length,1);
 assert.equal(batch.geometries.reduce((n,g)=>n+g.index!.count,0),108);
 batch.dispose();geometry.dispose();material.dispose();
});

it('compacts anonymous source nodes reversibly and keeps named surface handles',()=>{
 const source=new THREE.Group(),child=new THREE.Group();source.add(child);
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();
 const a=new THREE.Mesh(geometry,material),top=new THREE.Mesh(geometry,material);top.name='tableFurniture';
 child.add(a,top);
 const batch=createStaticBatch(source,{compact:true});batch.setActive(true);
 assert.equal(a.parent,null);assert.equal(source.getObjectByName('tableFurniture'),top);
 batch.setActive(false);assert.equal(a.parent,child);assert.equal(a.visible,true);
 batch.setActive(true);batch.rebuild();assert.equal(a.parent,null);
 batch.dispose();assert.equal(a.parent,child);assert.equal(a.visible,true);
 geometry.dispose();material.dispose();
});

it('leaves mutable paint and partial draw ranges live',()=>{
 const source=new THREE.Group(),paint=new THREE.MeshStandardMaterial();paint.userData.mutableColor=true;
 const geometry=new THREE.BoxGeometry(),wall=new THREE.Mesh(geometry,paint);
 const partialGeometry=geometry.clone();partialGeometry.setDrawRange(0,6);
 const partial=new THREE.Mesh(partialGeometry,paint);source.add(wall,partial);
 const batch=createStaticBatch(source);batch.setActive(true);
 assert.equal(batch.callsBefore,1);assert.equal(partial.visible,true);
 assert.equal((batch.root.children[0] as THREE.Mesh).material,paint);
 paint.color.setHex(0xff0000);assert.equal(((batch.root.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHex(),0xff0000);
 batch.dispose();geometry.dispose();partialGeometry.dispose();paint.dispose();
});

it('bakes explicitly static instances with their individual transforms and colors, then restores one owner',()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:0xffffff}),geometry=new THREE.BoxGeometry();
 root.position.set(4,2,-1);
 const instances=new THREE.InstancedMesh(geometry,material,2),matrix=new THREE.Matrix4();root.add(instances);
 instances.setMatrixAt(0,matrix.makeTranslation(-2,0,0));instances.setMatrixAt(1,matrix.makeTranslation(2,0,0));
 instances.setColorAt(0,new THREE.Color(1,0,0));instances.setColorAt(1,new THREE.Color(0,1,0));
 const original=createStaticBatch(root);assert.equal(original.callsBefore,0);original.dispose();
 const batch=createStaticBatch(root,{bakeInstances:true,compact:true});
 assert.equal(batch.callsBefore,1);assert.equal(batch.callsAfter,1);assert.equal(batch.sourceMeshes.length,1);
 assert.equal(batch.geometries[0].index!.count,72);
 const color=batch.geometries[0].attributes.color;assert.ok(Array.from({length:color.count},(_,i)=>color.getX(i)).includes(1));
 assert.ok(Array.from({length:color.count},(_,i)=>color.getY(i)).includes(1));
 batch.setActive(true);assert.equal(instances.parent,null);
 batch.dispose();assert.equal(instances.parent,root);assert.equal(instances.visible,true);assert.equal(instances.count,2);
 assert.equal(geometry.attributes.color,undefined);
});

it('preserves front faces of mirrored geometry',()=>{
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
 mesh.scale.set(-2,1,.6);root.add(mesh);
 const batch=createStaticBatch(root),geometry=batch.geometries[0];
 const p=geometry.attributes.position,n=geometry.attributes.normal,index=geometry.index!;
 for(let i=0;i<index.count;i+=3){
  const triangle=new THREE.Triangle(...[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index.getX(i+k))) as [THREE.Vector3,THREE.Vector3,THREE.Vector3]);
  assert.ok(triangle.getNormal(new THREE.Vector3()).dot(new THREE.Vector3().fromBufferAttribute(n,index.getX(i)))>.999);
 }
 batch.dispose();
});

it('retains child attachments and per-object render callbacks',()=>{
 const root=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();
 const labelled=new THREE.Mesh(geometry,material),custom=new THREE.Mesh(geometry,material);
 const label=new THREE.Sprite(new THREE.SpriteMaterial());labelled.add(label);
 custom.onBeforeRender=()=>{};root.add(labelled,custom);
 const batch=createStaticBatch(root,{compact:true});batch.setActive(true);
 assert.equal(batch.callsBefore,0);assert.equal(label.parent,labelled);assert.equal(labelled.visible,true);assert.equal(custom.parent,root);
 batch.dispose();
});
