# Ürün kalitesi çalışma kaydı — 8 Eylül 2026

Kullanıcı kapsamı: karakterleri değiştirmeden, çevrimdışı ve oyuncu merkezli oyunun bütün alanlarını alt ajanlarla inceleyip profesyonel ürün seviyesine getirmek. Karakter seçimi, modelleri, kıyafetleri ve animasyonları korunur. Mevcut kullanıcı kaydı test amacıyla değiştirilmez. Son kullanıcı yönlendirmesiyle teslim hedefi web tarayıcısıdır; GameLoop/emülatör çalıştırılması durduruldu. Android paketleme ve native cihaz doğrulaması bu teslimin tamamlanma ölçütü değildir.

## Kabul ölçütleri

- İlk kullanım, masa/kasa/ürün akışları ve tüm satın almalar tutarlı, kaydedilebilir ve fiziksel olarak ulaşılabilir.
- Sağ/sol alanlar keşfedilir, satın alınır, işletilir ve küçük telefonda okunur; kartlar oyuncuyu ve servis temasını kapatmaz.
- Oyuncu ana işi taşır; yardımcı yükseltmeleri ölçülebilir yarar sağlar.
- 320 px dikey, büyük telefon ve yatay düzen; menü/geri dönüş ve dokunma hedefleri kullanılabilir.
- Bozuk/yarım kayıt, içe aktarma, arka plan ve şube geçişinde güvenilir kurtarma.
- Doğal ilerleme ve hazırlanmış geç oyun senaryoları ayrı ölçülür; açıklanmayan uzun takılma veya sıfırlama yok.
- Üretim derlemesi, yerel varlıklar, çizim/kaynak yaşam döngüsü ve gerekli oyun kontrolleri geçer.
- Karakter dosyaları başlangıç özetiyle birebir aynı kalır.

## Teslim kapsamı

Kullanıcının son yönlendirmesiyle çalışma web üzerinde tamamlanır; GameLoop/emülatör ve native paketleme kapsamdan çıkarıldı. Karakterler ve kullanıcı kaydı korunarak yerel web kabulü yapıldı. Aşağıdaki sonuçlar bot ve tarayıcı kontrolleridir; insan beğenisi veya fiziksel telefon ölçümü değildir.

## İlk tur bulguları ve uygulama

- Yan alanlarda güvenli kapı/tezgâh/şerit rotaları 43/112 iken 112/112 oldu; 18 gerçek yürüyüş ve yan sipariş döngüleri geçti.
- Yan iş kartları başı/tepsiyi kapatmıyor; uzakta kompakt.
- Küçük telefon öğreticisi 127 px yerine 74 px; yatayda oyuncunun gövdesinden çıkarıldı. Panel odağı, tekrar satın alma, çentik ve dönüş düzeltildi.
- Kayıt içe aktarma iki yuvayı eşliyor; bozuk veriler yüklenmiyor; kota ve yedek yazım hataları kurtarılabiliyor. 13 eski v8 kayıt kabul edildi.
- Ses ayarları kuru ses/yankı birlikte uygulanıyor; ilk dokunuş öncesi müzik düzeyi, hızlı askı/devam ve kapanış düzeltildi.
- Kapanan Game artık kalite/ısı dinleyicisini bırakıyor.
- Karakterlere dokunulmadı; başlangıçta 37 korunan kaynak/model dosyasının SHA256 özeti alındı.

## İlerleme tabanı

Eski fiyatlarla 3 politika × 3 başlangıç × 90 dk koşusunun tamamı geçti; fakat rehberci/temizlikçi politikalarda waffle çoğu kez 90. dakikada kapalı. 240 dk rehberci oturumda 416.403 gelir, 1.031 servis, hedef 26; frappe 181:43'te açıldı, VIP/Sahil kapalı kaldı. Son satın alma arası 1.999 sn. Teknik takılma olmaması bu büyüme ritmini tek başına uygun yapmıyor. Ham veriler .devshots/product-quality-2026-09-08/progression-before ve late-before altında.

Son koşuda sınanan ekonomi v3: erken ilk masa/kahve/tost bedelleri aynı; orta/geç ürün ve oda bedelleri, küçük bonus dekorları ve Sahil basamakları birlikte azaltıldı. Olağan alan ödülü %30; şube kasa hedefi/ödülü gerçek bedele bağlı. Eski yarım ödemede fazla tutar sadece satın alma tamamlanırken iade edilir; işletme geliri sayılmaz. 240 dakikalık sonuç aşağıda karşılaştırıldı; son 9 × 90 dakika matrisi de aynı derlemeyle geçti.

