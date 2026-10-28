/** Original, event-synchronised soundtrack; no downloaded or licensed music. */
import { writeFile } from "node:fs/promises";
export async function makePromoAudio(
  events,
  output,
  duration = 25,
  utopia = false,
  flagship = false,
) {
  const sr = 48000,
    length = Math.round(duration * sr),
    L = new Float32Array(length),
    R = new Float32Array(length);
  let seed = 137;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
  const note = (n) =>
    440 * 2 ** ((n + (utopia ? 2 : flagship ? -5 : 0) - 69) / 12);
  function sound(at, duration, fn, amp = 0.1, pan = 0) {
    const start = Math.round(at * sr),
      n = Math.round(duration * sr),
      gl = Math.sqrt((1 - pan) / 2),
      gr = Math.sqrt((1 + pan) / 2);
    for (let i = 0; i < n; i++) {
      const index = start + i;
      if (index < 0 || index >= length) continue;
      const t = i / sr,
        s = fn(t, i / n) * amp;
      L[index] += s * gl;
      R[index] += s * gr;
    }
  }
  function pluck(at, midi, amp = 0.08, pan = 0, duration = 0.6) {
    const f = note(midi);
    sound(
      at,
      duration,
      (t) =>
        Math.min(1, t / 0.005) *
        Math.exp(-t * (flagship ? 4.8 : 6.5)) *
        (Math.sin(2 * Math.PI * f * t) +
          0.28 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t * 7) +
          0.11 * Math.sin(6 * Math.PI * f * t)),
      amp,
      pan,
    );
  }
  const beat = 60 / (utopia ? 104 : flagship ? 116 : 112),
    chords = [
      [60, 64, 67, 71],
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [55, 59, 62, 67],
    ];
  for (let b = 0; b * beat < 22; b++) {
    const at = b * beat,
      chord = chords[Math.floor(b / 8) % 4];
    sound(
      at,
      0.27,
      (t) =>
        Math.sin(2 * Math.PI * (52 * t + 7 * (1 - Math.exp(-t * 35)))) *
        Math.exp(-t * 20),
      0.12,
    );
    if (b % 2 === 1)
      sound(at, 0.14, (t) => noise() * Math.exp(-t * 40), 0.045, 0.1);
    for (let h = 0; h < 2; h++)
      sound(
        at + (h * beat) / 2,
        0.065,
        (t) => noise() * Math.exp(-t * 100),
        0.023,
        h ? -0.3 : 0.3,
      );
    pluck(at, chord[0] - 12, 0.15, 0, 0.75);
    for (let n = 0; n < (utopia || flagship ? 2 : 4); n++)
      pluck(
        at + (n * beat) / (utopia || flagship ? 2 : 4),
        chord[(b + n) % 4] + 12,
        0.056,
        ((n % 3) - 1) * 0.3,
        0.7,
      );
    if (b % 4 === 0)
      for (let n = 1; n < 4; n++)
        pluck(at + 0.02 * n, chord[n], 0.039, (n - 2) * 0.3, 1.1);
  }
  if (utopia || flagship)
    for (let b = 0; b * beat < 22; b += 8) {
      const chord = chords[Math.floor(b / 8) % 4];
      for (let n = 0; n < 4; n++) {
        const f = note(chord[n]);
        sound(
          b * beat,
          Math.min(4.9, 23 - b * beat),
          (t, p) =>
            Math.sin(Math.PI * p) ** 1.3 *
            (Math.sin(2 * Math.PI * f * t) +
              0.2 * Math.sin(2 * Math.PI * f * 1.002 * t)),
          0.027,
          (n - 1.5) * 0.3,
        );
      }
    }
  let lastStep = -1;
  for (const e of events) {
    if (e.kind === "sfx") {
      const id = e.data.id;
      if (id === "step") {
        if (e.time - lastStep > 0.15) {
          sound(e.time, 0.052, (t) => noise() * Math.exp(-t * 70), 0.025);
          lastStep = e.time;
        }
      }
      if (id === "pickup" || id === "drop" || id === "stock") {
        pluck(e.time, id === "pickup" ? 84 : 79, 0.17, -0.12, 0.3);
        sound(e.time, 0.055, (t) => noise() * Math.exp(-t * 90), 0.035);
      }
      if (id === "coin") {
        pluck(e.time, 91, 0.18, 0.15, 0.65);
        pluck(e.time + 0.055, 96, 0.12, -0.15, 0.45);
      }
    }
    if (e.kind === "served") {
      pluck(e.time, 84, 0.18, -0.2);
      pluck(e.time + 0.09, 88, 0.16, 0);
      pluck(e.time + 0.18, 91, 0.15, 0.2);
    }
    if (e.kind === "cleaned") {
      for (let n = 0; n < 5; n++)
        pluck(
          e.time + n * 0.065,
          [79, 84, 88, 91, 96][n],
          0.13,
          (n - 2) * 0.15,
          0.65,
        );
    }
    if (
      e.kind === "action" &&
      (e.data.kind === "wipe" || e.data.kind === "mop")
    ) {
      const end =
        events.find((x) => x.time > e.time && x.kind === "action")?.time ??
        e.time + 1;
      sound(
        e.time,
        Math.min(3, end - e.time),
        (t) =>
          noise() *
          (0.32 + 0.68 * Math.sin(t * 13) ** 2) *
          Math.min(1, t * 20) *
          Math.min(1, (end - e.time - t) * 16),
        0.035,
        -0.2,
      );
    }
  }
  for (const at of events.filter(e => e.kind === 'cut' && e.time > 0).map(e => e.time))
    sound(
      at - 0.15,
      0.32,
      (t, p) => noise() * Math.sin(Math.PI * p) ** 2,
      0.025,
      0,
    );
  for (let n = 0; n < 4; n++)
    pluck(22.05 + n * 0.13, [72, 76, 79, 84][n], 0.2, (n - 1.5) * 0.18, 1.7);
  for (const m of [48, 60, 64, 67, 72]) pluck(22.58, m, 0.1, 0, 2.2);
  for (const e of events.filter(e => e.kind === 'hired'))
    for (let n=0;n<4;n++) pluck(e.time+n*.085,[72,79,84,88][n],.17,(n-1.5)*.15,.9);
  // Small stereo echo and boundary fades; leave headroom for final loudness mastering.
  const delay = Math.round(0.168 * sr);
  for (let i = length - 1; i >= delay; i--) {
    L[i] += R[i - delay] * 0.15;
    R[i] += L[i - delay] * 0.13;
  }
  const pcm = Buffer.alloc(length * 4);
  for (let i = 0; i < length; i++) {
    const fade = Math.min(1, i / (sr * 0.015), (length - i) / (sr * 0.45));
    pcm.writeInt16LE(Math.round(Math.tanh(L[i] * 1.4) * fade * 30000), i * 4);
    pcm.writeInt16LE(
      Math.round(Math.tanh(R[i] * 1.4) * fade * 30000),
      i * 4 + 2,
    );
  }
  const header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(sr, 24);
  header.writeUInt32LE(sr * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  await writeFile(output, Buffer.concat([header, pcm]));
  return {
    sampleRate: sr,
    channels: 2,
    seconds: duration,
    originalMusic: true,
    eventSync: true,
  };
}
