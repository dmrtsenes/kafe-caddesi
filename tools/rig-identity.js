/**
 * RIG SAĞLIK DENETİMİ — tek kurucunun regresyon kapısı.
 *
 * KİP DEĞİŞTİ (Task 10). Bu araç Task 2-9b boyunca KARŞILAŞTIRMALI bir kapıydı:
 * `buildRigLegacy` (katı mesh hiyerarşisi) ile `buildRig` (tek SkinnedMesh)
 * aynı girdiyle koşturulup düğüm dünya matrisleri, vertex konumları, renkler,
 * gölge bayrakları ve etkin görünürlükler float toleransında karşılaştırılıyordu.
 * Kapı son kez 240 karede, 160 vakada, iki LOD dalında koştu ve yeşil yandı:
 *
 *   pass: true · maxJointError 0 · maxVertexError 7,74e-8 · vertexNearestMiss 0
 *   vertexMismatches 0 · countMismatches 0 · visibilityMismatches 0
 *   colorMismatches 0 · shadowMismatches 0 · drawCalls legacy 60 → next 2
 *   744.320 matris + 5.614.209 vertex + 1.871.403 renk örneği karşılaştırıldı
 *
 * Ardından `buildRigLegacy` silindi (ölü kod bir sonraki geliştiriciye hangi
 * kurucunun canlı olduğunu söylemez) ve karşılaştırmalı kip anlamını yitirdi:
 * referans taraf yok. Özdeşliğin sayısal kanıtı planın Ölçüm Kütüğü'nde ve
 * commit geçmişinde duruyor; karşılaştırma makinesi (renk kolu, gölge beyanı,
 * `nearestIndexed`/`colorMatchAtSamePosition` eşleştirmesi, dilim sırası
 * bağımlılığı) o kiple birlikte gitti.
 *
 * KALAN İŞ REGRESYON: tek kurucunun kendi başına sağlaması gereken şeyler.
 *   1) ÇİZİM ÇAĞRISI her vakada tam 2 (ışıklı gövde + ışıksız yüz) — bu
 *      geçişin başlık iddiası.
 *   2) EKLEM MATRİSLERİ sonlu — hiçbir pozda NaN üretilmiyor; hem sahne
 *      grafiğinin `matrixWorld`leri hem GPU'nun okuduğu `skeleton.boneMatrices`.
 *   3) VERTEX BULUTU boş değil, tüm konumlar sonlu ve index'in referans
 *      vermediği ÖLÜ VERTEX yok.
 *   4) NORMALLER dışa bakıyor ve birim boyda (Adım 1b'de eklendi, aşağıda).
 *
 * RENDER GEREKTİRMEZ: rig elle kurulur, animatör elle `update()` ile sürülür,
 * matrisler doğrudan okunur. Tarayıcı paneli kompozit etmese, rAF hiç
 * ilerlemese de denetim koşar — oyunun açılmış olması (dev kancası) yeterli.
 *
 * KÖRLÜK KORUMASI — bu aracın en önemli kısmı ve kip değişiminden SAĞ ÇIKTI.
 * Hiçbir şeyi ölçmeyen bir kapı da "sorun yok" der ve yeşil yanar; güvence
 * yanılsaması testin olmamasından KÖTÜDÜR. Bu yüzden `pass` yalnız sapma
 * yokluğuna bakmaz, ayrıca şunları şart koşar:
 *   (a) en az bir matris ve bir vertex denetlendi,
 *   (b) ponytail dışındaki 29 düğümün HER BİRİ en az bir vakada denetlendi,
 *   (c) ponytail en az bir vakada gerçekten vardı (kasiyer at kuyruğu),
 *   (d) normal kolu gerçekten kontrol yaptı,
 *   (e) çizim çağrısı kolu gerçekten çağrı saydı,
 *   (f) `frames`/`expectDrawCalls` tabanları zorlanmadı — kapı
 *       gevşetilebiliyorsa kapı değildir.
 *
 * `notes` körlüktür ve `pass`i DÜŞÜRÜR. Sessiz sıfır kabul edilmez.
 *
 * Kullanım: __rigIdentity()
 *   opsiyonlar: frames, expectDrawCalls (varsayılan 2), roles, seeds,
 *   segments, lods, uniforms
 */
