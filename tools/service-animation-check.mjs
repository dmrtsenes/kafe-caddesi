import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = '.devshots/service-tray';
await mkdir(output, { recursive: true });
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: 5259, strictPort: true, open: false, hmr: false, watch: null } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 780 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5259/');
  await page.waitForFunction(() => !!window.__fincan);
  await page.locator('#boot-screen').waitFor({ state: 'detached' });
  const report = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const [{ Player }, { NavGrid }, { Customer }, { Order }, { CUSTOMER_ARCHETYPES }] = await Promise.all([
      import('/src/entities/Player.ts'), import('/src/sim/Navigation.ts'), import('/src/entities/Customer.ts'),
      import('/src/sim/Orders.ts'), import('/src/data/customers.ts'),
    ]);
    const g = window.__fincan; g.stop(); g.ui.setTutorial(null); g.ui.closePanels();
    const none = { x: 0, y: 0, active: false, mag: 0 }, input = { x: 1, y: 0, active: true, mag: 1 };
    const bounds = { x0: -100, x1: 100, z0: -100, z1: 100 }, nav = new NavGrid(bounds);
    const checks = [], flows = [];
    const palm = (c, side) => {
      const wrist = c.root.getObjectByName('mixamorig' + side + 'Hand');
      const knuckle = c.root.getObjectByName('mixamorig' + side + 'HandIndex1');
      c.root.updateMatrixWorld(true);
      return c.root.worldToLocal(new T.Vector3(0, knuckle.position.y * .8, .004).applyMatrix4(wrist.matrixWorld));
    };
    for (const fps of [30, 60, 120]) for (const level of [0, 4]) {
      const p = new Player(); p.setCarrierLevel(level); p.setCapacity(level ? 6 : 3);
      for (let i = 0; i < (level ? 6 : 3); i++) p.give(['cay', 'latte', 'tost'][i % 3]);
      let maxPalmError = 0, blockedWhileMoving = true, worst;
      for (let i = 0; i < fps * 3; i++) {
        p.update(1 / fps, input, nav, bounds);
        if (i > fps) {
          for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
            const point = palm(p.char, side), desired = new T.Vector3(sign * p.char.height * .145, p.char.height * .54, p.char.height * .19);
            const error = point.distanceTo(desired);
            if (error > maxPalmError) {
              maxPalmError = error;
              const nodes = ['Arm', 'ForeArm', 'Hand'].map(n => p.char.root.worldToLocal(p.char.root.getObjectByName('mixamorig' + side + n).getWorldPosition(new T.Vector3())));
              worst = { side, point: point.toArray(), desired: desired.toArray(), shoulder: nodes[0].toArray(), reach: nodes[0].distanceTo(nodes[1]) + nodes[1].distanceTo(nodes[2]) };
            }
          }
          if (p.tryHandContact('moving', 'reach', 1 / fps, .1)) blockedWhileMoving = false;
        }
      }
      for (let i = 0; i < fps; i++) p.update(1 / fps, none, nav, bounds);
      p.char.setState('work'); p.char.setWorkKind('reach'); p.char.setWorkPhase(0);
      for (let i = 0; i < fps; i++) p.char.update(1 / fps, 0);
      const foot = () => {
        p.char.root.updateMatrixWorld(true);
        return ['LeftFoot', 'RightFoot'].map(n => p.char.root.worldToLocal(p.char.root.getObjectByName('mixamorig' + n).getWorldPosition(new T.Vector3())));
      };
      const initial = foot(), support = p.char.carryAnchor.position.clone();
      let maxFootDrift = 0, maxTrayDrift = 0;
      for (let i = 0; i <= 60; i++) {
        p.char.setWorkPhase(i / 60); p.char.update(1 / fps, 0);
        foot().forEach((v, j) => { maxFootDrift = Math.max(maxFootDrift, v.distanceTo(initial[j])); });
        maxTrayDrift = Math.max(maxTrayDrift, p.char.carryAnchor.position.distanceTo(support));
      }
      const rigidProducts = p.stack.root.children.filter(o => o.name === 'carriedProduct').every(o => o.rotation.x === 0 && o.rotation.z === 0);
      checks.push({ fps, level, maxPalmError, worst, maxFootDrift, maxTrayDrift, blockedWhileMoving, rigidProducts, clip: p.char.baseAction.getClip().name });
      p.dispose();
    }
    const w = g.world, p = g.player;
    w.vfx = null;
    for (const c of w.customers) c.dispose(); w.customers.length = 0;
    for (const st of w.stations) { st.dishes = st.soil = st.cash = 0; }
    const machine = w.machines.find(st => !st.locked && st.def.item === 'cay');
    const shelf = w.pickups.find(st => !st.def.item || st.def.item === 'cay');
    const table = w.tables.find(st => !st.locked), counter = w.counters[0];
    for (const fps of [30, 60, 120]) for (const mode of ['take', 'shelf', 'table']) {
      const target = mode === 'take' ? machine : mode === 'shelf' ? shelf : table;
      for (const st of w.stations) st.locked = st !== target;
      target.locked = false; target.output = mode === 'take' ? 3 : 0; target.contents.length = 0;
      table.seatedGuests.length = 0; table.seatTaken.fill(false);
      p.dropAll(); p.setCapacity(3); p.setCarrierLevel(0); p.noTakeFrom = p.noDropTo = null;
      p.hasVacuum = false; p.vx = p.vz = p.planarSpeed = 0; p.handAction.reset(); w.armT = 0; w.armKey = null;
      let guest;
      if (mode === 'table') {
        guest = new Customer(CUSTOMER_ARCHETYPES[0], 'service-pose-' + fps);
        guest.dineIn = true; guest.table = table; guest.counter = counter; guest.state = 'seated';
        guest.order = new Order([{ item: 'cay', qty: 3, served: 0 }]); guest.patience = guest.maxPatience = 999;
        table.takeSeat(0); guest.seatIndex = 0; table.seatedGuests.push(guest); w.customers.push(guest); w.quoteOrder(guest);
      }
      if (mode !== 'take') for (let i = 0; i < 3; i++) p.give('cay');
      const spot = { x: 0, z: 0 }; target.servicePoint(spot);
      const candidates = [spot];
      for (const radius of [1.4, 1.6, 1.8, 2, 2.2]) for (let i = 0; i < 24; i++) candidates.push({ x: target.x + Math.sin(i * Math.PI / 12) * radius, z: target.z + Math.cos(i * Math.PI / 12) * radius });
      const position = candidates.find(pt => !w.nav.solidBlocked(pt.x, pt.z, .34) &&
        (mode !== 'shelf' || target.sideOf(pt.x, pt.z) < 0) && w.playerAccess(target, pt.x, pt.z, 1.3, {}, mode === 'take'));
      if (!position) throw new Error('No service point: ' + mode);
      p.setPosition(position.x, position.z); p.faceTowards(target.x, target.z, 1, 100);
      let contacts = 0, runningContacts = 0;
      for (let i = 0; i < fps * 5; i++) {
        p.update(1 / fps, none, w.nav, w.loc.bounds);
        const before = p.carryCount;
        w.updateStationInteraction(1 / fps, p);
        if (before !== p.carryCount) {
          contacts++;
          if (p.char.baseAction.getClip().name !== 'Service_Standing') runningContacts++;
        }
        if (mode === 'take' ? p.carryCount === 3 : p.carryCount === 0) break;
      }
      flows.push({ fps, mode, contacts, runningContacts, held: p.carryCount,
        delivered: mode === 'shelf' ? target.output : guest?.order.servedQty });
      if (guest) { table.seatedGuests.length = 0; w.customers.splice(w.customers.indexOf(guest), 1); guest.dispose(); }
    }
    // A close view of one real player at contact, with a tray kept level.
    const demo = new Player(); demo.setPosition(0, 0); demo.give('latte'); demo.give('tost');
    demo.char.setState('work'); demo.char.setWorkKind('reach'); demo.char.setWorkPhase(.48);
    for (let i = 0; i < 90; i++) demo.char.update(1 / 60, 0);
    const scene = new T.Scene(); scene.background = new T.Color('#eee5d5');
    scene.add(new T.HemisphereLight(0xffffff, 0xb5a286, 2.5));
    const sun = new T.DirectionalLight(0xffffff, 2.5); sun.position.set(-3, 5, 4); scene.add(sun, demo.char.root);
    const camera = new T.PerspectiveCamera(33, 1100 / 780, .01, 30); camera.layers.enableAll();
    camera.position.set(2.6, 2.9, 4); camera.lookAt(0, .8, .2);
    document.body.innerHTML = ''; const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setSize(1100, 780); document.body.appendChild(renderer.domElement);
    renderer.render(scene, camera); window.__serviceDemo = { demo, renderer, scene, camera };
    return { checks, flows };
  });
  await page.screenshot({ path: `${output}/serving-contact.png` });
  await writeFile(`${output}/animation.json`, JSON.stringify({ ...report, errors }, null, 2));
  console.log(JSON.stringify({ contacts: report.flows.reduce((n, f) => n + f.contacts, 0),
    runningContacts: report.flows.reduce((n, f) => n + f.runningContacts, 0),
    maxPalmError: Math.max(...report.checks.map(c => c.maxPalmError)),
    maxFootDrift: Math.max(...report.checks.map(c => c.maxFootDrift)),
    maxTrayDrift: Math.max(...report.checks.map(c => c.maxTrayDrift)), errors }));
  assert.deepEqual(errors, []);
  assert.ok(report.checks.every(c => c.maxPalmError < .025 && c.maxFootDrift < .002 && c.maxTrayDrift < .002 && c.blockedWhileMoving && c.rigidProducts));
  assert.ok(report.flows.every(f => f.contacts === 3 && f.runningContacts === 0));
} finally { await browser?.close(); await server.close(); }
