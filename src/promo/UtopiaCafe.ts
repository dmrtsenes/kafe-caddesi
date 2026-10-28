/** Utopia is a separate, buildable set design: no save or production-layout writes. */
import * as T from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  installConceptLayout as installBase,
  dressConceptCafe as dressBase,
} from "./ConceptCafe";
import { stationsOfLocation } from "../data/stations";
import { createStaticBatch } from "../world/staticBatch";
import type { World } from "../sim/World";

const P = {
  ink: 0x203c4c,
  green: 0x638e9b,
  sage: 0x9dc4c2,
  light: 0xfbf9f4,
  cream: 0xeee9df,
  stone: 0xd8d8d1,
  gold: 0xbba47e,
  wood: 0xb6a18a,
  terra: 0xc89aa5,
  dark: 0x334852,
};
// The raised garden/water is genuinely blocked for every walking actor.
export const UTOPIA_GARDEN = { x0: -1.65, z0: 2.7, x1: 1.65, z1: 11.1 };
export function installConceptLayout() {
  const loc = installBase();
  Object.assign(loc, {
    partitions: [UTOPIA_GARDEN],
    door: { x: 7.5, z: 18 },
    staffRest: { x: 7.4, z: -7.3 },
  });
  Object.assign(loc.palette, {
    floor: P.cream,
    floorAlt: P.cream,
    wall: P.light,
    wallTrim: P.gold,
    brand: P.ink,
    accent: P.sage,
    ground: 0x9ebfc5,
    sunColor: 0xfff3e2,
    sunIntensity: 2.5,
    hemiGround: 0xa7bdc7,
  });
  // Two small dining wings and a single rear lounge, instead of a dense 3x4 grid.
  const positions: Record<string, [number, number, number?]> = {
    k_masa_1: [-5.25, 0.8],
    k_masa_2: [5.25, 0.8],
    k_masa_3: [-5.25, 5.55],
    k_masa_4: [5.25, 5.55],
    k_masa_5: [-5.25, 10.35],
    k_masa_6: [5.25, 10.35],
    k_masa_7: [-5.25, 15.1],
    k_masa_8: [0, 15.1],
    k_masa_9: [5.25, 15.1],
    k_kova_1: [9, 5.55, -90],
    k_kova_2: [-9, 10.35, 90],
    k_semaver: [-6.9, -10.1],
    k_sutbar: [-3.45, -11.05],
    k_tost: [0, -11.45],
    k_waffle: [3.45, -11.05],
    k_frappe: [6.9, -10.1],
    k_supurge: [-7.3, 17.95, 180],
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
    if (
      def.kind === "table" &&
      ["k_masa_7", "k_masa_8", "k_masa_9"].includes(def.id)
    )
      def.vip = true;
  }
  loc.staffHirePads!.busser = { x: 7.0, z: 7.65, station: "k_kova_1" };
  return loc;
}
const geometries = new Map<string, T.BufferGeometry>();
const materials = new Map<string, T.MeshStandardMaterial>();
function material(c: number, metal = 0, rough = 0.56) {
  const key = `${c}|${metal}|${rough}`;
  let m = materials.get(key);
  if (!m) {
    m = new T.MeshStandardMaterial({
      color: c,
      metalness: metal,
      roughness: rough,
    });
    materials.set(key, m);
  }
  return m;
}
function mesh(
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
  r = 0.06,
) {
  const key = [w, h, d, r].join("|");
  let g = geometries.get(key);
  if (!g) {
    g =
      h < 0.08
        ? new T.BoxGeometry(w, h, d)
        : new RoundedBoxGeometry(
            w,
            h,
            d,
            3,
            Math.min(r, h * 0.48, w * 0.48, d * 0.48),
          );
    geometries.set(key, g);
  }
  return mesh(p, g, c, x, y, z);
}
function slab(
  p: T.Object3D,
  w: number,
  d: number,
  r: number,
  h: number,
  c: number,
  x: number,
  y: number,
  z: number,
) {
  const shape = new T.Shape(),
    a = -w / 2,
    b = -d / 2;
  shape.moveTo(a + r, b);
  shape.lineTo(a + w - r, b);
  shape.quadraticCurveTo(a + w, b, a + w, b + r);
  shape.lineTo(a + w, b + d - r);
  shape.quadraticCurveTo(a + w, b + d, a + w - r, b + d);
  shape.lineTo(a + r, b + d);
  shape.quadraticCurveTo(a, b + d, a, b + d - r);
  shape.lineTo(a, b + r);
  shape.quadraticCurveTo(a, b, a + r, b);
  const g = new T.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: false,
    curveSegments: 12,
  });
  g.rotateX(-Math.PI / 2);
  return mesh(p, g, c, x, y, z);
}
function cylinder(
  p: T.Object3D,
  rt: number,
  rb: number,
  h: number,
  c: number,
  x = 0,
  y = 0,
  z = 0,
  metal = 0,
) {
  return mesh(p, new T.CylinderGeometry(rt, rb, h, 32), c, x, y, z, metal);
}
function tube(
  p: T.Object3D,
  points: T.Vector3[],
  r: number,
  c: number,
  closed = false,
) {
  const curve = new T.CatmullRomCurve3(points, closed, "centripetal");
  return mesh(
    p,
    new T.TubeGeometry(curve, Math.max(32, points.length * 4), r, 8, closed),
    c,
  );
}
function ellipse(
  p: T.Object3D,
  rx: number,
  rz: number,
  y: number,
  z: number,
  r: number,
  c: number,
) {
  const points = Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return new T.Vector3(Math.cos(a) * rx, y, z + Math.sin(a) * rz);
  });
  return tube(p, points, r, c, true);
}
function plaque(
  p: T.Object3D,
  text: string,
  w: number,
  h: number,
  x: number,
  y: number,
  z: number,
  fg = "#203c4c",
  bg = "#efede5",
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = Math.round((1536 * h) / w);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = fg;
  ctx.font = `500 ${canvas.height * 0.48}px 'Segoe UI',sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    text,
    canvas.width / 2,
    canvas.height * 0.53,
    canvas.width * 0.93,
  );
  const tex = new T.CanvasTexture(canvas);
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
function leaves(
  p: T.Object3D,
  x: number,
  y: number,
  z: number,
  scale: number,
  pink = false,
) {
  for (let i = 0; i < 10; i++) {
    const a = i * 2.399;
    const radius = 0.24 + Math.sqrt(i / 10) * 0.55;
    const m = mesh(
      p,
      new T.IcosahedronGeometry(0.42, 1),
      pink
        ? i % 3 === 0
          ? 0xe8bdd1
          : i % 3 === 1
            ? 0xd19fac
            : 0xf1d6d7
        : i % 2
          ? 0x83a698
          : 0x527e72,
      x + Math.cos(a) * radius * scale,
      y + Math.sin(i * 1.7) * 0.25 * scale,
      z + Math.sin(a) * radius * scale,
    );
    m.scale.set(1.3 * scale, 0.62 * scale, scale);
  }
}
function tree(p: T.Object3D, x: number, z: number, scale = 1, pink = false) {
  const g = new T.Group();
  p.add(g);
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  cylinder(g, 0.84, 0.7, 0.34, P.light, 0, 0.18, 0);
  cylinder(g, 0.72, 0.72, 0.035, 0x496858, 0, 0.36, 0);
  cylinder(g, 0.11, 0.19, 2.2, P.wood, 0, 1.45, 0);
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4;
    const ex = Math.cos(a) * 0.85,
      ez = Math.sin(a) * 0.85;
    tube(
      g,
      [
        new T.Vector3(0, 1.3 + i * 0.12, 0),
        new T.Vector3(ex * 0.5, 2.2, ez * 0.5),
        new T.Vector3(ex, 2.7 + Math.sin(i) * 0.18, ez),
      ],
      0.065,
      P.wood,
    );
  }
  leaves(g, 0, 2.9, 0, 1.4, pink);
  leaves(g, 0.2, 3.4, 0.1, 0.85, pink);
}
function planter(p: T.Object3D, x: number, z: number, size = 1) {
  const g = new T.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(size);
  p.add(g);
  cylinder(g, 0.35, 0.25, 0.5, P.light, 0, 0.25, 0);
  cylinder(g, 0.3, 0.3, 0.025, 0x60776b, 0, 0.51, 0);
  for (let n = 0; n < 9; n++) {
    const a = n * 2.4;
    const m = mesh(
      g,
      new T.SphereGeometry(0.25, 10, 8),
      n % 2 ? 0x709f90 : 0x95b6a2,
      Math.cos(a) * 0.2,
      0.79 + n * 0.055,
      Math.sin(a) * 0.2,
    );
    m.scale.set(0.5, 1.5, 0.7);
    m.rotation.z = Math.cos(a) * 0.55;
  }
}
function water(
  p: T.Object3D,
  w: number,
  d: number,
  x: number,
  z: number,
  y = -0.09,
) {
  const m = block(p, w, 0.045, d, 0x8cbabf, x, y, z, 0);
  // Baked ripples keep the design practical for the existing mobile renderer.
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#8ebabe";
  ctx.fillRect(0, 0, 512, 512);
  ctx.lineWidth = 2;
  for (let n = 0; n < 30; n++) {
    ctx.strokeStyle = n % 2 ? "rgba(222,250,245,.23)" : "rgba(46,128,142,.11)";
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 8) {
      const y = n * 18 + Math.sin(x * 0.018 + n * 1.91) * 7;
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(w / 5, d / 5);
  tex.anisotropy = 8;
  m.material = new T.MeshStandardMaterial({
    map: tex,
    roughness: 0.25,
    metalness: 0.14,
  });
  m.castShadow = false;
  return m;
}
function architecture(world: World) {
  const root = new T.Group();
  root.name = "utopiaArchitecture";
  water(root, 130, 150, 0, 3, -0.65);
  // A pearl pavilion on water. Exterior is set dressing beyond the walkable rectangle.
  slab(root, 23, 36.8, 2.2, 0.42, 0x71969f, 0, -0.61, 2.2);
  slab(root, 21.4, 34.8, 1.5, 0.29, P.gold, 0, -0.41, 2.2);
  slab(root, 20.9, 34.3, 1.25, 0.28, P.light, 0, -0.3, 2.2);
  block(root, 19, 0.045, 32.2, P.cream, 0, -0.023, 2.2, 0);
  // Oversized, understated travertine joints avoid a noisy checkerboard.
  for (let z = -12; z < 18; z += 2.4)
    block(root, 18.8, 0.006, 0.015, 0xd8d7d1, 0, 0.005, z, 0);
  for (let x = -8; x < 9; x += 2.4)
    block(root, 0.015, 0.006, 32, 0xd8d7d1, x, 0.005, 2.2, 0);
  slab(root, 18.7, 7.0, 1.7, 0.018, 0xaec9c9, 0, 0.005, -10.15);
  // Two dining wings share a clear central circulation loop.
  for (const st of world.tables) {
    const c = st.def.vip ? 0xc6bfc8 : st.x < 0 ? 0xc3d6d0 : 0xd4cdd0;
    slab(root, 4.25, 4.0, 1.35, 0.014, P.gold, st.x, 0.015, st.z);
    slab(root, 4.14, 3.9, 1.3, 0.014, c, st.x, 0.03, st.z);
    for (const dx of [-1.96, 1.96])
      block(root, 0.016, 0.004, 3.7, 0xf0eee6, st.x + dx, 0.04, st.z, 0);
  }
  // Central reflected garden. Its exact outer rectangle is in Navigation.
  slab(root, 3.3, 8.4, 1.3, 0.3, P.light, 0, -0.02, 6.9);
  slab(root, 3.05, 8.12, 1.24, 0.031, P.gold, 0, 0.279, 6.9);
  const pool = water(root, 2.94, 8.0, 0, 6.9, 0.313);
  const poolCap = slab(root, 2.94, 8.0, 1.2, 0.032, 0x8cbabf, 0, 0.311, 6.9);
  poolCap.material = pool.material;
  root.remove(pool);
  ellipse(root, 2.55, 5.2, 0.014, 6.9, 0.022, P.gold);
  for (const z of [4.8, 9]) tree(root, 0, z, 1.0, true);
  for (const z of [3.25, 10.55]) {
    cylinder(root, 0.25, 0.26, 0.13, P.gold, 0, 0.405, z, 0.6);
    cylinder(root, 0.14, 0.14, 0.035, P.light, 0, 0.49, z);
  }
  // Four pool-mounted columns support a thin oval trellis, not a floating ring.
  for (const x of [-1.32, 1.32])
    for (const z of [4.0, 9.8]) {
      cylinder(root, 0.035, 0.045, 3.7, P.gold, x, 2.15, z, 0.5);
      tube(
        root,
        [
          new T.Vector3(x, 3.95, z),
          new T.Vector3(x * 1.35, 4.22, z),
          new T.Vector3(x * 1.39, 4.35, z),
        ],
        0.035,
        P.gold,
      );
    }
  ellipse(root, 1.94, 4.45, 4.35, 6.9, 0.06, P.gold);
  ellipse(root, 1.89, 4.4, 4.33, 6.9, 0.022, 0xf6eed6);
  // Sculptural rear wall with a deeply recessed coffee and pastry gallery.
  block(root, 19.1, 2.35, 0.3, P.light, 0, 1.12, -13.62, 0.14);
  for (let x = -8.9; x <= 8.9; x += 0.28)
    block(root, 0.045, 2.15, 0.045, 0xdedbd1, x, 1.08, -13.42, 0.018);
  plaque(root, "F I N C A N   S O K A Ğ I", 10.3, 0.95, 0, 2.05, -13.2);
  plaque(root, "U T O P I A", 5.3, 0.4, 0, 1.35, -13.19, "#638e9b");
  for (const x of [-7.4, 7.4]) {
    block(root, 2.1, 0.08, 0.37, P.gold, x, 1.14, -13.08, 0.025);
    for (let n = 0; n < 6; n++)
      cylinder(
        root,
        0.07,
        0.07,
        0.23,
        n % 2 ? P.terra : P.green,
        x - 0.79 + n * 0.31,
        1.29,
        -13.07,
      );
  }
  // Structural white ribs create an open conservatory silhouette.
  for (const z of [-13.35, -8.0]) {
    const points = Array.from({ length: 33 }, (_, i) => {
      const a = (i / 32) * Math.PI;
      return new T.Vector3(-9.8 * Math.cos(a), 1.1 + 5.0 * Math.sin(a), z);
    });
    tube(root, points, 0.13, P.light);
    tube(
      root,
      points.map((p) => p.clone().add(new T.Vector3(0, -0.055, 0.035))),
      0.022,
      P.gold,
    );
    for (const x of [-9.8, 9.8])
      cylinder(root, 0.14, 0.23, 1.25, P.light, x, 0.6, z);
  }
  // Side conservatory arches sit outside the playable boundary. Curved glass panels
  // and ribs create a coherent pavilion, while the open centre keeps play readable.
  for (const x of [-9.75, 9.75])
    for (const start of [-5.5, 2.3, 10.1]) {
      const points = Array.from({ length: 25 }, (_, i) => {
        const a = (i / 24) * Math.PI;
        return new T.Vector3(
          x,
          0.9 + 3.1 * Math.sin(a),
          start + (i / 24) * 7.6,
        );
      });
      tube(root, points, 0.095, P.light);
      tube(
        root,
        points.map((p) =>
          p.clone().add(new T.Vector3(x < 0 ? 0.035 : -0.035, -0.04, 0)),
        ),
        0.02,
        P.gold,
      );
      for (const z of [start, start + 7.6])
        cylinder(root, 0.08, 0.12, 0.95, P.light, x, 0.43, z);
      const panel = new T.Shape();
      panel.moveTo(start, 0.9);
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI;
        panel.lineTo(start + (i / 24) * 7.6, 0.9 + 3.1 * Math.sin(a));
      }
      panel.closePath();
      const geom = new T.ShapeGeometry(panel, 16);
      const glass = new T.Mesh(
        geom,
        new T.MeshPhysicalMaterial({
          color: 0xc5e4e5,
          transparent: true,
          opacity: 0.12,
          roughness: 0.18,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      );
      glass.rotation.y = -Math.PI / 2;
      glass.position.x = x;
      root.add(glass);
    }
  // Clear, low glass balustrades make the waterfront edge visible without hiding actors.
  for (const x of [-9.5, 9.5]) {
    block(root, 0.2, 0.19, 31.6, P.light, x, 0.08, 2.2, 0.06);
    for (const z of [-11, -6, -1, 4, 9, 14, 17.7]) {
      cylinder(root, 0.035, 0.045, 1.25, P.gold, x, 0.66, z, 0.5);
    }
    const glass = block(root, 0.026, 0.92, 31.4, 0xdaefef, x, 0.63, 2.2, 0);
    glass.material = new T.MeshPhysicalMaterial({
      color: 0xd2e9ec,
      transparent: true,
      opacity: 0.17,
      roughness: 0.15,
      depthWrite: false,
    });
    glass.castShadow = false;
    block(root, 0.05, 0.045, 31.5, P.gold, x, 1.13, 2.2, 0.02);
  }
  // Tailored furniture and garden borders remain outside the navigation boundary.
  for (const x of [-10.0, 10.0])
    for (const z of [-4, 2.7, 8.1, 13.1, 17]) planter(root, x, z, 0.95);
  for (const x of [-11.4, 11.4])
    for (const z of [-9.2, 3.2, 14.4]) {
      cylinder(root, 1.0, 1.1, 0.32, P.light, x, -0.31, z);
      tree(root, x, z, 1.0, false);
    }
  // A shallow sunken lounge border and entrance steps, with a clear right-hand doorway.
  for (const x of [-5.2, 0]) {
    block(root, 4.0, 0.44, 0.72, P.light, x, 0.25, 18.15, 0.2);
    block(root, 3.65, 0.13, 0.61, P.terra, x, 0.49, 18.16, 0.06);
    block(root, 3.96, 0.5, 0.19, P.light, x, 0.62, 18.43, 0.09);
  }
  for (let n = 0; n < 3; n++)
    block(
      root,
      3.4 + n * 0.35,
      0.13,
      1.0,
      P.light,
      7.5,
      -0.14 - n * 0.13,
      18.9 + n * 0.65,
      0.06,
    );
  plaque(
    root,
    "F İ N C A N",
    3.8,
    0.47,
    -5.2,
    0.58,
    18.58,
    "#203c4c",
    "#eee9df",
  );
  // Architectural light strips use shared materials, not costly real-time light arrays.
  for (const st of world.machines) {
    const g = new T.Group();
    g.position.set(st.x, 0, st.z);
    root.add(g);
    const points = Array.from({ length: 21 }, (_, i) => {
      const a = (i / 20) * Math.PI;
      return new T.Vector3(-1.17 * Math.cos(a), 1.6 + 1.3 * Math.sin(a), -0.75);
    });
    tube(g, points, 0.036, P.gold);
    for (const x of [-1.17, 1.17])
      cylinder(g, 0.032, 0.032, 1.6, P.gold, x, 0.8, -0.75, 0.4);
  }
  const batch = createStaticBatch(root);
  root.add(batch.root);
  batch.setActive(true);
  return root;
}
export function dressConceptCafe(world: World) {
  return dressBase(world, {
    palette: P,
    architecture: () => architecture(world),
    futuristic: true,
  });
}
