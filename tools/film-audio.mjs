/** 27-second Kafe Caddesi film score. Original synthesis; no third-party samples. */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { renderMusic, renderSfx } from './ua-audio.mjs';

const SR = 48000, DURATION = 27, BEAT = .5;
const output = resolve('campaign-film/audio');
const ffmpeg = process.env.FFMPEG_PATH || resolve('.tools/video/ffmpeg/package/ffmpeg.exe');
const ffprobe = process.env.FFPROBE_PATH || resolve('.tools/video/ffprobe/package/ffprobe.exe');
const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
const smooth = (a, b, x) => { const p = clamp((x - a) / (b - a), 0, 1); return p * p * (3 - 2 * p); };
const mtof = (midi) => 440 * 2 ** ((midi - 69) / 12);
function rng(seed) { let state = seed >>> 0; return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2147483648 - 1); }

class Bus {
  constructor(seconds = DURATION) { this.N = Math.round(seconds * SR); this.L = new Float32Array(this.N); this.R = new Float32Array(this.N); }
  add(at, duration, waveform, level = 1, pan = 0) {
    const start = Math.round(at * SR), length = Math.round(duration * SR);
    const left = Math.cos((pan + 1) * Math.PI / 4), right = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < length; i++) {
      const j = start + i;
      if (j < 0) continue;
      if (j >= this.N) break;
      const sample = waveform(i / SR, i / length) * level;
      this.L[j] += sample * left; this.R[j] += sample * right;
    }
  }
  mix(source, gain = 1) { for (let i = 0; i < Math.min(source.N, this.N); i++) { this.L[i] += source.L[i] * gain; this.R[i] += source.R[i] * gain; } }
}

function filter(cutoff, q = .7) {
  let z1 = 0, z2 = 0;
  return (sample, frequency = cutoff, mode = 'lp') => {
    const g = Math.tan(Math.PI * clamp(frequency, 20, SR * .42) / SR), k = 1 / q;
    const a = 1 / (1 + g * (g + k)), b = g * a, c = g * b;
    const v3 = sample - z2, v1 = a * z1 + b * v3, v2 = z2 + b * z1 + c * v3;
    z1 = 2 * v1 - z1; z2 = 2 * v2 - z2;
    return mode === 'bp' ? v1 : mode === 'hp' ? sample - k * v1 - v2 : v2;
  };
}

