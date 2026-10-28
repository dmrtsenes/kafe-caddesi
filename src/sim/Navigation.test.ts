import assert from 'node:assert/strict';
import { it } from 'node:test';
import { NavGrid } from './Navigation';
import { Actor } from '../entities/Actor';
import { Object3D } from 'three';
import type { CharacterHandle } from '../chars/types';
import { CHAIR_BODY } from '../data/seating';
function grid() {
  const g = new NavGrid({ x0: -6, z0: -6, x1: 6, z1: 6 }, 0);
  g.markStaticWalls({ x0: -6, z0: -6, x1: 6, z1: 6 });
  g.beginRebuild();
  return g;
}
function assertClear(g: NavGrid, sx: number, sz: number, path: number[]) {
  let x = sx,
    z = sz;
  for (let i = 0; i < path.length; i += 2) {
    const tx = path[i],
      tz = path[i + 1],
      n = Math.max(1, Math.ceil(Math.hypot(tx - x, tz - z) / 0.025));
    for (let k = 1; k <= n; k++)
      assert.equal(
        g.solidBlocked(x + ((tx - x) * k) / n, z + ((tz - z) * k) / n, 0.34),
        false,
        `Blocked segment ${x},${z} -> ${tx},${tz}`,
      );
    x = tx;
    z = tz;
  }
}
it('routes around furniture with full body clearance, including off-grid service targets', () => {
  const g = grid();
  g.blockRect(-1.17, -1.11, 1.23, 1.09);
  g.blockRect(2, -4, 2.28, -0.5);
  g.finishRebuild();
  for (const [sx, sz] of [
    [-4, -3],
    [-3, 2],
    [4, 3],
    [3, -4],
  ])
    for (const [tx, tz] of [
      [1.61, 1.49],
      [-1.62, -1.51],
      [2.73, -0.12],
      [0.18, 1.56],
    ]) {
      const path: number[] = [];
      assert.equal(g.findPath(sx, sz, tx, tz, path), true);
      assertClear(g, sx, sz, path);
      assert.deepEqual(path.slice(-2), [tx, tz]);
    }
});
it('rejects a corridor narrower than the body instead of returning an unusable route', () => {
  const g = grid();
  g.blockRect(-0.15, -6, 0.15, -0.29);
  g.blockRect(-0.15, 0.29, 0.15, 6);
  g.finishRebuild();
  const path: number[] = [];
  assert.equal(g.findPath(-3, 0, 3, 0, path), false);
  assert.deepEqual(path, []);
});
it('cannot smooth through thin geometry between grid centers', () => {
  const g = grid();
  g.blockRect(0.12, -2, 0.27, 2);
  g.finishRebuild();
  const path: number[] = [];
  assert.equal(g.findPath(-2, 0, 2, 0, path), true);
  assertClear(g, -2, 0, path);
  assert.ok(path.length > 2);
});
it('checks collision even when start and goal round to the same cell', () => {
  const g = grid();
  g.addSolid(0.4, -1, 0.45, 1);
  g.finishRebuild();
  const path: number[] = [];
  assert.equal(g.colOf(-.1), g.colOf(.1));
  assert.equal(g.findPath(-.1, 0, .1, 0, path), false);
});

it('interaction reach cannot cross thin walls, furniture, or closed doors', () => {
  const g=grid();g.blockRect(-.006,-2,.006,2);
  assert.equal(g.interactionLineClear(-1,0,1,0),false);
  assert.equal(g.interactionLineClear(-1,2.5,1,2.5),true);
  assert.equal(g.interactionLineClear(-1,0,-.1,0),true);
  assert.equal(g.interactionLineClear(-.1,0,.1,0),false);
  assert.equal(g.interactionLineClear(-1,0,-1,0),true);
  assert.equal(g.interactionLineClear(NaN,0,1,0),false);
});

it('uses a circular body at square corners and a circular footprint for round tables', () => {
  const g = grid();
  g.blockRect(-1, -1, 1, 1);
  assert.equal(g.solidBlocked(1.25, 1.25, .32), false);
  assert.equal(g.solidBlocked(1.2, 1.2, .32), true);
  g.beginRebuild();
  g.blockRoundedRect(-.72, -.72, .72, .72, .72);
  g.restampSolids(); g.finishRebuild();
  assert.equal(g.solidBlocked(.8, .8, .32), false);
  assert.equal(g.solidBlocked(.7, .7, .32), true);
  assert.equal(g.solidBlocked(.99, 0, .32), true, 'the visible tabletop stays solid');
  const pos = { x: .7, z: .7 };
  g.resolve(pos, .32);
  assert.equal(g.solidBlocked(pos.x, pos.z, .32), false);
  assert.ok(Math.abs(pos.x - pos.z) < 1e-8, 'round contact pushes radially');
});

