import * as THREE from 'three';
import { cone, cyl, detail, mat } from './Materials';
import { makeLabelPlate } from './ProductMesh';

/** A single floating arrow and action label; no persistent ground rings. */

export interface GuideTarget {
  x: number;
  z: number;
  /** Üstte yazan fiil — "ÇAYI AL", "MASAYA GÖTÜR"… */
  label: string;
  /** Longer HUD line when the goal is far. The world plate keeps `label`. */
  hud?: string;
  color: number;
}

export interface GuideMarker {
  root: THREE.Group;
  /** Hedefi güncelle. `null` → gösterici kapanır. */
  set(target: GuideTarget | null, playerX: number, playerZ: number): void;
  update(dt: number, cameraQuat: THREE.Quaternion): void;
  setEnabled(on: boolean): void;
  dispose(): void;
}

export function createGuideMarker(): GuideMarker {
  const root = new THREE.Group();
  root.name = 'guide';
  root.visible = false;

  /* --- hedefin üstündeki ok --- */
  const head = new THREE.Group();
  root.add(head);
  // Target colors change at runtime; never recolor the shared material cache.
  const arrowMat = mat(0xffc84a, { rough: 0.35, emissive: 0xffb020, emissiveIntensity: 0.5 }).clone();
  const arrow = detail(cone(0.3, 0.52, 6), arrowMat, 0, 0, 0);
  arrow.rotation.x = Math.PI; // ucu aşağı baksın
  head.add(arrow);
  const stem = detail(cyl(0.09, 0.09, 0.34, 6), arrowMat, 0, 0.4, 0);
  head.add(stem);

  /* --- fiil plakası (kameraya döner) --- */
  const labelHolder = new THREE.Group();
  labelHolder.position.y = 0.95;
  head.add(labelHolder);
  const label = makeLabelPlate('', 2.0, 0.4, 0x1d2b34, 0xffe6b0);
  labelHolder.add(label.mesh);

  // The arrow and action label are the single navigation cue.
  let t = 0;
  let enabled = true;
  let cur: GuideTarget | null = null;

  function paint(color: number): void {
    arrowMat.color.setHex(color);
    arrowMat.emissive.setHex(color);
  }

  function set(target: GuideTarget | null): void {
    if (!enabled || !target) {
      root.visible = false;
      cur = null;
      return;
    }
    if (!cur || cur.color !== target.color) paint(target.color);
    if (!cur || cur.label !== target.label) label.setText(target.label);
    const firstShow = !root.visible;
    cur = target;
    root.visible = true;
    // İlk görünüşte hedefe ışınlan; hedef değişiminde update() kaydırır —
    // salonun bir ucundan öbürüne sıçrayan ok gözü rahatsız ediyordu.
    if (firstShow) root.position.set(target.x, 0, target.z);
  }

  function update(dt: number, cameraQuat: THREE.Quaternion): void {
    if (!root.visible) return;
    t += dt;
    if (cur) {
      const k = 1 - Math.exp(-10 * dt);
      root.position.x += (cur.x - root.position.x) * k;
      root.position.z += (cur.z - root.position.z) * k;
    }
    head.position.y = 2.55 + Math.sin(t * 3.4) * 0.16;
    labelHolder.quaternion.copy(cameraQuat);
  }

  return {
    root,
    set,
    update,
    setEnabled(on: boolean) {
      enabled = on;
      if (!on) root.visible = false;
    },
    dispose() {
      label.dispose();
      arrowMat.dispose();
      root.removeFromParent();
    },
  };
}
