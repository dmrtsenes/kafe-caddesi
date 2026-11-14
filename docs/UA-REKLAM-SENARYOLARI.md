# Kafe Caddesi / Cafe Avenue — Oynanış Reklamları ve Kullanıcı Kazanımı (UA) Paketi

> **Uygulanan Beceri:** `@ad-creative` (v2.12.2)
> **Referans Varlıklar:** `campaign-kafe-caddesi/INCELEME.md`, `docs/REKLAM-FULL.md`, `src/promo-ua/copy.ts`, `.agents/product-marketing.md`
> **Teknik Format Standartları:** `1080 × 1920 px` (9:16 Dikey), `30 FPS` / `60 FPS`, `720 × 1200 px` merkezi metin güvenli alanı (Safe-Zone), `-16 LUFS / -1,5 dBTP` 48 kHz stereo AAC ses, gerçek oyun motoru (`Scene3D` + `World`) çekimi.

---

## 1. Mevcut Reklam Varlıkları Analizi (Grounding & Baseline)

Projede iki temel gerçek oynanış reklam hattı mevcuttur:
1. **`reklam-full.mp4` (`src/promo-gameplay/`):** 25 saniye, sözsüz sentez müzikli akış (M1 çay bekleyen müşteri → M2 masa silme → Semaverden 3 çay alma → Servis → 138 ₺ tahsilat → 400 ₺ Tezgâhtar işe alımı → Raf doldurma).
2. **`reklam-full2.mp4` (`campaign-kafe-caddesi/`):** 25 saniye, Türkçe seslendirmeli (*"Her şey bir çayla başlar..."*) ve kurgu kesmeli akış (Hazır çayı alma → 3 çay servisi → Bulaşık toplama & masa silme → 158 ₺ gelir → 400 ₺ Tezgâhtar alımı → Kapanış).
3. **`src/promo-ua/`:** *"KAFEN BATIYOR! KURTARABİLİR MİSİN?"* / *"YOUR CAFE IS FAILING! CAN YOU SAVE IT?"* başlıklı kriz/kurtarma katmanı.

**Performans Kreatif Teşhisi:**
- Mevcut videolar oyunun gerçekliğini %100 dürüstlükle yansıtıyor; ancak ücretli kullanıcı kazanımında (TikTok, Reels, Shorts, Meta Ads) soğuk kitleleri (cold net-new audiences) durdurmak için **ilk 3 saniyedeki görsel gerilim (Thumb-Stop Rate / Hook Rate)** çeşitlendirilmelidir.
- Aşağıdaki paket, sahte (fake) mekanik uydurmadan **yalnızca oyunun gerçek kodunda bulunan sistemleri** (`balance.ts`, `Events.ts`, `VacuumAsset.ts`, `cosmetics.ts`, `Sahil Şubesi`) kullanarak 10 kaydırma durdurucu kanca, 5 tam senaryo, platform bazlı reklam metinleri ve yanlışlanabilir A/B test hipotezleri sunar.

---

## 2. İlk 3 Saniyede Kaydırmayı Durduran 10 Oynanış Kancası (Scroll-Stopper Hooks)

> **Kural (`@ad-creative`):** Genel geçer *"Dur ve izle"*, *"POV: oyun oynuyorsun"* gibi yapay zekâ klişeleri yasaktır. Her kanca ilk 0,5 saniyede ekranda somut bir oyun içi gerilim, sayısal kayıp veya fiziksel tatmin gösterir.

