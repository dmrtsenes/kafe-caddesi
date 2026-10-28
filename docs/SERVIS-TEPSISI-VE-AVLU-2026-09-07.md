# Servis tepsisi ve yan avlular — 7 Eylül 2026

Bu tur yalnızca servis taşıma araçları ve Köşe şubesinin kapalı yan şeritlerini ele aldı. Karakter seçimi, kayıt biçimi, satın alma bedelleri ve oyun ilerlemesi değiştirilmedi.

- Tepsi: yuvarlatılmış ceviz çerçeve, koyu yeşil iç yüzey, ince pirinç kenar ve açık yan kulplar. Geniş tepsi ve servis arabası aynı malzeme ailesinde. Ürünler gerçek model tabanlarına göre merkezleniyor; mevcut el bağlantısı korunuyor.
- Batı şeridi: üç zeytin bahçesi, taş döşeme, ahşap banklar ve çiçek saksıları.
- Doğu şeridi: üç sığ süs havuzu; ortada alçak su çanağı, diğerlerinde taş adımlar; ahşap geçişler ve bitkili kenarlar. Su statik bir görseldir, ilave yansıma geçişi veya oyun görevi yoktur.
- Bahçe sınırları: |x| 9.3–17.3, z −17.5–9.2. Ana salon, oda girişleri ve açılabilir oda alanları dışında. Sahil şubesine eklenmez.
- Tek malzemeli kutuların mevcut sabit sahne birleştirmesine girmesini engelleyen kontrol düzeltildi; çok malzemeli, gizli ve hareketli parçalar hariç tutulmaya devam eder.

## Kontroller

185 birim testi geçti. Son kaynak derlemesi başarılı. Tepsi kontrolünde 264 yük düzeni / 1.617 ürün yerleşiminde taban, kenar veya ürünler arası çakışma hatası yok.

`tools/premium-service-check.mjs final`: beş geniş ekran açısı ve dört telefon görüntüsü; başlangıç ve tüm odalar açık durumda yerleşim denetimi temiz. Tarayıcı hatası yok. Kullanıcının kaydından bağımsız tarayıcı oturumu kullanıldı.

Aynı test kamerasında batı çizim çağrısı 297 → 235, doğu 237 → 190. Bahçeler ek geometri içerir; bu ölçüm gerçek telefon FPS sonucunun yerine geçmez. Yeni bahçeler 19 birleştirilmiş çizim ve 19.882 üçgen içerir; ek doku kullanmaz.

Görseller ve ölçümler:
- `.devshots/premium-service-before/`
- `.devshots/premium-service-final/`
- `.devshots/premium-tray-2026-09-06/`

Tekrar kontrol araçları: `tools/premium-service-check.mjs`, `tools/tray-fixture-check.mjs`.
