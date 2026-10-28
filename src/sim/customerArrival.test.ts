import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { advanceApproachArrival, advancePickupArrival } from './customerArrival.ts';

describe('package customer shelf arrival', () => {
  it('accepts a customer stranded just short of the shelf target', () => {
    let timer = 0;
    let ready = false;
    for (let i = 0; i < 6; i++) {
      const result = advancePickupArrival(timer, 0.1, {
        arrived: false,
        onFront: true,
        distanceToTarget: 0.9,
        distanceToFront: 1.1,
      });
      timer = result.timer;
      ready = result.ready;
    }
    assert.equal(ready, true);
  });

  it('never takes through the back of a shelf', () => {
    const result = advancePickupArrival(2, 0.1, {
      arrived: false,
      onFront: false,
      distanceToTarget: 0.4,
      distanceToFront: 0.4,
    });
    assert.equal(result.ready, false);
    assert.equal(result.timer < 2, true);
  });
});

describe('generic station arrival fallback', () => {
  it('releases a customer stranded beside the correct counter side', () => {
    let timer = 0;
    let ready = false;
    for (let i = 0; i < 5; i++) {
      const result = advanceApproachArrival(timer, 0.1, {
        arrived: false,
        onApproachSide: true,
        distanceToTarget: 0.8,
        distanceToPoint: 0.9,
        targetRadius: 1,
        pointRadius: 1.2,
      });
      timer = result.timer;
      ready = result.ready;
    }
    assert.equal(ready, true);
  });

  it('does not accept the wrong side of an obstacle', () => {
    const result = advanceApproachArrival(0.5, 0.1, {
      arrived: false,
      onApproachSide: false,
      distanceToTarget: 0.2,
      distanceToPoint: 0.2,
      targetRadius: 1,
      pointRadius: 1.2,
    });
    assert.equal(result.ready, false);
    assert.equal(result.timer < 0.5, true);
  });
});