function epiano(bus, at, midi, duration, level = .2, pan = 0) {
  const hz = mtof(midi);
  bus.add(at, duration + .5, (t) => {
    const env = Math.min(1, t / .006) * Math.exp(-t * 2.2) * (1 - smooth(duration, duration + .5, t));
    const mod = 1.3 * Math.sin(2 * Math.PI * hz * 2 * t) * Math.exp(-t * 7);
    return (Math.sin(2 * Math.PI * hz * t + mod) + .18 * Math.sin(2 * Math.PI * hz * 3 * t) * Math.exp(-t * 4)) * env;
  }, level, pan);
}
function woodPluck(bus, at, midi, level = .3, pan = 0, duration = .8) {
  const hz = mtof(midi);
  bus.add(at, duration, (t, p) => {
    const attack = Math.min(1, t / .0018), tail = Math.exp(-t * 7) * (1 - smooth(.75, 1, p));
    return (Math.sin(2 * Math.PI * hz * t) + .35 * Math.sin(2 * Math.PI * hz * 3 * t) * Math.exp(-t * 14)
      + .09 * Math.sin(2 * Math.PI * hz * 7 * t) * Math.exp(-t * 25)) * attack * tail;
  }, level, pan);
}
function pad(bus, at, notes, duration, level = .12) {
  notes.forEach((note, index) => {
    const hz = mtof(note);
    bus.add(at, duration + .4, (t) => {
      const env = smooth(0, .15, t) * (1 - smooth(duration - .15, duration + .4, t));
      return (Math.sin(2 * Math.PI * hz * t) + .34 * Math.sin(2 * Math.PI * hz * 1.002 * t) + .12 * Math.sin(2 * Math.PI * hz * 2 * t)) * env;
    }, level / notes.length, (index % 2 ? .5 : -.5));
  });
}
function airySweep(bus, at, duration, level = .2, rising = true, pan = 0) {
  const noise = rng(Math.round(at * 701 + duration * 13 + 49)), f = filter(1000, 1.2);
  bus.add(at, duration, (t, p) => {
    const position = rising ? p : 1 - p;
    const envelope = Math.sin(Math.PI * p) ** 1.6;
    return f(noise(), 400 * 22 ** position, 'bp') * envelope;
  }, level, pan);
}
function ceramic(bus, at, level, pan = 0, pitch = 1) {
  const noise = rng(Math.round(at * 10000)), f = filter(2700, .8);
  bus.add(at, .52, (t, p) => {
    const partials = [[1730, 1, 27], [2741, .45, 32], [4198, .23, 43], [718, .3, 22]];
    let sound = 0;
    for (const [hz, amp, decay] of partials) sound += Math.sin(2 * Math.PI * hz * pitch * t) * amp * Math.exp(-t * decay);
    return (sound * .48 + f(noise()) * Math.exp(-t * 140) * .4) * Math.min(1, t / .0005) * (1 - smooth(.75, 1, p));
  }, level, pan);
}
function drop(bus, at, pitch, level = .2, pan = 0) {
  bus.add(at, .18, (t) => {
    const phase = 2 * Math.PI * (pitch * t + 640 * (1 - Math.exp(-t * 27)) / 27);
    return Math.sin(phase) * Math.exp(-t * 30) * Math.min(1, t / .001);
  }, level, pan);
}
function kick(bus, at, level = .5) {
  bus.add(at, .38, (t) => Math.sin(2 * Math.PI * (49 * t + 104 * (1 - Math.exp(-t * 32)) / 32)) * Math.exp(-t * 10) * Math.min(1, t / .001), level);
}
function shaker(bus, at, level, pan) {
  const n = rng(Math.round(at * 4821 + 34)), f = filter(6200, .7);
  bus.add(at, .065, (t, p) => f(n(), 6200, 'hp') * Math.sin(Math.PI * p) ** 1.8, level, pan);
}
function delay(bus, seconds, feedback, repetitions = 2) {
  const left = bus.L.slice(), right = bus.R.slice();
  for (let repeat = 1; repeat <= repetitions; repeat++) {
    const offset = Math.round(seconds * SR * repeat), gain = feedback ** repeat;
    for (let i = offset; i < bus.N; i++) { bus.L[i] += (repeat % 2 ? right : left)[i - offset] * gain; bus.R[i] += (repeat % 2 ? left : right)[i - offset] * gain; }
  }
}

