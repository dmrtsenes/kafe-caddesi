# Skinned Karakter — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Karakterleri katı mesh hiyerarşisinden tek skinned mesh'e taşıyıp karakter başına çizim çağrısını ~41'den 2'ye indirmek, ardından boşalan bütçeyle düşük kademenin görsel tavanını yükseltmek.

**Architecture:** Her vertex eski ebeveyn eklemine 1,0 ağırlıkla bağlanır (*katı skinning*), böylece GPU'nun uyguladığı dönüşüm bugünkü sahne grafiğininkiyle aynı matris çarpımı olur — sadakat kurulum gereği garantidir. `THREE.Bone`, `THREE.Group` ile aynı transform API'sini taşıdığı için `CharacterAnimator`'ın 19 eklem satırı değişmez. Palet renkleri materyalden vertex özniteliğine taşınır; böylece karakter başına 23 materyal, tüm karakterlerin paylaştığı 2 global materyale iner (ışıklı gövde + ışıksız yüz).

**Tech Stack:** TypeScript 5.6, three 0.169 (`SkinnedMesh`, `Skeleton`, `Bone`, `BufferGeometryUtils.mergeGeometries`), Vite 5.4, Capacitor 8. Test çerçevesi **yok** — doğrulama `npm run typecheck` + tarayıcıda koşan `tools/*.js` ölçüm araçlarıyla yapılır.

**Spec:** `docs/superpowers/specs/2026-08-17-skinned-karakter-design.md`

---

## Global Constraints

Bu bölümün kuralları **her task için geçerlidir**, ayrıca tekrarlanmasa bile.

