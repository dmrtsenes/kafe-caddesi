import * as THREE from 'three';
import type { Palette } from './Appearance';
import type { CharRole } from './types';

/** Fincan's player colors; only fabric and accessories consume this palette. */
export const FINCAN_PLAYER_WORKWEAR = Object.freeze({
  main: 0x246f73,
  edge: 0xf1e6cf,
  cap: 0xe9ddc3,
  badge: 0xce8758,
  pants: 0x293b43,
  shoes: 0x233139,
  apron: 0x183f43,
  strap: 0xb6784d,
});

export interface WorkwearPalette {
  main: number;
  edge: number;
  cap: number;
  badge: number;
  pants: number;
  shoes: number;
  apron?: number;
  strap?: number;
  hair?: number;
}

/** Reuse the original character's role/cosmetic recipe in the local preview. */
export function roleWorkwear(role: CharRole, palette: Palette): WorkwearPalette {
  if (role === 'player') return FINCAN_PLAYER_WORKWEAR;
  return {
    main: role === 'waiter' || role === 'cashier' ? palette.shirt : palette.over,
    edge: role === 'barista' ? palette.apron : palette.shirt,
    cap: role === 'waiter' ? palette.apron : palette.hat,
    badge: palette.overAlt,
    pants: palette.pants,
    shoes: palette.shoe,
    apron: role === 'waiter' ? palette.apron : role === 'barista' ? palette.overAlt : palette.over,
    strap: role === 'barista' ? palette.hat : 0xb6784d,
  };
}

/**
 * Verified against the six visible PlayerS01 meshes and their actual UVs.
 * 0 is the untouched source texture. Skin and hair never get a fabric channel,
 * even where source colors overlap with clothing. Existing UVs remain intact.
 */
export function workwearRegion(meshName: string, u: number, v: number): number {
  if (meshName === 'P_Pants') return 5;
  if (meshName === 'P_Shoes') return 6;
  if (meshName === 'P_Shirt' && v > 0.95 && v < 0.99) {
    if (u > 0.67 && u < 0.72) return 1;
    if (u > 0.43 && u < 0.47) return 2;
  }
  if (meshName === 'hatWorker' && v > 0.88 && v < 0.94) {
    if (u > 0.88 && u < 0.93) return 3;
    if (u > 0.50 && u < 0.53) return 4;
  }
  return 0;
}

export function addWorkwearRegions(meshName: string, geometry: THREE.BufferGeometry): void {
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const channels = new Float32Array(positions.count);
  if (uv) {
    for (let vertex = 0; vertex < positions.count; vertex++) {
      channels[vertex] = workwearRegion(meshName, uv.getX(vertex), uv.getY(vertex));
    }
  }
  geometry.setAttribute('fincanCloth', new THREE.BufferAttribute(channels, 1));
  geometry.setAttribute('fincanPattern', new THREE.BufferAttribute(new Float32Array(positions.count * 2), 2));
}

/** One shared toon material per role/uniform recipe, with no extra draw pass. */
export function createWorkwearMaterial(
  source: THREE.MeshToonMaterial,
  palette: WorkwearPalette,
  pattern = 0,
): THREE.MeshToonMaterial {
  const material = source.clone();
  material.name = 'Fincan_Workwear';
  material.color.setHex(0xffffff);
  const colors = Object.fromEntries(
    Object.entries({ apron: palette.main, strap: palette.badge, hair: 0x493126, ...palette })
      .map(([key, value]) => [key, { value: new THREE.Color(value) }]),
  );
  material.onBeforeCompile = (shader) => {
    shader.uniforms.fincanMain = colors.main;
    shader.uniforms.fincanEdge = colors.edge;
    shader.uniforms.fincanCap = colors.cap;
    shader.uniforms.fincanBadge = colors.badge;
    shader.uniforms.fincanPants = colors.pants;
    shader.uniforms.fincanShoes = colors.shoes;
    shader.uniforms.fincanApron = colors.apron;
    shader.uniforms.fincanStrap = colors.strap;
    shader.uniforms.fincanHair = colors.hair;
    shader.uniforms.fincanPatternMode = { value: pattern };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float fincanCloth;\nattribute vec2 fincanPattern;\nvarying float vFincanCloth;\nvarying vec2 vFincanPattern;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFincanCloth = fincanCloth;\nvFincanPattern = fincanPattern;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', [
        '#include <common>',
        'varying float vFincanCloth;',
        'uniform vec3 fincanMain;',
        'uniform vec3 fincanEdge;',
        'uniform vec3 fincanCap;',
        'uniform vec3 fincanBadge;',
        'uniform vec3 fincanPants;',
        'uniform vec3 fincanShoes;',
        'uniform vec3 fincanApron;',
        'uniform vec3 fincanStrap;',
        'uniform vec3 fincanHair;',
        'uniform float fincanPatternMode;',
        'varying vec2 vFincanPattern;',
      ].join('\n'))
      .replace('#include <map_fragment>', [
        '#include <map_fragment>',
        'if (vFincanCloth > 0.5) {',
        '  diffuseColor.rgb = vFincanCloth < 1.5 ? fincanMain :',
        '    vFincanCloth < 2.5 ? fincanEdge :',
        '    vFincanCloth < 3.5 ? fincanCap :',
        '    vFincanCloth < 4.5 ? fincanBadge :',
        '    vFincanCloth < 5.5 ? fincanPants :',
        '    vFincanCloth < 6.5 ? fincanShoes :',
        '    vFincanCloth < 7.5 ? fincanApron :',
        '    vFincanCloth < 8.5 ? fincanStrap : fincanHair;',
        '  if (vFincanCloth < 1.5 && fincanPatternMode > 0.5) {',
        '    float panel = fincanPatternMode < 1.5 ? 1.0 - step(0.18, fract(vFincanPattern.y * 25.0)) : step(0.59, vFincanPattern.y);',
        '    diffuseColor.rgb = mix(diffuseColor.rgb, fincanEdge, panel * 0.9);',
        '  }',
        '}',
      ].join('\n'));
  };
  material.customProgramCacheKey = () => 'fincan-workwear-signature-v2';
  return material;
}
