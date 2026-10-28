import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';
import ts from 'typescript';
import { chromium } from 'playwright';

it('Canvas and Path2D roundRect fallbacks preserve native shapes and boot without the API', async () => {
  const code = ts.transpileModule(readFileSync(new URL('../src/core/CanvasCompat.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const result = await page.evaluate(code => {
      const exports = {};
      new Function('exports', code)(exports);
      const install = exports.installCanvasCompat;
      const cp = CanvasRenderingContext2D.prototype, pp = Path2D.prototype;
      const nativeCanvas = cp.roundRect, nativePath = pp.roundRect;
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      install();
      check(cp.roundRect === nativeCanvas && pp.roundRect === nativePath, 'existing native APIs stay identical');
      delete cp.roundRect;
      install();
      const fallbackCanvas = cp.roundRect;
      check(typeof fallbackCanvas === 'function' && pp.roundRect === nativePath, 'partial support preserved');
      delete pp.roundRect;
      install();
      check(cp.roundRect === fallbackCanvas && typeof pp.roundRect === 'function', 'idempotent independent installation');
      const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = 192; return c.getContext('2d'); };
      const radii = [0, 16, [8, 22], [8, 22, 15], [8, 22, 15, 4], { x: 24, y: 9 },
        [{ x: 6, y: 18 }, 12, { x: 22, y: 7 }, { x: 0, y: 4 }], 200,
        [{ x: 160, y: 40 }, { x: 35, y: 110 }, 100, 20], { x: 0, y: 24 }, {}, new Set([7, 19])];
      let comparisons = 0, maxDifference = 0, sampleMismatches = 0;
      const compare = (args, pathMode, compound) => {
        const outputs = [];
        for (const native of [true, false]) {
          const ctx = canvas(), path = pathMode ? new Path2D() : ctx;
          if (compound) path.rect(8, 8, 176, 176);
          const method = native ? (pathMode ? nativePath : nativeCanvas) : path.roundRect;
          method.apply(path, args);
          // roundRect must retain earlier subpaths and leave the current point at the normalized rectangle origin.
          path.lineTo(180, 180);
          const samples = [];
          for (let y = 9.37; y < 185; y += 5) for (let x = 9.37; x < 185; x += 5)
            samples.push(pathMode ? ctx.isPointInPath(path, x, y) : ctx.isPointInPath(x, y));
          ctx.fillStyle = '#ca631c'; ctx.strokeStyle = '#31857e'; ctx.lineWidth = 1.25;
          if (pathMode) { ctx.fill(path); ctx.stroke(path); } else { ctx.fill(); ctx.stroke(); }
          outputs.push({ samples, pixels: ctx.getImageData(0, 0, 192, 192).data });
        }
        let totalDifference = 0;
        for (let i = 0; i < outputs[0].samples.length; i++) if (outputs[0].samples[i] !== outputs[1].samples[i]) sampleMismatches++;
        for (let i = 0; i < outputs[0].pixels.length; i++) totalDifference += Math.abs(outputs[0].pixels[i] - outputs[1].pixels[i]);
        // Native rounded-rect and ellipse rasterization can differ slightly along antialiased edges.
        const meanDifference = totalDifference / outputs[0].pixels.length;
        maxDifference = Math.max(maxDifference, meanDifference);
        check(meanDifference < 0.5, 'pixel mismatch: ' + JSON.stringify({ args, pathMode, compound, meanDifference }));
        comparisons++;
      };
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const radius of radii)
        for (const pathMode of [false, true]) for (const compound of [false, true])
          compare([sx < 0 ? 150 : 30, sy < 0 ? 140 : 40, sx * 120, sy * 100, radius], pathMode, compound);
      for (const [w, h] of [[0, 100], [100, 0], [0, 0]]) for (const pathMode of [false, true]) compare([40, 40, w, h, 15], pathMode, false);
      for (const pathMode of [false, true]) {
        compare([30, 40, 120, 100], pathMode, true);
        for (let index = 0; index < 4; index++) for (const invalid of [NaN, Infinity]) {
          const args = [30, 40, 120, 100, 12]; args[index] = invalid;
          compare(args, pathMode, true);
        }
      }
      const invalid = [[], [1, 2, 3, 4, 5], -1, { x: -1, y: 2 }, { x: 3, y: -2 }, NaN, Infinity, { x: Infinity }, [NaN, -1]];
      for (const pathMode of [false, true]) for (const radius of invalid) {
        const outcomes = [];
        for (const native of [true, false]) {
          const ctx = canvas(), path = pathMode ? new Path2D() : ctx;
          path.rect(1, 1, 3, 3);
          let error = null;
          try { (native ? (pathMode ? nativePath : nativeCanvas) : path.roundRect).call(path, 10, 10, 50, 50, radius); }
          catch (e) { error = e.name; }
          outcomes.push({ error, oldPath: pathMode ? ctx.isPointInPath(path, 2, 2) : ctx.isPointInPath(2, 2),
            newPath: pathMode ? ctx.isPointInPath(path, 30, 30) : ctx.isPointInPath(30, 30) });
        }
        check(JSON.stringify(outcomes[0]) === JSON.stringify(outcomes[1]), 'invalid radii behavior: ' + JSON.stringify({ radius, outcomes }));
      }
      check(sampleMismatches === 0, 'native/fallback fill and winding samples differ: ' + sampleMismatches);
      return { comparisons, sampleMismatches, maxDifference };
    }, code);
    assert.equal(result.sampleMismatches, 0);
    assert.ok(result.comparisons >= 190);
    console.log('Canvas compatibility:', result);
  } finally { await browser.close(); }
});
