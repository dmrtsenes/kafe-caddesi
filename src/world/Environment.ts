import {PREMIUM, premiumFloorTexture, batchPremium, disposePremium} from './PremiumDesign';
import {createPremiumBackbar, addPremiumGlazing, createPremiumLoungeLamp, createPremiumPlanter, addPremiumWallArt} from './PremiumArchitecture';
import { tr, localeTag } from "../core/I18n";
import * as THREE from 'three';
import { VisibilityRoot } from './VisibilityRoot';
import { StaticTransformRoot } from './StaticTransformRoot';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { LocationDef, LocationPalette } from '../data/layouts';
import { floorLiftAt, locationStations, roomWalls } from '../data/layouts';
import type { FloorSkin, WallSkin } from '../data/cosmetics';
import { ITEMS, type ItemId } from '../data/items';
import { TAU } from '../core/MathUtils';
import { basic, box, cyl, detail, mat, mesh, mix, plane, roundBox, shade, sph } from './Materials';
import { createDecor } from './Decor';
import { createSideGardens } from './SideGardens';
import { cafeStoneTexture } from './CafeMaterials';
import { flushInstances, hideInstance, makeInstanced, setInstance, sharedLabelMaterial } from './ProductMesh';
import { stationGlyph } from './StationView';
import { createStaticBatch, type StaticBatch } from './staticBatch';
import { markDynamic } from './layers';
import { createZonePurchasePad, type ZonePurchasePad } from './ZonePurchasePad';

/* ==================================================================== *
 *  MEKÂN
 *
 *  Tek, açık planlı bir kafe. Duvarlı üretim bayları, kemerler ve
 *  departman tabelaları BİLEREK yok: onlar mekânı yanlamasına uzayan bir
 *  koridora çeviriyor ve kamerayı mekânın yarısını kaçırmaya zorluyordu.
 *
 *  Kalanlar bir kafeyi kafe yapan şeyler:
 *   · ahşap parkeli salon, karo döşeli açık mutfak, ahşap terastan deck,
 *   · lambri bandı + büyük pencereli dış duvarlar,
 *   · barın üstünde asılı tebeşir menü,
 *   · her masanın üstünde sıcak sarkıt,
 *   · sıradaki açılışlar zemindeki sade karelerle işaretli.
 *
 *  Kamera güneydoğudan bakar; bu yüzden KUZEY ve BATI duvarları tam
 *  boy, GÜNEY ve DOĞU duvarları bel hizasındadır. Aksi halde ön duvarlar
 *  oyun alanının üstüne kapanırdı.
 * ==================================================================== */

const WALL_H = 3.3;
const WALL_T = 0.34;
/** Ön (yakın) duvarların yüksekliği — kamerayı kapatmayacak kadar alçak. */
const LOW_WALL_H = 0.92;
const WAINSCOT_H = 1.05;
const FLOOR_Y = 0.005;

/* ---------------------------------------------------------------- doku */

function hex(c: number): string {
  return '#' + (c & 0xffffff).toString(16).padStart(6, '0');
}

/**
 * sRGB (gama) uzayında renk karıştırma — `Materials.mix()`'ten FARKLI.
 *
 * `mix()` THREE.Color üzerinden çalışır ve ColorManagement açıkken
 * karıştırmayı LINEAR uzayda yapar. Işık hesabı için doğrudur, ama bir
 * rengi "koyulaştırmak" için kullanıldığında sonuç beklenenden çok daha
 * açık çıkar: oda tabelası plakasında `mix(0xd4a017, 0x141c22, 0.62)`
 * hedef #5d4e1e yerine ekranda ÖLÇÜLEN #8a691e verdi ve krem yazıyla
 * kontrast 8,8:1 yerine **1,35:1** oldu — yani harfler zemine eridi.
 *
 * Bu fonksiyon kanalları doğrudan 8 bitlik sRGB değerleri üzerinden
 * karıştırır: "yarı yarıya koyu" dendiğinde ekranda görünen de odur.
 * Yalnız DOKU/UI rengi için kullanılır, ışıklandırılan malzemeler için
 * `mix()` doğru olmaya devam eder.
 */
