import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

// Which material/object pairs make three.js re-resolve (getProgram) or compile programs during play.
// Usage: node tools/program-churn-probe.mjs [--tier=low] [--frames=600] [--phase=baseline]
const args = Object.fromEntries(process.argv.slice(2).map(s => s.replace(/^--/, '').split('=')));
const tier = args.tier ?? 'low', frames = Number(args.frames ?? 600), phase = args.phase ?? 'baseline';
const out = `.devshots/program-churn/${phase}`;
await mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, root: process.cwd(), optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
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
  const report = await page.evaluate(async frames => {
    const T = await import('/node_modules/three/build/three.module.js');
    const g = window.__fincan, w = g.world, s = g.scene3d;
    g.stop(); g.ui.setTutorial(null); g.state.tutorialStep = 99; g.ui.closePanels();
    const move = g.input.move; g.input.update = () => move;
    const label = o => {
      const parts = []; let p = o;
      for (let i = 0; p && i < 6; i++, p = p.parent) parts.push((p.name || p.type) + (p.userData?.profile ? '[' + p.userData.profile + ']' : ''));
      return parts.join('<');
    };
    const desc = (m, o) => `${m.type}#${m.name || m.uuid.slice(0, 6)} on ${o?.isInstancedMesh ? 'Inst' : o?.isSkinnedMesh ? 'Skin' : o?.type} ${o ? label(o) : ''} vc=${m.vertexColors} col=${o?.geometry?.attributes?.color?.itemSize ?? '-'} ic=${o?.instanceColor ? 1 : 0}`;
    let current = null, frame = 0, recording = false;
    const resolves = new Map(), compiles = [];
    const baseBefore = T.Object3D.prototype.onBeforeRender;
    T.Object3D.prototype.onBeforeRender = function (...a) { current = this; return baseBefore.apply(this, a); };
    const baseKey = T.Material.prototype.customProgramCacheKey;
    const seenVersion = new WeakMap(), renderer = s.renderer;
    const reasonOf = (m, o) => {
      const p = renderer.properties.get(m), r = [];
      if (seenVersion.has(m) && seenVersion.get(m) !== m.version) r.push('version');
      if (o) {
        if (p.instancing !== undefined && p.instancing !== !!o.isInstancedMesh) r.push('instancing');
        if (p.skinning !== undefined && p.skinning !== !!o.isSkinnedMesh) r.push('skinning');
        if (o.isInstancedMesh && p.instancingColor !== undefined && p.instancingColor !== (o.instanceColor !== null)) r.push('instColor');
        const va = m.vertexColors === true && !!o.geometry?.attributes?.color && o.geometry.attributes.color.itemSize === 4;
        if (p.vertexAlphas !== undefined && p.vertexAlphas !== va) r.push('vertexAlphas');
        const tm = m.toneMapped ? renderer.toneMapping : 0;
        if (p.toneMapping !== undefined && p.toneMapping !== tm) r.push('toneMapping');
      }
      if (p.lightsStateVersion !== undefined && p.needsLights) r.push('lights?');
      seenVersion.set(m, m.version);
      return r.join('+') || 'first/other';
    };
    T.Material.prototype.customProgramCacheKey = function () {
      if (recording) { const k = '[' + reasonOf(this, current) + '] ' + desc(this, current); resolves.set(k, (resolves.get(k) ?? 0) + 1); }
      return baseKey.call(this);
    };
    // onBeforeCompile is not patched: three keys programs on its source text,
    // so a hook would itself create programs. New programs are diffed instead.
    const programKeys = new Set();
    for (const z of w.loc.zones) if (!w.zoneUnlocked(z.id)) w.unlockZone(z.id);
    Object.assign(g.state.staffCount, { waiter: 2, barista: 2, cashier: 2, busser: 2 }); w.syncStaff(); g.ui.endCelebrate?.();
    const draw = s.render.bind(s); s.render = () => {}; g.player.setPosition(0, -6); s.snapTo(0, -6);
    for (let i = 0; i < 3600; i++) g.tick(1 / 30);
    s.render = draw;
    const spots = [[3, -6.2], [0, 4.4], [0, 13.6], [0, 18.6], [13.1, 13.5], [-13, 13.7], [-6.4, -5.2], [0, -12.6], [12.6, -13.2], [8, 1], [-8, 1]];
    // one settle pass per spot so first-time uploads are not counted as churn
    for (const [x, z] of spots) { g.player.setPosition(x, z); s.snapTo(x, z); for (let i = 0; i < 4; i++) g.tick(1 / 60); }
    recording = true;
    for (const p of s.renderer.info.programs) programKeys.add(p.cacheKey);
    for (frame = 0; frame < frames; frame++) {
      if (frame % 50 === 0) { const [x, z] = spots[(frame / 50) % spots.length]; g.player.setPosition(x, z); s.snapTo(x, z); }
      Object.assign(move, { x: Math.sin(frame / 23) * .7, y: Math.cos(frame / 31) * .7, mag: .7, active: true });
      g.tick(1 / 60);
      for (const p of s.renderer.info.programs) if (!programKeys.has(p.cacheKey)) { programKeys.add(p.cacheKey); compiles.push({ frame, what: p.name + ' ' + p.cacheKey.slice(0, 60) }); }
    }
    recording = false;
    T.Object3D.prototype.onBeforeRender = baseBefore; T.Material.prototype.customProgramCacheKey = baseKey;
    return { frames, programs: s.renderer.info.programs.length,
      resolves: [...resolves].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, n]) => ({ perFrame: +(n / frames).toFixed(2), k })),
      compiles };
  }, frames);
  await writeFile(`${out}/${tier}.json`, JSON.stringify({ tier, report, errors }, null, 2));
  console.log(JSON.stringify({ tier, programs: report.programs, compiles: report.compiles.length, errors }, null, 0));
  for (const r of report.resolves) console.log(String(r.perFrame).padStart(7), r.k);
  for (const c of report.compiles.slice(0, 40)) console.log('COMPILE f' + c.frame, c.what);
} finally { await browser.close(); await server.close(); }
