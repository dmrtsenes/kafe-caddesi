# Üretim ve doğrulama kaydı

13 Eylül 2026. Bu sürüm Avrupa ve Türkiye önceliğiyle üretildi.

- Çalışan uygulama: gerçek index.html, Three.js sahnesi ve varsayılan portre kamerası. Yerel sunucu 127.0.0.1:5187; reklam taslak sayfası kullanılmadı.
- Çekimler: iki ayrı geçici tarayıcı profili, uygulamanın native tr/en dil seçimi, 540 × 960 CSS piksel ve 2× cihaz ölçeği. Sonuç 1080 × 1920. Oyun simülasyonu hızlandırıldı; kazanılan gelir ve normal satın almalarla ilerleme sağlandı. Bu insan performansı veya telefonda kare hızı testi değildir.
- Kod ve kayıt: kullanıcı profilinden ayrı oturum; kayıt kalıcılığı kapalı. Oyun kaynaklarına yazılmadı. src/public/docs ve temel proje/Android kimlik dosyalarından 341 SHA-256 özeti başlangıç ve bitişte eşleşti.
- Yeni çizimler: yerleşik görsel üretim aracı iki kez gerçekten çalıştırıldı. Biri ikon, diğeri ayrı kapak çizimidir. İstemler source/art/ altında, orijinal raster çıktılar icon-generated.png ve feature-generated.png olarak saklandı. İkon için eski gerçek üretim çekimi, kapak için yeni İngilizce üretim çekimi nesne referansı olarak kullanıldı. Yeni çizimlerde karakter yoktur.
- Tasarım: düzenlenebilir SVG metin/yerleşim katmanları ve PNG çıktılar. Paytone One ve Barlow Condensed, resmi Google Fonts deposundan indirildi; lisans metinleri eklendi. Gerçek ekranlar yapay çizime dönüştürülmedi.
- Düzeltmeler: ilk yazı tipinin büyük İ glifi farklı aileye düştüğü saptandı; tam Türkçe kapsamlı Paytone One ile değiştirildi. Başlık bölgesi dışına taşan dekoratif çizgi kırpıldı. İlk kapakta ikonu tekrarlayan düzen yerine ayrı üretim çizimi hazırlandı. Raporun yoğun karşılaştırma sayfası taşma yapmayacak şekilde düzenlendi.
- Teknik kontrol: 20 final dosyası; piksel boyutu, RGB/RGBA kanalları, ikon boyutu, logo alfa kanalı, metin sınırları, glif kapsamı, taşma, yerel dil ve gerçek görüntü piksel eşitliği. Galeri masaüstü ve mobil genişliklerde iki dilde kontrol edildi. PDF’nin gerçek 10 sayfası ayrıca rasterize edilip metin ve bağlantıları okundu.
- Kullanım sınırı: karakter dağıtım hakkı doğrulanmadığı için tam yayın uygunluğu verilmez. İsim taraması da tescil veya kullanım hakkı garantisi değildir. Store Console’da herhangi bir yükleme, uygulama adı değişikliği veya yayın yapılmadı.

Görsel kontroller previews/ içindeki temas sayfaları ve final dosyaları üzerinden yapılmıştır. Ölçümler research/verification.json, render-audit.json, pdf-audit.json ve zip-audit.json içinde bulunur.
