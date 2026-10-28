import { chromium } from "playwright";
import { createServer } from "vite";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const output = ".devshots/render-check";
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  optimizeDeps: { noDiscovery: true },
  server: { host: "127.0.0.1", port: 5195, strictPort: true, open: false, hmr: false, watch: null },
});
await server.listen();
console.log("Local render checks starting.");
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
    if (m.type() === "warning") console.log("WARNING: " + m.text());
  });
  let save;
  try {
    save = Buffer.from(
      JSON.parse(
        await readFile(".devshots/device-1.2.0/before.json", "utf8"),
      ).save.slice(5),
      "base64",
    ).toString("utf8");
  } catch {}
  await page.addInitScript(
    ({ save }) => {
      if (save) localStorage.setItem("fincan-sokagi:save:v8", save);
      localStorage.setItem(
        "fincan-sokagi:settings:v2",
        JSON.stringify({
          quality: "low",
          qualityAuto: false,
          music: false,
          muted: true,
          fps: 30,
        }),
      );
    },
    { save },
  );
  await page.goto("http://127.0.0.1:5195/?characters=quaternius", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForFunction(
    () => !!window.__fincan,
    {},
    { timeout: 60000, polling: 100 },
  );
  await page
    .locator("#boot-screen")
    .waitFor({ state: "detached", timeout: 30000 });
  console.log("Game ready; comparing cached and direct color/depth.");
  const result = await page.evaluate(async () => {
    const g = window.__fincan;
    g.stop();
    const { THREE: T, StaticSceneCache, createStaticBatch } = await import(
      "/tools/browser-render.ts"
    );
    function pixels(r) {
      const gl = r.getContext();
      const out = new Uint8Array(
        gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
      );
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        out,
      );
      return out;
    }
    function compare(a, b) {
      let max = 0,
        sum = 0,
        bad = 0;
      for (let i = 0; i < a.length; i += 4) {
        let delta = 0;
        for (let c = 0; c < 3; c++) {
          const d = Math.abs(a[i + c] - b[i + c]);
          delta = Math.max(delta, d);
          sum += d;
          max = Math.max(max, d);
        }
        if (delta > 4) bad++;
      }
      return {
        max,
        mean: sum / ((a.length / 4) * 3),
        differentFraction: bad / (a.length / 4),
      };
    }
    const r = new T.WebGLRenderer({ antialias: false });
    r.setSize(128, 128);
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.NeutralToneMapping;
    r.toneMappingExposure = 1.1;
    const scene = new T.Scene();
    scene.background = new T.Color("#87b9db");
    const cam = new T.PerspectiveCamera(50, 1, 0.1, 20);
    cam.position.set(0, 0, 5);
    cam.lookAt(0, 0, 0);
    cam.layers.enableAll();
    const light = new T.DirectionalLight(0xffffff, 2);
    light.position.set(1, 3, 4);
    light.layers.enableAll();
    scene.add(light);
    const ambient = new T.AmbientLight(0xffffff, 0.7);
    ambient.layers.enableAll();
    scene.add(ambient);
    const box = (x, z, color, layer, toneMapped = true) => {
      const m = new T.Mesh(
        new T.BoxGeometry(1.2, 1.2, 0.3),
        new T.MeshStandardMaterial({ color, toneMapped }),
      );
      m.position.set(x, 0, z);
      m.layers.set(layer);
      scene.add(m);
      return m;
    };
    box(0, 0, "#ccaa66", 0);
    const back = box(0, -0.5, "#dd1133", 1);
    box(0.9, 0.5, "#3377ff", 1);
    box(-1, -0.5, "#22ee66", 0, false);
    const cache = new StaticSceneCache(r);
    const fixture = [];
    for (const x of [0, 0.4, -0.4]) {
      back.position.x = x;
      cache.render(scene, cam, false);
      const direct = pixels(r);
      cache.render(scene, cam, true);
      cache.render(scene, cam, true);
      fixture.push(compare(direct, pixels(r)));
    }
    const glError = r.getContext().getError();
    cache.dispose();
    const finishes = new T.Group();
    scene.add(finishes);
    for (let n = 0; n < 6; n++) {
      const mesh = new T.Mesh(new T.SphereGeometry(.33, 16, 12), new T.MeshStandardMaterial({
        color: ['#12493a','#d1aa61','#eddcc6'][n % 3], roughness: .1 + n * .15, metalness: n % 2 ? .85 : 0,
      }));
      mesh.position.set((n % 3 - 1) * .8, n < 3 ? .8 : -.8, .7);
      finishes.add(mesh);
    }
    cam.layers.enableAll(); r.render(scene, cam);
    const mirrored = new T.Mesh(new T.BoxGeometry(.4,.6,.4),new T.MeshStandardMaterial({color:'#275c53',roughness:.4}));
    mirrored.scale.set(-1,1,1);mirrored.position.set(1.2,.8,1);finishes.add(mirrored);
    const instances=new T.InstancedMesh(new T.SphereGeometry(.15,12,8),new T.MeshStandardMaterial({color:0xffffff,roughness:.4}),2);
    instances.setMatrixAt(0,new T.Matrix4().makeTranslation(-1.3,.9,1));instances.setMatrixAt(1,new T.Matrix4().makeTranslation(-1.3,-.9,1));
    instances.setColorAt(0,new T.Color('#dea141'));instances.setColorAt(1,new T.Color('#367960'));finishes.add(instances);
    r.render(scene,cam);
    const sourcePixels = pixels(r);
    const materialBatch = createStaticBatch(finishes, {compact: true, bakeInstances:true});
    materialBatch.setActive(true); r.render(scene, cam);
    const materialParity = compare(sourcePixels, pixels(r));
    materialBatch.dispose();
    scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    r.dispose();
    const s = g.scene3d;
    const draw = s.render.bind(s);
    s.render = () => {};
    for (let n = 0; n < 900; n++) g.tick(1 / 30);
    s.render = draw;
    s.snapTo(0, -2);
    g.world.setViewFromCamera(s.camera);
    g.world.updateVisuals(0);
    const gamePairs = [];
    for (const [x, z] of [
      [0, -2],
      [-6, -6],
      [6, 2],
    ]) {
      s.snapTo(x, z);
      g.world.setViewFromCamera(s.camera);
      g.world.updateVisuals(0);
      s.haveCacheView = false;
      draw();
      const direct = pixels(s.renderer);
      draw();
      draw();
      gamePairs.push({
        ...compare(direct, pixels(s.renderer)),
        path: s.renderPath,
        calls: s.renderer.info.render.calls,
      });
    }
    let draws = 0;
    s.render = () => {
      draws++;
      draw();
    };
    g.ui.openPanel("settings");
    for (let n = 0; n < 4; n++) g.tick(0.1);
    draws = 0;
    const time = g.state.playTime;
    for (let n = 0; n < 100; n++) g.tick(0.1);
    const menu = { draws, simulationDelta: g.state.playTime - time };
    g.ui.closePanels();
    g.tick(1 / 30);
    const resumed = draws > 0;
    s.render = draw;
    const culling = [];
    for (const [x, z] of [
      [0, -2],
      [1000, 1000],
      [0, -2],
    ]) {
      s.snapTo(x, z);
      s.camera.updateMatrixWorld();
      g.world.setViewFromCamera(s.camera);
      g.world.updateVisuals(0.033);
      culling.push(
        [...g.world.stationVisuals.values()].filter((v) => v.root.visible)
          .length,
      );
    }
    draw();
    draw();
    const { createCharacter } = await import("/src/chars/index.ts");
    const spawn = () => {
      const c = createCharacter("customer", { seed: 42 });
      c.root.position.copy(g.player.char.root.position);
      s.scene.add(c.root);
      c.update(1 / 30, 1, 0);
      draw();
      return c;
    };
    const warm = spawn();
    warm.dispose();
    draw();
    const beforeTextures = s.renderer.info.memory.textures;
    for (let i = 0; i < 20; i++) {
      const c = spawn();
      c.dispose();
    }
    draw();
    const characterMemory = {
      before: beforeTextures,
      after: s.renderer.info.memory.textures,
    };
    const size = s.renderer.getDrawingBufferSize(new T.Vector2());
    return {
      fixture,
      materialParity,
      glError,
      gamePairs,
      menu,
      resumed,
      culling,
      characterMemory,
      character: g.player.char.root.userData.characterPack,
      buffer: { width: size.x, height: size.y, pixels: size.x * size.y },
      layout: g.world.validateLayout(),
    };
  });
  await page.screenshot({
    path: output + "/game.jpg",
    type: "jpeg",
    quality: 90,
  });
  assert.ok(
    result.fixture.every((d) => d.differentFraction < 0.005),
    JSON.stringify(result.fixture),
  );
  assert.equal(result.glError, 0);
  assert.ok(result.materialParity.differentFraction < .005, JSON.stringify(result.materialParity));
  assert.equal(result.characterMemory.after, result.characterMemory.before);
  assert.ok(
    result.gamePairs.every((d) => d.differentFraction < 0.025),
    JSON.stringify(result.gamePairs),
  );
  assert.deepEqual(result.menu, { draws: 0, simulationDelta: 0 });
  assert.equal(result.resumed, true);
  assert.equal(result.culling[1], 0);
  assert.equal(result.culling[0], result.culling[2]);
  assert.ok(result.culling[0] > 0);
  assert.deepEqual(result.layout, []);
  assert.equal(result.character, "fincan-current");
  console.log("Color, depth, menu freeze and off-screen culling passed.");
  await page.evaluate(() => {
    const s = window.__fincan.scene3d;
    window.__restoreGL = s.renderer
      .getContext()
      .getExtension("WEBGL_lose_context");
    window.__restoreGL.loseContext();
  });
  await page.waitForFunction(
    () => window.__fincan.scene3d.isContextLost,
    {},
    { polling: 100 },
  );
  await page.evaluate(() => window.__restoreGL.restoreContext());
  await page.waitForFunction(
    () => !window.__fincan.scene3d.isContextLost,
    {},
    { polling: 100 },
  );
  result.contextRestored = await page.evaluate(() => {
    const g = window.__fincan;
    g.tick(1 / 30);
    g.scene3d.render();
    g.scene3d.render();
    return {
      error: g.scene3d.renderer.getContext().getError(),
      calls: g.scene3d.renderer.info.render.calls,
      lost: g.scene3d.isContextLost,
      path: g.scene3d.renderPath,
    };
  });
  console.log("Context restore: " + JSON.stringify(result.contextRestored));
  await writeFile(
    output + "/result.json",
    JSON.stringify({ result, errors }, null, 2),
  );
  assert.equal(result.contextRestored.error, 0);
  assert.ok(result.contextRestored.calls > 0);
  await page.setViewportSize({ width: 2560, height: 1440 });
  result.largeViewport = await page.evaluate(async () => {
    const { THREE: T } = await import("/tools/browser-render.ts");
    const g = window.__fincan;
    g.scene3d.resize();
    const size = g.scene3d.renderer.getDrawingBufferSize(new T.Vector2());
    return { pixels: size.x * size.y, width: size.x, height: size.y };
  });
  assert.ok(result.largeViewport.pixels <= 450000);
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => {
    const g = window.__fincan;
    g.scene3d.resize();
    window.__frames = [];
    const draw = g.scene3d.render.bind(g.scene3d);
    g.scene3d.render = () => {
      const start = performance.now();
      draw();
      window.__frames.push({ at: start, work: performance.now() - start });
    };
    g.start();
  });
  await page.waitForTimeout(6000);
  result.throttled = await page.evaluate(() => {
    window.__fincan.stop();
    const frames = window.__frames;
    const work = frames.map((x) => x.work).sort((a, b) => a - b);
    return {
      cpuSlowdown: 4,
      frames: frames.length,
      renderCpuMedianMs: work[Math.floor(work.length / 2)] ?? null,
    };
  });
  assert.ok(result.throttled.frames > 20, JSON.stringify(result.throttled));
  await writeFile(
    output + "/result.json",
    JSON.stringify({ result, errors }, null, 2),
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  await server.close();
}
