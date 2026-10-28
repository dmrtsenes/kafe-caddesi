import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6)??'http://127.0.0.1:5367/';
const phase=process.argv.find(a=>a.startsWith('--phase='))?.slice(8)??'device-load';
if(!/^[a-z0-9-]+$/.test(phase))throw new Error('Invalid phase');
const out='.devshots/premium-performance/'+phase;await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,storageState:{cookies:[],origins:[]}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{
  localStorage.setItem('fincan-sokagi:settings:v2',JSON.stringify({quality:'low',qualityAuto:false,fps:30,music:false,muted:true}));
  let game;Object.defineProperty(window,'__fincan',{get:()=>game,set:g=>{game=g;g.persistDisabled=true;}});
 });
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.__fincan,null,{timeout:90000});await page.locator('#boot-screen').waitFor({state:'detached',timeout:90000});
 await page.evaluate(()=>{
  const g=window.__fincan,w=g.world;g.stop();g.state.tutorialStep=99;g.ui.setTutorial(null);g.ui.closePanels();
  for(const zone of w.loc.zones)if(!w.zoneUnlocked(zone.id))w.unlockZone(zone.id);
  Object.assign(g.state.staffCount,{waiter:2,barista:2,cashier:2,busser:2});w.syncStaff();g.ui.endCelebrate();g.player.setPosition(0,3);
  const draw=g.scene3d.render.bind(g.scene3d);g.scene3d.render=()=>{};for(let n=0;n<2700;n++)g.tick(1/30);g.scene3d.render=draw;g.scene3d.render();
 });
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.evaluate(()=>window.__fincan.start());await page.waitForTimeout(2000);
 await page.evaluate(()=>{
  const g=window.__fincan,s=g.scene3d;window.__loadSamples=[];window.__loadStart=performance.now();window.__loadPlayTime=g.state.playTime;
  window.__loadOriginalRender=s.render.bind(s);s.render=()=>{const at=performance.now();window.__loadOriginalRender();window.__loadSamples.push({at,work:performance.now()-at,hz:g.refreshHz});};
 });
 await page.waitForTimeout(30000);
 const result=await page.evaluate(()=>{
  const g=window.__fincan,s=g.scene3d,frames=window.__loadSamples;g.stop();
  const elapsed=performance.now()-window.__loadStart,intervals=frames.slice(1).map((f,i)=>f.at-frames[i].at).sort((a,b)=>a-b),work=frames.map(f=>f.work).sort((a,b)=>a-b);
  const gl=s.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  return {cpuSlowdown:4,requestedFps:g.settings.get('fps'),refreshEstimates:[...new Set(frames.map(f=>f.hz))],elapsedMs:elapsed,frames:frames.length,fps:frames.length/(elapsed/1000),frameIntervalMedianMs:intervals[Math.floor(intervals.length*.5)],frameIntervalP95Ms:intervals[Math.floor(intervals.length*.95)],renderWorkMedianMs:work[Math.floor(work.length*.5)],renderWorkP95Ms:work[Math.floor(work.length*.95)],framesOver50ms:intervals.filter(t=>t>50).length,framesOver100ms:intervals.filter(t=>t>100).length,customers:g.world.customers.length,staff:g.world.staff.length,gameSeconds:g.state.playTime-window.__loadPlayTime,pixels:s.renderer.domElement.width*s.renderer.domElement.height,memory:{...s.renderer.info.memory},gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,errors:gl.getError(),layout:g.world.validateLayout()};
 });
 await page.evaluate(()=>{const g=window.__fincan;g.ui.openPanel('settings');g.start();window.__loadSamples.length=0;window.__loadPlayTime=g.state.playTime;});await page.waitForTimeout(1500);
 result.menu=await page.evaluate(()=>{const g=window.__fincan;g.stop();return {draws:window.__loadSamples.length,simulationDelta:g.state.playTime-window.__loadPlayTime};});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 await page.screenshot({path:out+'/screen.png'});await writeFile(out+'/result.json',JSON.stringify({result,errors},null,2));
 assert.deepEqual(errors,[]);assert.equal(result.errors,0);assert.deepEqual(result.layout,[]);
 assert.ok(result.fps>=24,'Sustained frame rate below the test budget: '+result.fps);assert.ok(result.fps<=31,'Frame cap exceeded: '+result.fps);
 assert.equal(result.menu.simulationDelta,0);assert.ok(result.menu.draws<=1);
 console.log(JSON.stringify(result));
}finally{await browser.close();}
