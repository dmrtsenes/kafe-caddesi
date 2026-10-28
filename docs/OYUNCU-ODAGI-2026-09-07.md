# Telefon odağı ve yardımcıların rolü — 7 Eylül 2026

Bu turda kamera ve HUD, oyuncunun yaptığı işi öne çıkaracak şekilde güncellendi. Çalışanların mevcut hız/kapasite kazanımları korunurken oyuncunun yapmak üzere olduğu işe öncelik verildi.

## Telefon kadrajı ve ekran

- Dikey telefonda sabit yakın kadraj: 40° görüş, 17,8 mesafe. Görev değişiminde zoom yapılmaz.
- Oyuncu odakta kalır. Yakındaki işe küçük bir bakış payı verilir; uzak hedef veya çalışan kamerayı çekmez.
- İlk açılışta oyuncu ile ilk kasa birlikte görünür. Oda kenarında hareket/oda ofsetleri sınırlandırılır.
- Ekran ile dünya koordinatları aynı projeksiyonu kullanır. Görüş kapatma sistemi kaydırılmış kamera odağından değil, gerçek oyuncu konumundan hesaplanır.
- Dünya okunun söylediği anlık iş HUD'da belirgin satırdır. Uzun vadeli hedef ve ödül daha sakin ikinci sıradadır.
- Bahçe/paket kartları “Yan işler” düğmesinden açılır; seçimden sonra kapanır. İş ilerlemesi ve görev seçimi korunur.
- Telefonda gelir/sn ve festival kısayolu üst satırdan kaldırıldı; ilgili sistemler ve paneller çalışmaya devam eder.

Ölçüm (yayın karakteri, CSS piksel):

| Telefon | Önce oyuncu yüksekliği | Sonra |
|---|---:|---:|
| 390 × 844 | 47 px | 71 px |
| 320 × 740 | 41 px | 63 px |

İlk kasa, oyuncu güvenli alanı, HUD okunabilirliği, yan iş seçimi ve ekran→zemin dönüşümü 320/390 piksel ve yatay telefonda doğrulandı. Önce/sonra görselleri `.devshots/player-focus-2026-09-07/` altında.

## Yardımcılar oyuncunun işini tamamlamaz

- Tezgâhtar fazla stoğu taşır. Oyuncu ürünü almak için yaklaştığında bir ürün bırakır; oyuncu uzaklaşınca son ürünü de kullanabilir. Ürünü yok etmez veya sırf bu kural için bütün üretimi durdurmaz.
- Komi oyuncunun yanındaki veya başladığı masayı devralmaz. Bulaşık için kovaya gidiş/dönüşe 35 saniyelik öncelik verilir; terk edilmiş iş sonsuza kadar kilitlenmez. Komi diğer masaları hazırlamaya devam eder.
- Masaya servis ve özel siparişlerin oyuncu teslimatı, kazancın toplanması ve gelişim kararları oyuncuda kalır.
- Kasiyer sırayı, tezgâhtar raf ikmalini, barista üretimi, komi diğer masaların bakımını rahatlatır. İşe alım bildirimi ve personel kartı hem yardımcı katkısını hem oyuncuya kalan işi açıklar.

## Doğrulama

- 209 birim testi; üretim derlemesi başarılı.
- Tam izin verilen kadro/seviye ile: üç üründen ikisini yardımcı aldı, birini oyuncuya bıraktı; oyuncu son ürünü gerçekten alabildi. Oyuncu uzaklaşınca yardımcı son ürünü aldı.
- Oyuncunun başladığı masa kovaya gidiş sırasında korunurken diğer masa komi tarafından hazırlandı.
- Tam kadroda masadaki sipariş kendiliğinden tamamlanmadı; oyuncunun gerçek teslimiyle tamamlandı. Kazanç otomatik olarak cüzdana eklenmedi.
- 54 kasa süre deneyi, 33 el aktarım deneyi ve 12 personel kapasite deneyi geçti. Komi iki masayı hazırladı; oyuncu para/görev sayacını yapay artırmadı.
- TR 320 px / EN 390 px panel, satın alma ve dokunma alanı kontrolleri geçti.
- Çizim önbelleği, görünürlük, menü dönüşü ve grafik bağlamı kurtarma kontrolleri geçti.
- İki dilde 30 simülasyon dakikası: TR 90 servis, 27 yer temizliği, 22 masa dönüşü; EN 102 servis, 33 yer temizliği, 26 masa dönüşü. İlerleme ve yerleşim kontrolleri geçti. Bunlar otomatik senaryolardır; gerçek insan ilgisi veya fiziksel telefon FPS ölçümü değildir.

Komutlar:

```powershell
npm test
npm run build
npm run test:focus
npm run test:assists
npm run test:mechanics
npm run test:ui
npm run test:render
npm run test:offline
node tools/player-focus-check.mjs --comparison
node tools/acceptance.mjs --minutes=30 --lang=tr,en --character=cleanit-apk-local-test
```

Son komutta mevcut PC karşılaştırma karakteri açıkça seçilir; yayın karakterinin kadrajı ayrı olarak varsayılan `test:focus` ile sınanır. Testler ayrı tarayıcı kayıtları kullanır. Android paketi veya kullanıcının oyun kaydı bu tur değiştirilmedi.
