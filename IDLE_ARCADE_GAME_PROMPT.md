# ANA PROMPT — Özgün Idle Arcade Market Oyunu (Web, Tek Seferde Yapım)

Aşağıdaki çizginin altındaki metni yeni bir AI kodlama oturumuna (Grok / Claude / Cursor vb.) olduğu gibi yapıştır.

---

## ROLÜN

Sen aynı anda şunlarsın:
- kıdemli oyun tasarımcısı
- full-stack oyun geliştiricisi
- art director / karakter tasarımcısı
- ürün sorumlusu

Görevin: profesyonel seviyede, **özgün** bir **idle arcade market / mini mart** oyununu web için **tek seferde** kurgulayıp **çalışır halde** tamamlamak.

### İnsanın sabitlediği tek çerçeve
- Tür hissi: *My Mini Mart* benzeri idle arcade market operasyonu — **asla birebir kopya değil**
- Tema: **market / mini mart / dükkan** (üret → işle → rafa diz → sat)
- Platform: **önce web** (beğenilirse sonra mobil uygulama düşünülecek)
- Kalite: profesyonel ürün seviyesi, tek seferde oynanabilir tam build

### SENİN tam karar verdiğin her şey
Aşağıdakilerin tamamını **sen** seçer, tasarlarsın ve uygularsın:
- oyun adı ve marka kimliği
- market konsepti, hikâye tonu, lokasyonlar
- görsel stil, renk paleti, ışık, kamera
- **oyuncu karakterinin görünümü** (uygun, sevimli/okunaklı, oyuna özel tasarım)
- **müşteri karakterleri** (çeşitli tipler, kıyafet, siluet)
- **çalışan karakterleri** (rollerine uygun görünüm)
- raflar, istasyonlar, ürünler, ortam prop’ları
- üretim zincirleri, ekonomi sayıları, yükseltmeler
- personel rolleri, olaylar, tutorial metinleri
- UI/UX düzeni ve akışı
- ses tasarımı
- teknik stack (aşağıdaki sınırlar içinde)
- klasör / mimari yapı

İnsana “nasıl görünsün, ne olsun?” diye sorma. **Karar ver ve yap.**

Çıktı: taslak değil, **çalışan, cilalı, oynanabilir ürün**.

---

## ÜRÜN ÖZETİ

### İlham (klon değil)
*My Mini Mart* hissinden ilham al:
- yoğun ama keyifli multitasking döngüsü
- üret → işle → stokla → sat
- işleri otomatikleştiren personel işe al
- kendini ve dükkânı yükselt
- kısa oturum arcade enerjisi + uzun idle ilerleme

**Sert kural:** My Mini Mart isimlerini, sanatını, UI’sini, seviye listesini, metinlerini, markasını veya harita düzenini kopyalama. **Özgün IP** yarat.

### Tür
**Idle Arcade Tycoon / Market Operasyon Simülasyonu**
- Oyuncu aktifken: arcade hareket + etkileşim
- Personel ve sistemler geliştikçe: idle / offline ilerleme
- Net ödül döngüsü: hasat, üretim, stok, kasa, yükseltme, genişleme

### Tema çerçevesi (tek sabit)
Oyun bir **market / mini mart** oyunudur: malların üretildiği/hazırlandığı, rafa dizildiği ve müşteriye satıldığı bir yer.
Bu çerçevenin içindeki her şey (mood, sanat stili, ürünler, harita, ton) **senin kararın**.

### Platform stratejisi
1. **Faz 1 (BU YAPIM):** cilalı **web oyunu** (masaüstü + mobil tarayıcı)
2. **Faz 2 (sonra, onaylanırsa):** mobil uygulama kabuğu (Capacitor / PWA vb.)

Faz 1’i Faz 2’ye uygun kur:
- responsive / dokunmatik öncelikli kontroller
- sadece klavye ile oynanır hale getirme
- modüler sistemler, temiz kayıt
- orta seviye telefon tarayıcısına uygun performans

---

## YARATICI SAHİPLİK

Önce `/docs/DESIGN.md` yaz:
- oyun adı
- kısa pitch
- sanat yönü
- **oyuncu / çalışan / müşteri karakter tasarım notları**
- ana döngü
- ekonomi özeti
- lokasyon planı

Sonra buna göre uygula. Tasarım ile yapım arasında insan onayı bekleme.

### Desteklemesi gereken sistemler
1. ham kaynak üretimi / toplama
2. işleme / üretim istasyonları
3. raf / sergileme / envanter yerleştirme
4. görünür talepli müşteriler
5. kasa / para toplama
6. personel otomasyonu
7. oyuncu hareketi + taşıma kapasitesi
8. yükseltme + genişleme
9. en az bir arcade kaos olayı (hırsız, yoğun saat, arıza, VIP vb. — sen seç)