it('sweeps the entire move across thin walls and tables, including long frames', () => {
  for (const horizontal of [false, true]) {
    const g = grid();
    g.blockRect(...(horizontal ? [-5, -.005, 5, .005] : [-.005, -5, .005, 5]) as [number, number, number, number]);
    const pos = horizontal ? { x: 0, z: -3 } : { x: -3, z: 0 };
    g.slideMove(pos, horizontal ? 1 : 6, horizontal ? 6 : 1, .32);
    assert.ok((horizontal ? pos.z : pos.x) < -.3249);
    assert.ok(Math.abs((horizontal ? pos.x : pos.z) - 1) < .001, 'slides along the wall');
    assert.equal(g.solidBlocked(pos.x, pos.z, .32), false);
  }
  const g = grid(), pos = { x: -3, z: 0 };
  g.blockRoundedRect(-.72, -.72, .72, .72, .72);
  g.slideMove(pos, 6, 0, .32);
  assert.ok(pos.x <= -1.0399, 'cannot tunnel through a round table');
});

it('slides around a table edge without requiring the player to release their direction', () => {
  for (const hz of [15, 30, 45, 60, 120]) {
    const g = grid(), pos = { x: -2, z: .6 };
    g.blockRoundedRect(-.72, -.72, .72, .72, .72);
    for (let frame = 0; frame < hz; frame++) {
      g.slideMove(pos, 5 / hz, 0, .32);
      assert.equal(g.solidBlocked(pos.x, pos.z, .32), false);
    }
    assert.ok(pos.x > 2, hz + ' Hz edge glide: ' + JSON.stringify(pos));
    assert.ok(pos.z < 1.15, 'no excessive sideways assistance');
  }
});

it('crosses dense furniture rows through a .76-unit aisle at all movement rates', () => {
  for (const hz of [15, 30, 45, 60, 120]) for (const speed of [4, 8, 12]) {
    const g = grid(), center = .19;
    for (let z = -4; z <= 4; z += 2) for (const side of [-1, 1]) {
      const x = center + side * (0.8 + .38);
      g.blockRoundedRect(x - .8, z - .8, x + .8, z + .8, .06);
    }
    g.finishRebuild();
    const path: number[] = [];
    assert.equal(g.findPath(center, -5, center, 5, path), true, 'off-grid aisle is usable');
    assertClear(g, center, -5, path);
    const pos = { x: center, z: -5 };
    for (let frame = 0; frame < Math.ceil(10 * hz / speed); frame++) {
      g.slideMove(pos, 0, Math.min(speed / hz, 5 - pos.z), .32);
      assert.equal(g.solidBlocked(pos.x, pos.z, .32), false);
    }
    assert.ok(pos.z > 4.99);
  }
});

it('a genuinely undersized gap remains solid and overlapping furniture cannot trap recovery', () => {
  const g = grid();
  g.blockRect(-4, -2, -.29, 2); g.blockRect(.29, -2, 4, 2);
  const pos = { x: 0, z: -3 };
  for (let i = 0; i < 60; i++) g.slideMove(pos, 0, .1, .32);
  assert.ok(pos.z < -2, 'cannot squeeze through solid furniture');
  g.beginRebuild();
  g.blockRect(-2, -1, .15, 1); g.blockRect(-.15, -1, 2, 1);
  pos.x = 0; pos.z = 0; g.resolve(pos, .32);
  assert.equal(g.solidBlocked(pos.x, pos.z, .32), false);
  assert.ok(Math.hypot(pos.x, pos.z) < 1.4, 'escape stays local');
  g.beginRebuild(); g.finishRebuild();
  assert.equal(g.solidCount, 0);
  assert.equal(g.solidBlocked(0, 0, .32), false, 'rebuilding leaves no phantom shapes');
});

class WalkingActor extends Actor {
  tick(dt: number, nav: NavGrid) { this.advance(dt, nav, .12); }
}
function walker(x: number, z: number) {
  const actor = new WalkingActor({ root: new Object3D() } as CharacterHandle);
  actor.setPosition(x, z);
  return actor;
}
it('path followers stop at blocked routes without false arrival or tunneling', () => {
  const g = grid(); g.blockRect(-.005, -6, .005, 6); g.finishRebuild();
  const actor = walker(-2, 0); actor.moveTo(g, 2, 0);
  for (let frame = 0; frame < 100; frame++) actor.tick(.1, g);
  assert.equal(actor.arrived, false);
  assert.ok(actor.x < -.3);
  assert.equal(g.solidBlocked(actor.x, actor.z, .3), false);
});

it('path followers actually reach off-grid targets around dense furniture', () => {
  const g = grid();
  for (const x of [-2, 0, 2]) for (const z of [-2, 0, 2])
    g.blockRoundedRect(x - .6, z - .6, x + .6, z + .6, .6);
  g.finishRebuild();
  for (const hz of [15, 30, 60]) {
    const actor = walker(-4, -3); actor.speed = 8; actor.moveTo(g, 3.75, 3.62);
    for (let frame = 0; frame < hz * 10 && !actor.arrived; frame++) {
      actor.tick(1 / hz, g);
      assert.equal(g.solidBlocked(actor.x, actor.z, .3), false);
    }
    assert.equal(actor.arrived, true);
    assert.ok(Math.hypot(actor.x - 3.75, actor.z - 3.62) <= .12);
  }
});

