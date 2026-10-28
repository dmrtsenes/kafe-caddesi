import * as THREE from 'three';
import { ITEMS, type ItemDef, type ItemId } from '../data/items';
import { box, cone, cyl, detail, mat, mesh, mix, plane, roundBox, shade, sph, torus } from './Materials';
import { clampedLiveCount } from './liveCount';
import { createPackProduct, geomSize, getAsset } from './packs/library';
import { ITEM_PACK, PRODUCT_XZ } from './packs/catalog';
import { scaleToFitXZ } from './packs/fit';

/* ================================================================== *
 *  PAYLAŞILAN KÜÇÜK YARDIMCILAR
 *  ProductMesh en alt seviye dünya modülü — StationView / ShelfView /
 *  Decor / Environment bu yardımcıları buradan alır (döngüsel import yok).
 * ================================================================== */

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _sc = new THREE.Vector3();

/** Tek çizim çağrısında çoğaltılmış parça (tekerlek, çember, sap, karo...). */
export function makeInstanced(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
  shadow = false,
): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(geo, material, count);
  im.castShadow = shadow;
  im.receiveShadow = false;
  // Kadraj dışı kalan istasyon/dekor parçaları elenebilsin — sınır küresi
  // flushInstances() içinde tazelenir.
  im.frustumCulled = true;
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < count; i++) hideInstance(im, i);
  im.instanceMatrix.needsUpdate = true;
  return im;
}

export function setInstance(
  im: THREE.InstancedMesh,
  i: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = sx,
  sz = sx,
): void {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _sc.set(sx, sy, sz);
  _m4.compose(_p, _q, _sc);
  im.setMatrixAt(i, _m4);
}

/** Kuaterniyonla yerleştir (billboard parçacıklar için). */
export function setInstanceQ(
  im: THREE.InstancedMesh,
  i: number,
  x: number,
  y: number,
  z: number,
  q: THREE.Quaternion,
  s: number,
): void {
  _p.set(x, y, z);
  _sc.set(s, s, s);
  _m4.compose(_p, q, _sc);
  im.setMatrixAt(i, _m4);
}

/** Örneği görünmez kılar. Sınır küresi şişmesin diye yerel başlangıç noktasında sıfır ölçek. */
export function hideInstance(im: THREE.InstancedMesh, i: number): void {
  _p.set(0, 0, 0);
  _q.identity();
  _sc.set(0.00001, 0.00001, 0.00001);
  _m4.compose(_p, _q, _sc);
  im.setMatrixAt(i, _m4);
}

/** flushInstances'ın küre hesabını son yaptığı canlı örnek sayısı. */
const lastFlushCount = new WeakMap<THREE.InstancedMesh, number>();

/**
 * Matris tamponunu GPU'ya işaretler ve sınır küresini tazeler.
 *
 * `liveCount` verilirse küre yalnız o sayı DEĞİŞTİĞİNDE hesaplanır:
 * istasyon yığınları gibi "aynı adet → aynı yerleşim" olan çağıranlar her
 * karedeki küre hesabından kurtulur (World, açık her istasyon için her
 * kare buradan geçiyordu). Verilmezse eski davranış aynen sürer — yerleşimi
 * sürekli değişen yığınlar (duman, parçacık) küreyi taze tutmalı.
 */
export function flushInstances(im: THREE.InstancedMesh, liveCount?: number): void {
  if (liveCount !== undefined) {
    const n = clampedLiveCount(im.instanceMatrix.count, liveCount);
    im.count = n;
    im.visible = n > 0;
  }
  im.instanceMatrix.needsUpdate = true;
  if (!im.frustumCulled) return;
  if (liveCount === undefined || lastFlushCount.get(im) !== liveCount) {
    im.computeBoundingSphere();
    if (liveCount !== undefined) lastFlushCount.set(im, liveCount);
  }
}

/* ---------------- kanvas etiket levhaları ---------------- */

function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Etiket dokusu: genişlik 512, YÜKSEKLİK PLAKANIN EN-BOY ORANINDAN türetilir.
 *
 * Eski hâli sabit 512×176 (oran 2,9) idi ve her plakaya gerildiği için
 * 5:1'lik levhalarda ("ÇAY AL", "TESLİM", "TUVALET") harfler ~%75 daha
 * ŞİŞKİN, "WC" gibi karelerde ise ezik çiziliyordu — oyun genelinde
 * tutarsız harf biçimleri. Artık doku, plakayla aynı oranda: gerilme yok,
 * yuvarlak çerçeve elips olmuyor, font yüksekliği dokuya göre sabit.
 */
const LABEL_W = 512;
const LABEL_H = 176;

