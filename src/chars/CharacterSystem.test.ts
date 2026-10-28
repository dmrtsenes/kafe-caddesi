import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { createAppearance } from './Appearance';
import { createOriginalCharacter } from './OriginalCharacters';
import { BALANCE, clampCustomerWalkSpeed } from '../data/balance';
import type { CharRole, WorkKind } from './types';

describe('Original Fincan characters', () => {
  it('keeps the player silhouette and palette stable across launches', () => {
    const a = createAppearance('player', { seed: 1 });
    const b = createAppearance('player', { seed: 999 });
    assert.deepEqual(a.pal, b.pal);
    assert.equal(a.hat, b.hat);
    assert.equal(a.hair, b.hair);
  });
  it('makes purchased uniforms and staff ranks visible', () => {
    for (const role of ['waiter', 'cashier', 'barista', 'busser'] as CharRole[]) {
      const a = createAppearance(role, { seed: 1, uniform: 'sokak', level: 0 });
      const b = createAppearance(role, { seed: 1, uniform: 'bakir', level: 8 });
      assert.notDeepEqual(a.pal, b.pal, role);
      assert.ok(b.stripes > a.stripes, role);
    }
  });
  it('supports movement, every work pose, carrying and sitting without broken transforms', () => {
    for (const role of ['player', 'waiter', 'cashier', 'barista', 'busser', 'customer'] as CharRole[]) {
      const c = createOriginalCharacter(role, { seed: 5 });
      assert.equal(c.root.userData.characterPack, 'fincan-original');
      for (const state of ['idle', 'walk', 'work', 'sit', 'angry', 'cheer'] as const) {
        c.setState(state);
        c.setCarryCount(state === 'walk' ? 3 : 0);
        c.setCarryMode('tray');
        for (const kind of ['reach', 'wipe', 'cash', 'machine'] as WorkKind[]) {
          c.setWorkKind(kind);
          c.setWorkPhase(0.6);
          c.setLocomotionLevel(6);
          for (let i = 0; i < 15; i++) c.update(1 / 30, state === 'walk' ? 2 : 0, 0.2);
          c.root.updateMatrixWorld(true);
          c.root.traverse((n) => assert.ok(n.matrixWorld.elements.every(Number.isFinite)));
          assert.ok(c.handMidLocal(new THREE.Vector3()).toArray().every(Number.isFinite));
        }
      }
      c.dispose();
      c.dispose();
      assert.equal(c.root.children.length, 0);
    }
  });
  it('reports a finite hand span in root space independently of world transforms', () => {
    const character = createOriginalCharacter('player', { seed: 417 });
    const group = new THREE.Group();
    group.add(character.root);
    const out = new THREE.Vector3();
    try {
      for (const pushing of [false, true]) {
        character.setPush(pushing, pushing);
        for (let frame = 0; frame < 20; frame++) character.update(1 / 30, pushing ? 1.5 : 0);
        const before = character.handSpanLocal(new THREE.Vector3());
        assert.ok(before.toArray().every(Number.isFinite));
        assert.ok(before.length() > 0.01);
        const rootPosition = character.root.position.clone();
        const rootRotation = character.root.quaternion.clone();
        const rootScale = character.root.scale.clone();
        character.root.position.set(37, 4, -81);
        character.root.rotation.set(0.2, 1.15, -0.08);
        character.root.scale.multiply(new THREE.Vector3(1.2, 0.8, 1.1));
        group.position.set(-19, 7, 28);
        group.rotation.set(-0.16, 0.41, 0.07);
        group.scale.set(0.9, 1.3, 1.1);
        assert.equal(character.handSpanLocal(out), out);
        assert.ok(out.toArray().every(Number.isFinite));
        assert.ok(out.distanceTo(before) < 1e-10);
        character.root.position.copy(rootPosition);
        character.root.quaternion.copy(rootRotation);
        character.root.scale.copy(rootScale);
        group.position.set(0, 0, 0);
        group.rotation.set(0, 0, 0);
        group.scale.set(1, 1, 1);
      }
    } finally {
      character.dispose();
    }
  });
  it('keeps customer motion at walking speed', () => {
    assert.equal(clampCustomerWalkSpeed(4.8), BALANCE.customers.walkSpeedCap);
    assert.equal(clampCustomerWalkSpeed(-1), 0);
  });
});
