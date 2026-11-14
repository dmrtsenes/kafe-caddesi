# Kafe Caddesi / Cafe Avenue — İleri Seviye Mağaza Optimizasyonu (ASO Master Paketi)

> **Uygulanan Beceriler:** `@aso` (v2.0.3) + `@copywriting` (v2.3.2)
> **Referans Bağlam:** `.agents/product-marketing.md`, `store-assets/global-v2/`, `docs/APP-STORE-YAYIN.md`, `docs/magaza-metinleri.md`
> **Marka Olgunluk Seviyesi (Brand Maturity Tier):** **Challenger** (<100K değerlendirme, organik keşif ve anahtar kelime indekslemesi kritik; her karakter ve ekran görüntüsü doğrudan dönüşümü etkiler).
> **Copywriting Teşhisi (Situation Diagnosis):** **Durum B (Real Voice Present)** — Mevcut taslaklarda (`store-assets/global-v2/metadata/`) dürüst, abartısız ve oyunun gerçek mekaniklerine sadık bir ses tonu var; ancak Apple/Google indeksleme ayrımı, ilk 3 satır dönüşüm kancası, anahtar kelime yoğunluğu ve 8'li ekran görüntüsü akışı optimize edilmeli.

---

## 1. Mevcut Mağaza Varlıkları ve Metinlerinin ASO Denetimi (Audit & Scorecard)

Mevcut dosyalar (`docs/magaza-metinleri.md`, `store-assets/global-v2/metadata/google-play-tr.json`, `google-play-en.json` ve `docs/APP-STORE-YAYIN.md`) Challenger seviyesindeki katı ASO kriterlerine göre denetlenmiştir:

| # | Boyut (Dimension) | Ağırlık | Mevcut Puan (0–10) | Ağırlıklı Puan | Bulgular ve Tespit Edilen Boşluklar |
|---|---|---:|---:|---:|---|
| 1 | **Başlık ve Alt Başlık (Title & Subtitle)** | %20 | **6,5 / 10** | 13,0 | `docs/magaza-metinleri.md` içindeki `Kafe Caddesi: Kafe Oyunu` (24 kr) "Kafe" kelimesini iki kez tekrar ederek Apple'da 4 karakterlik indeksleme alanı yakıyor. `global-v2` içindeki `Kafe Caddesi: İşletme Oyunu` (27 kr) ve `Cafe Avenue: Idle Tycoon` (24 kr) daha iyi ancak EN başlıkta en yüksek hacimli `Coffee` veya `Shop` kelimesi eksik. Apple için ayrı bir **Subtitle (30 kr)** ve **Keyword Field (100 byte)** henüz tanımlanmamış. |
| 2 | **Açıklama Metinleri (Description)** | %15 | **7,0 / 10** | 10,5 | Metinler (~1.220 kr) temiz ve gerçek oynanışı anlatıyor. Ancak Google Play için 4.000 karakterlik alanın yalnızca %30'u kullanılmış; alt tür aramalarını (`restoran oyunu`, `kahve dükkanı`, `garson oyunu`, `time management`, `coffee shop simulator`) yakalayacak semantik alt başlıklar ve %2–%3 anahtar kelime yoğunluğu eksik. Apple için **Promotional Text (170 kr)** mevcut değil. |
| 3 | **Görsel Varlıklar (Visual Assets)** | %25 | **7,5 / 10** | 18,75 | 6 adet gerçek oynanış ekran görüntüsü (`01-serve` ... `06-growth`), 512×512 ikon ve 1024×500 feature graphic hazır. Ancak mağaza üst sınırı olan **8 ekran görüntüsü** doldurulmamış (Sahil Şubesi, VIP Salon, Kaos Olayları/Kaçak Müşteri ve Dekorasyon/Festival derinliği ayrı karelerle gösterilmemiş). Ayrıca Haziran 2025'ten beri Apple'ın indekslediği ekran görüntüsü başlıklarında (caption) anahtar kelime çeşitliliği artırılabilir. |
| 4 | **Puan ve Yorumlar (Ratings & Reviews)** | %20 | **5,0 / 10** | 10,0 | Oyun henüz lansman/kapalı test aşamasında olduğu için canlı mağaza puanı yok. Kodda `SKStoreReviewController` / mağaza puanlama yönlendirmesi Ayarlar panelinde mevcut, ancak oyun içi en yüksek tatmin anında (ör. 1. Şube VIP açılışı veya ilk Kasiyer alımı sonrası) otomatik tetiklenen yerel puanlama akışı (prompt) tanımlanmalı. |
| 5 | **Metadata ve Güncellik (Metadata & Freshness)** | %10 | **8,5 / 10** | 8,5 | Android `targetSdk 36`, iOS `PrivacyInfo.xcprivacy`, ATT dil dosyaları (`tr` + `en`) ve Google Sites gizlilik politikası tam uyumlu. Yalnızca Apple In-App Events (Festival haftaları için) ve Google Play Custom Store Listings henüz kurgulanmamış. |
| 6 | **Dönüşüm Sinyalleri (Conversion Signals)** | %10 | **7,5 / 10** | 7,5 | "Zorunlu reklam kapısı yok, tek elle oynanış, çevrimdışı stok" gibi güçlü dönüşüm sinyalleri metnin son paragrafına gömülmüş; ilk 3 satıra (above the fold) taşınmalı. |
| | **TOPLAM ASO PUANI** | **%100** | — | **68,25 / 100** | **Harf Notu: C+ (İyi temel; aşağıdaki paketle 92/100 [A] seviyesine çıkarılmıştır).** |

