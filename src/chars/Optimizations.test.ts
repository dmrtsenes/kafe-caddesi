import assert from "node:assert/strict";
import { it } from "node:test";
import * as THREE from "three";
import { softenRunArms } from "./RunArms";
import { PushArmLayer } from "./PushArms";
import { mergeCharacterSkin } from "./SkinBatch";
import { AnchorMatrices } from "./AnchorMatrices";
import { ServiceArmLayer, stationaryServiceClip, serviceContactEnvelope, trayBounceEnvelope } from './ServiceArms';
import { CarryStack, popScaleEnvelope } from '../entities/CarryStack';

it('service clip holds every leg/root transform still without modifying the source', () => {
  const idle = new THREE.AnimationClip('idle', 2, [
    new THREE.VectorKeyframeTrack('mixamorigHips.position', [0, 2], [0, 1, 0, 0, 1.04, 0]),
    new THREE.QuaternionKeyframeTrack('mixamorigLeftUpLeg.quaternion', [0, 2], [0, 0, 0, 1, .2, 0, 0, Math.sqrt(.96)]),
  ]);
  const snapshot = JSON.stringify(idle.toJSON()), work = stationaryServiceClip(idle);
  assert.equal(work.name, 'Service_Standing');
  for (const track of work.tracks) {
    const size = track.getValueSize(); assert.deepEqual(track.values.slice(0, size), track.values.slice(size));
  }
  assert.equal(JSON.stringify(idle.toJSON()), snapshot);
  assert.equal(serviceContactEnvelope(0), 0); assert.equal(serviceContactEnvelope(1), 0);
  assert.equal(serviceContactEnvelope(.48), 1); assert.equal(serviceContactEnvelope(.58), 1);
  assert.equal(trayBounceEnvelope(0), 0); assert.equal(trayBounceEnvelope(1), 0);
  assert.ok(trayBounceEnvelope(0.18) > 0.98 && trayBounceEnvelope(0.18) <= 1.01);
  assert.equal(popScaleEnvelope(0), 1); assert.equal(popScaleEnvelope(1), 1);
  assert.ok(Math.abs(popScaleEnvelope(0.34) - 1.42) < 0.005);
});

it('CarryStack pops only newly added slots to 142% and settles cleanly without re-popping existing slots', () => {
  const anchor = new THREE.Group();
  anchor.userData.trayBounceSynced = true;
  const stack = new CarryStack(anchor);
  stack.setSlots(['cay']);
  const carried = () => stack.root.children.filter(c => c.name === 'carriedProduct');
  const baseScale0 = carried()[0].scale.x;
  stack.update(0.04, 0);
  stack.update(0.04, 0);
  const peakedScale0 = carried()[0].scale.x;
  assert.ok(Math.abs(peakedScale0 / baseScale0 - 1.42) < 0.015, 'first added item pops to ~142%');
  assert.ok(stack.root.rotation.x > 0.02, 'tray pitches visibly forward on load');
  for (let i = 0; i < 6; i++) stack.update(0.05, 0);
  assert.ok(Math.abs(carried()[0].scale.x - baseScale0) < 1e-6, 'first item settles back to 100%');
  assert.equal(stack.root.rotation.x, 0);

  stack.setSlots(['cay', 'latte']);
  const baseScale0After = carried()[0].scale.x;
  const baseScale1 = carried()[1].scale.x;
  stack.update(0.04, 0);
  stack.update(0.04, 0);
  assert.ok(Math.abs(carried()[0].scale.x - baseScale0After) < 1e-6, 'existing slot 0 does not re-pop when slot 1 is added');
  assert.ok(Math.abs(carried()[1].scale.x / baseScale1 - 1.42) < 0.015, 'newly added slot 1 pops to ~142%');
  stack.dispose();
});