---

## KARAKTER TASARIMI (ZORUNLU — SEN TASARLARSIN)

Oyundaki **tüm karakterleri sen tasarlarsın**. Hazır generic stickman bırakma.

### Oyuncu karakteri
- Oyuna uygun, akılda kalır, okunaklı bir ana karakter tasarla
- Siluet, kıyafet, renk, kişilik hissi net olsun
- Market işleten birine yakışır görünüm (senin seçeceğin stile göre)
- Taşırken, yürürken, çalışırken görsel olarak anlaşılır olsun

### Çalışanlar
- Her rol için uygun görünüm (kasiyer, stokçu, vb.)
- Birbirinden ve oyuncudan ayırt edilebilsin
- İş yaparken animasyonlu ve canlı dursun

### Müşteriler
- Birden fazla müşteri tipi / varyasyon
- Farklı renk, kıyafet veya siluet ile çeşitlilik
- Alışveriş davranışı görsel olarak okunaklı olsun (yürüme, bekleme, memnun ayrılma vb.)

### Genel karakter kuralı
- Tutarlı bir sanat dilinde olsun (senin belirlediğin stil)
- Profesyonel casual oyun kalitesinde görünsün
- Sadece renkli kutu / hareketsiz mesh olmasın

---

## 3D KARAKTERLER VE ANİMASYON (ZORUNLU)

Bu oyun düz ikon tıklama oyunu değil. Karakterler **3D** olacak, sahnede görünecek, **hareket ederken ve iş yaparken animasyonlu** olacak.

### Render
- Gerçek bir **3D web renderer** kullan (önerilen: **Three.js** + TypeScript + Vite; istersen Babylon.js)
- Kamera: izometrik / yumuşak perspektif / yukarıdan 3D — sen seç; market sahnesi net okunmalı
- Ortam, raflar, istasyonlar ve karakterler 3D (stilize low-poly / chibi / yumuşak cartoon 3D tercih edilir)

### 3D’de bulunması gerekenler
- **Oyuncu** karakteri
- **Çalışanlar**
- **Müşteriler**

### Zorunlu animasyon durumları (gerçek hareket)
**Oyuncu**
- idle (bekleme)
- yürüme / koşma
- taşıma (elde/üstünde ürün görünür)
- etkileşim / çalışma

**Çalışanlar**
- görevler arası yürüme
- istasyon / raf / kasada çalışma döngüsü

**Müşteriler**
- içeri yürüme
- rafta / sırada bekleme
- memnun alım / çıkış
- mümkünse sabırsız / kızgın ayrılma varyantı

**Dünya / istasyonlar**
- boşta / çalışıyor görsel durumları
- ürün alma, rafa dizme, para toplama için net görsel geri bildirim

### Animasyon kalite barı
- Karakterler **canlı** görünsün: vücut hareket etsin, kayan karton olmasın
- İskelet animasyonu, rig, veya kaliteli prosedürel low-poly animasyon — sen seç
- idle ↔ yürüme ↔ taşıma geçişleri akıcı olsun
- Taşınan ürünler ele / karaktere bağlansın
- Ana karakterlerde “poz değişmeden sadece kayan mesh” kabul edilmez

### Performans
Mobil tarayıcı için makul poly / draw call. Instancing, sade materyal, optimize sahne. AAA sinema değil; profesyonel casual bar.

---

## ZORUNLU OYUN SİSTEMLERİ

### 1) Oyuncu
- Market içinde serbest hareket (klavye + dokunmatik; masaüstü ve mobil)
- Görünür taşıma kapasitesi
- İstasyon, raf, müşteri, yükseltme etkileşimi
- Yükseltmeler: hız, taşıma slotu, etkileşim hızı

### 2) Üretim zinciri (derinlik şart)
En az **3 kademe**:
- ham kaynak
- işleme istasyonları
- satılacak bitmiş ürün

Birden fazla ürün hattı. Darboğazlar hissedilsin.

### 3) Market operasyonu
- Bitmiş ürünleri satış noktalarına diz
- Müşteriler gelsin, yol alsın, beklesin, alsın, çıksın
- Para görünsün; toplanabilsin (sonra personelle otomatikleşebilir)
- Boş raf / yavaş kasa / üretim açlığı görünür dert olsun

### 4) Personel / otomasyon
En az şu rolleri işe al / yükselt:
- stokçu / taşıyıcı
- kasiyer
- isteğe bağlı üçüncü rol (sen seç)

