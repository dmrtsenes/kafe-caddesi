import { addPremiumTable, addPremiumCounter, addPremiumMachine, addPremiumBin, premiumWoodMaterial, PREMIUM, batchPremium, disposePremium } from './PremiumDesign';
import { tr } from "../core/I18n";
import * as THREE from 'three';
import { cacheLocalMatrices } from './LocalMatrixCache';
import { VisibilityRoot } from './VisibilityRoot';
import { BALANCE } from '../data/balance';
import { TOILET_LAYOUT } from '../data/restrooms';
import {SEAT_RADIUS,seatAngle} from '../data/seating';
import { STATION_BODY, type StationDef, type StationVisualKind } from '../data/stations';
import type { LocationPalette } from '../data/layouts';
import { TABLE_SKINS, type TableSkin } from '../data/cosmetics';
import { ITEMS, type ItemId } from '../data/items';
import { TAU, clamp, clamp01, damp, lerp } from '../core/MathUtils';
import { basic, box, cone, cyl, detail, mat, mesh, mix, plane, roundBox, shade, sph, torus } from './Materials';
import {
  createCashMesh,
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
import { markDynamic } from './layers';
import { queueMaterialWarm } from './MaterialWarmup';
import { SettledVisual } from './SettledVisual';
import { STATION_PACK, PLANT_XZ } from './packs/catalog';
import { chairScale, createPackMesh, geomSize, getAsset, hasPack } from './packs/library';
import { cafePackMaterial, cafeTableGeometry } from './packs/CafeFurniture';
import { CAFE, cafeWoodTexture } from './CafeMaterials';

import { createPremiumVacuum } from './VacuumAsset';

const DEG = Math.PI / 180;

/* ================================================================== *
 *  PAYLAŞILAN PARÇALAR (ShelfView de kullanır)
 * ================================================================== */

export interface Tintable {
  m: THREE.Mesh | THREE.InstancedMesh;
  on: THREE.Material;
  off: THREE.Material;
}

/** Kilitli hâl: gri + yarı saydam, silüet korunur. */
function lockedVariant(m: THREE.Material): THREE.Material {
  const sm = m as THREE.MeshStandardMaterial;
  if (sm.isMeshStandardMaterial) {
    return mat(mix(sm.color.getHex(), 0x9aa0a6, 0.8), {
      rough: sm.roughness,
      metal: sm.metalness * 0.35,
      transparent: true,
      opacity: 0.52,
      flatShading: sm.flatShading,
      side: sm.side,
    });
  }
  const bm = m as THREE.MeshBasicMaterial;
  if (bm.isMeshBasicMaterial && !bm.map) return basic(mix(bm.color.getHex(), 0x9aa0a6, 0.8), 0.3, false);
  return m;
}

export function collectTint(root: THREE.Object3D, out: Tintable[]): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || o.userData.noTint) return;
    const material = m.material as THREE.Material;
    if (Array.isArray(m.material)) return;
    out.push({ m: m as THREE.Mesh, on: material, off: lockedVariant(material) });
  });
}

export function applyTint(list: Tintable[], locked: boolean): void {
  for (let i = 0; i < list.length; i++) list[i].m.material = locked ? list[i].off : list[i].on;
}

/** Gray cover for the meshes that are actually drawn. Built once, on the first cover. */
export function bindCoverTint(root: THREE.Object3D): (covered: boolean) => void {
  let ready = false;
  let covered = false;
  const tints: Tintable[] = [];
  // Both looks are compiled ahead by the idle warm-up; variants are cached
  // shared materials, so this creates nothing that the first cover would not.
  queueMaterialWarm((add) => {
    if (ready) {
      for (const t of tints) { add(t.m, t.on); add(t.m, t.off); }
      return;
    }
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || object.userData.noTint || Array.isArray(mesh.material)) return;
      add(mesh, mesh.material);
      add(mesh, lockedVariant(mesh.material));
    });
  });
  return (next: boolean) => {
    if (next === covered && (ready || !next)) return;
    if (!ready) {
      ready = true;
      root.traverse((object) => {
        let current: THREE.Object3D | null = object;
        while (current && current !== root) {
          if (!current.visible) return;
          current = current.parent;
        }
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh || object.userData.noTint || Array.isArray(mesh.material)) return;
        tints.push({ m: mesh, on: mesh.material, off: lockedVariant(mesh.material) });
      });
    }
    covered = next;
    applyTint(tints, covered);
  };
}

/**
 * İstasyon → tanıtım simgesi ("bu eşya ne verir/ne işe yarar").
 *
 * Ürünlü istasyonlar (makine, teslim rafı, sarf deposu — `item` dolu)
 * ürünün rozetini taşır; mekân istasyonları tür simgesini. Ödeme pedi
 * levhası (Environment) bu eşlemeyi kullanır: sıradaki satın alımın
 * ne açacağı eşya kurulmadan önce anlaşılır. Simgesi olmayan türler
 * (kova, süpürge dolabı) null döner.
 */
export function stationGlyph(def: StationDef): string | null {
  if (def.item) return ITEMS[def.item].glyph;
  switch (def.kind) {
    case 'table':
      return '🪑';
    case 'toilet':
      return '🚻';
    case 'counter':
      return '🧾';
    default:
      return null;
  }
}

/** Zeminde yumuşak vurgu diski. */
export function makeGlowDisc(color: number, r: number): THREE.Mesh {
  const d = detail(cyl(r, r, 0.02, 26), basic(color, 0.26, false), 0, 0.03, 0);
  d.renderOrder = 1;
  d.userData.noTint = true;
  return d;
}

/** Dünyaya (+Z) bakan, kameraya doğru hafif eğik etiket taşıyıcı. */
export function facingGroup(rotDeg: number, tilt = -0.32): { holder: THREE.Group; face: THREE.Group } {
  const holder = new VisibilityRoot();
  holder.rotation.y = -rotDeg * DEG;
  const face = new VisibilityRoot();
  face.rotation.x = tilt;
  holder.add(face);
  return { holder, face };
}

export interface ProgressRing {
  group: THREE.Group;
  set(p: number): void;
}

/** Üretim göstergesi: iz halkası + dolan disk + tur atan bilye. */
export function makeProgressRing(color: number): ProgressRing {
  const group = new VisibilityRoot();
  group.userData.noTint = true;
  const track = detail(torus(0.44, 0.05, 5, 22), basic(0x1d2b34, 0.32, false));
  track.rotation.x = -Math.PI / 2;
  group.add(track);
  const fill = detail(cyl(0.4, 0.4, 0.02, 22), basic(color, 0.9, false), 0, 0.012, 0);
  group.add(fill);
  const bead = detail(sph(0.075, 7, 6), basic(0xfff6dd, 1, false), 0, 0.04, -0.44);
  group.add(bead);
  group.traverse((o) => (o.userData.noTint = true));
  return {
    group,
    set(p: number) {
      const k = clamp01(p);
      fill.scale.set(k, 1, k);
      const a = k * TAU;
      bead.position.set(Math.sin(a) * 0.44, 0.04, -Math.cos(a) * 0.44);
    },
  };
}

/** Yükselen küçük duman/buhar sütunu — tek çizim çağrısı. */
interface Plume {
  im: THREE.InstancedMesh;
  tick(t: number, act: number, ox: number, oy: number, oz: number, rise: number, spread: number): void;
}

function makePlume(count: number, color: number, r: number, opacity = 0.5): Plume {
  const im = makeInstanced(
    sph(r, 6, 5),
    mat(color, { rough: 1, transparent: true, opacity, depthWrite: false }),
    count,
  );
  im.userData.noTint = true;
  im.visible = false;
  let wasOn = false;
  return {
    im,
    tick(t, act, ox, oy, oz, rise, spread) {
      if (act < 0.03) {
        if (wasOn) {
          for (let i = 0; i < count; i++) hideInstance(im, i);
          flushInstances(im);
          wasOn = false;
        }
        im.visible = false;
        return;
      }
      wasOn = true;
      im.visible = true;
      for (let i = 0; i < count; i++) {
        const k = (t * 0.4 + i / count) % 1;
        const s = (0.3 + k * 1.2) * act * (1 - k * 0.45);
        setInstance(
          im,
          i,
          ox + Math.sin(k * 5.5 + i) * spread * k,
          oy + k * rise,
          oz + Math.cos(k * 4.7 + i * 2) * spread * k,
          0,
          0,
          0,
          s,
        );
      }
      flushInstances(im);
    },
  };
}

/* ================================================================== *
 *  İSTASYON GÖVDELERİ
 * ================================================================== */

interface Rig {
  dispose?(): void;
  tick?(dt: number, t: number, act: number): void;
  onOutput?(count: number, cap: number, item: ItemId | null): void;
  /** Girdiyi kendi yorumlayan istasyonlar (masa → oturan misafir sayısı). */
  onInput?(counts: { item: ItemId; count: number; cap: number }[]): void;
  /** İlerlemeyi kendi yorumlayan istasyonlar (tuvalet → kir seviyesi). */
  onProgress?(p: number): void;
  onLocked?(locked: boolean): void;
  onWipe?(dt: number): void;
  playGleam?(): void;
  /** Genel çıkış yığını / girdi kutuları / üst halka bastırılsın mı. */
  ownOutput?: boolean;
  ownInput?: boolean;
  ownRing?: boolean;
}

type Builder = (g: THREE.Group, p: LocationPalette, def: StationDef) => Rig;

const WOOD = 0x9a6b43;
const METAL = 0xb9c2c8;
const DARK = 0x1d2b34;

/* ================================================================== *
 *  ORTAK KAFE PARÇALARI
 * ================================================================== */

const STONE = 0xe9e3d6;
const BRASS = 0xc9963f;
const CHROME = 0xd6dade;

/**
 * Ortak tezgâh kaidesi: ahşap gövde + dikey lambri + taş tezgâh üstü.
 * Kafedeki her hazırlık istasyonu bunun üstüne kurulur — mekân böylece
 * "aynı marangozdan çıkmış" görünür. Dönen değer: çalışma yüzeyinin y'si.
 */
function counterBase(g: THREE.Group, w: number, d: number, h = 0.9, tone = 0.35): number {
  g.add(mesh(box(w, h, d), mat(mix(WOOD, DARK, tone), { rough: 0.86 }), 0, h / 2, 0));
  const slatN = Math.max(3, Math.round(w / 0.34));
  const slats = makeInstanced(box(0.07, h * 0.76, 0.03), mat(mix(WOOD, DARK, tone + 0.16), { rough: 0.92 }), slatN);
  for (let i = 0; i < slatN; i++) {
    setInstance(slats, i, -w / 2 + 0.22 + (i * (w - 0.44)) / (slatN - 1), h / 2, d / 2 + 0.016);
  }
  flushInstances(slats);
  g.add(slats);
  g.add(mesh(box(w + 0.14, 0.1, d + 0.14), mat(STONE, { rough: 0.38 }), 0, h + 0.05, 0));
  // taş kenar pahı
  g.add(detail(box(w + 0.16, 0.03, d + 0.16), mat(shade(STONE, 0.88), { rough: 0.5 }), 0, h - 0.005, 0));
  return h + 0.1;
}

/** Metal ayaklı açık raf iskeleti (depo istasyonları). */
function rackLegs(g: THREE.Group, w: number, d: number, h: number): void {
  const legs = makeInstanced(box(0.08, h, 0.08), mat(DARK, { rough: 0.55, metal: 0.3 }), 4);
  for (let i = 0; i < 4; i++) {
    setInstance(legs, i, i % 2 ? w / 2 - 0.1 : -w / 2 + 0.1, h / 2, i < 2 ? d / 2 - 0.1 : -d / 2 + 0.1);
  }
  flushInstances(legs);
  g.add(legs);
}

/* ================================================================== *
 *  DEPO İSTASYONLARI
 * ================================================================== */








/* ---------------- peçete kutusu ---------------- */

/** Only explicitly listed moving parts stay live; the furniture shares a batch. */
function batchStationFurniture(g: THREE.Group, live: THREE.Object3D[] = []): void {
  const keep = new Set(live), shell = new VisibilityRoot();
  shell.name = 'stationFurniture';
  for (const child of [...g.children]) if (!keep.has(child)) shell.add(child);
  g.add(shell);
  batchPremium(shell);
}

const buildNapkinBox: Builder = (g, p) => {
  const topY = counterBase(g, 1.34, 0.74, 0.78, 0.15);
  const paper = mat(0xfdfbf5, { rough: 0.97 });
  // istiflenmiş peçete paketleri
  const packs = makeInstanced(box(0.42, 0.16, 0.34), paper, 6);
  for (let i = 0; i < 6; i++) {
    setInstance(packs, i, -0.34 + (i % 2) * 0.68, topY + 0.09 + Math.floor(i / 2) * 0.17, 0, 0, (i % 3) * 0.08 - 0.08, 0);
  }
  flushInstances(packs);
  g.add(packs);
  // paket bantları
  const bands = makeInstanced(box(0.44, 0.05, 0.05), mat(p.accent, { rough: 0.85 }), 3);
  for (let i = 0; i < 3; i++) setInstance(bands, i, -0.34, topY + 0.09 + i * 0.17, 0.16);
  flushInstances(bands);
  g.add(bands);
  // krom peçetelik
  const holder = mat(CHROME, { rough: 0.25, metal: 0.7 });
  g.add(detail(box(0.34, 0.24, 0.12), holder, 0.36, topY + 0.12, 0.28));
  const fan = detail(box(0.3, 0.22, 0.02), paper, 0.36, topY + 0.2, 0.28);
  fan.rotation.x = -0.25;
  g.add(fan);
  g.add(detail(box(0.55, 0.18, 0.02), mat(p.brand, { rough: 0.75 }), 0, 0.46, 0.386));

  batchStationFurniture(g);
  return {};
};

/* ---------------- kâğıt rafı ---------------- */

const buildPaperShelf: Builder = (g, p) => {
  // A low, open supply counter keeps the semaver approach visible behind it.
  // Its footprint matches the .75 × .45 collision half extents.
  const topY = counterBase(g, 1.34, 0.74, 0.68, 0.2);
  const post = mat(mix(CHROME, DARK, 0.3), { rough: 0.4, metal: 0.45 });
  const posts = makeInstanced(box(0.045, 0.48, 0.045), post, 4);
  for (let i = 0; i < 4; i++) setInstance(posts, i, i % 2 ? 0.65 : -0.65, topY + 0.24, i < 2 ? 0.33 : -0.33);
  flushInstances(posts);
  g.add(posts);

  const boards = makeInstanced(box(1.38, 0.04, 0.76), mat(mix(WOOD, 0xffffff, 0.3), { rough: 0.9 }), 2);
  for (let i = 0; i < 2; i++) setInstance(boards, i, 0, topY + i * 0.29, 0);
  flushInstances(boards);
  g.add(boards);

  // Visible rolls explain the supply without a tall solid cabinet or another sign.
  const rolls = makeInstanced(cyl(0.115, 0.115, 0.25, 12), mat(0xffffff, { rough: 0.96 }), 6);
  const cores = makeInstanced(cyl(0.041, 0.041, 0.27, 8), mat(0xd0d7db, { rough: 0.9 }), 6);
  for (let i = 0; i < 6; i++) {
    const x = -0.42 + (i % 3) * 0.42;
    const y = topY + 0.136 + Math.floor(i / 3) * 0.29;
    setInstance(rolls, i, x, y, 0, 0, 0, Math.PI / 2);
    setInstance(cores, i, x, y, 0, 0, 0, Math.PI / 2);
  }
  flushInstances(rolls);
  flushInstances(cores);
  g.add(rolls, cores);
  g.add(detail(box(0.5, 0.14, 0.02), mat(p.brand, { rough: 0.75 }), 0, 0.4, 0.42));

  batchStationFurniture(g);
  return {};
};

/* ================================================================== *
 *  HAZIRLIK İSTASYONLARI
 * ================================================================== */

/* ---------------- semaver ---------------- */

const buildSamovar: Builder = (g, p) => {
  const topY = counterBase(g, 1.7, 1.0, 0.86, 0.3);
  const brass = mat(BRASS, { rough: 0.24, metal: 0.72 });
  const brassDark = mat(shade(BRASS, 0.78), { rough: 0.3, metal: 0.65 });

  // gövde: geniş karın, boyunda daralma
  g.add(mesh(cyl(0.34, 0.4, 0.12, 14), brassDark, 0, topY + 0.06, 0));
  g.add(mesh(cyl(0.42, 0.34, 0.62, 14), brass, 0, topY + 0.43, 0));
  g.add(mesh(cyl(0.3, 0.42, 0.22, 14), brass, 0, topY + 0.85, 0));
  const bellyRing = detail(torus(0.42, 0.035, 5, 16), brassDark, 0, topY + 0.5, 0);
  bellyRing.rotation.x = -Math.PI / 2;
  g.add(bellyRing);

  // musluk + kulplar
  const tap = detail(cyl(0.035, 0.035, 0.2, 6), brassDark, 0, topY + 0.28, 0.36);
  tap.rotation.x = Math.PI / 2;
  g.add(tap);
  g.add(detail(sph(0.055, 7, 6), brassDark, 0, topY + 0.36, 0.42));
  const handles = makeInstanced(torus(0.1, 0.028, 5, 10), brassDark, 2);
  setInstance(handles, 0, 0.44, topY + 0.5, 0, 0, Math.PI / 2, 0);
  setInstance(handles, 1, -0.44, topY + 0.5, 0, 0, Math.PI / 2, 0);
  flushInstances(handles);
  g.add(handles);

  // üstte demlik
  const pot = new VisibilityRoot();
  pot.position.set(0, topY + 0.96, 0);
  g.add(pot);
  pot.add(mesh(cyl(0.19, 0.16, 0.24, 12), mat(p.wallTrim, { rough: 0.35 }), 0, 0.12, 0));
  pot.add(detail(cyl(0.2, 0.2, 0.04, 12), mat(shade(p.wallTrim, 0.8), { rough: 0.4 }), 0, 0.26, 0));
  pot.add(detail(sph(0.05, 7, 6), brass, 0, 0.3, 0));
  const spout = detail(cyl(0.03, 0.045, 0.2, 6), mat(p.wallTrim, { rough: 0.35 }), 0, 0.16, 0.19);
  spout.rotation.x = 1.1;
  pot.add(spout);
  const potHandle = detail(torus(0.07, 0.02, 5, 10), mat(p.wallTrim, { rough: 0.35 }), -0.22, 0.14, 0);
  potHandle.rotation.y = Math.PI / 2;
  pot.add(potHandle);

  // yanda ince belli bardaklar
  const glasses = makeInstanced(cyl(0.06, 0.045, 0.13, 8), mat(0xeaf2f4, { rough: 0.1, transparent: true, opacity: 0.42 }), 3);
  const teas = makeInstanced(cyl(0.05, 0.04, 0.1, 8), mat(ITEMS.cay.color, { rough: 0.3 }), 3);
  for (let i = 0; i < 3; i++) {
    const x = 0.55 + (i % 2) * 0.22;
    const z = 0.24 - Math.floor(i / 2) * 0.32;
    setInstance(glasses, i, x, topY + 0.07, z);
    setInstance(teas, i, x, topY + 0.06, z);
  }
  flushInstances(glasses);
  flushInstances(teas);
  g.add(teas, glasses);

  // kömür közü
  const ember = detail(cyl(0.2, 0.2, 0.03, 12), mat(0xff8a3c, { emissive: 0xff5e14, emissiveIntensity: 1.5, rough: 0.5 }), 0, topY + 0.02, 0);
  g.add(ember);

  const steam = makePlume(5, 0xf2f6f8, 0.11, 0.42);
  g.add(steam.im);

  return {
    tick(dt, t, act) {
      void dt;
      const s = 1 + Math.sin(t * 5) * 0.14 * act;
      ember.scale.set(s, 1, s);
      pot.position.y = topY + 0.96 + Math.sin(t * 2.6) * 0.006 * act;
      steam.tick(t * 1.4, act, 0, topY + 1.3, 0, 0.9, 0.16);
    },
  };
};


