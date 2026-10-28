import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clampedLiveCount } from './liveCount.ts';

describe('clampedLiveCount', () => {
  it('drops empty buffers to zero so they are not drawn', () => {
    assert.equal(clampedLiveCount(8, 0), 0);
    assert.equal(clampedLiveCount(8, -1), 0);
  });

  it('keeps only live instances', () => {
    assert.equal(clampedLiveCount(8, 3), 3);
    assert.equal(clampedLiveCount(8, 8), 8);
    assert.equal(clampedLiveCount(8, 99), 8);
  });
});
