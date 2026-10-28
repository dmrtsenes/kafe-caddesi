# Play Store Yayın Rehberi

> **1.2.0 güncellemesi — 5 Eylül 2026:** Güncel paketler ve test kanıtları [1.2.0 doğrulama raporunda](1.2.0-DOGRULAMA.md). Aşağıdaki 18 Ağustos hesap/mağaza bilgileri tarihsel kayıttır; bu çalışma sırasında hesap durumu yeniden doğrulanmadı. Yerel gizlilik metinleri artık oynanış ve hata kayıtlarını, isteğe bağlı paylaşımı ve ayrı silme düğmesini açıklar. Canlı Google Sites sayfası ayrıca güncellenmelidir. Paketlerde test reklam kimlikleri vardır; bu bir gelir veya mağaza yayını değildir.


Durum: **18 Ağustos 2026.** Bu dosya, Play Console'da ELLE yapılacak her
adımı ve her forma verilecek CEVABI toplar. Politika iddiaları
support.google.com kaynaklarından doğrulandı; doğrulanamayan maddeler
açıkça öyle işaretlendi.

> **Bu sürümdeki büyük değişiklik: oyun artık reklam içeriyor.**
> Önceki rehber "INTERNET izni kaldırıldı, Data safety = veri toplanmıyor"
> diyordu. AdMob eklendiği için o cevapların TAMAMI değişti. Eski cevaplarla
> form doldurmak, beyanla uygulamanın davranışının çelişmesi demektir —
> Play'in en sık uygulama askıya alma sebeplerinden biri.

---

## 0. GİZLİLİK POLİTİKASI — YAYINDA ✔

**Canlı adres:** https://sites.google.com/view/fincan-sokagi-gizlilik

Google Sites üzerinde yayınlandı (hesap: beytugrul571@gmail.com), erişim
"Herkes". Doğrulandı: oturum açmamış bir istemciden çekildiğinde giriş
duvarı çıkmıyor ve AdMob, reklam kimliği, com.fincansokagi.game, iletişim
e-postası, TLS ve İngilizce bölüm sayfada mevcut. Adres, AAB'ye gömülü
`GIZLILIK_URL` ile birebir aynı.

> **Google Sites tuzağı — tekrar düzenlerken dikkat.** Sites editörüne
> JavaScript ile (`execCommand('insertText')`) yazılan metin editörde
> GÖRÜNÜR ve "Drive'a kaydedildi" der, ama Google'ın içerik modeline
> geçmez: yayınlanan sayfa BOŞ çıkar. İlk denemede tam olarak bu oldu.
> Çalışan tek yol: metni panoya koyup metin kutusuna gerçek `Ctrl+V`
> göndermek. Ayrıca editörde `Ctrl+A` yalnızca bulunduğu PARAGRAFI seçer;
> kutunun tamamını değiştirmek için kutuyu silip yenisini açmak gerekir.
>
> Her düzenlemeden sonra **yayınlanan** sayfayı ayrı bir istemciden kontrol
> et — taslakta doğru görünmesi yayında doğru olduğu anlamına gelmiyor.

Sayfanın kaynağı depoda iki biçimde: `docs/gizlilik-politikasi.html`
(HTML sürümü) ve `docs/gizlilik-politikasi-google-sites.md` (Sites'a
yapıştırmalık düz metin). İkisi ayrışmasın.

## 1. İmzalama — TAMAM

- Yükleme anahtarı: `android/upload-keystore.jks` (alias `fincan-upload`,
  RSA 2048, 10.000 gün).
