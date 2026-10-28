# Kafe Caddesi karakter özelleştirmesi

Mevcut oyuncu, personel ve iki müşteri modeli temel alınarak kafe için yeni kıyafet ve aksesuar katmanı uygulandı. Kaynak modeller ve animasyon dosyaları aynı; kaynak kaydı `KARAKTER-KAYNAGI.md` içinde korunuyor.

## Görünüm

- Oyuncu: petrol tonlarında önlük, bakır askılar ve boyun bağı, fincan arması, ön cep ve çapraz arka askılar.
- Garson: açık gömlek, koyu yeşil önlük, yan servis bezi ve cep kalemi.
- Kasiyer: açık gömlek üzerine kısa yelek, kontrast yakalar, düğmeler ve küçük fincan arması.
- Barista: krem gömlek, koyu önlük, bordo bağ ve askılar.
- Komi: mavi iş önlüğü, açık servis bezi ve bakır detaylar.
- Müşteriler: sekiz kararlı renk reçetesi; çizgili veya iki renkli üstler, saç/şapka renkleri, boyun bağları, küçük omuz çantaları ve gözlükler. Yüz ve ten yüzeyleri korunur.

Kıyafetler iskelete bağlıdır. Çarpışma yarıçapları, hareket hızı, tepsi bağlantıları ve sandalye düzeni değiştirilmedi. Hazır model dosyaları yeniden yazılmadı; imza parçaları `src/chars/SignatureWardrobe.ts` içinde oluşturulur.

## Çizim ve kaynak paylaşımı

Ek parçalar mevcut gövdeyle aynı rigli ağa birleştirilir. Oyuncu/personel gövdesi yaklaşık 3.979–4.536 köşe noktası ve tek çizim kullanır. Aynı kombinasyonun geometrisi ve malzemesi paylaşılır; her karakter bağımsız bir iskeletle hareket eder. Yeni uzak doku veya model isteği eklenmedi.

## Kontroller

- `npm test`: 322 kontrol geçti.
- `npm run build`: TypeScript ve üretim derlemesi geçti; ortak kaynak varlıklarının özetleri doğrulandı.
- `node tools/character-style-check.mjs after`: yedi rolde 56 poz/hareket kontrolü geçti. Bekleme, yürüme, çalışma, oturma, sevinme, kızgınlık, tepsi taşıma ve süpürge itme dahil; bozuk matris veya tarayıcı hatası yok. Aynı görünümün geometri/malzeme paylaşımı ve bağımsız iskeletleri doğrulandı.
- `node tools/cast-production-check.mjs`: soğuk/sıcak oyun açılışı ve 15 ürünlü taşıma kontrolü geçti. Üretim oyununda karakter tek rigli gövdeyle çiziliyor; uzak varlık isteği ve tarayıcı hatası yok.

## Görseller ve raporlar

- `.devshots/signature-cast/before-staff.png` / `after-staff.png`
- `.devshots/signature-cast/before-customers.png` / `after-customers.png`
- `.devshots/signature-cast/after.json`
- `.devshots/mobile-parity-2026-09-10/production-cast/production.json`

Güncel web sürümü: `http://127.0.0.1:5173/`. Açık sayfanın yeni kıyafetleri yüklemesi için yenilenmesi gerekir.
