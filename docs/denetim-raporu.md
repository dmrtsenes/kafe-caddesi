# Fincan Sokağı — kalite denetimi

Tarih: 15 Ekim 2026, ikinci kontrol aynı gün 13:20. Sürüm: `fincan-sokagi` 1.0.4. Motor: Three.js 0.169.0, Vite 5.4.10, TypeScript 5.6.3, Capacitor 8, AdMob.

İkinci kontrol, sabahki rapordan sonra değişen kamera, arka bar, hız fiyatları, telefon HUD’u ve çevrimdışı nakiti yeniden okudu. 390×844 ve 1440×900 kareleri Türkçe arayüzle tekrar alındı. Kaynak bu turda da değiştirilmedi.

Ölçüm ortamı: headless Chrome, SwiftShader, `devicePixelRatio` 1. Çözünürlükler 360×640, 390×844 ve 1440×900. Sahne, öğreticinin ilk adımı (adım 0, kasa ₺0, tek karakter). Dolu kafe, gerçek telefon GPU’su ve üretim derlemesi ölçülmedi. Süre tahminleri `[tahmin]`, sabitlerden yapılan aritmetik `[hesap]`, tarayıcıdan gelen sayılar `[ölçüm]`.

Headless tarayıcının dili İngilizceydi. Ekrandaki “Take your first order / Guide / COFFEE” yazıları bu yüzden İngilizce. Türkçe dizgiler `tr()` kaynağında duruyor; Türkçe taşma bu karelerde doğrulanmadı.

## 1. Genel puan

| # | Başlık | Puan | Gerekçe |
| --- | --- | --- | --- |
| 1 | Oynanış hissi ve akış | 7 | Öğretici tek fiil söylüyor ve karakter okunuyor; salon hâlâ boş, alt kenarda bir kafa kırpılıyor. |
| 2 | Görsel kalite | 6 | Fiyat levhası kalkmış, düşük poli dil tutarlı; açılış zemini gri ve geniş. |
| 3 | Üst üste binme | 7 | Sabahki fiyat şeridi ve ₺1.100 kartı ilk karede yok. Alt kenar hâlâ bir baş kesiyor. |
| 4 | Performans | 6 | Açılış 51–92 draw call. Dolu kafe ve gerçek telefon hâlâ ölçülmedi. |
| 5 | Yazı ve UI | 7 | Telefonda üstte para ve tek hedef. Seri çipi gizli. 40 px’lik hedefler sabah ölçümünde duruyor. |
| 6 | Bulanıklık ve kırpma | 6 | Kuzey menüsü kadrajdan çıktı. Alt kenar ve geniş ekranda sağ tabela hâlâ kesik. |
| 7 | Ekonomi | 7 | İlk masa ucuz. Sahil hızları indi (meyve 420 bin, kokteyl 750 bin). Duvar küçüldü, bitmedi. |
| 8 | Kirlenme | 7 | Toz seyrek ve tavanlı; leke ve tuvalet geç oyunda asıl yük, ceza spirali değil. |
| 9 | Reklam | 7 | Ödül yalnız izlenince veriliyor ve kapı değil; ilk beş dakikada teklif görünmüyor. |
| 10 | Bağlılık | 7 | Hedef, günlük, festival ve bahşiş duruyor. Açılış artık bir fiil gösteriyor; ilk ödül hâlâ ilk sipariş. |

Ortalama: **6.7 / 10**. Sabah 6.0’dı. Fiyat şeridi, karakterin üstündeki kahve kartı ve çevrimdışı nakdin ikinci kez tam yazılması düzelmiş. Kalan boşluk: boş salon, alt kenar kırpması ve sahil hız duvarı.

## 2. Bölümler

### 1. Oynanış hissi ve akış

Mevcut durum. Hareket kapısı kısa: hızlanma 0,075 sn, alma 0,10 sn, ped 0,20 sn, süpürge 0,75 sn (`src/data/balance.ts` `player`). Öğretici 7 adım: sürükle, sipariş al, çayı al, masaya götür, parayı topla, masayı hazırla, masa veya kahve seç (`src/sim/Tutorial.ts` 55–118). Her adımın fiili ve oku var.

