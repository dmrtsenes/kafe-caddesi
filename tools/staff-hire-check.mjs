import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const output = '.devshots/staff-hire-check';
await mkdir(output, { recursive: true });
const report = { started: new Date().toISOString(), branches: {} };
let server, browser;
try {
  server = await createServer({ server: { host: '127.0.0.1', port: 5210, strictPort: true, open: false, hmr: false } });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  for (const location of ['kose', 'sahil']) {
    const context = await browser.newContext({ viewport: { width: 520, height: 880 }, locale: 'tr-TR' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('fincan-sokagi:language:v1', 'tr'));
    const ready = async () => {
      await page.waitForFunction(() => !!window.__fincan, undefined, { timeout: 60_000 });
      await page.locator('#boot-screen').waitFor({ state: 'detached' });
      await page.evaluate(() => window.__fincan.stop());
    };
    try {
      await page.goto('http://127.0.0.1:5210/', { waitUntil: 'domcontentloaded' });
      await ready();
      const layout = await page.evaluate(async (location) => {
        const g = window.__fincan;
        const { TUTORIAL_STEP_COUNT } = await import('/src/sim/Tutorial.ts');
        g.state.tutorialStep = TUTORIAL_STEP_COUNT; g.state.stats.orders = 1; g.ui.setTutorial(null);
        if (location !== 'kose') {
          g.state.unlockedLocations.add(location); g.state.unlockedZones.add('sahil:p1');
          g.switchLocation(location); g.stop();
        }
        const initial = g.world.validateLayout();
        const stages = [];
        for (const zone of g.world.loc.zones) {
          if (!g.world.zoneUnlocked(zone.id)) g.world.unlockZone(zone.id);
          const issues = g.world.validateLayout();
          if (issues.length) stages.push({ zone: zone.id, issues });
        }
        g.world.updateStaffHirePad(0, null);
        g.ui.endCelebrate();
        return { initial, stages, pads: g.world.loc.staffHirePads,
          visibleRoles: [...g.world.staffHirePads].filter(([, pad]) => pad.root.visible).map(([role]) => role),
          fullyOpen: g.world.validateLayout() };
      }, location);
      report.branches[location] = { layout };
      await writeFile(output + '/results.json', JSON.stringify(report, null, 2));
      assert.deepEqual(layout.initial, [], location + ': initial layout');
      assert.deepEqual(layout.stages, [], location + ': every unlock layout');
      assert.deepEqual(layout.fullyOpen, [], location + ': full layout');
      assert.equal(layout.visibleRoles.length, 4, 'all four roles get individual squares');

      const payment = await page.evaluate(() => {
        const g = window.__fincan, w = g.world, p = g.player;
        const idle = { x: 0, y: 0, mag: 0, active: false };
        const point = w.loc.staffHirePads.cashier;
        g.state.money = 1000;
        p.setPosition(point.x - 1.4, point.z);
        let inside = 0, frames = 0;
        while (p.x < point.x + 1.0 && frames++ < 120) {
          p.update(1 / 30, { x: 1, y: 0, mag: 1, active: true }, w.nav, w.loc.bounds);
          if (Math.abs(p.x - point.x) < 0.59 && Math.abs(p.z - point.z) < 0.59) inside++;
          w.updateStaffHirePad(1 / 30, p);
        }
        const crossing = { inside, endX: p.x, goalX: point.x + 1, paid: g.state.hirePaidFor('cashier'), money: g.state.money };
        p.setPosition(w.loc.playerStart.x, w.loc.playerStart.z);
        for (let i = 0; i < 60; i++) p.update(1 / 30, idle, w.nav, w.loc.bounds);
        w.updateStaffHirePad(1 / 30, p);
        const deposits = {};
        for (const role of Object.keys(w.loc.staffHirePads)) {
          const hirePoint = w.loc.staffHirePads[role];
          g.state.money = 37.125;
          p.setPosition(hirePoint.x, hirePoint.z);
          for (let i = 0; i < 90; i++) {
            p.update(1 / 30, idle, w.nav, w.loc.bounds);
            w.updateStaffHirePad(1 / 30, p);
          }
          deposits[role] = { paid: g.state.hirePaidFor(role), money: g.state.money,
            count: g.state.staffCount[role], total: g.state.hireTotalCostFor(role),
            remaining: g.state.hireCostFor(role), border: w.staffHirePads.get(role).root.userData.progress,
            x: p.x, z: p.z };
        }
        g.persist();
        return { crossing, deposits, activeLocation: g.state.activeLocation };
      });
      report.branches[location].payment = payment;
      assert.ok(payment.crossing.inside > 0, 'actual movement crosses cashier square');
      assert.ok(payment.crossing.endX >= payment.crossing.goalX, 'actual movement leaves square');
      assert.equal(payment.crossing.paid, 0, 'crossing never charges');
      assert.equal(payment.crossing.money, 1000);
      for (const [role, deposit] of Object.entries(payment.deposits)) {
        assert.equal(deposit.paid, 37.125, location + '/' + role + ': partial payment');
        assert.equal(deposit.money, 0);
        assert.equal(deposit.count, 0);
        assert.equal(deposit.remaining, deposit.total - 37.125);
        assert.ok(Math.abs(deposit.border - 37.125 / deposit.total) < 0.000001);
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      await ready();
      const restored = await page.evaluate(() => {
        const g = window.__fincan;
        g.ui.closeOffline();
        return { location: g.state.activeLocation, money: g.state.money,
          deposits: Object.fromEntries(Object.keys(g.world.loc.staffHirePads).map((role) => [role, g.state.hirePaidFor(role)])) };
      });
      assert.equal(restored.location, location);
      assert.equal(restored.money, 0);
      for (const paid of Object.values(restored.deposits)) assert.equal(paid, 37.125);
      const menuBefore = await page.evaluate(() => {
        const g = window.__fincan, w = g.world;
        g.state.money = 1_000_000;
        const point = w.loc.staffHirePads.waiter;
        g.player.setPosition(point.x, point.z); g.player.planarSpeed = 0;
        w.updateStaffHirePad(0, g.player);
        g.ui.openPanel('staff');
        return { money: g.state.money, price: g.state.hireCostFor('waiter'),
          shownPrice: g.getStaff().find((row) => row.id === 'waiter').hireCost };
      });
      assert.equal(menuBefore.shownPrice, menuBefore.price);
      await page.locator('.staff-card').filter({ has: page.locator('.staff-role', { hasText: 'Tezgâhtar' }) }).getByRole('button', { name: /İşe Al/ }).click();
      const menuAfter = await page.evaluate(() => {
        const g = window.__fincan, w = g.world;
        g.ui.closePanels();
        const immediate = { money: g.state.money, count: g.state.staffCount.waiter, paid: g.state.hirePaidFor('waiter') };
        for (let i = 0; i < 240; i++) w.updateStaffHirePad(1 / 30, g.player);
        const standing = { money: g.state.money, count: g.state.staffCount.waiter, paid: g.state.hirePaidFor('waiter') };
        const point = w.loc.staffHirePads.waiter;
        g.player.setPosition(w.loc.playerStart.x, w.loc.playerStart.z); w.updateStaffHirePad(1 / 30, g.player);
        const nextPrice = g.state.hireCostFor('waiter');
        g.state.money = nextPrice + 50;
        g.player.setPosition(point.x, point.z); g.player.planarSpeed = 0;
        for (let i = 0; i < 240; i++) w.updateStaffHirePad(1 / 30, g.player);
        const nextHire = { money: g.state.money, count: g.state.staffCount.waiter, paid: g.state.hirePaidFor('waiter') };
        for (let i = 0; i < 240; i++) w.updateStaffHirePad(1 / 30, g.player);
        return { immediate, standing, nextPrice, nextHire,
          afterExtraHold: { money: g.state.money, count: g.state.staffCount.waiter, paid: g.state.hirePaidFor('waiter') },
          otherDeposits: Object.fromEntries(['cashier','busser','barista'].map((role) => [role, g.state.hirePaidFor(role)])) };
      });
      assert.equal(menuAfter.immediate.money, menuBefore.money - menuBefore.price);
      assert.equal(menuAfter.immediate.count, 1);
      assert.equal(menuAfter.immediate.paid, 0);
      assert.deepEqual(menuAfter.standing, menuAfter.immediate, 'menu purchase must not cascade into another on-pad hire');
      assert.equal(menuAfter.nextHire.count, 2);
      assert.equal(menuAfter.nextHire.paid, 0);
      assert.ok(Math.abs(menuAfter.nextHire.money - 50) < 0.001);
      assert.deepEqual(menuAfter.afterExtraHold, menuAfter.nextHire, 'one hire per deliberate square entry');
      for (const paid of Object.values(menuAfter.otherDeposits)) assert.equal(paid, 37.125);
      report.branches[location] = { ...report.branches[location], restored, menuBefore, menuAfter, errors };
      assert.deepEqual(errors, []);
      for (const role of ['cashier', 'busser', 'barista']) {
        await page.evaluate((role) => {
          const g = window.__fincan, point = g.world.loc.staffHirePads[role];
          g.player.setPosition(point.x, point.z + 2.2);
          for (let i = 0; i < 60; i++) { g.stepVisual(0.1); g.world.updateStaffHirePad(0, null); }
          for (const pad of g.world.staffHirePads.values()) pad.update(0, g.scene3d.camera.quaternion);
          g.ui.endCelebrate(); g.scene3d.render();
        }, role);
        await page.screenshot({ path: output + '/' + location + '-' + role + '.png' });
      }
      await writeFile(output + '/results.json', JSON.stringify(report, null, 2));
      console.log(location + ': passed');
    } catch (error) {
      report.branches[location] = { ...report.branches[location], errors, failure: error.stack };
      await page.screenshot({ path: output + '/' + location + '-failure.png' }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  report.passed = true;
} catch (error) {
  report.passed = false; report.failure = error.stack;
  console.error(error); process.exitCode = 1;
} finally {
  report.finished = new Date().toISOString();
  await writeFile(output + '/results.json', JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  if (server) await server.close();
}
