# Ayakta servis ve desteklenen tepsi

Ürün alırken ve masaya/bankoya bırakırken görülen koşma sorununun kaynağı, `work` durumunun `Sweep_Run` klibine bağlanmasıydı. El işi fazı bu klibin zamanını ilerletince bacaklar da koşu pozlarından geçiyordu.

## Etkin değişiklikler

- `Service_Standing`, mevcut bekleme klibinin ilk pozundan üretilir. İşlem boyunca bacak, kalça ve kök izleri sabittir; `Sweep_Run` ürün aktarımı için kullanılmaz.
- `ServiceArmLayer` sadece kolları çözer. İki avuç tepsinin altını destekler. Serviste sol destek korunur, sağ el ürünün temas fazıyla birlikte uzanır ve geri döner.
- Tepsi bağlantısı iki bileğin hareketli ortalamasından ayrılarak sabit bir destek noktasına taşındı. Sağ el uzanınca tepsi onun peşinden sürüklenmez.
- Destek yüksekliği ve uzaklığı gerçek karakterin kol uzunluğuna göre kontrol edildi. Koşu döngüsünün tamamında avuçlar tepsiden ayrılmaz. İlk ürün/son ürün geçişlerinde el hedefleri yumuşatılır.
- Ürün teması, gerçek yatay hız 0,45 birim/sn altında olduğunda başlar. Uzaklaşma girişinin kendisi engellenmez; yarım kalan el teması iptal edilir.
- Tepside daha ince koyu ceviz çerçeve, mat yeşil kaymaz taban, daha ince metal kenar ve altta iki destek kullanılır. Küçük ve büyük tepsi aynı arka kenar açıklığını korur; ürün yerleşimi ve kapasiteleri aynıdır.
- Tepsideki bardak/tabaklar ayrı ayrı yalpalamaz; yüzeye sabit durur. Tepsiler hâlâ üç çizim kullanır, geometri paylaşılır.
- Normal boş elle koşu ve bekleme, kıyafet özelleştirmeleri, hitbox ve masa/sandalye düzeni korunur. Süpürge mevcut katmanını kullanır; servis arabasının zemin/sap bağlantısı korunur.

## Doğrulama

- `npm test`: 324 test geçti; sabit servis klibi, iki avucun sabit desteği, sağ elin ayrı uzanması, katman geri dönüşü ve kısmi geçiş kontrolü dahil.
- `npm run build`: tip kontrolü, üretim derlemesi ve kaynak varlık doğrulaması geçti.
- `node tools/service-animation-check.mjs`: 30/60/120 FPS'de, küçük/büyük tepsiyle koşu ve servis kontrolü geçti. Avuç konum hatası en fazla yaklaşık `1,46e-8`; ayak kayması `4,8e-12`, tepsi destek kayması sıfır. Gerçek `Player.update` ve `World.updateStationInteraction` ile 27 ürün alma/bankoya bırakma/masaya servis aktarımı tamamlandı; hiçbir aktarımda koşu klibi etkin değildi.
- `node tools/tray-fixture-check.mjs --output=.devshots/service-tray`: üç taşıyıcı seviyesinde 1.617 ürün yerleşimi kontrolü geçti. Küçük/büyük tepside üç çizim ve 1.016 üçgen; kaynak geometriler ortak kullanılır.
- `node tools/vacuum-visual-check.mjs --output=.devshots/service-tray/vacuum`: iki el-sap hizası, başlık-zemin teması ve tekrar alma/bırakma kaynak kararlılığı geçti.
- `node tools/interaction-check.mjs`: klavye/dokunma girişi ve kayıttan başlayan iki başlangıç görev akışı tamamlandı; sırasıyla 9/10 servis yapıldı.

Görseller ve ölçümler `.devshots/service-tray/` içindedir. Web derlemesi `http://127.0.0.1:5173/` adresinde güncellendi.
