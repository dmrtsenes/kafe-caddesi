import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const minutes = Number(args.minutes ?? 30);
if (!(minutes >= 1 && minutes <= 720)) throw new Error('minutes must be 1..720');
const output = args.output ?? '.devshots/acceptance-1.2.0';
await mkdir(output, { recursive: true });
let server;
let url = args.url;
if (!url) {
  server = await createServer({ configFile: false, root: process.cwd(), optimizeDeps: { noDiscovery: true }, server: { host: '127.0.0.1', port: 5192, strictPort: true, open: false } });
  await server.listen();
  url = 'http://127.0.0.1:5192/';
}
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const results = [];
try {
  for (const lang of (args.lang ?? 'tr,en').split(',')) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      locale: lang === 'tr' ? 'tr-TR' : 'en-US',
    });
    const page = await context.newPage();
    const errors = [];
    const unexpectedUploads = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (r.method() === 'POST' && !r.url().startsWith(url)) unexpectedUploads.push(r.url());
    });
    await page.addInitScript(
      ({ lang, seed }) => {
        if (!localStorage.getItem('fincan-sokagi:language:v1'))
          localStorage.setItem('fincan-sokagi:language:v1', lang);
        let state = seed >>> 0;
        Math.random = () => {
          state = (state + 0x6d2b79f5) >>> 0;
          let t = state;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      },
      { lang, seed: Number(args.seed ?? 417) },
    );
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__fincan, {}, { timeout: 60000 });
    await page.locator('#boot-screen').waitFor({ state: 'detached' });
    const initial = await page.evaluate(() => ({
      step: window.__fincan.tutorial.step,
      distance: window.__fincan.tutorial.movedDistance,
      layout: window.__fincan.world.validateLayout(),
      text: document.body.innerText,
      character: window.__fincan.player.char.root.userData.characterPack,
      visibleToasts: document.querySelectorAll('.toast.show').length,
    }));
    assert.equal(initial.step, 0, 'first movement step must wait for input');
    assert.equal(initial.distance, 0);
    assert.equal(initial.visibleToasts, 0);
    if (args.character) assert.equal(initial.character, args.character);
    else assert.ok(initial.character && initial.character !== 'cleanit-apk-local-test', 'default preview must use distributable cast');
    assert.deepEqual(initial.layout, []);
    assert.ok(initial.text.includes(lang === 'tr' ? 'Ekrana bas' : 'drag'));
    await page.screenshot({ path: output + '/' + lang + '-first-screen.png' });
    await page.addScriptTag({ content: await readFile('tools/balance-bot.js', 'utf8') });
    const balance = await page.evaluate(
      ({minutes, policy}) => window.__runBalanceBot({ minutes, policy, sync: true }),
      {minutes, policy: args.policy ?? 'guide'},
    );
    const game = await page.evaluate(() => {
      const g = window.__fincan;
      g.scene3d.render();
      return {
        step: g.tutorial.step,
        goal: g.state.goalIndex,
        metrics: JSON.parse(g.exportDiagnostics()),
        layout: g.world.validateLayout(),
        save: g.exportSave(),
        money: g.state.money,
      };
    });
    await page.screenshot({ path: output + '/' + lang + '-after-play.png' });
    await writeFile(
      output + '/' + lang + '-loop.json',
      JSON.stringify({ initial, balance, game, errors }, null, 2),
    );
    assert.equal(balance.error, undefined, balance.error);
    assert.equal(balance.tutorialComplete, true, 'full tutorial should finish');
    assert.ok(balance.served > 0, 'must serve real orders');
    assert.ok(balance.cleaned > 0, 'must clean a table');
    if (minutes >= 15) {
      assert.ok(balance.goalIndex >= 7, 'first floor-cleaning goal must not starve behind shelf work');
      assert.ok(balance.mopped >= 3, 'floor cleaning must remain part of the playable loop');
      assert.ok(balance.cleaned >= 3, 'dishes must be collected beyond the tutorial');
      assert.ok(balance.tableCleanups >= 3, 'tables must reopen repeatedly after dishes and wiping');
      assert.ok(balance.longestInactivity < 180, 'guided play must not stall for three minutes without service, cleaning, revenue or expansion');
    }
    assert.deepEqual(game.layout, []);
    for (const name of ['first_order', 'first_serve', 'first_cash', 'first_table_clean', 'tutorial_complete'])
      assert.ok(
        game.metrics.events.some((e) => e.name === name),
        'Missing milestone ' + name,
      );
    assert.equal(
      game.metrics.events.some((e) => e.name === 'tutorial_skip'),
      false,
    );
    // Saving/reloading uses a new browser page, not a manually reconstructed state.
    const before = await page.evaluate(() => {
      const g = window.__fincan;
      g.persist();
      return { money: g.state.money, served: g.state.stats.served, step: g.state.tutorialStep };
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__fincan);
    await page.locator('#boot-screen').waitFor({ state: 'detached' });
    const restored = await page.evaluate(() => ({
      money: window.__fincan.state.money,
      served: window.__fincan.state.stats.served,
      step: window.__fincan.state.tutorialStep,
    }));
    assert.ok(Math.abs(restored.money - before.money) <= 0.001, 'save money precision');
    assert.equal(restored.served, before.served);
    assert.equal(restored.step, before.step);
    const panels = {};
    for (const id of [
      'upgrades',
      'staff',
      'locations',
      'goals',
      'settings',
      'decor',
      'prestige',
      'stations',
    ]) {
      await page.evaluate((id) => window.__fincan.ui.openPanel(id), id);
      panels[id] = (await page.locator('.panels').count())
        ? await page.locator('.panels').innerText()
        : await page.evaluate(() => document.body.innerText);
      if (id === 'settings') await page.screenshot({ path: output + '/' + lang + '-settings.png' });
      await page.evaluate(() => window.__fincan.ui.closePanels());
    }
    const allLayouts = await page.evaluate(() => {
      const g = window.__fincan;
      g.stop();
      const layouts = {};
      for (const location of ['kose', 'sahil']) {
        g.state.unlockedLocations.add(location);
        g.switchLocation(location);
        g.stop();
        for (const zone of g.world.loc.zones) if (!g.world.zoneUnlocked(zone.id)) g.world.unlockZone(zone.id);
        layouts[location] = g.world.validateLayout();
      }
      return layouts;
    });
    await writeFile(
      output + '/' + lang + '-inspection.json',
      JSON.stringify({ initial, balance, game, panels, allLayouts, errors }, null, 2),
    );
    for (const [location, problems] of Object.entries(allLayouts))
      assert.deepEqual(problems, [], location + ' fully unlocked layout');
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpectedUploads, [], 'no telemetry upload without opt-in');
    const result = { language: lang, initial, balance, game, restored, panels, allLayouts, errors };
    results.push(result);
    await writeFile(output + '/' + lang + '-result.json', JSON.stringify(result, null, 2));
    console.log(
      JSON.stringify({
        language: lang,
        minutes,
        served: balance.served,
        angry: balance.angry,
        earned: balance.finalEarned,
        cleaned: balance.cleaned,
        mopped: balance.mopped,
        tableCleanups: balance.tableCleanups,
        longestInactivity: balance.longestInactivity,
        goalIndex: balance.goalIndex,
        zones: balance.zoneTimes,
        staff: balance.staffTimes,
        lastTarget: balance.lastTarget,
        position: balance.lastPosition,
        carried: balance.carried,
        customerStates: balance.customerStates,
        milestones: game.metrics.events
          .filter((e) => e.name.startsWith('first_'))
          .map((e) => ({ name: e.name, playSeconds: e.props.play_seconds })),
        allLayouts,
      }),
    );
    await context.close();
  }
  console.log('Acceptance checks passed for ' + results.length + ' languages.');
} finally {
  await browser.close();
  if (server) await server.close();
}
