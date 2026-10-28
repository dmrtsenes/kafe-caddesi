# KAFE CADDESİ — Tasarım Dokümanı

> Sürüm 3.0 · Idle Arcade Kafe Tycoon · Web (Three.js + TypeScript)
>
> v3.0, v2.0'ın oynanış iskeletini değil **tasarım felsefesini** değiştirdi:
> üretim zinciri kaldırıldı, mekân yarıya indirildi, ceza yerine ödül konuldu.
> Neyin neden değiştiği §12'de tek tek yazılıdır.

---

## 1. Kimlik

**Oyun adı:** **KAFE CADDESİ**
**Wordmark:** İki satır — üstte kalın `FİNCAN`, altta italik/açık `SOKAĞI`, yanında buharı tüten kulplu fincan amblemi.
**Slogan:** *"Sokağın en sıcak kafesi."*

### Pitch (tek paragraf)

Köşedeki küçük kahve barını sokağın buluşma noktası yapıyorsun. Müşteri
tezgâhın önünde sıraya giriyor, siparişini veriyor ve bir masaya oturuyor —
**seni bekliyor.** Sen semavere koşup çayı alıyor, masaya götürüyorsun. O
kalkınca arkasında bulaşık kalıyor, zemine kahve dökülüyor, tuvalette peçete
bitiyor; hepsini toplarken **her hareket sana para kazandırıyor.** Otuz saniye
sonra ilk ödeme pedine basıyorsun, branda uçuyor, üç masa daha açılıyor. İki
dakikada Garson Umut işe giriyor, sonra Kasiyer Aylin, Komi Emre, Barista
Nazlı. Yavaş yavaş kendi ellerinle kurduğun kafe kendi kendine dönmeye
başlıyor; sen sadece darboğazı açıyorsun. Hesabı ödemeden kaçan çıkıyor,
sosyal medya fenomeni geliyor, akşam yoğunluğunda gaza geliyorsun.

### Ton

Sıcak, mahalleli, hafif komik. **Hiç stres yok, hep küçük ödül var.** Türkçe
UI, samimi dil ("Masa 3 bekliyor!", "Umut işe koyuldu").

### Çekirdek fark

Diğer idle oyunlarda oyuncu **lojistiktir**: üret, rafa diz, müşteri kendi alır.
Kafe Caddesi'nde oyuncu **servistir**: sipariş masaya ulaşana kadar tamamlanmaz.
Bu yüzden ilk alınacak personel **garson**dur ve oyunda aynı anda iki ayrı
aciliyet döner: *masa bekliyor* ve *masa kirli*.

### Tasarım sözleşmesi (v3.0'ın üç maddesi)

1. **Zincir yok.** Her makine tek başına bir ürün verir. Öğrenilecek ürün
   ağacı, beslenecek ara istasyon, "bunu nereye götüreceğim" sorusu yok.
   Derinliğin tamamı servis ve temizlik tarafında.
2. **Mekân dardır.** Her şey tek ekranda görünür. Yanlamasına uzayan koridor
   yok; en uzun yürüyüş ~14 birim.
3. **Oyun zor değil, YOĞUN.** Oyuncu asla kaybetmez; daha hızlı koşarsa daha
   çok kazanır. Her eylem anında para verir — temizlik dâhil.

---

## 2. Sanat Yönü

**Stil:** Stilize **low-poly / chibi 3D**. Flat-ish shading, koyu outline yok,
yumuşak gölge, düşük poly ama *kasıtlı* silüetler. "Kağıt oyuncak" değil,
"ahşap oyuncak" hissi.

**Kamera:** Perspektif, dar FOV **34°**, **43°** yükseklik açısı, **32°** yaw,
**24 birim** mesafe — izometriğe yakın ama derinlikli. Oyuncuyu yumuşak takip
eder (kritik sönümlü lerp); dikey ekranda mesafe `1,3×` açılır.

> **Kamera mimariyi belirler.** Bakış +x+z yönünden geldiği için kameraya
> dönük **güney ve doğu duvarları 0,92 birim yüksekliğinde alçak duvardır**;
> kuzey ve batı duvarları tam boy, pencereli. Böylece mekânın içi hiçbir açıdan
> kapanmaz. `World.validateSightlines(camera)` bunu her yapı parçası için ölçer.

