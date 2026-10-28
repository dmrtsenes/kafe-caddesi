import test from "node:test";
import assert from "node:assert/strict";
import { separateCrowd } from "./CrowdSeparation.ts";
import { NavGrid } from './Navigation';
const noop = () => {};
test("separates exact overlap without random jitter or non-finite coordinates", () => {
  const a = [
      { x: 0, z: 0 },
      { x: 0, z: 0 },
    ],
    b = [
      { x: 0, z: 0 },
      { x: 0, z: 0 },
    ];
  assert.equal(separateCrowd(a, noop).remaining, 0);
  separateCrowd(b, noop);
  assert.deepEqual(a, b);
  assert.ok(Math.hypot(a[0].x - a[1].x, a[0].z - a[1].z) >= 0.859);
  assert.ok(a.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z)));
});
test("resolves a cluster, including overlaps introduced by earlier pair corrections", () => {
  const crowd = [
    { x: 0, z: 0 },
    { x: 0, z: 0 },
    { x: 0.1, z: 0.1 },
    { x: -0.1, z: 0 },
    { x: 0.1, z: -0.1 },
  ];
  assert.equal(separateCrowd(crowd, noop).remaining, 0);
});
test("respects a wall while using available space to separate a touching pair", () => {
  const crowd = [
    { x: 0, z: 0 },
    { x: 0.25, z: 0 },
  ];
  const result = separateCrowd(crowd, (p) => {
    p.x = Math.max(0, p.x);
  });
  assert.ok(crowd.every((p) => p.x >= 0));
  assert.equal(result.remaining, 0);
  assert.ok(crowd[1].x > 0.84);
});
test("does not move already clear actors", () => {
  const crowd = [
      { x: -2, z: 0 },
      { x: 2, z: 0 },
      { x: 0, z: 3 },
    ],
    before = structuredClone(crowd);
  assert.deepEqual(separateCrowd(crowd, noop), { contacts: 0, remaining: 0 });
  assert.deepEqual(crowd, before);
});

test('a busy queue yields without pushing the controlled player back into furniture', () => {
  const g = new NavGrid({ x0: -5, z0: -8, x1: 5, z1: 8 }, 0);
  g.beginRebuild();
  g.blockRect(-5, -8, -1.1, 8); g.blockRect(1.1, -8, 5, 8);
  const player = { x: 0, z: -6 };
  const crowd = Array.from({ length: 8 }, (_, i) => ({ x: 0, z: -4.5 + i * 1.3 }));
  const project = (p: { x: number; z: number }, x: number, z: number) => {
    const dx = p.x - x, dz = p.z - z;
    p.x = x; p.z = z; g.slideMove(p, dx, dz, .3);
  };
  for (let frame = 0; frame < 150; frame++) {
    g.slideMove(player, 0, .08, .32);
    const before = { ...player };
    separateCrowd([...crowd, player], project, .86, 12, player);
    assert.deepEqual(player, before, 'crowd cannot cancel movement input');
    assert.ok(crowd.every(p => !g.solidBlocked(p.x, p.z, .3)));
  }
  assert.ok(player.z > 5.9, 'the entire queue is traversable');
});
