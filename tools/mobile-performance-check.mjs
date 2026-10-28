import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const args=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=')));
const url=args.url??'http://127.0.0.1:4173/';
const out='.devshots/mobile-parity-2026-09-10/'+(args.phase??'performance');
await mkdir(out,{recursive:true});
const report={url,physicalPhone:false,modes:[],errors:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:384,height:832},deviceScaleFactor:2.8125,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  locale:'tr-TR',storageState:{cookies:[],origins:[]}});
 await context.addInitScript(()=>{
  localStorage.setItem('fincan-sokagi:settings:v2',JSON.stringify({quality:'high',qualityAuto:true,fps:'auto',muted:true,music:false}));
  let seed=417;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  let game;Object.defineProperty(window,'__fincan',{configurable:true,get:()=>game,set:g=>{game=g;g.persistDisabled=true;}});
 });
 report.viewport={width:384,height:832,dpr:2.8125};
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__fincan,null,{timeout:60000});
 await page.locator('#boot-screen').waitFor({state:'detached',timeout:30000});
 await page.evaluate(()=>{
  const g=window.__fincan,w=g.world;g.stop();g.state.tutorialStep=99;g.ui.setTutorial(null);g.ui.closePanels();
  for(const zone of w.loc.zones)if(!w.zoneUnlocked(zone.id))w.unlockZone(zone.id);
  Object.assign(g.state.staffCount,{waiter:2,barista:2,cashier:2,busser:2});w.syncStaff();g.ui.endCelebrate();
  g.player.setPosition(0,3);g.scene3d.snapTo(0,3);
  const draw=g.scene3d.render.bind(g.scene3d);g.scene3d.render=()=>{};
  for(let i=0;i<1800;i++)g.tick(1/30);
  g.scene3d.render=draw;draw();
  // Exercise moving-camera frames, including live characters and the full venue.
  g.input.update=()=>{Object.assign(g.input.move,{x:Math.sin(performance.now()/1800)>.0?.8:-.8,y:0,mag:.8,active:true});return g.input.move;};
  const render=g.scene3d.render.bind(g.scene3d);
  window.__mobileSamples=[];
  g.scene3d.render=()=>{
   const at=performance.now();render();
   window.__mobileSamples.push({at,work:performance.now()-at,path:g.scene3d.renderPath,pixels:g.scene3d.renderer.domElement.width*g.scene3d.renderer.domElement.height,shadows:g.scene3d.renderer.shadowMap.enabled});
  };
 });
 report.drawProfile=await page.evaluate(()=>{
  const g=window.__fincan,s=g.scene3d,histogram={},restores=[];
  for(const [id,v] of g.world.stationVisuals)v.root.userData.profileGroup=id;
  for(const [id,v] of g.world.pickupVisuals)v.root.userData.profileGroup=id;
  for(const c of g.world.customers)c.char.root.userData.profileGroup='customer';
  for(const c of g.world.staff)c.char.root.userData.profileGroup='staff';
  g.player.char.root.userData.profileGroup='player';
  s.scene.traverse(o=>{
   if(!o.isMesh&&!o.isSprite)return;
   const old=o.onBeforeRender;restores.push(()=>o.onBeforeRender=old);
   o.onBeforeRender=function(...args){
    old?.apply(this,args);let p=o,group='environment';
    while(p){if(p.userData.profileGroup){group=p.userData.profileGroup;break;}p=p.parent;}
    const key=group+':'+(o.material?.type??'multi')+':'+(o.name||o.parent?.name||'unnamed');
    histogram[key]=(histogram[key]??0)+1;
   };
  });
  try{s.haveCacheView=false;s.render();}finally{for(const restore of restores)restore();}
  return Object.entries(histogram).sort((a,b)=>b[1]-a[1]);
 });
 if(args.profile==='only')console.log(JSON.stringify(report.drawProfile));
 const cdp=await context.newCDPSession(page);
 for(const rate of args.profile==='only'?[]:[1,4]){
  await cdp.send('Emulation.setCPUThrottlingRate',{rate});
  await page.evaluate(()=>window.__fincan.start());
  await page.waitForTimeout(4000);
  await page.evaluate(()=>{window.__mobileSamples=[];window.__mobileStarted=performance.now();});
  await page.waitForTimeout(20000);
  const mode=await page.evaluate(()=>{
   const g=window.__fincan,s=g.scene3d,frames=window.__mobileSamples;g.stop();
   const elapsed=performance.now()-window.__mobileStarted;
   const intervals=frames.slice(1).map((f,i)=>f.at-frames[i].at).sort((a,b)=>a-b);
   const work=frames.map(f=>f.work).sort((a,b)=>a-b);
   const gl=s.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
   return {elapsedMs:elapsed,fps:frames.length/(elapsed/1000),intervalMedianMs:intervals[Math.floor(intervals.length*.5)],
    intervalP95Ms:intervals[Math.floor(intervals.length*.95)],framesOver100ms:intervals.filter(v=>v>100).length,
    renderMedianMs:work[Math.floor(work.length*.5)],renderP95Ms:work[Math.floor(work.length*.95)],
    pixels:[...new Set(frames.map(f=>f.pixels))],shadows:[...new Set(frames.map(f=>f.shadows))],paths:[...new Set(frames.map(f=>f.path))],
    characters:{customers:g.world.customers.length,staff:g.world.staff.length,player:g.player.char.root.userData.characterPack},
    drawCalls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,glError:gl.getError(),layout:g.world.validateLayout(),
    gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null};
  });
  report.modes.push({cpuSlowdown:rate,...mode});
  console.log(JSON.stringify(report.modes.at(-1)));
  assert.equal(mode.glError,0);assert.deepEqual(mode.layout,[]);
  assert.ok(mode.fps>=27,'Sustained desktop simulation below 27 FPS: '+mode.fps);
  assert.ok(mode.fps<=61,'Frame ceiling exceeded: '+mode.fps);
 }
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 await page.evaluate(()=>{const g=window.__fincan;g.ui.openPanel('settings');g.start();window.__mobileSamples=[];window.__menuStart=g.state.playTime;});
 await page.waitForTimeout(1200);
 report.menu=await page.evaluate(()=>{const g=window.__fincan;g.stop();return {draws:window.__mobileSamples.length,simulationSeconds:g.state.playTime-window.__menuStart};});
 assert.ok(report.menu.draws<=1);assert.equal(report.menu.simulationSeconds,0);
 assert.deepEqual(report.errors,[]);
} finally {
 await writeFile(out+'/result.json',JSON.stringify(report,null,2));
 await browser.close();
}
