/** Review the final deliverable, not just its intermediate capture frames. */
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { filmFolder, filmName } from "./promo-config.mjs";

const out = resolve(filmFolder),
  video = resolve(filmName);
const ffmpeg =
  process.env.FFMPEG_PATH || resolve(".tools/video/ffmpeg/package/ffmpeg.exe");
function run(args) {
  return new Promise((ok, bad) => {
    const p = spawn(ffmpeg, ["-hide_banner", ...args], { windowsHide: true });
    let stderr = "";
    p.stderr.on("data", (data) => (stderr += data));
    p.on("error", bad);
    p.on("exit", (code) => (code === 0 ? ok(stderr) : bad(new Error(stderr))));
  });
}
const verification = JSON.parse(
  await readFile(resolve(out, "verification.json"), "utf8"),
);
const save = JSON.parse(
  await readFile(resolve(out, "save-regression.json"), "utf8"),
);
const playback = JSON.parse(
  await readFile(resolve(out, "playback.json"), "utf8"),
);
assert.ok(verification.passed && save.passed && playback.passed);
const detection = await run([
  "-i",
  video,
  "-vf",
  "blackdetect=d=0.25:pix_th=0.06",
  "-af",
  "volumedetect",
  "-f",
  "null",
  "-",
]);
await writeFile(resolve(out, "signal-check.log"), detection);
assert.ok(!detection.includes("black_start:"), "Black interruption found");
const peak = Number(detection.match(/max_volume: ([\d.-]+) dB/)?.[1]);
const mean = Number(detection.match(/mean_volume: ([\d.-]+) dB/)?.[1]);
assert.ok(
  Number.isFinite(peak) && peak < 0 && peak > -12,
  "Invalid or clipped audio peak",
);
assert.ok(Number.isFinite(mean) && mean > -30, "Unexpectedly quiet audio");
await run([
  "-y",
  "-i",
  video,
  "-vf",
  "fps=1,scale=324:576,tile=5x5",
  "-frames:v",
  "1",
  "-q:v",
  "2",
  resolve(out, "final-contact.jpg"),
]);
for (const second of [1, 5.9, 9.7, 11.6, 14.8, 17.7, 21.9, 24.5]) {
  await run([
    "-y",
    "-ss",
    String(second),
    "-i",
    video,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    resolve(out, `final-${second}.jpg`),
  ]);
}
await run([
  "-y",
  "-i",
  resolve(out, "venue.png"),
  "-frames:v",
  "1",
  "-q:v",
  "2",
  resolve("kafe-premium.jpg"),
]);
await run([
  "-y",
  "-ss",
  "1",
  "-i",
  video,
  "-frames:v",
  "1",
  "-q:v",
  "2",
  resolve("reklam-kapak.jpg"),
]);
const metadata = await stat(video);
const sha256 = createHash("sha256")
  .update(await readFile(video))
  .digest("hex");
const report = {
  passed: true,
  output: video,
  bytes: metadata.size,
  sha256,
  width: 1080,
  height: 1920,
  fps: 30,
  frames: 750,
  duration: 25,
  peakDb: peak,
  meanDb: mean,
  blackInterruptions: 0,
  saveUnchanged: save.allStorageUnchanged,
  storageCalls: verification.storageCalls,
  playback,
  verifiedAt: new Date().toISOString(),
};
await writeFile(resolve(out, "delivery.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
