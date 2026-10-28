import assert from 'node:assert/strict';
import {it} from 'node:test';
import * as THREE from 'three';
import {ViewOcclusion} from './ViewOcclusion';
function fixture(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.1,100);
 camera.position.set(0,6,8);camera.lookAt(0,1,0);camera.updateMatrixWorld();
 const covered=new THREE.Group();covered.userData.viewOccluder=true;
 const cloth=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true});
 covered.add(new THREE.Mesh(new THREE.BoxGeometry(2,1,2),cloth));covered.position.set(0,2.9,3);scene.add(covered);
 const solid=new THREE.Mesh(new THREE.BoxGeometry(.12,3,.12),new THREE.MeshBasicMaterial());solid.position.copy(covered.position);scene.add(solid);
 return{scene,camera,covered,cloth,solid,controller:new ViewOcclusion()};
}
it('reveals a player behind a canopy while retaining the opaque support',()=>{
 const f=fixture();f.controller.update(f.scene,f.camera,new THREE.Vector3());
 assert.equal(f.cloth.opacity,.16);assert.equal(f.solid.material.opacity,1);assert.equal(f.covered.visible,true);
 f.controller.dispose();f.controller.dispose();
});
it('restores the canopy when the player moves clear and discovers a replaced world',()=>{
 const f=fixture();f.controller.update(f.scene,f.camera,new THREE.Vector3());
 for(let frame=0;frame<8;frame++)f.controller.update(f.scene,f.camera,new THREE.Vector3(5,0,0));
 assert.equal(f.cloth.opacity,1);
 f.covered.position.x=5;f.controller.invalidate();f.controller.update(f.scene,f.camera,new THREE.Vector3());
 assert.equal(f.cloth.opacity,1);assert.equal(f.covered.userData.occludingPlayer,false);
 f.controller.dispose();
});
