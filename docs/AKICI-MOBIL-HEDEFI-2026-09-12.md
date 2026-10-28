# Yüksek görsel kalite ve 60 FPS hedefi — 12 Eylül 2026

Hedef, normal oyun sırasında yüksek görsel kaliteyle istikrarlı 60 FPS.
A35, A15 ve Redmi Note 14 üzerinde bunun sağlandığı henüz doğrulanmadı.
Önceki masaüstü CPU yavaşlatma sonuçları bu telefonların GPU testi değildir.

## Bu turda uygulanan düzeltme

Menü açıkken oyun döngüsü bilerek 10 FPS'e iner ve sahnenin çizimi durur.
Önceki FPS sayacı menü, oyun ve farklı kare hedeflerinin ölçümlerini aynı
pencerede tutuyordu. Menüdeki düşük değer oyuna dönüşte 60 FPS ile
karşılaştırılabiliyor, 0,75 saniyelik yanlış yük sinyali otomatik korumayı
artırabiliyordu. Menüdeki arayüz maliyeti de oyun yükü sayılıyordu.

- Kare hedefi değişince yeni bir ölçüm penceresi açılıyor. İlk tam örneğe kadar
  FPS bilinmiyor sayılıyor; önceki menünün FPS değeri kullanılmıyor.
- Menüdeki ölçümler otomatik oyun kalitesi kararına katılmıyor.
- Başlatma/devam etme ve FPS tercihi değişiklikleri eski ölçümü temizliyor.
- Gerçek oyun yüküne tepki, Android'in ciddi ısı koruması ve soğuma beklemesi
  devam ediyor. Kare hedefleri ve görsel kalite kademeleri değiştirilmedi.

`FrameRateMeter`: `src/core/FrameClock.ts`; bağlantı: `src/core/Game.ts`;
menü ölçüm ayrımı: `src/core/Quality.ts`.

305 birim kontrolü ve TypeScript denetimi geçti. Gerçek `Game.start` döngüsünü
kontrollü zaman ve hafif iş yüküyle çalıştıran tarayıcı kontrolünde dört menü
dönüşü, 30/60 tercih geçişleri, yeniden başlatma ve ciddi ısı bildirimi geçti.
Menü dönüşleri koruma seviyesini yükseltmedi; ciddi ısı seviyesi 3, 30 FPS
korumasını sürdürdü. **Bu sentetik zamanlama kontrolü fiziksel cihaz FPS ölçümü
değildir.** Sonuç: `.devshots/fps-stability-2026-09-12/result.json`.

## Kalan darboğazlar ve sonraki çalışma sırası

1. **Gerçek CPU/GPU ayrımı:** 60 FPS için kare aralığı yaklaşık 16,7 ms.
   Mevcut ölçümlerin çoğu CPU'nun komut hazırlama süresidir. Destekleyen
   cihazlarda asenkron GPU zamanlamasıyla hareketli kamera, kalabalık servis
   alanı ve durağan sahne ayrı ölçülmeli. Açılış derlemeleri ve tekil takılmalar
   sürekli yükten ayrılmalı.
2. **Hareketli kamera maliyeti:** Mevcut statik renk/derinlik önbelleği kamera
   sabitken çalışıyor. Oyuncu yürürken kalan mobilya/ürün çizimleri ve malzeme
   geçişleri azaltılmalı. Yeni birleştirmeler stok, görünürlük ve kurulum
   animasyonlarında önce/sonra görüntü karşılaştırmasından geçmeli.
3. **Tam ekran GPU işi:** Kenar yumuşatma her karede ekran dokusunu kopyalıyor
   ve son bir geçiş yapıyor. Kopyayı azaltacak çizim hedefi düzeni incelenmeli;
   ton eşleme, sRGB renkleri, şeffaf cam ve etiketlerin rengi korunmalı.
   Bu değişiklik bu turda uygulanmadı.
4. **60 FPS öncelikli uyarlama:** Bugünkü otomatik mod düşük kademede 30 ile
   başlıyor; mobil yük/ısı seviyesi 2'de de 30'a iniyor. Bunu yalnızca sayıyı
   60 yaparak değiştirmek işlem kapasitesi kazandırmaz. Gerçek ölçüme göre
   önce gereksiz GPU işi azaltılmalı; gerekirse 3D çözünürlüğü küçük adımlarla
   esnetilmeli. Bu son seçenek keskinlikten bir miktar ödün verir; HTML arayüz,
   model ayrıntısı, müşteri sayısı ve oyun hızı korunabilir.
5. **Uzun oturum doğrulaması:** Her varyantta normal ve dolu kafe, hareketli
   kamera ve 15–20 dakikalık oturum. Ortalama FPS yanında %95/%99 kare süreleri,
   uzun takılmalar ve ısı seviyesi kaydedilmeli. Adaptif ayar düşüşlerinden sonra
   cihaz rahatladığında 60 hedefine dönüş de denenmeli.

## Cihaz farkları

- Galaxy A35: Exynos 1380 ve 120 Hz ekran. Yüksek kalite/60 FPS için test
  hedefidir; donanım özellikleri bu oyunda 60 FPS garantisi değildir.
  [Samsung teknik bilgiler](https://www.samsung.com/uk/smartphones/galaxy-a/galaxy-a35-5g-awesome-lemon-128gb-sm-a356bzybeub/).
- Galaxy A15 ailesi: 90 Hz ekran. Mevcut `pacedFps(90, 60)` sonucu 45'tir;
  etkin ekran frekansı 60 Hz ise hedef 60'tır. Android paketinde desteklenen
  uygun ekran modunu istemek ayrıca değerlendirilmeli. Web sayfası fiziksel
  ekran frekansını zorlayamaz.
  [Samsung A15 ailesi](https://news.samsung.com/id/galaxy-a15-series-mulai-2-jutaan-untuk-yang-pasti-performanya-dengan-super-amoled-dan-nfc),
  [Android kare hızı ve ekran uyumu](https://developer.android.com/media/optimize/performance/frame-rate).
- Redmi Note 14 4G: Helio G99-Ultra / Mali-G57 MC2. Redmi Note 14 5G:
  Dimensity 7025-Ultra / IMG BXM-8-256. İkisi de 120 Hz'e kadar ekran sunuyor;
  farklı GPU'lar için ayrı doğrulama gerekli. Kullanıcının kastettiği
  4G/5G ve RAM varyantları henüz belirtilmedi.
  [Xiaomi 4G](https://www.mi.com/global/product/redmi-note-14/specs/),
  [Xiaomi 5G](https://www.mi.com/global/product/redmi-note-14-5g/specs/).

## Tekrarlama

```sh
npm test
npm run test:fps:stability
npm run build
```
