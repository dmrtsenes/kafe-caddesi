# Kafe Caddesi — 1.2.1

Tek elle oynanan 3D kafe işletme oyunu. Siparişi al, doğru ürünü masaya servis et veya paket rafına bırak, kasadaki parayı topla, bulaşığı kaldırıp masayı sil, kazancınla kafeyi büyüt.

## Mobil ve web görünümü — 10 Eylül 2026

Web önizlemesi ve Android aynı karakterleri ve mobilya malzemelerini yükler. Dikey kamera kullanıcı geri bildirimiyle orta mesafeye alındı; ilk açılışın kamerayı tekrar uzaklaştırması giderildi. Zemin yazıları daha yüksek çözünürlükte hazırlanır. Gölge, yansıma ve kenar yumuşatma cihaz türü nedeniyle kapatılmaz. Hafif/orta yükte çözünürlük korunur; mobil otomatik hedef orta/yüksek kademede 60 FPS'tir. Ağır ısıda koruma devam eder.

Karakter bağlantı noktaları ve sabit dekorlardaki tekrarlı dönüşüm hesapları azaltıldı. Aynı masaüstü sahnesinde ortanca kare işlem süresi 1,7 → 1,3 ms; 81 karakter görüntüsünde piksel farkı sıfır. 294 birim kontrolü ve görüntü/önbellek kontrolleri geçti. Ayrı kimlikli [Kafe Caddesi Önizleme APK](cikti/FincanSokagi-v1.2.1-preview.apk), Play Store'daki oyunun yanında kurulabilir. [1.2.1 AAB](cikti/FincanSokagi-v1.2.1-mobile-parity.aab) sürüm kodu 4'tür; mağazaya yüklenmedi. Önceki önizleme A35'te ölçüldü; son paket USB bağlantısı kesildiği için henüz telefona kurulmadı. [Değişiklikler, ölçümler ve paket bilgileri](docs/MOBIL-GORUNTU-2026-09-10.md).

## Önceki web teslimi — 8 Eylül 2026

Kullanıcının son isteğiyle oyun web tarayıcısında çalıştırılır; GameLoop/emülatör çalışması durduruldu. Android paketleme bu teslimin tamamlanma ölçütü değildir. Karakterler ve mevcut oyuncu kaydı korunur. [Güncel ürün kalitesi raporu](docs/URUN-KALITESI-2026-09-08.md).

247 test ve web çizim kontrolleri geçti. Son 240 dakikalık rehberci simülasyonunda 1.785 servis, ₺11.498.908 gelir ve 177:12'de Sahil açılışı ölçüldü. Son 9 × 90 dakika politika matrisi ve on kayıt/çevrimdışı web senaryosu da geçti. Bunlar otomatik web kontrolleridir; fiziksel cihaz veya gerçek oyuncu geri dönüşü ölçümü değildir.

## Çalıştırma

Node.js 24 LTS önerilir. Testler Node'un TypeScript desteğini kullanır.

```powershell
npm ci
npm run dev
```

