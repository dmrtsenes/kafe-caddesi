# PC web önizlemesi ve performans — 5 Eylül 2026

## Kapsam

Kullanıcı seçimi: önceki karakterleri yalnız PC web önizlemesinde görmek; cihaza yükleme daha sonra yapılacak. Geliştirme adresi `http://127.0.0.1:5173/`. Bu çalışmada Android paketleme veya kurulum yapılmadı. Sürüm 1.2.0 olarak kaldı.

Yerel geliştirmede eski oyuncu, çalışan ve müşteri modelleri varsayılandır. Dosyalar `.asset-preview/local-test` içindedir; üretim karakter seçimi ve yayın denetimi korunmuştur. `?characters=procedural` prosedürel karşılaştırmayı, `?rawRig` ise eski modelin birleştirilmemiş parçalarını açar.

## Değişiklikler

- Koşu klibinde yalnız üst kolların salınımı, boş duruşa doğru %20 yumuşatıldı. Kaynak klipler, bacaklar, süreler, taşıma ve çalışma klipleri korunur.
- Aynı paleti kullanan karakter parçaları tek iskeletli çizimde birleştirildi. Aksesuarların kemik bağlantıları ve dünya konumları korunur; el/baş bağlantı noktaları tek matris güncellemesi üzerinden hesaplanır.
- Ayrılan müşterilerin kendilerine ait kemik dokuları serbest bırakılır. Paylaşılan geometri ve paletler tutulur.
- Sabit kamerada durağan yüzeylerin renk ve derinlik önbelleği kullanılır. Kamera hareketinde normal çizim yapılır. Desteklenmeyen grafik donanımında normal çizime dönülür.
- Eski derinlik kopyasındaki `GL_INVALID_OPERATION` giderildi. Saydam nesneler ve ışık tonlaması uygulanmayan etiketler ayrı çizilir; renkler ve öndeki/arkadaki nesnelerin örtüşmesi korunur.
- Kamera dışında kalan istasyonların görsel güncellemeleri ve çizimi atlanır; tekrar görünür olduklarında güncel durumları uygulanır. İş üretimi ve müşteri ekonomisi devam eder.
- Menü açıkken 3D sahnenin sürekli çizimi durur; kapatıldığında yeniden çizilir. Sekme arka planındaki mevcut döngü durdurma davranışı korunur.
- Düşük kalite, 3D alanı en fazla 650.000 piksele sınırlar ve pahalı gölge haritasını kapatır. Orta kademe 1.100.000, yüksek kademe 2.100.000 piksel bütçesi kullanır. HTML arayüz metinleri doğal çözünürlükte kalır.
- Sürekli yükte çözünürlük/gölge bütçeleri kademeli azaltılır. Müşteri kapasitesi bütün kademelerde 26 kalır.
- 60,2 Hz gibi küçük ölçüm sapmalarının 30 FPS hedefini yanlışlıkla 20 FPS ritmine düşürmesi engellendi.
- Grafik bağlamı kaybında çizim durur; eski önbellek kaynakları bağlam kaybı sırasında bırakılır, bağlantı geri geldiğinde yeniden oluşturulur.
- Kenney yiyecek paketinin eksik ortak `Textures/colormap.png` dosyası kendi kaynak arşivinden tamamlandı; çıkartma aracı da güncellendi.

## Ölçümler

Chrome, yazılımsal SwiftShader, 390 × 844, DPR 1, düşük kademe; aynı başlangıç kayıt örneği ve 18 karakter. Açılış kareleri/NPC pozisyonları birebir aynı olmadığı için aşağıdaki önce/sonra sayıları örnek sahne karşılaştırmasıdır.

| Ölçüm | Önce | Son |
| --- | ---: | ---: |
| Sabit kamerada kare başına çizim çağrısı | 352 | 193 |
| İskeletli karakter mesh sayısı | 64 | 18 |
| Çizim komutlarını hazırlama CPU medyanı | 1,7 ms | 1,2 ms |
| Çizim CPU yüzde 90 değeri | 2,1 ms | 1,4 ms |
| Karakter animasyon güncelleme medyanı | 0,4 ms | 0,3 ms |

Çizim çağrıları bu örnekte yaklaşık %45 azaldı. CPU değerleri GPU süresi veya cihaz ısısı ölçümü değildir. Kaynak sonuçlar: `.devshots/render-before/profile.json` ve `.devshots/render-web-final/profile.json`.

## Doğrulama

- `npm test`: 100 test geçti.
- `npm run build`: tip kontrolü, web derlemesi ve yayın dosyası denetimi geçti.
- Türkçe ve İngilizcede ayrı ayrı 15 dakikalık hızlandırılmış oyun: her dilde 109 servis; ilk sipariş/servis/kasa/temizlik, kayıt-yeniden açma, paneller ve her iki şubenin yerleşimleri geçti. Sonuçlar `.devshots/acceptance-web-performance` içinde.
- Önbellekli görüntü ile normal görüntü karşılaştırması: kontrollü derinlik sahnesinde ve oyunun üç kamera konumunda en fazla 1/255 renk kanalı farkı; 4/255 eşiğini aşan piksel yok.
- Menü açıkken 100 güncellemede 0 sahne çizimi ve 0 simülasyon ilerlemesi; menü kapatıldığında çizim devam etti.
- Kamerayı uzağa taşıyıp geri getirme: görünür istasyon sayısı 17 → 0 → 17.
- 20 müşteri oluşturma/çizme/silme döngüsünde grafik doku sayısı sabit kaldı.
- Gerçek WebGL bağlam kaybı/geri dönüşü ardından çizim devam etti ve grafik hata kodu 0 oldu.
- 2560 × 1440 pencerede düşük ayar çizim tamponu 1074 × 604 = 648.696 piksel olarak kaldı.
- Dört kat işlemci yavaşlatmalı tarayıcıda oyun ve çizim döngüsü devam etti. Bu sentetik kontrol fiziksel düşük seviye telefon veya uzun süreli ısınma testi yerine geçmez.
- Ayrıntılı görüntü ve kaynak testleri: `npm run test:render`; sonuç `.devshots/render-check/result.json`.

PC web önizlemesi hazırdır. Bütün cihazlarda sıfır takılma veya sıfır ısınma garanti edilemez; telefon üzerinde uzun süreli sıcaklık, pil ve kare süreleri kontrolü sonraki cihaz aşamasında yapılmalıdır.
