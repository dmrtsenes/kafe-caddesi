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
    const tempo = 120;
    const beat = 60 / tempo;
    const chords = [
      [60, 64, 67, 72], // C
      [57, 60, 64, 69], // Am
      [53, 57, 60, 65], // F
      [55, 59, 62, 67], // G
    ];

    // High energy, bouncy casual arcade rhythm section (120 BPM)
    for (let b = 0; b * beat < 22.2; b++) {
      const at = b * beat;
      const bar = Math.floor(b / 4);
      const beatInBar = b % 4;
      const chord = chords[bar % 4];

      // Punchy casual kick drum on beats 1 and 3 (plus syncopated push on 3.5)
      if (beatInBar === 0 || beatInBar === 2 || (beatInBar === 3 && b % 2 === 1)) {
        sound(at, 0.22, (t) => {
          const f = 110 * Math.exp(-t * 30) + 42;
          return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 14);
        }, 0.24, 0);
      }

      // Crisp finger snap / handclap on beats 2 and 4
      if (beatInBar === 1 || beatInBar === 3) {
        sound(at, 0.12, (t) => {
          return (noise() * 0.75 + 0.25 * Math.sin(2 * Math.PI * 1200 * t)) * Math.exp(-t * 32);
        }, 0.12, 0.15);
      }

      // 16th note shakers for drive and momentum
      for (let s = 0; s < 4; s++) {
        const sat = at + (s * beat) / 4;
        sound(sat, 0.045, (t) => noise() * Math.exp(-t * 85), s % 2 === 0 ? 0.035 : 0.018, s % 2 === 0 ? -0.2 : 0.2);
      }

      // Funky walking bassline
      const bassNote = beatInBar === 0 ? chord[0] - 24 : beatInBar === 2 ? chord[2] - 24 : chord[1] - 24;
      pluck(at, bassNote, 0.22, 0, 0.45);
      if (beatInBar === 3) {
        pluck(at + beat * 0.5, chord[0] - 22, 0.14, 0, 0.35); // leading tone
      }

      // Upbeat marimba / bright acoustic chords
      if (beatInBar === 0 || beatInBar === 1.5 || beatInBar === 2.5) {
        for (let n = 0; n < chord.length; n++) {
          pluck(at + n * 0.015, chord[n] + 12, 0.075, ((n % 3) - 1) * 0.25, 0.65);
        }
      }

      // Catchy melody arpeggio hook
      const melodyNotes = [72, 74, 76, 79, 81, 84];
      const mNote = melodyNotes[(b * 3 + bar) % melodyNotes.length];
      pluck(at + beat * 0.5, mNote, 0.08, 0.18, 0.4);
    }

    // Event-synchronized satisfying ASMR sound effects
    let lastStep = -1;
    for (const e of events) {
      if (e.kind === "sfx") {
        const id = e.data.id;
        if (id === "step") {
          if (e.time - lastStep > 0.14) {
            sound(e.time, 0.04, (t) => noise() * Math.exp(-t * 90), 0.02);
            lastStep = e.time;
          }
        }
        if (id === "pickup" || id === "drop" || id === "stock") {
          // Satisfying wood click + pop
          pluck(e.time, 84, 0.22, -0.15, 0.25);
          pluck(e.time + 0.03, 88, 0.18, 0.15, 0.25);
          sound(e.time, 0.06, (t) => Math.sin(2 * Math.PI * 480 * t) * Math.exp(-t * 40), 0.08);
        }
        if (id === "coin") {
          // Rapid cash flutter
          pluck(e.time, 91, 0.22, 0.2, 0.45);
          pluck(e.time + 0.04, 96, 0.18, -0.2, 0.4);
          pluck(e.time + 0.08, 103, 0.14, 0.1, 0.35);
        }
      }
      if (e.kind === "served") {
        // Happy delivery chime (C - E - G - C arpeggio)
        pluck(e.time, 84, 0.22, -0.25, 0.6);
        pluck(e.time + 0.07, 88, 0.20, 0, 0.6);
        pluck(e.time + 0.14, 91, 0.20, 0.25, 0.7);
        pluck(e.time + 0.21, 96, 0.25, 0, 0.85);
      }
      if (e.kind === "cleaned") {
        // Magical sparkling fairy dust glissando
        const spark = [79, 83, 86, 88, 91, 95, 98, 100];
        for (let n = 0; n < spark.length; n++) {
          pluck(e.time + n * 0.045, spark[n], 0.16, ((n % 4) - 1.5) * 0.25, 0.55);
        }
        sound(e.time, 0.45, (t) => noise() * Math.sin(Math.PI * (t / 0.45)) * 0.5, 0.04);
      }
      if (
        e.kind === "action" &&
        (e.data.kind === "wipe" || e.data.kind === "mop")
      ) {
        sound(e.time, 0.5, (t) => noise() * Math.exp(-t * 12) * Math.sin(t * 24), 0.045, -0.2);
      }
    }

    // Scene transition whooshes
    for (const at of [2.7, 8, 10.5, 16.5, 19.5, 22.5]) {
      sound(at - 0.18, 0.35, (t, p) => noise() * Math.sin(Math.PI * p) ** 2.2, 0.065, 0);
    }

    // Triumphant Grand Outro Fanfare (22.5s - 25s)
    // Cash register "CHA-CHING!"
    sound(22.55, 0.04, (t) => noise() * Math.exp(-t * 50), 0.15, -0.1);
    pluck(22.58, 96, 0.28, 0.2, 1.2);
    pluck(22.62, 100, 0.26, -0.2, 1.2);
    pluck(22.68, 108, 0.32, 0, 1.5);

    // Grand final major chords
    const finalChords = [
      [60, 64, 67, 72, 76],
      [65, 69, 72, 77, 81],
      [67, 71, 74, 79, 83],
      [72, 76, 79, 84, 88, 96],
    ];
    for (let c = 0; c < finalChords.length; c++) {
      const at = 22.8 + c * 0.45;
      const fChord = finalChords[c];
      for (const noteNum of fChord) {
        pluck(at, noteNum, 0.16, 0, 2.0);
      }
    }
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
