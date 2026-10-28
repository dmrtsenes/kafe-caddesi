import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultFpsPreference,
  detectRefreshHz,
  frameFps,
  fpsSampleIsBad,
  fpsSampleIsGood,
  isMobileDevice,
  pacedFps,
  playFps,
  vsyncStride,
} from "./framePolicy.ts";

describe("isMobileDevice", () => {
  it("detects mobile user agents", () => {
    assert.equal(
      isMobileDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8)"),
      true,
    );
    assert.equal(
      isMobileDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"),
      true,
    );
  });

  it("detects coarse-pointer devices without a mobile user agent", () => {
    assert.equal(isMobileDevice("Mozilla/5.0 (X11; Linux x86_64)", true), true);
  });

  it("does not classify a desktop user agent without a coarse pointer as mobile", () => {
    assert.equal(isMobileDevice("Mozilla/5.0 (X11; Linux x86_64)"), false);
  });
});

describe("playFps", () => {
  it("targets 60 FPS for native/mobile auto; low steps to 30 at its first pressure step", () => {
    assert.equal(
      playFps({ native: false, mobile: true, heat: 0, tier: "high" }),
      60,
    );
    assert.equal(
      playFps({ native: true, mobile: true, heat: 0, tier: "low" }),
      60,
    );
    assert.equal(
      playFps({ native: true, mobile: true, heat: 1, tier: "low" }),
      30,
    );
    assert.equal(
      playFps({ native: true, mobile: true, heat: 1, tier: "low", preference: 60 }),
      60,
    );
    assert.equal(
      playFps({ native: true, mobile: true, heat: 0, tier: "medium" }),
      60,
    );
    assert.equal(
      playFps({ native: true, mobile: false, heat: 0, tier: "high" }),
      60,
    );
  });

  it("uses 60 FPS for desktop medium and high auto", () => {
    assert.equal(
      playFps({ native: false, mobile: false, heat: 0, tier: "high" }),
      60,
    );
    assert.equal(
      playFps({ native: false, mobile: false, heat: 0, tier: "medium" }),
      60,
    );
    assert.equal(
      playFps({ native: false, mobile: false, heat: 0, tier: "low" }),
      60,
    );
  });

  it("honours 30, 45 and 60 FPS preferences", () => {
    for (const fps of [30, 45, 60] as const) {
      assert.equal(
        playFps({
          native: true,
          mobile: true,
          heat: 0,
          tier: "high",
          preference: fps,
        }),
        fps,
      );
    }
  });

  it("uses 60 as the default for every tier", () => {
    assert.equal(defaultFpsPreference(false, true, "high"), 60);
    assert.equal(defaultFpsPreference(true, false, "high"), 60);
    assert.equal(defaultFpsPreference(true, false, "medium"), 60);
    assert.equal(defaultFpsPreference(true, false, "low"), 60);
    assert.equal(defaultFpsPreference(false, false, "high"), 60);
    assert.equal(defaultFpsPreference(false, false, "medium"), 60);
    assert.equal(defaultFpsPreference(false, false, "low"), 60);
  });

  it("reduces automatic mobile FPS before the first image-resolution reduction", () => {
    assert.equal(playFps({native:true,mobile:true,heat:1,tier:'medium'}),60);
    assert.equal(playFps({native:true,mobile:true,heat:2,tier:'medium'}),30);
    assert.equal(playFps({native:true,mobile:true,heat:0,tier:'medium'}),60);
    assert.equal(playFps({native:true,mobile:true,heat:1,tier:'medium',preference:60}),60);
    assert.equal(playFps({native:false,mobile:false,heat:2,tier:'high'}),60);
  });

  it("limits the selected 45 FPS mode to 30 at heat 3", () => {
    assert.equal(
      playFps({
        native: true,
        mobile: true,
        heat: 3,
        tier: "high",
        preference: 45,
      }),
      30,
    );
    assert.equal(
      playFps({
        native: false,
        mobile: false,
        heat: 3,
        tier: "high",
        preference: 45,
      }),
      30,
    );
  });

  it("limits 60 FPS under thermal pressure", () => {
    assert.equal(
      playFps({
        native: true,
        mobile: true,
        heat: 3,
        tier: "high",
        preference: 60,
      }),
      30,
    );
    assert.equal(pacedFps(60, 60), 60);
    assert.equal(pacedFps(120, 60), 60);
  });

  it("keeps 45 at heat 0 and heat 2 when preference is 45", () => {
    assert.equal(
      playFps({
        native: false,
        mobile: false,
        heat: 0,
        tier: "high",
        preference: 45,
      }),
      45,
    );
    assert.equal(
      playFps({
        native: false,
        mobile: false,
        heat: 2,
        tier: "high",
        preference: 45,
      }),
      45,
    );
  });
});

