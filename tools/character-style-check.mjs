import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const phase = process.argv[2] ?? 'after';
const output = '.devshots/signature-cast';
await mkdir(output, { recursive: true });
const server = await createServer({ configFile: false, root: process.cwd(), optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 5258, strictPort: true, open: false, hmr: false, watch: null } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 650 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5258/tools/character-benchmark.html');
  const report = await page.evaluate(async phase => {
    const T = await import('/node_modules/three/build/three.module.js');
    const cast = await import('/src/chars/index.ts'); await cast.loadCharacterPack();
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#f1ece3;overflow:hidden';
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1200, 650); renderer.setPixelRatio(1); renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.1;
    document.body.appendChild(renderer.domElement);
    const scene = new T.Scene(); scene.background = new T.Color('#f1ece3');
    scene.add(new T.HemisphereLight(0xffffff, 0xb8a98b, 2));
    const sun = new T.DirectionalLight(0xffffff, 2.6); sun.position.set(-3, 5, 6); scene.add(sun);
    const camera = new T.OrthographicCamera(-5.0, 5.0, 2.7083, -2.7083, .01, 50);
    camera.position.set(0, 3.2, 8); camera.lookAt(0, .85, 0);
    const heading = document.createElement('div');
    heading.style.cssText = 'position:absolute;top:36px;left:50px;color:#244a43;font:700 14px system-ui;letter-spacing:4px';
    document.body.appendChild(heading);
    const title = document.createElement('div');
    title.style.cssText = 'position:absolute;top:66px;left:50px;color:#203b35;font:700 34px system-ui'; document.body.appendChild(title);
    const labels = document.createElement('div'); labels.style.cssText = 'position:absolute;left:40px;right:40px;bottom:92px;display:flex;justify-content:space-around;font:600 15px system-ui;color:#52655c'; document.body.appendChild(labels);
    const characters = [];
    const renderRow = (customer = false) => {
      for (const c of characters) c.dispose(); characters.length = 0;
      const roles = customer ? Array(8).fill('customer') : ['player', 'waiter', 'cashier', 'barista', 'busser'];
      heading.textContent = 'KAFE CADDESİ / KARAKTERLER';
      title.textContent = customer ? 'Sokağın müdavimleri' : 'Kafenin ekibi';
      labels.innerHTML = '';
      roles.forEach((role, i) => {
        const c = cast.createCharacter(role, { seed: customer ? 100 + i : 417, level: 0 });
        c.root.position.x = (i - (roles.length - 1) / 2) * (customer ? 1.13 : 1.86);
        c.root.rotation.y = -.16; scene.add(c.root); characters.push(c);
        for (let frame = 0; frame < 45; frame++) c.update(1 / 60, 0);
        const label = document.createElement('span'); label.textContent = customer ? '0' + (i + 1) : ['OYUNCU', 'GARSON', 'KASİYER', 'BARİSTA', 'KOMİ'][i]; labels.appendChild(label);
      });
      renderer.render(scene, camera);
      return characters.map(c => {
        let skins = 0, vertices = 0, meshes = 0;
        c.root.traverse(o => { if (o.isSkinnedMesh) skins++; if (o.isMesh) { meshes++; vertices += o.geometry.attributes.position.count; } });
        return { data: c.root.userData, skins, meshes, vertices };
      });
    };
    window.__styleStudio = { T, cast, scene, camera, renderer, characters, renderRow };
    const staff = renderRow(false);
    const player = characters[0]; player.root.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(player.root.matrixWorld).invert(), joints = {};
    for (const name of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End']) {
      const bone = player.root.getObjectByName('mixamorig' + name);
      if (bone) joints[name] = bone.getWorldPosition(new T.Vector3()).applyMatrix4(inv).toArray();
    }
    return { phase, staff, joints };
  }, phase);
  await page.screenshot({ path: `${output}/${phase}-staff.png` });
  report.customers = await page.evaluate(() => window.__styleStudio.renderRow(true));
  await page.screenshot({ path: `${output}/${phase}-customers.png` });
  report.animation = await page.evaluate(() => {
    const { cast, scene } = window.__styleStudio, checks = [];
    for (const role of ['player', 'waiter', 'cashier', 'barista', 'busser', 'customer', 'dasher']) {
      const c = cast.createCharacter(role, { seed: 418 }); scene.add(c.root);
      for (const state of ['idle', 'walk', 'work', 'sit', 'cheer', 'angry', 'carry', 'push']) {
        c.setState(['carry', 'push'].includes(state) ? 'walk' : state); c.setWorkKind('wipe'); c.setWorkPhase(.6);
        c.setCarryCount(state === 'carry' ? 3 : 0); c.setCarryMode('tray'); c.setPush(state === 'push', state === 'push');
        for (let f = 0; f < 30; f++) c.update(1 / 30, ['walk', 'carry', 'push'].includes(state) ? 4 : 0);
        c.root.updateMatrixWorld(true); let finite = true;
        c.root.traverse(o => {
          if (!o.matrixWorld.elements.every(Number.isFinite)) finite = false;
          if (o.isSkinnedMesh) {
            o.skeleton.update(); o.computeBoundingBox();
            if (![...o.boundingBox.min.toArray(), ...o.boundingBox.max.toArray()].every(Number.isFinite)) finite = false;
          }
        });
        checks.push({ role, state, finite });
      }
      c.dispose(); c.dispose();
    }
    return checks;
  });
  report.sharing = await page.evaluate(() => {
    const { cast } = window.__styleStudio, copies = [];
    for (const role of ['player', 'waiter', 'customer']) {
      const a = cast.createCharacter(role, { seed: 417 }), b = cast.createCharacter(role, { seed: 417 });
      let sa, sb; a.root.traverse(o => { if (o.isSkinnedMesh) sa = o; }); b.root.traverse(o => { if (o.isSkinnedMesh) sb = o; });
      copies.push({ role, geometry: sa.geometry === sb.geometry, material: sa.material === sb.material,
        ownSkeleton: sa.skeleton !== sb.skeleton });
      a.dispose(); b.update(1 / 30, 1); b.dispose();
    }
    return copies;
  });
  report.errors = errors;
  await writeFile(`${output}/${phase}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []); assert.ok(report.animation.every(c => c.finite));
  assert.ok([...report.staff, ...report.customers].every(c => c.skins === 1));
  assert.ok(report.sharing.every(c => c.geometry && c.material && c.ownSkeleton));
} finally { await browser?.close(); await server.close(); }