function createMusic() {
  const music = new Bus(), accents = new Bus();
  // Existing original score provides the 120 BPM rhythmic body only.
  const body = renderMusic([{ id: 'hook', start: 0, end: 5 }, { id: 'end', start: 30, end: 32 }], 32, 173);
  const bodyFilterL = filter(7600), bodyFilterR = filter(7600);
  for (let i = 5 * SR; i < 23 * SR; i++) {
    const t = i / SR;
    let gain = .42 * smooth(5, 5.009, t) * (1 - smooth(22.9, 23, t));
    for (const hit of [14, 18, 23]) gain *= 1 - .62 * smooth(hit - .14, hit - .07, t) * (1 - smooth(hit, hit + .18, t));
    if (t > 14 && t < 15.5) gain *= .82;
    music.L[i] = bodyFilterL(body.L[i]) * gain;
    music.R[i] = bodyFilterR(body.R[i]) * gain;
  }
  // Opening: a curious musical question leaves space for detailed cup Foley.
  pad(music, 0, [57, 64, 69, 71], 2.22, .19);
  [[.05, 81], [.55, 76], [1.05, 81], [1.42, 83], [1.8, 84], [2.1, 83]].forEach(([at, midi], i) => woodPluck(accents, at, midi, .13 + i * .008, (i % 2 ? .35 : -.35)));
  epiano(music, 0, 45, 1.85, .1);
  airySweep(music, .8, 1.42, .11, true, -.15);
  // Freeze: nearly silent bed, followed by a relieved tonic response.
  pad(music, 2.32, [64, 71, 76], .85, .025);
  [60, 64, 67, 72].forEach((n, i) => epiano(accents, 3.51 + i * .025, n, 1.1, .14, (i - 1.5) * .17));
  [[3.53, 76], [3.77, 79], [4.02, 84], [4.27, 88]].forEach(([t, midi]) => woodPluck(accents, t, midi, .18, .18));
  airySweep(music, 4.25, .75, .23, true);
  // Warm, organic counter-rhythm softens the electronic body.
  const chords = [[60, 64, 67, 71], [59, 62, 67, 69], [60, 64, 69, 72], [57, 60, 65, 69]];
  for (let bar = 0; bar < 9; bar++) {
    const at = 5 + bar * 2, chord = chords[bar % 4];
    chord.forEach((note, i) => epiano(accents, at + .25 + i * .014, note, .7, .065, (i - 1.5) * .3));
    chord.forEach((note, i) => epiano(accents, at + 1.5 + i * .014, note, .35, .05, (1.5 - i) * .3));
    for (let tick = 0; tick < 8; tick++) shaker(music, at + tick * .25 + .125, tick % 2 ? .025 : .019, tick % 2 ? -.45 : .45);
  }
  for (const at of [5, 14, 18]) {
    kick(music, at, at === 5 ? .4 : .32);
    airySweep(music, at, .6, .13, false);
  }
  // Brand cadence: a clear C-major resolution lands exactly on the end card.
  pad(music, 23, [48, 60, 64, 67, 72], 3.6, .32);
  [48, 60, 64, 67, 72].forEach((note, i) => epiano(accents, 23 + i * .013, note, 2.1, .13, (i - 2) * .2));
  [[23.02, 76], [23.27, 79], [23.52, 84], [24.02, 83], [24.27, 79], [24.52, 76], [25.02, 74], [25.27, 76], [25.52, 79], [26.02, 84]]
    .forEach(([at, midi], i) => woodPluck(accents, at, midi, i === 9 ? .28 : .2, i % 2 ? .25 : -.25, 1));
  for (const at of [23, 23.5, 24, 24.5, 25, 25.5]) kick(music, at, .24);
  for (let i = 0; i < 12; i++) shaker(music, 23.25 + i * .25, .035, i % 2 ? .3 : -.3);
  delay(accents, .1875, .15, 2);
  music.mix(accents, .75);
  for (let i = 0; i < music.N; i++) {
    const t = i / SR, fade = smooth(0, .006, t) * (1 - smooth(26.55, 27, t));
    music.L[i] *= fade; music.R[i] *= fade;
  }
  return music;
}

function remapCues(cues) {
  const mapped = [];
  for (const cue of cues) {
    const t = cue.time;
    if (t >= 4 && t < 13) mapped.push({ ...cue, time: +(t + 1).toFixed(4) });
    else if (t >= 14 && t < 23) mapped.push({ ...cue });
  }
  const deduped = mapped.filter((cue, index) => !mapped.slice(0, index).some((prior) => prior.kind === cue.kind && Math.abs(prior.time - cue.time) < .003));
  for (const cue of deduped) {
    const g = cue.gain ?? 1;
    cue.gain = g * (cue.kind === 'stamp' ? .4 : cue.kind === 'coin' ? .64 : cue.kind === 'combo' ? .65 : .8);
  }
  deduped.push(
    { time: 5, kind: 'impact', gain: .28 },
    { time: 5.07, kind: 'vacuum', dur: 3.68, gain: .63 },
    { time: 13.99, kind: 'whoosh', gain: .45 },
    { time: 23, kind: 'impact', gain: .28 },
    { time: 23.05, kind: 'levelup', gain: .48 },
    { time: 24.05, kind: 'sparkle', gain: .28 },
    { time: 25.15, kind: 'tap', gain: .4 },
    { time: 25.17, kind: 'button', gain: .22 }
  );
  return deduped.sort((a, b) => a.time - b.time);
}

