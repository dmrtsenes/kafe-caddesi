# Mevcut karakterlerde kayıpsız geometri optimizasyonu — 10 Eylül 2026

Bu çalışma kullanıcının korumak istediği mevcut CleanIt oyuncu/personel ve kadın/erkek müşteri modellerinde yapıldı. Karakter seçimi, model, kıyafet renkleri, boyut, animasyon klipleri ve oyun kuralları değiştirilmedi. Önceki sahne optimizasyonları korundu.

## Ölçülen ek kazanç

Mevcut karakter sistemi **zaten** geometrileri ve malzemeleri paylaşıyordu: ilk ölçümde de aynı 48 karakter yalnızca üç benzersiz geometri kullanıyordu. Dolayısıyla diğer karakter setindeki %87,9 paylaşım kazancını burada yeniden elde edilmiş gibi sunmak doğru olmaz.

Bu turda aynı geometri içindeki tamamen eşit köşe verileri indekslerle paylaştırıldı. Konum, normal, UV, kıyafet kanalı, kemik indeksi ve ağırlığı birlikte karşılaştırıldı; birbirine yakın ama farklı köşeler birleştirilmedi. Değerleri sığan kemik indeksleri ve kıyafet kanalları kayıpsız olarak tek bayta taşındı. Ortak gövde yalnızca şablon yüklenirken hazırlanır; oyun sırasında her karakter için tekrar hesaplanmaz.

| Aynı 48 karakter | Önce | Sonra |
| --- | ---: | ---: |
| Benzersiz geometri | 3 | 3 |
| Paylaşılan geometri tamponları | 1.140.892 bayt | 437.918 bayt |
| Oyuncu/personel modelinde saklanan köşe | 13.674 | 2.554 |
| Oyuncu/personel modelinde üçgen | 4.558 | 4.558 |
| Kadın müşteride saklanan köşe | 2.150 | 2.150 |
| Erkek müşteride saklanan köşe | 2.220 | 2.212 |

**Geometri tamponları %61,6 küçüldü; yaklaşık 0,70 MB ek tasarruf sağlandı.** Oyuncu/personel modelindeki tekrarlı köşe kayıtları %81,3 azaldı. Üçgen sayısı ve yüzey ayrıntısı aynı. Bu oranlar toplam uygulama RAM'i, FPS artışı veya ısınma yüzdesi değildir. Müşteri modelleri önceden de indeksli olduğundan kazancın çoğu oyuncu/personel gövdesindedir.

## Doğrulama

- Üç model ve sekiz rolü kapsayan dokuz örnek, dokuz durumda karşılaştırıldı: bekleme, yürüme, koşma, oturma, taşıma, çalışma, süpürge itme, sevinme ve kızma. **81 görüntü çiftinde piksel farkı sıfır.**
- El konumları, el açıklığı ve boy ölçümleri referansla aynı kaldı. Bir karakter silindiğinde aynı geometriyi paylaşan diğerlerinin görüntüsü değişmedi; WebGL hatası yok.
- 22 oyun içi önbellek geçişi mevcut karakterlerle geçti. Ürün ekleme/taşıma/temizleme, stok, kurulum ve kilit geçişlerinde 4/255 eşiğini aşan piksel yok; en büyük kanal farkı 1/255.
- Kalite geçişinde personel karakterleri korunuyor. Simüle edilen ısı bildirimi ve soğuma sonrası kalite geri dönüşü geçti.
- 284 birim kontrolü ve TypeScript denetimi geçti. Ek kontroller üçgenlerin tüm köşe değerlerini, UV/kıyafet/kemik ayrımlarını, küçük konum farklarını, büyük kemik indekslerini ve özel sayı temsillerini korumayı doğruluyor.

Ölçümler masaüstü Chrome'da sabit tohumlarla alınmıştır. Karakter oluşturma medyanı 1,0 → 0,9 ms, %95 değeri 1,2 → 1,3 ms çıktı; bu küçük süre değişimleri için bir hızlanma iddiası yapılmıyor. Yeni hazırlık yalnızca yüklemede gerçekleşir ve geçici bellek kullanır. Fiziksel telefonda sıcaklık/FPS ölçülmedi.

## Tekrarlama ve kapsam

Kanıtlar `.devshots/cleanit-optimization/before/result.json`, `after/result.json` ve `lifecycle/result.json` dosyalarında; ham görüntüler ilgili önce/sonra klasörlerindedir. `before` referansı değişiklikten önce alındı; üzerine yazılmamalı.

Yerel karakter varlıklarını sunan web sunucusu çalışırken:

```sh
node tools/character-benchmark.mjs --pack=cleanit --url=http://127.0.0.1:5367 --phase=recheck --compare=before
node tools/visual-cache-lifecycle-check.mjs --url=http://127.0.0.1:5367/?characters=cleanit
npm test
npm run typecheck
```

İyileştirme mevcut karakterlerin kullanıldığı yerel web sürümünde aktiftir. Karakter seçimi/yayın yapılandırması değiştirilmedi ve bu turda Android paketi üretilmedi. Eski Quaternius APK/AAB dosyaları bu çalışmanın çıktısı değildir.
