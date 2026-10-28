import { Group } from "three";

/** Stable world roots can skip hidden child hierarchies during ordinary draws.
 * Forced updates still visit everything for bounds, installation and inspection. */
export class VisibilityRoot extends Group {
  constructor() {
    super();
    // Only the attached branch needs a fresh world matrix; flagging the root
    // would force every settled sibling and bone in the venue to recompute.
    this.addEventListener('childadded', event => { event.child.matrixWorldNeedsUpdate = true; });
  }
  override updateMatrixWorld(force?: boolean): void {
    // A hidden world (inactive branch) is neither drawn nor read until shown;
    // pending flags are kept and resolved on the first visible update.
    if (!force && !this.visible) return;
    if (force || this.matrixWorldNeedsUpdate ||
        (this.matrixAutoUpdate && this.updateMatrix === Group.prototype.updateMatrix)) {
      super.updateMatrixWorld(force);
      return;
    }
    // LocalMatrixCache may keep an automatic root clean. In that case its
    // hidden branches can sleep just like a manually frozen world root.
    if (this.matrixAutoUpdate) this.updateMatrix();
    if (this.matrixWorldNeedsUpdate) {
      super.updateMatrixWorld(force);
      return;
    }
    for (const child of this.children)
      if (child.visible) child.updateMatrixWorld(force);
  }
}