[ölçüm, 13:20, Türkçe] 390×844: “₺0”, “İlk siparişini al 0/1 +₺30”, “Rehber 1/7 Ekrana bas ve sürükle”, ok “KASAYA YÜRÜ”. Karakter ortada ve okunuyor. 1440×900 aynı cümleyi gösteriyor, salon daha geniş. Geri bildirim katmanı kodda var (sikke uçuşu, halka, emote) ama ilk karede henüz tetiklenmiyor.

Portre kadraj artık mesafe 21, fov 35 (`CameraFraming.ts` `portraitCameraSettings`). [ölçüm] canlı sahnede `framing.distance` 21, fov 35, pitch 48. Sabahki 27,5 / 40 yok. Kahve kartı (ped −1,4 / −6,6) bu ilk karede görünmüyor.

Sorun. 1440×900 hâlâ geniş boş zemin. Her iki karede de alt kenarda bir başın tepesi kesik. İlk müşteri, oyuncu kasaya varana kadar yok. Ölü zaman öğreticiden sonra, tek masalık döngüde.

Önerilen çözüm. Portre bakışı karakteri ve kasayı doldursun; sonraki ped karakterin üstünde değil, yürüyünce görünsün. İlk 60 saniyede tek fiil kalsın. Para, hedef ve o fiil dışında üstte bir şey olmasın.

### 2. Görsel kalite ve mekan dekorasyonu

Mevcut durum. Tek palet, ahşap/pirinç/yeşil, düşük poli karakter, gölge ve zemin dokusu var. Köşe için ayrı taş zemin, ceviz bank ve `createPremiumBackbar()` kuruluyor (`src/world/Environment.ts` 2021–2025, `src/world/PremiumArchitecture.ts`). Tavan bilinçli yok; kirişler kadrajı kestiği için geri alınmış (`Environment.ts` 1847–1859).

[ölçüm, 13:20] 390×844 kasayı ve karakteri dolduruyor; arka bar yeşil karo, fiyat yazısı yok. 1440×900’ün ortası hâlâ düz gri zemin. Kilitli kanat sağ kenarda “AVLU LAVABOLARI” olarak kesik duruyor.

Sorun. Sanat yönü tutarlı ama açılış “inşaat öncesi plan” gibi. Karakter ve mobilya aynı dilde; ışık düz, vurgu zayıf. My Perfect Hotel yoğunluğu yok.

Önerilen çözüm. Açılışta yalnız bir masa, kasa, semaver ve kısa bir halı görünsün. Kilitli kanat kadrajın dışında kalsın. Işık tek sıcak havuz olarak kasada toplansın.

### 3. Üst üste binen nesneler

Mevcut durum. Kalabalık ayrıştırması var: gövde çapı 0,86 (`src/sim/CrowdSeparation.ts` 11–22). Bölme duvarıyla çakışan oda duvarı atlanıyor (`Environment.ts` 1540–1541). Tuvalet karosu parkenin 2 cm üstüne alınmış (`StationView.ts` 2088–2095). Ceviz bank taş zeminden 0,016 yükseltilmiş (`Environment.ts` 2033–2036). Köşe asılı menü grubu sahneye eklenmiyor (`Environment.ts` 1884).

Sabahki fiyat levhaları `createPremiumBackbar` içinden çıkmış. Güncel yorum: “no HUD-clipping signs” (`PremiumArchitecture.ts` 95). Duvar yüksekliği 2,65, saçak y 2,54. [ölçüm, 13:20] 390×844 tepesinde fiyat şeridi yok. Kahve kartı da ilk karede yok.

Kalan biniş kadraj kırpması: 390×844 ve 1440×900 alt kenarında bir başın tepesi kesik. Geniş ekranda sağda avlu lavabo tabelası yarıda kalıyor. Dolu salonda karakterlerin iç içe geçmesi bu karede yok; sahnede öğretici aktörü var.

