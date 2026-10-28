# Personel çakışması düzeltmesi — 8 Eylül 2026

Güncel çıktı: [reklam.mp4](../reklam.mp4), 25 saniye, 1080×1920, 30 FPS, H.264 ve stereo AAC. Dosya baştan sona çözüldü ve Chrome'da oynatıldı. SHA-256: `38D0D1850469C6D00C515FA85376D8FC3EC694C986EDD387044F333C14E04DB2`.

## Bulunan nedenler ve değişiklik

- Eski ayrıştırma, iki karakter tam aynı koordinattaysa erken dönüyordu. Yeni çözüm bu durumda sabit, tekrarlanabilir bir ayırma yönü kullanıyor.
- Simülasyon konumu, karakter çizildikten sonra düzeltiliyordu; model eski konumda kalabiliyordu. Son konum artık aynı karede karakter köküne aktarılıyor.
- Ayrıştırma düzeltmeleri yürünebilir alana geri yansıtılıyor; birbirini mobilyanın içine itmeye karşı mevcut navigasyon çarpışması kullanılıyor. Oyuncunun mevcut 0,7 birim sınır payı korunuyor.
- Baristaların çekim başlangıçları atandıkları gerçek makinelere bağlandı. İki barista aynı koridordan geçip birbirinin iş noktasına girmiyor.
- Oyuncunun kasadan para topladığı nokta kasiyerden ayrıldı; mevcut 1,3 birim etkileşim menzili değiştirilmedi.
- Raf stokları personelin gerçek yenileme işleri yapabileceği şekilde hazırlandı. Çekimde çalışanlar gizlenmedi veya hareketleri kapatılmadı.

Genel çarpışma düzeltmesi ortak oyun kodundadır. Kafe tasarımı hâlâ yalnız çekim provasındadır; normal kafe yerleşimi ve karakter modelleri değiştirilmedi.

## Kontrol

- 251 test geçti: 247 mevcut test ve tam çakışma, çoklu yığılma, duvar yanında ayırma ve zaten ayrı aktörleri koruma için 4 yeni test.
- TypeScript ve normal üretim derlemesi geçti.
- Son videonun 1.500 simülasyon adımı ölçüldü. Hareketli/ayakta aktörlerin çizilen kökleri arasında 0,80 birimin altına inen temas sayısı: **0**. Oturan misafirler sandalyelerinde sabit tutulur ve bu hareketli aktör ölçümüne dahil değildir.
- Personellerin birbirine en yakın merkez uzaklığı 1,423 birim; tüm hareketli aktörlerde en yakın uzaklık 0,860 birim. Simülasyon–model konum hatası 0.
- Üç çay ve iki waffle servisi, ₺124 tahsilat, iki bulaşık toplama ve tam masa temizliği korundu.
- localStorage okuma/yazma/silme çağrısı 0. Gerçek deneme kaydıyla normal oyun → 750 karelik çekim → normal oyun geçişi geçti. Para, kapasite, ilerleme, normal semaver konumu ve mekân sınırı korundu.
- Son dosya 750 kare olarak çözüldü; oynatıcı sonuna ulaştı, ortam hatası oluşmadı. Oynatıcı zamanlaması 2 kare atladı; kodlanmış dosyada eksik kare yoktur.
- Kullanıcının gösterdiği 9,8 saniye civarındaki kasa sahnesi önceki kayıtla görsel olarak karşılaştırıldı.

Sonuçlar `.devshots/reklam-v3/verification.json`, `draft-report.json`, `save-regression.json`, `playback.json` içinde. [Önce (sol) / sonra (sağ)](../.devshots/reklam-v3/personel-karsilastirma.jpg). Önceki MP4 `reklam-onceki.mp4` olarak aynı klasörde saklandı.

Bu sonuç, incelenen sahnelerdeki hatayı ve belirtilen temas ölçüsünü doğrular; her olası kalabalık/oda düzeninin tüm animasyonlarında hata bulunmadığı iddiası değildir.

## Büyüme değerlendirmesi

12 masanın aynı servis hattına bağlanması yürüyüşü ve oyuncunun iş yükünü artırabilir. Öneri: başlangıçta 3–4 masalık okunabilir bir servis döngüsü; sonra kısa raf–masa–temizlik rotaları olan bölümlerin kademeli açılması. Geniş kafe ileri aşama hedefi olarak kalabilir. Mevcut yardımcıların masa servisinin tamamını üstlenmediği dikkate alınmalı; doluluk ile eşzamanlı bekleyen sipariş sayısı ayrı dengelenmelidir.

Bu ilerleme önerisi henüz oyuna uygulanmadı. Kullanıcının beğendiği tasarım büyüklüğü bu hata düzeltmesinde değiştirilmedi.
