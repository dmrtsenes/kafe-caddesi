import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const output = '.devshots/vacuum-premium/controls';
await mkdir(output, { recursive: true });
const server = await createServer({ cacheDir: output + '/vite-cache', server: { host: '127.0.0.1', port: 5218, strictPort: true, open: false, hmr: false } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => requests.push(r.url()));
  await page.addInitScript(() => {
    localStorage.setItem('fincan-sokagi:language:v1', 'tr');
    localStorage.setItem('fincan-sokagi:settings:v2', JSON.stringify({ muted: true, music: false, quality: 'low', qualityAuto: false }));
  });
  await page.goto('http://127.0.0.1:5218/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => !!window.__fincan, undefined, { timeout: 90000 });
  await page.locator('#boot-screen').waitFor({ state: 'detached', timeout: 30000 });
  const report = await page.evaluate(async () => {
    const g = window.__fincan; g.stop();
    const p = g.player, w = g.world, dock = w.vacuums[0];
    const refresh = () => g.ui.hud.update(0.1, g.getHud());
    g.state.tutorialStep = 0; g.state.stats.orders = 0; refresh();
    const tutorialAvailable = document.querySelector('.vacuum-toggle').classList.contains('hide') && !g.getHud().vacuum.available && !g.toggleVacuum() && !p.hasVacuum;
    g.tutorial.update(.1, w, p);
    const earlyStepPreserved = g.state.tutorialStep === 0;
    g.state.stats.orders = 1;
    g.state.tutorialStep = 99; g.ui.setTutorial(null); g.ui.endCelebrate();
    g.ui.tut.root.style.display = 'none';
    g.ui.closePanels(); p.dropAll(); p.handTimer = 0;
    p.setPosition(1.5, -1.3); w.assistPlayer = p; refresh();
    const distant = Math.hypot(p.x - dock.x, p.z - dock.z);
    const available = g.getHud().vacuum.available;
    const took = g.toggleVacuum() && p.hasVacuum; refresh();
    const earlyReturnVisible = took && !document.querySelector('.vacuum-toggle').classList.contains('hide') && !document.querySelector('.vacuum-toggle').disabled;
    g.toggleVacuum(); refresh();
    p.give('cay'); refresh();
    const fullHandsBlocked = !g.toggleVacuum() && p.slots.join() === 'cay' && document.querySelector('.vacuum-toggle').disabled;
    p.dropAll(); refresh();
    g.setSetting('paused', true); const pausedBlocked = !g.toggleVacuum(); g.setSetting('paused', false);
    g.ui.openPanel('settings'); const modalBlocked = !g.toggleVacuum(); g.ui.closePanels();
    const { THREE: T } = await import('/tools/browser-render.ts');
    const middle = name => p.char.root.getObjectByName(name);
    const skeleton = [];
    p.char.root.traverse(o => { if (/mixamorig(?:Left|Right)Hand/.test(o.name)) skeleton.push({ name: o.name, position: o.position.toArray(), quaternion: o.quaternion.toArray() }); });
    window.__controls = { g, p, w, dock, refresh, T };
    return { tutorialAvailable, earlyReturnVisible, earlyStepPreserved, distant, available, fullHandsBlocked, pausedBlocked, modalBlocked, skeleton };
  });
  for (const k of ['tutorialAvailable', 'earlyReturnVisible', 'earlyStepPreserved', 'available', 'fullHandsBlocked', 'pausedBlocked', 'modalBlocked']) assert.equal(report[k], true, k);
  assert.ok(report.distant > 6);
  await page.locator('.vacuum-toggle').click();
  await page.waitForFunction(() => window.__fincan.audio.ctx?.state === 'running');
  const taken = await page.evaluate(() => {
    const { g, p, w, dock, refresh } = window.__controls;
    const idle = { x: 0, y: 0, mag: 0, active: false };
    for (let i = 0; i < 45; i++) p.update(1 / 30, idle, w.nav, w.loc.bounds);
    w.updateVisuals(0.1); refresh();
    const parked = w.stationVisuals.get(dock.id).root.getObjectByName('parkedSeraVacuum');
    g.scene3d.snapTo(p.x, p.z); g.scene3d.render();
    return { held: p.hasVacuum, output: dock.output, parked: parked.visible, count: p.char.root.children.filter(c => c.name === 'cafeVacuum').length, speed: p.planarSpeed, renderPath: g.scene3d.renderPath };
  });
  assert.deepEqual([taken.held, taken.output, taken.parked, taken.count], [true, 0, false, 1]);
  await page.screenshot({ path: output + '/phone-held.png' });
  report.layouts = [];
  for (const [width, height] of [[320, 740], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const { g, refresh } = window.__controls; g.scene3d.resize(); refresh(); g.scene3d.render();
      const button = document.querySelector('.vacuum-toggle'), b = button.getBoundingClientRect();
      const overlaps = [...document.querySelectorAll('.side-btn, .carry, .hud-stack')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width && r.height && b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top;
      }).map(el => el.className);
      return { width: innerWidth, height: innerHeight, box: b.toJSON(), overflow: document.documentElement.scrollWidth > innerWidth, overlaps };
    });
    assert.ok(layout.box.width >= 44 && layout.box.height >= 44);
    assert.ok(layout.box.x >= 0 && layout.box.right <= width && layout.box.y >= 0 && layout.box.bottom <= height);
    assert.equal(layout.overflow, false); assert.deepEqual(layout.overlaps, []);
    report.layouts.push(layout);
    await page.screenshot({ path: output + '/layout-' + width + '.png' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.vacuum-toggle').click();
  const returned = await page.evaluate(() => {
    const { p, w, dock } = window.__controls;
    return { held: p.hasVacuum, output: dock.output, parked: w.stationVisuals.get(dock.id).root.getObjectByName('parkedSeraVacuum').visible };
  });
  assert.deepEqual(returned, { held: false, output: 1, parked: true });
  report.approaches = await page.evaluate(() => {
    const { g, p, w, dock } = window.__controls;
    const attempts = [];
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const x = dock.x + Math.cos(angle) * 1.35, z = dock.z + Math.sin(angle) * 1.35;
      if (w.nav.solidBlocked(x, z, .32)) continue;
      if (p.hasVacuum) g.toggleVacuum();
      p.dropAll(); p.noTakeFrom = null; p.noDropTo = null; p.handTimer = 0;
      w.armKey = null; w.armT = 0; p.setPosition(x, z); p.planarSpeed = 0;
      for (let frame = 0; frame < 45; frame++) w.updatePlayerInteraction(1 / 30, p);
      const acquired = p.hasVacuum;
      for (let frame = 0; frame < 120; frame++) w.updatePlayerInteraction(1 / 30, p);
      const stable = p.hasVacuum && dock.output === 0;
      if (acquired) g.toggleVacuum();
      for (let frame = 0; frame < 120; frame++) w.updatePlayerInteraction(1 / 30, p);
      attempts.push({ angle, x, z, acquired, stable, returnStable: !p.hasVacuum && dock.output === 1 });
    }
    // Passing at speed is not a pickup, even inside the broad dock radius.
    const first = attempts[0]; p.setPosition(first.x, first.z); p.noTakeFrom = null; p.handTimer = 0;
    w.armKey = null; w.armT = 0; p.planarSpeed = 4;
    for (let frame = 0; frame < 40; frame++) w.updatePlayerInteraction(1 / 30, p);
    if (p.hasVacuum) throw Error('Running past the dock picked up the vacuum');
    p.planarSpeed = 0;
    return attempts;
  });
  assert.ok(report.approaches.length >= 3, 'exercise multiple reachable directions');
  assert.ok(report.approaches.every(a => a.acquired && a.stable && a.returnStable), JSON.stringify(report.approaches));
  report.cycles = await page.evaluate(() => {
    const { g, p, w, dock, refresh } = window.__controls;
    p.dropAll(); p.setPosition(1.5, -1.3);
    const cycles = [];
    for (let i = 0; i < 20; i++) {
      if (!g.toggleVacuum() || !p.hasVacuum || dock.output !== 0) throw Error('Take failed');
      if (!g.toggleVacuum() || p.hasVacuum || dock.output !== 1) throw Error('Return failed');
      cycles.push(p.char.root.children.filter(c => c.name === 'cafeVacuum').length);
    }
    dock.locked = true; refresh(); const lockedBlocked = !g.toggleVacuum() && !g.getHud().vacuum.available; dock.locked = false;
    if (!lockedBlocked) throw Error('Locked tool became available');
    g.toggleVacuum(); refresh();
    return cycles;
  });
  assert.ok(report.cycles.every(n => n === 0));
  assert.ok(!requests.some(url => url.includes('vacuum-cleaner.glb')), 'old vacuum must not download');
  assert.deepEqual(errors, []);
  await writeFile(output + '/results.json', JSON.stringify({ ...report, taken, returned, errors }, null, 2));
  console.log(JSON.stringify({ checks: 'anywhere button, fresh-game access, full hands, pause, panels, dock visibility, multi-direction pickup, no immediate reverse, running pass, 20 exchanges, three viewports', approaches: report.approaches, renderPath: taken.renderPath, errors }));
} finally { await browser?.close(); await server.close(); }
