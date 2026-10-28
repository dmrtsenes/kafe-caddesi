# SERA — özgün süpürge, 10 Eylül 2026

Oyundaki eski uyarlanmış modelin yerine özgün, yuvarlatılmış jade/füme gövde, şampanya metal çerçeve, geniş zemin başlığı ve eklemli motor/sap tasarımı eklendi. Park yerinde ve elde aynı model kullanılır. Eski süpürge dosyası artık yüklenmez.

Süpürge, çevresindeki erişilebilir yönlerden yaklaşık 0,28 saniye durunca alınır/bırakılır. Tek bir servis noktasına basmak gerekmez. Ekrandaki **SÜPÜRGEYİ AL / SÜPÜRGEYİ BIRAK** düğmesiyle şubenin her yerinden kullanmak da mümkündür. İlk kullanım adımları aleti gizlemez; süpürge eldeyken bu adımlar duraklar ve bırakma düğmesi görünür kalır. Koşarak geçiş ekipman değiştirmez. Alındıktan sonra aynı yerde beklemek işlemi tersine çevirmez; yeniden yaklaşma için 2,6 birimlik çevreden çıkılır. Ürün taşırken düğme neden kullanılamadığını gösterir; ürünleri silmez. Şube değiştirme ve yeni oturum kuralları korunur.

Mevcut yerel karakterin avuçları aşağı dönük olarak sapı kavrar; parmaklar kapanır. Tutamak bilek merkezinden değil avuç içindeki temas noktasından hesaplanır. İtme katmanı kaldırılınca özgün kol/parmak animasyonu geri gelir. Bacaklar ve yürüyüş klipleri korunur. Başlık zeminde kalır; motor başlıktaki eklemden döner, yalnız metal sapın uzunluğu el mesafesine uyar. Gerçek başlığın konumu temizlik fırçasıyla eşleşir. Alet değişimi önceki fırça izini sıfırlayarak aradaki uzak bir çizginin yanlışlıkla temizlenmesini önler.

## Ölçümler

| Süpürge başına | Sonuç |
| --- | ---: |
| Çizim çağrısı / mesh | 4 |
| Üçgen | 1.500 |
| Paylaşılan geometri tamponu | 45.288 bayt |
| Doku / şeffaf yüzey / ek ışık | 0 / 0 / 0 |
| Başlık genişliği | 1,50 oyun birimi |

Model aynı renk için bir kez üretilir; park ve eldeki kopyalar aynı tamponları kullanır. Her al/bırak işleminde yeni geometri, malzeme veya doku üretilmez. Küçük parçalar dört ortak çizimde birleşir. Alete özel gölge haritası çizimi yoktur; görünmeyen parçalar standart sahne görüş alanı kontrolüne tabidir. Kare döngüsünde yeni vektör, geometri veya ters kinematik çözümü üretilmez.

## Kontroller

- 289 birim testi geçti; bunlara geometri bütçesi, kaynak paylaşımı, avuç teması, parmakların geri dönüşü, süpürge kullanımı sonrası ana göreve dönüş ve mevcut animasyonların korunması dahildir.
- Yayın karakteri ve mevcut yerel karakterle bekleme, yürüme, dönüş ve süpürme görüntüleri alındı. Mevcut karakterin son tutuşu 30 ve 60 Hz adımlarında geçti; başlık/fırça ve el/tutamak hizaları sayısal yuvarlama sınırında eşleşti.
- 18 görsel al/bırak döngüsünde geometri/doku sayıları sabit kaldı. Oyuncu kaldırılınca eldeki alet bir kez ayrıldı. Ek 20 gerçek kontrol döngüsünde elde ve park yerinde çift alet oluşmadı.
- Uzak konumdan gerçek düğme tıklaması, ilk kullanımda erişim, dolu eller, duraklatma, açık panel, kilitli alet, park görünürlüğü ve erişilebilen 7 yönden yaklaşarak alma kontrolleri geçti. Koşarak geçiş, aynı yerde beklerken yanlış ters işlem ve düğmeyle bırakınca tekrar kapma oluşmadı.
- 320×740, 390×844 ve 844×390 ekranlarda düğme ekran içinde, en az 44 piksel dokunma alanıyla ve diğer kontrol düğmeleriyle çakışmadan görünür. Dar ekranda karakterin üzerine binmemesi görsel olarak kontrol edildi.
- Tarayıcı hatası ve başarısız varlık isteği yok. Eski süpürge dosyasına istek yok.

Kanıtlar: `.devshots/vacuum-premium/after`, `grasp`, `final-30fps`, `controls`. Önceki modelin görüntüleri `before` klasöründe korunur.

Tekrarlama: `npm test`, `npm run build`, `npm run test:vacuum`, `npm run test:vacuum:controls`. Düşük kare adımı için: `node tools/vacuum-visual-check.mjs --fps=30 --mode=comparison`.

Bu ölçümler masaüstü Chrome'da yapıldı. Fiziksel düşük seviye telefonda FPS, pil veya sıcaklık garantisi değildir. Bu çalışma kaynak kodunu ve web derlemesini günceller; Android APK/AAB üretilmedi.

## Motor sesi düzeltmesi

Önceki 7,5 Hz genlik salınımlı bant gürültüsü yerine harmonikleri sınırlı motor uğultusu ve yumuşatılmış hava akımı eklendi. Kir toplarken hava akımı artar, motor perdesi hafif düşer; açılış/kapanış yumuşak geçişlidir. Uzun yankı ve tremolo yoktur. Aynı anda yalnız iki ses kaynağı çalışır; bırakıldıktan sonra kısa sönüm tamamlanınca kaynaklar durdurulur ve bağlantılar çözülür. Açık menü ve duraklatmada süpürge sesi kapanır. İlk hareketten önce düğmeyle kullanım da tarayıcı sesini açar.

Gerçek ses çıktısı `.devshots/vacuum-audio/after.wav`: iki saniye normal motor, iki saniye emiş, iki saniye kapanış/sessizlik. Ölçülen tepe 0,119; son saniye RMS 0. Altı al/bırak ses döngüsünde her iki kaynak da sonlandı, ana ses grafiği 12 düğümde sabit kaldı. Sessize alma ve ses seviyesi kontrolleri geçti. Örnek dosya sentezin çıktısıdır; hoparlörde öznel dinleme değerlendirmesi yapılmadı.
