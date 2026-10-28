import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile, access, copyFile, rename, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { makePromoAudio } from './gameplay-ad-audio.mjs';

const draft=process.argv.includes('--draft');
const out=resolve('.devshots/reklam-full');
const ffmpeg=process.env.FFMPEG_PATH||resolve('.tools/video/ffmpeg/package/ffmpeg.exe');
const ffprobe=process.env.FFPROBE_PATH||resolve('.tools/video/ffprobe/package/ffprobe.exe');
export function run(exe,args){return new Promise((ok,bad)=>{const p=spawn(exe,args,{windowsHide:true});let stdout='',stderr='';
  p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',bad);
  p.on('exit',code=>code===0?ok({stdout,stderr}):bad(new Error(stderr.slice(-4000))));});}
await Promise.all([access(ffmpeg),access(ffprobe)]);
await mkdir(out,{recursive:true});
const versions=await Promise.all([run(ffmpeg,['-version']),run(ffprobe,['-version'])]);
console.log('Preflight: Node '+process.version+'; Playwright; '+versions[0].stdout.split('\n')[0]);
const server=await createServer({server:{host:'127.0.0.1',port:0,open:false,hmr:false,watch:null}});
await server.listen();
let browser,encoder;
try{
  browser=await chromium.launch({channel:process.env.AD_BROWSER||'chrome',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
  const context=await browser.newContext({viewport:{width:1080,height:1920},deviceScaleFactor:1,locale:'tr-TR'});
  const page=await context.newPage(),errors=[],failedRequests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))failedRequests.push({url:r.url(),status:r.status()});});
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await context.addInitScript(()=>{
    localStorage.setItem('fincan-sokagi:save:v8','PLAYER_SAVE_KEEP_EXACT');
    localStorage.setItem('fincan-sokagi:save:v8:bak','PLAYER_BACKUP_KEEP_EXACT');
    localStorage.setItem('fincan-sokagi:language:v1','en');
    localStorage.setItem('fincan-sokagi:settings:v2','PLAYER_SETTINGS_KEEP_EXACT');
    window.__storageBefore=JSON.stringify(Object.entries(localStorage).sort());window.__storageCalls=[];
    for(const name of ['getItem','setItem','removeItem','clear']){
      const original=Storage.prototype[name];Storage.prototype[name]=function(...args){window.__storageCalls.push({name,key:args[0]});return original.apply(this,args);};
    }
  });
  await page.goto(server.resolvedUrls.local[0]+'reklam-full.html?capture=1',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__gameplayAd,null,{timeout:180000});
  console.log('Current game ready, isolated storage, 1080 × 1920. '+(draft?'Draft rehearsal.':'Rendering 750 frames.'));
  let encoded,encodeError='';
  if(!draft){
    encoder=spawn(ffmpeg,['-y','-hide_banner','-loglevel','error','-f','image2pipe','-framerate','30','-i','pipe:0','-an',
      '-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709',
      '-movflags','+faststart',resolve(out,'picture.mp4')],{windowsHide:true,stdio:['pipe','ignore','pipe']});
    encoder.stderr.on('data',b=>encodeError+=b);encoder.stdin.on('error',()=>{});
    encoded=new Promise((ok,bad)=>{encoder.on('error',bad);encoder.on('exit',c=>c===0?ok():bad(new Error(encodeError)));});
    encoded.catch(()=>{});
  }
  const stills=new Set([0,45,89,91,119,155,179,181,215,255,269,271,315,355,389,419,421,455,495,509,511,550,580,587,590,620,650,659,661,689,720,749]);
  const motion=[],framingFailures=[];
  for(let n=0;n<750;n++){
    const capture=!draft||stills.has(n);
    const data=await page.evaluate(({capture})=>{const c=window.__gameplayAd;if(!c.stepFrame(capture))throw new Error('Early end');
      return {png:capture?c.png():null,framing:c.framing(),report:capture?c.report():null};},{capture});
    const f=data.framing;
    if(f.check&&[f.head,f.feet].some(p=>Math.abs(p[0])>.91||p[1]>.69||p[1]<-.75))framingFailures.push({frame:n,...f});
    if(data.png){const png=Buffer.from(data.png,'base64');
      if(!draft&&!encoder.stdin.write(png))await once(encoder.stdin,'drain');
      if(stills.has(n)){await writeFile(resolve(out,`${draft?'draft':'frame'}-${String(n).padStart(4,'0')}.png`),png);motion.push({frame:n,player:data.report.player,staff:data.report.staff});}
    }
    if(n%60===59){const r=await page.evaluate(()=>window.__gameplayAd.report());console.log(`Frame ${n+1}/750 | ${r.task} | served=${r.stats.served} cleaned=${r.stats.tablesCleaned} cash=${r.collected} staff=${r.staff.length}`);}
  }
  if(encoder){encoder.stdin.end();await encoded;encoder=null;}
  const report=await page.evaluate(()=>({...window.__gameplayAd.report(),storageUnchanged:JSON.stringify(Object.entries(localStorage).sort())===window.__storageBefore,storageCalls:window.__storageCalls}));
  await writeFile(resolve(out,draft?'draft-report.json':'scene-report.json'),JSON.stringify({...report,errors,failedRequests,framingFailures,motion},null,2));
  assert.equal(report.frame,750);assert.ok(Math.abs(report.time-25)<1e-7);
  assert.equal(report.layoutUnchanged,true);assert.equal(report.concept,false);
  assert.deepEqual(report.layoutProblems,[]);
  assert.ok(report.stats.served>=3,'Three real tea deliveries required');
  assert.ok(report.events.some(e=>e.kind==='cleaned'&&e.data.id==='k_masa_2'&&e.time>=3&&e.time<6),'Real cleaning in its shot');
  assert.ok(report.events.some(e=>e.kind==='produced'&&e.data.stationId==='k_semaver'&&e.time>=6&&e.time<9),'Real production in preparation shot');
  assert.ok(report.events.filter(e=>e.kind==='served'&&e.time>=9&&e.time<14).length>=3,'Real service in service shot');
  assert.ok(report.collected>0,'Real till collection');
  assert.ok(report.events.some(e=>e.kind==='hired'&&e.data.method==='pad'&&e.time>=17&&e.time<22),'Paid hire using the actual game square');
  assert.ok(motion.some(m=>m.frame>=590&&m.frame<660&&m.staff.some(s=>s.held>0)),'Hired worker actually takes products before closing');
  assert.ok(report.events.some(e=>e.kind==='stocked'&&e.time>=19.6&&e.time<22),'Worker really stocks the shelf during the progress shot');
  assert.ok(report.storageUnchanged);assert.deepEqual(report.storageCalls,[]);
  assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(framingFailures,[]);
  assert.deepEqual(report.resolution,[1080,1920]);
  if(draft){console.log('Draft passed. Stills and report: '+out);}
  else{
    await makePromoAudio(report.events,resolve(out,'soundtrack.wav'),25,false,true);
    const output=resolve(out,'reklam-full-master.mp4');
    const master=await run(ffmpeg,['-y','-hide_banner','-i',resolve(out,'picture.mp4'),'-i',resolve(out,'soundtrack.wav'),
      '-map','0:v:0','-map','1:a:0','-c:v','copy','-af','loudnorm=I=-16:TP=-1.5:LRA=9','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-t','25','-movflags','+faststart',output]);
    await writeFile(resolve(out,'mastering.log'),master.stderr);
    const probe=JSON.parse((await run(ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',output])).stdout);
    const v=probe.streams.find(s=>s.codec_type==='video'),a=probe.streams.find(s=>s.codec_type==='audio');
    assert.equal(v.codec_name,'h264');assert.equal(v.width,1080);assert.equal(v.height,1920);
    assert.equal(v.avg_frame_rate,'30/1');assert.equal(+v.nb_read_frames,750);assert.equal(v.pix_fmt,'yuv420p');
    assert.equal(a.codec_name,'aac');assert.equal(a.channels,2);assert.equal(+a.sample_rate,48000);assert.ok(Math.abs(+probe.format.duration-25)<.06);
    const decoded=await run(ffmpeg,['-v','error','-i',output,'-f','null','-']);assert.equal(decoded.stderr.trim(),'');
    const qc=await run(ffmpeg,['-hide_banner','-i',output,'-vf','blackdetect=d=0.03:pix_th=0.05:pic_th=0.98','-af','volumedetect','-f','null','-']);
    assert.ok(!qc.stderr.includes('black_start:'),'Black frame detected');
    assert.ok(/mean_volume: -?\d/.test(qc.stderr)&&!qc.stderr.includes('max_volume: -inf'),'Silent audio');
    await writeFile(resolve(out,'audio-black-frame-qc.log'),qc.stderr);
    for(const [label,seconds] of [['start',0],['middle',11],['transition',19],['closing',24.9]])
      await run(ffmpeg,['-y','-v','error','-ss',String(seconds),'-i',output,'-frames:v','1','-update','1',resolve(out,`decoded-${label}.png`)]);
    await run(ffmpeg,['-y','-v','error','-ss','0.5','-i',output,'-frames:v','1','-q:v','2','-update','1',resolve('reklam-full-kapak.jpg')]);
    const final=resolve('reklam-full.mp4'),pending=resolve(out,'delivery.pending.mp4');
    await copyFile(output,pending);
    try{await access(final);await copyFile(final,resolve(out,`previous-${Date.now()}.mp4`));}catch(e){if(e.code!=='ENOENT')throw e;}
    await rename(pending,final);
    await writeFile(resolve(out,'verification.json'),JSON.stringify({passed:true,output:final,probe,framingFailures,storageUnchanged:true,storageCalls:[],
      errors,failedRequests,layoutUnchanged:true,concept:false,decodedWithoutErrors:true,blackFrames:false,audio:'Original synthesis, event synchronized, stereo AAC'},null,2));
    console.log('Verified: '+final);
  }
}finally{encoder?.kill();await browser?.close();await server.close();}
