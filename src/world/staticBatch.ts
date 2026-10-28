import * as THREE from "three";
import { StaticTransformRoot } from './StaticTransformRoot';
import {
  mergeGeometries,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  canBakeMaterial,
  batchMaterial,
  bakeMaterialAttributes,
} from "./BatchMaterial";

export const DEFAULT_CELL_SIZE = 16;
export const MIN_CELL_SIZE = 16;

export interface StaticBatchOptions {
  /** Keep distant architecture in separately culled cells. Zero is one local object. Minimum cell size is 16m to prevent over-fragmentation into excessive draw calls. */
  cellSize?: number;
  /** Detach anonymous source meshes while active; restore their owners on disposal. */
  compact?: boolean;
  /** Explicitly opt in only for instance groups whose count and transforms never change. */
  bakeInstances?: boolean;
}

export interface StaticBatch {
  readonly root: THREE.Group;
  readonly sourceMeshes: readonly THREE.Mesh[];
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly callsBefore: number;
  readonly callsAfter: number;
  readonly active: boolean;
  setActive(active: boolean): void;
  rebuild(): void;
  dispose(): void;
}

interface BatchCandidate {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
}

interface Bucket {
  material: THREE.Material;
  castShadow: boolean;
  receiveShadow: boolean;
  renderOrder: number;
  candidates: BatchCandidate[];
}

function hasChangingVisibility(
  object: THREE.Object3D,
  source: THREE.Object3D,
): boolean {
  let current: THREE.Object3D | null = object;
  while (current && current !== source) {
    if (!current.visible) return true;
    current = current.parent;
  }
  return false;
}

function hasDynamicAncestor(
  object: THREE.Object3D,
  source: THREE.Object3D,
): boolean {
  let current: THREE.Object3D | null = object;
  while (current && current !== source) {
    if (
      current.userData.dynamic === true ||
      current.userData.batchExclude === true
    )
      return true;
    current = current.parent;
  }
  return false;
}

function eligible(
  mesh: THREE.Mesh,
  source: THREE.Object3D,
  bakeInstances: boolean,
): boolean {
  if (
    mesh.userData.batchExclude === true ||
    !mesh.geometry ||
    Array.isArray(mesh.material) ||
    mesh.children.length > 0 ||
    mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender ||
    mesh.onAfterRender !== THREE.Object3D.prototype.onAfterRender
  )
    return false;
  if (mesh instanceof THREE.SkinnedMesh) return false;
  if (
    mesh instanceof THREE.InstancedMesh &&
    (!bakeInstances || mesh.count <= 0 || mesh.morphTexture)
  )
    return false;
  if (mesh.morphTargetInfluences !== undefined) return false;
  if (hasChangingVisibility(mesh, source) || hasDynamicAncestor(mesh, source))
    return false;
  if (
    mesh.geometry.drawRange.start !== 0 ||
    Number.isFinite(mesh.geometry.drawRange.count)
  )
    return false;
  const material = mesh.material as THREE.Material;
  if (material.transparent || material.alphaTest > 0) return false;
  // Geometry groups only select materials when mesh.material is an array.
  // A single-material box is one draw and can be safely merged.
  return true;
}

