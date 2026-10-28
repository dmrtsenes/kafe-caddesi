import * as THREE from 'three';

/**
 * NİYET HALKASI — oyuncunun ayakları dibinde dolan daire.
 *
 * Alma ve satın alma artık "yanından geçince aniden" değil, kısa bir
 * bekleyişle başlar (bkz. BALANCE.player.pickupArmTime / padArmTime).
 * Bu halka o bekleyişin tek görsel dili: hedefin yanında durursan dolar,
 * dolunca işlem başlar; yürümeye devam edersen söner. Rengi eyleme göre
 * değişir (satın alma altın, ürün alma ürün rengi).
 *
 * Canvas 96×96'tir ve yalnızca yay adımı değiştiğinde (48 adım) yeniden
 * boyanır — 60 fps'de her kare doku yüklemek pahalıdır, dolum ~0,35-0,8 sn
 * sürdüğü için 48 adım gözle ayırt edilemeyecek kadar akıcıdır.
 */

const SIZE = 96;
const STEPS = 48;

export interface ArmRing {
  root: THREE.Group;
  /** Halkayı bu karede göster. t01: 0..1 dolum, color: yay rengi. */
  show(x: number, z: number, t01: number, color: number): void;
  /** Bu karede kimse istemedi → gizle. Her karenin sonunda çağrılır. */
  endFrame(): void;
  dispose(): void;
}

export function createArmRing(): ArmRing {
  const root = new THREE.Group();
  root.name = 'armRing';
  root.visible = false;

  const cv = document.createElement('canvas');
  cv.width = SIZE;
  cv.height = SIZE;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.045;
  mesh.renderOrder = 3;
  root.add(mesh);

  let lastStep = -1;
  let lastColor = -1;
  let touched = false;

  function paint(step: number, color: number): void {
    if (!ctx) return;
    const c = SIZE / 2;
    const r = SIZE * 0.42;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const hex = `#${color.toString(16).padStart(6, '0')}`;
    // zayıf taban halkası: "burada bir bekleyiş var" ipucu
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth = SIZE * 0.055;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
    // dolan yay: tepeden saat yönünde
    if (step > 0) {
      ctx.strokeStyle = hex;
      ctx.lineWidth = SIZE * 0.09;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(c, c, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * step) / STEPS);
      ctx.stroke();
    }
    tex.needsUpdate = true;
  }

  return {
    root,
    show(x: number, z: number, t01: number, color: number): void {
      touched = true;
      root.visible = true;
      root.position.set(x, 0, z);
      const step = Math.min(STEPS, Math.round(t01 * STEPS));
      if (step !== lastStep || color !== lastColor) {
        lastStep = step;
        lastColor = color;
        paint(step, color);
      }
    },
    endFrame(): void {
      if (!touched) {
        root.visible = false;
        lastStep = -1;
      }
      touched = false;
    },
    dispose(): void {
      tex.dispose();
      mat.dispose();
      mesh.geometry.dispose();
      root.removeFromParent();
    },
  };
}
