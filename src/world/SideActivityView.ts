import * as THREE from 'three';
import { ITEMS, type ItemId } from '../data/items';
import { localeTag, tr } from '../core/I18n';
import { formatMoney } from '../core/MathUtils';
import { createProductMesh, disposeInstancedIn } from './ProductMesh';
import { box, mat, mesh, sph } from './Materials';

export interface SideActivityViewSnapshot {
  id: 'garden' | 'courtyard';
  level: number;
  completed: number;
  order: number;
  phase: 'locked' | 'waiting' | 'delivery' | 'packing' | 'cleaning';
  lines: readonly { item: ItemId; quantity: number; delivered: number }[];
  workProgress: number;
  cleanProgress: number;
  reward: number;
  bonus: number;
  purchaseDeposit: number;
  nextCost: number;
  purchaseRemaining: number;
  manualSeconds: number;
  autoSeconds: number;
  /** Host reports a full tray so the action hint can explain blocked preparation. */
  blockedByCarry?: boolean;
}

export interface SideActivityView {
  root: THREE.Group;
  update(snapshot: SideActivityViewSnapshot, near: boolean, cameraQuat: THREE.Quaternion): void;
  dispose(): void;
}

const WIDTH = 512;
const HEIGHT = 256;
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function fitText(ctx: CanvasRenderingContext2D, value: string, width: number): string {
  if (ctx.measureText(value).width <= width) return value;
  let text = value;
  while (text.length > 1 && ctx.measureText(text + '…').width > width) text = text.slice(0, -1);
  return text + '…';
}

