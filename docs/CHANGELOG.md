# Sistem Changelog — KAFE CADDESİ

Sistemler hangi sırayla kuruldu, neden öyle kuruldu ve sonradan neyi düzeltmek gerekti.

---

## 1. Çekirdek iskelet

| Sistem | Dosya | Not |
|---|---|---|
| Olay yolu | `core/EventBus.ts` | Tipli yayın/abone. Sim → UI → ses arasındaki tek gevşek bağ. |
| Matematik | `core/MathUtils.ts` | Kare hızından bağımsız `damp`, Türkçe para/süre biçimleyici. |
| RNG | `core/Rng.ts` | mulberry32; görsel çeşitlilik için tohumlanabilir. |
| Kayıt | `core/SaveManager.ts` | Sürümlü `localStorage` adaptörü. Faz 2'de tek dosya değişimiyle Capacitor'a geçer. |
| Ayarlar | `core/Settings.ts` | İlerlemeden ayrı saklanır — sıfırlama ayarları silmez. Düşük güçlü cihazda kaliteyi otomatik düşürür. |

## 2. Veri katmanı — tek gerçek kaynak

`data/` altındaki dosyalar oyunun tamamını tanımlar: ürünler, istasyonlar, mekân düzeni, yükseltmeler, personel, müşteri arketipleri, hedefler ve merkezî `BALANCE`. Sim, görsel ve arayüz bunları okur; yeni bir ürün veya istasyon eklemek tek satırlık iştir.

## 3. Simülasyon

- **`sim/Station.ts`** — tek sınıf, yedi davranış: depo, hazırlık, vitrin, sipariş tezgâhı, masa, kova, tuvalet. Ortak olan her şey (yükseltme, kapasite, yaklaşma noktaları, rezervasyon) burada.
- **`sim/Navigation.ts`** — 0,5 birimlik ızgara üstünde A*, ikili yığın, görüş hattıyla yol düzleştirme, eksen ayrıştırmalı `slideMove`.
- **`sim/World.ts`** — bir şubenin tüm simülasyonu: müşteri yapay zekâsı, sipariş akışı, personel görev seçimi, tezgâhlar, bölge kilitleri, hijyen.
- **`sim/GameState.ts`** — kalıcı durum; görsel hiçbir şey içermez, bu yüzden kayıt/yükleme önemsiz.
- **`sim/Goals.ts` · `Events.ts` · `Offline.ts` · `Tutorial.ts`** — hedef zinciri, kaos olayları, offline kazanç, ilk deneyim.

## 4. Sunum

- **`chars/`** — kod ile üretilen eklemli rig + prosedürel animatör. Dış varlık yok.
- **`world/`** — `Materials.ts` paylaşılan önbelleği (draw-call bütçesinin anahtarı), sahne, mimari, istasyon/raf görselleri, VFX.
- **`ui/`** — saf DOM. `three`'yi veya simülasyonu hiç import etmez; tek sözleşme `ui/api.ts`.
- **`audio/`** — WebAudio ile çalışma anında sentez. Sıfır ses dosyası.

---

## Sonradan düzeltilenler

Bu bölüm, playtest ve yük testinin ortaya çıkardığı gerçek hataları kaydeder.

### Animasyon

- **Gövde eğimi ters işaretliydi.** Aşağı sarkan uzuvlarda negatif `rotation.x` öne salınım demek; yukarı bakan gövde/kafada ise POZİTİF öne eğilme demek. Aynı işaret her ikisine uygulanınca karakter koşarken kafasını geriye atıyordu — ölçümle doğrulandı: kafa gövde merkezinin **53 cm arkasındaydı**. Tüm duruşlarda işaret düzeltildi.
- **Adım kadansı fizikselden hesaplanıyordu ve çizgi film oranlarında patlıyordu.** Chibi bacak boyu boyun ~%31'i olduğu için 6,2 birim/sn saniyede 5,5 çevrim istiyordu — 60 fps'te çevrim başına 11 kare, yani stop-motion. Kadans `[0,75 · 2,7]` çevrim/sn'ye sınırlandı (çevrim başına 22 kare), karşılığında bir miktar ayak kayması kabul edildi.
- **Diz ve dirsek eğrileri yarım dalga kırpılmıştı** (`max(cos,0)`), tepe noktasında türev sıçratıp uzvu "klikletiyordu". C1 sürekli, yükseltilmiş kosinüs karesine geçildi.
- **Zemin çözücüsünün kaldırması gövdeyi zıplatıyordu.** Eğim `bob` (pivotu yerde) yerine gövdeye taşındı, kaldırma anında uygulanıp yavaş bırakılır oldu; dikey sıçrama **0,150 → 0,040**'a indi.

### Dolaşım ve hitbox

- **Izgara engeli gerçek gövdeden büyüktü.** `blockRect` en yakın hücreye yuvarlıyor, her kenardan yarım hücre fazla yazıyordu: 2,3 birimlik istasyon 3,3 birimlik görünmez duvara dönüşüyordu. Merkez-içeride testine geçildi.
- **Oyuncu çarpışma yarıçapı 0,45'ti** (görsel genişlik ~0,55). 0,32'ye indirildi.
- **Raflar arası geçit 0,4 birimdi** — oyuncu 0,64 geniş, yani fiilen duvar. Raf ayak izi daraltılıp aralıklar açıldı: **geçit 1,4 birim**.
- **Koridor garantisi eklendi:** ana ve ön koridor bantları her navigasyon kurulumunun sonunda koşulsuz açılır; yerleşim hatası haritanın yarısını erişilemez bırakamaz.
- **`World.validateLayout()`** eklendi: taşma ile her istasyon/sandalye/kasa sırası/kapı erişilebilirliğini kanıtlar, koridor darlığını ölçer.

### Ekonomi ve yapay zekâ

- **Müşteri doğuş hızı açık raf SAYISINA bağlıydı, üretim kapasitesine değil.** Yedi raf açıkken 4 dakikada ~140 müşteri geliyor, üretim ancak ~45 ürün yetiştiriyordu; gelenlerin çoğu boş rafla karşılaşıp kızgın çıkıyor ve itibar **60 → 1**'e çöküyordu. Doğuş artık **dolu raf sayısına ve toplam stoka** bağlı: dolu vitrin müşteri çeker, boş dükkân çekmez. Kendi kendini dengeleyen geri besleme.
- **Müşteriler hiç üretilmemiş ürünü isteyebiliyordu.** İstek listesi artık rafta stoğu olanlardan seçilir; rafın arada boşalması hâlâ mümkün ve asıl gerilim orada.
- **Taşıyıcılar zincirin ortasını aç bırakıyordu.** Yalnızca ürün değerine göre puanlama, sütün tamamını pahalı kahve/pasta hattına yönlendiriyordu: 76 süt üretilip yalnızca 4 peynir çıkıyordu. Değer ağırlığı bastırıldı (0,8–2,4) ve **çalışamayan istasyona büyük öncelik bonusu** eklendi.
- **Önünde müşteri bekleyen raf** artık öncelikli: o rafa giden kasa doğrudan bir satışa ve kaçınılmış bir kızgınlığa dönüşür.
- **Kasiyeri olmayan kasa nakit tavanında tıkanıyordu** ve sıradakiler sabırları bitene kadar bekliyordu. Taşıyıcılar tıkanmak üzere olan kasayı her işten önce boşaltır; müşteriler tıkalı kasaya sıraya girmez.
- **Kasa yönü tersti:** müşteriler tezgâhı geçip arkasında sıraya giriyordu. Sıra mağazanın içine doğru uzatıldı, kasiyer çıkışa sırtı dönük tezgâhın arkasına alındı.

**Yük testi sonucu (tüm baylar açık, 4 dakika):**

| Personel | Satış | Kızgın | İtibar | Kazanç |
|---|---|---|---|---|
| Seviye 0 | 47 | %33 | 26 | ₺3.690 |
| Seviye 4 | 119 | %10 | 85 | ₺10.083 |

Yükseltmeler oyunu ölçülebilir biçimde değiştiriyor.

### Yerleşim

- **Mekân departman baylarına ayrıldı** (FIRIN · MANDIRA · MANAV · KAFE · PASTANE · SERVİS); ilişkili işler aynı baya toplandı.
- **Poğaça hattı FIRIN'den MANDIRA'ya taşındı.** Peynire ihtiyaç duyduğu için fırın bayında dursaydı, MANDIRA açılana kadar asla dolmayan bir raf müşterileri boşuna kızdıracaktı.
- **Giriş başlangıç bayının yanına alındı.** Kapı sağ uçtayken ilk müşteri tek satış için ~37 birim yürüyordu.

---

# v2.0 — MARKETTEN KAFEYE

Oyun bir market tycoon'undan **kafe tycoon'una** çevrildi. Motor (karakter rig'i,
prosedürel animatör, navigasyon, sahne, ses, UI iskeleti) korundu; oynanış,
veri katmanı, mekân ve görsellerin tamamı yeniden yazıldı.

## Neden

Eski döngü "üret → rafa diz → müşteri kendi alır → kasa" idi. Oyuncunun tek
işi lojistikti ve müşteriyle arasında hiçbir bağ yoktu. Kafede döngü
**sipariş → hazırlık → vitrin → MASAYA SERVİS → hesap** oldu: oturan müşteri
gerçek bir zamanlayıcıdır, vitrin dolu olsa bile ürün masaya gitmezse hesap
ödenmez. Bu tek değişiklik oyuna ikinci bir aciliyet eksenini getirdi.

## Yeni sistemler

| Sistem | Dosya | Ne yapar |
|---|---|---|
| Sipariş | `sim/Orders.ts` | Tezgâhta doğan, masada ölen nesne. Satırlar, yaş, tamamlanma anı, oyalanma çarpanı. |
| Zemin kiri | `sim/Spills.ts` + `world/SpillView.ts` | Dökülen içecek ve kırıntı; yürümeyi engellemez, hijyeni düşürür. Mesh havuzuyla çizilir. |
| Sarf zinciri | `sim/Station.ts` (`supply`) | Tuvalet peçete ve kâğıt tüketir; biterse itibar doğrudan yanar. |
| Vitrin | `world/DisplayView.ts` | Barın müşteriye bakan yüzü: ahşap kaide, taş tezgâh, pirinç çerçeveli cam kabin, iki raf, LED şerit. |
| Garson | `sim/World.updateWaiter` | Vitrinden masaya taşır. Kafenin en kritik personeli. |

## Yerleşim

Mekân "departman bayları" yerine **kesintisiz bir BAR HATTI** etrafında kuruldu:
vitrinler ve sipariş tezgâhları tek sıra üstünde, müşteri önünden (+z),
personel arkasından (−z). Bölgeler artık iki türlü: duvarlı mutfak bölmesi
(`bay`) ve açık salon parçası (`hall`). Salonun duvarı, kemeri, tabelası yoktur.

## Soak testinin yakaladığı üç hata

1. **Hijyen asla toparlanmıyordu.** Formül "kir varsa düş, YOKSA toparlan" idi;
   tek bir leke bile toparlanmayı tamamen kapattığı için ölçer 240 saniyede
   kaçınılmaz olarak sıfırlanıyordu — oyuncu mekânı temiz tutsa bile. Toparlanma
   sürekli bir pozitif basınca çevrildi, kir ondan düşülüyor.

2. **Komi 240 saniye bir cepte kilitli kaldı.** SERVİS bölmesinde iki tuvalet
   arasında 0,9 birimlik bir boğaz vardı. `validateLayout` bunu göremiyordu
   çünkü taşma testi "erişilebilir mi" diye soruyor, "geçilebilir mi" diye
   sormuyordu. Tuvaletler alt alta dizildi, sarf deposu bölmeden çıkarıldı ve
   `validateClearances()` eklendi: yan yana her istasyon çiftinin gövde arası
   boşluğu ≥ 1,5 birim olmalı.

3. **Sarf cezası uçurumdu.** "Bir birimden az peçete" tam ceza yazıyordu; altı
   kapasiteli kutuda 0,9 peçete kalmışken bile hijyen çöküyordu. Ceza
   `supplyShortfall` ile orantılı hâle getirildi.

## Denge (5 dakikalık soak, tüm bölgeler açık)

| Ekip | Hijyen | İtibar | Kızgın | Kazanç/dk |
|---|---|---|---|---|
| Komi yok | 0 | 99 | %11 | 12.282 |
| 2 komi | 0 (geç düşüş) | 100 | %12 | 22.372 |
| 3 komi | 100 | 98 | %22 | 14.259 |
| 4 komi (maks) | 100 | 95 | %20 | 17.943 |

Eğri kasıtlı: mekân büyüdükçe temizlik ekibi de büyümeli. Komisiz kafe kazanç
üretmeye devam eder ama hijyen dibe vurur ve müşteri akışı `0,60×`e iner.

## Kayıt

`SAVE_VERSION` 4'e çıkarıldı ve anahtar `fincan-sokagi:save:v4` oldu. Eski
market kayıtları yeni dünyayla hiçbir noktada uyuşmadığı için okunmaz; oyun
temiz başlar.

---

# v3.0 — KURGU DEĞİŞTİ: LOJİSTİK DEĞİL SERVİS

v2.0 marketi kafeye çevirmişti ama iskeleti aynen korumuştu: yanlamasına
uzayan koridor mekân, duvarlı üretim bayları, üç adımlı üretim zincirleri ve
boydan boya vitrin sırası. Sonuç, "kafe boyanmış market"ti — yavaş, dağınık
ve ilk yarım saati sıkıcı. v3.0 iskeleti değiştirir.

## 1. Zincirler kaldırıldı

"Su al → semavere koy → çayı al → vitrine diz" gibi üç adımlı hatların
tamamı gitti. **Her makine girdisiz üretir**: espresso makinesi espresso
verir, fırın kruvasan verir. Ham madde, ara ürün ve girdi tamponu diye bir
şey yok. Oyuncunun zamanı artık istasyonlar arası mekik dokumakla değil,
siparişi masaya yetiştirmek ve mekânı temiz tutmakla geçiyor.

Bunun sonucu olarak **Taşıyıcı rolü de kaldırıldı** (taşıyacak ara ürün
kalmadı); geriye kafeyi gerçekten döndüren dört rol kaldı.

Ürüne özel dokuz vitrin yerine **tek TESLİM BANKOSU**: ne konursa onu
gösteren ortak tampon. Bar artık dokuz özdeş dolaptan oluşan bir duvar değil.

## 2. Mekân yeniden kuruldu

| | v2.0 | v3.0 |
|---|---|---|
| Boyut | 47 × 33 | 30 × 25 |
| Mimari | 6 duvarlı bay + kemer + tabela | tek açık mekân |
| Bar | boydan boya 11 istasyon | 4 istasyon, kısa |
| En uzun yürüyüş | ~30 birim | ~14 birim |
| Kamera | 30 birim, yarısı kadraj dışı | 24 birim, tamamı görünür |

Mutfak artık **açık mutfak**: duvarı yok, makineler arka duvara dizili, bar
onlara sırtını dönüyor. Masalar ızgara değil, salona dağınık yerleştirilmiş.
Zemin gerçek malzeme: salonda ahşap parke, mutfakta karo, terasta deck
(kanvas doku, üç çizim çağrısı).

**Kilitli bölüm artık şantiye değil, brandalı eşya.** Panolar, iskele ve
"YAKINDA" tabelaları gitti; eşya tam yerinde duruyor ama beyaz koruma
brandası altında. Ödeme bitince branda uçuyor. Üstelik yalnızca **SIRADAKİ**
bölüm görünür — sekiz bölümün eşyasını aynı anda brandalayınca mekân beyaz
kutu deposuna dönüyordu.

## 3. Akış: ceza yerine ödül

- İlk açılım **₺150** → oyunun ilk 30 saniyesinde geliyor.
- **Temizlik para kazandırır.** Her bulaşık, leke ve sarf dolumu anında bozuk
  para veriyor; ödül menünün ortalama fiyatına göre ölçeklendiği için geç
  oyunda da anlamlı kalıyor.
- Hijyen bir ceza değil **bonus çarpanı** (0,85–1,25). İtibar tabanı 20;
  ölçer dibi görmüyor, spiral yok.
- Kızgın müşteri cezası 3,0 → 1,2.

Tek oyuncu, personelsiz başlangıç ölçümü (10 dakikalık oturum):

| Dakika | Olay |
|---|---|
| 0:30 | MASALAR açıldı |
| 1:12 | KAHVE — menü 3 ürüne çıktı |
| 2:06 | ilk garson |
| 3:18 | FIRIN — menü 5 ürün |
| 5:00 | SALON |
| 8:02 | komi |
| 10:00 | ₺32.347 · itibar 100 · hijyen 100 · 215 sipariş · 437 servis |

## 4. Soak testinin yakaladığı üç hata

1. **Kuyrukta 33 kişilik hayalet birikmesi.** Sahneden silinen müşteri sıra
   dizisinden çıkarılmıyordu; kuyruğun başı ölü bir nesne olunca tezgâh bir
   daha hiç sipariş almıyor ve arkadaki herkes sırayla küsüyordu. Ayrıca sıra
   uzunluğu sınırsız hesaplandığı için 17. kişinin yeri binanın DIŞINA
   düşüyor, oraya yol bulunamıyordu. Üç yerden birden düzeltildi:
   `releaseCustomerHolds` sıradan da çıkarır, `updateCounters` her karede
   geçersiz kayıtları süpürür, `queueSlot` altıncı kişiden sonra hattı
   yan yana kırar.

2. **Müşteri akışı stoka bağlıydı.** Markette doğruydu (müşteri rafından
   kendi alırdı) ama kafede her siparişi birinin masaya taşıması gerekiyor.
   Makineler dolduğu anda saniyede bir müşteri geliyor, tek garson
   yetişemiyor, gelenlerin %56'sı küsüyordu. Akış artık **servis
   kapasitesine** bağlı: kafe taşıyabileceği kadar müşteri alıyor.

3. **Garson tepsisini salonun tüm talebine göre doldurma denemesi** feci
   sonuç verdi (%100 kızgın): garson makinenin başında tepsi dolsun diye
   bekliyordu. Servis oyununda beklemek en pahalı eylemdir — az yükle,
   çabuk git.

## 5. Kayıt

`SAVE_VERSION` 5, anahtar `fincan-sokagi:save:v5`. Bölge kimlikleri, istasyon
listesi ve şema tamamen değiştiği için eski kayıtlar okunmaz; oyun temiz
başlar ve eski anahtarlar tarayıcıdan silinir.

## 6. Son görsel geçiş (v3.0.1)

Yeniden tasarımın ekran görüntüleri alınınca üç şey hâlâ "yarım" duruyordu.

