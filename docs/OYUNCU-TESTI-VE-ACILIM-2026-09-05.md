# Oyuncu testi ve sade açılım — 5 Eylül 2026

## Durum

Bu tur gerçek insan deneyi yapılmadı. Hazır olanlar: daha açık satın alma sunumu, yerel ölçüm, otomatik davranış kontrolleri ve uygulanabilir insan testi planı. İnsanların daha uzun oynadığı veya ertesi gün daha çok döndüğü henüz söylenemez.

## Uygulanan tasarım

- Kilitli eşyalar ve oda içindeki sahte örtü/tadilat yığınları kaldırıldı. Satın alınmamış mobilya görünmez engel oluşturmuyor.
- Başlangıçta iki uygun satın alma seçeneği gösteriliyor. Takip edilen bir görev gerekirse kendi hedefini ayrıca görünür yapabiliyor.
- Alan satın alma göstergesi zeminde küçük kare: simge, ad, kalan bedel ve gerçek ödemeyle dolan kenar. Yaklaşınca yeni ürün veya gerçek sandalye sayısı gibi somut fayda görünür.
- Yalnız karenin içinde durmak ödeme başlatıyor. Para bittiğinde durma talimatı yerine para toplama veya birikimin korunması mesajı geliyor.
- Personel karesine yaklaşınca çalışanın işi açıklanıyor. Durma ve kısmi ödeme durumu aynı noktada gösteriliyor.
- Açılan eşya 0,32 saniyelik kısa kurulum hareketiyle beliriyor; yatay ayak izi değişmiyor. Büyük açılım paneli ve kamera sarsıntısı yerine kısa onay var.
- Her açılımda çevre geometrisini yeniden birleştirme kaldırıldı. Geniş yerleşim denetimi oyuncunun ödeme karesinden çıkarıldı; ayrı denetim komutunda çalışıyor. Mobilya shader'ları yükleme ekranında hazırlanıyor.

## Hangi kanıta dayanıyor?

