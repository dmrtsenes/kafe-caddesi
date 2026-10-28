# Görsel kaliteyi koruyan web optimizasyonu — 11 Eylül 2026

Yerel web sürümüne iki ek optimizasyon uygulandı. Çözünürlük, gölge kalitesi,
karakter modelleri, animasyon hızı, müşteri sayısı, taşıma kapasitesi ve ekonomi
ayarları değiştirilmedi. Önceki optimizasyonlar korundu.

## Değişiklikler

- **Kullanılmayan taşıyıcılar:** Küçük tepsi, geniş tepsi ve servis arabasından
  yalnız kullanılan parça karakterin çizim ağacında tutulur. Görünmez parçalar
  artık her karede karakterin kemik/konum güncellemelerini almaz. Nesneler tekrar
  kullanılmak üzere korunur; yeni ürün, kapasite kademesi ve boşaltma geçişleri
  aynı görselleri yeniden bağlar.
- **Sabit mobilya dönüşümleri:** İstasyon ve ürün raflarındaki konum, dönüş,
  ölçek ve yerel matris değişmediyse aynı matris yeniden oluşturulmaz. Böylece
  sabit alt parçalar da gereksiz yere güncellenmez. Açılma animasyonu, ürün
  hareketi, üst nesnenin hareketi, elle yazılmış matrisler ve zorunlu güncellemeler
  çalışmaya devam eder. Özel güncelleme yöntemi olan nesnelere müdahale edilmez.

Uygulama: `src/entities/CarryStack.ts`, `src/world/LocalMatrixCache.ts`,
`src/world/StationView.ts`, `src/world/PickupView.ts`.

## Ölçüm

Aynı tarayıcı oturumunda aynı kalabalık sahnenin önceki ve yeni davranışı
karşılaştırıldı. Referans modunda standart matris güncellemeleri ve görünmez
taşıyıcıların eski bağlantıları geri kondu. Her karede ölçüm sırası dönüşümlüydü.
7 müşteri + 8 personel + oyuncu; bütün bölgeler açık; hareket eden kamera;
384 × 832 görünüm, DPR 2,8125, yüksek kalite ve 2.527.200 gerçek çizim pikseli.
Her koşulda 240 eşleştirilmiş çizim örneği alındı.

| Ölçüm | Önce | Sonra |
| --- | ---: | ---: |
| Bir çizimde matris çarpımı | 3.334 | 2.156 |
| Bir çizimde nesne matrisi ziyaretleri | 2.831 | 2.430 |
| Normal CPU: ortalama çizim hazırlığı | 1,261 ms | 1,197 ms |
| 4 kat yavaşlatılmış CPU: ortanca | 15,6 ms | 14,8 ms |
| 4 kat yavaşlatılmış CPU: %90 | 17,1 ms | 16,2 ms |

Matris çarpımları yaklaşık **%35,3**, ziyaretler **%14,2** azaldı. Yavaşlatılmış
CPU'da ortanca çizim hazırlığı yaklaşık **%5,1** kısaldı. Masaüstünde normal CPU
ortancası iki koşulda da yaklaşık 1,2 ms; bu ölçüm için ortanca hızlanma iddiası yok.

Bu süreler CPU'nun çizim hazırlama/gönderme süresidir; tamamlanmış GPU süresi veya
oyunun toplam kare süresi değildir. GPU: NVIDIA RTX 5070 Laptop. CPU yavaşlatma
düşük/orta telefon GPU'sunu taklit etmez; fiziksel telefonda FPS ve sıcaklık bu
çalışmada ölçülmedi. Bu sonuçlar %35 FPS artışı anlamına gelmez.

## Doğrulama

- Yüksek, orta ve düşük kademelerde **132 önce/sonra görüntü karşılaştırması**
  geçti. 114 çift tamamen aynıydı. Kalan 18 çiftte yalnız bir pikselde en fazla
  1/255 kanal farkı vardı; aynı referansın art arda çizimlerinde de 1/255 fark
  görüldü. Dünya matrisleri, çizim çağrıları ve üçgen sayıları bütün çiftlerde aynı.
- Taşıyıcının 0/4/8/0 kademe geçişleri, 0/1/3/6/15/21 ürün, boşaltma, tekerlek
  hareketi, el tutuşu, mobilya açılma/kilitlenme animasyonları, stok ve raf tepkisi
  kontrol edildi. Ürün sayıları korundu.
- Ayrı tepsi/servis arabası testi **1.617 ürün yerleşimi kontrolünde** taşma,
  ürünlerin üst üste binmesi veya raf yüksekliği hatası bulmadı.
- **299 birim kontrolü**, TypeScript kontrolü ve üretim derlemesi geçti.
- Mevcut **22 görsel önbellek geçişi** testi geçti. Bu ayrı test, önbellekli ve
  doğrudan çizimi karşılaştırır: 4/255 eşiğini aşan piksel oranı en fazla
  %0,000608 çıktı; önce/sonra optimizasyon karşılaştırmasıyla karıştırılmamalı.
- Genel çizim testi geçti: menüde çizim/simülasyon durması, devam etme, ekran
  dışındaki karakterlerin geri gelmesi, grafik bağlamının geri yüklenmesi ve
  karakter oluşturma/silme sonrası doku sayısının 88 → 88 kalması doğrulandı.
  WebGL hatası yok.

## Tekrarlama

```sh
npm run test:performance:web
npm test
npm run build
node tools/visual-cache-lifecycle-check.mjs --output=.devshots/web-performance-2026-09-11/lifecycle
node tools/render-check.mjs
```

Eşleştirilmiş ham sonuçlar:
`.devshots/web-performance-2026-09-11/result.json`.
Diğer sonuçlar aynı klasördeki `unit.log`, `lifecycle/result.json` ve genel çizim
testi için `.devshots/render-check/` altındadır. İlk keşif amaçlı ayrı başlatılan
`runtime-profile` sonuçlarında müşteri sayısı farklı olduğundan bunlardan
önce/sonra hızlanma oranı çıkarılmadı.
