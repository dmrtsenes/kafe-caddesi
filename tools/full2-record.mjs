import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('campaign-kafe-caddesi'),draft=process.argv.includes('--draft');
const ffmpeg=resolve('.tools/video/ffmpeg/package/ffmpeg.exe');
await mkdir(resolve(root,'review'),{recursive:true});
await mkdir(resolve(root,'captures'),{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0,open:false,hmr:false,watch:null}});await server.listen();
let browser,encoder;const errors=[],requests=[],framing=[];let encoded,encodeError='';
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:1080,height:1920},deviceScaleFactor:1,locale:'tr-TR'});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(url.hostname)||['data:','blob:'].includes(url.protocol))return route.continue();requests.push(url.href);return route.abort();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await context.addInitScript(()=>{for(const key of ['fincan-sokagi:save:v8','fincan-sokagi:save:v8:bak','fincan-sokagi:language:v1','fincan-sokagi:settings:v2'])localStorage.setItem(key,'KEEP_PLAYER_DATA');window.__before=JSON.stringify(Object.entries(localStorage).sort());window.__calls=[];for(const name of ['getItem','setItem','removeItem','clear']){const fn=Storage.prototype[name];Storage.prototype[name]=function(...args){window.__calls.push({name,key:args[0]});return fn.apply(this,args);};}});
 await page.goto(server.resolvedUrls.local[0]+'reklam-full2.html?capture=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__campaign,null,{timeout:180000});
 console.log('Shipped game ready. '+(draft?'Rehearsal':'Full resolution capture'));
 if(!draft){encoder=spawn(ffmpeg,['-y','-v','error','-f','image2pipe','-framerate','30','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart',resolve(root,'source/picture.mp4')],{windowsHide:true,stdio:['pipe','ignore','pipe']});encoder.stderr.on('data',b=>encodeError+=b);encoder.stdin.on('error',()=>{});encoded=new Promise((ok,bad)=>{encoder.on('error',bad);encoder.on('exit',c=>c===0?ok():bad(new Error(encodeError)));});encoded.catch(()=>{});}
 let previousPhase=-1;const samples=[];
 for(let n=0;n<1800;n++){
  const sample=n%12===0;
  const data=await page.evaluate(({draw,sample})=>{const c=window.__campaign;if(!c.stepFrame(draw))return null;const r=c.report();return {r,f:c.framing(),png:draw?c.png():null,raw:sample?c.raw():null};},{draw:!draft||sample,sample});
  if(!data)break;
  const {r,f}=data;
  if(f.check&&[f.head,f.feet].some(p=>Math.abs(p[0])>.95||p[1]>.7||p[1]<-.78))framing.push({frame:n,...f});
  if(data.png){const png=Buffer.from(data.png,'base64');if(encoder&&!encoder.stdin.write(png))await once(encoder.stdin,'drain');if(sample)await writeFile(resolve(root,`review/${draft?'draft':'frame'}-${String(n).padStart(4,'0')}.png`),png);}
  if(data.raw){await writeFile(resolve(root,`captures/phase-${r.phase}-${String(n).padStart(4,'0')}.png`),Buffer.from(data.raw,'base64'));samples.push({frame:n,time:r.time,phase:r.phase,phaseAt:r.phaseAt,player:r.player,staff:r.staff});}
  if(r.phase!==previousPhase){console.log(`Shot ${r.phase} at ${r.time.toFixed(2)}s; served=${r.stats.served}, cleaned=${r.stats.tablesCleaned}, collected=${r.collected}, staff=${r.staff.length}`);previousPhase=r.phase;}
  if(n%60===59)console.log(`Frame ${n+1}; shot=${r.phase}`);
 }
 if(encoder){encoder.stdin.end();await encoded;encoder=null;}
 const report=await page.evaluate(()=>({...window.__campaign.report(),storageUnchanged:JSON.stringify(Object.entries(localStorage).sort())===window.__before,storageCalls:window.__calls}));
 const result={...report,errors,externalRequests:requests,framingFailures:framing,samples};
 await writeFile(resolve(root,`review/${draft?'rehearsal':'capture'}.json`),JSON.stringify(result,null,2));
 assert.ok(report.done);assert.ok(report.stats.served>=3);assert.equal(report.dirty.soil,0);assert.ok(report.collected>0);
 assert.ok(report.events.some(e=>e.kind==='hired'&&e.data.method==='pad'));assert.ok(report.events.some(e=>e.kind==='stocked'));
 assert.ok(report.layoutUnchanged);assert.deepEqual(report.layoutProblems,[]);assert.deepEqual(report.storageCalls,[]);assert.ok(report.storageUnchanged);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);assert.deepEqual(framing,[]);
 assert.equal(report.concept,false);assert.deepEqual(report.resolution,[1080,1920]);
 console.log(`PASS: ${report.frame} frames; ${(report.frame/30).toFixed(3)} seconds; storage untouched.`);
}finally{encoder?.kill();await browser?.close();await server.close();}

