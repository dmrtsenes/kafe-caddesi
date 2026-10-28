/** Filming-only interior; live products, actors and station interactions stay in World. */
import * as T from "three";
import {premiumFloorTexture} from "../world/PremiumDesign";
import {
  installConceptLayout as baseLayout,
  dressConceptCafe as baseDress,
} from "./FlagshipCafe";
import { createStaticBatch } from "../world/staticBatch";
import type { World } from "../sim/World";

const plants = [-8.65, 8.65].flatMap((x) => [1.7, 11.4].map((z) => ({ x, z })));
export function installConceptLayout() {
  const loc = baseLayout();
  loc.partitions = [
    ...(loc.partitions ?? []),
    ...plants.map((p) => ({
      x0: p.x - 0.43,
      x1: p.x + 0.43,
      z0: p.z - 0.43,
      z1: p.z + 0.43,
    })),
  ];
  return loc;
}
export function dressConceptCafe(world: World) {
  const base = baseDress(world),
    root = new T.Group();
  root.name = "premiumInterior";
  const mats = new Map<number, T.MeshStandardMaterial>();
  const mat = (color: number) => {
    if (!mats.has(color))
      mats.set(color, new T.MeshStandardMaterial({ color, roughness: 0.62 }));
    return mats.get(color)!;
  };
  const mesh = (
    geo: T.BufferGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
  ) => {
    const o = new T.Mesh(geo, mat(color));
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    root.add(o);
    return o;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    c: number,
    x: number,
    y: number,
    z: number,
  ) => mesh(new T.BoxGeometry(w, h, d), c, x, y, z);
  const cyl = (
    r: number,
    h: number,
    c: number,
    x: number,
    y: number,
    z: number,
  ) => mesh(new T.CylinderGeometry(r, r, h, 20), c, x, y, z);
  // Continuous materials bind the room together; no floating individual floor mats.
  for (const f of [
    { z: 1.38, d: 13.45, kind: "stone" as const },
    { z: 11.22, d: 6.03, kind: "oak" as const },
  ]) {
    const o = mesh(new T.PlaneGeometry(18.66, f.d), 0xffffff, 0, 0.045, f.z);
    o.rotation.x = -Math.PI / 2;
    o.castShadow = false;
    o.material = new T.MeshStandardMaterial({
      map: premiumFloorTexture(f.kind),
      roughness: 0.76,
    });
  }
  box(18.65, 0.025, 0.065, 0xd4af67, 0, 0.062, 8.2);
  for (const x of [-9.17, 9.17])
    box(0.05, 0.025, 19.35, 0x526f61, x, 0.063, 4.56);
  // A real blocked planter footprint keeps the existing pathfinder honest.
  for (const p of plants) {
    box(0.82, 0.62, 0.82, 0xede8db, p.x, 0.31, p.z);
    box(0.85, 0.05, 0.85, 0xb79459, p.x, 0.63, p.z);
    box(0.73, 0.03, 0.73, 0x4b5139, p.x, 0.66, p.z);
    cyl(0.055, 1.13, 0x755a3c, p.x, 1.2, p.z);
    for (let n = 0; n < 16; n++) {
      const a = n * 2.399,
        r = 0.25 + (n % 3) * 0.08;
      const o = mesh(
        new T.SphereGeometry(0.3, 10, 7),
        n % 3 === 0 ? 0x708f4e : 0x365e43,
        p.x + Math.cos(a) * r,
        1.08 + (n % 5) * 0.16,
        p.z + Math.sin(a) * r,
      );
      o.scale.set(0.55, 1.15, 0.8);
      o.rotation.z = Math.cos(a) * 0.7;
    }
  }
  // Decorative objects live on the already-blocked back counter, never on walkways.
  for (const x of [-8.55, -4.85, -1.2, 2.25, 5.7, 8.55]) {
    box(0.88, 0.05, 0.47, 0x725338, x, 1.15, -10.48);
    for (let n = 0; n < 3; n++) {
      const px = x - 0.27 + n * 0.27;
      cyl(
        0.105,
        0.28 + n * 0.055,
        n % 2 ? 0xd2bf92 : 0x596f56,
        px,
        1.3 + n * 0.027,
        -10.49,
      );
      cyl(0.11, 0.037, 0x343d34, px, 1.455 + n * 0.055, -10.49);
    }
  }
  // Arched lights sit above their own table footprint, outside actor silhouettes.
  for (const t of world.tables.filter((t) => t.z > 9 && t.id !== "k_masa_8")) {
    const g = new T.Group();
    g.position.set(t.x, 0, t.z);
    root.add(g);
    const stem = new T.Mesh(
      new T.CylinderGeometry(0.025, 0.025, 3.8, 8),
      mat(0x34453b),
    );
    stem.position.set(0.9, 1.9, 0.8);
    g.add(stem);
    const arm = new T.Mesh(
      new T.BoxGeometry(0.95, 0.035, 0.035),
      mat(0xb79459),
    );
    arm.position.set(0.45, 3.78, 0.8);
    g.add(arm);
    const shade = new T.Mesh(
      new T.SphereGeometry(0.32, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(0xe4d2a2),
    );
    shade.position.set(0, 3.68, 0.8);
    g.add(shade);
    const bulb = new T.Mesh(
      new T.CircleGeometry(0.29, 20),
      new T.MeshBasicMaterial({ color: 0xffe1a1, side: T.DoubleSide }),
    );
    bulb.rotation.x = Math.PI / 2;
    bulb.position.set(0, 3.68, 0.8);
    g.add(bulb);
  }
  // Small coffee art panels are attached to the existing side wall.
  for (const x of [-9.44, 9.44])
    for (const z of [1.7, 6.5, 11.4]) {
      box(0.055, 1.22, 1.0, 0xc1a063, x, 1.69, z);
      box(0.06, 1.1, 0.88, 0xe4dbc5, x + (x < 0 ? 0.04 : -0.04), 1.69, z);
      const motif = mesh(
        new T.CircleGeometry(0.25, 32),
        0x6e8c6b,
        x + (x < 0 ? 0.077 : -0.077),
        1.71,
        z,
      );
      motif.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  // Street furniture adds scale to the room reveal, without extending the playable floor.
  for (const x of [-11.35, 11.35])
    for (const z of [-3, 2]) {
      box(1.05, 0.12, 2.3, 0x946e49, x, 0.3, z);
      for (const dz of [-0.8, 0.8])
        box(0.08, 0.7, 0.08, 0x354339, x, 0.0, z + dz);
    }
  const batch = createStaticBatch(root);
  root.add(batch.root);
  batch.setActive(true);
  base.root.add(root);
  return base;
}
