import * as THREE from 'three';
import { plane } from './Materials';

/**
 * MOBİLYA TEMAS GÖLGESİ (zemin AO lekesi).
 *
 * Eskiden her masanın/tezgâhın/makinenin altında KATI BİR PLAKA vardı:
 * zemin renginin koyulaştırılmışı, `roundBox` ile kutu olarak çizilen,
 * kenarı keskin bir levha. Amacı eşyayı zemine oturtmaktı ama sonuç
 * "her mobilyanın altında bir kare paspas" oldu — oyuncunun ilk
 * söylediği şey buydu ve haklıydı: profesyonel oyunlarda mobilyayı
 * zemine bağlayan şey plaka değil, KENARI OLMAYAN yumuşak bir gölgedir.
 *
 * Buradaki çözüm tek bir paylaşılan doku + tek bir paylaşılan malzemedir:
 *   · Doku beyaz zeminli bir maske (bkz. ContactShadows'taki uzun not):
 *     `MultiplyBlending` alfayı kullanmaz, `dst = dst × src.rgb` yapar.
 *     Beyaz = "zemine dokunma", koyu gri = "zemini karart". Kenarlar
 *     beyaza gittiği için gölgenin sınırı GÖRÜNMEZ.
 *   · Geometri birim düzlemdir ve örnek başına yalnız ÖLÇEKLENİR, yani
 *     eski pedin yerine geçen mesh sayısı aynıdır: çizim çağrısı bütçesi
 *     değişmez (bkz. Materials.ts başındaki kural).
 *
 * Maske yuvarlatılmış dikdörtgen SDF'siyle üretilir: uzun bir tezgâhın
 * altında elips değil TEZGÂH BİÇİMİNDE bir karartı olur, masanın altında
 * ise neredeyse daire — çünkü genişlik ve derinlik eşit ölçeklenir.
 */

let sharedTex: THREE.CanvasTexture | null = null;
let sharedMat: THREE.MeshBasicMaterial | null = null;

const SIZE = 96;
/** Tam karanlık çekirdeğin yarı boyutu (0..1 · doku uzayında). */
const CORE = 0.30;

function shadowTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = SIZE;
  cv.height = SIZE;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(SIZE, SIZE);
  const px = img.data;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // [-1, 1] birim kareye taşı (piksel merkezinden)
      const u = ((x + 0.5) / SIZE) * 2 - 1;
      const v = ((y + 0.5) / SIZE) * 2 - 1;
      // Yuvarlatılmış dikdörtgen mesafesi: köşeler doğal olarak yuvarlanır.
      const dx = Math.max(Math.abs(u) - CORE, 0);
      const dy = Math.max(Math.abs(v) - CORE, 0);
      const dist = Math.hypot(dx, dy) / (1 - CORE); // 0 = çekirdek, 1 = kenar
      const t = dist >= 1 ? 0 : 1 - dist;
      /**
       * Kuvvet eğrisi 2,0 yerine 1,55.
       *
       * Kare (2,0) çekirdeği toplu bir noktaya sıkıştırıyor ve gölge
       * "eşyanın altında" değil "eşyanın göbeğinde" duruyordu. 1,55
       * karartıyı gövdenin ayak izine yayar, kenar yine de sıfıra iner.
       */
      const a = Math.pow(t, 1.55);
      // Beyazdan koyu griye: 1 → 0,42 çarpanı (en koyu nokta %58 karartma)
      const m = Math.round(255 * (1 - a * 0.58));
      const i = (y * SIZE + x) * 4;
      px[i] = m;
      px[i + 1] = m;
      px[i + 2] = m;
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Kenar pikseli beyaz olduğu için kelepçelemek güvenli; tekrar YOK.
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function material(): THREE.MeshBasicMaterial {
  if (!sharedMat) {
    sharedTex = shadowTexture();
    sharedMat = new THREE.MeshBasicMaterial({
      map: sharedTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.MultiplyBlending,
      toneMapped: false,
    });
  }
  return sharedMat;
}

/**
 * Bir mobilyanın altına serilecek yumuşak gölge.
 *
 * @param w  Gövdenin genişliği (x). Gölge bundan ~%55 taşar — gerçek
 *           yumuşak gölge nesnenin ayak izinden geniştir.
 * @param d  Gövdenin derinliği (z).
 * @param y  Zemin kotu (yükseltilmiş podyumlarda kullanılır).
 */
export function groundShadow(w: number, d: number, y = 0.042): THREE.Mesh {
  const m = new THREE.Mesh(plane(1, 1), material());
  m.scale.set(w * 1.55, d * 1.55, 1);
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, y, 0);
  m.castShadow = false;
  m.receiveShadow = false;
  m.renderOrder = 1;
  /**
   * Gölge KİLİT TONLAMASINA girmez: `collectTint` kilitli istasyonun tüm
   * mesh'lerini gri-şeffaf bir varyanta çevirir; çarpımsal maske orada
   * `basic()` yolundan geçip yarı saydam GRİ bir kareye dönüşüyordu —
   * yani kaldırdığımız plakanın aynısı, brandanın altında.
   */
  m.userData.noTint = true;
  return m;
}

export function disposeGroundShadow(): void {
  sharedMat?.dispose();
  sharedTex?.dispose();
  sharedMat = null;
  sharedTex = null;
}

export interface GroundShadowBatch {
  readonly mesh: THREE.InstancedMesh;
  set(i: number, x: number, y: number, z: number, w: number, d: number, rotY: number): void;
  setCount(n: number): void;
  dispose(): void;
}

const _gsM4 = new THREE.Matrix4();
const _gsPos = new THREE.Vector3();
const _gsScl = new THREE.Vector3();
const _gsQ = new THREE.Quaternion();
const _gsQX = new THREE.Quaternion();
const _gsQY = new THREE.Quaternion();
const _gsX = new THREE.Vector3(1, 0, 0);
const _gsY = new THREE.Vector3(0, 1, 0);

export function createGroundShadowBatch(maxCount: number): GroundShadowBatch {
  const n = Math.max(1, maxCount);
  const mesh = new THREE.InstancedMesh(plane(1, 1), material(), n);
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.userData.noTint = true;
  mesh.count = 0;
  _gsQX.setFromAxisAngle(_gsX, -Math.PI / 2);

  return {
    mesh,
    set(i, x, y, z, w, d, rotY) {
      if (i < 0 || i >= n) return;
      _gsPos.set(x, y, z);
      _gsQY.setFromAxisAngle(_gsY, rotY);
      _gsQ.multiplyQuaternions(_gsQY, _gsQX);
      _gsScl.set(w * 1.55, d * 1.55, 1);
      _gsM4.compose(_gsPos, _gsQ, _gsScl);
      mesh.setMatrixAt(i, _gsM4);
    },
    setCount(count) {
      const c = Math.max(0, Math.min(n, count));
      mesh.count = c;
      mesh.visible = c > 0;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      mesh.removeFromParent();
      mesh.dispose();
    },
  };
}
