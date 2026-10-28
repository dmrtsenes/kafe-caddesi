import * as THREE from 'three';
import { box, cyl, mix, roundBox, shade, sph, torus } from '../world/Materials';
import { charLod } from '../core/Quality';
import { charLitMaterial, charUnlitMaterial } from './CharacterMaterials';
import { buildSkin, SKIN_LIT, SKIN_UNLIT, type SkinBucket, type SkinPart } from './CharacterSkin';
import type { AppearanceSpec } from './Appearance';

/**
 * Eklemli chibi iskelet kurucusu.
 *
 * root (ayaklar y=0) → bob → hips → torso → neck → head
 *                                  → shoulder → armUpper → armLower → hand
 *                           → legUpper → legLower → foot
 *
 * Karakter **+Z**'ye bakar. Tüm geometri `world/Materials` önbelleğinden
 * PAYLAŞIMLI gelir; uzuvlar iki tarafta da AYNI geometri argümanlarıyla kurulur
 * ki önbellek tutsun.
 *
 * Kurulumun SONUNDA tüm parçalar tek `SkinnedMesh`'e indirilir
 * (`CharacterSkin.buildSkin`) — karakter başına 2 çizim çağrısı: ışıklı gövde +
 * ışıksız yüz. Eklem hiyerarşisi ve animatörün eriştiği düğümler (torsoMesh,
 * göz/kaş/ağız, ponytail...) `Bone` olarak aynen kalır.
 */

/* ------------------------------------------------------- iskelet ölçüleri */

export const NOMINAL_HEIGHT = 1.75;

/* ================================================================== *
 *  LOFT — profil eğrisinden TEK PARÇA dökme yüzey
 *
 *  Karakter modellerinde gövde, kol ve pantolon PRİMİTİF MONTAJI değil,
 *  profili boyunca yarıçapı değişen TEK sürekli yüzeylerdir. "Kutu gibi"
 *  okunmanın asıl panzehiri bu — elipsoit yığmak da yetmiyor, çünkü
 *  parçaların birleşim çizgileri silüette kalıyor. Loft, bir dikey profil
 *  eğrisini eliptik kesitlerle döndürür: omuz yuvarlanması, bel
 *  toparlanması, etek kıvrımı tek geometride akar. Kutup uçları
 *  yelpazeyle kapatılır, normaller paylaşımlı vertexlerden pürüzsüz çıkar.
 *
 *  Önbellek modül ömürlüdür ve profil sayısı sabittir (≈8) — Materials
 *  önbelleğiyle aynı sözleşme: paylaşılır, asla dispose edilmez.
 * ================================================================== */

interface LoftRing {
  y: number;
  r: number;
}

const loftCache = new Map<string, THREE.BufferGeometry>();

function loft(rings: LoftRing[], radial: number, zRatio: number): THREE.BufferGeometry {
  const key = rings.map((q) => `${q.y.toFixed(3)}:${q.r.toFixed(3)}`).join('|') + `#${radial}#${zRatio}`;
  let g = loftCache.get(key);
  if (g) return g;

  const n = rings.length;
  const pos: number[] = [];
  for (let i = 0; i < n; i++) {
    const { y, r } = rings[i];
    for (let a = 0; a < radial; a++) {
      const t = (a / radial) * Math.PI * 2;
      pos.push(Math.cos(t) * r, y, Math.sin(t) * r * zRatio);
    }
  }
  // kutup merkezleri (üst = ilk halka, alt = son halka)
  const topPole = pos.length / 3;
  pos.push(0, rings[0].y, 0);
  const botPole = pos.length / 3;
  pos.push(0, rings[n - 1].y, 0);

  /**
   * SARIM YÖNÜ DIŞA (ölçülerek doğrulandı): halka açısı +X'ten +Z'ye
   * artar, halkalar yukarıdan aşağı dizilir. a=0 kolonundaki dörtgen için
   * (üst-a, üst-a2, alt-a) üçgeninin çapraz çarpımı +X verir — yüzey
   * dışarı bakar. İlk sürüm ters sarılıydı: computeVertexNormals bütün
   * gövdeyi içe dönük normallerle dolduruyor ve karakterler "buruşmuş"
   * görünüyordu (lineup3 karesi).
   */
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let a = 0; a < radial; a++) {
      const a2 = (a + 1) % radial;
      const r0 = i * radial;
      const r1 = (i + 1) * radial;
      idx.push(r0 + a, r0 + a2, r1 + a, r0 + a2, r1 + a2, r1 + a);
    }
  }
  for (let a = 0; a < radial; a++) {
    const a2 = (a + 1) % radial;
    idx.push(topPole, a2, a); // üst kapak +Y'ye bakar
    const base = (n - 1) * radial;
    idx.push(botPole, base + a, base + a2); // alt kapak -Y'ye bakar
  }

  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  loftCache.set(key, g);
  return g;
}

/** Gövde (gömlek) profili — torsoBreath yereli. Omuz yuvarlanır, bel toparlanır. */
function torsoLoft(): THREE.BufferGeometry {
  return loft(
    [
      { y: 0.26, r: 0.02 },
      { y: 0.245, r: 0.1 },
      { y: 0.19, r: 0.175 },
      { y: 0.13, r: 0.225 },
      { y: 0.02, r: 0.24 },
      { y: -0.1, r: 0.225 },
      { y: -0.2, r: 0.232 },
      { y: -0.26, r: 0.19 },
      { y: -0.3, r: 0.02 },
    ],
    22,
    0.64,
  );
}

/** Kalça (pantolon/şort) profili — hipsSkin yereli. */
function hipLoft(): THREE.BufferGeometry {
  return loft(
    [
      { y: 0.14, r: 0.02 },
      { y: 0.1, r: 0.16 },
      { y: 0.02, r: 0.215 },
      { y: -0.08, r: 0.2 },
      { y: -0.15, r: 0.145 },
      { y: -0.185, r: 0.02 },
    ],
    20,
    0.74,
  );
}

export const HIP_Y = 0.65;
const LEG_X = 0.115;
export const LEG_U = 0.3; // kalça → diz
export const LEG_L = 0.27; // diz → bilek
export const ANKLE_Y = 0.08;

const TORSO_Y = 0.055; // hips yerel
const TORSO_MESH_Y = 0.2;

export const SHOULDER_Y = 0.335; // torso yerel
const SHOULDER_X = 0.245;
const ARM_U = 0.24;
const ARM_L = 0.21;

const NECK_Y = 0.4; // torso yerel
const NECK_WORLD_Y = HIP_Y + TORSO_Y + NECK_Y;
const HEAD_Y = 0.06; // neck yerel
const HEAD_MESH_Y = 0.25;
const HEAD_H = 0.5;

// Yüz kafanın alt-orta bandına oturur (gözler kafa yüksekliğinin ~%43'ü):
// chibi oranın anahtarı geniş alın — şapkalar da bu sayede kaşları kapatmaz.
const FACE_Y = 0.2; // head yerel
const FACE_Z = 0.232;
export const BROW_Y = 0.108; // face yerel — gözle birleşip koyu leke olmasın
const EYE_Z_SCALE = 0.5;

export const PONYTAIL_REST_X = 0.5;

/* ------------------------------------------------------------------ tip */

