import * as THREE from 'three';

export type StaffStatus = 'rest' | 'moving' | 'working' | 'deliver' | 'waiting' | 'blocked';

const SPEC: Record<StaffStatus, { glyph: string; bg: string }> = {
  rest: { glyph: '☕', bg: '#59656d' },
  moving: { glyph: '➜', bg: '#5b9bd5' },
  working: { glyph: '✓', bg: '#4fb59a' },
  deliver: { glyph: '↗', bg: '#c98243' },
  waiting: { glyph: '…', bg: '#7a6a92' },
  blocked: { glyph: '!', bg: '#d64b3c' },
};

const cache = new Map<StaffStatus, THREE.SpriteMaterial>();

function material(status: StaffStatus): THREE.SpriteMaterial {
  const hit = cache.get(status);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = SPEC[status].bg;
    ctx.beginPath();
    ctx.arc(64, 58, 43, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff6e7';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 56px system-ui, "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SPEC[status].glyph, 64, 60);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const out = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
  cache.set(status, out);
  return out;
}

export interface StaffStatusBadge {
  sprite: THREE.Sprite;
  set(status: StaffStatus, dt: number): void;
  dispose(): void;
}

export function createStaffStatusBadge(): StaffStatusBadge {
  const sprite = new THREE.Sprite(material('rest'));
  sprite.scale.set(0.42, 0.42, 1);
  sprite.position.set(0, 0.12, 0);
  sprite.visible = false;
  let current: StaffStatus | null = null;
  let candidate: StaffStatus = 'rest';
  let stable = 0;
  let visibleLeft = Infinity;

  return {
    sprite,
    set(_status, _dt) {
      sprite.visible = false;
    },
    dispose() {
      sprite.removeFromParent();
    },
  };
}
