# Kafe Caddesi — gerçek oynanış reklamı

Çıktı: proje kökündeki `reklam-full.mp4`. 25 saniye, 1080 × 1920, 30 FPS, 750 kare; H.264/yuv420p görüntü ve 48 kHz stereo AAC ses. `reklam-full-izle.html` yerel önizleme sunucusunda videoyu oynatır.

## Yeniden üretim

```powershell
npm run promo:full
```

Bu komut TypeScript kontrolünü yapar, yalnız yerelde geçici bir Vite sunucusu ve temiz Playwright tarayıcı profili açar, mevcut oyunu sabit zaman adımlarıyla ilerletir, kareleri FFmpeg'e gönderir ve sesle birleştirir. Başarılı doğrulamadan sonra kökteki MP4'ü günceller. Eski bir `reklam-full.mp4` varsa `.devshots/reklam-full/previous-*.mp4` olarak yedeklenir. Sunucu, tarayıcı ve kodlayıcı işlem sonunda kapatılır.

```powershell
npm run promo:full:draft       # Hızlı mekanik/kadraj provası ve örnek kareler
npm run promo:full:preview     # Otomatik oynanan, sessiz çekim önizlemesi
npm run promo:full:check-save  # Normal kayıt → reklam → normal oyun kontrolü
npm run promo:full:check-video # Son MP4'ü Chrome'da baştan sona oynatır
```

Yerel önizleme adresi: `/reklam-full.html`. Elle kare ilerleten kayıt adresi: `/reklam-full.html?capture=1`. Sesli sonuç: `/reklam-full-izle.html` veya doğrudan MP4 dosyası.

Gerekenler: projedeki Node/npm bağımlılıkları, Playwright, Chrome ve FFmpeg/FFprobe. Bu makinede Chrome ile `.tools/video/ffmpeg/package/ffmpeg.exe` ve `.tools/video/ffprobe/package/ffprobe.exe` kullanılır. Başka makinede `FFMPEG_PATH`, `FFPROBE_PATH`, gerekirse `AD_BROWSER=msedge` ortam değişkenleri ayarlanabilir. Windows'un kısıtlı süreç ortamında Vite/Chrome başlatma izni gerekebilir. Bağımlılık veya izin eksikse işlem hata verip son geçerli videoyu korur.

## Çekimin oyuna bağlılığı ve kayıt yalıtımı

- Giriş `src/promo-gameplay/main.ts`; aynen normal oyundaki `World('kose')`, `Scene3D`, `Player`, `Customer`, `GameState`, karakter ve mobilya paketlerini kullanır. İstasyon konumları, çarpışmalar, harita ve fiyatlar değiştirilmez. `src/promo/` içindeki eski konsept kafe üreticilerini içe aktarmaz.
- `src/main.ts` değişmez. Çekim girişi `Game`, `Settings`, `SaveManager`, reklam ağı veya kayıt taşıma hizmetlerini başlatmaz. Kayıtları okumaz ve yazmaz. Türkçe yalnız bu belgenin varsayılan dilidir. Normal oyuna tek ek koruma, `Game.start()` içinde negatif ilk kare süresini sıfırlamaktır: tarayıcının kuyruktaki eski RAF zaman damgası yüzünden oyun süresi/üretim ilerlemesinin eksiye inmesi ve kaydın reddedilmesi önlenir. Kayıt şeması, fiyatlar ve normal pozitif zaman akışı değişmez.
- Çekime özel, bellekte hazırlanmış durum: ön salonun mevcut bölümleri açık; normal seviye 2 hız/el becerisi; 300 TL başlangıç bakiyesi; boş kasa; iki oturan müşterinin toplam üç çay siparişi; bulaşıkları önceden kaldırılmış, silinmesi gereken gerçek masa. Oyuncunun kendi ilerlemesinin görüntüsü olduğu iddia edilmez.
- Otomatik hareket normal `Player.update` girdisine dönüşür. Her video karesinde iki adet 1/60 saniyelik `World.update` çalışır. Temizlik, ürün alma, servis, ödeme ve işe alım sonuçları simülasyon tarafından üretilir. Kasa, gösterilen teslimatlardan dolar; 400 TL'lik çalışan mevcut satın alma karesinde normal bedelle alınır ve gerçek personel davranışıyla raf doldurur.
- Kurgu kesmelerinde yalnız oyuncunun odalar arası uzun yürüyüşü atlanır. Envanter, para, müşteriler veya iş sonuçları kesmelerde değiştirilmez. Mekaniklerin süresi ve ekonomisi hızlandırılmaz.
- HUD, menüler, rehber oku ve ilgisiz satın alma işaretleri çekim belgesinde gizlidir. İlgili işe alım karesi, sipariş balonları, servis ürünleri ve oyunun gerçek efektleri görünür. Kamera sabit yönlü ve yakın; son bölümde çalışanı yumuşakça takip eder.
- `titles.ts` yalnız mevcut oyun görüntüsünün üstüne Türkçe yazıları ekler. 9:16 perspektif doğrudan bu çözünürlükte render edilir; video ölçekle esnetilmez veya siyah bantlarla tamamlanmaz.

