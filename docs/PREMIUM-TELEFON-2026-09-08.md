# Telefon arayüzü ve öğretici — 8 Eylül 2026

Karakterler, modeller, üniformalar ve karakter seçim ayarı değiştirilmedi. Çalışma mevcut DEV karakteri ve ayrı tarayıcı kayıtlarıyla yapıldı.

## Uygulanan düzeltmeler

- Küçük telefondaki uzun öğretici metni dar bir sütunda kalıyordu. Kart genişletildi; 320 × 568 ekranda örnek kart 127 px yerine 74 px yüksek. Atla düğmesi 44 px dokunma alanını korur.
- Yatay telefonun öğretici balonu karakterin gövdesini kapatıyordu. Kart alt güvenli alana, taşıma göstergesi ayrı sağ köşeye yerleşir.
- Çentikli yatay ekranda paneller ve dönüş özeti güvenli alanları kullanır. Başlık ve sekmeler ezilmez; uzun içerik kendi içinde kayar. Açık panel, ekran döndürülünce yeniden yükleme gerektirmez.
- 320 px genişlikte Otomatik kare hızı seçeneği taşıyordu. Dört seçenek dar telefonda iki satıra ayrılır.
- Paneller ve dönüş özeti başlığı belli birer erişilebilir penceredir. Açılışta odak pencereye alınır, Tab/Shift+Tab dışarı çıkmaz; kapanınca başlatan düğmeye döner. Arkadaki HUD panel açıkken etkileşim dışıdır.
- Oyuncu/İstasyonlar sekmeleri ok tuşları, Home ve End ile kullanılabilir. Yeniden kurulan satın alma kartı odağı aynı kontrolde tutar. Çift aktivasyon, yeniden kurulum sırasında ikinci satın almaya dönüşmez.
- İsteğe bağlı teklifin İzle ve Kapat düğmeleri de en az 44 × 44 px dokunma alanına sahiptir. Teklif kapatma ayrıca test edildi; reklam başlatılmadı.
- Öğretici yakındaki masanın/kovanın erişilebilir kenarını gösterir. Bir engel varsa mevcut güvenli yaklaşımı korur. Dolu masayı temizletmez; geçerli teslim yeri bulunmayan değerli ürünü kovaya göndermek yerine normal rehbere bırakır.

## Doğrulama

- TR 320 × 568, EN 390 × 844, çentik payları uygulanmış TR 844 × 390: toplam 30 ekran kontrolü ve üç teklif görünümü.
- Her ekran için taşma, panel güvenli alanı ve panel düğmelerinin en az 44 px ölçüleri kontrol edildi. İstasyon grup başlıklarının kenara taşan tasarım payı metin taşması sayılmaz.
- Üç gerçek oyuncu yükseltmesi: para yalnız bir kez ödendi, seviye bir arttı, aynı kontrol odağı korundu. Her ölçüde klavye sekmeleri, ileri/geri odak döngüsü ve geri dönüş ekranı geçti.
- Her oturumda açık Ayarlar paneli 667 × 375 ölçüsüne döndürüldü; panel ekranda kaldı.
- Altı öğretici testi geçti; üçü bu tur eklendi. TypeScript kontrolü başarılı. Tarayıcıda çalışma hatası görülmedi.

Komutlar:

```powershell
npm run typecheck
node --experimental-strip-types --import ./tools/register-ts-test-loader.mjs --test src/sim/Tutorial.test.ts
node tools/premium-phone-check.mjs
```

Ham ölçümler ve ekranlar: .devshots/premium-phone-2026-09-08/before ve after. Bunlar masaüstü tarayıcıda telefon ölçüleridir; fiziksel cihaz performansı veya gerçek ekran okuyucu oturumu sonucu değildir. Kullanıcının kaydı ve Android paketi değiştirilmedi.
