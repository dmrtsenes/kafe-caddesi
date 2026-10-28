import * as T from "three";
import type { PackId } from "./catalog";
import { createPackMesh, geomSize, getAsset } from "./library";
import { CAFE } from "../CafeMaterials";

const finishes = new Map<string, T.Material | T.Material[]>();
const surfaces = new WeakMap<T.BufferGeometry, T.BufferGeometry>();

/** Clone shared vendor materials; theming one cafe never tints its food or other assets. */
export function cafePackMaterial(
  id: PackId,
  upholstery = CAFE.green,
): T.Material | T.Material[] {
  const key = id + ":" + upholstery;
  const cached = finishes.get(key);
  if (cached) return cached;
  const asset = getAsset(id);
  if (!asset) throw new Error("Missing cafe pack " + id);
  function tint(src: T.Material): T.Material {
    const m = src.clone() as T.MeshStandardMaterial;
    const name = src.name.toLowerCase();
    const color = name.includes("carpet")
      ? upholstery
      : name.includes("plant")
        ? 0x5e8250
        : name.includes("metal")
          ? CAFE.ink
          : name.includes("wooddark")
            ? 0x4b382b
            : CAFE.walnut;
    if (m.color) m.color.setHex(color);
    if ("roughness" in m) {
      m.roughness = name.includes("carpet") ? 0.9 : 0.62;
      m.metalness = name.includes("metal") ? 0.22 : 0;
    }
    m.name = "cafe:" + src.name;
    return m;
  }
  const themed = Array.isArray(asset.material)
    ? asset.material.map(tint)
    : tint(asset.material);
  finishes.set(key, themed);
  return themed;
}

/** Preserve the pack's exact geometry while giving the top its own live cosmetic material. */
export function cafeTableGeometry(source: T.BufferGeometry): T.BufferGeometry {
  const cached = surfaces.get(source);
  if (cached) return cached;
  const geometry = source.clone();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!,
    cutoff = box.max.y - (box.max.y - box.min.y) * 0.12;
  const p = geometry.getAttribute("position"),
    index = geometry.index,
    count = index ? index.count : p.count;
  const body: number[] = [],
    top: number[] = [];
  for (let i = 0; i < count; i += 3) {
    const a = index ? index.getX(i) : i,
      b = index ? index.getX(i + 1) : i + 1,
      c = index ? index.getX(i + 2) : i + 2;
    const target =
      Math.min(p.getY(a), p.getY(b), p.getY(c)) >= cutoff ? top : body;
    target.push(a, b, c);
  }
  geometry.setIndex([...body, ...top]);
  geometry.clearGroups();
  geometry.addGroup(0, body.length, 0);
  geometry.addGroup(body.length, top.length, 1);
  geometry.userData.cafeSurfaceGroups = true;
  surfaces.set(source, geometry);
  return geometry;
}

export function createCafeDecor(
  kind: "plant" | "bench" | "sofa",
): T.Mesh | null {
  const id: PackId =
    kind === "plant"
      ? "floor-plant"
      : kind === "bench"
        ? "cafe-bench"
        : "cafe-sofa";
  const mesh = createPackMesh(id);
  if (!mesh) return null;
  const size = geomSize(mesh.geometry);
  // These are the existing decor/navigation footprints, not new furniture obstacles.
  const fit =
    kind === "plant"
      ? { x: 0.6, y: 1.28, z: 0.6 }
      : kind === "bench"
        ? { x: 1.5, y: 0.88, z: 0.6 }
        : { x: 2.0, y: 1.15, z: 0.85 };
  mesh.scale.set(fit.x / size.x, fit.y / size.y, fit.z / size.z);
  mesh.material = cafePackMaterial(
    id,
    kind === "bench" ? CAFE.terra : CAFE.green,
  );
  mesh.name = "cafePack:" + id;
  mesh.userData.packId = id;
  return mesh;
}
