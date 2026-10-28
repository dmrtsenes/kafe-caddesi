import {
  utopia,
  imza,
  filmFolder,
  filmName,
  conceptQuery,
} from "./promo-config.mjs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
const out = filmFolder;
await mkdir(out, { recursive: true });
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
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--enable-unsafe-swiftshader",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    locale: "tr-TR",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error("PAGE ERROR", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.error(m.text().slice(0, 300));
  });
  await page.goto(
    `${server.resolvedUrls.local[0]}reklam.html?capture=1${conceptQuery}`,
    {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    },
  );
  await page.waitForFunction(
    () =>
      window.__reklam ||
      document.querySelector("#status")?.textContent?.includes("açılamadı"),
    null,
    { timeout: 120000 },
  );
  console.log(
    await page.evaluate(
      () =>
        window.__reklam?.report() ??
        document.querySelector("#status")?.textContent,
    ),
  );
  for (const second of [
    0.2, 2.5, 4, 6, 7.7, 9.3, 11.5, 13.5, 15.8, 17.5, 19, 21.8, 24, 25,
  ]) {
    const result = await page.evaluate((second) => {
      const c = window.__reklam;
      const target = Math.min(750, Math.round(second * 30));
      while (c.report().frame < target - 1) c.stepFrame(false);
      c.stepFrame();
      return { report: c.report(), png: c.png() };
    }, second);
    await writeFile(
      `${out}/draft-${String(second).replace(".", "_")}.png`,
      Buffer.from(result.png, "base64"),
    );
    console.log(
      JSON.stringify({
        second,
        task: result.report.task,
        player: result.report.player,
        stats: result.report.stats,
        floorSpillRemaining: result.report.floorSpillRemaining,
      }),
    );
    await writeFile(
      `${out}/draft-report.json`,
      JSON.stringify(result.report, null, 2),
    );
  }
  await writeFile(
    `${out}/venue.png`,
    Buffer.from(await page.evaluate(() => window.__reklam.roomPng()), "base64"),
  );
  const final = await page.evaluate(() => window.__reklam.report());
  assert.equal(final.frame, 750);
  assert.deepEqual(final.layoutProblems, []);
  assert.equal(final.gardenIntrusions, 0);
  assert.ok(final.stats.served >= 3);
  assert.ok(final.collected > 0);
  assert.equal(final.dirty.dishes, 0);
  assert.ok(final.dirty.soil <= 0.02);
  assert.equal(final.player.model, "PlayerS01");
  assert.ok(
    final.events.some((e) => e.kind === "served" && e.data.item === "waffle"),
  );
  console.log(
    JSON.stringify({
      traffic: final.traffic,
      staff: await page.evaluate(() => window.__reklam.staffSnapshot()),
    }),
  );
  assert.equal(final.traffic.overlaps, 0);
  assert.ok(final.traffic.maxTransformError < 1e-7);
  console.log("Promo scene checks passed.");
} finally {
  await browser?.close();
  await server.close();
}
