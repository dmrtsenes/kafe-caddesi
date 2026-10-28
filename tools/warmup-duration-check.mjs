import { chromium } from 'playwright';
import { createServer } from 'vite';

// How long the idle hidden-content warm-up takes while the real game loop runs
// on a throttled CPU, and the worst frame interval during it.
// Usage: node tools/warmup-duration-check.mjs [--tier=low] [--throttle=4]
const args = Object.fromEntries(process.argv.slice(2).map(s => s.replace(/^--/, '').split('=')));
const tier = args.tier ?? 'low', throttle = Number(args.throttle ?? 4);
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
    let game; Object.defineProperty(window, '__fincan', { configurable: true, get: () => game, set: g => { game = g; g.persistDisabled = true; } });
    const stamps = window.__frameStamps = [];
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => raf(t => { stamps.push(t); cb(t); });
  }, tier);
  const cdp = await context.newCDPSession(page);
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__fincan, null, { timeout: 120000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const started = Date.now();
  await page.waitForFunction(() => window.__fincan && !window.__fincan.scene3d.hiddenWarmRunning && performance.now() > 3000, null, { timeout: 600000, polling: 250 });
  const elapsed = Date.now() - started;
  const r = await page.evaluate(() => {
    const s = window.__frameStamps, iv = s.slice(1).map((t, i) => t - s[i]).filter(v => v < 1000).sort((a, b) => a - b);
    return { frames: s.length, p50: +iv[iv.length >> 1].toFixed(1), p95: +iv[Math.floor(iv.length * .95)].toFixed(1), max: +iv[iv.length - 1].toFixed(1), programs: window.__fincan.scene3d.renderer.info.programs.length };
  });
  console.log(JSON.stringify({ tier, throttle, warmupDoneAfterMs: elapsed, ...r }));
} finally { await browser.close(); await server.close(); }
