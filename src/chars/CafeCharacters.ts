import { softenRunArms } from "./RunArms";
import { ServiceArmLayer, stationaryServiceClip } from './ServiceArms';
import { AnchorMatrices } from './AnchorMatrices';
import { PushArmLayer } from "./PushArms";
import { createAppearance } from "./Appearance";
import { addWorkwearRegions, createWorkwearMaterial, roleWorkwear } from "./Workwear";
import { mergeCharacterSkin, disposeCharacterSkeletons } from "./SkinBatch";
import { compactMergedSkin } from "./CompactSkinGeometry";
import { addSignatureWardrobe, FINCAN_STYLE_VERSION } from './SignatureWardrobe';
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type {
  AnimState,
  CarryMode,
  CharacterHandle,
  CharacterOpts,
  CharRole,
  WorkKind,
} from "./types";

/**
 * Web ve Android'in ortak oyuncu/personel adaptörü.
 */
export const CAFE_CHARACTER_MODEL_ID = "PlayerS01" as const;
export const CAFE_BODY_MESH = "Player_Workers" as const;
/** Unity prefabında GameObject + Renderer birlikte açık olan gerçek varsayılan görünüm. */
export const CAFE_ACTIVE_MESHES = [
  "HairCustomer04",
  "hatWorker",
  CAFE_BODY_MESH,
  "P_Pants",
  "P_Shirt",
  "P_Shoes",
] as const;
export const CAFE_REQUIRED_CLIPS = [
  "Happy",
  "Neutral Idle",
  "Running",
  "Sweep_Run",
  "Upgrade",
  "Waving",
  "FrontCarrying_Idle",
  "FrontCarrying_Run",
] as const;

type CafeClipKey =
  | "idle"
  | "run"
  | "cleanRun"
  | "cheer"
  | "upgrade"
  | "wave"
  | "carryIdle"
  | "service"
  | "carryRun";

const ROLE_HEIGHT: Readonly<Record<CharRole, number>> = {
  player: 1.6,
  runner: 1.57,
  waiter: 1.55,
  cashier: 1.54,
  barista: 1.55,
  busser: 1.56,
  customer: 1.53,
  dasher: 1.56,
  investor: 1.65,
};

const FBX_MODEL_HEIGHT = 2.11;
const MODEL_FILE = "PlayerS01.fbx";
const PALETTE_FILE = "ColorPalette01.png";
const HAT_READABILITY_OFFSET = Object.freeze({ y: 0.035, z: -0.025 });

const CLIP_BY_NAME: Readonly<
  Record<(typeof CAFE_REQUIRED_CLIPS)[number], CafeClipKey>
> = {
  Happy: "cheer",
  "Neutral Idle": "idle",
  Running: "run",
  Sweep_Run: "cleanRun",
  Upgrade: "upgrade",
  Waving: "wave",
  FrontCarrying_Idle: "carryIdle",
  FrontCarrying_Run: "carryRun",
};

interface CafeCharacterTemplate {
  scene: THREE.Group;
  clips: ReadonlyMap<CafeClipKey, THREE.AnimationClip>;
  material: THREE.MeshToonMaterial;
  workwear: Map<string, THREE.MeshToonMaterial>;
  wardrobes: Map<CharRole, THREE.Object3D>;
}

let template: CafeCharacterTemplate | null = null;
let loading: Promise<void> | null = null;

function packUrl(path: string): string {
  const base = import.meta.env?.BASE_URL || "/";
  return `${base.endsWith("/") ? base : `${base}/`}packs/current-cast/${path}?v=9b533143`;
}

export function normalizeCafeClipName(name: string): CafeClipKey | null {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "neutralidle") return "idle";
  if (normalized === "running") return "run";
  if (normalized === "sweeprun") return "cleanRun";
  if (normalized === "happy") return "cheer";
  if (normalized === "upgrade") return "upgrade";
  if (normalized === "waving") return "wave";
  if (normalized === "frontcarryingidle") return "carryIdle";
  if (normalized === "frontcarryingrun") return "carryRun";
  return null;
}

/** Ana karakter ve kalabalık aynı hazır prefabı kullanır; sayfa yenilemesi modeli değiştirmez. */
export function selectCafeModel(
  _role: CharRole,
  _opts: CharacterOpts = {},
): typeof CAFE_CHARACTER_MODEL_ID {
  return CAFE_CHARACTER_MODEL_ID;
}