/* ---------------- espresso makinesi ---------------- */

const buildEspresso: Builder = (g, p) => {
  const topY = counterBase(g, 2.1, 1.05, 0.9, 0.42);
  const chrome = mat(CHROME, { rough: 0.16, metal: 0.82 });
  const body = mat(mix(p.wallTrim, DARK, 0.25), { rough: 0.3, metal: 0.35 });

  // ana gövde + krom kapak
  g.add(mesh(roundBox(1.5, 0.62, 0.62, 0.08), body, 0, topY + 0.31, -0.1));
  g.add(mesh(roundBox(1.42, 0.14, 0.58, 0.06), chrome, 0, topY + 0.68, -0.1));
  // üstte ısınan fincanlar
  const cups = makeInstanced(cyl(0.075, 0.058, 0.11, 10), mat(0xfbf7ef, { rough: 0.35 }), 6);
  for (let i = 0; i < 6; i++) setInstance(cups, i, -0.5 + (i % 3) * 0.5, topY + 0.8, -0.24 + Math.floor(i / 3) * 0.28);
  flushInstances(cups);
  g.add(cups);

  // iki grup başlığı + portafiltre
  const groups = makeInstanced(cyl(0.11, 0.13, 0.2, 10), chrome, 2);
  setInstance(groups, 0, -0.32, topY + 0.16, 0.2);
  setInstance(groups, 1, 0.32, topY + 0.16, 0.2);
  flushInstances(groups);
  g.add(groups);
  const pf = new VisibilityRoot();
  pf.position.set(-0.32, topY + 0.06, 0.2);
  g.add(pf);
  pf.add(detail(cyl(0.13, 0.12, 0.06, 10), chrome, 0, 0, 0));
  const pfHandle = detail(cyl(0.028, 0.034, 0.24, 7), mat(0x2b2018, { rough: 0.8 }), 0, 0, 0.22);
  pfHandle.rotation.x = Math.PI / 2;
  pf.add(pfHandle);

  // fincan + akan espresso
  const shotCup = detail(cyl(0.07, 0.055, 0.1, 10), mat(0xfbf7ef, { rough: 0.35 }), 0.32, topY + 0.05, 0.2);
  g.add(shotCup);
  const shot = detail(cyl(0.012, 0.012, 0.14, 5), mat(0x3a2110, { rough: 0.4, transparent: true, opacity: 0.85 }), 0.32, topY + 0.12, 0.2);
  shot.userData.noTint = true;
  shot.visible = false;
  g.add(shot);

  // buhar borusu + manometre
  const wand = detail(cyl(0.026, 0.026, 0.4, 6), chrome, 0.72, topY + 0.3, 0.12);
  wand.rotation.x = 0.55;
  g.add(wand);
  const gauge = detail(cyl(0.1, 0.1, 0.04, 12), mat(0xf6f2e8, { rough: 0.4 }), -0.68, topY + 0.4, 0.22);
  gauge.rotation.x = Math.PI / 2;
  g.add(gauge);
  const needle = detail(box(0.012, 0.075, 0.012), mat(0xd23b2e, { rough: 0.6 }), -0.68, topY + 0.43, 0.245);
  g.add(needle);

  // marka bandı
  g.add(detail(box(0.7, 0.14, 0.02), mat(BRASS, { rough: 0.28, metal: 0.7 }), 0, topY + 0.44, 0.21));

  const steam = makePlume(4, 0xf2f6f8, 0.09, 0.42);
  g.add(steam.im);

  return {
    tick(dt, t, act) {
      void dt;
      shot.visible = act > 0.15;
      shot.scale.y = 0.7 + Math.sin(t * 16) * 0.15;
      needle.rotation.z = -0.6 + act * 1.2 + Math.sin(t * 6) * 0.08 * act;
      steam.tick(t * 2, act * 0.8, 0.72, topY + 0.52, 0.3, 0.7, 0.14);
    },
  };
};


/* ---------------- süt barı (buhar + pitcher) ---------------- */

const buildSteamer: Builder = (g, p) => {
  const topY = counterBase(g, 1.8, 1.0, 0.88, 0.32);
  const chrome = mat(CHROME, { rough: 0.18, metal: 0.8 });

  // buhar kolonu
  g.add(mesh(roundBox(0.42, 0.7, 0.42, 0.06), mat(mix(p.accent, DARK, 0.35), { rough: 0.35, metal: 0.35 }), -0.5, topY + 0.35, -0.1));
  const wand = detail(cyl(0.03, 0.03, 0.46, 6), chrome, -0.5, topY + 0.36, 0.16);
  wand.rotation.x = 0.62;
  g.add(wand);
  g.add(detail(sph(0.045, 7, 6), chrome, -0.5, topY + 0.12, 0.36));

  // süt pitcher'ı (sallanan)
  const pitcher = new VisibilityRoot();
  pitcher.position.set(-0.5, topY + 0.02, 0.36);
  g.add(pitcher);
  pitcher.add(detail(cyl(0.15, 0.13, 0.26, 12), chrome, 0, 0.13, 0));
  const lip = detail(cone(0.07, 0.1, 6), chrome, 0, 0.28, 0.12);
  lip.rotation.x = -0.5;
  pitcher.add(lip);
  const ph = detail(torus(0.07, 0.02, 5, 10), chrome, -0.17, 0.14, 0);
  ph.rotation.y = Math.PI / 2;
  pitcher.add(ph);
  pitcher.add(detail(cyl(0.13, 0.13, 0.02, 12), mat(0xf7f4ec, { rough: 0.3 }), 0, 0.23, 0));

  // hazır latte fincanları
  const saucers = makeInstanced(cyl(0.13, 0.11, 0.02, 12), mat(0xfbf7ef, { rough: 0.35 }), 3);
  const mugs = makeInstanced(cyl(0.095, 0.075, 0.13, 12), mat(ITEMS.latte.color, { rough: 0.3 }), 3);
  for (let i = 0; i < 3; i++) {
    const x = 0.16 + i * 0.32;
    setInstance(saucers, i, x, topY + 0.01, 0.14);
    setInstance(mugs, i, x, topY + 0.08, 0.14);
  }
  flushInstances(saucers);
  flushInstances(mugs);
  g.add(saucers, mugs);

  // şurup şişeleri rafı
  g.add(detail(box(0.9, 0.04, 0.2), mat(mix(WOOD, 0xffffff, 0.3), { rough: 0.9 }), 0.42, topY + 0.5, -0.34));
  const bottles = makeInstanced(cyl(0.055, 0.06, 0.28, 8), mat(mix(p.accent, 0xffffff, 0.25), { rough: 0.35 }), 3);
  for (let i = 0; i < 3; i++) setInstance(bottles, i, 0.14 + i * 0.28, topY + 0.66, -0.34);
  flushInstances(bottles);
  g.add(bottles);

  const steam = makePlume(5, 0xf4f8fa, 0.1, 0.45);
  g.add(steam.im);
  batchPremium(pitcher);
  batchStationFurniture(g, [pitcher, steam.im]);

  return {
    tick(dt, t, act) {
      void dt;
      pitcher.position.y = topY + 0.02 + Math.sin(t * 3.2) * 0.02 * act;
      pitcher.rotation.z = Math.sin(t * 2.4) * 0.1 * act;
      steam.tick(t * 2.4, act, -0.5, topY + 0.34, 0.34, 0.8, 0.16);
    },
  };
};



/* ---------------- soğuk bar (dispenser) ---------------- */

const buildColdBar: Builder = (g, p) => {
  const topY = counterBase(g, 2.0, 1.0, 0.88, 0.18);
  let juice: THREE.Mesh | null = null;

  // iki cam dispenser
  for (let i = 0; i < 2; i++) {
    const x = -0.45 + i * 0.9;
    const glass = detail(cyl(0.3, 0.28, 0.6, 14), mat(0xe6f4f8, { rough: 0.08, transparent: true, opacity: 0.28 }), x, topY + 0.32, 0);
    glass.renderOrder = 2;
    g.add(glass);
    // v5: 'limonata' menüden silindi; dispenser rengi sabitlendi (eski ITEMS.limonata.color).
    const liquid = detail(cyl(0.26, 0.25, 0.42, 14), mat(i === 0 ? 0xf7ef9a : 0xe8846a, { rough: 0.28 }), x, topY + 0.25, 0);
    g.add(liquid);
    g.add(detail(cyl(0.31, 0.31, 0.06, 14), mat(BRASS, { rough: 0.28, metal: 0.7 }), x, topY + 0.65, 0));
    g.add(detail(sph(0.07, 8, 6), mat(BRASS, { rough: 0.28, metal: 0.7 }), x, topY + 0.71, 0));
    const tap = detail(cyl(0.035, 0.035, 0.14, 6), mat(BRASS, { rough: 0.3, metal: 0.65 }), x, topY + 0.1, 0.28);
    tap.rotation.x = Math.PI / 2;
    g.add(tap);
    if (i === 0) juice = liquid;
  }

  // buz kovası
  g.add(detail(cyl(0.2, 0.16, 0.2, 12), mat(CHROME, { rough: 0.22, metal: 0.72 }), 0.9, topY + 0.1, 0.2));
  const ice = makeInstanced(box(0.09, 0.09, 0.09), mat(0xeaf7ff, { rough: 0.06, transparent: true, opacity: 0.7, flatShading: true }), 4);
  for (let i = 0; i < 4; i++) setInstance(ice, i, 0.85 + (i % 2) * 0.1, topY + 0.22 + Math.floor(i / 2) * 0.08, 0.16 + (i % 2) * 0.08, i, i * 0.7, i * 0.4);
  flushInstances(ice);
  g.add(ice);

  // meyve dilimleri
  const slices = makeInstanced(cyl(0.09, 0.09, 0.02, 10), mat(0xf2d43f, { rough: 0.55 }), 3);
  for (let i = 0; i < 3; i++) setInstance(slices, i, -0.9 + i * 0.14, topY + 0.02, 0.3, Math.PI / 2, 0, i * 0.5);
  flushInstances(slices);
  g.add(slices);
  g.add(detail(box(0.6, 0.18, 0.02), mat(p.brand, { rough: 0.75 }), 0, 0.5, 0.51));

  return {
    tick(dt, t, act) {
      void dt;
      if (juice) {
        juice.position.y = topY + 0.25 + Math.sin(t * 2.2) * 0.014 * act;
        juice.scale.y = 1 + Math.sin(t * 1.6) * 0.05 * act;
      }
    },
  };
};

/* ---------------- blender ---------------- */

const buildBlender: Builder = (g, p) => {
  const topY = counterBase(g, 1.7, 0.95, 0.88, 0.36);
  const chrome = mat(CHROME, { rough: 0.2, metal: 0.75 });

  // ses kabini
  const cab = detail(box(0.6, 0.7, 0.55), mat(0xe8eef0, { rough: 0.08, transparent: true, opacity: 0.22 }), -0.1, topY + 0.35, 0);
  cab.renderOrder = 2;
  g.add(cab);
  // motor tabanı
  g.add(mesh(roundBox(0.44, 0.22, 0.44, 0.06), mat(mix(DARK, p.accent, 0.2), { rough: 0.35, metal: 0.4 }), -0.1, topY + 0.11, 0));
  // sürahi
  const jug = new VisibilityRoot();
  jug.position.set(-0.1, topY + 0.22, 0);
  g.add(jug);
  const jugGlass = detail(cyl(0.2, 0.16, 0.42, 10), mat(0xeef4f6, { rough: 0.08, transparent: true, opacity: 0.3 }), 0, 0.21, 0);
  jugGlass.renderOrder = 3;
  jug.add(jugGlass);
  const mixItem = detail(cyl(0.17, 0.14, 0.24, 10), mat(ITEMS.frappe.color, { rough: 0.35 }), 0, 0.14, 0);
  jug.add(mixItem);
  jug.add(detail(cyl(0.21, 0.21, 0.04, 10), mat(DARK, { rough: 0.6 }), 0, 0.44, 0));
  const jugHandle = detail(torus(0.09, 0.022, 5, 10), mat(DARK, { rough: 0.6 }), 0.22, 0.2, 0);
  jugHandle.rotation.y = Math.PI / 2;
  jug.add(jugHandle);

  // kontrol paneli
  g.add(detail(box(0.34, 0.12, 0.02), mat(DARK, { rough: 0.7 }), -0.1, topY + 0.12, 0.24));
  const leds = makeInstanced(sph(0.022, 6, 5), mat(0x7fe0a8, { emissive: 0x3fd07f, emissiveIntensity: 1.4, rough: 0.4 }), 3);
  for (let i = 0; i < 3; i++) setInstance(leds, i, -0.2 + i * 0.1, topY + 0.12, 0.26);
  flushInstances(leds);
  g.add(leds);

  // hazır bardaklar
  const glasses = makeInstanced(cyl(0.08, 0.065, 0.22, 10), mat(mix(ITEMS.frappe.color, 0xffffff, 0.35), { rough: 0.3 }), 2);
  setInstance(glasses, 0, 0.55, topY + 0.11, 0.2);
  setInstance(glasses, 1, 0.55, topY + 0.11, -0.16);
  flushInstances(glasses);
  g.add(glasses);
  g.add(detail(box(0.5, 0.16, 0.02), mat(p.brand, { rough: 0.75 }), 0, 0.5, 0.49));

  return {
    tick(dt, t, act) {
      void dt;
      jug.position.x = -0.1 + Math.sin(t * 40) * 0.006 * act;
      jug.rotation.z = Math.sin(t * 34) * 0.02 * act;
      mixItem.rotation.y = t * act * 12;
      leds.position.y = 0;
    },
  };
};

/* ---------------- fırın ---------------- */

const buildOven: Builder = (g, p) => {
  const brick = mat(mix(p.wallTrim, 0x8a6a52, 0.55), { rough: 0.98, flatShading: true });
  g.add(mesh(box(1.9, 0.55, 1.6), mat(mix(p.wall, 0x6d6257, 0.5), { rough: 1 }), 0, 0.32, 0));
  const dome = mesh(sph(0.88, 12, 9), brick, 0, 0.56, 0);
  dome.scale.set(1, 0.92, 0.92);
  g.add(dome);

  g.add(detail(box(0.66, 0.56, 0.26), mat(0x241812, { rough: 1 }), 0, 0.74, 0.72));
  const glow = detail(box(0.52, 0.42, 0.06), mat(0xff7a2a, { emissive: 0xff5e14, emissiveIntensity: 1.6, rough: 0.5 }), 0, 0.74, 0.84);
  glow.userData.noTint = false;
  g.add(glow);

  g.add(mesh(cyl(0.16, 0.2, 0.8, 8), brick, 0.4, 1.5, -0.42));

  const plume = makePlume(5, 0xdfe3e6, 0.15, 0.42);
  g.add(plume.im);

  return {
    tick(dt, t, act) {
      const pulse = 1 + Math.sin(t * 5.2) * 0.16 * act;
      glow.scale.set(pulse, pulse, 1 + act * 0.4);
      plume.tick(t, 0.25 + act * 0.75, 0.4, 1.95, -0.42, 1.5, 0.22);
    },
  };
};

/* ---------------- tost tezgâhı ---------------- */

const buildToaster: Builder = (g, p) => {
  g.add(mesh(box(1.75, 0.88, 1.0), mat(mix(WOOD, DARK, 0.2), { rough: 0.88 }), 0, 0.44, 0));
  g.add(mesh(box(1.85, 0.1, 1.1), mat(mix(p.wall, 0xffffff, 0.4), { rough: 0.5 }), 0, 0.93, 0));

  const steel = mat(METAL, { rough: 0.28, metal: 0.6 });
  g.add(mesh(box(1.05, 0.1, 0.72), steel, 0, 1.03, 0.06));
  const ridges = makeInstanced(box(0.98, 0.04, 0.05), mat(shade(METAL, 0.72), { rough: 0.4, metal: 0.5 }), 4);
  for (let i = 0; i < 4; i++) setInstance(ridges, i, 0, 1.1, -0.18 + i * 0.16);
  flushInstances(ridges);
  g.add(ridges);

  const hinge = detail(cyl(0.06, 0.06, 1.05, 6), steel, 0, 1.12, -0.32);
  hinge.rotation.z = Math.PI / 2;
  g.add(hinge);

  const lid = new VisibilityRoot();
  lid.position.set(0, 1.12, -0.32);
  g.add(lid);
  lid.add(mesh(box(1.05, 0.1, 0.72), steel, 0, 0.02, 0.38));
  lid.add(detail(box(0.34, 0.06, 0.06), mat(DARK, { rough: 0.8 }), 0, 0.06, 0.76));

  return {
    tick(dt, t, act) {
      const open = (Math.sin(t * 1.7) * 0.5 + 0.5) * act;
      lid.rotation.x = -0.62 * open;
    },
  };
};

/* ---------------- dondurma arabası ---------------- */

const buildIceCreamCart: Builder = (g, p) => {
  g.add(mesh(roundBox(1.7, 0.86, 0.95, 0.1), mat(p.brand, { rough: 0.7 }), 0, 0.86, 0));
  g.add(mesh(box(1.78, 0.1, 1.02), mat(0xfbf6ec, { rough: 0.5 }), 0, 1.33, 0));
  g.add(detail(box(1.4, 0.16, 0.04), mat(p.accent, { rough: 0.7 }), 0, 0.86, 0.5));

  const wheels = makeInstanced(cyl(0.3, 0.3, 0.11, 12), mat(DARK, { rough: 0.7 }), 2, true);
  setInstance(wheels, 0, -0.62, 0.3, 0.48, 0, 0, Math.PI / 2);
  setInstance(wheels, 1, -0.62, 0.3, -0.48, 0, 0, Math.PI / 2);
  flushInstances(wheels);
  g.add(wheels);
  g.add(detail(cyl(0.05, 0.05, 0.32, 6), mat(METAL, { rough: 0.4, metal: 0.5 }), 0.85, 1.15, 0).rotateZ(0.5));

  const posts = makeInstanced(box(0.07, 1.0, 0.07), mat(0xfbf6ec, { rough: 0.7 }), 2);
  setInstance(posts, 0, -0.78, 1.85, -0.4);
  setInstance(posts, 1, 0.78, 1.85, -0.4);
  flushInstances(posts);
  g.add(posts);
  const awning = mesh(box(1.9, 0.09, 1.0), mat(p.accent, { rough: 0.75 }), 0, 2.32, 0.1);
  awning.rotation.x = -0.2;
  g.add(awning);

  const swirl = new VisibilityRoot();
  swirl.position.set(0.55, 1.38, 0);
  g.add(swirl);
  swirl.add(detail(cone(0.2, 0.4, 8), mat(0xfff2f6, { rough: 0.6 }), 0, 0.2, 0));
  swirl.add(detail(sph(0.12, 8, 6), mat(ITEMS.dondurma.accent, { rough: 0.6 }), 0, 0.44, 0));

  return {
    tick(dt, t, act) {
      swirl.rotation.y += dt * (0.4 + act * 2.2);
      swirl.position.y = 1.38 + Math.sin(t * 2.6) * 0.025 * act;
    },
  };
};


