/**
 * KAFE CADDESİ — ses katmanı.
 *
 * Sıfır asset: her efekt ve müzik notası Web Audio ile anlık sentezlenir.
 * Zincir:  ses/müzik → master → yumuşak kompresör → hoparlör
 *          (paralel) → reverb gönderisi → convolver (prosedürel IR) → dönüş → master
 */

import { bus } from '../core/EventBus';
import { VacuumSound } from './VacuumSound';
import { clamp, clamp01, damp, smoothstep } from '../core/MathUtils';
import { Voice, createImpulseResponse, createNoiseBuffer, env, glide, midiToFreq, rampTo, semitoneRatio } from './Synth';
import type { SynthBus } from './Synth';

export type SfxId =
  | 'pickup' | 'drop' | 'stock' | 'sell' | 'coin' | 'cashout'
  | 'upgrade' | 'hire' | 'goal' | 'unlock' | 'levelup'
  | 'ui_click' | 'ui_open' | 'ui_close' | 'error' | 'chip'
  | 'event_alarm' | 'thief' | 'catch' | 'repair' | 'wipe'
  | 'step' | 'customer_happy' | 'customer_angry' | 'produce'
  | 'dish_clatter' | 'squeak' | 'clean_chime';

export interface AudioManager {
  /** İlk kullanıcı etkileşiminde çağrılır (autoplay politikası). Tekrar çağrılması zararsız. */
  unlock(): void;
  play(id: SfxId, opts?: { vol?: number; rate?: number; pan?: number }): void;
  setMuted(m: boolean): void;
  isMuted(): boolean;
  setMusicEnabled(on: boolean): void;
  isMusicEnabled(): boolean;
  /**
   * Ses efekti ve müzik seviyeleri, 0..1 (Ayarlar'daki kaydırıcılar).
   *
   * Tek bir "sessiz" anahtarı yeterli değildi: oyuncuların çoğu müziği
   * KAPATMAK değil KISMAK ister — özellikle idle bir oyunda, arka planda
   * kendi müziğini dinlerken. Seviyeler ayrı yollar üzerinde çarpan
   * olarak durur, ana seviyeye ve sessiz anahtarına dokunmaz.
   */
  setSfxVolume(v: number): void;
  setMusicVolume(v: number): void;
  /** Yoğunluk 0..1 — müzik katmanları buna göre açılır (yoğun saatte canlanır). */
  setIntensity(v: number): void;
  /**
   * Elektrikli süpürge uğultusu.
   *
   * @param level 0 = kapalı, 1 = tam. Süpürge eldeyken açılır.
   * @param suction 0..1 — kir emerken yükselen "iş yapıyor" tınısı.
   *
   * Sabit motor uğultusu ve yumuşak hava akımı. Tamamen sentez; ses dosyası
   * yoktur. Çalarken yalnız filtre/seviye değişir. Bırakılınca kısa sönümün
   * ardından iki ses kaynağı da durur ve bağlantılar çözülür.
   */
  setVacuum(level: number, suction: number): void;
  /**
   * Uygulama arka plana alınınca sesi askıya alır.
   *
   * Müzik motoru artık süresiz osilatör TUTMUYOR (her nota kendi zarfıyla
   * söner), ama süpürge uğultusu hâlâ sürekli bir kaynaktır ve zamanlayıcı
   * her karede nota planlar. Askıya almazsak ses işleme iş parçacığı arka
   * planda çalışmayı sürdürür: hem pil yakar hem de işletim sisteminin
   * uygulamayı öldürme gerekçesidir.
   */
  setSuspended(v: boolean): void;
  update(dt: number): void;
  dispose(): void;
}

// ─── Ayarlar ────────────────────────────────────────────────────────────────

const MASTER_LEVEL = 0.85;
const MUSIC_LEVEL = 0.2;
const MUSIC_SEND = 0.5;
const MAX_VOICES = 18;
const SCHED_AHEAD = 0.3;
const STUCK_AFTER = 6;

/** Hızlı tekrarda tırmanılan pentatonik merdiven (yarım ton). */
const LADDER_STEPS = [0, 2, 4, 7, 9, 12, 14, 16];
const LADDER_RATIO = LADDER_STEPS.map(semitoneRatio);
const LADDER_RESET = 0.6;

const MAJ3 = [0, 4, 7];
const MAJ4 = [0, 4, 7, 12];
const RUN6 = [0, 4, 7, 12, 16, 19];
const CHORD4 = [0, 7, 12, 16];

// ─── Efekt tablosu ──────────────────────────────────────────────────────────

interface SfxDef {
  /** Kaba yükseklik (karışım + bütçe kurbanı seçimi). */
  gain: number;
  /** Reverb gönderi miktarı. */
  send: number;
  /** Minimum tetikleme aralığı (sn) — spam kırpma. */
  gap: number;
  /** Hızlı tekrarda perde merdiveni. */
  ladder: boolean;
  /** Rastgele perde sapması (oran). */
  jitter: number;
  make: (v: Voice, t: number, r: number) => void;
}

function def(
  gain: number,
  send: number,
  make: SfxDef['make'],
  gap = 0,
  ladder = false,
  jitter = 0,
): SfxDef {
  return { gain, send, gap, ladder, jitter, make };
}

