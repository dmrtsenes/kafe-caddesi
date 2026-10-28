import * as THREE from 'three';
import { markDynamic } from './layers';
import { createCafeDecor } from './packs/CafeFurniture';
import type { DecorDef, LocationPalette } from '../data/layouts';
import { TAU } from '../core/MathUtils';
import { Rng } from '../core/Rng';
import { basic, box, cone, cyl, detail, mat, mesh, mix, plane, roundBox, shade, sph, torus } from './Materials';
import { flushInstances, makeInstanced, setInstance, sharedLabelMaterial } from './ProductMesh';

/**
 * Dekor parçaları. Yeni mimaride dekor "boşluk doldurma" değil, mekânı
 * tamamlayan mobilyadır: her parça 2-4 çizim çağrısında kalır, tekrar eden
 * bileşenler (yaprak, çıta, tekerlek, çember) tek InstancedMesh'e iner.
 * Taban y=0, yön +Z. Konum/dönüş/ölçek Environment tarafından uygulanır.
 */

const WOOD = 0x9a6b43;
const TERRA = 0xc06b3f;
const LEAF = 0x6aa84f;
const DARK = 0x1d2b34;

type DecorKind = DecorDef['kind'];
type Maker = (g: THREE.Group, p: LocationPalette, r: Rng) => void;

/* ---------------- saksı bitkisi · 2 çizim ---------------- */
const makePlant: Maker = (g, p, r) => {
  // gövde + ağız bileziği tek örnek yığınında
  const potGeo = cyl(0.28, 0.2, 0.44, 8);
  const pot = makeInstanced(potGeo, mat(TERRA, { rough: 0.92, flatShading: true }), 2, true);
  setInstance(pot, 0, 0, 0.22, 0);
  setInstance(pot, 1, 0, 0.45, 0, 0, 0, 0, 1.1, 0.2, 1.1);
  flushInstances(pot);
  g.add(pot);

  // gür ve dengesiz bir küme — tek tip küre yerine boy/eğim varyasyonu
  const leaves = makeInstanced(sph(0.24, 8, 6), mat(mix(LEAF, p.accent, 0.16), { rough: 0.9, flatShading: true }), 8, true);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + r.range(0, 0.7);
    const rr = i === 0 ? 0 : r.range(0.12, 0.32);
    setInstance(
      leaves,
      i,
      Math.cos(a) * rr,
      0.55 + (i === 0 ? 0.34 : r.range(0, 0.4)),
      Math.sin(a) * rr,
      r.range(-0.4, 0.4),
      a,
      r.range(-0.4, 0.4),
      r.range(0.75, 1.2),
      r.range(0.5, 0.78),
      r.range(0.75, 1.2),
    );
  }
  flushInstances(leaves);
  g.add(leaves);
};

/* ---------------- ahşap kasa · 2 çizim ---------------- */
const makeCrate: Maker = (g, p, r) => {
  g.add(mesh(box(0.74, 0.58, 0.74), mat(WOOD, { rough: 0.94, flatShading: true }), 0, 0.29, 0));
  // dört çıta + kapak aynı koyu ahşapta, tek yığın
  const slats = makeInstanced(box(1, 1, 1), mat(shade(WOOD, 0.76), { rough: 0.95 }), 5, true);
  setInstance(slats, 0, 0, 0.14, 0.38, 0, 0, 0, 0.78, 0.09, 0.05);
  setInstance(slats, 1, 0, 0.44, 0.38, 0, 0, 0, 0.78, 0.09, 0.05);
  setInstance(slats, 2, 0.38, 0.14, 0, 0, Math.PI / 2, 0, 0.78, 0.09, 0.05);
  setInstance(slats, 3, 0.38, 0.44, 0, 0, Math.PI / 2, 0, 0.78, 0.09, 0.05);
  setInstance(slats, 4, 0, 0.61, 0, 0, r.range(-0.14, 0.14), 0, 0.68, 0.07, 0.68);
  flushInstances(slats);
  g.add(slats);
};

/* ---------------- kahve çuvalı · 3 çizim ---------------- */
const makeCoffeeSack: Maker = (g, p, r) => {
  const burlap = mat(0xcbb38a, { rough: 1, flatShading: true });
  g.add(mesh(roundBox(0.62, 0.7, 0.5, 0.16), burlap, 0, 0.36, 0));
  g.add(detail(cyl(0.1, 0.17, 0.16, 8), burlap, 0, 0.74, 0));
  const knot = detail(torus(0.11, 0.03, 5, 10), mat(mix(p.accent, DARK, 0.2), { rough: 0.9 }), 0, 0.74, 0);
  knot.rotation.x = -Math.PI / 2;
  g.add(knot);
  // damga + dökülen birkaç çekirdek
  g.add(detail(box(0.3, 0.2, 0.02), mat(mix(0xcbb38a, DARK, 0.35), { rough: 0.95 }), 0, 0.4, 0.26));
  const beans = makeInstanced(sph(0.055, 6, 5), mat(0x6b4327, { rough: 0.7, flatShading: true }), 4);
  for (let i = 0; i < 4; i++) {
    const a = r.range(0, TAU);
    setInstance(beans, i, Math.cos(a) * r.range(0.34, 0.5), 0.04, Math.sin(a) * r.range(0.3, 0.44), 0, a, 0.5, 1, 0.6, 0.8);
  }
  flushInstances(beans);
  g.add(beans);
};

