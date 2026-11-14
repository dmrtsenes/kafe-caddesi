import * as THREE from 'three';
import type { UiAdRewardKind } from '../ui/api';
import { box, cyl, detail, mat, plane, roundBox, sph, torus } from './Materials';

export const AD_SPOT_TRIGGER_RADIUS = 1.25;
export const AD_SPOT_DISMISS_RADIUS = 2.15;
export const AD_SPOT_ARM_TIME = 0.32;

const RING_SIZE = 160;
const RING_STEPS = 60;
const PLATE_W = 512;
const PLATE_H = 140;

export type AdSpotVariant = 'default' | 'urgent' | 'vip';
export type AdSpotKind = UiAdRewardKind;

export interface AdSpotView {
  readonly root: THREE.Group;
  show(
    x: number,
    y: number,
    z: number,
    labelText: string,
    variant?: AdSpotVariant,
    kind?: AdSpotKind,
  ): void;
  hide(): void;
  isVisible(): boolean;
  setCountdown(life01: number, arm01: number): void;
  update(dt: number, cameraQuat: THREE.Quaternion): void;
  dispose(): void;
}

export interface AdSpotCandidate {
  readonly x: number;
  readonly z: number;
  readonly zone?: string;
}

/**
 * Köşe ve Sahil şubeleri için açık koridor, salon, avlu ve açılmış odalara
 * yayılmış çoklu vitrin noktaları — her seferinde farklı bir konum seçilir.
 */
const KOSE_SPOTS: readonly AdSpotCandidate[] = [
  { x: -3.2, z: -1.6 },
  { x: 3.3, z: -1.5 },
  { x: -2.4, z: 2.2 },
  { x: 3.4, z: 1.9 },
  { x: -1.8, z: -6.5 },
  { x: 2.8, z: -6.5, zone: 'a3' },
  { x: -3.4, z: 5.7, zone: 't2' },
  { x: 2.5, z: 6.0, zone: 't3' },
  { x: 0.0, z: 11.8 },
  { x: -1.8, z: 14.8 },
  { x: 1.6, z: 15.4 },
  { x: 10.6, z: 14.8, zone: 'r1' },
  { x: -10.4, z: 14.8, zone: 'r2' },
];

const SAHIL_SPOTS: readonly AdSpotCandidate[] = [
  { x: 0.2, z: 1.6 },
  { x: -4.2, z: 1.6 },
  { x: -4.6, z: 5.4 },
  { x: -0.8, z: 5.8 },
  { x: 1.6, z: 8.4 },
  { x: -2.0, z: -3.4 },
  { x: 4.8, z: 4.8, zone: 'p3' },
  { x: 1.2, z: 9.6, zone: 'p4' },
];

export interface AdSpotWorldQuery {
  readonly loc: {
    readonly id: string;
    readonly zones: readonly { id: string; padX: number; padZ: number }[];
  };
  readonly nav: {
    isBlocked(x: number, z: number): boolean;
    solidBlocked(x: number, z: number, r: number): boolean;
  };
  zoneUnlocked(id: string): boolean;
  readonly bins?: readonly { locked: boolean; x: number; z: number }[];
  readonly vacuums?: readonly { locked: boolean; x: number; z: number }[];
  readonly spills?: { readonly list: readonly { x: number; z: number }[] };
  readonly grime?: { worstSpot(minVal: number): { x: number; z: number } | null };
}

export function adSpotCandidatesFor(locationId: string): readonly AdSpotCandidate[] {
  return locationId === 'sahil' ? SAHIL_SPOTS : KOSE_SPOTS;
}

export function adSpotPositionFor(
  locationId: string,
  exclude?: { x: number; z: number } | null,
): { x: number; z: number } {
  const pool = adSpotCandidatesFor(locationId).filter((c) => !c.zone);
  const filtered = exclude
    ? pool.filter((c) => Math.hypot(c.x - exclude.x, c.z - exclude.z) > 1.2)
    : pool;
  const pick = filtered[0] ?? pool[0] ?? { x: -3.2, z: -1.6 };
  return { x: pick.x, z: pick.z };
}

/**
 * Açık bölgeler, navigasyon engelleri, aktif satın alma pedleri, çöp/süpürge
 * istasyonları ve oyuncunun anlık konumunu denetleyerek dinamik vitrin noktası seçer.
 * Süpürge robotu teklifinde kirli/lekeli bölgelere yakın geçerli noktalar öncelik alır;
 * bir önceki konum arka arkaya tekrarlanmaz.
 */