Sorun. Mesh çakışması değil, yakın kenar kırpması.

Önerilen çözüm. Güney `southPad` veya bakış, kapıdan giren başı alt kenarın içinde tutsun. Sağdaki kilitli tabela, kilitliyken kadraj dışına çıksın.

### 4. Performans

[ölçüm] Açılış salonu, headless Chrome, DPR 1, öğretici adım 0:

| Görüntü | Draw call | Üçgen | Doku | Geometri | Program | Kare (ortalama) | p95 | Yığın |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 360×640, sabah | 23 | 13.264 | 53 | 149 | 46 | 5,55 ms | 10 ms | 75 MB |
| 390×844, sabah | 64 | 31.817 | 53 | 148 | 45 | 5,30 ms | 13,3 ms | 67 MB |
| 1440×900, sabah | 51 | 11.062 | 55 | 184 | 46 | 6,29 ms | 16,5 ms | 61 MB |
| 390×844, 13:20 | 51 | 32.315 | — | — | — | — | — | — |
| 1440×900, 13:20 | 92 | 43.977 | — | — | — | — | — | — |

Aynı 1440×900 sahnede CDP CPU kısılması, SwiftShader üzerinde:

| Kısma | Ortalama kare | Yaklaşık FPS |
| --- | --- | --- |
| 4× | 101 ms | 9,9 |
| 6× | 236 ms | 4,2 |

Bu FPS bir telefon ölçümü değildir. Yazılım raster’ı + CPU kısması, GPU’su olan bir telefonda bu kadar kötü olmak zorunda değil. Kısma doğrusal da değil: 5,5 ms’lik kare 4× ile 22 ms olmalıydı, 101 ms oldu. Ana iş parçacığı bu kurulumda tıkanıyor; kaynak olarak telefon GPU’suna yazılamaz.

Kod bütçesi (`src/core/Quality.ts` 55–91, `composeQuality` 128–139):

| Kademe | DPR tavan | Piksel bütçesi | Gölge | Gölge haritası | Hedef kare |
| --- | --- | --- | --- | --- | --- |
| Yüksek | 2,0 | 2.200.000 | açık | 1024 | 60 |
| Orta | 1,5 | 1.350.000 | açık | 1024 | 60 |
| Düşük | 1,35 | 750.000 | kapalı | 0 | 30 |

Isı 4’te gölge kapanır. FXAA ve outline kapalı. Düşük kademe 30 fps (`framePolicy.ts` `defaultFpsPreference`). Müşteri tavanı üç kademede de 26; görünen müşteri 24 / 16 / 10. Simülasyon hızı kaliteyle değişmiyor.

[hesap] 390×844 yüksek kademe: 390×844×4 = 1,32 milyon piksel, bütçe 2,2 milyon, yani DPR 2 sığıyor. Düşük kademede tavan 1,35. Bu hesap cihazdan ölçülmedi.

Sorun. Açılış ucuz çünkü salon boş. Dolu köşe, sahil, 26 müşteri, 1536 gölge haritası ve DPR 2 bu oturumda yok. 4×/6× çöküşü, dolu sahnede ana iş parçacığının payını ayrıca ölçmeden “telefon kasar” demeyi haklı çıkarmaz; “boş sahnede bile yazılım çizimi kısılınca kare düşüyor” der.

Önerilen ayar. Düşük: gölge kapalı, DPR ≤ 1,35, görünen müşteri 10, hedef 30. Orta: gölge 1024, DPR 1,5, görünen müşteri 16, hedef 60, ısı 2’de 30. Yüksek: gölge 1024’te kalsın; DPR 2, piksel bütçesi 2,2 milyon. Post-process eklenmesin.

### 5. Yazı ve UI okunabilirliği

