import { ITEMS } from '../data/items';

/** Real-day cap. Tips stay a spice, not a second wage. */
export const FOUND_CHANGE_DAILY_CAP = 8;
/** About one happy checkout in seven. */
export const FOUND_CHANGE_CHANCE = 1 / 7;
/** Seconds of play between awards. Persisted so a reload cannot skip it. */
export const FOUND_CHANGE_GAP = 40;

/**
 * One cheapest menu item, up to a latte's multiple of that item.
 * Corner tea is ₺25–₺82. A later menu scales with its own cheapest price.
 */
export function foundChangeAmount(cheapest: number, roll: number): number {
  const cheap = Number.isFinite(cheapest) && cheapest > 0 ? cheapest : ITEMS.cay.price;
  const span = ITEMS.latte.price / ITEMS.cay.price;
  const t = Math.min(1, Math.max(0, roll));
  return Math.max(1, Math.round(cheap * (1 + t * (span - 1))));
}

/** Stable 0..1 roll. The same day and order count cannot be re-rolled by reloading. */
export function foundChangeRoll(day: string, orders: number, salt: string): number {
  let h = 2166136261;
  const text = `${day}:${orders}:${salt}`;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}
