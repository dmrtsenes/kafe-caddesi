import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FINCAN_PLAYER_WORKWEAR } from './Workwear';
import { mergeCharacterSkin } from './SkinBatch';
import { paletteGeometry } from './PaletteGeometry';
import { CAST_PALETTE_SIZE, createPaletteMaterial } from './PaletteMaterial';
import { PushArmLayer } from './PushArms';
import { uniformSkin } from '../data/cosmetics';
import type { AnimState, CarryMode, CharacterHandle, CharacterOpts, CharRole, WorkKind } from './types';

const MODEL_FILES = {
  'female-casual': 'female-casual.glb',
  'female-formal': 'female-formal.glb',
  'female-suit': 'female-suit.glb',
  'female-worker': 'female-worker.glb',
  'male-casual': 'male-casual.glb',
  'male-hoodie': 'male-hoodie.glb',
  'male-suit': 'male-suit.glb',
} as const;

export const CHARACTER_PACK_MODELS = Object.keys(MODEL_FILES) as Array<keyof typeof MODEL_FILES>;
type ModelId = keyof typeof MODEL_FILES;

interface CharacterTemplate {
  id: ModelId;
  scene: THREE.Object3D;
  clips: Map<string, THREE.AnimationClip>;
  minY: number;
  height: number;
  palette: THREE.Material[];
}

const templates = new Map<ModelId, CharacterTemplate>();
let loading: Promise<void> | null = null;

/**
 * ROL KADROSU.
 *
 * Hazır model seçimi rastgele bir "herkes her kıyafeti giyebilir" havuzu
 * değildir. Clean It benzeri küçük mobil kadrajda meslek, yüz ayrıntısından
 * önce SİLÜETTEN okunur. Tekrarlar ağırlıktır: günlük müşteriler çoğunluk,
 * takım elbiseli müşteri seyrektir; işçi yeleği ise yalnız ekipte görünür.
 */
export const CHARACTER_ROLE_MODELS: Readonly<Record<CharRole, readonly ModelId[]>> = {
  // Ana karakter bilinçli olarak TEK modeldir: sayfa yenilenince kahramanın
  // yüzü/kıyafeti değişmez. Casual gövde kafe çalışanına işçi yeleğinden
  // daha uygundur; rolü nane-krem oyuncu paleti verir.
  player: ['male-casual'],
  runner: ['female-worker', 'male-casual'],
  waiter: ['female-formal', 'male-suit'],
  cashier: ['female-formal', 'male-suit'],
  barista: ['female-worker', 'male-suit'],
  busser: ['female-worker', 'male-hoodie'],
  customer: [
    'female-casual',
    'female-casual',
    'female-formal',
    'male-casual',
    'male-casual',
    'male-hoodie',
    'female-suit',
    'male-suit',
  ],
  dasher: ['male-hoodie'],
  investor: ['male-suit'],
};

const SKIN_TONES = [0xf5d2b4, 0xe8b98f, 0xd99b70, 0xc58259, 0xa96846, 0x835038, 0x5d382b];
const HAIR_TONES = [0x17120f, 0x2a1c15, 0x49301f, 0x70492a, 0xa16f38, 0xd0a55d, 0x6f3025, 0x6c6a68];
const CLOTH_TONES = [0x397b76, 0xb85f52, 0x526d91, 0xb08a45, 0x665b80, 0x55705c, 0x3b414a, 0xc8c2b8];

interface RolePalette {
  primary: THREE.Color;
  secondary: THREE.Color;
  accent: THREE.Color;
  dark: THREE.Color;
}

const ROLE_COLORS: Readonly<Record<Exclude<CharRole, 'customer' | 'dasher' | 'investor'>, readonly [number, number, number, number]>> = {
  player: [FINCAN_PLAYER_WORKWEAR.main, FINCAN_PLAYER_WORKWEAR.edge, FINCAN_PLAYER_WORKWEAR.badge, FINCAN_PLAYER_WORKWEAR.pants],
  runner: [0xe2703a, 0x31445f, 0xf2c94c, 0x252c35],
  waiter: [0x2f5a4c, 0xf7f1e5, 0xd7a83d, 0x243349],
  cashier: [0x4fb59a, 0xf7f1e5, 0xe2703a, 0x243349],
  barista: [0x7d2b3d, 0xeee2ca, 0xd7a83d, 0x2f3540],
  busser: [0x3f7fae, 0xd9edf3, 0xf2c94c, 0x26364d],
};

