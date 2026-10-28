import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cameraFraming, boundedCameraLead} from './CameraFraming.ts';

test('portrait uses a centered middle distance with readable characters',()=>{
 for(const [w,h] of [[320,740],[390,844],[430,932],[540,1200]]) {
  const f=cameraFraming(w,h);
  const visibleWidth=2*f.distance*Math.tan(f.fov*Math.PI/360)*f.aspect;
  assert.ok(visibleWidth>=8.4&&visibleWidth<=9.2);
  assert.ok(f.distance>=20&&f.distance<=29);assert.equal(f.fov,40);
  assert.equal(f.close,false);assert.equal(f.offsetY,0);
  assert.deepEqual(f,cameraFraming(w,h,true));
 }
});
test('phone rotation and desktop framing stay finite and leave the actor central',()=>{
 for(const [w,h,mobile] of [[844,390,true],[1920,1080,false],[768,1024,false]] as const) {
  const f=cameraFraming(w,h,mobile);
  assert.ok(f.distance>=16&&f.distance<=60);assert.ok(f.fov>=30&&f.fov<=48);
  assert.equal(f.offsetY, 0);
  assert.deepEqual(f,cameraFraming(w,h,!mobile));
  for(const [x,z] of [[-4,7],[0,0],[3,-6]]) {
   const lead=boundedCameraLead(x,z,f.maxLead);
   assert.ok(Math.hypot(lead.x,lead.z)<=f.maxLead+1e-10);
   if(x||z)assert.ok(lead.x*x+lead.z*z>=0);
  }
 }
});

test('desktop framing is retained at its existing venue scale',()=>{
 const f=cameraFraming(1920,1080);
 assert.equal(f.distance,16);assert.equal(f.fov,34);assert.equal(f.offsetY,0);
 assert.ok(Number.isFinite(cameraFraming(0,0).distance));
});
