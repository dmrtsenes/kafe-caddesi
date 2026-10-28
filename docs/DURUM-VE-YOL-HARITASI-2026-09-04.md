# Kafe Caddesi — mevcut durum ve yol haritası

4 Eylül 2026. Kaynak kodu, yerel sürüm geçmişi, yeni derleme, otomatik testler, izole mobil tarayıcı incelemesi ve rakiplerin güncel mağaza sayfaları üzerinden değerlendirme.

**Karar:** Ana sistemler kurulmuş; oyun geliştirme ve yayın hazırlığı aşamasında. Öncelik ilk oyuncu deneyimi, karakter sistemi, ölçüm ve dağıtım paketinin tutarlılığı. Mevcut sonuçlar geniş dağıtıma hazır olduğunu göstermiyor. Yeni özelliklerden önce odaklı bir düzeltme ve gerçek cihaz kabul turu gerekiyor.

## Nerede kalmışız?

- **30 Ağustos:** Yerel doğrulama notunda 1.1.0 / Android versionCode 2 için imzalı APK ve AAB hazırlanmış. Dosyalar `cikti` klasöründe mevcut. O günün 68 test sonucu sonraki değişiklikleri kapsamıyor.
- **1–2 Eylül:** Aktif masa servisi, müşteri/personel davranışı, performans ve özellikle karakter görünümü/animasyonları üzerinde çalışılmış. Son ekran kayıtları 2 Eylül tarihli Clean It oyuncu ve müşteri denemeleri.
- **Bugün:** Tür kontrolü, **75/75 otomatik test** ve ayrı klasöre alınan üretim web derlemesi geçti. Yeni kayıt 390×844 mobil tarayıcı görünümünde açıldı; bu kısa koşulda JavaScript hatası kaydedilmedi.
- **Sürüm geçmişi geride:** Son commit 19 Ağustos. Takip edilen 56 dosyada değişiklik ve ayrıca çok sayıda yeni dosya var. Güncel çalışma, son commit veya 30 Ağustos Android paketleriyle eşit sayılmamalı.
- **Mağaza durumu doğrulanmadı:** Yerel notlar kapalı test hazırlığını anlatıyor. Canlı Play Console, test kullanıcılarının katılımı, inceleme ve mağaza yayını bu incelemede kontrol edilmedi.

Bugünkü çekirdek: **sipariş al → ürünü hazırla/al → masaya servis et veya paket rafını besle → kasadaki parayı topla → temizle → büyüt.** Müşterinin masaya kendisinin ürün götürdüğü eski anlatım ana döngüyü artık doğru açıklamıyor.

İki şube, Köşe Şubesi'nde masa ve oda açılımları dahil 21 bölge tanımı, dört personel rolü, oyuncu/istasyon yükseltmeleri, görev zinciri, günlük/haftalık hedefler, festival, prestij ve dekorasyon altyapısı mevcut. Bunları sıfırdan eklemeye gerek yok.

**Korunacak önceki kararlar:** Offline para kazancı bilinçli kaldırılmış; dönüşte üretim stoğu hazırlanıyor. İsimli/sabit müşteri albümü de kaldırılmış; kodda uyumluluk kalıntıları var. Bunları eksik özellik diye geri getirmeyi önermiyorum. Oyuncunun aktif işinin anlamlı kalması mevcut yönün parçası.

## Önce düzeltilmesi gerekenler

