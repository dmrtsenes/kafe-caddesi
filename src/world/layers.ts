import type { Object3D } from 'three';

export const LAYER_STATIC = 0;
export const LAYER_DYNAMIC = 1;
/** Fixed surface lettering is drawn after edge smoothing, retaining scene depth. */
export const LAYER_SURFACE_LABEL = 2;
/** Lettering joins the main pass on phones; this keeps it after every scene object. */
export const LABEL_RENDER_ORDER = 100;

export function markDynamic(obj: Object3D): void {
  obj.traverse((o) => {
    o.layers.set(o.userData.fixedLabel ? LAYER_SURFACE_LABEL : LAYER_DYNAMIC);
    o.userData.dynamic = true;
  });
}
