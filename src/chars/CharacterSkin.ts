import * as THREE from 'three';
import { charLitMaterial, charUnlitMaterial, linearColor } from './CharacterMaterials';

/**
 * KARAKTER DERİSİ — parça listesini tek skinned geometriye çeviren saf dönüşüm.
 *
 * KATI SKINNING: her vertex eski ebeveyn eklemine 1,0 ağırlıkla bağlanır.
 * Hiçbir vertex iki kemik arasında paylaşılmadığı için GPU'nun uyguladığı
 * skinning matrisi bugünkü sahne grafiğinin uyguladığı dünya matrisiyle
 * AYNI çarpımdır — sadakat kurulum gereği garantidir, ağırlık boyama yok.
 *
 * İKİ KOVA, İKİ ÇAĞRI (Task 7). Kova sırası SABİT: 0 ışıklı gövde (KAFA
 * DAHİL), 1 ışıksız yüz. Task 6'da üçüncü bir kova vardı — kafa, çünkü öfke
 * tintlemesi karaktere özel bir materyal klonunu mutasyona uğratıyordu ve o
 * klon global `charLitMaterial()`'a katılsa bir karakterin öfkesi sahnedeki
 * herkesi kızartırdı. Tint artık kafa VERTEX aralığına yazılıyor (bkz.
 * `headRange` ve CharacterRig `setHeadTint`), materyal paylaşımlı kalabiliyor
 * ve karakter başına çizim çağrısı 3'ten 2'ye indi.
 *
 * İKİNCİ ÇAĞRI KALICI VE BİLİNÇLİ: yüz ışıksız (`MeshBasicMaterial`,
 * `toneMapped:false`) çiziliyor — v5.0 okunaklılık kararı, bkz.
 * CharacterMaterials.ts.
 *
 * SIFIR ARA NESNE (Task 9b fix round 1, Adım B). Adım A'da parça başına TEK
 * klon vardı (kaynaktan bir kez klonlanıp dönüştürülüyor, boyanıyordu),
 * artı `mergeGeometries`nin kendi ürettiği birleşik tampon — iki tahsis
 * turu. Artık HİÇ ara `BufferGeometry` yok: toplam vertex/index sayısı
 * `parts` listesinden ÖNCEDEN hesaplanıyor, birleşik tamponlar TEK SEFERDE
 * tahsis ediliyor, her parçanın kaynak özniteliği (konum/normal/uv)
 * DOĞRUDAN o tamponun kendi diliminde dönüştürülüp yazılıyor.
 * `mergeGeometries` çağrısı kalktı — ölçüldü (Adım A→B, aynı oturum A/B,
 * bkz. task-9b-report.md "Fix round 1"): doğuş başına ara klon sayısı 34'ten
 * 0'a indi.
 */

/** 0 = ışıklı gövde (kafa dahil) · 1 = ışıksız yüz. */
export type SkinBucket = 0 | 1;
export const SKIN_LIT: SkinBucket = 0;
export const SKIN_UNLIT: SkinBucket = 1;

export interface SkinPart {
  /**
   * PAYLAŞIMLI KAYNAK geometri (`world/Materials` önbelleğinden) —
   * MUTASYONA UĞRATILMAZ ve artık hiç KLONLANMAZ (Task 9b Adım B): yalnız
   * `position`/`normal`/`uv` öznitelikleri DOĞRUDAN okunur. Aynı referans
   * birden çok `SkinPart`te tekrar edebilir (ör. sol/sağ göz aynı
   * göz geometrilerini paylaşır — sorun değil, hiçbiri yazılmıyor.
   */
  geo: THREE.BufferGeometry;
  /** Parçanın kemik-yerel dönüşümü — CharacterRig `add()`in ANINDA aldığı `m.matrix` klonu. */
  local: THREE.Matrix4;
  /** Doğrusal uzayda yazılacak vertex rengi (sRGB hex — `linearColor` çevirir). */
  color: number;
  /** Vertex'lerin 1,0 ağırlıkla bağlanacağı kemik. */
  bone: THREE.Bone;
  bucket: SkinBucket;
  /**
   * Öfke tintlemesinin boyayacağı parça (kafa kabuğu). İşaretli parçaların
   * birleşik tampondaki vertex aralığı `headRange` olarak dönüyor; başka
   * hiçbir ayırt edici iz yok (kafa artık gövdeyle AYNI materyalde).
   */
  head?: boolean;
}