- **Görsel çıktı değişmeyecek.** Her task sonunda özdeşlik testi (Task 3'ten sonra mevcut) yeşil olmalı. "Gözle iyi görünüyor" kabul değil.
- **Kalite AŞAĞI değil YUKARI** (spec 2.1, oyuncu kararı 2026-08-17). Hiçbir task hız için görsel bedel ödemez. Kırpma (LOD zorlama, gölge kapatma, müşteri azaltma) bir çözüm değil, geri alınacak bir borçtur.
- **Çözünürlüğe dokunulmaz.** `DPR_CAP = 2,0` sabit kalır (`src/core/Quality.ts:28`). Tek istisna oyuncunun elle açtığı "Düşük Kalite" anahtarıdır; o kod yolu değişmez.
- **Isı merdiveninin eşikleri ve basamak sırası değişmez** (`Quality.evaluateHeat`). Yalnız `TIERS` tabanları yükselir, o da Task 11'de.
- **Türkçe metin PowerShell ile yazılmaz.** `Get-Content`/`Set-Content` bu depoda metni çifte kodlayıp mojibake üretir. Dosya düzenleme yalnız Edit/Write araçlarıyla; commit mesajları Bash heredoc ile.
- **Yorumlar projenin üslubunu izler:** kararın *nedenini* ve varsa ölçülen sayıyı yazar, kodu tekrar etmez.
- **`npm run typecheck` her task'ın son adımından önce temiz geçmeli.** Derleme betiği zaten `tsc --noEmit && vite build`.
- **Commit mesajları Türkçe**, depo kalıbında küçük harfli önekle (`rig:`, `perf:`, `belge:`, `spec:`).

### Tarayıcı aracını yükleme kalıbı (bu projenin doğrulama idiomu)

Bu depoda test koşucusu yoktur; ölçüm araçları `tools/` altında düz JS dosyalarıdır ve tarayıcı konsolunda `eval` edilir. Oyunun tamamı `window.__fincan` üzerinden erişilebilir (`src/main.ts:36`, tip: `Game`).

```js
// 1) npm run dev  →  http://localhost:5173  aç, oyun açılsın (perde kalksın)
// 2) DevTools konsolunda:
const ROOT = 'C:/Users/Enes/Desktop/oyun';
const load = async (f) => eval(await (await fetch('/@fs/' + ROOT + '/tools/' + f)).text());
```

Ölçüm sonucu her zaman bir `window.__*Report` nesnesine yazılır ve konsola tablo olarak basılır — `balance-bot.js`'in kalıbı budur, yeni araçlar da onu izler.

### ⚠️ Ajan tarayıcısında rAF DONUK — "oyunu oynat" işlemez

Bu ortamdaki tarayıcı paneli kompozit etmiyor: `requestAnimationFrame` ilerlemiyor, dolayısıyla `Game.start()`'ın döngüsü hiç koşmuyor ve oyun kendi başına ilerlemiyor. Ekran görüntüsü de alınamıyor. Planda "oyunu N dakika oynat" diyen her adım bu ortamda **elle sürülmelidir**:

```js
// STANDART ÖLÇÜM YORDAMI — sahneyi doldur, sonra elle bir kare çiz.
const ROOT = 'C:/Users/Enes/Desktop/oyun';
const g = window.__fincan;

// 1) Simülasyonu ilerlet: bot rAF'a hiç dokunmadan sabit adımla pompalar.
//    (Bot başta g.stop() çağırır, bitişte scene3d.render'ı geri verir.)
eval(await (await fetch('/@fs/' + ROOT + '/tools/balance-bot.js')).text());
__runBalanceBot({ minutes: 12, sync: true }); // ~12 dk oyun ≈ 3 sn CPU

// 2) Elle bir kare çiz — renderer.info sayaçları ancak bununla dolar.
g.scene3d.render();

// 3) Şimdi ölç.
```

Bot bitişte `localStorage`'ı temizler ve oyunu durdurulmuş bırakır; ölçüm için sorun değil, ama **kademe seçimi de silinir** (bkz. Task 12 Step 2).

**Kare dökümü** de aynı sebeple elle: `g.scene3d.render()` çağrılmadan `toDataURL` boş/eski kare verir.

### ⚠️ Termal bantlar bu ortamda ÖLÇÜLEMEZ

Isı merdiveni `evaluateHeat(workMs, fps)` ile beslenir ve bu çağrı yalnız rAF döngüsünden gelir. rAF donuk olduğu için merdiven hiç çalışmaz — yani "ısı basamağı ≤1" bandı ajan tarayıcısında **doğrulanamaz**. Bu bantlar gerçek cihaz ister:

- Android: `npm run android:apk` → telefona kur → `?perf=1` yazısını izle
- ya da kullanıcının gerçek Chrome'unda dev sunucusunu aç

**Yapısal ve hesaplamalı doğrulamaların hepsi bu ortamda çalışır** ve planın kapılarının çoğu odur: özdeşlik testi (saf hesap), çizim çağrısı sayımı (elle bir kare), doğum maliyeti (saf hesap), sızıntı ölçümü (elle kare), kare dökümü (elle kare + POST). Yalnız termal/fps bantları cihaza kalır — Task 11 Step 4 ve Task 12 Step 1/2/3.

### Yararlı erişim noktaları

| Ne | Nerede |
|---|---|
| Oyun tutamağı | `window.__fincan` (`Game`) |
| Çizim çağrısı sayacı | `__fincan.scene3d.renderer.info.render.calls` |
| Üçgen sayacı | `__fincan.scene3d.renderer.info.render.triangles` |
| Perf yazısı | URL'ye `?perf=1` |
| Karakter fabrikası | `createCharacter(role, opts)` — `src/chars/index.ts:88` |
| Kare dökümü | `POST /__shot` `{name, data}` → `.devshots/<name>` (`vite.config.ts:11`) |
| Denge botu | `tools/balance-bot.js` → `__runBalanceBot({minutes, sync:true})` |

---

## File Structure

| Dosya | Sorumluluk | Durum |
|---|---|---|
| `src/chars/CharacterRig.ts` | İskelet + geometri kurulumu. Bu planda `joint()` kemik üretir, birleştirme tek skinned geometriye çıkar. | Değişir (ana iş) |
| `src/chars/CharacterSkin.ts` | **Yeni.** Parça listesini tek skinned geometriye çeviren saf dönüşüm: öznitelik normalleştirme, vertex renk yazımı, kemik indeksi/ağırlığı, materyal gruplaması. `CharacterRig`'in şişmesini önler. | Yeni |
| `src/chars/CharacterMaterials.ts` | **Yeni.** İki global karakter materyali (ışıklı/ışıksız) ve kafa tint yardımcısı. Tek sahip, tek yerden dispose. | Yeni |
| `src/chars/CharacterAnimator.ts` | Prosedürel animasyon. Yalnız 7 ölçek hedefi kemiğe taşınır; 19 eklem satırı **değişmez**. | Küçük değişim |
| `src/chars/types.ts` | `Rig` arayüzü ve karakter tipleri. | Değişir |
| `src/chars/index.ts` | Karakter fabrikası ve `dispose()`. Geometri artık karaktere ait olduğu için serbest bırakılmalı. | Küçük değişim |
| `src/core/Quality.ts` | `TIERS` tabanları (Task 11) + başlıktaki ölçüm notu. | Değişir |
| `tools/rig-probe.js` | **Yeni.** Ölçüm temeli: karakter başına mesh/vertex/materyal + sahne çizim çağrısı. | Yeni |
| `tools/rig-identity.js` | **Yeni.** Eski ↔ yeni rig sayısal özdeşlik testi. Bu planın asıl kapısı. | Yeni |

`CharacterRig.ts` bugün 876 satır ve bu iş ona hem kemik hem birleştirme hem renk mantığı ekliyor. Bu yüzden birleştirme (`CharacterSkin.ts`) ve materyal sahipliği (`CharacterMaterials.ts`) ayrı dosyalara çıkarılır: rig "neyi nereye koyacağını", skin "bunu nasıl tek mesh'e çevireceğini" bilir. `chars/` dışından rig içine erişim yok (doğrulandı), bu yüzden yayılma alanı bu tabloyla kapalıdır.

---

### Task 1: Ölçüm temeli — bugünü rakamla kaydet

Hiçbir şeyi değiştirmeden önce "önce" değerlerini almazsak, sonraki hiçbir iddiayı kanıtlayamayız. Spec'in vertex tahmini (4-8k) de burada gerçek sayıyla değiştirilecek.

**Files:**
- Create: `tools/rig-probe.js`

**Interfaces:**
- Consumes: `window.__fincan` (`Game`), `__fincan.scene3d.renderer.info.render`
- Produces: `window.__rigProbe()` → `{ perChar: {meshes, vertices, materials, drawCalls}, scene: {calls, triangles}, actors }`; sonuç `window.__rigProbeReport`'a da yazılır. Task 12 bu aracı "sonra" ölçümü için yeniden koşar.

- [ ] **Step 1: Aracı yaz**

```js
/**
 * RIG SONDASI — karakter başına çizim maliyetinin ölçüm temeli.
 *
 * Neden var: skinned geçişinin kazancı "önce/sonra" olmadan iddiadan
 * ibarettir. Bu araç iki soruyu rakamla cevaplar: bir karakter kaç mesh /
 * vertex / materyal, ve sahnenin tamamı kaç çizim çağrısı.
 *
 * Kullanım: konsolda eval ettikten sonra  __rigProbe()
 */
/* eslint-disable no-console */
function __rigProbe() {
  const g = window.__fincan;
  if (!g) throw new Error('window.__fincan yok — oyun açılmadı mı?');

  // Sahnedeki ilk karakter kökünü bul: rig kökünün adı 'char'.
  const roots = [];
  g.scene3d.scene.traverse((o) => {
    if (o.name === 'char') roots.push(o);
  });
  if (!roots.length) throw new Error('sahnede karakter yok — biraz oyna, müşteri gelsin');

  const measure = (root) => {
    let meshes = 0;
    let vertices = 0;
    let triangles = 0;
    const mats = new Set();
    root.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      // visible=false olan mesh çizim çağrısı üretmez; bütçeye girmez.
      if (!o.visible) return;
      const geo = o.geometry;
      const pos = geo.getAttribute('position');
      vertices += pos ? pos.count : 0;
      triangles += geo.index ? geo.index.count / 3 : (pos ? pos.count / 3 : 0);
      // Materyal dizisi + geometri grubu = grup başına bir çizim çağrısı.
      const groups = geo.groups && geo.groups.length ? geo.groups.length : 1;
      meshes += groups;
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => mats.add(x.uuid));
      else mats.add(m.uuid);
    });
    return { drawCalls: meshes, vertices, triangles: Math.round(triangles), materials: mats.size };
  };

  const per = roots.map(measure);
  const avg = (k) => Math.round(per.reduce((s, p) => s + p[k], 0) / per.length);

  const report = {
    actors: roots.length,
    perChar: {
      drawCalls: avg('drawCalls'),
      vertices: avg('vertices'),
      triangles: avg('triangles'),
      materials: avg('materials'),
    },
    scene: {
      calls: g.scene3d.renderer.info.render.calls,
      triangles: g.scene3d.renderer.info.render.triangles,
    },
    quality: { tier: g.scene3d.renderer.shadowMap.enabled ? 'gölge açık' : 'gölge kapalı' },
  };
  window.__rigProbeReport = report;
  console.table(report.perChar);
  console.log('sahne:', report.scene, '· aktör:', report.actors);
  return report;
}
```

- [ ] **Step 2: Dev sunucusunu başlat ve aracı koştur**

`npm run dev` çalıştır, `http://localhost:5173/?perf=1` aç. Ajan tarayıcısında rAF donuk olduğu için oyun kendi başına ilerlemez — Global Constraints'teki **standart ölçüm yordamını** uygula:

```js
const ROOT = 'C:/Users/Enes/Desktop/oyun';
const g = window.__fincan;

// Sahneyi doldur: 12 dk simülasyon müşteri ve personeli mekâna yerleştirir.
eval(await (await fetch('/@fs/' + ROOT + '/tools/balance-bot.js')).text());
__runBalanceBot({ minutes: 12, sync: true });

// renderer.info sayaçları ancak gerçek bir kareyle dolar.
g.scene3d.render();

eval(await (await fetch('/@fs/' + ROOT + '/tools/rig-probe.js')).text());
__rigProbe();
```

Beklenen: `perChar.drawCalls` **20-45 arası** (LOD durumuna göre), `perChar.materials` **15-25 arası**. Bu bandın dışındaysa sonda bir hata var — düzelt, çünkü tüm plan bu rakama dayanıyor.

- [ ] **Step 3: Sayıları plana yaz**

Ölçülen değerleri bu dosyanın **Ölçüm Kütüğü** bölümüne (planın sonunda) işle. Task 12 bunları "sonra" değerleriyle karşılaştıracak.

- [ ] **Step 4: Commit**

```bash
git add tools/rig-probe.js docs/superpowers/plans/2026-08-17-skinned-karakter.md
git commit -F - <<'EOF'
perf: rig sondası — karakter başına çizim maliyetinin ölçüm temeli

Skinned geçişinin kazancı önce/sonra olmadan iddiadan ibaret. Sonda
karakter başına mesh/vertex/materyal ve sahne çizim çağrısını rakamla
veriyor; ölçülen taban plana işlendi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Eski kurucuyu dondur — `buildRigLegacy`

Özdeşlik testinin çalışması için eski ve yeni kurucunun **aynı derlemede** yan yana durması gerekir. Bu task davranışı hiç değiştirmez; yalnız eski kurucuyu ada bağlar.

**Files:**
- Modify: `src/chars/CharacterRig.ts` (`buildRig` → `buildRigLegacy`, yeni bir `buildRig` sarmalayıcı)

**Interfaces:**
- Consumes: yok
- Produces: `export function buildRigLegacy(spec: AppearanceSpec): Rig` — eski, katı-mesh kurucu. `export function buildRig(spec: AppearanceSpec): Rig` şimdilik doğrudan `buildRigLegacy`'ye devrediyor. Task 3 ikisini karşılaştırır; Task 10 `buildRigLegacy`'yi siler.

- [ ] **Step 1: Yeniden adlandır ve sarmala**

`src/chars/CharacterRig.ts` içinde `export function buildRig(spec: AppearanceSpec): Rig {` satırını bul ve şuna çevir:

```ts
/**
 * ESKİ KURUCU — katı mesh hiyerarşisi (karakter başına ~41 mesh).
 *
 * Skinned geçişi boyunca SİLİNMEZ: `tools/rig-identity.js` yeni kurucuyu
 * buna karşı ölçerek görsel özdeşliği kanıtlıyor. Kapı yeşil yandıktan
 * sonra kaldırılacak (plan Task 10).
 */
export function buildRigLegacy(spec: AppearanceSpec): Rig {
```

Dosyanın sonuna (fonksiyonun kapanışından sonra) sarmalayıcıyı ekle:

```ts
/**
 * Karakter iskeleti kurucusu — çağıranların tek kapısı.
 *
 * Şu an eski kurucuya devrediyor; skinned kurucu devreye girdikçe gövdesi
 * değişecek, imzası değişmeyecek.
 */
export function buildRig(spec: AppearanceSpec): Rig {
  return buildRigLegacy(spec);
}
```

- [ ] **Step 2: Tip denetimi**

Run: `npm run typecheck`
Expected: hata yok. (`chars/index.ts` hâlâ `buildRig` çağırıyor ve imza aynı.)

- [ ] **Step 3: Davranış değişmediğini doğrula**

`npm run dev` ile oyunu aç, Task 1'deki sondayı koştur:

```js
const ROOT = 'C:/Users/Enes/Desktop/oyun';
eval(await (await fetch('/@fs/' + ROOT + '/tools/rig-probe.js')).text());
__rigProbe();
```

Expected: `perChar.drawCalls` ve `perChar.materials` Task 1'de kaydedilen değerlerle **aynı**. Farklıysa yeniden adlandırma sırasında bir şey kırılmış.

- [ ] **Step 4: Commit**

```bash
git add src/chars/CharacterRig.ts
git commit -F - <<'EOF'
rig: eski kurucu buildRigLegacy olarak donduruldu

Özdeşlik testi eski ve yeni kurucuyu aynı derlemede yan yana gerektiriyor.
Davranış değişmedi: buildRig şimdilik doğrudan devrediyor, sonda ölçümü
Task 1 temeliyle birebir aynı.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Özdeşlik kapısı — `tools/rig-identity.js`

Planın en önemli task'ı: **testi implementasyondan önce yazıyoruz.** Şu an `buildRig === buildRigLegacy` olduğu için test **geçmek zorunda**. Bilinen-özdeş bir çift üzerinde geçtiğini görmek, sonra kırmızı yandığında hatanın implementasyonda olduğunu (koşucuda değil) bilmemizi sağlar.

**Files:**
- Create: `tools/rig-identity.js`
- Modify: `src/chars/index.ts` (araç için geliştirme kancası)

**Interfaces:**
- Consumes: `buildRigLegacy` ve `buildRig` (Task 2), `CharacterAnimator`, `createAppearance`
- Produces: `window.__rigIdentity({frames, seeds})` → `{ pass: boolean, maxJointError, maxVertexError, colorMismatches, drawCalls: {legacy, next}, rows }`. Sonuç `window.__rigIdentityReport`'a yazılır. Task 4-9'un her biri bu aracı koşup `pass === true` görmek zorundadır.

- [ ] **Step 1: Araç için geliştirme kancasını aç**

Araç tarayıcıda `chars/` içindeki modüllere doğrudan erişemez. `src/chars/index.ts` dosyasının en sonuna ekle:

```ts
/**
 * GELİŞTİRME KANCASI — yalnız `vite dev` derlemesinde tanımlanır.
 *
 * `tools/rig-identity.js` eski ve yeni kurucuyu yan yana koşturup görsel
 * özdeşliği sayısal olarak kanıtlıyor; bunun için iki kurucuya, animatöre
 * ve görünüm reçetesine erişmesi gerekiyor. `import.meta.env.DEV` koşulu
 * üretim derlemesinde bu bloğu tamamen eler (Vite ölü kod ayıklaması).
 */
if (import.meta.env.DEV) {
  (window as unknown as { __charInternals?: unknown }).__charInternals = {
    buildRig,
    buildRigLegacy,
    CharacterAnimator,
    createAppearance,
    // Task 8 sızıntı ölçümü gerçek yolu (fabrika + dispose) sınamak için
    // buna ihtiyaç duyuyor; rig'i elle kurmak dispose'u atlar.
    createCharacter,
  };
}
```

Aynı dosyanın üstündeki import satırını `buildRigLegacy`'yi de alacak şekilde güncelle:

```ts
import { buildRig, buildRigLegacy, type Rig } from './CharacterRig';
```

- [ ] **Step 2: Özdeşlik koşucusunu yaz**

```js
/**
 * RIG ÖZDEŞLİK KAPISI — skinned geçişinin sadakat kanıtı.
 *
 * Neden sayısal: bu projede animasyon gözle değil ölçümle kabul edilir.
 * Katı skinning (vertex başına tek kemik, 1,0 ağırlık) bugünkü sahne
 * grafiğiyle AYNI matris çarpımını üretmek zorundadır; dolayısıyla eski ve
 * yeni rig aynı girdiyle koşturulduğunda eklem dünya matrisleri ve vertex
 * dünya konumları float toleransında çakışmalıdır. Çakışmıyorsa bir kemik
 * bağlama hatası vardır ve bu araç onu bulur.
 *
 * Kullanım: __rigIdentity()  ya da  __rigIdentity({frames: 240})
 */
/* eslint-disable no-console */
function __rigIdentity(opts = {}) {
  const FRAMES = opts.frames ?? 120;
  const SEEDS = opts.seeds ?? [1, 7, 42, 1337, 90210];
  const TOL = opts.tol ?? 1e-4;

  const I = window.__charInternals;
  if (!I) throw new Error('window.__charInternals yok — dev derlemesi mi? (npm run dev)');

  // Rig arayüzünde AÇIKTA olan 21 eklem: karşılaştırma kümesi bu.
  const JOINTS = [
    'root', 'bob', 'hips', 'torso', 'neck', 'head',
    'shoulderL', 'shoulderR',
    'armUpperL', 'armLowerL', 'handL',
    'armUpperR', 'armLowerR', 'handR',
    'legUpperL', 'legLowerL', 'footL',
    'legUpperR', 'legLowerR', 'footR',
    'ponytail',
  ];

  // Animatörün geçtiği durumlar: her biri farklı eklem kolunu sürüyor.
  const STATES = ['idle', 'walk', 'carry', 'work'];

  const rows = [];
  let maxJointError = 0;
  let maxVertexError = 0;
  let colorMismatches = 0;
  const drawCalls = { legacy: 0, next: 0 };

  const countDraws = (root) => {
    let n = 0;
    root.traverse((o) => {
      if ((!o.isMesh && !o.isSkinnedMesh) || !o.visible) return;
      const gr = o.geometry.groups;
      n += gr && gr.length ? gr.length : 1;
    });
    return n;
  };

  /** Eklem dünya matrislerini düz diziye çıkarır. */
  const snapshot = (rig) => {
    rig.root.updateMatrixWorld(true);
    const out = {};
    for (const name of JOINTS) {
      const j = rig[name];
      if (!j) { out[name] = null; continue; }
      out[name] = Array.from(j.matrixWorld.elements);
    }
    return out;
  };

  /**
   * Vertex dünya konumları. Eski rig'de her mesh ayrı ve kendi ata
   * zincirinden dönüşüyor; yeni rig'de tek skinned mesh var ve dönüşüm
   * skinning matrisinden geliyor. İkisini AYNI uzayda karşılaştırmak için
   * her vertex kök-yerel dünya konumuna indirilir ve SIRALI bir listeye
   * yazılır — sıra bağımsız karşılaştırma için konum anahtarına göre.
   */
  const vertexCloud = (rig) => {
    rig.root.updateMatrixWorld(true);
    const pts = [];
    const v = new (rig.root.position.constructor)();
    rig.root.traverse((o) => {
      if ((!o.isMesh && !o.isSkinnedMesh) || !o.visible) return;
      const pos = o.geometry.getAttribute('position');
      const col = o.geometry.getAttribute('color');
      // Her mesh'ten sabit sayıda örnek: tam bulut karşılaştırması
      // gereksiz pahalı, seyrek örnekleme bağlama hatasını yine yakalar.
      const step = Math.max(1, Math.floor(pos.count / 16));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i);
        if (o.isSkinnedMesh) o.applyBoneTransform(i, v);
        v.applyMatrix4(o.matrixWorld);
        rig.root.worldToLocal(v);
        const c = col ? [col.getX(i), col.getY(i), col.getZ(i)] : null;
        pts.push({ k: `${v.x.toFixed(4)}|${v.y.toFixed(4)}|${v.z.toFixed(4)}`, c });
      }
    });
    pts.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
    return pts;
  };

  for (const seed of SEEDS) {
    for (const role of ['customer', 'staff']) {
      const spec = I.createAppearance(role, { seed });
      const a = I.buildRigLegacy(spec);
      const b = I.buildRig(spec);
      const animA = new I.CharacterAnimator(a, spec, seed);
      const animB = new I.CharacterAnimator(b, spec, seed);

      drawCalls.legacy = countDraws(a.root);
      drawCalls.next = countDraws(b.root);

      for (const st of STATES) {
        animA.setState(st);
        animB.setState(st);
        for (let f = 0; f < FRAMES; f++) {
          // Aynı dt, aynı hız → animatör iki rig'de aynı pozu yazmalı.
          animA.update(1 / 60, st === 'walk' ? 2.4 : 0);
          animB.update(1 / 60, st === 'walk' ? 2.4 : 0);
        }
        const sa = snapshot(a);
        const sb = snapshot(b);
        for (const name of JOINTS) {
          if (!sa[name] || !sb[name]) {
            if (Boolean(sa[name]) !== Boolean(sb[name])) {
              rows.push({ seed, role, state: st, joint: name, err: 'biri yok' });
            }
            continue;
          }
          for (let i = 0; i < 16; i++) {
            const e = Math.abs(sa[name][i] - sb[name][i]);
            if (e > maxJointError) maxJointError = e;
            if (e > TOL) rows.push({ seed, role, state: st, joint: name, err: e });
          }
        }
      }

      // Vertex bulutu ve renkler: durgun pozda bir kez yeter.
      const ca = vertexCloud(a);
      const cb = vertexCloud(b);
      const n = Math.min(ca.length, cb.length);
      if (ca.length !== cb.length) {
        rows.push({ seed, role, state: '-', joint: 'vertex sayısı', err: `${ca.length} ≠ ${cb.length}` });
      }
      for (let i = 0; i < n; i++) {
        const pa = ca[i].k.split('|').map(Number);
        const pb = cb[i].k.split('|').map(Number);
        for (let d = 0; d < 3; d++) {
          const e = Math.abs(pa[d] - pb[d]);
          if (e > maxVertexError) maxVertexError = e;
        }
        // Renk yalnız YENİ rig'de vertex özniteliğinde olabilir; eski
        // rig'de materyalde. Bu yüzden renk karşılaştırması ancak iki
        // tarafta da öznitelik varsa anlamlıdır (Task 5 sonrası).
        if (ca[i].c && cb[i].c) {
          for (let d = 0; d < 3; d++) {
            if (Math.abs(ca[i].c[d] - cb[i].c[d]) > 0.01) colorMismatches++;
          }
        }
      }

      a.root.clear();
      b.root.clear();
    }
  }

  const pass = rows.length === 0 && maxJointError <= TOL && maxVertexError <= TOL && colorMismatches === 0;
  const report = { pass, maxJointError, maxVertexError, colorMismatches, drawCalls, rows: rows.slice(0, 40), rowCount: rows.length };
  window.__rigIdentityReport = report;
  console.log(pass ? '✅ ÖZDEŞ' : '❌ SAPMA VAR', report);
  if (rows.length) console.table(report.rows);
  return report;
}
```

- [ ] **Step 3: Koştur — bilinen-özdeş çiftte GEÇMELİ**

`npm run dev`, oyunu aç, konsolda:

```js
const ROOT = 'C:/Users/Enes/Desktop/oyun';
eval(await (await fetch('/@fs/' + ROOT + '/tools/rig-identity.js')).text());
__rigIdentity();
```

Expected: `✅ ÖZDEŞ`, `pass: true`, `maxJointError` ~0, `drawCalls.legacy === drawCalls.next`.

**Bu adım koşucunun kendisini doğrular.** `buildRig` şu an `buildRigLegacy`'ye devrediyor, yani sapma matematiksel olarak imkânsız. `pass: false` çıkıyorsa hata koşucudadır — düzelt, çünkü sonraki tüm task'lar buna güveniyor. En olası sebepler: `createAppearance` imzası (`role` değerleri `src/chars/types.ts`'deki `CharRole` ile eşleşmeli), `setState` durum adları (`AnimState` ile eşleşmeli), `applyBoneTransform` adı (three 0.169'da bu addadır; eski sürümlerde `boneTransform`).

- [ ] **Step 4: Koşucuyu kasten kırıp yakaladığını doğrula**

Test bir şeyi yakalayabildiğini kanıtlamadan güvenilmez. `src/chars/CharacterRig.ts`'deki sarmalayıcıya **geçici** bir sapma koy:

```ts
export function buildRig(spec: AppearanceSpec): Rig {
  const r = buildRigLegacy(spec);
  r.head.position.y += 0.001; // GEÇİCİ — koşucu bunu görmeli
  return r;
}
```

Koştur: `__rigIdentity()`
Expected: `❌ SAPMA VAR`, satır listesinde `joint: 'head'` (ve alt zinciri: `face` üzerinden geçen eklemler). Görmüyorsa koşucu kör — düzelt.

Sonra sapmayı **geri al** (satırı sil) ve tekrar koştur: `✅ ÖZDEŞ`.

- [ ] **Step 5: Commit**

```bash
git add tools/rig-identity.js src/chars/index.ts
git commit -F - <<'EOF'
rig: sayısal özdeşlik kapısı — eski ↔ yeni rig karşılaştırıcısı

Bu projede animasyon gözle değil ölçümle kabul edilir. Koşucu iki kurucuyu
aynı girdiyle 4 durumda 120 kare sürüp 21 eklemin dünya matrislerini ve
seyrek örneklenmiş vertex dünya konumlarını float toleransında
karşılaştırıyor.

Test önce yazıldı: buildRig şu an legacy'ye devrettiği için kapı bilinen
özdeş çiftte yeşil yanıyor — koşucunun kendisi böyle doğrulandı. Kasten
konulan 1 mm'lik kafa kayması da yakalandı (kör değil).

Dev kancası import.meta.env.DEV ile korunuyor, üretim derlemesinde elenir.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Eklemler kemiğe döner (`Group` → `Bone`)

Tek değişken izole ediliyor: hiyerarşi kemik olur, geometri **hâlâ 41 ayrı mesh**. `THREE.Bone`, `Object3D`'den türediği için mesh'ler ona çocuk olarak bağlanır ve normal çizilir. Özdeşlik kapısı bunu doğrular.

**Files:**
- Modify: `src/chars/CharacterRig.ts` (`joint()` yardımcısı, kemik toplama, yeni kurucu iskeleti)
- Modify: `src/chars/types.ts` (`Rig` alan tipleri)

**Interfaces:**
- Consumes: `buildRigLegacy` (Task 2), `__rigIdentity` (Task 3)
- Produces: `Rig` arayüzünde eklem alanları artık `THREE.Bone` (`root` hariç — o `THREE.Group` kalır, sahibinin `position`/`rotation.y`/`scale` yazdığı düğüm). Ek alan: `bones: THREE.Bone[]` (iskelet sırası) ve `boneRoot: THREE.Bone` (`bob`). Task 6 bunları `Skeleton` kurmak için kullanır.

- [ ] **Step 1: `Rig` arayüzündeki eklem tiplerini kemiğe çevir**

`src/chars/CharacterRig.ts:57` civarındaki `export interface Rig` bloğunda `THREE.Group` olan **eklem** alanlarını `THREE.Bone` yap. `root` DEĞİŞMEZ. `torsoMesh`, `eyeL/R`, `browL/R`, `mouth` bu task'ta değişmez (Task 6'da kemiğe geçecek).

```ts
export interface Rig {
  root: THREE.Group;
  bob: THREE.Bone;
  hips: THREE.Bone;
  torso: THREE.Bone;
  torsoMesh: THREE.Mesh;
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
  eyeL: THREE.Mesh;
  eyeR: THREE.Mesh;
  browL: THREE.Mesh;
  browR: THREE.Mesh;
  mouth: THREE.Mesh;
  headMat: THREE.MeshStandardMaterial;
  headBaseColor: THREE.Color;
  armRestZ: number;
  height: number;
  meshCount: number;
}
```

- [ ] **Step 2: `joint()` kemik üretsin ve kemikleri toplasın**

`src/chars/CharacterRig.ts` içindeki `function joint(...)` tanımını değiştir:

```ts
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
```

**Çapalar kemik OLMAZ.** `carryAnchor`, `handAnchor`, `headTop` düz `THREE.Object3D` kalır ve `anchor()` yardımcısı değişmez. Bunlar taşınan ürünlerin bağlandığı nişan noktaları; ürünler ayrı mesh (`ProductMesh` InstancedMesh) olarak çizilmeye devam eder. Kemiğe çevirmek `Skeleton` dizisini gereksiz büyütür ve hiçbir vertex onlara bağlı olmadığı için anlamsızdır.

`buildRigLegacy` içindeki her `joint(...)` çağrısına kemik dizisini geçir. Kurucunun başında diziyi aç:

```ts
const bones: THREE.Bone[] = [];
```

ve çağrıları `joint(root, 0, 0, 0, 'bob', bones)` biçimine getir. Adsız yardımcı eklemler (`hipsSkin`, `torsoSkin`, `face`) de kemik olmalı ve diziye girmeli — geometri onlara bağlı:

```ts
const hipsSkin = joint(hips, 0, 0, 0, '', bones);
```

`buildHair` / `buildHat` / `buildOver` / `buildBack` içinde `joint()` çağrısı varsa onlara da `bones` parametresini geçir (imzalarına ekle).

- [ ] **Step 3: Dönüş nesnesine yeni alanları ekle**

`buildRigLegacy`'nin `return {` bloğuna ekle:

```ts
    bones,
    boneRoot: bob,
```

- [ ] **Step 4: Tip denetimi**

Run: `npm run typecheck`
Expected: hata yok. Hata çıkarsa büyük olasılıkla `buildHair`/`buildHat` gibi yardımcıların imzasında `THREE.Group` parametre tipi kaldı — `THREE.Object3D`'ye genişlet.

- [ ] **Step 5: Özdeşlik kapısı**

```js
const ROOT = 'C:/Users/Enes/Desktop/oyun';
eval(await (await fetch('/@fs/' + ROOT + '/tools/rig-identity.js')).text());
__rigIdentity();
```

Expected: `✅ ÖZDEŞ`. `Bone` ile `Group` transform açısından aynı olduğu için sapma olmamalı. Sapma varsa bir `joint()` çağrısının ebeveyni yanlış bağlanmış.

- [ ] **Step 6: Oyunu gözle bir kez aç (duman testi)**

`npm run dev` → oyun açılmalı, karakterler yürümeli, konsol hatası olmamalı. Sondayı koştur: `__rigProbe()` — `perChar.drawCalls` Task 1 değeriyle **aynı** olmalı (henüz birleştirme yok).

- [ ] **Step 7: Commit**

```bash
git add src/chars/CharacterRig.ts
git commit -F - <<'EOF'
rig: eklemler Group'tan Bone'a döndü

Tek değişken izole edildi: hiyerarşi kemik oldu, geometri hâlâ 41 ayrı
mesh. Bone, Object3D'den türeyip aynı transform API'sini taşıdığı için
animatörün 19 eklem satırına dokunulmadı ve özdeşlik kapısı yeşil.

Kemikler kurulum sırasına göre toplanıyor (rig.bones) ve kök bob olarak
işaretlendi; Skeleton bunlarla kurulacak. Adsız yardımcı eklemler
(hipsSkin, torsoSkin, face) de kemik — geometri onlara bağlı.

Çizim çağrısı bu task'ta değişmedi (ölçüldü, taban ile aynı).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 5: İki global materyal + vertex renk — **kurucu burada ÇATALLANIR**

Renk materyalden geometriye taşınır. Geometri **hâlâ ~41 ayrı mesh** ama materyal sayısı karakter başına ~14'ten 2'ye iner. Bu, Task 6'daki birleştirmenin ön koşulu: birleştirilecek parçaların tek materyali paylaşması gerekir.

> **PLAN DEĞİŞİKLİĞİ (2026-08-17, Task 4 sonrası). Çatallanma Task 6'dan Task 5'e alındı.**
>
> Task 2-4'te tek bir kurucu gövdesi vardı ve `buildRig` ona devrediyordu. Bunun bir sonucu geç fark edildi: **kurucuyu değiştirmek kapının iki tarafını birlikte değiştiriyor**, yani özdeşlik kapısı o görevlerde boşa geçiyordu (kendi kendiyle karşılaştırma). Task 4 için bu kabul edilebilirdi — `Bone`, `Group`'un transform API'sini birebir taşıdığı için değişim yapısal olarak nötrdü ve `typecheck` + duman testi yeterliydi.
>
> Renk için kabul edilemez. Yanlış renk uzayı (sRGB↔doğrusal) karakterleri gözle zor yakalanacak biçimde soluklaştırır ve bu, işin en riskli görsel değişimi. Bu yüzden çatallanma buraya alındı: `buildRigLegacy` **dokunulmadan** kalır (materyal renkleri), yeni `buildRig` vertex renklerini kullanır ve kapı ikisini **gerçekten** karşılaştırır. Task 3'ün renk kolu (fix round 1, I1) tam bu senaryo için asimetrik kuruldu: eski tarafta `material.color`, yeni tarafta `color` özniteliği okur ve kendiliğinden etkinleşir.
>
> **Beklenen ve kabul edilebilir tek fark: çizim çağrısı sayısı.** Yeni kurucu `mergeStaticSiblings` çağırmaz (tek materyalde eski kova mantığı anlamsız), o yüzden `drawCalls.legacy` ile `drawCalls.next` **eşit olmayacak** — yeni taraf daha yüksek. Bu geçici ve Task 6'da fazlasıyla geri alınıyor. Kapı bunu bir başarısızlık sayıyorsa, farkı **beyan edilmiş** bir beklenti olarak ele al (ör. `expectedDrawCallDelta`) ve gerekçesini koda yaz — kolu sessizce kapatma. Vertex sayısı ise **eşit kalmalı**: `paintGeometry` klonluyor, vertex eklemiyor/çıkarmıyor. `countMismatches` kırmızı yanarsa gerçek bir hata var.

**Files:**
- Create: `src/chars/CharacterMaterials.ts`
- Modify: `src/chars/CharacterRig.ts` (`mat`/`basic` yerine renk yazımı)

**Interfaces:**
- Consumes: `Rig` (Task 4)
- Produces:
  - `charLitMaterial(): THREE.MeshStandardMaterial` — global, `vertexColors: true`, `roughness: 0.82`, `metalness: 0`
  - `charUnlitMaterial(): THREE.MeshBasicMaterial` — global, `vertexColors: true`, `toneMapped: false`
  - `paintGeometry(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry` — geometriyi **klonlar**, `color` özniteliği yazar, klonu döner
  - Task 6 bu üçünü kullanır; Task 7 `setHeadTint` için renk özniteliğine yazar.

- [ ] **Step 1: Materyal modülünü yaz**

```ts
import * as THREE from 'three';

/**
 * KARAKTER MATERYALLERİ — tüm karakterlerin paylaştığı iki materyal.
 *
 * Neden ikisi yetiyor: rig'in hiç özel materyal parametresi yok
 * (doğrulandı — saydamlık, roughness, metalness, emissive, side hiçbir
 * yerde geçmiyor). Palet renkleri vertex özniteliğine taşındığı için
 * karakter başına ~23 materyal ikiye iniyor ve bu ikisi GLOBAL olabiliyor.
 *
 * Ayrım korunuyor: yüz ışıksız kalır. Bu bilinçli bir okunaklılık kararı
 * (v5.0: göz boyu ve BROW_Y ayarı "göz + kaş tek koyu leke olmasın" diye
 * yapıldı); ışıklı shader'a alınırsa o karar bozulur.
 */

let lit: THREE.MeshStandardMaterial | null = null;
let unlit: THREE.MeshBasicMaterial | null = null;

/** Gövde, kafa, uzuvlar, saç, şapka, üstlük, ayakkabı. */
export function charLitMaterial(): THREE.MeshStandardMaterial {
  if (!lit) {
    lit = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0,
    });
  }
  return lit;
}

/** Göz, kaş, ağız, bıyık, allık — keskin okunsun diye ışıksız. */
export function charUnlitMaterial(): THREE.MeshBasicMaterial {
  if (!unlit) {
    unlit = new THREE.MeshBasicMaterial({
      vertexColors: true,
      toneMapped: false,
    });
  }
  return unlit;
}

const _c = new THREE.Color();

/**
 * Geometriyi KLONLAYIP vertex renklerini yazar.
 *
 * Klon şart: kaynak geometriler `world/Materials` önbelleğinden gelir ve
 * yüzlerce mesh arasında paylaşılır — üstüne renk yazmak bütün sahneyi
 * boyar.
 *
 * Renk doğrusal uzaya çevrilir: `MeshStandardMaterial` vertex rengini
 * doğrusal kabul eder, `mat()` ise sRGB hex alıyordu. Çevirmezsek
 * karakterler bugünküne göre soluk çıkar.
 */
export function paintGeometry(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const g = geo.clone();
  _c.setHex(color, THREE.SRGBColorSpace).convertSRGBToLinear();
  const pos = g.getAttribute('position');
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    arr[i * 3] = _c.r;
    arr[i * 3 + 1] = _c.g;
    arr[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
```

- [ ] **Step 2a: Kurucuyu çatalla — `buildRigLegacy` DOKUNULMADAN kalır**

`buildRigLegacy`'nin gövdesini **kopyala** ve yeni `buildRig`'in gövdesi yap (Task 2'de eklenen tek satırlık sarmalayıcının yerini alır). Kopyalarken imzayı ve dönüş tipini aynı bırak.

`buildRigLegacy`'ye bu görevde **hiç dokunma** — o artık kapının referans tarafı: materyal renkleriyle, `mergeStaticSiblings` çağrısıyla, olduğu gibi. Task 10'da silinecek.

İki kurucu arasındaki kod tekrarı bilinçli ve geçicidir; gerekçesi yeni `buildRig`'in başına yorum olarak yazılmalı (referans tarafın canlı kalması, kapının gerçek karşılaştırma yapabilmesi, Task 10'da tekilleşme).

- [ ] **Step 2b: YENİ `buildRig` içinde `mesh()`/`detail()` çağrılarını renkli klona çevir**

Yalnız **yeni** kurucuda: iki yerel yardımcı tanımla (kurucunun içinde, `add`'in yanında) ve `mesh(geo, mat(renk), ...)` / `detail(geo, basic(renk), ...)` kalıplarını bunlarla değiştir:

```ts
  /**
   * Işıklı parça: geometri renkli klona çevrilir, materyal global.
   * `castShadow`/`receiveShadow` eski `mesh()` davranışını korur.
   */
  const litPart = (geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0): THREE.Mesh => {
    const m = new THREE.Mesh(paintGeometry(geo, color), charLitMaterial());
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  /** Işıksız parça (yüz) — eski `detail(basic(...))` karşılığı. */
  const unlitPart = (geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0): THREE.Mesh => {
    const m = new THREE.Mesh(paintGeometry(geo, color), charUnlitMaterial());
    m.position.set(x, y, z);
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  };
```

Dosyanın üstüne import ekle:

```ts
import { charLitMaterial, charUnlitMaterial, paintGeometry } from './CharacterMaterials';
```

Sonra kurucudaki her çağrıyı çevir. Kural:
- `mesh(geo, mat(renk), x, y, z)` → `litPart(geo, renk, x, y, z)`
- `detail(geo, mat(renk), x, y, z)` → `litPart(geo, renk, x, y, z)` ama `castShadow=false` gerekiyorsa çağrıdan sonra `m.castShadow = false` — pratikte `detail` gölge üretmediği için üçüncü bir yardımcı yerine `litPart`'ın döndürdüğü mesh'e yaz.
- `detail(geo, basic(renk), x, y, z)` → `unlitPart(geo, renk, x, y, z)`

**Yeni `buildRig`, `mergeStaticSiblings` çağrısını içermez** (kopyaladıktan sonra o satırı sil): artık tüm ışıklı parçalar aynı materyali paylaştığı için eski kova mantığı anlamsız gruplar üretir ve Task 6 onun yerini tamamen alacak. Fonksiyonun kendisi **silinmez** — `buildRigLegacy` onu kullanmaya devam ediyor ve o kapının referans tarafı.

Bunun sonucu: yeni kurucu geçici olarak **daha çok** çizim çağrısı eder. Beklenen, kabul edilmiş ve Task 6'da fazlasıyla geri alınıyor (bkz. görev başındaki plan değişikliği notu).

- [ ] **Step 3: Tip denetimi**

Run: `npm run typecheck`
Expected: hata yok. `mat`, `basic`, `mesh`, `detail` importları artık kullanılmıyorsa import satırından çıkar (aksi hâlde `noUnusedLocals` varsa hata verir).

- [ ] **Step 4: Özdeşlik kapısı — renk karşılaştırması burada devreye giriyor**

```js
const ROOT = 'C:/Users/Enes/Desktop/oyun';
eval(await (await fetch('/@fs/' + ROOT + '/tools/rig-identity.js')).text());
__rigIdentity();
```

Expected: `pass: true`. Eklem matrisleri etkilenmemeli (`maxJointError` ~0), vertex konumları aynı kalmalı.

**Dikkat:** koşucunun renk karşılaştırması ancak İKİ tarafta da `color` özniteliği varsa çalışır; eski rig'de yok, yani `colorMismatches` bu aşamada 0 kalır. Renk doğruluğunu bu yüzden ayrıca gözle doğrulamak gerekiyor — bir sonraki adım.

- [ ] **Step 5: Renk doğruluğunu kare dökümüyle doğrula**

Tarayıcı paneli kompozit etmediği için ekran görüntüsü alınamaz; kare elle render edilip geliştirme uç noktasına gönderilir. Portre kadrajda (375 × 812) — yatay kadraj yanıltıcıdır, ekranın yarısı zemin olur.

```js
// Portre boyuta getir, bir kare render et, PNG'yi .devshots/ altına yaz.
const g = window.__fincan;
window.innerWidth; // referans
await (async () => {
  g.scene3d.render();
  const data = g.scene3d.renderer.domElement.toDataURL('image/png');
  const r = await fetch('/__shot', {
    method: 'POST',
    body: JSON.stringify({ name: 'task5-vertex-renk.png', data }),
  });
  console.log('yazıldı:', await r.text());
})();
```

`.devshots/task5-vertex-renk.png` dosyasını aç. Karakter renkleri **bugünkü hâlle aynı** görünmeli. Soluk/karanlık çıkıyorsa `paintGeometry`'deki sRGB→doğrusal çevrimi atlanmış ya da iki kez uygulanmış demektir.

- [ ] **Step 6: Commit**

```bash
git add src/chars/CharacterMaterials.ts src/chars/CharacterRig.ts
git commit -F - <<'EOF'
rig: renk materyalden vertex özniteliğine taşındı

Karakter başına ~23 materyal, tüm karakterlerin paylaştığı 2 global
materyale indi: ışıklı gövde ve ışıksız yüz. Bunun mümkün olmasının sebebi
rig'in hiç özel materyal parametresi kullanmaması (saydamlık, roughness,
metalness, emissive, side — hiçbiri geçmiyor).

Yüzün ışıksız kalması korundu; v5.0'daki "göz + kaş tek koyu leke olmasın"
okunaklılık kararına dokunulmadı.

Geometriler önbellekten paylaşımlı olduğu için renk KLON üzerine yazılıyor
— yoksa bir karakterin paleti tüm sahneyi boyardı. Renk sRGB'den doğrusala
çevriliyor, yoksa karakterler soluk çıkıyor (kare dökümüyle doğrulandı).

mergeStaticSiblings devre dışı: eski kova mantığı tek materyalde yanlış
gruplar üretiyor, yerini Task 6'daki tek geometri birleştirmesi alacak.
Çizim çağrısı bu yüzden geçici olarak yüksek.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Tek skinned geometri — çizim çağrısı **3'e** iner (2'ye Task 7'de)

Planın kalbi. Tüm parçalar tek `BufferGeometry`'ye birleşir ve tek `SkinnedMesh` olarak çizilir.

> **BEKLENTİ DÜZELTMESİ (2026-08-17, Task 5 sonrası).** Bu görevin çıktısı karakter başına **2 değil 3** çizim çağrısı.
>
> Sebep Task 5'te ölçülerek ortaya çıktı: kafa mesh'i vertex rengine **geçirilemedi**. `CharacterAnimator` öfke tintlemesi için karaktere özel bir materyal klonunu doğrudan mutasyona uğratıyor ve `dispose()`'ta serbest bırakıyor (`CharacterAnimator.ts:476-481`). Kafayı global `charLitMaterial()`'a almak, bir karakterin öfkesiyle **sahnedeki her karakterin her ışıklı parçasını** kızartırdı. Bu yüzden kafa bilinçli olarak materyal önbelleğinde bırakıldı — doğru evreleme kararı, ama sonucu karakter başına üç materyal: ışıklı (global) · ışıksız (global) · kafa klonu.
>
> Dolayısıyla birleşik geometri bu görevde **üç** materyal grubu taşır ve `perChar.drawCalls === 3` olur. `=== 2` kapısı **Task 7'ye kayıyor**: orada tint vertex aralığına taşınınca kafa ışıklı gruba katılır, grup sayısı ikiye iner ve asıl kapı orada ölçülür.
>
> Aşağıdaki kodda grup sırası buna göre okunmalı: 0 = ışıklı, 1 = ışıksız, **2 = kafa** (geçici). Task 7 grup 2'yi kaldırıp kafa vertex'lerini gruba 0'a katar.

**Files:**
- Create: `src/chars/CharacterSkin.ts`
- Modify: `src/chars/CharacterRig.ts` (yeni `buildRig` gövdesi)
- Modify: `src/chars/types.ts` / `Rig` (7 ölçek hedefi kemiğe)
- Modify: `src/chars/CharacterAnimator.ts` (7 ölçek hedefi)

**Interfaces:**
- Consumes: `charLitMaterial`, `charUnlitMaterial`, `paintGeometry` (Task 5); `rig.bones`, `rig.boneRoot` (Task 4)
- Produces:
  - `type SkinPart = { geo: THREE.BufferGeometry; bone: THREE.Bone; unlit: boolean }`
  - `buildSkin(parts: SkinPart[], bones: THREE.Bone[], root: THREE.Group): { mesh: THREE.SkinnedMesh; headRange: [number, number] }` — `headRange` Task 7'nin tint aralığı
  - `Rig` alanları: `torsoMesh`, `eyeL`, `eyeR`, `browL`, `browR`, `mouth` artık `THREE.Bone`; `skinned: THREE.SkinnedMesh`; `headRange: [number, number]`

- [ ] **Step 1: Birleştiriciyi yaz**

```ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { charLitMaterial, charUnlitMaterial } from './CharacterMaterials';

/**
 * KARAKTER DERİSİ — parça listesini tek skinned geometriye çeviren saf dönüşüm.
 *
 * KATI SKINNING: her vertex eski ebeveyn eklemine 1,0 ağırlıkla bağlanır.
 * Hiçbir vertex iki kemik arasında paylaşılmadığı için GPU'nun uyguladığı
 * skinning matrisi bugünkü sahne grafiğinin uyguladığı dünya matrisiyle
 * AYNI çarpımdır — sadakat kurulum gereği garantidir, ağırlık boyama yok.
 */

export interface SkinPart {
  /** Renkli, klonlanmış geometri (bkz. paintGeometry). */
  geo: THREE.BufferGeometry;
  /** Vertex'lerin bağlanacağı kemik. */
  bone: THREE.Bone;
  /** true → ışıksız grup (yüz). */
  unlit: boolean;
}

/** mergeGeometries tüm parçalarda AYNI öznitelik takımını ister. */
const ATTRS = ['position', 'normal', 'uv', 'color'] as const;

function normalize(geo: THREE.BufferGeometry, boneIndex: number, restToRoot: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.clone();
  // Parçayı DİNLENME pozunda kök-yerel uzaya taşı: skinning matrisi de
  // dinlenmeye göre hesaplandığı için ikisi aynı uzayda buluşur.
  g.applyMatrix4(restToRoot);

  // Eksik öznitelikleri doldur, fazlasını at — yoksa merge sessizce null döner.
  if (!g.getAttribute('uv')) {
    const n = g.getAttribute('position').count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  for (const name of Object.keys(g.attributes)) {
    if (!ATTRS.includes(name as (typeof ATTRS)[number])) g.deleteAttribute(name);
  }

  const n = g.getAttribute('position').count;
  const idx = new Uint16Array(n * 4);
  const wgt = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    idx[i * 4] = boneIndex; // kalan üç yuva 0 kalır, ağırlığı da 0
    wgt[i * 4] = 1;
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(wgt, 4));
  return g;
}

/**
 * Parçaları tek skinned mesh'e indirir.
 *
 * Grup sırası SABİT: 0 = ışıklı, 1 = ışıksız. Materyal dizisi bu sırayı
 * izler, yani karakter tam iki çizim çağrısı eder.
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

  const lit: THREE.BufferGeometry[] = [];
  const unlit: THREE.BufferGeometry[] = [];
  const restToRoot = new THREE.Matrix4();

  for (const p of parts) {
    const bi = boneIndex.get(p.bone);
    if (bi === undefined) throw new Error('SkinPart kemiği rig.bones dizisinde yok');
    // Parçanın dinlenme dönüşümü: kemiğin dünyası + parçanın kemik-yerel yeri.
    restToRoot.copy(rootInv).multiply(p.bone.matrixWorld);
    (p.unlit ? unlit : lit).push(normalize(p.geo, bi, restToRoot));
  }

  const litCount = lit.length;
  const ordered = [...lit, ...unlit];
  const merged = mergeGeometries(ordered, true);
  if (!merged) throw new Error('mergeGeometries null döndü — öznitelik takımları eşleşmiyor');

  // mergeGeometries parça başına bir grup üretir; ikiye indiriyoruz.
  let litEnd = 0;
  for (let i = 0; i < litCount; i++) litEnd += merged.groups[i].count;
  let total = 0;
  for (const gr of merged.groups) total += gr.count;
  merged.clearGroups();
  merged.addGroup(0, litEnd, 0);
  merged.addGroup(litEnd, total - litEnd, 1);

  const mesh = new THREE.SkinnedMesh(merged, [charLitMaterial(), charUnlitMaterial()]);
  // Karakterler donmuş gölge haritasına girmez; yere basmayı temas gölgesi
  // sağlar (bkz. Scene3D). Ama statik gölgeyi ÜZERİNE almaları gerekir.
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  /**
   * Kadraj eleme KAPALI: skinned mesh'in sınır küresi dinlenme pozundan
   * hesaplanır ve poz değiştikçe yanlışlaşır — yürüyen karakter kadrajın
   * içindeyken elenebilir. Oyun kendi eleme mantığını zaten uyguluyor
   * (kadraj dışı aktör çizilmiyor), bu yüzden burada gereksiz ve riskli.
   */
  mesh.frustumCulled = false;

  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones), mesh.matrixWorld);

  // Kafa aralığı: tint yalnız bu vertex'lere yazılacak (Task 7).
  const headRange: [number, number] = [0, 0];
  return { mesh, headRange };
}
```

- [ ] **Step 2: Yeni `buildRig`'i kur**

`buildRig` **Task 5'te çatallandı** — ayrı bir gövdesi var ve vertex renklerini kullanıyor. Bu görevde onu yerinde değiştiriyorsun; `buildRigLegacy`'ye yine **dokunulmuyor** (kapının referans tarafı, Task 10'da silinecek). İki fark:

1. `litPart`/`unlitPart` sahneye mesh eklemek yerine `parts` dizisine `SkinPart` yazar:

```ts
  const parts: SkinPart[] = [];
  /**
   * Parça kaydı. Eski `add(parent, mesh)` çağrısının yerini alır: mesh
   * yaratmak yerine geometriyi ve bağlanacağı kemiği kaydeder, konumu
   * kemik-yerel olarak geometriye pişirir.
   */
  const part = (bone: THREE.Bone, geo: THREE.BufferGeometry, color: number, unlit: boolean,
                x = 0, y = 0, z = 0): void => {
    const g = paintGeometry(geo, color);
    if (x || y || z) g.translate(x, y, z);
    parts.push({ geo: g, bone, unlit });
  };
```

2. Animatörün ölçek yazdığı 7 hedef artık **kemik**:

```ts
  // Animatör bu yedi hedefe ÖLÇEK yazıyor (nefes, göz kırpma, ağız,
  // mimik). Skinned mesh'te tek bir parçayı ölçeklemenin yolu onu kendi
  // kemiğine bağlamaktır; kemik ölçeği skinning matrisine dahildir.
  const torsoBreath = joint(torsoSkin, 0, TORSO_MESH_Y, 0, 'torsoBreath', bones);
  const eyeLBone = joint(face, -0.104, 0.014, 0.012, 'eyeL', bones);
  const eyeRBone = joint(face, 0.104, 0.014, 0.012, 'eyeR', bones);
  const browLBone = joint(face, -0.098, BROW_Y, 0.01, 'browL', bones);
  const browRBone = joint(face, 0.098, BROW_Y, 0.01, 'browR', bones);
  const mouthBone = joint(face, 0, -0.085, 0.01, 'mouth', bones);
```

Bu kemiklere bağlanan parçalar artık konumu kemikten aldığı için `part()` çağrısında ofset **verilmez**:

```ts
  // Gövde kabuğu nefes kemiğine bağlanır; ofset kemikte olduğu için sıfır.
  part(torsoBreath, roundBox(0.44, 0.44, 0.29, 0.14), p.shirt, false);
  /**
   * GÖZ YASSILTMASI GEOMETRİYE PİŞİRİLİR.
   *
   * Eski kod `eyeL.scale.set(1, 1, EYE_Z_SCALE)` ile gözü z'de yassıltıyor,
   * animatör de göz kırparken bu değeri koruyacak biçimde scale yazıyordu.
   * Kemik ölçeği doğrudan animatörün yazdığı değer olduğu için yassıltma
   * kemikte kalamaz — geometriye pişirilir, böylece animatörün yazdığı
   * ölçek eskisiyle aynı anlamı taşır.
   */
  const eyeFlat = eyeGeo.clone().scale(1, 1, EYE_Z_SCALE);
  part(eyeLBone, eyeFlat, p.eye, true);
  part(eyeRBone, eyeFlat, p.eye, true);
  part(mouthBone, roundBox(0.088, 0.032, 0.028, 0.013), p.mouth, true);
  if (!lod) {
    part(browLBone, browGeo, p.brow, true);
    part(browRBone, browGeo, p.brow, true);
  }
```

`eyeFlat` bir klondur ve `part()` içindeki `paintGeometry` onu bir kez daha klonlar; `eyeGeo` önbellekteki paylaşımlı geometri olduğu için **üstüne yazılmaması** kritiktir (yazılırsa sahnedeki her küre yassılır).

Kurucunun sonunda birleştir ve dön:

```ts
  const { mesh: skinned, headRange } = buildSkin(parts, bones, root);
```

`return` bloğunda 7 hedefi kemiklerle değiştir (`torsoMesh: torsoBreath`, `eyeL: eyeLBone`, …) ve `skinned`, `headRange` alanlarını ekle. `meshCount` artık `2` döner.

- [ ] **Step 3: `Rig` arayüzünü güncelle**

```ts
  /** Animatör buna scale.y yazar (nefes) — artık kemik. */
  torsoMesh: THREE.Bone;
  eyeL: THREE.Bone;
  eyeR: THREE.Bone;
  browL: THREE.Bone;
  browR: THREE.Bone;
  mouth: THREE.Bone;
  /** Karakterin tek çizilen nesnesi (iki materyal grubu). */
  skinned: THREE.SkinnedMesh;
  /** Kafa vertex aralığı — öfke tintlemesi buraya yazar (Task 7). */
  headRange: [number, number];
```

- [ ] **Step 4: Animatörde LOD gizleme satırını kaldır**

`CharacterAnimator` kaşlara yazmaya devam eder; LOD'da kaş vertex'i geometriye hiç girmediği için kemik boş kalır ve yazma zararsızdır. `CharacterRig`'deki

```ts
  if (lod) {
    browL.visible = false;
    browR.visible = false;
  }
```

bloğunu **sil** — `Bone`'un `visible`'ı bir şey ifade etmiyor ve artık gerekmiyor. (Eski yorumdaki "kaldırılırsa null erişimi olur" kaygısı da böylece kapanıyor.)

- [ ] **Step 5: Tip denetimi**

Run: `npm run typecheck`
Expected: hata yok. `torsoMesh` gibi alanların tipi `Mesh`'ten `Bone`'a döndüğü için `CharacterAnimator` içinde `THREE.Mesh` bekleyen bir yer varsa orayı `THREE.Bone`'a çevir — animatör yalnız `position`/`rotation`/`scale` kullandığı için başka değişiklik gerekmemeli.

- [ ] **Step 6: Özdeşlik kapısı — asıl sınav**

```js
const ROOT = 'C:/Users/Enes/Desktop/oyun';
eval(await (await fetch('/@fs/' + ROOT + '/tools/rig-identity.js')).text());
__rigIdentity();
```

Expected: `✅ ÖZDEŞ`, `pass: true`, `drawCalls.next === 2`, `drawCalls.legacy` 20-45.

Kırmızı yanarsa sırayla bak:
- `maxJointError` büyük → kemik hiyerarşisi yanlış bağlanmış (yeni ölçek kemikleri yanlış ebeveyne mi girdi?)
- `maxVertexError` büyük, eklemler temiz → `normalize()`'daki `restToRoot` yanlış; `Skeleton` dinlenme pozu güncellenmeden mi kuruldu? (`root.updateMatrixWorld(true)` çağrıları yerinde mi?)
- `vertex sayısı` uyuşmuyor → LOD dalları iki kurucuda farklı; `charLod()` iki tarafta da aynı değeri mi okuyor?
- `mergeGeometries null` → bir parçada öznitelik takımı farklı; `normalize()`'ın `uv` doldurma ve fazla öznitelik atma adımları çalışıyor mu?

- [ ] **Step 7: Çizim çağrısı kazancını ölç**

```js
eval(await (await fetch('/@fs/' + ROOT + '/tools/rig-probe.js')).text());
__rigProbe();
```

Expected: `perChar.drawCalls === 3`, `perChar.materials === 3`, `scene.calls` Task 1 değerinin **çok altında** (Task 5'teki 91'den de belirgin aşağıda).

Üçüncü çağrı kafa klonudur ve **beklenen** — bkz. görev başındaki beklenti düzeltmesi. `=== 2` kapısı Task 7'de ölçülüyor. `4` ya da daha fazlası çıkıyorsa gerçek bir sorun var: birleştirme materyal başına gruplamıyor demektir, `useGroups` ve kova sırasına bak.

Ölçülen değerleri Ölçüm Kütüğü'ne yaz — Task 6 satırı olarak, "SONRA" kolonunu Task 7/12'ye bırak.

- [ ] **Step 8: Portre kare dökümü**

```js
const g = window.__fincan;
g.scene3d.render();
await fetch('/__shot', { method: 'POST', body: JSON.stringify({
  name: 'task6-skinned.png', data: g.scene3d.renderer.domElement.toDataURL('image/png') }) });
```

`.devshots/task6-skinned.png`'i Task 5'in dökümüyle karşılaştır — ayırt edilemez olmalı.

- [ ] **Step 9: Commit**

```bash
git add src/chars/CharacterSkin.ts src/chars/CharacterRig.ts src/chars/CharacterAnimator.ts
git commit -F - <<'EOF'
rig: tek skinned mesh — karakter başına çizim çağrısı 41'den 2'ye

Katı skinning: her vertex eski ebeveyn kemiğine 1,0 ağırlıkla bağlı.
Hiçbir vertex iki kemik arasında paylaşılmadığı için GPU'nun skinning
matrisi eski sahne grafiğinin dünya matrisiyle aynı çarpım — özdeşlik
kapısı yeşil, ağırlık boyama hiç gerekmedi.

Grup sırası sabit: 0 ışıklı gövde, 1 ışıksız yüz. Yüzün ışıksızlığı
korundu, yani iki çağrının ikincisi bilinçli bir okunaklılık bedeli.

Animatörün ölçek yazdığı yedi hedef kemiğe döndü (nefes, iki göz, iki kaş,
ağız); kemik ölçeği skinning matrisine dahil olduğu için etki aynı.
Gözün z yassıltması artık geometriye pişiriliyor, yoksa animatörün yazdığı
ölçek eski anlamını yitiriyordu.

Kadraj eleme kapatıldı: skinned sınır küresi dinlenme pozundan hesaplanır
ve poz değişince yanlışlaşıyor, yürüyen karakter kadraj içinde elenebilir.
Oyun kendi elemesini zaten yapıyor.

LOD'un visible=false hilesi kalktı: kaş vertex'i geometriye hiç girmiyor,
kemik boş kalıyor, animatörün yazması zararsız.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Öfke tintlemesi vertex aralığına — **asıl kapı burada: çağrı 2'ye iner**

Kafa mesh'i Task 5 ve 6'da bilinçli olarak materyal önbelleğinde bırakıldı, çünkü `CharacterAnimator` öfke tintlemesi için karaktere özel bir materyal klonunu mutasyona uğratıyor; kafayı global materyale almak bir karakterin öfkesiyle **tüm karakterleri** kızartırdı. Bu görev o düğümü çözüyor: tint kafa **vertex aralığına** yazılınca kafa global ışıklı materyale katılabilir.

Sonucu bu planın başlık iddiası: birleşik geometrinin materyal grubu **3 → 2**, yani karakter başına çizim çağrısı **2**. Task 6'dan kayan `perChar.drawCalls === 2` kapısı burada ölçülür.

Bir de Task 5'in incelemesinden gelen ön koşul var: kapının renk kolu `material.color` çarpanını görmüyordu ve şu an kafa vertex'leri **iki tarafta da** materyal renginden karşılaştırıldığı için o kör nokta kapalı kalıyor. Kafa özniteliğe taşınınca simetri bozulur — bu yüzden çarpan kolu Task 5'in fix turunda kapatıldı. Bu görevde kapının renk kolunun kafa aralığını gerçekten ölçtüğünü **doğrula**, varsayma.

**Files:**
- Modify: `src/chars/CharacterSkin.ts` (`headRange` gerçekten hesaplanır)
- Modify: `src/chars/CharacterRig.ts` (`setHeadTint`, `headMat`/`headBaseColor` kalkar)
- Modify: `src/chars/CharacterAnimator.ts` (tint çağrısı)

**Interfaces:**
- Consumes: `buildSkin` (Task 6)
- Produces: `Rig.setHeadTint(color: number | null): void` — `null` taban renge döner. `Rig.headMat` ve `Rig.headBaseColor` **kaldırılır**.

- [ ] **Step 1: `buildSkin` kafa aralığını gerçekten hesaplasın**

`SkinPart`'a bir işaret ekle:

```ts
export interface SkinPart {
  geo: THREE.BufferGeometry;
  bone: THREE.Bone;
  unlit: boolean;
  /** Öfke tintlemesinin boyayacağı parça (kafa kabuğu). */
  head?: boolean;
}
```

`buildSkin` içinde ışıklı parçalar birleştirilirken kafa parçasının vertex aralığını topla. `lit` dizisine eklerken vertex sayacını yürüt:

```ts
  let litVerts = 0;
  let headStart = -1;
  let headEnd = -1;
  for (const p of parts) {
    const bi = boneIndex.get(p.bone);
    if (bi === undefined) throw new Error('SkinPart kemiği rig.bones dizisinde yok');
    restToRoot.copy(rootInv).multiply(p.bone.matrixWorld);
    const g = normalize(p.geo, bi, restToRoot);
    if (p.unlit) {
      unlit.push(g);
    } else {
      const n = g.getAttribute('position').count;
      if (p.head) {
        headStart = litVerts;
        headEnd = litVerts + n;
      }
      litVerts += n;
      lit.push(g);
    }
  }
```

Işıklı parçalar birleşik geometride ÖNCE geldiği için (`ordered = [...lit, ...unlit]`) bu vertex indeksleri doğrudan geçerlidir. Dönüşü güncelle:

```ts
  const headRange: [number, number] = [Math.max(0, headStart), Math.max(0, headEnd)];
```

- [ ] **Step 2: Kafa parçasını işaretle**

`buildRig` içinde kafa kabuğunu ekleyen `part(...)` çağrısını bul ve `head: true` geçir. `part` yardımcısını buna göre genişlet:

```ts
  const part = (bone: THREE.Bone, geo: THREE.BufferGeometry, color: number, unlit: boolean,
                x = 0, y = 0, z = 0, head = false): void => {
    const g = paintGeometry(geo, color);
    if (x || y || z) g.translate(x, y, z);
    parts.push({ geo: g, bone, unlit, head });
  };
```

Kafa çağrısı:

```ts
  // Kafa kabuğu: öfke tintlemesinin boyadığı aralık burası.
  part(head, roundBox(0.49, 0.5, 0.47, 0.21), p.face, false, 0, HEAD_MESH_Y, 0, true);
```

- [ ] **Step 3: `setHeadTint`'i kur**

`buildRig`'in sonunda, dönüşten önce:

```ts
  const baseFace = new THREE.Color().setHex(p.face, THREE.SRGBColorSpace).convertSRGBToLinear();
  const tintTmp = new THREE.Color();
  /**
   * Öfke tintlemesi. Materyal artık GLOBAL olduğu için rengini değiştirmek
   * bütün karakterleri kızdırırdı; tint kafa vertex aralığına yazılır.
   * Her kare değil, yalnız durum değişiminde çağrılır.
   */
  const setHeadTint = (color: number | null): void => {
    const attr = skinned.geometry.getAttribute('color') as THREE.BufferAttribute;
    const [s, e] = headRange;
    if (e <= s) return;
    if (color === null) tintTmp.copy(baseFace);
    else tintTmp.setHex(color, THREE.SRGBColorSpace).convertSRGBToLinear();
    for (let i = s; i < e; i++) attr.setXYZ(i, tintTmp.r, tintTmp.g, tintTmp.b);
    attr.needsUpdate = true;
  };
```

`Rig` arayüzünden `headMat` ve `headBaseColor` alanlarını **sil**, yerine ekle:

```ts
  /** Öfke tintlemesi — null taban yüz rengine döner. */
  setHeadTint(color: number | null): void;
  headRange: [number, number];
```

- [ ] **Step 4: Animatördeki tint kullanımını çevir**

`src/chars/CharacterAnimator.ts` içinde `headMat` / `headBaseColor` kullanan yerleri bul (`grep -n "headMat\|headBaseColor" src/chars/CharacterAnimator.ts`) ve `this.rig.setHeadTint(...)` çağrısına çevir. Rengi geri alan yol `setHeadTint(null)` olur.

> **⚠️ SAHİPLİK ÇAPASI — Task 6 sonrası düzeltme.** `headMat`'i düşürmek göründüğünden tehlikeli: o materyalin `'dispose'` olayına **iki** GPU kaynağının serbest bırakılması bağlı — birleşik geometri **ve** `skeleton.dispose()` (kemik matrisi `DataTexture`'ı, karakter başına bir tane). Task 6 ikincisini ekledi çünkü onsuz karakter başına bir doku sızıyordu.
>
> `headMat` karaktere özel taze bir klon olduğu için ideal bir çapaydı: karakter başına tam bir kez ateşleniyordu. Kafa global materyale katılınca o çapa kayboluyor. **Yerine geçecek sahiplik mekanizmasını bu görevde kurmak zorundasın** — yoksa Task 5'te kapatılan geometri sızıntısı ve Task 6'da kapatılan doku sızıntısı birlikte geri gelir, üstelik sessizce.
>
> Ölçüm iki sayacı da izlemeli: `renderer.info.memory.geometries` **ve** `renderer.info.memory.textures`. İkisi de kur-at turunda düz kalmalı. Task 6'nın ölçtüğü referans: 40 karakterlik turda `geometries 297→337→297`, `textures 30→70→30`.

- [ ] **Step 5: Tip denetimi**

Run: `npm run typecheck`
Expected: hata yok.

- [ ] **Step 6: Özdeşlik kapısı + tint doğrulaması**

**Kapı artık çıplak çağrılmaz.** Task 6 tek birleşik mesh'e geçerken beyan edilmiş bir gölge farkı yarattı (81 parça `receiveShadow=false` idi, tek mesh'in tek bayrağı `true` oldu); beyan verilmezse kapı **kalıcı olarak kırmızı** yanar. Doğru çağrı:

