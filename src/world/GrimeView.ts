import * as THREE from 'three';
import { syncGrimePixels } from './GrimePixels';
import type { GrimeField } from '../sim/Grime';

/**
 * TRAFİK KİRİ GÖRSELİ.
 *
 * Tüm zemin için TEK düzlem, tek doku, tek çizim çağrısı. Kirin nerede
 * olduğunu bir alfa maskesi söyler; maske doğrudan simülasyon ızgarasından
 * (`GrimeField.data`) üretilir, yani ekranda gördüğün karartı ile temizlik
 * fırçasının sildiği şey birebir aynı veridir.
 *
 * Neden düzlem başına doku değil de tek doku: leke sistemi (SpillView) leke
 * başına 96×96'lık bir tuval tutuyor; trafik kiri tüm mekâna yayıldığı için
 * aynı yaklaşım onlarca doku demekti. Izgara zaten kaba (0,6 birim hücre),
 * bu yüzden 30×66'lık minik bir doku yetiyor — `LinearFilter` aradaki geçişi
 * yumuşatıp lekeli, organik bir yüzey veriyor.
 *
 * MALİYET: 30×66 RGBA = 7,9 KB. Yalnız `field.dirty` iken yüklenir.
 * (Karşılaştırma: mevcut leke katmanı 14 × 36 KB tutuyor.)
 */

/** Kirin rengi — zeminden koyu, sıvı lekeden açık: üç katman ayrışsın. */
const COLOR = 0x6f6553;

export interface GrimeView {
  root: THREE.Group;
  sync(field: GrimeField): void;
  dispose(): void;
}

/**
 * Kirin gövde dokusu: düz karartı "gölge" gibi duruyor, benekli doku onu
 * KİR yapıyor. (SpillView'daki `grainTexture` ile aynı gerekçe; burada daha
 * geniş ölçekte tekrar eder.)
 */
function grainTexture(): THREE.CanvasTexture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 240; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = 0.4 + Math.random() * 0.6;
      g.fillStyle = 'rgba(42,32,20,' + (0.02 + Math.random() * 0.05).toFixed(3) + ')';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface GrimeLiftRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  lift: number;
}

/**
 * @param lifts Yükseltilmiş oda dikdörtgenleri. Tek düzlem iki kotu birden
 *   gösteremez: podyum ana düzlemi örter, o yüzden her yükselti KENDİ
 *   düzlemini alır ve UV'si büyük dokunun aynı bölgesine oturtulur — yani
 *   veri hâlâ tek, yalnız çizim ikiye ayrılır.
 */
export function createGrimeView(
  field: GrimeField,
  bounds: { x0: number; z0: number; x1: number; z1: number },
  lifts: GrimeLiftRect[] = [],
): GrimeView {
  const root = new THREE.Group();
  root.name = 'grime';

  const W = field.cols;
  const H = field.rows;
  const buf = new Uint8Array(W * H * 4);
  const tex = new THREE.DataTexture(buf, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  const grain = grainTexture();
  const spanX = bounds.x1 - bounds.x0;
  const spanZ = bounds.z1 - bounds.z0;
  const gridX = W * field.cell;
  const gridZ = H * field.cell;
  grain.repeat.set(spanX / 3.5, spanZ / 3.5);

  const mat = new THREE.MeshBasicMaterial({
    color: COLOR,
    map: grain,
    alphaMap: tex,
    transparent: true,
    toneMapped: false,
    /**
     * ALFA TAVANI — zemin kirlense de ZEMİN kalmalı.
     *
     * three.js'te son alfa `opacity × alphaMap`tır. Tavan yokken hücre 255'e
     * vurduğunda alfa 1,0 oluyordu: 50 dakikalık ölçüm koşusunun sonunda
     * parke tamamen kaybolmuş, kafenin zemini düz koyu kahve bir ÇAMUR
     * yüzeyine dönmüştü — istenen "tozlanmış/kirlenmiş" değil.
     *
     * 0,32 ile: çöken toz (70/255) → alfa 0,09, yani ince bir film; en çok
     * basılan yer (255) → 0,32, yani belirgin ama altındaki parke hâlâ
     * okunur. Temizlenince ortaya çıkacak bir zemin olmalı ki "açığa
     * çıkarma" tatmini oluşsun.
     */
    opacity: 0.32,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  /** Ana zemin düzlemi. */
  const geo = new THREE.PlaneGeometry(spanX, spanZ);
  geo.rotateX(-Math.PI / 2);
  // Ceil-rounded simulation grids extend slightly beyond the room. Crop UVs
  // instead of squeezing the whole mask into the bounds and shifting brush marks.
  const mainUv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < mainUv.count; i++) {
    mainUv.setXY(i, mainUv.getX(i) * spanX / gridX, 1 - (1 - mainUv.getY(i)) * spanZ / gridZ);
  }
  mainUv.needsUpdate = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((bounds.x0 + bounds.x1) / 2, 0.066, (bounds.z0 + bounds.z1) / 2);
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  root.add(mesh);

  /** Yükseltilmiş odalar: aynı dokunun ilgili bölgesi, kendi kotunda. */
  const liftGeos: THREE.BufferGeometry[] = [];
  for (const L of lifts) {
    const g = new THREE.PlaneGeometry(L.x1 - L.x0, L.z1 - L.z0);
    g.rotateX(-Math.PI / 2);
    // UV'yi büyük dokunun alt bölgesine sıkıştır.
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const u0 = (L.x0 - field.x0) / gridX;
    const u1 = (L.x1 - field.x0) / gridX;
    // Doku V ekseni z ile TERS gider (düzlem -X etrafında döndürüldü).
    const v0 = 1 - (L.z1 - field.z0) / gridZ;
    const v1 = 1 - (L.z0 - field.z0) / gridZ;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    }
    uv.needsUpdate = true;
    const m = new THREE.Mesh(g, mat);
    m.position.set((L.x0 + L.x1) / 2, L.lift + 0.066, (L.z0 + L.z1) / 2);
    root.add(m);
    liftGeos.push(g);
  }

  const buf32 = new Uint32Array(buf.buffer, buf.byteOffset, buf.byteLength >> 2);
  let lastSum = -1;
  let lastUploadAt = -Infinity;
  root.visible = false;

  return {
    root,
    sync(f: GrimeField): void {
      if (!f.dirty) return;
      const now = performance.now();
      const cleaning = lastSum < 0 || f.totalSum < lastSum;
      if (!cleaning && now - lastUploadAt < 180) return;
      f.dirty = false;
      lastSum = f.totalSum;
      lastUploadAt = now;
      if (syncGrimePixels(f.data,buf,W,H)) {
        tex.needsUpdate = true;
        let visible = false;
        for (let i = 0; i < buf32.length; i++) {
          if (buf32[i] !== 0) { visible = true; break; }
        }
        root.visible = visible;
      }
    },
    dispose(): void {
      mat.dispose();
      tex.dispose();
      grain.dispose();
      geo.dispose();
      for (const g of liftGeos) g.dispose();
      root.removeFromParent();
      root.clear();
    },
  };
}