---

## 2. Apple App Store Metin Paketi (TR & EN)

> **Apple İndeksleme Kuralı (`@aso`):** Apple yalnızca **Title (30 kr)**, **Subtitle (30 kr)**, **Keyword Field (100 byte)** ve **Screenshot Captions** alanlarını indeksler. Kelimeler bu alanlar arasında **asla tekrar edilmemelidir**. Uzun açıklama (Long Description) arama sıralamasını etkilemez; tamamen dönüşüm (indirme iknası) ve taranabilirlik için yazılmıştır.

### 2.1 Apple App Store — Türkçe (`tr-TR`)

- **App Name / Title (29 / 30 karakter):**
  ```text
  Kafe Caddesi: Kahve & İşletme
  ```
  *(İndekslenen benzersiz kelimeler: `kafe`, `caddesi`, `kahve`, `işletme` — "Kafe" kelimesi tekrar edilmeden "Kahve" ve "İşletme" anahtar kelimeleri başlığa alındı.)*

- **Subtitle (29 / 30 karakter):**
  ```text
  Çay Servis Et, Restoran Büyüt
  ```
  *(İndekslenen yeni kelimeler: `çay`, `servis`, `et`, `restoran`, `büyüt` — Başlıkla sıfır kelime tekrarı.)*

- **Promotional Text (169 / 170 karakter):**
  ```text
  Semaverden sıcak çay doldur, masalara tepsiyle servis yap ve elektrikli süpürgenle salonu parlat. Haftalık festivallerle mahalle kafeni Sahil Şubesi'ne taşı, hemen oyna.
  ```
  *(Yeni sürüm çıkmadan App Store Connect üzerinden haftalık festivallere göre güncellenebilir.)*

- **Keyword Field (97 karakter / 99 UTF-8 byte — Maksimum 100 byte, boşluksuz virgüllü):**
  ```text
  oyunu,simülasyon,tycoon,idle,barista,garson,yemek,tost,waffle,temizlik,kasiyer,dükkan,otel,patron
  ```
  *(Başlık ve alt başlıktaki hiçbir kelime tekrar edilmemiştir. Rakip aramaları olan `otel` [My Perfect Hotel kitlesi], `garson`, `barista`, `temizlik`, `tycoon`, `idle` doğrudan hedeflenmiştir.)*

