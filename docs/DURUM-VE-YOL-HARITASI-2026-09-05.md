# Kafe Caddesi — güncel durum, eksikler ve rekabet planı

5 Eylül 2026. Önceki konuşma, güncel kod, yeniden çalıştırılan 100 test, yeni üretim web derlemesi, TR/EN oynanış kontrolü ve rakiplerin Google Play sayfaları temel alınmıştır.

**Karar:** Oynanabilir ve temel sistemleri kurulmuş bir 1.2.0 var. Öncelik; beğenilen karakter kalitesini yayın sürümünde tamamlamak, ilk oturumdan sonraki görev/temizlik akışını düzeltmek ve düşük donanımda gerçek oyuncuyla doğrulamak. Mevcut kanıtlar ticari başarıyı veya geniş dağıtıma hazır olmayı göstermiyor.

## Nerede kalmıştık?

Son isteğin, yeni prosedürel karakterleri beğenmediğin için önceki karakterlere dönmek ve düşük cihazlardaki gereksiz çizimleri azaltmaktı. Ardından **yalnız PC web önizlemesinde görmek, cihaza sonra yüklemek** istediğini belirtmiştin. En son kare başına çizim sayısını sormuştun.

- PC geliştirme önizlemesinde eski oyuncu, çalışan ve müşteri modelleri geri geldi. Koşudaki üst kol salınımı %20 yumuşatıldı.
- Ölçülen 18 karakterli yerel karşılaştırma sahnesinde, sabit kamerada çizim çağrıları **352 → 193**, yaklaşık %45 azaldı. Menü açıkken tekrar eden 3D çizim durduruldu; görünmeyen istasyonlar, statik sahne önbelleği ve müşteri kaynak temizliği üzerinde çalışıldı. Bu sayı bütün sahnelerin veya telefon performansının sabit değeri değildir. [Performans kaydı](WEB-PERFORMANS-2026-09-05.md)
- **Android APK/AAB 1.2.0 / versionCode 3 daha önce hazırlanmıştı. Son PC performans çalışması Android'e yeniden paketlenmedi.** Paket dosyalarının yerel zamanı 5 Eylül yaklaşık 00:34. Bu incelemede kurulum veya paketleme yapılmadı.
- PC geliştirme görünümü ile üretim görünümü farklı: geliştirme yolu yerel karşılaştırma karakterlerini, üretim projenin özgün karakterlerini kullanıyor. Dolayısıyla beğendiğin karakter kalitesi yayın tarafında henüz sonuçlandırılmış değil. [Karakter seçimi](../src/chars/index.ts:9)
- Son Git commit'i **19 Ağustos**; sonraki çalışma hâlâ çok sayıda değiştirilmiş/yeni dosya olarak duruyor. Aynı sürüm numarası farklı içerikleri temsil edebiliyor.

Çekirdek: **sipariş → üretim/ürün alma → masaya servis veya paket rafı → para toplama → temizlik → büyüme.** İki şube, dört çalışan rolü, istasyon/oyuncu gelişimi, günlük/haftalık görev, festival, prestij ve dekorasyon zaten var.

## Önceki eksiklerden kapananlar

Başlangıcın hareket etmeden atlanması, ilk servis döngüsü, birçok yerleşim/rota sorunu, özgün karakterlerde üniforma ve rolün görünmesi, kayıt yedekleme/native yazma sırası, reklamın çift ödül vermesini önleme ve ilk açılış bildirimleri üzerinde düzeltmeler yapılmış. TR/EN altyapısı ve oyuncu davranışı ölçümü de eklenmiş. Bunları yeniden sıfırdan yapılacak işler diye listelemek yanlış olur. [1.2.0 doğrulaması](1.2.0-DOGRULAMA.md)

**İngilizce altyapısının bulunması, bütün ekran metinlerinin bitmiş olduğu anlamına gelmiyor:** bugünkü çalıştırmada kalan metin hataları görüldü.

## Bugün doğrulanan açıklar

