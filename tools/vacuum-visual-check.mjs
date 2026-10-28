import { chromium } from 'playwright';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';

// Run after VacuumAsset.ts is integrated. Uses real Player.update/World.brushPoint
// with a clear NavGrid; only the camera/stage and deterministic input are fixtures.
await access('src/world/VacuumAsset.ts');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const output = args.output ?? '.devshots/vacuum-visual-check';
const port = Number(args.port ?? 5203);
await mkdir(output, { recursive: true });
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port, strictPort: true, open: false, hmr: false, watch: null } });
await server.listen();
const origin = 'http://127.0.0.1:' + port;
let browser;
const results = [];
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  for (const mode of [args.mode ?? 'release']) {
    const context = await browser.newContext({ viewport: { width: 640, height: 720 }, deviceScaleFactor: 1, locale: 'tr-TR' });
    const page = await context.newPage();
    const errors = [], remoteRequests = [], failedAssets = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (response) => { if (response.status() >= 400) failedAssets.push({ url: response.url(), status: response.status() }); });
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.startsWith(origin + '/') || /^(data|blob):/.test(url)) await route.continue();
      else { remoteRequests.push(url); await route.abort(); }
    });
    await page.addInitScript(() => {
      localStorage.setItem('fincan-sokagi:language:v1', 'tr');
      localStorage.setItem('fincan-sokagi:settings:v2', JSON.stringify({ muted: true, music: false, quality: 'medium', qualityAuto: false }));
    });
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!window.__fincan, {}, { timeout: 90000 });
    await page.locator('#boot-screen').waitFor({ state: 'detached', timeout: 30000 });
    const initial = await page.evaluate(async (fps) => {
      const game = window.__fincan;
      game.stop();
      document.getElementById('ui-root').style.display = 'none';
      const [{ THREE: T }, { Player }, { NavGrid }, { createHeldVacuum }, { BALANCE }] = await Promise.all([
        import('/tools/browser-render.ts'), import('/src/entities/Player.ts'), import('/src/sim/Navigation.ts'),
        import('/src/world/StationView.ts'), import('/src/data/balance.ts'),
      ]);
      const scene = new T.Scene();
      scene.background = new T.Color(0xe9dfcf);
      scene.add(new T.HemisphereLight(0xffffff, 0xb7a183, 2.5));
      const sun = new T.DirectionalLight(0xfff1d8, 3);
      sun.position.set(-3, 6, 4);
      scene.add(sun);
      const floorGeo = new T.PlaneGeometry(12, 12);
      floorGeo.rotateX(-Math.PI / 2);
      const floorMat = new T.MeshStandardMaterial({ color: 0xd6ba91, roughness: 0.93 });
      const floor = new T.Mesh(floorGeo, floorMat);
      floor.position.y = -0.006;
      scene.add(floor);
      const player = new Player();
      player.setPosition(0, 0);
      scene.add(player.char.root);
      const camera = new T.PerspectiveCamera(35, 640 / 720, 0.1, 50);
      camera.layers.enableAll();
      const renderer = game.scene3d.renderer;
      renderer.setPixelRatio(1);
      renderer.setSize(640, 720, false);
      const bounds = { x0: -20, z0: -20, x1: 20, z1: 20 };
      const nav = new NavGrid(bounds);
      const hand = new T.Vector3(), grip = new T.Vector3(), mouthWorld = new T.Vector3();
      const yaw = BALANCE.camera.yaw * Math.PI / 180;
      const metrics = { samples: 0, maxGripError: 0, maxBrushError: 0, maxGroundError: 0, maxSweep: 0, maxSpeed: 0, maxHandAxisError: 0, minGripOverhang: Infinity, maxGripOverhang: 0, minHandForward: Infinity, maxGripLength: 0, errors: [] };
      function vacuum() {
        const held = createHeldVacuum(0x376152);
        if (held.root.userData.vacuumAsset !== 'fincan-sera-v1') throw new Error('Expected the original SERA vacuum.');
        return held;
      }
      const held = vacuum();
      const mouth = held.root.getObjectByName('vacuumMouth');
      const body = held.root.getObjectByName('vacuumHead') ?? held.root.getObjectByName('vacuumBody');
      if (!mouth || !body) throw new Error('Vacuum adapter must name its actual mouth anchor and head/body mesh for alignment checks.');
      player.hasVacuum = true;
      player.setVacuumMesh(held);
      const idle = { x: 0, y: 0, mag: 0, active: false };
      function advance(active, direction, magnitude, cleaning) {
        const dx = Math.sin(direction), dz = Math.cos(direction);
        const input = active ? { x: Math.cos(yaw) * dx - Math.sin(yaw) * dz, y: -Math.sin(yaw) * dx - Math.cos(yaw) * dz, mag: magnitude, active: true } : idle;
        player.interacting = cleaning;
        player.update(1 / fps, input, nav, bounds);
        // Recenter the camera fixture, preserving the real measured speed/pose.
        player.setPosition(0, 0);
        player.char.root.updateMatrixWorld(true);
        player.char.handMidLocal(hand);
        player.char.root.localToWorld(hand);
        held.grip.getWorldPosition(grip);
        mouth.getWorldPosition(mouthWorld);
        const brush = game.world.brushPoint(player, true);
        const span = player.char.handSpanLocal(new T.Vector3());
        const midpoint = player.char.handMidLocal(new T.Vector3());
        // After the initial pose blend, neither hand may swing behind the torso.
        // Following an ordinary running arm cycle can make a perfectly aligned
        // grip pass through the body; geometric contact alone is insufficient.
        if (metrics.samples >= 30) metrics.minHandForward = Math.min(metrics.minHandForward, midpoint.z - Math.abs(span.z) * 0.5);
        const leftHand = player.char.root.localToWorld(midpoint.clone().addScaledVector(span, -0.5));
        const rightHand = player.char.root.localToWorld(midpoint.clone().addScaledVector(span, 0.5));
        const gripMesh = held.grip.children.find(o => o.isMesh);
        gripMesh.geometry.computeBoundingBox();
        const gripBox = gripMesh.geometry.boundingBox;
        const a = gripMesh.localToWorld(new T.Vector3(gripBox.min.x, 0, 0));
        const b = gripMesh.localToWorld(new T.Vector3(gripBox.max.x, 0, 0));
        const axis = new T.Line3(a, b);
        const leftT = axis.closestPointToPointParameter(leftHand, false);
        const rightT = axis.closestPointToPointParameter(rightHand, false);
        const length = a.distanceTo(b);
        if (metrics.samples >= 30) metrics.maxGripLength = Math.max(metrics.maxGripLength, length);
        const overhangs = [Math.min(leftT, rightT) * length, (1 - Math.max(leftT, rightT)) * length];
        metrics.maxHandAxisError = Math.max(metrics.maxHandAxisError,
          axis.closestPointToPoint(leftHand, true, new T.Vector3()).distanceTo(leftHand),
          axis.closestPointToPoint(rightHand, true, new T.Vector3()).distanceTo(rightHand));
        metrics.minGripOverhang = Math.min(metrics.minGripOverhang, ...overhangs);
        metrics.maxGripOverhang = Math.max(metrics.maxGripOverhang, ...overhangs);
        const box = new T.Box3().setFromObject(body);
        metrics.samples++;
        metrics.maxGripError = Math.max(metrics.maxGripError, hand.distanceTo(grip));
        metrics.maxBrushError = Math.max(metrics.maxBrushError, Math.hypot(mouthWorld.x - brush.x, mouthWorld.z - brush.z));
        metrics.maxGroundError = Math.max(metrics.maxGroundError, Math.abs(box.min.y - player.char.root.position.y));
        metrics.maxSweep = Math.max(metrics.maxSweep, Math.abs(held.sweep.rotation.y));
        metrics.maxSpeed = Math.max(metrics.maxSpeed, player.planarSpeed);
      }
      function render(view) {
        const center = new T.Vector3(0, 1.1, 0.48);
        const local = view === 'front' ? new T.Vector3(0, 2.45, 6.2) : new T.Vector3(5.2, 2.45, 1.6);
        local.applyAxisAngle(new T.Vector3(0, 1, 0), player.angle);
        camera.position.copy(local);
        camera.lookAt(center);
        renderer.render(scene, camera);
      }
      for (let i = 0; i < 60; i++) advance(false, 0, 0, false);
      // Width and anchor-to-mesh checks use the unswept local head geometry.
      held.sweep.rotation.y = 0;
      player.angle = 0;
      player.char.root.rotation.y = 0;
      player.char.root.updateMatrixWorld(true);
      const headBox = new T.Box3().setFromObject(body);
      mouth.getWorldPosition(mouthWorld);
      const width = headBox.max.x - headBox.min.x;
      const anchorInside = mouthWorld.x >= headBox.min.x - .02 && mouthWorld.x <= headBox.max.x + .02 && mouthWorld.z >= headBox.min.z - .02 && mouthWorld.z <= headBox.max.z + .02;
      let meshes = 0, staticMeshes = 0, triangles = 0, bytes = 0, transparent = 0;
      held.root.traverse((o) => { if (o.isMesh) {
        meshes++; if (!(o.layers.mask & 2)) staticMeshes++;
        triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
        bytes += Object.values(o.geometry.attributes).reduce((sum, a) => sum + a.array.byteLength, 0) + (o.geometry.index?.array.byteLength ?? 0);
        if (o.material.transparent) transparent++;
      } });
      window.__vacuumCheck = { T, game, scene, player, camera, renderer, held, body, mouth, advance, render, metrics, vacuum, floorGeo, floorMat };
      render('side');
      return { rootScale: player.char.root.scale.toArray(), character: player.char.root.userData.characterPack, asset: held.root.userData.vacuumAsset, headWidth: width, headGround: headBox.min.y, anchorInside, meshes, staticMeshes, triangles, bytes, transparent, fps };
    }, Number(args.fps ?? 60));
    await writeFile(output + '/' + mode + '-initial.json', JSON.stringify(initial, null, 2));
    await page.screenshot({ path: output + '/' + mode + '-initial-side.png' });
    assert.equal(initial.character, 'fincan-current');
    assert.ok(initial.headWidth >= 1.4 && initial.headWidth <= 1.6, 'cleaning head width: ' + JSON.stringify(initial));
    assert.ok(initial.headGround >= -0.025 && initial.headGround <= 0.08, 'head must rest at the feet');
    assert.ok(initial.anchorInside, 'mouth anchor must sit inside the actual head footprint');
    assert.ok(initial.meshes <= 4, 'vacuum draw budget exceeded');
    assert.ok(initial.triangles <= 1800, 'vacuum triangle budget exceeded');
    assert.ok(initial.bytes < 80000, 'vacuum geometry memory budget exceeded');
    assert.equal(initial.transparent, 0, 'vacuum must not add transparent overdraw');
    assert.equal(initial.staticMeshes, 0, 'held vacuum must stay out of the static render cache');
    for (const pose of ['push', 'walk', 'sweep', 'turn']) {
      await page.evaluate((pose) => {
        const c = window.__vacuumCheck;
        for (let i = 0; i < 150; i++) c.advance(pose === 'walk' || pose === 'turn', pose === 'turn' ? i / 149 * Math.PI * 1.8 : 0, .75, pose === 'sweep');
      }, pose);
      for (const view of ['side', 'front']) {
        await page.evaluate((view) => window.__vacuumCheck.render(view), view);
        await page.screenshot({ path: output + '/' + mode + '-' + pose + '-' + view + '.png' });
      }
    }
    const measured = await page.evaluate(() => {
      const c = window.__vacuumCheck;
      const { player, renderer, scene, camera, vacuum, T } = c;
      player.setVacuumMesh(null);
      const cycles = [];
      for (let i = 0; i < 18; i++) {
        const item = vacuum();
        player.setVacuumMesh(item);
        renderer.render(scene, camera);
        player.setVacuumMesh(null);
        renderer.render(scene, camera);
        cycles.push({ geometry: renderer.info.memory.geometries, texture: renderer.info.memory.textures, children: player.char.root.children.length });
      }
      const finalHeld = vacuum();
      player.setVacuumMesh(finalHeld);
      renderer.render(scene, camera);
      let heldDisposeCalls = 0;
      const disposeHeld = finalHeld.dispose;
      finalHeld.dispose = () => { heldDisposeCalls++; disposeHeld(); };
      player.dispose();
      renderer.render(scene, camera);
      const heldDetachedOnPlayerDispose = finalHeld.root.parent === null;
      const final = { ...c.metrics, cycles, heldDisposeCalls, heldDetachedOnPlayerDispose, afterPlayerDispose: { geometry: renderer.info.memory.geometries, texture: renderer.info.memory.textures } };
      c.floorGeo.dispose(); c.floorMat.dispose();
      return final;
    });
    await writeFile(output + '/' + mode + '-measured.json', JSON.stringify(measured, null, 2));
    assert.equal(measured.heldDisposeCalls, 1, 'player teardown must dispose its held tool exactly once');
    await page.setViewportSize({ width: 390, height: 844 });
    measured.gameCaptures = [];
    for (const pose of ['push', 'sweep', 'sweep-next']) {
      const frame = await page.evaluate((pose) => {
        const {game, vacuum} = window.__vacuumCheck;
        const p = game.player;
        if(pose==='push') {
          const spot=[[-2,-1.3],[1.5,-1.3],[-3,0],[0,-7]].find(([x,z])=>!game.world.nav.solidBlocked(x,z,.6));
          if(!spot) throw new Error('No clear actual-game display spot');
          p.setPosition(spot[0],spot[1]);
        }
        if (!p.hasVacuum) { p.dropAll(); p.hasVacuum = true; p.setVacuumMesh(vacuum()); }
        const idle={x:0,y:0,mag:0,active:false};
        for(let i=0;i<(pose==='sweep-next'?12:100);i++) { p.interacting=pose.startsWith('sweep'); p.update(1/60,idle,game.world.nav,game.world.loc.bounds); }
        if(pose==='push') game.scene3d.resize();
        game.scene3d.snapTo(p.x,p.z);
        game.scene3d.render();
        const mouth=p.char.root.getObjectByName('vacuumMouth').getWorldPosition(new window.__vacuumCheck.T.Vector3());
        return {pose, mouth:mouth.toArray(), camera:game.scene3d.camera.matrixWorld.elements.slice(), renderPath:game.scene3d.renderPath};
      }, pose);
      measured.gameCaptures.push(frame);
      await page.screenshot({path:output+'/'+mode+'-game-'+pose+'.png'});
    }
    assert.deepEqual(measured.gameCaptures[1].camera, measured.gameCaptures[2].camera, 'sweep captures must use the same camera');
    assert.ok(Math.hypot(...measured.gameCaptures[1].mouth.map((v,i)=>v-measured.gameCaptures[2].mouth[i])) > .025, 'swept nozzle must move while camera stays fixed');
    assert.ok(measured.minHandForward >= .12, 'pushing hands must remain ahead of the torso: '+measured.minHandForward);
    assert.ok(measured.maxGripLength <= .95, 'grip must not stretch across running arms: '+measured.maxGripLength);
    assert.ok(measured.maxHandAxisError <= .03, 'both hands must lie on the grip axis: '+measured.maxHandAxisError);
    assert.ok(measured.minGripOverhang >= .015 && measured.maxGripOverhang <= .075, 'grip ends should extend about .04 past both hands: '+JSON.stringify([measured.minGripOverhang,measured.maxGripOverhang]));
    assert.ok(measured.maxGripError <= .03, 'grip must follow the hand midpoint: ' + measured.maxGripError);
    assert.ok(measured.maxBrushError <= .025, 'brush must follow the swept physical nozzle: ' + measured.maxBrushError);
    assert.ok(measured.maxGroundError <= .08, 'head floats/sinks during motion: ' + measured.maxGroundError);
    assert.ok(measured.maxSweep >= .3, 'the sweep cycle was actually exercised');
    assert.ok(measured.maxSpeed >= 1.5, 'the walking cycle was actually exercised');
    for (const cycle of measured.cycles.slice(4)) assert.deepEqual(cycle, measured.cycles[4], 'repeated pickup/drop leaked resources');
    assert.ok(measured.heldDetachedOnPlayerDispose, 'disposing a player must release its held vacuum');
    assert.deepEqual(remoteRequests, [], 'vacuum/game assets must be local');
    assert.deepEqual(failedAssets, [], 'asset loads failed');
    assert.deepEqual(errors, []);
    const result = { mode, initial, measured, remoteRequests, failedAssets, errors };
    results.push(result);
    await writeFile(output + '/' + mode + '-results.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ mode, ...initial, maxGripError: measured.maxGripError, maxBrushError: measured.maxBrushError, resourcesStable: true }));
    await context.close();
  }
  await writeFile(output + '/results.json', JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
