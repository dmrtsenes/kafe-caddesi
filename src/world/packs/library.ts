import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ItemId } from '../../data/items';
import {
  ALL_PACK_IDS,
  CHAIR_HEIGHT,
  ITEM_PACK,
  PRODUCT_XZ,
  packUrl,
  type PackId,
} from './catalog';
import { floorOffset, scaleToFitHeight, scaleToFitXZ, type Size } from './fit';

export interface PackAsset {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

const assets = new Map<PackId, PackAsset>();
let finished = false;
let inflight: Promise<void> | null = null;

export function hasPack(id: PackId): boolean {
  return assets.has(id);
}

export function getAsset(id: PackId): PackAsset | null {
  return assets.get(id) ?? null;
}

export function geomSize(geo: THREE.BufferGeometry): Size {
  if (!geo.boundingBox) geo.computeBoundingBox();
  const b = geo.boundingBox;
  if (!b) return { x: 1, y: 1, z: 1 };
  return { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z };
}

export async function loadPacks(opts: { cheap?: boolean } = {}): Promise<void> {
  if (finished) return;
  if (inflight) return inflight;
  inflight = fill(opts.cheap === true).finally(() => {
    finished = true;
  });
  return inflight;
}

async function fill(cheap: boolean): Promise<void> {
  const loader = new GLTFLoader();
  await Promise.all([
    ...ALL_PACK_IDS.map(async (id) => {
      try {
        const gltf = await loader.loadAsync(packUrl(id));
        const baked = bake(gltf.scene, cheap);
        if (baked) assets.set(id, baked);
      } catch (err) {
        console.warn('[Pack] atlandı:', id, err);
      }
    }),
  ]);
}

function cheapen(src: THREE.Material): THREE.Material {
  const std = src as THREE.MeshStandardMaterial;
  if (std.isMeshStandardMaterial) {
    const material = new THREE.MeshLambertMaterial({
      map: std.map,
      color: std.color.clone(),
      transparent: std.transparent,
      opacity: std.opacity,
      side: std.side,
      vertexColors: std.vertexColors,
    });
    material.name = src.name;
    return material;
  }
  return src.clone();
}

function bake(root: THREE.Object3D, cheap: boolean): PackAsset | null {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[] }>();
  const add = (
    src: THREE.BufferGeometry,
    srcMat: THREE.Material,
    matrix: THREE.Matrix4,
    groups?: { start: number; count: number; materialIndex?: number }[],
  ): void => {
    const geo = src.clone();
    if (groups && groups.length > 0 && geo.index) {
      const indices: number[] = [];
      const a = geo.index.array;
      for (const group of groups) {
        const end = Math.min(a.length, group.start + group.count);
        for (let i = group.start; i < end; i++) indices.push(Number(a[i]));
      }
      geo.setIndex(indices);
      geo.clearGroups();
    }
    geo.applyMatrix4(matrix);
    const key = srcMat.uuid;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material: cheap ? cheapen(srcMat) : srcMat.clone(), geos: [] };
      buckets.set(key, bucket);
    }
    bucket.geos.push(geo);
  };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (Array.isArray(m.material)) {
      if (m.geometry.groups.length === 0) {
        const first = m.material[0];
        if (first) add(m.geometry, first, m.matrixWorld);
        return;
      }
      for (let i = 0; i < m.material.length; i++) {
        const srcMat = m.material[i];
        const groups = m.geometry.groups.filter((g) => g.materialIndex === i);
        if (srcMat && groups.length > 0) add(m.geometry, srcMat, m.matrixWorld, groups);
      }
    } else if (m.material) {
      add(m.geometry, m.material, m.matrixWorld);
    }
  });
  if (buckets.size === 0) return null;

  const bucketGeos: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  for (const bucket of buckets.values()) {
    const mergedBucket = bucket.geos.length === 1 ? bucket.geos[0] : mergeGeometries(bucket.geos, false);
    if (!mergedBucket) continue;
    bucketGeos.push(mergedBucket);
    materials.push(bucket.material);
    for (const geo of bucket.geos) if (geo !== mergedBucket) geo.dispose();
  }
  if (bucketGeos.length === 0) return null;

  let merged: THREE.BufferGeometry | null = bucketGeos.length === 1
    ? bucketGeos[0]
    : mergeGeometries(bucketGeos, true);
  let material: THREE.Material | THREE.Material[] = materials.length === 1 ? materials[0] : materials;
  if (!merged) {
    let best = 0;
    for (let i = 1; i < bucketGeos.length; i++) {
      if (bucketGeos[i].getAttribute('position').count > bucketGeos[best].getAttribute('position').count) best = i;
    }
    merged = bucketGeos[best];
    material = materials[best];
  }
  for (const geo of bucketGeos) {
    if (geo !== merged) geo.dispose();
  }
  merged.computeBoundingBox();
  const bb = merged.boundingBox;
  if (!bb) return { geometry: merged, material };
  const min = { x: bb.min.x, y: bb.min.y, z: bb.min.z };
  const max = { x: bb.max.x, y: bb.max.y, z: bb.max.z };
  const off = floorOffset(min, max, 1);
  merged.translate(off.x, off.y, off.z);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return { geometry: merged, material };
}

export function createPackMesh(id: PackId, targetXZ?: number, targetH?: number): THREE.Mesh | null {
  const a = assets.get(id);
  if (!a) return null;
  const mesh = new THREE.Mesh(a.geometry, a.material);
  const size = geomSize(a.geometry);
  const s = targetH
    ? scaleToFitHeight(size, targetH)
    : targetXZ
      ? scaleToFitXZ(size, targetXZ)
      : 1;
  mesh.scale.setScalar(s);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

export function createPackProduct(item: ItemId): THREE.Group | null {
  const id = ITEM_PACK[item];
  if (!id) return null;
  const mesh = createPackMesh(id, PRODUCT_XZ);
  if (!mesh) return null;
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.itemId = item;
  return g;
}

export function chairScale(id: PackId = 'chair'): number {
  const a = assets.get(id);
  if (!a) return 1;
  return scaleToFitHeight(geomSize(a.geometry), CHAIR_HEIGHT);
}
