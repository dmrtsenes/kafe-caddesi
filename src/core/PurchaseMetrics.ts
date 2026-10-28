/** Local observation state: no storage, DOM, network or collector dependency. */
export type PurchaseKind = 'zone' | 'staff';
export type PurchaseMetricName = 'purchase_seen' | 'purchase_engaged' | 'purchase_left' | 'purchase_complete' | 'help_used';
export interface PurchaseIdentity { id: string; kind: PurchaseKind; location: string; cycle?: number }
export interface PurchaseObservation extends PurchaseIdentity {
  visible: boolean; onPad: boolean; stationary: boolean; paid: number; total: number; completed?: boolean;
}
export interface PurchaseCompletion extends PurchaseIdentity { paid?: number; total?: number }
export interface PurchaseMetric { name: PurchaseMetricName; props: Record<string, string | number | boolean> }
export interface PurchaseMetricState {
  id: string; kind: PurchaseKind; location: string; cycle: number; total: number; paid: number;
  seen: boolean; started: boolean; completed: boolean; viewSeconds: number;
}
interface LiveState extends PurchaseMetricState { onPad: boolean; visitSeconds: number; visitEngaged: boolean }
const bounded = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
const keyOf = (identity: PurchaseIdentity): string => `${identity.location}\0${identity.kind}\0${identity.id}\0${bounded(identity.cycle)}`;
const validIdentity = (value: PurchaseIdentity): boolean => !!value &&
  (value.kind === 'zone' || value.kind === 'staff') && typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 80 &&
  typeof value.location === 'string' && value.location.length > 0 && value.location.length <= 80;

