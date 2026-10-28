import assert from 'node:assert/strict';
import { it } from 'node:test';
import * as THREE from 'three';
import { addWorkwearRegions, FINCAN_PLAYER_WORKWEAR, roleWorkwear, workwearRegion } from './Workwear';
import { createAppearance } from './Appearance';
import { UNIFORM_SKINS } from '../data/cosmetics';
import { addCustomerCloth, addSignatureWardrobe, customerLook } from './SignatureWardrobe';

it('masks only verified clothing UV regions and never masks skin or hair', () => {
  const samples: [string, number, number, number][] = [
    ['P_Shirt', 0.69189, 0.96484, 1],
    ['P_Shirt', 0.45020, 0.96777, 2],
    ['P_Shirt', 0.45020, 0.97119, 2],
    ['hatWorker', 0.90137, 0.90918, 3],
    ['hatWorker', 0.51465, 0.90137, 4],
    ['P_Pants', 0.90918, 0.91406, 5],
    ['P_Shoes', 0.45459, 0.97070, 6],
    ['Player_Workers', 0.39478, 0.90869, 0],
    ['HairCustomer04', 0.03247, 0.90186, 0],
  ];
  for (const [mesh, u, v, channel] of samples) {
    assert.equal(workwearRegion(mesh, u, v), channel, mesh);
    // Colors shared by two meshes must not become global palette replacements.
    assert.equal(workwearRegion('Player_Workers', u, v), 0);
    assert.equal(workwearRegion('HairCustomer04', u, v), 0);
  }
  assert.equal(workwearRegion('P_Shirt', 0.1, 0.1), 0);
  assert.equal(workwearRegion('hatWorker', 0.1, 0.1), 0);
});

it('adds the cloth channel without changing source UV, geometry or skin weights', () => {
  const geometry = new THREE.BufferGeometry();
  const attributes = {
    position: new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3),
    uv: new THREE.BufferAttribute(new Float32Array([0.69189, 0.96484, 0.4502, 0.96777, 0.1, 0.1]), 2),
    skinIndex: new THREE.BufferAttribute(new Uint16Array([0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0]), 4),
    skinWeight: new THREE.BufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 4),
  };
  for (const [name, attribute] of Object.entries(attributes)) geometry.setAttribute(name, attribute);
  const values = Object.fromEntries(Object.entries(attributes).map(([name, attr]) => [name, Array.from(attr.array)]));
  addWorkwearRegions('P_Shirt', geometry);
  assert.deepEqual(Array.from(geometry.attributes.fincanCloth.array), [1, 2, 0]);
  for (const [name, attribute] of Object.entries(attributes)) {
    assert.equal(geometry.getAttribute(name), attribute);
    assert.deepEqual(Array.from(attribute.array), values[name]);
  }
  geometry.dispose();
});

it('keeps Fincan player identity intact while matching the preview clothing palette', () => {
  const appearance = createAppearance('player', { seed: 417 });
  assert.equal(appearance.pal.skin, 0xf1c39a);
  assert.equal(appearance.pal.face, 0xf1c39a);
  assert.equal(appearance.pal.hair, 0x33231b);
  assert.equal(appearance.pal.brow, 0x2a1c15);
  assert.equal(appearance.pal.eye, 0x1b1712);
  assert.equal(appearance.pal.mouth, 0x7a3b34);
  assert.equal(appearance.pal.forearm, appearance.pal.skin);
  assert.equal(appearance.pal.shirt, FINCAN_PLAYER_WORKWEAR.main);
  assert.equal(appearance.pal.sleeve, FINCAN_PLAYER_WORKWEAR.edge);
  assert.equal(appearance.pal.accent, FINCAN_PLAYER_WORKWEAR.badge);
  assert.equal(appearance.pal.pants, FINCAN_PLAYER_WORKWEAR.pants);
  assert.equal(appearance.pal.shoe, FINCAN_PLAYER_WORKWEAR.shoes);
});

