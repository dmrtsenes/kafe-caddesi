import * as THREE from 'three';

/** Fold immutable, untextured PBR finishes into vertex data. The original colors,
 * roughness and metalness remain exact; cosmetics and custom shaders stay separate. */
const shared = new Map<string, THREE.MeshStandardMaterial>();
const maps = ['map','alphaMap','aoMap','lightMap','bumpMap','normalMap','displacementMap',
  'roughnessMap','metalnessMap','emissiveMap','envMap'] as const;

export function canBakeMaterial(material: THREE.Material): material is THREE.MeshStandardMaterial {
  if (material.type !== 'MeshStandardMaterial' || material.userData.mutableColor ||
    material.transparent || material.opacity !== 1 || material.alphaTest !== 0 ||
    material.alphaHash || material.clippingPlanes?.length ||
    material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return false;
  const m = material as THREE.MeshStandardMaterial;
  if (m.wireframe || m.emissive.r !== 0 || m.emissive.g !== 0 || m.emissive.b !== 0) return false;
  return maps.every(key => !m[key]);
}

export function batchMaterial(source: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const key = JSON.stringify([source.side,source.shadowSide,source.flatShading,source.fog,
    source.depthTest,source.depthWrite,source.depthFunc,source.colorWrite,source.blending,
    source.polygonOffset,source.polygonOffsetFactor,source.polygonOffsetUnits,source.toneMapped,
    source.dithering,source.premultipliedAlpha,source.alphaToCoverage,source.precision,
    source.envMapIntensity,source.stencilWrite,source.stencilWriteMask,source.stencilFunc,
    source.stencilRef,source.stencilFuncMask,source.stencilFail,source.stencilZFail,source.stencilZPass]);
  let material = shared.get(key);
  if (material) return material;
  material = source.clone();
  material.name = 'BatchedPBR';
  material.color.setRGB(1,1,1);
  material.vertexColors = true;
  material.roughness = material.metalness = 1;
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute vec2 batchSurface; varying vec2 vBatchSurface;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\nvBatchSurface = batchSurface;');
    shader.fragmentShader = 'varying vec2 vBatchSurface;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vBatchSurface.x;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vBatchSurface.y;');
  };
  material.customProgramCacheKey = () => 'fincan-batched-pbr-v1';
  shared.set(key,material);
  return material;
}

/** Operates only on a view-owned geometry clone, never on a shared asset. */
export function bakeMaterialAttributes(geometry: THREE.BufferGeometry, source: THREE.MeshStandardMaterial): void {
  const count = geometry.getAttribute('position').count;
  const previous = source.vertexColors ? geometry.getAttribute('color') : undefined;
  const colors = new Float32Array(count * 3), surface = new Float32Array(count * 2);
  for (let i=0;i<count;i++) {
    colors[i*3] = source.color.r * (previous?.getX(i) ?? 1);
    colors[i*3+1] = source.color.g * (previous?.getY(i) ?? 1);
    colors[i*3+2] = source.color.b * (previous?.getZ(i) ?? 1);
    surface[i*2] = source.roughness;
    surface[i*2+1] = source.metalness;
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.setAttribute('batchSurface',new THREE.BufferAttribute(surface,2));
  // Map-free PBR does not consume UVs. Normalize missing UVs for batch compatibility.
  if (!geometry.getAttribute('uv')) geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(count*2),2));
}
