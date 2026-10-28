import {
  utopia,
  imza,
  filmFolder,
  filmName,
  conceptQuery,
} from "./promo-config.mjs";
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await writeFile(
  `${filmFolder}/izle.html`,
  `<!doctype html><html lang="tr"><meta charset="utf-8"><title>Kafe Caddesi · Reklam</title><style>html,body{margin:0;background:#102e25}video{height:100vh;max-width:100vw;display:block;margin:auto}</style><video id="video" src="../../${filmName}" controls playsinline preload="auto"></video></html>`,
);
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
try {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  await page.goto(pathToFileURL(resolve(`${filmFolder}/izle.html`)).href);
  await page.waitForFunction(
    () => document.getElementById("video").readyState >= 2,
  );
  const report = await page.evaluate(async () => {
    const v = document.getElementById("video");
    const begin = performance.now();
    const completed = new Promise((ok, bad) => {
      v.addEventListener("ended", () => ok(), { once: true });
      v.addEventListener("error", () => bad(new Error(v.error?.message)), {
        once: true,
      });
      setTimeout(() => bad(new Error("Playback timed out")), 35000);
    });
    await v.play();
    await completed;
    const q = v.getVideoPlaybackQuality();
    return {
      duration: v.duration,
      width: v.videoWidth,
      height: v.videoHeight,
      ended: v.ended,
      muted: v.muted,
      error: v.error,
      elapsedSeconds: (performance.now() - begin) / 1000,
      totalFrames: q.totalVideoFrames,
      droppedFrames: q.droppedVideoFrames,
    };
  });
  assert.ok(report.ended);
  assert.equal(report.error, null);
  assert.equal(report.width, 1080);
  assert.equal(report.height, 1920);
  assert.equal(report.duration, 25);
  assert.ok(report.totalFrames >= 740);
  await page.screenshot({ path: `${filmFolder}/playback-end.png` });
  await writeFile(
    `${filmFolder}/playback.json`,
    JSON.stringify({ passed: true, ...report }, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
