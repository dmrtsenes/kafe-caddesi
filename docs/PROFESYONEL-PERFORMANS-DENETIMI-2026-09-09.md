# Profesyonel performans denetimi — 9 Eylül 2026

> **10 Eylül karakter kapsamı düzeltmesi:** Kullanıcının korumak istediği yerel karakter seti CleanIt idi. Bu rapordaki karakter kıyaslamaları ve aşağıdaki APK/AAB dosyaları Quaternius setini kullanır; bunlar kullanıcının mevcut karakterleri için doğrulanmış kazanç veya onaylanmış görünüm olarak sunulmamalıdır. Web açılırken yanlışlıkla bu paketlenmiş sürüm gösterildi. Yerel web sunucusu tekrar mevcut CleanIt karakterlerini kullanan geliştirme sürümüne geçirildi ve oyuncunun doğru paketten yüklendiği doğrulandı. Android paketleri bu düzeltmeyle yeniden üretilmedi.

Önceki optimizasyonlar önemli tekrarları azaltmıştı; denetim, düzeltilebilir doğruluk sorunları ve aynı görünümü daha az bellekle üretme fırsatı buldu. Bu turda model ayrıntısı, animasyon, müşteri/personel sayısı, oyun hızı, ekonomi ve kullanıcının seçtiği kalite bütçeleri azaltılmadı.

## Eş koşullarda ölçülen karakter kazancı

Yayın Quaternius modelleri, sabit rastgelelik tohumları ve aynı 48 karakter kullanıldı. Geometri artık her karakter için kopyalanmıyor: yedi modelin indeksli gövdesi bir kez hazırlanıyor; karakterin kendi küçük renk paleti ve iskeleti ayrı kalıyor. Kıyafet renkleri ortak shader üzerinden uygulanıyor.

| Ölçüm | Önce | Sonra |
| --- | ---: | ---: |
| Canlı karakter | 48 | 48 |
| Benzersiz geometri | 48 | 7 |
| Geometri tamponları | 44.679.104 bayt | 5.404.221 bayt |
| Oluşturma medyanı | 3,2 ms | 0,5 ms |
| Oluşturma %95 değeri | 4,2 ms | 0,6 ms |

Geometri tamponlarında %87,9 azalma ölçüldü. Bu **toplam uygulama RAM'i veya telefon FPS artışı değildir**. Süreler masaüstü Chrome/RTX 5070 ortamındadır. Yedi model ve sekiz rolü kapsayan 12 örneğin beşer pozu (bekleme, yürüme, oturma, taşıma, çalışma) karşılaştırıldı: **60 görüntüde piksel farkı sıfır**, el konumları ve gövde ölçüleri aynı. Aynı geometriyi paylaşan bir karakter silindiğinde diğerinin görüntüsü de değişmedi.

Kanıt: `.devshots/character-optimization/reference/result.json` ve `final/result.json`; tekrar aracı `tools/character-benchmark.mjs`. Referans önceki karakter uygulamasından alındı; aynı adla yeniden üretmek referansı değiştireceğinden yeni denemelerde farklı `--phase` kullanılmalı.

## Düzeltilen doğruluk ve çalışma yükü sorunları