| # | Kanca Kategorisi | 0–3 Sn Görsel Eylem (Oyun İçi Kamera) | Ekran Üstü Başlık (TR / EN — Safe Zone İçi) | Ses / SFX Kancası (0–3 Sn) | Hedeflenen Oyuncu Motivasyonu |
|---:|---|---|---|---|---|
| **H01** | **Acil Kriz (Sabır Halkası)** | 4 masada oturan müşterilerin sabır halkaları aynı anda **sarıdan kırmızıya** dönüyor; bir müşteri öfkeyle kollarını kaldırıp kalkmak üzere. | **TR:** 4 masa aynı anda kırmızıya döndü!<br>**EN:** 4 tables just turned red at once! | Hızlanan kalp atışı / saat tıkırtısı + müşteri öfke efekti | Kayıptan kaçınma (Loss Aversion) ve "Ben daha hızlı yetişirdim" dürtüsü. |
| **H02** | **ASMR Süpürge Darbesi** | Kamera zemine yakın. Simsiyah ayak izleriyle kaplı koridorun tam ortasından geniş başlıklı **Elektrikli Süpürge** geçiyor; tek darbede parlak meşe parke açılıyor ve `+₺68` uçuyor. | **TR:** Şu kirli zemini tek geçişte silmek...<br>**EN:** One pass across a filthy cafe floor... | Vakumlu süpürge sesi + parlama çınlaması + bozuk para sesi | *Clean It* / *My Perfect Hotel* kitlesinin görsel düzen ve temizlik tatmini. |
| **H03** | **Kaçak Müşteri (Dasher)** | Masadan kalkan kapüşonlu **Kaçak Müşteri** kafasında kırmızı `₺0 / KAÇIYOR!` ikonuyla kapıya doğru depar atıyor; oyuncu elindeki tepsiyi bırakıp peşinden koşuyor. | **TR:** Hesabı ödemeden kapıya koşuyor!<br>**EN:** He's running out without paying the bill! | Kısa polis düdüğü / alarm + hızlı ayak sesleri | Adalet duygusu ve anlık refleks/aksiyon merakı. |
| **H04** | **Kule Tepsi Dengesi** | Oyuncu (Deniz) seviye 10 **Servis Tepsisi** ile üst üste **12 bardak çay, latte ve vafıl** taşıyarak masaların arasından slalom yapıyor; kule hafifçe sallanıyor. | **TR:** Tek tepside 12 sipariş taşınır mı?<br>**EN:** Carrying 12 orders on a single tray? | Bardak şangırtısı + hızlı koşu ritmi | Fiziksel yığın (stacking) mekaniğini seven *Arcade Idle* kitlesi. |
| **H05** | **Nakit Dağı & Ödeme Pedi** | Sipariş kasasının yanında **₺14.000** değerinde dev bir para yığını birikmiş. Oyuncu üstünden geçerken paralar vakum gibi çekiliyor ve hemen yanındaki **VAFIL** pedinin brandası patlayarak uçuyor. | **TR:** Kasada biriken ₺14.000'yi tek seferde çek!<br>**EN:** Vacuuming ₺14,000 from the register at once! | Makinalı tüfek hızında nakit toplama sesi (`pickupInterval: 0.05s`) | Anlık ödül ve hızlı büyüme (Hyperbolic Discounting) tatmini. |
| **H06** | **Sosyal Medya Fenomeni** | Kapıdan altın yıldız efektli **Sosyal Medya Fenomeni** giriyor ve VIP mermer masaya oturup **Buzlu Kahve** istiyor; başının üstünde `3,7x BAHŞİŞ` sayacı geri sayıyor. | **TR:** Fenomen geldi: 3,7 kat bahşiş ya da eksi itibar!<br>**EN:** Influencer arrived: 3.7x tip if you make it in time! | Kamera deklanşör sesi + VIP melodi | Yüksek ödüllü mini-boss / özel müşteri gerilimi. |
| **H07** | **Kirli Masa Darboğazı** | Kapıda 6 müşteri sırada bekliyor ama içerideki tüm masalar **5'er kirli tabakla** dolu olduğu için kimse oturamıyor (`minFreeSeats: 1` kilidi). | **TR:** Masalar bulaşık dolu, kapıdaki sıra kilitlendi!<br>**EN:** Every table is dirty and the queue is locked! | Tabağın üst üste yığılma sesi + sırada homurdanma | Sistem darboğazı çözme (Theory of Constraints) isteği. |
| **H08** | **Yanlış Strateji Karşılaştırması** | Bölünmüş ekran (Split-screen): Üstte oyuncu tek başına çay taşıyıp yetişemiyor (`₺25`); altta **Tezgâhtar + Kasiyer + Komi** alınmış, kafe saat gibi işliyor (`₺4.800`). | **TR:** Tek başına koşturmak vs. 4 kişilik ekip kurmak<br>**EN:** Running solo vs. hiring a 4-role cafe crew | Üstte yavaş/boğuk ses, altta ritmik kasa/servis senfonisi | Otomasyon ve yöneticilik (Tycoon) tatmini. |
| **H09** | **Lavabo Kriz Noktası** | İki tuvaletin önünde sıra var; üstlerinde kırmızı `🧻 PEÇETE BİTTİ` ve `🧹 KİRLİ` uyarısı yanıp sönüyor, hijyen çarpanı `1,25x`'ten aşağı düşüyor. | **TR:** Lavaboda peçete bitti, bahşişler eriyor!<br>**EN:** Restroom supplies ran out and tips are dropping! | Uyarı zili + su/fırça temizlik sesi | Detaylı simülasyon ve mekanik merakı. |
| **H10** | **Köşe Barından Sahil Şubesine Geçiş** | 1,5 saniye tek masalı küçük **Köşe Şubesi**, ardından keskin bir geçişle (whip-pan) turkuaz tenteli, dondurma ve smoothie servis edilen dolu **Sahil Şubesi**. | **TR:** 1 masalı çay ocağından Sahil Şubesi'ne!<br>**EN:** From a 1-table tea bar to a Seaside Branch! | Martı/dalga sesiyle birleşen neşeli gitar/synth akoru | Uzun vadeli ilerleme (Progression) ve mekan çeşitliliği. |