/* ---------------- kanepe (loca) · 3 çizim ---------------- */
const makeSofa: Maker = (g, p) => {
  const fabric = mat(mix(p.wallTrim, 0x2a2118, 0.15), { rough: 0.95 });
  // oturak + sırtlık + iki kolçak
  const body = makeInstanced(roundBox(1, 1, 1, 0.1), fabric, 4, true);
  setInstance(body, 0, 0, 0.42, 0, 0, 0, 0, 2.0, 0.3, 0.85);
  setInstance(body, 1, 0, 0.82, -0.36, 0, 0, 0, 2.0, 0.68, 0.2);
  setInstance(body, 2, -0.94, 0.66, 0, 0, 0, 0, 0.2, 0.5, 0.85);
  setInstance(body, 3, 0.94, 0.66, 0, 0, 0, 0, 0.2, 0.5, 0.85);
  flushInstances(body);
  g.add(body);

  // sırt yastıkları — kumaşın kapitone hissi
  const cushions = makeInstanced(roundBox(1, 1, 1, 0.1), mat(mix(p.wallTrim, 0xffffff, 0.22), { rough: 0.96 }), 3);
  for (let i = 0; i < 3; i++) setInstance(cushions, i, -0.6 + i * 0.6, 0.82, -0.24, 0, 0, 0, 0.54, 0.5, 0.16);
  flushInstances(cushions);
  g.add(cushions);

  const legs = makeInstanced(cyl(0.05, 0.04, 0.28, 6), mat(mix(WOOD, DARK, 0.2), { rough: 0.85 }), 4);
  for (let i = 0; i < 4; i++) setInstance(legs, i, i % 2 ? 0.84 : -0.84, 0.14, i < 2 ? 0.32 : -0.32);
  flushInstances(legs);
  g.add(legs);
};

/* ---------------- teras ısıtıcısı · 3 çizim ---------------- */
const makeHeater: Maker = (g, p) => {
  const metalM = mat(0x9aa3a8, { rough: 0.35, metal: 0.55 });
  const parts = makeInstanced(box(1, 1, 1), metalM, 2, true);
  setInstance(parts, 0, 0, 1.15, 0, 0, 0, 0, 0.14, 2.3, 0.14);
  setInstance(parts, 1, 0, 0.06, 0, 0, 0, 0, 0.62, 0.12, 0.62);
  flushInstances(parts);
  g.add(parts);
  // gaz tüpü gövdesi
  g.add(mesh(cyl(0.24, 0.26, 0.7, 10), mat(mix(p.brand, 0xffffff, 0.15), { rough: 0.55 }), 0, 0.42, 0));
  // reflektör şapka
  const hood = detail(cone(0.62, 0.34, 12), metalM, 0, 2.42, 0);
  hood.rotation.x = Math.PI;
  g.add(hood);
  g.add(detail(cyl(0.16, 0.16, 0.34, 10), basic(0xffb057, 1, true), 0, 2.16, 0));
};

/* ---------------- yazı tahtası (menü) · 3 çizim ---------------- */
const makeChalkboard: Maker = (g, p) => {
  const legs = makeInstanced(cyl(0.05, 0.06, 1.5, 6), mat(mix(WOOD, DARK, 0.2), { rough: 0.9 }), 2, true);
  setInstance(legs, 0, -0.52, 0.75, 0.16, 0.12, 0, 0);
  setInstance(legs, 1, 0.52, 0.75, 0.16, 0.12, 0, 0);
  flushInstances(legs);
  g.add(legs);
  const board = mesh(roundBox(1.35, 1.1, 0.08, 0.05), mat(0x24302c, { rough: 0.95 }), 0, 1.15, 0.08);
  board.rotation.x = 0.12;
  g.add(board);
  g.add(detail(box(1.42, 0.09, 0.12), mat(mix(WOOD, 0xffffff, 0.2), { rough: 0.88 }), 0, 0.58, 0.12));
  // tebeşir satırları
  const lines = makeInstanced(box(1, 1, 1), basic(mix(p.accent, 0xffffff, 0.55), 0.9, false), 5);
  setInstance(lines, 0, 0, 1.52, 0.14, 0.12, 0, 0, 0.8, 0.07, 0.01);
  for (let i = 0; i < 4; i++) {
    setInstance(lines, 1 + i, -0.1 + (i % 2) * 0.1, 1.24 - i * 0.17, 0.14, 0.12, 0, 0, 0.9 - i * 0.1, 0.04, 0.01);
  }
  flushInstances(lines);
  g.add(lines);
};