| Sıra | Bulgu ve kanıt | Yapılması gereken |
|---|---|---|
| **1 — oynanış** | Her dildeki 15 dakikalık yeni bot koşusu 113 servis yaptı; temizleme sayacı 1'de kaldı, 7. görev “3 zemin lekesi sil” 0/3 idi. Kodda raf ikmali ve sipariş, kirli masa ve zeminden önce geliyor. Rehber mevcut görev için ayrı öncelik kullanmıyor. | Göreve dokununca ilgili işi takip etme; uzun süre bekleyen kirli masa/zeminin önceliğini artırma; servis ile temizlik arasında anlaşılır geçiş. Bir yapılabilir iş sürekli ertelenmemeli. [Rehber](../src/sim/World.ts:1864) |
| **2 — yayın görünümü** | Son tercih edilen karakterler yalnız yerel önizlemede; APK ve üretim başka karakter gösteriyor. | Beğendiğin siluet, ölçek, taşıma ve koşu kalitesini dağıtılabilir özgün/lisanslı karakterlerde tamamlamak. Önizleme, mağaza görüntüsü ve paket aynı onaylı görünümü göstermeli. [Seçim](../src/chars/index.ts:9) |
| **3 — çeviri** | İngilizce üretim ekranında “Sv 0/10”, “Kilitli”, “2 sandalye”, “6 depo”, “1 kupon”, “7. hedef”, “AL” ve “6 sarf malzemesi doldur” kaldı. | Dinamik metinleri dil tablosuna almak; çoğul/tekil ifadeleri ve dar ekranı kontrol etmek. Çeviri testi görünen ekranları da kapsamalı. [Paneller](../src/ui/Panels.ts:114), [günlük görevler](../src/sim/Daily.ts:85), [festival](../src/sim/Festival.ts:170) |
| **4 — günlük görev uygunluğu** | Yeni kayıtta tuvaletler kilitliyken sarf doldurma görevi gösterildi. Görev seçimi tarih/geçmiş sayacı kullanıyor; açılmış mekanikleri filtrelemiyor. | Görevleri erişilebilir ekipmana göre seçmek. Günün görev kimliklerini kayıtta sabit tutmak; yeniden girişte ödül tekrarını önlemek. [Görev seçimi](../src/sim/Daily.ts:112) |
| **5 — kabul ölçütü** | Otomasyon öğreticinin bitmesini, en az bir servis ve bir temizliği yeterli sayıyor. İki şubenin tüm bölgeleri ayrıca doğrudan açılarak yerleşim kontrolü yapılıyor. | 10–30 dakikada görev ilerlemesi, tekrar eden masa dönüşü, uzun bekleyen işler ve çalışan katkısı için kontroller eklemek. Doğal kazançla ilerlemeyi yerleşim kontrolünden ayrı ölçmek. [Kabul aracı](../tools/acceptance.mjs:89) |
| **6 — cihaz performansı** | Önceki S23 kontrolü 30 ve 60 FPS'te 90'ar saniye. Son çizim değişiklikleri fiziksel düşük/orta cihazda ölçülmedi. | Güncel yayın karakterleriyle paket üzerinden 30 dakikalık test; takılma, bellek, pil, ısınma, arka plan dönüşü ve kayıt. Tarayıcıdaki çizim azalmasını doğrudan telefon FPS kazancı saymamak. |
| **7 — yayın ve gelir** | Paket test reklam kimlikleri kullanıyor. Önceki native reklam testi özel DNS engeline takılmış; izleme–ödül–kapatma döngüsü tamamlanmamış. Canlı mağaza/gizlilik durumu bugün doğrulanmadı. | Reklam yüklemesine izin veren bağlantıda SDK kabulü; ardından üretim ayarları, canlı metinler ve mağaza paketi. [Paket raporu](1.2.0-DOGRULAMA.md) |
| **8 — gerçek oyuncu verisi** | Yerel ölçüm ve D1/D7 hesap araçları hazır; paketlerde alıcı tanımlı değil ve gerçek oyuncu grubu sonucu bulunmuyor. | Yeni oyuncularla test; rapor dışa aktarma veya uygun paylaşım altyapısıyla sürüm bazlı toplama. İlk satış, görevde bekleme, geliştirme, bırakma nedeni ve ertesi gün/yedinci gün dönüşünü izlemek. [Ölçüm](../src/core/Telemetry.ts) |

