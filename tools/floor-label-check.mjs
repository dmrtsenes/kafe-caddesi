import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = '.devshots/floor-labels'; await mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 5260, strictPort: true, open: false, hmr: false, watch: null } });
let browser;
try {
  await server.listen(); browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1061, height: 900 }, locale: 'tr-TR' }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5260/'); await page.waitForFunction(() => !!window.__fincan);
  await page.locator('#boot-screen').waitFor({ state: 'detached' });
  const setup = await page.evaluate(async () => {
    const g = window.__fincan; g.stop(); g.ui.setTutorial(null); g.ui.closePanels();
    const T = await import('/node_modules/three/build/three.module.js');
    // Include later coffee/cashier machines; their height can cover a floor label.
    for (const view of g.world.stationVisuals.values()) { view.setLocked(false); view.update(1); }
    const labels = { waiter: 'Tezgâhtar · ₺1,4B', cashier: 'Kasiyer · ₺11B', busser: 'Komi · ₺9,0B', barista: 'Barista · ₺18B' };
    for (const [role, pad] of g.world.staffHirePads) { pad.root.visible = true; pad.setLabel(labels[role]); pad.update(1, g.scene3d.camera.quaternion); }
    for (const [id, pad] of g.world.sidePurchasePads) {
      pad.root.visible = true; pad.setLabel(id === 'garden' ? 'Bahçe Çay Evi · ↑ 2 · ₺785' : 'Avlu Paket Servisi · AÇ · ₺2,2B'); pad.update(1, g.scene3d.camera.quaternion);
    }
    for (const view of g.world.pickupVisuals.values()) { view.setLocked(false); view.setContents(['cay', 'latte', 'tost'], 8); view.update(1); }
    g.world.env.setPadVisible('a3', true); g.world.env.setPadNear('a3', true);
    g.world.env.setPadProgress('a3', .38); g.world.env.setPadLabel('a3', '₺1,1B'); g.world.env.update(1);
    const floor = [...g.world.staffHirePads.values(), ...g.world.sidePurchasePads.values()].map(pad => pad.root.getObjectByName('floorPurchaseLabel'));
    const stock = [...g.world.pickupVisuals.values()].map(v => v.root.getObjectByName('fixedStockLabel'));
    g.world.root.updateMatrixWorld(true);
    const original = floor.map(o => o.matrixWorld.elements.slice());
    let maxShift = 0;
    for (let i = 0; i < 80; i++) {
      g.scene3d.snapTo(Math.sin(i * .1) * 4, -6 + Math.cos(i * .1) * 2);
      for (const pad of g.world.staffHirePads.values()) pad.update(1 / 60, g.scene3d.camera.quaternion);
      for (const pad of g.world.sidePurchasePads.values()) pad.update(1 / 60, g.scene3d.camera.quaternion);
      g.world.root.updateMatrixWorld(true);
      floor.forEach((o, n) => o.matrixWorld.elements.forEach((v, k) => { maxShift = Math.max(maxShift, Math.abs(v - original[n][k])); }));
    }
    const result = { maxShift, overlays: document.querySelectorAll('.world-callout, .world-callout-line').length,
      floor: floor.map(o => ({ ...o.userData, height: o.position.y,
        transparentRowGap: o.material.map.image.getContext('2d').getImageData(512, 450, 1, 1).data[3] === 0,
        flatMarkings: o.parent.children.every(child => child.geometry?.type === 'PlaneGeometry' && child.position.y < .035),
        insideSquare: Math.abs(o.position.x) + o.geometry.parameters.width / 2 < .595 &&
          Math.abs(o.position.z) + o.geometry.parameters.height / 2 < .595,
        activationGap: .5125 - (o.position.z + o.geometry.parameters.height / 2),
        normal: new T.Vector3(0, 0, 1).applyQuaternion(o.quaternion).toArray(),
        width: o.geometry.parameters.width, depth: o.geometry.parameters.height, depthTest: o.material.depthTest, texture: [o.material.map.image.width, o.material.map.image.height] })),
      stock: stock.map(o => ({ ...o.userData, depthTest: o.material.depthTest })) };
    window.__floorCheck = { g, T, floor, stock }; return result;
  });
  const screens = [];
  for (const [width, height] of [[1061, 900], [390, 844], [320, 640], [844, 390]]) {
    await page.setViewportSize({ width, height });
    for (const focus of ['waiter', 'cashier', 'garden', 'busser', 'barista', 'stock', 'zone']) {
      const screen = await page.evaluate(focus => {
        const { g, T } = window.__floorCheck;
        const pad = focus === 'zone' ? { root: g.world.env.root.getObjectByName('zonePad_a3') }
          : g.world.staffHirePads.get(focus) ?? g.world.sidePurchasePads.get(focus);
        const spot = pad?.root.position ?? [...g.world.pickupVisuals.values()][1].root.position;
        g.player.setPosition(spot.x + 2.3, spot.z); g.scene3d.resize(); g.scene3d.snapTo(spot.x, spot.z);
        g.scene3d.render();
        const label = pad?.root.getObjectByName(focus === 'zone' ? 'zonePurchaseDecal' : 'floorPurchaseLabel')
          ?? [...g.world.pickupVisuals.values()][1].root.getObjectByName('fixedStockLabel');
        const corners = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, y]) => new T.Vector3(x * label.geometry.parameters.width / 2, y * label.geometry.parameters.height / 2, 0).applyMatrix4(label.matrixWorld).project(g.scene3d.camera));
        return { focus, pixelWidth: (Math.max(...corners.map(p => p.x)) - Math.min(...corners.map(p => p.x))) * innerWidth / 2,
          pixelHeight: (Math.max(...corners.map(p => p.y)) - Math.min(...corners.map(p => p.y))) * innerHeight / 2 };
      }, focus);
      screens.push({ width, height, ...screen }); await page.screenshot({ path: `${out}/${width}-${height}-${focus}.png` });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const depth = await page.evaluate(() => {
    const { g, T } = window.__floorCheck;
    const pad = g.world.staffHirePads.get('busser'), label = pad.root.getObjectByName('floorPurchaseLabel');
    g.scene3d.resize(); g.scene3d.snapTo(pad.root.position.x, pad.root.position.z); g.world.root.updateMatrixWorld(true);
    const at = label.getWorldPosition(new T.Vector3());
    const blocker = new T.Mesh(new T.BoxGeometry(.8, .04, .35), new T.MeshBasicMaterial({ color: '#ff00d0', toneMapped: false }));
    blocker.position.copy(at); blocker.position.y += .18; blocker.layers.set(1); g.world.root.add(blocker);
    const read = () => {
      const renderer = g.scene3d.renderer, gl = renderer.getContext(), size = renderer.getDrawingBufferSize(new T.Vector2());
      const p = blocker.position.clone().project(g.scene3d.camera), rgba = new Uint8Array(4);
      gl.readPixels(Math.floor((p.x * .5 + .5) * size.x), Math.floor((p.y * .5 + .5) * size.y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      return [...rgba];
    };
    const phases = [];
    for (const expected of ['direct', 'bake', 'cached']) {
      g.scene3d.render(); phases.push({ expected, path: g.scene3d.renderPath, pixel: read() });
    }
    label.visible = false; g.scene3d.render(); const withoutLabel = read(); label.visible = true;
    blocker.removeFromParent(); blocker.geometry.dispose(); blocker.material.dispose();
    let draws = 0; const onRender = label.onBeforeRender; label.onBeforeRender = () => { draws++; };
    g.scene3d.render(); const visibleDraws = draws; draws = 0; pad.root.visible = false; g.scene3d.render();
    const hiddenDraws = draws; pad.root.visible = true; label.onBeforeRender = onRender;
    g.player.setPosition(at.x, at.z + .08); g.scene3d.render();
    return { phases, withoutLabel, visibleDraws, hiddenDraws };
  });
  await page.screenshot({ path: `${out}/390-844-character-occlusion.png` });
  await page.evaluate(() => {
    const { g } = window.__floorCheck; g.persistDisabled = true; g.state.tutorialStep = 99;
    g.state.unlockedLocations.add('sahil'); g.state.unlockedZones.add('sahil:p1'); g.switchLocation('sahil'); g.stop();
    for (const view of g.world.stationVisuals.values()) { view.setLocked(false); view.update(1); }
    for (const view of g.world.pickupVisuals.values()) { view.setLocked(false); view.update(1); }
    const labels = { waiter: 'Tezgâhtar · ₺1,4B', cashier: 'Kasiyer · ₺11B', busser: 'Komi · ₺9,0B', barista: 'Barista · ₺18B' };
    for (const [role, pad] of g.world.staffHirePads) { pad.root.visible = true; pad.setLabel(labels[role]); pad.update(1, g.scene3d.camera.quaternion); }
  });
  for (const role of ['waiter', 'barista', 'cashier', 'busser']) {
    await page.evaluate(role => {
      const { g } = window.__floorCheck, pad = g.world.staffHirePads.get(role), p = pad.root.position;
      g.player.setPosition(p.x + 2, p.z); g.scene3d.snapTo(p.x, p.z); g.scene3d.render();
    }, role);
    await page.screenshot({ path: `${out}/sahil-390-844-${role}.png` });
  }
  const report = { ...setup, screens, sahilViews: 4, depth, errors }; await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  assert.deepEqual(errors, []); assert.equal(setup.maxShift, 0); assert.equal(setup.overlays, 0);
  assert.ok(setup.floor.every(f => f.height < .1 && f.normal[1] > .999 && f.depthTest && f.labelTitle.length <= 12 && f.texture[0] === 1024));
  assert.ok(setup.floor.every(f => f.insideSquare && f.activationGap > .04), 'captions must stay inside the payment border and clear of the activation bar');
  assert.ok(setup.floor.every(f => f.transparentRowGap && f.flatMarkings), 'floor labels must have transparent backgrounds and no raised plates');
  assert.ok(setup.stock.every(s => s.depthTest && s.labelTitle === '3 / 8'));
  for (const phase of depth.phases) { assert.equal(phase.path, phase.expected); assert.deepEqual(phase.pixel, depth.withoutLabel); }
  assert.ok(depth.withoutLabel[0] > 240 && depth.withoutLabel[1] < 10, 'depth probe must hit the foreground object');
  assert.equal(depth.visibleDraws, 1); assert.equal(depth.hiddenDraws, 0);
} finally { await browser?.close(); await server.close(); }
