import {addPremiumChair, addPremiumPedestal, addPremiumTable, addPremiumCounter, addPremiumMachine, addPremiumDisplay, addPremiumBin} from '../world/PremiumDesign';
/** Art-direction prototype confined to the independent promo document. */
import * as T from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { locationDef } from "../data/layouts";
import { stationsOfLocation, STATION_BODY } from "../data/stations";
import { seatAngle, SEAT_RADIUS } from "../data/seating";
import { createProductMesh } from "../world/ProductMesh";
import { createPackMesh } from "../world/packs/library";
import { createStaticBatch } from "../world/staticBatch";
import { box, cyl, sph, torus, mat } from "../world/Materials";
import { markDynamic } from "../world/layers";
import type { World } from "../sim/World";
import type { StationEntity } from "../sim/Station";
import type { StationVisual } from "../world/StationView";
import type { PickupVisual } from "../world/PickupView";
import type { ItemId } from "../data/items";
const roundCache = new Map<string, T.BufferGeometry>();
function roundBox(w: number, h: number, d: number, r: number) {
  const key = [w, h, d, r].join("|");
  let g = roundCache.get(key);
  if (!g) {
    g =
      h < 0.08
        ? box(w, h, d)
        : new RoundedBoxGeometry(
            w,
            h,
            d,
            2,
            Math.min(r, w * 0.49, h * 0.49, d * 0.49),
          );
    roundCache.set(key, g);
  }
  return g;
}
let futuristic = false;
let flagship = false;
let timberMaterial: T.MeshStandardMaterial | null = null;
const P = {
  ink: 0x153f37,
  green: 0x245c4a,
  sage: 0x94b7a4,
  light: 0xeaf0e6,
  cream: 0xfff8e9,
  stone: 0xe2e8de,
  gold: 0xd7a653,
  wood: 0xa96f43,
  terra: 0xc77650,
  dark: 0x243b36,
};
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
  if (flagship && color === P.wood && metal === 0) {
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
function finish(g: T.Group) {
  const batch = createStaticBatch(g);
  g.add(batch.root);
  batch.setActive(true);
}
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
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = Math.round((1024 * h) / w);
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
    new T.PlaneGeometry(w, h),
    new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }),
  );
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function plant(parent: T.Object3D, x: number, z: number, size = 1) {
  const g = new T.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(size);
  parent.add(g);
  piece(g, cyl(0.32, 0.25, 0.48, 16), P.cream, 0, 0.24, 0);
  piece(g, cyl(0.28, 0.28, 0.025, 16), 0x3e4933, 0, 0.485, 0);
  for (let n = 0; n < 8; n++) {
    const a = n * 2.4;
    const leaf = piece(
      g,
      sph(0.32, 10, 8),
      n % 2 ? 0x447952 : 0x699760,
      Math.sin(a) * 0.2,
      0.8 + n * 0.065,
      Math.cos(a) * 0.2,
    );
    leaf.scale.set(0.55, 1.3, 0.95);
    leaf.rotation.z = Math.sin(a) * 0.5;
  }
  return g;
}
function chair(
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
  if (flagship) { parent.remove(g); addPremiumChair(parent, x, z, a, vip); return; }
  if (futuristic) {
    // Molded shell seating: same seat height and footprint as the live simulation.
    piece(g, cyl(0.27, 0.31, 0.075, 24), P.gold, 0, 0.045, 0, 0.65);
    piece(g, cyl(0.075, 0.12, 0.4, 16), P.gold, 0, 0.27, 0, 0.65);
    block(g, 0.74, 0.21, 0.72, P.cream, 0, 0.49, 0, 0.1);
    block(g, 0.61, 0.085, 0.57, vip ? P.terra : P.sage, 0, 0.565, 0.025, 0.04);
    block(g, 0.76, 0.52, 0.19, P.cream, 0, 0.77, -0.27, 0.09);
    block(g, 0.61, 0.3, 0.06, vip ? P.terra : P.sage, 0, 0.79, -0.15, 0.03);
    for (const dx of [-0.34, 0.34])
      block(g, 0.11, 0.25, 0.46, P.cream, dx, 0.66, -0.02, 0.05);
    return;
  }
  for (const dx of [-0.22, 0.22])
    for (const dz of [-0.23, 0.23])
      piece(
        g,
        cyl(0.025, 0.035, 0.46, 8),
        vip ? P.gold : P.dark,
        dx,
        0.23,
        dz,
        0.35,
      );
  block(g, 0.64, 0.15, 0.64, vip ? P.green : P.terra, 0, 0.51, 0, 0.09);
  block(g, 0.65, 0.57, 0.14, vip ? P.green : P.terra, 0, 0.83, -0.28, 0.085);
  block(g, 0.58, 0.3, 0.025, vip ? 0x326b56 : 0xd89263, 0, 0.81, -0.19, 0.04);
  if (vip)
    for (const x of [-0.34, 0.34])
      block(g, 0.11, 0.12, 0.48, P.green, x, 0.77, 0, 0.045);
}
function pedestal(parent: T.Object3D, w: number, d: number, color = P.green) {
  if (flagship) { addPremiumPedestal(parent, w, d); return; }
  if (futuristic) {
    block(parent, w - 0.15, 0.11, d - 0.12, P.gold, 0, 0.09, 0, 0.045);
    block(parent, w, 0.79, d, P.cream, 0, 0.5, 0, 0.16);
    block(parent, w + 0.08, 0.12, d + 0.08, P.light, 0, 0.95, 0, 0.055);
    block(
      parent,
      w - 0.22,
      0.033,
      0.025,
      P.sage,
      0,
      0.83,
      d / 2 + 0.008,
      0.008,
    );
    for (let x = -w / 2 + 0.16; x < w / 2 - 0.1; x += 0.13)
      block(parent, 0.023, 0.55, 0.023, P.stone, x, 0.48, d / 2 + 0.003, 0.008);
    return;
  }
  block(parent, w, 0.85, d, color, 0, 0.47, 0, 0.06);
  block(parent, w + 0.12, 0.12, d + 0.13, P.cream, 0, 0.95, 0, 0.045);
  block(parent, w - 0.12, 0.07, d + 0.025, P.dark, 0, 0.09, 0, 0.015);
  for (let x = -w / 2 + 0.12; x < w / 2 - 0.06; x += 0.18)
    block(parent, 0.032, 0.66, 0.025, 0x477861, x, 0.48, d / 2 + 0.012, 0.005);
  block(parent, w - 0.16, 0.025, 0.03, P.gold, 0, 0.81, d / 2 + 0.03, 0.008);
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
export function installConceptLayout() {
  // Module globals belong to this document, never to another browser tab or a save.
  const loc = locationDef("kose");
  Object.assign(loc, {
    bounds: { x0: -9.5, z0: -13.7, x1: 9.5, z1: 18.4 },
    kitchen: { x0: -9, z0: -13, x1: 9, z1: -7.2 },
    aisle: { z0: -7.1, z1: -6 },
    frontAisle: { z0: -3.5, z1: -0.7 },
    barZ: -4.8,
    barX: { x0: -7.5, x1: 7.8 },
    terraceX: 100,
    service: null,
    partitions: [],
    courtyard: undefined,
    door: { x: 7, z: 18 },
    playerStart: { x: -6.3, z: -2.2 },
    staffRest: { x: 7.4, z: -7.2 },
    decor: [],
  });
  Object.assign(loc.palette, {
    floor: P.stone,
    floorAlt: P.stone,
    wall: P.cream,
    wallTrim: P.green,
    brand: P.green,
    accent: P.gold,
    ground: 0x75a08c,
    sunColor: 0xfff5e4,
    sunIntensity: 2.5,
    hemiGround: 0xb0c6b7,
  });
  for (const zone of loc.zones) {
    delete zone.room;
    zone.padX = 8.8;
    zone.padZ = 17;
  }
  const positions: Record<string, [number, number, number?]> = {
    k_semaver: [-6.9, -10],
    k_sutbar: [-3.45, -10],
    k_tost: [0, -10],
    k_waffle: [3.45, -10],
    k_frappe: [6.9, -10],
    k_raf_cay: [-6.45, -4.8],
    k_raf_latte: [-4.85, -4.8],
    k_raf_tost: [-3.25, -4.8],
    k_raf_waffle: [-1.65, -4.8],
    k_raf_frappe: [-0.05, -4.8],
    k_tezgah_1: [3, -4.8],
    k_tezgah_2: [5.65, -4.8],
    k_masa_1: [-5, 0.8],
    k_masa_2: [0, 0.8],
    k_masa_3: [5, 0.8],
    k_masa_4: [-5, 5.5],
    k_masa_5: [0, 5.5],
    k_masa_6: [5, 5.5],
    k_masa_7: [-5, 10.4],
    k_masa_8: [0, 10.4],
    k_masa_9: [5, 10.4],
    k_vip_1: [-5, 15.1],
    k_vip_2: [0, 15.1],
    k_vip_3: [5, 15.1],
    k_kova_1: [-9, 4.9, 90],
    k_kova_2: [9, 10.4, -90],
    k_supurge: [-7.3, 17.95, 180],
    k_wc_1: [-6.4, -12.5],
    k_wc_2: [-3.7, -12.5],
    k_pecete: [3.3, -12.5],
    k_kagit: [6.5, -12.5],
  };
  for (const def of stationsOfLocation("kose")) {
    if (def.kind === "toilet" || def.kind === "supply") {
      def.location = "promo-offscreen";
      continue;
    }
    const p = positions[def.id];
    if (p) {
      def.x = p[0];
      def.z = p[1];
      def.rot = p[2] ?? 0;
    }
  }
  loc.staffHirePads = {
    cashier: { x: 4.35, z: -8, station: "k_tezgah_1" },
    waiter: { x: -4.9, z: -8, station: "k_raf_cay" },
    busser: { x: -7, z: 7.5, station: "k_kova_1" },
    barista: { x: 1.65, z: -8, station: "k_tost" },
  };
  return loc;
}
function architecture() {
  const root = new T.Group();
  root.name = "conceptArchitecture";
  const outside = block(root, 27, 0.32, 39, 0x73a38c, 0, -0.4, 2, 0.35);
  block(root, 19.8, 0.27, 32.7, P.ink, 0, -0.19, 2.15, 0.28);
  // Quiet stone tiles, with no yellow wood cast or large empty parquet field.
  const tile = document.createElement("canvas");
  tile.width = tile.height = 512;
  const c = tile.getContext("2d")!;
  c.fillStyle = "#d3ddd7";
  c.fillRect(0, 0, 512, 512);
  c.strokeStyle = "#becbc3";
  c.lineWidth = 2;
  c.strokeRect(1, 1, 510, 510);
  for (let n = 0; n < 320; n++) {
    c.fillStyle = n % 2 ? "rgba(120,140,120,.06)" : "rgba(255,255,255,.3)";
    c.fillRect((n * 137) % 512, (n * 251) % 512, 2, 2);
  }
  const tex = new T.CanvasTexture(tile);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(12, 20);
  tex.anisotropy = 16;
  const floor = new T.Mesh(
    new T.PlaneGeometry(19, 32),
    new T.MeshStandardMaterial({ map: tex, roughness: 0.7 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.012, 2.15);
  floor.receiveShadow = true;
  root.add(floor);
  block(root, 18.6, 0.015, 6.5, 0xbbd4c3, 0, -0.006, -10.1, 0.025);
  block(root, 18.2, 0.018, 9.3, 0x345b4e, 0, -0.004, 12.75, 0.16);
  for (const z of [8.03, 17.4])
    block(root, 18, 0.02, 0.055, P.gold, 0, 0.01, z, 0.015);
  for (const x of [-8.95, 8.95])
    block(root, 0.055, 0.018, 9.3, P.gold, x, 0.012, 12.75, 0.01);
  // Rugs define seating islands, leaving clear, straight service aisles.
  for (const x of [-5, 0, 5])
    for (const z of [0.8, 5.5]) {
      block(root, 4.22, 0.025, 3.85, 0xb0bfb0, x, 0.009, z, 0.12);
      block(root, 4.04, 0.025, 3.66, 0xc7d2bd, x, 0.019, z, 0.1);
    }
  // Back wall, display millwork, rounded pilasters, framed glazing.
  block(root, 19.3, 3.25, 0.3, P.cream, 0, 1.58, -13.75, 0.065);
  block(root, 19.3, 1.12, 0.36, P.green, 0, 0.5, -13.51, 0.035);
  for (const x of [-9.5, 9.5]) {
    block(root, 0.25, 0.73, 32.1, P.cream, x, 0.3, 2.2, 0.045);
    block(root, 0.29, 0.09, 32.1, P.gold, x, 0.71, 2.2, 0.025);
    for (const z of [-10, -5, 0, 5, 10, 15]) {
      block(root, 0.18, 2.55, 0.18, P.green, x, 1.28, z, 0.03);
      const glass = piece(
        root,
        box(0.025, 1.55, 3.1),
        0xc5e5d7,
        x,
        1.66,
        z + 1.75,
      );
      glass.material = new T.MeshPhysicalMaterial({
        color: 0xadcfc1,
        transparent: true,
        opacity: 0.18,
        roughness: 0.2,
        depthWrite: false,
      });
      glass.castShadow = false;
    }
  }
  label(
    root,
    "F I N C A N   S O K A Ğ I",
    10.4,
    1.1,
    0,
    2.46,
    -13.52,
    P.green,
    P.cream,
  );
  for (const x of [-7.1, 7.1])
    label(
      root,
      x < 0 ? "COFFEE" : "BAKERY",
      2.9,
      0.52,
      x,
      2.5,
      -13.5,
      P.cream,
      P.green,
    );
  for (const x of [-6.9, -4.4, 4.4, 6.9]) {
    block(root, 2.1, 0.08, 0.42, P.wood, x, 1.54, -13.2, 0.02);
    for (let n = 0; n < 5; n++) {
      piece(
        root,
        cyl(0.08, 0.075, 0.29, 10),
        n % 2 ? P.terra : P.green,
        x - 0.72 + n * 0.35,
        1.73,
        -13.14,
      );
    }
  }
  // Coffee-bar return and canopy: aligned woodwork, integrated warm lighting.
  for (const x of [-8, 7.8])
    block(root, 0.28, 1.1, 3.2, P.green, x, 0.55, -6.1, 0.055);
  for (const z of [-7.1, -2.75])
    for (const x of [-6.4, -2.2, 2.2, 6.3]) {
      const lamp = new T.Group();
      lamp.position.set(x, 0, z);
      root.add(lamp);
      piece(lamp, cyl(0.023, 0.023, 1.0, 8), P.dark, 0, 3.75, 0);
      piece(lamp, cyl(0.26, 0.43, 0.31, 20), P.green, 0, 3.1, 0);
      const bulb = piece(
        lamp,
        cyl(0.36, 0.36, 0.025, 20),
        0xffdc8b,
        0,
        2.94,
        0,
      );
      bulb.material = mat(0xffe1a1, {
        emissive: 0xffd875,
        emissiveIntensity: 0.65,
      });
    }
  // Banquettes and planted partitions add depth without blocking the playable aisles.
  for (const x of [-8.6, 8.6])
    for (const z of [0.8, 5.5, 12.4, 16.5]) {
      const g = new T.Group();
      g.position.set(x, 0, z);
      g.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      root.add(g);
      block(g, 2.0, 0.45, 0.66, P.green, 0, 0.31, 0, 0.12);
      block(g, 2.0, 0.62, 0.16, P.green, 0, 0.83, -0.29, 0.09);
      block(g, 1.78, 0.1, 0.55, 0x5a8b6e, 0, 0.59, 0.02, 0.06);
    }
  for (const x of [-7.6, 7.6])
    for (const z of [-1.3, 3.25, 8.2, 12.9, 17.5]) plant(root, x, z, 0.8);
  for (const x of [-2.5, 2.5])
    for (const z of [8.15, 17.45]) plant(root, x, z, 0.65);
  // Front welcome wall remains low enough for the camera to see the full cafe.
  for (const x of [-4.9, 2.3]) {
    block(root, 5.6, 0.65, 0.24, P.green, x, 0.32, 18.32, 0.04);
    block(root, 5.75, 0.075, 0.34, P.cream, x, 0.68, 18.32, 0.02);
  }
  label(root, "LOUNGE  /  KAFE", 5.5, 0.5, 0, 0.56, 18.5, P.green, P.gold);
  for (const x of [-11, 11])
    for (const z of [-9, 1, 11]) plant(root, x, z, 1.4);
  finish(root);
  return root;
}
function stationView(st: StationEntity): StationVisual {
  const root = new T.Group();
  root.name = "concept_" + st.id;
  root.position.set(st.x, 0, st.z);
  root.rotation.y = (st.def.rot * Math.PI) / 180;
  const body = new T.Group();
  root.add(body);
  const dynamic = new T.Group();
  root.add(dynamic);
  markDynamic(dynamic);
  const noop = () => {};
  let products: T.Object3D[] = [],
    signature = "";
  let outputCount = 0,
    active = false;
  const dirt = new T.Group();
  dynamic.add(dirt);
  if (st.def.kind === "table") {
    const vip = !!st.def.vip,
      sq = st.def.visual !== "table",
      size = STATION_BODY[st.def.visual];
    if (flagship) addPremiumTable(body, st.def, st.seats);
    else {
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
    if (sq)
      block(
        body,
        size.x * 2,
        0.11,
        size.z * 2,
        flagship ? P.wood : vip ? 0xf7f2e2 : P.cream,
        0,
        0.98,
        0,
        0.07,
      );
    else
      piece(
        body,
        cyl(0.74, 0.74, 0.105, 40),
        flagship ? P.wood : P.cream,
        0,
        0.98,
        0,
      );
    if (vip) {
      const rim = piece(
        body,
        torus(0.77, 0.019, 5, 36),
        P.gold,
        0,
        1.044,
        0,
        0.6,
      );
      rim.rotation.x = Math.PI / 2;
    }
    for (let n = 0; n < st.seats; n++) {
      const a = seatAngle(st.def.visual, st.seats, n);
      chair(
        body,
        Math.sin(a) * SEAT_RADIUS,
        Math.cos(a) * SEAT_RADIUS,
        a + Math.PI,
        vip,
      );
    }
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
    const stain = new T.Mesh(
      new T.CircleGeometry(sq ? 0.57 : 0.54, 28),
      new T.MeshBasicMaterial({
        color: 0x97704b,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    stain.rotation.x = -Math.PI / 2;
    stain.position.y = 1.043;
    dirt.add(stain);
    const plates = [0, 1, 2, 3].map((n) =>
      addProduct(
        dynamic,
        "bulasik",
        -0.35 + (n % 2) * 0.65,
        1.055,
        Math.floor(n / 2) * 0.5 - 0.2,
        1.1,
      ),
    );
    plates.forEach((p) => (p.visible = false));
    finish(body);
    return {
      root,
      setActive: noop,
      setProgress: noop,
      setLocked: (l) => (root.visible = !l),
      playUnlock: noop,
      setBroken: noop,
      setHighlight: noop,
      setOutput: (n) => {
        outputCount = n;
        plates.forEach((p, i) => (p.visible = i < n));
      },
      setInput: (counts) => {
        const key = JSON.stringify(counts);
        if (signature === key) return;
        signature = key;
        for (const p of products) dynamic.remove(p);
        products = [];
        let n = 0;
        for (const c of counts)
          for (let q = 0; q < c.count && n < 4; q++, n++) {
            const a = seatAngle(st.def.visual, st.seats, n);
            products.push(
              addProduct(
                dynamic,
                c.item,
                Math.sin(a) * 0.5,
                1.053,
                Math.cos(a) * 0.5,
              ),
            );
          }
      },
      update: () => {
        stain.visible = st.soil > 0.02;
        (stain.material as T.MeshBasicMaterial).opacity = Math.min(
          0.65,
          st.soil * 0.55,
        );
      },
      dispose: noop,
    };
  }
  if (st.def.kind === "counter") {
    if (flagship) addPremiumCounter(body);
    else {
    pedestal(body, 2.5, 1.1);
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
    label(body, "KASA", 1.6, 0.26, 0, 0.56, 0.568, P.green, P.cream);
    }
    const cash = new T.Group();
    dynamic.add(cash);
    for (let n = 0; n < 6; n++) {
      block(
        cash,
        0.3,
        0.08,
        0.17,
        0x51ae72,
        0.25 + (n % 2) * 0.36,
        1.055 + Math.floor(n / 2) * 0.09,
        0.12,
        0.015,
      );
      block(
        cash,
        0.09,
        0.084,
        0.174,
        P.cream,
        0.25 + (n % 2) * 0.36,
        1.056 + Math.floor(n / 2) * 0.09,
        0.12,
        0.005,
      );
    }
    finish(body);
    return {
      root,
      setActive: noop,
      setProgress: noop,
      setLocked: (l) => (root.visible = !l),
      playUnlock: noop,
      setBroken: noop,
      setHighlight: noop,
      setInput: noop,
      setOutput: (n) => {
        cash.visible = n > 0;
      },
      update: noop,
      dispose: noop,
    };
  }
  if (flagship && st.def.kind === 'bin') addPremiumBin(body);
  else if (flagship && st.def.item && ['cay','latte','tost','waffle','frappe'].includes(st.def.item)) addPremiumMachine(body, st.def.item);
  else {
  if (st.def.kind === "bin") {
    block(body, 0.75, 0.79, 0.74, P.green, 0, 0.43, 0, 0.1);
    block(body, 0.8, 0.065, 0.8, P.gold, 0, 0.87, 0, 0.06);
    block(body, 0.42, 0.015, 0.34, P.dark, 0, 0.91, 0, 0.06);
    label(body, "TEMİZLİK", 0.59, 0.19, 0, 0.46, 0.379, P.green, P.cream);
  } else {
    pedestal(body, 1.72, 0.95);
    const id = st.def.item;
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
    } else {
      const model = createPackMesh(
        st.def.kind === "toilet" ? "toilet" : "cabinet",
        1.2,
      );
      if (model) {
        body.clear();
        body.add(model);
      }
    }
    if (id)
      label(
        body,
        (
          {
            cay: "ÇAY",
            latte: "KAHVE",
            tost: "TOST",
            waffle: "WAFFLE",
            frappe: "FRAPPE",
          } as Record<string, string>
        )[id] ?? "SERVİS",
        1.4,
        0.24,
        0,
        0.51,
        0.49,
        P.green,
        P.cream,
      );
  }
  }
  finish(body);
  return {
    root,
    setActive: (a) => {
      active = a;
    },
    setProgress: noop,
    setLocked: (l) => (root.visible = !l),
    playUnlock: noop,
    setBroken: noop,
    setHighlight: noop,
    setInput: noop,
    setOutput: (n) => {
      outputCount = n;
    },
    update: noop,
    dispose: noop,
  };
}
function pickupView(st: StationEntity): PickupVisual {
  const root = new T.Group();
  root.position.set(st.x, 0, st.z);
  root.name = "concept_" + st.id;
  root.rotation.y = (st.def.rot * Math.PI) / 180;
  const body = new T.Group();
  root.add(body);
  if(flagship) addPremiumDisplay(body, st.def.item);
  else {
  pedestal(body, 1.52, 0.95);
  const frame = P.gold;
  for (const x of [-0.68, 0.68])
    for (const z of [-0.38, 0.38])
      block(body, 0.025, 0.62, 0.025, frame, x, 1.31, z, 0.008);
  block(
    body,
    1.4,
    futuristic ? 0.13 : 0.045,
    0.84,
    flagship ? P.ink : futuristic ? P.cream : P.green,
    0,
    1.64,
    0,
    futuristic ? 0.06 : 0.02,
  );
  const glass = new T.Mesh(
    box(1.36, 0.55, 0.015),
    new T.MeshPhysicalMaterial({
      color: 0xe8fff4,
      transparent: true,
      opacity: 0.13,
      roughness: 0.1,
      depthWrite: false,
    }),
  );
  glass.position.set(0, 1.31, 0.39);
  body.add(glass);
  label(
    body,
    (
      {
        cay: "ÇAY",
        latte: "LATTE",
        tost: "TOST",
        waffle: "WAFFLE",
        frappe: "FRAPPE",
      } as Record<string, string>
    )[st.def.item!],
    1.24,
    0.2,
    0,
    0.48,
    0.49,
    P.green,
    P.cream,
  );
  }
  finish(body);
  const contents = new T.Group();
  root.add(contents);
  markDynamic(contents);
  let key = "";
  const update = (items: readonly ItemId[]) => {
    const next = items.join("|");
    if (key === next) return;
    key = next;
    contents.clear();
    items
      .slice(0, 8)
      .forEach((item, n) =>
        addProduct(
          contents,
          item,
          -0.43 + (n % 3) * 0.43,
          1.03 + Math.floor(n / 6) * 0.23,
          -0.22 + Math.floor((n % 6) / 3) * 0.44,
          0.88,
        ),
      );
  };
  return {
    root,
    setContents: update,
    setLocked: (l) => (root.visible = !l),
    playUnlock: () => {},
    setHighlight: () => {},
    pop: () => {},
    update: () => {},
    dispose: () => {},
  };
}
export function dressConceptCafe(
  world: World,
  direction?: {
    palette: typeof P;
    architecture: () => T.Group;
    futuristic: boolean;
    flagship?: boolean;
  },
) {
  if (direction) {
    Object.assign(P, direction.palette);
    futuristic = direction.futuristic;
    flagship = direction.flagship ?? false;
  }
  const w = world as unknown as {
    env: { root: T.Group } | null;
    stationVisuals: Map<string, StationVisual>;
    pickupVisuals: Map<string, PickupVisual>;
    guide: { root: T.Group } | null;
    groundShadows: { mesh: T.Object3D } | null;
  };
  if (w.env) w.env.root.visible = false;
  if (w.guide) w.guide.root.visible = false;
  // Replace render adapters, retaining the exact station simulation, geometry bounds,
  // seat coordinates, item counts, soil and payment state.
  for (const st of world.stations) {
    if (st.def.kind === "pickup") {
      const old = w.pickupVisuals.get(st.id);
      if (old) world.root.remove(old.root);
      const view = pickupView(st);
      w.pickupVisuals.set(st.id, view);
      world.root.add(view.root);
    } else if (
      st.def.kind !== "vacuum" &&
      st.def.kind !== "toilet" &&
      st.def.kind !== "supply"
    ) {
      const old = w.stationVisuals.get(st.id);
      if (old) world.root.remove(old.root);
      const view = stationView(st);
      w.stationVisuals.set(st.id, view);
      world.root.add(view.root);
    }
  }
  const room = direction ? direction.architecture() : architecture();
  world.root.add(room);
  const hide = () => {
    if (w.env) w.env.root.visible = false;
    if (w.guide) w.guide.root.visible = false;
    for (const staff of world.staff) {
      const badge = (staff as unknown as { statusBadge: { sprite: T.Sprite } })
        .statusBadge;
      badge.sprite.visible = false;
    }
    world.root.traverse((o) => {
      if (/^(staffHirePad:|sidePurchase_|sideWork)/.test(o.name))
        o.visible = false;
    });
  };
  return { root: room, hide, palette: P, stationCount: world.stations.length };
}