**Işık:**
- Ana yön ışığı: sıcak öğleden sonra güneşi (`#ffe6c0`), 2048 PCF-soft gölge.
- Hemisphere dolgu: gökten `#cbe8fb`, yerden `#e6d2ac`.
- Hafif fog, uzak kenarları eritir.
- ACES Filmic tonemap, `exposure 1.05`.

**Palet (Köşe Şubesi):**

| Rol | Renk | Hex |
|---|---|---|
| Dış zemin (sokak) | sıcak kum | `#d6c6aa` |
| Salon zemini | krem meşe | `#e7d9bf` |
| Mutfak zemini | koyu karo | `#d8c6a6` |
| Duvar | kırık beyaz | `#f8f2e6` |
| Ana marka | çam yeşili | `#376152` |
| Vurgu | terrakota | `#c9793f` |
| Para | altın | `#ffc84a` |
| Koyu / UI zemin | gece mavisi | `#1d2b34` |

**Palet (Sahil Şubesi):** aynı iskelet, soğutulmuş — zemin `#f0e2c4`, marka
turkuaz `#2f8fb8`, vurgu mercan `#ff8b6b`, bol beyaz + kum.

**Doku:** Hiçbir dosya yüklenmez; zemin tahtası, karo, teras deck'i, tabela
yazıları, menü panosu ve ödeme pedleri çalışma anında **canvas ile çizilir**
(`Environment.plankTexture / tileTexture / menuTexture / paintPad`).

---

## 3. Karakter Tasarımı

Ortak sanat dili: **chibi oran** (baş ≈ gövdenin 1/3'ü), yuvarlatılmış kutu
uzuvlar, kısa bacak, geniş omuz. Herkes aynı iskeletten türer ama **silüet
ayırt edici** — şapka, saç, sırt çantası, önlük, boy ve genişlik farkı.

Tüm karakterler kod ile üretilen **eklemli rig**'e (kalça → gövde → boyun →
kafa, üst/alt kol + el, üst/alt bacak + ayak) sahiptir ve prosedürel
animasyonla oynatılır. Sabit mesh kaydırma yok — bacaklar salınır, gövde
yaylanır, kollar sallanır.

**Animasyon durumları:** bekleme · yürüme · koşma · taşıma · çalışma ·
**oturma** · sevinme · öfkelenme · kaçma.

### 3.1 Oyuncu — **DENİZ**

> Köşedeki kahve barını dedesinden devralan, enerjik genç esnaf.

- **Silüet:** Kısa boylu, geniş omuzlu, sırtı dik. Başında geriye dönük
  **terrakota kasket** (siperliği arkada — koşarken okunur).
- **Kıyafet:** Krem tişört, üstünde **çam yeşili barista önlüğü** (göğüs
  cebinde kalem), kolları sıvalı. Koyu kot, beyaz kanvas ayakkabı.
- **Ayırt edici işaret:** Önlüğün göğsündeki küçük terrakota fincan logosu +
  kemerinde asılı anahtarlık.
- **Kişilik hissi:** Aceleci ama neşeli. Idle'da yerinde sallanır, ayağını
  tıklatır, ara sıra kasketini düzeltir.
- **Taşıma:** Bardak ve tabaklar **tepsi hizasında** istiflenir; 3'ten sonra
  hafifçe sallanır, 5'ten sonra dizler bükülür ve yürüyüş yavaşlar hissi verir.

### 3.2 Çalışanlar — dört rol

Hepsi **koyu lacivert taban** üniforma + role özel renk aksanı taşır. Böylece
"personel" oldukları bir bakışta anlaşılır ama roller ayrışır.

| Rol | İsim | Ücret | İşi | Ayırt edici |
|---|---|---|---|---|
| **Garson** | Umut | ₺400 | Hazır ürünü makineden/bankodan alır, **masaya götürür** | Elinde tepsi, hep koşar adım, terrakota yelek |
| **Kasiyer** | Aylin | ₺2.600 | Sipariş tezgâhına geçer, siparişi kendi alır | Nane yeşili yelek, vizör, at kuyruğu; kolları ritmik "tıklama" yapar |
| **Komi** | Emre | ₺9.000 | Masa toplar, zemin paspaslar, tuvalete peçete koyar | Açık mavi iş ceketi, **sarı lastik eldiven**, kova |
| **Barista** | Nazlı | ₺42.000 | Bir makinenin başında durur, hızlandırır, dolan çıkışı boşaltır | Krem aşçı ceketi, bordo bandana; istasyonda öne eğilip doğrulur |

