import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const phase =
  process.argv.find((a) => a.startsWith("--phase="))?.split("=")[1] ?? "after";
const out = `.devshots/hybrid-cafe/${phase}`;
await mkdir(out, { recursive: true });
const server = await createServer({
  server: {
    host: "127.0.0.1",
    port: 5281,
    strictPort: false,
    open: false,
    hmr: false,
    watch: null,
  },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 540, height: 960 },
    locale: "tr-TR",
  });
  const errors = [];
  page.on("console", m => { if (["warning", "error"].includes(m.type())) console.log(m.text().slice(0,400)); });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0], {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForFunction(() => window.__fincan, null, { timeout: 180000 });
  await page.evaluate(async () => {
    const g = window.__fincan;
    g.stop();
    g.state.tutorialStep = 99;
    g.state.money = 76543;
    g.state.upgrades.capacity = 2;
    g.persist();
    const {flushStorage}=await import('/src/core/Native.ts');await flushStorage();
    window.__hybridSaveBefore=localStorage.getItem('fincan-sokagi:save:v8');
    if(JSON.parse(window.__hybridSaveBefore)?.state.money!==76543)throw new Error('Seed save was not written');
    g.ui.setTutorial(null);
    g.ui.closePanels();
  });
  const report = [];
  for (const location of ["kose", "sahil"]) {
    await page.evaluate((location) => {
      const g = window.__fincan;
      g.persistDisabled = true;
      g.state.unlockedLocations.add(location);
      g.switchLocation(location);
      g.stop();
      g.ui.closePanels();
      g.ui.setTutorial(null);
    }, location);
    for (const stage of ["first", "full"]) {
      await page.evaluate((stage) => {
        const g = window.__fincan,
          w = g.world;
        if (stage === "full")
          for (const z of w.loc.zones)
            if (!w.zoneUnlocked(z.id)) w.unlockZone(z.id);
        for (const st of w.machines) if (!st.locked) st.output = st.outputCap;
      }, stage);
      for (const target of location === "kose"
        ? ["bar", "tables", "salon", "foyer"]
        : ["bar", "tables"]) {
        if (stage === "first" && ["salon", "foyer"].includes(target)) continue;
        const result = await page.evaluate(
          async ({ target, stage }) => {
            const g = window.__fincan,
              w = g.world,
              T = await import("/node_modules/three/build/three.module.js"),
              { floorLiftAt } = await import("/src/data/layouts.ts");
            let x = 0,
              z = 2;
            if (w.loc.id === "kose") {
              if (target === "bar") {
                x = -4.8;
                z = -5.7;
              }
              if (target === "tables") {
                x = 0;
                z = 4.1;
              }
              if (target === "salon") {
                const r = w.loc.zones.find((z) => z.id === "r1").room;
                x = (r.x0 + r.x1) / 2;
                z = (r.z0 + r.z1) / 2;
              }
              if (target === "foyer") {
                x = 0;
                z = 15.7;
              }
            } else {
              if (target === "bar") {
                x = -3.4;
                z = -3.2;
              } else {
                x = 1;
                z = 6;
              }
            }
            g.player.setPosition(x, z);
            g.player.floorY = floorLiftAt(w.loc, x, z);
            g.player.char.root.position.y = g.player.floorY;
            g.scene3d.setOpeningFrame(false);
            g.scene3d.resize();
            g.scene3d.snapTo(x, z);
            for (let i = 0; i < 300; i++) {
              g.player.update(
                1 / 60,
                { x: 0, y: 0, mag: 0, active: false },
                w.nav,
                w.loc.bounds,
              );
              g.stepVisual(1 / 60);
              w.updateVisuals(1 / 60);
              w.env.update(1 / 60);
              for(const visual of w.stationVisuals.values()) visual.update(1 / 60);
            }
            g.scene3d.invalidateStatic();
            g.scene3d.invalidateShadows();
            g.scene3d.render();
            w.root.updateMatrixWorld(true);
            const tables = w.tables
              .filter((t) => !t.locked)
              .map((t) => {
                const r = w.stationVisuals.get(t.id).root,
                  f = r.getObjectByName("tableFurniture"),
                  b = f ? new T.Box3().setFromObject(f) : null;
                return {
                  id: t.id,
                  seats: t.seats,
                  top: b ? b.max.y - r.position.y : null,
                  chairs: !!r.getObjectByName("cafePackChairs"),
                  topSurface: !!f?.geometry.userData.cafeSurfaceGroups,
                };
              });
            return {
              location: w.loc.id,
              stage,
              target,
              layout: w.validateLayout(),
              model: g.player.char.root.userData.characterModel,
              render: { ...g.scene3d.renderer.info.render },
              tables,
            };
          },
          { target, stage },
        );
        report.push(result);
        await page.screenshot({
          path: `${out}/${location}-${stage}-${target}.png`,
        });
      }
    }
  }
  const storageStable=await page.evaluate(()=>({same:localStorage.getItem('fincan-sokagi:save:v8')===window.__hybridSaveBefore,raw:localStorage.getItem('fincan-sokagi:save:v8')}));
  await writeFile(`${out}/storage-before-reload.json`,JSON.stringify(storageStable,null,2));
  await page.goto(server.resolvedUrls.local[0], {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.__fincan, null, { timeout: 180000 });
  const saved = await page.evaluate(() => {
    const g = window.__fincan;
    g.stop();
    return {
      money: g.state.money,
      capacity: g.state.upgrades.capacity,
      location: g.world.loc.id,
      model: g.player.char.root.userData.characterModel,
    };
  });
  assert.equal(saved.money, 76543);
  assert.equal(saved.capacity, 2);
  assert.equal(saved.location, "kose");
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ phase, report, saved, errors }, null, 2),
  );
  for (const r of report) {
    assert.deepEqual(r.layout, [], JSON.stringify(r));
    assert.equal(r.model, "PlayerS01");
    for (const t of r.tables) {
      assert.ok(Math.abs(t.top - 1) < 1e-5, t.id + " tabletop");
      if (phase !== "before")
        assert.ok(t.chairs && t.topSurface, t.id + " pack furniture");
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ passed: true, phase, report, saved, errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: true,
      phase,
      views: report.length,
      saved,
      errors,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
