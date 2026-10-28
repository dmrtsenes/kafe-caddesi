/** Shared geometry and finishes from reklam.mp4. No simulation, storage or studio state. */
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { tr, localeTag } from '../core/I18n';
import { STATION_BODY, type StationDef } from '../data/stations';
import { seatAngle, seatRadius } from '../data/seating';
import { ITEMS, type ItemId } from '../data/items';
import { createProductMesh } from './ProductMesh';
import { createStaticBatch } from './staticBatch';
import { basic, box, cyl, sph, torus, mat } from './Materials';
export const PREMIUM = {
  ink: 0x263238,
  green: 0x275c53,
  sage: 0x738579,
  light: 0xf1ebdf,
  cream: 0xded9cc,
  stone: 0xb9bdb6,
  gold: 0xe3a64d,
  wood: 0x926346,
  terra: 0xbe6d39,
  dark: 0x172429,
};

let timberMaterial: T.MeshStandardMaterial | null = null;
const roundCache = new Map<string, T.BufferGeometry>();
function roundBox(w: number, h: number, d: number, r: number) {
  const key = [w, h, d, r].join("|");
  let g = roundCache.get(key);
  if (!g) {
    g =
      h < 0.08 || Math.min(w, d) < 0.08
        ? box(w, h, d)
        : new RoundedBoxGeometry(
            w,
            h,
            d,
            1,
            Math.min(r, w * 0.49, h * 0.49, d * 0.49),
          );
    roundCache.set(key, g);
  }
  return g;
}
const P = PREMIUM;
function piece(
  parent: T.Object3D,
  geo: T.BufferGeometry,
  color: number,
  x: number,
  y: number,
  z: number,
  metal = 0,
) {
  const m = new T.Mesh(geo, mat(color, { rough: metal ? 0.32 : 0.68, metal }));
  if (color === P.wood && metal === 0) {
    if (!timberMaterial) {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 512;
      const k = c.getContext("2d")!;
      k.fillStyle = "#926346";
      k.fillRect(0, 0, 256, 512);
      for (let n = 0; n < 80; n++) {
        k.strokeStyle = n % 2 ? "rgba(55,36,25,.10)" : "rgba(232,182,121,.07)";
        k.lineWidth = (n % 3) + 1;
        k.beginPath();
        for (let y = 0; y <= 512; y += 8) {
          const x = ((n * 37) % 256) + Math.sin(y * 0.014 + n) * 3;
          y ? k.lineTo(x, y) : k.moveTo(x, y);
        }
        k.stroke();
      }
      const map = new T.CanvasTexture(c);
      map.colorSpace = T.SRGBColorSpace;
      map.anisotropy = 8;
      timberMaterial = new T.MeshStandardMaterial({ map, roughness: 0.61 });
    }
    m.material = timberMaterial;
  }
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function block(
  p: T.Object3D,
  w: number,
  h: number,
  d: number,
  c: number,
  x = 0,
  y = 0,
  z = 0,
  r = 0.04,
) {
  return piece(p, r ? roundBox(w, h, d, r) : box(w, h, d), c, x, y, z);
}
export function batchPremium(g: T.Group) {
  const batch = createStaticBatch(g, {compact:true, bakeInstances:true});
  g.add(batch.root);
  batch.setActive(true);
  g.userData.disposePremium = () => batch.dispose();
  return batch;
}
export function disposePremium(root: T.Object3D) {
  const dispose: (() => void)[] = [];
  root.traverse(o => { if (o.userData.disposePremium) dispose.push(o.userData.disposePremium); });
  for (const release of dispose) release();
}
const labels = new Map<string, T.MeshBasicMaterial>();
const labelGeometries = new Map<string, T.PlaneGeometry>();
function label(
  parent: T.Object3D,
  text: string,
  w: number,
  h: number,
  x: number,
  y: number,
  z: number,
  bg = P.ink,
  fg = P.cream,
) {
  const key = [text, w, h, bg, fg].join('|');
  const size = `${w}/${h}`;
  if (!labelGeometries.has(size)) labelGeometries.set(size, new T.PlaneGeometry(w, h));
  const geometry = labelGeometries.get(size)!;
  const cached = labels.get(key);
  if (cached) {
    const mesh = new T.Mesh(geometry, cached);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  const c = document.createElement("canvas");
  c.width = Math.max(256,Math.min(1024,2 ** Math.ceil(Math.log2(w*128))));
  c.height = Math.round((c.width * h) / w);
  const k = c.getContext("2d")!;
  k.fillStyle = "#" + bg.toString(16).padStart(6, "0");
  k.fillRect(0, 0, c.width, c.height);
  k.fillStyle = "#" + fg.toString(16).padStart(6, "0");
  k.textAlign = "center";
  k.textBaseline = "middle";
  k.font = `800 ${c.height * 0.53}px 'Segoe UI',sans-serif`;
  k.fillText(text, c.width / 2, c.height * 0.53, c.width * 0.9);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new T.Mesh(
    geometry,
    new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }),
  );
  m.position.set(x, y, z);
  labels.set(key, m.material);
  parent.add(m);
  return m;
}

