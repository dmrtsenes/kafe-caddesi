/** UA performance-ad film. The shipped World, map, cast, interactions and
 * renderer are driven scene by scene; motion graphics are composited in 2D.
 * This entry never imports Game, Settings or SaveManager, and keeps any
 * storage access inside an in-memory shim so a preview cannot touch saves.
 */
import { installCanvasCompat } from '../core/CanvasCompat';
import { COPY, type AdLang } from './copy';
import * as O from './overlay';

const W = O.W, H = O.H, FPS = 30, DURATION = 30;
const params = new URLSearchParams(location.search);
const LANG: AdLang = params.get('lang') === 'en' ? 'en' : 'tr';
const copy = COPY[LANG];
const manual = params.has('capture');

// Film-only storage: the game's language module reads/writes localStorage at import.
{
  const memory = new Map<string, string>([['fincan-sokagi:language:v1', LANG]]);
  Storage.prototype.getItem = function (k: string) { return memory.has(k) ? memory.get(k)! : null; };
  Storage.prototype.setItem = function (k: string, v: string) { memory.set(k, String(v)); };
  Storage.prototype.removeItem = function (k: string) { memory.delete(k); };
  Storage.prototype.clear = function () { memory.clear(); };
}
let randomSeed = 20261022;
Math.random = () => ((randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0) / 4294967296);
installCanvasCompat();

/** Scene table. Every cut sits on the 120 BPM beat grid (0.5 s). */
const SCENES = [
  { id: 'hook', start: 0, end: 3, speed: 1 },
  { id: 'clean', start: 3, end: 8, speed: 1 },
  { id: 'serve', start: 8, end: 14, speed: 1.5 },
  { id: 'cash', start: 14, end: 15.5, speed: 1.5 },
  { id: 'upgrade', start: 15.5, end: 18, speed: 1 },
  { id: 'expand', start: 18, end: 20.5, speed: 1.5 },
  { id: 'staff', start: 20.5, end: 23, speed: 2 },
  { id: 'after', start: 23, end: 26, speed: 1 },
  { id: 'end', start: 26, end: 30, speed: 1 },
] as const;
type SceneId = typeof SCENES[number]['id'];

