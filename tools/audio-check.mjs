import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const origin='http://127.0.0.1:5354';
const output='.devshots/audio-reliability-2026-09-08';
await mkdir(output,{recursive:true});
const report={at:new Date().toISOString(),scope:'Real browser WebAudio on an empty page; no game/profile/device is loaded. Gain and RMS measurements are not a listening assessment.',errors:[],remoteRequests:[]};
const server=await createServer({server:{host:'127.0.0.1',port:5354,strictPort:true,hmr:false,open:false},plugins:[{name:'audio-check-page',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url!=='/__audio_check'){next();return;}res.setHeader('content-type','text/html');res.end('<!doctype html><html><title>Audio check</title><body></body></html>');});}}]});
let browser;
try{
 await server.listen();
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
 const context=await browser.newContext();const page=await context.newPage();
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith(origin+'/'))report.remoteRequests.push(request.url());});
 await page.goto(origin+'/__audio_check');
 report.measurements=await page.evaluate(async()=>{
  const {createAudio}=await import('/src/audio/AudioManager.ts');
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const until=async(test,label)=>{const start=performance.now();while(!test()){if(performance.now()-start>4000)throw Error('timeout: '+label);await wait(15);}};
  const measurements={firstUnlock:[],routes:[],lifecycle:[],dispose:null};
  const root=globalThis;
  const rms=async(meter)=>{const values=new Float32Array(meter.fftSize);let total=0;for(let pass=0;pass<8;pass++){meter.getFloatTimeDomainData(values);let power=0;for(const value of values)power+=value*value;total+=Math.sqrt(power/values.length);await wait(12);}return total/8;};
  for(const volume of [0,0.27]){
   const audio=createAudio();audio.setSfxVolume(0.23);audio.setMusicVolume(volume);audio.unlock();
   const ctx=audio.ctx;await until(()=>ctx.state==='running','unlock');await wait(700);
   const meter=ctx.createAnalyser();meter.fftSize=2048;audio.master.connect(meter);
   const interval=setInterval(()=>audio.update(0.025),25);await wait(550);
   measurements.firstUnlock.push({wanted:volume,storedMusic:audio.musicVol,musicOutput:audio.music.out.gain.value,sfxOutput:audio.sfxBusNode.gain.value,realMusicRms:await rms(meter)});
   clearInterval(interval);audio.dispose();await until(()=>ctx.state==='closed','close unlock fixture');
  }
  const audio=createAudio();audio.unlock();const ctx=audio.ctx;await until(()=>ctx.state==='running','main context');await wait(650);
  const meter=ctx.createAnalyser();meter.fftSize=2048;audio.master.connect(meter);
  for(const category of ['sfx','music']){
   for(const route of ['dry','wet']){
    const node=category==='sfx'?audio.sb[route]:audio.music.mbus[route];
    const set=volume=>category==='sfx'?audio.setSfxVolume(volume):audio.setMusicVolume(volume);
    set(1);
    const tone=ctx.createOscillator(),gain=ctx.createGain();tone.frequency.value=517;gain.gain.value=0.04;tone.connect(gain).connect(node);tone.start();
    // Let the complete 1.1-second room impulse reach steady state before comparing levels.
    await wait(route==='wet'?1300:500);const full=await rms(meter);
    set(0.25);await wait(150);const quarter=await rms(meter);
    set(0);await wait(150);const zero=await rms(meter);
    measurements.routes.push({category,route,full,quarter,ratio:quarter/full,zero});
    tone.stop();tone.disconnect();gain.disconnect();await wait(40);
   }
  }
  audio.setSfxVolume(1);audio.setMusicVolume(1);audio.setVacuum(1,1);audio.play('cashout');
  const interval=setInterval(()=>audio.update(0.025),25);await wait(700);
  const audible=await rms(meter);audio.setMuted(true);await wait(200);const muted=await rms(meter);
  measurements.master={audible,muted};clearInterval(interval);audio.setMuted(false);audio.setVacuum(0,0);
  measurements.vacuumCycles=[];
  const baseNodes=audio.graphNodes.length;
  for(let cycle=0;cycle<6;cycle++){
    audio.setVacuum(1,cycle%2);const sound=audio.vacuum;
    let endedSources=0;for(const source of [sound.air,sound.motor])source.addEventListener('ended',()=>endedSources++);
    await wait(50);audio.setVacuum(0,0);await wait(240);audio.update(.025);await wait(30);
    measurements.vacuumCycles.push({released:audio.vacuum===null,disposed:sound.disposed,endedSources,graphNodes:audio.graphNodes.length,baseNodes});
  }
  const suspend=ctx.suspend.bind(ctx),resume=ctx.resume.bind(ctx);
  ctx.suspend=()=>wait(90).then(()=>suspend());
  audio.setSuspended(true);const stateWhilePending=ctx.state;audio.setSuspended(false);
  await until(()=>audio.contextChange===null,'suspend resume reconciliation');
  measurements.lifecycle.push({sequence:'suspend then resume before completion',pendingState:stateWhilePending,result:ctx.state});
  await suspend();ctx.resume=()=>wait(90).then(()=>resume());
  audio.setSuspended(false);audio.setSuspended(true);
  await until(()=>audio.contextChange===null,'resume suspend reconciliation');
  measurements.lifecycle.push({sequence:'resume then suspend before completion',result:ctx.state});
  audio.setSuspended(false);await until(()=>audio.contextChange===null,'resume before dispose');
  audio.play('levelup');audio.setVacuum(1,1);audio.update(0.025);
  const sources=[audio.vacSrc,audio.vacMotor,...audio.voices.flatMap(voice=>voice.srcs),...audio.music.notes.flatMap(voice=>voice.srcs)].filter(Boolean);
  let ended=0;for(const source of sources)source.addEventListener('ended',()=>ended++);
  audio.setSuspended(true);audio.dispose();audio.dispose();audio.unlock();audio.play('coin');
  await until(()=>ctx.state==='closed'&&audio.contextChange===null,'dispose pending transition');
  await wait(100);
  measurements.dispose={state:ctx.state,managerContext:audio.ctx,voices:audio.voices.length,graphNodes:audio.graphNodes.length,music:audio.music,vacuum:audio.vacSrc,categoryGain:audio.sfxBusNode,scheduledSources:sources.length,endedEvents:ended};
  const hidden=createAudio();hidden.setSuspended(true);hidden.unlock();const hiddenCtx=hidden.ctx;
  await until(()=>hiddenCtx.state==='suspended'&&hidden.contextChange===null,'hidden first unlock');
  measurements.lifecycle.push({sequence:'suspend requested before first unlock',result:hiddenCtx.state});hidden.dispose();await until(()=>hiddenCtx.state==='closed','hidden close');
  return measurements;
 });
 for(const first of report.measurements.firstUnlock){
  assert.ok(Math.abs(first.musicOutput-first.wanted)<1e-5,'saved music level applied before first note');
  assert.ok(Math.abs(first.sfxOutput-0.23)<1e-5,'saved effects level applied on first unlock');
  assert.ok(first.wanted===0?first.realMusicRms<1e-8:first.realMusicRms>1e-5,'actual music respects saved initial volume');
 }
 for(const row of report.measurements.routes){
  assert.ok(row.full>1e-5,row.category+' '+row.route+' receives a real signal');
  assert.ok(Math.abs(row.ratio-0.25)<0.025,row.category+' '+row.route+' quarter-volume ratio');
  assert.ok(row.zero<1e-8,row.category+' '+row.route+' volume zero mutes existing reverb');
 }
 assert.ok(report.measurements.master.audible>1e-5);assert.ok(report.measurements.master.muted<1e-8,'master mutes music, effects and vacuum including tails');
 for(const cycle of report.measurements.vacuumCycles){assert.equal(cycle.released,true);assert.equal(cycle.disposed,true);assert.equal(cycle.endedSources,2);assert.equal(cycle.graphNodes,cycle.baseNodes);}
 assert.equal(report.measurements.lifecycle[0].result,'running');assert.equal(report.measurements.lifecycle[1].result,'suspended');assert.equal(report.measurements.lifecycle[2].result,'suspended');
 const disposed=report.measurements.dispose;assert.equal(disposed.state,'closed');assert.equal(disposed.managerContext,null);assert.equal(disposed.voices,0);assert.equal(disposed.graphNodes,0);assert.equal(disposed.music,null);assert.equal(disposed.vacuum,null);assert.equal(disposed.categoryGain,null);assert.ok(disposed.scheduledSources>0);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.remoteRequests,[]);report.passed=true;
 console.log(JSON.stringify(report.measurements,null,2));
}catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;console.error(error);}finally{
 report.sourceHash=createHash('sha256').update(await readFile('src/audio/AudioManager.ts')).digest('hex');
 await writeFile(output+'/results.json',JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();
}
