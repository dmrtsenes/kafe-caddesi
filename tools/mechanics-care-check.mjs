import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const output = '.devshots/mechanics-care-check', origin = 'http://127.0.0.1:5332';
await mkdir(output, { recursive: true });
let server, browser;
const errors = [];
try {
  server = await createServer({ server: { host: '127.0.0.1', port: 5332, strictPort: true, hmr: false, open: false } }); await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' }); page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('fincan-sokagi:language:v1', 'tr'));
  await page.goto(origin + '/', { waitUntil: 'commit', timeout: 90000 });
  await page.waitForFunction(() => !!window.__fincan, undefined, { timeout: 90000 });
  const report = await page.evaluate(() => {
    const g = window.__fincan; g.stop(); const w = g.world, p = g.player; w.vfx = null;
    g.state.tutorialStep = 99; g.state.stats.orders = 1; g.state.money = 100000; p.dropAll(); p.hasVacuum = false;
    const zone = w.loc.zones.find(z => z.cost > 0 && !w.zoneUnlocked(z.id) && (!z.requires || w.zoneUnlocked(z.requires)));
    w.visiblePadIds.add(zone.id); p.setPosition(zone.padX, zone.padZ); p.interacting = true;
    const oldZoneMoney = g.state.money;
    for (let n = 0; n < 90; n++) w.updatePads(1 / 30, p);
    const zoneBlockedDelta = oldZoneMoney - g.state.money;
    for (const z of w.loc.zones) if (!w.zoneUnlocked(z.id)) w.unlockZone(z.id);
    g.state.staffCount.cashier = 1; g.state.money = 1000;
    w.staffHireCountSeen.set('cashier', 1); w.staffHireWaitExit.clear();
    const pad = w.loc.staffHirePads.cashier; p.setPosition(pad.x, pad.z); p.interacting = true;
    for (let n = 0; n < 90; n++) w.updateStaffHirePad(1 / 30, p);
    const workDeposit = g.state.hirePaidFor('cashier');
    p.interacting = false; p.hasVacuum = true;
    for (let n = 0; n < 90; n++) w.updateStaffHirePad(1 / 30, p);
    const vacuumDeposit = g.state.hirePaidFor('cashier');
    p.hasVacuum = false;
    for (let n = 0; n < 90; n++) w.updateStaffHirePad(1 / 30, p);
    const intentionalDeposit = g.state.hirePaidFor('cashier');

    for (const t of w.tables) { t.dishes = 0; t.soil = 0; t.seatTaken.fill(false); }
    for (const wc of w.toilets) { wc.soil = 0; for (const supply of wc.def.supplies || []) wc.supply.set(supply.item, wc.supplyCap(supply.item)); }
    w.spills.clear();
    // A test soil field covers reachable floor. Ordinary stocking demand remains.
    for (let row = 0; row < w.grime.rows; row++) for (let col = 0; col < w.grime.cols; col++)
      w.grime.addTraffic(w.grime.cellX(col), w.grime.cellZ(row), 250);
    for (const co of w.counters) { co.cash = 0; co.queue.length = 0; }
    for (const shelf of w.pickups) { shelf.contents.length = 0; shelf.output = 0; }
    const source = w.machines.find(m => !m.locked && m.def.item === 'cay'); source.output = 2;
    g.state.playTime = 200; w.guideCare = null; w.guideGoal = null; w.lastGuideFloorAt = 0;
    const request = w.pickGuideTarget(p); const before = w.hygieneLoad;
    p.hasVacuum = true; g.state.playTime = 201;
    const active = w.pickGuideTarget(p);
    g.state.playTime = 231;
    const ended = w.pickGuideTarget(p);
    p.hasVacuum = false; g.state.playTime = 235;
    const after = w.pickGuideTarget(p);
    // Smoothing recovery isolated from arrivals: once real dirt is removed the
    // meter must recover, rather than remaining latched at zero.
    const b = w.loc.bounds;
    for (let z = b.z0; z < b.z1; z += 1) for (let x = b.x0; x < b.x1; x += 1) w.grime.cleanStroke(x, z, x + 1, z, 1.2, 1000);
    w.hygiene = 0;
    for (let n = 0; n < 60 * 30; n++) w.updateHygiene(1 / 30);
    const recovered = { hygiene: w.hygiene, load: w.hygieneLoad };
    w.syncStaff();
    const worker = w.staff.find(s => s.role === 'cashier');
    let diagnostics = null;
    if (worker) { worker.stallTimer = 9; worker.job = 'station'; w.watchdogStaff(worker); diagnostics = w.staffRecovery; }
    const checkout = [];
    const co = w.counters.find(st => !st.locked), point = { x: 0, z: 0 };
    const oldReady = w.cashierReady, oldPlace = w.placeOrder;
    try {
      co.servicePoint(point); p.setPosition(point.x, point.z); co.cash = 0;
      for (const hz of [30, 45, 60]) for (const mode of ['manual', 'staff', 'help', 'vacuum']) {
        co.orderTimer = 0; co.queue.length = 0; co.queue.push({ done: false, state: 'order' });
        p.hasVacuum = mode === 'vacuum'; w.cashierReady = () => mode === 'staff' || mode === 'help';
        let done = false, seconds = 0; w.placeOrder = () => { done = true; };
        while (!done && seconds < 4) { seconds += 1 / hz; w.updateCounters(1 / hz, mode === 'staff' ? null : p); }
        checkout.push({ hz, mode, done, seconds, expected: co.counterOrderTime(mode === 'staff' ? 'cashier' : 'player', 0) });
      }
    } finally { w.cashierReady = oldReady; w.placeOrder = oldPlace; co.queue.length = 0; p.hasVacuum = false; }
    return { checkout, zoneBlockedDelta, workDeposit, vacuumDeposit, intentionalDeposit,
      floor: { request, active, ended, after, before, recovered }, diagnostics,
      scope: 'Isolated operating/purchase guard, bounded guide and meter recovery fixtures. Cleaning traversal time is not an end-to-end player timing claim.' };
  });
  await writeFile(output + '/results.json', JSON.stringify({ ...report, errors }, null, 2));
  assert.equal(report.zoneBlockedDelta, 0); assert.equal(report.workDeposit, 0); assert.equal(report.vacuumDeposit, 0);
  assert.ok(report.intentionalDeposit > 0);
  assert.equal(report.floor.request.label, 'SÜPÜRGEYİ AL düğmesine dokun'); assert.equal(report.floor.active.label, 'ZEMİNİ SÜPÜR');
  assert.ok(['SÜPÜRGEYİ BIRAK düğmesine dokun', 'BİR ADIM UZAKLAŞ'].includes(report.floor.ended.label));
  assert.notEqual(report.floor.after.label, 'SÜPÜRGEYİ AL düğmesine dokun'); assert.ok(report.floor.recovered.hygiene > 95);
  for (const row of report.checkout) { if (row.mode === 'vacuum') assert.equal(row.done, false); else { assert.equal(row.done, true); assert.ok(Math.abs(row.seconds - row.expected) <= 1 / row.hz + 1e-8); } }
  assert.ok(report.diagnostics.count > 0);
  assert.deepEqual(errors, []); console.log(JSON.stringify(report, null, 2));
} finally { await browser?.close(); await server?.close(); }
