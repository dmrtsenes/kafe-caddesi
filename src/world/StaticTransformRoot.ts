import { Group } from 'three';

/** Opt-in root for immutable transform trees (merged geometry and street).
 * Visibility/material changes remain live. Parent moves and explicit forced
 * bounds updates still propagate, as do additions to a flat batch root. */
export class StaticTransformRoot extends Group {
  constructor() {
    super();
    this.matrixAutoUpdate = false;
    this.addEventListener('childadded', () => { this.matrixWorldNeedsUpdate = true; });
  }
  override updateMatrixWorld(force?: boolean): void {
    if (force || this.matrixAutoUpdate || this.matrixWorldNeedsUpdate)
      super.updateMatrixWorld(force);
  }
}