export function pickAdSpotPosition(
  world: AdSpotWorldQuery,
  playerX: number,
  playerZ: number,
  kind: AdSpotKind,
  lastPos?: { x: number; z: number } | null,
  rng: () => number = Math.random,
): { x: number; z: number } {
  const rawPool = adSpotCandidatesFor(world.loc.id);
  const valid: AdSpotCandidate[] = [];

  for (let i = 0; i < rawPool.length; i++) {
    const c = rawPool[i];
    if (c.zone && !world.zoneUnlocked(c.zone)) continue;
    if (world.nav.isBlocked(c.x, c.z) || world.nav.solidBlocked(c.x, c.z, 0.44)) continue;

    // Oyuncunun tam ayağının altında doğup sürpriz popup açmasın
    if (Math.hypot(c.x - playerX, c.z - playerZ) < AD_SPOT_TRIGGER_RADIUS + 0.95) continue;

    // Çöp kutusu ve süpürge dolabından güvenli açıklık
    let nearStation = false;
    if (world.bins) {
      for (let j = 0; j < world.bins.length; j++) {
        const b = world.bins[j];
        if (!b.locked && Math.hypot(c.x - b.x, c.z - b.z) < 1.85) {
          nearStation = true;
          break;
        }
      }
    }
    if (!nearStation && world.vacuums) {
      for (let j = 0; j < world.vacuums.length; j++) {
        const v = world.vacuums[j];
        if (!v.locked && Math.hypot(c.x - v.x, c.z - v.z) < 1.95) {
          nearStation = true;
          break;
        }
      }
    }
    if (nearStation) continue;

    // Kilitli satın alma pedleriyle çakışmasın
    let nearLockedPad = false;
    for (let j = 0; j < world.loc.zones.length; j++) {
      const z = world.loc.zones[j];
      if (!world.zoneUnlocked(z.id) && Math.hypot(c.x - z.padX, c.z - z.padZ) < 2.15) {
        nearLockedPad = true;
        break;
      }
    }
    if (nearLockedPad) continue;

    valid.push(c);
  }

  let candidates = valid;
  if (lastPos && candidates.length > 1) {
    const nonRepeat = candidates.filter((c) => Math.hypot(c.x - lastPos.x, c.z - lastPos.z) > 1.2);
    if (nonRepeat.length > 0) candidates = nonRepeat;
  }

  if (candidates.length === 0) {
    return adSpotPositionFor(world.loc.id, lastPos);
  }

  // Süpürge robotu kirli bölgeye daha yakın olan ilk 3 geçerli noktadan seçilir
  if (kind === 'robot_vacuum') {
    let dirtX = Number.NaN;
    let dirtZ = Number.NaN;
    const spills = world.spills?.list;
    if (spills && spills.length > 0) {
      const sp = spills[Math.floor(rng() * spills.length) % spills.length];
      dirtX = sp.x;
      dirtZ = sp.z;
    } else {
      const grimeSpot = world.grime?.worstSpot(75);
      if (grimeSpot) {
        dirtX = grimeSpot.x;
        dirtZ = grimeSpot.z;
      }
    }
    if (Number.isFinite(dirtX) && Number.isFinite(dirtZ)) {
      const ranked = [...candidates].sort(
        (a, b) => Math.hypot(a.x - dirtX, a.z - dirtZ) - Math.hypot(b.x - dirtX, b.z - dirtZ),
      );
      const topCount = Math.min(3, ranked.length);
      const pick = ranked[Math.floor(rng() * topCount) % topCount];
      return { x: pick.x, z: pick.z };
    }
  }

  const idx = Math.floor(rng() * candidates.length) % candidates.length;
  return { x: candidates[idx].x, z: candidates[idx].z };
}

function variantColors(variant: AdSpotVariant): {
  frame: number;
  glow: number;
  hex: string;
  fill: string;
  innerFill: string;
} {
  if (variant === 'urgent') {
    return {
      frame: 0xff6b5b,
      glow: 0xffb36b,
      hex: '#ff7868',
      fill: 'rgba(255, 107, 91, 0.22)',
      innerFill: 'rgba(255, 179, 107, 0.14)',
    };
  }
  if (variant === 'vip') {
    return {
      frame: 0xffdf73,
      glow: 0xfff2b2,
      hex: '#ffd966',
      fill: 'rgba(255, 217, 102, 0.24)',
      innerFill: 'rgba(255, 244, 184, 0.16)',
    };
  }
  return {
    frame: 0xf5b942,
    glow: 0x58e0b8,
    hex: '#4fe3b8',
    fill: 'rgba(79, 227, 184, 0.20)',
    innerFill: 'rgba(245, 185, 66, 0.14)',
  };
}