it('both palms support a fixed tray, bounce in lockstep with trayPosition, and restore cleanly', () => {
  const actor = new THREE.Group(), model = new THREE.Group(); actor.add(model);
  actor.position.set(4, 0, -3); actor.rotation.y = .7;
  const tracks: THREE.KeyframeTrack[] = [];
  for (const [i, side] of ['Left', 'Right'].entries()) {
    const arm = new THREE.Bone(), lower = new THREE.Bone(), wrist = new THREE.Bone(), knuckle = new THREE.Bone();
    [arm.name, lower.name, wrist.name, knuckle.name] = ['Arm', 'ForeArm', 'Hand', 'HandIndex1'].map(s => 'mixamorig' + side + s);
    arm.position.set(i ? -.25 : .25, 1.2, 0); lower.position.y = -.3; wrist.position.y = -.28; knuckle.position.y = .054;
    model.add(arm); arm.add(lower); lower.add(wrist); wrist.add(knuckle);
    for (const joint of [arm, lower, wrist, knuckle]) tracks.push(new THREE.QuaternionKeyframeTrack(joint.name + '.quaternion', [0], [0, 0, 0, 1]));
  }
  const clip = new THREE.AnimationClip('idle', 1, tracks), layer = new ServiceArmLayer(model, actor, 1.5, clip);
  const palm = (side: string) => {
    const wrist = model.getObjectByName('mixamorig' + side + 'Hand')!;
    wrist.updateWorldMatrix(true, false);
    return actor.worldToLocal(new THREE.Vector3(0, .054 * .8, .004).applyMatrix4(wrist.matrixWorld));
  };
  for (let i = 0; i < 20; i++) {
    layer.restore(); model.rotation.x = Math.sin(i) * .035;
    layer.apply(1, true, false, 0, 'reach');
    assert.ok(palm('Left').distanceTo(new THREE.Vector3(.2175, .81, .285)) < 1e-6);
    assert.ok(palm('Right').distanceTo(new THREE.Vector3(-.2175, .81, .285)) < 1e-6);
    const left = palm('Left'), right = palm('Right');
    layer.restore(); layer.apply(1, true, true, .48, 'reach');
    assert.ok(palm('Left').distanceTo(left) < 1e-6);
    assert.ok(palm('Right').distanceTo(right) < 1e-6);
  }
  layer.triggerBounce(-0.075);
  const support = new THREE.Vector3();
  let minY = .81;
  for (let step = 0; step < 20; step++) {
    layer.restore();
    layer.apply(1, true, false, 0, 'reach', 1 / 60);
    layer.trayPosition(support);
    minY = Math.min(minY, support.y);
    assert.ok(Math.abs(palm('Left').y - support.y) < 1e-6);
    assert.ok(Math.abs(palm('Right').y - support.y) < 1e-6);
  }
  assert.ok(minY < .81 - .06, 'tray and both palms dip under added weight');
  assert.ok(Math.abs(support.y - .81) < 1e-6, 'tray bounce settles back to rest height');
  layer.restore();
  model.traverse(joint => { if ((joint as THREE.Bone).isBone) assert.deepEqual(joint.quaternion.toArray(), [0, 0, 0, 1]); });
  layer.apply(.5, true, false, 0, 'reach');
  assert.ok(model.getObjectByName('mixamorigLeftArm')!.quaternion.angleTo(new THREE.Quaternion()) > .1, 'blend must not alias its destination quaternion');
});