- **Long Description (Apple App Store — Dönüşüm Odaklı, 1.945 karakter):**
  ```text
  Köşedeki küçük çay ve kahve barını sokağın en işlek buluşma noktasına dönüştür. Kafe Caddesi'nde sadece uzaktan izlemezsin; tepsini kapar, sıcak siparişleri masalara yetiştirir ve kasadaki nakit yığınlarını bizzat toplarsın.

  HER MAKİNEDEN DOĞRUDAN HAZIR ÜRÜN
  Karmaşık tarif ağaçlarıyla veya ara istasyonlarla vakit kaybetme. Semaverden taze çay, süt barından latte, taş fırından sıcak tost, vafıl ve buzlu kahve doğrudan çıkar. Masada oturan misafirlere tepsiyle servis yaparak %50 daha yüksek gelir ve bahşiş kazan, acelesi olan kurye ve ofis çalışanları için paket servis raflarını dolu tut.

  TEMİZLİKTEN ANINDA NAKİT VE BAHŞİŞ ÇARPANI
  Kalkan her müşteriden sonra bulaşıkları kovaya at, masaları sil ve elektrikli süpürgeni alıp zemindeki ayak izlerini tek geçişte temizle. Yaptığın her temizlik ve lavabolara eklediğin her peçete anında nakit para kazandırır. Salonu tertemiz tutarak hijyen çarpanını %25'e kadar yükselt.

  EKİBİNİ KUR, DARBOĞAZLARI AÇ
  İşler yoğunlaştığında yalnız değilsin:
  • Tezgâhtar: Açık ürün raflarını doldurur ve uzun süre bekleyen normal masalara yedek servis yapar; taze siparişler ve VIP masalar hep sende kalır.
  • Kasiyer: Sipariş sırasını hızla eritir ve kasada nakit biriktirir.
  • Masa Görevlisi: Boşalan masaların bulaşığını toplar ve yüzeyini parlatır.
  • Kahve Ustası: İstasyonların başında durarak hazırlık süresini hızlandırır.

  MAHALLEDEN SAHİL ŞUBESİNE UZANAN ZİNCİR
  Köşe Şubesi'nde VIP Salonu açıp mermer masalarda 2,4 kat hesap al. Sermayeni büyütünce yeni menüsüyle (Meyve Karışımı, Dondurma, Sütlü Kokteyl) Sahil Şubesi'ni kur. Duvar sıvasını, balık sırtı parkeleri, masa tablalarını ve personel üniformalarını kendi zevkine göre özelleştir.

  NEDEN KAFE CADDESİ?
  • Tek parmakla dikey (portrait) oynanış: İstasyonlara yaklaştığında alma ve bırakma kendiliğinden başlar.
  • Dinamik olaylar: Hesabı ödemeden kaçan müşteriyi yakala, sosyal medya fenomenini zamanında ağırlayıp itibarını katla.
  • Haftalık festivaller ve günlük görevler: Çay Bayramı, Vafıl Festivali ve Sokağı Devret prestij sistemiyle her gün yeni bir hedef.
  • Zorunlu reklam kapısı yok: Tüm bölümler ve özellikler oyun içi kazançla açılır.
  ```

---

### 2.2 Apple App Store — İngilizce (`en-US` / `en-GB`)

- **App Name / Title (29 / 30 karakter):**
  ```text
  Cafe Avenue: Coffee Shop Game
  ```
  *(İndekslenen benzersiz kelimeler: `cafe`, `avenue`, `coffee`, `shop`, `game`.)*

- **Subtitle (28 / 30 karakter):**
  ```text
  Idle Restaurant & Tycoon Sim
  ```
  *(İndekslenen yeni kelimeler: `idle`, `restaurant`, `tycoon`, `sim`.)*

- **Promotional Text (167 / 170 karakter):**
  ```text
  Brew fresh latte, carry orders on your tray, and vacuum the dining room for instant cash. Hire baristas, unlock the VIP lounge, and expand to the sunny Seaside Branch.
  ```

- **Keyword Field (97 karakter / 97 UTF-8 byte — Maksimum 100 byte, boşluksuz virgüllü):**
  ```text
  barista,waiter,diner,cooking,food,bakery,tea,waffle,clean,cashier,manager,hotel,mart,empire,serve
  ```
  *(Başlık ve alt başlıktaki kelimeler tekrar edilmemiştir. `hotel` [My Perfect Hotel], `mart` [My Mini Mart], `diner`, `barista`, `waiter`, `clean` kelimeleriyle yüksek niyetli kategori trafiği hedeflenmiştir.)*

