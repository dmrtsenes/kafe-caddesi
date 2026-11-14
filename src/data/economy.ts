/** Product balance v5: tight mid/late sink pacing so cash stays scarce and rewarded ads stay high-value. */
export const ZONE_COSTS: Record<string, number> = {
  a1: 0, t1: 300, a3: 1350, t2: 2400, a4: 4800, t3: 7200,
  a5: 10500, t4: 13500, a6: 19500, t5: 24000, r1: 38000,
  a7: 52000, t6: 42000, a8: 88000, t7: 62000,
  z_muzik: 28000, z_vitrin: 44000, z_tabela: 68000,
  r2: 155000, v1: 125000, v2: 165000,
  p1: 0, p2: 240000, p3: 500000, p4: 740000, p5: 1100000, p6: 330000,
};
export const BRANCH_COSTS = { kose: 0, sahil: 380000 } as const;
export const BRANCH_STAFF_MULTIPLIER = 3.2;
/** Ordinary area rewards return 25% of the paid expansion cost. */
export const zoneReward = (zone: string): number => Math.round((ZONE_COSTS[zone] ?? 0) * 0.25);