function createSfx(cues) {
  const sfx = new Bus(), foley = new Bus();
  sfx.mix(renderSfx(cues, DURATION, 97), .72);
  airySweep(foley, 0, .47, .48, true, -.25);
  // Ceramic cup rocks, then speeds up as gravity wins.
  [[.66, .5], [.92, .38], [1.1, .31], [1.22, .25]].forEach(([t, gain], i) => ceramic(foley, t, gain, (i % 2 ? .2 : -.2), 1 + i * .06));
  airySweep(foley, 1.25, .95, .19, false, .12);
  [[1.32, 760], [1.43, 1120], [1.59, 990], [1.79, 1370], [1.96, 1080]].forEach(([t, hz], i) => drop(foley, t, hz, .13, -.4 + i * .2));
  ceramic(foley, 2.28, .11, 0, .68);
  // Rescued, placed gently, and rewarded with a warm glass-like resonance.
  ceramic(foley, 3.5, .45, 0, .9);
  kick(foley, 3.5, .08);
  [84, 88, 91].forEach((midi, i) => woodPluck(foley, 3.55 + i * .04, midi, .26, (i - 1) * .25, 1));
  airySweep(foley, 4.58, .4, .36, true);
  // Crisp water swishes track the cleaning pass without obscuring the music.
  for (const at of [5.24, 5.91, 6.58, 7.25, 7.9]) airySweep(foley, at, .19, .12, false, at % 1 > .5 ? -.25 : .25);
  delay(foley, .041, .1, 1);
  sfx.mix(foley, 1);
  for (let i = 0; i < sfx.N; i++) {
    const t = i / SR, fade = smooth(0, .002, t) * (1 - smooth(26.65, 27, t));
    sfx.L[i] *= fade; sfx.R[i] *= fade;
  }
  return sfx;
}

async function writeFloatWav(filename, bus) {
  const data = Buffer.alloc(bus.N * 8), header = Buffer.alloc(44);
  for (let i = 0; i < bus.N; i++) {
    if (!Number.isFinite(bus.L[i]) || !Number.isFinite(bus.R[i])) throw new Error(`Nonfinite audio sample at ${i}`);
    data.writeFloatLE(bus.L[i], i * 8); data.writeFloatLE(bus.R[i], i * 8 + 4);
  }
  header.write('RIFF'); header.writeUInt32LE(data.length + 36, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20); header.writeUInt16LE(2, 22); header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 8, 28);
  header.writeUInt16LE(8, 32); header.writeUInt16LE(32, 34); header.write('data', 36); header.writeUInt32LE(data.length, 40);
  await writeFile(filename, Buffer.concat([header, data]));
}

