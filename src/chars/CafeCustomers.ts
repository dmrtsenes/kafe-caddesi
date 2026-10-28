import { mergeCharacterSkin, disposeCharacterSkeletons } from "./SkinBatch";
import { AnchorMatrices } from './AnchorMatrices';
import { compactMergedSkin } from "./CompactSkinGeometry";
import { addCustomerCloth, addSignatureWardrobe, customerLook, FINCAN_STYLE_VERSION } from './SignatureWardrobe';
import { createWorkwearMaterial } from './Workwear';
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type {
  AnimState,
  CarryMode,
  CharacterHandle,
  CharacterOpts,
  CharRole,
  WorkKind,
} from "./types";

export const CAFE_CUSTOMER_MODELS = [
  "customerMan",
  "customerWoman",
] as const;
export type CafeCustomerModelId = (typeof CAFE_CUSTOMER_MODELS)[number];
export const CAFE_CUSTOMER_FILES: Readonly<
  Record<CafeCustomerModelId, string>
> = {
  customerMan: "CustomerMan.glb",
  customerWoman: "CustomerWoman.glb",
};
export const CAFE_CUSTOMER_REQUIRED_CLIPS = [
  "CustomerAngry",
  "Eating",
  "Happy Idle",
  "WalkingMan",
  "WalkingWoman",
  "Quick Formal Bow",
  "Waving 2hands",
  "SittingOnTableMan",
] as const;

type CustomerClipKey =
  | "idle"
  | "walkMan"
  | "walkWoman"
  | "angry"
  | "eat"
  | "bow"
  | "cheer"
  | "sit";

interface CustomerTemplate {
  id: CafeCustomerModelId;
  scene: THREE.Group;
  clips: ReadonlyMap<CustomerClipKey, THREE.AnimationClip>;
  walkClip: "walkMan" | "walkWoman";
  material: THREE.MeshToonMaterial;
  wardrobes: Map<number, THREE.Object3D>;
  outfits: Map<number, THREE.MeshToonMaterial>;
}

const CUSTOMER_VISIBLE_MESHES: Readonly<
  Record<CafeCustomerModelId, readonly string[]>
> = {
  customerMan: ["Customers", "A_Pants01", "A_Shirt01", "HatCustomer01"],
  customerWoman: ["Customers", "A_Pants01", "A_Shirt02", "HairCustomer01"],
};

// FBX2glTF santimetre tabanlı Unity modelini metreye çevirir.
const CUSTOMER_HEIGHT = 0.0218;
/**
 * "SittingOnTable" klibi arkalıksız masa kenarı oturuşudur: gövde öne kambur,
 * sırt sandalye arkalığından uzak kalır. Omurga zinciri geriye dikleştirilir,
 * boyun bakışı masaya geri çevirir.
 */
const SIT_RECLINE: readonly (readonly [string, number])[] = [
  ["mixamorigSpine", -0.1],
  ["mixamorigSpine1", -0.09],
  ["mixamorigSpine2", -0.07],
  ["mixamorigNeck", 0.14],
];
const templates = new Map<CafeCustomerModelId, CustomerTemplate>();
let loading: Promise<void> | null = null;

function packUrl(path: string): string {
  const base = import.meta.env?.BASE_URL || "/";
  return `${base.endsWith("/") ? base : `${base}/`}packs/current-cast/${path}`;
}

export function selectCafeCustomerModel(
  opts: CharacterOpts = {},
): CafeCustomerModelId {
  const seed = (opts.seed ?? opts.variant ?? 0) >>> 0;
  return (seed & 1) === 0 ? "customerMan" : "customerWoman";
}

export function normalizeCafeCustomerClipName(
  name: string,
): CustomerClipKey | null {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key === "happyidle") return "idle";
  if (key === "walkingman") return "walkMan";
  if (key === "walkingwoman") return "walkWoman";
  if (key === "customerangry") return "angry";
  if (key === "eating") return "eat";
  if (key === "quickformalbow") return "bow";
  if (key === "waving2hands") return "cheer";
  if (key === "sittingontableman") return "sit";
  return null;
}

function configurePalette(texture: THREE.Texture): void {
  texture.name = "Cafe_CustomerPalette";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // glTF UV başlangıcı FBX'ten farklıdır; TextureLoader'ın varsayılan Y
  // çevirmesi paletin ten/kıyafet satırlarını yanlış örnekletir.
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
}

/**
 * GLB klibindeki kök sürüklenmesini kaldırır; dünya hareketini oyun sistemi yönetir.
 */
