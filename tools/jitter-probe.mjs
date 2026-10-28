import { chromium } from 'playwright';
import { createServer } from 'vite';

/**
 * Render-path flapping probe: teleports the player, lets the camera settle and
 * records which static-cache path each presented frame took. A healthy settle
 * is `direct* -> bake -> cached*`; alternating paths mean visible edge/AA pops.
 */
const mobile = process.argv.includes('--mobile');
const tier = (process.argv.find(a => a.startsWith('--tier=')) ?? '--tier=high').slice(7);
const server = await createServer({ configFile: false, root: process.cwd(),
  optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(tier => {
    localStorage.setItem('fincan-sokagi:settings:v2', JSON.stringify({ quality: tier, qualityAuto: false, fps: 60, muted: true, music: false }));
  }, tier);
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__fincan, null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  const report = await page.evaluate(async () => {
    const g = window.__fincan, s = g.scene3d;
    const paths = [], cam = [];
    const render = s.render.bind(s);
    s.render = () => { render(); paths.push(s.lastRenderPath[0]); cam.push(s.camera.position.x); };
    g.persistDisabled = true;
    g.player.x += 5; g.player.z -= 3;
    await new Promise(r => setTimeout(r, 6000));
    s.render = render;
    let flips = 0;
    for (let i = 1; i < paths.length; i++) if (paths[i] !== paths[i - 1]) flips++;
    return {
      mobileDevice: s.mobileDevice, edgeSmoothing: s.edgeSmoothing.enabled,
      frames: paths.length, flips, sequence: paths.join(''),
    };
  });
  console.log(JSON.stringify({ mobile, tier, ...report, errors }, null, 1));
} finally { await browser.close(); await server.close(); }