1. **Havada asılı siyah levha.** Neon tabela salonun ORTASINA, `(-7,4; -2,5)`
   noktasına, `y = 2,5`'e yerleştirilmişti. Arkasında hiçbir şey olmadığı için
   kamerada mekânın göbeğinde duran siyah bir dikdörtgen olarak okunuyordu —
   tek başına bütün kadrajı ucuzlatan parça buydu. Tabela batı duvarındaki
   pencereye taşındı (`x = -13,55`, `rot 90`); artık camın içinden okunuyor.

2. **Halılar halı gibi durmuyordu.** Ton zemine fazla yaklaştırılmıştı ve
   ikisi yan yana boş zemine serilmişti; "yarım kalmış zemin" gibi görünüyordu.
   Artık sıcak kil tonunda bordür + açık dokuma alanı var ve halılar oturma
   gruplarının altına (kanepenin önü, masa adaları) serildi.

3. **Kilitli alan mekânı boş bırakıyordu.** "Yalnızca SIRADAKİ bölümü brandala"
   kuralı 26 brandanın yarattığı depo görüntüsünü çözmüştü ama bu sefer salonun
   yarısı çıplak zemin kalıyordu. Kural **iki adıma** çıkarıldı: satın
   alınabilir bölüm ve ondan bir sonraki brandalı görünür, ötesi görünmez.
   Ödeme pedi ise hâlâ yalnızca satın alınabilir bölümde yanar
   (`zoneDepth() === 0`) — hangi pede basacağı karışmasın.

`validateLayout()` ve `validateSightlines()` bu değişikliklerden sonra da boş
dizi döndürüyor; derleme 299,88 kB (app) + 504,73 kB (three).

---

# v3.1 — çarpışma, okunaklılık, mobil ve masa zinciri

Oyuncu geri bildirimi: *"hitbox sorunu var çok fazla, görünmeyen yerler de
koşarken bloklanıyor"*, *"neyi nereden alıp nereye koyacağımı anlamadım"*,
*"teslim noktalarında ne var görünmeli"*, *"masalar tek tek açılsın"*,
*"mobil görüntü çok kötü, joystick her yerde çıkıyor"*.

## 1. Çarpışma artık ızgarada değil, GERÇEK GÖVDEDE

Üç ayrı hata üst üste biniyordu:

1. **Görünmeyen istasyonlar da engeldi.** `rebuildNav()` bütün istasyonları
   engel yazıyordu — uzaktaki kilitli bölümün eşyası sahnede hiç olmadığı
   hâlde. Oyuncu bomboş zeminde görünmez duvarlara tosluyordu. Artık
   `zoneVisibility() === 'hidden'` olan istasyon engel listesine girmiyor.
2. **Izgara yuvarlaması her kenara 0,25 ekliyordu.** Çarpışma 0,5'lik A*
   ızgarası üstünden çözülüyor, üstüne oyuncu yarıçapı biniyordu: 1,05
   derinliğindeki bir makine 1,9 derinliğinde bir duvara dönüşüyordu.
   Gövde çarpışması artık gerçek dikdörtgenlerle çözülüyor
   (`NavGrid.solids`), ölçüler `STATION_BODY`'den geliyor ve
   `StationView`'daki gövdenin birebir kendisi.
3. **Kutular istasyonun DÖNÜŞÜNÜ yok sayıyordu.** 90° dönmüş bir tezgâhın
   kutusu gövdeyle çapraz duruyordu; `footprint()` artık dönüşü uyguluyor.

## 2. İki ölümcül kilitlenme

- **Duvar dibindeki kova.** Sabit duvar payı 0,6 + A* şişirmesi 0,5 =
  duvar boyunca 1,1 birimlik ölü bant. `x = -13`'teki bulaşık kovası
  personel için ulaşılmazdı: A* hedefi "en yakın serbest hücreye" kaydırıp
  BAŞARILI dönüyor, komi kovanın 1,3 birim yanında elinde bulaşıkla
  donuyordu. Üç düzeltme: duvar payı 0,35'e indi, `findPath` hedefi şişirme
  bandındaysa doğrudan gerçek ızgarayla arıyor, ve `Staff.stallTimer`
  1,5 saniye kıpırdamayan personelin uzanma mesafesini geçici olarak
  1,2 birim açıyor. Kovalar ayrıca duvardan uzaklaştırıldı.
- **Bütün masalar kirlenince oyun ölüyordu.** Komi kovaya ulaşamayınca her
  masa bulaşıklı kaldı, `freeSeats` sıfırlandı, "boş masa yoksa müşteri
  çağırma" kuralı kapıyı SONSUZA kilitledi: 15 dakika boyunca tek müşteri
  gelmedi ve oyuncunun yapabileceği bir şey yoktu. Artık
  `noSeatGrace = 14 sn` sonra kapı yeniden açılıyor; gelen müşteri masa
  bulamazsa paket alıp çıkıyor.

## 3. "Nerede ne var" okunaklılığı

- Her makinenin ve teslim bankosunun üstünde **ürün adı + adet rozeti**:
  "Kruvasan ×6", "Çay ×2 · Latte ×1".
- Çıkış yığını artık ürünün BİÇİMİNİ alıyor: bardak bardak, tabak tabak
  duruyor (tek InstancedMesh, ek çizim maliyeti yok).

## 4. Masalar tek tek açılıyor + VIP masalar

Sekiz bölüm yerine **on yedi** bölüm var ve zincir makine/masa diye
dönüşümlü ilerliyor: `KAFE → MASA 3 → KAHVE → MASA 4 → FIRIN → MASA 5 →
SALON → MASA 6 → SERVİS → MASA 7 → VIP MASA → TATLI → MASA 8 → TERAS →
MASA 9 → MASA 10 → VIP LOCA`. Her masanın kendi pedi ve kendi yeri var.

**VIP masa** (₺70.000) ve **VIP loca** (₺3.000.000): kadife koltuk, mermer
tabla, altın kenar, bordo halı ve şamdan. Hesabı `2,4×` katlıyor ama misafir
daha uzun oturuyor — "her masayı VIP yap" doğru cevap değil.

## 5. Mobil

- Telefon kırılım noktası **400 px → 520 px**. Eski eşik 412/430 px'lik
  yaygın telefonlarda hiç devreye girmiyordu; göstergeler ekranın dörtte
  birini yiyordu. 390 × 844'te üst yığın **~300 px → 88 px**.
- Telefonda marka yazısı ve şube rozeti gizleniyor (ŞUBE butonu zaten var),
  çarpan alt yazıları kalkıyor, kafe sayaçları hedef şeridiyle aynı satırda.
- **Joystick artık yalnızca başparmak bölgesinde açılıyor**: dikeyde sol
  %78 + alt %60, yatayda sol %50 + alt %76. Üstteki göstergelerin ve
  sağdaki yuvarlak butonların üstüne dokununca hiç çıkmıyor. Merkez ayrıca
  halkanın tamamı ekranda kalacak şekilde içeri çekiliyor.

## 6. Branda

Koruma brandası gövdeden büyük tek tip bir kutuydu; makineler bembeyaz
bloklara dönüşüyor, özellikle telefonda mekân depo gibi görünüyordu. Ölçü
artık `STATION_BODY`'den geliyor, ton kırık beyaza çekildi ve bağlama ipi
eklendi. Buna karşılık brandalı görünen bölüm sayısı **bire değil ikiye**
çıkarıldı: önü dolu, ufku açık.

## 7. Kayıt

`SAVE_VERSION` 6, anahtar `fincan-sokagi:save:v6`. Bölüm kimlikleri
değiştiği için v5 kayıtları okunmaz.

---

# v3.2 — yol gösterici, tuvalet odası, süpürge, zorluk eğrisi

## 1. Kalıcı yol gösterici

Öğretici altı adımda döngüyü anlatıyordu ama bitince oyuncu ortada kalıyordu
(*"neyi nereden alıp nereye koyacağımı anlamadım"*). Artık ekranda **her an
tek bir hedef** işaretli:

- hedefin üstünde zıplayan bir ok ve fiil yazısı — `ÇAY AL`, `MASAYA GÖTÜR`,
  `BULAŞIĞI TOPLA`, `TOZU SÜPÜR`, `KOVAYA AT`, `SİPARİŞ AL`,
- hedefin zemininde nabız gibi atan bir halka,
- **oyuncunun ayağından hedefe uzanan noktalı bir iz** — küçük ekranda ok
  kadraj dışında kalsa bile iz ayağının dibinden başlar.

Öncelik kafenin gerçek aciliyet sırasıdır: elimdeki → bekleyen masa, bekleyen
sipariş → hazır ürün, kirli masa, yerdeki leke, biten sarf, sipariş sırası.

## 2. Tuvalet artık ayrı bir ODA

Servis nişi mutfağın devamı gibi duruyordu. Şimdi tam boy batı duvarı, bel
hizasında güney duvarı, söveli geniş bir giriş, **TUVALET** tabelası ve
kapının üstünde yeşil lamba var. Duvarlar hem görsel hem çarpışma engeli.

## 3. Elektrikli süpürge + toz

Kafenin **ikinci ritmi**: toz müşteriye bağlı değil, düzenli aralıklarla ve
rastgele yerlerde birikir. Salonda bir **süpürge dolabı** var; yanına
gidince süpürgeyi alırsın (dolap boş kalır, süpürge elinde görünür), tekrar
gidince bırakırsın. Süpürgeyle temizlik yarıçapı `1,9×`, toz temizleme hızı
`2,6×`; süpürgesiz toz `0,28×` hızla toplanır. Karşılığında koşarken `0,9×`
yavaşlarsın.

Efektler: emiş sırasında dönen toz zerreleri, biten lekede halka + puf, kovaya
atarken üç katmanlı toz bulutu ve parıltı.

## 4. Zorluk eğrisi

Tek bir ilerleme oranı (`World.difficulty`, açılan bölüm sayısı) iki şeyi
birden sıkar: misafir sabrı `1,00× → 0,76×`, kir üretimi `1,00× → 1,28×`.
Başlangıç kolay kalır, kafe büyüdükçe personel almak tercih değil zorunluluk
hâline gelir.

## 5. Karakterler

Kafa oranı `1,14×` büyütüldü (gövdenin ~%29'undan ~%33'üne) ve gözler
`0,043 → 0,052` yarıçapa çıkarıldı. Küçük ekranda karakteri karakter yapan
şey kafa büyüklüğü ve göz; ikisi de mobilde kayboluyordu.

## 6. İnce duvar tuzağı (kritik hata)

Navigasyon ızgarası "merkezi içeride olan hücre" kuralıyla işaretlenir.
0,28 kalınlığındaki tuvalet odası duvarı iki hücre merkezinin **arasına**
düştüğü için hiçbir hücreyi işaretlemedi: gövde çarpışması duvarı görüyor,
A* görmüyordu. Personel duvarın içinden geçen bir yol buluyor, her karede
geri itiliyor ve orada titriyordu — soak testinde üç garson **yedi dakika**
köşede kaldı. `blockRect` artık ızgara için dikdörtgeni en az bir hücre
kalınlığına şişiriyor (gövde ölçüsü değişmiyor).

**Ölçüm (tüm bölümler açık, 3 garson · 2 komi · 1 kasiyer, 8 dakika):**
düzeltme öncesi 40 servis / 411 sn takılma → sonrası **110 servis · %15
kızgın · hijyen 100 · itibar 100 · en uzun takılma 1,5 sn**.


## Yayın denetimi sonrası düzeltme dalgası (2026-08-11)

78 bulguluk yayın öncesi denetimin 1-3. adımları uygulandı.

### Yayın engelleyiciler

- **Release imzalama:** `android/upload-keystore.jks` üretildi, `key.properties`
  + `build.gradle` signingConfig bağlandı; `signingReport` release'i doğruladı.
- **Gizlilik:** `docs/gizlilik-politikasi.html` (TR+EN, "veri toplanmıyor");
  barındırma + Data Safety + IARC + 13+ adımları `docs/YAYIN.md`'de.
- **Bildirim ikonu:** `ic_stat_notify` (beyaz-alfa fincan) 5 yoğunlukta
  `make-assets.mjs`'e eklendi; `Native.ts` örnek-addan gerçek ada geçti.
- Manifest: `appCategory="game"` eklendi, kullanılmayan INTERNET izni kaldırıldı.

### Para/ilerleme kırıkları (7 düzeltme, tarayıcıda test edildi)

1. Tezgâh yığınının değeri kayda girdi (`mv`) — yüklemede para artık buharlaşmıyor;
   `mv`siz eski kayıtta yığın da sıfırlanır (görsel-değer tutarlı).
2. `doPrestige` eski GoalTracker'ı dispose ediyor — devir başına çift sayım bitti.
3. Prestijde sayaç TABANI (`statsBase`) alınıyor; hedefler `statSinceReset`
   okuyor — devir sonrası zincirleme oto-tamamlanma (g29 tek başına 1,1M) kapandı.
4. "Gece Vardiyası" gerçek bir etkiye bağlandı: dönüşte makine depoları normal
   tavanın üstüne (çarpan kadar) taşar; metin de buna göre düzeltildi.
5. `finishOrder` birim fiyatı `itemValue`'dan alıyor — istasyon yükseltmesinin
   "+%6 ürün değeri" vaadi artık gerçek hesaba yansıyor (tavan 1,72×).
6. Sahil hedefleri gerçek fiyata hizalandı: g30 8M→5M kazan, g31 ödülü
   2,6M→380k (%289 ödül istismarı kapandı).
7. Leke türü kayıtta üç değerli (`k: 0/1/2`) — tozlar yüklemede sıvıya dönüşmüyor.

### Navigasyon: bant/gövde uyuşmazlığı sigortası

Denetimin "gizil" dediği ayna-tuzak CANLI yakalandı: frontAisle bandı süpürge
dolabının hücrelerini ızgarada açıyor, A* dolabın içinden yol veriyor, gövde
geçirmiyor — aktör batı şeridinde sonsuza dek duvara itiyordu.
`Navigation.restampSolids()` eklendi: bant temizliklerinden sonra tüm gerçek
gövdeler ızgaraya yeniden damgalanır (`World.rebuildNav`). Doğrulama: aynı
rota artık dolabın doğusundan dolaşıyor.

### Ekonomi yeniden ayarı — botla ölçüldü

Yeni araç: `tools/balance-bot.js` — rehber okunu izleyen, A* ile yürüyen,
ped/personel/yükseltme satın alan otomatik oyuncu; 50 dakikalık oyunu ~10
saniyede simüle eder (render kapalı, 30 tik/sn sabit adım). Kullanımı dosya
başındaki yorumda.

Zincir yeniden fiyatlandı (masalar yan dal: a8 ve r2 artık masaya değil bir
önceki bar bölümüne bağlı) ve ödüller %40-45 kuralına göre yeniden ölçeklendi.

| Ölçüm | Eski (ölçüldü) | Yeni (ölçüldü) | Hedef |
|---|---|---|---|
| Oda 2 (r1) | 32:31 | **12:59 - 17:02** | 8-12 dk |
| VIP (r2) | ulaşılamadı (model 74-98 dk) | **36:44 - 45:48** | 35-45 dk |
| VIP MASA 2 (v1) | ölü içerik | **44:29** (oturum içinde) | — |
| İlk açılım (t1) | 0:31 | **0:30-0:38** | ~0:30 |

Kalan bilinçli borç: p2 (28M) / p3 (110M) geç oyun duvarları bu dalgada
ellenmedi — offline kazanç kararıyla birlikte ele alınacak (bkz. denetim).


## Temizlik paketi — "geçtiğin yer temizlensin" (2026-08-11, adım 4)

Denetimin en düşük puanlı alanı (4/10). Kullanıcının üç şikâyeti de kodda
doğrulanmıştı; üçü de burada kapandı.

### 1. Kir artık bir MASKE — temizlik iz bırakıyor

Leke eskiden tek bir varlık ve tek bir skalerdi (`amount`); menzile girince
topluca eriyordu. Ölçüm: süpürgeyle temizlik yarıçapı **3,42 birim** (lekenin
kendisi 0,85) ve toz **0,42 saniyede** siliniyordu — yani lekenin yanından
DURMADAN koşarak geçmek bile onu tamamen yok ediyordu.

Artık her leke `11×11` hücrelik bir kaplama ızgarasıdır (`Spills.cells`):

- **Fırça** (`carveStroke`): süpürge başlığının bu karede çizdiği doğru
  parçasına değen hücreler silinir. Başlık oyuncunun 0,95 birim önünde,
  süpürgesizken ayaklarının dibindedir. Yarıçap 0,42 (süpürge) / 0,3 (paspas)
  / 0,13 (süpürgesiz toz — bilerek zahmetli).
- **Ovma** (`scrubAt`): lekenin üstünde DURURKEN merkezden dışa doğru aşınır.
  Bot bunun yokluğunu acımasızca yakaladı: fırça aynı hücreleri tarayıp
  ilerleme sıfır kalıyor, oyuncu lekenin başında kilitleniyordu (50 dakikada
  **tek leke bile** bitiremedi).
- **Aşınma** (`erode`): personel için, zaman tabanlı — komi lekenin başında
  durup çalışır, fırça mantığı ona uymaz.

`amount` = kalan hücre oranı, yani hijyen ve ödül hesabı hiç değişmeden çalışır.

**Doğrulama (tarayıcıda ölçüldü):** lekenin yalnız sol yarısından geçen bir
fırça darbesinden sonra sol yarıda 17, dokunulmamış sağ yarıda 34 kirli hücre
kaldı; `amount` 1,00 → 0,64.

### 2. Zemin gerçekten kirli görünüyor

- Leke görseli tek blob mesh olmaktan çıkıp **alfa maskeli** bir kareye
  dönüştü (96×96, yalnız maske değişince yüklenir). Temizlenen yer artık
  küçülmüyor — **deliniyor**; altındaki temiz zemin açığa çıkıyor.
- Kir gövdesine benekli/çatlaklı bir doku eklendi: düz renk "etiket" gibi
  duruyordu ve fırça izinin kenarı okunmuyordu.
- Toz rengi 0xbdb3a2 → **0x8f836d**: eski ton açık bej parkede neredeyse
  görünmezdi (ekran görüntüsünde tozu leke değil, üstündeki etiket
  anlatıyordu). Toz yarıçapı da 1,35× büyütüldü.
- **Genel kir katmanı** (`Environment.grime`): hijyen düştükçe zeminin
  geneline yayılan, düzensiz lekeli bir katman. Hijyen artık HUD'daki bir
  sayı değil, mekânda görünür. Ölçüm: hijyen 100 → 45 arasında zemin
  parlaklığı 122 → 113 (%7,4 kararma) + gözle görülür lekelenme.

