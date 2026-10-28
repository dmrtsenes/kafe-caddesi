# Kafe Caddesi / Cafe Avenue — reklam ve mağaza paketi

13 Eylül 2026. Fincan Sokağı 1.2.1 projesinin mevcut TypeScript, Three.js ve Capacitor yapısı korundu. Kullanıcının önceki isim kararı **Kafe Caddesi / Cafe Avenue** geçerlidir. Demlio ve diğer önceki denemeler bu pakette kullanılmaz. Ürün adı, paket kimliği ve kayıt anahtarları değiştirilmedi.

## Oyunun gerçek kimliği

`README.md`, yayın ve karakter kaynak kayıtları; `World`, `StationEntity`, `Player`, `Customer`, `GameState`, `Scene3D`; istasyon, ürün, personel, yerleşim ve kayıt kodu incelendi. Oyun ayrı tarayıcı oturumunda gerçekten çalıştırıldı. Ana döngü hazır ürünü tepsiye alıp masaya servis etme, kasadaki geliri toplama, bulaşığı kaldırıp masayı silme ve kazancı işletmeye yatırmadır. Kısmi otomasyonla birlikte doğrudan karakter kontrolü vardır: idle arcade oynanışı, işletme geliştirme ilerlemesi.

Mahalle/Sahil, istasyon ve taşıma geliştirmeleri, şubeye özel ekipler, festival, hedefler ve prestij kaynakta bulunur. Bu kısa reklam yalnız gerçekten çekilen mekanikleri anlatır. Tezgâhtar paket rafını doldurur; oyuncunun tüm servis ve tahsilat işini devralmaz. Çevrimdışı stok hazırlığı sınırsız pasif gelir olarak tanıtılmadı.

## İnceleme bulguları

1. **Yayın varlığına ilişkin açık:** `docs/KARAKTER-KAYNAGI.md:5` ve karakter manifesti, mevcut karakterlerin Clean It paketinden çıkarıldığını belirtiyor; dağıtım izni doğrulanmış değil. Mevcut oyunun görüntülerini üretmek, bu karakterlere yayın hakkı sağlamaz. Yerel dosyalar hazırlandı; mağazaya veya reklam platformuna yükleme yapılmadı. Bu somut kaynak konusu yayın öncesi çözülmeli.
2. **Kirli masa geri bildirimi:** `src/world/StationView.ts:1570` göstergeyi bulaşık adedine bağlıyor. `src/sim/Station.ts:142` ise yüzey kiri kaldığında müşteriyi kabul etmiyor. Bulaşık alındıktan sonra silinmemiş masa temiz gibi görünebilir. Çekimde gerçek silme ve tamamlanma efekti gösteriliyor; ana oyunun görünümü bu görevde değiştirilmedi.
3. **Önceki reklamın açılışı:** uzun üretim beklemesi ve sabit bölüm süreleri hareketi zayıflatıyordu. Yeni ayrı mod, hazır stoğun gerçek el hareketiyle alınmasından başlar; servis, temizlik, ödeme ve işe alım tamamlandığında ilerler. Odalar arası yürüyüşler kurgu kesmeleriyle çıkarıldı.

328 mevcut kontrol ve TypeScript kontrolü geçti. Yeni çekimde kayıt deposuna sıfır erişim, değişmeyen kayıt değerleri, değişmeyen istasyon yerleşimi ve sıfır dış ağ isteği doğrulandı. Çekim hiçbir alternatif kafe sahnesini kullanmaz. Bu inceleme bütün cihazlarda performans veya kapsamlı güvenlik denetimi iddiası değildir.

## Yaratıcı karar

Üç açılış düşünüldü: önceki kapak görseli, kirli masanın temizlenmesi ve semaverden tepsiye ürün aktarımı. **Ürün aktarımı** seçildi: oyunun kafe deneyimini ilk saniyede anlatıyor ve “Bir çayla başlar” cümlesiyle görsel/işitsel tek bir başlangıç kuruyor. Kapak beklemesi yok.

Hikâye: hazır çayı al → üç ürünü iki misafire servis et → diğer masanın bulaşığını topla ve kovaya bırak → masayı sil → gerçek geliri topla → tezgâhtar tut → çalışan rafı doldursun → marka ve kısa çağrı. Küçük bir işin daha büyük bir işletmeye dönüşmesi, yeni özellik uydurmadan aynı oturum içinde görülür. Kamera sabit yan açıyla iş yapılan istasyona yaklaşır; dönüşlerle hareketi gizlemez. Logo ve ses başlangıcı birbirini beklemez.

Başlangıç bir yeni oyun vaadi değil, bellekte hazırlanmış tutarlı oturum kesitidir: 300 ₺, üç hazır çay ve iki eski bulaşık. Gösterilen servislerden 124 ₺ kasa geliri, bulaşık/silmeden 34 ₺; personel bedeli 400 ₺; sonuç 58 ₺. Kesme anlarında envanter veya para değiştirilmez. Tam olay ve kesme kayıtları `source/timeline.json` ve `review/capture.json` içindedir.

