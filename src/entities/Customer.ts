import { tr } from "../core/I18n";
import * as THREE from 'three';
import { Actor } from './Actor';
import { CarryStack } from './CarryStack';
import { createCharacter } from '../chars';
import { ITEMS, type ItemId } from '../data/items';
import type { CustomerArchetype } from '../data/customers';
import type { StationEntity } from '../sim/Station';
import type { NavGrid } from '../sim/Navigation';
import type { Order } from '../sim/Orders';
import { BALANCE, clampCustomerWalkSpeed } from '../data/balance';
import { clamp01, wrapAngle } from '../core/MathUtils';

export type CustomerState =
  /** Sipariş tezgâhının sırasına yürüyor */
  | 'toCounter'
  /** Sırada bekliyor */
  | 'queue'
  /** Tezgâhın başında, siparişini veriyor */
  | 'order'
  /** Masaya yürüyor */
  | 'toTable'
  /** Masada: önce siparişini bekler, sonra yer */
  | 'seated'
  /** Paket: vitrine yürüyor */
  | 'toPickup'
  /** Paket: vitrinden alıyor */
  | 'pickup'
  | 'toToilet'
  | 'inToilet'
  | 'leave'
  | 'angry'
  /** Kaçak müşteri: vitrinden kapıyor */
  | 'grab'
  | 'flee';

/* ---------- paylaşılan ikon dokuları (bir kez üretilir) ---------- */

const iconCache = new Map<string, THREE.SpriteMaterial>();

/**
 * "Müşteri ne istiyor" balonu — 192px dokulu, istenirse köşesinde ×N adet
 * rozeti. Eski 96px doku telefonda bulanıktı ve adet hiç gösterilmiyordu;
 * "müşteriler tam olarak ne istiyor, net ve büyük görünsün" isteğinin
 * cevabı bu: büyük emoji + turuncu adet pulu.
 */
