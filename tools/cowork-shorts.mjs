/**
 * Otonom Viral Shorts / Reels / TikTok Video Fabrikası (Cowork)
 * Mevcut gerçek 1080x1920 oynanış kayıtlarından 3 farklı viral "Hook" (İlk 2 sn kancalı)
 * dikey 9:16 kısa video (.mp4) ve kapak görseli üretir.
 */
import sharp from 'sharp';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ffmpeg = process.env.FFMPEG_PATH || resolve('.tools/video/ffmpeg/package/ffmpeg.exe');
const outDir = resolve('growth-cowork/shorts');

function runFfmpeg(args) {
  return new Promise((ok, bad) => {
    const p = spawn(ffmpeg, args, { windowsHide: true });
    let stderr = '';
    p.stderr.on('data', (b) => { stderr += b; });
    p.on('error', bad);
    p.on('exit', (code) => (code === 0 ? ok() : bad(new Error(stderr.slice(-2000) || `ffmpeg exit ${code}`))));
  });
}

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function makeOverlaySvg({ badge, hookLine1, hookLine2, ctaTitle, ctaSub, accentColor }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <filter id="drop" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>
  <!-- Top Hook Card -->
  <g filter="url(#drop)">
    <rect x="64" y="88" width="952" height="218" rx="34" fill="#102a2e" fill-opacity="0.92" stroke="${accentColor}" stroke-width="5"/>
    <rect x="330" y="64" width="420" height="48" rx="24" fill="${accentColor}"/>
    <text x="540" y="96" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="25" fill="#102a2e" letter-spacing="1.5">${escXml(badge)}</text>
    <text x="540" y="176" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="44" fill="#ffffff">${escXml(hookLine1)}</text>
    <text x="540" y="242" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="42" fill="${accentColor}">${escXml(hookLine2)}</text>
  </g>

  <!-- Bottom Google Play Call-To-Action Pill -->
  <g filter="url(#drop)">
    <rect x="84" y="1640" width="912" height="148" rx="36" fill="#102a2e" fill-opacity="0.94" stroke="#ffffff" stroke-opacity="0.22" stroke-width="3"/>
    <rect x="114" y="1666" width="96" height="96" rx="22" fill="${accentColor}"/>
    <text x="162" y="1732" text-anchor="middle" font-family="Segoe UI Emoji, Arial, sans-serif" font-size="54">☕</text>
    <text x="238" y="1708" font-family="Arial Black, sans-serif" font-weight="900" font-size="34" fill="#ffffff">${escXml(ctaTitle)}</text>
    <text x="238" y="1752" font-family="Arial, sans-serif" font-weight="700" font-size="25" fill="#a8e6cf">${escXml(ctaSub)}</text>
    <rect x="760" y="1676" width="206" height="76" rx="22" fill="#2ecc71"/>
    <text x="863" y="1724" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900" font-size="28" fill="#0b2316">İNDİR ▶</text>
  </g>
</svg>`;
}

const shortsConfig = [
  {
    id: 'short-01-zorluk-kancasi',
    source: resolve('reklam-videosu-kafe-caddesi.mp4'),
    startSec: 2,
    durationSec: 15,
    badge: 'YENİ TÜRK OYUNU 🔥',
    hookLine1: '3. MASADAN SONRA',
    hookLine2: 'YÜZDE 90 BATIYOR! 😱☕',
    ctaTitle: 'Kafe Caddesi: İşletme Oyunu',
    ctaSub: 'Google Play Store • Ücretsiz İndir',
    accentColor: '#ffc44a',
  },
  {
    id: 'short-02-tatmin-edici-servis',
    source: resolve('Kafe-Caddesi-reklam-tr.mp4'),
    startSec: 1,
    durationSec: 15,
    badge: 'SIFIRDAN ZİRVEYE 💸',
    hookLine1: 'KÜÇÜK KAFEYİ DEV',
    hookLine2: 'ZİNCİRE DÖNÜŞTÜR! 🥐✨',
    ctaTitle: 'Kafe Caddesi: İşletme Oyunu',
    ctaSub: 'İnternetsiz & Ücretsiz • Google Play',
    accentColor: '#4cd964',
  },
  {
    id: 'short-03-global-cafe-avenue',
    source: resolve('campaign-kafe-caddesi/reklam-full2.mp4'),
    startSec: 0,
    durationSec: 15,
    badge: 'COZY CAFE TYCOON ☕',
    hookLine1: 'POV: YOU OPENED A TINY',
    hookLine2: 'COFFEE SHOP AT 3 AM 💸',
    ctaTitle: 'Cafe Avenue: Idle Tycoon',
    ctaSub: 'Free on Google Play • No Forced Ads',
    accentColor: '#ff9f43',
  },
];

await mkdir(outDir, { recursive: true });

const manifest = [];
for (const item of shortsConfig) {
  const overlayPng = resolve(outDir, `${item.id}-overlay.png`);
  const outMp4 = resolve(outDir, `${item.id}.mp4`);
  const outThumb = resolve(outDir, `${item.id}-thumb.jpg`);

  const svg = makeOverlaySvg(item);
  await sharp(Buffer.from(svg)).png().toFile(overlayPng);

  await runFfmpeg([
    '-y',
    '-ss', String(item.startSec),
    '-t', String(item.durationSec),
    '-i', item.source,
    '-i', overlayPng,
    '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto[v]',
    '-map', '[v]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '19',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    outMp4,
  ]);

  await runFfmpeg([
    '-y',
    '-ss', '2.5',
    '-i', outMp4,
    '-frames:v', '1',
    '-q:v', '3',
    outThumb,
  ]);

  manifest.push({
    id: item.id,
    videoFile: `shorts/${item.id}.mp4`,
    thumbFile: `shorts/${item.id}-thumb.jpg`,
    durationSec: item.durationSec,
    hook: `${item.hookLine1} ${item.hookLine2}`,
  });
  console.log(`Generated: ${outMp4}`);
}

await writeFile(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('ALL SHORTS GENERATED SUCCESSFULLY.');
