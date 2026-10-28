# Web pack + telefon bütçesi

Tarih: 2026-08-26
Durum: onaylandı (oyuncu: "tamam deneyelim, profesyonel şekilde yap")

## 1. Hedef

Web oyunu (Three.js + Capacitor APK) düşük telefonda **yayınlanır** olsun:
kasma yok, ısınma kontrol altında, pack’li kafe görünümü, oynanış/ekonomi aynı.

Unity native soğukluğunu birebir kopyalamak mümkün değil. Bu spec o iddiayı
taşımaz. Taşıdığı iddia: tarayıcı kabuğunda kalan yükü bilinçli bir bütçeyle
kesmek ve kutu-mobilyayı Kenney pack’leriyle değiştirmek.

## 2. Sabitler

1. Çözünürlük düşmez (`DPR_CAP` 2,0).
2. Karakter chibi kalır (Quaternius web’e girmez).
3. `maxCustomers` ısıyla kısılmaz.
4. Oynanış sayıları (`src/data`) değişmez.
5. Pack yoksa veya yüklenemezse eski prosedürel mesh devreye girer — boş
   kafe yok.
6. Kenney CC0; atıf `public/packs/KENNEY-LICENSE.txt`.

## 3. Telefon bütçesi

| Koşul | Kare tavanı | Gölge haritası | Ortam yansıması | MSAA |
|---|---|---|---|---|
| Masaüstü yüksek/orta | ekran senkronu | açık | açık | yüksek kademede |
| Native, kademe düşük | 30 | kapalı | kapalı | kapalı |
| Native, kademe orta/yüksek | 60 | kapalı | kapalı | kapalı |
| Isı basamağı ≥ 5 | 30 | (diyet zaten kapalı) | — | — |

120 Hz telefonda sınırsız kare, ölçülen ısınma kaynağıdır. Native her zaman
en fazla 60 çizer.

Isı merdiveni durur ama **ekonomiye dokunmaz**. L3 `maxCustomers −6` kalkar.
L2 karakter LOD emniyet ağı olarak kalır. L4 gölge (masaüstünde) kapanır.

## 4. Pack kataloğu

Kaynak: `_paketler/kenney_furniture-kit.zip` ve `kenney_food-kit.zip` içindeki
hazır GLB’ler. Çıktı: `public/packs/kenney/`. Manifest:
`src/world/packs/manifest.json`.

Yükleme açılışta, `Game` kurulmadan. Bir dosya düşerse diğerleri yüklenir;
eksik id prosedürele düşer.

Her GLB yüklenince mesh’ler birleştirilir, taban y=0 / xz merkezlenir,
hedef ölçüye ölçeklenir (masa `STATION_BODY` genişliği, sandalye yükseklik
0,92, ürün max xz 0,32). InstancedMesh kökeni böylece istasyon konumudur.

## 5. Sahne

- Masa/sandalye/tezgâh/makine/kova/tuvalet: pack gövde. Koltuk çıpaları
  (`seat0..n`) aynı matematikle durur — oturma kırılmaz.
- Ürün (`createProductMesh`): pack klonu; yoksa eski mesh.
- Karakter, leke, kir, VFX, branda, ilerleme halkası: dokunulmaz.

## 6. Kapılar

- `composeQuality(tier, 3).maxCustomers === 26`
- `targetFps({ native: true, heat: 0, tier: 'low' }) === 30`
- `targetFps({ native: true, heat: 0, tier: 'high' }) === 60`
- `targetFps({ native: false, heat: 0, tier: 'high' }) === 0`
- Pack yokken `createStationVisual` çökmez (prosedürel yol).
- `tsc --noEmit` temiz.
- APK: mevcut Capacitor hattı (`npm run android:apk`).
