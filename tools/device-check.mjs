import { execFileSync } from 'node:child_process';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const args = Object.fromEntries(process.argv.slice(2).map((v) => v.replace(/^--/, '').split('=')));
const adb = args.adb ?? process.env.ANDROID_HOME + '/platform-tools/adb.exe';
const serial = args.serial;
const appId = args.package ?? 'com.fincansokagi.game.preview';
if (!/^[a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*)+$/.test(appId)) throw Error('Invalid package id');
if (!serial) throw Error('Pass the intended device serial with --serial.');
const duration = Number(args.seconds ?? 90);
if (!(duration >= 15 && duration <= 300)) throw Error('seconds must be 15..300 per mode.');
const output = args.output ?? '.devshots/device-1.2.0';
await mkdir(output, { recursive: true });
const run = (...a) => execFileSync(adb, ['-s', serial, ...a], { encoding: 'utf8' }).trim();
let browser, page, port, original;
const errors = [];
const result = {
  package: appId,
  model: run('shell', 'getprop', 'ro.product.model'),
  android: run('shell', 'getprop', 'ro.build.version.release'),
  modes: [],
};
async function attach() {
  const pid = run('shell', 'pidof', appId);
  if (args.port) {
    if (!/^\d+$/.test(args.port) || +args.port < 1024 || +args.port > 65535) throw Error('Invalid local port');
    port = args.port;
    run('forward', 'tcp:' + port, 'localabstract:webview_devtools_remote_' + pid);
  } else {
    port = run('forward', 'tcp:0', 'localabstract:webview_devtools_remote_' + pid);
    if (!/^\d+$/.test(port)) throw Error('This ADB version requires an explicit --port.');
  }
  browser = await chromium.connectOverCDP('http://127.0.0.1:' + port);
  page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().startsWith('https://localhost'));
  if (!page) throw Error('Game WebView not found');
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForFunction(() => !!window.__fincan, {}, { timeout: 60000 });
}
async function detach() {
  if (browser) await browser.close();
  if (port) {
    try { run('forward', '--remove', 'tcp:' + port); }
    catch (error) { if (!String(error.stderr).includes('not found')) throw error; }
  }
  browser = null;
  port = null;
}
const battery = () =>
  run('shell', 'dumpsys', 'battery')
    .split('\n')
    .filter((s) => /^\s*(level|temperature|status):/.test(s))
    .map((s) => s.trim());
