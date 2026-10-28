import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';

// This checks the exported film, independently of the game's build or dev server.
const root = resolve(import.meta.dirname, '..');
const input = resolve(root, process.argv[2] ?? 'campaign-film/Kafe-Caddesi-Sinematik-27s.mp4');
const duration = Number(process.argv[3] ?? 27);
if (!Number.isInteger(duration) || duration < 5 || duration > 120) throw new Error('Expected duration must be an integer from 5 to 120 seconds');
const output = resolve(root, process.argv[4] ?? process.env.FILM_REVIEW_DIR ?? (duration === 27 ? 'campaign-film/review' : `campaign-film/review-${duration}s`));
const ffmpeg = resolve(root, '.tools/video/ffmpeg/package/ffmpeg.exe');
const ffprobe = resolve(root, '.tools/video/ffprobe/package/ffprobe.exe');
const expected = { width: 1080, height: 1920, fps: 30, frames: duration * 30, duration };
const sampleTimes = [0, 0.7, 1.5, 2.5, 3.5, 4.7, 5.2, 7, 9.5, 12, 14.7, 16.7, 19.3, 22, 23.9, 26.5].map(time => Math.round(time * duration / 27 * 10) / 10);
const report = {
  input, createdAt: new Date().toISOString(), expected, checks: [], warnings: [],
  limits: { maxBlackSeconds: 0.45, maxActionFreezeSeconds: 1.5, endcardStart: duration - 4, maxEndcardFreezeSeconds: 4 },
  evidenceScope: 'Automated decoded-file and browser-playback measurements. No human listening claim.',
};

function check(name, passed, actual, requirement) {
  report.checks.push({ name, passed: Boolean(passed), actual, requirement });
}