export class PurchaseMetrics {
  private contracts = new Map<string, LiveState>();
  private helpAt = new Map<string, number>();
  private observed = new Set<string>();
  private activeSeconds = 0;
  constructor(saved: unknown = []) {
    if (!Array.isArray(saved)) return;
    for (const row of saved.slice(-128)) {
      if (!validIdentity(row)) continue;
      this.contracts.set(keyOf(row), {
        id: row.id, kind: row.kind, location: row.location, cycle: bounded(row.cycle),
        total: bounded(row.total), paid: bounded(row.paid), seen: row.seen === true,
        started: row.started === true, completed: row.completed === true, viewSeconds: bounded(row.viewSeconds),
        onPad: false, visitSeconds: 0, visitEngaged: false,
      });
    }
  }
  private state(identity: PurchaseCompletion, key = keyOf(identity)): LiveState {
    let state = this.contracts.get(key);
    if (!state) {
      state = { id: identity.id, kind: identity.kind, location: identity.location, cycle: bounded(identity.cycle),
        total: bounded(identity.total), paid: bounded(identity.paid), seen: false,
        started: bounded(identity.paid) > 0, completed: false, viewSeconds: 0,
        onPad: false, visitSeconds: 0, visitEngaged: false };
      this.contracts.set(key, state);
      if (this.contracts.size > 128) this.contracts.delete(this.contracts.keys().next().value!);
    }
    return state;
  }
  private props(state: LiveState): Record<string, string | number | boolean> {
    return { id: state.id, kind: state.kind, location: state.location, cycle: state.cycle,
      paid: state.paid, ...(state.total > 0 ? { total: state.total } : {}), view_seconds: state.viewSeconds };
  }
  observe(targets: readonly PurchaseObservation[], deltaSeconds: number): PurchaseMetric[] {
    // Only foreground simulation deltas are supplied; a stalled frame is bounded.
    const dt = Math.min(0.25, bounded(deltaSeconds));
    this.activeSeconds += dt;
    const events: PurchaseMetric[] = [];
    const observed = this.observed;
    observed.clear();
    for (const target of targets) {
      if (!validIdentity(target)) continue;
      const key = keyOf(target);
      if (observed.has(key)) continue;
      observed.add(key);
      const known = this.contracts.has(key);
      const state = this.state(target, key);
      const paid = Math.min(bounded(target.paid), bounded(target.total, Number.MAX_SAFE_INTEGER));
      const wasOnPad = state.onPad;
      if (!known && target.completed) { state.completed = true; continue; }
      if (state.completed) continue;
      state.total = bounded(target.total, state.total);
      if (target.visible) state.viewSeconds += dt;
      if (!state.seen && target.visible && state.viewSeconds >= 0.75) {
        state.seen = true;
        events.push({ name: 'purchase_seen', props: this.props(state) });
      }
      if (target.onPad && !wasOnPad) { state.visitSeconds = 0; state.visitEngaged = false; }
      if (target.onPad) state.visitSeconds += dt;
      const increased = paid > state.paid + 0.0001;
      state.paid = Math.max(state.paid, paid);
      if (increased && target.onPad && !state.visitEngaged) {
        events.push({ name: 'purchase_engaged', props: { ...this.props(state), phase: state.started ? 'resume' : 'start',
          stationary: target.stationary, entry_seconds: state.visitSeconds } });
        state.started = true;
        state.visitEngaged = true;
      }
      if (target.completed) events.push(...this.complete(target, 'unknown'));
      else if (wasOnPad && !target.onPad && state.started && state.paid > 0)
        events.push({ name: 'purchase_left', props: { ...this.props(state), entry_seconds: state.visitSeconds } });
      state.onPad = target.onPad;
    }
    for (const [key, state] of this.contracts) {
      if (observed.has(key) || !state.onPad || state.completed) continue;
      if (state.started && state.paid > 0)
        events.push({ name: 'purchase_left', props: { ...this.props(state), entry_seconds: state.visitSeconds } });
      state.onPad = false;
      state.visitSeconds = 0;
      state.visitEngaged = false;
    }
    return events;
  }
  complete(target: PurchaseCompletion, method: 'pad' | 'menu' | 'unknown' = 'unknown'): PurchaseMetric[] {
    if (!validIdentity(target)) return [];
    const key = keyOf(target);
    const known = this.contracts.has(key);
    const state = this.state(target, key);
    if (state.completed) return [];
    // A pad can finish the remaining cents before the next sampled observation.
    // Actual completion proves payment engagement, even if that visit was missed.
    // The completion payload's fully paid amount is not a prior partial payment.
    const previouslyStarted = known && state.started;
    const events: PurchaseMetric[] = [];
    state.total = bounded(target.total, state.total);
    state.paid = state.total > 0 ? state.total : bounded(target.paid, state.paid);
    if (method === 'pad' && (!state.onPad || !state.visitEngaged)) {
      events.push({ name: 'purchase_engaged', props: { ...this.props(state),
        phase: previouslyStarted ? 'resume' : 'start', method,
        ...(state.onPad ? { entry_seconds: state.visitSeconds } : {}) } });
      state.started = true;
      state.visitEngaged = true;
    }
    state.completed = true;
    state.onPad = false;
    events.push({ name: 'purchase_complete', props: { ...this.props(state), method } });
    return events;
  }
  useHelp(target: { id: string; kind: string; location: string }, foregroundSeconds = this.activeSeconds): PurchaseMetric[] {
    if (!target || !target.id || !target.kind || !target.location) return [];
    const key = `${target.id}\0${target.kind}\0${target.location}`;
    if (foregroundSeconds - (this.helpAt.get(key) ?? -Infinity) < 2) return [];
    this.helpAt.set(key, foregroundSeconds);
    if (this.helpAt.size > 64) this.helpAt.delete(this.helpAt.keys().next().value!);
    return [{ name: 'help_used', props: { id: target.id, kind: target.kind, location: target.location } }];
  }
  snapshot(): PurchaseMetricState[] {
    return [...this.contracts.values()].map(({ onPad, visitSeconds, visitEngaged, ...saved }) => ({ ...saved }));
  }
}
