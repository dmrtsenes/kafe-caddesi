import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const phase = process.argv.find(a=>a.startsWith('--phase='))?.slice(8) ?? 'after';
const output = '.devshots/unlock-flow-' + phase;
await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:5231,strictPort:true,open:false,hmr:false}});
let browser;
try {
 await server.listen();
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:520,height:880},locale:'tr-TR'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('fincan-sokagi:settings:v2',JSON.stringify({quality:'low',qualityAuto:false,muted:true,music:false,fps:30})));
 await page.goto('http://127.0.0.1:5231/?testRun=unlock-flow', {waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!!window.__fincan,undefined,{timeout:60000});
 await page.locator('#boot-screen').waitFor({state:'detached'});
 await page.evaluate(()=>{const g=window.__fincan;g.stop();g.ui.setTutorial(null);g.ui.closePanels();g.state.tutorialStep=99;});
 await page.screenshot({path:output+'/initial.png'});
 const timings=await page.evaluate(async()=>{
  const g=window.__fincan,w=g.world,stages=[];
  const counts={},costs={};
  for(const [obj,key,label] of [[w,'validateLayout','validation'],[w,'rebuildNav','navigation'],[w.env,'optimizeStatic','staticMerge']]){
   const original=obj[key].bind(obj);obj[key]=(...args)=>{const t=performance.now();try{return original(...args);}finally{counts[label]=(counts[label]??0)+1;costs[label]=(costs[label]??0)+performance.now()-t;}};
  }
  const candidates=w.loc.zones.filter(z=>z.cost>0).slice(0,9);
  for(const zone of candidates){
   if(w.zoneUnlocked(zone.id))continue;
   if(zone.requires&&!w.zoneUnlocked(zone.requires))continue;
   const before={...costs},calls={...counts};const t=performance.now();
   w.unlockZone(zone.id);const actionMs=performance.now()-t;
   g.ui.endCelebrate();
   const frames=[], frameDetails=[];
   for(let i=0;i<32;i++){const start=performance.now();g.stepSim(1/30);g.stepVisual(1/30);const updated=performance.now();g.scene3d.render();const ended=performance.now();frames.push(ended-start);frameDetails.push({frame:i,updateMs:updated-start,renderMs:ended-updated,programs:g.scene3d.renderer.info.programs.length,textures:g.scene3d.renderer.info.memory.textures});await new Promise(requestAnimationFrame);}
   const lockedMeshes=[];
   for(const st of w.stations.filter(s=>s.locked)){const v=w.stationVisuals.get(st.id)??w.pickupVisuals.get(st.id);let count=0;v?.root.traverseVisible(o=>{if(o.isMesh)count++;});if(count)lockedMeshes.push({id:st.id,count});}
   stages.push({id:zone.id,actionMs,costs:Object.fromEntries(Object.keys(costs).map(k=>[k,costs[k]-(before[k]??0)])),calls:Object.fromEntries(Object.keys(counts).map(k=>[k,counts[k]-(calls[k]??0)])),frameDetails, maxRenderCpuMs:Math.max(...frames),medianRenderCpuMs:frames.sort((a,b)=>a-b)[16],lockedMeshes});
  }
  // Layout correctness is checked explicitly outside the player's purchase frame.
  return {stages,layout:w.validateLayout(),rendererCalls:g.scene3d.renderer.info.render.calls};
 });
 await page.screenshot({path:output+'/expanded.png'});
 const report={phase,...timings,errors};await writeFile(output+'/results.json',JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(report.layout,[]);
 if(phase==='after'){for(const stage of report.stages){assert.equal(stage.calls.validation??0,0,'full validation must not block a purchase');assert.deepEqual(stage.lockedMeshes,[],'locked furniture must not render');}}
 console.log(JSON.stringify(report));
 await context.close();
}finally{await browser?.close();await server.close();}
