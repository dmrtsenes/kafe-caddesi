import {
  utopia,
  imza,
  filmFolder,
  filmName,
  conceptQuery,
} from "./promo-config.mjs";
import { chromium } from "playwright";
import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const server = await createServer({
  server: {
    host: "127.0.0.1",
    port: 0,
    strictPort: false,
    open: false,
    hmr: false,
    watch: null,
  },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
      viewport: { width: 540, height: 960 },
      locale: "tr-TR",
    }),
    page = await context.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.setDefaultTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0], {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.__fincan, null, { timeout: 180000 });
  await page.evaluate(() => {
    const g = window.__fincan;
    g.stop();
    g.state.money = 76543;
    g.state.tutorialStep = 99;
    g.state.upgrades.capacity = 2;
    g.persist();
  });
  await page.goto(
    `${server.resolvedUrls.local[0]}reklam.html?capture=1${conceptQuery}`,
    {
      waitUntil: "domcontentloaded",
    },
  );
  await page.waitForFunction(() => window.__reklam, null, { timeout: 180000 });
  const before = await page.evaluate(() =>
    Object.fromEntries(Object.entries(localStorage)),
  );
  await page.evaluate(() => {
    for (let n = 0; n < 750; n++) window.__reklam.stepFrame(false);
  });
  const after = await page.evaluate(() =>
    Object.fromEntries(Object.entries(localStorage)),
  );
  assert.deepEqual(
    after,
    before,
    "All same-origin player storage must be unchanged",
  );
  await page.goto(server.resolvedUrls.local[0], {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.__fincan, null, { timeout: 180000 });
  const resumed = await page.evaluate(() => {
    const g = window.__fincan;
    g.stop();
    return {
      money: g.state.money,
      capacity: g.state.upgrades.capacity,
      tutorialStep: g.state.tutorialStep,
      mode: !!window.__reklam,
      semaverZ: g.world.byId.get("k_semaver").z,
      boundsZ: g.world.loc.bounds.z1,
      characterModel: g.player.char.root.userData.characterModel,
      canvas: !!document.getElementById("game-canvas"),
      ui: !!document.getElementById("ui-root"),
    };
  });
  assert.equal(resumed.money, 76543);
  assert.equal(resumed.capacity, 2);
  assert.equal(resumed.tutorialStep, 99);
  assert.equal(resumed.mode, false);
  assert.equal(resumed.semaverZ, -12.6);
  assert.equal(resumed.boundsZ, 21.2);
  assert.equal(resumed.characterModel, "PlayerS01");
  assert.ok(resumed.canvas && resumed.ui);
  assert.deepEqual(errors, []);
  await writeFile(
    `${filmFolder}/save-regression.json`,
    JSON.stringify(
      {
        passed: true,
        localCharacterPrototype: true,
        fullFilmSteps: 750,
        allStorageUnchanged: true,
        resumed,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Local prototype round-trip passed: real save -> complete promo -> normal game.",
  );
} finally {
  await browser?.close();
  await server.close();
}
