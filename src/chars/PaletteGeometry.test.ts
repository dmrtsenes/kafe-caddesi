import assert from "node:assert/strict";
import { it } from "node:test";
import * as THREE from "three";
import { paletteGeometry } from "./PaletteGeometry";

it("shares triangle vertices while retaining normals, UVs and outfit material seams", () => {
  const source = new THREE.BoxGeometry().toNonIndexed();
  const original = Array.from(source.attributes.position.array);
  const result = paletteGeometry(source);
  assert.ok(
    result.attributes.position.count < source.attributes.position.count,
  );
  assert.equal(result.index!.count, source.attributes.position.count);
  for (let corner = 0; corner < result.index!.count; corner++) {
    const vertex = result.index!.getX(corner);
    for (const key of ["position", "normal", "uv"]) {
      const before = source.attributes[key],
        after = result.attributes[key];
      for (let c = 0; c < before.itemSize; c++)
        assert.equal(
          after.getComponent(vertex, c),
          before.getComponent(corner, c),
        );
    }
    const group = source.groups.find(
      (g) => corner >= g.start && corner < g.start + g.count,
    )!;
    assert.equal(
      result.attributes.paletteSlot.getX(vertex),
      group.materialIndex,
    );
  }
  assert.equal(paletteGeometry(source), result);
  assert.deepEqual(Array.from(source.attributes.position.array), original);
  assert.equal(source.attributes.paletteSlot, undefined);
  source.dispose();
});

it("does not weld together coincident corners with different bone weights", () => {
  const source = new THREE.BufferGeometry();
  source.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      3,
    ),
  );
  const weights = new Float32Array(24),
    joints = new Uint16Array(24);
  for (let i = 0; i < 6; i++) {
    weights[i * 4] = 1;
    joints[i * 4] = i < 3 ? 0 : 1;
  }
  source.setAttribute("skinWeight", new THREE.BufferAttribute(weights, 4));
  source.setAttribute("skinIndex", new THREE.BufferAttribute(joints, 4));
  const result = paletteGeometry(source);
  assert.equal(result.attributes.position.count, 6);
  for (let corner = 0; corner < 6; corner++)
    assert.equal(
      result.attributes.skinIndex.getX(result.index!.getX(corner)),
      corner < 3 ? 0 : 1,
    );
  source.dispose();
});

it("retains morph vertices even when their rest positions match", () => {
  const source = new THREE.BufferGeometry();
  source.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 1, 0], 3),
  );
  source.morphAttributes.position = [
    new THREE.Float32BufferAttribute([1, 0, 0, -1, 0, 0, 0, 1, 0], 3),
  ];
  assert.equal(paletteGeometry(source).attributes.position.count, 3);
});
