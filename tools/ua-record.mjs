/** Capture the UA film to a silent H.264 picture track plus review stills. */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';

const lang = process.argv.includes('--en') ? 'en' : 'tr';
const draft = process.argv.includes('--draft');
const root = resolve('campaign-ua');
const ffmpeg = process.env.FFMPEG_PATH || resolve('.tools/video/ffmpeg/package/ffmpeg.exe');
const FPS = 30, DURATION = 30, FRAMES = FPS * DURATION;
const sampleEvery = draft ? 15 : 30;

await access(ffmpeg);
await mkdir(resolve(root, 'review'), { recursive: true });
await mkdir(resolve(root, 'source'), { recursive: true });

const server = await createServer({
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null },
});
await server.listen();
const base = server.resolvedUrls.local[0];

let browser, encoder;
const errors = [];
try {
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    locale: lang === 'en' ? 'en-US' : 'tr-TR',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`${base}reklam-ua.html?capture=1&lang=${lang}`, {
    waitUntil: 'domcontentloaded',
    timeout: 180000,
  });
  await page.waitForFunction(() => window.__ua, null, { timeout: 240000 });
  console.log(`UA film ready (${lang}${draft ? ', draft' : ''}).`);

  const picture = resolve(root, `source/picture-${lang}.mp4`);
  if (!draft) {
    encoder = spawn(ffmpeg, [
      '-y', '-v', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-i', 'pipe:0',
      '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '17',
      '-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      '-movflags', '+faststart', picture,
    ], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    let encodeError = '';
    encoder.stderr.on('data', (b) => { encodeError += b; });
    encoder.stdin.on('error', () => {});
    encoder._done = new Promise((ok, bad) => {
      encoder.on('error', bad);
      encoder.on('exit', (c) => (c === 0 ? ok() : bad(new Error(encodeError || 'ffmpeg exit ' + c))));
    });
    encoder._done.catch(() => {});
  }

  let lastScene = '';
  for (let n = 0; n < FRAMES; n++) {
    const wantStill = n % sampleEvery === 0 || n === FRAMES - 1;
    const data = await page.evaluate(({ render }) => {
      const c = window.__ua;
      if (!c.stepFrame(render)) return null;
      return { report: c.report(), jpeg: render ? c.jpeg() : null };
    }, { render: !draft || wantStill });
    if (!data) throw new Error('Film ended early at frame ' + n);
    if (data.jpeg && encoder) {
      const buf = Buffer.from(data.jpeg, 'base64');
      if (!encoder.stdin.write(buf)) await once(encoder.stdin, 'drain');
    }
    if (data.jpeg && wantStill) {
      await writeFile(
        resolve(root, `review/${lang}-${draft ? 'draft' : 'frame'}-${String(n).padStart(4, '0')}.jpg`),
        Buffer.from(data.jpeg, 'base64'),
      );
    }
    const scene = data.report.scenes?.find((s) => data.report.time >= s.start && data.report.time < s.end)?.id
      || (data.report.time >= 26 ? 'end' : '');
    if (scene && scene !== lastScene) {
      console.log(`Shot ${scene} @ ${data.report.time.toFixed(2)}s money=${Math.round(data.report.money)} guests=${data.report.customers} staff=${data.report.staff?.length ?? 0}`);
      lastScene = scene;
    }
    if (n % 90 === 89) console.log(`Frame ${n + 1}/${FRAMES}`);
  }

  if (encoder) {
    encoder.stdin.end();
    await encoder._done;
    encoder = null;
  }

  const report = await page.evaluate(() => window.__ua.report());
  const result = { ...report, lang, draft, errors, frames: FRAMES };
  await writeFile(resolve(root, `review/${draft ? 'rehearsal' : 'capture'}-${lang}.json`), JSON.stringify(result, null, 2));
  if (errors.length) console.warn('Page errors:\n' + errors.join('\n'));
  console.log(`PASS: ${report.frame} frames, ${(report.frame / FPS).toFixed(2)}s, clean@${report.cleanDoneAt}, unlock@${report.unlockAt}`);
} finally {
  encoder?.kill();
  await browser?.close();
  await server.close();
}
