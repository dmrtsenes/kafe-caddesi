# Kafe Caddesi — Yayın kararı ve profesyonelleşme planı
6 Eylül 2026 · Yerel kaynak sürümü 1.2.0 · İnceleme ve uygulama planı

## 1. Net karar

**Bugün geniş kitleye yayınlamayı önermiyorum.** Oynanabilir çekirdek, ciddi teknik iyileştirmeler ve kontrollü teste uygun bir ürün var. Buna karşılık para harcanan bazı yükseltmelerin gerçek etkisi yanlış; PC’de beğenilen karakter görünümü yayın görünümüyle aynı değil; uzun ilerleme ve güncel telefon performansı yeterince doğrulanmış değil.

**Rakip potansiyeli var; rakip seviyesinde olduğu kanıtlanmış değil.** Çay/kahve/tost, elle servis, temizliğin görünür sonucu ve büyüyen mahalle kafesi bir ürün kimliği oluşturabilir. Şu an bunu ticari başarı diye adlandıracak gerçek oyuncu verisi yok. Bir oyunun profesyonelliği özellik sayısından çok, verdiği sözü her durumda tutmasına bağlı.

| Soru | Bugünkü cevap |
|---|---|
| İç kullanım / yönlendirilmiş kalite testi yapılabilir mi? | Evet. Mevcut oyun bu inceleme için yeterince çalışır durumda. |
| Hataları bilerek gerçek yeni oyuncuyla gözlem yapılabilir mi? | Evet; mevcut sürüm “bitmiş ürün” diye sunulmadan. |
| Genel mağaza yayınına hazır mı? | Hayır; özellikle Q01, Q02 ve Q09 kapanmadan tavsiye etmiyorum. |
| Her yükseltme baştan sona uygun mu? | Hayır. Kasa hızı, Usta Eller ve kapasite sunumlarında somut açıklar var. |
| Animasyon ve tasarım bütünüyle profesyonel mi? | Henüz değil. Temas ve mekân düzeltmeleri iyi ilerlemiş; tek yayın karakteri, bütün durum matrisi ve bütün dekor görüşleri tamamlanmamış. |
| Clean It / My Mini Mart / My Perfect Hotel kusursuz mu? | Hayır. Resmî mağaza sayfalarında reklam, kayıt ve takılma şikâyetleri de var. Kalite hedefi onların güçlü hislerini yakalamak; hatalarını normal kabul etmek değil. |