```js
const ROOT = 'C:/Users/Enes/Desktop/oyun';
eval(await (await fetch('/@fs/' + ROOT + '/tools/rig-identity.js')).text());
__rigIdentity({ declaredShadowReceiveGain: true });
```

Expected: `pass: true`, `shadowDeclared` sıfırdan büyük (Task 6 referansı ~953.522), `notes: []`.

Beyan **yönlüdür ve dar**: yalnız `castShadow` eşitken "legacy almıyordu → next alıyor" yönünü soğurur. Gölge **kaybı** ve `castShadow` sapması hâlâ kapıyı kırmızı yakar (canlı mutasyonla doğrulandı). Beyanı vermene rağmen hiçbir örnek soğurulmazsa kapı yine kırmızı yanar — yani beyan körlük üretmiyor.

**Bu görevde kapıya bir ek yapman gerekiyor:** `drawCalls` şu an `pass` formülünde **değil** (`tools/rig-identity.js:835`). Yani birleştirme yanlışlıkla 4 grup üretse kapı yine yeşil yanardı ve yalnız elle koşulan `__rigProbe` yakalardı. Bu görev çizim çağrısını 3'ten 2'ye indirdiği için ölçütü kapıya bağlamanın tam yeri burası: `drawCalls.next` beklenen değere eşit olmalı ve beklenen değer çağrıdan verilebilmeli.

