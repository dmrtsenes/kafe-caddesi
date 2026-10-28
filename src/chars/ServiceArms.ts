import * as T from 'three';
import type { WorkKind } from './types';

/** A service contact must never sample walking/sweeping leg keyframes. */
export function stationaryServiceClip(idle: T.AnimationClip): T.AnimationClip {
  return new T.AnimationClip('Service_Standing', 1, idle.tracks.map(source => {
    const track = source.clone(), size = track.getValueSize();
    track.times = new Float32Array([0, 1]);
    track.values = new Float32Array([...source.values.slice(0, size), ...source.values.slice(0, size)]);
    return track;
  }));
}

/** The item transfer happens at phase .48 in HandActionClock. */
export function serviceContactEnvelope(phase: number): number {
  if (phase < 0) return 0;
  const t = T.MathUtils.clamp(phase, 0, 1);
  return t < .48 ? T.MathUtils.smoothstep(t, .08, .48) : 1 - T.MathUtils.smoothstep(t, .58, 1);
}

export const TRAY_BOUNCE_DURATION = 0.25;

/** Normalized underdamped tray weight-dip / rebound curve over t in [0, 1]. */
export function trayBounceEnvelope(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  return (Math.sin(t * Math.PI * 1.4) * Math.exp(-t * 3.2) * (1 - t)) / 0.328;
}

function makePalmRotation(sign: 1 | -1): T.Quaternion {
  const x = new T.Vector3(-0.84, -sign * 0.54, 0.02).normalize();
  const y = new T.Vector3(-sign * 0.04, -0.02, 0.999).normalize();
  const z = new T.Vector3().crossVectors(x, y).normalize();
  x.crossVectors(y, z).normalize();
  return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
}

interface Arm {
  side: 'Left' | 'Right';
  upper: T.Object3D;
  lower: T.Object3D;
  wrist: T.Object3D;
  palm: T.Vector3;
  target: T.Vector3;
  fingers: { joint: T.Object3D; rest: T.Quaternion; index: number }[];
}

/** Two supported palms, one free service hand. Solve only the active arms, with
 * reused temporaries; never update the complete render tree in this layer. */
