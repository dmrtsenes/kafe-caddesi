import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

/** Isolated browser integration checks: no user profile, native package or remote server. */
const output = '.devshots/offline-flow-check';
const origin = 'http://127.0.0.1:5197';
const requestedScenarios = new Set(process.argv.slice(2).filter((arg) => arg.startsWith('--scenario=')).flatMap((arg) => arg.slice(11).split(',')));
const knownScenarios = new Set();
const report = {
  started: new Date().toISOString(),
  scope: 'Loaded web game offline play/save; dev-source reload is online. Native offline cold boot is not tested.',
  scenarios: {},
};
await mkdir(output, { recursive: true });
let server;
let browser;
let currentPage;
let currentScenario;

async function ready(page) {
  await page.waitForFunction(() => !!window.__fincan, undefined, { timeout: 60_000 });
  await page.locator('#boot-screen').waitFor({ state: 'detached', timeout: 60_000 });
  await page.evaluate(async () => {
    const [{ BALANCE }, { GOALS }, { TUTORIAL_STEP_COUNT }, { SAVE_KEY }] = await Promise.all([
      import('/src/data/balance.ts'), import('/src/data/goals.ts'),
      import('/src/sim/Tutorial.ts'), import('/src/core/SaveManager.ts'),
    ]);
    window.__offlineFixture = { BALANCE, GOALS, TUTORIAL_STEP_COUNT, SAVE_KEY };
  });
}

async function scenario(name, run) {
  knownScenarios.add(name);
  if (requestedScenarios.size && !requestedScenarios.has(name)) return;
  currentScenario = name;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, locale: 'tr-TR',
  });
  const page = await context.newPage();
  currentPage = page;
  const errors = [];
  const remoteRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin)
      remoteRequests.push({ url: request.url(), method: request.method() });
  });
  await page.addInitScript(() => {
    localStorage.setItem('fincan-sokagi:language:v1', 'tr');
  });
  try {
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await ready(page);
    assert.deepEqual(await page.evaluate(() => window.__fincan.world.validateLayout()), [], 'initial layout');
    const result = await run({ page, context });
    report.scenarios[name] = { ...result, errors, remoteRequests };
    assert.deepEqual(errors, [], name + ': browser runtime errors');
    assert.deepEqual(remoteRequests, [], name + ': unexpected remote dependencies');
    await page.screenshot({ path: output + '/' + name + '.png' });
    await writeFile(output + '/results.json', JSON.stringify(report, null, 2));
    console.log(name + ': passed');
  } catch (error) {
    report.scenarios[name] = { ...report.scenarios[name], errors, remoteRequests, failure: error.stack };
    await page.screenshot({ path: output + '/' + name + '-failure.png' }).catch(() => {});
    throw error;
  } finally {
    currentPage = undefined;
    await context.close();
  }
}

