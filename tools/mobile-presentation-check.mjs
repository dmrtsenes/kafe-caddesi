import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const args=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=')));
const url=args.url??'http://127.0.0.1:4173/';
const out='.devshots/mobile-parity-2026-09-10/'+(args.phase??'presentation');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={url,views:[],errors:[],remoteRequests:[]};
try {
 for(const variant of [
  {name:'desktop-same-size',width:390,height:844,mobile:false},
  {name:'phone-portrait',width:390,height:844,mobile:true},
  {name:'phone-landscape',width:844,height:390,mobile:true},
  {name:'desktop-overview',width:1280,height:1200,mobile:false},
 ]) {
  const context=await browser.newContext({viewport:{width:variant.width,height:variant.height},deviceScaleFactor:2,
   isMobile:variant.mobile,hasTouch:variant.mobile,locale:'tr-TR',storageState:{cookies:[],origins:[]},
   ...(variant.mobile?{userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'}:{})});
  await context.addInitScript(()=>{
   let seed=417;
   Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
   localStorage.setItem('fincan-sokagi:settings:v2',JSON.stringify({quality:'medium',qualityAuto:false,fps:60,muted:true,music:false}));
   let game;
   Object.defineProperty(window,'__fincan',{configurable:true,get:()=>game,set:g=>{game=g;g.persistDisabled=true;g.stop();}});
  });
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push({view:variant.name,message:e.message}));
  page.on('response',r=>{if(r.status()>=400)report.errors.push({view:variant.name,status:r.status(),url:r.url()});});
  page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(new URL(url).origin+'/'))report.remoteRequests.push(r.url());});
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__fincan,null,{timeout:60000});
  const result=await page.evaluate(()=>{
   const g=window.__fincan,w=g.world,s=g.scene3d;
   g.stop();g.ui.hideBoot();g.ui.closePanels();g.ui.setTutorial(null);g.state.tutorialStep=99;
   g.player.setPosition(0,-8);s.snapTo(0,-8);
   Object.assign(g.state.staffCount,{waiter:1,cashier:1,barista:1});w.syncStaff();g.ui.endCelebrate();
   for(let i=0;i<180;i++){g.player.char.update(1/60,0);w.updateVisuals(1/60);g.stepVisual(1/60);}
   s.render();
   const gl=s.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
   window.__parityPixels=()=>{
    s.render();const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
    gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let hash=2166136261;for(const value of pixels)hash=Math.imul(hash^value,16777619)>>>0;
    return {hash,width:gl.drawingBufferWidth,height:gl.drawingBufferHeight};
   };
   const overview={...s.framing};
   return {mobile:g.mobileDevice,cast:g.player.char.root.userData.characterPack,overview,actualDistance:s.distance,
    shadows:s.renderer.shadowMap.enabled,shadowAutoUpdate:s.renderer.shadowMap.autoUpdate,
    environment:!!s.scene.environment,antialias:s.edgeSmoothing.enabled,
    dpr:s.renderer.getPixelRatio(),pixels:window.__parityPixels(),
    meshes:s.preparation.meshes,shaderMs:s.preparation.totalMs,
    gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,glError:gl.getError()};
  });
  assert.equal(result.cast,'fincan-current');assert.equal(result.shadows,true);
  assert.equal(result.shadowAutoUpdate,false);assert.equal(result.environment,true);
  assert.equal(result.antialias,true);assert.equal(result.glError,0);
  assert.equal(result.mobile,variant.mobile);
  assert.ok(Math.abs(result.actualDistance-result.overview.distance)<.05,'tutorial must not override the selected camera');
  if(result.overview.aspect<.86){
   assert.equal(result.overview.distance,27.5);assert.equal(result.overview.offsetY,0);
  }else assert.ok(2*result.overview.distance*Math.tan(result.overview.fov*Math.PI/360)*result.overview.aspect>=17-1e-8);
  await page.locator('#boot-screen').waitFor({state:'detached',timeout:15000});
  await page.screenshot({path:out+'/'+variant.name+'.png'});
  // A low preset must be reversible in the same WebGL context.
  result.qualityRecovery=await page.evaluate(()=>{
   const g=window.__fincan,s=g.scene3d;
   g.setQualityTier('low');const low=s.renderer.shadowMap.enabled;
   g.setQualityTier('high');s.render();
   return {low,high:s.renderer.shadowMap.enabled,environment:!!s.scene.environment,antialias:s.edgeSmoothing.enabled,cast:g.player.char.root.userData.characterPack};
  });
  assert.equal(result.qualityRecovery.low,false);assert.equal(result.qualityRecovery.high,true);
  assert.equal(result.qualityRecovery.environment,true);assert.equal(result.qualityRecovery.cast,result.cast);
  // Rotation recomputes the projection without reloading or replacing characters.
  if(variant.name==='phone-portrait'){
   await page.setViewportSize({width:844,height:390});
   result.rotated=await page.evaluate(()=>{const g=window.__fincan;g.scene3d.resize();return {...g.scene3d.framing,cast:g.player.char.root.userData.characterPack};});
   assert.equal(result.rotated.cast,result.cast);assert.ok(result.rotated.aspect>2);
  }
  report.views.push({name:variant.name,...result});
  await context.close();
 }
 assert.deepEqual(report.views[0].overview,report.views[1].overview);
 assert.deepEqual(report.views[0].pixels,report.views[1].pixels,'same camera and quality must produce the same image on mobile and desktop profiles');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.remoteRequests,[]);
 console.log(JSON.stringify(report,null,2));
} finally {
 await writeFile(out+'/result.json',JSON.stringify(report,null,2));
 await browser.close();
}
