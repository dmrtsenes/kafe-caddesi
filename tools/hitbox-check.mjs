import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = '.devshots/hitbox-check';
await mkdir(output, { recursive: true });
const server = await createServer({ configFile: false, root: process.cwd(), optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 5247, strictPort: true, open: false, hmr: false, watch: null } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 1100 }, locale: 'tr-TR' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5247/?testRun=hitboxes', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__fincan, undefined, { timeout: 90000 });
  await page.locator('#boot-screen').waitFor({ state: 'detached', timeout: 90000 });
  await page.evaluate(() => {
    const g = window.__fincan; g.stop(); g.persistDisabled = true;
    g.ui.setTutorial(null); g.ui.closePanels(); g.state.tutorialStep = 99;
  });
  const report = await page.evaluate(async () => {
    const { World } = await import('/src/sim/World.ts');
    const { GameState } = await import('/src/sim/GameState.ts');
    const { Actor } = await import('/src/entities/Actor.ts');
    const { Object3D } = await import('/node_modules/three/build/three.module.js');
    const results = [];
    for (const id of ['kose', 'sahil']) {
      const w = new World(id, new GameState(), null, false), stages = [];
      const inspect = label => {
        const targets = [], failures = [], path = [];
        for (const st of w.stations) {
          if (w.zoneVisibility(st.def.zone) === 'hidden') continue;
          const p = { x: 0, z: 0 }; st.servicePoint(p);
          targets.push({ label: st.id + '/service', ...p });
          if (!st.locked && ['pickup', 'counter', 'toilet'].includes(st.def.kind)) {
            st.frontPoint(p); targets.push({ label: st.id + '/front', ...p });
          }
          if (!st.locked && st.def.kind === 'table') for (let i = 0; i < st.seats; i++) {
            if (!w.seatApproach(st, i, p)) failures.push({ label: st.id + '/seat' + i, reason: 'no chair approach' });
            else targets.push({ label: st.id + '/seat' + i, ...p });
          }
          if (!st.locked && st.def.kind === 'counter') for (let i = 0; i < 6; i++) {
            st.queueSlot(i, p); targets.push({ label: st.id + '/queue' + i, ...p });
          }
        }
        const start = w.loc.playerStart;
        const started = performance.now();
        for (const target of targets) {
          path.length = 0;
          if (!w.nav.findPath(start.x, start.z, target.x, target.z, path) ||
              Math.hypot(path.at(-2) - target.x, path.at(-1) - target.z) > .2) {
            failures.push({ ...target, reason: 'route', end: path.slice(-2) }); continue;
          }
          let x = start.x, z = start.z;
          for (let i = 0; i < path.length; i += 2) {
            const tx = path[i], tz = path[i + 1], steps = Math.ceil(Math.hypot(tx - x, tz - z) / .04);
            for (let k = 1; k <= steps; k++) {
              if (w.nav.solidBlocked(x + (tx - x) * k / steps, z + (tz - z) * k / steps, .34)) {
                failures.push({ ...target, reason: 'blocked segment' }); break;
              }
            }
            x = tx; z = tz;
          }
        }
        return { label, routes: targets.length, routeMs: +(performance.now() - started).toFixed(2),
          failures, layout: w.validateLayout() };
      };
      stages.push(inspect('initial'));
      for (const zone of w.loc.zones) {
        if (w.zoneUnlocked(zone.id)) continue;
        w.unlockZone(zone.id); stages.push(inspect(zone.id));
      }
      for (const level of [1, 2]) {
        for (const st of w.tables) st.capLevel = Math.min(level, st.capMax);
        w.rebuildNav(); stages.push(inspect('chairs-upgrade-' + level));
      }
      // Follow the actual production Actor movement at high speed in the full cafe.
      const arrivals = [], actor = new Actor({ root: new Object3D() }); actor.speed = 8;
      for (const hz of [15, 30, 60]) for (const st of w.stations) {
        const p = { x: 0, z: 0 }; st.servicePoint(p);
        actor.setPosition(w.loc.playerStart.x, w.loc.playerStart.z); actor.moveTo(w.nav, p.x, p.z);
        let frames = 0;
        for (; frames < hz * 30 && !actor.arrived; frames++) actor.advance(1 / hz, w.nav, .12);
        arrivals.push({ station: st.id, hz, arrived: actor.arrived,
          distance: +Math.hypot(actor.x - p.x, actor.z - p.z).toFixed(3), seconds: +(frames / hz).toFixed(2) });
      }
      results.push({ id, stages, arrivals }); w.dispose();
    }
    return { branches: results };
  });
  await page.evaluate(() => {
    const g = window.__fincan;
    for (const zone of g.world.loc.zones) if (!g.world.zoneUnlocked(zone.id)) g.world.unlockZone(zone.id);
    g.player.setPosition(0, 4.4); g.scene3d.setOpeningFrame(false); g.scene3d.snapTo(0, 4.4);
    g.ui.endCelebrate();
    for (let i = 0; i < 90; i++) { g.stepVisual(1 / 60); g.world.updateVisuals(1 / 60); }
    g.scene3d.invalidateStatic(); g.scene3d.invalidateShadows(); g.scene3d.render();
  });
  await page.screenshot({ path: output + '/full-cafe.png' });
  report.errors = errors;
  await writeFile(output + '/report.json', JSON.stringify(report, null, 2));
  const failures = report.branches.flatMap(b => b.stages.flatMap(s => s.failures.map(f => ({ branch: b.id, stage: s.label, ...f }))));
  const stalled = report.branches.flatMap(b => b.arrivals.filter(a => !a.arrived || a.distance > .13).map(a => ({ branch: b.id, ...a })));
  console.log(JSON.stringify({ routes: report.branches.reduce((n, b) => n + b.stages.reduce((sum, s) => sum + s.routes, 0), 0),
    arrivals: report.branches.reduce((n, b) => n + b.arrivals.length, 0),
    failures: [...new Map(failures.map(f => [f.branch + '/' + f.label, f])).values()], stalled, errors }, null, 2));
  assert.deepEqual(errors, []); assert.equal(failures.length, 0, 'route failures; see report.json'); assert.deepEqual(stalled, []);
  for (const b of report.branches) for (const s of b.stages) assert.deepEqual(s.layout, [], b.id + '/' + s.label);
} finally { await browser?.close(); await server.close(); }
