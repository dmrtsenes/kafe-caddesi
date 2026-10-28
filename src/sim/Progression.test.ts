import assert from 'node:assert/strict';
import {it} from 'node:test';
import {GameState} from './GameState';
import {GoalTracker} from './Goals';
import {GOALS, ENDLESS_TEMPLATES} from '../data/goals';
import {DAILY_TARGET_CAPS, missionsFor, rollDay, weeklyTarget} from './Daily';
it('a marathon session cannot turn the next day or week into an unlimited chore', () => {
  const state = new GameState(); state.unlockedZones.add('kose:a6');
  rollDay(state, new Date(2026,8,6,12));
  for (const key of ['served','cleaned','mopped','refills','orders','dashers'] as const) state.stats[key] = 1_000_000;
  rollDay(state, new Date(2026,8,7,12));
  for (const m of missionsFor(state.dailyDay,state)) assert.ok(m.target <= DAILY_TARGET_CAPS[m.counter]);
  state.weekPrevServed = 1_000_000; assert.equal(weeklyTarget(state),1500);
  const save=state.save(); const restored=new GameState(); restored.load(save);
  assert.deepEqual(missionsFor(state.dailyDay,restored),missionsFor(state.dailyDay,state));
});
it('endless jobs stay bounded after thousands of rounds and never pay for historical actions', () => {
  const state=new GameState(); const tracker=new GoalTracker(state);
  for(let i=0;i<ENDLESS_TEMPLATES.length;i++) {
    state.goalIndex=GOALS.length+ENDLESS_TEMPLATES.length*10_000+i;
    const goal=tracker.current!; assert.equal(goal.target,ENDLESS_TEMPLATES[i].cap);
    assert.ok(Number.isSafeInteger(goal.target));
  }
  state.goalIndex=GOALS.length; state.stats.served=50_000; state.goalBase=50_000;
  const before=state.money; tracker.update(); assert.equal(state.money,before);
  state.stats.served+=tracker.current!.target; tracker.update(); assert.ok(state.money>before);
  const paid=state.money; tracker.update(); assert.equal(state.money,paid);
  tracker.dispose();
});
