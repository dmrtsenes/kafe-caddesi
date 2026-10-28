import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

// CPU profile of one zone unlock (sync part + the frames after it), throttled.
// Usage: node tools/unlock-profile.mjs [--zone=t1] [--tier=low] [--throttle=4] [--settle=5000]
const args = Object.fromEntries(process.argv.slice(2).map(s => s.replace(/^--/, '').split('=')));
const zone = args.zone ?? 't1', tier = args.tier ?? 'low', throttle = Number(args.throttle ?? 4);
const out = `.devshots/unlock-profile/${args.phase ?? 'check'}`;
await mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, root: process.cwd(), optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
    storageState: { cookies: [], origins: [] },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
  const page = await context.newPage();
  await page.addInitScript(tier => {
    localStorage.setItem('fincan-sokagi:settings:v2', JSON.stringify({ quality: tier, qualityAuto: false, fps: 60, muted: true, music: false }));
    let seed = 417; Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    let game; Object.defineProperty(window, '__fincan', { configurable: true, get: () => game, set: g => { game = g; g.persistDisabled = true; } });
  }, tier);
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__fincan, null, { timeout: 120000 });
  await page.locator('#boot-screen').waitFor({ state: 'detached', timeout: 120000 });
  await page.waitForTimeout(Number(args.settle ?? 5000));
  const warm = await page.evaluate(() => window.__fincan.scene3d.hiddenWarmRunning);
  const findSided = () => page.evaluate(() => {
    const g = window.__fincan, r = g.scene3d.renderer, found = new Map();
    g.scene3d.scene.traverse(o => {
      for (const m of [o.material].flat()) {
        if (!m || !m.isMeshStandardMaterial || m.side === 0 || (m.side === 2 && (!m.transparent || m.forceSinglePass))) continue;
        const path = []; for (let p = o, i = 0; p && i < 5; i++, p = p.parent) path.push(p.name || p.type);
        const e = found.get(m) ?? { type: m.type, name: m.name, side: m.side, transparent: m.transparent, programs: r.properties.get(m).programs?.size ?? 0, users: [] };
        if (e.users.length < 3) e.users.push(`${o.isInstancedMesh ? 'Inst' : o.type}:${path.join('<')} vis=${o.visible}`);
        found.set(m, e);
      }
    });
    return [...found.values()];
  });
  if (args.findDouble) console.log('BEFORE', JSON.stringify(await findSided(), null, 1));
  await page.evaluate(zone => {
    const g = window.__fincan, w = g.world;
    g.stop(); g.ui.setTutorial(null); g.state.tutorialStep = 99; g.ui.closePanels();
    const draw = g.scene3d.render.bind(g.scene3d); g.scene3d.render = () => {};
    for (let i = 0; i < 300; i++) g.tick(1 / 30);
    g.scene3d.render = draw;
    for (const z of w.loc.zones) { if (z.id === zone) break; if (!w.zoneUnlocked(z.id)) w.unlockZone(z.id); }
    const z = w.loc.zones.find(z => z.id === zone);
    g.player.setPosition(z.padX, z.padZ); g.scene3d.snapTo(z.padX, z.padZ);
    for (let i = 0; i < 30; i++) g.tick(1 / 60);
  }, zone);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start');
  const timing = await page.evaluate(async zone => {
    // No material hooks: three keys programs on onBeforeCompile.toString(),
    // so patching it would itself create new programs.
    const g = window.__fincan, w = g.world, info = g.scene3d.renderer.info;
    const keys0 = new Set(info.programs.map(p => p.cacheKey)), t0 = performance.now();
    w.unlockZone(zone, 'pad');
    const t1 = performance.now(), frames = [];
    for (let i = 0; i < 8; i++) { const t = performance.now(); g.tick(1 / 60); frames.push(+(performance.now() - t).toFixed(1)); }
    const old = [...keys0].map(k => k.split(','));
    const created = info.programs.filter(p => !keys0.has(p.cacheKey)).map(p => {
      const parts = p.cacheKey.split(',');
      let best = null, bestDiff = Infinity;
      for (const o of old) {
        if (o.length !== parts.length) continue;
        let d = 0; for (let i = 0; i < parts.length; i++) if (o[i] !== parts[i]) d++;
        if (d < bestDiff) { bestDiff = d; best = o; }
      }
      const diff = best ? parts.map((v, i) => v !== best[i] ? `#${i}/${parts.length}:${best[i]}→${v}` : null).filter(Boolean).join(' ') : 'no-match';
      return `${p.name} [${diff}] key=${p.cacheKey.slice(0, 40)}…${p.cacheKey.slice(-60)}`;
    });
    return { unlockMs: +(t1 - t0).toFixed(1), frames, programsBefore: keys0.size, programs: info.programs.length, created };
  }, zone);
  const { profile } = await cdp.send('Profiler.stop');
  if (args.findDouble) console.log('AFTER', JSON.stringify(await findSided(), null, 1));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await writeFile(`${out}/${zone}-${tier}.cpuprofile`, JSON.stringify(profile));
  const nodes = new Map(profile.nodes.map(n => [n.id, n])), self = new Map(), parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const label = n => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-2).join('/')}:${n.callFrame.lineNumber + 1}`;
  const total = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i], dt = (profile.timeDeltas[i] ?? 0) / 1000, n = nodes.get(id);
    self.set(label(n), (self.get(label(n)) ?? 0) + dt);
    const seen = new Set();
    for (let p = id; p !== undefined; p = parent.get(p)) { const k = label(nodes.get(p)); if (seen.has(k)) continue; seen.add(k); total.set(k, (total.get(k) ?? 0) + dt); }
  }
  const top = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, 35).map(([k, v]) => `${v.toFixed(1).padStart(7)} ms  ${k}`);
  console.log(JSON.stringify({ zone, tier, throttle, hiddenWarmStillRunning: warm, ...timing }));
  console.log('--- self ---'); console.log(top(self).join('\n'));
  console.log('--- inclusive ---'); console.log(top(total).filter(l => !/\(root\)|\(program\)|\(anon\) :/.test(l)).join('\n'));
} finally { await browser.close(); await server.close(); }