/** Small authored silhouettes use the same product colours as the carried models. */
function drawProduct(ctx: CanvasRenderingContext2D, item: ItemId, x: number, y: number): void {
  const def = ITEMS[item];
  const color = '#' + def.color.toString(16).padStart(6, '0');
  const accent = '#' + def.accent.toString(16).padStart(6, '0');
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#e6decc';
  ctx.beginPath(); ctx.ellipse(0, 15, 21, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#4b594b';
  if (item === 'tost') {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-18, 10); ctx.lineTo(1, -19); ctx.lineTo(20, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = accent;
    rounded(ctx, -16, 8, 33, 5, 2); ctx.fill();
    ctx.strokeStyle = '#b07c45';
    ctx.beginPath(); ctx.moveTo(-6, 1); ctx.lineTo(1, -10); ctx.moveTo(1, 5); ctx.lineTo(6, -3); ctx.stroke();
  } else if (item === 'waffle') {
    ctx.fillStyle = color;
    rounded(ctx, -20, -17, 40, 32, 5); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#c6944e'; ctx.lineWidth = 2;
    for (let i = -11; i <= 11; i += 11) {
      ctx.beginPath(); ctx.moveTo(i, -14); ctx.lineTo(i, 12); ctx.stroke();
    }
    for (let j = -8; j <= 7; j += 8) {
      ctx.beginPath(); ctx.moveTo(-17, j); ctx.lineTo(17, j); ctx.stroke();
    }
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.ellipse(5, -5, 6, 4, -.5, 0, Math.PI * 2); ctx.fill();
  } else if (item === 'dondurma') {
    ctx.fillStyle = '#c58b53';
    ctx.beginPath(); ctx.moveTo(-13, -1); ctx.lineTo(0, 20); ctx.lineTo(13, -1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(-5, -9, 11, 0, Math.PI * 2); ctx.arc(7, -11, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(4, -12, 5, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = '#fff9ed';
    ctx.beginPath(); ctx.moveTo(-17, -14); ctx.lineTo(-12, 15); ctx.quadraticCurveTo(0, 20, 12, 15); ctx.lineTo(17, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (item === 'cay' || item === 'latte') {
      ctx.beginPath(); ctx.ellipse(18, -1, 8, 10, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    }
    ctx.fillStyle = item === 'latte' ? accent : color;
    ctx.beginPath(); ctx.ellipse(0, -13, 16, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (item !== 'cay' && item !== 'latte') {
      ctx.strokeStyle = accent; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(5, -11); ctx.lineTo(9, -26); ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Physical work sits on SideGardens' prep board (top y=1.102). The parent view
 * is placed at floor y=.1, so this local frame compensates that floor offset.
 * Product variants are created only when first needed, then reused across orders.
 */
function createWorktopContents(id: 'garden' | 'courtyard') {
  const root = new THREE.Group();
  root.name = 'sideActivityContents';
  root.userData.displayedProducts = 0;
  root.position.y = -0.1;
  root.rotation.y = id === 'garden' ? Math.PI / 2 : -Math.PI / 2;
  const pools = new Map<ItemId, THREE.Group[]>();
  const active: THREE.Group[] = [];
  const slots = [
    [-0.475, -0.025], [-0.125, -0.025],
    [-0.475, 0.18], [-0.125, 0.18],
  ] as const;
  const bounds = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  let contentsKey = '';

  const parcel = new THREE.Group();
  parcel.name = 'sideOrderParcel';
  parcel.position.set(-0.3, 1.105, 0.075);
  const kraft = mesh(box(0.62, 0.22, 0.43), mat(0xc49765, { rough: 0.88 }), 0, 0.11, 0);
  const seal = mesh(box(0.075, 0.008, 0.438), mat(0x426951, { rough: 0.82 }), 0, 0.224, 0);
  const ticket = mesh(box(0.17, 0.009, 0.115), mat(0xf3e7c9, { rough: 0.95 }), 0.175, 0.226, 0.062);
  for (const part of [kraft, seal, ticket]) { part.castShadow = false; parcel.add(part); }
  parcel.visible = false;
  root.add(parcel);

  const usedPaper = new THREE.Group();
  usedPaper.name = 'sideUsedNapkin';
  usedPaper.position.set(0.35, 1.057, 0.21);
  const paper = mesh(sph(0.09, 5, 4), mat(0xf3e8cf, { rough: 1, flatShading: true }), 0, 0.028, 0);
  paper.scale.set(1.13, 0.34, 0.88);
  paper.rotation.set(0.1, 0.6, 0.13);
  paper.castShadow = false;
  const fold = mesh(box(0.135, 0.007, 0.11), mat(0xe9dcc2, { rough: 1 }), 0.018, 0.017, 0.028);
  fold.rotation.set(0.19, 0.48, -0.16);
  fold.castShadow = false;
  usedPaper.add(paper, fold);
  usedPaper.visible = false;
  root.add(usedPaper);

  const product = (item: ItemId, index: number): THREE.Group => {
    let pool = pools.get(item);
    if (!pool) { pool = []; pools.set(item, pool); }
    if (pool[index]) return pool[index];
    const goods = createProductMesh(item);
    goods.updateMatrixWorld(true);
    bounds.setFromObject(goods);
    bounds.getSize(size);
    bounds.getCenter(center);
    const scale = Math.min(0.255 / Math.max(0.001, size.x), 0.3 / Math.max(0.001, size.y), 0.195 / Math.max(0.001, size.z));
    const holder = new THREE.Group();
    holder.name = 'sideDelivered:' + item;
    holder.userData.itemId = item;
    goods.scale.multiplyScalar(scale);
    goods.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    goods.traverse(object => { object.castShadow = false; object.receiveShadow = true; });
    holder.add(goods);
    holder.visible = false;
    root.add(holder);
    pool[index] = holder;
    return holder;
  };

  return {
    root,
    update(s: SideActivityViewSnapshot) {
      root.visible = s.level > 0;
      const displayingProducts = s.phase === 'delivery' || (s.phase === 'packing' && s.workProgress < 0.72);
      const key = displayingProducts
        ? s.lines.map(line => line.item + ':' + line.delivered).join('|')
        : '';
      if (key !== contentsKey) {
        contentsKey = key;
        for (const goods of active) goods.visible = false;
        active.length = 0;
        if (displayingProducts) {
          for (const line of s.lines) {
            const count = Math.min(line.delivered, slots.length - active.length);
            for (let i = 0; i < count; i++) {
              const goods = product(line.item, i);
              const slot = slots[active.length];
              goods.position.set(slot[0], 1.104, slot[1]);
              goods.visible = true;
              active.push(goods);
            }
          }
        }
        root.userData.displayedProducts = active.length;
      }
      const packingParcel = s.phase === 'packing' && s.workProgress >= 0.72;
      parcel.visible = packingParcel || (s.phase === 'cleaning' && s.cleanProgress < 0.25);
      parcel.scale.y = packingParcel ? 0.18 + 0.82 * clamp((s.workProgress - 0.72) / 0.28) : 1;
      seal.scale.z = packingParcel ? Math.max(0.05, clamp((s.workProgress - 0.78) / 0.22)) : 1;
      usedPaper.visible = s.phase === 'cleaning';
      const paperScale = Math.max(0.04, 1 - clamp(s.cleanProgress));
      usedPaper.scale.setScalar(paperScale);
    },
    dispose() {
      for (const pool of pools.values()) for (const goods of pool) disposeInstancedIn(goods);
      pools.clear();
      active.length = 0;
      root.removeFromParent();
    },
  };
}

/**
 * One small board per business. Canvas, texture, mesh and progress bar are reused;
 * delivery counts and visible progress changes are the only texture invalidations.
 */
export function createSideActivityView(
  id: 'garden' | 'courtyard',
  title: string,
  color: number,
): SideActivityView {
  const root = new THREE.Group();
  root.name = 'sideActivity:' + id;
  const contents = createWorktopContents(id);
  root.add(contents.root);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
  });
  const geometry = new THREE.PlaneGeometry(2.6, 1.3);
  const board = new THREE.Mesh(geometry, material);
  board.name = 'sideActivityBoard';
  // Above the rear edge: the card must never sit over the operator's face or tray.
  board.position.set(id === 'courtyard' ? -0.25 : 0.25, 2.72, -0.38);
  board.castShadow = false;
  board.receiveShadow = false;
  board.renderOrder = 8;
  root.add(board);
  let signature = '';
  let disposed = false;
  const accent = '#' + color.toString(16).padStart(6, '0');
  const money = (value: number) => '₺' + formatMoney(Math.max(0, Math.round(value)));

  const paint = (s: SideActivityViewSnapshot, near: boolean) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (!near) {
      // Distant work reads as one compact sign; recipe detail opens on approach.
      ctx.fillStyle = '#f4efe1';
      rounded(ctx, 3, 3, 506, 113, 17); ctx.fill();
      ctx.strokeStyle = '#829485'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = accent; rounded(ctx, 5, 5, 502, 44, 14); ctx.fill();
      ctx.fillRect(5, 31, 502, 18);
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillStyle = '#fbf5e5'; ctx.font = '800 27px system-ui, sans-serif';
      ctx.fillText(fitText(ctx, title, 468), 22, 27);
      const missing = s.lines.filter(line => line.delivered < line.quantity);
      const summary = s.phase === 'delivery' ? missing.map(line => ITEMS[line.item].name + ' ×' + (line.quantity - line.delivered)).join(' · ')
        : s.phase === 'packing' ? tr('Paketi hazırla')
        : s.phase === 'cleaning' ? tr('Tezgâhı toparla')
        : s.phase === 'waiting' ? tr('Ürün istasyonu aç') : tr('Yeni bir servis alanı');
      const reward = s.phase === 'delivery' || s.phase === 'packing' ? '+' + money(s.reward + s.bonus) : '';
      ctx.font = '800 25px system-ui, sans-serif';
      const rewardWidth = ctx.measureText(reward).width;
      ctx.fillStyle = '#29483d'; ctx.textAlign = 'right'; ctx.fillText(reward, 488, 78);
      ctx.textAlign = 'left'; ctx.font = '700 23px system-ui, sans-serif';
      ctx.fillText(fitText(ctx, summary, 452 - rewardWidth), 24, 78);
      ctx.fillStyle = '#f4efe1'; ctx.beginPath(); ctx.moveTo(246, 115); ctx.lineTo(266, 115); ctx.lineTo(256, 126); ctx.closePath(); ctx.fill();
      texture.needsUpdate = true;
      return;
    }
    ctx.fillStyle = '#f4efe1';
    rounded(ctx, 3, 3, 506, 241, 22); ctx.fill();
    ctx.strokeStyle = near ? '#e7ba62' : '#829485';
    ctx.lineWidth = near ? 5 : 3; ctx.stroke();
    ctx.save();
    rounded(ctx, 5, 5, 502, 238, 20); ctx.clip();
    ctx.fillStyle = accent; ctx.fillRect(5, 5, 502, 57);
    ctx.fillStyle = '#fbf5e5';
    ctx.textBaseline = 'middle';
    const levelText = s.level > 0 ? tr("Sv. {0}", s.level) : tr("YENİ");
    const headerMeta = s.level >= 4 ? levelText + ' · ' + tr("Seri: {0}/3", s.completed % 3) : levelText;
    ctx.textAlign = 'right'; ctx.font = '750 20px system-ui, sans-serif';
    const metaWidth = ctx.measureText(headerMeta).width;
    ctx.fillText(headerMeta, 488, 34);
    ctx.textAlign = 'left'; ctx.font = '800 28px system-ui, sans-serif';
    ctx.fillText(fitText(ctx, title, Math.min(340, 452 - metaWidth)), 22, 34);

    if (s.phase === 'locked') {
      ctx.fillStyle = '#28493d'; ctx.font = '800 28px system-ui, sans-serif';
      ctx.fillText(tr("Yeni bir servis alanı"), 24, 106);
      ctx.fillStyle = '#687162'; ctx.font = '600 21px system-ui, sans-serif';
      ctx.fillText(tr("Yanındaki karede aç"), 24, 148);
    } else if (s.phase === 'waiting') {
      ctx.fillStyle = '#28493d'; ctx.font = '800 28px system-ui, sans-serif';
      ctx.fillText(tr("Ürün istasyonu aç"), 24, 106);
      ctx.fillStyle = '#687162'; ctx.font = '600 21px system-ui, sans-serif';
      ctx.fillText(tr("Menü açılınca sipariş gelir"), 24, 148);
    } else if (s.phase === 'delivery') {
      const lines = s.lines.slice(0, 3);
      const width = 464 / Math.max(1, lines.length);
      lines.forEach((line, i) => {
        const left = 24 + i * width;
        const done = line.delivered >= line.quantity;
        ctx.fillStyle = done ? '#e0eddb' : '#ebe5d8';
        rounded(ctx, left, 77, width - 8, 94, 12); ctx.fill();
        drawProduct(ctx, line.item, left + 29, 107);
        ctx.textAlign = 'left'; ctx.fillStyle = '#264436';
        ctx.font = '800 27px system-ui, sans-serif';
        ctx.fillText(line.delivered + '/' + line.quantity, left + 58, 108);
        ctx.font = '700 18px system-ui, sans-serif';
        ctx.fillText(fitText(ctx, ITEMS[line.item].name, width - 22), left + 11, 152);
      });
    } else {
      const cleaning = s.phase === 'cleaning';
      const progress = cleaning ? s.cleanProgress : s.workProgress;
      ctx.fillStyle = '#29483d'; ctx.font = '800 31px system-ui, sans-serif';
      ctx.fillText(cleaning ? tr("Tezgâhı temizle") : tr("Siparişi hazırla"), 24, 104);
      ctx.fillStyle = near && s.blockedByCarry ? '#9c6039' : '#687162';
      ctx.font = '600 21px system-ui, sans-serif';
      ctx.fillText(near && s.blockedByCarry ? tr("Önce tepsiyi boşalt") : tr("Tezgâhın yanında bekle"), 24, 148);
      ctx.fillStyle = '#ddd7c8'; rounded(ctx, 24, 165, 464, 7, 3); ctx.fill();
      ctx.fillStyle = accent; rounded(ctx, 24, 165, Math.max(1, 464 * clamp(progress)), 7, 3); ctx.fill();
    }

    ctx.fillStyle = '#e4ddcb'; ctx.fillRect(20, 185, 472, 1);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = '#637060'; ctx.font = '700 20px system-ui, sans-serif';
    const status = s.phase === 'delivery' ? tr("Ürünleri getir")
      : s.phase === 'cleaning' ? tr("Yeni siparişe yer aç")
      : s.phase === 'packing' ? (s.autoSeconds > 0 ? tr("Yanında dur · daha hızlı hazırla") : tr("Yanında dur · hazırla"))
      : s.phase === 'waiting' ? tr("Kafede üretime başla")
      : tr("Karede bekle · para yatır");
    ctx.fillText(fitText(ctx, status, 320), 24, 214);
    ctx.textAlign = 'right'; ctx.fillStyle = '#284c3b'; ctx.font = '850 28px system-ui, sans-serif';
    const reward = s.phase === 'cleaning' || s.phase === 'waiting' ? '' : s.phase === 'locked'
      ? money(s.purchaseRemaining || s.nextCost)
      : '+' + money(s.reward + s.bonus);
    ctx.fillText(reward, 488, 214);
    ctx.restore();
    // A short pointer anchors the board to this workbench, never to a customer.
    ctx.fillStyle = '#f4efe1';
    ctx.beginPath(); ctx.moveTo(246, 242); ctx.lineTo(266, 242); ctx.lineTo(256, 253); ctx.closePath(); ctx.fill();
    texture.needsUpdate = true;
  };

  return {
    root,
    update(snapshot, near, cameraQuat) {
      if (disposed) return;
      board.quaternion.copy(cameraQuat);
      board.scale.set(near ? 1 : 0.9, near ? 1 : 0.5, 1);
      board.position.y = near ? 2.72 : 2.38;
      texture.repeat.set(1, near ? 1 : 0.5);
      texture.offset.set(0, near ? 0 : 0.5);
      contents.update(snapshot);
      const progress = Math.round(clamp(snapshot.phase === 'cleaning' ? snapshot.cleanProgress : snapshot.workProgress) * 50);
      const next = [snapshot.phase, snapshot.level, snapshot.completed, snapshot.order, snapshot.reward, snapshot.bonus,
        snapshot.purchaseRemaining, snapshot.nextCost, progress, near, snapshot.blockedByCarry === true, localeTag(),
        snapshot.lines.map((line) => line.item + ':' + line.delivered + '/' + line.quantity).join(',')].join('|');
      if (next === signature) return;
      signature = next;
      paint(snapshot, near);
      root.userData.phase = snapshot.phase;
      root.userData.level = snapshot.level;
      root.userData.reward = snapshot.reward + snapshot.bonus;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      contents.dispose();
      root.removeFromParent();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}