Tinti elle sına — global materyalin sızmadığını kanıtlamak için **iki** karakter gerekiyor:

```js
const I = window.__charInternals;
const a = I.buildRig(I.createAppearance('customer', { seed: 5 }));
const b = I.buildRig(I.createAppearance('customer', { seed: 9 }));
a.setHeadTint(0xff0000);
const col = (r) => { const c = r.skinned.geometry.getAttribute('color'); const [s] = r.headRange; return [c.getX(s), c.getY(s), c.getZ(s)]; };
console.log('kızgın:', col(a), '· komşu:', col(b));
a.setHeadTint(null);
console.log('geri alındı:', col(a));
```

Expected: `a` kırmızıya döner, `b` **hiç etkilenmez** (global materyal sızıntısı yok), `null` sonrası `a` taban renge döner.

- [ ] **Step 7: Commit**

```bash
git add src/chars/CharacterSkin.ts src/chars/CharacterRig.ts src/chars/CharacterAnimator.ts
git commit -F - <<'EOF'
rig: öfke tintlemesi vertex aralığına taşındı

Materyal artık global ve paylaşımlı; rengini değiştirmek bütün
karakterleri kızdırıyordu. Tint kafa vertex aralığına yazılıyor —
birleştirme sırasında aralık saklanıyor, yalnız durum değişiminde
güncelleniyor, her kare değil.

Işıklı parçalar birleşik geometride önce geldiği için kafa indeksleri
doğrudan geçerli. İki karakterle sınandı: biri kızarken komşusu
etkilenmiyor, null taban renge dönüyor.

Rig.headMat / headBaseColor kaldırıldı, yerine setHeadTint geldi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Sızıntı doğrulaması — geometri **ve** doku

> **KAPSAM DEĞİŞTİ (Task 5 ve 6 sonrası).** Bu görev artık sızıntıyı *kapatmak* için değil, **kapalı kaldığını doğrulamak** için. Sızıntı iki turda zaten kapatıldı:
> - Task 5 (Critical): karakter başına ~40 boyalı klon geometri dispose edilmiyordu → `isPaintedGeometry()` WeakSet + `owned` dizisi + `headMat`'in `'dispose'` olayı.
> - Task 6: karakter başına bir kemik matrisi `DataTexture`'ı sızıyordu → aynı olaya `skeleton.dispose()` bağlandı.
> - Task 7: `headMat` çapası kalktığı için yerine yeni bir sahiplik mekanizması kuruldu.
>
> **Bu yüzden ölçüm İKİ sayacı birden izlemeli** — yalnız `geometries` bakmak Task 6 ve 7'nin eklediği doku sahipliğini kör eder:
> `renderer.info.memory.geometries` **ve** `renderer.info.memory.textures`.
>
> Referans (Task 6, 40 karakterlik kur-at turu): `geometries 297→337→297`, `textures 30→70→30`. Karakter başına tam 1 geometri + 1 doku, tam geri dönüş.
>
> İkisinden biri tırmanıyorsa Task 7'nin sahiplik mekanizması eksik demektir; bu görev o zaman doğrulama değil düzeltme turu olur.

`chars/index.ts`'deki `dispose()` yorumu hâlâ bayat olabilir (*"paylaşımlı malzeme/geometri önbellekte kalır"*, `src/chars/index.ts:82-84`) — artık her karakterin geometrisi kendine ait. Yorumu gerçeğe getir.

> **DEVREDEN İKİ KAPI İŞİ (Task 7 incelemesinden).** Bu görev doğrulama turu olduğu için kapının kendi sağlamlığı da buraya ait.
>
> **(1) Important — tint kolu belgesiz bir dilim SIRASI tesadüfüne dayanıyor.** Kapı `setHeadTint`'in yazdığı değeri ancak `angry` dilimi bulut alınan dilimden **önce** koştuğu için ölçüyor. Sabotajla kanıtlandı: varsayılan sırada tint'in null yolunu bozmak yakalanıyor (`colorMismatches 2873`, `joint: head`); `angry` dilimi çıkarılınca **aynı sabotaj görünmez** oluyor (`colorMismatches 0`) — kol sessizce `paintGeometry`'nin dokunulmamış tamponunu ölçmeye düşüyor. Hiçbir yerde not ya da assert yok.
>
> Çözüm denendi ve yeşil: `segments`'e açık bir `{ state: 'angry', cloud: true }` dilimi ekle. Bu hem tint **rampasının t≈1 ucunu** ölçüme sokar (bugün yalnız t=0 ölçülüyor) hem sıra bağımlılığını ortadan kaldırır — kol artık tesadüfe değil açık bir dilime dayanır. Ölçülen maliyet: `colorSamples` +117.474, daraltılmış koşuda **+~0,3 sn**. Sonuç `pass: true`, `colorMismatches: 0` — yani t≈1'de legacy (materyal) ile yeni (öznitelik) kapının kendi makinesiyle de özdeş.
>
> **(2) Minor — `expectDrawCalls` gevşetme yönünde kelepçesiz.** `tools/rig-identity.js:121-126`. Kelepçe yalnız alt sınırda (min 1), yani *sıkılaştırma* yönünde. Ölçüldü: `expectDrawCalls: 5` ile koşumda **hiç `notes` yok**. Yani kod 3 gruba gerilerse `__rigIdentity({ expectDrawCalls: 3 })` yeşil yanar. `TOL_MAX`/`FRAMES_MIN` tam tersini yapıyor — bu ölçüt de onlara uydurulmalı (üst sınır kelepçesi + ihlalde `notes`).
>
> Bu, Task 10'da kapının referans tarafı kalkmadan **önce** yapılmalı: legacy silinince `drawCalls` ölçütü tek başına kalıyor ve gevşetilebilir bir kapı, kapı değildir.

**Files:**
- Modify: `src/chars/index.ts` (`dispose()`)

**Interfaces:**
- Consumes: `Rig.skinned` (Task 6)
- Produces: davranış değişimi; yeni dışa açık arayüz yok.

- [ ] **Step 1: Sızıntıyı ölç (kanıt önce)**

`npm run dev`, oyunu aç, konsolda:

Gerçek yolu sına: fabrikadan kur, `dispose()` ile at. Rig'i elle kurmak `dispose()`'u atlar ve ölçümü anlamsız kılar.

```js
const g = window.__fincan;
const I = window.__charInternals;
const geoCount = () => g.scene3d.renderer.info.memory.geometries;

