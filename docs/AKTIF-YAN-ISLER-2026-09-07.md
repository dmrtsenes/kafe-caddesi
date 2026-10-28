# Aktif yan işler — 7 Eylül 2026

Yan şeritler artık kafe üretimini kullanan iki isteğe bağlı iş alanına açılıyor. Önceki dekor tasarımı korunuyor; gerçek kapılar, çalışma tezgâhları ve geliştirme pedleri eklendi.

## Oynanış

- Bahçe Çay Evi: Kahve bölümü açıldıktan sonra ₺800 ile açılır.
- Avlu Paket Servisi: Salon Hattı açıldıktan sonra ₺2.200 ile açılır.
- Döngü: açık makinelerden istenen ürünleri al → doğru tezgâha bırak → boş elle paketi hazırla → satış ücretini al → tezgâhı toparla → yeni sipariş.
- Tarifler yalnız tamamen üretilebilen ürünlerden seçilir. Birden fazla seçenek varsa ardışık aynı tarif gelmez.
- Her iş dört seviyelidir. İkinci seviye sipariş büyüklüğünü ve değerini artırır; üçüncü seviye 6 saniyelik otomatik paketleme açar (oyuncu yanında 2 saniye); dördüncü seviye her üç siparişe seri bonusu verir.
- Başlangıçta elle hazırlama 3 saniye, toparlama 1,4 saniye. Süre dolunca ürün kaybı veya görev cezası yoktur.
- Ürünler, hazırlanan paket ve kullanılmış peçete fiziksel olarak tezgâhta görünür.
- Üstteki iş kartı sıradaki ürüne veya tezgâha yönlendirir; tekrar dokunmak normal kafe yönlendirmesine döner.

## Kayıt ve ekonomi

Mevcut kayıt biçimi geriye uyumlu bir WorldSave.sideActivities alanıyla genişletildi. Yarım ödeme, teslim edilmiş ürünler, hazırlama/temizlik ilerlemesi, seviye ve tamamlanan sipariş sayısı korunur. Yeni kayıt sürümü veya kayıt sıfırlama yok.

Normal satış bedeli gerçek gelire ve satılan ürün sayısına eklenir; seri hediyesi ayrı ödüldür. Normal müşteri/servis sayısı yapay artırılmaz. Sipariş fiyatı oluşturulurken sabitlenir. Aynı tamamlanan sipariş iki kez ödemez. Bir seviyeden sonra aynı karede durmaya devam etmek sonraki seviyeyi satın almaz; yeniden gelmek gerekir.

Arka plandaki şube ve kapalı uygulama yan siparişleri tamamlamaz. Teslim edilmiş ürünler kaybolmaz. Sunucu, internet bağlantısı veya yeni para birimi gerekmez.

Bahçenin gerçek mobilyalarıyla eşleşen çarpışmalar eklendi. Yürüyüş yolları açık; havuz, bank, saksı ve bitki yataklarından geçilemez. Bahçe taş döşemesinin altında görünmeyen trafik kiri oluşturulmaz; yan tezgâh temizliği ayrı görünür iştir. Eski karakter seçimi korunur.

## Doğrulama

- 207 birim testi ve üretim derlemesi geçti.
- 22 yan iş modeli testi: farklı tarifler, yanlış ürün, tek ödeme, kısmi kayıt, 30–120 Hz hazırlama, otomasyon, bozuk veri ve fiyat korunması.
- Gerçek World/Player entegrasyonu: gereksinim kilidi, doğru maliyet, kazara ikinci seviye satın almama, fiziksel kapı, envanterden teslim, hazırlama, temizlik, otomasyon ve normal müşteri sayımlarının korunması geçti.
- Gerçek tarayıcı yenilemesi cüzdanı ve yan iş kayıtlarını korudu; yinelenen ödeme olmadı.
- Mevcut tüm bölümler açıldığında yerleşim denetimi temiz ve iki yan tezgâh ulaşılabilir.
- Gerçek makinelerden ürün toplayarak üçer sipariş tamamlayan yönlendirme denemeleri geçti. Bunlar otomatik oynanış kontrolleridir; insan oyuncu denge veya uzun süreli ilgi ölçümü değildir.
- 320/390 px kartlar taşmadı; düğmeler en az 48 px ve dokunma oyun hareketine sızmadı.
- Fiziksel ürün sunumu 60 döngüde nesne biriktirmedi.

Araçlar: tools/side-activities-check.mjs, tools/side-activity-route-check.mjs.
Kanıtlar: .devshots/side-activities-integration-2026-09-07/ ve .devshots/side-activity-ui-2026-09-07/.