Mevcut durum. Telefon kuralı `ui.css` 3484–3613: marka gizli, kafe sayaçları gizli, tempo gizli. Gelir, festival ve seri çipi hedef satırına sıkıştırılmış. Güvenli alan `env(safe-area-inset-*)` ile var. Ödül “İzle” düğmesi en az 44 px (`.adchip-go`). Kapatma 44×44 (`.adchip-x`).

[ölçüm, sabah] Öğreticide 265–293×40 px’lik bir çubuk ve 41×41 kapatma vardı. 44 px altına iniyor. Bu turda düğme boyutu yeniden ölçülmedi.

[ölçüm, 13:20] Telefon üstü iki satır: “₺0” ve “İlk siparişini al”. Marka gizli (`.brand` 3502). Kafe sayaçları ve seri çipi gizli (`ui.css` 3566–3574). “Rehber”, “Ekrana bas ve sürükle”, “Atla” Türkçe karakterleri taşıyor, taşma görünmedi.

Sorun. Festival ve gelir rozetleri hâlâ 12–12,5 px (`ui.css` 3534, 3585). Öğreticide görünmüyorlar; sonra aynı satıra dönerler.

Önerilen çözüm. Portre üstünden fiyat levhasını çıkar. Dokunulan her kontrol en az 44 px. Telefonda üstte yalnız para, x2 ve tek hedef kalsın; gelir, festival ve seri ayrı satır olmasın.

### 6. Bulanıklık ve görüntü kaybı

Mevcut durum. DPR, piksel bütçesiyle kısılıyor (`Quality.ts`). Yakın düzlem mesafenin 0,3 katı, 0,5–8 arası (`Scene3D.ts` 40–42); sabit 0,5’in 16 bit derinlikte z-fight yaptığı not edilmiş. Sis 55–130, far 138. FXAA yok. Headless ölçümde tuval CSS ile aynı pikseldeydi (DPR 1), yani bu oturum bulanık tuval göstermedi ve telefon keskinliğini de kanıtlamadı.

[ölçüm, 13:20] Kuzey fiyat levhası yok. Yeni kırpma alt kenarda: bir başın tepesi kadrajın dışında. 1440×900 sağ kenarında avlu tabelası yarıda. Yön değişimi denenmedi. `Scene3D.ts` 571 pitch’i hâlâ `BALANCE.camera.pitch` okuyor; `framing.pitch` kullanılmıyor. İkisi de bugün 48, görüntü sapmıyor. Portre pitch’i ayrı ayarlanırsa sahne onu yok sayar.

Sorun. Üst şerit gitti. Alt ve sağ kenar hâlâ kesiyor.

Önerilen çözüm. Güney payını, kapıdaki baş kadrajda kalacak kadar aç. Üretimde 390×844 ve DPR 2 ile keskinlik karesi alınmadan “bulanık” denmesin.

### 7. Ekonomi ve denge

Başlangıç parası 0 (`GameState.ts` `prestigeStartMoney`, prestij yokken 0). [ölçüm] açılışta ₺0.

Fiyatlar (`items.ts`): çay 25, sütlü kahve 82, tost 210, vafıl 520, buzlu kahve 1.150, sahilde meyve 2.400, dondurma 3.600, sütlü kokteyl 5.200. Masada çarpan 1,5, paket 0,6, masa bahşişi 0,35 (`balance.ts` `orders`). Kasaya düşen net, bu oturumda bir satış oynanarak ölçülmedi.

Müşteri: taban 4 sn, hazır ürün başına ×0,9, taban 1 sn (`balance.ts` 63–67, `World.ts` 4715). Oturma: masa süresi 11 sn × ürün dwell × arketip (`World.ts` 5359). Çay dwell 0,75 → taban oturma [hesap] 8,25 sn, ±%25.

Bölge fiyatları (`economy.ts`): masa 2 = 300, kahve = 1.100, tost = 3.400, ikinci kasa = 5.000, tuvalet = 9.000, salon odası = 12.500, vafıl = 12.000, buzlu kahve = 26.000, VIP = 48.000, sahil şube = 145.000, dondurma = 210.000, teras = 520.000. Hedef ödülü bölge fiyatının %30’u.