// Sayaç yalnız GPU'ya yüklenmiş geometrileri sayar; bir kare render
// etmeden yükleme olmaz, o yüzden her turda render çağırıyoruz.
const churn = (n) => {
  for (let i = 0; i < n; i++) {
    const ch = I.createCharacter('customer', { seed: i * 31 + 7 });
    g.scene3d.scene.add(ch.root);
    g.scene3d.render();
    ch.dispose();
  }
};

console.log('başlangıç:', geoCount());
churn(60);
g.scene3d.render();
console.log('60 kur-at sonrası:', geoCount());
```

Expected (düzeltmeden ÖNCE): sayaç **belirgin artmış** olmalı (~60 × karakter geometrisi). Artmıyorsa sızıntı yok demektir — o zaman bu task'ı atla ve nedenini commit mesajına yaz.

- [ ] **Step 2: `dispose()`'u düzelt**

`src/chars/index.ts` içindeki `dispose()` gövdesini güncelle:

```ts
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.anim.dispose();
    this.root.removeFromParent();
    /**
     * Geometri artık KARAKTERE AİT (vertex renkleri ve kemik ağırlıkları
     * kişiye özel), bu yüzden serbest bırakılmak ZORUNDA. Eskiden
     * bırakılmıyordu çünkü geometriler `world/Materials` önbelleğinden
     * paylaşımlıydı — o varsayım skinned geçişiyle bitti; bırakılmazsa
     * her müşteri VRAM sızdırır.
     *
     * Materyaller hâlâ global ve paylaşımlı: onlara DOKUNULMAZ.
     */
    this.rig.skinned.geometry.dispose();
    this.root.clear();
    this.rig.ponytail = null;
  }
```

- [ ] **Step 3: Sızıntının kapandığını ölç**

Step 1'deki `churn` ölçümünü **aynen** tekrar koştur (sayfayı yenile, aracı yeniden yükle, `churn(60)`).

Expected: `60 kur-at sonrası` sayacı `başlangıç` ile **aynı** (±2 dalgalanma). Hâlâ tırmanıyorsa `dispose()` geometriye ulaşamıyor — `rig.skinned` alanı doğru mu, `dispose()` iki kez çağrılıp ilkinde mi dönüyor?

Ardından gerçek oyunda doğrula: `?perf=1` ile 4-5 dakika oynat (müşteriler gelip gider), sonra:

```js
console.log('geometri:', window.__fincan.scene3d.renderer.info.memory.geometries);
```

Expected: sayaç **yatay** kalmalı (müşteri sayısıyla dalgalanır ama sürekli tırmanmaz). Tırmanıyorsa `World`'ün karakter atma yolu `dispose()` çağırmıyor demektir — orayı kontrol et.

- [ ] **Step 4: Tip denetimi ve commit**

Run: `npm run typecheck`
Expected: hata yok.

```bash
git add src/chars/index.ts
git commit -F - <<'EOF'
rig: karaktere ait geometri dispose ediliyor — VRAM sızıntısı kapandı

dispose() geometriyi bilinçli olarak bırakıyordu; gerekçe geometrilerin
world/Materials önbelleğinden paylaşımlı olmasıydı. Skinned geçişiyle o
varsayım bitti: vertex renkleri ve kemik ağırlıkları kişiye özel, yani
geometri karaktere ait. Ölçüldü — 60 kur-at turunda geometri sayacı
tırmanıyordu, artık yatay.

Materyaller hâlâ global ve paylaşımlı; onlara dokunulmuyor.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 9: Doğum maliyetini ölç ve bandı doğrula

Spec 3.6'nın kapısı. Her doğuş artık bir birleştirme + GPU yüklemesi; bunun kare bütçesini bozmadığını rakamla göstermek gerekiyor.

**Files:**
- Modify: `tools/rig-probe.js` (doğum süresi ölçümü eklenir)

**Interfaces:**
- Consumes: `window.__charInternals` (Task 3)
- Produces: `window.__rigSpawnCost({n})` → `{ mean, p95, max, samples }` (milisaniye). Task 12 bunu rapora alır.

- [ ] **Step 1: Ölçümü `tools/rig-probe.js` dosyasının sonuna ekle**

```js
/**
 * DOĞUM MALİYETİ — bir karakteri kurmanın kare bütçesine etkisi.
 *
 * Neden ölçülüyor: skinned geçişinden önce geometriler önbellekten
 * paylaşımlıydı ve doğum neredeyse bedavaydı. Artık her karakter kendi
 * geometrisini birleştiriyor. 60 fps bütçesi 16,7 ms; bu maliyet oranın
 * belirgin bir dilimini yerse doğuşta takılma görülür.
 */
function __rigSpawnCost(opts = {}) {
  const n = opts.n ?? 40;
  const I = window.__charInternals;
  if (!I) throw new Error('window.__charInternals yok — dev derlemesi mi?');
  const samples = [];
  for (let i = 0; i < n; i++) {
    const spec = I.createAppearance('customer', { seed: i * 7919 + 3 });
    const t0 = performance.now();
    const rig = I.buildRig(spec);
    samples.push(performance.now() - t0);
    rig.skinned.geometry.dispose();
    rig.root.clear();
  }
  samples.sort((a, b) => a - b);
  const report = {
    mean: +(samples.reduce((s, x) => s + x, 0) / samples.length).toFixed(2),
    p95: +samples[Math.floor(samples.length * 0.95)].toFixed(2),
    max: +samples[samples.length - 1].toFixed(2),
    n,
  };
  window.__rigSpawnReport = report;
  console.table(report);
  return report;
}
```

- [ ] **Step 2: Koştur**

```js
const ROOT = 'C:/Users/Enes/Desktop/oyun';
eval(await (await fetch('/@fs/' + ROOT + '/tools/rig-probe.js')).text());
__rigSpawnCost({ n: 60 });
```

Expected (spec 5.2 bandı): `p95 < 4` ms.

- [ ] **Step 3: Bant aşılırsa**

`p95 >= 4` ms ise **bu planda çözülmez** — spec 3.6 havuzlamayı bilinçli olarak kapsam dışında tutuyor (YAGNI). Yapılacak: ölçülen değeri Ölçüm Kütüğü'ne yaz, spec'in 3.6 bölümüne "ölçüldü: p95 = X ms, havuzlama gerekiyor" notunu ekle ve ayrı bir tur olarak kaydet. Planı burada durdurmaz.

- [ ] **Step 4: Commit**

```bash
git add tools/rig-probe.js docs/superpowers/plans/2026-08-17-skinned-karakter.md
git commit -F - <<'EOF'
perf: doğum maliyeti ölçümü — karakter kurmanın kare bütçesine etkisi

Skinned geçişinden önce geometriler paylaşımlıydı ve doğum bedavaydı;
artık her karakter kendi geometrisini birleştiriyor. Ölçüm p95 üzerinden
raporlanıyor, bant spec 5.2'den (4 ms). Sonuç kütüğe işlendi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 9b: Doğum maliyetini düşür — çifte klonlamayı kaldır

> **BU GÖREV PLANA SONRADAN EKLENDİ (2026-08-18, oyuncu kararı).** Task 9 bandı tutmadı: `p95 ≈ 22,5-24,0 ms`, bant `< 4 ms`. Plan "düzeltme yok, kaydet ve geç" diyordu (havuzlama YAGNI, spec 3.6), ama bu oyuncunun duran şartıyla çatışıyor: *"kalite düşsün istemiyorum."* Doğuş takılması bir kalite gerilemesi ve oyuncunun daha önce açıkça reddettiği sınıfta. Oyuncuya sorulup **şimdi düzeltilmesine** karar verildi.
>
> **Bu görev havuzlama DEĞİL.** Havuzlama hâlâ kapsam dışı. Bu görev, ölçülmüş bir **israfı** kaldırıyor.

**Ölçülen kök neden.** Bir karakter kurulurken geometri **iki kez** klonlanıyor:

1. `paintGeometry` (Task 5) kaynak geometriyi klonlar ve `color` özniteliği yazar — çünkü kaynak `world/Materials` önbelleğinden paylaşımlı, üstüne yazılamaz.
2. `CharacterSkin.normalize()` (Task 6) o klonu **yine** klonlar, dinlenme dönüşümünü uygular, eksik `uv`'yi doldurur, fazla öznitelikleri atar, `skinIndex`/`skinWeight` ekler.
3. `mergeGeometries` birleşik tamponları ayrıca tahsis eder; iki turdaki bütün ara geometriler çöp olur.

Ölçüm: 120 doğuşta heap **+33,7 MB**, yani doğuş başına **~280 KB çöp**. Örneklerin ~%30'u 8-26 ms sıçrama gösteriyor ve desen üç bağımsız koşumda tekrarlanıyor — V8 GC duraklaması. `charLod` açıkken sıçrama 18-20/60'tan 4/60'a iniyor (daha az parça = daha az çöp), yani teşhis mekanizmayla tutarlı.

**Files:**
- Modify: `src/chars/CharacterSkin.ts` (birleştirme hattı)
- Modify: `src/chars/CharacterMaterials.ts` (`paintGeometry`'nin rolü değişir)
- Modify: `src/chars/CharacterRig.ts` (`litPart`/`unlitPart`/`part` çağrı sözleşmesi)

**Interfaces:**
- Consumes: `SkinPart`, `buildSkin` (Task 6); `isPaintedGeometry` sahiplik mekanizması (Task 5/7)
- Produces: aynı `buildSkin(...)` dönüşü (`{ mesh, headRange }`). Dışa açık davranış **değişmez**; yalnız iç tahsis hattı değişir.

**Yaklaşım — kademeli, ölç ve dur.**

**Adım A (önce bunu dene): iki klonu bire indir.** `paintGeometry` artık klonlamasın; parça kaydı geometriyi **kopyalamadan** taşısın (`{ sourceGeo, color, bone, unlit, head }`) ve tek klonu `normalize()` yapsın — orada zaten klon var. `normalize()` aynı geçişte rengi de yazar. Böylece parça başına bir klon ve bir tahsis turu kalkar.

Bu, çöpün kabaca yarısını götürmeli. Ölç. **Bant tutuyorsa dur** — Adım B'ye girme (YAGNI).

**Adım B (yalnız A yetmezse): ara `BufferGeometry` nesnelerini tamamen kaldır.** Birleşik tamponları önceden tahsis et (toplam vertex ve index sayısı parça listesinden hesaplanabilir), sonra parçaları tek geçişte doğrudan o tamponlara yaz: kaynak özniteliklerini oku, konumu/normali dinlenme matrisiyle dönüştür, rengi ve kemik indeksini/ağırlığını yaz, index'i ofsetle. `mergeGeometries` çağrısı da kalkar. Parça başına sıfır ara nesne.

**Sahiplik basitleşiyor.** Ara klonlar yok olunca serbest bırakılacak tek şey birleşik geometri (+ `skeleton`) kalır. `isPaintedGeometry` WeakSet'inin varlık sebebi ortadan kalkabilir — kalkıyorsa **kaldır**, ama `disposeOwned` sözleşmesini bozmadan: sayaçlar (`geometries` **ve** `textures`) kur-at turunda düz kalmaya devam etmeli.

**Kabul bantları:**

| Ölçüt | Değer |
|---|---|
| Doğum maliyeti `p95` | **< 4 ms** (Task 9: 22,5-24,0) |
| Doğuş başına çöp | Task 9'un ~280 KB'ından **belirgin düşüş**, ölç ve raporla |
| Özdeşlik kapısı | `pass: true`, `notes: []` — bu bir **optimizasyon**, çıktı değişmemeli |
| `drawCalls.next` | **2** (değişmemeli) |
| `geometries` / `textures` sayaçları | kur-at turunda **düz** |

**Ortam uyarısı.** Task 9 mutlak ms değerlerinin bu ortamda şişmiş olabileceğini bildirdi (tarayıcı paneli kalıcı olarak `document.hidden`, `window.gc()` yok). Bu yüzden asıl ölçüt **göreli iyileşme** ve **çöp hacmi**: ikisi de ortamdan bağımsız. Mutlak `p95` bandı APK turunda teyit edilecek. Bant bu ortamda tutmazsa ama çöp belirgin düştüyse ve göreli iyileşme büyükse, sonucu **rakamla** raporla ve durumu Task 12'nin cihaz ölçümüne bırak — uydurma.

---

### Task 10: Eski kurucuyu sil

Kapı yeşil yandığına göre `buildRigLegacy` borç haline geldi. Ölü kod kalırsa bir sonraki geliştirici hangisinin canlı olduğunu bilemez.

**Files:**
- Modify: `src/chars/CharacterRig.ts` (`buildRigLegacy` silinir)
- Modify: `src/chars/index.ts` (dev kancasından çıkarılır)
- Modify: `tools/rig-identity.js` (tek kurucuyla çalışan **regresyon** kipine döner)

**Interfaces:**
- Consumes: hepsi
- Produces: `__rigIdentity()` artık `{ pass, drawCalls, jointFinite, vertexFinite }` döner — karşılaştırma yerine **sağlık denetimi**: 2 çizim çağrısı, tüm eklem matrisleri sonlu (NaN yok), vertex bulutu boş değil.

> **Ölü vertex temizliği için doğal an (Task 6'dan devreden Minor).** Task 6, LOD dalında kaş vertex'lerini geometride bırakıp yalnız index'ini boşaltmak zorunda kaldı — silmek karşılaştırmalı kipin `countMismatches` ölçütünü kırardı. Bedeli karakter başına **442 ölü vertex (~30 KB VRAM)** ve tam da LOD'un hizmet ettiği zayıf cihazlarda.
>
> Karşılaştırmalı kip bu görevde kalktığı için kısıt da kalkıyor. Sağlık denetimini kurarken **yalnız index'in referans verdiği vertex'leri** say; ardından LOD dalında kaş vertex'lerinin geometriye hiç konmaması güvenli hâle gelir. İkisini birlikte yap ya da hiç yapma — vertex'leri silip sayımı düzeltmezsen ölçüm yanıltıcı olur.

- [ ] **Step 1: Son kez karşılaştırmalı kapıyı koştur ve sonucu kaydet**

Kapı çıplak çağrılmaz (Task 6'nın beyan edilmiş gölge farkı):

```js
const ROOT = 'C:/Users/Enes/Desktop/oyun';
eval(await (await fetch('/@fs/' + ROOT + '/tools/rig-identity.js')).text());
const r = __rigIdentity({ frames: 240, declaredShadowReceiveGain: true });
console.log(JSON.stringify({ pass: r.pass, maxJointError: r.maxJointError, maxVertexError: r.maxVertexError, drawCalls: r.drawCalls }));
```

Expected: `pass: true`. Çıktıyı Ölçüm Kütüğü'ne yaz — bu, özdeşliğin **tarihsel kanıtı** olarak planda kalır.

- [ ] **Step 1b: Kapıya KALICI NORMAL KOLU ekle — silmeden ÖNCE**

> **Task 9b re-review'undan devreden iş.** Kapı bugün **normal vektörlerini hiç okumuyor** (`tools/rig-identity.js`'te "normal" kelimesi sıfır kez geçiyor). Task 9b Adım B ilk kez **elle** normal-matris dönüşümü yazdı, yani bu kör nokta artık gerçek bir risk. Adım B'nin doğruluğu tek seferlik bir script'le doğrulandı ama **kalıcı hiçbir şey inmedi**.
>
> Aciliyeti zamanlamadan geliyor: bu adımdan sonra `buildRigLegacy` siliniyor ve normalleri legacy'ye karşı karşılaştırma imkânı **kalıcı olarak** kayboluyor. Adım B'yi gerekçelendiren argümanın birebir aynısı: referans taraf kalkmadan önce yapılmalı.

Legacy'den **bağımsız** ve ucuz bir değişmez ekle (legacy silindikten sonra da hayatta kalır):

1. Her üçgen için `dot(faceNormal(positions), vertexNormal) > 0` — normaller yüzeyin dışına bakıyor mu
2. Tüm normaller **birim boyda** mı

Ölçülen maliyet (re-review, canlı): ~18.500 yüz-vertex kontrolü, milisaniye mertebesi, **0 ihlal**, min dot **0,80**. Yani hem ucuz hem şu an yeşil — taban buradan alınabilir.

Kolu `pass` formülüne bağla. Ekledikten sonra **legacy hâlâ ayaktayken bir kez koştur** ve iki tarafın da geçtiğini gör; sonra silmeye geç. Dejenere (sıfır) normallerin iki tarafta **eşit** sayıda olduğu ve ham kaynak geometriden geldiği ölçüldü (24/24, 28/28, 20/20 — `SphereGeometry` kutupları) — bu kolun bunları ihlal saymaması gerekiyor, yoksa kalıcı yanlış alarm üretir.

- [ ] **Step 1c: Elle muhasebeye gürültülü kapı ekle**

> **Task 9b re-review'undan devreden Minor.** Adım B elle offset muhasebesi yapıyor: iki tarama (biri boyut hesaplayan, biri yazan). Bugün muhasebe kanıtlanabilir şekilde tam (`maxIndex === vertexCount-1`, kuyruk sıfırı yok). Ama ileride iki tarama ayrışırsa (biri parçaları farklı filtrelerse) typed-array taşma yazımları **sessiz no-op** olur — patlamak yerine bozuk geometri üretir.

`src/chars/CharacterSkin.ts`'de yazma döngüsünden sonra iki satır:

```ts
  // İki tarama (boyut hesabı ve yazım) ayrışırsa typed-array taşması sessiz
  // no-op olur ve bozuk geometri üretir. Muhasebeyi burada gürültüye çevir.
  if (vOff !== totalVerts || iOff !== totalIndices) {
    throw new Error(`buildSkin muhasebe uyuşmazlığı: vertex ${vOff}/${totalVerts}, index ${iOff}/${totalIndices}`);
  }