const SFX: Record<SfxId, SfxDef> = {
  // Ahşap "tok": filtreli gürültü + alçak sinüs vuruş
  pickup: def(0.5, 0.1, (v, t, r) => {
    const f = v.hiss(t, 0.05, 0.6, 'bandpass', 1500 * r, 3.2, 0.002);
    glide(f.frequency, t, 1500 * r, 780 * r, 0.05);
    const o = v.tone(t, 200 * r, 0.09, 0.5, 'sine', 0.003);
    glide(o.frequency, t, 200 * r, 128 * r, 0.08);
  }, 0.06, false, 0.05),

  // Daha alçak, yuvarlak "tunk" + minicik klik transiyenti
  drop: def(0.52, 0.12, (v, t, r) => {
    v.hiss(t, 0.018, 0.35, 'highpass', 2400 * r, 0.8, 0.001);
    const o = v.tone(t, 150 * r, 0.16, 0.6, 'sine', 0.004);
    glide(o.frequency, t, 150 * r, 88 * r, 0.14);
    const b = v.tone(t + 0.005, 300 * r, 0.07, 0.16, 'triangle', 0.003);
    glide(b.frequency, t + 0.005, 300 * r, 210 * r, 0.06);
  }, 0.05),

  // Vitrine dizme — drop'un kardeşi, tekrarda merdiven çıkar
  stock: def(0.48, 0.14, (v, t, r) => {
    v.hiss(t, 0.016, 0.3, 'highpass', 3000 * r, 0.8, 0.001);
    const o = v.tone(t, 190 * r, 0.13, 0.5, 'sine', 0.004);
    glide(o.frequency, t, 190 * r, 110 * r, 0.12);
    v.tone(t + 0.004, 520 * r, 0.06, 0.12, 'triangle', 0.003);
  }, 0.07, true),

  // İstasyon ürün bitirdi — küçük sıcak "ding"
  produce: def(0.42, 0.3, (v, t, r) => {
    v.tone(t, 784 * r, 0.42, 0.34, 'sine', 0.008);
    v.tone(t, 1176 * r, 0.3, 0.12, 'sine', 0.01);
    v.tone(t, 392 * r, 0.28, 0.1, 'triangle', 0.008);
  }, 0.09, true),

  // Satış — parlak, yükselen iki nota
  sell: def(0.5, 0.18, (v, t, r) => {
    v.tone(t, 660 * r, 0.08, 0.34, 'triangle', 0.004);
    v.tone(t + 0.07, 988 * r, 0.13, 0.3, 'triangle', 0.004);
    v.hiss(t, 0.02, 0.1, 'bandpass', 4200 * r, 6, 0.001);
  }, 0.04),

  // Bozuk para / cüzdan teması — parlak kristal çan tınısı + merdiven tırmanışı
  coin: def(0.48, 0.22, (v, t, r) => {
    v.tone(t, 1480 * r, 0.18, 0.28, 'triangle', 0.002);
    const d = v.tone(t, 1480 * r, 0.14, 0.2, 'sine', 0.002);
    d.detune.value = 16;
    v.tone(t, 2960 * r, 0.09, 0.1, 'sine', 0.001);
    v.tone(t, 4440 * r, 0.05, 0.06, 'triangle', 0.001);
    v.hiss(t, 0.012, 0.16, 'highpass', 6200 * r, 2.5, 0.001);
  }, 0.015, true),

  // Tezgâh — mekanik klak + çan akoru ("ka-çing")
  cashout: def(0.62, 0.34, (v, t, r) => {
    v.hiss(t, 0.03, 0.35, 'bandpass', 1100 * r, 2.2, 0.001);
    const th = v.tone(t, 160, 0.09, 0.3, 'sine', 0.003);
    glide(th.frequency, t, 160, 95, 0.08);
    const t2 = t + 0.045;
    v.tone(t2, 784 * r, 0.7, 0.22, 'sine', 0.006);
    v.tone(t2 + 0.01, 1046 * r, 0.65, 0.18, 'sine', 0.006);
    v.tone(t2 + 0.02, 1568 * r, 0.55, 0.12, 'sine', 0.006);
    v.tone(t2, 2093 * r, 0.35, 0.05, 'sine', 0.004);
  }, 0.08),

  // Yükseltme — yükselen majör arpej + parıltı kuyruğu
  upgrade: def(0.55, 0.38, (v, t, r) => {
    const base = 523.25 * r;
    for (let i = 0; i < 3; i++) {
      const f = base * semitoneRatio(MAJ3[i]);
      v.tone(t + i * 0.085, f, 0.26, 0.26 - i * 0.02, 'triangle', 0.005);
      v.tone(t + i * 0.085, f * 2, 0.12, 0.05, 'sine', 0.004);
    }
    const sh = v.tone(t + 0.24, 2637 * r, 0.9, 0.07, 'sine', 0.06);
    glide(sh.frequency, t + 0.24, 2637 * r, 3136 * r, 0.8);
  }, 0.05),

  // İşe alım — samimi iki nota "hey!", ünlü harf formantlı
  hire: def(0.5, 0.24, (v, t, r) => {
    const o = v.osc('sawtooth', 392 * r);
    const g = v.gain(0);
    env(g.gain, t, 0.3, 0.02, 0.34);
    const f1 = v.filter('bandpass', 720, 4);
    const f2 = v.filter('bandpass', 1180, 6);
    const mix = v.gain(0.55);
    o.connect(f1).connect(mix);
    o.connect(f2).connect(mix);
    mix.connect(g).connect(v.out);
    glide(o.frequency, t, 392 * r, 523 * r, 0.16);
    glide(f2.frequency, t, 1180, 1750, 0.2);
    v.play(o, t, 0.42);
  }, 0.1),

  // Hedef — 3 notalı kutlama
  goal: def(0.58, 0.4, (v, t, r) => {
    const base = 523.25 * r;
    for (let i = 0; i < 3; i++) {
      v.tone(t + i * 0.075, base * semitoneRatio(MAJ3[i]), 0.5, 0.22, 'triangle', 0.006);
    }
    v.tone(t + 0.16, base * 2, 0.6, 0.09, 'sine', 0.02);
  }, 0.1),

  // Kilit açıldı — 4 nota + reverb kabarması
  unlock: def(0.64, 0.55, (v, t, r) => {
    const sw = v.hiss(t, 0.35, 0.1, 'bandpass', 500, 1.2, 0.25);
    glide(sw.frequency, t, 500, 3000, 0.35);
    const base = 440 * r;
    for (let i = 0; i < 4; i++) {
      v.tone(t + 0.1 + i * 0.09, base * semitoneRatio(MAJ4[i]), 0.7, 0.2, 'triangle', 0.008);
    }
  }, 0.12),

  // Seviye — büyük gösteri: koşu + akor + parıltı
  levelup: def(0.68, 0.6, (v, t, r) => {
    const base = 392 * r;
    for (let i = 0; i < RUN6.length; i++) {
      v.tone(t + i * 0.062, base * semitoneRatio(RUN6[i]), 0.28, 0.2 - i * 0.012, 'triangle', 0.004);
    }
    const c = t + RUN6.length * 0.062;
    for (let i = 0; i < CHORD4.length; i++) {
      v.tone(c, base * semitoneRatio(CHORD4[i]), 1.1, 0.13, 'sine', 0.02);
    }
    v.tone(c, base * 4, 1.3, 0.05, 'sine', 0.12);
  }, 0.15),

  // Minik yumuşak tık
  ui_click: def(0.3, 0.05, (v, t, r) => {
    v.hiss(t, 0.012, 0.3, 'bandpass', 2400 * r, 2.5, 0.001);
    v.tone(t, 1100 * r, 0.02, 0.1, 'sine', 0.001);
  }, 0.03),

  // Panel açılışı — yukarı süpüren bant-geçiren gürültü
  ui_open: def(0.38, 0.18, (v, t, r) => {
    const f = v.hiss(t, 0.19, 0.3, 'bandpass', 420 * r, 1.6, 0.02);
    glide(f.frequency, t, 420 * r, 2600 * r, 0.19);
  }, 0.05),

  // Panel kapanışı — ters yön
  ui_close: def(0.38, 0.18, (v, t, r) => {
    const f = v.hiss(t, 0.17, 0.28, 'bandpass', 2400 * r, 1.6, 0.01);
    glide(f.frequency, t, 2400 * r, 380 * r, 0.17);
  }, 0.05),

  // Teklif çipi belirdi — davetkâr, yumuşak iki çıkan nota + minik parıltı.
  // "goal"dan bilerek kısık ve kısa: teklif bir kutlama değil, nazik bir
  // el sallama; her ~2 dakikada bir çalacağı için yorucu olmamalı.
  chip: def(0.42, 0.28, (v, t, r) => {
    v.tone(t, 740 * r, 0.14, 0.18, 'triangle', 0.006);
    v.tone(t + 0.085, 988 * r, 0.28, 0.2, 'triangle', 0.006);
    v.tone(t + 0.085, 1976 * r, 0.2, 0.05, 'sine', 0.012);
  }, 0.25),

  // Nazik "olmaz" — iki inen ton, alçak geçirenden geçer, bilerek kısık
  error: def(0.34, 0.14, (v, t, r) => {
    const lp = v.filter('lowpass', 900, 0.8);
    lp.connect(v.out);
    for (let i = 0; i < 2; i++) {
      const t0 = t + i * 0.12;
      const o = v.osc('triangle', (i === 0 ? 311 : 294) * r);
      const g = v.gain(0);
      env(g.gain, t0, 0.22, 0.01, 0.16);
      o.connect(g).connect(lp);
      v.play(o, t0, 0.2);
    }
  }, 0.15),

  // Olay başlangıcı — sıcak çift çan
  event_alarm: def(0.58, 0.42, (v, t, r) => {
    for (let i = 0; i < 2; i++) {
      const t0 = t + i * 0.24;
      v.tone(t0, 880 * r, 0.5, 0.22, 'sine', 0.006);
      v.tone(t0, 1320 * r, 0.42, 0.12, 'sine', 0.006);
      v.tone(t0, 587 * r, 0.5, 0.1, 'triangle', 0.008);
    }
  }, 0.2),

  // Kaçak müşteri — gergin, atan alçak ton
  thief: def(0.5, 0.25, (v, t, r) => {
    const lp = v.filter('lowpass', 300, 3);
    const g = v.gain(0);
    env(g.gain, t, 0.3, 0.08, 0.85);
    lp.connect(g).connect(v.out);
    const o1 = v.osc('sawtooth', 82 * r);
    const o2 = v.osc('sawtooth', 82 * r, 22); // dedetune → vuruş
    o1.connect(lp);
    o2.connect(lp);
    const trem = v.osc('sine', 8.5);
    const td = v.gain(0.12);
    trem.connect(td);
    td.connect(g.gain);
    glide(lp.frequency, t, 300, 620, 0.9);
    v.play(o1, t, 0.95);
    v.play(o2, t, 0.95);
    v.play(trem, t, 0.95);
  }, 0.25),

  // Yakalama — şak + yükselen süpürme + zafer akoru
  catch: def(0.62, 0.35, (v, t, r) => {
    v.hiss(t, 0.03, 0.5, 'highpass', 1800, 0.9, 0.001);
    const o = v.tone(t, 300 * r, 0.26, 0.24, 'triangle', 0.004);
    glide(o.frequency, t, 300 * r, 1400 * r, 0.24);
    v.tone(t + 0.22, 1046 * r, 0.4, 0.18, 'sine', 0.005);
    v.tone(t + 0.22, 1568 * r, 0.35, 0.1, 'sine', 0.005);
  }, 0.1),

  // Tamir — anahtar cırcırı: aralığı kısalan kısa tıklar
  repair: def(0.45, 0.16, (v, t, r) => {
    let at = t;
    let gap = 0.075;
    for (let i = 0; i < 7; i++) {
      v.hiss(at, 0.014, 0.34 - i * 0.02, 'bandpass', (2100 + i * 220) * r, 4, 0.001);
      at += gap;
      gap *= 0.82;
    }
  }, 0.3),

  // Masa silme — ıslak bez sürtünmesi ve zengin temizlik hissi
  wipe: def(0.48, 0.2, (v, t, r) => {
    const f = v.hiss(t, 0.095, 0.4, 'bandpass', 1900 * r, 2.4, 0.005);
    glide(f.frequency, t, 1900 * r, 2800 * r, 0.09);
    const sq = v.tone(t + 0.015, 2200 * r, 0.08, 0.16, 'sine', 0.006);
    glide(sq.frequency, t + 0.015, 2200 * r, 2750 * r, 0.05);
  }, 0.08, false, 0.08),

  // Porselen/seramik tabak tıkırtısı — bulaşık alma (dish pick-up clatter)
  dish_clatter: def(0.56, 0.28, (v, t, r) => {
    // Seramik yüksek temas çıtırtısı (crisp china transient)
    v.hiss(t, 0.022, 0.48, 'highpass', 4400 * r, 2.0, 0.001);
    // Tabak tok kütle vuruşu
    const th = v.tone(t, 190 * r, 0.06, 0.36, 'sine', 0.002);
    glide(th.frequency, t, 190 * r, 90 * r, 0.05);
    // Akustik seramik çınlaması (fine china ping)
    v.tone(t, 1780 * r, 0.15, 0.32, 'triangle', 0.002);
    v.tone(t, 3180 * r, 0.09, 0.2, 'sine', 0.002);
    // İkinci mikro tıkırtı / sekme
    const t2 = t + 0.034;
    v.hiss(t2, 0.016, 0.3, 'bandpass', 3800 * r, 3.2, 0.001);
    v.tone(t2, 2240 * r, 0.09, 0.22, 'triangle', 0.002);
  }, 0.04, false, 0.07),

  // Kauçuk / ıslak bez gıcırtısı (squeaky clean scrub)
  squeak: def(0.48, 0.22, (v, t, r) => {
    const sq = v.tone(t, 2350 * r, 0.09, 0.24, 'sine', 0.005);
    glide(sq.frequency, t, 2350 * r, 3250 * r, 0.055);
    glide(sq.frequency, t + 0.055, 3250 * r, 2050 * r, 0.035);
    v.hiss(t, 0.03, 0.24, 'highpass', 4600 * r, 2.2, 0.002);
  }, 0.08, false, 0.1),

  // Temizlik tamamlandı — kristal kadeh çınlaması ve parıltı zili (clean chime)
  clean_chime: def(0.68, 0.52, (v, t, r) => {
    const f0 = 2093 * r; // C7
    v.tone(t, f0, 0.95, 0.42, 'sine', 0.002);
    v.tone(t, f0 * 1.5, 0.72, 0.28, 'sine', 0.003);
    v.tone(t, f0 * 2.0, 0.52, 0.18, 'sine', 0.002);
    v.tone(t + 0.02, 3136 * r, 0.65, 0.24, 'triangle', 0.003);
    v.tone(t + 0.06, 2637 * r, 0.45, 0.18, 'sine', 0.002);
    v.tone(t + 0.11, 4186 * r, 0.55, 0.16, 'sine', 0.002);
    v.hiss(t, 0.045, 0.22, 'highpass', 7500 * r, 2.5, 0.001);
  }, 0.12),

  // Adım — çok kısık, ucuz, ±%8 perde savrulmalı
  step: def(0.2, 0.06, (v, t, r) => {
    const f = v.hiss(t, 0.045, 0.32, 'lowpass', 900 * r, 1.1, 0.002);
    glide(f.frequency, t, 900 * r, 380 * r, 0.045);
  }, 0.2, false, 0.08),

  // Memnun müşteri — küçük yükselen cıvıltı
  customer_happy: def(0.4, 0.2, (v, t, r) => {
    v.tone(t, 880 * r, 0.07, 0.2, 'triangle', 0.004);
    v.tone(t + 0.065, 1175 * r, 0.14, 0.2, 'triangle', 0.004);
  }, 0.08),

  // Kızgın müşteri — kısa inen vızıltı
  customer_angry: def(0.4, 0.14, (v, t, r) => {
    const lp = v.filter('lowpass', 800, 1.2);
    lp.connect(v.out);
    const o = v.osc('sawtooth', 240 * r);
    const g = v.gain(0);
    env(g.gain, t, 0.24, 0.006, 0.18);
    o.connect(g).connect(lp);
    glide(o.frequency, t, 240 * r, 132 * r, 0.18);
    v.play(o, t, 0.22);
  }, 0.1),
};

