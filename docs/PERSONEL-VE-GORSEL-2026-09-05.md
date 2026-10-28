# Personel yerleşimi, zemin ve süpürge — 5 Eylül 2026

## Oyuncunun göreceği değişiklikler

- Büyük daire, direk ve örnek personel modeli kaldırıldı. Her iş için küçük bir kare ödeme alanı var.
- Kasiyer kasanın yanında; tezgâhtar teslim rafında; komi salonun temizlik noktasında; barista hazırlık bölümünde bulunur. Kareler masa, kuyruk ve servis noktalarının dışında kalır.
- Karenin kenarı yatırılan para oranında dolar. Kısmi ödeme şube ve rol bazında saklanır; Personel menüsü de kalan bedeli kullanır. Aynı karede kalmak ikinci çalışanı satın almaz.
- Parke daha geniş ve düşük kontrastlıdır. Tozlar yumuşak, kırıntılar seyrek ve kahve lekeleri ayrı görünür. Silinen hücrelerle leke görüntüsünün dönme/ölçek farkı düzeltildi; trafik kirinin zemin koordinatları hizalandı.
- Oyuncu kıyafeti petrol, krem ve bakır tonlarına geçti. Ten, saç, göz ve kaynak UV bilgisi korunur. Satın alınan üniformalar ve personel rol renkleri önizlemede de uygulanır.
- Hazır süpürge modeli yerel pakete eklendi. Zemin başlığı oyuncunun önünde ilerler; sap ellerin orta noktasına, kabza iki elin yönüne ve açıklığına uyar. Görünen başlık salınımı temizleme merkezini de taşır. Sonradan alınan süpürge hareketli sahne katmanında çizilir. PC karşılaştırma karakterinde yürürken geriye salınan kol düzeltildi; yalnız süpürge aktifken iki el önde tutulur, bacak ve gövde klibi sürer.

## Model kaynağı

[Vacuum Cleaner — Zoe XR](https://poly.pizza/m/1_kdZRnuCo8), [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Orijinal GLB 79.140 bayttır; dış doku veya dosya bağımlılığı yoktur. Oyun renk, ölçü, başlık genişliği ve hareketli sap uyarlaması uygular.

Kaynak bilgisi Ayarlar künyesinde ve `public/packs/cafe-vacuum/ATTRIBUTION.txt` içinde bulunur. Model, kurulu oyunda internetten indirilmez.

## Doğrulama

- 137 birim testi ve üretim derlemesi geçti.
- İki şubenin bütün açılma aşamalarında personel kareleri erişilebilir; gövde, servis noktası ve ödeme alanı çakışması yok.
- Gerçek yürüyüşle kareden geçiş para kesmiyor. Dört rolün kısmi ödemesi yeniden açılışta korunuyor; menüden işe alım yalnız kalanı kesiyor. Sonraki çalışanın fiyatı ve kareden çıkma şartı doğrulandı.
- Yedi çevrimdışı tarayıcı senaryosu geçti: kayıt, satın alma, hedef arayüzü, tam masa bakımı, süpürge iadesi, dolap yanındaki kir ve servis noktası seçimi.
- Her dilde 30 simülasyon dakikası: Türkçe 140 servis, 35 yer temizliği, 43 masa dönüşü; İngilizce 144 servis, 40 yer temizliği, 39 masa dönüşü. En uzun ilerlemesiz aralık sırasıyla 26 ve 25 saniye. İki şubede yerleşim hatası yok.
- Aynı zemin sahnesinde çizim çağrısı 238'den 238'e kaldı. Temizlenen 14 hücrenin merkezinde artık leke kalmadı; trafik kiri UV hatası 0,00000003'ün altında.
- Süpürgede her karakter görünümü için 660 kare ve 18 alma/bırakma çevrimi ölçüldü. Dört hareketli mesh kullanılıyor; geometri/doku sayısı çevrimlerle büyümüyor. Kabza ve temizleme merkezi farkı sayısal hassasiyet düzeyinde; sabit kamera önbelleğinde de süpürge hareket ediyor.
- Genel çizim denetiminde renk/derinlik önbelleği, menü dönüşü, ekran dışı görünürlük ve grafik bağlamı kurtarma geçti.
- Kıyafet maskelemesinde 13.674 UV örneği aynı; 5.850 ten/saç köşesi etkilenmedi. Karakter başına tek çizim çağrısı korunuyor.

Tekrar çalıştırma:

```powershell
npm test
npm run build
npm run test:offline
npm run test:staff
npm run test:vacuum
npm run acceptance -- --minutes=30 --lang=tr,en
```

Tarayıcı kontrolleri ayrı geçici oturum kullanır. Bu sayılar otomatik senaryo sonuçlarıdır; gerçek oyuncu ilgisi ve telefon performansı için oynanış/cihaz denemesi gerekir.

Görsel ve ölçüm çıktıları: `.devshots/staff-hire-check/`, `.devshots/floor-polish-2026-09-05/`, `.devshots/vacuum-visual-check/`, `.devshots/acceptance-1.2.0/`.