export function createStaticBatch(
  source: THREE.Object3D,
  options: StaticBatchOptions = {},
): StaticBatch {
  const root = new StaticTransformRoot();
  root.name = `${source.name || "static"}_batch`;
  root.userData.batchExclude = true;
  root.matrixAutoUpdate = false;

  const sourceMeshes: THREE.Mesh[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  let callsAfter = 0;
  let candidateCount = 0;
  let active = false;
  const detached = new Map<THREE.Mesh, THREE.Object3D>();
  const center = new THREE.Vector3();

  const clear = (): void => {
    root.clear();
    for (const geometry of geometries) geometry.dispose();
    geometries.length = 0;
    callsAfter = 0;
    candidateCount = 0;
  };

  function setActive(on: boolean): void {
    active = on;
    for (const mesh of sourceMeshes) {
      mesh.visible = !on;
      if (on && options.compact && !mesh.name && mesh.parent) {
        detached.set(mesh, mesh.parent);
        mesh.removeFromParent();
      } else if (!on && detached.has(mesh)) {
        detached.get(mesh)!.add(mesh);
        detached.delete(mesh);
      }
    }
    root.visible = on;
  }

  const rebuild = (): void => {
    const wasActive = active;
    setActive(false);
    clear();
    sourceMeshes.length = 0;
    source.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(source.matrixWorld).invert();
    const buckets = new Map<string, Bucket>();

    source.traverse((object) => {
      if (object === root) return;
      const mesh = object as THREE.Mesh;
      if (
        !mesh.isMesh ||
        !eligible(mesh, source, options.bakeInstances === true)
      )
        return;
      const original = mesh.material as THREE.Material;
      const matrix = new THREE.Matrix4().multiplyMatrices(
        inverse,
        mesh.matrixWorld,
      );
      const instanced = mesh instanceof THREE.InstancedMesh ? mesh : null;
      const fold =
        canBakeMaterial(original) &&
        mesh.geometry.getAttribute("normal") &&
        (mesh.geometry.getAttribute("color")?.itemSize ?? 3) === 3;
      if (instanced?.instanceColor && !fold) return;
      const material = fold
        ? batchMaterial(original as THREE.MeshStandardMaterial)
        : original;
      const count = instanced
        ? Math.min(instanced.count, instanced.instanceMatrix.count)
        : 1;
      const transform = new THREE.Matrix4();
      const instanceColor = new THREE.Color();
      for (let index = 0; index < count; index++) {
        if (instanced) {
          instanced.getMatrixAt(index, transform);
          transform.premultiply(matrix);
        } else transform.copy(matrix);
        const candidate = mesh.geometry.clone().applyMatrix4(transform);
        if (fold)
          bakeMaterialAttributes(
            candidate,
            original as THREE.MeshStandardMaterial,
          );
        if (instanced?.instanceColor) {
          instanced.getColorAt(index, instanceColor);
          const color = candidate.getAttribute("color");
          for (let vertex = 0; vertex < color.count; vertex++)
            color.setXYZ(
              vertex,
              color.getX(vertex) * instanceColor.r,
              color.getY(vertex) * instanceColor.g,
              color.getZ(vertex) * instanceColor.b,
            );
        }
        // Imported and rounded geometry may be non-indexed. A common index layout
        // lets them share one draw; exact duplicate vertices are welded after merging.
        if (!candidate.index)
          candidate.setIndex(
            Array.from(
              { length: candidate.attributes.position.count },
              (_, i) => i,
            ),
          );
        // Three reverses the front face for mirrored objects. The merged mesh
        // has an identity transform, so retain that winding explicitly.
        if (transform.determinant() < 0) {
          const index = candidate.index!;
          for (let triangle=0; triangle<index.count; triangle+=3) {
            const first=index.getX(triangle);
            index.setX(triangle,index.getX(triangle+2));
            index.setX(triangle+2,first);
          }
        }
        let cell = "";
        const rawCellSize = options.cellSize ?? 0;
        if (rawCellSize > 0) {
          const cellSize = Math.max(MIN_CELL_SIZE, rawCellSize);
          candidate.computeBoundingBox();
          candidate.boundingBox!.getCenter(center);
          cell = `${Math.floor((center.x + cellSize * 0.5) / cellSize)}/${Math.floor((center.z + cellSize * 0.5) / cellSize)}`;
        }
        const attributes = Object.entries(candidate.attributes)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(
            ([name, attribute]) =>
              `${name}:${attribute.itemSize}:${attribute.normalized ? 1 : 0}`,
          )
          .join(",");
        const key = [
          material.uuid,
          mesh.castShadow ? 1 : 0,
          mesh.receiveShadow ? 1 : 0,
          mesh.renderOrder,
          cell,
          attributes,
        ].join("|");
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = {
            material,
            castShadow: mesh.castShadow,
            receiveShadow: mesh.receiveShadow,
            renderOrder: mesh.renderOrder,
            candidates: [],
          };
          buckets.set(key, bucket);
        }
        bucket.candidates.push({ mesh, geometry: candidate });
      }
      candidateCount++;
    });

    const mergedSources = new Set<THREE.Mesh>();
    for (const bucket of buckets.values()) {
      const parts = bucket.candidates.map((candidate) => candidate.geometry);
      const merged =
        parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
      if (!merged) {
        for (const geometry of parts) geometry.dispose();
        continue;
      }
      for (const candidate of bucket.candidates)
        mergedSources.add(candidate.mesh);
      for (const geometry of parts) {
        if (geometry !== merged) geometry.dispose();
      }
      geometries.push(merged);
      const mesh = new THREE.Mesh(merged, bucket.material);
      mesh.castShadow = bucket.castShadow;
      mesh.receiveShadow = bucket.receiveShadow;
      mesh.renderOrder = bucket.renderOrder;
      mesh.frustumCulled = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      root.add(mesh);
      callsAfter++;
    }
    sourceMeshes.push(...mergedSources);

    source.add(root);
    setActive(wasActive);
  };

  rebuild();

  return {
    root,
    sourceMeshes,
    geometries,
    get callsBefore() {
      return candidateCount;
    },
    get callsAfter() {
      return callsAfter;
    },
    get active() {
      return active;
    },
    setActive,
    rebuild,
    dispose(): void {
      setActive(false);
      root.removeFromParent();
      clear();
      sourceMeshes.length = 0;
    },
  };
}