// ─── Müzik ──────────────────────────────────────────────────────────────────

/**
 * KAFE CAZI — yeniden yazıldı (2026-08-19).
 *
 * Eski motor "üretken ambiyans"tı: sürekli çalan bir ped + pentatonik
 * ölçekte RASTGELE YÜRÜYEN bir melodi + nabız. Üç yapısal sorunu vardı ve
 * hiçbiri ayar meselesi değildi:
 *
 *  1. SÜREKLİ PED = UĞULTU. Hiç susmayan, süzgeci LFO ile gezinen bir
 *     akor yığını müzik değil ORTAM GÜRÜLTÜSÜ olarak duyulur. (Kod
 *     yorumları bunu iki kez "araba sesi" diye not etmiş ve her seferinde
 *     ayarla çözmeye çalışmış.)
 *  2. RASTGELE YÜRÜYÜŞ = MOTİF YOK. Her nota bir öncekinin komşusu ama
 *     hiçbir cümle TEKRAR ETMİYOR. Müziği müzik yapan şey tekrardır;
 *     tekrarsız nota dizisi kulağa "çalınıyor" değil "çıkıyor" gelir.
 *  3. ARMONİ RENGİ YOK. Akorlar sus2 yığınıydı (kök + 5 + 9): üçlü yok,
 *     yedili yok, yani majör-minör ayrımı bile duyulmuyordu.
 *
 * Yeni motor gerçek bir parça çalar: 8 barlık caz ilerlemesi (ii–V–I
 * ailesi), kökten yürüyen bas, bossa hissi veren akor eşliği, ELDE YAZILMIŞ
 * dört melodi motifi (sırayla ve varyasyonla dönerler) ve şiddete göre giren
 * fırça perküsyon. Sürekli çalan hiçbir osilatör yok — her ses kendi
 * zarfıyla söner.
 */

