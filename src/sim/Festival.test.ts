import assert from 'node:assert/strict';
import { it } from 'node:test';
import { GameState } from './GameState';
import { FESTIVALS, currentFestival, rollFestival, festivalGoalDefinition, festivalTarget, festivalProgress, festivalCounter } from './Festival';
import { stationsOfLocation } from '../data/stations';
const dates = FESTIVALS.map(def => {
  for(let i=0;i<400;i++) { const date = new Date(2026,0,1+i*7); if(currentFestival(date).id===def.id)return date; }
  throw new Error('No week for '+def.id);
});

it('every weekly theme gives a fresh cafe a task it can complete', () => {
  for(const date of dates) {
    const s=new GameState(); assert.equal(rollFestival(s,date),true);
    const def=festivalGoalDefinition(s,date);
    assert.ok(def.kind!=='item'||def.itemId==='cay',def.id);
    assert.ok(festivalTarget(s,def)>0);
  }
});
it('keeps selected task, target and baseline through reload and new unlocks',()=>{
  const s=new GameState(), date=dates[FESTIVALS.findIndex(f=>f.itemId==='waffle')];
  rollFestival(s,date);const id=s.festivalGoalId,target=s.festivalGoalTarget;
  s.stats.orders+=18;
  for(const st of stationsOfLocation('kose'))s.unlockedZones.add('kose:'+st.zone);
  const reload=new GameState();reload.load(s.save());assert.equal(rollFestival(reload,date),false);
  assert.equal(reload.festivalGoalId,id);assert.equal(reload.festivalGoalTarget,target);
  assert.equal(festivalProgress(reload,festivalGoalDefinition(reload,date),date),18);
});
it('uses an unlocked featured product when the week begins',()=>{
  const s=new GameState(),date=dates[FESTIVALS.findIndex(f=>f.itemId==='waffle')];
  for(const st of stationsOfLocation('kose'))s.unlockedZones.add('kose:'+st.zone);
  rollFestival(s,date);assert.equal(festivalGoalDefinition(s,date).itemId,'waffle');
  s.stats.sale.waffle=12;assert.equal(festivalProgress(s,festivalGoalDefinition(s,date),date),12);
});
it('same-week prestige reassigns locked products without a second reward or carried progress',()=>{
  const s=new GameState(),date=dates[FESTIVALS.findIndex(f=>f.itemId==='waffle')];
  for(const st of stationsOfLocation('kose'))s.unlockedZones.add('kose:'+st.zone);
  rollFestival(s,date);s.stats.orders=300;s.festivalClaimed=true;s.prestigeReset(1);
  assert.equal(rollFestival(s,date),true);assert.equal(s.festivalClaimed,true);
  assert.equal(festivalGoalDefinition(s,date).kind,'guest');
  assert.equal(festivalProgress(s,festivalGoalDefinition(s,date),date),0);
  assert.equal(rollFestival(s,date),false);
});
it('legacy accessible same-week missions retain baseline and claimed state',()=>{
  const s=new GameState(),date=dates[FESTIVALS.findIndex(f=>f.itemId==='cay')];
  rollFestival(s,date);s.festivalGoalId='';s.festivalGoalTarget=0;s.festivalBase=4;s.stats.sale.cay=15;s.festivalClaimed=true;
  assert.equal(rollFestival(s,date),true);assert.equal(s.festivalBase,4);assert.equal(s.festivalClaimed,true);
  assert.equal(festivalProgress(s,festivalGoalDefinition(s,date),date),11);
});
it('next week rebases the new counter and fixes the task target once',()=>{
  const s=new GameState(),date=dates[0];rollFestival(s,date);s.festivalClaimed=true;s.stats.orders=200;
  const later=new Date(+date+7*24*3600*1000);assert.equal(rollFestival(s,later),true);
  assert.equal(s.festivalClaimed,false);assert.equal(s.festivalBase,festivalCounter(s,festivalGoalDefinition(s,later)));
  const target=s.festivalGoalTarget;s.weekPrevServed=9999;s.festPrevItem=9999;
  assert.equal(festivalTarget(s,festivalGoalDefinition(s,later)),target);
});
