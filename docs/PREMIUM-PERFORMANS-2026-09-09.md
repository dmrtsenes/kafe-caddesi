# Premium görünümün performans düzenlemesi — 9 Eylül 2026

> Bu dosya ilk iki turun tarihsel kaydıdır. Son denetim bazı eski karşılaştırmaların güvenilir olmadığını gösterdi: ölçüm için eklenen müşteriler hareketli çizim katmanına alınmamıştı; canlı karakter bellek örneklerinde de aynı model topluluğu kullanılmamıştı. Aşağıdaki eski sabit çizim sayıları ve bunlardan hesaplanan yüzdeler güncel kazanç kanıtı değildir. Doğrulanmış sonuçlar ve yeni Android paketleri [profesyonel performans denetiminde](PROFESYONEL-PERFORMANS-DENETIMI-2026-09-09.md) bulunur.

Masa, sandalye, makine, vitrin ve mimari detaylar kodla kurulan 3B geometrilerden oluşuyor. Karakterler model varlıklarını kullanıyor. Bir nesnenin kaç parçadan oluştuğu tek başına performansı belirlemez: GPU çizim çağrısı, görünen üçgenler, piksel sayısı, gölgeler ve karakter iskeletlerinin güncellenmesi birlikte önemlidir.

## Ölçülen değişiklik

Aynı kamera konumları, 390 × 844 görünüm, cihaz piksel oranı 2 ve düşük kalite ayarı kullanıldı. Tam kafe örneğinde 24 müşteri ve 8 personel hazırlandı; ölçüm sırasında sipariş simülasyonu durduruldu. Yayınlanabilir Quaternius karakterleri kullanıldı. İlk ve son ölçümler `.devshots/premium-performance/before/profile.json` ve `after/profile.json` dosyalarında.

| Görünüm | Hareketli kamerada çizim çağrısı | Görünen üçgen | Sabit kamerada çizim çağrısı | Sahneye bağlı nesne |
| --- | ---: | ---: | ---: | ---: |
| Başlangıç / tezgâh | 82 → 47 | 58.970 → 17.764 | 17 → 7 | 3.777 → 2.112 |
| Tam kafe / üretim | 199 → 139 | 107.664 → 63.166 | 101 → 77 | 7.223 → 2.558 |
| Tam kafe / masalar | 210 → 127 | 124.600 → 84.516 | 101 → 43 | 7.239 → 2.791 |
| Tam kafe / salon | 145 → 103 | 113.120 → 71.496 | 60 → 26 | 7.251 → 2.806 |

- Hareketli görüntüde çizim çağrısı %29–43 azaldı. Yoğun masa görünümündeki azalma %39,5.
- Başlangıç görünümündeki üçgen sayısı %69,9 azaldı. Tam kafe örneklerinde azalma %32–41.
- Sabit masa görünümündeki çizim çağrısı %57,4 azaldı.
- Düşük ayarda çizilen piksel sayısı 473.616'dan 329.160'a indi: %30,5 azalma. HTML arayüz yazıları cihaz çözünürlüğünde kalıyor.
- Masa görünümünde tarayıcının render çağrısını gönderme süresinin medyanı 1,9 ms'den 0,8 ms'ye indi. Bu CPU gönderim ölçümüdür; GPU süresi veya telefon FPS sonucu değildir.

Ölçüm makinesi NVIDIA RTX 5070 Laptop GPU / ANGLE D3D11 kullanıyor. Canlı animasyon zamanı, farklı ekran boyutu, ayar ve cihazlarla sayılar değişebilir. Üç kalite ayarının tamamı raporda bulunuyor.

## Yapılanlar

