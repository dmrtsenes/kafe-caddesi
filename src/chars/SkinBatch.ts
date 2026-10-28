import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Merge a palette character into one skin without changing bind-space positions. */
export function mergeCharacterSkin(
  scene: THREE.Object3D,
): THREE.SkinnedMesh | null {
  scene.updateMatrixWorld(true);
  const sources: THREE.Mesh[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (
      m.isMesh &&
      m.visible &&
      m.geometry &&
      !Array.isArray(m.material) &&
      !m.morphTargetInfluences
    )
      sources.push(m);
  });
  if (sources.length < 2) return null;
  const material = sources[0].material as THREE.Material;
  if (sources.some((m) => m.material !== material)) return null;
  const bones: THREE.Bone[] = [],
    inverses: THREE.Matrix4[] = [],
    index = new Map<THREE.Bone, number>();
  const add = (bone: THREE.Bone, inverse: THREE.Matrix4) => {
    let i = index.get(bone);
    if (i !== undefined) return i;
    i = bones.length;
    index.set(bone, i);
    bones.push(bone);
    inverses.push(inverse.clone());
    return i;
  };
  for (const source of sources) {
    const skin = source as THREE.SkinnedMesh;
    if (skin.isSkinnedMesh)
      skin.skeleton.bones.forEach((bone, i) =>
        add(bone, skin.skeleton.boneInverses[i]),
      );
  }
  if (!bones.length) return null;
  let rigidRoot: THREE.Bone | undefined;
  const parts: THREE.BufferGeometry[] = [];
  for (const source of sources) {
    const geometry = source.geometry.clone();
    const count = geometry.attributes.position.count;
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    if (!geometry.attributes.uv)
      geometry.setAttribute(
        "uv",
        new THREE.BufferAttribute(new Float32Array(count * 2), 2),
      );
    const joints = new Uint16Array(count * 4),
      weights = new Float32Array(count * 4);
    const skin = source as THREE.SkinnedMesh;
    if (skin.isSkinnedMesh) {
      geometry.applyMatrix4(skin.bindMatrix);
      const si = source.geometry.attributes.skinIndex,
        sw = source.geometry.attributes.skinWeight;
      for (let v = 0; v < count; v++)
        for (let k = 0; k < 4; k++) {
          const old = si.getComponent(v, k);
          joints[v * 4 + k] = index.get(skin.skeleton.bones[old]) ?? 0;
          weights[v * 4 + k] = sw.getComponent(v, k);
        }
    } else {
      geometry.applyMatrix4(source.matrixWorld);
      let parent: THREE.Object3D | null = source.parent;
      while (parent && !(parent as THREE.Bone).isBone) parent = parent.parent;
      let bone = parent as THREE.Bone | null;
      if (!bone) {
        if (!rigidRoot) {
          rigidRoot = new THREE.Bone();
          rigidRoot.name = "characterStaticAnchor";
          scene.add(rigidRoot);
          rigidRoot.updateWorldMatrix(true, false);
        }
        bone = rigidRoot;
      }
      const existing = index.get(bone);
      if (existing !== undefined) {
        // Rigid accessories may be exported posed while skin inverse binds
        // describe rest pose; normalize both before adding the bone weight.
        geometry.applyMatrix4(new THREE.Matrix4().copy(bone.matrixWorld).invert());
        geometry.applyMatrix4(new THREE.Matrix4().copy(inverses[existing]).invert());
      }
      const joint = add(
        bone,
        new THREE.Matrix4().copy(bone.matrixWorld).invert(),
      );
      for (let v = 0; v < count; v++) {
        joints[v * 4] = joint;
        weights[v * 4] = 1;
      }
    }
    for (const name of Object.keys(geometry.attributes))
      if (!["position", "normal", "uv", "color", "fincanCloth", "fincanColor", "fincanPattern"].includes(name))
        geometry.deleteAttribute(name);
    geometry.setAttribute("skinIndex", new THREE.BufferAttribute(joints, 4));
    geometry.setAttribute("skinWeight", new THREE.BufferAttribute(weights, 4));
    // Consistent index layout avoids duplicating vertices in indexed customer models.
    if (!geometry.index)
      geometry.setIndex(Array.from({ length: count }, (_, i) => i));
    geometry.clearGroups();
    parts.push(geometry);
  }
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw Error("Character skin attribute mismatch");
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  const mesh = new THREE.SkinnedMesh(merged, material);
  mesh.name = "characterPaletteBatch";
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  scene.add(mesh);
  mesh.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());
  mesh.normalizeSkinWeights();
  for (const source of sources) source.removeFromParent();
  scene.userData.skinBatch = {
    before: sources.length,
    after: 1,
    vertices: merged.attributes.position.count,
  };
  return mesh;
}

/** Skeleton clones own GPU bone textures; geometry and palette stay shared. */
export function disposeCharacterSkeletons(root: THREE.Object3D): void {
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton);
  });
  for (const skeleton of skeletons) skeleton.dispose();
}
