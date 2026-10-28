import { BALANCE } from './balance';

/** The northern courtyard bay is a separate room; the two southern pools stay. */
export const RESTROOM_SUITE = {
  x0: 9, z0: -17.35, x1: 17.2, z1: -10.15,
  door: { edge: 'w' as const, pos: -12.05, w: 2.4 },
  lift: .1,
  style: 'restroom' as const,
};

/** Shared by the porcelain model, navigation and seated customer placement. */
export const TOILET_LAYOUT = {
  halfWidth: 1.36, halfDepth: 1.4,
  seat: { x: -.48, y: .68, z: -.42 },
  approach: { x: -.48, z: .55 },
  fixtures: [
    { id: 'bowl', x: -.48, z: -.43, hx: .35, hz: .47 },
    { id: 'vanity', x: .67, z: -.88, hx: .48, hz: .36 },
    { id: 'back', x: 0, z: -1.34, hx: 1.36, hz: .06 },
    { id: 'left', x: -1.3, z: 0, hx: .06, hz: 1.4 },
    { id: 'right', x: 1.3, z: 0, hx: .06, hz: 1.4 },
  ],
} as const;

export function restroomPoint(station: { x: number; z: number; rot: number },
  local: { x: number; z: number }, out: { x: number; z: number }): void {
  const a = station.rot * Math.PI / 180, s = Math.sin(a), c = Math.cos(a);
  out.x = station.x + local.x * c + local.z * s;
  out.z = station.z - local.x * s + local.z * c;
}

export function canVisitRestroom(guest: { mealFinished: boolean; dineIn: boolean; carriedItems: readonly unknown[] }): boolean {
  return guest.dineIn && guest.mealFinished && guest.carriedItems.length === 0;
}

/** A completed, supplied visit earns a modest extra service fee. */
export function restroomUseFee(menuValue: number, saleMultiplier: number, soil: number, supplied: boolean): number {
  if (!supplied || !Number.isFinite(soil) || soil >= BALANCE.toilet.maxSoilForUse ||
      !Number.isFinite(menuValue) || menuValue <= 0 || !Number.isFinite(saleMultiplier) || saleMultiplier <= 0) return 0;
  return Math.max(1, Math.round(menuValue * saleMultiplier * BALANCE.toilet.serviceFeeRate * (1 - Math.max(0, soil) * .35)));
}