> **Neden dört?** v2.0'da beşinci bir rol vardı: **Taşıyıcı Kerem**, makineden
> makineye ara ürün taşıyordu. Üretim zincirleri kalkınca taşıyacak bir şeyi
> kalmadı ve rol silindi. Geriye kafeyi gerçekten döndüren dört iş kaldı.

Ücretler bilerek düşük tutuldu: **garson daha ikinci dakikada alınabilmeli** ki
oyuncu "ekip kurma" hissini erken tatsın. Personel seviyesi yükseldikçe
**rozet** (omuzda 1→2→3 altın çizgi) ve hafif renk doygunluğu artar.

### 3.3 Müşteriler — dokuz arketip

Her biri farklı **boy, gövde genişliği, saç/şapka ve palet** taşır; ayrıca
rastgele renk varyasyonu ile aynı arketipten iki kişi de aynı görünmez.

| Arketip | Sabır | Ödeme | Oturma eğilimi | Masada oyalanma |
|---|---|---|---|---|
| **Öğrenci** | 36 sn | `0,90×` | yüksek | `1,40×` |
| **Ofis Çalışanı** | 21 sn | `1,40×` | düşük | `0,70×` |
| **Emekli Amca** | 53 sn | `0,92×` | yüksek | `1,50×` |
| **Arkadaş Grubu** | 42 sn | `1,15×` | yüksek | `1,25×` |
| **Laptopçu** | 48 sn | `1,10×` | çok yüksek | `1,85×` |
| **Turist** | 56 sn | `1,50×` | yüksek | `1,30×` |
| **Sporcu** | 25 sn | `1,05×` | düşük | `0,80×` |
| **Komşu Teyze** | 62 sn | `1,00×` | yüksek | `1,45×` |
| **Kurye** | 18 sn | `1,30×` | **hiç** (paket) | `0,60×` |

Artı iki olay karakteri: **Kaçak Müşteri** (hesabı ödemeden kaçar) ve **Sosyal
Medya Fenomeni** (`2,2×` öder, zamanında servis edilirse itibar patlar).

> **Sipariş küçük, sabır yüksek.** Hiçbir müşteri **ikiden fazla kalem** ve
> **ikiden fazla adet** istemez. Servis oyununda her ek ürün garsona ayrı bir
> mutfak turu demek; v2.0'daki üç kalemlik siparişler 20 saniyelik iş yaratıyor
> ve müşterilerin yarısı masada beklerken küsüyordu.

**Müşteri davranış zinciri (okunaklılık şartı):**

1. Kapıdan girer → **sipariş tezgâhının** sırasına girer (sırada ayak değiştirir)
2. Siparişini verir (kafasında **istek balonu**: ürün ikonu + adet)
3. Boş ve temiz masa arar, **oturur ve bekler** (sabır fitili kafasının üstünde
   yeşil → sarı → kırmızı)
4. Garson/oyuncu siparişi masaya bırakır → balon ✓ olur, yeme animasyonu başlar
5. Kalkar, hesabı öder → **sevinç zıplaması** + para fırlaması → çıkışa yürür
6. `%20` ihtimalle çıkışta tuvalete uğrar
7. Sabır biterse: **kızgın varyant** — kollar havaya, kırmızı bulut, hızla çıkar

---

## 4. Mekân — tek ekrana sığan açık kafe

Köşe Şubesi **30 × 25 birim** tek bir odadır. İç duvar, kemer, departman
tabelası, bölme yoktur.

```
 x: -14 ─────────────────────────────────────────── 16
z-13 ┌──────────── AÇIK MUTFAK ────────────┬── SERVİS ──┐
     │  semaver  espresso  fırın  tatlı    │  [WC A]    │
z -7 │  sütbar   tost      waffle soğuk    │  [WC B]    │
z -5 ═════════ personel koridoru (kapanmaz) ═══════════
z -1 ▬▬ BANKO ▬ TEZGÂH ▬▬▬ BANKO ▬ TEZGÂH ▬▬
z  1 ─────────── sipariş sırası (kapanmaz) ───────────
z  4 │    ▣     ▣     ▣        ▣     ▣     ▣          │
z  9 │    ▣     ▣     ▣        ▣     ▣  ▣ (teras)     │
z 11 └───────────────── GİRİŞ ────────────────────────┘
```

