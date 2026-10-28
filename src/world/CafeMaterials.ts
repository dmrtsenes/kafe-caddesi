import * as T from "three";

/** Quiet shared finishes. Colors are sRGB; no per-frame textures or extra render pass. */
export const CAFE = {
  walnut: 0x8f6446,
  ink: 0x283c35,
  green: 0x285d50,
  stone: 0xe4ddcd,
  brass: 0xc6a267,
  terra: 0xb87543,
};

export function cafeStoneTexture(base = CAFE.stone): T.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#" + base.toString(16).padStart(6, "0");
  ctx.fillRect(0, 0, 512, 512);
  const colors = ["#abac98", "#c5b89a", "#fff8e6", "#749180"];
  for (let n = 0; n < 700; n++) {
    ctx.globalAlpha = 0.12 + (n % 3) * 0.05;
    ctx.fillStyle = colors[n % 4];
    ctx.beginPath();
    ctx.ellipse(
      (n * 137) % 512,
      (n * 283) % 512,
      1 + (n % 3),
      0.7 + (n % 2),
      n,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

let sharedWood: T.CanvasTexture | undefined;
export function cafeWoodTexture(): T.CanvasTexture {
  if (sharedWood) return sharedWood;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#926b4e";
  ctx.fillRect(0, 0, 256, 512);
  for (let n = 0; n < 48; n++) {
    ctx.strokeStyle = n % 2 ? "rgba(49,31,20,.085)" : "rgba(232,199,150,.075)";
    ctx.lineWidth = 1 + (n % 2);
    ctx.beginPath();
    for (let y = 0; y <= 512; y += 16) {
      const x = ((n * 37) % 256) + Math.sin(y * 0.012 + n) * 2;
      y ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 8;
  sharedWood = texture;
  return texture;
}
