import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assertReleaseAssets, assertCurrentCastAssets } from './release-assets.mjs';
import { createHash } from 'node:crypto';
it('rejects forbidden assets and bundled comparison references', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fincan-release-test-'));
  try {
    writeFileSync(join(dir, 'safe.js'), 'const a=1;');
    assert.doesNotThrow(() => assertReleaseAssets(dir));
    writeFileSync(join(dir, 'PlayerS01.fbx'), 'test');
    assert.throws(() => assertReleaseAssets(dir));
    rmSync(join(dir, 'PlayerS01.fbx'));
    writeFileSync(join(dir, 'safe.js'), 'const a="__test-assets/cleanit";');
    assert.throws(() => assertReleaseAssets(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'fincan-model-deps-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function glb(path, model) {
  const json = JSON.stringify({ asset: { version: '2.0' }, ...model });
  const length = Math.ceil(Buffer.byteLength(json) / 4) * 4;
  const bytes = Buffer.alloc(20 + length, 0x20);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(length, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  bytes.write(json, 20);
  writeFileSync(path, bytes);
}

it('accepts complete local image and buffer dependencies with encoded filenames', (t) => {
  const dir = fixture(t);
  mkdirSync(join(dir, 'models'));
  mkdirSync(join(dir, 'Textures'));
  writeFileSync(join(dir, 'Textures', 'cafe palette.png'), 'texture');
  writeFileSync(join(dir, 'models', 'mesh.bin'), 'buffer');
  glb(join(dir, 'models', 'cup.glb'), {
    images: [{ uri: '../Textures/cafe%20palette.png?v=1' }],
    buffers: [{ uri: 'mesh.bin', byteLength: 6 }],
  });
  assert.doesNotThrow(() => assertReleaseAssets(dir));
});

for (const [kind, uri] of [['images', 'Textures/colormap.png'], ['buffers', 'mesh.bin']]) {
  it('rejects a missing GLB ' + kind + ' dependency with the concrete path', (t) => {
    const dir = fixture(t);
    const model = join(dir, 'cup.glb');
    glb(model, { [kind]: [{ uri }] });
    assert.throws(() => assertReleaseAssets(dir), (error) =>
      error.message.includes('Missing model dependency: ' + join(dir, uri)) &&
      error.message.includes('(from ' + model + ')'),
    );
  });
}

it('accepts embedded buffer views and data URIs without sidecar files', (t) => {
  const dir = fixture(t);
  glb(join(dir, 'embedded.glb'), {
    images: [{ bufferView: 0, mimeType: 'image/png' }, { uri: 'data:image/png;base64,AA==' }],
    buffers: [{ byteLength: 0 }, { uri: 'data:application/octet-stream;base64,AA==', byteLength: 1 }],
  });
  assert.doesNotThrow(() => assertReleaseAssets(dir));
});

it('rejects remote model assets and paths that leave the release directory', (t) => {
  const dir = fixture(t);
  const file = join(dir, 'cup.glb');
  for (const uri of ['https://assets.example/palette.png', '//assets.example/palette.png', '../outside.png']) {
    glb(file, { images: [{ uri }] });
    assert.throws(() => assertReleaseAssets(dir), /Non-local model dependency|Model dependency outside release/);
  }
});

it('catches texture filename case mismatches before an Android install', (t) => {
  const dir = fixture(t);
  writeFileSync(join(dir, 'Colormap.png'), 'texture');
  glb(join(dir, 'cup.glb'), { images: [{ uri: 'colormap.png' }] });
  assert.throws(() => assertReleaseAssets(dir), /Missing model dependency/);
});

it('reports an unreadable model instead of silently skipping its dependencies', (t) => {
  const dir = fixture(t);
  const file = join(dir, 'broken.glb');
  writeFileSync(file, 'broken');
  assert.throws(() => assertReleaseAssets(dir), (error) => error.message === 'Invalid release GLB: ' + file);
});

it('fails a release if a shared character is missing or differs from its manifest', (t) => {
  const dir=fixture(t),pack=join(dir,'packs','current-cast');
  mkdirSync(pack,{recursive:true});
  const files={};
  for(const name of ['PlayerS01.fbx','CustomerMan.glb','CustomerWoman.glb','ColorPalette01.png']){
    writeFileSync(join(pack,name),name);
    files[name]=createHash('sha256').update(name).digest('hex');
  }
  writeFileSync(join(pack,'manifest.json'),JSON.stringify({id:'fincan-current',files}));
  assert.doesNotThrow(()=>assertCurrentCastAssets(dir));
  writeFileSync(join(pack,'PlayerS01.fbx'),'different model');
  assert.throws(()=>assertCurrentCastAssets(dir),/Character asset mismatch/);
  rmSync(join(pack,'PlayerS01.fbx'));
  assert.throws(()=>assertCurrentCastAssets(dir),/ENOENT/);
});