/* ---------------- kafe masası ---------------- */

/* ================================================================== *
 *  TABLA DOKULARI
 *
 *  Masalar mekândaki EN GENİŞ yatay yüzeydir: dikey kadrajda oyuncu
 *  onlara neredeyse tepeden bakar, yani tablanın yüzeyi ekranda bir
 *  sandalyeden çok daha fazla piksel kaplar. Düz tek renk bir tabla
 *  ne kadar iyi biçimlendirilirse biçimlendirilsin "boyanmış plastik"
 *  okunur — pahalı mobilyayı pahalı yapan şey MALZEMENİN KENDİSİDİR:
 *  mermerin damarı, ahşabın yıllık halkası.
 *
 *  Dokular tür başına BİR kez üretilir (masa başına değil) ve malzeme
 *  önbelleğe alınır; 12 masa için toplam 3 doku + 3 malzeme demektir.
 * ================================================================== */

function hexs(c: number): string {
  return '#' + (c & 0xffffff).toString(16).padStart(6, '0');
}

/** Küçük deterministik üreteç — devshot'lar tekrar edilebilir olsun. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const topTexCache = new Map<string, THREE.CanvasTexture>();

/**
 * MERMER. Damar, tuvali baştan sona geçen yumuşak bir eğridir; gerçek
 * mermerde damar YÜZEYİ BÖLER, kenarda durmaz. Her ana damarın yanına
 * daha ince iki dal çizilir (mermerin "çatlak ağacı" karakteri) ve en
 * sonda çok geniş, çok soluk bir bulut katmanı ton kirliliği verir —
 * bu olmadan taş "beyaz kâğıt üstüne çizgi" gibi durur.
 */
function marbleTexture(base: number, vein: number, strengthOrVein2 = 0.5): THREE.CanvasTexture {
  const key = `m${base}_${vein}_${strengthOrVein2}`;
  const hit = topTexCache.get(key);
  if (hit) return hit;
  const hasSecondaryVein = strengthOrVein2 > 2;
  const strength = hasSecondaryVein ? 0.9 : strengthOrVein2;
  const vein2 = hasSecondaryVein ? strengthOrVein2 : vein;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');
  if (ctx) {
    const R = rng(0x51a7);
    ctx.fillStyle = hexs(base);
    ctx.fillRect(0, 0, S, S);
    // bulut: geniş ve soluk ton sapmaları
    for (let i = 0; i < 9; i++) {
      const gx = R() * S;
      const gy = R() * S;
      const gr = S * (0.18 + R() * 0.3);
      const grd = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      const light = R() > 0.5;
      grd.addColorStop(0, light ? 'rgba(255,255,255,0.085)' : 'rgba(60,50,40,0.06)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, S, S);
    }
    // damarlar: tuvali çapraz geçen eğriler + ince dallar
    ctx.lineCap = 'round';
    const vh = hexs(vein);
    const vr = parseInt(vh.slice(1, 3), 16);
    const vg = parseInt(vh.slice(3, 5), 16);
    const vb = parseInt(vh.slice(5, 7), 16);
    const vh2 = hexs(vein2);
    const vr2 = parseInt(vh2.slice(1, 3), 16);
    const vg2 = parseInt(vh2.slice(3, 5), 16);
    const vb2 = parseInt(vh2.slice(5, 7), 16);
    for (let i = 0; i < 6; i++) {
      const y0 = ((i + R() * 0.7) / 6) * S;
      const drift = (R() - 0.5) * S * 0.55;
      const bow = (R() - 0.5) * S * 0.5;
      const useSub = hasSecondaryVein && i % 2 === 1;
      const rCol = useSub ? vr2 : vr;
      const gCol = useSub ? vg2 : vg;
      const bCol = useSub ? vb2 : vb;
      const draw = (w: number, a: number, off: number, sr = rCol, sg = gCol, sb = bCol): void => {
        ctx.strokeStyle = `rgba(${sr},${sg},${sb},${a})`;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(-8, y0 + off);
        ctx.quadraticCurveTo(S * 0.5, y0 + bow + off, S + 8, y0 + drift + off);
        ctx.stroke();
      };
      draw(3.4, 0.1 * strength, 0); // damarın yumuşak gölgesi
      draw(1.5, 0.55 * strength, 0); // ana damar
      draw(0.7, 0.3 * strength, 5 + R() * 7, vr2, vg2, vb2); // dal
      draw(0.6, 0.22 * strength, -4 - R() * 6); // dal
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  topTexCache.set(key, tex);
  return tex;
}

/**
 * TERRAZZO — kare tablaların taşı.
 *
 * Burada önce gerçekçi mermer denendi ve BAŞARISIZ oldu: 1,6 birimlik bir
 * tablada uzun süpürme damarları, oyun kamerasından malzeme gibi değil
 * TABLAYA ATILMIŞ ÇİZİK gibi okunuyordu (bkz. devshot f2-21). Damarın
 * ikna edici olması için tablanın ekranda kapladığı alandan çok daha ince
 * bir ölçek gerekiyor; o ölçekte de mobil ekranda kayboluyor.
 *
 * Terrazzo bu oyunun diline uyar: desen NOKTASALDIR, yani hangi mesafeden
 * bakılırsa bakılsın aynı okunur, düşük poligonlu düz gölgeli üslupla
 * çelişmez ve renkleri mekânın paletinden alınır — tabla böylece mekânın
 * bir parçası olur, üstüne konmuş beyaz bir levha değil.
 */
function terrazzoTexture(base: number, chips: number[]): THREE.CanvasTexture {
  const key = `z${base}_${chips.join('-')}`;
  const hit = topTexCache.get(key);
  if (hit) return hit;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');
  if (ctx) {
    const R = rng(0x7f31);
    ctx.fillStyle = hexs(base);
    ctx.fillRect(0, 0, S, S);
    // ince toz: çipler arasındaki harç tek düz renk kalmasın
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = R() > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(90,78,62,0.1)';
      ctx.fillRect(R() * S, R() * S, 1.5, 1.5);
    }
    /**
     * Çip: köşeli, düzensiz beşgen. Daire kullanılırsa yüzey "puantiye
     * kumaş" olur; terrazzoyu taş yapan şey kırık kenarlardır.
     * Kenardan taşanlar karşı kenara da çizilir → doku KESİNTİSİZ tekrar.
     */
    const chip = (cx: number, cy: number, rr: number, col: number): void => {
      ctx.fillStyle = hexs(col);
      ctx.beginPath();
      const n = 5 + Math.floor(R() * 2);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + R() * 0.45;
        const rad = rr * (0.62 + R() * 0.5);
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    };
    for (let i = 0; i < 150; i++) {
      const cx = R() * S;
      const cy = R() * S;
      const rr = 2.2 + R() * R() * 7.5; // küçük çip çok, büyük çip az
      const col = chips[Math.floor(R() * chips.length)];
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          if ((ox !== 0 || oy !== 0) && (Math.min(cx, S - cx) > rr && Math.min(cy, S - cy) > rr)) continue;
          chip(cx + ox * S, cy + oy * S, rr, col);
        }
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  topTexCache.set(key, tex);
  return tex;
}

/**
 * AHŞAP TABLA — yıllık halkalar. Yuvarlak tablanın kapak UV'si diski
 * 0..1 karesine ORTALAYARAK açar, yani merkezli çemberler tablada tam
 * merkezli çıkar: tek bir doku ile "tek gövdeden kesilmiş masif tabla"
 * okuması bedava gelir. Halka aralığı düzensizdir (eşit aralık = kontrplak).
 */
function woodRingTexture(base: number, ring: number): THREE.CanvasTexture {
  const key = `w${base}_${ring}`;
  const hit = topTexCache.get(key);
  if (hit) return hit;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');
  if (ctx) {
    const R = rng(0x2c19);
    ctx.fillStyle = hexs(base);
    ctx.fillRect(0, 0, S, S);
    // öz merkez tablanın ortasında değil: gerçek kesitte hep kaçıktır
    const cx = S * 0.44;
    const cy = S * 0.53;
    ctx.strokeStyle = hexs(ring);
    let r = 4;
    while (r < S * 1.05) {
      ctx.globalAlpha = 0.05 + R() * 0.09;
      ctx.lineWidth = 0.8 + R() * 1.6;
      ctx.beginPath();
      // hafif eliptik: kesit dik değil, bu da halkaları doğallaştırır
      ctx.ellipse(cx, cy, r, r * 1.13, 0.35, 0, TAU);
      ctx.stroke();
      r += 3.5 + R() * 6.5;
    }
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  topTexCache.set(key, tex);
  return tex;
}

const topMatCache = new Map<string, THREE.MeshStandardMaterial>();
/** Dokulu tabla malzemesi — `mat()` önbelleğini kirletmemek için ayrı. */
function toppedMat(key: string, map: THREE.Texture, rough: number, metal: number): THREE.MeshStandardMaterial {
  let m = topMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: metal });
    topMatCache.set(key, m);
  }
  return m;
}

/* ================================================================== *
 *  TABLA KOZMETİĞİ (bkz. data/cosmetics.ts)
 *
 *  Tabla malzemeleri BÜTÜN masalarda paylaşılır — yuvarlaklar tek
 *  malzeme, kareler tek malzeme. Bu yüzden görünüm değiştirmek tek bir
 *  `material.map` ataması: 12 masa da AYNI KAREDE değişir, tek bir mesh
 *  eklenmez, çizim çağrısı sabit kalır.
 *
 *  VIP masalar bilerek DIŞARIDA: mermer tabla ₺230.000'lik bölgenin
 *  satın alma vaadi, kozmetikle değiştirilmez.
 * ================================================================== */

let tableSkin: TableSkin = TABLE_SKINS[0];

/** Yaşayan tabla malzemeleri: kozmetik değişince haritaları yenilenir. */
const liveTops: { m: THREE.MeshStandardMaterial; stone: boolean; pal: LocationPalette }[] = [];

/** Şubenin kendi taş tonu — `native` seçenekte paletten türer (traverten). */
function nativeStoneBase(pal: LocationPalette): number {
  return mix(pal.wall, 0xb9ac97, 0.72);
}

function topTexFor(stone: boolean, skin: TableSkin, pal: LocationPalette): THREE.Texture {
  if (stone) {
    const base = skin.native ? nativeStoneBase(pal) : skin.stone.base;
    const chips = skin.native
      ? [mix(pal.brand, 0x0f2018, 0.35), mix(pal.accent, 0x5a2a12, 0.3), 0x4b3a2a, 0xfaf3e6]
      : [...skin.stone.chips];
    return terrazzoTexture(base, chips);
  }
  return skin.native
    ? premiumWoodMaterial().map!
    : woodRingTexture(skin.wood.base, skin.wood.ring);
}

function liveTopMat(stone: boolean, pal: LocationPalette): THREE.MeshStandardMaterial {
  const key = stone ? `top-stone-${pal.wall.toString(16)}-${pal.brand.toString(16)}` : 'top-wood';
  const hit = topMatCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({
    map: topTexFor(stone, tableSkin, pal),
    roughness: stone ? 0.34 : 0.61,
    metalness: stone ? 0.05 : 0,
  });
  topMatCache.set(key, m);
  liveTops.push({ m, stone, pal });
  return m;
}

/** Seçilen tabla görünümünü ANINDA uygular (panel kapanmadan). */
export function setTableSkin(skin: TableSkin): void {
  if (skin.id === tableSkin.id) return;
  tableSkin = skin;
  for (const t of liveTops) {
    t.m.map = topTexFor(t.stone, skin, t.pal);
    t.m.needsUpdate = true;
  }
}

/** VIP masaların altın rengi. */
const GOLD_VIP = 0xd4a017;
const TABLE_R = 0.75;
const SEAT_R = SEAT_RADIUS;
const TRASH_MAX = 4;
const ARC_SEG = 14;

/** Tabla üstünde kirli parçaların dağıldığı sabit noktalar (x,z çiftleri).
 *  Servis takımı dış halkada durduğu için bunlar merkeze yakın kalır. */
const TRASH_SPOT: number[] = [-0.17, 0.1, 0.16, 0.16, 0.19, -0.12, -0.1, -0.19];

/* Kirli parçalar — indekse göre farklı mesh, 3 çöplü masa tekdüze görünmesin. */

function makeDirtyCup(): THREE.Group {
  const gg = new VisibilityRoot();
  const porcelain = mat(0xf3efe6, { rough: 0.52 });
  const darkCoffee = mat(0x422615, { rough: 0.45 });
  const steel = mat(0xd4dce2, { metal: 0.8, rough: 0.28 });
  // Alt tabak + kahve lekesi
  gg.add(detail(cyl(0.125, 0.11, 0.018, 12), porcelain, 0, 0.009, 0));
  gg.add(detail(cyl(0.08, 0.08, 0.003, 10), darkCoffee, 0.015, 0.019, 0.01));
  // Kahve fincanı + kulp
  gg.add(detail(cyl(0.075, 0.058, 0.14, 10), porcelain, -0.01, 0.08, -0.01));
  gg.add(detail(cyl(0.062, 0.062, 0.016, 9), darkCoffee, -0.01, 0.138, -0.01));
  const handle = detail(torus(0.045, 0.014, 4, 9), porcelain, 0.076, 0.08, -0.01);
  handle.rotation.y = Math.PI / 2;
  gg.add(handle);
  // Yanında kirli çay kaşığı
  const spoon = detail(box(0.16, 0.008, 0.018), steel, 0.04, 0.024, 0.045);
  spoon.rotation.set(-0.04, -0.7, 0.02);
  gg.add(spoon);
  return gg;
}

function makeNapkin(): THREE.Group {
  const gg = new VisibilityRoot();
  const porcelain = mat(0xf3efe6, { rough: 0.52 });
  const darkCoffee = mat(0x422615, { rough: 0.45 });
  // Tatlı tabağı + tabak içi sos lekesi
  gg.add(detail(cyl(0.13, 0.115, 0.018, 12), porcelain, 0, 0.009, 0));
  gg.add(detail(cyl(0.06, 0.06, 0.003, 8), darkCoffee, -0.02, 0.019, 0.01));
  // Buruşmuş kirli peçete yığını
  const a = detail(sph(0.085, 7, 6), mat(0xede8dc, { rough: 0.96, flatShading: true }), 0.01, 0.055, 0);
  a.scale.set(1.25, 0.6, 1);
  a.rotation.y = 0.6;
  gg.add(a);
  const b = detail(sph(0.065, 6, 5), mat(0xe2dcce, { rough: 0.96, flatShading: true }), 0.04, 0.088, -0.02);
  b.scale.set(1, 0.7, 1.2);
  b.rotation.y = -0.5;
  gg.add(b);
  // Yarı açılmış şeker paketi
  const sugar = detail(box(0.08, 0.012, 0.035), mat(0xdfd9ce, { rough: 0.9 }), -0.06, 0.022, 0.05);
  sugar.rotation.y = 0.4;
  gg.add(sugar);
  return gg;
}

function makeCrumbPlate(): THREE.Group {
  const gg = new VisibilityRoot();
  const porcelain = mat(0xf7f4ec, { rough: 0.5 });
  const steel = mat(0xd4dce2, { metal: 0.8, rough: 0.28 });
  // Üst üste iki tabak
  gg.add(detail(cyl(0.165, 0.14, 0.026, 14), porcelain, 0, 0.013, 0));
  const topPlate = detail(cyl(0.125, 0.105, 0.022, 12), mat(0xf1ece0, { rough: 0.52 }), 0.015, 0.034, -0.01);
  topPlate.rotation.set(0.02, 0.4, -0.02);
  gg.add(topPlate);
  // Tabağın kenarına bırakılmış çatal
  const fork = detail(box(0.22, 0.01, 0.024), steel, 0.04, 0.052, 0.01);
  fork.rotation.set(0.04, 0.35, 0.06);
  gg.add(fork);
  // Kırıntılar
  const crumbs = makeInstanced(sph(0.022, 5, 4), mat(0xb9762f, { rough: 0.95, flatShading: true }), 6);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.85;
    setInstance(crumbs, i, Math.cos(a) * 0.075, 0.05, Math.sin(a) * 0.068, 0, a, 0, 0.7 + (i % 3) * 0.28);
  }
  flushInstances(crumbs);
  gg.add(crumbs);
  return gg;
}

function makeEmptyBottle(): THREE.Group {
  const gg = new VisibilityRoot();
  const glass = mat(0x8fbfae, { rough: 0.22, transparent: true, opacity: 0.62 });
  const porcelain = mat(0xf3efe6, { rough: 0.55 });
  // Boş meşrubat bardağı / şişe
  gg.add(detail(cyl(0.055, 0.068, 0.19, 9), glass, -0.04, 0.095, -0.03));
  gg.add(detail(cyl(0.026, 0.048, 0.07, 7), glass, -0.04, 0.225, -0.03));
  gg.add(detail(cyl(0.03, 0.03, 0.028, 7), mat(0xd23b2e, { rough: 0.6 }), -0.04, 0.27, -0.03));
  // Yanında yana devrilmiş küçük espresso fincanı
  const cup = detail(cyl(0.055, 0.042, 0.075, 8), porcelain, 0.06, 0.045, 0.04);
  cup.rotation.set(0.1, 0.2, 1.45);
  gg.add(cup);
  // Damlamış minik kahve lekesi
  const drop = detail(cyl(0.045, 0.045, 0.003, 8), mat(0x422615, { rough: 0.5 }), 0.09, 0.005, 0.05);
  gg.add(drop);
  return gg;
}


/* ---------------- süpürge park yeri ---------------- *
 * Dolap YOK: zeminde işaretli açık bir park pedi. Süpürge bırakıldığında
 * pedin üstünde AYAKTA ve GÖRÜNÜR durur (elde taşınan modelle aynı
 * gövde dili); alındığında ped boşalır — süpürgenin kimde olduğu odanın
 * öbür ucundan okunur. Eski dolap hem hantal duruyordu hem süpürgeyi
 * gizliyordu ("dolabı kaldıralım, bıraktığımızda süpürge de gözüksün"). */
const buildVacuumDock: Builder = (g, p) => {
  // zemin pedi: koyu daire + vurgu renginde kenar halkası
  g.add(detail(cyl(0.62, 0.62, 0.035, 20), mat(mix(DARK, 0xffffff, 0.28), { rough: 0.92 }), 0, 0.018, 0));
  const ring = detail(torus(0.56, 0.035, 5, 24), mat(p.accent, { rough: 0.5 }), 0, 0.045, 0);
  ring.rotation.x = -Math.PI / 2;
  g.add(ring);
  // ince tabela direği
  g.add(detail(cyl(0.03, 0.03, 1.9, 6), mat(CHROME, { rough: 0.3, metal: 0.6 }), -0.5, 0.95, -0.2));
  const plate = detail(plane(1.15, 0.26), sharedLabelMaterial(tr("SÜPÜRGE"), 0x1d2b34, 0xffe6b0, 1.15 / 0.26), -0.5, 2.0, -0.2);
  plate.userData.noTint = true;
  g.add(plate);

  // The dock and the held tool use exactly the same original model and buffers.
  const parked = createPremiumVacuum(p.accent);
  const vac = parked.root;
  vac.name = 'parkedSeraVacuum';
  vac.position.z = -BALANCE.vacuum.brushForward;
  g.add(vac);

  return {
    // `setOutput(1)` → süpürge yerinde · `setOutput(0)` → oyuncunun elinde
    ownOutput: true,
    onOutput(count) {
      vac.visible = count > 0;
    },
  };
};