/**
 * `fill` — PUNTOYU PLAKAYA SIĞDIRAN mod (varsayılan KAPALI).
 *
 * Normal davranış puntoyu 92·s ile SABİTLER; bu, tezgâh üstü küçük
 * göstergelerde (MAX, BOŞ, ARIZA) tutarlı bir harf boyu verir ve orada
 * doğrudur. Ama uzaktan okunması gereken büyük levhalarda (oda ad
 * tabelası) aynı sabit, plakanın yüksekliğinin ancak %38'ini harfe
 * ayırır — kalanı boşluk olarak gider. Oda tabelasında harf yüksekliği
 * ekranda 6 pikselin altına düşüyordu.
 *
 * `fill` açıkken punto önce YÜKSEKLİK tavanına oturur (0,60·H), sonra
 * metin genişliği ölçülüp gerekirse KÜÇÜLTÜLÜR. Böylece hiçbir zaman
 * `maxWidth` ile yatay olarak EZİLMEZ (ezik harf, küçük harften de zor
 * okunur); harf yüksekliği plaka yüksekliğinin ~%43'üne çıkar.
 *
 * Varsayılanı değiştirmemek bilinçli: bu dosyadaki etiket üreticisini
 * oyunun her köşesi kullanıyor, tek bir tipografi değişikliği 20'den
 * fazla levhanın görünümünü sessizce kaydırırdı.
 */
function paintLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  bg: number,
  fg: number,
  fill = false,
): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const s = H / LABEL_H; // 176 tabanına göre ölçek
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = hex(bg);
  const pad = Math.max(4, 8 * s);
  roundRectPath(ctx, pad, pad, W - pad * 2, H - pad * 2, Math.min(44 * s, H * 0.32));
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.lineWidth = Math.max(3, 8 * s);
  ctx.stroke();
  ctx.fillStyle = hex(fg);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const face = 'system-ui, "Segoe UI", sans-serif';
  const limit = W - 68 * s;
  let px = Math.round(92 * s);
  if (fill) {
    px = Math.max(12, Math.round(H * 0.6));
    ctx.font = `800 ${px}px ${face}`;
    const wPx = ctx.measureText(text).width;
    if (wPx > limit) px = Math.max(12, Math.floor((px * limit) / wPx));
    ctx.font = `800 ${px}px ${face}`;
  } else {
    ctx.font = `700 ${px}px ${face}`;
  }
  ctx.fillText(text, W / 2, H / 2 + 4 * s, limit);
}

/** Plaka oranından doku yüksekliği: 512×(512/oran), 64-512 arası. */
function labelHeightFor(aspect: number): number {
  return Math.round(Math.min(512, Math.max(64, LABEL_W / Math.max(0.5, aspect))));
}

function newLabelTexture(
  text: string,
  bg: number,
  fg: number,
  aspect: number,
  fill = false,
): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = LABEL_W;
  cv.height = labelHeightFor(aspect);
  const ctx = cv.getContext('2d');
  if (ctx) paintLabel(ctx, text, bg, fg, fill);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Sabit metinli levhalar (MAX, BOŞ, ARIZA...) — modül ömrü boyunca paylaşılır. */
const sharedLabels = new Map<string, THREE.MeshBasicMaterial>();

export function sharedLabelMaterial(
  text: string,
  bg = 0x1d2b34,
  fg = 0xffffff,
  aspect = LABEL_W / LABEL_H,
  fill = false,
): THREE.MeshBasicMaterial {
  // Oran anahtara kovalanarak girer; aynı metin farklı oranlı plakalarda
  // ayrı (doğru) dokular kullanır.
  const aKey = Math.round(aspect * 4) / 4;
  const key = `${text}|${bg}|${fg}|${aKey}|${fill ? 1 : 0}`;
  let m = sharedLabels.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      map: newLabelTexture(text, bg, fg, aKey, fill),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
      // A flat plate shows one face; three's back/front double pass would
      // bump the material version and re-resolve its program twice per draw.
      forceSinglePass: true,
    });
    sharedLabels.set(key, m);
  }
  return m;
}

export interface LabelPlate {
  mesh: THREE.Mesh;
  setText(t: string): void;
  dispose(): void;
}

/** Metni değişebilen levha — kendi dokusunu taşır, dispose edilmeli. */
export function makeLabelPlate(
  text: string,
  w = 1.1,
  h = 0.38,
  bg = 0x1d2b34,
  fg = 0xffffff,
): LabelPlate {
  const cv = document.createElement('canvas');
  cv.width = LABEL_W;
  cv.height = labelHeightFor(w / h);
  const ctx = cv.getContext('2d');
  if (ctx) paintLabel(ctx, text, bg, fg);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const material = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  const m = new THREE.Mesh(plane(w, h), material);
  m.castShadow = false;
  m.receiveShadow = false;
  m.userData.noTint = true;
  let cur = text;
  return {
    mesh: m,
    setText(t: string) {
      if (t === cur) return;
      cur = t;
      if (ctx) paintLabel(ctx, t, bg, fg);
      tex.needsUpdate = true;
    },
    dispose() {
      tex.dispose();
      material.dispose();
      m.removeFromParent();
    },
  };
}

