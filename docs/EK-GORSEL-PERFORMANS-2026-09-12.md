# Görsel kalite korunarak ek optimizasyonlar — 12 Eylül 2026

Çözünürlük, gölge kalitesi, kenar yumuşatma, karakter modelleri, animasyon hızı,
müşteri kapasitesi ve oyun kuralları korunarak aşağıdaki değişiklikler uygulandı.
Bu çalışma, 11 Eylül optimizasyonları ve 12 Eylül FPS sayacı düzeltmesinin üzerine
eklenmiştir.

## Uygulanan değişiklikler

1. **Para yığını ve makine ürünleri:** Kasadaki altı banknot demeti artık aynı
   geometrilerle iki çizim çağrısında çizilir; önce en fazla 12 çağrı gerekiyordu.
   Makinenin çıkışındaki üç aynı paket ürünü de tek örnek grubunda çizilir.
   Adet, konum, boyut, malzeme ve tüm üçgenler korunur. Saydam veya özel
   karışımlı ürünlerde nesnelerin ayrı sıralanması gerektiği için mevcut yol
   kullanılır. Paket yüklenmezse önceki ürün modelleri çalışmaya devam eder.
2. **Ürün yerleştirme önbelleği:** Taşınan ürünün değişmeyen alt parçalarının
   sınırı ilk oluşturulduğunda hesaplanır. Her ürün ekleme/çıkarma sırasında
   modelin bağlantısını söküp tekrar ölçme, geçici kutu/vektör oluşturma ve
   yeniden bağlama işi kaldırıldı. Aynı envanter tekrar verildiğinde gereksiz
   dizi kopyası da oluşturulmaz. 3/6/15 görsel kapasite ve gerçek toplam adet
   aynı kalır.
3. **Görünmeyen istasyon parçaları:** Konumu değişmeyen istasyon ve raf
   gruplarının görünmeyen alt dalları olağan çizim güncellemesine girmez.
   Açılma animasyonları, görünür olma, başka üst nesneye bağlanma ve zorunlu
   matris güncellemeleri korunur. Yeni alt parça eklemek grubu yeniden
   güncellenmek üzere işaretler.
4. **Bölgeye bağlı dekor:** Bölge açılınca görünen dekorların ve kapı kilitlerinin
   kendi içindeki sabit, opak parçaları birleştirildi. Her dekor/kilit kendi
   görünürlük grubunda kalır; açılmamış alanların içeriği görünmez.

Değişen oyun dosyaları: `src/entities/CarryStack.ts`,
`src/world/StationView.ts`, `src/world/PickupView.ts`,
`src/world/VisibilityRoot.ts`, `src/world/Environment.ts`.

## Ölçülen sonuç

Aynı kaynakların değişiklik öncesi kopyalarıyla ayrı tarayıcı bağlamları
karşılaştırıldı. Üç kalite kademesi, 384 × 832 ekran ve yüksek kademede
2.527.200 çizim pikseli kullanıldı. Teknik nesne kimliklerinin rastgele sayı
tüketimi, yalnız testte oyun rastgeleliğinden ayrıldı. Böylece iki koşulda
para, sipariş istatistikleri, müşterilerin konum/durumları ve personel sayısı
eşleşti. Son GPU karşılaştırmasında da aktör durumları aynıydı.

| Yüksek kalite, aynı kamera ve içerik | Önce | Sonra |
| --- | ---: | ---: |
| Üretim alanı çizim çağrıları | 205 | 199 |
| Masalar bölgesi çizim çağrıları | 214 | 204 |
| Dinlenme alanı çizim çağrıları | 135 | 131 |
| Altı para demeti bulunan kasa görünümü | 139 | 125 |
| Makinede üç çay bulunan yakın görünüm | 115 | 113 |
| 440 taşıma değişiminde tekrarlı sınır hesabı | 8.280 | 0 |