Personel (`staff.ts`): tezgâhtar 400 × 1,85, 6. kişi [hesap] 8.668. Kasiyer 2.600 × 2,05. Komi 9.000 × 2. Kahve ustası 18.000 × 2,15.

İstasyon hızı `taban × 1,52^seviye` (`upgrades.ts` 104–120). Semaver hızı 120. Buzlu kahve hızı artık 180.000; 1. seviye [hesap] 273.600. Sahil meyve hızı 420.000 (şubenin 2,9 katı), dondurma 560.000, sütlü kokteyl 750.000. Sabahki 1,69 milyon ve 2,50 milyon ilk hızlar inmiş.

Süre tablosu. Dakikalar oynanmadı; “[tahmin]” tek masa ve hedeflerin 30+50+70 = 150 ödülüne göre kaba sıradır.

| Eşik | Fiyat | Ne kadar sürer |
| --- | --- | --- |
| İlk üç hedef ödülü | 150 | İlk servis turu, birkaç dakika [tahmin] |
| Masa 2 | 300 | Ödüllerden sonra birkaç çay, ilk 5–8 dk [tahmin] |
| Tezgâhtar | 400 | Masa 2 ile aynı pencere [tahmin] |
| Kahve bölümü | 1.100 | İkinci masayla 10–20 dk [tahmin] |
| Tost | 3.400 | Onlarca servis, onlarca dakika [tahmin] |
| Kasiyer | 2.600 | Tosttan önce alınabilir [tahmin] |
| Sahil şube | 145.000 | Köşe bittikten sonra uzun oturum [tahmin] |
| Meyve hızı, seviye 0 | 420.000 | Şubenin 2,9 katı [hesap] |
| Kokteyl hızı, seviye 0 | 750.000 | Hâlâ en sert makine hızı [hesap] |

Çevrimdışı nakit artık dosyasıyla aynı şeyi söylüyor (`Offline.ts` 4–13). Personel varken en çok 2 saat × %18 kasaya yazılır (`Game.ts` 371–379). Reklam, aynı tutarı ikinci kez değil, çarpanın farkını ekler: `lastOfflineCash * (mult - 1)` (`Game.ts` 2861). ×2 izlenirse vardiya toplamda iki kat olur. Personelsiz oyuncu yalnız raf stoğu görür.

Sorun. İlk yarım saat adil. Duvar sahil hızlarında küçüldü ama kokteyl 750 bin hâlâ uzun. Geniş ekran kamera testi bu mesafeyi kilitlemiyor: `CameraFraming.test.ts` 1920×1080 için mesafe 16 bekliyor, kod 14,5 veriyor. Test 2/3 başarısız. Bu oyuncuya görünmez; kilit bozulmuş.

Önerilen çözüm. Kokteyl ilk hızını o makinenin 30–40 dakikalık gelirine çek. Kamera testini 14,5’e güncelle. Çevrimdışı çarpana dokunma.

### 8. Kirlenme

Sayılar (`balance.ts` `dirt`, `vacuum`):

| Sabit | Değer |
| --- | --- |
| Bulaşık / misafir | 1, masa tavanı 5 |
| Toplama | 0,3 sn |
| Kalkınca leke | %15, serviste %4, tavanda 14 leke |
| Leke silme | 0,92 sn |
| Toz aralığı | 60–90 sn, aynı anda en çok 3 |
| Ovma | 2,8 sn, paspas 5,5 sn |
| Hijyen kir ağırlığı | 2,0 |
| Zorluk, her şey açıkken | sabır ×0,76, kir ×1,28 |

Temizlik para verir (bulaşık ×0,18, leke ×0,30, ortalama menü fiyatı). Hijyen 0,85–1,25 bandında bonus; dibe ceza spirali değil. Süpürge ve leke oku, ilk siparişten önce kapalı (`Game.ts` HUD’da `orders > 0` değilse leke ve kir sayacı 0).