/** Grup içindeki InstancedMesh tamponlarını serbest bırakır (geometri/malzeme önbellekte kalır). */
export function disposeInstancedIn(root: THREE.Object3D): void {
  root.traverse((o) => {
    const im = o as THREE.InstancedMesh;
    if (im.isInstancedMesh) im.dispose();
  });
}

/* ================================================================== *
 *  ÜRÜN MESHLERİ
 * ================================================================== */

/**
 * Pack materials are also drawn by plain meshes. One material switching
 * between instanced and plain objects in a frame forces three to re-resolve
 * its program on every draw, so instanced copies get their own twin.
 */
type PackMaterial = THREE.Material | THREE.Material[];
const instancedTwins = new WeakMap<PackMaterial, PackMaterial>();
function instancedMaterial(material: PackMaterial): PackMaterial {
  let twin = instancedTwins.get(material);
  if (!twin) {
    twin = Array.isArray(material) ? material.map(m => m.clone()) : material.clone();
    instancedTwins.set(material, twin);
  }
  return twin;
}

export function createPackProductInstanced(item: ItemId, maxCount: number): THREE.InstancedMesh | null {
  const packId = ITEM_PACK[item];
  if (!packId) return null;
  const asset = getAsset(packId);
  if (!asset) return null;
  const fit = scaleToFitXZ(geomSize(asset.geometry), PRODUCT_XZ);
  const im = new THREE.InstancedMesh(asset.geometry, instancedMaterial(asset.material), Math.max(1, maxCount));
  im.castShadow = false;
  im.receiveShadow = true;
  im.frustumCulled = true;
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.userData.packScale = fit;
  im.count = 0;
  im.visible = false;
  return im;
}

/** ~0.34 birim genişliğinde tek ürün. Merkezi tabanında (y=0). */
export function createProductMesh(id: ItemId): THREE.Group {
  const packed = createPackProduct(id);
  if (packed) return packed;
  const g = new THREE.Group();
  const d = ITEMS[id];
  switch (d.shape) {
    case 'teaglass': buildTeaGlass(g, d); break;
    case 'espressocup': buildEspressoCup(g, d); break;
    case 'lattecup': buildLatteCup(g, d); break;
    case 'croissant': buildCroissant(g, d); break;
    case 'sandwich': buildSandwich(g, d); break;
    case 'cakeslice': buildCakeSlice(g, d); break;
    case 'waffle': buildWaffle(g, d); break;
    case 'tallglass': buildTallGlass(g, d); break;
    case 'frappeglass': buildFrappe(g, d); break;
    case 'smoothieglass': buildSmoothie(g, d); break;
    case 'cone': buildCone(g, d); break;
    case 'shake': buildShake(g, d); break;
    case 'napkin': buildNapkin(g, d); break;
    case 'roll': buildRoll(g, d); break;
    case 'dirtydish': buildDirtyDish(g, d); break;
  }
  g.userData.itemId = id;
  return g;
}

/* ---------------- ortak parçalar ---------------- */

const GLASS = { rough: 0.08, metal: 0.02, transparent: true, opacity: 0.34 } as const;

/** Fincan altlığı — bardak/fincan ürünlerinin hepsinde aynı tabak. */
function saucer(g: THREE.Group, r: number, color = 0xfbf7ef): void {
  g.add(detail(cyl(r, r * 0.86, 0.028, 12), mat(color, { rough: 0.35 }), 0, 0.014, 0));
  const rim = detail(torus(r * 0.96, 0.012, 5, 14), mat(shade(color, 0.92), { rough: 0.4 }), 0, 0.03, 0);
  rim.rotation.x = -Math.PI / 2;
  g.add(rim);
}

/** Kulplu fincan sapı. */
function handle(g: THREE.Group, r: number, y: number, color: number): void {
  const h = detail(torus(r, r * 0.24, 5, 12), mat(color, { rough: 0.35 }), r * 1.05, y, 0);
  h.rotation.y = Math.PI / 2;
  h.scale.set(1, 1.1, 0.6);
  g.add(h);
}