/** Kare başına tahsis olmasın diye modül seviyesinde — tek dönüşüm turu, geri kalan kare bu tampona dokunmaz. */
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _restToRoot = new THREE.Matrix4();
const _combined = new THREE.Matrix4();
const _normalMat = new THREE.Matrix3();

/**
 * Bir kaynak geometrinin KENDİ index'inin referans vermediği vertex sayısı.
 * Geometri başına bir kez hesaplanır (kaynaklar paylaşımlı ve önbellekli,
 * bkz. world/Materials.ts), sonrası saf `WeakMap` lookup'ı.
 *
 * Yalnız DEV yolundan çağrılıyor — gerekçe `buildSkin` içindeki
 * "KAYNAKTAN MİRAS ÖLÜ VERTEX" notunda.
 */
const _deadCache = new WeakMap<THREE.BufferGeometry, number>();
function unreferencedVerts(geo: THREE.BufferGeometry): number {
  const hit = _deadCache.get(geo);
  if (hit !== undefined) return hit;
  const count = geo.getAttribute('position').count;
  const idx = geo.index;
  let dead = count;
  if (idx) {
    const seen = new Uint8Array(count);
    for (let k = 0; k < idx.count; k++) {
      const v = idx.getX(k);
      if (v >= 0 && v < count) seen[v] = 1;
    }
    dead = 0;
    for (let i = 0; i < count; i++) if (seen[i] === 0) dead++;
  }
  _deadCache.set(geo, dead);
  return dead;
}

/**
 * Parçaları tek `SkinnedMesh`'e indirir.
 *
 * `parts` yalnız OKUNUR ve KAYNAK geometrilerini MUTASYONA UĞRATMAZ: her
 * parçanın `geo`'su paylaşımlı önbellekten gelebilir, yalnız
 * `getAttribute(...)` ile okunur, hiçbir zaman `setAttribute`/`applyMatrix4`
 * görmez. `parts`in kendisi (geometri referansları, matrisler, renk
 * sayıları) çağıranın düz verisidir — serbest bırakılacak bir GPU kaynağı
 * taşımaz (bkz. CharacterRig `buildRig` sahiplik notu).
 *
 * İKİ TARAMA: birincisi yalnız SAYAR (toplam vertex/index — tamponları
 * tahsis etmeden önce boyutları bilmemiz gerekiyor), ikincisi YAZAR. İkisi
 * de `bucketed` üstünde AYNI sırayla gezinir (kova 0 sonra kova 1, her
 * kovada `parts`e eklendiği sıra) — bu yüzden birinci taramanın saydığı
 * dilim sınırları ikinci taramanın yazdığıyla birebir örtüşür. Ayrışırlarsa
 * yazma döngüsünün ardındaki MUHASEBE KAPISI patlar (Task 10).
 *
 * HER PARÇA ÇİZİLİR: `parts`e giren her parça hem vertex hem üçgen katkısı
 * yapar. Task 6-9b arası "var ama çizilmiyor" (`hidden`) diye bir parça
 * sınıfı vardı — vertex'leri tampona giriyor, üçgenleri atlanıyordu; sade LOD
 * dalındaki kaşlar buydu ve karakter başına 442 ölü vertex demekti. Filtre
 * Task 10'da tek doğru yere, `CharacterRig`in `add()`ine taşındı.
 *
 * Buna rağmen birleşik tamponda referanssız vertex SIFIR DEĞİLDİR: kaynak
 * primitiflerin kendi index'leri de bazı vertex'lerine hiç dokunmuyor
 * (`SphereGeometry` kutup dikişi, karakter başına ~53). O pay KURUCUYA AİT
 * DEĞİL ve `userData.sourceDeadVerts` ile ayrı raporlanıyor (aşağıda).
 */
