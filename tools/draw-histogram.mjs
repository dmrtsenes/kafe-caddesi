import { chromium } from 'playwright';
import { createServer } from 'vite';

// Draw calls and triangles per owner at busy camera spots (full cafe, mobile).
// Usage: node tools/draw-histogram.mjs [--tier=medium]
const args = Object.fromEntries(process.argv.slice(2).map(s => s.replace(/^--/, '').split('=')));
const tier = args.tier ?? 'medium';
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
  const result = await page.evaluate(() => {
    const g = window.__fincan, w = g.world, s = g.scene3d;
    g.stop(); g.ui.setTutorial(null); g.state.tutorialStep = 99; g.ui.closePanels();
    for (const z of w.loc.zones) if (!w.zoneUnlocked(z.id)) w.unlockZone(z.id);
    Object.assign(g.state.staffCount, { waiter: 2, barista: 2, cashier: 2, busser: 2 }); w.syncStaff(); g.ui.endCelebrate?.();
    const draw = s.render.bind(s); s.render = () => {};
    for (let i = 0; i < 3600; i++) g.tick(1 / 30);
    s.render = draw;
    const owner = o => {
      const names = [];
      for (let p = o; p; p = p.parent) {
        if (p.userData?.profile) return p.userData.profile;
        names.push(p.name);
      }
      const n = names.find(n => /^(station_|pickup_|zonePad_|decor_|env_|premium|vfx|spills|garden|side|guide|cafePack|staffHirePad|roomEntrance|table)/.test(n));
      return n ?? names.find(Boolean) ?? o.type;
    };
    for (const a of w.customers) a.char.root.userData.profile = 'customer';
    for (const a of w.staff) a.char.root.userData.profile = 'staff';
    g.player.char.root.userData.profile = 'player';
    const out = {};
    for (const [name, x, z] of [['avlu', 0, 13.6], ['giris', 0, 18.6], ['salon', 0, 4.4], ['kasa', 3, -6.2], ['vip', -13, 13.7]]) {
      g.player.setPosition(x, z); s.snapTo(x, z); w.focusX = x; w.focusZ = z;
      for (let i = 0; i < 20; i++) g.tick(1 / 60);
      const hist = {}, restore = [];
      s.scene.traverse(o => {
        if (!o.isMesh && !o.isSprite) return;
        const old = o.onBeforeRender;
        restore.push(() => { o.onBeforeRender = old; });
        o.onBeforeRender = function (...a) {
          old.apply(this, a);
          const k = owner(o), e = hist[k] ??= { calls: 0, tris: 0, transparent: 0 };
          e.calls++; if ([o.material].flat()[0]?.transparent) e.transparent++;
          e.tris += o.geometry ? ((o.geometry.index?.count ?? o.geometry.attributes.position?.count ?? 0) / 3) * (o.isInstancedMesh ? o.count : 1) : 2;
        };
      });
      s.camera.position.x += 0.001; s.render();
      restore.forEach(f => f());
      out[name] = { total: s.renderer.info.render.calls, top: Object.entries(hist).sort((a, b) => b[1].calls - a[1].calls).slice(0, 18).map(([k, v]) => `${String(v.calls).padStart(3)} calls ${String(Math.round(v.tris)).padStart(6)} tris ${v.transparent}T  ${k}`) };
    }
    return out;
  });
  for (const [name, r] of Object.entries(result)) { console.log(`== ${name} (${r.total} calls) ==`); console.log(r.top.join('\n')); }
} finally { await browser.close(); await server.close(); }
