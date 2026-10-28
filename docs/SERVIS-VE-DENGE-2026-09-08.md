# Servis erişimi ve tempo — 8 Eylül 2026

Bu tur müşteri kabulü, kasa/ürün önceliği, yardımcı katkısı ve masa çevresindeki erişimi inceler. Telefon kadrajı ve oyuncu önceliği önceki turdaki haliyle korunur.

## Düzeltilen davranışlar

- Masa servisi ve bulaşık toplama tek bir noktaya bağlıydı. Oyuncu artık masanın yürünebilir kenarlarından çalışabilir. Kova da erişilebilir yüzlerinden kullanılabilir. Yakındaki rehber hedefi aynı kenara yönelir.
- Menzil ve duvar kontrolü hem hedef seçiminde hem gerçek işlemde uygulanır. El erişimi mobilyanın fiziksel kenarına kadar sınanır; yaklaşma noktası ile masa arasındaki ince bölme de işlemi engeller.
- Çakışan kasa/ürün alanında önce eldeki geçerli teslimat tamamlanır, ardından kasadaki para toplanır; yeni ürün alma sonra gelir. Kontrol örneğinde eskiden ₺600 beklerken sıfır para ve beş ürün alınmıştı; şimdi ₺600 toplandıktan sonra ürün alınıyor.
- Eller doluyken masa silme, zemin silme veya devam eden leke görevi gösterilmez. Ürünler teslim/rafa bırakmaya, bu mümkün değilse kasa ve yeni sipariş akışına yönlendirilir. Rehber değerli ürünleri çöpe attırmaz.
- Rafta seçilmiş yan iş ve mevcut faydalı ürün grubu önceliklidir. Masaların beklediği adet eldeyse fazla ürün yüklenmez; sıradaki eksik ürün seçilir. Aktif talep yokken stok alma mümkündür.
- Bütün kasalar doluysa normal yeni müşteri çağrılmaz. Her kasa kendi kuyruğunu yönetir: görev başında kasiyer yoksa üç, varsa beş kişi. Henüz kasasına yürüyen çalışan bu kapasiteyi artırmaz. Yeni müşteri gerçekten yeri olan kasaya atanır.
- Bitmemiş masa siparişlerinin adedi ve bekleme oranı arttığında müşteri geliş aralığı kademeli uzar; en fazla 2,5 kat. Hafif iş yükünde eski temel ritim korunur. Grafik kalitesi müşteri sayısını veya bu dengeyi değiştirmez.
- Süpürge alma halkası yakındaki dolu kahve rafınca sıfırlanabiliyordu. Başlayan süpürge işlemi tamamlanana kadar raf alma adımı bekler. Kasa/teslimat önceliği ve yakın lekeyi silme davranışı korunur.
- Süpürge eldeyken satın alma karesi artık süpürgeyi bırakma uyarısı verir. Ölçüm karakteri de aynı oyun kuralına uyar; süpürgeyle ödeme karesinde sonsuza kadar beklemez.

## Yardımcılar

Kasiyer sipariş sırasını, tezgâhtar raf ikmalini, barista üretimi, komi diğer masaların bakımını rahatlatır. Masa servisi, özel sipariş teslimi, kazanç toplama ve gelişim kararları oyuncuda kalır. Oyuncunun almak üzere olduğu son ürün ve başladığı masa bakımı korunur.

Aynı temel kasada ölçülen sipariş süreleri: oyuncu 0,72 sn; başlangıç kasiyeri 2,40 sn; seviye 10 kasiyer 1,44 sn. Yardımcı yükseltmesi yaklaşık %40 süre kazandırır; oyuncunun aynı işi hızlı yapma avantajı sürer. İstasyon yükseltmeleri ayrıca etkilidir.

## Doğrulama kapsamı

- İki şubede 432 yürünebilir çevre noktası: önce 126 noktada servis/toplama seçilebiliyordu, şimdi 432 noktada seçiliyor.
- 72 gerçek masa döngüsü: iki ürünün kısmi/tam ücreti, tekrar teslimi reddetme, bulaşıkları alma, kovaya bırakma, masayı silme ve tamamlanmayı bir kez sayma.
- 28 kova yaklaşımı; dört ince duvar engelleme senaryosu.
- Dolu kasada yeni kabulü durdurma, dolu personelsiz kasa yerine uygun kasiyerli kuyruğa atama, raf seçimi/adet kontrolü.
- Yoğun masa işi örneğinde gerçek doğurma aralığı 1,90 sn yerine 4,74 sn; aralık çarpanı 2,5. Bu sentetik yoğunluk örneği bütün oyun için sabit müşteri sıklığı değildir.
- Temel testler: 215 başarılı. Üretim derlemesi başarılı.
- Yedi çevrimdışı kayıt/ödeme/rehber senaryosu başarılı; yabancı ağ bağımlılığı görülmedi.
- En yüksek yardımcı kadrosunda oyuncunun son ürünü alabilmesi, başladığı masanın korunması ve gerçek oyuncu teslimatının gerekli kalması doğrulandı.
- 54 kasa süresi, 33 oyuncu el aktarımı, 12 yardımcı kapasitesi senaryosu; kominin gerçek masa hazırlığı ve oyuncu görev sayacı kontrolü başarılı.

Otomatik oynayan karakterin süpürgeyle satın alma alanına gitme ve köşeleri tam hızla kesme davranışları da düzeltildi. Uzun koşular, yükleme süresinin rastgele oyun kareleri tüketmemesi için gerçek açılışın bir sabit adımından sonra başlatılır. Eski ve yeni botun gelirleri doğrudan bir hızlanma yüzdesi olarak karşılaştırılmaz.

Son üretim paketinde üç ayrı 30 dakikalık koşu geçti. Tarayıcı hatası, yerleşim hatası veya personel kurtarma müdahalesi görülmedi. Eylem sayacındaki en uzun değişmeme süresi 38–65 saniyeydi; kabul sınırı gevşetilmedi.

| Başlangıç | Servis adedi | Toplam kazanç | Hedef indeksi | En uzun eylem arası |
|---|---:|---:|---:|---:|
| 417 | 97 | 14.749 | 13 | 65 sn |
| 808 | 100 | 13.678 | 16 | 38 sn |
| 1206 | 102 | 18.814 | 16 | 38 sn |

Ham sonuçlar: `.devshots/service-balance-2026-09-08/progression/`. Masa/kova/ödeme sınamaları: `.devshots/service-balance-2026-09-07/after/results.json`.

Kontroller ayrı tarayıcı kayıtları kullanır. Ana oyunun kayıtları sıfırlanmaz. Bunlar otomatik davranış sınamalarıdır; gerçek oyuncu memnuniyeti, geri dönüş oranı veya fiziksel telefon performansı sonucu değildir.

```powershell
npm test
npm run build
npm run test:service
npm run test:assists
npm run test:mechanics
npm run test:offline
node tools/progression-check.mjs --minutes=30 --policy=guide --seed=417,808,1206 --output=.devshots/service-balance-2026-09-08/progression
```
