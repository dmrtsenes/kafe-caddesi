# Kafe Caddesi / Cafe Avenue — reklam-full2

Ana dosya `reklam-full2.mp4`: dikey 1080×1920, 30 FPS, H.264/yuv420p görüntü, AAC 48 kHz stereo ses. Oyun görüntüsü esnetilmedi; siyah bant eklenmedi. Galeri için `index.html` dosyasını açın. ZIP'in yanında galeri açılırsa ZIP bağlantısı çalışır; açılmış paketin içinden ZIP bağlantısı üst dizindeki asıl arşivi arar.

## Dosyalar

- `audio/seslendirme.wav`: zaman çizelgesine yerleştirilmiş ayrı Türkçe ses. Konuşmalar arasındaki sessizlikler video zamanlarıyla eşleşmek içindir.
- `audio/0*-master.wav`: ayrı işlenmiş kısa cümleler. `audio/0*.wav`: ham üretimler.
- `audio/seslendirme-metni.txt`, `.srt`, `.ass`: metin, zamanlı altyazı ve düzenlenebilir altyazı stili.
- `audio/muzik.wav`, `efektler.wav`, `final-mix.wav`: ayrı müzik, efekt ve son miks.
- `store/`: Google Play ikonu, gerçek oyun görüntülü tanıtım görseli, altı ekran, önceki kararla tutarlı mağaza metinleri.
- `brand/`: Türkçe ve İngilizce şeffaf PNG/SVG logolar; 1024 piksel ikon, renk ve tipografi bilgileri. Önceki kılavuz süreklilik kaydıdır; bu yeni set için `INCELEME.md` esas alınır.
- `source/design/`: gömülü font ve gerçek görüntü içeren düzenlenebilir SVG kompozisyonları. `source/art/`: yazısız orijinal çekim kareleri.
- `source/picture.mp4`: konuşma altyazısından önceki görüntü masterı. Büyük reklam başlıkları çekim sırasında ayrı canvas katmanından basılır; metinlerini değiştirmek için `src/promo-full2/titles.ts` düzenlenip çekim yeniden alınır.
- `source/timeline.json`: gerçek kesmeler, konuşma yerleşimleri, oyun olayları. `source/voice-direction.json`: seçilen ses kayıtlarının tekrar üretim ayarları.
- `source/code/`: yalnız bu çalışmaya ait çekim, kurgu, ses, tasarım ve doğrulama kodlarının kopyaları. Tam oyun projesinin yerine geçmez.
- `review/`: oynanış, kayıt koruma, ses/telaffuz, görüntü, dosya ve arşiv kontrol kanıtları. `licenses/` ve `source/fonts/`: kullanılan ses/font lisansları.
- `INCELEME.md`: gerçek oyun analizi, mevcut kod bulguları, yaratıcı kararlar ve yayın sınırları. `KONTROL.md`: son kontrol sonucu ve sınırları.

## Aynı proje içinde tekrar üretim

Komutları oyunun kök klasöründe PowerShell'de çalıştırın. Oyun yeniden yazılmaz. Gerekli sürümler: Node 24, projedeki Playwright/Chrome/Vite/Sharp; FFmpeg ve FFprobe `.tools/video` altında; Python 3.12, NVIDIA CUDA 12.8 destekli ekran kartı. Bu bilgisayarda RTX 5070 Laptop üzerinde çalıştırıldı. Ses için birkaç GB araç/model dosyası indirilir; oyun, görüntü veya konuşma metni gönderilmez.

```powershell
npm run typecheck
node tools/full2-record.mjs
& .tools/voice-studio/Scripts/python.exe tools/full2-voice.py
node tools/full2-finish.mjs
node tools/full2-assets.mjs
node tools/full2-deliver.mjs --gallery-only
& .tools/voice-studio/Scripts/python.exe tools/full2-whisper-qc.py --offline
node tools/full2-playback.mjs
node tools/full2-deliver.mjs
```

Çekim yalnız bellekteki yeni bir oturumda çalışır, dış ağ isteklerini keser ve gerçek oyuncu kayıt deposunun okunmadığını/yazılmadığını kontrol eder. Kamera/akış kaynağı `src/promo-full2/main.ts`, başlıklar `titles.ts`, müzik/efektler `tools/full2-score.mjs`, son ses/görüntü `tools/full2-finish.mjs` içindedir. Normal oyun dosyalarına reklam başlatma kodu eklenmez.

Çekim provası: `node tools/full2-record.mjs --draft`. Canlı önizleme: `npm run dev -- --host 127.0.0.1`, ardından `/reklam-full2.html`. Video galerisinin yolu `/campaign-kafe-caddesi/index.html`.

Yeni bir bilgisayarda ses ortamı gerekirse aşağıdaki ücretsiz yerel kurulumu çalıştırın. İlk kurulum internet erişimi gerektirir. FFmpeg/FFprobe ve Chrome ayrıca mevcut olmalıdır; kurulum betiği bunları sisteminize otomatik eklemez.

```powershell
./tools/full2-setup.ps1 -Python312 'C:/Python312/python.exe'
```

Kurulumda Türkçe ile ilgisiz Çince sözcük ayırıcı başlatılması atlanır. Ses işaretlemesi kaldırılmaz. GPU desteği nedeniyle üst paketin eski torch 2.6 sabitlemesinden farklı olarak torch/torchaudio 2.8 kullanılır; bu kombinasyon gerçek üretimde doğrulandı. İnternet deposu daha sonra değişebilir; `review/voice-runtime-freeze.txt` ve `review/voice-model-files.json` teslimde kullanılan sürüm/hash kaydıdır. Aynı ayarlarla farklı GPU/runtime sürümlerinde bit düzeyinde aynı ses garanti edilmez.

Paket kimliğini, kaydı veya canlı mağaza adını değiştiren komut yoktur. Mağaza/reklam hesabına yükleme yapılmadı.
