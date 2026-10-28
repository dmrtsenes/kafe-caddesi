# Tepsilo — marka ve Google Play görselleri

> **İkinci tur durumu:** Tepsilo kullanıcı tarafından elendi; bu sayfa önceki taslağın arşividir. Yeni isim seçilmedi. Güncel değerlendirme: [Global isim ve ASO seçenekleri](NAMING-ROUND-2.md).

13 Eylül 2026 · mevcut oyun sürümü 1.2.1 · önerilen marka adı

**Nihai isim önerisi: Tepsilo.** “Tep-si-lo” diye okunur. Oyuncunun sürekli kullandığı tepsiyi merkeze alır; çaydan kahveye, masa bakımından yeni alanlara uzanan aktif işletme döngüsünü tek ürüne indirgemez. Yedi harfli, kısa ve Türkçe karakter gerektirmeyen bir ad olduğu için uluslararası yazımı da aynıdır.

## En güçlü üç aday

| Aday | Gücü | Türkçe / uluslararası değerlendirme |
|---|---|---|
| **Tepsilo — seçilen** | Tepsi ve aktif servis çağrışımı; özgün, sıcak bir kelime markası | Türkçede açık heceler; uluslararası kullanımda aynı yazım. Anlamı logo ve kafe alt başlığı destekler. |
| Tepsora | Servis merkezli, kısa ve markalaşmaya uygun | Aynı yazım korunabilir; “tepsi” bağlantısı biraz daha zayıf. Web’deki benzer “Tepisora” kafe adına yakınlığı onu ikinci sıraya indiriyor. |
| Tepsi Turu | Taşıma ve kafe içinde dolaşma döngüsünü en doğrudan anlatır | Türkçede akılda kalıcı; İngilizce anlamı açık değildir, iki kelime olduğu için daha az kompakt. |

14 aday geliştirildi ve mekanik uyumu, söyleniş, ayırt edilebilirlik, uluslararası yazım ve görsel kullanım bakımından değerlendirildi. Bu sunum yalnız ilk üçü içerir.

Genel web ve Google Play, Apple App Store, Steam alanlarıyla sınırlandırılmış tam ad sorgularında bu üç ad için belirgin oyun/uygulama eşleşmesi bulunmadı. Arama motorunun döndürdüğü indeks sonuçları incelendi; tüm ülkelerin mağaza katalogları, alan adı/hesap müsaitliği, TÜRKPATENT, WIPO ve diğer tescil veritabanları denetlenmedi. Bu sonuç bir tescil veya kullanım hakkı garantisi değildir. Sorgular ve kaynaklar: [isim kontrolü](audit/name-screening.json).

## Dosyalar

| Dosya / klasör | Kullanım |
|---|---|
| `google-play/icon-512.png` | 512 × 512 RGBA PNG uygulama ikonu |
| `google-play/feature-1024x500.png` | 1024 × 500 RGB PNG tanıtım görseli |
| `google-play/screenshots/` | Sıralı altı adet 1080 × 1920 RGB PNG telefon kompozisyonu |
| `brand/logo-transparent.png` | Açık zemin için gerçek şeffaflık içeren logo, 1600 × 420 |
| `brand/logo-light-transparent.png` | Koyu zemin için şeffaf logo |
| `brand/` | SVG logolar, bağımsız sembol, 1024 piksel ikon master dosyası |
| `source/design/` | Kendi yazı tiplerini ve görsellerini içeren düzenlenebilir SVG kompozisyonlar |
| `source/layers/` | Ekran görüntülerinden ayrı SVG başlık katmanları |
| `source/brand.json` | Düzenlenebilir isim, renk, Türkçe başlık ve alternatif metinler |
| `source/art/` | Görsel üretim aracından gelen değiştirilmemiş ikon çizimi |
| `source/fonts/` | Fredoka / Nunito Sans yazı tipleri ve OFL lisansları |
| `captures/` | Çalışan oyundan alınmış ham kareler ve otomatik oynanıştan kazanılmış test kaydı |
| `audit/` | Mekanik kanıtları, çekim durumu, piksel/biçim kontrolleri ve proje koruma raporu |
| `preview/` | İnceleme için toplu görseller ve küçük ikon kontrolü |
| `index.html` | Yerel görsel teslim galerisi |
| `tepsilo-google-play.zip` | Son dosyalar, kaynaklar, kod ve kılavuzu içeren paket |

Google Play hedefi varsayılmadı: projenin `docs/YAYIN.md` belgesinde açıkça belirtiliyor. Dosyalar telefon mağaza görselleridir; tablet, TV veya iOS dosyası olarak etiketlenmemiştir.

