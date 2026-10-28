# Kafe Caddesi — premium reklam sahnesi

Çıktı: [reklam.mp4](../reklam.mp4). Yerel oynatıcı: [reklam-izle.html](../reklam-izle.html). Yazısız mekân görünümü: [kafe-premium.jpg](../kafe-premium.jpg).

## Görsel düzen

İmza tasarımındaki gerçek istasyonlar ve oturma koordinatları üzerinde kesintisiz açık terrazzo salon, ceviz tonlu lounge zemini, pirinç detaylar, iç mekân bitkileri, duvar panoları, tezgâh üstü kavanozlar, iki lounge lambası ve dış oturma ayrıntıları eklendi. Lambalar merkezi waffle servisinde karakteri örtmez. Bitkilerin ayak izleri yol bulma engellerine dahildir.

Dokuz gerçek masa, iki kasa, altı mevcut çalışan ve beş mevcut ürün kullanılır. Başlangıçta 19 müşteri vardır; mevcut iki müşteri görünümü çekim içinde çeşitlendirilir. Oyuncu, normal yerel oyunda görünen PlayerS01 karakteridir. Yeni karakter veya yeni oyun mekaniği eklenmedi.

## 25 saniyelik kurgu

| Süre | Görüntü |
|---|---|
| 0–2,7 sn | Dolu kafenin geniş açılışı ve yavaş yaklaşma |
| 2,7–8 sn | Yakın planda üç çay alma ve gerçek servis |
| 8–10,5 sn | Servislerden gelen ₺124 kasayı toplama |
| 10,5–16,5 sn | İki bulaşığı toplama, kovaya bırakma ve masayı tamamen silme |
| 16,5–19,5 sn | Beş ürünün ve personelin bulunduğu servis hattı boyunca kayma |
| 19,5–22,5 sn | Salon ve lounge; iki gerçek waffle servisi |
| 22,5–25 sn | Mekânı görünür bırakan Kafe Caddesi kapanışı |

İleri aşama stokları, açık bölümler ve oturan müşteriler çekim için bellekte hazırlanır; kurgu kesmelerinde oyuncu başlangıç konumuna alınır. Filmdeki ilerleme 25 saniyede yapılmış bir satın alma gösterisi değildir. Hareket, servis, para toplama, bulaşık boşaltma ve masa silme mevcut World/Player/Station/Order üzerinden çalışır. Sonuç yazıları ve özgün müzikteki servis, para ve temizlik efektleri gerçek olay zamanlarına bağlıdır.

## Ana oyun ve kayıtlar

`/reklam.html` ve `?concept=premium` ayrı belge açar. Tasarım, yeni GameState/World içinde yaşar. Game, SaveManager ve reklam sağlayıcısı kurulmaz. Normal oyunun mekânı, ekonomi dosyaları ve karakter modelleri bu çalışmada değiştirilmedi. Tasarım üretim oyun paketine girmez; kullanıcı beğendikten sonra ana oyuna uyarlama ayrıca yapılabilir.

Tam çekimde izlenen depolama okuma/yazma/silme sayısı sıfırdır. Geçici tarayıcı profilindeki gerçek deneme kaydıyla normal oyun → 750 kare reklam → normal oyun geçişi geçti. Para 76543, kapasite yükseltmesi 2, ilerleme, normal arayüz ve normal kafe sınırları korundu.

## Kontrol ve ortam

Node.js 24.18.1, Playwright 1.62.1, yerel Chrome ve `.tools/video` altındaki FFmpeg/FFprobe kullanıldı; yeni araç indirilmedi. Başlangıçta salt okunur ortam nedeniyle yazma izni gerekti. Windows işlem kısıtlaması yüzünden tarayıcı/derleme işlemleri izinli süreçte çalıştırıldı. Çekim aracının dosya izleyicisi Windows'ta video adlandırmasını engellediği için yalnız çekim sunucularında dosya izleme kapatıldı. Son çıktı, tüm kontrollerden sonra önceki video yedeklenerek yerine alınır.

- Mevcut 251 oyun testi ve ayrı klasörde normal üretim derlemesi geçti.
- 1500 hareket örneğinde karakter çakışması ve konum/görünüm sapması sıfır; bütün yerleşim kontrolleri geçti.
- Son dosya H.264/yuv420p, 1080×1920, sabit 30 FPS, 750 kare ve 25 saniye; ses 48 kHz stereo AAC.
- Tam video çözümleme ve sesli tarayıcı oynatması kontrol edildi. Nihai sayısal sonuçlar aşağıdaki raporlardadır.
- Videodan saniyede bir alınan 25 kare ve yakın kontrol kareleri görsel olarak incelendi.

`npm run promo:record` güncel premium filmi üretir. `promo:preview`, `promo:check`, `promo:check-save`, `promo:check-video` aynı tasarıma yönelir. Önceki tasarımlar `--concept=classic`, `--concept=imza` ve `--concept=utopia` ile açılabilir. Yerel oynatma sayfası doğrudan dosya olarak açılır.

Doğrulama dosyaları: `.devshots/reklam-premium/verification.json`, `scene-report.json`, `save-regression.json`, `playback.json`, `delivery.json` ve `final-contact.jpg`. `node tools/promo-finish.mjs` son dosyadan kontrol karelerini, kapakları ve ses/siyah kesinti raporunu üretir.

Son teslim 17.613.003 bayttır. SHA-256: `346985f3c3c9255d49cd74ba7d88b39e2829c871dff33d975005202e83dec0e9`. Ses tepe seviyesi −2,7 dBFS, ortalama −18,2 dBFS; 0,25 saniyeyi geçen siyah kesinti yok. Chrome ses açık olarak 25 saniyenin sonuna ulaştı; video hatası yok ve 750 kare bildirildi. Denetim bilgisayarında oynatma zamanlaması 2 kare atladı; dosyada 750 karenin tamamı mevcut. Dosya izleme düzeltmesinden sonra otomatik çekim komutu tekrar çalıştırılıp tamamen başarıyla tamamlandı; oynatma ve son medya kontrolü de yeniden üretmiş olduğu dosyayla yapıldı.

## Tasarım referansları

[My Mini Mart](https://play.google.com/store/apps/details?id=com.KisekiGames.smart&hl=en), [My Perfect Hotel](https://play.google.com/store/apps/details?id=com.master.hotelmaster&hl=en) ve [Clean It](https://play.google.com/store/apps/details?id=com.lilyxgame.cleanit&hl=en) resmi mağaza sayfaları ve proje içindeki önceki referans kareleri incelendi. Buradan alınan tasarım yorumu: belirgin iş alanları, okunur dolaşım, dolu ürün hattı ve geniş mekân planları ile yakın eylem çekimlerinin birlikte kullanılması. Referans ekran görüntüleri videoya eklenmedi.