/**
 * KARIŞIM ÖLÇÜLEREK KURULDU (analiz: music.out'a bağlanan AnalyserNode).
 *
 * İlk denemede bas 0,30 tepe değerindeydi ve tayf şöyle çıkıyordu:
 * 60–180 Hz **95**, 500 Hz–2 kHz **21**, 2–6 kHz **1,7**. Telefon
 * hoparlörü 200 Hz altını zaten basmaz — yani oyuncunun duyacağı TEK
 * şey neredeyse duyulmayan bir melodi olurdu. Bas yarıya indirildi,
 * eşlik iki katına, melodi %70 arttı, fırça perküsyon öne alındı.
 */
const BPM = 88;
/** Sekizlik kaydırma (swing). 0 = düz, 0,2 = belirgin salınım. */
const SWING = 0.14;

type ChordKind = 'maj7' | 'm7' | 'dom7';

/** Akor tonları (kökten yarım ton). Dokuzlu her akorda var: kafe rengi. */
const VOICING: Record<ChordKind, number[]> = {
  maj7: [0, 4, 7, 11, 14],
  m7: [0, 3, 7, 10, 14],
  dom7: [0, 4, 7, 10, 14],
};

interface Bar {
  root: number;
  kind: ChordKind;
}

/**
 * A bölümü — F majör: | Fmaj7 | Dm7 | Gm7 | C7 | Fmaj7 | Am7 | B♭maj7 | C7 |
 * B bölümü ilişkili minöre uğrar ve geri döner; iki bölüm dönüşümlü çalınır,
 * böylece uzun oturumda döngü ezberlenmez.
 */
const SECTION_A: Bar[] = [
  { root: 53, kind: 'maj7' }, // F
  { root: 50, kind: 'm7' }, // Dm
  { root: 55, kind: 'm7' }, // Gm
  { root: 48, kind: 'dom7' }, // C7
  { root: 53, kind: 'maj7' }, // F
  { root: 57, kind: 'm7' }, // Am
  { root: 58, kind: 'maj7' }, // B♭
  { root: 48, kind: 'dom7' }, // C7
];
const SECTION_B: Bar[] = [
  { root: 50, kind: 'm7' }, // Dm
  { root: 55, kind: 'm7' }, // Gm
  { root: 48, kind: 'dom7' }, // C7
  { root: 53, kind: 'maj7' }, // F
  { root: 58, kind: 'maj7' }, // B♭
  { root: 52, kind: 'm7' }, // Em7♭5 yerine sade Em7 — pastel kalsın
  { root: 57, kind: 'm7' }, // Am
  { root: 48, kind: 'dom7' }, // C7
];

/** F majör dizisi, melodi kaydı (MIDI). Motifler bunun İNDİSLERİNİ taşır. */
const SCALE = [65, 67, 69, 70, 72, 74, 76, 77, 79, 81, 82, 84];

interface MelStep {
  /** Bar içindeki 16'lık adım (0..15). */
  s: number;
  /** SCALE indisi. */
  d: number;
  /** Süre, 16'lık cinsinden. */
  l: number;
}