export class ServiceArmLayer {
  private readonly arms: Arm[] = [];
  private readonly bindings: { joint: T.Object3D; base: T.Quaternion }[] = [];
  private readonly restPose: { joint: T.Object3D; rest: T.Quaternion }[] = [];
  private applied = false;
  private engaged = false;
  private bounceTime = 1;
  private bounceAmp = 0;
  private bounceY = 0;
  private readonly actor: T.Object3D;
  private readonly height: number;
  private readonly inverse = new T.Matrix4();
  private readonly parentInverse = new T.Matrix4();
  private readonly shoulder = new T.Vector3();
  private readonly elbow = new T.Vector3();
  private readonly hand = new T.Vector3();
  private readonly target = new T.Vector3();
  private readonly elbowTarget = new T.Vector3();
  private readonly axis = new T.Vector3();
  private readonly pole = new T.Vector3();
  private readonly from = new T.Vector3();
  private readonly to = new T.Vector3();
  private readonly offset = new T.Vector3();
  private readonly turn = new T.Quaternion();
  private readonly parentRotation = new T.Quaternion();
  private readonly actorRotation = new T.Quaternion();
  private readonly leftPalmRotation = makePalmRotation(1);
  private readonly rightPalmRotation = makePalmRotation(-1);
  private readonly wipePalmRotation = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(
    new T.Vector3(1, 0, 0), new T.Vector3(0, 0, 1), new T.Vector3(0, -1, 0),
  ));

  constructor(model: T.Object3D, actor: T.Object3D, height: number, idle: T.AnimationClip, carryClip?: T.AnimationClip) {
    this.actor = actor; this.height = height;
    const poseClip = carryClip ?? idle;
    const trackQuat = (name: string): T.Quaternion | null => {
      const track = poseClip.tracks.find(t => t.name === `${name}.quaternion`) ?? idle.tracks.find(t => t.name === `${name}.quaternion`);
      return track ? new T.Quaternion().fromArray(track.values).normalize() : null;
    };
    const bindJoint = (joint: T.Object3D, rest?: T.Quaternion) => {
      if (!this.bindings.some(b => b.joint === joint)) this.bindings.push({ joint, base: joint.quaternion.clone() });
      if (rest) this.restPose.push({ joint, rest });
    };
    for (const part of ['Spine', 'Spine1', 'Spine2'] as const) {
      const spine = model.getObjectByName(`mixamorig${part}`);
      if (spine) bindJoint(spine, spine.quaternion.clone());
    }
    for (const side of ['Left', 'Right'] as const) {
      const sign = side === 'Left' ? 1 : -1;
      const get = (part: string) => model.getObjectByName(`mixamorig${side}${part}`);
      const upper = get('Arm'), lower = get('ForeArm'), wrist = get('Hand');
      if (!upper || !lower || !wrist) continue;
      for (const part of ['Shoulder', 'Arm', 'ForeArm'] as const) {
        const joint = get(part);
        if (!joint) continue;
        // Mirror Right carry pose onto Left so both shoulders and arms start symmetric.
        const rq = carryClip ? trackQuat(`mixamorigRight${part}`) : trackQuat(joint.name);
        let rest = rq
          ? (carryClip && side === 'Left' ? new T.Quaternion(rq.x, -rq.y, -rq.z, rq.w).normalize() : rq.clone())
          : joint.quaternion.clone();
        if (part === 'ForeArm' && carryClip) {
          rest = rest.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -sign * 0.78)).normalize();
        }
        bindJoint(joint, rest);
      }
      for (let i = 1; i <= 3; i++) {
        const thumb = get('HandThumb' + i);
        if (!thumb) continue;
        const rest = i === 1
          ? new T.Quaternion().setFromEuler(new T.Euler(0.15, 0, sign * 0.42))
          : new T.Quaternion();
        bindJoint(thumb, rest);
      }
      const fingers: Arm['fingers'] = [];
      for (let i = 1; i <= 3; i++) {
        const joint = get('HandIndex' + i);
        if (!joint) continue;
        const rest = carryClip ? new T.Quaternion() : (trackQuat(joint.name) ?? joint.quaternion.clone());
        fingers.push({ joint, index: i, rest });
      }
      this.arms.push({ side, upper, lower, wrist, fingers,
        target: new T.Vector3(),
        palm: new T.Vector3(0, (get('HandIndex1')?.position.y ?? 0) * .8, .004) });
      for (const joint of [upper, lower, wrist, ...fingers.map(f => f.joint)]) bindJoint(joint);
    }
  }

  restore(): void {
    if (!this.applied) return;
    for (const binding of this.bindings) binding.joint.quaternion.copy(binding.base);
    this.applied = false;
  }

  triggerBounce(amplitudeMeters: number): void {
    this.bounceAmp = amplitudeMeters;
    this.bounceTime = 0;
  }

  resetBounce(): void {
    this.bounceAmp = 0;
    this.bounceTime = 1;
    this.bounceY = 0;
  }

  /** Stable actor-local support frame; includes vertical weight dip/rebound so tray and palms move as one. */
  trayPosition(out: T.Vector3): T.Vector3 {
    return out.set(0, this.height * .54 + this.bounceY, this.height * .19);
  }

  private local(joint: T.Object3D, out: T.Vector3): T.Vector3 {
    return out.setFromMatrixPosition(joint.matrixWorld).applyMatrix4(this.inverse);
  }

  private aim(joint: T.Object3D, child: T.Object3D, destination: T.Vector3): void {
    if (!joint.parent) return;
    this.parentInverse.copy(joint.parent.matrixWorld).invert();
    this.from.setFromMatrixPosition(child.matrixWorld).applyMatrix4(this.parentInverse).sub(joint.position).normalize();
    this.to.copy(destination).applyMatrix4(this.actor.matrixWorld).applyMatrix4(this.parentInverse).sub(joint.position).normalize();
    joint.quaternion.premultiply(this.turn.setFromUnitVectors(this.from, this.to)).normalize();
    joint.updateWorldMatrix(false, false);
    child.updateWorldMatrix(false, false);
  }

  apply(weight: number, carrying: boolean, working: boolean, phase: number, kind: WorkKind, dt = 0, compactGrip = false): void {
    if (weight <= 0) { this.engaged = false; this.resetBounce(); return; }
    if (dt > 0 && this.bounceTime < 1) {
      this.bounceTime = Math.min(1, this.bounceTime + dt / TRAY_BOUNCE_DURATION);
      this.bounceY = this.bounceAmp * trayBounceEnvelope(this.bounceTime);
    } else if (this.bounceTime >= 1) {
      this.bounceY = 0;
    }
    for (const binding of this.bindings) binding.base.copy(binding.joint.quaternion);
    for (const item of this.restPose) item.joint.quaternion.copy(item.rest);
    this.actor.updateWorldMatrix(true, false);
    this.inverse.copy(this.actor.matrixWorld).invert();
    this.actor.getWorldQuaternion(this.actorRotation);
    const actorScaleX = this.actor.getWorldScale(this.to).x;
    const contact = working ? serviceContactEnvelope(phase) : 0;
    for (const arm of this.arms) {
      // Update just the shoulder ancestry and the three arm joints.
      arm.upper.updateWorldMatrix(true, false);
      arm.lower.updateWorldMatrix(false, false); arm.wrist.updateWorldMatrix(false, false);
      this.local(arm.upper, this.shoulder); this.local(arm.lower, this.elbow); this.local(arm.wrist, this.hand);
      const a = this.shoulder.distanceTo(this.elbow), b = this.elbow.distanceTo(this.hand), reach = a + b;
      if (Math.min(a, b) < 1e-5) continue;
      const sign = this.shoulder.x >= 0 ? 1 : -1;
      const free = working && !carrying && kind !== 'reach' && kind !== 'generic' && arm.side === 'Right';
      if (carrying || !working) {
        this.target.set(sign * this.height * (compactGrip ? .085 : .145), this.height * .54, this.height * (compactGrip ? .20 : .19));
      } else {
        this.target.set(sign * this.height * .145, this.height * (free ? .54 : .43), this.height * (free ? .26 : .09));
      }
      if (free) {
        if (kind === 'wipe') {
          // Masa üstünde enerjik, kesintisiz oval oval ovalama yörüngesi
          const scrubCycle = phase * Math.PI * 6;
          this.target.x = Math.sin(scrubCycle) * (this.height * 0.16) + (this.height * 0.04);
          this.target.z = this.height * 0.31 + Math.cos(scrubCycle) * (this.height * 0.10);
          this.target.y = this.height * 0.485 + Math.sin(scrubCycle * 2) * (this.height * 0.012);
        } else {
          this.target.y += this.height * contact * 0.055;
          this.target.z += this.height * contact * (kind === 'cash' ? .105 : .15);
          this.target.x += this.height * contact * (-sign * .045);
        }
      }
      // Picking up the first product or placing the last one changes support
      // mode mid-gesture; approach the new hand target without a one-frame snap.
      if (!this.engaged || dt <= 0) arm.target.copy(this.target);
      else arm.target.lerp(this.target, 1 - Math.exp(-40 * dt));
      this.target.copy(arm.target);
      if (carrying || !working) this.target.y += this.bounceY;
      // Solve wrist behind the desired support point so the palm, not the wrist,
      // contacts the underside. Palm orientation stays level in actor space.
      const palmRot = free ? this.wipePalmRotation : (sign > 0 ? this.leftPalmRotation : this.rightPalmRotation);
      this.offset.copy(arm.palm).applyQuaternion(palmRot);
      const wristScale = arm.wrist.getWorldScale(this.from).x / actorScaleX;
      this.target.addScaledVector(this.offset, -Math.abs(wristScale));
      this.axis.subVectors(this.target, this.shoulder);
      const distance = T.MathUtils.clamp(this.axis.length(), Math.abs(a - b) + 1e-5, reach * .98);
      this.axis.normalize(); this.target.copy(this.shoulder).addScaledVector(this.axis, distance);
      const along = (a * a - b * b + distance * distance) / (2 * distance);
      const bend = Math.sqrt(Math.max(0, a * a - along * along));
      this.pole.set(sign * .55, -.70, -.30).addScaledVector(this.axis, -this.pole.dot(this.axis)).normalize();
      this.elbowTarget.copy(this.shoulder).addScaledVector(this.axis, along).addScaledVector(this.pole, bend);
      this.aim(arm.upper, arm.lower, this.elbowTarget);
      arm.wrist.updateWorldMatrix(false, false);
      this.aim(arm.lower, arm.wrist, this.target);
      arm.wrist.parent!.getWorldQuaternion(this.parentRotation).invert();
      arm.wrist.quaternion.copy(this.parentRotation).multiply(this.actorRotation).multiply(palmRot).normalize();
      for (const finger of arm.fingers) {
        this.turn.setFromAxisAngle(this.from.set(1, 0, 0), kind === 'wipe' && free ? 0.35 : (free ? 0.20 * contact : 0));
        finger.joint.quaternion.copy(finger.rest).multiply(this.turn);
      }
    }
    const amount = T.MathUtils.clamp(weight, 0, 1);
    for (const binding of this.bindings) {
      this.turn.copy(binding.joint.quaternion);
      binding.joint.quaternion.slerpQuaternions(binding.base, this.turn, amount);
    }
    this.applied = true;
    this.engaged = true;
  }
}
