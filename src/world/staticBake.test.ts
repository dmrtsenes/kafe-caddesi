import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cameraMoveEpsilon, cameraMovedEnough, shouldBakeStatic } from './staticBake.ts';

describe('shouldBakeStatic', () => {
  it('bakes immediately when furniture changed', () => {
    assert.equal(shouldBakeStatic(true, false), true);
  });

  it('bakes when the camera moved enough', () => {
    assert.equal(shouldBakeStatic(false, true), true);
  });

  it('does not bake when clean and the camera is still', () => {
    assert.equal(shouldBakeStatic(false, false), false);
  });

  it('does not interval-rebake a clean still camera', () => {
    assert.equal(shouldBakeStatic(false, false), false);
    assert.equal(shouldBakeStatic(false, false, false), false);
  });

  it('bakes when forced even if clean and still', () => {
    assert.equal(shouldBakeStatic(false, false, true), true);
  });
});

describe('cameraMovedEnough', () => {
  it('ignores tiny follow jitter', () => {
    assert.equal(cameraMovedEnough(0, 10, 0, 0.05, 10, 0.05), false);
  });

  it('detects a real step', () => {
    assert.equal(cameraMovedEnough(0, 10, 0, 0.5, 10, 0.2), true);
  });

  it('loosens skip epsilon from heat 1', () => {
    assert.equal(cameraMoveEpsilon(0), 0.18);
    assert.ok(cameraMoveEpsilon(1) > cameraMoveEpsilon(0));
    assert.equal(cameraMovedEnough(0, 10, 0, 0.2, 10, 0, cameraMoveEpsilon(0)), true);
    assert.equal(cameraMovedEnough(0, 10, 0, 0.2, 10, 0, cameraMoveEpsilon(1)), false);
  });
});
