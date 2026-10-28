import { BALANCE } from '../data/balance';

const DEG = Math.PI / 180;
/**
 * Hybrid-casual arcade tycoon standard (My Perfect Hotel / My Mini Mart / Clean It):
 * ~8.8 units horizontal width so character is ~8.2% of vertical screen height
 * (~5.5x character widths across screen), keeping character & carried items juicy
 * while framing the active counter and adjacent tables across all phone aspect ratios.
 */
const PORTRAIT_VIEW_WIDTH = 8.8;

export function portraitCameraSettings(aspect = 390 / 844) {
  const fov = 40;
  const pitch = 47;
  const rawDist = PORTRAIT_VIEW_WIDTH / (2 * Math.max(0.35, aspect) * Math.tan((fov * DEG) / 2));
  const distance = Math.round(Math.max(20, Math.min(29, rawDist)) * 10) / 10;
  return {
    distance,
    fov,
    pitch,
  };
}

export function cameraFraming(width: number, height: number, _mobile = false) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  // Portrait adapts camera distance to screen aspect ratio so all phones
  // (6.1", 6.7", 19.5:9, 20:9, 16:9) show ~8.8 units of cafe width cleanly.
  if (aspect < 0.86) {
    const p = portraitCameraSettings(aspect);
    return {
      close: false,
      aspect,
      distance: p.distance,
      fov: p.fov,
      pitch: p.pitch,
      offsetY: 0,
      maxLead: 1.3,
      northPad: 9.5,
      southPad: 4.2,
      focusZOffset: 0.8,
    };
  }
  const c = BALANCE.camera;
  const raw = c.viewWidth / (2 * aspect * Math.tan((c.fov * DEG) / 2));
  let distance = Math.max(c.minDistance, Math.min(c.maxDistance, raw));
  const fov = raw > c.maxDistance
    ? Math.min(c.fovMax, (2 * Math.atan(c.viewWidth / (2 * aspect * distance))) / DEG)
    : c.fov;
  distance = Math.max(distance, c.viewWidth / (2 * aspect * Math.tan((fov * DEG) / 2)));
  return {
    close: false,
    aspect,
    distance,
    fov,
    pitch: c.pitch,
    offsetY: 0,
    maxLead: 2,
    northPad: 8.0,
    southPad: c.southPad,
    focusZOffset: 0,
  };
}

/** Keep the actor inside the usable viewport even at a room edge or a reversal. */
export function boundedCameraLead(x: number, z: number, max: number, out = { x: 0, z: 0 }) {
  const length = Math.hypot(x, z);
  const scale = length > max ? max / length : 1;
  out.x = x * scale; out.z = z * scale;
  return out;
}
