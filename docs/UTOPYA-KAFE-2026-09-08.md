# Ütopya kafe — ikinci tasarım provası, 8 Eylül 2026

Çıktılar: `reklam-utopya.mp4`, `kafe-utopya.jpg`, `kafe-karsilastirma.html`.
İlk tasarımın `reklam.mp4` ve `kafe-tasarimi.jpg` dosyaları korunur. Karşılaştırma sayfası iki videoyu ayrı veya aynı anda sessiz oynatır.

## Tasarım

Yeni sahne, su üzerinde açık renkli bir pavyon olarak kuruldu. Kıvrımlı cam kemerler, şampanya metal detayları, pembe ağaçlı bir su avlusu, kabuk biçimli sandalyeler ve pastel taş oturma adaları kullanır. İlk tasarımdaki 12 masalı ızgara yerine iki oturma kanadı ve üç masalı lounge ile toplam dokuz gerçek masa bulunur.

Merkezdeki 3,3 × 8,4 birimlik yükseltilmiş su avlusu gerçek yol bulma engelidir. Altı mevcut çalışan, beş mevcut ürün ve 24 gerçek istasyon kullanılır. Masa oturma noktaları ve ürün/para/kir durumlarını çizen görünümler gerçek simülasyona bağlıdır. Karakter PlayerS01 ve kullanıcının yerel oyundaki müşteri/personel ailesidir.

Sahne mevcut Three.js oyun motorunda oluşturulur. Mimari normal geometri, ortak malzemeler, birleştirilen sabit yüzeyler ve basit saydam camlardan oluşur; su için yansıtmalı ikinci kamera veya ağır efekt gerekmez. Bu, uygulanabilir tasarım prototipidir. Kullanıcı seçiminden sonraki oyuna geçişte aşamalı açılım, çalışan görev bölgeleri ve hedef telefonda çizim bütçesi ayrıca ayarlanacaktır. Çekim için üretilen 30 FPS dosya, gerçek telefonda performans ölçümü değildir.

## İzolasyon

`/reklam.html?concept=utopia` geliştirme sunucusunda ayrı bir belge açar. Konsept değişiklikleri o belgenin belleğindeki yerleşime uygulanır. Normal oyun yerleşim dosyaları bu tasarım için değiştirilmedi. Eski yeşil tasarım varsayılan `/reklam.html` adresinde kalır.

İki tasarım da yeni GameState/World kurar; kayıt, ayar ve dil verilerine erişmez. Reklam giriş noktası üretim derlemesine dahil edilmez. Hazırlanmış ileri aşama durumlar kurgu kesmeleriyle gösterilir; yeni yükseltme mekaniği uydurulmaz. Çay/waffle teslimi, kazanç toplama, bulaşık boşaltma ve masa silme oyunun gerçek etkileşimleridir.

## Üretim ve kontroller

- `npm run promo:utopia`: 750 gerçek kareyi kaydeder, sesle birleştirir ve MP4'ü doğrular.
- `npm run promo:utopia:preview`: yeni sahneyi açar.
- `node tools/promo-draft.mjs --concept=utopia`: hızlı sahne kontrolü.
- `node tools/promo-save-check.mjs --concept=utopia`: normal oyun → 750 kare → normal oyun ve kayıt kontrolü.
- `node tools/promo-playback-check.mjs --concept=utopia`: bitmiş MP4'ü baştan sona oynatır.

Yerel Chrome, Playwright, FFmpeg ve FFprobe çalıştırıldı. Sonuçlar `.devshots/reklam-utopya` klasöründedir.

Doğrulanan sonuçlar:

- 1080 × 1920, 30/1 FPS, 750 kare, 25 saniye; H.264/yuv420p ve 48 kHz stereo AAC.
- Tam MP4 çözme kontrolünde hata yok. Tarayıcıda ses açık, sona ulaşan 25 saniyelik oynatma; 750 video karesi, hata yok.
- Ses zirvesi −1,5 dB; Türkçe kısa yazılar, daha sakin elektronik müzik, gerçek olaylara bağlı ses efektleri ve marka kapanışı.
- 3 çay ve 2 waffle teslimi, ₺124 toplama, 2 bulaşık boşaltma, tam masa temizliği.
- 1.500 hareket örneğinde karakter çakışması 0, personellerin en yakın mesafesi 1,6803 birim, hareketli aktörler 0,86001 birim; görünüm/konum farkı 0.
- Su avlusuna giren yürüyen aktör 0; yerleşim doğrulamasında sorun 0.
- Kayıt araçlarıyla izlenen depolama okuma/yazma/silme çağrısı 0, önce/sonra içerik aynı.
- 251 mevcut test ve üretim derlemesi geçti.

Önceki `reklam.mp4` SHA-256 özeti değişmedi: `38D0D1850469C6D00C515FA85376D8FC3EC694C986EDD387044F333C14E04DB2`.
