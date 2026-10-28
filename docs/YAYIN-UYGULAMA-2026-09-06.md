# Kafe Caddesi — 6 Eylül son uygulama durumu

Bu kayıt, yayın planındaki 74 maddede bu turda kaynakta uygulanan işleri ve gerçek dış doğrulama gerektiren işleri ayırır. Otomatik test geçmesi insan deneyimini veya fiziksel cihaz sonucunu temsil etmez.

## Kaynakta tamamlanan ve otomatik kapısı geçen çekirdek

- Q01–Q08: kasa/el işlem saatleri tek gerçek saatten geliyor; masa tamamlandı sayacı ayrı; tuvalet sarf kapasitesi ve tezgâhtar parti kapasitesi gerçek değerle aynı; Güler Yüz açıklaması tüm hesap değerine göre; devir ekranında giden/kalan listesi; canlı TR/EN metinler.
- Q09–Q12 ve Q26–Q40: yayın varsayılanı tek CC0 Quaternius ailesi; lisanslı Zoe XR süpürge; taşıma/tepsi/araba/paspas/süpürge tutuşları; oda ve şemsiye görüş kapatma; ilk kadraj kamera yardımcısı; kısa cihaz uyumlu öğretici; üretim karakteri yayın paketinde korunuyor.
- Q17–Q25: üç bot politikası ve üç tohumlu hızlandırılmış akış; personel işi, barista katkısı, komi masa kapsamı, zemin hijyen yükü ve watchdog kurtarma sayaçları; alan bedelleri ve olağan hedef ödülleri tek ekonomi kaynağında.
- Q41–Q55: SVG simge ailesi, 44px dokunma hedefleri, gerçek önce/sonra yükseltme değerleri, açık hata durumları, tek ön plan olayı, festival/günlük/haftalık hedef göçü, sonsuz hedef üst sınırı, çevrimdışı stok özeti, Sahil paket ağırlığı, prestij ve kalıcı tarif/şube albümü.
- Q57, Q61, Q62, Q65, Q66, Q67, Q71, Q72: açılış faz ölçümleri ve paralel varlık yükleme; VisibilityGate ile DOM/native yaşam döngüsü; kayıt yedekleme ve native depo kuyruğu; güncel AAB; varlık/lisans ve üretim dışı karşılaştırma kontrolü; reklam zorunlu değil; bot test kimlikleri güncel rollerle eşleşiyor.

## Üretim kanıtı

- npm test: 183/183.
- npm run build: geçti.
- UI sözleşmesi: TR 320px + EN 390px geçti.
- Çevrimdışı akış: 7 senaryo geçti.
- Personel: Köşe/Sahil geçti.
- Süpürge görsel/fizik: release ve comparison modları geçti; el/kafa/zemin hata değerleri pratikte sıfır.
- Render: renk/derinlik, menü duraklatma, context restore ve görüş dışı çizim geçti; Quaternius karakter; karakter kaynak sayısı 70→70.
- Unlock: tüm açılım adımları ve tam yerleşim boş.
- Acceptance: TR/EN 15 dakikalık ilk döngü geçti; ilk sipariş yaklaşık 16 saniye, ilk servis 24 saniye, ilk kasa 27 saniye.
- 90 dakikalık ilerleme matrisi: rehber 3 tohum, yatırımcı 3 tohum, temizlikçi 3 tohum; ham sonuçlar [progression-final](../.devshots/release-fixes-2026-09-06/progression-final/summary.json).
- Android release: [güncel sabit AAB](../cikti/FincanSokagi-v1.2.0-release-fixed.aab), [hash](../cikti/FincanSokagi-v1.2.0-SHA256.txt).

## Gerçek cihaz, insan ve mağaza kapıları

- Q13, Q15, Q16, Q19, Q22, Q27, Q31, Q34, Q43, Q48, Q50, Q56: yeni insanların ilk oturum, ödeme karesi, personel faydası, uzun akış, animasyon ve ses erişilebilirliği ölçülmeli.
- Q58, Q59, Q60, Q63, Q64: güncel AAB ile düşük/orta sınıf Android’de 30–45 dakika; maksimum içerik CPU/GPU; kaynak döngüsü; arka plan/çağrı/döndürme/düşük bellek; hoparlör/kulaklık miks turu.
- Q67, Q68, Q69, Q70: gerçek AdMob kimlikleri, canlı gizlilik URL’si, mağaza Data safety ve kapalı test hesabı; mevcut paket test reklam kimlikleriyle gelir yayını değildir.
- Q73, Q74: doğal kayıttan Sahil, Veranda, ilk devir ve sonsuz hedef kanıtı; oyuncu geri dönüşü ve rakip karşılaştırması ancak aynı sürümle insan örnekleminden sonra.

Bu nedenle paket teknik olarak kontrollü kapalı teste hazır; geniş mağaza yayını kararı gerçek cihaz ve insan kapıları tamamlanmadan verilmemeli.
