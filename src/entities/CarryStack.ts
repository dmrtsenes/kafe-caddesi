import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { isProduct, isSupply, type ItemId } from '../data/items';
import { TRAY_BOUNCE_DURATION, trayBounceEnvelope } from '../chars/ServiceArms';
import { createProductMesh, disposeInstancedIn } from '../world/ProductMesh';
import { markDynamic } from '../world/layers';
import { box, cyl, detail, mat, roundBox } from '../world/Materials';

/** One shared, three-draw-call carrier per size, reused by the whole staff. */
const trayGeometryCache = new Map<string, readonly THREE.BufferGeometry[]>();

function roundedOutline(path: THREE.Path, width: number, depth: number, radius: number): void {
  const x = width / 2, z = depth / 2, r = Math.min(radius, x, z);
  path.moveTo(-x + r, -z);
  path.lineTo(x - r, -z);
  path.quadraticCurveTo(x, -z, x, -z + r);
  path.lineTo(x, z - r);
  path.quadraticCurveTo(x, z, x - r, z);
  path.lineTo(-x + r, z);
  path.quadraticCurveTo(-x, z, -x, z - r);
  path.lineTo(-x, -z + r);
  path.quadraticCurveTo(-x, -z, -x + r, -z);
  path.closePath();
}

/** A real rounded rectangle: its corner radius does not shrink with its height. */
function traySlab(width: number, depth: number, radius: number, bottom: number,
  height: number, rim = 0): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  roundedOutline(shape, width, depth, radius);
  if (rim > 0) {
    const hole = new THREE.Path();
    roundedOutline(hole, width - rim * 2, depth - rim * 2, Math.max(0.012, radius - rim));
    shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height, steps: 1, curveSegments: 3, bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bottom, 0);
  return geometry;
}

function mergeTrayParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // These are temporary copies; the three merged results are shared, never cloned per actor.
  const merged = mergeGeometries(parts.map((part) => part.index ? part.toNonIndexed() : part), false)!;
  for (const part of parts) part.dispose();
  merged.computeBoundingSphere();
  return merged;
}

function makeServiceTray(width: number, depth: number, handHeld = true): THREE.Group {
  const key = `${width}|${depth}|${handHeld}`;
  let geometries = trayGeometryCache.get(key);
  if (!geometries) {
    const wood = [traySlab(width, depth, 0.13, -0.032, 0.052),
      traySlab(width, depth, 0.13, 0.019, 0.061, 0.055)];
    const brass = [traySlab(width - 0.012, depth - 0.012, 0.124, 0.08, 0.009, 0.012)];
    if (handHeld) {
      // The hidden rear grip stays exactly across the existing two-palm anchor.
      wood.push(roundBox(0.7, 0.045, 0.1, 0.025, 1).clone().translate(0, -0.015, -0.385));
      for (const sign of [-1, 1]) {
        const handle = traySlab(0.108, 0.29, 0.045, 0.061, 0.026, 0.022);
        handle.translate(sign * (width / 2 + 0.017), 0, 0);
        brass.push(handle);
      }
    }
    geometries = [mergeTrayParts(wood),
      traySlab(width - 0.114, depth - 0.114, 0.074, 0.022, 0.018),
      mergeTrayParts(brass)];
    trayGeometryCache.set(key, geometries);
  }
  const tray = new THREE.Group();
  tray.name = handHeld ? 'walnutServiceTray' : 'walnutServiceShelf';
  const materials = [mat(0x96633f, { rough: 0.58 }),
    mat(0x234c41, { rough: 0.92 }), mat(0xc9a365, { rough: 0.36, metal: 0.55 })];
  for (let i = 0; i < geometries.length; i++) {
    const part = detail(geometries[i], materials[i]);
    part.name = ['walnutFrame', 'nonslipLiner', 'brassRimAndHandles'][i];
    tray.add(part);
  }
  return tray;
}

/** Ürün mesh havuzu — sık alınıp bırakıldığı için yeniden kullanılır. */
const CART_UP = new THREE.Vector3(0, 1, 0);
const CART_X = new THREE.Vector3(1, 0, 0);
const pool = new Map<ItemId, THREE.Group[]>();

