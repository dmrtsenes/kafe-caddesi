import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const phase=process.argv.includes('--before')?'before':'after';
const comparison=process.argv.includes('--comparison');
const output='.devshots/player-focus-2026-09-07/'+phase+(comparison?'-comparison':'');
const origin='http://127.0.0.1:5342';await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:5342,strictPort:true,hmr:false,open:false}});
let browser;const report={phase,views:[],errors:[]};
try{
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 for(const fixture of [{w:390,h:844,lang:'tr'},{w:320,h:740,lang:'en'},{w:844,h:390,lang:'tr'}]){
  const context=await browser.newContext({viewport:{width:fixture.w,height:fixture.h},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();console.log('fixture '+fixture.w+' '+phase);page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(lang=>localStorage.setItem('fincan-sokagi:language:v1',lang),fixture.lang);
  await page.goto(origin+(comparison?'/':'/?characters=quaternius'),{waitUntil:'commit',timeout:90000});
  await page.waitForFunction(()=>!!window.__fincan,undefined,{timeout:90000});await page.locator('#boot-screen').waitFor({state:'detached'});await page.evaluate(()=>window.__fincan.stop());
  for(const stage of ['first','service','garden']){
   const state=await page.evaluate(stage=>{
    const g=window.__fincan,w=g.world,p=g.player;
    if(stage!=='first'){
     g.state.tutorialStep=99;g.ui.setTutorial(null);g.state.money=4000;
     for(const zone of w.loc.zones)if(!w.zoneUnlocked(zone.id))w.unlockZone(zone.id);
     g.ui.endCelebrate();
     if(stage==='service'){p.setPosition(-2,-2);p.give('cay');}else p.setPosition(-12,-6);
     w.updateGuide(.3,p);
    }
    g.scene3d.snapTo(p.x,p.z);
    for(let n=0;n<120;n++)g.stepVisual(1/60);
    g.scene3d.render();
    const foot=g.scene3d.project(p.x,p.floorY,p.z,{x:0,y:0,behind:false});
    const head=g.scene3d.project(p.x,p.floorY+p.char.height,p.z,{x:0,y:0,behind:false});
    const box=document.querySelector('.hud-stack').getBoundingClientRect();
    const co=w.counters.find(co=>!co.locked);
    const counterSides=[-1.1,1.1].map(dx=>g.scene3d.project(co.x+dx,1,co.z,{x:0,y:0,behind:false}));
    const activeAction=w.currentAction?.label??'';
    const ground=p.char.root.position.clone();g.scene3d.screenToGround(foot.x,foot.y,ground);
    const projectionError=Math.hypot(ground.x-p.x,ground.z-p.z);
    return {stage,foot,head,counterSides,activeAction,projectionError,heightPx:foot.y-head.y,hudBottom:box.bottom,overflow:document.documentElement.scrollWidth>innerWidth+1,
     action:document.querySelector('.hud-action')?.textContent??'',layout:w.validateLayout(),distance:g.scene3d.distance,fov:g.scene3d.camera.fov};
   },stage);
   await page.screenshot({path:output+'/'+fixture.w+'-'+stage+'.png'});report.views.push({...fixture,...state});await writeFile(output+'/results.json',JSON.stringify(report,null,2));
   assert.equal(state.overflow,false);assert.deepEqual(state.layout,[]);assert.ok(state.projectionError<.001,'screen and ground agree');
   if(phase==='after'){
    assert.ok(state.heightPx/fixture.h>=.075,'player must be readable at '+fixture.w+'/'+stage+': '+state.heightPx);
    assert.ok(state.foot.x>fixture.w*.17&&state.foot.x<fixture.w*.83,'player horizontal safe area');
    assert.ok(state.head.y>state.hudBottom-4,'player must not hide under HUD');
    if(stage==='first')assert.ok(state.counterSides.every(p=>p.x>0&&p.x<fixture.w&&p.y>state.hudBottom&&p.y<fixture.h),'first counter must fit the phone');
    else {assert.ok(state.action);assert.equal(state.action,state.activeAction,'HUD and world guide agree');}
   }
  }
  if(phase==='after') {
   const drawer=page.locator('.side-jobs-toggle');await drawer.click();
   assert.equal(await drawer.getAttribute('aria-expanded'),'true');
   await page.locator('.side-job[data-activity="garden"]').click();
   assert.equal(await drawer.getAttribute('aria-expanded'),'false');
   const selected=await page.evaluate(()=>window.__fincan.world.selectedSideActivity);
   assert.equal(selected,'garden');
   await page.evaluate(()=>{const g=window.__fincan;g.world.updateGuide(.3,g.player);g.ui.update(.2)});
   await page.screenshot({path:output+'/'+fixture.w+'-selected.png'});
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);await writeFile(output+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.views.map(v=>({width:v.w,stage:v.stage,playerPx:Math.round(v.heightPx),hudBottom:Math.round(v.hudBottom)}))));
}finally{await browser?.close();await server.close();}
