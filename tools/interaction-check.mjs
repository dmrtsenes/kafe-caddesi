import { chromium } from 'playwright';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  optimizeDeps: { noDiscovery: true },
  define: { 'import.meta.env.VITE_TELEMETRY_URL': JSON.stringify('https://metrics.test/events') },
  server: { host: '127.0.0.1', port: 5193, strictPort: true, open: false, hmr: false, watch: null },
});
await server.listen();
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const result = {};
const bot = await readFile('tools/balance-bot.js', 'utf8');
async function ready(page) {
  await page.waitForFunction(() => !!window.__fincan, {}, { timeout: 60000 });
  await page.locator('#boot-screen').waitFor({ state: 'detached' });
}
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'tr-TR',
  });
  const page = await context.newPage();
  const errors = [],
    uploads = [];
  let failUpload = false;
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://metrics.test/events', async (route) => {
    uploads.push(JSON.parse(route.request().postData()));
    await route.fulfill({ status: failUpload ? 503 : 204 });
  });
  await page.goto('http://127.0.0.1:5193/', { waitUntil: 'domcontentloaded' });
  await ready(page);
  // Real keyboard and touch events pass through the normal input and rendering loop.
  const start = await page.evaluate(() => ({ x: window.__fincan.player.x, z: window.__fincan.player.z }));
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(
    (p) => Math.hypot(window.__fincan.player.x - p.x, window.__fincan.player.z - p.z) > 0.5,
    start,
  );
  await page.keyboard.up('ArrowRight');
  const touchStart = await page.evaluate(() => ({
    x: window.__fincan.player.x,
    z: window.__fincan.player.z,
  }));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 520 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 250, y: 520 }] });
  await page.waitForFunction(
    (p) => Math.hypot(window.__fincan.player.x - p.x, window.__fincan.player.z - p.z) > 0.5,
    touchStart,
  );
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await page.evaluate(() => window.__fincan.input.isTouch), true);
  result.input = 'keyboard and touch moved the player';
  await page.evaluate(() => window.__fincan.stop());
  await page.evaluate(async () => {
    const t = window.__fincan.telemetry;
    t.record('performance', { fps: 30 });
    await t.flush();
  });
  assert.equal(uploads.length, 0);
  failUpload = true;
  await page.evaluate(async () => {
    const g = window.__fincan;
    g.setDiagnosticsSharing(true);
    g.telemetry.record('performance', { fps: 45 });
    await g.telemetry.flush();
  });
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].events.length, 2);
  assert.equal(
    uploads[0].events.some((e) => e.props.fps === 30),
    false,
  );
  failUpload = false;
  await page.evaluate(() => window.__fincan.telemetry.flush());
  assert.equal(uploads.length, 2);
  assert.equal(uploads[0].events[0].id, uploads[1].events[0].id);
  await page.evaluate(() => window.__fincan.telemetry.flush());
  assert.equal(uploads.length, 2);
  await page.evaluate(async () => {
    const g = window.__fincan;
    g.telemetry.record('performance', { fps: 60 });
    g.setDiagnosticsSharing(false);
    await g.telemetry.flush();
  });
  assert.equal(uploads.length, 2);
  result.telemetry = 'opt-in only, retry keeps event ID, no duplicate acknowledgement, revoke stops upload';
  const reward = await page.evaluate(async () => {
    const g = window.__fincan;
    const ads = await import('/src/core/Ads.ts');
    let resolve;
    let calls = 0;
    ads.setAdProvider({
      isReady: () => true,
      show: () => {
        calls++;
        return new Promise((r) => (resolve = r));
      },
    });
    const before = g.state.money;
    const amount = g.cashBoostAmount();
    const one = g.watchAd('cash_boost');
    const two = await g.watchAd('cash_boost');
    resolve(true);
    const first = await one;
    ads.setAdProvider({ isReady: () => true, show: async () => false });
    const cancelled = await g.watchAd('cash_boost');
    return { first, two, cancelled, calls, gain: g.state.money - before, amount };
  });
  assert.equal(reward.first, true);
  assert.equal(reward.two, false);
  assert.equal(reward.cancelled, false);
  assert.equal(reward.calls, 1);
  assert.ok(Math.abs(reward.gain - reward.amount) < 0.0001);
  result.reward = reward;
  const before = await page.evaluate(() => {
    const g = window.__fincan;
    g.setFps(60);
    g.persist();
    return { money: g.state.money, served: g.state.stats.served };
  });
  await page.evaluate(() => {
    void window.__fincan.changeLanguage('en');
  });
  await page.waitForFunction(() => document.documentElement.lang === 'en' && !!window.__fincan);
  await ready(page);
  const language = await page.evaluate(() => ({
    language: window.__fincan.getLanguage(),
    money: window.__fincan.state.money,
    served: window.__fincan.state.stats.served,
    fps: window.__fincan.getSettings().fps,
  }));
  assert.equal(language.language, 'en');
  assert.equal(language.fps, 60);
  assert.ok(Math.abs(language.money - before.money) <= 0.001);
  assert.equal(language.served, before.served);
  result.language = language;
  const clear = await page.evaluate(() => {
    const g = window.__fincan;
    const before = JSON.parse(g.exportDiagnostics());
    g.clearDiagnostics();
    const after = JSON.parse(g.exportDiagnostics());
    return {
      rotated: before.install !== after.install,
      events: after.events.length,
      sharing: g.getDiagnostics().sharing,
    };
  });
  assert.deepEqual(clear, { rotated: true, events: 0, sharing: false });
  result.clear = clear;
  assert.deepEqual(errors, []);
  await context.close();
  // Save real tutorial checkpoints, reload, then finish the service loop.
  for (const step of [2, 5]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:5193/', { waitUntil: 'domcontentloaded' });
    await ready(p);
    await p.addScriptTag({ content: bot });
    await p.evaluate(
      (step) => window.__runBalanceBot({ minutes: 3, sync: true, untilTutorialStep: step }),
      step,
    );
    assert.equal(await p.evaluate(() => window.__fincan.tutorial.step), step);
    await p.evaluate(() => window.__fincan.persist());
    await p.reload({ waitUntil: 'domcontentloaded' });
    await ready(p);
    const resumed = await p.evaluate(() => window.__fincan.tutorial.step);
    await p.addScriptTag({ content: bot });
    const loop = await p.evaluate(() => window.__runBalanceBot({ minutes: 3, sync: true, resume: true }));
    assert.equal(loop.tutorialComplete, true, JSON.stringify({ step, resumed, loop }));
    result['resume' + step] = { resumed, served: loop.served, cleaned: loop.cleaned };
    await ctx.close();
  }
  await mkdir('.devshots/acceptance-1.2.0', { recursive: true });
  await writeFile('.devshots/acceptance-1.2.0/interactions.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  await server.close();
}