interface LocalProductBounds {
  minX: number;
  maxX: number;
  minY: number;
  minZ: number;
  maxZ: number;
  spanXZ: number;
}
const itemBoundsCache = new Map<string, LocalProductBounds>();
const _boundsBox = new THREE.Box3();
const _boundsSize = new THREE.Vector3();

function getProductBounds(item: ItemId, m: THREE.Group): LocalProductBounds {
  const childCount = m.children[0]?.children.length ?? 0;
  const key = `${item}:${childCount}`;
  let cached = itemBoundsCache.get(key);
  if (cached) return cached;
  const formerParent = m.parent;
  m.removeFromParent();
  const ox = m.position.x, oy = m.position.y, oz = m.position.z;
  m.position.set(0, 0, 0);
  m.scale.setScalar(1);
  m.rotation.set(0, 0, 0);
  m.updateMatrixWorld(true);
  _boundsBox.setFromObject(m);
  _boundsBox.getSize(_boundsSize);
  m.position.set(ox, oy, oz);
  formerParent?.add(m);
  cached = {
    minX: _boundsBox.min.x,
    maxX: _boundsBox.max.x,
    minY: _boundsBox.min.y,
    minZ: _boundsBox.min.z,
    maxZ: _boundsBox.max.z,
    spanXZ: Math.max(_boundsSize.x, _boundsSize.z, 0.01),
  };
  itemBoundsCache.set(key, cached);
  return cached;
}

function borrow(item: ItemId): THREE.Group {
  const list = pool.get(item);
  const m = list?.pop();
  if (m) return m;
  const wrap = new THREE.Group();
  wrap.name = 'carriedProduct';
  const product = createProductMesh(item);
  product.traverse((child) => {
    child.matrixAutoUpdate = false;
    child.updateMatrix();
  });
  wrap.add(product);
  markDynamic(wrap);
  return wrap;
}

function giveBack(item: ItemId, m: THREE.Group): void {
  m.removeFromParent();
  let list = pool.get(item);
  if (!list) {
    list = [];
    pool.set(item, list);
  }
  if (list.length < 24) list.push(m);
  else disposeInstancedIn(m);
}

// A single tray carries up to three individually spaced products.
const countBadgeCache = new Map<number, THREE.SpriteMaterial>();

