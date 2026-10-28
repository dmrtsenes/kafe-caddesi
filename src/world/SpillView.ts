import * as THREE from 'three';
import { CELLS, type Spill, type SpillField } from '../sim/Spills';
import { BALANCE } from '../data/balance';

/**
 * ZEMİN KİRİ GÖRSELİ — maske tabanlı.
 *
 * Her leke zemine yatık tek bir kareye çizilir; neyin kirli kaldığını bir
 * ALFA MASKESİ söyler. Maske simülasyondaki kaplama ızgarasından üretilir
 * (`Spill.cells`, 11×11): süpürge nereden geçtiyse orası açılır, geri kalan
 * kir olduğu yerde durur.
 *
 * Eski hâli tek bir blob mesh'ini merkezden küçültüp soluklaştırıyordu —
 * yani "yaklaş, leke topluca erisin". Clean It'in çekirdek tatmini olan
 * "altındaki temiz zemini AÇIĞA ÇIKARMA" hissi bu yüzden hiç oluşmuyordu.
 *
 * Maliyet: leke başına 96×96 RGBA doku (36 KB). Doku yalnızca maske
 * DEĞİŞTİĞİNDE yüklenir (`Spill.maskDirty`) — kare başına değil.
 */

const MAX = BALANCE.dirt.maxSpills;

/** Maske çözünürlüğü: 11 hücreye 96 piksel → hücre başına ~8,7 px. */
const TEX = 96;

/** Dökülen içecek: koyu, ıslak kahve tonu. */
const COLOR_LIQUID = 0x67452e;
/** Kırıntı: açık ve mat. */
const COLOR_CRUMBS = 0xb78c52;
/**
 * Toz. Eski değer (0xbdb3a2) açık bej parkede neredeyse görünmezdi —
 * ekran görüntüsünde tozu leke değil, üstündeki etiket anlatıyordu.
 * Zeminden (L* 71-77) belirgin şekilde koyu bir gri-kahve seçildi.
 */
const COLOR_DUST = 0x9b927e;

export interface SpillView {
  root: THREE.Group;
  /**
   * Simülasyon durumunu görsele yansıt.
   * @param liftAt Noktanın görsel zemin kotu (yükseltilmiş oda); verilmezse 0.
   */
  sync(field: SpillField, liftAt?: (x: number, z: number) => number): void;
  dispose(): void;
}

interface Slot {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  /** Bu slotta çizili lekenin kimliği — değişince maske baştan kurulur. */
  spillId: number;
}