### Dört yerleşim kuralı

1. **Mekân dardır.** Her şey tek ekranda görünür, en uzun yürüyüş ~14 birim.
2. **Mutfak açıktır.** Makineler arka duvara iki sıra hâlinde dizilidir
   (`x = −11,6 / −8,0 / −4,4 / −0,8 / 2,8`, `z = −10,8` ve `−7,2`); bar hattı
   `z = −1,0`'da onlara sırtını döner. Aradaki `z −5,6 … −2,6` bandı **personel
   koridorudur ve hiçbir koşulda kapanmaz.**
3. **Masalar ızgara değil.** Salona dağınık yerleştirilir; teras `x > 11,4`'ten
   sonra başlar ve bahşişi `1,3×`'tir.
4. **Kilitli bölüm şantiye değil, brandalı eşyadır.** Makine, masa ve tuvalet
   tam yerinde durur ama **beyaz koruma brandası** altındadır ("YAKINDA"
   plakası). Ödeme bitince branda uçar.

> **Yalnızca sıradaki bölüm görünür.** `World.zoneVisibility()` üç değer
> döndürür: açık bölüm `open`, satın alınabilir *bir sonraki* bölüm `sheet`,
> daha ötesi `hidden`. İlk denemede 26 istasyonun hepsi brandalı görünüyordu ve
> mekân beyaz kutu deposuna dönmüştü.

### Yerleşim göz kararıyla değil, ölçerek kabul edilir

`World.validateLayout()` üç ayrı denetim yapar:

| Denetim | Ne kanıtlar |
|---|---|
| **erişilebilirlik** | Oyuncu başlangıcından taşma yaparak her servis noktası, sandalye, sıra yeri ve kapı gerçekten yürünerek erişilebilir mi |
| **koridor genişliği** | Personel ve ön koridorun en dar yeri |
| **boğaz genişliği** | Yan yana duran istasyon gövdeleri arasındaki gerçek boşluk (min **1,5** birim; bar hattı çiftleri muaf) |

Üçüncüsü sonradan eklendi ve gerçek bir hatayı yakaladı: SERVİS bölmesinde iki
tuvalet arasında **0,9 birimlik** bir boğaz kalıyordu. A* oradan bir yol
buluyordu — yani erişilebilirlik testi geçiyordu — ama karakter direksiyonu
boğazı geçemiyordu; soak testinde komi **240 saniye** o cepte kilitli kaldı ve
mekân çöptü. **Erişilebilirlik ≠ sürülebilirlik.**

---

## 5. Ana Döngü

```
SİPARİŞ AL  →  HAZIR ÜRÜNÜ KAP  →  MASAYA GÖTÜR  →  YEMEK  →  HESAP
    ▲                 ▲                  │                       │
    │            (makine kendi           ▼                       │
    │             üretir, zincir     BULAŞIK → KOVA   ₺           │
    │             yok)                   │            ▲           │
    │                                LEKE → PASPAS ───┘           │
    └─────────────────────────────────────────────────────────────┘
                  ₺ → YENİ BÖLÜM · PERSONEL · YÜKSELTME
```

**Aktif oynanış (0–3 dk):** Müşteri tezgâha gelir → oyuncu tezgâhın arkasında
durursa sipariş `0,4×` sürede alınır → semavere koşup çayı alır → masaya
bırakır → müşteri yer, kalkar, öder → oyuncu bulaşığı toplayıp kovaya atar
(**para verir**) → zemindeki lekeyi paspaslar (**para verir**).

**Otomasyon (3–20 dk):** Garson işe alınır (masaya taşımayı devralır) →
Kasiyer (tezgâh kendi çalışır) → Komi (masa/zemin/tuvalet) → Barista (makine
hızı + dolan çıkışı boşaltma).

**Idle (20 dk+):** Kafe kendi döner. Oyuncu darboğaz açar, yükseltir, yeni
bölüm kilidi kırar, olaylara müdahale eder.