function makeRetargetedInPlace(
  source: THREE.AnimationClip,
): THREE.AnimationClip {
  const tracks = source.tracks.map((sourceTrack) => {
    const track = sourceTrack.clone();
    if (
      track instanceof THREE.VectorKeyframeTrack &&
      /mixamorigHips\.position$/i.test(track.name)
    ) {
      const x = track.values[0] ?? 0;
      const z = track.values[2] ?? 0;
      for (let index = 0; index < track.values.length; index += 3) {
        track.values[index] = x;
        track.values[index + 2] = z;
      }
    }
    return track;
  });
  return new THREE.AnimationClip(
    source.name,
    source.duration,
    tracks,
    source.blendMode,
  );
}

function prepareCustomerModel(
  id: CafeCustomerModelId,
  scene: THREE.Group,
  palette: THREE.Texture,
): THREE.MeshToonMaterial {
  const visible = new Set(CUSTOMER_VISIBLE_MESHES[id]);
  const found = new Set<string>();
  const remove: THREE.Object3D[] = [];
  const material = new THREE.MeshToonMaterial({
    name: `Cafe_${id}_MainMat01`,
    color: 0xffffff,
    map: palette,
    side: THREE.DoubleSide,
  });

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const assetName = mesh.name.replace(/_\d+$/, "");
    if (!visible.has(assetName)) {
      remove.push(mesh);
      return;
    }
    found.add(assetName);
    mesh.material = material;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  });
  for (const mesh of remove) mesh.removeFromParent();
  for (const name of visible) {
    if (!found.has(name))
      throw new Error(`Müşteri ${id}: görünüm parçası eksik: ${name}`);
  }

  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    mesh.normalizeSkinWeights();
    mesh.skeleton.update();
  });
  scene.traverse(object => { if ((object as THREE.Mesh).isMesh) addCustomerCloth(object as THREE.Mesh, CUSTOMER_HEIGHT); });
  return material;
}

function prepareClips(
  animations: readonly THREE.AnimationClip[],
): ReadonlyMap<CustomerClipKey, THREE.AnimationClip> {
  const clips = new Map<CustomerClipKey, THREE.AnimationClip>();
  for (const source of animations) {
    const key = normalizeCafeCustomerClipName(source.name);
    if (key && !clips.has(key)) clips.set(key, makeRetargetedInPlace(source));
  }
  for (const name of CAFE_CUSTOMER_REQUIRED_CLIPS) {
    const key = normalizeCafeCustomerClipName(name);
    if (!key || !clips.has(key))
      throw new Error(`Müşteri klibi eksik: ${name}`);
  }
  return clips;
}

