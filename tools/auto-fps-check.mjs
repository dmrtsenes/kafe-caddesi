import { chromium } from 'playwright';
import { createServer } from 'vite';

// Full cafe, automatic FPS, real rAF loop: per-second presented FPS and heat step.
// Usage: node tools/auto-fps-check.mjs [--tier=low] [--throttle=4] [--seconds=30]
const args = Object.fromEntries(process.argv.slice(2).map(s => s.replace(/^--/, '').split('=')));
const tier = args.tier ?? 'low', throttle = Number(args.throttle ?? 4), seconds = Number(args.seconds ?? 30);
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
    localStorage.setItem('fincan-sokagi:settings:v2', JSON.stringify({ quality: tier, qualityAuto: true, fps: 'auto', muted: true, music: false }));
    let game; Object.defineProperty(window, '__fincan', { configurable: true, get: () => game, set: g => { game = g; g.persistDisabled = true; } });
  }, tier);
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__fincan, null, { timeout: 120000 });
  await page.locator('#boot-screen').waitFor({ state: 'detached', timeout: 120000 });
  await page.evaluate(async tier => {
    const g = window.__fincan, w = g.world, s = g.scene3d;
    const q = await import('/src/core/Quality.ts');
    g.stop(); g.ui.setTutorial(null); g.state.tutorialStep = 99; g.ui.closePanels();
    q.setAutoQuality(false); q.applyTier(tier, true); q.resetHeat(); q.setAutoQuality(true); q.applyTier(tier, true);
    for (const z of w.loc.zones) if (!w.zoneUnlocked(z.id)) w.unlockZone(z.id);
    Object.assign(g.state.staffCount, { waiter: 2, barista: 2, cashier: 2, busser: 2 }); w.syncStaff(); g.ui.endCelebrate?.();
    const draw = s.render.bind(s); s.render = () => {};
    for (let i = 0; i < 3600; i++) g.tick(1 / 30);
    s.render = draw;
    const move = g.input.move; g.input.update = () => move; let i = 0;
    setInterval(() => { i++; Object.assign(move, { x: Math.sin(i / 8) * .8, y: Math.cos(i / 11) * .8, mag: .8, active: true }); }, 100);
    g.player.setPosition(0, 6); s.snapTo(0, 6);
    const stamps = window.__stamps = [];
    const orig = s.render.bind(s); s.render = () => { stamps.push(performance.now()); orig(); };
    window.__q = q;
  }, tier);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.evaluate(() => window.__fincan.start());
  const timeline = [];
  for (let sec = 0; sec < seconds; sec++) {
    await page.waitForTimeout(1000);
    timeline.push(await page.evaluate(() => {
      const st = window.__stamps, now = performance.now(), recent = st.filter(t => t > now - 1000);
      let worst = 0; for (let k = 1; k < recent.length; k++) worst = Math.max(worst, recent[k] - recent[k - 1]);
      return `${recent.length}fps/h${window.__q.currentHeat()}/max${Math.round(worst)}`;
    }));
  }
  console.log(JSON.stringify({ tier, throttle, timeline }));
} finally { await browser.close(); await server.close(); }
