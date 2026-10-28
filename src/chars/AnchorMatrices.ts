import type { Object3D } from 'three';

/** Update only the shared ancestor paths of hand/head anchors. The renderer
 * still updates the complete skin once; anchor queries must not do it again. */
export class AnchorMatrices {
  private readonly nodes: Object3D[] = [];
  private readonly root: Object3D;
  constructor(root: Object3D, anchors: readonly Object3D[]) {
    this.root = root;
    const seen = new Set<Object3D>([root]);
    const include = (node: Object3D): void => {
      if (seen.has(node)) return;
      if (!node.parent) throw new Error('Character anchor is outside its root');
      include(node.parent);
      seen.add(node);
      this.nodes.push(node);
    };
    for (const anchor of anchors) include(anchor);
  }
  update(): void {
    this.root.updateWorldMatrix(true, false);
    for (const node of this.nodes) node.updateWorldMatrix(false, false);
  }
}