it('preserves staff role distinction and purchased uniform colors without recoloring faces', () => {
  const roles = ['waiter', 'cashier', 'barista', 'busser'] as const;
  const defaults = roles.map((role) => roleWorkwear(role, createAppearance(role, { seed: 417 }).pal));
  assert.equal(new Set(defaults.map((palette) => palette.main)).size, roles.length);
  for (const role of roles) {
    const base = createAppearance(role, { seed: 417, uniform: 'sokak' });
    for (const uniform of UNIFORM_SKINS.filter((skin) => skin.house !== null)) {
      const selected = createAppearance(role, { seed: 417, uniform: uniform.id });
      assert.notDeepEqual(roleWorkwear(role, selected.pal), roleWorkwear(role, base.pal), role + ':' + uniform.id);
      for (const part of ['skin', 'face', 'hair', 'brow', 'eye', 'mouth'] as const) assert.equal(selected.pal[part], base.pal[part]);
    }
  }
});

it('gives customers eight repeatable outfit combinations without unbounded random materials', () => {
  const looks = Array.from({ length: 8 }, (_, seed) => customerLook(seed));
  assert.equal(new Set(looks.map(l => JSON.stringify(l.palette))).size, 8);
  for (let seed = 0; seed < 1024; seed++) {
    assert.deepEqual(customerLook(seed), customerLook(seed + 8));
    assert.ok([0, 1, 2].includes(customerLook(seed).pattern));
  }
});

it('keeps customer faces unpainted while adding independently colored clothing', () => {
  for (const name of ['Customers', 'A_Shirt01', 'A_Shirt02', 'A_Pants01', 'HatCustomer01', 'HairCustomer01']) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, .05, 0, 0, .5, 0, 0, .9, 0], 3));
    const uv = new THREE.Float32BufferAttribute([.2, .3, .4, .5, .6, .7], 2);
    geometry.setAttribute('uv', uv);
    const mesh = new THREE.Mesh(geometry); mesh.name = name; mesh.updateMatrixWorld(true);
    addCustomerCloth(mesh, 1);
    const expected = name === 'Customers' ? [0, 0, 0] : name.startsWith('A_Shirt') ? [1, 1, 1]
      : name === 'A_Pants01' ? [6, 5, 5] : name === 'HatCustomer01' ? [3, 3, 3] : [9, 9, 9];
    assert.deepEqual(Array.from(geometry.attributes.fincanCloth.array), expected, name);
    assert.equal(geometry.attributes.uv, uv);
    assert.deepEqual(Array.from(geometry.attributes.fincanPattern.array), Array.from(new Float32Array([0, .05, 0, .5, 0, .9])));
    geometry.dispose();
  }
});

it('builds signature wardrobe without rear crossed X straps on the back', () => {
  const expectedPieces = { player: 20, barista: 20, waiter: 20, busser: 20, runner: 17, cashier: 16 } as const;
  const material = new THREE.MeshBasicMaterial();
  const center = new THREE.Vector3();
  for (const [role, count] of Object.entries(expectedPieces) as [keyof typeof expectedPieces, number][]) {
    const scene = new THREE.Group();
    for (const name of ['mixamorigHips', 'mixamorigSpine2', 'mixamorigHead']) {
      const bone = new THREE.Bone();
      bone.name = name;
      scene.add(bone);
    }
    addSignatureWardrobe(scene, role, 1, material);
    assert.equal(scene.userData.signaturePieces, count, role);
    scene.traverse((obj) => {
      if (!obj.userData.signatureGarment) return;
      const mesh = obj as THREE.Mesh;
      mesh.geometry.computeBoundingBox();
      mesh.geometry.boundingBox!.getCenter(center).applyMatrix4(mesh.matrixWorld);
      assert.ok(center.z > 0, `${role} garment must stay on front side (z=${center.z})`);
      mesh.geometry.dispose();
    });
  }
  material.dispose();
});