const buildTable: Builder = (g, p, def) => {
  const seats = Math.max(1, Math.min(6, def.seats ?? 2));
  /** Kare masa: dört ayak + kare tabla; sandalyeler kenar ortalarında. */
  const sq = def.visual !== 'table';
  const topHalf = STATION_BODY[def.visual]?.x ?? TABLE_R;
  // Yuvarlakta 2 kişilik sağ/sol, 4 kişilik köşegen; karede kenar ortaları.
  const aBase = seatAngle(sq ? 'tablesq' : 'table',seats,0);
  const packed = tryAddPackFurniture(g, def, seats, p);
  if (!packed) {

  /**
   * VIP masa aynı iskeleti kullanır ama pahalı görünür: mermer tabla,
   * altın kenar, kadife koltuk ve zemine serilmiş bordo halı. Oyuncu
   * ₺240.000'i neye verdiğini bir bakışta görmeli.
   */
  const vip = def.vip === true;
  /**
   * MALZEME KARŞITLIĞI: kare masalar TAŞ, yuvarlaklar AHŞAP tablalıdır.
   * Aynı odada iki farklı malzeme, tek malzemeli bir dizilimden daima daha
   * pahalı okunur; ayrıca oyuncu masa tiplerini bir bakışta ayırt eder.
   */
  /**
   * DİKKAT: doku ÇARPAR, aydınlatmaz. Bu yüzden taban rengi malzemeye
   * değil DOKUYA yazılır ve malzeme rengi beyaz kalır — aksi halde VIP'in
   * altın damarı koyu mavi tablayla çarpılıp gri bir çizgiye dönerdi.
   */
  /**
   * Taş tonu KOYULAŞTIRILDI. Önceki karışım duvarın kremine çok yakındı
   * (L* ~90) ve oyun kamerasında kare tablalar kadrajın en parlak lekesi
   * oluyordu: mermer değil BOŞ BEYAZ LEVHA okunuyordu. Traverten değeri
   * (L* ~80) hem damarın görünmesine izin verir hem de üstündeki fincan
   * ve tabakların silüetini korur.
   */
  /**
   * VIP MERMERİ SİLUET DELİĞİ OLMAKTAN ÇIKARILDI (0x2b2f3a → 0x3f4657).
   *
   * Eski taban tonu neredeyse siyahtı (L* ~19). Tepeden bakan kamerada
   * tablanın kendi biçimi hiç okunmuyor, ekranda yalnız KOYU BİR DAİRE
   * kalıyordu — şemsiye kanopisi okumasının yarısı buradan geliyordu.
   * Yeni ton hâlâ koyu (L* ~29) ve altın damar üstünde tek vurgu olmaya
   * devam ediyor, ama tablanın kenarı, üstündeki takım ve pirinç kakma
   * artık ayrı ayrı seçiliyor. "Koyu zeminde altın tek vurgu" kuralı
   * korunuyor; kural KOYU diyordu, SİYAH değil.
   */
  /**
   * VIP dışındaki tablalar KOZMETİK malzemeyi kullanır (bkz. liveTopMat):
   * bütün yuvarlaklar tek malzemeyi, bütün kareler tek malzemeyi paylaşır,
   * böylece oyuncu tabla seçtiğinde hepsi aynı karede değişir.
   *
   * Varsayılan (`native`) seçenek eski değerlerin BİREBİR aynısını üretir:
   * kare → paletten türeyen traverten terrazzo, yuvarlak → bal meşesi
   * (`mix(WOOD, beyaz)` doygunluğu düşürüp tablayı "somon plastik"
   * yaptığı için sıcak sarıya doğru açılır).
   */
  const topMat = vip
    ? toppedMat('vip', marbleTexture(0x3f4657, 0xf5d98c, 0.9), 0.26, 0.16)
    : liveTopMat(sq, p);
  const rimMat = vip ? mat(GOLD_VIP, { rough: 0.25, metal: 0.8 }) : mat(p.brand, { rough: 0.7 });

  /* --- gövde: kaide + orta ayak + tabla --- */
  if (vip) {
    /**
     * MASA ALTI HALI KÜÇÜLTÜLDÜ — üç kırmızı katman üst üste biniyordu.
     *
     * Ölçüm: VIP masalar 3,35-3,40 birim aralıklı, eski halı çapı 4,10 ve
     * altın halka çapı 3,96 idi; yani komşu halılar 0,7, halkalar 0,6 birim
     * ÜST ÜSTE geliyordu. Ekranda iç içe geçmiş üç altın çember ve baştan
     * sona kırmızı bir zemin okunuyordu — odanın kendi bordo döşemesiyle
     * birlikte "lüks" değil lunapark. Yarıçap 2,05 → 1,45: halılar artık
     * 0,45 birim ARALIKLI, her masa kendi adasında durur.
     */
    /**
     * HALI KOTU 0,012 → 0,052.
     *
     * Halı görünmüyordu: VIP odasının kendi döşeme kaplaması masa grubuna
     * göre 0,03 kotunda duruyor ve 0,012'deki halıyı tamamen örtüyordu —
     * ekranda yalnızca altın halka kalıyor, zeminde havada duran bir çember
     * gibi okunuyordu (devshot f2-50). Halka da halının üstüne çıkarıldı.
     */
    /**
     * HALI YUVARLAK DEĞİL DİKDÖRTGEN — "ŞEMSİYE" OKUMASINI KIRAN ASIL HAMLE.
     *
     * Ölçülen sorun: 48°lik portre kamerada VIP masası masa değil PARASOL
     * silueti veriyordu. Sebep üç eş merkezli dairenin üst üste yığılmasıydı
     * — koyu yuvarlak tabla (kanopi), tek merkezî kaide (direk) ve altında
     * yuvarlak bordo halı (kumsal matı). Tepeden bakan bir kamerada bu üçlü
     * bir araya gelince beyin şemsiyeyi masaya tercih ediyor.
     *
     * Daireyi dikdörtgene çevirmek yığını tek hamlede bozar: dikdörtgen
     * halı mekânın eksenleriyle hizalıdır, yani "zemine serilmiş tekstil"
     * okunur; hiçbir şemsiyenin altında köşeli mat olmaz. Üstelik gerçek
     * lüks salon halıları da dikdörtgendir — doğru referans zaten buydu.
     *
     * Çizim maliyeti değişmedi: gövde yine tek mesh, altın çerçeve
     * torus yerine 4 örnekli tek InstancedMesh (yine tek çizim).
     */
    /**
     * Ölçü 2,9 × 2,4 denendi: masalar 3,2 (x) ve 2,9 (z) aralıklı olduğu
     * için halılar arasında yalnız 0,3-0,5 birim kalıyor ve üç halı tek bir
     * kırmızı blok hâlinde birleşiyordu. 2,6 × 2,1 her masayı kendi adasına
     * oturtur (aralık 0,6-0,8) — "her masa kendi adasında" kuralı, VIP
     * halkalarında bir kez öğrenilmişti.
     */
    const rug = detail(box(2.6, 0.02, 2.1), mat(0x6d2438, { rough: 1 }), 0, 0.052, 0);
    rug.receiveShadow = true;
    g.add(rug);
    const rugRim = makeInstanced(box(1, 1, 1), mat(GOLD_VIP, { rough: 0.3, metal: 0.7 }), 4, true);
    setInstance(rugRim, 0, 0, 0.068, 0.96, 0, 0, 0, 2.36, 0.012, 0.045);
    setInstance(rugRim, 1, 0, 0.068, -0.96, 0, 0, 0, 2.36, 0.012, 0.045);
    setInstance(rugRim, 2, 1.19, 0.068, 0, 0, 0, 0, 0.045, 0.012, 1.96);
    setInstance(rugRim, 3, -1.19, 0.068, 0, 0, 0, 0, 0.045, 0.012, 1.96);
    flushInstances(rugRim);
    g.add(rugRim);
  }
  /**
   * PREMIUM MOBİLYA.
   *
   * Eski masa "kutu ayak + düz tabla", sandalye "yassı minder + dikdörtgen
   * arkalık"tı: silüet mobilya değil KURULUM PARÇASI gibi okunuyordu.
   * Pahalı görünmenin üç ucuz kuralı burada uygulanır —
   *   1) MALZEME KARŞITLIĞI: taş/ahşap tabla + pirinç kenar bandı;
   *   2) KONİK ve AÇILI ayak: dikey kutu ayak "ucuz masa" imzasıdır,
   *      aşağı doğru incelen ve dışa açılan ayak tasarım imzasıdır;
   *   3) KALINLIK KADEMESİ: tabla altında etek, kenarda ince pah —
   *      tek düzlem yerine üç kademe, ışık her kademede kırılır.
   */
  /**
   * Pirinç kenar bandı — İNCE. İlk deneme 0,035 tüp yarıçapıyla masanın
   * tablası kadar kalın bir altın halka üretiyordu: "kenar bandı" değil
   * "taç" gibi okunuyor ve masayı ucuzlatıyordu. Kenar bandı bir vurgu
   * çizgisidir; kalınlaşırsa vurgu olmaktan çıkar. Ton da kırıldı.
   */
  const brass = mat(vip ? GOLD_VIP : 0xa8834b, { rough: 0.4, metal: 0.55 });
  if (sq) {
    /* --- KARE MASA: mermer tabla + pirinç kenar + konik açılı ayaklar --- */
    const legMat = mat(vip ? GOLD_VIP : mix(WOOD, DARK, 0.42), { rough: vip ? 0.3 : 0.6, metal: vip ? 0.7 : 0.1 });
    /**
     * KONİKLİK YÖNÜ: kalın uç YUKARIDA. İlk sürüm tersiydi (rTop 0,035 /
     * rBot 0,075) ve ayaklar yere doğru şişerek "ağaç kütüğü" gibi
     * duruyordu — bu, ucuz hazır mobilyanın imzasıdır. Gerçek marangozlukta
     * yük üstte taşınır, ayak aşağı doğru İNCELİR; silüet hafifler.
     */
    const tLegs = makeInstanced(cyl(0.072, 0.036, 0.9, 8), legMat, 4, true);
    for (let k = 0; k < 4; k++) {
      const lx = k < 2 ? 0.6 : -0.6;
      const lz = k % 2 === 0 ? 0.6 : -0.6;
      // Ayak dışa AÇILIR: tepesi içeride, tabanı dışarıda.
      setInstance(tLegs, k, lx, 0.45, lz, lz > 0 ? -0.05 : 0.05, 0, lx > 0 ? 0.05 : -0.05);
    }
    flushInstances(tLegs);
    g.add(tLegs);
    // ayaklar arası kayıt çıtası: gerçek mobilya kadar "yapılmış" görünür
    const rails = makeInstanced(box(1.18, 0.05, 0.05), legMat, 2, true);
    setInstance(rails, 0, 0, 0.24, 0.58);
    setInstance(rails, 1, 0, 0.24, -0.58, 0, Math.PI / 2, 0);
    flushInstances(rails);
    g.add(rails);
    // etek → pirinç kenar bandı → tabla: üç kademe
    g.add(detail(roundBox(1.44, 0.08, 1.44, 0.02), mat(mix(WOOD, DARK, 0.3), { rough: 0.8 }), 0, 0.86, 0));
    g.add(detail(roundBox(1.65, 0.022, 1.65, 0.01), brass, 0, 0.918, 0));
    /**
     * Tabla `box`, `roundBox` değil: `roundBox` küreden şişirildiği için
     * UV'leri KÜRESELDİR, üstüne serilen mermer kutup çevresinde ezilir.
     * Ayrıca taşın köşesi yuvarlak olmaz — pah atılır, ve pah görevini
     * hemen altındaki pirinç bant zaten görüyor.
     */
    g.add(mesh(box(1.62, 0.075, 1.62), topMat, 0, 0.965, 0));
  } else {
    /* --- YUVARLAK MASA: dört kollu döküm kaide + konik kolon --- */
    const baseMat = mat(vip ? GOLD_VIP : mix(WOOD, DARK, 0.5), { rough: vip ? 0.3 : 0.55, metal: vip ? 0.7 : 0.15 });
    // Dört kollu ayak: tek disk yerine yıldız kaide — klasik bistro imzası.
    /**
     * Yıldız kaide: kollar diskin ALTINDAN çıkıp yere uzanır ve ucunda
     * küçük bir ayak topuğu var. İlk deneme kısa kollardı ve diskin
     * kenarından çıkan tuhaf tırnaklar gibi okunuyordu.
     */
    const arms4 = makeInstanced(box(0.94, 0.055, 0.115), baseMat, 4, true);
    for (let k = 0; k < 4; k++) setInstance(arms4, k, 0, 0.035, 0, 0, (k / 4) * TAU, 0);
    flushInstances(arms4);
    g.add(arms4);
    const feet = makeInstanced(cyl(0.055, 0.07, 0.05, 7), brass, 4, true);
    for (let k = 0; k < 4; k++) {
      const a4 = (k / 4) * TAU;
      setInstance(feet, k, Math.sin(a4) * 0.44, 0.025, Math.cos(a4) * 0.44);
    }
    flushInstances(feet);
    g.add(feet);
    g.add(detail(cyl(0.17, 0.23, 0.09, 12), baseMat, 0, 0.08, 0));
    g.add(mesh(cyl(0.085, 0.145, 0.8, 12), baseMat, 0, 0.47, 0));
    // kolon bileziği: dikey çubuğu ikiye böler, "torna" hissi verir
    g.add(detail(cyl(0.108, 0.108, 0.042, 12), brass, 0, 0.62, 0));
    g.add(detail(cyl(TABLE_R - 0.03, TABLE_R - 0.06, 0.05, 22), mat(mix(WOOD, DARK, 0.32), { rough: 0.82 }), 0, 0.9, 0));
    g.add(mesh(cyl(TABLE_R, TABLE_R, 0.07, 22), topMat, 0, 0.955, 0));
    const rim = detail(torus(TABLE_R + 0.004, 0.019, 5, 26), brass, 0, 0.955, 0);
    rim.rotation.x = -Math.PI / 2;
    g.add(rim);
  }
  if (vip) {
    /**
     * TABLANIN ÜSTÜ DOLDURULDU — "boş koyu daire" artık yok.
     *
     * Eskiden VIP masasının üstünde yalnız 0,07 yarıçaplı minik bir şamdan
     * vardı ve masa üstü takımı BİLEREK atlanıyordu ("VIP'te zaten şamdan
     * var"). Ama şamdan tepeden bakınca tablanın merkezinde 3-4 pikselik
     * bir noktaydı: tabla fiilen boştu ve boş koyu daire = kanopi.
     *
     * Tepeden bakan bir kamerada bir yüzeyin "masa" olduğunu söyleyen tek
     * şey ÜSTÜNDEKİ EŞYADIR. Onun için buraya gerçek bir kuver kondu:
     * pirinç kakma halka (tablayı iki bölgeye ayırır), ortada tepsi,
     * iki fincan-tabak ve bir vazo. Hepsi iki InstancedMesh'te toplandı.
     */
    // Pirinç kakma halka: tablanın içine bir çember çizer, düz daireyi böler.
    const inlay = detail(torus(TABLE_R - 0.17, 0.013, 4, 26), mat(GOLD_VIP, { rough: 0.28, metal: 0.75 }), 0, 1.0, 0);
    inlay.rotation.x = -Math.PI / 2;
    g.add(inlay);

    // Şamdan: gövde büyütüldü, tepeden de bir kütle olarak okunuyor.
    g.add(detail(cyl(0.075, 0.115, 0.17, 8), mat(GOLD_VIP, { rough: 0.25, metal: 0.8 }), 0, 1.075, 0));
    g.add(detail(cyl(0.05, 0.05, 0.2, 8), mat(0xfff3d6, { rough: 0.6 }), 0, 1.26, 0));
    g.add(detail(sph(0.055, 7, 6), basic(0xffd98a, 1, true), 0, 1.38, 0));

    /**
     * Kuver: iki tabak + iki fincan tek yığında (tek çizim), tepsi ayrı.
     * Konumlar sandalyelerin önüne değil tablanın iki yakasına konur —
     * misafir gelince servis takımı (`served`) zaten oraya yazılıyor,
     * çakışmasın diye kuver merkeze YAKIN durur.
     */
    const saucers = makeInstanced(cyl(0.115, 0.105, 0.016, 12), mat(0xf7f2e4, { rough: 0.45 }), 2, true);
    setInstance(saucers, 0, 0.3, 1.005, 0.24);
    setInstance(saucers, 1, -0.3, 1.005, -0.24);
    flushInstances(saucers);
    g.add(saucers);
    const cups = makeInstanced(cyl(0.062, 0.05, 0.085, 10), mat(0xfbf7ec, { rough: 0.4 }), 2, true);
    setInstance(cups, 0, 0.3, 1.055, 0.24);
    setInstance(cups, 1, -0.3, 1.055, -0.24);
    flushInstances(cups);
    g.add(cups);
  }

  /**
   * SANDALYE — minderli oturak, çıtalı sırt, dışa açılan konik ayak.
   *
   * Eskisi üç yassı plakaydı (minder + arkalık + dört kutu ayak) ve
   * uzaktan "çubuk" gibi okunuyordu. Yeni silüet gerçek bir sandalyenin
   * beş parçasını taşır: minder, minderin altındaki ahşap kasa, iki dikey
   * sırt direği, kavisli üst kayıt ve dışa açılan konik ayaklar. Hepsi
   * instanced — masa başına çizim çağrısı 3'ten 6'ya çıkar, karşılığında
   * mekândaki EN ÇOK TEKRAR EDEN nesne mobilya gibi görünür.
   */
  /**
   * VIP SANDALYE: ALTIN İSKELET DEĞİL ABANOZ İSKELET + PİRİNÇ KOL.
   *
   * Her parçası altın olan bir sandalye pahalı değil TAKLİT okunur —
   * altının değeri az kullanılmasından gelir. Odada zaten altın olan üç
   * şey var: masa kaidesi, halı halkası ve tabela. Sandalye onların
   * arasında koyu bir siluet olarak durursa üçü de öne çıkar; hepsi altın
   * olursa hiçbiri okunmaz. Kadife bordo minder tek renk vurgudur.
   */
  const uphol = vip
    ? mat(0x8d2f45, { rough: 0.72, flatShading: true })
    : mat(mix(p.accent, 0xf6ead6, 0.66), { rough: 0.9, flatShading: true });
  const frameMat = vip ? mat(0x271a16, { rough: 0.45 }) : mat(mix(WOOD, DARK, 0.34), { rough: 0.68 });
  const chairLeg = vip ? mat(0x1f1411, { rough: 0.45 }) : mat(mix(WOOD, DARK, 0.44), { rough: 0.66 });

  // minder (kabarık) + altındaki ahşap kasa
  const pads = makeInstanced(
    vip ? roundBox(0.48, 0.15, 0.46, 0.07) : roundBox(0.44, 0.12, 0.42, 0.055),
    uphol,
    seats,
    true,
  );
  const seatFrames = makeInstanced(roundBox(0.48, 0.06, 0.46, 0.02), frameMat, seats, true);
  // sırt: iki dikey direk + kavisli üst kayıt + minderli panel
  const posts = makeInstanced(cyl(0.028, 0.034, 0.52, 6), frameMat, seats * 2, true);
  const rails = makeInstanced(roundBox(0.42, 0.075, 0.06, 0.028), frameMat, seats, true);
  const backPads = makeInstanced(roundBox(0.34, 0.26, 0.055, 0.025), uphol, seats, true);
  // ayak: aşağı doğru incelen, dışa açılan
  const legs = makeInstanced(cyl(0.022, 0.04, 0.44, 6), chairLeg, seats * 4, true);
  g.add(pads, seatFrames, posts, rails, backPads, legs);
  // Kolçak pirinç kalır: abanoz iskelet üstünde TEK altın vurgu.
  const arms = vip
    ? makeInstanced(roundBox(0.075, 0.16, 0.42, 0.03), mat(GOLD_VIP, { rough: 0.3, metal: 0.7 }), seats * 2, true)
    : null;
  if (arms) g.add(arms);

  for (let i = 0; i < seats; i++) {
    const a = aBase + (i / seats) * TAU;
    const sa = Math.sin(a);
    const ca = Math.cos(a);
    const ry = a + Math.PI; // sandalye masaya bakar
    /** Sandalye yerel (lx=yana, lz=dışa) → istasyon uzayı. */
    const px = (lx: number, lz: number): number => sa * (SEAT_R + lz) - ca * lx;
    const pz = (lx: number, lz: number): number => ca * (SEAT_R + lz) + sa * lx;

    setInstance(seatFrames, i, px(0, 0), 0.42, pz(0, 0), 0, ry, 0);
    setInstance(pads, i, px(0, 0), 0.5, pz(0, 0), 0, ry, 0);

    // sırt: hafif geriye yatık (konfor okuması)
    const lean = 0.12;
    for (let k = 0; k < 2; k++) {
      const lx = k === 0 ? 0.19 : -0.19;
      setInstance(posts, i * 2 + k, px(lx, 0.19), 0.72, pz(lx, 0.19), lean, ry, 0);
    }
    setInstance(rails, i, px(0, 0.24), 0.99, pz(0, 0.24), lean, ry, 0);
    setInstance(backPads, i, px(0, 0.215), 0.82, pz(0, 0.215), lean, ry, 0);

    for (let k = 0; k < 4; k++) {
      const lx = k < 2 ? 0.17 : -0.17;
      const lz = k % 2 === 0 ? 0.16 : -0.16;
      // ayak tabanı dışa açılır: tepe (lx,lz), taban (1.25×lx, 1.25×lz)
      setInstance(legs, i * 4 + k, px(lx, lz), 0.2, pz(lx, lz), lz > 0 ? -0.1 : 0.1, ry, lx > 0 ? 0.1 : -0.1);
    }
    if (arms) {
      for (let k = 0; k < 2; k++) {
        const lx = k === 0 ? 0.26 : -0.26;
        setInstance(arms, i * 2 + k, px(lx, 0.02), 0.66, pz(lx, 0.02), 0, ry, 0);
      }
    }

    // Karakterler bu noktalara oturur — zemin hizası, yüzü masaya dönük.
    const anchor = new VisibilityRoot();
    anchor.name = `seat${i}`;
    anchor.position.set(sa * SEAT_R, 0, ca * SEAT_R);
    anchor.rotation.y = ry;
    g.add(anchor);
  }
  flushInstances(pads);
  flushInstances(seatFrames);
  flushInstances(posts);
  flushInstances(rails);
  flushInstances(backPads);
  flushInstances(legs);
  if (arms) flushInstances(arms);

  /**
   * MASA ÜSTÜ DETAYI — boş tabla "hazırlanmamış masa" gibi durur.
   * Küçük bir seramik vazo + yeşil dal: iki çizim, karşılığında her masa
   * "servise hazır" okunur. VIP'te zaten şamdan var, orada tekrarlanmaz.
   */
  if (!vip) {
    /**
     * Saksı AŞAĞI doğru incelir (tepesi geniş). İlk deneme tersiydi —
     * tabanı geniş, tepesi dar bir koni + üstünde küre: masada saksı
     * değil MANTAR duruyordu. Gerçek saksının silüeti üç şeyle kurulur:
     * yukarı açılan gövde, dışa taşan kenar dudağı ve gövdeden GENİŞ
     * yeşillik. Yaprak da tam küre değil, ezik ve eğik — tam küre
     * daima "top" okunur.
     */
    const vaseY = 0.965 + (sq ? 0.04 : 0.035);
    const px2 = 0.26;
    const pz2 = 0.2;
    /**
     * Saksı KİREMİT rengi. Krem/beyaz denendi ve masada saksı değil KAPAKLI
     * KAHVE BARDAĞI duruyordu: gövde tabladan renk olarak ayrılmıyordu.
     * Mekânın büyük saksıları zaten kiremit; küçük olan da onların ailesinden
     * olunca masa üstü mekânın devamı gibi okunur.
     */
    const clay = mat(mix(p.accent, 0x8a3f1c, 0.42), { rough: 0.72 });
    g.add(detail(cyl(0.062, 0.042, 0.125, 8), clay, px2, vaseY + 0.062, pz2));
    const lip = mat(shade(mix(p.accent, 0x8a3f1c, 0.42), 0.86), { rough: 0.72 });
    g.add(detail(cyl(0.072, 0.072, 0.024, 8), lip, px2, vaseY + 0.124, pz2));
    const leaf = detail(
      sph(0.09, 7, 6),
      mat(mix(p.brand, 0x86c46a, 0.45), { rough: 0.9, flatShading: true }),
      px2,
      vaseY + 0.2,
      pz2,
    );
    leaf.scale.set(1.18, 0.78, 1.02);
    leaf.rotation.set(0.22, 0.7, 0.16);
    g.add(leaf);
  }
  }

  // Balondaki kodla aynı fiziksel masa plakası. Paket mobilya kullanılsa
  // bile dışarıda kurulur; model değişince servis dili kaybolmaz.
  if (def.serviceCode) {
    const codePlate = detail(
      roundBox(0.5, 0.32, 0.12, 0.035),
      mat(def.vip ? 0x8a6722 : 0x1d2b34, { rough: 0.78 }),
      0,
      1.16,
      0.02,
    );
    codePlate.name = 'tableCodeStand';
    codePlate.userData.settledFurniture = true;
    codePlate.scale.set(.64,.64,.64); codePlate.position.set(.25,1.1024,-.21);
    g.add(codePlate);
    const codeText = detail(
      plane(0.4, 0.2),
      sharedLabelMaterial(def.serviceCode, def.vip ? 0x8a6722 : 0x1d2b34, 0xfff1c7, 2),
      0,
      1.16,
      0.081,
    );
    codeText.scale.setScalar(.64); codeText.position.set(.25,1.103,-.17);
    codeText.userData.noTint = true;
    g.add(codeText);
  }

  /* --- kirli parçalar (setOutput) --- */
  const dirt: THREE.Group[] = [makeDirtyCup(), makeNapkin(), makeCrumbPlate(), makeEmptyBottle()];
  for (let i = 0; i < TRASH_MAX; i++) {
    dirt[i].position.set(TRASH_SPOT[i * 2], 1.0, TRASH_SPOT[i * 2 + 1]);
    dirt[i].rotation.y = i * 1.3;
    dirt[i].visible = false;
    g.add(dirt[i]);
  }

  // Yüzey lekesi (dökülen kahve halkaları, sos damlaları, kırıntılar ve mat cila filmi)
  const stainMat = mat(0x382214, { rough: 0.96, transparent: true, opacity: 0 }).clone();
  const grimeFilmMat = mat(0x2d241c, { rough: 0.98, transparent: true, opacity: 0 }).clone();
  const crumbMat = mat(0xb9762f, { rough: 0.95, flatShading: true });

  const tableGrimeDecal = new VisibilityRoot();
  tableGrimeDecal.position.set(0, 1.004, 0);
  tableGrimeDecal.visible = false;
  tableGrimeDecal.userData.noTint = true;
  g.add(tableGrimeDecal);

  // 1. Masa tablasını kaplayan mat grimsi cila filmi (kirliyken cilası matlaşan yüzey)
  const grimeFilm = detail(
    sq ? box(topHalf * 1.84, 0.002, topHalf * 1.84) : cyl(TABLE_R * 0.92, TABLE_R * 0.92, 0.002, 24),
    grimeFilmMat,
    0,
    0.001,
    0,
  );
  tableGrimeDecal.add(grimeFilm);

  // 2. Belirgin kahve halkaları (farklı boyut ve yerleşimde)
  const ringA = detail(torus(0.13, 0.016, 4, 20), stainMat, 0.12, 0.003, -0.09);
  ringA.rotation.x = -Math.PI / 2;
  const ringB = detail(torus(0.095, 0.013, 4, 18), stainMat, -0.14, 0.003, 0.11);
  ringB.rotation.x = -Math.PI / 2;
  const ringC = detail(cyl(0.08, 0.08, 0.002, 14), stainMat, -0.04, 0.002, -0.14);
  tableGrimeDecal.add(ringA, ringB, ringC);

  // 3. Dökülmüş sos/kahve damlaları
  const splatters = makeInstanced(sph(0.024, 5, 4), stainMat, 7);
  setInstance(splatters, 0, 0.22, 0.003, -0.06, 0, 0, 0, 1, 0.2, 1);
  setInstance(splatters, 1, 0.08, 0.003, -0.19, 0, 0, 0, 0.8, 0.2, 0.8);
  setInstance(splatters, 2, -0.08, 0.003, 0.16, 0, 0, 0, 1.2, 0.2, 0.9);
  setInstance(splatters, 3, -0.22, 0.003, 0.05, 0, 0, 0, 0.7, 0.2, 0.7);
  setInstance(splatters, 4, 0.04, 0.003, 0.08, 0, 0, 0, 1.1, 0.2, 1.1);
  setInstance(splatters, 5, -0.14, 0.003, -0.08, 0, 0, 0, 0.85, 0.2, 0.85);
  setInstance(splatters, 6, 0.18, 0.003, 0.14, 0, 0, 0, 0.9, 0.2, 0.9);
  flushInstances(splatters);
  tableGrimeDecal.add(splatters);

  // 4. Dağılmış pasta/ekmek kırıntıları
  const tableCrumbs = makeInstanced(sph(0.016, 5, 4), crumbMat, 8);
  for (let c = 0; c < 8; c++) {
    const a = c * 1.82;
    const rc = 0.08 + (c % 4) * 0.07;
    setInstance(tableCrumbs, c, Math.cos(a) * rc, 0.004, Math.sin(a) * rc, 0, a, 0, 0.8 + (c % 3) * 0.3);
  }
  flushInstances(tableCrumbs);
  tableGrimeDecal.add(tableCrumbs);

  // --- Tamamlanma: tabla boyunca tek, yumuşak ışık geçişi ---
  const gleamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  const gleamMesh = detail(plane(0.16, topHalf * 2.3), gleamMat, 0, 1.015, 0);
  gleamMesh.rotation.x = -Math.PI / 2;
  gleamMesh.rotation.z = Math.PI / 4;
  gleamMesh.visible = false;
  gleamMesh.userData.noTint = true;
  g.add(gleamMesh);

  // Cila parlaması: tabla bir anlığına altın-beyaz yanıp söner (emissive flash)
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xfff0b8,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flashMesh = detail(
    sq ? box(topHalf * 1.92, 0.004, topHalf * 1.92) : cyl(TABLE_R * 0.96, TABLE_R * 0.96, 0.004, 24),
    flashMat,
    0,
    1.012,
    0,
  );
  flashMesh.visible = false;
  flashMesh.userData.noTint = true;
  g.add(flashMesh);

  let gleamT = 0;
  let wipeT = 0;

  // Çok kirli masada dönen minik sinekler (3 mesh, tek paylaşılan materyal)
  const flyMat = mat(0x15110d, { rough: 1 });
  const flies: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const f = detail(sph(0.016, 4, 3), flyMat, 0, 1.3, 0);
    f.visible = false;
    f.userData.noTint = true;
    g.add(f);
    flies.push(f);
  }

  /* --- servis edilmiş takım (setInput → oturan misafir) --- */
  const served = new VisibilityRoot();
  served.name = 'tableServed';
  g.add(served);
  const trays = makeInstanced(cyl(0.14, 0.125, 0.025, 12), mat(0xf7f4ec, { rough: 0.5 }), seats);
  served.add(trays);
  const servedProducts: (THREE.Group | null)[] = Array.from({ length: seats }, () => null);
  const servedItem: (ItemId | null)[] = Array.from({ length: seats }, () => null);
  const snapT = new Float32Array(seats);
  const mealItems: ItemId[] = [];

  /* --- oturan varken ılık ışık havuzu --- */
  const warm = detail(cyl(0.62, 0.62, 0.006, 20), basic(0xffd9a8, 0.14, false), 0, 0.999, 0);
  warm.renderOrder = 1;
  warm.userData.noTint = true;
  warm.visible = false;
  g.add(warm);

  /* --- "temizlik gerekli" göstergesi (uzaktan fark edilen salınan fener) --- */
  const dirtySign = new VisibilityRoot();
  dirtySign.position.set(0, 1.62, 0);
  dirtySign.scale.setScalar(0.78);
  dirtySign.visible = false;
  g.add(dirtySign);
  const pulse = new VisibilityRoot();
  dirtySign.add(pulse);
  const signRingDishes = basic(0xf2a33a, 0.7, false);
  const signRingWipe = basic(0x4aa8d8, 0.7, false);
  const signDiscDishes = basic(0xc9402f, 0.28, false);
  const signDiscWipe = basic(0x2b7fb5, 0.28, false);
  const signRing = detail(torus(0.32, 0.03, 4, 24), signRingDishes);
  signRing.rotation.x = -Math.PI / 2;
  pulse.add(signRing);
  const signBackDisc = detail(cyl(0.3, 0.3, 0.015, 18), signDiscDishes, 0, -0.01, 0);
  pulse.add(signBackDisc);
  const dirtyLabel = facingGroup(def.rot, -0.26);
  dirtyLabel.holder.position.set(0, 0.36, 0);
  dirtySign.add(dirtyLabel.holder);
  const dirtyPlateDishes = detail(plane(0.96, 0.32), sharedLabelMaterial(tr("BULAŞIK"), 0xc9402f, 0xffffff));
  const dirtyPlateWipe = detail(plane(0.92, 0.32), sharedLabelMaterial(tr("TEMİZLE"), 0x2b7fb5, 0xffffff));
  dirtyPlateWipe.visible = false;
  dirtyLabel.face.add(dirtyPlateDishes, dirtyPlateWipe);
  dirtySign.traverse((o) => (o.userData.noTint = true));

  /* --- tabla kenarındaki ince ilerleme yayı --- */
  const arc = makeInstanced(box(0.085, 0.03, 0.05), basic(p.brand, 0.95, true), ARC_SEG);
  arc.userData.noTint = true;
  g.add(arc);

  let dirtyN = 0;
  let soilLevel = 0;
  let guests = 0;
  let arcN = -1;
  let hidden = false;

  function showDirt(): void {
    const isDirty = dirtyN > 0 || soilLevel > 0.02;
    for (let i = 0; i < TRASH_MAX; i++) dirt[i].visible = !hidden && i < dirtyN;
    dirtySign.visible = !hidden && isDirty && guests === 0;
    if (dirtySign.visible) {
      const needDishes = dirtyN > 0;
      dirtyPlateDishes.visible = needDishes;
      dirtyPlateWipe.visible = !needDishes;
      signBackDisc.material = needDishes ? signDiscDishes : signDiscWipe;
      signRing.material = needDishes ? signRingDishes : signRingWipe;
    }
    if (isDirty) {
      tableGrimeDecal.visible = !hidden;
      stainMat.opacity = Math.max(0.28, Math.min(0.6, 0.3 + dirtyN * 0.08 + soilLevel * 0.22));
      grimeFilmMat.opacity = Math.min(0.26, 0.08 + dirtyN * 0.04 + soilLevel * 0.14);
      tableGrimeDecal.scale.setScalar(1);
    } else {
      tableGrimeDecal.visible = false;
      stainMat.opacity = 0;
      grimeFilmMat.opacity = 0;
    }
  }

  function showServed(): void {
    for (let i = 0; i < seats; i++) {
      if (i < guests) {
        // Her dolu sandalyenin önünde siparişin GERÇEK ürünü görünür.
        const a = aBase + (i / seats) * TAU;
        // The round pack has a hexagonal rim; keep every saucer inside it.
        const placeRadius = sq ? 0.55 : 0.45;
        const sa = Math.sin(a) * placeRadius;
        const ca = Math.cos(a) * placeRadius;
        setInstance(trays, i, sa, 1.012, ca, 0, -a, 0);
        const item = mealItems[i];
        if (item && servedItem[i] !== item) {
          if (servedProducts[i]) {
            disposeInstancedIn(servedProducts[i]!);
            servedProducts[i]!.removeFromParent();
          }
          const product = createProductMesh(item);
          markDynamic(product);
          product.name = 'tableMeal:' + item;
          product.scale.setScalar(0.72);
          product.position.set(sa, 1.03, ca);
          product.rotation.y = -a;
          served.add(product);
          servedProducts[i] = product;
          servedItem[i] = item;
          snapT[i] = 0.22;
        }
        if (servedProducts[i]) servedProducts[i]!.visible = true;
      } else {
        hideInstance(trays, i);
        if (servedProducts[i]) servedProducts[i]!.visible = false;
      }
    }
    flushInstances(trays);
    served.visible = !hidden && guests > 0;
  }

  function showArc(pr: number): void {
    const on = pr > 0.001 && pr < 0.999;
    const n = on ? Math.max(1, Math.round(clamp01(pr) * ARC_SEG)) : 0;
    if (n !== arcN) {
      arcN = n;
      for (let j = 0; j < ARC_SEG; j++) {
        if (j < n) {
          const aj = (j / ARC_SEG) * TAU;
          setInstance(arc, j, Math.sin(aj) * 0.7, 1.008, Math.cos(aj) * 0.7, 0, -aj, 0);
        } else {
          hideInstance(arc, j);
        }
      }
      flushInstances(arc);
    }
    arc.visible = !hidden && on && n > 0;
  }

  showServed();
  showArc(0);

  return {
    ownOutput: true,
    ownInput: true,
    ownRing: true,
    onOutput(count, cap, item) {
      dirtyN = clamp(Math.floor(count), 0, TRASH_MAX);
      if (cap !== undefined && item === 'bulasik') {
        soilLevel = clamp01(cap / 100);
      } else if (dirtyN === 0) {
        soilLevel = 0;
      }
      showDirt();
    },
    onInput(counts) {
      mealItems.length = 0;
      for (let i = 0; i < counts.length && mealItems.length < seats; i++) {
        for (let n = 0; n < counts[i].count && mealItems.length < seats; n++) mealItems.push(counts[i].item);
      }
      guests = mealItems.length;
      showServed();
    },
    onProgress(pr) {
      showArc(pr);
      if (pr > 0.001 && pr < 0.999) {
        tableGrimeDecal.visible = !hidden;
        const fade = (1 - pr) * (1 - pr);
        stainMat.opacity = 0.6 * fade;
        grimeFilmMat.opacity = 0.26 * fade;
        tableGrimeDecal.scale.setScalar(1);
      } else if (pr >= 0.999 || (dirtyN <= 0 && soilLevel <= 0.02)) {
        tableGrimeDecal.visible = false;
        stainMat.opacity = 0;
        grimeFilmMat.opacity = 0;
      } else {
        showDirt();
      }
    },
    onWipe() {
      wipeT = 0.14;
    },
    playGleam() {
      gleamT = 0.6;
      gleamMesh.visible = true;
      flashMesh.visible = true;
    },
    onLocked(v) {
      hidden = v;
      showDirt();
      showServed();
      arc.visible = !v && arcN > 0;
      if (v) warm.visible = false;
    },
    tick(dt, t, act) {
      warm.visible = !hidden && act > 0.02;
      if (warm.visible) {
        const s = 0.75 + act * 0.35;
        warm.scale.set(s, 1, s);
      }
      served.position.y = Math.sin(t * 2.1) * 0.013 * act;
      // Masaya servis edilen ürünün iniş ve elastik yaylanması (snap)
      for (let i = 0; i < seats; i++) {
        if (snapT[i] > 0 && servedProducts[i]) {
          snapT[i] = Math.max(0, snapT[i] - dt);
          const prog = 1 - snapT[i] / 0.22;
          const bounce = Math.sin(prog * Math.PI) * 0.16 * (1 - prog);
          const sy = 0.72 * (1 - bounce * 1.6);
          const sxz = 0.72 * (1 + bounce);
          servedProducts[i]!.scale.set(sxz, sy, sxz);
          servedProducts[i]!.position.y = 1.03 + Math.max(0, (1 - prog) * (1 - prog) * 0.24);
        }
      }
      if (gleamT > 0) {
        gleamT = Math.max(0, gleamT - dt);
        const prog = 1 - gleamT / 0.6;
        const e = prog * prog * (3 - 2 * prog);
        const sweepRange = TABLE_R * 1.3;
        gleamMesh.position.x = lerp(-sweepRange, sweepRange, e);
        gleamMesh.position.z = lerp(-sweepRange * 0.4, sweepRange * 0.4, e);
        gleamMat.opacity = Math.sin(prog * Math.PI) * 0.9;
        flashMat.opacity = Math.max(0, 1 - prog * 2.2) * 0.55;
        if (gleamT <= 0) {
          gleamMesh.visible = false;
          flashMesh.visible = false;
        }
      }
      if (wipeT > 0) {
        wipeT = Math.max(0, wipeT - dt);
        const k = Math.sin((wipeT / 0.14) * Math.PI);
        tableGrimeDecal.scale.set(1 - k * 0.025, 1, 1 - k * 0.025);
      }
      if (dirtySign.visible) {
        dirtySign.position.y = 1.62 + Math.sin(t * 2.2) * 0.04;
      }
      const buzz = !hidden && guests === 0 && (dirtyN >= 3 || (dirtyN > 0 && soilLevel > 0.6));
      for (let i = 0; i < flies.length; i++) {
        const f = flies[i];
        if (f.visible !== buzz) f.visible = buzz;
        if (!buzz) continue;
        const a = t * (3.1 + i * 0.9) + i * 2.1;
        const r = 0.22 + 0.1 * Math.sin(t * 1.7 + i);
        f.position.set(Math.cos(a) * r, 1.28 + Math.sin(t * 5 + i * 1.7) * 0.05, Math.sin(a * 1.3) * r);
      }
    },
    dispose() {
      stainMat.dispose();
      grimeFilmMat.dispose();
      gleamMat.dispose();
      flashMat.dispose();
    },
  };
};

