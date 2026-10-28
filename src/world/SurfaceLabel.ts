import * as THREE from 'three';
import { plane } from './Materials';
import { LABEL_RENDER_ORDER, LAYER_SURFACE_LABEL } from './layers';

/** Keep the purchase name and remaining price; long explanations belong in the HUD. */
export function compactPadLabel(text: string, shortName?: string): { title: string; price: string } {
  const parts = text.split(' · ').map(s => s.trim());
  const level = shortName ? parts.find(s => /^↑\s*\d+/.test(s))?.replace(/\s+/g, '') : '';
  return { title: [shortName || parts[0] || '', level].filter(Boolean).join(' '),
    price: parts.find(s => s.includes('₺')) ?? '' };
}

export interface SurfaceLabel {
  mesh: THREE.Mesh;
  setText(title: string, price?: string): void;
  setActive(active: boolean): void;
  update(dt: number): void;
  dispose(): void;
}

/** All labels share one repaint per frame: each paint re-uploads a large mipmapped texture. */
let lastLabelPaintAt = -Infinity;

const TEXT_METRIC_CACHE = new Map<string, {
  font: number; left: number; right: number; ascent: number; descent: number; width: number; height: number;
}>();

/** Fit actual glyph bounds, including accents, inside a centred text box.
 * Font size changes uniformly; a fixed vertical lift compensates floor perspective. */
export function drawSurfaceText(ctx: CanvasRenderingContext2D, value: string,
  x: number, y: number, width: number, height: number, size: number, lift = 1, outline = 0): void {
  if (!value) return;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const measure = (font: number) => {
    ctx.font = `800 ${font}px system-ui, "Segoe UI", sans-serif`;
    const m = ctx.measureText(value);
    const left = m.actualBoundingBoxLeft ?? m.width / 2;
    const right = m.actualBoundingBoxRight ?? m.width / 2;
    const ascent = m.actualBoundingBoxAscent ?? font * .8;
    const descent = m.actualBoundingBoxDescent ?? font * .2;
    return { font, left, right, ascent, descent,
      width: Math.max(m.width, left + right), height: (ascent + descent) * lift };
  };
  width -= outline; height -= outline * lift;
  const cacheKey = `${value}|${width}|${height}|${size}|${lift}`;
  let metrics = TEXT_METRIC_CACHE.get(cacheKey);
  if (!metrics) {
    metrics = measure(size);
    if (metrics.width > width || metrics.height > height) {
      let low = 0, high = size;
      for (let i = 0; i < 12; i++) {
        const mid = (low + high) / 2, m = measure(mid);
        if (m.width <= width && m.height <= height) low = mid;
        else high = mid;
      }
      metrics = measure(low);
    }
    if (TEXT_METRIC_CACHE.size >= 256) TEXT_METRIC_CACHE.clear();
    TEXT_METRIC_CACHE.set(cacheKey, metrics);
  } else {
    ctx.font = `800 ${metrics.font}px system-ui, "Segoe UI", sans-serif`;
  }
  ctx.translate(x, y); ctx.scale(1, lift);
  const tx = (metrics.left - metrics.right) / 2, ty = (metrics.ascent - metrics.descent) / 2;
  if (outline > 0) {
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.min(outline, metrics.font * .095);
    ctx.strokeText(value, tx, ty);
  }
  ctx.fillText(value, tx, ty);
  ctx.restore();
}

/** A depth-tested world surface, with a fixed footprint and no camera-facing
 * transforms. Oversampling and anisotropic mipmaps preserve the angled lettering. */