---

## 3. Beş Tam Video Reklam Senaryosu (25–30 Saniye, 9:16 Dikey)

### Senaryo 1: "Fail / Win — Kilitlenen Kafeyi Kurtarma" (27 Saniye)
- **Format:** Problem → Yanlış Hamle (Fail) → Doğru Çözüm (Win) → Büyüme → CTA
- **Hedef Kitle:** *My Perfect Hotel* ve *Eatventure* oynayan, darboğaz çözmeyi seven oyuncular.

| Saniye | Görsel Akış (Oyun İçi Kamera & Aksiyon) | Ekran Üstü Başlık (TR / EN) | Seslendirme (VO) & Ses Efektleri (SFX) |
|---|---|---|---|
| **0–3 sn** | **[HOOK - H07]** 3 masada bulaşıklar birikmiş, kapıda 5 müşteri bekliyor ama masalar kirli olduğu için oturamıyor. Bir masa müşterisinin sabır halkası kırmızıda. | **TR:** Masalar kirli, müşteriler oturamıyor!<br>**EN:** Tables are dirty, guests can't sit! | **SFX:** Uyarı zili + sabırsız müşteri sesi.<br>**VO (TR):** "Masaları silmezsen yeni müşteri oturamaz!"<br>**VO (EN):** "If you don't clear the tables, nobody sits!" |
| **3–9 sn** | **[FAIL]** Oyuncu kirli masaları temizlemek yerine semaverden çay alıp boşta bekliyor. Kırmızı halkalı müşteri kızıp çıkıyor (`-1,2 İtibar`), ekran kenarı hafif kırmızı parlıyor. | **TR:** ❌ YANLIŞ HAMLE: Önce masa açılmalı!<br>**EN:** ❌ WRONG MOVE: Clear a table first! | **SFX:** Kızgın müşteri çıkışı + boğuk hata sesi.<br>**VO (TR):** "Elinde çayla beklersen müşteriyi kaçırırsın."<br>**VO (EN):** "Holding tea with no clean table loses the guest." |
| **9–17 sn** | **[WIN]** Sahne başa sarar (hızlı rewind efekti). Oyuncu önce kirli tabakları kapıp kovaya atar (`+₺18`), masaları parlatır (`+₺30`) ve **Elektrikli Süpürge** ile zemini tek geçişte açar. Müşteriler anında oturur. | **TR:** ✅ DOĞRU SIRALAMA: Temizle, oturt, kazan!<br>**EN:** ✅ RIGHT ORDER: Clean, seat, and earn! | **SFX:** Rewind sesi → Hızlı bulaşık/silme/süpürge sesleri + art arda para çınlaması.<br>**VO (TR):** "Önce masayı parlat, temizlikten anında para kazan!"<br>**VO (EN):** "Polish the table first and earn instant cash from cleaning!" |
| **17–23 sn** | Oyuncu 4 çayı ve 2 tostu masalara dağıtır, kasadaki nakit yığınını toplar (`+₺640`) ve **Masa Görevlisi (Komi — ₺9.000)** işe alım pedini tamamlar. Mavi ceketli Komi bulaşıkları devralır. | **TR:** Masa Görevlisi işe al, temizliği devret!<br>**EN:** Hire a Busser to automate table cleaning! | **SFX:** Nakit toplama + Seviye/İşe alım fanfarı.<br>**VO (TR):** "Sonra komiyi işe al, bulaşıkları o toplasın."<br>**VO (EN):** "Then hire a busser to handle the dishes for you." |
| **23–27 sn** | **[CTA]** Kafe tam ritimde dönerken üstte **KAFE CADDESİ / CAFE AVENUE** logosu ve mağaza rozetleri belirir. | **TR:** KAFENİN RİTMİ SENDE — ÜCRETSİZ OYNA<br>**EN:** RUN YOUR OWN CAFE — PLAY FREE | **SFX:** Sıcak kapanış akoru.<br>**VO (TR):** "Kafe Caddesi. Şimdi sıra sende."<br>**VO (EN):** "Cafe Avenue. Take control today." |

---

### Senaryo 2: "ASMR & Tatmin — Süpürge, Nakit ve Branda Patlaması" (24 Saniye)
- **Format:** Konuşmasız (No-VO), %100 kristal netliğinde oyun içi ses efektleri (SFX-driven ASMR) ve görsel tatmin.
- **Hedef Kitle:** Ses açık veya sessizde görsel/işitsel rahatlama (oddly satisfying) arayan geniş casual kitle.