/* ---------------- çöp kovası ---------------- */

/** Kapasite bildirilmediğinde kovanın "dolu" göründüğü adet. */
const BIN_FULL = 8;

const buildBin: Builder = (g, p) => {
  const shell = mix(METAL, DARK, 0.45);
  const shellMat = mat(shell, { rough: 0.5, metal: 0.25 });
  g.add(mesh(cyl(0.42, 0.36, 0.92, 14), shellMat, 0, 0.48, 0));

  // marka bandı + üçgen geri dönüşüm işareti
  g.add(detail(cyl(0.435, 0.43, 0.17, 14), mat(p.brand, { rough: 0.72 }), 0, 0.62, 0));
  const markMesh = detail(torus(0.085, 0.02, 3, 3), mat(mix(p.brand, 0xffffff, 0.78), { rough: 0.6 }), 0, 0.62, 0.44);
  g.add(markMesh);

  // ön yüzdeki doluluk yuvası
  g.add(detail(box(0.1, 0.52, 0.03), mat(DARK, { rough: 0.9 }), 0, 0.5, 0.4));
  const gauge = detail(box(0.07, 0.46, 0.02), mat(0xffc84a, { rough: 0.6 }), 0, 0.27, 0.42);
  g.add(gauge);

  // içeride yükselen çöp yığını
  const mound = detail(sph(0.33, 10, 7), mat(shade(ITEMS.bulasik.color, 0.9), { rough: 0.95, flatShading: true }), 0, 0.3, 0);
  mound.scale.set(1, 0.5, 1);
  mound.visible = false;
  g.add(mound);

  // ayak pedalı + mil
  g.add(detail(box(0.32, 0.05, 0.14), mat(DARK, { rough: 0.6, metal: 0.3 }), 0, 0.07, 0.44));
  g.add(detail(cyl(0.025, 0.025, 0.52, 5), mat(METAL, { rough: 0.4, metal: 0.5 }), 0.3, 0.3, 0.4));

  // kapak: menteşe arkada
  const lid = new VisibilityRoot();
  lid.position.set(0, 0.95, -0.4);
  g.add(lid);
  const lidMat = mat(shade(shell, 0.86), { rough: 0.45, metal: 0.3 });
  lid.add(mesh(cyl(0.45, 0.43, 0.08, 14), lidMat, 0, 0.03, 0.4));
  const dome = detail(sph(0.43, 12, 7), lidMat, 0, 0.05, 0.4);
  dome.scale.set(1, 0.34, 1);
  lid.add(dome);
  lid.add(detail(box(0.36, 0.02, 0.3), mat(0x141c21, { rough: 1 }), 0, 0.15, 0.4));
  const flapPivot = new VisibilityRoot();
  flapPivot.position.set(0, 0.16, 0.26);
  lid.add(flapPivot);
  flapPivot.add(detail(box(0.34, 0.025, 0.28), mat(shade(shell, 0.72), { rough: 0.5 }), 0, 0, 0.15));

  // taşan torbalar
  const bags = makeInstanced(sph(0.16, 8, 6), mat(ITEMS.bulasik.color, { rough: 0.9, flatShading: true }), 3);
  g.add(bags);

  let outN = 0;
  let inN = 0;
  let fill = -1;

  function apply(): void {
    const n = Math.max(outN, inN);
    const f = clamp01(n / BIN_FULL);
    if (f === fill) return;
    fill = f;
    gauge.scale.y = Math.max(0.001, f);
    gauge.position.y = 0.27 + 0.23 * f;
    gauge.visible = f > 0.01;
    mound.visible = f > 0.02;
    mound.position.y = 0.3 + f * 0.6;
    lid.rotation.x = f > 0.6 ? -(f - 0.6) * 1.0 : 0;
    const bn = f > 0.9 ? 3 : f > 0.8 ? 2 : f > 0.7 ? 1 : 0;
    for (let i = 0; i < 3; i++) {
      if (i < bn) setInstance(bags, i, (i - 1) * 0.19, 1.02 + (i % 2) * 0.1, 0.1 - (i % 2) * 0.16, 0, i * 1.1, 0.2, 0.9);
      else hideInstance(bags, i);
    }
    flushInstances(bags);
    bags.visible = bn > 0;
  }
  apply();

  return {
    ownOutput: true,
    ownInput: true,
    onOutput(count, cap) {
      // Kova kapasitesi çoğu zaman "sınırsız" (999) — o hâlde görsel eşiği kullan.
      outN = cap > 0 && cap <= 24 ? (count / cap) * BIN_FULL : count;
      apply();
    },
    onInput(counts) {
      let n = 0;
      for (let i = 0; i < counts.length; i++) n += counts[i].count;
      inN = n;
      apply();
    },
    tick(dt, t, act) {
      const jig = Math.sin(t * 9.5) * 0.035 * act;
      lid.rotation.z = jig;
      lid.position.y = 0.95 + Math.abs(jig) * 0.14;
      flapPivot.rotation.x = -0.3 * act * (0.5 + 0.5 * Math.sin(t * 6.4));
    },
  };
};

