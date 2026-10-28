import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server = await createServer({ configFile: false, root: process.cwd(), optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 5249, strictPort: true, open: false, hmr: false, watch: null } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5249/');
  await page.waitForFunction(() => !!window.__fincan, undefined, { timeout: 90000 });
  await page.locator('#boot-screen').waitFor({ state: 'detached', timeout: 90000 });
  const report = await page.evaluate(async () => {
    const game = window.__fincan; game.stop(); game.persistDisabled = true; game.ui.setTutorial(null); game.ui.closePanels();
    const { World } = await import('/src/sim/World.ts'), { GameState } = await import('/src/sim/GameState.ts');
    const { BALANCE } = await import('/src/data/balance.ts');
    const yaw = BALANCE.camera.yaw * Math.PI / 180, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const results = [], failures = [];
    const p = game.player;
    for (const id of ['kose', 'sahil']) {
      const w = new World(id, new GameState(), null, false);
      for (const z of w.loc.zones) if (!w.zoneUnlocked(z.id)) w.unlockZone(z.id);
      for (const level of [0, 1, 2]) {
        for (const t of w.tables) t.capLevel = Math.min(level, t.capMax);
        w.rebuildNav();
        for (const t of w.tables) for (let seat = 0; seat < t.seats; seat++) {
          const approach = { x: 0, z: 0 }, center = { x: 0, y: 0, z: 0 };
          w.seatPoint(t, seat, center);
          const key = `${id}/${t.id}/${level}/${seat}`;
          if (!w.seatApproach(t, seat, approach)) { failures.push({ key, reason: 'approach' }); continue; }
          for (const hz of [15, 30, 60]) {
            p.setPosition(approach.x, approach.z); p.vx = 0; p.vz = 0; p.speed = 8.5;
            const dx = center.x - p.x, dz = center.z - p.z, d = Math.hypot(dx, dz);
            const input = { x: (cy * dx - sy * dz) / d, y: (-sy * dx - cy * dz) / d, mag: 1, active: true };
            for (let frame = 0; frame < hz; frame++) {
              p.update(1 / hz, input, w.nav, w.loc.bounds);
              if (w.nav.solidBlocked(p.x, p.z, .32)) { failures.push({ key, hz, reason: 'player penetrated' }); break; }
            }
            if (Math.hypot(p.x - center.x, p.z - center.z) < .66) failures.push({ key, hz, reason: 'player inside chair' });
          }
          const c = w.spawnCustomer('normal');
          w.releaseCustomerHolds(c); c.setPosition(w.loc.playerStart.x, w.loc.playerStart.z);
          c.table = t; c.seatIndex = seat; c.state = 'toTable'; c.decisionTimer = 0; c.needsToilet = false;
          c.patience = 1000; c.speed = 5; t.takeSeat(seat);
          c.moveTo(w.nav, approach.x, approach.z, true);
          let frame = 0;
          for (; frame < 1800 && c.state !== 'seated'; frame++) {
            w.updateCustomer(c, 1 / 30, null); c.step(1 / 30, w.nav, false);
            if (c.state !== 'seated' && w.nav.solidBlocked(c.x, c.z, .3)) failures.push({ key, reason: 'walking customer penetrated' });
          }
          const seated = c.state === 'seated';
          if (!seated) failures.push({ key, reason: 'never sat', x: c.x, z: c.z });
          if (seated) {
            for (let k = 0; k < 12; k++) c.step(1 / 30, w.nav, false);
            if (Math.hypot(c.x - center.x, c.z - center.z) > .001) failures.push({ key, reason: 'seat alignment' });
            w.leaveTable(c);
            for (let k = 0; k < 12; k++) c.step(1 / 30, w.nav, false);
            if (c.standingUp || w.nav.solidBlocked(c.x, c.z, .3)) failures.push({ key, reason: 'stand-up exit' });
          }
          results.push({ key, seated, walkSeconds: +(frame / 30).toFixed(2) });
          w.releaseCustomerHolds(c); c.dispose(); w.customers.splice(w.customers.indexOf(c), 1);
          t.dishes = 0; t.soil = 0; t.seatedGuests.length = 0; t.seatTaken.fill(false);
        }
      }
      w.dispose();
    }
    const w = game.world, t = w.tables.find(t => !t.locked), center = { x: 0, y: 0, z: 0 }, a = { x: 0, z: 0 };
    w.seatPoint(t, 0, center); w.seatApproach(t, 0, a); p.setPosition(a.x, a.z); p.speed = 3.8;
    const dx = center.x - a.x, dz = center.z - a.z, d = Math.hypot(dx, dz);
    p.vx = 0; p.vz = 0;
    for (let k = 0; k < 60; k++) p.update(1 / 60, { x: dx / d, y: -dz / d, mag: 1, active: true }, w.nav, w.loc.bounds);
    game.scene3d.setOpeningFrame(false); game.scene3d.snapTo(t.x, t.z);
    for (let k = 0; k < 60; k++) game.stepVisual(1 / 60);
    game.scene3d.invalidateStatic(); game.scene3d.invalidateShadows(); game.scene3d.render();
    return { results, failures };
  });
  await mkdir('.devshots/chair-check', { recursive: true });
  await page.screenshot({ path: '.devshots/chair-check/chair-contact.png' });
  await writeFile('.devshots/chair-check/report.json', JSON.stringify({ ...report, errors }, null, 2));
  console.log(JSON.stringify({ playerChecks: report.results.length * 3, seatingCycles: report.results.length, failures: report.failures, errors }, null, 2));
  assert.deepEqual(errors, []); assert.equal(report.failures.length, 0, 'chair checks failed; see report.json');
} finally { await browser?.close(); await server.close(); }
