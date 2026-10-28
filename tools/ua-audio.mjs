/** Original 120 BPM ad score and Foley for the UA film. Fully synthesized; no samples. */
import {writeFile} from 'node:fs/promises';

const SR = 48000;
const BPM = 120, BEAT = 60 / BPM;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2147483648 - 1);
}
const phaseRng = rng(1234);
const randomPhase = () => (phaseRng() + 1) / 2;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

class Bus {
  constructor(seconds) {
    this.N = Math.ceil(seconds * SR);
    this.L = new Float32Array(this.N);
    this.R = new Float32Array(this.N);
  }
  /** fn(t, p) -> sample, t seconds since start, p 0..1 progress. */
  add(at, dur, fn, amp = 1, pan = 0) {
    const s0 = Math.round(at * SR), n = Math.round(dur * SR);
    const gl = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
    for (let i = 0; i < n; i++) {
      const j = s0 + i;
      if (j < 0) continue;
      if (j >= this.N) break;
      const v = fn(i / SR, i / n) * amp;
      this.L[j] += v * gl; this.R[j] += v * gr;
    }
  }
  mixInto(dst, gain = 1) {
    for (let i = 0; i < Math.min(this.N, dst.N); i++) { dst.L[i] += this.L[i] * gain; dst.R[i] += this.R[i] * gain; }
  }
}

/* ---------- small DSP helpers ---------- */
function svf(cutoff, q = 0.7) {
  // Topology-preserving state variable filter; cutoff may be a function of time.
  let ic1 = 0, ic2 = 0;
  return (x, fc, mode = 'lp') => {
    const g = Math.tan(Math.PI * clamp(fc ?? cutoff, 20, SR * 0.45) / SR), k = 1 / q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    return mode === 'lp' ? v2 : mode === 'bp' ? v1 : mode === 'hp' ? x - k * v1 - v2 : x;
  };
}
function blepSaw(phase, dt) {
  let v = 2 * phase - 1;
  if (phase < dt) { const t = phase / dt; v -= t + t - t * t - 1; }
  else if (phase > 1 - dt) { const t = (phase - 1) / dt; v -= t * t + t + t + 1; }
  return v;
}
function adsr(t, dur, a, d, s, r) {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * (t - a) / d;
  if (t < dur) return s;
  return Math.max(0, s * (1 - (t - dur) / r));
}

