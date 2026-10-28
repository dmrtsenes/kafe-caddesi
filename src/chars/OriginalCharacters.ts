import * as THREE from 'three';
import { QUALITY } from '../core/Quality';
import { createAppearance } from './Appearance';
import { buildRig, type Rig } from './CharacterRig';
import { CharacterAnimator } from './CharacterAnimator';
import type { AnimState, CarryMode, WorkKind, CharacterHandle, CharacterOpts, CharRole } from './types';

export * from './types';

/** `handMidLocal` için yeniden kullanılan tampon — kare başına tahsis yok. */
const HAND_TMP = new THREE.Vector3();
const HAND_INVERSE = new THREE.Matrix4();

/**
 * Karakter fabrikası — görünüm reçetesi (Appearance) + eklemli iskelet
 * (CharacterRig) + prosedürel animatör (CharacterAnimator) tek tutamakta birleşir.
 *
 * Karakter +Z'ye bakar, ayakları y=0'dadır. Sahibi yalnızca
 * `root.position` ve `root.rotation.y` yazar; `root.scale` boy için ayrılmıştır.
 */
class Character implements CharacterHandle {
  readonly root: THREE.Group;
  readonly carryAnchor: THREE.Object3D;
  readonly handAnchor: THREE.Object3D;
  readonly headTop: THREE.Object3D;
  readonly height: number;

  private rig: Rig;
  private anim: CharacterAnimator;
  private disposed = false;

  constructor(rig: Rig, anim: CharacterAnimator) {
    this.rig = rig;
    this.anim = anim;
    this.root = rig.root;
    this.carryAnchor = rig.carryAnchor;
    this.root.add(this.carryAnchor);
    this.carryAnchor.rotation.set(0, 0, 0);
    this.handAnchor = rig.handAnchor;
    this.headTop = rig.headTop;
    this.height = rig.height;
  }

  setState(s: AnimState): void {
    this.anim.setState(s);
  }

  getState(): AnimState {
    return this.anim.getState();
  }

  setWorkKind(kind: WorkKind): void {
    this.anim.setWorkKind(kind);
  }
  setWorkPhase(phase: number): void {
    this.anim.setWorkPhase(phase);
  }
  setCarryMode(mode: CarryMode): void {
    this.anim.setCarryMode(mode);
  }
  setLocomotionLevel(level: number): void {
    this.anim.setLocomotionLevel(level);
  }

  setCarryCount(n: number): void {
    this.anim.setCarryCount(n);
  }

  setPush(on: boolean, sweeping = false): void {
    this.anim.setPush(on, sweeping);
  }

  handMidLocal(out: THREE.Vector3): THREE.Vector3 {
    const l = this.rig.handL;
    const r = this.rig.handR;
    // Ata zincirini güncelle: animatör pozu bu karede yazdı ama sahne
    // matrisleri henüz render'da tazelenecek — nişan bir kare geriden
    // gelirse sap ellerin arkasında salınır.
    l.updateWorldMatrix(true, false);
    r.updateWorldMatrix(true, false);
    HAND_TMP.setFromMatrixPosition(l.matrixWorld);
    out.setFromMatrixPosition(r.matrixWorld);
    out.add(HAND_TMP).multiplyScalar(0.5);
    return this.root.worldToLocal(out);
  }

  handSpanLocal(out: THREE.Vector3): THREE.Vector3 {
    const left = this.rig.handL;
    const right = this.rig.handR;
    left.updateWorldMatrix(true, false);
    right.updateWorldMatrix(true, false);
    HAND_INVERSE.copy(this.root.matrixWorld).invert();
    HAND_TMP.setFromMatrixPosition(left.matrixWorld).applyMatrix4(HAND_INVERSE);
    out.setFromMatrixPosition(right.matrixWorld).applyMatrix4(HAND_INVERSE);
    return out.sub(HAND_TMP);
  }

  update(dt: number, planarSpeed: number, turnRate = 0): void {
    if (this.disposed) return;
    this.anim.update(dt, planarSpeed, turnRate);
    this.handMidLocal(this.carryAnchor.position);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    /**
     * `anim.dispose()` alt ağaç sökülmeden ÖNCE karaktere özel kaynakları
     * serbest bırakır: rig'in verdiği `disposeOwned` kapanışı (Task 7) —
     * birleşik tampon + `Skeleton`in kemik dokusu, karakter başına tam bir
     * geometri ve bir doku (ikisi de sızmıştı: Task 5 geometriyi, Task 6
     * dokuyu kapattı). Paylaşımlı materyal/geometri önbelleği
     * (world/Materials.ts) buradan HİÇ etkilenmez, asla dispose edilmez.
     */
    this.anim.dispose();
    this.root.removeFromParent();
    // Alt ağacın geri kalanı (Bone/Object3D düğümleri — GPU kaynağı
    // taşımazlar) GC'ye bırakılır.
    this.root.clear();
    this.rig.ponytail = null;
  }
}

export function createOriginalCharacter(role: CharRole, opts: CharacterOpts = {}): CharacterHandle {
  const spec = createAppearance(role, opts);
  const rig = buildRig(spec);
  const seed = (opts.seed ?? (spec.variant + 1) * 2654435761) >>> 0;
  rig.root.userData.characterPack = 'fincan-original';
  rig.root.userData.characterRole = role;
  return new Character(rig, new CharacterAnimator(rig, spec, seed, role === 'player'));
}