export interface Rig {
  root: THREE.Group;
  bob: THREE.Bone;
  hips: THREE.Bone;
  torso: THREE.Bone;
  /**
   * Animatörün nefes için `scale.y` yazdığı hedef.
   *
   * TİP `Bone` (Task 10'da `Object3D`'den daraltıldı): bu altı alan
   * (torsoMesh, göz/kaş çiftleri, ağız) tek SkinnedMesh'te birer kemiktir —
   * bir parçayı tek başına ölçeklemenin yolu onu kendi kemiğine bağlamak.
   * `Object3D` tabanı yalnız `buildRigLegacy` bu alanlara `Mesh` yazdığı için
   * gerekiyordu ve iki kurucu AYNI `Rig` sözleşmesini döndürmek zorundaydı;
   * legacy gidince kısıt da gitti.
   */
  torsoMesh: THREE.Bone;
  neck: THREE.Bone;
  head: THREE.Bone;
  shoulderL: THREE.Bone;
  shoulderR: THREE.Bone;
  armUpperL: THREE.Bone;
  armLowerL: THREE.Bone;
  handL: THREE.Bone;
  armUpperR: THREE.Bone;
  armLowerR: THREE.Bone;
  handR: THREE.Bone;
  legUpperL: THREE.Bone;
  legLowerL: THREE.Bone;
  footL: THREE.Bone;
  legUpperR: THREE.Bone;
  legLowerR: THREE.Bone;
  footR: THREE.Bone;
  ponytail: THREE.Bone | null;
  /** İskelet sırası — Skeleton bu diziyle kurulur (Task 6). */
  bones: THREE.Bone[];
  /** Kemik hiyerarşisinin kökü (`bob`) — root bir Group olarak kalır. */
  boneRoot: THREE.Bone;
  carryAnchor: THREE.Object3D;
  handAnchor: THREE.Object3D;
  headTop: THREE.Object3D;
  /** Animatörün ölçek/konum yazdığı yüz kemikleri — bkz. `torsoMesh` notu. */
  eyeL: THREE.Bone;
  eyeR: THREE.Bone;
  browL: THREE.Bone;
  browR: THREE.Bone;
  mouth: THREE.Bone;
  /** Karakterin TEK çizilen nesnesi (iki materyal grubu = 2 çizim çağrısı). */
  skinned: THREE.SkinnedMesh;
  /** Kafa vertex aralığı [başlangıç, bitiş) — `setHeadTint` buraya yazar. */
  headRange: [number, number];
  /**
   * Öfke tintlemesi — `null` taban yüz rengine döner (Task 7).
   *
   * Renk `THREE.Color`, hex DEĞİL (brief'ten sapma — gerekçe animatörde):
   * tint sürekli bir lerp sonucu, hex'e yuvarlamak 8 bit sRGB'ye
   * niceleyip kapının renk payını yerdi.
   *
   * Task 10'a kadar OPSİYONELDİ çünkü `buildRigLegacy` rengi materyalde
   * (`headMat.color`) tutuyordu ve iki kurucu aynı `Rig` sözleşmesini
   * döndürmek zorundaydı; artık tek yol var, alan zorunlu.
   */
  setHeadTint: (color: THREE.Color | null) => void;
  /**
   * KARAKTERE AİT GPU KAYNAKLARINI BIRAKIR — sahiplik çapası (Task 7).
   *
   * Task 6'ya kadar bu iş karaktere özel `headMat` klonunun 'dispose' olayına
   * asılıydı: o materyal "bu rig öldü" anını karakter başına tam bir kez
   * işaretliyordu. Kafa global materyale katılınca klon kalmadı; çapa buraya
   * taşındı — aynı tetikleyici (`CharacterAnimator.dispose()`), aynı "tam bir
   * kez" garantisi (kapanış içinde bayrak), ama artık materyale asılı değil,
   * açıkça yazılı. Task 10'da legacy'nin materyal yolu silinince alan zorunlu
   * oldu; animatörün "çapa yok" dalı da onunla birlikte gitti.
   */
  disposeOwned: () => void;
  /**
   * Taban yüz rengi, three'nin ÇALIŞMA uzayında (doğrusal). Animatör öfke
   * lerp'ini buradan başlatır ve sonucu `setHeadTint` ile kafa vertex
   * aralığına yazar.
   *
   * `setHeadTint`in kapanışındaki `baseFace` ile AYNI NESNE — bilinçli.
   * Ayrıştırmak iki taban renk kaynağı doğurur ve tint sessizce sapar.
   */
  headBaseColor: THREE.Color;
  /** Kolların dinlenme açıklığı (girth'e göre artar). */
  armRestZ: number;
  height: number;
  meshCount: number;
}

/**
 * Eklem düğümü. `THREE.Bone`, `Object3D`'den türer ve
 * `position`/`rotation`/`scale` API'si `Group`'la birebir aynıdır — bu
 * yüzden animatörün eklem yazan satırları bu geçişten etkilenmez.
 * Toplanan dizi Skeleton'ın kemik sırasını belirler.
 */
function joint(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  name = '',
  bones?: THREE.Bone[],
): THREE.Bone {
  const b = new THREE.Bone();
  b.position.set(x, y, z);
  if (name) b.name = name;
  parent.add(b);
  bones?.push(b);
  return b;
}

function anchor(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

/* --------------------------------------------------------- parça tarifleri
 *
 * TEK KURUCU (Task 10). Task 5-9b boyunca burada iki kurucu yan yana
 * yaşıyordu: `buildRigLegacy` (katı mesh hiyerarşisi, rengi materyalde) ve
 * `buildRig` (tek SkinnedMesh, rengi vertex özniteliğinde). Kod tekrarı
 * bilinçliydi — `tools/rig-identity.js` ikisini gerçekten karşılaştırabilsin
 * diye birbirinden bağımsız kalmak zorundaydılar. Kapı 240 karede, 160 vakada,
 * iki LOD dalında yeşil yandı (maxJointError 0, maxVertexError 7,7e-8,
 * countMismatches/colorMismatches/shadowMismatches 0) ve eski taraf borç
 * haline geldi; özdeşliğin sayısal kanıtı planın Ölçüm Kütüğü'nde ve commit
 * geçmişinde duruyor. Kapı da karşılaştırmalı kipten regresyon kipine döndü.
 *
 * `litPart`/`unlitPart` MODÜL SEVİYESİNDE, `buildRig`in içine gömülü DEĞİL:
 * `buildHat`/`buildHair`/`buildOver`/`buildBack` de aynı iki yardımcıyı
 * çağırıyor (şapka/saç/üstlük/sırt eşyası kurucunun DIŞINDA, `add` enjekte
 * edilen ayrı fonksiyonlar). İkisi de sıfır closure durumu taşır — yalnızca
 * global `charLitMaterial()`/`charUnlitMaterial()` çağırıyorlar; renk artık
 * burada değil, `CharacterSkin.buildSkin`in çağırdığı `linearColor`den
 * yazılıyor.
 */

/**
 * Işıklı parça TARİFİ. Dönen `Mesh` sahne grafiğine GİRMEZ (Task 6): tek
 * `SkinnedMesh`'e birleşecek parçanın geometrisini, materyalini ve yerel
 * dönüşümünü (position/rotation/scale) taşıyan bir taşıyıcıdır. Mesh
 * biçiminde kalmasının sebebi çağrı siteleri: onlarca yerde dönen nesneye
 * `rotation`/`scale` yazılıyor, kendi tip icat etmek bu sitelerin hepsini
 * dokunulur kılardı.
 *
 * `geo` PAYLAŞIMLI KAYNAK — HİÇ KLONLANMAZ (Task 9b, fix round 1'de Adım
 * B'yle pekişti). `color` `userData`'ya iz olarak bırakılır; `add()` onu
 * okuyup `SkinPart`e taşır. `CharacterSkin.buildSkin` `geo`nun
 * `position`/`normal`/`uv` özniteliklerini DOĞRUDAN okuyup birleşik
 * tampona yazar — aradan hiçbir `BufferGeometry` klonu geçmez. Adım A'ya
 * kadar burada `paintGeometry` klonluyordu, `normalize()` AYNI parçayı
 * ikinci kez klonluyordu (doğuş başına ölçülmüş ~280 KB çöpün kaynağı);
 * Adım A tek klona indirdi, Adım B o son klonu da kaldırdı.
 *
 * `castShadow`/`receiveShadow` BİLİNÇLİ OLARAK YOK: tek birleşik mesh'in tek
 * gölge bayrağı var, parça başına gölge diye bir şey kalmadı (karar ve
 * gerekçesi CharacterSkin.ts `buildSkin` içinde).
 */
function litPart(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, charLitMaterial());
  m.position.set(x, y, z);
  m.userData.color = color;
  return m;
}

/** Işıksız parça tarifi (yüz) — eski `detail(basic(...))` karşılığı. */
function unlitPart(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, charUnlitMaterial());
  m.position.set(x, y, z);
  m.userData.color = color;
  return m;
}

/**
 * Parçanın hangi materyal grubuna gireceği, taşıyıcının materyalinden.
 *
 * ÜÇÜNCÜ BİR DAL YOK (Task 7): karakterin kendi materyali kalmadı, kafa da
 * global ışıklı materyale katıldı. Bilinmeyen bir materyal buraya düşerse
 * sessizce bir kovaya kırpmak yerine patlıyor — o durum "karaktere özel
 * materyal geri geldi" demektir ve karşılığı fazladan bir çizim çağrısıdır.
 */
function bucketOf(m: THREE.Mesh): SkinBucket {
  const material = m.material;
  if (material === charUnlitMaterial()) return SKIN_UNLIT;
  if (material === charLitMaterial()) return SKIN_LIT;
  throw new Error('parça materyali global ikilinin dışında — karaktere özel materyal fazladan çizim çağrısı demek');
}

