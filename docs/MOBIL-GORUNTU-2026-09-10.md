# Mobil görünüm ve optimizasyon — 1.2.1 / 4

## Bulunan neden

10 Eylül 10:35'te oluşturulan sabah AAB'si, `11ECC2F160328C0E360A6B28E8366573503C2696CD9091F84BCE4A3CDF679739` özetiyle önceki görevin çıktısıyla eşleşti. İçinde Quaternius karakterleri, yakın telefon kamerası, mobilde kapalı gölge/yansıma/kenar yumuşatma ve 30 FPS varsayılanı vardı. Yerel geliştirme sunucusu başka karakterler gösteriyordu. Sabah paketi `.devshots/mobile-parity-2026-09-10/before/` altında korundu.

İlk düzeltmede dikey ekranda masaüstünün tüm yatay genişliğini korumak kamerayı fazla uzaklaştırdı. Kullanıcı geri bildirimiyle bu yaklaşım değiştirildi. A35 ölçümü ayrıca eski ısı eşlemesinin orta sıcaklık bildiriminde çözünürlüğü ve gölgeleri çok erken düşürdüğünü gösterdi.

## Son davranış

- Oyuncu, personel ve müşteriler web/Android'de aynı dosyalardan yüklenir. Model, animasyon, kıyafet ve üçgen sayıları korunur. Kaynak bilgisi [ayrı kayıttadır](KARAKTER-KAYNAGI.md).
- Dikey ekranda kamera mesafesi 27,5, görüş açısı 40°, merkez kaydırması sıfırdır. İlk açılıştaki ikinci mesafe hesabı kaldırıldı; kamera tekrar yaklaşık 42 birime uzaklaşmaz. Masaüstü ve yatay ekran kadrajı korunur. Farklı ekran oranları farklı alan gösterir.
- Alan satın alma yazılarının dokusu 256'dan 512'ye çıktı; eğik zemin ve ürün yazılarında filtreleme iyileştirildi. Arayüz doğal çözünürlüğünde çizilir.
- Yüksek kademe: en fazla 3 milyon 3D piksel / DPR 3. Orta: 2,2 milyon / DPR 2,5. A35'in gözlenen 8 çekirdek, 8 GB ve 1080 × 2340 profili otomatik yüksek kademeye uygundur.
- Telefon mobilyaları sade malzemelere çevrilmez. Ortam yansıması, gölge ve son geçişte kenar yumuşatma desteklenir. Düşük/yüksek geçişi karakterleri yeniden oluşturmaz.
- Hafif ve orta ısı basamaklarında çözünürlük korunur; önce gölge maliyeti azaltılır. Android ısı durumu 2 artık doğrudan ağır basamak 3'e sıçramaz. Otomatik mobil hedef 60 FPS; orta basamakta 30 FPS koruması, ağır basamaklarda daha fazla azaltma sürer. Bunlar cihazda her koşulda aynı FPS/ısı garantisi değildir.
- Etkin görsel ayarlar değişmemişse kalite bildirimi çizim tamponlarını yeniden oluşturmaz.
- Son kenar yumuşatma aynı GPU geçişiyle canlı ve önbellekteki karelere uygulanır. CPU'ya piksel aktarımı yapılmaz; tek renk dokusu kullanılır.
- Karakterlerin el/baş noktaları için tüm iskelet tekrar tekrar dolaşılmaz. Ortak kemik yolları bir kez hesaplanır; aynı karede el konumu ve açıklığı önbellekten okunur.
- Dönüşümleri sabit sokak ve birleştirilmiş dekor ağaçları her karede yeniden gezilmez. Üst nesne hareketi, yeni parça ekleme, yeniden kurma ve zorunlu güncellemeler çalışır.

## Son doğrulama

294 birim kontrolü, TypeScript ve üretim derlemesi geçti. Dokuz karakter örneğinin dokuz pozu karşılaştırıldı: **81 görüntü çiftinde piksel farkı sıfır**; el konumları, el açıklığı ve boy aynı kaldı. Karakter silme sonrası paylaşılan geometri ve kalan karakterler korundu.

390 × 844 masaüstü/telefon profilleri aynı kadraj ve çizim piksel özeti üretti. Gerçek kamera mesafesi de 27,5 olarak doğrulandı. Yatay telefon, masaüstü, ekran döndürme, düşükten yükseğe geçiş, gölge, ortam ışığı ve kenar yumuşatma geçti; harici karakter isteği yok.

22 stok/ürün/kurulum/masa/taşıma önbellek geçişi geçti. 4/255 fark eşiğini aşan piksel oranı en fazla %0,001823; bu önbellek karşılaştırması için sıfır fark iddiası değildir. Menüde çizim ve simülasyon durdu; görünürlük dönüşü ve grafik bağlam kaybından kurtarma geçti. Karakter oluşturma/silme sonrası doku sayısı 88 → 88; WebGL hatası yok.

### Aynı sahnede işlem yükü

384 × 832 / DPR 2,8125 / yüksek kalite, aynı rastgele tohum, 8 müşteri + 8 personel, hareket eden oyuncu ve 900 sabit simülasyon adımı. Masaüstü Chrome ölçümüdür; GPU tamamlanma süresini veya fiziksel telefon FPS'ini ölçmez.

