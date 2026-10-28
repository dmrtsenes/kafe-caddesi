import assert from "node:assert/strict";
import { it } from "node:test";
import { renderPixelRatio, stableRefreshRate } from "./RenderBudget";
it("keeps tablet and high-DPI pixel cost within budget while preserving native UI", () => {
  for (const [w, h, dpr] of [
    [360, 780, 3],
    [800, 1280, 2],
    [1440, 2560, 3],
    [3840, 2160, 2],
    [7680, 4320, 1],
  ]) {
    const ratio = renderPixelRatio(w, h, dpr, 1.35, 1_000_000);
    assert.ok(w * h * ratio * ratio <= 1_000_001);
    assert.ok(ratio <= dpr);
  }
});
it("stabilizes jitter around common display rates without converting distinct rates", () => {
  for (const [raw, hz] of [
    [60.2, 60],
    [59.8, 60],
    [120.5, 120],
    [89.5, 90],
    [144, 144],
    [165, 165],
  ])
    assert.equal(stableRefreshRate(raw), hz);
  assert.equal(stableRefreshRate(110), 110);
});
