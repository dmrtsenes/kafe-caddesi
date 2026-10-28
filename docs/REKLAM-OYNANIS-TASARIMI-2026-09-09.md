# Reklam görünümünün oynanışa uygulanması — 9 Eylül 2026

`reklam.mp4` 25 saniyelik referans olarak incelendi. Önceki ana oyun uyarlaması aynı renk ailesini kullanıyordu; videodaki özel mobilya, cam vitrin ve mimariyi kullanmıyordu. Bu çalışmada videonun geometri ve malzeme üreticileri normal oyunla paylaşılır hale getirildi.

## Uygulanan tasarım

- `src/world/PremiumDesign.ts`: videodaki ahşap ve yeşil/kiremit döşemeli koltuklar, yuvarlak/kare kaideli masalar, çiçekli merkez parçaları, taş üstlü ceviz tezgâhlar, POS, pirinç çerçeveli cam vitrinler, beş üretim makinesi ve temizlik kovası. Stüdyo ve oyun aynı mobilya işlevlerini çağırır.
- `src/world/PremiumArchitecture.ts`: videonun arka bar panosu, menü ve aydınlatma, cam cephe parçaları, saksı, duvar panosu ve lounge lambaları. Arka bar normal oyundaki mevcut arka duvara sığdırıldı. Salon ve bahçe kapılarının önüne cam veya kolon konulmaz.
- Açık terrazzo ana zemin, sakin gri çalışma zemini, ceviz lounge/oda döşemesi ve pirinç eşikler. Eski ana salon halısı ve yinelenen arka bar tabelaları kaldırıldı.
- `src/data/cafePresentation.ts`: oyunun ve premium stüdyonun ortak güneş, dolgu, karşı ışık ve pozlama ayarları.
- Beş vitrin ve iki kasa, videodaki yatay aralıklara getirildi. Beş üretim makinesi tek sırada; tuvalet ve sarf istasyonları arka servis sırasına taşındı. Personel alım noktası yeni müşteri sıralarına göre yerleştirildi.
- HUD yüzeyleri koyu yeşil ve pirinç tonlarına uyarlandı. Oynanış göstergeleri, menüler ve dokunma kontrolleri çalışmaya devam eder.

## Oynanış uyarlamasının sınırı

Görsel parçalar videodan taşındı; normal oyun, videonun dokuz masalı çekim haritasına çevrilmedi. Köşe'nin iki ek odası, VIP kotu, yan bahçeler, 12 masası, servis tesisleri ve aşamalı satın almaları devam eder. Dolayısıyla genel kat planı ve serbest takip kamerası, videodaki hazırlanmış kadrajlarla piksel piksel aynı değildir. Filmdeki kurgu yazıları ve kamera kesmeleri oynanışın üstüne bindirilmez.

Masalar mevcut servis düzlemine (1,00 birim) ve gerçek çarpışma ayak izlerine oturtuldu. Tam dolu vitrinlerde uzun içeceklerin cam kapağın altında kaldığı ölçüldü; görünen iki sıradan fazla stok gerçek envanterde ve doluluk göstergesinde tutulur. Yeni görsellerde stok boşalması, üretim çıktısı, kasa parası, kilit/açılma, kirli tabaklar ve satın alınmış masa/zemin kaplamaları çalışır. Kayıt şeması, istasyon kimlikleri, fiyatlar ve şube açılımları değiştirilmedi. Karakter seçimi mevcut geliştirme/üretim davranışını korur.

## Doğrulama

- 251 otomatik test geçti; TypeScript ve üretim derlemesi geçti.
- İki şubede erken/orta/tam açık durumları kapsayan 20 kadrajda yerleşim hatası ve tarayıcı istisnası yok.
- 18 masa, 496 ürün yerleşimi, tabla ve masa numarası teması doğrulandı.
- 432 servis/temizlik örneğinde sıfır kaçırma; ayrıca 72 masa döngüsü, 28 kova kontrolü, nakit tahsilatı ve karma vitrin siparişleri geçti.
- 320×568, 390×844 ve 844×390 ekranlarda menüler, metin taşması, 44 px dokunma alanları, odak, satın alma ve canlı ekran döndürme kontrolleri geçti.
- Nihai üretim paketinde Türkçe ve İngilizce 15'er dakikalık hızlandırılmış oyun: sırasıyla 49/42 servis, 19/22 temizlik, 19/18 yer temizliği; iki dilde de görev 10'a ulaşıldı. Kayıt yükleme ve her iki şubenin tamamen açık yolları geçti. Bunlar simülasyon süresidir, fiziksel telefon FPS ölçümü değildir.
- Masa kozmetiği önizleme/iptali ve vitrin/üretim çıktısı görünürlüğü ayrı kontrol edildi. Görsel karşılaştırma için yalnız boş, geçici tarayıcı oturumunda bellekte ileri aşama hazırlandı. Bu görsel araç oyuncu kaydı yazmaz.
- Web ve Android varlıkları kontrol edildi. Release APK imzası doğrulandı. Debug APK, imzalı release APK ve AAB derlendi. Fiziksel telefona bu çalışmada kurulum yapılmadı.

İnce geometrilerin görünmeyen yuvarlatma yüzleri sadeleştirildi; kalıcı geometri/malzeme önbellekleri ve durağan birleştirme kullanıldı. Son telefon masa kadrajı 464 çizim / 174166 üçgen; önceki görünüm 362 / 94082. Görsel ayrıntı maliyeti arttığı için bu rakamlar performansın değişmediği iddiası değildir; mevcut kalite ve ısıya göre sınırlama sistemi korunur.

## Çıktılar

- [İmzalı APK](../cikti/FincanSokagi-premium-2026-09-09.apk)
- [AAB](../cikti/FincanSokagi-premium-2026-09-09.aab)
- [Debug APK](../cikti/FincanSokagi-premium-debug-2026-09-09.apk)
- [Dosya özetleri](../cikti/FincanSokagi-premium-2026-09-09-SHA256.txt)
- [Yakın görünüm](../kafe-premium-oynanis.png) ve [genel görünüm](../kafe-premium-oynanis-genel.png). İleri aşama görselleri hazırlanmış geçici sahnedendir.

Kanıtlar `.devshots/reklam-game-parity/` altında: `presentation.json`, `layout-report.json`, `surface-report.json`, `service-report.json`, `phone-report.json`, `unit-tests.log`, `android-build.log` ve `production/`.

Kaynak `reklam.mp4` değiştirilmedi. SHA-256: `346985f3c3c9255d49cd74ba7d88b39e2829c871dff33d975005202e83dec0e9`.
