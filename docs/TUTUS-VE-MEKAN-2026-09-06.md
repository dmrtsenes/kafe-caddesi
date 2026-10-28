# Tutuş, temizlik ve oda görünümü — 6 Eylül 2026

Kullanıcının altı ekran görüntüsündeki sorunlar için yapılan değişiklikler.

| Bildirilen sorun | Uygulanan değişiklik |
| --- | --- |
| Duran karakterin içine giren ürünler | Üst üste binen renkli ürün altlıkları kaldırıldı. Ürünler tek servis tepsisinde üç ayrı yuvaya yerleşir. Tepsi arka tutamağından, ellerin orta konumuna bağlı olarak öne uzanır. Önizleme ve yayın karakterinin tutuşu düzeltildi. İlk alış, yürüme ve durma geçişleri de ölçüldü. |
| Tezgâh ve masa çevresindeki daireler | Yakınlık diskleri, rehberin zemin halkası ve sarkıtların ışık diskleri kaldırıldı. Eylem yazısı ve ok korunur. Ödeme kareleri ile iş ilerleme göstergeleri korunur. |
| Uzak müşteri sırası | Ön sıranın tezgâh merkezine uzaklığı 2,2 yerine 1,3 birim. Taşan sütunlar personel karesini işgal etmeyecek mesafede kalır. Rafın müşteri yaklaşımı da 1,65 birime çekildi. |
| Havada duran dekor | Sarkıt ışık grupları ve dört asılı saksı kaldırıldı. Yerde duran dekorlar kaldı. Çöpün yanındaki kahverengi parça kitaplıktı; kaldırıldı. |
| Yerde eliyle havayı silme | Yere basan küçük paspas eklendi. Sapı ve tutamacı iki ele uyar. Simülasyondaki temizlenen nokta görsel başlığın konumuyla aynıdır. Ürün taşırken, servis yaparken veya başka el işi sürerken paspas çalışmaz. |
| VIP/Salon girişinin kapanması | Uzun koridor tabelaları, bağlantı kolları ve yüksek kapı üstleri kaldırıldı. Alçak girişler, alçak kapalı bariyer ve zemindeki oda adı kullanılır. Kamera yaklaşınca yumuşakça odaya yönelir; VIP kat yüksekliğini takip eder. Basamaklar kapıyla hizalandı. |

Servis arabasının tutamacı da ellerin gerçek konum ve açıklığına uyar. Ürünler taşıma sırasında birbirinin içine giren büyük renkli tabaklar şeklinde görünmez.

## Rakip incelemesinden alınan karar

[My Perfect Hotel'in resmi mağaza sayfası ve görsel galerisi](https://play.google.com/store/apps/details?id=com.master.hotelmaster&hl=en) oda bazlı büyümeyi ve tavansız, içi görülebilen oda bölmelerini gösteriyor. Buradan alınan tasarım kararı açık görüş, okunur giriş ve oda kimliğini zeminle ayırmak oldu. Bu görsel gözlem, oyunun kamera algoritmasının aynısını kullandığımız veya oyuncu bağlılığını kanıtladığımız anlamına gelmez.

[Clean It](https://play.google.com/store/apps/details?id=com.lilyxgame.cleanit&hl=en) ve [My Mini Mart](https://play.google.com/store/apps/details?id=com.KisekiGames.smart&hl=en) resmi sayfaları da incelendi. My Mini Mart'ın bakılan görseli ekim alanlarını gösterdiği için yan oda tasarımına kanıt olarak kullanılmadı.

## Doğrulama

- 151 birim kontrolü ve üretim derlemesi geçti.
- İki karakter sisteminde 1 / 3 / 6 ürün, normal/geniş tepsi ve araba, durma/yürüme örnekleri kontrol edildi.
- Ürün alma → harekete geçme → durma geçişlerinde en yakın ürün sınırı karakter kökünün önünde kaldı: önizleme 0,326; yayın karakteri 0,417 birim.
- Paspas başlığının simülasyonla, tutamacın iki el orta noktasıyla farkı 0,001 birimin altında.
- Hazır elektrikli süpürge testi her iki karakter sisteminde geçti; el, zemin ve temizleme noktası uyumu korundu.
- 390×844 ve 838×532 boyutlarında, iki karakter türüyle, iki odanın kapalı/açık giriş ve oda içi durumu: toplam 24 görünüm. Oda adı kadraj içinde; karakterin gövde ve başına uzanan görüş ışınlarında mimari engel yok.
- Yedi çevrimdışı akış senaryosu geçti: aktif kayıt, kısmi ödeme/kayıt, hedef arayüzü, tam masa temizliği, süpürgeyi bırakma, süpürge yanında leke ve servis noktası seçimi.
- Türkçe 30 dakikalık otomatik oynanış: 142 servis, 37 tamamlanmış masa temizliği, 30 zemin temizliği; Köşe ve Sahil yerleşim kontrollerinde hata yok.

Bu kontroller görsel temas ve işlevsel ilerleme içindir. Gerçek telefonda uzun kullanım performansı veya yeni oyuncuların tasarımı nasıl algıladığı bu turda ölçülmedi.

## Yeniden çalıştırma

- `npm run test:presentation`
- `npm run test:vacuum`
- `npm run test:offline`
- `npm test`
- `npm run build`

Görseller ve ölçümler: `.devshots/presentation-2026-09-06/`. Otomatik oynanış: bu dizinin `acceptance/` alt klasörü. Testler ayrı tarayıcı kayıtlarında çalıştı; 5319 adresindeki kullanıcının ilerlemesi sıfırlanmadı.
