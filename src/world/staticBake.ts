/** Duran kafe ne zaman yeniden boyanır (karakterler her kare). */

export const CAMERA_MOVE_EPS = 0.18;
export const CAMERA_MOVE_EPS_HEAT = 0.28;

export function cameraMoveEpsilon(heat: number): number {
  return heat >= 1 ? CAMERA_MOVE_EPS_HEAT : CAMERA_MOVE_EPS;
}

export function shouldBakeStatic(dirty: boolean, cameraMoved: boolean, force = false): boolean {
  return force || dirty || cameraMoved;
}

export function cameraMovedEnough(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  eps = CAMERA_MOVE_EPS,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  return dx * dx + dy * dy + dz * dz >= eps * eps;
}