**Etkileşim modeli:** *Yakınlık tabanlı* — butona basmak yok. İstasyonun,
masanın, kovanın veya bankonun yakınına gidince iş kendiliğinden başlar
(mobilde tek elle oynanır). Satın alma noktaları **ödeme pedi**dir: üstünde
durdukça para akar, dolunca branda uçar.

### Müşteri akışı stoka değil SERVİS KAPASİTESİNE bağlıdır

```ts
let servers = 1;                                   // oyuncunun kendisi
for (const s of this.staff) if (s.role === 'waiter') servers += 1.5;
const maxPending = Math.ceil(0.5 + servers * 0.7); // aynı anda kaç açık sipariş
if (this.pendingOrders >= maxPending) return;      // yenisi gelmesin
```

İlk sürümde akış **menüdeki hazır ürün sayısına** bağlıydı: makineler dolunca
doğuş aralığı `1,65` saniyeye iniyor, ama tek garson ~5 saniyede bir ürün
taşıyabiliyordu → müşterilerin **%56'sı** küsüyordu. Kafeye artık ancak
taşıyabileceği kadar sipariş girer. Buna ek olarak:

- **Sıra üst sınırı 6 kişi.** Aşılırsa yeni müşteri hiç gelmez. Kapı önünde
  birikip sırayla küsen kalabalık, oyuncunun elinden hiçbir şey gelmeyen bir
  ceza yığınıdır.
- **Boş masa yoksa müşteri gelmez** (`minFreeSeats: 1`).
- **Sıra yanlara katlanır.** `Station.queueSlot()` altıncı kişiden sonra
  hattı yana kaydırır; düz uzasa sıra binanın dışına taşardı.

---

## 6. Menü — dokuz ürün, dokuz makine, sıfır zincir

Her makine tek başına bir ürün verir. Girdi yok, tarif yok, ara ürün yok.

| Ürün | Makine | Süre | Kapasite | Fiyat | Masa oyalanma |
|---|---|---|---|---|---|
| Çay | Semaver | 1,8 sn | 6 | ₺25 | `0,75×` |
| Espresso | Espresso Makinesi | 2,4 sn | 6 | ₺48 | `0,70×` |
| Latte | Süt Barı | 3,0 sn | 6 | ₺82 | `1,00×` |
| Kruvasan | Taş Fırın | 3,4 sn | 6 | ₺130 | `0,90×` |
| Tost | Tost Makinesi | 4,2 sn | 5 | ₺210 | `1,20×` |
| Cheesecake | Tatlı Dolabı | 4,6 sn | 5 | ₺340 | `1,25×` |
| Waffle | Waffle Makinesi | 5,2 sn | 5 | ₺520 | `1,30×` |
| Limonata | Soğuk Bar | 5,4 sn | 6 | ₺780 | `0,95×` |
| Frappe | Frappe Blender | 6,0 sn | 5 | ₺1.150 | `1,05×` |

**Pahalı ürünün gizli maliyeti masa devridir.** Waffle ₺520 kazandırır ama
müşteri masada `1,30×` süre oturur; çay ₺25'tir ama masayı `0,75×` sürede
boşaltır. Dolayısıyla "en pahalıyı sat" her zaman doğru cevap değildir — **kaç
masan olduğuna bağlıdır.** Zincir darboğazının yerini alan gerilim budur.

**Sarf malzemesi (satılmaz):** Peçete (Peçete Kutusu, 2,4 sn) ve Tuvalet Kâğıdı
(Kâğıt Rafı, 2,8 sn) → tuvalete taşınır.
**Atık:** Bulaşık → kovaya.

**Sahil Şubesi menüsü:** Smoothie ₺2.400, Dondurma ₺3.600, Milkshake ₺5.200.

---

## 7. Ekonomi

- **Para birimi:** ₺ (nakit). Tek yumuşak para. Premium yok.
- **Yükseltme eğrisi:** `cost = base × growth^level`.
- **Gelir eğrisi:** ürün değeri kabaca `1,5–1,9×` katlanır; her yeni ürün bir
  öncekini gölgede bırakır ama hazırlığı yavaş ve masada daha çok oturulur.

### Bölüm bedelleri — ilk açılım 30 saniyede