/* ---------------- bar taburesi · 3 çizim ---------------- */
const makeStool: Maker = (g, p) => {
  const metalM = mat(0x8f979c, { rough: 0.35, metal: 0.55 });
  g.add(detail(cyl(0.24, 0.26, 0.05, 12), metalM, 0, 0.025, 0));
  g.add(mesh(cyl(0.055, 0.055, 0.72, 8), metalM, 0, 0.38, 0));
  const ring = detail(torus(0.19, 0.022, 4, 14), metalM, 0, 0.24, 0);
  ring.rotation.x = -Math.PI / 2;
  g.add(ring);
  g.add(mesh(cyl(0.26, 0.24, 0.11, 14), mat(mix(p.wallTrim, 0x2a2118, 0.1), { rough: 0.85 }), 0, 0.79, 0));
  g.add(detail(cyl(0.24, 0.24, 0.03, 14), mat(mix(WOOD, 0xffffff, 0.2), { rough: 0.8 }), 0, 0.85, 0));
};

/* ---------------- sarkıt lamba · 3 çizim ---------------- */
const makePendant: Maker = (g, p) => {
  g.add(detail(cyl(0.02, 0.02, 1.1, 5), mat(DARK, { rough: 0.7 }), 0, 2.85, 0));
  const shade1 = detail(cone(0.34, 0.38, 12), mat(mix(p.brand, 0xffffff, 0.35), { rough: 0.5, metal: 0.2 }), 0, 2.28, 0);
  shade1.rotation.x = Math.PI;
  g.add(shade1);
  g.add(detail(cyl(0.35, 0.35, 0.03, 12), basic(0xfff0c4, 0.9, false), 0, 2.1, 0));
  g.add(detail(sph(0.1, 8, 6), basic(0xfff4d2, 1, true), 0, 2.06, 0));
};

/* ---------------- asma bitki · 2 çizim ---------------- */
const makeHangPlant: Maker = (g, p, r) => {
  g.add(detail(cyl(0.018, 0.018, 0.9, 5), mat(DARK, { rough: 0.8 }), 0, 2.9, 0));
  g.add(mesh(cyl(0.26, 0.2, 0.26, 10), mat(mix(TERRA, p.accent, 0.2), { rough: 0.9, flatShading: true }), 0, 2.32, 0));
  // sarkan sürgünler
  const vines = makeInstanced(sph(0.13, 7, 6), mat(mix(LEAF, 0x2f6b3a, 0.3), { rough: 0.92, flatShading: true }), 9);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + r.range(0, 0.6);
    const drop = r.range(0.05, 0.75);
    setInstance(
      vines,
      i,
      Math.cos(a) * r.range(0.08, 0.26),
      2.42 - drop,
      Math.sin(a) * r.range(0.08, 0.26),
      0,
      a,
      0,
      r.range(0.6, 1.1),
      r.range(0.5, 0.9),
      r.range(0.6, 1.1),
    );
  }
  flushInstances(vines);
  g.add(vines);
};

/* ---------------- halı · 2 çizim ---------------- */
const makeRug: Maker = (g, p) => {
  /**
   * Halı zeminden AYRILMALI ama delik gibi durmamalı. İki yanlış deneme:
   * koyu ton tepeden bakan kamerada siyah bir dikdörtgen oluyordu; zemine
   * fazla yaklaştırılmış soğuk ton ise halı gibi değil "yarım kalmış zemin"
   * gibi okunuyordu. Doğrusu SICAK ve DOYGUN bir kil tonu: zeminin cinsi
   * belli olur ama kontrast yumuşak kalır.
   */
  const base = detail(box(2.6, 0.02, 2.0), mat(mix(p.accent, p.floor, 0.42), { rough: 1 }), 0, 0.011, 0);
  base.receiveShadow = true;
  g.add(base);
  // İçte açık dokuma alanı — düz bir levha değil, gerçek bir halı gibi.
  g.add(detail(box(1.94, 0.006, 1.38), mat(mix(p.accent, 0xfff2dd, 0.5), { rough: 1 }), 0, 0.022, 0));
  const bands = makeInstanced(box(1, 1, 1), mat(mix(p.wallTrim, 0xfff2dd, 0.42), { rough: 1 }), 4);
  setInstance(bands, 0, 0, 0.026, 0.86, 0, 0, 0, 2.16, 0.01, 0.09);
  setInstance(bands, 1, 0, 0.026, -0.86, 0, 0, 0, 2.16, 0.01, 0.09);
  setInstance(bands, 2, 1.16, 0.026, 0, 0, 0, 0, 0.09, 0.01, 1.56);
  setInstance(bands, 3, -1.16, 0.026, 0, 0, 0, 0, 0.09, 0.01, 1.56);
  flushInstances(bands);
  g.add(bands);
};

