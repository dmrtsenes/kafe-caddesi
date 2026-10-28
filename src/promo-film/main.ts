import { createCinematic } from './cinematic';
import { COPY } from '../promo-ua/copy';
import * as O from '../promo-ua/overlay';

const W = 1080, H = 1920, FPS = 30, DURATION = 27;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const x = clamp(v); return x * x * (3 - 2 * x); };
const film = document.querySelector<HTMLCanvasElement>('#film')!;
const ctx = film.getContext('2d', { alpha: false })!;

async function boot() {
  await Promise.all([document.fonts.load('100px Paytone'), document.fonts.load('700 48px Barlow')]);
  await document.fonts.ready;
  const [cinema, assets] = await Promise.all([
    createCinematic(document.querySelector<HTMLCanvasElement>('#stage')!), O.loadAssets(COPY.tr),
  ]);
  const stage = document.querySelector<HTMLCanvasElement>('#stage')!;
  const video = document.createElement('video');
  video.muted = true; video.preload = 'auto'; video.playsInline = true;
  video.src = '/campaign-ua/source/picture-tr.mp4';
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error(`Source film failed: ${video.error?.message}`));
    video.load();
  });
  const backdrop = document.createElement('canvas'); backdrop.width = W; backdrop.height = H;
  const backCtx = backdrop.getContext('2d')!;
  cinema.render(4.1); backCtx.drawImage(stage, 0, 0, W, H);

  async function seek(t: number): Promise<void> {
    if (Math.abs(video.currentTime - t) < 0.0002 && video.readyState >= 2) return;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => { cleanup(); reject(new Error(`Video seek timed out at ${t}`)); }, 15000);
      const done = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error('Source video seek failed')); };
      const cleanup = () => { clearTimeout(timer); video.removeEventListener('seeked', done); video.removeEventListener('error', fail); };
      video.addEventListener('seeked', done); video.addEventListener('error', fail);
      video.currentTime = Math.max(0, Math.min(29.95, t));
    });
  }

  function line(text: string, y: number, size: number, color = O.C.cream) {
    ctx.font = `${size}px Paytone`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    while (ctx.measureText(text).width > 900 && size > 20) ctx.font = `${--size}px Paytone`;
    ctx.lineJoin = 'round'; ctx.strokeStyle = O.C.deep; ctx.lineWidth = 12;
    ctx.strokeText(text, W / 2, y); ctx.fillStyle = color; ctx.fillText(text, W / 2, y);
  }
  function introTitles(t: number) {
    const shade = ctx.createLinearGradient(0, 0, 0, 620);
    shade.addColorStop(0, 'rgba(4,26,29,.36)'); shade.addColorStop(1, 'rgba(4,26,29,0)');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, 620);
    ctx.save(); ctx.fillStyle = O.C.cream; ctx.textAlign = 'center'; ctx.font = '700 32px Barlow';
    ctx.letterSpacing = '5px'; ctx.fillText('KAFE CADDESİ', W / 2, 288); ctx.letterSpacing = '0px'; ctx.restore();
    if (t < 2.65) {
      const a = 1 - smooth((t - 2.25) / 0.35);
      ctx.save(); ctx.globalAlpha = a;
      O.title(ctx, 'EYVAH!', 540, 405, { age: t + 0.1, size: 146, fill: '#FFF8E8', fill2: '#FFD26D', rot: -4, maxW: 860 });
      ctx.restore();
    } else {
      O.title(ctx, 'KONTROL', 540, 373, { age: t - 2.65, size: 102, fill: O.C.cream, rot: -2, maxW: 860 });
      O.title(ctx, 'SENDE.', 540, 495, { age: t - 2.8, size: 128, fill: O.C.gold, rot: -2, maxW: 860 });
    }
  }

  function fixUpgradeLabels(t: number) {
    const age = t - 15.5;
    if (age < 0 || age >= 2.1) return;
    const y = 1040 + (1 - O.easeOut((age - 0.05) / 0.25)) * 900 + O.easeInOut((age - 1.85) / 0.25) * 900;
    if (y > H) return;
    for (const [i, name, level] of [[0, 'HIZ', age >= 1.55 ? 5 : 4], [1, 'TEPSİ', age >= 1.08 ? 6 : age >= 0.62 ? 5 : 4]] as const) {
      const ry = y + 40 + i * 160;
      ctx.fillStyle = '#16504F'; ctx.fillRect(238, ry + 12, 410, 66);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '50px Paytone'; ctx.fillStyle = O.C.cream;
      ctx.fillText(name, 242, ry + 48);
      ctx.font = '700 40px Barlow'; ctx.fillStyle = O.C.mint; ctx.textAlign = 'right';
      ctx.fillText(`SV. ${level}`, 615, ry + 50);
    }
  }

  function endcard(age: number, t: number) {
    ctx.save();
    ctx.filter = 'blur(18px)';
    const scale = 1.08 + age * 0.007;
    ctx.drawImage(backdrop, (W - W * scale) / 2, (H - H * scale) / 2, W * scale, H * scale);
    ctx.filter = 'none';
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(4,41,45,.96)'); g.addColorStop(.58, 'rgba(10,73,68,.94)'); g.addColorStop(1, 'rgba(5,37,41,.97)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const halo = ctx.createRadialGradient(540, 660, 40, 540, 660, 800);
    halo.addColorStop(0, 'rgba(136,226,180,.16)'); halo.addColorStop(1, 'rgba(136,226,180,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
    // Quiet cafe-shaped curves frame the endcard without competing with the stores.
    ctx.strokeStyle = 'rgba(172,231,202,.07)'; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath(); ctx.ellipse(540, 680, 390 + i * 75 + Math.sin(t * .4) * 5, 610 + i * 95, -.2, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const x = 70 + ((i * 197) % 940), y = 160 + ((i * 313 - age * (10 + i % 4 * 4) + 1920) % 1670);
      O.star4(ctx, x, y, 2 + i % 3, i + t * .1, '#FFE5A2', .22 + .12 * Math.sin(i + t));
    }
    const intro = smooth((age + .03) / .35);
    ctx.translate(0, (1 - intro) * 42);
    ctx.globalAlpha = intro;
    O.appIcon(ctx, assets, 540, 350, 148, t);
    const lw = 610, lh = lw * 607 / 858;
    ctx.drawImage(assets.logo, 168, 36, 858, 607, 540 - lw / 2, 650 - lh / 2, lw, lh);
    ctx.fillStyle = O.C.cream; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 47px Barlow';
    ctx.fillText('KÜÇÜK BAŞLA. HAYALİNİ BÜYÜT.', 540, 898);
    ctx.globalAlpha = smooth((age - .42) / .3);
    const bx = 225, by = 936, bw = 630, bh = 132;
    ctx.shadowColor = 'rgba(255,195,65,.18)'; ctx.shadowBlur = 28;
    const gold = ctx.createLinearGradient(0, by, 0, by + bh); gold.addColorStop(0, '#FFE29A'); gold.addColorStop(1, '#FFBD34');
    O.pill(ctx, bx, by, bw, bh, gold); ctx.shadowBlur = 0;
    ctx.fillStyle = '#0B3B3C'; ctx.font = '68px Paytone'; ctx.fillText('ŞİMDİ İNDİR', 540, by + bh / 2 - 1);
    // Full badges stay above y=1248, away from the lower Reels interface.
    ctx.globalAlpha = smooth((age - .68) / .25);
    O.storeBadges(ctx, assets, 540, 1124, 100);
    ctx.restore();
  }

  let lastFrame = -1;
  async function render(n: number): Promise<void> {
    if (!Number.isInteger(n) || n < 0 || n >= FPS * DURATION) throw new RangeError(`Frame ${n}`);
    const t = n / FPS;
    ctx.resetTransform(); ctx.globalAlpha = 1; ctx.filter = 'none';
    if (t < 5) {
      cinema.render(t); ctx.drawImage(stage, 0, 0, W, H); introTitles(t);
    } else if (t < 23) {
      const oldTime = t < 14 ? t - 1 : t;
      await seek(oldTime + .00001); ctx.drawImage(video, 0, 0, W, H); fixUpgradeLabels(t);
      if (t < 5.2) {
        const a = 1 - smooth((t - 5) / .2); ctx.fillStyle = `rgba(255,225,157,${a * .3})`; ctx.fillRect(0, 0, W, H);
      }
    } else {
      endcard(t - 23, t);
    }
    lastFrame = n;
  }

  const api = {
    render,
    jpeg: () => film.toDataURL('image/jpeg', .97).split(',')[1],
    png: () => film.toDataURL('image/png').split(',')[1],
    report: () => ({ width: W, height: H, fps: FPS, duration: DURATION, frame: lastFrame, endcardSafeArea: { x: 168, y: 292, right: 912, bottom: 1224 }, sources: ['Procedural animated cinematic', 'Existing game advertising capture', 'Existing brand and official store badge files'] }),
  };
  (window as unknown as { __film: typeof api }).__film = api;
  document.querySelector('#loading')?.remove();
  await render(0);
  if (!new URLSearchParams(location.search).has('capture')) {
    let n = 0;
    const run = async () => { await render(n++ % (FPS * DURATION)); setTimeout(run, 1000 / FPS); };
    void run();
  }
}

boot().catch(error => {
  console.error(error);
  const loading = document.querySelector('#loading'); if (loading) loading.textContent = `Film açılamadı: ${error.message}`;
});
