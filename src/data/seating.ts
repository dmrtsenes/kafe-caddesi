/** Shared by furniture and navigation; reveal animation must never move service targets. */
export const SEAT_RADIUS = 1.55;
/** Chair collision: wider than the .635 premium chair and deep enough for a seated guest's knees. */
export const CHAIR_BODY = { halfWidth: .3675, halfDepth: .35, corner: .025 } as const;
/**
 * Oturan müşteri kökünün koltuk merkezine göre kalibrasyonu (oturma klibi
 * ölçülerek): `drop` kalçayı (kökün 0,605 üstü) minder üstüne (0,5525)
 * birkaç mm gömer, `back` alt sırtı arkalık minderinin ön yüzüne (−0,075)
 * yaslar. Baldırlar oturak ön kenarının (0,165) önünde kalır; sandalye
 * ölçüleri `addPremiumChair` ile birlikte değişmelidir.
 */
export const CHAIR_SIT = { drop: .06, back: .06 } as const;
/** Tuck only the crowded rows; furniture sizes and table positions stay intact. */
const SEAT_RADII: Readonly<Record<string, number>> = {
  k_masa_3: 1.4, k_masa_6: 1.4,
  k_masa_7: 1.3, k_masa_8: 1.3,
  k_vip_1: 1.25, k_vip_2: 1.25, k_vip_3: 1.25,
};
export function seatRadius(tableId: string, seats = 0): number {
  // Three seats sit diagonally against a square top and need more knee room.
  if (tableId.startsWith('k_vip_') && seats === 3) return 1.4;
  return SEAT_RADII[tableId] ?? SEAT_RADIUS;
}
export function seatAngle(visual: string, seats: number, index: number): number {
  const square = visual === 'tablesq' || visual === 'viptable';
  const base = seats === 2 ? Math.PI / 2 : square ? 0 : Math.PI / 4;
  return base + (index / Math.max(1, seats)) * Math.PI * 2;
}

/** Keep the service approach between chairs, including capacity upgrades. */
export function tableServiceAngle(visual: string, seats: number): number {
  let best = Math.PI, error = Infinity;
  for (let i = 0; i < Math.max(1, seats); i++) {
    const angle = seatAngle(visual, seats, i) + Math.PI / Math.max(1, seats);
    const delta = Math.abs(Math.atan2(Math.sin(angle - Math.PI), Math.cos(angle - Math.PI)));
    if (delta < error - 1e-8) { error = delta; best = angle; }
  }
  return best;
}