/* ---------------- neon tabela · 3 çizim ---------------- */
const makeNeon: Maker = (g, p) => {
  g.add(mesh(box(2.2, 0.9, 0.12), mat(0x1b2830, { rough: 0.9 }), 0, 2.5, 0));
  const tubes = makeInstanced(box(1, 1, 1), basic(mix(p.accent, 0xffffff, 0.4), 1, false), 5);
  setInstance(tubes, 0, 0, 2.78, 0.08, 0, 0, 0, 1.7, 0.07, 0.04);
  setInstance(tubes, 1, -0.6, 2.44, 0.08, 0, 0, 0, 0.5, 0.07, 0.04);
  setInstance(tubes, 2, 0.1, 2.44, 0.08, 0, 0, 0, 0.34, 0.07, 0.04);
  setInstance(tubes, 3, 0.66, 2.44, 0.08, 0, 0, 0, 0.4, 0.07, 0.04);
  setInstance(tubes, 4, 0, 2.2, 0.08, 0, 0, 0, 1.2, 0.05, 0.04);
  flushInstances(tubes);
  g.add(tubes);
  // fincan sembolü
  const cup = detail(torus(0.16, 0.035, 4, 14), basic(mix(p.brand, 0xffffff, 0.6), 1, false), -0.86, 2.5, 0.09);
  g.add(cup);
};

/* ---------------- kitaplık · 4 çizim ---------------- */
const makeBookshelf: Maker = (g, p) => {
  g.add(mesh(roundBox(1.5, 1.9, 0.42, 0.05), mat(mix(WOOD, DARK, 0.3), { rough: 0.9 }), 0, 0.95, 0));
  const boards = makeInstanced(box(1.38, 0.05, 0.36), mat(mix(WOOD, 0xffffff, 0.24), { rough: 0.88 }), 4);
  for (let i = 0; i < 4; i++) setInstance(boards, i, 0, 0.3 + i * 0.48, 0.02);
  flushInstances(boards);
  g.add(boards);
  // kitap sırtları — renk çeşidi için iki yığın
  const books = makeInstanced(box(0.09, 0.32, 0.26), mat(p.brand, { rough: 0.85 }), 10);
  const books2 = makeInstanced(box(0.11, 0.28, 0.26), mat(p.accent, { rough: 0.85 }), 8);
  let a = 0;
  let b = 0;
  for (let s = 0; s < 4; s++) {
    const y = 0.49 + s * 0.48;
    for (let i = 0; i < 5; i++) {
      const x = -0.58 + i * 0.24;
      if ((s + i) % 2 === 0 && a < 10) setInstance(books, a++, x, y, 0.02, 0, 0, (i % 3) * 0.06 - 0.06);
      else if (b < 8) setInstance(books2, b++, x, y - 0.02, 0.02, 0, 0, (i % 2) * 0.08);
    }
  }
  flushInstances(books);
  flushInstances(books2);
  g.add(books, books2);
};

/* ---------------- palmiye · 2 çizim ---------------- */
const makePalm: Maker = (g, p, r) => {
  const seg = 5;
  const trunk = makeInstanced(cyl(0.14, 0.2, 0.62, 7), mat(0xa8825a, { rough: 0.95, flatShading: true }), seg, true);
  const lean = r.range(-0.1, 0.1);
  let x = 0;
  let y = 0.31;
  for (let i = 0; i < seg; i++) {
    const tilt = lean + i * 0.055;
    setInstance(trunk, i, x, y, 0, 0, 0, tilt, 1 - i * 0.07, 1, 1 - i * 0.07);
    x += Math.sin(tilt) * 0.58;
    y += 0.58;
  }
  flushInstances(trunk);
  g.add(trunk);

  const topY = y - 0.2;
  const fronds = makeInstanced(sph(0.62, 8, 5), mat(mix(LEAF, 0x2f8f6a, 0.35), { rough: 0.9, flatShading: true }), 7, true);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    setInstance(fronds, i, x + Math.cos(a) * 0.5, topY - 0.06, Math.sin(a) * 0.5, 0.2 * Math.sin(a), -a, 0.28, 1.05, 0.22, 0.42);
  }
  flushInstances(fronds);
  g.add(fronds);
};

/* ---------------- şemsiye · 3 çizim ---------------- */
const makeUmbrella: Maker = (g, p) => {
  const stem = makeInstanced(cyl(0.5, 0.5, 1, 8), mat(0xe7dfd0, { rough: 0.7 }), 2, true);
  setInstance(stem, 0, 0, 1.15, 0, 0, 0, 0, 0.12, 2.3, 0.12);
  setInstance(stem, 1, 0, 0.06, 0, 0, 0, 0, 0.88, 0.12, 0.88);
  flushInstances(stem);
  g.add(stem);

  const canopy = new THREE.Group();
  canopy.name = 'umbrellaCanopy';
  canopy.userData.viewOccluder = true;
  canopy.userData.batchExclude = true;
  canopy.add(mesh(cone(1.4, 0.62, 12), mat(0xfbf6ec, { rough: 0.82 }), 0, 2.4, 0));
  const stripes = makeInstanced(cone(1.38, 0.6, 12), mat(p.accent, { rough: 0.82 }), 4, false);
  for (let i = 0; i < 4; i++) setInstance(stripes, i, 0, 2.39, 0, 0, (i / 4) * TAU + 0.35, 0, 0.3, 1.0, 1.0);
  flushInstances(stripes);
  canopy.add(stripes);
  canopy.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = (mesh.material as THREE.Material).clone();
    material.transparent = true;
    material.depthWrite = false;
    material.userData.viewOcclusionOwned = true;
    mesh.material = material;
  });
  markDynamic(canopy);
  g.add(canopy);
};

