# Kafe Caddesi koşu ve tutuş güncellemesi

> DURUM: Kullanıcının isteğiyle bu sayfada anlatılan animasyon denemeleri geri alındı. Bekleme, koşu, gövde eğilmesi, tempo ve tepsi/süpürge tutuşları denemeden önceki haline döndürüldü. Kıyafet özelleştirmeleri ve hitbox düzeltmeleri korundu. Aşağıdaki bölümler geçmiş denemenin kaydıdır; etkin davranışı anlatmaz.

Mevcut oyuncu ve personel iskeletleri üzerinde kafe için yeni kol hareketleri uygulandı. Daha önce eklenen kıyafetler korunur. Kaynak model/animasyon dosyaları yeniden yazılmaz; kaynak kaydı `KARAKTER-KAYNAGI.md` içinde kalır.

## Hareket

- Rahat tempo ve hızlı koşu için iki ayrı kol döngüsü: dirsekler gövdeye yakın, bilekler rahat, kollar bacaklarla ters yönde salınır.
- Salınım fazı kaynak klibin ayaklarından ölçülür. Bacak ve gövde izleri korunur; yeni kol kareleri yüklemede bir kez hazırlanır ve bütün personel tarafından paylaşılır.
- Hız eşiği geçildiğinde adım fazı korunur. Rahat/hızlı koşunun temposu aynı hız oranıyla ilerler; eşikte ani tempo sıçraması olmaz.
- İleri eğilme koşuda hafifçe artırıldı; dönüş eğilmesi yumuşak geçişlidir.
- Tepside daha bükülü ve yakın dirsekler; süpürgede ayrı, iki elle öne uzanan tutuş kullanılır. Tepsi alma/bırakma hareketleri de süpürge gibi yumuşak geçer.
- Katmanlar her karede temel poza geri döndürülür; sabit animasyon izleri nedeniyle biriken kol bozulması engellenir.

Karakterin fiziksel hızı, çarpışma gövdesi, masa/sandalye yerleşimi değişmez. Müşterilerin mevcut yürüme/oturma klipleri bu güncellemenin kapsamı dışındadır.

## Kontroller

- `npm test`: 325 test geçti. Yeni kontroller kaynak iskelet/klip korunmasını, döngü birleşimini, eklem uzunluklarını, yakın dirsekleri, ters kol/bacak salınımını ve ayrı tutuşları sınar.
- `npm run build`: tip kontrolü, üretim derlemesi ve kaynak varlık özeti doğrulaması geçti.
- `node tools/locomotion-check.mjs`: gerçek modelde 120 koşu karesi ve 96 durum geçişi geçti; hız değişiminde faz korunuyor, bırakma sonunda iki tutuş katmanı sıfırlanıyor, tarayıcı hatası yok.
- `node tools/vacuum-visual-check.mjs --output=.devshots/signature-motion/vacuum`: gerçek oyuncuda yürüyüş, süpürme ve dönüş boyunca sapın iki ele oturması, başlığın zemin hizası, temizlik noktası ve tekrar alma/bırakma kaynak kararlılığı geçti.
- `node tools/tray-fixture-check.mjs --output=.devshots/signature-motion/trays`: üç taşıyıcı seviyesinde 1.617 ürün yerleşimi kontrolü geçti; tepsi/araba ile el konumu görsel olarak incelendi.
- `node tools/cast-production-check.mjs`: derlenmiş oyunda soğuk/sıcak açılış ve 15 ürünlü araba geçti. Karakter tek rigli gövdeyle çiziliyor; uzak istek veya tarayıcı hatası yok.

Görseller, kısa hareket videosu ve ölçümler `.devshots/signature-motion/` içinde. Güncel derleme `http://127.0.0.1:5173/` adresinden sunuluyor; önceden açık sayfa yenilenmelidir.

## İkinci düzenleme: oyuncuda belirgin duruş değişikliği

İlk düzenleme bekleme klibini değiştirmemiş ve koşuda kaynak gövde hareketini korumuştu. Kullanıcının benzerlik geri bildirimi üzerine `fincan-motion-2` uygulandı:

- Yeni 3,2 saniyelik bekleme döngüsü: bir el önlük hizasında, diğer kol serbest; göğüste nefes hareketi ve başta hafif dönüş.
- Hızlı koşuda daha yüksek, içeri yönelen ön kollar ve kapalı el duruşu; kaynağın omuz/göğüs sallanması yerine ayrı üst gövde ritmi.
- Dirsek hedefleri gövdenin dışına, ön el hedefleri de önlük yüzeyinin önüne taşındı.
- Yürüyüş/koşu, taşıma ve temizlik arasındaki geçişler korunur. Model dosyası, kıyafet, bacak temas izleri ve fiziksel hareket hızı değiştirilmez.

`tools/locomotion-check.mjs` artık bağımsız bir karakter pozuyla yetinmez: gerçek `Player.update` akışının boş elle dururken `Fincan_idle_v2`, tam hızda `Fincan_run_v2`, durunca tekrar yeni bekleme klibini seçtiğini sınar. Ayrıca çizilen tek rigli gövdedeki 686 kol köşesini kaynak pozla dört eş fazda karşılaştırır. Ölçülen ortalama fark model uzayında beklemede yaklaşık 0,19–0,20, koşuda 0,21–0,28 birimdir; yalnızca kemiklerin değişmesi yeterli kabul edilmez.

Son kontroller: 326 test, tip kontrolü ve üretim derlemesi geçti. Gerçek oyuncuda 120 koşu karesi, 96 durum geçişi ve süpürge hizalama kontrolleri geçti. Kaynak/yeni karşılaştırmaları `source-vs-new.png` ve `source-vs-new-overhead.png` içinde bulunur.
