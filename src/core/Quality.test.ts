import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FrameRateMeter } from './FrameClock';
import {
  composeQuality,
  applyTier,
  onHeatChange,
  currentHeat,
  evaluateHeat,
  resetHeat,
  targetFps,
  setNativeThermalStatus,
  setAutoQuality,
} from "./Quality.ts";

describe("composeQuality", () => {
  it("does not cut customer cap at heat 3", () => {
    const q = composeQuality("high", 3);
    assert.equal(q.maxCustomers, 26);
  });

  it("keeps customer cap at heat 5", () => {
    const q = composeQuality("low", 5);
    assert.equal(q.maxCustomers, 26);
  });

  it("reduces pixel work and disables costly shadows under severe pressure", () => {
    const cold = composeQuality("high", 0),
      hot = composeQuality("high", 5);
    assert.ok(hot.dprCap < cold.dprCap);
    assert.equal(hot.pixelBudget, cold.pixelBudget * 0.75);
    assert.equal(hot.shadows, false);
    assert.equal(hot.charLod, cold.charLod);
    assert.equal(hot.maxCustomers, cold.maxCustomers);
    assert.deepEqual(composeQuality("high", 0), cold);
  });
  it("keeps low-end pixel work and shadows within the low budget", () => {
    const low = composeQuality("low", 0);
    assert.equal(low.shadows, false);
    assert.equal(low.pixelBudget, 750_000);
    assert.equal(low.maxCustomers, 26);
    assert.equal(composeQuality("medium", 3).shadowMapSize, 512);
  });
});

describe('sustained load protection',()=>{
 it('preserves sharpness at the first pressure step, then scales under continuing pressure',()=>{
  for(const tier of ['low','medium','high'] as const){
   let previous=composeQuality(tier,0);
   for(let heat=1;heat<=5;heat++){
    const next=composeQuality(tier,heat);
    if(heat<=2){assert.equal(next.pixelBudget,previous.pixelBudget);assert.equal(next.dprCap,previous.dprCap);}
    else {assert.ok(next.pixelBudget<previous.pixelBudget);assert.ok(next.dprCap<previous.dprCap);}
    assert.equal(next.maxCustomers,previous.maxCustomers);previous=next;
   }
  }
 });
 it('ignores a single slow frame but responds to sustained missed frames',()=>{
  resetHeat();evaluateHeat(60,10,30,{dt:1/30});assert.equal(currentHeat(),0);
  for(let n=0;n<30;n++)evaluateHeat(30,15,30,{dt:1/30});
  assert.ok(currentHeat()>0);resetHeat();
 });
 it('honors OS severity with manual presets and waits before restoring work',()=>{
  resetHeat();setAutoQuality(false);applyTier('high');
  setNativeThermalStatus(2);assert.equal(currentHeat(),2);
  assert.equal(composeQuality('high',2).shadows,true);
  setNativeThermalStatus(5);assert.equal(currentHeat(),5);
  setNativeThermalStatus(0);assert.equal(currentHeat(),5);
  evaluateHeat(2,30,30,{dt:44});assert.equal(currentHeat(),5);
  evaluateHeat(2,30,30,{dt:2});assert.equal(currentHeat(),0);
  resetHeat();
 });
});

describe("targetFps", () => {
  it("targets 60 for native medium/high auto", () => {
    assert.equal(
      targetFps({ native: true, mobile: true, heat: 0, tier: "high" }),
      60,
    );
    assert.equal(
      targetFps({ native: true, mobile: true, heat: 0, tier: "medium" }),
      60,
    );
  });

  it("targets 60 for mobile auto", () => {
    assert.equal(
      targetFps({ native: false, mobile: true, heat: 0, tier: "high" }),
      60,
    );
  });

  it("uses 60 for desktop high auto", () => {
    assert.equal(
      targetFps({ native: false, mobile: false, heat: 0, tier: "high" }),
      60,
    );
  });

  it("tries 60 on low and falls to 30 at the first pressure step", () => {
    assert.equal(
      targetFps({ native: false, mobile: false, heat: 0, tier: "low" }),
      60,
    );
    assert.equal(
      targetFps({ native: false, mobile: false, heat: 1, tier: "low" }),
      30,
    );
  });

  it("waits longer before retrying when a recovered frame rate fails again", () => {
    resetHeat();
    try {
      const miss = () => { for (let n = 0; n < 30; n++) evaluateHeat(30, 20, 60, { dt: 1 / 30 }); };
      const comfortable = (seconds: number) => { for (let n = 0; n < seconds * 10; n++) evaluateHeat(4, 30, 30, { dt: 0.1 }); };
      miss(); assert.equal(currentHeat(), 1);
      comfortable(6 + 21); assert.equal(currentHeat(), 0);
      comfortable(46); miss(); assert.equal(currentHeat(), 1);
      comfortable(6 + 21); assert.equal(currentHeat(), 1, 'second recovery needs a longer calm period');
      comfortable(20); assert.equal(currentHeat(), 0);
    } finally { resetHeat(); }
  });

  it("honours a 45 preference at heat 0", () => {
    assert.equal(
      targetFps({
        native: true,
        mobile: true,
        heat: 0,
        tier: "high",
        preference: 45,
      }),
      45,
    );
  });

  it("forces 30 at heat 3 even if preference is 45", () => {
    assert.equal(
      targetFps({
        native: false,
        mobile: false,
        heat: 3,
        tier: "high",
        preference: 45,
      }),
      30,
    );
  });

  it("stays at 30 for heat 4 and 5", () => {
    assert.equal(
      targetFps({ native: false, heat: 4, tier: "high", preference: 45 }),
      30,
    );
    assert.equal(
      targetFps({ native: false, heat: 5, tier: "high", preference: 45 }),
      30,
    );
  });
});