## Akış

| Zaman | Mevcut mekanik / görüntü |
|---|---|
| 0–3 sn | M1'de çay bekleyen müşteriler; uzun logo açılışı yok |
| 3–6 sn | M2'nin gerçek silme animasyonu ve temiz masa sonucu |
| 6–9 sn | Semaverde üretim, normal el temasıyla üç çayın tepsiye alınması |
| 9–14 sn | M1'e üç gerçek çay teslimi; siparişlerin tamamlanması |
| 14–17 sn | Bu teslimatların kasa parasının toplanması |
| 17–19,6 sn | Gerçek çalışan karesinde ödeme ve işe alım |
| 19,6–22 sn | Yeni çalışanın ürünü alıp rafı doldurması |
| 22–25 sn | Oyun devam ederken KAFE CADDESİ ve “Kendi kafeni yönet!” |

## Ses

`tools/gameplay-ad-audio.mjs`, projedeki sentezleyici temelinde deterministik bir enstrümantal eşlik üretir. Dışarıdan alınmış şarkı, ses kaydı veya örnek paket kullanılmaz. Melodi ve vurmalı sesler osilatör/gürültü senteziyle oluşturulur; servis, silme, nakit ve işe alım sesleri gerçek olay zamanlarıyla eşleşir. Sesin bu projede ve bu oyunun ticari tanıtım videolarında kullanılmasına ek bir üçüncü taraf müzik lisansı veya atıf şartı eklenmez. Bu not, oyunun önceden mevcut görsel paketlerinin lisanslarının yerine geçmez. Kaynak, WAV ve MP4 tekrar üretilebilir. Son ses hedefi -16 LUFS / -1,5 dBTP; 48 kHz stereo AAC.

## Doğrulama çıktıları

`.devshots/reklam-full/` altında mekanik olayları, örnek PNG'ler, tüm kareler için aktif karakterin baş/ayak kadraj kontrolleri, kayıt yalıtımı, normal oyuna dönüş testi, FFprobe bilgileri, ses seviyesi ve siyah kare taraması saklanır. Üç teslim, temizlik, üretim, tahsilat ve zamanında işe alım/raf doldurma gerçekleşmezse teslim durur. Boş veya bozuk ses, yanlış çözünürlük/süre/FPS, WebGL/JavaScript hatası, varlık yükleme hatası veya yanlış kadraj da üretimi başarısız sayar. Son MP4 ayrıca baştan sona çözülerek kontrol edilir; başlangıç, orta, personel geçişi ve kapanış kareleri MP4'ten tekrar çıkarılır.

13 Eylül 2026 kontrolünde 328 birim testi geçti. Normal oyunun 76.543 TL ve taşıma geliştirmesi 2 olan geçici kaydı, 750 reklam karesinden sonra aynı değerlerle açıldı. Tüm yerel depolama girdileri aynı kaldı; normal harita ve karakterle birebir eşleşme doğrulandı. Eski RAF zaman damgası özellikle yeniden üretildi ve negatif ilerleme/kayıt reddi oluşmadığı kontrol edildi. Çekimde 3 servis, M2 temizliği, 138 TL kasa tahsilatı, 400 TL karşılığı gerçek işe alım ve kapanıştan önce raf doldurma gerçekleşti. Film kodu oyuncu kayıtlarına sıfır okuma/yazma yaptı. Başlangıç ve işe alımda iskeletin başlangıç pozu görünmesin diye yalnız görsel animasyon harmanı çekimden önce oturtuldu; iş süreleri ilerletilmedi.
