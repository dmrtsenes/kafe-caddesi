import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const DAY = 86400000;
const day = (ms) => Math.floor(ms / DAY);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const timing = (values) => {
  const sorted = values.filter((value) => finite(value) && value >= 0).sort((a, b) => a - b);
  const round = (value) => Math.round(value * 100) / 100;
  return { samples: sorted.length,
    median: sorted.length ? round((sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2) : null,
    p90: sorted.length ? round(sorted[Math.ceil(sorted.length * 0.9) - 1]) : null };
};
const playClock = (event) => finite(event.playSeconds) ? event.playSeconds
  : finite(event.props?.play_seconds) ? event.props.play_seconds : null;
const contractKey = (event) => JSON.stringify([event.props?.location ?? '', event.props?.kind, event.props?.id, event.props?.cycle ?? 0]);
function purchaseIdentity(event) {
  const props = event.props ?? {};
  if (event.name === 'purchase_complete') return { kind: props.kind, id: props.id };
  if (event.name === 'zone_unlock') return { kind: 'zone', id: props.zone };
  if (event.name === 'staff_hire') return { kind: 'staff', id: props.role + ':' + Math.max(0, (props.count ?? 1) - 1) };
  if (event.name === 'upgrade') return { kind: 'upgrade', id: [props.kind, props.id, props.level].join(':') };
  return null;
}
function observations(cohort, asOf) {
  const retention = (n) => {
    const firstDayObserved = cohort.filter((p) => p.days.has(day(p.firstSeen)));
    const mature = firstDayObserved.filter((p) => asOf >= (day(p.firstSeen) + n + 1) * DAY);
    const eligible = mature.filter((p) => {
      const targetDay = day(p.firstSeen) + n;
      return p.coverage.some((range) => range.fromDay <= targetDay && range.through >= (targetDay + 1) * DAY);
    });
    const returned = eligible.filter((p) => p.days.has(day(p.firstSeen) + n));
    return { eligible: eligible.length, returned: returned.length,
      percent: eligible.length ? Math.round(returned.length / eligible.length * 1000) / 10 : null,
      matureWithoutCoverage: mature.length - eligible.length,
      firstDayUnobserved: cohort.length - firstDayObserved.length };
  };
  const funnel = {};
  for (const milestone of ['first_order','first_serve','first_cash','first_table_clean','tutorial_complete','staff_hire','zone_unlock'])
    funnel[milestone] = cohort.filter((p) => p.milestones.has(milestone)).length;
  const firstPurchases = [], firstStaff = [], nextPurchaseGaps = [];
  const flow = { exposedContracts: 0, startedContracts: 0, leftPartialContracts: 0,
    resumedContracts: 0, completedContracts: 0, completedAfterResume: 0, helpActions: 0, installationsUsingHelp: 0 };
  for (const player of cohort) {
    const events = [...player.events.values()].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    const completed = events.filter((event) => event.name === 'purchase_complete');
    const purchases = events.filter((event) => {
      const identity = purchaseIdentity(event);
      if (!identity) return false;
      if (event.name === 'purchase_complete' || event.name === 'upgrade') return true;
      // Core success and pad success describe one transaction, not two purchases.
      return !completed.some((other) => {
        const candidate = purchaseIdentity(other);
        return candidate.kind === identity.kind && candidate.id === identity.id &&
          Math.abs((other.at ?? 0) - (event.at ?? 0)) < 2000;
      });
    }).map((event) => ({ event, identity: purchaseIdentity(event), time: playClock(event) }))
      .filter((purchase) => purchase.time !== null).sort((a, b) => a.time - b.time);
    if (purchases[0]) firstPurchases.push(purchases[0].time);
    if (purchases[1]) nextPurchaseGaps.push(purchases[1].time - purchases[0].time);
    const staff = purchases.find((purchase) => purchase.identity.kind === 'staff');
    if (staff) firstStaff.push(staff.time);
    const seen = new Set(), started = new Set(), left = new Set(), resumed = new Set(), done = new Set(), resumedDone = new Set();
    let helps = 0;
    for (const event of events) {
      const key = contractKey(event);
      if (event.name === 'purchase_seen') seen.add(key);
      if (event.name === 'purchase_engaged' && event.props?.phase === 'start') started.add(key);
      if (event.name === 'purchase_engaged' && event.props?.phase === 'resume') resumed.add(key);
      if (event.name === 'purchase_left') left.add(key);
      if (event.name === 'purchase_complete') { done.add(key); if (resumed.has(key)) resumedDone.add(key); }
      if (event.name === 'help_used') helps++;
    }
    flow.exposedContracts += seen.size;
    flow.startedContracts += started.size;
    flow.leftPartialContracts += left.size;
    flow.resumedContracts += resumed.size;
    flow.completedContracts += done.size;
    flow.completedAfterResume += resumedDone.size;
    flow.helpActions += helps;
    if (helps) flow.installationsUsingHelp++;
  }
  return { installations: cohort.length, events: cohort.reduce((n, p) => n + p.events.size, 0), funnel,
    D1: retention(1), D7: retention(7),
    timing: { first_observed_purchase_seconds: timing(firstPurchases), first_observed_staff_seconds: timing(firstStaff),
      next_observed_purchase_gap_seconds: timing(nextPurchaseGaps) }, purchaseFlow: flow };
}

export function summarizePlaytests(records, asOf = Date.now()) {
  const players = new Map();
  for (const record of records ?? []) {
    if (!record || typeof record.install !== 'string' || !finite(record.firstSeen)) continue;
    let player = players.get(record.install);
    if (!player) {
      player = { firstSeen: record.firstSeen, days: new Set(), events: new Map(), milestones: new Set(),
        coverage: [], contexts: [], bot: false, lastEventAt: null, lastCollectorEventAt: null, lastCollectorReceivedAt: null };
      players.set(record.install, player);
    }
    player.firstSeen = Math.min(player.firstSeen, record.firstSeen);
    if (record.testContext) player.contexts.push(record.testContext);
    if (record.hasBotData === true) player.bot = true;
    for (const name of Array.isArray(record.milestones) ? record.milestones : []) player.milestones.add(name);
    const suppliedDays = [];
    for (const value of Array.isArray(record.activeDays) ? record.activeDays : []) {
      const stamp = Date.parse(value);
      if (Number.isFinite(stamp) && stamp <= asOf) { player.days.add(day(stamp)); suppliedDays.push(day(stamp)); }
    }
    // A manual local snapshot contains the retained day ledger. A first-day-only
    // export cannot prove absence on day 7, even when the analysis runs much later.
    // An upload receipt/last collector event alone cannot prove offline coverage.
    if (suppliedDays.length && finite(record.exportedAt) && record.exportedAt >= record.firstSeen)
      player.coverage.push({ fromDay: Math.min(...suppliedDays), through: Math.min(asOf, record.exportedAt) });
    if (finite(record.receivedAt)) player.lastCollectorReceivedAt = Math.max(player.lastCollectorReceivedAt ?? 0, record.receivedAt);
    for (const event of Array.isArray(record.events) ? record.events : [record]) {
      if (!event || !event.id || !event.name) continue;
      player.events.set(event.id, event);
      player.milestones.add(event.name);
      if (event.context) player.contexts.push(event.context);
      if (finite(event.at)) player.lastEventAt = Math.max(player.lastEventAt ?? 0, event.at);
      if (finite(record.receivedAt) && finite(event.at)) player.lastCollectorEventAt = Math.max(player.lastCollectorEventAt ?? 0, event.at);
      if (event.name === 'active_day' && event.props?.day) {
        const stamp = Date.parse(event.props.day);
        if (Number.isFinite(stamp) && stamp <= asOf) player.days.add(day(stamp));
      }
    }
  }
  const all = [...players.values()];
  for (const player of all) {
    if (player.contexts.some((context) => context.participant === 'bot')) player.bot = true;
    player.human = !player.bot && player.contexts.some((context) => context.participant === 'human');
    const conditions = [...new Set(player.contexts.map((context) => context.condition).filter((value) => typeof value === 'string' && value.length))];
    player.condition = conditions.length > 1 ? 'mixed_conditions' : conditions[0] ?? 'unlabelled';
  }
  const bots = all.filter((player) => player.bot);
  const included = all.filter((player) => !player.bot);
  const human = included.filter((player) => player.human);
  const unknown = included.filter((player) => !player.human);
  const conditions = {};
  for (const condition of [...new Set(human.map((player) => player.condition))])
    conditions[condition] = observations(human.filter((player) => player.condition === condition), asOf);
  return { ...observations(included, asOf),
    evidence: { status: human.length ? 'observed_human_records' : 'insufficient_human_data',
      labelledHumanInstallations: human.length, unclassifiedInstallations: unknown.length, excludedBotInstallations: bots.length },
    human: observations(human, asOf), unclassified: observations(unknown, asOf), conditions,
    observationCoverage: {
      installationsWithDatedSnapshot: included.filter((player) => player.coverage.length).length,
      installationsWithoutDatedSnapshot: included.filter((player) => !player.coverage.length).length,
      latestCollectorEventAt: Math.max(0, ...included.map((player) => player.lastCollectorEventAt ?? 0)) || null,
      latestCollectorReceivedAt: Math.max(0, ...included.map((player) => player.lastCollectorReceivedAt ?? 0)) || null,
      collectorReceiptsEstablishOfflineCoverage: false,
    },
    note: 'Only supplied local exports/legacy opt-in records are represented. Bots are excluded; only the human section contains explicitly labelled human records. Unknown records are not human evidence. D1/D7 require an observed first day, a finished target day and a dated local snapshot covering that full target day. Older exports and collector silence do not prove non-return. Timing describes the first observed transactions in retained records; missing/rotated events remain unknown. No new playtest events or labels are uploaded.' };
}
function readRecords(file) {
  const raw = readFileSync(file, 'utf8');
  try { const value = JSON.parse(raw); return Array.isArray(value) ? value : [value]; }
  catch { return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line)); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const files = process.argv.slice(2);
  if (!files.length) console.log(JSON.stringify(summarizePlaytests([]), null, 2));
  else console.log(JSON.stringify(summarizePlaytests(files.flatMap(readRecords)), null, 2));
}
