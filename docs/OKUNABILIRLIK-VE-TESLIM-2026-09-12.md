# Okunabilir etiketler ve açık teslim noktası

Güncel sürüm, kullanıcı geri bildirimi üzerine hareket eden ekran kartlarının yerine zemine ve tezgâha sabit yazılar kullanır.

## Yazılar

Personel ve yan alan yazıları doğrudan ödeme karesinin içine yatay yerleştirildi. Kamera hareketi yazıların dünyadaki konumunu, açısını veya ölçeğini değiştirmez. Ekrana göre yer değiştiren HTML kartlar ve bağlantı çizgileri kaldırıldı.

Clean It'in [resmi mağaza görsellerindeki](https://play.google.com/store/apps/details?id=com.lilyxgame.cleanit) beyaz zemin çizgileri ve döşeme üstündeki fiyatlar incelendi. Son kullanıcı düzeltmesi üzerine yazıların arkasındaki krem plaka ve personel karesinin dolu gövdesi tamamen kaldırıldı.

- 1,3 × 1,3 birimlik karenin içindeki 1,16 × 1,02 birimlik şeffaf alana beyaz isim ve ücret, iki satır halinde çizilir. Gerçek döşeme harflerin ve satırların arasından görünür. Harf sınırları, ince koyu kenar ve Türkçe aksanlar hesaba katılarak yazı boyutu otomatik ayarlanır. Bahçe/Avlu seviyesi ve kalan ücret korunur.
- Personel karelerinin çerçevesi, ödeme ilerlemesi ve bekleme çubuğu kalınlığı olmayan düz zemin çizgileridir. İsim ve fiyat ortalanır; göstergeler için boşluk ayrılır. Normal çizgi beyaz, aktif çizgi altın; ödeme ilerlemesi rol rengindedir. Sahil barista karesi yüksek soğutucunun yanındaki görünür, erişilebilir zemindedir.
- Personel/yan alan yazıları 1024 × 900 piksel kaynak dokuyla fiziksel alan oranına uyar. Alan açma kareleri 1024 × 1024 şeffaf doku ve içi boş ince çerçeve kullanır. Açık döşemede beyaz yazıyı koruyan ince koyu harf kenarı vardır; gölge bulanıklığı ve dolu arka plan yoktur. Uzun isimler yatay sıkıştırılmadan küçültülür, fiyat/kalan/açıklama satırları ayrılır.
- Açılı örnekleme ve mipmap kullanılır. Küçük harfleri dağıtan FXAA işleminden sonra yazılar ve zemin çizgileri çizilir; bütün oyunun çözünürlüğü veya yumuşatması değiştirilmez. Personel yazısının saydamlık örneklemesi toparlanır; harf dışındaki pikseller şeffaf kalır.
- Aynı derinlik tamponu korunur: personel ve mobilyalar yazıların önündeyse metin onların üzerine boyanmaz. Görünmez nesnelerin etiketleri de çizilmez.
- Stok sayısı `3 / 8` gibi kısa bir plakayla tezgâhın ön yüzüne sabittir; ürünlerin üzerini kapatmaz. İsim/fiyat değişiminde doku güncellenir, konum sabit kalır.

## Müşteriler

`pickup` ve `grab` durumları genel `work` animasyonunu çağırıyordu; müşteri adaptörü `work` için oturarak yemek yeme klibini seçiyordu. Ürün alma işi artık `reach` olarak ayrılır ve ayakta kısa alma/eğilme hareketi kullanır. Normal bekleme ayakta kalır; gerçek masa oturması `sit` durumunu kullanmaya devam eder.

## Teslim tezgâhları

- Canlı oyundaki teslim tezgâhlarının koyu üst plakaları, yüksek direkleri ve stok önündeki camı kaldırıldı. Ahşap/taş gövde ve alçak arka kenar korundu.
- Ürünler açık tezgâhta iki sıra halinde görünür. Her tezgâhta mevcut stok/kapasite etiketi vardır; görünür ürün yuvasından fazla stok da doğru sayılır.
- Boş tezgâhın havadaki kırmızı halkası kaldırıldı; `0 / kapasite` etiketi sıcak renkle boşluğu gösterir.
- Tezgâh konumu, kapladığı alan, çarpışma ve alış/teslim mantığı değişmedi. Reklam sahnesindeki ayrı vitrinler bu düzenlemenin dışında tutuldu.