/**
 * ELDE YAZILMIŞ MOTİFLER — rastgele yürüyüşün yerine geçen şey budur.
 *
 * Dördü de aynı ailedendir (aynı ölçek, benzer aralık), yani art arda
 * gelince tek bir ezginin cümleleri gibi duyulurlar. Motif seçimi cümle
 * numarasından TÜRETİLİR (rastgele değil): aynı yerde aynı cümle geri
 * gelir, kulak parçayı tanır.
 */
const MOTIFS: MelStep[][] = [
  [
    { s: 0, d: 4, l: 3 },
    { s: 4, d: 5, l: 2 },
    { s: 6, d: 7, l: 5 },
    { s: 12, d: 5, l: 4 },
  ],
  [
    { s: 2, d: 7, l: 2 },
    { s: 4, d: 6, l: 2 },
    { s: 6, d: 4, l: 6 },
    { s: 14, d: 2, l: 2 },
  ],
  [
    { s: 0, d: 2, l: 3 },
    { s: 4, d: 4, l: 3 },
    { s: 8, d: 5, l: 3 },
    { s: 12, d: 7, l: 4 },
  ],
  [
    { s: 4, d: 9, l: 2 },
    { s: 6, d: 8, l: 2 },
    { s: 8, d: 7, l: 4 },
    { s: 13, d: 5, l: 3 },
  ],
];

/**
 * BOSSA EŞLİK KALIBI — 16'lık adımlarda akorun vurulduğu yerler.
 *
 * Düzenli 4/4 vuruş "metronom" gibi durur; bossa kalıbı senkoplu olduğu
 * için aynı akorlar bile canlı duyulur. Bar tekil/çift olduğuna göre iki
 * kalıp dönüşür — iki barlık bir soluk kurar.
 */
const COMP_EVEN = [0, 6, 10];
const COMP_ODD = [3, 6, 12];

/**
 * Sekizlik salınımı: çift 16'lıklar yerinde, tek olanlar geriye kaydırılır.
 * Adım süresi cinsinden gecikme döner.
 */
function swingOffset(step16: number): number {
  return step16 % 2 === 1 ? SWING : 0;
}

class Music {
  private ctx: AudioContext;
  private out: GainNode;
  private mbus: SynthBus;

  private running = false;
  private nextTime = 0;
  /** Ayarlar'daki müzik kaydırıcısı (0..1) — MUSIC_LEVEL'ın çarpanı. */
  private vol = 1;
  /** Toplam 16'lık adım sayacı — bar ve bölüm bundan türer. */
  private step = 0;
  private appliedInt = -1;
  private notes: Voice[] = [];

  private onNoteEnd = (v: Voice): void => {
    const i = this.notes.indexOf(v);
    if (i >= 0) {
      this.notes[i] = this.notes[this.notes.length - 1];
      this.notes.pop();
    }
  };

