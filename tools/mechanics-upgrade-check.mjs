import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const output = '.devshots/mechanics-upgrade-check';
const origin = 'http://127.0.0.1:5331';
await mkdir(output, { recursive: true });
let server, browser;
const errors = [], remoteRequests = [];
try {
  server = await createServer({ server: { host: '127.0.0.1', port: 5331, strictPort: true, hmr: false, open: false } });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== origin) remoteRequests.push(r.url()); });
  await page.goto(origin + '/', { waitUntil: 'commit', timeout: 90000 });
  console.log('mechanics browser connected');
  await page.waitForFunction(() => !!window.__fincan, undefined, { timeout: 90000 });
  await page.evaluate(() => window.__fincan.stop());
  console.log('mechanics game ready');
  const report = await page.evaluate(async () => {
    const { handsInterval } = await import('/src/data/upgrades.ts');
    const { Staff } = await import('/src/entities/Staff.ts');
    const { GameState } = await import('/src/sim/GameState.ts');
    const { GoalTracker } = await import('/src/sim/Goals.ts');
    const { GOALS } = await import('/src/data/goals.ts');
    const g = window.__fincan, w = g.world, p = g.player;
    g.state.tutorialStep = 99; w.vfx = null; w.active = true;
    const report = { counters: [], transfers: [], staff: [], busser: null, tableCompletion: null, scope: 'Actual World update paths, isolated deterministic browser fixtures; no natural progression or phone performance claim.' };
    const co = w.counters.find(st => !st.locked), pt = { x: 0, z: 0 };
    co.servicePoint(pt); p.setPosition(pt.x, pt.z);
    const oldPlace = w.placeOrder, oldReady = w.cashierReady;
    try {
      for (const hz of [30, 45, 60]) for (const automated of [false, true]) for (let level = 0; level <= 8; level++) {
        co.speedLevel = level; co.cash = 0; co.orderTimer = 0;
        co.queue.length = 0; co.queue.push({ state: 'order', done: false });
        let elapsed = 0, completed = false;
        w.cashierReady = () => automated; w.placeOrder = () => { completed = true; };
        while (!completed && elapsed < 10) { elapsed += 1 / hz; w.updateCounters(1 / hz, automated ? null : p); }
        report.counters.push({ hz, automated, level, actual: elapsed, expected: co.counterOrderTime(automated ? 'cashier' : 'player', 0), completed });
      }
    } finally { w.placeOrder = oldPlace; w.cashierReady = oldReady; co.queue.length = 0; }

    const src = w.machines.find(st => !st.locked && st.def.item === 'cay');
    const keep = { nearestDirtyTable: w.nearestDirtyTable, nearestWithOutput: w.nearestWithOutput, nearestAccepting: w.nearestAccepting, give: p.give };
    try {
      w.nearestDirtyTable = () => null; w.nearestWithOutput = () => src; w.nearestAccepting = () => null;
      src.servicePoint(pt); p.setPosition(pt.x, pt.z); p.dropAll();
      for (const hz of [30, 45, 60]) for (let level = 0; level <= 10; level++) {
        g.state.upgrades.hands = level; p.handAction.reset(); p.noTakeFrom = p.noDropTo = null;
        p.handTimer = 0; w.armKey = null; w.armT = 0; src.output = 1000;
        let count = 0; p.give = () => { count++; return true; };
        // World keeps its real stand-still intent gate. Skip that initial warmup
        // in the throughput sample; the continuous transfer then runs for 60s.
        for (let n = 0; n < hz * 2; n++) w.updateStationInteraction(1 / hz, p);
        const start = count;
        for (let n = 0; n < hz * 60; n++) w.updateStationInteraction(1 / hz, p);
        report.transfers.push({ hz, level, count: count - start, expected: 60 / handsInterval(level) });
      }
    } finally { Object.assign(w, { nearestDirtyTable: keep.nearestDirtyTable, nearestWithOutput: keep.nearestWithOutput, nearestAccepting: keep.nearestAccepting }); p.give = keep.give; }
    g.state.upgrades.hands = 0;
    for (const zone of w.loc.zones) if (!w.zoneUnlocked(zone.id)) w.unlockZone(zone.id);
    g.ui.endCelebrate(); g.ui.closePanels();
    const shelf = w.pickups.find(st => !st.locked && st.def.item === 'cay');
    for (const hz of [30, 45, 60]) for (const level of [0, 3, 5, 10]) {
      g.state.staffLevel.waiter = level;
      const s = new Staff('waiter', 0, level, g.state.cosmetics.uniform);
      src.output = 100; shelf.contents.length = 0; shelf.output = 0; src.reservedBy = shelf.reservedBy = null;
      s.assigned = src; s.source = src; s.dest = shelf; s.job = 'fetch';
      src.servicePoint(pt); s.setPosition(pt.x, pt.z);
      let seconds = 0;
      while (s.job === 'fetch' && seconds < 20) { s.handTimer -= 1 / hz; w.doFetch(s, 1 / hz); seconds += 1 / hz; }
      const fetched = s.carryCount;
      shelf.servicePoint(pt); s.setPosition(pt.x, pt.z);
      while (s.carryCount > 0 && seconds < 40) { s.handTimer -= 1 / hz; w.doDeliver(s, 1 / hz); seconds += 1 / hz; }
      // Filled shelf cannot justify deleting items already carried by a worker.
      s.give('cay'); s.give('cay'); shelf.contents.length = 0; shelf.contents.push(...Array(shelf.outputCap).fill('cay')); shelf.output = shelf.contents.length;
      s.clearJob(); s.thinkTimer = 0; w.updateWaiter(s, 1 / hz);
      report.staff.push({ hz, level, capacity: s.capacity, target: w.staffShelfTarget(shelf), fetched, shelfBeforeFullFixture: fetched - s.carryCount + 2, heldWhenFull: s.carryCount });
      s.clearJob(); s.dispose(); shelf.contents.length = 0; shelf.output = 0;
    }

    g.state.staffCount.waiter = 0; g.state.staffCount.cashier = 0; g.state.staffCount.barista = 0;
    g.state.staffCount.busser = 1; g.state.staffLevel.busser = 0; w.syncStaff();
    for (const t of w.tables) { t.dishes = 0; t.soil = 0; t.cleanValue = 0; t.seatTaken.fill(false); }
    const tables = w.tables.filter(t => !t.locked).slice(0, 2);
    for (const t of tables) { t.dishes = 2; t.soil = .65; t.cleanStartSoil = .65; t.dirtyAge = 0; }
    const money = g.state.money, cleaned = g.state.stats.cleaned, completedTables = g.state.stats.tablesCleaned;
    let firstReady = null;
    for (let frame = 0; frame < 120 * 30; frame++) {
      w.updateStaff(1 / 30);
      if (firstReady === null && tables.some(t => !t.isDirty)) firstReady = (frame + 1) / 30;
    }
    report.busser = { firstReady, readyTables: tables.filter(t => !t.isDirty).length,
      moneyDelta: g.state.money - money, dishStatDelta: g.state.stats.cleaned - cleaned,
      tableStatDelta: g.state.stats.tablesCleaned - completedTables,
      worker: w.staff.map(s => ({ x: s.x, z: s.z, job: s.job, held: s.carryCount })) };

    // The actual wipe completion must be what advances g03.
    const table = tables[0]; table.dishes = 0; table.soil = .65; table.cleanStartSoil = .65; table.cleanValue = 1;
    p.dropAll(); p.noDropTo = p.noTakeFrom = null; table.servicePoint(pt); p.setPosition(pt.x, pt.z);
    g.state.stats.tablesCleaned = 0; g.state.statsBase.tablesCleaned = 0;
    g.state.goalIndex = GOALS.findIndex(goal => goal.id === 'g03');
    for (let frame = 0; frame < 150; frame++) w.updateStationInteraction(1 / 30, p);
    g.goals.update();
    const saved = new GameState(); saved.load(g.state.save());
    report.tableCompletion = { completed: saved.stats.tablesCleaned, soil: table.soil, nextGoal: g.goals.current.id };
    return report;
  });
  await writeFile(output + '/results.json', JSON.stringify({ ...report, errors, remoteRequests }, null, 2));
  for (const row of report.counters) { assert.equal(row.completed, true); assert.ok(Math.abs(row.actual - row.expected) <= 1 / row.hz + 1e-8, JSON.stringify(row)); }
  for (const row of report.transfers) assert.ok(Math.abs(row.count - row.expected) <= 1.01, JSON.stringify(row));
  for (const row of report.staff) { assert.equal(row.fetched, row.capacity, JSON.stringify(row)); assert.equal(row.heldWhenFull, 2, JSON.stringify(row)); }
  assert.equal(report.busser.readyTables, 2, JSON.stringify(report.busser));
  assert.equal(report.busser.moneyDelta, 0); assert.equal(report.busser.dishStatDelta, 0); assert.equal(report.busser.tableStatDelta, 0);
  assert.equal(report.tableCompletion.completed, 1); assert.equal(report.tableCompletion.nextGoal, 'g04');
  assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []);
  await writeFile(output + '/results.json', JSON.stringify({ ...report, errors, remoteRequests }, null, 2));
  console.log(JSON.stringify({ counters: report.counters.length, transfers: report.transfers.length, staff: report.staff.length, busser: report.busser, tableCompletion: report.tableCompletion }, null, 2));
} finally { await browser?.close(); await server?.close(); }