- **Kare tavanı:** Önceki döngü, çok hızlı ekranlardaki kısa callback aralıklarını dışlayıp ekran hızını yanlış tahmin edebiliyordu. 30 FPS seçiliyken gerçek zamanlı testte yaklaşık 43,8 FPS çizdi. Yeni zamanlayıcı gerçek zaman son tarihleriyle sınırı uygular; kaçırılan karelerden sonra telafi çizimi patlaması oluşturmaz. Ekran hızı tahmini hızlı örnekleri de kapsar; örnekleme tamponları tekrar kullanılır. 60–240 Hz, 30/45/60 FPS, zamanlama sapması, duraklama ve değişen tahminler test edildi.
- **Sonradan eklenen ürünler:** Three nesne katmanları çocuklara otomatik miras kalmıyordu. Servis tabakları, taşınan ürünler ve yeni sayaç parçaları önbellekte donabiliyordu. Ürün oluşturulurken hareketli katman atanıyor; masalar, istasyonlar ve toplama noktaları kendi sabit gövdelerini ayrıca önbelleğe alıyor.
- **Statik birleştirme:** Aynalı dönüşümlerde üçgen yönü korunuyor. Çocuk bağlantısı veya özel çizim işlevi olan nesneler davranışlarını kaybetmemeleri için toplu birleştirmeye alınmıyor.
- **Gereksiz karakter kurulumu:** Görsel ayar değişip karakter ayrıntı modu değişmediğinde çalışanların iskeletleri yeniden üretilmiyor. Ürün havuzu dolduğunda atılan nesnelerin örnek çizim tamponları serbest bırakılıyor.
- **Kir dokusu:** Simülasyon çalışmaya devam ediyor; görüntüdeki RGBA baytları değişmediyse aynı kir maskesi GPU'ya tekrar gönderilmiyor.
- **İlk görünme hazırlığı:** Paylaşılan karakter gövdeleri yükleme örtüsü açıkken hazırlanıp GPU'ya yükleniyor. Uzak mimarinin tamamını baştan yüklemek gerekmiyor.
- **Android ısı desteği:** Android 10'a özgü sınıf ve çağrılar iç uygulamada yalıtıldı. Eski sürümler ısı olay desteği olmadan açılabilir; devamlı sıcaklık sorgulaması eklenmedi. Duraklama ve kapatmada dinleyici bırakılıyor.

Önceden bulunan otomatik ısı koruması korunur. Gerçek aşırı ısı halinde geçici piksel/gölge bütçesi düşebilir; bu durumdaki görüntü değişimini “her koşulda sıfır kalite kaybı” olarak sunmuyoruz. Normal seçili kalite üzerinde bu turda yeni bir düşürme yapılmadı.

## Önceki ölçümlerin düzeltilmesi

Eski performans aracının eklediği müşteriler hareketli katmana alınmamıştı; sabit kamera çizim sayıları yapay olarak düşük çıkabiliyordu. Araç düzeltildi. Ayrıca eski 4,22 MB → 2,65 MB / 1,0 ms → 0,8 ms canlı örnekleri aynı karakter modellerinden oluşmadığından güvenilir bir önce/sonra oranı değildir.

Aşağıdaki sayılar düzeltilmiş aracın **güncel durum ölçümüdür**; hatalı eski sayılarla kazanç yüzdesi hesaplanmadı. 390 × 844, cihaz DPR 2, düşük ayar; çizilen 3B piksel 329.160. Tam kafe ölçümüne 24 müşteri ve 8 personel eklenir, örnekleme sırasında simülasyon durur.

| Kamera | Normal çizim | Sabit kamera çizimi | Görünen üçgen |
| --- | ---: | ---: | ---: |
| İlk tezgâh | 47 | 7 | 17.764 |
| Tam üretim | 108 | 39 | 63.438 |
| Masalar | 121 | 40 | 81.190 |
| Salon | 103 | 35 | 73.322 |

Kanıt: `.devshots/premium-performance/professional-checked/profile.json`.

## Doğrulama

- 280 birim kontrolü geçti; TypeScript ve standart Vite üretim derlemesi geçti.
- PBR toplu çizim karşılaştırması, aynalı dönüşüm ve renkli örnek geometriler dahil: piksel farkı sıfır.
- 22 önbellek/doğrudan çizim geçişi: ürün bırakma, değiştirme, temizleme, taşıma, hareket, stok, kurulum ve kilit durumları geçti. En fazla kanal farkı 1/255; 4/255 üstü piksel yok.
- Kalite değişiminde personel karakter referansları korundu. Simüle edilen Android ısı bildirimi ve soğuma sonrası geri dönüş geçti.
- Menüde çizim ve simülasyon durması, ekran dışı nesnelerin geri gelmesi, WebGL bağlam kaybından kurtarma ve 20 karakter oluşturma/silme çevriminde doku sayısının sabit kalması geçti.
- Türkçe ve İngilizce 30'ar dakikalık **hızlandırılmış** gerçek eylem testi geçti. Türkçe: 116 servis, 40 bulaşık, 38 süpürme, 27 masa temizliği; İngilizce: 122 servis, 42 bulaşık, 37 süpürme, 34 masa temizliği. Kayıt/yeniden yükleme ve iki şubenin yerleşim kontrolleri geçti. Bu, telefonda yarım saatlik sıcaklık testi değildir.