/** Hareket kliplerindeki kök sürüklenmesini kaldırır; dünya konumunu oyun sistemi yönetir. */
function makeInPlace(source: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = source.tracks.map((sourceTrack) => {
    const track = sourceTrack.clone();
    if (
      !(track instanceof THREE.VectorKeyframeTrack) ||
      !/mixamorigHips\.position$/i.test(track.name)
    ) {
      return track;
    }
    const values = track.values;
    const baseX = values[0] ?? 0;
    const baseZ = values[2] ?? 0;
    for (let index = 0; index < values.length; index += 3) {
      values[index] = baseX;
      values[index + 2] = baseZ;
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

function configurePalette(texture: THREE.Texture, name: string): THREE.Texture {
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function toonMaterial(
  name: string,
  color: THREE.ColorRepresentation,
  map: THREE.Texture | null = null,
): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    name,
    color,
    map,
    // APK meshlerinin bazı üçgenleri dönüştürücüde ters sarımla geliyor.
    side: THREE.DoubleSide,
  });
}

function isPlayerS01VisibleMesh(object: THREE.Object3D): boolean {
  if (!(CAFE_ACTIVE_MESHES as readonly string[]).includes(object.name))
    return false;
  // FBX içinde aksesuar dolabında ikinci bir kapalı HairCustomer04 kopyası var.
  if (object.name === "HairCustomer04")
    return object.parent?.name === "mixamorigHeadTop_End";
  return true;
}

function prepareModel(scene: THREE.Group, paletteSource: THREE.Texture): THREE.MeshToonMaterial {
  const palette = configurePalette(paletteSource, "Cafe_ColorPalette01");
  // PlayerS01 prefabındaki altı açık renderer da aynı MainMat01_Outline paletini kullanır.
  const paletteMaterial = toonMaterial(
    "Cafe_MainMat01_Outline",
    0xffffff,
    palette,
  );
  const found = new Set<string>();

  const remove: THREE.Object3D[] = [];
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!isPlayerS01VisibleMesh(mesh)) {
      remove.push(mesh);
      return;
    }
    found.add(mesh.name);
    mesh.material = paletteMaterial;
    addWorkwearRegions(mesh.name, mesh.geometry);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    // APK bind-pose sınırları animasyondaki uç noktaları kapsamıyor.
    mesh.frustumCulled = false;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  });
  for (const object of remove) object.removeFromParent();
  for (const name of CAFE_ACTIVE_MESHES) {
    if (!found.has(name))
      throw new Error(`Varsayılan görünüm parçası eksik: ${name}`);
  }

  /**
   * AssetStudio FBX'i bind pose matrislerini kimlik matrisi olarak yazıyor.
   * Three.js bu değeri aynen kullanınca her vertex yanlış kemik uzayına gidip
   * dev üçgenler hâlinde sahneye saçılıyor. İskeletin gerçek dünya pozundan
   * inverse-bind matrislerini yeniden üretip her skin'i kendi mesh matrisiyle
   * bağlamak orijinal Unity deformasyonunu geri getirir.
   */
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    mesh.normalizeSkinWeights();
    mesh.skeleton.calculateInverses();
    mesh.bind(mesh.skeleton, mesh.matrixWorld);
  });

  const body = scene.getObjectByName(CAFE_BODY_MESH) as
    | THREE.SkinnedMesh
    | undefined;
  if (!body?.isSkinnedMesh)
    throw new Error(`Clean It ${CAFE_BODY_MESH} rigli gövdesi bulunamadı.`);
  return paletteMaterial;
}

function prepareClips(
  animations: readonly THREE.AnimationClip[],
): ReadonlyMap<CafeClipKey, THREE.AnimationClip> {
  const clips = new Map<CafeClipKey, THREE.AnimationClip>();
  for (const source of animations) {
    const key = normalizeCafeClipName(source.name);
    if (key && !clips.has(key)) clips.set(key, makeInPlace(source));
  }
  for (const [name, key] of Object.entries(CLIP_BY_NAME)) {
    if (!clips.has(key))
      throw new Error(
        `Clean It ${CAFE_CHARACTER_MODEL_ID}: ${name} klibi bulunamadı.`,
      );
  }
  clips.set("run", softenRunArms(clips.get("run")!, clips.get("idle")!));
  clips.set("service", stationaryServiceClip(clips.get("idle")!));
  return clips;
}

