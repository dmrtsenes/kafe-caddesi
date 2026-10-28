import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { floorOffset, scaleToFitHeight, scaleToFitXZ } from './fit.ts';

describe('pack fit', () => {
  it('scales xz to the larger horizontal axis', () => {
    assert.equal(scaleToFitXZ({ x: 2, y: 1, z: 1 }, 1.5), 0.75);
  });

  it('rejects empty size', () => {
    assert.equal(scaleToFitXZ({ x: 0, y: 1, z: 0 }, 1.5), 1);
    assert.equal(scaleToFitHeight({ x: 1, y: 0, z: 1 }, 0.9), 1);
  });

  it('sits the scaled box on the floor and centers xz', () => {
    const off = floorOffset({ x: -1, y: -0.5, z: -2 }, { x: 3, y: 1.5, z: 2 }, 0.5);
    assert.equal(off.x, -0.5);
    assert.equal(off.y, 0.25);
    assert.equal(off.z + 0, 0);
  });
});
