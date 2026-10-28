# v5.0 — SELF-SERVİS KAFE: oyuncu odağı, termal bütçe, ödüllü reklam

Tarih: 2026-08-15 · Durum: kullanıcı geri bildirimi doğrudan tasarım girdisi;
otonom oturumda karara bağlandı, uygulama bu spec'e göre yürür.

Kaynak: kullanıcının 15 Ağustos geri bildirimi (S23'te ısınma + pixelleşme,
"personel her şeyi yapıyor, biz sadece yer süpürüyoruz", "kasaya gelen
kendisi alsın kendisi götürsün", "her ürüne ayrı teslim noktası",
"ödüllü reklam belirmiyor", "kilitli yerlerde ne açılacağı yazsın",
"müşteri üstündeki kâğıt ne alaka", "profesyonel idle oyun olsun").

Değişmeyen ilkeler: zincirsiz üretim, asla cezalandırma, Türkçe metin,
kod-üretimli asset, portre kilidi + yaw 0, ölçmeden denge kabul edilmez.

---

## 1. ÇEKİRDEK DÖNGÜ — servis değil SELF-SERVİS

### Eski (v3–v4)
sipariş → mutfak üretir → TESLİM BANKOSU → **garson/oyuncu masaya taşır** →
müşteri yer → hesap masada ödenir.

Şikâyet: "kim ne istiyor, ne götürülecek anlaşılmıyor; personel alınca da
bize iş kalmıyor." Taşıma-eşleştirme bilişsel yükün tamamıydı ve otomasyon
onu yutunca oyuncuya süpürge kalıyordu.

