/** Flagship city cafe: compact, grounded architecture with the existing game simulation. */
import * as T from "three";
import {createPremiumBackbar} from "../world/PremiumArchitecture";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  installConceptLayout as installBase,
  dressConceptCafe as dressBase,
} from "./ConceptCafe";
import { stationsOfLocation } from "../data/stations";
import { createStaticBatch } from "../world/staticBatch";
import type { World } from "../sim/World";
const P = {
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
const BACKBAR = { x0: -9.4, z0: -11.4, x1: 9.4, z1: -10.0 };
export function installConceptLayout() {
  const loc = installBase();
  Object.assign(loc, {
    bounds: { x0: -9.5, z0: -11.5, x1: 9.5, z1: 14.4 },
    kitchen: { x0: -9, z0: -11.3, x1: 9, z1: -6.3 },
    aisle: { z0: -6.0, z1: -5.4 },
    frontAisle: { z0: -2.35, z1: 0.2 },
    barZ: -3.7,
    door: { x: 7.5, z: 14 },
    playerStart: { x: -6.3, z: -1.2 },
    staffRest: { x: 7.4, z: -6.3 },
    partitions: [BACKBAR],
  });
  Object.assign(loc.palette, {
    floor: P.cream,
    floorAlt: P.cream,
    wall: P.ink,
    wallTrim: P.wood,
    brand: P.green,
    accent: P.gold,
    ground: 0x849696,
    sunColor: 0xfff0d9,
    sunIntensity: 2.4,
    hemiGround: 0xaab9b5,
  });
  const positions: Record<string, [number, number, number?]> = {
    k_semaver: [-6.9, -8.8],
    k_sutbar: [-3.45, -8.8],
    k_tost: [0, -8.8],
    k_waffle: [3.45, -8.8],
    k_frappe: [6.9, -8.8],
    k_raf_cay: [-6.45, -3.7],
    k_raf_latte: [-4.85, -3.7],
    k_raf_tost: [-3.25, -3.7],
    k_raf_waffle: [-1.65, -3.7],
    k_raf_frappe: [-0.05, -3.7],
    k_tezgah_1: [3, -3.7],
    k_tezgah_2: [5.65, -3.7],
    k_masa_1: [-5, 1.7],
    k_masa_2: [0, 1.7],
    k_masa_3: [5, 1.7],
    k_masa_4: [-5, 6.5],
    k_masa_5: [0, 6.5],
    k_masa_6: [5, 6.5],
    k_masa_7: [-5, 11.4],
    k_masa_8: [0, 11.4],
    k_masa_9: [5, 11.4],
    k_kova_1: [-9, 6.5, 90],
    k_kova_2: [9, 6.5, -90],
    k_supurge: [-7.3, 14, 180],
  };
  for (const def of stationsOfLocation("kose")) {
    if (def.id.startsWith("k_vip_")) {
      def.location = "promo-offscreen";
      continue;
    }
    const p = positions[def.id];
    if (p) {
      def.x = p[0];
      def.z = p[1];
      def.rot = p[2] ?? 0;
    }
    if (["k_masa_7", "k_masa_8", "k_masa_9"].includes(def.id)) def.vip = true;
  }
  for (const z of loc.zones) {
    z.padX = 8.8;
    z.padZ = 13.6;
  }
  loc.staffHirePads = {
    cashier: { x: 4.35, z: -6.3, station: "k_tezgah_1" },
    waiter: { x: -4.9, z: -6.3, station: "k_raf_cay" },
    barista: { x: 1.65, z: -6.6, station: "k_tost" },
    busser: { x: -7, z: 8.6, station: "k_kova_1" },
  };
  return loc;
}
const materials = new Map<string, T.MeshStandardMaterial>(),
  geometries = new Map<string, T.BufferGeometry>();
function material(c: number, metal = 0, emissive = false) {
  const k = `${c}/${metal}/${emissive}`;
  let m = materials.get(k);
  if (!m) {
    m = new T.MeshStandardMaterial({
      color: c,
      roughness: metal ? 0.34 : 0.62,
      metalness: metal,
      emissive: emissive ? c : 0,
      emissiveIntensity: emissive ? 0.5 : 0,
    });
    materials.set(k, m);
  }
  return m;
}
function piece(
  p: T.Object3D,
  g: T.BufferGeometry,
  c: number,
  x = 0,
  y = 0,
  z = 0,
  metal = 0,
) {
  const m = new T.Mesh(g, material(c, metal));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  p.add(m);
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
  r = 0.035,
) {
  const k = [w, h, d, r].join("/");
  let g = geometries.get(k);
  if (!g) {
    g =
      h < 0.075
        ? new T.BoxGeometry(w, h, d)
        : new RoundedBoxGeometry(
            w,
            h,
            d,
            2,
            Math.min(r, w * 0.48, h * 0.48, d * 0.48),
          );
    geometries.set(k, g);
  }
  return piece(p, g, c, x, y, z);
}
function cylinder(
  p: T.Object3D,
  r: number,
  h: number,
  c: number,
  x: number,
  y: number,
  z: number,
  metal = 0,
) {
  return piece(p, new T.CylinderGeometry(r, r, h, 20), c, x, y, z, metal);
}
function strip(
  p: T.Object3D,
  w: number,
  d: number,
  x: number,
  y: number,
  z: number,
) {
  const m = block(p, w, 0.026, d, 0xffd590, x, y, z, 0.006);
  m.material = material(0xffd590, 0, true);
  m.castShadow = false;
  return m;
}
function sign(
  p: T.Object3D,
  text: string,
  w: number,
  h: number,
  x: number,
  y: number,
  z: number,
  bg = "#263238",
  fg = "#f1ebdf",
  weight = 700,
) {
  const c = document.createElement("canvas");
  c.width = 1536;
  c.height = Math.round((1536 * h) / w);
  const k = c.getContext("2d")!;
  k.fillStyle = bg;
  k.fillRect(0, 0, c.width, c.height);
  k.fillStyle = fg;
  k.font = `${weight} ${c.height * 0.58}px 'Segoe UI',sans-serif`;
  k.textAlign = "center";
  k.textBaseline = "middle";
  k.fillText(text, c.width / 2, c.height * 0.52, c.width * 0.9);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }),
  );
  m.position.set(x, y, z);
  p.add(m);
  return m;
}
function plant(p: T.Object3D, x: number, z: number, s = 1) {
  const g = new T.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  p.add(g);
  cylinder(g, 0.37, 0.6, P.ink, 0, 0.3, 0);
  cylinder(g, 0.34, 0.025, 0x40594b, 0, 0.615, 0);
  for (let n = 0; n < 10; n++) {
    const a = n * 2.399;
    const m = piece(
      g,
      new T.SphereGeometry(0.28, 9, 7),
      n % 2 ? 0x4b7951 : 0x6c925c,
      Math.cos(a) * 0.22,
      0.9 + n * 0.055,
      Math.sin(a) * 0.22,
    );
    m.scale.set(0.52, 1.35, 0.85);
    m.rotation.z = Math.cos(a) * 0.5;
  }
}
function tree(p: T.Object3D, x: number, z: number) {
  block(p, 1.85, 0.36, 1.85, P.ink, x, -0.04, z, 0.12);
  block(p, 1.63, 0.05, 1.63, 0x5c775b, x, 0.17, z, 0.024);
  cylinder(p, 0.14, 2.3, 0x755139, x, 1.3, z);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.399;
    const m = piece(
      p,
      new T.IcosahedronGeometry(0.66, 1),
      i % 2 ? 0x4d734c : 0x6b8b51,
      x + Math.cos(a) * 0.57,
      2.45 + Math.sin(i * 1.5) * 0.4,
      z + Math.sin(a) * 0.52,
    );
    m.scale.set(1.2, 0.85, 1.1);
  }
}
function floorTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const k = c.getContext("2d")!;
  k.fillStyle = "#d6d4c9";
  k.fillRect(0, 0, 512, 512);
  k.strokeStyle = "#bdbfb5";
  k.lineWidth = 2;
  k.strokeRect(1, 1, 510, 510);
  for (let n = 0; n < 650; n++) {
    k.fillStyle = n % 3 ? "rgba(92,99,89,.055)" : "rgba(255,255,255,.22)";
    k.fillRect((n * 127) % 512, (n * 283) % 512, (n % 3) + 1, (n % 2) + 1);
  }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(8, 11);
  tex.anisotropy = 16;
  return tex;
}
function architecture(world: World) {
  const root = new T.Group();
  root.name = "flagshipArchitecture";
  // Grounded city block; the cutaway roof and side walls keep gameplay visible.
  block(root, 60, 0.35, 65, 0x70837f, 0, -0.75, 0, 0.08);
  block(root, 29, 0.2, 37, 0x9aaba4, 0, -0.49, 1.45, 0.09);
  for (let x = -14; x < 15; x += 2.1)
    for (let z = -16; z < 20; z += 2.1) {
      if (Math.abs(x) < 10.2 && z > -12.2 && z < 15.3) continue;
      block(root, 1.99, 0.015, 1.99, 0xa9b5ac, x, -0.376, z, 0);
    }
  block(root, 20.2, 0.29, 27.2, P.dark, 0, -0.215, 1.45, 0.1);
  block(root, 19.6, 0.12, 26.6, P.wood, 0, -0.1, 1.45, 0.04);
  const floor = piece(
    root,
    new T.PlaneGeometry(19, 25.9),
    P.cream,
    0,
    -0.018,
    1.45,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;
  floor.material = new T.MeshStandardMaterial({
    map: floorTexture(),
    roughness: 0.78,
  });
  // Back-of-house stone and a continuous guest lounge make three legible zones.
  block(root, 18.7, 0.016, 5.2, 0x7e8987, 0, 0.004, -8.84, 0);
  block(root, 18.7, 0.02, 6.0, P.green, 0, 0.008, 11.15, 0);
  strip(root, 18.65, 0.032, 0, 0.023, 8.15);
  for (const x of [-9.2, 9.2]) strip(root, 0.03, 5.7, x, 0.025, 11.1);
  // Quiet, broad oak inserts under furniture instead of isolated toy-like colored rugs.
  for (const t of world.tables) {
    if (t.z > 9) {
      block(root, 3.9, 0.018, 3.65, 0x3a6b5f, t.x, 0.028, t.z, 0.02);
      continue;
    }
    block(root, 4.1, 0.014, 3.95, 0xc4c5b8, t.x, 0.012, t.z, 0);
    for (const z of [-1.87, 1.87])
      block(root, 3.95, 0.01, 0.028, P.wood, t.x, 0.026, t.z + z, 0);
  }
  root.add(createPremiumBackbar());
  // The service counter has a clean continuous timber face; its actual station bodies remain separate.
  // All trims stay inside the existing shelf/counter collision footprints.
  for (const st of world.pickups)
    strip(root, 1.28, 0.045, st.x, 0.94, st.z + 0.52);
  for (const st of world.counters)
    strip(root, 2.22, 0.045, st.x, 0.94, st.z + 0.6);
  // Storefront windows, pier rhythm and warm perimeter panels add depth, with low cutaway walls.
  for (const x of [-9.63, 9.63]) {
    block(root, 0.27, 0.85, 25.95, P.ink, x, 0.39, 1.45, 0.025);
    block(root, 0.31, 0.065, 25.95, P.wood, x, 0.85, 1.45, 0.018);
    for (const z of [-10.9, -4.3, 2.4, 8.9, 14.05]) {
      block(root, 0.24, 3.08, 0.24, P.dark, x, 1.53, z, 0.035);
      const light = strip(
        root,
        0.04,
        0.075,
        x + (x < 0 ? 0.14 : -0.14),
        1.65,
        z,
      );
      light.rotation.z = Math.PI / 2;
    }
    for (const z of [-7.6, -0.95, 5.65, 11.45]) {
      const pane = block(root, 0.025, 1.8, 6.05, 0xb6d2cd, x, 1.9, z, 0);
      pane.material = new T.MeshPhysicalMaterial({
        color: 0xb4d2d0,
        transparent: true,
        opacity: 0.14,
        roughness: 0.14,
        depthWrite: false,
      });
      pane.castShadow = false;
      block(root, 0.09, 0.09, 6.16, P.dark, x, 2.82, z, 0.016);
    }
    for (const z of [2.4, 8.9]) {
      block(root, 0.38, 1.92, 0.45, P.wood, x, 1.0, z, 0.04);
      for (let n = 0; n < 5; n++)
        block(
          root,
          0.035,
          1.76,
          0.045,
          P.gold,
          x + (x < 0 ? 0.21 : -0.21),
          1.02,
          z - 0.15 + n * 0.075,
          0.012,
        );
    }
  }
  // Lounge border / upholstered banquettes live beyond the bounded play floor.
  for (const x of [-5, 0]) {
    block(root, 4.05, 0.51, 0.79, P.dark, x, 0.255, 14.68, 0.085);
    block(root, 3.87, 0.15, 0.74, P.terra, x, 0.54, 14.64, 0.065);
    block(root, 4.02, 0.64, 0.14, P.terra, x, 0.8, 14.98, 0.05);
    for (let n = 0; n < 5; n++)
      block(
        root,
        0.018,
        0.47,
        0.01,
        0x8e4c2e,
        x - 1.55 + n * 0.77,
        0.81,
        14.9,
        0,
      );
  }
  sign(root, "KAFE", 4.0, 0.52, -5, 0.31, 15.095, "#172429", "#efdfbd", 700);
  for (const x of [-10.3, 10.3])
    for (const z of [-6.9, -0.8, 5.4, 12.8]) plant(root, x, z, 1.05);
  for (const x of [-12.1, 12.1]) for (const z of [-10.3, 7.5]) tree(root, x, z);
  // Right entry remains a straight, obstacle-free three-unit route.
  block(root, 3.55, 0.12, 1.1, P.light, 7.5, -0.13, 14.95, 0.025);
  block(root, 3.8, 0.12, 1.1, P.stone, 7.5, -0.25, 15.85, 0.025);
  for (const x of [5.52, 9.48])
    cylinder(root, 0.06, 0.85, P.dark, x, 0.1, 15.3, 0.4);
  const batch = createStaticBatch(root);
  root.add(batch.root);
  batch.setActive(true);
  return root;
}
export function dressConceptCafe(world: World) {
  return dressBase(world, {
    palette: P,
    architecture: () => architecture(world),
    futuristic: false,
    flagship: true,
  });
}