/* --- waffle (dilimli, şuruplu) --- */
function buildWaffle(g: THREE.Group, d: ItemDef): void {
  g.add(detail(cyl(0.2, 0.18, 0.022, 12), mat(0xfbf7ef, { rough: 0.3 }), 0, 0.011, 0));
  const dough = mat(d.color, { rough: 0.82, flatShading: true });
  const body = detail(box(0.3, 0.075, 0.3), dough, 0, 0.06, 0);
  body.rotation.y = 0.25;
  g.add(body);
  // kare gözler
  const cells = makeInstanced(box(0.055, 0.03, 0.055), mat(shade(d.color, 0.78), { rough: 0.9 }), 9);
  let n = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      setInstance(cells, n++, i * 0.085, 0.085, j * 0.085, 0, 0.25, 0);
    }
  }
  flushInstances(cells);
  g.add(cells);
  // krema + meyve
  g.add(detail(sph(0.062, 8, 6), mat(0xfffaf2, { rough: 0.5 }), -0.05, 0.12, -0.02));
  g.add(detail(sph(0.042, 7, 6), mat(d.accent, { rough: 0.45 }), 0.06, 0.115, 0.03));
  g.add(detail(sph(0.034, 6, 5), mat(shade(d.accent, 0.85), { rough: 0.45 }), 0.02, 0.115, 0.08));
}

/* --- peçete destesi --- */
function buildNapkin(g: THREE.Group, d: ItemDef): void {
  const paper = mat(d.color, { rough: 0.98 });
  const stack = makeInstanced(box(0.26, 0.022, 0.26), paper, 5);
  for (let i = 0; i < 5; i++) setInstance(stack, i, (i % 2) * 0.012 - 0.006, 0.014 + i * 0.024, 0, 0, i * 0.06 - 0.12, 0);
  flushInstances(stack);
  g.add(stack);
  // üstteki peçete köşesinden kalkık
  const top = detail(box(0.26, 0.02, 0.14), mat(shade(d.accent, 1.05), { rough: 0.98 }), 0, 0.15, 0.06);
  top.rotation.x = -0.35;
  g.add(top);
}

/* --- tuvalet kâğıdı --- */
function buildRoll(g: THREE.Group, d: ItemDef): void {
  const paper = mat(d.color, { rough: 0.96 });
  g.add(detail(cyl(0.13, 0.13, 0.24, 12), paper, 0, 0.12, 0));
  g.add(detail(cyl(0.048, 0.048, 0.25, 8), mat(d.accent, { rough: 0.9 }), 0, 0.12, 0));
  // sarkan uç
  const tail = detail(box(0.11, 0.14, 0.012), paper, 0, 0.07, 0.132);
  tail.rotation.x = 0.12;
  g.add(tail);
}

/* --- ince belli çay bardağı (tabaklı) --- */
function buildTeaGlass(g: THREE.Group, d: ItemDef): void {
  // Geleneksel kırmızı-beyaz porselen çay tabağı
  saucer(g, 0.16, 0xfffcf7);
  const redPattern = mat(0xd32f2f, { rough: 0.35 });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const motif = detail(box(0.038, 0.004, 0.016), redPattern, Math.cos(a) * 0.118, 0.029, Math.sin(a) * 0.118);
    motif.rotation.y = -a;
    g.add(motif);
  }

  // Şeffaf ince belli kristal cam
  const glass = mat(0xeaf2f4, GLASS);
  // Alt göbek
  g.add(detail(cyl(0.076, 0.056, 0.09, 12), glass, 0, 0.075, 0));
  // Üst boğaz ve ağız
  g.add(detail(cyl(0.098, 0.074, 0.13, 12), glass, 0, 0.185, 0));

  // Tavşan kanı berrak kırmızı çay sıvısı
  g.add(detail(cyl(0.088, 0.06, 0.145, 12), mat(0xbe123c, { rough: 0.22, transparent: true, opacity: 0.92 }), 0, 0.142, 0));
  // Dudak payı altın/kehribar çay yüzeyi
  g.add(detail(cyl(0.085, 0.085, 0.008, 12), mat(0xf97316, { rough: 0.35 }), 0, 0.216, 0));

  // Kalın kristal cam ayak (taban)
  g.add(detail(cyl(0.054, 0.066, 0.03, 12), glass, 0, 0.045, 0));

  // Tabakta iki adet kesme şeker
  const sugar = mat(0xffffff, { rough: 0.85 });
  g.add(detail(box(0.026, 0.026, 0.026), sugar, -0.095, 0.042, -0.035));
  g.add(detail(box(0.024, 0.024, 0.024), sugar, -0.088, 0.042, 0.012));

  // Gümüş çay kaşığı
  const spoon = detail(box(0.012, 0.008, 0.17), mat(0xc8ccd0, { rough: 0.25, metal: 0.85 }), 0.11, 0.035, 0.02);
  spoon.rotation.y = 0.55;
  g.add(spoon);
}

/* --- espresso fincanı (tabaklı) --- */
function buildEspressoCup(g: THREE.Group, d: ItemDef): void {
  saucer(g, 0.15, d.accent);
  const porcelain = mat(d.accent, { rough: 0.22 });
  g.add(detail(cyl(0.093, 0.072, 0.115, 12), porcelain, 0, 0.09, 0));
  // koyu kahve yüzeyi + krema
  g.add(detail(cyl(0.083, 0.083, 0.012, 12), mat(d.color, { rough: 0.3 }), 0, 0.142, 0));
  g.add(detail(cyl(0.078, 0.078, 0.01, 12), mat(0xc39a68, { rough: 0.5 }), 0, 0.15, 0));
  handle(g, 0.055, 0.095, d.accent);
}


