import { tr, localeTag } from "../core/I18n";
import * as THREE from 'three';
import type { StationDef } from '../data/stations';
import type { LocationPalette } from '../data/layouts';
import { ITEMS, type ItemId } from '../data/items';
import { clamp01, easeOutCubic } from '../core/MathUtils';
import { basic, box, cyl, detail, mat, mesh, mix, plane, shade, sph, torus } from './Materials';
import {
  createPackProductInstanced,
  createProductMesh,
  disposeInstancedIn,
  flushInstances,
  hideInstance,
  makeInstanced,
  makeLabelPlate,
  setInstance,
  sharedLabelMaterial,
} from './ProductMesh';
import { applyTint, collectTint, facingGroup, makeGlowDisc, type Tintable } from './StationView';
import { markDynamic } from './layers';

const DEG = Math.PI / 180;
const WOOD = 0x9a6b43;
const STONE = 0xe9e3d6;
const BRASS = 0xc9963f;

/**
 * VİTRİN — barın müşteriye bakan yüzü ve servis tamponu.
 *
 * Gövde üç katmandır: ahşap kaide, taş tezgâh, pirinç çerçeveli cam kabin.
 * Kabinin içinde iki raf ve 8 ürün yuvası var; stok arttıkça yuvalar dolar,
 * boşalınca kırmızı "BOŞ" halkası yanar.
 *
 * Yükseklik bilerek 1,75'te tutulur: kamera 41°'den baktığı için daha
 * yüksek bir kabin arkasındaki mutfak bölmesini kapatırdı.
 */

/**
 * 2 kat × 3 sütun = 6 görünür ürün.
 *
 * Dört sütunda ürünler 0,27 birime düşüyor ve 20 birim uzaktan bakan
 * kamerada "vitrin boş" görünüyordu. Üç sütun + tam ölçek, vitrini
 * uzaktan bile okunur yapar — hangi vitrinde ne var, bakışla anlaşılmalı.
 */
const COLS = 3;
const TIERS = 2;
const SLOTS = COLS * TIERS;
const TIER_Y = [1.04, 1.4];

export interface DisplayVisual {
  root: THREE.Group;
  setStock(count: number, cap: number): void;
  setLocked(locked: boolean): void;
  setHighlight(on: boolean): void;
  /** Bir ürün alındığında/kondugunda küçük tepki. */
  pop(): void;
  update(dt: number): void;
  dispose(): void;
}