/* ---------------- tuvalet ---------------- */

const SOIL_STEPS = 4;
const SOIL_COLOR: number[] = [0xb9cf8f, 0xd8bf6a, 0xa98146, 0x76563a];
const SPECK_MAX = 6;

/** Kir kademesine göre önbellekli zemin lekesi malzemesi (en fazla 4 adet). */
function soilMat(step: number): THREE.MeshStandardMaterial {
  return mat(SOIL_COLOR[step], { rough: 1, transparent: true, opacity: 0.34 + step * 0.16 });
}

let toiletTileMat: THREE.MeshStandardMaterial | null = null;
/** Kabin karosu tek yüzey: derz dokunun içinde, ayrı mesh yok. */
function toiletTileMaterial(): THREE.MeshStandardMaterial {
  if (toiletTileMat) return toiletTileMat;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#cfc6b4';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#f3eee4';
    const gap = 14;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      ctx.fillRect(gap / 2 + x * 128, gap / 2 + y * 128, 128 - gap, 128 - gap);
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  toiletTileMat = new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 });
  return toiletTileMat;
}

const buildToilet: Builder = (g, p, def) => {
  g.name = 'premiumRestroom_' + def.id;
  const tile = mat(0xe8e3d6, { rough: 0.3 });
  const porcelain = mat(0xfffcf4, { rough: 0.19 });
  const steel = mat(0xba9958, { rough: 0.26, metal: 0.72 });
  const green = mat(0x234d43, { rough: 0.48 });
  const walnut = premiumWoodMaterial();
  const dark = mat(0x253b34, { rough: .66 });
  const light = mat(0xffe6ad, { rough: .3, emissive: 0xffdf95, emissiveIntensity: .55 });
  const add = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) => {
    const part = detail(box(w, h, d), material, x, y, z); g.add(part); return part;
  };

  /* --- zemin karosu + derz ---
   * Karo dış yüzü söveyle aynı düzlemdeydi, altı da oda parkesiyle
   * (istasyon yerel y 0,03) çakışıyordu: kenar kahverengi/krem titriyordu.
   * Karo sövenin içine gömülür, altı parkenin 2 cm üstünde kalır.
   */
  // Derz ayrı bir şerit değil, karonun kendi dokusu. İkinci yüzey
  // karo üstünde titriyordu.
  const floor = detail(box(2.6, 0.06, 2.74), toiletTileMaterial(), 0, 0.08, 0.03);
  floor.receiveShadow = true;
  g.add(floor);

  // kir katmanı: kademeye göre malzeme değişir, bu yüzden tint dışında
  const grime = detail(box(2.4, 0.006, 2.48), soilMat(0), 0, 0.132, 0.03);
  grime.userData.noTint = true;
  grime.visible = false;
  g.add(grime);

  /* --- kabin: arka duvar + yan panel (ön açık) ---
   * Taban y 0,05: oda parkesi (yerel 0,03) paneli ortadan kesmesin.
   */
  add(2.72, 2.4, .12, green, 0, 1.25, -1.34);
  add(.12, 0.95, 2.8, walnut, -1.3, 0.525, 0);
  add(.12, 0.77, 2.8, walnut, 1.3, 0.435, 0);
  add(2.65, .045, .14, steel, 0, 1.08, -1.27);
  add(2.72, .07, .16, steel, 0, 2.46, -1.34);
  add(.15, .035, 2.8, steel, -1.3, 1.015, 0);
  add(.15, .035, 2.8, steel, 1.3, .835, 0);
  add(2.55, .09, .07, dark, 0, .19, -1.25);
  for (let i = 0; i < 12; i++) add(.035, .86, .027, steel, -1.16 + i * .21, .61, -1.266);
  add(2.48, .025, .05, light, 0, 2.33, -1.255);

  /* --- klozet --- */
  const seat = TOILET_LAYOUT.seat;
  g.add(detail(roundBox(.56, .72, .24, .06), porcelain, seat.x, .78, -.91));
  g.add(detail(cyl(.22, .27, .35, 18), porcelain, seat.x, .29, seat.z));
  const bowl = detail(sph(.34, 20, 12), porcelain, seat.x, .49, seat.z);
  bowl.scale.set(1, .58, 1.2); g.add(bowl);
  const bowlWater = detail(cyl(.22, .22, .012, 20), mat(0xa6ccc5, { rough: .22 }), seat.x, .621, seat.z);
  bowlWater.scale.z = 1.23; g.add(bowlWater);
  const seatRing = detail(torus(.278, .037, 8, 24), porcelain, seat.x, seat.y - .037, seat.z);
  seatRing.name = 'toiletSeatSurface';
  seatRing.userData.seatHeight = seat.y;
  seatRing.scale.y = 1.23;
  seatRing.rotation.x = -Math.PI / 2;
  g.add(seatRing);
  add(.24, .125, .035, steel, seat.x, 1.25, -1.257);
  for (const xx of [-.055, .055]) add(.072, .075, .014, porcelain, seat.x + xx, 1.25, -1.231);
  const lid = detail(roundBox(.57, .59, .045, .12, 3), porcelain, seat.x, .93, -.73);
  lid.rotation.x = -.08; g.add(lid);

  /* --- lavabo + ayna --- */
  add(.92, .52, .68, walnut, .67, .64, -.88);
  add(.94, .085, .72, tile, .67, .945, -.88);
  for (const xx of [.28, .47, .66, .85, 1.04]) add(.018, .45, .027, steel, xx, .63, -.528);
  add(.2, .022, .04, steel, .67, .75, -.505);
  add(.81, .026, .045, light, .67, .37, -.57);
  const sink = detail(torus(.225, .053, 8, 24), porcelain, .67, 1.025, -.82);
  sink.rotation.x = -Math.PI / 2; sink.scale.set(1.35, .85, 1); g.add(sink);
  const sinkInside = detail(cyl(.217, .19, .03, 20), mat(0xd2e0d8, { rough: .2 }), .67, 1.005, -.82);
  sinkInside.scale.set(1.33, 1, .84); g.add(sinkInside);
  g.add(detail(cyl(.027, .027, .3, 10), steel, .67, 1.15, -1.08));
  const spout = detail(cyl(.026, .026, .23, 10), steel, .67, 1.29, -.976);
  spout.rotation.x = Math.PI / 2;
  g.add(spout);
  g.add(detail(roundBox(.9, 1.02, .045, .16, 3), light, .67, 1.8, -1.255));
  g.add(detail(roundBox(.84, .96, .045, .14, 3), steel, .67, 1.8, -1.222));
  g.add(detail(roundBox(.77, .89, .025, .12, 3), mat(0xb4d0c8, { rough: .1, metal: .65 }), .67, 1.8, -1.191));
  add(.085, .15, .09, mat(0xc49554, { rough: .27 }), 1.04, 1.06, -.83);
  add(.065, .035, .06, steel, 1.04, 1.155, -.83);

  /* --- dışarıdaki WC levhası --- */
  const wcSign = detail(plane(0.5, 0.24), sharedLabelMaterial('WC', DARK, 0xffffff, 0.5 / 0.24));
  wcSign.userData.noTint = true;
  wcSign.position.set(-1.29, 1.18, 1.405);
  g.add(wcSign);

  /* --- DOLU / BOŞ göstergesi --- */
  const occ = facingGroup(def.rot, -0.28);
  occ.holder.position.set(-.48, 1.95, -1.20);
  g.add(occ.holder);
  const busyPlate = detail(plane(0.9, 0.32), sharedLabelMaterial(tr("DOLU"), 0xd23b2e));
  const freePlate = detail(plane(0.9, 0.32), sharedLabelMaterial(tr("BOŞ"), 0x4fb59a));
  busyPlate.userData.noTint = true;
  freePlate.userData.noTint = true;
  busyPlate.visible = false;
  occ.face.add(busyPlate, freePlate);
  const feeLabel = makeLabelPlate('', 1.02, .27, 0x234d43, 0xffe9b5);
  feeLabel.mesh.position.set(0, -.35, .01); occ.face.add(feeLabel.mesh);

  /* --- SARF MALZEMESİ: peçete kutusu + tuvalet kâğıdı --- *
   *
   * Kafenin en sinsi cezası burada görünür olur: kutu boşaldığında kapağı
   * açılır, kâğıtlık boş kalır ve kırmızı bir uyarı yanar. Oyuncu tuvalete
   * girmeden, salondan bakarak "peçete bitmiş" diyebilmeli.                */
  const napHolder = detail(roundBox(0.28, 0.22, 0.16, 0.03), steel, 1.06, 1.23, -.83);
  g.add(napHolder);
  const napPaper = detail(box(0.22, 0.16, 0.02), mat(0xfdfbf5, { rough: 0.97 }), 1.06, 1.21, -.74);
  g.add(napPaper);
  const napFlap = detail(box(0.26, 0.02, 0.14), steel, 1.06, 1.35, -.80);
  g.add(napFlap);

  const rollBar = detail(cyl(0.02, 0.02, 0.26, 6), steel, -0.92, 0.72, -0.42);
  rollBar.rotation.z = Math.PI / 2;
  g.add(rollBar);
  const rolls = makeInstanced(cyl(0.13, 0.13, 0.22, 12), mat(0xffffff, { rough: 0.96 }), 2);
  const rollCores = makeInstanced(cyl(0.05, 0.05, 0.24, 8), mat(0xd0d7db, { rough: 0.9 }), 2);
  g.add(rolls, rollCores);

  const supplyWarn = facingGroup(def.rot, -0.26);
  supplyWarn.holder.position.set(0, 2.15, 0.2);
  g.add(supplyWarn.holder);
  const emptyPlate = detail(plane(1.25, 0.32), sharedLabelMaterial(tr("SARF BİTTİ"), 0xd23b2e, 0xffffff, 1.25 / 0.32));
  emptyPlate.userData.noTint = true;
  emptyPlate.visible = false;
  supplyWarn.face.add(emptyPlate);

  /* --- koku + kir lekeleri --- */
  const stink = makePlume(4, 0x9ab24a, 0.14, 0.4);
  g.add(stink.im);
  const specks = makeInstanced(sph(0.06, 6, 5), mat(0x6b5a3a, { rough: 1, flatShading: true }), SPECK_MAX);
  g.add(specks);

  let soil = 0;
  let step = -1;
  let speckN = -1;
  let busy = false;
  let hidden = false;
  let napRatio = 1;
  let rollRatio = 1;
  let anyEmpty = false;

  function applySupplies(): void {
    // peçete: doluluk kâğıdın kalınlığı, boşsa kapak açık kalır
    napPaper.scale.set(1, Math.max(0.08, napRatio), 1);
    napPaper.position.y = 1.21 - (1 - napRatio) * 0.06;
    napPaper.visible = !hidden && napRatio > 0.02;
    napFlap.rotation.x = napRatio < 0.02 ? -0.9 : 0;

    // kâğıt: iki rulodan doluluğa göre 0/1/2 tanesi durur
    const n = rollRatio < 0.02 ? 0 : rollRatio < 0.55 ? 1 : 2;
    for (let i = 0; i < 2; i++) {
      if (i < n) {
        const r = i === 0 ? 1 : 0.72;
        setInstance(rolls, i, -0.92, 0.72 - i * 0.34, -0.42, 0, 0, Math.PI / 2, r, 1, r);
        setInstance(rollCores, i, -0.92, 0.72 - i * 0.34, -0.42, 0, 0, Math.PI / 2);
      } else {
        hideInstance(rolls, i);
        hideInstance(rollCores, i);
      }
    }
    flushInstances(rolls);
    flushInstances(rollCores);
    rolls.visible = !hidden && n > 0;
    rollCores.visible = !hidden && n > 0;

    anyEmpty = napRatio < 0.02 || rollRatio < 0.02;
    emptyPlate.visible = !hidden && anyEmpty;
  }

  function applySoil(): void {
    const s = soil < 0.06 ? -1 : Math.min(SOIL_STEPS - 1, Math.floor(soil * SOIL_STEPS));
    if (s !== step) {
      step = s;
      if (s >= 0) grime.material = soilMat(s);
    }
    grime.visible = !hidden && step >= 0;

    const n = Math.round(soil * SPECK_MAX);
    if (n !== speckN) {
      speckN = n;
      for (let i = 0; i < SPECK_MAX; i++) {
        if (i < n) {
          const a = i * 2.4;
          setInstance(specks, i, Math.cos(a) * (0.3 + (i % 3) * 0.24), 0.15, 0.05 + Math.sin(a) * (0.28 + (i % 2) * 0.3), 0, a, 0, 0.7 + (i % 3) * 0.3, 0.32, 0.7 + (i % 2) * 0.3);
        } else {
          hideInstance(specks, i);
        }
      }
      flushInstances(specks);
    }
    specks.visible = !hidden && n > 0;
  }
  applySoil();
  applySupplies();
  batchStationFurniture(g, [grime, occ.holder, napPaper, napFlap, rolls, rollCores, supplyWarn.holder, stink.im, specks]);

  return {
    ownRing: true,
    ownOutput: true,
    ownInput: true,
    onOutput(fee) { feeLabel.setText(fee > 0 ? '₺' + fee : tr('BAKIM GEREKLİ')); },
    dispose() { feeLabel.dispose(); },
    onProgress(pr) {
      soil = clamp01(pr);
      applySoil();
    },
    /** counts[0] = peçete, counts[1] = kâğıt (World bu sırayla yollar). */
    onInput(counts) {
      const nap = counts.find((c) => c.item === 'pecete');
      const roll = counts.find((c) => c.item === 'kagit');
      napRatio = nap && nap.cap > 0 ? clamp01(nap.count / nap.cap) : 1;
      rollRatio = roll && roll.cap > 0 ? clamp01(roll.count / roll.cap) : 1;
      applySupplies();
    },
    onLocked(v) {
      hidden = v;
      occ.holder.visible = !v;
      supplyWarn.holder.visible = !v;
      applySoil();
      applySupplies();
    },
    tick(dt, t, act) {
      const nowBusy = act > 0.5;
      if (nowBusy !== busy) {
        busy = nowBusy;
        busyPlate.visible = nowBusy;
        freePlate.visible = !nowBusy;
      }
      occ.holder.position.y = 1.95;
      if (anyEmpty && !hidden) {
        supplyWarn.holder.position.y = 2.15 + Math.sin(t * 3.4) * 0.07;
        const s = 1 + Math.sin(t * 4.6) * 0.08;
        emptyPlate.scale.set(s, s, 1);
      }
      stink.tick(t, hidden ? 0 : clamp01((soil - 0.22) * 1.5), -0.45, 0.75, -0.42, 1.5, 0.26);
    },
  };
};