/* ---------- instruments ---------- */
function kick(bus, at, amp = 1) {
  bus.add(at, 0.42, (t) => {
    const f = 46 + 120 * Math.exp(-t * 32);
    const ph = 2 * Math.PI * (46 * t + 120 * (1 - Math.exp(-t * 32)) / 32);
    return Math.tanh(1.6 * Math.sin(ph) * Math.exp(-t * 7.5)) + (t < 0.004 ? (1 - t / 0.004) * 0.6 : 0) * Math.sign(Math.sin(f));
  }, 0.85 * amp);
}
function clap(bus, at, amp = 1, noise) {
  const f = svf(1400, 0.9);
  bus.add(at, 0.3, (t) => {
    const bursts = (t < 0.011 ? 1 : t < 0.022 ? 0.8 : 1) * (t % 0.0105 < 0.006 || t > 0.024 ? 1 : 0.2);
    return f(noise() * bursts, 1500, 'bp') * Math.exp(-t * (t < 0.025 ? 30 : 14)) * 2.2;
  }, 0.5 * amp, 0.05);
}
function hat(bus, at, open, amp = 1, noise, pan = 0.2) {
  const f = svf(8000, 0.8);
  bus.add(at, open ? 0.32 : 0.06, (t) => f(noise(), 9000, 'hp') * Math.exp(-t * (open ? 11 : 70)), (open ? 0.17 : 0.13) * amp, pan);
}
function bass(bus, at, midi, dur, amp = 1) {
  const f = svf(400, 1.4), fr = mtof(midi);
  let ph = 0;
  bus.add(at, dur + 0.05, (t) => {
    ph = (ph + fr / SR) % 1;
    const env = adsr(t, dur, 0.004, 0.12, 0.65, 0.05);
    const raw = blepSaw(ph, fr / SR) * 0.6 + Math.sin(2 * Math.PI * fr * t) * 0.8;
    return Math.tanh(f(raw, 260 + 1500 * Math.exp(-t * 14)) * 1.6) * env;
  }, 0.42 * amp);
}
function supersaw(bus, at, notes, dur, amp, cutoff = 2600) {
  for (let ni = 0; ni < notes.length; ni++) {
    const fr = mtof(notes[ni]);
    for (const [det, pan] of [[-0.11, -0.7], [0.0, 0], [0.12, 0.7]]) {
      const f = svf(cutoff, 0.8), r = fr * 2 ** (det / 12);
      let ph = randomPhase();
      bus.add(at, dur + 0.12, (t) => {
        ph = (ph + r / SR) % 1;
        return f(blepSaw(ph, r / SR), cutoff * (0.55 + 0.45 * Math.exp(-t * 3))) * adsr(t, dur, 0.01, 0.2, 0.55, 0.12);
      }, amp / notes.length, pan * 0.6);
    }
  }
}
function pluck(bus, at, midi, amp = 1, pan = 0, dur = 0.35) {
  const fr = mtof(midi);
  bus.add(at, dur + 0.4, (t) => {
    const e = Math.exp(-t * 7.5) * Math.min(1, t / 0.002);
    const fm = Math.sin(2 * Math.PI * fr * 2 * t) * 1.3 * Math.exp(-t * 12);
    return (Math.sin(2 * Math.PI * fr * t + fm) * 0.8 + Math.sin(2 * Math.PI * fr * 4 * t) * 0.08 * Math.exp(-t * 20)) * e;
  }, 0.3 * amp, pan);
}
function bell(bus, at, midi, amp = 1, pan = 0, decay = 3.5) {
  const fr = mtof(midi);
  bus.add(at, 1.6, (t) => {
    const e = Math.exp(-t * decay) * Math.min(1, t / 0.001);
    return (Math.sin(2 * Math.PI * fr * t) + 0.45 * Math.sin(2 * Math.PI * fr * 2.76 * t) * Math.exp(-t * 6) + 0.25 * Math.sin(2 * Math.PI * fr * 5.4 * t) * Math.exp(-t * 11)) * e;
  }, 0.22 * amp, pan);
}
function noiseSweep(bus, at, dur, f0, f1, amp, noise, shape = 'up', pan = 0) {
  const f = svf(f0, 1.6);
  bus.add(at, dur, (t, p) => {
    const fc = f0 * (f1 / f0) ** p;
    const env = shape === 'up' ? p ** 2.2 : shape === 'down' ? (1 - p) ** 1.6 : Math.sin(Math.PI * p) ** 1.4;
    return f(noise(), fc, 'bp') * env * 1.8;
  }, amp, pan);
}
function impact(bus, at, amp = 1, noise) {
  bus.add(at, 1.4, (t) => Math.sin(2 * Math.PI * (38 * t + 70 * (1 - Math.exp(-t * 9)) / 9)) * Math.exp(-t * 3.2), 0.75 * amp);
  const f = svf(3000, 0.7);
  bus.add(at, 1.2, (t) => f(noise(), 2500 * Math.exp(-t * 2) + 300, 'lp') * Math.exp(-t * 4.5), 0.35 * amp);
}
function crash(bus, at, amp = 1, noise) {
  const f = svf(6000, 0.7);
  bus.add(at, 2.2, (t) => f(noise(), 7000, 'hp') * Math.exp(-t * 1.9), 0.16 * amp, -0.1);
}

/* ---------- score ---------- */
const PROG = [[48, 55, 60, 64, 67], [43, 55, 59, 62, 67], [45, 57, 60, 64, 69], [41, 53, 57, 60, 65]]; // C G Am F
const HOOK_MELODY = [ // [beatOffset, midi, len] over two bars, loops
  [0, 76, .5], [0.5, 79, .5], [1, 84, .75], [2, 83, .5], [2.5, 79, .5], [3, 76, .5], [3.5, 79, .5],
  [4, 81, .5], [4.5, 79, .5], [5, 76, .5], [5.5, 74, .5], [6, 72, .75], [7, 74, .5], [7.5, 76, .5],
];

