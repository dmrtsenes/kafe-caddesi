import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

// Per-region frame cost, unlock hitches and long-session growth for every tier.
// Usage: node tools/region-perf-probe.mjs --phase=baseline [--tiers=low,medium,high] [--throttle=4] [--long=36000]
const args = Object.fromEntries(process.argv.slice(2).map(s => s.replace(/^--/, '').split('=')));
const phase = args.phase ?? 'baseline';
const out = `.devshots/region-perf/${phase}`;
const throttle = Number(args.throttle ?? 4);
const longTicks = Number(args.long ?? 36000);
const frames = Number(args.frames ?? 150);
await mkdir(out, { recursive: true });

const REGIONS = [
  ['mutfak', 0, -12.6],
  ['kasa', 3, -6.2],
  ['raflar', -6.4, -5.2],
  ['salon-masalar', 0, 4.4],
  ['kenar-dogu', 8.0, 1.0],
  ['kenar-bati', -8.0, 1.0],
  ['lavabolar', 12.6, -13.2],
  ['yan-bahce-bati', -12.4, -6.0],
  ['yan-avlu-dogu', 12.0, -6.0],
  ['avlu', 0, 13.6],
  ['giris', 0, 18.6],
  ['salon-odasi', 13.1, 13.5],
  ['vip-teras', -13.0, 13.7],
];

const server = args.url ? null : await createServer({ configFile: false, root: process.cwd(),
  optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null } });