try {
  server = await createServer({
    server: { host: '127.0.0.1', port: 5197, strictPort: true, open: false, hmr: false },
  });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });

  await scenario('offline-active-save', async ({ page, context }) => {
    const before = await page.evaluate(() => {
      const g = window.__fincan;
      return { time: g.state.playTime, x: g.player.x, z: g.player.z };
    });
    await context.setOffline(true);
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    // Place the normal autosave timer immediately before its next boundary.
    // Rendering, movement, simulation and the actual save path keep running.
    await page.evaluate(() => {
      const g = window.__fincan;
      g.autosaveTimer = window.__offlineFixture.BALANCE.world.autosaveInterval - 0.05;
    });
    await page.keyboard.down('ArrowRight');
    try {
      await page.waitForFunction((before) => {
        const g = window.__fincan;
        return g.state.playTime > before.time + 0.25 && Math.hypot(g.player.x - before.x, g.player.z - before.z) > 0.3;
      }, before, { timeout: 20_000 });
    } finally {
      await page.keyboard.up('ArrowRight');
    }
    const offline = await page.evaluate(() => {
      const g = window.__fincan;
      g.stop();
      const key = window.__offlineFixture.SAVE_KEY;
      const automatic = JSON.parse(localStorage.getItem(key));
      g.persist();
      const saved = JSON.parse(localStorage.getItem(key));
      return { runningTime: g.state.playTime, automaticTime: automatic?.state.playTime,
        money: g.state.money, savedMoney: saved.state.money, savedTime: saved.state.playTime,
        served: g.state.stats.served, savedServed: saved.state.stats.served,
        x: g.player.x, z: g.player.z };
    });
    assert.ok(offline.automaticTime > before.time, 'autosave must run while disconnected');
    assert.ok(offline.runningTime > before.time + 0.25, 'active simulation must advance offline');
    assert.equal(offline.savedServed, offline.served);
    assert.ok(Math.abs(offline.savedMoney - offline.money) <= 0.001);
    // Vite modules are fetched on reload; this is deliberately not a native cold-boot test.
    await context.setOffline(false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    const restored = await page.evaluate(() => {
      const g = window.__fincan;
      g.stop();
      return { money: g.state.money, served: g.state.stats.served, time: g.state.playTime };
    });
    assert.equal(restored.money, offline.savedMoney);
    assert.equal(restored.served, offline.savedServed);
    assert.ok(restored.time >= offline.savedTime);
    return { before, offline, restored };
  });

  await scenario('purchase-pads-save', async ({ page, context }) => {
    const rejected = await page.evaluate(() => {
      const g = window.__fincan;
      g.stop();
      const rows = [];
      const attempt = (name, action) => {
        const before = g.state.money;
        const accepted = action();
        rows.push({ name, accepted, before, after: g.state.money });
      };
      g.state.money = 100_000;
      attempt('locked station', () => g.buyStationUpgrade('k_sutbar', 'speed'));
      attempt('unavailable staff role', () => g.hireStaff('barista'));
      attempt('unmet branch prerequisites', () => g.buyLocation('sahil'));
      const originalSpeed = g.state.upgrades.speed;
      g.state.upgrades.speed = g.getPlayerUpgrades().find((row) => row.id === 'speed').maxLevel;
      attempt('maxed player upgrade', () => g.buyPlayerUpgrade('speed'));
      g.state.upgrades.speed = originalSpeed;
      g.state.money = 0;
      attempt('unaffordable player upgrade', () => g.buyPlayerUpgrade('capacity'));
      attempt('unaffordable station upgrade', () => g.buyStationUpgrade('k_semaver', 'speed'));
      attempt('unaffordable staff', () => g.hireStaff('waiter'));
      return rows;
    });
    for (const attempt of rejected) {
      assert.equal(attempt.accepted, false, attempt.name);
      assert.equal(attempt.after, attempt.before, attempt.name + ' deducted money');
    }
    const payment = await page.evaluate(() => {
      const g = window.__fincan;
      const w = g.world;
      const p = g.player;
      const zone = w.loc.zones.find((zone) => zone.id === 't1');
      if (!zone || !w.visiblePadIds.has(zone.id) || w.zoneUnlocked(zone.id)) throw new Error('starter pad fixture unavailable');
      const dt = 1 / 30;
      const idle = { x: 0, y: 0, mag: 0, active: false };
      const right = { x: 1, y: 0, mag: 1, active: true };
      g.state.money = 1000;
      p.setPosition(zone.padX - 3, zone.padZ);
      const startX = p.x;
      let insideFrames = 0;
      let frames = 0;
      while (p.x < zone.padX + 2.2 && frames++ < 180) {
        p.update(dt, right, w.nav, w.loc.bounds);
        if (Math.hypot(p.x - zone.padX, p.z - zone.padZ) < 2) insideFrames++;
        w.updatePads(dt, p);
      }
      const crossing = { startX, endX: p.x, insideFrames, frames, paid: w.padPaid(zone.id), money: g.state.money };
      // Let genuine player velocity settle away from every purchase pad.
      p.setPosition(w.loc.playerStart.x, w.loc.playerStart.z);
      for (let i = 0; i < 60; i++) p.update(dt, idle, w.nav, w.loc.bounds);
      w.updatePads(dt, p);
      // Exhaust a precisely representable partial budget, then remain on the pad.
      // No simulated income or grant path runs in this controlled payment fixture.
      g.state.money = 37.125;
      p.setPosition(zone.padX, zone.padZ);
      for (let i = 0; i < 90; i++) {
        p.update(dt, idle, w.nav, w.loc.bounds);
        w.updatePads(dt, p);
      }
      const partial = { paid: w.padPaid(zone.id), money: g.state.money, unlocked: w.zoneUnlocked(zone.id) };
      const stateSave = g.state.save();
      const worldSave = w.save();
      g.state.load(JSON.parse(JSON.stringify(stateSave)));
      w.load(JSON.parse(JSON.stringify(worldSave)));
      const memoryReload = { paid: w.padPaid(zone.id), money: g.state.money };
      p.setPosition(w.loc.playerStart.x, w.loc.playerStart.z);
      g.persist();
      const stored = JSON.parse(localStorage.getItem(window.__offlineFixture.SAVE_KEY));
      return { zone: zone.id, cost: zone.cost, crossing, partial, memoryReload,
        stored: { paid: stored.worlds.kose.pads[zone.id], money: stored.state.money } };
    });
    assert.ok(payment.crossing.insideFrames > 0, 'player must cross inside the pad');
    assert.ok(payment.crossing.endX > 2, 'player must exit the pad under actual movement');
    assert.equal(payment.crossing.paid, 0, 'walking through a pad must not charge');
    assert.equal(payment.crossing.money, 1000);
    assert.deepEqual(payment.partial, { paid: 37.125, money: 0, unlocked: false });
    assert.deepEqual(payment.memoryReload, { paid: 37.125, money: 0 });
    assert.deepEqual(payment.stored, { paid: 37.125, money: 0 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    await context.setOffline(true);
    const completion = await page.evaluate((payment) => {
      const g = window.__fincan;
      g.stop();
      const w = g.world;
      const p = g.player;
      const zone = w.loc.zones.find((zone) => zone.id === payment.zone);
      const restored = { money: g.state.money, paid: w.padPaid(zone.id), unlocked: w.zoneUnlocked(zone.id) };
      const funds = zone.cost - restored.paid + 50;
      g.state.money = funds;
      p.setPosition(zone.padX, zone.padZ);
      p.planarSpeed = 0;
      const dt = 1 / 30;
      for (let i = 0; i < 240; i++) w.updatePads(dt, p);
      const after = { money: g.state.money, paid: w.padPaid(zone.id), unlocked: w.zoneUnlocked(zone.id) };
      for (let i = 0; i < 180; i++) w.updatePads(dt, p);
      const repeated = { money: g.state.money, paid: w.padPaid(zone.id), unlocked: w.zoneUnlocked(zone.id) };
      g.persist();
      return { restored, funds, after, repeated, layout: w.validateLayout(), stored: JSON.parse(localStorage.getItem(window.__offlineFixture.SAVE_KEY)).state.money };
    }, payment);
    assert.deepEqual(completion.restored, payment.partial);
    assert.equal(completion.after.unlocked, true);
    assert.equal(completion.after.paid, payment.cost);
    assert.ok(Math.abs(completion.after.money - 50) <= 0.000001, 'unlock charges only the remaining balance');
    assert.deepEqual(completion.repeated, completion.after, 'completed pad must never charge twice');
    assert.deepEqual(completion.layout, [], 'unlock must leave reachable station access points');
    assert.equal(completion.stored, 50);
    return { rejected, payment, completion };
  });

  await scenario('price-change-payment', async ({page}) => {
    const result=await page.evaluate(async()=>{
      const g=window.__fincan;g.stop();const w=g.world,p=g.player;
      g.state.tutorialStep=99;g.ui.setTutorial(null);
      const zone=w.loc.zones.find(z=>z.id==='a7');
      const parents=[];let cursor=zone;
      while(cursor.requires){cursor=w.loc.zones.find(z=>z.id===cursor.requires);parents.unshift(cursor);}
      for(const z of parents)if(!w.zoneUnlocked(z.id))w.unlockZone(z.id);g.ui.endCelebrate();
      g.state.money=11;const earned=g.state.totalEarned;
      const save=w.save();save.pads[zone.id]=zone.cost+6000;w.load(save);
      const loaded={paid:w.padPaid(zone.id),money:g.state.money,open:w.zoneUnlocked(zone.id)};
      const next=w.nextLockedZone,show=g.showRewardedOrExplain;let adCalls=0;
      w.nextLockedZone=()=>zone;g.showRewardedOrExplain=async()=>{adCalls++;return true;};
      const fullAd=await g.applyAdReward('zone_finish');
      w.padProgress.set(zone.id,zone.cost*.25);const earlyAd=await g.applyAdReward('zone_finish');
      w.padProgress.set(zone.id,save.pads[zone.id]);w.nextLockedZone=next;g.showRewardedOrExplain=show;
      p.dropAll();p.hasVacuum=false;p.interacting=false;p.planarSpeed=0;p.setPosition(zone.padX,zone.padZ);
      for(let i=0;i<6;i++)w.updatePads(1/30,p);
      const crossing={money:g.state.money,open:w.zoneUnlocked(zone.id)};
      for(let i=0;i<90;i++)w.updatePads(1/30,p);
      const claimed={money:g.state.money,open:w.zoneUnlocked(zone.id),earned:g.state.totalEarned-earned};
      const state=g.state.save(),world=w.save();g.state.load(state);w.load(world);
      for(let i=0;i<90;i++)w.updatePads(1/30,p);
      return{adCalls,fullAd,earlyAd,cost:zone.cost,loaded,crossing,claimed,reloaded:g.state.money,storedPad:world.pads[zone.id]??null,layout:w.validateLayout()};
    });
    assert.equal(result.adCalls,0);assert.equal(result.fullAd,false);assert.equal(result.earlyAd,false);
    assert.equal(result.loaded.paid,result.cost+6000);assert.deepEqual(result.crossing,{money:11,open:false});
    assert.deepEqual(result.claimed,{money:6011,open:true,earned:0});assert.equal(result.reloaded,6011);assert.equal(result.storedPad,null);assert.deepEqual(result.layout,[]);
    return result;
  });

  await scenario('branch-startup', async ({page}) => {
    const result=await page.evaluate(async()=>{
      const { ZONE_PURCHASE_HALF } = await import('/src/world/ZonePurchasePad.ts');
      const g=window.__fincan;g.stop();g.state.tutorialStep=99;g.ui.setTutorial(null);
      for(const zone of g.world.loc.zones)if(!g.world.zoneUnlocked(zone.id))g.world.unlockZone(zone.id);
      const entry=g.getLocations().find(l=>l.id==='sahil');
      g.state.money=entry.cost+123;
      const bought=g.buyLocation('sahil');g.stop();g.ui.endCelebrate();
      const w=g.world,money=g.state.money;
      const start={bar:w.zoneUnlocked('p1'),next:w.zoneUnlocked('p2'),machines:w.openMachines().length,counters:w.openCounters().length};
      const spawn={x:g.player.x,z:g.player.z,walkable:!w.nav.solidBlocked(g.player.x,g.player.z,window.__offlineFixture.BALANCE.player.radius)};
      const overlaps=w.loc.zones.filter(zone=>!w.zoneUnlocked(zone.id)&&Math.abs(spawn.x-zone.padX)<ZONE_PURCHASE_HALF-0.1&&Math.abs(spawn.z-zone.padZ)<ZONE_PURCHASE_HALF-0.1).map(zone=>zone.id);
      const depositBefore=w.padPaid('p2');
      const mods={spawnMult:1,valueMult:1,patienceMult:1,tipMult:1};
      for(let i=0;i<240;i++)w.update(1/30,g.player,mods);
      const guide=w.pickGuideTarget(g.player);
      const duplicate=g.buyLocation('sahil'),unknown=g.buyLocation('unknown');
      return{bought,money,start,spawn,overlaps,depositBefore,depositAfter:w.padPaid('p2'),guide,customers:w.customers.length,stock:w.openMachines().reduce((n,m)=>n+m.output,0),duplicate,unknown,after:g.state.money,layout:w.validateLayout()};
    });
    assert.equal(result.spawn.walkable,true);assert.deepEqual(result.overlaps,[]);
    assert.equal(result.depositAfter,result.depositBefore,'idle branch spawn must never pay for an expansion');
    assert.equal(result.bought,true);assert.equal(result.money,123);assert.equal(result.start.bar,true);assert.equal(result.start.next,false);
    assert.ok(result.start.machines>0&&result.start.counters>0);assert.ok(result.customers>0&&result.stock>0);assert.ok(result.guide);
    assert.equal(result.duplicate,false);assert.equal(result.unknown,false);assert.equal(result.after,123);assert.deepEqual(result.layout,[]);
    return result;
  });

  await scenario('prestige-restart', async ({ page, context }) => {
    await context.setOffline(true);
    const result = await page.evaluate(async () => {
      const g = window.__fincan; g.stop(); g.skipTutorial(); g.ui.setTutorial(null);
      const [{ prestigePointsFor, PRESTIGE_MIN_EARNED }, { RobotVacuum }, { Customer }, { CUSTOMER_ARCHETYPES }] = await Promise.all([
        import('/src/data/prestige.ts'), import('/src/sim/RobotVacuum.ts'), import('/src/entities/Customer.ts'), import('/src/data/customers.ts'),
      ]);
      for (const zone of g.world.loc.zones) if (!g.world.zoneUnlocked(zone.id)) g.world.unlockZone(zone.id);
      g.state.earn(PRESTIGE_MIN_EARNED);
      if (!g.buyLocation('sahil')) throw new Error('prestige branch fixture could not open Sahil');
      g.stop(); g.ui.endCelebrate();
      g.state.prestigePoints = 7; g.state.prestigeLevels = { start: 1, gain: 2 }; g.state.dailyStreak = 4;
      g.state.goalIndex = 10; g.state.goalProgress = 3;
      g.state.stats.served = 19; g.state.stats.orders = 11;
      g.settings.set('muted', true); g.settings.set('music', false);
      for (const world of g.worlds.values()) {
        const machine = world.openMachines()[0]; machine.speedLevel = 3; machine.output = 5;
      }
      g.player.give('smoothie'); g.player.hasVacuum = true;
      const oldWorlds = [...g.worlds.values()];
      const robot = new RobotVacuum(g.world); g.robot = robot; g.robotLeft = 45;
      const expected = { points: 7 + prestigePointsFor(g.state.revenueEarned), count: g.state.prestigeCount + 1,
        money: g.state.prestigeStartMoney, prefs: g.settings.all, levels: { ...g.state.prestigeLevels }, tutorial: g.state.tutorialStep };
      const accepted = g.doPrestige(); g.stop(); g.ui.endCelebrate();
      const w = g.world, p = g.player;
      const reset = { accepted, worldIds: [...g.worlds.keys()], active: g.state.activeLocation,
        removedOldWorlds: oldWorlds.every(world => world.root.parent === null && world !== w),
        carry: p.carryCount, vacuum: p.hasVacuum, robot: g.robot === null && g.robotLeft === 0 && robot.root.parent === null,
        points: g.state.prestigePoints, count: g.state.prestigeCount, money: g.state.money, revenue: g.state.revenueEarned,
        levels: g.state.prestigeLevels, streak: g.state.dailyStreak, prefs: g.settings.all, tutorial: g.state.tutorialStep,
        goalIndex: g.state.goalIndex, goalProgress: g.state.goalProgress, servedSinceReset: g.state.statSinceReset('served'),
        stationLevelsReset: w.stations.every(station => station.speedLevel === 0 && station.capLevel === 0),
        starterMachines: w.openMachines().length, starterCounters: w.openCounters().length, duplicate: g.doPrestige(), layout: w.validateLayout() };
      // A real counter order, machine pickup, seated delivery and cash collection in the rebuilt cafe.
      w.spawnTimer = 1e9; w.dustTimer = 1e9;
      const guest = new Customer({ ...CUSTOMER_ARCHETYPES[0], dineInBias: 100 }, 'prestige-guest');
      w.customers.push(guest); w.root.add(guest.char.root); w.sendToCounter(guest);
      const counter = guest.counter, point = { x: 0, z: 0 };
      counter.queueSlot(0, point); guest.setPosition(point.x, point.z); guest.state = 'order';
      guest.patience = guest.maxPatience = 10000;
      counter.servicePoint(point); p.setPosition(point.x, point.z);
      for (let frame = 0; frame < 180 && !guest.order; frame++) { w.updateCounters(1 / 30, p); g.goals.update(); }
      if (!guest.order || !guest.table) throw new Error('rebuilt cafe did not accept a seated order');
      guest.state = 'seated'; guest.setPosition(guest.table.x, guest.table.z);
      if (!guest.table.seatedGuests.includes(guest)) guest.table.seatedGuests.push(guest);
      const quantity = guest.order.remainingOf('cay'), firstGoal = g.state.goalIndex;
      const machine = w.openMachines().find(station => station.def.item === 'cay');
      machine.servicePoint(point); p.setPosition(point.x, point.z);
      for (let frame = 0; frame < 900 && p.carryCount < quantity; frame++) g.stepSim(1 / 30);
      const pickedUp = p.hasItem('cay');
      guest.table.servicePoint(point); p.setPosition(point.x, point.z);
      for (let frame = 0; frame < 360 && guest.order.remainingOf('cay') > 0; frame++) { w.updateStationInteraction(1 / 30, p); g.goals.update(); }
      const served = quantity - guest.order.remainingOf('cay');
      counter.servicePoint(point); p.setPosition(point.x, point.z);
      for (let frame = 0; frame < 180 && g.state.revenueEarned === 0; frame++) g.stepSim(1 / 30);
      const service = { quantity, firstGoal, pickedUp, served, goalIndex: g.state.goalIndex, revenue: g.state.revenueEarned,
        servedSinceReset: g.state.statSinceReset('served'), tutorial: g.state.tutorialStep };
      g.persist();
      const saved = JSON.parse(localStorage.getItem(window.__offlineFixture.SAVE_KEY));
      return { expected, reset, service, saved: { money: saved.state.money, points: saved.state.prestigePoints,
        count: saved.state.prestigeCount, levels: saved.state.prestigeLevels, tutorial: saved.state.tutorialStep,
        goalIndex: saved.state.goalIndex, served: saved.state.stats.served, active: saved.state.activeLocation,
        worlds: Object.keys(saved.worlds) } };
    });
    report.scenarios['prestige-restart'] = result;
    const { expected, reset, service } = result;
    assert.equal(reset.accepted, true); assert.deepEqual(reset.worldIds, ['kose']); assert.equal(reset.active, 'kose');
    assert.equal(reset.removedOldWorlds, true); assert.equal(reset.carry, 0); assert.equal(reset.vacuum, false); assert.equal(reset.robot, true);
    for (const key of ['points', 'count', 'money', 'tutorial']) assert.equal(reset[key], expected[key]);
    assert.deepEqual(reset.levels, expected.levels); assert.deepEqual(reset.prefs, expected.prefs); assert.equal(reset.streak, 4);
    assert.equal(reset.revenue, 0); assert.equal(reset.goalIndex, 0); assert.equal(reset.goalProgress, 0); assert.equal(reset.servedSinceReset, 0);
    assert.equal(reset.stationLevelsReset, true); assert.ok(reset.starterMachines > 0 && reset.starterCounters > 0);
    assert.equal(reset.duplicate, false); assert.deepEqual(reset.layout, []);
    assert.equal(service.firstGoal, 1, 'one order advances exactly one fresh goal'); assert.equal(service.pickedUp, true);
    assert.ok(service.quantity > 0); assert.equal(service.served, service.quantity); assert.equal(service.servedSinceReset, service.quantity);
    assert.ok(service.revenue > 0); assert.equal(service.tutorial, expected.tutorial, 'completed instructions remain completed');
    assert.deepEqual(result.saved.worlds, ['kose']);
    await context.setOffline(false);
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page);
    const restored = await page.evaluate(() => {
      const g = window.__fincan; g.stop();
      return { money: g.state.money, points: g.state.prestigePoints, count: g.state.prestigeCount,
        levels: g.state.prestigeLevels, tutorial: g.state.tutorialStep, goalIndex: g.state.goalIndex,
        served: g.state.stats.served, active: g.state.activeLocation, worlds: [...g.worlds.keys()], prefs: g.settings.all };
    });
    for (const [key, value] of Object.entries(result.saved)) assert.deepEqual(restored[key], value, 'prestige reload: ' + key);
    assert.deepEqual(restored.prefs, expected.prefs);
    return { ...result, restored };
  });

  await scenario('goal-ui-routing', async ({ page }) => {
    await page.evaluate(() => {
      const g = window.__fincan;
      g.stop();
      g.state.tutorialStep = window.__offlineFixture.TUTORIAL_STEP_COUNT;
      g.ui.setTutorial(null);
      g.state.money = 123.5;
    });
    const routes = [];
    for (const [kind, expectedPanel, expectedTitle] of [
      ['hire', 'staff', 'Personel'], ['upgrade', 'upgrades', 'Yükseltmeler'],
      ['stationLevel', 'stations', 'İstasyonlar'], ['location', 'locations', 'Şubeler'],
      ['clean', null, null], ['mop', null, null],
    ]) {
      const before = await page.evaluate((kind) => {
        const g = window.__fincan;
        g.ui.closePanels();
        const index = window.__offlineFixture.GOALS.findIndex((goal) => goal.kind === kind);
        if (index < 0) throw new Error('missing goal fixture: ' + kind);
        g.state.goalIndex = index;
        g.state.goalProgress = 0;
        g.ui.hudTimer = 1;
        g.ui.update(0.1);
        return { money: g.state.money, index, goal: g.goals.current.id, stats: JSON.stringify(g.state.stats) };
      }, kind);
      await page.locator('button.goal').click();
      await page.getByRole('button', { name: 'HEDEFE GİT', exact: true }).click();
      if (expectedPanel) await page.getByRole('heading', { name: expectedTitle, exact: true }).waitFor({ state: 'visible' });
      else await page.locator('.pw').waitFor({ state: 'hidden' });
      const after = await page.evaluate(() => {
        const g = window.__fincan;
        return { money: g.state.money, index: g.state.goalIndex, panel: g.ui.panels.currentId(),
          stats: JSON.stringify(g.state.stats), guideGoal: g.world.guideGoal?.id ?? null };
      });
      assert.equal(after.panel, expectedPanel, kind + ' routes to the right panel');
      assert.equal(after.money, before.money, 'following a goal must not grant money');
      assert.equal(after.index, before.index, 'following a goal must not complete it');
      assert.equal(after.stats, before.stats, 'following a goal must not perform its work');
      if (!expectedPanel) assert.equal(after.guideGoal, before.goal);
      routes.push({ kind, goal: before.goal, panel: after.panel, moneyUnchanged: true });
    }
    return { routes };
  });

  await scenario('guide-complete-care', async ({ page }) => {
    const care = await page.evaluate(() => {
      const g = window.__fincan;
      g.stop();
      const w = g.world;
      const p = g.player;
      const f = window.__offlineFixture;
      g.state.tutorialStep = f.TUTORIAL_STEP_COUNT;
      g.ui.setTutorial(null);
      g.state.playTime = 100;
      w.customers.length = 0;
      for (const counter of w.counters) { counter.queue.length = 0; counter.cash = 0; }
      for (const table of w.tables) {
        table.seatTaken.fill(false); table.seatedGuests.length = 0;
        table.dishes = 0; table.soil = 0;
      }
      const table = w.tables.find((table) => !table.locked);
      const bin = w.bins.find((bin) => !bin.locked);
      const machine = w.openMachines().find((machine) => machine.def.item === 'cay');
      const shelf = w.shelfFor('cay');
      const access = (station) => { const point = { x: 0, z: 0 }; station.servicePoint(point); return point; };
      const samePoint = (target, point) => !!target && Math.hypot(target.x - point.x, target.z - point.z) < 0.001;
      const idle = { x: 0, y: 0, mag: 0, active: false };
      const stepInteraction = () => {
        g.state.playTime += 1 / 30;
        p.update(1 / 30, idle, w.nav, w.loc.bounds);
        w.updatePlayerInteraction(1 / 30, p);
      };
      table.dishes = 1; table.soil = 1; table.dirtyAge = 80;
      w.guideGoal = f.GOALS.find((goal) => goal.kind === 'clean');
      const tablePoint = access(table);
      p.setPosition(tablePoint.x, tablePoint.z);
      const atStation = (target, station) => {
        if(!target||w.nav.solidBlocked(target.x,target.z,.32))return false;
        const point={x:0,z:0};station.playerPoint(target.x,target.z,point);
        return Math.hypot(point.x-target.x,point.z-target.z)<=1.05&&w.nav.interactionLineClear(target.x,target.z,point.x,point.z);
      };
      const begin = w.pickGuideTarget(p);
      const selectedId = w.guideCare?.id ?? null;
      for (let i = 0; i < 300 && !p.hasItem('bulasik'); i++) stepInteraction();
      const collected = { dishes: table.dishes, hasDish: p.hasItem('bulasik'), soil: table.soil };
      // New shelf demand must not steal the in-progress cleaning job.
      machine.output = 3;
      shelf.contents.length = 0; shelf.output = 0;
      const toBin = w.pickGuideTarget(p);
      const binPoint = access(bin);
      p.setPosition(binPoint.x, binPoint.z);
      for (let i = 0; i < 300 && p.hasItem('bulasik'); i++) stepInteraction();
      const toPolish = w.pickGuideTarget(p);
      const retainedId = w.guideCare?.id ?? null;
      p.setPosition(tablePoint.x, tablePoint.z);
      for (let i = 0; i < 600 && table.isDirty; i++) stepInteraction();
      const finishedTarget = w.guideCareTarget(p);
      const finished = { dirty: table.isDirty, dishes: table.dishes, soil: table.soil,
        carry: [...p.slots], target: finishedTarget, activeCare: w.guideCare ?? null };

      // A stale job releases the guide without pretending the work completed.
      g.state.playTime += 9;
      table.dishes = 1; table.soil = 1; table.dirtyAge = 80;
      const expiring = w.beginGuideCare(p, false);
      g.state.playTime += 51;
      const expiredTarget = w.guideCareTarget(p);
      const expired = { began: expiring !== null, target: expiredTarget, activeCare: w.guideCare ?? null, stillDirty: table.isDirty };

      table.dishes = 0; table.soil = 0;
      g.state.playTime += 9;
      w.guideGoal = f.GOALS.find((goal) => goal.kind === 'mop');
      let spill = null;
      let path = [];
      for (const point of [{ x: 3, z: -2 }, { x: 0, z: -2 }, { x: -3, z: -2 }]) {
        if (w.nav.solidBlocked(point.x, point.z, 0.32)) continue;
        path = [];
        w.nav.findPath(p.x, p.z, point.x, point.z, path);
        if (!path.length) continue;
        spill = w.spills.spawn(point.x, point.z, 'liquid');
        if (spill) break;
      }
      if (!spill) throw new Error('reachable spill fixture could not be created');
      const mopTarget = w.pickGuideTarget(p);
      const mop = { target: mopTarget, spill: { id: spill.id, x: spill.x, z: spill.z },
        pointsMatch: samePoint(mopTarget, spill), pathCoordinates: path.length, selectedKind: w.guideCare?.kind };
      w.spills.remove(spill);
      const removedSpillTarget = w.guideCareTarget(p);
      const removedSpillReleased = removedSpillTarget === null && w.guideCare === null;

      // Full shelves with a valuable carried product never turn an automatic
      // cleaning hint into an instruction to trash that product.
      g.state.playTime += 9;
      table.dishes = 1; table.soil = 1; table.dirtyAge = 80;
      for (const pickup of w.openPickups()) {
        pickup.contents = Array(pickup.outputCap).fill(pickup.def.item);
        pickup.output = pickup.contents.length;
      }
      if (!p.give('cay')) throw new Error('valuable carry fixture failed');
      const productsBefore = [...p.slots];
      w.guideGoal = f.GOALS.find((goal) => goal.kind === 'clean');
      const valuableTarget = w.pickGuideTarget(p);
      // Full shelves + held products cannot lead to polishing or floor cleaning.
      table.dishes=0;table.soil=1;w.guideCare=null;w.guideGoal=null;
      const polishBlocked=w.pickGuideTarget(p);
      table.soil=0;const blockedSpill=w.spills.spawn(p.x,p.z,'liquid');
      w.guideCare={kind:'spill',id:blockedSpill.id,startedAt:g.state.playTime};
      const spillBlocked=w.pickGuideTarget(p);
      const counter=w.openCounters()[0];counter.cash=1;counter.cashValue=50;
      const smallCash=w.pickGuideTarget(p);
      return {
        table: table.id, begin, selectedId, beginAtTable: atStation(begin, table),
        collected, toBin, binMatches: atStation(toBin, bin), toPolish,
        polishMatches: atStation(toPolish, table), retainedId, finished, expired,
        mop, removedSpillReleased, blockedHands:{polish:polishBlocked?.label,spill:spillBlocked?.label,smallCash:smallCash?.label},
        valuable: { target: valuableTarget, before: productsBefore, after: [...p.slots],
          targetIsBin: !!valuableTarget && w.bins.some((bin) => samePoint(valuableTarget, access(bin))) },
      };
    });
    report.scenarios['guide-complete-care'] = care;
    assert.equal(care.beginAtTable, true, 'clean goal starts at the actual table access point');
    assert.equal(care.selectedId, care.table);
    assert.equal(care.collected.hasDish, true, 'actual hand interaction collects the dish');
    assert.equal(care.collected.dishes, 0);
    assert.equal(care.binMatches, true, 'new shelf demand must not interrupt waste delivery');
    assert.equal(care.polishMatches, true, 'guide returns to the same table for polishing');
    assert.equal(care.retainedId, care.table);
    assert.equal(care.finished.dirty, false, 'actual interaction finishes the whole table');
    assert.deepEqual(care.finished.carry, []);
    assert.equal(care.finished.activeCare, null);
    assert.equal(care.finished.target, null);
    assert.deepEqual(care.expired, { began: true, target: null, activeCare: null, stillDirty: true });
    assert.equal(care.mop.pointsMatch, true);
    assert.ok(care.mop.pathCoordinates > 0);
    assert.equal(care.mop.selectedKind, 'spill');
    assert.equal(care.removedSpillReleased, true);
    assert.deepEqual(care.valuable.after, care.valuable.before);
    assert.equal(care.valuable.targetIsBin, false, 'automatic hints must not trash a valuable product');
    assert.equal(care.blockedHands.polish,'YENİ SİPARİŞİ BEKLE');
    assert.equal(care.blockedHands.spill,'YENİ SİPARİŞİ BEKLE');
    assert.equal(care.blockedHands.smallCash,'PARAYI TOPLA');
    return care;
  });

  await scenario('vacuum-return', async ({ page }) => {
    const result = await page.evaluate(() => {
      const g = window.__fincan;
      g.stop();
      const w = g.world;
      const p = g.player;
      const f = window.__offlineFixture;
      g.state.tutorialStep = f.TUTORIAL_STEP_COUNT;
      g.state.playTime = 100;
      g.ui.setTutorial(null);
      w.unlockZone('a3');g.ui.endCelebrate();
      w.guideGoal = null;
      w.guideCare = null;
      w.customers.length = 0;
      for (const counter of w.counters) { counter.queue.length = 0; counter.cash = 0; }
      for (const table of w.tables) {
        table.seatTaken.fill(false); table.seatedGuests.length = 0; table.dishes = 0; table.soil = 0;
      }
      for (const machine of w.openMachines()) machine.output = 0;
      for (const pickup of w.openPickups()) {
        pickup.contents.splice(0, pickup.contents.length, ...Array(pickup.outputCap).fill(pickup.def.item));
        pickup.output = pickup.contents.length;
      }
      for (const spill of [...w.spills.list]) w.spills.remove(spill);
      const dock = w.vacuums.find((dock) => !dock.locked);
      if (!dock) throw new Error('vacuum dock fixture missing');
      const dt = 1 / 30;
      const idle = { x: 0, y: 0, mag: 0, active: false };
      const step = (move = idle) => {
        g.state.playTime += dt;
        p.update(dt, move, w.nav, w.loc.bounds);
        w.updatePlayerInteraction(dt, p);
      };
      const dockPoint = { x: 0, z: 0 };
      dock.servicePoint(dockPoint);
      // The stocked coffee shelf overlaps this reachable edge of the dock.
      p.setPosition(dockPoint.x + 0.2, dockPoint.z - 0.18);
      for (let i = 0; i < 180 && !p.hasVacuum; i++) step();
      const pickup = { hasVacuum: p.hasVacuum, lock: p.noTakeFrom, dockOutput: dock.output, x: p.x, z: p.z };
      if (!pickup.hasVacuum) throw new Error('real vacuum pickup failed: ' + JSON.stringify(pickup));
      const machine = w.openMachines().find((machine) => machine.def.item === 'cay');
      const shelf = w.shelfFor('cay');
      machine.output = 3;
      shelf.contents.length = 0;
      shelf.output = 0;
      const serviceWork = w.hasServiceWork();
      const walkTo = (target) => {
        if (!target) return { reached: false, pathCoordinates: 0, x: p.x, z: p.z };
        const path = [];
        w.nav.findPath(p.x, p.z, target.x, target.z, path);
        let index = 0;
        let frames = 0;
        while (Math.hypot(p.x - target.x, p.z - target.z) > 0.16 && frames++ < 600) {
          while (index + 1 < path.length && Math.hypot(p.x - path[index], p.z - path[index + 1]) < 0.18) index += 2;
          const x = index + 1 < path.length ? path[index] : target.x;
          const z = index + 1 < path.length ? path[index + 1] : target.z;
          const dx = x - p.x;
          const dz = z - p.z;
          const distance = Math.hypot(dx, dz) || 1;
          step({ x: dx / distance, y: -dz / distance, mag: Math.min(1, distance / 0.5), active: true });
        }
        for (let i = 0; i < 6; i++) step();
        return { reached: Math.hypot(p.x - target.x, p.z - target.z) < 0.25, frames,
          pathCoordinates: path.length, x: p.x, z: p.z, lock: p.noTakeFrom, hasVacuum: p.hasVacuum };
      };
      const clearanceTarget = w.pickGuideTarget(p);
      const clearance = walkTo(clearanceTarget);
      const returnTarget = w.pickGuideTarget(p);
      const returned = walkTo(returnTarget);
      for (let i = 0; i < 180 && p.hasVacuum; i++) step();
      const drop = { hasVacuum: p.hasVacuum, lock: p.noTakeFrom, dockOutput: dock.output, x: p.x, z: p.z };
      let repicked = false;
      for (let i = 0; i < 180; i++) { step(); if (p.hasVacuum) repicked = true; }
      return { dock: dock.id, dockPoint, pickup, serviceWork, clearanceTarget, clearance, returnTarget, returned,
        drop, repicked, afterWait: { hasVacuum: p.hasVacuum, dockOutput: dock.output, lock: p.noTakeFrom }, layout: w.validateLayout() };
    });
    report.scenarios['vacuum-return'] = result;
    assert.equal(result.pickup.hasVacuum, true);
    assert.equal(result.pickup.lock, result.dock, 'real pickup sets the dock anti-toggle lock');
    assert.equal(result.serviceWork, true, 'new shelf demand must create service work');
    assert.equal(result.clearanceTarget?.label, 'BİR ADIM UZAKLAŞ');
    assert.equal(result.returnTarget?.label, 'SÜPÜRGEYİ BIRAK');
    assert.ok(Math.hypot(result.returnTarget.x - result.dockPoint.x, result.returnTarget.z - result.dockPoint.z) < 0.001);
    assert.ok(result.clearance.pathCoordinates > 0, 'clearance target must have a real navigable path');
    assert.equal(result.clearance.reached, true, 'player reaches clearance under actual movement');
    assert.notEqual(result.clearance.lock, result.dock, 'clearance must release the dock lock');
    assert.equal(result.clearance.hasVacuum, true, 'clearance carries the vacuum away before dropping');
    assert.equal(result.returned.reached, true, 'player reaches the return target');
    assert.equal(result.drop.hasVacuum, false, 'the actual dock interaction must drop the vacuum');
    assert.equal(result.drop.dockOutput, 1);
    assert.equal(result.repicked, false, 'remaining at the dock must not rapidly re-pick the vacuum');
    assert.equal(result.afterWait.hasVacuum, false);
    assert.deepEqual(result.layout, []);
    return result;
  });

  await scenario('spill-near-vacuum', async ({ page }) => {
    const result = await page.evaluate(() => {
      const g = window.__fincan;
      g.stop();
      const w = g.world;
      const p = g.player;
      const f = window.__offlineFixture;
      g.state.tutorialStep = f.TUTORIAL_STEP_COUNT;
      g.state.playTime = 100;
      g.ui.setTutorial(null);
      w.customers.length = 0;
      for (const counter of w.counters) { counter.queue.length = 0; counter.cash = 0; }
      for (const table of w.tables) {
        table.seatTaken.fill(false); table.seatedGuests.length = 0; table.dishes = 0; table.soil = 0;
      }
      for (const spill of [...w.spills.list]) w.spills.remove(spill);
      const dock = w.vacuums.find((dock) => !dock.locked);
      const dockPoint = { x: 0, z: 0 };
      dock.servicePoint(dockPoint);
      p.setPosition(dockPoint.x, dockPoint.z);
      const spill = w.spills.spawn(p.x, p.z, 'liquid');
      if (!spill) throw new Error('adjacent spill fixture could not be created');
      w.guideGoal = f.GOALS.find((goal) => goal.kind === 'mop');
      const initialTarget = w.pickGuideTarget(p);
      const initialCare = w.guideCare ? { ...w.guideCare } : null;
      const beforeMopped = g.state.stats.mopped;
      let grabbedVacuum = false;
      let frames = 0;
      while (w.spills.byId(spill.id) && frames++ < 600) {
        g.state.playTime += 1 / 30;
        p.update(1 / 30, { x: 0, y: 0, mag: 0, active: false }, w.nav, w.loc.bounds);
        w.updatePlayerInteraction(1 / 30, p);
        if (p.hasVacuum) grabbedVacuum = true;
      }
      return { dock: dock.id, dockServiceDistance: Math.hypot(p.x - dockPoint.x, p.z - dockPoint.z),
        dockBodyDistance: Math.hypot(p.x - dock.x, p.z - dock.z),
        spill: { id: spill.id, x: spill.x, z: spill.z }, initialTarget, initialCare, frames,
        grabbedVacuum, cleared: !w.spills.byId(spill.id), mopped: g.state.stats.mopped - beforeMopped,
        hasVacuum: p.hasVacuum, dockOutput: dock.output };
    });
    report.scenarios['spill-near-vacuum'] = result;
    assert.ok(result.dockServiceDistance < 1.05, 'spill fixture must overlap the dock service-point activation range');
    assert.equal(result.initialCare?.kind, 'spill');
    assert.equal(result.initialCare?.id, result.spill.id);
    assert.equal(result.grabbedVacuum, false, 'a guided spill must not trigger an unwanted vacuum pickup');
    assert.equal(result.cleared, true, 'the guided spill must actually be cleaned');
    assert.equal(result.mopped, 1);
    assert.equal(result.hasVacuum, false);
    assert.equal(result.dockOutput, 1);
    return result;
  });

  await scenario('service-point-selection', async ({ page }) => {
    const samples = await page.evaluate(() => {
      const g = window.__fincan;
      g.stop();
      const w = g.world;
      for (const zone of w.loc.zones) if (!w.zoneUnlocked(zone.id)) w.unlockZone(zone.id);
      for (const table of w.tables) {
        table.seatTaken.fill(false);
        table.seatedGuests.length = 0;
        table.dishes = 1;
        table.soil = 1;
      }
      const access = (station) => { const point = { x: 0, z: 0 }; station.servicePoint(point); return point; };
      const distance = (point, station) => { const a = {x:0,z:0}; station.playerPoint(point.x,point.z,a); return w.nav.interactionLineClear(point.x,point.z,a.x,a.z) ? Math.hypot(a.x-point.x,a.z-point.z) : Infinity; };
      const r = window.__offlineFixture.BALANCE.player.interactRadius;
      const violations = [];
      let count = 0;
      for (const table of w.tables) {
        const center = access(table);
        for (const radius of [0, 0.5, 1, 1.3]) {
          for (let i = 0; i < 24; i++) {
            const angle = i * Math.PI / 12;
            const point = { x: center.x + Math.cos(angle) * radius, z: center.z + Math.sin(angle) * radius };
            if (w.nav.solidBlocked(point.x, point.z, 0.32)) continue;
            count++;
            const reachable = w.tables.filter((candidate) => distance(point, candidate) <= 1.05 &&
              Math.hypot(candidate.x - point.x, candidate.z - point.z) < r + 0.8);
            const selected = w.nearestDirtyTable(point.x, point.z, r);
            if (reachable.length && (!selected || distance(point, selected) > 1.05)) {
              violations.push({ kind: 'clean', point, wanted: reachable.map((candidate) => candidate.id),
                selected: selected?.id ?? null, selectedAccessDistance: selected ? distance(point, selected) : null });
            }
          }
        }
      }
      // A minimal seated-order fixture exercises actual Station.canAccept.
      for (const table of w.tables) {
        table.dishes = 0;
        table.soil = 0;
        table.takeSeat(0);
        table.seatedGuests.push({ needsItem: (item) => item === 'cay', receiveItem: () => false });
      }
      for (const table of w.tables) {
        const center = access(table);
        for (const radius of [0, 0.5, 1, 1.3]) {
          for (let i = 0; i < 24; i++) {
            const angle = i * Math.PI / 12;
            const point = { x: center.x + Math.cos(angle) * radius, z: center.z + Math.sin(angle) * radius };
            if (w.nav.solidBlocked(point.x, point.z, 0.32)) continue;
            count++;
            const reachable = w.tables.filter((candidate) => distance(point, candidate) <= 1.05 &&
              Math.hypot(candidate.x - point.x, candidate.z - point.z) < r + 0.8);
            const selected = w.nearestAccepting(point.x, point.z, r, 'cay', null);
            if (reachable.length && (!selected || distance(point, selected) > 1.05)) {
              violations.push({ kind: 'serve', point, wanted: reachable.map((candidate) => candidate.id),
                selected: selected?.id ?? null, selectedAccessDistance: selected ? distance(point, selected) : null });
            }
          }
        }
      }
      return { count, violations, layout: w.validateLayout() };
    });
    report.scenarios['service-point-selection'] = samples;
    assert.ok(samples.count > 0);
    assert.equal(samples.violations.length, 0, 'out-of-reach table masks an accessible one; first example: ' + JSON.stringify(samples.violations[0]));
    assert.deepEqual(samples.layout, []);
    return samples;
  });

  for (const name of requestedScenarios) assert.ok(knownScenarios.has(name), 'unknown scenario: ' + name);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failedScenario = currentScenario;
  report.failure = error.stack;
  if (currentPage) await currentPage.screenshot({ path: output + '/failure.png' }).catch(() => {});
  process.exitCode = 1;
  console.error(error);
} finally {
  report.finished = new Date().toISOString();
  await writeFile(output + '/results.json', JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  if (server) await server.close();
}
