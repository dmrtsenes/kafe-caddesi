import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.AD_BROWSER||'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
  const page=await browser.newPage({viewport:{width:560,height:1000}});
  await page.goto(pathToFileURL(resolve('reklam-full-izle.html')).href);
  const metadata=await page.evaluate(async()=>{const v=document.querySelector('video');
    if(v.readyState<1)await new Promise((ok,bad)=>{v.onloadedmetadata=ok;v.onerror=()=>bad(new Error('Video could not load'));});
    return {duration:v.duration,width:v.videoWidth,height:v.videoHeight};});
  assert.equal(metadata.duration,25);assert.equal(metadata.width,1080);assert.equal(metadata.height,1920);
  console.log('Playing the actual final MP4 from start to finish in Chrome.');
  await page.evaluate(()=>document.querySelector('video').play());
  await page.waitForFunction(()=>document.querySelector('video').ended,null,{timeout:40000});
  const result=await page.evaluate(()=>{const v=document.querySelector('video'),q=v.getVideoPlaybackQuality();
    return {ended:v.ended,time:v.currentTime,error:v.error?.message??null,decodedAudioBytes:v.webkitAudioDecodedByteCount,
      totalFrames:q.totalVideoFrames,droppedFrames:q.droppedVideoFrames};});
  assert.equal(result.error,null);assert.equal(result.ended,true);assert.equal(result.time,25);
  assert.ok(result.decodedAudioBytes>0,'AAC soundtrack must actually decode in browser playback');
  assert.ok(result.totalFrames>=745,'Playback must reach the complete picture stream');
  await writeFile('.devshots/reklam-full/playback.json',JSON.stringify({passed:true,metadata,...result},null,2));
  console.log(JSON.stringify(result));
}finally{await browser.close();}
