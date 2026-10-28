import assert from 'node:assert/strict';
import {it} from 'node:test';
import {syncGrimePixels} from './GrimePixels';
it('preserves mask orientation and bytes while skipping invisible fractional changes',()=>{
 const data=new Float32Array([.1,4.2,255,70.8]),pixels=new Uint8Array(16);
 assert.equal(syncGrimePixels(data,pixels,2,2),true);
 assert.deepEqual([...pixels],[255,255,255,255,70,70,70,70,0,0,0,0,4,4,4,4]);
 data[1]=4.9;assert.equal(syncGrimePixels(data,pixels,2,2),false);
 data[1]=5.1;assert.equal(syncGrimePixels(data,pixels,2,2),true);assert.equal(pixels[13],5);
 data.fill(0);assert.equal(syncGrimePixels(data,pixels,2,2),true);assert.ok(pixels.every(v=>v===0));
 assert.equal(syncGrimePixels(data,pixels,2,2),false);
});
