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

const ARRIVAL_OUT = { timer: 0, ready: false };
const PICKUP_INPUT: ApproachArrivalInput = {
  arrived: false,
  onApproachSide: false,
  distanceToTarget: 0,
  distanceToPoint: 0,
  targetRadius: 1.25,
  pointRadius: 1.8,
};

/** Hedefin hemen berisinde kalan bütün istasyon yürüyüşleri için ortak sigorta. */
export function advanceApproachArrival(
  timer: number,
  dt: number,
  input: ApproachArrivalInput,
): { timer: number; ready: boolean } {
  if (input.arrived) {
    ARRIVAL_OUT.timer = 0;
    ARRIVAL_OUT.ready = true;
    return ARRIVAL_OUT;
  }
  const near = input.onApproachSide
    && (input.distanceToTarget <= input.targetRadius || input.distanceToPoint <= input.pointRadius);
  const next = near ? timer + dt : Math.max(0, timer - dt * 2);
  const hold = input.holdSeconds ?? 0.45;
  ARRIVAL_OUT.timer = next;
  ARRIVAL_OUT.ready = near && next >= hold;
  return ARRIVAL_OUT;
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
  PICKUP_INPUT.arrived = input.arrived;
  PICKUP_INPUT.onApproachSide = input.onFront;
  PICKUP_INPUT.distanceToTarget = input.distanceToTarget;
  PICKUP_INPUT.distanceToPoint = input.distanceToFront;
  return advanceApproachArrival(timer, dt, PICKUP_INPUT);
}
