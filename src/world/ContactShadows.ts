import * as THREE from 'three';

/**
 * TEMAS GÖLGELERİ
 *
 * Karakterler dondurulmuş gölge haritasına giremez (bkz. CharacterRig
 * sonundaki not), ama yere basmaları gerekir. Bunun klasik mobil çözümü,
 * her aktörün altına yumuşak kenarlı bir leke koymaktır.
 *
 * Tamamı TEK bir InstancedMesh'tir: 40 karakterin lekesi tek çizim
 * çağrısı eder. Doku kod içinde radyal gradyanla üretilir — projenin
 * "ikili varlık yok" kuralı korunur.
 */

const MAX = 64;

function blobTexture(): THREE.CanvasTexture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  /**
   * ÇARPIMSAL KARIŞIM İÇİN DOKU BEYAZ ZEMİNLİ OLMALI.
   *
   * `MultiplyBlending` → `dst = dst × src.rgb`; alfa hiç kullanılmaz.
   * İlk denemede gradyan "siyah → şeffaf" yapılmıştı: şeffaf piksellerin
   * RGB'si siyah olduğu için karenin tamamı zemini siyaha çarpıyor ve
   * her karakterin altında SİYAH KARE çıkıyordu.
   *
   * Doğrusu "koyu gri → beyaz": beyazla çarpmak zemini değiştirmez, yani
   * kenarlar görünmez olur; merkez ise zemini koyultur.
   */
  /**
   * Duraklar ÖLÇÜLEREK ayarlandı. İlk denemede (0 / 0,40 / 0,72 / 1,0)
   * gradyan beyaza çok hızlı gidiyordu: merkez 0,46 çarpan olsa da diskin
   * ortalaması 0,86'ya çıkıyor, yani gölge gözle neredeyse seçilmiyordu
   * (kare farkı kanal başına yalnızca 32 birim). Karanlık çekirdek
   * genişletildi.
   */
  g.addColorStop(0, 'rgb(88,80,72)');
  g.addColorStop(0.5, 'rgb(126,118,110)');
  g.addColorStop(0.78, 'rgb(198,192,186)');
  g.addColorStop(1, 'rgb(255,255,255)');
  ctx.fillStyle = 'rgb(255,255,255)';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class ContactShadows {
  readonly mesh: THREE.InstancedMesh;
  private count = 0;
  private hash = 0;
  private lastCount = -1;
  private lastHash = 0;
  private tex: THREE.CanvasTexture;
  private mat: THREE.MeshBasicMaterial;
  private geo: THREE.PlaneGeometry;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private pos = new THREE.Vector3();
  private scl = new THREE.Vector3();

  constructor() {
    this.tex = blobTexture();
    this.geo = new THREE.PlaneGeometry(1, 1);
    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex,
      transparent: true,
      // Zemine yazmaz: derinlik tamponuna dokunmadığı için üst üste binen
      // lekeler birbirini kesmez ve sıralama sorunu çıkmaz.
      depthWrite: false,
      // Çarpımsal karışım: leke zeminin rengini KOYULAŞTIRIR, üstüne gri
      // bir katman sürmez — açık krem zeminde bu fark belirgin.
      blending: THREE.MultiplyBlending,
      color: 0xffffff,
      // Doku sRGB olarak yorumlanmasın: bu bir renk değil, çarpan maskesi.
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Yere yatık, hafif yukarıda (z-fighting olmasın).
    this.q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.count = 0;
    this.mesh.matrixAutoUpdate = false;
  }

  /** Kare başında sıfırlanır. */
  begin(): void {
    this.count = 0;
    this.hash = 2166136261;
  }

  /**
   * Bir aktörün lekesini kuyruğa ekler.
   * @param lift Karakterin yerden yüksekliği (zıplama/oturma) — yükseldikçe
   *             leke küçülür ve soluklaşır, tıpkı gerçek gölge gibi.
   */
  add(x: number, z: number, radius: number, lift = 0): void {
    if (this.count >= MAX) return;
    const onTerrace = lift > 0.7;
    const fade = 1 / (1 + (onTerrace ? 0 : Math.max(0, lift)) * 1.6);
    const r = radius * fade;
    this.pos.set(x, (onTerrace ? lift : 0) + 0.054, z);
    this.scl.set(r * 2, r * 2, 1);
    this.m4.compose(this.pos, this.q, this.scl);
    this.mesh.setMatrixAt(this.count, this.m4);
    this.hash = Math.imul(this.hash ^ (Math.round(x * 256) | 0), 16777619);
    this.hash = Math.imul(this.hash ^ (Math.round(z * 256) | 0), 16777619);
    this.hash = Math.imul(this.hash ^ (Math.round(r * 128) | 0), 16777619);
    this.hash = Math.imul(this.hash ^ (Math.round(lift * 128) | 0), 16777619);
    this.count++;
  }

  /** Kare sonunda GPU'ya gönderir. */
  end(): void {
    if (this.count === 0 && this.lastCount === 0) return;
    if (this.count === this.lastCount && this.hash === this.lastHash) return;
    this.mesh.count = this.count;
    if (this.count > 0) this.mesh.instanceMatrix.needsUpdate = true;
    this.lastCount = this.count;
    this.lastHash = this.hash;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    this.tex.dispose();
    this.mesh.dispose();
  }
}