function mixSrgb(a: number, b: number, t: number): number {
  const ch = (shift: number): number =>
    Math.round((((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t)) & 255;
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Quiet, wider herringbone boards; the named wood cosmetics keep their identity. */
function plankTexture(base: number, alt: number, seam: number): THREE.CanvasTexture {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');
  if (ctx) {
    // Subtle seams and a narrow value range leave room for people and dirt.
    ctx.fillStyle = hex(mixSrgb(seam, base, 0.65));
    ctx.fillRect(0, 0, S, S);
    const W = S / 4;
    const L = W * 2;
    const G = 3;
    const light = mixSrgb(base, 0xfff4e2, 0.18);
    const dark = mixSrgb(alt, 0x9c795c, 0.14);
    const hash = (k: number, salt: number): number => {
      const n = Math.sin(k * 127.1 + salt * 311.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const board = (x: number, y: number, w: number, h: number, id: number): void => {
      ctx.fillStyle = hex(mixSrgb(light, dark, 0.15 + hash(id, 1) * 0.7));
      ctx.fillRect(x, y, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      const horizontal = w > h;
      for (let i = 0; i < 4; i++) {
        const a = hash(id * 7 + i, 2);
        const b = hash(id * 7 + i, 3);
        ctx.strokeStyle = 'rgba(94,68,40,' + (0.025 + b * 0.035).toFixed(3) + ')';
        ctx.lineWidth = 0.9 + b * 0.5;
        ctx.beginPath();
        if (horizontal) {
          const gy = y + h * (0.12 + a * 0.76);
          ctx.moveTo(x, gy);
          ctx.quadraticCurveTo(x + w * 0.5, gy + (b - 0.5) * h * 0.2, x + w, gy);
        } else {
          const gx = x + w * (0.12 + a * 0.76);
          ctx.moveTo(gx, y);
          ctx.quadraticCurveTo(gx + (b - 0.5) * w * 0.2, y + h * 0.5, gx, y + h);
        }
        ctx.stroke();
      }
      ctx.restore();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,246,230,0.15)';
      ctx.beginPath();
      ctx.moveTo(x, y + 0.5);
      ctx.lineTo(x + w, y + 0.5);
      ctx.moveTo(x + 0.5, y);
      ctx.lineTo(x + 0.5, y + h);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(76,54,31,0.16)';
      ctx.beginPath();
      ctx.moveTo(x, y + h - 0.5);
      ctx.lineTo(x + w, y + h - 0.5);
      ctx.moveTo(x + w - 0.5, y);
      ctx.lineTo(x + w - 0.5, y + h);
      ctx.stroke();
    };
    const plank = (x: number, y: number, w: number, h: number, id: number): void => {
      x += G / 2;
      y += G / 2;
      w -= G;
      h -= G;
      const gap = 1;
      if (w > h) {
        const half = (h - gap) / 2;
        board(x, y, w, half, id * 2);
        board(x, y + half + gap, w, half, id * 2 + 1);
      } else {
        const half = (w - gap) / 2;
        board(x, y, half, h, id * 2);
        board(x + half + gap, y, half, h, id * 2 + 1);
      }
    };
    // The determinant-4 lattice covers every pixel with no checkerboard gaps.
    let id = 0;
    for (let j = -1; j <= Math.ceil(S / W) + 1; j++) {
      const first = Math.floor((-3 - 3 * j) / 4);
      const last = Math.ceil((S / W + 3 - 3 * j) / 4);
      for (let i = first; i <= last; i++) {
        const x = j * W;
        const y = (4 * i + 3 * j) * W;
        plank(x, y, L, W, id++);
        plank(x + W, y + W, W, L, id++);
      }
    }
  }
  const texture = new THREE.CanvasTexture(cv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;
  return texture;
}

/** Kare karo: mutfak zemini. */
/**
 * Genel kir dokusu: düzensiz, yumuşak lekeler + ince tanecik.
 *
 * Tek renkli bir tül "ekran karardı" gibi durur; asıl istenen "yerler
 * pasaklı" hissidir, o da düzensizlikten gelir. Doku tek kanal gibi
 * kullanılır (renk zaten koyu kahve), tekrar edilir ki tek büyük düzlemde
 * bile çözünürlük yeterli olsun.
 */
/**
 * HALI DOKUSU — dokuma yüzey + çerçeve bordürü.
 *
 * İlk deneme karo dokusunu (`tileTexture`) yeniden kullanıyordu ve sonuç
 * halı değil YEŞİL BANYO KAROSU gibi okunuyordu: ızgara derzleri tekstil
 * hissini tamamen öldürüyor. Halının imzası düzensiz iplik dokusu ve
 * KENARINDAKİ bordürdür; ikisi de doğrudan dokuya çizilir (tekrar yok,
 * `ClampToEdgeWrapping`) ki bordür halının çevresini tam dolaşsın.
 */
function rugTexture(base: number, weft: number, border: number): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');
  if (ctx) {
    ctx.fillStyle = hex(base);
    ctx.fillRect(0, 0, S, S);
    // dokuma: yatay ve dikey ince iplikler, hafif ton oynamasıyla
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < S; i += 2) {
      ctx.fillStyle = hex(mix(base, weft, ((i * 7) % 5) / 8));
      ctx.fillRect(0, i, S, 1);
    }
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < S; i += 3) {
      ctx.fillStyle = hex(mix(base, weft, ((i * 11) % 6) / 7));
      ctx.fillRect(i, 0, 1, S);
    }
    ctx.globalAlpha = 1;
    /**
     * ZEMİN MOTİFİ — düz alan "halı" değil "boya" okunur.
     *
     * Bordür tek başına yetmiyordu: çerçevenin içi kocaman tek renk bir
     * dikdörtgen kalıyor ve oyun kamerasında zemine dökülmüş yeşil bir
     * havuz gibi duruyordu. Gerçek halının alanı DOKUNMUŞ bir motif taşır.
     * Burada klasik eşkenar dörtgen kafes çok düşük kontrastla çizilir:
     * yakından desen, uzaktan sadece "dokunmuşluk" olarak okunur.
     */
    const inset = 34;
    const step = 26;
    ctx.save();
    ctx.beginPath();
    ctx.rect(inset, inset, S - inset * 2, S - inset * 2);
    ctx.clip();
    ctx.strokeStyle = hex(border);
    ctx.globalAlpha = 0.035;
    ctx.lineWidth = 1.4;
    for (let d = -S; d < S * 2; d += step) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d + S, S);
      ctx.moveTo(d + S, 0);
      ctx.lineTo(d, S);
      ctx.stroke();
    }
    // kafesin kesişimlerine küçük düğüm noktaları
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = hex(border);
    for (let y = inset; y < S - inset; y += step) {
      for (let x = inset + ((y / step) % 2 ? step / 2 : 0); x < S - inset; x += step) {
        ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // çift bordür: dıştan içe kalın–ince
    ctx.strokeStyle = hex(border);
    ctx.lineWidth = 5;
    ctx.strokeRect(9, 9, S - 18, S - 18);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(24, 24, S - 48, S - 48);
    // saçak izlenimi: kenarda kısa dikmeler
    ctx.strokeStyle = hex(mix(border, 0xffffff, 0.35));
    ctx.lineWidth = 1.5;
    for (let i = 6; i < S - 6; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, 2);
      ctx.lineTo(i, 6);
      ctx.moveTo(i, S - 2);
      ctx.lineTo(i, S - 6);
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  return t;
}

function grimeTexture(): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, S, S);
    // Yumuşak, geniş lekeler
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = 14 + Math.random() * 46;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.04 + Math.random() * 0.07;
      gr.addColorStop(0, 'rgba(74,58,38,' + a.toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(74,58,38,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // İnce tanecik: ayak izi/toz hissi
    for (let i = 0; i < 240; i++) {
      const a = 0.015 + Math.random() * 0.025;
      ctx.fillStyle = 'rgba(58,44,28,' + a.toFixed(3) + ')';
      ctx.fillRect(Math.random() * S, Math.random() * S, 0.6 + Math.random(), 0.6 + Math.random());
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 6);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function tileTexture(base: number, alt: number, grout: number): THREE.CanvasTexture {
  /**
   * TAŞ KARO — eski hâli 256'lık tuvalde 4 × 4 DAMA TAHTASIYDI.
   *
   * İki sorunu vardı. (1) Derz 4 piksel/64 pikseldi, yani karo kenarının
   * %6'sı: gerçek bir karoda bu oran %1-2'dir ve fazlası döşemeyi "banyo
   * fayansı" yapar. (2) Katı dama deseni — açık/koyu tam sırayla —
   * gerçek taşta hiç görülmez; taşın imzası düzensiz TON OYNAMASI ve
   * beneklenmedir. Yeni sürüm 512'de 3 × 3 büyük karo, ince derz, karo
   * başına rastgele ton ve iki katmanlı benek kullanır.
   */
  const S = 512;
  const N = 3; // karo sayısı (kenar başına)
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');
  if (ctx) {
    const hash = (k: number, salt: number): number => {
      const x = Math.sin(k * 91.37 + salt * 47.13) * 21793.71;
      return x - Math.floor(x);
    };
    ctx.fillStyle = hex(grout);
    ctx.fillRect(0, 0, S, S);
    const c = S / N;
    const G = 3.2; // derz — karo kenarının ~%1,9'u
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const k = i * N + j;
        // Dama sırası KORUNUR ama zayıflar: taban ton yine değişir,
        // üstüne karo başına ±%18'lik serbest bir sapma biner.
        const chk = (i + j) % 2 === 0 ? 0.25 : 0.75;
        const tone = Math.min(1, Math.max(0, chk + (hash(k, 1) - 0.5) * 0.36));
        const col = mixSrgb(base, alt, tone);
        const x = i * c;
        const y = j * c;
        ctx.fillStyle = hex(col);
        ctx.fillRect(x + G / 2, y + G / 2, c - G, c - G);

        // Taş beneği: iki ölçekte, karo içine kırpılmış.
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + G / 2, y + G / 2, c - G, c - G);
        ctx.clip();
        for (let b = 0; b < 26; b++) {
          const bx = x + hash(k * 31 + b, 2) * c;
          const by = y + hash(k * 31 + b, 3) * c;
          const br = c * (0.03 + hash(k * 31 + b, 4) * 0.16);
          const dark = hash(k * 31 + b, 5) > 0.45;
          const rad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
          const a = 0.05 + hash(k * 31 + b, 6) * 0.07;
          rad.addColorStop(0, dark ? 'rgba(120,104,84,' + a.toFixed(3) + ')' : 'rgba(255,252,244,' + a.toFixed(3) + ')');
          rad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = rad;
          ctx.fillRect(bx - br, by - br, br * 2, br * 2);
        }
        // Kenar pahı: üstte ışık, altta gölge — karo "kalın" okunur.
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = 'rgba(255,255,248,0.4)';
        ctx.beginPath();
        ctx.moveTo(x + G / 2, y + G / 2 + 0.8);
        ctx.lineTo(x + c - G / 2, y + G / 2 + 0.8);
        ctx.moveTo(x + G / 2 + 0.8, y + G / 2);
        ctx.lineTo(x + G / 2 + 0.8, y + c - G / 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(90,76,56,0.24)';
        ctx.beginPath();
        ctx.moveTo(x + G / 2, y + c - G / 2 - 0.8);
        ctx.lineTo(x + c - G / 2, y + c - G / 2 - 0.8);
        ctx.moveTo(x + c - G / 2 - 0.8, y + G / 2);
        ctx.lineTo(x + c - G / 2 - 0.8, y + c - G / 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  return t;
}

/**
 * BARIN ARKASINDAKİ TEBEŞİR MENÜSÜ.
 *
 * Eski sürüm "MENÜ" başlığının altına ANLAMSIZ ÇİZGİLER koyuyordu:
 * uzaktan bakıldığında tahta bir menü değil, üstü çizilmiş boş bir pano
 * gibi duruyordu. Artık gerçek satırlar yazılır — şubenin kendi ürünleri,
 * gerçek fiyatlarıyla, noktalı dolgu ve sağa dayalı tutarla. Oyuncu bara
 * yaklaşınca okuyabilir; uzaktan da "burası bir menü" olarak okunur.
 *
 * Doku 1024 × 384: pano dünyada 4,8 × 1,8 birim, yani 43°lik portre
 * kamerada yaklaşık 250 piksel genişlik. 512'de başlık bulanıklaşıyordu.
 */
function menuTexture(accent: number, rows: { name: string; price: number }[]): THREE.CanvasTexture {
  const W = 1024;
  const H = 384;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#202b27';
    ctx.fillRect(0, 0, W, H);
    /** Tebeşir tozu: düz siyah bir dikdörtgen "tahta" değil "delik" okunur. */
    for (let i = 0; i < 90; i++) {
      const x = Math.sin(i * 12.9898) * 43758.5453;
      const y = Math.sin(i * 78.233) * 12345.6789;
      const bx = (x - Math.floor(x)) * W;
      const by = (y - Math.floor(y)) * H;
      const br = 18 + (x - Math.floor(x)) * 60;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, 'rgba(226,238,232,0.05)');
      g.addColorStop(1, 'rgba(226,238,232,0)');
      ctx.fillStyle = g;
      ctx.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    // ince çerçeve
    ctx.strokeStyle = 'rgba(240,232,210,0.22)';
    ctx.lineWidth = 5;
    ctx.strokeRect(16, 16, W - 32, H - 32);

    const cream = '#f3ead3';
    ctx.textBaseline = 'middle';
    // başlık
    ctx.textAlign = 'center';
    ctx.fillStyle = hex(mixSrgb(accent, 0xfff3d8, 0.55));
    ctx.font = '700 62px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(tr("M E N Ü"), W / 2, 64);
    ctx.strokeStyle = 'rgba(243,234,211,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W * 0.3, 104);
    ctx.lineTo(W * 0.7, 104);
    ctx.stroke();

    /**
     * Satır sayısı 5'te sabit tutulur: şube ürün eklendikçe punto
     * küçülmesin, taşan ürünler alta yazılmasın. Beşten azsa satır
     * aralığı korunur — menü "eksik" değil "az çeşitli" görünür.
     */
    const show = rows.slice(0, 5);
    const top = 148;
    const step = 46;
    ctx.font = '600 40px "Segoe UI", system-ui, sans-serif';
    for (let i = 0; i < show.length; i++) {
      const y = top + i * step;
      const r = show[i];
      const priceText = '₺' + r.price.toLocaleString(localeTag());
      ctx.textAlign = 'left';
      ctx.fillStyle = cream;
      ctx.fillText(r.name, 92, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = hex(mixSrgb(accent, 0xfff3d8, 0.62));
      ctx.fillText(priceText, W - 92, y);
      // noktalı dolgu — ad ile fiyat arasını bağlar
      const nameW = ctx.measureText(r.name).width;
      ctx.textAlign = 'left';
      const dotStart = 92 + nameW + 18;
      const dotEnd = W - 92 - ctx.measureText(priceText).width - 18;
      ctx.fillStyle = 'rgba(243,234,211,0.3)';
      for (let dx = dotStart; dx < dotEnd; dx += 16) ctx.fillRect(dx, y - 2, 4, 4);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* ---------------------------------------------- ödeme pedi levhası */

/**
 * Levha 2,3×0,86'dan 2,3×1,12'ye BÜYÜDÜ (doku 512×192 → 512×256).
 *
 * Kullanıcı geri bildirimi netti: "ne açılacağı belirtilmiyor, sadece
 * kapalı gözüküyor — ne açılacağını bilmeden uğraşmam." Ad ve bedelin
 * altına bölümün İÇERİĞİ girdi: istasyon simgeleri + iki satır tanıtım.
 * Büyüme YUKARI doğrudur: alt kenar eski yerinde kalır (aşağısı pedin
 * halkası ve karakterin kadrajı), merkez ona göre yükselir.
 */
/* ------------------------------------------------------------- görünüm */

export interface EnvironmentView {
  root: THREE.Group;
  setZoneUnlocked(zoneId: string, unlocked: boolean, animate: boolean): void;
  /**
   * Hijyen 0..100 → zeminin geneline yayılan kir katmanının opaklığı.
   * Hijyen bir HUD sayısı olmaktan çıkar, mekânda görünür.
   */
  setHygiene(v: number): void;
  /**
   * DEKORASYON — duvar boyası + salon zemini, ANINDA.
   *
   * Yeni mesh eklemez, mevcut malzemenin rengini / haritasını değiştirir:
   * çizim çağrısı sayısı DEĞİŞMEZ (bkz. data/cosmetics.ts). Panel açıkken
   * çağrılabilir; oyuncu seçtiği anda mekân değişsin diye böyle kuruldu.
   */
  setCosmetics(wall: WallSkin, floor: FloorSkin): void;
  /** Ped yalnız SIRADAKİ bölüm için görünür; uzaktakiler mekânı doldurmasın. */
  setPadVisible(zoneId: string, visible: boolean): void;
  /** Bekleyen ped yazılarını hemen boyar (yükleme ekranı, ilk kareden önce). */
  flushPadCaptions(): void;
  setPadProgress(zoneId: string, p: number): void;
  setPadLabel(zoneId: string, text: string): void;
  setPadActive(zoneId: string, active: boolean): void;
  /** Reveal the short hold instruction on approach, without another floating sign. */
  setPadNear(zoneId: string, near: boolean): void;
  /** Localized active-pad status; empty text restores the default hold hint. */
  setPadInstruction(zoneId: string, text: string): void;
  setPadAdOffer(zoneId: string, offer: 'finish' | 'pay_half' | null): void;
  /** Statik, opak çevreyi görsel olarak eşdeğer batch'lere indirir. */
  optimizeStatic(): { before: number; after: number };
  update(dt: number): void;
  dispose(): void;
}


export function createEnvironment(loc: LocationDef): EnvironmentView {
  const root = new VisibilityRoot();
  root.name = `env_${loc.id}`;
  root.matrixAutoUpdate = false;
  const pal = loc.palette;
  const { x0, z0, x1, z1 } = loc.bounds;
  const w = x1 - x0;
  const d = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;

  const ownMaterials: THREE.Material[] = [];
  const ownTextures: THREE.Texture[] = [];
  /** Birleştirilmiş (pişirilmiş) geometriler — önbellekten gelmez, burada ölür. */
  const ownGeometries: THREE.BufferGeometry[] = [];
  let staticBatch: StaticBatch | null = null;

  const track = <T extends THREE.Material>(m: T): T => {
    ownMaterials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    ownTextures.push(t);
    return t;
  };

  /* ---------------------------------------------------- boyanabilir sıva
   *
   * Duvar rengi oyuncunun seçtiği bir şey olduğu için sıva malzemeleri
   * PAYLAŞIMLI `mat()` önbelleğinden ALINAMAZ: o önbellek anahtarı yalnız
   * renk+pürüzlülük olduğundan, rengi yerinde değiştirmek aynı anahtarı
   * kullanan alakasız nesneleri de boyardı (mutfak dolabı, sokak binası…).
   *
   * Bunun yerine her sıva yüzeyi KENDİ malzemesini alır ve rengini duvar
   * renginden türeten bir formülü yanında taşır. Malzeme sayısı sabit
   * (5-8 arası, bölge sayısına bağlı) ve hepsi zaten `ownMaterials` ile
   * temizleniyor; çizim çağrısına etkisi YOK — mesh sayısı değişmiyor,
   * yalnız hangi malzemeye baktıkları değişiyor.
   */
  const paints: { m: THREE.MeshStandardMaterial; from: (wall: number) => number }[] = [];
  const paintMat = (
    from: (wall: number) => number,
    rough: number,
    metal = 0,
  ): THREE.MeshStandardMaterial => {
    const m = track(
      new THREE.MeshStandardMaterial({ color: from(pal.wall), roughness: rough, metalness: metal }),
    );
    paints.push({ m, from });
    m.userData.mutableColor = true;
    return m;
  };

  /* ================================================================ *
   *  1 · ZEMİN
   * ================================================================ */

  // dışarısı (kaldırım) — mekânın altından taşar
  const ground = detail(plane(w + 80, d + 80), mat(pal.ground, { rough: 1 }), cx, -0.04, cz);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  /* --------------------------------------------------------------- *
   *  ZEMİN GÖLGELEMESİ — dokunun üstüne KÖŞE RENGİ katmanı.
   *
   *  Bir döşeme dokusu ne kadar iyi olursa olsun 8 × 16 kez tekrar edince
   *  "duvar kâğıdı" okunur ve mekân düz görünür. Gerçek mekânları
   *  inandırıcı yapan iki şey dokuda DEĞİLDİR:
   *    1. DÜŞÜK FREKANSLI TON OYNAMASI — geniş, yumuşak açık/koyu alanlar
   *       (ışık dağılımı, aşınma, temizlik izi).
   *    2. DUVAR DİBİ KARARTISI — hiçbir köşe duvarın dibinde odanın
   *       ortası kadar aydınlık değildir; gölge haritası bunu vermez
   *       çünkü güneş tek yönlüdür ve kapalı köşeleri hesaplamaz.
   *
   *  İkisi de köşe rengine (`vertexColors`) yazılır: EK ÇİZİM ÇAĞRISI
   *  YOK, ek doku yok, kare başına maliyet sıfır. Tek bedel levha başına
   *  birkaç yüz köşe — GPU için görünmez.
   * --------------------------------------------------------------- */

  /** Duvar/bölme ayak izleri: köşe karartısı bunlara olan uzaklıktan gelir. */
  const shadeWalls: { x0: number; z0: number; x1: number; z1: number }[] = [
    // Dış kabuk — dört kenar, bant olarak
    { x0: x0 - 1, z0: z0 - 1, x1: x1 + 1, z1: z0 + 0.34 },
    { x0: x0 - 1, z0: z1 - 0.34, x1: x1 + 1, z1: z1 + 1 },
    { x0: x0 - 1, z0: z0 - 1, x1: x0 + 0.34, z1: z1 + 1 },
    { x0: x1 - 0.34, z0: z0 - 1, x1: x1 + 1, z1: z1 + 1 },
    ...(loc.partitions ?? []),
    ...roomWalls(loc).map((r) => ({ x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 })),
  ];

  /** Noktanın en yakın duvara uzaklığı (duvarın içindeyse 0). */
  function wallDistance(px: number, pz: number): number {
    let best = Infinity;
    for (const r of shadeWalls) {
      const dx = Math.max(r.x0 - px, 0, px - r.x1);
      const dz = Math.max(r.z0 - pz, 0, pz - r.z1);
      const dd = dx === 0 ? dz : dz === 0 ? dx : Math.hypot(dx, dz);
      if (dd < best) best = dd;
    }
    return best;
  }

  /** Geniş, yumuşak ton oynaması — üç sinüsün toplamı (0..1 civarı). */
  function floorNoise(px: number, pz: number): number {
    return (
      0.5 +
      0.26 * Math.sin(px * 0.29 + pz * 0.17) +
      0.15 * Math.sin(px * 0.13 - pz * 0.44 + 2.1) +
      0.09 * Math.sin(px * 0.81 + pz * 0.61 + 4.2)
    );
  }

  /** Hedef köşe aralığı (birim). 1,6 → 34 × 40'lık salonda ~21 × 25 bölme. */
  const FLOOR_SEG = 1.6;

  function floorGeometry(fw: number, fd: number, mx: number, mz: number): THREE.BufferGeometry {
    const sx = Math.max(1, Math.round(fw / FLOOR_SEG));
    const sz = Math.max(1, Math.round(fd / FLOOR_SEG));
    const g = new THREE.PlaneGeometry(fw, fd, sx, sz);
    ownGeometries.push(g);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      // Düzlem XY'de kurulur, sonra −90° döner: yerel +Y dünya −Z olur.
      const wx = mx + pos.getX(i);
      const wz = mz - pos.getY(i);
      let v = 0.94 + floorNoise(wx, wz) * 0.12;
      /**
       * Duvar dibi karartısı 1,3 birimde tamamen kaybolur. Daha geniş
       * denendi (2,2) ve mekân "kenarları yanmış" görünüyordu; daha dar
       * (0,7) ise köşe kadar bile yayılmadan bitiyor, çizgi gibi duruyordu.
       */
      const wd = Math.min(wallDistance(wx, wz), 1.3) / 1.3;
      v *= 0.78 + 0.22 * (wd * wd * (3 - 2 * wd));
      col[i * 3] = v;
      col[i * 3 + 1] = v;
      col[i * 3 + 2] = v;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }

  function floorSlab(
    rx0: number,
    rz0: number,
    rx1: number,
    rz1: number,
    tex: THREE.Texture,
    repeat: number,
    y = FLOOR_Y,
    shade = true,
  ): THREE.Mesh {
    const fw = rx1 - rx0;
    const fd = rz1 - rz0;
    const t = tex.clone();
    trackTex(t);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(fw / repeat, fd / repeat);
    t.anisotropy = tex.anisotropy;
    const m = track(
      new THREE.MeshStandardMaterial({ map: t, roughness: 0.86, metalness: 0, vertexColors: shade }),
    );
    const mx = (rx0 + rx1) / 2;
    const mz = (rz0 + rz1) / 2;
    const geo = shade ? floorGeometry(fw, fd, mx, mz) : plane(fw, fd);
    const slab = detail(geo, m, mx, y, mz);
    slab.rotation.x = -Math.PI / 2;
    slab.receiveShadow = true;
    root.add(slab);
    return slab;
  }

  const plankTex = trackTex(plankTexture(pal.floor, pal.floorAlt, mix(pal.floorAlt, 0x2a2118, 0.35)));
  /**
   * MUTFAK KAROSU DAHA DA KOYULDU (0,35/0,50 → 0,66/0,78).
   *
   * "Sıcak tut" düzeltmesi doğru yöndeydi ama yetmiyordu: karışım hâlâ
   * duvar tonuna (L* 94,6) yakın kalıyor, mutfak zemini genel bakışta
   * ZEMİN değil IŞIK KUTUSU gibi okunuyordu — parke iyileşince aradaki
   * fark iyice açıldı. Yeni karışım zemin ailesine yaklaşır (karo hâlâ
   * parkeden açık, yani "çalışma yüzeyi" okunaklılığı korunur) ve derz
   * bir tık daha koyu: karo deseni uzaktan da seçilir.
   */
  const tileTex = trackTex(
    tileTexture(
      loc.id === 'kose' ? 0xd8ccb8 : mix(pal.wall, pal.floor, 0.66),
      loc.id === 'kose' ? 0xcebfa8 : mix(pal.wall, pal.floorAlt, 0.78),
      loc.id === 'kose' ? 0x9e8d76 : mix(pal.floorAlt, 0x6f5c46, 0.6),
    ),
  );
  const deckTex = trackTex(plankTexture(mix(pal.floor, 0x8fa87f, 0.4), mix(pal.floorAlt, 0x7d9a70, 0.4), mix(pal.floorAlt, 0x2a3320, 0.4)));

  /**
   * Salon: balık sırtı parke.
   *
   * Tekrar aralığı 1,9 → 2,4 birim. 1,9 örgü hatası varken seçilmişti:
   * tuvalin yarısı boyanmadığı için "desen" aslında boşluklardı ve ölçüyü
   * küçültmek o boşlukları sıklaştırıp desen sanılıyordu. Örgü düzelince
   * gerçek tahta ekranda 26 × 13 piksele düşüyor, derzi mipmap yutuyordu.
   * 2,4'te geniş tahta 1,2 × 0,3 birim olur — hâlâ kafe
   * ölçeğinde bir parke tahtası, ama ek yeri ekranda görünür kalır.
   */
  // Köşe bankının altındaki ceviz döşeme bu dikdörtgen. Salon taşı burada
  // kesilir; yoksa duvar dibinde kararan taş, cevizin arasından kahverengi
  // lekeler halinde titrer.
  const loungeDeck = loc.id === 'kose' ? { x0: -8.84, z0: 8.2, x1: 8.84, z1: 11.4 } : null;
  const salonPieces: { mat: THREE.MeshStandardMaterial; fw: number; fd: number; px0: number; pz0: number; native: THREE.Texture }[] = [];
  const salonTile = 2.4;
  function addSalon(rx0: number, rz0: number, rx1: number, rz1: number): void {
    if (rx1 - rx0 < 0.05 || rz1 - rz0 < 0.05) return;
    const mesh = floorSlab(rx0, rz0, rx1, rz1, plankTex, salonTile);
    const pieceMat = mesh.material as THREE.MeshStandardMaterial;
    const map = pieceMat.map!;
    map.offset.set((rx0 - x0) / salonTile, (rz0 - z0) / salonTile);
    salonPieces.push({ mat: pieceMat, fw: rx1 - rx0, fd: rz1 - rz0, px0: rx0, pz0: rz0, native: map });
  }
  if (loungeDeck) {
    addSalon(x0, z0, x1, loungeDeck.z0);
    addSalon(x0, loungeDeck.z1, x1, z1);
    addSalon(x0, loungeDeck.z0, loungeDeck.x0, loungeDeck.z1);
    addSalon(loungeDeck.x1, loungeDeck.z0, x1, loungeDeck.z1);
  } else {
    addSalon(x0, z0, x1, z1);
  }

  /* ------------------------------------------------ salon zemini (kozmetik)
   *
   * Salon döşemesi TEK bir mesh ve TEK bir malzemedir; oyuncu zemin
   * seçince yalnız o malzemenin `map`'i değişir. Mesh eklenmediği için
   * çizim çağrısı sabittir. Dokular kimliğe göre önbelleğe alınır (en
   * fazla seçenek sayısı kadar, 5), ileri geri seçmek bellek şişirmez.
   *
   * MUTFAK KAROSU VE ODA DÖŞEMELERİ KOZMETİĞE DAHİL DEĞİL: mutfak bir
   * çalışma yüzeyi (karo/ahşap karşıtlığı okunaklılığın parçası),
   * odaların koyu parkesi de o odanın satın alma vaadi.
   */
  const floorTexCache = new Map<string, THREE.Texture>();
  let floorSkinId = '';

  function setFloorSkin(skin: FloorSkin): void {
    const key = skin.kind === 'native' ? '' : skin.id;
    if (key === floorSkinId) return;
    floorSkinId = key;
    if (key === '') {
      for (const p of salonPieces) {
        p.mat.map = p.native;
        p.mat.needsUpdate = true;
      }
      return;
    }
    for (const p of salonPieces) {
      const cacheKey = key + ':' + p.px0 + ':' + p.pz0;
      let t = floorTexCache.get(cacheKey);
      if (!t) {
        const src =
          skin.kind === 'tile'
            ? tileTexture(skin.base, skin.alt, skin.seam)
            : plankTexture(skin.base, skin.alt, skin.seam);
        trackTex(src);
        t = src;
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(p.fw / skin.repeat, p.fd / skin.repeat);
        t.offset.set((p.px0 - x0) / skin.repeat, (p.pz0 - z0) / skin.repeat);
        t.anisotropy = 8;
        floorTexCache.set(cacheKey, t);
      }
      p.mat.map = t;
      p.mat.needsUpdate = true;
    }
  }

  // mutfak: karo
  const k = loc.kitchen;
  const kitchenFloor = floorSlab(k.x0, k.z0, k.x1, loc.id === 'kose' ? loc.barZ - .68 : k.z1, tileTex, 2.0, FLOOR_Y + 0.012);
  if (loc.id === 'kose') {
    const finish = kitchenFloor.material as THREE.MeshStandardMaterial;
    finish.map = null;
    finish.color.setHex(0x7e8987);
    finish.roughness = .78;
  }
  if (loc.service) {
    const s = loc.service;
    floorSlab(s.x0, s.z0, s.x1, s.z1, tileTex, 2.0, FLOOR_Y + 0.012);
  }
  // teras: dış deck
  if (loc.terraceX > x0 + 1 && loc.terraceX < x1 - 1) {
    floorSlab(loc.terraceX, Math.max(z0, loc.aisle.z1), x1, z1, deckTex, 3.4, FLOOR_Y + 0.012);
  }

  /**
   * GENEL KİR KATMANI — hijyen düştükçe zemin gözle görülür kirlenir.
   *
   * Ayrık lekeler "şurada bir leke var" der; bu katman "burası kirli bir
   * mekân" der. Clean It'in çekirdek fantezisi ikincisidir: kir zemini
   * kaplar, temizlik bir AÇIĞA ÇIKARMA tatmini verir. Eskiden hijyen
   * yalnızca HUD'daki bir sayıydı — mekânda hiçbir karşılığı yoktu.
   *
   * Tek çizim, kare başına doku yüklemesi YOK: yalnız opaklık değişir.
   */
  const grimeTex = trackTex(grimeTexture());
  const grimeMat = track(
    new THREE.MeshBasicMaterial({
      map: grimeTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  const grime = detail(plane(x1 - x0, z1 - z0), grimeMat, (x0 + x1) / 2, 0.092, (z0 + z1) / 2);
  grime.rotation.x = -Math.PI / 2;
  grime.visible = false;
  markDynamic(grime);
  root.add(grime);

  /**
   * ZEMİN KUŞAĞI — salonu çerçeveleyen koyu kakma bordür.
   *
   * Tek parça bir zemin, ne kadar iyi dokulu olursa olsun, "döşenmiş" değil
   * "kaplanmış" görünür. Duvar diplerinden geçen ince bir kakma şerit
   * mekânı çerçeveler ve zemine kompozisyon verir — otel lobisi ve butik
   * kafe zeminlerinin standart imzası. Yalnız görsel; yürümeyi engellemez.
   */
  {
    const inlay = mat(mix(pal.floorAlt, 0x3a2a1c, 0.55), { rough: 0.82 });
    const iy = FLOOR_Y + 0.006;
    const m = 1.15; // duvardan uzaklık
    const t = 0.22; // şerit kalınlığı
    const ix0 = x0 + m;
    const ix1 = x1 - m;
    const iz0 = z0 + m;
    const iz1 = z1 - m;
    const band = (bx: number, bz: number, sx: number, sz: number): void => {
      const p = detail(plane(sx, sz), inlay, bx, iy, bz);
      p.rotation.x = -Math.PI / 2;
      root.add(p);
    };
    band((ix0 + ix1) / 2, iz0, ix1 - ix0, t);
    band((ix0 + ix1) / 2, iz1, ix1 - ix0, t);
    band(ix0, (iz0 + iz1) / 2, t, iz1 - iz0);
    band(ix1, (iz0 + iz1) / 2, t, iz1 - iz0);

    /**
     * ÖN SALON HALISI — mekânın renk çıpası.
     *
     * Palet bilerek dar bir değer aralığında kurulmuş (bkz. LocationDef
     * yorumu) ama sonuç "bej üstüne bej" oldu: zemin, duvar, branda ve dış
     * zemin hep aynı sıcak aileden. Masaların altına serilen büyük, koyu
     * ve markanın yeşiline çalan bir halı hem o tekdüzeliği kırar hem de
     * oturma alanını TANIMLAR — otel/kafe iç mimarisinin en ucuz, en
     * etkili hamlesi. Kenarında ince bir bordür şeridi var.
     */
    /**
     * HALI TONU: KOYU zemin + FİLDİŞİ bordür.
     *
     * İlk deneme zemini `mix(brand, floorAlt, 0.5)` ile ORTA DEĞERDE bir
     * zeytin yeşiline, bordürü de turuncu vurguya bağlamıştı. Sonuç halı
     * gibi değil, parkenin üstüne bulaşmış BÜYÜK BİR LEKE gibi okunuyordu:
     * orta değerdeki bir alan bej zeminden yeterince ayrılmaz, kirli
     * görünür; turuncu çerçeve de üstüne "koli bandı" hissi ekliyordu.
     *
     * Otel/lokanta halısının kuralı terstir: zemin AÇIK ise halı KOYU ve
     * doygun olur, çerçevesi de zeminden bir ton AÇIK (fildişi/krem)
     * çekilir. Böylece halı hem oturma alanını keser hem de kenarında
     * temiz bir "çerçeve" çizgisi bırakır.
     */
    const rugTex = trackTex(
      rugTexture(
        mix(pal.brand, 0x11251d, 0.34),
        mix(pal.brand, 0x08150f, 0.5),
        mix(0xf2e7cf, pal.brand, 0.12),
      ),
    );
    const rug = detail(
      plane(13.4, 3.5),
      track(new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.99 })),
      (x0 + x1) / 2,
      FLOOR_Y + 0.009,
      6.05,
    );
    rug.rotation.x = -Math.PI / 2;
    rug.receiveShadow = true;
    if (loc.id !== 'kose') root.add(rug);
  }

  /**
   * AVLU — iki odayı ayıran geçit şeridi.
   *
   * Bu şerit "artakalan boşluk" gibi durmamalı. Kendi taş döşemesi, koyu
   * bordürü ve iki yanında saksı kaideleri var: mekân salondan avluya,
   * avludan VIP terasına geçerken her seferinde ZEMİN DEĞİŞTİRİR — plan
   * tek düzlemde okunmaz. Yalnızca görsel; navigasyona hiç girmez.
   */
  const cy = loc.courtyard;
  if (cy) {
    floorSlab(cy.x0, cy.z0, cy.x1, cy.z1, tileTex, 1.7, FLOOR_Y + 0.016);
    const edgeMat = mat(mix(pal.wallTrim, pal.floorAlt, 0.35), { rough: 0.9 });
    // Bordür çizginin ÜSTÜNE oturur, ceviz döşemenin içine taşmaz. Eski kutu
    // bankın arkasındaki tahtayı kesiyor ve kahverengi leke olarak titriyordu.
    const edgeW = cy.x1 - cy.x0 + 0.3;
    const edgeD = 0.16;
    const edgeCx = (cy.x0 + cy.x1) / 2;
    root.add(detail(box(edgeW, 0.07, edgeD), edgeMat, edgeCx, 0.061, cy.z0 + edgeD / 2));
    root.add(detail(box(edgeW, 0.07, edgeD), edgeMat, edgeCx, 0.061, cy.z1 - edgeD / 2));

    /**
     * AVLU DÖŞEMESİ — omurganın boşluğu bir MOBİLYA sorunu değil ZEMİN
     * sorunuydu.
     *
     * Ölçüm: avlu 17,7 × 4,6 = 81 birim kare ve kadrajın tam ortasına
     * düşüyor; üstelik oyuncunun en çok geçtiği yer burası. Buraya mobilya
     * koymak yanlış cevaptı — avlu bir GEÇİT, iki odanın kapısı da buraya
     * açılıyor, ortasına konan her şey trafiğin içinde kalır. Doğru cevap
     * döşemeyi TASARLAMAK: gerçek avlularda boşluk mobilyayla değil taş
     * işçiliğiyle doldurulur.
     *
     * Üç katman, toplam 4 çizim çağrısı:
     *   1) ortada koyu çerçeveli bir taş panel ("taş halı"),
     *   2) panelin içinde açık renkli bir dolgu,
     *   3) tam merkezde küçük bir göbek taşı.
     * Hiçbiri yükseklik taşımaz (en kalını 6 mm), yani ne yürümeyi ne
     * görüş hattını etkiler — tavan kirişi dersinin tersi: kadrajı BÖLMEDEN
     * doldurmak.
     */
    /**
     * PANEL GENİŞLİĞİ KADRAJA GÖRE: 6,4 denendi, panel kadrajdan taşıyordu.
     * Yan kenarları hiç görünmediği için desen "taş halı" değil ekranı
     * boydan boya kesen YATAY ŞERİTLER olarak okunuyordu. 4,8'de en az bir
     * yan kenar daima kadrajın içinde kalıyor ve panel kapalı bir dikdörtgen
     * olarak okunuyor. (Portre kadrajın yarı genişliği ~4,3 birim.)
     */
    const panelX = Math.min(4.8, (cy.x1 - cy.x0) / 2 - 1.2);
    const panelZ = (cy.z1 - cy.z0) / 2 - 0.85;
    const ccx = (cy.x0 + cy.x1) / 2;
    const ccz = (cy.z0 + cy.z1) / 2;
    const paveDark = mat(mix(pal.wallTrim, pal.floorAlt, 0.2), { rough: 0.92 });
    /**
     * Dolgu taşı ÖLÇÜLEREK soğutuldu. İlk deneme `mix(wall, floorAlt, 0,4)`
     * ile 0xe3d3ba veriyordu; avlunun kendi karosunun tabanı ise 0xeadcc6 —
     * aralarında yalnız %5 parlaklık farkı vardı ve panelin içi hiç
     * okunmuyordu, geriye sadece koyu çerçeve kalıyordu. Duvar tonuna
     * bölme yeşilinden bir tutam katmak taşı ayrı bir MALZEME yapar:
     * çevresi sıcak bej karo, panel soğuk gri-yeşil taş.
     */
    const paveLight = mat(mix(pal.wall, pal.wallTrim, 0.16), { rough: 0.9 });
    // 1) koyu çerçeve
    const frame = detail(plane(panelX * 2, panelZ * 2), paveDark, ccx, 0.032, ccz);
    frame.rotation.x = -Math.PI / 2;
    root.add(frame);
    // 2) açık dolgu — çerçeveden 0,22 birim içeride
    const inner = detail(plane(panelX * 2 - 0.44, panelZ * 2 - 0.44), paveLight, ccx, 0.044, ccz);
    inner.rotation.x = -Math.PI / 2;
    root.add(inner);
    // 3) göbek taşı: 45° döndürülmüş kare — desene bir merkez verir
    const boss = detail(plane(1.5, 1.5), paveDark, ccx, 0.068, ccz);
    boss.rotation.x = -Math.PI / 2;
    boss.rotation.z = Math.PI / 4;
    root.add(boss);
    const bossIn = detail(plane(1.0, 1.0), mat(mix(pal.brand, pal.floor, 0.62), { rough: 0.88 }), ccx, 0.08, ccz);
    bossIn.rotation.x = -Math.PI / 2;
    bossIn.rotation.z = Math.PI / 4;
    root.add(bossIn);
    /**
     * Kaideli saksılar: geçidi çerçeveler, iki odayı birbirinden koparır.
     *
     * KONUM DÜZELTİLDİ (2026-08-14). Kaideler avlunun ORTA hizasındaydı
     * (z = 13,7) ve orası iki ayrı şeyin tam üstüydü:
     *   · r1/r2 ödeme pedleri (±7,8 · 13,7) — kaide pedin 0,15 birim
     *     yanında duruyor, yani fiilen pedin İÇİNDE bitiyordu. Ped
     *     çevresindeki erişim boşluğu bu projede sessiz ilerleme
     *     kilitlerinin bilinen kaynağıdır ve doğrulayıcı görmez.
     *   · Oda portalleri (z 12,0–15,4) — kaide kapı ağzında duruyordu.
     * Artık avlunun KUZEY köşelerinde: geçidi hâlâ çerçeveliyorlar ama
     * ne pede ne kapıya değiyorlar. Güney köşelerini `lantern` dekoru
     * karşılıyor (bkz. layouts.ts), böylece omurga iki ucundan da tanımlı.
     */
    const podMat = mat(mix(pal.wallTrim, 0xffffff, 0.28), { rough: 0.85 });
    const leafMat = mat(mix(pal.brand, 0x7fbf5a, 0.45), { rough: 0.9, flatShading: true });
    for (const px of [cy.x0 + 0.9, cy.x1 - 0.9]) {
      const pz = cy.z1 - 0.75;
      root.add(mesh(roundBox(0.62, 0.62, 0.62, 0.08), podMat, px, 0.31, pz));
      root.add(detail(sph(0.42, 8, 6), leafMat, px, 0.82, pz));
      root.add(detail(sph(0.26, 7, 5), leafMat, px + 0.22, 1.05, pz - 0.12));
    }

    /**
     * DENENDİ VE GERİ ALINDI — kapı ile avlu arasına "karşılama yolu".
     *
     * Giriş koridoruna avlununkiyle aynı sınıftan (koyu çerçeve + açık
     * dolgu + şeritler) bir döşeme paneli eklendi ve 375×812'de ÖLÇÜLDÜ:
     * sonuç daha kötüydü. Kadrajda avlu paneliyle bu yol neredeyse özdeş
     * iki soluk dikdörtgen olarak ALT ALTA geliyor — mekân "tasarlanmış
     * zemin" değil TEKRAR EDEN ŞERİT okunuyor; üstelik yolun büyük bölümü
     * giriş tentesinin arkasında kalıyor, yani bedeli ödenip görünmüyor.
     *
     * Ders (avlu panelininkiyle aynı): bir motif kadrajda BİR KEZ işe
     * yarar. İkinci kopyası boşluğu doldurmaz, motifi ucuzlatır. Giriş
     * çevresi zaten avlu paneli, şimşir kaideleri, banklar, bisiklet
     * standı ve palmiyeyle tanımlı; oradaki asıl boşluk mekânın DIŞINDA
     * kalan sokak bandıdır ve o bir dekor değil kamera kelepçesi
     * (`BALANCE.camera.southPad`) konusudur.
     */
  }

  /* ================================================================ *
   *  1c · DIŞARISI — SOKAK
   *
   *  Kadrajın büyük bölümü mekânın DIŞINDA kalıyor: pencerelerin ardı,
   *  duvarların üstü ve mekânı çevreleyen bant. Buralar tek düz bej bir
   *  zemindi ve kafe "boşlukta duran bir kat planı" gibi okunuyordu —
   *  "basit yapılmış gibi" hissinin en büyük kaynağı buydu.
   *
   *  Artık kafe bir SOKAKTA duruyor: kaldırım, karşı bina cepheleri,
   *  tenteler, sokak ağaçları ve lambalar. Hepsi oyun alanının dışında,
   *  navigasyona ve çarpışmaya hiç girmez; sadece derinlik ve bağlam verir.
   * ================================================================ */
  {
    const street = new StaticTransformRoot();
    street.name = 'street';
    root.add(street);

    /**
     * SOKAK TEK GEOMETRİYE PİŞİRİLİR.
     *
     * Cepheler + proplar ~400 ayrı mesh üretiyordu ve hepsi kalıcı olarak
     * statik: her kare ~400 çizim çağrısı + ~400 matris, yalnız fon için.
     * Parçalar önce geçici bir kurulum grubuna ESKİSİYLE AYNI kodla
     * çizilir, sonra malzeme (+gölge bayrağı) başına TEK mesh'e birleşir:
     * görsel çıktı bire bir aynı, çizim çağrısı ~400 → ~18.
     */
    const build = new THREE.Group();

    const kerbMat = mat(mix(pal.ground, 0xffffff, 0.34), { rough: 0.95 });
    const roadMat = mat(mix(pal.ground, 0x2e2a26, 0.55), { rough: 1 });
    const facadeTones = [
      mix(pal.wall, 0xb08a5c, 0.42),
      mix(pal.wall, 0x8a9bb0, 0.38),
      mix(pal.wall, 0xc08a72, 0.4),
      mix(pal.wall, 0x7f9c86, 0.36),
    ];
    const winMat = track(
      new THREE.MeshStandardMaterial({ color: 0x2b3a44, roughness: 0.25, metalness: 0.3 }),
    );
    const roofMat = mat(mix(pal.wallTrim, 0x2a1f18, 0.4), { rough: 0.9 });

    /**
     * Kaldırım bandı + asfalt: mekânı çerçeveler.
     *
     * ÖLÇÜ KAMERAYA GÖRE. İlk deneme gerçekçi bir cadde genişliği (3,2 + 7)
     * kullanıyordu ve karşı binalar x ≈ ∓20'ye düşüyordu: portre kamerada
     * kadrajın yatay yarı genişliği mekân düzleminde ~6-7 birim olduğu için
     * binalar EKRANA HİÇ GİRMİYORDU — bütün emek görünmez oldu. Sokak dar,
     * binalar yakın: yoğun bir şehir sokağı hem daha doğru hem de kadrajı
     * gerçekten dolduruyor.
     */
    const kerbW = 1.4;
    const roadW = 1.4;
    const ring = (mx: number, mz: number, sx: number, sz: number, m: THREE.Material, y: number): void => {
      const p = detail(plane(sx, sz), m, mx, y, mz);
      p.rotation.x = -Math.PI / 2;
      p.receiveShadow = true;
      build.add(p);
    };
    // kuzey ve batı: kameraya en çok görünen iki yön
    ring(cx, z0 - kerbW / 2, w + kerbW * 2, kerbW, kerbMat, -0.03);
    ring(x0 - kerbW / 2, cz, kerbW, d + kerbW * 2, kerbMat, -0.03);
    ring(x1 + kerbW / 2, cz, kerbW, d + kerbW * 2, kerbMat, -0.03);
    ring(cx, z1 + kerbW / 2, w + kerbW * 2, kerbW, kerbMat, -0.03);
    ring(cx, z0 - kerbW - roadW / 2, w + 30, roadW, roadMat, -0.06);
    ring(x0 - kerbW - roadW / 2, cz, roadW, d + 30, roadMat, -0.06);
    ring(x1 + kerbW + roadW / 2, cz, roadW, d + 30, roadMat, -0.06);
    /**
     * GÜNEY YOLU — kadrajın ALT bandı burasıdır.
     *
     * Kamera güneyde durup kuzeye baktığı için ekranın altı mekânın güney
     * kenarının ÖTESİDİR. Oyuncu VIP'in derinindeyken kadraj z 27,2'ye
     * kadar iniyor, mekân ise 21,2'de bitiyor: 6 birimlik boş zemin
     * ekranın ~%28'ini kaplıyordu. Kaldırım zaten vardı, yol ve karşı
     * cephe yoktu.
     */
    ring(cx, z1 + kerbW + roadW / 2, w + 30, roadW, roadMat, -0.06);

    /**
     * KARŞI BİNALAR. Tek tip blok sıkıcı olur: her cephe farklı genişlik,
     * yükseklik ve tonda; üstünde saçak, altında tente ve vitrin.
     */
    const facade = (fx: number, fz: number, fw: number, fh: number, rot: number, seed: number): void => {
      const g = new THREE.Group();
      g.position.set(fx, 0, fz);
      g.rotation.y = rot;
      build.add(g);
      const tone = facadeTones[seed % facadeTones.length];
      g.add(mesh(box(fw, fh, 2.6), mat(tone, { rough: 0.95 }), 0, fh / 2, 0));
      // saçak
      g.add(detail(box(fw + 0.5, 0.34, 3.0), roofMat, 0, fh + 0.17, 0));
      // kat pencereleri: iki sıra, cephe genişliğine göre sayı
      const cols = Math.max(2, Math.round(fw / 1.9));
      const rows = Math.max(1, Math.floor((fh - 2.4) / 1.9));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = -fw / 2 + ((c + 0.5) * fw) / cols;
          const wy = 2.5 + r * 1.9;
          if (wy + 0.6 > fh) continue;
          g.add(detail(box(fw / cols - 0.7, 1.05, 0.12), winMat, wx, wy, 1.36));
          g.add(detail(box(fw / cols - 0.5, 0.09, 0.2), roofMat, wx, wy - 0.6, 1.4));
        }
      }
      // zemin kat: vitrin + tente
      g.add(detail(box(fw - 1.0, 1.5, 0.12), winMat, 0, 1.15, 1.36));
      const awn = detail(box(fw - 0.6, 0.12, 1.15), mat(mix(pal.accent, tone, 0.35), { rough: 0.8 }), 0, 2.16, 1.86);
      awn.rotation.x = 0.22;
      g.add(awn);
    };

    /**
     * Cephe mesafesi. Kadrajın yatay yarı genişliği mekân düzleminde ~6-7,
     * kameraya yakın (güney) uçta ~12 birim; cepheler ±12,5'te durunca
     * portre kadrajın iki yanını da dolduruyor ama oyun alanını kesmiyor.
     */
    const off = kerbW + roadW + 0.7;
    // Kuzey cephesi (mutfağın arkası) — kadrajın üst bandını doldurur
    let fx = x0 - 6;
    let i = 0;
    while (fx < x1 + 6) {
      const fw = 4.5 + ((i * 37) % 5) * 0.8;
      facade(fx + fw / 2, z0 - off, fw, 6.5 + ((i * 53) % 4) * 1.4, Math.PI, i);
      fx += fw + 0.5;
      i++;
    }
    /**
     * GÜNEYE CEPHE KONULMAZ — DENENDİ, GERİ ALINDI (2026-08-11).
     *
     * Kamera güneyde durup kuzeye bakar, yani güney cephe sırası kameranın
     * ÖNÜNDE değil ARKASINDA kalır: oyuncu binaların çatısını ve arka
     * duvarını görür. Işın hesabı doğruydu (3,4–4,8 birimlik alçak sıra
     * VIP'i kapatmıyordu) ama sonuç boş zeminden daha iyi değildi —
     * kadrajın altı bu sefer pembe kutularla doldu.
     *
     * Cepheyi güneye bakacak şekilde çevirmek (fronts'u kameraya dönmek)
     * görsel olarak çalışırdı ama sokağın yanlış tarafına dükkân dizmek
     * demekti. Asıl sorun zaten dolgu eksikliği değil, kameranın mekân
     * dışına KAYMASIYDI: çözüm `Game.tick` içindeki odak kelepçesi.
     * Güney YOLU kalıyor (kaldırım+asfalt bandı zararsız dolgu).
     */
    // Batı ve DOĞU cepheleri — portre kadrajın iki yanını da doldurur
    for (const side of [-1, 1] as const) {
      let fz = z0 - 3;
      let k = side < 0 ? 3 : 1;
      while (fz < z1 + 6) {
        const fl = 5.0 + ((k * 29) % 4) * 0.9;
        facade(
          side < 0 ? x0 - off : x1 + off,
          fz + fl / 2,
          fl,
          6.0 + ((k * 41) % 5) * 1.2,
          (side * Math.PI) / 2,
          k,
        );
        fz += fl + 0.6;
        k++;
      }
    }

    /** Sokak ağaçları ve lambalar: kaldırım bandını canlandırır. */
    const trunkMat = mat(mix(pal.wallTrim, 0x6b4a2a, 0.6), { rough: 0.9 });
    const foliage = mat(mix(pal.brand, 0x76b45c, 0.5), { rough: 0.9, flatShading: true });
    const poleMat = mat(mix(pal.wallTrim, 0x1a2420, 0.3), { rough: 0.5, metal: 0.4 });
    const streetProp = (px: number, pz: number, kind: number): void => {
      if (kind % 2 === 0) {
        build.add(mesh(cyl(0.16, 0.2, 2.1, 7), trunkMat, px, 1.05, pz));
        build.add(detail(sph(1.05, 8, 6), foliage, px, 2.7, pz));
        build.add(detail(sph(0.72, 7, 5), foliage, px + 0.5, 3.25, pz - 0.3));
        build.add(detail(sph(0.6, 7, 5), foliage, px - 0.45, 3.1, pz + 0.35));
      } else {
        build.add(mesh(cyl(0.07, 0.09, 3.2, 6), poleMat, px, 1.6, pz));
        build.add(detail(box(0.9, 0.1, 0.22), poleMat, px + 0.4, 3.2, pz));
        build.add(detail(sph(0.18, 7, 5), basic(0xfff0c8, 1, true), px + 0.8, 3.08, pz));
      }
    };
    for (let k = 0; k < 8; k++) streetProp(x0 - kerbW / 2, z0 + 1 + k * 5.2, k);
    for (let k = 0; k < 8; k++) streetProp(x1 + kerbW / 2, z0 + 3.4 + k * 5.2, k + 1);
    for (let k = 0; k < 4; k++) streetProp(x0 + 2.5 + k * 5.0, z0 - kerbW / 2, k + 1);
    /**
     * GÜNEY KALDIRIMINA PROP KONULMAZ — DENENDİ, GERİ ALINDI (2026-08-11).
     *
     * Yükseklik hesabı doğruydu (ağaç 3,4 birim, görüş çizgisi z=22'de
     * y≈5,0) ama mesele yükseklik değil YAKINLIK: güney bandı kameraya en
     * yakın yerdir, oraya konan her şey ekranda devleşir. Ağaç VIP
     * masasını, direk terası kesti. Daha güneye taşımak İŞE YARAMAZ —
     * güneye gitmek kameraya YAKLAŞMAKTIR, yani daha da büyür.
     *
     * Tavan kirişlerinde öğrenilen dersin aynısı: oyun alanını kesen hiçbir
     * dolgu, boşluktan iyi değildir. Bant kaldırım+asfalt olarak kalıyor
     * (ekranın ~%22'si). Asıl çözüm dolgu değil, mekânı güneye doğru
     * OYNANABİLİR alanla uzatmaktır (ön teras) — ayrı bir iş.
     */

    /* ---------------- pişirme: kova başına tek mesh ----------------
     *
     * Kova anahtarı malzeme + gölge bayrakları: mesh() ile kurulanlar
     * gölge düşürür, detail() ile kurulanlar düşürmez — birleştirme bu
     * farkı EZMEMELİ (cephe gövdesinin yola düşen gölgesi korunur).
     * Geometriler paylaşımlı önbellekten geldiği için önce klonlanır,
     * dünya matrisi köklere kadar uygulanır (build bağımsız durduğundan
     * matrixWorld = sokağa göre yerel dönüşümdür).
     */
    // Keep each street block independently culled. A single merged mesh around
    // the entire map forced every offscreen facade through the GPU.
    const streetBatch = createStaticBatch(build, {cellSize:8, compact:true, bakeInstances:true});
    streetBatch.setActive(true);
    ownGeometries.push(...streetBatch.geometries);
    street.add(build);

    // Sokak sonsuza dek yerinde durur: matrisler bir kez yazılır, donar.
    street.updateMatrixWorld(true);
    street.traverse((o) => {
      o.matrixAutoUpdate = false;
    });
  }

  // kapı önü paspası
  const mat0 = detail(
    box(3.0, 0.03, 1.4),
    track(new THREE.MeshStandardMaterial({ color: mix(pal.wallTrim, 0x2a2118, 0.3), roughness: 1 })),
    loc.door.x,
    FLOOR_Y + 0.02,
    loc.door.z - 1.1,
  );
  mat0.receiveShadow = true;
  root.add(mat0);

  /* ================================================================ *
   *  2 · DUVARLAR VE PENCERELER
   *
   *  Uzak duvarlar (kuzey, batı) tam boy ve pencereli; yakın duvarlar
   *  (güney, doğu) bel hizasında, böylece kamera içeriyi görür.
   * ================================================================ */

  const wallMat = paintMat((c) => c, 0.94);
  const wainscotMat = paintMat((c) => loc.id === 'kose' ? mix(PREMIUM.ink,c,.12) : mix(pal.wallTrim,c,.35), .68);
  /**
   * BORDÜR BOYANMAZ. `wallTrim` mekânın kendi kimliğidir (Köşe'de koyu
   * yeşil, Sahil'de mavi) ve aynı zamanda sıvanın etrafındaki tek KOYU
   * çizgidir: duvar hangi renge boyanırsa boyansın yüzeyleri birbirinden
   * ayıran şey o. Kozmetiğe açılırsa oyuncu duvarı da bordürü de aynı
   * tona getirip mekânı tek düz levhaya çevirebilir.
   */
  const trimMat = mat(pal.wallTrim, { rough: 0.7 });
  const glassMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xdcf0f7,
      roughness: 0.06,
      metalness: 0.1,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    }),
  );
  const frameMat = mat(mix(pal.wallTrim, 0x1a2420, 0.35), { rough: 0.6 });

  /** Pencereli tam boy duvar: alt lambri + üstte camlar arasında kolonlar. */
  function tallWall(mx: number, mz: number, len: number, horizontal: boolean, windows: number): void {
    const g = new THREE.Group();
    g.position.set(mx, 0, mz);
    if (!horizontal) g.rotation.y = Math.PI / 2;
    root.add(g);

    // lambri (bel altı)
    g.add(mesh(box(len, WAINSCOT_H, WALL_T), wainscotMat, 0, WAINSCOT_H / 2, 0));
    g.add(detail(box(len, 0.1, WALL_T + 0.08), trimMat, 0, WAINSCOT_H, 0));
    // üst bant
    g.add(mesh(box(len, WALL_H - 2.55, WALL_T), wallMat, 0, WALL_H - (WALL_H - 2.55) / 2, 0));
    /**
     * KORNİŞ DUVARIN ÜSTÜNE OTURUR, İÇİNE GÖMÜLMEZ.
     *
     * Eskiden merkezi `WALL_H − 0,06` idi ve yarı yüksekliği 0,06: üst
     * yüzü tam olarak `WALL_H` = 3,30'a düşüyordu — yani duvar gövdesinin
     * üst yüzüyle NOKTASI NOKTASINA AYNI DÜZLEMDE. İki eş düzlemli yüz
     * derinlik tamponunda sırayla kazanır ve kamera kımıldadıkça duvarın
     * tepesi boydan boya yanıp sönen şeritlere dönüşür (ışın testiyle
     * doğrulandı: aynı ekran sütununda 3,30'da iki ayrı gövde). Oyuncunun
     * "üst kısımları pır pır titreyip duruyor" dediği hata buydu.
     *
     * Korniş artık duvarın tepesine BİNER (merkez `WALL_H`, yarı yükseklik
     * 0,07): üst yüzü 3,37'de, alt yüzü duvarın içinde. Eş düzlem yok.
     */
    g.add(detail(box(len, 0.14, WALL_T + 0.12), trimMat, 0, WALL_H, 0));

    // pencere dizisi
    const winW = (len - 1.2) / windows - 0.9;
    for (let i = 0; i < windows; i++) {
      const px = -len / 2 + 0.6 + (i + 0.5) * ((len - 1.2) / windows);
      g.add(detail(box(winW, 1.4, 0.08), glassMat, px, 1.78, 0));
      // çerçeve
      g.add(detail(box(winW + 0.16, 0.1, WALL_T * 0.7), frameMat, px, 1.06, 0));
      g.add(detail(box(winW + 0.16, 0.1, WALL_T * 0.7), frameMat, px, 2.5, 0));
      g.add(detail(box(0.1, 1.5, WALL_T * 0.7), frameMat, px - winW / 2, 1.78, 0));
      g.add(detail(box(0.1, 1.5, WALL_T * 0.7), frameMat, px + winW / 2, 1.78, 0));
      g.add(detail(box(0.07, 1.4, WALL_T * 0.6), frameMat, px, 1.78, 0));
      // pencere önü denizliği
      g.add(detail(box(winW + 0.3, 0.1, WALL_T + 0.16), wainscotMat, px, 1.03, 0));
    }
    // pencereler arası kolonlar
    for (let i = 0; i <= windows; i++) {
      const px = -len / 2 + 0.6 + i * ((len - 1.2) / windows);
      const colW = i === 0 || i === windows ? 1.2 : 0.9;
      g.add(mesh(box(colW, 1.5, WALL_T), wallMat, px, 1.78, 0));
    }
  }

  /** Bel hizasında alçak duvar: mekânın sınırını çizer, görüşü kesmez. */
  function lowWall(mx: number, mz: number, len: number, horizontal: boolean, gapAt?: number, gapW = 3.4): void {
    const segs: { c: number; l: number }[] = [];
    if (gapAt === undefined) segs.push({ c: 0, l: len });
    else {
      const left = gapAt - gapW / 2 - -len / 2;
      const right = len / 2 - (gapAt + gapW / 2);
      if (left > 0.2) segs.push({ c: -len / 2 + left / 2, l: left });
      if (right > 0.2) segs.push({ c: len / 2 - right / 2, l: right });
    }
    const g = new THREE.Group();
    g.position.set(mx, 0, mz);
    if (!horizontal) g.rotation.y = Math.PI / 2;
    root.add(g);
    for (const s of segs) {
      g.add(mesh(box(s.l, LOW_WALL_H, WALL_T), wainscotMat, s.c, LOW_WALL_H / 2, 0));
      g.add(detail(box(s.l, 0.12, WALL_T + 0.12), trimMat, s.c, LOW_WALL_H, 0));
    }
  }

  // kuzey (uzak) — mutfağın arkası
  if (loc.id === 'kose') {
    // The film's solid backbar replaces the central window wall.
    for(const side of [-1,1]) tallWall(side * 13.4, z0 + WALL_T / 2, 8.8, true, 2);
  } else tallWall(cx, z0 + WALL_T / 2, w, true, Math.max(3, Math.round(w / 7)));
  // batı (uzak)
  tallWall(x0 + WALL_T / 2, cz, d, false, Math.max(3, Math.round(d / 7)));
  // güney (yakın) — kapı boşluklu
  lowWall(cx, z1 - WALL_T / 2, w, true, loc.door.x - cx, 3.6);
  // doğu (yakın)
  lowWall(x1 - WALL_T / 2, cz, d, false);

  // kapı sövesi: alçak duvarda bile girişi belli eder
  const doorPost = makeInstanced(box(0.3, 2.5, 0.4), trimMat, 2, true);
  setInstance(doorPost, 0, loc.door.x - 1.9, 1.25, z1 - WALL_T / 2);
  setInstance(doorPost, 1, loc.door.x + 1.9, 1.25, z1 - WALL_T / 2);
  flushInstances(doorPost);
  root.add(doorPost);
  root.add(mesh(box(4.4, 0.34, 0.6), trimMat, loc.door.x, 2.62, z1 - WALL_T / 2));
  const awning = mesh(box(4.4, 0.1, 1.0), mat(mix(pal.accent, 0xffffff, 0.2), { rough: 0.8 }), loc.door.x, 2.86, z1 - 0.75);
  awning.rotation.x = 0.2;
  root.add(awning);

  /* ================================================================ *
   *  3 · MUTFAK SIRTI — makinelerin arkasındaki karo bant
   * ================================================================ */

  const backSplash = mesh(
    box(k.x1 - k.x0, 1.5, 0.16),
    paintMat((c) => mix(c, 0xffffff, 0.45), 0.4),
    (k.x0 + k.x1) / 2,
    1.05,
    k.z0 + 0.2,
  );
  if(loc.id !== 'kose') root.add(backSplash);
  if(loc.id !== 'kose') root.add(detail(box(k.x1 - k.x0, 0.1, 0.24), trimMat, (k.x0 + k.x1) / 2, 1.82, k.z0 + 0.2));
  /**
   * ASILI RAF + KAVANOZLAR KALDIRILDI (2026-08-19).
   *
   * Burada, mutfağın arka duvarında, y 2,25'te 15,7 birim uzunluğunda bir
   * raf ve üstünde sekiz kavanoz vardı. Sorun şu: bölüm 4'teki BAR ARKASI
   * VİTRİN DUVARI aynı duvara, aynı yüksekliklere (1,5 ve 2,22) kendi
   * raflarını ve fincanlarını kuruyor. İki katman üst üste biniyordu ve
   * bu raf tam olarak menü panosunun ortasından geçiyordu — oyuncunun
   * "menü yazan yerleri düzenleyelim" dediği karmaşa buydu. Vitrin duvarı
   * daha zengin ve pano ona göre hizalanmış; tekrar eden katman gidiyor.
   */

  /* ================================================================ *
   *  3b · TUVALET ODASI — salondan AYRI, duvarlı, kapılı
   *
   *  Şikâyet: "her şey tek odada, tuvaleti göremedim." Servis nişi
   *  gerçekten de mutfağın devamı gibi duruyordu. Artık üç tarafı kapalı,
   *  girişinde söve ve tabela olan ayrı bir oda.
   *
   *  Kamera +x+z'den baktığı için oda BU İKİ YÖNDE alçak duvarla
   *  kapatılır (içerisi görünmeye devam etsin), uzak taraf tam boy olur.
   * ================================================================ */

  if (loc.service) {
    const s = loc.service;
    // fayans sırtı (makinelerin arkasındaki bant gibi)
    root.add(mesh(box(s.x1 - s.x0, 1.5, 0.16), paintMat((c) => mix(c, 0xffffff, 0.45), 0.4), (s.x0 + s.x1) / 2, 1.05, s.z0 + 0.2));
    root.add(detail(box(s.x1 - s.x0, 0.1, 0.24), trimMat, (s.x0 + s.x1) / 2, 1.82, s.z0 + 0.2));

    const roomMat = paintMat((c) => mix(c, 0xffffff, 0.25), 0.7);
    const DOOR_X = 12.4; // geniş kemerli giriş: sarf raflarının servis noktası içeride kalsın
    const DOOR_W = 6.0;
    const WALL_Y = 2.5; // tam boy: uzak taraf
    const NEAR_Y = 1.05; // kameraya bakan taraf: bel hizası

    /* --- batı duvarı (uzak taraf, tam boy) --- */
    const wLen = s.z1 - s.z0;
    root.add(mesh(box(0.28, WALL_Y, wLen), roomMat, s.x0, WALL_Y / 2, (s.z0 + s.z1) / 2));
    root.add(detail(box(0.36, 0.1, wLen), trimMat, s.x0, WALL_Y, (s.z0 + s.z1) / 2));

    /* --- güney duvarı (kameraya bakan taraf, alçak + kapı boşluklu) --- */
    const leftW = DOOR_X - DOOR_W / 2 - s.x0;
    const rightW = s.x1 - (DOOR_X + DOOR_W / 2);
    if (leftW > 0.2) {
      root.add(mesh(box(leftW, NEAR_Y, 0.28), roomMat, s.x0 + leftW / 2, NEAR_Y / 2, s.z1));
      root.add(detail(box(leftW, 0.1, 0.36), trimMat, s.x0 + leftW / 2, NEAR_Y, s.z1));
    }
    if (rightW > 0.2) {
      root.add(mesh(box(rightW, NEAR_Y, 0.28), roomMat, s.x1 - rightW / 2, NEAR_Y / 2, s.z1));
      root.add(detail(box(rightW, 0.1, 0.36), trimMat, s.x1 - rightW / 2, NEAR_Y, s.z1));
    }

    /* --- kapı sövesi + üst kiriş + tabela --- */
    const jamb = makeInstanced(box(0.26, 2.3, 0.34), trimMat, 2, true);
    setInstance(jamb, 0, DOOR_X - DOOR_W / 2, 1.15, s.z1);
    setInstance(jamb, 1, DOOR_X + DOOR_W / 2, 1.15, s.z1);
    flushInstances(jamb);
    root.add(jamb);
    root.add(mesh(box(DOOR_W + 0.5, 0.34, 0.4), trimMat, DOOR_X, 2.45, s.z1));

    const wcSign = detail(
      plane(2.1, 0.4),
      sharedLabelMaterial(tr("TUVALET"), 0x1d2b34, 0xffe6b0, 2.1 / 0.4),
      DOOR_X,
      2.45,
      s.z1 + 0.22,
    );
    root.add(wcSign);
    // kapının üstünde küçük yeşil "açık" lambası
    root.add(detail(sph(0.1, 8, 6), basic(0x7ed957, 1, true), DOOR_X, 2.86, s.z1 + 0.1));
  }

  /* ================================================================ *
   *  3c · İÇ ODALAR — veri güdümlü duvarlar + kilitli kapılar
   *
   *  Duvar dikdörtgenleri `roomWalls(loc)`'tan gelir; World.rebuildNav
   *  AYNI listeden çarpışma yazar — görselle fizik kopamaz. Duvarlar bel
   *  hizasındadır (dik kamera içeriyi görmeye devam eder), kapı sövesi
   *  tam boydur. Oda kilitliyken kapı KAPALIDIR: iki kanat + KİLİTLİ
   *  levhası; bölüm satın alınınca kanatlar kaybolur.
   * ================================================================ */

  /**
   * Duvarlar odanın VURGU RENGİYLE boyanır: mor süpürgelikli oda "Salon",
   * altın süpürgelikli oda "VIP" diye uzaktan okunur ("ikisi de aynı, ne
   * olduğu belli değil" geri bildirimi). Kapılar KUZEY duvarındadır —
   * kamera güneyden baktığı için geniş yüzleri tam kameraya döner; doğu
   * duvarındaki ilk deneme kameraya kenardan görünüyordu ve oyuncu ortada
   * kapı olduğunu hiç anlamamıştı.
   */
  /**
   * VURGU DOZU DÜŞÜRÜLDÜ (0,34/0,45 → 0,13/0,20).
   *
   * Oda duvarları vurgu rengiyle %34-45 karıştırıldığında oda "boyanmış"
   * değil PLASTİK görünüyordu: Salon Odası'nın mor vurgusu duvarı, süpürgeliği
   * ve zeminini birden ele geçirip mekânın sıcak paletinden kopan LEYLAK bir
   * kutu üretiyordu — kadrajdaki en amatör tek eleman buydu.
   *
   * Pahalı mekânlar odaları RENKLE değil MALZEMEYLE ayırır. Vurgu artık
   * sadece bir ipucu: duvar mekânın sıvası olarak kalır, oda kimliğini
   * tabelası, döşemesi ve (VIP'te) pirinç süpürgeliği taşır.
   */
  const roomMats = new Map<string, { wainscot: THREE.Material; trim: THREE.Material }>();
  for (const z of loc.zones) {
    if (!z.room) continue;
    const accent = z.accent;
    roomMats.set(z.id, {
      wainscot: paintMat((c) => mix(mix(pal.wallTrim, c, 0.35), accent, 0.13), 0.86),
      trim: mat(mix(pal.wallTrim, z.accent, 0.2), { rough: 0.7 }),
    });
  }
  /** Odanın görsel zemin kotu (0 = ana kat). */
  const liftOf = (zoneId: string): number =>
    loc.zones.find((z) => z.id === zoneId)?.room?.lift ?? 0;

  /**
   * BÖLME DUVARLARI — ana salonu yan ek yapılardan ayırır.
   *
   * Oda duvarlarıyla aynı malzeme ve yükseklikte çizilir ama oda kilidine
   * bağlı DEĞİLDİR: her zaman durur, yalnız portal boşluklarında kesilir
   * (boşluklar `LocationDef.partitions` içinde "eksik dikdörtgen" olarak
   * ifade edilir). Çarpışma tarafı aynı diziden okunur — bkz. rebuildNav.
   */
  for (const w of loc.partitions ?? []) {
    const wx = (w.x0 + w.x1) / 2;
    const wz = (w.z0 + w.z1) / 2;
    const lx = w.x1 - w.x0;
    const lz = w.z1 - w.z0;
    root.add(mesh(box(lx, LOW_WALL_H, lz), wainscotMat, wx, LOW_WALL_H / 2, wz));
    root.add(detail(box(lx + 0.08, 0.12, lz + 0.08), trimMat, wx, LOW_WALL_H, wz));
  }

  /** Odanın çizim karakteri — 'teras' duvar yerine korkuluk çizdirir. */
  const styleOf = (zoneId: string): 'oda' | 'teras' | 'restroom' =>
    loc.zones.find((z) => z.id === zoneId)?.room?.style ?? 'oda';

  for (const w of roomWalls(loc)) {
    // Bölme duvarlarıyla (partitions) çakışan oda duvarlarını atla — yoksa iki eş
    // kutu üst üste biner ve şiddetli z-fighting (titreme) yapar.
    const isVert = Math.abs(w.x1 - w.x0) < Math.abs(w.z1 - w.z0);
    const overlapsPartition = (loc.partitions ?? []).some((p) => {
      const pVert = Math.abs(p.x1 - p.x0) < Math.abs(p.z1 - p.z0);
      if (isVert !== pVert) return false;
      if (isVert) {
        const xDist = Math.abs((w.x0 + w.x1) / 2 - (p.x0 + p.x1) / 2);
        const zOverlap = Math.min(w.z1, p.z1) - Math.max(w.z0, p.z0);
        return xDist < 0.25 && zOverlap > 0.3;
      } else {
        const zDist = Math.abs((w.z0 + w.z1) / 2 - (p.z0 + p.z1) / 2);
        const xOverlap = Math.min(w.x1, p.x1) - Math.max(w.x0, p.x0);
        return zDist < 0.25 && xOverlap > 0.3;
      }
    });
    if (overlapsPartition) continue;

    const rm = roomMats.get(w.zone);
    const wain = rm ? rm.wainscot : wainscotMat;
    const trim = rm ? rm.trim : trimMat;
    const wx = (w.x0 + w.x1) / 2;
    const wz = (w.z0 + w.z1) / 2;
    const lx = w.x1 - w.x0;
    const lz = w.z1 - w.z0;
    // Yükseltilmiş odanın duvarı da yükselir; taban aynı kalırsa duvar
    // yarı gömülü görünür. Yükselti kadar UZAR (aşağısı istinat duvarı).
    const lift = liftOf(w.zone);

    if (styleOf(w.zone) === 'teras') {
      /**
       * AÇIK TERAS: kaide dolu, üstü KORKULUK.
       *
       * Çarpışma değişmez (aynı `roomWalls` dikdörtgeni), yalnız görünüm
       * açılır: arkadaki mekân parmaklıkların arasından görünür, böylece
       * teras "kutu" değil "yüksek bir platform" gibi okunur.
       */
      if (lift > 0) {
        // Podyumun üst yüzü tam y=lift'tir. İstinat duvarı da aynı kota
        // çıkınca 15 cm'lik bant iki opak yüz tarafından paylaşılır.
        // Etek, döşemenin 2 cm altında biter.
        const skirt = lift - 0.02;
        root.add(mesh(box(lx, skirt, lz), wain, wx, skirt / 2, wz));
      }
      const room = loc.zones.find((z) => z.id === w.zone)!.room!;
      const railH = Math.abs(wz - room.z1) < 0.35 ? 0.3 : 0.52;
      const along = Math.max(lx, lz); // duvarın uzun ekseni
      const horiz = lx >= lz; // x boyunca mı uzanıyor
      // Küpeşte (üst) + ara kuşak (alt) — ikisi de ince, aradan görünür.
      const barGeo = horiz ? box(along, 0.1, 0.16) : box(0.16, 0.1, along);
      root.add(detail(barGeo, trim, wx, lift + railH, wz));
      root.add(
        detail(horiz ? box(along, 0.07, 0.12) : box(0.12, 0.07, along), trim, wx, lift + 0.26, wz),
      );
      /**
       * Dikmeler ~1,05 birimde bir. Sıklık ölçüyle seçildi: 0,5'te
       * parmaklıklar dikey kamerada birleşip dolu duvara dönüyor (yani
       * kazanç sıfır), 2,0'da korkuluk "iki direk" gibi seyrekleşiyor.
       */
      const n = Math.max(2, Math.round(along / 1.05) + 1);
      const posts = makeInstanced(box(0.11, railH, 0.11), trim, n, true);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const px = horiz ? w.x0 + lx * t : wx;
        const pz = horiz ? wz : w.z0 + lz * t;
        setInstance(posts, i, px, lift + railH / 2, pz);
      }
      flushInstances(posts);
      root.add(posts);
      continue;
    }

    const room = loc.zones.find((z) => z.id === w.zone)!.room!;
    const h = (Math.abs(wz - room.z1) < 0.35 ? 0.3 : 0.62) + lift;
    root.add(mesh(box(lx, h, lz), wain, wx, h / 2, wz));
    root.add(detail(box(lx + 0.08, 0.12, lz + 0.08), trim, wx, h, wz));
  }


  // Cutaway entrances keep the character and the next room visible.
  const roomDoors = new Map<string, { closed: THREE.Group; lock: THREE.Object3D; strip: THREE.Object3D | null }>();
  for (const z of loc.zones) {
    const r = z.room;
    if (!r) continue;
    const rm = roomMats.get(z.id)!;
    const d = r.door;
    const lift = r.lift ?? 0;
    const dx = d.edge === 'n' ? d.pos : d.edge === 'w' ? r.x0 : r.x1;
    const dz = d.edge === 'n' ? r.z0 : d.pos;
    const dw = d.w;
    const side = d.edge === 'w' ? -1 : 1;
    const along = (v: number) => d.edge === 'n' ? { x: dx + v, z: dz } : { x: dx, z: dz + v };
    const portal = new THREE.Group();
    portal.name = 'roomEntrance_' + z.id;
    portal.position.y = lift;
    root.add(portal);
    for (const side of [-1, 1]) {
      const p = along(side * dw / 2);
      portal.add(mesh(box(0.28, 0.62, 0.28), rm.wainscot, p.x, 0.31, p.z));
      portal.add(detail(box(0.34, 0.07, 0.34), rm.trim, p.x, 0.655, p.z));
    }
    const rcx = (r.x0 + r.x1) / 2;
    const rcz = (r.z0 + r.z1) / 2;
    const title = detail(
      plane(3.4, 0.7),
      sharedLabelMaterial(z.name, mixSrgb(z.accent, 0x141c22, 0.72), 0xffeccc, 3.4 / 0.7, true),
      d.edge === 'w' ? r.x0 + 2.1 : d.edge === 'e' ? r.x1 - 2.1 : rcx,
      0.052, d.edge === 'n' ? r.z0 + 1.2 : dz - 0.45,
    );
    title.name = 'roomFloorTitle_' + z.id;
    title.rotation.x = -Math.PI / 2;
    portal.add(title);

    // The gate signals the boundary without masking the room preview.
    const closed = new THREE.Group();
    closed.name = 'roomGate_' + z.id;
    closed.userData.batchExclude = true;
    const gateGeo = d.edge === 'n' ? box(dw - 0.28, 0.12, 0.1) : box(0.1, 0.12, dw - 0.28);
    closed.add(mesh(gateGeo, rm.trim, dx, 0.48, dz));
    closed.add(mesh(gateGeo, rm.trim, dx, 0.22, dz));
    portal.add(closed);
    const lockGrp = new THREE.Group();
    lockGrp.userData.batchExclude = true;
    lockGrp.position.set(dx, 0.55, dz + 0.1);
    lockGrp.rotation.x = -0.45;
    const gold = mat(0xd4a017, { rough: 0.35, metal: 0.6 });
    lockGrp.add(detail(roundBox(0.26, 0.2, 0.1, 0.04), gold, 0, 0, 0));
    lockGrp.add(detail(new THREE.TorusGeometry(0.085, 0.026, 6, 12, Math.PI), gold, 0, 0.11, 0));
    portal.add(lockGrp);
    roomDoors.set(z.id, { closed, lock: lockGrp, strip: null });

    /**
     * ODA ZEMİNİ — DOKULU.
     *
     * Eski hâli tek düz renkli bir plane'di ve mekân içindeki TEK dokusuz
     * yüzeydi; "yarım kalmış placeholder" okunmasının teknik sebebi buydu.
     * Ayrıca kilit açılınca da kalıyordu: açık Salon Odası'nın zemini
     * parke dokulu ana salonun yanında bitmemiş duruyordu.
     *
     * Artık her oda kendi DÖŞEMESİNE sahip: VIP'te bordo halı dokusu,
     * salonda ana parkenin oda vurgusuyla karışmış sıcak bir tonu — ikisi
     * de gerçek doku, kenarında bordür şeridiyle.
     */
    /**
     * VIP ZEMİNİ KIRMIZI KARO DEĞİL KOYU CEVİZ PARKE.
     *
     * İlk sürüm parlak kırmızı karo + altın derzdi; sonuç "lüks salon"
     * değil KUMARHANE HALISI okunuyordu (devshot f2-42). Kırmızıyı zemine
     * yaymak, odadaki bordo kadife koltukları ve masa altı halılarını da
     * yutuyordu — kırmızı üstünde kırmızı görünmez.
     *
     * Lüks yemek salonunun klasik reçetesi terstir: KOYU ahşap zemin,
     * üstünde doygun kadife ve pirinç. Zemin koyulaşınca hem masa altı
     * bordo halılar hem altın halkalar ilk kez ayrı ayrı okunur.
     *
     * 2026-08-11 — VIP KAPALI ODA OLMAKTAN ÇIKIP AÇIK TERAS OLDU, zemin de
     * onu izliyor: koyu ceviz parke İÇERİDE okunur, açık havada okunmaz.
     * Yerine açık MERMER karo geldi. Yukarıdaki ders korunuyor: kırmızı
     * karonun hatası zeminin mobilyayla AYNI renk olmasıydı; açık mermer
     * bordo kadifenin tam karşıtıdır, yani halılar ve altın daha da ayrışır.
     * Kareler bilerek birbirine çok yakın iki tonda (0xeae4d6 / 0xe2dbca):
     * belirgin bir dama deseni mekânı yine kalabalıklaştırırdı.
     */
    /**
     * KAPALI ODA = SICAK KOYU AHŞAP, TERAS = AÇIK MERMER.
     *
     * İki oda eskiden aynı şablonun iki kopyasıydı ve tek farkları vurgu
     * rengiydi ("kilitli olan 2 oda yan yana çok kötü gözüküyor"). Artık
     * DÖRT eksende ayrışıyorlar: konum, kot (0 / +0,9), kapalılık (dolu
     * duvar / korkuluk) ve malzeme.
     *
     * Zemin o dört eksenden en güçlüsü, çünkü dikey kadrajda piksellerin
     * ~yarısı zemindir. Salon odası ana salondan (0xd8bb92, L* 77) belirgin
     * KOYU bir cevize iner — içeri girilen, kapalı, samimi bir yer hissi
     * buradan gelir; VIP terası ise tam tersine ana salondan AÇIK mermere
     * çıkar. İki oda aynı kadraja girmese bile hafızada ayrışır.
     *
     * Duvarı yükselterek "kapalılık" vermek DENENEMEZ: kamera güneyden
     * kuzeye bakar, odanın güney duvarı kamerayla oda arasındadır ve
     * yükseltilirse odanın içini keser (tavan kirişlerinde öğrenilen ders).
     */
    /**
     * ODA PARKESİ MEKÂNIN PALETİNDEN TÜRETİLİR — elle yazılmış tondan değil.
     *
     * Eski değerler (0xa97548 / 0x96683f / derz 0x432c1a) palete bağlı
     * değildi ve derz neredeyse siyahtı. Örgü hatası düzeltilmeden önce o
     * koyu derz tuvalin yarısını kaplıyor, oda zemini "dama tahtası" olarak
     * okunuyordu. Örgü düzeldiği için derz artık yalnız 2 pikselik ek
     * yerinde görünüyor; yine de ana salonun derziyle AYNI aileden seçildi
     * ki iki zemin akraba dursun.
     *
     * Ton ilişkisi bilinçli: oda, ana salonun (L* ~77) belirgin biçimde
     * KOYU bir akrabası (L* ~57). "İçeri girilen kapalı yer" hissi tonun
     * değerinden gelir, renginden değil — bölge vurgusu yalnızca %8
     * karıştırılır (mor duvar dersinin aynısı: vurgu doz aşımı odayı
     * mekânın paletinden koparıyor).
     */
    const roomPlankBase = loc.id === 'kose' ? 0x9c7755 : mix(mix(pal.floor, 0x4a2c14, 0.42), z.accent, 0.08);
    const roomPlankAlt = loc.id === 'kose' ? 0x906c4d : mix(mix(pal.floorAlt, 0x3a2010, 0.46), z.accent, 0.1);
    const roomFloorTex = trackTex(
      (z.room?.style ?? 'oda') === 'teras'
        ? tileTexture(0xeae4d6, 0xe2dbca, 0xc3b8a4)
        : loc.id === 'kose' ? premiumFloorTexture('oak') : plankTexture(roomPlankBase, roomPlankAlt, mix(pal.floorAlt, 0x2a2118, 0.5)),
    );
    roomFloorTex.wrapS = THREE.RepeatWrapping;
    roomFloorTex.wrapT = THREE.RepeatWrapping;
    const rfw = r.x1 - r.x0 - 0.7;
    const rfd = r.z1 - r.z0 - 0.7;
    /**
     * TAHTA ÖLÇÜSÜ ANA SALONLA AKRABA: tekrar aralığı 4,2 → 2,2 birim.
     *
     * 4,2'de bir tahta 1,05 × 0,53 birime çıkıyordu — ana salonunkinin
     * (0,48 × 0,24) iki katından fazla. Aynı mekânda iki kat büyük tahta
     * "başka bir bina" gibi okunur ve desen iri bloklara dönüşerek dama
     * tahtası izlenimini büyütür. 2,2, salonun 1,9'una yakın durur; küçük
     * fark odanın kendi döşemesi olduğunu söylemeye yeter.
     */
    roomFloorTex.repeat.set(rfw / (loc.id === 'kose' ? 9.33 : 2.2), rfd / (loc.id === 'kose' ? 6.03 : 2.2));
    const overlay = detail(
      plane(rfw, rfd),
      track(new THREE.MeshStandardMaterial({ map: roomFloorTex, roughness: 0.9 })),
    );
    overlay.rotation.x = -Math.PI / 2;
    const roomY = 0.03 + lift;
    overlay.position.set(rcx, roomY, rcz);
    overlay.receiveShadow = true;
    root.add(overlay);
    // Kenar bir halkadır: döşemeyle aynı yükseklikte ama XZ'de üst üste binmez.
    const borderMat = mat(mix(z.accent, 0x2a2118, 0.45), { rough: 0.9 });
    const outerW = rfw + 0.36;
    const outerD = rfd + 0.36;
    const bt = 0.16;
    const band = (w: number, d: number, x: number, z: number): void => {
      const b = detail(plane(w, d), borderMat, x, roomY, z);
      b.rotation.x = -Math.PI / 2;
      root.add(b);
    };
    band(outerW, bt, rcx, rcz - (outerD - bt) / 2);
    band(outerW, bt, rcx, rcz + (outerD - bt) / 2);
    band(bt, outerD - bt * 2, rcx - (outerW - bt) / 2, rcz);
    band(bt, outerD - bt * 2, rcx + (outerW - bt) / 2, rcz);

    /**
     * YÜKSELTİ: PODYUM + MERDİVEN.
     *
     * Kot farkı yalnız görseldir (nav 2B) ama mekânı tek düzlem olmaktan
     * çıkaran en ucuz mimari araçtır — "3-5 basamaklı bir merdiven koyup
     * farklı bir alan eklenebilirdi" geri bildiriminin karşılığı.
     */
    if (lift > 0) {
      // Podyum gövdesi: zeminin altını dolduran kütle (kenardan bakınca
      // oda "havada duran bir levha" gibi görünmesin).
      const podium = detail(
        box(r.x1 - r.x0, lift, r.z1 - r.z0),
        mat(mix(pal.wallTrim, z.accent, 0.3), { rough: 0.9 }),
        rcx,
        lift / 2,
        rcz,
      );
      podium.receiveShadow = true;
      root.add(podium);

      /**
       * Kapı boşluğunun ÖNÜNDE beş basamak — oyuncunun çıktığı yer.
       *
       * Üçtü; 0,9 kotta basamak başına 0,30 birim düşüyor ve merdiven değil
       * "üç kalın blok" gibi duruyordu. Beş basamak 0,18'lik gerçekçi bir
       * rıht verir. Toplam ilerleme 5 × 0,34 = 1,7 birim; VIP'in kuzeyindeki
       * avlu şeridi (z 14,2–16,2) tam da bunu karşılar — "artakalan yer"
       * böylece merdiven sahanlığına dönüşür.
       */
      const steps = 5;
      const stepMat = mat(mix(pal.wallTrim, z.accent, 0.42), { rough: 0.85 });
      const stepDepth = 0.34;
      const riser = lift / steps;
      // Tam boy kutular yan yüzleri ve rıhtları aynı düzlemde paylaşıyordu.
      // Her basamak yalnız kendi rıhtı kadar kalın; 4 cm'si bir sonrakinin
      // (sonuncusu podyumun) içine gömülür, görünen yüz tek kalır.
      const tuck = 0.04;
      const crown = Math.min(0.02, riser * 0.4);
      const run = stepDepth + tuck;
      // Söve ve cam direği kapı ağzında. Basamak onlara değmesin.
      const w = Math.max(0.8, d.w - 0.5);
      for (let i = 0; i < steps; i++) {
        const h = riser * (i + 1);
        const top = i === steps - 1 ? h - crown : h;
        // En alt rıht avlu/salon döşemesinin (y ≤ 0,02) üstünde başlar.
        // Son basamak podyumun İÇİNE girmez: iki üst yüz aynı izde titriyordu.
        const base = i === 0 ? Math.min(0.03, h * 0.35) : h - riser;
        const height = Math.max(0.01, top - base);
        const y = base + height / 2;
        const reach = i === steps - 1 ? stepDepth - 0.02 : run;
        if (d.edge === 'n') {
          const nose = r.z0 - stepDepth * (steps - i);
          const st = detail(box(w, height, reach), stepMat, d.pos, y, nose + reach / 2);
          st.receiveShadow = true;
          root.add(st);
        } else {
          const nose = dx + side * stepDepth * (steps - i);
          const st = detail(box(reach, height, w), stepMat, nose - side * reach / 2, y, dz);
          st.receiveShadow = true;
          root.add(st);
        }
      }
    }
  }

  /* ================================================================ *
   *  3d · TAVAN KİRİŞİ — DENENDİ VE GERİ ALINDI.
   *
   *  Sarkıt kordonları boşlukta bitiyor (sahnede tavan yok) ve denetim
   *  bunu "yerden biten direkler gibi okunuyor" diye işaretlemişti.
   *  Çözüm olarak enine ahşap kirişler eklendi — ÖLÇÜLDÜ ve daha kötü
   *  çıktı: 43°lik portre kamerada kirişler oyun alanının tam ortasından
   *  geçip mekânı üç şeride bölüyor, karakteri ve masaları kesiyordu.
   *  (Menü tahtası için yukarıda anlatılan hatanın birebir aynısı.)
   *
   *  Tavansız sahne kalıyor: sarkıtlar kısa düşüşlü avize olarak okunuyor
   *  ve kadrajı hiçbir şey kesmiyor. Üst bandı doldurmak gerekirse çözüm
   *  KUZEY DUVARININ ARKASINA silüet koymaktır (kadrajın içine değil).
   * ================================================================ */

  /* ================================================================ *
   *  4 · BARIN ÜSTÜNDEKİ ASILI MENÜ
   * ================================================================ */

  /**
   * MENÜ PANOSU VE BAR ARKASI VİTRİNİ — TEK KOMPOZİSYON.
   *
   * Eskiden ikisi ayrı ayrı kuruluyordu ve sonuç karmaşaydı: pano
   * lambrinin ÜSTÜNE değil İÇİNE düşüyor, raflardaki fincan sıraları
   * "MENÜ" yazısının tam ortasından geçiyordu ("menü yazan yerleri
   * düzenleyelim"). Artık raflar panonun İKİ YANINDA durur, pano da
   * lambrinin önünde asılı bir levha olarak okunur.
   */
  {
    const back = new THREE.Group();
    /**
     * Z 0,30 → 0,55. Lambri paneli mutfak sırtındaki karo bandın ve onun
     * üst kuşağının (y 1,82, derinlik 0,24) İÇİNDE bitiyordu: kuşak
     * panelin 1 cm önüne çıkıp panelin ortasından geçen bir çizgi
     * bırakıyordu. 0,25 birim öne alınca üç katman da birbirinden ayrılır.
     */
    back.position.set(cx, 0, k.z0 + 0.55);
    if(loc.id !== 'kose') root.add(back);
    const panelW = Math.min(w - 2.0, 15.0);
    const woodDark = mat(mix(pal.wallTrim, 0x3a2a1a, 0.42), { rough: 0.82 });
    const woodWarm = mat(mix(pal.wallTrim, 0x8a5f34, 0.6), { rough: 0.78 });

    /**
     * Dikey lambri: DOLU panel + üstünde çıtalar.
     *
     * Yalnız çıta koyulunca (0,14 çıta / 0,34 aralık) arasından duvar
     * görünüyor ve kaplama değil ÇİT gibi okunuyordu. Arkada dolu bir
     * panel, önünde birbirine yakın çıtalar: aradaki ince gölge çizgisi
     * "ahşap kaplama" imzasıdır.
     */
    back.add(mesh(box(panelW, 2.6, 0.1), mat(mix(pal.wallTrim, 0x2a1d12, 0.5), { rough: 0.9 }), 0, 1.4, -0.04));
    const n = Math.floor(panelW / 0.32);
    const slat = makeInstanced(box(0.26, 2.5, 0.08), woodDark, n, true);
    for (let i = 0; i < n; i++) setInstance(slat, i, -panelW / 2 + 0.16 + i * 0.32, 1.45, 0.03);
    flushInstances(slat);
    back.add(slat);
    back.add(detail(box(panelW + 0.3, 0.14, 0.16), woodWarm, 0, 2.79, 0.02));

    /* ------------------------------------------------ menü panosu ---- */
    /**
     * Menü satırları ŞUBENİN GERÇEK ÜRÜNLERİNDEN gelir: `menuOrder`
     * verilmiş makineler menüdedir, sırası da odur. Sahte satır yazmak
     * yerine veriyi okumak, şube değişince menünün de değişmesi demek.
     */
    const menuRows = locationStations(loc.id)
      .filter((st) => st.item !== undefined && st.menuOrder !== undefined)
      .sort((a, b) => (a.menuOrder ?? 0) - (b.menuOrder ?? 0))
      .map((st) => ({ name: ITEMS[st.item as ItemId].name, price: ITEMS[st.item as ItemId].price }));
    const menuTex = trackTex(menuTexture(pal.accent, menuRows));
    const menuMat = track(new THREE.MeshBasicMaterial({ map: menuTex, toneMapped: false }));

    /** Pano genişliği: rafların arasında kalan boşluğa göre sabit. */
    const MW = Math.min(4.4, panelW * 0.4);
    /**
     * Yükseklik dokunun oranından türer (bozulma yok) ve DİKEY BÜTÇEYE
     * sığar: lambri 0,1–2,7, üst kuşak 2,72–2,86, raflar 1,5 ve 2,22.
     * İlk denemede pano 2,09 birim yüksekti; hem üst kuşağı deliyor hem
     * alt rafın hizasına iniyordu.
     */
    const MH = MW * (384 / 1024);
    const MY = 1.78;
    const menuBoard = new THREE.Group();
    // Bar merkezine göre değil PANEL merkezine göre: iki yandaki raflar
    // panoya simetrik olsun (bar hattı panelin ortasında olmayabilir).
    menuBoard.position.set(0, MY, 0.16);
    back.add(menuBoard);
    menuBoard.add(mesh(roundBox(MW + 0.22, MH + 0.22, 0.12, 0.05), mat(mix(pal.wallTrim, 0x140f0a, 0.55), { rough: 0.8 }), 0, 0, 0));
    /**
     * Yazı düzlemi panonun ön yüzünden 0,03 birim ÖNDE (yüz 0,06'da).
     * Eskiden 0,01'di; derinlik tamponu o mesafeyi bu uzaklıkta hâlâ
     * ayırıyor ama pay bedava, kapatalım.
     */
    menuBoard.add(detail(plane(MW, MH), menuMat, 0, 0, 0.09));
    /**
     * Pirinç okuma lambası — panoyu "asılı levha" yapan detay.
     * Küçük denendi (huni yarıçapı 0,13) ve ekranda tanımsız turuncu bir
     * ÜÇGEN olarak okunuyordu: 3B'de bir nesne ya okunacak kadar büyük
     * olmalı ya da hiç olmamalı.
     */
    const brass = mat(mix(0xc9973f, pal.accent, 0.2), { rough: 0.34, metal: 0.62 });
    menuBoard.add(detail(box(0.055, 0.3, 0.055), brass, 0, MH / 2 + 0.16, 0.02));
    menuBoard.add(detail(box(0.055, 0.055, 0.3), brass, 0, MH / 2 + 0.3, 0.16));
    const hood = detail(cyl(0.07, 0.24, 0.2, 12), brass, 0, MH / 2 + 0.22, 0.3);
    hood.rotation.x = Math.PI;
    menuBoard.add(hood);
    menuBoard.add(detail(cyl(0.19, 0.19, 0.02, 12), basic(0xfff0c8, 0.95, true), 0, MH / 2 + 0.13, 0.3));

    /* ------------------------------------------------ yan raflar ---- */
    /**
     * Raflar panonun İKİ YANINDA. Her raf tek parça değil, panonun
     * bıraktığı boşluğa göre kesilmiş iki segment; fincan dizisi de aynı
     * boşluğu atlar. Böylece "MENÜ" yazısının önünden hiçbir şey geçmez.
     */
    const cupTone = [0xf3ead8, mix(pal.accent, 0xffffff, 0.35), mix(pal.brand, 0xffffff, 0.5)];
    const spanH = (panelW - 1.2) / 2; // rafların dış ucu
    const gapH = MW / 2 + 0.45; // panonun bıraktığı boşluğun yarısı
    for (let s = 0; s < 2; s++) {
      const sy = 1.5 + s * 0.72;
      if (spanH - gapH > 0.6) {
        const segW = spanH - gapH;
        const segC = (spanH + gapH) / 2;
        for (const sgn of [-1, 1]) {
          back.add(detail(box(segW, 0.09, 0.34), woodWarm, sgn * segC, sy, 0.2));
          /**
           * BANT IŞIĞI 0,035 → 0,09 KALINLAŞTI.
           *
           * Oyuncunun bildirdiği "üst kısımlar pır pır titriyor" işte
           * buydu: 0,035 birimlik parlak bir çubuk 43°lik kamerada ekranda
           * ~1,5 piksel kalıyor. Bir pikselin altına inen YÜKSEK KONTRASTLI
           * bir çizgi, kamera her kımıldadığında piksel ızgarasına farklı
           * oturur ve yanıp söner — MSAA da bunu kurtarmaz. Kural: sahnede
           * hiçbir parlak öğe ekranda 2 pikselden ince olmamalı.
           */
          back.add(detail(box(segW - 0.3, 0.09, 0.06), basic(mix(0xffdca8, 0xffffff, 0.15), 0.7, true), sgn * segC, sy - 0.1, 0.33));
        }
      }
      const count = Math.floor((panelW - 1.6) / 0.52);
      const cups = makeInstanced(cyl(0.1, 0.085, 0.17, 7), mat(cupTone[s % cupTone.length], { rough: 0.5 }), count);
      const jars = makeInstanced(cyl(0.075, 0.075, 0.3, 7), mat(mix(pal.brand, 0x2a3a30, 0.4), { rough: 0.35, metal: 0.25 }), count);
      let ci = 0;
      let ji = 0;
      for (let i = 0; i < count; i++) {
        const px = -(panelW - 1.6) / 2 + 0.26 + i * 0.52;
        if (Math.abs(px) < gapH) continue; // panonun önü BOŞ kalır
        if ((i + s) % 3 === 0) setInstance(jars, ji++, px, sy + 0.2, 0.2);
        else setInstance(cups, ci++, px, sy + 0.13, 0.2);
      }
      for (let i = ci; i < count; i++) hideInstance(cups, i);
      for (let i = ji; i < count; i++) hideInstance(jars, i);
      flushInstances(cups);
      flushInstances(jars);
      back.add(cups, jars);
    }

    /** İki yanda asma yeşillik: sert dikey çizgiyi yumuşatır. */
    const leaf = mat(mix(pal.brand, 0x86c46a, 0.5), { rough: 0.9, flatShading: true });
    for (const sx of [-panelW / 2 + 0.6, panelW / 2 - 0.6]) {
      back.add(detail(cyl(0.16, 0.2, 0.26, 8), woodWarm, sx, 2.62, 0.24));
      back.add(detail(sph(0.3, 8, 6), leaf, sx, 2.4, 0.3));
      back.add(detail(sph(0.2, 7, 5), leaf, sx + 0.16, 2.14, 0.3));
      back.add(detail(sph(0.17, 7, 5), leaf, sx - 0.14, 1.98, 0.3));
    }
  }


  /* ================================================================ *
   *  5 · SARKIT AYDINLATMA — her masanın ve tezgâhın üstünde
   * ================================================================ */

  /* ================================================================ *
   *  6 · DEKOR
   * ================================================================ */


  if (loc.id === 'kose') {
    const backbar=createPremiumBackbar();
    backbar.scale.set(.925,1,.23);
    backbar.position.z=-18.05+11.58*.23;
    root.add(backbar);
    // Every glass bay stands on a real partition; the garden and room doorways stay open.
    const glazing=new THREE.Group();glazing.name='premiumStorefront';root.add(glazing);
    for(const part of loc.partitions ?? []) {
      if(part.x1-part.x0 < .5) addPremiumGlazing(glazing,(part.x0+part.x1)/2,part.z0+.12,part.z1-.12);
    }
    for(const x of [-9,9]) for(const z of [1.7,6.5,17.7]) addPremiumWallArt(glazing,x,z);
    // The front lounge uses the film's continuous walnut boards, with a flush brass threshold.
    // +0,003 taş zemine yapışıktı; tahta ile taş aynı pikseli paylaşıp titriyordu.
    // Duvar karartısı 1,6 birimlik kaba bir ızgarada bitiyor; bankın yanında
    // dikey bir ton sıçraması kalıyor ve kamera kımıldayınca titriyordu.
    const lounge=floorSlab(loungeDeck!.x0,loungeDeck!.z0,loungeDeck!.x1,loungeDeck!.z1,trackTex(premiumFloorTexture('oak')),9.33,FLOOR_Y+.016,false);
    lounge.name='premiumLoungeFloor';
    root.add(detail(box(17.68,.016,.06),mat(0xd4af67,{rough:.4,metal:.35}),0,.04,8.2));
    const barGlow = new THREE.PointLight(0xffcf8b, 2.8, 14, 1.6);
    barGlow.position.set(1.2, 3.2, -5.2);
    // Every render pass must collect the same lights: a light missing from one
    // pass changes three's light-state version and re-resolves every lit
    // material's program on each frame.
    barGlow.layers.enableAll();
    root.add(barGlow);
  }

  // Landscaped conservatories occupy the sealed wings, clear of all room portals.
  root.add(createSideGardens(loc));

  const decorByZone = new Map<string, THREE.Group[]>();
  let decorSeed = 1;
  for (const d0 of loc.decor) {
    // Room walls are low cutaways/rails. Old wall-mounted art and neon would
    // hang unsupported in the play space, showing a large back panel to camera.
    // The full-height kitchen wall still supports its own signs and artwork.
    const cutawayRoom = d0.zone && loc.zones.find(zone => zone.id === d0.zone)?.room;
    if (cutawayRoom && (d0.kind === 'neon' || d0.kind === 'wallart')) continue;
    if(loc.id==='kose' && !cutawayRoom && ['neon','wallart','chalkboard'].includes(d0.kind) && d0.z < -16) continue;
    const g = loc.id==='kose' && d0.kind==='plant' ? createPremiumPlanter() : createDecor(d0.kind, pal, decorSeed++);
    if (d0.zone) g.userData.batchExclude = true;
    let decorY = floorLiftAt(loc, d0.x, d0.z);
    // Yükseltilmiş ceviz döşemenin içine gömülmesin (bank, saksı).
    if (loungeDeck && decorY === 0 && d0.x >= loungeDeck.x0 && d0.x <= loungeDeck.x1 && d0.z >= loungeDeck.z0 && d0.z <= loungeDeck.z1) decorY = 0.027;
    g.position.set(d0.x, decorY, d0.z);
    g.rotation.y = ((d0.rot ?? 0) * Math.PI) / 180;
    if (d0.scale) g.scale.setScalar(d0.scale);
    root.add(g);
    const key = d0.zone ?? '';
    const list = decorByZone.get(key);
    if (list) list.push(g);
    else decorByZone.set(key, [g]);
  }

  if(loc.id==='kose') for(const st of locationStations(loc.id)) {
    if(st.kind!=='table' || st.z<9 || st.id==='k_masa_8' || st.id==='k_vip_3') continue;
    const lamp=createPremiumLoungeLamp(st.visual==='table');lamp.position.set(st.x,floorLiftAt(loc,st.x,st.z),st.z);
    // Zone-visible, so outside the venue batch; its own merge keeps the exact
    // per-part colour, roughness and shadow flags in two draws instead of five.
    batchPremium(lamp);
    lamp.userData.batchExclude=true;root.add(lamp);
    const list=decorByZone.get(st.zone)??[];list.push(lamp);decorByZone.set(st.zone,list);
  }

  /* ================================================================ *
   *  6b · VİTRİN IŞIKLARI (z_vitrin) — bar arkası rafların spotları
   *
   *  v5.1 yan dal bölgesinin dekoru. Serbest bir DecorDef DEĞİL: bölüm
   *  4'te kurulan bar arkası vitrin duvarıyla aynı ankraja (cx, kitchen
   *  z0) oturmak zorunda, o yüzden burada üretilir. Görünürlük için
   *  mevcut kalıba `decorByZone` üzerinden bağlanır: bölge kilitliyken
   *  görünmez, açılınca refreshDecor/setZoneUnlocked belirir — branda
   *  kalıbına girmez (istasyonsuz bölge) ve statik matris dondurma
   *  (bölüm 9) bu grubu da kapsar; tek updateMatrixWorld yeter.
   *
   *  3 çizim: 2 spot gövdesi tek yığın + 2 sıcak mercek tek yığın +
   *  üst rafın üstünde zayıf emissive şerit (raf altı LED kalıbının eşi).
   *  Zemin ayak izi yok (y 2,5+): nav'a ve pedlere hiç dokunmaz.
   * ================================================================ */
  {
    const g = new THREE.Group();
    g.userData.batchExclude = true;
    g.name = 'env_vitrin_isik';
    g.position.set(cx, 0, k.z0 + 0.3);
    root.add(g);
    // Spotlar kadraj içinde (|x| 3,3 ≤ 4,6) ve üst çıtanın hemen üstünde.
    // rx +0,62: ağız (geniş uç) aşağı-kuzeye, yani rafların üstüne bakar.
    const housing = makeInstanced(cyl(0.08, 0.15, 0.2, 8), mat(0x2b3238, { rough: 0.5, metal: 0.45 }), 2);
    const lens = makeInstanced(cyl(0.11, 0.11, 0.025, 8), basic(0xffd9a0), 2);
    for (let i = 0; i < 2; i++) {
      const sx = i === 0 ? -3.3 : 3.3;
      setInstance(housing, i, sx, 2.92, 0.34, 0.62, 0, 0);
      setInstance(lens, i, sx, 2.83, 0.27, 0.62, 0, 0);
    }
    flushInstances(housing);
    flushInstances(lens);
    g.add(housing, lens);
    /**
     * ZAYIF SICAK ŞERİT — 0,04 → 0,10 KALINLAŞTI, İKİYE BÖLÜNDÜ.
     *
     * 0,04 birimlik parlak bir çubuk portre kamerada ekranda ~1,5 piksel
     * kalıyordu: bir pikselin altına inen yüksek kontrastlı çizgi, kamera
     * her kımıldadığında piksel ızgarasına başka türlü oturur ve yanıp
     * söner. Oyuncunun "üst kısımlar pır pır titriyor" dediği şey buydu.
     * Ayrıca tek parça 7 birimlik şerit menü panosunun önünden geçiyordu;
     * artık iki spotun altında, panonun iki yanında duruyor.
     */
    for (const sx of [-3.3, 3.3]) {
      g.add(detail(box(2.6, 0.1, 0.06), basic(0xffd2a0, 0.42, false), sx, 2.6, 0.4));
    }
    const list = decorByZone.get('z_vitrin');
    if (list) list.push(g);
    else decorByZone.set('z_vitrin', [g]);
  }

  /* ================================================================ *
   *  7 · ÖDEME PEDLERİ
   *
   *  Her kilitli bölümün eşyasının yanında bir ped. Üstüne basınca
   *  dolar; dolunca branda uçar. Ped, açılınca tamamen kaybolur.
   * ================================================================ */

  const pads = new Map<string, ZonePurchasePad>();
  const stations = locationStations(loc.id);
  for (const zone of loc.zones) {
    if (zone.cost <= 0) continue;
    const members = stations.filter(st => st.zone === zone.id);
    const station = members.find(st => stationGlyph(st));
    const glyph = station ? stationGlyph(station)! : zone.room ? '⌂' : '✦';
    const seats = members.filter(st => st.kind === 'table').reduce((sum, st) => sum + (st.seats ?? 2), 0);
    const products = [...new Set(members.filter(st => st.kind === 'machine' && st.item && ITEMS[st.item].tier === 'product').map(st => ITEMS[st.item!].name))];
    const counters = members.filter(st => st.kind === 'counter').length;
    const toilets = members.filter(st => st.kind === 'toilet').length;
    const benefit = zone.room && seats > 0 ? tr('Salon alanı · {0} kişilik', seats)
      : seats > 0 ? tr('+{0} oturma yeri', seats)
      : products.length > 0 ? tr('{0} menüye eklenir', products.join(' · '))
      : counters > 0 ? (counters === 1 ? tr('+1 sipariş kasası') : tr('+{0} sipariş kasası', counters))
      : toilets > 0 ? (toilets === 1 ? tr('+1 tuvalet') : tr('+{0} tuvalet', toilets))
      : zone.blurb;
    const pad = createZonePurchasePad(zone, glyph, benefit, floorLiftAt(loc, zone.padX, zone.padZ));
    pads.set(zone.id, pad);
    root.add(pad.root);
  }

  /* ================================================================ *
   *  8 · DURUM
   * ================================================================ */

  const unlocked = new Set<string>();

  function refreshDecor(): void {
    for (const [zone, list] of decorByZone) {
      const on = zone === '' || unlocked.has(zone);
      for (const g of list) g.visible = on;
    }
  }

  /**
   * Hijyen → kir opaklığı. 100'de tertemiz (katman kapalı), 55'in altında
   * tavan. Tavan 0,3'te tutulur: daha fazlası zemin dokusunu tamamen
   * yutuyor ve mekân "karanlık" görünüyor, kirli değil.
   */
  function setHygiene(v: number): void {
    const dirty = Math.max(0, Math.min(1, (96 - v) / 41));
    const op = dirty * 0.22;
    grimeMat.opacity = op;
    grime.visible = op > 0.004;
  }

  function setZoneUnlocked(zoneId: string, on: boolean, animate: boolean): void {
    const changed = unlocked.has(zoneId) !== on;
    if (on) unlocked.add(zoneId);
    else unlocked.delete(zoneId);
    pads.get(zoneId)?.setUnlocked(on, animate);
    // Oda kapısı: kilitliyken kapalı kanatlar + zemin rozeti; açılınca boş
    // kapı boşluğu (rozet de kalkar — artık oda kendini gösteriyor).
    const door = roomDoors.get(zoneId);
    if (door) {
      door.closed.visible = !on;
      // Ad tabelası KALIR, ondan sarkan asma kilit gider.
      door.lock.visible = !on;
      // İçerik şeridi kilidin kaderini paylaşır: açık odada yalnız tekrar olur.
      if (door.strip) door.strip.visible = !on;
    }
    if (changed) refreshDecor();
  }

  refreshDecor();

  /* ================================================================ *
   *  9 · STATİK BATCH + MATRİS DONDURMA
   *
   *  Tamamen statik ve opak çevre parçaları aynı malzeme/gölge ayarları
   *  içinde tek geometriye birleştirilir. Dinamik göstergeler, saydam
   *  yüzeyler, instancing ve görünürlükle değişen gruplar dışarıda kalır.
   *  Böylece statik çevrenin draw call sayısı azalırken oyun nesneleri,
   *  kilitler, pedler ve animasyonlar ayrı kalır.
   *
   *  Mekân kurulumdan sonra YERİNDEN OYNAMAZ: kapı kanatları, brandalar,
   *  kilit ve dekor yalnız `visible` değiştirir — o da manuel matrisle
   *  sorunsuzdur. Tek istisna ödeme pedleri: levha yüzer, halka döner,
   *  dolgu ölçeklenir (bkz. update) — pad alt ağacı otomatik kalır.
   *  Kök de otomatik kalır ki dışarıdan taşınırsa zincir kırılmasın.
   * ================================================================ */
  root.updateMatrixWorld(true);
  {
    const dynamicRoots = new Set<THREE.Object3D>();
    for (const pad of pads.values()) dynamicRoots.add(pad.root);
    const freeze = (o: THREE.Object3D): void => {
      if (dynamicRoots.has(o)) return;
      o.matrixAutoUpdate = false;
      for (const c of o.children) freeze(c);
    };
    for (const c of root.children) freeze(c);
  }


  return {
    root,

    setZoneUnlocked,
    setHygiene,

    setCosmetics(wall: WallSkin, floor: FloorSkin): void {
      const c = wall.color ?? pal.wall;
      for (const p of paints) p.m.color.setHex(p.from(c));
      setFloorSkin(floor);
    },

    optimizeStatic(): { before: number; after: number } {
      if (!staticBatch) staticBatch = createStaticBatch(root, {cellSize:8, compact:true, bakeInstances:true});
      // Zone-toggled objects are excluded; unlocking needs only cache invalidation.
      if (!staticBatch.active) staticBatch.setActive(true);
      return { before: staticBatch.callsBefore, after: staticBatch.callsAfter };
    },

    setPadVisible(zoneId: string, visible: boolean): void { pads.get(zoneId)?.setVisible(visible); },
    flushPadCaptions(): void { for (const pad of pads.values()) pad.flushCaption(); },
    setPadProgress(zoneId: string, progress: number): void { pads.get(zoneId)?.setProgress(progress); },
    setPadLabel(zoneId: string, text: string): void { pads.get(zoneId)?.setLabel(text); },
    setPadActive(zoneId: string, active: boolean): void { pads.get(zoneId)?.setActive(active); },
    setPadNear(zoneId: string, near: boolean): void { pads.get(zoneId)?.setNear(near); },
    setPadInstruction(zoneId: string, text: string): void { pads.get(zoneId)?.setInstruction(text); },
    setPadAdOffer(zoneId: string, offer: 'finish' | 'pay_half' | null): void { pads.get(zoneId)?.setAdOffer(offer); },

    update(dt: number): void {
      for (const pad of pads.values()) pad.update(dt);
    },

    dispose(): void {
      staticBatch?.dispose();
      staticBatch = null;
      disposePremium(root);
      root.removeFromParent();
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if (material.userData.viewOcclusionOwned) material.dispose();
        }
        const im = o as THREE.InstancedMesh;
        if (im.isInstancedMesh) im.dispose();
      });
      for (const m of ownMaterials) m.dispose();
      for (const tx of ownTextures) tx.dispose();
      for (const g of ownGeometries) g.dispose();
      ownMaterials.length = 0;
      ownTextures.length = 0;
      ownGeometries.length = 0;
      for (const pad of pads.values()) pad.dispose();
      pads.clear();
      decorByZone.clear();
      root.clear();
    },
  };
}

/** Dış modüller ölçü paylaşabilsin diye. */
export const ENV_WALL_H = WALL_H;
export const ENV_TAU = TAU;
