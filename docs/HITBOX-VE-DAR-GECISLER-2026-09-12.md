# Hitbox ve dar geçiş düzeltmeleri — 12 Eylül 2026

Masa konumları, mobilya modelleri, dekor, karakter, kamera ve malzemeler korundu. Oyuncunun 0,32 birimlik gövde yarıçapı aynı. Kullanıcının sandalye geri bildirimi üzerine sandalyeler de gerçek engel yapıldı. Üst üste gelen veya geçişi kapatan yedi masanın sandalyeleri modele dokunmadan 0,15–0,30 birim içeri alındı; üç sandalyeli VIP masalarda tabla açıklığı ayrıca korundu. Komi işe alım alanı sandalyenin altından yakındaki boş zemine taşındı.

## Düzeltilen davranışlar

- Yuvarlak masaların kare çarpışma kutusu gerçek yuvarlak tabla biçimine çevrildi. Kare masalarda mevcut yuvarlatılmış köşeler hesaba katılıyor; tabla genişliği aynı.
- Karakter gövdesi, engelin köşesine yaklaşırken gerçek daire olarak hesaplanıyor. Kare gövde varsayımından doğan görünmez köşe blokları kaldırıldı.
- Hareket yalnız son konumda değil, adımın tamamında sınanıyor. İnce duvarlardan, masa ve tezgâhlardan yüksek hızda veya uzun karede atlama önlendi. Çarpışmada yüzeye doğru hareket kesiliyor, kenar boyunca hareket korunuyor.
- Sıra ve personel kalabalığı oyuncunun yürüyüşünü geri itemiyor. Oyuncuyla temaslarda daha dar, gövdeye uygun açıklık kullanılıyor; diğer karakterler aralarında normal mesafeyi koruyor. Kalabalığın düzeltme adımları da duvarlardan geçirilmiyor.
- Yol bulma ve yol düzleştirme aynı gerçek geometriyi kontrol ediyor. Hücre merkezleri arasındaki dar düz geçişler kullanılabiliyor; gövdeden dar geçitlere geçilemez rota üretilmiyor.
- Müşteri ve personel hareketi de sürekli çarpışma çözümünü kullanıyor. Yol bulunamadığında duvara doğrudan yürüme ve hedefe varmadan varmış sayılma düzeltildi.
- Kalabalığın duvar kenarındaki küçük güvenlik payına ittiği karakter, kısa bir çıkış adımıyla yoluna devam ediyor. Üst üste engellerde tekrarlı sağ-sol itiş yerine yakındaki serbest çıkış seçiliyor.
- El uzatma denetimi de yuvarlak masa geometrisiyle tutarlı.
- Sandalye oturağı ve kolçaklarının gerçek ölçüsü, sandalyenin dönüş açısıyla birlikte çarpışmaya eklendi. Masa açılışı, kayıt yükleme ve sandalye yükseltmelerinde görüntü ve hitbox aynı oturma düzeninden kuruluyor.
- Müşteri önce erişilebilir sandalye yanına yürüyor, ardından yalnız kendi sandalyesine oturma geçişi yapıyor. Masanın veya başka sandalyenin içinden oturma yok. Kalkışta yakındaki boş zemine yumuşak geçiş yapıp yürüyüşüne devam ediyor.
- Yol ızgarası 0,25 birime alındı. Örneklerin arasına düşen çok dar gerçek koridorların iki ucu geometrik olarak bağlanıyor; koridor içinde yeniden yol hesaplamak da destekleniyor. Ayrık alan kontrolü gereksiz uzun aramaları eliyor.

## Kontroller

- `npm test`: **320/320 geçti**.
- `npm run build`: TypeScript ve üretim derlemesi geçti.
- `node tools/hitbox-check.mjs`: sandalye yükseltmeleri dahil **29 aşama**, **1.596 rota**, **138 gerçek karakter yürüyüşü** geçti. Mahalle: 23 aşama / 1.393 rota / 93 yürüyüş; Sahil: 6 aşama / 203 rota / 45 yürüyüş. Yerleşim ve tarayıcı hatası yok.
- `node tools/chair-check.mjs`: iki şubede tüm sandalye yükseltmeleriyle **612 gerçek oyuncu çarpışma kontrolü** ve **204 müşteri oturma/kalkma döngüsü** geçti. Oyuncu 15/30/60 Hz'de azami yükseltilmiş hızla sandalye merkezine yürütüldü; gövde içine girme saptanmadı. Müşteriler yürüyerek yaklaşmayı, oturmayı ve boş zemine kalkmayı tamamladı.
- Yoğun mobilya dizisindeki **0,76 birimlik geçit**, 15/30/45/60/120 Hz ve 4/8/12 birim/sn hareket hızlarında kontrol edildi. Gerçekten gövdeden dar 0,58 birimlik aralık kapalı kalıyor.
- Yuvarlak masa kenarında kayma, ince duvara yüksek hızlı temas, üst üste mobilyadan çıkış, kalabalığın oyuncuya yol vermesi ve rota güvenlik payından toparlanma kontrolleri geçti.
- `node tools/interaction-check.mjs`: klavye/dokunma hareketi, servis/temizlik sonrası devam akışları ve mevcut etkileşim kontrolleri geçti.

Tarayıcı kontrolleri ayrı geçici oturumlarda çalıştı. Kullanıcının oyun kaydı değiştirilmedi. Bu teslim web kaynakları ve derlemesidir; Android paketi oluşturulmadı veya cihaza yüklenmedi.

## Dosyalar

- Geometri: `src/sim/Collision.ts`
- Yol ve hareket: `src/sim/Navigation.ts`, `src/entities/Actor.ts`, `src/entities/Player.ts`
- Dünya hitboxları ve kalabalık: `src/sim/World.ts`, `src/sim/CrowdSeparation.ts`
- Tekrarlanabilir kontroller: `src/sim/Navigation.test.ts`, `src/sim/CrowdSeparation.test.ts`, `tools/hitbox-check.mjs`, `tools/chair-check.mjs`
- Sahne raporu: `.devshots/hitbox-check/report.json`
- Kontrol görüntüsü: `.devshots/hitbox-check/full-cafe.png`
- Sandalye temas görüntüsü ve raporu: `.devshots/chair-check/chair-contact.png`, `.devshots/chair-check/report.json`

Güncel üretim derlemesi `http://127.0.0.1:5173/` üzerinden sunuluyor. Açık sayfanın yeni kodu yüklemesi için yenilenmesi gerekir.