function run(binary, args, { timeout = 180000, binaryOutput = false } = {}) {
  return new Promise((accept, reject) => {
    const child = spawn(binary, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [], stderr = [];
    let settled = false;
    const deadline = setTimeout(() => {
      child.kill();
      if (!settled) { settled = true; reject(new Error(`${binary} timed out after ${timeout}ms`)); }
    }, timeout);
    child.stdout.on('data', chunk => stdout.push(chunk));
    child.stderr.on('data', chunk => stderr.push(chunk));
    child.on('error', error => {
      clearTimeout(deadline);
      if (!settled) { settled = true; reject(error); }
    });
    child.on('close', code => {
      clearTimeout(deadline);
      if (settled) return;
      settled = true;
      const result = { code, stdout: binaryOutput ? Buffer.concat(stdout) : Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') };
      if (code !== 0) reject(Object.assign(new Error(`${binary} exited ${code}: ${result.stderr.slice(-4000)}`), { result }));
      else accept(result);
    });
  });
}

function ratio(value) {
  const [numerator, denominator = 1] = String(value).split('/').map(Number);
  return numerator / denominator;
}

function analyzeFreezes(log, duration) {
  const ranges = [];
  let start;
  for (const line of log.split(/\r?\n/)) {
    const begin = line.match(/freeze_start:\s*([\d.]+)/);
    const end = line.match(/freeze_end:\s*([\d.]+)/);
    if (begin) start = Number(begin[1]);
    if (end && start !== undefined) {
      ranges.push({ start, end: Number(end[1]), duration: Number(end[1]) - start });
      start = undefined;
    }
  }
  if (start !== undefined) ranges.push({ start, end: duration, duration: duration - start });
  return ranges;
}

async function probeAndDecode() {
  const media = JSON.parse((await run(ffprobe, [
    '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', input,
  ])).stdout);
  report.probe = media;
  await writeFile(resolve(output, 'ffprobe.json'), JSON.stringify(media, null, 2));
  const video = media.streams.find(stream => stream.codec_type === 'video');
  const audio = media.streams.find(stream => stream.codec_type === 'audio');
  check('one video and one audio stream', media.streams.length === 2 && video && audio, media.streams.map(stream => stream.codec_type), ['video', 'audio']);
  if (!video || !audio) throw new Error('Both video and audio streams are required');
  const frames = Number(video.nb_read_frames);
  check('vertical dimensions', video.width === expected.width && video.height === expected.height, `${video.width}x${video.height}`, '1080x1920');
  check('frame rate', ratio(video.avg_frame_rate) === 30 && ratio(video.r_frame_rate) === 30, { average: video.avg_frame_rate, nominal: video.r_frame_rate }, '30/1');
  check('decoded frame count', frames === expected.frames, frames, expected.frames);
  check('H.264 pixel format', video.codec_name === 'h264' && video.pix_fmt === 'yuv420p', { codec: video.codec_name, pixelFormat: video.pix_fmt }, 'h264 / yuv420p');
  check('video duration', Math.abs(Number(video.duration) - duration) < 0.001, Number(video.duration), `${duration} seconds`);
  check('container duration', Math.abs(Number(media.format.duration) - duration) < 0.04, Number(media.format.duration), `${duration} seconds, ≤40ms audio padding`);
  check('AAC audio format', audio.codec_name === 'aac' && Number(audio.sample_rate) === 48000 && audio.channels === 2, { codec: audio.codec_name, sampleRate: audio.sample_rate, channels: audio.channels }, 'AAC / 48000Hz / stereo');
  check('audio duration', Math.abs(Number(audio.duration) - duration) < 0.04, Number(audio.duration), `${duration} seconds, ≤40ms audio padding`);

  const decoded = await run(ffmpeg, [
    '-hide_banner', '-nostdin', '-i', input,
    '-map', '0:v:0', '-map', '0:a:0',
    '-vf', 'blackdetect=d=0.12:pix_th=0.08:pic_th=0.98,freezedetect=n=-45dB:d=0.7',
    '-af', 'ebur128=peak=true', '-f', 'null', '-',
  ]);
  await writeFile(resolve(output, 'full-decode-loudness.log'), decoded.stderr);
  const corruption = decoded.stderr.split(/\r?\n/).filter(line => /error while decoding|invalid data found|corrupt decoded frame|concealing \d+|non[- ]monoton/i.test(line));
  check('full decode', decoded.code === 0 && corruption.length === 0, { exitCode: decoded.code, decodeErrors: corruption }, 'No decoder errors');
  const black = [...decoded.stderr.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g)]
    .map(match => ({ start: Number(match[1]), end: Number(match[2]), duration: Number(match[3]) }));
  const freezes = analyzeFreezes(decoded.stderr, duration);
  report.pictureSignals = { black, freezes };
  check('no extended black gaps', black.every(range => range.duration <= report.limits.maxBlackSeconds), black, 'No ≥98% black image lasting over 0.45 seconds');
  check('no stuck action shots', freezes.every(range => range.start >= report.limits.endcardStart || range.duration <= 1.5), freezes.filter(range => range.start < report.limits.endcardStart), 'No action-shot freeze longer than 1.5 seconds');
  check('bounded endcard hold', freezes.every(range => range.start < report.limits.endcardStart || range.duration <= 4.01), freezes.filter(range => range.start >= report.limits.endcardStart), 'Endcard hold up to 4 seconds is intentional');
  const summary = decoded.stderr.slice(decoded.stderr.lastIndexOf('Summary:'));
  const loudness = {
    integratedLUFS: Number(summary.match(/I:\s*(-?[\d.]+)\s+LUFS/)?.[1] ?? NaN),
    rangeLU: Number(summary.match(/LRA:\s*(-?[\d.]+)\s+LU/)?.[1] ?? NaN),
    truePeakDbFS: Number(summary.match(/Peak:\s*(-?[\d.]+)\s+dBFS/)?.[1] ?? NaN),
  };
  report.loudness = loudness;
  check('usable integrated loudness', Number.isFinite(loudness.integratedLUFS) && loudness.integratedLUFS >= -24 && loudness.integratedLUFS <= -9, loudness.integratedLUFS, '-24 to -9 LUFS');
  check('no true-peak overload', Number.isFinite(loudness.truePeakDbFS) && loudness.truePeakDbFS <= 0.1, loudness.truePeakDbFS, '≤0.1 dBFS including measurement rounding');
}

async function audioMeasurements() {
  const result = await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', input, '-vn', '-ac', '2', '-ar', '48000', '-f', 'f32le', 'pipe:1'], { binaryOutput: true });
  const pcm = result.stdout;
  const samplesPerSecond = 48000 * 2;
  const windows = [];
  let peak = 0;
  for (let start = 0; start < pcm.length / 4; start += samplesPerSecond) {
    let power = 0, count = 0, windowPeak = 0;
    for (let index = start; index < Math.min(start + samplesPerSecond, pcm.length / 4); index++) {
      const value = pcm.readFloatLE(index * 4);
      power += value * value;
      windowPeak = Math.max(windowPeak, Math.abs(value));
      count++;
    }
    peak = Math.max(peak, windowPeak);
    const rms = Math.sqrt(power / count);
    windows.push({ startSeconds: start / samplesPerSecond, seconds: count / samplesPerSecond, rms, rmsDbFS: 20 * Math.log10(Math.max(1e-12, rms)), peak: windowPeak });
  }
  report.audioPCM = { decodedSeconds: pcm.length / 4 / samplesPerSecond, samplePeak: peak, windows };
  const fullWindows = windows.filter(window => window.seconds > 0.95);
  check('measurable soundtrack throughout', fullWindows.length >= duration && fullWindows.every(window => window.rms > 0.00001), fullWindows.map(window => ({ second: window.startSeconds, rmsDbFS: window.rmsDbFS })), 'Every complete 1-second window has RMS > -100 dBFS');
  check('no decoded sample clipping', peak < 1.001, peak, 'Absolute decoded PCM peak < 1.001');
  await writeFile(resolve(output, 'audio-rms.json'), JSON.stringify(report.audioPCM, null, 2));
}

async function contactSheet() {
  const cells = [];
  const width = 270, height = 480, labelHeight = 34;
  const dir = resolve(output, 'frames');
  await mkdir(dir, { recursive: true });
  // Sequential extraction avoids overwhelming the encoder while a render is still active.
  for (let index = 0; index < sampleTimes.length; index++) {
    const time = sampleTimes[index];
    const path = resolve(dir, `frame-${String(index + 1).padStart(2, '0')}-${time.toFixed(1)}s.png`);
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', String(time), '-i', input, '-frames:v', '1', '-vf', 'scale=270:480:flags=lanczos', path]);
    cells.push({ input: await sharp(path).png().toBuffer(), top: Math.floor(index / 4) * (height + labelHeight), left: (index % 4) * width });
    const label = Buffer.from(`<svg width="${width}" height="${labelHeight}"><rect width="100%" height="100%" fill="#131d26"/><text x="12" y="23" font-family="Arial" font-size="18" fill="white">${time.toFixed(1)} s</text></svg>`);
    cells.push({ input: label, top: Math.floor(index / 4) * (height + labelHeight) + height, left: (index % 4) * width });
  }
  const path = resolve(output, 'contact-sheet.jpg');
  await sharp({ create: { width: width * 4, height: (height + labelHeight) * 4, channels: 3, background: '#131d26' } }).composite(cells).jpeg({ quality: 92 }).toFile(path);
  report.contactSheet = { path, times: sampleTimes, columns: 4, rows: 4 };
}

function launchServer(size) {
  return new Promise((accept, reject) => {
    const server = createServer((req, res) => {
      const path = new URL(req.url, 'http://127.0.0.1').pathname;
      if (path === '/' || path === '/player') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('<!doctype html><html lang="tr"><meta charset="utf-8"><title>Film export playback check</title><style>html,body{margin:0;background:#142c29;height:100%}video{display:block;height:100vh;width:auto;max-width:100vw;margin:auto}</style><video id="film" src="/film.mp4" controls playsinline preload="auto"></video></html>');
        return;
      }
      if (path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      if (path !== '/film.mp4') { res.writeHead(404); res.end(); return; }
      const match = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      let start = 0, end = size - 1;
      if (req.headers.range && !match) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
      if (match) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1; }
      if (start >= size || end < start) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
      const headers = { 'Content-Type': 'video/mp4', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
      if (match) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      res.writeHead(match ? 206 : 200, headers);
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = createReadStream(input, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => accept({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function browserPlayback() {
  const { server, url } = await launchServer((await stat(input)).size);
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.FILM_BROWSER ?? 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message }));
    page.on('console', message => { if (message.type() === 'error') errors.push({ type: 'console', message: message.text() }); });
    page.on('requestfailed', request => errors.push({ type: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('film').readyState >= 2, null, { timeout: 30000 });
    console.log(`Playing the actual final MP4 from start to finish in Chrome (${duration} seconds).`);
    const playback = await page.evaluate(async ({ duration }) => {
      const video = document.getElementById('film');
      const audio = new AudioContext({ sampleRate: 48000 });
      const source = audio.createMediaElementSource(video);
      const analyzer = audio.createAnalyser();
      analyzer.fftSize = 2048;
      source.connect(analyzer);
      analyzer.connect(audio.destination);
      await audio.resume();
      const samples = [], waveform = new Float32Array(analyzer.fftSize);
      let callbacks = 0, lastPresentedFrame = 0, previousTime = -1, monotonic = true;
      const frame = (_time, metadata) => {
        callbacks++;
        lastPresentedFrame = metadata.presentedFrames;
        if (metadata.mediaTime < previousTime) monotonic = false;
        previousTime = metadata.mediaTime;
        if (!video.ended) video.requestVideoFrameCallback(frame);
      };
      video.requestVideoFrameCallback(frame);
      const interval = setInterval(() => {
        analyzer.getFloatTimeDomainData(waveform);
        let sum = 0;
        for (const value of waveform) sum += value * value;
        samples.push({ time: video.currentTime, rms: Math.sqrt(sum / waveform.length), paused: video.paused, readyState: video.readyState });
      }, 100);
      const started = performance.now();
      let timer;
      try {
        const completed = new Promise((accept, reject) => {
          video.addEventListener('ended', accept, { once: true });
          video.addEventListener('error', () => reject(new Error(video.error?.message ?? 'Media playback error')), { once: true });
          timer = setTimeout(() => reject(new Error('Video did not end within the playback deadline')), duration * 2000 + 1000);
        });
        await video.play();
        await completed;
        const quality = video.getVideoPlaybackQuality();
        return {
          duration: video.duration, width: video.videoWidth, height: video.videoHeight,
          ended: video.ended, currentTime: video.currentTime, muted: video.muted, volume: video.volume,
          mediaError: video.error ? { code: video.error.code, message: video.error.message } : null,
          elapsedSeconds: (performance.now() - started) / 1000,
          totalFrames: quality.totalVideoFrames, droppedFrames: quality.droppedVideoFrames,
          callbacks, lastPresentedFrame, monotonic, decodedAudioBytes: video.webkitAudioDecodedByteCount ?? null,
          audioContextState: audio.state, audioSamples: samples,
        };
      } finally {
        clearTimeout(timer);
        clearInterval(interval);
        await audio.close();
      }
    }, { duration });
    await page.screenshot({ path: resolve(output, 'playback-end.png') });
    report.browser = { browserVersion: browser.version(), ...playback, errors };
    check('browser playback completes', playback.ended && Math.abs(playback.currentTime - duration) < 0.04 && playback.mediaError === null, { ended: playback.ended, currentTime: playback.currentTime, error: playback.mediaError }, `Actual ${duration}-second playback reaches ended`);
    check('browser decoded picture stream', playback.totalFrames >= expected.frames - 2 && playback.totalFrames <= expected.frames + 1 && playback.monotonic, { totalFrames: playback.totalFrames, callbacks: playback.callbacks, monotonic: playback.monotonic }, `${expected.frames - 2}–${expected.frames + 1} decoded browser frames, monotonic media timestamps`);
    check('browser playback errors', errors.length === 0, errors, 'No page, console, request, or media errors');
    const perSecond = Array.from({ length: duration }, (_, second) => {
      const samples = playback.audioSamples.filter(sample => sample.time >= second && sample.time < second + 1);
      return { second, count: samples.length, peakRms: Math.max(0, ...samples.map(sample => sample.rms)) };
    });
    report.browser.audioPerSecond = perSecond;
    check('browser audible sample signal', playback.audioContextState === 'running' && perSecond.every(bin => bin.count > 0 && bin.peakRms > 0.00001), perSecond, 'Web Audio analyser has nonzero signal in every second');
    if (playback.droppedFrames > 8) report.warnings.push(`Browser playback dropped ${playback.droppedFrames} of ${playback.totalFrames} frames on this machine; inspect playback performance separately from encoded frame integrity.`);
    await writeFile(resolve(output, 'browser-playback.json'), JSON.stringify(report.browser, null, 2));
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(accept => server.close(accept));
  }
}

await mkdir(output, { recursive: true });
try {
  await stat(input);
  await probeAndDecode();
  await audioMeasurements();
  await contactSheet();
  await browserPlayback();
} catch (error) {
  report.fatalError = { message: error.message, stack: error.stack };
  if (error.result?.stderr) await writeFile(resolve(output, 'failed-process.log'), error.result.stderr);
}
report.passed = !report.fatalError && report.checks.every(item => item.passed);
await writeFile(resolve(output, 'verification.json'), JSON.stringify(report, null, 2));
const failed = report.checks.filter(item => !item.passed);
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, failed, warnings: report.warnings, fatalError: report.fatalError?.message, evidence: resolve(output, 'verification.json') }, null, 2));
process.exitCode = report.passed ? 0 : 1;
