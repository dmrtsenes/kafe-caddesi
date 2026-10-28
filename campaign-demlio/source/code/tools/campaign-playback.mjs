import {chromium} from 'playwright';
import {createServer} from 'vite';
import {writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const root=resolve('campaign-demlio');const server=await createServer({server:{host:'127.0.0.1',port:0,open:false,hmr:false,watch:null}});await server.listen();let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'tr-TR'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]+'campaign-demlio/index.html');
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.loading!=='lazy').map(i=>i.decode()));});
 await page.screenshot({path:resolve(root,'review/gallery.png'),fullPage:true});
 const playback=await page.evaluate(async()=>{const video=document.querySelector('video');const ctx=new AudioContext();await ctx.resume();const source=ctx.createMediaElementSource(video),analyser=ctx.createAnalyser();source.connect(analyser);analyser.connect(ctx.destination);const buffer=new Float32Array(analyser.fftSize),measurements=[];let presented=0;const frame=()=>{presented++;if(!video.ended)video.requestVideoFrameCallback(frame);};video.requestVideoFrameCallback(frame);const timer=setInterval(()=>{analyser.getFloatTimeDomainData(buffer);measurements.push({time:video.currentTime,rms:Math.sqrt(buffer.reduce((s,x)=>s+x*x,0)/buffer.length),readyState:video.readyState});},100);await video.play();await new Promise((ok,bad)=>{video.onended=ok;video.onerror=()=>bad(new Error('Playback error'));setTimeout(()=>bad(new Error('Playback did not finish')),30000);});clearInterval(timer);await ctx.close();return{ended:video.ended,duration:video.duration,width:video.videoWidth,height:video.videoHeight,presented,quality:video.getVideoPlaybackQuality().toJSON?.()??{total:video.getVideoPlaybackQuality().totalVideoFrames,dropped:video.getVideoPlaybackQuality().droppedVideoFrames},measurements};});
 assert.ok(playback.ended);assert.ok(playback.measurements.some(x=>x.time<1&&x.rms>.001));assert.ok(playback.presented>300);assert.deepEqual(errors,[]);
 await writeFile(resolve(root,'review/playback.json'),JSON.stringify({passed:true,...playback,errors,scope:'Full real-time Chromium playback and measured audio output; no human listening certification.'},null,2));
 console.log(`Full playback passed, ${playback.presented} presented frames; opening audio measurable.`);
 const shots=[];for(const [name,t]of[['opening',.5],['service',7.3],['hiring',12.6],['closing',16.0]]){
  await page.evaluate(async t=>{const v=document.querySelector('video');v.currentTime=t;await new Promise(r=>v.addEventListener('seeked',r,{once:true}));},t);
  const png=await page.evaluate(()=>{const v=document.querySelector('video'),c=document.createElement('canvas');c.width=1080;c.height=1920;c.getContext('2d').drawImage(v,0,0);return c.toDataURL().split(',')[1];});await writeFile(resolve(root,'review',`final-${name}.png`),Buffer.from(png,'base64'));shots.push({input:await sharp(Buffer.from(png,'base64')).resize(270,480).png().toBuffer(),left:shots.length*270,top:0});
 }
 await sharp({create:{width:1080,height:480,channels:3,background:'#123b39'}}).composite(shots).png().toFile(resolve(root,'review/final-selected.png'));
}finally{await browser?.close();await server.close();}
