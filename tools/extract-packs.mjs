/**
 * Kenney GLB'lerini zip'ten public/packs/kenney altına kopyalar.
 * Kaynak: src/world/packs/manifest.json
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(join(root, "src/world/packs/manifest.json"), "utf8"),
);
const staging = join(root, ".pack-extract");
const out = join(root, "public/packs/kenney");

mkdirSync(out, { recursive: true });
mkdirSync(staging, { recursive: true });

function extractGroup(group) {
  const zip = join(root, group.zip);
  if (!existsSync(zip)) {
    throw new Error(`zip yok: ${zip}`);
  }
  const files = Object.values(group.files);
  execFileSync(
    "tar",
    ["-xf", zip, "-C", staging, ...files.map((f) => group.zipPrefix + f)],
    {
      stdio: "inherit",
    },
  );
  for (const file of files) {
    const src = join(
      staging,
      ...group.zipPrefix.split("/").filter(Boolean),
      file,
    );
    if (!existsSync(src)) throw new Error(`çıkmadı: ${file} (${src})`);
    copyFileSync(src, join(out, file));
  }
}

extractGroup(manifest.kenneyFurniture);
extractGroup(manifest.kenneyFood);
// Food GLBs reference this shared external palette, unlike the embedded furniture maps.
const texturePath = manifest.kenneyFood.zipPrefix + "Textures/colormap.png";
execFileSync("tar", [
  "-xf",
  join(root, manifest.kenneyFood.zip),
  "-C",
  staging,
  texturePath,
]);
mkdirSync(join(out, "Textures"), { recursive: true });
copyFileSync(join(staging, texturePath), join(out, "Textures/colormap.png"));

for (const name of ["kenney_furniture-kit.zip", "kenney_food-kit.zip"]) {
  execFileSync("tar", [
    "-xf",
    join(root, "_paketler", name),
    "-C",
    staging,
    "License.txt",
  ]);
  copyFileSync(
    join(staging, "License.txt"),
    join(
      root,
      "public/packs",
      name.includes("food")
        ? "KENNEY-FOOD-LICENSE.txt"
        : "KENNEY-FURNITURE-LICENSE.txt",
    ),
  );
}

rmSync(staging, { recursive: true, force: true });
console.log("pack extract ok →", out);
