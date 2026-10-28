/** Mix the UA score against captured cues and mux the store-ready master. */
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { renderMusic, renderSfx, mixBuses, writeWav } from './ua-audio.mjs';

const lang = process.argv.includes('--en') ? 'en' : 'tr';
const root = resolve('campaign-ua');
const ffmpeg = process.env.FFMPEG_PATH || resolve('.tools/video/ffmpeg/package/ffmpeg.exe');
const ffprobe = process.env.FFPROBE_PATH || resolve('.tools/video/ffprobe/package/ffprobe.exe');

function run(exe, args) {
  return new Promise((ok, bad) => {
    const p = spawn(exe, args, { windowsHide: true });
    let stdout = '', stderr = '';
    p.stdout.on('data', (b) => { stdout += b; });
    p.stderr.on('data', (b) => { stderr += b; });
    p.on('error', bad);
    p.on('exit', (c) => (c === 0 ? ok({ stdout, stderr }) : bad(new Error(stderr.slice(-4000) || 'exit ' + c))));
  });
}

await mkdir(resolve(root, 'audio'), { recursive: true });
const report = JSON.parse(await readFile(resolve(root, `review/capture-${lang}.json`), 'utf8'));
const duration = report.frame / 30;
const sections = report.scenes;
const cues = report.cues ?? [];

const music = renderMusic(sections, duration);
const sfx = renderSfx(cues, duration);
const mix = mixBuses(music, sfx, duration, 0.7, 1.2);
const musicPath = resolve(root, `audio/music-${lang}.wav`);
const sfxPath = resolve(root, `audio/sfx-${lang}.wav`);
const mixPath = resolve(root, `audio/mix-${lang}.wav`);
await writeWav(musicPath, music);
await writeWav(sfxPath, sfx);
await writeWav(mixPath, mix);
console.log(`Score written: ${cues.length} cues, ${duration.toFixed(2)}s`);

const picture = resolve(root, `source/picture-${lang}.mp4`);
const master = resolve(root, `Kafe-Caddesi-reklam-${lang}.mp4`);
const fadeStart = Math.max(0, duration - 0.22);
const mixLog = await run(ffmpeg, [
  '-y', '-hide_banner',
  '-i', picture,
  '-i', mixPath,
  '-map', '0:v:0', '-map', '1:a:0',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
  '-pix_fmt', 'yuv420p',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-af', `loudnorm=I=-14:TP=-1.5:LRA=9,afade=t=out:st=${fadeStart}:d=0.2`,
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
  '-t', String(duration),
  '-movflags', '+faststart',
  master,
]);
await writeFile(resolve(root, `review/mix-${lang}.log`), mixLog.stderr);

const probe = JSON.parse((await run(ffprobe, [
  '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', master,
])).stdout);
const v = probe.streams.find((s) => s.codec_type === 'video');
const a = probe.streams.find((s) => s.codec_type === 'audio');
if (!v || v.width !== 1080 || v.height !== 1920) throw new Error('Bad video geometry');
if (!a || a.codec_name !== 'aac') throw new Error('Bad audio');

const qc = await run(ffmpeg, [
  '-hide_banner', '-i', master,
  '-vf', 'blackdetect=d=0.04:pix_th=0.05:pic_th=0.98,freezedetect=n=0.0001:d=1.2',
  '-af', 'ebur128=peak=true',
  '-f', 'null', '-',
]);
await writeFile(resolve(root, `review/technical-qc-${lang}.log`), qc.stderr);

const easy = resolve(`Kafe-Caddesi-reklam-${lang}.mp4`);
await copyFile(master, easy);
await writeFile(resolve(root, `review/video-verification-${lang}.json`), JSON.stringify({
  passed: true, lang, duration, frames: report.frame, master, probe: { v: { width: v.width, height: v.height, fps: v.avg_frame_rate }, a: { codec: a.codec_name, rate: a.sample_rate } },
  cues: cues.length, cleanDoneAt: report.cleanDoneAt, unlockAt: report.unlockAt,
}, null, 2));
console.log(`Master: ${master}`);
console.log(`Copy:   ${easy}`);
