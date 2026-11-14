# Kafe Caddesi / Cafe Avenue — Oyun İçi Ekonomi, IAP Fiyatlandırma Psikolojisi ve Oyuncu Bağlılığı (Retention) Master Planı

> **Uygulanan Beceriler:** `@pricing` (v2.1.4) + `@marketing-psychology` (v2.0.0) + `@churn-prevention` (v2.0.3)
> **İncelenen Kaynak Kod ve Denge Dosyaları:** `src/data/economy.ts`, `src/data/balance.ts`, `src/data/upgrades.ts`, `src/data/staff.ts`, `src/data/goals.ts`, `src/data/prestige.ts`, `src/data/cosmetics.ts`, `src/sim/Daily.ts`, `src/sim/Festival.ts`, `src/sim/Offline.ts`, `src/core/Ads.ts`, `docs/EKONOMI-TABLOSU-2026-09-06.md`

---

## 1. Mevcut Oyun İçi Ekonomi ve Reklam Mimarisi Teşhisi

Kaynak kod (`src/data/` ve `src/core/Ads.ts`) üzerinden yapılan analizde oyunun mevcut ekonomik temeli şu somut parametrelere dayanmaktadır:

1. **Tek Yumuşak Para Birimi (₺ — Nakit) ve Ölçülmüş İlerleme Hızı:**
   - **Köşe Şubesi Bölge Maliyetleri (`economy.ts`):** `a1 (Kafe): ₺0` → `t1 (Masa 2): ₺300` (~30 sn) → `a3 (Kahve): ₺1.100` → `t2 (Masa 3): ₺1.900` → `a4 (Tost): ₺3.400` → `a5 (Salon Hattı): ₺5.000` → `a6 (Lavabo/Servis): ₺9.000` → `r1 (Salon Odası): ₺12.500` → `a7 (Vafıl): ₺14.000` → `a8 (Buzlu Kahve): ₺26.000` → `r2 (VIP Salon): ₺48.000`.
   - **Sahil Şubesi (`BRANCH_COSTS.sahil: ₺145.000`):** Bölgeler `p2 (Dondurma): ₺115.000` → `p3 (Teras): ₺210.000` → `p4 (Sahil Hattı): ₺310.000` → `p5 (İskele VIP Loca): ₺460.000` (Personel çarpanı `2,8x`).
   - **Prestij ("Sokağı Devret" — `prestige.ts`):** `PRESTIGE_MIN_EARNED = ₺6.000.000` ömür boyu kazançta açılır; ilk devirde 6 **Fincan Puanı** (`+%60` kalıcı kazanç) verir.
