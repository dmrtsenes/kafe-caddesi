// Real game captures in two native UI languages. No application source writes.
import { chromium } from 'playwright';
import { mkdir,readFile,writeFile,readdir } from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root='store-assets/global-v2',base=process.env.STORE_GAME_URL||'http://127.0.0.1:5187/';
await mkdir(root+'/research',{recursive:true});
const before={};
async function fingerprint(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await fingerprint(p);else before[p]=createHash('sha256').update(await readFile(p)).digest('hex');}}
for(const dir of ['src','public','docs'])await fingerprint(dir);
for(const p of ['README.md','index.html','package.json','package-lock.json','capacitor.config.ts','vite.config.ts','android/app/build.gradle','android/app/src/main/AndroidManifest.xml'])before[p]=createHash('sha256').update(await readFile(p)).digest('hex');
await writeFile(root+'/research/project-before.json',JSON.stringify(before,null,2));
const originalBot=await readFile('tools/balance-bot.js','utf8');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{for(const lang of ['tr','en']){
 const ctx=await browser.newContext({viewport:{width:540,height:960},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:lang==='tr'?'tr-TR':'en-GB'});
 const page=await ctx.newPage();page.setDefaultTimeout(180000);
 const errors=[],failedRequests=[],captures=[],runs=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failedRequests.push({url:r.url(),status:r.status()});});
 await page.addInitScript(lang=>{localStorage.setItem('fincan-sokagi:language:v1',lang);let seed=20260913;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);},lang);
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__fincan);await page.locator('#boot-screen').waitFor({state:'detached'});
 await page.evaluate(async()=>{const g=window.__fincan;g.stop();g.persistDisabled=true;g.setSetting('muted',true);window.__storeReturnVacuum=(await import('/src/core/I18n.ts')).tr('SÜPÜRGEYİ BIRAK düğmesine dokun');});
 await page.addScriptTag({content:originalBot.replace('done++;','done++; if(window.__captureCondition?.(g,t)) checkpoint=true;').replace('function botThink() {',`function botThink(){
 if(window.__captureTarget==='clean' && !g.player.hasVacuum && g.player.isEmpty)g.toggleVacuum();
 if(window.__captureTarget!=='clean' && g.player.hasVacuum && g.world.currentAction?.label===window.__storeReturnVacuum)g.toggleVacuum();`)});
 async function advance(minutes,target=null){
  const r=await page.evaluate(({minutes,target})=>{
   const g=window.__fincan,served=g.state.stats.served,earned=g.state.totalEarned;window.__captureTarget=target;
   window.__captureCondition=target?(g,t)=>{if(t<1)return false;const p=g.player,w=g.world;
    if(target==='serve')return p.interacting&&p.planarSpeed<.6&&String(w.armKey).startsWith('serve:')&&p.slots.some(s=>['cay','latte','tost','waffle','frappe'].includes(s))&&w.tables.some(tb=>!tb.locked&&tb.seatedGuests.length&&Math.hypot(tb.x-p.x,tb.z-p.z)<3)&&g.state.stats.served>served;
    if(target==='production')return p.interacting&&p.carryCount>0&&String(w.armKey).startsWith('take:')&&w.machines.some(m=>!m.locked&&Math.hypot(m.x-p.x,m.z-p.z)<3);
    if(target==='cash')return p.interacting&&p.interactionKind==='cash'&&g.state.totalEarned>earned;
    if(target==='clean')return p.hasVacuum&&p.interacting&&p.interactionKind==='mop';
    if(target==='expanded')return w.zoneUnlocked('r1')&&p.x>10&&p.z>12&&p.z<17;
    return false;
   }:null;
   const r=window.__runBalanceBot({minutes,sync:true,resume:true});return{...r,matched:!target||!!window.__captureCondition(g,2)};
  },{minutes,target});
  assert.ok(!r.error,r.error);assert.ok(r.matched,lang+' missing actual interaction '+target);runs.push(r);console.log(`${lang} ${target||'progress'}: ${r.served} served, ${r.finalEarned} earned`);
 }
 async function capture(id,description){
  await page.evaluate(()=>{const g=window.__fincan;g.stop();for(let i=0;i<60;i++)g.stepVisual(1/60);for(let i=0;i<600;i++)g.ui.update(1/30);g.scene3d.render();});
  if(await page.locator('.adchip-x').isVisible())await page.locator('.adchip-x').click();
  await page.waitForTimeout(250);
  const record=await page.evaluate(()=>{const g=window.__fincan,p=g.player,w=g.world;return{
   locale:document.documentElement.lang,playTime:g.state.playTime,state:g.state.save(),player:{x:p.x,z:p.z,slots:[...p.slots],interaction:p.interactionKind,interacting:p.interacting,vacuum:p.hasVacuum,armKey:w.armKey,model:p.char.root.userData.characterModel},
   world:{id:w.loc.id,stations:w.stations.map(s=>({id:s.id,x:s.x,z:s.z,kind:s.def.kind,locked:s.locked,stock:s.output,cash:s.cash,soil:s.soil,dishes:s.dishes})),customers:w.customers.map(c=>({state:c.state,table:c.table?.id,order:c.order?.lines})),staff:w.staff.map(s=>({role:s.role,x:s.x,z:s.z}))},
   ui:document.body.innerText,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},renderer:{width:g.scene3d.renderer.domElement.width,height:g.scene3d.renderer.domElement.height},camera:{fov:g.scene3d.camera.fov,framing:g.scene3d.framing},overflow:document.documentElement.scrollWidth>innerWidth,debugHud:!!document.querySelector('#perf-hud')};});
  assert.equal(record.locale,lang);assert.equal(record.overflow,false);
  await mkdir(root+'/captures/'+lang,{recursive:true});await page.screenshot({path:`${root}/captures/${lang}/${id}.png`});
  captures.push({id,description,...record});await writeFile(`${root}/research/capture-${lang}.json`,JSON.stringify({method:'Normal game and earned progression; native language loaded before modules; default camera and rendering; isolated profile; accelerated genuine simulation.',base,lang,captures,errors,failedRequests},null,2));
 }
 await advance(10);await advance(8,'clean');await capture('03-clean','Powered vacuum cleaning actual traffic dirt');
 await advance(18);await advance(8,'serve');await capture('01-serve','Hands-on serving of a requested product to seated guests');
 await advance(8,'production');await capture('02-production','Actual item pickup at a production station');
 await advance(8,'cash');await capture('04-cash','Actual earned income collected at the counter');
 // Move to a later, earned business state for useful staff choices and expanded rooms.
 await advance(45);await page.evaluate(()=>window.__fincan.ui.openPanel('staff'));await capture('05-staff','Native staff panel and real bought roles');
 await page.evaluate(()=>window.__fincan.ui.closePanels());await advance(14,'expanded');await capture('06-growth','An earned salon expansion, with its actual tables and purchase pads');
 await writeFile(`${root}/research/playthrough-${lang}.json`,JSON.stringify(runs,null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);await ctx.close();
}}finally{await browser.close();}
