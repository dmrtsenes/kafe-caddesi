import * as THREE from 'three';
interface Cover { root: THREE.Object3D; bounds: THREE.Box3; materials: THREE.Material[]; opacity: number; }
/** Fade only a blocking canopy, keeping furniture and floor readable and collidable. */
export class ViewOcclusion {
 private dirty = true;
 private readonly covers: Cover[] = [];
 private readonly ray = new THREE.Ray();
 private readonly hit = new THREE.Vector3();
 private readonly direction = new THREE.Vector3();
 private readonly target = new THREE.Vector3();
 invalidate(): void { this.dirty = true; }
 update(scene: THREE.Scene, camera: THREE.Camera, player: THREE.Vector3): void {
  if (this.dirty) {
   this.covers.length=0;
   // Only the canopies' own transforms are needed; a forced whole-scene
   // update here recomputed every bone and settled matrix on each rebuild.
   scene.traverse(root=>{
    if(!root.userData.viewOccluder)return;
    root.updateWorldMatrix(true,false);
    const materials=new Set<THREE.Material>();
    root.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.isMesh)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(m);});
    this.covers.push({root,bounds:new THREE.Box3().setFromObject(root).expandByScalar(.12),materials:[...materials],opacity:1});
   });
   this.dirty=false;
  }
  this.target.copy(player);this.target.y+=1.0;
  this.ray.origin.setFromMatrixPosition(camera.matrixWorld);
  this.direction.subVectors(this.target,this.ray.origin);
  const distance=this.direction.length();this.ray.direction.copy(this.direction).divideScalar(Math.max(.001,distance));
  for(const cover of this.covers){
   const hit=this.ray.intersectBox(cover.bounds,this.hit);
   const blocked=!!hit&&this.ray.origin.distanceTo(this.hit)<distance-.1;
   // Immediate reveal avoids a few frames of a hidden player on fast turns.
   // Restore gradually; opacity always shares a single transparent shader variant.
   const nextOpacity=blocked?.16:Math.min(1,cover.opacity+.14);
   if(cover.opacity!==nextOpacity){
    cover.opacity=nextOpacity;
    for(const material of cover.materials)material.opacity=nextOpacity;
   }
   cover.root.userData.occludingPlayer=blocked;
  }
 }
 dispose():void{this.covers.length=0;this.dirty=true;}
}