export async function loadCafeCharacterPack(): Promise<void> {
  if (template) return;
  if (loading) return loading;
  loading = (async () => {
    const [scene, palette] = await Promise.all([
      new FBXLoader().loadAsync(packUrl(MODEL_FILE)),
      new THREE.TextureLoader().loadAsync(packUrl(PALETTE_FILE)),
    ]);
    const material = prepareModel(scene, palette);
    const hat = scene.getObjectByName("hatWorker");
    if (hat) {
      hat.position.y += HAT_READABILITY_OFFSET.y;
      hat.position.z += HAT_READABILITY_OFFSET.z;
    }
    template = { scene, clips: prepareClips(scene.animations), material, workwear: new Map(), wardrobes: new Map() };
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

class CafeCharacter implements CharacterHandle {
  readonly root = new THREE.Group();
  readonly carryAnchor = new THREE.Object3D();
  readonly handAnchor = new THREE.Object3D();
  readonly headTop = new THREE.Object3D();
  readonly height: number;

  private readonly model: THREE.Object3D;
  private readonly visualRoot = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly pushArms: PushArmLayer;
  private readonly trayArms: PushArmLayer;
  private readonly serviceArms: ServiceArmLayer;
  private serviceBlend = 0;
  private servicePhase = 0;
  private readonly traySupport = new THREE.Vector3();
  private pushBlend = 0;
  private readonly clips: ReadonlyMap<CafeClipKey, THREE.AnimationClip>;
  private readonly leftHand: THREE.Object3D;
  private readonly rightHand: THREE.Object3D;
  private readonly head: THREE.Object3D;
  private readonly anchorMatrices: AnchorMatrices;
  private readonly handMidCache = new THREE.Vector3();
  private readonly handSpanCache = new THREE.Vector3();
  private readonly rootInverse = new THREE.Matrix4();
  private readonly leftWorld = new THREE.Vector3();
  private readonly rightWorld = new THREE.Vector3();
  private readonly headWorld = new THREE.Vector3();
  private baseAction: THREE.AnimationAction | null = null;
  private currentClip = "";
  private state: AnimState = "idle";
  private workKind: WorkKind = "generic";
  private workPhase = -1;
  private carryCount = 0;
  private carryMode: CarryMode = "none";
  private locomotionTier = 0;
  private pushing = false;
  private sweeping = false;
  private running = false;
  private forwardLean = 0;
  private turnLean = 0;
  private disposed = false;

  constructor(source: CafeCharacterTemplate, role: CharRole, opts: CharacterOpts) {
    let wardrobe = source.wardrobes.get(role);
    if (!wardrobe) {
      wardrobe = cloneSkeleton(source.scene);
      addSignatureWardrobe(wardrobe, role, FBX_MODEL_HEIGHT, source.material);
      const generated: THREE.BufferGeometry[] = [];
      wardrobe.traverse(o => { if (o.userData.signatureGarment) generated.push((o as THREE.Mesh).geometry); });
      if (!(import.meta.env.DEV && new URLSearchParams(location.search).has('rawRig'))) {
        compactMergedSkin(mergeCharacterSkin(wardrobe));
        for (const geometry of generated) geometry.dispose();
      }
      source.wardrobes.set(role, wardrobe);
    }
    this.model = cloneSkeleton(wardrobe);
    const palette = roleWorkwear(role, createAppearance(role, opts).pal);
    const paletteKey = Object.values(palette).join(':');
    let material = source.workwear.get(paletteKey);
    if (!material) {
      material = createWorkwearMaterial(source.material, palette);
      source.workwear.set(paletteKey, material);
    }
    this.model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.material = material!;
    });
    this.clips = source.clips;
    this.mixer = new THREE.AnimationMixer(this.model);
    this.pushArms = new PushArmLayer(this.model, source.clips.get("carryIdle")!);
    this.trayArms = new PushArmLayer(this.model, source.clips.get("carryIdle")!, "tray");
    this.height = ROLE_HEIGHT[role] * (opts.scale ?? 1);

    const scale = this.height / FBX_MODEL_HEIGHT;
    // Birebir prefab oranı: rol/seed/girth modeli enine veya boyuna deforme etmez.
    this.visualRoot.scale.setScalar(scale);
    this.visualRoot.position.y = 0.051;
    this.visualRoot.add(this.model);
    this.root.add(
      this.visualRoot,
      this.carryAnchor,
      this.handAnchor,
      this.headTop,
    );
    this.carryAnchor.userData.trayBounceSynced = true;
    this.serviceArms = new ServiceArmLayer(this.model, this.root, this.height, source.clips.get("idle")!, source.clips.get("carryIdle"));

    this.leftHand =
      this.model.getObjectByName("mixamorigLeftHand") ?? this.model;
    this.rightHand =
      this.model.getObjectByName("mixamorigRightHand") ?? this.model;
    this.head =
      this.model.getObjectByName("mixamorigHeadTop_End") ??
      this.model.getObjectByName("mixamorigHead") ??
      this.model;
    this.anchorMatrices = new AnchorMatrices(this.root, [this.leftHand, this.rightHand, this.head]);

    this.root.userData.characterRole = role;
    this.root.userData.characterModel = CAFE_CHARACTER_MODEL_ID;
    this.root.userData.characterPack = "fincan-current";
    this.root.userData.characterSourceVersion = "1.0.0";
    this.root.userData.workwearPalette = palette;
    this.root.userData.signatureStyle = FINCAN_STYLE_VERSION;
    this.root.userData.signaturePieces = wardrobe.userData.signaturePieces;
    this.playBase("idle");
    this.mixer.update(0);
    this.syncAnchors();
  }

  setState(state: AnimState): void {
    this.state = state;
  }

  getState(): AnimState {
    return this.state;
  }

  setWorkKind(kind: WorkKind): void {
    this.workKind = kind;
  }

  setWorkPhase(phase: number): void {
    this.workPhase = phase < 0 ? -1 : THREE.MathUtils.clamp(phase, 0, 1);
  }

  setCarryCount(count: number): void {
    const next = Math.max(0, count);
    if (next !== this.carryCount) {
      if (next === 0) this.serviceArms.resetBounce();
      else if (next > this.carryCount) this.serviceArms.triggerBounce(-0.075);
      else this.serviceArms.triggerBounce(0.055);
      this.carryCount = next;
    }
  }

  setCarryMode(mode: CarryMode): void {
    this.carryMode = mode;
  }

  setLocomotionLevel(level: number): void {
    this.locomotionTier = level >= 6 ? 2 : level >= 3 ? 1 : 0;
  }

  setPush(on: boolean, sweeping = false): void {
    this.pushing = on;
    this.sweeping = on && sweeping;
  }

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
    if ((this.carryMode === "tray" || this.carryMode === "none" && this.carryCount > 0) && !this.pushing) {
      this.serviceArms.trayPosition(this.traySupport);
      this.carryAnchor.position.lerp(this.traySupport, this.serviceBlend);
    }

    this.handAnchor.position.copy(this.rightWorld);
    this.handAnchor.position.applyMatrix4(this.rootInverse);

    this.headWorld.setFromMatrixPosition(this.head.matrixWorld);
    this.headWorld.y += 0.26;
    this.headTop.position.copy(this.headWorld);
    this.headTop.position.applyMatrix4(this.rootInverse);
    const grasp = this.pushing ? this.pushBlend : 0;
    this.pushArms.handPosition(this.leftHand, this.leftWorld, grasp);
    this.pushArms.handPosition(this.rightHand, this.rightWorld, grasp);
    this.handMidCache.copy(this.leftWorld).add(this.rightWorld).multiplyScalar(.5).applyMatrix4(this.rootInverse);
    this.handSpanCache.copy(this.rightWorld).applyMatrix4(this.rootInverse);
    this.leftWorld.applyMatrix4(this.rootInverse);
    this.handSpanCache.sub(this.leftWorld);
  }

  private playBase(key: CafeClipKey, once = false): void {
    const clip = this.clips.get(key) ?? this.clips.get("idle");
    if (!clip || this.currentClip === clip.uuid) return;
    const next = this.mixer.clipAction(clip);
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    next.fadeIn(0.13).play();
    this.baseAction?.fadeOut(0.13);
    this.baseAction = next;
    this.currentClip = clip.uuid;
  }

  update(dt: number, planarSpeed: number, turnRate = 0): void {
    if (this.disposed) return;
    const moving =
      planarSpeed > 0.08 || this.state === "walk" || this.state === "panic";
    const runStart =
      this.locomotionTier === 2 ? 1.9 : this.locomotionTier === 1 ? 2.15 : 2.4;
    if (!moving) this.running = false;
    else if (this.state === "panic" || planarSpeed > runStart)
      this.running = true;
    else if (planarSpeed < runStart - 0.35) this.running = false;

    const carrying = this.carryCount > 0 || this.carryMode !== "none";
    let clip: CafeClipKey = "idle";
    let once = false;
    if (this.state === "cheer") {
      clip = "cheer";
      once = true;
    } else if (this.state === "angry") {
      clip = "upgrade";
      once = true;
    } else if (this.pushing && moving) {
      clip = "cleanRun";
    } else if (carrying && this.carryMode === "cart") {
      clip = moving ? "carryRun" : "carryIdle";
    } else if (moving) {
      // Tepsi kolları ServiceArmLayer ile çözülür. FrontCarrying_Run bütün
      // gövdeyi değiştirip bacakları normal yürüyüşten koparıyordu.
      clip = "run";
    }
    this.playBase(clip, once);

    if (this.baseAction) {
      this.baseAction.paused = false;
      if (clip === "run" || clip === "cleanRun" || clip === "carryRun") {
        const authoredSpeed = this.running ? 2.8 : 1.35;
        this.baseAction.timeScale = THREE.MathUtils.clamp(
          planarSpeed / authoredSpeed,
          0.58,
          1.42,
        );
      } else {
        this.baseAction.timeScale = 1;
      }
    }

    const step = THREE.MathUtils.clamp(dt, 0, 0.05);
    this.serviceArms.restore();
    this.trayArms.restore();
    this.pushArms.restore();
    this.mixer.update(step);
    // Sweep_Run swings its arms like a run; only the vacuum layer replaces them.
    this.pushBlend = THREE.MathUtils.damp(this.pushBlend, this.pushing ? 1 : 0, 22, step);
    if (this.pushBlend > 0.999) this.pushBlend = 1;
    else if (this.pushBlend < 0.001) this.pushBlend = 0;
    this.pushArms.apply(this.pushBlend);
    if (carrying && !this.pushing && this.carryMode === "cart") this.trayArms.apply(1);
    const supportedTray = carrying && this.carryMode !== "cart";
    const servicing = false;
    const serviceOn = !this.pushing && this.carryMode !== "cart" && supportedTray;
    this.serviceBlend = THREE.MathUtils.damp(this.serviceBlend, serviceOn ? 1 : 0, 24, step);
    if (this.serviceBlend > .999) this.serviceBlend = 1;
    else if (this.serviceBlend < .001) this.serviceBlend = 0;
    this.servicePhase = 0;
    const desiredForward = this.pushing
      ? 0.035
      : moving
        ? this.running
          ? 0.04
          : 0.016
        : 0;
    const desiredTurn = moving
      ? THREE.MathUtils.clamp(-turnRate * 0.018, -0.06, 0.06)
      : 0;
    this.forwardLean = THREE.MathUtils.damp(
      this.forwardLean,
      desiredForward,
      12,
      step,
    );
    this.turnLean = THREE.MathUtils.damp(this.turnLean, desiredTurn, 14, step);
    this.visualRoot.rotation.x = this.forwardLean;
    this.visualRoot.rotation.z = this.turnLean;

    this.serviceArms.apply(this.serviceBlend, supportedTray, servicing, this.servicePhase, this.workKind, step, !!this.carryAnchor.userData.supplyCarry);
    this.syncAnchors();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    disposeCharacterSkeletons(this.model);
    // Geometri, palet ve toon malzemesi tüm karakter kopyaları arasında paylaşılır.
    this.root.removeFromParent();
    this.root.clear();
  }
}

export function createCafeCharacter(
  role: CharRole,
  opts: CharacterOpts = {},
): CharacterHandle {
  if (!template)
    throw new Error("Karakter paketi henüz yüklenmedi.");
  selectCafeModel(role, opts);
  return new CafeCharacter(template, role, opts);
}
