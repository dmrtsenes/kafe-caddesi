import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

// Sampling heap profile of a full cafe: which functions allocate per frame.
// Usage: node tools/alloc-probe.mjs --phase=baseline [--tier=low] [--frames=900]
const args = Object.fromEntries(process.argv.slice(2).map(s => s.replace(/^--/, '').split('=')));
const phase = args.phase ?? 'baseline', tier = args.tier ?? 'low', frames = Number(args.frames ?? 900);
const out = `.devshots/alloc-probe/${phase}`;
await mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, root: process.cwd(), optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--enable-unsafe-swiftshader', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
    storageState: { cookies: [], origins: [] },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(tier => {
    localStorage.setItem('fincan-sokagi:settings:v2', JSON.stringify({ quality: tier, qualityAuto: false, fps: 60, muted: true, music: false }));
    let seed = 417; Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    let game; Object.defineProperty(window, '__fincan', { configurable: true, get: () => game, set: g => { game = g; g.persistDisabled = true; } });
  }, tier);
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__fincan, null, { timeout: 120000 });
  await page.locator('#boot-screen').waitFor({ state: 'detached', timeout: 120000 });
  await page.evaluate(() => {
    const g = window.__fincan, w = g.world, s = g.scene3d;
    g.stop(); g.ui.setTutorial(null); g.state.tutorialStep = 99; g.ui.closePanels();
    for (const z of w.loc.zones) if (!w.zoneUnlocked(z.id)) w.unlockZone(z.id);
    Object.assign(g.state.staffCount, { waiter: 2, barista: 2, cashier: 2, busser: 2 }); w.syncStaff(); g.ui.endCelebrate?.();
    const move = g.input.move; g.input.update = () => move;
    const draw = s.render.bind(s);
    window.__alloc = { move, draw, stub: false };
    s.render = () => { if (!window.__alloc.stub) draw(); };
    g.player.setPosition(0, -6); s.snapTo(0, -6);
    window.__alloc.stub = true; for (let i = 0; i < 3600; i++) g.tick(1 / 30); window.__alloc.stub = false;
  });
  const cdp = await context.newCDPSession(page);
  const result = {};
  for (const mode of ['sim', 'full']) {
    await page.evaluate(mode => { window.__alloc.stub = mode === 'sim'; window.gc?.(); }, mode);
    await cdp.send('HeapProfiler.enable');
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 2048, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    const heap = await page.evaluate(frames => {
      const g = window.__fincan, A = window.__alloc, spots = [[3, -6.2], [0, 4.4], [0, 13.6], [0, 18.6], [13.1, 13.5], [-6.4, -5.2]];
      const h0 = performance.memory.usedJSHeapSize; let gcs = 0, last = h0, total = 0;
      for (let i = 0; i < frames; i++) {
        if (i % 150 === 0) { const [x, z] = spots[(i / 150) % spots.length]; g.player.setPosition(x, z); g.scene3d.snapTo(x, z); }
        Object.assign(A.move, { x: Math.sin(i / 23) * .7, y: Math.cos(i / 31) * .7, mag: .7, active: true });
        g.tick(1 / 60);
        const h = performance.memory.usedJSHeapSize; if (h < last) gcs++; else total += h - last; last = h;
      }
      return { frames, approxKBPerFrame: +(total / frames / 1024).toFixed(1), heapDrops: gcs };
    }, frames);
    const { profile } = await cdp.send('HeapProfiler.stopSampling');
    const byFn = new Map();
    const walk = (node, stack) => {
      const f = node.callFrame, key = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/')}:${f.lineNumber + 1}`;
      if (node.selfSize) byFn.set(key, (byFn.get(key) ?? 0) + node.selfSize);
      for (const c of node.children) walk(c, stack);
    };
    walk(profile.head, []);
    const top = [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 45).map(([k, v]) => ({ fn: k, KBPerFrame: +(v / frames / 1024).toFixed(2) }));
    result[mode] = { heap, top };
    await writeFile(`${out}/${mode}.heapprofile`, JSON.stringify(profile));
  }
  await writeFile(`${out}/result.json`, JSON.stringify({ tier, result, errors }, null, 2));
  console.log(JSON.stringify({ tier, result, errors }, null, 1));
} finally { await browser.close(); await server.close(); }
