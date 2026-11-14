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
 const cash=GOALS.find(g=>g.kind==='cash'||g.id==='g30')!;assert.equal(cash.target,BRANCH_COSTS.sahil);
 assert.ok(GOALS.find(g=>g.kind==='location'&&g.location==='sahil')!.reward<BRANCH_COSTS.sahil);
 // Progression pacing sanity: busser precedes barista, barista precedes VIP r2, Sahil p2..p5 ascend monotonically.
 const z=LOCATIONS.kose.zones;
 const costOf=(id:string)=>z.find(x=>x.id===id)!.cost;
 assert.ok(costOf('a3')<costOf('a4')&&costOf('a4')<costOf('a6')&&costOf('a6')<costOf('r1')&&costOf('r1')<costOf('a8')&&costOf('a8')<costOf('r2'));
 const sz=LOCATIONS.sahil.zones;
 const scost=(id:string)=>sz.find(x=>x.id===id)!.cost;
 assert.ok(scost('p2')<scost('p6')&&scost('p6')<scost('p3')&&scost('p3')<scost('p4')&&scost('p4')<scost('p5'));
});
