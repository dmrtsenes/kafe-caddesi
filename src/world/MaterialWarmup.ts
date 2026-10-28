import type * as THREE from 'three';

/**
 * Materials a mesh switches to later — a locked cover's grey variant, or the
 * real material while the grey one is shown — are on no mesh when the idle
 * shader warm-up walks the scene. Their owners register a provider that,
 * when the warm-up runs, lists each such material with the mesh that will
 * draw it. Providers run late on purpose: furniture is batched after the
 * cover is bound, so only the final meshes are known by then.
 */
export type MaterialWarmProvider = (add: (mesh: THREE.Mesh, material: THREE.Material) => void) => void;

export interface MaterialWarm {
  mesh: THREE.Mesh;
  material: THREE.Material;
}

const providers: MaterialWarmProvider[] = [];

export function queueMaterialWarm(provider: MaterialWarmProvider): void {
  providers.push(provider);
}

/** Runs and forgets the queued providers. */
export function takeMaterialWarms(): MaterialWarm[] {
  const out: MaterialWarm[] = [];
  const add = (mesh: THREE.Mesh, material: THREE.Material) => { out.push({ mesh, material }); };
  for (const provider of providers.splice(0, providers.length)) provider(add);
  return out;
}