export function renderMusic(sections, duration, seed = 7) {
  const noise = rng(seed), bus = new Bus(duration), pad = new Bus(duration), drums = new Bus(duration);
  const sec = (name) => sections.find((s) => s.id === name);
  const end = duration;
  const hook = sec('hook'), drop = hook ? hook.end : 3, after = sec('after'), endcard = sec('end');
  const finale = endcard ? endcard.start : end - 4;

  // HOOK: tense filtered stabs on 8ths + riser + reverse swell into the drop.
  for (let b = 0; b * BEAT < drop - 0.01; b++) {
    const at = b * BEAT;
    const ch = PROG[2];
    for (const h of [0, 0.5]) {
      const f = svf(800, 2);
      for (const n of ch.slice(1)) {
        const fr = mtof(n);
        let ph = randomPhase();
        bus.add(at + h * BEAT, 0.16, (t) => { ph = (ph + fr / SR) % 1; return f(blepSaw(ph, fr / SR), 700 + 2600 * (at / drop)) * Math.exp(-t * 22); }, 0.12, (n % 3 - 1) * 0.3);
      }
    }
    if (b % 2 === 0) kick(drums, at, 0.55);
    hat(drums, at + BEAT / 2, false, 0.7, noise, -0.2);
  }
  noiseSweep(bus, Math.max(0, drop - 2), 2, 300, 9000, 0.22, noise, 'up');
  // Snare roll into drop.
  for (let i = 0; i < 8; i++) clap(drums, drop - BEAT * 2 + i * BEAT / 4, 0.25 + i * 0.07, noise);

  // MAIN: four-on-the-floor + bass + chords + hook melody, sidechained by the kick.
  const breakStart = after ? after.start : finale, breakEnd = after ? after.end : finale;
  const beats = Math.ceil((end - drop) / BEAT);
  for (let b = 0; b < beats; b++) {
    const at = drop + b * BEAT;
    if (at >= end - 0.05) break;
    const inBreak = at >= breakStart && at < breakEnd;
    const isFinale = at >= finale;
    const bar = Math.floor(b / 4), ch = PROG[bar % 4];
    if (!inBreak) {
      kick(drums, at, isFinale ? 1.05 : 1);
      if (b % 2 === 1) clap(drums, at, 1, noise);
      hat(drums, at + BEAT / 2, true, 1, noise);
      hat(drums, at + BEAT / 4, false, 0.6, noise, -0.25);
      hat(drums, at + BEAT * 3 / 4, false, 0.6, noise, 0.25);
      bass(bus, at + BEAT / 2, ch[0] - 12 + 12, BEAT / 2 - 0.02, 1);
      bass(bus, at, ch[0] - 12, BEAT / 2 - 0.05, 0.75);
    }
    if (b % 4 === 0) supersaw(pad, at, ch.slice(1), BEAT * 4 - 0.05, inBreak ? 0.18 : 0.26, inBreak ? 1200 : 3200);
    // Hook melody from the second phrase onward, and always in the finale.
    const phrase = Math.floor(b / 8);
    if ((phrase >= 1 && !inBreak) || isFinale) {
      const off = b % 8;
      for (const [o, m, len] of HOOK_MELODY) if (o >= off && o < off + 1) pluck(bus, at + (o - off) * BEAT, m, 1, (m % 2 ? 0.25 : -0.25), len * BEAT);
    } else if (!inBreak && b % 2 === 0) {
      pluck(bus, at + BEAT * 0.5, ch[4] + 12, 0.6, 0.3);
      pluck(bus, at + BEAT * 1.5, ch[3] + 12, 0.5, -0.3);
    }
    if (b % 16 === 0 && !inBreak) crash(drums, at, 0.9, noise);
  }
  // Breakdown (before/after): riser into the payoff, impact on its downbeat.
  if (after) {
    noiseSweep(bus, after.end - 2, 2, 400, 10000, 0.25, noise, 'up');
    for (let i = 0; i < 16; i++) clap(drums, after.end - BEAT * 2 + i * BEAT / 8, 0.15 + i * 0.04, noise);
  }
  // Finale sting: big chord + bells, ringing out.
  const lastAt = Math.max(finale, end - 1.6);
  supersaw(pad, lastAt, [60, 64, 67, 72, 76], 1.5, 0.32, 4200);
  [72, 76, 79, 84].forEach((n, i) => bell(bus, lastAt + i * 0.07, n, 0.8, (i - 1.5) * 0.3, 2.2));

  // Sidechain pump: duck pad/bass on each kick in main sections.
  const pump = new Float32Array(bus.N).fill(1);
  for (let b = 0; b < beats; b++) {
    const at = drop + b * BEAT;
    if (at >= breakStart && at < breakEnd) continue;
    const s0 = Math.round(at * SR), n = Math.round(BEAT * SR);
    for (let i = 0; i < n && s0 + i < pump.length; i++) { const t = i / SR; pump[s0 + i] = 1 - 0.62 * Math.exp(-t * 9); }
  }
  for (let i = 0; i < bus.N; i++) { pad.L[i] *= pump[i]; pad.R[i] *= pump[i]; bus.L[i] *= 0.55 + 0.45 * pump[i]; bus.R[i] *= 0.55 + 0.45 * pump[i]; }
  reverb(pad, 0.22);
  reverb(bus, 0.12);
  const out = new Bus(duration);
  pad.mixInto(out, 0.9); bus.mixInto(out, 1); drums.mixInto(out, 0.95);
  return out;
}