/* --- latte (büyük kulplu fincan) --- */
function buildLatteCup(g: THREE.Group, d: ItemDef): void {
  saucer(g, 0.175, d.color);
  const porcelain = mat(d.color, { rough: 0.2 });
  g.add(detail(cyl(0.125, 0.095, 0.17, 14), porcelain, 0, 0.115, 0));
  // süt köpüğü + latte art yaprağı
  g.add(detail(cyl(0.115, 0.115, 0.014, 14), mat(0xf7ecdc, { rough: 0.55 }), 0, 0.197, 0));
  const leaf = detail(sph(0.06, 8, 6), mat(d.accent, { rough: 0.6 }), 0, 0.204, 0);
  leaf.scale.set(0.5, 0.08, 1.5);
  g.add(leaf);
  handle(g, 0.07, 0.12, d.color);
}

/* --- kruvasan --- */
function buildCroissant(g: THREE.Group, d: ItemDef): void {
  const dough = mat(d.color, { rough: 0.78, flatShading: true });
  // gövde: hafif hilal oluşturan üç şişkin parça
  const body = makeInstanced(sph(0.1, 9, 7), dough, 3);
  setInstance(body, 0, 0, 0.085, 0, 0, 0, 0, 1.5, 0.85, 1.05);
  setInstance(body, 1, -0.14, 0.072, 0.055, 0, 0.55, 0, 1.0, 0.72, 0.85);
  setInstance(body, 2, 0.14, 0.072, 0.055, 0, -0.55, 0, 1.0, 0.72, 0.85);
  flushInstances(body);
  g.add(body);
  // uçlar
  const tips = makeInstanced(cone(0.05, 0.11, 6), dough, 2);
  setInstance(tips, 0, -0.23, 0.05, 0.1, 0, 0, 1.3);
  setInstance(tips, 1, 0.23, 0.05, 0.1, 0, 0, -1.3);
  flushInstances(tips);
  g.add(tips);
  // üstte parlak katman çizgileri
  const glaze = makeInstanced(box(0.03, 0.015, 0.15), mat(d.accent, { rough: 0.5 }), 3);
  setInstance(glaze, 0, -0.07, 0.15, 0.01, 0, 0.3, 0);
  setInstance(glaze, 1, 0, 0.158, 0, 0, 0, 0);
  setInstance(glaze, 2, 0.07, 0.15, 0.01, 0, -0.3, 0);
  flushInstances(glaze);
  g.add(glaze);
}

/* --- tost --- */
function buildSandwich(g: THREE.Group, d: ItemDef): void {
  const slice = cyl(0.19, 0.19, 0.05, 3);
  const m = mat(d.color, { rough: 0.85, flatShading: true });
  g.add(detail(slice, m, 0, 0.025, 0));
  const fill = detail(cyl(0.168, 0.168, 0.055, 3), mat(d.accent, { rough: 0.7 }), 0, 0.075, 0);
  fill.rotation.y = 0.3;
  g.add(fill);
  const top = detail(slice, m, 0.012, 0.128, 0.008);
  top.rotation.y = -0.24;
  g.add(top);
  // ızgara çizgileri
  const grill = makeInstanced(box(0.26, 0.008, 0.02), mat(shade(d.color, 0.62), { rough: 0.9 }), 2);
  setInstance(grill, 0, 0.012, 0.154, 0.03, 0, -0.24, 0);
  setInstance(grill, 1, 0.012, 0.154, -0.03, 0, -0.24, 0);
  flushInstances(grill);
  g.add(grill);
}

/* --- cheesecake dilimi --- */
function buildCakeSlice(g: THREE.Group, d: ItemDef): void {
  // tabak
  g.add(detail(cyl(0.2, 0.18, 0.022, 12), mat(0xfbf7ef, { rough: 0.3 }), 0, 0.011, 0));
  const base = mat(0xc99a58, { rough: 0.9, flatShading: true });
  const cheese = mat(d.color, { rough: 0.62 });
  // bisküvi taban
  const crust = detail(cyl(0.17, 0.17, 0.05, 3), base, 0, 0.047, 0);
  g.add(crust);
  // peynir gövdesi
  g.add(detail(cyl(0.17, 0.17, 0.13, 3), cheese, 0, 0.137, 0));
  // meyve sosu
  g.add(detail(cyl(0.172, 0.172, 0.026, 3), mat(d.accent, { rough: 0.45 }), 0, 0.215, 0));
  // tepede meyve
  g.add(detail(sph(0.045, 7, 6), mat(shade(d.accent, 0.92), { rough: 0.4 }), 0, 0.245, -0.03));
  // çatal
  const fork = detail(box(0.012, 0.008, 0.18), mat(0xc8ccd0, { rough: 0.25, metal: 0.8 }), 0.15, 0.026, 0.02);
  fork.rotation.y = 0.4;
  g.add(fork);
}

