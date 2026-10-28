# SKINNED KARAKTER — çizim çağrısı diyeti (tasarım)

Tarih: 2026-08-17
Durum: tasarım onaylandı (oyuncu kararı: "kaliteyi bozmayacaksa uygundur")

## 1. Sorun

`src/core/Quality.ts` başındaki ölçüm darboğazı tek bir yere çiviliyor:

```
simülasyon  0,4 ms   → hiçbir zaman darboğaz değil
render      8,6 ms   → 1395 çizim çağrısı
```

Ve aynı dosya kaynağı da adlandırıyor: *"Çizim çağrısı sayısının BASKIN
kaynağı karakterlerdir (kişi başı ~41 mesh)"*. Statik sahne v5.0'da zaten
diyete girdi (sokak 574 mesh → 17 birleşik mesh); kalan yük karakterlerde.

Kök neden mimari, ölçü değil. Oyunun karakterleri **iskelet animasyonu
kullanmıyor** — `grep -rn "SkinnedMesh\|THREE.Bone\|Skeleton" src/` boş
döner. Bunun yerine her uzuv, `THREE.Group` eklemlerine **katı** olarak
bağlı ayrı bir mesh. Kurulumun sonunda `mergeStaticSiblings`
(`src/chars/CharacterRig.ts:430-515`) birleştirme yapıyor ama yalnız
**aynı eklemdeki** kardeşleri birleştirebiliyor: farklı eklemler her kare
farklı dönüşüm aldığı için ayrı mesh kalmak zorunda. Karakter başına 23
ayrı materyal olduğundan taban da orada.

Sonuç: kişi başı ~41 mesh (LOD ~25) × 26 müşteri tavanı + personel.

### Bu yalnız termal bir sorun değil

Isı merdiveni (`Quality.evaluateHeat`) 3. basamağında `maxCustomers`'ı
6 azaltıyor. Yani ısı **doğrudan ekonomiyi** daraltıyor — ve bu, projenin
kendi kuralına ("kademe tavanları ekonomiyi belirlememeli",
`Quality.ts:48`) merdiven üzerinden geri sızmış bir istisna. Çizim
çağrısı düşerse merdiven o basamağa hiç çıkmaz ve kısma kendiliğinden
ortadan kalkar.

## 2. Hedef

| Ölçüt | Bugün | Kabul |
|---|---|---|
| Karakter başına çizim çağrısı — **ASIL KAPI** | **54** (ölçüldü; NPC-yalnız 46) | **2** |
| Sahne çizim çağrısı (18 aktör, 45 dk temiz koşum) | **1681** (ölçüldü) | **≥ %30 düşüş** (mutlak tavan yok) |
| Karakterlerin çağrıdaki payı | ~%50 | bilgi — kapı değil (yanlı ölçüm) |
| Isı merdiveni (30 dk oturum, orta cihaz) | 3-5. basamak | **≤ 1** |
| `maxCustomers` ısı kısması | 26 → 12 | **hiç devreye girmez** |
| Eklem dünya matrisleri (eski ↔ yeni) | — | **float toleransında özdeş** |
| Düşük kademe görsel tavanı | gölge kapalı · LOD zorla · 16 müşteri | **gölge açık · LOD kapalı · 26 müşteri** |
| Kademeler arası ekonomi farkı | düşük 16 ↔ yüksek 26 müşteri | **yok** (servis/dk aynı bantta) |

Görsel çıktı **değişmeyecek**. Bu bir dikkat sözü değil, 3.1'deki özdeşlik
argümanının sonucu.

**ÖLÇÜM DÜZELTMESİ (2026-08-17, plan Task 1).** Yukarıdaki "bugün" kolonu
artık tahmin değil ölçüm. Üç şey düzeldi:

- Karakter başına çizim çağrısı **~41 değil 54** (NPC-yalnız 46; oyuncunun
  avatarı uçta). Yani sorun sanılandan büyük. Oyuncunun uç değerinin sebebi
  "daha aksesuarlı olması" değil **taşıdığı ürün yığını**: kargo 0-9 üründe
  62-159 çağrı ölçüldü (`carryAnchor`, `torso`'nun altında).
- Karakter başına materyal **~23 değil 14** — `mergeStaticSiblings` aynı
  materyalli kardeşleri zaten birleştiriyordu.
- Karakter dışı sahne **~843 çizim çağrısı** tutuyor (alt sınır). Bu, spec'in
  ilk hâlindeki `< 250` kabul bandını geçersiz kıldı.
- "38 aktör, tüm baylar açık" senaryosuna 45 dakikalık botla ulaşılmıyor
  (`maxCustomers` 11'de, `venueCapacity` 16). Karşılaştırma tabanı
  tekrarlanabilir bir senaryoya çevrildi: temiz başlangıç + 45 dk bot =
  18 aktör, 1681 çağrı.

**Mutlak sahne-çağrısı tavanı kapı olmaktan çıkarıldı.** Üç kez yanlış
tahmin edildi (`< 250` → `< 800` → `< 950`), çünkü her seferinde karakter
DIŞI yükün tahminine dayanıyordu — bu spec'in kontrol etmediği bir sayı.
Üstelik onu türeten çıkarma yanlı: `scene.calls` renderer'ın kadraj elemeli
gerçek sayacı, karakter sayımı ise kadrajı hesaba katmayan yapısal sayım
(tek aktörde ~%26 fazla sayım ölçüldü). Yerine **göreli düşüş** geldi.

Asıl kapı mutlak ve kesin kaldı: **karakter başına tam 2 çizim çağrısı.**
Birleşik geometrinin iki materyal grubu olması yapısal bir olgudur; kadrajdan
ve sahne durumundan bağımsızdır.

**Sonuç olarak sıradaki termal kol değişti:** bu iş bitince karakterlerin payı
~%50'den %5'in altına inecek ve baskın maliyet mekânın içi olacak (istasyon,
raf, masa, ped, dekor — v5.0'da yalnız *sokak* diyete girmişti). Bu spec'in
kapsamı karakterler; mekân içi ayrı bir tur.

### 2.1 · Yön kuralı: kalite AŞAĞI değil YUKARI (oyuncu kararı, 2026-08-17)

*"Kalite düşsün istemiyorum. Kalite düşürerek akıcılık ve ısınmama
getirirsek yine de oynanması tercih edilmez bir oyun oluruz."*

Bu, işin yönünü tersine çeviren bir kısıt ve bugünkü davranışa aykırı.
Bugün hem taban kademe hem ısı merdiveni **kaliteyi kırparak** serinliyor:
düşük kademe gölgeyi kapatıyor, LOD'u zorluyor ve müşteriyi 16'ya
indiriyor; merdiven bunun üstüne 12 müşteri ve 30 fps ekliyor.

Kritik olgu şu: bu kırpmaların **hemen hepsi çizim çağrısı için** yapıldı
(`Quality.ts:8-12`). Çizim çağrısı karakter başına 41'den 2'ye inince
gerekçeleri ortadan kalkar. Dolayısıyla bu spec'in ikinci teslimi, ısı
merdivenini yeniden ayarlamak **değil**, **kademe tabanlarını
yükseltmektir**:

| | Bugün (düşük kademe) | Hedef |
|---|---|---|
| `charLod` | zorla açık | **kapalı** (tam detay karakter) |
| `shadows` | kapalı | **açık** (harita donmuş, kare başına maliyeti yok) |
| `maxCustomers` | 16 | **26** — kademeler eşitlenir |
| Isı merdiveni | 3-5. basamak olağan | **≤1**, kırpma basamakları erişilmez kalır |

Yani hedef "düşük cihaz da idare eder" değil, **"düşük cihaz da aynı
oyunu görür"**. Kademe farkı yalnız bir emniyet ağı olarak durur.

## 3. Çözüm

### 3.1 · Katı skinning özdeşliği — sadakatin dayanağı

Bugün hiçbir vertex iki eklem arasında paylaşılmıyor: her mesh parçası tam
bir eklemin çocuğu. Skinned mesh'e geçerken her vertex'i **eski ebeveyn
kemiğine 1,0 ağırlıkla** bağlarsak, GPU'nun uyguladığı skinning matrisi
bugünkü sahne grafiğinin uyguladığı dünya matrisiyle aynı çarpım olur:

```
bugün:  v_dünya = M_eklem · v_yerel
sonra:  v_dünya = Σ wᵢ · (B_i · Bᵢ⁻¹ₐₙᵢ) · v_yerel ,  w = [1,0,0,…]
                = M_eklem · v_yerel
```

Ağırlık boyama yok, deformasyon yok, sanatsal karar yok. **Sadakat
kurulum gereği garantidir**, ve 5.1'deki test bunu sayısal olarak
doğrular.

İkinci dayanak: `THREE.Bone`, `THREE.Object3D`'den türer ve
`position`/`rotation`/`scale` API'si `Group`'la birebir aynıdır. Bu
yüzden `CharacterAnimator`'ın eklem yazan 19 satırı (`r.armUpperL.rotation`,
`r.hips.rotation`, …) **hiç değişmez**; yalnız işaret ettikleri nesnenin
sınıfı değişir.

### 3.2 · Tek geometri, iki materyal grubu

Kurulum sonunda bütün parçalar **tek** `BufferGeometry`'de birleşir.
Materyal ayrımı `geometry.groups` ile taşınır:

| Grup | Materyal | İçerik |
|---|---|---|
| 0 | global `MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 })` | gövde, kafa, uzuvlar, saç, şapka, üstlük, ayakkabı |
| 1 | global `MeshBasicMaterial({ vertexColors: true, toneMapped: false })` | göz, kaş, ağız, bıyık, allık |

Bu ayrım korunuyor çünkü ışıksız yüz bilinçli bir okunaklılık kararı
(CHANGELOG v5.0: göz boyu ve `BROW_Y`, "göz + kaş tek koyu leke olmasın").
Karakter başına 2 çizim çağrısının ikinci hanesi budur ve **öyle kalacak**.

23 materyalin ikiye inmesini **vertex color** sağlıyor: palet renkleri
kurulum anında vertex özniteliğine yazılır. Bunun mümkün olmasının sebebi
şu doğrulanmış olgu — rig'deki hiçbir materyal özel parametre kullanmıyor:
`grep -n "transparent\|opacity\|rough\|metal\|emissive\|side:" src/chars/CharacterRig.ts`
**boş döner**. Her materyal ya `mat(renk)` (tam varsayılan) ya
`basic(renk)`. Dolayısıyla saydamlık sıralaması sorunu da yok.

İki materyal **global** ve tüm karakterler tarafından paylaşılır —
`world/Materials` önbelleğinin karakter kolu böylece tamamen boşalır.

**Birleştirmenin iki koşulu.** Bugünkü çağrı `mergeGeometries(parts, false)`,
yani grupsuz. Yeni kurulumda (a) her parça birleştirmeden **önce** aynı
öznitelik takımını taşımalı — `position · normal · color · skinIndex ·
skinWeight` — yoksa `mergeGeometries` sessizce `null` döner; (b) parçalar
materyal grubuna göre kovalanıp `useGroups: true` ile birleştirilmeli ki
`geometry.groups` iki grup üretsin. Öznitelik ekleme parça geometrisi
önbellekten geldiği için **klon üzerinde** yapılır; paylaşımlı önbellek
geometrileri kirletilmez.

### 3.3 · Kemik kümesi

Kemikler mevcut `joint()` çağrılarından **mekanik olarak** türetilir.
Bugün ~23 eklem var; bunların **21'i `Rig` arayüzünde açıkta**
(`root · bob · hips · torso · neck · head · shoulderL/R · armUpperL/R ·
armLowerL/R · handL/R · legUpperL/R · legLowerL/R · footL/R · ponytail`),
kalanlar kurulum içi adsız yardımcılar (`hipsSkin`, `torsoSkin`, `face`).
Açıktaki 21'i 5.1'in karşılaştırma kümesidir.

Buna animatörün bugün **mesh ölçeği** olarak yazdığı 7 hedef için yeni
kemik eklenir:

| Animatör hedefi | Bugün | Sonra |
|---|---|---|
| `torsoMesh.scale` (nefes) | mesh ölçeği | `torsoBreath` kemiği |
| `eyeL.scale`, `eyeR.scale` (göz kırpma) | mesh ölçeği | `eyeL`, `eyeR` kemikleri |
| `mouth.scale` | mesh ölçeği | `mouth` kemiği |
| `browL/R.position` + `.rotation` (mimik) | mesh dönüşümü | `browL`, `browR` kemikleri |

Kemik ölçeklemesi skinning matrisine dahildir; etki bugünküyle aynı.
Toplam ~30 kemik. Kemik sayısı **çizim çağrısını etkilemez**, yalnız kare
başına matris çarpımını artırır — 38 aktörde ~1140 matris, simülasyonun
0,4 ms'lik bütçesi yanında ihmal edilebilir.

**Çapalar kemik olmaz.** `carryAnchor`, `handAnchor`, `headTop` düz
`Object3D` olarak kemiklerin çocuğu kalır; taşınan ürünler bugün de ayrı
mesh (`ProductMesh` InstancedMesh) ve bu tasarımda öyle kalır.

### 3.4 · Öfke tintlemesi

Bugün `headMat` karaktere özel bir klon ve rengi değiştirilerek öfke
gösteriliyor (`Rig.headMat`, `Rig.headBaseColor`). Materyal artık global
ve paylaşımlı olduğu için tintleme **vertex color aralığına yazmaya**
döner: birleştirme sırasında kafa vertex aralığı `[başlangıç, bitiş)`
olarak saklanır, öfke değiştiğinde o aralık yeniden yazılır ve
`needsUpdate` işaretlenir. Her kare değil, yalnız durum değişiminde.

`Rig` arayüzündeki `headMat` / `headBaseColor` alanları yerine
`headVertexRange` + `setHeadTint(renk)` gelir.

### 3.5 · LOD'un işlevi değişir, kendisi kalır

`charLod` çizim çağrısı amacını kaybediyor (2 çağrı, LOD'lu veya değil).
Ama iki yeni işi var: **vertex sayısını** ve **doğum anındaki birleştirme
maliyetini** (3.6) düşürmek. Bu yüzden silinmiyor.

Bir hata da kendiliğinden kapanıyor: bugün LOD'da kaşlar
`visible = false` ile gizleniyor ama nesne duruyor, çünkü animatör her
kare onlara yazıyor ve kaldırılırsa null erişimi olur
(`CharacterRig.ts:626-636`). Yeni yapıda LOD o vertex'leri geometriye hiç
koymaz; kemik boş kalır, animatör yazmaya devam eder, hiçbir şey patlamaz.

### 3.6 · Doğum maliyeti — bilinen takas

Bugün geometriler `world/Materials` önbelleğinden paylaşımlı. Vertex
color'a geçince **her karakterin geometrisi kendine özel** olur: her
doğuşta bir birleştirme + GPU yüklemesi. Tahmin ~5k vertex için 1-3 ms;
16,7 ms bütçede kare düşürmez ama **ölçülecek** (5.1'de bant var).

Eşik aşılırsa karşılığı havuzlamadır — bu spec'te **yazılmıyor** (YAGNI).
Ölçüm gerektirdiğini gösterirse ayrı bir tur olur.

**Ölçüldü (Task 9, `tools/rig-probe.js` `__rigSpawnCost`):** `customer`
rolünde, ısınma turu ayrılmış 60 örnekte **p95 ≈ 22,5–24,0 ms, ortalama
≈ 7–8 ms** (üç bağımsız koşum) — bant `< 4 ms`'i **AŞIYOR**, buradaki
1-3 ms tahmininin de üstünde. `buildRigLegacy` aynı derlemede karşılaştırma
olarak ölçüldü: ortalama 1,32 ms, p95 1,9 ms — yeni yol ~6× ortalama,
~12× p95 daha pahalı. Sebep salt birleştirme değil: `paintGeometry` parça
başına geometri klonluyor (60 doğuşluk turda ısınmayla birlikte heap
+33,7 MB), V8'in bunun tetiklediği periyodik GC duraklamaları örneklerin
~%30'unu 8-26 ms'e sıçratıyor (üç ardışık koşumda tekrarlanan desen,
gürültü değil). LOD açıkken sıçrama sıklığı düşüyor (60'ta 4) ama bant
yine aşılıyor (p95 19,4 ms) — LOD birleştirme maliyetini gölge/çizim
çağrısı kadar düşürmüyor. **Havuzlama GEREKİYOR**, bu spec'in kapsamı
dışında kalmaya devam ediyor (YAGNI kararı korunuyor) — ayrı bir tur
olarak `docs/superpowers/plans/2026-08-17-skinned-karakter.md` Ölçüm
Kütüğü'nde işaretlendi (bkz. task-9-report.md, tam sayılar ve metodoloji).

VRAM: vertex başına pozisyon + normal + renk (36 B) + kemik indeksi ve
ağırlığı (24 B) = 60 B. Karakterin vertex sayısı ölçülecek (kaba tahmin
4-8k), yani karakter başına ~250-500 KB, 40 aktörde ~10-20 MB. Mobilde
sorun değil, ama gerçek sayı 5.2'de raporlanacak.

### 3.7 · Düşük seviyeli cihazlar — darboğaz nereye kayar

Çizim çağrısı baskın maliyet olmaktan çıkınca sıradaki sınır **dolgu
hızıdır**: ekran pikseli × fragment maliyeti. Sahnenin bugünkü fragment
yükü ölçüldü:

- **3 etkin ışık** — `HemisphereLight` + `DirectionalLight` (rim) +
  `DirectionalLight` (sun); `AmbientLight` yoğunluğu 0.
- **GL'de post-process yok** — `#grade` bir CSS katmanı ve telefonlarda
  medya sorgusuyla tamamen kapalı.
- **Gölge haritası donmuş** (`shadowMap.autoUpdate = false`), yalnız
  `invalidateShadows()` çağrılınca yenilenir. Yani gölgenin kare başına
  maliyeti sadece fragment'teki gölge okumasıdır — bir yeniden çizim
  değil. **Düşük kademede gölgeyi kapatmanın kazancı bu yüzden
  sanıldığından küçük, görsel bedeli büyük.**
- **Çözünürlük dokunulmaz** (`DPR_CAP` 2,0). v5.0'daki "pixelleşiyor"
  şikâyetinin kökü buydu; bu spec o kararı **teyit eder**, esnetmez. Tek
  istisna oyuncunun kendi elle açtığı "Düşük Kalite" anahtarıdır.

Zayıf GPU + yüksek yoğunluklu ekran birlikte geldiğinde geriye kalan tek
gerçek kol fragment maliyetidir. Karakterler için elimizde ücretsiz
olmayan ama **görsel olarak ölçülebilir** bir seçenek var: rig'in tüm
materyalleri varsayılan (`roughness 0,82`, `metalness 0`, env map yok)
olduğu için karakterin PBR shader'ı (`MeshStandardMaterial`) kazandığı
neredeyse tek şey speküler vurgudur. Bu spec 3.2'de zaten **tek global
karakter materyali** kuruyor, yani shader seçimi tek satırlık bir karar
hâline geliyor.

**Karar: bu değişiklik varsayılan olarak YAPILMAZ.** Ayrı ve son bir adım
olarak, 5.4'teki görsel kapıdan geçerse değerlendirilir. Gerekçe 2.1: hız
için görsel bedel ödemeyeceğiz. Fill-rate ölçümü bu kolu gerektirmiyorsa
hiç açılmaz.

## 4. Kapsam dışı

- **Gölge hattına dokunulmuyor.** Karakterler bugün gerçek gölge
  haritasına girmiyor (`Scene3D.ts:91`, rig meshlerinde `castShadow=false`;
  yere basma tek InstancedMesh temas gölgesiyle). Bu yüzden skinning
  maliyeti **yalnız renk geçişinde** ödenir, gölge geçişinde değil.
- **Isı merdiveninin EŞİKLERİ ve basamak sırası değişmiyor.** Merdiven
  emniyet ağı olarak aynen kalır (13 ms / 52 fps çıkış, histerezis,
  bekleme süreleri). Değişen şey 2.1'deki **kademe tabanlarıdır**;
  merdivenin kendisine dokunulmaz. Beklenti, tabanlar yükseldiğinde
  merdivenin 1. basamağın üstüne hiç çıkmaması — yani kırpma
  basamaklarının erişilmez hâle gelmesi.
- **Animasyonun kendisi değişmiyor.** Yürüyüş çevrimi, nefes, mimik
  eğrileri aynı; yalnız hedef nesnenin sınıfı değişiyor.
- **Statik sahne, dekor, UI, simülasyon, ekonomi** — hiçbiri bu spec'te
  değişmiyor.
- **Karakterler arası gruplama (`BatchedMesh`) yapılmıyor.** Karakter
  başına 2 çağrı hedefi tuttuğunda toplam <250'ye iniyor; daha ileri
  gitmek gereksiz karmaşıklık.

## 5. Doğrulama

### 5.1 · Sadakat: sayısal özdeşlik testi (asıl kapı)

Gözle değil. Aynı `AppearanceSpec`'ten hem eski hem yeni rig kurulur,
`CharacterAnimator` ikisine de **aynı girdiyle N kare** koşturulur, sonra
karşılaştırılır:

1. Adlandırılmış 21 eklemin **dünya matrisleri**
2. Her materyal grubundan örneklenmiş vertex'lerin **dünya konumları**
3. Vertex **renkleri** ↔ eski materyal renkleri
4. Grup başına **çizim çağrısı sayısı** (beklenen: 2)

Float toleransı içinde aynı olmalı. Katı skinning'in özdeşliği bunu
geçirmek zorunda; geçmiyorsa bir kemik bağlama hatası vardır ve test onu
bulur. Bu, projenin "animasyonu gözle değil sayıyla doğrula" kuralının
(`docs/CHANGELOG.md`, koşu çevrimi ölçümleri) bu işteki karşılığıdır.

### 5.2 · Termal ve çizim çağrısı

`?perf=1` zaten fps · çağrı · üçgen · kademe · ısı basıyor; ölçüm
altyapısı hazır. Ölçülecekler:

- **Karakter başına tam 2 çizim çağrısı** — asıl kapı, mutlak ve kesin
- Aynı senaryoda (temiz başlangıç + 45 dk bot ≈ 18 aktör) sahne çizim
  çağrısı **≥ %30 düşüş**; ÖNCE 1681, beklenen ~%48. Mutlak tavan yok
  (bkz. §2'deki ölçüm düzeltmesi)
- Doğum başına kare süresi sıçraması (3.6): **< 4 ms**
- Orta cihazda 30 dk oturum: ısı merdiveni **≤ 1**, `maxCustomers`
  kısması hiç devreye girmemiş — **bu bant yalnız gerçek cihazda
  ölçülebilir** (ısı merdiveni rAF'tan besleniyor; ajan tarayıcısında rAF
  donuk). `npm run android:apk` → telefonda `?perf=1` (oyuncu kararı,
  2026-08-17)

### 5.3 · Düşük seviyeli cihaz: kalite YÜKSELDİ mi

2.1'in kapısı. Kademe tabanları yükseltildikten sonra düşük kademede:

- `charLod` kapalı, `shadows` açık, `maxCustomers` 26 ile **ısı merdiveni
  ≤1** kalmalı. Kalmıyorsa taban geri değil, önce fill-rate ölçümüne
  gidilir (3.7) — kırpmaya dönmek son çare.
- Aynı kayıt düşük ve yüksek kademede açılıp **ekonomi farkı yok**
  doğrulanır: `maxCustomers` eşitlendiği için servis/dk aynı bantta
  olmalı. Bu, `Quality.ts:48`'deki "kademe ekonomiyi belirlemesin"
  kuralının nihayet tam karşılanması olur.
- Dolgu hızı ölçümü: kare süresi çözünürlük yarıya indirildiğinde
  (yalnız TEŞHİS amaçlı, üretim yolu değil) belirgin düşüyorsa darboğaz
  fill-rate'tir ve 3.7 kolu değerlendirmeye açılır; düşmüyorsa kol hiç
  açılmaz.

### 5.4 · Görsel kapı (3.7 kolu için)

3.7'deki shader değişimi ancak bu kapıdan geçerse yapılır:

- Karşılaştırma **375 × 812 portre** kadrajda yapılır — yatay kadraj
  yanıltıcıdır, ekranın yarısı zemin olur.
- Aynı sahne, aynı kamera, aynı karakter kadrosuyla önce/sonra kare
  alınır. Fark gözle **ayırt edilemez** olmalı.
- Ve fill-rate kazancı **ölçülebilir** olmalı. İkisinden biri tutmazsa
  kol kapatılır ve `MeshStandardMaterial` kalır.

Kare alma yöntemi: tarayıcı paneli kompozit etmediği için ekran görüntüsü
alınamaz; kare elle render edilip geliştirme uç noktasına POST edilir.

### 5.5 · Denge bozulmamış

`tools/balance-bot.js` ile temiz başlangıçtan 50 dk koşum; bölge sayısı,
t1/r1/r2 zamanları, kızgın müşteri ve hijyen bantları v5.2 ölçümleriyle
aynı kalmalı. Bu iş ekonomiye dokunmuyor, ama `maxCustomers` kısmasının
kalkması **gelir tavanını yükseltebilir** — bant kayarsa bilinçli olarak
kayması gerekir, sürprizle değil.

## 6. Riskler

| Risk | Karşılık |
|---|---|
| Kemik bağlama hatası (yanlış vertex → yanlış kemik) | 5.1 testi yakalar; hata sessiz kalamaz |
| Doğum sıçraması eşiği aşar | 5.2'de bant var; aşarsa havuzlama ayrı tur |
| Öfke tintlemesi aralık kayması | 5.1'in renk karşılaştırması öfke durumunda da koşar |
| `charLod` geometri varyantı ikinci bir kod yolu doğurur | LOD yalnız vertex **eler**, kemik kümesi ikisinde de aynı |
| Kademe tabanları yükselince zayıf cihazda fill-rate darboğaza girer | 5.3'ün teşhis ölçümü bunu ayırt eder; kol 3.7'de tanımlı ve 5.4 görsel kapısına bağlı — kırpmaya dönmek son çare |
| `maxCustomers` eşitlenince gelir tavanı yükselir | 5.5 denge koşumu bandı; kayma bilinçli olmalı |

## 7. Dosya haritası

| Dosya | Değişim |
|---|---|
| `src/chars/CharacterRig.ts` | `joint()` → kemik; birleştirme tek geometriye; vertex color; `mergeStaticSiblings` yerini alır |
| `src/chars/CharacterAnimator.ts` | yalnız 7 ölçek hedefi kemiğe taşınır; 19 eklem satırı değişmez |
| `src/chars/types.ts` | `Rig` arayüzü: `Group`→`Bone`, `headMat`/`headBaseColor` → `headVertexRange`/`setHeadTint` |
| `src/world/Materials.ts` | karakterin iki global materyali eklenir |
| `src/core/Quality.ts` | `TIERS` tabanları yükseltilir (2.1); merdiven eşikleri değişmez; başlıktaki ölçüm notu güncellenir |

`chars/` dışından rig içine erişim **yok** (doğrulandı:
`grep -rn "\.torsoMesh\|\.eyeL\|\.headMat" src/ --include=*.ts` `chars/`
dışında boş döner), bu yüzden yayılma alanı bu tabloyla kapalıdır.