async function boot() {
  const [T, { Scene3D }, { World }, { GameState }, { Player }, { Customer }, { Order },
    { CUSTOMER_ARCHETYPES }, { createVFX }, { markDynamic }, { loadPacks }, { loadCharacterPack },
    { bus }, { BALANCE }, { applyTier }, { ITEMS }, { playerSpeed }] = await Promise.all([
    import('three'), import('../world/Scene3D'), import('../sim/World'), import('../sim/GameState'),
    import('../entities/Player'), import('../entities/Customer'), import('../sim/Orders'),
    import('../data/customers'), import('../world/VFX'), import('../world/layers'),
    import('../world/packs/library'), import('../chars'), import('../core/EventBus'),
    import('../data/balance'), import('../core/Quality'), import('../data/items'), import('../data/upgrades'),
  ]);
  type ItemId = keyof typeof ITEMS;
  applyTier('high');
  await Promise.all([loadPacks(), loadCharacterPack()]);
  await Promise.all([document.fonts.load('60px Paytone'), document.fonts.load('700 36px Barlow')]);
  await document.fonts.ready;
  const assets = await O.loadAssets(copy);

  const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
  const film = document.querySelector<HTMLCanvasElement>('#film')!;
  const ctx = film.getContext('2d', { alpha: false })!;
  const before = document.createElement('canvas'); before.width = W; before.height = H;
  const scene = new Scene3D(canvas, 'high', false);
  scene.hideSurfaceLabels = true;
  const sizeRenderer = () => {
    scene.renderer.setPixelRatio(1);
    scene.renderer.setSize(W, H, false);
    scene.camera.aspect = W / H;
    scene.camera.clearViewOffset();
    scene.camera.updateProjectionMatrix();
  };
  sizeRenderer();
  window.addEventListener('resize', () => setTimeout(sizeRenderer, 0));

  /* ------------------------------------------------------------ world fixture */
  const state = new GameState();
  state.tutorialStep = 99;
  state.money = 0;
  state.upgrades.speed = 4;
  state.upgrades.hands = 6;
  state.upgrades.capacity = 0;
  state.stats.orders = 12;
  for (const zone of ['a1', 't1', 'a3', 't2', 'a4', 't3', 'a5', 't4', 'a6', 't5'])
    state.unlockedZones.add('kose:' + zone);
  (BALANCE.dirt as { maxSpills: number }).maxSpills = 24;
  const vfx = createVFX();
  markDynamic(vfx.root);
  scene.scene.add(vfx.root);
  const world = new World('kose', state, vfx);
  world.setActive(true);
  scene.scene.add(world.root);
  scene.applyPalette(world.loc.palette);
  const b = world.loc.bounds;
  scene.setVenueCenter((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
  const player = new Player();
  const applyPlayer = () => {
    player.speed = state.playerSpeed;
    player.setCapacity(state.playerCapacity);
    player.setCarrierLevel(state.upgrades.capacity);
    player.setLocomotionLevel(state.upgrades.speed);
    player.setUpgradeMilestones(state.upgrades.speed, state.upgrades.hands, state.upgrades.charm);
  };
  applyPlayer();
  markDynamic(player.char.root);
  scene.scene.add(player.char.root);

  type Station = NonNullable<ReturnType<typeof world.byId.get>>;
  type Guest = InstanceType<typeof Customer>;
  const st = (id: string) => { const s = world.byId.get(id); if (!s) throw new Error('station ' + id); return s; };
  const counter = st('k_tezgah_1');
  const fixture = world as unknown as {
    quoteOrder(c: Guest): void; startEating(c: Guest): void; makeAngry(c: Guest, r: string, penalty?: boolean): void;
    guide: { root: import('three').Object3D } | null; padProgress: Map<string, number>;
  };
  const frontTables = ['k_masa_1', 'k_masa_2', 'k_masa_3', 'k_masa_4', 'k_masa_5', 'k_masa_6'].map(st);
  const point = (s: Station) => { const p = { x: 0, z: 0 }; s.servicePoint(p); return p; };
  const mods = { spawnMult: 0, valueMult: 1, patienceMult: 1, tipMult: 1 };

  let guestSeq = 0;
  function seat(t: Station, seatIndex: number, items: ItemId[], served = false): Guest {
    const c = new Customer(CUSTOMER_ARCHETYPES[guestSeq % CUSTOMER_ARCHETYPES.length], 'ua-guest-' + guestSeq++);
    c.table = t; c.counter = counter; c.dineIn = true;
    c.serviceCode = t.def.serviceCode ?? '';
    const lines = new Map<ItemId, number>();
    for (const it of items) lines.set(it, (lines.get(it) ?? 0) + 1);
    c.order = new Order([...lines].map(([item, qty]) => ({ item, qty, served: 0 })));
    c.patience = c.maxPatience = 90;
    t.takeSeat(seatIndex); c.seatIndex = seatIndex; t.seatedGuests.push(c);
    markDynamic(c.char.root);
    world.customers.push(c); world.root.add(c.char.root);
    const p = { x: 0, y: 0, z: 0 }; world.seatPoint(t, seatIndex, p);
    c.setPosition(p.x, p.z); world.sitOnChair(c, t); c.state = 'seated';
    fixture.quoteOrder(c);
    c.showItem(items[0], lines.get(items[0]));
    c.showBubble(true);
    if (served) { for (const it of items) c.receiveItem(it); fixture.startEating(c); }
    for (let n = 0; n < 30; n++) c.step(1 / 60, world.nav);
    return c;
  }
  function clearGuests(): void {
    for (const c of world.customers) c.done = true;
    world.update(0, null, mods);
    for (const t of world.stations) if (t.def.kind === 'table') {
      t.seatedGuests.length = 0; t.seatTaken.fill(false); t.occupied = false; t.dishes = 0; t.soil = 0;
    }
    for (const co of world.counters) co.queue.length = 0;
  }
  function cleanFloor(): void { world.spills.clear(); world.grime.clear(); }
  function fillTables(tables: Station[], menu: ItemId[]): void {
    let k = 0;
    for (const t of tables) {
      if (t.locked) continue;
      const n = Math.min(t.seats, 1 + (k % 3 === 0 ? t.seats : 2));
      for (let i = 0; i < n; i++) seat(t, i, [menu[(k + i) % menu.length]], true);
      k++;
    }
  }

  /* ------------------------------------------------------------ timeline log */
  const cues: Array<{ time: number; kind: string; [k: string]: unknown }> = [];
  const events: Array<{ time: number; kind: string; data?: unknown }> = [];
  let frame = 0, time = 0;
  const cue = (kind: string, extra: Record<string, unknown> = {}, at = time) => cues.push({ time: +at.toFixed(3), kind, ...extra });
  const log = (kind: string, data?: unknown) => events.push({ time: +time.toFixed(3), kind, data });

  /* ------------------------------------------------------------ input */
  const move = { x: 0, y: 0, mag: 0, active: false }, yaw = BALANCE.camera.yaw * Math.PI / 180;
  let path: number[] = [], waypoint = 0, routeKey = '';
  function routeTo(key: string, pts: Array<[number, number]>): void {
    if (routeKey === key) return;
    const next: number[] = [];
    let fx = player.x, fz = player.z;
    for (const [x0, z0] of pts) {
      const goal = { x: x0, z: z0 };
      world.nav.resolve(goal, 0.36);
      const seg: number[] = [];
      if (!world.nav.findPath(fx, fz, goal.x, goal.z, seg)) continue;
      if (!seg.length) seg.push(goal.x, goal.z);
      next.push(...seg); fx = goal.x; fz = goal.z;
    }
    if (!next.length) return;
    routeKey = key; path = next; waypoint = 0;
  }
  function stopMoving(): void { routeKey = ''; path = []; waypoint = 0; }
  function steer(): void {
    move.x = move.y = move.mag = 0; move.active = false;
    if (waypoint >= path.length / 2) return;
    let dx = path[waypoint * 2] - player.x, dz = path[waypoint * 2 + 1] - player.z, d = Math.hypot(dx, dz);
    if (d < (waypoint === path.length / 2 - 1 ? 0.1 : 0.25)) waypoint++;
    if (waypoint >= path.length / 2) return;
    dx = path[waypoint * 2] - player.x; dz = path[waypoint * 2 + 1] - player.z; d = Math.hypot(dx, dz);
    move.x = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
    move.y = -Math.sin(yaw) * dx - Math.cos(yaw) * dz;
    move.mag = Math.min(1, d * 3); move.active = true;
  }
  const arrived = () => waypoint >= path.length / 2;

  /* ------------------------------------------------------------ camera */
  const focus = new T.Vector3(), goal = new T.Vector3();
  let dist = 18, pitch = 54, fov = 38, az = 8;
  function placeCamera(fx: number, fz: number, d: number, p: number, f: number, a = 8): void {
    if (Math.abs(scene.camera.fov - f) > 1e-3) { scene.camera.fov = f; scene.camera.updateProjectionMatrix(); }
    const pr = p * Math.PI / 180, ar = a * Math.PI / 180;
    scene.camera.near = Math.max(0.3, d * 0.2);
    scene.camera.far = 200;
    scene.camera.updateProjectionMatrix();
    scene.camera.position.set(fx + Math.sin(ar) * Math.cos(pr) * d, Math.sin(pr) * d, fz + Math.cos(ar) * Math.cos(pr) * d);
    scene.camera.lookAt(fx, 0.4, fz);
    scene.camera.updateMatrixWorld();
    scene.setFocus(fx, fz, 0, player.x, player.z);
    world.focusX = fx; world.focusZ = fz;
    world.setViewFromCamera(scene.camera); world.setCameraQuat(scene.camera.quaternion);
  }
  /** Shared framing for the before/after split; both halves come from this camera. */
  const BA = { x: 3.2, z: 8.2, d: 25, p: 56, f: 56 };
  const v3 = new T.Vector3();
  function project(x: number, y: number, z: number): { x: number; y: number; ok: boolean } {
    v3.set(x, y, z).project(scene.camera);
    return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H, ok: v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 };
  }
  function headOf(o: { char: { headTop: import('three').Object3D } }) {
    o.char.headTop.getWorldPosition(v3);
    return project(v3.x, v3.y + 0.35, v3.z);
  }

  /* ------------------------------------------------------------ scene state */
  let sceneIdx = -1, sceneAt = 0;
  let cleanSpills: Array<{ id: number; cells: number }> = [];
  let cleanTotal = 1, cleanDoneAt = -1, vacuumFrom = -1;
  let combo = 0;
  const pops: Array<{ t: number; kind: 'heart' | 'combo' | 'float' | 'star' | 'angry'; x: number; y: number; text?: string; ref?: Guest }> = [];
  const flyers: O.Flyer[] = [];
  const flyerPay: Array<{ at: number; amount: number; done: boolean }> = [];
  let hudShown = 0, hudBumpAt = -10, hudVisible = false;
  const upgrade = { speed: 4, tray: 4, speedAt: -10, trayAt: -10 };
  let unlockAt = -1, confetti: O.Confetti[] = [], confettiAt = -10;
  const hires: Array<{ t: number; role: 'waiter' | 'cashier' | 'busser' | 'barista'; done: boolean }> = [];
  const r1 = world.loc.zones.find((z) => z.id === 'r1')!;
  let angryGuests: Guest[] = [];

  const sceneOf = (t: number) => SCENES.findIndex((s) => t >= s.start && t < s.end);
  const cur = () => SCENES[Math.max(0, sceneIdx)];

  bus.on('render:structure', () => { scene.invalidateStatic(); scene.invalidateShadows(); });
  bus.on('item:served', (e) => {
    log('served', e);
    if (cur().id !== 'serve') return;
    combo++;
    const guest = world.customers.find((c) => c.table && Math.hypot(c.x - e.x, c.z - e.z) < 2.5 && c.order && c.order.servedQty > 0 && !pops.some((p) => p.ref === c && p.kind === 'heart'));
    const anchor = guest ? headOf(guest) : project(e.x, 1.6, e.z);
    pops.push({ t: time, kind: 'heart', x: anchor.x, y: anchor.y, ref: guest });
    const ph = headOf(player);
    if (combo >= 2) { pops.push({ t: time, kind: 'combo', x: ph.x + 150, y: ph.y - 60, text: `x${combo}` }); cue('combo', { level: combo }); }
    const value = ITEMS[e.item].price;
    pops.push({ t: time, kind: 'float', x: anchor.x, y: anchor.y - 40, text: '+' + value });
    flyers.push({ t0: time + 0.05, x0: anchor.x, y0: anchor.y, x1: HUD.x - 120, y1: HUD.y, dur: 0.6, spin: combo });
    flyerPay.push({ at: time + 0.65, amount: value, done: false });
    cue('pop', { pitch: combo });
  });
  bus.on('counter:collected', (e) => {
    log('collected', e);
    const p = project(counter.x, 1.4, counter.z);
    for (let i = 0; i < 3; i++) flyers.push({ t0: time + i * 0.05, x0: p.x + (i - 1) * 40, y0: p.y, x1: HUD.x - 120, y1: HUD.y, dur: 0.55, spin: i });
    cue('coin', { pan: 0.2 }, time + 0.5);
    hudBumpAt = time + 0.55;
  });
  bus.on('zone:unlocked', (e) => {
    log('unlocked', e);
    if (e.zone !== 'r1') return;
    unlockAt = time; confetti = O.makeConfetti(90, W / 2, H * 0.55, 77); confettiAt = time;
    cue('unlock'); cue('stamp', {}, time + 0.05);
  });
  bus.on('money:spend', () => { hudBumpAt = time; });

  const HUD = { x: 540, y: 590 };

  /* ------------------------------------------------------------ preparation (before frame 0) */
  // Chaos fixture: every front table holds dirty dishes, the floor is grimy and spilled,
  // and customers have been queuing without service.
  for (const t of frontTables) { t.dishes = 2 + (t.seats > 2 ? 1 : 0); t.soil = t.cleanStartSoil = 1; t.cleanValue = 2; }
  for (let gx = b.x0; gx < b.x1; gx += 0.6) for (let gz = -3.5; gz < 9.5; gz += 0.6) {
    const n = Math.sin(gx * 1.7 + gz * 0.9) * 0.5 + Math.sin(gx * 0.6 - gz * 1.3) * 0.5;
    world.grime.addTraffic(gx, gz, 150 + 100 * Math.max(0, n));
  }
  const hookSpills: Array<[number, number, 'liquid' | 'crumbs' | 'toz']> = [
    [-2.6, 0.4, 'liquid'], [2.4, 0.2, 'crumbs'], [-6.6, 4.0, 'toz'], [-2.4, 4.3, 'liquid'], [2.6, 4.0, 'crumbs'],
    [7.2, 4.4, 'liquid'], [-2.8, 7.9, 'crumbs'], [2.9, 8.0, 'liquid'], [-7.4, 8.4, 'toz'], [0.4, -1.6, 'liquid'],
    [6.8, 0.6, 'toz'], [-0.2, 9.4, 'liquid'],
  ];
  for (const [x, z, k] of hookSpills) { const s = world.spills.spawn(x, z, k); if (s) s.grow = 1; }
  // Natural demand with impatient guests for a few seconds of simulation: the counter
  // queue forms and guests who cannot be seated at dirty tables lose patience.
  player.setPosition(-2.4, 6.4); player.angle = 0;
  const hookMenu: ItemId[] = ['cay', 'latte', 'tost', 'cay', 'latte', 'tost'];
  frontTables.forEach((t, i) => {
    seat(t, 0, [hookMenu[i % hookMenu.length]]);
    if (t.seats > 2) seat(t, 1, [hookMenu[(i + 2) % hookMenu.length]]);
  });
  mods.spawnMult = 5; mods.patienceMult = 3;
  for (let i = 0; i < 5; i++) world.spawnCustomer('normal');
  for (let n = 0; n < 60 * 5; n++) {
    world.update(1 / 60, null, mods);
    player.update(1 / 60, move, world.nav, world.loc.bounds);
  }
  mods.spawnMult = 0; mods.patienceMult = 1;

  /* ------------------------------------------------------------ cuts */
  function enter(i: number): void {
    const id = SCENES[i].id as SceneId;
    if (sceneIdx === 0) snapshotBefore();
    sceneIdx = i; sceneAt = time; stopMoving();
    player.noTakeFrom = player.noDropTo = null;
    log('cut', { scene: id });
    if (i > 0) { cue('whoosh', {}, time - 0.02); cue('impact', { gain: 0.45 }); }
    if (id === 'hook') {
      cue('alarm', { count: 4 }, 0.12); cue('grumble', { dur: 2.6 }, 0.2); cue('stamp', {}, 0.12);
      angryGuests = world.customers.filter((c) => !c.done).slice(0, 7);
    }
    if (id === 'clean') {
      clearGuests(); cleanFloor();
      // A grimy, spilled walkway between the two table rows.
      for (let gx = -7.4; gx < 6.4; gx += 0.3) for (const gz of [3.7, 4.1, 4.5]) world.grime.addTraffic(gx, gz, 240);
      for (let gx = -8; gx < 8; gx += 0.6) for (let gz = 0.5; gz < 8; gz += 0.6) world.grime.addTraffic(gx, gz, 60 + 50 * Math.abs(Math.sin(gx * 2.1 + gz)));
      cleanSpills = [];
      for (const [x, k] of [[-4.6, 'liquid'], [-1.7, 'crumbs'], [1.2, 'liquid'], [4.0, 'crumbs']] as const) {
        const s = world.spills.spawn(x, 4.1 + (x > 0 ? 0.1 : -0.1), k); if (s) { s.grow = 1; cleanSpills.push({ id: s.id, cells: s.cellsTotal }); }
      }
      cleanTotal = cleanSpills.reduce((a, s) => a + s.cells, 0);
      for (const t of frontTables) { t.dishes = 0; t.soil = 0; }
      player.setPosition(-7.0, 4.1); player.angle = Math.PI / 2;
      player.dropAll();
      if (!player.hasVacuum) world.toggleVacuum(player);
      player.speed = 2.7;
      vacuumFrom = time + 0.05;
    }
    if (id === 'serve') {
      if (player.hasVacuum) world.toggleVacuum(player);
      if (vacuumFrom >= 0) { cue('vacuum', { dur: Math.max(0.5, time - vacuumFrom - 0.05) }, vacuumFrom); vacuumFrom = -1; }
      clearGuests(); cleanFloor();
      state.money = 1250; hudShown = state.money; hudVisible = true;
      state.upgrades.capacity = 4; applyPlayer();
      player.dropAll();
      for (const it of ['cay', 'latte', 'tost', 'cay', 'latte', 'cay'] as ItemId[]) player.give(it);
      seat(st('k_masa_2'), 0, ['cay']); seat(st('k_masa_2'), 1, ['latte']);
      seat(st('k_masa_3'), 0, ['tost']); seat(st('k_masa_3'), 2, ['cay']);
      seat(st('k_masa_6'), 1, ['latte']); seat(st('k_masa_6'), 3, ['cay']);
      seat(st('k_masa_1'), 0, ['cay'], true); seat(st('k_masa_4'), 1, ['latte'], true); seat(st('k_masa_4'), 2, ['tost'], true);
      seat(st('k_masa_5'), 0, ['cay'], true);
      player.setPosition(-3.4, 4.0); player.angle = Math.PI / 2;
      combo = 0;
    }
    if (id === 'cash') {
      clearGuests();
      seat(st('k_masa_1'), 0, ['cay'], true); seat(st('k_masa_2'), 1, ['latte'], true); seat(st('k_masa_3'), 0, ['tost'], true);
      counter.cash = 200; counter.cashValue = 2400;
      const p = point(counter); player.setPosition(p.x - 0.8, p.z + 0.2); player.angle = Math.PI;
      player.dropAll();
    }
    if (id === 'upgrade') {
      state.upgrades.capacity = 4; applyPlayer(); player.speed = playerSpeed(4);
      player.dropAll();
      for (const it of ['cay', 'latte', 'tost', 'cay', 'latte', 'tost'] as ItemId[]) player.give(it);
      player.setPosition(-4.6, 4.1); player.angle = Math.PI / 2;
      upgrade.speed = 4; upgrade.tray = 4;
    }
    if (id === 'expand') {
      clearGuests();
      state.money = 15200; hudShown = state.money;
      state.upgrades.capacity = 12; state.upgrades.speed = 7; applyPlayer();
      player.dropAll();
      player.setPosition(r1.padX, r1.padZ); player.angle = 0;
      fixture.padProgress.set('r1', 0);
      fillTables(frontTables.slice(3), ['cay', 'latte', 'tost']);
    }
    if (id === 'staff') {
      hudVisible = false;
      for (const z of ['a7', 'a8', 't6', 't7']) world.unlockZone(z, 'menu');
      clearGuests();
      fillTables(world.stations.filter((s) => s.def.kind === 'table'), ['cay', 'latte', 'tost', 'waffle', 'frappe']);
      mods.spawnMult = 5; mods.patienceMult = 4;
      for (let n = 0; n < 4; n++) world.spawnCustomer('normal');
      for (const [k, role] of (['waiter', 'cashier', 'waiter', 'barista'] as const).entries()) hires.push({ t: time + 0.25 + k * 0.42, role, done: false });
      player.setPosition(-1.2, -2.6); player.angle = 0;
      for (const it of ['cay', 'latte', 'tost', 'waffle', 'frappe', 'cay', 'latte', 'tost', 'waffle', 'frappe', 'cay', 'latte'] as ItemId[]) player.give(it);
    }
    if (id === 'after') {
      for (const h of hires) if (!h.done) runHire(h);
      clearGuests();
      fillTables(world.stations.filter((s) => s.def.kind === 'table'), ['cay', 'latte', 'tost', 'waffle', 'frappe']);
      mods.spawnMult = 3;
      for (let n = 0; n < 3; n++) world.spawnCustomer('normal');
      player.setPosition(-3.0, 4.1); player.angle = Math.PI / 2;
    }
    if (id === 'end') cue('impact', { gain: 0.8 });
    camera(true);
  }

  function runHire(h: typeof hires[number]): void {
    h.done = true;
    const counts = state.staffCountAt('kose');
    counts[h.role]++;
    const existing = new Set(world.staff);
    world.syncStaff();
    for (const s of world.staff) if (!existing.has(s)) {
      s.char.setState('idle');
      for (let n = 0; n < 30; n++) s.char.update(1 / 60, 0, 0);
      vfx.puff(s.x, 0.4, s.z, 0xffc44a, 3);
      vfx.sparkleBurst(s.x, 1.4, s.z, 8, 0xffe08a);
      pops.push({ t: time, kind: 'star', x: 0, y: 0, ref: s as unknown as Guest });
    }
    cue('hire');
  }

  function snapshotBefore(): void {
    placeCamera(BA.x, BA.z, BA.d, BA.p, BA.f);
    hideClutter(); scene.render();
    before.getContext('2d')!.drawImage(canvas, 0, 0, W, H);
  }

  /* ------------------------------------------------------------ per-tick direction */
  function direct(): void {
    const id = cur().id as SceneId, age = time - sceneAt;
    if (id === 'clean') {
      routeTo('sweep', [[-5.6, 3.95], [-3.6, 4.25], [-1.0, 3.95], [1.6, 4.25], [3.4, 3.95], [5.6, 4.1]]);
      let left = 0;
      for (const s of cleanSpills) { const live = world.spills.byId(s.id); left += live ? live.cellsLeft : 0; }
      if (left === 0 && cleanDoneAt < 0) {
        cleanDoneAt = time; cue('clean'); cue('stamp', {}, time + 0.03); cue('levelup', { gain: 0.6 }, time + 0.1);
        confetti = O.makeConfetti(70, W / 2, H * 0.5, 31); confettiAt = time;
      }
    }
    if (id === 'serve') {
      const order = [st('k_masa_2'), st('k_masa_3'), st('k_masa_6')];
      const next = order.find((t) => world.customers.some((g) => g.table === t && !g.done && g.order && !g.order.complete));
      if (next) { const p = point(next); routeTo('serve:' + next.id, [[p.x, p.z]]); } else stopMoving();
    }
    if (id === 'cash') { const p = point(counter); routeTo('cash', [[p.x, p.z]]); }
    if (id === 'upgrade') {
      if (age > 0.62 && upgrade.trayAt < sceneAt) { upgrade.tray = 6; upgrade.trayAt = time; cue('tap'); cue('button'); cue('pop', { pitch: 2 }); spend(1400); }
      if (age > 1.08 && upgrade.tray < 8) {
        upgrade.tray = 8; upgrade.trayAt = time; cue('tap'); cue('button'); cue('levelup'); spend(2100);
        state.upgrades.capacity = 12; applyPlayer(); player.speed = playerSpeed(4);
        const menu: ItemId[] = ['cay', 'latte', 'tost', 'cay', 'latte', 'tost', 'cay', 'latte', 'tost'];
        for (const it of menu) player.give(it);
        vfx.sparkleBurst(player.x, 1.4, player.z, 14, 0xffe08a); vfx.puff(player.x, 0.5, player.z, 0xffffff, 4);
        const ph = headOf(player); pops.push({ t: time, kind: 'float', x: ph.x, y: ph.y - 30, text: copy.levelUp });
      }
      if (age > 1.55 && upgrade.speed < 7) {
        upgrade.speed = 7; upgrade.speedAt = time; cue('tap'); cue('button'); cue('levelup', { gain: 0.8 }); spend(1600);
        state.upgrades.speed = 7; applyPlayer(); player.speed = playerSpeed(9);
        vfx.sparkleBurst(player.x, 0.4, player.z, 10, 0x9fe9c5);
      }
      if (age > 1.6) routeTo('dash', [[5.6, 4.1]]);
    }
    if (id === 'expand') {
      if (unlockAt < 0) { stopMoving(); }
      else if (time - unlockAt > 0.5) {
        routeTo('enter-room', [[10.4, 13.7], [12.6, 13.8]]);
      }
      if (age > 0.2 && age < 2.2 && unlockAt < 0 && frame % 2 === 0) {
        flyers.push({ t0: time, x0: HUD.x - 120, y0: HUD.y, x1: W / 2 + 10, y1: H * 0.56, dur: 0.38, spin: frame });
        if (frame % 4 === 0) cue('coin', { gain: 0.5 }, time + 0.38);
      }
      if (age > 1.15 && unlockAt < 0) {
        spend(Math.min(state.money, r1.cost));
        world.unlockZone('r1', 'pad');
        scene.invalidateStatic();
        scene.invalidateShadows();
      }
    }
    if (id === 'staff') {
      for (const h of hires) if (!h.done && time >= h.t) runHire(h);
      routeTo('bar-run', [[4.6, -2.4], [6.4, 1.2]]);
    }
    if (id === 'after' || id === 'end') routeTo('stroll', [[3.2, 4.1], [3.4, 8.2], [-2.2, 8.4], [-2.4, 4.1], [3.2, 4.1]]);
    steer();
  }

  function spend(v: number): void { state.money = Math.max(0, state.money - v); hudBumpAt = time; }

  function tick(dt: number): void {
    direct();
    state.playTime += dt;
    player.update(dt, move, world.nav, world.loc.bounds);
    world.setViewFromCamera(scene.camera); world.setCameraQuat(scene.camera.quaternion);
    world.update(dt, cur().id === 'hook' ? null : player, mods);
    vfx.update(dt, scene.camera.quaternion);
  }

  function camera(snap = false): void {
    const id = cur().id as SceneId, age = time - sceneAt, s = SCENES[sceneIdx];
    const k = (age) / (s.end - s.start);
    let fx = 0, fz = 0, d = 16, p = 54, f = 38;
    if (id === 'hook') { fx = 0.4; fz = 3.8 - 0.4 * O.easeInOut(k); d = 16.5 - 1.8 * O.easeInOut(k); p = 54; }
    else if (id === 'clean') { fx = player.x + 1.4; fz = player.z - 0.6; d = 12.2 - 1.0 * k; p = 60; }
    else if (id === 'serve') { fx = player.x + 1.0; fz = player.z - 0.4; d = 14.5; p = 54; }
    else if (id === 'cash') { fx = counter.x - 0.4; fz = counter.z + 0.6; d = 11.8 - 1.2 * k; p = 52; }
    else if (id === 'upgrade') { fx = player.x + 0.8; fz = player.z + 2.6; d = 11.5; p = 50; }
    else if (id === 'expand') {
      const u = unlockAt < 0 ? 0 : O.easeInOut((time - unlockAt) / 1.1);
      fx = O.lerpN(r1.padX + 0.4, 12.6, u); fz = O.lerpN(r1.padZ + 0.8, 13.6, u); d = O.lerpN(12.5, 19.5, u); p = 56;
    }
    else if (id === 'staff') { fx = -0.8; fz = -6.2; d = 19.5 - 1.5 * k; p = 54; }
    else if (id === 'after') { fx = BA.x; fz = BA.z; d = BA.d; p = BA.p; f = BA.f; }
    else { fx = 3.4; fz = 6.0; d = 27 - 2 * k; p = 58; f = 40; }
    goal.set(fx, 0, fz);
    const follow = id === 'clean' || id === 'serve' || id === 'upgrade';
    const kk = snap || !follow ? 1 : 1 - Math.exp(-dtFrame * 6);
    focus.lerp(goal, kk); dist += (d - dist) * (snap ? 1 : kk); pitch = p; fov = f;
    placeCamera(focus.x, focus.z, dist, pitch, fov, az);
  }
  const dtFrame = 1 / FPS;

  function hideClutter(): void {
    const id = cur().id as SceneId;
    if (fixture.guide) fixture.guide.root.visible = false;
    world.root.traverse((o) => {
      if (o.name === 'armRing' || o.name.startsWith('sidePurchase_') || o.name.startsWith('staffHirePad:')) o.visible = false;
      if (o.name.startsWith('zonePad_')) o.visible = id === 'expand' && o.name === 'zonePad_r1';
      if (o.name.startsWith('station_')) {
        const s = world.byId.get(o.name.slice(8));
        if (s?.def.kind === 'machine' || s?.def.kind === 'counter')
          for (const child of o.children) if (child.name !== 'stationBody') child.visible = false;
      }
    });
  }

  /* ------------------------------------------------------------ compositing */
  function draw(): void {
    const s = cur(), id = s.id as SceneId, age = time - sceneAt;
    hideClutter();
    scene.render();
    ctx.save();
    ctx.fillStyle = '#082D32'; ctx.fillRect(0, 0, W, H);
    if (id === 'after') {
      drawSplit(age);
    } else if (id === 'end') {
      ctx.filter = 'blur(14px) saturate(1.15)';
      ctx.drawImage(canvas, -40, -60, W + 80, H + 120);
      ctx.filter = 'none';
      ctx.fillStyle = 'rgba(8,45,50,.52)'; ctx.fillRect(0, 0, W, H);
    } else {
      const punch = sceneIdx > 0 ? 0.07 * (1 - O.easeOut(age / 0.32)) : 0;
      let shake = 0;
      if (id === 'hook') shake = 6 * Math.max(0, 1 - age / 0.5) + 2;
      if (id === 'expand' && unlockAt > 0) shake = Math.max(shake, 14 * Math.max(0, 1 - (time - unlockAt) / 0.4));
      const sc = 1 + punch;
      ctx.translate(W / 2 + Math.sin(time * 53) * shake, H / 2 + Math.cos(time * 41) * shake);
      ctx.scale(sc, sc);
      ctx.drawImage(canvas, -W / 2, -H / 2, W, H);
    }
    ctx.restore();
    overlay(id, age);
    // Cut flash.
    if (sceneIdx > 0 && age < 0.14) { ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - age / 0.14)})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawSplit(age: number): void {
    const half = H / 2, band = (H - half) / 2;
    const slide = O.easeOut(age / 0.35);
    // Top: before (desaturated, slight push-in).
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, half); ctx.clip();
    const z = 1 + 0.04 * (age / 3);
    ctx.filter = 'saturate(.55) brightness(.92)';
    ctx.drawImage(before, 0, band, W, half, -W * (z - 1) / 2 - (1 - slide) * W, 0, W * z, half * z);
    ctx.filter = 'none';
    ctx.restore();
    // Bottom: live after.
    ctx.save();
    ctx.beginPath(); ctx.rect(0, half, W, half); ctx.clip();
    ctx.drawImage(canvas, 0, band, W, half, (1 - slide) * W, half, W, half);
    ctx.restore();
    // Divider.
    ctx.fillStyle = O.C.deep; ctx.fillRect(0, half - 9, W, 18);
    ctx.fillStyle = O.C.gold; ctx.fillRect(0, half - 4, W * slide, 8);
  }

  function overlay(id: SceneId, age: number): void {
    const t = time;
    if (id === 'hook') {
      O.vignette(ctx, [200, 20, 20], 0.38 + 0.22 * Math.sin(t * 9));
      let shown = 0;
      for (const [i, c] of angryGuests.entries()) {
        if (c.done || shown >= 6) continue;
        const h = headOf(c); if (!h.ok) continue;
        const a = age - 0.3 - i * 0.16;
        if (a < 0) continue;
        shown++;
        const s = O.popScale(a, 0.25);
        O.angryFace(ctx, h.x, h.y - 30, 42 * s, t + i);
      }
      O.title(ctx, copy.hook1, W / 2, 330, { age: age - 0.1, size: 118, fill: '#FFFFFF', fill2: '#FFD2C8', shake: 5, time: t, rot: -3 });
      O.title(ctx, copy.hook2, W / 2, 470, { age: age - 1.15, size: 84, fill: O.C.gold, fill2: '#FFA41E', rot: 2 });
      if (age > 0.4) {
        const p = 0.12 - 0.04 * Math.min(1, age / 2);
        O.progressBar(ctx, 190, 580, 700, 64, p, copy.hygiene, false, t);
        if (Math.sin(t * 14) > 0) { ctx.strokeStyle = 'rgba(255,80,60,.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(178, 568, 724, 88, 44); ctx.stroke(); }
      }
      handTap(2.1, 2.62, 3.0, [W / 2 + 60, 1230], [W / 2 + 40, 1500]);
    }
    if (id === 'clean') {
      O.title(ctx, copy.clean, W / 2, 330, { age: age - 0.05, size: 124, fill: '#FFFFFF', fill2: '#BFF5FF', rot: -2 });
      let left = 0;
      for (const s of cleanSpills) { const live = world.spills.byId(s.id); left += live ? live.cellsLeft : 0; }
      const p = 1 - left / cleanTotal;
      O.progressBar(ctx, 140, 450, 800, 72, p, copy.cleanBar, true, t);
      if (player.interacting && cleanDoneAt < 0) {
        const bp = project(player.x + Math.sin(player.angle) * 1.0, 0.2, player.z + Math.cos(player.angle) * 1.0);
        for (let i = 0; i < 3; i++) O.star4(ctx, bp.x + Math.sin(t * 13 + i * 2) * 60, bp.y - 20 + Math.cos(t * 9 + i) * 40, 18 + 8 * Math.sin(t * 20 + i), t * 3 + i, '#FFFFFF', 0.9);
      }
      if (cleanDoneAt > 0) { O.stamp(ctx, copy.cleanDone, W / 2, 800, time - cleanDoneAt, t, '#9FF0FF'); O.drawConfetti(ctx, confetti, time - confettiAt); }
    }
    if (id === 'serve') {
      O.title(ctx, copy.serve, W / 2, 330, { age: age - 0.05, size: 124, fill: '#FFFFFF', fill2: O.C.gold, rot: -2 });
    }
    if (id === 'cash') O.title(ctx, copy.cash, W / 2, 330, { age: age - 0.05, size: 118, fill: '#FFFFFF', fill2: O.C.gold, rot: 2 });
    if (id === 'upgrade') {
      O.title(ctx, copy.upgrade, W / 2, 330, { age: age - 0.05, size: 130, fill: '#FFFFFF', fill2: O.C.mint, rot: -3 });
      const inK = O.easeOut((age - 0.05) / 0.25), outK = O.easeInOut((age - 1.85) / 0.25);
      const py = 1040 + (1 - inK) * 900 + outK * 900;
      if (outK < 1) {
        const btn = O.upgradePanel(ctx, copy, py, upgrade, t);
        // Finger: travel to tray button, tap twice, then speed button.
        const tray = btn.trayBtn, spd = btn.speedBtn;
        let hx = tray[0] + 30, hy = tray[1] + 260, press = 0;
        if (age < 0.45) { const m = O.easeOut((age - 0.2) / 0.25); hx = tray[0] + 20; hy = tray[1] + 260 - 230 * m; }
        else if (age < 1.3) { hx = tray[0] + 20; hy = tray[1] + 30; press = Math.max(tapPress(age, 0.62), tapPress(age, 1.08)); }
        else { const m = O.easeInOut((age - 1.3) / 0.2); hx = O.lerpN(tray[0] + 20, spd[0] + 20, m); hy = O.lerpN(tray[1] + 30, spd[1] + 30, m); press = tapPress(age, 1.55); }
        if (age > 0.2) O.hand(ctx, hx, hy, 1.05, press);
        for (const at of [0.62, 1.08]) O.tapRipple(ctx, tray[0] + 20, tray[1] + 10, age - at);
        O.tapRipple(ctx, spd[0] + 20, spd[1] + 10, age - 1.55);
      }
      if (age > 1.6) { const ph = headOf(player); O.speedLines(ctx, ph.x, ph.y + 120, t, Math.min(1, (age - 1.6) / 0.15)); }
    }
    if (id === 'expand') {
      O.title(ctx, copy.expand, W / 2, 330, { age: age - 0.05, size: 112, fill: '#FFFFFF', fill2: O.C.gold, rot: -2 });
      if (unlockAt > 0) {
        O.stamp(ctx, copy.unlocked, W / 2, 820, time - unlockAt, t);
        O.drawConfetti(ctx, confetti, time - confettiAt);
      }
    }
    if (id === 'staff') {
      O.title(ctx, copy.staff, W / 2, 330, { age: age - 0.05, size: 120, fill: '#FFFFFF', fill2: O.C.mint, rot: 2 });
    }
    if (id === 'after') {
      const tag = (text: string, y: number, color: string, a: number) => {
        const s = O.popScale(a, 0.28); if (s <= 0) return;
        ctx.save(); ctx.translate(70, y); ctx.scale(s, s); ctx.rotate(-0.05);
        ctx.font = '64px Paytone'; const w = ctx.measureText(text).width + 70;
        O.pill(ctx, 0, -48, w, 96, color, O.C.deep, 7);
        ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, 35, 4);
        ctx.restore();
      };
      tag(copy.before, 120, O.C.red, age - 0.25);
      tag(copy.after, 1080, '#24A85A', age - 0.55);
      if (age > 0.25) O.angryFace(ctx, W - 130, 140, 50 * O.popScale(age - 0.35, 0.25), t);
      if (age > 0.55) { O.heart(ctx, W - 130, 1090, 46 * O.popScale(age - 0.65, 0.25)); for (let i = 0; i < 5; i++) O.star4(ctx, 200 + i * 170, 1250 + Math.sin(t * 3 + i) * 30, 22 + 8 * Math.sin(t * 7 + i), t + i, '#FFF5C0', O.clamp01((age - 0.7) / 0.3)); }
      O.title(ctx, copy.grow, W / 2, H / 2, { age: age - 0.85, size: 120, fill: '#FFFFFF', fill2: O.C.gold, rot: -3 });
    }
    if (id === 'end') endCard(age);

    // Shared pops.
    for (const p of pops) {
      const a = t - p.t;
      if (a < 0 || a > 1.1) continue;
      if (p.kind === 'heart') {
        let x = p.x, y = p.y;
        if (p.ref && !p.ref.done) { const h = headOf(p.ref); x = h.x; y = h.y; }
        const s = O.popScale(a, 0.25) * (a > 0.8 ? 1 - (a - 0.8) / 0.3 : 1);
        O.heart(ctx, x, y - 30 - a * 50, 40 * s);
      } else if (p.kind === 'combo') {
        if (a > 0.7) continue;
        O.title(ctx, p.text!, p.x, p.y - a * 60, { age: a, size: 110, fill: O.C.gold, fill2: '#FF8A1E', rot: -8 });
        O.title(ctx, copy.combo, p.x, p.y + 70 - a * 60, { age: a - 0.04, size: 46, fill: '#FFFFFF', rot: -8 });
      } else if (p.kind === 'float') {
        O.floatText(ctx, p.text!, p.x, p.y, a, O.C.gold, p.text!.length > 6 ? 58 : 66);
      } else if (p.kind === 'star' && p.ref) {
        const s = p.ref as unknown as { x: number; z: number; char: { headTop: import('three').Object3D } };
        const h = headOf(s);
        if (a < 0.8) { for (let i = 0; i < 4; i++) O.star4(ctx, h.x + Math.cos(i * 1.57 + a * 4) * 70 * a * 1.6, h.y - 20 + Math.sin(i * 1.57 + a * 4) * 50 * a * 1.6, 26 * (1 - a), a * 6 + i, '#FFF2B0'); }
        O.floatText(ctx, '+1', h.x, h.y - 40, a, O.C.mint, 64);
      }
    }
    O.drawFlyers(ctx, flyers, t);
    for (const f of flyerPay) if (!f.done && t >= f.at) { f.done = true; state.grant(f.amount); hudBumpAt = t; cue('coin', { pan: -0.2 }, f.at); }
    // Money HUD.
    if (hudVisible && (id === 'serve' || id === 'cash' || id === 'upgrade' || id === 'expand')) {
      hudShown += (state.money - hudShown) * Math.min(1, dtFrame * 9);
      if (Math.abs(state.money - hudShown) < 1) hudShown = state.money;
      O.moneyHud(ctx, HUD.x, HUD.y, hudShown, 1 - O.clamp01((t - hudBumpAt) / 0.2), copy.locale);
    }
  }

  function tapPress(age: number, at: number): number { const a = age - at; return a >= -0.08 && a < 0.12 ? 1 - Math.abs(a) / 0.12 : 0; }
  function handTap(appear: number, tapAt: number, until: number, to: [number, number], from: [number, number]): void {
    if (time < appear || time > until) return;
    const m = O.easeOut((time - appear) / 0.35);
    const x = O.lerpN(from[0], to[0], m), y = O.lerpN(from[1], to[1], m);
    O.tapRipple(ctx, to[0], to[1] - 8, time - tapAt);
    O.hand(ctx, x, y, 1.1, tapPress(time, tapAt));
  }

  function endCard(age: number): void {
    const t = time;
    O.rays(ctx, W / 2, 650, 900, t, 'rgba(255,230,160,1)', 0.09 * O.clamp01(age / 0.4));
    O.drawConfetti(ctx, confetti, time - confettiAt);
    const is = O.popScale(age - 0.05, 0.3);
    if (is > 0) { ctx.save(); ctx.translate(W / 2, 360); ctx.scale(is, is); O.appIcon(ctx, assets, 0, 0, 220, t); ctx.restore(); }
    const ls = O.popScale(age - 0.2, 0.34);
    if (ls > 0) {
      const lw = 780, lh = lw * assets.logo.naturalHeight / assets.logo.naturalWidth;
      ctx.save(); ctx.translate(W / 2, 700 + Math.sin(t * 2.4) * 6); ctx.scale(ls, ls); ctx.drawImage(assets.logo, -lw / 2, -lh / 2, lw, lh); ctx.restore();
    }
    if (age > 0.45) {
      ctx.save(); ctx.globalAlpha = O.clamp01((age - 0.45) / 0.2);
      ctx.font = '700 54px Barlow'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = O.C.deep; ctx.strokeText(copy.tagline, W / 2, 965);
      ctx.fillStyle = O.C.cream; ctx.fillText(copy.tagline, W / 2, 965);
      ctx.restore();
    }
    const cs = O.popScale(age - 0.6, 0.3);
    const press = Math.max(tapPress(age, 2.0), tapPress(age, 3.0));
    if (cs > 0) { ctx.save(); ctx.translate(W / 2, 1110); ctx.scale(cs, cs); O.ctaButton(ctx, copy.cta, 0, 0, t, press); ctx.restore(); }
    if (age > 0.85) {
      const a = O.easeOut((age - 0.85) / 0.3);
      ctx.save(); ctx.globalAlpha = a;
      ctx.font = '700 40px Barlow'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#FFFFFF';
      ctx.fillText(copy.stores, W / 2, 1258 + (1 - a) * 30);
      ctx.restore();
      O.storeBadges(ctx, assets, W / 2, 1300 + (1 - a) * 40, 112, a);
    }
    if (age > 1.5) {
      const m = O.easeOut((age - 1.5) / 0.35);
      const hx = O.lerpN(W / 2 + 330, W / 2 + 150, m), hy = O.lerpN(1500, 1140, m);
      for (const at of [2.0, 3.0]) O.tapRipple(ctx, W / 2 + 130, 1120, age - at);
      O.hand(ctx, hx, hy, 1.1, press);
    }
  }

  /* ------------------------------------------------------------ frame driver */
  function stepFrame(render = true): boolean {
    if (frame >= DURATION * FPS) return false;
    time = frame / FPS;
    const i = sceneOf(time);
    if (i !== sceneIdx) enter(i);
    if (cur().id === 'end' && sceneAt === time) { cue('levelup', { gain: 0.5 }, time + 0.2); cue('pop', { pitch: 1 }, time + 0.62); cue('swish', {}, time + 0.85); cue('tap', {}, time + 2.0); cue('button', {}, time + 2.02); cue('tap', {}, time + 3.0); cue('button', {}, time + 3.02); confetti = O.makeConfetti(80, W / 2, 700, 99); confettiAt = time + 0.2; }
    if (cur().id === 'cash' && sceneAt === time) cue('cash', {}, time + 0.35);
    if (cur().id === 'upgrade' && sceneAt === time) cue('swish', {}, time + 0.05);
    if (cur().id === 'after' && sceneAt === time) { cue('stamp', {}, time + 0.25); cue('stamp', { gain: 0.8 }, time + 0.55); cue('impact', {}, time + 0.85); cue('sparkle', {}, time + 0.7); }
    if (['clean', 'serve', 'cash', 'upgrade', 'expand', 'staff'].includes(cur().id) && sceneAt === time) cue('stamp', { gain: 0.7 }, time + 0.06);
    const ticks = Math.round(2 * cur().speed);
    for (let n = 0; n < ticks; n++) tick(1 / 60);
    camera();
    if (render) draw();
    frame++;
    return true;
  }

  function report() {
    return {
      frame, time, lang: LANG, scenes: SCENES, cues, events,
      stats: { ...state.stats }, money: state.money, cleanDoneAt, unlockAt,
      staff: world.staff.map((s) => s.role), customers: world.customers.length,
      player: { x: player.x, z: player.z, held: player.carryCount },
    };
  }

  // Frame zero.
  sceneIdx = -1;
  enter(0);
  hideClutter();
  await scene.prepareForPlay();
  for (let n = 0; n < 30; n++) player.update(1 / 60, move, world.nav, world.loc.bounds);
  draw();
  const controller = {
    stepFrame, report, draw,
    png: () => film.toDataURL('image/png').split(',')[1],
    jpeg: () => film.toDataURL('image/jpeg', 0.92).split(',')[1],
  };
  Object.assign(window, { __ua: controller });
  document.querySelector('#status')?.remove();
  if (!manual) {
    let last = performance.now(), acc = 0;
    const loop = (now: number) => {
      acc += Math.min(0.2, (now - last) / 1000); last = now;
      let stepped = false;
      while (acc >= 1 / FPS && frame < DURATION * FPS) { stepFrame(false); acc -= 1 / FPS; stepped = true; }
      if (stepped) draw();
      if (frame < DURATION * FPS) requestAnimationFrame(loop);
      else document.querySelector('#replay')?.removeAttribute('hidden');
    };
    requestAnimationFrame(loop);
  }
}

void boot().catch((error) => {
  console.error(error);
  const s = document.querySelector('#status');
  if (s) s.textContent = 'Çekim açılamadı: ' + (error as Error).message;
});