function stripLeadingEmoji(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}%₺×+-]+\s*/u, '').trim();
}

function inferKind(labelText: string): AdSpotKind {
  const lower = labelText.toLowerCase();
  if (lower.includes('robot') || lower.includes('süpür')) return 'robot_vacuum';
  if (lower.includes('bölüm') || lower.includes('unlock') || lower.includes('zone')) return 'zone_finish';
  if (lower.includes('mutlu') || lower.includes('happy') || lower.includes('×2')) return 'happy_hour';
  if (lower.includes('usta') || lower.includes('vip') || lower.includes('master')) return 'usta_mode';
  if (lower.includes('akın') || lower.includes('rush')) return 'rush_hour';
  if (lower.includes('bahşiş') || lower.includes('tip')) return 'tip_rain';
  if (lower.includes('arıza') || lower.includes('sigorta') || lower.includes('repair')) return 'repair_shield';
  if (lower.includes('depo') || lower.includes('stock') || lower.includes('ödül')) return 'stock_refill';
  return 'cash_boost';
}

/** 3D tabela kanvasının soluna özel vektör sembol çizer (OS emojisi KULLANILMAZ). */
function drawPlateVectorIcon(
  ctx: CanvasRenderingContext2D,
  kind: AdSpotKind,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);

  // Yuvarlak rozet tabanı
  ctx.fillStyle = 'rgba(255, 214, 102, 0.16)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = 'rgba(255, 226, 138, 0.55)';
  ctx.stroke();

  if (kind === 'robot_vacuum') {
    // Yan fırça bıyıkları
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, -r * 0.42);
    ctx.lineTo(-r * 0.72, -r * 0.72);
    ctx.moveTo(r * 0.42, -r * 0.42);
    ctx.lineTo(r * 0.72, -r * 0.72);
    ctx.stroke();
    // Disk gövde
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, r * 0.04, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // LiDAR kubbe
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, r * 0.04, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'zone_finish') {
    // Altın anahtar
    ctx.strokeStyle = '#ffd463';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-r * 0.26, r * 0.18, r * 0.26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.06, -r * 0.02);
    ctx.lineTo(r * 0.48, -r * 0.48);
    ctx.moveTo(r * 0.24, -r * 0.26);
    ctx.lineTo(r * 0.42, -r * 0.08);
    ctx.moveTo(r * 0.42, -r * 0.42);
    ctx.lineTo(r * 0.58, -r * 0.24);
    ctx.stroke();
  } else if (kind === 'happy_hour') {
    ctx.fillStyle = '#ffd463';
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('2×', 0, 2);
  } else if (kind === 'cash_boost' || kind === 'investor' || kind === 'tip_rain') {
    ctx.fillStyle = '#34d399';
    ctx.strokeStyle = '#ecfdf5';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-r * 0.56, -r * 0.34, r * 1.12, r * 0.68, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fef3c7';
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₺', 0, 1);
  } else if (kind === 'repair_shield') {
    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#ffd463';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.58);
    ctx.lineTo(r * 0.48, -r * 0.36);
    ctx.lineTo(r * 0.44, r * 0.14);
    ctx.lineTo(0, r * 0.58);
    ctx.lineTo(-r * 0.44, r * 0.14);
    ctx.lineTo(-r * 0.48, -r * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Yıldırım / Yıldız takviye sembolü
    ctx.fillStyle = '#ffd463';
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.58);
    ctx.lineTo(-r * 0.38, r * 0.06);
    ctx.lineTo(r * 0.02, r * 0.06);
    ctx.lineTo(-r * 0.12, r * 0.58);
    ctx.lineTo(r * 0.4, -r * 0.06);
    ctx.lineTo(0, -r * 0.06);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export interface AdSpotOptions {
  groundRing?: boolean;
  showLabel?: boolean;
  scale?: number;
}

export function createAdSpotView(opts: AdSpotOptions = {}): AdSpotView {
  const root = new THREE.Group();
  root.name = 'adSpotBeacon';
  root.visible = false;
  const baseScale = opts.scale ?? 1;
  const useRing = opts.groundRing !== false;
  const useLabel = opts.showLabel !== false;

  const canUseDom = typeof document !== 'undefined';
  let ringTex: THREE.CanvasTexture | null = null;
  let ringMat: THREE.MeshBasicMaterial | null = null;
  let ringGeo: THREE.PlaneGeometry | null = null;
  let ctx: CanvasRenderingContext2D | null = null;

  if (canUseDom && useRing) {
    const cv = document.createElement('canvas');
    cv.width = RING_SIZE;
    cv.height = RING_SIZE;
    ctx = cv.getContext('2d');
    ringTex = new THREE.CanvasTexture(cv);
    ringTex.colorSpace = THREE.SRGBColorSpace;
    ringMat = new THREE.MeshBasicMaterial({
      map: ringTex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    ringGeo = new THREE.PlaneGeometry(2.15, 2.15);
    const groundDisc = new THREE.Mesh(ringGeo, ringMat);
    groundDisc.rotation.x = -Math.PI / 2;
    groundDisc.position.y = 0.028;
    groundDisc.renderOrder = 2;
    root.add(groundDisc);
  }

  // Paylaşımlı olmayan yalnız renk değişen çerçeve ve ışık materyalleri
  const frameMat = mat(0xf5b942, { rough: 0.25, metal: 0.42, emissive: 0xf5b942, emissiveIntensity: 0.34 }).clone();
  const glowPadMat = mat(0x1e3840, { rough: 0.22, emissive: 0x4fe3b8, emissiveIntensity: 0.65 }).clone();

  // Sabit malzeme paleti (Materials önbelleğinden — sıfır ekstra shader varyantı)
  const podiumDarkMat = mat(0x22313a, { rough: 0.45, metal: 0.25 });
  const goldMat = mat(0xffcf56, { rough: 0.24, metal: 0.48, emissive: 0xd99b26, emissiveIntensity: 0.28 });
  const creamMat = mat(0xf7efe0, { rough: 0.45 });
  const emeraldMat = mat(0x10b981, { rough: 0.3, emissive: 0x059669, emissiveIntensity: 0.35 });
  const vacBodyMat = mat(0x3a4754, { rough: 0.38, metal: 0.32 });
  const lidarGlowMat = mat(0x6fd6ff, { rough: 0.2, emissive: 0x38bdf8, emissiveIntensity: 1.35 });
  const leatherMat = mat(0x5a3821, { rough: 0.52 });
  const espressoMat = mat(0x4b2c1a, { rough: 0.4 });
  const silverMat = mat(0xdbe4ec, { rough: 0.28, metal: 0.55 });

  // 3D Vitrin Podyumu (zeminde şık kabartma kaide — düz 2 çizgi değil)
  const podiumGroup = new THREE.Group();
  if (useRing) {
    podiumGroup.add(detail(cyl(0.46, 0.54, 0.055, 20), podiumDarkMat, 0, 0.03, 0));
    podiumGroup.add(detail(cyl(0.36, 0.38, 0.064, 20), glowPadMat, 0, 0.036, 0));
    const bevel = detail(torus(0.48, 0.024, 8, 24), frameMat, 0, 0.055, 0);
    bevel.rotation.x = Math.PI / 2;
    podiumGroup.add(bevel);
    root.add(podiumGroup);
  }

  const totem = new THREE.Group();
  totem.position.y = useRing ? 0.84 : 0.58;
  root.add(totem);

  // Dış yörünge halkası + minik parıltı kristali
  const orbitRing = detail(torus(0.44, 0.015, 6, 24), frameMat, 0, 0, 0);
  orbitRing.rotation.x = 1.08;
  totem.add(orbitRing);
  const sparkA = detail(box(0.065, 0.065, 0.065), goldMat, 0.44, 0.08, 0);
  sparkA.rotation.set(Math.PI / 4, 0, Math.PI / 4);
  totem.add(sparkA);

  /* ================================================================ *
   *  ÖDÜLE ÖZEL 3D VİTRİN MODELLERİ (tek sefer kurulur, sıfır GC)
   * ================================================================ */
  const models = new Map<string, THREE.Group>();

  // 1. ROBOT SÜPÜRGE — gerçek 3D akıllı robot süpürge + döner yan fırçalar + LiDAR
  const vacGroup = new THREE.Group();
  const vacTilt = new THREE.Group();
  vacTilt.rotation.x = 0.34;
  vacGroup.add(vacTilt);
  vacTilt.add(detail(cyl(0.34, 0.36, 0.12, 20), vacBodyMat, 0, 0, 0));
  const vacBumper = detail(torus(0.345, 0.025, 8, 20), creamMat, 0, 0.01, 0);
  vacBumper.rotation.x = Math.PI / 2;
  vacTilt.add(vacBumper);
  vacTilt.add(detail(cyl(0.24, 0.25, 0.025, 16), podiumDarkMat, 0, 0.065, 0));
  vacTilt.add(detail(cyl(0.105, 0.12, 0.065, 14), creamMat, 0, 0.095, -0.02));
  vacTilt.add(detail(cyl(0.088, 0.088, 0.032, 12), lidarGlowMat, 0, 0.118, -0.02));
  vacTilt.add(detail(sph(0.042, 10, 8), lidarGlowMat, 0, 0.065, 0.26));
  const brushL = new THREE.Group();
  brushL.position.set(-0.22, -0.055, 0.22);
  brushL.add(detail(box(0.22, 0.014, 0.024), lidarGlowMat, 0, 0, 0));
  brushL.add(detail(box(0.024, 0.014, 0.22), lidarGlowMat, 0, 0, 0));
  vacTilt.add(brushL);
  const brushR = new THREE.Group();
  brushR.position.set(0.22, -0.055, 0.22);
  brushR.add(detail(box(0.22, 0.014, 0.024), lidarGlowMat, 0, 0, 0));
  brushR.add(detail(box(0.024, 0.014, 0.22), lidarGlowMat, 0, 0, 0));
  vacTilt.add(brushR);
  totem.add(vacGroup);
  models.set('robot_vacuum', vacGroup);

  // 2. BÖLÜM AÇILIŞI (zone_finish) — 3D Altın Mimari Anahtar + Zümrüt Taş
  const keyGroup = new THREE.Group();
  const keyTilt = new THREE.Group();
  keyTilt.rotation.z = -0.52;
  keyTilt.rotation.x = 0.22;
  keyGroup.add(keyTilt);
  const keyBow = detail(torus(0.145, 0.04, 8, 20), goldMat, 0, 0.17, 0);
  keyTilt.add(keyBow);
  keyTilt.add(detail(sph(0.062, 10, 8), emeraldMat, 0, 0.17, 0));
  keyTilt.add(detail(cyl(0.034, 0.034, 0.36, 10), goldMat, 0, -0.08, 0));
  keyTilt.add(detail(box(0.11, 0.044, 0.04), goldMat, 0.055, -0.17, 0));
  keyTilt.add(detail(box(0.085, 0.044, 0.04), goldMat, 0.042, -0.245, 0));
  totem.add(keyGroup);
  models.set('zone_finish', keyGroup);

  // 3. NAKİT DESTEĞİ / YATIRIMCI — 3D VIP Evrak Çantası + Zümrüt Banknotlar + Altın Sikkeler
  const cashGroup = new THREE.Group();
  cashGroup.add(detail(roundBox(0.42, 0.28, 0.13, 0.035, 2), leatherMat, 0, -0.03, -0.04));
  const bagHandle = detail(torus(0.075, 0.018, 6, 12), goldMat, 0, 0.13, -0.04);
  cashGroup.add(bagHandle);
  cashGroup.add(detail(box(0.055, 0.055, 0.145), goldMat, -0.1, 0.02, -0.04));
  cashGroup.add(detail(box(0.055, 0.055, 0.145), goldMat, 0.1, 0.02, -0.04));
  const billStack = new THREE.Group();
  billStack.position.set(0.02, -0.06, 0.1);
  billStack.rotation.y = 0.22;
  billStack.add(detail(box(0.28, 0.085, 0.15), emeraldMat, 0, 0, 0));
  billStack.add(detail(box(0.065, 0.09, 0.156), creamMat, 0, 0, 0));
  cashGroup.add(billStack);
  cashGroup.add(detail(cyl(0.072, 0.072, 0.036, 12), goldMat, -0.16, -0.1, 0.13));
  cashGroup.add(detail(cyl(0.072, 0.072, 0.036, 12), goldMat, -0.16, -0.058, 0.13));
  totem.add(cashGroup);
  models.set('cash_boost', cashGroup);
  models.set('investor', cashGroup);

  // 4. MUTLU SAAT (2× Gelir) — 3D Altın Kafe Fincanı & Tabağı + Parıltı Yıldızları
  const cupGroup = new THREE.Group();
  cupGroup.add(detail(cyl(0.26, 0.19, 0.036, 16), goldMat, 0, -0.14, 0));
  cupGroup.add(detail(cyl(0.185, 0.135, 0.23, 16), goldMat, 0, -0.01, 0));
  cupGroup.add(detail(cyl(0.165, 0.165, 0.02, 14), espressoMat, 0, 0.1, 0));
  const ear = detail(torus(0.078, 0.022, 6, 12), goldMat, 0.19, 0.0, 0);
  cupGroup.add(ear);
  const starGem = detail(box(0.09, 0.09, 0.09), emeraldMat, 0, 0.24, 0);
  starGem.rotation.set(Math.PI / 4, 0, Math.PI / 4);
  cupGroup.add(starGem);
  totem.add(cupGroup);
  models.set('happy_hour', cupGroup);

  // 5. USTA MODU — 3D Barista/Şef Tacı + Altın Yıldırım
  const ustaGroup = new THREE.Group();
  ustaGroup.add(detail(cyl(0.15, 0.14, 0.12, 14), creamMat, 0, -0.07, 0));
  ustaGroup.add(detail(cyl(0.155, 0.155, 0.04, 14), goldMat, 0, -0.12, 0));
  ustaGroup.add(detail(sph(0.115, 10, 8), creamMat, 0, 0.05, 0));
  ustaGroup.add(detail(sph(0.095, 10, 8), creamMat, -0.09, 0.03, 0.03));
  ustaGroup.add(detail(sph(0.095, 10, 8), creamMat, 0.09, 0.03, 0.03));
  const bolt = detail(box(0.07, 0.22, 0.04), goldMat, 0, -0.02, 0.16);
  bolt.rotation.z = -0.32;
  ustaGroup.add(bolt);
  totem.add(ustaGroup);
  models.set('usta_mode', ustaGroup);

  // 6. MÜŞTERİ AKINI — 3D Altın Servis Çanı
  const bellGroup = new THREE.Group();
  bellGroup.add(detail(cyl(0.25, 0.27, 0.045, 16), podiumDarkMat, 0, -0.11, 0));
  bellGroup.add(detail(sph(0.21, 14, 10), goldMat, 0, -0.08, 0));
  bellGroup.add(detail(cyl(0.035, 0.035, 0.05, 10), silverMat, 0, 0.14, 0));
  bellGroup.add(detail(cyl(0.075, 0.075, 0.025, 12), goldMat, 0, 0.165, 0));
  totem.add(bellGroup);
  models.set('rush_hour', bellGroup);

  // 7. BAHŞİŞ YAĞMURU — 3D Zümrüt Bahşiş Kavanozu + Süzülen Altın Sikkeler
  const tipGroup = new THREE.Group();
  tipGroup.add(detail(cyl(0.16, 0.145, 0.25, 14), emeraldMat, 0, -0.05, 0));
  tipGroup.add(detail(cyl(0.145, 0.145, 0.04, 14), goldMat, 0, 0.09, 0));
  tipGroup.add(detail(cyl(0.068, 0.068, 0.028, 12), goldMat, -0.06, 0.21, 0.02));
  tipGroup.add(detail(cyl(0.068, 0.068, 0.028, 12), goldMat, 0.07, 0.28, -0.02));
  totem.add(tipGroup);
  models.set('tip_rain', tipGroup);

  // 8. ARIZA SİGORTASI — 3D Altın/Zümrüt Koruma Kalkanı
  const shieldGroup = new THREE.Group();
  shieldGroup.add(detail(roundBox(0.35, 0.42, 0.08, 0.05, 2), goldMat, 0, 0, 0));
  shieldGroup.add(detail(roundBox(0.27, 0.34, 0.092, 0.04, 2), emeraldMat, 0, 0, 0));
  const wrenchBar = detail(box(0.06, 0.22, 0.105), silverMat, 0, 0, 0);
  wrenchBar.rotation.z = 0.45;
  shieldGroup.add(wrenchBar);
  totem.add(shieldGroup);
  models.set('repair_shield', shieldGroup);

  // 9. DEPO / GÜNLÜK ÖDÜL — 3D Kurdeleli Hediye Sandığı
  const giftGroup = new THREE.Group();
  giftGroup.add(detail(roundBox(0.32, 0.28, 0.32, 0.035, 2), leatherMat, 0, -0.02, 0));
  giftGroup.add(detail(box(0.335, 0.29, 0.065), goldMat, 0, -0.02, 0));
  giftGroup.add(detail(box(0.065, 0.29, 0.335), goldMat, 0, -0.02, 0));
  const bowL = detail(torus(0.065, 0.018, 6, 12), goldMat, -0.055, 0.16, 0);
  bowL.rotation.z = 0.4;
  giftGroup.add(bowL);
  const bowR = detail(torus(0.065, 0.018, 6, 12), goldMat, 0.055, 0.16, 0);
  bowR.rotation.z = -0.4;
  giftGroup.add(bowR);
  totem.add(giftGroup);
  models.set('stock_refill', giftGroup);
  models.set('daily_double', giftGroup);

  // Özel vektör-rozetli 3D yüzen isim plakası
  const labelHolder = new THREE.Group();
  labelHolder.position.y = 1.56;
  root.add(labelHolder);

  let plateTex: THREE.CanvasTexture | null = null;
  let plateMat: THREE.MeshBasicMaterial | null = null;
  let plateCtx: CanvasRenderingContext2D | null = null;
  let plateMesh: THREE.Mesh | null = null;

  if (canUseDom && useLabel) {
    const cv = document.createElement('canvas');
    cv.width = PLATE_W;
    cv.height = PLATE_H;
    plateCtx = cv.getContext('2d');
    plateTex = new THREE.CanvasTexture(cv);
    plateTex.colorSpace = THREE.SRGBColorSpace;
    plateTex.anisotropy = 4;
    plateMat = new THREE.MeshBasicMaterial({
      map: plateTex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    plateMesh = new THREE.Mesh(plane(2.28, 0.62), plateMat);
    plateMesh.renderOrder = 12;
    labelHolder.add(plateMesh);
  }

  let curVariant: AdSpotVariant = 'default';
  let curKind: AdSpotKind = 'cash_boost';
  let lastLifeStep = -1;
  let lastArmStep = -1;
  let lastPaintedVariant: AdSpotVariant | '' = '';
  let lastLabelSig = '';
  let curArm01 = 0;
  let animT = 0;

  function paintPlate(rawLabel: string, kind: AdSpotKind, variant: AdSpotVariant): void {
    if (!plateCtx || !plateTex || !plateMesh) return;
    const clean = stripLeadingEmoji(rawLabel);
    if (!clean) {
      plateMesh.visible = false;
      return;
    }
    plateMesh.visible = true;
    const vc = variantColors(variant);
    plateCtx.clearRect(0, 0, PLATE_W, PLATE_H);

    const pad = 10;
    const w = PLATE_W - pad * 2;
    const h = PLATE_H - pad * 2;
    const r = h / 2;

    const grad = plateCtx.createLinearGradient(0, pad, 0, pad + h);
    grad.addColorStop(0, 'rgba(30, 47, 57, 0.96)');
    grad.addColorStop(1, 'rgba(15, 25, 32, 0.96)');
    plateCtx.fillStyle = grad;
    plateCtx.beginPath();
    plateCtx.roundRect(pad, pad, w, h, r);
    plateCtx.fill();

    plateCtx.lineWidth = 4.5;
    plateCtx.strokeStyle = vc.hex;
    plateCtx.stroke();

    const iconR = 38;
    const iconX = pad + 56;
    const iconY = PLATE_H / 2;
    drawPlateVectorIcon(plateCtx, kind, iconX, iconY, iconR);

    const textLeft = iconX + iconR + 18;
    const textMaxW = PLATE_W - pad - 26 - textLeft;
    const face = 'system-ui, "Segoe UI", sans-serif';
    let px = 42;
    plateCtx.font = `900 ${px}px ${face}`;
    const measured = plateCtx.measureText(clean).width;
    if (measured > textMaxW && measured > 0) {
      px = Math.max(24, Math.floor((px * textMaxW) / measured));
      plateCtx.font = `900 ${px}px ${face}`;
    }
    plateCtx.textAlign = 'left';
    plateCtx.textBaseline = 'middle';
    plateCtx.fillStyle = '#fff8e1';
    plateCtx.fillText(clean, textLeft, PLATE_H / 2 + 2, textMaxW);

    plateTex.needsUpdate = true;
  }

  function paintGround(lifeStep: number, armStep: number, variant: AdSpotVariant): void {
    if (!ctx || !ringTex) return;
    const c = RING_SIZE / 2;
    const outerR = RING_SIZE * 0.44;
    const innerR = RING_SIZE * 0.34;
    const vc = variantColors(variant);

    ctx.clearRect(0, 0, RING_SIZE, RING_SIZE);

    // Yumuşak radyal sahne spot ışığı halesi
    const halo = ctx.createRadialGradient(c, c, RING_SIZE * 0.12, c, c, RING_SIZE * 0.49);
    halo.addColorStop(0, vc.innerFill);
    halo.addColorStop(0.68, vc.fill);
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(c, c, RING_SIZE * 0.49, 0, Math.PI * 2);
    ctx.fill();

    // Kesikli ince dış kadran izi
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = RING_SIZE * 0.025;
    ctx.beginPath();
    ctx.arc(c, c, outerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Kalan ömür yayı
    if (lifeStep > 0) {
      ctx.strokeStyle = vc.hex;
      ctx.lineWidth = RING_SIZE * 0.048;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(c, c, outerR, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * lifeStep) / RING_STEPS);
      ctx.stroke();
    }

    // Oyuncu üzerinde dururken dolan altın aktivasyon halkası
    if (armStep > 0) {
      ctx.strokeStyle = '#ffe58f';
      ctx.lineWidth = RING_SIZE * 0.062;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(c, c, innerR, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * armStep) / RING_STEPS);
      ctx.stroke();
    }

    ringTex.needsUpdate = true;
  }

  function applyKindAndVariant(kind: AdSpotKind, variant: AdSpotVariant): void {
    curKind = kind;
    curVariant = variant;
    const vc = variantColors(variant);
    frameMat.color.setHex(vc.frame);
    frameMat.emissive.setHex(vc.frame);
    glowPadMat.emissive.setHex(vc.glow);

    const activeGroup = models.get(kind) ?? cashGroup;
    for (const grp of new Set(models.values())) {
      grp.visible = grp === activeGroup;
    }
  }

  return {
    root,
    show(
      x: number,
      y: number,
      z: number,
      labelText: string,
      variant: AdSpotVariant = 'default',
      kind?: AdSpotKind,
    ): void {
      const resolvedKind = kind ?? inferKind(labelText);
      root.position.set(x, y, z);
      if (variant !== curVariant || resolvedKind !== curKind || !root.visible) {
        applyKindAndVariant(resolvedKind, variant);
      }
      const sig = `${resolvedKind}|${variant}|${labelText}`;
      if (sig !== lastLabelSig) {
        lastLabelSig = sig;
        paintPlate(labelText, resolvedKind, variant);
      }
      if (!root.visible) {
        animT = 0;
        root.visible = true;
      }
      this.setCountdown(1, 0);
    },
    hide(): void {
      if (!root.visible) return;
      root.visible = false;
      curArm01 = 0;
      lastLifeStep = -1;
      lastArmStep = -1;
    },
    isVisible(): boolean {
      return root.visible;
    },
    setCountdown(life01: number, arm01: number): void {
      const clampedLife = Math.max(0, Math.min(1, life01));
      const clampedArm = Math.max(0, Math.min(1, arm01));
      curArm01 = clampedArm;
      const lifeStep = Math.round(clampedLife * RING_STEPS);
      const armStep = Math.round(clampedArm * RING_STEPS);
      if (lifeStep !== lastLifeStep || armStep !== lastArmStep || curVariant !== lastPaintedVariant) {
        lastLifeStep = lifeStep;
        lastArmStep = armStep;
        lastPaintedVariant = curVariant;
        paintGround(lifeStep, armStep, curVariant);
      }
    },
    update(dt: number, cameraQuat: THREE.Quaternion): void {
      if (!root.visible) return;
      const spinBoost = 1 + curArm01 * 1.8;
      animT += dt * spinBoost;
      const baseY = useRing ? 0.84 : 0.58;
      totem.position.y = baseY + Math.sin(animT * 3.0) * 0.08;
      totem.rotation.y = animT * 1.25;
      const sc = baseScale * (1 + curArm01 * 0.16);
      totem.scale.set(sc, sc, sc);
      orbitRing.rotation.z = animT * 1.65;
      sparkA.rotation.y = -animT * 2.8;

      if (curKind === 'robot_vacuum') {
        brushL.rotation.y = animT * 11;
        brushR.rotation.y = -animT * 11;
      }
      if (plateMesh && plateMesh.visible) {
        labelHolder.position.y = 1.56 + Math.sin(animT * 3.0) * 0.045;
        labelHolder.quaternion.copy(cameraQuat);
      }
    },
    dispose(): void {
      plateTex?.dispose();
      plateMat?.dispose();
      ringTex?.dispose();
      ringMat?.dispose();
      ringGeo?.dispose();
      frameMat.dispose();
      glowPadMat.dispose();
      root.removeFromParent();
    },
  };
}