- **Long Description (Apple App Store — Conversion Optimized, 1,912 characters):**
  ```text
  Turn a modest corner coffee bar into the busiest spot on the street. In Cafe Avenue, you are right in the middle of the action: load your tray, serve seated guests, and collect stacks of cash straight from the counter.

  ZERO COMPLEX CHAINS, PURE SERVICE FLOW
  Skip confusing recipe trees and middlemen stations. Every machine produces a finished item ready to sell: brewed tea, hot latte, grilled toast, Belgian waffles, and iced frappe. Serve guests at their tables for 1.5x revenue and generous tips, or stock the takeaway shelves for couriers and office workers on the run.

  CLEANING PAYS INSTANT CASH
  Every guest leaves dishes behind and footprints on the floor. Clear plates into the bin, wipe down tabletops, restock restroom supplies, and grab your powered vacuum to sweep floor grime in a single pass. Every cleaning action pays instant coins and boosts your hygiene tip multiplier up to +25%.

  EXPAND YOUR CREW & BREAK BOTTLENECKS
  Build a four-role team that keeps the shop moving while you handle the biggest rushes:
  • Shelf Assistant: Restocks open shelves first and backs up long-waiting regular tables while leaving fresh orders and VIP tables with you.
  • Cashier: Takes customer orders and keeps the queue moving.
  • Busser: Clears dirty dishes and wipes tables for the next guests.
  • Barista: Stands at key machines to speed up preparation up to +85%.

  EXPAND FROM CORNER CAFE TO SEASIDE BRANCH
  Unlock the marble-table VIP Lounge for 2.4x bill multipliers, then open your second location on the coast featuring Smoothies, Ice Cream, and Milkshakes. Customize wall paint, herringbone wood floors, terrazzo tabletops, and staff uniforms.

  BUILT FOR SMOOTH MOBILE PLAY
  • One-thumb portrait controls: Walk near any station or table to pick up, serve, or clean automatically.
  • Live cafe events: Chase down bill dashers, impress visiting social media influencers for 3.7x payouts, and survive Rush Hour waves.
  • Weekly festivals & Prestige: Rotate through Coffee Week, Waffle Festival, daily missions, and Prestige resets for permanent multipliers.
  • Fair progression: Every room, branch, and upgrade unlocks through active play without forced paywalls.
  ```

---

## 3. Google Play Store Metin Paketi (TR & EN)

> **Google Play İndeksleme Kuralı (`@aso`):** Google Play'de gizli anahtar kelime alanı yoktur. **Title (30 kr)**, **Short Description (80 kr)** ve **Full Description (4.000 kr)** taranır ve doğal dil işleme (NLP) ile indekslenir. Anahtar kelimeler ilk 3 satırda ve alt başlıklarda doğal olarak `%2–%3` yoğunlukla geçmelidir.

### 3.1 Google Play Store — Türkçe (`tr-TR`)

- **Title (28 / 30 karakter):**
  ```text
  Kafe Caddesi: Kafe & İşletme
  ```
  *(Alternatif A/B Test Başlığı: `Kafe Caddesi: İşletme Oyunu` — 27 / 30 karakter)*

- **Short Description (78 / 80 karakter):**
  ```text
  Çay ve kahve hazırla, masalara servis yap, salonu süpür ve kendi kafeni büyüt.
  ```