/* --- limonata (uzun bardak) --- */
function buildTallGlass(g: THREE.Group, d: ItemDef): void {
  const glass = mat(0xeaf4f6, GLASS);
  g.add(detail(cyl(0.105, 0.088, 0.34, 12), glass, 0, 0.17, 0));
  g.add(detail(cyl(0.098, 0.084, 0.26, 12), mat(d.color, { rough: 0.2, transparent: true, opacity: 0.88 }), 0, 0.14, 0));
  // buzlar
  const ice = makeInstanced(box(0.055, 0.055, 0.055), mat(0xffffff, { rough: 0.05, transparent: true, opacity: 0.55 }), 3);
  setInstance(ice, 0, 0.02, 0.23, 0.01, 0.3, 0.5, 0.2);
  setInstance(ice, 1, -0.03, 0.16, 0.02, -0.2, 0.9, 0.4);
  setInstance(ice, 2, 0.01, 0.1, -0.03, 0.5, 0.2, -0.3);
  flushInstances(ice);
  g.add(ice);
  // pipet
  const straw = detail(cyl(0.011, 0.011, 0.4, 6), mat(d.accent, { rough: 0.5 }), 0.045, 0.28, 0.02);
  straw.rotation.z = -0.22;
  g.add(straw);
  // kenarda limon dilimi
  const wedge = detail(cyl(0.07, 0.07, 0.018, 8), mat(0xf6e05a, { rough: 0.55 }), -0.1, 0.33, 0);
  wedge.rotation.x = Math.PI / 2;
  wedge.rotation.z = 0.4;
  g.add(wedge);
}

/* --- frappe (kubbeli kapak + pipet) --- */
function buildFrappe(g: THREE.Group, d: ItemDef): void {
  const glass = mat(0xeef2f4, GLASS);
  g.add(detail(cyl(0.115, 0.082, 0.3, 12), glass, 0, 0.15, 0));
  g.add(detail(cyl(0.108, 0.079, 0.24, 12), mat(d.color, { rough: 0.35, transparent: true, opacity: 0.92 }), 0, 0.13, 0));
  // krema tabakası
  g.add(detail(cyl(0.108, 0.108, 0.03, 12), mat(d.accent, { rough: 0.55 }), 0, 0.265, 0));
  // kubbe kapak
  const dome = detail(sph(0.115, 12, 8), mat(0xffffff, { rough: 0.1, transparent: true, opacity: 0.32 }), 0, 0.29, 0);
  dome.scale.set(1, 0.62, 1);
  g.add(dome);
  g.add(detail(cyl(0.12, 0.12, 0.022, 12), mat(0xffffff, { rough: 0.2, transparent: true, opacity: 0.45 }), 0, 0.293, 0));
  // pipet
  const straw = detail(cyl(0.013, 0.013, 0.28, 6), mat(0xd8567a, { rough: 0.45 }), 0.03, 0.42, 0.01);
  straw.rotation.z = -0.16;
  g.add(straw);
}

/* --- smoothie --- */
function buildSmoothie(g: THREE.Group, d: ItemDef): void {
  const glass = mat(0xeef2f4, GLASS);
  g.add(detail(cyl(0.11, 0.095, 0.32, 12), glass, 0, 0.16, 0));
  g.add(detail(cyl(0.104, 0.09, 0.27, 12), mat(d.color, { rough: 0.4 }), 0, 0.145, 0));
  const straw = detail(cyl(0.013, 0.013, 0.3, 6), mat(d.accent, { rough: 0.45 }), 0.035, 0.4, 0.01);
  straw.rotation.z = -0.18;
  g.add(straw);
  // kenarda meyve
  g.add(detail(sph(0.05, 7, 6), mat(shade(d.color, 0.85), { rough: 0.5 }), -0.09, 0.33, 0.03));
}

/* --- dondurma külahı --- */
function buildCone(g: THREE.Group, d: ItemDef): void {
  const k = detail(cone(0.125, 0.3, 8), mat(mix(d.color, 0x9a6b43, 0.86), { rough: 0.95, flatShading: true }), 0, 0.15, 0);
  k.rotation.x = Math.PI;
  g.add(k);
  const s1 = detail(sph(0.115, 9, 7), mat(d.color, { rough: 0.55 }), 0, 0.33, 0);
  s1.scale.set(1, 0.92, 1);
  g.add(s1);
  g.add(detail(sph(0.095, 8, 6), mat(d.accent, { rough: 0.55 }), 0.012, 0.46, 0));
}

