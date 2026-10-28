import { build, preview } from 'vite';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { assertReleaseAssets } from './release-assets.mjs';
import assert from 'node:assert/strict';
const output='.devshots/mobile-parity-2026-09-10/production-cast',dist=output+'/dist';
await mkdir(output,{recursive:true});
await build({build:{outDir:dist,emptyOutDir:true}});assertReleaseAssets(dist);
const server=await preview({build:{outDir:dist},preview:{host:'127.0.0.1',port:5264,strictPort:true,open:false}});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const report={boots:[],remoteRequests:[],errors:[],frames:[]};
try{
 const context=await browser.newContext({viewport:{width:540,height:800},locale:'tr-TR'});
 await context.addInitScript(()=>localStorage.setItem('fincan-sokagi:settings:v2',JSON.stringify({quality:'medium',qualityAuto:false,muted:true,music:false})));
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
 page.on('request',request=>{const url=request.url();if(/^https?:/.test(url)&&!url.startsWith('http://127.0.0.1:5264/'))report.remoteRequests.push(url);});
 for(const cache of ['cold','warm']){
  const started=Date.now();await page.goto('http://127.0.0.1:5264/',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>!!window.__fincan,undefined,{timeout:90000});await page.locator('#boot-screen').waitFor({state:'detached'});
  report.boots.push({cache,wallMs:Date.now()-started,...await page.evaluate(()=>{const game=window.__fincan;game.stop();return{cast:game.player.char.root.userData,preparation:game.scene3d.preparation,phases:performance.getEntriesByType('measure').map(entry=>({name:entry.name,ms:entry.duration})),assets:performance.getEntriesByType('resource').filter(entry=>entry.name.endsWith('.glb')).map(entry=>({file:entry.name.split('/').at(-1),ms:entry.duration,bytes:entry.transferSize}))};})});
  await page.screenshot({path:output+'/production-'+cache+'.png'});
 }
 const visuals=await page.evaluate(()=>{
  const g=window.__fincan;g.ui.setTutorial(null);g.ui.closePanels();g.state.tutorialStep=99;
  g.player.setCapacity(15);g.player.setCarrierLevel(8);for(let i=0;i<15;i++)g.player.give(['cay','latte','tost'][i%3]);
  let skins=0;g.player.char.root.traverse(o=>{if(o.isSkinnedMesh)skins++;});
  const frames=[];for(let i=0;i<120;i++){g.stepVisual(1/60);g.world.updateVisuals(1/60);const started=performance.now();g.scene3d.render();if(i>20)frames.push(performance.now()-started);}
  frames.sort((a,b)=>a-b);return{skins,carrier:g.player.stack.root.children.filter(o=>o.name==='carriedProduct').length,frames:{median:frames[Math.floor(frames.length/2)],p95:frames[Math.floor(frames.length*.95)],max:Math.max(...frames)},calls:g.scene3d.renderer.info.render.calls};
 });report.frames.push(visuals);await page.screenshot({path:output+'/production-cart15.png'});
 assert.equal(report.boots[0].cast.characterPack,'fincan-current');assert.equal(visuals.skins,1);assert.equal(visuals.carrier,15);assert.deepEqual(report.remoteRequests,[]);assert.deepEqual(report.errors,[]);
 await writeFile(output+'/production.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await context.close();
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