function mixHex(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

function paletteFor(role: CharRole, opts: CharacterOpts, random: () => number): RolePalette | null {
  if (role === 'customer' || role === 'investor') return null;
  if (role === 'dasher') {
    return {
      primary: new THREE.Color(0x242a31),
      secondary: new THREE.Color(0x39414d),
      accent: new THREE.Color(0x6c7480),
      dark: new THREE.Color(0x171a1f),
    };
  }

  let [primary, secondary, accent, dark] = ROLE_COLORS[role];
  const skin = uniformSkin(opts.uniform ?? '');
  // Kozmetik ev rengi meslek silüetini değiştirmez; yalnız hazır modelin
  // ana kumaşını ve biyesini değiştirir. Oyuncu şube personeli sayılmadığı
  // için kendi nane/krem imza takımını korur.
  if (role !== 'player' && skin.house !== null) {
    primary = skin.house;
    secondary = mixHex(skin.house, skin.trim, 0.72);
    accent = skin.trim;
    dark = mixHex(skin.house, 0x17202b, 0.62);
  }

  // Aynı üniformayı giyen iki kişi plastik kopya görünmesin: kumaşta çok
  // küçük, deterministik bir değer farkı var; takım rengi yine aynı okunur.
  const fabricLift = 0.025 + random() * 0.035;
  return {
    primary: new THREE.Color(primary).lerp(new THREE.Color(0xffffff), fabricLift),
    secondary: new THREE.Color(secondary),
    accent: new THREE.Color(accent),
    dark: new THREE.Color(dark),
  };
}

const RETARGET_BONES: Record<string, string> = {
  'DEF-head': 'Head',
  'DEF-neck': 'Neck',
  'DEF-handL': 'WristL',
  'DEF-handR': 'WristR',
  'DEF-forearmL': 'LowerArmL',
  'DEF-forearmR': 'LowerArmR',
  'DEF-upper_armL': 'UpperArmL',
  'DEF-upper_armR': 'UpperArmR',
  'DEF-shoulderL': 'ShoulderL',
  'DEF-shoulderR': 'ShoulderR',
  'DEF-spine003': 'Chest',
  'DEF-spine002': 'Torso',
  'DEF-spine001': 'Abdomen',
  'DEF-hips': 'Hips',
  'DEF-thighL': 'UpperLegL',
  'DEF-thighR': 'UpperLegR',
  'DEF-shinL': 'LowerLegL',
  'DEF-shinR': 'LowerLegR',
  'DEF-footL': 'FootL',
  'DEF-footR': 'FootR',
  'DEF-toeL': 'PTL',
  'DEF-toeR': 'PTR',
};

function packUrl(path: string): string {
  const base = import.meta.env?.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}packs/quaternius/${path}`;
}

function mappedBone(source: string): string | null {
  // GLTFLoader PropertyBinding için nokta, iki nokta ve köşeli parantezi
  // nesne adından temizler. Test/araç girdisi ham da gelebilir; iki yolu
  // aynı anahtara indirerek gerçek sahne ile testin aynı sözleşmeyi
  // kullanmasını sağla.
  const normalized = source.replace(/[\[\].:/]/g, '');
  const direct = RETARGET_BONES[normalized];
  if (direct) return direct;
  const finger = /^DEF-f_(index|middle|pinky|ring)(0[1-3])([LR])$/.exec(normalized);
  if (finger) {
    const label = finger[1][0].toUpperCase() + finger[1].slice(1);
    return `${label}${Number(finger[2])}${finger[3]}`;
  }
  const thumb = /^DEF-thumb(0[1-3])([LR])$/.exec(normalized);
  if (thumb) return `Thumb${Number(thumb[1])}${thumb[2]}`;
  return null;
}

/**
 * Universal Animation Library kliplerini eski modular pack rigine taşır.
 * Yalnız kemik rotasyonları alınır; farklı gövde ölçülerinin konum/ölçek
 * kanalları karakteri esnetmesin diye bilinçli olarak atılır.
 */
export function retargetQuaterniusClip(source: THREE.AnimationClip): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const track of source.tracks) {
    const match = /^(.*)\.(quaternion|position|scale)$/.exec(track.name);
    if (!match || match[2] !== 'quaternion') continue;
    const target = mappedBone(match[1]);
    if (!target) continue;
    const cloned = track.clone();
    cloned.name = `${target}.quaternion`;
    tracks.push(cloned);
  }
  return new THREE.AnimationClip(source.name, source.duration, tracks);
}

function upperBodyClip(source: THREE.AnimationClip): THREE.AnimationClip {
  const upper = /^(Shoulder|UpperArm|LowerArm|Wrist|Index|Middle|Ring|Pinky|Thumb|Chest|Torso|Neck|Head)/;
  // Poz bindirmesi yalnız rotasyon taşır. Konum/ölçek kanalları taban
  // yürüyüşün omuz yüksekliğini ezip eldeki tepsiyi zıplatıyordu.
  const tracks = source.tracks
    .filter((track) => upper.test(track.name) && track.name.endsWith('.quaternion'))
    .map((track) => track.clone());
  return new THREE.AnimationClip('__carry_upper', source.duration, tracks);
}

function prepareTemplate(id: ModelId, scene: THREE.Object3D, clips: THREE.AnimationClip[]): CharacterTemplate {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const byName = new Map(clips.map((clip) => [clip.name, clip]));
  const carrySource = byName.get('Idle_Gun') ?? byName.get('Idle_Gun_Pointing');
  if (carrySource) byName.set('__carry_upper', upperBodyClip(carrySource));
  const palette: THREE.Material[] = [], prepared: THREE.BufferGeometry[] = [];
  const placeholder = new THREE.MeshToonMaterial();
  scene.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const indices = materials.map(material => {
      let index = palette.indexOf(material);
      if (index < 0) { index = palette.length; palette.push(material); }
      return index + 1;
    });
    const geometry = paletteGeometry(mesh.geometry).clone(), slots = geometry.getAttribute('paletteSlot');
    const colors = new Uint8Array(slots.count);
    for (let vertex=0; vertex<slots.count; vertex++) colors[vertex] = indices[slots.getX(vertex)] ?? 0;
    geometry.deleteAttribute('paletteSlot');
    geometry.setAttribute('fincanColor', new THREE.BufferAttribute(colors,1));
    mesh.geometry = geometry; mesh.material = placeholder; prepared.push(geometry);
  });
  if (palette.length >= CAST_PALETTE_SIZE) throw new Error('Character palette is too large: '+id);
  const merged = mergeCharacterSkin(scene);
  if (!merged) throw new Error('Character topology could not be prepared: '+id);
  merged.userData.sharedCharacterGeometry = true;
  for (const geometry of prepared) geometry.dispose();
  return {
    id,
    scene,
    clips: byName,
    minY: Number.isFinite(box.min.y) ? box.min.y : 0,
    height: Math.max(0.1, size.y),
    palette,
  };
}

export async function loadCharacterPack(): Promise<void> {
  if (templates.size === CHARACTER_PACK_MODELS.length) return;
  if (loading) return loading;
  loading = (async () => {
    const loader = new GLTFLoader();
    const [library, ...models] = await Promise.all([
      loader.loadAsync(packUrl('animations/library.glb')),
      ...CHARACTER_PACK_MODELS.map((id) => loader.loadAsync(packUrl(`characters/${MODEL_FILES[id]}`))),
    ]);

    const extra = new Map<string, THREE.AnimationClip>();
    for (const name of [
      'Sitting_Idle_Loop',
      'Sitting_Talking_Loop',
      'Push_Loop',
      'PickUp_Table',
      'Idle_Talking_Loop',
    ]) {
      const clip = library.animations.find((candidate) => candidate.name === name);
      if (clip) extra.set(name, retargetQuaterniusClip(clip));
    }

    CHARACTER_PACK_MODELS.forEach((id, index) => {
      const gltf = models[index];
      const template = prepareTemplate(id, gltf.scene, gltf.animations);
      for (const [name, clip] of extra) template.clips.set(name, clip);
      templates.set(id, template);
    });
  })().catch((err) => {
    // İlk ağ/önbellek denemesi bozulduysa reddedilmiş Promise'i sonsuza
    // kadar saklama; sayfa yaşam döngüsü içinde güvenli tekrar mümkün kalsın.
    loading = null;
    throw err;
  });
  return loading;
}

function seeded(seed: number): () => number {
  let state = (seed || 0x9e3779b9) >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function chooseTemplate(role: CharRole, opts: CharacterOpts): { template: CharacterTemplate; random: () => number } {
  const seed = (opts.seed ?? ((opts.variant ?? 0) + 1) * 2654435761) >>> 0;
  const random = seeded(seed);
  const pool = CHARACTER_ROLE_MODELS[role];
  const available = pool.filter((id) => templates.has(id));
  if (available.length === 0) throw new Error('Hazır karakter paketi yüklenmedi.');
  const id = available[Math.floor(random() * available.length) % available.length];
  return { template: templates.get(id)!, random };
}

function cloneAndTint(
  template: CharacterTemplate,
  role: CharRole,
  opts: CharacterOpts,
  random: () => number,
): { model: THREE.Object3D; materials: THREE.Material[] } {
  const model = cloneSkeleton(template.scene);
  const materialMap = new Map<THREE.Material, THREE.Material>();
  const materials: THREE.Material[] = [];
  const skin = new THREE.Color(SKIN_TONES[Math.floor(random() * SKIN_TONES.length)]);
  const hair = new THREE.Color(HAIR_TONES[Math.floor(random() * HAIR_TONES.length)]);
  const clothA = new THREE.Color(CLOTH_TONES[Math.floor(random() * CLOTH_TONES.length)]);
  const clothB = new THREE.Color(CLOTH_TONES[Math.floor(random() * CLOTH_TONES.length)]);
  const rolePalette = paletteFor(role, opts, random);

  const convert = (source: THREE.Material): THREE.Material => {
    const cached = materialMap.get(source);
    if (cached) return cached;
    const material = source.clone();
    const colored = material as THREE.Material & { color?: THREE.Color; roughness?: number; metalness?: number };
    const name = source.name.toLowerCase();
    if (colored.color) {
      if (name.includes('skin')) {
        colored.color.copy(skin);
        if (name.includes('darker')) colored.color.multiplyScalar(0.86);
      } else if (name.includes('hair') || name.includes('blond')) {
        colored.color.copy(hair);
      } else if (name.includes('eye') || name.includes('eyebrow')) {
        colored.color.copy(hair).multiplyScalar(0.46);
      } else if (rolePalette) {
        if (role === 'player' && (name.includes('lightblue') || name.includes('brown'))) {
          colored.color.copy(rolePalette.dark);
        } else if (name.includes('white')) {
          colored.color.copy(rolePalette.secondary);
        } else if (
          name.includes('yellow') ||
          name.includes('gold') ||
          name.includes('orange') ||
          name.includes('tie') ||
          name.includes('lime') ||
          name.includes('lightblue')
        ) {
          colored.color.copy(rolePalette.accent);
        } else if (
          name.includes('black') ||
          name.includes('grey') ||
          name.includes('darkbrown') ||
          name === 'brown' ||
          name === 'brown_02' ||
          name === 'brown2'
        ) {
          colored.color.copy(rolePalette.dark);
        } else {
          colored.color.copy(rolePalette.primary);
        }
      } else if (!name.includes('white')) {
        // Müşteriler aynı hazır modellerden gelir ama kalabalık tek tip bir
        // renk duvarına dönüşmez; kaynak rengi koruyan kontrollü tint.
        colored.color.lerp(random() > 0.5 ? clothA : clothB, 0.34);
      }
    }
    if (typeof colored.roughness === 'number') colored.roughness = 0.78;
    if (typeof colored.metalness === 'number') colored.metalness = 0;
    materialMap.set(source, material);
    materials.push(material);
    return material;
  };

  const flatMaterial = createPaletteMaterial(template.palette.map(source => (convert(source) as THREE.MeshStandardMaterial).color));
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material=flatMaterial;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    // Hareketli iskeletin kutusu pozla değişir; yanlış eski kutu yüzünden
    // karakterin kolu/gövdesi ekran kenarında kesilmesin.
    mesh.frustumCulled = false;
  });
  for (const material of materials) material.dispose();
  return { model, materials: [flatMaterial] };
}

const ROLE_HEIGHT: Readonly<Record<CharRole, number>> = {
  player: 1.58,
  runner: 1.64,
  waiter: 1.61,
  cashier: 1.56,
  barista: 1.59,
  busser: 1.62,
  customer: 1.57,
  dasher: 1.62,
  investor: 1.64,
};

/** Clean It benzeri kısa/geniş silüet; çarpışma değil yalnız görseldir. */
const ROLE_GIRTH: Readonly<Record<CharRole, number>> = {
  player: 1.24,
  runner: 1.18,
  waiter: 1.16,
  cashier: 1.18,
  barista: 1.21,
  busser: 1.22,
  customer: 1.17,
  dasher: 1.16,
  investor: 1.18,
};

class PackedCharacter implements CharacterHandle {
  readonly root = new THREE.Group();
  readonly carryAnchor = new THREE.Object3D();
  readonly handAnchor = new THREE.Object3D();
  readonly headTop = new THREE.Object3D();
  readonly height: number;

  private readonly model: THREE.Object3D;
  /** Ayağa sabit görsel pivot: viraj/koşu eğimi iskelet kökünü bozmaz. */
  private readonly visualRoot = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly clips: Map<string, THREE.AnimationClip>;
  private readonly materials: THREE.Material[];
  private readonly head: THREE.Object3D;
  private readonly headScale: number;
  private readonly pushArms: PushArmLayer;
  private readonly trayArms: PushArmLayer;
  private readonly wristL: THREE.Object3D;
  private readonly wristR: THREE.Object3D;
  private readonly rightHandWorld = new THREE.Vector3();
  private readonly leftHandWorld = new THREE.Vector3();
  private readonly rootInverse = new THREE.Matrix4();
  private readonly sitTalking: boolean;
  private currentBase = '';
  private currentOverlay = '';
  private baseAction: THREE.AnimationAction | null = null;
  private overlayAction: THREE.AnimationAction | null = null;
  private state: AnimState = 'idle';
  private workKind: WorkKind = 'generic';
  /** -1 = serbest döngü; 0..1 = oynanışla kilitli temas fazı. */
  private workPhase = -1;
  private carry = 0;
  private carryMode: CarryMode = 'none';
  private locomotionTier = 0;
  private running = false;
  private pushing = false;
  private sweeping = false;
  private turnLean = 0;
  private forwardLean = 0;
  private disposed = false;

  constructor(template: CharacterTemplate, role: CharRole, opts: CharacterOpts, random: () => number) {
    const built = cloneAndTint(template, role, opts, random);
    this.model = built.model;
    this.materials = built.materials;
    this.clips = template.clips;
    this.mixer = new THREE.AnimationMixer(this.model);

    this.height = ROLE_HEIGHT[role] * (0.965 + random() * 0.07) * (opts.scale ?? 1);
    const scale = this.height / template.height;
    const width = ROLE_GIRTH[role] * (opts.girth ?? 1) * (0.98 + random() * 0.045);
    this.model.scale.set(scale * width * 1.06, scale * 0.86, scale * width * 1.06);
    this.model.position.y = -template.minY * scale;
    // Pack zaten oyunun +Z ileri sözleşmesiyle aynı yönde gelir.
    this.model.rotation.y = 0;
    this.visualRoot.add(this.model);
    this.root.add(this.visualRoot);

    const head = this.model.getObjectByName('Head') ?? this.model;
    this.head = head;
    // Clean It benzeri mobil okunaklılık: hazır model korunur, yalnız kafa
    // kemik ölçeği %6-9 büyür. Kostüm geometrisi veya yüz yeniden üretilmez.
    this.headScale = role === 'player' ? 2.15 : 2.05 + random() * 0.10;
    this.head.scale.setScalar(this.headScale);
    this.wristL = this.model.getObjectByName('WristL') ?? this.model;
    this.wristR = this.model.getObjectByName('WristR') ?? this.model;
    this.sitTalking = role === 'customer' && random() > 0.72;
    const holding = this.clips.get('Idle_Gun') ?? this.clips.get('Idle_Neutral')!;
    this.pushArms = new PushArmLayer(this.model, holding, 'push', 'quaternius');
    this.trayArms = new PushArmLayer(this.model, holding, 'tray', 'quaternius');
    this.headTop.position.set(0, 0.24, 0);
    head.add(this.headTop);
    this.carryAnchor.position.set(0, 0.08, 0.28);
    this.root.add(this.carryAnchor);
    this.handAnchor.position.set(0, -0.07, 0.04);
    this.wristR.add(this.handAnchor);
    this.root.userData.characterRole = role;
    this.root.userData.characterModel = template.id;
    this.root.userData.characterPack = 'quaternius';
    this.playBase('Idle_Neutral');
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
    this.carry = Math.max(0, count);
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
    this.wristL.updateWorldMatrix(true, false);
    this.wristR.updateWorldMatrix(true, false);
    out.setFromMatrixPosition(this.wristL.matrixWorld);
    this.rightHandWorld.setFromMatrixPosition(this.wristR.matrixWorld);
    out.add(this.rightHandWorld).multiplyScalar(0.5);
    return this.root.worldToLocal(out);
  }

  handSpanLocal(out: THREE.Vector3): THREE.Vector3 {
    this.wristL.updateWorldMatrix(true, false);
    this.wristR.updateWorldMatrix(true, false);
    this.rootInverse.copy(this.root.matrixWorld).invert();
    this.leftHandWorld.setFromMatrixPosition(this.wristL.matrixWorld).applyMatrix4(this.rootInverse);
    out.setFromMatrixPosition(this.wristR.matrixWorld).applyMatrix4(this.rootInverse);
    return out.sub(this.leftHandWorld);
  }

  private playBase(name: string, once = false): void {
    const clip = this.clips.get(name) ?? this.clips.get('Idle_Neutral') ?? this.clips.get('Idle');
    if (!clip || this.currentBase === clip.name) return;
    const next = this.mixer.clipAction(clip);
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    next.fadeIn(0.16).play();
    this.baseAction?.fadeOut(0.16);
    this.baseAction = next;
    this.currentBase = clip.name;
  }

  private playOverlay(name: string | null): void {
    if (!name) {
      this.overlayAction?.fadeOut(0.12);
      this.overlayAction = null;
      this.currentOverlay = '';
      return;
    }
    const clip = this.clips.get(name);
    if (!clip || this.currentOverlay === name) return;
    const next = this.mixer.clipAction(clip);
    next.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(0.92).fadeIn(0.12).play();
    this.overlayAction?.fadeOut(0.12);
    this.overlayAction = next;
    this.currentOverlay = name;
  }

  update(dt: number, planarSpeed: number, turnRate = 0): void {
    if (this.disposed) return;
    const moving = planarSpeed > 0.08 || this.state === 'walk' || this.state === 'panic';
    const runStart = this.locomotionTier === 2 ? 1.9 : this.locomotionTier === 1 ? 2.15 : 2.45;
    if (!moving) this.running = false;
    else if (this.state === 'panic' || planarSpeed > runStart) this.running = true;
    else if (planarSpeed < runStart - 0.38) this.running = false;

    let clip = moving ? (this.running ? 'Run' : 'Walk') : 'Idle_Neutral';
    let once = false;

    if (this.state === 'sit') clip = this.sitTalking ? 'Sitting_Talking_Loop' : 'Sitting_Idle_Loop';

    else if (this.state === 'work' && this.workKind !== 'reach') {
      if (this.workKind === 'wipe') clip = 'Push_Loop';
      else if (this.workKind === 'cash') clip = this.workPhase >= 0 ? 'Interact' : 'Idle_Talking_Loop';
      else clip = 'Interact';
    } else if (this.state === 'cheer') {
      clip = 'Wave';
      once = true;
    } else if (this.state === 'angry') {
      clip = 'HitRecieve_2';
      once = true;
    }

    this.playBase(clip, once);
    this.playOverlay(null);

    const controlledWork = this.state === 'work' && this.workKind !== 'reach' && this.workPhase >= 0;
    if (this.baseAction) {
      if (controlledWork) {
        // Ürün/kasa tam 0,48 fazında el değiştirir (Player.tryHandContact).
        // Klip aynı faza kilitlendiği için obje avuca ulaşmadan ışınlanmaz.
        this.baseAction.paused = true;
        this.baseAction.time = Math.min(this.baseAction.getClip().duration - 1e-4, this.baseAction.getClip().duration * this.workPhase);
      } else {
        this.baseAction.paused = false;
        if (clip === 'Walk' || clip === 'Run') {
          const authoredSpeed = clip === 'Run' ? 2.8 : 1.25;
          this.baseAction.timeScale = THREE.MathUtils.clamp(planarSpeed / authoredSpeed, 0.72, 1.38);
        } else if (clip === 'Idle_Talking_Loop') {
          this.baseAction.timeScale = 0.92;
        } else {
          this.baseAction.timeScale = this.sweeping ? 1.12 : 1;
        }
      }
    }

    const step = Math.min(dt, 0.05);
    this.pushArms.restore();
    this.trayArms.restore();
    this.mixer.update(step);
    // Kaynak kliplerin sabit ölçek kanalı kafa stilini her kare 1'e
    // döndürür; son sözü burada stil katmanı söyler.
    this.head.scale.setScalar(this.headScale);
    if (this.pushing || this.carryMode === 'cart') this.pushArms.apply(1);
    else if (this.carry > 0) this.trayArms.apply(1);
    this.handMidLocal(this.carryAnchor.position);
    this.carryAnchor.quaternion.identity();

    const activeMove = moving && this.state !== 'sit' && this.state !== 'work';
    const desiredForward = this.pushing ? 0.045 : activeMove ? (this.running ? 0.055 : 0.025) : 0;
    const desiredTurn = activeMove ? THREE.MathUtils.clamp(-turnRate * 0.025, -0.085, 0.085) : 0;
    this.forwardLean = THREE.MathUtils.damp(this.forwardLean, desiredForward, 12, step);
    this.turnLean = THREE.MathUtils.damp(this.turnLean, desiredTurn, 14, step);
    this.visualRoot.position.y = THREE.MathUtils.damp(this.visualRoot.position.y, this.state === 'sit' ? 0.04 : 0, 12, step);
    this.visualRoot.position.z = THREE.MathUtils.damp(this.visualRoot.position.z, this.state === 'sit' ? 0.06 : 0, 12, step);
    this.visualRoot.rotation.x = this.forwardLean;
    this.visualRoot.rotation.z = this.turnLean;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    for (const material of this.materials) material.dispose();
    this.model.traverse(object => {
      const mesh = object as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) {
        if (!mesh.userData.sharedCharacterGeometry) mesh.geometry.dispose();
        mesh.skeleton.dispose();
      }
    });
    this.root.removeFromParent();
    this.root.clear();
  }
}

export function createPackCharacter(role: CharRole, opts: CharacterOpts = {}): CharacterHandle {
  const { template, random } = chooseTemplate(role, opts);
  return new PackedCharacter(template, role, opts, random);
}

/** Borrow all seven shared GPU bodies for upload while the loading cover is visible. */
export function createCharacterWarmup(): CharacterHandle[] {
  return [...templates.values()].map(template=>new PackedCharacter(template,'customer',{seed:417},seeded(417)));
}
