> Bu rapor ilk çekimin arşividir. Kullanıcının karakter ve mekân düzeltmesiyle hazırlanan güncel video için [tasarım provası raporuna](REKLAM-TASARIM-PROVASI-2026-09-08.md) bakın.

# Kafe Caddesi reklam çekimi — 8 Eylül 2026

## Teslim

[İlk çekim arşivi](../.devshots/reklam-v2/reklam-onceki.mp4) üretildi ve son dosya Chrome'da baştan sona oynatıldı.

- 25.000 saniye; 1080×1920; sabit 30 FPS; 750 kare, doğal çözünürlükte çizim.
- H.264, yuv420p, MP4 faststart; AAC stereo, 48 kHz, 192 kb/sn hedefi.
- Türkçe başlıklar, oyun olaylarına eşlenen özgün müzik/efektler ve Kafe Caddesi kapanışı.
- 14.655.401 bayt (14,66 MB).
- SHA-256: `BABBC80C2642ED8989A21A7E0E6DFB2218A806F6F738BDD6B2EFC1214C9FAF84`.

## Sahne ve gerçek mekanikler

0–8,5 sn: çay alma, iki müşteriye üç çay servis etme, kasaya yönelme.
8,5–12 sn: gerçek teslimatlardan biriken kasayı toplama.
12–22 sn: iki bulaşığı toplama, kovaya bırakma, masayı silme, yerdeki lekeyi paspaslama.
22–25 sn: Kafe Caddesi logosu, kısa slogan ve kapanış.

Simülasyonda üç servis, ₺124 kasa tahsilatı, iki bulaşık toplama, bir tam masa temizliği ve bir yer lekesi temizliği doğrulandı. Para metni gerçek tahsilattan türetilir. Başlangıçtaki dolu raf, iki müşteri, kirli masa ve yer lekesi çekim için hazırlanır. İki kurgu kesmesinde karakterin konumu değişir. Ekrandaki eylemler, normal hız ve kapasiteyle mevcut World, Player, StationEntity ve Order üzerinden gerçekleşir. Yeni oyun mekaniği eklenmedi.

## Kayıtların korunması

`reklam.html` bağımsız giriş sayfasıdır. Oyuncunun Game/SaveManager/Settings nesnelerini kurmaz; yeni GameState ve World yalnız bellekte yaşar. Reklam sağlayıcıları ve oyun raporu yüklemeleri başlatılmaz. Dağıtılabilen Quaternius karakterleri kullanılır.

Kayıt geçici Chrome profilinde alınır. Çekimde localStorage çağrıları izlendi: **0 okuma/yazma/silme**. Ana kayıt, yedek, dil ve ayarlar bire bir aynı kaldı. Üretim paketinde gerçek bir deneme kaydıyla normal oyun → 750 karelik çekim → normal oyun geçişi sınandı: ₺76.543, kapasite yükseltmesi 2 ve ilerleme korundu. Normal arayüz geri geldi; normal sayfada reklam kontrolcüsü bulunmadı.

## Doğrulama

- Mevcut 247 oyun testi geçti; TypeScript ve üretim derlemesi geçti. `dist/reklam.html` mevcut.
- 750 karenin tamamında oyuncunun başı/ayakları, yazılar arasında kalan güvenli kadraja karşı sınandı.
- Son MP4 tamamen hatasız çözüldü; 750 kare / 30 FPS doğrulandı.
- 0,25 saniye veya daha uzun siyah kesinti bulunmadı.
- Ses tepe seviyesi −1,6 dBFS; ortalama −19,3 dBFS.
- Son dosya Chrome'da 25 saniyenin sonuna kadar oynadı, ortam hatası olmadı. Oynatıcı 750 kare bildirdi. Aynı anda görsel denetim yapılan bilgisayarda oynatma zamanlaması 2 kare atladı; dosyada eksik kare yoktur.
- Son MP4'ten çıkarılan kareler görsel olarak incelendi. Bir geçişte bulunan kamera kaçışı düzeltildi; video yeniden üretildi ve tekrar sınandı.

Sonuçlar `.devshots/reklam/verification.json`, `scene-report.json`, `save-regression.json`, `playback.json` içinde. Kontrol sayfası `.devshots/reklam/final-contact.jpg`.

## Ortam ve tekrar üretim

Node.js, Playwright, yerel Chrome ve proje bağımlılıkları kullanılabilir durumdaydı. FFmpeg/FFprobe başlangıçta eksikti; npm kayıt deposundaki `@ffmpeg-installer/win32-x64` 4.1.0 ve `@ffprobe-installer/win32-x64` 5.1.0 paketleri `.tools/video` altına indirildi. Ana oyunun çalışma zamanı bağımlılıkları değiştirilmedi; araçlar dağıtıma girmez.

Windows korumalı işlem/dosya okuyucusu `apply deny-read ACLs` hatası verdi. Gerekli işlemler izinli süreçlerle tamamlandı; çözülmemiş araç veya izin engeli yok.

`npm run promo:record` üretim paketini derler, her kare için iki adet 1/60 saniyelik simülasyon adımı çalıştırır, görüntüyü FFmpeg'e aktarır ve `reklam.mp4` üretir. Bilgisayarın gerçek zamanda 30 FPS ekran kaydı yapmasına bağlı değildir. Gerçek eylem, kayıt koruma veya video doğrulamaları geçmezse komut başarısız olur. Farklı araç konumları `FFMPEG_PATH` / `FFPROBE_PATH` ile verilebilir.