it('updates shared anchor paths once and matches a full pose under transformed parents', () => {
  const parent = new THREE.Group(), root = new THREE.Group(), spine = new THREE.Bone();
  const left = new THREE.Bone(), right = new THREE.Bone(), head = new THREE.Bone(), leg = new THREE.Bone();
  parent.add(root); root.add(spine, leg); spine.add(left, right, head);
  parent.position.set(3, 4, -2); parent.rotation.set(.2, -.4, .1); parent.scale.set(2, 3, .5);
  root.position.set(-1, .3, 5); root.rotation.set(.7, .3, -.2);
  left.position.set(-.3, .7, .2); right.position.set(.3, .7, .2); head.position.y = 1.5;
  const anchors = new AnchorMatrices(root, [left, right, head, left]);
  let spineVisits = 0, legVisits = 0;
  const update = spine.updateWorldMatrix.bind(spine);
  spine.updateWorldMatrix = (parents, children) => { spineVisits++; update(parents, children); };
  leg.updateWorldMatrix = () => { legVisits++; };
  for (let pose = 0; pose < 12; pose++) {
    parent.rotation.y += .07; spine.rotation.z += .03; right.position.z += .01;
    anchors.update();
    const actual = [left, right, head].map(node => node.matrixWorld.clone());
    parent.updateMatrixWorld(true);
    for (const [i, node] of [left, right, head].entries()) {
      for (let j = 0; j < 16; j++) assert.ok(Math.abs(actual[i].elements[j] - node.matrixWorld.elements[j]) < 1e-10);
    }
  }
  assert.equal(spineVisits, 12);
  assert.equal(legVisits, 0);
  assert.throws(() => new AnchorMatrices(root, [new THREE.Bone()]), /outside its root/);
});
it("softens only running upper arms without mutating source clips", () => {
  const name = "mixamorigLeftArm.quaternion";
  const q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    1,
  );
  const idle = new THREE.AnimationClip("idle", 1, [
    new THREE.QuaternionKeyframeTrack(name, [0], [0, 0, 0, 1]),
  ]);
  const run = new THREE.AnimationClip("run", 1, [
    new THREE.QuaternionKeyframeTrack(
      name,
      [0, 1],
      [...q.toArray(), ...q.toArray()],
    ),
    new THREE.VectorKeyframeTrack("hips.position", [0, 1], [0, 0, 0, 0, 1, 0]),
  ]);
  const result = softenRunArms(run, idle);
  assert.ok(
    Math.abs(
      new THREE.Quaternion()
        .fromArray(result.tracks[0].values)
        .angleTo(new THREE.Quaternion()) - 0.8,
    ) < 1e-6,
  );
  assert.deepEqual(result.tracks[1].values, run.tracks[1].values);
  assert.notDeepEqual(result.tracks[0].values, run.tracks[0].values);
});
it("merging skins and rigid accessories preserves posed vertices with transformed roots", () => {
  const scene = new THREE.Group();
  scene.scale.setScalar(0.7);
  scene.position.set(1, 0, -2);
  const root = new THREE.Bone(),
    hand = new THREE.Bone();
  root.add(hand);
  hand.position.set(0, 1, 0);
  scene.add(root);
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([root, hand]);
  skeleton.calculateInverses();
  const material = new THREE.MeshBasicMaterial();
  const sources: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const geometry = new THREE.BoxGeometry(0.3, 0.4, 0.2);
    const n = geometry.attributes.position.count;
    const weights = new Float32Array(n * 4),
      joints = new Uint16Array(n * 4);
    for (let v = 0; v < n; v++) {
      weights[v * 4] = 1;
      joints[v * 4] = i;
    }
    geometry.setAttribute("fincanCloth", new THREE.BufferAttribute(new Float32Array(n).fill(i), 1));
    geometry.setAttribute("skinWeight", new THREE.BufferAttribute(weights, 4));
    geometry.setAttribute("skinIndex", new THREE.BufferAttribute(joints, 4));
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.position.x = i * 0.25;
    scene.add(mesh);
    scene.updateMatrixWorld(true);
    mesh.bind(skeleton, mesh.matrixWorld);
    sources.push(mesh);
  }
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), material);
  hat.geometry.setAttribute("fincanCloth", new THREE.BufferAttribute(new Float32Array(hat.geometry.attributes.position.count).fill(3), 1));
  hat.position.y = 0.4;
  hand.add(hat);
  sources.push(hat);
  scene.updateMatrixWorld(true);
  const samples = sources.map((m) => ({
    geometry: m.geometry,
    bind: (m as THREE.SkinnedMesh).isSkinnedMesh
      ? (m as THREE.SkinnedMesh).bindMatrix.clone()
      : null,
    world: m.matrixWorld.clone(),
    rigid: !(m as THREE.SkinnedMesh).isSkinnedMesh,
  }));
  const merged = mergeCharacterSkin(scene)!;
  assert.ok(merged);
  assert.equal(scene.userData.skinBatch.before, 3);
  hand.rotation.z = 0.43;
  root.rotation.y = -0.27;
  scene.updateMatrixWorld(true);
  merged.skeleton.update();
  const expectedVertices: THREE.Vector3[] = [];
  const expectedCloth: number[] = [];
  const bindHand = new THREE.Matrix4().copy(skeleton.boneInverses[1]);
  for (const source of samples) {
    for (let v = 0; v < source.geometry.attributes.position.count; v++) {
      const expected = new THREE.Vector3().fromBufferAttribute(
        source.geometry.attributes.position,
        v,
      );
      if (source.rigid)
        expected
          .applyMatrix4(source.world)
          .applyMatrix4(bindHand)
          .applyMatrix4(hand.matrixWorld);
      else {
        const joint = source.geometry.attributes.skinIndex.getX(v);
        expected
          .applyMatrix4(source.bind!)
          .applyMatrix4(skeleton.boneInverses[joint])
          .applyMatrix4(skeleton.bones[joint].matrixWorld);
      }
      expectedVertices.push(expected);
      expectedCloth.push(source.geometry.attributes.fincanCloth.getX(v));
    }
  }
  assert.equal(
    merged.geometry.attributes.position.count,
    expectedVertices.length,
  );
  for (let v = 0; v < merged.geometry.attributes.position.count; v++) {
    const actual = merged
      .getVertexPosition(v, new THREE.Vector3())
      .applyMatrix4(merged.matrixWorld);
    const match = expectedVertices.findIndex(
      (p) => p.distanceTo(actual) < 1e-5,
    );
    assert.ok(match >= 0, `vertex ${v}`);
    assert.equal(merged.geometry.attributes.fincanCloth.getX(v), expectedCloth[match]);
    expectedVertices.splice(match, 1);
    expectedCloth.splice(match, 1);
  }
});