Sorun. Erken oyun temiz ve doğru. Geç oyunda 14 leke + tuvalet sarfı (kullanım başı 0,5, boş tuvalet hijyeni 0,45/sn) asıl yük. Toz artık boğmuyor.

Önerilen aralık. Toz tavanı 3, aralık 60–90 sn kalsın. Aynı anda leke 8–10 yeter; 14 geç salonu ikinci bir işe çevirir. Ovma 2,5–3,5 sn. Hijyen çarpanı 0,9–1,25 dışına çıkmasın.

### 9. Reklam

Mevcut durum. Ödül yalnız `Rewarded` olayında (`AdMobProvider.ts` 262–287). Erken kapatma ödül vermez. Yükleme hatasında yuva boşalır ve yeniden denenir (563–566). Hazır değilse “Reklam şu an hazır değil” ve sonraki teklif 30 sn (`Game.ts` 2677–2679). Sağlayıcı yoksa buton görünmez (`Ads.ts` 209–215).

Yerleşimler süre veya tek sefer: mutlu saat ×2, adım 5 dk, tavan 20 dk; robot 5 dk; depo dolumu; günlük ×2; nakit (300 sn gelir, taban ₺1.200, ped %60–%90); usta 5 dk; akın 150 sn; tamir sigortası 5 dk; bahşiş ×3, 5 dk; yatırımcı; dönüş satışı stokun %50’si ×2 veya ×3. Bölge reklamı, ödenenin %50’si dolmadan “bitir” olmaz (`ZONE_FINISH_MIN_PAID` 0,5). Daha az ödendiyse reklam en fazla %50 yazar (`Game.ts` 2879–2887).

Geçiş: ilk 60 sn yok, aralık 90 sn, ödülden sonra 60 sn yok, oturumda en çok 4, ilk 8 hedef bitmeden yok (`Ads.ts` 332–337, 382–400).

[ölçüm] İlk karede x2 yok. Öğretici bitmeden teklif çipi açılmıyor. Çip ömrü 35 sn, sonraki aralık 80±15 sn (`Game.ts` 1271, 1320).

İzlenme neden düşük kalır. İlk beş dakika teklif yok. Sonra teklif 80 saniyede bir, 35 saniye durup kayboluyor. Birçok yerleşim var ama hepsi durumlu; oyuncu “ne kazanacağım”ı her seferinde yeniden okumak zorunda. Web üretimde sağlayıcı yok, yani tarayıcıda izleme sıfır. Bu dürüst. Aldatıcı bir kapı yok.

İzlenmeyi artıracak dürüst değişiklikler. Öğretici bitince tek bir çip: üstünde süre ve net ödül (“5 dk ×2”). İzlemeyen aynı hızda oynasın. Çipi 80 saniyede bir değil, kasa toplama ve hedef bitirme anına bağla; o an zaten bir sevinç. Geçiş reklamını 8. hedeften önce açma. “İzlemezsen kapanır” duvarı koyma.

### 10. Bağlılık ve dopamin

Var olanlar. Kısa: sipariş parası, bulaşık parası, hedef şeridi, sikke uçuşu. Orta: 36 hedeflik zincir, sonra sonsuz hedefler (`goals.ts`). Günlük merdiven 3–16 dakikalık gelir, taban ₺400 (`Daily.ts` 47–51). Haftalık festival çipi. Bahşiş: 7 satışta bir, günde en çok 8, en az 40 sn ara (`FoundChange.ts`). Servis serisi 4 vuruş. Olaylar: yoğunluk, kaçak, teslimat, arıza, fenomen (`balance.ts` `events`, ısınma 120 sn). Bildirim modülü pakette (`@capacitor/local-notifications`); bu denetim tetik metnini oynatmadı. Çevrimdışı: raf dolumu herkese, nakit yalnız personelli kasaya.

