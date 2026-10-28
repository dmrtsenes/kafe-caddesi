import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='.devshots/side-activities-integration-2026-09-07';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const report={errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1000,height:900},locale:'tr-TR'});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__fincan,undefined,{timeout:90000});await page.locator('#boot-screen').waitFor({state:'detached',timeout:90000});
 report.flow=await page.evaluate(async()=>{
  const g=window.__fincan,w=g.world,p=g.player;
  const {SIDE_GARDEN_LAYOUT:L}=await import('/src/data/sideGardenLayout.ts');
  g.stop();g.persistDisabled=true;g.ui.setTutorial(null);g.ui.closePanels();g.state.tutorialStep=99;
  const idle={x:0,y:0,mag:0,active:false},mods={spawnMult:0,valueMult:1,patienceMult:1,tipMult:1};
  const tick=(seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++){p.update(1/60,idle,w.nav,w.loc.bounds);w.update(1/60,p,mods);}};
  const at=(point)=>{p.setPosition(point.x,point.z);p.planarSpeed=0;p.interacting=false;};
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  const reachable=(id)=>{const dest=L[id].service,path=[];return w.nav.findPath(0,-6.8,dest.x,dest.z,path);};
  g.state.money=50000;at(L.garden.purchase);tick(6);
  assert(w.sideActivities.get('garden').level===0,'prerequisite prevents early payment');assert(g.state.money===50000,'locked prerequisite does not spend');
  assert(!reachable('garden'),'closed gate prevents access');
  w.unlockZone('a3');at(L.garden.purchase);tick(6);
  assert(w.sideActivities.get('garden').level===1,'garden purchased through real floor square');
  assert(Math.abs(g.state.money-49200)<.02,'correct initial cost');tick(5);assert(w.sideActivities.get('garden').level===1,'standing cannot buy next level');
  assert(reachable('garden'),'garden workbench reachable after purchase');
  assert(w.env.root.getObjectByName('sideGate_garden').visible===false,'gate visual opens');
  assert(w.env.root.getObjectByName('sideGate_courtyard').visible===true,'other gate stays closed');
  at(L.garden.service);p.dropAll();p.give('bulasik');tick(2);assert(p.hasItem('bulasik'),'wrong goods remain carried');
  p.dropAll();let job=w.sideActivities.get('garden');const item=job.lines[0].item;p.give(item);tick(1.4);
  job=w.sideActivities.get('garden');assert(job.lines[0].delivered===1,'actual inventory deposited once');assert(p.isEmpty,'deposited product removed from tray');
  const saved=w.save();w.load(saved);assert(w.sideActivities.get('garden').lines[0].delivered===1,'reload preserves partial delivery');
  assert(reachable('garden'),'reload preserves gate access');
  const before=g.state.money, sold=g.state.stats.sold, normalServed=g.state.stats.served;
  job=w.sideActivities.get('garden');for(const line of job.lines)for(let i=line.delivered;i<line.quantity;i++)p.give(line.item);
  tick(5.5);const done=w.sideActivities.get('garden');
  assert(done.completed===1,'manual packing completes exactly one order');
  assert(Math.abs(g.state.money-before-job.reward-job.bonus)<.02,'quoted reward credited once');
  assert(g.state.stats.sold===sold+job.lines.reduce((n,l)=>n+l.quantity,0),'real delivered units counted as sold');
  assert(g.state.stats.served===normalServed,'ordinary served count not fabricated');
  tick(5);assert(w.sideActivities.get('garden').completed===1,'standing cannot farm free orders');
  const post=w.save();const wallet=g.state.money;w.load(post);tick(3);assert(g.state.money===wallet,'completed save cannot pay twice');
  // Walking over an upgrade pad must not start payment.
  at(L.garden.purchase);p.planarSpeed=4;w.updateSideActivities(0.2,p);assert(w.sideActivities.get('garden').purchaseDeposit===0,'walk-through does not charge');
  at({x:0,z:-6.8});tick(.1);at(L.garden.purchase);tick(5);assert(w.sideActivities.get('garden').level===2,'second level requires a new visit');
  at({x:0,z:-6.8});tick(.1);at(L.garden.purchase);tick(5);assert(w.sideActivities.get('garden').level===3,'automatic packing unlocked');
  assert(w.env.root.getObjectByName('sideLevel_garden_3').visible,'purchased packing equipment visible');
  // Fill the order at the actual interaction point, then leave while it packs.
  job=w.sideActivities.get('garden');at(L.garden.service);p.dropAll();
  for(const line of job.lines)for(let i=line.delivered;i<line.quantity;i++){p.give(line.item);tick(.85);}
  assert(w.sideActivities.get('garden').phase==='packing','all products loaded for automatic packing');
  at({x:0,z:-6.8});const paused=w.sideActivities.get('garden').workProgress;
  w.updateBackground(60);assert(w.sideActivities.get('garden').workProgress===paused,'inactive branch does not process side orders');
  const autoBefore=g.state.money;tick(7);assert(w.sideActivities.get('garden').completed===2,'active branch automatic packing pays once');
  assert(g.state.money>autoBefore,'automatic completed order credited');
  w.unlockZone('a4');w.unlockZone('a5');at(L.courtyard.purchase);tick(6);
  assert(w.sideActivities.get('courtyard').level===1,'second activity purchases independently');assert(reachable('courtyard'),'second workbench reachable');
  assert(w.sideActivities.get('garden').level===3,'first activity preserved');
  w.selectedSideActivity=null;g.focusSideActivity('courtyard');assert(w.selectedSideActivity==='courtyard','HUD routes selected work');
  g.focusSideActivity('courtyard');assert(w.selectedSideActivity===null,'HUD can return to ordinary cafe work');
  const late=[];for(const zone of w.loc.zones){if(!w.zoneUnlocked(zone.id))w.unlockZone(zone.id);const problems=w.validateLayout();if(problems.length)late.push({id:zone.id,problems});}
  assert(late.length===0,'all ordinary zone layouts remain valid '+JSON.stringify(late));assert(reachable('garden')&&reachable('courtyard'),'late-game workbench routes stay open');
  window.__sideTest={g,w,p,at,tick,L};
  return {garden:w.sideActivities.get('garden'),courtyard:w.sideActivities.get('courtyard'),layout:w.validateLayout(),cast:p.char.root.userData.characterPack};
 });
 console.log(JSON.stringify(report.flow));
 for(const size of [{width:1000,height:900},{width:390,height:844},{width:320,height:740}]){
  await page.setViewportSize(size);
  for(const id of ['garden','courtyard']){
   await page.evaluate(({id})=>{const {g,p,w,at,L}=window.__sideTest;at(L[id].service);g.scene3d.setOpeningFrame(false);g.scene3d.resize();g.scene3d.snapTo(p.x,p.z);for(let i=0;i<60;i++){g.stepVisual(1/60);w.updateSideActivities(1/60,null);}g.ui.update?.(1/60);g.scene3d.invalidateStatic();g.scene3d.invalidateShadows();g.scene3d.render();},{id});
   await page.screenshot({path:`${out}/${id}-${size.width}.png`});
  }
 }
 const expected=await page.evaluate(()=>{const {g,w}=window.__sideTest;g.persistDisabled=false;g.persist();return {money:g.state.money,side:w.sideActivities.snapshot()};});
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__fincan,undefined,{timeout:90000});
 const restored=await page.evaluate(()=>{const g=window.__fincan;g.stop();return {money:g.state.money,side:g.world.sideActivities.snapshot(),gate:g.world.env.root.getObjectByName('sideGate_garden').visible};});
 assert.ok(Math.abs(restored.money-expected.money)<=.001,'real browser reload preserves wallet without duplicate side payout');
 assert.deepEqual(restored.side,expected.side,'real save writer and load restore every side state');assert.equal(restored.gate,false);
 report.reloaded=true;
 assert.deepEqual(report.errors,[]);await writeFile(out+'/results.json',JSON.stringify(report,null,2));console.log('Side work integration passed.');
}finally{await browser.close();}
