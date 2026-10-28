import { ITEMS, type ItemId } from '../data/items';
import {
  SIDE_ACTIVITY_AUTO_SECONDS, SIDE_ACTIVITY_BONUS_RATE, SIDE_ACTIVITY_BY_ID,
  SIDE_ACTIVITY_CLEAN_SECONDS, SIDE_ACTIVITY_IDS, SIDE_ACTIVITY_MAX_DT,
  SIDE_ACTIVITY_MAX_LEVEL, SIDE_ACTIVITY_VALUE_MULT,
  type SideActivityId, type SideActivityRecipeLine,
} from '../data/sideActivities';

export type SideActivityPhase = 'locked' | 'waiting' | 'delivery' | 'packing' | 'cleaning';
export interface SideActivityLine extends SideActivityRecipeLine { delivered: number }
export interface SideActivityState {
  id: SideActivityId;
  level: number;
  completed: number;
  order: number;
  phase: SideActivityPhase;
  lines: SideActivityLine[];
  workProgress: number;
  cleanProgress: number;
  /** Quoted once when this order begins; later upgrades cannot rewrite it. */
  reward: number;
  bonus: number;
  purchaseDeposit: number;
}
export interface SideActivityView extends SideActivityState {
  nextCost: number;
  purchaseRemaining: number;
  manualSeconds: number;
  autoSeconds: number;
}
export interface SideActivitiesSave { v: 1; activities: Record<SideActivityId, SideActivityState> }
export interface SideActivityCompletion {
  id: SideActivityId;
  order: number;
  lines: SideActivityRecipeLine[];
  /** Real sale proceeds; the host credits these through GameState.earn. */
  amount: number;
  /** Separate milestone gift; the host credits this through GameState.grant. */
  bonus: number;
}
export interface SideActivityPurchase { spent: number; upgraded: boolean; level: number }

const MAX_MONEY = 1e12;
const MAX_COUNTER = 1e9;
const EPSILON = 1e-9;
const isMenuItem = (value: unknown): value is ItemId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, value) && ITEMS[value as ItemId].tier === 'product';
const finite = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, max: number): number => Math.max(0, Math.min(max, value));
const frameTime = (dt: number): number => clamp(finite(dt), SIDE_ACTIVITY_MAX_DT);
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const copy = (state: SideActivityState): SideActivityState => ({ ...state, lines: state.lines.map(line => ({ ...line })) });
const empty = (id: SideActivityId): SideActivityState => ({
  id, level: 0, completed: 0, order: 0, phase: 'locked', lines: [],
  workProgress: 0, cleanProgress: 0, reward: 0, bonus: 0, purchaseDeposit: 0,
});

const EMPTY_COMPLETIONS: readonly SideActivityCompletion[] = Object.freeze([]);

/**
 * Pure per-location side-work ledger. It never touches inventory, money, wall time,
 * rendering or storage. The host commits each returned completion with its save.
 */
export class SideActivities {
  private states: Record<SideActivityId, SideActivityState> = { garden: empty('garden'), courtyard: empty('courtyard') };
  private readonly manualThisFrame = new Set<SideActivityId>();
  private readonly quoteItem: (item: ItemId) => number;

  constructor(quoteItem: (item: ItemId) => number = item => ITEMS[item].price) {
    this.quoteItem = quoteItem;
  }

  /** Fast read-only access for hot frame/sim loops without deep-cloning lines. */
  peek(id: SideActivityId): Readonly<SideActivityState> {
    return this.states[id];
  }

  get(id: SideActivityId): SideActivityView {
    const state = this.states[id];
    const nextCost = SIDE_ACTIVITY_BY_ID[id].costs[state.level] ?? 0;
    return { ...copy(state), nextCost, purchaseRemaining: Math.max(0, nextCost - state.purchaseDeposit),
      manualSeconds: state.level >= 3 ? 2 : 3, autoSeconds: state.level >= 3 ? SIDE_ACTIVITY_AUTO_SECONDS : 0 };
  }

  snapshot(): SideActivitiesSave {
    return { v: 1, activities: { garden: copy(this.states.garden), courtyard: copy(this.states.courtyard) } };
  }

