# Çevrimdışı kafe — oynanış ve görünüm turu

5 Eylül 2026. Kullanıcının son yönü: internet gerektirmeyen, kolay anlaşılan, yeni satın alımların ve kafe gelişiminin tatmin verdiği bir idle kafe oyunu. Bu tur hesap, bulut kaydı veya sunucu gerektiren bir özellik eklenmedi.

## Uygulanan değişiklikler

- **İşlerin sırası:** Rehber artık mevcut temizlik ve üretim görevini dikkate alıyor. Bulaşık–kova–masa parlatma işi, yeni raf talebi çıktığında yarıda kesilmiyor. Uzun bekleyen kirli masa/zemin görünür bir iş oluyor; iş bitince servis akışına dönülüyor. Dolu raf yüzünden değerli ürünler otomatik olarak çöpe yönlendirilmiyor.
- **Hedefe git:** Aktif görev kartına HEDEFE GİT / SHOW ME eklendi. Personel, yükseltme, istasyon veya şube görevi doğru paneli açıyor; mekândaki iş için rehber kullanılıyor. Göreve ait satın alma pedi ilk üç ucuz seçenek dışında kalsa da gerektiğinde görünür oluyor; maliyet ve kilit şartları değişmiyor.
- **Doğru masa:** Yakın mobilya gövdesi yerine ulaşılabilir servis noktası seçiliyor. Önünde bulunulan Masa 4'ü komşu Masa 1'in engellediği gerçek yerleşim hatası giderildi.
- **Süpürge:** Rehber noktası ile alma/bırakma menzili eşleştirildi. Al–bırak kilidini açmak gerektiğinde rehber erişilebilir bir uzaklaşma noktası gösteriyor. Dolabın yanında yönlendirilen lekeyi temizlemek yanlışlıkla süpürge alma işlemine dönüşmüyor.
- **Günlük görev:** Kilitli tuvalet için sarf görevi verilmiyor. Görev kimliği ve hedefi günlük olarak yerel kayda alınıyor; alışveriş, dil/şube değişimi veya yeniden açılış görevi değiştirmiyor. Eski kayıt ve prestij geçişinde alınmış ödüller korunuyor.
- **Satın alma görünümü:** Alan kartlarında daha büyük ve belirgin fiyat; yarım ödemede kalan bedel, yüzde ve ilerleme çubuğu; tamamlanınca onay işareti var. Mevcut ped mesh sayısı korunuyor; etiket dokusu güncellemeleri saniyede en fazla 10 kez birleştiriliyor.
- **Görsel hatalar:** Rehber halkasının elipse dönüşen nabzı ve paylaşılan malzemeleri istemeden renklendirmesi düzeltildi. İstasyona özel sayaç dokusu kaldırılırken serbest bırakılıyor.
- **Dil:** İngilizce ekrandaki seviye, depo, sandalye, kilit, kupon, günlük ödül ve dinamik görev metinleri tamamlandı.
- **Paket bütünlüğü:** GLB modellerinin dış doku/tampon dosyaları da yayın denetimine alındı. Eksik veya yanlış büyük/küçük harfle yazılmış dosyalar ve uzaktaki model kaynakları derlemeyi durduruyor.

PC önizlemesinde daha önce tercih edilen karakterler ve yumuşatılmış kol hareketleri korundu. Üretim karakter seçimi bu tur değiştirilmedi.

## Kontroller

- 121 otomatik test geçti; üretim derlemesi ve model dosyası denetimi geçti.
- Yedi tarayıcı senaryosu geçti: bağlantı kesilince aktif oyun/yerel kayıt, satın alma ve kısmi ödeme, görev düğmeleri, tam masa temizliği, süpürge dönüşü, dolap yanındaki leke ve doğru servis noktası seçimi.
- Gerçek yerleşimde 1.742 yürünebilir konum örneğinde temizleme/servis seçimi hatası kalmadı.
- Yedi reddedilen satın alma para düşürmedi. Pedden hareketli geçişte para alınmadı. ₺37,125 kısmi ödeme kayıt/yüklemede korundu; tamamlamada yalnız kalan bedel bir kez alındı.
- Görüntü/derinlik karşılaştırması geçti; grafik bağlamı geri geldi; menüde simülasyon ve tekrar çizim durdu. Müşteri kaynak testinde doku sayısı 65 → 65 kaldı. Düşük ayarda büyük pencerenin 3D alanı piksel bütçesi içinde kaldı.
- Tarayıcı senaryolarında sayfa hatası veya uzak sunucu isteği kaydedilmedi.

