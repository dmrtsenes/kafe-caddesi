import { tr, localeTag } from "./I18n";
export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Kare hızından bağımsız yumuşatma. */
export function damp(a: number, b: number, lambda: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

export function invLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : clamp01((v - a) / (b - a));
}

export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** -PI..PI aralığına indirger. */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export function angleTowards(current: number, target: number, maxDelta: number): number {
  const d = wrapAngle(target - current);
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function dist(ax: number, az: number, bx: number, bz: number): number {
  return Math.sqrt(dist2(ax, az, bx, bz));
}

/**
 * Ölçek tablosu modül düzeyinde durur: `formatMoney` HUD'da kare başına
 * defalarca çağrılır. Binlik ek asla "B" değildir — Türkçede B "bin"
 * okunur, dünyanın geri kalanında milyar. Milyar İngilizcede "B" kalır.
 * 10.000 altı tam gruplanır (tr 1.100, en 1,100). Üstünde İngilizce K/M,
 * Türkçe "bin"/M. "bin" zemin etiketinde 1.100 için uzundur; o bant
 * gruplama kullanır.
 */
const MONEY_SCALES: readonly { d: number; tr: string; en: string }[] = [
  { d: 1e15, tr: 'Kt', en: 'Q' },
  { d: 1e12, tr: 'T', en: 'T' },
  { d: 1e9, tr: 'Mr', en: 'B' },
  { d: 1e6, tr: 'M', en: 'M' },
  { d: 1e3, tr: ' bin', en: 'K' },
];

function groupInteger(n: number): string {
  const negative = n < 0;
  const digits = String(Math.abs(Math.trunc(n)));
  const sep = localeTag() === 'en-US' ? ',' : '.';
  const body = digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return negative ? `-${body}` : body;
}

function scaledMoney(n: number): string {
  const en = localeTag() === 'en-US';
  if (n < 10000) return groupInteger(n);
  for (const scale of MONEY_SCALES) {
    if (n >= scale.d) {
      const val = n / scale.d;
      const raw = val >= 100 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(2);
      const body = en ? raw : raw.replace('.', ',');
      return body + (en ? scale.en : scale.tr);
    }
  }
  return groupInteger(n);
}

/** 1.100 → "1.100" / "1,100" · 12.500 → "12,5 bin" / "12.5K" · 3.400.000 → "3,40M" */
export function formatMoney(v: number): string {
  return scaledMoney(Math.floor(v));
}

/** World pads. Same words as the HUD: grouped under 10.000, never "B" for thousands. */
export function formatCompactMoney(v: number): string {
  return scaledMoney(Math.ceil(v));
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return tr("{0} sa {1} dk", h, m);
  if (m > 0) return tr("{0} dk {1} sn", m, sec);
  return tr("{0} sn", sec);
}

export function formatPct(v: number): string {
  return tr("%{0}", Math.floor(clamp01(v) * 100));
}
