import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { LOCATIONS, locationStations } from '../data/layouts';
import type { StationDef } from '../data/stations';
import type { ItemId } from '../data/items';
import {
  addPremiumBin,
  addPremiumCounter,
  addPremiumDisplay,
  addPremiumMachine,
  premiumFloorTexture,
} from './PremiumDesign';
import { createPremiumBackbar } from './PremiumArchitecture';
import { createStationVisual } from './StationView';
import { buildRig } from '../chars/CharacterRig';
import { CharacterAnimator } from '../chars/CharacterAnimator';
import { createAppearance } from '../chars/Appearance';
import { ServiceArmLayer } from '../chars/ServiceArms';

function withMockCanvas<T>(fn: () => T): T {
  const prev = globalThis.document;
  const noop = () => {};
  const makeCtx = () => ({
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'center',
    textBaseline: 'middle',
    font: '16px sans-serif',
    fillRect: noop,
    clearRect: noop,
    strokeRect: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    ellipse: noop,
    fill: noop,
    stroke: noop,
    fillText: noop,
    strokeText: noop,
    scale: noop,
    setTransform: noop,
    setLineDash: noop,
    measureText: (s: string) => ({ width: s.length * 10 }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop }),
  });
  globalThis.document = {
    createElement: () => {
      const cv = { width: 256, height: 256, getContext: () => Object.assign(makeCtx(), { canvas: cv }) };
      return cv;
    },
  } as unknown as Document;
  try {
    return fn();
  } finally {
    globalThis.document = prev;
  }
}

test('all 8 Kose and Sahil menu machines use countertop output and zero-idle-cost working VFX', () => {
  withMockCanvas(() => {
    const sahilPalette = LOCATIONS.sahil.palette;
    const allItems: ItemId[] = ['cay', 'latte', 'tost', 'waffle', 'frappe', 'smoothie', 'dondurma', 'milkshake'];
    for (const item of allItems) {
      const def: StationDef = {
        id: `test_${item}`,
        name: item,
        kind: 'machine',
        visual: item === 'smoothie' ? 'juicebar' : item === 'dondurma' ? 'icecream' : item === 'milkshake' ? 'blender' : 'espresso',
        zone: 'p1',
        x: 0,
        z: 0,
        rot: 0,
        item,
      };
      const v = createStationVisual(def, sahilPalette);
      assert.ok(v.root.getObjectByName('premiumMachine'), `${item} should build premiumMachine`);
      const out = v.root.getObjectByName('premiumMachineOutput')!;
      assert.ok(out, `${item} should have countertop output root`);
      const fx = v.root.getObjectByName('machineWorkFx')!;
      assert.ok(fx, `${item} should have working VFX root`);
      assert.equal(fx.visible, false, `${item} VFX must stay hidden when idle`);

      v.setOutput(2, 6, item);
      assert.equal(out.visible, true, `${item} countertop output shows produced items`);
      // Verify no floor-level outStack cylinder is enabled at z=1.5
      let leakedFloorStack = false;
      v.root.traverse(o => {
        const im = o as THREE.InstancedMesh;
        if (im.isInstancedMesh && o.parent?.position.z === 1.5 && im.visible) leakedFloorStack = true;
      });
      assert.equal(leakedFloorStack, false, `${item} must not show floor-level stack cylinders at barista feet`);

      v.setActive(true);
      v.update(0.25);
      assert.equal(fx.visible, true, `${item} VFX activates during production`);

      v.setActive(false);
      for (let i = 0; i < 40; i++) v.update(0.1);
      assert.equal(fx.visible, false, `${item} VFX hides completely once settled`);
      v.dispose();
    }
  });
});

test('fascia nameplates sit in front of pedestal panels and backbar jars clear rear tiles', () => {
  withMockCanvas(() => {
    const checkFrontPlate = (group: THREE.Group, minFrontZ: number, name: string) => {
      const plates: THREE.Mesh[] = [];
      group.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.isMesh && (m.material as THREE.MeshBasicMaterial).isMeshBasicMaterial && m.position.z > 0.3) {
          plates.push(m);
        }
      });
      assert.ok(plates.length >= 1, `${name} should have a front nameplate`);
      for (const p of plates) {
        assert.ok(p.position.z >= minFrontZ, `${name} plate z=${p.position.z} must clear front panel ${minFrontZ}`);
        const mat = p.material as THREE.MeshBasicMaterial;
        assert.equal(mat.toneMapped, false);
        assert.equal(mat.polygonOffset, true);
      }
    };

    const counter = new THREE.Group();
    addPremiumCounter(counter);
    checkFrontPlate(counter, 0.59, 'counter');

    const machine = new THREE.Group();
    addPremiumMachine(machine, 'smoothie');
    checkFrontPlate(machine, 0.515, 'machine');

    const closedDisplay = new THREE.Group();
    addPremiumDisplay(closedDisplay, 'waffle', 1.52, false);
    checkFrontPlate(closedDisplay, 0.515, 'closedDisplay');

    const openDisplay = new THREE.Group();
    addPremiumDisplay(openDisplay, 'smoothie', 1.52, true);
    checkFrontPlate(openDisplay, 0.515, 'openDisplay');

    const bin = new THREE.Group();
    addPremiumBin(bin);
    checkFrontPlate(bin, 0.382, 'bin');

    const backbar = createPremiumBackbar();
    backbar.updateMatrixWorld(true);
    let minJarBackZ = Infinity;
    backbar.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.scale.z > 2) {
        const box = new THREE.Box3().setFromObject(m);
        minJarBackZ = Math.min(minJarBackZ, box.min.z);
      }
    });
    // Rear backsplash tiles sit at z = -11.37 (front face -11.3475).
    assert.ok(minJarBackZ > -11.34, `backbar jars (${minJarBackZ}) must not clip rear tiles (-11.3475)`);

    // Floor canvas cache reuses painted source canvas per kind.
    const t1 = premiumFloorTexture('oak');
    const t2 = premiumFloorTexture('oak');
    assert.equal(t1.image, t2.image);
    t1.dispose();
    t2.dispose();
  });
});

