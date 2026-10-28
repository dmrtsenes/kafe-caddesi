import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTelemetryServer, validateEnvelope } from './telemetry-server.mjs';
import { summarizePlaytests } from './playtest-report.mjs';
const example = () => ({
  schema: 1,
  version: '1.2.0',
  install: crypto.randomUUID(),
  firstSeen: Date.UTC(2026, 8, 1),
  events: [
    {
      id: crypto.randomUUID(),
      session: crypto.randomUUID(),
      name: 'first_serve',
      at: Date.UTC(2026, 8, 1, 1),
      elapsed: 3000,
      props: { location: 'kose', served: 1 },
    },
  ],
});
it('collector validates fields, blocks other origins and deduplicates retries', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fincan-metrics-'));
  const file = join(dir, 'events.ndjson');
  const server = createTelemetryServer({ file, origins: ['https://game.test'] });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = 'http://127.0.0.1:' + server.address().port + '/events';
    const body = example();
    body.events.push({ ...body.events[0] });
    for (let n = 0; n < 2; n++) {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://game.test' },
        body: JSON.stringify(body),
      });
      assert.equal(r.status, 204);
    }
    assert.equal(readFileSync(file, 'utf8').trim().split('\n').length, 1);
    const forbidden = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.test' },
      body: JSON.stringify(body),
    });
    assert.equal(forbidden.status, 403);
    body.events[0].props.email = 'not-for-telemetry';
    assert.equal(validateEnvelope(body), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
it('retention excludes unfinished cohorts and merges duplicate exports', () => {
  const start = Date.UTC(2026, 8, 1);
  const report = {
    install: 'test-player',
    firstSeen: start,
    exportedAt: Date.UTC(2026, 8, 3),
    activeDays: ['2026-09-01', '2026-09-02'],
    events: [{ id: 'one', name: 'first_serve' }],
  };
  const current = summarizePlaytests([report, report], Date.UTC(2026, 8, 2, 12));
  assert.equal(current.installations, 1);
  assert.equal(current.events, 1);
  assert.equal(current.D1.eligible, 0);
  const mature = summarizePlaytests([report], Date.UTC(2026, 8, 3));
  assert.equal(mature.D1.percent, 100);
  assert.equal(mature.D7.percent, null);
});

it('keeps milestone counts after raw events rotate and excludes unobserved first days', () => {
  const report = {
    install: 'long-running-player',
    firstSeen: Date.UTC(2026, 8, 1),
    activeDays: ['2026-09-02'],
    events: [],
    milestones: ['first_serve'],
  };
  const result = summarizePlaytests([report], Date.UTC(2026, 8, 10));
  assert.equal(result.funnel.first_serve, 1);
  assert.equal(result.D1.eligible, 0);
  assert.equal(result.D7.eligible, 0);
});


it('does not turn an old first-day-only offline export into D7 non-return', () => {
  const first = Date.UTC(2026, 8, 1);
  const result = summarizePlaytests([{
    install: 'offline-human', firstSeen: first, exportedAt: first + 3600000,
    testContext: { participant: 'human', condition: 'clear-unlocks-v1', label: 'P01' },
    activeDays: ['2026-09-01'], events: [],
  }], Date.UTC(2026, 8, 10));
  assert.equal(result.human.D1.eligible, 0);
  assert.equal(result.human.D7.eligible, 0);
  assert.equal(result.human.D7.percent, null);
  assert.equal(result.human.D7.matureWithoutCoverage, 1);
});

it('requires a dated snapshot covering the full target day for both returns and non-returns', () => {
  const first = Date.UTC(2026, 8, 1);
  const exportedAt = Date.UTC(2026, 8, 9, 12);
  const base = { firstSeen: first, exportedAt, testContext: { participant: 'human' }, events: [] };
  const result = summarizePlaytests([
    { ...base, install: 'returned', activeDays: ['2026-09-01', '2026-09-08', '2026-09-09'] },
    { ...base, install: 'not-returned', activeDays: ['2026-09-01', '2026-09-09'] },
    { ...base, install: 'legacy-unknown-coverage', exportedAt: undefined, activeDays: ['2026-09-01'] },
  ], exportedAt);
  assert.equal(result.human.D7.eligible, 2);
  assert.equal(result.human.D7.returned, 1);
  assert.equal(result.human.D7.percent, 50);
  assert.equal(result.human.D7.matureWithoutCoverage, 1);
  assert.equal(result.observationCoverage.installationsWithoutDatedSnapshot, 1);
});

it('collector delivery time does not establish a complete offline observation window', () => {
  const start = Date.UTC(2026, 8, 1);
  const receivedAt = Date.UTC(2026, 8, 10);
  const records = [
    { install: 'collector-player', firstSeen: start, receivedAt, id: 'd0', name: 'active_day', at: start, props: { day: '2026-09-01' } },
    { install: 'collector-player', firstSeen: start, receivedAt, id: 'd8', name: 'active_day', at: Date.UTC(2026, 8, 9), props: { day: '2026-09-09' } },
  ];
  const result = summarizePlaytests(records, receivedAt);
  assert.equal(result.D7.eligible, 0);
  assert.equal(result.D7.percent, null);
  assert.equal(result.D7.matureWithoutCoverage, 1);
  assert.equal(result.observationCoverage.latestCollectorReceivedAt, receivedAt);
  assert.equal(result.observationCoverage.latestCollectorEventAt, Date.UTC(2026, 8, 9));
  assert.equal(result.observationCoverage.collectorReceiptsEstablishOfflineCoverage, false);
});

it('excludes labelled bots, keeps unknown records separate and reports real observed purchase/help timing', () => {
  const start = Date.UTC(2026, 8, 1);
  const event = (id, name, seconds, props = {}) => ({ id, name, at: start + seconds * 1000, playSeconds: seconds, props });
  const identity = { id: 't1', kind: 'zone', location: 'kose', cycle: 0 };
  const human = { install: 'human', firstSeen: start, exportedAt: Date.UTC(2026, 8, 9),
    testContext: { participant: 'human', condition: 'clear-unlocks-v1', label: 'P01' },
    activeDays: ['2026-09-01'], events: [
      event('seen', 'purchase_seen', 3, identity),
      event('start', 'purchase_engaged', 5, { ...identity, phase: 'start' }),
      event('left', 'purchase_left', 6, { ...identity, paid: 30 }),
      event('resume', 'purchase_engaged', 9, { ...identity, phase: 'resume' }),
      event('help', 'help_used', 10, { id: 'g04', kind: 'expand', location: 'kose' }),
      event('zone', 'zone_unlock', 12, { zone: 't1', location: 'kose' }),
      event('complete', 'purchase_complete', 12, identity),
      event('staff-base', 'staff_hire', 25, { role: 'waiter', count: 1 }),
      event('staff-complete', 'purchase_complete', 25, { id: 'waiter:0', kind: 'staff', location: 'kose', cycle: 0 }),
    ] };
  const bot = { ...human, install: 'bot', testContext: { participant: 'bot', condition: 'clear-unlocks-v1' } };
  const unknown = { ...human, install: 'unknown', testContext: undefined, events: [] };
  const result = summarizePlaytests([human, human, bot, unknown], Date.UTC(2026, 8, 10));
  assert.deepEqual(result.evidence, { status: 'observed_human_records', labelledHumanInstallations: 1,
    unclassifiedInstallations: 1, excludedBotInstallations: 1 });
  assert.equal(result.human.events, human.events.length, 'duplicate export must not add events');
  assert.equal(result.human.timing.first_observed_purchase_seconds.median, 12);
  assert.equal(result.human.timing.first_observed_staff_seconds.median, 25);
  assert.equal(result.human.timing.next_observed_purchase_gap_seconds.median, 13, 'two success hooks must not create a zero second extra purchase');
  assert.equal(result.human.purchaseFlow.leftPartialContracts, 1);
  assert.equal(result.human.purchaseFlow.resumedContracts, 1);
  assert.equal(result.human.purchaseFlow.completedAfterResume, 1);
  assert.equal(result.human.purchaseFlow.helpActions, 1);
  assert.equal(result.conditions['clear-unlocks-v1'].installations, 1);
});

it('empty and bot-only reports explicitly have insufficient human evidence', () => {
  const empty = summarizePlaytests([]);
  assert.equal(empty.evidence.status, 'insufficient_human_data');
  assert.equal(empty.human.installations, 0);
  assert.equal(empty.human.D1.percent, null);
  assert.equal(empty.human.timing.first_observed_purchase_seconds.median, null);
  const bot = summarizePlaytests([{ install: 'only-bot', firstSeen: Date.UTC(2026, 8, 1),
    hasBotData: true, testContext: { participant: 'human' }, activeDays: [], events: [] }]);
  assert.equal(bot.evidence.status, 'insufficient_human_data');
  assert.equal(bot.evidence.excludedBotInstallations, 1, 'a mixed bot installation is never human evidence');
  assert.equal(bot.installations, 0);
});
