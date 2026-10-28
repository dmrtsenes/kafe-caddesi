import assert from 'node:assert/strict';
import { it } from 'node:test';
import { GameplayTelemetry, MetricsBuffer, TELEMETRY_KEY, validMetricsEndpoint } from './Telemetry';
import { PurchaseMetrics, type PurchaseObservation } from './PurchaseMetrics';
const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};
it('metrics persist milestones once, sanitize fields and bound storage', () => {
  const storage = memory();
  let now = Date.UTC(2026, 8, 1);
  const b = new MetricsBuffer(storage, () => now);
  b.markDay();
  b.markDay();
  b.record('first_serve', { served: 1, email: 'excluded' }, false, true);
  b.record('first_serve', {}, false, true);
  assert.equal(b.export().events.length, 2);
  assert.deepEqual(b.export().events[1].props, { served: 1 });
  const again = new MetricsBuffer(storage, () => now);
  again.record('first_serve', {}, false, true);
  assert.equal(again.export().events.length, 2);
  for (let i = 0; i < 400; i++) again.record('performance', { fps: NaN, quality: 'x'.repeat(100) });
  assert.equal(again.export().events.length, 384);
  assert.deepEqual(again.export().events[0].props, { quality: 'x'.repeat(80) });
  for (let i = 0; i < 100; i++) {
    now += 86400000;
    again.markDay();
  }
  assert.equal(again.export().activeDays.length, 90);
});
it('only new opt-in events enter batches; acknowledgements and revocation are exact', () => {
  const b = new MetricsBuffer(memory());
  b.record('session_start');
  for (let i = 0; i < 25; i++) b.record('performance', { fps: 30 }, true);
  assert.equal(b.pending().length, 20);
  b.acknowledge(new Set(b.pending().map((e) => e.id)));
  assert.equal(b.pending().length, 5);
  b.revoke();
  assert.equal(b.pending().length, 0);
  assert.equal(b.export().events.length, 26);
  assert.equal('share' in b.export().events[0], false);
});
it('background time is excluded and clearing rotates the local installation', () => {
  let now = 1000;
  const b = new MetricsBuffer(memory(), () => now);
  const first = b.export().install;
  now += 1000;
  b.pause();
  now += 60000;
  b.pause();
  assert.equal(b.foregroundMs, 1000);
  b.resume();
  now += 500;
  assert.equal(b.foregroundMs, 1500);
  b.record('session_end');
  b.clear();
  assert.notEqual(b.export().install, first);
  assert.equal(b.export().events.length, 0);
  assert.equal(b.foregroundMs, 0);
});
it('corrupt and unavailable storage never prevents play; restored fields are constrained', () => {
  const b = new MetricsBuffer({
    getItem: () => '{',
    setItem: () => {
      throw Error('quota');
    },
  });
  assert.doesNotThrow(() => b.record('session_start'));
  const storage = memory();
  const valid = new MetricsBuffer(storage);
  valid.record('session_start');
  const saved = JSON.parse(storage.getItem(TELEMETRY_KEY)!);
  saved.events[0].email = 'discard';
  saved.events[0].props.email = 'discard';
  saved.events.push({ name: 'not-valid' });
  storage.setItem(TELEMETRY_KEY, JSON.stringify(saved));
  const restored = new MetricsBuffer(storage).export();
  assert.equal(restored.events.length, 1);
  assert.equal(JSON.stringify(restored).includes('discard'), false);
});
it('metrics accept HTTPS and loopback endpoints only', () => {
  for (const value of [
    'https://metrics.example/events',
    'http://127.0.0.1:8787/events',
    'http://localhost/events',
    'http://[::1]/events',
  ])
    assert.ok(validMetricsEndpoint(value));
  for (const value of [
    '',
    'not a URL',
    'http://public.example/events',
    'javascript:alert(1)',
    'file:///data',
  ])
    assert.equal(validMetricsEndpoint(value), '');
});


const square = (patch: Partial<PurchaseObservation> = {}): PurchaseObservation => ({
  id: 'waiter:0', kind: 'staff', location: 'kose', cycle: 0,
  visible: true, onPad: false, stationary: true, paid: 0, total: 400, ...patch,
});