it('recovers a route after a crowd pushes an actor into the navigation safety margin', () => {
  const g = grid(); g.blockRect(-1, -1, 1, 1); g.finishRebuild();
  const actor = walker(1.31, 0); actor.moveTo(g, -3, 0);
  assert.equal(actor.x, 1.31, 'planning must not teleport the character');
  for (let frame = 0; frame < 600 && !actor.arrived; frame++) {
    actor.tick(1 / 60, g);
    assert.equal(g.solidBlocked(actor.x, actor.z, .3), false);
  }
  assert.equal(actor.arrived, true);
  assert.ok(Math.hypot(actor.x + 3, actor.z) <= .12);
});

it('hand reach also respects round tables without blocking their empty corners', () => {
  const g = grid(); g.blockRoundedRect(-.72, -.72, .72, .72, .72);
  assert.equal(g.interactionLineClear(.6, .5, .5, .6), true);
  assert.equal(g.interactionLineClear(-1, 0, 1, 0), false);
});

it('blocks the full chair seat and armrests at every angle without blocking empty AABB corners', () => {
  for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI * 1.27]) {
    const g = grid(), { halfWidth: hx, halfDepth: hz, corner } = CHAIR_BODY;
    const c = Math.cos(angle), s = Math.sin(angle);
    const toWorld = (x: number, z: number) => ({ x: x * c + z * s, z: -x * s + z * c });
    g.blockOrientedRect(0, 0, hx, hz, angle, corner); g.finishRebuild();
    for (const [x, z] of [[0, 0], [hx - .02, 0], [0, -hz + .02], [hx - .025, hz - .025]]) {
      const p = toWorld(x, z); assert.equal(g.solidBlocked(p.x, p.z, .01), true);
    }
    const outside = toWorld(hx + .24, hz + .24);
    assert.equal(g.solidBlocked(outside.x, outside.z, .32), false);
    for (const hz of [15, 30, 60]) {
      const p = toWorld(0, -2);
      for (let i = 0; i < hz; i++) {
        g.slideMove(p, s * 8.5 / hz, c * 8.5 / hz, .32);
        assert.equal(g.solidBlocked(p.x, p.z, .32), false);
      }
      assert.ok(p.x * s + p.z * c < -.669, 'the chair cannot be walked through');
    }
    const p = toWorld(.1, .1); g.resolve(p, .32);
    assert.equal(g.solidBlocked(p.x, p.z, .32), false);
  }
});

it('allows a sitting transition through its own chair only', () => {
  const g = grid();
  const chair = g.blockOrientedRect(0, 0, .3675, .35, Math.PI / 4, .025);
  assert.equal(g.bodyLineClear(1, 0, 0, 0, .3), false);
  assert.equal(g.bodyLineClear(1, 0, 0, 0, .3, chair), true);
  g.blockRect(.5, -.1, .55, .1);
  assert.equal(g.bodyLineClear(1, 0, 0, 0, .3, chair), false, 'other obstacles remain solid');
  g.beginRebuild(); g.finishRebuild();
  assert.equal(g.solidBlocked(0, 0, .32), false, 'old rotated chairs are removed on rebuild');
});

it('routes through a chair-wall aisle between samples and can replan while inside it', () => {
  const g = grid();
  g.blockRect(-6, -6, 6, -.25);
  g.blockRect(-1, .45, 1, 6);
  g.finishRebuild();
  for (const start of [{ x: -3, z: 1 }, { x: 0, z: .1 }]) {
    const path: number[] = [];
    assert.equal(g.findPath(start.x, start.z, 3, 1, path), true);
    assertClear(g, start.x, start.z, path);
    assert.deepEqual(path.slice(-2), [3, 1]);
    const actor = walker(start.x, start.z); actor.moveTo(g, 3, 1);
    for (let i = 0; i < 600 && !actor.arrived; i++) actor.tick(1 / 60, g);
    assert.equal(actor.arrived, true);
  }
});

it('pads each cell exactly as a per-cell scan of every solid would', () => {
  const g = grid();
  let seed = 7;
  const r = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 40; i++) {
    const x = -5.5 + r() * 11, z = -5.5 + r() * 11, w = .05 + r() * 1.6, d = .05 + r() * 1.6;
    if (i % 3 === 0) g.blockOrientedRect(x, z, w / 2, d / 2, r() * Math.PI, r() * .2);
    else if (i % 3 === 1) g.blockRoundedRect(x, z, x + w, z + d, r() * .3);
    else g.blockRect(x, z, x + w, z + d);
  }
  g.addSolid(-5.9, -0.02, 5.9, 0.02);
  g.finishRebuild();
  const internals = g as unknown as { padded: Uint8Array; staticBlocked: Uint8Array };
  for (let cz = 0; cz < g.rows; cz++)
    for (let cx = 0; cx < g.cols; cx++) {
      const i = g.idx(cx, cz);
      const expected = internals.staticBlocked[i] || g.solidBlocked(g.worldX(cx), g.worldZ(cz), 0.34) ? 1 : 0;
      assert.equal(internals.padded[i], expected, `cell ${cx},${cz}`);
    }
});
