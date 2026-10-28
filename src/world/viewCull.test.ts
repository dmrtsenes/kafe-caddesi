import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  pointInView,
  sphereHitsFrustum,
  boxHitsFrustum,
  box2DHitsFrustum,
  extractCullPlanes,
  extractCullPlanesFromMatrix,
  FrustumCuller,
  type CullPlane,
} from './viewCull.ts';

const box: CullPlane[] = [
  { nx: 1, ny: 0, nz: 0, constant: 8 },
  { nx: -1, ny: 0, nz: 0, constant: 8 },
  { nx: 0, ny: 1, nz: 0, constant: 8 },
  { nx: 0, ny: -1, nz: 0, constant: 8 },
  { nx: 0, ny: 0, nz: 1, constant: 8 },
  { nx: 0, ny: 0, nz: -1, constant: 8 },
];

describe('sphereHitsFrustum', () => {
  it('accepts a sphere at the origin of a surrounding box', () => {
    assert.equal(sphereHitsFrustum(0, 1, 0, 0.7, box), true);
  });

  it('rejects a sphere well outside the box', () => {
    assert.equal(sphereHitsFrustum(20, 1, 0, 0.7, box), false);
    assert.equal(sphereHitsFrustum(0, 1, -20, 0.7, box), false);
  });
});

describe('pointInView', () => {
  it('treats a character at the origin as inside', () => {
    assert.equal(pointInView(0, 0, box, 0.7), true);
  });

  it('treats a far character as outside', () => {
    assert.equal(pointInView(40, 40, box, 0.7), false);
  });
});

describe('boxHitsFrustum', () => {
  it('accepts a box centered at origin', () => {
    assert.equal(boxHitsFrustum(-2, -2, -2, 2, 2, 2, box), true);
  });

  it('accepts a box crossing one of the boundaries', () => {
    assert.equal(boxHitsFrustum(7, -1, -1, 9, 1, 1, box), true);
  });

  it('rejects a box completely beyond a plane', () => {
    assert.equal(boxHitsFrustum(10, -1, -1, 15, 1, 1, box), false);
    assert.equal(boxHitsFrustum(-1, -15, -1, 1, -10, 1, box), false);
  });
});

describe('box2DHitsFrustum', () => {
  it('accepts a 2D bounds at origin within default Y limits', () => {
    assert.equal(box2DHitsFrustum(-1, -1, 1, 1, box), true);
  });

  it('rejects a 2D bounds outside horizontal frustum bounds', () => {
    assert.equal(box2DHitsFrustum(20, 20, 25, 25, box), false);
  });
});

describe('extractCullPlanes', () => {
  it('copies planes without allocating when target array provided', () => {
    const mockFrustum = {
      planes: [
        { normal: { x: 1, y: 0, z: 0 }, constant: 5 },
        { normal: { x: 0, y: 1, z: 0 }, constant: -2 },
      ],
    };
    const target: CullPlane[] = [{ nx: 0, ny: 0, nz: 0, constant: 0 }];
    const result = extractCullPlanes(mockFrustum, target);
    assert.equal(result, target);
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { nx: 1, ny: 0, nz: 0, constant: 5 });
    assert.deepEqual(result[1], { nx: 0, ny: 1, nz: 0, constant: -2 });
  });
});

describe('extractCullPlanesFromMatrix', () => {
  it('extracts normalized planes from identity projection-view matrix', () => {
    // Identity 4x4 matrix
    const identity = {
      elements: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
    };
    const planes = extractCullPlanesFromMatrix(identity);
    assert.equal(planes.length, 6);
    for (const p of planes) {
      const len = Math.hypot(p.nx, p.ny, p.nz);
      assert.ok(Math.abs(len - 1) < 1e-5);
    }
  });
});

describe('FrustumCuller', () => {
  it('supports updating planes and performing queries', () => {
    const culler = new FrustumCuller();
    const mockFrustum = {
      planes: [
        { normal: { x: 1, y: 0, z: 0 }, constant: 10 },
        { normal: { x: -1, y: 0, z: 0 }, constant: 10 },
        { normal: { x: 0, y: 1, z: 0 }, constant: 10 },
        { normal: { x: 0, y: -1, z: 0 }, constant: 10 },
        { normal: { x: 0, y: 0, z: 1 }, constant: 10 },
        { normal: { x: 0, y: 0, z: -1 }, constant: 10 },
      ],
    };
    culler.updateFromFrustum(mockFrustum);
    assert.equal(culler.sphereInView(0, 0, 0, 1), true);
    assert.equal(culler.sphereInView(50, 0, 0, 1), false);
    assert.equal(culler.pointInView(0, 0), true);
    assert.equal(culler.pointInView(50, 0), false);
    assert.equal(culler.boxInView(-1, -1, -1, 1, 1, 1), true);
    assert.equal(culler.boxInView(20, 20, 20, 30, 30, 30), false);
    assert.equal(culler.box2DInView(-1, -1, 1, 1), true);
    assert.equal(culler.box2DInView(20, 20, 30, 30), false);
  });
});
