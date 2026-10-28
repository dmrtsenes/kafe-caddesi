import {addPremiumDisplay, batchPremium, disposePremium} from './PremiumDesign';
import { tr, localeTag } from "../core/I18n";
import * as THREE from 'three';
import { cacheLocalMatrices } from './LocalMatrixCache';
import { VisibilityRoot } from './VisibilityRoot';
import type { StationDef } from '../data/stations';
import type { LocationPalette } from '../data/layouts';
import { ITEMS, type ItemId } from '../data/items';
import { clamp01, easeOutCubic } from '../core/MathUtils';
import { basic, box, detail, mat, mesh, mix, plane, shade, sph, torus } from './Materials';
import {
  createPackProductInstanced,
  createProductMesh,
  disposeInstancedIn,
  flushInstances,
  hideInstance,
  makeInstanced,
  setInstance,
  sharedLabelMaterial,
} from './ProductMesh';
import { bindCoverTint, facingGroup } from './StationView';
import { markDynamic } from './layers';
import { SettledVisual } from './SettledVisual';
import { createSurfaceLabel } from './SurfaceLabel';

const DEG = Math.PI / 180;
const WOOD = 0x9a6b43;
const STONE = 0xe9e3d6;
const BRASS = 0xc9963f;

/**
 * TESLİM BANKOSU — barın müşteriye bakan yüzü.
 *
 * Ürüne özel DEĞİLDİR: ne konursa onu gösterir. Eskiden her menü ürününün
 * kendi vitrini vardı ve bar boydan boya dokuz özdeş dolaptan oluşuyordu;
 * hem mekânı koridora çeviriyordu hem de tekdüzeydi. Tek banko hem gerçek
 * kafelerdeki gibi hem de çok daha derli toplu.
 *
 * Yükseklik bilerek 1,55'te tutulur: kamera 43°'den baktığı için daha
 * yüksek bir kabin arkasındaki açık mutfağı kapatırdı.
 */

/** Taş tezgâh üst yüzeyi. */
const TOP_Y = 1.0;

export interface PickupVisual {
  root: THREE.Group;
  /** Bankodaki ürünleri olduğu gibi göster. */
  setContents(contents: readonly ItemId[], cap: number): void;
  setLocked(locked: boolean, hidden?: boolean, nextUp?: boolean): void;
  playUnlock(delay?: number): void;
  setHighlight(on: boolean): void;
  pop(): void;
  update(dt: number): void;
  dispose(): void;
}