## Tamamlanan sonuçlar — yan alanlar

Bahçe Çay Evi ve Avlu Paket Servisi için kapı, çalışma noktası ve kuzey/güney dolaşım hatları açıldı. Aynı 112 rota denemesinin geçerli sonuç sayısı 43'ten 112'ye çıktı; engelli uç, eksik hedef ve engelli yol sayıları sıfırlandı. Normal hareketle yapılan 18 yürüyüş de hedefe ulaştı; bu kaydın yerleşim hata listesi boş.

320 ve 390 px genişlikte çalışma ve kuzey yaklaşımı toplam 8 kadrajla kontrol edildi. Yakındaki iş kartı oyuncunun başını açık bırakıyor; uzaktaki kartın yüksekliği ve metin alanı yarıya iniyor. Ölçülen çizim çağrıları 152–168 aralığında; bunlar sabit tarayıcı kadrajı ölçümleridir, fiziksel telefon kare hızı ölçümü değildir. Tarayıcı hata listesi boş ve karakter paketi bütün kadrajlarda `cleanit-apk-local-test`.

Kanıtlar: [rota karşılaştırması](../.devshots/side-premium-2026-09-08/circulation-before-after.json), [yürüyüş ve 8 kadraj raporu](../.devshots/side-premium-2026-09-08/after/report.json).

## Tamamlanan sonuçlar — telefon arayüzü

320×568 Türkçe, 390×844 İngilizce ve güvenli ekran kenarları tanımlanmış 844×390 Türkçe düzenlerde toplam 30 ekran durumu kaydedildi. HUD, uzun öğretici, yan işler ve yedi panel bu matrise dahil. 320 px genişlikte uzun öğretici 127,33 px'den 73,86 px'ye indi; öğretici oyuncunun baş/gövde alanından ayrılıyor.

Üç düzende de sayfanın yatay taşması yok; denetlenen panel kontrolleri en az 44×44 px. Panel metni kırpılma kontrolü geçti. Ham rapordaki `dept` iç sarmalayıcı taşmaları kontrol betiğinin açık istisnasıdır; bunlar sıfır taşma iddiasına dahil edilmez. Panel ve geri dönüş penceresi çentik payına sığıyor; açık panelin 667×375'e canlı dönüşü de geçti.

Üç etkileşim kaydında panel açılış odağı, panel içi Tab/Shift+Tab çevrimi, Escape ile başlatıcıya dönüş ve arka planın etkisizleşmesi doğrulandı. Çift etkinleştirme tek yükseltme ve tek ödeme üretti: 100.000 bakiyeden 180 düşerek 99.820 kaldı, seviye yalnız bir arttı ve aynı kontrol odakta kaldı. İsteğe bağlı teklifin açma/kapatma hedefleri ile geri dönüş penceresinin klavye akışı da kontrol edildi. Kaydedilen tarayıcı hatası yok.

Kanıtlar: [önce](../.devshots/premium-phone-2026-09-08/before/results.json), [30 ekran ve 3 etkileşim sonucu](../.devshots/premium-phone-2026-09-08/after/results.json). Bu hazırlanmış arayüz senaryolarındaki para ve açık alanlar, doğal ilerleme kanıtı değildir.

## Tamamlanan sonuçlar — ana dünya sunumu

18 masanın tabla üstü 1 metreye tutarlı biçimde yerleşti; 496 ürün yerleşimi gerçek tabla yüzeyi üzerinden doğrulandı. Masa bitkileri tabla üzerine alındı ve numara plakalarına destek eklendi. Sarf tezgâhları 1,5×0,9 metre ayak izine getirildi; ölçülen üst sınırları peçetede 1,39, kâğıtta 1,321 metre. Semaver görüş testindeki 1,0 / 1,3 / 1,6 metre hedef seviyelerinde araya giren nesne sayısı sıfır.

Alçak bölme ve korkulukların üzerinde desteksiz duran salon/VIP duvar tabloları ile teras neonu kaldırıldı. Kuzey mutfağın tam boy duvarındaki neon ve mevcut yan duvar tablosu korunuyor. İlk/orta/tam Köşe, salon/VIP girişleri ve içleri, fuaye ile ilk/tam Sahil kadrajları toplam 20 hazırlanmış görünümde kontrol edildi; yerleşim ve tarayıcı hata listeleri boş. Bu geniş kapsamlı hazırlanmış görüntüler doğal oyun ilerlemesi olarak sunulmaz.

