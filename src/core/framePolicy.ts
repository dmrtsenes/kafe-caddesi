import { stableRefreshRate } from "./RenderBudget";
export type FpsPreference = 30 | 45 | 60;

export interface FramePolicyInput {
  native: boolean;
  mobile: boolean;
  heat: number;
  tier: "high" | "medium" | "low";
  uiBlocked: boolean;
  preference?: FpsPreference;
}

export function isMobileDevice(
  userAgent: string,
  coarsePointer = false,
): boolean {
  const maxTouch =
    typeof navigator !== "undefined" ? (navigator.maxTouchPoints ?? 0) : 0;
  return (
    coarsePointer ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
    (maxTouch > 1 && /Macintosh|Mac OS X/i.test(userAgent))
  );
}

/**
 * Otomatik kare tercihi.
 *
 * 45, 120 Hz panelde her üçüncü vsync'e düşüp 40 fps olur. Bütün kademeler
 * 60 ister; `vsyncStride` gerekirse iner (90 Hz → 45). Isı tavanı burada
 * değil, `playFps` içinde: düşük kademe ilk sürekli kare kaybında (ısı 1),
 * diğer otomatik mobil/native ısı 2'de 30'a düşer, ısı 3 herkesi 30'a çeker.
 */
export function defaultFpsPreference(
  _native: boolean,
  _mobile: boolean,
  _tier: FramePolicyInput["tier"],
): FpsPreference {
  return 60;
}

export function defaultFps(
  native: boolean,
  mobile: boolean,
  tier: FramePolicyInput["tier"],
): number {
  return defaultFpsPreference(native, mobile, tier);
}

export function playFps(input: Omit<FramePolicyInput, "uiBlocked">): number {
  const preferred =
    input.preference ?? defaultFps(input.native, input.mobile, input.tier);
  if (input.preference === undefined && input.tier === "low" && input.heat >= 1)
    return Math.min(preferred, 30);
  if (input.preference === undefined && (input.native || input.mobile) && input.heat >= 2)
    return Math.min(preferred, 30);
  if (input.heat >= 3) return preferred > 0 ? Math.min(preferred, 30) : 30;
  return preferred;
}

export function frameFps(input: FramePolicyInput): number {
  if (input.uiBlocked) return 10;
  return playFps(input);
}

/**
 * Ekran yenilemesine tam bölünen kare adımı.
 *
 * Tavanı aşmadan en sık tam adımı seç. Otomatik 60: 60 Hz → 60,
 * 120 Hz → 60, 90 Hz → 45. Oyuncu 45 seçerse: 60 Hz → 30, 90 Hz → 45,
 * 120 Hz → 40.
 */
export function vsyncStride(refreshHz: number, cap: number): number {
  if (!(cap > 0) || !(refreshHz > 0)) return 1;
  return Math.max(1, Math.ceil(stableRefreshRate(refreshHz) / cap - 1e-9));
}

export function pacedFps(refreshHz: number, cap: number): number {
  if (!(cap > 0)) return 0;
  if (!(refreshHz > 0)) return cap;
  return stableRefreshRate(refreshHz) / vsyncStride(refreshHz, cap);
}

export function detectRefreshHz(reported?: number, fallback = 60): number {
  const raw =
    reported ??
    (typeof screen !== "undefined"
      ? Number((screen as Screen & { refreshRate?: number }).refreshRate)
      : 0);
  if (raw >= 50 && raw <= 240) return raw;
  return fallback;
}

export function fpsSampleIsBad(
  measuredFps: number,
  targetFps: number,
): boolean {
  if (!(measuredFps > 0)) return false;
  const expected = targetFps > 0 ? targetFps : 60;
  return measuredFps < expected * 0.86;
}

export function fpsSampleIsGood(
  measuredFps: number,
  targetFps: number,
): boolean {
  if (!(measuredFps > 0)) return true;
  const expected = targetFps > 0 ? targetFps : 60;
  return measuredFps > expected * 0.95;
}
