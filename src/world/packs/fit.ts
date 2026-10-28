export interface Size {
  x: number;
  y: number;
  z: number;
}

export function scaleToFitXZ(size: Size, targetXZ: number): number {
  const current = Math.max(size.x, size.z);
  if (!(current > 1e-6) || !(targetXZ > 0)) return 1;
  return targetXZ / current;
}

export function scaleToFitHeight(size: Size, targetH: number): number {
  if (!(size.y > 1e-6) || !(targetH > 0)) return 1;
  return targetH / size.y;
}

/** After uniform scale, shift so y-min sits on the floor and xz is centered. */
export function floorOffset(min: Size, max: Size, scale: number): Size {
  return {
    x: -((min.x + max.x) * 0.5) * scale,
    y: -min.y * scale,
    z: -((min.z + max.z) * 0.5) * scale,
  };
}