test('cover tint preserves BatchedPBR vertexColors/shaders and tableCodeStand contacts tabletop', () => {
  withMockCanvas(() => {
    const kose = LOCATIONS.kose;
    const tableDef = locationStations('kose').find(s => s.kind === 'table' && s.serviceCode)!;
    const tv = createStationVisual(tableDef, kose.palette);
    tv.root.updateMatrixWorld(true);

    const stand = tv.root.getObjectByName('tableCodeStand');
    assert.ok(stand, 'tableCodeStand node preserved for surface verification');
    const sb = new THREE.Box3().setFromObject(stand);
    assert.ok(Math.abs(sb.min.y - tv.root.position.y - 1) < 1e-4, `code stand sits on tabletop y=1 (got ${sb.min.y})`);

    tv.setLocked(true, false, true);
    let sawBatchedLocked = false;
    let sawMappedLocked = false;
    tv.root.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible) return;
      const sm = m.material as THREE.MeshStandardMaterial;
      if (!sm.isMeshStandardMaterial) return;
      if (m.geometry.getAttribute('batchSurface')) {
        assert.equal(sm.vertexColors, true, 'locked BatchedPBR must retain vertexColors');
        assert.notEqual(sm.onBeforeCompile, THREE.Material.prototype.onBeforeCompile, 'locked BatchedPBR must retain custom shader');
        sawBatchedLocked = true;
      }
      if (sm.map) sawMappedLocked = true;
    });
    assert.equal(sawBatchedLocked, true);
    assert.equal(sawMappedLocked, true);
    tv.dispose();
  });
});

test('CharacterAnimator and ServiceArmLayer remain finite under NaN/Infinity inputs', () => {
  const spec = createAppearance('player', { seed: 7 });
  const rig = buildRig(spec);
  const anim = new CharacterAnimator(rig, spec);
  anim.setCarryCount(2);
  anim.setCarryMode('tray');
  anim.update(Number.NaN, Number.NaN, Number.NaN);
  anim.update(Number.POSITIVE_INFINITY, -5, Number.NEGATIVE_INFINITY);
  anim.update(0.016, 3.2, 1.1);
  rig.root.updateMatrixWorld(true);
  rig.root.traverse(o => {
    for (const el of o.matrixWorld.elements) {
      assert.ok(Number.isFinite(el), `non-finite matrix element on ${o.name || o.type}`);
    }
  });
  anim.dispose();

  const actor = new THREE.Group();
  const model = new THREE.Group();
  actor.add(model);
  for (const side of ['Left', 'Right'] as const) {
    const sgn = side === 'Left' ? 1 : -1;
    const sh = new THREE.Object3D(); sh.name = `mixamorig${side}Shoulder`; sh.position.set(sgn * 0.1, 1.3, 0);
    const up = new THREE.Object3D(); up.name = `mixamorig${side}Arm`; up.position.set(sgn * 0.12, 0, 0);
    const lo = new THREE.Object3D(); lo.name = `mixamorig${side}ForeArm`; lo.position.set(0, -0.24, 0);
    const wr = new THREE.Object3D(); wr.name = `mixamorig${side}Hand`; wr.position.set(0, -0.22, 0);
    sh.add(up); up.add(lo); lo.add(wr); model.add(sh);
  }
  const idle = new THREE.AnimationClip('idle', 1, []);
  const layer = new ServiceArmLayer(model, actor, 1.6, idle);
  layer.apply(Number.NaN, true, false, Number.NaN, 'generic', Number.NaN);
  layer.apply(1, false, true, Number.NaN, 'wipe', Number.NaN);
  actor.updateMatrixWorld(true);
  actor.traverse(o => {
    for (const el of o.matrixWorld.elements) {
      assert.ok(Number.isFinite(el), `non-finite IK matrix element on ${o.name || o.type}`);
    }
  });
});