- Değişmeyen, dokusuz PBR malzemelerin renk, pürüzlülük ve metal değerleri geometri verisine taşınıp uyumlu parçalar aynı çizimde birleştirildi. Cam, yazılar, dokular ve değişen kozmetik yüzeyler ayrı tutuldu.
- Mimari ve sokak 8 birimlik hücrelere bölündü. Kamera dışındaki alanların GPU'ya gönderilmesi azaltıldı.
- Birleştirilen kaynak parçalar tekrar çizilmiyor ve gereksiz sahne dolaşımından çıkarılıyor. Ortak kaynak varlıklar korunuyor.
- Mobilya kenarlarındaki görünüşü etkilemeyen fazla bölümler ve etiket dokularının gereksiz çözünürlüğü azaltıldı.
- Kamera dışındaki karakterlerin iskeletleri çizim ağacından ayrılıyor; simülasyonları, siparişleri ve mevcut durumları korunuyor. Kamera dönünce tekrar bağlanıyorlar.
- Vitrin ürünlerinin sayısı, sırası ve kapasitesi değişmediyse GPU örnek matrisleri tekrar yazılmıyor.
- Sabit masa, tezgâh ve makine gövdeleri görüntü önbelleğine alınıyor. Kurulum ve ürün bırakma animasyonu başladığında canlı çizime geçiliyor; hareket bitince önbellek yenileniyor. Ürünler, nakit, camlar ve göstergeler canlı kalıyor.

## Isınma ve güç bütçesi

- Mobil varsayılan 30 FPS korundu. Menüde simülasyon ve sürekli sahne çizimi duruyor; arka plan yaşam döngüsü korunuyor.
- Düşük kalite: DPR tavanı 1, en fazla 450.000 3B piksel, gerçek zamanlı gölge kapalı.
- Orta kalite: DPR tavanı 1,35, en fazla 900.000 3B piksel. Yüksek kalitenin taban bütçesi korunuyor.
- Sürekli kare yükü ve yetersiz FPS görülünce altı basamaklı bütçe çözünürlük ve gölge maliyetini azaltıyor. Toparlanma bekleme süreleri hızlı kalite salınımını önlüyor.
- Android 10 ve sonrasında işletim sisteminin ısı durumu olayları yeni `DeviceThermal` köprüsünden alınıyor. Ek izin ve sıcaklık sorgulama döngüsü gerekmiyor. Manuel kalite seçilse de işletim sistemi kaynaklı ısı koruması çalışıyor.
- Ciddi ısı durumunda yapılan tarayıcı entegrasyon testinde düşük ayarın piksel sayısı 329.160 → 147.726 oldu. Soğuma bildirimi sonrası 45 saniyelik bekleme, kullanıcının seçtiği kaliteyi geri getirdi. Bu testte OS bildirimi taklit edildi; fiziksel sıcaklık ölçülmedi.
- Desteklenmeyen veya reddedilen basınç/ısı API'leri oyunu durdurmuyor; kare süresi ve FPS uyarlaması kullanılmaya devam ediyor.

## Doğrulama

- 267 birim kontrolü geçti.
- PBR malzeme birleştirmesi: aynı geometri ve ışıklarda kaynak görüntüyle piksel farkı sıfır.
- Önbellek renk/derinlik karşılaştırmaları ve 16 stok/kurulum/hareket/kilit geçişi: kanal farkı en fazla 1/255; 4/255 eşiğini geçen piksel yok.
- Menüde 100 adım boyunca çizim 0 ve simülasyon ilerlemesi 0; kapatınca devam ediyor.
- Grafik bağlamı kaybı ve geri yükleme geçti. Ekran dışındaki istasyonlar geri dönüyor. 20 karakter oluşturma/silme döngüsünde doku sayısı artmadı.
- 4 kat yavaşlatılmış masaüstü CPU ile oyun döngüsü çalıştı; bu düşük seviye telefon testi yerine geçmez.
- Türkçe ve İngilizce 30'ar dakikalık hızlandırılmış otomatik oyun akışı, servis, para toplama, temizlik, alan açma ve gerçek kayıt/yeniden yükleme kontrolleri geçti. Türkçe: 113 servis, 41 bulaşık toplama, 39 süpürme; İngilizce: 105 servis, 52 bulaşık toplama, 38 süpürme.
- İki şubede 432 servis/temizlik örneği, 72 masa çevrimi, 28 çöp noktası; kaçırılan servis yok.
- 18 masada 496 yemek yerleşimi ve premium görünüm/kozmetik/stok kontrolleri geçti.
- Web derlemesi, Android debug/release APK ve AAB derlemeleri geçti. APK v2 imzası doğrulandı. APK ve AAB içindeki 72 web dosyası son `dist` ile birebir eşleşiyor; ısı köprüsü her iki pakette mevcut.

