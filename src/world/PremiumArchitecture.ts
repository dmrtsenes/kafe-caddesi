/** Architectural parts from the premium film, fitted to each playable room. */
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {PREMIUM as P} from './PremiumDesign';
const materials = new Map<string, T.MeshStandardMaterial>(),
  geometries = new Map<string, T.BufferGeometry>();
function material(c: number, metal = 0, emissive = false) {
  const k = `${c}/${metal}/${emissive}`;
  let m = materials.get(k);
  if (!m) {
    m = new T.MeshStandardMaterial({
      color: c,
      roughness: metal ? 0.34 : 0.62,
      metalness: metal,
      emissive: emissive ? c : 0,
      emissiveIntensity: emissive ? 0.5 : 0,
    });
    materials.set(k, m);
  }
  return m;
}
function piece(
  p: T.Object3D,
  g: T.BufferGeometry,
  c: number,
  x = 0,
  y = 0,
  z = 0,
  metal = 0,
) {
  const m = new T.Mesh(g, material(c, metal));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  p.add(m);
  return m;
}
function block(
  p: T.Object3D,
  w: number,
  h: number,
  d: number,
  c: number,
  x = 0,
  y = 0,
  z = 0,
  r = 0.035,
) {
  const k = [w, h, d, r].join("/");
  let g = geometries.get(k);
  if (!g) {
    g =
      h < 0.075 || Math.min(w, d) < 0.1
        ? new T.BoxGeometry(w, h, d)
        : new RoundedBoxGeometry(
            w,
            h,
            d,
            1,
            Math.min(r, w * 0.48, h * 0.48, d * 0.48),
          );
    geometries.set(k, g);
  }
  return piece(p, g, c, x, y, z);
}
function cylinder(
  p: T.Object3D,
  r: number,
  h: number,
  c: number,
  x: number,
  y: number,
  z: number,
  metal = 0,
) {
  const key = `cylinder/${r}/${h}`;
  if (!geometries.has(key)) geometries.set(key, new T.CylinderGeometry(r, r, h, 20));
  return piece(p, geometries.get(key)!, c, x, y, z, metal);
}
function strip(
  p: T.Object3D,
  w: number,
  d: number,
  x: number,
  y: number,
  z: number,
) {
  const m = block(p, w, 0.026, d, 0xffd590, x, y, z, 0.006);
  m.material = material(0xffd590, 0, true);
  m.castShadow = false;
  return m;
}
export function createPremiumBackbar() {
  const root=new T.Group(); root.name='premiumBackbar';
  // Solid rear wall, tiled backsplash, cabinets and clean low-profile canopy (no HUD-clipping signs).
  block(root, 19.4, 2.65, 0.36, P.ink, 0, 1.32, -11.58, 0.055);
  block(root, 18.7, 1.04, 1.3, P.ink, 0, 0.5, -10.73, 0.05);
  block(root, 18.82, 0.11, 1.37, P.light, 0, 1.07, -10.73, 0.035);
  for (let x = -9.15; x < 9.3; x += 0.21)
    block(root, 0.08, 0.81, 0.025, P.wood, x, 0.49, -10.055, 0.012);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 27; col++) {
      const x = -9.15 + col * 0.7 + (row % 2) * 0.35;
      if (x > 9.2) continue;
      block(
        root,
        0.66,
        0.245,
        0.045,
        row % 2 ? 0x35534c : 0x304a44,
        x,
        1.3 + row * 0.28,
        -11.37,
        0.018,
      );
    }
  for (const x of [-9.48, 9.48])
    block(root, 0.19, 2.65, 1.75, P.dark, x, 1.32, -10.55, 0.03);
  block(root, 19.25, 0.22, 1.85, P.ink, 0, 2.54, -10.55, 0.045);
  strip(root, 18.6, 0.08, 0, 2.41, -9.72);
  for (let n = 0; n < 3; n++) {
    const x = (n - 1) * 3.9;
    block(root, 3.1, 0.06, 0.68, P.wood, x, 2.02, -11.08, 0.02);
    strip(root, 2.95, 0.05, x, 1.97, -11.02);
  }
  for (const x of [-7.7, 0, 7.7]) {
    if (x !== 0) block(root, 2.0, 0.065, 0.72, P.wood, x, 2.02, -11.08, 0.02);
    for (let n = 0; n < 5; n++) {
      const jar = cylinder(
        root,
        0.09,
        0.28,
        n % 2 ? P.cream : P.terra,
        x - 0.64 + n * 0.32,
        2.19,
        -11.05,
      );
      jar.scale.set(1 / 0.925, 1, 1 / 0.23);
      const lid = cylinder(root, 0.094, 0.024, P.dark, x - 0.64 + n * 0.32, 2.34, -11.05);
      lid.scale.set(1 / 0.925, 1, 1 / 0.23);
    }
  }

  return root;
}
export function addPremiumGlazing(root: T.Group, x: number, z0: number, z1: number) {
  // Direk ve cam duvarın ÜSTÜNDE başlar. Yere kadar inen ince bir cam,
  // yürüyünce podyumun yan yüzüyle ve duvar kenarıyla aynı pikseli paylaşıp
  // bankın yanında pır pır ediyordu. Cam da 3 pikselden kalın olsun.
  const length=z1-z0, sections=Math.max(1,Math.ceil(length/6.6)), step=length/sections;
  const postBottom = 0.98;
  const postTop = 3.07;
  const postH = postTop - postBottom;
  for(let i=0;i<=sections;i++) {
    const z=z0+i*step;
    block(root,.19,postH,.19,P.dark,x,postBottom + postH / 2,z,.025);
  }
  for(let i=0;i<sections;i++) {
    const z=z0+(i+.5)*step;
    const paneH = 1.82;
    const pane=block(root,.08,paneH,step-.28,0xb6d2cd,x,postBottom + paneH / 2,z,0);
    pane.material=glazingMaterial;pane.castShadow=false;
    block(root,.1,.1,step-.2,P.dark,x,2.82,z,.016);
  }
}
const glazingMaterial=new T.MeshPhysicalMaterial({color:0xb4d2d0,transparent:true,opacity:.14,roughness:.14,depthWrite:false});
export function createPremiumLoungeLamp(roundTable = false) {
  const root=new T.Group();root.name='premiumLoungeLamp';
  if (roundTable) {
    // Yuvarlak 4 kişilik masada (k_masa_9) sandalyeler 45° köşegendedir (±1.096, ±1.096);
    // direk güney kardinal boşluğuna (0, 1.9, 1.48) dikilir, hiçbir sandalyeye değmez.
    cylinder(root,.025,3.8,P.dark,0,1.9,1.48);
    block(root,.035,.035,.72,0xb79459,0,3.78,1.14,0);
    piece(root,lampShadeGeometry,0xe4d2a2,0,3.68,.8);
  } else {
    // Kare ve VIP masalarda sandalyeler kardinal eksenlerdedir; direk köşegen (1.18, 1.18) dışındadır.
    cylinder(root,.025,3.8,P.dark,1.18,1.9,1.18);
    block(root,1.22,.035,.035,0xb79459,.59,3.78,1.18,0);
    block(root,.035,.035,.42,0xb79459,0,3.78,.99,0);
    piece(root,lampShadeGeometry,0xe4d2a2,0,3.68,.8);
  }
  const bulb=new T.Mesh(lampBulbGeometry,bulbMaterial);
  bulb.rotation.x=Math.PI/2;bulb.position.set(0,3.68,.8);root.add(bulb);
  return root;
}
const bulbMaterial=new T.MeshBasicMaterial({color:0xffe1a1,side:T.DoubleSide});
const lampShadeGeometry=new T.SphereGeometry(.32,20,10,0,Math.PI*2,0,Math.PI/2);
const lampBulbGeometry=new T.CircleGeometry(.29,20);
const leafGeometry=new T.SphereGeometry(.3,10,7);
const artGeometry=new T.CircleGeometry(.25,32);
export function createPremiumPlanter() {
  const root=new T.Group();root.name='premiumPlanter';
  block(root,.82,.62,.82,0xede8db,0,.31,0,0);
  block(root,.85,.05,.85,0xb79459,0,.63,0,0);
  block(root,.73,.03,.73,0x4b5139,0,.66,0,0);
  cylinder(root,.055,1.13,0x755a3c,0,1.2,0);
  for(let n=0;n<16;n++) {
    const a=n*2.399,r=.25+n%3*.08;
    const leaf=piece(root,leafGeometry,n%3===0?0x708f4e:0x365e43,Math.cos(a)*r,1.08+n%5*.16,Math.sin(a)*r);
    leaf.scale.set(.55,1.15,.8);leaf.rotation.z=Math.cos(a)*.7;
  }
  return root;
}
export function addPremiumWallArt(root:T.Group,x:number,z:number) {
  const side=x<0?1:-1;
  block(root,.055,1.22,1,0xc1a063,x,1.69,z,0);
  block(root,.06,1.1,.88,0xe4dbc5,x+side*.04,1.69,z,0);
  const motif=piece(root,artGeometry,0x6e8c6b,x+side*.077,1.71,z);
  motif.rotation.y=side*Math.PI/2;
}