/**
 * Parçanın rengi — `litPart`/`unlitPart`in `userData`ya bıraktığı iz
 * (Task 9b). Geometri artık paylaşımlı olduğu için rengi TAŞIYACAK yer
 * kalmadı (eskiden klonun `color` özniteliğindeydi); mesh yalnız `add()`e
 * kadar yaşayan bir taşıyıcı olduğundan `userData` en ucuz iz bırakma yeri
 * — sahneye hiç girmiyor, `add()` okur okumaz mesh çöpe gider.
 */
function colorOf(m: THREE.Mesh): number {
  const c = m.userData.color as number | undefined;
  if (typeof c !== 'number') throw new Error('parça rengi yok — litPart/unlitPart atlandı mı?');
  return c;
}

/** Etkin görünürlük — renderer'ın gördüğü değer, ata zinciri dahil. */
function visibleInChain(o: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}

/**
 * Parça kaydı — kurucunun parçaları `buildSkin`e teslim etme yolu.
 *
 * `void` DÖNMESİ BİLİNÇLİ. `add()` parçanın yerel dönüşümünü ÇAĞRI ANINDA
 * yakalar (Task 9b'ye kadar bunu geometriye pişiriyordu, şimdi `m.matrix`i
 * klonlayıp `SkinPart.local`e yazıyor — YAKALAMA ANI aynı, hedefi değişti);
 * kayıttan SONRA `m.scale`/`m.rotation` yazmak bu yüzden hâlâ sessizce
 * etkisiz kalır. Eski sahne-grafiği yolunda mesh sahnede yaşadığı için bu
 * tuzağa düşmek kolaydı ve altı çağrı sitesi (üst kol, el, uyluk, ayakkabı
 * burnu, kulaklık, allık) gerçekten öyle yazılmıştı — ilk koşuda özdeşlik
 * kapısı bunu 144.476 vertex sapmasıyla yakaladı. Dönüşü kaldırmak tuzağı
 * tip düzeyinde kapatıyor: dönüşüm artık `add`'DEN ÖNCE yazılmak zorunda.
 *
 * Ebeveyn `Bone`: tek SkinnedMesh'te parçanın konumunu tutacak ara düğüm
 * kalmadı, her parça doğrudan bir kemiğe bağlanır.
 *
 * `head`: öfke tintlemesinin boyayacağı kafa kabuğu (Task 7). Tek çağrı
 * sitesi var (kafa mesh'i); şapka/saç kurucuları bu argümanı hiç vermez.
 */
type PartFn = (bone: THREE.Bone, m: THREE.Mesh, head?: boolean) => void;

/** Şapkalar — parçaları `add` ile kaydeder, sahneye hiçbir mesh koymaz. */
function buildHat(head: THREE.Bone, spec: AppearanceSpec, add: PartFn): void {
  const p = spec.pal;
  const hatColor = p.hat;
  const darkColor = shade(p.hat, 0.78);

  const dome = (
    r: number,
    sx: number,
    sy: number,
    sz: number,
    color: number,
    y: number,
    z = 0,
  ): THREE.Mesh => {
    const d = litPart(sph(r, 18, 13), color, 0, y, z);
    d.scale.set(sx, sy, sz);
    return d;
  };

  switch (spec.hat) {
    case 'none':
      break;

    case 'capBack': {
      add(head, dome(0.268, 0.97, 0.72, 0.95, hatColor, 0.35, 0.01));
      const visor = litPart(roundBox(0.29, 0.045, 0.2, 0.02), darkColor, 0, 0.335, -0.28);
      visor.rotation.x = -0.16;
      add(head, visor);
      break;
    }

    case 'beanie':
      add(head, dome(0.272, 0.97, 0.86, 0.95, hatColor, 0.36));
      add(head, dome(0.276, 0.98, 0.34, 0.96, darkColor, 0.345));
      break;

    case 'visor': {
      add(head, dome(0.268, 0.98, 0.4, 0.96, hatColor, 0.38));
      const brim = litPart(roundBox(0.37, 0.038, 0.17, 0.016), darkColor, 0, 0.405, 0.265);
      brim.rotation.x = 0.09;
      add(head, brim);
      break;
    }

    case 'bandana':
      add(head, dome(0.268, 0.98, 0.54, 0.96, hatColor, 0.37));
      add(head, litPart(sph(0.075, 8, 6), hatColor, 0, 0.38, -0.28));
      break;

    case 'flatCap': {
      add(head, dome(0.268, 0.98, 0.5, 0.96, hatColor, 0.38, -0.02));
      const brim = litPart(roundBox(0.35, 0.038, 0.16, 0.016), darkColor, 0, 0.408, 0.25);
      brim.rotation.x = 0.08;
      add(head, brim);
      break;
    }

    case 'helmet': {
      const shell = litPart(sph(0.31, 16, 12), hatColor, 0, 0.4, -0.01);
      shell.scale.set(0.96, 0.72, 0.98);
      add(head, shell);
      add(head, litPart(box(0.4, 0.06, 0.13), darkColor, 0, 0.31, 0.235));
      break;
    }

    case 'straw':
      add(head, litPart(cyl(0.46, 0.46, 0.035, 20), hatColor, 0, 0.42, 0));
      add(head, litPart(cyl(0.2, 0.235, 0.17, 16), hatColor, 0, 0.5, 0));
      break;

    case 'sweatband':
      add(head, dome(0.272, 0.98, 0.28, 0.96, hatColor, 0.35));
      break;

    case 'scarf':
      add(head, litPart(roundBox(0.55, 0.5, 0.46, 0.18, 4), hatColor, 0, 0.27, -0.09));
      add(head, litPart(sph(0.085, 8, 6), hatColor, 0, 0.06, -0.29));
      break;

    case 'hood': {
      const shell = litPart(sph(0.33, 16, 12), hatColor, 0, 0.27, -0.1);
      shell.scale.set(1.0, 1.02, 0.94);
      add(head, shell);
      add(head, litPart(torus(0.235, 0.055, 6, 12), shade(p.hat, 0.72), 0, 0.22, 0.15));
      break;
    }
  }
}

/** Saçlar — at kuyruğu kendi kemiğini kurar ve döner (yürürken sallanır). */
function buildHair(
  head: THREE.Bone,
  spec: AppearanceSpec,
  add: PartFn,
  bones: THREE.Bone[],
): THREE.Bone | null {
  const hairColor = spec.pal.hair;

  const cap = (r: number, sy: number, y: number, z = -0.01): THREE.Mesh => {
    /**
     * Saç kubbesi 12×9 → 18×13: kafayla AYNI yüzeyde oturur, kafa
     * pürüzsüzleşince düşük çözünürlüklü kubbe faseta olarak sırıtıyordu.
     */
    const d = litPart(sph(r, 18, 13), hairColor, 0, y, z);
    d.scale.set(0.975, sy, 0.96);
    return d;
  };

  switch (spec.hair) {
    case 'none':
      return null;

    case 'fringe':
      add(head, litPart(roundBox(0.5, 0.1, 0.33, 0.045, 3), hairColor, 0, 0.3, -0.08));
      return null;

    case 'short':
      add(head, cap(0.266, 0.62, 0.355));
      return null;

    case 'mop':
      add(head, cap(0.278, 0.74, 0.35));
      add(head, litPart(roundBox(0.44, 0.1, 0.12, 0.04, 3), hairColor, 0, 0.3, 0.2));
      return null;

    case 'bun':
      add(head, cap(0.266, 0.64, 0.355));
      add(head, litPart(sph(0.135, 12, 9), hairColor, 0, 0.45, -0.26));
      return null;

    default: {
      // At kuyruğu — kendi pivotu var, yürürken sallanır.
      add(head, cap(0.266, 0.64, 0.355));
      const pivot = joint(head, 0, 0.34, -0.21, 'ponytail', bones);
      pivot.rotation.x = PONYTAIL_REST_X;
      const tail = litPart(cyl(0.078, 0.032, 0.36, 12), hairColor, 0, -0.17, 0);
      add(pivot, tail);
      return pivot;
    }
  }
}