### 3. Süpürge iki elle tutuluyor

Süpürge karakterin köküne eklenen, hiçbir uzva bağlı olmayan bir mesh'ti;
eller kabzadan **0,39 birim** uzakta boşta sallanıyordu. Rig'de el bağlama
noktası tanımlıydı ama projede hiçbir eşya hiçbir zaman ele bağlanmıyordu.

- Animatöre **itme katmanı** eklendi (`applyPush`): iki kol da kabzaya uzanır,
  gövde itme yönünde yaslanır.
- Süpürge mesh'i üçe ayrıldı: **gövde** (süpürürken salınır), **sap** (her
  karede ellere nişan alır), **kabza** (iki tutamaklı T; sapın burulmasını
  almasın diye ters dönüş uygulanır).
- Sap hedefi ellerin GERÇEK konumundan okunur (`handMidLocal`), elle yazılmış
  bir sabitten değil: poz değişse bile sap elleri takip eder, "el ile kabza
  arasında boşluk" hatası yapısal olarak imkânsız.
- Salınım frekansı tek sabitte toplandı (`SWEEP_HZ` 1,43): eskiden başlık
  1,43 Hz, kollar 2,0 Hz'de gidiyor ve hiçbir karede buluşmuyorlardı.
- Süpürme pozu ve başlık salınımı tek hız eşiğinden (1,2) okunur; eskiden
  0,6 ve 2,0 idi ve aradaki bantta süpürge süpürürken karakter düz yürüyordu.

**Doğrulama:** kabza ile ellerin orta noktası arasındaki mesafe **0,000 birim**
(hedef < 0,08). Eller gövdenin %41 yüksekliğinde (bel hizası), sap gövdeden
ellere kesintisiz uzanıyor.

### 4. Süpürge bir ALET, mod değil

Eskiden süpürge taşıma yığınını hiç işgal etmiyordu; karakter önünde süpürge
iterken göğsünde çay+tost kulesi yükseliyordu. Artık:

- Süpürge eldeyken ürün/bulaşık **alınamaz** (elde kalanı bırakmak serbest).
- El doluyken süpürge **alınamaz** — koddaki "elinde bir şey varsa buraya asla
  düşmez" yorumu yanlıştı; elde çayla dolabın dibinde durmak çay+süpürge
  veriyordu.
- Dolapta süpürge yoksa alınamaz; şube değişimi ve prestijde süpürge elden
  düşer ve dolabına döner (eskiden prestij sonrası hem elde hem dolapta
  görünüyordu, süpürge dolabı olmayan sahile taşınabiliyordu).
- Rehber oku süpürge eldeyken yalnız temizlik gösterir; yerde iş kalmayınca
  "SÜPÜRGEYİ BIRAK" ile dolabı işaret eder — alet döngüsü kapanır.

**Doğrulama:** süpürgeyle makinenin başında 5 saniye → el boş; aynı yerde
süpürgesiz → 3 çay alındı (kontrol grubu); el doluyken dolapta 5 saniye →
süpürge alınmadı.

### 5. Ses ve titreşim

- Sürekli **emiş uğultusu** (`AudioManager.setVacuum`): bantgeçiren gürültü +
  hafif LFO; kir emerken bant yukarı kayar ("iş yapıyor" tınısı). Tamamen
  sentez, asset yok. Temizliğin tatmininin yarısı sürekli sestir.
- **Titreşim** bağlandı: altyapı (`Native.haptic`) yazılıydı ama oyunda tek bir
  çağrı yoktu. `sfx` ile aynı kalıpta olay yoluyla geçer (`bus.emit('haptic')`).

### 6. Toz üretimi

- **Boşa giden tur** düzeltildi: zamanlayıcı kontrollerden önce tam aralığa
  kuruluyordu; doğum noktası sınır dışına düşerse ya da tavan doluysa o tur
  tamamen kayboluyor, fiili üretim ayarlanan aralığın altında kalıyordu.
- Toz artık yalnız masa çevresine değil, **mekânın rastgele yürünebilir
  noktalarına** da doğuyor (%62 masa / %38 serbest): koridor, giriş ve bar
  önü hiç tozlanmıyordu.
- Zorluk çarpanı (`dirtScale` 1,00 → 1,28) toz aralığına da uygulanıyor.
- Leke türü kaydı üç değerli (`k: 0/1/2`) — tozlar yüklemede sıvıya dönüşmüyor.

### 7. Öğretici kilitlenmesi (bot yakaladı)

"PARAYI TOPLA" adımı iki yönden bozuktu: (a) herhangi bir `money:earn` ile
geçiliyordu (yerdeki bir lekenin ödülü bile sayıyordu), (b) hiçbir tezgâhta
para yoksa ok "üstüne git topla" diyor ama toplanacak bir şey olmuyordu.
Bot koşusunda oyun tam burada durdu: **50 dakika boyunca 1 servis**.
Artık yalnız tezgâhtan toplama sayılır (`counter:collected`) ve para yoksa
14 saniye sonra adım kendiliğinden geçilir.

### Ölçüm (50 dakikalık bot koşusu, adım 4 sonrası)

| Ölçüt | Değer | Hedef |
|---|---|---|
| İlk açılım | **0:34** | ~0:30-0:40 |
| Oda 2 (r1) | **18:34** | 8-17 dk (bot kötümser oyuncudur) |
| VIP (r2) | **45:46** | 35-45 dk |
| Açılan bölge | 15 | — |
| Hijyen (bitiş) | **100** | > 60 |
| Yerdeki leke (bitiş) | 7 / 14 | tavanın altında |
| Silinen leke | 255 | — |
| Öğretici | tamamlandı | kilitlenme yok |

Temizliğin gerçek bir zaman maliyeti olduğu için Oda 2 kapısı (t5 12k → 9k,
r1 17k → 12,5k) ve ovma süreleri yeniden ayarlandı: ilk değerler (3,2/5,0/11 sn)
fazla cezalıydı, hijyen 0'a çöküyor ve leke tavana dayanıyordu (14/14).


## Görsel paket — kilitli odalar, kot farkı, rozet diyeti (2026-08-11, adım 5)

Denetimin en yüksek etkili görsel bulgusu ve kullanıcının en çok rahatsız
olduğu şey: *"kilitli olan 2 oda yan yana çok kötü gözüküyor"*.

### 1. Kilitli oda artık "tadilat hâlinde bir mekân"

Ölçüm (denetim): kilitli kadrajda ekranın **~%57'si** içeriksiz düz renk
levhaydı; oda ortasındaki 5,2×1,1 birimlik "🔒 ODA ADI" plakası tek başına
ekran genişliğinin **%44-56'sını** kaplıyordu; oda zeminleri mekân içindeki
**tek dokusuz yüzeydi** ("yarım kalmış placeholder" okumasının teknik sebebi).