Referanslar: [Clean It](https://play.google.com/store/apps/details?id=com.lilyxgame.cleanit), [My Mini Mart](https://play.google.com/store/apps/details?id=com.KisekiGames.smart), [My Perfect Hotel](https://play.google.com/store/apps/details?id=com.master.hotelmaster). Alınan sunum ilkeleri net aksiyon, görünen sonuç, okunabilir ödül ve kazancın işe geri yatırılmasıdır. Referansların mağaza tasarımları veya marka işaretleri yeniden çizilmedi. Mevcut karakter kaynağı sorunu yukarıda ayrıca açıklandı.

## Marka devamlılığı

Önceki “Oyun markası ve mağaza görselleri” kararındaki tente, iki satırlı logo ve renkler aynen korundu. Türkçe Kafe Caddesi, İngilizce Cafe Avenue aynı ürünün yerelleştirmeleridir. Yeni isim turu açılmadı. Güncel sınırlı web taramasında belirgin aynı adlı oyun görülmedi; Cafe Avenue gerçek işletmelerde ve [bir şarkı adında](https://music.apple.com/us/song/1435632750) kullanılıyor. Arama sonucunun boş olması müsaitlik veya tescil garantisi değildir.

Renkler: #103D40 koyu yazı, #082D32 derin zemin, #128D80 yeşil, #9FE9C5 nane, #FFF3D7 krem, #FFC44A altın. Paytone One başlık/logo, Barlow Condensed Bold destek metni. Font lisansları `source/fonts` içindedir. İkon önceki seçilen illüstrasyondur; gerçek oynanış ekranı olarak sunulmaz. Altı yeni ekran ve ana tanıtım görseli bu görevde çekilmiş gerçek oyun karelerinden oluşur.

## Ses ve kullanım koşulları

Kısa, sıcak ve sakin Türkçe anlatım. Chatterbox V3 bilgisayarda çalıştırıldı. İlk standart sesin açılış/marka telaffuzu yeterince açık bulunmadığından, Piper'ın standart Türkçe sesiyle oluşturulmuş sentetik vurgu örneğiyle bütün cümleler yeniden üretildi. Gerçek kişiye ait referans kaydı kullanılmadı. Son açılış “Her şey bir çayla başlar”; kapanış “Kafe Caddesi, şimdi sıra sende.” İnsan ses sanatçısının stüdyo kaydı değildir. Üretim, metin ve görüntü dışarı yüklenmeden çalışır; ücretli servis veya hesap kullanılmaz. Müzik ve efektler bu paket için kodla oluşturulan özgün seslerdir; popüler şarkı, örnek paket veya izinsiz ses taklidi kullanılmaz. Konuşma sırasında müzik otomatik azalır; servis, para, temizlik ve işe alım efektleri gerçek olay zamanlarını takip eder.

[Chatterbox model kartı](https://huggingface.co/ResembleAI/chatterbox) ve [MIT lisansı](https://github.com/resemble-ai/chatterbox/blob/master/LICENSE) incelendi; kopyaları `licenses` içinde. Sentetik Türkçe örneğinin [ses kartı](https://huggingface.co/rhasspy/piper-voices/blob/refs%2Fpr%2F37/tr/tr_TR/fahrettin/medium/MODEL_CARD) veri lisansını CC0 olarak gösterir; Piper aracının lisansı MIT'dir. Modelin işaretlemesi korunur. Otomatik konuşma çözümü telaffuzun değerlendirilmesine yardımcı olur; doğal anlatımın insan dinleme onayı veya profesyonel stüdyo sertifikası yerine geçmez. Teknik ve görsel kontrolün gerçek kapsamı `KONTROL.md` içinde verilir.

## Mağaza ve yayın durumu

Hedef, projenin Android yayın belgelerine göre Google Play. [Resmî önizleme şartları](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en) ve [ikon şartnamesi](https://developer.android.com/distribute/google-play/resources/icon-design-specifications) 13 Eylül 2026'da kontrol edildi: 512×512 32 bit PNG ikon, 1024 KB altında; 1024×500 alfa içermeyen PNG tanıtım görseli; altı 1080×1920 dikey RGB ekran. Tanıtım yerleşimlerine uygun oyun ekranı tavsiyesi için en az üç 9:16 1080×1920 kare koşulu sağlanır. Logolar ayrıca şeffaf PNG/SVG olarak verilir.

Bu yeni marka altında halka açık yayın doğrulanmadığı için “Hemen indir” yerine **Gelişmeleri takip et** kullanıldı. Google Play video bağlantısı için istenen YouTube yüklemesi yapılmadı; istenen dikey MP4 yerel ana reklam dosyasıdır.
