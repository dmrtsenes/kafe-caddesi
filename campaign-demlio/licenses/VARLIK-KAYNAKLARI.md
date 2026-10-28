# Varlık ve ses kaynakları

- **Logo / çay ikonu:** Bu görevde çizilen özgün SVG geometri ve metin düzeni. İkon bir oyun ekran görüntüsü değildir; çay/tepsi mekaniğini temsil eden marka işaretidir.
- **Tipografi:** Paytone One ve Barlow Condensed Bold, SIL Open Font License. Tam lisanslar `source/fonts/` içindedir. Metinlerin ticari görsel/video çıktısında kullanılmasına uygun font lisansı.
- **Müzik ve efektler:** Bu görevde `tools/campaign-score.mjs` ile oluşturulan özgün dalga sentezi. Başka eserden melodi, ses örneği, kayıt veya şarkı alınmadı. Müzik/efektler üzerinde üçüncü taraf örnek lisansı gerektiren materyal kullanılmadı.
- **Seslendirme:** Piper standart `tr_TR-fahrettin-medium` sesi, 22.050 Hz kaynak; finalde 48 kHz. Model kartı veri lisansını CC0 olarak gösteriyor. [Ses kartı](https://huggingface.co/rhasspy/piper-voices/blob/refs%2Fpr%2F37/tr/tr_TR/fahrettin/medium/MODEL_CARD), [Piper MIT](https://github.com/rhasspy/piper/blob/master/LICENSE.md). Kartın bir kopyası bu klasörde. Kişiye özel klonlama veya belirli bir gerçek kişinin konuşma tarzını taklit etme talebi kullanılmadı. Runtime ve model ZIP'e yeniden dağıtılmıyor.
- **Oyun görüntüleri:** Kullanıcının mevcut Three.js oyununun yerel ekran çıktıları. `public/packs/current-cast` karakter dosyaları için `docs/KARAKTER-KAYNAGI.md`, Clean It 1.24.0 XAPK'dan çıkarılma kaydı içeriyor. Bu karakterlerin ticari dağıtım/marka kullanım izni doğrulanmış değildir. Font, ses veya özgün logo lisansı bunu çözmez. Diğer mevcut model paketlerine yeni lisans beyanı eklenmedi.
- **Ses tanıma:** Yerelde Vosk Türkçe küçük model; yalnız kalite kontrolünde kullanıldı, reklam sesinin kaynağı değildir. Hiçbir kayıt harici tanıma hizmetine gönderilmedi.

Bu paket yayın yapmaz ve üçüncü taraf karakterlere izin vermez. Telif/marka haklarının tamamının temiz olduğuna dair garanti değildir.
