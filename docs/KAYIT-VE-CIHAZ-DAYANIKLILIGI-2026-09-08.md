# Kayıt ve cihaz dayanıklılığı — 8 Eylül 2026

Bu çalışma SaveManager, Settings ve Native köprüsünü inceler. Karakter dosyalarına, kullanıcının oyun kaydına, bağlı cihaza ve mağaza yayınına müdahale edilmez.

## Düzeltilen gerçek hatalar

- Depolama kotası doluyken yazma denemesi başarısız oluyor ve eski kod okunabilir mevcut kaydı da yok sayıyordu. Mevcut ilerleme artık okunur ve dışa aktarılır; alan açılınca kayıt yazımı tekrar denenir.
- İçe aktarma yalnız ana yuvayı değiştiriyordu. Ana yuva hemen bozulursa önceki oyunun yedeği yüklenebilirdi. İki yuva artık aynı geri yüklenen oyunu taşır. Ana yuvaya yazılamazsa hazırlanmış yedek geri alınır.
- Yedek yazımı geçici olarak başarısızsa artık bir sonraki kayıtta tekrar denenir; eski kod başarısız denemeden sonra da beş dakika bekliyordu.
- Dışa aktarma bozuk ana metni paketleyebiliyordu. Sağlam kurtarma yuvası varsa dışa aktarma onu kullanır.
- JSON olarak geçerli fakat şekli bozuk station/spill/state verisi yükleme sınırından geçiyordu. Bilinen kayıt alanlarının şekilleri ve sayısal değerleri kontrol edilir. Bozuk ana yuva sağlam yedeğe düşer; bozuk içe aktarma mevcut oyunu değiştirmez; geçersiz çalışma anı verisi iki sağlam yuvayı ezmez.
- v8 içindeki eski isteğe bağlı alanlar desteklenir. Farklı ve uyumsuz v7/eski veya gelecekteki şema için sahte başarılı içe aktarma yapılmaz.
- Kısmi v2 ayarlarında grafik kademesi yoksa cihaz saptaması uygulanır. Bozuk v2 ayarı varsa sağlam v1 tercihleri kurtarılır. Dizi ve skaler JSON değerleri ayar nesnesi sayılmaz. Manuel grafik, kare hızı, ses ve erişilebilirlik tercihleri yeniden açılışta korunur.
- Cihaz titreşimi veya olay dinleyicisi asenkron hata verdiğinde hata ele alınır. Kaldırılan dinleyiciler artık geç gelen geri/yaşam döngüsü olaylarını işlemez. Üst üste üçüncü geri basışı ikinci bir kapanış ve kayıt başlatmaz.

## Kanıt

- 21 bağımsız test: 11 kayıt, 4 ayar, 6 native köprü adaptörü senaryosu. Native adaptörü fiziksel cihaz testi değildir.
- Tip kontrolü geçti.
- Önceki 6–8 Eylül otomatik oyun koşularından 13 gerçek v8 kayıt örneğinin state/world alanları yeni doğrulamadan geçti. Bu örnekler kullanıcının canlı tarayıcı profili değildir.
- Yedi gerçek web akışı geçti: çevrimdışı açık oyun + kayıt, satın alma birikimi + yeniden yükleme, hedef yönlendirmesi, masa bakımı, süpürge dönüşü, süpürge yakınındaki leke, servis noktası seçimi. Tarayıcı hatası ve yabancı HTTP isteği görülmedi. Yeniden yüklenen dev kaynağı yerel sunucudan gelir; bu sonuç native soğuk çevrimdışı açılış testi olarak sunulmaz.
- Ham kayıt: [results.json](../.devshots/product-reliability-2026-09-08/results.json). Tarayıcı raporunun bu tura sabitlenmiş kopyası: [offline-results.json](../.devshots/product-reliability-2026-09-08/offline-results.json).

## Ses seviyesi ve yaşam döngüsü

AudioManager içinde ilk kullanıcı dokunuşunda oluşturulan müzik motoruna kayıtlı ses oranı aktarılmıyordu. Ayrıca müzik ve efekt yankıları kendi kaydırıcılarını atlayabiliyordu. Kuru ve yankılı toplam artık kategori ses ayarından birlikte geçer. Aynı oda impulse tamponunu kullanan iki kısa ConvolverNode ile kategorilerin yankı dönüşleri ayrılır; nota, efekt ve tam seviye karışım değerleri korunur. Bu değişiklik bir kısa ConvolverNode ekler; fiziksel cihaz yükü ölçülmüş sayılmaz.

Askıya alma ve devam çağrıları asenkron tamamlandığı için hızlı arka plan geçişinde eski istek sonradan uygulanabiliyordu. Ses motoru artık son istenen duruma uzlaşır. İlk dokunuştan önce gelen askı isteği de korunur; dispose sonrasında bekleyen geçiş motoru yeniden açamaz.

Boş Vite sayfasında gerçek tarayıcı WebAudio denetimi geçti; tam oyun veya oyuncu kaydı yüklenmedi. Efekt/müzik × kuru/yankı dört yolunda %25 oranı 0,24995–0,24999 ölçüldü; dört yolun 0 seviyesinde RMS değeri 0. İlk açılışta kayıtlı 0 ve 0,27 müzik seviyeleri gerçek notalarla doğrulandı. Ana sessiz, süpürge dahil tüm katmanları susturdu. Suspend→resume sonunda running; ters sırada ve ilk unlock öncesi askıda suspended görüldü. Dispose sonrasında context closed; yönetici voice/düğüm/müzik/süpürge referansları boş. Context kapanınca kaynak ended olayları üretilmedi; başarı kanıtı kapalı context ve boş yönetici kaynaklarıdır.

Ses ölçümü: [audio results.json](../.devshots/audio-reliability-2026-09-08/results.json). Tekrar: node tools/audio-check.mjs (5354). Bu elektriksel seviye ve yaşam döngüsü sınamasıdır; insan dinleme testi değildir.

## Cihaz ve dış doğrulama durumu

ADB envanterinde yalnız emulator-5554 var: model 22081212C, Android 7.1.2/API 25. com.fincansokagi.game kurulu değil; oyun süreci veya erişilebilir oyun WebView bağlantısı yok. Fiziksel telefon doğrulanmadı. Uygulama kurulmadı, başlatılmadı, cihaz ayarı veya verisi değiştirilmedi.

Yerel SDK platformları 34/35/36; build-tools 28.0.3/34.0.0/35.0.0/36.0.0. Capacitor Android derlemesi Java 21 ister; oturum JAVA_HOME değeri JDK 17 olsa da kurulu JDK 21, C:/Users/Enes/.gradle/jdks/eclipse_adoptium-21-amd64-windows.2 yolunda bulunur. Varsayılan ortam değiştirilmedi. Son AAB 6 Eylül 23:21 tarihli olduğundan bu turun kaynak düzeltmelerini içermiyor. Güncel AAB ile fiziksel Android üzerinde sıcaklık, uzun oturum, arka plandan dönüş, düşük bellek ve ses denemeleri henüz doğrulanmış sayılmaz.

Eski 6 Eylül progression-final özeti 9 koşu listeliyor; aynı klasörde cleaner-1206 ham dosyası yok. Bu eski toplam yeni test kanıtı olarak devralınmaz. Yeni uzun matrisin her özet satırı kendi ham çıktısıyla denetlenmelidir.

Bu not bir mağaza yayını veya insan oyuncu memnuniyeti onayı değildir. Güncel tam oyun matrisi ve sunum çalışması ana ürün turunda ayrıca yürütülür.