Bot bulgusu **insanların kesinlikle 7. görevde kilitleneceği** anlamına gelmez. Bot da satın alma pedlerine öncelik veriyor ve kendi politikasını uyguluyor. Ancak rehber sırası kaynakta görülüyor; bu yolun 15 dakikada temizlik/görev ilerletmemesi, “test geçti = oyun temposu doğru” sonucunu geçersiz kılıyor. Önceki 60 dakikalık ham koşuda da temizleme sayacı 1, son görev indeksi 13'tü. Önce rehber ve bot politikası ayrıştırılmalı; tek botun gelirine bakıp bütün fiyatları değiştirmemeli.

## Nasıl bir oyun olmalı?

**Tek cümlelik vaat:** “Küçük mahalle kafeni kendi ellerinle canlı bir işletmeye dönüştür.” Çay, semaver, tost, tepsi, masa servisi ve temizlik bir bütün oluşturmalı. Oyuncu yaptığı işin neden gerekli olduğunu ve sonucunu ekranda görmeli.

**İlk dakika:** Bir müşteri, bir ürün, görünür teslim ve para. Bugünkü açılışta hareket anlatımı var; ayrıca kilitli mobilyalar, büyük satın alma pedi ve yoğun zemin deseni kadrajı dolduruyor. Görsel değerlendirmem: oyuncu, ilk müşteri ve çalışılacak nokta daha belirgin olmalı; satın alma sunumu ilk satıştan sonra öne çıkmalı. [Yeni üretim açılışı](../.devshots/audit-2026-09-05-production/tr-first-screen.png)

**İlk 5–15 dakika:** Oyuncu raf, masa, kasa ve temizliği ayırt etmeli. Çalışan alımı bir işi gerçekten rahatlatmalı; görev yazısı, rehber ve yapılabilir işler aynı hedefi desteklemeli. Ekranda “leke sil” yazarken ok sürekli ürün istememeli. Ürün/masa eşleşmesi ve iş bitişi kısa hareket, ses ve küçük ödülle okunmalı.

**Görsel dil:** Beğendiğin önceki karakterlerin gövde oranı ve hareket ağırlığı başlangıç referansı. Önizlemedeki yoğun parke, açık renk mobilyalar, hedef balonları ve yan düğmeler aynı dikkat alanını paylaşıyor; gereksiz desen ve eşzamanlı uyarılar azaltılmalı. Bunlar ekran incelemesine dayalı tasarım önerileridir; yeni oyuncu gözlemiyle doğrulanmalı. [Son yerel önizleme](../.devshots/acceptance-web-performance/tr-after-play.png)

**Sonraki oturumlar:** Yeni oda yalnız daha pahalı masa getirmemeli; mevcut VIP odasında servis sırasını seçmek veya Sahil'de farklı ürün yoğunluğu planlamak anlamlı olmalı. Festivalin sayaç/çarpan yapısı, küçük bir görsel dönüşüm ve farklı servis isteğiyle zenginleştirilebilir. Bir seferde bir içerik deneyi yapıp etkisini ölçmek.

Önerilen başlangıç hedefleri: 10 yeni oyuncudan en az 8'inin ilk satışı yardım almadan yaklaşık 60 saniyede yapması; ilk anlamlı geliştirmenin 1–3 dakikada gelmesi; ilk çalışanın ilk oturumda görünür fayda sağlaması. **Bunlar tasarım hedefleri; ölçülmüş insan sonucu veya sektör standardı değil.** Orta sınıf cihazda tutarlı 30 FPS taban, uygun cihazlarda isteğe bağlı 60 FPS hedeflenmeli. Uzun oturumdaki kare süresi sıçramaları da izlenmeli.

## Rakiplerle nasıl yarışırız?

5 Eylül'de incelenen mağaza sayfaları aşağıdaki konumlandırmayı destekliyor. Mağaza vaatleri ve seçili yorumlar tüm oyuncu deneyimini temsil etmez.

