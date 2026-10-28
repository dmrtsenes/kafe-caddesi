import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const source = '.devshots/product-quality-2026-09-08/late-before/guide-417.json';
const fixture = JSON.parse(await readFile(source, 'utf8'));
const save = JSON.parse(Buffer.from(fixture.final.save.slice(5), 'base64').toString('utf8'));
const out = '.devshots/main-premium-2026-09-08/realistic-final';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const report = { source, mode: 'earned-save-no-unlocks-no-godmode', errors: [], views: [] };
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
  page.on('pageerror', e => report.errors.push(e.message));
  await page.addInitScript(save => {
    save.t = Date.now();
    localStorage.setItem('fincan-sokagi:save:v8', JSON.stringify(save));
    localStorage.setItem('fincan-sokagi:language:v1', 'tr');
    localStorage.setItem('fincan-sokagi:settings:v2', JSON.stringify({ quality: 'high', qualityAuto: false, muted: true, music: false, fps: 30 }));
    let game;
    Object.defineProperty(window, '__fincan', { configurable: true, get: () => game, set: value => {
      game = value; value.persistDisabled = true;
      const tick = value.tick;
      value.tick = function () { value.tick = tick; tick.call(value, 1 / 30); value.stop(); };
    } });
  }, save);
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__fincan, undefined, { timeout: 90000 });
  await page.locator('#boot-screen').waitFor({ state: 'detached', timeout: 90000 });
  await page.evaluate(() => {
    const g = window.__fincan;
    g.stop(); g.persistDisabled = true; g.ui.closePanels();
    for (let i = 0; i < 600; i++) g.stepSim(1 / 30);
    g.scene3d.setOpeningFrame(false);
  });
  for (const [name, x, z] of [['production', -6.9, -10.45], ['tables', 0, 4.1], ['salon', 12.8, 13.7], ['vip-locked', -7.4, 13.7], ['foyer', 0, 15.7]]) {
    const result = await page.evaluate(async ({ name, x, z }) => {
      const g = window.__fincan, w = g.world;
      const { floorLiftAt } = await import('/src/data/layouts.ts');
      g.player.setPosition(x, z); g.player.floorY = floorLiftAt(w.loc, x, z);
      g.player.char.root.position.y = g.player.floorY; g.stepSim(1 / 30);
      g.scene3d.resize(); g.scene3d.snapTo(x, z); w.highlightNear(x, z, 1.35);
      for (let i = 0; i < 90; i++) { g.stepSim(1 / 60); g.stepVisual(1 / 60); }
      g.updateUiFrame(1); g.scene3d.invalidateStatic(); g.scene3d.invalidateShadows(); g.scene3d.render();
      const decor = [];
      w.env.root.traverse(o => { if (o.name === 'decor_wallart' || o.name === 'decor_neon') decor.push({ name: o.name, x: o.position.x, z: o.position.z }); });
      return { name, layout: w.validateLayout(), hud: g.getHud(), cast: g.player.char.root.userData.characterPack, decor, render: { ...g.scene3d.renderer.info.render } };
    }, { name, x, z });
    assert.deepEqual(result.layout, []);
    assert.equal(result.cast, 'cleanit-apk-local-test');
    assert.ok(result.hud.carryMax < 38, 'normal earned carrying capacity');
    assert.ok(result.hud.goal.index > 0, 'actual progressed goal');
    assert.ok(!result.decor.some(d => d.z > 16), 'unsupported room wall decorations absent');
    assert.ok(result.decor.some(d => d.name === 'decor_neon' && d.z === -17.65), 'supported north kitchen neon preserved');
    report.views.push(result);
    await page.screenshot({ path: `${out}/${name}.png` });
  }
  assert.deepEqual(report.errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ views: report.views.length, capacity: report.views[0].hud.carryMax, goal: report.views[0].hud.goal.title, errors: report.errors }));
} finally { await browser.close(); }