1. **Görevi kullanıcıya yaptırıp yardım vermeden gözlemek:** [NN/g Usability 101](https://www.nngroup.com/articles/usability-101-introduction-to-usability/). Bu, oyuncunun gerçekten ne yaptığını anlamak için yöntemdir.
2. **Gereken bilgiyi gerektiğinde göstermek:** [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/). Örtülerin yerine sade yer işareti ve yaklaşınca fayda göstermek bu ilkenin oyuna uyarlamasıdır.
3. **Açık hedef, sırayla öğrenilen mekanik ve görünür sonraki gelişim:** [Supersonic FTUE](https://supersonic.com/learn/blog/optimizing-ftue/), [öğretici arayüzü](https://supersonic.com/learn/blog/how-to-create-a-tutorial-ui-that-keeps-players-in-the-game/). Bunlar yayıncı uygulama önerileridir; bizim oyunumuz için başarı garantisi değildir.
4. **Küçük testin sınırı:** [NN/g nitel ve nicel test ayrımı](https://www.nngroup.com/articles/5-test-users-qual-quant/). İlk beş kişi hataları bulmaya yarar; güvenilir oyuncu tutma oranı elde ettiğimiz anlamına gelmez.
5. **Kohort ve gün tanımı:** [GameAnalytics metrikleri](https://docs.gameanalytics.com/events-metrics-and-filtering/metrics/). Raporda D1/D7, ilk kullanımın UTC takvim gününden bir/yedi gün sonraki tam takvim gününde dönüşü ifade eder; kayan 24 saat ölçümü değildir.

İncelenen resmî [My Mini Mart](https://play.google.com/store/apps/details?id=com.KisekiGames.smart&hl=en) ve [My Perfect Hotel](https://play.google.com/store/apps/details?id=com.master.hotelmaster&hl=en) mağaza karelerinde boş zemin işaretleri; [Clean It](https://play.google.com/store/apps/details?id=com.lilyxgame.cleanit&hl=en) karelerinde açık iş alanları ve belirgin temiz/kirli farkı görülüyor. Bu kareler her kilit durumunu ve animasyonu göstermediğinden “üçü de hiçbir zaman örtü kullanmıyor” sonucu çıkarılmadı.

## İlk tur: anlaşılabilirlik

Oyunu daha önce görmemiş beş yetişkinle, kişi başı yaklaşık 15 dakika. Her kişiye ayrı, temiz tarayıcı profili kullanılır; mevcut kişisel oyun kaydı silinmez. P01 gibi kodlar kullanılır, isim gerekmez.

Örnek başlangıç bağlantısı:
`http://127.0.0.1:5173/?playtest=human&condition=clear-unlocks-v1&participant=P01`

Bu adres yalnız oyunun çalıştığı bilgisayarda açılır. İnternette paylaşılabilir bir yayın adresi değildir. `condition` sürüm/deneme etiketidir; otomatik A/B ataması yapmaz. Aynı uygulama sürüm numarasında farklı çalışma bulunabildiği için bütün grupta aynı sabit derleme kullanılmalıdır.

Sıra:
1. “Kafeyi işletmeye başla.” İlk hareket, sipariş, servis, para ve temizlik izlenir. Nereye basacağı söylenmez.
2. Kendiliğinden geliştirme başlatmazsa “Kafeyi büyütmenin bir yolunu bul.” Bu sözden sonraki satın alma **yönlendirilmiş görev** olarak işaretlenir.
3. “İş yükünü hafifletmek için bir çalışan edin.” Kareyi, fiyatı, çalışanın görevini ve durma gereğini anlayıp anlamadığı gözlenir.
4. Ayrı senaryo olarak bir satın alımı yarıda bırakıp sonra devam etmesi istenir. Bu adımın kendiliğinden davranış olmadığı forma yazılır.
5. Serbest bölümde devam edebilir veya bırakabilir. Süreyi uzatması için ödül/ısrar verilmez. Sonunda “Devam etseydin neyi açmak isterdin?” ve “Hangi anda ne yapacağını anlayamadın?” sorulur.

[Gözlem formu](OYUNCU-GOZLEM-SABLONU.csv): görev süresi, yanlış hedef, kareden geçiş, durma/ödeme anlayışı, moderatör yardımı ve bırakma nedeni. Başlangıçta satırlar yalnız planlanmış katılımcı kodlarıdır, sonuç içermez.

Başarıyı “137 test geçti” veya “oyunda uzun kaldı” diye tanımlamayız. Kişinin doğru işi kendi başına yapması, yatırdığı paraya ne olduğunu açıklayabilmesi ve sonraki hedefi söyleyebilmesi aranır. Bulunan engel düzeltilir; yeni kişilerle kısa tur tekrarlanır.

## “Bir geliştirme daha” ve geri dönüş

İlk satın almadan sonra ikinci hedefe yönelme, ödeme başlatma/tamamlama ve iki işlem arasındaki etkin oynanış süresi incelenir. Moderatörün istediği satın almalar serbest devam etme kanıtı sayılmaz. Uzun süre, yönünü bulamama nedeniyle de oluşabileceğinden gözlem notlarıyla birlikte yorumlanır.

D1/D7 için aynı kişiye aynı kalıcı profil/kurulum bırakılır. Gizli pencere kapanınca kaybolan kayıt bu çalışma için uygun değildir. Geri dönmesini söyleyen hatırlatma gönderilmez. D1 ve D7 günü tamamen bittikten sonra rapor bütün katılımcılardan toplanır; örneğin sekizinci gün rapor istenir. Sadece geri gelenlerden rapor toplamak sonucu şişirir.

Rapor gelmeyen kişi otomatik “geri dönmedi” sayılmaz. İlgili günü kapsayan tarihli yerel rapor yoksa gözlem kapsamı eksik kalır. Oyuncu sayısı, kapsanan kişi sayısı ve gerçek dönüş sayısı birlikte okunur. Küçük grupla elde edilen oranlar keşif amaçlıdır; ticari başarı veya bir tasarımın nedensel üstünlüğü ilan edilmez. Nicel karşılaştırma, ölçmek istediğimiz fark ve örneklem büyüklüğü ayrıca planlandıktan sonra yapılır.

## Oyunun otomatik kaydettiği bilgiler

- `purchase_seen`: hedefin merkezinin oyun kadrajında sunulması. Göz takibi değildir; kişinin baktığını kanıtlamaz.
- `purchase_engaged`: ilk gerçek katkı veya yarım ödemeye devam.
- `purchase_left`: ödeme ziyaretinden ayrılma.
- `purchase_complete`: gerçek satın alma; kare/menü yolu ayrı.
- `help_used`: oyundaki HEDEFE GİT kullanımı. Sözlü moderatör yardımı ayrıca forma yazılır.

Kare başına tekrar sayım, arka planda geçen sürenin etkileşim süresine eklenmesi ve kayıt yüklemeden sonra çift başarı engellenir. Şube ve prestij turu ayrılır. Botlar ve kimliği belirsiz eski kayıtlar insan bölümüne girmez.

Bu yeni davranış olayları, deneme etiketleri ve etkin oynanış zamanları **yalnız cihazda ve elle indirilen raporda** bulunur; mevcut isteğe bağlı ağ zarfına eklenmez. Hesap veya sunucu gerekmez.

## Raporu alma

Oyuncu oturumu sonunda Ayarlar'daki oyun raporunu indirme seçeneği kullanılır. JSON dosyaları katılımcı kodlarıyla bir klasörde saklanır. Bir veya birden fazla dosya:

```powershell
npm run telemetry:report -- P01.json P02.json
```

Çıktıda `human`, `unclassified`, koşullar ve dışlanan bot sayısı bulunur. İlk gözlenen satın alma/personel süresi, sonraki satın alma aralığı, yarım ödemeye dönüş ve yardım sayıları gösterilir. Olay kayıtları sınırlı olduğundan eski işlemler silinmişse “ilk gözlenen” değer yaşam boyu ilk işlem diye sunulmaz. Veri yoksa `insufficient_human_data`, olgun ve tam kapsanan kohort yoksa oran `null` olur.

## Otomatik denetimler

```powershell
npm test
npm run test:usability
npm run test:unlock
npm run test:offline
npm run test:staff
npm run test:render
npm run acceptance -- --minutes=30 --lang=tr,en
```

Bunlar yazılım ve belirli akışların doğrulamasıdır. Gerçek insan gözlemi ve güncel telefon paketiyle akıcılık testi ayrıca gerekir. Bu tur eski Android paketleri değiştirilmedi.

## Bu tur elde edilen yazılım kanıtı

- 151 birim testi ve üretim web derlemesi geçti.
- İki dilde 30 simülasyon dakikası: TR 150 servis / 34 zemin / 36 tam masa; EN 137 servis / 36 zemin / 38 tam masa. En uzun faaliyet arası 31/29 saniye. İki şubenin yerleşim denetimi temiz.
- Aynı çevre kadrajında çizim çağrısı 160→130; çevre mesh sayısı 529→431. Bunlar aynı test sahnesinin sayılarıdır.
- Açılım yönteminin ölçülen işlemci süresi önce 4,9–10,2 ms, son kontrolde 1,1–3,1 ms. Çevreyi yeniden birleştirme işi kaldırıldı.
- Tam simülasyon/çizim kontrolünde önbellek shader hazırlığı eklenmeden önce tost açılışında 178,9 ms tepe kare gözlendi; sonrasında 15,8 ms. Son dokuz açılımda en yüksek örnek 18,5 ms. Bu başsız Chrome/PC ölçümüdür, telefon FPS garantisi değildir.
- Renk/derinlik önbelleği, menü dönüşü, ekran dışı görünürlük, grafik bağlamı kurtarma ve karakter kaynak temizliği geçti.
- Yeni yerel ölçümde ekran dışı hedef sayılmadı; kare dışı/geçişte ödeme olmadı; kısmi ödeme ve yeniden açılış korundu. Gerçek menü/kare/yardım bağlantıları doğru olayları üretti. Paylaşım açıkken üretilen yeni davranış olayları da ağ zarfına girmedi.
- Bot raporu insan bölümünde 0 katılımcı ve D1/D7 null üretiyor; gerçek insan sonucu uydurulmuyor.

Kanıt dosyaları: .devshots/usability-flow/, .devshots/unlock-flow-before/, .devshots/unlock-flow-after/, .devshots/zone-pads-2026-09-05/, .devshots/acceptance-clear-unlocks/, .devshots/render-check/.
