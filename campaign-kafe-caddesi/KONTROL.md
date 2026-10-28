# Son kontrol — reklam-full2.mp4

13 Eylül 2026. Ana video ve ayrı sesler gerçekten üretildi. Dosyalar yalnız yerelde tutuldu.

| Kontrol | Sonuç |
|---|---|
| Süre / kare | 18,267 saniye / 548 kare |
| Görüntü | 1080×1920, 30/1 FPS, H.264, yuv420p, BT.709 |
| Ses | AAC, stereo, 48.000 Hz, 192 kb/sn hedef; ayrı WAV kanalları |
| Tam çözme | Video ve ses baştan sona hatasız çözüldü |
| Siyah / donmuş kare | Tarama eşiğinde siyah kare veya 0,8 saniyeden uzun donma bulunmadı |
| Ses seviyesi | −16,3 LUFS bütünleşik; −2,9 dBTP tepe; 4,2 LU aralık |
| Tam oynatma | Chromium normal hızda sona ulaştı; 547 görüntü sunumu, açılışta ölçülebilir ses |
| Kayıt koruması | Depoya sıfır erişim; değerler ve istasyon yerleşimi değişmedi |
| Gerçek mekanik | 3 servis, 1 masa temizliği, 124 ₺ tahsilat, 400 ₺ personel ödemesi, gerçek raf doldurma |
| Mevcut kontroller | 328 test ve TypeScript kontrolü geçti |
| Kaynak bütünlüğü | Önceden mevcut 271 oyun/varlık/paket girdisi eski hash manifestiyle aynı |
| Mağaza | İkon/kapak/6 ekran boyut ve kanal kontrolü geçti; logolarda gerçek alfa var |

Videonun tüm süresini kapsayan 0,2 saniye aralıklı levhalar, kesmeler ve seçili tam çözünürlüklü kareler görsel olarak incelendi. İlk karede hazır ürün ve başlayan el hareketi var; üretim beklemesi çıkarıldı. Başlıklar karakter/ürün hareketinden ayrı üst alanda. Son kapağın ilk kadrajında kesilen karakter başı düzeltildi. Altın ve yeşil ödül işaretleri oyun olaylarıyla birlikte görünür. Kapanışın son bölümündeki kısa sabitlik logo/çağrı okuma payıdır. İnceleme levhalarının son sayfasındaki boş hücreler video içinde siyah kare değildir.

İlk ses denemesinde açılış ve marka adı yabancı vurgu nedeniyle belirsiz çözüldü; o sesler teslimdeki ana kayıtlara alınmadı. Altı yeni Türkçe vurgu denemesinden tutarlı dört okuma seçildi. Son işlenmiş kayıtlar bağımsız Whisper modeline **beklenen metin veya başlangıç ipucu verilmeden** çözdürüldü: “Her şey bir çayla başlar”, “Yeni misafirlere yer aç”, “Kazancınla ekibini kur”, “Kafe Caddesi, şimdi sıra sende”. Tanıyıcı “Kazancın'la” ve “Kâfe” biçimlerini üretti; bunlar transkriptte korundu, düzeltilmiş gibi gösterilmedi. İlk küçük Vosk modelinin yetersiz sonuçları son kalite kararı olarak kullanılmadı.

**Ses kontrolünün sınırı:** Bu ortamda sesi doğrudan dinleyerek doğallık değerlendirmesi yapılamadı. Gerçek ses üretimi, bağımsız kelime çözümü, dalga/tepe seviyesi, miks ve tam oynatma kontrolü yapıldı. Bunlar insan dinleme onayı veya profesyonel ses sanatçısı kaydı yerine geçmez; “insan sesi olduğu doğrulandı” iddiası yoktur.

Kanıtlar: `review/video-verification.json`, `technical-qc.log`, `playback.json`, `whisper-transcripts.json`, `voice-selection.json`, `capture.json`, `store-verification.json`, `retained-input-integrity.json`. ZIP her dosya için açılabilirlik ve SHA-256 eşleşmesiyle kontrol edilir; sonucu `review/archive-verification.json` içindedir.

Yayın öncesi açık: mevcut karakterlerin dağıtım hakkı `INCELEME.md` içinde belirtilen proje kaydına göre doğrulanmış değil. Mağaza/reklam hesabına yükleme yapılmadı.
