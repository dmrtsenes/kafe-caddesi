import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

// Synthetic browser regression only: this does not produce human usability or retention evidence.
// Deterministic payment fixtures use real movement, World payment/observation logic and Game event bindings.
const port = 5232;
const origin = 'http://127.0.0.1:' + port;
const output = '.devshots/usability-flow';
const query = '?playtest=bot&condition=release-flow-v2&participant=usability-check';
const localNames = ['purchase_seen', 'purchase_engaged', 'purchase_left', 'purchase_complete', 'help_used'];
const report = {
  started: new Date().toISOString(),
  scope: 'Synthetic local browser regression. No human success or D1/D7 retention is measured.',
  humanEvidence: false,
  checks: {},
  errors: [],
  remoteRequests: [],
  capturedEnvelopes: [],
};
let server, browser, context, page;
await mkdir(output, { recursive: true });

async function ready() {
  await page.waitForFunction(() => !!window.__fincan, undefined, { timeout: 90_000 });
  await page.locator('#boot-screen').waitFor({ state: 'detached', timeout: 90_000 });
  await page.evaluate(async () => {
    const g = window.__fincan;
    g.stop();
    const [{ TUTORIAL_STEP_COUNT }, { GOALS }, { BALANCE }, { TELEMETRY_KEY }, { ZONE_PURCHASE_HALF }] = await Promise.all([
      import('/src/sim/Tutorial.ts'), import('/src/data/goals.ts'), import('/src/data/balance.ts'),
      import('/src/core/Telemetry.ts'), import('/src/world/ZonePurchasePad.ts'),
    ]);
    g.state.tutorialStep = TUTORIAL_STEP_COUNT;
    g.ui.setTutorial(null); g.ui.closeOffline(); g.ui.closePanels(); g.ui.endCelebrate();
    const zone = g.world.loc.zones.find((z) => z.id === 't1');
    if (!zone) throw new Error('Missing t1 payment fixture');
    const idle = { x: 0, y: 0, mag: 0, active: false };
    window.__usability = {
      zone, GOALS, BALANCE, TELEMETRY_KEY, half: ZONE_PURCHASE_HALF - 0.1, idle,
      events(name, kind = 'zone', id = zone.id) {
        return JSON.parse(g.telemetry.exportText()).events.filter((e) =>
          e.name === name && e.props.kind === kind && e.props.id === id);
      },
      focus(x = zone.padX, z = zone.padZ) {
        const camera = g.scene3d.camera;
        camera.position.set(x, 18, z + 12);
        camera.lookAt(x, 0, z);
        camera.updateMatrixWorld(true);
        g.world.setViewFromCamera(camera);
      },
      observe(dt = 1 / 30) { g.telemetry.observePurchases(g.world.purchaseObservations(g.player), dt); },
      pulse(frames, move = idle) {
        const dt = 1 / 30;
        for (let i = 0; i < frames; i++) {
          g.state.playTime += dt;
          g.player.update(dt, move, g.world.nav, g.world.loc.bounds);
          g.world.updatePads(dt, g.player);
          this.observe(dt);
        }
      },
      settleAway() {
        g.player.setPosition(g.world.loc.playerStart.x, g.world.loc.playerStart.z);
        for (let i = 0; i < 60; i++) g.player.update(1 / 30, idle, g.world.nav, g.world.loc.bounds);
        g.world.updatePads(1 / 30, g.player);
        this.observe();
      },
    };
  });
}

async function capture(name) {
  await page.evaluate(() => {
    const g = window.__fincan;
    g.ui.endCelebrate();
    g.stepVisual(0.01);
    window.__usability.focus();
    g.scene3d.invalidateStatic();
    g.scene3d.render();
  });
  await page.screenshot({ path: output + '/' + name + '.png' });
  await writeFile(output + '/results.json', JSON.stringify(report, null, 2));
}