function run(executable, args) {
  return new Promise((done, fail) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (b) => stdout += b); child.stderr.on('data', (b) => stderr += b);
    child.on('error', fail); child.on('exit', (code) => code === 0 ? done({ stdout, stderr }) : fail(new Error(`${executable} exited ${code}: ${stderr}`)));
  });
}
function loudnessJson(stderr) {
  const block = stderr.match(/\{\s*"input_i"[\s\S]*?\}/g)?.at(-1);
  if (!block) throw new Error('FFmpeg did not report loudness analysis');
  return JSON.parse(block);
}
async function master(input, destination, target, processing) {
  const common = ['-hide_banner', '-i', input];
  const meter = `loudnorm=I=${target}:TP=-1.4:LRA=9`;
  const first = await run(ffmpeg, [...common, '-af', `${processing},${meter}:print_format=json`, '-f', 'null', '-']);
  const measure = loudnessJson(first.stderr);
  const normalize = `${meter}:measured_I=${measure.input_i}:measured_TP=${measure.input_tp}:measured_LRA=${measure.input_lra}:measured_thresh=${measure.input_thresh}:offset=${measure.target_offset}:linear=true:print_format=json`;
  const second = await run(ffmpeg, ['-y', ...common, '-af', `${processing},${normalize}`, '-c:a', 'pcm_s16le', '-ar', String(SR), '-ac', '2', destination]);
  const check = await run(ffmpeg, ['-hide_banner', '-i', destination, '-af', `${meter}:print_format=json`, '-f', 'null', '-']);
  const verified = loudnessJson(check.stderr);
  const probe = JSON.parse((await run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', destination])).stdout);
  if (Math.abs(Number(probe.format.duration) - DURATION) > .001 || probe.streams[0].sample_rate !== String(SR) || probe.streams[0].channels !== 2) throw new Error(`Wrong audio format: ${destination}`);
  if (Number(verified.input_tp) > -1.15) throw new Error(`Master peak exceeds margin: ${verified.input_tp}`);
  return { targetLUFS: target, measuredLUFS: Number(verified.input_i), truePeakDBTP: Number(verified.input_tp), loudnessRangeLU: Number(verified.input_lra), duration: Number(probe.format.duration), sampleRate: SR, channels: 2, mastering: loudnessJson(second.stderr) };
}

await mkdir(output, { recursive: true });
await access(ffmpeg); await access(ffprobe);
const originalCapture = JSON.parse(await readFile('campaign-ua/review/capture-tr.json', 'utf8'));
const cues = remapCues(originalCapture.cues), music = createMusic(), sfx = createSfx(cues), mix = new Bus();
mix.mix(music, 1); mix.mix(sfx, .78);
await writeFloatWav(resolve(output, 'music-source.wav'), music);
await writeFloatWav(resolve(output, 'sfx-source.wav'), sfx);
await writeFloatWav(resolve(output, 'mix-source.wav'), mix);
const metrics = {};
metrics.music = await master(resolve(output, 'music-source.wav'), resolve(output, 'music.wav'), -18, 'highpass=f=34,lowpass=f=16000');
metrics.sfx = await master(resolve(output, 'sfx-source.wav'), resolve(output, 'sfx.wav'), -21, 'highpass=f=42,lowpass=f=16500');
metrics.mix = await master(resolve(output, 'mix-source.wav'), resolve(output, 'mix.wav'), -15, 'highpass=f=34,lowpass=f=17000,acompressor=threshold=0.62:ratio=2.2:attack=5:release=90:makeup=1');
const source = await readFile(resolve('tools/ua-audio.mjs'));
const provenance = {
  title: 'Kafe Caddesi — One Little Save', durationSeconds: DURATION, bpm: 120,
  source: 'Original synthesized composition and Foley. Remixed original tools/ua-audio.mjs rhythmic score, with bespoke opening, ceramic and liquid Foley, electric-piano accompaniment, transition accents, and a new tonic end-card cadence.',
  generator: 'tools/film-audio.mjs', synthesisSource: 'tools/ua-audio.mjs', synthesisSourceSHA256: createHash('sha256').update(source).digest('hex'),
  credentials: { provider: 'ElevenLabs', processProbe: 'MISSING', projectDotEnvProbe: 'MISSING', powershellProfilesPresent: false, generationAttempted: false },
  thirdPartySamples: [], voice: null, externalServiceAudio: false,
  arrangement: [
    { start: 0, end: 2.3, action: 'Ceramic teeter and liquid drops; curious minor tension' },
    { start: 2.3, end: 3.5, action: 'Freeze and tension hold' },
    { start: 3.5, end: 5, action: 'Cup lands; warm major response and accelerating sweep' },
    { start: 5, end: 9, action: '120 BPM drop; cleaning swishes and success cues' },
    { start: 9, end: 14, action: 'Serving combo; exact remapped source gameplay cues' },
    { start: 14, end: 15.5, action: 'Cash accent and register cascade' },
    { start: 15.5, end: 18, action: 'Upgrade confirmation cues' },
    { start: 18, end: 20.5, action: 'Expansion impact and unlock cadence' },
    { start: 20.5, end: 23, action: 'Staff hiring motif' },
    { start: 23, end: 27, action: 'C-major brand resolution and inviting end-card motif' }
  ],
  cueSource: 'campaign-ua/review/capture-tr.json', cues,
  mixSourceLevels: { music: 1, sfx: .78 },
  delivery: { format: 'PCM signed 16-bit little endian WAV', sampleRate: SR, channels: 2, music: 'music.wav', effects: 'sfx.wav', mixed: 'mix.wav' },
  metrics,
  validation: { method: 'FFmpeg two-pass loudness normalization, true-peak analysis, decoded stream format and duration validation', humanListening: false, limitation: 'Technical waveform/loudness validation only; no listening tool was available in this session.' }
};
await writeFile(resolve(output, 'provenance.json'), JSON.stringify(provenance, null, 2));
console.log(JSON.stringify({ output, metrics }, null, 2));