/**
 * Üst giysi ve gövde süsleri (önlük, bant, düğme, kravat, kamera...).
 *
 * ANA KABUKLAR FIÇI (2026-08-19): ceket/yelek/hırka kabukları eskiden
 * roundBox'tı ve üniformalı personelde gövdenin görünen yüzeyi tam olarak
 * o kutuydu. Hepsi elipsoide çevrildi — gömlek fıçısıyla aynı dil.
 * Küçük detaylar (fermuar şeridi, düğme, cep) kutu kalabilir: minicikler
 * ve kavisli yüzeye yaslanmaları fark edilmiyor.
 */
function buildOver(torsoSkin: THREE.Bone, spec: AppearanceSpec, add: PartFn): void {
  const p = spec.pal;
  const overColor = p.over;
  const altColor = p.overAlt;

  switch (spec.over) {
    case 'none':
      break;

    case 'vest':
      const shell0 = litPart(torsoLoft(), overColor, 0, 0.2, 0);
      shell0.scale.set(1.045, 0.8, 1.1);
      add(torsoSkin, shell0);
      break;

    case 'jacket':
      const shell1 = litPart(torsoLoft(), overColor, 0, 0.2, 0);
      shell1.scale.set(1.065, 0.93, 1.13);
      add(torsoSkin, shell1);
      break;

    case 'chef':
      const shell2 = litPart(torsoLoft(), overColor, 0, 0.21, 0);
      shell2.scale.set(1.065, 0.93, 1.1);
      add(torsoSkin, shell2);
      break;

    case 'hoodie':
      const shell3 = litPart(torsoLoft(), overColor, 0, 0.2, 0);
      shell3.scale.set(1.075, 0.95, 1.14);
      add(torsoSkin, shell3);
      // Kapüşon inikse ensede yumru olur; hırsızda kapüşon kafada olduğu için eklenmez.
      if (spec.hat !== 'hood') {
        add(torsoSkin, litPart(roundBox(0.34, 0.2, 0.2, 0.08), shade(p.over, 0.85), 0, 0.35, -0.17));
      }
      break;

    case 'suit':
      const shell4 = litPart(torsoLoft(), overColor, 0, 0.2, 0);
      shell4.scale.set(1.065, 0.93, 1.1);
      add(torsoSkin, shell4);
      break;

    case 'cardigan':
      const shell5 = litPart(torsoLoft(), overColor, 0, 0.2, 0);
      shell5.scale.set(1.06, 0.9, 1.13);
      add(torsoSkin, shell5);
      add(torsoSkin, litPart(box(0.07, 0.38, 0.03), altColor, 0, 0.2, 0.175));
      break;

    case 'dress':
      const shell6 = litPart(torsoLoft(), overColor, 0, 0.21, 0);
      shell6.scale.set(1.02, 0.86, 1.07);
      add(torsoSkin, shell6);
      break;

    case 'patterned': {
      /**
       * Renk bloklu tişört: gövde loftu tam boy (overColor) + üstüne
       * omuz-yaka bölgesini saran KISALTILMIŞ loft (altColor). İkisi de
       * aynı silüet ailesinden — eski "üst üste iki balon" görüntüsü yok.
       */
      const teeBody = litPart(torsoLoft(), overColor, 0, 0.2, 0);
      teeBody.scale.set(1.02, 0.99, 1.04);
      add(torsoSkin, teeBody);
      const yoke = litPart(torsoLoft(), altColor, 0, 0.14, 0);
      yoke.scale.set(1.04, 0.42, 1.08);
      add(torsoSkin, yoke);
      break;
    }
  }

  // Reflektif / kontrast bantlar — gövde loftunu saran ince kuşaklar
  for (let i = 0; i < spec.bands; i++) {
    const band = litPart(torsoLoft(), altColor, 0, 0.2, 0);
    band.scale.set(1.03, 1.0, 1.06);
    // Yalnız dar bir y dilimi görünür: kuşak, loftun o yükseklikteki
    // kesitini aynen izler (ölçek hilesi yerine kırpma kuşağı daha iyi
    // olurdu ama iki ekstra profil noktasına değmez — bant incecik).
    band.scale.y = 0.09;
    band.position.y = 0.14 + i * 0.12;
    add(torsoSkin, band);
  }

  if (spec.buttons) {
    // Çift sıra düğme
    add(torsoSkin, litPart(box(0.032, 0.3, 0.025), altColor, -0.075, 0.2, 0.17));
    add(torsoSkin, litPart(box(0.032, 0.3, 0.025), altColor, 0.075, 0.2, 0.17));
  }

  if (spec.tie) {
    add(torsoSkin, litPart(box(0.06, 0.24, 0.025), altColor, 0, 0.22, 0.175));
  }

  if (spec.stripedShirt) {
    add(torsoSkin, litPart(box(0.26, 0.06, 0.3), altColor, 0, 0.375, 0.08));
  }

  const lod = charLod();
  if (spec.apron) {
    /**
     * ÖNLÜK KAVİSLİ KUMAŞ, LEVHA DEĞİL (2026-08-19). Eski roundBox göğsün
     * tamamını kaplayan köşeli bir plakaydı — gövde fıçıya dönünce en
     * "kutu" duran parça o kaldı. Elipsoit dilimi fıçının önüne yaslanır:
     * kenarları gövdeye sarılıyor okunur, tepe/alt kenarı yumuşak.
     * Askılar da inceldi ve omuza doğru daralıyor (eski hâli iki kare
     * topuz gibiydi).
     */
    const apronColor = p.apron;
    /**
     * Göğüslüğün ön yüzü fıçının önünden (z 0,155) TAŞMALI, yoksa gövdenin
     * içinde kaybolur — ilk denemede tam bu oldu (ön yüz 0,094'te kaldı).
     * Merkez öne + z ölçeği büyütüldü: ön yüz 0,05 + 0,26·0,5 = 0,18.
     */
    const bib = litPart(sph(0.26, 18, 14), apronColor, 0, 0.17, 0.05);
    bib.scale.set(0.82, 0.9, 0.5);
    add(torsoSkin, bib);
    if (!lod) {
      const strapL = litPart(cyl(0.022, 0.028, 0.2, 8), apronColor, -0.115, 0.38, 0.1);
      strapL.rotation.x = -0.5;
      strapL.rotation.z = 0.12;
      add(torsoSkin, strapL);
      const strapR = litPart(cyl(0.022, 0.028, 0.2, 8), apronColor, 0.115, 0.38, 0.1);
      strapR.rotation.x = -0.5;
      strapR.rotation.z = -0.12;
      add(torsoSkin, strapR);
    }
    if (spec.pocketLogo && !lod) {
      const pocket = litPart(sph(0.07, 12, 9), p.accent, 0, 0.22, 0.175);
      pocket.scale.set(0.95, 0.8, 0.4);
      add(torsoSkin, pocket);
    }
    if (spec.pencil && !lod) {
      const pen = litPart(cyl(0.015, 0.015, 0.12, 6), 0xf2c94c, 0.12, 0.3, 0.19);
      pen.rotation.x = 0.2;
      add(torsoSkin, pen);
    }
  }

  if (spec.nameTag) {
    add(torsoSkin, litPart(box(0.1, 0.055, 0.02), 0xf7f4ee, 0.14, 0.27, 0.18));
  }

  if (spec.camera) {
    const strap = litPart(torus(0.17, 0.02, 5, 12), 0x3a3f46, 0, 0.37, 0.01);
    strap.rotation.x = Math.PI / 2;
    add(torsoSkin, strap);
    const camBody = litPart(sph(0.07, 12, 9), p.accent, 0, 0.18, 0.19);
    camBody.scale.set(0.95, 0.6, 0.42);
    add(torsoSkin, camBody);
    const lens = litPart(cyl(0.026, 0.03, 0.03, 10), shade(p.accent, 0.55), 0, 0.18, 0.215);
    lens.rotation.x = Math.PI / 2;
    add(torsoSkin, lens);
  }
}