  /** Old worlds have no side-work field. Malformed values never become free progress or foreign goods. */
  restore(saved: unknown): void {
    const rows = record(record(saved).activities);
    this.manualThisFrame.clear();
    for (const id of SIDE_ACTIVITY_IDS) {
      const raw = record(rows[id]);
      const state = empty(id);
      state.level = Math.floor(clamp(finite(raw.level), SIDE_ACTIVITY_MAX_LEVEL));
      state.completed = Math.floor(clamp(finite(raw.completed), MAX_COUNTER));
      state.order = Math.max(state.completed, Math.floor(clamp(finite(raw.order), MAX_COUNTER)));
      const nextCost = SIDE_ACTIVITY_BY_ID[id].costs[state.level] ?? 0;
      state.purchaseDeposit = clamp(finite(raw.purchaseDeposit), Math.max(0, nextCost - 0.001));
      if (state.level > 0) {
        const seen = new Set<ItemId>();
        for (const value of Array.isArray(raw.lines) ? raw.lines.slice(0, 2) : []) {
          const line = record(value);
          if (!isMenuItem(line.item) || seen.has(line.item)) continue;
          const quantity = Math.floor(clamp(finite(line.quantity), 6));
          if (quantity <= 0) continue;
          seen.add(line.item);
          state.lines.push({ item: line.item, quantity, delivered: Math.floor(clamp(finite(line.delivered), quantity)) });
        }
        const full = state.lines.length > 0 && state.lines.every(line => line.delivered === line.quantity);
        state.phase = state.lines.length === 0 ? 'waiting' : full ? raw.phase === 'cleaning' ? 'cleaning' : 'packing' : 'delivery';
        state.workProgress = state.phase === 'packing' ? clamp(finite(raw.workProgress), 1) : state.phase === 'cleaning' ? 1 : 0;
        state.cleanProgress = state.phase === 'cleaning' ? clamp(finite(raw.cleanProgress), 1) : 0;
        if (state.lines.length > 0) {
          const quoted = this.quote(state.lines, state.level);
          state.reward = Math.max(1, clamp(finite(raw.reward, quoted), MAX_MONEY));
          state.bonus = clamp(finite(raw.bonus), MAX_MONEY);
          state.order = Math.max(1, state.order);
        }
      }
      this.states[id] = state;
    }
  }

  /** Called when station availability changes; an in-flight order remains unchanged. */
  syncMenu(availableItems: readonly ItemId[]): void {
    for (const id of SIDE_ACTIVITY_IDS) {
      const state = this.states[id];
      if (state.level > 0 && state.phase === 'waiting') this.beginOrder(state, availableItems);
    }
  }

  needs(id: SideActivityId, item: ItemId): boolean {
    const state = this.states[id];
    return state.phase === 'delivery' && state.lines.some(line => line.item === item && line.delivered < line.quantity);
  }

  /** The host removes one carried item only after this method accepts it. */
  deposit(id: SideActivityId, item: ItemId): boolean {
    if (!isMenuItem(item) || !this.needs(id, item)) return false;
    const state = this.states[id];
    const line = state.lines.find(line => line.item === item)!;
    line.delivered++;
    if (state.lines.every(line => line.delivered === line.quantity)) {
      state.phase = 'packing';
      state.workProgress = 0;
    }
    return true;
  }

  /** Amount is the host's already-authorized available cash; any excess is not consumed. */
  depositPurchase(id: SideActivityId, amount: number, availableItems: readonly ItemId[]): SideActivityPurchase {
    const state = this.states[id];
    const cost = SIDE_ACTIVITY_BY_ID[id].costs[state.level] ?? 0;
    const spent = Math.min(clamp(finite(amount), MAX_MONEY), Math.max(0, cost - state.purchaseDeposit));
    if (cost <= 0 || spent <= 0) return { spent: 0, upgraded: false, level: state.level };
    state.purchaseDeposit += spent;
    const upgraded = state.purchaseDeposit + EPSILON >= cost;
    if (upgraded) {
      state.level++;
      state.purchaseDeposit = 0;
      if (state.phase === 'locked' || state.phase === 'waiting') this.beginOrder(state, availableItems);
    }
    return { spent, upgraded, level: state.level };
  }

  work(id: SideActivityId, dt: number): SideActivityCompletion | null {
    const step = frameTime(dt), state = this.states[id];
    if (step <= 0 || state.phase !== 'packing') return null;
    this.manualThisFrame.add(id);
    state.workProgress = Math.min(1, state.workProgress + step / (state.level >= 3 ? 2 : 3));
    return state.workProgress + EPSILON >= 1 ? this.complete(state) : null;
  }

