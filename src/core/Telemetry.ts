import { bus } from './EventBus';
import { APP_VERSION } from './version';
import { PurchaseMetrics, type PurchaseObservation, type PurchaseCompletion, type PurchaseMetricState, type PurchaseMetric } from './PurchaseMetrics';
export type { PurchaseObservation, PurchaseCompletion } from './PurchaseMetrics';

export const TELEMETRY_KEY = 'fincan-sokagi:metrics:v1';
export const METRICS_CONSENT_KEY = 'fincan-sokagi:metrics-sharing:v1';
export const METRIC_NAMES = [
  'session_start',
  'session_end',
  'active_day',
  'tutorial_step',
  'tutorial_complete',
  'tutorial_skip',
  'first_order',
  'first_serve',
  'first_cash',
  'first_table_clean',
  'zone_unlock',
  'staff_hire',
  'upgrade',
  'ad_requested',
  'ad_result',
  'ad_revenue',
  'performance',
  'purchase_seen', 'purchase_engaged', 'purchase_left', 'purchase_complete', 'help_used',
] as const;
export type MetricName = (typeof METRIC_NAMES)[number];
type Props = Record<string, string | number | boolean>;
// New playtest measurements never enter the existing optional network payload.
const LOCAL_EVENTS = new Set<string>(['purchase_seen', 'purchase_engaged', 'purchase_left', 'purchase_complete', 'help_used']);
const LOCAL_FIELDS = new Set(['cycle', 'paid', 'total', 'view_seconds', 'entry_seconds', 'phase', 'stationary', 'method']);
const ALLOWED_FIELDS = new Set([
  'location',
  'step',
  'play_seconds',
  'served',
  'orders',
  'fps',
  'quality',
  'day',
  'age_days',
  'resumed',
  'zone',
  'role',
  'count',
  'kind',
  'id',
  'level',
  'placement',
  'rewarded',
  'language',
  'value',
  'currency',
  'precision',
  'adUnit',
  'format',
  ...LOCAL_FIELDS,
]);
function cleanProperties(props: Props): Props {
  const clean: Props = {};
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) clean[key] = key === 'value' ? Math.round(value * 1_000_000) / 1_000_000 : Math.round(value * 100) / 100;
    else if (typeof value === 'boolean') clean[key] = value;
    else if (typeof value === 'string') clean[key] = value.slice(0, 80);
  }
  return clean;
}
export interface TestContext { participant: 'human' | 'bot' | 'unknown'; condition?: string; label?: string }
function cleanTestContext(value: unknown): TestContext | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Partial<TestContext>;
  if (!['human', 'bot', 'unknown'].includes(source.participant ?? '')) return undefined;
  return { participant: source.participant!,
    ...(typeof source.condition === 'string' ? { condition: source.condition.slice(0, 80) } : {}),
    ...(typeof source.label === 'string' ? { label: source.label.slice(0, 80) } : {}) };
}
export interface MetricEvent {
  id: string;
  name: MetricName;
  at: number;
  session: string;
  elapsed: number;
  props: Props;
  share: boolean;
  sent?: boolean;
  /** Local/manual-export context; excluded from network envelopes. */
  context?: TestContext;
  /** Active gameplay clock, local/manual export only. */
  playSeconds?: number;
}
interface MetricsData {
  install: string;
  firstSeen: number;
  days: string[];
  first: string[];
  events: MetricEvent[];
  purchases?: PurchaseMetricState[];
  testContext?: TestContext;
  hasBotData?: boolean;
}
export interface MetricsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
function uuid(): string {
  const crypto = globalThis.crypto;
  try {
    if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* Older or restricted WebViews can reject the native UUID API. */
  }
  const bytes = new Uint8Array(16);
  try {
    if (typeof crypto?.getRandomValues !== 'function') throw new Error('Crypto unavailable');
    crypto.getRandomValues(bytes);
  } catch {
    // Anonymous metrics IDs are not security tokens; metrics must never block play.
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}
export class MetricsBuffer {
  readonly session = uuid();
  private activeStart: number | null;
  private activeMs = 0;
  private data: MetricsData;
  private storage: MetricsStorage;
  private now: () => number;
  /** In-game writes wait for idle time: one buffer stringify is ~150 KB. */
  private readonly deferWrites: boolean;
  private writeQueued = false;
  constructor(storage: MetricsStorage, now: () => number = Date.now, deferWrites = false) {
    this.storage = storage;
    this.now = now;
    this.deferWrites = deferWrites;
    this.activeStart = now();
    const fresh = (): MetricsData => ({ install: uuid(), firstSeen: now(), days: [], first: [], events: [] });
    this.data = fresh();
    try {
      const saved = JSON.parse(storage.getItem(TELEMETRY_KEY) ?? 'null');
      if (
        saved &&
        typeof saved.install === 'string' &&
        saved.install.length <= 64 &&
        Number.isFinite(saved.firstSeen)
      ) {
        this.data = {
          install: saved.install,
          firstSeen: saved.firstSeen,
          purchases: new PurchaseMetrics(saved.purchases).snapshot(),
          testContext: cleanTestContext(saved.testContext),
          hasBotData: saved.hasBotData === true,
          days: Array.isArray(saved.days)
            ? saved.days
                .filter((d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
                .slice(-90)
            : [],
          first: Array.isArray(saved.first)
            ? saved.first.filter(
                (n: unknown) => typeof n === 'string' && METRIC_NAMES.includes(n as MetricName),
              )
            : [],
          events: Array.isArray(saved.events)
            ? saved.events
                .filter(
                  (e: MetricEvent) =>
                    e &&
                    METRIC_NAMES.includes(e.name) &&
                    typeof e.id === 'string' &&
                    e.id.length <= 64 &&
                    Number.isFinite(e.at) &&
                    typeof e.session === 'string' &&
                    e.session.length <= 64 &&
                    Number.isFinite(e.elapsed) &&
                    e.props &&
                    typeof e.props === 'object',
                )
                .slice(-384)
                .map((e: MetricEvent) => ({
                  id: e.id,
                  name: e.name,
                  at: e.at,
                  session: e.session,
                  elapsed: e.elapsed,
                  props: cleanProperties(e.props),
                  context: cleanTestContext(e.context),
                  playSeconds: typeof e.playSeconds === 'number' && Number.isFinite(e.playSeconds) && e.playSeconds >= 0 ? e.playSeconds : undefined,
                  share: e.share === true && !LOCAL_EVENTS.has(e.name),
                  sent: e.sent === true,
                }))
            : [],
        };
      }
    } catch {
      /* Metrics never prevent a game from starting. */
    }
  }
  record(name: MetricName, props: Props = {}, share = false, firstOnly = false, playSeconds?: number, persistNow = true): void {
    if (firstOnly && this.data.first.includes(name)) return;
    if (!this.data.first.includes(name)) this.data.first.push(name);
    const clean = cleanProperties(props);
    this.data.events.push({
      id: uuid(),
      name,
      at: this.now(),
      session: this.session,
      elapsed: this.foregroundMs,
      props: clean,
      context: this.data.testContext ? { ...this.data.testContext } : undefined,
      playSeconds: typeof playSeconds === 'number' && Number.isFinite(playSeconds) && playSeconds >= 0 ? playSeconds : undefined,
      share: share && !LOCAL_EVENTS.has(name),
    });
    if (this.data.events.length > 384) this.data.events.splice(0, this.data.events.length - 384);
    if (!persistNow) return;
    if (this.deferWrites) this.persistSoon();
    else this.persist();
  }
  /** Writes any queued record now (session end, backgrounding). */
  flushWrites(): void {
    if (this.writeQueued) this.persist();
  }
  private persistSoon(): void {
    if (this.writeQueued) return;
    this.writeQueued = true;
    const run = () => this.flushWrites();
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 500);
  }
  get purchaseState(): PurchaseMetricState[] { return new PurchaseMetrics(this.data.purchases).snapshot(); }
  setPurchaseState(state: PurchaseMetricState[]): void { this.data.purchases = state; }
  setTestContext(context: TestContext): void {
    const clean = cleanTestContext(context);
    if (!clean) return;
    this.data.testContext = clean;
    if (clean.participant === 'bot') this.data.hasBotData = true;
    // Tag local boot records when the explicit test context is set before play.
    for (const event of this.data.events) if (event.session === this.session) event.context = { ...clean };
    this.persist();
  }
  markDay(share = false, force = false): void {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const known = this.data.days.includes(day);
    if (known && !force) return;
    if (!known) this.data.days.push(day);
    this.data.days = this.data.days.slice(-90);
    const age = Math.floor(this.now() / 86400000) - Math.floor(this.data.firstSeen / 86400000);
    this.record('active_day', { day, age_days: age }, share);
  }
  get foregroundMs(): number {
    return this.activeMs + (this.activeStart === null ? 0 : Math.max(0, this.now() - this.activeStart));
  }
  pause(): void {
    this.activeMs = this.foregroundMs;
    this.activeStart = null;
  }
  resume(): void {
    if (this.activeStart === null) this.activeStart = this.now();
  }
  pending(): MetricEvent[] {
    return this.data.events.filter((e) => e.share && !e.sent && !LOCAL_EVENTS.has(e.name)).slice(0, 20);
  }
  acknowledge(ids: Set<string>): void {
    for (const e of this.data.events) if (ids.has(e.id)) e.sent = true;
    this.persist();
  }
  revoke(): void {
    for (const e of this.data.events) e.share = false;
    this.persist();
  }
  clear(): void {
    this.data = { install: uuid(), firstSeen: this.now(), days: [], first: [], events: [] };
    this.activeMs = 0;
    this.activeStart = this.activeStart === null ? null : this.now();
    this.persist();
  }
  export() {
    return {
      schema: 1,
      version: APP_VERSION,
      install: this.data.install,
      firstSeen: this.data.firstSeen,
      exportedAt: this.now(),
      testContext: this.data.testContext ?? { participant: 'unknown' },
      hasBotData: this.data.hasBotData === true,
      activeDays: [...this.data.days],
      milestones: [...this.data.first],
      events: this.data.events.map(({ share, sent, ...e }) => e),
    };
  }
  envelope() {
    return {
      schema: 1,
      version: APP_VERSION,
      install: this.data.install,
      firstSeen: this.data.firstSeen,
      events: this.pending().map(({ share, sent, context, playSeconds, ...event }) => ({
        ...event,
        props: Object.fromEntries(Object.entries(event.props).filter(([field]) => !LOCAL_FIELDS.has(field))),
      })),
    };
  }
  private persist() {
    this.writeQueued = false;
    try {
      this.storage.setItem(TELEMETRY_KEY, JSON.stringify(this.data));
    } catch {
      /* Storage failure does not affect gameplay. */
    }
  }
}

export function validMetricsEndpoint(value: string): string {
  if (!value) return '';
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ||
      (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))
      ? u.href
      : '';
  } catch {
    return '';
  }
}
export class GameplayTelemetry {
  private buffer: MetricsBuffer;
  private consent = false;
  private endpoint = validMetricsEndpoint(import.meta.env?.VITE_TELEMETRY_URL ?? '');
  private unsubs: (() => void)[] = [];
  private timer: ReturnType<typeof setInterval>;
  private sending: AbortController | null = null;
  private ended = false;
  private purchases: PurchaseMetrics;
  private snapshot: () => Props;
  constructor(snapshot: () => Props) {
    this.snapshot = snapshot;
    let storage: MetricsStorage;
    try {
      storage = localStorage;
      this.consent = storage.getItem(METRICS_CONSENT_KEY) === 'yes';
    } catch {
      storage = { getItem: () => null, setItem: () => {} };
    }
    this.buffer = new MetricsBuffer(storage, Date.now, true);
    this.purchases = new PurchaseMetrics(this.buffer.purchaseState);
    this.buffer.markDay(this.sharing);
    this.record('session_start', snapshot());
    const first = (name: MetricName) => () => this.buffer.record(name, snapshot(), this.sharing, true);
    this.unsubs.push(
      bus.on('order:placed', first('first_order')),
      bus.on('item:served', first('first_serve')),
      bus.on('counter:collected', first('first_cash')),
      bus.on('table:cleaned', first('first_table_clean')),
      bus.on('tutorial:step', ({ index, skipped, complete }) =>
        this.record(skipped ? 'tutorial_skip' : complete ? 'tutorial_complete' : 'tutorial_step', {
          step: index,
        }),
      ),
      bus.on('zone:unlocked', ({ zone, location }) => this.record('zone_unlock', { zone, location })),
      bus.on('staff:hired', ({ role, count }) => this.record('staff_hire', { role, count })),
      bus.on('upgrade:bought', ({ kind, id, level }) => this.record('upgrade', { kind, id, level })),
    );
    const visibility = () => {
      if (document.visibilityState === 'hidden') this.end();
      else {
        this.ended = false;
        this.buffer.resume();
        this.buffer.markDay(this.sharing);
        this.record('session_start', { ...snapshot(), resumed: true });
      }
      void this.flush();
    };
    const end = () => this.end();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', end);
    this.unsubs.push(
      () => document.removeEventListener('visibilitychange', visibility),
      () => window.removeEventListener('pagehide', end),
    );
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.buffer.markDay(this.sharing);
        this.record('performance', snapshot());
      }
      void this.flush();
    }, 60000);
  }
  get available() {
    return this.endpoint !== '';
  }
  get sharing() {
    return this.available && this.consent;
  }
  setSharing(value: boolean) {
    const wasSharing = this.sharing;
    this.consent = value && this.available;
    try {
      localStorage.setItem(METRICS_CONSENT_KEY, this.consent ? 'yes' : 'no');
    } catch {}
    if (this.consent && !wasSharing) this.buffer.markDay(true, true);
    if (!this.consent) {
      this.sending?.abort();
      this.buffer.revoke();
    }
  }
  record(name: MetricName, props: Props = {}, persistNow = true) {
    const clock = this.snapshot().play_seconds;
    this.buffer.record(name, props, this.sharing, false, typeof clock === 'number' ? clock : undefined, persistNow);
  }
  setTestContext(context: TestContext): void { this.buffer.setTestContext(context); }
  observePurchases(targets: readonly PurchaseObservation[], dtSeconds: number): void {
    if (this.ended || document.visibilityState === 'hidden') return;
    this.purchaseEvents(this.purchases.observe(targets, dtSeconds));
  }
  completePurchase(target: PurchaseCompletion, method: 'pad' | 'menu' | 'unknown' = 'unknown'): void {
    this.purchaseEvents(this.purchases.complete(target, method));
  }
  useHelp(target: { id: string; kind: string; location: string }): void {
    if (this.ended || document.visibilityState === 'hidden') return;
    this.purchaseEvents(this.purchases.useHelp(target, this.buffer.foregroundMs / 1000));
  }
  private purchaseEvents(events: PurchaseMetric[]): void {
    if (!events.length) return;
    this.buffer.setPurchaseState(this.purchases.snapshot());
    for (let i = 0; i < events.length; i++) {
      this.record(events[i].name, events[i].props, i === events.length - 1);
    }
  }
  clear(): void {
    this.setSharing(false);
    this.buffer.clear();
    this.purchases = new PurchaseMetrics();
  }
  exportText() {
    return JSON.stringify(this.buffer.export(), null, 2);
  }
  async flush(): Promise<void> {
    if (!this.sharing || this.sending) return;
    const body = this.buffer.envelope();
    if (!body.events.length) return;
    const controller = new AbortController();
    this.sending = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
        keepalive: true,
        credentials: 'omit',
      });
      if (response.ok && this.sharing) this.buffer.acknowledge(new Set(body.events.map((e) => e.id)));
    } catch {
      /* Keep the queue for the next successful flush. */
    } finally {
      clearTimeout(timeout);
      if (this.sending === controller) this.sending = null;
    }
  }
  private end() {
    if (this.ended) return;
    this.ended = true;
    this.buffer.setPurchaseState(this.purchases.snapshot());
    this.record('session_end', this.snapshot());
    this.buffer.pause();
    this.buffer.flushWrites();
    void this.flush();
  }
  dispose() {
    this.end();
    clearInterval(this.timer);
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.sending?.abort();
  }
}