/** Sırt eşyası — kasa, sırt çantası, teslimat kutusu, omuz çantası. */
function buildBack(torsoSkin: THREE.Bone, spec: AppearanceSpec, add: PartFn): void {
  const p = spec.pal;
  switch (spec.back) {
    case 'none':
      break;

    case 'crate': {
      // Kerem'in sırtındaki boş kasa.
      add(torsoSkin, litPart(box(0.33, 0.27, 0.19), 0xb07a48, 0, 0.23, -0.23));
      add(torsoSkin, litPart(box(0.35, 0.05, 0.21), shade(0xb07a48, 0.8), 0, 0.37, -0.23));
      break;
    }

    case 'backpack': {
      const pack = litPart(sph(0.26, 18, 14), p.accent, 0, 0.2, -0.22);
      pack.scale.set(0.73, 0.85, 0.5);
      add(torsoSkin, pack);
      const strapColor = shade(p.accent, 0.75);
      add(torsoSkin, litPart(box(0.06, 0.32, 0.035), strapColor, -0.15, 0.22, 0.17));
      add(torsoSkin, litPart(box(0.06, 0.32, 0.035), strapColor, 0.15, 0.22, 0.17));
      break;
    }

    case 'deliveryBox':
      add(torsoSkin, litPart(box(0.35, 0.33, 0.26), p.accent, 0, 0.29, -0.27));
      add(torsoSkin, litPart(box(0.36, 0.05, 0.27), shade(p.accent, 0.8), 0, 0.475, -0.27));
      break;

    case 'tote': {
      // Omuzda bez file çanta.
      add(torsoSkin, litPart(roundBox(0.23, 0.27, 0.12, 0.05), p.accent, 0.25, 0.02, -0.02));
      const strap = litPart(box(0.05, 0.42, 0.04), shade(p.accent, 0.82), 0.16, 0.22, 0.01);
      strap.rotation.z = -0.3;
      add(torsoSkin, strap);
      break;
    }
  }
}

/**
 * Karakter iskeleti kurucusu — çağıranların tek kapısı.
 *
 * SKİNNED YOL (Task 6) — TEK YOL (Task 10). Eski katı-mesh kurucusuna göre
 * dört fark; ölçülen kazanç karakter başına 60 çizim çağrısından 2'ye:
 *
 *  1) RENK (Task 5): palet renkleri materyal örnekleri yerine vertex
 *     özniteliğine yazılıyor (`CharacterSkin.buildSkin` içindeki `linearColor`
 *     çağrısı — Task 9b'ye kadar bu iş `paintGeometry` adlı, geometri
 *     KLONLAYAN bir fonksiyondu; bkz. madde 4).
 *  2) BİRLEŞTİRME (Task 6): hiçbir parça sahne grafiğine mesh olarak
 *     girmiyor. `add()` her parçanın yerel dönüşümünü `SkinPart.local`e
 *     kaydediyor, kurulumun sonunda `buildSkin` hepsini TEK `SkinnedMesh`'e
 *     indiriyor. Karakter başına ~41 mesh / 60 çizim çağrısı 2'ye iniyor
 *     (0 ışıklı gövde + kafa · 1 ışıksız yüz).
 *  3) TİNT (Task 7): öfke rengi karaktere özel bir materyal klonu yerine
 *     kafa VERTEX aralığına yazılıyor (`setHeadTint`) — karakterin kendi
 *     materyali kalmadı, üçüncü çizim çağrısı da onunla birlikte gitti.
 *  4) SIFIR ARA KLON (Task 9b, fix round 1 Adım A→B): `litPart`/
 *     `unlitPart`in geometrisi PAYLAŞIMLI kaynak — hiç klonlanmaz. `add()`
 *     yalnız yerel dönüşümü (`Matrix4`) ve rengi (`userData` üzerinden)
 *     `SkinPart`e taşır; `CharacterSkin.buildSkin` kaynağın
 *     `position`/`normal`/`uv`'sini DOĞRUDAN okuyup önceden tahsis edilmiş
 *     birleşik tampona yazar — aradan hiçbir `BufferGeometry` klonu geçmez.
 *     Adım A'dan önce parça başına İKİ klon vardı (burada + `normalize()`de);
 *     Adım A biri kaldırdı (ölçüldü: 120 doğuşta heap +33,7→ değişken, klon
 *     sayısı 68→34), Adım B kalanı da kaldırdı (klon sayısı 34→0).
 *
 * KATI SKINNING — sadakat neden kurulum gereği: bugün hiçbir vertex iki
 * eklem arasında paylaşılmıyor, her parça tam bir kemiğin çocuğu. Her vertex
 * eski ebeveyn kemiğine 1,0 ağırlıkla bağlanınca GPU'nun uyguladığı skinning
 * matrisi eski sahne grafiğinin uyguladığı dünya matrisiyle aynı çarpım olur.
 * Ağırlık boyama, deformasyon, sanatsal karar yok.
 *
 * EKLEM İÇİ STATİK BİRLEŞTİRME YOK ve gerekmiyor (Task 10'da silinen
 * `mergeStaticSiblings`): o, aynı ekleme bağlı statik kardeşleri malzeme
 * başına birleştiren bir çizim-çağrısı diyetiydi; burada zaten TÜM parçalar
 * tek geometriye giriyor.
 *
 * GEOMETRİ SAHİPLİĞİ (Task 5 fix round 1 — Critical; çapa Task 7'de, kapsamı
 * Task 9b'de değişti). `parts[i].geo` `world/Materials` önbelleğinden
 * PAYLAŞIMLI bir referans, hiç klonlanmıyor bile (Adım B) — `buildRig`
 * hiçbir parça-geometrisini kişisel olarak sahiplenmiyor, dolayısıyla
 * `parts` için ayrı bir dispose turu YOK (Task 9b'ye kadar vardı:
 * `paintGeometry`in ürettiği kişisel klonu bırakıyordu). Serbest
 * bırakılacak tek şey `buildSkin`in ürettiği BİRLEŞİK geometri ve
 * `Skeleton`in kemik dokusu (karakter başına ayrı bir DataTexture —
 * bırakılmazsa `info.memory.textures` sürekli tırmanır); ikisini bırakan
 * bağ `headMat`in 'dispose' olayı DEĞİL — o materyal kalmadı — açıkça
 * yazılmış `disposeOwned` kapanışı; çağıran yine
 * `CharacterAnimator.dispose()`.
 */
