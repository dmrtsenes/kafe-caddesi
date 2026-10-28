import assert from 'node:assert/strict';
import {it} from 'node:test';
import {FramePacer,FrameRateMeter,RefreshRateEstimator} from './FrameClock';
import {pacedFps} from './framePolicy';

it('measures completed intervals without inventing a first-frame FPS sample', () => {
 const meter=new FrameRateMeter();
 assert.equal(meter.sample(0,60),0);
 for(let frame=1;frame<60;frame++)assert.equal(meter.sample(frame*1000/60,60),0);
 assert.equal(meter.sample(1000,60),60);
 for(let frame=1;frame<=30;frame++)meter.sample(1000+frame*1000/30,60);
 assert.equal(meter.sample(2010,60),30);
});

it('discards menu and previous refresh-budget samples on every budget change', () => {
 const meter=new FrameRateMeter();let time=0;
 for(const target of [60,10,60,30,60,45,60]){
  assert.equal(meter.sample(time,target),0);
  for(let frame=1;frame<target;frame++)assert.equal(meter.sample(time+frame*1000/target,target),0);
  assert.equal(meter.sample(time+1000,target),target);
  time+=1100;
 }
});

it('starts a fresh window when the app resumes with the same FPS target', () => {
 const meter=new FrameRateMeter();meter.sample(0,60);
 for(let frame=1;frame<=10;frame++)meter.sample(frame*100,60);
 meter.reset();assert.equal(meter.sample(10000,60),0);
 for(let frame=1;frame<=60;frame++)meter.sample(10000+frame*1000/60,60);
 assert.equal(meter.sample(11001,60),60);
});

it('honours 30/45/60 FPS on 60–240 Hz displays, including jitter',()=>{
 for(const hz of [60,72,75,90,120,144,165,180,240])for(const cap of [30,45,60]){
  const pacer=new FramePacer(),target=pacedFps(hz,cap),times:number[]=[];pacer.reset(0);
  for(let frame=1;frame<=hz*10;frame++){
   const now=frame*1000/hz+Math.sin(frame*.7)*.15;
   if(pacer.due(now,target))times.push(now);
  }
  assert.ok(times.length<=Math.ceil(target*10)+1,`${hz} Hz / ${cap}: ${times.length}`);
  assert.ok(times.length>=Math.floor(target*10)-1,`${hz} Hz / ${cap}: ${times.length}`);
 }
});

it('never bursts catch-up frames after pauses and honours an FPS change',()=>{
 const pacer=new FramePacer();pacer.reset(0);
 assert.equal(pacer.due(0,30),true);assert.equal(pacer.due(1,30),false);
 assert.equal(pacer.due(10000,30),true);assert.equal(pacer.due(10001,30),false);
 assert.equal(pacer.due(10010,60),false);assert.equal(pacer.due(10017,60),true);
 assert.equal(pacer.due(10027,60),false);assert.equal(pacer.due(10034,60),true);
});

it('keeps the ceiling when refresh estimates change between callbacks',()=>{
 const pacer=new FramePacer();pacer.reset(0);let frames=0;
 for(let n=1;n<=2400;n++)if(pacer.due(n*1000/240,n%2?30:29.9))frames++;
 assert.ok(frames<=301,`Changing estimates produced ${frames} frames`);
});

it('recognizes fast displays despite missed callbacks caused by rendering work',()=>{
 for(const hz of [60,90,120,144,165,180,240]){
  const clock=new RefreshRateEstimator();clock.reset(60);let time=10,estimated=60;
  for(let frame=0;frame<180;frame++){time+=1000/hz*(frame%4===0?2:1);estimated=clock.sample(time);}
  assert.equal(estimated,hz);
 }
});
