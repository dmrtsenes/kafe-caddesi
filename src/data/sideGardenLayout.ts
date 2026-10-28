import type { LocationDef } from './layouts';
import { RESTROOM_SUITE } from './restrooms';

export type SideGardenId = 'garden' | 'courtyard';
export interface SideGardenRect { x0: number; z0: number; x1: number; z1: number }
export interface SideGardenPoint { x: number; z: number }
export interface SideGardenLayout {
  id: SideGardenId;
  sign: -1 | 1;
  bench: SideGardenPoint;
  service: SideGardenPoint;
  purchase: SideGardenPoint;
}

export const SIDE_GARDEN_SECTIONS = [-13, -4.1, 4.7] as const;
/** Geometry and collisions share these dimensions. Both paths fit the .68 m nav body. */
export const SIDE_COURTYARD = {
  pool: { x: 12.2, width: 3.6, depth: 6.65, rim: 0.18 },
  planting: { x: 15.95, width: 1.84, depth: 6.25 },
  innerWalkX: 10,
  outerWalkX: 14.5,
} as const;
export const SIDE_GARDEN_PORTAL = { z0: -9.65, z1: -7.55, z: -8.6 } as const;
export const SIDE_GARDEN_LAYOUT: Record<SideGardenId, SideGardenLayout> = {
  garden: { id: 'garden', sign: -1, bench: { x: -12.35, z: -8.6 }, service: { x: -11.4, z: -8.6 }, purchase: { x: -7.9, z: -7 } },
  courtyard: { id: 'courtyard', sign: 1, bench: { x: 12.35, z: -8.6 }, service: { x: 11.4, z: -8.6 }, purchase: { x: 7.9, z: -7 } },
};

export function sideGardenGate(id: SideGardenId): SideGardenRect {
  const x = SIDE_GARDEN_LAYOUT[id].sign * 9;
  return { x0: x - 0.15, x1: x + 0.15, z0: SIDE_GARDEN_PORTAL.z0, z1: SIDE_GARDEN_PORTAL.z1 };
}

/** Same curb segments are used for drawing and navigation, including the door gap. */
export function sideGardenCurbs(sign: -1 | 1): SideGardenRect[] {
  const rect = (x: number, z: number, w: number, d: number): SideGardenRect => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  const innerX = sign * 9.4;
  return [
    ...(sign < 0 ? [{ x0: innerX - 0.1, x1: innerX + 0.1, z0: -17.5, z1: SIDE_GARDEN_PORTAL.z0 }]
      : [
        { x0: innerX - 0.1, x1: innerX + 0.1, z0: -17.5, z1: RESTROOM_SUITE.door.pos - RESTROOM_SUITE.door.w / 2 },
        { x0: innerX - 0.1, x1: innerX + 0.1, z0: RESTROOM_SUITE.door.pos + RESTROOM_SUITE.door.w / 2, z1: SIDE_GARDEN_PORTAL.z0 },
      ]),
    { x0: innerX - 0.1, x1: innerX + 0.1, z0: SIDE_GARDEN_PORTAL.z1, z1: 9.2 },
    rect(sign * 17.2, -4.15, 0.2, 26.7),
    ...(sign < 0 ? [rect(sign * 13.3, -17.4, 8, 0.2)] : []),
    rect(sign * 13.3, 9.1, 8, 0.2),
  ];
}

/** Real solid footprints only: all remaining stone walks are traversable. */
export function sideGardenObstacles(loc: Pick<LocationDef, 'id'>): SideGardenRect[] {
  if (loc.id !== 'kose') return [];
  const out: SideGardenRect[] = [];
  const add = (x: number, z: number, w: number, d: number): void => { out.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }); };
  out.push(...sideGardenCurbs(-1), ...sideGardenCurbs(1));
  for (const z of SIDE_GARDEN_SECTIONS) {
    add(-14.7, z, 3.95, 6.25); // Planted beds contain all tree trunks.
    if (z > RESTROOM_SUITE.z1) {
      add(SIDE_COURTYARD.planting.x, z, SIDE_COURTYARD.planting.width, SIDE_COURTYARD.planting.depth);
      add(SIDE_COURTYARD.pool.x, z, SIDE_COURTYARD.pool.width, SIDE_COURTYARD.pool.depth);
    }
    add(-10.96, z, 0.84, 2.35); // Cafe-facing bench and its armrests.
    // Flower bowls sit inside the planting beds, leaving both bench approaches clear.
  }
  for (const layout of Object.values(SIDE_GARDEN_LAYOUT)) {
    add(layout.bench.x, layout.bench.z, 0.9, 1.6);
  }
  return out;
}
