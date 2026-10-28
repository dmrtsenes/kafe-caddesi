import * as THREE from 'three';
import { tr, localeTag } from '../core/I18n';
import { clamp01 } from '../core/MathUtils';
import type { ZoneDef } from '../data/layouts';
import { plane } from './Materials';
import { LABEL_RENDER_ORDER, markDynamic } from './layers';
import { drawSurfaceText } from './SurfaceLabel';

/** Inscribed inside the existing two-unit payment radius. */
export const ZONE_PURCHASE_HALF = 1.3;
export const ZONE_PAD_WIDTH = ZONE_PURCHASE_HALF * 2;
const TEX = 256;
const PULSE_SECONDS = 0.42;
/**
 * Pads always sample a map, so the decal keeps one shader variant from boot
 * (no recompile when its canvas arrives); this clear pixel stands in until then.
 */
const NO_CAPTION = new THREE.DataTexture(new Uint8Array(4), 1, 1);
NO_CAPTION.needsUpdate = true;
/** Pads revealed together paint and upload their captions on separate frames. */
let lastCaptionAt = -Infinity;

export interface ZonePurchasePad {
  root: THREE.Group;
  setVisible(visible: boolean): void;
  setProgress(progress: number): void;
  setLabel(label: string): void;
  setActive(active: boolean): void;
  setNear(near: boolean): void;
  setInstruction(text: string): void;
  setAdOffer(offer: 'finish' | 'pay_half' | null): void;
  setUnlocked(unlocked: boolean, animate: boolean): void;
  /** Paints a waiting caption now (loading screen, before the first frame). */
  flushCaption(): void;
  update(dt: number): void;
  dispose(): void;
}

