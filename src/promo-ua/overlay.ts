/** 2D motion graphics for the UA film. Everything is drawn procedurally on the film canvas. */
import type { AdCopy } from './copy';

export const W = 1080, H = 1920;
export const C = {
  ink: '#103D40', deep: '#082D32', teal: '#128D80', mint: '#9FE9C5', cream: '#FFF3D7',
  gold: '#FFC44A', copper: '#BB7037', red: '#E5483B', green: '#3BC46B', white: '#FFFFFF',
};
type Ctx = CanvasRenderingContext2D;

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;
export const easeInOut = (x: number) => { const t = clamp01(x); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; };
/** Overshooting pop 0→1 used for every element entrance. */
export function popScale(age: number, dur = 0.32): number {
  if (age <= 0) return 0;
  const t = clamp01(age / dur);
  const c1 = 2.2, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpN = lerp;

/* ---------------------------------------------------------------- assets */
export interface Assets {
  logo: HTMLImageElement; icon: HTMLImageElement; gp: HTMLImageElement; as: HTMLImageElement;
  gpCrop: [number, number, number, number];
}
function load(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('asset ' + src)); i.src = src; });
}
/** The Play badge PNG ships with transparent padding; trim it so both badges share one height. */
function alphaBox(img: HTMLImageElement): [number, number, number, number] {
  const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const g = cv.getContext('2d')!; g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, cv.width, cv.height).data;
  let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
    if (d[(y * cv.width + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}
export async function loadAssets(copy: AdCopy): Promise<Assets> {
  const [logo, icon, gp, as] = await Promise.all([load(copy.logo), load('/campaign-ua/brand/icon-1024.png'), load(copy.googlePlay), load(copy.appStore)]);
  return { logo, icon, gp, as, gpCrop: alphaBox(gp) };
}

/* ---------------------------------------------------------------- text */
export interface TitleOpts {
  size?: number; fill?: string; fill2?: string; stroke?: string; age: number; rot?: number;
  maxW?: number; align?: CanvasTextAlign; shake?: number; time?: number; font?: string; outline?: number;
}
/** Chunky ad headline: extruded shadow, thick outline, vertical gradient, pop-in. */
export function title(c: Ctx, text: string, x: number, y: number, o: TitleOpts): void {
  const s = popScale(o.age);
  if (s <= 0.001) return;
  let size = o.size ?? 104;
  const font = o.font ?? 'Paytone';
  c.font = `${size}px ${font}`;
  const maxW = o.maxW ?? 960;
  while (c.measureText(text).width > maxW && size > 30) c.font = `${--size}px ${font}`;
  const t = o.time ?? 0, sh = o.shake ?? 0;
  c.save();
  c.translate(x + (sh ? Math.sin(t * 61) * sh : 0), y + (sh ? Math.cos(t * 47) * sh * 0.7 : 0));
  c.rotate(((o.rot ?? 0) * Math.PI) / 180);
  c.scale(s, s);
  c.textAlign = o.align ?? 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.miterLimit = 2;
  const ol = o.outline ?? Math.max(8, size * 0.15);
  const dark = o.stroke ?? C.deep;
  c.fillStyle = dark; c.strokeStyle = dark; c.lineWidth = ol;
  for (let d = size * 0.1; d > 0; d -= 2) { c.strokeText(text, 0, d); c.fillText(text, 0, d); }
  c.strokeText(text, 0, 0);
  const g = c.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
  g.addColorStop(0, o.fill ?? C.white);
  g.addColorStop(1, o.fill2 ?? o.fill ?? C.white);
  c.fillStyle = g;
  c.fillText(text, 0, 0);
  c.restore();
}

export function pill(c: Ctx, x: number, y: number, w: number, h: number, fill: string | CanvasGradient, stroke?: string, lw = 6): void {
  c.beginPath(); c.roundRect(x, y, w, h, h / 2); c.fillStyle = fill; c.fill();
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}

/* ---------------------------------------------------------------- icons */
export function coin(c: Ctx, x: number, y: number, r: number, spin = 0): void {
  const sx = Math.max(0.18, Math.abs(Math.cos(spin)));
  c.save(); c.translate(x, y); c.scale(sx, 1);
  c.beginPath(); c.arc(0, r * 0.12, r, 0, Math.PI * 2); c.fillStyle = '#B57A12'; c.fill();
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
  const g = c.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#FFE78A'); g.addColorStop(1, '#F2A81B');
  c.fillStyle = g; c.fill(); c.lineWidth = r * 0.12; c.strokeStyle = '#8A5A0C'; c.stroke();
  c.beginPath(); c.arc(0, 0, r * 0.66, 0, Math.PI * 2); c.lineWidth = r * 0.1; c.strokeStyle = 'rgba(160,100,10,.55)'; c.stroke();
  c.fillStyle = '#C47F0F'; c.font = `${Math.round(r * 1.05)}px Paytone`; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (sx > 0.45) c.fillText('★', 0, r * 0.05);
  c.beginPath(); c.ellipse(-r * 0.35, -r * 0.42, r * 0.28, r * 0.13, -0.6, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.65)'; c.fill();
  c.restore();
}

export function star4(c: Ctx, x: number, y: number, r: number, rot = 0, color = '#FFFFFF', alpha = 1): void {
  if (r <= 0.5 || alpha <= 0) return;
  c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha *= alpha;
  c.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.28 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  c.closePath(); c.fillStyle = color; c.shadowColor = color; c.shadowBlur = r * 0.8; c.fill();
  c.restore();
}

export function heart(c: Ctx, x: number, y: number, r: number): void {
  c.save(); c.translate(x, y);
  const p = new Path2D();
  p.moveTo(0, r * 0.95);
  p.bezierCurveTo(-r * 1.25, r * 0.1, -r * 1.05, -r * 0.95, 0, -r * 0.42);
  p.bezierCurveTo(r * 1.05, -r * 0.95, r * 1.25, r * 0.1, 0, r * 0.95);
  c.lineJoin = 'round'; c.lineWidth = r * 0.22; c.strokeStyle = C.deep; c.stroke(p);
  const g = c.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#FF7A8A'); g.addColorStop(1, '#E2334F');
  c.fillStyle = g; c.fill(p);
  c.beginPath(); c.ellipse(-r * 0.45, -r * 0.3, r * 0.2, r * 0.12, -0.7, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.75)'; c.fill();
  c.restore();
}

/** Furious face with steam puffs, sized by radius. */
export function angryFace(c: Ctx, x: number, y: number, r: number, t: number): void {
  c.save(); c.translate(x + Math.sin(t * 40) * r * 0.06, y);
  for (const side of [-1, 1]) {
    const k = (t * 1.6 + (side > 0 ? 0.5 : 0)) % 1;
    c.globalAlpha = 0.85 * (1 - k);
    c.beginPath(); c.arc(side * r * (1.05 + k * 0.5), -r * (0.7 + k * 0.6), r * (0.2 + k * 0.18), 0, Math.PI * 2);
    c.fillStyle = '#FFFFFF'; c.fill();
  }
  c.globalAlpha = 1;
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
  const g = c.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r); g.addColorStop(0, '#FF8A5C'); g.addColorStop(1, '#D9342B');
  c.fillStyle = g; c.fill(); c.lineWidth = r * 0.13; c.strokeStyle = C.deep; c.stroke();
  c.strokeStyle = C.deep; c.lineCap = 'round'; c.lineWidth = r * 0.16;
  c.beginPath(); c.moveTo(-r * 0.62, -r * 0.42); c.lineTo(-r * 0.16, -r * 0.2); c.moveTo(r * 0.62, -r * 0.42); c.lineTo(r * 0.16, -r * 0.2); c.stroke();
  c.fillStyle = C.deep;
  c.beginPath(); c.arc(-r * 0.33, -r * 0.02, r * 0.11, 0, Math.PI * 2); c.arc(r * 0.33, -r * 0.02, r * 0.11, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(-r * 0.38, r * 0.5); c.quadraticCurveTo(0, r * 0.18, r * 0.38, r * 0.5); c.lineWidth = r * 0.14; c.stroke();
  c.restore();
}

/** Cartoon pointer hand; (x, y) is the fingertip. */
export function hand(c: Ctx, x: number, y: number, scale = 1, press = 0): void {
  c.save(); c.translate(x, y); c.scale(scale * (1 - press * 0.08), scale * (1 - press * 0.08)); c.rotate(-0.38);
  const p = new Path2D();
  p.roundRect(-17, 0, 34, 120, 17);
  p.roundRect(14, 64, 32, 74, 16);
  p.roundRect(42, 76, 30, 66, 15);
  p.roundRect(-46, 96, 40, 30, 15);
  p.roundRect(-22, 80, 96, 112, 34);
  c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 18; c.shadowOffsetY = 10;
  c.lineJoin = 'round'; c.lineWidth = 11; c.strokeStyle = C.deep; c.stroke(p);
  c.shadowColor = 'transparent';
  c.fillStyle = '#FFFFFF'; c.fill(p);
  c.fillStyle = '#E3EEF0';
  c.beginPath(); c.roundRect(-22, 150, 96, 42, 20); c.fill();
  c.strokeStyle = 'rgba(8,45,50,.35)'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(14, 96); c.lineTo(14, 120); c.moveTo(43, 104); c.lineTo(43, 124); c.stroke();
  c.restore();
}

export function tapRipple(c: Ctx, x: number, y: number, age: number): void {
  if (age < 0 || age > 0.6) return;
  for (let i = 0; i < 2; i++) {
    const a = age - i * 0.12;
    if (a < 0) continue;
    const k = a / 0.48;
    if (k > 1) continue;
    c.beginPath(); c.arc(x, y, 18 + k * 90, 0, Math.PI * 2);
    c.lineWidth = 10 * (1 - k); c.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`; c.stroke();
  }
}

/* ---------------------------------------------------------------- HUD widgets */
export function progressBar(c: Ctx, x: number, y: number, w: number, h: number, p: number, label: string, good: boolean, t: number): void {
  pill(c, x - 6, y - 6, w + 12, h + 12, C.deep);
  pill(c, x, y, w, h, '#24474A');
  const fw = Math.max(h, w * clamp01(p));
  const g = c.createLinearGradient(0, y, 0, y + h);
  if (good) { g.addColorStop(0, '#8BF0A6'); g.addColorStop(1, '#25A85A'); } else { g.addColorStop(0, '#FF8B6B'); g.addColorStop(1, '#C72E2E'); }
  c.save(); c.beginPath(); c.roundRect(x, y, w, h, h / 2); c.clip();
  pill(c, x, y, fw, h, g);
  c.globalAlpha = 0.25; c.fillStyle = '#FFFFFF';
  for (let sx = x - 80 + ((t * 160) % 60); sx < x + fw; sx += 60) { c.beginPath(); c.moveTo(sx, y + h); c.lineTo(sx + 26, y); c.lineTo(sx + 50, y); c.lineTo(sx + 24, y + h); c.fill(); }
  c.globalAlpha = 1;
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, y + 5, fw, h * 0.22);
  c.restore();
  c.font = `700 ${Math.round(h * 0.62)}px Barlow`; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.textAlign = 'left'; c.lineWidth = 7; c.strokeStyle = C.deep; c.strokeText(label, x + 22, y + h / 2 + 2); c.fillStyle = C.white; c.fillText(label, x + 22, y + h / 2 + 2);
  const pct = '%' + Math.round(clamp01(p) * 100);
  c.textAlign = 'right'; c.strokeText(pct, x + w - 22, y + h / 2 + 2); c.fillText(pct, x + w - 22, y + h / 2 + 2);
}

export function moneyHud(c: Ctx, x: number, y: number, value: number, bump: number, locale: string): void {
  const s = 1 + 0.16 * Math.max(0, bump);
  const text = Math.round(value).toLocaleString(locale);
  c.save(); c.translate(x, y); c.scale(s, s);
  c.font = '58px Paytone';
  const w = Math.max(250, c.measureText(text).width + 130);
  pill(c, -w / 2, -42, w, 84, 'rgba(8,45,50,.88)', C.gold, 5);
  coin(c, -w / 2 + 44, 0, 30);
  c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = C.gold; c.fillText(text, -w / 2 + 88, 3);
  c.restore();
}

export function floatText(c: Ctx, text: string, x: number, y: number, age: number, color = C.gold, size = 64): void {
  if (age < 0 || age > 0.9) return;
  const a = age > 0.65 ? 1 - (age - 0.65) / 0.25 : 1;
  c.save(); c.globalAlpha = a;
  title(c, text, x, y - easeOut(age / 0.9) * 110, { age: age + 0.02, size, fill: color, fill2: color === C.gold ? '#FFAA1E' : color, outline: 12 });
  c.restore();
}

export function vignette(c: Ctx, color: [number, number, number], strength: number): void {
  if (strength <= 0) return;
  const g = c.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
  g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(1, `rgba(${color},${strength})`);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

export function speedLines(c: Ctx, cx: number, cy: number, t: number, strength: number): void {
  if (strength <= 0) return;
  c.save(); c.globalAlpha = 0.5 * strength; c.fillStyle = '#FFFFFF';
  for (let i = 0; i < 42; i++) {
    const a = i * 2.39996 + Math.floor(t * 20) * 0.37;
    const r0 = 560 + ((i * 97 + Math.floor(t * 30) * 53) % 260);
    const len = 220 + (i * 31) % 180, wdt = 5 + (i % 4) * 3;
    const ca = Math.cos(a), sa = Math.sin(a);
    c.beginPath();
    c.moveTo(cx + ca * r0 - sa * wdt, cy + sa * r0 + ca * wdt);
    c.lineTo(cx + ca * (r0 + len), cy + sa * (r0 + len));
    c.lineTo(cx + ca * r0 + sa * wdt, cy + sa * r0 - ca * wdt);
    c.fill();
  }
  c.restore();
}

/** Radial sunburst used behind stamps and on the end card. */
export function rays(c: Ctx, cx: number, cy: number, r: number, t: number, color: string, alpha: number): void {
  c.save(); c.translate(cx, cy); c.rotate(t * 0.35); c.globalAlpha = alpha; c.fillStyle = color;
  for (let i = 0; i < 16; i++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, (i * 2 * Math.PI) / 16, ((i + 0.5) * 2 * Math.PI) / 16); c.closePath(); c.fill(); }
  c.restore();
}

export function stamp(c: Ctx, text: string, x: number, y: number, age: number, t: number, color = C.gold): void {
  if (age < 0) return;
  const k = popScale(age, 0.28);
  c.save(); c.translate(x, y); c.scale(k, k);
  rays(c, 0, 0, 330, t, 'rgba(255,240,180,1)', 0.22 * clamp01(age / 0.2));
  c.restore();
  title(c, text, x, y, { age, size: 118, fill: '#FFFFFF', fill2: color, rot: -4 });
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + 0.4, d = 300 + 40 * Math.sin(t * 5 + i);
    star4(c, x + Math.cos(a) * d * 1.3, y + Math.sin(a) * d * 0.5, 26 * clamp01(age / 0.2) * (0.7 + 0.3 * Math.sin(t * 9 + i)), t * 2 + i, '#FFF6C8');
  }
}

/* ---------------------------------------------------------------- upgrade panel */
export interface UpgradeView { speed: number; tray: number; speedAt: number; trayAt: number; }
export function upgradePanel(c: Ctx, copy: AdCopy, y: number, v: UpgradeView, t: number): { speedBtn: [number, number]; trayBtn: [number, number] } {
  const x = 70, w = W - 140, h = 360;
  c.save();
  c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 30; c.shadowOffsetY = 14;
  c.beginPath(); c.roundRect(x, y, w, h, 42); c.fillStyle = '#0E3B3E'; c.fill();
  c.shadowColor = 'transparent';
  c.lineWidth = 6; c.strokeStyle = C.gold; c.stroke();
  const rows: [string, number, number, 'speed' | 'tray'][] = [[copy.speed, v.speed, v.speedAt, 'speed'], [copy.tray, v.tray, v.trayAt, 'tray']];
  const out = { speedBtn: [0, 0] as [number, number], trayBtn: [0, 0] as [number, number] };
  rows.forEach(([name, lvl, at, id], i) => {
    const ry = y + 40 + i * 160;
    c.beginPath(); c.roundRect(x + 26, ry, w - 52, 136, 30); c.fillStyle = '#16504F'; c.fill();
    // Icon tile
    c.beginPath(); c.roundRect(x + 46, ry + 18, 100, 100, 24); c.fillStyle = id === 'speed' ? '#3FB6E8' : C.copper; c.fill();
    c.save(); c.translate(x + 96, ry + 68);
    c.fillStyle = '#FFFFFF'; c.strokeStyle = C.deep; c.lineWidth = 5; c.lineJoin = 'round';
    if (id === 'speed') {
      c.beginPath(); c.moveTo(-22, -32); c.lineTo(10, -32); c.lineTo(-2, -4); c.lineTo(24, -4); c.lineTo(-16, 36); c.lineTo(-6, 6); c.lineTo(-28, 6); c.closePath(); c.stroke(); c.fill();
    } else {
      c.beginPath(); c.ellipse(0, 18, 38, 12, 0, 0, Math.PI * 2); c.stroke(); c.fill();
      for (const [cx, cy] of [[-16, 0], [8, 0], [-4, -24]]) { c.beginPath(); c.roundRect(cx - 9, cy - 10, 18, 26, 5); c.stroke(); c.fill(); }
    }
    c.restore();
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = '50px Paytone'; c.fillStyle = C.cream;
    c.fillText(name, x + 172, ry + 48);
    const fresh = t - at;
    c.font = '700 40px Barlow'; c.fillStyle = fresh >= 0 && fresh < 0.6 ? C.gold : C.mint;
    c.fillText(`${copy.level} ${lvl}`, x + 172 + c.measureText(name).width * 1.25 + 30, ry + 50);
    for (let p = 0; p < 10; p++) {
      const on = p < lvl, just = on && p === lvl - 1 && fresh >= 0 && fresh < 0.35;
      c.beginPath(); c.roundRect(x + 172 + p * 34, ry + 86, 26, 24, 7);
      c.fillStyle = on ? (just ? '#FFFFFF' : C.gold) : '#0B2F31'; c.fill();
    }
    const bx = x + w - 236, by = ry + 26, bw = 190, bh = 84;
    const press = fresh >= 0 && fresh < 0.18 ? 1 - fresh / 0.18 : 0;
    c.save(); c.translate(bx + bw / 2, by + bh / 2); c.scale(1 - press * 0.08, 1 - press * 0.08);
    c.beginPath(); c.roundRect(-bw / 2, -bh / 2 + 8, bw, bh, 26); c.fillStyle = '#B9790E'; c.fill();
    c.beginPath(); c.roundRect(-bw / 2, -bh / 2, bw, bh, 26);
    const g = c.createLinearGradient(0, -bh / 2, 0, bh / 2); g.addColorStop(0, '#FFE07A'); g.addColorStop(1, '#F6B21E'); c.fillStyle = g; c.fill();
    c.font = '700 40px Barlow'; c.textAlign = 'center'; c.fillStyle = C.deep; c.fillText(copy.buy, 0, 3);
    c.restore();
    out[id === 'speed' ? 'speedBtn' : 'trayBtn'] = [bx + bw / 2, by + bh / 2];
  });
  c.restore();
  return out;
}

/* ---------------------------------------------------------------- end card */
export function storeBadges(c: Ctx, a: Assets, cx: number, y: number, h: number, alpha = 1): void {
  const [sx, sy, sw, sh] = a.gpCrop;
  const gw = (sw / sh) * h;
  const aw = (a.as.naturalWidth / a.as.naturalHeight) * h || h * 3;
  const gap = 34, total = gw + gap + aw;
  c.save(); c.globalAlpha *= alpha;
  c.drawImage(a.gp, sx, sy, sw, sh, cx - total / 2, y, gw, h);
  c.drawImage(a.as, cx - total / 2 + gw + gap, y, aw, h);
  c.restore();
}

export function appIcon(c: Ctx, a: Assets, cx: number, cy: number, size: number, t: number): void {
  c.save();
  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 30; c.shadowOffsetY = 14;
  c.beginPath(); c.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.22); c.fillStyle = '#000'; c.fill();
  c.shadowColor = 'transparent';
  c.clip();
  c.drawImage(a.icon, cx - size / 2, cy - size / 2, size, size);
  const k = ((t * 0.55) % 1.6) - 0.3;
  const g = c.createLinearGradient(cx - size + k * size * 2, cy - size, cx + k * size * 2, cy + size);
  g.addColorStop(0.42, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.55)'); g.addColorStop(0.58, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(cx - size / 2, cy - size / 2, size, size);
  c.restore();
  c.beginPath(); c.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.22); c.lineWidth = 6; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke();
}

export function ctaButton(c: Ctx, text: string, cx: number, cy: number, t: number, press: number): void {
  const pulse = 1 + 0.045 * Math.sin(t * Math.PI * 4);
  const s = pulse * (1 - press * 0.07);
  c.save(); c.translate(cx, cy); c.scale(s, s);
  c.font = '72px Paytone';
  const w = Math.max(560, c.measureText(text).width + 150), h = 138;
  c.shadowColor = 'rgba(255,196,74,.75)'; c.shadowBlur = 40;
  c.beginPath(); c.roundRect(-w / 2, -h / 2 + 12, w, h, h / 2); c.fillStyle = '#B9790E'; c.fill();
  c.shadowColor = 'transparent';
  c.beginPath(); c.roundRect(-w / 2, -h / 2 + press * 8, w, h, h / 2);
  const g = c.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#FFE58C'); g.addColorStop(1, '#F7AE19');
  c.fillStyle = g; c.fill(); c.lineWidth = 7; c.strokeStyle = C.deep; c.stroke();
  c.beginPath(); c.roundRect(-w / 2 + 26, -h / 2 + 14 + press * 8, w - 52, h * 0.28, h * 0.14); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = C.deep; c.fillText(text, 0, 6 + press * 8);
  c.restore();
}

/* ---------------------------------------------------------------- confetti */
export interface Confetti { x: number; y: number; vx: number; vy: number; r: number; vr: number; color: string; size: number; }
export function makeConfetti(n: number, x: number, y: number, seed: number): Confetti[] {
  let s = seed >>> 0; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const colors = [C.gold, '#FF6F91', C.mint, '#5BC0FF', '#FFFFFF', C.copper];
  return Array.from({ length: n }, () => {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4, v = 900 + rnd() * 1300;
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd() * 6, vr: (rnd() - 0.5) * 18, color: colors[Math.floor(rnd() * colors.length)], size: 14 + rnd() * 16 };
  });
}
export function drawConfetti(c: Ctx, list: Confetti[], age: number): void {
  if (age < 0 || age > 2.4) return;
  for (const p of list) {
    const x = p.x + p.vx * age * Math.exp(-age * 0.9), y = p.y + p.vy * age * Math.exp(-age * 0.9) + 900 * age * age;
    if (y > H + 40) continue;
    c.save(); c.translate(x, y); c.rotate(p.r + p.vr * age); c.scale(1, Math.cos(age * 9 + p.r));
    c.fillStyle = p.color; c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    c.restore();
  }
}

/* ---------------------------------------------------------------- flying coins */
export interface Flyer { t0: number; x0: number; y0: number; x1: number; y1: number; dur: number; spin: number; }
export function drawFlyers(c: Ctx, list: Flyer[], t: number): number {
  let arrived = 0;
  for (const f of list) {
    const k = (t - f.t0) / f.dur;
    if (k < 0) continue;
    if (k >= 1) { arrived++; continue; }
    const e = easeInOut(k);
    const x = lerp(f.x0, f.x1, e) + Math.sin(k * Math.PI) * 90 * Math.sign(f.x1 - f.x0 || 1) * -0.6;
    const y = lerp(f.y0, f.y1, e) - Math.sin(k * Math.PI) * 220;
    coin(c, x, y, 30 * (1 - 0.3 * k), t * 14 + f.spin);
  }
  return arrived;
}