/** Fine surface variation, shared once; silhouettes live in each cell mask. */
function grainTexture(): THREE.CanvasTexture {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, S, S);
    let seed = 9817;
    const random = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = 'rgba(124,112,94,' + (0.025 + random() * 0.05).toFixed(3) + ')';
      ctx.fillRect(random() * S, random() * S, 0.5 + random(), 0.5 + random());
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Encode opacity in GREEN: alphaMap does not read a canvas's alpha channel. */
function paintMask(ctx: CanvasRenderingContext2D, s: Spill): void {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, TEX, TEX);
  const step = TEX / CELLS;
  const dust = s.kind === 'toz';
  const r = step * (dust ? 0.94 : 0.84);
  // One origin-centred gradient per paint, translated to each cell (canvas
  // gradients follow the current transform), instead of one per live cell.
  let grad: CanvasGradient | null = null;
  for (let row = 0; row < CELLS; row++) {
    for (let col = 0; col < CELLS; col++) {
      const cell = row * CELLS + col;
      if (s.cells[cell] === 0) continue;
      const cx = (col + 0.5) * step;
      const cy = (row + 0.5) * step;
      if (s.kind === 'crumbs') {
        // Each live simulation cell keeps a visible flake at its own center.
        const angle = (cell * 2.399 + s.id) % (Math.PI * 2);
        const jitterX = Math.sin(cell * 17.13 + s.id) * step * 0.17;
        const jitterY = Math.sin(cell * 31.71 - s.id) * step * 0.17;
        const size = 0.21 + (Math.sin(cell * 9.17 + s.id) * 0.5 + 0.5) * 0.12;
        ctx.fillStyle = '#f4f4f4';
        ctx.beginPath();
        ctx.ellipse(cx + jitterX, cy + jitterY, step * size, step * (size * 0.7), angle, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b0b0b0';
        ctx.beginPath();
        ctx.arc(cx + Math.sin(angle) * step * 0.3, cy + Math.cos(angle) * step * 0.3, step * 0.1, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      if (!grad) {
        grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        grad.addColorStop(0, dust ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,1)');
        grad.addColorStop(dust ? 0.36 : 0.6, dust ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.94)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
      }
      ctx.setTransform(1, 0, 0, 1, cx, cy);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function createSpillView(): SpillView {
  const root = new THREE.Group();
  root.name = 'spills';
  const slots: Slot[] = [];
  const grain = grainTexture();
  // Tek paylaşımlı kare: maske her lekede farklı, geometri aynı.
  const quad = new THREE.PlaneGeometry(2, 2);
  quad.rotateX(-Math.PI / 2);

  for (let i = 0; i < MAX; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = TEX;
    canvas.height = TEX;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;

    const mat = new THREE.MeshStandardMaterial({
      color: COLOR_LIQUID,
      map: grain,
      alphaMap: tex,
      roughness: 0.6,
      metalness: 0.04,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const mesh = new THREE.Mesh(quad, mat);
    mesh.position.y = 0.104;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.visible = false;
    root.add(mesh);
    if (!ctx) continue;
    slots.push({ mesh, mat, ctx, tex, spillId: -1 });
  }

  function colorOf(s: Spill): number {
    return s.kind === 'liquid' ? COLOR_LIQUID : s.kind === 'toz' ? COLOR_DUST : COLOR_CRUMBS;
  }

  return {
    root,
    sync(field: SpillField, liftAt?: (x: number, z: number) => number): void {
      // A spill keeps the slot it was painted into. Binding slots to list
      // indices made every cleaned spill shift the rest, repainting and
      // re-uploading each later mask on the reward frame.
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (slot.spillId >= 0 && !field.byId(slot.spillId)) {
          slot.mesh.visible = false;
          slot.spillId = -1;
        }
      }
      for (let n = 0; n < field.list.length; n++) {
        const s = field.list[n];
        let slot: Slot | undefined;
        for (let i = 0; i < slots.length && !slot; i++) if (slots[i].spillId === s.id) slot = slots[i];
        for (let i = 0; i < slots.length && !slot; i++) if (slots[i].spillId === -1) slot = slots[i];
        if (!slot) continue;
        const fresh = slot.spillId !== s.id;
        if (fresh) {
          slot.spillId = s.id;
          slot.mat.color.setHex(colorOf(s));
          // Islak leke parlak, toz mat: aynı malzemede tek satırla ayrışır.
          slot.mat.roughness = s.kind === 'liquid' ? 0.28 : 0.98;
          slot.mat.metalness = s.kind === 'liquid' ? 0.04 : 0;
          // Cells are world-aligned; rotating the quad rotates the cleaned path.
          slot.mesh.rotation.y = 0;
        }
        if (fresh || s.maskDirty) {
          s.maskDirty = false;
          paintMask(slot.ctx, s);
          slot.tex.needsUpdate = true;
        }
        slot.mesh.visible = true;
        slot.mesh.position.set(s.x, 0.104 + (liftAt ? liftAt(s.x, s.z) : 0), s.z);
        // Fade in on the real footprint: growth must never move cell centers.
        slot.mesh.scale.set(s.radius, 1, s.radius);
        const opacity = s.kind === 'toz' ? 0.64 : s.kind === 'crumbs' ? 0.92 : 0.82;
        slot.mat.opacity = opacity * (0.25 + 0.75 * s.grow);
      }
    },
    dispose(): void {
      for (const s of slots) {
        s.mat.dispose();
        s.tex.dispose();
      }
      grain.dispose();
      quad.dispose();
      root.removeFromParent();
      root.clear();
    },
  };
}