/* eslint-disable no-console */
function __rigIdentity(opts = {}) {
  const t0 = performance.now();

  const notes = [];

  const I = window.__charInternals;
  if (!I) throw new Error('window.__charInternals yok — dev derlemesi mi? (npm run dev)');

  /**
   * TABANLAR. Çağıran gevşetmeye çalışırsa değer ZORLANIR ve `notes`'a yazılır
   * (yani kapı da kırmızı yanar).
   *
   * `TOL`/`TOL_MAX` KALKTI (Task 10): tolerans, iki tarafı karşılaştıran
   * kollara aitti ve karşılaştırma kalmadı. Geriye kalan tek sayısal eşik
   * normal kolunun `NORMAL_UNIT_TOL`u ve o `opts`a HİÇ AÇILMIYOR — eski
   * kelepçeden daha sıkı, çünkü gevşetilecek bir kolu yok.
   *
   * FRAMES_MIN = 100: cheer 1,35 sn / angry 1,55 sn kilitli (holdOf) ve
   * carryW/wCheer/moveW sönümlü. 100 karenin (1,67 sn) altında ağırlıklar
   * oturmaz, denetim oturmamış pozu ölçer — Task 2'de bir kez düşülen tuzağın
   * aynısı (soğuk ölçüm kadansı %35 yanlış göstermişti). NaN avı için de uzun
   * koşum lazım: sapma birikimli.
   */
  const FRAMES_MIN = 100;
  let FRAMES = opts.frames ?? 120;
  if (!(FRAMES >= FRAMES_MIN)) {
    notes.push(`frames ${opts.frames} tabanın altında — ${FRAMES_MIN}'e kelepçelendi; sönümlü ağırlıklar oturmadan ölçüm anlamsız`);
    FRAMES = FRAMES_MIN;
  }

  /**
   * ÇİZİM ÇAĞRISI ÖLÇÜTÜ (Task 7) — `pass` formülüne bağlı, VAKA BAŞINA
   * ölçülüyor (en kötü/maksimum üstünden değil: iki dal farklı sayı üretirse
   * maksimum bunu gizler — bir vaka 1, bir vaka 3 verse maksimum 3'ü gösterir
   * ama "1"i hiçbir yer yakalamaz).
   *
   * KELEPÇE İKİ YÖNDE. Beklenen değer 1'in altına indirilemez (0/negatif bir
   * beklenti "hiç çizme" demek olurdu). Yukarı yönde de 2'nin üstüne
   * ÇIKARILAMAZ: üst sınır olmadan ölçüt kendi kanıtladığı şeyi çağırana
   * bırakırdı — birleştirme kazara üç grup üretse (gerçek bir gerileme)
   * `__rigIdentity({expectDrawCalls: 3})` hiçbir `notes` düşmeden yeşil
   * yanardı (ölçüldü, Task 8). Mimarinin sabit hedefi ışıklı gövde + ışıksız
   * yüz = 2 çağrı; bunun üstü çağıranın "beklentisi" değil HER ZAMAN bir
   * gerilemedir. Legacy silindikten sonra bu kol denetimin en sert ölçütü —
   * gevşetilebilir olması kabul edilemez.
   */
  const EXPECT_DRAWS_MIN = 1;
  const EXPECT_DRAWS_MAX = 2;
  let EXPECT_DRAWS = opts.expectDrawCalls ?? 2;
  if (!(EXPECT_DRAWS >= EXPECT_DRAWS_MIN)) {
    notes.push(`expectDrawCalls ${opts.expectDrawCalls} tabanın altında — ${EXPECT_DRAWS_MIN}'e kelepçelendi; ölçüt kapatılamaz`);
    EXPECT_DRAWS = EXPECT_DRAWS_MIN;
  } else if (EXPECT_DRAWS > EXPECT_DRAWS_MAX) {
    notes.push(`expectDrawCalls ${opts.expectDrawCalls} tavanın üstünde — ${EXPECT_DRAWS_MAX}'e kelepçelendi; kapı gevşetilemez`);
    EXPECT_DRAWS = EXPECT_DRAWS_MAX;
  }

  /** Kırıldığında satır listesi patlamasın — sayaç yine artmaya devam eder. */
  const ROW_CAP = 2000;

  /**
   * DENETLENEN DÜĞÜMLER — 30 düğüm, üç sınıf. Hepsi `Object3D` türevi, hepsi
   * `matrixWorld` taşıyor.
   *
   *  1) 21 EKLEM: animatörün rotation/position yazdığı hiyerarşi.
   *  2) 3 ÇAPA (carryAnchor, handAnchor, headTop): bunlara GERÇEK oyun
   *     nesneleri bağlanıyor — taşınan ürün kulesi carryAnchor'a
   *     (Player.ts, Staff.ts), istek balonu ve sabır çubuğu headTop'a
   *     (Customer.ts). Alan adı değişse ya da düğüm kaybolsa hata OYUNDA
   *     görünür: kule göğüste değil ayakta durur.
   *  3) Animatörün her kare ÖLÇEK/KONUM yazdığı 6 KEMİK: torsoMesh (nefes
   *     scale.y), eyeL/R (kırpma scale.y), browL/R (konum + eğim), mouth
   *     (scale). Ölçek `matrixWorld`e girdiği için buradan görünür.
   *
   * `ponytail` tek nullable alan (yalnız at kuyruklu roller).
   */
  const NODES = [
    'root', 'bob', 'hips', 'torso', 'neck', 'head',
    'shoulderL', 'shoulderR',
    'armUpperL', 'armLowerL', 'handL',
    'armUpperR', 'armLowerR', 'handR',
    'legUpperL', 'legLowerL', 'footL',
    'legUpperR', 'legLowerR', 'footR',
    'ponytail',
    'carryAnchor', 'handAnchor', 'headTop',
    'torsoMesh', 'eyeL', 'eyeR', 'browL', 'browR', 'mouth',
  ];

  /**
   * ROLLER — `CharRole` (types.ts) sekiz değer tanımlıyor, hepsi burada.
   * Her rol farklı parça takımı kuruyor: kasiyerde at kuyruğu (oynayan ekstra
   * eklem), kaçakta kapalı kapüşon + torus, koşucuda sırt kasası, garsonda
   * uzun önlük. Rol atlamak o parçaların kurulmasını hiç sınamamak demek.
   */
  const ROLES = opts.roles ?? [
    'player', 'runner', 'waiter', 'cashier', 'barista', 'busser', 'customer', 'dasher',
  ];

  /**
   * DURUMLAR + KATMANLAR. `AnimState` (types.ts) yedi durum tanımlıyor —
   * hepsi burada. Taşıma ve itme AYRI DURUM DEĞİL, idle/walk üstüne binen
   * katmanlardır (CharacterAnimator.applyCarry / applyPush): kol zincirini
   * en sert yazan iki yol bunlar ve kendi dilimleri olmadan hiç sınanmazlar.
   *
   * `cloud` BAYRAĞI KALKTI (Task 10): karşılaştırmalı kipte üç dilim vertex
   * bulutu alıyordu (`sit`, `angry`, walk+push+sweep) çünkü bulutlar iki
   * taraf arasında karşılaştırılıyordu. Artık vertex denetimi POZ-BAĞIMSIZ
   * (bulut değil, tamponun kendisi ölçülüyor), dolayısıyla dilim seçimi de
   * anlamını yitirdi — dilimler yalnız NaN avı için var.
   */
  const SEGMENTS = opts.segments ?? [
    { state: 'idle' },
    { state: 'walk', spd: 2.4 },
    { state: 'work' },
    { state: 'cheer' },
    { state: 'angry' },
    { state: 'panic', spd: 4.2 },
    { state: 'sit' },
    { state: 'idle', carry: 6 },
    { state: 'walk', spd: 2.4, carry: 2 },
    { state: 'walk', spd: 2.4, push: true, sweep: true },
  ];

  /**
   * LOD DALLARI. `charLod()` parça kompozisyonunu değiştirdiği için iki dal da
   * denetimden geçmeli (gerekçe: chars/index.ts dev kancasındaki not). Sade
   * dalda kaşlar tampona hiç girmiyor — ölü vertex kolunun asıl hedefi bu dal.
   * Kanca QUALITY vermiyorsa dal çevrilemez; istek yine de gelmişse sessiz
   * `TypeError` yerine not düşülür.
   */
  const LODS = I.QUALITY ? (opts.lods ?? [false, true]) : [null];
  if (!I.QUALITY) {
    notes.push(
      opts.lods
        ? 'opts.lods verildi ama kanca QUALITY vermiyor — LOD dalı çevrilemedi, yalnız o anki dal koşuldu'
        : '__charInternals.QUALITY yok — yalnız o anki LOD dalı koşuldu, diğer dal SINANMADI',
    );
  }

  const rows = [];
  const byJoint = {};
  const checked = {};
  for (const n of NODES) checked[n] = 0;

  let rowCount = 0;
  let matrixChecks = 0;
  let vertexChecks = 0;
  let jointFinite = true;
  let vertexFinite = true;
  let deadVertices = 0;
  /** Kaynak primitiflerin kendi index'inin atladığı vertex'ler — ihlal DEĞİL. */
  let sourceDeadVertices = 0;
  let sourceDeadMissing = false;
  let minVertexCount = Infinity;
  let maxVertexCount = 0;
  // `drawCalls` vaka maksimumu, `drawCallsMin` minimumu — eşit değillerse
  // kurucu vakadan vakaya farklı sayıda grup üretiyor demektir.
  let drawCalls = 0;
  let drawCallsMin = Infinity;
  let drawCallViolations = 0;

  /**
   * NORMAL DEĞİŞMEZİ (Task 10 Adım 1b) — kip değişiminden SAĞ ÇIKAN kol,
   * çünkü baştan LEGACY'DEN BAĞIMSIZ tasarlandı.
   *
   * NEDEN VAR: kapı Adım 1b'ye kadar normal vektörlerini HİÇ okumuyordu, oysa
   * Task 9b `CharacterSkin.buildSkin` içinde three'nin
   * `BufferGeometry.applyMatrix4`ünün normal işini ELLE yazdı
   * (`Matrix3.getNormalMatrix` + `applyNormalMatrix`). Yanlış normal SESSİZDİR:
   * konum, çizim çağrısı, matris kollarının hepsi yeşil kalır ve karakter
   * yalnızca YANLIŞ IŞIKLANIR. Kol legacy hâlâ ayaktayken eklendi ve iki
   * tarafta da yeşil yandığı görüldü — referans taraf kalkmadan önce, tam da
   * Task 9b Adım B'yi gerekçelendiren argümanla.
   *
   * İKİ DEĞİŞMEZ, HER İKİSİ DE TEK TARAFLI (karşılaştırma değil):
   *   1) her üçgende `dot(faceNormal(konum), vertexNormal) > 0` — normal
   *      yüzeyin dışına bakıyor mu, sarım yönüyle tutarlı mı,
   *   2) her normal BİRİM boyda mı (dönüşümden sonra yeniden normalize
   *      edilmiş mi).
   *
   * POZ-BAĞIMSIZ, bu yüzden VAKA BAŞINA BİR KEZ çağrılır, dilim döngüsünün
   * DIŞINDA: normal özniteliği kurulum anında yazılır, animatör ona hiç
   * dokunmaz. Dilim başına tekrarlamak aynı sayıyı on kez ölçmek olurdu.
   *
   * HAM ÖZNİTELİK okunur, `applyBoneTransform` UYGULANMAZ: ölçülen şey
   * `buildSkin`in tampona YAZDIĞI normal, kemik dönüşümünün ondan sonra ne
   * yaptığı değil.
   *
   * DEJENERE NORMALLER İHLAL DEĞİL. Ham kaynak geometride sıfır uzunluklu
   * normaller var (`SphereGeometry` kutupları ve `computeVertexNormals` ile
   * kurulan `roundBox`) — yeni kodun ürettiği bir bozukluk değil, KAYNAKTAN
   * geliyor. KANITI: legacy hâlâ ayaktayken iki tarafta BİREBİR aynı sayı
   * ölçüldü (160 vakada 3462 / 3462). Bunları ihlal saymak KALICI bir yanlış
   * alarm olur ve bir sonraki geliştirici kolu kapatır. Yine de sessizce
   * büyümesinler diye sayıları raporda ayrı alanda duruyor; sıfır ALANLI
   * üçgenler de öyle (ölçüldü: 0).
   *
   * `NORMAL_UNIT_TOL` bilinçli olarak `opts`a AÇILMIYOR — pay 23 bin kat
   * (ölçülen en kötü sapma 4,26e-8), gevşetilecek bir şey yok.
   */
  const NORMAL_UNIT_TOL = 1e-3;
  const NORMAL_DEGEN = 1e-6;
  let normalViolations = 0;
  let normalFaceChecks = 0;
  let normalUnitChecks = 0;
  let normalMinDot = Infinity;
  let normalWorstUnitErr = 0;
  let normalDegenerate = 0;
  let normalDegenerateFaces = 0;

  const flag = (row) => {
    rowCount++;
    if (rows.length < ROW_CAP) rows.push(row);
    byJoint[row.joint] = (byJoint[row.joint] ?? 0) + 1;
  };

  /**
   * TEŞHİS ETİKETİ: mesh'lerin kendi adı yok (yalnız `Bone`lar `joint()`ta
   * adlandırılıyor), bu yüzden sapma satırında "hangi parça" sorusuna en yakın
   * adlandırılmış ATA ile cevap veriliyor — tam isabet değil ama `flag()`
   * satırını kör bırakmaktan iyi.
   */
  const labelOf = (o) => {
    if (o.name) return o.name;
    for (let n = o.parent; n; n = n.parent) if (n.name) return n.name;
    return '(adsız)';
  };

  /**
   * Çizim çağrısı sayımı. `traverse` ata zincirindeki `visible=false`a
   * bakmaz, renderer ise invisible bir düğümün ALTINA hiç inmez — elle
   * özyineleme o davranışı taklit eder (aynı düzeltme rig-probe.js'te de var).
   */
  const countDraws = (root) => {
    let n = 0;
    const walk = (o) => {
      if (!o.visible) return;
      if (o.isMesh || o.isSkinnedMesh) {
        const gr = o.geometry.groups;
        n += gr && gr.length ? gr.length : 1;
      }
      for (const c of o.children) walk(c);
    };
    walk(root);
    return n;
  };

  /**
   * Normal değişmezini rig'in TÜM geometrilerinde denetler — gerekçe ve
   * kapsam yukarıdaki NORMAL DEĞİŞMEZİ notunda.
   *
   * `visible=false` alt ağaçlar ATLANMAZ (`countDraws`un tersine): bu kol
   * çizim bütçesi değil, TAMPONUN İÇERİĞİ hakkında konuşuyor.
   */
  const TRI = [0, 0, 0];
  const checkNormals = (rig, tag) => {
    const walk = (o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        const pos = o.geometry.getAttribute('position');
        const nrm = o.geometry.getAttribute('normal');
        if (pos && nrm) {
          const label = labelOf(o);

          /* (2) BİRİM BOY — TÜM normaller. */
          for (let i = 0; i < nrm.count; i++) {
            const nx = nrm.getX(i);
            const ny = nrm.getY(i);
            const nz = nrm.getZ(i);
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (len < NORMAL_DEGEN) {
              normalDegenerate++;
              continue;
            }
            normalUnitChecks++;
            const err = Math.abs(len - 1);
            if (err > normalWorstUnitErr) normalWorstUnitErr = err;
            if (err > NORMAL_UNIT_TOL) {
              normalViolations++;
              flag({ ...tag, kind: 'normal boyu', joint: label, err });
            }
          }

          /* (1) DIŞA BAKIYOR MU — üçgen üçgen. Yüz normali (B−A)×(C−A);
           * three'nin primitiflerinde sarım saat yönünün tersi, dolayısıyla
           * doğru bir vertex normali onunla POZİTİF çarpım verir. */
          const idx = o.geometry.index;
          const triCount = Math.floor((idx ? idx.count : pos.count) / 3);
          for (let t = 0; t < triCount; t++) {
            const k = t * 3;
            TRI[0] = idx ? idx.getX(k) : k;
            TRI[1] = idx ? idx.getX(k + 1) : k + 1;
            TRI[2] = idx ? idx.getX(k + 2) : k + 2;
            const ax = pos.getX(TRI[0]);
            const ay = pos.getY(TRI[0]);
            const az = pos.getZ(TRI[0]);
            const bx = pos.getX(TRI[1]) - ax;
            const by = pos.getY(TRI[1]) - ay;
            const bz = pos.getZ(TRI[1]) - az;
            const cx = pos.getX(TRI[2]) - ax;
            const cy = pos.getY(TRI[2]) - ay;
            const cz = pos.getZ(TRI[2]) - az;
            let fx = by * cz - bz * cy;
            let fy = bz * cx - bx * cz;
            let fz = bx * cy - by * cx;
            const fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
            // Sıfır ALANLI üçgenin yönü yok — yönü olmayan bir şeye "dışa
            // bakıyor mu" sorulamaz (dejenere normalle aynı gerekçe).
            if (fl < NORMAL_DEGEN) {
              normalDegenerateFaces++;
              continue;
            }
            fx /= fl;
            fy /= fl;
            fz /= fl;
            for (let c = 0; c < 3; c++) {
              const v = TRI[c];
              const nx = nrm.getX(v);
              const ny = nrm.getY(v);
              const nz = nrm.getZ(v);
              // Dejenere vertex normali: birim-boy kolunda zaten sayıldı.
              if (nx * nx + ny * ny + nz * nz < NORMAL_DEGEN * NORMAL_DEGEN) continue;
              normalFaceChecks++;
              const d = fx * nx + fy * ny + fz * nz;
              if (d < normalMinDot) normalMinDot = d;
              if (!(d > 0)) {
                normalViolations++;
                flag({ ...tag, kind: 'normal yönü', joint: label, err: d });
              }
            }
          }
        }
      }
      for (const ch of o.children) walk(ch);
    };
    walk(rig.root);
  };

  /**
   * VERTEX TAMPONU — boş değil, sonlu ve ÖLÜ VERTEX'SİZ.
   *
   * ÖLÜ VERTEX KOLU (Task 6'dan devreden Minor, Task 10'da kapandı). Task 6
   * sade LOD dalında kaş vertex'lerini tampona koyup yalnız index'ini
   * boşaltmak zorunda kalmıştı: silmek karşılaştırmalı kipin
   * `countMismatches` ölçütünü kırardı, çünkü eski rig kaş mesh'ini
   * `visible=false` olarak KURUYORDU ve iki tarafın vertex SAYISI eşit olmak
   * zorundaydı. Bedeli karakter başına 442 ölü vertex ≈ 30 KB VRAM — tam da
   * LOD'un hizmet ettiği zayıf cihazlarda. Karşılaştırmalı kip kalkınca kısıt
   * da kalktı; filtre `CharacterRig.add()`e taşındı ve gizli parça artık
   * tampona hiç girmiyor.
   *
   * Bu kol o kararın BEKÇİSİ: KURUCUYA ATFEDİLEBİLİR her referanssız vertex
   * bir gerilemedir (sessizce VRAM yiyor, hiçbir şey çizmiyor). İleride
   * bilinçli olarak referanssız vertex gerekirse bu kol ve
   * `CharacterRig.add()` BİRLİKTE değiştirilmeli — yalnız birini değiştirmek
   * ölçümü yanıltıcı kılar.
   *
   * KAYNAKTAN MİRAS PAY DÜŞÜLÜR. Ham tamponda referanssız vertex sayısı SIFIR
   * DEĞİL: three'nin `SphereGeometry`si kutup dikişinde kendi index'inin
   * referans vermediği 2 vertex üretiyor (ölçüldü: sph 63→2, roundBox 221→2,
   * box/cyl/torus→0) ve karakter başına ~26 küre türevi parça var, yani
   * ~53 vertex KURUCUDAN BAĞIMSIZ olarak miras alınıyor. Ham sayıyı ihlal
   * saymak kalıcı yanlış alarm olurdu ve kol kapatılırdı — dejenere normaller
   * için verilen kararın aynısı. `buildSkin` bu payı DEV'de tam olarak
   * hesaplayıp `geometry.userData.sourceDeadVerts`e yazıyor (parça başına
   * değil, paylaşımlı geometri başına memoize), böylece ayrım EŞİKSİZ:
   *   kurucuya ait ölü vertex = referanssız − sourceDeadVerts, 0 olmalı.
   * Miras pay yine de raporda ayrı alanda duruyor ki sessizce büyümesin.
   */
  const checkVertices = (rig, tag) => {
    const geo = rig.skinned && rig.skinned.geometry;
    const pos = geo && geo.getAttribute('position');
    if (!pos || pos.count === 0) {
      vertexFinite = false;
      flag({ ...tag, kind: 'vertex', joint: 'vertex', err: 'vertex bulutu boş' });
      return;
    }
    if (pos.count < minVertexCount) minVertexCount = pos.count;
    if (pos.count > maxVertexCount) maxVertexCount = pos.count;

    for (let i = 0; i < pos.count; i++) {
      vertexChecks += 3;
      if (!Number.isFinite(pos.getX(i)) || !Number.isFinite(pos.getY(i)) || !Number.isFinite(pos.getZ(i))) {
        vertexFinite = false;
        flag({ ...tag, kind: 'vertex', joint: 'vertex', err: `konum ${i} sonlu değil` });
        break;
      }
    }

    const idx = geo.index;
    if (!idx) {
      flag({ ...tag, kind: 'vertex', joint: 'vertex', err: 'geometri indeksiz — kova grupları index aralığı' });
      return;
    }
    // Referans verilen vertex'leri işaretle; sınır dışı index de burada çıkar.
    const seen = new Uint8Array(pos.count);
    let outOfRange = 0;
    for (let k = 0; k < idx.count; k++) {
      const v = idx.getX(k);
      if (v < 0 || v >= pos.count) outOfRange++;
      else seen[v] = 1;
    }
    if (outOfRange > 0) {
      flag({ ...tag, kind: 'vertex', joint: 'vertex', err: `${outOfRange} index sınır dışı` });
    }
    let referenced = 0;
    for (let i = 0; i < seen.length; i++) referenced += seen[i];
    const unreferenced = pos.count - referenced;

    /**
     * Kaynaktan miras pay `buildSkin`in DEV'de yazdığı sayı. ALANIN YOKLUĞU
     * SESSİZCE GEÇİLMEZ: `undefined` gelirse çıkarma NaN üretip kolu sessizce
     * kapatırdı, bu yüzden not düşülür (körlük `pass`i zaten düşürür).
     */
    const src = geo.userData ? geo.userData.sourceDeadVerts : undefined;
    if (typeof src !== 'number') {
      if (!sourceDeadMissing) {
        sourceDeadMissing = true;
        notes.push('geometry.userData.sourceDeadVerts yok — ölü vertex kolu kaynaktan miras payı ayıramıyor (CharacterSkin.ts DEV bloğu elendi mi?)');
      }
      return;
    }
    sourceDeadVertices += src;

    const dead = unreferenced - src;
    if (dead !== 0) {
      deadVertices += dead;
      flag({
        ...tag, kind: 'ölü vertex', joint: 'ölü vertex',
        err: `kurucuya ait ${dead} referanssız vertex (toplam ${unreferenced}, kaynaktan miras ${src}, ${referenced}/${pos.count})`,
      });
    }
  };

  /** Bir matris dizisinin tamamı sonlu mu? */
  const allFinite = (elements) => {
    for (const e of elements) if (!Number.isFinite(e)) return false;
    return true;
  };

  /**
   * Vakalar. Müşteri arketipi (`variant % 8`) parça kompozisyonunu tamamen
   * değiştiriyor — konik etek, inik kapüşon, geniş hasır şapka, elde sepet,
   * koltuk altında çanta — bu yüzden sekizi de ayrı vaka.
   *
   * Personel seviyesi 0/3/6/8 diye DÖNÜYOR: `rankStripes` seviyeyi 3'e bölüp
   * yuvarlıyor, yani 0-3 rütbe çizgisinin dördü de ancak bu kümeyle kuruluyor.
   */
  const LEVELS = [0, 3, 6, 8];
  const SEEDS = opts.seeds ?? [1, 7, 42, 1337, 90210];
  const cases = [];
  for (const lod of LODS) {
    for (const seed of SEEDS) {
      for (const role of ROLES) {
        const variants = role === 'customer' ? [0, 1, 2, 3, 4, 5, 6, 7] : [0];
        for (const variant of variants) {
          cases.push({ lod, seed, role, variant, level: LEVELS[cases.length % LEVELS.length] });
        }
      }
    }
  }

  /**
   * ÜNİFORMA KOZMETİĞİ. Yukarıdaki üretim `createAppearance`e hiç `uniform`
   * vermiyor, yani her vaka `uniformSkin('')` → `house: null` alıyor ve
   * `applyUniform` hiç çalışmıyor (data/cosmetics.ts). `applyUniform`in
   * üzerine yazdığı alanlar (apron/over/overAlt/shirt/sleeve/hat/forearm —
   * role göre değişir, bkz. Appearance.ts) ayrı vakalarla kapsanıyor; yalnız
   * personel rolleri etkileniyor.
   */
  const UNIFORMS = opts.uniforms ?? ['bakir', 'gece'];
  for (const role of ['waiter', 'cashier', 'busser', 'barista', 'runner']) {
    for (const uniform of UNIFORMS) {
      cases.push({
        lod: null,
        seed: SEEDS[0],
        role,
        variant: 0,
        level: LEVELS[cases.length % LEVELS.length],
        uniform,
      });
    }
  }

  const lodWas = I.QUALITY ? I.QUALITY.charLod : null;
  try {
    for (const c of cases) {
      if (c.lod !== null) I.QUALITY.charLod = c.lod;
      const spec = I.createAppearance(c.role, {
        seed: c.seed, variant: c.variant, level: c.level, uniform: c.uniform,
      });
      const rig = I.buildRig(spec);
      const anim = new I.CharacterAnimator(rig, spec, c.seed);
      const tag = { lod: c.lod, seed: c.seed, role: c.role, variant: c.variant, uniform: c.uniform };

      const dc = countDraws(rig.root);
      if (dc > drawCalls) drawCalls = dc;
      if (dc < drawCallsMin) drawCallsMin = dc;
      if (dc !== EXPECT_DRAWS) {
        drawCallViolations++;
        flag({
          ...tag, kind: 'çizim çağrısı', joint: 'çizim çağrısı',
          err: `beklenen ${EXPECT_DRAWS}, bulunan ${dc}`,
        });
      }

      // İkisi de POZ-BAĞIMSIZ: vaka başına bir kez, dilim döngüsünün DIŞINDA.
      checkNormals(rig, tag);
      checkVertices(rig, tag);

      for (const seg of SEGMENTS) {
        // Katmanlar durum değil: her dilimde AÇIKÇA yazılır, yoksa önceki
        // dilimin taşıma/itme ağırlığı sızar ve dilim adı yalan söyler.
        anim.setState(seg.state);
        anim.setCarryCount(seg.carry ?? 0);
        anim.setPush(seg.push === true, seg.sweep === true);
        const spd = seg.spd ?? 0;
        for (let f = 0; f < FRAMES; f++) anim.update(1 / 60, spd);

        rig.root.updateMatrixWorld(true);
        for (const name of NODES) {
          const o = rig[name];
          if (!o) continue;
          checked[name]++;
          matrixChecks++;
          if (!allFinite(o.matrixWorld.elements)) {
            jointFinite = false;
            flag({ ...tag, state: seg.state, kind: 'matris', joint: name, err: 'matrisi NaN/Infinity' });
          }
        }

        /**
         * GPU'NUN OKUDUĞU MATRİSLER. `skeleton.boneMatrices` sahne
         * grafiğinden AYRI bir tampon (`bone.matrixWorld × boneInverse`) ve
         * skinning'i gerçekten o sürüyor: `matrixWorld`ler temizken bile
         * bozuk bir `bindMatrix`/`boneInverse` buraya NaN taşıyabilir.
         * `update()` elle çağrılıyor çünkü render yok.
         */
        const skeleton = rig.skinned && rig.skinned.skeleton;
        if (skeleton) {
          skeleton.update();
          matrixChecks += skeleton.bones.length;
          if (!allFinite(skeleton.boneMatrices)) {
            jointFinite = false;
            flag({ ...tag, state: seg.state, kind: 'matris', joint: 'boneMatrices', err: 'kemik dokusu NaN' });
          }
        }
      }

      /**
       * Temizlik GERÇEK YOLDAN: `anim.dispose()` rig'in `disposeOwned`
       * kapanışını çağırır ve karaktere ait İKİ GPU kaynağını da bırakır —
       * birleşik tampon ve `Skeleton`in kemik dokusu (karakter başına ayrı bir
       * DataTexture). Yalnız `geometry.dispose()` çağırmak dokuyu sızdırır ve
       * 160 vakalık bir koşumda birikir.
       */
      anim.dispose();
      rig.root.clear();
    }
  } finally {
    if (lodWas !== null) I.QUALITY.charLod = lodWas;
  }

  /* ------------------------------------------------------- körlük kontrolü */

  const nodesNeverChecked = NODES.filter((n) => n !== 'ponytail' && checked[n] === 0);
  if (nodesNeverChecked.length) {
    notes.push(`hiç denetlenmeyen düğüm: ${nodesNeverChecked.join(', ')} — Rig alan adları değişti mi?`);
  }
  if (checked.ponytail === 0) {
    notes.push('ponytail hiçbir vakada bulunamadı — at kuyruklu rol (cashier) kapsam dışında kaldı');
  }
  if (matrixChecks === 0 || vertexChecks === 0) {
    notes.push('SIFIR denetim yapıldı — kapı hiçbir şey ölçmedi');
  }
  if (normalFaceChecks === 0 || normalUnitChecks === 0) {
    notes.push('normal kolu hiç kontrol yapmadı — `normalViolations: 0` güvencesi BOŞ');
  }
  if (drawCalls === 0) {
    notes.push('çizim çağrısı kolu hiç çağrı saymadı — `drawCalls` güvencesi BOŞ');
  }

  const pass =
    rowCount === 0 &&
    jointFinite &&
    vertexFinite &&
    deadVertices === 0 &&
    drawCallViolations === 0 &&
    normalViolations === 0 &&
    notes.length === 0;

  const report = {
    pass,
    /** Vaka maksimumu; `drawCallsMin`den farklıysa dallar ayrışmış demektir. */
    drawCalls,
    drawCallsMin: Number.isFinite(drawCallsMin) ? drawCallsMin : 0,
    drawCallViolations,
    jointFinite,
    vertexFinite,
    /** KURUCUYA ait referanssız vertex sayısı — 0 olmalı (bkz. checkVertices). */
    deadVertices,
    /**
     * Kaynak primitiflerden miras referanssız vertex (SphereGeometry kutup
     * dikişi) — ihlal değil, ama sessizce büyümesin diye raporda.
     */
    sourceDeadVertices,
    /** Dışa bakmayan ya da birim olmayan normal sayısı — 0 olmalı. */
    normalViolations,
    rows: rows.slice(0, 40),
    rowCount,
    byJoint,
    // Denetimin NE KADAR şey ölçtüğü raporun parçası: sayı düşerse kapsam
    // sessizce daralmış demektir.
    coverage: {
      cases: cases.length,
      lods: LODS,
      frames: FRAMES,
      segments: SEGMENTS.length,
      nodes: NODES.length,
      matrixChecks,
      vertexChecks,
      vertexCount: { min: Number.isFinite(minVertexCount) ? minVertexCount : 0, max: maxVertexCount },
      normalFaceChecks,
      normalUnitChecks,
      normalMinDot: Number.isFinite(normalMinDot) ? normalMinDot : null,
      normalWorstUnitErr,
      normalDegenerate,
      normalDegenerateFaces,
      ponytailCases: checked.ponytail,
      nodesNeverChecked,
    },
    notes,
    ms: Math.round(performance.now() - t0),
  };
  window.__rigIdentityReport = report;
  console.log(pass ? '✅ SAĞLIKLI' : '❌ SORUN VAR', report);
  if (rows.length) console.table(report.rows);
  for (const n of notes) console.error('⛔', n);
  return report;
}

window.__rigIdentity = __rigIdentity;