| Rakip | Yarıştığımız beklenti | Kafe Caddesi için önerilen karşılık |
|---|---|---|
| [My Mini Mart](https://play.google.com/store/apps/details?hl=en_US&id=com.KisekiGames.smart) — 100M+ indirme | Üretim, raf doldurma, çalışan ve büyüme. Görünen 27 Ağustos 2026 yorumunda yeniden kurulum sonrası ilerleme ve reklam şikâyeti var. | Kolay anlaşılır aktif kafe servisi, kesintisiz kontrol, güvenilir kayıt ve ileride kolay cihaz değişimi. |
| [My Perfect Hotel](https://play.google.com/store/apps/details?hl=en_US&id=com.master.hotelmaster) — 100M+ indirme | Personel, farklı tesisler, dekorasyon ve görünür işletme dönüşümü. | Her açılımın mekânı ve oyuncunun kararını değiştirmesi; dekorun kafe kimliğini güçlendirmesi. |
| [Clean It](https://play.google.com/store/apps/details?hl=en_US&id=com.lilyxgame.cleanit) — 10M+ indirme | Temizliğin anlık görsel tatmini ve odaları işletmeye dönüştürme. Görünen Nisan 2026 yorumunda merdiven ve kesinti şikâyeti var. | Belirgin temiz/kirli farkı, doğru el/alet teması, güvenilir geçişler ve bunların masa servisine bağlanması. |

**Bu karşılaştırmadan çıkan öneri:** özgün mahalle kafesi atmosferi, akıcı aktif servis, tatmin edici temizlik ve güvenilir ilerleme. Zorunlu geçiş reklamlarının mevcut durumda kapalı olması bu konumu destekliyor. Az kesinti tek başına yeterli değil; oyuncu ertesi gün yapmayı isteyeceği bir iş ve görmek isteyeceği bir gelişim bulmalı.

Tanıtım için üç gerçek oynanış anlatımı karşılaştırılabilir: “kirli masadan parlayan kafeye”, “tek tepsiyle yoğun servisi yetiştirme”, “küçük dükkândan yeni salona”. İzlenmenin yanında indirenlerin ilk satış ve sonraki gün dönüşü ölçülmeli. Oyuncu geri dönüşü ve gelir görülmeden büyük reklam bütçesi için dayanak yok. D1/D7 için kesin sektör başarı yüzdesi verilmedi; önce yeterli ve günü dolmuş oyuncu gruplarıyla kendi sürümlerimiz karşılaştırılmalı.

## Ekle, düzelt, sadeleştir

**Önce ekle:** Görevden işe yönlendirme, uzun bekleyen işin önceliğini yükseltme, açılmış mekaniklere uygun günlük görev seçimi ve ilk oturumun devamını ölçen kabul kontrolleri.

**Sonraki içerik:** Mevcut festival için kafe süslemesi ve farklı bir servis hedefi; odalar arasında davranış farkı; kazanılan görünür dekor/üniforma hedefleri. Her seferinde küçük değişim yapıp kullanımını ölçmek.

**Sonraki altyapı:** İsteğe bağlı otomatik bulut yedeği ve cihaz değişimi. Şu an yerel yedek/kod aktarımı var, bulut hesabı yok. Kayıt çatışması, geri yükleme ve silme davranışları tamamlanmalı. Kaynak sürümü/paket kimliği eşleştirilmeli; test ve üretim dosyası kontrolleri düzenli otomasyona bağlanmalı.

**Sadeleştir:** Aynı anda görünen yönlendirmeler, karışık dil metinleri, eski fiyat/tempo yorumları ve nihai karakter kararı sonrası kullanılmayan karakter yolları. Eski kayıt alanları uyumluluk kontrolü yapılmadan silinmemeli. Game, World ve Panels içindeki rehber, ekonomi ve ekran metni sorumlulukları sonraki bakım turunda daha küçük sınırlara ayrılabilir.

**Koru:** Yakınlıkla tek elle etkileşim, doğru ürünü masaya götürme, görünür para toplama, temizliğin etkisi ve çalışanların oyuncuya alan bırakması. Offline para ve isimli müşteri albümü önceki kararla kaldırılmıştı; eksik diye geri eklenmemeli.

**Ertele:** Çok oyunculu, klan, genel sıralama, sezon bileti, çok sayıda yeni şube ve karmaşık üretim zincirleri. Mevcut iki şubenin doğal ilerleme ve tekrar oynama kalitesi önce ölçülmeli.

## Uygulama sırası

1. **Çalışmayı sabitle:** Değişiklikleri anlamlı commit'lere ayır; test edilen görünüm/paketi belirgin bir sürüm kimliğine bağla.
2. **Görev/rehber/temizlik:** Rehbere uyan, görevi takip eden ve karışık iş yapan davranışları ayrı sına. Masalar tekrar kullanılabilmeli; 7. görevde kalma nedeni giderilmeli.
3. **Dil ve günlük görev:** İngilizce görünen metinleri tamamla; kilitli ekipman isteyen görevleri ele; seçim ve ödülü yeniden açılışta koru.
4. **Görünüm ve cihaz:** Yayın karakterlerini tamamla; güncel paketle düşük/orta telefonda uzun oturum, grafik geri dönüşü, kayıt ve native ödüllü reklamı kontrol et.
5. **Yeni oyuncu:** Yaklaşık 10 kişinin ilk 10–15 dakikasını gözlemle. İlk satış, geliştirme, anlaşılmayan simge, bırakma anı ve karakter tercihini topla. Bu örneklem kullanılabilirlik içindir; D1/D7 hakkında güçlü sonuç için yeterli değildir.
6. **Sınırlı dağıtım:** Daha geniş sürüm bazlı grupta geri dönüşü ölç; sonuca göre bir içerik deneyi ve gerçek oynanış tanıtımı yap. Canlı mağaza/gizlilik metnini paketle eşleştir.

## Bu incelemenin kanıtı ve sınırı

- Bugün **100/100 test**, tür kontrolü, üretim derlemesi ve dağıtım varlığı denetimi geçti.
- Güncel üretim derlemesi .devshots/audit-2026-09-05-build altında, eski karşılaştırma modelleri kullanılmadan çalıştırıldı.
- TR ve EN'de ayrı ayrı **15 dakikalık hızlandırılmış simülasyon**: 113 servis, 0 küserek ayrılma, ₺13.414 kazanılan para. İlk sipariş ~15,5 sn, ilk servis ~23 sn, ilk tahsilat ~26,5 sn, ilk tam masa temizliği ~40,5 sn; ilk masa açılımı 1:52, ilk çalışan 2:14. Bunlar insan öğrenme süresi veya telefon FPS ölçümü değildir.
- Yeni kayıt hareket bekledi; ilk tam döngü, para/kayıt yeniden yükleme, sekiz panel, iki şubenin doğrudan açılmış yerleşimi kontrol edildi. Sayfa hatası ve izinsiz ölçüm gönderimi yoktu. Çeviri/ilerleme bulguları kontroller geçerken ortaya çıktı.
- Ham sonuçlar: [TR](../.devshots/audit-2026-09-05-production/tr-result.json), [EN](../.devshots/audit-2026-09-05-production/en-result.json). Önceki uzun koşu: [60 dakika TR](../.devshots/acceptance-final-1.2.0/tr-result.json).
- Önceki S23 raporunda 30 FPS seçeneğinin ortancası 28,7; 60 FPS seçeneğinin ortancası 55,5 idi. Bu tarihsel ve kısa bir cihaz kontrolüdür; bugün telefon testi yapılmadı. [Önceki cihaz sonucu](1.2.0-DOGRULAMA.md)
- Oyun kaynakları değiştirilmedi. İnceleme derlemesi/kanıtları ve bu rapor oluşturuldu. Android/iOS paketi, kullanıcının oyun kaydı, mağaza ve canlı site değiştirilmedi; commit atılmadı. Geçici üretim önizleme sunucusu test sonunda kapandı.

