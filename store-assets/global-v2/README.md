# Kafe Caddesi / Cafe Avenue — Google Play paketi

Öncelik: Türkiye ve Avrupa. Final öneri: **Kafe Caddesi: İşletme Oyunu** / **Cafe Avenue: Idle Tycoon**. Google Play hedefi proje yayın belgelerinde mevcut.

**Görseller üretildi ve teknik kontrolleri yapıldı. Yayın hakkı açısından koşul var:** mevcut karakterlerin Clean It XAPK’sından geldiği ve dağıtım lisansının doğrulanmadığı docs/KARAKTER-KAYNAGI.md içinde kayıtlı. Gerçek ekranlar bu karakterleri içerir. Yeni ikon ve kapaklar karakter içermez. Teknik dosya hazırlığı, mağaza kabulü veya karakter/isim kullanım hakkı onayı değildir.

- index.html: Türkçe/İngilizce önizleme ve indirme galerisi.
- final/shared: yazısız ortak 512 px ikon ve 1024 px ana dosya.
- final/tr ve final/en: şeffaf logo, SVG logo, tanıtım kapağı ve altışar telefon ekranı.
- metadata: başlık, kısa/tam açıklama ve alt metinler; UTF-8 TXT/JSON.
- report: kaynaklı 10 sayfalık ASO kararı, PDF ve düzenlenebilir HTML.
- research: 14 isim, 10 rakip, anahtar kelime niyetleri, kaynaklar, oynanış ve doğrulama kayıtları.
- captures: uygulamanın kendi Türkçe ve İngilizce arayüzünden 12 ham çekim.
- source: bağımsız SVG katmanları, orijinal raster çizimler, gerçek üretim istemleri, yazı tipleri ve üretim kodu.
- BRAND-GUIDE.md: kısa marka kılavuzu.

## Yeniden üretim

Depo kökünde mevcut Node.js, Playwright, Sharp ve Chrome kullanılır. Paket oyun kaynaklarını değiştirmez. Gerekli bağımlılıklar package.json sürüm kaydında zaten vardır; paket için oyun bağımlılıkları düzenlenmedi.

1. Oyun sunucusu: node store-assets/global-v2/source/serve.mjs
2. Yeni gerçek çekimler gerekiyorsa: node store-assets/global-v2/source/capture.mjs
3. Görseller: node store-assets/global-v2/source/build.mjs
4. Metinler, galeri ve rapor: node store-assets/global-v2/source/publish.mjs
5. Kontrol: node store-assets/global-v2/source/verify.mjs
6. ZIP: node store-assets/global-v2/source/package.mjs

Çekim aracı ayrı geçici profilde normal oyunu hızlandırır; gerçek kazanımlarla ilerler. Sabit varsayılan kamera ve mevcut modeller kullanılır. Kullanıcının kayıt profiline yazılmaz. Hızlandırılmış çekimler insan oyuncu performans ölçümü değildir. İki dil ayrı seans olduğundan aynı saniyeyi veya aynı ekonomik durumu temsil etmek zorunda değildir.

SVG’lerde başlık yazıları ve gerçek oynanış görüntüsü ayrı katmanlardır; fontlar ve görüntüler gömülüdür. SVG’yi editörde açarken aynı fontları kurun veya paketteki PNG çıktısını referans alın. İkon ve kapak çizimleri raster ana kaynaklardır; model/nesne katmanlarına ayrılmış 3D dosyalar değildir. Metin ve yerleşim katmanları düzenlenebilir. Görsel üretim istemleri saklanmıştır; aynı istemin tekrar çalıştırılması birebir aynı çizimi garanti etmez.

**Sınırlar:** Kaynak kodu, paket kimliği, kayıt anahtarları, oyun adı ve oyun içi tabelalar değiştirilmedi. İngilizce oyunda bazı sahne etiketleri Türkçe ve para birimi lira olarak kalır. Avrupa için İngilizce set tamamlandı; Almanca/Fransızca görseller bu teslimde yoktur. Ücretli ASO ve canlı Console verisi olmadan arama hacmi veya maksimum dönüşüm iddiası yapılmaz.

