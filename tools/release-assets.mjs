import { readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
const CAST_FILES = ['PlayerS01.fbx', 'CustomerMan.glb', 'CustomerWoman.glb', 'ColorPalette01.png'];

/** Detect omitted or changed character files before building an install. */
export function assertCurrentCastAssets(directory) {
  const folder = resolve(directory, 'packs/current-cast');
  const manifest = JSON.parse(readFileSync(join(folder, 'manifest.json'), 'utf8'));
  if (manifest.id !== 'fincan-current' ||
      JSON.stringify(Object.keys(manifest.files ?? {}).sort()) !== JSON.stringify([...CAST_FILES].sort()))
    throw new Error('Invalid current character manifest: ' + folder);
  for (const name of CAST_FILES) {
    const file = join(folder, name);
    const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
    if (hash !== manifest.files[name]) throw new Error('Character asset mismatch: ' + file);
  }
}

/** GLB textures and buffers must be bundled alongside the installed game. */
function assertModelDependencies(file, root, files) {
  const bytes = readFileSync(file);
  if (
    bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 ||
    bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(16) !== 0x4e4f534a ||
    bytes.readUInt32LE(12) > bytes.length - 20
  ) throw new Error('Invalid release GLB: ' + file);
  let model;
  try {
    model = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  } catch {
    throw new Error('Invalid release GLB JSON: ' + file);
  }
  for (const asset of [...(model.images ?? []), ...(model.buffers ?? [])]) {
    const uri = asset.uri;
    if (typeof uri !== 'string' || !uri || /^data:/i.test(uri)) continue;
    // No CDN or absolute filesystem dependencies in an offline install.
    if (/^[a-z][a-z0-9+.-]*:|^[\\/]/i.test(uri)) {
      throw new Error('Non-local model dependency in ' + file + ': ' + uri);
    }
    let path;
    try {
      path = decodeURIComponent(uri.split(/[?#]/, 1)[0]);
    } catch {
      throw new Error('Invalid model dependency URI in ' + file + ': ' + uri);
    }
    const dependency = resolve(dirname(file), path);
    const inside = relative(root, dependency);
    if (isAbsolute(inside) || inside === '..' || inside.startsWith('..' + sep)) {
      throw new Error('Model dependency outside release: ' + dependency + ' (from ' + file + ')');
    }
    // Exact filenames also catch Windows-only case matches that fail on Android.
    if (!files.has(dependency)) {
      throw new Error('Missing model dependency: ' + dependency + ' (from ' + file + ')');
    }
  }
}

export function assertReleaseAssets(directory) {
  const root = resolve(directory);
  const files = new Set();
  function scan(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const file = join(folder, entry.name);
      if (/TEST-ONLY|__test-assets/i.test(entry.name) ||
          (CAST_FILES.includes(entry.name) && dirname(file) !== join(root, 'packs', 'current-cast')))
        throw new Error('Character asset outside the shared pack: ' + file);
      if (entry.isSymbolicLink()) throw new Error('Unverified asset symlink: ' + file);
      if (entry.isDirectory()) scan(file);
      else {
        files.add(file);
        if (
          /\.(js|html|json)$/i.test(entry.name) &&
          /__test-assets\//.test(readFileSync(file, 'utf8'))
        ) throw new Error('Local comparison reference in release: ' + file);
      }
    }
  }
  scan(root);
  for (const file of files) {
    if (/\.glb$/i.test(file)) assertModelDependencies(file, root, files);
  }
}