### Güncel üretim simülasyonu

| Koşul | Servis | Toplanan bulaşık | Silinen leke | Tamamlanan masa temizliği | Görev indeksi | En uzun faaliyet arası |
|---|---:|---:|---:|---:|---:|---:|
| TR, 30 dakika, seed 417 | 108 | 58 | 35 | 31 | 16 | 32 sn |
| EN, 30 dakika, seed 417 | 122 | 56 | 29 | 32 | 16 | 36 sn |
| TR, 15 dakika, seed 841 | 62 | 25 | 18 | 13 | 12 | 31 sn |

Görev indeksi sıfır tabanlıdır. Başlangıçtaki ilk tam servis/temizlik döngüsü yaklaşık 41 simülasyon saniyesinde, ilk masa açılımı yaklaşık 2 dakikada gerçekleşti. Aynı seed ile açılış karelerinin zamanlaması farklı rastgele tüketimlere yol açabilir; TR/EN sonuç farkı tek başına dilin ekonomiyi değiştirdiği anlamına gelmez.

Bunlar hızlandırılmış otomatik oyuncu sonuçlarıdır; insan öğrenme süresi, telefondaki FPS veya oyuncuların geri dönüş oranı değildir. Kabul kontrolü artık yalnız ilk öğreticiyi geçmeyi yeterli saymıyor: tekrar masa kullanımı, leke görevi ve üç dakikayı aşan faaliyetsizlik de denetleniyor.

## Yerel kanıtlar

- [Üretim TR](../.devshots/offline-production-final/tr-result.json)
- [Üretim EN](../.devshots/offline-production-final/en-result.json)
- [İkinci başlangıç](../.devshots/offline-production-seed841/tr-result.json)
- [Çevrimdışı/alışveriş/rehber kontrolleri](../.devshots/offline-flow-check/results.json)
- [Çizim kontrolleri](../.devshots/render-check/result.json)
- [Alan kartı kontrolleri](../.devshots/pad-polish-2026-09-05/results.json)
- [Yarım ödeme kartı](../.devshots/pad-polish-2026-09-05/partial-texture.png)

Tekrar çalıştırma: npm test; npm run build; npm run test:offline; npm run acceptance -- --minutes=30 --lang=tr,en --seed=417; npm run test:render.

## PC ve cihaz ayrımı

Bu tur PC/web kaynakları ve üretim web derlemesi güncellendi. Önceki tercihe uygun olarak Android'e kurulum yapılmadı; eski APK/AAB dosyaları değiştirilmedi.

Mevcut public kaynakları eksiksizdir. Önceki 1.2.0 APK/AAB'lerde on yiyecek modelinin kullandığı ortak colormap.png dokusunun bulunmadığı ayrıca doğrulandı. Yeni dosya denetimi bu tür eksikliği tekrar paketlemeye bırakmıyor. Sonraki Android paketi güncel kaynaklarla eşitlenip yeniden üretilmeli.

Kurulu mobil oyun kodunda zorunlu ağ beklemesi yok; reklam başlatma oyun başladıktan sonra arka planda deneniyor. Tarayıcı bağlantı testi, yüklenmiş oyunun devamını ve kaydını kapsıyor. Fiziksel cihazda internetsiz ilk açılış, uzun oturum/ısınma ve gerçek oyuncunun hissi bu tur ölçülmedi.

Bir sonraki tasarım kararı, mevcut oynanışı birkaç kişinin doğrudan denemesiyle verilmeli: oyuncu nereye gideceğini anlıyor mu, yeni satın alım fark yaratıyor mu, servis ve temizlik temposu rahat mı? Daha çok sistem eklemeden önce bu deneyim değerlendirilmelidir.
