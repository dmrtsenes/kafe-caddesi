# Reklam tasarımının ana oyuna uyarlanması

Reklamın açık taş, ceviz, koyu yeşil ve pirinç yaklaşımı normal oyunla birleştirildi. Köşe şubesinin salon zemini açık terrazzo, mutfağı daha serin karo oldu. Oturma alanındaki halı ikinci masa sırasına daraltıldı, deseni ve bordürü sadeleştirildi. Yan salonun ahşap zemini, yükseltilmiş VIP alanı, bahçeler, servis koridorları ve aşamalı açılımlar korundu.

## Hazır modeller

Mobilyalar mevcut yerel [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) arşivinden alındı. Paket CC0 lisanslıdır; lisans `public/packs/kenney/LICENSE.txt` içinde bulunur. Reklamdaki özel geometriyle birebir aynı bir takım olduğu iddia edilmez.

- Normal oturma: `loungeChair.glb`, koyu yeşil döşeme.
- VIP oturma: `loungeDesignChair.glb`, sıcak kiremit döşeme.
- Yuvarlak ve kare masalar: mevcut `tableRound.glb` ve `table.glb`.
- VIP masa: örtüsüz `tableCross.glb`, yeşil taş ve pirinç damarlı yüzey.
- Bank, kanepe ve yer bitkisi: `benchCushion.glb`, `loungeSofa.glb`, `pottedPlant.glb`.

Modellerin orijinal paylaşılan malzemeleri değiştirilmez. Temaya özel kopyalar tekrar kullanılır. Masa geometrilerinin tabla ve ayakları ayrı malzeme gruplarına ayrıldı; masa kozmetikleri artık hazır masaların tablasına uygulanır. Varsayılan ahşap dokusu paylaşılır; önizleme/iptal sırasında tekrar üretilmez. Sandalyeler mevcut oturma noktalarına, masalar mevcut 1 birimlik servis yüksekliğine ve çarpışma ayak izine uyduruldu. Bank ve bitki ölçüleri mevcut navigasyon sınırları içinde kalır.

## Korunan durum

İstasyon kimlikleri, konumları, bölüm fiyatları, kayıt şeması, ekonomi ve karakter modelleri değişmedi. Varsayılan zeminin eski `mese` kayıt kimliği korunurken görünen adı “Şube Zemini” oldu. Satın alınmış diğer zemin ve masa seçenekleri kullanılmaya devam eder. Reklam kontrolcüsü normal oyuna alınmadı; normal oyun kendi UI ve müşteri döngüsünü kullanır.

## Doğrulama

- 251 mevcut oyun testi geçti. Son metin değişikliğinden sonra altı dil testi de tekrar geçti.
- TypeScript ve normal üretim derlemesi geçti; yeni web çıktısı `dist` içinde.
- İki şubede erken/gelişmiş durumlarda 10 görünüm kontrol edildi; yerleşim hatası yok.
- Geçici profilde gerçek kayıt oluşturulup yeniden yüklendi: para 76543, kapasite seviyesi 2, Köşe şubesi ve PlayerS01 korundu.
- 18 masada 1 birim tabla yüksekliği, 496 ürün yerleşimi, masa numarası/saksı teması ve iki servis deposu ölçüsü kontrol edildi.
- Masa kozmetiği önizlemesi değişti, iptalle önceki yüzey geri geldi; para ve satın alınmış seçimler değişmedi.
- Hazır model dosyaları üretim varlık denetiminden geçti. Android paketi bu turda yeniden üretilmedi.

Kontrol sonuçları `.devshots/hybrid-cafe/after/report.json`, `.devshots/hybrid-cafe/showcase.json` ve `.devshots/main-premium-2026-09-08/surface-report.json` içinde. İlk ölçümde görülen 0,92 tabla yüksekliği kamera dışında bekleyen açılış animasyonuydu; kontrol tüm animasyonları tamamlayınca bütün tablalar 1,00 olarak doğrulandı.

[Yakın görünüm](../kafe-hibrit.jpg) ve [genel görünüm](../kafe-hibrit-genel.jpg) normal oyun sahnesinden alınmıştır. Görseller için geçici profilde 12 masa, altı çalışan ve 31 müşterili ileri durum hazırlanmıştır; kullanıcının kaydı açılmadı veya bu duruma çevrilmedi. Canlı önizleme normal oyundan başlar.
