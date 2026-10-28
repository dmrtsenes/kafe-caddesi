/**
 * Sentez ilkelleri — hiç ses dosyası yok, her şey çalışma anında Web Audio ile üretilir.
 * Zarflar, gürültü tamponu, prosedürel reverb impulse'ı ve tek seslik (Voice) yardımcısı.
 */

import { clamp } from '../core/MathUtils';

/** MIDI nota → Hz (A4 = 69 = 440 Hz). */
export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** Yarım ton farkı → frekans oranı. */
export function semitoneRatio(s: number): number {
  return Math.pow(2, s / 12);
}

/** Hafif yumuşatılmış beyaz gürültü — tüm sesler bunu paylaşır (bir kez üretilir). */
export function createNoiseBuffer(ctx: BaseAudioContext, seconds = 2): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    lp += (w - lp) * 0.82;
    d[i] = (w * 0.7 + lp * 0.5) * 0.8; // tiz kenarlar törpülü → sıcak
  }
  return buf;
}

/** Sönümlenen gürültüden prosedürel oda tepkisi (~1.1 sn). Koyu kuyruk, metalik değil. */
export function createImpulseResponse(ctx: BaseAudioContext, seconds = 1.1, decay = 3.1): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * seconds));
  const buf = ctx.createBuffer(2, len, sr);
  const fadeIn = Math.max(1, Math.floor(sr * 0.004));
  const invLen = 1 / len;
  const invFade = 1 / fadeIn;
  const d0 = buf.getChannelData(0);
  const d1 = buf.getChannelData(1);
  let lp0 = 0;
  let lp1 = 0;
  for (let i = 0; i < len; i++) {
    const envDecay = Math.pow(1 - i * invLen, decay);
    const fade = i < fadeIn ? i * invFade : 1;
    const n0 = (Math.random() * 2 - 1) * envDecay;
    const n1 = (Math.random() * 2 - 1) * envDecay;
    lp0 += (n0 - lp0) * 0.34;
    lp1 += (n1 - lp1) * 0.34;
    d0[i] = lp0 * fade;
    d1[i] = lp1 * fade;
  }
  return buf;
}

/** 0 → tepe (atak) → üstel sönüm. Asla ani `.value` yazmaz, tıklama yapmaz. */
export function env(p: AudioParam, t0: number, peak: number, atk: number, dec: number): void {
  const a = Math.max(0.001, atk);
  const pk = Math.max(0.0002, peak);
  p.setValueAtTime(0.0001, t0);
  p.linearRampToValueAtTime(pk, t0 + a);
  p.exponentialRampToValueAtTime(0.0001, t0 + a + Math.max(0.01, dec));
}

/** Üstel perde/kesim süpürmesi. */
export function glide(p: AudioParam, t0: number, from: number, to: number, dur: number): void {
  p.setValueAtTime(Math.max(1e-4, from), t0);
  p.exponentialRampToValueAtTime(Math.max(1e-4, to), t0 + Math.max(0.01, dur));
}

/** Çalan grafikte pürüzsüz seviye değişimi (kısma/müzik geçişi). */
export function rampTo(p: AudioParam, target: number, dur: number, now: number): void {
  try {
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(target, now + Math.max(0.01, dur));
  } catch {
    /* yok say */
  }
}

/** Seslerin bağlandığı ortak yollar. */
export interface SynthBus {
  readonly ctx: AudioContext;
  /** Kuru yol (sfx veya müzik veriyolu). */
  readonly dry: AudioNode;
  /** Reverb gönderisi. */
  readonly wet: AudioNode;
  /** Paylaşılan gürültü tamponu. */
  readonly noise: AudioBuffer;
}

export type VoiceEnd = (v: Voice) => void;

/**
 * Tek bir ses olayı. Kendi çıkış kazancı + reverb gönderisi vardır;
 * içindeki tüm düğümleri bitince (`onended`) kopartır — uzun oturumda sızıntı olmaz.
 */
export class Voice {
  readonly ctx: AudioContext;
  readonly out: GainNode;
  /** Kaba yükseklik — ses bütçesi aşılınca kurban seçiminde kullanılır. */
  readonly level: number;
  readonly bornAt: number;

  /** Susturulmuş ya da bitmiş — ses bütçesinde artık sayılmaz. */
  dying = false;