function iconMaterial(item: ItemId, count = 1, mode: 'table' | 'takeaway' = 'takeaway', serviceCode = ''): THREE.SpriteMaterial {
  const key = `${item}x${count}:${mode}:${serviceCode}`;
  let m = iconCache.get(key);
  if (m) return m;
  const size = 192;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.scale(2, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    roundRect(ctx, 4, 4, 88, 88, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(29,43,52,0.22)';
    ctx.lineWidth = 4;
    roundRect(ctx, 4, 4, 88, 88, 22);
    ctx.stroke();
    drawOrderIcon(ctx, item, count > 1 ? 44 : 48, 38);
    // Aynı balonun alt şeridi servis şeklini tek bakışta anlatır.
    ctx.fillStyle = mode === 'table' ? '#376152' : '#e2703a';
    roundRect(ctx, 10, 70, 76, 17, 8);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 11px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(mode === 'table' ? `${serviceCode || tr("MASA")}` : tr("PAKET"), 48, 79);
    if (count > 1) {
      const bx = 73;
      const by = 21;
      const br = 15.5;
      // Beyaz kart zemininden net ayrışması için yumuşak dış gölge
      ctx.fillStyle = 'rgba(18, 32, 42, 0.28)';
      ctx.beginPath();
      ctx.arc(bx, by + 1.5, br + 1.5, 0, Math.PI * 2);
      ctx.fill();

      const badgeGrad = ctx.createLinearGradient(bx, by - br, bx, by + br);
      badgeGrad.addColorStop(0, '#ff7e47');
      badgeGrad.addColorStop(1, '#d9480f');
      ctx.fillStyle = badgeGrad;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.8;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(29, 43, 52, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bx, by, br + 1.4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.font = '900 16px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillText(`${count}x`, bx, by + 1.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${count}x`, bx, by + 0.5);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
  iconCache.set(key, m);
  return m;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Müşteri başındaki ürün ikonu — Çay ve Kahve (Latte) için net, anlaşılır özel
 * çizim; diğer menü ürünleri için emoji kullanılır.
 */
function drawOrderIcon(ctx: CanvasRenderingContext2D, itemId: ItemId, cx = 48, cy = 38): void {
  if (itemId === 'cay') {
    drawTurkishTea(ctx, cx, cy);
  } else if (itemId === 'latte') {
    drawCoffeeCup(ctx, cx - 1, cy);
  } else {
    ctx.font = '52px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ITEMS[itemId].glyph, cx, cy + 5);
  }
}

/** Sade, yüksek kontrastlı ve modern ince belli Türk çayı ikonu */
function drawTurkishTea(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Taban yumuşak gölgesi
  ctx.fillStyle = 'rgba(18, 32, 42, 0.12)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 21.5, 22, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Porselen çay tabağı (krem-fildişi zemin + klasik kırmızı kuşak -> kırmızı çayla yüksek kontrast)
  const saucerGrad = ctx.createLinearGradient(cx, cy + 13, cx, cy + 24);
  saucerGrad.addColorStop(0, '#f5eadc');
  saucerGrad.addColorStop(1, '#decbb4');
  ctx.fillStyle = saucerGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 18.2, 22, 5.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2b1814';
  ctx.lineWidth = 2.1;
  ctx.stroke();

  // Tabak içi ince kırmızı geleneksel halka
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 18.0, 16.5, 4.1, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 3. İnce belli cam gövde + kalın kristal taban
  const traceGlass = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 13.8, cy - 14.5);
    ctx.bezierCurveTo(cx - 13.2, cy - 7.5, cx - 8.4, cy - 3.0, cx - 8.4, cy + 0.5);
    ctx.bezierCurveTo(cx - 8.4, cy + 4.8, cx - 15.2, cy + 9.2, cx - 10.2, cy + 16.8);
    ctx.quadraticCurveTo(cx, cy + 19.6, cx + 10.2, cy + 16.8);
    ctx.bezierCurveTo(cx + 15.2, cy + 9.2, cx + 8.4, cy + 4.8, cx + 8.4, cy + 0.5);
    ctx.bezierCurveTo(cx + 8.4, cy - 3.0, cx + 13.2, cy - 7.5, cx + 13.8, cy - 14.5);
    ctx.closePath();
  };

  const glassGrad = ctx.createLinearGradient(cx - 14, cy - 14, cx + 14, cy + 18);
  glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  glassGrad.addColorStop(0.75, '#e2eef5');
  glassGrad.addColorStop(1, '#c5dae6');
  traceGlass();
  ctx.fillStyle = glassGrad;
  ctx.fill();

  // Kristal taban parlaması (çayın altındaki kalın cam kısım)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 16.2, 9.2, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4. Tavşan kanı çay dolgusu (kristal tabanın üstünden başlar)
  const teaGrad = ctx.createLinearGradient(cx, cy - 9.5, cx, cy + 15);
  teaGrad.addColorStop(0, '#ea580c');
  teaGrad.addColorStop(0.28, '#dc2626');
  teaGrad.addColorStop(0.72, '#991b1b');
  teaGrad.addColorStop(1, '#5c0b12');

  ctx.beginPath();
  ctx.moveTo(cx - 11.8, cy - 9.2);
  ctx.bezierCurveTo(cx - 10.5, cy - 4.5, cx - 7.4, cy - 1.5, cx - 7.4, cy + 0.8);
  ctx.bezierCurveTo(cx - 7.4, cy + 4.6, cx - 13.6, cy + 8.8, cx - 9.4, cy + 14.5);
  ctx.quadraticCurveTo(cx, cy + 16.8, cx + 9.4, cy + 14.5);
  ctx.bezierCurveTo(cx + 13.6, cy + 8.8, cx + 7.4, cy + 4.6, cx + 7.4, cy + 0.8);
  ctx.bezierCurveTo(cx + 7.4, cy - 1.5, cx + 10.5, cy - 4.5, cx + 11.8, cy - 9.2);
  ctx.closePath();
  ctx.fillStyle = teaGrad;
  ctx.fill();

  // Çay göbeğinde sıcak kehribar iç ışıma (3B derinlik ve şeffaflık hissi)
  const glowGrad = ctx.createRadialGradient(cx - 1.5, cy + 6.5, 1, cx, cy + 6.5, 10.5);
  glowGrad.addColorStop(0, 'rgba(251, 146, 60, 0.58)');
  glowGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fill();

  // 5. Çay üst yüzeyi (3B perspektif elipsi — kahve fincanıyla aynı bakış açısı)
  const surfaceGrad = ctx.createLinearGradient(cx - 11, cy - 12, cx + 11, cy - 7);
  surfaceGrad.addColorStop(0, '#fb923c');
  surfaceGrad.addColorStop(0.5, '#ea580c');
  surfaceGrad.addColorStop(1, '#b91c1c');
  ctx.fillStyle = surfaceGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 9.2, 11.8, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Çay yüzeyinde ince parlak menisküs halkası
  ctx.strokeStyle = 'rgba(254, 215, 170, 0.65)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 9.3, 9.2, 2.3, 0, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  // 6. Bardak dış konturu
  traceGlass();
  ctx.strokeStyle = '#2b1814';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // 7. Ağız çemberi (açık cam efekti + parlak ön dudak)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 14.5, 13.8, 3.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2b1814';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ağız ön kenar beyaz cam ışıltısı
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 14.5, 12.6, 3.2, 0, Math.PI * 0.12, Math.PI * 0.88);
  ctx.stroke();

  // 8. İnce belli kavisli cam yansımaları (sol ana parlama + sağ alt denge parlaması)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 10.2, cy - 9.8);
  ctx.bezierCurveTo(cx - 9.2, cy - 5.5, cx - 5.8, cy - 2.0, cx - 5.8, cy + 0.8);
  ctx.bezierCurveTo(cx - 5.8, cy + 4.4, cx - 10.6, cy + 8.2, cx - 7.8, cy + 13.0);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx + 8.8, cy + 5.0);
  ctx.quadraticCurveTo(cx + 10.4, cy + 9.2, cx + 7.2, cy + 13.2);
  ctx.stroke();

  ctx.restore();
}

/** Sade, yüksek kontrastlı ve modern kahve / latte fincanı ikonu */
function drawCoffeeCup(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Taban yumuşak gölgesi
  ctx.fillStyle = 'rgba(18, 32, 42, 0.10)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 21, 22, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Fincan tabağı (krem-bej porselen, beyaz karttan net ayrışır)
  ctx.fillStyle = '#e6d7c3';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 18, 22, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2b1814';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 3. Fincan kulpu (sağda belirgin, temiz halka)
  ctx.strokeStyle = '#2b1814';
  ctx.lineWidth = 6.2;
  ctx.beginPath();
  ctx.arc(cx + 15.5, cy + 2, 7.2, -Math.PI * 0.45, Math.PI * 0.52);
  ctx.stroke();
  ctx.strokeStyle = '#8c4f2b';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.arc(cx + 15.5, cy + 2, 7.2, -Math.PI * 0.45, Math.PI * 0.52);
  ctx.stroke();

  // 4. Fincan gövdesi (zengin sıcak moka/karamel seramik — beyaz zeminde çok net okunur)
  const cupGrad = ctx.createLinearGradient(cx - 16, cy - 10, cx + 16, cy + 16);
  cupGrad.addColorStop(0, '#9c5a32');
  cupGrad.addColorStop(0.55, '#784020');
  cupGrad.addColorStop(1, '#522912');

  ctx.beginPath();
  ctx.moveTo(cx - 17.5, cy - 10);
  ctx.bezierCurveTo(cx - 17.5, cy + 5, cx - 12.5, cy + 14.5, cx - 9.5, cy + 16);
  ctx.quadraticCurveTo(cx, cy + 18, cx + 9.5, cy + 16);
  ctx.bezierCurveTo(cx + 12.5, cy + 14.5, cx + 17.5, cy + 5, cx + 17.5, cy - 10);
  ctx.closePath();
  ctx.fillStyle = cupGrad;
  ctx.fill();
  ctx.strokeStyle = '#2b1814';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Fincan sol seramik parlaması
  ctx.strokeStyle = 'rgba(255, 248, 240, 0.34)';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(cx - 13.5, cy - 4);
  ctx.quadraticCurveTo(cx - 13, cy + 6, cx - 8.5, cy + 12.5);
  ctx.stroke();

  // 5. Fincan ağız çemberi ve krema yüzeyi
  ctx.fillStyle = '#fff8f0';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 10, 17.5, 6.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2b1814';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Altın espresso kreması
  ctx.fillStyle = '#c27d42';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 10, 14.8, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sade, net süt köpüğü kalp motifi
  ctx.fillStyle = '#fffbf5';
  ctx.beginPath();
  const hx = cx, hy = cy - 10.2;
  ctx.moveTo(hx, hy + 3.2);
  ctx.bezierCurveTo(hx - 6.5, hy + 0.6, hx - 7.2, hy - 3.6, hx - 3.4, hy - 3.6);
  ctx.bezierCurveTo(hx - 1.2, hy - 3.6, hx, hy - 1.8, hx, hy - 0.8);
  ctx.bezierCurveTo(hx, hy - 1.8, hx + 1.2, hy - 3.6, hx + 3.4, hy - 3.6);
  ctx.bezierCurveTo(hx + 7.2, hy - 3.6, hx + 6.5, hy + 0.6, hx, hy + 3.2);
  ctx.fill();

  ctx.restore();
}

/**
 * Onay rozeti (servis tamam). v5 NOTU: eski "sipariş fişi" rozeti
 * (beyaz kâğıt + sahte yazı satırları + tırtıklı kenar) tamamen silindi —
 * kapıdan giren müşterinin üstünde, henüz sipariş yokken duran bu kart
 * hiçbir bilgi taşımıyordu ve "kâğıt gibi bir şey var, ne alaka" diye
 * şikâyet edilmişti. Balon artık YALNIZ sipariş sonrası ürün ikonunu,
 * tamamlanınca da bu onay imini gösterir.
 */
const badgeCache = new Map<string, THREE.SpriteMaterial>();

/** Sade, yüksek kontrastlı ve ürün seviyesinde "Temiz Masa" (parlayan kafe masası) ikonu */
function drawCleanTableIcon(ctx: CanvasRenderingContext2D, cx = 48, cy = 36): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Zemin yumuşak gölgesi
  ctx.fillStyle = 'rgba(15, 23, 42, 0.11)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 23.5, 23.5, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Arka masa ayakları (perspektifte biraz daha içeride ve koyu, derinlik katar)
  const drawLeg = (xTop: number, xBot: number, yTop: number, yBot: number, wTop: number, wBot: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.65;
    ctx.beginPath();
    ctx.moveTo(xTop - wTop * 0.5, yTop);
    ctx.lineTo(xTop + wTop * 0.5, yTop);
    ctx.lineTo(xBot + wBot * 0.5, yBot);
    ctx.quadraticCurveTo(xBot, yBot + 1.1, xBot - wBot * 0.5, yBot);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  // Arka sol ve arka sağ ayaklar
  drawLeg(cx - 11.5, cx - 12.2, cy + 1, cy + 19.2, 3.4, 2.5, '#334155');
  drawLeg(cx + 11.5, cx + 12.2, cy + 1, cy + 19.2, 3.4, 2.5, '#334155');

  // Ön sol ve ön sağ masa ayakları (zarif konik kesim)
  const frontLegGrad = ctx.createLinearGradient(cx, cy, cx, cy + 23.5);
  frontLegGrad.addColorStop(0, '#64748b');
  frontLegGrad.addColorStop(1, '#334155');
  drawLeg(cx - 19.2, cx - 20.4, cy + 0.5, cy + 23.2, 4.2, 3.0, frontLegGrad as unknown as string);
  drawLeg(cx + 19.2, cx + 20.4, cy + 0.5, cy + 23.2, 4.2, 3.0, frontLegGrad as unknown as string);

  // 3. Masa tablası alt kasnağı / kalınlık kenarı (3B perspektif ahşap gövde)
  const ty = cy - 4.8;
  const rx = 27.5;
  const ry = 8.4;
  const rimH = 4.6;

  const rimGrad = ctx.createLinearGradient(cx - rx, ty, cx + rx, ty + rimH);
  rimGrad.addColorStop(0, '#b46934');
  rimGrad.addColorStop(0.5, '#8f4f22');
  rimGrad.addColorStop(1, '#693714');
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.ellipse(cx, ty + rimH, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(cx - rx, ty);
  ctx.ellipse(cx, ty, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2b1814';
  ctx.lineWidth = 1.9;
  ctx.stroke();

  // 4. Masa üst tablası (sıcak meşe/ceviz ahşap yüzey)
  const topGrad = ctx.createLinearGradient(cx - rx, ty - ry, cx + rx, ty + ry);
  topGrad.addColorStop(0, '#fae0b8');
  topGrad.addColorStop(0.45, '#e5aa6d');
  topGrad.addColorStop(1, '#c48244');
  ctx.fillStyle = topGrad;
  ctx.beginPath();
  ctx.ellipse(cx, ty, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Masa üst yüzeyinde pırıl pırıl temizlik parlaması (diyagonal ışık kuşağı)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, ty, rx - 1.2, ry - 1.0, 0, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
  ctx.beginPath();
  ctx.moveTo(cx - 15, ty - 11);
  ctx.lineTo(cx - 5, ty - 11);
  ctx.lineTo(cx - 17, ty + 11);
  ctx.lineTo(cx - 27, ty + 11);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.30)';
  ctx.beginPath();
  ctx.moveTo(cx - 1, ty - 11);
  ctx.lineTo(cx + 4, ty - 11);
  ctx.lineTo(cx - 8, ty + 11);
  ctx.lineTo(cx - 13, ty + 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Masa üst tabla konturu ve ön kenar ışıltısı
  ctx.strokeStyle = '#3b2114';
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  ctx.ellipse(cx, ty, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 252, 245, 0.82)';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.ellipse(cx, ty, rx - 2.4, ry - 1.5, 0, Math.PI * 0.12, Math.PI * 0.88);
  ctx.stroke();

  // 5. Zarif içbükey 4-köşeli "Tertemiz" ışıltı yıldızları (Sparkle)
  const drawSparkle = (sx: number, sy: number, r: number, fill: string, stroke: string) => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.quadraticCurveTo(0, 0, 0, r);
    ctx.quadraticCurveTo(0, 0, -r, 0);
    ctx.quadraticCurveTo(0, 0, 0, -r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  };

  // Sağ üst ana ışıltı (ferah turkuaz-beyaz temizlik yıldızı)
  drawSparkle(cx + 20.5, ty - 11.5, 8.8, '#e0f2fe', '#0284c7');
  // Sol üst sıcak ışıltı
  drawSparkle(cx - 20.5, ty - 8.5, 5.8, '#fef9c3', '#d97706');
  // Üst orta minik ışıltı yıldızı
  drawSparkle(cx + 9.5, ty - 14.2, 3.8, '#ffffff', '#38bdf8');

  ctx.restore();
}

function badgeMaterial(kind: 'check' | 'angry' | 'table_wait' | 'investor'): THREE.SpriteMaterial {
  const key = kind;
  let m = badgeCache.get(key);
  if (m) return m;
  // Doku 384px (Retina/telefonda jilet gibi keskin), çizim koordinatları 96'lık
  // mantıksal ızgarada — ctx.scale(4,4) ikisini köprüler.
  const size = 384;
  const L = 96;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.scale(4, 4);
    if (kind === 'investor') {
      // Zengin Yatırımcı VIP rozeti: Canlı altın-kehribar arka plan + parlak sınır
      const grad = ctx.createLinearGradient(4, 4, L - 8, L - 8);
      grad.addColorStop(0, '#f59e0b');
      grad.addColorStop(1, '#b45309');
      ctx.fillStyle = grad;
      roundRect(ctx, 4, 4, L - 8, L - 8, 20);
      ctx.fill();
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 4;
      roundRect(ctx, 4, 4, L - 8, L - 8, 20);
      ctx.stroke();

      // Para çantası / nakit simgesi
      ctx.font = '38px "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💰', 48, 38);

      // Alt bilgi şeridi
      ctx.fillStyle = '#78350f';
      roundRect(ctx, 10, 68, 76, 19, 7);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.font = '800 10px system-ui, "Segoe UI", sans-serif';
      ctx.fillText(tr("YATIRIMCI"), 48, 78);
    } else if (kind === 'table_wait') {
      // Temiz masa bekleyen müşteri düşünce balonu — ürün kalitesinde kart
      const cardGrad = ctx.createLinearGradient(4, 4, 4, L - 4);
      cardGrad.addColorStop(0, '#ffffff');
      cardGrad.addColorStop(1, '#f8fafc');
      ctx.fillStyle = cardGrad;
      roundRect(ctx, 4, 4, L - 8, L - 8, 22);
      ctx.fill();

      // Zarif, dikkat çekici mercan-kırmızı dış çerçeve
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 3.5;
      roundRect(ctx, 4, 4, L - 8, L - 8, 22);
      ctx.stroke();

      // Pırıl pırıl temiz kafe masası ikonu
      drawCleanTableIcon(ctx, 48, 36);

      // Alt bilgi şeridi: Modern derin mercan/yakut pill
      const pillGrad = ctx.createLinearGradient(9, 68, 9, 86);
      pillGrad.addColorStop(0, '#f43f5e');
      pillGrad.addColorStop(1, '#be123c');
      ctx.fillStyle = pillGrad;
      roundRect(ctx, 9, 68, 78, 18, 8);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 9.8px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tr("TEMİZ MASA"), 48, 77.5);
    } else {
      ctx.fillStyle = kind === 'angry' ? 'rgba(214,75,60,0.97)' : 'rgba(79,181,154,0.96)';
      roundRect(ctx, 4, 4, L - 8, L - 8, 22);
      ctx.fill();
      if (kind === 'angry') {
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 62px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 48, 49);
      } else {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(26, 50);
        ctx.lineTo(43, 66);
        ctx.lineTo(72, 32);
        ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  badgeCache.set(key, m);
  return m;
}

/* ------------------------------------------------------------------ */

const PATIENCE_GREEN = 0x5fd08a;
const PATIENCE_YELLOW = 0xf2c94c;
const PATIENCE_RED = 0xe4573d;

export class Customer extends Actor {
  readonly arch: CustomerArchetype;
  readonly uid: string;

  state: CustomerState = 'toCounter';

  /** Tezgâhta verilen sipariş. Sipariş verilene kadar null. */
  order: Order | null = null;

  patience = 30;
  maxPatience = 30;
  /** World sabrı birkaç aşamada yeniden kurduğu için ortak çarpan. */
  patienceMult = 1;
  /** Sabır sadece BEKLERKEN azalır. */
  waiting = false;
  /** Aynı bekleme aşamasında kırmızı sabır uyarısı yalnız bir kez çalar. */
  lastWarningState: CustomerState | null = null;

  /** Sipariş verdiği tezgâh */
  counter: StationEntity | null = null;
  queueIndex = -1;
  /** Paket siparişte o an bekledigi vitrin */
  targetDisplay: StationEntity | null = null;

  /** Oturmak istiyor mu (paket değilse) */
  dineIn = false;
  table: StationEntity | null = null;
  /** Balondaki ve fiziksel masadaki aynı kısa servis kodu (M3, V1…). */
  serviceCode = '';
  seatIndex = -1;
  /** Masada siparişi tamamlandı mı — true ise yemeye başlamıştır */
  eating = false;
  eatTimer = 0;
  eatTotal = 1;
  /** Masa beklerken geçen süre */
  tableWait = 0;
  /** Rezervasyon mantıksal olarak hazırken kısa, görsel masa arama anı. */
  decisionTimer = 0;

  needsToilet = false;
  toilet: StationEntity | null = null;
  toiletTimer = 0;
  mealFinished = false;

  takeTimer = 0;
  /** Raf hedefinin hemen berisinde kalan yol bulma için kısa varış sigortası. */
  pickupApproachTimer = 0;
  counterApproachTimer = 0;
  grabApproachTimer = 0;
  lateral = 0;
  /** Bu müşterinin bıraktığı toplam hesap (çarpanlar uygulanmış) */
  paid = 0;
  /** Sipariş anında kilitlenen birim fiyat; para yalnız teslimatta yazılır. */
  unitCharge = 0;
  /** Yuvarlama sapmasını son teslimatta kapatmak için kilitlenen toplam hesap. */
  quotedTotal = 0;
  itemsReceived = 0;
  /** Müşterinin gerçekten teslim aldığı ve taşıdığı ürünler. */
  readonly carriedItems: ItemId[] = [];
  private readonly carryStack: CarryStack;

  /** Kaçak müşteri mi */
  isDasher = false;
  /** Sosyal medya fenomeni mi */
  isInfluencer = false;
  /** Zengin Yatırımcı VIP mi */
  isInvestor = false;
  /** Teşekkür / vedalaşma el sallaması */
  private waving = false;
  grabTimer = 0;
  stolen = 0;
  caught = false;

  /** Sahneden silinmeye hazır */
  done = false;
  /** Sorunu gösterip ancak sonra normal yürüyüşle çıkması için kısa durak. */
  complaintTimer = 0;
  /**
   * Çıkışa yöneldikten sonra geçen süre. Kapıya varamayan müşteri nüfus
   * tavanında sonsuza kadar yer tutmasın diye sigorta olarak kullanılır
   * (bkz. World, 'leave'/'angry' durumu).
   */
  exitTimer = 0;

  private bubble: THREE.Sprite;
  private bubbleScale = 0;
  private readonly bubbleParentScale = new THREE.Vector3();
  /** Balonun gitmek istediği ölçek; yumuşatma updateVisual'da (bkz. showBubble). */
  private bubbleTarget = 0;
  private patienceBar: THREE.Sprite;
  private patienceMat: THREE.SpriteMaterial;
  private bubbleKey: string | null = null;
  private emoteTimer = 0;

  constructor(
    arch: CustomerArchetype,
    uid: string,
    kind: 'normal' | 'dasher' | 'influencer' | 'investor' = 'normal',
  ) {
    const visualSeed = (Math.random() * 0xffffffff) >>> 0;
    super(
      createCharacter(kind === 'dasher' ? 'dasher' : kind === 'investor' ? 'investor' : 'customer', {
        // Davranış arketipi görünüşü belirlemez. Her doğuş yeni bir anonim
        // modüler kişi üretir; tohum yalnız o karakterin kendi parçalarını bağlar.
        seed: visualSeed,
      }),
    );
    this.arch = arch;
    this.uid = uid;
    this.isDasher = kind === 'dasher';
    this.isInfluencer = kind === 'influencer';
    this.isInvestor = kind === 'investor';
    this.speed = clampCustomerWalkSpeed(arch.speed);
    this.patience = arch.patience * this.patienceMult;
    this.maxPatience = this.patience;
    this.lateral = (Math.random() - 0.5) * 2.2;
    this.carryStack = new CarryStack(this.char.carryAnchor);

    // v5: varsayılan malzeme onay imi ama balon KAPALI başlar; sipariş
    // verilince showItem ürün ikonunu basar (kapıda balon yok).
    this.bubble = new THREE.Sprite(badgeMaterial('check'));
    this.bubble.scale.setScalar(0.001);
    this.bubble.center.set(0.5, 0);
    this.char.headTop.add(this.bubble);
    this.bubble.position.set(0, 0.18, 0);

    this.patienceMat = new THREE.SpriteMaterial({
      color: PATIENCE_GREEN,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    this.patienceBar = new THREE.Sprite(this.patienceMat);
    this.patienceBar.center.set(0.5, 0);
    this.patienceBar.scale.set(0.7, 0.11, 1);
    this.patienceBar.position.set(0, 0.06, 0);
    this.char.headTop.add(this.patienceBar);

  }

  /* ---------------- sipariş arayüzü (Station.TableGuest) ---------------- */

  needsItem(item: ItemId): boolean {
    return !this.eating && this.order !== null && this.order.needs(item);
  }

  receiveItem(item: ItemId): boolean {
    if (this.eating || !this.order) return false;
    if (!this.order.receive(item)) return false;
    this.itemsReceived++;
    this.carriedItems.push(item);
    // Salon servisi doğrudan masaya konur; oturan müşterinin göğsünde
    // bardak kulesi oluşmaz. Paket müşteri ürünü gerçekten elinde taşır.
    if (!this.dineIn || !this.table) {
      this.carryStack.setSlots(this.carriedItems);
      this.char.setCarryCount(this.carriedItems.length);
    }
    return true;
  }

  /** Ürün masaya kondu; eldeki yığın gizlenir ama masa görseli için içerik korunur. */
  placeCarriedItemsOnTable(): void {
    this.carryStack.clear();
    this.char.setCarryCount(0);
  }

  finishMeal(): void {
    this.carriedItems.length = 0;
    this.carryStack.clear();
    this.char.setCarryCount(0);
    this.mealFinished = true;
  }

  get sitting(): boolean { return this.state === 'seated' || this.state === 'inToilet'; }

  get orderComplete(): boolean {
    return this.order !== null && this.order.complete;
  }

  /* ---------------- görsel ---------------- */

  /** Balonda ya bekleyen ürünün ikonu ya onay imi durur (v5: fiş yok). */
  private setBubbleKey(key: string, mat: THREE.SpriteMaterial): void {
    if (this.bubbleKey === key) return;
    this.bubbleKey = key;
    this.bubble.material = mat;
  }

  showCheck(): void {
    this.setBubbleKey('check', badgeMaterial('check'));
  }

  showAngry(): void {
    this.setBubbleKey('angry', badgeMaterial('angry'));
    this.showBubble(true);
  }

  showWaitingTable(): void {
    this.setBubbleKey('table_wait', badgeMaterial('table_wait'));
    this.showBubble(true);
  }

  showInvestor(): void {
    this.setBubbleKey('investor', badgeMaterial('investor'));
    this.showBubble(true);
  }

  waveAndLeave(exitX: number, exitZ: number, nav?: NavGrid): void {
    this.waving = true;
    this.char.setState('cheer');
    this.showBubble(false);
    setTimeout(() => {
      if (this.done) return;
      this.waving = false;
      this.state = 'leave';
      if (nav) this.moveTo(nav, exitX, exitZ, true);
    }, 1800);
  }

  showItem(item: ItemId, count = 1): void {
    const n = Math.max(1, Math.min(9, count | 0));
    const mode = this.dineIn ? 'table' : 'takeaway';
    this.setBubbleKey(`${item}x${n}:${mode}:${this.serviceCode}`, iconMaterial(item, n, mode, this.serviceCode));
  }

  /**
   * İstek balonunu aç/kapat.
   *
   * BURADA YALNIZ HEDEF YAZILIR, yumuşatma `updateVisual` içinde her
   * karede yapılır. Eskiden bu fonksiyonun kendisi yumuşatma adımıydı
   * (`+= (hedef - şu) * 0,2`) ama yalnız DURUM GEÇİŞLERİNDE çağrılıyordu:
   * tek çağrı ölçeği 0'dan ancak 0,19'a taşıyordu ve orada kalıyordu.
   * Ölçüm (12 canlı müşteri): `toCounter` 0,19 · `seated` 0,342 — yani
   * balon, hedeflenen 0,95'in beşte biriyle üçte biri arasında çiziliyordu.
   * "Müşteri ne istiyor" oyunun ana sorusu olduğu için bu, doğrudan
   * okunaklılık kaybıydı.
   */
  showBubble(on: boolean): void {
    this.bubbleTarget = on ? 0.78 : 0;
  }

  updateVisual(dt: number): void {
    const bubbleY = 0.18;

    /**
     * Balon ölçeği HER KAREDE hedefe süzülür. Kare hızından bağımsız
     * olması için `dt * 12` ile sınırlanır — ad plakasının (`dt * 8`)
     * yanında bir tık hızlı, çünkü balon bir soru sorar ve cevabı
     * beklenir.
     */
    this.bubbleScale += (this.bubbleTarget - this.bubbleScale) * Math.min(1, dt * 12);
    const bubbleVisible = this.bubbleScale > 0.02;
    this.bubble.visible = bubbleVisible;

    const showPatience = this.waiting && !this.isDasher && !this.isInvestor && this.state !== 'leave' && this.state !== 'angry';
    const targetOpacity = showPatience ? 0.95 : 0;
    this.patienceMat.opacity += (targetOpacity - this.patienceMat.opacity) * Math.min(1, dt * 10);
    const patienceVisible = this.patienceMat.opacity > 0.02;
    this.patienceBar.visible = patienceVisible;

    if (!bubbleVisible && !patienceVisible) return;

    // Skeletons can use different source units and enlarged head bones.
    // Keep service markers in world units, independent of the character rig.
    this.char.headTop.getWorldScale(this.bubbleParentScale);
    const sx = Math.max(0.0001, Math.abs(this.bubbleParentScale.x));
    const sy = Math.max(0.0001, Math.abs(this.bubbleParentScale.y));

    if (bubbleVisible) {
      const s = Math.max(0.001, this.bubbleScale);
      this.bubble.scale.set(s / sx, s / sy, 1);
      this.bubble.position.y = bubbleY / sy;
    }

    if (patienceVisible) {
      const p = clamp01(this.patience / this.maxPatience);
      this.patienceBar.scale.set((0.60 * p + 0.02) / sx, 0.065 / sy, 1);
      this.patienceBar.position.y = 0.06 / sy;
      const col = p > 0.55 ? PATIENCE_GREEN : p > 0.28 ? PATIENCE_YELLOW : PATIENCE_RED;
      this.patienceMat.color.setHex(col);
      if (p < 0.28) {
        this.emoteTimer += dt;
        this.patienceBar.position.x = Math.sin(this.emoteTimer * 22) * 0.03 / sx;
      }
    }
  }

  /* Oturma/kalkma harmanı — anlık ışınlanma yerine 0,3 sn'lik kayış. */
  private sitT = 1;
  private sitFromX = 0;
  private sitFromZ = 0;
  private sitFromA = 0;
  private seatX = 0;
  private seatY = 0;
  private seatZ = 0;
  private seatA = 0;
  private seatBack = 0;
  private standT = -1;
  private standFromY = 0;
  private standFromX = 0;
  private standFromZ = 0;
  get standingUp(): boolean { return this.standT >= 0 && this.standT < 1; }
  /** Doğuşta 0→1 büyüme — kapıda tam boy "belirivermeyi" yumuşatır. */
  private spawnT = 0;
  private baseScale = 1;

  /** Yol takibi + animasyon durumu. */
  step(dt: number, nav: NavGrid, animate = true): void {
    const arriveDist = this.state === 'toTable' || this.state === 'toToilet' ? .12 : BALANCE.customers.walkStopDist;
    // Otururken yol takibi çalışmaz; konumu masa sabitler.
    if (!this.sitting && !this.standingUp) this.advance(dt, nav, arriveDist);
    else this.planarSpeed = 0;

    if (this.spawnT < 1) {
      if (this.baseScale === 1) this.baseScale = this.char.root.scale.x || 1;
      this.spawnT = Math.min(1, this.spawnT + dt / 0.25);
      const e = this.spawnT * (2 - this.spawnT); // easeOutQuad
      this.char.root.scale.setScalar(this.baseScale * (0.82 + 0.18 * e));
    }

    if (this.waving) this.char.setState('cheer');
    else if (this.state === 'angry') this.char.setState('angry');
    else if (this.state === 'flee') this.char.setState('panic');
    else if (this.state === 'grab') { this.char.setWorkKind('reach'); this.char.setState('work'); }
    else if (this.sitting) this.char.setState('sit');
    else if (this.state === 'order') this.char.setState('idle');
    else if (this.state === 'pickup' && this.takeTimer > 0) { this.char.setWorkKind('reach'); this.char.setState('work'); }
    else this.char.setState('idle');

    /**
     * Kadraj dışındayken animatör ÇALIŞTIRILMAZ.
     *
     * `char.update` karakter başına ~131 trigonometrik işlem ve ~64 matris
     * güncellemesi yapar. Görünmeyen karakter için bu tamamen israftır.
     * Konum ve durum yine işlendiği için simülasyon davranışı değişmez;
     * karakter kadraja girdiğinde animatör kaldığı yerden devam eder
     * (tüm geçişler `damp` ile yazıldığı için değişken adım güvenlidir).
     */
    if (animate) this.char.update(dt, this.planarSpeed, this.turnRate(dt));
    if (animate) this.carryStack.update(dt, Math.min(1, this.planarSpeed / Math.max(1, this.speed)), this.planarSpeed);
    this.char.root.visible = animate;
    if(animate)this.updateVisual(dt);
    if (this.sitting) {
      /**
       * OTURMA HARMANI. `sitAt` eskiden konumu ve yönü TEK KAREDE basıyordu:
       * misafir 0,5–1,9 birim öteden sandalyeye "ışınlanıp" havada dönüyordu.
       * Şimdi 0,3 sn'de kayarak oturur; poz geçişini animatördeki wSit
       * sönümü zaten aynı tempoda yapıyor.
       */
      this.sitT = Math.min(1, this.sitT + dt / 0.3);
      const e = this.sitT * this.sitT * (3 - 2 * this.sitT); // smoothstep
      const px = this.sitFromX + (this.seatX - this.sitFromX) * e;
      const pz = this.sitFromZ + (this.seatZ - this.sitFromZ) * e;
      // Oturuş kotu odanın zemininden başlar: yükseltilmiş VIP odasında
      // 0'dan başlasa misafir bir an zemine gömülüp yukarı fırlardı.
      const targetY = this.seatY - this.floorY > 0.35 ? this.floorY : this.seatY;
      const py = this.floorY + (targetY - this.floorY) * e;
      this.angle = this.sitFromA + wrapAngle(this.seatA - this.sitFromA) * e;
      this.x = px;
      this.z = pz;
      // Sim konumu koltuk merkezinde kalır; yalnız beden arkalığa yaslanır.
      const back = this.seatBack * e;
      this.char.root.position.set(px - Math.sin(this.angle) * back, py, pz - Math.cos(this.angle) * back);
      this.char.root.rotation.y = this.angle;
    } else {
      this.syncTransform();
      if (this.standT >= 0) {
        // Kalkışta gövde 0,25 sn'de yere iner; bacaklar aynı sürede açılır.
        this.standT = Math.min(1, this.standT + dt / 0.25);
        const e = this.standT * this.standT * (3 - 2 * this.standT);
        this.char.root.position.x = this.standFromX + (this.x - this.standFromX) * e;
        this.char.root.position.z = this.standFromZ + (this.z - this.standFromZ) * e;
        this.char.root.position.y = this.floorY + (this.standFromY - this.floorY) * (1 - this.standT);
        if (this.standT >= 1) this.standT = -1;
      }
    }
  }

  /**
   * Sandalyeye oturt: konum + yükseklik masadan gelir (0,3 sn'lik kayışla).
   * @param back Bedenin bakış yönünün tersine kayması (arkalığa yaslanma).
   */
  sitAt(x: number, y: number, z: number, faceX: number, faceZ: number, back = 0): void {
    this.seatBack = back;
    this.sitFromX = this.x;
    this.sitFromZ = this.z;
    this.sitFromA = this.angle;
    this.seatX = x;
    this.seatY = y;
    this.seatZ = z;
    this.seatA = Math.atan2(faceX - x, faceZ - z);
    this.sitT = this.sitting ? 1 : 0;
    this.standT = -1;
    this.x = x;
    this.z = z;
    this.stop();
  }

  standUp(x = this.x, z = this.z): void {
    this.standFromY = this.char.root.position.y;
    this.standFromX = this.char.root.position.x;
    this.standFromZ = this.char.root.position.z;
    this.x = x; this.z = z;
    this.standT = 0;
  }

  celebrate(): void {
    this.char.setState('cheer');
  }

  dispose(): void {
    this.carryStack.dispose();
    this.bubble.removeFromParent();
    this.patienceBar.removeFromParent();
    this.patienceMat.dispose();
    super.dispose();
  }
}

export function disposeCustomerIcons(): void {
  for (const m of iconCache.values()) {
    m.map?.dispose();
    m.dispose();
  }
  iconCache.clear();
  for (const m of badgeCache.values()) {
    m.map?.dispose();
    m.dispose();
  }
  badgeCache.clear();
}