/** A floor decal, not another sign blocking the item the player is buying. */
export function createZonePurchasePad(zone: ZoneDef, glyph: string, benefit: string, lift: number): ZonePurchasePad {
  const root = new THREE.Group();
  root.name = 'zonePad_' + zone.id;
  root.position.set(zone.padX, lift, zone.padZ);
  root.visible = false;
  const material = new THREE.MeshBasicMaterial({
    map: NO_CAPTION,
    transparent: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  const decal = new THREE.Mesh(plane(ZONE_PAD_WIDTH, ZONE_PAD_WIDTH), material);
  decal.name = 'zonePurchaseDecal';
  decal.userData.fixedLabel = true;
  decal.userData.noTint = true;
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = 0.032;
  decal.renderOrder = LABEL_RENDER_ORDER + 4;
  root.add(decal);
  markDynamic(root);

  let shown = false, unlocked = false, active = false, near = false, captionPending = false;
  let progress = 0, pulse = 0, redrawIn = 0, dirty = true;
  let adOffer: 'finish' | 'pay_half' | null = null;
  let label = '₺' + zone.cost.toLocaleString(localeTag());
  let instruction = '';
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let texture: THREE.CanvasTexture | null = null;

  function paint(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, TEX, TEX);
    const inset = 15, side = TEX - inset * 2, radius = 25;
    const path = new Path2D();
    path.roundRect(inset, inset, side, side, radius);
    // An unfilled outline belongs to the real floor, not a separate card.
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(35,54,46,0.48)';
    ctx.lineWidth = 6;
    ctx.stroke(path);
    ctx.strokeStyle = active ? '#ffdc86' : '#fffdf4';
    ctx.lineWidth = 3.5;
    ctx.stroke(path);
    if (progress > 0 || unlocked) {
      const perimeter = 4 * (side - radius * 2) + Math.PI * 2 * radius;
      ctx.setLineDash([perimeter * (unlocked ? 1 : progress), perimeter]);
      ctx.strokeStyle = '#7dd4a1';
      ctx.lineWidth = 4.5;
      ctx.stroke(path);
      ctx.setLineDash([]);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const face = 'system-ui, "Segoe UI", sans-serif';
    function text(value: string, y: number, size: number, maxWidth = 196): void {
      if (!ctx) return;
      ctx.fillStyle = '#fffdf4'; ctx.strokeStyle = '#294038';
      drawSurfaceText(ctx, value, TEX / 2, y, maxWidth, size * 1.1, size, 1.3, Math.max(.65, size * .035));
    }
    if (unlocked) {
      ctx.strokeStyle = '#fffdf4';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(89, 103); ctx.lineTo(119, 132); ctx.lineTo(167, 77);
      ctx.stroke();
      text(tr('AÇILDI'), 184, 28);
      return;
    }
    ctx.font = '36px ' + face;
    ctx.fillStyle = '#fffdf4';
    ctx.fillText(glyph, TEX / 2, 64);
    text(zone.name, 108, 28);
    text(label, 151, 43);
    if (progress > 0) text(tr('KALAN'), 186, 12);
    if (adOffer && (active || near)) {
      const pillW = 212, pillH = 32, pillX = (TEX - pillW) / 2, pillY = 200, pillR = 10;
      const pillPath = new Path2D();
      pillPath.roundRect(pillX, pillY, pillW, pillH, pillR);
      ctx.fillStyle = adOffer === 'finish' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(217, 119, 6, 0.95)';
      ctx.fill(pillPath);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fffdf4';
      ctx.stroke(pillPath);
      const badgeText = adOffer === 'finish' ? tr('📺 REKLAMLA TAMAMLA') : tr('📺 %50 ÖDE');
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1e293b';
      drawSurfaceText(ctx, badgeText, TEX / 2, pillY + 16, pillW - 12, pillH, 16, 1.2, 1.0);
    } else if (active) text(instruction || tr('Üzerinde dur'), 216, 20);
    else if (near) {
      // Show one concrete purchase benefit while approaching. The action hint
      // takes this same space once the player steps inside, avoiding extra signs.
      ctx.font = '800 18px ' + face;
      const words = benefit.split(/\s+/);
      const lines: string[] = [];
      let line = '';
      for (const word of words) {
        const candidate = line ? line + ' ' + word : word;
        if (line && ctx.measureText(candidate).width > 200) { lines.push(line); line = word; }
        else line = candidate;
      }
      if (line) lines.push(line);
      if (lines.length <= 1) text(benefit, 215, 20);
      else {
        text(lines[0], 205, 16);
        const remainder = lines.slice(1).join(' ');
        text(remainder, 224, 16);
      }
    }
  }
  function ensureTexture(): void {
    if (texture) return;
    canvas = document.createElement('canvas');
    canvas.width = TEX * 2; canvas.height = TEX * 2;
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(2, 2);
    paint();
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.anisotropy = 4;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    material.map = texture;
    dirty = false;
    redrawIn = 0.1;
  }
  function refreshVisibility(): void {
    const visible = pulse > 0 || (shown && !unlocked);
    // A first caption is painted from update(), never inside the purchase
    // that revealed the pad; the pad appears with it a frame or two later.
    captionPending = visible && !texture;
    root.visible = visible && !captionPending;
  }
  return {
    root,
    setVisible(visible) { shown = visible; refreshVisibility(); },
    setProgress(value) {
      const next = clamp01(value);
      if (Math.floor(next * 100) !== Math.floor(progress * 100)) dirty = true;
      progress = next;
    },
    setLabel(value) { if (value !== label) { label = value; dirty = true; } },
    setActive(value) { if (value !== active) { active = value; dirty = true; } },
    setNear(value) { if (value !== near) { near = value; dirty = true; } },
    setInstruction(value) { if (value !== instruction) { instruction = value; dirty = true; } },
    setAdOffer(value) {
      if (value !== adOffer) {
        adOffer = value;
        dirty = true;
        redrawIn = 0;
      }
    },
    setUnlocked(value, animate) {
      if (value !== unlocked) dirty = true;
      unlocked = value;
      if (value && animate) {
        pulse = PULSE_SECONDS;
        progress = 1;
        dirty = true;
        redrawIn = 0;
      } else if (!value) {
        pulse = 0;
        material.opacity = 1;
        root.scale.setScalar(1);
      }
      // A later state sync (unlocked=true, animate=false) must keep this pulse.
      refreshVisibility();
    },
    flushCaption() {
      if (!captionPending) return;
      ensureTexture();
      refreshVisibility();
    },
    update(dt) {
      if (captionPending) {
        const now = performance.now();
        if (now - lastCaptionAt < 8) return;
        lastCaptionAt = now;
        ensureTexture();
        refreshVisibility();
      }
      if (!root.visible) return;
      redrawIn = Math.max(0, redrawIn - dt);
      if (dirty && texture && redrawIn <= 0) {
        paint(); texture.needsUpdate = true; dirty = false; redrawIn = 0.1;
      }
      if (pulse > 0) {
        pulse = Math.max(0, pulse - dt);
        const phase = 1 - pulse / PULSE_SECONDS;
        const scale = 1 + Math.sin(phase * Math.PI) * 0.07;
        root.scale.set(scale, 1, scale);
        material.opacity = 1 - phase;
        if (pulse === 0) {
          root.scale.setScalar(1);
          material.opacity = 1;
          refreshVisibility();
        }
      }
    },
    dispose() {
      root.removeFromParent(); root.clear(); texture?.dispose(); material.dispose();
      canvas = null; ctx = null; texture = null;
    },
  };
}