Son oyuncu görünümü ayrıca önceki ekonomiyle kazanılmış mevcut 240 dakikalık rehberci kayıtla, ayrı ve geçici tarayıcı bağlamında üretildi. Üretim, masalar, salon, kilitli VIP yaklaşımı ve fuaye olmak üzere 5 kadrajda normal simülasyon ve gerçek müşteri gelişleri çalıştı. Hedef 26 / `VIP SALON’u aç`, taşıma kapasitesi 5; salon toplamı 30 koltuk. Yeni para veya alan açma hilesi kullanılmadı. Kullanıcının tarayıcı kaydına dokunulmadı. Kamera yerleşirken normal simülasyon da ilerletildiği için müşteri görünürlüğü ve gölgeler eşleşiyor. Beş görünümün yerleşim ve tarayıcı hata listeleri boş; kuzey mutfak neonunun korunduğu ayrıca doğrulandı.

Kanıtlar: [masa/ürün/tezgâh ölçümleri](../.devshots/main-premium-2026-09-08/surface-report.json), [20 hazırlanmış kadraj](../.devshots/main-premium-2026-09-08/final-audit/report.json), [gerçek kayıtla 5 son kadraj](../.devshots/main-premium-2026-09-08/realistic-final/report.json). Son görünüm örneği: [masalar ve servis](../.devshots/main-premium-2026-09-08/realistic-final/tables.png).

## Koruma ve kanıt sınırı

Karakter seçimi, model, kıyafet, animasyon ve kaynak renkleri bu görsel çalışmaların değişiklik kapsamı dışında tutuldu. Başlangıçtaki 37 korunan kaynak/model dosyasının SHA256 özeti son kontrolde birebir eşleşti; değişen dosya yok. Kadraj raporlarında aynı karakter paketinin görülmesi, bu 37 dosyalık bütünlük karşılaştırmasının yerine geçmez.

Bu rapor tarayıcı otomasyonu, hazırlanmış durumlar ve gerçek eylemlerle ilerletilmiş kayıtların kanıtıdır. Fiziksel Android/iOS cihazında dokunma, sıcaklık, pil veya kare hızı ölçümü ve gerçek oyuncularla geri dönüş/retention ölçümü henüz yoktur. Tamamlanan görsel kontroller, bu sonuçlar varmış gibi yorumlanmaz. Son 9 × 90 dakika ilerleme matrisi tamamlandı; gerekli web kabul kontrolleri geçti. Kullanıcının web yönlendirmesiyle Android/GameLoop çalışması durdurulmuştur; native paket veya emülatör sonucu web teslimi için beklenmez.

## Son web doğrulaması ve 240 dakika karşılaştırması

247 test geçti. Web çizim denetiminde menü açıkken yeni çizim sayısı 0 ve simülasyon ilerlemesi 0; menüden dönüş ve grafik bağlamı kurtarma geçti. Karakter bellek denetiminin kaynak sayacı 69'dan 69'a döndü; bu sayı bayt veya fiziksel cihaz RAM ölçümü değildir. WebGL hata kodu 0, yerleşim ve tarayıcı hata listeleri boş. Servis doğrulamasında 432 servis/temizlik örneği, 72 tam döngü ve 28 kova kontrolü geçti. Yardımcı kontrolleri oyuncunun ayırdığı ürünü alabilmesini ve başladığı masa bakımını korudu; ana oyuncu görevleri personel tarafından devralınmadı.

Kanıtlar: [web çizim ve bellek](../.devshots/render-check/result.json), [servis sonuçları](../.devshots/service-balance-2026-09-07/after/results.json), [oyuncu önceliği](../.devshots/player-assists-2026-09-07/results.json).

Aynı rehberci politika ve 417 başlangıcıyla 240 dakikalık gerçek eylem simülasyonu tekrarlandı. Bu koşu ekran başında geçen dört saatlik insan testi değildir; oyun kuralları üzerinden hızlandırılmış otomatik oynanıştır.

| Ölçüm | Önceki 240 dakika | Son 240 dakika |
| --- | ---: | ---: |
| Servis | 1.031 | 1.785 |
| Toplam kazanılan gelir | ₺416.403 | ₺11.498.908 |
| Hedef dizini | 26 | 34 |
| Waffle açılışı | 84:14 | 56:56 |
| Frappe açılışı | 181:43 | 93:55 |
| VIP açılışı | Açılmadı | 116:14 |
| Sahil açılışı | Açılmadı | 177:12 |
| Sahil dondurma açılışı | Açılmadı | 179:23 |
| Sahil veranda açılışı | Açılmadı | 187:42 |
| En uzun eylemsizlik | 65 sn | 80 sn |
| Personel kurtarma müdahalesi | 0 | 0 |
| Koşu sonundaki satın alma bekleme aralığı | 1.999 sn | 123 sn |