try {
  server = await createServer({ server: { host: '127.0.0.1', port, strictPort: true, open: false, hmr: false } });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, locale: 'tr-TR',
  });
  page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin)
      report.remoteRequests.push({ url: request.url(), method: request.method() });
  });
  await page.route(origin + '/__telemetry-probe', async (route) => {
    report.capturedEnvelopes.push(route.request().postDataJSON());
    await route.fulfill({ status: 204, body: '' });
  });
  await page.addInitScript(() => {
    localStorage.setItem('fincan-sokagi:language:v1', 'tr');
    localStorage.setItem('fincan-sokagi:settings:v2', JSON.stringify({
      muted: true, music: false, quality: 'low', qualityAuto: false,
    }));
  });
  await page.goto(origin + '/' + query, { waitUntil: 'domcontentloaded' });
  await ready();

  const exposure = await page.evaluate(() => {
    const g = window.__fincan, f = window.__usability, w = g.world;
    if (w.zoneUnlocked(f.zone.id) || !w.visiblePadIds.has(f.zone.id)) throw new Error('Starter square is not available');
    g.telemetry.clear();
    g.telemetry.setTestContext({ participant: 'bot', condition: 'release-flow-v2', label: 'usability-check' });
    f.focus(f.zone.padX + 1000, f.zone.padZ + 1000);
    for (let i = 0; i < 45; i++) g.stepSim(1 / 30);
    const offscreen = w.purchaseObservations(g.player).find((row) => row.id === f.zone.id && row.kind === 'zone');
    const offscreenSeen = f.events('purchase_seen').length;
    f.focus();
    for (let i = 0; i < 45; i++) g.stepSim(1 / 30);
    const visible = w.purchaseObservations(g.player).find((row) => row.id === f.zone.id && row.kind === 'zone');
    const firstSeen = f.events('purchase_seen');
    for (let i = 0; i < 45; i++) g.stepSim(1 / 30);
    return { offscreen, offscreenSeen, visible, firstSeen, repeatedSeen: f.events('purchase_seen').length, half: f.half };
  });
  report.checks.exposure = exposure;
  assert.equal(exposure.offscreen.visible, false, 'offscreen square must be outside actual camera frustum');
  assert.equal(exposure.offscreenSeen, 0, 'offscreen square must not produce purchase_seen');
  assert.equal(exposure.visible.visible, true, 'target square must become screen-visible');
  assert.equal(exposure.firstSeen.length, 1, 'visible target emits one exposure');
  assert.equal(exposure.repeatedSeen, 1, 'continuous exposure is deduplicated');
  assert.ok(Math.abs(exposure.half - 1.2) < 1e-9, 'fixture requires actual payment half-width 1.2');
  await capture('01-visible-target');

  const outside = await page.evaluate(() => {
    const g = window.__fincan, f = window.__usability, z = f.zone;
    f.settleAway(); f.focus();
    g.state.money = z.cost + 100;
    g.player.setPosition(z.padX + 1.6, z.padZ);
    f.pulse(120);
    return { x: g.player.x, z: g.player.z, expectedX: z.padX + 1.6,
      money: g.state.money, initialMoney: z.cost + 100, paid: g.world.padPaid(z.id),
      observation: g.world.purchaseObservations(g.player).find((row) => row.id === z.id && row.kind === 'zone'),
      engaged: f.events('purchase_engaged') };
  });
  report.checks.outsideSquare = outside;
  assert.ok(Math.abs(outside.x - outside.expectedX) < 0.01, 'outside fixture remains 1.6 units from square centre');
  assert.equal(outside.observation.onPad, false);
  assert.equal(outside.paid, 0, 'standing outside the square never charges');
  assert.equal(outside.money, outside.initialMoney);
  assert.equal(outside.engaged.length, 0, 'standing outside is not engagement');
  await capture('02-outside-square');

  const crossing = await page.evaluate(() => {
    const g = window.__fincan, f = window.__usability, w = g.world, z = f.zone, p = g.player;
    f.settleAway(); f.focus();
    g.state.money = z.cost + 100;
    p.setPosition(z.padX - 3, z.padZ);
    const yaw = f.BALANCE.camera.yaw * Math.PI / 180;
    const right = { x: Math.cos(yaw), y: -Math.sin(yaw), mag: 1, active: true };
    let frames = 0, insideFrames = 0, minInsideSpeed = Infinity;
    while (p.x < z.padX + 2.2 && frames++ < 240) {
      f.pulse(1, right);
      if (Math.abs(p.x - z.padX) < f.half && Math.abs(p.z - z.padZ) < f.half) {
        insideFrames++; minInsideSpeed = Math.min(minInsideSpeed, p.planarSpeed);
      }
    }
    return { frames, insideFrames, minInsideSpeed, endX: p.x, goalX: z.padX + 2.2,
      money: g.state.money, initialMoney: z.cost + 100, paid: w.padPaid(z.id),
      engaged: f.events('purchase_engaged') };
  });
  report.checks.movingCrossing = crossing;
  assert.ok(crossing.insideFrames > 0, 'genuine movement must cross the square');
  assert.ok(crossing.endX >= crossing.goalX, 'genuine movement must leave the square');
  assert.ok(crossing.minInsideSpeed >= 1, 'inside frames must remain moving');
  assert.equal(crossing.money, crossing.initialMoney);
  assert.equal(crossing.paid, 0, 'moving crossing never charges');
  assert.equal(crossing.engaged.length, 0, 'crossing is not purchase engagement');

  const partial = await page.evaluate(() => {
    const g = window.__fincan, f = window.__usability, z = f.zone;
    f.settleAway(); f.focus(); g.state.money = 37.125;
    g.player.setPosition(z.padX, z.padZ);
    f.pulse(90);
    const paid = g.world.padPaid(z.id), engaged = f.events('purchase_engaged');
    const start = { paid, money: g.state.money, unlocked: g.world.zoneUnlocked(z.id), engaged };
    f.settleAway();
    const left = f.events('purchase_left');
    f.observe(); f.observe();
    const afterLeaving = { paid: g.world.padPaid(z.id), money: g.state.money,
      left, repeatedLeft: f.events('purchase_left').length };
    g.persist();
    return { start, afterLeaving, seen: f.events('purchase_seen').length };
  });
  report.checks.partialAndLeave = partial;
  assert.equal(partial.start.paid, 37.125);
  assert.equal(partial.start.money, 0);
  assert.equal(partial.start.unlocked, false);
  assert.equal(partial.start.engaged.length, 1);
  assert.equal(partial.start.engaged[0].props.phase, 'start');
  assert.equal(partial.start.engaged[0].props.stationary, true);
  assert.equal(partial.afterLeaving.paid, 37.125, 'leaving preserves partial money');
  assert.equal(partial.afterLeaving.left.length, 1);
  assert.equal(partial.afterLeaving.repeatedLeft, 1);
  assert.equal(partial.seen, 1);
  await capture('03-partial-saved');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready();
  const resumed = await page.evaluate(() => {
    const g = window.__fincan, f = window.__usability, z = f.zone;
    const restored = { money: g.state.money, paid: g.world.padPaid(z.id),
      seen: f.events('purchase_seen').length, engaged: f.events('purchase_engaged') };
    f.settleAway(); f.focus(); g.state.money = 25.5;
    g.player.setPosition(z.padX, z.padZ); f.pulse(90);
    const resumed = { paid: g.world.padPaid(z.id), money: g.state.money, engaged: f.events('purchase_engaged') };
    g.state.money = z.cost - g.world.padPaid(z.id) + 50;
    f.pulse(240);
    const finished = { paid: g.world.padPaid(z.id), money: g.state.money,
      unlocked: g.world.zoneUnlocked(z.id), complete: f.events('purchase_complete'),
      engaged: f.events('purchase_engaged') };
    f.pulse(180);
    g.persist();
    return { restored, resumed, finished, repeatedComplete: f.events('purchase_complete').length };
  });
  report.checks.reloadResumeComplete = resumed;
  assert.equal(resumed.restored.paid, 37.125);
  assert.equal(resumed.restored.money, 0);
  assert.equal(resumed.restored.seen, 1);
  assert.equal(resumed.restored.engaged.length, 1, 'reload itself does not resume payment');
  assert.equal(resumed.resumed.paid, 62.625);
  assert.equal(resumed.resumed.money, 0);
  assert.equal(resumed.resumed.engaged.filter((e) => e.props.phase === 'resume').length, 1);
  assert.equal(resumed.finished.engaged.length, 2, 'one start and one resume across both sessions');
  assert.equal(resumed.finished.unlocked, true);
  assert.ok(Math.abs(resumed.finished.money - 50) < 0.001);
  assert.equal(resumed.finished.complete.length, 1);
  assert.equal(resumed.finished.complete[0].props.method, 'pad', 'real World unlock reports pad method');
  assert.equal(resumed.repeatedComplete, 1, 'continued standing cannot duplicate completion');
  await capture('04-complete');

  const menuBefore = await page.evaluate(() => {
    const g = window.__fincan;
    g.ui.closeOffline(); g.ui.endCelebrate(); g.ui.closePanels();
    g.state.money = 1_000_000;
    g.world.updateStaffHirePad(0, null);
    g.ui.openPanel('staff');
    return { count: g.state.staffCount.waiter, money: g.state.money, price: g.state.hireCostFor('waiter') };
  });
  await page.locator('.staff-card')
    .filter({ has: page.locator('.staff-role', { hasText: 'Tezgâhtar' }) })
    .getByRole('button', { name: /İşe Al/ }).click();
  const menu = await page.evaluate(() => {
    const g = window.__fincan, f = window.__usability;
    return { count: g.state.staffCount.waiter, money: g.state.money,
      events: f.events('purchase_complete', 'staff', 'waiter:0') };
  });
  report.checks.staffMenu = { before: menuBefore, after: menu };
  assert.equal(menu.count, menuBefore.count + 1);
  assert.equal(menu.money, menuBefore.money - menuBefore.price);
  assert.equal(menu.events.length, 1);
  assert.equal(menu.events[0].props.method, 'menu', 'actual staff button reports menu method');

  const helpBefore = await page.evaluate(() => {
    const g = window.__fincan, f = window.__usability;
    g.ui.closePanels(); g.ui.endCelebrate();
    const index = f.GOALS.findIndex((goal) => goal.kind === 'zone' && goal.zone === 'a3');
    if (index < 0) throw new Error('Missing a3 goal fixture');
    g.state.goalIndex = index; g.state.goalProgress = 0;
    g.ui.hudTimer = 1; g.ui.update(0.1);
    return { id: g.goals.current.zone, events: f.events('help_used', 'zone', 'a3').length };
  });
  await page.locator('button.goal').click();
  await page.getByRole('button', { name: 'HEDEFE GİT', exact: true }).click();
  const help = await page.evaluate(() => {
    const g = window.__fincan;
    return { events: window.__usability.events('help_used', 'zone', 'a3'),
      goal: g.world.guideGoal?.zone };
  });
  report.checks.helpButton = { before: helpBefore, after: help };
  assert.equal(helpBefore.events, 0);
  assert.equal(help.events.length, 1, 'one actual HEDEFE GİT click emits one help_used');
  assert.equal(help.goal, 'a3');
  await capture('05-help');

  const exported = await page.evaluate(() => JSON.parse(window.__fincan.telemetry.exportText()));
  await writeFile(output + '/playtest-export.json', JSON.stringify(exported, null, 2));
  assert.equal(exported.testContext.participant, 'bot');
  assert.equal(exported.testContext.condition, 'release-flow-v2');
  assert.equal(exported.testContext.label, 'usability-check');
  assert.equal(exported.hasBotData, true);
  const localEvents = exported.events.filter((e) => localNames.includes(e.name));
  assert.ok(localEvents.length > 0);
  for (const event of localEvents) {
    assert.equal(event.context.participant, 'bot');
    assert.equal(event.context.condition, 'release-flow-v2');
    assert.equal(event.context.label, 'usability-check');
    assert.ok(Number.isFinite(event.playSeconds), 'local event carries the active gameplay clock');
  }
  const sharing = await page.evaluate(async (endpoint) => {
    const g = window.__fincan, f = window.__usability;
    // The fake collector stays inside this temporary origin and is intercepted by Playwright.
    g.telemetry.endpoint = endpoint;
    g.telemetry.setSharing(true);
    // Produce a real new exposure while sharing is ON, so exclusion is not
    // merely a consequence of the earlier events having no sharing consent.
    // The second waiter is correctly capped by the one open shelf here;
    // the unhired cashier is available and has not been observed by this camera.
    const probeId = 'cashier:' + g.state.staffCount.cashier;
    const point = g.world.loc.staffHirePads.cashier;
    g.world.updateStaffHirePad(0, null); f.focus(point.x, point.z);
    const probeBefore = f.events('purchase_seen', 'staff', probeId).length;
    for (let i = 0; i < 45; i++) f.observe(1 / 30);
    const consentedProbe = f.events('purchase_seen', 'staff', probeId);
    if (probeBefore !== 0 || consentedProbe.length !== 1) throw new Error('Sharing probe requires a new actual staff-square exposure: ' + JSON.stringify({
      probeId, probeBefore, after: consentedProbe.length,
      observation: g.world.purchaseObservations(g.player).find((row) => row.kind === 'staff' && row.id === probeId),
      cap: g.state.activeStaffCapFor('cashier'), count: g.state.staffCount.cashier,
    }));
    g.telemetry.record('performance', { fps: 30 });
    const pending = g.telemetry.buffer.pending();
    const envelope = g.telemetry.buffer.envelope();
    const stored = JSON.parse(localStorage.getItem(f.TELEMETRY_KEY));
    await g.telemetry.flush();
    g.telemetry.setSharing(false);
    return { pending, envelope, storedEvents: stored.events, consentedProbe };
  }, origin + '/__telemetry-probe');
  assert.equal(sharing.consentedProbe.length, 1, 'a new real exposure must occur while sharing is enabled');
  for (const event of sharing.storedEvents.filter((e) => localNames.includes(e.name))) {
    assert.equal(event.share, false, 'new local event cannot be marked shareable even with consent');
    assert.equal(event.context.participant, 'bot');
  }
  await writeFile(output + '/playtest-export.json', await page.evaluate(() => window.__fincan.telemetry.exportText()));
  for (const event of [...sharing.pending, ...sharing.envelope.events])
    assert.equal(localNames.includes(event.name), false, 'new local events excluded from pending and envelope');
  assert.ok(report.capturedEnvelopes.length > 0, 'optional collector probe must actually transmit an envelope');
  for (const envelope of report.capturedEnvelopes) {
    assert.equal('testContext' in envelope, false);
    for (const event of envelope.events) {
      assert.equal(localNames.includes(event.name), false);
      assert.equal('context' in event, false);
      assert.equal('playSeconds' in event, false);
      for (const field of ['cycle', 'paid', 'total', 'view_seconds', 'entry_seconds', 'phase', 'stationary', 'method'])
        assert.equal(field in event.props, false, 'local purchase field cannot enter collector envelope');
    }
  }
  report.checks.localOnlyExport = {
    participant: exported.testContext.participant,
    localEventCount: sharing.storedEvents.filter((e) => localNames.includes(e.name)).length,
    newExposureWhileSharing: sharing.consentedProbe.length,
    pendingLocalEvents: 0, transmittedLocalEvents: 0, capturedEnvelopes: report.capturedEnvelopes.length,
  };
  assert.deepEqual(report.errors, [], 'browser runtime errors');
  assert.deepEqual(report.remoteRequests, [], 'no external network requests');
  report.passed = true;
  console.log('usability-flow: passed (synthetic bot regression only)');
} catch (error) {
  report.passed = false;
  report.failure = error.stack;
  await page?.screenshot({ path: output + '/failure.png' }).catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  report.finished = new Date().toISOString();
  await writeFile(output + '/results.json', JSON.stringify(report, null, 2));
  await context?.close();
  await browser?.close();
  await server?.close();
}
