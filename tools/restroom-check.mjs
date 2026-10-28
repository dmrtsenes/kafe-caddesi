import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = '.devshots/restrooms'; await mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 5265, strictPort: true, open: false, hmr: false, watch: null } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, locale: 'tr-TR' });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5265/');
  await page.waitForFunction(() => !!window.__fincan);
  await page.locator('#boot-screen').waitFor({ state: 'detached' });
  const layouts = await page.evaluate(async () => {
    const g = window.__fincan; g.stop(); g.persistDisabled = true; g.ui.setTutorial(null); g.ui.closePanels();
    const [{ World }, { GameState }] = await Promise.all([import('/src/sim/World.ts'), import('/src/sim/GameState.ts')]);
    const stages = [];
    for (const id of ['kose', 'sahil']) {
      const state = new GameState(), w = new World(id, state, null, false);
      stages.push({ id, stage: 'initial', issues: w.validateLayout() });
      for (const z of w.loc.zones) {
        if (!w.zoneUnlocked(z.id)) w.unlockZone(z.id);
        stages.push({ id, stage: z.id, issues: w.validateLayout() });
      }
      w.dispose();
    }
    return stages;
  });
  await writeFile(`${out}/layouts.json`, JSON.stringify(layouts, null, 2));
  console.log('Layout issues:', JSON.stringify(layouts.filter(s => s.issues.length)));

  const flow = await page.evaluate(async () => {
    const g = window.__fincan, w = g.world; g.state.tutorialStep = 99;
    const [{ Customer }, { Order }, { CUSTOMER_ARCHETYPES }, T, { markDynamic }, { floorLiftAt }] = await Promise.all([
      import('/src/entities/Customer.ts'), import('/src/sim/Orders.ts'), import('/src/data/customers.ts'),
      import('/node_modules/three/build/three.module.js'), import('/src/world/layers.ts'), import('/src/data/layouts.ts'),
    ]);
    for (const z of w.loc.zones) g.state.unlockedZones.add('kose:' + z.id);
    w.syncLocks(); g.ui.endCelebrate();
    for (const old of w.customers) { w.releaseCustomerHolds(old); old.dispose(); }
    w.customers.length = 0;
    const spawn = (id, seed) => {
      const original = Math.random; let c;
      try { Math.random = () => seed / 0xffffffff; c = new Customer(CUSTOMER_ARCHETYPES[0], id); }
      finally { Math.random = original; }
      c.setPosition(.5, -6.8); c.spawnT = 1; c.needsToilet = true;
      w.customers.push(c); markDynamic(c.char.root); w.root.add(c.char.root);
      return c;
    };
    const pack = spawn('takeaway', 10); pack.dineIn = false;
    pack.order = new Order([{ item: 'tost', qty: 2, served: 0 }]);
    pack.receiveItem('tost'); pack.receiveItem('tost');
    w.completeOrder(pack, pack.x, pack.z); w.afterService(pack);
    const takeaway = { state: pack.state, carried: pack.carriedItems.length, toilet: pack.toilet?.id ?? null };
    w.customers.splice(w.customers.indexOf(pack), 1); pack.dispose();

    const seats = [];
    for (const [index, seed] of [10, 11].entries()) {
      const c = spawn('diner-' + index, seed); c.dineIn = true;
      c.order = new Order([{ item: 'tost', qty: 1, served: 0 }]); c.receiveItem('tost');
      w.routeToTable(c);
      w.sitOnChair(c, c.table);
      c.state = 'seated'; c.eating = true; c.eatTimer = 0; c.table.seatedGuests.push(c);
      c.step(1, w.nav, true);
      // Exercise the real completed meal path, including leaving dirty dishes
      // at the table and clearing carried products before a restroom booking.
      w.updateCustomer(c, 1 / 60, null);
      const afterMeal = { finished: c.mealFinished, carried: c.carriedItems.length, state: c.state };
      const assigned = c.toilet?.id;
      const visibleBefore = []; c.char.root.traverse(o => { if (o.isMesh && o.visible) visibleBefore.push(o.uuid); });
      let frames = 0;
      while (c.state === 'toToilet' && frames++ < 3600) {
        c.floorY = floorLiftAt(w.loc, c.x, c.z);
        w.updateCustomer(c, 1 / 60, null); c.step(1 / 60, w.nav, true); w.separateActors(null);
      }
      for (let f = 0; f < 60 && c.state === 'inToilet'; f++) {
        c.floorY = floorLiftAt(w.loc, c.x, c.z);
        w.updateCustomer(c, 1 / 60, null); c.step(1 / 60, w.nav, true); w.separateActors(null);
      }
      const visibleAfter = []; c.char.root.traverse(o => { if (o.isMesh && o.visible) visibleAfter.push(o.uuid); });
      c.char.root.updateMatrixWorld(true);
      const hip = c.char.root.getObjectByName('mixamorigHips').getWorldPosition(new T.Vector3());
      const seat = new T.Vector3(); const wc = c.toilet;
      if (wc) { wc.toiletSeatPoint(seat); seat.y += floorLiftAt(w.loc, wc.x, wc.z); }
      seats.push({ id: c.uid, model: c.char.root.userData.characterModel, state: c.state, assigned, frames, afterMeal,
        carried: c.carriedItems.length, anim: c.char.getState(), position: [c.x, c.char.root.position.y, c.z],
        hip: hip.toArray(), seat: seat.toArray(), wardrobeKept: visibleBefore.every(id => visibleAfter.includes(id)),
        hipError: hip.distanceTo(seat) });
    }
    g.player.setPosition(7.2, -11.8); w.updateVisuals(1);
    g.scene3d.resize(); g.scene3d.snapTo(12.4, -13.5); g.scene3d.render();
    window.__restroomCheck = { g, w, T, floorLiftAt };
    return { takeaway, seats, courtyardStillLocked: w.sideActivities.get('courtyard').level === 0 };
  });
  await page.screenshot({ path: `${out}/desktop-occupied.png` });
  await page.setViewportSize({ width: 520, height: 880 });
  await page.evaluate(() => {
    const { g } = window.__restroomCheck; g.scene3d.resize(); g.scene3d.snapTo(12.4, -13.5); g.scene3d.render();
  });
  await page.screenshot({ path: `${out}/phone-occupied.png` });
  const settlement = await page.evaluate(() => {
    const { g, w } = window.__restroomCheck;
    const before = g.state.money, served = g.state.stats.served;
    const supplyBefore = w.toilets.map(wc => wc.supplyOf('kagit'));
    for (let i = 0; i < 420; i++) for (const c of w.customers) {
      w.updateCustomer(c, 1 / 60, null); c.step(1 / 60, w.nav, true);
    }
    const after = g.state.money;
    for (let i = 0; i < 60; i++) for (const c of w.customers) w.updateCustomer(c, 1 / 60, null);
    const completed = { gained: after - before, duplicate: g.state.money - after, served: g.state.stats.served - served,
      supplyUsed: w.toilets.map((wc, i) => supplyBefore[i] - wc.supplyOf('kagit')),
      occupied: w.toilets.map(wc => wc.occupied), states: w.customers.map(c => c.state) };
    const c = w.customers[0]; c.state = 'leave'; c.needsToilet = true;
    for (const wc of w.toilets) wc.supply.set('kagit', 0);
    w.afterService(c);
    const empty = { state: c.state, toilet: c.toilet?.id ?? null };
    for (const wc of w.toilets) { wc.supply.set('kagit', 6); wc.soil = 0; }
    c.needsToilet = true; w.afterService(c); c.patience = 0;
    const reserved = c.toilet; const money = g.state.money;
    w.updateCustomer(c, 1 / 60, null);
    const cancelled = { occupied: reserved?.occupied, fee: g.state.money - money, state: c.state };
    const wc = w.toilets[0], point = { x: 0, z: 0 }, p = g.player;
    wc.servicePoint(point); p.dropAll(); p.hasVacuum = false; p.setPosition(point.x, point.z);
    p.planarSpeed = 0; p.noDropTo = null; p.noTakeFrom = null;
    wc.supply.set('kagit', 0); p.give('kagit');
    const tickPlayer = () => {
      p.update(1 / 60, { x: 0, y: 0, mag: 0, active: false }, w.nav, w.loc.bounds);
      w.updatePlayerInteraction(1 / 60, p);
    };
    for (let f = 0; f < 240 && p.carryCount > 0; f++) tickPlayer();
    const refill = { supplied: wc.supplyOf('kagit'), carried: p.carryCount };
    wc.soil = .8;
    const beforeScrub = g.state.money;
    for (let f = 0; f < 240 && wc.soil > 0; f++) tickPlayer();
    const cleanReward = g.state.money - beforeScrub, afterScrub = g.state.money;
    for (let f = 0; f < 60; f++) tickPlayer();
    return { completed, empty, cancelled, refill, scrubbed: wc.soil === 0, cleanReward,
      duplicateCleanReward: g.state.money - afterScrub };
  });
  const report = { layouts, flow, settlement, errors };
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ flow, settlement, errors }));
  assert.deepEqual(errors, []);
  assert.deepEqual(layouts.filter(s => s.issues.length), [], 'all opening stages must retain valid routes and clearances');
  assert.deepEqual(flow.takeaway, { state: 'leave', carried: 2, toilet: null });
  assert.equal(flow.courtyardStillLocked, true, 'restrooms have independent access');
  assert.equal(new Set(flow.seats.map(s => s.model)).size, 2);
  for (const s of flow.seats) {
    assert.deepEqual(s.afterMeal, { finished: true, carried: 0, state: 'toToilet' });
    assert.equal(s.state, 'inToilet'); assert.equal(s.anim, 'sit'); assert.equal(s.carried, 0);
    assert.equal(s.wardrobeKept, true); assert.ok(s.hipError < .23, 'pelvis must rest over the porcelain seat: ' + JSON.stringify(s));
  }
  assert.ok(settlement.completed.gained > 0); assert.equal(settlement.completed.duplicate, 0);
  assert.equal(settlement.completed.served, 0); assert.deepEqual(settlement.completed.supplyUsed, [.5, .5]);
  assert.deepEqual(settlement.completed.occupied, [false, false]);
  assert.deepEqual(settlement.empty, { state: 'leave', toilet: null });
  assert.deepEqual(settlement.cancelled, { occupied: false, fee: 0, state: 'leave' });
  assert.deepEqual(settlement.refill, { supplied: 1, carried: 0 });
  assert.equal(settlement.scrubbed, true, 'player can service and clean the relocated cubicle');
  assert.ok(settlement.cleanReward > 0); assert.equal(settlement.duplicateCleanReward, 0);
} finally { await browser?.close(); await server.close(); }
