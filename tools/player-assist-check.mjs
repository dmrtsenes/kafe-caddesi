import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';import {createServer} from 'vite';
const output='.devshots/player-assists-2026-09-07';await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:5343,strictPort:true,hmr:false,open:false}});
let browser;const errors=[];
try{
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5343/?characters=quaternius',{waitUntil:'commit',timeout:90000});
 await page.waitForFunction(()=>!!window.__fincan,undefined,{timeout:90000});await page.locator('#boot-screen').waitFor({state:'detached'});
 const result=await page.evaluate(async()=>{
  const g=window.__fincan;g.stop();const w=g.world,p=g.player;
  const {Order}=await import('/src/sim/Orders.ts');
  const {Customer}=await import('/src/entities/Customer.ts');
  const {CUSTOMER_ARCHETYPES}=await import('/src/data/customers.ts');
  const mods={spawnMult:1,valueMult:1,patienceMult:1,tipMult:1};
  g.state.tutorialStep=99;g.ui.setTutorial(null);
  for(const zone of w.loc.zones)if(!w.zoneUnlocked(zone.id))w.unlockZone(zone.id);
  g.ui.endCelebrate();w.vfx=null;w.spawnTimer=1e9;w.dustTimer=1e9;
  for(const c of w.customers)c.dispose();w.customers.length=0;
  for(const co of w.counters)co.queue.length=0;
  for(const t of w.tables){t.dishes=0;t.soil=0;t.cleanValue=0;t.seatTaken.fill(false);t.seatedGuests.length=0;}
  for(const role of ['waiter','cashier','busser','barista']){g.state.staffCount[role]=g.state.activeStaffCapFor(role);g.state.staffLevel[role]=10;}
  w.syncStaff();w.assistPlayer=p;
  const point={x:0,z:0},source=w.machines.find(m=>m.def.item==='cay'&&!m.locked);
  const waiter=w.staff.find(s=>s.role==='waiter');
  const shelf=w.pickups.find(s=>!s.locked&&s.def.item==='cay');
  source.servicePoint(point);p.setPosition(point.x,point.z);p.dropAll();p.noTakeFrom=null;p.hasVacuum=false;
  source.output=3;shelf.contents.length=0;
  waiter.clearJob();waiter.source=source;waiter.dest=shelf;waiter.job='fetch';waiter.setPosition(point.x,point.z);
  for(let i=0;i<5;i++){waiter.handTimer=0;w.doFetch(waiter,1/30);}
  const reserved={staff:waiter.carryCount,remaining:source.output};
  for(let i=0;i<120;i++)w.updateStationInteraction(1/30,p);
  const playerReceived=p.hasItem('cay');
  // Once the player has left, even the last product remains useful to the helper.
  p.setPosition(-20,-20);source.output=1;waiter.dropAll();waiter.source=source;waiter.dest=shelf;waiter.job='fetch';waiter.handTimer=0;
  source.servicePoint(point);waiter.setPosition(point.x,point.z);w.doFetch(waiter,1/30);
  const afterLeave={staff:waiter.carryCount,remaining:source.output};
  // Player starts a real table clean-up and carries dishes to the bin.
  const tables=w.tables.filter(t=>!t.locked);const mine=tables[0],other=tables[1];
  p.dropAll();p.noTakeFrom=null;p.noDropTo=null;p.planarSpeed=0;
  mine.dishes=2;mine.soil=.65;mine.cleanStartSoil=.65;mine.dirtyAge=40;mine.servicePoint(point);p.setPosition(point.x,point.z);
  for(let i=0;i<120&&mine.dishes>0;i++){w.updateStaff(1/30);w.updateStationInteraction(1/30,p);}
  const started={held:p.slots.slice(),dishes:mine.dishes,soil:mine.soil,lease:w.playerCare?.id};
  p.setPosition(-20,-20);other.dishes=2;other.soil=.65;other.cleanStartSoil=.65;other.dirtyAge=40;
  for(let n=0;n<30*25;n++)w.update(1/30,p,mods);
  const care={mineStillDirty:mine.isDirty,otherReady:!other.isDirty,mineSoil:mine.soil};
  // Serve a real seated customer with maximum helpers: staff never consumes that order.
  p.dropAll();w.playerCare=null;mine.dishes=0;mine.soil=0;mine.cleanValue=0;
  const c=new Customer(CUSTOMER_ARCHETYPES[0],'focus-guest');c.dineIn=true;c.table=mine;c.state='seated';c.order=new Order([{item:'cay',qty:1,served:0}]);
  c.seatIndex=0;mine.seatTaken[0]=true;mine.seatedGuests.push(c);c.patience=c.maxPatience=10000;
  c.setPosition(mine.x,mine.z);w.customers.push(c);w.root.add(c.char.root);
  const beforeMoney=g.state.money;
  for(let n=0;n<30*12;n++)w.update(1/30,p,mods);
  const stillNeedsPlayer=c.order.remainingOf('cay');
  p.give('cay');mine.servicePoint(point);p.setPosition(point.x,point.z);p.planarSpeed=0;
  for(let n=0;n<120&&c.order.remainingOf('cay');n++)w.updateStationInteraction(1/30,p);
  const manualServed=c.order.remainingOf('cay')===0;
  const cashStayedManual=g.state.money===beforeMoney;
  const co=w.counters.find(c=>!c.locked);
  const benefits={cashier:co.counterOrderTime('cashier',0),cashierUpgraded:co.counterOrderTime('cashier',10),
   player:co.counterOrderTime('player'),roles:w.staff.map(s=>({role:s.role,job:s.job})),
   menu:g.getStaff().map(r=>({id:r.id,scope:r.scopeText,effect:r.effectText,next:r.nextEffectText}))};
  return{reserved,playerReceived,afterLeave,started,care,stillNeedsPlayer,manualServed,cashStayedManual,benefits,layout:w.validateLayout()};
 });
 await writeFile(output+'/results.json',JSON.stringify({result,errors},null,2));
 assert.deepEqual(result.reserved,{staff:2,remaining:1});assert.equal(result.playerReceived,true);
 assert.deepEqual(result.afterLeave,{staff:1,remaining:0});
 assert.ok(result.started.held.includes('bulasik'));assert.equal(result.care.mineStillDirty,true);assert.equal(result.care.otherReady,true);
 assert.equal(result.stillNeedsPlayer,1);assert.equal(result.manualServed,true);assert.equal(result.cashStayedManual,true);
 assert.ok(result.benefits.cashierUpgraded<result.benefits.cashier);
 assert.ok(result.benefits.menu.every(row=>row.scope.includes('Sen:')));
 assert.ok(result.benefits.roles.every(s=>!['serve','mop','supply'].includes(s.job)));
 assert.deepEqual(result.layout,[]);assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
}finally{await browser?.close();await server.close();}