- Parolalar `android/key.properties` içinde (git'e girmez).
- `android/app/build.gradle` release'i `key.properties` varsa otomatik
  imzalar; dosya yoksa İMZASIZ üretir ve Play reddeder.
- Derleme: `npm run android:release`
  → `android/app/build/outputs/bundle/release/app-release.aab`

**MUTLAKA yap:** `upload-keystore.jks` + `key.properties` dosyalarını
bilgisayar dışında iki ayrı yere yedekle. Play Console'da uygulamayı
oluştururken **Play App Signing**'i kabul et (varsayılan) — böylece bu
anahtar yalnızca "yükleme anahtarı" olur.

## 2. Gizlilik politikasını barındır — 5 DAKİKA

Sayfa hazır ve AdMob'a göre baştan yazıldı: `docs/gizlilik-politikasi.html`
(TR + EN, toplanan veri tablosu, Google linkleri, reklam kimliği sıfırlama,
saklama/silme, iletişim).

**Google Sites ile** (önceki uygulamalarda kullanılan yol):

Google Sites ham HTML kabul etmediği için içerik editöre metin olarak
girilir. Yapıştırmalık düz metin sürümü ve adım adım yönerge:
**`docs/gizlilik-politikasi-google-sites.md`**

Özet: sites.google.com ▸ boş site ▸ başlık `Kafe Caddesi — Gizlilik
Politikası` ▸ metni yapıştır ▸ Yayınla ▸ adres `fincan-sokagi-gizlilik`.

> ⚠ **Yayınlarken erişimi "Anyone" / "Herkese açık" yap.** Google Sites
> siteyi kısıtlı bırakabiliyor; o hâlde Play'in inceleme ekibi giriş
> duvarına çarpar ve uygulama REDDEDİLİR. Yayınladıktan sonra adresi
> **gizli sekmede** açıp giriş istemediğini gör — 10 saniyelik bu kontrol
> ret sebeplerinin en sıkını kapatır.

Şartlar (Play User Data politikası): aktif, herkese açık, coğrafi engelsiz,
**PDF olmayan**, ziyaretçinin düzenleyemediği bir URL. Yayınlanmış ve
herkese açık bir Google Sites sayfası hepsini karşılar.

Adres alındıktan sonra iki yere yazılır:
- `src/ui/Panels.ts` içindeki `GIZLILIK_URL` sabiti,
- Play Console ▸ App content ▸ Privacy policy alanı.

Sonra **AAB yeniden derlenir** (§0).

## 3. Play Console — uygulama OLUŞTURULDU ✔

18 Ağustos 2026'da oluşturuldu.

| Alan | Değer |
|---|---|
| Uygulama adı | `Kafe Caddesi: Kafe Oyunu` (25/30) |
| Paket adı | `com.fincansokagi.game` |
| Varsayılan dil | Türkçe – tr-TR |
| Tür | Oyun |
| Fiyat | Ücretsiz (geri alınamaz) |
| Durum | **Taslak** |
| Uygulama kimliği | `4975963415461412528` |

Console adresi:
`play.google.com/console/u/0/developers/7814289071662799482/app/4975963415461412528/app-dashboard`

> **Console gezinme notu:** `/app-content/<form>` biçiminde doğrudan URL'ler
> uygulama listesine YÖNLENDİRİYOR; yalnız `/app-content/privacy-policy`
> çalıştı. Diğer formlara Kontrol paneli ▸ "Oyununuzun kurulumunu
> tamamlayın" ▸ "Görevleri görüntüle" listesinden TIKLANARAK gidilir.

### 12 TEST KULLANICISI / 14 GÜN — GEREKİYOR (Console'da doğrulandı)

Hesapta üretimde 2 uygulama olması **muafiyet sağlamıyor.** Dashboard ▸
Üretim bölümü birebir şunu listeliyor ve "Üretime başvur" düğmesi
**devre dışı**:

- Kapalı test sürümü yayınlayın
- En az **12 test kullanıcısının** kapalı testinize kaydolmasını sağlayın
  (*An itibarıyla 0 test kullanıcısı kayıtlı*)
- En az 12 test kullanıcısıyla **en az 14 gün** boyunca kapalı test yapın

Ayrıca kapalı test görevleri de kilitli: "Kapalı test başlatmak için
oyununuzun kurulumunu tamamlayın" — yani önce §4'teki App content
formları ve mağaza girişi bitmeli.

**Sıra:** kurulumu bitir → Dahili test (anında, incelemesiz, cihazda dene)
→ Kapalı test + 12 tester × 14 gün → üretime başvur → dünya geneli dağıtım.

## 4. App content — her formun cevabı

Play Console ▸ **Policy and programs ▸ App content**. Sırayla:

**İLERLEME — 3/11 tamam** (18 Ağustos 2026, Console'da doğrulandı):

| ✔ | Form | Girilen cevap |
|---|---|---|
| ✔ | Privacy policy | `https://sites.google.com/view/fincan-sokagi-gizlilik` |
| ✔ | Reklam | **Evet, uygulamam reklam içeriyor** |
| ✔ | Oturum açma bilgileri | **Hayır** (kısıtlanmış bölüm yok) |

Kalan 8: İçerik derecelendirme · Hedef kitle · Veri güvenliği · Resmi kurum
uygulamaları · Finans ile ilgili özellikler · Sağlık · Uygulama kategorisi ve
iletişim · Mağaza girişi.

> **Console gezinme — çalışan yol.** Formlara girişin TEK güvenilir yolu:
> `.../app-content/overview` sayfasındaki **"Beyanı başlat"** düğmeleri.
> Doğrudan URL denemeleri (`/app-content/ads`, `/app-content/app-access`)
> uygulama listesine YÖNLENDİRİYOR. Doğrulanmış gerçek slug'lar:
>
> - `app-content/overview` → beyan listesi
> - `app-content/privacy-policy`
> - `app-content/ads-declaration`
> - `app-content/testing-credentials` → "Oturum açma bilgileri"
>
> Kaydettikten sonra sayfanın altında **"Değişiklik kaydedildi"** yeşil
> bildirimi çıkar; çıkmadıysa kayıt olmamıştır.

| # | Form | Cevap |
|---|---|---|
| 1 | **Privacy policy** | §2'deki URL |
| 2 | **Ads** | **Yes, my app contains ads** — test kimliğiyle bile SDK reklam gösteriyor. Mağazada "Contains ads" rozeti çıkar. |
| 3 | **App access** | All functionality is available without special access (giriş/şifre yok) |
| 4 | **Content ratings (IARC)** | Kategori: **Game**. Şiddet/cinsellik/madde/kumar → hepsi **No**. "Simüle kumar" sorusuna dikkat: oyunda kumar YOK → No. **Reklam içeriyor mu → Yes.** **Kullanıcı verisi paylaşılıyor mu → Yes** (AdMob). Beklenen sonuç: PEGI 3 / Everyone. |
| 5 | **Target audience and content** | Yaş grupları: **13-15, 16-17, 18+**. **12 ve altını SEÇME** — Families politikası devreye girer ve yalnızca Families-sertifikalı reklam ağıyla reklam gösterebilirsin. "Mağaza kaydınız çocuklara hitap ediyor mu" → **No.** |
| 6 | **News apps** | No |
| 7 | **COVID-19 contact tracing** | No |
| 8 | **Data safety** | §5'teki tablo |
| 9 | **Government apps** | No |
| 10 | **Financial features** | **No** — ama formu MUTLAKA doldur. 30 Ekim 2025'ten beri finansal özelliği OLMAYAN uygulamalar için de zorunlu; doldurulmadan güncelleme yayınlanamıyor. |
| 11 | **Health apps** | **No** — bu da zorunlu, aynı sebeple. |
| 12 | **Advertising ID** | **Yes, kullanıyor.** Amaçlar: **Advertising or marketing**, **Analytics**, **Fraud prevention, security and compliance**. (Google Mobile Ads SDK `AD_ID` iznini manifest'e kendisi merge eder.) |

**Gerekmeyenler:** Permissions Declaration Form (hassas izin yok, yalnız
INTERNET) · Age-Restricted Content (flört/kumar yok) · Anonymous chat
(sohbet yok).

**AI beyanı:** uygulama düzeyinde bir AI formu yok. Ama Play Console
görsel yüklerken "AI ile üretildi mi" onay kutusu çıkarsa: feature graphic
ve ekran görüntüleri **kodla üretildi** (SVG→PNG ve oyun motoru renderı),
üretken yapay zekâ ile değil.

## 5. Data safety — birebir işaretlenecekler

Kaynak: Google'ın kendi beyan tablosu
(developers.google.com/admob/android/privacy/play-data-disclosure).

| Play veri türü | Collected | Shared | Amaçlar |
|---|:--:|:--:|---|
| **Device or other IDs** | Evet | **Evet** | Advertising or marketing · Analytics · Fraud prevention, security |
| **App activity ▸ App interactions** | Evet | **Evet** | Aynı üçü |
| **App info and performance ▸ Crash logs** | Evet | **Evet** | Aynı üçü |
| **App info and performance ▸ Diagnostics** | Evet | **Evet** | Aynı üçü |

Güvenlik soruları:

- *"Is all of the user data collected by your app encrypted in transit?"*
  → **Evet.** Google: Mobile Ads SDK'nın topladığı tüm veri TLS ile şifrelenir.
- *"Do you provide a way for users to request that their data is deleted?"*
  → **Evet.** Gizlilik politikasında iletişim e-postası var ve 30 gün içinde
  yanıt taahhüdü yazılı.

**IP adresi notu:** Play'in taksonomisinde bağımsız bir "IP address" kutusu
yok; Google kendi tablosunda ayrı satır olarak veriyor. Konum tabanlı
hedefleme kullanılmadığı için "Approximate location" işaretlemeye gerek
yok, IP "Device or other IDs" altında kapsanmış sayılıyor. **DOĞRULANAMADI:**
Google bunun formda hangi kutuya düştüğünü açıkça yazmıyor. Muhafazakâr
olmak istersen "Approximate location → Collected + Shared" eklemek güvenli
taraftır.

**Oyunun kendi kaydı beyan edilmez:** cihazda kalıyor, dışarı çıkmıyor —
Play "collected" tanımını cihazdan ÇIKAN veri olarak yapıyor.

## 6. Store listing — varlıklar ve metinler

Metinlerin tamamı: **`docs/magaza-metinleri.md`** (uzunluklar
`node tools/metin-olc.mjs` ile ölçüldü, hepsi sınır içinde).

| Varlık | Şart | Dosya | Durum |
|---|---|---|---|
| Uygulama simgesi | 512×512, **32-bit PNG (alpha'lı)**, ≤1024 KB | `cikti/magaza/store-icon-512.png` | ✔ |
| Feature graphic | 1024×500, JPEG veya **24-bit PNG (alpha YOK)** | `cikti/magaza/feature-graphic.png` | ✔ |
| Telefon ekran görüntüsü | **en az 2**, 4-8 önerilir; kenarlar 320-3840 px; uzun kenar kısa kenarın 2 katını aşamaz | `cikti/magaza/ss-1…5-*.png` (1080×1920) | ✔ 5 adet |
| 7"/10" tablet karesi | **ZORUNLU DEĞİL** | — | atlanıyor |
| Tanıtım videosu | **ZORUNLU DEĞİL** | — | atlanıyor |

Alpha kuralı iki yönlü: **simge alpha'lı OLABİLİR, feature graphic ve ekran
görüntüleri OLAMAZ.** Üreticiler bunu zorluyor (`removeAlpha()`), yine de
yüklerken Play'in uyarı vermediğini gör.

Tablet karesi koymamanın bedeli: büyük ekran koleksiyonlarında ve öne
çıkarmalarda gösterilmeye uygun olmuyorsun. Yayın engeli değil, görünürlük
kaybı.

## 7. Sürüm ve ülke seçimi

- **Track:** İç test (Internal testing) → anında yayına girer, inceleme
  beklemez, 100 test kullanıcısına kadar. Gerçek cihazda duman testi için
  en hızlı yol. Sonra Production'a terfi ettirilir.
- **versionCode:** her yüklemede +1 (`android/app/build.gradle`). Şu an `2`
  (oyun sürümü `1.1.0`).
- **Ülkeler:** Play'de ülke kapsamı **istediğin an, yeni inceleme olmadan**
  genişletilebilir. Arayüz şu an yalnızca Türkçe; İngilizce lokalizasyon
  gelmeden geniş açmak, oyunu anlamayan kullanıcıdan düşük puan almak
  demektir ve erken puan sinyalini geri almak zordur.

## 8. Yükleme sonrası — atlanmaması gerekenler

1. **Android developer verification / paket adı kaydı.** 15 Temmuz 2026
   duyurusu: Play'deki tüm uygulamalar Console'da kayıtlı olmak zorunda;
   son tarih **30 Eylül 2026**. Google uygulamaların çoğunu otomatik
   kaydetti. Yayından sonra Console ▸ **Home** sayfasında yeni paket adının
   kayıtlı göründüğünü doğrula.
2. **Gerçek cihaz duman testi:** soğuk açılış, kayıt/yükleme, bildirim
   ikonu (beyaz kare değil fincan görünmeli), geri tuşu, ayarlardaki
   gizlilik bağlantısının açılması, ödüllü reklamın gerçekten açılıp ödül
   vermesi.
3. **600dp+ tablet/katlanabilir kontrolü:** targetSdk 36'da sistem dikey
   kilidi yok sayıyor. Manifest'e `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY`
   eklendi (§9), ama gerçek tablette doğrula. Bu opt-out API 37'de kalkacak.

## 9. Teknik durum — doğrulanmış

| Konu | Durum |
|---|---|
| targetSdk | **36** — 31 Ağustos 2026 şartı tam olarak bu; ek işlem yok |
| minSdk | 24 — Play'in alt sınır politikası yok |
| 16 KB sayfa boyutu | **İlgilendirmiyor** — AAB'de `.so` sayısı **0** (ölçüldü: `unzip -l` ile native kitaplık yok) |
| Dikey kilit (tablet) | Manifest'e `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY` eklendi |
| İmzalama | Yapılandırıldı, release AAB imzalı üretiliyor |
| Avrupa rızası (UMP) | Kodda entegre — `src/core/AdMobProvider.ts` `requestConsentInfo` + `showConsentForm` |
| Uygulama içi politika bağlantısı | Ayarlar paneline eklendi (`GIZLILIK_URL`) — **adres doldurulmayı bekliyor** |

## 10. Reklamlar — bilinçli olarak TEST kimlikleriyle çıkılıyor

Şu an `src/core/AdMobProvider.ts` Google'ın herkese açık **test** birimlerini
kullanıyor (`ca-app-pub-3940256099942544/…`) ve manifest'teki App ID de
Google'ın test App ID'si.

**Bunun bedeli, bilerek kabul edildi:**

- Kullanıcı **"Test Ad" etiketli** reklam görür.
- **Gelir sıfırdır** — demo birimler hesaba gösterim/tıklama/gelir yazmaz.
  ABD gibi yüksek eCPM'li pazarlara açılmak da bunu değiştirmez.
- Google'ın kendi dokümanı *"yayınlamadan önce bu kimlikleri kendi
  kimliğinle değiştir"* diyor (developers.google.com/admob/android/test-ads).
- Play politikasında bunu **yasaklayan bir madde bulunamadı**; reklamlar
  "Test Ad" etiketli olduğu için "yanıltıcı reklam" da sayılmıyor.
  **DOĞRULANAMADI:** Play tarafında emsal bir ret vakası bulunamadı; Apple
  tarafında bu gerekçeyle ret örneği var.
- **Beyan yükü hiç hafiflemiyor:** test kimliğiyle de SDK aynı veriyi
  topluyor. §4 ve §5'teki tüm cevaplar aynen geçerli.

**Gerçek kimliğe geçerken** (yeni sürüm gerektirir):
1. admob.google.com ▸ uygulama kaydı → App ID + ödüllü ve geçiş reklamı
   birim kimlikleri.
2. Derleme ortamına `ADMOB_APP_ID`, `VITE_ADMOB_REWARDED_ID`,
   `VITE_ADMOB_INTERSTITIAL_ID` ve `VITE_ADMOB_MODE=production` değerlerini
   gir. Kod değiştirmeden üretim reklamına geçilir; bu değerler yokken oyun
   güvenli biçimde Google test kimliklerini kullanır.
3. AdMob'da **"European regulations message"** oluştur — EEA/UK/İsviçre
   kullanıcılarına kişiselleştirilmiş reklam göstermek için Google onaylı
   CMP zorunlu (16 Ocak 2024'ten beri). Kod tarafı hazır, eksik olan
   AdMob panelindeki mesaj tanımı.
4. AdMob'da ödeme ve vergi profilini doldur (Play'den bağımsız).
5. `docs/app-ads.txt.example` dosyasındaki yayıncı kimliğini doldurup
   geliştirici sitesinin kökünde `app-ads.txt` olarak yayınla.
6. versionCode +1 → yeni AAB.

Gerçek cihaz kabul turu için tek kaynak: **`docs/CIHAZ-TEST-LISTESI.md`**.
Bu liste tamamlanmadan AAB üretim kanalına terfi ettirilmez.

## 11. Sonraki sürüm için biriken işler

- **İngilizce lokalizasyon.** Arayüz ve veri dosyalarında ~450 satır Türkçe
  metin var, dil tablosu yok. Global pazara açılmanın ön şartı bu — gerçek
  AdMob kimlikleriyle birlikte yapılırsa ABD/AB trafiği anlamlı hale gelir.
- **Tablet ekran görüntüleri** — büyük ekran görünürlüğü için.
- **`minifyEnabled true` + `shrinkResources true`** — paketten ~700 KB
  kırpar; açmadan önce cihazda duman testi şart.
- **Marka tescili** — "Kafe Caddesi" hiçbir sınıfta tescilli değil; 9. ve
  41. sınıf başvurusu düşünülebilir.

## 9. Mağaza görselleri — otomasyon tıkanıklığı (18 Ağustos, ikinci oturum)

**Durum: App content 10/11 tamam** (kategori+iletişim de bitti). Kalan tek
madde **"Mağaza girişinizi oluşturun"** — metinler (ad/kısa/uzun açıklama)
GİRİLDİ ve **Taslak olarak Kaydet ile güvenceye alındı**. Görseller
(uygulama simgesi HARİÇ) yüklenemedi.

**Gözlem:** `store-icon-512.png` (512×512, **kare**, kırpma gerektirmeyen
tek varlık) her denemede sorunsuz yüklendi. `feature-graphic.png` (1024×500),
onun 2× büyütülmüş hali, JPEG'e çevrilmiş hali, sıkıştırmasız hali ve
ekran görüntüleri (1080×1920) — **hepsi** Play'in medya kitaplığında
"Bu resim çok küçük olduğundan seçilemiyor veya kırpılamıyor" hatasıyla
reddedildi. Dosya metadata'sı temiz (RGB, alpha yok, sRGB, 8-bit) —
sorun dosya içeriği değil.

**Çalışma teorisi:** Bu oturumdaki tarayıcının `devicePixelRatio` değeri
**1.5** (Windows %150 ölçek) — tam sayı değil. Play'in kırpma/doğrulama
aracı muhtemelen bir canvas/offscreen-canvas render adımı kullanıyor ve
kesirli DPR'de bu adım (yalnızca KARE OLMAYAN, yani gerçekten kırpma
isteyen varlıklarda) başarısız oluyor. `resize_window` pencere boyutunu
değiştirebildi ama DPR'yi değiştiremedi (işletim sistemi seviyesi ayar).

**Denendi ve işe yaramadı:** 2× boyut, JPEG dönüşümü, sıkıştırmasız PNG,
sayfa yenileme, "tıkla→ESC→bul→yükle" sırasını birebir tekrarlama
(store-icon'da işe yarayan yöntem), farklı pencere boyutu.

**Sonraki oturumda denenecek / kullanıcının yapabileceği:**
1. Windows ekran ölçeğini geçici olarak %100'e çekip tekrar dene (DPR=1
   olunca kırpma aracı çalışabilir).
2. Gerçek (otomasyon dışı) bir Chrome penceresinden aynı görselleri
   sürükle-bırak ile yükle — dosyalar hazır: `cikti/magaza/` altında
   (`feature-graphic.png`, `ss-1-siparis.png` … `ss-5-ekip.png`).
3. Kırpma modalını açıp (dosyaya tıkla → kırp ikonu) crop dikdörtgenini
   FARE İLE gerçekten sürükleyip bırakmayı dene — programatik "Kopya
   olarak kaydet" tek başına yetmiyordu, gerçek bir sürükleme olayı
   farklı davranabilir.

**Güncelleme (aynı oturum, DPR düzeltmesi sonrası):** Kullanıcı Windows
ölçeğini %150'den %100'e çekti, `devicePixelRatio` 1→1.5'ten 1'e düştü.
Sonuç **değişmedi** — tam 1024×500 boyutundaki her görsel hâlâ reddediliyor,
**Play'in kendi kırpma aracının ürettiği kopya dahil**. Yani DPR teorisi
YANLIŞ ya da tek başına yeterli değil. Gerçek neden hâlâ belirsiz.

**Denenip elenen:** DPR=1 altında feature-graphic.png yeniden yüklendi
(yasaklı) · 2048x1000 → Play'in "Özellik grafiği" preset'iyle kırpıldı,
sonuç 1024x500 (yasaklı) · 1536x750 (2:1 oranı korunmuş, kırpma
gerektirmeyen boyut) → kütüphanede geçici olarak "kırp" ikonuyla belirdi
ama seçilmeye çalışıldığında "çok küçük" hatası tekrar çıktı, checkbox
işaretlenemedi.

**Yeni gözlem:** store-icon-512.png (kare, 512x512) HER ZAMAN sorunsuz.
Kare olmayan HİÇBİR varlık (feature graphic, ekran görüntüleri) bu
oturumda hiçbir varyasyonla kabul edilmedi. Bu, dosya/DPR değil,
**"kırpma gerektiren görsel türü" ile ilgili bir arka uç sorunu**
olduğunu düşündürüyor — Claude in Chrome eklentisi bağlamında mı,
yoksa o an Play'in görsel işleme servisinde geçici bir sorun mu
olduğu belirsiz. Bir sonraki oturumda önce store-icon dışında BAŞKA
bir kare görsel (örn. 1024x1024) deneyerek "sadece kare çalışıyor"
teorisini doğrulamak/çürütmek faydalı olur.

## 10. Kapalı test kurulumu — 11/11 tamamlandı, tek eksik: test listesi

**App content 11/11.** Mağaza girişi kullanıcının kendi Chrome'undan
(otomasyon dışı) görselleri sürükle-bırak ile yükleyerek tamamlandı —
otomasyon ortamındaki görsel doğrulama engeli gerçek bir tarayıcıda
sorun çıkarmadı; kök neden hâlâ belirsiz ama artık önemsiz.

**Kapalı test — Alpha kanalı hazır:**
- 8 ülke hedeflendi: Türkiye, Almanya, Hollanda, Avusturya, Belçika,
  Fransa, Azerbaycan, Kıbrıs (KKTC ayrı ülke kodu olarak yok).
- AAB yüklendi (`cikti/FincanSokagi-v1.0-release.aab`, versionCode 1,
  targetSdk 36 doğrulandı) ve **taslak olarak kaydedildi**
  (henüz incelemeye gönderilmedi).
- Sürüm notları TR+EN girildi (`<tr-TR>…</tr-TR><en-US>…</en-US>` formatı).
- 2 zararsız uyarı: "henüz test kullanıcısı yok" (beklenen) ve
  "proguard kod gösterme dosyası yok" (minifyEnabled false, geçersiz).

**TEK KALAN ADIM:** Test kullanıcıları listesi (`kapali-test-fincan-sokagi`
adıyla oluşturulmaya başlandı ama e-postalar henüz eklenmedi — kullanıcı
12 kişiyi henüz toplamadı). Kullanıcı e-postalarını verince:
1. Kapalı test ▸ Alpha ▸ Test kullanıcıları ▸ E-posta listesi oluşturun
   (veya var olan taslağı tamamla) ▸ en az 12 e-posta ekle ▸ Kaydet.
2. Sürüm sayfasına dön ▸ "Yayınlama özeti sayfasına git" ▸ incelemeye gönder.
3. 14 günlük sayaç, testerlerin **davet linkine tıklayıp katıldığı** andan
   itibaren işler — sadece listede olmak yetmez.

**Dikkat — mevcut hesapta ilgisiz e-posta listeleri var:** "lisans" (1 kişi)
ve "pomodoro test listesi" (23 kişi) başka uygulamalardan kalma; bu oyunun
testine dahil ETME — o kişiler bu oyunu test etmeyi kabul etmedi.

## 11. Reklam Kimliği beyanı (Android 13+ zorunlu, ayrı bir form)

**App content'teki "Advertising ID" beyanından FARKLI bir form** —
"Yayın özeti" sayfasında "1 sorun bulundu" olarak çıkar, App content
formu tamamlanmış olsa bile ayrıca doldurulması gerekir.

**Kritik netleştirme:** Bu form "AdMob App ID'nizi girdiniz mi" SORMUYOR;
"cihazın reklam kimliğine (GAID) erişen bir SDK var mı" soruyor. Google'ın
kendi form metni: *"Manifest dosyanızda com.google.android.gms.permission.
AD_ID izni yer alıyor. Yani uygulamanız reklam kimliği kullandığını beyan
ediyor. Bu soruyu 'Evet' olarak yanıtlayın."* — AdMob SDK'sı TEST kimlikleriyle
çalışıyor olsa bile bu izin manifestte otomatik var, cevap **her zaman
Evet**. Gerçek AdMob App ID'sinin girilip girilmediğiyle ilgisi yok.

Cevap: **Evet** → amaçlar: **Analiz, Reklam veya pazarlama, Sahtekarlığı
önleme/güvenlik/kanunlara uygunluk** (Data Safety formundakiyle tutarlı).

Erişim: Yayın özeti sayfası ▸ "1 sorun bulundu" ▸ Beyan formunu doldurun
(URL deseni: `app-content/ad-id-declaration?source=publishing-overview`).