  constructor(sound: SynthBus, output: GainNode) {
    this.ctx = sound.ctx;
    this.out = output;
    this.mbus = sound;
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Kaydırıcı sürüklenirken anında duyulsun diye doğrudan veriyoluna yazar. */
  setVolume(v: number, now: number): void {
    this.vol = v;
    if (this.running) rampTo(this.out.gain, v, 0.08, now);
  }

  start(now: number): void {
    if (this.running) return;
    this.running = true;
    rampTo(this.out.gain, this.vol, 0.6, now);
    this.nextTime = now + 0.15;
    /** Parça daima barın başında başlar — yarım cümleden girmez. */
    this.step = 0;
    this.appliedInt = -1;
  }

  stop(now: number): void {
    if (!this.running) return;
    this.running = false;
    rampTo(this.out.gain, 0, 0.5, now);
  }

  /**
   * Yoğunluk TEMPOYU DEĞİŞTİRMEZ.
   *
   * Eski motor tempoyu 58–92 BPM arasında geziyordu; müzikte tempo
   * değişimi en sert olaydır, kafe dolduğunda parça hızlanıp yavaşlıyordu
   * ve bu "bozuk kayıt" hissi veriyordu. Yoğunluk artık yalnız KATMAN
   * açar: perküsyon girer, eşlik sıklaşır, melodi daha sık cümle kurar.
   */
  update(now: number, intensity: number): void {
    if (!this.running) return;
    if (Math.abs(intensity - this.appliedInt) > 0.05) this.appliedInt = intensity;

    const stepDur = 60 / BPM / 4; // 16'lık
    if (this.nextTime < now) this.nextTime = now + 0.02; // sekme sonrası hizala

    let guard = 0;
    while (this.nextTime < now + SCHED_AHEAD && guard++ < 32) {
      this.schedule(this.nextTime, stepDur, intensity);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  /** Cleanly suspends music, releasing all queued notes and zeroing output gain. */
  suspend(): void {
    if (!this.running) return;
    for (let i = this.notes.length - 1; i >= 0; i--) {
      this.notes[i].forceRelease();
    }
    this.notes.length = 0;
    try {
      this.out.gain.cancelScheduledValues(this.ctx.currentTime);
      this.out.gain.setValueAtTime(0, this.ctx.currentTime);
    } catch {
      /* ignore */
    }
  }

  /** Resumes playback synchronized cleanly to the next musical measure with a fade-in. */
  resume(now: number): void {
    if (!this.running) return;
    for (let i = this.notes.length - 1; i >= 0; i--) {
      this.notes[i].forceRelease();
    }
    this.notes.length = 0;
    this.step = Math.ceil(this.step / 16) * 16;
    this.nextTime = now + 0.05;
    rampTo(this.out.gain, this.vol, 0.4, now);
  }

  dispose(): void {
    this.running = false;
    for (let i = this.notes.length - 1; i >= 0; i--) this.notes[i].forceRelease();
    this.notes.length = 0;
  }

  /* ---------------------------------------------------------------- iç */

  private barAt(barIndex: number): Bar {
    // 8 bar A, 8 bar B, tekrar A…
    const section = Math.floor(barIndex / 8) % 2 === 0 ? SECTION_A : SECTION_B;
    return section[barIndex % 8];
  }

  private schedule(t0: number, stepDur: number, intensity: number): void {
    const s = this.step % 16; // bar içi 16'lık
    const barIndex = Math.floor(this.step / 16);
    const bar = this.barAt(barIndex);
    const t = t0 + swingOffset(s) * stepDur;
    const beat = stepDur * 4;

    /* --- BAS: kök (1) ve beşli (3), araya tek geçiş notası --- */
    if (s === 0) this.bass(t, bar.root - 24, beat * 1.6, 0.155);
    else if (s === 8) this.bass(t, bar.root - 24 + 7, beat * 1.2, 0.125);
    else if (s === 14 && intensity > 0.35) {
      const next = this.barAt(barIndex + 1).root - 24;
      this.bass(t, next - 2, stepDur * 1.6, 0.085); // yaklaşım notası
    }

    /* --- EŞLİK: bossa kalıbı, üst akor sesleri --- */
    const pattern = barIndex % 2 === 0 ? COMP_EVEN : COMP_ODD;
    if (pattern.indexOf(s) >= 0) {
      const v = VOICING[bar.kind];
      // Kökü bası yalnız bırakmak için atlar; 3-5-7-9'dan üçünü çalar.
      const pick = s === 0 ? [1, 2, 3] : [2, 3, 4];
      const freqs: number[] = [];
      for (const i of pick) freqs.push(midiToFreq(bar.root + v[i] + 12));
      this.comp(t, freqs, beat * 0.9, 0.23 + intensity * 0.05);
    }

    /* --- AKOR YASTIĞI: bar başında bir kez, yumuşak açılıp söner --- */
    if (s === 0) {
      const v = VOICING[bar.kind];
      this.pad(t, [midiToFreq(bar.root), midiToFreq(bar.root + v[2]), midiToFreq(bar.root + v[3])], beat * 3.6);
    }

    /* --- MELODİ: iki barda bir cümle; yoğunlukta her barda --- */
    const melBar = intensity > 0.55 ? true : barIndex % 2 === 0;
    if (melBar) {
      const motif = MOTIFS[(barIndex >> 1) % MOTIFS.length];
      /** Cümleler yükselerek gelsin: her ikinci turda bir derece yukarı. */
      const lift = Math.floor(barIndex / 16) % 2;
      for (const m of motif) {
        if (m.s !== s) continue;
        const idx = clamp(m.d + lift, 0, SCALE.length - 1);
        this.pluck(t, midiToFreq(SCALE[idx]), stepDur * m.l * 1.15, 0.17 + intensity * 0.07);
      }
    }

    /* --- PERKÜSYON: fırça takımı, yoğunlukla girer --- */
    const pulse = smoothstep((intensity - 0.18) / 0.5);
    if (pulse > 0.03) {
      if (s % 2 === 0) this.shaker(t, pulse * (s % 4 === 0 ? 1 : 0.55));
      if (s === 4 || s === 12) this.rim(t, pulse);
      if (s === 0) this.kick(t, pulse * 0.8);
    }
  }

  private newNote(send: number): Voice {
    const v = new Voice(this.mbus, 1, send, 0, this.onNoteEnd);
    this.notes.push(v);
    return v;
  }

  /** Kontrbas: sinüs + hafif üçüncü harmonik, çabuk sönen. */
  private bass(t: number, midi: number, dur: number, peak: number): void {
    const v = this.newNote(0.08);
    const f = midiToFreq(midi);
    const o = v.osc('sine', f);
    const o2 = v.osc('triangle', f * 2);
    const lp = v.filter('lowpass', 520, 0.7);
    const g = v.gain(0);
    const g2 = v.gain(0);
    env(g.gain, t, peak, 0.012, dur);
    env(g2.gain, t, peak * 0.16, 0.008, dur * 0.4);
    o.connect(g).connect(lp);
    o2.connect(g2).connect(lp);
    lp.connect(v.out);
    v.play(o, t, dur + 0.1);
    v.play(o2, t, dur * 0.5 + 0.1);
  }

  /** Naylon telli gitar / Rhodes karışımı akor vuruşu — tek seste 3 nota. */
  private comp(t: number, freqs: number[], dur: number, peak: number): void {
    const v = this.newNote(0.42);
    const lp = v.filter('lowpass', 2600, 0.7);
    lp.connect(v.out);
    for (let i = 0; i < freqs.length; i++) {
      const o = v.osc(i === 0 ? 'triangle' : 'sine', freqs[i]);
      const g = v.gain(0);
      // Arpej hissi: sesler 8 ms arayla girer, gerçek bir mızrap gibi.
      env(g.gain, t + i * 0.008, peak / freqs.length, 0.008, dur);
      o.connect(g).connect(lp);
      v.play(o, t, dur + 0.12);
    }
  }

  /** Melodi çalgısı: yumuşak, hafif nefesli bir Rhodes. */
  private pluck(t: number, freq: number, dur: number, peak: number): void {
    const v = this.newNote(0.55);
    const o = v.osc('triangle', freq);
    const o2 = v.osc('sine', freq * 2.01);
    const lp = v.filter('lowpass', 3000, 0.6);
    const g = v.gain(0);
    const g2 = v.gain(0);
    env(g.gain, t, peak, 0.02, dur);
    env(g2.gain, t, peak * 0.22, 0.02, dur * 0.55);
    o.connect(g).connect(lp);
    o2.connect(g2).connect(lp);
    lp.connect(v.out);
    v.play(o, t, dur + 0.15);
    v.play(o2, t, dur * 0.7 + 0.15);
  }

  /** Akor yastığı: yavaş açılan, uzun sönen üç sinüs. Sürekli DEĞİL. */
  private pad(t: number, freqs: number[], dur: number): void {
    const v = this.newNote(0.7);
    const lp = v.filter('lowpass', 1500, 0.5);
    lp.connect(v.out);
    for (let i = 0; i < freqs.length; i++) {
      const o = v.osc('sine', freqs[i], i === 1 ? 4 : i === 2 ? -3 : 0);
      const g = v.gain(0);
      env(g.gain, t, 0.05, 0.35, dur);
      o.connect(g).connect(lp);
      v.play(o, t, dur + 0.5);
    }
  }

  private shaker(t: number, amt: number): void {
    const v = this.newNote(0.2);
    v.hiss(t, 0.032, 0.085 * amt, 'highpass', 4200, 0.9, 0.002);
  }

  /** Fırça vuruşu: kısa, bantlı gürültü — trampet kenarı gibi. */
  private rim(t: number, amt: number): void {
    const v = this.newNote(0.3);
    v.hiss(t, 0.06, 0.09 * amt, 'bandpass', 2100, 2.0, 0.002);
  }

  /** Yumuşak ayak davulu: telefon hoparlöründe duyulan bantta kalır. */
  private kick(t: number, amt: number): void {
    const v = this.newNote(0.06);
    const o = v.tone(t, 110, 0.14, 0.075 * amt, 'sine', 0.004);
    glide(o.frequency, t, 110, 62, 0.12);
  }
}

// ─── Yönetici ───────────────────────────────────────────────────────────────

class AudioManagerImpl implements AudioManager {
  private ctx: AudioContext | null = null;
  private failed = false;
  private disposed = false;
  private suspended = false;
  private contextChange: Promise<void> | null = null;

  private master: GainNode | null = null;
  private sb: SynthBus | null = null;
  private music: Music | null = null;
  private graphNodes: AudioNode[] = [];

  private voices: Voice[] = [];
  private lastAt = new Map<string, number>();
  private ladderIdx = new Map<string, number>();

  private muted = false;
  private musicOn = true;
  private sfxVol = 1;
  private musicVol = 1;
  private sfxBusNode: GainNode | null = null;
  private intensity = 0;
  private intensityTarget = 0;

  private unsub: () => void;

  private onVoiceEnd = (v: Voice): void => {
    const i = this.voices.indexOf(v);
    if (i >= 0) {
      this.voices[i] = this.voices[this.voices.length - 1];
      this.voices.pop();
    }
  };

  private onBus = (p: { id: string; vol?: number; rate?: number }): void => {
    this.fire(p.id, p.vol ?? 1, p.rate ?? 1, 0);
  };

  constructor() {
    this.unsub = bus.on('sfx', this.onBus);
  }

  unlock(): void {
    if (this.disposed || this.failed) return;
    if (!this.ctx) {
      let made: AudioContext | null = null;
      try {
        const w = window as unknown as {
          AudioContext?: typeof AudioContext;
          webkitAudioContext?: typeof AudioContext;
        };
        const Ctor = w.AudioContext ?? w.webkitAudioContext;
        if (!Ctor) {
          this.failed = true;
          return;
        }
        const ctx = new Ctor({ latencyHint: 'interactive' });
        made = ctx;
        ctx.onstatechange = () => {
          if (!this.disposed && !this.suspended && this.ctx === ctx && ctx.state === 'suspended') {
            this.reconcileContextState();
          }
        };
        this.build(ctx);
      } catch {
        // Ses yoksa oyun sessizce devam eder — her metot artık boş geçer
        this.failed = true;
        this.ctx = null;
        this.master = null;
        this.sb = null;
        this.music = null;
        if (made) {
          try {
            void made.close().catch(() => undefined);
          } catch {
            /* yok say */
          }
        }
        return;
      }
    }
    // iOS WKWebView donanım ses kilidini aşmak için 1 karelik sessiz buffer çal
    if (this.ctx && this.ctx.state !== 'closed' && this.ctx.state !== 'running') {
      try {
        const buf = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.ctx.destination);
        src.start(0);
      } catch {
        /* yok say */
      }
    }
    this.reconcileContextState();
  }

  play(id: SfxId, opts?: { vol?: number; rate?: number; pan?: number }): void {
    this.fire(id, opts?.vol ?? 1, opts?.rate ?? 1, opts?.pan ?? 0);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (!this.ctx || !this.master) return;
    rampTo(this.master.gain, m ? 0 : MASTER_LEVEL, 0.12, this.ctx.currentTime);
    if (m) this.vacuum?.set(0, 0);
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMusicEnabled(on: boolean): void {
    if (this.musicOn === on) return;
    this.musicOn = on;
    if (!this.ctx || !this.music) return;
    const now = this.ctx.currentTime;
    if (on) this.music.start(now);
    else this.music.stop(now);
  }

  isMusicEnabled(): boolean {
    return this.musicOn;
  }

  setSfxVolume(v: number): void {
    const nv = clamp01(v);
    if (Math.abs(nv - this.sfxVol) < 0.001) return;
    this.sfxVol = nv;
    if (this.sfxBusNode && this.ctx) rampTo(this.sfxBusNode.gain, nv, 0.08, this.ctx.currentTime);
  }

  /**
   * Müzik seviyesi ÇALARKEN de değişebilmeli — kaydırıcıyı sürüklerken
   * anında duyulsun diye müziğin kuru ve yankılı toplam çıkışına yazılır.
   * Başlatma/durdurma rampaları da aynı çıkışı kullanır; ses oranı hem
   * ilk notada hem mevcut yankı kuyruğunda korunur.
   */
  setMusicVolume(v: number): void {
    const nv = clamp01(v);
    if (Math.abs(nv - this.musicVol) < 0.001) return;
    this.musicVol = nv;
    if (this.music) this.music.setVolume(nv, this.ctx ? this.ctx.currentTime : 0);
  }

  setIntensity(v: number): void {
    this.intensityTarget = clamp01(v);
  }

  private vacuum: VacuumSound | null = null;
  // Read-only source handles used by lifecycle verification.
  private get vacSrc(): AudioBufferSourceNode | null { return this.vacuum?.air ?? null; }
  private get vacMotor(): OscillatorNode | null { return this.vacuum?.motor ?? null; }

  setVacuum(level: number, suction: number): void {
    if (this.disposed || this.failed || this.suspended) return;
    const ctx = this.ctx, sb = this.sb;
    if (!ctx || !sb || ctx.state !== 'running') return;
    const lv = this.muted || this.sfxVol <= 0 ? 0 : clamp01(level);
    if (lv <= 0 && !this.vacuum) return;
    if (!this.vacuum) this.vacuum = new VacuumSound(ctx, sb.noise, sb.dry);
    this.vacuum.set(lv, clamp01(suction));
  }

  private stopVacuum(): void {
    this.vacuum?.dispose();
    this.vacuum = null;
  }

  update(dt: number): void {
    if (this.disposed || this.failed) return;
    const ctx = this.ctx;
    if (!ctx || this.suspended || ctx.state !== 'running') return; // askıdayken planlama yapma

    if (this.vacuum?.finished) this.stopVacuum();

    const d = dt > 0.25 ? 0.25 : dt; // sekmeden dönüşte sıçramayı kırp
    this.intensity = damp(this.intensity, this.intensityTarget, 1.2, d);

    const now = ctx.currentTime;

    // Güvenlik ağı: bir şekilde bitmeyen sesleri kopart (düğüm sızıntısı olmasın)
    for (let i = this.voices.length - 1; i >= 0; i--) {
      if (now - this.voices[i].bornAt > STUCK_AFTER) this.voices[i].forceRelease();
    }

    if (this.music) this.music.update(now, this.intensity);
  }

  setSuspended(v: boolean): void {
    if (this.disposed) return;
    this.suspended = v;
    if (v) {
      // 1. Süpürge sesini anında durdur
      this.stopVacuum();
      // 2. Bekleyen SFX seslerini anında serbest bırak
      for (let i = this.voices.length - 1; i >= 0; i--) {
        this.voices[i].forceRelease();
      }
      this.voices.length = 0;
      // 3. Müzik kuyruğunu boşalt ve sustur
      this.music?.suspend();
      // 4. Donanım çıtırtısı olmadan 15ms içinde master sesi tamamen kapat
      if (this.ctx && this.master) {
        try {
          const now = this.ctx.currentTime;
          this.master.gain.cancelScheduledValues(now);
          this.master.gain.setValueAtTime(this.master.gain.value, now);
          this.master.gain.linearRampToValueAtTime(0, now + 0.015);
        } catch {
          /* yok say */
        }
      }
    }
    this.reconcileContextState();
  }

  /** Native suspend/resume resolves later; always settle on the latest request. */
  private reconcileContextState(): void {
    const ctx = this.ctx;
    if (!ctx || this.disposed || this.contextChange || ctx.state === 'closed') return;
    const requested = this.suspended;
    if (requested ? ctx.state === 'suspended' : ctx.state === 'running') {
      if (!requested && this.master) {
        const now = ctx.currentTime;
        this.music?.resume(now);
        rampTo(this.master.gain, this.muted ? 0 : MASTER_LEVEL, 0.06, now);
      }
      return;
    }
    try {
      const operation = requested ? ctx.suspend() : ctx.resume();
      this.contextChange = operation
        .then(() => {
          if (!this.disposed && this.ctx === ctx && !this.suspended) {
            const now = ctx.currentTime;
            this.music?.resume(now);
            if (this.master) {
              rampTo(this.master.gain, this.muted ? 0 : MASTER_LEVEL, 0.06, now);
            }
          }
        })
        .catch(() => undefined)
        .finally(() => {
          this.contextChange = null;
          if (!this.disposed && this.ctx === ctx && requested !== this.suspended) {
            this.reconcileContextState();
          }
        });
    } catch {
      /* An unavailable audio device must not interrupt play. */
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsub();
    this.stopVacuum();
    if (this.music) {
      this.music.dispose();
      this.music = null;
    }
    for (let i = this.voices.length - 1; i >= 0; i--) this.voices[i].forceRelease();
    this.voices.length = 0;
    for (let i = 0; i < this.graphNodes.length; i++) {
      try {
        this.graphNodes[i].disconnect();
      } catch {
        /* yok say */
      }
    }
    this.graphNodes.length = 0;
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.sb = null;
    this.sfxBusNode = null;
    this.lastAt.clear();
    this.ladderIdx.clear();
    if (ctx) {
      try {
        void ctx.close().catch(() => undefined);
      } catch {
        /* yok say */
      }
    }
  }

  // — iç işler —

  /** master → yumuşak kompresör → çıkış, paralelde reverb gönderisi. */
  private build(ctx: AudioContext): void {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -13;
    comp.knee.value = 26;
    comp.ratio.value = 3.6;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    comp.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : MASTER_LEVEL;
    master.connect(comp);

    const sfxBus = ctx.createGain();
    sfxBus.gain.value = this.sfxVol;
    sfxBus.connect(master);
    this.sfxBusNode = sfxBus;

    // Sum dry sound and its reverb tail BEFORE each category's user gain.
    // The immutable room impulse is shared; separate returns keep a muted
    // category from leaking through the other one.
    const impulse = createImpulseResponse(ctx, 1.1, 3.1);
    const makeReverb = (output: GainNode): GainNode => {
      const send = ctx.createGain();
      const conv = ctx.createConvolver();
      conv.normalize = true;
      conv.buffer = impulse;
      const reverbReturn = ctx.createGain();
      reverbReturn.gain.value = 0.5;
      send.connect(conv);
      conv.connect(reverbReturn);
      reverbReturn.connect(output);
      this.graphNodes.push(send, conv, reverbReturn);
      return send;
    };
    const sfxSend = makeReverb(sfxBus);
    const musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(master);
    const musicDry = ctx.createGain();
    musicDry.gain.value = MUSIC_LEVEL;
    musicDry.connect(musicBus);
    const musicSend = ctx.createGain();
    musicSend.gain.value = MUSIC_SEND;
    musicSend.connect(makeReverb(musicBus));

    const noise = createNoiseBuffer(ctx, 2);
    this.ctx = ctx;
    this.master = master;
    this.sb = { ctx, dry: sfxBus, wet: sfxSend, noise };
    this.graphNodes.push(comp, master, sfxBus, musicBus, musicDry, musicSend);

    this.music = new Music({ ctx, dry: musicDry, wet: musicSend, noise }, musicBus);
    this.music.setVolume(this.musicVol, ctx.currentTime);
    if (this.musicOn) this.music.start(ctx.currentTime);
  }

  private fire(id: string, vol: number, rate: number, pan: number): void {
    if (this.disposed || this.failed || this.muted || this.suspended) return;
    const ctx = this.ctx;
    const sb = this.sb;
    if (!ctx || !sb || ctx.state !== 'running') return;

    const d = SFX[id as SfxId] as SfxDef | undefined;
    if (!d) return; // bilinmeyen id — sessizce yok say

    const now = ctx.currentTime;
    const last = this.lastAt.get(id) ?? -999;

    // Spam kırpma: aynı id çok sık gelirse fazlasını at
    if (d.gap > 0 && now - last < d.gap) return;

    // Perde merdiveni: hızlı tekrarlar pentatonik olarak tırmanır, sessizlikte sıfırlanır
    if (d.ladder) {
      const prev = this.ladderIdx.get(id) ?? 0;
      const s = now - last > LADDER_RESET ? 0 : Math.min(prev + 1, LADDER_RATIO.length - 1);
      this.ladderIdx.set(id, s);
      rate *= LADDER_RATIO[s];
    }
    this.lastAt.set(id, now);

    if (d.jitter > 0) rate *= 1 + (Math.random() * 2 - 1) * d.jitter;

    const level = clamp(d.gain * vol, 0, 2);
    if (level <= 0.001) return;

    // Ses bütçesi: dolu ise en sessiz + en eski olanı feda et.
    // Susturulan ses dizide kalır (kendi `onended`'inde temizlenir), bütçede sayılmaz.
    let live = 0;
    let worst = -1;
    let worstScore = Infinity;
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i];
      if (v.dying) continue;
      live++;
      const score = v.level - (now - v.bornAt) * 0.25;
      if (score < worstScore) {
        worstScore = score;
        worst = i;
      }
    }
    if (live >= MAX_VOICES) {
      if (worst < 0 || worstScore > level) return; // çalanların hepsi daha önemli
      this.voices[worst].kill(now);
    }

    const v = new Voice(sb, level, d.send, clamp(pan, -1, 1), this.onVoiceEnd);
    this.voices.push(v);
    try {
      d.make(v, now + 0.005, clamp(rate, 0.25, 4));
    } catch {
      v.forceRelease();
    }
  }
}

export function createAudio(): AudioManager {
  return new AudioManagerImpl();
}