| Saniye | Görsel Akış (Oyun İçi Kamera & Aksiyon) | Ekran Üstü Başlık (TR / EN) | Ses Tasarımı (Saf ASMR SFX) |
|---|---|---|---|
| **0–3 sn** | **[HOOK - H02]** Yakın plan: Salon zemininde yoğun ayak izleri ve 3 kahve lekesi var. Oyuncu **Elektrikli Süpürge** (`brushRadius: 0.80`) ile tam ortadan düz bir hat çizer; zemin parlar. | **TR:** En rahatlatıcı kafe temizliği 🧹<br>**EN:** The most satisfying cafe clean-up 🧹 | Düşük frekanslı tatlı süpürge uğultusu + her leke silindiğinde artan nota (`Do-Mi-Sol`) para çınlaması. |
| **3–9 sn** | Oyuncu 4 masadaki 12 kirli tabağı `0,3 sn` aralıklarla tepsiye dizer (*tık-tık-tık-tık*) ve çöp kovasına tek seferde boşaltır; masaları ardı ardına siler, sarı parıltı efektleri patlar. | **TR:** Her temizlik anında nakit verir!<br>**EN:** Every clean action pays instant coins! | Ritmik porselen tıkırtısı → Kovaya boşaltma şangırtısı → Yumuşak bez silme sesi + `Hijyen %100 (1,25x)` zili. |
| **9–16 sn** | Mutfak hattında Semaver, Süt Barı ve Tost Makinesi tam dolu. Oyuncu yanlarından koşarak geçerken 10 ürünü tepsiye vakum gibi çeker ve paket servis raflarına tek tek dizer. | **TR:** Üretim zinciri yok, doğrudan servis!<br>**EN:** No complex chains, pure service flow! | Hızlı balon patlama (`pop-pop-pop`) alma sesleri ve rafa dizme sesleri (`handsInterval` ritmi). |
| **16–21 sn** | Kasada biriken 200 birimlik maksimum nakit yığını (`counterCap: 200`) `0,05 sn` aralıklarla oyuncuya uçar ve oyuncu **VIP SALON** ödeme pedini doldurur; beyaz branda uçarak mermer masalar açılır. | **TR:** Parayı topla, VIP Salonu aç!<br>**EN:** Collect the stack & unlock the VIP Lounge! | Kesintisiz 3 saniyelik nakit akışı sesi → Branda açılış rüzgârı (`whoosh`) + zafer akoru. |
| **21–24 sn** | **[CTA]** VIP Salonda müşteriler otururken **KAFE CADDESİ / CAFE AVENUE** logosu. | **TR:** HEMEN İNDİR VE BAŞLA<br>**EN:** DOWNLOAD & PLAY NOW | Son bir sıcak çay bardağı bırakma sesi (`clink`). |

---

### Senaryo 3: "Kaos Yönetimi — Yoğun Saat, Fenomen ve Kaçak Müşteri" (28 Saniye)
- **Format:** Yüksek tempolu oynanış kesiti (`Events.ts` içindeki 3 gerçek kaos olayının ardışık gösterimi).
- **Hedef Kitle:** Aksiyon, zaman yönetimi (Time Management) ve *Good Pizza / Diner Dash* temposu arayan oyuncular.