export function buildRig(spec: AppearanceSpec): Rig {
  const p = spec.pal;
  const g = spec.girthMul;
  const gz = 1 + (g - 1) * 0.8;
  const limbG = 1 + (g - 1) * 0.45;
  const lod = charLod();

  const parts: SkinPart[] = [];
  /**
   * PARÇA KAYDI — eski `add(parent, mesh)`'in yerini alır. `m` sahne
   * grafiğine GİRMEZ; yalnız bir tarif taşır.
   *
   * GEOMETRİ HİÇ KLONLANMIYOR (Task 9b): `m.geometry` `litPart`/
   * `unlitPart`den gelen PAYLAŞIMLI kaynak — burada okunur, asla mutasyona
   * uğratılmaz. Yerel dönüşüm (`m.matrix`) bir klon olarak saklanır;
   * geometriye "pişirilmesi" diye bir şey artık YOK — `CharacterSkin.
   * buildSkin` kaynağın özniteliklerini doğrudan okuyup dönüştürüp önceden
   * tahsis edilmiş birleşik tampona yazıyor (kemiğin kendi dünyası da orada
   * ekleniyor). Eskiden burada `m.geometry.applyMatrix4(m.matrix)` ile
   * ANINDA pişiriliyordu — bu, `paintGeometry`in ürettiği kişiye özel
   * klonun üstündeydi (fix round 1 Adım A bunu `normalize()`ye tek klona
   * indirdi, Adım B o klonu da kaldırdı); dönüşüm bugün yalnız bir
   * `Matrix4` olarak taşınıyor, hiçbir geometriye hiçbir zaman yazılmıyor.
   */
  const add: PartFn = (bone, m, head = false) => {
    /**
     * GİZLİ PARÇA HİÇ KAYDEDİLMEZ (Task 10 — Task 6'dan devreden ölü vertex
     * temizliği). Ata zincirinde `visible=false` varsa (bugün tek örnek: sade
     * LOD dalında kaşlar) parça tampona GİRMEZ.
     *
     * Task 6-9b arası vertex'ler tampona giriyor, yalnız üçgenleri (index
     * katkısı) atlanıyordu: özdeşlik kapısının `countMismatches` ölçütü iki
     * tarafın vertex SAYISININ eşit olmasını istiyordu ve eski rig kaş
     * mesh'ini `visible=false` olarak KURUYORDU. Bedeli karakter başına 442
     * ölü vertex (2 × 221, `roundBox(0.1, 0.026, 0.028, 0.011)` → 17×13
     * küre) ≈ 30 KB VRAM — tam da LOD'un hizmet ettiği zayıf cihazlarda.
     * Karşılaştırmalı kip Task 10'da kalktı, kısıt da kalktı; sağlık denetimi
     * artık yalnız index'in referans verdiği vertex'leri sayıyor ve
     * referanssız vertex'i SAPMA olarak bildiriyor (bkz. tools/rig-identity.js
     * `deadVertices`/`sourceDeadVertices`).
     *
     * Kemik ve `visible=false` bayrağı YERİNDE KALIR: animatör her karede
     * kaşların konum/ölçeğini yazıyor (kaldırılırsa null erişimi) ve bayrak
     * "bu dalda çizilmiyor" kararının okunabilir kaydı.
     */
    if (!visibleInChain(bone)) return;
    m.updateMatrix();
    parts.push({
      geo: m.geometry,
      local: m.matrix.clone(),
      color: colorOf(m),
      bone,
      bucket: bucketOf(m),
      head,
    });
  };

  const root = new THREE.Group();
  root.name = 'char';
  const bones: THREE.Bone[] = [];
  const bob = joint(root, 0, 0, 0, 'bob', bones);
  const hips = joint(bob, 0, HIP_Y, 0, 'hips', bones);

  const hipsSkin = joint(hips, 0, 0, 0, '', bones);
  hipsSkin.scale.set(g, 1, gz);
  /** Kalça: loft eyer — bel gömleğin içine girer, bacaklar alt kubbeden çıkar. */
  add(hipsSkin, litPart(hipLoft(), p.pants));

  const torso = joint(hips, 0, TORSO_Y, 0, 'torso', bones);
  const torsoSkin = joint(torso, 0, 0, 0, '', bones);
  torsoSkin.scale.set(g, 1, gz);
  /**
   * ANİMATÖRÜN ÖLÇEK YAZDIĞI HEDEFLER KEMİK OLDU (nefes, iki göz, iki kaş,
   * ağız). Tek SkinnedMesh'te bir parçayı tek başına ölçeklemenin yolu onu
   * kendi kemiğine bağlamaktır — kemik ölçeği skinning matrisine dahildir,
   * etkisi eski sahne grafiğindeki mesh ölçeğiyle aynı. Konum artık kemikte
   * olduğu için parça ofset ALMAZ.
   */
  const torsoBreath = joint(torsoSkin, 0, TORSO_MESH_Y, 0, 'torsoBreath', bones);
  /**
   * GÖVDE = LOFT (2026-08-19, üçüncü tur). Kutu → elipsoit → LOFT.
   * Elipsoit bile "yığılmış balon" okunuyordu çünkü omuz/bel geçişleri
   * yok, tek şişkin form vardı. Loft profili gerçek giysi silüeti verir:
   * yakalık → omuz yuvarlanması → göğüs → bel → etek kıvrımı, tek yüzey.
   */
  const torsoMesh = litPart(torsoLoft(), p.shirt);
  add(torsoBreath, torsoMesh);

  buildOver(torsoSkin, spec, add);
  buildBack(torsoSkin, spec, add);

  if (spec.over === 'dress') {
    add(hipsSkin, litPart(cyl(0.22, 0.38, 0.42, 16), p.over, 0, -0.13, 0));
    add(hipsSkin, litPart(sph(0.04, 6, 5), p.overAlt, 0.13, -0.1, 0.28));
    add(hipsSkin, litPart(sph(0.04, 6, 5), p.overAlt, -0.16, -0.22, 0.24));
  }

  if (spec.keyring) {
    const ring = litPart(torus(0.05, 0.014, 5, 10), spec.role === 'player' ? p.accent : 0xd9d3c4, 0.2, -0.03, 0.11);
    ring.rotation.y = 0.6;
    add(hipsSkin, ring);
  }

  /* ------------------------------------------------------------- kafa */

  const neck = joint(torso, 0, NECK_Y, 0, 'neck', bones);
  const head = joint(neck, 0, HEAD_Y, 0, 'head', bones);
  // Mobil ekranda okunaklı ama oyuncak bebek oranına kaçmayan stil ölçeği.
  const HEAD_STYLE_SCALE = 1.06;
  head.scale.set(
    spec.headMul * HEAD_STYLE_SCALE * (1 + (g - 1) * 0.3),
    spec.headMul * HEAD_STYLE_SCALE,
    spec.headMul * HEAD_STYLE_SCALE * (1 + (g - 1) * 0.25),
  );

  /**
   * KAFA ARTIK GLOBAL MATERYALDE (Task 7) — çizim çağrısı 3'ten 2'ye indi.
   *
   * Task 6'ya kadar kafa karaktere özel bir materyal klonuyla çiziliyordu,
   * çünkü `CharacterAnimator.apply` öfkede o klonun rengini mutasyona
   * uğratıyordu; global `charLitMaterial()`e katılsaydı bir karakterin öfkesi
   * sahnedeki HERKESİ kızartırdı. Tint artık kafa VERTEX aralığına yazılıyor
   * (`setHeadTint`, aşağıda), yani mutasyon karaktere özel kalıyor ve kafa
   * gövdeyle aynı gruba giriyor — üçüncü materyal grubu kalktı.
   *
   * ÇİFTE RENK TUZAĞI KAPALI (Task 6'nın bıraktığı uyarı): karaktere özel
   * materyal artık YOK, kafa da diğer parçalar gibi `litPart` ile kuruluyor —
   * renk yalnız vertex özniteliğinde, çarpan (global materyalin rengi)
   * varsayılan beyaz. "headMat.color'ı beyaza çek" adımına gerek kalmadı
   * çünkü beyazlatılacak materyal ortadan kalktı.
   */
  /**
   * KAFA ÇÖZÜNÜRLÜĞÜ seg 2 → 5 ("Minecraft gibi görünüyor" düzeltmesinin
   * kalbi). Kafa karakterin ekrandaki alanının yarısıdır ve 16×12'lik
   * kürede yamuk yüzeyler Gouraud bantlarıyla FASETA olarak okunuyordu —
   * kutu OLMAYAN bir kafa bile köşeli görünüyordu. 28×21'de yüzey
   * kesintisiz. Bedel kafa başına +426 vertex; ölçüm için aşağıdaki
   * "vertex bütçesi" notuna bak.
   */
  /**
   * KAFA SAF KÜRE:
   * Kafa dev bir KÜREDİR — karakterin tüm y-aralığı kadar. Yuvarlatılmış
   * kutu, köşe eğrisi ne kadar büyürse büyüsün diyagonallerde düzleşiyor
   * ve "kutudan yapılmış" okunuyordu. Elipsoit (ölçekli küre) her yönde
   * kesintisiz eğri: kutu okuması yapısal olarak imkânsız.
   */
  const headMesh = litPart(sph(0.25, 24, 18), p.face, 0, HEAD_MESH_Y, 0);
  headMesh.scale.set(0.98, 1.0, 0.94);
  add(head, headMesh, true);

  const ponytail = buildHair(head, spec, add, bones);
  buildHat(head, spec, add);

  // Yüz — göz/kaş/ağız keskin okunsun diye ışıksız `charUnlitMaterial`.
  const face = joint(head, 0, FACE_Y, FACE_Z, '', bones);
  const eyeWhiteGeo = sph(0.046, 12, 9);
  const irisGeo = sph(0.021, 10, 8);
  const eyeL = joint(face, -0.091, 0.014, 0.012, 'eyeL', bones);
  const eyeR = joint(face, 0.091, 0.014, 0.012, 'eyeR', bones);
  /**
   * GÖZ YASSILTMASI KEMİKTE KALIR (brief'ten sapma — brief geometriye
   * pişirilmesini öneriyordu). Gerekçe: animatör göz kırparken yalnız
   * `scale.y` yazıyor (`eyeL.scale.y = blink`), `scale.set(...)` DEĞİL —
   * yani z çarpanı eski mesh'te olduğu gibi kemikte de ayakta kalır.
   * Geometriye pişirmek kemiğin `matrixWorld`'ünden z ölçeğini düşürürdü ve
   * özdeşlik kapısı `eyeL` düğümünü matris matris karşılaştırdığı için
   * (rig-identity.js NODES) 0,5'lik bir sapma olarak yanardı.
   */
  eyeL.scale.set(1, 1, EYE_Z_SCALE);
  eyeR.scale.set(1, 1, EYE_Z_SCALE);
  // Sclera + küçük iris, eski tek parça siyah nokta göz görünümünü kaldırır.
  add(eyeL, unlitPart(eyeWhiteGeo, 0xf6f1e8));
  add(eyeR, unlitPart(eyeWhiteGeo, 0xf6f1e8));
  add(eyeL, unlitPart(irisGeo, p.eye, 0, -0.002, 0.035));
  add(eyeR, unlitPart(irisGeo, p.eye, 0, -0.002, 0.035));

  const browGeo = roundBox(0.1, 0.026, 0.028, 0.011);
  const browL = joint(face, -0.09, BROW_Y, 0.01, 'browL', bones);
  const browR = joint(face, 0.09, BROW_Y, 0.01, 'browR', bones);
  /**
   * SADE LOD'DA KAŞ HİÇ KURULMAZ — bayrak kemikte duruyor, `add()` onu okuyup
   * parçayı hiç kaydetmiyor (bkz. `add` içindeki ölü vertex temizliği notu).
   * Kazanç karakter başına 442 vertex ≈ 30 KB VRAM, tam da LOD'un hizmet
   * ettiği zayıf cihazlarda.
   *
   * KEMİK YİNE DE KURULUR ve bayrak `visible=false` kalır: animatör her
   * karede kaşların konum ve ölçeğini yazıyor (`browL.position.y`,
   * `browL.scale`), kemik kaldırılırsa null erişimi olur. `Bone.visible`
   * skinning'i etkilemez (geometri tek SkinnedMesh'te, kemik yalnız matris
   * kaynağı) — burada tek işlevi `add()`e "bu dalda çizme" demek ve kararı
   * okunabilir kılmak.
   */
  if (lod) {
    browL.visible = false;
    browR.visible = false;
  }
  add(browL, unlitPart(browGeo, p.brow));
  add(browR, unlitPart(browGeo, p.brow));

  const mouth = joint(face, 0, -0.085, 0.01, 'mouth', bones);
  add(mouth, unlitPart(roundBox(0.088, 0.032, 0.028, 0.013), p.mouth));

  if (spec.mustache && !lod) {
    add(face, unlitPart(box(0.18, 0.038, 0.035), 0xcfcbc2, 0, -0.045, 0.014));
  }
  if (spec.blush && !lod) {
    const blushGeo = sph(0.055, 6, 5);
    const blushColor = mix(p.skin, 0xe0604a, 0.42);
    const bl = unlitPart(blushGeo, blushColor, -0.185, -0.035, -0.022);
    const br = unlitPart(blushGeo, blushColor, 0.185, -0.035, -0.022);
    bl.scale.set(1, 0.7, 0.35);
    br.scale.set(1, 0.7, 0.35);
    add(face, bl);
    add(face, br);
  }
  if (spec.headphones) {
    const hpGeo = sph(0.085, 8, 6);
    const hl = litPart(hpGeo, 0x2b3038, -0.27, 0.22, 0);
    const hr = litPart(hpGeo, 0x2b3038, 0.27, 0.22, 0);
    hl.scale.set(0.5, 1, 1);
    hr.scale.set(0.5, 1, 1);
    add(head, hl);
    add(head, hr);
  }

  const headTop = anchor(neck, 0, HEAD_Y + (HEAD_MESH_Y + HEAD_H / 2) * spec.headMul + 0.28, 0);

  /* ------------------------------------------------------------ kollar */

  const shX = SHOULDER_X * spec.shoulderMul * (1 + (g - 1) * 0.75);
  /**
   * KOL = İKİ LOFT SEGMENTİ (boru + eklem küresi montajı tamamen gitti).
   * Üst segment omuz kubbesiyle başlar (ayrı omuz başlığı YOK), deltoid
   * şişkinliğinden dirseğe süzülür ve dirseğin ÜSTÜNE kubbeyle kapanır;
   * alt segment o kubbenin içinden doğar. Bükülünce iki kubbe kesişir —
   * dolgu küresine gerek kalmaz, silüette tek bir basamak bile yok.
   */
  const armUpGeo = loft(
    [
      { y: 0.085, r: 0.02 },
      { y: 0.05, r: 0.07 },
      { y: 0.0, r: 0.075 },
      { y: -0.1, r: 0.068 },
      { y: -0.2, r: 0.062 },
      /**
       * Manşet ucu SIKI kubbe: yüzey dikleşmeden bitirilirse alt kolun
       * yüzeyiyle kesişim çizgisi teğetleşiyor ve düşük kenar sayısında
       * tırtıklı okunuyordu (lineup4). Dik inen uç, kesişimi keskin ve
       * temiz bir manşet çizgisine çevirir. Kenar 14 → 16.
       */
      { y: -0.275, r: 0.056 },
      { y: -0.295, r: 0.038 },
      { y: -0.305, r: 0.015 },
    ],
    16,
    1,
  );
  const armLoGeo = loft(
    [
      { y: 0.04, r: 0.015 },
      { y: 0.005, r: 0.054 },
      { y: -0.08, r: 0.052 },
      { y: -0.17, r: 0.047 },
      { y: -0.2, r: 0.036 },
      { y: -0.215, r: 0.015 },
    ],
    14,
    1,
  );
  /** Tapered palm + thumb: top-el yerine okunaklı bir el silüeti. */
  const handGeo = loft(
    [
      { y: 0.025, r: 0.018 },
      { y: 0.0, r: 0.052 },
      { y: -0.055, r: 0.066 },
      { y: -0.105, r: 0.056 },
      { y: -0.132, r: 0.02 },
    ],
    14,
    0.78,
  );
  const thumbGeo = roundBox(0.044, 0.085, 0.043, 0.016);

  const shoulderL = joint(torso, -shX, SHOULDER_Y, 0, 'shoulderL', bones);
  const armUpperL = joint(shoulderL, 0, 0, 0, 'armUpperL', bones);
  const auL = litPart(armUpGeo, p.sleeve, 0, 0, 0);
  auL.scale.set(limbG, 1, limbG);
  add(armUpperL, auL);
  const armLowerL = joint(armUpperL, 0, -ARM_U, 0, 'armLowerL', bones);
  add(armLowerL, litPart(armLoGeo, p.forearm, 0, 0, 0));
  const handL = joint(armLowerL, 0, -ARM_L, 0, 'handL', bones);
  add(handL, litPart(handGeo, p.skin, 0, 0, 0.012));
  const thumbL = litPart(thumbGeo, p.skin, 0.046, -0.06, 0.024);
  thumbL.rotation.z = -0.38;
  add(handL, thumbL);

  const shoulderR = joint(torso, shX, SHOULDER_Y, 0, 'shoulderR', bones);
  const armUpperR = joint(shoulderR, 0, 0, 0, 'armUpperR', bones);
  const auR = litPart(armUpGeo, p.sleeve, 0, 0, 0);
  auR.scale.set(limbG, 1, limbG);
  add(armUpperR, auR);
  const armLowerR = joint(armUpperR, 0, -ARM_U, 0, 'armLowerR', bones);
  add(armLowerR, litPart(armLoGeo, p.forearm, 0, 0, 0));
  const handR = joint(armLowerR, 0, -ARM_L, 0, 'handR', bones);
  add(handR, litPart(handGeo, p.skin, 0, 0, 0.012));
  const thumbR = litPart(thumbGeo, p.skin, -0.046, -0.06, 0.024);
  thumbR.rotation.z = 0.38;
  add(handR, thumbR);

  // Omuz rütbesi — sağ üst kolun dış yüzünde altın çizgiler.
  for (let i = 0; i < (lod ? 0 : spec.stripes); i++) {
    add(armUpperR, litPart(box(0.028, 0.03, 0.14), 0xffc84a, 0.068, -0.05 - i * 0.055, 0));
  }

  if (spec.wristbands && !lod) {
    /** 8 kenar + 0,078 yarıçap: kolun iki katı genişlikte TIRTIKLI halka
     *  görünüyordu (lineup karesindeki "kesik kesik" izlerin kaynağı). */
    const wbGeo = cyl(0.062, 0.064, 0.05, 12);
    add(armLowerL, litPart(wbGeo, p.accent, 0, -0.185, 0));
    add(armLowerR, litPart(wbGeo, p.accent, 0, -0.185, 0));
  }

  if (spec.hand === 'briefcase') {
    // Koltuk altında evrak çantası — sol alt kola sabit.
    const bc = litPart(box(0.09, 0.25, 0.31), p.accent, -0.035, -0.12, 0.03);
    bc.rotation.z = 0.12;
    add(armLowerL, bc);
  } else if (spec.hand === 'basket') {
    add(handL, litPart(cyl(0.14, 0.105, 0.15, 10), p.accent, 0, -0.14, 0.02));
    const handle = litPart(torus(0.1, 0.016, 5, 10), shade(p.accent, 0.8), 0, -0.06, 0.02);
    handle.rotation.y = Math.PI / 2;
    add(handL, handle);
  }

  /* ----------------------------------------------------------- bacaklar */

  const legX = LEG_X * (1 + (g - 1) * 0.7);
  /** Bacaklar da kol gibi loft — uyluk dolgun başlar, dize süzülür. */
  const legUpGeo = loft(
    [
      { y: 0.06, r: 0.02 },
      { y: 0.02, r: 0.095 },
      { y: -0.1, r: 0.088 },
      { y: -0.22, r: 0.077 },
      { y: -0.3, r: 0.07 },
      { y: -0.345, r: 0.02 },
    ],
    14,
    1,
  );
  const legLoGeo = loft(
    [
      { y: 0.045, r: 0.02 },
      { y: 0.0, r: 0.068 },
      { y: -0.12, r: 0.061 },
      { y: -0.22, r: 0.056 },
      { y: -0.265, r: 0.02 },
    ],
    12,
    1,
  );
  const fh = spec.boots ? 0.13 : 0.1;
  const soleColor = shade(p.shoe, 0.68);

  const shoeBodyGeo = roundBox(0.17, fh, 0.24, 0.045, 3);
  const shoeToeGeo = sph(0.085, 12, 9);
  const addShoe = (footJoint: THREE.Bone) => {
    add(footJoint, litPart(shoeBodyGeo, soleColor, 0, fh / 2 - ANKLE_Y, 0.05));
    if (lod) return;
    const toe = litPart(shoeToeGeo, p.shoe, 0, fh * 0.46 - ANKLE_Y, 0.135);
    toe.scale.set(1.02, 0.78, 0.56);
    add(footJoint, toe);
  };

  const legUpperL = joint(hips, -legX, 0, 0, 'legUpperL', bones);
  const luL = litPart(legUpGeo, p.pants, 0, 0, 0);
  luL.scale.set(limbG, 1, limbG);
  add(legUpperL, luL);
  const legLowerL = joint(legUpperL, 0, -LEG_U, 0, 'legLowerL', bones);
  add(legLowerL, litPart(legLoGeo, p.pants, 0, 0, 0));
  const footL = joint(legLowerL, 0, -LEG_L, 0, 'footL', bones);
  addShoe(footL);

  const legUpperR = joint(hips, legX, 0, 0, 'legUpperR', bones);
  const luR = litPart(legUpGeo, p.pants, 0, 0, 0);
  luR.scale.set(limbG, 1, limbG);
  add(legUpperR, luR);
  const legLowerR = joint(legUpperR, 0, -LEG_U, 0, 'legLowerR', bones);
  add(legLowerR, litPart(legLoGeo, p.pants, 0, 0, 0));
  const footR = joint(legLowerR, 0, -LEG_L, 0, 'footR', bones);
  addShoe(footR);

  if (spec.legStripe && !lod) {
    const stGeo = box(0.022, 0.3, 0.04);
    add(legUpperL, litPart(stGeo, p.overAlt, -0.085 * limbG, -0.15, 0));
    add(legUpperR, litPart(stGeo, p.overAlt, 0.085 * limbG, -0.15, 0));
  }

  /* ------------------------------------------------------------ noktalar */

  const carryAnchor = anchor(torso, 0, 0.34, 0.32);
  const handAnchor = anchor(handR, 0, -0.07, 0.06);

  const crown = NECK_WORLD_Y + HEAD_Y + (HEAD_MESH_Y + HEAD_H / 2) * spec.headMul;
  root.scale.setScalar(spec.heightMul);

  /**
   * BİRLEŞTİRME. `root.scale`'den SONRA: `buildSkin` hem parçaları kök-yerel
   * dinlenme uzayına indirirken hem de `bindMatrix`i kurarken kökün o anki
   * dünya matrisini kullanıyor, ikisinin AYNI ana bakması şart.
   */
  const { mesh: skinned, headRange } = buildSkin(parts, bones, root);

  /**
   * SAHİPLİK (Task 5 fix round 1, Critical — Task 7'de çapa, Task 9b'de
   * kapsamı değişti). `parts`in kendisi dispose EDİLECEK bir şey taşımıyor:
   * `geo` paylaşımlı kaynak (asla bu rig'e ait olmadı, hiç klonlanmadı da —
   * fix round 1 Adım B), `local` bir `Matrix4`, `color` bir sayı — üçü de ya
   * paylaşımlı ya da GC'nin kendiliğinden topladığı düz veri. Ara klon diye
   * bir şey de yok artık: `buildSkin` (CharacterSkin.ts) kaynak
   * özniteliklerini doğrudan önceden-tahsis edilmiş birleşik tampona
   * yazıyor, `mergeGeometries` çağrısı ve onun ara girdileri tamamen
   * kalktı. Geriye karaktere ait yalnız iki GPU kaynağı kalıyor: birleşik
   * tampon ve `Skeleton`in kemik dokusu
   * (`computeBoneTexture` her karaktere ayrı bir DataTexture kuruyor —
   * bırakılmazsa dokular birikir; ölçüldü: 40 kur-at turunda geometries
   * 297→337→297, textures 30→70→30).
   *
   * ÇAPA ARTIK MATERYAL DEĞİL. Task 6'ya kadar bu iki `dispose()` çağrısı
   * `headMat`in 'dispose' olayına asılıydı; kafa global materyale katılınca
   * o klon kalmadı. Yerine açık bir kapanış geçti — tetikleyici AYNI
   * (`CharacterAnimator.dispose()`), "tam bir kez" garantisi de aynı:
   * animatörün kendi `dead` bayrağı ikinci çağrıyı zaten yutuyor, buradaki
   * `released` ise doğrudan çağrılırsa da yutar.
   */
  let released = false;
  const disposeOwned = (): void => {
    if (released) return;
    released = true;
    skinned.geometry.dispose();
    skinned.skeleton.dispose();
  };

  /**
   * ÖFKE TİNTİ — kafa vertex aralığına yazılır (Task 7).
   *
   * Materyal GLOBAL: rengini değiştirmek sahnedeki bütün karakterleri
   * kızdırırdı. Aralık birleştirme sırasında saklandı (`buildSkin`), burada
   * yalnız `color` özniteliğinin o dilimi yeniden yazılıyor.
   *
   * `addUpdateRange`: `needsUpdate` tek başına TÜM renk tamponunu (4362
   * vertex) yeniden yüklerdi; kafa dilimi bitişik olduğu için yalnız 221
   * vertex'lik pencere gönderiliyor. Aralık HER ÇAĞRIDA AYNI, bu yüzden
   * bekleyen bir kayıt varsa ikincisi eklenmiyor: kadraj dışı bir aktörde
   * (`root.visible=false` → renderer geometriyi hiç güncellemez, dolayısıyla
   * `updateRanges`i hiç boşaltmaz) liste yoksa sınırsız büyürdü.
   *
   * Çağrı kadansı animatörün elinde ve legacy'yle AYNI kararları veriyor:
   * tint DEĞERİ değiştikçe (öfke rampası), sabit kalınca hiç.
   */
  const baseFace = new THREE.Color().setHex(p.face, THREE.SRGBColorSpace);
  const setHeadTint = (color: THREE.Color | null): void => {
    const attr = skinned.geometry.getAttribute('color') as THREE.BufferAttribute;
    const [s, e] = headRange;
    const c = color ?? baseFace;
    for (let i = s; i < e; i++) attr.setXYZ(i, c.r, c.g, c.b);
    if (attr.updateRanges.length === 0) attr.addUpdateRange(s * 3, (e - s) * 3);
    attr.needsUpdate = true;
  };

  return {
    root,
    bob,
    hips,
    torso,
    torsoMesh: torsoBreath,
    neck,
    head,
    shoulderL,
    shoulderR,
    armUpperL,
    armLowerL,
    handL,
    armUpperR,
    armLowerR,
    handR,
    legUpperL,
    legLowerL,
    footL,
    legUpperR,
    legLowerR,
    footR,
    bones,
    boneRoot: bob,
    carryAnchor,
    handAnchor,
    headTop,
    eyeL,
    eyeR,
    browL,
    browR,
    mouth,
    ponytail,
    skinned,
    headRange,
    setHeadTint,
    disposeOwned,
    headBaseColor: baseFace,
    armRestZ: 0.13 + (g - 1) * 0.45,
    height: (crown + 0.085) * spec.heightMul,
    // Tek mesh; çizim çağrısı 2 (ışıklı gövde + ışıksız yüz, bkz. buildSkin).
    meshCount: 1,
  };
}