describe("frameFps", () => {
  it("uses a 10 FPS render budget while the UI blocks gameplay", () => {
    assert.equal(
      frameFps({
        native: false,
        mobile: true,
        heat: 0,
        tier: "high",
        uiBlocked: true,
        preference: 45,
      }),
      10,
    );
  });

  it("honours the selected gameplay budget when the UI is not blocked", () => {
    assert.equal(
      frameFps({
        native: false,
        mobile: true,
        heat: 0,
        tier: "high",
        uiBlocked: false,
        preference: 45,
      }),
      45,
    );
  });

  it("agrees with playFps for native auto", () => {
    assert.equal(
      frameFps({
        native: true,
        mobile: true,
        heat: 0,
        tier: "high",
        uiBlocked: false,
      }),
      playFps({ native: true, mobile: true, heat: 0, tier: "high" }),
    );
  });
});

describe("fps samples", () => {
  it("uses the target FPS for bad and good thresholds", () => {
    assert.equal(fpsSampleIsBad(52, 60), false);
    assert.equal(fpsSampleIsBad(51.6, 60), false);
    assert.equal(fpsSampleIsBad(51.5, 60), true);
    assert.equal(fpsSampleIsGood(58, 60), true);
    assert.equal(fpsSampleIsGood(57, 60), false);
  });

  it("treats unavailable FPS as unknown for degradation and safe for recovery", () => {
    assert.equal(fpsSampleIsBad(0, 30), false);
    assert.equal(fpsSampleIsGood(0, 30), true);
  });
});

describe("vsyncStride", () => {
  it("does not lose a third of the frame rate to refresh measurement jitter", () => {
    for (const hz of [59.8, 60.2, 61]) {
      assert.equal(vsyncStride(hz, 30), 2);
      assert.equal(pacedFps(hz, 60), 60);
    }
    assert.equal(vsyncStride(120.5, 30), 4);
  });
  it("keeps 30 even on 60 Hz", () => {
    assert.equal(vsyncStride(60, 30), 2);
    assert.equal(pacedFps(60, 30), 30);
  });

  it("drops 45 to 30 on 60 Hz so cadence stays even", () => {
    assert.equal(vsyncStride(60, 45), 2);
    assert.equal(pacedFps(60, 45), 30);
  });

  it("keeps 45 even on 90 Hz", () => {
    assert.equal(vsyncStride(90, 45), 2);
    assert.equal(pacedFps(90, 45), 45);
  });

  it("snaps 45 to 40 on 120 Hz instead of 2.67-frame judder", () => {
    assert.equal(vsyncStride(120, 45), 3);
    assert.equal(pacedFps(120, 45), 40);
  });

  it("keeps 30 even on 120 Hz", () => {
    assert.equal(vsyncStride(120, 30), 4);
    assert.equal(pacedFps(120, 30), 30);
  });

  it("paces a 60 cap to a whole frame on 60 Hz and 120 Hz", () => {
    assert.equal(vsyncStride(60, 60), 1);
    assert.equal(pacedFps(60, 60), 60);
    assert.equal(vsyncStride(120, 60), 2);
    assert.equal(pacedFps(120, 60), 60);
    assert.equal(vsyncStride(90, 60), 2);
    assert.equal(pacedFps(90, 60), 45);
  });

  it("paces the UI 10 FPS cap to a whole vsync stride", () => {
    assert.equal(vsyncStride(60, 10), 6);
    assert.equal(pacedFps(60, 10), 10);
  });
});

describe("detectRefreshHz", () => {
  it("keeps a plausible reported rate", () => {
    assert.equal(detectRefreshHz(120), 120);
    assert.equal(detectRefreshHz(90), 90);
  });

  it("falls back when the rate is missing or nonsense", () => {
    assert.equal(detectRefreshHz(0, 60), 60);
    assert.equal(detectRefreshHz(Number.NaN, 60), 60);
    assert.equal(detectRefreshHz(12, 60), 60);
  });
});