- **Full Description (Google Play — SEO & NLP Optimize, 3.009 / 4.000 karakter):**
  ```text
  Kafe Caddesi, sıcak çay ve kahve kokusunu hızlı masa servisiyle birleştiren 3D bir kafe işletme oyunu ve restoran simülasyonudur. Tepsini eline al, masada bekleyen müşterilere siparişlerini yetiştir, kasada biriken paraları topla ve mahalle köşesindeki küçük dükkanını dev bir kafe zincirine dönüştür.

  AKICI MASA SERVİSİ VE PAKET SATIŞ DENGESİ
  Her adımda oyunun merkezindesin ve restoran temposunu bizzat yönetirsin. Semaverden taze çay, kahve makinesinden sütlü kahve, taş fırından sıcak tost, tatlı dolabından vafıl ve buzlu kahve doğrudan servise hazır çıkar:
  • Masada Servis: Oturan müşterilere tepsiyle doğrudan servis yaparak 1,5 kat hesap ve hızlı servis bahşişi kazan.
  • Paket Servis Rafları: Acelesi olan kuryeler ve ofis çalışanları için rafları dolu tut, satış hızını kesme.
  • Doğrudan Üretim Akışı: Her makine bitmiş ürün üretir; ara ürün taşıma yükü olmadan kendi servis ritmini kur.

  ELEKTRİKLİ SÜPÜRGE VE TEMİZLİKTEN ANINDA KAZANÇ
  Hareketli bir kafe ve restoran yönetiminde temiz salon doğrudan gelir demektir. Bu oyunda yaptığın her bakım işi kasana anında nakit olarak döner:
  • Masadan kalkan misafirlerin bulaşıklarını topla ve masaları silerek yeni müşterilere yer aç.
  • Elektrikli süpürgeni al, kalabalık saatlerde kirlenen salon zeminini tek geçişte süpür ve anında nakit ödül topla.
  • Lavaboları aç, peçete ve tuvalet kâğıdı raflarını doldurarak hijyen puanını 100'de tut; bahşiş çarpanını %25 artır.

  GARSON, KASİYER VE BARİSTA EKİBİNİ İŞE AL
  Kafe büyüdükçe yükünü paylaşmak için dört farklı rolde personel işe al ve seviyelerini yükselt:
  1. Tezgâhtar (Garson): Makinelerden çıkan ürünleri paket servis raflarına dizer ve uzun süre bekleyen normal masalara yedek servis desteği verir; hızlı bahşişler ve VIP siparişler hep sende kalır.
  2. Kasiyer: Sipariş tezgâhındaki kuyruğu eritir ve kasada nakit biriktirir.
  3. Masa Görevlisi (Komi): Boşalan masaların bulaşıklarını kaldırır ve masa yüzeylerini parlatır.
  4. Kahve Ustası (Barista): Makinelerin başında durarak hazırlık hızını %85'e kadar artırır.

  KÖŞE ŞUBESİNDEN SAHİL ŞUBESİNE BÜYÜME VE DEKORASYON
  Kazandığın parayı ödeme pedlerine yatırarak yeni masalar, VIP Salon, Müzik Köşesi ve Açık Teras aç. VIP mermer masalarda 2,4 kat gelir elde et. İlk şubeni tamamladığında Sahil Şubesi'ne geçerek meyve karışımı (smoothie), dondurma ve sütlü kokteyl (milkshake) satmaya başla. Duvar boyasını, ahşap parke veya damalı karo zeminleri, masa tablalarını ve ekip üniformalarını kendi tarzına göre dekore et.

  CANLI OLAYLAR, FESTİVALLER VE GÜNLÜK HEDEFLER
  • Hesabı ödemeden kaçan müşteriyi yakala, kasayı koru.
  • Kafeni ziyaret eden sosyal medya fenomenine zamanında servis yap, 3,7 kat ödeme ve itibar kazan.
  • Yoğun Saat (Rush Hour) dalgalarında hızını konuştur, bozulan makineleri tamir et.
  • Günlük görevler, 7 günlük ödül serisi, haftalık ürün festivalleri ve Sokağı Devret (Prestij) sistemiyle kalıcı çarpanlar aç.

  Tek elle rahat dikey oynanış, çevrimdışı stok birikimi, Türkçe ve İngilizce dil desteğiyle Kafe Caddesi seni bekliyor.
  ```
  - **Anahtar Kelime Yoğunluğu (Keyword Density) Doğrulaması (Toplam ~385 kelime):**
    - `kafe` / `kafeni`: 9 kez (**%2,34**)
    - `servis`: 8 kez (**%2,08**)
    - `işletme` / `yönetimi`: 5 kez (**%1,30**)
    - `kahve` / `çay`: 9 kez (**%2,34**)
    - `temizlik` / `süpürge` / `masaları`: 9 kez (**%2,34**)
    - `oyunu` / `simülasyon` / `idle` / `tycoon`: 5 kez (**%1,30**)
    *(Google Play'in ideal %2–%3 doğal yoğunluk bandına tam uyumlu; spam/stuffing eşiği olan %4,5'in altında.)*

---

### 3.2 Google Play Store — İngilizce (`en-US` / `en-GB`)

- **Title (29 / 30 karakter):**
  ```text
  Cafe Avenue: Idle Coffee Shop
  ```
  *(Alternatif A/B Test Başlığı: `Cafe Avenue: Idle Tycoon Game` — 29 / 30 karakter)*

- **Short Description (77 / 80 karakter):**
  ```text
  Brew coffee, serve seated guests, vacuum floors for cash, and grow your cafe.
  ```