| Öncelik | Doğrulanmış bulgu | Etki ve yapılması gereken |
|---|---|---|
| **P0 — yayın engeli** | Karakter giriş noktası doğrudan Clean It test karakterlerini yüklüyor. Varlıkların kendi notu yalnız yerel karşılaştırmaya izin verilen kullanım şeklini belirtiyor. Yeni üretim derlemesine modeller, palet ve not dahil beş dosyanın da girdiği doğrulandı. | Deneme ile dağıtılabilir oyun ayrılmamış. Dağıtımda kullanılabilen özgün/lisanslı karakter seçilmeli; test varlıkları `public` dışına alınmalı; üretim importları ve paket içeriği denetlenmeli. Yalnız klasör adı değiştirmek yeterli değil. |
| **P1 — ilk kontrol anlatımı** | Hiç giriş verilmeden başlangıç adımı **2/7** oluyor. Oyuncu başlangıçta `(-3.4, -6.8)`; hareket sayacı **7.60**. | Başlangıç konumu hareket sayılıyor. Yeni oyuncu nasıl hareket edeceğini görmeden sipariş adımına geçiyor. İlk konum sayaç dışında tutulmalı; adım gerçek sürüklemeyle ilerlemeli. |
| **P1 — denge ölçümü** | Bot `input.update` dönüşünü değiştiriyor; oyun `input.move` alanını okuyor. 10 dakikalık koşuda oyuncu kıpırdamadı. Yalnız giriş bağlantısı geçici uyarlanınca sipariş aldı fakat ürün alma adımında kaldı. | Eski denge tabloları güncel sürümü kanıtlamıyor. Bot gerçek giriş alanını ve hizmet noktalarını kullanmalı. Hedef merkezine 1.4 birimde durması, hizmet noktasına 1.3 birim gerektiren etkileşimle de uyumsuz. İlk tam döngü bitmeden ekonomi ölçümü kabul edilmemeli. |
| **P1 — karakter/ödül tutarlılığı** | Aktif karakter kurucusu `uniform`, `level`, `variant` seçeneklerini görünüme uygulamıyor. Düşük hızda da `run` klibi seçiliyor; kasa işi `wave`, diğer işler ağırlıkla `cleanRun` kullanıyor. | Üniforma, rol ve hareket gelişimi vaat edilen görsel karşılığı vermeyebilir. Ayrı yürüme, koşma, taşıma, servis ve temizlik hareketleri; görünür rol/üniforma farkı gerekiyor. Bağlanmayan kozmetik geçici gizlenmeli. |
| **P1 — ekran önceliği** | İlk mobil ekranda grafik, festival ve günlük ödül bildirimleri yönlendirme balonunun üstüne geliyor. | İlk iş ikinci plana düşüyor. İlk satıştan önce hareket ve mevcut iş anlatılmalı; bildirimler sıraya girmeli ve metni örtmemeli. Yan menülerin başlangıçta gizlenmesi zaten iyi bir uygulama. |
| **P1 — yerleşim** | Oyunun kontrolü **Bulaşık Kovası ↔ Masa 4: 1.17 birim** darlığı bildiriyor. | Kalabalıkta sürtüşme riski; kısa inceleme kalıcı takılmayı kanıtlamıyor. Yerleşim düzeltilip ilgili bölge açıkken oyuncu, müşteri ve komi geçişleri sınanmalı. |
| **P1 — oyuncu ölçümü** | Yerel hata kaydı ve isteğe bağlı hata gönderme adresi var. İlk oturum hunisi ve ertesi gün dönüşünü ölçen altyapı bulunmadı. | Oyuncunun nerede bıraktığını göremiyoruz. Açılış, hareket, ilk sipariş/servis, para toplama, geliştirme, personel, oturum ve reklam sonucu ölçülmeli. Gereksiz kişisel veri toplamadan sürüm ve cihaz sınıfıyla karşılaştırılmalı. |
| **P1 — cihaz kabulü** | Gerçek cihaz listesi var; güncel tamamlanma sonucu bulunmadı. | Web testinin geçmesi Android'de ısı, kayıt, arka plan veya reklam güvenilirliğini kanıtlamıyor. İlk 10 dakika ve 30 dakikalık yoğun oturum gerçek cihazda tamamlanmalı. |
| **P2 — sürüm anlatımı** | README hâlâ sekiz bölge, eski fiyatlar, offline kazanç ve prosedürel karakterler anlatıyor. | Sonraki çalışma yanlış varsayımlarla başlayabilir. Tek güncel durum özeti ve doğrulanmış sürüm etiketi hazırlanmalı; eski notlar tarihli arşiv olarak kalmalı. |

Kaynaklar: [karakter seçimi](C:/Users/Enes/Desktop/oyun/src/chars/index.ts:7), [test varlığı notu](C:/Users/Enes/Desktop/oyun/public/packs/cleanit-apk-test/TEST-ONLY.txt), [hareket sayacı](C:/Users/Enes/Desktop/oyun/src/sim/Tutorial.ts:108), [denge botu](C:/Users/Enes/Desktop/oyun/tools/balance-bot.js:60), [gerçek giriş kullanımı](C:/Users/Enes/Desktop/oyun/src/core/Game.ts), [karakter kurucusu](C:/Users/Enes/Desktop/oyun/src/chars/CleanItCharacters.ts:260), [cihaz listesi](C:/Users/Enes/Desktop/oyun/docs/CIHAZ-TEST-LISTESI.md).

## Oyun nasıl hissettirmeli?

**Kimlik:** Sıcak, hareketli, tek elle işletilen bir mahalle kafesi. Semaver, çay, tost, tepsi ve kafenin büyümesi aynı görsel dilde birleşmeli. Oyuncu, müşteri, çalışan, ürün ve kilitli eşya hemen ayırt edilmeli.

