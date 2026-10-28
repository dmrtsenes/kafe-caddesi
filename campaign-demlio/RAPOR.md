# Demlio — oyun incelemesi ve tanıtım teslimi

13 Eylül 2026 • Mevcut proje: Fincan Sokağı 1.2.1 • Hedef mağaza: Google Play.

## Teslim ve sınırlar

Gerçek dosyalar üretildi: 18,533 saniyelik dikey reklam, ayrı Türkçe ses, özgün müzik ve efekt kanalları, altyazılar, şeffaf logo, ikon, tanıtım görseli ve altı mağaza kompozisyonu. Düzenlenebilir SVG, çekim kodu, kurgu zaman çizelgesi ve tekrar üretim komutları pakette.

Ses yerel Piper Türkçe sentezidir; insan ses sanatçısı tarafından yapılmış stüdyo kaydı değildir. Açılış ve üç diğer cümle bağımsız yerel konuşma tanımada doğru çözüldü. Son cümlenin “Sıra sende” kısmı doğru çözüldü; uydurma marka adı otomatik tanımada doğrulanamadı. Bu sonuç tam dinleme/telaffuz onayı veya profesyonel doğal ses garantisi olarak sunulmuyor. Kaynak sesler gerçek ve duyulabilir; sessiz bir video teslim edilmedi.

Karakterlerin kaynak dosyası Clean It 1.24.0 XAPK'dan çıkarıldıklarını açıkça belirtiyor. Mevcut oyun grafikleri kullanıldı; bu çalışma bu karakterlere yayın hakkı kazandırmaz. Bu nedenle set, karakter kullanım hakkı çözülene kadar yerel inceleme paketi olarak değerlendirilmelidir. Yeni marka çizgisi ve ikon özgün vektördür; rakibin logosu veya mağaza tasarımı kopyalanmadı. Dışarı proje, görüntü veya ses yüklenmedi; hesap kullanılmadı ve ücretli hizmet çağrısı yapılmadı.

## Gerçek oyun kimliği

TypeScript + Three.js + Vite; Android/iOS kabuğu Capacitor. Teknoloji değiştirilmedi. `World`, `Player`, `Customer`, `Station`, `GameState`, `Scene3D`, ürün/istasyon/yerleşim/personel verileri, arayüz katmanı, karakter manifesti ve yayın belgeleri incelendi. Reklam aynı simülasyonu, modelleri, mobilyaları, el hareketlerini ve sahne çizimini çalıştırıyor.

Ana döngü: makineden ürün al → müşterinin gerçek siparişini masaya taşı veya paket rafını doldur → kasadaki görünür geliri topla → bulaşığı kaldır, kovaya bırak, masayı sil → kazancı geliştirmeye/personel/bölge açılımına yatır. Oyuncu yakınlıkla çalışıyor; oyun tek elle hareket ve kısa iş tamamlamalarına dayanıyor.

Kodda Mahalle ve Sahil, yeni makineler/masalar, hız/el/taşıma geliştirmeleri, şubeye özel personel, hedefler, festival, prestij ve kozmetik bulunuyor. Tezgâhtar raf doldurur; kasiyer sipariş akışına yardım eder; komi masa bakımı yapar; barista üretimi destekler. Aktif servis ve kazanç toplama oyuncuda kalır. Çevrimdışı stok hazırlığı, sınırsız pasif para diye pazarlanmadı. Reklamda yer almayan ileri sistemlerin tamamı bu kısa çekimle doğrulanmış sayılmıyor.

Ayırt edici kimlik: ince belli çay, görünür tepsi servisi, masanın yeniden kullanılabilir hale gelmesi ve aynı kazancın işe geri yatırılması. Konumlandırma: “Küçük bir masadan kendi kafene.”

## Kod ve varlık incelemesi bulguları

