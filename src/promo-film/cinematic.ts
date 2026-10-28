import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** A five-second, deterministic advertising vignette, independent of game saves. */
export async function createCinematic(canvas: HTMLCanvasElement): Promise<{ render(t: number): void; dispose(): void }> {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(1080, 1920, false);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.background = new T.Color('#ead5ae');
  scene.fog = new T.Fog('#e6d0ac', 13, 30);
  const camera = new T.PerspectiveCamera(38, 1080 / 1920, 0.05, 55);
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.08);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.55;
  room.dispose();
  pmrem.dispose();

  const materials: T.Material[] = [];
  const textures: T.Texture[] = [];
  const standard = (color: T.ColorRepresentation, roughness = 0.6, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    materials.push(m); return m;
  };
  const physical = (p: T.MeshPhysicalMaterialParameters) => { const m = new T.MeshPhysicalMaterial(p); materials.push(m); return m; };
  const cream = physical({ color: '#fff5e1', roughness: 0.17, clearcoat: 0.9, clearcoatRoughness: 0.09 });
  const porcelain = physical({ color: '#fffaf0', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06 });
  const teal = standard('#175e58', 0.52);
  const darkTeal = standard('#103d3c', 0.48);
  const mint = standard('#91c8a8', 0.66);
  const brass = standard('#d7a84e', 0.27, 0.78);
  const coffeeMat = physical({ color: '#58301b', roughness: 0.13, clearcoat: 1 });
  const crema = standard('#d99f55', 0.5);
  const skin = standard('#efb481', 0.62);
  const hair = standard('#593820', 0.72);
  const glove = standard('#f7edda', 0.58);
  const black = standard('#172e2c', 0.4);
  const wall = standard('#eedac0', 0.9);
  const timber = standard('#985e35', 0.48);
  const leaf = standard('#4a9565', 0.7);
  const leafLight = standard('#86b67a', 0.75);
  const warmLight = standard('#ffe8ab', 0.4);
  warmLight.emissive.set('#ffd67c'); warmLight.emissiveIntensity = 0.5;

  // A thin, genuinely textured walnut top carries the extreme close shot.
  const grainCanvas = document.createElement('canvas'); grainCanvas.width = 1024; grainCanvas.height = 256;
  const grain = grainCanvas.getContext('2d')!;
  grain.fillStyle = '#9d653c'; grain.fillRect(0, 0, 1024, 256);
  let seed = 6471;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 250; i++) {
    const y = random() * 256;
    grain.strokeStyle = `rgba(${random() > 0.5 ? '47,22,7' : '242,191,126'},${0.04 + random() * 0.15})`;
    grain.lineWidth = 0.6 + random() * 2.4;
    grain.beginPath(); grain.moveTo(0, y);
    grain.bezierCurveTo(310, y + Math.sin(i) * 8, 690, y - Math.cos(i) * 14, 1024, y + Math.sin(i * 4) * 6); grain.stroke();
  }
  const woodMap = new T.CanvasTexture(grainCanvas); woodMap.colorSpace = T.SRGBColorSpace;
  woodMap.wrapS = woodMap.wrapT = T.RepeatWrapping; woodMap.repeat.set(1.6, 1.6); textures.push(woodMap);
  const walnut = standard('#d29a68', 0.46); walnut.map = woodMap;

  function mesh(g: T.BufferGeometry, m: T.Material, p: T.Object3D, x = 0, y = 0, z = 0) {
    const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o;
  }
  function box(p: T.Object3D, m: T.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0, r = 0.05) {
    return mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w * .45, h * .45, d * .45)), m, p, x, y, z);
  }
  function sphere(p: T.Object3D, m: T.Material, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) {
    const o = mesh(new T.SphereGeometry(1, 24, 16), m, p, x, y, z); o.scale.set(sx, sy, sz); return o;
  }
  function cylinder(p: T.Object3D, m: T.Material, r1: number, r2: number, h: number, x = 0, y = 0, z = 0, n = 48) {
    return mesh(new T.CylinderGeometry(r1, r2, h, n), m, p, x, y, z);
  }
  function tube(p: T.Object3D, m: T.Material, points: T.Vector3[], r: number, closed = false) {
    return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points, closed), Math.max(16, points.length * 8), r, 10, closed), m, p);
  }
  function rod(p: T.Object3D, m: T.Material, a: T.Vector3, b: T.Vector3, radius: number) {
    const o = cylinder(p, m, radius, radius, a.distanceTo(b), 0, 0, 0, 18);
    o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return o;
  }
  const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
  const key = new T.DirectionalLight('#ffebc7', 3.4); key.position.set(-3.5, 7, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -7; key.shadow.camera.right = 7; key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 22; key.shadow.bias = -0.0003; key.shadow.normalBias = .025; key.shadow.radius = 4; scene.add(key);
  scene.add(new T.HemisphereLight('#fff4dd', '#547c70', 1.4));
  const rim = new T.DirectionalLight('#b6e5db', 1.8); rim.position.set(4, 5, -3); scene.add(rim);

  // Café world: patterned oak floor, panelled wall, coffee bar, lamps, plants.
  box(scene, wall, 20, .16, 20, 0, -.13, -2);
  for (let row = 0; row < 18; row++) for (let col = 0; col < 4; col++) {
    const plank = box(scene, row % 3 === 0 ? walnut : timber, 3.99, .035, .68, -6 + col * 4 + (row % 2) * .45, -.035, -7 + row * .7, .008);
    plank.receiveShadow = true;
  }
  box(scene, wall, 14, 7, .25, 0, 3.5, -5.4);
  box(scene, teal, 14, 1.65, .3, 0, .82, -5.15);
  for (let i = 0; i < 19; i++) box(scene, darkTeal, .035, 1.38, .04, -6.3 + i * .7, .8, -4.96, .005);
  box(scene, brass, 14, .055, .12, 0, 1.68, -4.94, .02);
  // Warm arched recesses read as an authored interior beyond the foreground.
  for (const x of [-3.8, 0, 3.8]) {
    const shape = new T.Shape(); shape.moveTo(-1.25, 0); shape.lineTo(-1.25, 2.6); shape.absarc(0, 2.6, 1.25, Math.PI, 0, true); shape.lineTo(1.25, 0);
    const recess = mesh(new T.ShapeGeometry(shape, 32), x === 0 ? darkTeal : mint, scene, x, 1.76, -5.0); recess.receiveShadow = false;
    box(scene, timber, 2.6, .12, .36, x, 2.0, -4.78);
    box(scene, timber, 2.6, .1, .32, x, 3.1, -4.78);
    for (let n = 0; n < 5; n++) {
      cylinder(scene, n % 2 ? cream : teal, .12, .13, .24, x - .86 + n * .43, 3.28, -4.66, 24);
      cylinder(scene, n % 2 ? brass : cream, .14, .13, .28, x - .86 + n * .43, 2.2, -4.66, 24);
    }
  }
  box(scene, teal, 8.8, 1.35, 1.0, -.2, .7, -3.9, .12);
  box(scene, cream, 9.2, .18, 1.35, -.2, 1.45, -3.8, .08);
  for (let i = 0; i < 21; i++) box(scene, timber, .19, 1.12, .055, -4.25 + i * .4, .72, -3.36, .025);
  box(scene, brass, 8.3, .045, .06, -.2, 1.22, -3.31, .015);
  const machine = new T.Group(); machine.position.set(-2.5, 1.55, -3.65); scene.add(machine);
  box(machine, darkTeal, 1.55, 1.08, .64, 0, .54, 0, .15);
  box(machine, brass, 1.38, .35, .12, 0, .72, .36, .1);
  box(machine, black, 1.3, .11, .52, 0, .12, .23, .04);
  for (const x of [-.34, .34]) {
    cylinder(machine, brass, .09, .11, .22, x, .44, .43);
    box(machine, black, .1, .11, .36, x, .43, .58, .04);
    cylinder(machine, cream, .17, .14, .22, x, .26, .5);
  }
  for (let n = 0; n < 3; n++) cylinder(machine, cream, .14, .12, .2, -.4 + n * .4, 1.17, 0);
  const pastryTray = box(scene, timber, 1.45, .075, .65, 2.3, 1.58, -3.7, .12);
  for (let i = 0; i < 5; i++) {
    const crescent = mesh(new T.TorusGeometry(.14, .075, 10, 20, Math.PI * 1.7), crema, scene, 1.8 + (i % 3) * .45, 1.68, -3.75 + Math.floor(i / 3) * .25);
    crescent.rotation.x = Math.PI / 2; crescent.rotation.z = .3;
  }
  pastryTray.name = 'pastry-tray';
  for (const x of [-3, 1.5, 4]) {
    rod(scene, black, v(x, 5.7, -2), v(x, 4.1, -2), .02);
    const shade = mesh(new T.LatheGeometry([new T.Vector2(.06, .32), new T.Vector2(.18, .28), new T.Vector2(.42, .03), new T.Vector2(.44, 0)], 40), teal, scene, x, 3.82, -2);
    shade.material = physical({ color: '#26776a', roughness: .34, side: T.DoubleSide, clearcoat: .3 });
    cylinder(scene, warmLight, .39, .39, .025, x, 3.81, -2, 40);
  }
  function plant(x: number, z: number, scale = 1) {
    const g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); scene.add(g);
    cylinder(g, cream, .39, .28, .7, 0, .35, 0);
    cylinder(g, coffeeMat, .34, .34, .025, 0, .71, 0);
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4, h = 1.0 + (i % 3) * .28;
      const end = v(Math.cos(a) * .45, h + .6, Math.sin(a) * .45);
      tube(g, leaf, [v(0, .68, 0), v(end.x * .2, h, end.z * .2), end], .018);
      const l = sphere(g, i % 2 ? leaf : leafLight, end.x, end.y, end.z, .2, .46, .055); l.rotation.z = -Math.cos(a) * .65; l.rotation.y = -a;
    }
  }
  plant(-4.9, -2.6, 1.3); plant(4.6, -2.7, 1.4); plant(-3.6, 1.1, .8);

  // Hero table and supporting dining set, with a fine metal edge and pedestal.
  const table = new T.Group(); table.position.set(-.95, 0, 0); scene.add(table);
  cylinder(table, black, .58, .67, .12, 0, .08, 0);
  cylinder(table, teal, .13, .22, 1.1, 0, .62, 0);
  cylinder(table, brass, 1.43, 1.43, .075, 0, 1.2, 0, 96);
  cylinder(table, walnut, 1.44, 1.43, .12, 0, 1.285, 0, 96);
  const napkin = box(table, cream, .48, .012, .7, -.6, 1.352, -.4, .012); napkin.rotation.y = -.25;
  for (let i = 0; i < 3; i++) cylinder(table, crema, .13, .14, .04, -.48 + i * .09, 1.38 + i * .04, -.45);
  function chair(x: number, z: number, rotation: number) {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rotation; scene.add(g);
    box(g, teal, .63, .15, .62, 0, .65, 0, .09);
    box(g, teal, .64, .6, .13, 0, 1.0, -.26, .09);
    for (const lx of [-.23, .23]) for (const lz of [-.22, .22]) rod(g, timber, v(lx, .6, lz), v(lx * 1.25, 0, lz * 1.2), .035);
    box(g, brass, .5, .025, .025, 0, .91, -.18, .01);
  }
  chair(-2.55, .05, -Math.PI / 2); chair(-.9, -1.65, Math.PI);
  for (const [x, z] of [[-3.2, -2.1], [3.1, -1.7]]) {
    cylinder(scene, walnut, .7, .7, .12, x, 1.15, z);
    cylinder(scene, teal, .1, .2, 1.1, x, .56, z);
    cylinder(scene, black, .36, .42, .07, x, .04, z);
    chair(x + .9, z + .5, -.8);
  }

  // Lathed porcelain walls include a real inner profile; no solid cylinder cup.
  const cup = new T.Group(); scene.add(cup);
  const profile = [[0, 0], [.22, 0], [.27, .035], [.31, .12], [.36, .48], [.37, .61], [.36, .64], [.329, .64], [.326, .60], [.315, .48], [.27, .12], [.2, .075], [0, .075]].map(([x, y]) => new T.Vector2(x, y));
  mesh(new T.LatheGeometry(profile, 72), porcelain, cup);
  const lip = mesh(new T.TorusGeometry(.349, .018, 12, 72), cream, cup, 0, .633, 0); lip.rotation.x = Math.PI / 2;
  const handlePoints = Array.from({ length: 14 }, (_, i) => {
    const a = -Math.PI / 2 + i / 13 * Math.PI; return v(.32 + Math.cos(a) * .26, .34 + Math.sin(a) * .23, 0);
  });
  tube(cup, porcelain, handlePoints, .068);
  cylinder(cup, coffeeMat, .325, .325, .015, 0, .586, 0, 72);
  const cremaRing = mesh(new T.TorusGeometry(.285, .025, 8, 64), crema, cup, 0, .598, 0); cremaRing.rotation.x = Math.PI / 2;
  // Small latte leaf: five nested teardrops and one pouring stem, all on the liquid plane.
  for (let i = 0; i < 5; i++) {
    const a = sphere(cup, cream, 0, .603 + i * .0005, .1 - i * .044, .14 - i * .022, .004, .065 - i * .007); a.rotation.y = i % 2 ? .08 : -.08;
  }
  tube(cup, cream, [v(0, .609, .17), v(.005, .609, .015), v(-.015, .609, -.15)], .012);
  const brandDisk = cylinder(cup, teal, .083, .083, .004, 0, .31, .334, 32); brandDisk.rotation.x = Math.PI / 2;
  const brandBean = sphere(cup, brass, 0, .31, .34, .025, .045, .008); brandBean.rotation.z = -.35;
  const saucer = new T.Group(); saucer.position.set(-.16, 1.35, 0); scene.add(saucer);
  mesh(new T.LatheGeometry([[0, 0], [.29, 0], [.54, .04], [.61, .08], [.6, .11], [.52, .08], [.27, .025], [0, .025]].map(([x, y]) => new T.Vector2(x, y)), 64), cream, saucer);
  const saucerRing = mesh(new T.TorusGeometry(.51, .008, 8, 64), brass, saucer, 0, .067, 0); saucerRing.rotation.x = Math.PI / 2;

  // An expressive café worker has a real silhouette, costume, joints, and eyes.
  const hero = new T.Group(); hero.position.set(1.28, 0, -.55); hero.rotation.y = -.2; scene.add(hero);
  for (const x of [-.19, .19]) {
    box(hero, black, .24, .22, .46, x, .12, .08, .09);
    cylinder(hero, teal, .12, .145, .6, x, .51, 0);
  }
  const torso = sphere(hero, cream, 0, 1.18, 0, .42, .55, .27);
  box(hero, teal, .58, .66, .13, 0, 1.15, .25, .08);
  box(hero, darkTeal, .34, .18, .035, 0, 1.05, .33, .035);
  for (const x of [-.23, .23]) { const strap = box(hero, teal, .09, .5, .05, x, 1.57, .23, .025); strap.rotation.z = x * -.5; sphere(hero, brass, x, 1.38, .31, .03); }
  const head = new T.Group(); head.position.set(0, 1.96, 0); hero.add(head);
  sphere(head, skin, 0, .19, 0, .4, .43, .34);
  sphere(head, skin, -.4, .15, 0, .065, .1, .08); sphere(head, skin, .4, .15, 0, .065, .1, .08);
  sphere(head, hair, 0, .46, -.04, .41, .24, .33);
  for (let i = 0; i < 5; i++) sphere(head, hair, -.26 + i * .12, .44 + Math.sin(i) * .025, .22, .12, .11, .12);
  for (const x of [-.14, .14]) {
    sphere(head, porcelain, x, .24, .307, .078, .098, .025);
    sphere(head, black, x - .018, .225, .333, .032, .052, .015);
    sphere(head, porcelain, x - .025, .25, .347, .012, .015, .008);
    const eyebrow = box(head, hair, .15, .035, .03, x, .37, .31, .015); eyebrow.rotation.z = x < 0 ? -.22 : .22;
  }
  sphere(head, skin, 0, .12, .34, .07, .065, .065);
  const mouth = tube(head, coffeeMat, [v(-.09, .025, .32), v(0, -.005, .338), v(.09, .025, .32)], .012);
  const surprisedMouth = sphere(head, coffeeMat, 0, .02, .34, .052, .067, .014);
  const cap = new T.Group(); cap.position.set(0, .56, -.02); head.add(cap);
  cylinder(cap, teal, .29, .38, .23, 0, .04, 0, 48);
  const peak = sphere(cap, teal, 0, -.04, .3, .35, .045, .24); peak.rotation.x = .07;
  const capPin = sphere(cap, brass, 0, .06, .29, .052, .052, .012); capPin.name = 'cafe-worker-pin';
  const upper = cylinder(scene, cream, .125, .155, 1, 0, 0, 0, 24);
  const lower = cylinder(scene, skin, .1, .115, 1, 0, 0, 0, 24);
  const elbow = sphere(scene, skin, 0, 0, 0, .12);
  const hand = new T.Group(); scene.add(hand);
  sphere(hand, glove, 0, 0, 0, .18, .1, .16);
  for (let i = 0; i < 4; i++) {
    const finger = sphere(hand, glove, -.105 + i * .07, .035, .13, .041, .058, .11); finger.rotation.x = -.3;
  }
  const thumb = sphere(hand, glove, -.17, .06, .015, .065, .07, .11); thumb.rotation.z = -.5;
  cylinder(hand, teal, .115, .115, .11, 0, -.04, -.15, 24).rotation.x = Math.PI / 2;
  // Resting arm keeps the worker's pose human and gives the reach clear contrast.
  rod(hero, cream, v(.35, 1.53, 0), v(.52, 1.1, .02), .13);
  rod(hero, skin, v(.52, 1.1, .02), v(.46, .84, .19), .10);
  sphere(hero, glove, .46, .83, .2, .13, .15, .1);
  torso.name = 'worker-shirt';

  const droplets = Array.from({ length: 24 }, (_, i) => {
    const radius = .006 + (i % 3) * .002;
    return sphere(scene, coffeeMat, 0, 0, 0, radius, radius * 1.1, radius);
  });
  const spillStream = Array.from({ length: 9 }, () => cylinder(scene, coffeeMat, .012, .017, 1, 0, 0, 0, 10));
  const splash = new T.Group(); scene.add(splash);
  for (let i = 0; i < 8; i++) {
    const a = i * 2.4; sphere(splash, coffeeMat, Math.cos(a) * .16, 0, Math.sin(a) * .14, .065, .009, .035);
  }
  const ringMat = new T.MeshBasicMaterial({ color: '#fff1a2', transparent: true, opacity: 0, depthWrite: false }); materials.push(ringMat);
  const ring = mesh(new T.TorusGeometry(.58, .018, 8, 72), ringMat, scene, -.16, 1.4, 0); ring.rotation.x = Math.PI / 2; ring.castShadow = false;
  const sparks = Array.from({ length: 10 }, (_, i) => {
    const s = mesh(new T.OctahedronGeometry(.06, 0), ringMat, scene); s.castShadow = false; return { mesh: s, a: i * Math.PI * 2 / 10 };
  });
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const smooth = (x: number) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ease = (x: number) => 1 - (1 - clamp(x)) ** 3;
  const lerp = T.MathUtils.lerp;
  const shoulder = v(0, 0, 0), joint = v(0, 0, 0), wrist = v(0, 0, 0);
  function bone(o: T.Mesh, a: T.Vector3, b: T.Vector3) {
    o.position.copy(a).add(b).multiplyScalar(.5); o.scale.y = a.distanceTo(b); o.quaternion.setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize());
  }
  function render(seconds: number): void {
    const t = Math.max(0, Math.min(5, seconds));
    const fall = smooth(t / 1.5), rescue = smooth((t - 1.48) / .9), setDown = smooth((t - 2.65) / .85);
    const cupX = lerp(.31 + .16 * fall, -.16, rescue);
    const cupY = 1.35 - .21 * fall * (1 - rescue) + .17 * Math.sin(rescue * Math.PI) + .026 * setDown;
    cup.position.set(cupX, cupY, 0);
    cup.rotation.z = -.10 - .78 * fall + .88 * rescue;
    cup.rotation.x = Math.sin(t * 1.7) * .018 * (1 - rescue);
    cup.rotation.y = -.14;
    if (t > 3.5) cup.rotation.z = .025 * Math.sin((t - 3.5) * 15) * Math.exp(-(t - 3.5) * 6);
    const reach = ease((t - 1.0) / .78), release = smooth((t - 3.55) / .55);
    wrist.set(lerp(1.13, cupX + .50, reach), lerp(1.05, cupY + .29, reach), lerp(.04, .02, reach));
    wrist.lerp(v(1.1, 1.06, .07), release);
    hand.position.copy(wrist); hand.rotation.set(.18, -.38, -.15 + .3 * rescue);
    shoulder.set(.94, 1.65, -.57); joint.set(lerp(1.1, .74, reach), lerp(1.21, 1.40, reach), -.3);
    bone(upper, shoulder, joint); bone(lower, joint, wrist); elbow.position.copy(joint);
    hero.rotation.z = -.06 * Math.sin(Math.PI * reach) + .045 * Math.sin(t * 2) * (1 - reach);
    head.rotation.z = -.12 * (1 - rescue); head.rotation.y = -.22 * (1 - rescue);
    mouth.scale.y = .6 + .7 * rescue;
    mouth.visible = rescue > .62;
    surprisedMouth.visible = rescue <= .62;
    for (let i = 0; i < droplets.length; i++) {
      const released = .68 + i * .09;
      const age = t - released; const d = droplets[i];
      d.visible = age >= 0 && age < 1.5 && t < 2.35 && i < 6;
      const a = Math.max(0, age);
      const atFall = smooth(released / 1.5), angle = .1 + .78 * atFall;
      const launchX = .31 + .16 * atFall + Math.sin(angle) * .60 + Math.cos(angle) * .30;
      const launchY = 1.35 - .21 * atFall + Math.cos(angle) * .60 - Math.sin(angle) * .30;
      d.position.set(launchX + a * (.2 + (i % 6) * .07), launchY + a * (.12 + (i % 3) * .04) - a * a * .72, Math.sin(i * 7.1) * (.06 + a * .15));
      d.rotation.z = -.35 - a;
      d.scale.y = (.006 + (i % 3) * .002) * (1.1 + a * .4);
    }
    const spillAmount = Math.sin(clamp((t - .42) / 1.45) * Math.PI);
    const lipPoint = v(.30, .598, 0).applyEuler(cup.rotation).add(cup.position);
    const flowPoint = (u: number) => lipPoint.clone().add(v(u * .48, -.12 * u - .78 * u * u, .025 * Math.sin(u * 5 + t * 3)));
    for (let i = 0; i < spillStream.length; i++) {
      const stream = spillStream[i];
      stream.visible = spillAmount > .05;
      const a = i / spillStream.length * spillAmount, b = (i + 1) / spillStream.length * spillAmount;
      bone(stream, flowPoint(a), flowPoint(b));
    }
    splash.position.set(.8, .018, .05); splash.scale.setScalar(smooth((t - 1.55) / .5) * .65); splash.visible = t > 1.55;
    const settle = clamp((t - 3.5) / .65);
    ring.visible = t > 3.5 && t < 4.15; ring.scale.setScalar(1 + settle * 1.9); ringMat.opacity = Math.sin(settle * Math.PI) * .85;
    for (const s of sparks) {
      s.mesh.visible = ring.visible;
      s.mesh.position.set(-.16 + Math.cos(s.a) * (.45 + settle * .6), 1.65 + Math.sin(settle * Math.PI) * .45 + Math.sin(s.a) * .2, Math.sin(s.a) * (.4 + settle * .3));
      s.mesh.rotation.set(t * 2, t + s.a, t * 3); s.mesh.scale.setScalar(Math.sin(settle * Math.PI));
    }
    const pull = smooth((t - 1.15) / 1.8), launch = smooth((t - 4.0) / 1.0);
    const cameraStart = v(1.45, 2.75, 3.25), cameraWide = v(5.0, 4.5, 8.3), cameraEnd = v(.3, 5.6, 6.9);
    camera.position.copy(cameraStart).lerp(cameraWide, pull).lerp(cameraEnd, launch);
    const target = v(.5 + .12 * fall * (1 - rescue), 1.85, 0).lerp(v(.35, 1.85, -.45), pull).lerp(v(-.4, 1.1, -1.6), launch);
    camera.fov = lerp(38, 44, pull) + launch * 9; camera.updateProjectionMatrix(); camera.lookAt(target);
    camera.rotation.z += -.035 * Math.sin(launch * Math.PI);
    renderer.render(scene, camera);
  }
  await renderer.compileAsync(scene, camera);
  render(0);
  return { render, dispose() {
    const geometries = new Set<T.BufferGeometry>(); scene.traverse((o) => { if (o instanceof T.Mesh) geometries.add(o.geometry); });
    for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); for (const t of textures) t.dispose();
    environment.dispose(); renderer.dispose();
  } };
}