Son koşuda taşıma yerleştirmelerinin ortalama süresi 0,0193 → 0,0068 ms oldu.
Bu, yalnız ilgili işlemin ölçümüdür; toplam oyun hızlanması değildir.

**Toplam FPS veya GPU süresinde belirgin bir hızlanma henüz doğrulanmadı.**
Normal masaüstü CPU'sunda tam oyun adımının ortancası iki koşulda da yaklaşık
1,1 ms idi. Aynı sahnede GPU sorgularıyla, sırası dönüşümlü dört turda ölçülen
ortalama süre yaklaşık 2,604 → 2,648 ms çıktı; sonuç GPU hızlanması göstermiyor.
Bu nedenle çizim çağrısındaki azalma FPS artışı olarak sunulmuyor.
GPU NVIDIA RTX 5070 Laptop; fiziksel A35/A15/Redmi ölçümü değildir.

## Görüntü ve davranış doğrulaması

- **117 görüntü çifti:** Yüksek/orta/düşük kalite; üretim, masalar, dinlenme
  alanı; para 0/1/3/6; çay 0/1/2/3; latte/tost/waffle/frappe boş/dolu;
  açılma animasyonu; küçük tepsi/geniş tepsi/araba/taşan adet/boşaltma;
  normal ve hızlı karakter poz geçişleri.
- Bütün çiftlerde çözünürlük ve üçgen sayıları aynı. 4/255 kanal farkı eşiğini
  aşan piksel oranı en fazla **%0,000752**; en yüksek tek kanal farkı 72/255.
  Bunlar az sayıdaki kenar/örtüşme pikselindeki rasterizasyon farklarıdır;
  bütün görüntülerin bit düzeyinde aynı olduğu iddia edilmez.
- **307 birim kontrolü** ve TypeScript denetimi geçti. Yeni kontroller,
  gizlenen alt parçaların geri gelmesini, hareketi, zorunlu güncellemeleri
  ve başka üst nesneye bağlanmayı kapsıyor.
- Son üretim derlemesi başarıyla tamamlandı; güncel web çıktısı `dist/` altında.
- **22 önbellek geçişi** testi geçti: ürün/stok/para/masa/kilit/kurulum/taşıma.
  Personel modelleri kalite geçişlerinde korunuyor; ısı koruması ve soğuma
  sonrası dönüş çalışıyor.
- Genel çizim testi geçti: menüde çizim ve simülasyonun durması, devam etme,
  ekran dışına çıkan karakterlerin geri gelmesi, grafik bağlamının yeniden
  kurulması ve karakter silme sonrasında doku sayısının 86 → 86 kalması.
  WebGL hatası görülmedi.
- Etkileşim testi geçti: klavye ve dokunmatik hareket, tekil reklam ödülü,
  dil değişiminde para/FPS tercihini koruma, kayıt yükleme ve servis/temizleme
  döngüsünün devam etmesi. Test sunucusundaki gereksiz bağımlılık taraması
  kapatılarak kontrolün başlatma zaman aşımı giderildi.

Bir animasyon temizliği adayı normal pozlarda çalışmasına rağmen çok hızlı
geçişlerde karışım sırasını değiştirerek poz farkı oluşturdu. Bu aday çıkarıldı;
karakter animasyon dosyaları önceki davranışını koruyor.

## Tekrarlama ve kanıtlar

```sh
npm test
npm run typecheck
node tools/lossless-render-check.mjs
node tools/visual-cache-lifecycle-check.mjs --output=.devshots/lossless-render-2026-09-12/lifecycle
node tools/render-check.mjs
node tools/interaction-check.mjs
npm run build
```

Önce/sonra aracı bu oturumda saklanan
`.devshots/lossless-render-2026-09-12/before/src/` kaynak kopyalarını kullanır.
Ham sonuçlar `result.json`, sıkıştırılmış piksel görüntüleri `reference/` ve
`optimized/`, birim çıktısı `unit.log`, önbellek sonuçları `lifecycle/` altındadır.
Önceki kaynak kopyaları korunmalıdır.
