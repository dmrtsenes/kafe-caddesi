import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HandActionClock } from './HandActionClock.ts';
import { GameState } from './GameState.ts';
import { GoalTracker } from './Goals.ts';
import { StationEntity } from './Station.ts';
import { ALL_STATIONS } from '../data/stations.ts';
import { GOALS } from '../data/goals.ts';
import { handsInterval } from '../data/upgrades.ts';
import { baristaBoost, waiterCapacity, waiterShelfTarget } from '../data/staff.ts';

describe('promised upgrade effects', () => {
  for (const hz of [30, 45, 60]) it('delivers every hand speed level at ' + hz + ' Hz without plateau', () => {
    let previous = 0;
    for (let level = 0; level <= 10; level++) {
      const clock = new HandActionClock();
      let count = 0;
      const duration = handsInterval(level);
      for (let frame = 0; frame < hz * 60; frame++) if (clock.contact('same shelf', 1 / hz, duration)) count++;
      assert.ok(Math.abs(count - 60 / duration) <= 1, 'level ' + level + ': ' + count);
      assert.ok(count > previous, 'every level must improve actual throughput');
      previous = count;
    }
  });
  it('does not replay a completed transfer after leaving or changing its target', () => {
    const clock = new HandActionClock();
    assert.equal(clock.contact('a', .25, .52), true);
    assert.equal(clock.contact('b', .01, .52), false);
    clock.reset();
    assert.equal(clock.contact('a', .01, .52), false);
  });
  it('keeps phase continuous when hands are upgraded during an action', () => {
    const clock = new HandActionClock();
    clock.contact('a', .1, .5);
    assert.equal(clock.contact('a', .01, .2), false);
    assert.ok(Math.abs(clock.phase - .25) < 1e-9);
  });
  it('makes every checkout speed upgrade reduce both real operator durations', () => {
    const counter = new StationEntity(ALL_STATIONS.find(st => st.kind === 'counter')!);
    for (const actor of ['player', 'cashier'] as const) {
      let last = Infinity;
      for (let level = 0; level <= 8; level++) {
        counter.speedLevel = level;
        const seconds = counter.counterOrderTime(actor, 0);
        assert.ok(seconds < last); last = seconds;
        assert.equal(counter.cycleTime, counter.cycleTimeAt(level));
      }
    }
    counter.speedLevel = 0;
    const before = counter.counterOrderTime('cashier');
    counter.prestigeSpeed = .8;
    assert.ok(Math.abs(counter.counterOrderTime('cashier') - before * .8) < 1e-9);
  });
  it('uses the full shelf capacity as a shelf target, independent of hand carry capacity', () => {
    for (let level = 0; level <= 10; level++) {
      assert.equal(waiterShelfTarget(level, 8), 8);
      assert.equal(waiterShelfTarget(level, 4), 4);
      assert.equal(waiterShelfTarget(level, 3), 3);
    }
    assert.equal(waiterShelfTarget(10, 8), 8);
  });
});

describe('completed table state and migration', () => {
  it('does not finish the full-table goal by merely collecting dishes', () => {
    const state = new GameState(); state.goalIndex = GOALS.findIndex(g => g.id === 'g03');
    const tracker = new GoalTracker(state);
    const index = state.goalIndex;
    state.stats.cleaned = 30; tracker.update();
    assert.equal(state.goalIndex, index);
    state.stats.tablesCleaned = 1; tracker.update();
    assert.equal(state.goalIndex, index + 1); tracker.dispose();
  });
  it('saves table completions separately and resets only their goal baseline at prestige', () => {
    const state = new GameState(); state.stats.cleaned = 8; state.stats.tablesCleaned = 3;
    state.festivalGoalId = 'tea'; state.festivalGoalTarget = 50;
    const loaded = new GameState(); loaded.load(state.save());
    assert.equal(loaded.stats.tablesCleaned, 3); assert.equal(loaded.stats.cleaned, 8);
    assert.equal(loaded.festivalGoalId, 'tea'); assert.equal(loaded.festivalGoalTarget, 50);
    loaded.prestigeReset(1);
    assert.equal(loaded.statSinceReset('tablesCleaned'), 0); assert.equal(loaded.stats.tablesCleaned, 3);
    const legacy = state.save(); delete legacy.stats.tablesCleaned;
    loaded.load(legacy); assert.equal(loaded.stats.tablesCleaned, 0);
  });
});

describe('real two-minute production contribution', () => {
  for (const hz of [30, 45, 60]) it('delivers promised barista production and preserves player help at ' + hz + ' Hz', () => {
    const def = ALL_STATIONS.find(st => st.kind === 'machine' && st.item === 'cay')!;
    const measure = (boost: number, player: boolean) => {
      const machine = new StationEntity(def); machine.locked = false;
      machine.baristaBoost = boost; machine.playerNear = player;
      for (let f = 0; f < hz * 120; f++) { machine.output = 0; machine.update(1 / hz); }
      return machine.producedTotal;
    };
    const baseline = measure(1, false), hired = measure(baristaBoost(0), false), max = measure(baristaBoost(10), false);
    assert.ok(Math.abs(hired - 120 / def.time * 1.25) <= 1);
    assert.ok(Math.abs(max - 120 / def.time * 1.85) <= 1);
    assert.ok(hired > baseline); assert.ok(max > hired);
    assert.equal(measure(baristaBoost(10), true), measure(1, true), 'player ×2 replaces boost, never stacks invisibly');
  });
  it('keeps visited branches across prestige and ignores unknown saved locations', () => {
    const state = new GameState(); state.seenLocations.add('sahil'); state.prestigeReset(1);
    const save = state.save(); save.seenLocations!.push('other');
    const loaded = new GameState(); loaded.load(save);
    assert.equal(loaded.seenLocations.has('sahil'), true); assert.equal(loaded.seenLocations.has('other'), false);
  });
});