export function premiumWoodMaterial() {
  const group = new T.Group(); piece(group, box(.01,.01,.01), P.wood, 0, 0, 0);
  return timberMaterial!;
}
export function addPremiumChair(
  parent: T.Object3D,
  x: number,
  z: number,
  a: number,
  vip = false,
) {
  const g = new T.Group();
  g.position.set(x, 0, z);
  g.rotation.y = a;
  parent.add(g);
  /**
   * Oturak derinliği misafirin uyluk boyuna göre: sırt minderi (ön yüz −0,075)
   * oturan bedenin kalçasına değer, oturak ön kenarı (0,165) dizin hemen
   * arkasında biter. Eski 0,40'lık derinlikte misafir ya arkalıktan bir karış
   * önde oturuyor ya da baldırları oturağın içinden geçiyordu (bkz. CHAIR_SIT).
   */
    for (const x of [-0.24, 0.24])
      for (const z of [-0.18, 0.13])
        piece(g, cyl(0.026, 0.035, 0.44, 8), P.dark, x, 0.22, z, 0.5);
    block(g, 0.62, 0.11, 0.38, P.wood, 0, 0.44, -0.025, 0.04);
    block(g, 0.52, 0.075, 0.275, vip ? P.terra : P.green, 0, 0.515, 0.0175, 0.028);
    block(g, 0.62, 0.46, 0.09, P.wood, 0, 0.74, -0.16, 0.038);
    block(g, 0.52, 0.29, 0.04, vip ? P.terra : P.green, 0, 0.74, -0.095, 0.018);
    for (const x of [-0.29, 0.29])
      block(g, 0.055, 0.09, 0.265, P.dark, x, 0.64, 0.0175, 0.018);
}
export function addPremiumPedestal(parent: T.Object3D, w: number, d: number) {
    block(parent, w - 0.08, 0.09, d - 0.06, P.dark, 0, 0.08, 0, 0.025);
    block(parent, w, 0.83, d, P.ink, 0, 0.5, 0, 0.055);
    block(parent, w - 0.05, 0.66, 0.035, P.wood, 0, 0.5, d / 2 + 0.012, 0.018);
    for (const x of [-w * 0.27, w * 0.27])
      block(parent, 0.017, 0.59, 0.009, P.dark, x, 0.5, d / 2 + 0.034, 0);
    block(parent, w + 0.09, 0.1, d + 0.11, P.light, 0, 0.96, 0, 0.032);
    block(parent, w - 0.14, 0.02, 0.03, P.gold, 0, 0.87, d / 2 + 0.03, 0.006);
}
function addProduct(
  parent: T.Object3D,
  item: ItemId,
  x: number,
  y: number,
  z: number,
  scale = 1,
) {
  const p = createProductMesh(item);
  p.position.set(x, y, z);
  p.scale.setScalar(scale);
  parent.add(p);
  return p;
}
export function addPremiumTable(body: T.Group, def: StationDef, seats: number, topMaterial?: T.MeshStandardMaterial) {
    const seatR = seatRadius(def.id, seats);
    const vip = !!def.vip || def.visual === "viptable",
      sq = def.visual !== "table",
      size = STATION_BODY[def.visual];
    if (vip) {
      // Dikdörtgen bordo-altın saçaklı VIP halısı
      const rug = block(body, 2.6, 0.02, 2.1, 0x6d2438, 0, 0.052, 0, 0);
      rug.castShadow = false;
      piece(body, box(2.36, 0.012, 0.045), 0xd4a017, 0, 0.068, 0.96, 0.7);
      piece(body, box(2.36, 0.012, 0.045), 0xd4a017, 0, 0.068, -0.96, 0.7);
      piece(body, box(0.045, 0.012, 1.96), 0xd4a017, 1.19, 0.068, 0, 0.7);
      piece(body, box(0.045, 0.012, 1.96), 0xd4a017, -1.19, 0.068, 0, 0.7);
      piece(body, box(0.06, 0.008, 1.96), 0xe5c158, 1.32, 0.055, 0, 0.5);
      piece(body, box(0.06, 0.008, 1.96), 0xe5c158, -1.32, 0.055, 0, 0.5);
    }
    piece(
      body,
      cyl(0.42, 0.52, 0.085, 20),
      vip ? P.gold : P.dark,
      0,
      0.045,
      0,
      0.3,
    );
    piece(
      body,
      cyl(0.09, 0.15, 0.84, 14),
      vip ? P.gold : P.dark,
      0,
      0.49,
      0,
      0.45,
    );
    const top = sq
      ? block(
          body,
          size.x * 2,
          0.11,
          size.z * 2,
          P.wood,
          0,
          0.945,
          0,
          0.07,
        )
      : piece(
          body,
          cyl(size.x, size.x, 0.105, 40),
          P.wood,
          0,
          0.9475,
          0,
        );
    top.name = 'tableFurniture';
    if (topMaterial) top.material = topMaterial;
    if (vip) {
      if (sq) {
        // 1.74 × 1.74 kare pirinç çerçeve/şerit ve iç kakma
        piece(body, box(1.74, 0.032, 0.024), P.gold, 0, 0.96, 0.86, 0.65);
        piece(body, box(1.74, 0.032, 0.024), P.gold, 0, 0.96, -0.86, 0.65);
        piece(body, box(0.024, 0.032, 1.74), P.gold, 0.86, 0.96, 0, 0.65);
        piece(body, box(0.024, 0.032, 1.74), P.gold, -0.86, 0.96, 0, 0.65);
        piece(body, box(1.24, 0.008, 0.018), P.gold, 0, 1.003, 0.61, 0.75);
        piece(body, box(1.24, 0.008, 0.018), P.gold, 0, 1.003, -0.61, 0.75);
        piece(body, box(0.018, 0.008, 1.24), P.gold, 0.61, 1.003, 0, 0.75);
        piece(body, box(0.018, 0.008, 1.24), P.gold, -0.61, 1.003, 0, 0.75);
      } else {
        const rim = piece(
          body,
          torus(0.77, 0.019, 5, 36),
          P.gold,
          0,
          1.01,
          0,
          0.6,
        );
        rim.rotation.x = Math.PI / 2;
      }
    }
    for (let n = 0; n < seats; n++) {
      const a = seatAngle(def.visual, seats, n);
      addPremiumChair(
        body,
        Math.sin(a) * seatR,
        Math.cos(a) * seatR,
        a + Math.PI,
        vip,
      );
    }
    if (vip) {
      // Merkezde pirinç şamdan + sıcak mum alevi + porselen fincanlar ve vazo
      piece(body, cyl(0.075, 0.115, 0.17, 12), 0xd4a017, 0, 1.075, 0, 0.8);
      piece(body, cyl(0.068, 0.052, 0.04, 12), 0xd4a017, 0, 1.17, 0, 0.8);
      piece(body, cyl(0.048, 0.048, 0.19, 10), 0xfff3d6, 0, 1.26, 0);
      const flame = new T.Mesh(sph(0.052, 8, 6), basic(0xffd98a));
      flame.scale.set(0.75, 1.35, 0.75);
      flame.position.set(0, 1.39, 0);
      body.add(flame);
      for (const sgn of [-1, 1]) {
        piece(body, cyl(0.115, 0.105, 0.016, 12), 0xf7f2e4, sgn * 0.3, 1.008, sgn * 0.24);
        piece(body, cyl(0.062, 0.05, 0.085, 10), 0xfbf7ec, sgn * 0.3, 1.055, sgn * 0.24);
      }
      piece(body, cyl(0.048, 0.036, 0.11, 10), 0xf7f2e4, -0.26, 1.055, 0.22);
      piece(body, cyl(0.052, 0.052, 0.018, 10), 0xd4a017, -0.26, 1.115, 0.22, 0.75);
      piece(body, sph(0.058, 8, 6), 0xd18674, -0.26, 1.165, 0.22);
    } else {
      piece(body, cyl(0.06, 0.08, 0.14, 12), P.gold, 0, 1.12, 0, 0.4);
      for (let n = 0; n < 3; n++)
        piece(
          body,
          sph(0.075, 8, 6),
          n % 2 ? 0xf1bc65 : 0xd18674,
          Math.sin(n * 2) * 0.07,
          1.25,
          Math.cos(n * 2) * 0.07,
        );
    }

  for (let i = 0; i < seats; i++) {
    const a = seatAngle(def.visual, seats, i), anchor = new T.Group();
    anchor.name = 'seat' + i;
    anchor.position.set(Math.sin(a) * seatR, 0, Math.cos(a) * seatR);
    anchor.rotation.y = a + Math.PI; body.add(anchor);
  }
  body.userData.design = 'reklam-premium';
  return top;
}
export function addPremiumCounter(body: T.Group) {
    body.userData.design = 'reklam-premium';
    addPremiumPedestal(body, 2.5, 1.1);
    piece(body, cyl(0.085, 0.12, 0.28, 10), P.dark, -0.55, 1.15, -0.06);
    const pos = block(
      body,
      0.62,
      0.48,
      0.075,
      P.dark,
      -0.55,
      1.51,
      -0.06,
      0.04,
    );
    pos.rotation.x = -0.15;
    const screen = label(
      body,
      "KAFE",
      0.51,
      0.28,
      -0.55,
      1.53,
      -0.008,
      P.green,
      P.cream,
    );
    screen.rotation.x = -0.15;
    block(body, 0.28, 0.07, 0.44, P.dark, 0.04, 1.055, 0.12, 0.025);
    piece(body, cyl(0.14, 0.14, 0.24, 16), P.gold, 0.88, 1.16, 0.05, 0.3);
    label(body, tr("KASA"), 1.6, 0.26, 0, 0.56, 0.568, P.green, P.cream);
}
export function addPremiumMachine(body: T.Group, id: ItemId) {
    addPremiumPedestal(body, 1.72, 0.95);
    if (id === "cay") {
      piece(body, cyl(0.32, 0.35, 0.64, 24), P.gold, 0, 1.39, 0, 0.65);
      piece(body, cyl(0.34, 0.31, 0.08, 24), P.dark, 0, 1.75, 0);
      piece(body, cyl(0.07, 0.1, 0.17, 12), P.gold, 0, 1.88, 0, 0.65);
      block(body, 0.11, 0.12, 0.23, P.dark, 0, 1.2, 0.37, 0.02);
    } else if (id === "latte") {
      block(body, 1.25, 0.64, 0.66, P.ink, 0, 1.38, -0.04, 0.08);
      block(body, 1.06, 0.33, 0.025, P.gold, 0, 1.42, 0.31, 0.03);
      for (const x of [-0.32, 0.32]) {
        piece(body, cyl(0.07, 0.07, 0.15, 10), P.dark, x, 1.13, 0.29);
        addProduct(body, "latte", x, 1.01, 0.3, 0.8);
      }
      for (const x of [-0.4, 0, 0.4])
        addProduct(body, "latte", x, 1.72, -0.04, 0.7);
    } else if (id === "tost" || id === "waffle") {
      block(body, 1.05, 0.16, 0.68, P.dark, 0, 1.1, 0, 0.06);
      const top = block(
        body,
        1.05,
        0.12,
        0.66,
        id === "waffle" ? P.gold : 0xc5ccc6,
        0,
        1.28,
        -0.05,
        0.04,
      );
      top.rotation.x = -0.22;
      block(body, 0.62, 0.065, 0.1, P.dark, 0, 1.35, 0.31, 0.02);
      addProduct(body, id, 0.54, 1.04, 0.26, 0.8);
    } else if (id === "frappe") {
      for (const x of [-0.33, 0.33]) {
        block(body, 0.4, 0.2, 0.42, P.green, x, 1.13, 0, 0.06);
        piece(body, cyl(0.15, 0.12, 0.45, 16), 0xe1c896, x, 1.46, 0);
        piece(body, cyl(0.17, 0.17, 0.065, 16), P.dark, x, 1.71, 0);
      }
    }

  label(body, ITEMS[id].name.toLocaleUpperCase(localeTag()), 1.4, .24, 0, .51, .49, P.green, P.cream);
  body.userData.design = 'reklam-premium';
}
export function addPremiumDisplay(body: T.Group, item?: ItemId, width = 1.52, openTop = false) {
  addPremiumPedestal(body, width, 0.95);
  const frame = P.gold;
  if (!openTop) {
  for (const x of [-0.68, 0.68])
    for (const z of [-0.38, 0.38])
      block(body, 0.025, 0.62, 0.025, frame, x, 1.31, z, 0.008);
  block(
    body,
    1.4,
    0.045,
    0.84,
    P.ink,
    0,
    1.64,
    0,
    0.02,
  );
  const glass = new T.Mesh(
    box(1.36, 0.55, 0.015),
    premiumGlass,
  );
  // Shared material survives location changes; only the view's merged geometry is owned.
  glass.position.set(0, 1.31, 0.39);
  body.add(glass);
  } else {
    // Open pickup counter: no opaque roof, dangling posts or glass over stock.
    block(body, width - .12, .035, .035, frame, 0, 1.025, -.43, .008);
  }
  label(body, item ? ITEMS[item].name.toLocaleUpperCase(localeTag()) : tr('TESLİM'), 1.24, .2, 0, .48, .49, P.green, P.cream);

  body.userData.design = 'reklam-premium';
}
const premiumGlass = new T.MeshPhysicalMaterial({color: 0xe8fff4, transparent: true, opacity: .13, roughness: .1, depthWrite: false});
export function addPremiumBin(body: T.Group) {
  block(body, .75, .79, .74, P.green, 0, .43, 0, .1);
  block(body, .8, .065, .8, P.gold, 0, .87, 0, .06);
  block(body, .42, .015, .34, P.dark, 0, .91, 0, .06);
  label(body, tr('TEMİZLİK'), .59, .19, 0, .46, .379, P.green, P.cream);
}
export function premiumFloorTexture(kind: "stone" | "oak") {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const k = c.getContext("2d")!;
  k.fillStyle = kind === "stone" ? "#e8e1ce" : "#96714f";
  k.fillRect(0, 0, 1024, 1024);
  if (kind === "stone") {
    const colors = ["#cec3aa", "#fcf5df", "#b5c0ae", "#9baf9e", "#b6a185"];
    for (let n = 0; n < 1400; n++) {
      const x = (n * 337) % 1024,
        y = (n * 613) % 1024,
        r = 1 + (n % 4);
      k.fillStyle = colors[n % colors.length];
      k.globalAlpha = 0.23 + (n % 3) * 0.12;
      k.beginPath();
      k.ellipse(x, y, r, r * 0.55, n, 0, Math.PI * 2);
      k.fill();
    }
  } else {
    // Tahtalar birbirine yakın tonda ve aralıksız. Eski 1 piksellik koyu
    // ek yeri, kamera kımıldayınca döşemede dikey bir çizgi olarak titriyordu.
    for (let n = 0; n < 8; n++) {
      const shift = (n % 3) - 1;
      k.globalAlpha = 1;
      k.fillStyle = `rgb(${0x96 + shift * 4},${0x71 + shift * 3},${0x4f + shift * 2})`;
      k.fillRect(n * 128, 0, 128, 1024);
      k.strokeStyle = "rgba(70,48,28,.06)";
      k.lineWidth = 1;
      for (let j = 0; j < 8; j++) {
        k.beginPath();
        for (let y = 0; y <= 1024; y += 16) {
          const x = n * 128 + 10 + j * 14 + Math.sin(y * 0.01 + j) * 2;
          y ? k.lineTo(x, y) : k.moveTo(x, y);
        }
        k.stroke();
      }
    }
  }
  k.globalAlpha = 1;
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(kind === "stone" ? 4 : 2, kind === "stone" ? 3 : 1);
  t.anisotropy = 16;
  return t;
}