| Saniye | Görsel Akış (Oyun İçi Kamera & Aksiyon) | Ekran Üstü Başlık (TR / EN) | Seslendirme (VO) & Ses Efektleri (SFX) |
|---|---|---|---|
| **0–3 sn** | **[HOOK - H03 + H06]** Üstte **🔥 YOĞUN SAAT (Akış ×2,4)** bandı yanıyor; VIP masada **Sosyal Medya Fenomeni** bekliyor ve aynı anda bir **Kaçak Müşteri** kapıya doğru koşmaya başlıyor! | **TR:** Kafe birbirine girdi! Hangisine koşacaksın?<br>**EN:** Total cafe chaos! Who do you handle first? | **SFX:** Yoğun saat sireni + koşu adımları.<br>**VO (TR):** "Yoğun saat başladı, fenomen bekliyor ve biri hesabı ödemeden kaçıyor!"<br>**VO (EN):** "Rush hour is on, an influencer is waiting, and a dasher is running!" |
| **3–10 sn** | Oyuncu önce hızla koşup kapıya çıkmak üzere olan **Kaçak Müşteri**'yi yakalar (`catchRadius: 1.7`); kaçak müşteriden para saçılarak kasaya geri döner. | **TR:** 1. Kaçak müşteriyi kapıda yakala!<br>**EN:** 1. Catch the bill dasher at the door! | **SFX:** Yakalama efekti + nakit saçılması.<br>**VO (TR):** "Önce kaçağı yakala, kasayı kurtar!"<br>**VO (EN):** "Catch the dasher first and save the cash!" |
| **10–17 sn** | Hemen arkasından duman çıkaran (`🔧`) arızalı **Vafıl Makinesi**'nin yanında 2 saniye durup tamir eder, çıkan sıcak vafılı ve buzlu kahveyi **Sosyal Medya Fenomeni**'nin masasına yetiştirir (`+10 İtibar`, `3,7x Hesap`). | **TR:** 2. Makineyi tamir et, Fenomeni yetiştir (3,7x)!<br>**EN:** 2. Fix the machine & serve the Influencer (3.7x)! | **SFX:** İngiliz anahtarı tamir sesi → VIP altın konfeti patlaması.<br>**VO (TR):** "Makineyi tamir et, fenomeni zamanında ağırlayıp 3,7 kat bahşişi kap!"<br>**VO (EN):** "Fix the waffle iron and serve the influencer for a 3.7x payout!" |
| **17–24 sn** | Yoğun saat biterken kasada devasa bir nakit birikmiştir. Oyuncu paraları toplayıp **Kahve Ustası (Barista)** ve **Kasiyer** seviyelerini yükseltir (`SEVİYE ATLADI!`). | **TR:** 3. Kazancı ekibe yatır, kaosu fırsata çevir!<br>**EN:** 3. Upgrade your crew & turn chaos into cash! | **SFX:** Hızlı seviye atlama sesleri.<br>**VO (TR):** "Ekibini güçlendir, bir sonraki yoğun saate hazır ol."<br>**VO (EN):** "Upgrade your crew and dominate the next rush." |
| **24–28 sn** | **[CTA]** Logo ve indirme çağrısı. | **TR:** KAFE CADDESİ — ÜCRETSİZ İNDİR<br>**EN:** CAFE AVENUE — PLAY FREE NOW | **SFX:** Parlak kapanış müziği. |

---

### Senaryo 4: "Zengin / Fakir Kafe — Seviye 1 Köşe Barı vs. Seviye 50 Sahil Zinciri" (26 Saniye)
- **Format:** Önce / Sonra (Before / After) ve Kozmetik/Şube dönüşümü.
- **Hedef Kitle:** Dekorasyon, restoran yenileme ve tycoon gelişimi seven oyuncular.

| Saniye | Görsel Akış (Oyun İçi Kamera & Aksiyon) | Ekran Üstü Başlık (TR / EN) | Seslendirme (VO) & Ses Efektleri (SFX) |
|---|---|---|---|
| **0–3 sn** | **[HOOK - H10]** İlk 1,5 sn: Sadece 2 ahşap masası ve tek semaveri olan başlangıç kafesi (`₺0`). Sonraki 1,5 sn: Mermer masalı VIP Salonu, Damalı Karo zemini ve 4 personeliyle tam dolu kafe (`₺150.000`). | **TR:** 1. Gün (₺0) vs. 10. Gün (₺150.000)<br>**EN:** Day 1 (₺0) vs. Day 10 (₺150,000) | **SFX:** Geçiş efekti (`whoosh`) + kasa sesi.<br>**VO (TR):** "Köşedeki iki masalı çay ocağını nereye kadar büyütebilirsin?"<br>**VO (EN):** "How far can you grow a two-table corner tea bar?" |
| **3–11 sn** | Başlangıç aşaması: Oyuncu ilk çayları servis eder, 30. saniyede **MASA 2 (₺300)** ve **KAHVE (₺1.100)** brandalarını açar, ilk **Tezgâhtar (₺400)** işe başlar. | **TR:** İlk 2 dakikada yeni masalar ve ilk personel!<br>**EN:** New tables and your first hire in 2 minutes! | **SFX:** Branda açılışları + neşeli tempo.<br>**VO (TR):** "Dakikalarca beklemek yok; ilk dakikada yeni masalarını aç, tezgâhtarını işe al."<br>**VO (EN):** "Unlock new tables and hire your first assistant within minutes." |
| **11–18 sn** | Kozmetik panelinden hızlı geçişlerle salonun görünümü değişir: **Krem Sıva → Deniz Tuzu Duvar**, **Meşe → Ceviz Balıksırtı Zemin**, **Gece & Pirinç Masa Tablası** ve **Bordo Ekip Üniforması**. | **TR:** Zemin, masa ve üniformaları tarzına göre seç!<br>**EN:** Customize floors, tables, and crew uniforms! | **SFX:** Boya/tasarım değişim sesleri (`pop-chime`).<br>**VO (TR):** "Balıksırtı parkelerden bordo üniformalara kadar her köşeyi kendi zevkine göre döşe."<br>**VO (EN):** "Style herringbone floors, marble tables, and matching uniforms." |
| **18–23 sn** | Şubeler panelinden **Sahil Şubesi (₺145.000)** açılır; kamera kumsal barına, dondurma ve smoothie istasyonlarına, şemsiyeli veranda masalarına geçer. | **TR:** Ve ikinci dükkan: Sahil Şubesi'ni aç!<br>**EN:** Then open your second location: Seaside Branch! | **SFX:** Yaz/sahil ambiyansı + büyük kutlama fanfarı.<br>**VO (TR):** "Sermayeni topla ve dondurma menüsüyle Sahil Şubesi'ni kur!"<br>**VO (EN):** "Then expand to the coast and open your Seaside Branch!" |
| **23–26 sn** | **[CTA]** İki şubenin yan yana görüntüsü ve **KAFE CADDESİ / CAFE AVENUE** logosu. | **TR:** KENDİ KAFE ZİNCİRİNİ KUR — ÜCRETSİZ OYNA<br>**EN:** BUILD YOUR CAFE CHAIN — PLAY FREE | **VO (TR):** "Kafe Caddesi'ni hemen indir."<br>**VO (EN):** "Download Cafe Avenue for free." |