export function buildSkin(
  parts: SkinPart[],
  bones: THREE.Bone[],
  root: THREE.Group,
): { mesh: THREE.SkinnedMesh; headRange: [number, number] } {
  // Dinlenme pozu matrisleri kemik indeksinden ÖNCE tazelenmeli.
  root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();

  const boneIndex = new Map<THREE.Bone, number>();
  bones.forEach((b, i) => boneIndex.set(b, i));

  // Bir materyal grubu index tamponunda BİTİŞİK bir aralıktır; parçalar bu
  // yüzden önce kovalarına ayrılıp sonra kova sırasıyla yazılır.
  const bucketed: SkinPart[][] = [[], []];
  for (const p of parts) bucketed[p.bucket].push(p);

  /* --------------------------------------------------------- tarama 1: say */

  let totalVerts = 0;
  let totalIndices = 0;
  const bucketIndexCounts = [0, 0];
  for (let b = 0; b < 2; b++) {
    for (const p of bucketed[b]) {
      const n = p.geo.getAttribute('position').count;
      totalVerts += n;
      if (!p.geo.index) throw new Error('parça geometrisi indeksiz — kaynak primitifler her zaman indeksli olmalı');
      const ic = p.geo.index.count;
      totalIndices += ic;
      bucketIndexCounts[b] += ic;
    }
  }

  const position = new Float32Array(totalVerts * 3);
  const normal = new Float32Array(totalVerts * 3);
  const uv = new Float32Array(totalVerts * 2);
  const color = new Float32Array(totalVerts * 3);
  const skinIndexArr = new Uint16Array(totalVerts * 4);
  const skinWeightArr = new Float32Array(totalVerts * 4);
  // 65535 altı için Uint16 yeter (bugün karakter başına ~4362 vertex);
  // üstüne çıkarsa (olmuyor, olursa da) Uint32'ye düşer — mergeGeometries'in
  // eski otomatik seçimiyle aynı eşik.
  const IndexArray = totalVerts > 65535 ? Uint32Array : Uint16Array;
  const index = new IndexArray(totalIndices);

  /* --------------------------------------------------------- tarama 2: yaz */

  let vOff = 0;
  let iOff = 0;
  /** Kafa parçasının (`p.head`) vertex aralığı — döngü sırasında toplanır. */
  let headStart = -1;
  let headEnd = -1;
  let headVerts = 0;

  for (let b = 0; b < 2; b++) {
    for (const p of bucketed[b]) {
      const bi = boneIndex.get(p.bone);
      if (bi === undefined) throw new Error('SkinPart kemiği rig.bones dizisinde yok');

      /**
       * Parçanın TOPLAM dönüşümü: önce kemik-yerel (`local` — litPart/
       * unlitPart'ın position/rotation/scale'i), sonra dinlenme pozunda
       * kök-yerel uzaya (`restToRoot` — kemiğin dünyası). Fix round 1
       * Adım A bu ikisini AYNI klonun üstünde iki ayrı `applyMatrix4`
       * çağrısıyla uyguluyordu; burada TEK birleşik matris olarak
       * uygulanıyor — matematiksel olarak AYNI (normal matrisi çarpımsal:
       * `normalMatrix(restToRoot∘local) = normalMatrix(restToRoot)·
       * normalMatrix(local)`, position zaten doğrusal), üstelik artık
       * uygulanacak bir `BufferGeometry` da yok, doğrudan `Vector3`e.
       */
      _restToRoot.copy(rootInv).multiply(p.bone.matrixWorld);
      _combined.multiplyMatrices(_restToRoot, p.local);
      _normalMat.getNormalMatrix(_combined);

      const srcPos = p.geo.getAttribute('position');
      const srcNormal = p.geo.getAttribute('normal');
      const srcUv = p.geo.getAttribute('uv');
      const n = srcPos.count;

      // Parçanın rengi SABİT (her vertex'i aynı r/g/b) — döngü dışında bir
      // kez çevrilir. `linearColor` paylaşımlı scratch döner, r/g/b ANINDA
      // okunuyor (bkz. CharacterMaterials.ts).
      const c = linearColor(p.color);
      const cr = c.r;
      const cg = c.g;
      const cb = c.b;

      for (let i = 0; i < n; i++) {
        const vi = vOff + i;

        _v.fromBufferAttribute(srcPos, i).applyMatrix4(_combined);
        position[vi * 3] = _v.x;
        position[vi * 3 + 1] = _v.y;
        position[vi * 3 + 2] = _v.z;

        // three'nin BufferGeometry.applyMatrix4'ünün normal için yaptığı
        // BİREBİR aynı işlem (Matrix3.getNormalMatrix + Vector3.
        // applyNormalMatrix — node_modules/three/src/core/BufferGeometry.js
        // applyMatrix4 ile karşılaştırıldı).
        _n.fromBufferAttribute(srcNormal, i).applyNormalMatrix(_normalMat);
        normal[vi * 3] = _n.x;
        normal[vi * 3 + 1] = _n.y;
        normal[vi * 3 + 2] = _n.z;

        // Eksik uv sıfır KALIR (Float32Array varsayılan sıfırlanmış) —
        // eski `normalize()`nin "uv yoksa sıfırla doldur" karşılığı.
        if (srcUv) {
          uv[vi * 2] = srcUv.getX(i);
          uv[vi * 2 + 1] = srcUv.getY(i);
        }

        color[vi * 3] = cr;
        color[vi * 3 + 1] = cg;
        color[vi * 3 + 2] = cb;

        skinIndexArr[vi * 4] = bi; // kalan üç yuva 0 kalır, ağırlığı da 0
        skinWeightArr[vi * 4] = 1;
      }

      if (p.head === true) {
        if (headStart < 0) headStart = vOff;
        headEnd = vOff + n;
        headVerts += n;
      }

      // Tarama 1'de varlığı doğrulandı.
      const srcIndex = p.geo.index as THREE.BufferAttribute;
      for (let k = 0; k < srcIndex.count; k++) index[iOff++] = vOff + srcIndex.getX(k);

      vOff += n;
    }
  }

  /**
   * MUHASEBE KAPISI (Task 10 Adım 1c) — iki taramanın AYRIŞMASINA karşı.
   *
   * Boyutları TARAMA 1 hesaplıyor, tamponlara TARAMA 2 yazıyor. İkisi bugün
   * aynı listede aynı sırayla geziniyor, yani muhasebe tam; ama ileride biri
   * parçaları farklı filtrelerse (ör. yalnız birine yeni bir `hidden`-benzeri
   * koşul eklenirse) typed-array'in sınır dışına yazımı JavaScript'te SESSİZ
   * NO-OP'tur — patlamak yerine eksik/bozuk geometri üretir, üstelik kalan
   * dilim sıfır kalıp ekranda görünmez bir üçgen kümesine dönüşür. Sessiz
   * bozulmayı burada gürültüye çevir.
   */
  if (vOff !== totalVerts || iOff !== totalIndices) {
    throw new Error(
      `buildSkin muhasebe uyuşmazlığı: vertex ${vOff}/${totalVerts}, index ${iOff}/${totalIndices}`,
    );
  }

  /**
   * İKİ KONTROL, İKİSİ DE SESSİZ BOZULMAYA KARŞI (Task 6'dan taşındı):
   * işaretli parça hiç yoksa tint yazacak yer bulamaz ve öfke sessizce
   * kaybolurdu; işaretli parçalar bitişik değilse aralık tek blok olmazdı.
   * Bugün tek bir `head:true` çağrı sitesi var (kafa kabuğu), yani ikinci
   * kontrol pratikte hep geçer — yine de gelecekte ikinci bir kafa parçası
   * eklenirse sessizce yanlış davranmasın diye kalıyor.
   */
  if (headStart < 0) throw new Error('kafa parçası (SkinPart.head) işaretlenmemiş — tintin yazacağı aralık yok');
  if (headEnd - headStart !== headVerts) throw new Error('kafa parçaları bitişik değil — tint aralığı tek blok olmalı');

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  merged.setAttribute('color', new THREE.BufferAttribute(color, 3));
  merged.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndexArr, 4));
  merged.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeightArr, 4));
  merged.setIndex(new THREE.BufferAttribute(index, 1));

  /**
   * KAYNAKTAN MİRAS ÖLÜ VERTEX SAYISI — yalnız DEV, yalnız sağlık denetimi
   * için (tools/rig-identity.js ölü vertex kolu).
   *
   * NEDEN GEREKLİ: three'nin `SphereGeometry`si kutup dikişinde kendi
   * index'inin HİÇ referans vermediği 2 vertex üretiyor (ölçüldü: sph(...)
   * 63 vertex → 2 ölü, roundBox → 2, box/cyl/torus → 0). Karakter başına ~26
   * küre türevi parça var, yani birleşik tampon KURUCUDAN BAĞIMSIZ olarak
   * ~53 referanssız vertex miras alıyor. Kol bunu ihlal sayarsa kalıcı yanlış
   * alarm üretir ve bir sonraki geliştirici kolu kapatır — dejenere normaller
   * için verilen kararın birebir aynısı.
   *
   * Kolun ASIL hedefi (Task 6'dan devreden ölü vertex temizliği) kurucunun
   * tampona koyduğu GİZLİ PARÇA; o "kurucuya atfedilebilir" pay
   * `deadVertices − sourceDeadVerts` olarak tam hesaplanıyor, eşiksiz.
   *
   * MALİYET: kaynak geometriler paylaşımlı ve önbellekli (world/Materials.ts),
   * bu yüzden parça başına değil GEOMETRİ BAŞINA bir kez hesaplanıp WeakMap'te
   * saklanıyor; ısınmadan sonra saf lookup. Üretim derlemesinde blok tamamen
   * eleniyor (`import.meta.env.DEV`).
   */
  if (import.meta.env?.DEV) {
    let sourceDead = 0;
    for (let b = 0; b < 2; b++) {
      for (const p of bucketed[b]) sourceDead += unreferencedVerts(p.geo);
    }
    merged.userData.sourceDeadVerts = sourceDead;
  }

  // mergeGeometries eskiden parça başına bir grup üretip iki kovaya
  // indiriyordu (bkz. eski `groupCounts` + `clearGroups`/`addGroup` turu);
  // tarama 1 kova toplamlarını zaten verdiği için doğrudan ekleniyor.
  // Sıfır uzunluklu grup da bir çizim çağrısı harcar (renderer count=0 ile
  // yine `drawElements` çağırır) — bugün olmuyor, olursa da atlansın.
  if (bucketIndexCounts[SKIN_LIT] > 0) merged.addGroup(0, bucketIndexCounts[SKIN_LIT], SKIN_LIT);
  if (bucketIndexCounts[SKIN_UNLIT] > 0) {
    merged.addGroup(bucketIndexCounts[SKIN_LIT], bucketIndexCounts[SKIN_UNLIT], SKIN_UNLIT);
  }

  // İki GLOBAL materyal, karaktere özel hiçbir materyal yok (Task 7): renk
  // tamamen vertex özniteliğinde, öfke tinti dahil.
  const mesh = new THREE.SkinnedMesh(merged, [charLitMaterial(), charUnlitMaterial()]);
  /**
   * GÖLGE: karakterler donmuş gölge haritasına GİRMEZ (Scene3D
   * `shadowMap.autoUpdate = false`) — hareketli bir karakter oraya girerse
   * gölgesi olduğu yerde baki kalır; yere basma hissini ayrı bir temas gölgesi
   * katmanı veriyor. Ama statik gölgeyi ÜZERİNE almaları gerekir.
   *
   * BEYAN EDİLMİŞ FARK: eski rig'de yalnız 7 gövde parçası `receiveShadow`
   * alıyordu, kalan ~81 detay parçası (düğme, askı, kasket siperi, ayakkabı
   * tabanı...) almıyordu. Tek mesh'in TEK bayrağı olur; `true` seçildi çünkü
   * (a) kaybı daha görünür olan gövde kütleleridir, (b) gövdeyle aynı yerde
   * duran detayın gövdeyle aynı gölgeyi alması bugünkü tutarsızlıktan daha
   * doğru (şu an gölgedeki gövdenin üstündeki düğme parlak kalıyor),
   * (c) iki ışıklı grup ayırmak fazladan bir çizim çağrısına mal olurdu.
   * Özdeşlik kapısına `declaredShadowReceiveGain` ile bildiriliyor.
   */
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  /**
   * Kadraj eleme KAPALI: skinned mesh'in sınır küresi dinlenme pozundan
   * hesaplanır ve poz değiştikçe yanlışlaşır — yürüyen karakter kadrajın
   * içindeyken elenebilir. Oyun kendi eleme mantığını zaten uyguluyor
   * (kadraj dışı aktörde `char.root.visible = false`), bu yüzden burada
   * gereksiz ve riskli.
   */
  mesh.frustumCulled = false;

  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones), mesh.matrixWorld);

  return { mesh, headRange: [headStart, headEnd] };
}
