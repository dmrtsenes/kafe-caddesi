import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const phase = process.argv.includes('--before') ? 'before' : 'after';
const output = '.devshots/vacuum-audio'; await mkdir(output, { recursive: true });
const server = await createServer({ cacheDir: output + '/vite-cache', server: { host: '127.0.0.1', port: 5355, strictPort: true, open: false, hmr: false }, plugins: [{ name: 'audio-stage', configureServer(server) {
  server.middlewares.use('/__sound', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Vacuum sound check</title>'); });
} }] });
let browser;
try {
  await server.listen(); browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5355/__sound');
  const result = await page.evaluate(async () => {
    const { createAudio } = await import('/src/audio/AudioManager.ts');
    const ctx = new OfflineAudioContext(1, 24000 * 6, 24000);
    // The production manager gates browser playback state. Offline scheduling
    // uses the same graph and automation while suspending at deterministic times.
    Object.defineProperty(ctx, 'state', { get: () => 'running' });
    let seed = 98765; const originalRandom = Math.random;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const audio = createAudio(); audio.setMusicEnabled(false); audio.build(ctx); Math.random = originalRandom;
    audio.setVacuum(1, 0);
    const jobs = [ctx.suspend(2).then(() => { audio.setVacuum(1, 1); return ctx.resume(); }), ctx.suspend(4).then(() => { audio.setVacuum(0, 0); return ctx.resume(); })];
    const buffer = await ctx.startRendering(); await Promise.all(jobs);
    const values = buffer.getChannelData(0), sr = buffer.sampleRate;
    const rms = (a, b) => { let sum = 0; for (let i = a * sr; i < b * sr; i++) sum += values[i] * values[i]; return Math.sqrt(sum / ((b - a) * sr)); };
    let peak = 0, maxStep = 0;
    for (let i = 1; i < values.length; i++) { peak = Math.max(peak, Math.abs(values[i])); maxStep = Math.max(maxStep, Math.abs(values[i] - values[i - 1])); }
    const pcm = new Int16Array(values.length); for (let i = 0; i < values.length; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, values[i])) * 32767);
    const bytes = new Uint8Array(pcm.buffer); let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { pcm: btoa(binary), sr, peak, maxStep, idleRms: rms(1, 2), cleaningRms: rms(3, 4), stoppedRms: rms(5, 6) };
  });
  const pcm = Buffer.from(result.pcm, 'base64'), header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(result.sr, 24); header.writeUInt32LE(result.sr * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  await writeFile(output + '/' + phase + '.wav', Buffer.concat([header, pcm]));
  delete result.pcm;
  await writeFile(output + '/' + phase + '.json', JSON.stringify({ ...result, errors }, null, 2));
  console.log(JSON.stringify({ phase, ...result, errors }));
  assert.ok(result.idleRms > .001 && result.cleaningRms > .001);
  assert.ok(result.peak < .5); assert.ok(result.stoppedRms < 1e-7); assert.deepEqual(errors, []);
} finally { await browser?.close(); await server.close(); }