### Yeni (v5)
1. Müşteri kapıdan girer, **kasaya** sıraya girer.
2. Sıra başında sipariş verir — sipariş **tek ürün türü × 1-3 adet**
   (`maxLines = 1`; çok kalemli sipariş v5'te YOK — okunaklılık kuralı).
   Sipariş yalnız **o an stokta/menüde olan** üründen seçilir.
3. **Parayı ANINDA öder**: kasanın üstünde nakit yığını büyür
   (`co.cash`/`cashValue` mevcut mekanik). Oyuncu (veya kasiyer) toplar.
4. Müşteri **kendi ürününün RAFINA** yürür (her ürünün ayrı teslim rafı),
   ürününü **kendisi alır** (mevcut `pickup` durumu; raf boşsa bekler,
   balonunda ürün ikonu).
5. Ürünüyle **kendi masasına oturur, yer, kalkar gider** (bulaşık bırakır).
   Boş masa yoksa paket alıp memnun çıkar (asla cezalandırma).
6. Oyuncu + personel işi: makinelerden rafları DOLU TUTMAK, kasayı
   işletmek, nakiti toplamak, bulaşık/temizlik, bölüm açmak.

Garson masaya asla taşımaz; oyuncu masaya asla taşımaz. "Kim ne istiyor"
sorusu ortadan kalkar: müşteri kendini eşleştirir.

### Ürünler — 9'dan 5'e (Köşe)

Kural: raf başına bir ürün; raf sayısı ekranda 5'i geçmez → SKU 5'e iner.
Fiyat merdiveni korunur, mevcut bölge kimlikleri ve fiyatları DEĞİŞMEZ:

| Bölge | Makine | Ürün | ₺ |
|---|---|---|---|
| a1 | Semaver | çay | 25 |
| a3 | Süt Barı ("Kahve Barı" adıyla) | latte | 82 |
| a4 | Tost Makinesi | tost | 210 |
| a7 | Waffle Büfesi | waffle | 520 |
| a8 | Frappe Blender | frappe | 1150 |

SİLİNEN: espresso, kruvasan, cheesecake, limonata (+ makineleri
k_espresso, k_firin, k_tatli, k_soguk). Sahil zaten 1 makine = 1 ürün
(smoothie/dondurma/milkshake) — aynı düzene otomatik uyar.

### Bar hattı yeniden dizilir (z −4,4 korunur)

Eski: kasa1 · banko1 · kasa2 · banko2. Yeni: **2 kasa + 5 ürün rafı** tek
hat; raflar açılış sırasına göre soldan sağa (çay rafı başlangıçta açık,
diğerleri bölgesiyle birlikte gelir). Raf `pickup` istasyonudur ama
`def.item` filtresi alır: yalnız kendi ürünü konabilir/alınır. Doldurma
arka yüzden (mevcut `sideOf < 0` kuralı), müşteri ön yüzden alır.
Raf üstü etiket: ürün glifi + adet ("☕ ×4") — uzaktan okunur.

Nav/yerleşim kuralları aynen: kapı ≥3,0 · koridor ≥1,6 · boğaz bandı
0,15–0,95 yasak · ped çevresi erişim boşluğu ölçülür (duvar/istasyon
taşındığında pedler sıkışıp ilerlemeyi sessizce kilitleyebilir) ·
`validateLayout` + `validateClearances` + `validateSightlines` her kilit
kombinasyonunda temiz olmalı.

### Para ve itibar

- Ödeme **sipariş anında** kasada: `finishOrder`'daki değer hesabı
  (çarpanlar dahil) `placeOrder`'a taşınır; `revenueAcc` orada işler.
  Müşteri sonradan küsse para İADE EDİLMEZ (basitlik + asla cezalandırma
  oyuncuya döner; kızgın oranı zaten itibardan düşer).
- Kasa nakit tavanı 30 → **40**; tavan dolunca sipariş alınmaz (mevcut
  kural) — rehber oku nakiti göstermeye devam eder; bu bilinçli bir
  "oyuncuyu kasaya çağırma" basıncıdır.
- `stats.served` artık **müşterinin raftan aldığı her birimde** artar
  (tek artış noktası raf alışverişi olur). Hedef zinciri, sonsuz hedef
  şablonu ve günlük görevler değişmeden çalışmaya devam eder.
- İtibar: yemeği bitiren müşteri +happyGain; rafta sabrı tükenen −angryLoss.

### Personel — roller ve YAVAŞLATMA

Oyuncu her seviyede personelden hızlı kalır ("jet yok, dengeli artış"):

| Rol | Yeni işi | Hız (L0→L10) | Not |
|---|---|---|---|
| waiter → **"Tezgâhtar"** | makine → kendi rafı ikmali | 4,6+0,30/sv → 7,6 | eski taşıma işi ölür; kimlik `waiter` kalır (kayıt/hedef uyumu) |
| cashier Kasiyer | kasada sipariş + nakit süpürme | sipariş 1,3×0,93^sv → ~0,63 sn | |
| barista | makineleri hızlandırır | çarpan 1,2+0,09/sv → 2,1× | eski 1,35→2,85 çok dikti |
| busser Komi | bulaşık + leke + iz | 4,8+0,35/sv → 8,3 | |
| **Oyuncu** | her şey + İSTASYON BAŞI BONUSU | 6,6+0,6/sv → 12,6 | değişmez |

Yeni mekanik — **"el ver" bonusu**: oyuncu bir makinenin 2,4 birim
yakınında duruyorsa o makinenin çevrimi ×0,5 süre (2× hız). Barista
çarpanıyla toplanmaz, büyüğü geçerlidir. Oyuncunun istasyon başında
durması her evrede anlamlı kalır — odak oyuncuda.

Müşteri akış regülatörü yeniden türetilir (eski formül garson sayısına
bağlıydı): `maxPending = ceil((1 + kasiyer×0,8 + açıkRaf×0,5) ×
stokFaktörü × oyuncuBoost × prestij)`, `queueCap = min(6, 2 + kasiyer×2)`.
Doğrulama bot ölçümüyle.

### Öğretici (v5 zinciri, adım başına tek mekanik)

kasaya git → SİPARİŞ AL → PARAYI TOPLA → ÇAY AL (semaver, dwell) →
RAFA KOY (çay rafı) → müşterinin kendi aldığını gör (toast) →
BULAŞIĞI TOPLA → MASA 2'yi aç (ped dwell) → özet.
Her adımda gerçek olay tetikleyicisi + takılma kaçışı (14 sn kuralı).
"MASAYA GÖTÜR" metni ve adımı tamamen silinir.

### Kayıt

`SAVE_VERSION` 7 → **8**, anahtar `fincan-sokagi:save:v8`. Şema anlamı
değişti (tek kalemli sipariş, silinen istasyonlar, rol semantiği);
temiz başlangıç — proje geleneği.

---

## 2. TERMAL BÜTÇE — "ısınmasın, ASLA pixelleşmesin"

Kök neden (ölçülen): adaptif kalite `low`'a düşünce `maxDpr 1` → DPR-3
panelde 4× çözünürlük kaybı; dönüş yolu fiilen yok (low→medium eşiği
6,5 ms'yi ~700 çizim çağrılı sahne hiç görmüyor). Ayrıca iki bug: (a)
`applyTier` aynı kademede erken dönünce `dprCap` 1,5'te kalıyor (high,
medium'dan DÜŞÜK çözünürlükte!); (b) eski ayar kaydı `quality` alanı
yoksa donanım tespitini atlıyor → S23 `high` kademesinde (MSAA + 2048
gölge + 41 mesh/karakter + 26 müşteri) kavruluyor.

### Kurallar

1. **Çözünürlük kutsaldır.** `maxDpr` kademe tablosundan çıkar; tüm
   kademelerde sabit **DPR tavanı 2,0** (masaüstü dahil). Adaptif sistem
   DPR'a DOKUNAMAZ. `#grade` katmanı mobilde tamamen kapalı.
2. **Ayar göçü:** ayar anahtarı v2; `quality` alanı yoksa `detectTier()`
   koşar (S23 → medium). `applyTier` erken-dönüş zinciri düzeltilir;
   kademe değişmese bile renderer ayarları bir kez uygulanır.
3. **Kare sınırlayıcı vsync-farkında:** birikimli zamanlayıcı, hedef
   60 fps (90 Hz'de 45'e düşme hatası biter). `document.hidden` →
   rAF iptal; görünürlükte yeniden başlar.
4. **Adaptif sistem kademe değil KISMA MERDİVENİ:** sürekli ısı puanı
   (CPU iş süresi EWMA + gerçek fps) şu sırayla kısar/geri açar:
   gölge 2048→1024 → charLod → maxCustomers −6 → gölge kapalı →
   **30 fps "serinleme" modu** (son çare; çözünürlük asla). Geri dönüş
   histerezisli ve kademeli. Ayarlar'a 4'lü seçici: Otomatik (varsayılan)
   · Yüksek · Orta · Düşük — mevcut `Yüksek/Orta/Düşük` etiketleri.
5. **Statik sahne bütçesi:** sokak cepheleri malzeme başına birleşir
   (~150 çağrı → ~8), sokak dekoru instanced (~70 → ~5); statik ağaçlarda
   `matrixAutoUpdate=false` (+tek `updateMatrixWorld`); istasyon
   `setOutput/setInput` kirli bayrakla (her kare 47 istasyon
   `computeBoundingSphere` biter); personel de müşteri gibi kadraj dışı
   kültlenir; `powerPreference` native'de `'default'`.
6. **Karakter mesh diyeti:** eklem başına statik detaylar birleşir
   (~25-41 → ~12 mesh/karakter). Animasyon sayısal doğrulamayla korunur
   (koşu çevrimi, kafa-gövde ofseti, ayak kayması %'si) + önce/sonra
   375×812 kare karşılaştırması. Bu madde paketin EN SON adımı; riskli
   çıkarsa tek başına geri alınabilir.
7. **Ölçüm aracı:** `?perf=1` ile dev perf yazısı (fps · çağrı · üçgen ·
   kademe · ısı seviyesi); `renderer.info` konsoldan da okunur.

Hedef bant (S23 sınıfı): kalıcı 60 fps, çizim çağrısı geç oyunda ≤ 350,
üçgen ≤ 60k, 20 dk oturumda kısma merdiveni en fazla "gölge 1024"
basamağında kalır.

---

## 3. ÖDÜLLÜ REKLAM — görünür, süreli, güvenilir

Kök neden adayları (ölçülen): (1) cihazdaki APK 10 Ağustos debug —
reklam kodu HİÇ YOK; (2) UMP rıza hatası `initAds`'i sessizce
öldürüyor → sağlayıcı hiç kayıt olmuyor; (3) beş yerleşim TEK reklam
nesnesini paylaşıyor — ilk gösterimden sonra hayalet teklifler; (4)
yükleme tek denemelik, retry yok.

### Sağlayıcı sağlamlaştırma (AdMobProvider)

- **Tek ödüllü slot:** `loaded` yerleşim kümesi değil tek bayrak;
  gösterimden sonra bayrak düşer, yeniden yüklenir.
- **Retry + backoff:** init ve yükleme 5→15→30→60 sn geri çekilmeli
  yeniden dener; `FailedToLoad` dinleyicisi bağlanır; asla "tek deneme
  kaybetti, oturum boyu ölü" olmaz.
- **Rıza izole:** UMP hatası reklamları KAPATMAZ (test kimlikleri rıza
  istemez); rıza bir dahaki açılışta yeniden denenir. Gerçek yayına
  geçerken App ID + UMP mesaj yapılandırması `docs/YAYIN.md`'ye işlenir.
- **Durum görünür:** Ayarlar'da tek satır: "Reklam: hazır / yükleniyor /
  hata (…)" — cihazda teşhis için.
- Google resmî TEST kimlikleri aynen kalır (kullanıcının isteği).

### Teklif çipi (kullanıcının tarifi birebir)

- İlk teklif öğretici bitiminden ~40 sn sonra; sonra **±20 sn titreşimli
  ~110 sn arayla** yeni teklif. Aynı yerleşim tekrar gelebilir.
- Çipte **görünür geri sayım halkası** (ömür 22 sn); süre bitince kaybolur.
- Belirirken küçük pop animasyonu + yumuşak ses + hafif titreşim.
- İZLE başarısızsa: kısa toast ("Reklam şu an hazır değil") + 30 sn
  sonra yeni teklif — sessiz kaybolma yok.
- 5 yerleşim ve "istek anı" koşulları korunur (happy_hour koşulu zaten
  her zaman doğru → çip güvenilir şekilde belirir).
- **DEV sahte sağlayıcı:** tarayıcı/dev derlemede 4 sn'lik "TEST REKLAMI"
  perdesi gösteren sahte sağlayıcı otomatik kayıt olur (yalnız
  `import.meta.env.DEV`) — döngü tarayıcıda test edilebilir; üretim web
  derlemesinde reklam kelimesi geçmez (mevcut garanti korunur).
- İş bitince **taze debug APK derlenir** — cihazdaki eski APK sorunu
  ancak yeni kurulumla kapanır.

---

## 4. OKUNAKLILIK — kilitli alan etiketleri, müşteri balonu

- **"Kâğıt" balonu silinir.** Fiş görselli `badgeMaterial('ticket')` ve
  giriş anındaki `showTicket()` çağrıları kalkar. Balon yalnız sipariş
  SONRASI ürün ikonu gösterir (rafa yürürken/beklerken), tamamlanınca
  onay imi. Kapıdan giren müşteri balonsuz — sipariş daha yokken balon
  bilgi taşımıyordu.
- **Ödeme pedi zenginleşir:** mevcut ada + fiyata ek olarak bölgenin
  ürün/istasyon glifleri ve şimdiye dek HİÇ kullanılmamış `ZoneDef.blurb`
  satırı ("Taş fırın ve tost makinesi. Menü beşe çıkar." tarzı — metinler
  yeni SKU listesine göre güncellenir). Tek ekranda tek ped kuralı
  korunur → etiket enflasyonu yok.
- **Oda tabelası:** kilitliyken adın altına içerik şeridi
  ("3 masa · özel salon" / "VIP teras · hesap ×2,4"); açılınca şerit
  kalkar, ad kalır (kilit rozetiyle aynı mantık).
- **Sıradaki bölgenin brandasına** küçük ürün-glif çipi (yalnız depth 0;
  "YAKINDA enflasyonu" dersi ihlal edilmez).
- Rehber oku boştayken parası yeten sıradaki pede düşük öncelikli
  "BÖLÜMÜ AÇ" işareti verir.

---

## 5. Kapsam dışı (v5'te yok)

IAP, interstitial açma, offline para, masada bahşiş, yeni oda/şube,
kamera değişikliği, dekorasyon ekleri. Sahil düzeni yalnız döngü
uyarlaması kadar değişir.

## 6. Doğrulama planı

1. `npm run build` + typecheck temiz.
2. `validateLayout` / `validateClearances` / `validateSightlines` her
   kilit kombinasyonunda 0 ciddi.
3. Balance-bot 2×50 dk (senkron): 17/17 bölge · r1 8-17 dk · r2 30-45 dk ·
   kızgın ≤ %15 · hijyen bitişte ≥ 60 · öğretici kilitlenmesiz · satın
   alma boşlukları ≤ 120 sn. Bot `served` kaynağı raf alışverişine bağlanır.
4. Perf: `renderer.info` çağrı/üçgen bütçesi (≤350 / ≤60k geç oyun);
   kısma merdiveni el testi (yapay yük ile in/çık histerezisi).
5. 375×812 kareler (`/__shot`): bar hattı + raflar, kilitli ped etiketi,
   oda tabelası şeridi, teklif çipi geri sayımı, balonsuz giriş.
6. Animasyon sayısal kontrol (mesh diyeti sonrası): ayak kayması ≈ %0,
   kafa-gövde hizası, çevrim/sn bandı.
7. Taze debug APK üretimi (`npm run android:apk`).
