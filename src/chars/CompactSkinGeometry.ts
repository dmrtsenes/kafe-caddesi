import * as THREE from 'three';

/** Exact tuple indexing: never weld nearby positions, UV seams or different bone weights. */
export function compactSkinGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  if (Object.keys(source.morphAttributes).length) return source;
  const names = Object.keys(source.attributes).sort();
  const attributes = names.map(name => source.attributes[name]);
  const count = source.attributes.position?.count;
  if (!count || attributes.some(a => !(a instanceof THREE.BufferAttribute) || a instanceof THREE.Float16BufferAttribute || a.count !== count)) return source;
  const plain = attributes as THREE.BufferAttribute[];
  const vertices: number[] = [], indices: number[] = [], unique = new Map<string, number>();
  const corners = source.index?.count ?? count;
  for (let corner = 0; corner < corners; corner++) {
    const vertex = source.index ? source.index.getX(corner) : corner;
    let key = '';
    for (const attribute of plain) {
      for (let component = 0; component < attribute.itemSize; component++) {
        const value = attribute.array[vertex * attribute.itemSize + component];
        if (!Number.isFinite(value)) return source;
        key += (Object.is(value, -0) ? '-0' : String(value)) + ',';
      }
    }
    let mapped = unique.get(key);
    if (mapped === undefined) {
      mapped = vertices.length;
      unique.set(key, mapped);
      vertices.push(vertex);
    }
    indices.push(mapped);
  }
  const result = source.clone();
  let compactBytes = vertices.length <= 65535 ? corners * 2 : corners * 4;
  let originalBytes = source.index?.array.byteLength ?? 0;
  for (let i = 0; i < names.length; i++) {
    const sourceAttribute = plain[i];
    originalBytes += sourceAttribute.array.byteLength;
    let byteIntegers = !sourceAttribute.normalized && ['skinIndex', 'fincanCloth'].includes(names[i]);
    if (byteIntegers) {
      for (const vertex of vertices) {
        for (let component = 0; component < sourceAttribute.itemSize; component++) {
          const value = sourceAttribute.array[vertex * sourceAttribute.itemSize + component];
          if (!Number.isInteger(value) || Object.is(value, -0) || value < 0 || value > 255) byteIntegers = false;
        }
      }
    }
    const ArrayType = byteIntegers ? Uint8Array : sourceAttribute.array.constructor as typeof Float32Array;
    const values = new ArrayType(vertices.length * sourceAttribute.itemSize);
    for (let n = 0; n < vertices.length; n++) {
      for (let k = 0; k < sourceAttribute.itemSize; k++)
        values[n * sourceAttribute.itemSize + k] = sourceAttribute.array[vertices[n] * sourceAttribute.itemSize + k];
    }
    const attribute = new THREE.BufferAttribute(values, sourceAttribute.itemSize, sourceAttribute.normalized);
    attribute.name = sourceAttribute.name;
    attribute.setUsage(sourceAttribute.usage);
    attribute.gpuType = sourceAttribute.gpuType;
    result.setAttribute(names[i], attribute);
    compactBytes += values.byteLength;
  }
  result.setIndex(new THREE.BufferAttribute(vertices.length <= 65535 ? new Uint16Array(indices) : new Uint32Array(indices), 1));
  if (compactBytes >= originalBytes) { result.dispose(); return source; }
  return result;
}

/** The newly merged template owns its geometry; actors subsequently borrow the compact body. */
export function compactMergedSkin(mesh: THREE.SkinnedMesh | null): void {
  if (!mesh) return;
  const original = mesh.geometry;
  mesh.geometry = compactSkinGeometry(original);
  if (mesh.geometry !== original) original.dispose();
  if (mesh.parent?.userData.skinBatch)
    mesh.parent.userData.skinBatch.vertices = mesh.geometry.attributes.position.count;
}