it('requires real foreground exposure and does not emit per-frame purchase events', () => {
  const tracker = new PurchaseMetrics();
  const events = [];
  for (let i = 0; i < 100; i++) events.push(...tracker.observe([square({ visible: false })], 0.1));
  assert.deepEqual(events, []);
  for (let i = 0; i < 300; i++) events.push(...tracker.observe([square()], 1 / 30));
  assert.deepEqual(events.map((event) => event.name), ['purchase_seen']);
  assert.ok(Number(events[0].props.view_seconds) < 0.8);
  const stalled = new PurchaseMetrics();
  assert.deepEqual(stalled.observe([square()], 600), [], 'one stalled frame is not ten minutes of exposure');
});

it('tracks first payment, leaving, genuine resumed payment and completion once per contract', () => {
  const tracker = new PurchaseMetrics();
  tracker.observe([square()], 0.1);
  for (let i = 0; i < 20; i++) tracker.observe([square({ onPad: true, stationary: false })], 1 / 30);
  assert.deepEqual(tracker.observe([square()], 0.1), [], 'merely crossing without paying is not a partial abandonment');
  const started = tracker.observe([square({ onPad: true, paid: 10 })], 0.1);
  assert.equal(started.find((event) => event.name === 'purchase_engaged')?.props.phase, 'start');
  assert.equal(tracker.observe([square({ onPad: true, paid: 20 })], 0.1).filter((event) => event.name === 'purchase_engaged').length, 0);
  assert.equal(tracker.observe([square({ paid: 20 })], 0.1)[0].name, 'purchase_left');
  assert.deepEqual(tracker.observe([square({ paid: 20 })], 0.1), []);
  assert.deepEqual(tracker.observe([square({ onPad: true, paid: 20 })], 0.1), [], 'returning without paying is not a resumed payment');
  const resumed = tracker.observe([square({ onPad: true, paid: 21 })], 0.1);
  assert.equal(resumed[0].props.phase, 'resume');
  assert.equal(tracker.complete({ id: 'waiter:0', kind: 'staff', location: 'kose', total: 400 }, 'pad')[0].name, 'purchase_complete');
  assert.deepEqual(tracker.observe([square({ paid: 400, completed: true })], 0.1), []);
  assert.deepEqual(tracker.complete(square(), 'menu'), [], 'second success hook must not double count the same hire');
  const reloaded = new PurchaseMetrics(tracker.snapshot());
  assert.deepEqual(reloaded.complete(square(), 'pad'), []);
  assert.deepEqual(reloaded.complete(square({ cycle: 1 }), 'pad').map((event) => event.name),
    ['purchase_engaged', 'purchase_complete'], 'a new cafe cycle is a new contract');
});

it('resumes a saved partial contract without inventing a new first payment or historic completion', () => {
  const tracker = new PurchaseMetrics();
  tracker.observe([square()], 0.1);
  tracker.observe([square({ onPad: true, paid: 37.125 })], 0.1);
  const restored = new PurchaseMetrics(tracker.snapshot());
  assert.deepEqual(restored.observe([square({ onPad: true, paid: 37.125 })], 0.1), []);
  assert.equal(restored.observe([square({ onPad: true, paid: 40 })], 0.1)[0].props.phase, 'resume');
  const legacy = new PurchaseMetrics();
  assert.deepEqual(legacy.observe([square({ paid: 400, completed: true })], 1), [], 'already-owned starting content is not a new purchase');
});

it('debounces help clicks while preserving distinct help choices', () => {
  const tracker = new PurchaseMetrics();
  const goal = { kind: 'clean', id: 'g03', location: 'kose' };
  assert.equal(tracker.useHelp(goal, 0).length, 1);
  assert.deepEqual(tracker.useHelp(goal, 0), []);
  assert.deepEqual(tracker.useHelp(goal, 1), []);
  assert.equal(tracker.useHelp(goal, 2).length, 1);
  assert.equal(tracker.useHelp({ ...goal, id: 'g07', kind: 'mop' }, 2).length, 1);
});