describe("evaluateHeat", () => {
  it('does not carry intentional menu FPS into healthy 60 FPS gameplay', () => {
    resetHeat();
    const meter=new FrameRateMeter();let now=0;
    try {
      for(let cycle=0;cycle<4;cycle++){
        for(let frame=0;frame<15;frame++){
          now+=100;
          evaluateHeat(2,meter.sample(now,10),10,{dt:.1,samplingPaused:true});
        }
        for(let frame=0;frame<600;frame++){
          now+=1000/60;
          evaluateHeat(2,meter.sample(now,60),60,{dt:1/60});
        }
        assert.equal(currentHeat(),0);
      }
    } finally {resetHeat();}
  });

  it('ignores menu rendering work but still reacts to genuine gameplay overload', () => {
    resetHeat();
    try {
      for(let frame=0;frame<200;frame++)evaluateHeat(70,5,10,{dt:.1,samplingPaused:true});
      assert.equal(currentHeat(),0);
      for(let frame=0;frame<120;frame++)evaluateHeat(25,25,60,{dt:1/60});
      assert.ok(currentHeat()>0);
    } finally {resetHeat();}
  });

  it('keeps native thermal severity and timed thermal recovery active in menus', () => {
    resetHeat();
    try {
      setNativeThermalStatus(3);
      evaluateHeat(2,10,10,{dt:1,samplingPaused:true});assert.equal(currentHeat(),3);
      setNativeThermalStatus(0);
      evaluateHeat(2,10,10,{dt:44,samplingPaused:true});assert.equal(currentHeat(),3);
      evaluateHeat(2,10,10,{dt:2,samplingPaused:true});assert.equal(currentHeat(),0);
    } finally {resetHeat();}
  });

  it("climbs one step when pressure is hot", () => {
    resetHeat();
    evaluateHeat(5, 60, 45, { pressureHot: true, dt: 0.03 });
    assert.equal(currentHeat(), 1);
  });

  it("does not climb while cooldown remains", () => {
    resetHeat();
    evaluateHeat(5, 60, 45, { pressureHot: true, dt: 0.03 });
    evaluateHeat(5, 60, 45, { pressureHot: true, dt: 0.03 });
    assert.equal(currentHeat(), 1);
  });

  it("climbs again after wall-clock cooldown", () => {
    resetHeat();
    evaluateHeat(5, 60, 45, { pressureHot: true, dt: 0.03 });
    evaluateHeat(5, 60, 45, { pressureHot: true, dt: 13 });
    evaluateHeat(5, 60, 45, { pressureHot: true, dt: 0.03 });
    assert.equal(currentHeat(), 2);
  });
});


describe("quality listener lifetime", () => {
  it("releases a disposed owner without removing another subscription", () => {
    let count = 0;
    const callback = () => count++;
    const stopA = onHeatChange(callback), stopB = onHeatChange(callback);
    try {
      applyTier("low", true);
      assert.equal(count, 2);
      stopA(); stopA();
      applyTier("medium", true);
      assert.equal(count, 3);
      stopB();
      applyTier("high", true);
      assert.equal(count, 3);
    } finally { stopA(); stopB(); resetHeat(); }
  });
  it("does not notify an owner removed during the same quality change", () => {
    let count = 0;
    let stopSecond = () => {};
    const stopFirst = onHeatChange(() => stopSecond());
    stopSecond = onHeatChange(() => count++);
    try {
      applyTier("low", true);
      assert.equal(count, 0);
    } finally { stopFirst(); stopSecond(); applyTier("high", true); resetHeat(); }
  });
});
