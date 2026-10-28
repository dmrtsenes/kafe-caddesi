import * as THREE from "three";

/** Soften only upper-arm swing; leave legs, timing and carrying/work clips intact. */
export function softenRunArms(
  run: THREE.AnimationClip,
  idle: THREE.AnimationClip,
  amount = 0.8,
): THREE.AnimationClip {
  const clip = run.clone();
  const weight = THREE.MathUtils.clamp(amount, 0, 1);
  const from = new THREE.Quaternion(),
    to = new THREE.Quaternion(),
    result = new THREE.Quaternion();
  for (const track of clip.tracks) {
    if (
      !(track instanceof THREE.QuaternionKeyframeTrack) ||
      !/mixamorig(?:Left|Right)Arm\.quaternion$/i.test(track.name)
    )
      continue;
    const rest = idle.tracks.find((t) => t.name === track.name);
    if (!rest) continue;
    from.fromArray(rest.values, 0).normalize();
    for (let i = 0; i < track.values.length; i += 4) {
      to.fromArray(track.values, i).normalize();
      result
        .slerpQuaternions(from, to, weight)
        .normalize()
        .toArray(track.values, i);
    }
  }
  clip.name = run.name;
  return clip;
}