it('keeps new behavior, test identity and active-play metadata out of the network envelope', () => {
  const storage = memory();
  const b = new MetricsBuffer(storage);
  b.setTestContext({ participant: 'bot', condition: 'clear-unlocks-v1', label: 'P01' });
  b.record('purchase_seen', { id: 'private-pad', kind: 'staff', paid: 10, total: 400 }, true);
  b.record('purchase_complete', { id: 'private-pad', kind: 'staff', paid: 400, total: 400 }, true);
  b.record('performance', { fps: 30, paid: 55, phase: 'resume' }, true, false, 12);
  const exported = b.export();
  assert.equal(exported.hasBotData, true);
  assert.equal(exported.testContext.participant, 'bot');
  assert.equal(exported.events[0].context?.label, 'P01');
  assert.ok(Number.isFinite(exported.exportedAt));
  const envelope = b.envelope();
  assert.equal(envelope.events.length, 1);
  assert.equal(envelope.events[0].name, 'performance');
  assert.deepEqual(envelope.events[0].props, { fps: 30 });
  for (const privateValue of ['private-pad', 'clear-unlocks-v1', 'P01', 'playSeconds', 'context'])
    assert.equal(JSON.stringify(envelope).includes(privateValue), false);
  const saved = JSON.parse(storage.getItem(TELEMETRY_KEY)!);
  saved.events[0].share = true;
  storage.setItem(TELEMETRY_KEY, JSON.stringify(saved));
  assert.equal(new MetricsBuffer(storage).pending().length, 1, 'restored flags cannot enable new-event upload');
});

it('suspends purchase observations and excludes background waiting from active time', () => {
  const original = { document: (globalThis as any).document, window: (globalThis as any).window,
    storage: (globalThis as any).localStorage, now: Date.now };
  const listeners = new Map<string, () => void>();
  const doc = { visibilityState: 'visible', addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name) };
  let now = Date.UTC(2026, 8, 1);
  (globalThis as any).document = doc;
  (globalThis as any).window = { addEventListener: () => {}, removeEventListener: () => {} };
  (globalThis as any).localStorage = memory();
  Date.now = () => now;
  const telemetry = new GameplayTelemetry(() => ({ location: 'kose', play_seconds: 12, language: 'tr' }));
  try {
    for (let i = 0; i < 3; i++) { now += 250; telemetry.observePurchases([square()], 0.25); }
    doc.visibilityState = 'hidden'; listeners.get('visibilitychange')!();
    now += 600_000;
    telemetry.observePurchases([square({ onPad: true, paid: 20 })], 600);
    let events = JSON.parse(telemetry.exportText()).events;
    assert.equal(events.filter((event: any) => event.name === 'purchase_engaged').length, 0);
    doc.visibilityState = 'visible'; listeners.get('visibilitychange')!();
    now += 100;
    telemetry.observePurchases([square({ onPad: true, paid: 20 })], 0.1);
    events = JSON.parse(telemetry.exportText()).events;
    const engaged = events.find((event: any) => event.name === 'purchase_engaged');
    assert.equal(engaged.elapsed, 850);
    assert.equal(engaged.playSeconds, 12);
  } finally {
    telemetry.dispose();
    Date.now = original.now;
    (globalThis as any).document = original.document;
    (globalThis as any).window = original.window;
    (globalThis as any).localStorage = original.storage;
  }
});


it('records resumed pad payment when the final cents complete before the next observation', () => {
  for (const observeReentry of [false, true]) {
    const tracker = new PurchaseMetrics();
    tracker.observe([square()], 0.1);
    tracker.observe([square({ onPad: true, paid: 399.99 })], 0.1);
    tracker.observe([square({ paid: 399.99 })], 0.1);
    if (observeReentry) tracker.observe([square({ onPad: true, paid: 399.99 })], 0.1);
    const events = tracker.complete({ id: 'waiter:0', kind: 'staff', location: 'kose', paid: 400, total: 400 }, 'pad');
    assert.deepEqual(events.map((event) => event.name), ['purchase_engaged', 'purchase_complete']);
    assert.equal(events[0].props.phase, 'resume');
    assert.equal(events[0].props.method, 'pad');
    if (!observeReentry) assert.equal('entry_seconds' in events[0].props, false, 'missed visit duration remains unknown');
    assert.deepEqual(tracker.observe([square({ onPad: true, paid: 400, completed: true })], 0.1), []);
    assert.deepEqual(new PurchaseMetrics(tracker.snapshot()).complete(square(), 'pad'), []);
  }
});

