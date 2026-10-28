import {
  utopia,
  imza,
  filmFolder,
  filmName,
  conceptQuery,
} from "./promo-config.mjs";
import { chromium } from "playwright";
import { createServer } from "vite";
import {
  mkdir,
  writeFile,
  readFile,
  access,
  copyFile,
  rename,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { once } from "node:events";
import assert from "node:assert/strict";
import { makePromoAudio } from "./promo-audio.mjs";
const out = resolve(filmFolder),
  finalOutput = resolve(filmName),
  output = resolve(out, "reklam-master.mp4");
const ffmpeg =
  process.env.FFMPEG_PATH || resolve(".tools/video/ffmpeg/package/ffmpeg.exe");
const ffprobe =
  process.env.FFPROBE_PATH ||
  resolve(".tools/video/ffprobe/package/ffprobe.exe");
await Promise.all([access(ffmpeg), access(ffprobe)]);
await mkdir(out, { recursive: true });
function run(exe, args) {
  return new Promise((ok, bad) => {
    const p = spawn(exe, args, { windowsHide: true });
    let stdout = "",
      stderr = "";
    p.stdout.on("data", (b) => (stdout += b));
    p.stderr.on("data", (b) => (stderr += b));
    p.on("error", bad);
    p.on("exit", (code) =>
      code === 0 ? ok({ stdout, stderr }) : bad(new Error(stderr.slice(-3000))),
    );
  });
}
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
let browser, encoder;
try {
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
  const page = await context.newPage(),
    errors = [],
    failedRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
      failedRequests.push({ url: r.url(), status: r.status() });
  });
  await context.addInitScript(() => {
    // Deliberately opaque sentinels prove that studio boot never reads, parses,
    // migrates, clears or overwrites player storage, even with an unreadable save.
    localStorage.setItem("fincan-sokagi:save:v8", "PLAYER_SAVE_KEEP_EXACT");
    localStorage.setItem(
      "fincan-sokagi:save:v8:bak",
      "PLAYER_BACKUP_KEEP_EXACT",
    );
    localStorage.setItem("fincan-sokagi:language:v1", "en");
    localStorage.setItem(
      "fincan-sokagi:settings:v2",
      "PLAYER_SETTINGS_KEEP_EXACT",
    );
    window.__storageBefore = JSON.stringify(
      Object.entries(localStorage).sort(),
    );
    window.__storageCalls = [];
    for (const name of ["getItem", "setItem", "removeItem", "clear"]) {
      const original = Storage.prototype[name];
      Storage.prototype[name] = function (...args) {
        window.__storageCalls.push({ name, key: args[0] });
        return original.apply(this, args);
      };
    }
  });
  await page.goto(
    `${server.resolvedUrls.local[0]}reklam.html?capture=1${conceptQuery}`,
    {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    },
  );
  await page.waitForFunction(() => window.__reklam, null, { timeout: 180000 });
  console.log("Studio ready: native 1080x1920, fixed simulation, 750 frames.");
  encoder = spawn(
    ffmpeg,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      "30",
      "-i",
      "pipe:0",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      resolve(out, "picture.mp4"),
    ],
    { windowsHide: true, stdio: ["pipe", "ignore", "pipe"] },
  );
  let encodeError = "";
  encoder.stderr.on("data", (b) => (encodeError += b));
  encoder.stdin.on("error", () => {});
  const encoded = new Promise((ok, bad) => {
    encoder.on("error", bad);
    encoder.on("exit", (code) =>
      code === 0 ? ok() : bad(new Error(encodeError)),
    );
  });
  const stills = new Set([
    0, 29, 89, 149, 209, 254, 284, 329, 374, 419, 479, 539, 599, 644, 659, 689,
    719, 749,
  ]);
  const motion = [];
  for (let n = 0; n < 750; n++) {
    const data = await page.evaluate(() => {
      const c = window.__reklam;
      if (!c.stepFrame()) throw new Error("Early end");
      return { png: c.png(), framing: c.framing() };
    });
    const png = Buffer.from(data.png, "base64");
    for (const point of data.framing.check
      ? [data.framing.head, data.framing.feet]
      : [])
      assert.ok(
        Math.abs(point[0]) < 0.85 && point[1] < 0.58 && point[1] > -0.62,
        "Actor left action-safe frame " +
          n +
          ": " +
          JSON.stringify(data.framing),
      );
    if (!encoder.stdin.write(png)) await once(encoder.stdin, "drain");
    if (stills.has(n))
      await writeFile(
        resolve(out, `frame-${String(n).padStart(4, "0")}.png`),
        png,
      );
    if (n % 60 === 59) {
      const r = await page.evaluate(() => window.__reklam.report());
      motion.push({ frame: n + 1, player: r.player });
      console.log(
        `Frame ${n + 1}/750 | ${r.task} | served=${r.stats.served} | cash=${r.collected.toFixed(0)} | soil=${r.dirty.soil.toFixed(2)}`,
      );
    }
  }
  encoder.stdin.end();
  await encoded;
  encoder = null;
  await writeFile(
    resolve(out, "venue.png"),
    Buffer.from(await page.evaluate(() => window.__reklam.roomPng()), "base64"),
  );
  const report = await page.evaluate(() => ({
    ...window.__reklam.report(),
    storageUnchanged:
      JSON.stringify(Object.entries(localStorage).sort()) ===
      window.__storageBefore,
    storageCalls: window.__storageCalls,
  }));
  await writeFile(
    resolve(out, "scene-report.json"),
    JSON.stringify({ ...report, errors, failedRequests, motion }, null, 2),
  );
  assert.equal(report.frame, 750);
  assert.ok(Math.abs(report.time - 25) < 1e-7);
  assert.ok(report.stats.served >= 3, "Three actual item deliveries required");
  assert.ok(report.collected > 0, "Real till collection required");
  assert.ok(
    report.events.some((e) => e.kind === "cleaned" && e.data.id === "k_masa_4"),
    "Table must be fully cleaned",
  );
  assert.equal(report.dirty.dishes, 0);
  assert.ok(report.dirty.soil <= 0.02);
  assert.ok(report.discarded);
  assert.equal(
    report.player.model,
    "PlayerS01",
    "User character must be retained",
  );
  assert.ok(
    report.events.filter((e) => e.kind === "served" && e.data.item === "waffle")
      .length >= 2,
    "Two real waffle deliveries required",
  );
  assert.deepEqual(report.layoutProblems, []);
  assert.equal(
    report.gardenIntrusions,
    0,
    "Walking actors entered the raised water garden",
  );
  assert.equal(report.traffic.overlaps, 0, JSON.stringify(report.traffic));
  assert.ok(report.traffic.maxTransformError < 1e-4, "Transform error: " + report.traffic.maxTransformError);
  assert.ok(report.storageUnchanged);
  assert.deepEqual(report.storageCalls, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  assert.deepEqual(report.resolution, [1080, 1920]);
  await makePromoAudio(
    report.events,
    resolve(out, "soundtrack.wav"),
    25,
    utopia,
    imza,
  );
  console.log("Gameplay and storage checks passed. Mastering MP4 soundtrack.");
  const master = await run(ffmpeg, [
    "-y",
    "-hide_banner",
    "-i",
    resolve(out, "picture.mp4"),
    "-i",
    resolve(out, "soundtrack.wav"),
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=9",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-t",
    "25",
    "-movflags",
    "+faststart",
    output,
  ]);
  await writeFile(resolve(out, "mastering.log"), master.stderr);
  const probe = JSON.parse(
    (
      await run(ffprobe, [
        "-v",
        "error",
        "-count_frames",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        output,
      ])
    ).stdout,
  );
  const v = probe.streams.find((s) => s.codec_type === "video"),
    a = probe.streams.find((s) => s.codec_type === "audio");
  assert.equal(v.codec_name, "h264");
  assert.equal(v.width, 1080);
  assert.equal(v.height, 1920);
  assert.equal(v.avg_frame_rate, "30/1");
  assert.equal(+v.nb_read_frames, 750);
  assert.equal(v.pix_fmt, "yuv420p");
  assert.equal(a.codec_name, "aac");
  assert.equal(a.channels, 2);
  assert.equal(+a.sample_rate, 48000);
  assert.ok(Math.abs(+probe.format.duration - 25) < 0.06);
  const decode = await run(ffmpeg, [
    "-v",
    "error",
    "-i",
    output,
    "-f",
    "null",
    "-",
  ]);
  assert.equal(decode.stderr.trim(), "");
  await writeFile(
    resolve(out, "verification.json"),
    JSON.stringify(
      {
        output: finalOutput,
        passed: true,
        probe,
        storageUnchanged: report.storageUnchanged,
        storageCalls: report.storageCalls,
        served: report.stats.served,
        collected: report.collected,
        tableCleaned: true,
        errors,
        failedRequests,
        decodedWithoutErrors: true,
        actorFramingChecked: "service, checkout and cleaning shots",
        characterModel: report.player.model,
        tableCount: report.tableCount,
        staffCount: report.staffCount,
        menu: report.menu,
        conceptOnly: true,
        design: report.design,
        gardenIntrusions: report.gardenIntrusions,
        rendering: report.rendering,
        traffic: report.traffic,
      },
      null,
      2,
    ),
  );
  // Publish only after every scene, storage and media check succeeds.
  const pending = resolve(out, "delivery.pending.mp4");
  await copyFile(output, pending);
  try {
    await access(finalOutput);
    await copyFile(finalOutput, resolve(out, `previous-${Date.now()}.mp4`));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await rename(pending, finalOutput);
  await copyFile(finalOutput, resolve("reklam-full.mp4"));
  await run(ffmpeg, [
    "-y",
    "-v",
    "error",
    "-ss",
    "3.5",
    "-i",
    finalOutput,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    "-update",
    "1",
    resolve("reklam-full-kapak.jpg"),
  ]);
  console.log("Verified and published to: " + finalOutput + " and reklam-full.mp4");
} finally {
  encoder?.kill();
  await browser?.close();
  await server.close();
}