---

### Senaryo 5: "Hızlandırılmış Büyüme — Tek Çaydan Devir (Prestij) Zirvesine" (25 Saniye)
- **Format:** Kesintisiz progresyon montajı (`0,8–1,2 sn` hızlı kurgu kesmeleriyle ürün ve gelir tırmanışı).
- **Hedef Kitle:** Sayıların katlanarak büyümesini (`₺25 → ₺5.200`) seven saf *Idle / Incremental Tycoon* oyuncuları.

| Saniye | Görsel Akış (Oyun İçi Kamera & Aksiyon) | Ekran Üstü Başlık (TR / EN) | Seslendirme (VO) & Ses Efektleri (SFX) |
|---|---|---|---|
| **0–3 sn** | **[HOOK]** Oyuncu semaverden ilk ince belli çayı alır ve masaya bırakır; ekranda büyük **`+₺25`** yazar. Hemen ardından kesme: Sahil şubesinde Sütlü Kokteyl bırakır, **`+₺5.200`** yazar! | **TR:** ₺25'lik çaydan ₺5.200'lik kokteyle!<br>**EN:** From a ₺25 Tea to a ₺5,200 Milkshake! | **SFX:** Küçük madeni para sesi → Dev altın kasa patlaması.<br>**VO (TR):** "Yirmi beş liralık bir çayla başlayıp nereye varabilirsin?"<br>**VO (EN):** "Starting with a 25-coin tea, how big can you scale?" |
| **3–12 sn** | Hızlı ürün açılış montajı (her 1,8 saniyede bir yeni istasyon brandası uçar ve ürün servis edilir):<br>1) **Sütlü Kahve (`₺82`)**<br>2) **Sıcak Tost (`₺210`)**<br>3) **Belçika Vafılı (`₺520`)**<br>4) **Buzlu Kahve (`₺1.150`)** | **TR:** Her yeni istasyon kazancını katlar!<br>**EN:** Every new station multiplies your income! | **SFX:** Yükselen perde (pitch-up) ile branda açılışları ve kasa sesleri.<br>**VO (TR):** "Sütlü kahve, taş fırın tostu, vafıl ve buzlu kahveyle menünü büyüt."<br>**VO (EN):** "Unlock latte, grilled toast, waffles, and iced frappe." |
| **12–19 sn** | Oyuncu **Rahat Ayakkabı (Hız Sv. 10)**, **Servis Tepsisi (15 Kapasite)** ve **Güler Yüz (+%90 Hesap)** yükseltmelerini basar; karakter salonda rüzgâr gibi akarak aynı anda 15 ürünü masalara dağıtır. | **TR:** 15 kapasiteli tepsi ve +%90 hesap bonusu!<br>**EN:** 15-item tray capacity & +90% bill bonus! | **SFX:** Hızlanma (`power-up`) efekti ve seri teslimat sesleri.<br>**VO (TR):** "Tepsi kapasiteni on beşe çıkar, tek turda bütün salonu doyur."<br>**VO (EN):** "Max out your tray to 15 items and clear the whole room in one run." |
| **19–25 sn** | **[PRESTİJ & CTA]** **Sokağı Devret (Prestij)** ekranı açılır, **Fincan Puanları** ile **`+%60 Kalıcı Kazanç`** alınır ve **KAFE CADDESİ / CAFE AVENUE** kapanış kartı gelir. | **TR:** Sokağı Devret, kalıcı çarpanlarla büyü!<br>**EN:** Prestige your street for permanent multipliers! | **SFX:** Epik prestij müziği.<br>**VO (TR):** "Kafe Caddesi. Ücretsiz indir ve hemen başla."<br>**VO (EN):** "Cafe Avenue. Play free now." |

---