| Öncelik | Kanıt ve etkisi | Durum |
|---|---|---|
| P1 | `docs/KARAKTER-KAYNAGI.md:5`: oyuncu ve müşteri modelleri referans oyundan çıkarılmış; dağıtım izni doğrulanmamış. Ticari mağaza/reklam kullanımı için önemli açık. | Varlıklar izinsiz değiştirilmedi; yayın yapılmadı. Hak belgesi veya izinli varlıklarla ayrı çözüm gerekli. |
| P2 | `src/world/StationView.ts:1570` kirli göstergesini yalnız bulaşık adedine bağlıyor; `src/sim/World.ts:2878` yalnız `dishes` iletiyor. `src/sim/Station.ts:142` ise kalan `soil` varken yeni müşteriyi reddediyor. Bulaşık kalktıktan sonra çalışılmayan kirli masa temiz görünebiliyor. | İlk görsel provada da gözlendi. Ana oyuna yeni görünüm eklenmedi; reklam açılışı görünür gerçek bulaşıkla yeniden çekildi. Kalıcı yüzey kiri/gösterge düzeltmesi ayrı oyun işi olarak kaldı. |
| P2 | Önceki `src/promo-gameplay/main.ts` ilk üç saniyede oyuncuya iş yaptırmıyor ve 25 saniyelik sabit bloklara bağlı. | Yeni ayrı modda çözüldü: ilk kare iş başlangıcı; geçişler gerçek tamamlanma koşullarına bağlı. Eski dosyaların üzerine yazılmadı. |

Kayıt koruması ve mekanik testleri dahil mevcut **328 test geçti**; TypeScript ve üretim derlemesi geçti. Yeni çekimde konsol hatası, dış ağ isteği, yerleşim doğrulama hatası veya oyuncu baş/ayak kadraj ihlali yok. Bu inceleme tam güvenlik denetimi ya da her cihazda performans garantisi değildir.

## Üç isim ve seçim

| Aday | Güçlü yanı | Zayıf yanı / çakışma |
|---|---|---|
| **Demlio — seçildi** | Altı harf; “dem” kökü gerçek çay başlangıcına bağlanıyor. Türkçede dem-li-yo; uluslararası kullanımda aynı ASCII yazım. Çayla başlasa da tüm kafeyi kapsayacak kadar soyut. | İlk temasta kafe türünü alt başlıkla açıklamak iyi olur. Yeni sözcüğün ses tanıma sözlüğünde olmaması telaffuz kontrolünü sınırlar. |
| Kafe Caddesi / Cafe Avenue | Mekân ve işletme hissini hemen anlatır; projedeki eski marka çalışmasıyla devamlılık sağlar. | İki dilde iki ad; daha uzun ve genel. Cafe Avenue başlığıyla şarkı ve çok sayıda kafe kullanımı bulunuyor. |
| Fincora | Fincan çağrışımı, akıcı telaffuz, uluslararası yazım. | Aynı adla aktif kahve markası ve yazılım kullanımı var; bu alanla yakın çakışma nedeniyle elendi. |

13 Eylül'de “Demlio”, “Demlio game cafe app”, Google Play ve App Store alanıyla sınırlanan sorgular incelendi. Belirgin aynı adlı oyun/uygulama sonucu görülmedi; arama motorunun sonuç vermemesi adın boş olduğunu kanıtlamaz. Tescil sicili, ülke bazlı hukuki inceleme, alan adı veya sosyal hesap müsaitliği kontrolü yapılmadı. Bu bir marka tescili garantisi değildir.