/* --- milkshake --- */
function buildShake(g: THREE.Group, d: ItemDef): void {
  const glass = mat(0xeef2f4, GLASS);
  // klasik "tulip" milkshake bardağı
  g.add(detail(cyl(0.055, 0.075, 0.05, 10), glass, 0, 0.025, 0));
  g.add(detail(cyl(0.035, 0.035, 0.06, 8), glass, 0, 0.075, 0));
  g.add(detail(cyl(0.12, 0.05, 0.24, 12), glass, 0, 0.225, 0));
  g.add(detail(cyl(0.112, 0.05, 0.2, 12), mat(d.color, { rough: 0.4 }), 0, 0.21, 0));
  // krema kulesi
  const c1 = detail(sph(0.1, 9, 7), mat(0xfffaf2, { rough: 0.5 }), 0, 0.36, 0);
  c1.scale.set(1, 0.75, 1);
  g.add(c1);
  g.add(detail(cone(0.06, 0.11, 7), mat(0xfffaf2, { rough: 0.5 }), 0, 0.44, 0));
  g.add(detail(sph(0.035, 6, 5), mat(d.accent, { rough: 0.4 }), 0, 0.5, 0));
  const straw = detail(cyl(0.013, 0.013, 0.3, 6), mat(d.accent, { rough: 0.45 }), 0.05, 0.42, 0.02);
  straw.rotation.z = -0.24;
  g.add(straw);
}

/* --- bulaşık yığını (hacimli, dağınık kafe bulaşık/fincan yığını) --- */
function buildDirtyDish(g: THREE.Group, d: ItemDef): void {
  const china = mat(d.color, { rough: 0.52 });
  const darkCoffee = mat(0x422615, { rough: 0.45 });
  const steel = mat(0xd4dce2, { metal: 0.8, rough: 0.28 });
  const napkinMat = mat(0xede8dc, { rough: 0.95, flatShading: true });

  // 1. Üst üste binen ve hafif kaykılmış 4 seramik tabak
  const plates = makeInstanced(cyl(0.19, 0.16, 0.032, 12), china, 4);
  setInstance(plates, 0, 0, 0.016, 0, 0, 0.1, 0, 1.05, 1, 1.05);
  setInstance(plates, 1, 0.014, 0.048, -0.01, 0.02, 0.55, 0.02, 0.98, 1, 0.98);
  setInstance(plates, 2, -0.015, 0.082, 0.012, -0.03, 1.25, -0.01, 0.88, 1, 0.88);
  setInstance(plates, 3, 0.018, 0.114, 0.005, 0.04, 1.9, 0.03, 0.76, 1, 0.76);
  flushInstances(plates);
  g.add(plates);

  // 2. Tabaklar arasından taşan çatal ve çay kaşığı (çatal-bıçak kırıntıları/detayı)
  const fork = detail(box(0.26, 0.012, 0.028), steel, 0.07, 0.062, 0.04);
  fork.rotation.set(0.04, 0.45, 0.02);
  const spoon = detail(box(0.18, 0.01, 0.022), steel, -0.06, 0.098, -0.05);
  spoon.rotation.set(-0.03, -0.85, 0.02);
  g.add(fork, spoon);

  // 3. Ezilmiş, sos lekeli peçete
  const napkin = detail(sph(0.07, 6, 5), napkinMat, -0.08, 0.11, 0.05);
  napkin.scale.set(1.3, 0.5, 0.9);
  napkin.rotation.y = 0.7;
  g.add(napkin);

  // 4. Dik duran kahve fincanı + kulp + kuruyan kahve halkası
  const mug = detail(cyl(0.068, 0.054, 0.11, 10), mat(shade(d.color, 1.05), { rough: 0.45 }), -0.03, 0.17, -0.02);
  const mugHandle = detail(torus(0.036, 0.012, 4, 8), china, -0.095, 0.17, -0.02);
  mugHandle.rotation.y = Math.PI / 2;
  const mugCoffee = detail(cyl(0.055, 0.055, 0.015, 8), darkCoffee, -0.03, 0.21, -0.02);
  g.add(mug, mugHandle, mugCoffee);

  // 5. Yana eğik/devrik espresso fincanı
  const cupTilted = detail(cyl(0.058, 0.045, 0.08, 9), mat(shade(d.color, 0.92), { rough: 0.5 }), 0.08, 0.155, 0.04);
  cupTilted.rotation.set(0.2, 0.3, 0.75);
  g.add(cupTilted);

  // 6. Kalıntı sos/kahve lekeleri ve kırıntı tanecikleri
  const stains = makeInstanced(sph(0.024, 5, 4), darkCoffee, 4);
  setInstance(stains, 0, -0.09, 0.06, 0.08, 0, 0, 0, 1.2, 0.25, 1.2);
  setInstance(stains, 1, 0.1, 0.07, -0.06, 0, 0, 0, 0.9, 0.25, 0.9);
  setInstance(stains, 2, 0.04, 0.13, 0.09, 0, 0, 0, 0.8, 0.25, 0.8);
  setInstance(stains, 3, -0.02, 0.03, -0.11, 0, 0, 0, 1.4, 0.25, 1.4);
  flushInstances(stains);
  g.add(stains);

  const crumbs = makeInstanced(sph(0.018, 5, 4), mat(0xba762d, { rough: 0.95, flatShading: true }), 4);
  setInstance(crumbs, 0, 0.09, 0.04, 0.07, 0, 0.3, 0);
  setInstance(crumbs, 1, -0.07, 0.095, -0.08, 0, 0.7, 0);
  setInstance(crumbs, 2, 0.12, 0.06, -0.03, 0, 1.2, 0);
  setInstance(crumbs, 3, -0.04, 0.125, 0.09, 0, 1.9, 0);
  flushInstances(crumbs);
  g.add(crumbs);
}