Yeni koşuda orta/geç ürünler ve ikinci şube aynı sürede erişilebilir oldu. En uzun eylemsizlik 80 saniyedir; önceki koşudan daha düşük olduğu iddia edilmez. Gelir artışı yeni ürünler ve şubeye ilerleyebilen bu tek politikanın sonucudur; bütün oyuncu tercihleri için aynı büyümeyi garanti etmez.

Sahil'in ücretsiz başlangıç bölgesi `p1` eksik açılma durumundan çıkarıldı. Şube başlangıcında oyuncunun ödeme karesi üzerinde doğması nedeniyle istemeden ödeme başlaması düzeltildi. Son 240 dakika sonucu bu düzeltmeleri içeren koşudur.

Kanıtlar: [önceki koşu](../.devshots/product-quality-2026-09-08/late-before/guide-417.json), [son koşu](../.devshots/product-quality-2026-09-08/late-final/guide-417.json), [son özet](../.devshots/product-quality-2026-09-08/late-final/summary.json). Son 3 politika × 3 başlangıç × 90 dakika matrisi aynı derlemeyle tamamlandı.
## Son politika matrisi ve kayıt kabulü

Üç tercih × üç sabit başlangıç için dokuz 90 dakikalık oturum geçti. Hepsinde öğretici tamamlandı; yerleşim ve çalışma hatası yok, personeli kurtarmak için müdahale gerekmedi.

| Tercih | 90 dakikada servis aralığı | En uzun eylemsizlik | Waffle açılışı |
| --- | ---: | ---: | --- |
| Rehberi izleyen | 381–386 | 52 sn | 51:05–56:56 |
| Yükseltmeye öncelik veren | 392–410 | 37 sn | 90 dakikada açılmadı |
| Temizliğe öncelik veren | 268–326 | 46 sn | 69:30–70:38 |

Yükseltme odaklı tercih parasını mevcut istasyonlara ve personele ayırdığı için yeni bölgelere daha geç ulaşır; bu tercih tek rehberci sonuçla gizlenmez. Rehberci ve temizlikçi tercihlerde orta ürünler önceki matrise göre daha erken açıldı. Kanıt: [dokuz oturum özeti](../.devshots/product-quality-2026-09-08/progression-final/summary.json).

On web kayıt/çevrimdışı senaryosu birlikte geçti: yüklenmiş oyunda çevrimdışı devam, ödeme-kayıt, fiyat değişimi iadesi, gerçek şube satın alma, gerçek devir, hedef yönlendirmesi, tam masa bakımı, süpürge dönüşü, süpürge yanındaki leke ve masa seçimi. Çalışma hatası ve beklenmeyen dış ağ isteği yok. Tarayıcı kaynaklarının ilk yüklenmesi yerel sunucudan yapılır; bu kontrol web için çevrimdışı ilk yükleme/PWA iddiası değildir.

Sahil başlangıcında ₺123 sekiz saniye bekleyince ₺123 kalır; ödeme çakışması yok, rehber/üretim/müşteriler çalışır. Devir iki dünyayı kaldırıp Köşe'yi kurar; taşıma, süpürge ve robot temizlenir; kalıcı puan ve ayarlar korunur. Yeni sipariş, üretim, masa servisi ve para toplama çalışır; yeniden yüklenen bakiye, puan ve hedef aynıdır. Kanıt: [on senaryo](../.devshots/offline-flow-check/results.json).

Eski tarayıcılar için Canvas ve Path2D yuvarlak kart çiziminde 216 yerel karşılaştırma modern çizimle birebir eşleşti. Mevcut modern yöntem değiştirilmez. [Karakter bütünlüğü ve derleme özeti](../.devshots/product-quality-2026-09-08/characters-after.json): 37/37 aynı, değişen dosya yok.

Yükseltme etkilerinin son entegrasyonunda 54 kasa hızı, 33 aktarım ve 12 personel kapasitesi ölçümü geçti. Komi iki masayı hazırlarken oyuncunun para/temizlik istatistiğini yapay olarak artırmadı; oyuncunun tamamladığı masa hedefi bir kez ilerledi. [Yükseltme ölçümleri](../.devshots/mechanics-upgrade-check/results.json).