export function createDisplayVisual(def: StationDef, palette: LocationPalette): DisplayVisual {
  const root = new THREE.Group();
  root.name = `display_${def.id}`;
  root.position.set(def.x, 0, def.z);
  root.rotation.y = def.rot * DEG;

  const inner = new THREE.Group();
  root.add(inner);

  const frame = new THREE.Group();
  inner.add(frame);

  /* ---------------- ahşap kaide ---------------- */
  const woodM = mat(mix(WOOD, 0x2b2018, 0.38), { rough: 0.88 });
  const woodDark = mat(mix(WOOD, 0x2b2018, 0.56), { rough: 0.92 });
  frame.add(mesh(box(2.5, 0.9, 0.95), woodM, 0, 0.45, 0));

  // müşteri tarafında dikey lambri
  const slats = makeInstanced(box(0.07, 0.68, 0.03), woodDark, 7);
  for (let i = 0; i < 7; i++) setInstance(slats, i, -1.02 + i * 0.34, 0.45, 0.487);
  flushInstances(slats);
  frame.add(slats);

  // pirinç ayak bandı
  frame.add(detail(box(2.4, 0.05, 0.05), mat(BRASS, { rough: 0.3, metal: 0.7 }), 0, 0.16, 0.5));

  /* ---------------- taş tezgâh ---------------- */
  frame.add(mesh(box(2.64, 0.1, 1.06), mat(STONE, { rough: 0.38 }), 0, 0.95, 0));
  frame.add(detail(box(2.66, 0.03, 1.08), mat(shade(STONE, 0.86), { rough: 0.5 }), 0, 0.895, 0));

  /* ---------------- cam kabin ---------------- */
  const glassM = mat(0xeef4f6, { rough: 0.06, metal: 0.04, transparent: true, opacity: 0.24 });
  const brassM = mat(BRASS, { rough: 0.28, metal: 0.72 });

  // ön ve yan paneller
  const frontPane = detail(box(2.3, 0.72, 0.03), glassM, 0, 1.38, 0.4);
  frontPane.renderOrder = 2;
  frame.add(frontPane);
  const sidePane = makeInstanced(box(0.03, 0.72, 0.78), glassM, 2);
  setInstance(sidePane, 0, -1.15, 1.38, 0);
  setInstance(sidePane, 1, 1.15, 1.38, 0);
  flushInstances(sidePane);
  sidePane.renderOrder = 2;
  frame.add(sidePane);
  const topPane = detail(box(2.34, 0.03, 0.84), glassM, 0, 1.73, 0);
  topPane.renderOrder = 2;
  frame.add(topPane);

  // pirinç köşe direkleri + üst çerçeve
  const posts = makeInstanced(box(0.05, 0.76, 0.05), brassM, 4);
  for (let i = 0; i < 4; i++) {
    setInstance(posts, i, i % 2 ? 1.16 : -1.16, 1.38, i < 2 ? 0.4 : -0.4);
  }
  flushInstances(posts);
  frame.add(posts);
  frame.add(detail(box(2.4, 0.05, 0.9), brassM, 0, 1.76, 0));

  // iç raflar
  const shelves = makeInstanced(box(2.2, 0.03, 0.72), mat(mix(STONE, 0xffffff, 0.3), { rough: 0.35 }), 2);
  setInstance(shelves, 0, 0, 1.02, 0);
  setInstance(shelves, 1, 0, 1.36, 0);
  flushInstances(shelves);
  frame.add(shelves);

  // üstteki sıcak LED şeridi — vitrin gerçekten "aydınlatılmış" görünür
  const led = detail(box(2.2, 0.03, 0.06), mat(0xfff0cf, { emissive: 0xffd58a, emissiveIntensity: 1.2, rough: 0.5 }), 0, 1.7, 0.2);
  frame.add(led);

  /* ---------------- fiyat etiketi ---------------- */
  const price = def.item ? ITEMS[def.item].price : 0;
  const name = def.item ? ITEMS[def.item].name : '';
  const tag = makeLabelPlate(`₺${price}`, 0.72, 0.26, palette.brand, 0xfff6e2);
  const tagHolder = facingGroup(def.rot, -0.5);
  tagHolder.holder.position.set(0.78, 1.0, 0.46);
  tagHolder.face.add(tag.mesh);
  inner.add(tagHolder.holder);

  // ürün adı — barın üstünde küçük tabela
  const nameHolder = facingGroup(def.rot, -0.22);
  nameHolder.holder.position.set(0, 1.98, 0.15);
  const namePlate = detail(
    plane(1.35, 0.3),
    sharedLabelMaterial(name.toLocaleUpperCase(localeTag()), 0x1d2b34, 0xffe6b0, 1.35 / 0.3),
  );
  namePlate.userData.noTint = true;
  nameHolder.face.add(namePlate);
  inner.add(nameHolder.holder);

  /* ---------------- stok çubuğu (yan taraf) ---------------- */
  const barBg = detail(box(0.08, 0.7, 0.14), mat(0x2b3238, { rough: 0.9 }), 1.28, 1.38, 0);
  inner.add(barBg);
  const barPivot = new THREE.Group();
  barPivot.position.set(1.295, 1.04, 0);
  inner.add(barPivot);
  const barFill = detail(box(0.07, 0.66, 0.12), mat(0x6aa84f, { rough: 0.75 }), 0, 0.33, 0);
  barPivot.add(barFill);
  markDynamic(barPivot);

  const BAR_OK = mat(0x6aa84f, { rough: 0.75 });
  const BAR_LOW = mat(0xf2c94c, { rough: 0.75 });
  const BAR_EMPTY = mat(0xd23b2e, { rough: 0.75 });

  /* ---------------- "boş" göstergesi ---------------- */
  const emptyGroup = new THREE.Group();
  emptyGroup.visible = false;
  inner.add(emptyGroup);
  markDynamic(emptyGroup);
  const emptyRing = detail(torus(0.42, 0.05, 5, 20), basic(0xd23b2e, 0.75, false), 0, 2.4, 0);
  emptyRing.rotation.x = -Math.PI / 2;
  emptyRing.userData.noTint = true;
  emptyGroup.add(emptyRing);
  const emptyLabel = facingGroup(def.rot, -0.3);
  emptyLabel.holder.position.set(0, 2.66, 0);
  const emptyPlate = detail(plane(0.6, 0.24), sharedLabelMaterial(tr("BOŞ"), 0xd23b2e, 0xffffff, 0.6 / 0.24));
  emptyPlate.userData.noTint = true;
  emptyLabel.face.add(emptyPlate);
  emptyGroup.add(emptyLabel.holder);

  /* ---------------- vurgu + pop pufu ---------------- */
  const glow = makeGlowDisc(palette.accent, 1.6);
  glow.visible = false;
  root.add(glow);
  markDynamic(glow);

  const popPuff = detail(sph(0.2, 8, 6), basic(0xffffff, 0.6, false), 0, 1.3, 0.4);
  popPuff.userData.noTint = true;
  popPuff.visible = false;
  inner.add(popPuff);
  markDynamic(popPuff);

  /* ---------------- ürünler ---------------- */
  const slots: (THREE.Group | null)[] = new Array(SLOTS).fill(null);
  const productHolder = new THREE.Group();
  inner.add(productHolder);
  markDynamic(productHolder);
  const item: ItemId | null = def.item ?? null;
  const packIm = item ? createPackProductInstanced(item, SLOTS) : null;
  if (packIm) {
    markDynamic(packIm);
    productHolder.add(packIm);
  }

  function ensureSlot(i: number): THREE.Group | null {
    if (!item || packIm) return null;
    let g = slots[i];
    if (!g) {
      g = createProductMesh(item);
      g.scale.setScalar(1.05);
      const tier = Math.floor(i / COLS);
      const col = i % COLS;
      g.position.set(-0.7 + col * 0.7, TIER_Y[tier], -0.02);
      g.rotation.y = (i % 3) * 0.4 - 0.4;
      g.visible = false;
      productHolder.add(g);
      markDynamic(g);
      slots[i] = g;
    }
    return g;
  }

  /* ---------------- kilit tonlaması ---------------- */
  const tints: Tintable[] = [];
  collectTint(frame, tints);

  let locked = false;
  let highlight = false;
  let t = 0;
  let popT = -1;
  let stock = 0;

  function setStock(count: number, cap: number): void {
    stock = count;
    const n = Math.min(Math.max(count, 0), SLOTS);
    if (packIm) {
      const s = ((packIm.userData.packScale as number) || 1) * 1.05;
      for (let i = 0; i < SLOTS; i++) {
        if (i < n && !locked) {
          const tier = Math.floor(i / COLS);
          const col = i % COLS;
          setInstance(packIm, i, -0.7 + col * 0.7, TIER_Y[tier], -0.02, 0, (i % 3) * 0.4 - 0.4, 0, s);
        } else {
          hideInstance(packIm, i);
        }
      }
      flushInstances(packIm, locked ? 0 : n);
    } else {
      for (let i = 0; i < SLOTS; i++) {
        if (i < n) {
          const g = ensureSlot(i);
          if (g) g.visible = !locked;
        } else if (slots[i]) {
          (slots[i] as THREE.Group).visible = false;
        }
      }
    }
    const f = cap > 0 ? clamp01(count / cap) : 0;
    barPivot.scale.y = Math.max(0.02, f);
    barFill.material = count === 0 ? BAR_EMPTY : f < 0.34 ? BAR_LOW : BAR_OK;
    emptyGroup.visible = count === 0 && !locked;
  }

  function setLocked(v: boolean): void {
    if (v === locked) return;
    locked = v;
    applyTint(tints, v);
    productHolder.visible = !v;
    tagHolder.holder.visible = !v;
    nameHolder.holder.visible = !v;
    barBg.visible = !v;
    barPivot.visible = !v;
    emptyGroup.visible = !v && stock === 0;
    led.visible = !v;
    if (v) glow.visible = false;
  }

  function update(dt: number): void {
    t += dt;

    if (popT >= 0) {
      popT += dt * 3.6;
      if (popT >= 1) {
        popT = -1;
        inner.scale.set(1, 1, 1);
        popPuff.visible = false;
      } else {
        const k = 1 - easeOutCubic(popT);
        const w = 1 + 0.05 * k;
        inner.scale.set(w, 1 - 0.06 * k, w);
        const s = 0.4 + easeOutCubic(popT) * 1.5;
        popPuff.scale.setScalar(s * (1 - popT * 0.8));
      }
    }

    if (emptyGroup.visible) {
      const s = 1 + Math.sin(t * 4.2) * 0.14;
      emptyRing.scale.set(s, 1, s);
      emptyRing.position.y = 2.4 + Math.sin(t * 2.6) * 0.05;
    }

    if (highlight) {
      const s = 1 + Math.sin(t * 3.4) * 0.07;
      glow.scale.set(s, 1, s);
    }
  }

  function dispose(): void {
    root.removeFromParent();
    disposeInstancedIn(root);
    tag.dispose();
    for (let i = 0; i < SLOTS; i++) slots[i] = null;
    root.clear();
    tints.length = 0;
  }

  return {
    root,
    setStock,
    setLocked,
    setHighlight(on: boolean) {
      highlight = on;
      glow.visible = on && !locked;
    },
    pop() {
      popT = 0;
      popPuff.visible = true;
      popPuff.position.set((Math.random() - 0.5) * 1.4, 1.1 + Math.random() * 0.5, 0.42);
      popPuff.scale.setScalar(0.4);
    },
    update,
    dispose,
  };
}

/** Bar hattı yüksekliği — diğer modüller hizalama için kullanabilir. */
export const BAR_TOP_Y = 1.78;

/** Vitrin gövdesinin yarı derinliği — navigasyon ayak izi bununla uyumlu. */
export const BAR_HALF_DEPTH = 0.48;