| # | Bölüm | Bedel | Ne açılır |
|---|---|---|---|
| a1 | **KAFE** | açık | Semaver, teslim bankosu, sipariş tezgâhı, 2 masa, kova |
| a2 | **MASALAR** | ₺150 | Üç masa daha |
| a3 | **KAHVE** | ₺750 | Espresso makinesi + süt barı |
| a4 | **FIRIN** | ₺3.200 | Taş fırın + tost makinesi + 2 masa |
| a5 | **SALON** | ₺13.000 | İkinci tezgâh + ikinci banko (sıra ikiye bölünür) |
| a6 | **SERVİS** | ₺48.000 | 2 tuvalet, peçete, kâğıt — hijyen gerçek bir iş olur |
| a7 | **TATLI** | ₺190.000 | Cheesecake + waffle |
| a8 | **TERAS** | ₺950.000 | Soğuk bar, frappe, dış masalar (`1,3×` bahşiş) |

### Ölçülmüş ilk on dakika

Denge göz kararıyla değil, botla oynanan ölçümle kabul edildi. Tek oyuncu,
personelsiz başlangıç:

| Süre | Olay |
|---|---|
| 0:30 | **MASALAR** açıldı |
| 1:12 | **KAHVE** açıldı |
| 2:06 | ilk **garson** işe alındı |
| 3:18 | **FIRIN** açıldı |
| 5:00 | **SALON** açıldı |
| 8:02 | **komi** işe alındı |

Onuncu dakikanın sonunda: **₺32.347 · itibar 100 · hijyen 100 · 215 sipariş ·
437 servis · %15 kızgın.** Hedef **30–60 saniyede bir yeni şey**; ölçüm bunu
tutuyor.

### İki ölçer — ikisi de ceza değil bonus

| | Ne ölçer | Nasıl değişir | Etkisi |
|---|---|---|---|
| ⭐ **İtibar** | Hizmet kalitesi | Servis edilen ürün `+0,6`, kızgın müşteri `−1,2` | Hesap çarpanı `0,90×`–`1,45×` |
| 🧹 **Hijyen** | Mekân temizliği | Bulaşık, leke, kirli tuvalet, biten sarf düşürür | Bahşiş çarpanı `0,85×`–`1,25×` |

İtibarın **tabanı 20**'dir; dibi görmez. Kızgın müşteri cezası **1,2** puandır.
Kaçırılan müşteri zaten kaçırılmış gelirdir; üstüne bir de aşağı doğru spiral
gerekmez.

### Yükseltme kategorileri

**Oyuncu:** Rahat Ayakkabı (hız) · Servis Tepsisi (taşıma kapasitesi) · Usta
Eller (alma/bırakma hızı) · Güler Yüz (bahşiş) · Kasa Deposu (offline tavanı).
**İstasyon:** her makinenin `Hız` ve `Depo` yükseltmesi; masaların `Kapasite`si.
**Personel:** her rolde `Sayı` ve `Seviye`.

---

## 8. Kir & Temizlik — buradan PARA gelir

Bu, v3.0'ın en önemli çevirisi. **Temizlik bir zorunluluk değil, oyunun ikinci
gelir kalemidir.** Her temizlik eylemi anında bozuk para verir ve ödül menünün
**ortalama fiyatına oranla** hesaplanır — geç oyunda "bozuk para toplamak"
hissi vermez, ölçeklenir.

| Kir kaynağı | Nereden çıkar | Temizleyince | Hijyene baskısı |
|---|---|---|---|
| **Bulaşık** | Kalkan her misafir 1 tane bırakır (masa başına en fazla 5) | ortalama fiyatın `0,18`'i | `−0,14`/sn |
| **Zemin lekesi** | Misafir kalkarken `%30`, servis sırasında `%4` | `0,30`'u | `−0,24`/sn |
| **Kirli tuvalet** | Her kullanımda `+0,18` | `0,55`'i | `−0,30`/sn |
| **Biten sarf** | Her kullanım `0,5` peçete/kâğıt yer | `0,40`'ı | `−0,45`/sn (orantılı) |

**Kirli masaya kimse oturmaz** — bulaşık yalnızca hijyeni değil, masa devrini
de kilitler. Sarf bitmişken tuvalete giren müşteri ayrıca `1,4` itibar yakar.