## Kontroller

- `npm test`: 328 test geçti; sabit dönüşüm, kısa Türkçe isim/fiyat, özel çizim katmanının korunması ve hata halinde çizim durumunun geri yüklenmesi dahil.
- `node tools/floor-label-check.mjs` (eski `readability-check.mjs` de aynı kontrolü çalıştırır): 1061×900, 390×844, 320×640 ve 844×390 görünümünde personel, yan alan, stok ve alan açma karesini kapsayan 28 sahne; Sahil şubesinde dört ek görünüm. Sonradan açılan makineler de görünür. Altı etiketin tamamı ödeme çerçevesinin içinde ve bekleme çubuğundan en az 0,04 birim uzaktadır. 80 kamera konumunda yazıların dünya matrisinde değişim sıfır. 390 piksel portrede öndeki personel etiketi yaklaşık 62 × 40 ekran pikseli; 320 piksel portrede yaklaşık 47 × 30 piksel. Yatay telefonda fiziksel alanlar daha küçük görünür; testler gerçek telefon donanımında değil tarayıcı görünümlerindedir.
- Hareketli, ilk önbellek ve sıcak önbellek çiziminde ön nesnenin pikseli yazı açık/kapalıyken birebir aynı; görünür etiket bir kez, gizli etiket sıfır kez çiziliyor. Karakterin zemin yazısının önünden geçtiği görünüm ayrıca kontrol edildi.
- Plakasız görünüm kontrolü: altı yazı dokusunun satır arası saydamlığı sıfır olmayan bir zemin dolgusu taşımıyor; bütün personel karesi parçaları düz geometri ve yerden 0,035 birimden alçak. Koyu Köşe zemini ve açık Sahil döşemesi görüntülendi.
- Son kare içi düzenleme: Sahil'deki üç açılım aşamasında personel karelerinin erişim/çakışma kontrolü geçti. Yeni barista karesinde 37,125 tutarındaki kısmi ödeme tamamen işlendi. Uzun Türkçe/İngilizce isimler ve `₺999.999.999,99` dahil dokuz metnin gerçek harf sınırları ayrılan satırlara sığıyor; aktif çerçeve ve bekleme çubuğu ayrıca görüntülendi. Ayrıntılar `.devshots/floor-labels/placement-report.json` içinde.
- Ek `npm run test:staff` kontrolü Köşe şubesindeki `actual movement crosses cashier square` beklentisinde durdu: senaryo kareye girmeden x=8,52999 konumunda kaldı. Aynı çalışmada dört rolün de kısmi ödeme verileri doğru; Köşe yerleşim kontrolleri temiz. Bu genel yürüyüş senaryosu başarılı olarak raporlanmadı; Sahil'deki değişen karenin yukarıdaki ayrı kontrolü geçti.
- Sekiz müşteride iki modelin de ayakta ürün alma klibine geçtiği doğrulandı; oturma yüksekliğine düşüş yok. Beş teslim gövdesinin üst sınırı yaklaşık 1,043; eski üst kapaklar yok.
- Önceki teslim düzeltmesinde stok taşması/boşalma ve müşteri alma klipleri kontrol edilmişti; açık tezgâh ve ayakta alma düzeltmeleri korunur.
- Derlenmiş sürümün açılışı ve 15 ürünlü taşıma kontrolü geçti; tarayıcı hatası ve uzak istek yok. Bu masaüstü örneğinde çizim çağrısı medyanı 0,7 ms, yüzde 95 değeri 1,1 ms; bunlar telefon performansı ölçümü değildir.

Güncel görseller ve ölçümler `.devshots/floor-labels/` altında. Oyun `http://127.0.0.1:5173/` adresinde.
