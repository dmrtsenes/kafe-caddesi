import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

// Compare both implementations in the same live scene, avoiding differences in
// arrivals or boot timing between browser launches. Baseline restores the former
// matrix updates and attaches the same invisible carriers; no assets are changed.
const out = '.devshots/web-performance-2026-09-11';
await mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, root: process.cwd(),
  optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { physicalPhone: false, errors: [], visuals: [], performance: [] };
try {
  const context = await browser.newContext({ viewport: { width: 384, height: 832 },
    deviceScaleFactor: 2.8125, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.addInitScript(() => {
    localStorage.setItem('fincan-sokagi:settings:v2', JSON.stringify({ quality: 'high', qualityAuto: false, fps: 60, muted: true, music: false }));
    let seed = 417;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    let game;
    Object.defineProperty(window, '__fincan', { get: () => game, set: g => {
      game = g; g.persistDisabled = true; g.stop(); g.ui.hideBoot();
    } });
  });
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__fincan, null, { timeout: 90000 });
  await page.evaluate(async () => {
    const g = window.__fincan, w = g.world, s = g.scene3d;
    g.ui.setTutorial(null); g.state.tutorialStep = 99; g.ui.closePanels();
    for (const zone of w.loc.zones) if (!w.zoneUnlocked(zone.id)) w.unlockZone(zone.id);
    Object.assign(g.state.staffCount, { waiter: 2, barista: 2, cashier: 2, busser: 2 });
    w.syncStaff(); g.ui.endCelebrate(); g.player.setPosition(-3, -6); s.snapTo(-3, -6);
    const draw = s.render.bind(s); s.render = () => {};
    for (let i = 0; i < 3600; i++) g.tick(1 / 30);
    s.render = draw;
    const T = await import('/node_modules/three/build/three.module.js');
    const cached = new Map();
    for (const visual of [...w.stationVisuals.values(), ...w.pickupVisuals.values()])
      visual.root.traverse(o => { if (Object.hasOwn(o, 'updateMatrix')) cached.set(o, o.updateMatrix); });
    const stacks = [g.player.stack, ...w.staff.map(a => a.stack), ...w.customers.map(a => a.carryStack)];
    const select = optimized => {
      for (const [object, fn] of cached) object.updateMatrix = optimized ? fn : T.Object3D.prototype.updateMatrix;
      for (const stack of stacks) {
        stack.syncCarrierVisibility();
        if (!optimized) stack.root.add(stack.smallTray, stack.wideTray, stack.cart);
      }
    };
    const pixels = () => {
      const gl = s.renderer.getContext(), data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return data;
    };
    const direct = () => { s.haveCacheView = false; s.render(); };
    const compare = name => {
      // Resolve any pending canopy fade before comparing identical poses.
      select(true); for (let n = 0; n < 8; n++) direct();
      select(false); direct(); const before = pixels(), beforeDraw = { ...s.renderer.info.render };
      const matrices = new Map(); s.scene.traverse(o => matrices.set(o, o.matrixWorld.elements.slice()));
      direct(); const repeat = pixels();
      select(true); direct(); const after = pixels(), afterDraw = { ...s.renderer.info.render };
      let changed = 0, maxDelta = 0, repeatDelta = 0, matrixDelta = 0;
      s.scene.traverse(o => { const previous = matrices.get(o); if (previous)
        for (let i = 0; i < 16; i++) matrixDelta = Math.max(matrixDelta, Math.abs(previous[i] - o.matrixWorld.elements[i])); });
      for (let i = 0; i < before.length; i += 4) {
        let delta = 0;
        for (let c = 0; c < 4; c++) {
          delta = Math.max(delta, Math.abs(before[i + c] - after[i + c]));
          repeatDelta = Math.max(repeatDelta, Math.abs(before[i + c] - repeat[i + c]));
        }
        if (delta) changed++; maxDelta = Math.max(maxDelta, delta);
      }
      return { name, changedPixels: changed, maxDelta, repeatDelta, matrixDelta, beforeDraw, afterDraw };
    };
    window.__webCheck = { T, select, direct, compare, stacks, cached };
  });

  for (const tier of ['high', 'medium', 'low']) {
    const visual = await page.evaluate(tier => {
      const g = window.__fincan, w = g.world, s = g.scene3d, { compare, T } = window.__webCheck;
      g.setQualityTier(tier); const pairs = [], stack = g.player.stack;
      s.snapTo(g.player.x, g.player.z);
      for (const level of [0, 4, 8, 0]) for (const count of [0, 1, 3, 6, 15, 21, 0]) {
        stack.setPresentationStage(level);
        stack.setSlots(Array.from({ length: count }, (_, i) => ['cay', 'latte', 'tost'][i % 3]));
        g.player.char.setCarryCount(count); g.player.char.setCarryMode(count ? (level >= 8 ? 'cart' : 'tray') : 'none');
        for (let n = 0; n < 12; n++) {
          g.player.char.update(1 / 60, 1.5); stack.update(1 / 60, .5, 1.5);
          stack.fitCartGrip(g.player.char.handMidLocal(new T.Vector3()), g.player.char.handSpanLocal(new T.Vector3()));
        }
        pairs.push(compare('carry-' + level + '-' + count));
        if (stack.count !== count) throw new Error('Inventory count changed');
        const connected = [stack.smallTray, stack.wideTray, stack.cart].filter(o => o.parent === stack.root);
        if (connected.length !== (count ? 1 : 0)) throw new Error('Inactive carrier still attached');
      }
      const station = w.stationVisuals.get(w.counters[0].id), pickup = [...w.pickupVisuals.values()][0];
      for (const [name, visual] of [['station', station], ['pickup', pickup]]) {
        s.snapTo(visual.root.position.x, visual.root.position.z + 2);
        visual.setLocked(false); visual.update(1); pairs.push(compare(name + '-settled'));
        visual.playUnlock(.2);
        for (const dt of [.05, .2, .1, 1]) { visual.update(dt); pairs.push(compare(name + '-unlock-' + dt)); }
        visual.setLocked(true); pairs.push(compare(name + '-locked'));
        visual.setLocked(false); visual.update(1);
      }
      for (const count of [6, 0, 3]) { pickup.setContents(Array(count).fill('cay'), 8); pairs.push(compare('stock-' + count)); }
      pickup.pop(); pickup.update(.1); pairs.push(compare('pickup-pop')); pickup.update(1);
      s.snapTo(g.player.x, g.player.z);
      const r = s.renderer;
      return { tier, pairs, pixels: r.domElement.width * r.domElement.height,
        shadows: r.shadowMap.enabled, glError: r.getContext().getError(), layout: w.validateLayout() };
    }, tier);
    report.visuals.push(visual);
    assert.equal(visual.glError, 0);
    if (!process.argv.includes('--skip-layout')) assert.deepEqual(visual.layout, []);
    for (const pair of visual.pairs) {
      assert.equal(pair.matrixDelta, 0, tier + '/' + pair.name + '/transforms');
      assert.ok(pair.maxDelta <= Math.max(1, pair.repeatDelta), tier + '/' + pair.name);
      assert.ok(pair.changedPixels <= visual.pixels * .00001, tier + '/' + pair.name);
      assert.equal(pair.beforeDraw.calls, pair.afterDraw.calls);
      assert.equal(pair.beforeDraw.triangles, pair.afterDraw.triangles);
    }
    console.log(JSON.stringify({ tier, checkedPairs: visual.pairs.length,
      pixelIdenticalPairs: visual.pairs.filter(p => !p.changedPixels).length, pixels: visual.pixels }));
  }

  const cdp = await context.newCDPSession(page);
  for (const cpuSlowdown of [1, 4]) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuSlowdown });
    const result = await page.evaluate(() => {
      const g = window.__fincan, s = g.scene3d, { select, direct, T } = window.__webCheck;
      g.setQualityTier('high'); s.snapTo(-3, -6); g.player.stack.clear();
      for (let n = 0; n < 30; n++) { select(n % 2 === 0); direct(); }
      const base = s.camera.position.clone(), samples = { before: [], after: [] };
      for (let frame = 0; frame < 240; frame++) {
        s.camera.position.x = base.x + Math.sin(frame / 45) * .5;
        for (const optimized of frame % 2 ? [true, false] : [false, true]) {
          select(optimized);
          const start = performance.now(); direct();
          samples[optimized ? 'after' : 'before'].push(performance.now() - start);
        }
      }
      const work = {};
      for (const optimized of [false, true]) {
        select(optimized); direct(); let multiplies = 0, visits = 0;
        const oldMultiply = T.Matrix4.prototype.multiplyMatrices, oldWorld = T.Object3D.prototype.updateMatrixWorld;
        T.Matrix4.prototype.multiplyMatrices = function (...args) { multiplies++; return oldMultiply.apply(this, args); };
        T.Object3D.prototype.updateMatrixWorld = function (...args) { visits++; return oldWorld.apply(this, args); };
        try { direct(); } finally { T.Matrix4.prototype.multiplyMatrices = oldMultiply; T.Object3D.prototype.updateMatrixWorld = oldWorld; }
        work[optimized ? 'after' : 'before'] = { multiplies, visits };
      }
      select(true);
      const stats = values => { values.sort((a, b) => a - b); return { medianMs: values[120], p90Ms: values[216], meanMs: values.reduce((a, b) => a + b, 0) / values.length }; };
      const gl = s.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
      return { before: stats(samples.before), after: stats(samples.after), work,
        customers: g.world.customers.length, staff: g.world.staff.length,
        pixels: s.renderer.domElement.width * s.renderer.domElement.height,
        gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null, glError: gl.getError() };
    });
    report.performance.push({ cpuSlowdown, ...result });
    assert.ok(result.work.after.multiplies < result.work.before.multiplies);
    assert.ok(result.work.after.visits < result.work.before.visits);
    assert.equal(result.glError, 0);
    console.log(JSON.stringify({ cpuSlowdown, ...result }));
  }
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(out + '/result.json', JSON.stringify(report, null, 2));
  await browser.close(); await server.close();
}