| Kare başına işlem süresi | Önce | Sonra |
| --- | ---: | ---: |
| Ortanca | 1,7 ms | 1,3 ms |
| Ortalama | 1,854 ms | 1,345 ms |
| %90 | 2,5 ms | 1,6 ms |
| %99 | 4,3 ms | 2,6 ms |

Ortanca işlem süresi bu ölçümde yaklaşık %24 azaldı. Profilde tam ağaç matris güncellemelerinin örneklenen süresi 246,6 → 162,2 ms oldu. Ölçüm varyansı nedeniyle bunlar sabit FPS artışı olarak yorumlanmamalıdır.

### Üretim sürümünde hareketli kamera

384 × 832 / DPR 2,8125; gerçek çizim 1080 × 2340, açık bütün alanlar, 7–8 müşteri + 8 personel. Her koşul 20 saniye; NVIDIA RTX 5070 Laptop GPU. Dört kat yavaşlatma yalnız masaüstü CPU'sunu etkiler, A35 GPU'sunu taklit etmez.

| Koşul | Ortalama FPS | Kare aralığı %95 | 100 ms üzeri kare | Piksel | Gölge |
| --- | ---: | ---: | ---: | ---: | --- |
| Masaüstü | 59,75 | 16,9 ms | 1 | 2.527.200 | Açık |
| CPU 4 kat yavaşlatılmış | 56,84 | 32,8 ms | 0 | 2.527.200 | Açık |

Tek uzun kare gözlendi; tamamen takılmasız veya uzun süre ısınmasız çalışma iddiası yok. Çözünürlük ve gölgeler iki koşulda da korunmuştur.

Kanıtlar: `.devshots/cleanit-optimization/anchor-before/`, `anchor-after/`; `.devshots/premium-performance/mobile-extra-before/`, `mobile-extra-after/`; `.devshots/mobile-parity-2026-09-10/optimized-final/`, `optimized-performance/`, `optimization-unit.log`, `optimization-render.log`, `optimization-lifecycle.log`.

## Fiziksel A35: tamamlanan ve bekleyen

**Önceki ara önizleme** SM-A356E / Android 16 / Mali-G68 cihazına kuruldu ve ölçüldü. 30 ve 60 seçimleriyle 30'ar saniyede yaklaşık 30 FPS görüldü. 60 seçiminde eski ısı politikası çözünürlüğü yaklaşık 1,02 milyondan 0,89 milyon piksele indirdi ve gölgeleri kapattı. Ham ekran çağrıları 120 Hz idi; 30 FPS sonucu ekran frekansını yanlış algılamadan kaynaklanmıyordu. Ayrı probda yerel sıcaklık durumları 1 ve 2 gözlendi.

Kısa ara testte şarjdayken batarya sıcaklığı 33,5 → 34,0 °C oldu. Bu bir uzun kullanım/ısınma sonucu değildir. Ara önizlemede yeniden açma ve kaydın geri yüklenmesi geçti (96 para, 5 servis aynı kaldı).

Tam çözünürlüklü deneyin kalabalık sahnesine geçerken USB bağlantısı kesildi; bu deney tamamlanmış sayılmaz. Başlangıç yedeği `a35-quality/before.json` altında. Bu deneyin sonunda önizleme kaydını geri yükleme bağlantı yokluğu nedeniyle doğrulanamadı. Son paket henüz telefona yüklenmedi. Yeniden bağlandığında yalnız önizlemenin yedeği geri yüklenmeli, son APK kurulmalı ve normal/yüklü sahnede uzun süre FPS/ısı ölçülmelidir.

Asıl Play paketinin önce/sonra sürüm ve kurulum bilgileri aynı kaldı: `com.fincansokagi.game`, 1.2.0 / 3, yükleyici `com.android.vending`. Asıl uygulama kaldırılmadı ve verileri temizlenmedi. Kanıtlar `a35-play-before.txt`, `a35-play-after.txt`, `a35-verified/result.json`, `a35-probe/result.json`.

## Paketler

- `cikti/FincanSokagi-v1.2.1-preview.apk`: **14.428.389 bayt**, etiket **Kafe Caddesi Önizleme**, kimlik **com.fincansokagi.game.preview**, sürüm **1.2.1-preview / 4**. Asıl Play uygulamasıyla yan yana kurulur ve ayrı kayıt kullanır.
- `cikti/FincanSokagi-v1.2.1-mobile-parity.aab`: **11.720.613 bayt**, asıl kimlik **com.fincansokagi.game**, sürüm **1.2.1 / 4**. Mağazaya yüklenmedi.
- Her paketteki **77 web dosyası** son üretim çıktısıyla bayt düzeyinde eşleşti; Android ısı köprüsü bulundu. SHA-256 özetleri `cikti/FincanSokagi-v1.2.1-SHA256.json` dosyasında.

Önizleme kurulumu Play uygulamasını veya test üyeliğini değiştirmez. Önizlemeyi kullanmak Play test etkinliğinin yerine geçmez; Play sürümünü kurulu tutup kullanmaya devam etmek gerekir. Play Console katılım/sayaç durumu bu çalışmada hesap üzerinden incelenmedi. [Google Play test koşulları](https://support.google.com/googleplay/android-developer/answer/14151465?hl=tr), [Android uygulama varyantları](https://developer.android.com/build/build-variants).