**İlk dakika:** Tek müşteri, tek ürün, tek hedef. Hareket gösterilir; oyuncu siparişi alır, çayı götürür, parayı toplar. Hedef işareti nesnenin gövdesini değil gerçekten durulacak hizmet noktasını anlatmalı. Sürekli kontrol görseli eklemek yerine ilk sürükleme için kısa bir işaret yeterli olabilir.

**İlk beş dakika:** Birkaç servisten sonra somut seçim: ikinci masa mı, hız mı, kahve mi? İlk çalışan bir işi gerçekten hafifletmeli. Aktif servisi oyuncuda tutarken personeli sürekli yetersiz hissettirmekten kaçınılmalı; görev alanı açık ve işi güvenilir olmalı.

**Sonraki oturumlar:** Yeni oda, en az bir farklı karar veya servis düzeni getirmeli. Yalnız fiyatı yükselen aynı masa dizilimi uzun vadeli çeşitlilik sağlamaz. Mevcut prestij, festival ve dekorasyon bu çeşitliliği desteklemeli.

**Görsel cila:** Mobilde oyuncunun ölçeği, eldeki ürünün okunması ve servis alanlarının ayrımı öncelikli. Zemin deseni, brandalı eşyalar ve bildirimlerin dikkati bölmesi azaltılmalı. Yeni dekor eklemeden önce mevcut kadrajda yapılacak işin fark edilmesi sağlanmalı.

Önerilen başlangıç hedefleri: İlk tam satışın yardım almadan yaklaşık 60 saniyede anlaşılması; ilk anlamlı geliştirmenin 1–3 dakika içinde gelmesi; ilk çalışanın ilk oturumda hissedilir fayda sağlaması. **Bunlar mevcut sonuç veya sektör standardı değil, test edilecek tasarım hedefleri.** Performansta orta sınıf telefonda tutarlı 30 FPS, güçlü cihazlarda isteğe bağlı 60 FPS hedeflenmeli.

## Rakiplerle nasıl yarışırız?

