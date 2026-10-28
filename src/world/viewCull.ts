export const CHAR_CULL_Y = 1.0;
export const CHAR_CULL_RADIUS = 1.2;

export interface CullPlane {
  nx: number;
  ny: number;
  nz: number;
  constant: number;
}

/**
 * Frustum-sphere intersection test.
 * Highly performant: computes negative radius once, avoids per-plane object/function overhead.
 */
export function sphereHitsFrustum(
  cx: number,
  cy: number,
  cz: number,
  r: number,
  planes: readonly CullPlane[],
): boolean {
  const negR = -r;
  const len = planes.length;
  for (let i = 0; i < len; i++) {
    const p = planes[i];
    if (p.nx * cx + p.ny * cy + p.nz * cz + p.constant < negR) return false;
  }
  return true;
}

/**
 * Rapid 2D character position in frustum test.
 * Checks whether a sphere at (px, py, pz) intersects the frustum planes.
 */
export function pointInView(
  px: number,
  pz: number,
  planes: readonly CullPlane[],
  radius = CHAR_CULL_RADIUS,
  py = CHAR_CULL_Y,
): boolean {
  const negR = -radius;
  const len = planes.length;
  for (let i = 0; i < len; i++) {
    const p = planes[i];
    if (p.nx * px + p.ny * py + p.nz * pz + p.constant < negR) return false;
  }
  return true;
}

/**
 * Frustum-AABB (Axis-Aligned Bounding Box) intersection test.
 * Uses positive vertex testing per plane for optimal performance.
 */
export function boxHitsFrustum(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  planes: readonly CullPlane[],
): boolean {
  const len = planes.length;
  for (let i = 0; i < len; i++) {
    const p = planes[i];
    const px = p.nx > 0 ? maxX : minX;
    const py = p.ny > 0 ? maxY : minY;
    const pz = p.nz > 0 ? maxZ : minZ;
    if (p.nx * px + p.ny * py + p.nz * pz + p.constant < 0) return false;
  }
  return true;
}

/**
 * Frustum check for 2D horizontal footprint with default world height bounds.
 */
export function box2DHitsFrustum(
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  planes: readonly CullPlane[],
  minY = -1,
  maxY = 5,
): boolean {
  return boxHitsFrustum(minX, minY, minZ, maxX, maxY, maxZ, planes);
}

/**
 * Extracts normalized cull planes from a Three.js Frustum into a reusable CullPlane array.
 * Zero heap allocations if a reusable target array is passed.
 */
export function extractCullPlanes(
  frustum: {
    readonly planes: readonly {
      readonly normal: { readonly x: number; readonly y: number; readonly z: number };
      readonly constant: number;
    }[];
  },
  target?: CullPlane[],
): CullPlane[] {
  const out = target ?? [];
  const src = frustum.planes;
  const len = src.length;
  for (let i = 0; i < len; i++) {
    const s = src[i];
    const n = s.normal;
    const t = out[i];
    if (t) {
      t.nx = n.x;
      t.ny = n.y;
      t.nz = n.z;
      t.constant = s.constant;
    } else {
      out[i] = { nx: n.x, ny: n.y, nz: n.z, constant: s.constant };
    }
  }
  out.length = len;
  return out;
}

/**
 * Directly extracts the 6 normalized frustum planes from a projection * view matrix (column-major).
 * Avoids Three.js Frustum object instantiation.
 */
export function extractCullPlanesFromMatrix(
  matrix: { readonly elements: ArrayLike<number> },
  target?: CullPlane[],
): CullPlane[] {
  const m = matrix.elements;
  const m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3];
  const m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7];
  const m8 = m[8], m9 = m[9], m10 = m[10], m11 = m[11];
  const m12 = m[12], m13 = m[13], m14 = m[14], m15 = m[15];

  const out = target ?? [];
  // 6 planes: right, left, bottom, top, far, near (matching Three.js Frustum plane indexing)
  const raw = [
    m3 - m0, m7 - m4, m11 - m8, m15 - m12,
    m3 + m0, m7 + m4, m11 + m8, m15 + m12,
    m3 + m1, m7 + m5, m11 + m9, m15 + m13,
    m3 - m1, m7 - m5, m11 - m9, m15 - m13,
    m3 - m2, m7 - m6, m11 - m10, m15 - m14,
    m3 + m2, m7 + m6, m11 + m10, m15 + m14,
  ];

  for (let i = 0; i < 6; i++) {
    const o = i * 4;
    let x = raw[o], y = raw[o + 1], z = raw[o + 2], w = raw[o + 3];
    const len = Math.hypot(x, y, z);
    const inv = len > 1e-6 ? 1 / len : 0;
    x *= inv;
    y *= inv;
    z *= inv;
    w *= inv;
    const t = out[i];
    if (t) {
      t.nx = x;
      t.ny = y;
      t.nz = z;
      t.constant = w;
    } else {
      out[i] = { nx: x, ny: y, nz: z, constant: w };
    }
  }
  out.length = 6;
  return out;
}

/**
 * Reusable frustum culler holding 6 preallocated planes with zero-allocation query methods.
 */
export class FrustumCuller {
  readonly planes: CullPlane[] = Array.from({ length: 6 }, () => ({
    nx: 0,
    ny: 0,
    nz: 0,
    constant: 0,
  }));

  updateFromFrustum(frustum: {
    readonly planes: readonly {
      readonly normal: { readonly x: number; readonly y: number; readonly z: number };
      readonly constant: number;
    }[];
  }): void {
    extractCullPlanes(frustum, this.planes);
  }

  updateFromMatrix(matrix: { readonly elements: ArrayLike<number> }): void {
    extractCullPlanesFromMatrix(matrix, this.planes);
  }

  sphereInView(cx: number, cy: number, cz: number, r: number): boolean {
    return sphereHitsFrustum(cx, cy, cz, r, this.planes);
  }

  pointInView(px: number, pz: number, radius = CHAR_CULL_RADIUS, py = CHAR_CULL_Y): boolean {
    return pointInView(px, pz, this.planes, radius, py);
  }

  boxInView(
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number,
  ): boolean {
    return boxHitsFrustum(minX, minY, minZ, maxX, maxY, maxZ, this.planes);
  }

  box2DInView(
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
    minY = -1,
    maxY = 5,
  ): boolean {
    return box2DHitsFrustum(minX, minZ, maxX, maxZ, this.planes, minY, maxY);
  }
}
