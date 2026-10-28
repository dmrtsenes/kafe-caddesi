export const TIER_PIXEL_BUDGET = {
  low: 750_000,
  medium: 1_350_000,
  high: 2_200_000,
} as const;

export const PIXEL_BUDGET_SCALE = [1, 0.95, 0.9, 0.85, 0.8, 0.75] as const;

export interface RenderBudgetSettings {
  dprCap: number;
  pixelBudget?: number;
  tier?: keyof typeof TIER_PIXEL_BUDGET;
  heat?: number;
}

/** Bound 3D pixel work independently of sharp HTML UI text. */
export function renderPixelRatio(
  width: number,
  height: number,
  deviceDpr: number,
  capOrSettings: number | RenderBudgetSettings,
  pixelBudget?: number,
): number {
  const area = Math.max(1, width * height);
  const dpr = Math.max(0.1, deviceDpr);
  const settings =
    typeof capOrSettings === "number"
      ? { dprCap: Math.max(0.1, capOrSettings), pixelBudget }
      : capOrSettings;
  const scaleIdx = Math.max(
    0,
    Math.min(PIXEL_BUDGET_SCALE.length - 1, Math.floor(settings.heat ?? 0)),
  );
  const baseBudget =
    settings.pixelBudget ??
    (settings.tier ? TIER_PIXEL_BUDGET[settings.tier] : TIER_PIXEL_BUDGET.high);
  const budget = Math.max(1, baseBudget * PIXEL_BUDGET_SCALE[scaleIdx]);
  const budgetCap = Math.sqrt(budget / area);
  const minPr = Math.min(dpr, 1.0);
  return Math.max(minPr, Math.min(dpr, Math.max(0.1, settings.dprCap), budgetCap));
}
/** Avoid an extra skipped vsync when a 60/90/120 Hz clock jitters slightly. */
export function stableRefreshRate(measured: number): number {
  if (!Number.isFinite(measured) || measured <= 0) return 60;
  const common = [50, 60, 72, 75, 80, 90, 96, 100, 120, 144, 165, 180, 240];
  let closest = measured,
    distance = Infinity;
  for (const hz of common) {
    const d = Math.abs(measured - hz) / hz;
    if (d < distance && d <= 0.04) {
      distance = d;
      closest = hz;
    }
  }
  return closest;
}