/**
 * Duvar tablosu — FİNCAN MOTİFİ.
 *
 * Eski hâli çerçevenin içine dört soyut renkli dikdörtgen diziyordu ve
 * "duvar tablosu" değil "yerleştirilmemiş placeholder" okunuyordu (üstelik
 * kilitli odaların tek duvar süsüydü). Artık markanın kendi amblemi:
 * fincan gövdesi + kulp + tabak + buhar — ikonla, açılış görseliyle ve
 * bildirim ikonuyla aynı dil.
 */
const makeWallArt: Maker = (g, p) => {
  g.add(mesh(box(0.96, 1.3, 0.08), mat(shade(WOOD, 0.85), { rough: 0.9 }), 0, 1.5, 0));
  const art = detail(plane(0.82, 1.14), basic(mix(p.wall, 0xffffff, 0.62)), 0, 1.5, 0.05);
  art.userData.noTint = true;
  g.add(art);

  const ink = mat(mix(p.brand, 0x101a16, 0.35), { rough: 0.85 });
  // gövde (aşağı doğru daralan silindir) + tabak
  g.add(detail(cyl(0.2, 0.15, 0.26, 12), ink, -0.03, 1.46, 0.07));
  g.add(detail(cyl(0.3, 0.3, 0.035, 12), ink, -0.03, 1.31, 0.07));
  // kulp: yarım halka
  const handle = detail(new THREE.TorusGeometry(0.1, 0.028, 5, 10, Math.PI), ink, 0.19, 1.47, 0.07);
  handle.rotation.z = -Math.PI / 2;
  g.add(handle);
  // buhar: iki kısa eğik çubuk
  const steam = makeInstanced(box(1, 1, 1), mat(mix(p.brand, 0xffffff, 0.55), { rough: 0.8 }), 2);
  setInstance(steam, 0, -0.09, 1.75, 0.07, 0, 0, 0.3, 0.035, 0.2, 0.02);
  setInstance(steam, 1, 0.04, 1.79, 0.07, 0, 0, -0.26, 0.035, 0.24, 0.02);
  flushInstances(steam);
  g.add(steam);
};

/* ---------------- çiçek saksısı · 2 çizim ---------------- */
const makeFlowerpot: Maker = (g, p, r) => {
  const potGeo = cyl(0.25, 0.18, 0.34, 8);
  const pot = makeInstanced(potGeo, mat(mix(TERRA, p.brand, 0.25), { rough: 0.9, flatShading: true }), 2, true);
  setInstance(pot, 0, 0, 0.17, 0);
  setInstance(pot, 1, 0, 0.35, 0, 0, 0, 0, 1.12, 0.2, 1.12);
  flushInstances(pot);
  g.add(pot);

  // sap + gonca tek yığında: dikey uzatılmış küre sapı da goncayı da verir
  const blooms = makeInstanced(sph(0.1, 7, 6), mat(p.accent, { rough: 0.65 }), 6, true);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + r.range(0, 0.5);
    const rr = r.range(0.03, 0.14);
    const h = r.range(0.3, 0.46);
    const s = r.range(0.42, 0.62);
    setInstance(blooms, i, Math.cos(a) * rr, 0.34 + h / 2, Math.sin(a) * rr, 0, a, Math.cos(a) * 0.22, s, h / 0.2, s);
  }
  flushInstances(blooms);
  g.add(blooms);
};

/* ---------------- pencere önü bankı · 2 çizim ---------------- */
/**
 * Kafe dilinin en ucuz "burası tasarlanmış" işareti: duvar dibine oturtulmuş
 * çıtalı bir bank. Boş bir duvar dibi mekânı yarım gösterir; bank o şeridi
 * OTURULABİLİR bir yer olarak okutur, üstelik yatay çizgisiyle dikey kadrajda
 * zemini böler.
 *
 * Yön +Z: sırtlık ARKADA (−Z), oturak öne bakar. Duvara dayanırken `rot`
 * ile çevrilir (güney duvarında 180, yan duvarlarda ±90).
 */
const makeBench: Maker = (g, p) => {
  const woodM = mat(mix(WOOD, 0x50331c, 0.3), { rough: 0.88, flatShading: true });
  const ironM = mat(mix(p.wallTrim, DARK, 0.35), { rough: 0.5, metal: 0.35 });

  // Oturak çıtaları + sırtlık çıtaları TEK yığında: tekrar eden parça
  // instancing'in tam hedefidir (bkz. çizim çağrısı bütçesi).
  const slats = makeInstanced(box(1, 1, 1), woodM, 7, true);
  for (let i = 0; i < 4; i++) setInstance(slats, i, 0, 0.44, -0.16 + i * 0.16, 0, 0, 0, 1.5, 0.055, 0.13);
  for (let i = 0; i < 3; i++) setInstance(slats, 4 + i, 0, 0.62 + i * 0.17, -0.29, -0.16, 0, 0, 1.5, 0.13, 0.05);
  flushInstances(slats);
  g.add(slats);

  // Dökme demir yanaklar + arka dikmeler: bankı "tahta yığını" olmaktan çıkarır.
  const frame = makeInstanced(box(1, 1, 1), ironM, 6, true);
  for (let s = 0; s < 2; s++) {
    const sx = s ? 0.72 : -0.72;
    setInstance(frame, s * 3, sx, 0.21, 0.06, 0, 0, 0, 0.07, 0.42, 0.5); // yan ayak
    setInstance(frame, s * 3 + 1, sx, 0.42, 0, 0, 0, 0, 0.09, 0.06, 0.62); // oturak kirişi
    setInstance(frame, s * 3 + 2, sx, 0.68, -0.3, -0.16, 0, 0, 0.07, 0.55, 0.06); // sırt dikmesi
  }
  flushInstances(frame);
  g.add(frame);
};