if (server) await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--enable-unsafe-swiftshader', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const reports = [];
try {
  for (const tier of (args.tiers ?? 'low,medium,high').split(',')) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.75,
      isMobile: true, hasTouch: true, storageState: { cookies: [], origins: [] },
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(tier => {
      localStorage.setItem('fincan-sokagi:settings:v2', JSON.stringify({ quality: tier, qualityAuto: false, fps: 60, muted: true, music: false }));
      let seed = 417; Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      let game; Object.defineProperty(window, '__fincan', { configurable: true, get: () => game, set: g => { game = g; g.persistDisabled = true; } });
    }, tier);
    await page.goto((args.url ?? server.resolvedUrls.local[0]), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.__fincan, null, { timeout: 120000 });
    await page.locator('#boot-screen').waitFor({ state: 'detached', timeout: 120000 });
    // A player spends seconds in the opening before any purchase; idle work
    // scheduled after boot (hidden-content warm-up) runs in that window.
    await page.waitForTimeout(Number(args.settle ?? 5000));
    const cdp = await context.newCDPSession(page);
    const setThrottle = rate => cdp.send('Emulation.setCPUThrottlingRate', { rate });

    // Shared probe helpers live in the page.
    await page.evaluate(() => {
      const g = window.__fincan, s = g.scene3d;
      g.stop(); g.ui.setTutorial(null); g.state.tutorialStep = 99; g.ui.closePanels();
      const move = g.input.move; g.input.update = () => move;
      const realRender = s.render.bind(s);
      const P = window.__probe = { renderMs: 0, stub: false, move };
      s.render = () => { if (P.stub) return; const t = performance.now(); realRender(); P.renderMs += performance.now() - t; };
      P.heap = () => performance.memory?.usedJSHeapSize ?? 0;
      P.gc = () => { if (window.gc) { window.gc(); window.gc(); } };
      P.warm = (n, dt = 1 / 30) => { P.stub = true; try { for (let i = 0; i < n; i++) g.tick(dt); } finally { P.stub = false; } };
      P.counts = () => {
        const w = g.world; let nodes = 0, visible = 0, meshes = 0;
        s.scene.traverse(o => { nodes++; if (o.isMesh) meshes++; });
        s.scene.traverseVisible(() => visible++);
        return { nodes, visible, meshes, customers: w.customers.length, staff: w.staff.length,
          spills: w.spills?.list?.length ?? w.spills?.count ?? null, mem: { ...s.renderer.info.memory },
          programs: s.renderer.info.programs?.length ?? 0 };
      };
      P.measure = (frames, wander) => {
        const ticks = [], renders = [];
        P.gc(); const heap0 = P.heap();
        for (let i = 0; i < frames; i++) {
          if (wander) Object.assign(move, { x: Math.sin(i / 23) * .7, y: Math.cos(i / 31) * .7, mag: .7, active: true });
          P.renderMs = 0; const t = performance.now(); g.tick(1 / 60); ticks.push(performance.now() - t); renders.push(P.renderMs);
        }
        const heap1 = P.heap();
        Object.assign(move, { x: 0, y: 0, mag: 0, active: false });
        const sims = ticks.map((t, i) => t - renders[i]);
        const st = a => { const b = a.slice().sort((x, y) => x - y); return { mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), p50: +b[b.length >> 1].toFixed(2), p95: +b[Math.floor(b.length * .95)].toFixed(2), max: +b[b.length - 1].toFixed(2) }; };
        const info = s.renderer.info.render;
        return { tick: st(ticks), sim: st(sims), render: st(renders), over16: ticks.filter(t => t > 16.7).length, over33: ticks.filter(t => t > 33.3).length,
          allocKBPerFrame: heap1 >= heap0 ? +((heap1 - heap0) / frames / 1024).toFixed(1) : null, calls: info.calls, triangles: info.triangles, path: s.renderPath };
      };
    });

    // A. Unlock hitches in purchase order with real rendering.
    await setThrottle(throttle);
    const unlocks = await page.evaluate(() => {
      const g = window.__fincan, w = g.world, P = window.__probe, res = [];
      P.warm(300);
      for (const z of w.loc.zones) {
        if (w.zoneUnlocked(z.id)) continue;
        if (z.padX !== undefined) { g.player.setPosition(z.padX, z.padZ); g.scene3d.snapTo(z.padX, z.padZ); }
        for (let i = 0; i < 3; i++) g.tick(1 / 60);
        const t0 = performance.now(); w.unlockZone(z.id, 'pad'); const t1 = performance.now();
        const after = [];
        for (let i = 0; i < 6; i++) { const t = performance.now(); g.tick(1 / 60); after.push(+(performance.now() - t).toFixed(1)); }
        res.push({ zone: z.id, unlockMs: +(t1 - t0).toFixed(1), framesAfter: after, worstAfter: Math.max(...after) });
        g.ui.endCelebrate?.();
        P.warm(60);
      }
      return res;
    });
    await setThrottle(1);

    // B. Full cafe warm-up.
    const warm = await page.evaluate(() => {
      const g = window.__fincan, w = g.world, P = window.__probe;
      Object.assign(g.state.staffCount, { waiter: 2, barista: 2, cashier: 2, busser: 2 }); w.syncStaff(); g.ui.endCelebrate?.();
      g.player.setPosition(0, -6); g.scene3d.snapTo(0, -6);
      const t = performance.now(); P.warm(3600); const ms = performance.now() - t;
      return { warmMsPer120s: Math.round(ms), ...P.counts() };
    });

    // C. Region sweep, throttled CPU.
    await setThrottle(throttle);
    const regions = [];
    for (const [name, x, z] of REGIONS) {
      const r = await page.evaluate(async ({ name, x, z, frames }) => {
        const g = window.__fincan, w = g.world, s = g.scene3d, P = window.__probe;
        const { floorLiftAt } = await import('/src/data/layouts.ts');
        g.player.setPosition(x, z); g.player.floorY = floorLiftAt(w.loc, x, z); g.player.char.root.position.y = g.player.floorY;
        s.snapTo(x, z); w.focusX = x; w.focusZ = z;
        for (let i = 0; i < 20; i++) g.tick(1 / 60);
        const idle = P.measure(Math.round(frames / 2), false);
        const walk = P.measure(frames, true);
        let visChars = 0; for (const a of [...w.customers, ...w.staff]) if (a.char.root.visible) visChars++;
        return { name, idle, walk, visibleCharacters: visChars };
      }, { name, x, z, frames });
      regions.push(r);
      console.log(JSON.stringify({ tier, region: name, walkTick: r.walk.tick, sim: r.walk.sim.mean, render: r.walk.render.mean, over33: r.walk.over33, calls: r.walk.calls, tris: r.walk.triangles, alloc: r.walk.allocKBPerFrame, chars: r.visibleCharacters }));
    }
    await setThrottle(1);

    // D. Long session growth (render every 30th tick).
    const growth = await page.evaluate(longTicks => {
      const g = window.__fincan, P = window.__probe, snaps = [];
      const snap = label => { P.gc(); snaps.push({ label, heapMB: +(P.heap() / 1048576).toFixed(1), ...P.counts(), playTime: Math.round(g.state.playTime) }); };
      snap('start');
      const step = 6000;
      for (let done = 0; done < longTicks; done += step) {
        for (let i = 0; i < step; i++) { P.stub = i % 30 !== 0; g.tick(1 / 30); }
        P.stub = false; snap('t+' + Math.round((done + step) / 30) + 's');
      }
      return snaps;
    }, longTicks);

    // E. Re-measure two busy regions after the long session.
    await setThrottle(throttle);
    const afterLong = [];
    for (const [name, x, z] of REGIONS.filter(r => ['kasa', 'salon-masalar', 'giris'].includes(r[0]))) {
      afterLong.push(await page.evaluate(({ name, x, z, frames }) => {
        const g = window.__fincan, w = g.world, s = g.scene3d, P = window.__probe;
        g.player.setPosition(x, z); s.snapTo(x, z); w.focusX = x; w.focusZ = z;
        for (let i = 0; i < 20; i++) g.tick(1 / 60);
        return { name, walk: P.measure(frames, true) };
      }, { name, x, z, frames }));
    }

    // F. Live loop: real rAF pacing for 12 s while walking.
    const live = await page.evaluate(async () => {
      const g = window.__fincan, s = g.scene3d, P = window.__probe, stamps = [];
      g.player.setPosition(0, 2); s.snapTo(0, 2);
      let i = 0; const timer = setInterval(() => { i++; Object.assign(P.move, { x: Math.sin(i / 8) * .8, y: Math.cos(i / 11) * .8, mag: .8, active: true }); }, 100);
      const orig = s.render; s.render = () => { stamps.push(performance.now()); orig(); };
      g.start();
      await new Promise(r => setTimeout(r, 12000));
      g.stop(); clearInterval(timer); s.render = orig;
      const iv = stamps.slice(1).map((t, k) => t - stamps[k]).sort((a, b) => a - b);
      return { frames: stamps.length, fps: +(stamps.length / 12).toFixed(1), p50: +iv[iv.length >> 1].toFixed(1), p95: +iv[Math.floor(iv.length * .95)].toFixed(1), max: +iv[iv.length - 1].toFixed(1), over50: iv.filter(t => t > 50).length, over100: iv.filter(t => t > 100).length, heat: g.world && (window.__fincan && 0) };
    });
    await setThrottle(1);

    const gpu = await page.evaluate(() => { const gl = window.__fincan.scene3d.renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null; });
    const report = { tier, throttle, gpu, unlocks, warm, regions, growth, afterLong, live, errors };
    reports.push(report);
    console.log(JSON.stringify({ tier, unlockWorst: unlocks.map(u => [u.zone, u.unlockMs, u.worstAfter]), live, growth: growth.map(s => [s.label, s.heapMB, s.nodes, s.mem.geometries, s.mem.textures, s.customers]), errors: errors.slice(0, 5) }));
    await context.close();
  }
  await writeFile(out + '/result.json', JSON.stringify({ reports }, null, 2));
} finally { await browser.close(); await server?.close(); }
