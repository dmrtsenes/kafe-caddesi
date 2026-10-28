/** Continuous circle/rounded-rectangle contact, shared by movement and routing. */
export interface Contact { time: number; nx: number; nz: number }

export function overlaps(
  x: number, z: number, radius: number,
  x0: number, z0: number, x1: number, z1: number, corner = 0,
): boolean {
  if (x <= x0 - radius || x >= x1 + radius || z <= z0 - radius || z >= z1 + radius) return false;
  const dx = Math.max(x0 + corner - x, 0, x - (x1 - corner));
  const dz = Math.max(z0 + corner - z, 0, z - (z1 - corner));
  const r = corner + radius;
  return r === 0 || dx * dx + dz * dz < r * r - 1e-12;
}

/** Writes only an earlier inward contact; touching and moving away stays free. */
export function sweep(
  x: number, z: number, dx: number, dz: number, radius: number,
  x0: number, z0: number, x1: number, z1: number, corner: number, out: Contact,
): void {
  if (Math.max(x, x + dx) < x0 - radius || Math.min(x, x + dx) > x1 + radius ||
      Math.max(z, z + dz) < z0 - radius || Math.min(z, z + dz) > z1 + radius) return;
  const lx = x0 + corner, hx = x1 - corner;
  const lz = z0 + corner, hz = z1 - corner;
  const r = radius + corner;
  if (dx !== 0) {
    const t = ((dx > 0 ? lx - r : hx + r) - x) / dx;
    const atZ = z + dz * t;
    if (t >= -1e-9 && t <= out.time && atZ >= lz && atZ <= hz) {
      out.time = Math.max(0, t); out.nx = dx > 0 ? -1 : 1; out.nz = 0;
    }
  }
  if (dz !== 0) {
    const t = ((dz > 0 ? lz - r : hz + r) - z) / dz;
    const atX = x + dx * t;
    if (t >= -1e-9 && t <= out.time && atX >= lx && atX <= hx) {
      out.time = Math.max(0, t); out.nx = 0; out.nz = dz > 0 ? -1 : 1;
    }
  }
  const speed2 = dx * dx + dz * dz;
  if (r <= 0 || speed2 < 1e-16) return;
  for (let i = 0; i < 4; i++) {
    const cx = i & 1 ? hx : lx, cz = i & 2 ? hz : lz;
    const ox = x - cx, oz = z - cz;
    const b = ox * dx + oz * dz;
    const discriminant = b * b - speed2 * (ox * ox + oz * oz - r * r);
    if (discriminant <= 1e-14) continue; // A tangent does not enter the obstacle.
    const t = (-b - Math.sqrt(discriminant)) / speed2;
    if (t < -1e-9 || t > out.time) continue;
    const nx = (ox + dx * t) / r, nz = (oz + dz * t) / r;
    if (nx * dx + nz * dz >= -1e-10) continue;
    out.time = Math.max(0, t); out.nx = nx; out.nz = nz;
  }
}
