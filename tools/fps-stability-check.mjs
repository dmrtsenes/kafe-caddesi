import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = '.devshots/fps-stability-2026-09-12';
await mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, root: process.cwd(),
  optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    localStorage.setItem('fincan-sokagi:settings:v2', JSON.stringify({ quality: 'high', qualityAuto: true, fps: 'auto', muted: true, music: false }));
    let game; Object.defineProperty(window, '__fincan', { get: () => game, set: value => {
      game = value; game.persistDisabled = true; game.stop(); game.ui.hideBoot();
    } });
  });
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__fincan, null, { timeout: 90000 });
  const report = await page.evaluate(async () => {
    const g = window.__fincan, q = await import('/src/core/Quality.ts');
    const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame, tick = g.tick;
    let callback = null, id = 0, now = performance.now();
    window.requestAnimationFrame = fn => { callback = fn; return ++id; };
    window.cancelAnimationFrame = () => { callback = null; };
    // Exercise the real Game.start loop with a controlled healthy workload.
    // Synthetic display timing is a regression test, not a device FPS benchmark.
    g.tick = () => {};
    const steps = (count, hz = 60) => {
      for (let n = 0; n < count; n++) {
        now += 1000 / hz; const next = callback; callback = null;
        if (!next) throw new Error('Game stopped scheduling frames'); next(now);
      }
      return { fps: g.measuredFps, heat: q.currentHeat(), refresh: g.refreshHz };
    };
    const cycles = [];
    try {
      q.resetHeat(); q.applyTier('high'); g.ui.closePanels(); g.start(); now = performance.now();
      const opening = steps(180);
      for (let n = 0; n < 4; n++) {
        g.ui.openPanel('settings'); const menu = steps(120);
        g.ui.closePanels(); const returned = steps(60), settled = steps(540);
        cycles.push({ menu, returned, settled });
      }
      g.setFps(30); const selected30 = steps(180);
      g.setFps(60); const selected60 = steps(180);
      g.stop(); g.start(); now = performance.now(); const resumed = steps(180);
      q.setNativeThermalStatus(3); const severe = steps(180);
      return { syntheticTiming: true, opening, cycles, selected30, selected60, resumed, severe };
    } finally {
      g.stop(); g.tick = tick; window.requestAnimationFrame = request; window.cancelAnimationFrame = cancel; q.resetHeat();
    }
  });
  await writeFile(out + '/result.json', JSON.stringify({ ...report, errors }, null, 2));
  assert.deepEqual(errors, []);
  for (const state of [report.opening, report.selected60, report.resumed, ...report.cycles.map(c => c.settled)]) {
    assert.equal(state.heat, 0); assert.ok(state.fps > 58 && state.fps < 61, JSON.stringify(state));
  }
  for (const cycle of report.cycles) { assert.equal(cycle.menu.heat, 0); assert.equal(cycle.returned.heat, 0); }
  assert.ok(Math.abs(report.selected30.fps - 30) < 1);
  assert.equal(report.severe.heat, 3); assert.ok(Math.abs(report.severe.fps - 30) < 1);
  console.log(JSON.stringify(report));
} finally { await browser.close(); await server.close(); }
