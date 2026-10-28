import assert from 'node:assert/strict';
import {it} from 'node:test';
import {LOCATIONS} from './layouts';
import {GOALS} from './goals';
import {BRANCH_COSTS} from './economy';
it('every priced area is reachable and its ordinary reward cannot repay the purchase',()=>{
 for(const loc of Object.values(LOCATIONS))for(const zone of loc.zones){
  assert.ok(Number.isSafeInteger(zone.cost)&&zone.cost>=0,zone.id);
  const seen=new Set<string>();let cursor=zone;
  while(cursor.requires){assert.ok(!seen.has(cursor.id),'unlock cycle '+zone.id);seen.add(cursor.id);const parent=loc.zones.find(z=>z.id===cursor.requires);assert.ok(parent,'missing parent '+cursor.requires);cursor=parent;}
  const goal=GOALS.find(g=>g.kind==='zone'&&g.zone===zone.id);
  if(goal){assert.ok(goal.reward>=zone.cost*.2&&goal.reward<=zone.cost*.4,goal.id);}
 }
 const cash=GOALS.find(g=>g.kind==='cash')!;assert.equal(cash.target,BRANCH_COSTS.sahil);
 assert.ok(GOALS.find(g=>g.kind==='location'&&g.location==='sahil')!.reward<BRANCH_COSTS.sahil);
});