## 4. Platform Bazlı Reklam Metinleri (Ad Copy — Karakter Doğrulamalı)

> **Kural (`@ad-creative`):** Em-dash (`—`), "Sadece X değil Y" kalıpları ve üçlü olumsuzluk listeleri kullanılmamıştır. Tüm metinler platformların kesme (truncation) sınırlarının altındadır.

### 4.1 Meta Ads (Facebook & Instagram Feed / Reels)

| Varyant | Dil | Primary Text (Görünür İlk 125 Kr Sınırına Uygun) | Headline (Max 40 Kr) | Description (Max 30 Kr) |
|---|---|---|---|---|
| **M1 (Servis & Akış)** | **TR** | Semaverden çayı kap, masada bekleyen müşterilere yetiş ve kasadaki nakit yığınını topla. Mahalle kafeni hemen kur. (114 kr) | `Kendi Kafe İşletmeni Büyüt` (26 kr) | `3D Kafe ve Servis Oyunu` (23 kr) |
| **M2 (Temizlik & Süpürge)** | **TR** | Bu kafede temizlik anında nakit öder. Elektrikli süpürgenle salonu parlat, bahşişleri %25 artır ve yeni odalar aç. (115 kr) | `Süpür, Servis Et ve Kazan` (25 kr) | `Tek Elle Rahat Oynanış` (22 kr) |
| **M3 (Ekip & Sahil)** | **TR** | Tek başına koşturmaktan yoruldun mu? Garson, kasiyer ve baristanı işe al; Köşe Şubesi'nden Sahil Şubesi'ne uzan. (113 kr) | `Ekibini Kur, Sahil Şubesini Aç` (30 kr) | `Ücretsiz Kafe Simülasyonu` (25 kr) |
| **M1 (Service & Flow)** | **EN** | Grab fresh coffee on your tray, serve seated guests for 1.5x tips, and collect cash stacks at the counter. Play free now. (121 kr) | `Run Your Own 3D Coffee Shop` (27 kr) | `Idle Arcade Cafe Tycoon` (23 kr) |
| **M2 (Vacuum & Cash)** | **EN** | Cleaning pays instant cash in Cafe Avenue. Sweep floor grime with your powered vacuum, boost tips by 25%, and unlock rooms. (123 kr) | `Vacuum, Serve & Grow Your Cafe` (30 kr) | `Smooth One-Thumb Controls` (25 kr) |
| **M3 (Crew & Seaside)** | **EN** | Hire baristas, cashiers, and bussers to keep your coffee shop moving. Unlock the VIP Lounge and open your Seaside Branch. (121 kr) | `Hire Your Crew & Expand Fast` (28 kr) | `Free 3D Cafe Simulator` (22 kr) |

### 4.2 TikTok Ads & YouTube Shorts

| Varyant | Dil | Ad Text (TikTok Max 80 Kr Önerilen / 100 Kr Sınır) | Display Name (Max 40 Kr) |
|---|---|---|---|
| **T1 (Kriz Kancası)** | **TR** | Masalar bulaşık dolu, kapıda sıra bekliyor! Tepsini kap ve salonu kurtar. (73 kr) | `Kafe Caddesi: Kafe & İşletme` (28 kr) |
| **T2 (Süpürge ASMR)** | **TR** | Kirli kafe zeminini elektrikli süpürgeyle tek geçişte silip anında nakit kazan. (79 kr) | `Kafe Caddesi: Kafe & İşletme` (28 kr) |
| **T3 (Sahil Büyüme)** | **TR** | 2 masalı çay ocağından VIP Salona ve Sahil Şubesi'ne uzanan kafe zinciri kur. (77 kr) | `Kafe Caddesi: Kafe & İşletme` (28 kr) |
| **T1 (Crisis Hook)** | **EN** | Tables are stacked with dishes and the queue is full! Grab your tray and save it. (81 kr / 100 max) | `Cafe Avenue: Idle Coffee Shop` (29 kr) |
| **T2 (Vacuum ASMR)** | **EN** | Sweep floor grime in one pass with your powered vacuum and earn instant cash. (77 kr) | `Cafe Avenue: Idle Coffee Shop` (29 kr) |
| **T3 (Seaside Scale)** | **EN** | Grow a 2-table corner tea bar into a VIP Lounge and sunny Seaside Branch. (73 kr) | `Cafe Avenue: Idle Coffee Shop` (29 kr) |

---

## 5. Yanlışlanabilir (Falsifiable) A/B Test Hipotezleri

> **Kural (`@ad-creative`):** Bir test hipotezi yanlışlanabilir olmalıdır: ölçülecek metriği, hangi kontrol grubuna karşı kıyaslandığını, hedef kitleyi ve beklenen değişim yönünü/büyüklüğünü açıkça belirtmelidir.