/* ---------------- uzun saksı (bitki bordürü) · 2 çizim ---------------- */
/**
 * Tek tek saksı serpiştirmek "dağınık", uzun bir bitki teknesi ise
 * "peyzaj" okunur — boş duvar dibini profesyonelce kapatmanın standart
 * yolu budur. Uzun ekseni +X'tir; duvar boyunca `rot: 90` ile döner.
 */
const makePlanter: Maker = (g, p, r) => {
  const stoneM = mat(mix(p.wall, 0x8d7f68, 0.55), { rough: 0.92, flatShading: true });
  const body = makeInstanced(box(1, 1, 1), stoneM, 2, true);
  setInstance(body, 0, 0, 0.2, 0, 0, 0, 0, 1.7, 0.4, 0.52);
  setInstance(body, 1, 0, 0.42, 0, 0, 0, 0, 1.82, 0.07, 0.6); // kenar dudağı
  flushInstances(body);
  g.add(body);

  // Çalı kümesi: boy ve eğim çeşitlemesi olmadan "yeşil tümsekler" olur.
  const bush = makeInstanced(
    sph(0.24, 8, 6),
    mat(mix(LEAF, p.brand, 0.3), { rough: 0.92, flatShading: true }),
    9,
    true,
  );
  for (let i = 0; i < 9; i++) {
    const t = (i / 8 - 0.5) * 1.5;
    setInstance(
      bush,
      i,
      t + r.range(-0.06, 0.06),
      0.52 + r.range(0, 0.18),
      r.range(-0.1, 0.1),
      r.range(-0.3, 0.3),
      r.range(0, TAU),
      r.range(-0.3, 0.3),
      r.range(0.75, 1.15),
      r.range(0.6, 0.95),
      r.range(0.75, 1.15),
    );
  }
  flushInstances(bush);
  g.add(bush);
};

/* ---------------- şimşir (kaideli budanmış ağaç) · 2 çizim ---------------- */
/**
 * Girişi çerçevelemenin klasik hamlesi: kare kaidede budanmış şimşir.
 * Saksıdan farkı DİKEYLİĞİDİR — portre kadrajda zemine yayılan dekor
 * kadar dikey bir aksan da gerekir, yoksa her şey yerde ezik durur.
 */
const makeTopiary: Maker = (g, p, r) => {
  const potM = mat(mix(p.wall, 0x7d6c56, 0.5), { rough: 0.9, flatShading: true });
  const pot = makeInstanced(box(1, 1, 1), potM, 2, true);
  setInstance(pot, 0, 0, 0.24, 0, 0, 0, 0, 0.52, 0.48, 0.52);
  setInstance(pot, 1, 0, 0.5, 0, 0, 0, 0, 0.6, 0.07, 0.6);
  flushInstances(pot);
  g.add(pot);

  const green = mat(mix(LEAF, 0x2f6b3a, 0.34), { rough: 0.9, flatShading: true });
  const ball = makeInstanced(sph(0.3, 8, 6), green, 3, true);
  // gövde yerine alttan yukarı küçülen üç küre: budanmış "kule" silueti
  setInstance(ball, 0, 0, 0.78, 0, 0, r.range(0, TAU), 0, 1.05, 0.9, 1.05);
  setInstance(ball, 1, 0, 1.18, 0, 0, r.range(0, TAU), 0, 0.82, 0.75, 0.82);
  setInstance(ball, 2, 0, 1.48, 0, 0, r.range(0, TAU), 0, 0.52, 0.5, 0.52);
  flushInstances(ball);
  g.add(ball);
};

/* ---------------- avlu feneri · 3 çizim ---------------- */
/**
 * Orta omurga bir GEÇİT, yani ritmi olmalı. Fener direkleri o ritmi verir:
 * göz omurgayı boydan boya taramak yerine duraklardan geçer. Tavan kirişi
 * dersinden ötürü kadrajın ortasından geçen hiçbir kütle yok — fener
 * inceden yukarı uzanır ve mekânı bölmez.
 */
