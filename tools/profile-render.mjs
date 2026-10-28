import { chromium } from "playwright";
import { createServer } from "vite";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")),
);
const output = args.output ?? ".devshots/render-before";
await mkdir(output, { recursive: true });
const saved = JSON.parse(
  await readFile(".devshots/device-1.2.0/before.json", "utf8"),
).save;
const state = Buffer.from(saved.slice(5), "base64").toString("utf8");
const server = await createServer({
  server: { host: "127.0.0.1", port: 5194, strictPort: true, open: false },
});
await server.listen();
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("PAGE ERROR: " + e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      console.log("CONSOLE: " + m.text());
  });
  await page.addInitScript(
    ({ state }) => {
      localStorage.setItem("fincan-sokagi:save:v8", state);
      localStorage.setItem("fincan-sokagi:language:v1", "tr");
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
      let seed = 1994;
      Math.random = () => {
        seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    },
    { state },
  );
  await page.goto("http://127.0.0.1:5194/?" + (args.query ?? ""), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page
    .waitForFunction(
      () => !!window.__fincan,
      {},
      { timeout: 60000, polling: 100 },
    )
    .catch(async (e) => {
      console.log(await page.locator("body").innerText());
      throw e;
    });
  console.log("Assets loaded; measuring fixed scene.");
  const profile = await page.evaluate(() => {
    const g = window.__fincan;
    g.stop();
    g.ui.hideBoot();
    const draw = g.scene3d.render.bind(g.scene3d);
    g.scene3d.render = () => {};
    for (let i = 0; i < 1800; i++) g.tick(1 / 30);
    g.scene3d.render = draw;
    g.scene3d.snapTo(0, -2);
    g.scene3d.camera.updateMatrixWorld();
    const histogram = {};
    for (const [id, v] of g.world.stationVisuals)
      v.root.userData.profileGroup = id;
    for (const c of g.world.customers)
      c.char.root.userData.profileGroup = "customer";
    for (const c of g.world.staff) c.char.root.userData.profileGroup = "staff";
    g.player.char.root.userData.profileGroup = "player";
    const restores = [];
    g.scene3d.scene.traverse((o) => {
      if (!o.isMesh && !o.isSprite) return;
      const old = o.onBeforeRender;
      restores.push(() => (o.onBeforeRender = old));
      o.onBeforeRender = function (...args) {
        old?.apply(this, args);
        let p = o,
          group = "environment";
        while (p) {
          if (p.userData.profileGroup) {
            group = p.userData.profileGroup;
            break;
          }
          p = p.parent;
        }
        const key = group + ":" + (o.material?.type ?? "multi");
        histogram[key] = (histogram[key] ?? 0) + 1;
      };
    });
    const renderer = g.scene3d.renderer;
    renderer.info.autoReset = false;
    renderer.info.reset();
    draw();
    const first = { ...renderer.info.render };
    for (const restore of restores) restore();
    for (let i = 0; i < 5; i++) draw();
    const times = [],
      calls = [];
    for (let i = 0; i < 40; i++) {
      renderer.info.reset();
      const start = performance.now();
      draw();
      times.push(performance.now() - start);
      calls.push(renderer.info.render.calls);
    }
    times.sort((a, b) => a - b);
    const chars = [g.player, ...g.world.staff, ...g.world.customers];
    const animation = [];
    for (let n = 0; n < 30; n++) {
      const start = performance.now();
      for (const c of chars) c.char.update(1 / 30, 2, 0);
      animation.push(performance.now() - start);
    }
    animation.sort((a, b) => a - b);
    let nodes = 0,
      skinned = 0;
    g.scene3d.scene.traverse((o) => {
      nodes++;
      if (o.isSkinnedMesh) skinned++;
    });
    return {
      character: g.player.char.root.userData.characterPack,
      firstDraw: first,
      steadyCalls: calls.at(-1),
      renderMedianMs: times[20],
      renderP90Ms: times[36],
      animationMedianMs: animation[15],
      actorCount: chars.length,
      nodes,
      skinned,
      cache: g.scene3d.blitWorks ?? g.scene3d.cacheSupported,
      histogram: Object.entries(histogram).sort((a, b) => b[1] - a[1]),
      layout: g.world.validateLayout(),
    };
  });
  await page.screenshot({
    path: output + "/game.jpg",
    type: "jpeg",
    quality: 85,
    scale: "css",
  });
  await writeFile(
    output + "/profile.json",
    JSON.stringify({ profile, errors }, null, 2),
  );
  console.log(JSON.stringify({ profile, errors }));
} finally {
  await browser.close();
  await server.close();
}