Personel **3D’de yürüyüp çalışsın** ve seviye yükseldikçe oyuncu yükünü azaltın.

### 5) Ekonomi ve ilerleme
- yumuşak para (nakit)
- oyuncu / personel / istasyon / raf / müşteri akışı yükseltmeleri
- genişleme (yeni alan, yeni ürün hattı, daha büyük dükkân)
- net hedefler / kilometre taşları / lokasyon tamamlanma ölçeri

### 6) Idle / offline
- otomasyon seviyesine göre offline kazanç
- temiz offline özet penceresi
- makul offline tavan

### 7) Arcade tatmin
- uçan yazılar (para, +ürün)
- yükseltme geri bildirimi
- müşteri ruh hali / bekleme göstergesi
- tatmin edici alma / bırakma / stok geri bildirimi
- en az bir kaos / olay sistemi

### 8) Meta döngü
- en az 1 tam oynanabilir başlangıç marketi (20–40+ dk derinlik)
- ek lokasyon yolu (mümkünse 2. lokasyon da; değilse sağlam unlock + içerik)
- localStorage (veya eşdeğeri) ile kayıt / yükleme

---

## GÖRSEL / ÜRÜN KALİTE BARI

**Gerçekten yayınlanmış casual oyun** gibi dursun; jam prototipi gibi değil.

### Görsel
- senin belirlediğin tutarlı sanat yönü
- özgün 3D karakterler, net siluetler
- bir bakışta okunan market düzeni
- okunaklı ürün ikonları (UI 2D olabilir)
- cilalı HUD: para, hedefler, kapasite, butonlar
- yükseltme, işe alım, offline, ayarlar panelleri

### UI animasyonu
- panel aç/kapa
- buton basışı
- para pop

### Ses (elinden geldiğince)
Mümkünse: alma, satış, yükseltme, buton SFX + sessize alma.
Olmazsa: mute hazır audio manager + hook + güçlü görsel tatmin. Bozuk ses bırakma.

### UX
- kısa, atlanabilir ilk tutorial
- istasyonlar okunaklı
- mobil dostu tıklama alanları
- duraklat / ayarlar
- her zaman görünür bir sonraki hedef veya yükseltme

### Performans
- masaüstü ~60fps hedef
- orta mobil tarayıcıda 30–60 kabul
- müşteri / VFX pool
- 3D sahne optimize

### Kod kalitesi
- modüler sistemler: input, entity, AI/path, ekonomi, save, UI, audio, 3D animasyon
- TypeScript tercih
- gereksiz spagetti yok
- sadece gerekli yerde yorum
- çalıştırma talimatlı README

---

## TEKNİK SINIRLAR

### Zorunlu
- **Web tabanlı**
- modern tarayıcılar
- dokunmatik + fare/klavye
- ilerleme kaydı
- tek repo, tam dosya ağacı
- `npm install && npm run dev` çalışır
- `npm run build` çalışır
- backend zorunlu değil (tamamen client-side)

### Tercih edilen stack (uygun gördüğünü seç)
Önerilen varsayılan:
- **TypeScript + Vite + Three.js**
- isteğe bağlı: tween, basit state modülleri, howler.js
- karakter pipeline: glTF/GLB + animasyon, veya kodla üretilmiş kaliteli low-poly rig — sonuç profesyonel ve animasyonlu olduğu sürece serbest

### Mobil-hazır mimari
- responsive canvas/UI ölçekleme
- safe-area duyarlı yerleşim
- input soyutlama katmanı
- ayar + kayıt izole (sonra Capacitor/PWA sarmalaması kolay olsun)

---

## TEK SEFERDE YAPIM SÜRECİ (ZORUNLU)

**Tek sürekli oturumda** bitir; geride **çalışan 3D web oyunu** bırak.

### Subagent’ları yoğun kullan
En az şu uzmanları parallel/sırayla spawn et:
1. **Oyun Tasarım Lideri** — özgün IP, döngüler, ekonomi, lokasyon
2. **Tech Architect** — klasör yapısı, Three.js mimarisi, save şeması, sistem haritası
3. **Gameplay Engineer** — simülasyon, entity, personel AI, müşteri, ekonomi
4. **3D / Karakter / Animasyon** — oyuncu-müşteri-çalışan tasarımı, animasyon state’leri, ortam, kamera, VFX
5. **UI/UX** — HUD, menüler, tutorial, mobil yerleşim
6. **QA / Denge** — playtest, softlock düzeltme, early-game ayar, save doğrulama

Bunları sen orkestre et. Adımlar arasında insan bekleme. Çıktıları sen birleştir.

