import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pressureIsHot, thermalBudgetLevel, attachThermalStatus, attachCpuPressure, type ThermalStatus } from './thermal.ts';

describe('pressureIsHot', () => {
  it('is false for missing, nominal, and fair', () => {
    assert.equal(pressureIsHot(null), false);
    assert.equal(pressureIsHot('nominal'), false);
    assert.equal(pressureIsHot('fair'), false);
  });

  it('is true for serious and critical', () => {
    assert.equal(pressureIsHot('serious'), true);
    assert.equal(pressureIsHot('critical'), true);
  });
});

it('maps OS severity conservatively and rejects invalid readings',()=>{
 assert.deepEqual([0,1,2,3,4,5,6].map(thermalBudgetLevel),[0,1,2,3,4,5,5]);
 for(const n of [-1,7,NaN,Infinity,1.5])assert.equal(thermalBudgetLevel(n),0);
});

it('cleans up a late native listener without delivering to a disposed game',async()=>{
 let resolve!: (handle:{remove():Promise<void>})=>void,removed=0,received=0;
 const cancel=attachThermalStatus({getStatus:async()=>({supported:true,status:3}),addListener:()=>new Promise(r=>resolve=r)},()=>received++);
 cancel();resolve({remove:async()=>{removed++;}});await new Promise(r=>setTimeout(r,0));
 assert.equal(removed,1);assert.equal(received,0);
});

it('does not overwrite a current thermal event with a stale initial reply',async()=>{
 let callback!:(state:ThermalStatus)=>void,reply!:(state:ThermalStatus)=>void,removed=0;
 const events:number[]=[];
 const stop=attachThermalStatus({addListener:async(_name,fn)=>{callback=fn;return {remove:async()=>{removed++;}};},getStatus:()=>new Promise(r=>reply=r)},n=>events.push(n));
 await new Promise(r=>setTimeout(r,0));callback({supported:true,status:3});reply({supported:true,status:0});
 await new Promise(r=>setTimeout(r,0));assert.deepEqual(events,[3]);
 stop();callback({supported:true,status:0});assert.deepEqual(events,[3]);assert.equal(removed,1);
});

it('handles denied CPU pressure access and ignores callbacks after disposal', async () => {
 const scope = globalThis as typeof globalThis & { PressureObserver?: unknown };
 const original = scope.PressureObserver;
 let disconnected = 0, received = 0, callback!: (records: {source:string;state:string}[]) => void;
 try {
  scope.PressureObserver = class {
   constructor(fn: typeof callback) { callback = fn; }
   async observe() { throw new Error('Permission denied'); }
   disconnect() { disconnected++; throw new Error('Already disconnected'); }
  };
  const stop = attachCpuPressure(() => received++);
  await new Promise(resolve => setTimeout(resolve, 0));
  callback([{source:'cpu', state:'critical'}]); stop();
  assert.equal(disconnected, 1); assert.equal(received, 0);
 } finally {
  if (original === undefined) delete scope.PressureObserver;
  else scope.PressureObserver = original;
 }
});