const makeLantern: Maker = (g, p) => {
  const ironM = mat(mix(p.wallTrim, DARK, 0.4), { rough: 0.55, metal: 0.35 });
  const parts = makeInstanced(box(1, 1, 1), ironM, 3, true);
  setInstance(parts, 0, 0, 0.08, 0, 0, 0, 0, 0.34, 0.16, 0.34); // kaide
  setInstance(parts, 1, 0, 1.05, 0, 0, 0, 0, 0.09, 1.9, 0.09); // direk
  setInstance(parts, 2, 0, 2.26, 0, 0, Math.PI / 4, 0, 0.34, 0.06, 0.34); // şapka altlığı
  flushInstances(parts);
  g.add(parts);

  const head = detail(cone(0.26, 0.28, 4), ironM, 0, 2.42, 0);
  head.rotation.y = Math.PI / 4;
  g.add(head);
  // Cam gövde: ışık kutusu. Emissive değil `basic` — gece/gündüz tonlaması
  // yapılmıyor, sabit sıcak bir leke yeter ve tek çizimde kalır.
  g.add(detail(box(0.22, 0.3, 0.22), basic(0xffe9b8, 0.95, true), 0, 2.08, 0));
};

/* ---------------- bisiklet standı · 3 çizim ---------------- */
/**
 * Girişin dışını "sokak" yapan detay. Kafe kapısının yanında bisiklet
 * görmek mekânı bir mahalleye bağlar; bu, tek başına mimariyle
 * kurulamayan bir bağlamdır. Yürüme koridorunun tamamen dışında durur.
 */
const makeBikeRack: Maker = (g, p) => {
  const ironM = mat(mix(p.wallTrim, DARK, 0.3), { rough: 0.5, metal: 0.4 });
  // İki U profil stand
  const hoops = makeInstanced(box(1, 1, 1), ironM, 6, true);
  for (let s = 0; s < 2; s++) {
    const sz = s ? 0.34 : -0.34;
    setInstance(hoops, s * 3, -0.3, 0.3, sz, 0, 0, 0, 0.07, 0.6, 0.07);
    setInstance(hoops, s * 3 + 1, 0.3, 0.3, sz, 0, 0, 0, 0.07, 0.6, 0.07);
    setInstance(hoops, s * 3 + 2, 0, 0.58, sz, 0, 0, 0, 0.67, 0.07, 0.07);
  }
  flushInstances(hoops);
  g.add(hoops);

  // Bisiklet: iki tekerlek tek yığında (torus zaten önbellekli)
  const tyreM = mat(0x24282c, { rough: 0.85 });
  const wheels = makeInstanced(torus(0.3, 0.045, 5, 16), tyreM, 2, true);
  setInstance(wheels, 0, -0.52, 0.31, 0.1, 0, 0, 0);
  setInstance(wheels, 1, 0.52, 0.31, 0.1, 0, 0, 0);
  flushInstances(wheels);
  g.add(wheels);

  // Kadro: üç çubuk + sele + gidon, hepsi tek yığında
  const frameM = mat(mix(p.accent, 0xffffff, 0.15), { rough: 0.4, metal: 0.3 });
  const bike = makeInstanced(box(1, 1, 1), frameM, 5, true);
  setInstance(bike, 0, -0.16, 0.44, 0.1, 0, 0, 0.5, 0.72, 0.05, 0.05);
  setInstance(bike, 1, 0.2, 0.42, 0.1, 0, 0, -0.7, 0.55, 0.05, 0.05);
  setInstance(bike, 2, 0.04, 0.6, 0.1, 0, 0, 0.1, 0.62, 0.05, 0.05);
  setInstance(bike, 3, -0.24, 0.75, 0.1, 0, 0, 0, 0.2, 0.06, 0.11); // sele
  setInstance(bike, 4, 0.34, 0.78, 0.1, 0, 0, 0, 0.05, 0.05, 0.36); // gidon
  flushInstances(bike);
  g.add(bike);
};

/* ---------------- gramofon (müzik köşesi) · 4 çizim ---------------- */
/**
 * v5.1 yan dalı MÜZİK KÖŞESİ açılınca beliren çalar: ahşap dolap, dönen
 * plak, pirinç huni ve önünde küçük bir kilim. Huni gövdesiz durmasın diye
 * ucu plağa değecek şekilde eğilir (π + 0,55): tepesi aşağı-kuzeye, ağzı
 * yukarı-güneye — yani kameraya — bakar. Kilim, halı gibi zemine serilidir
 * ve engel değildir; DECOR_RADIUS yalnız dolabı (0,34) sayar.
 */
const makeGramofon: Maker = (g, p) => {
  // çalar dolabı — sıcak ceviz; mekân paletiyle akraba kalsın diye karışım
  g.add(mesh(roundBox(0.62, 0.56, 0.5, 0.05), mat(mix(WOOD, 0x50331c, 0.35), { rough: 0.86, flatShading: true }), 0, 0.28, 0));
  // koyu detaylar tek yığında: kaide eteği + dönen plak
  const darks = makeInstanced(cyl(1, 1, 1, 12), mat(mix(DARK, 0x000000, 0.25), { rough: 0.6 }), 2, true);
  setInstance(darks, 0, 0, 0.035, 0, 0, 0, 0, 0.36, 0.035, 0.36); // etek
  setInstance(darks, 1, -0.06, 0.575, 0.04, 0, 0, 0, 0.23, 0.012, 0.23); // plak
  flushInstances(darks);
  g.add(darks);
  // pirinç huni — tek koni; ucu plakta, ağzı yukarı-güneye açılır
  const horn = detail(cone(0.3, 0.55, 10), mat(mix(0xc9973f, p.accent, 0.18), { rough: 0.35, metal: 0.65 }), -0.04, 0.84, 0.12);
  horn.rotation.x = Math.PI + 0.55;
  g.add(horn);
  // kilim — dolabın önünde (yerel +z; rot ile birlikte döner), engel değil
  const kilim = detail(box(1.34, 0.024, 0.96), mat(mix(p.accent, p.floor, 0.4), { rough: 1 }), 0.1, 0.012, 0.95);
  kilim.receiveShadow = true;
  g.add(kilim);
};