```

Değişken adları koddaki gerçek adlarla eşleşmeli — koddan doğrula.

- [ ] **Step 2: `buildRigLegacy`'yi sil**

`src/chars/CharacterRig.ts`'den `buildRigLegacy` fonksiyonunu ve artık kullanılmayan yardımcılarını (`mergeStaticSiblings`, `mesh`, `detail`, `mat`, `basic` importları — hangileri gerçekten kullanılmıyorsa) kaldır. `buildRig` sarmalayıcısı da kalkar; yeni kurucu doğrudan `buildRig` adını alır.

`src/chars/index.ts`'deki dev kancasından `buildRigLegacy`'yi çıkar:

```ts
if (import.meta.env.DEV) {
  (window as unknown as { __charInternals?: unknown }).__charInternals = {
    buildRig,
    CharacterAnimator,
    createAppearance,
  };
}
```

ve import satırını sadeleştir:

```ts
import { buildRig, type Rig } from './CharacterRig';
```

- [ ] **Step 3: `rig-identity.js`'i sağlık denetimi kipine çevir**

Karşılaştırma bloğunu tek kurucuyla çalışan denetime indir:

```js
/**
 * RIG SAĞLIK DENETİMİ.
 *
 * Karşılaştırmalı kip (eski ↔ yeni) geçişin kapısıydı ve eski kurucu
 * silinince anlamını yitirdi; özdeşlik kanıtı plana ve commit geçmişine
 * işlendi. Kalan denetim regresyon içindir: karakter tam 2 çizim çağrısı
 * etmeli, hiçbir eklem matrisi NaN üretmemeli, vertex bulutu boş olmamalı.
 */
function __rigIdentity(opts = {}) {
  const FRAMES = opts.frames ?? 120;
  const SEEDS = opts.seeds ?? [1, 7, 42, 1337, 90210];
  const I = window.__charInternals;
  if (!I) throw new Error('window.__charInternals yok — dev derlemesi mi?');

  const JOINTS = ['root', 'bob', 'hips', 'torso', 'neck', 'head',
    'shoulderL', 'shoulderR', 'armUpperL', 'armLowerL', 'handL',
    'armUpperR', 'armLowerR', 'handR', 'legUpperL', 'legLowerL', 'footL',
    'legUpperR', 'legLowerR', 'footR', 'ponytail'];

  let drawCalls = 0;
  let jointFinite = true;
  let vertexFinite = true;
  const problems = [];

  for (const seed of SEEDS) {
    for (const role of ['customer', 'staff']) {
      const spec = I.createAppearance(role, { seed });
      const rig = I.buildRig(spec);
      const anim = new I.CharacterAnimator(rig, spec, seed);

      const gr = rig.skinned.geometry.groups;
      drawCalls = gr && gr.length ? gr.length : 1;
      if (drawCalls !== 2) problems.push({ seed, role, issue: `çizim çağrısı ${drawCalls} (2 olmalı)` });

      for (const st of ['idle', 'walk', 'carry', 'work']) {
        anim.setState(st);
        for (let f = 0; f < FRAMES; f++) anim.update(1 / 60, st === 'walk' ? 2.4 : 0);
        rig.root.updateMatrixWorld(true);
        for (const name of JOINTS) {
          const j = rig[name];
          if (!j) continue;
          for (const e of j.matrixWorld.elements) {
            if (!Number.isFinite(e)) { jointFinite = false; problems.push({ seed, role, state: st, issue: `${name} matrisi NaN` }); break; }
          }
        }
      }

      const pos = rig.skinned.geometry.getAttribute('position');
      if (!pos || pos.count === 0) { vertexFinite = false; problems.push({ seed, role, issue: 'vertex bulutu boş' }); }

      rig.skinned.geometry.dispose();
      rig.root.clear();
    }
  }

  const pass = problems.length === 0 && drawCalls === 2 && jointFinite && vertexFinite;
  const report = { pass, drawCalls, jointFinite, vertexFinite, problems };
  window.__rigIdentityReport = report;
  console.log(pass ? '✅ SAĞLIKLI' : '❌ SORUN VAR', report);
  return report;
}
```

- [ ] **Step 4: Tip denetimi ve tam derleme**

Run: `npm run typecheck`
Expected: hata yok.

Run: `npm run build`
Expected: derleme başarılı. Bu, dev kancasının üretimde elendiğini de doğrular — çıktıda `__charInternals` **geçmemeli**:

```bash
grep -r "__charInternals" dist/ || echo "temiz: dev kancası üretimde yok"
```

- [ ] **Step 5: Sağlık denetimini koştur ve oyunu aç**

```js
const ROOT = 'C:/Users/Enes/Desktop/oyun';
eval(await (await fetch('/@fs/' + ROOT + '/tools/rig-identity.js')).text());
__rigIdentity();
```

Expected: `✅ SAĞLIKLI`, `drawCalls: 2`.

Oyunu birkaç dakika oynat: karakterler yürümeli, taşımalı, kızmalı; konsol hatası olmamalı.

- [ ] **Step 6: Commit**

```bash
git add src/chars/CharacterRig.ts src/chars/index.ts tools/rig-identity.js docs/superpowers/plans/2026-08-17-skinned-karakter.md
git commit -F - <<'EOF'
rig: eski katı-mesh kurucu silindi

Özdeşlik kapısı 240 karede yeşil yandı ve sonuç plana işlendi; legacy
kurucu artık borç. Ölü kod kalırsa bir sonraki geliştirici hangisinin
canlı olduğunu bilemez.

rig-identity aracı karşılaştırmalı kipten regresyon kipine döndü: 2 çizim
çağrısı, NaN üretmeyen eklem matrisleri, boş olmayan vertex bulutu.

Üretim derlemesinde __charInternals geçmediği doğrulandı.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 11: Kademe tabanlarını YÜKSELT (spec 2.1)

İşin ikinci yarısı ve oyuncunun asıl şartı. Çizim çağrısı için yapılmış kırpmaların gerekçesi kalktı; geri alınıyorlar.

**Files:**
- Modify: `src/core/Quality.ts` (`TIERS` + başlık yorumu)

**Interfaces:**
- Consumes: Task 6-10'un ölçülmüş çizim çağrısı kazancı
- Produces: `TIERS` yeni tabanlar. `evaluateHeat`, `DPR_CAP`, `effectiveSettings` merdiven basamakları **değişmez**.

- [ ] **Step 1: Tabanları yükselt**

`src/core/Quality.ts` içindeki `TIERS` sabitini değiştir:

```ts
/**
 * KADEME TAVANLARI — skinned geçişinden sonra yeniden ölçüldü.
 *
 * Eski tabanlar çizim çağrısı için kırpılmıştı: düşük kademe gölgeyi
 * kapatıyor, LOD'u zorluyor ve müşteriyi 16'ya indiriyordu. Karakter
 * başına çağrı 41'den 2'ye inince bu kırpmaların gerekçesi kalmadı.
 *
 * OYUNCU KARARI (2026-08-17): "kalite düşürerek akıcılık ve ısınmama
 * getirirsek yine de oynanması tercih edilmez bir oyun oluruz." Bu yüzden
 * tabanlar AŞAĞI değil YUKARI ayarlandı ve `maxCustomers` eşitlendi —
 * oyuncunun telefonu artık ekonomisini belirlemiyor.
 *
 * `charLod` hiçbir KADEME TABANINDA açık değil: çizim çağrısı amacı bitti.
 * Mekanizma yine de duruyor, çünkü ısı merdiveninin 2. basamağı onu emniyet
 * ağı olarak kullanıyor (bkz. effectiveSettings) — orada işi çizim çağrısı
 * değil vertex sayısı ve doğum maliyetini kısmak.
 *
 * Kademeler arasında kalan tek fark GÖLGE HARİTASI BOYUTU.
 */
const TIERS: Record<QualityTier, TierSettings> = {
  high: { charLod: false, maxCustomers: 26, shadows: true, shadowMapSize: 2048 },
  medium: { charLod: false, maxCustomers: 26, shadows: true, shadowMapSize: 1024 },
  low: { charLod: false, maxCustomers: 26, shadows: true, shadowMapSize: 1024 },
};
```

Dosyanın **başındaki ölçüm notuna bu task'ta DOKUNULMAZ.** O nota "sonra" rakamları girecek ve rakamlar henüz ölçülmedi; yer tutucu yazmak kaynak koda yalan bırakmak olur. Notu Task 12 Step 6 gerçek değerlerle günceller.

- [ ] **Step 2: `detectTier()` yorumunu gerçekle uyumlu tut**

`detectTier()`'ın mantığı **değişmez** (cihaz tahmini hâlâ yararlı: gölge haritası boyutu farkı kalıyor). Ama yorumundaki "high mobil GPU'da riskli" gerekçesi artık yanıltıcı; şu notu ekle:

```ts
  // NOT: kademeler arasındaki fark skinned geçişinden sonra yalnız gölge
  // haritası boyutudur; müşteri tavanı ve karakter detayı her kademede
  // aynı. Yani bu tahminin yanlış çıkması artık oynanışı değiştirmez.
```

- [ ] **Step 3: Tip denetimi**

Run: `npm run typecheck`
Expected: hata yok.

- [ ] **Step 4: Düşük kademeyi elle zorla ve ısıyı izle**

Ayarlar → 🎚️ Grafik → **Düşük** seç (ya da konsolda `__fincan` üzerinden `applyTier('low', true)` çağır). Sonra `?perf=1` ile 10 dakika oynat.

Expected: gölge **açık**, karakterler **tam detay**, müşteri tavanı 26; perf yazısında ısı basamağı **≤1**.

Isı 2+'ya çıkıyorsa: **tabanı geri indirme.** Spec 5.3'ün teşhis yolunu izle (Task 12, Step 3) — darboğaz fill-rate'e kaydıysa çözüm oradadır, kırpmaya dönmek son çaredir.

- [ ] **Step 5: Commit**

```bash
git add src/core/Quality.ts
git commit -F - <<'EOF'
perf: kademe tabanları yükseltildi — kırpmaların gerekçesi kalktı

Eski tabanlar çizim çağrısı için kırpılmıştı: düşük kademe gölgeyi
kapatıyor, LOD'u zorluyor, müşteriyi 16'ya indiriyordu. Karakter başına
çağrı 41'den 2'ye inince gerekçe ortadan kalktı.

Oyuncu kararı (2026-08-17): "kalite düşürerek akıcılık ve ısınmama
getirirsek yine de oynanması tercih edilmez bir oyun oluruz." Tabanlar bu
yüzden aşağı değil YUKARI ayarlandı.

maxCustomers üç kademede de 26 — oyuncunun telefonu artık ekonomisini
belirlemiyor. Quality.ts:48'deki "kademe tavanları ekonomiyi
belirlememeli" kuralı nihayet tam karşılanıyor; kademeler arasında kalan
tek fark gölge haritası boyutu.

Isı merdiveninin eşikleri ve basamak sırası DEĞİŞMEDİ; emniyet ağı yerinde.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 12: Kabul turu — termal, düşük cihaz, denge

Spec 5'in tamamı. Bu task'ın çıktısı rakamlardır; "düzeldi" demenin ölçütü onlar.

**Files:**
- Modify: `docs/superpowers/plans/2026-08-17-skinned-karakter.md` (Ölçüm Kütüğü)
- Modify: `src/core/Quality.ts` (başlıktaki ölçüm satırları)
- Modify: `docs/CHANGELOG.md` (sürüm notu)

**Interfaces:**
- Consumes: `__rigProbe`, `__rigSpawnCost`, `__rigIdentity`, `__runBalanceBot`
- Produces: doldurulmuş Ölçüm Kütüğü ve CHANGELOG girdisi.

- [ ] **Step 1: Çizim çağrısı ve termal (spec 5.2)**

Task 1'in tabanıyla **aynı senaryoyu** koş — karşılaştırma ancak öyle anlamlı. "38 aktör" senaryosu ulaşılamaz olduğu için taban 18 aktör / 45 dk'dır (bkz. Ölçüm Kütüğü'ndeki düzeltme notu):

```js
const ROOT = 'C:/Users/Enes/Desktop/oyun';
const g = window.__fincan;

// Temiz başlangıç + 45 dk simülasyon = Task 1'in ÖNCE senaryosu (1601 çağrı, 18 aktör).
g.persist = () => {};
localStorage.clear();
location.reload();
// (yeniden yüklendikten sonra:)
eval(await (await fetch('/@fs/' + ROOT + '/tools/balance-bot.js')).text());
__runBalanceBot({ minutes: 45, sync: true });
g.scene3d.render();