export async function loadCafeCustomerPack(): Promise<void> {
  if (templates.size === CAFE_CUSTOMER_MODELS.length) return;
  if (loading) return loading;
  loading = (async () => {
    const palette = await new THREE.TextureLoader().loadAsync(
      packUrl("ColorPalette01.png"),
    );
    configurePalette(palette);
    const loader = new GLTFLoader();
    // Imported materials are replaced by this palette; never fetch their unused external textures.
    loader.register(() => ({
      name: "FincanSelectedPalette",
      loadTexture: () => Promise.resolve(palette),
    }));
    const models = await Promise.all(
      CAFE_CUSTOMER_MODELS.map((id) =>
        loader.loadAsync(packUrl(CAFE_CUSTOMER_FILES[id])),
      ),
    );
    CAFE_CUSTOMER_MODELS.forEach((id, index) => {
      const scene = models[index].scene;
      const material = prepareCustomerModel(id, scene, palette);
      templates.set(id, {
        id,
        scene,
        clips: prepareClips(models[index].animations),
        walkClip: id === "customerWoman" ? "walkWoman" : "walkMan",
        material, wardrobes: new Map(), outfits: new Map(),
      });
    });
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

class CafeCustomer implements CharacterHandle {
  readonly root = new THREE.Group();
  readonly carryAnchor = new THREE.Object3D();
  readonly handAnchor = new THREE.Object3D();
  readonly headTop = new THREE.Object3D();
  readonly height: number;

  private readonly model: THREE.Object3D;
  private readonly visualRoot = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly clips: ReadonlyMap<CustomerClipKey, THREE.AnimationClip>;
  private readonly walkClip: "walkMan" | "walkWoman";
  private readonly leftHand: THREE.Object3D;
  private readonly rightHand: THREE.Object3D;
  private readonly head: THREE.Object3D;
  private readonly recline: { bone: THREE.Object3D; angle: number }[] = [];
  private sitW = 0;
  private readonly anchorMatrices: AnchorMatrices;
  private readonly handMidCache = new THREE.Vector3();
  private readonly handSpanCache = new THREE.Vector3();
  private readonly rootInverse = new THREE.Matrix4();
  private readonly leftWorld = new THREE.Vector3();
  private readonly rightWorld = new THREE.Vector3();
  private readonly headWorld = new THREE.Vector3();
  private action: THREE.AnimationAction | null = null;
  private currentClip = "";
  private state: AnimState = "idle";
  private workPhase = -1;
  private workKind: WorkKind = 'generic';
  private carryCount = 0;
  private carryMode: CarryMode = "none";
  private forwardLean = 0;
  private turnLean = 0;
  private disposed = false;

  constructor(template: CustomerTemplate, role: CharRole, opts: CharacterOpts) {
    const look = customerLook(opts.seed ?? opts.variant ?? 0);
    const wardrobeKey = look.id + (role === 'dasher' ? 8 : 0);
    let wardrobe = template.wardrobes.get(wardrobeKey);
    if (!wardrobe) {
      wardrobe = cloneSkeleton(template.scene);
      addSignatureWardrobe(wardrobe, role, CUSTOMER_HEIGHT, template.material, look.id);
      const generated: THREE.BufferGeometry[] = [];
      wardrobe.traverse(o => { if (o.userData.signatureGarment) generated.push((o as THREE.Mesh).geometry); });
      if (!(import.meta.env.DEV && new URLSearchParams(location.search).has('rawRig'))) {
        compactMergedSkin(mergeCharacterSkin(wardrobe));
        for (const geometry of generated) geometry.dispose();
      }
      template.wardrobes.set(wardrobeKey, wardrobe);
    }
    this.model = cloneSkeleton(wardrobe);
    let outfit = template.outfits.get(look.id);
    if (!outfit) { outfit = createWorkwearMaterial(template.material, look.palette, look.pattern); template.outfits.set(look.id, outfit); }
    this.model.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = outfit!; });
    this.clips = template.clips;
    this.walkClip = template.walkClip;
    this.mixer = new THREE.AnimationMixer(this.model);
    this.height = (role === "dasher" ? 1.55 : 1.51) * (opts.scale ?? 1);
    this.visualRoot.scale.setScalar(this.height / CUSTOMER_HEIGHT);
    this.visualRoot.position.y = 0.046;
    this.visualRoot.add(this.model);
    this.root.add(
      this.visualRoot,
      this.carryAnchor,
      this.handAnchor,
      this.headTop,
    );

    this.leftHand =
      this.model.getObjectByName("mixamorigLeftHand") ?? this.model;
    this.rightHand =
      this.model.getObjectByName("mixamorigRightHand") ?? this.model;
    this.head =
      this.model.getObjectByName("mixamorigHeadTop_End") ??
      this.model.getObjectByName("mixamorigHead") ??
      this.model;
    for (const [name, angle] of SIT_RECLINE) {
      const bone = this.model.getObjectByName(name);
      if (bone) this.recline.push({ bone, angle });
    }
    this.anchorMatrices = new AnchorMatrices(this.root, [this.leftHand, this.rightHand, this.head]);
    this.root.userData.characterRole = role;
    this.root.userData.characterModel = template.id;
    this.root.userData.characterPack = "fincan-current-customers";
    this.root.userData.locomotion = "walk-only";
    this.root.userData.signatureStyle = FINCAN_STYLE_VERSION;
    this.root.userData.signatureLook = look.id;
    this.root.userData.workwearPalette = look.palette;
    this.root.userData.signaturePieces = wardrobe.userData.signaturePieces;
    this.play("idle");
    this.mixer.update(0);
    this.syncAnchors();
  }

  setState(state: AnimState): void {
    this.state = state;
  }
  getState(): AnimState {
    return this.state;
  }
  setWorkKind(kind: WorkKind): void { this.workKind = kind; }
  setWorkPhase(phase: number): void {
    this.workPhase = phase < 0 ? -1 : THREE.MathUtils.clamp(phase, 0, 1);
  }
  setCarryCount(count: number): void {
    this.carryCount = Math.max(0, count);
  }
  setCarryMode(mode: CarryMode): void {
    this.carryMode = mode;
  }
  setLocomotionLevel(_level: number): void {}
  setPush(_on: boolean, _sweeping = false): void {}

  handMidLocal(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.handMidCache);
  }

  handSpanLocal(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.handSpanCache);
  }

  private syncAnchors(): void {
    this.anchorMatrices.update();
    this.rootInverse.copy(this.root.matrixWorld).invert();
    this.leftWorld.setFromMatrixPosition(this.leftHand.matrixWorld);
    this.rightWorld.setFromMatrixPosition(this.rightHand.matrixWorld);
    this.carryAnchor.position
      .copy(this.leftWorld)
      .add(this.rightWorld)
      .multiplyScalar(0.5);
    this.carryAnchor.position.applyMatrix4(this.rootInverse);
    this.carryAnchor.position.y += 0.07;
    this.carryAnchor.position.z += 0.07;
    this.handAnchor.position.copy(this.rightWorld);
    this.handAnchor.position.applyMatrix4(this.rootInverse);
    this.headWorld.setFromMatrixPosition(this.head.matrixWorld);
    this.headWorld.y += 0.24;
    this.headTop.position.copy(this.headWorld);
    this.headTop.position.applyMatrix4(this.rootInverse);
    this.handMidCache.copy(this.leftWorld).add(this.rightWorld).multiplyScalar(.5).applyMatrix4(this.rootInverse);
    this.handSpanCache.copy(this.rightWorld).applyMatrix4(this.rootInverse);
    this.leftWorld.applyMatrix4(this.rootInverse);
    this.handSpanCache.sub(this.leftWorld);
  }

  private play(key: CustomerClipKey, once = false): void {
    const clip = this.clips.get(key) ?? this.clips.get("idle");
    if (!clip || this.currentClip === clip.uuid) return;
    const next = this.mixer.clipAction(clip);
    next.reset().setEffectiveWeight(1);
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    next.fadeIn(0.16).play();
    this.action?.fadeOut(0.16);
    this.action = next;
    this.currentClip = clip.uuid;
  }

  update(dt: number, planarSpeed: number, turnRate = 0): void {
    if (this.disposed) return;
    const moving =
      planarSpeed > 0.08 || this.state === "walk" || this.state === "panic";
    let clip: CustomerClipKey = moving ? this.walkClip : "idle";
    let once = false;
    if (this.state === "sit") clip = "sit";
    else if (this.state === "work") {
      // Pickup/grab happens standing. Eating contains a seated lower body and
      // must never be used for a customer waiting at the collection counter.
      clip = this.workKind === 'reach' ? "bow" : "eat";
      once = this.workKind === 'reach';
    }
    else if (this.state === "angry") clip = "angry";
    else if (this.state === "cheer") {
      clip = "cheer";
      once = true;
    }
    this.play(clip, once);

    const controlledWork = this.state === "work" && this.workPhase >= 0;
    if (this.action) {
      if (controlledWork) {
        this.action.paused = true;
        const duration = this.action.getClip().duration;
        this.action.time = Math.min(duration - 1e-4, duration * this.workPhase);
      } else {
        this.action.paused = false;
        // Müşteri hiçbir koşulda run klibine geçmez; hızlı durumda yalnız adımı biraz sıklaştırır.
        this.action.timeScale = moving
          ? THREE.MathUtils.clamp(planarSpeed / 1.45, 0.72, 1.12)
          : 1;
      }
    }

    const step = THREE.MathUtils.clamp(dt, 0, 0.05);
    this.mixer.update(step);
    this.sitW = THREE.MathUtils.damp(this.sitW, this.state === "sit" ? 1 : 0, 10, step);
    if (this.sitW > 0.001)
      for (const { bone, angle } of this.recline) bone.rotateX(angle * this.sitW);
    this.forwardLean = THREE.MathUtils.damp(
      this.forwardLean,
      moving ? 0.012 : 0,
      10,
      step,
    );
    this.turnLean = THREE.MathUtils.damp(
      this.turnLean,
      moving ? THREE.MathUtils.clamp(-turnRate * 0.012, -0.045, 0.045) : 0,
      12,
      step,
    );
    this.visualRoot.position.y = THREE.MathUtils.damp(this.visualRoot.position.y, this.state === "sit" ? 0.08 : 0.046, 12, step);
    this.visualRoot.position.z = THREE.MathUtils.damp(this.visualRoot.position.z, this.state === "sit" ? 0.06 : 0, 12, step);
    this.visualRoot.rotation.x = this.forwardLean;
    this.visualRoot.rotation.z = this.turnLean;
    this.syncAnchors();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    disposeCharacterSkeletons(this.model);
    this.root.removeFromParent();
    this.root.clear();
  }
}

export function createCafeCustomer(
  role: "customer" | "dasher" | "investor",
  opts: CharacterOpts = {},
): CharacterHandle {
  const id = selectCafeCustomerModel(opts);
  const template = templates.get(id);
  if (!template) throw new Error("Müşteri paketi henüz yüklenmedi.");
  return new CafeCustomer(template, role, opts);
}
