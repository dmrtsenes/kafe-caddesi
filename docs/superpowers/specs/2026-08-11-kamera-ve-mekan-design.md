# Kamera Kadrajı ve Mekân Mimarisi — Tasarım

Tarih: 2026-08-11 · Durum: onaylandı, uygulamaya geçildi

Bu belge iki BAĞLI değişikliği kapsar: portre kadrajın daraltılması ve iki
kilitli odanın birbirinden mimari olarak ayrıştırılması. İkisi tek spec çünkü
oda tasarımının değeri yalnız yeni kadrajda görünür; eski kadrajda hangi plan
yapılırsa yapılsın iki oda aynı kareye girer.

Kir sistemi, ekonomi temposu ve animasyon kadansı AYRI turlardır; burada yer
almazlar.

## Sorun (ölçüldü, 375×812)

| Ölçü | Değer | Sonuç |
|---|---|---|
| Görünen derinlik | 53,4 birim | Mekân 39,2 derin → tüm kafe + fazlası tek karede |
| Görünen genişlik | 11,2 birim | Mekân 18 geniş |
| Karakter yüksekliği | 40 px / 812 (%4,9) | Türde %8–14 |

Kullanıcı şikâyeti ("kilitli olan 2 oda yan yana çok kötü gözüküyor") bir plan
sorunu değil, bir KADRAJ sorunudur: bar, ön salon, SALON ODASI ve VIP her an
aynı karededir, mekân kat planı gibi okunur.

İkinci kat sorun plandadır: iki oda 10,4×5,2 ve 10,8×4,4 — neredeyse aynı
dikdörtgen, aynı duvar yüksekliği, aynı tabela şablonu, aynı kapı+kilit
rozeti. Tek fark renktir (yeşil / altın). `lift: 0,4` ekranda okunmaz.

## Karar 1 — Kamera

`BALANCE.camera.maxDistance: 28 → 20` ve `pitch: 43 → 48`.

Aday ölçümleri (375×812, aynı odak):

| mesafe | pitch | görünen en | görünen derinlik | karakter px | bar görünen |
|---|---|---|---|---|---|
| 28 (mevcut) | 43 | 11,4 | 54,0 | 40 (%4,9) | %100 |
| 22 | 46 | 9,0 | 38,2 | 49 (%6,0) | %98 |
| 21 | 47 | 9,2 | — | — | %94 |
| **20** | **48** | **8,2** | **32,4** | **52 (%6,4)** | **%90** |

Seçim d20/pitch48. Bar görünürlüğü endişesi ölçümle düştü: kamera bar hattının
2,2 birim önünde durduğu için bar uzak düzlemdedir ve %90'ı kadraja girer;
mutfak ve ilk masa da görünür kalır.

İki lever birbirinden bağımsızdır ve karıştırılmamalıdır:
**pitch derinliği, mesafe karakter boyunu** kontrol eder. (Ölçüm: d22/pitch40
karakteri 53 px yapar ama derinliği 52,8'de bırakır — pitch düşünce derinlik
geri gelir.)

### viewWidth tuzağı — değiştirilmiyor, belgeleniyor

`viewWidth: 17` portre telefonda HİÇ uygulanmaz. Türetme 60 birim mesafe
ister, `maxDistance`'a çarpar, kalan açıyı `fovMax`'tan almaya çalışır ve orada
da tavana dayanır. Yani portrede kadrajı belirleyen `maxDistance` + `fovMax`
ikilisidir. `viewWidth` yalnızca GENİŞ ekranlarda (tablet/masaüstü) canlıdır.

Bu bir tuzaktır: portre kadrajı değiştirmek isteyen biri `viewWidth`'i ayarlar
ve hiçbir şey olmaz. `Scene3D.resize()` içine bunu açıklayan bir yorum eklenir.
`minDistance` (19) değiştirilmez — geniş ekran davranışı aynen korunur.

## Karar 2 — Mekân

Kullanıcının kendi önerisi izlenir: "birisini aşağıya koy diğerini yan tarafa
koy... sol tarafa ayrı açılan bir yer... diğerini de açık alan gibi bir yer".

**SALON ODASI → batıda, KAPALI, ayrı açılan oda.** Kendi kapısı, halı,
kitaplık, sıcak sarı lambalar. İçeri girilen samimi bir iç mekân.

**VIP SALON → derinde, 5 basamak YUKARIDA, AÇIK teras.** `lift: 0,4 → 0,9`,
gerçek merdiven, pergola, gökyüzü açık, mermer zemin, korkuluk, ipli ışıklar.

İki alan dört ayrı eksende ayrışır:

| | SALON ODASI | VIP |
|---|---|---|
| Konum | batı | derin (güney) |
| Kot | 0 | +0,9 |
| Kapalılık | duvar + kapı | açık, korkuluklu |
| Malzeme | halı + ahşap | mermer + pergola |

Şu anki tek ayrım renkti. Yeni kadrajda ikisi zaten aynı kareye girmez; plan ve
kadraj birbirini destekler.

### Kilitli hâl — beyaz branda kaldırılıyor

İlk ekranda ~25 beyaz branda yumrusu var; oyun kafe değil mobilya deposu gibi
açılıyor. Kilitli alanın içi tamamen gizlenir; yerinde yalnız kapalı kapı/çit
ve tabela kalır.

## Kısıtlar (değişmez)

- Portre kilidi ve `yaw: 0` korunur. Yaw, derinliği yatay bütçeye sızdırır.
- Nav ızgarası 2 boyutludur; `lift` YALNIZCA görseldir, A* ve gövde çarpışması
  onu görmez.
- Oda duvarları görsel ve çarpışma olarak aynı veriden (`roomWalls`) kurulur.
- İstasyon/dekor aralıkları 0,15–0,95 "boğaz" bandına asla girmez; ya ≥0,95
  boşluk ya da bilerek çakışma.
- Ödeme pedlerinin çevresinde erişim boşluğu ölçülür — duvar taşınca pedler
  sıkışıp ilerlemeyi sessizce kilitliyor.

## Doğrulama

1. `World.validateLayout()` (DEV'de kurulumda koşar) hatasız geçmeli.
2. Portre render karşılaştırması: aynı odaktan önce/sonra, 375×812 oranında.
3. `tools/balance-bot.js` 50 dk × 2 koşu — kamera simülasyonu etkilememeli;
   bölge açılış zamanları ölçüm bandında kalmalı (Oda 2: 8–17 dk).
4. Karakter piksel yüksekliği ve görünen derinlik yeniden ölçülür.

## Kapsam dışı

Kir sistemi (trafik tabanlı zemin kiri), ekonomi temposu (iki ölü bölge:
11:44→18:57 ve 31:19→39:02), animasyon kadansı (18 kare/çevrim, eşik 20).
Her biri kendi spec'ini alır.
