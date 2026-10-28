/** Product balance v3: measured active-play pacing; expansion rewards share the price source. */
export const ZONE_COSTS: Record<string, number> = {
  a1: 0, t1: 300, a3: 1100, t2: 1900, a4: 3400, t3: 4800,
  a5: 5000, t4: 6500, a6: 9000, t5: 9000, r1: 12500,
  a7: 14000, t6: 13500, a8: 26000, t7: 18500,
  z_muzik: 8000, z_vitrin: 12000, z_tabela: 18000,
  r2: 48000, v1: 36000, v2: 46000,
  p1: 0, p2: 115000, p3: 210000, p4: 310000, p5: 460000, p6: 155000,
};
export const BRANCH_COSTS = { kose: 0, sahil: 145000 } as const;
export const BRANCH_STAFF_MULTIPLIER = 2.8;
/** Ordinary area rewards return 30% of the paid expansion cost. */
export const zoneReward = (zone: string): number => Math.round((ZONE_COSTS[zone] ?? 0) * 0.3);
