# Kafe Caddesi v4.0 — "Oda Oda Büyüyen Kafe" Tasarım Dokümanı

Tarih: 2026-08-08. Kaynak: kullanıcı geri bildirimi + Clean It (Homa) araştırması + kod analizi.

## Vizyon

Play Store / App Store'da My Perfect Hotel ve Clean It ile aynı rafta duracak,
**ilk 60 saniyede kendini öğreten, her 30-60 saniyede yeni bir şey açtıran,
oda oda büyüyen** dikey (portre) bir idle-arcade kafe oyunu.

Değişmeyen ilkeler (v3.0'dan devralınan): zincirsiz üretim (1 makine → 1 ürün),
asla cezalandırma (temizlik para kazandırır), Türkçe metinler, kod-üretimli asset.

## 1. Mekân: tek salon değil, ODALAR

Mekân 18 birim genişlik × ~46 birim derinlik; odalar derinlemesine dizilir
(portre kilidi, kamera yaw 0). Kapı güneyde, sokaktan girilir.

```
  KUZEY (arka)                                          GÜNEY (kapı)
  ┌────────────┬──────┬─────────────┬──────┬─────────────────┬─── sokak
  │  VIP SALON │ kapı │    SALON    │ kapı │  KAFE (başlangıç)│ ⇐ giriş
  │  z -20..-8 │      │   z -8..6   │      │     z 6..20      │
  └────────────┴──────┴─────────────┴──────┴─────────────────┴───
```

- **Oda 1 — KAFE (açık başlar):** sipariş tezgâhı + teslim bankosu güney-batıda,
  makine duvarı odanın kuzey duvarında (semaver → espresso → fırın → tost),
  2→6 masa. Oyuncu burada doğar.
- **Oda 2 — SALON (₺~25.000):** kare + yuvarlak masalar, tatlı dolabı + waffle,
  2. tezgâh, WC nişi. Duvar + çift kanatlı kapıyla ayrılır; kilitliyken kapı
  üstünde kilit rozeti + kapı önünde ödeme pedi. İçerisi açılana dek GİZLİ.
- **Oda 3 — VIP SALON (₺~400.000):** 3-4 VIP masa (mermer + altın, hesap 2.4×),
  soğuk bar + frappe; halı, şamdan, loş sıcak ışık. En pahalı oda.

Oda içi açılım: her masa/makine kendi pedinden tek tek satın alınır. Kilitli
masalar beyaz branda YERİNE zeminde **hayalet kontur + fiyat pedi** olarak
gösterilir; yalnızca SIRADAKİ 1-2 satın alım görünür, gerisi tamamen gizli
(göz korkutmama kuralı).

Duvar/kapı verisi `ZoneDef.room` alanına taşınır; Environment ve nav ızgarası
AYNI veriden okur (hardcode yok). Kapı genişliği ≥ 3.0, masa gövdeleri arası
koridor ≥ 1.6 birim; `validateLayout` her kilit kombinasyonunda koşar.

## 2. Etkileşim: niyet kapısı (dwell)

- **Alma (makine/banko):** menzile girince üstte küçük halka 0,35 sn dolar,
  sonra ürünler mevcut damlama hızıyla ele akar. Menzilden çıkınca halka sıfırlanır.
  Yanından koşarak geçen oyuncu YANLIŞLIKLA ürün almaz.
- **Satın alma pedi:** ped üstünde 0,8 sn duruş → halka dolar → para akmaya başlar.
  Ped ilerlemesi KAYDA GİRER (yarım ödeme kaybolmaz).
- Servis (masaya bırakma), para toplama, bulaşık: anında kalır — bunlar oyuncunun
  hedefi, kaza riski yok.

## 3. Taşıma: karma yığın

`carryItem+carryCount` → `slots: ItemId[]` (kapasite 3+). 1 çay + 2 tost aynı
anda taşınabilir. Masaya varınca eldeki HANGİ ürün siparişte varsa o verilir.
Garsonlar da karma taşır. Görsel yığın ve HUD göstergesi slot bazlı çizilir.

## 4. Kontrol: joystick

- Doğuş bölgesi ekranın ALT %42'si (dokunmatik + fare).
- Sürüklemede dinamik merkez alt bölge kutusuna KELEPÇELENİR — HUD üstüne çıkamaz.
- Bırakınca 200 ms'de söner; 1,5 sn hareketsizlikte tamamen kaybolur.

## 5. Yönlendirme: tek dil

- 14 noktalı iz SİLİNİR. DOM 👇 işaretçisi SİLİNİR.
- Kalan tek sistem: hedef üstünde zıplayan ok + fiil plakası + zeminde nabız halkası.

## 6. FTUE / ilk 5 dakika

Başlangıç ekranında yalnız: para pili + hedef şeridi + Deniz balonu. Diğer HUD
öğeleri (itibar, gelir/sn, yan butonlar, şube) ilgili sistem devreye girince
belirir ve tek toast ile tanıtılır.

Öğretici zinciri (her adım tek mekanik, 10-20 sn):
tezgâha git → sipariş al → çay al (dwell öğret) → masaya götür → parayı topla →
bulaşığı al → 2. masayı satın al (ped dwell öğret) → serbest + hedef şeridi devralır.

Açılım metronomu: ilk 3 dakikada her 30-45 sn'de bir satın alım (masa 2, espresso,
masa 3, garson, fırın...); Oda 2 ~8-10 dk; VIP ~35-45 dk. Bildirim izni ilk
oturumda İSTENMEZ (ikinci oturuma ertelenir).

## 7. Görsel kalite paketi

- **Masalar:** kare masa (4 ayak) + yuvarlak masa (tek kaide) + VIP (mermer tabla,
  altın kenar, örtü, şamdan). Sandalyeler: yastıklı oturak + kavisli sırt; VIP'te koltuk.
- **Sahne:** `scene.environment` (PMREM RoomEnvironment) → metal/cam canlanır;
  tezgâh/masa yüzeylerine canvas ahşap/mermer dokusu; mobilya altına temas
  gölgesi diski. Kilitli branda kalabalığı ekrandan kalkar.
- Rozet/etiket kalabalığı azaltılır: istasyon "×N" rozeti yalnız yaklaşınca.

## 8. Ekonomi (yeniden ayar)

Ürün merdiveni korunur (çay 25 → ... → frappe 1150). Oda 1 içi pedler:
masa2 150 → espresso 600 → masa3 1.2k → kare masa 2.5k → fırın 5k → masa 8k →
tost 14k. Oda 2 pedi 25k; içindeki masalar 4-15k, tatlı/waffle 30-60k.
VIP oda 400k; VIP masalar 80-250k, hesap çarpanı 2.4×. Sahil şubesi korunur.

## 9. Kapsam dışı (bu sürümde yok)

Reklam/IAP entegrasyonu, gün döngüsü, skill tree, dekorasyon editörü.