/* ---------------- tatlı tezgâhı ---------------- */

const buildDessert: Builder = (g, p) => {
  g.add(mesh(box(1.95, 0.86, 1.0), mat(mix(WOOD, DARK, 0.28), { rough: 0.88 }), 0, 0.43, 0));
  g.add(mesh(box(2.05, 0.12, 1.1), mat(mix(p.wall, 0xffffff, 0.62), { rough: 0.26 }), 0, 0.92, 0));
  g.add(detail(box(1.9, 0.14, 0.04), mat(p.brand, { rough: 0.75 }), 0, 0.22, 0.52));

  // mermer damarları
  const veins = makeInstanced(box(0.52, 0.02, 0.03), mat(0xc6c0b4, { rough: 0.25 }), 3);
  setInstance(veins, 0, -0.5, 0.985, 0.2, 0, 0.4, 0);
  setInstance(veins, 1, 0.35, 0.985, -0.15, 0, -0.7, 0);
  setInstance(veins, 2, 0.72, 0.985, 0.3, 0, 0.9, 0, 0.6);
  flushInstances(veins);
  g.add(veins);

  /* --- camlı vitrin --- */
  const vitrin = new VisibilityRoot();
  vitrin.position.set(-0.48, 0.98, 0);
  g.add(vitrin);
  const shelves = makeInstanced(box(0.94, 0.03, 0.56), mat(mix(p.wall, 0xffffff, 0.45), { rough: 0.3 }), 2);
  setInstance(shelves, 0, 0, 0.06, 0);
  setInstance(shelves, 1, 0, 0.36, 0);
  flushInstances(shelves);
  vitrin.add(shelves);

  // v5: 'cheesecake' menüden silindi; vitrin süsünün tonları sabitlendi
  // (eski ITEMS.cheesecake.color / .accent).
  const cakes = makeInstanced(cyl(0.1, 0.1, 0.1, 3), mat(0xfbe7d2, { rough: 0.75, flatShading: true }), 6);
  const berries = makeInstanced(sph(0.032, 6, 5), mat(0xd8567a, { rough: 0.6 }), 6);
  for (let i = 0; i < 6; i++) {
    const x = -0.3 + (i % 3) * 0.3;
    const y = i < 3 ? 0.125 : 0.425;
    setInstance(cakes, i, x, y, 0, 0, i * 0.7, 0);
    setInstance(berries, i, x, y + 0.08, -0.03);
  }
  flushInstances(cakes);
  flushInstances(berries);
  vitrin.add(cakes, berries);

  const posts = makeInstanced(box(0.04, 0.66, 0.04), mat(shade(METAL, 0.9), { rough: 0.35, metal: 0.5 }), 4);
  for (let i = 0; i < 4; i++) setInstance(posts, i, i < 2 ? 0.49 : -0.49, 0.33, i % 2 === 0 ? 0.3 : -0.3);
  flushInstances(posts);
  vitrin.add(posts);

  const glass = detail(box(1.0, 0.66, 0.62), mat(0xdff0ea, { rough: 0.08, transparent: true, opacity: 0.22 }), 0, 0.33, 0);
  glass.renderOrder = 2;
  vitrin.add(glass);

  /* --- mikser --- */
  const steel = mat(METAL, { rough: 0.24, metal: 0.62 });
  g.add(detail(roundBox(0.3, 0.1, 0.34, 0.04), steel, 0.68, 1.03, -0.14));
  g.add(detail(roundBox(0.18, 0.52, 0.22, 0.05), steel, 0.82, 1.32, -0.2));
  g.add(detail(roundBox(0.5, 0.17, 0.2, 0.06), steel, 0.62, 1.6, -0.18));
  g.add(detail(cyl(0.2, 0.13, 0.24, 12), mat(shade(METAL, 1.06), { rough: 0.18, metal: 0.72 }), 0.55, 1.2, -0.16));

  const whisk = new VisibilityRoot();
  whisk.position.set(0.55, 1.42, -0.16);
  g.add(whisk);
  whisk.add(detail(cyl(0.025, 0.025, 0.3, 5), steel, 0, 0, 0));
  const wires = makeInstanced(cyl(0.012, 0.012, 0.24, 4), steel, 4);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    setInstance(wires, i, Math.cos(a) * 0.055, -0.22, Math.sin(a) * 0.055, Math.sin(a) * 0.24, 0, -Math.cos(a) * 0.24);
  }
  flushInstances(wires);
  whisk.add(wires);

  /* --- sıkma torbası --- */
  const pipe = new VisibilityRoot();
  pipe.position.set(0.06, 1.14, 0.34);
  pipe.rotation.set(-0.3, 0, 0.55);
  g.add(pipe);
  const pipeBody = detail(cone(0.12, 0.32, 8), mat(0xf0e6d6, { rough: 0.82 }), 0, 0.14, 0);
  pipeBody.rotation.x = Math.PI;
  pipe.add(pipeBody);
  const pipeTip = detail(cone(0.05, 0.12, 6), steel, 0, -0.08, 0);
  pipeTip.rotation.x = Math.PI;
  pipe.add(pipeTip);
  pipe.add(detail(sph(0.045, 7, 6), mat(0xd8567a, { rough: 0.6 }), 0, -0.17, 0));

  return {
    tick(dt, t, act) {
      whisk.rotation.y += dt * (0.4 + act * 9);
      whisk.position.y = 1.42 - act * 0.03 * (0.5 + 0.5 * Math.sin(t * 5.2));
    },
  };
};

/* ---------------- vitrin (yedek gövde) ---------------- *
 * Vitrinler normalde DisplayView tarafından kurulur; bu gövde yalnızca
 * BUILDERS haritasının eksiksiz olması ve olası bir geri düşüş için var. */

/* ---------------- waffle makinesi ---------------- */

const buildWaffleMaker: Builder = (g, p) => {
  const topY = counterBase(g, 1.7, 0.95, 0.88, 0.3);
  const shell = mat(mix(p.accent, DARK, 0.3), { rough: 0.32, metal: 0.4 });
  const chrome = mat(CHROME, { rough: 0.2, metal: 0.75 });

  // alt plaka
  g.add(detail(cyl(0.34, 0.36, 0.14, 14), shell, -0.1, topY + 0.07, 0));
  const grid = detail(cyl(0.29, 0.29, 0.03, 14), mat(0x3a2a1c, { rough: 0.9, flatShading: true }), -0.1, topY + 0.15, 0);
  g.add(grid);
  // pişen waffle
  const dough = detail(cyl(0.25, 0.25, 0.05, 12), mat(ITEMS.waffle.color, { rough: 0.85, flatShading: true }), -0.1, topY + 0.17, 0);
  g.add(dough);

  // menteşeli üst kapak
  const lid = new VisibilityRoot();
  lid.position.set(-0.1, topY + 0.16, -0.36);
  g.add(lid);
  lid.add(detail(cyl(0.34, 0.34, 0.13, 14), shell, 0, 0.02, 0.36));
  lid.add(detail(cyl(0.09, 0.09, 0.06, 10), chrome, 0, 0.1, 0.72));
  lid.add(detail(box(0.22, 0.05, 0.05), mat(0x2b2018, { rough: 0.85 }), 0, 0.12, 0.78));

  // sıcaklık kadranı + hazır ışığı
  const dial = detail(cyl(0.09, 0.09, 0.04, 12), chrome, 0.55, topY + 0.06, 0.2);
  dial.rotation.x = Math.PI / 2;
  g.add(dial);
  const led = detail(sph(0.035, 7, 6), mat(0xff8a3c, { emissive: 0xff5e14, emissiveIntensity: 1.5, rough: 0.4 }), 0.55, topY + 0.06, -0.1);
  g.add(led);

  // servis tabağı + şurup
  g.add(detail(cyl(0.17, 0.15, 0.025, 12), mat(0xfbf7ef, { rough: 0.35 }), 0.62, topY + 0.02, -0.02));
  g.add(detail(cyl(0.06, 0.07, 0.16, 8), mat(mix(ITEMS.waffle.accent, 0xffffff, 0.2), { rough: 0.4 }), 0.62, topY + 0.1, 0.3));

  const steam = makePlume(4, 0xf2f6f8, 0.09, 0.4);
  g.add(steam.im);

  return {
    tick(dt, t, act) {
      void dt;
      const open = (Math.sin(t * 1.5) * 0.5 + 0.5) * act;
      lid.rotation.x = -1.25 * open;
      const s = 1 + Math.sin(t * 6) * 0.2 * act;
      led.scale.setScalar(s);
      dough.scale.set(1, 1 + Math.sin(t * 3) * 0.12 * act, 1);
      steam.tick(t * 1.6, act * open, -0.1, topY + 0.32, 0.1, 0.6, 0.22);
    },
  };
};

const buildDisplayBody: Builder = (g, p) => {
  g.add(mesh(box(2.4, 0.9, 0.9), mat(mix(WOOD, DARK, 0.35), { rough: 0.88 }), 0, 0.45, 0));
  g.add(mesh(box(2.55, 0.1, 1.0), mat(STONE, { rough: 0.4 }), 0, 0.95, 0));
  g.add(detail(box(2.3, 0.7, 0.8), mat(0xeef4f6, { rough: 0.08, transparent: true, opacity: 0.28 }), 0, 1.35, 0));
  g.add(detail(box(2.35, 0.05, 0.85), mat(p.brand, { rough: 0.7 }), 0, 1.72, 0));
  return {};
};

/* ---------------- sipariş tezgâhı ---------------- *
 *
 * Barın müşteriye bakan yüzü. Üç iş yapar:
 *  1. POS terminali ve kart okuyucu — siparişin alındığı yer,
 *  2. bahşiş kavanozu ve pastane standı — barın "sıcak" detayları,
 *  3. tepede asılı tabela — sıradaki müşteri nereye bakacağını bilir.
 * Nakit yığını genel `setOutput` tarafından ön tarafa konur.               */

const buildCounter: Builder = (g) => {
  const shell = new VisibilityRoot(); shell.name = 'premiumCounter'; g.add(shell);
  addPremiumCounter(shell); batchPremium(shell);
  const cash = new VisibilityRoot(); cash.name = 'premiumCash'; cash.visible = false; g.add(cash);
  const notes = makeInstanced(roundBox(.3,.08,.17,.015), mat(0x51ae72, {rough:.68}), 6);
  const bands = makeInstanced(roundBox(.09,.084,.174,.005), mat(PREMIUM.cream, {rough:.68}), 6);
  cash.add(notes, bands);
  for (let n=0;n<6;n++) for (const part of [notes,bands])
    setInstance(part,n,.25+n%2*.36,1.055+Math.floor(n/2)*.09,.12);
  flushInstances(notes,0); flushInstances(bands,0);
  let shown = -1;
  return {ownOutput:true, onOutput(count) {
    cash.visible = count > 0;
    const next = count > 0 ? Math.min(6, Math.max(1, Math.ceil(count))) : 0;
    if (next === shown) return;
    shown = next;
    flushInstances(notes,next); flushInstances(bands,next);
  }};
};

const buildPremiumMachine: Builder = (g, p, def) => {
  const shell = new VisibilityRoot(); shell.name = 'premiumMachine'; g.add(shell);
  addPremiumMachine(shell, def.item!); batchPremium(shell);
  const output = new VisibilityRoot(); output.name = 'premiumMachineOutput'; g.add(output);
  let instances = createPackProductInstanced(def.item!,3);
  if (instances && (Array.isArray(instances.material) ? instances.material : [instances.material])
      .some(material=>material.transparent || !material.depthWrite || material.blending!==THREE.NormalBlending)) {
    // Transparent objects need their original per-product depth sorting.
    instances.dispose(); instances=null;
  }
  if (instances) {
    const scale = .65 * Number(instances.userData.packScale);
    for(let i=0;i<3;i++)setInstance(instances,i,-.68,1.025,-.27+i*.27,0,0,0,scale);
    flushInstances(instances,0); output.add(instances);
    let shown = -1;
    return {ownOutput:true, onOutput(count) {
      const next = Math.min(3, Math.max(0, Math.ceil(count)));
      output.visible = next>0;
      if(next!==shown){shown=next;flushInstances(instances,next);}
    }};
  }
  const products = Array.from({length:3}, (_, i) => {
    const product = createProductMesh(def.item!);
    product.scale.setScalar(.65); product.position.set(-.68,1.025,-.27+i*.27);
    output.add(product); product.visible=false; return product;
  });
  return {ownOutput:true, onOutput(count) {
    output.visible = count>0;
    products.forEach((product,i)=>product.visible=i<count);
  }};
};

const buildPremiumBin: Builder = (g) => {
  const shell = new VisibilityRoot(); shell.name='premiumBin'; g.add(shell);
  addPremiumBin(shell); batchPremium(shell);
  const dishes = createProductMesh('bulasik'); dishes.position.set(0,.84,0); dishes.scale.setScalar(.65); g.add(dishes);
  let out=0,input=0;
  const refresh=()=>{dishes.visible=Math.max(out,input)>0;}; refresh();
  return {ownOutput:true,ownInput:true,onOutput(n){out=n;refresh();},onInput(counts){input=counts.reduce((n,c)=>n+c.count,0);refresh();}};
};

function addSeatAnchors(g: THREE.Group, seats: number, sq: boolean): void {
  const aBase = seatAngle(sq ? 'tablesq' : 'table',seats,0);
  for (let i = 0; i < seats; i++) {
    const a = aBase + (i / seats) * TAU;
    const sa = Math.sin(a);
    const ca = Math.cos(a);
    const anchor = new VisibilityRoot();
    anchor.name = `seat${i}`;
    anchor.position.set(sa * SEAT_R, 0, ca * SEAT_R);
    anchor.rotation.y = a + Math.PI;
    g.add(anchor);
  }
}

function tryAddPackFurniture(g: THREE.Group, def: StationDef, seats: number, p: LocationPalette): boolean {
  const furniture = new VisibilityRoot(); furniture.name = 'premiumFurniture'; g.add(furniture);
  const vip = def.vip === true || def.visual === 'viptable';
  const sq = def.visual !== 'table';
  const topMat = vip
    ? toppedMat('vip', marbleTexture(0x3f4657, 0xf5d98c, 0.9), 0.26, 0.16)
    : liveTopMat(sq, p);
  addPremiumTable(furniture, def, seats, topMat);
  batchPremium(furniture);
  return true;
}

function tryPackBody(kind: StationVisualKind, g: THREE.Group): boolean {
  if (kind === 'table' || kind === 'tablesq' || kind === 'viptable' || kind === 'bin' || kind === 'toilet') {
    return false;
  }
  const spec = STATION_PACK[kind];
  if (!spec || !hasPack(spec.id)) return false;
  const mesh = createPackMesh(spec.id, spec.xz);
  if (!mesh) return false;
  g.add(mesh);
  return true;
}

function withPack(kind: StationVisualKind, build: Builder): Builder {
  return (g, p, def) => {
    if (tryPackBody(kind, g)) return {};
    return build(g, p, def);
  };
}

const BUILDERS: Record<StationVisualKind, Builder> = {
  samovar: withPack('samovar', buildSamovar),
  espresso: withPack('espresso', buildEspresso),
  steamer: withPack('steamer', buildSteamer),
  oven: withPack('oven', buildOven),
  panini: withPack('panini', buildToaster),
  dessertbench: withPack('dessertbench', buildDessert),
  wafflemaker: withPack('wafflemaker', buildWaffleMaker),
  coldbar: withPack('coldbar', buildColdBar),
  blender: withPack('blender', buildBlender),
  icecream: withPack('icecream', buildIceCreamCart),
  juicebar: withPack('juicebar', buildColdBar),
  // The generic cabinet hid both the product identity and the player behind it.
  napkinbox: buildNapkinBox,
  papershelf: buildPaperShelf,
  pickup: buildDisplayBody,
  // v5 raf istasyonları normalde PickupView/DisplayView ile kurulur; bu
  // giriş yalnız haritanın eksiksizliği ve olası geri düşüş için (bkz.
  // yukarıdaki "vitrin (yedek gövde)" notu).
  shelf: buildDisplayBody,
  // Paket tezgâh tek parça kapalı bir kutu gibi okunuyordu. Kasa, oyunun
  // ana etkileşim noktası olduğu için POS'u, okuyucusu ve SİPARİŞ tabelası
  // bulunan özel gövdeyi her zaman kullanır.
  counter: buildCounter,
  table: buildTable,
  tablesq: buildTable,
  viptable: buildTable,
  vacuumdock: buildVacuumDock,
  bin: buildBin,
  toilet: buildToilet,
};