/** Light Schroeder reverb, in-place wet add. */
function reverb(bus, wet) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => ({d, buf: new Float32Array(d), i: 0, f: 0}));
  const aps = [225, 556, 441].map((d) => ({d, buf: new Float32Array(d), i: 0}));
  for (let ch = 0; ch < 2; ch++) {
    const x = ch ? bus.R : bus.L;
    for (const c of combs) { c.buf.fill(0); c.i = 0; c.f = 0; }
    for (const a of aps) { a.buf.fill(0); a.i = 0; }
    for (let n = 0; n < bus.N; n++) {
      const inp = x[n] * 0.12;
      let s = 0;
      for (const c of combs) {
        const y = c.buf[c.i]; c.f = y * 0.75 + c.f * 0.25;
        c.buf[c.i] = inp + c.f * 0.82; c.i = (c.i + 1 + ch * 0) % c.d; s += y;
      }
      for (const a of aps) { const b = a.buf[a.i]; const y = -s * 0.5 + b; a.buf[a.i] = s + b * 0.5; a.i = (a.i + 1) % a.d; s = y; }
      x[n] += s * wet;
    }
  }
}

/* ---------- Foley ---------- */
export function renderSfx(cues, duration, seed = 31) {
  const noise = rng(seed), bus = new Bus(duration);
  let coinN = 0, sparkN = 0;
  for (const c of cues) {
    const t = c.time, pan = clamp(c.pan ?? 0, -0.8, 0.8), g = c.gain ?? 1;
    switch (c.kind) {
      case 'whoosh': noiseSweep(bus, t - 0.18, 0.36, 500, 5000, 0.45 * g, noise, 'mid', pan); break;
      case 'impact': impact(bus, t, g, noise); break;
      case 'stamp': {
        bus.add(t, 0.3, (x) => Math.sin(2 * Math.PI * (70 * x + 160 * (1 - Math.exp(-x * 30)) / 30)) * Math.exp(-x * 11), 0.7 * g);
        const f = svf(2000, 0.8); bus.add(t, 0.12, (x) => f(noise(), 2200, 'bp') * Math.exp(-x * 40), 0.5 * g);
        break;
      }
      case 'pop': {
        const f0 = 500 + 260 * ((c.pitch ?? 0) % 5);
        bus.add(t, 0.12, (x) => Math.sin(2 * Math.PI * (f0 * x + 900 * (1 - Math.exp(-x * 40)) / 40)) * Math.exp(-x * 30), 0.32 * g, pan);
        break;
      }
      case 'coin': {
        const step = coinN++ % 6, base = 88 + [0, 2, 4, 5, 7, 9][step];
        bell(bus, t, base, 0.9 * g, pan, 9); bell(bus, t + 0.05, base + 5, 0.7 * g, -pan, 9);
        break;
      }
      case 'cash': {
        const f = svf(4000, 0.7);
        bus.add(t, 0.09, (x) => f(noise(), 3500, 'bp') * Math.exp(-x * 45), 0.5 * g, pan);
        bell(bus, t + 0.06, 96, 1.1 * g, pan, 4); bell(bus, t + 0.06, 100, 0.8 * g, pan, 4); bell(bus, t + 0.14, 103, 0.7 * g, -pan, 3.5);
        break;
      }
      case 'sparkle': {
        const k = sparkN++;
        for (let i = 0; i < 4; i++) bell(bus, t + i * 0.035, 96 + [0, 4, 7, 12][i] + (k % 3), 0.35 * g, (i % 2 ? 0.5 : -0.5), 10);
        break;
      }
      case 'clean': [84, 88, 91, 96].forEach((n, i) => bell(bus, t + i * 0.055, n, 0.75 * g, (i - 1.5) * 0.2, 5)); break;
      case 'levelup': [72, 76, 79, 84, 88].forEach((n, i) => { pluck(bus, t + i * 0.06, n, 1.2 * g, (i - 2) * 0.2, 0.3); }); bell(bus, t + 0.3, 96, 0.8 * g, 0, 3); break;
      case 'unlock': impact(bus, t, 0.7 * g, noise); [67, 72, 76, 79, 84].forEach((n, i) => bell(bus, t + 0.05 + i * 0.05, n, 0.9 * g, (i - 2) * 0.25, 2.5)); break;
      case 'hire': [76, 79, 84].forEach((n, i) => pluck(bus, t + i * 0.08, n, 1.3 * g, (i - 1) * 0.3, 0.4)); break;
      case 'combo': { const n = 79 + Math.min(12, (c.level ?? 1) * 2); pluck(bus, t, n, 1.4 * g, pan, 0.25); bell(bus, t + 0.02, n + 12, 0.5 * g, pan, 8); break; }
      case 'tap': bus.add(t, 0.05, (x) => (noise() * 0.4 + Math.sin(2 * Math.PI * 1800 * x)) * Math.exp(-x * 120), 0.35 * g, pan); break;
      case 'button': bus.add(t, 0.15, (x) => Math.sin(2 * Math.PI * (900 * x + 400 * (1 - Math.exp(-x * 25)) / 25)) * Math.exp(-x * 22), 0.35 * g); break;
      case 'alarm': for (let i = 0; i < (c.count ?? 2); i++) { const f0 = i % 2 ? 660 : 880; bus.add(t + i * 0.25, 0.2, (x) => Math.sign(Math.sin(2 * Math.PI * f0 * x)) * 0.5 * Math.min(1, x / 0.005, (0.2 - x) / 0.02), 0.11 * g, pan); } break;
      case 'grumble': {
        const f = svf(300, 3); const f2 = svf(700, 4);
        bus.add(t, c.dur ?? 1.2, (x, p) => { const n = noise(); return (f(n, 260 + 80 * Math.sin(x * 9), 'bp') * 1.5 + f2(n, 650 + 120 * Math.sin(x * 6.3), 'bp')) * Math.sin(Math.PI * p) ** 0.5 * (0.6 + 0.4 * Math.sin(x * 23)); }, 0.35 * g, pan);
        break;
      }
      case 'vacuum': {
        const f = svf(1200, 1.2), dur = c.dur ?? 1;
        bus.add(t, dur, (x, p) => {
          const env = Math.min(1, x / 0.15, (dur - x) / 0.2);
          const motor = Math.sin(2 * Math.PI * 118 * x) * 0.25 + Math.sin(2 * Math.PI * 236 * x) * 0.12;
          return (f(noise(), 900 + 500 * Math.sin(x * 2.1), 'bp') * 1.3 + motor) * env;
        }, 0.22 * g, pan);
        break;
      }
      case 'swish': noiseSweep(bus, t, 0.2, 2000, 7000, 0.25 * g, noise, 'mid', pan); break;
      case 'scratch': {
        const f = svf(1000, 2);
        bus.add(t, 0.35, (x, p) => f(noise(), 600 + 2400 * Math.abs(Math.sin(p * Math.PI * 2.5)), 'bp') * (1 - p), 0.6 * g);
        break;
      }
      default: break;
    }
  }
  return bus;
}

export function mixBuses(music, sfx, duration, musicGain = 0.72, sfxGain = 1.15) {
  const out = new Bus(duration);
  music.mixInto(out, musicGain);
  sfx.mixInto(out, sfxGain);
  return out;
}

export async function writeWav(path, bus, gain = 1) {
  const N = bus.N, pcm = Buffer.alloc(N * 4);
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(bus.L[i]), Math.abs(bus.R[i]));
  const norm = peak > 0 ? Math.min(1, 0.98 / (peak * gain)) * gain : 1;
  for (let i = 0; i < N; i++) {
    const fade = Math.min(1, i / (SR * 0.003), (N - i) / (SR * 0.25));
    pcm.writeInt16LE(Math.round(clamp(bus.L[i] * norm * fade, -1, 1) * 32000), i * 4);
    pcm.writeInt16LE(Math.round(clamp(bus.R[i] * norm * fade, -1, 1) * 32000), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF'); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  await writeFile(path, Buffer.concat([h, pcm]));
  return {peak, norm};
}