try {
  await attach();
  if (args.restore) {
    const recovery = JSON.parse(await readFile(args.restore,'utf8'));
    await Promise.all([
      page.waitForEvent('domcontentloaded'),
      page.evaluate(async recovery => {
        const g=window.__fincan;clearInterval(window.__deviceDriver);
        if(window.__deviceOriginalInput)g.input.update=window.__deviceOriginalInput;
        for(const [key,value] of Object.entries(recovery.settings))
          if(key in g.settings.all)g.settings.set(key,value);
        g.setFps(recovery.settings.fps);
        await g.importSave(recovery.save);
      },recovery),
    ]);
    await page.waitForFunction(()=>!!window.__fincan);
  }
  original = await page.evaluate(() => {
    const g = window.__fincan;
    const s = g.scene3d, gl = s.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    g.ui.closePanels();
    return {
      save: g.exportSave(),
      settings: g.getSettings(),
      language: g.getLanguage(),
      money: g.state.money,
      served: g.state.stats.served,
      presentation: { cast:g.player.char.root.userData.characterPack, framing:s.framing,
        viewport:[innerWidth,innerHeight], pixels:[gl.drawingBufferWidth,gl.drawingBufferHeight],
        dpr:s.renderer.getPixelRatio(), shadows:s.renderer.shadowMap.enabled, environment:!!s.scene.environment,
        antialias:s.edgeSmoothing?.enabled===true, gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null },
    };
  });
  await writeFile(output + '/before.json', JSON.stringify(original, null, 2));
  result.language = original.language;
  result.batteryBefore = battery();
  await page.screenshot({path:output + '/game.png'});
  await page.evaluate(() => {
    const g = window.__fincan;
    window.__deviceOriginalInput = g.input.update.bind(g.input);
    const move = { x: 0, y: 0, mag: 0, active: false };
    g.input.update = () => Object.assign(g.input.move, move);
    let path = [],
      index = 0,
      last = 0,
      tx = NaN,
      tz = NaN;
    window.__deviceDriver = setInterval(() => {
      const target = g.world.guideOverride ?? g.world.guideCache;
      const p = g.player;
      if (!target || Math.hypot(target.x - p.x, target.z - p.z) < 0.55) {
        Object.assign(move, { x: 0, y: 0, mag: 0, active: false });
        return;
      }
      const now = performance.now();
      if (now - last > 1000 || Math.hypot(target.x - tx, target.z - tz) > 0.25 || index >= path.length) {
        tx = target.x;
        tz = target.z;
        last = now;
        g.world.nav.findPath(p.x, p.z, tx, tz, path);
        index = 0;
      }
      while (index < path.length - 2 && Math.hypot(path[index] - p.x, path[index + 1] - p.z) < 0.18)
        index += 2;
      if (!path.length) {
        move.active = false;
        move.mag = 0;
        return;
      }
      const dx = path[index] - p.x,
        dz = path[index + 1] - p.z,
        angle = g.scene3d.camera.rotation.y;
      // Use the same world-to-screen basis as the balance harness.
      const right = g.scene3d.camera.matrixWorld.elements;
      const rx = right[0],
        rz = right[2];
      const len = Math.hypot(dx, dz) || 1;
      const rightLen = Math.hypot(rx, rz) || 1;
      move.x = (dx * rx + dz * rz) / (len * rightLen);
      move.y = (dx * rz - dz * rx) / (len * rightLen);
      move.mag = 1;
      move.active = true;
    }, 80);
  });
  for (const fps of [30, 60]) {
    await page.evaluate((fps) => window.__fincan.setFps(fps), fps);
    const samples = [];
    const start = Date.now();
    while (Date.now() - start < duration * 1000) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      samples.push(
        await page.evaluate(() => {
          const g = window.__fincan;
          return {
            fps: g.measuredFps,
            calls: g.scene3d.renderer.info.render.calls,
            triangles: g.scene3d.renderer.info.render.triangles,
            served: g.state.stats.served,
            quality: g.telemetry.snapshot().quality,
            pixels: g.scene3d.renderer.domElement.width*g.scene3d.renderer.domElement.height,
            shadows: g.scene3d.renderer.shadowMap.enabled,
            antialias: g.scene3d.edgeSmoothing?.enabled===true,
          };
        }),
      );
    }
    const sorted = samples.map((s) => s.fps).sort((a, b) => a - b);
    const summary = {
      selected: fps,
      seconds: Math.round((Date.now() - start) / 1000),
      samples: samples.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p10: sorted[Math.floor(sorted.length * 0.1)],
      min: sorted[0],
      max: sorted.at(-1),
      served: samples.at(-1).served - original.served,
    };
    result.modes.push({ ...summary, raw: samples });
    console.log(JSON.stringify(summary));
  }
  await page.evaluate(() => {
    const g = window.__fincan;
    clearInterval(window.__deviceDriver);
    g.input.update = window.__deviceOriginalInput;
    g.stop();
    g.persist();
  });
  const beforeRestart = await page.evaluate(() => ({
    money: window.__fincan.state.money,
    served: window.__fincan.state.stats.served,
  }));
  await detach();
  run('shell', 'input', 'keyevent', 'KEYCODE_HOME');
  await new Promise((r) => setTimeout(r, 1500));
  run('shell', 'am', 'force-stop', appId);
  run('shell', 'am', 'start', '-n', appId + '/com.fincansokagi.game.MainActivity');
  await new Promise((r) => setTimeout(r, 2500));
  await attach();
  const afterRestart = await page.evaluate(() => ({
    money: window.__fincan.state.money,
    served: window.__fincan.state.stats.served,
  }));
  assert.ok(Math.abs(beforeRestart.money - afterRestart.money) <= 0.001);
  assert.equal(beforeRestart.served, afterRestart.served);
  result.restart = { before: beforeRestart, after: afterRestart };
  result.batteryAfter = battery();
  result.errors = errors;
  assert.deepEqual(errors, []);
  await page.screenshot({path:output + '/after-restart.png'});
} finally {
  if (page && original) {
    try {
      await Promise.all([
        page.waitForEvent('domcontentloaded'),
        page.evaluate(async (original) => {
          const g = window.__fincan;
          clearInterval(window.__deviceDriver);
          if (window.__deviceOriginalInput) g.input.update = window.__deviceOriginalInput;
          g.setFps(original.settings.fps);
          await g.importSave(original.save);
        }, original),
      ]);
      await page.waitForFunction(() => !!window.__fincan);
      result.restored = await page.evaluate(() => ({
        money: window.__fincan.state.money,
        served: window.__fincan.state.stats.served,
        fps: window.__fincan.getSettings().fps,
      }));
    } catch (e) {
      result.restoreError = String(e);
    }
  }
  await writeFile(output + '/result.json', JSON.stringify(result, null, 2));
  await detach();
}
if (result.restoreError) throw Error(result.restoreError);
console.log(JSON.stringify({ ...result, modes: result.modes.map(({ raw, ...m }) => m) }));
