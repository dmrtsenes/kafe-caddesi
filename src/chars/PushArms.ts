import * as THREE from 'three';

/** Upper-body grasp only. Spine/legs keep the current source animation. */
export class PushArmLayer {
  private readonly bindings: { joint: THREE.Object3D; pose: THREE.Quaternion; base: THREE.Quaternion }[] = [];
  private readonly palms = new Map<THREE.Object3D, THREE.Vector3>();
  private applied = false;

  constructor(model: THREE.Object3D, holdingPose: THREE.AnimationClip, pose: 'push' | 'tray' = 'push', family: 'mixamo' | 'quaternius' = 'mixamo') {
    const original: THREE.Quaternion[] = [];
    for (const track of holdingPose.tracks) {
      if (!(track instanceof THREE.QuaternionKeyframeTrack)) continue;
      const allowed = family === 'quaternius' ? /^(?:Shoulder|UpperArm|LowerArm|Wrist|Index|Middle|Ring|Pinky|Thumb)[0-4]?[LR]\.quaternion$/ : /^mixamorig(?:Left|Right)(?:Shoulder|Arm|ForeArm|Hand(?:Thumb|Index|Middle|Ring|Pinky)?[0-4]?)\.quaternion$/i;
      if (!allowed.test(track.name)) continue;
      const joint = model.getObjectByName(track.name.slice(0, -'.quaternion'.length));
      if (!joint || track.values.length < 4) continue;
      original.push(joint.quaternion.clone());
      const pose = new THREE.Quaternion().fromArray(track.values, 0).normalize();
      this.bindings.push({ joint, pose, base: joint.quaternion.clone() });
      joint.quaternion.copy(pose);
    }

    // The carrying clip holds a box against the belly. Solve a forward grasp once,
    // in bind geometry, then retain those local arm rotations as the push pose.
    // No IK iteration or temporary allocation is added to the per-frame path.
    model.updateWorldMatrix(true, true);
    const rootInverse = new THREE.Matrix4().copy(model.matrixWorld).invert();
    const parentInverse = new THREE.Matrix4();
    const shoulder = new THREE.Vector3(), elbow = new THREE.Vector3(), hand = new THREE.Vector3();
    const target = new THREE.Vector3(), elbowTarget = new THREE.Vector3(), axis = new THREE.Vector3(), pole = new THREE.Vector3();
    const from = new THREE.Vector3(), to = new THREE.Vector3();
    const turn = new THREE.Quaternion();
    const localPosition = (joint: THREE.Object3D, out: THREE.Vector3) => out.setFromMatrixPosition(joint.matrixWorld).applyMatrix4(rootInverse);
    const aim = (joint: THREE.Object3D, child: THREE.Object3D, destination: THREE.Vector3) => {
      if (!joint.parent) return;
      parentInverse.copy(joint.parent.matrixWorld).invert();
      from.setFromMatrixPosition(child.matrixWorld).applyMatrix4(parentInverse).sub(joint.position).normalize();
      to.copy(destination).applyMatrix4(model.matrixWorld).applyMatrix4(parentInverse).sub(joint.position).normalize();
      turn.setFromUnitVectors(from, to);
      joint.quaternion.premultiply(turn).normalize();
      joint.updateWorldMatrix(false, true);
    };
    for (const side of ['Left', 'Right']) {
      const suffix = side === 'Left' ? 'L' : 'R';
      const upper = model.getObjectByName(family === 'quaternius' ? 'UpperArm' + suffix : 'mixamorig' + side + 'Arm');
      const forearm = model.getObjectByName(family === 'quaternius' ? 'LowerArm' + suffix : 'mixamorig' + side + 'ForeArm');
      const wrist = model.getObjectByName(family === 'quaternius' ? 'Wrist' + suffix : 'mixamorig' + side + 'Hand');
      if (!upper || !forearm || !wrist) continue;
      localPosition(upper, shoulder); localPosition(forearm, elbow); localPosition(wrist, hand);
      const upperLength = shoulder.distanceTo(elbow), lowerLength = elbow.distanceTo(hand);
      const reach = upperLength + lowerLength;
      if (upperLength < 1e-5 || lowerLength < 1e-5) continue;
      target.set(shoulder.x * (pose === 'tray' ? 1.12 : 0.88), shoulder.y - reach * (pose === 'tray' ? 0.25 : 0.40), shoulder.z + reach * (pose === 'tray' ? 0.86 : 0.80));
      axis.subVectors(target, shoulder);
      const distance = Math.min(axis.length(), reach * 0.98);
      axis.normalize();
      target.copy(shoulder).addScaledVector(axis, distance);
      const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
      const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
      pole.set(shoulder.x >= 0 ? 1 : -1, -0.25, -0.15);
      pole.addScaledVector(axis, -pole.dot(axis)).normalize();
      elbowTarget.copy(shoulder).addScaledVector(axis, along).addScaledVector(pole, height);
      aim(upper, forearm, elbowTarget);
      aim(forearm, wrist, target);
      // The carrying clip presents open palms. A floor tool needs a pronated
      // grasp, with the bar under the knuckles instead of passing through wrists.
      const knuckle = model.getObjectByName(family === 'quaternius' ? 'Index1' + suffix : 'mixamorig' + side + 'HandIndex1');
      if (pose === 'push' && family === 'mixamo' && knuckle?.parent === wrist && wrist.parent) {
        const modelRotation = model.getWorldQuaternion(new THREE.Quaternion());
        const parentRotation = wrist.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
        const graspRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 + 0.12);
        wrist.quaternion.copy(parentRotation.multiply(modelRotation).multiply(graspRotation));
        for (let index = 1; index <= 3; index++) {
          const joint = model.getObjectByName('mixamorig' + side + 'HandIndex' + index);
          if (joint && this.bindings.some(binding => binding.joint === joint)) {
            joint.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), [0, 0.82, 1.18, 0.86][index]);
          }
        }
        const thumb = model.getObjectByName('mixamorig' + side + 'HandThumb2');
        if (thumb && this.bindings.some(binding => binding.joint === thumb)) {
          thumb.quaternion.setFromEuler(new THREE.Euler(0.65, 0, side === 'Left' ? -0.35 : 0.35));
        }
        this.palms.set(wrist, new THREE.Vector3(0, knuckle.position.y * 0.9, knuckle.position.y * 0.4));
        wrist.updateWorldMatrix(false, true);
      }
    }
    for (let index = 0; index < this.bindings.length; index++) {
      const binding = this.bindings[index];
      binding.pose.copy(binding.joint.quaternion);
      binding.joint.quaternion.copy(original[index]);
    }
    model.updateWorldMatrix(true, true);
  }

  /** Caller has updated the wrist matrix. No allocations in the animation loop. */
  handPosition(wrist: THREE.Object3D, out: THREE.Vector3, weight: number): THREE.Vector3 {
    const palm = this.palms.get(wrist);
    if (palm && weight > 0) return out.copy(palm).multiplyScalar(Math.min(1, weight)).applyMatrix4(wrist.matrixWorld);
    return out.setFromMatrixPosition(wrist.matrixWorld);
  }

  /** Restore before mixer.update: Three can skip writes for constant keyframes. */
  restore(): void {
    if (!this.applied) return;
    for (const binding of this.bindings) binding.joint.quaternion.copy(binding.base);
    this.applied = false;
  }

  /** Called after the mixer writes this frame's unchanged locomotion pose. */
  apply(weight: number): void {
    if (weight <= 0) return;
    const amount = THREE.MathUtils.clamp(weight, 0, 1);
    for (const binding of this.bindings) {
      binding.base.copy(binding.joint.quaternion);
      binding.joint.quaternion.slerp(binding.pose, amount);
    }
    this.applied = true;
  }
}
