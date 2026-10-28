> Bu rapor ikinci çekimin tasarım kaydıdır. Personel çakışmasının düzeltildiği güncel dosya için [son doğrulama raporuna](PERSONEL-CARPISMA-2026-09-08.md) bakın. Bu raporun videosu `.devshots/reklam-v3/reklam-onceki.mp4` olarak saklandı.
# Kafe Caddesi — reklam için kafe tasarım provası

## Güncel teslim

[reklam.mp4](../reklam.mp4) ve [kafe-tasarimi.jpg](../kafe-tasarimi.jpg) üretildi. Video 25 saniye, 1080×1920, sabit 30 FPS ve 750 karedir. Görüntü H.264/yuv420p, ses AAC stereo/48 kHz; MP4 hızlı açılma bilgisi dosyanın başındadır.

SHA-256: `C119EC8B563653EA4595F35FC3109A07CB9412C5163842B7356CD87D5D8F30F6`.

## Karakter düzeltmesi

İlk çekim dağıtım karakterlerini zorladığı için kullanıcının yerel oyununda gördüğü karakterlerden farklıydı. Bu seçim kaldırıldı. Yeni film mevcut yerel PlayerS01 karakteri ve normal yerel oyundaki müşteri/personel ailesiyle çekildi. Model kimliği kontrol edilir; farklı bir karakter varsa çekim başlamaz. Karakter modelleri veya animasyonları bu çalışmada değiştirilmedi.

## Yeni mekân

Tasarıma özel açık taş döşeme, yeşil ve pirinç detaylı tezgâhlar, cam vitrin hattı, yuvarlak/kare masalar, döşemeli sandalyeler, duvar kenarı oturma grupları, bitkiler, sarkıt lambalar ve koyu yeşil lounge hazırlandı. Geometriler, mobilya ayak izleri ve servis noktaları birbirine göre düzenlendi. Eski boş alanlar daha sık ve okunabilir oturma gruplarıyla dolduruldu.

12 masa, 2 kasa, 5 ürün çeşidi, 6 çalışan; ilerlemiş salon çekiminde 21 müşteri bulunur. Vitrin ürünleri gerçek stoklardan, masadaki servis ve bulaşıklar gerçek masa durumundan, para görselleri gerçek kasadan gelir. Arka hizmet istasyonlarının kullanılmayan kısmı bu tasarım provasının kadrajından çıkarılmıştır.

## Kurgu

| Süre | Çekim |
|---|---|
| 0–2,7 sn | Geniş, dolu kafe ve tasarımın genel görünümü |
| 2,7–8 sn | Tepsi doldurma, üç çay servisi |
| 8–10,5 sn | ₺124 gerçek kasa tahsilatı |
| 10,5–16,5 sn | İki bulaşığı toplama, kovaya bırakma ve tam masa temizliği |
| 16,5–19,5 sn | İlerleyen aşama: dolu menü hattı ve çalışan ekip |
| 19,5–22,5 sn | Geniş lounge ve iki waffle servisi |
| 22,5–25 sn | Mekânı görünür bırakan marka kapanışı |

Bu film hazırlanmış farklı ilerleme durumlarını kurgu geçişleriyle birleştirir. Açık bölümler, başlangıç stokları, personel ve oturan müşteriler sahne hazırlığıdır. İleri aşama kesmesinde arka plandaki masalar yeni servis durumuna hazırlanır. Ekrandaki oyuncu hareketleri, servis, kazanç toplama ve temizleme normal World/Player/StationEntity/Order işlemleriyle çalışır. Yeni bir oyun mekaniği uydurulmadı.

## Asıl oyun korunuyor

Yeni yerleşim ve görseller yalnız bağımsız reklam sayfasının belleğinde bulunur. Normal oyun kaynaklarında yerleşim, karakter, ekonomi veya kayıt değişikliği yapılmadı. Kafe tasarımı ve özel karakter çekimi üretim paketine dahil edilmez. Kullanıcının tasarımı beğenmesi ana oyuna otomatik uygulanması anlamına gelmez.

Kayıt sırasında localStorage erişim çağrıları izlendi: **0 okuma/yazma/silme**. Ana kayıt, yedek, dil ve ayarlar aynı kaldı. Ayrıca normal oyunda gerçek deneme kaydı oluşturuldu; tam çekim oynatıldı ve normal oyuna dönüldü. ₺76.543, kapasite yükseltmesi 2 ve ilerleme korundu. Semaverin normal z konumu −12,6, ana mekân sınırı 21,2 ve PlayerS01 kimliği doğrulandı; tasarım yerleşimi normal sayfaya sızmadı.

## Kontrol sonuçları

- 247 mevcut oyun testi; TypeScript ve normal üretim derlemesi geçti.
- İstasyon yerleşimi doğrulamasında 0 sorun.
- Doğru karakter, beş gerçek servis, kasa tahsilatı ve tam masa temizliği doğrulandı.
- Aksiyon çekimlerinde oyuncunun başı/ayakları güvenli kadraj içinde sınandı; genel planlar çevreyi gösterir.
- Son dosya tamamen hatasız çözüldü: 750 kare / 30 FPS / 25.000 sn.
- 0,25 saniye veya daha uzun siyah kesinti bulunmadı.
- Ses tepe seviyesi −1,4 dBFS, ortalama −18,6 dBFS.
- Chrome oynatıcı dosyanın sonuna ulaştı, ortam hatası oluşmadı. 750 kare bildirdi; denetim sırasında oynatma zamanlaması 2 kare atladı. Kodlanmış dosyada eksik kare yoktur.
- Son MP4'ten alınan kontrol kareleri görsel olarak incelendi.

Sonuçlar `.devshots/reklam-v2/verification.json`, `scene-report.json`, `save-regression.json`, `playback.json` içinde; görüntü kontrol sayfası `final-contact.jpg` dosyasıdır. Önceki video aynı dizindeki `reklam-onceki.mp4` olarak saklandı.

## Tasarım referansları

Kullanıcının verdiği örnekler için [My Mini Mart görüntüleri](https://x.la/g/my-mini-mart), [My Perfect Hotel yayıncı sayfası](https://blog.say.games/posts/my-perfect-hotel-saygames-latest-hybrid-casual-hit-becomes-the-most-downloaded-game-in-the-world) ve [Clean It görüntüleri](https://www.bluestacks.com/apps/arcade/clean-it-restaurant-cleanup-on-pc.html) incelendi. Tasarım yorumu: az sayıda uyumlu renk, belirgin iş alanları, okunabilir dolaşım ve dolu oturma grupları. Yeni mekân geometrileri bu projede oluşturuldu; referans ekran görüntüleri videoya konmadı.