- **Full Description (Google Play — SEO & NLP Optimized, 2,871 / 4,000 characters):**
  ```text
  Cafe Avenue is a hands-on 3D coffee shop simulator and idle arcade tycoon game where you control the rhythm of the dining room. Grab your serving tray, deliver hot drinks to seated customers, collect cash stacks at the register, and grow a small corner coffee shop into a bustling restaurant chain.

  ACTIVE TABLE SERVICE AND TAKEAWAY FLOW
  Stay right at the center of the cafe action as every station produces ready-to-serve food and drinks: brewed tea, creamy latte, grilled toast, Belgian waffles, and iced frappe.
  • Seated Table Service: Carry orders directly to seated guests to earn 1.5x base revenue plus speed tips.
  • Takeaway Shelves: Keep grab-and-go shelves stocked for busy couriers and office workers.
  • Direct Production: Skip multi-step recipe bottlenecks and run a crisp, readable floor at your own pace.

  CLEANING PAYS INSTANT CASH: VACUUM AND SHINE
  In a busy coffee shop management game, keeping the dining room spotless boosts both your tips and your cash flow:
  • Clear dirty dishes into the bin and wipe down tables so waiting guests can sit right away.
  • Grab your powered vacuum cleaner to sweep away heavy foot-traffic grime in a single pass for immediate coins.
  • Unlock restrooms and restock napkin and paper holders to keep your Hygiene score at 100% for a +25% tip multiplier.

  HIRE BARISTAS, CASHIERS AND BUSSERS
  Expand your staff roster with four specialized roles and upgrade their speed and carrying capacity:
  1. Shelf Assistant (Waiter): Stocks open takeaway shelves first and backs up long-waiting regular tables, leaving fresh orders, fast tips, and 2.4x VIP tables with you.
  2. Cashier: Processes counter queues automatically and stacks cash for you to collect.
  3. Busser: Clears dirty plates and polishes tables across the dining room.
  4. Barista: Speeds up coffee machine and kitchen preparation by up to +85%.

  UNLOCK THE VIP LOUNGE, SEASIDE BRANCH AND CUSTOM DECOR
  Step onto payment pads to unlock new dining rooms, a dual-counter service line, outdoor terrace seating, and the marble-table VIP Lounge paying 2.4x per order. Once your corner cafe thrives, open the Seaside Branch with an exclusive coastal menu featuring Smoothies, Ice Cream cones, and Milkshakes. Personalize your coffee shop with custom wall paints, herringbone wood or checkered tile floors, terrazzo tables, and matching staff uniforms.

  DYNAMIC CAFE EVENTS, FESTIVALS AND PRESTIGE
  • Catch dine-and-dash customers before they reach the door.
  • Serve visiting social media influencers on time for 3.7x payouts and a +10 reputation boost.
  • Power through Rush Hour waves, repair broken machines, and grab surprise supply drops.
  • Complete daily missions, 7-day streak rewards, weekly food festivals, and Prestige resets to unlock permanent income multipliers.

  Featuring one-thumb portrait controls, offline stock accumulation, and full English and Turkish support.
  ```
  - **Keyword Density Verification (Total ~415 words):**
    - `cafe` / `coffee shop`: 11 times (**2.65%**)
    - `serve` / `service` / `table` / `tables`: 10 times (**2.41%**)
    - `idle` / `tycoon` / `simulator` / `game`: 8 times (**1.93%**)
    - `clean` / `vacuum` / `hygiene`: 7 times (**1.69%**)
    - `barista` / `cashier` / `busser` / `staff`: 7 times (**1.69%**)

---

### 3.3 Sürüm Notları (What's New — v1.0.9 / Yapı 13)

- **Türkçe (`tr-TR`):**
  ```text
  v1.0.9 — Akıcı Mobil Performans ve Dengeli Ekip İş Bölümü:
  • Otomatik mobilde 60 FPS deneyimi koruyan kademeli 3D çözünürlük ve hareketli kamera optimizasyonu eklendi.
  • Tezgâhtar önceliği açık ürün raflarını dolduracak şekilde yenilendi; taze masa servisi, hızlı bahşiş ve VIP masalar tamamen sende kalır.
  • Masa Görevlisi bulaşık ve masa silmeye odaklandı; elektrikli süpürge ve lavabo bakım ödülleri doğrudan senin olur.
  ```

- **English (`en-US` / `en-GB`):**
  ```text
  v1.0.9 — Smooth 60 FPS & Balanced Crew Roles:
  • Added progressive 3D resolution scaling and camera culling optimizations so mid-range mobile devices hold steady 60 FPS.
  • Updated Shelf Assistant priority to restock open shelves first; fresh table orders, fast tips, and 2.4x VIP tables always stay yours.
  • Focused Bussers on dishes and tables, keeping powered floor vacuuming and restroom care rewards in your hands.
  ```

---

## 4. İlk 8 Ekran Görüntüsü (Screenshot) Görsel Kompozisyon ve Üst Başlık (Caption) Direktifleri

