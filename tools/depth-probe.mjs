import { chromium } from 'playwright';
import { createServer } from 'vite';

/**
 * Depth-precision probe. Renders the same still frame with several camera
 * near planes and counts pixels that change. A near of 0.002 on a 24-bit
 * buffer has the resolution a 16-bit buffer has at 0.5, so pixels that differ
 * from the 6.0 reference are the ones that z-fight on low-precision GPUs.
 */
const server = await createServer({ configFile: false, root: process.cwd(),
  optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('fincan-sokagi:settings:v2', JSON.stringify({ quality: 'medium', qualityAuto: false, fps: 60, muted: true, music: false }));
  });
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__fincan, null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  const report = await page.evaluate(() => {
    const g = window.__fincan, s = g.scene3d;
    g.stop(); g.persistDisabled = true;
    // Other actors wander during the warmup and make fight16 swing by hundreds
    // of pixels. Keep the player, who is posed at each viewpoint below.
    s.scene.traverse(o => {
      if (o.type !== 'SkinnedMesh') return;
      let host = o, player = false;
      while (host) {
        if (host.userData && host.userData.characterRole === 'player') player = true;
        host = host.parent;
      }
      if (!player) o.visible = false;
    });
    s.scene.traverse(o => {
      if (o.isInstancedMesh && o.instanceMatrix && o.instanceMatrix.usage === 35048) o.visible = false;
      if (o.name === 'spills') o.visible = false;
    });
    const gl = s.renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const buf = new Uint8Array(w * h * 4);
    const shot = (near) => {
      s.camera.near = near; s.camera.updateProjectionMatrix();
      s.render();
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return buf.slice();
    };
    const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4)
      if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++; return n; };
    const b = g.world.loc.bounds, out = [];
    // Reference: pixel-exact scene at the precise 24-bit near of 0.5.
    // `clipped`  = pixels lost because the game's near plane cut geometry.
    // `fight16`  = pixels that z-fight at 16-bit-equivalent precision (near/256).
    // `fight16Old` = the same measure for the old fixed near of 0.5.
    for (let iz = 0; iz < 4; iz++) for (let ix = 0; ix < 3; ix++) {
      const x = b.x0 + (b.x1 - b.x0) * (ix + 0.5) / 3, z = b.z0 + (b.z1 - b.z0) * (iz + 0.5) / 4;
      g.player.x = x; g.player.z = z; s.snapTo(x, z);
      const gameNear = s.camera.near;
      const exact = shot(0.5);
      const mine = shot(gameNear);
      out.push({ at: [+x.toFixed(1), +z.toFixed(1)], near: +gameNear.toFixed(2),
        clipped: diff(exact, mine),
        fight16: diff(mine, shot(gameNear / 256)),
        fight16Old: diff(exact, shot(0.5 / 256)) });
      s.camera.near = gameNear; s.camera.updateProjectionMatrix();
    }
    const glInfo = (() => {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        depthBits: gl.getParameter(gl.DEPTH_BITS),
        samples: gl.getParameter(gl.SAMPLES),
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
      };
    })();
    const report = { w, h, bounds: b, out, glInfo };
    fetch('http://127.0.0.1:7925/ingest/10795fa9-0e80-447d-93a6-8edad0ead0ef',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0c35b8'},body:JSON.stringify({sessionId:'0c35b8',runId:'baseline',hypothesisId:'A',location:'tools/depth-probe.mjs',message:'fight16',data:report,timestamp:Date.now()})}).catch(()=>{});
    return report;
  });
  console.log(JSON.stringify({ ...report, errors }));
} finally { await browser.close(); await server.close(); }