### Hijyen formülü: sürekli toparlanma kirle YARIŞIR

```ts
// doğru
this.hygiene = clamp(this.hygiene + (h.recover - drop) * dt, 0, 100);
```

v2.0'da bu satır `hygiene += (drop > 0 ? -drop : recover) * dt` idi: **tek bir
leke bile toparlanmayı tamamen kapatıyordu.** Oyuncu ne yaparsa yapsın ölçer
dört dakikada sıfırlanıyordu. Artık az kir toparlanmayı yavaşlatır, çok kir
ölçeri aşağı çeker — arada gerçek bir denge noktası vardır.

Aynı şekilde **sarf cezası da orantılıdır**: eskiden `hasEmptySupply` eşiği
`< 1` idi, yani 6 kapasiteli kutuda kalan 0,9 peçete tam cezayı tetikliyordu.
Artık `supplyShortfall` oranı kadar baskı uygular.

---

## 9. Olaylar (Kaos Sistemi)

| Olay | Aralık | Etki | Oyuncu tepkisi |
|---|---|---|---|
| **Yoğun Saat** | 150–230 sn | 40 sn boyunca akış `×2,4`, hesap `×1,5` | Servisi yetiştirmek |
| **Kaçak Müşteri** | 220–340 sn | Hesabı ödemeden kaçmaya çalışır | Üstüne koşup yakalamak |
| **Tedarik Sürprizi** | 180–280 sn | Kapıya 6 kasa düşer, 26 sn içinde toplanmalı | Koşup toplamak |
| **Makine Arızası** | 280–420 sn (a4 sonrası) | Rastgele makine durur, üstünde 🔧 belirir | Yanına gidip tamir etmek |
| **Sosyal Medya Fenomeni** | 260–400 sn (a2 sonrası) | 55 sn; `4×` bahşiş | Zamanında servis: **+10 itibar**; geç kalırsan `−4` |

İlk 120 saniyede hiç olay çıkmaz (`warmup`) — oyuncu önce döngüyü öğrenir.

---

## 10. Idle / Offline

- Otomasyon oranı = personel üretkenliği (oyuncu hariç).
- Offline kazanç = otomatik gelir × süre × `0,60`; Kasa Deposu yükseltmesiyle
  tavan **2sa → 4sa → 8sa → 12sa**.
- Dönüşte animasyonlu **"Sen yokken…"** özeti: geçen süre, servis edilen ürün,
  kazanç, olaylar. Tek tuşla topla. (En az 45 saniye yoklukta gösterilir.)

---

## 11. UI / UX

- **HUD (üst):** wordmark + nakit + itibar yıldızı + hijyen ölçeri + aktif
  hedef şeridi + bölge %.
- **HUD (alt-sağ):** Yükseltme, Personel, Şube, Ayarlar yuvarlak butonları
  (mobil başparmak bölgesi).
- **HUD (alt-sol):** mobilde sanal joystick (dokunulan yerde belirir),
  masaüstünde gizli.
- **Sipariş fişleri:** bekleyen masalar ekranın kenarında fiş olarak listelenir;
  fiş rengi müşterinin sabır fitiliyle senkron.
- **Panel:** alt sheet (mobil) / merkez kart (masaüstü), yay animasyonlu açılış.
- **Tutorial:** atlanabilir, dünyada **oklu işaretçi** + kısa Türkçe balon.
- **Erişilebilirlik:** min 44 px dokunma alanı, safe-area padding, düşük hareket
  modu, ses kapatma.

**Katman sözleşmesi:** `ui/` katmanı `three`'yi de simülasyonu da hiç import
etmez. Aradaki tek sözleşme `src/ui/api.ts`.

---

## 12. v2.0 → v3.0: ne değişti, neden

v2.0 teknik olarak çalışıyordu ama **yanlış oyundu**. Geri bildirim netti:
*"önceki oyunla birebir aynısı, sadece kafe hâline çevrilmiş"*, *"yanlamasına
uzayıp gidiyor"*, *"ilk başları çok zor, kilitli yerleri açmak sürüyor, bir
denge yok"*.

