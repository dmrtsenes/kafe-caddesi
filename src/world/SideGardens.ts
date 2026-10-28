import * as THREE from 'three';
import type { LocationDef } from '../data/layouts';
import { RESTROOM_SUITE } from '../data/restrooms';
import { SIDE_COURTYARD, SIDE_GARDEN_LAYOUT, SIDE_GARDEN_SECTIONS, sideGardenCurbs } from '../data/sideGardenLayout';
import { markDynamic } from './layers';
import { box, cyl, mat, mesh, plane, roundBox, sph, torus } from './Materials';

/**
 * Landscaped wings north of the side rooms, with gated cafe workbenches.
 * Gameplay progress is supplied by World; these meshes share physical
 * footprints with sideGardenLayout. All resources use shared caches;
 * the environment static batch handles the opaque, motionless architecture.
 */
export function createSideGardens(loc: LocationDef): THREE.Group {
  const root = new THREE.Group();
  root.name = 'sideConservatories';
  if (loc.id !== 'kose' || !loc.partitions?.length) return root;

  const stone = mat(0xd8d5c2, { rough: 0.92 });
  const edge = mat(0xb5b49f, { rough: 0.88 });
  const paving = mat(0xc0beaa, { rough: 0.96 });
  const gravel = mat(0x9a9b80, { rough: 1 });
  const soil = mat(0x574b3d, { rough: 1 });
  const wood = mat(0xa7774f, { rough: 0.82 });
  const bark = mat(0x6e5740, { rough: 0.96 });
  const iron = mat(0x354d42, { rough: 0.6, metal: 0.25 });
  const bronze = mat(0xb39762, { rough: 0.47, metal: 0.45 });
  const sage = mat(0x8f9e83, { rough: 0.97 });
  const clay = mat(0xad7d62, { rough: 0.94 });
  const leaf = mat(0x597149, { rough: 0.94, flatShading: true });
  const youngLeaf = mat(0x829660, { rough: 0.94, flatShading: true });
  const oliveLeaf = mat(0x9aa978, { rough: 0.94, flatShading: true });
  const terra = mat(0xc28363, { rough: 0.95 });
  const blossom = mat(0xdaaa8f, { rough: 0.94, flatShading: true });
  const water = mat(0x518d83, { rough: 0.28, metal: 0.15 });
  const waterLight = mat(0x82b2a2, { rough: 0.4, metal: 0.12 });

  const unitBox = box(1, 1, 1);
  const leafGeo = sph(1, 8, 6);
  const unitCylinder = cyl(1, 1, 1, 10);

  function block(g: THREE.Group, m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, shadow = true): THREE.Mesh {
    const part = mesh(unitBox, m, x, y, z);
    part.scale.set(w, h, d);
    part.castShadow = shadow;
    g.add(part);
    return part;
  }

  function clump(g: THREE.Group, m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, turn = 0): void {
    const part = mesh(leafGeo, m, x, y, z);
    part.scale.set(w, h, d);
    part.rotation.y = turn;
    g.add(part);
  }

  function post(g: THREE.Group, m: THREE.Material, x: number, y: number, z: number, radius: number, h: number): void {
    const part = mesh(unitCylinder, m, x, y, z);
    part.scale.set(radius, h, radius);
    g.add(part);
  }

  /** Three overlapping canopies give each olive a compact irregular silhouette. */
  function olive(g: THREE.Group, x: number, z: number, seed: number, scale = 1): void {
    post(g, bark, x, 0.4 + 0.7 * scale, z, 0.11 * scale, 1.4 * scale);
    for (let i = 0; i < 3; i++) {
      const a = seed + i * 2.1;
      const branch = mesh(unitCylinder, bark, x + Math.cos(a) * 0.19, 1.54 * scale, z + Math.sin(a) * 0.19);
      branch.scale.set(0.065, 0.68 * scale, 0.065);
      branch.rotation.z = Math.cos(a) * 0.6;
      branch.rotation.x = Math.sin(a) * 0.6;
      g.add(branch);
      clump(g, i === 1 ? oliveLeaf : leaf, x + Math.cos(a) * 0.43 * scale, (2.1 + (i === 1 ? 0.28 : 0)) * scale,
        z + Math.sin(a) * 0.43 * scale, 0.82 * scale, 0.67 * scale, 0.75 * scale, a);
    }
  }

  function bed(g: THREE.Group, x: number, z: number, w: number, d: number): void {
    g.add(mesh(roundBox(w, 0.34, d, 0.1, 1), edge, x, 0.235, z));
    block(g, soil, x, 0.428, z, w - 0.2, 0.022, d - 0.2, false);
  }

  function herbs(g: THREE.Group, x: number, z: number, length: number, seed: number): void {
    for (let i = 0; i < 5; i++) {
      const zz = z + (i / 4 - 0.5) * length;
      const offset = Math.sin(i * 2.2 + seed) * 0.12;
      clump(g, i % 2 ? youngLeaf : leaf, x + offset, 0.74 + (i % 3) * 0.06, zz, 0.43, 0.33 + (i % 2) * 0.08, 0.48, seed + i);
      if (i % 2 === 0) clump(g, oliveLeaf, x + 0.26, 0.79, zz + 0.17, 0.26, 0.23, 0.27, seed + i);
    }
  }

  /** Back toward the garden, face toward the cafe; no table/order cues. */
  function bench(g: THREE.Group, x: number, z: number, face: number): void {
    const seat = new THREE.Group();
    seat.position.set(x, 0, z);
    seat.rotation.y = face;
    g.add(seat);
    for (const xx of [-1.07, 1.07]) {
      // Raise legs slightly so bottom face (y≈0.10) clears paving top (≈0.028).
      block(seat, iron, xx, 0.36, 0, 0.095, 0.62, 0.73);
      block(seat, iron, xx, 0.78, -0.32, 0.075, 0.66, 0.085);
      block(seat, bronze, xx, 0.84, 0.03, 0.075, 0.06, 0.65);
    }
    for (let i = 0; i < 4; i++) block(seat, wood, 0, 0.58, -0.27 + i * 0.18, 2.35, 0.085, 0.14);
    for (let i = 0; i < 3; i++) {
      const slat = block(seat, wood, 0, 0.77 + i * 0.15, -0.35 - i * 0.015, 2.35, 0.12, 0.065);
      slat.rotation.x = -0.1;
    }
  }

  function flowerBowl(g: THREE.Group, x: number, z: number, seed: number): void {
    const bedLift = 0.34;
    g.add(mesh(cyl(0.46, 0.3, 0.36, 12), terra, x, 0.26 + bedLift, z));
    const lip = mesh(torus(0.435, 0.045, 4, 12), terra, x, 0.445 + bedLift, z);
    lip.rotation.x = Math.PI / 2;
    g.add(lip);
    for (let i = 0; i < 5; i++) {
      const a = seed + i * 1.257;
      const xx = x + Math.cos(a) * 0.21;
      const zz = z + Math.sin(a) * 0.21;
      clump(g, youngLeaf, xx, 0.55 + bedLift, zz, 0.21, 0.18, 0.19, a);
      clump(g, blossom, xx, 0.71 + bedLift, zz, 0.14, 0.105, 0.14, a);
    }
  }

  function shell(name: string, sign: -1 | 1): THREE.Group {
    const g = new THREE.Group();
    g.name = name;
    root.add(g);
    // Paving sits just below the main floor plane (y centre = 0.001) so its
    // top face (≈0.027) never competes with the bench feet or edge strips.
    // Previously at y=0.052 it was co-planar with iron legs → Z-fighting.
    block(g, paving, sign * 13.3, 0.001, -4.15, 8, 0.054, 26.7, false);
    for (const curb of sideGardenCurbs(sign)) {
      block(g, stone, (curb.x0 + curb.x1) / 2, 0.19, (curb.z0 + curb.z1) / 2,
        curb.x1 - curb.x0, 0.26, curb.z1 - curb.z0);
    }
    // Edge grout lines sit clearly above the paving top face (≈0.027).
    for (let i = 1; i < 15; i++) {
      block(g, edge, sign * 13.3, 0.044, -17.5 + i * 1.78, 7.6, 0.008, 0.025, false);
    }
    return g;
  }

  const left = shell('garden_left_olive', -1);
  const right = shell('garden_right_reflection', 1);
  const sections = SIDE_GARDEN_SECTIONS;
  // Quiet continuous stone ribbons distinguish the two usable pool walks.
  for (const x of [SIDE_COURTYARD.innerWalkX, SIDE_COURTYARD.outerWalkX]) {
    block(right, stone, x, 0.094, -4.15, 0.7, 0.018, 25.7, false);
  }

  sections.forEach((z, i) => {
    // A paved ribbon separates cafe-facing seats from substantial planted
    // islands. The high canopies stay at the outer windows, away from play.
    block(left, stone, -11.08, 0.093, z, 2.84, 0.025, 7.35, false);
    bench(left, -10.96, z, Math.PI / 2);
    bed(left, -14.7, z, 3.95, 6.25);
    block(left, gravel, -14.7, 0.458, z, 3.65, 0.014, 5.95, false);
    olive(left, -15.26, z - 0.86, i * 1.83 + 0.4, i === 1 ? 1.03 : 0.95);
    herbs(left, -13.62, z + 0.24, 4.25, i * 1.3);
    herbs(left, -15.76, z + 1.55, 1.5, i + 0.8);
    // Pots belong to the raised bed; the entire bench approach remains walkable.
    flowerBowl(left, -13.35, z + 2.52, i);
    flowerBowl(left, -16.05, z - 2.48, i + 1);
    block(left, bronze, -11.08, 0.113, z + 3.78, 2.8, 0.017, 0.065, false);

    if (z < RESTROOM_SUITE.z1) return;
    // Opaque stylised water needs no animation, sorting, refraction or extra
    // reflection render pass; the raised stone rim makes the shallow basin read.
    const pool = SIDE_COURTYARD.pool;
    const px = pool.x, halfW = pool.width / 2, halfD = pool.depth / 2;
    // A real open basin: its raised border never crosses the planar water.
    // Large shallow roundBox meshes can form long sloping triangles, which
    // intersect another near-coplanar rounded mesh as cream diagonal wedges.
    block(right, edge, px, 0.145, z, pool.width, 0.13, pool.depth);
    for (const side of [-1, 1]) {
      block(right, stone, px + side * (halfW - pool.rim / 2), 0.345, z, pool.rim, 0.3, pool.depth);
      block(right, stone, px, 0.345, z + side * (halfD - pool.rim / 2), pool.width - pool.rim * 2, 0.3, pool.rim);
    }
    const surface = mesh(plane(pool.width - pool.rim * 2 - 0.04, pool.depth - pool.rim * 2 - 0.04), water, px, 0.332, z);
    surface.rotation.x = -Math.PI / 2;
    surface.castShadow = false;
    right.add(surface);
    if (i === 1) {
      // One low stone water bowl gives the sequence a focal bay. Its bronze
      // neck and lip share the benches' accents, with no moving water effect.
      const bowl = new THREE.Group();
      bowl.name = 'garden_reflection_bowl';
      bowl.position.set(px, 0, z);
      right.add(bowl);
      bowl.add(mesh(cyl(0.17, 0.32, 0.52, 12), bronze, 0, 0.57, 0));
      bowl.add(mesh(cyl(0.76, 0.5, 0.23, 16), stone, 0, 0.855, 0));
      const rim = mesh(torus(0.716, 0.043, 4, 20), bronze, 0, 0.991, 0);
      rim.rotation.x = Math.PI / 2;
      bowl.add(rim);
      const stillWater = mesh(cyl(0.67, 0.67, 0.008, 20), water, 0, 0.977, 0);
      stillWater.castShadow = false;
      bowl.add(stillWater);
    } else {
      for (let step = 0; step < 3; step++) {
        const sz = z - 1.86 + step * 1.86;
        const sx = px + (step % 2 ? 0.35 : -0.35);
        const island = mesh(box(1.36, 0.3, 0.88), stone, sx, 0.372, sz);
        island.rotation.y = (step - 1) * 0.08;
        right.add(island);
      }
    }
    for (let j = 0; j < 3; j++) {
      const mark = block(right, waterLight, px + (j % 2 ? 1.15 : -1.03), 0.336, z - 2.5 + j * 2.36, 0.43, 0.006, 0.045, false);
      mark.rotation.y = 0.2;
    }
    const planting = SIDE_COURTYARD.planting;
    bed(right, planting.x, z, planting.width, planting.depth);
    herbs(right, planting.x - 0.18, z + 0.08, 4.25, i + 2);
    olive(right, planting.x + 0.17, z - 1.53, i * 1.31 + 2.7, 0.81);
    flowerBowl(right, planting.x, z + 2.45, i + 2);
    // Cedar landings rhythmically separate the pools, within the north-room line.
    for (let j = 0; j < 6; j++) {
      block(right, wood, px, 0.103, z + 3.5 + j * 0.145, pool.width + 0.02, 0.05, 0.115);
    }
    block(right, bronze, px, 0.13, z + 3.45, pool.width + 0.03, 0.015, 0.055, false);
  });

  for (const layout of Object.values(SIDE_GARDEN_LAYOUT)) {
    const wing = layout.sign < 0 ? left : right;
    // A threshold and woven service mat connect the paid doorway to its work.
    // These are flush floor details, with no new collision or purchase affordance.
    const thresholdX = layout.sign * 10.28;
    block(wing, stone, thresholdX, 0.095, layout.service.z, 1.76, 0.02, 1.56, false);
    for (const side of [-1, 1]) {
      block(wing, bronze, thresholdX, 0.109, layout.service.z + side * 0.72, 1.76, 0.012, 0.045, false);
    }
    block(wing, bronze, layout.service.x, 0.108, layout.service.z, 1.12, 0.025, 1.72, false);
    block(wing, layout.id === 'garden' ? sage : clay, layout.service.x, 0.124, layout.service.z, 1.04, 0.012, 1.64, false);
    for (let stripe = -3; stripe <= 3; stripe++) {
      block(wing, stone, layout.service.x + layout.sign * 0.39, 0.133, layout.service.z + stripe * 0.2, 0.032, 0.005, 0.08, false);
    }
    const station = new THREE.Group();
    station.name = 'sideBench_' + layout.id;
    station.position.set(layout.bench.x, 0, layout.bench.z);
    station.rotation.y = -layout.sign * Math.PI / 2;
    wing.add(station);
    block(station, layout.id === 'garden' ? iron : clay, 0, 0.515, 0, 1.48, 0.8, 0.72);
    block(station, bronze, 0, 0.16, 0, 1.5, 0.065, 0.76);
    block(station, stone, 0, 0.99, 0, 1.6, 0.12, 0.9);
    for (let slat = 0; slat < 8; slat++) {
      block(station, wood, -0.63 + slat * 0.18, 0.53, 0.385, 0.13, 0.63, 0.055);
    }
    block(station, bronze, 0, 0.79, 0.425, 0.29, 0.045, 0.04);
    block(station, wood, -0.3, 1.077, 0.06, 0.7, 0.05, 0.48);
    block(station, bronze, -0.3, 1.106, -0.16, 0.7, 0.023, 0.04);
    for (const xx of [0.31, 0.54]) {
      station.add(mesh(cyl(0.076, 0.059, 0.15, 8), stone, xx, 1.128, -0.15));
      station.add(mesh(cyl(0.061, 0.061, 0.009, 8), bark, xx, 1.207, -0.15));
    }

    for (const level of [2, 3, 4]) {
      const upgrade = new THREE.Group();
      upgrade.name = 'sideLevel_' + layout.id + '_' + level;
      if (level === 2) {
        for (const xx of [-0.67, 0.67]) block(upgrade, bronze, xx, 1.24, -0.33, 0.045, 0.43, 0.045);
        block(upgrade, wood, 0, 1.45, -0.3, 1.44, 0.065, 0.22);
      } else if (level === 3) {
        for (let jar = 0; jar < 3; jar++) {
          const xx = -0.32 + jar * 0.3;
          upgrade.add(mesh(cyl(0.09, 0.09, 0.2, 10), jar % 2 ? terra : stone, xx, 1.582, -0.3));
          upgrade.add(mesh(cyl(0.1, 0.1, 0.045, 10), wood, xx, 1.704, -0.3));
        }
      } else {
        for (const xx of [-0.72, 0.72]) block(upgrade, bronze, xx, 1.43, -0.34, 0.055, 1.1, 0.055);
        block(upgrade, iron, 0, 1.98, -0.015, 1.6, 0.09, 0.86);
        block(upgrade, bronze, 0, 1.923, 0.39, 1.6, 0.035, 0.055);
      }
      upgrade.visible = false;
      markDynamic(upgrade);
      station.add(upgrade);
    }

    const gate = new THREE.Group();
    gate.name = 'sideGate_' + layout.id;
    gate.position.set(layout.sign * 9, 0, layout.bench.z);
    gate.rotation.y = -layout.sign * Math.PI / 2;
    wing.add(gate);
    for (const xx of [-0.985, 0.985]) block(gate, iron, xx, 0.54, 0, 0.11, 1.08, 0.18);
    block(gate, wood, 0, 0.57, 0, 1.88, 0.58, 0.13);
    block(gate, bronze, 0, 0.905, 0, 2.05, 0.06, 0.19);
    block(gate, iron, 0, 0.58, 0.086, 0.37, 0.31, 0.05);
    block(gate, bronze, 0, 0.58, 0.121, 0.19, 0.2, 0.055);
    markDynamic(gate);
  }
  return root;
}



