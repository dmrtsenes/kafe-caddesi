// Captures the normal game, using earned progression and the existing movement bot.
// No character, map, lighting, save key, balance or application file is changed.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.STORE_GAME_URL || 'http://127.0.0.1:5187/';
const out = 'store-assets/captures';
await mkdir(out, {recursive:true});
const browser = await chromium.launch({channel:'chrome', headless:true, args:['--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport:{width:540,height:820},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'tr-TR'});
const page = await context.newPage(); page.setDefaultTimeout(180000);
const errors=[], failedRequests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)failedRequests.push({url:r.url(),status:r.status()});});
await page.addInitScript(()=>{let seed=20260913;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);});
await page.goto(base,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!!window.__fincan);
await page.locator('#boot-screen').waitFor({state:'detached'});
await page.evaluate(()=>{const g=window.__fincan;g.stop();g.persistDisabled=true;g.setSetting('muted',true);});
// A single early-stop hook lets the unchanged bot pause at an observed interaction.
// The original source is read, not overwritten. All purchases use actual earned money.
const originalBot=await readFile('tools/balance-bot.js','utf8');
assert.ok(originalBot.includes('done++;'));
await page.addScriptTag({content:originalBot
  .replace('done++;','done++; if(window.__storeCaptureCondition?.(g,t)) checkpoint=true;')
  // The shipped bot predates the explicit return-vacuum button. Operate that
  // same UI action when the live game asks for it; do not alter the game rule.
  .replace('function botThink() {', `function botThink() {
    if (window.__storeTarget === 'clean' && !g.player.hasVacuum && g.player.isEmpty) g.toggleVacuum();
    if (window.__storeTarget !== 'clean' && g.player.hasVacuum && String(g.world.currentAction?.label).includes('SÜPÜRGEYİ BIRAK')) g.toggleVacuum();`)
});
const captures=[], playthrough=[];
async function advance(minutes,target=null){
  const result=await page.evaluate(({minutes,target})=>{
    const g=window.__fincan,oldServed=g.state.stats.served,oldMoney=g.state.totalEarned;
    window.__storeTarget=target;
    window.__storeCaptureCondition=target ? (g,t)=>{
      const p=g.player,w=g.world;
      if(t<1)return false;
      if(target==='serve')return p.interacting&&p.interactionKind==='reach'&&String(w.armKey).startsWith('serve:')&&p.slots.some(s=>['cay','latte','tost','waffle','frappe'].includes(s))&&w.tables.some(tb=>!tb.locked&&tb.seatedGuests.length>0&&Math.hypot(tb.x-p.x,tb.z-p.z)<3)&&g.state.stats.served>oldServed;
      if(target==='cash')return p.interacting&&p.interactionKind==='cash'&&g.state.totalEarned>oldMoney;
      if(target==='clean')return p.hasVacuum&&p.interacting&&p.interactionKind==='mop';
      if(target==='production')return p.interacting&&p.interactionKind==='reach'&&p.carryCount>0&&w.machines.some(m=>!m.locked&&Math.hypot(m.x-p.x,m.z-p.z)<3);
      if(target==='expanded')return w.zoneUnlocked('r1')&&p.x>10&&p.z>12&&p.z<17;
      return false;
    }:null;
    const result=window.__runBalanceBot({minutes,sync:true,resume:true});
    return {...result,matched:target?!!window.__storeCaptureCondition(g,2):true};
  },{minutes,target});
  assert.ok(!result.error,result.error);playthrough.push(result);
  if(target) assert.ok(result.matched, 'Actual interaction not found: '+target);
  console.log(JSON.stringify({target,minutes:result.minutes,served:result.served,earned:result.finalEarned,zones:Object.keys(result.zoneTimes),position:result.lastPosition}));
}
async function capture(id,description){
  await page.evaluate(()=>{const g=window.__fincan;g.stop();for(let i=0;i<90;i++)g.stepVisual(1/60);g.scene3d.render();});
  // Expire ordinary transient toasts using the game's own UI update only.
  await page.evaluate(()=>{const g=window.__fincan;for(let i=0;i<600;i++)g.ui.update(1/30);g.scene3d.render();});
  // Close an optional offer through its existing close control.
  if(await page.locator('.adchip-x').isVisible())await page.locator('.adchip-x').click();
  await page.waitForTimeout(350);
  const evidence=await page.evaluate(()=>{const g=window.__fincan,p=g.player,w=g.world;return{
    playTime:g.state.playTime,state:g.state.save(),player:{x:p.x,z:p.z,slots:[...p.slots],interaction:p.interactionKind,interacting:p.interacting,vacuum:p.hasVacuum,model:p.char.root.userData.characterModel},
    world:{id:w.loc.id,layout:w.stations.map(s=>({id:s.id,x:s.x,z:s.z,kind:s.def.kind,locked:s.locked,stock:s.output,cash:s.cash,soil:s.soil,dishes:s.dishes})),customers:w.customers.map(c=>({state:c.state,table:c.table?.id,order:c.order?.lines})),staff:w.staff.map(s=>({role:s.role,x:s.x,z:s.z}))},
    ui:document.body.innerText,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},canvas:{width:g.scene3d.renderer.domElement.width,height:g.scene3d.renderer.domElement.height},camera:{fov:g.scene3d.camera.fov,framing:g.scene3d.framing},
    docOverflow:document.documentElement.scrollWidth>innerWidth,debugHud:!!document.querySelector('#perf-hud')};});
  await page.screenshot({path:`${out}/${id}.png`});
  captures.push({id,description,...evidence});
  await writeFile('store-assets/audit/capture-evidence.json',JSON.stringify({date:'2026-09-13',url:base,method:'Normal game; accelerated genuine movement and earned progression; default camera/materials; isolated profile; no staged characters or injected money',captures,errors,failedRequests},null,2));
}
try{
 await advance(10);
 await advance(8,'clean');await capture('03-clean','Actual powered vacuum cleaning of traffic dirt');
 await advance(18);
 await writeFile(out+'/earned-midgame-save.json',JSON.stringify(await page.evaluate(()=>({state:window.__fincan.state.save(),worlds:Object.fromEntries([...window.__fincan.worlds].map(([id,w])=>[id,w.save()]))})),null,2));
 await advance(4,'serve');await capture('01-serve','Actual tray delivery to seated customers');
 await advance(4,'production');await capture('02-production','Taking actual products from the cafe production stations');
 await advance(4,'cash');await capture('04-cash','Actual collection of cafe earnings');
 await page.evaluate(()=>window.__fincan.ui.openPanel('staff'));await capture('05-staff','Existing staff management screen and purchased roles');
 await page.evaluate(()=>window.__fincan.ui.closePanels());
 await advance(45);
 await page.evaluate(()=>window.__fincan.ui.openPanel('locations'));await capture('branches-evidence','Real branch expansion requirements; supporting evidence');
 await page.evaluate(()=>window.__fincan.ui.closePanels());
 await advance(12,'expanded');await capture('06-growth','Player in the salon room unlocked through earned progression; real current room layout');
 await writeFile('store-assets/audit/playthroughs.json',JSON.stringify(playthrough,null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);
}finally{await browser.close();}