## Gerçek oynanış ve çekim yöntemi

Normal `index.html` / `src/core/Game.ts` oyunu yerel Chrome’da mobil dokunmatik görünümle çalıştırıldı. Eski reklam konsepti sahneleri kullanılmadı. Geçici, ayrı bir tarayıcı profili oluşturuldu. Oyuncunun hareketi mevcut yol bulma ve etkileşim sistemlerinden geçti; ürün, para, personel veya mekân eklenmedi. Para ve alanlar oynanarak kazanıldı. Geliştirici botunun eski süpürge akışı çekim betiğinde güncellendi: canlı oyun “SÜPÜRGEYİ BIRAK” dediğinde mevcut düğmenin işlemi çağrılıyor. Oyun dosyaları değiştirilmedi.

Eylemler simülasyon adımlarıyla hızlandırıldı; bunlar insan oturumu veya telefon performans testi değildir. Çekim hedefi gerçekten gerçekleşmezse betik durur. Ekrandaki mevcut arayüz, karakter, malzeme, kamera açısı ve ışık korunur. Geçici bildirimlerin kendi süreleri tamamlanır; varsa isteğe bağlı teklif kendi kapatma kontrolüyle kapatılır.

Oyun 540 × 820 CSS piksel, 2× piksel oranıyla **1080 × 1640** olarak yakalanır. Görselin üzerine değil, üstüne ayrı **280 piksel** marka alanı eklenir. Sonuç **1080 × 1920** olur: oynanış pikselleri 1:1 yerleştirilir; esnetme, yapay keskinleştirme, yeniden ışıklandırma, model değiştirme veya arayüzü yeniden çizme yoktur. Kaynakta görüntülenen eski kafe tabelaları özellikle korunmuştur.

İkon/tanıtım çizimi stilize marka çalışmasıdır; oyun içi ekran değildir. Yerleşik görsel üretim aracı bir kez kullanıldı. Logo sembolü, yazı ve mağaza yerleşimleri SVG olarak üretildi; raster çıktılar tarayıcı ve Sharp ile dışa aktarıldı. Tam üretim istemi `source/icon-prompt.txt` içindedir.

## Yayın durumu

**Görsel dosyalarının teknik teslimi, oyunun dağıtım hakkının doğrulanması anlamına gelmez.** Projenin `docs/KARAKTER-KAYNAGI.md` belgesi, mevcut `PlayerS01.fbx`, müşteri modelleri ve paletin Clean It XAPK içinden çıkarıldığını ve dağıtım lisansının doğrulanmadığını açıkça kaydediyor. Gerçek oynanış kareleri bu mevcut modelleri içeriyor. Bu nedenle ekran görüntülerine koşulsuz “yayın hakkı temiz” onayı verilmiyor; mevcut karakterler için dağıtım yetkisi doğrulanmadan bu paket yayımlanmamalı. Yeni logoda, ikonda ve tanıtım illüstrasyonunda bu karakterler kullanılmadı.

Canlı mağazaya dosya yüklenmedi. Oyunun adı, paket kimliği ve kayıt anahtarları değiştirilmedi. Başlangıçta zaten mevcut olan çalışma alanı değişiklikleri korunur; içerik özetleri `audit/project-integrity.json` içinde karşılaştırılır.

## Yeniden üretim

Komutlar proje kökünden çalıştırılır. Mevcut Node.js, proje içindeki Playwright/Sharp/Vite ve yerel Chrome kullanılır; yazı tipleri paketle birlikte gelir.

```powershell
# Yalnızca tasarım / başlıkları tekrar üret:
node store-assets/source/build.mjs
node store-assets/source/verify.mjs

# Yeni normal oyun çekimleri için yerel sunucu (açık kalır):
node store-assets/source/serve.mjs
# Ayrı terminalde:
node store-assets/source/capture.mjs
node store-assets/source/build.mjs
node store-assets/source/verify.mjs
powershell -ExecutionPolicy Bypass -File store-assets/source/package.ps1
```

SVG dosyaları düzenlenebilir metin içerir. Metinleri düzenleyen masaüstü tasarım uygulaması gömülü fontu kullanmıyorsa paketlenen TTF’leri açıp yükleyin; son PNG’ler font kurulumundan bağımsızdır. Görsel üretim çizimi raster master olarak düzenlenebilir; nesnelere ayrılmış 3D sahne veya vektör çizim olduğu iddia edilmez.
