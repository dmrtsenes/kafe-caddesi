import * as THREE from 'three';
import { localeTag, tr } from '../core/I18n';
import { formatMoney } from '../core/MathUtils';
import type { ItemId } from '../data/items';
import { drawMenuItemIcon } from '../ui/MenuIcons';
import { basic, box, detail, mat, mesh, mix, plane, roundBox } from './Materials';

export interface MenuBoardEntry {
  item: ItemId;
  name: string;
  price: number;
  unlocked: boolean;
}

export interface WallMenuBoardView {
  readonly group: THREE.Group;
  update(rows: readonly MenuBoardEntry[], boostActive?: boolean): void;
  dispose(): void;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawLockGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.16);
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.16, s * 0.28, Math.PI, 0, false);
  ctx.stroke();
  drawRoundedRect(ctx, cx - s * 0.38, cy - s * 0.14, s * 0.76, s * 0.62, s * 0.14);
  ctx.fill();
}

function upperLabel(text: string): string {
  return localeTag() === 'en-US' ? text.toUpperCase() : text.toLocaleUpperCase('tr-TR');
}

function splitTwoLines(text: string): [string, string | null] {
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return [text, null];
  if (words.length === 2) return [words[0], words[1]];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  minPx: number,
  weight = 800,
): number {
  let px = startPx;
  while (px > minPx) {
    ctx.font = `${weight} ${px}px "Segoe UI", system-ui, -apple-system, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return px;
    px -= 2;
  }
  ctx.font = `${weight} ${minPx}px "Segoe UI", system-ui, -apple-system, sans-serif`;
  return minPx;
}

export function createWallMenuBoard(opts: {
  width: number;
  height: number;
  accent: number;
  initialRows: readonly MenuBoardEntry[];
}): WallMenuBoardView {
  const { width, height, accent } = opts;
  const wideLayout = width / Math.max(0.1, height) >= 4.0;
  const W = wideLayout ? 2048 : 1280;
  const H = wideLayout ? 304 : 480;

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const faceMat = new THREE.MeshBasicMaterial({
    map: tex,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const group = new THREE.Group();
  group.name = 'wallMenuBoard';
  // Prevent StaticBatch from merging or detaching the live-updated menu canvas plane.
  group.userData.batchExclude = true;

  // Architectural walnut backing + brushed brass trim + gallery hood light.
  const frameDepth = 0.08;
  const frameMat = mat(0x1e1510, { rough: 0.72, metal: 0.08 });
  const brassMat = mat(mix(0xcfa355, accent, 0.14), { rough: 0.34, metal: 0.62 });
  const glowMat = basic(0xffeac2, 0.92, true);

  group.add(mesh(roundBox(width + 0.16, height + 0.16, frameDepth, 0.035), frameMat, 0, 0, 0));

  const bezelT = 0.032;
  group.add(detail(box(width + 0.07, bezelT, 0.024), brassMat, 0, height * 0.5 + bezelT * 0.45, frameDepth * 0.5 + 0.006));
  group.add(detail(box(width + 0.07, bezelT, 0.024), brassMat, 0, -height * 0.5 - bezelT * 0.45, frameDepth * 0.5 + 0.006));
  group.add(detail(box(bezelT, height + 0.08, 0.024), brassMat, -width * 0.5 - bezelT * 0.45, 0, frameDepth * 0.5 + 0.006));
  group.add(detail(box(bezelT, height + 0.08, 0.024), brassMat, width * 0.5 + bezelT * 0.45, 0, frameDepth * 0.5 + 0.006));

  // Continuous gallery light hood above the board (kept >= 0.045u thick so it never shimmers).
  const hoodY = height * 0.5 + 0.105;
  group.add(detail(box(width + 0.12, 0.05, 0.15), brassMat, 0, hoodY, 0.055));
  group.add(detail(box(width - 0.12, 0.046, 0.06), glowMat, 0, hoodY - 0.032, 0.092));

  const face = detail(plane(width, height), faceMat, 0, 0, frameDepth * 0.5 + 0.012);
  face.name = 'wallMenuBoardFace';
  group.add(face);

  let lastSignature = '';

  const paintWide = (c: CanvasRenderingContext2D, rows: readonly MenuBoardEntry[], boostActive: boolean): void => {
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#132420');
    bg.addColorStop(1, '#0b1513');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    // Subtle inner architectural hairline
    c.strokeStyle = 'rgba(218, 180, 108, 0.34)';
    c.lineWidth = 3;
    c.strokeRect(10, 10, W - 20, H - 20);

    // Header strip
    const headerY = 33;
    const title = `☕  ${tr("GÜNCEL MENÜ & FİYATLAR")}`;
    c.textBaseline = 'middle';
    c.textAlign = 'center';
    c.font = '800 26px "Segoe UI", system-ui, -apple-system, sans-serif';
    c.fillStyle = '#f3dfb4';
    c.fillText(title, W * 0.5, headerY);

    const titleHalfW = Math.min(460, c.measureText(title).width * 0.5 + 28);
    c.strokeStyle = 'rgba(218, 180, 108, 0.38)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(36, headerY);
    c.lineTo(W * 0.5 - titleHalfW, headerY);
    c.moveTo(W * 0.5 + titleHalfW, headerY);
    c.lineTo(W - (boostActive ? 210 : 36), headerY);
    c.stroke();

    if (boostActive) {
      drawRoundedRect(c, W - 196, 15, 166, 36, 18);
      c.fillStyle = '#1f9d73';
      c.fill();
      c.strokeStyle = '#ffd978';
      c.lineWidth = 2.5;
      c.stroke();
      c.fillStyle = '#fff9e6';
      c.font = '900 20px "Segoe UI", system-ui, -apple-system, sans-serif';
      c.fillText(`⚡ ${tr("×2 AKTİF")}`, W - 113, headerY + 1);
    }

    const count = Math.max(1, Math.min(5, rows.length));
    const padX = 24;
    const gap = 18;
    const cardTop = 58;
    const cardH = H - cardTop - 18;
    const cardW = (W - padX * 2 - gap * (count - 1)) / count;

    for (let i = 0; i < count; i++) {
      const r = rows[i];
      const x = padX + i * (cardW + gap);
      const y = cardTop;

      if (r.unlocked) {
        const cg = c.createLinearGradient(x, y, x, y + cardH);
        cg.addColorStop(0, '#1c3630');
        cg.addColorStop(1, '#10211d');
        drawRoundedRect(c, x, y, cardW, cardH, 20);
        c.fillStyle = cg;
        c.fill();
        c.strokeStyle = boostActive ? '#6ee7b7' : '#d8b064';
        c.lineWidth = 3;
        c.stroke();

        // Warm studio halo behind product icon
        const iconCx = x + 78;
        const iconCy = y + cardH * 0.52;
        const halo = c.createRadialGradient(iconCx, iconCy, 8, iconCx, iconCy, 68);
        halo.addColorStop(0, 'rgba(255, 236, 190, 0.24)');
        halo.addColorStop(1, 'rgba(255, 236, 190, 0)');
        c.fillStyle = halo;
        c.beginPath();
        c.arc(iconCx, iconCy, 68, 0, Math.PI * 2);
        c.fill();

        if (typeof c.save === 'function' && typeof c.bezierCurveTo === 'function') {
          drawMenuItemIcon(c, r.item, iconCx, iconCy, 2.28);
        }

        const textLeft = x + 148;
        const textRight = x + cardW - 16;
        const textW = Math.max(80, textRight - textLeft);
        const textCx = (textLeft + textRight) * 0.5;

        const [line1, line2] = splitTwoLines(upperLabel(r.name));
        c.fillStyle = '#fbf3e2';
        c.textAlign = 'center';
        if (line2) {
          fitFont(c, line1.length >= line2.length ? line1 : line2, textW, 29, 20, 800);
          c.fillText(line1, textCx, y + 48);
          c.fillText(line2, textCx, y + 81);
        } else {
          fitFont(c, line1, textW, 33, 22, 800);
          c.fillText(line1, textCx, y + 65);
        }

        // High-contrast live price pill
        const pillW = Math.min(textW, 218);
        const pillH = 68;
        const pillX = textCx - pillW * 0.5;
        const pillY = y + cardH - pillH - 20;
        const pg = c.createLinearGradient(pillX, pillY, pillX, pillY + pillH);
        if (boostActive) {
          pg.addColorStop(0, '#34d399');
          pg.addColorStop(1, '#10b981');
        } else {
          pg.addColorStop(0, '#f5cc70');
          pg.addColorStop(1, '#d49a35');
        }
        drawRoundedRect(c, pillX, pillY, pillW, pillH, 16);
        c.fillStyle = pg;
        c.fill();
        c.strokeStyle = boostActive ? '#d1fae5' : '#fff2c6';
        c.lineWidth = 2;
        c.stroke();

        const priceStr = `₺${formatMoney(r.price)}`;
        fitFont(c, priceStr, pillW - 22, 42, 26, 900);
        c.fillStyle = boostActive ? '#06281e' : '#1b1205';
        c.fillText(priceStr, textCx, pillY + pillH * 0.52);
      } else {
        // Locked bay: sleek dark recessed preview with frosted icon silhouette & KİLİTLİ tag
        drawRoundedRect(c, x, y, cardW, cardH, 20);
        c.fillStyle = 'rgba(15, 27, 25, 0.82)';
        c.fill();
        c.strokeStyle = 'rgba(148, 174, 168, 0.24)';
        c.lineWidth = 2;
        c.stroke();

        const iconCx = x + 76;
        const iconCy = y + cardH * 0.52;
        if (typeof c.save === 'function' && typeof c.bezierCurveTo === 'function') {
          c.save();
          c.globalAlpha = 0.22;
          drawMenuItemIcon(c, r.item, iconCx, iconCy, 2.1);
          c.restore();
        }

        const textLeft = x + 146;
        const textRight = x + cardW - 16;
        const textW = Math.max(80, textRight - textLeft);
        const textCx = (textLeft + textRight) * 0.5;
        const [line1, line2] = splitTwoLines(upperLabel(r.name));
        c.fillStyle = 'rgba(206, 220, 216, 0.44)';
        c.textAlign = 'center';
        if (line2) {
          fitFont(c, line1.length >= line2.length ? line1 : line2, textW, 27, 19, 700);
          c.fillText(line1, textCx, y + 48);
          c.fillText(line2, textCx, y + 79);
        } else {
          fitFont(c, line1, textW, 30, 20, 700);
          c.fillText(line1, textCx, y + 64);
        }

        const pillW = Math.min(textW, 196);
        const pillH = 56;
        const pillX = textCx - pillW * 0.5;
        const pillY = y + cardH - pillH - 24;
        drawRoundedRect(c, pillX, pillY, pillW, pillH, 14);
        c.fillStyle = 'rgba(36, 54, 51, 0.72)';
        c.fill();
        c.strokeStyle = 'rgba(160, 186, 180, 0.28)';
        c.lineWidth = 2;
        c.stroke();

        const lockLabel = tr("KİLİTLİ");
        fitFont(c, lockLabel, pillW - 52, 24, 18, 800);
        drawLockGlyph(c, textCx - c.measureText(lockLabel).width * 0.5 - 15, pillY + pillH * 0.52, 22, 'rgba(196, 214, 210, 0.65)');
        c.fillStyle = 'rgba(196, 214, 210, 0.68)';
        c.fillText(lockLabel, textCx + 12, pillY + pillH * 0.52);
      }
    }
  };

  const paintStacked = (c: CanvasRenderingContext2D, rows: readonly MenuBoardEntry[], boostActive: boolean): void => {
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#15282c');
    bg.addColorStop(1, '#0c181b');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    c.strokeStyle = 'rgba(224, 186, 114, 0.36)';
    c.lineWidth = 4;
    c.strokeRect(14, 14, W - 28, H - 28);

    const headerY = 48;
    c.textBaseline = 'middle';
    c.textAlign = 'center';
    c.font = '800 34px "Segoe UI", system-ui, -apple-system, sans-serif';
    c.fillStyle = '#f5e2b8';
    c.fillText(`☕  ${tr("GÜNCEL MENÜ & FİYATLAR")}`, W * 0.5, headerY);

    const show = rows.slice(0, 4);
    const count = Math.max(1, show.length);
    const top = 88;
    const availH = H - top - 24;
    const gap = 14;
    const rowH = Math.min(114, (availH - gap * (count - 1)) / count);

    for (let i = 0; i < count; i++) {
      const r = show[i];
      const x = 36;
      const w = W - 72;
      const y = top + i * (rowH + gap);

      drawRoundedRect(c, x, y, w, rowH, 18);
      if (r.unlocked) {
        c.fillStyle = '#1b3538';
        c.fill();
        c.strokeStyle = boostActive ? '#6ee7b7' : '#d8b064';
        c.lineWidth = 3;
        c.stroke();

        if (typeof c.save === 'function' && typeof c.bezierCurveTo === 'function') {
          drawMenuItemIcon(c, r.item, x + 68, y + rowH * 0.52, 1.68);
        }

        c.textAlign = 'left';
        fitFont(c, upperLabel(r.name), w - 430, 38, 24, 800);
        c.fillStyle = '#fbf3e2';
        c.fillText(upperLabel(r.name), x + 136, y + rowH * 0.52);

        const pillW = 248;
        const pillH = Math.min(72, rowH - 22);
        const pillX = x + w - pillW - 18;
        const pillY = y + (rowH - pillH) * 0.5;
        drawRoundedRect(c, pillX, pillY, pillW, pillH, 15);
        c.fillStyle = boostActive ? '#26b985' : '#e4b04b';
        c.fill();

        const priceStr = `₺${formatMoney(r.price)}`;
        c.textAlign = 'center';
        fitFont(c, priceStr, pillW - 24, 42, 26, 900);
        c.fillStyle = '#191105';
        c.fillText(priceStr, pillX + pillW * 0.5, pillY + pillH * 0.52);
      } else {
        c.fillStyle = 'rgba(16, 30, 33, 0.78)';
        c.fill();
        c.strokeStyle = 'rgba(150, 180, 184, 0.24)';
        c.lineWidth = 2;
        c.stroke();

        if (typeof c.save === 'function' && typeof c.bezierCurveTo === 'function') {
          c.save();
          c.globalAlpha = 0.22;
          drawMenuItemIcon(c, r.item, x + 68, y + rowH * 0.52, 1.55);
          c.restore();
        }

        c.textAlign = 'left';
        fitFont(c, upperLabel(r.name), w - 410, 34, 22, 700);
        c.fillStyle = 'rgba(204, 220, 222, 0.45)';
        c.fillText(upperLabel(r.name), x + 136, y + rowH * 0.52);

        c.textAlign = 'center';
        c.font = '800 26px "Segoe UI", system-ui, -apple-system, sans-serif';
        c.fillStyle = 'rgba(196, 214, 216, 0.62)';
        c.fillText(tr("KİLİTLİ"), x + w - 134, y + rowH * 0.52);
      }
    }
  };

  const update = (rows: readonly MenuBoardEntry[], boostActive = false): void => {
    const sig =
      localeTag() +
      '|' +
      (boostActive ? '1' : '0') +
      '|' +
      rows.map((r) => `${r.item}:${r.unlocked ? 1 : 0}:${r.price}`).join(',');
    if (sig === lastSignature) return;
    lastSignature = sig;
    if (!ctx) return;
    if (wideLayout) paintWide(ctx, rows, boostActive);
    else paintStacked(ctx, rows, boostActive);
    tex.needsUpdate = true;
  };

  update(opts.initialRows, false);

  return {
    group,
    update,
    dispose(): void {
      tex.dispose();
      faceMat.dispose();
    },
  };
}