it('vacuum arm overlay preserves active leg/spine motion and source animation tracks', () => {
  const q = (angle: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
  const makeModel = () => {
    const model = new THREE.Group();
    for (const name of ['mixamorigLeftArm', 'mixamorigRightArm', 'mixamorigLeftUpLeg', 'mixamorigSpine']) {
      const bone = new THREE.Bone(); bone.name = name; model.add(bone);
    }
    return model;
  };
  const moving = new THREE.AnimationClip('moving', 1, [
    new THREE.QuaternionKeyframeTrack('mixamorigLeftArm.quaternion', [0, 1], [...q(-0.8).toArray(), ...q(0.8).toArray()]),
    new THREE.QuaternionKeyframeTrack('mixamorigRightArm.quaternion', [0, 1], [...q(0.8).toArray(), ...q(-0.8).toArray()]),
    new THREE.QuaternionKeyframeTrack('mixamorigLeftUpLeg.quaternion', [0, 1], [...q(0.6).toArray(), ...q(-0.6).toArray()]),
    new THREE.QuaternionKeyframeTrack('mixamorigSpine.quaternion', [0, 1], [...q(-0.1).toArray(), ...q(0.1).toArray()]),
  ]);
  const grasp = new THREE.AnimationClip('grasp', 1, [
    new THREE.QuaternionKeyframeTrack('mixamorigLeftArm.quaternion', [0], q(-1).toArray()),
    new THREE.QuaternionKeyframeTrack('mixamorigRightArm.quaternion', [0], q(-1).toArray()),
    new THREE.QuaternionKeyframeTrack('mixamorigLeftUpLeg.quaternion', [0], q(1.2).toArray()),
    new THREE.QuaternionKeyframeTrack('mixamorigSpine.quaternion', [0], q(0.9).toArray()),
  ]);
  const snapshots = [...moving.tracks, ...grasp.tracks].map((track) => Array.from(track.values));
  const base = makeModel(), held = makeModel();
  const baseMixer = new THREE.AnimationMixer(base), heldMixer = new THREE.AnimationMixer(held);
  baseMixer.clipAction(moving).play(); heldMixer.clipAction(moving).play();
  const layer = new PushArmLayer(held, grasp);
  let firstLeg: THREE.Quaternion | null = null;
  for (let frame = 0; frame < 20; frame++) {
    layer.restore(); baseMixer.update(1 / 30); heldMixer.update(1 / 30); layer.apply(1);
    for (const name of ['mixamorigLeftUpLeg', 'mixamorigSpine']) {
      assert.ok(held.getObjectByName(name)!.quaternion.angleTo(base.getObjectByName(name)!.quaternion) < 1e-7);
    }
    for (const name of ['mixamorigLeftArm', 'mixamorigRightArm']) assert.ok(held.getObjectByName(name)!.quaternion.angleTo(q(-1)) < 1e-7);
    if (frame === 0) firstLeg = held.getObjectByName('mixamorigLeftUpLeg')!.quaternion.clone();
  }
  assert.ok(firstLeg!.angleTo(held.getObjectByName('mixamorigLeftUpLeg')!.quaternion) > 0.2);
  layer.restore(); heldMixer.update(1 / 30); baseMixer.update(1 / 30); layer.apply(0);
  for (const name of ['mixamorigLeftArm', 'mixamorigRightArm']) assert.deepEqual(held.getObjectByName(name)!.quaternion.toArray(), base.getObjectByName(name)!.quaternion.toArray());
  assert.deepEqual([...moving.tracks, ...grasp.tracks].map((track) => Array.from(track.values)), snapshots);
  baseMixer.stopAllAction(); heldMixer.stopAllAction();
});

it('solves a forward two-handed grasp once while restoring the construction pose', () => {
  const model = new THREE.Group();
  model.position.set(5, 1, -3); model.rotation.set(0, 0.6, 0);
  const tracks: THREE.QuaternionKeyframeTrack[] = [];
  const wrists: THREE.Bone[] = [];
  for (const [index, side] of ['Left', 'Right'].entries()) {
    const upper = new THREE.Bone(), forearm = new THREE.Bone(), hand = new THREE.Bone();
    upper.name = 'mixamorig' + side + 'Arm'; forearm.name = 'mixamorig' + side + 'ForeArm'; hand.name = 'mixamorig' + side + 'Hand';
    upper.position.set(index === 0 ? 0.25 : -0.25, 1.2, 0);
    forearm.position.y = -0.3; hand.position.y = -0.28;
    model.add(upper); upper.add(forearm); forearm.add(hand); wrists.push(hand);
    for (const bone of [upper, forearm, hand]) tracks.push(new THREE.QuaternionKeyframeTrack(bone.name + '.quaternion', [0], [0, 0, 0, 1]));
  }
  const layer = new PushArmLayer(model, new THREE.AnimationClip('holding', 1, tracks));
  model.traverse((bone) => { if ((bone as THREE.Bone).isBone) assert.deepEqual(bone.quaternion.toArray(), [0, 0, 0, 1]); });
  layer.apply(1); model.updateMatrixWorld(true);
  const points = wrists.map((hand) => model.worldToLocal(hand.getWorldPosition(new THREE.Vector3())));
  for (const point of points) {
    assert.ok(point.z > 0.4);
    assert.ok(point.y > 0.9 && point.y < 1.1);
    assert.ok(Math.abs(Math.abs(point.x) - 0.22) < 1e-7);
  }
  assert.ok(Math.abs(points[0].distanceTo(points[1]) - 0.44) < 1e-7);
});

it('fits the pushing bar inside the palm and restores finger rotations after release', () => {
  const model = new THREE.Group(), tracks: THREE.QuaternionKeyframeTrack[] = [];
  const upper = new THREE.Bone(), fore = new THREE.Bone(), wrist = new THREE.Bone();
  upper.name = 'mixamorigLeftArm'; fore.name = 'mixamorigLeftForeArm'; wrist.name = 'mixamorigLeftHand';
  upper.position.set(.25, 1.2, 0); fore.position.y = -.3; wrist.position.y = -.28;
  model.add(upper); upper.add(fore); fore.add(wrist);
  const fingers: THREE.Bone[] = [];
  let parent = wrist;
  for (let i = 1; i <= 3; i++) {
    const finger = new THREE.Bone(); finger.name = 'mixamorigLeftHandIndex' + i;
    finger.position.y = i === 1 ? .054 : .043; parent.add(finger); parent = finger; fingers.push(finger);
  }
  for (const bone of [upper, fore, wrist, ...fingers]) tracks.push(new THREE.QuaternionKeyframeTrack(bone.name + '.quaternion', [0], [0, 0, 0, 1]));
  const clip = new THREE.AnimationClip('holding', 1, tracks);
  const layer = new PushArmLayer(model, clip);
  const originals = tracks.map(track => Array.from(track.values));
  layer.apply(1); model.updateMatrixWorld(true);
  const origin = wrist.getWorldPosition(new THREE.Vector3());
  const palm = layer.handPosition(wrist, new THREE.Vector3(), 1);
  assert.ok(palm.z > origin.z + .04);
  assert.ok(palm.y < origin.y);
  for (const finger of fingers) assert.ok(finger.quaternion.angleTo(new THREE.Quaternion()) > .7);
  assert.deepEqual(layer.handPosition(wrist, new THREE.Vector3(), 0).toArray(), origin.toArray());
  layer.restore();
  for (const bone of [upper, fore, wrist, ...fingers]) assert.deepEqual(bone.quaternion.toArray(), [0, 0, 0, 1]);
  assert.deepEqual(tracks.map(track => Array.from(track.values)), originals);
});

it('releasing the vacuum restores constant idle arm tracks without mixer cache drift', () => {
  const model = new THREE.Group(), arm = new THREE.Bone(); arm.name = 'mixamorigLeftArm'; model.add(arm);
  const idle = new THREE.AnimationClip('idle', 1, [new THREE.QuaternionKeyframeTrack(arm.name + '.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])]);
  const pose = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1);
  const holding = new THREE.AnimationClip('holding', 1, [new THREE.QuaternionKeyframeTrack(arm.name + '.quaternion', [0], pose.toArray())]);
  const layer = new PushArmLayer(model, holding), mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(idle).play();
  for (let frame = 0; frame < 40; frame++) {
    layer.restore(); mixer.update(1 / 60); layer.apply(1);
    assert.ok(arm.quaternion.angleTo(pose) < 1e-7);
  }
  layer.restore(); mixer.update(1 / 60); layer.apply(0);
  assert.deepEqual(arm.quaternion.toArray(), [0, 0, 0, 1]);
  mixer.stopAllAction();
});