## Gerçek zamanlı yük testi

Son üretim derlemesi Chrome'da, 390 × 844 mobil görünümde, düşük ayar/30 FPS tercihiyle ve CDP üzerinden dört kat CPU yavaşlatılarak çalıştırıldı. Tüm kafe alanları açıldı, sekiz personel eklendi ve oyun önce 90 saniyelik simülasyonla dolduruldu. Sonra normal animasyon döngüsü **gerçek 30 saniye** izlendi; doğrudan `tick()` çağrıları FPS ölçümü olarak kullanılmadı.

| Sonuç | Ölçüm |
| --- | ---: |
| Gerçek süre | 30,004 s |
| Sahne çizimi | 849 |
| Ulaşılan FPS | 28,30 |
| Oyun zamanının ilerlemesi | 29,997 s |
| Kare aralığı medyanı / %95 | 35,9 / 37,5 ms |
| 50 ms / 100 ms üstü kare aralığı | 0 / 0 |
| Çizim CPU süresi medyanı / %95 | 4,9 / 5,9 ms |
| Test sonundaki müşteri / personel | 7 / 8 |
| Menüde çizim / simülasyon ilerlemesi | 0 / 0 |
| JavaScript / WebGL hatası | 0 / 0 |

30 FPS üst sınırı artık aşılmadı; bu koşulda tam 30 FPS elde edildiği iddia edilmiyor. Önceki yaklaşık 43,8 FPS sınır aşımı, düzeltme öncesi gerçek zamanlı testin hata çıktısında saptandı. Son rapor `.devshots/premium-performance/professional-device-load/result.json` içindedir. GPU hâlâ masaüstü RTX 5070 olduğundan bu tablo düşük seviye telefon için FPS veya sıcaklık garantisi değildir.

## Güncel çıktılar

Standart `npm run build`, `npx cap sync android` ve Gradle `assembleDebug assembleRelease bundleRelease` zinciri başarıyla tamamlandı. Üç paketin her birindeki 72 web dosyası son `dist` ile SHA-256 düzeyinde eşleşti; eski web parçaları kalmadı ve native ısı köprüsü her pakette bulundu. APK v2 imzası ve AAB JAR imzası doğrulandı. Uygulama sürümü 1.2.0 / kod 3 olarak korundu; mağazaya yükleme yapılmadı.

- [İmzalı kurulum APK'sı](../cikti/FincanSokagi-profesyonel-optimize-2026-09-09.apk) — 10.638.240 bayt.
- [İmzalı AAB](../cikti/FincanSokagi-profesyonel-optimize-2026-09-09.aab) — 10.278.060 bayt.
- [Debug APK](../cikti/FincanSokagi-profesyonel-optimize-debug-2026-09-09.apk) — 13.150.140 bayt.
- [Dosya doğrulama özetleri](../cikti/FincanSokagi-profesyonel-optimize-2026-09-09-SHA256.txt).

Paket içerik doğrulaması: `.devshots/premium-performance/professional-packages.json`. Yeniden kontrol:

```sh
npm test
npm run build
npm run test:render
npm run test:render:lifecycle
node tools/character-benchmark.mjs --phase=recheck --compare=reference
node tools/device-load-check.mjs --url=http://127.0.0.1:5367/ --phase=device-recheck
python tools/verify-android-assets.py --apk android/app/build/outputs/apk/release/app-release.apk --aab android/app/build/outputs/bundle/release/app-release.aab
```

Gerçek zamanlı yük kontrolünden önce belirtilen adreste son üretim derlemesinin önizlemesi çalışıyor olmalı. Yük ölçümlerini diğer derleme ve tarayıcı testleriyle eşzamanlı çalıştırmamak gerekir.

## Fiziksel cihaz sınırı

Bağlı fiziksel telefon ADB'de çevrimdışıydı; cihazın kaydı değiştirilmedi. Düşük donanımda uzun süreli sıcaklık, pil tüketimi ve kesintisiz kare hızı ölçülmedi. Masaüstü CPU yavaşlatması mobil GPU/bellek/WebView davranışının tamamını taklit etmez. Bu çalışma gereksiz işi ve doğrulanmış takılma nedenlerini azaltır; her cihazı yüksek seviye donanıma eşitleme veya hiçbir koşulda takılmama garantisi vermez.
