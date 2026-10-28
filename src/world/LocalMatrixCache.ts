import { Object3D } from 'three';

/** Opt-in for furniture trees: unchanged local transforms must not force a
 * world-matrix update through the entire subtree on every render pass.
 * Animation, manual matrices, parent movement and forced updates remain live. */
export function cacheLocalMatrices(root: Object3D): void {
  root.traverse(object => {
    // Leave specialized implementations alone; also makes installation idempotent.
    if (object.updateMatrix !== Object3D.prototype.updateMatrix) return;
    const original = object.updateMatrix;
    const lastMatrix = object.matrix.clone();
    let px = NaN, py = NaN, pz = NaN;
    let qx = NaN, qy = NaN, qz = NaN, qw = NaN;
    let sx = NaN, sy = NaN, sz = NaN;
    object.updateMatrix = function () {
      const p = this.position, q = this.quaternion, s = this.scale;
      if (p.x === px && p.y === py && p.z === pz &&
          q.x === qx && q.y === qy && q.z === qz && q.w === qw &&
          s.x === sx && s.y === sy && s.z === sz &&
          this.matrix.equals(lastMatrix)) return;
      original.call(this);
      px = p.x; py = p.y; pz = p.z;
      qx = q.x; qy = q.y; qz = q.z; qw = q.w;
      sx = s.x; sy = s.y; sz = s.z;
      lastMatrix.copy(this.matrix);
    };
  });
}
