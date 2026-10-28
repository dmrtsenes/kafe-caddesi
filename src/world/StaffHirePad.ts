import * as THREE from 'three';
import { compactPadLabel, createSurfaceLabel } from './SurfaceLabel';
import { LABEL_RENDER_ORDER, LAYER_SURFACE_LABEL } from './layers';

export const STAFF_HIRE_PAD_HALF = 0.65;

export interface StaffHirePad {
  root: THREE.Group;
  setLabel(text: string): void;
  setActive(active: boolean): void;
  setHint(text: string): void;
  setProgress(progress: number): void;
  setArmed(progress: number): void;
  update(dt: number, cameraQuat: THREE.Quaternion): void;
  dispose(): void;
}

/** Painted floor lines with no slab or filled background under the lettering. */
export function createStaffHirePad(color: number, shortName?: string): StaffHirePad {
  const root = new THREE.Group();
  root.name = 'staffHirePad';
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const material = (color: number, opacity = 1) => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity,
      depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    materials.push(m);
    return m;
  };
  const mesh = (x: number, z: number, m: THREE.Material) => {
    const geometry = new THREE.PlaneGeometry(x, z);
    geometries.push(geometry);
    const result = new THREE.Mesh(geometry, m);
    result.rotation.x = -Math.PI / 2;
    result.userData.fixedLabel = true; result.userData.noTint = true;
    result.layers.set(LAYER_SURFACE_LABEL);
    result.renderOrder = LABEL_RENDER_ORDER + 5;
    result.castShadow = false;
    result.receiveShadow = false;
    root.add(result);
    return result;
  };
  const edgeMat = material(0xfffdf4, 0.95);
  const fillMat = material(color);
  const fills: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const horizontal = i % 2 === 0;
    const edge = mesh(horizontal ? 1.3 : 0.042, horizontal ? 0.042 : 1.3, edgeMat);
    edge.position.set(i === 1 ? 0.622 : i === 3 ? -0.622 : 0, 0.02, i === 0 ? -0.622 : i === 2 ? 0.622 : 0);
    const fill = mesh(horizontal ? 1.3 : 0.055, horizontal ? 0.055 : 1.3, fillMat);
    fill.position.copy(edge.position); fill.position.y = 0.022;
    fill.renderOrder = LABEL_RENDER_ORDER + 6;
    fill.visible = false;
    fills.push(fill);
  }
  const armed = mesh(0.86, 0.035, material(0xffd36a));
  armed.position.set(0, 0.024, 0.535); armed.visible = false;
  // The caption belongs to the payment square. Leave the coloured deposit
  // border and the bottom activation bar clear at every camera position.
  const caption = createSurfaceLabel(1.16, 1.02);
  caption.mesh.position.set(0, .026, -.055);
  root.add(caption.mesh);
  let active = false;
  let progress = -1;
  return {
    root,
    setLabel(text) { const value = compactPadLabel(text, shortName); caption.setText(value.title, value.price); },
    setHint(text) { root.userData.hint = text; },
    setActive(on) {
      if (active === on) return;
      active = on; caption.setActive(on);
      edgeMat.color.setHex(on ? 0xffd36a : 0xfffdf4);
    },
    setProgress(value) {
      const next = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
      if (next === progress) return;
      progress = next;
      root.userData.progress = next;
      fills.forEach((fill, i) => {
        const fraction = Math.max(0, Math.min(1, next * 4 - i));
        fill.visible = fraction > 0;
        if (i % 2 === 0) {
          fill.scale.x = fraction;
          fill.position.x = (i === 0 ? -1 : 1) * (1 - fraction) * 0.65;
        } else {
          fill.scale.y = fraction;
          fill.position.z = (i === 1 ? -1 : 1) * (1 - fraction) * 0.65;
        }
      });
    },
    setArmed(value) {
      const fraction = Math.max(0, Math.min(1, value));
      armed.visible = fraction > 0 && fraction < 1;
      armed.scale.x = fraction;
      armed.position.x = -(1 - fraction) * 0.43;
    },
    update(dt, _cameraQuat) {
      caption.update(dt);
    },
    dispose() {
      caption.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const m of materials) m.dispose();
      root.removeFromParent();
    },
  };
}