- **Dev zemin rozeti tamamen kaldırıldı** (bilgi zaten kapı tabelasında ve
  ödeme pedinde vardı — oda başına 3 metin plakası 2'ye indi).
- Yerine tür standardı geldi (My Perfect Hotel'in renovasyon odası):
  odanın **gerçek mobilya konumlarında beyaz koruma brandaları** + boya
  kovası, fırça ve A-tipi merdiven. Oda açılınca brandalar kalkar, altından
  aynı yerlerdeki gerçek mobilya çıkar — "sürpriz" korunur, ekran boş kalmaz.
- Oda zeminleri **dokulu**: VIP'te bordo karo, salonda oda vurgusuyla
  karışmış parke; ikisinin de kenarında bordür şeridi. Kilit açılınca da
  kalıcı (eski düz plaka açıldıktan sonra da duruyordu).
- 🔒 emojisi **çizilmiş altın kilit geometrisiyle** değiştirildi: emoji
  Windows/Android/iOS'ta üç ayrı görünüyordu, marka dili kurulamıyordu.

### 2. İki oda artık aynı şablonun kopyası değil

Denetim: iki odanın kapı tanımı **birebir aynıydı** (kuzey kenar, pos −1,8,
genişlik 3,0), ikisi de tam kadraj genişliğinde yatay bant, ikisi de aynı
duvar yüksekliği — portre kamerada "alt alta iki eş şerit".

- **Salon Odası batıdan** (pos −7,4), **VIP doğudan** (pos +2,6) girilir.
  Koridorda yandan geçmek zorunda kalmak iki odayı iki ayrı kanat gibi
  gösterir.
- **VIP SALON KOT FARKINA ALINDI** — kullanıcının kendi önerisi
  (*"3-5 basamaklı bi merdiven koyup farklı bir alan eklenebilirdi"*).
  Oda 0,4 birim yükseltilmiş bir podyumun üstünde; kapı boşluğunda pirinç
  burunlu **üç basamak** var.

  Kot **yalnızca görseldir**: navigasyon ızgarası iki boyutludur, A* ve gövde
  çarpışması bu değeri hiç görmez (`RoomDef.lift` + `floorLiftAt`). Çizime
  giren her şey kotu alır: oda zemini ve duvarı, mobilya görselleri,
  karakterler (`Actor.floorY`, merdivende yumuşatılır), oturma/kalkma
  animasyonu ve zemin kiri. Kot farkı olmayan mekânda döngü hiç koşmaz.

### 3. Rozet diyeti ve renk yığılması

- **MAX rozeti kırmızı değil.** Dolu depo İYİ bir durumdur ama kırmızı oyunun
  her yerinde hata rengi: bir karede beş kırmızı MAX yandığında mekân alarm
  veriyor gibi okunuyordu. Nötr koyu ton + krem yazı.
- **VIP altın halka yığılması çözüldü.** Ölçüm: masalar 3,35-3,40 birim
  aralıklı, halı çapı 4,10 ve altın halka çapı 3,96 idi — komşu halılar 0,7,
  halkalar 0,6 birim ÜST ÜSTE biniyordu; ekranda iç içe geçmiş üç çember
  vardı. Yarıçap 2,05 → **1,45**: her masa kendi adasında.
- **Duvar tablosu gerçek bir motife çevrildi**: soyut renkli dikdörtgenler
  yerine markanın fincan amblemi (gövde + kulp + tabak + buhar) — ikon,
  açılış görseli ve bildirim ikonuyla aynı dil.

### 4. Boş parke dolduruldu

Ön salon 173 birimlik bir alandı ve erken oyunda içinde tek masa, iki saksı
ve bir çöp kovası vardı. Kilide bağlı OLMAYAN altı dolgu dekoru eklendi
(kitaplık, saksılar, sandık, tabure) — hepsi duvar dibinde.

**Yerleşim doğrulayıcısı bu eklemede iki gerçek hata yakaladı** ve ikisi de
düzeltildi: kitaplık ile Bulaşık Kovası arasında 0,86 birimlik bir **TUZAK
RİSKİ** (A* geçit görür, 0,60'lık gövde sığmaz) ve sandık ile Salon Kovası
arasında 0,12 birimlik **ÇAKIŞMA**. Toplam uyarı 22 → 20.

### 5. Denendi ve geri alındı: tavan kirişleri

Sarkıt kordonları boşlukta bitiyor (sahnede tavan yok) — denetim bunu
"yerden biten direkler gibi okunuyor" diye işaretlemişti. Çözüm olarak enine
ahşap kirişler eklendi, **ölçüldü ve daha kötü çıktı**: 43°lik portre
kamerada kirişler oyun alanının tam ortasından geçip mekânı üç şeride
bölüyor, karakteri ve masaları kesiyordu — menü tahtası için kodda zaten
uyarılan hatanın birebir aynısı. Geri alındı; gerekirse çözüm kuzey duvarının
ARKASINA silüet koymaktır, kadrajın içine değil.

### Ölçüm (50 dakikalık bot koşusu, adım 5 sonrası)

| Ölçüt | Değer | Hedef |
|---|---|---|
| İlk açılım | **0:37** | ~0:30-0:40 |
| Oda 2 (r1) | **12:00** | 8-17 dk |
| VIP (r2) | **38:24** | 35-45 dk |
| Açılan bölge | 16 | — |
| Hijyen (bitiş) | 100 | > 60 |
| Yerdeki leke | 3 / 14 | tavanın altında |
| Öğretici | tamamlandı | kilitlenme yok |
| Oyuncu Y (VIP'te) | 0,40 | podyum kotu |
| VIP masa görseli Y | 0,40 | podyum kotu |

Erişilebilirlik hatası yok; kapı taşımalarından sonra girişten her VIP
masasına yol bulunuyor (34,2 ve 30,1 birim).


## Plan revizyonu + cila (2026-08-11, adım 6)

### 1. VIP ile Salon artık sırt sırta değil

Geri bildirim: *"bu vip ile salon böyle yan yana olmasın… çok dip dibe
gözükmesinler. yerleri duvarları çok güzel şekilde konumlandır, basit
uyduruk durmasın."*

Eski plan tek bir düz koridor (doğu şeridi) ve onun batısına dizilmiş TAM
GENİŞLİKTE iki yatay banttı; aralarında 2 birimlik bir dikiş vardı. Yeni plan
üç parçalı:

| | Eski | Yeni |
|---|---|---|
| Giriş | güney-doğu (6,7 / 20,6) | **güney-batı** (−6,0 / 20,6) |
| Salon Odası | x −9…4,4 · z 9…14,4 (tam genişlik) | **x −8,8…1,6** · z 9…14,2 (batı kanadı) |
| VIP Salon | x −6,4…4,4 · z 16,4…21,2 (tam genişlik) | **x −2,0…8,8** · z 16,4…20,8 (doğu kanadı, kot +0,4) |
| Aralarında | 2 birimlik boş dikiş | **avlu**: taş döşeme + bordür + kaideli saksılar |

İki oda artık ÇAPRAZ durur ve aynı kadraja yan yana girmez. Dolaşım da düz
bir hat olmaktan çıktı: müşteri batı koridorundan girer, odaların
arasındaki avludan doğuya kayar, oradan kuzeye bara çıkar — yumuşak bir S.

Avlu "artakalan boşluk" değil tasarlanmış bir geçit: kendi taş döşemesi,
koyu bordürü ve iki ucunda kaideli saksıları var. Mekân salondan avluya,
avludan VIP terasına geçerken her seferinde ZEMİN DEĞİŞTİRİR.

Masalar, pedler ve dekor yeni plana taşındı. Yerleşim doğrulayıcısı temiz:
erişilemez istasyon, tuzak boğaz veya çakışma yok; girişten bara ve her VIP
masasına yol bulunuyor.

### 2. Cila (denetim kalan maddeleri)

- **Ayak kayması (buz pateni) tamamen bitti.** Kadans tavanı 4,2 çevrim/sn
  sabitti ve yükseltme tablosuyla hiç çarpılmamıştı: hız yükseltmesinin
  10. seviyesinde oyuncu %30,6, garson %21,7, yüklü oyuncu %36 kayıyordu.
  Tavan kaldırıldı (taban 0,75 kaldı). **Ölçüm: her hızda %0.**
- **Kutlama sırasında tepsi kulesi havada kalmıyor** — kutlama artık taşıma
  pozunu tamamen söndürmüyor, taban ağırlık bırakıyor.
- **Bulaşık son slotu kapmıyor**: ürün taşırken bulaşık ancak ardında boş
  slot kalacaksa alınır. Rehber AYNI kuralı okur (yoksa oyuncuyu
  alamayacağı masaya yönlendirip kilitliyordu — bot bunu yakaladı).
- **Peçete eşiği düzeltildi**: tüketim 0,5 iken eşik "1'den az"dı; stok
  0,5'te kilitlenip her kullanımda haksız itibar cezası yazıyordu.
- **Arıza 999 sn → 75 sn**: usta kendi geliyor, oyuncu koşarsa daha hızlı.
- **Fenomen bahşişi** artık gerçekten uygulanıyor (sabit tanımlıydı ama
  hiçbir hesaba girmiyordu); 4× yerine 1,7× ek çarpan.
- **Kaçak müşteri** koşulu bankoya bakıyor (makineye değil): boş bankoda
  olay doğup haksız −3 itibar kesmiyor.
- **Sızıntılar**: `World.dispose` artık yol göstericiyi ve temas gölgesini
  de bırakıyor (her prestijde bir doku sızıyordu).
- **Ölü kod silindi**: `offlineIncomePerSecond`, `claimOffline` /
  `offlineDoubleReady` / `doubleOffline` reklam zinciri, `pendingOffline`.

### 3. Bot iki gerçek oyun hatası daha yakaladı

1. **Öğretici süpürgeyle kilitleniyordu.** Süpürge dolabı oyuncunun
   başlangıç noktasının yanında; eller boşken orada bir saniye durmak
   süpürgeyi ele veriyor, alet-münhasır mod da bulaşık toplamayı
   kapatıyordu — "BULAŞIĞI TOPLA" adımı SONSUZA KADAR bekliyordu (bot 50
   dakikada 1 servis yaptı). Süpürge dolabı artık öğretici bitene kadar
   sessiz: FTUE tek seferde tek mekanik öğretir.
2. **Duvara bastıran oyuncu "yürüyor" sayılıyordu.** `planarSpeed` komut
   hızından okunuyordu; duvara dayanmış oyuncunun hızı 5,5 görünüyor ama
   fiilen yerinde duruyordu. Sonuç: niyet kapıları hiç dolmuyor (duvara
   sıkışmış bir ödeme pedi ilerlemeyi sessizce kilitliyordu) ve karakterin
   bacakları yerinde tepiniyordu. Artık GERÇEK yer değiştirmeden ölçülüyor.
3. **Öğretici oku, parası yetmeyen pedi göstermiyor**: oyuncu parasının
   tamamını pede akıtıp yarıda kalınca ok hâlâ pedi işaret ediyor ama
   yapacak bir şey olmuyordu. Para yetmiyorken ok devre dışı kalır, normal
   yönlendirme devralır.

### 4. Temizlik dengesi: otomasyon oyuncuya yetiştirildi

Adım 4'te oyuncunun temizliği TEMAS şartına bağlandı (3,42 birim öteden
otomatik silme kalktı) ama otomasyon buna göre ayarlanmamıştı: iki ayrı 50
dakikalık ölçümde geç oyunda lekeler tavana dayandı (14/14) ve hijyen 0'a
çöktü. Komi leke hızı 1,6 → **1,05** katsayıya çekildi, toz cezası 0,7 →
**0,85**, leke doğma olasılığı 0,30 → **0,22**. Ölçüm sonrası hijyen **98**.

### 5. Ölçüm aracı

`tools/balance-bot.js` üç iyileştirme aldı: `sync: true` modu (50 dakikalık
ölçüm tek çağrıda ~26 saniye — sekme arka plandayken `setTimeout`
kısıtlaması ölçümü saatlere çıkarıyordu), tick içindeki istisnaları
yakalayıp raporlama (eskiden pompa sessizce ölüyor, ölçüm "sonsuza kadar
sürüyor" görünüyordu) ve pedlerin KALAN bedelini okuma.

### Ölçüm (50 dakikalık bot koşusu, adım 6 sonrası)

| Ölçüt | Değer | Hedef |
|---|---|---|
| İlk açılım | **0:44** | ~0:30-0:45 |
| Oda 2 (r1) | **7:53** | 8-10 dk (GDD) |
| VIP (r2) | **22:40** | 35-45 dk (GDD) — artık daha ERKEN |
| Açılan bölge | **17 / 17** | — |
| Hijyen (bitiş) | **98** | > 60 |
| Öğretici | tamamlandı | kilitlenme yok |
| Ayak kayması | **%0** (her hız) | < %7 |
| Yerleşim doğrulaması | ciddi hata yok | — |

**Bilinçli açık borç:** VIP artık GDD'nin 35-45 dakika hedefinden ERKEN
(22:40) geliyor; zincirin tamamı 34 dakikada bitiyor. Bu, adım 3-6'daki
fiyat indirimlerinin toplam etkisi. Sonraki tur için seçenek: a8/r2/v1/v2
bandını ~%50 yukarı çekip VIP'i 32-38 dakikaya taşımak. Sahil şubesi ve
prestij zinciri arkadan geldiği için oyun içeriksiz kalmıyor.


## Mekân yükseltmesi — "premium kafe" (2026-08-11, adım 7)

Geri bildirim: *"mekan çok önemli… tasarımı dizilişi çok cezbedici ütopik
düşünülmüş bir mekan değil… yeri göğü masaları her şeyi ütopik güzel premium
profesyonel yapılmalı."*

### 0. Önce ölçüyü düzelttik: DİKEY kadrajda bakmak

Bütün görsel değerlendirmeler yatay tuvalde yapılıyordu; oyun ise portre
kilitli. Yatayda "kenarda güzel duran" şeyler telefonda KADRAJA HİÇ
GİRMİYORDU. Tarayıcı 375×812'ye alınıp her karar gerçek oranda verildi —
ilk sokak denemesinin neden görünmediği ancak böyle anlaşıldı.

### 1. Kafe artık bir SOKAKTA duruyor

Mekânın dışı tek düz bej bir zemindi; kafe "boşlukta duran bir kat planı"
gibi okunuyordu. Artık kaldırım, dar bir cadde, karşı bina cepheleri
(kat pencereleri, saçak, vitrin, tente), sokak ağaçları ve lambalar var.

Cephe mesafesi **kameraya göre** seçildi: ilk deneme gerçekçi bir cadde
genişliği kullanıyordu ve binalar x ≈ ∓20'ye düşüyordu — portre kadrajın
yatay yarı genişliği mekân düzleminde ~6-7 birim olduğu için hiçbiri ekrana
girmiyordu. Sokak daraltıldı; binalar ∓12,5'te.

### 2. Mekân artık BOŞ değil: her kilitli eşya brandalı

En büyük "basit duruyor" sebebi buydu: kilitli bölümlerin yalnız SIRADAKİ
olanı görünüyordu (`d <= 1`), gerisi sahnede hiç yoktu — 18×24 birimlik
salonda tek masa ve uçsuz bucaksız boş parke. Artık açık alandaki HER
kilitli eşya koruma brandası altında duruyor (kapalı kapı ardındaki odalar
sürpriz kalmaya devam ediyor).

Yan etkileri de düzeltildi:
- **"YAKINDA" etiketleri kaldırıldı.** Her brandanın üstünde bir plaka
  vardı; hepsi görünür olunca ekranda 10+ etiket birikip mekân "fiyat
  listesi" gibi okunuyordu. Bilgi tek ve doğru yerde: sıradaki bölümün
  ödeme pedi.
- **Branda tonu geri çekildi**: bembeyaz örtüler kadrajı ele geçiriyordu;
  zeminle akraba sıcak bej + istasyon kimliğinden türeyen ton sapması.

### 3. Zemin: balık sırtı parke + kakma bordür + halı

- **Balık sırtı (herringbone) parke.** Eskisi 8 sıra × 2 tahtalık düz bir
  dizilimdi ve tekrar aralığı 4,6 birimdi: tahta başına ~2,3 birim düşüyor,
  desen hiç okunmuyor, zemin "tek düz bej" görünüyordu — dikey kadrajda
  piksellerin yarısı zemin olduğu için tek başına büyük bir kayıp.
  Tekrar aralığı 1,9'a indi. Ton sapması ölçülerek DARALTILDI (0,24-0,54):
  ilk deneme tam aralığı kullanıyordu ve zemin parke değil DAMA TAHTASI
  gibi okunuyordu.
- **Kakma bordür**: duvar diplerinden geçen koyu ince şerit; zemine
  kompozisyon verir (otel lobisi imzası).
- **Ön salon halısı**: dokuma dokulu, çift bordürlü, saçaklı. İlk deneme
  karo dokusunu yeniden kullanıyordu ve halı değil YEŞİL BANYO KAROSU gibi
  duruyordu — ızgara derzleri tekstil hissini öldürüyor. Ayrı bir
  `rugTexture` yazıldı (dokuma iplik + çerçeve, tekrarsız).
- **Masa altlıkları inceltildi**: her masanın altında ayrı bir paspas
  vardı; büyük halı gelince "halı üstüne halı" oldu.

### 4. Bar arkası vitrin duvarı

Menü tahtasının iki yanı boş krem duvardı ve dikey kadrajın ORTA bandı —
oyuncunun en çok baktığı yer — bomboştu. Artık: dolu panel + dikey ahşap
lambri, iki ahşap raf, dizili fincan ve şişeler, rafların altında sıcak
bant ışığı, iki yanda asma yeşillik.

(Yalnız çıta konulan ilk deneme ÇİT gibi okunuyordu — çıtaların arkasına
dolu panel eklenip aralar daraltıldı.)

### 5. Temizlik otomasyonu: komiler arasında iş bölümü

Adım 4'te oyuncunun temizliği temas şartına bağlanınca yük tamamen komiye
geçti ama öncelik zinciri güncellenmemişti: **bulaşık her zaman lekenin
önündeydi** ve geç oyunda 20+ masa sürekli döndüğü için komi lekeye HİÇ
sıra getiremiyor, hijyen 0'a çöküyordu.

Lekeyi topluca öne almak da işe yaramadı — bu sefer bulaşık birikti, kirli
masaya kimse oturamadı ve küsen müşteri 130'dan 258'e çıktı. Doğru cevap
tek sıra değil **iş bölümü**: tek indeksli komiler lekeye, çift indeksliler
bulaşığa öncelik verir; leke tavana yaklaşırsa (≥6) herkes lekeye koşar
(tek komili kafede de çalışır). Ayrıca leke doğma olasılığı 0,30 → 0,17 ve
toz aralığı 26-46 → 34-58 sn.

**Bot da düzeltildi:** komi tavanı 2'ydi ve ölçümü çarpıtıyordu (oyunun
gerçek tavanı 5). Kirli bir kafe gören oyuncu temizlikçi alır; bot da alsın
— yoksa bot kısıtını oyun dengesizliği sanıp oyunu yanlış yere ayarlıyoruz.

### Ölçüm (iki ardışık 50 dakikalık bot koşusu)

| Ölçüt | Koşu A | Koşu B | Hedef |
|---|---|---|---|
| İlk açılım | 0:38 | 0:36 | ~0:30-0:45 |
| Oda 2 (r1) | 9:31 | 8:28 | 8-10 dk (GDD) |
| VIP (r2) | 28:24 | 32:14 | — |
| Açılan bölge | 17/17 | 17/17 | tamamı |
| **Hijyen (bitiş)** | **100** | **100** | > 60 |
| Yerdeki leke | 4 | 2 | tavanın (14) altında |
| Masadaki bulaşık | 0 | 0 | — |
| Yerleşim doğrulaması | temiz | temiz | ciddi hata yok |

Çizim çağrısı 315 → ~515 (hepsi açıkken), üçgen ~74k — mobil bütçesinde.


---

## Premium mobilya ve mekân malzemesi (8. paket)

> "mobilyaları da yap masaları sandalyeleri premium seviyeye çıkar"

Bu paketin tek konusu **malzeme**. Önceki paket mobilyanın SİLUETİNİ
düzeltmişti (konik ayak, minderli sandalye, pirinç kenar); geriye kalan
sorun tablaların hâlâ **tek düz renk** olmasıydı. Dikey kadrajda oyuncu
masalara neredeyse tepeden bakar, yani tabla yüzeyi ekranda bir
sandalyeden çok daha fazla piksel kaplar: ne kadar iyi biçimlendirilirse
biçimlendirilsin, düz renkli bir yüzey "boyanmış plastik" okunur.

### Tabla dokuları

| Masa | Malzeme | Neden |
|---|---|---|
| Kare | **Terrazzo** — krem harç, mekânın paletinden köşeli çipler | Desen NOKTASAL: her mesafeden aynı okunur |
| Yuvarlak | **Bal rengi masif ahşap** — merkez kaçık yıllık halkalar | Kapak UV'si diski ortalar, halkalar tam merkezli çıkar |
| VIP | **Siyah mermer + altın damar** | Koyu zeminde altın tek vurgu |

Kare masalarda **önce gerçekçi mermer denendi ve başarısız oldu**: 1,6
birimlik bir tablada uzun süpürme damarları, oyun kamerasından malzeme
gibi değil tablaya atılmış ÇİZİK gibi okunuyordu. Damarın ikna edici
olması için tablanın ekranda kapladığı alandan çok daha ince bir ölçek
gerekiyor; o ölçekte de mobil ekranda tamamen kayboluyor. Terrazzo bu
oyunun diline uyar ve renklerini mekânın paletinden alır — tabla böylece
mekânın parçası olur, üstüne konmuş beyaz bir levha değil.

Kare tabla `roundBox` yerine `box`: `roundBox` küreden şişirildiği için
UV'leri küreseldir, üstüne serilen doku kutup çevresinde ezilirdi. Taşın
köşesi zaten yuvarlak olmaz — pah görevini altındaki pirinç bant görür.

### Diğer mobilya düzeltmeleri

- **Ayak konikliği ters çevrildi** (kalın uç artık yukarıda). Ayaklar yere
  doğru şişerek "ağaç kütüğü" gibi duruyordu; bu ucuz hazır mobilyanın
  imzasıdır, gerçek marangozlukta ayak aşağı doğru incelir.
- **Taş tonu koyulaştırıldı** (L\* ~90 → ~80). Kare tablalar kadrajın en
  parlak lekesiydi; üstündeki fincan ve tabakların silüeti kayboluyordu.
- **Masa üstü saksı kiremit rengine geçti.** Krem gövde + yeşil küre
  masada saksı değil KAPAKLI KAHVE BARDAĞI gibi duruyordu. Gövde artık
  yukarı açılıyor, dışa taşan bir kenar dudağı var ve yaprak ezik/eğik —
  tam küre daima "top" okunur.

### VIP: altın diyeti

Her parçası altın olan sandalye pahalı değil **taklit** okunur. Odada
zaten altın olan üç şey var (masa kaidesi, halı halkası, tabela);
sandalye onların arasında koyu bir siluet olursa üçü de öne çıkar.

- Sandalye iskeleti **abanoz**, minder bordo kadife, **kolçak pirinç** —
  tek altın vurgu.
- **VIP zemini kırmızı karo değil koyu ceviz parke.** Parlak kırmızı +
  altın derz "lüks salon" değil KUMARHANE HALISI okunuyordu; ayrıca
  kırmızı zemin, odadaki bordo koltukları ve masa altı halılarını da
  yutuyordu — kırmızı üstünde kırmızı görünmez.
- **Masa altı halısı görünür oldu.** 0,012 kotundaydı, odanın kendi
  döşeme kaplaması (0,03) onu tamamen örtüyordu: ekranda yalnızca altın
  halka kalıyor, zeminde havada duran bir çember gibi duruyordu.

### Mekân: iki amatör leke

Mobilyayı düzeltirken kadrajdaki iki en kötü eleman da düzeltildi.

1. **Salon Odası artık mor değil.** Oda duvarları bölge vurgu rengiyle
   %34-45 karıştırılıyordu; mor vurgu duvarı, süpürgeliği ve zemini birden
   ele geçirip mekânın sıcak paletinden kopan bir LEYLAK KUTU üretiyordu.
   Vurgu dozu %13-20'ye indi ve r1 vurgusu şişe yeşiline (`0x2f5d4e`)
   çekildi. Pahalı mekânlar odaları renkle değil malzemeyle ayırır.
2. **Ön salon halısı.** Orta değerde zeytin yeşili zemin + turuncu bordür,
   halı gibi değil parkenin üstüne bulaşmış BÜYÜK BİR LEKE gibi
   okunuyordu. Kural terstir: zemin açıksa halı koyu ve doygun olur,
   çerçevesi zeminden bir ton açık (fildişi) çekilir. Ayrıca alanına çok
   düşük kontrastlı eşkenar dörtgen kafes motifi eklendi — düz alan "halı"
   değil "boya" okunuyordu.

### Ölçüm (50 dakikalık bot koşusu + yerleşim doğrulaması)

| Ölçüt | Sonuç | Hedef |
|---|---|---|
| İlk açılım | 0:36 | ~0:30-0:45 |
| Oda 2 (r1) | 8:28 | 8-10 dk (GDD) |
| VIP (r2) | 24:01 | — |
| Açılan bölge | 17/17 | tamamı |
| Servis | 1605 | — |
| Hijyen (bitiş) | 100 | > 60 |
| Yerdeki leke / bulaşık | 2 / 2 | tavanın altında |
| Yerleşim doğrulaması | ciddi hata yok | ULAŞILAMAZ/TUZAK/ÇAKIŞMA yok |
| Üretim derlemesi | başarılı | — |

Maliyet: masa başına **+1 çizim çağrısı** (saksının kenar dudağı), yani
kafedeki 9 normal masa için toplam +9. Dokular tür başına bir kez üretilir
(masa başına değil): tüm mekân için 3 doku, 3 malzeme.

**Bilinçli borç (değişmedi):** VIP hâlâ GDD'nin 35-45 dk hedefinden erken
geliyor (~24-32 dk). Düzeltmek isteyen a8/r2/v1/v2 fiyat bandını ~%50
yükseltmeli — ölçüm bandı yukarıdaki tabloya göre yeniden alınmalı.

> **Not (2026-08-14):** bu borç KENDİLİĞİNDEN kapandı. Aşağıdaki turda
> mekân büyüyüp dolaşım uzayınca VIP 32:11-37:36'ya kaydı, yani fiyat
> değiştirmeden GDD bandına oturdu. Fiyatlara dokunulmadı.

---

# Yayın öncesi kapatma turu (2026-08-14)

İkinci kapsamlı denetimin bulguları kapatıldı. Ölçümle çalışıldı: 2 × 50
dakikalık bot koşusu, portre (375×812) kareler, `validateLayout` /
`validateSightlines`, üretim derlemesi. İş iki paralel kolda yürüdü
(sistem/UI ve görsel/mekân), dosya sahipliği ayrıştırılarak.

## 1. Ulaşılamayan sistemler oyuna bağlandı

- **Prestij paneli yoktu.** `getPrestige` / `doPrestige` /
  `buyPrestigeUpgrade` API'de tanımlı ve `data/prestige.ts` tamamdı ama
  `src/ui` içinde bunları çağıran TEK SATIR yoktu: idle bir oyunun
  "içerik bitti" anına verdiği cevap oyuncuya kapalıydı. Panel, iki adımlı
  devir onayı ve Yükseltmeler panelinin başında kademeli beliren giriş
  kartı eklendi (ömrün %70'inde "Bak", eşikte "Aç"). HUD'a beşinci buton
  EKLENMEDİ — telefonda üst yığın v3.1'de 300→88 px indirilmişti; ölçüm:
  87,8 px → 87,8 px. Doğrulama: devirde para/personel/bölge/hedef
  sıfırlanıyor, Fincan Puanı kalıyor, kalıcı yükseltmenin etkisi ölçüldü
  (satış çarpanı 1,2437 → 1,3930 → 1,5422; ikinci devirden sonra korunuyor).
- **"Sen yokken…" modalı hiç açılmıyordu** (ölü UI). Offline PARA bilinçli
  olarak yok ve öyle kalıyor; modal artık dolan STOK raporunu gösteriyor:
  büyük sayı kazanç değil "servise hazır ürün", buton "TOPLA" değil "HAYDİ
  BAŞLAYALIM", para sesi yok, sepet emojisi fincan oldu. 45 sn altındaki
  yokluklarda açılmıyor.
- **Reklam kancaları UI'ya bağlandı.** `offline_double` yerleşimi SİLİNDİ
  (offline para kaldırıldığı için ikiye katlayacağı bir şey yoktu).
  `happy_hour` ve `zone_finish` gerçek arayüze bağlı ve YALNIZ `adReady()`
  true iken görünüyor; sağlayıcısız derlemede arayüzde "reklam" kelimesi
  bile geçmiyor (ölçüldü: teklif kartı sayısı 0). `HAPPY_HOUR_MULT` ilk kez
  gerçek bir hesaba giriyor (`Game.tickMods` → `valueMult`).

## 2. Gizlilik beyanı artık bayatlayamaz

Ayarlar'daki "Reklam ağı, analitik veya izleme kodu içermez" cümlesi SABİT
yazılmıştı. Bugün doğru; ama AdMob bağlandığı gün oyun oyuncuya yalan
söyler ve Play Data Safety beyanıyla çelişir — üstelik bunu yakalamak için
o cümleyi hatırlamak gerekir. `Ads.hasAdProvider()` eklendi, metin gerçek
duruma bağlandı: kod değişince beyan kendiliğinden düzelir.

## 3. Zeminin gerçek hatası: parkenin %51'i hiç boyanmıyordu

"Salon odası zemini dama tahtası gibi" diye işaretlenen şey bir ton sorunu
değil ÖRGÜ hatasıydı ve oda zemininde değil OYUNDAKİ HER ZEMİNDE vardı.
`plankTexture` balık sırtını `u=(2,−1), v=(1,2)` kafesiyle diziyordu;
determinant 5, ama hücre başına 4 tahta konuyor — `(x+2y) mod 5`
kalıntıları {0,1,3,0}: sıfır iki kez (örtüşme), 2 ve 4 hiç yok (delik).

Ölçüm (64×64 hücre): **eski kafes 2093/4096 boş (%51,1) + 668 örtüşen →
yeni kafes `u=(0,4), v=(1,3)` (det 4): 0 boş, 0 örtüşen.** Ana salonda fark
edilmemesinin sebebi derz renginin tahtaya yakın olmasıydı; oda zemininde
derz neredeyse siyahtı ve delikler orada bağırdı.

Örgü düzelince zemin bu kez düz kum gibi kaldı — "desen" sanılan şey
boşluklarmış. Okunaklılık tondan değil EK YERİNDEN kuruldu (derz 2→3,5 px,
üst kenar ışığı 0,16→0,30, yeni alt+sağ gölge, salon tekrar aralığı
1,9→2,4). Ölçüm: sd 6,5 → 8,2 · aralık 41,6 → 57,3.

## 4. VIP masaları şemsiye okunmuyor

Dört katkı birden kırıldı: yuvarlak halı → dikdörtgen (2,6×2,1), mermer
taban `0x2b2f3a → 0x3f4657` (L* 19→29), tablaya pirinç kakma halka ve ilk
kez gerçek kuver (şamdan + 2 tabak + 2 fincan — VIP kuveri bilerek
atlanıyordu, tabla fiilen boştu). Sarkıt 0,58 kuzeye alındı.

## 5. Avlu: boşluk bir MOBİLYA değil ZEMİN sorunuydu

81 birim karelik düz karo, kadrajın tam ortasında ve iki odanın kapısının
açıldığı geçit — ortasına konan her şey trafikte kalır. Çözüm taş
işçiliği: koyu çerçeveli panel + soğuk gri-yeşil dolgu + 45° göbek taşı
(4 çizim çağrısı, en kalını 8 mm).

**Kadraj dersi (ölçüldü):** ilk dolgu turunda her şey bölme diplerine
(x ±8,2) dizildi ve ÇOĞU HİÇ GÖRÜNMEDİ — portre kadrajın mekân
düzlemindeki yatay yarı genişliği yalnızca ~4,3 birim. Dekor kadraj içine
(|x| ≲ 4,6) ve oyuncunun gerçekten yürüdüğü kanatlara taşındı. Yeni
türler: `bench` · `planter` · `topiary` · `lantern` · `bikerack`.

## 6. Yakalanan gerçek ilerleme hataları

- **`KAPI TIKALI: dekor:palm` (Köşe)** — palmiye girişin 1,2 birim
  önündeydi. Ekranda hiçbir uyarı çıkmaz ama çıkamayan müşteri nüfus
  tavanını kilitler. Taşındı.
- **`KAPI TIKALI: Veranda 2` (Sahil)** — 6 kişilik masa kapı ekseninden
  yalnız 0,88 birim bırakıyordu (gereken 1,1). x 0,4 → **−0,6**, yeni
  boşluk 1,88. Neden z'de değil x'te çözüldü: kapı kontrol noktaları 1,2
  birim aralıklı ve masanın yarı gövdesi 0,72 → iki komşu noktadan aynı
  anda 1,82 uzakta durmak imkânsız (1,2 < 2×1,82). Yanındaki fener, Kum
  Masası 4 ile arasındaki 3,16 birimlik açıklığın ortasına alındı (iki yana
  1,38; her iki yana 1,5 vermek bu açıklıkta geometrik olarak mümkün değil).
- **Bulaşık Kovası ↔ saksı 1,16 → 1,76** (kominin en sık gittiği istasyon).
- **Avlu kaide saksıları r1/r2 ödeme pedlerinin 0,15 birim yanındaydı** —
  fiilen pedin içinde ve oda portallerinin ağzında. Avlunun kuzey
  köşelerine alındı.
- **Sahil'de üç dekor hatası**: ÇAKIŞMA (Kumsal Kovası ↔ saksı 0,04 iç
  içe), TUZAK (Veranda Kovası ↔ palmiye 0,39), TUZAK (Veranda 2 ↔ saksı
  0,93). Üçü de düzeltildi. Sahil şemsiyeleri masalarının tam üstündeydi
  (`GÖRÜŞ KAPALI`), 1,2 birim kuzeye alındı.

## 7. `validateSightlines` yanlış alarm üretiyordu

Doğrulayıcı hedef yüksekliğini `y = 1.2` sabitiyle alıyor ve kot farkını
yok sayıyordu. VIP terası 0,9 birim yükseltilmiş bir podyumun üstünde
olduğu için o nokta terasın KENDİ zemininin 30 cm ALTINA düşüyor, ışın
podyuma çarpıyor ve üç VIP masası için "GÖRÜŞ KAPALI" yazıyordu.

Yanlış alarm bu projede tek başına bir hata sınıfıdır (bkz.
`validateClearances`'ta 28 uyarılık ilk sürüm): okuyan kişi listeyi tümden
yok saymaya başlar. Hedef artık `floorLiftAt` ile okunuyor — çizime giren
her şeyin zaten kullandığı fonksiyon. **A/B doğrulaması:** eski `y=1,2` ile
üç VIP masası da engel raporluyor, yeni `kot+1,2` ile üçü de temiz; yani
doğrulayıcı körleşmedi, yalnız doğru noktaya bakıyor.

## 8. Hijyen: otomasyonu olmayan TEK temizlik işi

Ölçüm: iki 50 dakikalık koşuda da hijyen 48-52'de sabitlendi. Sebep denge
kayması değil YAPISAL boşluktu — her temizlik işinin bir personel karşılığı
var (bulaşık, leke, tuvalet, sarf) ama trafik kirini yalnızca elinde
süpürge olan OYUNCU silebiliyordu (`cleanStroke`'un tek çağrı yeri oyuncu
etkileşimiydi). Üstelik rehber oku süpürgeyi ancak servis işi YOKKEN
öneriyor; geç oyunda kafe hiç boşalmadığı için oyun süpürgeyi fiilen hiç
önermiyordu. Sonuç tek yönlü bir cırcır: kaplama yalnız artıyor ve
`Environment.grime` zemini kalıcı olarak karartıyor.

Ekonomik tarafı zaten "asla cezalandırma"ya uygundu (50 hijyen = 1,05×;
bu dosyada öngörülmüştü). **Bedel GÖRSELDİ** — mekân geç oyunda hep kirli
görünüyordu.

**İlk çözüm denendi ve ÖLÇÜMDE ÇÖKTÜ:** "komi boştayken en kirli noktaya
gidip ovsun". Hızı 55 → 2000 (36 kat) yapmak ağır kaplamayı 0,382'den
yalnız 0,391'e taşıdı. Sebep hız değil GEOMETRİYDİ: kir 14 hareketli aktör
tarafından saniyede ~1540 birim ve BÜTÜN zemine yayılarak üretilirken komi
0,55 yarıçaplı tek bir daireyi ovuyordu. Dağıtık üretimin karşılığı dağıtık
söküm olmak zorunda.

**Çalışan çözüm:** komi YÜRÜDÜĞÜ İZİ siler (`busserSweepRate: 600`,
yarıçap 0,34). Komi zaten sürekli ve tam da en çok basılan hatlarda yürür;
izini silmesi üretimin aynası olur. Süpürge belirgin üstün kalır (kare
başına 200 ≈ saniyede binlerce) ve trafik kirinin PARA ödülü yalnız
oyuncuda kalır — yoksa süpürgeyi almanın sebebi kalmazdı. Hız taraması
600'ün üstünde kazanç vermiyor (1200 → 0,091 · 2400 → 0,100).

## 9. Arayüz cilası

- **Toast yığını yıkıcı onayın üstünü kapatıyordu.** DOM'da panelden sonra
  eklendiği için üste boyanıyor ve alt orta köşede (bottom 74 px) tam
  panelin buton alanına düşüyordu; "Sokağı Devret" onayında oyuncuya NEYİ
  KAYBEDECEĞİNİ söyleyen "SIFIRLANIR / KALIR" sütunlarını örtüyordu. Panel
  açıkken üst şeride taşındı (`ui.panel-on`, kodun kendi `tut-on` kalıbı):
  panel üst kenarı 218 px, toast alt kenarı 129 px — 89 px boşluk.
- **Kesilen yükseltme adları** ("Rahat Ayakk…", "Servis Te…"). Ölçüldü: bir
  seviye noktası 10 px yer kaplıyor ve kutu küçülmüyor, 10 seviyelik
  yükseltmede 100 px yalnız noktalara gidiyor. `levelPips` eşiği 12 → **6**;
  dayanağı işlevsel: nokta dizisi ancak TEK BAKIŞTA SAYILABİLDİĞİ sürece
  bilgi taşır, on iki noktayı kimse saymaz ve orada "Sv 7/10" hem daha
  okunaklı hem üçte bir yer kaplar. Altı panelde kesik ad sayısı 0.

## Denendi ve GERİ ALINDI

- **Giriş koridoruna "karşılama yolu" döşemesi.** Avlu panelinin aynısı
  kapı ile avlu arasına eklendi ve 375×812'de ölçüldü: sonuç daha kötüydü —
  iki neredeyse özdeş soluk dikdörtgen ALT ALTA geliyor, mekân
  "tasarlanmış zemin" değil TEKRAR EDEN ŞERİT okunuyor ve yolun büyük
  bölümü giriş tentesinin arkasında kalıyor. **Ders: bir motif kadrajda BİR
  KEZ işe yarar; ikinci kopyası boşluğu doldurmaz, motifi ucuzlatır.**
- **Sarkıt kaydırma 0,95** → lamba masadan koptu, boş zeminin üstünde
  sahipsiz kaldı. 0,58.
- **Avlu paneli 6,4 genişlik** → yan kenarları kadraj dışında, "taş halı"
  değil ekranı kesen yatay şerit. 4,8.
- **Panel dolgusu `mix(wall, floorAlt, 0,4)`** → avlu karosuyla arasında %5
  parlaklık farkı, panelin içi hiç okunmuyordu. `mix(wall, wallTrim, 0,16)`.
- **Salon Odası'na yer dekoru** → tekne Masa 8'e 0,42, köşe şimşiri 0,51
  bırakıyordu (tuzak bandı); kuzey şeridi t6 pedinin içine düşüyor. Oda
  7,5×8,2 ve üç masalı — dolu. Asma bitkiye geçildi.
- **VIP halısı 2,9×2,4** → üç halı tek kırmızı bloka birleşti. 2,6×2,1.

## Ölçüm (2 × 50 dakikalık bot koşusu, temiz başlangıç)

| Ölçüt | Önce (A/B) | Sonra (A/B) | Hedef |
|---|---|---|---|
| **Hijyen (bitiş)** | 52 / 48 | **62 / 76** | > 60 |
| **Ağır kaplama** | ~0,38 | **0,167 / 0,174** | izler görünür kalmalı |
| **Kızgın oran** | ~%16 | **%8 / %7** | ~%15 |
| Açılan bölge | 17 / 16 | **17 / 17** | tamamı |
| Oda 2 (r1) | 8:30 / 9:04 | 11:12 / 11:25 | 8-17 dk |
| VIP (r2) | 31:01 / 39:56 | **37:36 / 32:11** | GDD 35-45 |
| İlk açılım (t1) | 0:28 / 0:49 | 0:28 / 0:30 | ~0:30-0:45 |

Kızgın oranının yarıya inmesi beklenmedik bir yan kazanç: temiz mekân
hijyen çarpanını yükseltiyor ve kirli masa tıkanması azalıyor.

**Ölü boşluk metriği yanıltıcı çıktı — fiyatlara DOKUNULMADI.** Botun
"alımsız boşluk" ölçüsü yalnız bölge ve personel alımlarını sayıyor;
oyuncunun asıl harcama kanalını görmüyor. Aynı koşumda **110 istasyon
yükseltmesi** alındı (ortalama her 27 saniyede bir satın alma), yani "7
dakika boyunca yapacak bir şey yok" okuması gerçek değil. VIP zamanlaması
bu turda ilk kez GDD bandına oturduğu için fiyat değiştirmenin karşılığı yok.

## Doğrulama

| Ölçüt | Sonuç |
|---|---|
| `npm run build` | başarılı — 412,38 kB app + 482,04 kB three (gzip 136 + 121) |
| `validateLayout` Köşe (erken / geç) | **0 ciddi / 0 ciddi** (13 SIKIŞIK bilgi notu) |
| `validateLayout` Sahil | **0 ciddi** (önce 1 × KAPI TIKALI) |
| `validateSightlines` | **boş** |
| Çizim çağrısı (geç oyun) | 411-462 · üçgen ~53k |
| Kare süresi | tick 2,87 ms + render 2,21 ms |
| Konsol hatası | yok |

**Kapsam dışı kalanlar:** gerçek cihaz testi (donanım gerekiyor — soğuk
açılış, ısınma, pil, bildirim ikonu, geri tuşu, tablet yatay kadraj);
`GÖRÜŞ KAPALI: Peçete Kutusu` (mutfak mimarisi kaynaklı, dekordan bağımsız
olduğu ablasyonla doğrulandı); 13 SIKIŞIK notu (hepsi istasyon↔istasyon
veya istasyon↔oda duvarı, hiçbiri dekor kaynaklı ve hiçbiri tuzak bandında
değil).


## Oyuncu geri bildirimi turu (2026-08-14, akşam)

### 1. Kamera birazcık açıldı

`camera.maxDistance` 20 → **22** (pitch 48 sabit; pitch derinliği, mesafe
karakter boyunu kontrol eder). Ölçüm (375×812): görünen genişlik **8,2 →
9,44** birim, derinlik **32,4 → 35,5**, karakter **52 → 47 px** (%6,4 →
%5,8). Tür normu karakteri ekranın %8-14'ünde tutar, yani zaten alt
banttaydık; d24 ve ötesi "kat planı gibi okunuyor" sorununu geri getirir —
sınır burada.

### 2. Süpürge niyet kapısı 1,0 → 0,75 sn

Kapının sebebi duruyor (süpürge dolabı kova gibi sık ziyaret edilen
istasyonların yanında olabiliyor, yanlış alım can sıkar) ama 1 saniye
gereğinden uzundu. 0,75 hâlâ alma kapısının (0,35) iki katı ve kapı
yalnız oyuncu YAVAŞLADIĞINDA dolduğu için yanından koşarak geçmek onu
zaten dolduramıyor.

### 3. Süpürge: tek geçişte temizlik

Geri bildirim: *"süpürge ile çok az yer süpürülüyor… üzerinden tekrar
tekrar geçilmesin, tek seferde geçilsin."*

Ölçüm sebebi buldu: fırça yarıçapı 0,42 (çap 0,84) iken leke yarıçapı
0,85 (çap 1,7) — tek geçiş lekenin ancak yarısını alıyordu. Daha kötüsü,
**aynı çizgiden ikinci geçiş HİÇBİR ŞEY yapmıyordu** (0,40 → 0,40), çünkü
o hücreler zaten silinmişti; oyuncu ilerleme görmüyordu.

| Fırça | Tek geçişte | Aynı çizgiden ikinci geçiş |
|---|---|---|
| 0,42 (eski) | %60 | 0 |
| **0,80 (yeni) · sıvı** | **%100** | — |
| **0,80 (yeni) · toz** | %80 | — |

**Başlık da büyütüldü (0,52 → 1,50 birim).** Fırçayı tek başına büyütmek
yanlış cevap olurdu: 0,26 yarı genişlikteki bir başlıkla 0,8'lik fırça,
dokunulmayan yeri temizler — bu tam olarak daha önce şikâyet edilip
düzeltilen davranıştır. Mekanik genişleyecekse görsel de genişlemeli;
gerçek süpürgelerin zemin başlığı zaten gövdesinden geniştir. Fırça (0,80)
artık başlığın yarı genişliğinden (0,75) yalnızca bir tık cömert.
Süpürgesiz değerler değişmedi (paspas 0,3 · elle toz 0,13).

### 4b. Oyuncu geri bildirimi turu — devam (aynı gün)

Aşağıdaki bölümler bu turun ikinci yarısı: reklam sistemi, süpürge robotu,
oda tabelaları, isimli müdavimler ve süpürgenin keşfi.

### 4. "Yerler çok hızlı kirleniyor" — ÜRETİME DOKUNULMADI

Ölçüm bunu desteklemedi: 50 dakikalık koşum sonunda yerde 14 kapasiteden
yalnız **2 leke** var, hijyen **70**, kızgın **%7,1**. Hızlı kirlenme
hissinin kaynağı üretim değil, süpürgenin geçiş başına %60 alıp aynı
çizgide tekrar geçince hiçbir şey yapmamasıydı (yukarıdaki madde) ve
otomasyonu olmayan trafik kiriydi (bir önceki turda çözüldü). Doğrulama
koşumu: 17/17 bölge · r1 11:10 · r2 31:30 · üretim derlemesi başarılı ·
`validateLayout` 0 ciddi · `validateSightlines` boş.

### 5. REKLAM SİSTEMİ — beş ödüllü yerleşim + disiplinli geçiş reklamı

`src/core/Ads.ts` yeniden yazıldı. Değişmeyen kural: **reklam asla bir kapı
değildir.** Bu kural ödüllerin SEÇİMİNİ de belirliyor; her ödül üç şarttan
geçmek zorunda: (1) oyuncunun elle yapabileceği bir şeyi hızlandırır,
yerine geçmez; (2) süreli ya da tek seferliktir — kalıcı güç veren ödül,
izlemeyen oyuncuyu kalıcı geride bırakır ve reklamı fiilen kapıya çevirir;
(3) izlenmediğinde bir şey KAYBEDİLMİŞ hissi doğurmaz.

| Yerleşim | Ödül | "İstek anı" koşulu |
|---|---|---|
| `happy_hour` | 4 dk ×2 kazanç | Sürerken tekrar teklif edilmez |
| `zone_finish` | Kalan ödeme kapanır | **Ödemenin ≥%40'ı yapılmış olmalı** |
| `robot_vacuum` | 3 dk otomatik temizlik | Ağır kir > 0,08 ya da ≥3 leke |
| `stock_refill` | Depolar dolar | Toplam doluluk < %60 |
| `daily_double` | Günlük ödül ×2 | Ödül henüz alınmamışken |

Doğru AN, ödülün kendisinden önemli: her zaman ekranda duran teklif teklif
körlüğü yaratır. `zone_finish` eşiği özellikle kritik — eşiksiz hâli
"bölümü reklamla satın al" demek olurdu; %40 ile satılan şey ilerleme
değil SON ADIMIN beklemesi.

**Ölçüldü:** sağlayıcısız derlemede hazır teklif sayısı **0** (arayüzde
"reklam" kelimesi geçmiyor, oyun eksiksiz oynanıyor); sahte sağlayıcıyla
dördü açılıyor, `showRewarded` çağrıları doğrulandı, ödüller gerçekten
uygulanıyor.

**Geçiş reklamı (interstitial) altyapısı VAR ama VARSAYILAN KAPALI.**
Sebep ideolojik değil: bu oyunun kimliği "seni cezalandırmayan kafe" ve
zorunlu reklam oyuncunun istemediği anda kontrolü elinden alır — tam
olarak bir ceza. Kabul edilebilir tek hâli oyuncunun ondan
KURTULABİLMESİDİR ("Reklamları Kaldır" satın alması); o satın alma yokken
açmak kaçışı olmayan bir rahatsızlık üretir. Açıldığında disiplin hazır:
yalnız doğal aralarda (şube değişimi, devir), ilk 180 sn hiç, iki reklam
arası ≥240 sn, oturum başına ≤3.

### 6. SÜPÜRGE ROBOTU — ve dağıtık üretim dersinin tekrarı

`src/sim/RobotVacuum.ts` (yeni). Robot `World`'e TEK SATIR eklemeden
yaşıyor: yalnız açık API'leri kullanıyor (`grime`, `spills`, `nav`,
`root`) ve süresi bitince iz bırakmadan yok oluyor.

**İlk sürüm ölçümde çöktü:** 25 saniyede ağır kaplamayı 0,154 → 0,155
yaptı, yani hiç. Sebep hız değil GEOMETRİYDİ — bu projede komide de
ölçülen aynı ders: kir 14 aktör tarafından saniyede ~1540 birim ve BÜTÜN
zemine yayılarak üretilir; dar bir daireyi ovan tek temizleyici ona
yetişemez. Genişletilip hızlandırıldı (yarıçap 1,1 · 2600/sn · tempo 3,4).

**Ölçüm (robot çalışırken):**

| An | Ağır kir | Yerdeki leke | Hijyen |
|---|---|---|---|
| Öncesi | 0,166 | 1 | 67 |
| 45. sn | 0,146 | 0 | 79 |
| 90. sn | 0,128 | 0 | 78 |
| 135. sn | 0,123 | 1 | 74 |
| 180. sn (robot gitti) | 0,137 | 1 | 72 |

Kir %26 düşüyor, robot gidince geri tırmanıyor — süreli yardımın doğru
şekli. Robot PARA KAZANDIRMAZ: trafik kirinin ve lekenin ödülü oyuncunun
kendi emeğine ait kalır, yoksa süpürgeyi almanın sebebi kalmazdı. Şube
değişiminde ve devirde düşürülür (sızıntı yok).

### 7. SÜPÜRGENİN KEŞFİ — sessiz kayıp kapandı

Süpürge oyunun en görünmez mekaniğiydi: rehber oku onu yalnız
`!hasServiceWork()` iken önerir. Bu şart BİLİNÇLİ ve kalmalı (kaldırılınca
ölçümde oyuncu süpürgeyi alıp servise bir daha dönmemiş, kazanç %64
düşmüştü) — ama yan etkisi şu: kafe büyüdükçe servis işi hiç bitmez, yani
ok süpürgeyi FİİLEN HİÇ göstermez. Mekanik var, oyuncu yok.

Çözüm okun kuralını değil KEŞFİ hedefliyor: öğretici bittikten sonra zemin
ilk kez gerçekten kirlendiğinde (ağır kaplama > 0,09) tek seferlik bir
tanıtım çıkar, kayda yazılır ve bir daha çıkmaz. Oyuncu süpürgeyi kendi
bulmuşsa hiç gösterilmez. **Ölçüm: 120 saniyede 1 kez, sonraki 60 saniyede
0 kez.**

### 8. ODA TABELALARI — profilden görünüyorlardı

Geri bildirim: *"salon isimleri okunmuyor konumlarından dolayı."*

Teşhis: tabela `plane(2.6, 0.5)` olarak kuruluyor ve YAN kapılarda 90°
döndürülüyordu. Kamera yaw 0 ile kuzeye baktığı için x-sabit bir yüzey
ekranda **sıfır piksel** kaplar; iki odanın da kapısı yan kenarda olduğu
için İKİ tabela birden görünmüyordu.

Çözüm **çıkma pano**: tabela duvara paralel değil, duvardan omurgaya DİK
uzanır — gerçek dükkân tabelalarının cepheye dik asılmasıyla aynı sebep.
Kapı hangi kenarda olursa olsun yüz +z'ye bakar. Yön tek başına yetmedi:
48°'lik kamerada dik yüz yüksekliğinin %33'ünü kaybettiği için pano
**0,5 rad yatırıldı** (kayıp %6'ya indi; ödeme pedi levhası da aynı numarayı
kullanıyor) ve punto plakaya oturtuldu (`fill` parametresi, varsayılan
kapalı → diğer ~20 levha aynen kaldı).

**Ölçüm:** harf yüksekliği **0 px → 14,0-15,5 px**, plaka ekranda 160×37 px
(genişliğin %43'ü), kontrast 12,2:1 (salon) ve 8,8:1 (VIP). Maliyet
+4 çizim çağrısı (%0,70); iki tabela aynı kadraja hiç giremediği için
gerçek delta daha düşük.

**Ped tekrarı da kaldırıldı:** tabela "VIP SALON" derken hemen altındaki
ödeme pedi de "VIP SALON" yazıyordu — aynı kadrajda aynı kelime iki kez.
Etiket enflasyonu bu projede bilinen bir hata sınıfı olduğu için ad,
TABELASI OLAN bölümlerde pedden düşürüldü (fiyat ortalanıp büyütüldü);
tabelası olmayan bölümlerde (masa, makine) ad olduğu gibi kaldı.

**Sınır (açıkça):** "her açıdan okunabilir" tam anlamıyla sağlanmıyor.
Tabela, odanın kendisi kadrajdayken okunur; omurganın ortasından (x 0),
girişten ve bar önünden görünmez. Sebep geometrik: portre kadraj odak
düzleminde 9,0 birim, iki kapı 18 birim arayla — o noktalarda odanın
kendisi de kadrajda değildir. Tabelayı omurgaya uzatmak, yasaklı olan
"kadrajın ortasından geçen kütle" hatasına döner.

### 9. İSİMLİ MÜDAVİMLER

Yedi müdavim (Nazmiye Teyze · Rasim Hoca · Selin · Ferhat Abi · Bülent Bey
· Gülcan Abla · Onur), her biri FARKLI arketipte — plaka kapandığında
birbirlerine karışmasınlar diye. Arketip altyapısının üstüne binen ince bir
kimlik katmanı; yeni müşteri sistemi kurulmadı.

- **Görünüş kararlı**: `REGULARS[].seed` sabit, `createAppearance` saf →
  aynı müdavim her gelişinde bire bir aynı. **7/7 doğrulandı** (26-32
  malzeme rengi + boy karşılaştırması).
- **Ad plakası sürekli durmaz**: yalnız tanıma anı (`toCounter`/`queue`/
  `order`) ve servisten sonra 3,5 sn. Ölçüm: kadrajda **%84,8 sıfır plaka,
  %15,3 bir plaka, iki plaka hiç** — etiket enflasyonu yok.
- **"Her zamanki"** yalnız menüde VE stokta varsa istenir (%94,3 tuttu);
  tutmazsa normal davranır.

**Yolda bulunan iki hata düzeltildi:**
1. **Müdavim sessiz bir CEZAYDI.** İlk sürümde "her zamanki" `qty: 1`
   sabitti: müdavim başına 1.483 ₺ / 1,80 adet, sıradan müşteri 2.565 ₺ /
   2,17 adet — **%42 daha az para**. Ödül diye kurulan mekanik oyuncuyu
   cezalandırıyordu. Adet arketipten çekilir oldu, `tipMult` 1,15 → **1,3**
   ölçülerek pariteye ayarlandı (VIP 2,4 ve fenomen 1,7'nin altında).
2. **Plaka komşuya taşıyordu** ("Nazmiye Teyze" 2,13 birim, arkadaki
   misafirin kafasını örtüyordu). 1,5 birim sınır + uzun adlarda punto
   küçültme; en geniş plaka artık 1,499.

Ölçüm (50 dk bot, sevk edilen kod): 17/17 bölge · r1 8:57 · hijyen 73,3 ·
kızgın %8,04. Kontrol koşumu (müdavim kapalı): r1 10:06 · hijyen 72,6 ·
kızgın %8,34 — ekonomi bozulmadı.

### 10. İSTEK BALONU BEŞTE BİR BOYUTTA ÇİZİLİYORMUŞ

Müdavim işi sırasında bulundu, tüm müşterileri etkiliyordu.
`Customer.showBubble()` kare başına yumuşatma adımı olarak yazılmıştı
(`+= (hedef − şu) * 0,2`) ama yalnız DURUM GEÇİŞLERİNDE çağrılıyordu: tek
çağrı ölçeği 0'dan ancak 0,19'a taşıyor ve orada bırakıyordu.

Ölçüm (12 canlı müşteri): `toCounter` **0,19** · `seated` **0,342** —
hedeflenen **0,95**'e hiç ulaşmıyor. "Müşteri ne istiyor" oyunun ana
sorusu olduğu için bu doğrudan okunaklılık kaybıydı.

Hedef yumuşatmadan ayrıldı: `showBubble` artık yalnız hedefi yazıyor,
süzme `updateVisual`'da her karede ve kare hızından bağımsız
(`Math.min(1, dt * 12)`). **Doğrulama: tüm canlı balonlar 0,95.**

---

# Oyun testi turu — beş hata + dekorasyon (2026-08-14, akşam)

Oyuncunun gerçek oturumda bildirdiği beş hata. Hepsinin SEBEBİ ölçülerek
bulundu; hiçbiri tahminle düzeltilmedi.

### 1. Süpürge bırakılınca ses devam ediyordu

`AudioManager.setVacuum` içinde motor titreşimini veren LFO doğrudan kazanç
parametresine bağlıydı. Web Audio'da bir sinyal AudioParam'a BAĞLANDIĞINDA
değere **eklenir** — yani `g.gain` sıfıra indirilse bile LFO ±0,045'lik bir
salınım enjekte etmeye devam ediyor ve uğultu süpürge bırakıldıktan sonra da
duyuluyordu. Modülasyon derinliği artık ana kazançla birlikte sönüyor.

### 2. Sabit dururken süpürge titriyordu

Başlık salınım genliği `0,04 + hız × 0,018` idi: hız sıfırken bile taban
0,04 rad kalıyor, başlık 1,43 Hz'de sonsuza kadar sallanıyordu. Duran bir
cismin kendi kendine titremesi "boşta salınım" değil ARIZA okunur. Genlik
artık tamamen hızdan türüyor (taban yok) ve süzülüyor.

### 3. VIP merdiveninin içinden geçiliyordu

`floorLiftAt` ikili bir eşikti: oda dikdörtgeninin içinde `lift`, dışında 0.
Merdiven ise dikdörtgenin DIŞINDA, kapı boşluğunun önünde. Karakter
basamakların üstünden düz zeminde yürüyüp içlerinden geçiyor, kotu ancak
odaya girdikten SONRA kazanıyordu. Kot artık merdivenin gerçek koşusu
boyunca artıyor (`STAIR_RUN = 1,7` — Environment'taki 5 × 0,34 ile aynı
sabit; ayrışırsa karakter ya basamağa gömülür ya havada yürür).

**Ölçüm (VIP kapısı, z 13,7):** x −7,3 → 0 · −8,0 → 0,371 · −8,6 → 0,688 ·
−9,0 (oda kenarı) → 0,900. Kapı bandının dışında (z 17,0) rampa yok.

### 4. Teslim bankosundan YANLIŞ ürün alınıyordu

*"Kruvasan alıp masaya götürmek isterken çay alıyor."*

`takeOutput()` bankoda `contents.shift()` yapıyordu — FIFO. Aynı kökten
ikinci hata: rehber oku da yalnız `contents[0]`'a baktığı için, gereken ürün
ilk sırada değilse bankoyu HİÇ göstermiyordu. Artık ikisi de aynı talep
kuralını okuyor (`demandSet` → `takeWanted` / `peekWanted`): masada bekleyen
siparişlerin istediği ürün bankoda varsa o alınır, talep yoksa eski davranış
korunur.

**Ürün başına ayrı banko YAPILMADI, ürünler azaltılmadı:** v3.0'da dokuz
özdeş vitrin tek bankoya indirilmişti çünkü bar "dokuz özdeş dolaptan oluşan
bir duvar" gibi okunuyordu. Sorun banko sayısı değil SEÇİM mantığıydı.
Garsonlar bunu zaten doğru yapıyordu (`Staff.fetchItem`); eksik olan oyuncuya
aynı yeteneğin verilmemesiydi.

### 5. Ödüllü reklamlar hiç görünmüyordu — iki ayrı sebep

**(a) Sağlayıcı yoktu.** Google'ın resmî TEST kimlikleri bağlandı:
`@capacitor-community/admob`, `src/core/AdMobProvider.ts`, manifeste AdMob
App ID + INTERNET izni. Test kimlikleri hesap gerektirmez. Ödül yalnız
`Rewarded` olayıyla verilir (`showRewardVideoAd()` erken kapatmada da döner).
AB/UK rıza akışı (UMP) eklendi. **Tarayıcıda çalışmaz** — eklenti yalnız
native platformda; reklamlar APK'da görünür.

> **Yayından önce kendi App ID'n konmalı** — boş/yanlış App ID ile uygulama
> AÇILIŞTA ÇÖKER. INTERNET izni geri geldiği için Data Safety beyanı ve
> `gizlilik-politikasi.html` güncellenmeli (oyun içi metin `hasAdProvider()`
> ile kendiliğinden düzelir, mağaza sayfası düzelmez).

**(b) Teklifler yalnız panellerin içindeydi.** Paneli açmayan oyuncu sistemin
varlığını hiç öğrenmiyordu. Sol kolonda kendiliğinden beliren tıklanabilir
bir **teklif çipi** eklendi: öğretici bitmeden ve panel açıkken görünmez,
iki teklif arası ≥150 sn, 14 sn sonra kendiliğinden kapanır, kapatma düğmesi
var (reddedilemeyen teklif, teklif değil engeldir). **HUD'a beşinci buton
eklenmedi:** üst yığın 87,8 px → 87,8 px.

**Ölçüm:** çip 150. saniyede belirdi (`robot_vacuum`), İZLE → reklam
gösterildi, çip kapandı, robot sahneye girdi. Çip DOM'da canvas'ın ÜSTÜNDE
olduğu için joystick (canvas `pointerdown`) ile çakışmıyor — sınandı: çipin
alt kenarına basıldığında joystick büyüklüğü 0'da kaldı.

## Dekorasyon / kişiselleştirme

Dört eksen (duvar · zemin · masa tablası · üniforma), 21 seçenek, 6'sı
bedava, toplam ₺1.078.500. Kozmetikler oyunu ETKİLEMEZ: bir görünüm
istatistik verseydi oyuncu güzel bulduğunu değil güçlü olanı seçerdi.

**Fiyatlar ölçümle kuruldu.** Seçenek değişince değişen piksel oranı
(375×812, geç oyun): zemin %20-36 · duvar %0-8,5 · masa %0-3,2 · üniforma
%0-1,8. İlk taslakta duvar ₺200.000'e çıkıyordu; ölçüm gösterdi ki pitch 48°
portre kamerada duvarlar salon ortasında **hiç ekranda değil**. Duvar en ucuz
eksen oldu, zemin en pahalısı.

Okunaklılık sayıyla kuruldu (duvar L* 85-95, zemin L* 48-91, doygunluk
≤ 0,52). Varsayılanlar sabit hex değil şubenin KENDİ paleti. Panel "göz ucu"
modunda açılıyor (58dvh, şeffaf perde) — normal kabuk arkayı tamamen
gizlediği için "seçtim, o an değişti" anı görünmüyordu.

**Doğrulama:** çizim çağrısı 16 kombinasyonun hepsinde 703 (fark %0,0 — doku
takası mesh eklemez); kayıt turu ve eski-kayıt geri düşüşü sınandı; HUD sabit;
50 dk bot ×4 ekonomiyi etkilemedi.

## Ölçüm aracına dair uyarı (ileride yanıltmasın)

`Game.tick()` zaman damgası DEĞİL, saniye cinsinden DELTA alır (gerçek döngü
`tick(Math.min(raw, 0.1))` çağırıyor). Konsoldan `G.tick(performance.now())`
çağırmak sim tarafında zararsızdı — `dt` zaten `maxDelta` (0,05) ile
kırpılıyor — ama UI zamanlaması ham değeri kullandığı için teklif çipi
ölçümü saçmalıyordu (`adChipLife` −121.689). Konsolda `G.tick(1/60)` kullan.

## Son durum

| Ölçüt | Sonuç |
|---|---|
| `npm run build` | başarılı |
| 50 dk bot | 17/17 bölge · r1 8:52 · r2 26:45 · kızgın %7,8 · hijyen 68 |
| `validateLayout` | 0 ciddi |
| Çizim çağrısı | ~703 |

**Açık kalan:** hijyen koşumlar arası 58-76 bandında salınıyor (ortalama
~66). ">60" çoğu koşuda tutuyor ama hepsinde değil. Ceza değil (60 hijyen
1,09× bonus) ama bir sonraki denge turunda komi/toz katsayıları yeniden
ölçülmeli.

---

# v5.0 — SELF-SERVİS KAFE (2026-08-15)

Oyuncu geri bildirimi doğrudan tasarım girdisiydi: *"personeller her işi
yapıyor, bize gerek kalmıyor"*, *"kasaya gelen kendisi alsın kendisi
götürsün"*, *"her ürüne ayrı teslim noktası"*, *"cihaz ısınıyor,
pixelleşiyor"*, *"ödüllü reklam belirmiyor"*, *"kilitli yerlerde ne
açılacağı yazsın"*, *"müşterinin üstündeki kâğıt ne alaka"*.
Spec: `docs/superpowers/specs/2026-08-15-v5-self-servis-design.md`.

## 1. Döngü değişti: müşteri KENDİ alır, KENDİ taşır

Eski akış (sipariş → mutfak → banko → GARSON/OYUNCU masaya taşır → masada
hesap) tamamen kalktı. Yeni akış: **kasada sipariş + PEŞİN ödeme** (nakit
kasada birikir, oyuncu toplar) → müşteri ÜRÜNÜNÜN RAFINA yürür →
**kendisi alır** → boş masa varsa oturup yer, yoksa ürünüyle memnun
çıkar. Masaya servis diye bir iş artık yok; "kim ne istiyor, ne
götürülecek" sorusu müşterinin kendinde.

- **Sipariş TEK KALEM** (bir ürün × 1-3 adet) ve yalnız STOKTAN seçilir.
- **Menü 9 → 5 SKU** (çay 25 · latte 82 · tost 210 · waffle 520 ·
  frappe 1150); espresso/kruvasan/cheesecake/limonata ve makineleri
  silindi. Bar hattı: 2 kasa + 5 ürün rafı (yeni `shelf` görseli, 1,5
  birim — gövde=görsel kuralıyla). Sahil'e de 3 raf eklendi.
- Ödeme `chargeOrder` ile sipariş anında; VIP/teras/hız bahşişi masada
  `completeOrder` ile kendiliğinden hesaba yazılır (toplama yüzeyi icat
  edilmedi). İade yok; ürünsüz çıkan müşterinin bedeli itibardan düşer.
- `stats.served` artık raftan alınan birimde artar — hedef zinciri,
  sonsuz hedefler ve günlük görevler değişmeden çalışır.
- Garson **Tezgâhtar** oldu (yalnız makine → kendi rafı ikmali); hız
  eğrileri yatıklaştı (L10: tezgâhtar 7,6 · komi 8,3 — oyuncu 12,6'nın
  hep altında). Yeni **"el ver"** bonusu: oyuncu makinenin başındayken
  çevrim 2× (barista ile toplanmaz, büyüğü geçer).
- Müşteri akış regülatörü raf ikmal kapasitesine bağlandı; sıra tavanını
  kasiyer yönetir. Kasa nakit tavanı 30 → 40.
- Öğretici 9 adım (sipariş al → parayı topla → çayı al → RAFA koy →
  müşterinin kendi aldığını gör → ...); her adımda kaçış kapısı.
- `SAVE_VERSION` 8 — eski kayıtlar okunmaz, temiz başlangıç.

**Ölçüm (temiz 2 × 50 dk bot):** 17/17 ve 16/17 bölge · t1 1:05-1:08 ·
r1 10:25-12:10 · r2 37:42-42:15 (GDD bandı) · kızgın **2-3** (eski %7-15'e
karşı ~%0,15 — self-servis kızgınlık yollarını yapısal olarak kapattı) ·
hijyen 68-74 · yerleşim doğrulayıcıları 0 ciddi (12 SIKIŞIK bilgi notu) ·
görüş hattı temiz. Erken ped bandı peşin ödemeye göre yeniden fiyatlandı
(t1 150→300 … t3 3200→4800; ilk ölçümde t1 4. SANİYEDE açılıyordu).

## 2. Termal bütçe: ısınma ve "pixelleşme"

Kök neden ölçüldü: adaptif kalite `low`'a düşünce `maxDpr 1` yapıyordu —
DPR-3 panelde 4× çözünürlük kaybı, S23'teki pixelleşmenin ta kendisi;
üstelik dönüş eşiği (6,5 ms) ~700 çizim çağrılı sahnede erişilemezdi.
İkinci kök: eski ayar kaydı `quality` alanı yoksa cihaz saptamasını
atlıyor, S23 `high` kademesinde (MSAA + 2048 gölge + 41 mesh/karakter)
kavruluyordu. Üçüncü: `applyTier` aynı kademede erken dönünce `dprCap`
1,5'te kalıyordu — "high", "medium"dan DÜŞÜK çözünürlükteydi.

- **Çözünürlük artık kutsal:** `DPR_CAP 2,0` tüm kademelerde sabit;
  adaptif sistem DPR'a DOKUNAMAZ. Pixelleşme yapısal olarak imkânsız.
- **Isı merdiveni** (Quality.evaluateHeat): CPU iş süresi EWMA + gerçek
  fps; kademe değil KISMA basamakları — gölge 1024 → charLod →
  müşteri −6 → gölge kapalı → **30 fps serinleme** (son basamak).
  Histerezisli ve tamamen geri dönüşlü.
- **Kare planlayıcı vsync-farkında** (60/30 hedef-zaman birikimli):
  90 Hz'de 45 fps'e düşme hatası bitti; arka planda rAF tamamen iptal.
- **Statik sahne diyeti:** sokak 574 mesh → 17 birleşik mesh; statik
  ağaçta `matrixAutoUpdate=false`; istasyon görsel güncellemeleri kirli
  bayrakla (47 istasyon × her kare `computeBoundingSphere` bitti);
  personel de müşteri gibi kadraj dışında çizilmiyor; `#grade` tam ekran
  karışım katmanı telefonlarda hiç yok; `powerPreference` native'de
  `'default'`.
- Ayarlar'a **🎚️ Grafik: Otomatik · Yüksek · Orta · Düşük** seçicisi;
  `?perf=1` ile cihazda perf yazısı (fps · çağrı · üçgen · kademe · ısı).

## 3. Ödüllü reklam: görünür, süreli, güvenilir

Cihazda hiç görünmemesinin kökleri: (a) beş yerleşim TEK test reklam
nesnesini paylaşıyordu — ilk gösterimden sonra hayalet teklifler;
(b) UMP rıza hatası `initAds`'i sessizce öldürüyordu; (c) yükleme tek
denemelikti; (d) cihazdaki APK muhtemelen reklam kodu içermeyen eski
debug derlemesiydi.

- Sağlayıcı yeniden yazıldı: tek ödüllü slot, init/yükleme 5→15→30→60 sn
  geri çekilmeli tekrar, `FailedToLoad` dinleyicisi, rıza hatası artık
  reklamı KAPATMAZ (ayrı try/catch), gösterim sonrası otomatik yeniden
  yükleme. Google resmî TEST kimlikleri korunuyor.
- **Teklif çipi süreli:** ömür 22 sn, üstünde eriyen geri sayım halkası;
  ilk teklif ~40 sn, sonra ~110±20 sn arayla; beliriş pop + ses + hafif
  titreşim; İZLE başarısızsa toast + 30 sn sonra yeni teklif.
- **DEV sahte sağlayıcı:** tarayıcı geliştirme derlemesinde 4 sn'lik
  "🎬 TEST REKLAMI" perdesi — döngü cihazsız test edilebilir (doğrulandı:
  çip → İZLE → perde → ödül → robot 180 sn çalıştı). Üretim web
  derlemesinde reklam kelimesi geçmez.
- Ayarlar → Gizlilik'e "Reklam durumu: …" teşhis satırı.

## 4. Okunaklılık

- **"Kâğıt" balonu silindi.** Fiş görselli balon (beyaz kart + sahte
  yazı + tırtıklı kenar) kapıdan girişte hiçbir bilgi taşımıyordu. Balon
  artık yalnız sipariş SONRASI ürün ikonunu (×adet) gösterir.
- **Ödeme pedi zenginleşti:** ad + fiyat + bölgenin istasyon glifleri +
  şimdiye dek hiç kullanılmamış `blurb` satırı (2 satır, sarmalı).
  Plaka 2,3×0,86 → 2,3×1,12; tek-ped kuralı korunuyor.
- **Oda tabelası içerik şeridi** (kilitliyken): r1 "3 masa · özel salon",
  r2 "VIP teras · hesap ×2,4" — kilit açılınca kalkar.
- **Sıradaki bölgenin brandasında** küçük glif çipi (yalnız depth-0;
  "YAKINDA enflasyonu" dersi ihlal edilmedi).
- Rehber boştayken parası yeten pedi "BÖLÜMÜ AÇ" ile gösterir.

## Ölçüm altyapısı notları

- Balance-bot v5 fiilleriyle uyumlu; kasiyer tavanı 2. **Temiz başlangıç
  tuzağının yeni yüzü:** bot depoyu temizler ama CANLI oyun örneği
  sürer + `pagehide` kapanışta MEVCUT durumu yeniden yazar. Temiz ölçüm
  reçetesi: `persist`'i no-op'la, depoyu temizle, SONRA yenile.
- Tarayıcı panelinde rAF bu kurulumda ÇALIŞIYOR (eski "donuk" notunun
  aksine) — sayfa açıkken oyun gerçek zamanda ilerler; ölçüm arası
  boşluklar küçük doğal ilerleme yaratır.

---

# v5.2 — OYUNCU ODAĞI (2026-08-15)

Oyuncu geri bildirimi: *"personelleri alınca sadece alıp teslim noktasına
bırakma kısmı var, bize geriye bir şey kalmıyor… 2 tane öyle personel alsa
her şeyi hızlıca alıp yerlerine koyar zaten, elemanlar bize ne gerek
kalıyor?"* Ölçüm doğruladı: tam kadroda oyuncu boştayken de kasanın
arkasındayken de kafe **45,8 servis/dk** yapıyordu — akış regülatörü
oyuncunun emeğini hiç okumuyordu.
Spec: `docs/superpowers/specs/2026-08-15-v5.2-oyuncu-odagi-design.md`.

## 1. Yarım raf — personel tamamlamaz

Tezgâhtar bir rafı ancak kapasitesinin **%45**'ine kadar besler; üstü
OYUNCUNUN işidir. `bestConsumer`'ın 7 çağrı yeri tarandı: 6 personel
yolunun tamamına tavan uygulandı, tek oyuncu yolu muaf bırakıldı. Ceza
değil — taban hep dolu kalır, kimse küsmez; değişen tek şey üst rafların
gözle görülür biçimde OYUNCUYU beklemesi.

## 2. Tempo — kafenin ritmi

Akış regülatörü önce sipariş tavanına ve müşteri doğuş aralığına bağlıydı;
ölçüm bu iki terimin geç oyunda **bağlayıcı olmadığını** gösterdi —
müşteri sayısı hem oyuncu boştayken hem tempo tavandayken 18'de sabit
kaldı, sıra ve koltuk tavanları hiç dolmadı. Kod tabanı bunu zaten
belgelemişti (`src/core/Quality.ts`): *"müşteri sayısı zamanın %55,9'unda
tavana dayalıydı, sipariş tavanı ise %0'ında."*

Tempo artık `World.refreshCapacity`'ye bağlı: personel tek başına
kapasitenin tabanını tutar (**%40**), oyuncu çalıştıkça kapasite tam
değerine açılır — mekânı DOLDURAN artık oyuncu. Ölçer oyuncunun gerçek
eylemleriyle dolar (rafa koyma, kasa toplama, temizlik, makinede el
verme, kaçak yakalama), boşta ~25 saniyede tabana iner; saniyelik dolum
tavanı vardır, aşan pay atılır ve kayda girmez (oturum başı sıfırdan
başlar). Tavan YUMUŞAK: kapasite düşünce içerideki müşteri atılmaz,
yalnızca yeni giriş durur. HUD'da 💓 tempo pili hijyen pilinin yanına
eklendi, üst yığın iki satırda kaldı.

## 3. Sadakat hedefleri kendi geçmişine göre kalibre olur

Eski ölçek `sqrt(served/60)` idi ve karekök sönümü hedefi zamanla
**kolaylaştırıyordu**: ölçümde "haftalık" hedef boştaki kafede 40
dakikada, festival modunda 60 dakikada bitiyordu. Yeni kural hedefi
geçmişe çapalar ama oran tek tip değil: **haftalık hedef** bir önceki
haftanın gerçekleşeninin **%90**'ı, **günlük görev** **%55**'i
(`Daily.ts`), **festival temizlik** dalı **%35**'i (`Festival.ts`) alınır
— temizlik dalı da haftalık veriden türer, çünkü kendi geçmişi yalnızca 7
haftada bir tazelendiği için bayatlıyordu. **Festival misafir** dalı bu
kalıba SOKULMADI, sabit **12** kaldı — müdavim arzı servis hacminden
bağımsız, sabit bir havuzla sınırlı (bkz. aşağıdaki "Denendi ve GERİ
ALINDI"). Kaçak müşteri görevi de ölçekten muaf tutuldu, hedefi hep 1:
ölçekli hâli 33 dakika sürüyordu.

## 4. Ödüller ölçülen gelire çapalandı

Bütün sadakat katmanının ödülü toplamda yalnızca ~10 dakikalık gelir
ediyordu (`totalEarned` yüzdesi olarak hesaplanıyordu ve üstel ekonomide
geride kalıyordu). Yeni çapa `realizedIncome × dakika`: günlük merdiven
3-16 dk, günlük görev 3 dk, haftalık hedef 25 dk, festival 20 dk, müdavim
albümü 5 dk. Ölçüldü: toplam ödül yığını ₺6.591.596 — **92 dakikalık**
gelire denk.

## 5. Prestij gerçek geç oyuna taşındı

Devir eşiği ₺1,5 milyondaydı (~40. dakika) ve yalnızca 4 puan / +%12
veriyordu — karşılığında 21 bölge ve 10 personel harcanmış oluyordu. Eşik
**₺12.000.000**'a çekildi ve `gain` eğrisi güçlendirildi: ilk devir artık
**+%60** veriyor.

## 6. Barista düzeltmesi

`baristaBoost` 10. seviyede **2,1×** veriyordu; oyuncunun makine başında
"el ver" bonusu ise 2,0×. Tam seviye barista tek başına oyuncuyu
**geçiyordu** — `data/staff.ts`'in kendi belgelediği kurala aykırıydı.
Eğri **1,8×**'e indirildi: artık oyuncu makinenin başına geçtiğinde
toplam çarpan tam **2,0×** oluyor.

## 7. Sahil merdiveni yeniden fiyatlandı

Tasarım spec'i **"aktif oyuncunun ₺/dk'sı v5.1 referansının (₺97.527)
0,95-1,20 katı"** bandını istiyordu. Bu bant tutmadı: nihai ölçüm
₺56.646/dk (41,2 servis/dk · 18,4 müşteri) — referansın yalnızca **0,581
katı**. Geliri bu banda geri itmek bilerek denenmedi: tempo'yu daha da
gevşetmek geç-oyun gelirini yükseltirdi ama bu doğrudan oyuncunun asıl
şikâyetiyle ("oyun çok çabuk bitiyor") çelişirdi — bu turun amacı geç
oyunu yavaşlatmaktı, geliri eski seviyesine geri taşımak değil. Bunun
yerine yalnızca bu varsayıma sayısal olarak bağlı içerik yeniden
fiyatlandı.

**Köşe'nin kendisine neden dokunulmadı:** Sahil'in v5.1 fiyatı açıkça
"~95k/dk Köşe geliri" varsayımına bağlıydı (bkz. `layouts.ts`'in kendi
yorumu); Köşe'nin hiçbir bölge fiyatı böyle bir bağ taşımıyor ve bot
Köşe'yi bir saatte **20/21** bölgeyle bitiriyor (yukarıdaki tablo — tek
kaçırılan VIP Loca, bkz. tablonun altındaki not) — yani ampirik olarak
dokunmaya gerek yoktu, sınırda olsa da.

`p2` (DONDURMA) 16M → **12,6M**, `p3` (VERANDA) 60M → **47,4M**;
`goals.ts`'teki g33/g34 ödülleri bedelin ~%42'si kuralına göre yeniden
hizalandı: g33 6,5M → **5,3M**, g34 27M → **20M**. Ölçek ara bir ölçümden
türedi (₺75.000/dk, 0,79×); nihai ölçüm daha düşük çıktı (₺56.646/dk,
0,581×) — yani Sahil ölçek olarak biraz daha ucuzlamalıydı. Fark yöntem
belirsizliği içinde kaldığı (10 dk'lık pencere ile tam oturum arasındaki
fark, bkz. aşağıdaki oran satırı) ve Sahil'in KENDİ ekonomisi bu turda da
uçtan uca ölçülmediği (bot şube geçişini henüz öğrenmiyor — v5.1
CHANGELOG'da da bilinen açık iş olarak kayıtlı) için fiyatlar GERİYE
ALINMADI.

## Denendi ve GERİ ALINDI

- Tempo'nun `maxPending` (sipariş tavanı) ve müşteri doğuş aralığına
  bağlanması — ölçüm geç oyunda **atıl** çıktı, bkz. yukarıdaki
  "Tempo — kafenin ritmi".
- `venueFloor` **0,30** — boşta÷aktif oran 0,441'e **geri çıktı**. Sebep
  ölçüldü: kafe çok sessizleşince personel raflara yetişiyor, müşteri
  pahalı ürün buluyor, satış başına gelir ₺1.702'den ₺2.430'a fırlıyor.
- Festival **misafir** hedefini haftalık servise bağlamak
  (`weekPrevServed × %8`, bkz. yukarıdaki "Sadakat hedefleri") — müdavim
  ARZI servis hacminden bağımsız, sabit bir havuzla sınırlı (7 kişi + 90
  sn bekleme, `customers.ts`): geç oyunda pay ~%3'e düşüyor, tavan ~2
  ziyaret/dk'da kilitleniyor. Hedefin istediği ~3,66 ziyaret/dk bu tavanın
  1,8-2,7 katı — **yapısal olarak ulaşılamaz** çıktı. Sabit **12**'ye
  geri alındı; bunu belgeleyen eski yorum ("havuz 7 kişi + bekleme
  süresiyle sınırlı — ölçekle büyütmek onu ulaşılmaz yapardı") önceki bir
  düzeltme turunda yanlışlıkla silinmişti, geri kondu. Karşılaştırma:
  aynı aileden **temizlik** dalının %35 katsayısı ölçüldü ve TUTUYOR —
  gerçek oran `(cleaned + mopped) / served` = **0,696**, hedefin iki katı
  arz var.

## Park istismarı kapatıldı (dal geneli son inceleme, 2026-08-16)

"Tempo" bölümündeki "el ver" kancası (makine başında durmak, saniyede
**0,05**) sönümü (saniyede **0,04**) TEK BAŞINA yeniyordu: net +0,01/sn,
ve barda iki istasyon aynı anda menzile girince saniyelik dolum bütçesinin
tamamı doluyordu. Ölçüldü: oyuncu bir makinenin dibine park edilip HİÇBİR
eylem yapılmadığında tempo **30 saniyede 1,0**'a çıkıyor ve orada **180
saniye boyunca** sabit kalıyordu — kapasite de aynı süre boyunca tavana
kilitli kalıyordu (`venueFloor + tempo×(1-venueFloor)` formülüyle, bkz.
yukarıdaki "Tempo — kafenin ritmi"). Telefonu bara yaslamak kafeyi %100
aktif gösteriyordu — turun bütün amacı (ilerlemeyi oyuncunun GERÇEK
emeğine bağlamak) tek bir park hareketiyle geçersiz oluyordu.

Çözüm katsayıyı düşürmek DEĞİL: kaç istasyon menzile girerse katkı o kadar
katlanıyor, hangi katsayı seçilirse seçilsin yeterince yakın durmak
sönümü er ya da geç yeniyor. Çözüm bir TAVAN —
`BALANCE.tempo.handsOnCeiling = 0,5`: makine başında durmak tempoyu en
fazla YARIYA taşır, üstünü yalnız GERÇEK İŞ (rafa koyma, kasa toplama,
temizlik, kaçak yakalama) açar.

Doğrulandı — park testi düzeltmeyle TEKRAR koşuldu (farklı bir bot
oturumunda, dolayısıyla farklı bir `venueCapacity` tabanında; kapasite
rakamı bu yüzden burada verilmiyor, yalnız tempo sonucu karşılaştırılabilir):
tempo tam **0,500**'de duruyor ve 180 saniye boyunca orada kalıyor —
düzeltmeden önceki 1,0'a karşı. Aşağıdaki ölçüm tablosu bu düzeltmeyle
birlikte alınmıştır — önceki tablonun sayıları (servis 2.179, ömür
kazancı ₺2,29M…) istismarın AÇIK olduğu bir koşumdan geliyordu;
düzeltmeden sonraki gerçek sayılar daha düşük çünkü bot artık gerçek iş
yapmadan tempo tavanına ücretsiz binemiyor.

## Ölçüm (final — venueFloor 0,40 + handsOnCeiling 0,5, tüm düzeltmeler yüklü)

| Ölçüt | v5.1 | v5.2 |
|---|---|---|
| Bölge | 20/20 | **20/21** |
| Servis | 2.255 | **1.457** |
| Ömür kazancı | ₺4,09M | **₺1,49M** |
| Kızgın | 3 (%0,13) | **12 (%0,82)** |
| Hijyen (bitiş) | 70 | **79** |
| r1 / r2 | 10:41 / 32:39 | **10:00 / 53:19** |
| Boşta ÷ aktif gelir | — | **0,330** (hedef 0,30-0,40) |
| Boşta / aktif müşteri | 18 / 18 | **7,8 / 18,4** |

Oran gerekçesi: boşta **₺18.669/dk** (20,2 servis/dk · 7,8 müşteri ·
kızgın 0) ÷ aktif **₺56.646/dk** (41,2 servis/dk · 18,4 müşteri) =
**0,330** — hedef bandının (0,30-0,40) içinde.

**Bölge — dürüst not:** bu koşuda bot VIP LOCA'ya (v2) yetişemedi; kabul
bandı 20-21 olduğu için 20/21 GEÇİYOR ama sınırda. Sebep biliniyor: bot
makine başında fazla duruyor, tempo tavanı (`handsOnCeiling` 0,5) artık
bunu tek başına yeterli saymıyor — gerçek eylem yapan bir oyuncu botu
rahatça geçer.

Not: kabul kriterlerinden **"en uzun alımsız boşluk ≤ 210 sn"** bu turda
hiç ölçülmedi — `tools/balance-bot.js` bu metriği hesaplamıyor.

---

# v5.1 — SADAKAT (2026-08-15, akşam)

"Bırakamıyorum" turu: inceleme raporundaki dört eksik katman + altı yeni
reklam ödülü, üç paralel iş kolunda (reklam · sadakat · içerik) kapatıldı.
Spec: `docs/superpowers/specs/2026-08-15-v5.1-sadakat-design.md`.

## 1. Altı yeni ödüllü yerleşim (toplam 11)

Kasa Desteği (ped %60-90 arasında ~90 sn'lik gelir) · Usta Modu (180 sn
el-ver her makinede + hız ×1,25) · Müşteri Akını (90 sn akış ×1,6 +
sabır ×1,2) · Arıza Sigortası (anında tamir + 300 sn bağışıklık) ·
Bahşiş Yağmuru (180 sn masa bahşişi ×3) · Dönüş Satışı (yalnız "sen
yokken" modalında: dolan stoğun yarısı izlenen reklamla anında satılır —
bedava offline para DEĞİL, oyuncunun kendi stoğu). Çip önceliği acilden
genele 10'lu dizi; kadans 110±20 sn korunur. **Buff süreleri artık kayda
girer** — uygulama kapanınca satın alınan ödül buharlaşmaz (eski açık).

## 2. Günlük dönüş katmanı

- 7 günlük seri takvimi artık GÖRÜNÜR (Hedefler paneli); 7. günde
  konfeti + kozmetik kuponu.
- **Haftalık hedef** (ISO haftası, hedef ölçekle büyür): büyük nakit +
  🎟️ kupon. Hafta ölçeği hafta başında donar (görev-kayması dersi).
- **Festival rotasyonu**: haftanın festivali deterministik (sunucusuz;
  hafta anahtarı hash'i) — 5 ürün festivali (o ürün ×1,35) + TEMİZLİK
  HAFTASI (temizlik ödülü ×1,5) + MİSAFİR HAFTASI (müdavim şansı ×1,6);
  festival hedefi + ödül + HUD çipi.
- **Müdavim Albümü**: 7 müdavimin ziyaretleri sayılır (5/20/60 eşikleri
  ödüllü); tanıma katmanı artık birikimli bir koleksiyon.
- **Kozmetik kuponu**: yalnız Dekorasyon'da geçer, %40 indirim — kozmetik
  oyunu etkilemez kuralı korunur.

## 3. Ara-hedef bandı: üç YAN DAL bölgesi

MÜZİK KÖŞESİ 60k (sabır ×1,06) · VİTRİN IŞIKLARI 95k (değer ×1,04) ·
SOKAK TABELASI 200k (akış ×1,05) — ana zinciri kapılamayan, ölü bantlara
nişanlanmış küçük alımlar. Spec'in üç ped adayı da klerans kontrolünde
çöktü ve taşındı (komşu mesafe tablosu ajan raporunda; tümü ≥1,1).
Dekorlar ≤4 çizim çağrısı: gramofon köşesi, vitrin spotları, ışıklı
"KAFE CADDESİ ☕" sokak panosu.

## 4. Sahil geç duvarları

p2 28M → **16M**, p3 110M → **60M**; g33/g34 ödülleri %40-45 kuralıyla
6,5M/27M. Gerekçe ölçüm: geç-oyun Köşe geliri ~95k/dk ile 28M saatler
uzaktaydı (ölü içerik). Sahil-içi tam bot ölçümü, botun şube geçişi
öğrenmesine bağlı — bilinçli açık iş.

## Ölçüm (temiz 60 dk bot, TOST ŞENLİĞİ haftası)

| Ölçüt | Değer | Not |
|---|---|---|
| Bölge | **20/20** | 17 ana + 3 yan dal |
| Yan dallar | 19:33 · 22:53 · 25:40 | tam nişanlandıkları ölü bantlarda |
| En uzun alımsız boşluk | 269 sn → **204 sn** | v5.0'a göre |
| r1 / r2 / v2 | 10:41 / 32:39 / 38:51 | GDD bandı |
| Kızgın | 3 / 2255 servis | ~%0,13 |
| Hijyen (bitiş) | 70 | > 60 |
| Festival determinizmi | ✔ | aynı hafta = aynı festival |
| Buff persist | ✔ | yenileme sonrası Usta Modu + kalkan canlı |

Sadakat paneli 375×812'de doğrulandı: festival şeridi (43/120), haftalık
280/300, albüm 7 satır, panel içi reklam teklifi — tek panelde, etiket
enflasyonsuz.

---

# v5.3 — SKINNED KARAKTER (2026-08-18)

Karakterler katı mesh hiyerarşisinden **tek skinned mesh'e** taşındı.
Spec: `docs/superpowers/specs/2026-08-17-skinned-karakter-design.md` ·
Plan (12 görev, Ölçüm Kütüğü dâhil):
`docs/superpowers/plans/2026-08-17-skinned-karakter.md`.

## Kök neden: oyunda iskelet animasyonu hiç yoktu

Rig baştan beri `Group` eklemlerinden kuruluydu ve her uzuv o eklemin altına
**katı bağlı ayrı bir mesh**ti. Animatör eklem `Group`'unu döndürüyor, sahne
grafiği de altındaki mesh'leri taşıyordu. Bu yapı çalışıyordu ama birleştirmeye
kapalıydı: iki parça ancak **aynı eklemin** altındaysa birleştirilebiliyordu,
çünkü farklı eklemler kare kare farklı matrislerle dönüyordu. v5.0'ın "eklem
içi statik birleştirme" turu bu tavana çarptığı yerde durmuştu.

Kırılması gereken şey birleştirme algoritması değil, **dönüşümün nerede
uygulandığı** idi. Skinning tam olarak bunu değiştirir: matris çarpımını sahne
grafiğinden alıp GPU'daki vertex shader'a taşır. O zaman bütün uzuvlar tek
geometride yaşayabilir ve yine de bağımsız hareket eder.

## Ölçüm

| Ölçüt | ÖNCE | SONRA |
|---|---|---|
| Karakter başına çizim çağrısı | 60 | **2** |
| Karakter başına materyal | 14 | **2** (global — tüm karakterler paylaşır) |
| Sahne çizim çağrısı (18 aktör / 45 dk) | 1681 | **367** (%78,2 düşüş) |
| Karakterlerin sahnedeki payı | ~%50 | **%13,4** (yalnız rig: %9,8) |
| Doğum maliyeti p95 | — | **1,1 ms** (bant < 4 ms) |

Karakter başına rakamlar **aynı karakterin iki yöntemle kurulup sayıldığı**
kontrollü koşumdan (Task 10, legacy silinmeden hemen önce); sahne rakamları
Task 1'in tabanıyla **birebir aynı senaryodan** (temiz başlangıç + 45 dk bot +
elle bir kare, iki tarafta da 18 aktör). "2", kadrajdan ve sahne durumundan
bağımsız **yapısal** bir olgudur: birleşik geometrinin tam iki materyal grubu
vardır. Canlı sahnede 42 aktörün 42'sinde de doğrulandı, sıfır ihlal.

## Sadakat: kurulum gereği, tesadüf değil

Geçiş bir *yeniden modelleme* değil, bir **özdeşlik dönüşümü** olarak
tasarlandı: her vertex, eskiden altında durduğu ebeveyn kemiğe **1,0 ağırlıkla
tek başına** bağlandı. Böylece GPU'nun uyguladığı matris, eski sahne grafiğinin
uyguladığı çarpımın **aynısı** olur. Sadakat bir hedef değil, kurulumun
sonucudur.

Sayısal kanıt (Task 10 Step 1, legacy silinmeden önceki son karşılaştırmalı
koşum; iki rig yan yana kurulup kare kare karşılaştırıldı):

- `maxJointError` **0** — eklem matrisleri bit düzeyinde aynı
- `maxVertexError` **7,74e-8** — float32'nin gösterebildiği en küçük fark
  mertebesinde
- **160 vaka**, iki LOD dalı, **744.320 matris + 5.614.209 vertex +
  1.871.403 renk** karşılaştırması
- `count / color / shadow` uyuşmazlık sayaçlarının **tümü 0**

## Doğum maliyeti: önce pahalıydı, iki adımda indi

Yeni yapı ilk hâlinde **pahalıydı** — p95 **22,5 ms**, yani müşteri doğduğu
kare düşüyordu. Ölçüm (Task 9) bunu havuzlama gerektiren bir mimari sorun gibi
gösterdi ve kapsam dışına alındı; oyuncu kararıyla (Task 9b) geri alındı ve
teşhis edildi: maliyet skinning'den değil, **kurulum sırasında yapılan gereksiz
işten** geliyordu — geometri çifte klonlanıyor ve her parça için bir ara
`BufferGeometry` üretilip atılıyordu (doğuş başına ~280 KB çöp, örneklerin
~%30'unda GC duraklaması). İkisi de kaldırıldı; havuzlamaya **hiç gerek
kalmadı**.

**22,5 ms → 1,1 ms** (`customer`, n=60, ortalama 0,55 ms · maks 1,6 ms).

## İki bellek sızıntısı kapandı

İlk uygulamada karakter başına **~40 boyalı klon geometri** hiç `dispose`
edilmiyordu; skinned geçiş buna bir de **kemik matrisi dokusu** ekliyordu.
İkisi de kapatıldı ve kur-at turuyla doğrulandı: 40 karakter → geometri
307→347→307, doku 36→76→36, **yukarı 40 / aşağı 40, tam düz**.

## Kademe tabanları YÜKSELTİLDİ (oyuncu kararı)

Boşalan bütçe daha fazla karakter çizmeye değil, **kırpmaları geri almaya**
harcandı. Gerekçe oyuncunun kendi sözü: *"kalite düşürerek akıcılık ve
ısınmama getirirsek yine de oynanması tercih edilmez bir oyun oluruz."*

Üç kademede de artık: **gölge açık · LOD kapalı · `maxCustomers` 26.** Kalan
tek fark gölge haritası boyutu (2048 / 1024 / 1024).

Asıl kazanç ekonomik. `maxCustomers` sim'e sızan **tek** kalite alanıydı
(`venueCapacity`'yi kırpan üst sınır) ve düşük kademede 16'ya iniyordu — yani
zayıf telefondaki oyuncunun **gelir tavanı yapısal olarak düşüktü**. Üçü
eşitlenince fark **imkânsız** hâle geldi: oyuncunun telefonu artık ekonomisini
belirlemiyor. `Quality.ts`'in kendi kuralı ("çözünürlük hiçbir koldan düşmez,
kalite oynanışı değiştirmez") nihayet tam karşılanıyor.

Isı merdiveni **dokunulmadan** duruyor: 2. basamak LOD'u, 3. basamak müşteri
tavanını hâlâ emniyet ağı olarak kullanıyor. Fark şu ki artık bunlar
**tabanın** değil, yalnız gerçekten ısınan cihazın yolu.

## Tek bilinçli görsel fark: gölge

Tek birleşik mesh'in **tek** `receiveShadow` bayrağı olabilir. Eski rig'de
7 gövde parçası gölge alıyor, **~81 detay parçası almıyordu** — bu ayrım
tasarım değil, parça parça kurulmuş bir hiyerarşinin yan ürünüydü.

Karar: **gövde kütlelerinin gölge alması korundu** (onu kaybetmek çok daha
görünür bir kayıp olurdu), detaylar da aynı bayrağa katıldı. Gövdeyle **aynı
yerde duran** bir detayın gövdeyle **aynı** gölgeyi alması, bugünkü
tutarsızlıktan daha doğru. Fark beyan edildi, kapıya yazıldı ve özdeşlik
koşumunda `shadowMismatches` olarak ayrıca sayıldı.

## Silmenin bedeli — dürüstçe

Karşılaştırmalı kapı (`buildRigLegacy` ile yan yana koşan özdeşlik testi)
Task 10'da **kaldırıldı**; legacy kurucu silindi. Kapı bugün bir
**regresyon/sağlık denetimi** kipinde çalışıyor: 2 çizim çağrısı · eklem
matrisleri sonlu · vertex bulutu boş değil · normal değişmezi · `deadVertices`.

Bu, kapsamın **5,6 milyon vertexlik bir karşılaştırmadan referans değeri
olmayan sonluluk kontrollerine** inmesi demek. Bugün otomatik koruması
**olmayan** hata sınıfları:

- geometri / poz kayması
- skinning ağırlıkları ve kemik bağlama
- eksik parça
- görünürlük ve LOD dalı ayrışması

Sağlık denetimi bunların hiçbirini yakalamaz — "sonlu ve boş değil" bir
karakterin **yanlış** görünmesine izin verir. Bu dosyalara dokunacak bir
sonraki tur bunu **bilerek** girmeli; özdeşliğin kanıtı artık kodda değil,
planın "Task 10: özdeşliğin tarihsel kanıtı" bölümünde bir **tarihsel kayıt**
olarak duruyor.

## Denge: değişmedi — ölçüldü, ayrıca yapısal olarak da imkânsız

4 × 50 dk temiz bot koşumu: bölge 17-20/21 · t1 1:03-1:31 · r1 11:32-14:05 ·
r2 39:25 ve 45:13 (4'ün 2'sinde ulaşıldı) · kızgın 3-6 (%0,26-0,54) · hijyen
51-83. Dört koşum v5.0 ve v5.2 referanslarını her eksende **kuşatıyor**.

Yayılım geniş çünkü ölçüm deterministik değil (67 yerde tohumsuz
`Math.random()`); bu yüzden tek koşumluk v5.2 rakamı bir bant değil bir
örnektir. Kaymanın bu işten gelmesi zaten **imkânsız**: bu dalda `src/sim/` ve
`src/data/` **tek satır** değişmedi, ölçümün koştuğu `high` kademesi taban
yükseltmesinden önce de sonra da aynıydı, ve `maxCustomers` koşumlarda hiç
bağlayıcı olmadı (`venueCapacity` 12-20'de kaldı, 26 tavanına dayanılmadı).
Düşük kademedeki 16→26 yükselişi **gerçek ve bilinçli** bir gelir tavanı
artışıdır, ama etkisi mekân 16 masayı geçtikten sonra başlar — 50 dakikalık
bir koşumun ötesinde.

## Açılmayan kol ve ölçülemeyen bantlar

**Shader kolu açılmadı.** `MeshStandardMaterial` → `MeshLambertMaterial`
değişimi yalnız fill-rate darboğazı kanıtlanırsa değerlendirilecekti;
kanıtlanmadı, varsayılan cevap korundu.

**Termal bantlar bu ortamda ölçülemedi ve uydurulmadı.** Isı merdivenini
besleyen `evaluateHeat(workMs, fps)` yalnız `requestAnimationFrame`'den
çağrılıyor; ajan tarayıcı paneli kompozit etmiyor ve rAF donuk, dolayısıyla
`heatLevel` her koşumda 0'da kaldı — merdiven "geçmedi", **hiç çalışmadı**.
Isı satırları (30 dk ısı basamağı, düşük kademede ısı, `maxCustomers`
kısmasının devreye girip girmediği) Ölçüm Kütüğü'nde **"cihazda ölçülecek"**
olarak işaretlendi; doğrulama telefonda `npm run android:apk` + `?perf=1` ile
yapılacak (kullanıcı kararı, 2026-08-17).

## Bulgu: sıradaki termal kol karakterler DEĞİL, mekânın içi

Bu turdan önce çizim çağrısının baskın kaynağı karakterlerdi (~%50). Şimdi
payları **%13,4**'e indi ve 367 çağrının **~318'i karakter dışı**:
istasyonlar, raflar, masalar, ödeme pedleri, dekor. v5.0'ın mesh diyetine
yalnız **sokak** girmişti (574 mesh → 17); **mekânın içi hiç girmedi.**

Bir sonraki performans turunun konusu budur. Bu plana bilinçli olarak dâhil
edilmedi (kapsam: karakterler).
