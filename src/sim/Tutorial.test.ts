import assert from 'node:assert/strict';
import { it } from 'node:test';
import { Tutorial } from './Tutorial';
import { GameState } from './GameState';
import type { World } from './World';
import type { Player } from '../entities/Player';
it('allows a vacuum detour without advancing or trapping the current task', () => {
  const state = new GameState(); state.tutorialStep = 2;
  const tutorial = new Tutorial(state);
  const world = { byId: new Map() } as unknown as World;
  const player = { x: 0, z: 0, hasVacuum: true, hasItem: () => false } as unknown as Player;
  for (let i = 0; i < 120; i++) tutorial.update(1 / 30, world, player);
  assert.equal(tutorial.step, 2);
  assert.equal(tutorial.pointerTarget, null);
  player.hasVacuum = false;
  tutorial.update(1 / 30, world, player);
  assert.equal(tutorial.step, 2);
  player.hasItem = () => true;
  tutorial.update(1 / 30, world, player);
  assert.equal(tutorial.step, 3);
  tutorial.dispose();
});
it('requires real movement and ignores the spawn offset and teleports', () => {
  const state = new GameState();
  const t = new Tutorial(state);
  const world = { byId: new Map(), pendingOrders: 0 } as unknown as World;
  const player = { x: -3.4, z: -6.8 } as Player;
  t.update(1 / 30, world, player);
  for (let i = 0; i < 90; i++) t.update(1 / 30, world, player);
  assert.equal(t.step, 0);
  player.x = 30;
  t.update(1 / 30, world, player);
  assert.equal(t.step, 0);
  for (let i = 0; i < 40; i++) {
    player.x += 0.1;
    t.update(1 / 30, world, player);
  }
  assert.equal(t.step, 1);
  t.dispose();
});

import { bus } from '../core/EventBus';
it('requires a finished table wipe, not just picked-up dishes', () => {
  const state = new GameState();
  state.tutorialStep = 5;
  const tutorial = new Tutorial(state);
  const world = { tables: [], bins: [] } as unknown as World;
  const player = { x: 0, z: 0, carryCount: 0, hasItem: () => false } as unknown as Player;
  state.stats.cleaned = 20;
  bus.emit('item:picked', { item: 'bulasik', x: 0, z: 0 });
  tutorial.update(0.1, world, player);
  assert.equal(tutorial.step, 5);
  bus.emit('table:cleaned', { id: 'k_masa_1' });
  tutorial.update(0.1, world, player);
  assert.equal(tutorial.step, 6);
  tutorial.dispose();
});
it('resumes transient tutorial stages from orders and keeps saved cash or dirty tables', () => {
  for (const step of [2, 3, 4, 5]) {
    const state = new GameState();
    state.tutorialStep = step;
    const tutorial = new Tutorial(state);
    tutorial.resume({ counters: [], tables: [] } as unknown as World);
    assert.equal(tutorial.step, 1);
    tutorial.dispose();
  }
  for (const step of [4, 5]) {
    const state = new GameState();
    state.tutorialStep = step;
    const tutorial = new Tutorial(state);
    tutorial.resume({
      counters: [{ locked: false, cash: 3 }],
      tables: [{ locked: false, dishes: 1, soil: 1 }],
    } as unknown as World);
    assert.equal(tutorial.step, step);
    tutorial.dispose();
  }
});

import { TUTORIAL_STEPS } from './Tutorial';
import { StationEntity } from './Station';
import { ALL_STATIONS } from '../data/stations';
it('teaches nearby table edges, keeping the safe approach when a wall blocks the edge', () => {
  const table = new StationEntity({ ...ALL_STATIONS.find(st => st.kind === 'table')!, x: 0, z: 0, rot: 0 });
  table.locked = false;
  table.seatedGuests.push({ needsItem: item => item === 'cay', receiveItem: () => true });
  let clear = true;
  const world = { tables: [table], nav: { solidBlocked: () => false, interactionLineClear: () => clear } } as unknown as World;
  const player = { x: 1.85, z: 0, hasItem: () => true } as unknown as Player;
  const point = TUTORIAL_STEPS[3].pointAt!(world, new GameState(), player);
  assert.ok(point && point.x > 0 && point.z === 0);
  clear = false;
  const canonical = { x: 0, z: 0 };table.servicePoint(canonical);
  assert.deepEqual(TUTORIAL_STEPS[3].pointAt!(world, new GameState(), player), canonical);
});
it('never tells a player to discard a valuable product to reach the cleaning lesson', () => {
  let binVisited = false;
  const bin = { locked: false, servicePoint: () => { binVisited = true; } };
  const world = { tables: [], bins: [bin], bestConsumer: () => null } as unknown as World;
  const player = { x: 0, z: 0, carryCount: 1, hasItem: () => false, distinctItems: () => ['cay'] } as unknown as Player;
  assert.equal(TUTORIAL_STEPS[5].pointAt!(world, new GameState(), player), null);
  assert.equal(binVisited, false);
});
it('ends the expansion lesson on a real payment, a new zone, or a 20s fallback', () => {
  const zones = [{ id: 'a1' }, { id: 't1' }];
  const paid = new Map<string, number>();
  const unlocked = new Set(['a1']);
  const world = {
    loc: { zones },
    zoneUnlocked: (id: string) => unlocked.has(id),
    padPaid: (id: string) => paid.get(id) ?? 0,
  } as unknown as World;
  const player = { x: 0, z: 0 } as Player;
  const holdState = new GameState();
  holdState.tutorialStep = 6;
  const hold = new Tutorial(holdState);
  for (let i = 0; i < 19 * 30; i++) hold.update(1 / 30, world, player);
  assert.equal(hold.step, 6);
  hold.update(1, world, player);
  assert.equal(hold.step, 7);
  hold.dispose();
  const payState = new GameState();
  payState.tutorialStep = 6;
  const paying = new Tutorial(payState);
  paid.set('t1', 1);
  paying.update(0.1, world, player);
  assert.equal(paying.step, 7);
  paying.dispose();
  paid.delete('t1');
  const openState = new GameState();
  openState.tutorialStep = 6;
  const opened = new Tutorial(openState);
  unlocked.add('t1');
  opened.update(0.1, world, player);
  assert.equal(opened.step, 7);
  opened.dispose();
});
it('does not send an empty-handed player to clean an occupied table', () => {
  const table = new StationEntity({ ...ALL_STATIONS.find(st => st.kind === 'table')!, x: 0, z: 0 });
  table.locked = false;table.dishes = 1;table.takeSeat(0);
  const world = { tables: [table], bins: [] } as unknown as World;
  const player = { x: 0, z: 0, carryCount: 0, hasItem: () => false } as unknown as Player;
  assert.equal(TUTORIAL_STEPS[5].pointAt!(world, new GameState(), player), null);
});