Eksik ya da zayıf. Açılışın ilk dakikasında ödül yok; ilk sevinç ilk sipariş. Seri, telefonda ayrı bir çip olarak tasarlanmış (`ui.css` 3577) ve üst yığını kalabalıklaştırıyor. Sürpriz bahşiş seyrek; oyuncu kuralı görmeden “bazen para çıkıyor” der. Uzun vadede sahil hız duvarı ödül döngüsünü keser.

Seviye. Sistem listesi profesyonel. Açılış hissi basit: boş zemin, bir cümlelik rehber, ekranın ortasında ₺1.100. İkisi aynı anda doğru değil. Puan, açılışın sistemi yemesinden 6.

## 3. Yol haritası

P0, hemen.

| Madde | Etki | Efor |
| --- | --- | --- |
| Alt kenarda kesilen başı kadraja al | Yüksek | S |
| Geniş ekranda boş zemini kıs | Yüksek | M |
| Açılışta kadrajı kasa + karakterle doldur | Yüksek | M |
| 40 px’lik kontrolleri 44 px yap | Orta | S |

P1, önemli.

| Madde | Etki | Efor |
| --- | --- | --- |
| Kokteyl ve dondurma ilk hızını 30–40 dk gelirine çek | Yüksek | M |
| Kamera testini mesafe 14,5 ile eşle | Düşük | S |
| Ödül çipini kasa ve hedef anına bağla, tek cümle ödül | Yüksek | M |
| Leke tavanını 8–10 yap | Orta | S |
| Dolu köşe ve sahilde draw call / üçgen ölç | Orta | M |

P2, cila.

| Madde | Etki | Efor |
| --- | --- | --- |
| Açılış ışığını kasada topla | Orta | M |
| Üretim derlemesinde DPR 2 keskinlik karesi | Düşük | S |

## 4. En yüksek etkili 10 değişiklik

1. Alt kenarda kesilen başı kadraja al.
2. Geniş ekranda boş zemini kadraj dışında bırak.
3. Öğretici bitince ödülü bir cümleyle, kasa anına bağla.
4. Kokteyl ve dondurma ilk hızını 30–40 dakikalık gelire çek.
5. Festival ve gelir yazısını 12 px’ten çıkar.
6. 40 px’lik kontrolleri 44 px yap.
7. Leke tavanını 8–10 yap.
8. Kilitli avlu tabelasını geniş kadrajın kenarından çek.
9. Kamera testini güncel 14,5 mesafeye bağla.
10. Dolu sahnede gerçek telefon FPS’ini ölç.

## 5. Doğrulanamayan noktalar

- Gerçek telefon GPU’su, termal ve pil ölçülmedi. 4×/6× sayıları SwiftShader + CDP kısmasıdır.
- Dolu kafe, 26 müşteri ve sahil ölçülmedi. 13:20 açılışı 51 ve 92 draw call, 32 bin ve 44 bin üçgen. Yüksek gölge haritası artık 1024.
- Üretim `vite build` çalıştırılmadı. Geliştirme sunucusu 127.0.0.1’de uzun süre yanıt vermedi; ölçüm `localhost` cevap verdikten sonra alındı.
- 13:20 kareleri Türkçe. Sabah kareleri headless İngilizceydi; o fiyat şeridi ve kahve kartı güncel açılışta yok.
- `CameraFraming.test.ts` iki testte kırmızı: 1920×1080 mesafe 14,5, test 16 bekliyor.
- Yön değiştirme, arka plandan dönüş ve güvenli alan çentiği denenmedi.
- Karakterlerin kalabalıkta iç içe geçmesi görülmedi; sahnede tek aktör vardı.
- Bildirim izni ve metni oynatılmadı.
- Reklam izlenme oranı ölçülmedi. Düşük kalacağı çıkarımı, ilk karede teklif olmaması ve 80 sn’lik çip aralığındandır.
- “Kaç dakika” tablosundaki süreler satış döngüsü oynanmadan verilmiş tahminlerdir. Fiyatlar kod sabitidir.