  private sb: SynthBus;
  private nodes: AudioNode[] = [];
  private srcs: AudioScheduledSourceNode[] = [];
  private pending = 0;
  private dead = false;
  private onEnd: VoiceEnd | null = null;
  private ended = (): void => {
    this.pending--;
    if (this.pending <= 0) this.forceRelease();
  };

  constructor(sb: SynthBus, level: number, send: number, pan: number, onEnd: VoiceEnd | null) {
    this.sb = sb;
    this.ctx = sb.ctx;
    this.level = level;
    this.bornAt = sb.ctx.currentTime;
    this.onEnd = onEnd;

    const g = sb.ctx.createGain();
    g.gain.value = level;
    this.out = g;
    this.nodes.push(g);

    let tail: AudioNode = g;
    if (pan !== 0 && typeof sb.ctx.createStereoPanner === 'function') {
      const p = sb.ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p);
      this.nodes.push(p);
      tail = p;
    }
    tail.connect(sb.dry);

    if (send > 0) {
      const s = sb.ctx.createGain();
      s.gain.value = send;
      tail.connect(s);
      s.connect(sb.wet);
      this.nodes.push(s);
    }
  }

  private track<T extends AudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }

  gain(value = 0): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    return this.track(g);
  }

  osc(type: OscillatorType, freq: number, detuneCents = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = clamp(freq, 8, 20000);
    if (detuneCents !== 0) o.detune.value = detuneCents;
    return this.track(o);
  }

  filter(type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = clamp(freq, 20, 20000);
    f.Q.value = q;
    return this.track(f);
  }

  /** Paylaşılan gürültü tamponundan kaynak (döngülü — istenen kadar kesilir). */
  noise(rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = this.sb.noise;
    s.loop = true;
    s.playbackRate.value = clamp(rate, 0.25, 4);
    return this.track(s);
  }

  /** Kaynağı başlat/durdur ve bitişini say. */
  play(src: AudioScheduledSourceNode, t0: number, dur: number): void {
    if (this.dead) return;
    this.pending++;
    src.onended = this.ended;
    try {
      if (src instanceof AudioBufferSourceNode) src.start(t0, Math.random() * 1.5);
      else src.start(t0);
      src.stop(t0 + Math.max(0.01, dur));
      this.srcs.push(src);
    } catch {
      this.pending--;
    }
  }

  /** Kısayol: osc → gain(zarf) → out. Süpürme için osilatörü döner. */
  tone(
    t0: number,
    freq: number,
    dur: number,
    peak: number,
    type: OscillatorType = 'sine',
    atk = 0.004,
  ): OscillatorNode {
    const o = this.osc(type, freq);
    const g = this.gain(0);
    env(g.gain, t0, peak, atk, dur);
    o.connect(g).connect(this.out);
    this.play(o, t0, dur + atk + 0.05);
    return o;
  }

  /** Kısayol: gürültü → filtre → gain(zarf) → out. Süpürme için filtreyi döner. */
  hiss(
    t0: number,
    dur: number,
    peak: number,
    type: BiquadFilterType,
    freq: number,
    q = 1,
    atk = 0.002,
  ): BiquadFilterNode {
    const s = this.noise();
    const f = this.filter(type, freq, q);
    const g = this.gain(0);
    env(g.gain, t0, peak, atk, dur);
    s.connect(f).connect(g).connect(this.out);
    this.play(s, t0, dur + atk + 0.05);
    return f;
  }

  /** Bütçe aşımında erken susturma — kısa rampa, tıklama yok. */
  kill(now: number): void {
    if (this.dead || this.dying) return;
    this.dying = true;
    try {
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(this.out.gain.value, now);
      this.out.gain.linearRampToValueAtTime(0, now + 0.05);
    } catch {
      /* yok say */
    }
    for (let i = 0; i < this.srcs.length; i++) {
      try {
        this.srcs[i].stop(now + 0.08);
      } catch {
        /* zaten bitmiş */
      }
    }
  }

  /** Tüm düğümleri kopart ve bitiş geri çağrısını tetikle. Birden fazla çağrı zararsız. */
  forceRelease(): void {
    if (this.dead) return;
    this.dead = true;
    this.dying = true;
    for (let i = 0; i < this.nodes.length; i++) {
      try {
        this.nodes[i].disconnect();
      } catch {
        /* yok say */
      }
    }
    this.nodes.length = 0;
    this.srcs.length = 0;
    const cb = this.onEnd;
    this.onEnd = null;
    if (cb) cb(this);
  }
}