| Test Kodu | Değişken (Tek Değişken Kuralı) | Kontrol Grubu (A) | Test Varyantı (B) | Birincil Metrik & Örneklem Eşiği | Yanlışlanabilir Hipotez (Falsifiable Hypothesis) |
|---|---|---|---|---|---|
| **UA-AB-01** | **İlk 3 Saniye Kancası (Hook Angle)** | **Senaryo 5** (Standart Ürün Servisi / Büyüme açılışı — `reklam-full2` referansı) | **Senaryo 2** (Yakın plan **Elektrikli Süpürge ASMR** ile kirli zemini tek geçişte silme açılışı — `H02`) | **3-Second Thumb-Stop Rate (Hook Rate)** *(Min. 5.000 gösterim / varyant)* | Meta Reels ve TikTok soğuk (broad 18–34) kitlelerinde, ilk 3 saniyede **Elektrikli Süpürge ASMR (`H02`)** açılışı kullanmak, standart çay servisi açılışına kıyasla **3-Second Thumb-Stop Rate** metriğini en az **+%22** artıracaktır (temizlik/düzen görsel kontrastı ilk karede daha yüksek okunaklılık sağlar). |
| **UA-AB-02** | **Anlatım Yapısı (Fail/Win vs. Doğrusal Akış)** | **Senaryo 1 (Yalnızca Win)** (Oyuncunun hiç hata yapmadan masaları temizleyip servis yaptığı doğrusal 25 sn video) | **Senaryo 1 (Fail → Rewind → Win)** (İlk 8 saniyede kirli masa yüzünden müşteri kaçırıp, geri sararak doğru sıralamayla kurtarma) | **CTR (Bağlantı Tıklama Oranı) & IPM (Bin Gösterim Başına Kurulum)** *(Min. 10.000 gösterim / varyant)* | Kayıptan kaçınma ve "ben daha iyi oynarım" dürtüsü nedeniyle, **Fail → Rewind → Win** kurgusu doğrusal başarı kurgusuna kıyasla **CTR**'ı en az **+%18**, **IPM**'i ise en az **+%15** yükseltecektir. |
| **UA-AB-03** | **Ses Tasarımı (Saf ASMR SFX vs. Türkçe/İngilizce VO)** | **Senaryo 2 (Seslendirmeli / VO)** (Üstte anlatıcı sesin mekanikleri açıkladığı sürüm) | **Senaryo 2 (Saf ASMR SFX — Konuşmasız)** (Yalnızca süpürge, porselen, nakit akışı ve branda açılış seslerinin öne çıkarıldığı sürüm) | **Average Watch Time (Ortalama İzlenme Süresi) & Hold Rate (15. sn tutunma)** *(Min. 5.000 gösterim / varyant)* | TikTok ve Instagram Reels yerleşimlerinde **Saf ASMR SFX (konuşmasız)** sürüm, seslendirmeli sürüme kıyasla **15. saniye Hold Rate** oranını en az **+%20** artıracak ve **CPI (Kurulum Başına Maliyet)** değerini **-%12** düşürecektir. |
| **UA-AB-04** | **Orta-Geç Oyun Vaadi (Tek Şube vs. Sahil Şubesi Gösterimi)** | **Senaryo 4 (Yalnızca Köşe Şubesi)** (25 saniyenin tamamının Köşe Şubesi içinde geçtiği kurgu) | **Senaryo 4 (Köşe + 18. sn Sahil Şubesi Geçişi)** (18. saniyede turkuaz tenteli Sahil Şubesi ve dondurma menüsünün gösterildiği kurgu) | **CVR (Tıklamadan Mağaza Kurulumuna Dönüşüm) & D1 Retention** *(Min. 300 kurulum / varyant)* | Videonun son üçte birlik bölümünde **Sahil Şubesi**'ni göstermek, oyunun ölçeğini kanıtlayarak mağaza sayfası **CVR** oranını en az **+%14** artıracak ve gelen kullanıcıların **D1 Retention** oranında **+%5** iyileşme sağlayacaktır. |
| **UA-AB-05** | **Meta Ads Statik/Video Başlık Çerçevelemesi (Gelir Çarpanı vs. Otomasyon)** | **M1 Başlığı:** *"Kendi Kafe İşletmeni Büyüt"* (Genel tycoon vaadi) | **M3 Başlığı:** *"Ekibini Kur, Sahil Şubesini Aç"* (Somut otomasyon + hedef vaadi) | **CPA / CPI (Kurulum Maliyeti)** *(Min. $150 harcama / varyant)* | Meta App Install kampanyalarında somut ekip ve ikinci şube hedefini belirten **M3 başlığı**, genel **M1 başlığına** kıyasla **CPI** maliyetini en az **-%10** aşağı çekecektir. |