function countBadgeMaterial(count: number): THREE.SpriteMaterial {
  let hit = countBadgeCache.get(count);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#e2703a';
    ctx.beginPath();
    ctx.arc(64, 64, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff7e8';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`×${count}`, 64, 65);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  hit = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  countBadgeCache.set(count, hit);
  return hit;
}

export const POP_SCALE_DURATION = 0.22;

/** Crisp 100% -> 142% -> 100% landing pop scale curve over t in [0, 1]. */
export function popScaleEnvelope(t: number): number {
  if (t <= 0 || t >= 1) return 1;
  const u = Math.pow(t, 0.65);
  return 1 + 0.42 * Math.sin(u * Math.PI);
}

/**
 * Karakterin taşıdığı kasa yığını. `carryAnchor`a bağlanır,
 * yürürken hafifçe sallanır — sayı arttıkça sallanma artar.
 */
export class CarryStack {
  readonly root = new THREE.Group();
  private readonly carryParent: THREE.Object3D;
  private readonly actorRoot: THREE.Object3D | null;
  private readonly smallTray = new THREE.Group();
  private readonly wideTray = new THREE.Group();
  private readonly cart = new THREE.Group();
  private readonly cartGrip = new THREE.Group();
  private readonly cartSupports: THREE.Object3D[] = [];
  private readonly gripAxis = new THREE.Vector3();
  private readonly gripBase = new THREE.Vector3();
  private readonly gripEnd = new THREE.Vector3();
  private readonly gripDirection = new THREE.Vector3();
  private readonly cartWheels: THREE.Object3D[] = [];
  private stage: 0 | 1 | 2 = 0;
  private meshes: THREE.Group[] = [];
  /** meshes[i] hangi ürünün kasası — havuza doğru iade için. */
  private slotItems: ItemId[] = [];
  private readonly slotBaseScales: number[] = [];
  private readonly slotBaseX: number[] = [];
  private readonly slotBaseZ: number[] = [];
  private readonly slotSurfaceY: number[] = [];
  private readonly slotCenterOffsetX: number[] = [];
  private readonly slotCenterOffsetZ: number[] = [];
  private readonly slotMinY: number[] = [];
  private readonly slotPopTimers: number[] = [];
  private t = 0;
  private wobble = 0;
  private totalCount = 0;
  private supplyOnly = false;
  private sourceItems: ItemId[] = [];
  private countBadge: THREE.Sprite | null = null;
  /** set() tek-tip API'sinin setSlots'a köprüsü için tampon. */
  private readonly scratch: ItemId[] = [];
  private bounceTime = 1;
  private bounceAmp = 0;
  private bouncePitchAmp = 0;

  constructor(parent: THREE.Object3D, actorRoot?: THREE.Object3D) {
    this.carryParent = parent;
    this.actorRoot = actorRoot ?? null;
    // Yığını göğüs hizasının biraz altına indir; baş ve omuzlar görünür kalsın.
    this.root.position.set(0, 0.025, 0.42);
    parent.add(this.root);

    this.root.name = 'serviceCarry';
    this.smallTray.add(makeServiceTray(1.04, 0.74));
    this.wideTray.add(makeServiceTray(1.3, 0.9));

    const cartMetal = mat(0xc9a365, { rough: 0.36, metal: 0.55 });
    this.cart.add(makeServiceTray(1.04, 0.94, false));
    const lowerShelf = makeServiceTray(0.96, 0.8, false);
    lowerShelf.position.y = -0.58;
    this.cart.add(lowerShelf);
    for (const x of [-0.46, 0.46]) {
      for (const z of [-0.32, 0.32]) this.cart.add(detail(box(0.045, 0.72, 0.045), cartMetal, x, -0.36, z));
    }
    this.cartGrip.name = 'cartGrip';
    const handle = detail(cyl(0.035, 0.035, 0.66, 10), cartMetal, 0, 0, 0);
    handle.rotation.z = Math.PI / 2;
    this.cartGrip.add(handle);
    this.cart.add(this.cartGrip);
    for (let i = 0; i < 2; i++) {
      const support = detail(cyl(0.024, 0.024, 1, 8), cartMetal, 0, 0, 0);
      this.cart.add(support);
      this.cartSupports.push(support);
    }
    const wheelGeo = cyl(0.085, 0.085, 0.045, 10);
    for (const x of [-0.34, 0.34]) for (const z of [-0.36, 0.36]) {
      const wheel = detail(wheelGeo, mat(0x252b30, { rough: 0.75 }), x, -0.75, z);
      wheel.rotation.z = Math.PI / 2;
      this.cart.add(wheel);
      this.cartWheels.push(wheel);
    }
    this.root.add(this.smallTray, this.wideTray, this.cart);
    markDynamic(this.root);
    this.syncCarrierVisibility();
  }

  get usesCart(): boolean {
    return this.stage === 2 && !this.supplyOnly;
  }

  setPresentationStage(level: number): void {
    const next: 0 | 1 | 2 = level >= 8 ? 2 : level >= 4 ? 1 : 0;
    if (next === this.stage) return;
    this.stage = next;
    this.setSlots(this.sourceItems);
    this.layoutMeshes();
    this.syncCarrierVisibility();
  }

  private syncCarrierVisibility(): void {
    const on = this.totalCount > 0 && !this.supplyOnly;
    this.smallTray.visible = on && this.stage === 0;
    this.wideTray.visible = on && this.stage === 1;
    this.cart.visible = on && this.stage === 2;
    this.attachCarrier(this.smallTray);
    this.attachCarrier(this.wideTray);
    this.attachCarrier(this.cart);
    const cartMode = this.usesCart && !!this.actorRoot;
    const targetParent = cartMode ? this.actorRoot! : this.carryParent;
    if (this.root.parent !== targetParent) {
      this.root.removeFromParent();
      targetParent.add(this.root);
    }
    const synced = !!this.carryParent.userData.trayBounceSynced;
    this.carryParent.userData.supplyCarry = this.supplyOnly && this.totalCount > 0;
    this.root.position.x = 0;
    this.root.position.z = cartMode ? 0.72 : this.supplyOnly ? (synced ? 0.04 : 0.24) : (synced ? 0.26 : 0.42);
    if (this.bounceTime >= 1) {
      this.root.position.y = cartMode ? 0.84 : this.supplyOnly ? -0.015 : 0.025;
    }
  }

  /**
   * Hidden carriers leave the graph: three still walks invisible children in
   * every matrix update, ~30 tray and cart nodes per staff member and guest.
   */
  private attachCarrier(carrier: THREE.Group): void {
    if (carrier.visible) {
      if (carrier.parent !== this.root) this.root.add(carrier);
    } else if (carrier.parent === this.root) this.root.remove(carrier);
  }

  private applySlotTransform(i: number): void {
    const m = this.meshes[i];
    const t = this.slotPopTimers[i] ?? 1;
    const pop = t < 1 ? popScaleEnvelope(t) : 1;
    const s = this.slotBaseScales[i] * pop;
    m.scale.setScalar(s);
    m.position.set(
      this.slotBaseX[i] - this.slotCenterOffsetX[i] * s,
      this.slotSurfaceY[i] - this.slotMinY[i] * s,
      this.slotBaseZ[i] - this.slotCenterOffsetZ[i] * s,
    );
  }

  private layoutMeshes(): void {
    const n = this.meshes.length;
    this.slotBaseScales.length = n;
    this.slotBaseX.length = n;
    this.slotBaseZ.length = n;
    this.slotSurfaceY.length = n;
    this.slotCenterOffsetX.length = n;
    this.slotCenterOffsetZ.length = n;
    this.slotMinY.length = n;
    for (let i = 0; i < n; i++) {
      const m = this.meshes[i];
      const item = this.slotItems[i];
      // Normalize real product footprints, then use separate triangular slots.
      m.rotation.set(0, 0, 0);
      const bounds = getProductBounds(item, m);
      const footprint = this.supplyOnly ? 0.32 : this.stage === 2 ? 0.24 : this.stage === 1 || n === 3 ? 0.29 : 0.32;
      const scale = Math.min(1.45, footprint / bounds.spanXZ);
      let x = 0;
      let z = 0;
      let surfaceY = this.supplyOnly ? i * 0.11 : 0.04;
      if (this.supplyOnly) {
        x = 0;
        z = 0;
      } else if (this.stage === 0 || n <= 3) {
        const spread = 0.23;
        x = n === 1 ? 0 : n === 2 ? (i ? spread : -spread) : i === 2 ? 0 : (i ? spread : -spread);
        z = n < 3 ? 0 : i === 2 ? -0.15 : 0.15;
      } else {
        const lower = this.stage === 2 && i >= 9;
        const slot = lower ? i - 9 : i;
        const layerCount = lower ? n - 9 : Math.min(n, this.stage === 2 ? 9 : 6);
        const row = Math.floor(slot / 3);
        const cols = Math.min(3, layerCount - row * 3), rows = Math.ceil(layerCount / 3);
        const spacing = this.stage === 2 ? 0.29 : 0.34;
        x = (slot % 3 - (cols - 1) / 2) * spacing;
        surfaceY = lower ? -0.54 : 0.04;
        z = (Math.floor(slot / 3) - (rows - 1) / 2) * (this.stage === 2 ? 0.28 : spacing);
      }
      this.slotBaseScales[i] = scale;
      this.slotBaseX[i] = x;
      this.slotBaseZ[i] = z;
      this.slotSurfaceY[i] = surfaceY;
      // Pack models can have off-center handles or saucers; center their actual
      // footprint, so mixed orders obey the same clearances as the fallback art.
      this.slotCenterOffsetX[i] = (bounds.minX + bounds.maxX) * 0.5;
      this.slotCenterOffsetZ[i] = (bounds.minZ + bounds.maxZ) * 0.5;
      this.slotMinY[i] = bounds.minY;
      this.applySlotTransform(i);
    }
    if (this.countBadge) this.countBadge.position.set(this.stage === 0 || this.supplyOnly ? 0.32 : 0.48, this.supplyOnly ? 0.34 : 0.38, 0.08);
  }


  fitCartGrip(midpoint: THREE.Vector3, span: THREE.Vector3): void {
    if (!this.usesCart || this.totalCount === 0) return;
    this.cartGrip.position.copy(midpoint).sub(this.root.position);
    const width = span.length();
    if (width < 0.001) return;
    this.gripAxis.copy(span).multiplyScalar(1 / width);
    this.cartGrip.quaternion.setFromUnitVectors(CART_X, this.gripAxis);
    this.cartGrip.scale.x = (width + 0.08) / 0.66;
    for (let i = 0; i < this.cartSupports.length; i++) {
      const sign = i === 0 ? -1 : 1;
      this.gripEnd.copy(this.cartGrip.position).addScaledVector(this.gripAxis, sign * (width + 0.04) * 0.5);
      this.gripBase.set(sign * 0.3, -0.02, -0.23);
      this.gripDirection.subVectors(this.gripEnd, this.gripBase);
      const length = this.gripDirection.length();
      const support = this.cartSupports[i];
      support.position.copy(this.gripBase).add(this.gripEnd).multiplyScalar(0.5);
      support.scale.y = length;
      support.quaternion.setFromUnitVectors(CART_UP, this.gripDirection.multiplyScalar(1 / Math.max(length, 0.001)));
    }
  }

  get count(): number {
    return this.totalCount;
  }

  /**
   * KARMA YIĞIN: her slot kendi ürününün kasasını çizer (1 çay + 2 tost).
   * Fark yoksa hiç dokunmaz; varsa yığını havuz üzerinden yeniden kurar —
   * kasalar havuzlandığı için bu, mesh üretmek değil yeniden ebeveynlemektir.
   */
  setSlots(items: readonly ItemId[]): void {
    // Carrier capacity grows visibly: three on the hand tray, six on the wide
    // tray, then fifteen on two cart shelves. The exact total remains readable.
    let nextSupplyOnly = items.length > 0;
    for (let i = 0; i < items.length; i++) {
      if (!isSupply(items[i]) || isProduct(items[i])) {
        nextSupplyOnly = false;
        break;
      }
    }
    const maxVisible = nextSupplyOnly ? 3 : this.stage === 2 ? 15 : this.stage === 1 ? 6 : 3;
    const visible = Math.min(items.length, maxVisible);
    const start = Math.max(0, items.length - visible);
    let same = visible === this.meshes.length && this.totalCount === items.length && nextSupplyOnly === this.supplyOnly;
    if (same) {
      for (let i = 0; i < visible; i++) {
        if (this.slotItems[i] !== items[start + i]) {
          same = false;
          break;
        }
      }
    }
    if (same) return;
    this.supplyOnly = nextSupplyOnly;
    if (items !== this.sourceItems) {
      this.sourceItems.length = 0;
      for (let i = 0; i < items.length; i++) this.sourceItems.push(items[i]);
    }

    const prevTotal = this.totalCount;
    const prevVisible = this.meshes.length;
    if (items.length === 0) {
      this.bounceTime = 1;
      this.bounceAmp = 0;
      this.bouncePitchAmp = 0;
      this.root.rotation.x = 0;
    } else if (items.length > prevTotal) {
      this.bounceAmp = -0.075;
      this.bouncePitchAmp = 0.088;
      this.bounceTime = 0;
    } else if (items.length < prevTotal) {
      this.bounceAmp = 0.055;
      this.bouncePitchAmp = -0.065;
      this.bounceTime = 0;
    }

    if (items.length > prevTotal) {
      const addedCount = items.length - prevTotal;
      const popStartSlot = Math.max(0, visible - addedCount);
      const shift = Math.max(0, prevVisible + addedCount - visible);
      for (let i = 0; i < visible; i++) {
        if (i >= popStartSlot) {
          this.slotPopTimers[i] = 0;
        } else {
          const prevIdx = i + shift;
          this.slotPopTimers[i] = prevIdx < prevVisible ? (this.slotPopTimers[prevIdx] ?? 1) : 1;
        }
      }
      this.slotPopTimers.length = visible;
    } else {
      this.slotPopTimers.length = visible;
      for (let i = 0; i < visible; i++) this.slotPopTimers[i] = 1;
    }

    for (let i = 0; i < this.meshes.length; i++) giveBack(this.slotItems[i], this.meshes[i]);
    this.meshes.length = 0;
    this.slotItems.length = 0;
    this.totalCount = items.length;

    for (let i = 0; i < visible; i++) {
      const item = items[start + i];
      const m = borrow(item);
      this.root.add(m);
      m.position.set(0, 0, 0);
      m.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.12 + i * 0.35;
      m.scale.setScalar(1);
      this.meshes.push(m);
      this.slotItems.push(item);
    }

    if (items.length > visible || this.usesCart && items.length > 3) {
      if (!this.countBadge) {
        this.countBadge = new THREE.Sprite(countBadgeMaterial(items.length));
        markDynamic(this.countBadge);
        this.countBadge.scale.set(0.44, 0.44, 1);
        this.root.add(this.countBadge);
      } else {
        this.countBadge.material = countBadgeMaterial(items.length);
      }
      this.countBadge.visible = true;
    } else if (this.countBadge) {
      this.countBadge.visible = false;
    }
    this.layoutMeshes();
    this.syncCarrierVisibility();
  }

  /** Eski tek-tip API — personel hâlâ tek tip taşır. */
  set(item: ItemId | null, count: number): void {
    this.scratch.length = 0;
    if (item) for (let i = 0; i < count; i++) this.scratch.push(item);
    this.setSlots(this.scratch);
  }

  clear(): void {
    this.setSlots([]);
  }

  /** speed01 salınım; actualSpeed tekerin zeminde aldığı gerçek yol. */
  update(dt: number, speed01: number, actualSpeed = speed01 * 4): void {
    const step = THREE.MathUtils.clamp(dt, 0, 0.05);
    let bounceEnv = 0;
    if (this.bounceTime < 1) {
      if (step > 0) this.bounceTime = Math.min(1, this.bounceTime + step / TRAY_BOUNCE_DURATION);
      bounceEnv = trayBounceEnvelope(this.bounceTime);
    }
    const cartMode = this.usesCart;
    const localBounceY = cartMode
      ? this.bounceAmp * 0.45 * bounceEnv
      : this.carryParent.userData.trayBounceSynced
        ? 0
        : this.bounceAmp * bounceEnv;
    const baseY = cartMode ? 0.84 : this.supplyOnly ? -0.015 : 0.025;
    this.root.position.y = baseY + localBounceY + (cartMode ? Math.sin(this.t * 0.72) * 0.006 * speed01 : 0);
    this.root.rotation.x = cartMode ? 0 : this.bouncePitchAmp * bounceEnv;

    if (this.meshes.length === 0) {
      return;
    }
    for (let i = 0; i < this.meshes.length; i++) {
      if (this.slotPopTimers[i] < 1 && step > 0) {
        this.slotPopTimers[i] = Math.min(1, this.slotPopTimers[i] + step / POP_SCALE_DURATION);
        this.applySlotTransform(i);
      }
    }
    this.t += dt * (3.4 + speed01 * 5.2);
    const load = Math.min(1, this.meshes.length / 6);
    this.wobble += (speed01 * load - this.wobble) * Math.min(1, dt * 6);
    if (cartMode) {
      // Arabada ürünler eldeki tepsi gibi yalpalamaz; yalnız tekerlekten gelen
      // çok hafif bir süspansiyon hareketi vardır.
      for (const m of this.meshes) {
        m.rotation.x += (0 - m.rotation.x) * Math.min(1, dt * 12);
        m.rotation.z += (0 - m.rotation.z) * Math.min(1, dt * 12);
      }
      for (const wheel of this.cartWheels) wheel.rotation.x -= (dt * actualSpeed) / 0.085;
    } else {
      const a = this.wobble * 0.035;
      for (let i = 0; i < this.meshes.length; i++) {
        const m = this.meshes[i];
        const f = (i + 1) / this.meshes.length;
        m.rotation.z = Math.sin(this.t + i * 0.55) * a * f;
        m.rotation.x = Math.cos(this.t * 0.83 + i * 0.4) * a * 0.55 * f;
      }
    }
  }

  dispose(): void {
    this.clear();
    this.sourceItems.length = 0;
    this.countBadge?.removeFromParent();
    this.countBadge = null;
    this.root.removeFromParent();
  }
}