it('a first pad completion can supply start but never invents resume from its full-payment payload', () => {
  const fresh = new PurchaseMetrics();
  const completion = fresh.complete(square({ paid: 400 }), 'pad');
  assert.deepEqual(completion.map((event) => event.name), ['purchase_engaged', 'purchase_complete']);
  assert.equal(completion[0].props.phase, 'start');
  const sampled = new PurchaseMetrics();
  sampled.observe([square({ onPad: true })], 0.1);
  const firstTick = sampled.complete(square({ paid: 400 }), 'pad');
  assert.equal(firstTick[0].props.phase, 'start');
});

it('menu completions never create pad engagement and observed engaged visits are not counted twice', () => {
  for (const method of ['menu', 'unknown'] as const) {
    const tracker = new PurchaseMetrics();
    tracker.observe([square()], 0.1);
    tracker.observe([square({ onPad: true, paid: 399.99 })], 0.1);
    tracker.observe([square({ paid: 399.99 })], 0.1);
    assert.deepEqual(tracker.complete(square({ paid: 400 }), method).map((event) => event.name), ['purchase_complete']);
  }
  const alreadyEngaged = new PurchaseMetrics();
  alreadyEngaged.observe([square()], 0.1);
  alreadyEngaged.observe([square({ onPad: true, paid: 10 })], 0.1);
  assert.deepEqual(alreadyEngaged.complete(square({ paid: 400 }), 'pad').map((event) => event.name), ['purchase_complete']);
});

function withCrypto(value: unknown, run: () => void): void {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value });
  try { run(); } finally {
    if (original) Object.defineProperty(globalThis, 'crypto', original);
    else Reflect.deleteProperty(globalThis, 'crypto');
  }
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

it('uses native UUID generation when the WebView supports it', () => {
  let calls = 0;
  const crypto = {
    randomUUID() { assert.equal(this, crypto); calls++; return '00112233-4455-4677-8899-aabbccddeeff'; },
    getRandomValues() { assert.fail('native UUID should be preferred'); },
  };
  withCrypto(crypto, () => {
    const buffer = new MetricsBuffer(memory());
    buffer.record('session_start');
    assert.equal(calls, 3);
    assert.equal(buffer.session, '00112233-4455-4677-8899-aabbccddeeff');
  });
});

it('older WebViews generate RFC 4122 version 4 IDs from random bytes', () => {
  for (const nativeThrows of [false, true]) {
    let calls = 0;
    const crypto = {
      ...(nativeThrows ? { randomUUID: () => { throw new Error('restricted'); } } : {}),
      getRandomValues(bytes: Uint8Array) {
        assert.equal(this, crypto);
        bytes.fill(0xff);
        bytes[0] = calls++;
        return bytes;
      },
    };
    withCrypto(crypto, () => {
      const storage = memory();
      const buffer = new MetricsBuffer(storage);
      buffer.record('session_start');
      assert.equal(calls, 3);
      assert.equal(buffer.session, '00ffffff-ffff-4fff-bfff-ffffffffffff');
      assert.equal(buffer.export().install, '01ffffff-ffff-4fff-bfff-ffffffffffff');
      assert.equal(buffer.export().events[0].id, '02ffffff-ffff-4fff-bfff-ffffffffffff');
      assert.equal(new MetricsBuffer(storage).export().install, buffer.export().install);
    });
  }
});

it('missing or failing crypto never blocks startup, recording, or clearing metrics', () => {
  for (const crypto of [undefined, {}, { getRandomValues: () => { throw new Error('unavailable'); } }]) {
    withCrypto(crypto, () => {
      const storage = memory();
      const buffer = new MetricsBuffer(storage);
      for (let i = 0; i < 32; i++) buffer.record('performance', { fps: 30 }, true);
      const exported = buffer.export();
      const ids = [buffer.session, exported.install, ...exported.events.map(event => event.id)];
      for (const id of ids) assert.match(id, uuidPattern);
      assert.equal(new Set(ids).size, ids.length);
      assert.equal(new MetricsBuffer(storage).export().install, exported.install);
      buffer.acknowledge(new Set(buffer.pending().map(event => event.id)));
      assert.equal(buffer.pending().length, 12);
      buffer.clear();
      assert.match(buffer.export().install, uuidPattern);
      assert.notEqual(buffer.export().install, exported.install);
      assert.equal(buffer.export().events.length, 0);
    });
  }
});