Dayanaklar: [Fincora Coffee](https://fincoracoffee.com/), [Fincora uygulaması](https://www.fincora.app/), [Cafe Avenue şarkısı](https://music.apple.com/us/song/1435632750). Seçim yaratıcı değerlendirmedir; satış veya arama hacmi tahmini değildir.

## Görsel kimlik

İnce belli çay bardağı, servis tepsisi biçiminde kavis ve iki buhar çizgisi. Küçük harfli ağır, yuvarlak wordmark; sade ve sıcak bir işletme tonu. Paytone One logo/başlık, Barlow Condensed Bold destek metni. Türkçe karakterler görüntü üzerinde kontrol edildi; iki fontun OFL metinleri pakette.

| Renk | Kod | İşlev |
|---|---|---|
| Koyu yeşil | #123B39 | Ana zemin, yazı kontrastı |
| Çay bahçesi yeşili | #157F73 | İkon ve vurgu |
| Süt kreması | #FFF3D8 | Ana yazı ve cam |
| Sıcak altın | #FFCE78 | Tepsi, ilerleme ve çağrı |
| Bakır | #CB7849 | Çay rengi |

Logonun çevresinde en az küçük harf yüksekliğinin dörtte biri kadar boşluk bırakılır. Tam logo için en az 180 px genişlik; küçük kullanımda yazısız ikon. Logo esnetilmez. Şeffaf PNG'ler gerçek alfa içerir. İkon 512 px'de 88.830 bayt; kare ve dış köşe maskesi olmadan verildi.

## Reklam kararı ve kurgu

Üç açılış değerlendirildi: sipariş balonlarına karşı boş tepsi; kirli masanın dönüşümü; tahsilatın personel ödemesine bağlanması. Görünür kirli bulaşık seçildi: ilk karede sorun okunuyor, ilk el hareketinde cevap başlıyor. “Şu masaya bak” cümlesi 40 ms'de ses kanalına giriyor; logo beklenmiyor. Dört kısa devam cümlesi ilerlemeyi taşıyor; tüm işlemler sesle tek tek sayılmıyor.

Sıra: bulaşığı al → kovaya bırak → masayı sil → çayları al → iki müşteriye üç çay servis et → kasayı topla → tezgâhtar için ödeme yap → çalışan rafı doldursun → marka/çağrı. Odalar arasındaki yürüyüşler jump cut ile çıkarıldı. Ürün, para, personel veya masa durumu kesmede değiştirilmedi. Başlangıç 300 ₺; iki bulaşık ve silmenin gerçek ödülü 34 ₺; gösterilen servislerden kasa tahsilatı 124 ₺; gerçek işe alım bedeli 400 ₺; kalan 58 ₺. Bu, yeni oyun başlangıcı veya sıfırdan 18 saniyede büyüme vaadi değildir; bellekte hazırlanmış tutarlı bir oturum kesitidir.

Kamera 48° yukarıdan, sabit küçük yan açıyla yakın plan. İş değiştirdiğinde merkez ilgili istasyona geçiyor; kamera dönerek aksiyonu gizlemiyor. Kapanışta çalışan hareketi devam ediyor. Tamamlanma sonrası kısa kuyruklar el transferi, yıldız/ödül ve okumayı koruyor; sabit 25 saniye hedefi yok. Gerçek kesme zamanları `source/timeline.json` içinde.

Referanslardan yalnız sunum ilkeleri alındı: [Clean It](https://play.google.com/store/apps/details?id=com.lilyxgame.cleanit) için temizlikte net sonuç, [My Mini Mart](https://play.google.com/store/apps/details?id=com.KisekiGames.smart) için stok/para ilişkisinin okunması, [My Perfect Hotel](https://play.google.com/store/apps/details?id=com.master.hotelmaster) için kazan–işe yatır döngüsü. Mevcut projedeki karakter kaynak sorunu bu yaratıcı tercihten bağımsızdır ve yukarıda açıkça kaydedildi.

## Ses ve kontrol

Standart Türkçe erkek ses: Piper tr_TR-fahrettin-medium, yerel çalışma. Açılış biraz daha çevik, devam daha sakin. Kişiye özel ses taklidi veya ses klonlama yapılmadı. Son metin: “Şu masaya bak.” / “Küçük bir başlangıç.” / “Bir adım daha.” / “Birlikte daha fazlası.” / “Demlio. Sıra sende.” Ses motoruna isim “Demliyo” olarak verildi.

112 BPM özgün prosedürel müzik: yumuşak tuşlu çalgı, bas ve hafif ritim. Bulaşık, üretim, servis, silme, para ve işe alım efektleri gerçek olay kayıtlarına bağlı. Konuşma müziğe kompresör kontrol sinyali gönderir; başlangıç 12 ms, bırakma 180 ms. Harici müzik örneği veya popüler eser kullanılmadı. Ayrı müzik, efekt, seslendirme ve final mix WAV dosyaları verildi.

Final ölçümü: yaklaşık **−15,7 LUFS**, **−1,5 dBTP**, **5,7 LU** ses aralığı. Tüm video/ses akışları baştan sona hatasız çözüldü; siyah kare ve 0,8 saniyeyi aşan donma bulunmadı. Bütün süre 0,4 saniye aralıklarla görüntü levhalarında incelendi; tek tek her kare için insan izleme iddiası yok. Son dosya Chromium'da baştan sona normal hızda oynatıldı; 555 görüntü sunumu gözlendi ve ilk saniyede ses çıkışı ölçüldü (`review/playback.json`). Açılış ve kesme anları ayrıca görülür. Ses tanıma raporu `review/voice-recognition.json`; insan dinlemesinin yerini tutmaz.

Piper aracının [MIT lisansı](https://github.com/rhasspy/piper/blob/master/LICENSE.md), Türkçe sesin [model kartındaki CC0 veri kaydı](https://huggingface.co/rhasspy/piper-voices/blob/refs%2Fpr%2F37/tr/tr_TR/fahrettin/medium/MODEL_CARD) ve [açık ses verisi kaynağı](https://github.com/OHF-Voice/voice-datasets) incelendi. İndirilen ses modelinin kartı pakette. Araç veya veri lisansı, oyunun üçüncü taraf karakterlerine hak vermez.

## Mağaza dosyaları ve yayın durumu

Proje Android/Google Play belgeleri bulundu; varsayımla iOS boyutu kullanılmadı. [Google Play önizleme gereksinimleri](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-GB) ve [ikon şartnamesi](https://developer.android.com/distribute/google-play/resources/icon-design-specifications) 13 Eylül 2026'da kontrol edildi.

İkon 512×512 RGBA PNG, 1 MB altında. Feature graphic 1024×500 RGB PNG. Altı ekran görüntüsü 1080×1920 RGB PNG; yazı bandı %16,7. Oyun görüntüsü oranı korunarak kadrajlandı; esnetme veya cihaz çerçevesi yok. İlk kare servis deneyimini gösteriyor. Sıralama/indirme sayısı, fiyat, sahte ödül veya mağaza indirme çağrısı görsellere eklenmedi. Alt metinler `store/alt-metinler.json` içinde.

Mevcut marka altında herkese açık yayın erişimi doğrulanmadı. Yeni isim mağazada kullanılmıyor; dolayısıyla reklamın kapanışı “Gelişmeleri takip et”. YouTube veya Play Console'a yükleme yapılmadı. Play mağaza videosu bir YouTube URL'si ister; verilen MP4 yerel ana reklam dosyasıdır ve bir yayın bağlantısı değildir.

Tarayıcı oynatımının kalite sayacı 556 toplam kareden 2'sinin o yerel oynatımda düşürüldüğünü bildirdi; bu, kodlanmış dosyada eksik kare saptandığı anlamına gelmez. FFprobe dosyanın 556 karesini de hatasız çözdü. Tarayıcıdaki sunum callbacks sayısı 555'tir; bu sayaç dosya kare sayısının yerine kullanılmaz.

Paket kimliği, kayıt anahtarları, kurulu ürün adı ve ana oyun davranışı bu görev kapsamında değiştirilmedi. Yeni mod `campaign.html`; yalnız tanıtım dosyaları Demlio adını kullanıyor.