/* ================================================================== *
 *  GENEL İSTASYON GÖRSELİ
 * ================================================================== */

export interface StationVisual {
  root: THREE.Group;
  /** Üretim animasyonu aç/kapa. */
  setActive(active: boolean): void;
  /** 0..1 üretim ilerlemesi → istasyonun üstündeki halka gösterge. */
  setProgress(p: number): void;
  /** Far locked zones are omitted. The next purchasable zone draws in the gray cover. */
  setLocked(locked: boolean, hidden?: boolean, nextUp?: boolean): void;
  /** Sabit ayak izinde kısa, geciktirilebilir eşya kurulumu. */
  playUnlock(delay?: number): void;
  /** Arızalıysa duman + kırmızı ikaz. */
  setBroken(broken: boolean): void;
  /** Çıkış yığınını göster: kaç adet, kapasite, hangi ürün. */
  setOutput(count: number, cap: number, item: ItemId | null): void;
  /** Girdi tamponunu göster (ör. değirmenin yanındaki buğday yığını). */
  setInput(counts: { item: ItemId; count: number; cap: number }[]): void;
  /** Oyuncu yakındayken hafif vurgulama. */
  setHighlight(on: boolean): void;
  onWipe?(dt: number): void;
  playGleam?(): void;
  update(dt: number): void;
  dispose(): void;
}

/**
 * Çıkış yığınının biçimi ürüne göre değişir. Hepsi tek bir InstancedMesh
 * üstünde döndüğü için ek çizim maliyeti yok; ama uzaktan bakınca "orada
 * bardak mı var tabak mı" sorusu cevaplanmış oluyor.
 */
const CRATE_GEO = roundBox(0.3, 0.18, 0.3, 0.05);
const CUP_GEO = cyl(0.115, 0.095, 0.22, 10);
const PLATE_GEO = cyl(0.17, 0.16, 0.07, 12);
const TALL_GEO = cyl(0.1, 0.085, 0.3, 10);

function stackGeometry(shape: string): THREE.BufferGeometry {
  switch (shape) {
    case 'teaglass':
    case 'espressocup':
    case 'lattecup':
      return CUP_GEO;
    case 'tallglass':
    case 'frappeglass':
    case 'smoothieglass':
    case 'shake':
    case 'cone':
      return TALL_GEO;
    case 'croissant':
    case 'sandwich':
    case 'cakeslice':
    case 'waffle':
    case 'dirtydish':
      return PLATE_GEO;
    default:
      return CRATE_GEO;
  }
}

const OUT_MAX = 8;
const IN_SLOTS = 2;
const IN_MAX = 6;

export function createStationVisual(def: StationDef, palette: LocationPalette): StationVisual {
  const root = new VisibilityRoot();
  root.name = `station_${def.id}`;
  root.position.set(def.x, 0, def.z);
  root.rotation.y = def.rot * DEG;

  /* --- taban + gövde --- */
  const body = new VisibilityRoot();
  body.name = 'stationBody';
  root.add(body);
  /**
   * İSTASYON ALTLIĞI — PLAKA DEĞİL, GÖLGE.
   *
   * Eskiden burada koyu renkli KATI bir levha vardı (`roundBox`, zemin
   * renginin %13 koyusu). Amacı eşyayı zemine oturtmaktı; sonucu ise her
   * masanın, tezgâhın, makinenin ve süpürge dolabının altında keskin
   * kenarlı bir KARE oldu. Oyuncunun ilk şikâyeti buydu: "sadece masanın
   * kendisi gözüksün".
   *
   * Plaka artık yumuşak bir temas gölgesiyle değişti (bkz. GroundShadow):
   * kenarı beyaza gittiği için sınırı yok, eşya yine zemine basıyor.
   * Mesh sayısı DEĞİŞMEDİ — pedin yerine gölge geçti, çizim çağrısı aynı.
   *
   * Ölçü artık `PAD_SIZE` tahmininden değil GERÇEK GÖVDEDEN gelir
   * (`STATION_BODY` — çarpışma kutusuyla aynı kaynak): 2,4'lük varsayılan
   * ped yüzünden 0,8 birimlik süpürge dolabının altında üç katı büyüklükte
   * bir kare duruyordu.
   */
  const half = STATION_BODY[def.visual] ?? { x: 0.9, z: 0.5 };

  const filmMachine = def.kind === 'machine' && ['cay','latte','tost','waffle','frappe'].includes(def.item ?? '');
  const rig = (filmMachine ? buildPremiumMachine : def.kind === 'bin' ? buildPremiumBin : BUILDERS[def.visual])(body, palette, def);
  markDynamic(body);
  const settledShell = new SettledVisual(body.children.filter(child =>
    child.userData.settledFurniture || ['premiumFurniture', 'premiumCounter', 'premiumMachine', 'premiumBin', 'stationFurniture'].includes(child.name)));

  /* --- ilerleme halkası --- */
  const prog = makeProgressRing(palette.brand);
  prog.group.position.set(0, 2.55, 0);
  prog.group.visible = false;
  root.add(prog.group);
  markDynamic(prog.group);

  /* --- zemin vurgusu --- */

  /* --- çıkış yığını (ön taraf) --- */
  const outGroup = new VisibilityRoot();
  outGroup.position.set(0, 0, 1.5);
  root.add(outGroup);
  markDynamic(outGroup);
  const outStack = makeInstanced(CRATE_GEO, mat(0xcfcabc, { rough: 0.8 }), OUT_MAX, true);
  outStack.visible = false;
  outGroup.add(outStack);
  const heroHolder = new VisibilityRoot();
  heroHolder.position.y = 0.62;
  heroHolder.visible = false;
  outGroup.add(heroHolder);
  const outLabel = facingGroup(def.rot, -0.28);
  outLabel.holder.position.set(0, 1.15, 0);
  outGroup.add(outLabel.holder);
  /**
   * "DEPO DOLU" rozeti KIRMIZI DEĞİL.
   *
   * Dolu depo İYİ bir durumdur (ürün hazır bekliyor) ama kırmızı, oyunun
   * her yerinde hata/aciliyet rengidir: bir karede beş kırmızı MAX rozeti
   * birden yandığında mekân alarm veriyor gibi okunuyordu. Nötr koyu ton
   * + krem yazı: bilgi kalır, alarm gider.
   */
  const maxChip = detail(plane(0.66, 0.24), sharedLabelMaterial('MAX', 0x3c4650, 0xf0e6d2));
  maxChip.userData.noTint = true;
  maxChip.visible = false;
  maxChip.position.y = 0.66;
  outLabel.face.add(maxChip);

  /**
   * SAYI ROZETİ — "burada ne var, kaç tane".
   *
   * Yığın tek başına okunmuyordu: dört bardak çay ile üç kruvasan uzaktan
   * aynı görünüyordu. Rozet ürün adını ve adedi doğrudan yazar; oyuncu
   * makineye bakmadan hangi tezgâhta ne olduğunu görür.
   */
  const countChip = rig.ownOutput ? null : makeLabelPlate('', 1.15, 0.3, 0x1d2b34, 0xffffff);
  if (countChip) {
    countChip.mesh.position.y = 0.32;
    countChip.mesh.userData.noTint = true;
    countChip.mesh.visible = false;
    outLabel.face.add(countChip.mesh);
  }

  let heroGroup: THREE.Group | null = null;
  let curItem: ItemId | null = null;
  let curItemSet = false;
  let heroBaseY = 0.62;

  /* --- girdi tamponları (arka taraf) --- */
  const inGroups: THREE.Group[] = [];
  const inStacks: THREE.InstancedMesh[] = [];
  const inHas: boolean[] = [false, false];
  for (let s = 0; s < IN_SLOTS; s++) {
    const gg = new VisibilityRoot();
    gg.position.set(s === 0 ? -0.95 : 0.95, 0, -1.45);
    gg.visible = false;
    root.add(gg);
    markDynamic(gg);
    const im = makeInstanced(roundBox(0.24, 0.24, 0.24, 0.05), mat(0xcfcabc, { rough: 0.85 }), IN_MAX, true);
    gg.add(im);
    inGroups.push(gg);
    inStacks.push(im);
  }

  /* --- arıza uyarısı --- */
  const brokenGroup = new VisibilityRoot();
  brokenGroup.visible = false;
  root.add(brokenGroup);
  markDynamic(brokenGroup);
  const warnLabel = facingGroup(def.rot, -0.25);
  warnLabel.holder.position.set(0, 3.0, 0);
  brokenGroup.add(warnLabel.holder);
  const warnPlate = detail(plane(0.95, 0.34), sharedLabelMaterial(tr("ARIZA"), 0xd23b2e));
  warnPlate.userData.noTint = true;
  warnLabel.face.add(warnPlate);
  const warnCone = detail(cone(0.16, 0.3, 5), basic(0xd23b2e, 1, true), 0, 2.7, 0);
  warnCone.userData.noTint = true;
  brokenGroup.add(warnCone);
  const brokenPlume = makePlume(6, 0x8d949a, 0.17, 0.5);
  brokenGroup.add(brokenPlume.im);

  /* --- durum --- */
  let t = 0;
  let act = 0;
  let activeTarget = 0;
  let progress = 0;
  /** Çıkışta ürün var mı — sayı rozetinin yakınlık görünürlüğü için. */
  let countHas = false;
  let locked = false;
  let broken = false;
  let highlight = false;
  let revealActive = false;
  let revealT = 0;
  let sceneHidden = false;
  /** Kirli-atlama imzaları — bkz. setOutput/setInput. */
  let outSig = '';
  let inSig = '';

  function rebuildHero(item: ItemId | null): void {
    if (heroGroup) {
      disposeInstancedIn(heroGroup);
      heroGroup.removeFromParent();
      heroGroup = null;
    }
    if (item) {
      outStack.material = mat(ITEMS[item].color, { rough: 0.8 });
      // Yığın da ürünün BİÇİMİNİ alsın: bardak bardak, tabak tabak durur.
      // Tek InstancedMesh olduğu için maliyeti yok, okunaklılığı çok artırır.
      outStack.geometry = stackGeometry(ITEMS[item].shape);
      heroGroup = createProductMesh(item);
      heroGroup.scale.setScalar(0.95);
    } else {
      outStack.material = mat(0x6fbf73, { rough: 0.85 });
      outStack.geometry = CRATE_GEO;
      heroGroup = createCashMesh();
      heroGroup.scale.setScalar(0.75);
    }
    heroHolder.add(heroGroup);
    markDynamic(heroGroup);
  }

  function setOutput(count: number, cap: number, item: ItemId | null): void {
    /**
     * KİRLİ-ATLAMA. World her kare, açık her istasyon için çağırır; oysa
     * değerler saniyelerce aynı kalır. İmza değişmediyse matris yazımı,
     * sınır küresi ve metin birleştirmelerine hiç girilmez. Kilit değişimi
     * imzaları sıfırlar (bkz. setLocked) — görünürlükler yeniden yazılsın.
     */
    const sig = `${count}|${cap}|${item ?? ''}`;
    if (sig === outSig) return;
    outSig = sig;
    // Masa/kova gibi istasyonlar sayacı kendi yorumlar (çöp, doluluk...).
    if (rig.ownOutput) {
      rig.onOutput?.(count, cap, item);
      return;
    }
    if (!curItemSet || item !== curItem) {
      curItem = item;
      curItemSet = true;
      rebuildHero(item);
    }
    const n = Math.min(count, OUT_MAX);
    for (let i = 0; i < OUT_MAX; i++) {
      if (i < n) {
        const col = i % 2;
        const row = Math.floor(i / 2) % 2;
        const lvl = Math.floor(i / 4);
        setInstance(outStack, i, col * 0.33 - 0.165, 0.1 + lvl * 0.19, row * 0.33 - 0.165, 0, (i % 3) * 0.2, 0);
      } else {
        hideInstance(outStack, i);
      }
    }
    flushInstances(outStack, n);
    outStack.visible = n > 0;
    heroHolder.visible = count > 0;
    heroBaseY = 0.2 + Math.max(1, Math.ceil(n / 4)) * 0.19;
    heroHolder.position.y = heroBaseY;
    maxChip.visible = cap > 0 && count >= cap;
    if (count > 0 && countChip) {
      const label = item ? `${ITEMS[item].name} ×${count}` : `₺ ×${count}`;
      countChip.setText(label);
      /**
       * Sayı rozeti yalnız YAKINDayken görünür. Sekiz makinenin "Çay ×6"
       * plakası aynı anda ekranda durunca mekân etiket panosuna dönüyordu
       * ("göz korkutan kalabalık"). MAX plakası ise uzaktan da görünmeye
       * devam eder — o bir uyarıdır: makine durdu, boşalt.
       */
      countChip.mesh.visible = !locked && !revealActive && highlight;
    } else if (countChip) {
      countChip.mesh.visible = false;
    }
    countHas = count > 0;
    rig.onOutput?.(count, cap, item);
  }

  function setInput(counts: { item: ItemId; count: number; cap: number }[]): void {
    // Normal makineler iki giriş yuvası çizer; masa rig'i ise sandalye
    // sayısınca gerçek ürün gösterebilir. Bu yüzden ownInput imzası bütün
    // ürünleri kapsar; 3./4. tabak değişince eski görsel takılı kalmaz.
    const sigCount = rig.ownInput ? counts.length : Math.min(IN_SLOTS, counts.length);
    let sig = `${counts.length}`;
    for (let i = 0; i < sigCount; i++) sig += `|${counts[i].item}:${counts[i].count}:${counts[i].cap}`;
    if (sig === inSig) return;
    inSig = sig;
    if (rig.ownInput) {
      rig.onInput?.(counts);
      return;
    }
    for (let s = 0; s < IN_SLOTS; s++) {
      const e = counts[s];
      if (!e || e.count <= 0) {
        inHas[s] = false;
        inGroups[s].visible = false;
        continue;
      }
      inHas[s] = true;
      inGroups[s].visible = !locked && !revealActive;
      const im = inStacks[s];
      im.material = mat(ITEMS[e.item].color, { rough: 0.85 });
      const n = Math.min(e.count, IN_MAX);
      for (let i = 0; i < IN_MAX; i++) {
        if (i < n) setInstance(im, i, (i % 3) * 0.28 - 0.28, 0.14 + Math.floor(i / 3) * 0.27, 0, 0, i * 0.3, 0);
        else hideInstance(im, i);
      }
      flushInstances(im, n);
    }
  }

  let covered = false;
  const applyCover = bindCoverTint(body);

  function syncVisibility(): void {
    const shown = covered || (!locked && !sceneHidden);
    root.visible = shown;
    body.visible = shown && (covered || !revealActive || revealT >= 0);
    const ready = !locked && !revealActive;
    outGroup.visible = ready;
    prog.group.visible = ready && !rig.ownRing && progress > 0.002;
    brokenGroup.visible = ready && broken;
    for (let i = 0; i < IN_SLOTS; i++) inGroups[i].visible = ready && inHas[i];
    if (countChip) countChip.mesh.visible = ready && highlight && countHas;
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
    // Repeated syncLocks calls preserve an ongoing installation.
    if (v === locked) {
      if (coverChanged || hiddenChanged) syncVisibility();
      else root.visible = covered || (!v && !hidden);
      return;
    }
    locked = v;
    if (v) {
      revealActive = false;
      body.scale.set(1, 1, 1);
    }
    outSig = '';
    inSig = '';
    rig.onLocked?.(v || revealActive);
    syncVisibility();
  }

  function setBroken(v: boolean): void {
    broken = v;
    brokenGroup.visible = v && !locked && !revealActive;
  }

  function playUnlock(delay = 0): void {
    settledShell.set(false);
    if (locked) setLocked(false, sceneHidden);
    revealActive = true;
    revealT = -Math.max(0, delay);
    // Only height changes. Footprint, ground contact and service point
    // remain fixed; shared source meshes and materials stay untouched.
    body.scale.set(1, 0.92, 1);
    rig.onLocked?.(true);
    syncVisibility();
  }

  function update(dt: number): void {
    t += dt;
    if (revealActive) {
      revealT += dt;
      if (revealT >= 0) {
        const p = clamp01(revealT / 0.32);
        const eased = 1 - Math.pow(1 - p, 3);
        body.visible = true;
        body.scale.set(1, lerp(0.92, 1, eased), 1);
        if (p >= 1) {
          revealActive = false;
          body.scale.set(1, 1, 1);
          rig.onLocked?.(locked);
          syncVisibility();
        }
      }
    }
    act = damp(act, locked || broken || revealActive ? 0 : activeTarget, 6.5, dt);
    rig.tick?.(dt, t, act);

    const showRing = !locked && !revealActive && !rig.ownRing && progress > 0.002;
    prog.group.visible = showRing;
    if (showRing) {
      prog.set(progress);
      prog.group.position.y = 2.55 + Math.sin(t * 1.9) * 0.05;
    }

    if (heroHolder.visible) {
      heroHolder.rotation.y += dt * 0.7;
      heroHolder.position.y = heroBaseY + Math.sin(t * 2.4) * 0.035;
    }


    if (brokenGroup.visible) {
      warnCone.position.y = 2.7 + Math.sin(t * 3.6) * 0.09;
      warnCone.rotation.y = t * 1.6;
      warnLabel.holder.position.y = 3.0 + Math.sin(t * 3.6) * 0.09;
      brokenPlume.tick(t, 1, 0, 1.3, 0, 1.6, 0.3);
    }
    settledShell.set(!locked && !sceneHidden && !revealActive);
  }

  function dispose(): void {
    settledShell.dispose();
    // This mutable label owns a canvas/texture; shared geometry stays cached.
    countChip?.dispose();
    rig.dispose?.();
    disposePremium(root);
    root.removeFromParent();
    disposeInstancedIn(root);
    if (heroGroup) heroGroup.removeFromParent();
    root.clear();
  }

  // Children do not inherit a Three.js layer when attached to a dynamic group.
  markDynamic(root);
  cacheLocalMatrices(root);
  return {
    root,
    setActive(v: boolean) {
      activeTarget = v ? 1 : 0;
    },
    setProgress(p: number) {
      progress = clamp01(p);
      rig.onProgress?.(progress);
    },
    setLocked,
    playUnlock,
    setBroken,
    setOutput,
    setInput,
    setHighlight(on: boolean) {
      highlight = on;
      if (countChip) countChip.mesh.visible = on && !locked && !revealActive && countHas;
    },
    onWipe(dt: number) {
      rig.onWipe?.(dt);
    },
    playGleam() {
      rig.playGleam?.();
    },
    update,
    dispose,
  };
}

/** Articulated floor tool: the shoe stays grounded and the shaft follows both hands. */
export interface HeldVacuum {
  root: THREE.Group;
  /** Süpürürken sağa-sola salınan gövde (yaw). */
  sweep: THREE.Group;
  /** Sapın gövdeye bağlandığı nokta — her karede ellere nişan alır. */
  rodPivot: THREE.Group;
  /** Sapın kendisi; uzunluğu el mesafesine göre ölçeklenir (+Y boyunca kurulu). */
  rod: THREE.Object3D;
  /** Kabza (iki tutamaklı T) — sapın ucunda. */
  grip: THREE.Object3D;
  /** Sapın taban uzunluğu (ölçek 1'de). */
  rodLen: number;
  /** Unscaled crossbar width, for fitting both hands to the grip. */
  gripWidth: number;
  dispose(): void;
}

export function createHeldVacuum(accent: number): HeldVacuum {
  return createPremiumVacuum(accent);
}