| | v2.0 | v3.0 |
|---|---|---|
| Üretim | Ham → ara → ürün, çok kademeli zincir | **Zincir yok**, makine başına tek ürün |
| Mekân | 47 × 33, altı duvarlı departman bayı | **30 × 25**, tek açık oda |
| Bar | 11 istasyon | 4 istasyon |
| En uzun yürüyüş | ~30 birim | **~14 birim** |
| Kamera mesafesi | 30 (yine de yarısını kaçırıyordu) | **24**, tamamı kadrajda |
| İlk açılım | dakikalar | **₺150 · ~30 saniye** |
| Personel | 5 rol (biri ara ürün taşıyıcısı) | **4 rol**, ilki ₺400 garson |
| Temizlik | ceza | **gelir kalemi** |
| Hijyen aralığı | `0,60×` – `1,15×` | `0,85×` – `1,25×` |
| Kızgın cezası | `3,0` itibar | `1,2` itibar |
| Müşteri akışı | stok miktarına bağlı | **servis kapasitesine bağlı** |
| Kilitli alan | şantiye panosu + iskele | brandalı eşya, yalnızca sıradaki bölüm |

### Soak testinin bulduğu üç ölümcül hata

Bunların hiçbiri göze bakarak bulunamazdı; `world.update()` binlerce kez
senkron çağrılarak bulundu.

1. **Hayalet sıra kayıtları.** Bir tezgâhın sırasında 33 kayıt birikmişti,
   başı 17. sıradaydı ve o kişinin durma noktası `z = 23`'e — yani binanın
   dışına — düşüyordu. Erişilemediği için sıra hiç ilerlemedi, kafe kilitlendi,
   `%100` kızgın. Üç yerde birden düzeltildi: müşteri silinirken sıradan da
   çıkarılıyor, sıra her karede ölü/geçersiz kayıtlardan temizleniyor ve altıncı
   kişiden sonra hat yana katlanıyor.
2. **Stoka bağlı akış.** Yukarıda §5'te anlatıldı: `%56` kızgın.
3. **Tepsi toplu yükleme deneyi.** "Garson tüm salonun ihtiyacını bir kerede
   yüklesin" fikri denendi ve **felaket oldu**: `%100` kızgın, 240 saniyede
   yalnızca 2 ürün servis edildi. Garsonlar tepsi dolsun diye makinenin başında
   bekliyordu. Geri alındı; koda not düşüldü: *"Servis oyununda BEKLEMEK en
   pahalı eylemdir; az yükle, çabuk git."* Aynı sebeple garson yolunda **masa
   rezervasyonu** da kaldırıldı.

### Bilinen kalan sorun

Tüm bölümler açık ve dört garsonla oynanan uzun soak testinde kızgın oranı
`~%40`'a çıkabiliyor — teras masaları bara uzak kalıyor. Tek oyunculu ve tam
kadrolu senaryolarda sorun görülmüyor; orta kadro senaryosu ayrıca
dengelenecek.

### Kayıt

Ürün, istasyon ve bölüm kimlikleri tümden değiştiği için **v2.0 ve öncesi
kayıtlar okunmaz.** `SAVE_VERSION = 5`, anahtar `fincan-sokagi:save:v5`; eski
anahtarlar açılışta silinir ve oyun temiz başlar.

---

## 13. Mobil Geleceği (Faz 2 notları)

- Tüm giriş `InputManager` soyutlaması arkasında — Capacitor'da native joystick
  eklemek tek dosya.
- Kayıt `SaveManager` arkasında (`localStorage` adaptörü) — Preferences
  plugin'e geçiş tek adaptör.
- Canvas DPR sınırlı (max 2), 3D sahne draw-call bütçesi < 120 → orta seviye
  telefonda 30–60 fps.
- Android projesi kurulu, çalışan APK derleniyor (`npm run android:apk`).
  Java 21 gerekir; Gradle kendi araç zincirini indirir.
- Ses `AudioManager` arkasında sentezle üretiliyor → lisans yükü yok, paket
  boyutu ~0.

---

## 14. Özgünlük Beyanı

Tüm isimler, karakterler, ürünler, harita düzeni, ekonomi sayıları, UI ve kod
bu proje için sıfırdan yazılmıştır. Hiçbir ticari oyundan varlık, metin, marka
veya seviye düzeni alınmamıştır. Fontlar sistem font yığınıdır; tüm ses
efektleri WebAudio ile çalışma anında sentezlenir.