  /** Only L3+ can pack automatically, and only after every product was actually deposited. */
  update(dt: number): SideActivityCompletion[] {
    const step = frameTime(dt);
    let events: SideActivityCompletion[] | null = null;
    for (const id of SIDE_ACTIVITY_IDS) {
      const state = this.states[id];
      if (step <= 0 || state.level < 3 || state.phase !== 'packing' || this.manualThisFrame.has(id)) continue;
      state.workProgress = Math.min(1, state.workProgress + step / SIDE_ACTIVITY_AUTO_SECONDS);
      if (state.workProgress + EPSILON >= 1) {
        (events ??= []).push(this.complete(state));
      }
    }
    this.manualThisFrame.clear();
    return events ?? (EMPTY_COMPLETIONS as SideActivityCompletion[]);
  }

  clean(id: SideActivityId, dt: number, availableItems: readonly ItemId[]): boolean {
    const step = frameTime(dt), state = this.states[id];
    if (step <= 0 || state.phase !== 'cleaning') return false;
    state.cleanProgress = Math.min(1, state.cleanProgress + step / SIDE_ACTIVITY_CLEAN_SECONDS);
    if (state.cleanProgress + EPSILON < 1) return false;
    this.beginOrder(state, availableItems);
    return true;
  }

  private quote(lines: readonly SideActivityRecipeLine[], level: number): number {
    let sum = 0;
    for (const line of lines) {
      const price = clamp(finite(this.quoteItem(line.item), ITEMS[line.item].price), MAX_MONEY / 16);
      sum += price * line.quantity;
    }
    return Math.max(1, Math.round(clamp(sum * SIDE_ACTIVITY_VALUE_MULT[level], MAX_MONEY)));
  }

  private beginOrder(state: SideActivityState, availableItems: readonly ItemId[]): void {
    const menu = [...new Set(availableItems.filter(isMenuItem))];
    const recipeKey = (lines: readonly SideActivityRecipeLine[]): string =>
      lines.map(line => `${line.item}:${line.quantity}`).sort().join('|');
    // Cleaning retains the finished order, including after reload. Compare it
    // before clearing so a changing menu cannot select the same recipe twice.
    const previousRecipe = recipeKey(state.lines);
    state.lines = [];
    state.workProgress = 0;
    state.cleanProgress = 0;
    state.reward = 0;
    state.bonus = 0;
    if (menu.length === 0) { state.phase = 'waiting'; return; }
    // A locked ingredient excludes the whole recipe. Removing just that line
    // collapsed toast/waffle combinations into repeated plain-tea orders.
    const eligible = SIDE_ACTIVITY_BY_ID[state.id].recipes
      .filter(recipe => recipe.length > 0 && recipe.every(line => menu.includes(line.item)))
      .map(recipe => recipe.map((line, index) => ({ ...line,
        quantity: line.quantity + (index === 0 && state.level >= 2 ? 1 : 0), delivered: 0 })));
    // Unusual/local menus still work, but fallback orders never replace an
    // available complete recipe. Rotate these too when several goods exist.
    const candidates = eligible.length > 0 ? eligible : menu.map(item =>
      [{ item, quantity: state.level >= 2 ? 3 : 2, delivered: 0 }]);
    const start = state.completed % candidates.length;
    let selected = candidates[start];
    for (let offset = 0; offset < candidates.length; offset++) {
      const candidate = candidates[(start + offset) % candidates.length];
      if (recipeKey(candidate) !== previousRecipe) { selected = candidate; break; }
    }
    state.lines = selected;
    state.phase = 'delivery';
    state.order = Math.min(MAX_COUNTER, state.order + 1);
    state.reward = this.quote(state.lines, state.level);
    state.bonus = state.level >= 4 && (state.completed + 1) % 3 === 0 ? Math.round(state.reward * SIDE_ACTIVITY_BONUS_RATE) : 0;
  }

  private complete(state: SideActivityState): SideActivityCompletion {
    // Transition before returning the event. A second update or a restored save
    // cannot emit the same sale again; cleaning must finish before a new order.
    state.phase = 'cleaning';
    state.workProgress = 1;
    state.cleanProgress = 0;
    state.completed = Math.min(MAX_COUNTER, state.completed + 1);
    return { id: state.id, order: state.order,
      lines: state.lines.map(({ item, quantity }) => ({ item, quantity })), amount: state.reward, bonus: state.bonus };
  }
}
