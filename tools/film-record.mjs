/** Deterministic offline 30fps compositor; existing game recording is read-only. */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('campaign-film');
const draft = process.argv.includes('--draft');
const onlyArg = process.argv.find(a => a.startsWith('--frames='));
const requested = onlyArg ? onlyArg.split('=')[1].split(',').map(Number) : null;
const fps = 30, count = 810;
await mkdir(resolve(root, 'source'), {recursive:true});
await mkdir(resolve(root, 'review'), {recursive:true});
const server = await createServer({configFile:false, cacheDir:'campaign-film/.vite-film', optimizeDeps:{noDiscovery:true,include:['three']}, server:{host:'127.0.0.1',port:0,open:false,hmr:false,watch:null}});
await server.listen();
let browser, encoder;
const errors=[], badResponses=[];
try {
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1,locale:'tr-TR'});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)badResponses.push({url:r.url(),status:r.status()});});
  await page.goto(server.resolvedUrls.local[0]+'reklam-film.html?capture=1',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__film,null,{timeout:120000});
  let encoding, stderr='';
  if(!draft && !requested){
    encoder=spawn(resolve('.tools/video/ffmpeg/package/ffmpeg.exe'),['-y','-v','error','-f','image2pipe','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart',resolve(root,'source/picture-27s.mp4')],{windowsHide:true,stdio:['pipe','ignore','pipe']});
    encoder.stderr.on('data',b=>stderr+=b); encoder.stdin.on('error',()=>{});
    encoding=new Promise((ok,bad)=>{encoder.on('error',bad);encoder.on('exit',c=>c===0?ok():bad(new Error(stderr||`ffmpeg ${c}`)));}); encoding.catch(()=>{});
  }
  const selected=requested || (draft ? [0,15,30,45,60,75,90,105,120,140,150,210,285,360,441,480,501,579,660,690,705,720,750,795,809] : Array.from({length:count},(_,i)=>i));
  for(const n of selected){
    const data=await page.evaluate(async n=>{await window.__film.render(n);return window.__film.jpeg();},n);
    const bytes=Buffer.from(data,'base64');
    if(encoder && !encoder.stdin.write(bytes)) await once(encoder.stdin,'drain');
    if(draft || requested || n%30===0 || n===count-1) await writeFile(resolve(root,`review/${draft?'draft':'frame'}-${String(n).padStart(4,'0')}.jpg`),bytes);
    if(n%90===0)console.log(`Frame ${n}/${count}`);
  }
  if(encoder){encoder.stdin.end();await encoding;encoder=null;}
  const report=await page.evaluate(()=>window.__film.report());
  await writeFile(resolve(root,`review/${draft?'draft':'capture'}.json`),JSON.stringify({...report,errors,badResponses,renderedFrames:selected.length},null,2));
  if(errors.length || badResponses.length) throw new Error(JSON.stringify({errors,badResponses}));
  console.log(`PASS: ${selected.length} frames; no page or resource errors.`);
} finally {encoder?.kill();await browser?.close();await server.close();}
