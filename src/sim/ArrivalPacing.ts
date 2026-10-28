/** Smooth admission pressure from unfinished player service, never from graphics quality. */
export function arrivalPressure(
  pendingUnits: number,
  carryCapacity: number,
  oldestWaitRatio: number,
): number {
  if (pendingUnits <= 0) return 1;
  const capacity = Math.max(3, Math.min(9, carryCapacity * 1.5));
  const workload = Math.max(
    0,
    Math.min(1, (pendingUnits - capacity) / capacity),
  );
  const urgency = Math.max(0, Math.min(1, (oldestWaitRatio - 0.45) / 0.4));
  return Math.min(2.5, 1 + workload * 0.65 + urgency * 1.15);
}

/** A hired cashier only increases admission once actually at that counter. */
export function checkoutQueueLimit(cashierReady: boolean): number {
  return cashierReady ? 5 : 3;
}