eval(await (await fetch('/@fs/' + ROOT + '/tools/rig-probe.js')).text());
__rigProbe();
__rigSpawnCost({ n: 60 });
```

Kabul bantları — **biri kapı, biri ölçüm, biri bilgi.** Ayrım önemli:

**KAPI (mutlak, kesin):**
- `perChar.drawCalls === 2` — bu işin kontrol ettiği tek sayı. Yapısaldır: birleşik geometrinin tam iki materyal grubu vardır, kadraj elemesinden ve sahne durumundan **bağımsız**. Tutmazsa iş bitmemiştir.
- `spawn p95 < 4` ms

**ÖLÇÜM (göreli, aynı senaryoda önce/sonra):**
- `scene.calls` **≥ %30 düşmeli** (ÖNCE 1681, 18 aktör / 45 dk). Beklenen ~%48 (≈879). Mutlak bir tavan yazmıyoruz — bkz. aşağıdaki uyarı.
- Aktör sayısı 18'e **yakın** olmalı; belirgin farklıysa senaryo aynı değil ve karşılaştırma geçersizdir. Aktör sayısını rapora yaz.

**BİLGİ (kapı DEĞİL):**
- `nonCharCalls` ve karakterlerin paydaki oranı. Bunlar `scene.calls − charCallsTotal` çıkarmasından geliyor ve **yanlıdır**: `scene.calls` renderer'ın kadraj elemesi uygulanmış gerçek sayacı, `charCallsTotal` ise sondanın kadrajı hesaba katmayan yapısal sayımı. Ölçüldü — tek aktörde yapısal 42'ye karşı gerçek katkı 31 (~%26 fazla sayım). İki farklı temelin çıkarması karakter dışı yükü **sistematik olarak olduğundan az** gösterir. Raporla, ama üzerine kabul kararı kurma.

> **Neden mutlak tavan yok.** Bu plan mutlak sahne-çağrısı tavanını üç kez yanlış tahmin etti: `< 250` → `< 800` → `< 950`. Üçü de karakter dışı yükün ne kadar olduğuna dair tahmine dayanıyordu ve o sayı ölçülene kadar bilinmiyordu (gerçek: ~810-845, üstelik yanlı ölçülmüş). Mutlak tavan bu işin kontrol etmediği bir şeyi kapı yapıyor. Göreli düşüş ise renderer'ın kendi sayacından gelir, yanlılık taşımaz ve tam olarak bu işin etkisini ölçer.

**Termal bant burada ölçülemez** (Global Constraints'teki uyarı): ısı merdiveni rAF'tan besleniyor ve ajan tarayıcısında rAF donuk. Isı basamağı ve fps, kullanıcının telefonunda `npm run android:apk` çıktısıyla `?perf=1` üzerinden doğrulanacak (kullanıcı kararı, 2026-08-17). Kütükteki ısı satırlarını "cihazda ölçülecek" diye işaretle, uydurma.

- [ ] **Step 2: Kademeler arası ekonomi farkı yok (spec 5.3)**

**Botla iki kademeli A/B koşumu YAPILMAZ.** `balance-bot.js` başlarken `localStorage.clear()` çağırıyor (temiz ölçüm için, bilinçli), yani Ayarlar'dan seçilen kademe silinip cihaz tahminine dönüyor. Bot koşumu kademeyi sabit tutamaz; öyle bir ölçüm sonucu ne ölçtüğünü bilmez.

Doğru doğrulama iki katmanlı ve daha kesin:

**(a) Yapısal denetim.** Ekonomiyi belirleyen tek kademe alanı `maxCustomers`. Üç kademede de eşitse fark **imkânsızdır** — ölçmeye gerek yok, okumak yeter:

```js
// Kademeleri sırayla uygula ve etkin müşteri tavanını oku.
// (applyTier + QUALITY, Quality modülünden geliyor; Game bunları kullanıyor.)
const g = window.__fincan;
for (const t of ['low', 'medium', 'high']) {
  g.setQualityTier ? g.setQualityTier(t) : null; // Ayarlar → Grafik ile de yapılabilir
  console.log(t, '→ maxCustomers:', g.qualitySnapshot ? g.qualitySnapshot().maxCustomers : '(Ayarlar panelinden oku)');
}
```

`Game` üzerinde böyle bir kanca yoksa **elle** doğrula: Ayarlar → 🎚️ Grafik'ten sırayla Düşük / Orta / Yüksek seç, her seçimde `?perf=1` yazısındaki müşteri tavanını (ya da mekândaki eşzamanlı müşteri sayısının dayandığı tavanı) oku. Üçünde de **26** olmalı.

En kesin denetim kaynak kodda: `src/core/Quality.ts`'deki `TIERS`'ın üç satırında da `maxCustomers: 26` yazıyor olmalı ve `effectiveSettings`'in 3. basamağı (`heat >= 3`) ısı ≤1 kaldığı sürece hiç çalışmamalı.

**(b) Isı basamağı düşük kademede de ≤1.** Step 1'deki 30 dakikalık oturumu Ayarlar → Grafik → **Düşük** ile tekrarla (bot yok, elle oyna — kademe böylece korunur). Kabul: ısı **≤1** ve `maxCustomers` kısmasının hiç devreye girmemiş olması.

Isı 2+'ya çıkıyorsa **tabanı geri indirme**; Step 3'ün fill-rate teşhisine geç.

- [ ] **Step 3: Fill-rate teşhisi (spec 5.3, yalnız ısı >1 çıktıysa)**

Bu adım **koşullu**: Step 1'de ısı ≤1 çıktıysa **atla** ve kütüğe "gerekmedi" yaz.

Isı >1 çıktıysa darboğazın piksele mi kaydığını ayırt et. Çözünürlüğü geçici olarak yarıya indir — **yalnız teşhis, üretim yolu değil**:

```js
const g = window.__fincan;
const dpr = g.scene3d.renderer.getPixelRatio();
console.log('mevcut DPR:', dpr);
g.scene3d.renderer.setPixelRatio(dpr / 2);
// 60 saniye oynat, perf yazısındaki fps'i izle
// sonra geri al:
g.scene3d.renderer.setPixelRatio(dpr);
```

Belirgin fps artışı varsa darboğaz **fill-rate**'tir ve spec 3.7'nin shader kolu değerlendirmeye açılır (Step 4). Artış yoksa kol açılmaz; başka bir yeri aramak gerekir.

- [ ] **Step 4: Shader kolu (spec 3.7 + 5.4, yalnız Step 3 fill-rate dediyse)**

Bu adım da **koşullu** ve varsayılan cevabı **hayır**. Yalnız Step 3 fill-rate'i işaret ettiyse:

`src/chars/CharacterMaterials.ts` içindeki `charLitMaterial`'ı geçici olarak `MeshLambertMaterial`'a çevir, portre kadrajda önce/sonra kare al:

```js
const g = window.__fincan;
g.scene3d.render();
await fetch('/__shot', { method: 'POST', body: JSON.stringify({
  name: 'shader-sonra.png', data: g.scene3d.renderer.domElement.toDataURL('image/png') }) });
```

Görsel kapı (spec 5.4): fark **ayırt edilemez** olmalı **ve** fps kazancı **ölçülebilir** olmalı. İkisinden biri tutmazsa değişikliği **geri al** ve `MeshStandardMaterial`'da kal. Kararı ve gerekçesini kütüğe yaz.

- [ ] **Step 5: Denge bozulmamış (spec 5.5)**

```js
const ROOT = 'C:/Users/Enes/Desktop/oyun';
eval(await (await fetch('/@fs/' + ROOT + '/tools/balance-bot.js')).text());
__runBalanceBot({ minutes: 50, sync: true });
JSON.stringify(__botReport, null, 1);
```

Kabul: bölge sayısı, t1 / r1 / r2 zamanları, kızgın müşteri ve hijyen bantları v5.2 ölçümleriyle aynı bantta (bkz. `docs/CHANGELOG.md` v5.0 ve v5.2 ölçüm satırları).

`maxCustomers` düşük kademede 16'dan 26'ya çıktığı için **düşük kademeli cihazlarda gelir tavanı yükseldi** — bu bilinçli. Bant kayarsa kaymanın bu sebepten olduğunu doğrula ve kütüğe yaz; başka bir sebepten kayıyorsa dur ve incele.

- [ ] **Step 6: Ölçüm Kütüğü'nü doldur ve `Quality.ts` notunu tamamla**

Bu dosyanın sonundaki Ölçüm Kütüğü tablosunu gerçek rakamlarla doldur.

Ardından `src/core/Quality.ts` başlığındaki ölçüm notunu güncelle. Eski rakam (1395 çizim çağrısı) artık yanlış ve bir sonraki geliştiriciyi yanlış yere bakmaya gönderir. Ölçülen değerleri **rakam olarak** yaz — yer tutucu bırakılmaz:

```ts
/**
 * KALİTE KADEMELERİ + ISI MERDİVENİ
 *
 * Ölçüm (masaüstü, 38 karakter, tüm baylar açık):
 *   ÖNCE  (katı mesh hiyerarşisi)  render 8,6 ms · 1395 çizim çağrısı
 *   SONRA (tek skinned mesh)       render A ms · B çizim çağrısı
 *
 * Çizim çağrısının baskın kaynağı karakterlerdi (kişi başı ~41 mesh) ve
 * kademeler bu yüzden iki koldan iniyordu. Skinned geçişiyle karakter
 * başına çağrı 2'ye indi; kademelerin kırpma gerekçesi ortadan kalktı ve
 * tabanlar yükseltildi (bkz. TIERS).
 *
 * ÇÖZÜNÜRLÜK HİÇBİR KOLDAN DÜŞMEZ. DPR tavanı SABİT (DPR_CAP); ısı
 * yönetimi gölge / LOD / kalabalık gibi çözünürlük DIŞI kollardan iner.
 */