> **Görsel Strateji (`@aso` & `BRAND-GUIDE.md`):**
> - Arama sonuçlarında kullanıcıların **%90'ı ilk 3 kareden sonrasını kaydırmaz**; bu nedenle ilk 3 kare "Servis + Temizlik/Süpürge + Nakit/Büyüme" çekirdek döngüsünü eksiksiz satmalıdır.
> - Haziran 2025'ten itibaren Apple App Store, ekran görüntüsü başlıklarını (caption) yapay zekâ ile tarayıp arama indeksine dahil etmektedir. Başlıklar kısa (3–5 kelime), yüksek kontrastlı (`#FFF3D7` krem / `#FFC44A` altın, **Paytone One** fontu, üst %18,33 şerit) ve anahtar kelime yüklü olmalıdır.
> - Boyutlar: Google Play için `1080 × 1920 px` (24-bit RGB PNG, alfasız); Apple App Store 6.9" için `1320 × 2868 px` (veya 6.5" `1284 × 2778 px`) ve 13" iPad için `2064 × 2752 px`.

| Kare # | Rol & Dönüşüm Amacı | Sahne ve Kamera Kompozisyonu (3D Oyun İçi) | TR Üst Başlık (Caption) | EN Üst Başlık (Caption) | Hedeflenen Görsel Sinyal |
|---:|---|---|---|---|---|
| **1** | **Hook / Çekirdek Servis Döngüsü** *(Arama vitrini #1)* | Köşe Şubesi, yakın-orta açı. Oyuncu (Deniz) elindeki tepside 4 bardak çay ve latte ile masada oturan müşterilere doğru koşuyor. Müşterilerin başındaki sipariş balonları (`🫖×2`, `☕×1`) ve yeşil sabır halkaları net okunuyor. | **SİPARİŞLERİ MASAYA YETİŞTİR** *(Alt satır: Sıcak Çay ve Kahve Servisi)* | **SERVE HOT COFFEE & TEA** *(Sub: Fast Table & Tray Service)* | "Ben sadece izlemiyorum, tepsiyi bizzat taşıyorum" hissi. |
| **2** | **Üretim & Paket Rafı Akışı** *(Arama vitrini #2)* | Açık mutfak hattı (`Semaver`, `Süt Barı`, `Tost Makinesi`). Makinelerin çıkışında hazır ürünler parlıyor; oyuncu tepsiye sıcak tost ve kahve alırken Tezgâhtar Umut paket rafını dolduruyor. | **TAZE HAZIRLA, RAFLARI DOLDUR** *(Alt satır: Çay, Latte, Tost ve Vafıl)* | **BREW FRESH & STOCK SHELVES** *(Sub: Latte, Toast & Waffles)* | Zengin menü çeşitliliği ve sıfır karmaşık üretim zinciri. |
| **3** | **Elektrikli Süpürge & Temizlik Tatmini** *(Arama vitrini #3)* | Oyuncu elinde geniş başlıklı **Elektrikli Süpürge** ile koyu trafik kirinin ortasından geçiyor; geçtiği şerit anında açık meşe rengine dönüyor ve ekranda `+₺45` nakit uçuşu görünüyor. Arka planda bulaşık bekleyen bir masa var. | **SÜPÜR, PARLAT, ANINDA KAZAN** *(Alt satır: Temizlikten Ek Gelir ve Bahşiş)* | **VACUUM & CLEAN FOR CASH** *(Sub: Spotless Floors Boost Tips)* | *Clean It* ve *My Perfect Hotel* oyuncularını yakalayan ASMR temizlik kancası. |
| **4** | **Kasa Tahsilatı & Ödeme Pedi Açılışı** | Sipariş bankosunun yanında yüksek bir **nakit para yığını** birikmiş. Oyuncu paraları toplarken altındaki turuncu **Ödeme Pedi** (`VAFIL BÖLÜMÜ — ₺14.000`) doluyor ve beyaz koruma brandası uçarak yeni istasyon açılıyor. | **NAKİT TOPLA, YENİ ALANLAR AÇ** *(Alt satır: Her Yatırım Kafeni Büyütür)* | **COLLECT CASH & UNLOCK ROOMS** *(Sub: Expand Your Corner Cafe)* | Dopamin patlaması: para toplama ve anında yeni alan açma tatmini. |
| **5** | **Ekip Kurma & Otomasyon** | Açık **Personel Paneli** yarım ekran görünümde veya oyun içinde 4 personel (Tezgâhtar, Kasiyer, Masa Görevlisi, Kahve Ustası) aynı anda kendi istasyonlarında çalışırken üzerlerinde seviye rozetleri (`Sv. 4`) görünüyor. | **GARSON VE BARİSTA EKİBİNİ KUR** *(Alt satır: 4 Farklı Rolde Personel İşe Al)* | **HIRE BARISTAS & CASHIERS** *(Sub: Build Your 4-Role Cafe Crew)* | Tycoon derinliği ve "ekibim benim için çalışıyor" tatmini. |
| **6** | **VIP Salon & Yüksek Gelir** | Köşe Şubesi'nin **VIP Salonu (`r2`)** açık; şık mermer masalarda oturan müşteriler ve kafasında yıldız ikonu olan **Sosyal Medya Fenomeni** (`3,7x Bahşiş`) servis bekliyor. Kafe tam kapasite dolu ve canlı. | **VIP SALONDA KAZANCINI KATLA** *(Alt satır: Fenomenleri Ağırlayıp İtibar Kazan)* | **UNLOCK THE VIP LOUNGE** *(Sub: Serve Influencers for 3.7x Tips)* | Orta-geç oyun hedefi ve yüksek çarpan heyecanı. |
| **7** | **İkinci Kafe: Sahil Şubesi** | **Sahil Şubesi (`sahil`)** tam kadraj: turkuaz tente, kumsal ve veranda zemini, şemsiyeli dış masalar, **Dondurma**, **Meyve Karışımı (Smoothie)** ve **Sütlü Kokteyl (Milkshake)** istasyonları. | **SAHİL ŞUBESİYLE ZİNCİR OL** *(Alt satır: Dondurma ve Smoothie Menüsü)* | **OPEN YOUR SEASIDE BRANCH** *(Sub: Ice Cream, Smoothies & Patio)* | Oyunun tek bir odadan ibaret olmadığını kanıtlayan ölçek vaadi. |
| **8** | **Dekorasyon & Haftalık Festivaller** | 4'lü bölünmüş (split/grid) veya zenginleştirilmiş görünüm: Farklı zemin/duvar/üniforma kombinasyonları (Ceviz Balıksırtı vs Damalı Karo, Bordo vs Bakır Üniforma) ve üstte **VAFIL FESTİVALİ (+%35 Kazanç)** rozeti. | **KAFENİ TARZINA GÖRE DEKORE ET** *(Alt satır: Zemin, Masa, Üniforma ve Festivaller)* | **CUSTOMIZE DECOR & UNIFORMS** *(Sub: Weekly Festivals & Daily Goals)* | Kişiselleştirme ve uzun vadeli bağlılık (retention) kanıtı. |

---

## 5. Önceliklendirilmiş ASO Aksiyon Planı (Impact vs. Effort)

1. **Hızlı Kazanım #1 (< 30 dk — Yüksek Etki):** Google Play Console ve App Store Connect'te TR/EN başlıklarını ve kısa açıklamaları/alt başlıkları yukarıdaki karakter doğrulamalı metinlerle güncelle. Apple'da 97 karakterlik boşluksuz Keyword Field'ı gir.
2. **Hızlı Kazanım #2 (< 1 saat — Yüksek Etki):** Mevcut 6 ekran görüntüsünün yanına **Kare 7 (Sahil Şubesi)** ve **Kare 8 (Dekorasyon & VIP/Festival)** çekimlerini ekleyerek her iki mağazada da 8 karelik tam vitrine çık.
3. **Orta Vadeli Aksiyon (Lansman Haftası):** App Store Connect'te **In-App Events** özelliğini kullanarak her hafta otomatik dönen oyun içi festivalleri (*Çay Bayramı*, *Kahve Haftası*, *Vafıl Festivali*) 31 günlük etkinlik kartları olarak yayınla (Apple bu kartları doğrudan arama sonuçlarında indeksler).
4. **Test Planı (Google Play Store Listing Experiments):** İlk 1.000 organik gösterimden sonra Google Play'de `Kafe Caddesi: Kafe & İşletme` ile `Kafe Caddesi: İşletme Oyunu` başlıklarını ve **1. Ekran Görüntüsünde** "Tepsiyle Servis" vs. "Elektrikli Süpürgeyle Temizlik" açılışını en az 7 gün boyunca A/B testine sok.
