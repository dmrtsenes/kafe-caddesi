import type { Material, Mesh, Object3D } from 'three';
import { bus } from '../core/EventBus';
import { LAYER_DYNAMIC, LAYER_STATIC, LAYER_SURFACE_LABEL, markDynamic } from './layers';

/** Cache immutable furniture only while its installation/pop transform is at rest. */
export class SettledVisual {
  private settled = false;
  private readonly roots: readonly Object3D[];

  constructor(roots: readonly Object3D[]) {
    this.roots = roots;
    for (const root of roots) markDynamic(root);
  }

  set(settled: boolean): void {
    if (settled === this.settled || this.roots.length === 0) return;
    this.settled = settled;
    for (const root of this.roots) root.traverse(object => {
      const material = (object as Mesh).material as Material | Material[] | undefined;
      const materials = material ? (Array.isArray(material) ? material : [material]) : [];
      // Transparent glass and display labels require the live color/depth pass.
      const cached = settled && materials.every(m => m.toneMapped && !m.transparent);
      object.layers.set(object.userData.fixedLabel ? LAYER_SURFACE_LABEL : cached ? LAYER_STATIC : LAYER_DYNAMIC);
      object.userData.dynamic = !cached;
    });
    bus.emit('render:structure', {});
  }

  dispose(): void { this.set(false); }
}