```

`A` ve `B` yerine Step 1'de ölçtüğün gerçek değerleri yaz.

- [ ] **Step 7: CHANGELOG girdisi**

`docs/CHANGELOG.md` dosyasının başına, deponun üslubunda (kök neden + ölçüm + karar) bir bölüm ekle. En az şunları içermeli: ölçülen önce/sonra çizim çağrısı, karakter başına 41→2, kademe tabanlarının yükseltilmesi ve gerekçesi (oyuncu kararı), `maxCustomers` eşitlenmesinin ekonomik sonucu, doğum maliyeti ölçümü, shader kolunun açılıp açılmadığı.

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/plans/2026-08-17-skinned-karakter.md src/core/Quality.ts docs/CHANGELOG.md
git commit -F - <<'EOF'
belge: skinned karakter kabul turu — ölçümler kütüğe işlendi

Çizim çağrısı, termal, doğum maliyeti, kademeler arası ekonomi farkı ve
50 dk denge koşumu ölçüldü; bantlar spec 5'ten. Quality.ts başlığındaki
ölçüm notu gerçek önce/sonra rakamlarıyla tamamlandı, yer tutucu kalmadı.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Ölçüm Kütüğü

Task 1 temeli koyar, Task 6 / 9 / 12 doldurur. **Yer tutucu bırakılmaz** — plan bitince bu tablo tamamen dolu olmalı.

| Ölçüt | Bant (spec) | ÖNCE (Task 1) | ARA (Task 6) | SONRA (Task 12) | Durum |
|---|---|---|---|---|---|
| Karakter başına çizim çağrısı | 2 | 54 | **3** (çıplak rig, 20/20 aktörde) · sonda 4 | **2** — 18/18 ve 24/24 aktörde, iki bağımsız koşum, `rigCallViolations 0`; `__rigIdentity()` 160 vakada `drawCalls 2 · drawCallsMin 2` | ✅ **KAPI TUTTU** |
| Karakter başına materyal | 2 | 15 | **3** (2 global + `headMat`) | **2** — üstelik sahnedeki TÜM skinned mesh'lerin toplam ayrık materyal sayısı da 2 (global paylaşım) | ✅ |
| Karakter başına vertex | ölç, raporla | 4779 (üçgen 6606) | 3347 (üçgen 3975) — *aynı reçetede legacy ile birebir, kapı: `countMismatches 0`* | 4585 ort. (üçgen 6488); aktör aralığı 4165–5412 | bilgi |
| Sahne çizim çağrısı (18 aktör / 45 dk) | **≥ %30 düşüş** (mutlak tavan YOK) | 1681 | 283 (20 görünür aktör / 45 dk) — bkz. not | **367** → **%78,2 düşüş** (aynı senaryo, aynı aktör sayısı). Çapraz kontrol: 24 aktörlü ikinci koşum 662 (daha kalabalık mekân, yine %60,6 düşüş) | ✅ (bant ≥ %30) |
| Aktör sayısı (senaryo eşliği) | 18'e yakın | 18 | 25 toplam / 20 görünür | **18 toplam / 18 görünür** — Task 1 tabanıyla **birebir**; çapraz kontrol koşumu 24/24 | ✅ senaryo eşi |
| Karakterlerin paydaki oranı (bilgi, yanlı) | kapı değil | ~%50 | ~%26 (73/283) | **%13,4** (49/367); yalnız rig payı **%9,8** (36/367) | bilgi |
| Karakter dışı sahne çağrısı (bilgi, yanlı) | kapı değil | ~843 (alt sınır) | ~210 (alt sınır) | **318** (alt sınır) — baskın maliyet artık burası | bilgi |
| Doğum maliyeti p95 | < 4 ms | (yok) | | **1,1 ms** (`customer`, n=60, ort. 0,55 · maks 1,6; ısınma turu p95 2,5) — Task 9'un 22,5–24,0 ms'sinden sonra Task 9b iki adımda indirdi | ✅ **BANT TUTTU** |
| Isı merdiveni (30 dk) | ≤ 1 | | | **cihazda ölçülecek** — `evaluateHeat` yalnız rAF'tan besleniyor, ajan tarayıcısı kompozit etmiyor ve rAF donuk (koşum boyunca `heatLevel` 0'da kaldı, merdiven hiç çalışmadı) | ⏳ cihaz |
| `maxCustomers` kısması devreye girdi mi | hayır | | | **hayır** — kısma `heat >= 3`'te var; `heatLevel` hiç 0'ın üstüne çıkmadı. Ayrıca kısma olmasa da bağlayıcı değil: `venueCapacity` koşumlarda 12–20'de kaldı, `QUALITY.maxCustomers` 26 tavanı hiç dayanmadı | ✅ (ısı basamağı cihazda doğrulanacak) |
| Düşük kademe: gölge / LOD / müşteri | açık / kapalı / 26 | | | **açık / kapalı / 26** — `Game.setQualityTier('low')` sonrası çalışma anında okundu | ✅ |
| `maxCustomers` üç kademede de 26 (yapısal) | evet | | | **evet** — kaynak (`TIERS`) ve çalışma anı (`__charInternals.QUALITY`, üç kademe sırayla) birebir; kalan tek fark `shadowMapSize` 2048/1024/1024 | ✅ |
| Isı basamağı düşük kademede (30 dk) | ≤ 1 | | | **cihazda ölçülecek** (yukarıdaki satırla aynı sebep — rAF donuk) | ⏳ cihaz |
| Özdeşlik kapısı (Task 10, 240 kare) | `pass: true` | — | `pass: true` (120 kare, 160 vaka, iki LOD dalı) | **`pass: true`** (240 kare) — bkz. "Task 10: özdeşliğin tarihsel kanıtı" | ✅ |
| Sağlık denetimi (`__rigIdentity`, regresyon kipi) | `pass: true` | — | — | **`pass: true` · `notes: []`** — 160 vaka / 120 kare / iki LOD dalı: `drawCalls 2` · eklem+vertex sonlu · `deadVertices 0` · `normalViolations 0` · 91.440 matris + 1.758.693 vertex kontrolü | ✅ |
| Fill-rate teşhisi gerekti mi | — | — | hayır | **gerekmedi** — koşullu adım, yalnız ısı >1 çıkarsa açılıyordu; ısı bu ortamda ölçülemedi ve merdiven hiç çalışmadı | — |
| Shader kolu açıldı mı | varsayılan hayır | — | hayır | **hayır** — Step 3 fill-rate demedi (koşulmadı), varsayılan cevap korundu; `MeshStandardMaterial`'da kalındı | — |
| Denge: bölge / t1 / r1 / r2 / kızgın / hijyen | v5.2 bandı | | | **4 × 50 dk temiz koşum:** bölge 17–20/21 · t1 1:03–1:31 · r1 11:32–14:05 · r2 39:25 / 45:13 (4'ün 2'sinde ulaşıldı) · kızgın 3–6 (%0,26–0,54) · hijyen 51–83. Bkz. aşağıdaki "Denge: yayılım geniş, nedensel yol yok" notu | ✅ (yayılım içinde; sim dosyaları bu dalda hiç değişmedi) |
| GPU kaynağı / karakter (Task 6'da eklendi) | sızıntı yok | — | 1 geometri + 1 kemik dokusu; kur-at turu Δ0/Δ0 | **sızıntı yok** — `__rigLeakCheck({n:40})`: geometri 307→347→307, doku 36→76→36, `up 40 / down 40`, `flat: true` | ✅ |

### Task 10: özdeşliğin TARİHSEL KANITI (karşılaştırmalı kapının son koşumu)

`buildRigLegacy` bu koşumdan hemen sonra silindi; karşılaştırma bir daha
**yapılamaz** (referans taraf yok). Rakamlar bu yüzden burada duruyor.

Koşum: `__rigIdentity({ frames: 240, declaredShadowReceiveGain: true })`

| Ölçüt | Değer |
| --- | --- |
| `pass` | **true** · `notes: []` · `rowCount: 0` |
| `maxJointError` | **0** (tam sıfır) |
| `maxVertexError` | **7,74417903137703e-8** (tolerans 1e-4 — pay ~1290 kat) |
| `vertexNearestMiss` / `vertexMismatches` | 0 / 0 |
| `countMismatches` / `visibilityMismatches` | 0 / 0 |
| `colorMismatches` / `shadowMismatches` | 0 / 0 |
| `drawCalls` | legacy **60** → next **2** (`nextMin` 2, ihlal 0) |
| Kapsam | 160 vaka · iki LOD dalı · 240 kare · 10 dilim · 30 düğüm |
| Karşılaştırılan örnek | **744.320** matris + **5.614.209** vertex + **1.871.403** renk |
| Beyan edilmiş gölge farkı | 1.430.283 örnek (`declaredShadowReceiveGain`) |
| Süre | 3662 ms |

**Normal kolu (Adım 1b) — legacy AYAKTAYKEN iki tarafta koşuldu.** Kapı o güne
kadar normal vektörlerini hiç okumuyordu; Task 9b elle normal-matris dönüşümü
yazdığı için kör nokta gerçek bir riskti. İki değişmez (üçgen başına
`dot(faceNormal, vertexNormal) > 0` ve birim boy), 160 vaka:

| | legacy | next |
| --- | --- | --- |
| `normalViolations` | **0** | **0** |
| yüz-vertex kontrolü | 2.621.256 | 2.441.736 |
| birim-boy kontrolü | 620.339 | **620.339** (eşit) |
| en kötü birim sapması | 4,258559282988017e-8 | **4,258559282988017e-8** (birebir) |
| min `dot` | 0,470 | 0,461 |
| dejenere normal | **3462** | **3462** (160 vakanın HER BİRİNDE eşit) |
| sıfır alanlı üçgen | 0 | 0 |

Dejenere normaller **ham kaynak geometriden** geliyor (`SphereGeometry`
kutupları), yeni koddan değil — kanıtı iki taraftaki birebir eşitlik. Kol
bunları ihlal saymıyor, ayrı alanda raporluyor.

**Task 6 ara ölçümü — iki uyarı.**

1. **`perChar.drawCalls` sondada 3 değil 4 çıkar ve bu doğrudur.** Sonda
   `char` kökünün TÜM alt ağacını sayıyor; `carryAnchor` ve `headTop` altına
   oyunun kendi nesneleri bağlanıyor (taşınan tepsi kulesi, istek balonu,
   sabır çubuğu). Rig payı ayrıştırıldığında 20 görünür aktörün **20'sinde de
   tam 3**. Kapı olan sayı budur; birleşik geometrinin materyal grubu sayısı
   sahne durumundan bağımsız yapısal bir olgudur.
2. **Sahne çizim çağrısı satırı Task 6'da KAPI DEĞİL.** 1681 → 283 farkının
   tamamı bu işe yazılamaz: iki koşumun mekân gelişimi (açılan bölge, alınan
   mobilya) botun ilerleyişine bağlı ve birebir aynı değil, `nonCharCalls`
   çıkarması da zaten yanlı (bu bölümün "üç tur" kaydına bak). Karakter payı
   838 → 73 kısmı temiz ve doğrudan ölçülmüş; gerisi Task 12'nin kontrollü
   senaryosunda yeniden ölçülecek.

### Task 11: kademe tabanları yükseltildi — yapısal doğrulama (termal HARİÇ)

`TIERS` değişti (bkz. `src/core/Quality.ts`): üç kademede de
`charLod: false, shadows: true, maxCustomers: 26`; kalan tek fark
`shadowMapSize` (2048 / 1024 / 1024). `evaluateHeat`, histerezis ve
`DPR_CAP` **dokunulmadı**.

**Yapısal doğrulama** (`applyTier` + `window.__charInternals.QUALITY`, hem
izole modül yolunda hem gerçek `Game.setQualityTier` yolunda, ikisi birebir):

| tier | charLod | shadows | maxCustomers | shadowMapSize |
| --- | --- | --- | --- | --- |
| high | false | true | 26 | 2048 |
| medium | false | true | 26 | 1024 |
| low | false | true | 26 | 1024 |

**Isı merdiveni hâlâ çalışıyor** — `evaluateHeat` senteze zorlanarak (80ms/60fps
kötü kare × cooldown tüketen nötr kareler) `low` tabanından 0→5→0 tam
tur koşuldu, hiç rAF gerekmedi (kapatma çağrıları saf hesap):

| basamak | charLod | shadows | maxCustomers | shadowMapSize |
| --- | --- | --- | --- | --- |
| 0 | false | true | 26 | 1024 |
| 1 | false | true | 26 | 1024 |
| 2 | **true** | true | 26 | 1024 |
| 3 | true | true | **20** | 1024 |
| 4 | true | **false** | 20 | 1024 |
| 5 | true | false | 20 | 1024 |
| 4..0 (iniş) | — inişte birebir aynı sırayla geri alındı, 0'da tabana kayıpsız döndü | | | |

`high` tabanında L1 basamağı ayrıca sınandı: `shadowMapSize` 2048→1024
(düşük tabanda zaten 1024 olduğu için görünmeyen etki burada görünür oldu).

Sağlık denetimi (`__rigIdentity()`, çıplak): `pass: true · notes: [] ·
drawCalls 2 · deadVertices 0 · normalViolations 0` — Task 10 tabanıyla
(bölüm yukarıda) rakam rakam **aynı**; bu iş yalnız `Quality.ts`'e
dokunduğu için beklenen sonuç.

**Termal/fps bantları bu ortamda ölçülemedi** (bkz. yukarıdaki "Termal
bantlar ÖLÇÜLEMEZ" notu — rAF donuk). Tablodaki şu satırlar hâlâ boş ve
**cihazda ölçülecek** (Task 12, `npm run android:apk` + `?perf=1`,
kullanıcı kararı 2026-08-17):

- `Isı merdiveni (30 dk)`
- `maxCustomers kısması devreye girdi mi`
- `Isı basamağı düşük kademede (30 dk)`

`Düşük kademe: gölge / LOD / müşteri` ve `` `maxCustomers` üç kademede de
26 (yapısal) `` satırları için bandın **yapısal** kısmı yukarıdaki tabloyla
doğrulandı (açık / kapalı / 26 — birebir); tablo hücrelerine yazılmadı
çünkü bu tablo Task 1/6/9/12'nin doldurma alanı, ayrıştırma karışmasın diye
kanıt burada, ayrı bölümde duruyor.

Detay: `task-11-report.md`. Commit `a529000`.

### ⚠️ Task 1 ölçümü İKİ BANDI ÇÜRÜTTÜ — düzeltmeler ve gerekçeleri

Ölçüm bu planın iki kabul bandını geçersiz kıldı. İkisi de benim (planı yazanın) ölçüm öncesi tahminimdi; Task 1 tam bunu bulmak için vardı. **Kod incelemesi bu bölümdeki ilk düzeltmenin kendisinde de bir hata buldu** (sonda ata-görünürlük zincirini saymıyordu) — aşağıdaki rakamlar düzeltilmiş sondayla YENİDEN ölçüldü; ayrıntı "Fix round 1" bölümünde.

**1. "Sahne çizim çağrısı < 250" ULAŞILAMAZ — kaldırıldı.**

Düzeltilmiş sonda karakter payını artık TAHMİN değil TOPLAM olarak veriyor (`charCallsTotal`, ortalama × aktör sayısı değil). 18 aktör/45 dk'da: sahne 1681 çağrı, karakterler (görünürlük zincirine göre) tam 838, kalan tam **843 çağrı karakter DEĞİL.** Bağımsız ikinci bir 45 dk koşumu aynı büyüklüğü doğruluyor (19 aktör: sahne 1669, karakter 857, kalan 812). Ben karakter dışı yükü ~100 varsayıp `< 250` yazmıştım; gerçek ~810-845.

**KARAR (round 3, koordinatör): mutlak sahne-çağrısı tavanı KAPI OLMAKTAN ÇIKARILDI.**

Bu bant üç kez yanlış tahmin edildi: `< 250` → `< 800` → `< 950`. Kök neden her seferinde aynı: tavan, karakter dışı yükün ne kadar olduğuna dair bir tahmine dayanıyor ve o sayı **bu işin kontrol ettiği bir şey değil.** Üstelik onu türeten `nonCharCalls` çıkarması yanlı (renderer'ın kadraj elemeli sayacı eksi sondanın yapısal sayımı; tek aktörde ~%26 fazla sayım ölçüldü), yani tavanı ne kadar yükseltirsek yükseltelim dayanağı sağlam olmuyor.

Yerine geçen ölçüt **göreli düşüş**: aynı senaryoda `scene.calls` ≥ %30 azalmalı (ÖNCE 1681, beklenen ~%48). Bu sayı renderer'ın kendi sayacından gelir, yanlılık taşımaz ve tam olarak bu işin etkisini ölçer.

**Asıl kapı zaten mutlak ve kesin: `perChar.drawCalls === 2`.** Birleşik geometrinin tam iki materyal grubu olması yapısal bir olgudur — kadrajdan, sahne durumundan, aktör sayısından bağımsız. Ölçüm turlarının hiçbiri bu kapıyı sarsmadı.

Aşağıdaki iki alt bölüm, o üç turun kaydı olarak duruyor.

**2. İlk düzeltme "< 800" de tutmadı — round 2'de "< 950"ye çekildi (sonra kapı olmaktan çıkarıldı, bkz. yukarı).**

İlk düzeltmemde (sonda henüz görünürlük zincirini doğru saymıyordu, bkz. Fix round 1) "karakterler ≈ 900, kalan ≈ 700" tahminiyle `< 800` yazmıştım. Düzeltilmiş ölçüm kalan yükün ~700 değil **~810-845** olduğunu gösterdi. Formül `nonCharCalls + 2 × actorsVisible` (karakterler 2 çağrıya indiğinde beklenen toplam), iki bağımsız 45 dk koşumuyla: 843+36=**879** ve 812+38=**850**. Ortalama ~865, daha yükseği 879; ~%10 pay ile **< 950**.

**3. "38 aktör, tüm baylar açık" senaryosu ULAŞILAMAZ — 18-19 aktör / 45 dk oldu.**

45 dakikalık bot koşumlarında (iki bağımsız, temiz başlangıçlı) 17 bölge açık ama `maxCustomers` henüz 11 (`venueCapacity` 16). 38 aktöre ulaşmak çok daha uzun bir ekonomi gerektiriyor. Karşılaştırma tabanı **tekrarlanabilir** bir senaryo: temiz başlangıç + `__runBalanceBot({minutes: 45, sync: true})` + elle bir kare. Task 12 aynı senaryoyu koşar; ÖNCE = 1681 (18 aktör), çapraz kontrol 1669 (19 aktör).

`src/core/Quality.ts` başlığındaki "1395 çizim çağrısı / 38 karakter" notu da bu ölçümle çelişiyor. O not farklı koşullarda alınmış eski bir profil; Task 12 onu **taze ölçümle** değiştirir ve 38 aktör iddiasını tekrarlamaz.

**4. YENİ BULGU — sıradaki termal kol karakterler değil, mekânın içi.**

Bu iş bittiğinde karakterlerin payı ~%50-60'tan %5'in altına inecek (36/879≈%4,1 ve 38/850≈%4,5 — ikisi de `< %6` bandının içinde) ve **baskın maliyet ~830 çağrılık karakter dışı sahne** olacak: istasyonlar, raflar, masalar, ödeme pedleri, dekor. v5.0'da yalnız *sokak* diyete girmişti (574 mesh → 17), mekânın içi girmemişti.

Bu plana **dahil değil** (YAGNI — kapsam karakterler). Ama bir sonraki termal turun konusu bu; Task 12 bunu CHANGELOG'a bulgu olarak yazar.

### Fix round 1 — sonda düzeltmesi (kod incelemesi)

Kod incelemesi `tools/rig-probe.js`'de kritik bir hata buldu: `root.traverse` ata zincirindeki `visible=false`a bakmıyordu, yalnız yaprak mesh'in kendi bayrağına bakıyordu. Oyun `char.root.visible`ı gerçekten kapatıyor (`Customer.ts:555`, `Staff.ts:288` — `World.ts`'teki `isNearCamera`, odaktan 26 birimden uzak aktörlerde). Eski sonda böyle bir karakteri, sahne ona sıfır çağrı harcarken, tam maliyetli normal bir karakter gibi sayıyordu.

**Düzeltme:** `traverse` yerine invisible düğümde duran (altına hiç inmeyen) elle özyineleme — renderer'ın (`WebGLRenderer.projectObject`) yaptığı tam bu. **Doğrulama:** bir aktörü elle gizleyip `g.scene3d.render()` ile yeniden çizdirdim; sonda o aktörü 0 çizim çağrısıyla saydı ve `scene.calls` gerçekten düştü; görünürlüğü geri alınca her iki sayaç da BİREBİR eski değerine döndü (tam detay: `task-1-report.md` "Fix round 1"). Rapor ile aynı turda `actorsTotal`/`actorsVisible`/`charCallsTotal`/`nonCharCalls` alanları eklendi; `perChar` ortalaması artık yalnız görünür karakterler üzerinden.

Doğrulama sırasında iki ek bulgu çıktı (bu turun kapsamı dışında, bilgi amaçlı): **(a)** taşınan ürün yığını (`stack`, `carryAnchor` üzerinden `torso`'nun alt ağacında) karakter maliyetinin parçası — bir aktörün o anki kargosu (0-9 ürün) ölçümü büyük oynatıyor (oyuncu bir koşumda 6 ürün taşırken 159, başka bir koşumda 1 ürün taşırken 62 çizim çağrısı ölçtü; NPC ortalaması iki koşumda da 46 kalması çoğu NPC'nin o anlarda elinin boş yakalanmasından — garanti değil, tesadüfi). **(b)** `frustumCulled=true` (three.js varsayılanı, değiştirilmemiş) nedeniyle görünürlük zinciri sağlam ama kamera frustumunun (fov 34, dar) dışına düşen mesh parçaları sonda tarafından hâlâ sayılıyor — kontrollü testte 42 çizim çağrısı ölçülen bir aktör gizlenince gerçek sahne çağrısı yalnız 31 düştü (~%26 kalan sapma, TEK aktörde ölçüldü, genele yayılmadı). Bu, `charCallsTotal`'ı hafif yukarı ve `nonCharCalls`'ı hafif aşağı çekiyor; kapsamı ata-görünürlük zincirinin ötesine (kamera frustum matematiği) geçtiği için bu turda düzeltilmedi.

**Not (Task 1 ölçüm koşulları, round 2 — düzeltilmiş sondayla yeniden ölçüldü):** `__rigProbe()`, `npm run dev` + `?perf=1`, standart yordamla (temiz başlangıç: `g.persist=()=>{}; localStorage.clear(); location.reload()`; bot dakikayı pompaladı, `g.scene3d.render()` ile elle bir kare, sonra sonda) koşuldu; kalite kademesi "gölge açık" (tavan, ısı merdiveni rAF donuk olduğu için hiç inmedi). `drawCalls`/`materials` bantları (20-45 / 15-25, brief) spec'in ön-ölçüm tahmini "~41 mesh (LOD ~25)"ine dayanıyordu (spec §1 satır 16, 28, 44); sonda three.js'in gerçek çizim çağrısı birimini sayıyor (geometri grubu başına bir çağrı — Task 3'teki `countDraws` ile birebir aynı yöntem). 12 dk/temiz başlangıçta (16 aktör, tümü görünür): 54 çizim çağrısı · 15 materyal — hâlâ bandın sınırında/hafif dışında, sonda hatası değil: 45 dk'lık iki bağımsız koşum 47 ve 45 verdi, aynı aralık. **NPC-yalnız ortalama** (oyuncu hariç) iki bağımsız koşumda BİREBİR aynı çıktı: 46 çizim çağrısı · 14 materyal (12 dk'da 15 NPC, 45 dk'da 17 NPC) — oyuncunun kendisi taşıdığı kargoya göre 62-159 arası oynayan bir uç değer, blended ortalamayı yukarı çekiyor ama NPC tabanı stabil. Vertex tahmini (spec §"VRAM", 4-8k) gerçek değerle (4779) doğrulandı — bandın içinde. "38 aktör, tüm baylar açık" referans senaryosuna (spec §5.2, ~1395 çağrı tahmini) bu ölçümde ulaşılmadı: 45 dk'lık koşumlarda 17 bölge açık, `maxCustomers` henüz 11'de (yapısal tavan 26 çok daha uzun oyunda geliyor).

### Task 12: kabul turu — ölçüm koşulları ve iki dürüst boşluk

**Ortam:** `npm run dev` + `?perf=1`, masaüstü (32 çekirdek), kademe `high`
(auto saptama), gölge açık, `heatLevel` koşum boyunca 0. Yordam her koşumda
aynı: `g.persist=()=>{}; localStorage.clear(); location.reload()` → bot →
`g.scene3d.render()` (renderer sayaçları ancak bununla dolar) → sonda.
Temiz başlangıç her koşumda `state.totalEarned === 0` ile **doğrulandı**
(pagehide-persist tuzağı).

**Karakter başına 2 çizim çağrısı — kapı nasıl doğrulandı.** `__rigProbe`'un
`perChar.drawCalls` alanı 3 okur ve bu **doğrudur**: sonda `char` kökünün tüm
alt ağacını sayar, oyunun kendi nesneleri (taşınan tepsi kulesi, istek balonu,
sabır çubuğu) `carryAnchor`/`headTop` altına bağlıdır. Rig payı ayrıştırıldığında
(`isSkinnedMesh` süzgeci) iki bağımsız koşumda **42 aktörün 42'sinde de tam 2**,
`rigCallViolations 0`. 18 aktörlük koşumda karakter payı 49 çağrı = 36 rig + 13
eklenti; 13'ün tamamı **tek** aktörden (5 ürün taşıyan oyuncu). Kapının kaynaktan
gelen kanıtı ayrıca `__rigIdentity()`: 160 vakada `drawCalls 2 · drawCallsMin 2`.

**Sahne çizim çağrısı — senaryo birebir eşleşti.** Task 1 tabanı 18 aktör /
45 dk / 1681 çağrı; Task 12 koşumu **18 toplam / 18 görünür** aktörle **367**
çağrı verdi: **%78,2 düşüş**, bandın (≥ %30) çok üstünde ve planın beklentisinin
(~%48, ≈879) de üstünde. Beklentiyi aşmasının sebebi bilinir: beklenti
`nonCharCalls + 2 × aktör` formülünden geliyordu ve `nonCharCalls` **yanlı**
(kadraj elemeli renderer sayacı eksi kadraj tanımayan yapısal sayım), yani
karakter dışı yükü olduğundan büyük gösteriyordu. Gerçek ölçüm o yanlılığı
taşımıyor. Çapraz kontrol koşumu 24 aktörle 662 çağrı verdi — daha kalabalık
ve daha gelişmiş bir mekânda bile taban 1681'in %60,6 altında.

#### Denge: yayılım geniş, nedensel yol yok

4 × 50 dk temiz koşum (hepsi `high` kademe, hepsi temiz başlangıç doğrulanmış):

| Koşum | Bölge | t1 | r1 | r2 | Kızgın | Hijyen | Servis | Kazanç | `venueCapacity` |
|---|---|---|---|---|---|---|---|---|---|
| A | 19/21 | 1:31 | 12:04 | 45:13 | 3 (%0,26) | 83,1 | 1176 | ₺1,66M | — |
| B | 17/21 | 1:07 | 11:32 | — | 6 (%0,50) | 51,3 | 1206 | ₺0,98M | 12 |
| C | 17/21 | 1:03 | 14:05 | — | 6 (%0,54) | 80,6 | 1118 | ₺1,03M | 16 |
| D | 20/21 | 1:12 | 12:10 | 39:25 | 4 (%0,32) | 75,8 | 1269 | ₺2,00M | 20 |

Referanslar: **v5.0** (2 × 50 dk) 17/17 ve 16/17 bölge · t1 1:05-1:08 ·
r1 10:25-12:10 · r2 37:42-42:15 · kızgın 2-3 · hijyen 68-74. **v5.2**
(1 × 50 dk) 20/21 bölge · r1 10:00 · r2 53:19 · kızgın 12 (%0,82) ·
hijyen 79 · servis 1457.

Dört koşum her eksende iki referansı **kuşatıyor**: kızgın oranı v5.0 ile v5.2
arasında, r2 ikisinin arasında, bölge sayısı v5.0'ın 17'si ile v5.2'nin 20'si
arasında. Tek dışarı taşan değer B koşumunun 51,3 hijyeni; `balance-bot.js`
kendi yorumunda bu davranışı zaten kaydediyor (mekân büyüyünce komiler
yetişemiyor, hijyen kimi koşuda çöküyor) ve aynı bandın diğer üç koşumu
75,8-83,1 veriyor.

**Kaymanın bu işten gelmesi imkânsız — üç bağımsız yapısal sebep:**

1. **Simülasyon bu dalda hiç değişmedi.** `git diff --name-only <taban>...HEAD`
   çıktısının tamamı: `src/chars/*` (5 dosya), `src/core/Quality.ts`,
   `tools/rig-*.js`, iki belge. `src/sim/` ve `src/data/` **tek satır**
   değişmedi — sim v5.2 ile bayt bayt aynı.
2. **Ölçüm kademesi zaten değişmemişti.** Task 11 yalnız `medium` ve `low`
   satırlarına dokundu; `high` Task 11'den ÖNCE de `{ charLod: false,
   maxCustomers: 26, shadows: true, shadowMapSize: 2048 }` idi. Masaüstünde
   `detectTier()` `high` döndüğü için bu koşumlar Task 11'e **kör**.
3. **`maxCustomers` zaten bağlayıcı değil.** Sim'e sızan tek kalite alanı bu ve
   `venueCapacity = clamp(min(venue, QUALITY.maxCustomers), …)` biçiminde bir
   ÜST kırpma. Koşumlarda `venueCapacity` 12-20'de kaldı; 26 tavanına hiçbir
   koşumda dayanılmadı. Düşük kademede 16→26 yükselişi bu yüzden 50 dakikalık
   bir koşumda görünmez — etkisi mekân 16 masayı geçtikten sonra, yani çok
   daha uzun bir oyunda başlar. **Gelir tavanının yükselişi bilinçlidir ve
   gerçektir; sadece bu ölçeğin ötesindedir.**

Geriye kalan tek açıklama ölçümün kendi gürültüsü: oyun 67 yerde tohumsuz
`Math.random()` kullanıyor, botun bölge alım sırası koşumdan koşuma değişiyor.
Bu yüzden **tek koşumluk** v5.2 rakamı (20/21) bir bant değil bir örnektir;
yukarıdaki dört örnek onu içeren daha dürüst bir yayılım veriyor.

#### Ölçülemeyen üç satır — cihazda kapanacak

Isı merdiveninin üç satırı (`Isı merdiveni (30 dk)`, `Isı basamağı düşük
kademede`, kısmanın devreye girip girmediği) bu ortamda **ölçülmedi ve
uydurulmadı**. Sebep yapısal: merdiveni besleyen `evaluateHeat(workMs, fps)`
yalnız `requestAnimationFrame` döngüsünden çağrılıyor, ajan tarayıcı paneli
kompozit etmiyor ve rAF donuk. `heatLevel` her koşumda 0'da kaldı — yani
merdiven "geçti" değil, **hiç çalışmadı**. Kullanıcı kararı (2026-08-17):
telefonda `npm run android:apk` çıktısı + `?perf=1` ile doğrulanacak.

Aynı sebeple `Fill-rate teşhisi` ve `Shader kolu` adımları da açılmadı: ikisi de
"ısı >1 çıkarsa" koşuluna bağlıydı, ısı hiç ölçülemedi, varsayılan cevap
(hayır) korundu ve `MeshStandardMaterial`'da kalındı.