/* ================================================================== *
 *  KASA (AHŞAP SANDIK)
 * ================================================================== */

/** İçinde ürün görünen ahşap kasa, ~0.62 birim. Taban y=0. */
export function createCrateMesh(id: ItemId): THREE.Group {
  const g = new THREE.Group();
  const d = ITEMS[id];
  const wood = mat(0x9a6b43, { rough: 0.92, flatShading: true });
  const woodDark = mat(shade(0x9a6b43, 0.74), { rough: 0.95 });

  g.add(mesh(box(0.56, 0.06, 0.56), wood, 0, 0.03, 0));

  // 4 yan panel
  const sides = makeInstanced(box(0.56, 0.3, 0.05), wood, 4, true);
  setInstance(sides, 0, 0, 0.21, 0.27);
  setInstance(sides, 1, 0, 0.21, -0.27);
  setInstance(sides, 2, 0.27, 0.21, 0, 0, Math.PI / 2, 0);
  setInstance(sides, 3, -0.27, 0.21, 0, 0, Math.PI / 2, 0);
  flushInstances(sides);
  g.add(sides);

  // köşe direkleri
  const posts = makeInstanced(box(0.08, 0.38, 0.08), woodDark, 4);
  for (let i = 0; i < 4; i++) {
    const sx = i < 2 ? 0.27 : -0.27;
    const sz = i % 2 === 0 ? 0.27 : -0.27;
    setInstance(posts, i, sx, 0.19, sz);
  }
  flushInstances(posts);
  g.add(posts);

  // rimden taşan ürünler
  const goods = makeInstanced(sph(0.13, 8, 6), mat(d.color, { rough: 0.6 }), 4);
  setInstance(goods, 0, -0.11, 0.32, -0.1, 0, 0, 0, 1, 0.85, 1);
  setInstance(goods, 1, 0.12, 0.3, 0.09, 0, 0, 0, 0.92, 0.8, 0.92);
  setInstance(goods, 2, -0.02, 0.42, 0.02, 0, 0, 0, 0.86, 0.8, 0.86);
  setInstance(goods, 3, 0.1, 0.32, -0.13, 0, 0, 0, 0.8, 0.75, 0.8);
  flushInstances(goods);
  g.add(goods);

  const cap = makeInstanced(sph(0.055, 6, 5), mat(d.accent, { rough: 0.7 }), 2);
  setInstance(cap, 0, -0.02, 0.53, 0.02);
  setInstance(cap, 1, 0.12, 0.4, 0.09);
  flushInstances(cap);
  g.add(cap);

  g.userData.itemId = id;
  return g;
}

/* ================================================================== *
 *  NAKİT YIĞINI
 * ================================================================== */

/** Para yığını (kasada biriken nakit). */
export function createCashMesh(): THREE.Group {
  const g = new THREE.Group();
  const notes = makeInstanced(box(0.36, 0.035, 0.2), mat(0x6fbf73, { rough: 0.9 }), 5, true);
  for (let i = 0; i < 5; i++) {
    setInstance(notes, i, (i % 2) * 0.02 - 0.01, 0.02 + i * 0.037, 0, 0, (i - 2) * 0.09, 0);
  }
  flushInstances(notes);
  g.add(notes);

  g.add(detail(box(0.09, 0.19, 0.21), mat(0xe2703a, { rough: 0.85 }), 0, 0.1, 0));

  const coins = makeInstanced(cyl(0.07, 0.07, 0.022, 8), mat(0xffc84a, { rough: 0.35, metal: 0.45 }), 3);
  setInstance(coins, 0, 0.24, 0.011, 0.1, 0, 0.4, 0);
  setInstance(coins, 1, 0.26, 0.033, 0.07, 0, 1.1, 0);
  setInstance(coins, 2, -0.24, 0.011, -0.09, 0, -0.6, 0);
  flushInstances(coins);
  g.add(coins);

  return g;
}