export function createPickupVisual(def: StationDef, palette: LocationPalette): PickupVisual {
  const root = new VisibilityRoot();
  root.name = `pickup_${def.id}`;
  root.position.set(def.x, 0, def.z);
  root.rotation.y = def.rot * DEG;

  /**
   * v5 — İKİ GÖVDE: eski geniş banko (visual 'pickup', 2,55) ve ürün rafı
   * (visual 'shelf', 1,5). Raf, bankonun daraltılmışıdır; ölçüler
   * STATION_BODY ile birebir (görsel = çarpışma kuralı).
   */
  const compact = def.visual === 'shelf';
  const width = compact ? (def.location === 'sahil' ? 1.28 : 1.52) : 2.5;
  const BASE_W = compact ? (def.location === 'sahil' ? 1.22 : 1.44) : 2.5;
  const TOP_W = width + 0.04;
  const COLS = compact ? 3 : 4;
  // Products sit in two unobstructed rows. The stock caption includes overflow.
  const SLOTS = COLS * 2;

  const inner = new VisibilityRoot();
  root.add(inner);
  const frame = new VisibilityRoot();
  inner.add(frame);
  markDynamic(inner);

  // Exactly the timber, stone and brass display used by the film, with live stock.
  frame.name = 'premiumDisplay';
  addPremiumDisplay(frame, def.item, width, true);
  // Taş tezgâh (top) genişliğini width + 0.09 yerine width + 0.04 (1.56 m, ±0.78 m) yap
  const top = frame.children.find(
    (c): c is THREE.Mesh => (c as THREE.Mesh).isMesh && Math.abs(c.position.y - 0.96) < 0.02,
  );
  if (top) top.scale.x = TOP_W / (width + 0.09);

  // Bankolar / raflar arası net dikey ayırıcı panel ve altın çıta (aradaki çizgiler / çubuklar)
  // Kameradan uzakta veya yakında asla kaybolmaz, batchPremium ile tek döküm gövdeye kaynar.
  const dividerX = width * 0.5 + 0.015;
  const panelH = 0.38;
  const panelD = 0.84;
  const divW = 0.05;
  const panelW = 0.04;
  const brassM = mat(BRASS, { rough: 0.28, metal: 0.72 });
  const darkM = mat(0x23292e, { rough: 0.85 });
  const ledGoldM = mat(0xffdf88, { emissive: 0xc8963e, emissiveIntensity: 0.9, rough: 0.35 });

  // Ana dikey koyu panel gövdesi
  frame.add(mesh(box(panelW, panelH, panelD), darkM, dividerX, TOP_Y + panelH / 2, 0));
  // Üst pirinç ayırıcı ray / çıta (tezgah üzerinde boydan boya uzanan şık çizgi)
  frame.add(mesh(box(divW, 0.035, panelD + 0.015), brassM, dividerX, TOP_Y + panelH + 0.015, 0));
  // Ön yüze bakan parlak dikey çizgi (oyuncuya bakan yüzde net sınır)
  frame.add(mesh(box(0.025, panelH * 0.78, 0.02), ledGoldM, dividerX, TOP_Y + panelH / 2, panelD / 2 + 0.005));

  frame.userData.openPickup = true;
  batchPremium(frame);
  const settledShell = new SettledVisual([frame]);
  const stockCaption = createSurfaceLabel(.98, .42, false);
  stockCaption.mesh.position.set(0, .62, .525); inner.add(stockCaption.mesh);



  /* ---------------- vurgu + pop pufu ---------------- */
  const popPuff = detail(sph(0.2, 8, 6), basic(0xffffff, 0.6, false), 0, 1.3, 0.4);
  popPuff.userData.noTint = true;
  popPuff.visible = false;
  inner.add(popPuff);
  markDynamic(popPuff);

  /* ---------------- ürünler ---------------- */
  const slots: (THREE.Group | null)[] = new Array(SLOTS).fill(null);
  const slotItem: (ItemId | null)[] = new Array(SLOTS).fill(null);
  const productHolder = new VisibilityRoot();
  productHolder.name = 'displayProducts';
  inner.add(productHolder);
  markDynamic(productHolder);
  const packMeshes = new Map<ItemId, THREE.InstancedMesh>();
  const packScale = .88;

  function slotPose(i: number): { x: number; y: number; z: number; ry: number } {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    const step = compact ? 0.43 : 0.54;
    return {
      x: -((COLS - 1) * step) / 2 + col * step,
      y: 1.03,
      z: row === 0 ? -.22 : .22,
      ry: (i % 3) * 0.4 - 0.4,
    };
  }

  function ensurePack(item: ItemId): THREE.InstancedMesh | null {
    const existing = packMeshes.get(item);
    if (existing) return existing;
    const created = createPackProductInstanced(item, SLOTS);
    if (!created) return null;
    markDynamic(created);
    productHolder.add(created);
    packMeshes.set(item, created);
    return created;
  }

  function setSlot(i: number, item: ItemId | null): void {
    if (slotItem[i] === item) {
      const g = slots[i];
      if (g) g.visible = item !== null && !locked;
      return;
    }
    const old = slots[i];
    if (old) {
      disposeInstancedIn(old);
      old.removeFromParent();
      slots[i] = null;
    }
    slotItem[i] = item;
    if (!item) return;
    const g = createProductMesh(item);
    g.scale.setScalar(packScale);
    const p = slotPose(i);
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = p.ry;
    g.visible = !locked;
    productHolder.add(g);
    markDynamic(g);
    slots[i] = g;
  }

  let locked = false;
  let highlight = false;
  let t = 0;
  let popT = -1;
  let revealActive = false;
  let revealT = 0;
  let sceneHidden = false;
  let count = 0;
  let lastCapacity = -1;
  let contentsDirty = true;

  function setContents(contents: readonly ItemId[], cap: number): void {
    let changed = contentsDirty || contents.length !== count || cap !== lastCapacity;
    for (let i=0; !changed && i<SLOTS; i++) changed = slotItem[i] !== (contents[i] ?? null);
    if (!changed) return;
    contentsDirty = false;
    lastCapacity = cap;
    count = contents.length;
    stockCaption.setText(`${count} / ${cap}`);
    const used = new Map<ItemId, number>();
    for (let i = 0; i < SLOTS; i++) {
      const it = i < contents.length ? contents[i] : null;
      const im = it && !locked ? ensurePack(it) : null;
      if (it && im) {
        if (slots[i]) {
          disposeInstancedIn(slots[i]!);
          slots[i]!.removeFromParent();
          slots[i] = null;
        }
        slotItem[i] = it;
        const k = used.get(it) ?? 0;
        const p = slotPose(i);
        const s = ((im.userData.packScale as number) || 1) * packScale;
        setInstance(im, k, p.x, p.y, p.z, 0, p.ry, 0, s);
        used.set(it, k + 1);
      } else {
        setSlot(i, it);
      }
    }
    for (const [id, im] of packMeshes) {
      const n = used.get(id) ?? 0;
      for (let i = n; i < SLOTS; i++) hideInstance(im, i);
      flushInstances(im, n);
    }
  }

  let covered = false;
  const applyCover = bindCoverTint(frame);

  function syncVisibility(): void {
    const shown = covered || (!locked && !sceneHidden);
    root.visible = shown;
    frame.visible = shown && (covered || !revealActive || revealT >= 0);
    const ready = !locked && !revealActive;
    productHolder.visible = ready;
    if (!ready) stockCaption.mesh.visible = false;
  }

  function setLocked(v: boolean, hidden = false, nextUp = false): void {
    const nextCover = Boolean(v && !hidden && nextUp);
    const coverChanged = nextCover !== covered;
    if (coverChanged) {
      covered = nextCover;
      applyCover(covered);
    }
    if (v || hidden) settledShell.set(false);
    const hiddenChanged = hidden !== sceneHidden;
    sceneHidden = hidden;
    if (v === locked) {
      if (coverChanged || hiddenChanged) syncVisibility();
      else root.visible = covered || (!v && !hidden);
      return;
    }
    locked = v;
    contentsDirty = true;
    if (v) {
      revealActive = false;
      popT = -1;
      popPuff.visible = false;
      inner.scale.set(1, 1, 1);
    }
    syncVisibility();
  }

  function playUnlock(delay = 0): void {
    settledShell.set(false);
    if (locked) setLocked(false, sceneHidden);
    revealActive = true;
    revealT = -Math.max(0, delay);
    popT = -1;
    popPuff.visible = false;
    // The counter stays aligned with its collision and service position.
    inner.scale.set(1, 0.92, 1);
    syncVisibility();
  }

  function update(dt: number): void {
    stockCaption.update(dt);
    t += dt;
    if (revealActive) {
      revealT += dt;
      if (revealT >= 0) {
        const p = clamp01(revealT / 0.32);
        frame.visible = true;
        inner.scale.set(1, 0.92 + 0.08 * easeOutCubic(p), 1);
        if (p >= 1) {
          revealActive = false;
          inner.scale.set(1, 1, 1);
          syncVisibility();
        }
      }
    }
    if (popT >= 0) {
      popT += dt * 3.6;
      if (popT >= 1) {
        popT = -1;
        inner.scale.set(1, 1, 1);
        popPuff.visible = false;
      } else {
        const k = 1 - easeOutCubic(popT);
        const wv = 1 + 0.05 * k;
        inner.scale.set(wv, 1 - 0.06 * k, wv);
        const s = 0.4 + easeOutCubic(popT) * 1.5;
        popPuff.scale.setScalar(s * (1 - popT * 0.8));
      }
    }
    settledShell.set(!locked && !sceneHidden && !revealActive && popT < 0);
  }

  function dispose(): void {
    stockCaption.dispose();
    settledShell.dispose();
    disposePremium(root);
    root.removeFromParent();
    disposeInstancedIn(root);
    for (let i = 0; i < SLOTS; i++) slots[i] = null;
    root.clear();
  }

  markDynamic(root);
  cacheLocalMatrices(root);
  return {
    root,
    setContents,
    setLocked,
    playUnlock,
    setHighlight(on: boolean) {
      highlight = on; syncVisibility();
    },
    pop() {
      if (locked || revealActive || sceneHidden) return;
      settledShell.set(false);
      popT = 0;
      popPuff.visible = true;
      popPuff.position.set((Math.random() - 0.5) * 1.4, 1.1 + Math.random() * 0.4, 0.42);
      popPuff.scale.setScalar(0.4);
    },
    update,
    dispose,
  };
}
