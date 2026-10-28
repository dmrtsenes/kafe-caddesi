import * as THREE from 'three';

// Current cast has at most ten source materials; one fixed shader serves all models.
export const CAST_PALETTE_SIZE = 16;

/** An actor owns only its small outfit palette. Topology and GPU buffers are shared. */
export function createPaletteMaterial(colors: readonly THREE.Color[]): THREE.MeshToonMaterial {
  if (colors.length >= CAST_PALETTE_SIZE) throw new Error('Character palette exceeds the shader budget');
  const palette = Array.from({length:CAST_PALETTE_SIZE},(_,i)=>i > 0 && i <= colors.length ? colors[i-1].clone() : new THREE.Color(0));
  const material = new THREE.MeshToonMaterial();
  material.name = 'CafeCastPalette';
  material.onBeforeCompile = shader => {
    shader.uniforms.fincanPalette = {value:palette};
    shader.vertexShader = `attribute float fincanColor; uniform vec3 fincanPalette[${CAST_PALETTE_SIZE}]; varying vec3 vFincanColor;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\nvFincanColor = fincanPalette[int(fincanColor)];');
    shader.fragmentShader = 'varying vec3 vFincanColor;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vFincanColor;');
  };
  material.customProgramCacheKey = () => 'fincan-cast-palette-v1';
  return material;
}