Tarayıcı: [yerel oyun](http://localhost:5173). WASD / yön tuşlarıyla veya oyun alanına dokunup sürükleyerek hareket et. Yakınlıkla etkileşim otomatik gerçekleşir. Menü açılınca oyun duraklar.

## Mevcut içerik

- Mahalle ve Sahil şubeleri; kademeli bölge açma, yeni makineler ve masalar.
- Aktif masa servisi, paket rafları, görünür kasa tahsilatı ve tam masa temizliği.
- Tezgâhtar, kasiyer, komi ve barista; şubeye özel ekipler ve yükseltmeler.
- Günlük/haftalık hedefler, festival, prestij, dekor ve görünür üniformalar.
- Türkçe / English; Ayarlar'dan değiştirilir, oyun kaydı korunur.
- 30, 45 ve 60 FPS seçenekleri; ekran ritmine uyarlama ve ısınmada kare hızı azaltma. Bunlar hedeflerdir, cihaz performansı garantisi değildir.
- Yerel kayıt, ikinci yedek yuvası, taşınabilir yedek kodu ve Android/iOS yerel depo aynası. Bulut hesabı yoktur.
- İsteğe bağlı ödüllü reklamlar; zorunlu geçiş reklamları varsayılan kapalıdır. Bu pakette Google test kimlikleri kullanılır; gelir üretmez.

Oyuncu masaya servisi ve kasa toplamayı üstlenir. Personel oyuncuyu tamamen devralmaz. Çevrimdışıyken stok hazırlanabilir; kendiliğinden para kazandıran sistem veya sabit müşteri albümü eklenmemiştir.

## Doğrulama

```powershell
npm test
npm run build
npm run acceptance -- --minutes=30 --lang=tr,en --seed=417
npm run test:interactions
npm run test:ui
npm run test:cast:production
npm run test:progression -- --minutes=90
```

Tarayıcı kontrolleri yerel Chrome ve Playwright kullanır, yeni geçici oturumlar açar. Kendi oyun kaydını silmez. Denge botu gerçek simülasyonu hızlandırır; gerçek oyuncu ilgisini veya telefon FPS'ini ölçmez. Sonuçlar `.devshots` altında tutulur.

6 Eylül tarihsel 1.2.0 düzeltme turu, o tarihteki AAB ve kontroller: [uygulama durumu](docs/YAYIN-UYGULAMA-2026-09-06.md) · [doğrulama raporu](docs/1.2.0-DOGRULAMA.md). 6 Eylül AAB arşivi: [release-fixed](cikti/FincanSokagi-v1.2.0-release-fixed.aab). Önceki durum: [4 Eylül incelemesi](docs/DURUM-VE-YOL-HARITASI-2026-09-04.md).

## Android ve iOS — ayrı paketleme başvurusu

Aşağıdaki komutlar mevcut platform desteği içindir; 8 Eylül web tesliminde native paket üretimi veya GameLoop çalıştırılması istenmiyor.

```powershell
npm run sync
# Java 21 ve Android SDK yapılandırılmış olmalı:
cd android
.\gradlew.bat assembleDebug assembleRelease bundleRelease
```

`android/key.properties` mevcutsa release çıktıları kayıtlı anahtarla imzalanır; yoksa imzasızdır. Anahtar ve parolaları kaynak kontrolüne ekleme. Sürüm adı package.json'dan gelir; Android versionCode ayrıca artırılır. Hazır test paketleri `cikti` altında bulunur.

iOS web kaynakları `npm run sync` ile yenilenir; uygulamanın derlenmesi ve cihaz testi macOS/Xcode gerektirir. [Yayın notları](docs/YAYIN.md).

## Karakterler ve PC web önizlemesi

Web ve Android `public/packs/current-cast` içindeki ortak karakterleri kullanır; üretimde başka bir karakter ailesine geçilmez. Mevcut model, kıyafet, animasyon ve geometri paylaşımı korunur. [Karakter dosyalarının kaynak kaydı](docs/KARAKTER-KAYNAGI.md) bu varlıkları özgün veya CC0 çalışma olarak tanımlamaz.

`npm run dev -- --host 127.0.0.1` ardından `http://127.0.0.1:5173/` adresini açın. Son derlemeyi görmek için `npm run preview -- --host 127.0.0.1 --port 4173` kullanın. `?characters=` seçeneği artık aileyi değiştirmez. Derleme kontrolü ortak pakette eksik/değişmiş dosya veya alternatif karakter kodu saptarsa durur. Geliştirmede `?rawRig` geometri karşılaştırması için korunmuştur.

## Oyun raporları

Varsayılan olarak en son 384 oynanış olayı, 90 etkin gün ve ilk başarı işaretleri cihazda tutulur. Ayarlar'dan rapor indirilebilir veya silinebilir. Rastgele kurulum/oturum kimlikleri kullanılır; oynanış olaylarında isim, e-posta ve reklam kimliği alanı yoktur. Hata kayıtları ayrıca cihazda tutulur.

Sunucu adresi tanımlanmadan ve oyuncu paylaşımı açmadan oynanış/hata raporları gönderilmez. Paylaşımı açmadan önceki olaylar sonradan yüklenmez. Kapatınca gönderilmemiş olayların paylaşımı kaldırılır. Reklam SDK'sının veri işlemesi ayrıdır; [gizlilik metni](docs/gizlilik-politikasi.html) bunu açıklar.

Yerel, küçük bir test grubu için:

```powershell
npm run telemetry:serve
# Ayrı terminalde, yalnız yerel test amacıyla:
$env:VITE_TELEMETRY_URL='http://127.0.0.1:8787/events'
npm run dev
# Oyuncu Ayarlar'dan paylaşımı açar.
# İndirilen raporları veya yerel alıcı kaydını özetle:
npm run telemetry:report -- .local-data/telemetry.ndjson
```

Alıcı yalnız 127.0.0.1 üzerinde dinler; izin verilen kaynakları denetler, olay tekrarlarını eler, istek/veri boyutunu sınırlar. Dosya 50 MB'a ulaşınca bakım gerekir. İnternete açık hizmet değildir. Barındırılan bir alıcı kullanılacaksa HTTPS, erişim, saklama/silme düzeni ve gizlilik sayfası ayrıca yapılandırılmalıdır. `.env.example` yalnız örnektir; gerçek sunucu veya reklam hesabı oluşturmaz.

D1/D7 raporu yalnız ilk günü gözlenen, ilgili günü tamamen dolmuş kurulumları hesaba katar. Örneklem yoksa oran `null` döner; bot sonucu gerçek oyuncu geri dönüşü diye sunulmaz.

## Fiziksel cihaz kontrolü — bu web tesliminin dışında

Bu bölüm ileride yapılabilecek cihaz ölçümünü tarif eder; mevcut çalışmada fiziksel cihaz sonucu üretildiği anlamına gelmez.

Android hata ayıklama paketinde WebView incelemesi açıktır; release paketinde kapalıdır. `node tools/device-check.mjs --serial=CIHAZ_SERI --adb=ADB_YOLU --seconds=90` normal hızda 30 ve 60 FPS ölçümü, kapanış/açılış ve kayıt kontrolü yapar. Başlangıç kaydını özel çıktı klasörüne yedekler ve sonunda geri yükler. `--output=` ile her test için ayrı klasör seçilebilir. USB üzerinden yetkilendirilmiş cihaz ve kurulu debug paket gerekir. Üç dakikalık test uzun ısınma veya düşük seviye cihaz kabulünün yerine geçmez.

## Web çizim bütçesi

Sabit kamera için renk ve derinlik önbelleği, ekran dışındaki istasyonların görsel güncellemelerini atlama, menü açıkken sahne çizimini durdurma ve karakter kemik dokularını serbest bırakma eklendi. Düşük kademede 3D alan 650.000 pikselle sınırlandırılır; arayüz yazıları doğal çözünürlükte kalır. Müşteri kapasitesi ve ekonomi kaliteye göre değişmez.

`npm run test:render` renk/derinlik, ekran dışı görünürlük, menü dönüşü, grafik bağlamı kurtarma, müşteri bellek temizliği ve işlemci yavaşlatma kontrollerini çalıştırır. Sonuçlar `.devshots/render-check` altına yazılır. Ayrıntılar: [PC web performans kontrolü](docs/WEB-PERFORMANS-2026-09-05.md).

## Çevrimdışı oynanış ve son kalite turu

Kurulu mobil oyunun servis, gelişim ve kayıt döngüsü yereldir; internet oyun koşulu değildir. Hesap veya sunucu gerektiren bir mekanik eklenmedi. İsteğe bağlı reklamlar oyun akışını bekletmez.

Görev yönlendirmesi, tam masa temizliği, süpürge alma/bırakma, alan ödeme göstergeleri ve günlük görev uygunluğu güncellendi. Ayrıntılar ve test kapsamı: [5 Eylül oynanış turu](docs/CEVRIMDISI-OYNANIS-2026-09-05.md). Çevrimdışı devam/kayıt ve satın alma kontrolleri `npm run test:offline` ile çalışır. Bu Android paket notu yalnız 5 Eylül oynanış turunun tarihsel kapsamıdır: o turda paketler yenilenmemişti. 8 Eylül teslimi web içindir; yeni APK bu teslimin koşulu değildir.

## Personel ve görsel düzen

Rol bazında kare personel ödemeleri, kaydedilen kısmi işe alım tutarları, sakin parke/toz görünümü, petrol–krem–bakır kıyafetler ve yerel hazır süpürge modeli eklendi. Ayrıntılar ve doğrulama: [5 Eylül personel ve görsel turu](docs/PERSONEL-VE-GORSEL-2026-09-05.md).

## Sade açılım ve yerel oyuncu testi

Kilitli eşya örtüleri kaldırıldı; satın alma zemindeki kareler, yaklaşınca fayda ve duruma uygun ödeme mesajlarıyla gösterilir. Açılışta çevre geometrisi yeniden birleştirilmez. Yeni davranış ölçümleri yalnız yerel/elle indirilen rapordadır; botlar ayrılır, D1/D7 tam gün kapsamı olmadan hesaplanmaz. [İnsan testi planı ve kaynaklar](docs/OYUNCU-TESTI-VE-ACILIM-2026-09-05.md).

## Tarihsel yayın değerlendirmesi — 6 Eylül 2026

Bu bölüm 6 Eylül durumunu kaydeder; son çalışma için [8 Eylül ürün kalitesi raporuna](docs/URUN-KALITESI-2026-09-08.md) bakın. 6 Eylül incelemesinde 151 test ve üretim derlemesi geçti; buna rağmen kasa hızı, el geliştirmeleri ve bazı görev/kapasite açıklamalarında yeni açıklar doğrulandı. Geniş yayın kararı henüz verilmedi. [Yayın kararı ve ayrıntılı 74 maddelik plan](docs/YAYIN-PLANI-2026-09-06.md), [filtrelenebilir iş listesi](docs/YAYIN-IS-LISTESI-2026-09-06.csv).

## Telefon odağı ve yardımcı dengesi

Yakın telefon kadrajı, tek belirgin anlık iş satırı ve açılır yan iş seçimi eklendi. Yardımcılar oyuncunun almak üzere olduğu ürünü ve başladığı masa bakımını devralmaz; servis, özel sipariş ve kazanç toplama oyuncuda kalır. [Değişiklikler ve doğrulama](docs/OYUNCU-ODAGI-2026-09-07.md).

## Masa erişimi ve servis temposu

Masa ve kova kenarlarından erişim, kasa/ürün önceliği, ihtiyaç adedine göre raf seçimi ve iş yüküne göre müşteri kabulü düzeltildi. [Değişiklikler ve sınamalar](docs/SERVIS-VE-DENGE-2026-09-08.md).

## Reklam için kafe tasarım provası — 8 Eylül 2026

Bu bölüm önceki 12 masalı tasarımın kaydıdır. Güncel varsayılan reklam için aşağıdaki **Premium reklam teslimi** bölümüne bakın.

Güncel çıktı: [reklam.mp4](reklam.mp4). Tasarım önizlemesi: [kafe-tasarimi.jpg](kafe-tasarimi.jpg). 25 saniye, 1080×1920, 30 FPS, H.264 + stereo AAC; Türkçe başlıklar, özgün ses ve marka kapanışı içerir.

Kullanıcının düzeltmesiyle çekim, normal yerel oyunda görünen **PlayerS01** karakterini ve mevcut müşteri/personel ailesini kullanır. Yanlış karakter yüklenirse kayıt durur. Açık taş zemin, özel masa/sandalye ve tezgâhlar, dolu vitrinler, 12 masa, altı çalışan ve lounge çekime özel tasarım provasıdır. Asıl kafenin yerleşimi ve oyuncu kayıtları değiştirilmedi. Kullanıcı tasarımı beğenirse ana oyuna uyarlama ayrı bir çalışma olacak.

`/reklam.html` yalnız yerel geliştirme sunucusunda çalışır; yeni tasarım ve özel karakterler normal üretim paketine girmez. Kayıt/ayar/dil verilerini okumayan veya yazmayan yeni bir GameState/World kullanılır. Çekim hazırlanmış başlangıç ve ileri aşama durumlarını kurgu geçişleriyle birleştirir. Servis, para toplama, bulaşık boşaltma ve masa silme mevcut oyun sistemleriyle gerçekleşir.

- `npm run promo:preview`: tasarım provasını açar.
- `npm run promo:record`: karakteri ve eylemleri denetler, 750 kare kaydeder, sesi işler ve `reklam.mp4` üretir.
- `npm run promo:check`: sahneyi ve örnek kareleri kontrol eder.
- `npm run promo:check-save`: normal oyun → tam çekim → normal oyun geçişinde kayıtları, karakteri ve asıl yerleşimi kontrol eder.
- `npm run promo:check-video`: son MP4'ü Chrome'da sonuna kadar oynatır.

Yerel Chrome, Playwright ve `.tools/video` altındaki FFmpeg/FFprobe kullanılır. Farklı araç konumu `FFMPEG_PATH` / `FFPROBE_PATH` ile belirtilebilir. Güncel sonuçlar `.devshots/reklam-v3` altında. [Personel çakışması düzeltmesi ve büyüme değerlendirmesi](docs/PERSONEL-CARPISMA-2026-09-08.md). [Tasarım ve doğrulama raporu](docs/REKLAM-TASARIM-PROVASI-2026-09-08.md).


## İkinci kafe tasarımı: Ütopya — 8 Eylül 2026

[Yeni Ütopya videosu](reklam-utopya.mp4), [mekân görseli](kafe-utopya.jpg), [iki tasarımı yan yana izleme](kafe-karsilastirma.html). Su avlusu, pembe ağaçlar, cam kemerler, yeni mobilyalar ve 9 gerçek masalı iki oturma kanadı içerir. İlk video korunur; kullanıcı tasarım seçmeden ana oyuna aktarılmaz.

`npm run promo:utopia` yeni MP4'ü üretir; `npm run promo:utopia:preview` ayrı sahneyi açar. Kontrol araçları `--concept=utopia` seçeneğiyle yeni tasarımı sınar. Yeni sonuç klasörü `.devshots/reklam-utopya`; [tasarım ve doğrulama ayrıntıları](docs/UTOPYA-KAFE-2026-09-08.md).

## Yeni reklam revizyonu: İmza şehir kafesi — 8 Eylül 2026

[Yeni video](reklam-imza.mp4), [kafe görseli](kafe-imza.jpg), [karşılaştırma sayfası](kafe-karsilastirma.html). Antrasit–ceviz–amber malzemeler, daha sıkı yerleşim, birleşik üretim bankosu, yakın aksiyon çekimleri ve yeni reklam yazıları içerir. Ütopya ve ilk tasarım dosyaları korunur.

`npm run promo:imza` videoyu üretir; `npm run promo:imza:preview` ayrı sahneyi açar. Kontrol araçlarında `--concept=imza` kullanılır. Ana oyun ve kayıtlar bu tasarıma geçirilmedi. [Ayrıntılar ve kontroller](docs/IMZA-KAFE-2026-09-08.md).

## Premium reklam teslimi — 8 Eylül 2026

[reklam.mp4](reklam.mp4), [yerel oynatıcı](reklam-izle.html) ve [kafe görünümü](kafe-premium.jpg). Yeni varsayılan sahne dokuz gerçek masa, altı çalışan, beş ürün, daha dolu müşteri kadrosu, terrazzo salon, ahşap lounge ve mevcut yerel oyuncu karakterini kullanır. 25 saniye, 1080×1920, 30 FPS; Türkçe yazılar, gerçek olaylara bağlı ses efektleri ve marka kapanışı içerir.

`npm run promo:record` filmi üretir; `npm run promo:preview` ayrı sahneyi açar. Normal oyun ve kayıtlar korunur. Güncel sonuçlar `.devshots/reklam-premium` klasöründedir. [Tasarım ve doğrulama raporu](docs/REKLAM-PREMIUM-2026-09-08.md).

## Ana oyunda hibrit kafe — 8 Eylül 2026

Kullanıcının onayıyla reklamın taş/ceviz/yeşil görünümü normal kafeye uygulandı. Kenney hazır masa, minderli koltuk, bank, kanepe ve bitki modelleri kullanılıyor. Mevcut odalar, bahçeler, aşamalı açılım, karakterler ve kayıt kimlikleri korundu. [Yeni görünüm](kafe-hibrit.jpg) · [Ayrıntılar ve kontroller](docs/HIBRIT-KAFE-2026-09-08.md).

## Mevcut oyundan 25 saniyelik reklam — 13 Eylül 2026

[reklam-full.mp4](reklam-full.mp4) · [Oynatıcı](reklam-full-izle.html) · [Çekim ve doğrulama notları](docs/REKLAM-FULL.md).

`npm run promo:full` mevcut Köşe haritası ve oyun karakterlerinden 1080×1920, 30 FPS, H.264/AAC videoyu üretir. Bellekteki ayrı çekim durumu oyuncu kayıtlarını okumaz veya yazmaz. Temizlik, hazırlık, üç servis, kasa tahsilatı ve gerçek çalışan alımı/raf doldurma gösterilir. `npm run promo:full:preview` otomatik çekim modunu, `npm run promo:full:check-save` kayıt dönüş kontrolünü, `npm run promo:full:check-video` son MP4'ün tam oynatma kontrolünü çalıştırır. Bu giriş eski konsept kafe sahnelerini kullanmaz.
