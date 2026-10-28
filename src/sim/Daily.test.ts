import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setLanguage } from '../core/I18n.ts';
import { GameState } from './GameState.ts';
import type { GameStateSave } from './GameState.ts';
import { missionProgress, missionsFor, rollDay, todayKey } from './Daily.ts';
import type { DailyMissionSave } from './Daily.ts';

const today = new Date(2026, 8, 5, 12);
const tomorrow = new Date(2026, 8, 6, 12);
const key = todayKey(today);
const identities = (state: GameState): DailyMissionSave[] =>
  missionsFor(state.dailyDay, state).map(({ counter, target }) => ({ counter, target }));
const reload = (state: GameState): GameState => {
  const loaded = new GameState();
  loaded.load(JSON.parse(JSON.stringify(state.save())));
  return loaded;
};

function legacyState(claimed: boolean[] = [false, false, false]): GameState {
  const state = new GameState();
  state.load({ dailyDay: key, dailyMissionDone: claimed, dailyBase: { orders: 10, served: 15 } });
  return state;
}

describe('offline daily missions', () => {
  it('never assigns locked restroom work to a starter cafe throughout the calendar', () => {
    const assigned = new Set<string>();
    for (let day = 1; day <= 365; day++) {
      const state = new GameState();
      rollDay(state, new Date(2026, 0, day, 12));
      const missions = missionsFor(state.dailyDay, state);
      assert.equal(missions.length, 3);
      assert.equal(new Set(missions.map((mission) => mission.counter)).size, 3);
      for (const mission of missions) {
        assert.notEqual(mission.counter, 'refills', state.dailyDay);
        assert.ok(mission.target > 0 && Number.isSafeInteger(mission.target));
        assigned.add(mission.counter);
      }
    }
    assert.deepEqual([...assigned].sort(), ['cleaned', 'dashers', 'mopped', 'orders', 'served']);
  });

  it('offers restroom missions when the toilet and supplies are already unlocked at day start', () => {
    const state = new GameState();
    state.unlockedZones.add('kose:a6');
    rollDay(state, today);
    assert.equal(identities(state)[0].counter, 'refills');
    assert.equal(identities(state)[0].target, 6);
  });

  it('freezes missions before purchases, progress, branch switches and save/load', () => {
    const state = new GameState();
    rollDay(state, today);
    const original = identities(state);
    state.dailyMissionDone[0] = true;
    state.money = 50_000;
    state.buyPlayerUpgrade('speed');
    state.hire('waiter');
    state.unlockZone('kose', 'a6', 'Tuvalet');
    state.unlockedLocations.add('sahil');
    state.unlockedZones.add('sahil:p1');
    state.activeLocation = 'sahil';
    state.dailyPrevDone = { served: 40_000, orders: 20_000 };
    state.stats.served = 800;
    state.stats.orders = 400;
    assert.deepEqual(identities(state), original);
    const loaded = reload(state);
    assert.deepEqual(identities(loaded), original);
    assert.deepEqual(loaded.dailyMissionDone, [true, false, false]);
    assert.equal(loaded.money, state.money);
  });

  it('migrates a legacy locked slot without moving other missions or claimed rewards', () => {
    // The old September 5 rotation was [refills, orders, dashers].
    const state = legacyState([false, true, false]);
    state.stats.orders = 42;
    state.stats.served = 37;
    const missions = missionsFor(key, state);
    assert.deepEqual(missions.map((mission) => mission.counter), ['served', 'orders', 'dashers']);
    assert.equal(missionProgress(state, missions[0]), 22);
    assert.equal(missionProgress(state, missions[1]), 32);
    assert.deepEqual(state.dailyMissionDone, [false, true, false]);
    assert.equal(state.money, 0);
    const loaded = reload(state);
    assert.deepEqual(identities(loaded), identities(state));
    assert.deepEqual(loaded.dailyMissionDone, state.dailyMissionDone);
  });

  it('migrates the same-day save at startup before any further unlocks', () => {
    const state = legacyState([false, true, false]);
    assert.equal(rollDay(state, today).newDay, false);
    const captured = state.dailyMissions.map((mission) => ({ ...mission }));
    assert.deepEqual(captured.map((mission) => mission.counter), ['served', 'orders', 'dashers']);
    state.unlockZone('kose', 'a6', 'Tuvalet');
    assert.deepEqual(identities(reload(state)), captured);
    assert.deepEqual(state.dailyMissionDone, [false, true, false]);
  });

  it('keeps a legacy already rewarded locked slot completed', () => {
    const state = legacyState([true, false, true]);
    assert.deepEqual(identities(state).map((mission) => mission.counter), ['refills', 'orders', 'dashers']);
    state.unlockedZones.add('kose:a6');
    const loaded = reload(state);
    assert.deepEqual(loaded.dailyMissionDone, [true, false, true]);
    assert.equal(identities(loaded)[0].counter, 'refills');
    assert.equal(loaded.money, 0);
  });

  it('keeps targets from an eligible legacy save stable after migration', () => {
    const state = legacyState();
    state.unlockedZones.add('kose:a6');
    state.dailyPrevDone = { refills: 60, orders: 80, dashers: 100 };
    const original = identities(state);
    assert.deepEqual(original, [
      { counter: 'refills', target: 33 },
      { counter: 'orders', target: 44 },
      { counter: 'dashers', target: 1 },
    ]);
    state.dailyPrevDone.orders = 9_000;
    assert.deepEqual(identities(reload(state)), original);
  });

  it('replaces an unfinished restroom mission after cafe reset and preserves all claim flags', () => {
    const state = new GameState();
    state.unlockedZones.add('kose:a6');
    rollDay(state, today);
    state.dailyMissionDone = [false, true, false];
    state.stats.orders = 28;
    state.prestigeReset(2);
    const missions = identities(state);
    assert.deepEqual(missions.map((mission) => mission.counter), ['served', 'orders', 'dashers']);
    assert.deepEqual(state.dailyMissionDone, [false, true, false]);
    assert.equal(missionProgress(state, missionsFor(key, state)[1]), 28);
    assert.deepEqual(identities(reload(state)), missions);
  });

  it('selects newly available mechanics only on the next day and rolls progress once', () => {
    const state = new GameState();
    rollDay(state, today);
    state.unlockedZones.add('kose:a6');
    state.dailyMissionDone = [true, true, true];
    state.dailyClaimed = true;
    state.stats.mopped = 80;
    state.stats.refills = 20;
    assert.deepEqual(rollDay(state, tomorrow), { newDay: true, streakBroken: false });
    assert.deepEqual(identities(state), [
      { counter: 'mopped', target: 44 },
      { counter: 'refills', target: 11 },
      { counter: 'dashers', target: 1 },
    ]);
    assert.deepEqual(state.dailyMissionDone, [false, false, false]);
    assert.equal(state.dailyClaimed, false);
    assert.equal(missionProgress(state, missionsFor(state.dailyDay, state)[0]), 0);
    const frozen = identities(state);
    state.dailyMissionDone[0] = true;
    state.dailyClaimed = true;
    state.stats.mopped += 3;
    assert.equal(rollDay(state, tomorrow).newDay, false);
    assert.equal(rollDay(state, today).newDay, false);
    assert.deepEqual(identities(state), frozen);
    assert.deepEqual(state.dailyMissionDone, [true, false, false]);
    assert.equal(state.dailyClaimed, true);
    assert.equal(missionProgress(state, missionsFor(state.dailyDay, state)[0]), 3);
  });

  it('does not overwrite the active mission snapshot when another date is inspected', () => {
    const state = new GameState();
    rollDay(state, today);
    const original = identities(state);
    state.dailyMissionDone[1] = true;
    missionsFor(todayKey(tomorrow), state);
    assert.deepEqual(identities(state), original);
    assert.deepEqual(state.dailyMissionDone, [false, true, false]);
  });

  it('copies saved mission values so detached save objects cannot change live targets', () => {
    const state = new GameState();
    rollDay(state, today);
    const snapshot = state.save();
    snapshot.dailyMissions![0].target = 999;
    assert.notEqual(state.dailyMissions[0].target, 999);
    const loaded = new GameState();
    loaded.load(snapshot);
    snapshot.dailyMissions![0].target = 555;
    assert.equal(loaded.dailyMissions[0].target, 999);
  });

  it('recovers malformed snapshots without reopening previously claimed slots', () => {
    const samples = [
      [null, { counter: 'orders', target: -1 }, { counter: 'dashers', target: 1 }],
      [{ counter: 'unknown', target: 1 }, { counter: 'orders', target: 25 }, { counter: 'dashers', target: 1 }],
      [{ counter: 'served', target: 40 }, { counter: 'served', target: 40 }, { counter: 'dashers', target: 1 }],
      [{ counter: 'served', target: Number.POSITIVE_INFINITY }],
    ];
    for (const sample of samples) {
      const state = new GameState();
      state.load({ dailyDay: key, dailyMissionDone: [false, true, false], dailyMissions: sample } as GameStateSave);
      const missions = identities(state);
      assert.equal(missions.length, 3);
      assert.equal(new Set(missions.map((mission) => mission.counter)).size, 3);
      assert.ok(missions.every((mission) => Number.isSafeInteger(mission.target) && mission.target > 0));
      assert.deepEqual(state.dailyMissionDone, [false, true, false]);
      assert.equal(state.money, 0);
    }
  });

  it('regenerates translated titles from persisted identities without rerolling missions', () => {
    const state = new GameState();
    state.unlockedZones.add('kose:a6');
    rollDay(state, tomorrow);
    const original = identities(state);
    try {
      setLanguage('en');
      const english = missionsFor(state.dailyDay, state);
      assert.equal(english[0].title, 'Clean 10 spills');
      assert.equal(english[1].title, 'Restock 6 supplies');
      assert.deepEqual(identities(state), original);
      setLanguage('tr');
      const turkish = missionsFor(state.dailyDay, reload(state));
      assert.equal(turkish[0].title, '10 leke temizle');
      assert.equal(turkish[1].title, '6 sarf malzemesi doldur');
    } finally {
      setLanguage('tr');
    }
  });
});
