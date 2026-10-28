export interface PickupArrivalInput {
  arrived: boolean;
  onFront: boolean;
  distanceToTarget: number;
  distanceToFront: number;
}

export interface ApproachArrivalInput {
  arrived: boolean;
  onApproachSide: boolean;
  distanceToTarget: number;
  distanceToPoint: number;
  targetRadius: number;
  pointRadius: number;
  holdSeconds?: number;
}

/** Hedefin hemen berisinde kalan bütün istasyon yürüyüşleri için ortak sigorta. */
export function advanceApproachArrival(
  timer: number,
  dt: number,
  input: ApproachArrivalInput,
): { timer: number; ready: boolean } {
  if (input.arrived) return { timer: 0, ready: true };
  const near = input.onApproachSide
    && (input.distanceToTarget <= input.targetRadius || input.distanceToPoint <= input.pointRadius);
  const next = near ? timer + dt : Math.max(0, timer - dt * 2);
  const hold = input.holdSeconds ?? 0.45;
  return { timer: next, ready: near && next >= hold };
}

/**
 * Navigasyon hedefin yarım adım berisinde biterse müşteriyi sonsuza dek
 * yürütmez. Yalnız rafın doğru yüzünde ve gerçek erişim bandındaysa süre dolar.
 */
export function advancePickupArrival(
  timer: number,
  dt: number,
  input: PickupArrivalInput,
): { timer: number; ready: boolean } {
  return advanceApproachArrival(timer, dt, {
    arrived: input.arrived,
    onApproachSide: input.onFront,
    distanceToTarget: input.distanceToTarget,
    distanceToPoint: input.distanceToFront,
    targetRadius: 1.25,
    pointRadius: 1.8,
  });
}