/* ---------------- sokak tabelası (KAFE CADDESİ) · 4 çizim ---------------- */
/**
 * v5.1 yan dalı SOKAK TABELASI: direkli, kendinden ışıklı marka panosu.
 * Oda ad tabelasıyla aynı okunurluk reçetesi: yüz +z'ye (kameraya) bakar,
 * 0,3 rad geriye yatar (ped levhasının plate.rotation.x = −0,3 numarası),
 * yazı `fill` ile puntoyu yüksekliğe oturtur. Pano karakter boyunun (1,6)
 * üstünde durur (merkez y 2,08); DECOR_RADIUS yalnız kaide+direği sayar.
 */
const makeTabela: Maker = (g, p) => {
  const ironM = mat(mix(p.wallTrim, DARK, 0.35), { rough: 0.5, metal: 0.35 });
  // kaide + direk tek yığında
  const post = makeInstanced(box(1, 1, 1), ironM, 2, true);
  setInstance(post, 0, 0, 0.07, 0, 0, 0, 0, 0.5, 0.14, 0.5);
  setInstance(post, 1, 0, 1.26, 0, 0, 0, 0, 0.1, 2.38, 0.1);
  flushInstances(post);
  g.add(post);

  const pano = new THREE.Group();
  pano.position.set(0, 2.08, 0.05);
  pano.rotation.x = -0.3;
  g.add(pano);
  // sırt kutusu + yazı yüzü
  pano.add(mesh(roundBox(1.66, 0.78, 0.1, 0.04), mat(0x1b2420, { rough: 0.85 }), 0, 0, 0));
  pano.add(detail(plane(1.5, 0.6), sharedLabelMaterial('KAFE CADDESİ ☕', 0x14231e, 0xffe6b0, 1.5 / 0.6, true), 0, 0, 0.06));
  // kendinden ışıklı çerçeve — dört kenar tek emissive yığında
  const glow = makeInstanced(box(1, 1, 1), basic(mix(p.accent, 0xffd9a0, 0.55)), 4);
  setInstance(glow, 0, 0, 0.36, 0.055, 0, 0, 0, 1.58, 0.045, 0.02);
  setInstance(glow, 1, 0, -0.36, 0.055, 0, 0, 0, 1.58, 0.045, 0.02);
  setInstance(glow, 2, -0.8, 0, 0.055, 0, 0, 0, 0.045, 0.675, 0.02);
  setInstance(glow, 3, 0.8, 0, 0.055, 0, 0, 0, 0.045, 0.675, 0.02);
  flushInstances(glow);
  pano.add(glow);
};

const MAKERS: Record<DecorKind, Maker> = {
  plant: makePlant,
  hangplant: makeHangPlant,
  sofa: makeSofa,
  chalkboard: makeChalkboard,
  wallart: makeWallArt,
  flowerpot: makeFlowerpot,
  coffeesack: makeCoffeeSack,
  crate: makeCrate,
  bookshelf: makeBookshelf,
  umbrella: makeUmbrella,
  palm: makePalm,
  heater: makeHeater,
  stool: makeStool,
  rug: makeRug,
  neon: makeNeon,
  bench: makeBench,
  planter: makePlanter,
  topiary: makeTopiary,
  lantern: makeLantern,
  bikerack: makeBikeRack,
  gramofon: makeGramofon,
  tabela: makeTabela,
};

export function createDecor(kind: DecorKind, palette: LocationPalette, seed: number): THREE.Group {
  const g = new THREE.Group();
  g.name = `decor_${kind}`;
  const packed = kind === 'plant' || kind === 'bench' || kind === 'sofa' ? createCafeDecor(kind) : null;
  if (packed) g.add(packed);
  else MAKERS[kind](g, palette, new Rng((seed * 2654435761) >>> 0 || 1));
  /**
   * Dekor kurulumdan sonra hiç kımıldamaz (bölge kilidi yalnız kök
   * `visible`'ını değiştirir): yerel matrisler bir kez yazılır ve donar.
   * KÖK otomatik kalır — konum/dönüş/ölçeği Environment kurulum sırasında
   * veriyor; donmuş bir köke yazılan position sessizce kaybolurdu.
   */
  g.traverse((o) => {
    if (o === g) return;
    o.updateMatrix();
    o.matrixAutoUpdate = false;
  });
  return g;
}