Fiziksel düşük seviye telefon bağlı olmadığı için pil tüketimi, sıcaklık derecesi veya kesintisiz 30 FPS garantisi verilmedi. Değişiklikler işlem yükünü azaltır ve ısınma halinde bütçeyi düşürür; gerçek cihazın GPU'su, WebView sürümü, ortam sıcaklığı ve pil durumu sonucu etkiler.

## Çıktılar

- `cikti/FincanSokagi-premium-optimize-2026-09-09.apk`
- `cikti/FincanSokagi-premium-optimize-2026-09-09.aab`
- `cikti/FincanSokagi-premium-optimize-debug-2026-09-09.apk`
- `cikti/FincanSokagi-premium-optimize-2026-09-09-SHA256.txt`

Tekrar kontrol: `npm test`, `npm run test:render`, `npm run test:render:lifecycle`, `npm run test:performance`. Son komut yeni ölçümü `check` klasörüne yazar; önce/sonra referanslarını değiştirmez.

## İkinci optimizasyon turu — aynı görünüm, daha küçük çalışma yükü

İkinci turda sabit istasyonların küçük parçaları da kontrollü biçimde tek geometriye alındı. Ürün, para, cam, etiket ve kurulum animasyonu katmanları canlı bırakıldı. Karakter paketlerinin ortak topolojisi bir kez indekslendi; kemik ağırlıkları ve kıyafet renk ayrımları korunuyor. Dünya ve çevre kökleri görünmeyen dalları her kare dolaşmıyor.

Güncel tarayıcı ölçümü (aynı 390 × 844 / DPR 2 / düşük ayar senaryosu):

| Görünüm | Hareketli çizim çağrısı | Sabit çizim çağrısı | Sahne nesnesi |
| --- | ---: | ---: | ---: |
| Başlangıç / tezgâh | 47 | 7 | 2.066 |
| Tam kafe / üretim | 108 | 38 | 2.512 |
| Tam kafe / masalar | 121 | 29 | 2.746 |
| Tam kafe / salon | 103 | 23 | 2.760 |

Bu tablodaki sabit çizim sonuçları son denetimde geçersiz karşılaştırma olarak işaretlendi. Müşterilerin hareketli katmanı düzeltildiğinde düşük ayarda üretim/masa/salon sabit çizim sayıları 39/40/35 olarak ölçüldü. Eski 4,22 MB → 2,65 MB karakter belleği ve 1,0 → 0,8 ms kare medyanı farklı canlı karakter topluluklarına aitti; bunlar eş koşullarda optimizasyon yüzdesi göstermek için kullanılamaz. Yeni denetimde sabit tohumlarla aynı 48 karakter karşılaştırıldı.

İkinci tur sonrası 273 birim kontrolü ve tarayıcı doğrulamaları geçmişti. O turdaki Android derleme engeli sonraki denetimde kalktı; güncel kaynak standart web/Android derleme zinciriyle yeniden paketlendi. Bu dosyada listelenen `premium-optimize` adlı çıktılar tarihsel sürümdür; son sürümün adı `profesyonel-optimize` ile başlar. Güncel test ve paket bilgisi üstte bağlı denetim raporundadır.
