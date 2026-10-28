# Bu teslimin ses ve varlık kaynakları

- Son ses: yerel Chatterbox Multilingual V3, MIT lisanslı araç/model. Türkçe telaffuz için standart Piper tr_TR-fahrettin-medium çıktısından üretilmiş sentetik örnek kullanıldı; insan kayıt örneği veya kişiye özel ses taklidi yok. Örnek dosyası `audio/turkce-yonlendirme.wav`. Piper veri kartı CC0, araç MIT kaydı. Son sesleri Chatterbox yeniden üretti; Piper örneği reklamın ses kanalına doğrudan eklenmedi.
- [Chatterbox](https://github.com/resemble-ai/chatterbox), [model kartı](https://huggingface.co/ResembleAI/chatterbox), [Piper araç lisansı](https://github.com/rhasspy/piper/blob/master/LICENSE.md), [Türkçe ses kartı](https://huggingface.co/rhasspy/piper-voices/blob/refs%2Fpr%2F37/tr/tr_TR/fahrettin/medium/MODEL_CARD). İşaretleme korundu; modeller yeniden dağıtılmadı.
- Müzik/efekt: `tools/full2-score.mjs` ile bu görevde oluşturulan özgün dalgalar, ritim ve kısa melodi. Üçüncü taraf ses örneği veya şarkı alınmadı.
- Font: Paytone One ve Barlow Condensed Bold, SIL OFL; tam lisanslar kaynak font klasöründe.
- Logo/ikon: kullanıcının önceki görevde seçtiği Kafe Caddesi / Cafe Avenue paketi. İkon stilize illüstrasyondur; oynanış görüntüsü diye sunulmaz. Altı yeni ekran ve ana tanıtım görseli mevcut oyunun gerçek çekimidir.
- Oyun karakterleri: `docs/KARAKTER-KAYNAGI.md` mevcut karakterlerin Clean It paketinden çıkarıldığını bildirir. Dağıtım hakkı doğrulanmış değildir. Ses/font lisansları bu konuya izin sağlamaz.
- Kalite kontrolü: Vosk ve Faster Whisper yalnız bilgisayarda kullanıldı. Konuşmalar, görüntüler ve proje dış servise yüklenmedi.