| Rakip | Güncel mağazanın gösterdiği güçlü taraf | Bizim odaklanabileceğimiz alan |
|---|---|---|
| **My Mini Mart** | Üretim, stoklama, çalışan ve genişleme döngüsü; Google Play'de 100M+ indirme. Görünen yorumlarda reklam sıklığı ve yeniden kurulum sonrası ilerleme kaybı şikâyetleri var. | Hızlı anlaşılır kafe servisi, güvenilir kayıt, kontrollü reklam ve belirgin işletme kimliği. [Mağaza](https://play.google.com/store/apps/details?hl=en_US&id=com.KisekiGames.smart) |
| **My Perfect Hotel** | İşleri üstlenme, çalışan alma, tesis açma ve dekorasyon; 100M+ indirme. Görünen yorumlarda tekrar ve reklam kesintisi eleştirileri var. | Her yeni odada farklı servis kararı; emeğin mekânda görünür değişime dönüşmesi. [Mağaza](https://play.google.com/store/apps/details?hl=en-US&id=com.master.hotelmaster) |
| **Clean It** | Temizleme, gelir ve genişlemeyi birleştiriyor; 10M+ indirme. Görünen yorumlarda geçiş/merdiven sorunları ve kesintiler eleştiriliyor. | Temizlik tatminini servisle birleştirmek, güvenilir dolaşım ve bize ait karakterler. [Mağaza](https://play.google.com/store/apps/details?hl=en&id=com.lilyxgame.cleanit) |

Yorumlar bütün oyuncuların görüşünü temsil etmez. Bu kaynaklardan çıkardığım strateji: **özgün kafe atmosferi + akıcı aktif servis + güvenilir ilerleme.** Bu ölçekte rakiplerle içerik adedi üzerinden yarışmak ilk hedef olmamalı.

Reklam kodundaki mevcut sınırlar korunmaya değer: ilk 180 saniye geçiş reklamı yok, aralarında en az 240 saniye ve oturum başına en fazla üç gösterim tanımlı. Erken testlerde isteğe bağlı ödüllü reklam öne çıkarılabilir; dönüşe etkisi ölçülmeli. Yerel 1.1.0 notu test reklamlarıyla paket alındığını söylüyor; güncel gelir sağlandığı doğrulanmış değil.

Global büyüme için Türkçe/İngilizce dil tablosu gerekli. Kafe kimliği korunurken kontrol, görev ve ürün metinleri anlaşılmalı. Sonrasında gerçek oynanıştan kısa videolarla servis, temizlik ve kafe dönüşümü anlatımları karşılaştırılabilir. Hangi anlatımın indirme ve geri dönüş getirdiği ölçülmeden büyük tanıtım harcamasına geçilmemeli.

## Ekle, sadeleştir, koru

**Önce ekle:** Oyuncu davranışı ölçümü, dağıtım varlığı kontrolü, ilk tam servis döngüsünü doğrulayan bütünleşik kontrol, TR/EN metin sistemi. Mevcut yerel yedek ve dışa/içe aktarma iyi temel; cihaz değişimi ve yeniden kurulum için otomatik bulut yedeği sonraki aşamada değerlendirilmeli.

**Önce sadeleştir:** Başlangıç bildirimleri, görünüm değiştirmeyen kozmetik seçenekleri, çelişkili metinler, aktif olmayan karakter yolları ve kaldırılan sistemlerin gereksiz bağlantıları. Kayıt uyumluluğu alanları eski kayıt geçişi sınanmadan silinmemeli. Test varlıkları dağıtım yolundan çıkarılmalı.

**Koru:** Yakınlıkla etkileşim, doğru ürünü doğru masaya taşıma, görünür para toplama, temizlik ödülü, aşamalı açılım ve oyuncuya alan bırakan personel. Günlük görev, festival, prestij ve dekorasyona yeni katman eklemeden mevcut kullanımı ölç.

**Şimdilik ertele:** Çok sayıda yeni şube, çok oyunculu yapı, klan, genel sıralama, sezon bileti ve karmaşık ürün zincirleri. Bunlar ilk oturumun anlaşılmasını çözmez. Offline para veya sabit müşteri albümü önceki yönün tersine otomatik olarak geri eklenmemeli.

## Yapım sırası

1. **Çalışmayı sabitle:** Değişiklikleri anlamlı parçalara ayır, durum notunu güncelle, deneme ve yayın karakter yollarını ayır. Dağıtılabilir karakter seçilmeden yeni yayın paketi hazırlama.
2. **İlk oturumu tamamla:** Hareket adımı, hizmet noktaları, ürün alma/teslim, bildirim sırası ve dar geçit. Yeni oyuncu ilk döngüyü yardım almadan bitirsin.
3. **Görsel karşılığı tamamla:** Rol/üniforma farkı, yürüme/koşma, servis/temizlik teması, mobil kamera ve ürün okunabilirliği.
4. **Ölçümü yenile:** Botu güncel akışa uyarla; 10 ve 30–60 dakikalık ilerlemeyi yeniden ölç. Android'de uzun oturum, kayıt, arka plan ve reklam kabulünü yap.
5. **Küçük oyuncu testi:** İlk kez oynayan yaklaşık 10 kişinin ilk satışı, geliştirmesi ve bırakma nedenini izle. Bu örneklem kullanılabilirlik içindir; geri dönüş oranı için yeterli sayılmamalı.
6. **Sınırlı dağıtım:** Daha geniş ve sürüm bazında izlenebilir grupta ertesi gün/yedinci gün dönüşünü, oturumları ve reklam etkisini ölç. Dil desteğini tamamla; ardından içerik ve tanıtımı büyüt.

Süre tahmini karakterin üretim/tedarik kararına ve cihaz testine bağlı. Bu işler netleşmeden belirli bir tarihte rakip seviyesine ulaşma sözü vermek doğru olmaz.

## Kanıtlar ve incelemenin sınırı

Oyun kaynakları değiştirilmedi. İnceleme dosyaları `.devshots` altında; bu rapor `docs` altında oluşturuldu. Android paketleri yeniden derlenmedi; yayın yapılmadı.

- [Mobil açılış görüntüsü](C:/Users/Enes/Desktop/oyun/.devshots/audit-mobile-ready-2026-09-04.png)
- [75 testin sonucu](C:/Users/Enes/Desktop/oyun/.devshots/audit-tests-2026-09-04.log)
- [Başlangıç ve mevcut botun ham ölçümü](C:/Users/Enes/Desktop/oyun/.devshots/audit-runtime-2026-09-04.json)
- [Yalnız giriş bağlantısı uyarlanmış deneme](C:/Users/Enes/Desktop/oyun/.devshots/audit-runtime-adapted-2026-09-04.json)
- [30 Ağustos Android doğrulama notu](C:/Users/Enes/Desktop/oyun/docs/1.1.0-DOGRULAMA.md)

**Bot sonuçları gerçek oyuncu ekonomi sonucu olarak kullanılamaz.** Kısa mobil tarayıcı kontrolü ilk ekran ve başlangıç hatasını doğruladı; tüm oyun, gerçek cihaz performansı veya uzun vadeli oyuncu ilgisi bu incelemede kanıtlanmış değil.


## Uygulama sonrası — 5 Eylül 2026

Bu dosya değişiklik öncesi incelemeyi korur. Sonrasında yapılan düzeltmeler, Android paketleri, ölçümler ve kalan dış bağımlılıklar [1.2.0 doğrulama raporunda](1.2.0-DOGRULAMA.md) yer alır.