### Uygulama sırası
1. DESIGN.md + isim + ana döngü + karakter tasarım kararları
2. Projeyi kur + 3D sahneyi ayağa kaldır
3. Market ortamı + oyuncu hareketi + kamera + idle/yürüme animasyonu
4. Kaynaklar / istasyonlar / taşıma animasyonları
5. Müşteriler + kasa + para
6. Personel otomasyonu (görünür 3D çalışma)
7. Yükseltmeler + ilerleme + hedefler
8. Offline kazanç + kayıt/yükleme
9. Tutorial + cilalama + juice + denge
10. Genişleme / ikinci lokasyon yolu
11. Final QA: açılış, oynanış, save reload, mobil genişlik, animasyonların çalıştığı doğrulama

### Definition of Done (hepsi şart)
- [ ] Oyun kritik console hatası olmadan açılır
- [ ] Kaynak okumadan erken döngü tamamlanabilir
- [ ] **3D oyuncu / çalışan / müşteri hareket ve iş animasyonları çalışır**
- [ ] Personel otomasyonu görünür şekilde işe yarar
- [ ] Yükseltmeler oynanışı anlamlı değiştirir
- [ ] Yenileme sonrası kayıt geri gelir
- [ ] Offline özet çalışır
- [ ] Masaüstü + dar mobil viewport kullanılabilir
- [ ] README’de kurulum + nasıl oynanır var
- [ ] Özgün isim (Mini Mart kopyası değil)
- [ ] Kaos/olay sistemi canlı
- [ ] İlk 10–15 dakikada softlock yok
- [ ] Oyuncu, çalışan ve müşteri görünümleri bilinçli tasarlanmış

---

## İÇERİK MİNİMUMU (BUNLARI ÇIKAR)

- Özgün oyun adı + UI’da logo/wordmark
- 1 tam oynanabilir market lokasyonu, çok adımlı üretim
- ≥ 6 satılabilir ürün tipi (veya eşdeğer derinlik)
- ≥ 4 istasyon/kaynak tipi
- ≥ 2 işe alınabilir personel rolü
- Oyuncu yükseltmeleri (≥ 3 kategori)
- Çok adımlı hedef / görev takipçisi
- Offline ödül
- Ayarlar (sessiz/duraklat/ilerlemeyi sıfırla — onaylı)
- Lokasyon tamamlanma ölçeri veya eşdeğeri
- Animasyonlu 3D oyuncu + çalışan + müşteri
- Senin tasarladığın tutarlı karakter görünümleri

Sanat stilize low-poly / chibi 3D olabilir; **kasıtlı, premium ve tutarlı** olmalı.

---

## ÖZGÜNLÜK VE YASAL

- Ticari oyunlardan asset çalma
- My Mini Mart UI/marka kopyalama
- Ticari marka isimleri kullanma
- Font/SFX lisansına dikkat et; yoksa sistem fontu + sentez ses
- Tasarım ve kod bu oturumun özgün işi olsun

---

## TESLİMATLAR

1. Workspace’te tam web projesi
2. `/docs/DESIGN.md` — isim, market konsepti, sanat yönü, karakter tasarımları, döngüler, sistemler, ekonomi, mobil gelecek notları
3. `README.md` — kurulum, çalıştırma, build, kontroller, özellikler
4. Çalışan dev server girişi
5. Kısa sistem changelog’u

Bitince cevapta şunları yaz:
- oyun adı + tek paragraf pitch
- nasıl çalıştırılır
- ana döngü özeti
- neyi özgün kıldığı
- bilinen sınırlar
- mobil paketleme için sonraki adımlar
- oyuncu / çalışan / müşteri karakter tasarımının kısa tarifi

---

## UYGULAMA TONU

Soft-launch hybridcasual ürün gibi düşün:
- ilk 60 saniye sıkı
- okunaklı hedefler
- sürekli küçük ödüller
- otomasyon fantezisi
- stil sahibi, cilalı, canlı 3D market

**İnsanın sabitlediği çerçeve:** market temalı idle arcade web oyunu + animasyonlu 3D karakterler.
**Geri kalan her şey (içerik, görünüm, karakterler, sistem detayı) senin:** karar ver, kurgula, yap.

## ŞİMDİ BAŞLA

1. Önce tasarım + mimari + 3D/karakter/animasyon subagent’larını başlat.
2. Hemen özgün market oyunu adı, tasarım ve karakter görünümlerine karar ver.
3. Web + 3D projeyi kur.
4. Definition of Done’a kadar insan izni beklemeden uygula.
5. Tarayıcıda çalışan, **3D animasyonlu**, karakterleri tasarlanmış idle arcade market oyununu bırak.

---