Rakiplerin güncel resmî sayfaları, bu türün beklentisini açıkça gösteriyor: [My Mini Mart](https://play.google.com/store/apps/details?id=com.KisekiGames.smart&hl=en_US) üretim–ikmal–personel–büyüme; [My Perfect Hotel](https://play.google.com/store/apps/details?id=com.master.hotelmaster&hl=en_US) yeni mekânlar, hizmetler ve düzenleme; [Clean It](https://play.google.com/store/apps/details?id=com.lilyxgame.cleanit) görünür temizlik ve restoran genişletme. Seçili mağaza yorumları tüm oyuncu kitlesinin oranlarını göstermez. Bu incelemede rakiplerin bütün bölümleri oynanmadı; resmî ürün anlatımı ve galerileri karşılaştırma kaynağı olarak kullanıldı.

## 2. İncelemenin kapsamı ve kanıt sınırı

Bu tur oyun kuralları değiştirilmedi. Kaynak kod, son iki günün raporları, gerçek üretim web çıktısı, PC önizlemesi, doğal başlangıçlı otomatik oynanış ve yalıtılmış geç oyun sahneleri incelendi. Oyuncunun mevcut kaydına müdahale edilmedi.

- **151 mevcut birim testi geçti.** Üretim derlemesi ve varlık koruması geçti.
- Yeni kayıtla **90 simülasyon dakikası**, Türkçe, sabit rastgelelik tohumu 417 çalıştırıldı.
- Üretim ve PC önizlemesinde açılış, tam açılmış Köşe, maksimum seviyeli Sahil ve altı panel görüntülendi.
- Kasa ve el hızları, tuvalet kapasitesi, tezgâhtar raf hedefi, ilk temizlik hedefi ve devir davranışı için ayrı odak deneyleri yapıldı.
- Önceki 6 Eylül turundaki tepsi/paspas/oda görüşü ve süpürge kontrolleri incelendi; kapanmış işler yeniden eksik diye listelenmedi.
- Güncel fiziksel telefon kurulumu, uzun ses dinleme turu, gerçek insan oturumu ve canlı Play Console kabul durumu bu turda ölçülmedi.

**Doğal akış ile hazırlanmış sahne aynı kanıt değildir.** 90 dakikalık kayıt Sahil’e ulaşmadı. Sahil’in tüm alanları ve maksimum seviyeler test için doğrudan kuruldu; bu, geç oyun fiyatlarının doğal oynanışta uygun olduğunu kanıtlamaz. Sonsuz hedeflerin bütün turları doğal olarak test edilmiş sayılmaz.

**“Bütün eksikler” burada tüm ürün alanlarının kapsanması demektir; bilinmeyen bütün hataların bulunduğu garantisi değildir.** Aşağıdaki 74 maddenin bir bölümü yeniden üretilmiş hata, bir bölümü tasarım iyileştirmesi, bir bölümü yayın öncesi doğrulama işidir.

Ana kanıt: [inceleme verisi](../.devshots/yayin-audit-2026-09-06/inspection.json), [90 dakikalık sonuç](../.devshots/yayin-audit-2026-09-06/90-minute-flow/tr-result.json), [denetim aracı](../.devshots/yayin-audit-2026-09-06/inspect.mjs).

## 3. Yeni bulunan en önemli somut açıklar

### Kasa hızına para harcanıyor, sipariş hızlanmıyor — Q01

Kasa seviyesi 0 → 1 → 8 olduğunda gösterilen istasyon süresi 1,800 → 1,602 → 0,709 sn oluyor. Ancak gerçek `updateCounters` yolunda:

| Çalışma biçimi | Seviye 0 | Seviye 1 | Seviye 8 |
|---|---:|---:|---:|
| Oyuncu kasada | 0,725 sn | 0,725 sn | 0,725 sn |
| Kasiyer kasada, kasiyer seviyesi sabit | 2,408 sn | 2,408 sn | 2,408 sn |

Deneyde kuyruk girdisi ve siparişin bitişi yalıtıldı; gerçek sayaç yöntemi çalıştırıldı. Üretim ve müşteri bekleyişinden bağımsız olarak kasa hız seviyesinin bu sürelere hiç girmediği görülüyor. **Bu yayımlanmadan düzeltilmesi gereken bir satın alma kusuru.** Kaynak: [World.updateCounters](../src/sim/World.ts), [Station.cycleTime](../src/sim/Station.ts).

### Usta Eller vaat edilen hıza ulaşmıyor — Q02

`tryHandContact` varsayılan 0,42 sn animasyon döngüsünü kullanıyor. Ayrı `handTimer` henüz dolmamışken temas olayı tüketilebiliyor; bekleme dolduğunda aynı temas tekrar sunulmuyor.

| Seviye | Arayüzün hesapladığı hız | Temas + bekleme deneyinde hız |
|---|---:|---:|
| 0 | 1,92 işlem/sn | 1,17 işlem/sn |
| 1 | 2,13 işlem/sn | 1,17 işlem/sn |
| 3 | 2,60 işlem/sn | 2,30 işlem/sn |
| 5 | 3,19 işlem/sn | 2,30 işlem/sn |
| 10 | 5,28 işlem/sn | 2,30 işlem/sn |

Aynı sonuç 30 ve 60 Hz’de görüldü. Bu, sürekli iş bulunduğu varsayılan 30 saniyelik temas deneyi; tüm kafenin satış hızı değildir. Çağrıların gerçek alma/bırakma/servis yolu aynı iki koşulu kullanıyor. **Seviye satın almak yerine sayı satın alınmış gibi hissettiren temel sorun bu.** Çözüm, süreyi ve temas anını tek işlem saatinden sürmek. Kaynak: [Player.tryHandContact](../src/entities/Player.ts), [World etkileşimleri](../src/sim/World.ts).

### Diğer doğrulanmış tutarsızlıklar

| Bulgu | Mevcut durum | Doğru sonuç |
|---|---|---|
| İlk masayı tamamen temizle — Q03 | Yalnız bir bulaşık sayıldığında g03 bitiyor ve 70 ödül veriyor. | Bulaşık kovaya bırakılıp masa silindikten sonra bitmeli. |
| Tuvalet deposu — Q04 | L0 “0 depo”, gerçekte 6 peçete + 6 kâğıt. | Sarf türü ve gerçek kapasitesi gösterilmeli. |
| Tezgâhtar kapasitesi — Q05 | L10’da 8 taşıma kapasitesi; raf hedefi en fazla 2. | Satılan parti büyüklüğü ve iş kapsamı aynı olmalı. |
| Güler Yüz — Q06 | Metin bahşişi, uygulama bütün hesabı artırıyor. | Tek, doğru etki açıklaması. |
| Devir onayı — Q07 | Oyuncu yükseltmeleri siliniyor; listede söylenmiyor. Kozmetiklerin korunması da yazmıyor. | Kaybedilen ve korunan her önemli satın alma açıkça listelenmeli. |
| İngilizce — Q08 | Usta modu bitiş bildirimi doğrudan Türkçe. | Geçici olay metinleri de çevrilmeli. |
| Festival — Q49 | Haftanın ürün hedefi açık ürünleri dikkate almıyor. | Yeni kayıt için de yapılabilir hedef seçilmeli. |

Bu bulgular mevcut testler geçerken çıktı. Dolayısıyla bundan sonraki testlerin “fonksiyon çalıştı” yerine **“oyuncuya söylenen fayda gerçekleşti”** sorusunu ölçmesi gerekiyor.

## 4. Baştan sona ilerlemenin durumu

Bugünkü kapsam: **2 şube, 24 bölge, 8 satılabilir ürün, 4 personel rolü, 4 aktif oyuncu geliştirme hattı, 5 prestij geliştirmesi ve 36 ana hedef.** Devamında beş tipten üretilen sonsuz hedefler var. Özellik yokluğu ana sorun değil; bu sistemlerin beraber oluşturduğu ritim tamamlanmalı.

90 dakikalık otomatik akış:

| Ölçüm | Sonuç |
|---|---:|
| Servis edilen ürün | 493 |
| Öfkeli müşteri sayacı | 106 |
| Gerçek kazanç | 113.212 |
| Son cüzdan | 41.718 |
| Zemin temizliği | 69 |
| Yeniden kullanılabilir hâle gelen masa | 164 |
| Son hedef | Waffle bölümünü aç |
| İlk ek masa | 2:07 |
| İlk tezgâhtar | 3:08 |
| Kahve | 4:10 |
| Tost | 10:59 |
| İlk kasiyer | 16:18 |
| Servis/tuvalet | 28:08 |
| Salon odası | 56:26 |
| Son alan açılışı | 63:22 |
| Waffle, 90. dakikada | Açılmamış |
| En uzun faaliyet arası | 133 sn |
| Son hijyen | Yaklaşık 0 |

Öfkeli müşteri / servis ürünü farklı birimlerdir; bu tablodan müşteri kayıp yüzdesi hesaplanmaz. 63:22 sonrası alan açılmaması, o sürede hiç iş yapılmadığı anlamına da gelmez.

**Botun da açıkları var:** yerde leke görünce acil komi alıyor; mevcut komi zemini temizlemiyor. Serbest oyuncu yatırımında Usta Eller’i denemiyor. Bu nedenle tek koşuya bakıp tüm fiyatları düşürmek yanlış olur. Rehberci, yatırımcı ve temizlik ağırlıklı üç politika + insan gözlemi birlikte kullanılmalı.

Fiyat/ödül tablosu da aynı sürümde yeniden düzenlenmeli:

| Bölüm | Açılış bedeli | İlgili hedef ödülü |
|---|---:|---:|
| Servis | 9.000 | 12.000 |
| Salon odası | 12.500 | 20.000 |
| Waffle | 45.000 | 65.000 |
| Frappe | 115.000 | 140.000 |
| VIP | 330.000 | 100.000 |
| Sahil şubesi | 1.500.000 | 380.000 |
| Sahil dondurma | 12.600.000 | 5.300.000 |
| Sahil veranda | 47.400.000 | 20.000.000 |

Bir ödülün bedelden büyük olması tek başına yazılım hatası değildir. Fakat burada eski “ödül yaklaşık %40–45” notlarıyla gerçek oranlar ayrışıyor; bazı hedefler harcanan parayı fazlasıyla geri verirken Sahil’de büyük fiyat aralıkları bulunuyor. **Aynı ekonomi tablosunda fiyat, gerçek gelir, ödül ve sonraki satın almaya süre birlikte tasarlanmalı.**

### Seçtiğim ilerleme hedefi

Aşağıdaki süreler **yeni tasarım hedefidir**, ölçülmüş oyuncu sonucu veya sektör standardı değildir. Etkin oynanış süresidir; takvim günü değildir.

| Etkin süre | Hedeflenen deneyim |
|---|---|
| 0–60 sn | Hareket, sipariş, ürün, teslim ve para bir kez açıkça yaşanır. |
| 1–3 dk | Oyuncu ilk masa veya ürün açılımını kendi seçer. |
| 3–6 dk | İlk çalışan bir işi görünür biçimde rahatlatır. |
| 4–10 dk | Kahve, daha dolu sipariş ve ilk hissedilir oyuncu yükseltmesi. |
| 10–20 dk | Tost ve artan iş yüküne anlamlı ikinci karar. |
| 20–40 dk | Yeni salon/servis, bir küçük mekân dönüşümü; sadece daha çok aynı tur değil. |
| 35–70 dk | Waffle/frappe hattı, belirgin üretim ve servis farkı. |
| 60–110 dk | VIP ve oda kimliği; yeni hizmet tercihi. |
| 90–150 dk | Sahil’e geçişin erişilebilir olması. |
| Sonraki oturumlar | Sahil ara gelişimleri, yeni hizmet akışı, koleksiyon ve isteğe bağlı ilk devir. |

İlk 20 dakikada yaklaşık 2–5 dakikada bir anlamlı gelişim; orta oyunda büyük oda aralarında küçük görünür gelişimler hedefliyorum. Geç oyunda tek satın alma için uzun süre aynı koridorda gidip gelmek, yeni içerik yerine geçmemeli. Fiyatlar bu hedeflere ulaşan ölçülen gelire göre çıkarılacak; tablodaki süreyi tutturmak için sebepsiz bedava para eklenmeyecek.

## 5. Oyunun nasıl olması gerektiğine dair kararlar

### Oynanış ve personel

**Çevrimdışı, tek oyunculu, aktif idle kafe.** Hesap, çok oyunculu, sunucu zorunluluğu veya çevrimiçi etkinlik şartı eklenmeyecek. Oyuncu oyunda değilken para kazanılmaması ve dönüşte stok birikmesi yönündeki mevcut tercih korunacak.

Oyuncunun temel işi servis, gelişim seçimi, yüksek değerli sipariş ve tatmin edici temizlik olacak. Personel belirli işleri devralacak; bir çalışan almak her şeyi otomatik bitirmeyecek. Ancak çalışanı yapay olarak faydasız tutarak oyuncuyu sürekli aynı işe bağlamayacağız.

- **Tezgâhtar:** atanmış ürün hattını destekler. Seviye artışı yalnız hız sayısı değil, gerçek parti ve ikmal hedefini artırır. Rafı ne kadar dolduracağı açıkça görünür.
- **Kasiyer:** sipariş sırasını yönetir. Oyuncu nakdi toplar. Kasa ve kasiyer hızlarının aynı gerçek süreye nasıl katkı verdiği açık olur.
- **Komi:** belirlenmiş masaları düzenli açar. Zemini veya tuvaleti temizlemiyorsa bu açıkça yazılır; alım önerisi de o işi çözüyormuş gibi yapılmaz.
- **Barista:** seçili makineyi hissedilir biçimde hızlandırır; hangi makineye yarar sağladığı görünür. İlk katkı ve fiyat, gerçek üretim kazancına göre yeniden ayarlanır.

Oyuncu yükseltmeleri tek bir görünür davranışı iyileştirmeli. Başlangıç hız eğrisi 3,8 → 8,5; kapasite 3 → 15. Tepsi L4 ve araba L8 görsel eşikleri korunabilir. Usta Eller önce düzeltilmeli; sonra hızı ve en üst fiyatı yeniden dengelenmeli. Güler Yüz bütün satış değerine etki olarak açıkça anlatılmalı.

### Görünüm ve animasyon

Sanat hedefi: sıcak, okunur, yuvarlatılmış kafe; karakterlerde petrol–krem–bakır kimliği; sakin zemin; ürün ve iş noktalarında ölçülü vurgu. “Daha gerçekçi” olmak yerine ekrandaki işin daha çabuk anlaşılması hedeflenmeli.

**Yayın karakteri kararı önce gelmeli.** Dağıtım hakkı doğrulanmış tek karakter ailesi; yaklaşık 3–3,5 baş oranı, okunur el/ayak, tutarlı gölge ve materyal. Müşteri çeşitliliği aynı aile içinde beden/saç/kıyafet varyantlarıyla sağlanmalı. Beğenilen yerel karşılaştırma dosyaları otomatik olarak yayın varlığı sayılmayacak.

Animasyonda kabul yalnız elle sapın merkezinin çakışması değildir. Önceki yürüyüşte bir kolun geriye gitmesi bunun örneğiydi. **Temas, gövde açıklığı, ayak basma, yön, hız ve poza giriş/çıkış birlikte onaylanmalı.**

Zorunlu matris: boş durma/yürüme/koşma; 1/3/6/9/12/15 ürün; küçük/büyük tepsi/araba; kasa; bulaşık alma; kovaya bırakma; masa silme; paspas; süpürge; tamir; oturma/kalkma; dönüş; menü ve arka plan sonrası devam. 30 ve 60 FPS, düşük ve maksimum hız, iki şube ve dar girişler kapsanmalı.

Şemsiyeler, yüksek raflar ve diğer büyük dekor için oyuncu görüşü ayrı kontrol edilmeli. VIP/Salon girişlerinin düzelmiş olması, Sahil’de her dekorun uygun olduğu anlamına gelmiyor.

### Arayüz ve satın alma

- Ekranın ana odağı para, oyuncu ve o anki hedef.
- Satın alma kareleri korunacak: hedef adı/simge/kalan bedel; yaklaşınca kısa gerçek yarar; kısmi ödeme kaydı.
- Yükseltme kartı **mevcut → yeni gerçek değer** göstermeli. İki farklı “depo” veya anlamsız “0 depo” olmamalı.
- Küçük fiyatlarda tam sayı, büyüklerde tutarlı kısaltma. Türkçe sayı biçimi ve birimler tek sözlükten.
- Emoji yerine tutarlı, küçük ekranda seçilen özel simge ailesi.
- Dekor satın almadan önce denenebilmeli. Serbest mobilya sürükleme ilk yayın şartı değil; rota güvenliğini koruyan belirlenmiş dekor noktaları ve birkaç kaliteli varyant daha uygun.
- Ödüller kısa ve hissedilir; aynı anda birden fazla banner/teklif/modal oyuncuyu bölmemeli.

### Tekrar oynama ve rekabet

Bir sonraki oturuma dönme nedeni hazır stok, seçilmiş gelişim, yeni oda ve görünür koleksiyon ilerlemesi olmalı. Mevcut günlük/haftalık altyapı yeniden yazılmayacak; erişilebilirlik ve süre dengesi tamamlanacak. Festival yeni oyuncuya kapalı üründen görev vermemeli.

Sahil’de seçtiğim farklılık, **paket ağırlıklı servis ve parti/rota yönetimi**. Yeni ürünlerin yalnız fiyatı değişmiş kopyalar olması yeterli değil. İlk devir sonrasında aynı uzun öğretici ve aynı bekleyiş yeniden yaşanmamalı; kalıcı gelişimin faydası ilk 15 dakikada hissedilmeli.

Zorunlu reklam şu anda kapalı; bunu korumayı öneriyorum. Rakip mağaza yorumlarında akışı bölen reklam ve kayıp ilerleme şikâyetleri görülüyor. Kesintisiz kontrol, sağlam yerel kayıt ve açık yükseltme değeri bizim için somut rekabet alanı olabilir. [My Mini Mart resmî yorumları](https://play.google.com/store/apps/details?id=com.KisekiGames.smart&hl=en_US), [My Perfect Hotel resmî yorumları](https://play.google.com/store/apps/details?id=com.master.hotelmaster&hl=en_US).

## 6. Uygulama sırası ve tamamlanma kapıları

| Aşama | İş | Ön koşul | Tamamlandı sayılması |
|---|---|---|---|
| 0 | Sabit kaynak noktası, rapor ve varlık listesi | Yok | Tek değişiklik kümesi/sürüm/hash; hangi karakterin yayınlanacağı net. |
| 1 | Kasa, Usta Eller, g03, sarf kapasitesi, rol/metin tutarsızlıkları | 0 | Her ücretli seviye gerçek fayda testini geçer; para harcama vaadi doğru. |
| 2 | İlk 10 dakika ve personelin ilk faydası | 1 | Yeni oyuncuların ilk servis, ödeme ve işe alımı yardım almadan yapabildiği gözlem. |
| 3 | Ekonomi ve tam görev zinciri | 1–2 | Üç bot politikası + doğal insan kayıtları; Köşe→Sahil→ilk devir bütünüyle izlenmiş. |
| 4 | Tek yayın karakteri, tüm temaslar, simgeler, kamera ve zemin | 0; 2 ile birlikte ilerleyebilir | Animasyon matrisi ve aynı durumdaki gerçek oyun görüntüleri onaylı. |
| 5 | Geç oyun ve geri dönüş | 3–4 | Sahil farklı hissediliyor; devir anlamlı; festival erişilebilir; sonsuz hedef süreleri kontrol altında. |
| 6 | Güncel Android paketi, cihaz ve yaşam döngüsü | 1–5 | Düşük/orta cihazda uzun oturum, uçak modu, kayıt yükseltme, reklam dönüşü geçer. |
| 7 | Gerçek kapalı test ve mağaza hazırlığı | 6 | Güncel paketle gerçek kullanıcı geri bildirimi; ilgili Play koşulları; tutarlı mağaza/politika. |
| 8 | Küçük kitle yayını, ölçüm ve genişletme | 7 | Kritik hata yok; kullanım/geri dönüş kanıtı var; ticari genişleme gerçek sonuçlara dayanıyor. |

Bu sıra iş paketidir; henüz belirlenmemiş sanat üretimi ve gerçek cihaz/tester takvimine kesin gün uydurmaz. **P0 kapanmadan geniş yayın; P1 kalite turu tamamlanmadan “profesyonel seviye bitti” kararı verilmemeli.** P2 yeni içerikleri çekirdeğin önüne alınmamalı.

## 7. Yayın öncesi ölçütler

Aşağıdaki sayılar ürün için seçtiğim başlangıç kabul hedefleridir; başarı garantisi veya evrensel sektör sınırı değildir.

- **Ücretli gelişim:** fiyat bir kez kesilir; gerçek işlem hızı ve kapasite kartla ±%5 içinde eşleşir; her seviye fayda veya açık bir içerik açılımı getirir.
- **İlk oturum:** ilk satışta en az %80 yardım almadan 60 sn içinde başarı; ilk ödeme ve çalışan rolünü açıklayabilme.
- **Kayıt:** kapatma, arka plan ve sürüm yükseltme sonrası para/alan/personel/dekor/kısmi ödeme aynı; çift ödül yok.
- **Görüntü:** temel işte oyuncu veya hedef sürekli kapanmaz; belirgin el–ürün–masa/araç çakışması yok; grafik kademeleri aynı oyunu oynatır.
- **Performans:** temel hedef cihazlarda sürdürülebilir 30 FPS; üst sınıfta isteğe bağlı 60 FPS. Kare sıçramaları, pil ve ısınma birlikte değerlendirilir. Android’in kalite rehberi de oyunlar için genel taban olarak 30 FPS’i, uygun cihazlarda daha yüksek hız ile pil/ısı dengesini ele alıyor. [Android teknik kalite](https://developer.android.com/quality/technical).
- **Açılış:** ilk kontrol için orta cihazda ≤5 sn, düşükte ≤8 sn başlangıç hedefi. Bu PC denetiminde üretim iki koşuda yaklaşık 34–36 sn açıldı; sonra açılan DEV yaklaşık 2 sn idi. Test sırası/cache/derleme farkları ayrıştırılmadığından “özgün model telefonda 35 sn açılıyor” sonucu çıkarılamaz. Yine de ayrı açılış profili zorunlu.
- **İnsan testi:** iki küçük nitel tur; sonra aynı kalıcı kurulumlarla geri dönüş gözlemi. D1/D7 için günlerin tamamı ve rapor kapsamı bilinmeli. Küçük grubun yüzdesi ticari başarı ilanı için yeterli değil.
- **Mağaza:** test edilen yeni paketle görseller aynı; doğrulanmamış üretim erişimi veya politika adresi tamamlandı sayılmaz.

Kaynakta targetSdk **36**, güncel Google Play yeni uygulama/güncelleme şartıyla uyumlu. Uygulamanın hesabına tabi olması durumunda yeni kişisel geliştirici hesabı için **en az 12 katılımcının 14 gün kesintisiz katıldığı kapalı test** ve üretim erişimi başvurusu gerekir; bu hesabın bugünkü durumu burada doğrulanmadı. [Hedef API şartı](https://support.google.com/googleplay/android-developer/answer/11926878), [kapalı test şartları](https://support.google.com/googleplay/android-developer/answer/14151465).

Test reklam kimlikleri ticari yayın ayarı olarak bırakılmamalı; Google yayın öncesi kendi birim kimliklerinin kullanılmasını istiyor. Reklam testi, gerçek cihazın test cihazı olarak tanımlanmasıyla yapılmalı. [AdMob test reklamları](https://developers.google.com/admob/android/test-ads). Veri beyanı ise kullanılan SDK sürümüne göre yeniden kontrol edilmeli: Google’ın güncel açıklaması IP adresinin genel konum tahmininde kullanılabileceğini de belirtiyor; eski rapordaki “yaklaşık konum gerekmez” varsayımı otomatik taşınmamalı. [AdMob veri açıklaması](https://developers.google.com/admob/android/privacy/play-data-disclosure).

## 8. Korunacak tamamlanmış işler

Bunları yeniden sıfırdan yapmak yerine kalan boşlukları kapatacağız:

- Rol bazlı küçük kareler ve kaydedilen kısmi personel ödemeleri.
- Kare üzerinden geçişte para kesilmemesi ve aynı yerde ikinci personelin yanlışlıkla alınmaması.
- Sade alan açılımı, kısa kurulum ve kilitli mobilyanın görünmez engel oluşturmaması.
- Paspas/süpürge başlığının gerçek temizleme noktasıyla eşleşmesi.
- Tepsi, araba ve iki el tutuşundaki son düzeltmeler.
- Salon/VIP girişlerini örten yüksek parçaların kaldırılması ve oda kamera desteği.
- Kayıt yedeği, yerel rapor, TR/EN temeli, otomatik kalite ve menüde çizim durdurma.
- Üretime yerel karşılaştırma varlığı girmesini engelleyen yayın denetimi.

Son tamamlanan turlar: [tutuş ve mekân](TUTUS-VE-MEKAN-2026-09-06.md), [oyuncu testi ve sade açılım](OYUNCU-TESTI-VE-ACILIM-2026-09-05.md).

## 9. Ayrıntılı iş listesi

**P0:** geniş yayını durduran hata veya zorunlu kanıt. **P1:** ilk profesyonel sürümün kalite işi. **P2:** çekirdek tamamlandıktan sonra değer katan kapsam.

**Doğrulandı** kod/odak deneyinde görülen mevcut durumdur. **Tasarım kararı** önerilen iyileştirmedir. **Doğrulanacak** mevcut sistemin mutlaka bozuk olduğu anlamına gelmez; kabul kanıtı eksiktir.

Filtrelenebilir aynı liste: [74 maddelik CSV](YAYIN-IS-LISTESI-2026-09-06.csv).

### Çalışan yükseltmeler

**Q01 · Kasa hızının etkisizliği — P0 / Doğrulandı**

Mevcut: Seviye 0/1/8: gösterilen süre 1,8/1,602/0,709 sn; gerçek süre elle 0,725, kasiyerle 2,408 sn olarak sabit.

Karar: Sipariş süresini kasa seviyesi, kasiyer seviyesi ve prestijden tek fonksiyonla üret; arayüz aynı değeri kullansın.

Bitiş ölçütü: Elle/kasiyerle tüm 9 kasa seviyesi ve prestij kombinasyonlarında gerçek işlem sayısı vaatle ±%5 eşleşsin.

Kaynak: src/sim/World.ts updateCounters; src/sim/Station.ts cycleTime.

**Q02 · Usta Eller’in animasyon tavanı — P0 / Doğrulandı**

Mevcut: 0,42 sn temas döngüsü ve ayrı bekleme saati çakışıyor. 30/60 Hz deneyinde L3/L5/L10 yaklaşık 2,3 işlem/sn; L10 metni 5,3.

Karar: Tek işlem saati kullan; temas anını bu saatin evresi yap. Soğuma sürerken temas hakkı kaybolmasın.

Bitiş ölçütü: L0–L10, 30/45/60 Hz, alma/bırakma/servis için 30 sn gerçek aktarım; her satın alınan kademe fayda versin.

Kaynak: src/entities/Player.ts tryHandContact; src/sim/World.ts.

**Q03 · İlk tam temizlik hedefi erken bitiyor — P1 / Doğrulandı**

Mevcut: g03, table:cleaned olmadan yalnız cleaned=1 ile g04’e geçip 70 veriyor.

Karar: Bulaşık toplama ve tamamlanmış masa temizliğini ayrı sayaç yap; g03 tamamlanmış masa olayını kullansın.

Bitiş ölçütü: Al→kovaya bırak→sil: yalnız son aşamada hedef ve ödül; yeniden yüklemede çift sayım yok.

Kaynak: src/sim/Goals.ts rawValue; src/sim/World.ts stats.cleaned.

**Q04 · Tuvalet kapasitesi yanlış anlatılıyor — P1 / Doğrulandı**

Mevcut: L0: 0 depo yazarken 6 peçete+6 kâğıt; L1: 2 depo yazarken 7+7 sarf.

Karar: İstasyon türüne özgü kapasite sun: her sarfın mevcut ve sonraki tavanı ayrı.

Bitiş ölçütü: Tüm tuvalet seviyelerinde kart ve gerçek supplyCap birebir eşleşsin.

Kaynak: src/core/Game.ts getStations; src/sim/Station.ts supplyCap.

**Q05 · Tezgâhtar kapasite vaadi ve iş sınırı — P1 / Doğrulandı**

Mevcut: L10 çalışan 8 taşıma kapasitesi gösteriyor; hedef raf miktarı her seviyede en fazla 2.

Karar: İkmal hedefini seviye/atanan iş kapsamıyla büyüt; kartta gerçek parti büyüklüğünü göster.

Bitiş ölçütü: L0/3/6/10’da teslim edilen parti ve rafın boş kalma süresi ölçülsün; iş kapsamı açık olsun.

Kaynak: src/data/staff.ts; src/sim/World.ts staffShelfTarget.

**Q06 · Güler Yüz açıklaması etkiden dar — P1 / Doğrulandı**

Mevcut: Açıklama bahşişi söylüyor, değer satırı ve saleMultiplier bütün hesaba çarpan uyguluyor.

Karar: Gerçek tasarım kararını sabitle: tüm satış değerine etki. Açıklama, hesap ayrıştırması ve çeviri aynı şeyi söylesin.

Bitiş ölçütü: Sabit ürün/sabit müşteri ile seviye öncesi/sonrası hesap dökümü doğrulansın.

Kaynak: src/data/upgrades.ts charm; src/sim/GameState.ts saleMultiplier.

**Q07 · Devirde giden/kalan listesi eksik — P1 / Doğrulandı**

Mevcut: Oyuncu seviyeleri sıfırlanıyor ama onayda yazmıyor; korunan kozmetikler de kalır listesinde yok.

Karar: Oyuncu geliştirmelerini gidenlere, satın alınmış dekorları kalanlara ekle; önce/sonra özeti göster.

Bitiş ölçütü: Maksimum oyuncu seviyesi ve satın alınmış görünümle devir/iptal/yükleme; ekrandaki her madde durumla aynı.

Kaynak: src/ui/Panels.ts prestigeBlock; src/sim/GameState.ts prestigeReset.

**Q08 · İngilizcede kalan çalışma sonu metni — P1 / Doğrulandı**

Mevcut: Game.ts içinde Usta modu bitti. doğrudan Türkçe gönderiliyor.

Karar: Bütün canlı durum metinlerini dil sistemine al; sadece panel açılışını değil ödül bitişlerini tara.

Bitiş ölçütü: EN: bütün buff bitişleri, olaylar, maksimum seviye, boş liste, hata ve devir ekranlarında Türkçe kalmasın.

Kaynak: src/core/Game.ts USTA bitişi.

### Ürün ve yayın kimliği

**Q09 · PC ve yayın karakteri farklı — P0 / Doğrulandı**

Mevcut: DEV varsayılanı yerel karşılaştırma modelleri; üretim fincan-original.

Karar: Dağıtılabilir tek karakter ailesini bitir; varsayılan PC önizlemesi ve yayın aynı aileyi kullansın.

Bitiş ölçütü: Aynı kayıt/aynı kamera ile PC, üretim ve Android’de aynı onaylı siluet ve animasyonlar.

Kaynak: src/chars/index.ts; inspection.json.

**Q10 · Denge metinleri ve kod ayrışmış — P1 / Doğrulandı**

Mevcut: Eski hız/fiyat/rol yorumları bugünkü sayılarla uyuşmuyor; eski geniş komi/barista yolları da kodda duruyor.

Karar: Gerçek kullanılan fonksiyonları tekleştir; tasarım kararlarını sürümle; ölü yolları ölçüm sonrası kaldır.

Bitiş ölçütü: Fiyat/etki tablosu koddan üretilsin; kullanılmayan eski davranışlar güncel karar diye okunmasın.

Kaynak: src/data/upgrades.ts; src/data/goals.ts; src/sim/World.ts.

### İlk oturum

**Q11 · İlk kadrajın işi anlatması — P1 / Tasarım kararı**

Mevcut: İlk ekranın önemli bölümü boş zemin; kasa ve ilk müşteri yeterince belirgin değil.

Karar: Açılışı bir kasa, bir ürün, bir masa ve oyuncuyu birlikte gösterecek kadrajla kur.

Bitiş ölçütü: Yeni oyuncuların en az %80’i ilk işi sözlü yardım olmadan 10 sn içinde tarif etsin.

Kaynak: production-first.png; preview-first.png.

**Q12 · Yedi adımın bilgi yükü — P1 / Tasarım kararı**

Mevcut: Kontrol metni uzun; bilgisayar tuşları telefon bağlamında da metne giriyor.

Karar: Cihaza uygun kısa hareket ipucu; her yeni fiil ilk kullanıldığı anda tek cümle.

Bitiş ölçütü: Telefon sürümünde masaüstü tuş metni yok; oyuncu bir seferde bir yeni fiil öğreniyor.

Kaynak: src/sim/Tutorial.ts.

**Q13 · İlk satış ve ilk satın alma zamanı — P1 / Doğrulanacak**

Mevcut: Bot ilk satışı hızlı yapıyor; yeni insan sonucu yok.

Karar: 10–20 yeni oyuncuda izinsiz yönlendirme yapmadan ilk oturumu gözle.

Bitiş ölçütü: İlk satış medyanı ≤45 sn, katılımcıların en az %80’inde ≤60 sn; ilk anlamlı satın alma 1–3 dk hedefi.

Kaynak: 90-minute-flow; OYUNCU-GOZLEM-SABLONU.csv.

**Q14 · Tek aktif hedef ve öneri — P1 / Tasarım kararı**

Mevcut: Görev, rehber ve ihtiyaç göstergeleri farklı işler önerebiliyor; g03 bunun somut örneği.

Karar: Takip edilen hedef yapılabilir olduğunda öncelikli olsun; diğer işleri yalnız acil durum olarak göster.

Bitiş ölçütü: Her hedefte bir oyuncu neden o noktaya gittiğini açıklayabilsin; tamamlanan hedef oku kalmasın.

Kaynak: src/sim/World.ts rehber; src/ui/HUD.ts.

**Q15 · Para karelerinin anlaşılması — P1 / Doğrulanacak**

Mevcut: Kare, durma eşiği ve kısmi kayıt çalışıyor; insanın bunu anladığı kanıtlanmadı.

Karar: İlk ödeme için tek kısa bağlamsal örnek; para bittiğinde birikimin korunduğunu göster.

Bitiş ölçütü: 10 kişiden en az 8’i yanlış açıklama yapmadan ödemeyi yarıda bırakıp tamamlayabilsin.

Kaynak: tools/staff-hire-check.mjs; tools/usability-flow-check.mjs.

**Q16 · İşe almanın anında hissedilmesi — P1 / Tasarım kararı**

Mevcut: Bugünkü roller sıkışma desteği ağırlıklı; yeni çalışan bazen dinleniyor gibi görünebilir.

Karar: İlk çalışan belirli bir işe yürüsün; kısa iş tamamlaması ve görev etiketiyle faydasını göstersin.

Bitiş ölçütü: İşe alımdan sonraki 10–20 sn’de uygun iş varsa bir iş tamamlasın; iş yoksa açık neden gösterilsin.

Kaynak: src/entities/Staff.ts; src/world/StaffStatusView.ts.

### Ekonomi ve personel

**Q17 · Uzun akışta seyrek büyüme — P1 / Doğrulandı**

Mevcut: 90 dk botta son alan 63:22; waffle 90’da kapalı; birikim 41.718.

Karar: Tek bot yerine rehberci, yatırımcı ve temizlik ağırlıklı politikalarla akışı ölç; fiyatları gelir ve satın alma aralığına göre ayarla.

Bitiş ölçütü: Üç politika ve en az 3 tohumda ilk 90 dk; son açık uçlu satın alma boşluğu da raporlansın.

Kaynak: 90-minute-flow/tr-result.json.

**Q18 · Ödül/fiyat merdiveni tutarsız — P1 / Doğrulandı**

Mevcut: Servis 9k/12k ödül, salon 12,5k/20k, waffle 45k/65k, frappe 115k/140k.

Karar: Fiyat ve hedef ödüllerini beraber ayarla; olağan alan ödülleri için seçilen %20–40 bandı, özel istisnalar açıkça tanımlansın.

Bitiş ölçütü: Zincir tekrar eden bedava para üretmesin; ödül öncesi/sonrası satın alma mesafesi ölçülsün.

Kaynak: src/data/layouts.ts; src/data/goals.ts; inspection.json rewards.

**Q19 · Sahil fiyat uçurumu — P1 / Doğrulanacak**

Mevcut: Şube 1,5M; dondurma 12,6M; veranda 47,4M. Bu banda doğal güncel oynanış ulaşmadı.

Karar: Gelir artışı ile fiyat artışını birlikte test et; her büyük bölümü küçük görünür ara gelişimlere böl.

Bitiş ölçütü: Sahil’e doğal geçiş ve iki sonraki alan reklamsız tamamlanarak aktif dakika ve bekleme kaydedilsin.

Kaynak: src/data/layouts.ts p1/p2/p3.

**Q20 · Komi iş kapsamı — P1 / Tasarım kararı**

Mevcut: Komi yalnız tıkanırken masa açıyor; yerdeki toz komiyi tetikleyen bot alımlarını yanıltıyor.

Karar: Komiyi atanmış masa bölgesinde düzenli yardımcı yap; zemin/tuvalet kapsamını açık tut.

Bitiş ölçütü: Düşük/yüksek seviyede kirli masanın bekleme süresi azalsın; boş yere çalışan alımı önerilmesin.

Kaynak: src/sim/World.ts updateBusserAssist; tools/balance-bot.js.

**Q21 · Barista ilk faydası ve fiyatı — P1 / Tasarım kararı**

Mevcut: İlk barista 42k karşılığında yalnız ×1,08 üretim hızını, tek makinede sağlıyor.

Karar: İlk katkıyı görünür üretim farkı verecek banda getir; atanacağı makineyi göster.

Bitiş ölçütü: Aynı 2 dk iş yükünde kapasite kısıtı yokken net üretim artışı ve oyuncu zaman kazancı görünür olsun.

Kaynak: src/data/staff.ts baristaBoost; assignFixedRoles.

**Q22 · Sandalyenin gerçek değeri — P1 / Doğrulanacak**

Mevcut: Masa başına sınır düzelmiş olsa da her kademe her aşamada gelir sağlamayabilir.

Karar: Müşteri talebi ve doluluk yokken sandalye yerine etkili gelişimi öner; boş koltuğa sahte gelir vaadi verme.

Bitiş ölçütü: Az/çok müşteri senaryolarında doluluk, bekleme ve gelir farkı ölçülsün.

Kaynak: src/sim/Station.ts capMax; src/sim/World.ts müşteri tavanı.

**Q23 · Uzun oturum hijyeni — P1 / Doğrulandı**

Mevcut: 90 dk senaryosu 69 zemin temizliğine rağmen hijyeni yaklaşık sıfırda bitirdi.

Karar: Trafik kiri, leke, tuvalet ve masa yükünü ayrı ölç; düşüşün nedenini oyuncuya göster, toparlanmayı mümkün kıl.

Bitiş ölçütü: Yeni normal oyuncu düşük hijyenden 1–2 dk amaçlı temizlikle toparlanabilsin; sayı ile görünür kir uyuşsun.

Kaynak: 90-minute-flow/tr-result.json; src/sim/World.ts hygiene.

**Q24 · Yükseltme önerisinin getirisi — P1 / Tasarım kararı**

Mevcut: Ucuz olanı seçmek, en faydalıyı seçmekle aynı değil; mevcut bot bunun ayrımını yapmıyor.

Karar: Arayüzde mevcut darboğaza uygun tek öneri; maliyet, eski/yeni değer ve somut yarar.

Bitiş ölçütü: Önerilen yükseltme sabit yük deneyinde ölçülebilir fayda versin; depo doluysa sadece hız önermesin.

Kaynak: src/core/Game.ts getPlayerUpgrades/getStations.

**Q25 · Personel kurtarma hareketleri — P1 / Doğrulanacak**

Mevcut: Bekçi sabit çalışanı 6 sn takılmada çalışma noktasına taşıyabiliyor.

Karar: Normal yol sorununun sebebini düzelt; kurtarmayı nadir güvence olarak tut ve yerel sayaçla ölç.

Bitiş ölçütü: Kalabalık 30 dk testte sürekli sıçrayan çalışan yok; her kurtarma sayısı ve noktası kaydedilsin.

Kaynak: src/sim/World.ts watchdogStaff.

### Animasyon ve temas

**Q26 · Tam animasyon matrisi — P1 / Doğrulanacak**

Mevcut: Son testler birçok tutuşu kapsıyor; bütün seviye, ürün, oda ve geçişlerin tamamı onaylı değil.

Karar: Tek yayın riginde boş/taşıma/tepsi/araba/kasa/masa/paspas/süpürge/tamir/koşu/oturma matrisini tamamla.

Bitiş ölçütü: 0/orta/maks seviye × dur/yürü/dön/iş/bırak; önden/yandan/oyun kamerası kaydı onaylansın.

Kaynak: tools/presentation-check.mjs; src/chars.

**Q27 · Ayak basma ve hız uyumu — P1 / Tasarım kararı**

Mevcut: Tepki iyileşmiş; bütün hız kademelerindeki ayak kayması sahnelerde ölçülmedi.

Karar: Adım sıklığı ve mesafeyi gerçek hızdan sür; dönüşte gövdeyi yumuşat, ayak tabanı zemine otursun.

Bitiş ölçütü: 3,8–8,5 hız ve hız ödülü dahil yürüyüş videolarında kayma/tepinme/geri savrulma yok.

Kaynak: src/entities/Player.ts; src/chars/CharacterAnimator.ts.

**Q28 · Taşınan 15 ürünün anlaşılması — P1 / Doğrulanacak**

Mevcut: Kapasite 15’e çıkar; görünürde son 3 ürün ve adet rozeti tutuluyor.

Karar: Ürün türü+adet özeti ekle; büyük tepsi/araba görseli taşıma kademesini açıkça anlatsın.

Bitiş ölçütü: 1/3/6/9/12/15 karma ürünle oyuncu elindekini okuyabilsin; gövde/araç çakışması olmasın.

Kaynak: src/entities/CarryStack.ts rebuild/setPresentationStage.

**Q29 · Yüksek hızda dar geçit ve alet — P1 / Doğrulanacak**

Mevcut: Başlık–el hizası düzeldi; her dar geçit ve eşya kenarı için yeterli hareket kanıtı yok.

Karar: Süpürge/paspas/araba ile rota matrisi; gerekli noktada görsel çekilme veya açıklık ayarı.

Bitiş ölçütü: Kapı, VIP basamağı, kasa köşesi, masa arası: tıkanma, havada başlık ve kalıcı iç içe geçme yok.

Kaynak: tools/vacuum-visual-check.mjs; src/world/FloorMop.ts.

**Q30 · İş sonucu ve temas anı — P1 / Tasarım kararı**

Mevcut: Temas sistemi var; Usta Eller hatası aynı saatten sürülmediğini gösteriyor.

Karar: Ürün aktarımı, para, kir azalması ve ses aynı temas işaretinden çıksın.

Bitiş ölçütü: Yavaş kayıtla hiçbir ürün/ödül görünür temastan önce veya iki kez oluşmasın.

Kaynak: src/entities/Player.ts tryHandContact.

**Q31 · Müşteri oturma ve tabak eşleşmesi — P1 / Doğrulanacak**

Mevcut: Koltuk sınırları ve servis noktaları kontrol ediliyor; yoğunlukta görsel oturuş turu eksik.

Karar: 2/3/4 koltuklu her masa tipi, farklı müşteri gövdesi ve karma siparişleri kontrol et.

Bitiş ölçütü: Ayak/sandalye/masa iç içe geçmesin; tabak doğru müşteriye gitsin; kalkış rotası açık olsun.

Kaynak: src/entities/Customer.ts; src/data/seating.ts.

**Q32 · Üretim ve barista hareketi — P1 / Doğrulanacak**

Mevcut: Çok ürün aynı genel makine işi katmanını kullanıyor.

Karar: Çay, kahve, tost ve blender için kısa ayırt edici temas ve üretim bitişi düzenle.

Bitiş ölçütü: Animasyon makinenin gerçek parçalarına yönelsin; boş depoda olmayan ürünü işliyor gibi görünmesin.

Kaynak: src/chars; src/world/StationView.ts.

**Q33 · Kesinti sonrası normal poza dönüş — P1 / Doğrulanacak**

Mevcut: Süpürge bırakma onarıldı; tüm işlerden menü/arka plan/şube/devir dönüşleri birlikte ölçülmedi.

Karar: Bütün alet ve taşıma katmanlarının giriş/çıkış sözleşmesini aynı şekilde doğrula.

Bitiş ölçütü: Bırakma sonrası kol takılması, çift alet, görünmez ürün veya eski şubeye bağlı mesh yok.

Kaynak: src/entities/Player.ts; src/chars/PushArms.ts.

### Görsel tasarım

**Q34 · Tek sanat standardı — P1 / Tasarım kararı**

Mevcut: Paket mobilya, özgün karakter, hazır süpürge ve emoji arayüz farklı diller taşıyor.

Karar: Oran, kenar yuvarlaklığı, gölge, materyal ve vurgu paletini tek stil sayfasında sabitle.

Bitiş ölçütü: Aynı ışık altında oyuncu/çalışan/müşteri/mobilya/alet bir oyun ailesi gibi görünsün.

Kaynak: production-first.png; public/packs.

**Q35 · Kamera ve oyun ölçeği — P1 / Tasarım kararı**

Mevcut: Telefonda karakter küçük, boş zemin payı yüksek; aynı kadrajda birçok iş küçük kalabiliyor.

Karar: İlk oturum ve oda içi için kontrollü yaklaşma; dar kadrajda oyuncu ve hedefi birlikte tut.

Bitiş ölçütü: 360×800,390×844,430×932 ve yatay görünümde hedef hiçbir temel rotada sürekli kadraj dışında kalmasın.

Kaynak: src/world/Scene3D.ts; ilk ekran görüntüleri.

**Q36 · Sahil şemsiyesi görüşü kapatıyor — P1 / Görsel gözlem**

Mevcut: Kurulu sahil görüntüsünde büyük şemsiye oyuncunun gövdesini örtebiliyor.

Karar: Oyuncu ile kamera arasındaki büyük dekoru soldur veya yerini değiştir; sadece VIP mimarisini kontrol etmekle yetinme.

Bitiş ölçütü: Sahil masalarının çevresindeki tüm yaklaşmalarda oyuncu başı/gövdesi ve iş noktası görünür.

Kaynak: production-staged-sahil-max.png.

**Q37 · Zemin temiz/kirli ayrımı — P1 / Tasarım kararı**

Mevcut: Parke ve toz sadeleşti; bütün kozmetik zeminlerde aynı okunurluk henüz gösterilmedi.

Karar: Kir yoğunluğunu görünür duruma bağla; leke kenarı, kırıntı ve parlama tek temizlenme dili kullansın.

Bitiş ölçütü: Her zemin seçeneğinde temiz/kirli/yarım temiz durum renk dışındaki biçimle de ayırt edilsin.

Kaynak: src/world/SpillView.ts; src/world/GrimeView.ts; src/data/cosmetics.ts.

**Q38 · Makine ve ürün siluetleri — P1 / Tasarım kararı**

Mevcut: Açık renk hacimler birbirine yaklaşıyor; yeni ürünün farkı bazen yalnız simge.

Karar: Her ürün hattına tek ayırt edici biçim ve ölçülü renk; ücretli açılımda gerçek değişim göster.

Bitiş ölçütü: Etiketler kapatıldığında çay/kahve/tost/tatlı hattı küçük ekranda ayırt edilebilsin.

Kaynak: src/world/StationView.ts; src/world/ProductMesh.ts.

**Q39 · Satın alma ve başarı sunumu — P1 / Tasarım kararı**

Mevcut: Kısa kurulum ve kare dolumu var; son kullanımda görsel ağırlık standardı net değil.

Karar: Karede hedef+bedel, yaklaşınca yarar; ödeme sesi hızlanır, 0,25–0,5 sn kurulum ve kısa tek onay.

Bitiş ölçütü: Açılım hareketi yolu kapatmasın; büyük modal gelmesin; zayıf cihazda kare sıçraması oluşturmasın.

Kaynak: src/world/ZonePurchasePad.ts; src/world/StaffHirePad.ts.

**Q40 · Dekorasyonun sahiplik hissi — P2 / Tasarım kararı**

Mevcut: Mevcut sistem duvar/zemin/tabla/üniforma rengini değiştiriyor; serbest düzenleme yok.

Karar: Önce satın almadan görünüm denemesi; sonra belirlenmiş dekor noktalarında 2–3 mobilya varyantı.

Bitiş ölçütü: Oyuncu parasını harcamadan sonucu görsün; iptal ücreti yok; seçilen düzen yolları bozamaz.

Kaynak: src/data/cosmetics.ts; src/core/Game.ts buyCosmetic.

### Arayüz ve kullanım

**Q41 · Simge ailesi — P1 / Tasarım kararı**

Mevcut: Çok sayıda sistem emojisi platforma göre farklı çiziliyor.

Karar: Özel ve tutarlı 24/32 px simge ailesi kullan; rol/ürün/kasa/temizlikte aynı çizgi kalınlığı.

Bitiş ölçütü: Android ve Windows karşılaştırmasında simge anlamı/yerleşimi değişmesin.

Kaynak: src/ui/HUD.ts; src/ui/Panels.ts.

**Q42 · Üst bar bilgi yoğunluğu — P1 / Tasarım kararı**

Mevcut: Para, hedef, hijyen, tempo, doluluk ve olaylar aynı dikkat alanını paylaşıyor.

Karar: Öncelik para+aktif hedef; hijyen/tempo gerektiğinde genişlesin; acil olmayan göstergeyi küçült.

Bitiş ölçütü: Öğretici bitiminde birden çok yeni gösterge aynı karede açıklamasız açılmasın.

Kaynak: src/ui/HUD.ts.

**Q43 · Dokunma ve yazı boyutu — P1 / Doğrulanacak**

Mevcut: Temel düğmelerde 44 px altyapısı var; bütün açılır durum ve cihazlar ölçülmedi.

Karar: Gerçek telefonlarda dokunma hedefi, uzun metin ve güvenli alan turu yap.

Bitiş ölçütü: Ana eylemler en az 44 CSS px; yatay taşma yok; kritik bilgi yalnız küçücük metne dayanmasın.

Kaynak: src/ui/ui.css; src/input/InputManager.ts.

**Q44 · Sayı ve kapasite sözlüğü — P1 / Tasarım kararı**

Mevcut: Hızda noktalı ondalık, fiyatlarda B/M, taşıma için slot/tepsi karışıyor.

Karar: Bir sözlük seç: adet, sandalye, sarf, sn/iş; düşük fiyatı tam sayı, büyüğünü açıklanabilir kısaltma.

Bitiş ölçütü: TR/EN tutarlı sayı biçimi; UI hiçbir yerde boş veya yanlış ölçü birimi göstermesin.

Kaynak: src/core/MathUtils.ts; src/core/I18n.ts; src/core/Game.ts.

**Q45 · Satın almadan önce yarar — P1 / Tasarım kararı**

Mevcut: Oyuncu kartı sonraki değer veriyor, personel çoğunlukla yalnız mevcut etkiyi gösteriyor.

Karar: Bütün ücretli kartlarda eski→yeni gerçek etki, görev kapsamı ve fiyat birlikte görünsün.

Bitiş ölçütü: Hız, kapasite ve rol seviyelerinin her biri için kullanıcı ne aldığını doğru açıklayabilsin.

Kaynak: src/core/Game.ts getStaff/getStations; src/ui/Panels.ts.

**Q46 · Hata ve boş durumlar — P1 / Doğrulanacak**

Mevcut: Kayıt, reklam ve kilit durumları var; bütün kesişimler gözlenmedi.

Karar: Para yetmez, depo dolu, eller dolu, yanlış taraf, yol kapalı, reklam yok ve kayıt başarısız durumlarını açıklaştır.

Bitiş ölçütü: Her durumda tek uygulanabilir sonraki adım; tekrar eden hata sesi/mesaj döngüsü yok.

Kaynak: src/ui; src/core/SaveManager.ts.

**Q47 · Olay ve teklif önceliği — P1 / Tasarım kararı**

Mevcut: Beş kaos olayı ve çok sayıda reklam teklifi var; aynı dönemde üst üste gelebilir.

Karar: Tek ön plandaki olay; düşük öncelikli bilgileri sırala; oyuncu işi bitirmeden odağı tekrar tekrar alma.

Bitiş ölçütü: İlk 10 dk ve yoğun saatte üst üste modal/teklif yok; üç eşzamanlı olay stresi kontrol edilsin.

Kaynak: src/sim/Events.ts; src/core/Game.ts maybeOfferAd.

**Q48 · Ses, titreşim ve hareket erişilebilirliği — P1 / Doğrulanacak**

Mevcut: Ayrı ses/müzik/titreşim ve az hareket seçenekleri mevcut.

Karar: Mevcut ayarları tüm yeni efektlere uygula; renk dışı durum simgesi ve sessiz kullanım testi ekle.

Bitiş ölçütü: Sessiz oyunda görev anlaşılır; az hareket modunda gereksiz sarsıntı/çakma yok; tercih yeniden açılışta kalır.

Kaynak: src/core/Settings.ts; src/audio/AudioManager.ts.

### Geri dönüş ve geç oyun

**Q49 · Festival erişilebilirliği — P1 / Doğrulandı**

Mevcut: Festival ürün seçimi tarihe bağlı; getFestival açılmış ürünü filtrelemiyor.

Karar: Tema ortak kalabilir; oyuncunun hedefi açık ürün veya genel servis/temizlik üzerinden seçilsin.

Bitiş ölçütü: Yeni kayıtta bütün haftalarda yapılabilir festival görevi; kaydı yenilemek görevi/ödülü çoğaltmasın.

Kaynak: src/sim/Festival.ts; src/core/Game.ts getFestival.

**Q50 · Günlük/haftalık ödül dengesi — P1 / Doğrulanacak**

Mevcut: Uygun günlük seçim düzeldi; farklı oturum alışkanlıklarındaki süre ve ödül miktarı ölçülmedi.

Karar: 5/15/30 dk oyuncular için kısa, orta ve haftalık hedef kapsamını ayarla.

Bitiş ölçütü: Kısa oturum oyuncusuna erişilemez görev yığını yok; ödül ekonomiyi kendi kendine finanse etmiyor.

Kaynak: src/sim/Daily.ts; src/sim/Festival.ts.

**Q51 · Çevrimdışı dönüşün vaadi — P1 / Tasarım kararı**

Mevcut: Oyun kapalıyken para yok; stok dolar. Bu önceki tercihle uyumlu.

Karar: Para biriktirme ekleme; hazır stok ve bir sonraki geliştirme üzerinden kısa dönüş özeti ver.

Bitiş ölçütü: 45 sn/2 saat/1 gün/7 gün dönüşünde stok sınırları ve kayıt tutarlı; gereksiz modal yok.

Kaynak: src/sim/Offline.ts.

**Q52 · Sahil’in yeni oynanış farkı — P1 / Tasarım kararı**

Mevcut: İkinci şube ve ürünler var; temel işi daha pahalı tekrar etmeye dönüşme riski yüksek.

Karar: Sahil’e tek anlaşılır farklı hizmet akışı seç: paket ağırlığı ve farklı rota/parti yönetimi.

Bitiş ölçütü: Yeni şubede ilk 10 dk içinde oyuncu bir gerçek yeni karar tarif edebilsin.

Kaynak: src/data/layouts.ts sahil; src/data/items.ts.

**Q53 · Prestij zamanı ve faydası — P1 / Tasarım kararı**

Mevcut: 12M gerçek kazançta 6 puan; ana hedef zinciri g36’ya kadar sürüyor.

Karar: İlk devir teklifini gelir eşiği yanında görülen içerik ve tekrar turu faydasıyla değerlendir; zorunlu yapma.

Bitiş ölçütü: İlk devirden sonraki 15 dk eski başlangıçtan belirgin hızlı ve farklı hissetsin; sürpriz kayıp olmasın.

Kaynak: src/data/prestige.ts; src/core/Game.ts getPrestige.

**Q54 · Sonsuz hedefte artan angarya — P1 / Tasarım kararı**

Mevcut: Beş şablon her tur ×1,45 büyüyor; yeni davranış yerine sayım uzuyor.

Karar: Hedef süresine tavan, çeşit rotasyonu ve görünür koleksiyon ilerlemesi ekle.

Bitiş ölçütü: Ardışık üç geç oyun oturumunda yalnız daha büyük aynı sayaç sunulmasın.

Kaynak: src/data/goals.ts ENDLESS_GROWTH; src/sim/Goals.ts.

**Q55 · Koleksiyon ve özgün kafe kimliği — P2 / Tasarım kararı**

Mevcut: Kafe teması mevcut; uzun vadeli görsel tamamlanma zayıf.

Karar: Az sayıda nitelikli masa/dekor seti, tarif ustalık rozeti ve şube hatırası planla.

Bitiş ölçütü: Koleksiyon görünür mekân değişimi sağlasın; zorunlu günlük giriş veya kayıp tehdidine dayanmasın.

Kaynak: src/data/cosmetics.ts; src/data/goals.ts.

**Q56 · Gerçek geri dönüş kanıtı — P1 / Doğrulanacak**

Mevcut: İnsan katılımcı sonucu ve olgun D1/D7 kohortu yok; ölçüm araçları var.

Karar: Aynı sabit sürümle gerçek oyuncular; yerel raporları elle topla, kayıp gözlemleri ayrı tut.

Bitiş ölçütü: Katılımcı sayısı, kapsanan günler, dönüşler ve belirsizlik birlikte raporlansın; botlar dışlansın.

Kaynak: docs/OYUNCU-TESTI-VE-ACILIM-2026-09-05.md.

### Teknik ve cihaz

**Q57 · Üretim açılış gecikmesi — P1 / Ölçüldü; nedeni belirsiz**

Mevcut: Bu PC/headless turunda üretim yaklaşık 34–36 sn, ardından DEV yaklaşık 2 sn açıldı.

Karar: Soğuk/sıcak cache, yükleme, geometri ve shader hazırlığını ayrı zamanla; gerekli açılış işini öne al.

Bitiş ölçütü: Gerçek orta telefonda ilk kontrol ≤5 sn, düşükte ≤8 sn başlangıç hedefi; bu PC ölçümü telefon süresi diye sunulmasın.

Kaynak: inspection.json bootMs; src/world/Scene3D.ts prepareForPlay.

**Q58 · Güncel telefon sürümünün uzun testi — P0 / Doğrulanacak**

Mevcut: Son görsel ve mekanik değişiklikleri içeren 30 dk fiziksel düşük/orta cihaz kanıtı yok.

Karar: Onaylı yayın karakterleriyle güncel pakette 30–45 dk soğuk/ısınmış durum testi.

Bitiş ölçütü: Temel cihazda sürdürülebilir 30 FPS; örnek karelerin ≥%95’i bütçede, tekil uzun donmalar incelenmiş.

Kaynak: docs/CIHAZ-TEST-LISTESI.md.

**Q59 · Maksimum içerik performansı — P1 / Doğrulanacak**

Mevcut: Kurulu sahneler çiziliyor; az/çok müşteri, 15 ürün, tüm personel ve olay birleşimi uzun ölçülmedi.

Karar: En kötü yoğunluğu gerçek kademelerle kur; CPU, GPU ve çizim süresini ayır.

Bitiş ölçütü: Aynı fixture ile başlangıç/orta/son oyun ölçümü; kalite düşerken oyun ekonomisi değişmesin.

Kaynak: src/core/Quality.ts; src/core/RenderBudget.ts; inspection.json.

**Q60 · Kaynakların uzun kullanımda temizlenmesi — P1 / Doğrulanacak**

Mevcut: Karakter ve süpürge için çevrim testleri var; bütün şube/devir/dekor/arka plan birleşimi eksik.

Karar: Tekrarlayan 20 şube, 10 devir, 30 dekor, 50 alet çevrimi test et.

Bitiş ölçütü: Isınma sonrası geometri/doku/skeleton sayısı monoton büyümesin; eski dünyaya bağlı nesne kalmasın.

Kaynak: tools/render-check.mjs; tools/vacuum-visual-check.mjs.

**Q61 · Kayıt yükseltme ve kesinti kabulü — P0 / Doğrulanacak**

Mevcut: Yedek/migration temeli var; son paket gerçek cihazdaki eski kayıt üstünde denenmedi.

Karar: Temiz kurulum ve önceki yayımlanacak sürümden yükseltme; ödeme ve satın alma anında arka plan/sonlandırma.

Bitiş ölçütü: Para, kısmi ödeme, çalışan, dekor ve görevler korunur; çift kesinti/çift ödül yok.

Kaynak: src/core/SaveManager.ts; src/core/Native.ts.

**Q62 · Çevrimdışı paket tamlığı — P1 / Doğrulanacak**

Mevcut: Kaynak GLB denetimi var; mevcut eski APK son varlıkları taşımıyor.

Karar: Yeni APK/AAB içindeki GLB yan dosyaları ve ilk açılışı uçak modunda doğrula.

Bitiş ölçütü: Kurulum sonrası ilk açılış ve bütün şubeler ağsız çalışır; eksik doku veya sonsuz yükleme yok.

Kaynak: tools/release-assets.mjs; public/packs.

**Q63 · Platform yaşam döngüsü — P1 / Doğrulanacak**

Mevcut: Web kontrolleri Android WebView’in izin, geri tuşu, çağrı ve ses kesintilerini kapsamaz.

Karar: Arka plan, kilit ekranı, telefon çağrısı, reklamdan dönüş, geri tuşu, döndürme ve düşük bellek senaryoları.

Bitiş ölçütü: Ses iki kez başlamaz; giriş takılmaz; açık panel doğru kapanır; ilerleme tutarlı kalır.

Kaynak: src/core/Native.ts; android/app/src/main.

**Q64 · Ses miksinin gerçek cihazda dinlenmesi — P1 / Doğrulanacak**

Mevcut: Prosedürel ses/müzik ve ayrı seviyeler var; bu tur duyusal miks değerlendirmesi yapılmadı.

Karar: Telefon hoparlörü/kulaklıkta üretim, para, temizlik, adım ve müzik yoğunluğu dinleme turu.

Bitiş ölçütü: Yoğun oyunda ses patlaması/rahatsız tekrar yok; bitiş sesleri ayırt edilir; mute/haptics bağımsız.

Kaynak: src/audio/AudioManager.ts; src/audio/Synth.ts.

### Yayın hazırlığı

**Q65 · Hazır Android dosyaları eski — P0 / Doğrulandı**

Mevcut: cikti 1.2.0 dosyaları 5 Eylül 00:34; son personel, zemin, tutuş ve açılım işi bu dosyalardan sonra.

Karar: Onaylı sabit kaynak noktasından yeni sürüm ve yeni versionCode üret; dosya özeti/hash ile eşleştir.

Bitiş ölçütü: İndirilen/kurulan ve test edilen dosya aynı hash; mağaza görselleri aynı sürümden.

Kaynak: cikti dosya tarihleri; android/app/build.gradle.

**Q66 · Varlıkların dağıtım kaydı — P0 / Doğrulanacak**

Mevcut: Yerel karşılaştırma varlıkları DEV’de tutuluyor; yeni süpürge kaynak bilgisi mevcut.

Karar: Her yayın varlığı için kaynak/lisans/uyarlama kaydı; dağıtım hakkı doğrulanmış karakter standardı.

Bitiş ölçütü: Üretim koruması geçer; DEV referansları pakete girmez; bütün gerekli atıflar paket ve künyede.

Kaynak: src/chars/index.ts; tools/release-assets.mjs.

**Q67 · Reklam yapılandırması — P1 / Doğrulandı**

Mevcut: Üretim kimliği verilmezse test reklam kimliklerine dönüyor; zorunlu reklam kapalı.

Karar: Zorunlu reklamı kapalı tut; ticari pakette gerçek kimlik ve test cihazı ayrımı; reklamsız seçenek de açık karar olsun.

Bitiş ölçütü: Gerçek cihazda hazır/yok/hata/iptal/tamamlandı akışları; ödül tam bir kez ve yalnız hak edildiğinde.

Kaynak: src/core/AdMobProvider.ts; src/core/Ads.ts; .env.example.

**Q68 · Gizlilik ve mağaza beyanlarının güncelliği — P0 / Doğrulanacak**

Mevcut: Eski yayın notlarında Türkçe-only, eski sürüm ve yaklaşık konumla ilgili eski varsayımlar var. Canlı politika bu tur doğrulanamadı.

Karar: Kurulu SDK sürümüne göre veri beyanı; çalışan politika adresi, destek, rıza ve mağaza alanlarını doğrula.

Bitiş ölçütü: Paket davranışı, ayarlar, politika ve Play beyanları aynı; bilinmeyen konsol durumu tamamlandı sayılmaz.

Kaynak: docs/YAYIN.md; src/core/AdMobProvider.ts.

**Q69 · Mağaza ve kapalı test erişimi — P1 / Doğrulanacak**

Mevcut: Console’daki güncel test katılımı/üretim erişimi bu incelemede okunmadı; targetSdk36 kaynakta mevcut.

Karar: Hesaba uygulanan test şartını doğrula; gerekli kapalı testi gerçek katılımla tamamla.

Bitiş ölçütü: Uygunsa 12 kişi/14 gün ve üretim erişimi; güncel pre-launch raporunda kritik açık yok.

Kaynak: android/variables.gradle; Play resmî test şartları.

**Q70 · Mağaza vaadi ve görseller — P1 / Tasarım kararı**

Mevcut: Eski mağaza görselleri bugünkü yayın kimliğini temsil etmeyebilir.

Karar: Gerçek yayın paketinden ilk döngü, kare ödeme, personel faydası ve şube dönüşümü göster.

Bitiş ölçütü: Görselde olmayan oyun vaat edilmez; ilk 10 sn tanıtım gerçek oynanış; TR/EN metin eşleşir.

Kaynak: docs/magaza-metinleri.md; cikti/magaza.

### Doğrulama ve ürün yönetimi

**Q71 · 151 test tam kalite anlamına gelmiyor — P1 / Doğrulandı**

Mevcut: Bütün mevcut testler geçerken kasa, el hızı ve görev anlamı kusurları yeniden üretildi.

Karar: Satılan her geliştirme için gözlenen davranış sözleşmesi; görsel onay ve insan kullanımını ayrı geçiş kapısı yap.

Bitiş ölçütü: Yeni testler bugünkü kusurlarda gerçekten başarısız olur; düzeltmeden sonra geçer.

Kaynak: inspection.json; npm test.

**Q72 · Botun personel tercihi eski role bağlı — P1 / Doğrulandı**

Mevcut: Yerde leke varsa acil komi alıyor; güncel komi zemini temizlemiyor. Usta Eller serbest yatırım listesinde yok.

Karar: Bot politikalarını güncel rollerle eşleştir ve farklı yatırım stratejilerini ayrı raporla.

Bitiş ölçütü: Komi yalnız masa ihtiyacına önerilir; eller yatırımcı politikada denenir; bot kısıtı oyun kusuru diye raporlanmaz.

Kaynak: tools/balance-bot.js tryPurchases.

**Q73 · Baştan sona doğal kayıt kanıtı — P1 / Doğrulanacak**

Mevcut: 90 dk doğal bot var; maksimum Sahil ve prestij bu tur kurulmuş fixture olarak denendi.

Karar: İlk kayıttan Sahil/veranda, ilk devir, ikinci turun 15 dk’sı ve sonsuz hedeflere doğal ilerleme.

Bitiş ölçütü: Doğal, hızlandırılmış ve doğrudan kurulmuş aşamalar raporda ayrı; tamamlanmamış bölüm açıkça işaretli.

Kaynak: .devshots/yayin-audit-2026-09-06.

**Q74 · Rekabet ve ticari potansiyel — P1 / Doğrulanacak**

Mevcut: Temel döngü var, farklılaşma ve insan ilgisi henüz ölçülmedi.

Karar: Önce nitel kullanım, sonra aynı sürümle geri dönüş testi; ancak sonuçtan sonra küçük pazarlama denemesi.

Bitiş ölçütü: Oyuncu neden devam ettiğini ve sonraki hedefini açıklayabiliyor; ücretli büyüme kararı gerçek kohort ve maliyete dayanıyor.

Kaynak: OYUNCU-TESTI-VE-ACILIM-2026-09-05.md.

## 10. İlk uygulanacak somut paket

İlk geliştirme turunun kapsamı Q01–Q08: kasa ve el işlem saati, tamamlanmış masa sayacı, gerçek sarf/rol kapasitesi ve satın alma metinleri. Aynı anda Q09 için tek yayın görünümü örneği hazırlanır. Bu tur tamamlanınca ilk 10 dakikanın insan gözlemi ve üç farklı yatırım politikasıyla ekonomi ölçümü yapılır. Yeni şube veya yeni para birimi bu işlerin önüne geçmez.

İlk turdaki zorunlu regresyon örnekleri:

1. Aynı kasaya L0/L1/L8 uygulayıp oyuncu ve kasiyer sipariş sürelerini ölç.
2. Usta Eller L0–L10 ile kesintisiz 30 sn alma, bırakma ve servis sayısını ölç; 30/45/60 Hz karşılaştır.
3. İlk masa hedefini bulaşık alırken değil, masayı tamamen silince tamamla; sonra kaydı aç.
4. Tuvalet sarf kapasitesinin kartını seviyeler arasında gerçek depo ile karşılaştır.
5. Tezgâhtarın gösterilen parti miktarını gerçekten teslim ettiğini göster.
6. Devir öncesi/sonrası satın almaların giden–kalan listesini denetle.

Bu rapor bir yayın onayı değildir. Yayın kararı, yukarıdaki kapılar aynı sabit paket üzerinde geçtiğinde yeniden verilecek. Takip dosyasında bir maddenin “tamamlandı” olması yalnız kod değişmesine değil, yazılan bitiş ölçütüne bağlıdır.