export function createSurfaceLabel(width: number, height: number, floor = true): SurfaceLabel {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  // Match the physical footprint: square pad captions must not stretch a wide
  // texture into tall, distorted letters. Keep the existing stock fascia ratio.
  canvas.height = floor ? Math.round(1024 * height / width) : 384;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true,
    depthTest: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // Ground lettering has transparent gaps: sharpen alpha coverage rather than
  // replacing transparent pixels with the old plaque's paper colour.
  material.onBeforeCompile = shader => {
    if (floor) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.a = smoothstep(.08, .92, diffuseColor.a);`);
      return;
    }
    shader.uniforms.labelInk = { value: new THREE.Color('#233d33') };
    shader.uniforms.labelPaper = { value: new THREE.Color('#fff9e9') };
    shader.fragmentShader = 'uniform vec3 labelInk; uniform vec3 labelPaper;\n' +
      shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        vec3 coverage = clamp((diffuseColor.rgb - labelInk) / (labelPaper - labelInk), 0., 1.);
        diffuseColor.rgb = mix(labelInk, labelPaper, smoothstep(vec3(.18), vec3(.82), coverage));`);
  };
  material.customProgramCacheKey = () => floor ? 'ground-painted-lettering-v2' : 'fixed-surface-lettering-v1';
  const mesh = new THREE.Mesh(plane(width, height), material);
  mesh.name = floor ? 'floorPurchaseLabel' : 'fixedStockLabel';
  if (floor) mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = LABEL_RENDER_ORDER + 6;
  mesh.userData.noTint = true; mesh.userData.fixedLabel = true;
  mesh.userData.dynamic = true; mesh.layers.set(LAYER_SURFACE_LABEL);
  let title = '', price = '', active = false, dirty = true, cooldown = 0;
  const paint = () => {
    if (!ctx) return;
    const h = canvas.height;
    ctx.clearRect(0, 0, 1024, h);
    if (floor) {
      // Only paint the glyphs. The actual room floor remains visible between
      // letters and rows; a narrow ink edge keeps white paint legible on tiles.
      ctx.fillStyle = '#fffdf4'; ctx.strokeStyle = '#22352c';
      drawSurfaceText(ctx, title, 512, price ? h * .32 : h / 2, 924, h * (price ? .28 : .72), 200, 1.45, 16);
      drawSurfaceText(ctx, price, 512, h * .71, 924, h * .34, 266, 1.45, 16);
    } else {
      ctx.fillStyle = '#fff9e9';
      ctx.beginPath(); ctx.roundRect(12, 12, 1000, h - 24, 40); ctx.fill();
      ctx.strokeStyle = active ? '#c79336' : '#4e6b5b'; ctx.lineWidth = 14; ctx.stroke();
      ctx.fillStyle = /^0\s*\//.test(title) ? '#91452e' : '#233d33';
      drawSurfaceText(ctx, title, 512, h / 2, 934, 278, 290, 1.45);
    }
    texture.needsUpdate = true; dirty = false; cooldown = .1;
  };
  return {
    mesh,
    setText(nextTitle, nextPrice = '') {
      if (title === nextTitle && price === nextPrice) return;
      title = nextTitle; price = nextPrice; dirty = true; mesh.visible = !!title;
      mesh.userData.labelTitle = title; mesh.userData.labelPrice = price;
      if (texture.version < 2) paint();
    },
    setActive(value) { if (active !== value) { active = value; if (!floor) dirty = true; } },
    update(dt) {
      cooldown = Math.max(0, cooldown - dt);
      if (!dirty || cooldown > 0) return;
      const now = performance.now();
      if (now - lastLabelPaintAt < 8) return;
      lastLabelPaintAt = now;
      paint();
    },
    dispose() { texture.dispose(); material.dispose(); mesh.removeFromParent(); },
  };
}

/** Reuse the existing depth buffer: staff/furniture still occlude these surfaces.
 * The color pass alone bypasses FXAA, which otherwise smears small glyphs. */
export function renderSurfaceLabels(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
  const background = scene.background, clear = renderer.autoClear;
  const mask = camera.layers.mask, update = scene.matrixWorldAutoUpdate;
  renderer.autoClear = false; scene.background = null;
  scene.matrixWorldAutoUpdate = false; camera.layers.set(LAYER_SURFACE_LABEL);
  try { renderer.render(scene, camera); }
  finally {
    renderer.autoClear = clear; scene.background = background;
    scene.matrixWorldAutoUpdate = update; camera.layers.mask = mask;
  }
}