2. **Mevcut Reklam Katmanı (`src/core/Ads.ts`):**
   - **12 Ödüllü Reklam (Rewarded Video — RV) Yerleşimi:** `happy_hour` (5 dk `×2` kazanç), `zone_finish` (en az `%35` ödenmiş pedin kalanını kapatma), `cash_boost` (`%60–%90` ödenmiş pedde 300 sn'lik gelir desteği, taban `₺1.200`), `robot_vacuum` (5 dk otomatik süpürge robotu), `stock_refill` (tüm makine depolarını doldurma), `daily_double` (günlük ödül `×2`), `usta_mode` (5 dk `×1,25` hız + tüm makinelerde el verme), `rush_hour` (150 sn `×1,6` müşteri akışı), `repair_shield` (5 dk arıza bağışıklığı), `tip_rain` (VIP açıkken 5 dk `×3` bahşiş), `investor`, `comeback_sale`, `free_upgrade` (60 sn bekleme süreli).
   - **Akıllı Geçiş Reklamı (Smart Interstitial) Disiplini:** İlk 60 sn (`INTERSTITIAL_WARMUP`), ilk 8 hedef (`INTERSTITIAL_GOAL_WARMUP = 8`), iki reklam arası en az 90 sn (`INTERSTITIAL_MIN_GAP`), ödüllü reklam sonrası 60 sn koruma (`REWARDED_TO_INTERSTITIAL_GAP`) ve oturum başına maksimum 4 gösterim (`INTERSTITIAL_SESSION_CAP = 4`). Ayrıca `setInterstitialEnabled(false)` anahtarı kodda **"Reklamları Kaldır" (No-Ads)** satın alımı için hazır bırakılmıştır.

---

## 2. IAP (Uygulama İçi Satın Alma) Paket Mimarisi ve Fiyatlandırma Psikolojisi

> **Tasarım Kuralı (`@pricing` & `balance.ts`):** Kafe Caddesi'nin *"Asla Cezalandırma"* ilkesi gereği hiçbir IAP paketi ücretsiz oyuncunun erişemeyeceği bir odayı kilitlemez (No Paywall). Satılan değer metriği (Value Metric): **Zaman Tasarrufu (Reklam İzlemeden Ödül Alma), Sürtünmesiz Akış (No-Ads) ve Prestijli Görsel Özelleştirme (Kozmetik + Hız)**dir.

### 2.1 Ana Paketler: Good-Better-Best (İyi-Daha İyi-En İyi) ve Fiyat Çapalama

| Paket Kodu & Adı | Katman Rolü (`@pricing`) | USD Fiyatı | TR Yerel Fiyatı | Paket İçeriği (Somut Oyun İçi Karşılık) | Uygulanan Psikolojik Model (`@marketing-psychology`) |
|---|---|---:|---:|---|---|
| **1. İlk Vardiya Başlangıç Paketi (Starter Pack)**<br>`com.fincansokagi.starter` | **Foot-in-the-Door (İlk Adım / Düşük Sürtünmeli Dönüşüm)** | **$1.99**<br>*(Üstü çizili çapa: $6.99 — %70 İndirim)* | **₺69,99**<br>*(Çapa: ₺249,99)* | • **72 Saat Geçiş Reklamı Kaldırma** (Deneme)<br>• **150 Elmas (Altın Çekirdek)**<br>• **₺5.000 Nakit Sermaye** (*Kahve + Tost bölümlerini anında açar*)<br>• **Özel Kozmetik:** *Bakır Ekip Üniforması* (`cost: 9000` değerinde, anında açık)<br>• **3× RV Bilet (Reklamsız Ödül Kuponu)** | **Foot-in-the-Door & Activation Energy:** İlk satın alma bariyerini en düşük fiyatta kırar. **Endowment Effect (Sahiplik Etkisi):** 72 saatlik reklamsız akışı tadan oyuncu, süre bitiminde kalıcı *No-Ads* paketine `%35+` oranında geçiş yapar. **Scarcity:** Yalnızca ilk 48 saat (D1–D2) görünür. |
| **2. Sade No-Ads (Yalnızca Geçiş Reklamlarını Kaldır)**<br>`com.fincansokagi.noads_basic` | **Good Tier (Giriş / Tuzak Katmanı — Decoy)** | **$4.99** | **₺179,99** | • **Kalıcı Olarak Zorunlu Geçiş Reklamlarını Kaldırır** (`setInterstitialEnabled(false)`)<br>• **50 Elmas** | **Decoy Effect (Tuzak Etkisi):** Bu paket yalnız başına makul görünür ancak hemen yanındaki **$6.99 Süper Kafe Paketi (No-Ads Deluxe)** ile kıyaslandığında sadece $2 farkla dev bir bonus farkı yaratarak oyuncuyu orta pakete yönlendirir. |
| **3. No-Ads Deluxe: Esnaf Paketi (ÖNERİLEN)**<br>`com.fincansokagi.noads_deluxe` | **Better Tier (Recommended / Hedef Çapa)** | **$6.99**<br>*(En Popüler / En İyi Değer etiketi)* | **₺249,99** | • **Kalıcı Olarak Geçiş Reklamlarını Kaldırır**<br>• **Her Gün 2× Ücretsiz RV Bileti** (*reklam izlemeden `happy_hour` veya `robot_vacuum` açar*)<br>• **300 Elmas**<br>• **Kalıcı Süpürge Fırça Hızı +%15**<br>• **Özel Kozmetik:** *Gece & Pirinç Masa Tablası* (`cost: 70000` değerinde) | **Price Relativity & Default Effect:** Mağaza ekranında önceden seçili (vurgulu) durur. $4.99'luk sade pakete göre 6 kat fazla elmas + günlük reklamsız bilet + en pahalı masa kozmetiğini vererek "tartışmasız en mantıklı seçim" algısı yaratır. |
| **4. Kafe Caddesi VIP Kulübü (Aylık Pass)**<br>`com.fincansokagi.vip_monthly` | **Best Tier (Yüksek Çapa & Tekrarlayan Gelir / MRR)** | **$9.99 / ay**<br>*(Yıllık: $79.99 — %33 İndirim)* | **₺349,99 / ay** | • **Tüm Geçiş Reklamları Kapalı**<br>• **Sınırsız Reklamsız Ödül (Zero-Ad RV):** Tüm ödüllü reklam butonları (`zone_finish`, `robot_vacuum`, `happy_hour`, `daily_double`) video izletmeden **tek dokunuşla anında** çalışır!<br>• **Günlük +50 Elmas** (Ayda 1.500 Elmas)<br>• **Gece Vardiyası Kapasitesi 2sa → 8sa** (`capMult = 4`)<br>• **Özel Kozmetik:** *Antrasit & Altın Üniforma* | **Anchoring (Yüksek Çapa) & Mental Accounting:** $9.99 fiyat noktası, $6.99'luk No-Ads Deluxe paketini ucuz gösterir. Aylık paketin açıklaması *"Günde sadece ₺11 — bir bardak çaydan ucuz"* (**Mental Accounting**) çerçevelemesiyle sunulur. |

---

### 2.2 Elmas (Altın Kahve Çekirdeği) Paketleri ve Fiyat Çapalama Matrisi

Oyun içinde acil darboğaz anlarında (`zone_finish` son adım tamamlama, anında `Robot Süpürge` çağırma, `Fincan Puanı` takviyesi veya kozmetik açma) harcanacak ikincil sert para birimi (**Elmas / Altın Çekirdek**) için **6 kademeli** mağaza dizilimi:

> **Psikolojik Kural (`@pricing` & `@marketing-psychology`):**
> - Mağaza ekranında paketler **pahalıdan ucuza (Sağdan Sola veya Üstten Alta $49.99 → $0.99)** sıralanır (**Anchoring Effect**: İlk görülen $49.99 rakamı, $4.99 ve $9.99 paketlerini psikolojik olarak küçük gösterir).
> - **$100 altındaki tüm indirim ve bonuslar yüzde (`+%40 Bonus`) olarak gösterilir** (**Rule of 100**: $9.99 pakette `+%35 Bonus` yazmak, `+$2.50 ekstra` yazmaktan daha büyük algılanır).
> - Değer odaklı alt paketlerde `.99` (**Charm Pricing / Left-Digit Effect**), prestij algılı VIP/Sezonluk geçişlerde net/yuvarlak değer vurgusu kullanılır.

| Sıra (Görünüm: Üstten Alta) | Paket Adı | Fiyat (USD / TRY) | Taban Elmas | Bonus Elmas | Toplam Elmas | Birim Maliyet ($ / 100 Elmas) | Psikolojik Rolü |
|---:|---|---|---|---|---:|---:|---|
| **1 (Üst Çapa)** | **Zincir Patronu Kasası** | **$49.99 / ₺1.799,99** | 5.000 | +2.500 (**+%50 Bonus**) | **7.500** | $0.66 | **Fiyat Çapası (Price Anchor):** Oyuncuların %1–2'si (Whales) alır; asıl görevi altındaki $9.99 ve $19.99 paketleri makul göstermektir. |
| **2** | **Sahil Yatırımcısı Sandığı** | **$19.99 / ₺699,99** | 2.000 | +700 (**+%35 Bonus**) | **2.700** | $0.74 | **Yüksek Değer Kademesi:** Sahil Şubesi (`₺145.000`) açılışında hızlı sermaye ve tam kozmetik seti arayanlar için. |
| **3 (HEDEF)** | **Usta Barista Paketi** ⭐ *EN POPÜLER* | **$9.99 / ₺349,99** | 1.000 | +300 (**+%30 Bonus**) | **1.300** | $0.76 | **Orta Merkez (Center-Stage / Target):** Yanındaki $7.99 tuzak pakete göre sadece $2 farkla +450 ekstra elmas verir. |
| **4 (TUZAK)** | **Salon Şefi Paketi** *(Decoy)* | **$7.99 / ₺279,99** | 800 | +50 (**+%6 Bonus**) | **850** | $0.94 | **Bilinçli Tuzak (Decoy Effect):** Birim fiyatı kasıtlı olarak verimsizdir ($0.94/100 elmas). Oyuncuyu bir üstteki **$9.99 (1.300 Elmas)** paketine iter. |
| **5** | **Tezgâh Destek Paketi** | **$3.99 / ₺139,99** | 400 | +60 (**+%15 Bonus**) | **460** | $0.86 | **Erken-Orta Oyun Dürtüsel Alım:** İlk VIP salon veya 2. Kasiyer eksiğini kapatmak için. |
| **6 (Giriş)** | **Bahşişavanozu (Deneme)** | **$0.99 / ₺34,99** | 100 | 0 | **100** | $0.99 | **Mikro-Dönüşüm:** Tek bir eksik ödül veya kozmetik tamamlama için. |

---

## 3. Kayıptan Kaçınma (Loss Aversion) ve Davranışsal Tetikleme Noktaları

Kahneman & Tversky'nin **Beklenti Teorisi (Prospect Theory / Loss Aversion)** uyarınca bir kaybın acısı, eşdeğer bir kazancın sevincinden **~2 kat daha güçlüdür**. Oyunun mevcut mekaniklerine ("asla cezalandırma" ilkesini bozmadan, yani oyuncunun mevcut parasını silmeden, sadece **birikmiş fırsatın kaçmasını** çerçeveleyerek) yerleştirilecek 5 somut tetikleyici:

1. **Ödeme Pedi "Yarım Kalan Yatırım" Tetikleyicisi (Zeigarnik Effect + Goal-Gradient + Loss Aversion):**
   - **Kod Dayanağı:** `Ads.ts` içindeki `ZONE_FINISH_MIN_PAID = 0.35` ve `CASH_BOOST_MIN_PAID = 0.60`.
   - **Psikolojik Uygulama:** Oyuncu örneğin `VAFIL BÖLÜMÜ (₺14.000)` pedinin `%78`'ini (`₺10.920`) ödemiş ve kasası sıfırlanmışsa, pedin üstündeki ilerleme çubuğu altın sarısı yanıp söner: *"Vafıl Bölümünün %78'i hazır! Şimdi tamamlamazsan sıradaki müşteriler vafıl siparişi veremeyecek."* (`Goal-Gradient`: Hedefe yaklaştıkça tamamlama dürtüsü zirveye çıkar).
2. **Dönüş Ekranı ("Sen Yokken...") Çarpan Kaybı Çerçevelemesi (`Offline.ts`):**
   - **Kod Dayanağı:** `computeOfflineEarnings` (2 saatlik gece vardiyası kazancı) + `rewardedLongOfflineMultiplier: 3`.
   - **Psikolojik Uygulama:** Oyuncu 1 saatten uzun süre sonra döndüğünde ekranda sadece *"₺2.400 Kazandın — Reklam İzle 3x Yap"* yazmak yerine, **masanın üzerinde zaten duran `₺7.200`'lik dev nakit yığını** gösterilir:
     - Birincil Yeşil Buton: **`[₺7.200'NİN TAMAMINI KASAYA AL (Video / VIP)]`**
     - İkincil Gri Küçük Metin: *`[₺4.800'lik vardiya bonusunu bırak, sadece ₺2.400 al]`*
     - *(Kazancı büyütmek yerine, masadaki hazır parayı bırakmama çerçevesi RV/VIP dönüşümünü %40+ artırır).*
3. **Sosyal Medya Fenomeni & Yoğun Saat "Kaçan İtibar" Anı (`Events.ts`):**
   - **Kod Dayanağı:** `influencerDuration: 55 sn`, `influencerTipMult: 1.7` (toplam `~3,7x`), kaçarsa `-4 İtibar`.
   - **Psikolojik Uygulama:** Fenomenin sabır süresi son 15 saniyeye girdiğinde ve mutfakta ürün henüz çıkmamışsa, ekranın alt-orta kısmında tek dokunuşluk **`⚡ USTA MODU AÇ (Hız ×1,25 + Anında Hazırlık)`** teklifi belirir: *"Fenomen 12 saniye içinde gidiyor! 3,7x bahşişi ve +10 İtibarı kaçırma!"*
4. **7 Günlük Seri Kırılma Kalkanı (Streak Freeze — `Daily.ts`):**
   - **Kod Dayanağı:** `LADDER_MINUTES = [3, 4, 5, 7, 9, 12, 16]` (`rollDay` içinde `gap > 1` olduğunda `dailyStreak = 0` oluyor).
   - **Psikolojik Uygulama:** 5. veya 6. güne ulaşmış bir oyuncu 1 gün girmeyi unuttuğunda seriyi sessizce sıfırlamak yerine, açılışta **"6 Günlük Emek Koruma"** penceresi çıkar: *"Dün dükkanı açamadın ama Tezgâhtar Umut nöbetteydi! 6 günlük serini (12 dakikalık gelir ödülü) kaybetmemek için şimdi devam et."* (1 RV veya 20 Elmas / VIP için ücretsiz).
5. **IKEA Etkisi ile Erken Kişiselleştirme Bağlılığı (`cosmetics.ts`):**
   - **Kod Dayanağı:** `WALL_SKINS` içinde *Adaçayı* (`cost: 0`) ve `TABLE_SKINS` içinde *Koyu Ceviz* (`cost: 0`) baştan ücretsizdir.
   - **Psikolojik Uygulama:** 4. dakikada (`g08 — Kahve bölümü açılışı` sonrasında) oyuncuya 5 saniyelik mini bir bildirimle ücretsiz duvar/masa rengini seçtir. **IKEA Etkisi** gereği kendi rengini seçip dekore ettiği kafeyi "kendi dükkanı" olarak benimseyen oyuncunun D1–D7 terk (churn) oranı belirgin biçimde düşer.

---

## 4. D1 / D7 / D30 Terk (Churn) Önleme Tetikleyicileri ve Müdahale Matrisi

Oyunun mevcut telemetri ve hedef zinciri (`src/data/goals.ts`, `src/core/Telemetry.ts`, `src/core/PurchaseMetrics.ts`) üzerinden oyuncunun oyunu bırakma (churn) riskini önceden yakalayan ve otomatik müdahale eden 3 aşamalı sistem:

### 4.1 D1 (1. Gün — İlk Oturum ve Ertesi Gün Dönüşü) Müdahale Planı
> **Hedef Metrik:** D1 Retention `%42+` | **Kritik Eşik:** İlk 10 dakikada `g06 (Tezgâhtar İşe Al)` ve `g08 (Kahve Bölümü)` hedeflerinin tamamlanması.

| Risk Sinyali / Tetikleyici (`Telemetry.ts` / `GameState.ts`) | Kök Neden (Neden Bırakıyor?) | Otomatik Oyun İçi Müdahale (Intervention) | Psikolojik Mekanizma |
|---|---|---|---|
| **Sinyal D1-A:** İlk 90 saniyede 2 müşterinin sabır süresi dolup kızgın ayrılması (`angryCount >= 2` ve `goalIndex < 4`) | Oyuncu kirli masaya yeni müşteri oturmadığını (`Station.ts:142`) fark etmedi; elinde çayla bekliyor. | Rehber oku (`GuideMarker`) anında kirli masaya kilitlenir, masa üstünde yüksek kontrastlı **`🧹 ÖNCE MASAYI SİL (+₺15)`** balonu çıkar ve ilk temizlik süresi `%50` hızlandırılır. | **Activation Energy & Fundamental Attribution Error:** Suçu oyuncuda aramak yerine sürtünmeyi o an sıfırla. |
| **Sinyal D1-B:** Oyuncu 6. dakikada hâlâ **Tezgâhtar (`waiter — ₺400`)** almadı ve tüm rafları tek başına doldurmaktan yoruldu (`tempo` düşüşü). | Oyuncu ödeme pedlerine para yatırmaktan personel panelini açmayı unuttu. | Kasada `₺400` biriktiğinde sağ alttaki **Personel** butonu altın halkayla parlar ve Tezgâhtar Umut kapıdan el sallayarak *"Usta, rafları ben doldurayım mı?"* mini-toast mesajı gösterir. | **BJ Fogg Model (Prompt at Peak Ability):** Parası tam yettiği anda görsel tetikleyici ver. |
| **Sinyal D1-C:** İlk oturum bitişi (Oyuncu 8–12 dk oynayıp uygulamayı arka plana attı). | Ertesi gün dönmek için açık bir döngü (open loop) kalmadı. | Oturum kapanırken makineler çevrimdışı üretime geçer; 18 saat sonra yerel bildirim (Local Notification): *"☕ Semaver ve Kahve Barı ağzına kadar doldu! Tezgâhtar Umut kasada ₺1.850 biriktirdi, gelip topla."* | **Zeigarnik Effect & Endowment Effect:** İçeride onu bekleyen hazır stok ve nakit olduğunu hatırlat. |

---

### 4.2 D7 (7. Gün — Orta Oyun Darboğazı ve Sahil Şubesi Köprüsü) Müdahale Planı
> **Hedef Metrik:** D7 Retention `%16+` | **Kritik Eşik:** `g19 (Lavabolar — ₺9.000)` → `g27 (VIP Salon — ₺48.000)` → `g31 (Sahil Şubesi — ₺145.000)` geçişi.

| Risk Sinyali / Tetikleyici | Kök Neden (Neden Bırakıyor?) | Otomatik Oyun İçi Müdahale (Intervention) | Psikolojik Mekanizma |
|---|---|---|---|
| **Sinyal D7-A ("Teras / Geç Oyun Yorgunluğu"):** Tüm bölümler açıkken (`a8` sonrası) kızgın müşteri oranının `%30` üstüne çıkması (`DESIGN.md §12` bilinen darboğaz). | Mekân büyüdü, oyuncu hem lavabo sarfı hem uzak masa servisi arasında bunaldı. | Kriz anında **Zengin Yatırımcı (`investor`)** veya **Ücretsiz 5 Dakika Süpürge Robotu (`robot_vacuum`)** hediyesi tetiklenir; oyuncuya *"Masa Görevlisi (Komi) seviyesini yükseltmek yürüme hızını artırır"* ipucu (`UpgradeAdvice.ts`) sunulur. | **Theory of Constraints & Peak-End Rule:** En yoğun darboğaz anını ücretsiz robot/yatırımcı desteğiyle pozitif bir zirveye çevir. |
| **Sinyal D7-B ("Sahil Duvarı"):** Oyuncu `g30` (`₺145.000` Sahil Şubesi birikimi) hedefinde 2 oturumdur takıldı; bakiye `₺60.000–₺90.000` bandında yavaşladı. | `₺48.000` VIP Salon'dan `₺145.000` Sahil Şubesi'ne geçişteki fiyat sıçraması göz korkuttu. | Şubeler panelinde **"Sahil Ön İnceleme (30 Sn Canlı Kamera)"** butonu açılır ve oyuncuya özel tek seferlik **"Sahil Kurucu Hibesi"** görev zinciri (3 hızlı görevde toplam `+₺35.000` nakit ödül) verilir. | **Goal-Gradient Effect:** Uzak hedefi 3 küçük ara basamağa bölerek ilerleme çubuğunu hızlandır. |
| **Sinyal D7-C:** Haftalık Festival (`Festival.ts`) ilerlemesi Pazar günü `%75` seviyesinde kaldı. | Oyuncu haftalık büyük ödülü (`20 dakikalık gelir`) kaçırmak üzere. | Pazar öğleden sonra bildirim ve HUD vurgusu: *"🧇 Vafıl Festivali'nin bitmesine 6 saat kaldı! Hedetin %75'ini zaten tamamladın, son 15 vafılı servis et ve dev ödülü kap!"* | **Loss Aversion & Zeigarnik Effect:** "%25 kaldı" yerine "%75'i bitti, yanmasın" çerçevelemesi. |

---

### 4.3 D30 (30. Gün — Geç Oyun, Prestij ve Uzun Vadeli Tutunma) Müdahale Planı
> **Hedef Metrik:** D30 Retention `%7+` | **Kritik Eşik:** `g38 (₺6.000.000 Kazan — Sokağı Devret / Prestij)` ve Sonsuz Hedefler (`ENDLESS_TEMPLATES`).

| Risk Sinyali / Tetikleyici | Kök Neden (Neden Bırakıyor?) | Otomatik Oyun İçi Müdahale (Intervention) | Psikolojik Mekanizma |
|---|---|---|---|
| **Sinyal D30-A ("Prestij Korkusu"):** Oyuncu `₺6.000.000` ömür boyu kazancı geçti (`prestigePointsFor >= 6`), tüm şubeleri açtı ama **Sokağı Devret** butonuna basmaktan çekiniyor. | Oyuncu kurduğu kafeyi, aldığı personeli ve açtığı odaları kaybetmekten korkuyor (**Status-Quo Bias & Regret Aversion**). | **Sokağı Devret** ekranında kaybettikleri değil, **korudukları ve kazandıkları** vurgulanır:<br>• ✅ *Tüm Kozmetiklerin (Zemin, Duvar, Masa, Üniforma) Kalıcı Olarak Sende Kalır!*<br>• ✅ *İlk Devirde Anında +%60 Kalıcı Kazanç Çarpanı (`Sokağın İtibarı Sv. 3`)!*<br>• ✅ *İlk 10 dakikayı 3 kat hızlı geç!* | **Regret Aversion & Framing Effect:** Sıfırlama korkusunu "Kozmetikler korunur + +%60 kalıcı güç" garantisiyle ortadan kaldır. |
| **Sinyal D30-B:** Oturum sıklığı haftada 5 günden 2 güne düştü (Sağlık Skoru < 50). | İçerik tüketildi, rutinleşti. | Oyuncu döndüğünde **"Hoş Geldin Usta Paketi (Comeback Gift)"**: Tüm makineler `%150` taşmış stokla (`applyOfflineStock` `stockMult: 1.5`) başlar, 10 dakikalık ücretsiz **Mutlu Saat (`×2` Kazanç)** aktif olur ve yeni haftanın Festival rozeti ekranda kutlamayla açılır. | **Reciprocity Principle (Karşılıklılık İlkesi):** Dönüşte koşulsuz cömert hediye vererek oyuncuyu oyunda tut. |

---

## 5. Oyuncu Sağlık Skoru (Player Health Score) ve VIP Abonelik İptal / Kurtarma Akışı (`@churn-prevention`)

### 5.1 Oyun İçi Bağlılık Sağlık Skoru Modeli (0–100 Ölçeği)
`src/core/Telemetry.ts` ve `GameState` verileriyle yerel olarak hesaplanan (sunucu gerektirmeyen) 0–100 arası **Oyuncu Sağlık Skoru**:

$$\text{Health Score} = (0.35 \times S_{\text{oturum}}) + (0.25 \times S_{\text{hedef}}) + (0.20 \times S_{\text{günlük}}) + (0.20 \times S_{\text{ekonomi}})$$

- $S_{\text{oturum}}$ (**Oturum Sıklığı — %35**): Son 3 günde giriş yapılan gün sayısı (`3 gün = 100`, `2 gün = 70`, `1 gün = 35`, `0 gün = 0`).
- $S_{\text{hedef}}$ (**Hedef İlerlemesi — %25**): Son oturumda en az 1 ana hedef (`GOALS`), günlük görev veya bölge açılışı yapıldı mı (`Evet = 100`, `Pede kısmi para yatırıldı = 60`, `Hiçbiri = 20`).
- $S_{\text{günlük}}$ (**Günlük Seri & Festival — %20**): Aktif `dailyStreak` ve `festivalProgress` durumu (`Streak >= 3 = 100`, `Streak 1-2 = 70`, `Kırılmış = 30`).
- $S_{\text{ekonomi}}$ (**Darboğaz / Memnuniyet — %20**): Son oturumdaki ortalama `hygiene` ve `reputation` skoru (`>80 = 100`, `50-80 = 65`, `<50 = 25`).

| Skor Bandı | Durum | Otomatik Sistem Aksiyonu |
|---|---|---|
| **80–100** | **Sağlıklı (Healthy)** | Standart akış; VIP Salon veya Sahil Şubesi açılışında tam fiyatlı kozmetik / No-Ads Deluxe teklifi gösterilebilir. |
| **60–79** | **Dikkat (Needs Attention)** | Bir sonraki oturum açılışında ücretsiz `stock_refill` (tüm makineleri doldur) jesti yapılır. |
| **40–59** | **Risk Altında (At Risk)** | Geçiş reklamları (`interstitial`) o oturum için otomatik olarak yarıya indirilir (`SESSION_CAP: 4 → 2`); sıradaki ödeme pedinde `cash_boost` eşiği kolaylaştırılır. |
| **0–39** | **Kritik Terk Riski (Critical)** | O oturumda **sıfır geçiş reklamı** gösterilir; kapıya anında **Zengin Yatırımcı (`investor`)** gönderilir ve `%30` indirimli *Kurtarma Başlangıç Paketi* sunulur. |

---

### 5.2 Kafe Caddesi VIP Kulübü ($9.99/ay) İptal Önleme (Cancel Flow) ve Ödeme Kurtarma (Dunning)

VIP Pass aboneliği kullanan oyuncuların hem **iradi (voluntary)** hem de **kart hatası kaynaklı (involuntary)** kayıplarını önlemek için `@churn-prevention` standartlarında kurgulanan akış:

1. **Oyun İçi Abonelik Yönetim ve İptal Akışı (`Trigger → Survey → Dynamic Save Offer → Confirmation`):**
   - Ayarlar panelindeki *"VIP Aboneliği Yönet"* butonuna basıldığında oyuncu mağaza abonelik sayfasına yönlendirilmeden önce **tek soruluk, suçlayıcı olmayan (no guilt-trip)** bir ekran görür:
     - **A) "Fiyatı bütçeme göre yüksek geldi"** → **Dinamik Kurtarma Teklifi:** *"Kafeni reklamsız yönetmeye devam et: Sonraki 2 ay boyunca **%25 İndirim ($9.99 yerine $7.49/ay — $5.00 tasarruf)** veya tek seferlik **$6.99 Kalıcı No-Ads Deluxe** paketine geçiş."*
     - **B) "Bu sıralar pek vakit bulamıyorum"** → **Dinamik Kurtarma Teklifi:** *"Aboneliğini **1 Ay Duraklat (Pause)**; döndüğünde tüm VIP avantajların ve kasanda **300 Elmas** seni hazır beklesin."*
     - **C) "Tüm şubeleri bitirdim, yeni içerik bekliyorum"** → **Dinamik Kurtarma Teklifi:** *"Yeni Şube güncellemesi yolda! Şimdi kalırsan hesabına anında **+5 Fincan Puanı (Prestij)** ve **Antrasit & Altın Üniforma** tanımlanır."*
2. **Başarısız Ödeme Kurtarma (Involuntary Churn / Grace Period):**
   - Google Play Billing ve Apple StoreKit **Account Hold & Billing Grace Period (7 Günlük Ek Süre)** özellikleri konsoldan aktif edilir.
   - Kart tahsilatı başarısız olduğunda oyuncunun VIP özellikleri (reklamsız ödül alma) ilk **72 saat boyunca kesilmez**; oyun içinde üstte kibar bir bildirim bandı çıkar: *"💳 VIP Kulübü yenilemesinde kart onayı gerekiyor. Reklamsız ödül hakkını ve günlük 50 Elmas serini kaybetmemek için ödeme yöntemini güncelle."* (Güncelleyen oyuncuya anında `+100 Elmas` teşekkür bonusu verilir).
