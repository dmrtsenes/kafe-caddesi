# Demlio teslim paketi

Önce `index.html` dosyasını açın. Ana video `reklammmm.mp4`. Tam inceleme, isim seçimi, kaynaklar ve sınırlar `RAPOR.md` içinde.

- `audio/seslendirme.wav`: ayrı Türkçe ses, 48 kHz stereo.
- `audio/seslendirme-metni.txt`, `.srt`, `.ass`: metin ve düzenlenebilir altyazılar.
- `audio/muzik.wav`, `efektler.wav`, `final-mix.wav`: ayrı ses kanalları.
- `brand/`: iki şeffaf logo, 1024 ikon kaynağı ve kimlik levhası.
- `store/`: Google Play ikonu, tanıtım kapağı ve altı ekran görüntüsü.
- `source/`: düzenlenebilir SVG'ler, fontlar/lisansları, ses içermeyen video montajı (`picture.mp4`), olay zaman çizelgesi ve çekim araçlarının kopyası. `picture.mp4` marka yazılarını içerir; konuşma altyazıları son montajda eklenir.
- `captures/`: mağaza kompozisyonlarının özgün oyun kareleri.
- `review/`: teknik kanıtlar, test sonuçları, görüntü levhaları ve bağımsız ses tanıma çıktısı.

Ses yerel sentezdir; insan stüdyo kaydı değildir. Son marka telaffuzu otomatik tanımayla doğrulanamamıştır. Mevcut karakterlerin kaynak belgesinde Clean It'ten çıkarıldığı yazıyor; hak durumu çözülmeden reklam/mağaza yayınını onaylanmış saymayın.

## Bu çalışma alanında tekrar üretim

Komutları oyunun ana klasöründe çalıştırın. Ön koşullar: mevcut `node_modules` (Playwright, Vite, Three.js, sharp), Chrome ve `.tools/video` altındaki FFmpeg/FFprobe. Kod kopyaları `source/code/` içinde aynı göreli yolla yer alır; aktif kopyalar oyunun `src/promo-campaign/` ve `tools/campaign-*` yollarındadır. Asıl oyunun `src` ve `public/packs` dosyaları gereklidir; ZIP üçüncü taraf modelleri yeniden dağıtmaz.

```powershell
npm run typecheck
node tools/campaign-record.mjs --draft
node tools/campaign-record.mjs
node tools/campaign-brand.mjs
node tools/campaign-finish.mjs
node tools/campaign-package.mjs
```

Seslendirme WAV'ları mevcutsa tekrar üretim için dış bağlantı gerekmez. Metin değişecekse:

```powershell
node tools/campaign-voice.mjs
node tools/campaign-finish.mjs
```

Bu adım `.tools/piper/runtime/piper/piper.exe` ve `.tools/piper/tr_TR-fahrettin-medium.onnx` + aynı adlı `.json` gerektirir. `source/kurulum.ps1` ücretsiz araçların resmi indirme bağlantılarını içerir. Kurulum indirme yapar, proje yüklemez. Piper'ın sinirsel üretimi tekrar çalıştırıldığında küçük ses farkları olabilir; teslim edilen WAV'ları koruyarak montajı aynen kullanın.

İsteğe bağlı bağımsız tanıma: Python 3.12 + numpy, `.tools/audioqa` altında vosk ve `vosk-model-small-tr-0.3` ile `tools/campaign-audio-qc.py`. İnsan dinleme onayı değildir.

Çekim modu için `npm run dev -- --host 127.0.0.1` ve `/campaign.html`. Normal oyun `/` adresindedir. Çekim ayrı bellekte ilerler, kayda veya ayarlara erişmez; oyun hızı değiştirilmez. Her sahne iş tamamlandığında biter. Bitmeyen iş dosya üretmek yerine hata verir. Üretim paketi, adı ve kayıt anahtarları değiştirilmez.

ZIP tekrar oluşturulduğunda ayrıntılı ara kareleri dahil etmez; altı kaynak mağaza karesi, nihai dosyalar ve önemli kontrol raporları bulunur. SHA-256 listesi `SHA256SUMS.txt` içindedir.
