/**
 * Merkezî denge sayıları.
 *
 * TASARIM İLKESİ: oyun zor değil, YOĞUN olmalı. Oyuncu asla "kaybetmez";
 * sadece daha hızlı koşarsa daha çok kazanır. Bu yüzden:
 *  · her eylem anında para verir (temizlik dâhil),
 *  · ilk açılım yarım dakikada gelir,
 *  · sabır yüksek, ceza küçük, hijyen bir ceza değil BONUS çarpanıdır.
 */

export const BALANCE = {
  /* --- oyuncu --- */
  player: {
    accelTau: 0.075,
    decelTau: 0.055,
    reverseTau: 0.045,
    turnSpeed: 16,
    turnSpeedSlow: 26,
    radius: 0.32,
    /** İstasyonla etkileşim yarıçapı (servis noktası mesafesinden büyük olmalı). */
    interactRadius: 2.9,
    catchRadius: 1.7,
    /** Zemin lekesini paspaslama yarıçapı */
    mopRadius: 1.8,
    /**
     * NİYET KAPISI — alma başlamadan önce istasyonun yanında beklenmesi
     * gereken süre (sn). Ayakların dibinde dolan halka bunu gösterir.
     * Kapısız hâlinde başka yere koşarken rafın yanından geçen oyuncu
     * istemeden kucak dolusu ürün alıyordu.
     */
    pickupArmTime: 0.10,
    /**
     * Ödeme pedinin niyet kapısı (sn). Alma kapısından bilerek uzun:
     * yanlışlıkla ürün almak can sıkar, yanlışlıkla PARA HARCAMAK
     * güven bozar. Ped üstünden koşarak geçmek (2 birim yarıçap, ~0,5 sn)
     * bu eşiğe asla ulaşamaz.
     */
    padArmTime: 0.20,
    /**
     * Süpürgeyi alma/bırakma niyet kapısı (sn) — pickupArmTime'dan bilerek
     * uzun (~1 sn). Süpürge dolabı kova gibi sık ziyaret edilen bir başka
     * istasyona yakın durabildiği için ("yan yana duruyor, karışıyor" geri
     * bildirimi) kısa bir bekleyiş yeterli olmuyordu; daha uzun ve elleri
     * boşken çalışan bu kapı yanlış alımı pratikte imkânsız kılar.
     */
    /**
     * 1,0 → 0,75 (2026-08-14, oyuncu isteği: "bir şeyleri alıp bırakmak
     * 1 saniye çok").
     *
     * Kapının var oluş sebebi korunuyor: süpürge dolabı kova gibi sık
     * ziyaret edilen istasyonların yanında durabiliyor ve yanlış alım can
     * sıkıyor. 0,75 hâlâ alma kapısının (0,35) iki katından fazla ve ped
     * kapısına (0,8) komşu; üstelik kapı yalnız oyuncu YAVAŞLADIĞINDA
     * dolar (`planarSpeed < 2,2`), yani yanından koşarak geçmek onu zaten
     * dolduramaz. Kaybedilen tek şey bilerek bekleme süresi.
     */
    vacuumArmTime: 0.75,
  },

  /* --- müşteri akışı --- */
  customers: {
    /** Taban doğuş aralığı (sn) — menüdeki hazır ürün arttıkça kısalır */
    baseSpawnInterval: 4.0,
    /** Menüdeki her hazır ürün için aralığı bu oranla çarp */
    perItemFactor: 0.9,
    stockPull: 0.4,
    minSpawnInterval: 1.0,
    /**
     * Mutlak üst sınır. Asıl tavan artık MEKÂNIN kapasitesidir
     * (World.refreshCapacity: açık masa sayısı) ve kalite kademesidir;
     * bu sayı yalnızca hiçbir koşulda aşılmaması gereken çatıdır.
     */
    maxActive: 28,
    /**
     * Tempo düşükken bile mekânın alacağı en az müşteri. `refreshCapacity`
     * içindeki mevcut alt kelepçeyle (6) aynı: kafe hiçbir koşulda boşalmaz.
     */
    minVenue: 6,
    queueSpacing: 1.3,
    /**
     * Sıradaki en fazla kişi. Aşılırsa yeni müşteri hiç gelmez: kapının
     * önünde birikip sırayla küsen kalabalık, oyuncunun elinden hiçbir şey
     * gelmediği bir ceza yığınıdır. Sınır ayrıca sıranın mekânın dışına
     * taşmasını da engeller.
     */
    maxQueue: 6,
    repSpawnBoost: 0.4,
    despawnDist: 2.2,
    walkStopDist: 0.55,
    /**
     * Masa yokken müşteri gelmesin. Boş masa beklemek oyunun en sıkıcı
     * ölüm sebebiydi: kapı önü doluyor, hepsi küsüp çıkıyordu.
     */
    minFreeSeats: 1,
    /**
     * Boş masa yokken kapının kapalı kalacağı azami süre (sn). Sonrasında
     * müşteri yine gelir; masa bulamazsa paket alır. Oyunun tamamen
     * durmasındansa paket satış yeğdir.
     */
    noSeatGrace: 14,
    walkSpeedCap: 3.0,
  },

  /* ================================================================ *
   *  SİPARİŞ — çekirdek döngü
   * ================================================================ */
  orders: {
    /**
     * v5 — SİPARİŞ TEK KALEMDİR (bir ürün × adet). Bu iki sabit yalnız
     * eski dengeler için duruyor; buildOrder artık satır sayısını
     * kullanmaz, adet arketipten gelir.
     */
    minLines: 1,
    maxLines: 1,
    /** Oyuncu kasanın başındayken sipariş alma süresi çarpanı */
    playerOrderMult: 0.4,
    /** Ürünü RAFTAN aldıktan sonra masaya oturma olasılığı (kalanı paket) */
    dineInChance: 0.8,
    /** Masada yemek isteyen müşterinin boş/temiz masa bekleme sabrı (sn) */
    waitForTable: 20,
    /** Paket alıp giden müşteriler için gelir çarpanı (%40 daha düşük kazanç) */
    takeawayPriceMult: 0.6,
    /** Masada servis edilen müşteriler için taban gelir çarpanı (1.5x gelir avantajı) */
    dineInPriceMult: 1.5,
    /** Masada oturan müşterilerin bıraktığı ek masa hizmet / bahşiş oranı */
    tableTipRate: 0.35,
    /** Masada siparişini beklerken sabır çarpanı */
    seatedPatienceMult: 2.6,
    takeawayPatienceMult: 1.1,
    /** Servis edilen her ürün için itibar kazancı */
    servedRepGain: 0.6,
    /** Sipariş hızlı yetiştiyse ek bahşiş oranı */
    fullServeTipRate: 0.25,
    /** Teras masasının bahşiş çarpanı */
    outdoorTipMult: 1.3,
    /**
     * VIP masanın hesap çarpanı. Masa devri de yavaştır (misafir uzun
     * oturur), yani "her masayı VIP yap" doğru cevap değil — az sayıda
     * VIP + çok sayıda normal masa en iyi karışım.
     */
    vipTipMult: 2.4,
    eatTimeJitter: 0.25,
  },

  /* ================================================================ *
   *  KİR & TEMİZLİK — burada TEMİZLİK PARA KAZANDIRIR.
   *
   *  Ceza değil ödül: her toplanan bulaşık, silinen leke ve doldurulan
   *  sarf anında bozuk para verir. Temizlemek "zorunluluk" değil, oyunun
   *  ikinci gelir kalemi olmalı — o zaman insan kendiliğinden temizler.
   * ================================================================ */
  dirt: {
    dishesPerGuest: 1,
    maxDishesPerTable: 5,
    /** Oyuncunun bir bulaşığı toplama süresi (sn) */
    playerPickupTime: 0.3,

    /**
     * Kalkan müşterinin leke bırakma olasılığı. 0,3 idi; geç oyunda 20+
     * masa aynı anda dönerken zorluk çarpanıyla (1,28) birlikte saniyede
     * ~0,13 leke üretiyor ve iki komi yetişemiyordu — ölçümde lekeler
     * tavana dayanıp hijyen 0'a çöktü. Temizlik oyunun İKİNCİ ritmi
     * olmalı, boğucu bir sel değil.
     */
    spillOnLeaveChance: 0.15,
    spillOnServeChance: 0.04,
    maxSpills: 9,
    /** Bir lekenin tamamen silinme süresi (sn) — oyuncu */
    playerMopTime: 0.92,
    spillRadius: 0.85,
    spillGrow: 1.0,

    /**
     * Temizlik ödülü, menünün ORTALAMA fiyatının oranı olarak hesaplanır;
     * böylece geç oyunda "bozuk para toplamak" hissi vermez, ölçeklenir.
     */
    dishRewardRate: 0.18,
    spillRewardRate: 0.3,
    refillRewardRate: 0.4,
    scrubRewardRate: 0.55,
    /** Süpürülen toz lekesinin ödül oranı */
    dustRewardRate: 0.34,
    /** Masadan kalkan her müşterinin bıraktığı yüzey kiri (0..1) */
    tableSoilPerUse: 0.38,
    playerTablePolishTime: 1.05,

    /* ---------------------------------------------------------------- *
     *  TRAFİK KİRİ (bkz. sim/Grime.ts) — zeminin kullanım izi.
     *
     *  Lekeden farkı: leke bir OLAY, bu bir SÜREÇ. Kapı→bar hattı ve masa
     *  çevreleri en çok basılan yerler olduğu için ilk onlar kararır.
     *
     *  TASARIM KURALI — bu katman CEZA DEĞİL: hijyene baskısı bilerek
     *  küçüktür, temizlenmesi para verir. "Asla cezalandırma" ilkesi gereği
     *  ihmal edilebilir olmalı, temizlenince ödüllendirmeli.
     * ---------------------------------------------------------------- */
    /**
     * Bir aktörün bastığı hücreye saniyede eklediği kir (0-255 ölçeğinde).
     *
     * 40 ölçüldü ve ZAYIF çıktı: 4 dakikada hiçbir hücre 150'yi geçmedi,
     * yani ana yol ile köşe arasındaki fark okunmuyordu — kir "her yer eşit
     * tozlu"ya düşüyordu ki bu mekaniğin tüm anlamını siler. Aktör 0,6'lık
     * hücreyi ~0,15 sn'de geçer, yani geçiş başına ~16 birim: bir hücrenin
     * tavana vurması ~12 geçiş ister.
     */
    traffic: 110,
    /**
     * Çöken tozun saniyelik hızı. Trafiksiz köşeler de hafifçe kirlensin
     * diye var ama SETTLE_CAP'te (70) durur — ana yollar hep daha koyu
     * kalmalı, yoksa iz okunmaz ve kir "her yer eşit pis"e düşer.
     */
    settleRate: 0.2,
    /**
     * Süpürgenin bir karede bir hücreden aldığı kir. 200 (255 değil):
     * tek geçiş çoğunu alır ama en koyu yerde soluk bir iz bırakır, ikinci
     * turda o da gider — "fırça izi" okunaklılığı buradan gelir.
     */
    grimeBrushStrength: 200,
    /**
     * Süpürgesizken katsayı. SIFIR: trafik kiri SÜPÜRGE İŞİDİR.
     *
     * Neden sıfır olmak zorunda: fırça pasif bir katmandır ve oyuncu zaten
     * sürekli yürür — küçük bir değer bile oyuncunun kendi yürüyüşünün
     * izleri silmesine yol açardı, yani mekanik kendi kendini yerdi.
     * Yan fayda: süpürgenin ilk kez gerçek bir işi olur (ölçümde hijyen
     * 100'de sabit olduğu için süpürgeyi almanın hiçbir sebebi yoktu).
     */
    grimeMopMult: 0,
    /** Bu kadar kir birimi temizlemek bir "leke" ödülü kadar eder. */
    grimeRewardUnit: 25000,
    /**
     * Rehber okunun "SÜPÜRGEYİ AL" demeye başladığı AĞIR kaplama eşiği.
     * Çöken ince toz filmi tetiklememeli — yalnız çok basılan yerlerde
     * gerçekten kir birikince. (Ölçüm: 12 dakikada ağır kaplama %8,2.)
     */
    grimeGuideCoverage: 0.05,
    /**
     * Süpürge eldeyken okun göstereceği hücrenin en az kirliliği (0-255).
     * `SETTLE_CAP`'in (70) belirgin üstünde: ok, temizlenmesi anlamlı bir
     * yeri göstermeli, zeminin her noktasını değil.
     */
    grimeGuideMin: 110,
    /**
     * AĞIR kaplama 1,0 iken hijyene saniyelik baskı.
     *
     * `GrimeField.heavyCoverage` kullanılır (settle tavanının ÜSTÜ), düz
     * `coverage` değil: çöken toz tüm zemini kaplayıp kaplamayı tek başına
     * %30'a çıkarıyor ve hijyene o da sayılınca kurtulunamaz bir vergi
     * doğuyordu (ölçümde hijyen 14'e indi — "asla cezalandırma" ihlali).
     * Ağır kaplama gerçekçi ihmalde %5-25 bandında gezer. 4,0 o bantta
     * 0,2-1,0/sn idi ve kaplama %48'i geçince toparlanmayı (1,9) yeniyordu.
     * 2,0 yalnız zemin neredeyse tamamen ağır kirliyken 1,9'u eşiğinde
     * tutar; %5-25 kaplama 0,1-0,5/sn kalır. Temizlik ceza değil, ikinci gelir.
     */
    grimeHygieneWeight: 2.0,

    /* ---------------------------------------------------------------- *
     *  KOMİNİN ZEMİN TURU — otomasyonu olmayan TEK temizlik işiydi.
     *
     *  Ölçüm (2 × 50 dakikalık bot koşusu): hijyen ikisinde de 48-52'de
     *  sabitlendi. Sebep denge kayması değil YAPISAL bir boşluktu: her
     *  temizlik işinin bir personel karşılığı var (bulaşık, leke, tuvalet,
     *  sarf) ama trafik kirini YALNIZCA elinde süpürge olan oyuncu
     *  silebiliyordu (`grimeMopMult: 0`, `cleanStroke` tek çağrı yeri
     *  oyuncu etkileşimi). Üstelik rehber oku süpürgeyi ancak servis işi
     *  YOKKEN öneriyor; geç oyunda kafe hiç boşalmadığı için oyun oyuncuya
     *  süpürgeyi fiilen hiç önermiyordu. Sonuç tek yönlü bir cırcır:
     *  kaplama yalnız artıyor, hijyen ~50'ye oturuyor ve `Environment`
     *  zemini kalıcı olarak karartıyor — yani mekân geç oyunda hep kirli
     *  görünüyor.
     *
     *  Ekonomik tarafı zaten "asla cezalandırma"ya uygundu (50 hijyen =
     *  1,05× çarpan, bu dosyada öngörülmüştü); bedel GÖRSELDİ.
     *
     *  ÇÖZÜMÜN SINIRLARI — süpürgeyi işsiz bırakmamak için üçü de şart:
     *   1. Komi bu işi YALNIZ boştayken yapar (zincirin en sonunda);
     *      bulaşık, leke, sarf ve tuvalet her zaman önce gelir.
     *   2. Oyuncunun süpürgesinden BELİRGİN yavaştır.
     *   3. PARA KAZANDIRMAZ. Ödül oyuncuya özel kalır, yoksa süpürgeyi
     *      almanın hiçbir sebebi kalmazdı.
     * ---------------------------------------------------------------- */
    /**
     * Komi bu kirlilikten (0-255) temiz bir yere gitmez. `SETTLE_CAP`'in
     * (70) belirgin üstünde: çöken ince toz filmi komiyi koşturmamalı,
     * yalnız gerçekten basılmış yollar. Rehber okunun eşiğiyle (110) aynı
     * aileden ama daha yüksek — oyuncu önce davranabilsin.
     */
    busserGrimeMin: 150,
    /**
     * Komi'nin saniyede bir hücreden aldığı kir. Oyuncunun süpürgesi kare
     * başına 200 uygular (yani saniyede binlerce); bu onun yanında kasıtlı
     * olarak çok yavaştır — tek bir ağır hücreyi temizlemesi ~3 saniye
     * sürer. Komi mekânı kurtarır, parlatmaz.
     */
    busserGrimeRate: 55,
    /** Komi'nin zemin fırçası yarıçapı (süpürge başlığı 0,42). */
    busserGrimeRadius: 0.55,

    /* ---------------------------------------------------------------- *
     *  YÜRÜRKEN SİLME — asıl iş bunu yapar.
     *
     *  Yukarıdaki "boştayken en kirli noktaya git" davranışı görsel olarak
     *  doğru ama ÖLÇÜMDE etkisiz çıktı: hızı 55 → 2000 (36 kat) yapmak
     *  ağır kaplamayı 0,382'den yalnız 0,391'e taşıdı. Sebep hız değil
     *  GEOMETRİYDİ — kir 14 aktör tarafından saniyede ~1540 birim ve tüm
     *  zemine YAYILARAK üretilirken, komi 0,55 yarıçaplı tek bir daireyi
     *  ovuyordu. Dağıtık üretimin karşılığı dağıtık söküm olmak zorunda.
     * ---------------------------------------------------------------- */
    /**
     * Komi yürürken saniyede sildiği kir. Oyuncunun süpürgesi kare başına
     * 200 uygular (saniyede binlerce) — yani süpürge hâlâ ezici biçimde
     * üstün ve trafik kirinin PARA ödülü yalnız oyuncuda kalır. Bu sayı
     * yalnızca "mekân kendi kendine çürümesin" sigortasıdır.
     */
    busserSweepRate: 600,
    /** Yürürken silme yarıçapı — süpürge başlığından (0,42) dar. */
    busserSweepRadius: 0.34,
  },

  /* ================================================================ *
   *  ELEKTRİKLİ SÜPÜRGE & TOZ
   *
   *  Toz kafenin İKİNCİ ritmi: müşteriye bağlı değil, düzenli aralıklarla
   *  ve rastgele yerlerde birikir. Bulaşık "şu an koş" acilidir; toz ise
   *  "arada bir tur at" işidir. İkisi farklı temposu olan iki ayrı görev.
   * ================================================================ */
  vacuum: {
    /** İki toz lekesi arasındaki süre aralığı (sn) — açılan bölüm sayısıyla kısalır */
    /**
     * Toz aralığı. HUD sıcak rozeti 4 lekede yanar ve o eşik HUD dosyasında;
     * burada tavan 3, aralık 60–90 sn. İlk dakikalarda zemin tozla dolmaz,
     * süpürge hâlâ "arada bir tur" işi olarak kalır.
     */
    spawnInterval: [60, 90] as [number, number],
    /** Aynı anda yerde durabilecek en fazla toz. Sıcak rozet eşiğinin (4) altında. */
    maxDust: 3,

    /* ---------------------------------------------------------------- *
     *  FIRÇA YARIÇAPLARI — temizlik artık iz bırakır.
     *
     *  Eskiden temizlik "menzile gir, leke topluca erisin" mantığındaydı:
     *  yarıçap 3,42 birim (lekenin kendisi 0,85!) ve toz 0,42 saniyede
     *  siliniyordu — oyuncu lekenin YANINDAN koşarak geçerken bile leke
     *  tamamen yok oluyordu. Artık süpürge başlığının GEÇTİĞİ hücreler
     *  silinir; bu sayılar o başlığın gerçek genişliğidir.
     *
     *  Süpürge başlığı mesh'te 0,52 birim geniş → yarıçap 0,26; fırçayı
     *  bir tık cömert tutmak (0,42) "değdiği yeri alıyor" hissini bozmadan
     *  oyunu akıcı kılıyor. Paspas (süpürgesiz) dar: 0,3.
     * ---------------------------------------------------------------- */
    /**
     * SÜPÜRGE FIRÇA YARIÇAPI: 0,42 → 0,80 (2026-08-14, oyuncu isteği).
     *
     * "Süpürge ile çok az yer süpürülüyor… üzerinden tekrar tekrar
     * geçilmesin, tek seferde geçilsin."
     *
     * Ölçüm: leke yarıçapı 0,85 (çap 1,7), eski fırça çapı 0,84 — yani tek
     * geçiş lekenin ancak yarısını alıyordu ve belgelerde de "bir geçiş
     * %60, iki geçiş %80, üç geçiş %100" diye yazılıydı. 0,80 yarıçapla
     * geçiş bandı 1,6 birim olur ve merkezden geçen tek darbe lekenin
     * neredeyse tamamını siler.
     *
     * BAŞLIK DA BÜYÜTÜLDÜ (0,52 → 1,50 birim, bkz. StationView.
     * createHeldVacuum): fırça yarıçapı görsel başlıktan bağımsız
     * büyütülseydi "dokunmadığım yer temizlendi" hissi doğardı — bu tam
     * olarak daha önce şikâyet edilip düzeltilen davranış. Şimdi fırça
     * (0,80) başlığın yarı genişliğinden (0,75) yalnızca bir tık cömert.
     *
     * Süpürgesiz değerler DEĞİŞMEDİ (mopBrushRadius 0,3 ·
     * dustMopBrushRadius 0,13): süpürgenin üstünlüğü artık daha da net.
     */
    brushRadius: 0.8,
    /** Süpürgesiz (elle paspas) fırça yarıçapı */
    mopBrushRadius: 0.3,
    /**
     * Süpürgesiz TOZ fırçası. Bilerek çok dar: toz süpürge işidir, elle
     * uğraşmak mümkün ama zahmetli olmalı. (Eski karşılığı `dustNoVacMult`
     * 0,28'lik hız cezasıydı; fırça modelinde karşılığı dar başlıktır.)
     */
    dustMopBrushRadius: 0.13,
    /** Süpürge başlığının oyuncunun ÖNÜNDEKİ mesafesi (birim) */
    brushForward: 0.95,
    /**
     * OVMA SÜRELERİ (sn) — bir lekenin başında DURARAK tamamen temizleme.
     *
     * Fırça tek başına yetmez: lekenin üstünde duran oyuncu aynı hücreleri
     * tarar ve ilerleme durur (bot bunu 50 dakikalık koşuda TEK leke bile
     * bitiremeyerek yakaladı). Durunca merkezden dışa doğru aşınır.
     *
     * Süreler bilerek SÜPÜRMEKTEN yavaş: üstünden geçerek temizlemek hep
     * daha hızlıdır, durup beklemek son çare kalır. Yanından koşarak geçen
     * oyuncu (~0,35 sn temas) lekenin ancak ~%20'sini alır — eski hâlde
     * 3,42 birim öteden tamamı silinip gidiyordu.
     *
     * ÖLÇÜLEREK AYARLANDI: ilk değerler (3,2 / 5,0 / 11) fazla cezalıydı;
     * 50 dakikalık bot koşusunda hijyen 0'a çöktü ve leke tavana dayandı
     * (14/14). Bunlar eski sürelerin (1,1 / 3,9) ~2 katı — temas şartı
     * zaten büyük bir zorlaştırma, üstüne süre cezası binmemeli.
     */
    /**
     * 2026-08-11 — OVMA, SÜPÜRMEDEN YAVAŞ OLMAK ZORUNDA.
     *
     * Ölçüm: süpürgeyle bir geçiş lekenin %60'ını, iki geçiş %80'ini, üç
     * geçiş %100'ünü alıyordu — yani süpürerek temizlemek ~2-2,5 saniye.
     * Ovma ise 1,72 saniyede TAMAMINI siliyordu. Sonuç: baskın strateji
     * "lekenin üstüne git ve bekle" idi ve oyun tam da kullanıcının
     * şikâyet ettiği gibi davranıyordu ("bir yeri süpürmek direk o
     * bölgeye gelince tüm yeri temizlemiş olmasın").
     *
     * Yeni değerler ovmayı süpürmenin ~2 katına çıkarır: fırça hep daha
     * hızlıdır, durup beklemek gerçekten SON ÇARE olur. Bu sayılar artık
     * REFERANS boyut (dirt.spillRadius) içindir; Spills.scrubAt süreyi
     * lekenin alanıyla çarpar (toz 1,83×).
     *
     * Personeli ETKİLEMEZ: komi ayrı yoldan (`SpillField.erode` +
     * `busserWorkTime`) temizler. Eskiden "fazla cezalı" bulunup geri
     * alınan 3,2/5,0/11 denemesi otomasyonu da yavaşlattığı için hijyeni
     * çökertmişti; burada öyle bir bağ yok.
     */
    /**
     * Referans ovma 4,0 → 2,8 sn: tek leke servisi dondurmasın.
     * Süpürerek geçiş hâlâ ~2–2,5 sn; süpürgesiz ovma 5,5 sn ve dar başlık.
     * Süpürge daha hızlı kalır, durup beklemek de saatlik bir duvar olmaz.
     */
    scrubSeconds: 2.8,
    mopScrubSeconds: 5.5,
    /**
     * Elle toz. 9,0 DENENDİ VE GERİ ALINDI: alan katsayısıyla (toz 1,83×)
     * çarpılınca tek toz lekesi 16,5 saniye sürüyordu ve rehber oyuncuyu
     * oraya yolladığı için oyuncu her lekede çakılıyordu — ölçümde kafe iki
     * dakika boyunca hiç kazanmadı. 5,0 ile efektif süre ~9,2 sn: zahmetli
     * ama oyunu durdurmuyor. Süpürge yine belirgin üstün (aynı tozda 7,3 sn
     * durarak, ~1,6 sn süpürerek) — asıl fark başlık genişliğinde: 0,42'ye
     * karşı 0,13.
     */
    dustMopScrubSeconds: 5.0,
    /** Menzil vurgusu: bu mesafedeki leke "temizlenebilir" sayılır (ok/etiket) */
    detectRadius: 3.4,
    /** Süpürgeyi elde tutarken hareket hızı çarpanı */
    carrySpeedMult: 0.9,

    /* ---------------------------------------------------------------- *
     *  SÜPÜRGE ROBOTU (ödüllü reklam ödülü, bkz. sim/RobotVacuum.ts)
     *
     *  Buradaki sayılar ÖLÇÜLEREK bulundu. İlk deneme (hız 900, yarıçap
     *  0,55, tempo 2,2) 25 saniyede ağır kaplamayı 0,154 → 0,155 yaptı,
     *  yani HİÇ: robot çalışıyor görünüyor ama zemin değişmiyordu — ödüllü
     *  bir reklamın verebileceği en kötü his. Sebep bu projede daha önce
     *  komide de ölçülen şeydi: kir 14 aktör tarafından saniyede ~1540
     *  birim ve BÜTÜN zemine yayılarak üretilir; tek bir temizleyicinin ona
     *  yetişmesi için hem geniş hem hızlı olması gerekir.
     *
     *  Robot bilerek KOMİDEN GÜÇLÜ ama OYUNCUDAN zayıf: para ödemeyen,
     *  süreli bir rahatlama olmalı; oyuncunun kendi süpürgesinin yerine
     *  geçerse mekanik ölür.
     * ---------------------------------------------------------------- */
    /** Robotun saniyede aldığı kir (komi 600, oyuncu ~12.000). */
    robotSweepRate: 2600,
    /** Robotun fırça yarıçapı — oyuncunun geniş başlığıyla (0,80) aynı sınıf. */
    robotSweepRadius: 1.1,
    /** Gezinme hızı (birim/sn). Oyuncudan hızlı: 3 dakikada mekânı taramalı. */
    robotSpeed: 3.4,
  },

  /* ================================================================ *
   *  TUVALET & SARF
   * ================================================================ */
  toilet: {
    useChance: 0.2,
    soilPerUse: 0.18,
    supplyPerUse: 0.5,
    playerScrubTime: 1.8,
    /** Sarf bitmişken tuvalete giren müşterinin itibar cezası */
    emptySupplyRepLoss: 1.4,
    /** Sarf eksikliğinin hijyene baskısı (tam boş tuvalet başına, sn) */
    emptySupplyHygieneDrop: 0.45,
    maxSoilForUse: 0.85,
    serviceFeeRate: 0.2,
  },

  /* ================================================================ *
   *  ZORLUK EĞRİSİ
   *
   *  Başlangıç bilerek kolay: ilk beş dakika oyuncuyu içine çekmeli.
   *  Ama oyun hep aynı basitlikte kalmamalı — açılan her bölümle birlikte
   *  misafirin sabrı kısalır, mekân daha çabuk kirlenir. Kafeyi büyütmek
   *  bir ödül OLDUĞU KADAR bir sorumluluktur; geç oyunda personel almak
   *  tercih değil zorunluluk hâline gelir.
   * ================================================================ */
  difficulty: {
    /** Hiç bölüm açılmamışken sabır çarpanı */
    patienceStart: 1.0,
    /** Her şey açıkken sabır çarpanı */
    patienceEnd: 0.76,
    /** Hiç bölüm açılmamışken kir çarpanı */
    dirtStart: 1.0,
    /** Her şey açıkken kir çarpanı */
    dirtEnd: 1.28,
  },

  /* --- itibar --- */
  reputation: {
    start: 70,
    max: 100,
    min: 20,
    happyGain: 1.6,
    /**
     * Kızgın müşteri cezası KÜÇÜK. Oyun bir ceza mekaniği değil; kaçırılan
     * müşteri zaten kaçırılmış gelirdir, üstüne bir de spiral gerekmez.
     * Taban da 20'de tutulur ki itibar hiç dibi görmesin.
     */
    angryLoss: 1.2,
    theftLoss: 1.5,
    /** İtibar 20 → 0.9×, 100 → 1.45× */
    minMult: 0.9,
    maxMult: 1.45,
  },

  /* --- para --- */
  money: {
    /** Tezgâhta biriken para yığınının maksimumu */
    /**
     * v5: her sipariş kasada PEŞİN ödendiği için yığın eskisinden hızlı
     * dolar; tavan 30'dan 40'a çıktı. Dolu kasa sipariş almayı keser —
     * bu bilinçli bir "oyuncuyu kasaya çağır" basıncıdır (rehber gösterir).
     */
    counterCap: 200,
    pickupInterval: 0.05,
  },

  /* --- offline --- */
  offline: {
    /** Arka planda geçen sürenin kaçta kaçı gelire dönüşür. */
    efficiency: 0.45,
    minSeconds: 45,
    /**
     * Tek bir dönüşte ödenebilecek en fazla süre (saat cinsinden aktif
     * gelir). Depo yükseltmesi kapasiteyi 16 saate çıkarsa bile ödeme
     * bunun üstüne çıkmaz — offline kazanç oyunu bitiren bir kısayol
     * değil, dönmek için bir sebep olmalı.
     */
    maxActiveHours: 3,
    /**
     * Kapalı şubenin, kendi ölçülen aktif gelirinin kaçta kaçını arka
     * planda kazandığı. 1'in altında olması ŞART: aksi hâlde oyunu
     * bırakmak oynamaktan kârlı hâle gelir.
     */
    backgroundShare: 0.5,
    /** Standart offline dönüşte reklam çarpanı. */
    rewardedMultiplier: 2,
    /** Uzun offline dönüşte reklam çarpanı (1 saat ve üzeri). */
    rewardedLongOfflineMultiplier: 3,
    /** Uzun offline sayılma eşiği (sn, 1 saat). */
    longOfflineThresholdSeconds: 3600,
  },

  /* --- kaos olayları --- */
  events: {
    warmup: 120,

    rushInterval: [150, 230] as [number, number],
    rushDuration: 40,
    rushSpawnMult: 2.4,
    rushValueMult: 1.5,

    dasherInterval: [220, 340] as [number, number],
    dasherGrabInterval: 1.5,
    dasherEscapeRepLoss: 3,

    deliveryInterval: [180, 280] as [number, number],
    deliveryDuration: 26,
    deliveryCrates: 6,

    breakdownInterval: [280, 420] as [number, number],
    breakdownRepairTime: 2.0,
    breakdownAfterZone: 'a4',

    influencerInterval: [260, 400] as [number, number],
    influencerDuration: 55,
    influencerRepGain: 10,
    influencerRepLoss: 4,
    /**
     * Fenomenin hesap çarpanı. Bu sabit hiçbir yerde KULLANILMIYORDU:
     * fenomen yalnız arketipin 2,2× ödemesini yapıyor, vaat edilen 4×'in
     * neredeyse yarısını kazandırıyordu. Artık `finishOrder` içinde
     * arketip çarpanının ÜSTÜNE binen bir bonus olarak uygulanır; 4 fazla
     * geliyordu (2,2 × 4 = 8,8×), 1,7 ile toplam ~3,7× olur.
     */
    influencerTipMult: 1.7,
    influencerAfterZone: 't1',

    investorInterval: [240, 420] as [number, number],
    investorDuration: 60,
    investorAfterZone: 'a1',
    investorInteractRadius: 2.2,
    investorCashMultiplier: 1.5,
  },

  /* --- personel yapay zekâsı --- */
  staff: {
    thinkInterval: 0.3,
    reserveTimeout: 5,
    idleReturnDist: 3.5,
    /**
     * PERSONELİN RAF DOLDURMA TAVANI (0..1).
     *
     * Tezgâhtar bir rafı ancak kapasitesinin bu payına kadar besler; üstü
     * OYUNCUNUN işidir. Oyuncu geri bildirimi: "2 tane öyle personel alsa
     * her şeyi hızlıca alıp yerlerine koyar, elemanlar bize ne gerek
     * kalıyor?"
     *
     * Neden %45 ve neden CEZA DEĞİL: taban hep dolu kalır, yani kafe
     * hiçbir zaman ürünsüz kalmaz ve kimse küsmez. Değişen tek şey,
     * mekânda gözle görülür bir işin DURMASI — üst raflar boş bekler.
     * Rafın kendi görseli doluluğu zaten gösterdiği için yeni bir arayüz
     * öğesi gerekmez.
     */
    shelfShare: 0.45,
  },

  /* --- kamera --- */
  camera: {
    fov: 34,
    /**
     * Temel mesafe. Kadraj artık bu sayıyı elle çarpmaz: Scene3D.resize()
     * frustumdan TÜRETİR (bkz. viewWidth).
     */
    distance: 24,
    /**
     * PITCH DERİNLİĞİ, MESAFE KARAKTER BOYUNU kontrol eder — ikisi ayrı
     * levaydır ve karıştırılmamalıdır. 43 iken dikey telefonda kadraj 53,4
     * birim derinlik gösteriyordu; mekân 39,2 derin olduğu için mutfaktan
     * VIP'e kadar HER ŞEY tek karedeydi ve mekân bir kat planı gibi
     * okunuyordu ("kilitli olan 2 oda yan yana çok kötü gözüküyor" geri
     * bildiriminin asıl sebebi plan değil, buydu).
     *
     * Ölçüm (375×812): 43 → derinlik 54,0 · karakter 40 px.
     *                  48 → derinlik 32,4 · karakter 52 px.
     * Pitch'i düşürmek derinliği geri getirir: d22/pitch40 karakteri 53 px
     * yapar ama derinliği 52,8'de bırakır — yani mesafeyi kısmak tek başına
     * yetmez.
     */
    pitch: 48,
    /**
     * YAW SIFIR — dikey ekranin gerektirdigi sey.
     *
     * Ekranin yatayinda gereken dunya genisligi `W·cos(yaw) + D·sin(yaw)`.
     * Mekan derinlestikce yaw yatay butceyi yiyor: 32° ve 34 birim derinlikte
     * yalnizca derinligin katkisi 18 birim eder. Yaw sifirken gereken genislik
     * dogrudan mekanin genisligidir (18), yani dikey ekranda kadraja girer.
     */
    yaw: 0,
    followLerp: 7,
    lookAhead: 0.36,
    /**
     * 2,6 → 2,0 ve YENİ `lookAheadTau` (2026-08-19, "başım dönüyor" geri
     * bildirimi). Öne bakış eskiden HAM hız × 0,36 idi ve hiç süzülmüyordu:
     * oyuncu joystick'i sağdan sola çevirince odak hedefi ~0,15 saniyede
     * 5,2 birim zıplıyor, dünya her küçük düzeltmede ters yöne
     * "çalkalanıyordu". Ölçüm: yön değişiminde odak ivmesi 610 birim/sn².
     * Öne bakış artık kendi yavaş sabitiyle süzülür (odak takibi hızlı
     * kalır — gecikme hissi yok, yalnız BAKIŞ yönü yumuşak döner).
     */
    lookAheadMax: 2.0,
    lookAheadTau: 0.55,

    /**
     * Ekranın YATAYINDA görünmesi istenen dünya genişliği (birim).
     *
     * Neden sabit çarpan değil: eski kod dikey ekranda mesafeyi 1,3–1,52×
     * artırıyordu. Sonuç hem karakterlerin küçülmesi hem de mekânın
     * sığmamasıydı — ikisinin en kötüsü. Genişlik ekranın en-boy oranıyla
     * doğrudan orantılı olduğu için (görünen genişlik = 2·d·tan(fov/2)·oran)
     * dar ekranda mesafeyi ARTIRMAK genişliği yalnızca doğrusal açar ama
     * karakter boyunu aynı oranda küçültür.
     *
     * Dikey telefonda (oran ~0,46) 15 birim görmek 53 birim mesafe ister;
     * bu yüzden mesafe maxDistance'ta durur ve kalan açı fov'dan alınır.
     * Gerçekçi sonuç: dikeyde ~11,5 birimlik bir pencere, ama karakterler
     * eski kadrajdan %30 daha büyük.
     */
    /**
     * DİKKAT — `viewWidth` DİKEY TELEFONDA HİÇ UYGULANMAZ.
     *
     * Türetme 17 birim için ~60 birim mesafe ister; `maxDistance`'a çarpar,
     * kalan açıyı `fovMax`'tan almaya çalışır ve orada da tavana dayanır.
     * Yani portre kadrajı belirleyen şey bu sayı DEĞİL, aşağıdaki
     * `maxDistance` + `fovMax` ikilisidir. `viewWidth` yalnızca GENİŞ
     * ekranlarda (tablet/masaüstü) canlıdır.
     *
     * Tuzak: portre kadrajını değiştirmek isteyen biri burayı ayarlar ve
     * hiçbir şey olmaz. Kadraj için `maxDistance`/`pitch` ayarlanır.
     */
    viewWidth: 15.5,
    /**
     * Dikey telefondaki GERÇEK kamera mesafesi (türetme hep buraya çarpar).
     * 28 → 20: karakter ekranın %4,9'undan %6,4'üne çıkar, görünen derinlik
     * 54 → 32,4 birime iner. Bar hattı endişesi ölçümle düştü: kamera bardan
     * 2,2 birim önde durduğu için bar uzak düzlemdedir ve %90'ı kadraja
     * girer (mutfak ve ilk masa da görünür kalır).
     */
    /**
     * 20 → 21: karakteri büyütürken aktif kafe alanını kadrajda tutar.
     */
    maxDistance: 21,
    /**
     * 19 → 14.5. Geniş ekranda türetme zaten 19'a yapışıyor ve açılış salonu
     * boş zemin olarak okunuyordu. 14.5, karakteri büyütür; portre kadraj
     * bu sayıyı kullanmaz.
     */
    minDistance: 14.5,
    fovMax: 48,
    /**
     * Kamera odağının mekânın GÜNEY kenarına yaklaşabileceği en az mesafe.
     *
     * Odaktan güneye görünen dünya ~7,7 birimdir; kelepçe olmadan oyuncu
     * VIP terasının dibine gidince kadrajın altında ~6 birimlik boş dış
     * zemin kalıyordu (ekranın %28'i). 3,7 ile dışarısı ~4 birime iner ve
     * oyuncu en güneydeyken bile kadrajın alt üçte birinde kalır — daha
     * büyük bir değer oyuncuyu ekranın en altına yapıştırır.
     * (Yalnız güney: bkz. Game.tick.)
     */
    southPad: 3.7,
  },

  /* --- masa / oturma --- */
  cafe: {
    seatRadius: 1.05,
    tableTop: 0.95,
  },

  /* ================================================================ *
   *  HİJYEN — ceza değil BONUS.
   *
   *  Aralık 0,90–1,25: kirli bir kafe kazancın %10'unu kaybeder, tertemiz
   *  bir kafe %25 kazanır. Eski 0,60× taban "oyun beni cezalandırıyor"
   *  hissi veriyordu; asıl motivasyon temizliğin doğrudan para vermesi.
   * ================================================================ */
  hygiene: {
    start: 100,
    dropPerDish: 0.14,
    dropPerSpill: 0.24,
    dropPerToiletSoil: 0.3,
    /** Temizliğin sabit pozitif basıncı (kir yokken saniyede kazanılan puan) */
    /**
     * Toparlanma 1,3 iken tam kadrolu ve tamamen açılmış kafede hijyen 6'ya
     * düşüyordu: toz + tuvalet kirliliği + bulaşık aynı anda basıyor. 1,9
     * ile iki komili bir kafe temiz kalabiliyor, bakımsız bir kafe yine de
     * düşüyor — ölçer anlamını koruyor.
     */
    recover: 1.9,
    /**
     * Hijyeni SIFIRA indiren toplam kir yükü (drop birimi).
     *
     * Yeni denge modelinde (bkz. World.updateHygiene) hedef hijyen
     * `100·(1 − drop/loadForZero)`. Ölçülen tipik yükler: iyi işleyen ve
     * personelli kafe ~0,3 → hijyen ~93; personelsiz, 5 bölgeli, hiç
     * süpürülmemiş kafe ~2,6 → ~35; tamamen ihmal ~4+ → 0.
     */
    loadForZero: 4.0,
    /** Göstergenin hedefe süzülme hızı (λ). Yavaş: ölçer sıçramasın. */
    settleRate: 0.35,
    minMult: 0.9,
    maxMult: 1.25,
  },

  /* ================================================================ *
   *  TEMPO — KAFENİN RİTMİ (v5.2)
   *
   *  Ölçüm (2026-08-15, 60 dk'lık kayıt, tam kadro): oyuncu boştayken de
   *  kasanın arkasındayken de kafe 45,8 servis/dk yapıyordu. Yani akış
   *  regülatörü oyuncunun EMEĞİNİ hiç okumuyordu; `playerBoost` terimi
   *  "oyuncu" adını taşıyor ama satın alınmış YÜKSELTMELERİ okuyor.
   *
   *  Tempo bu boşluğu doldurur: oyuncunun her gerçek eylemi ölçeri
   *  doldurur, boşta kalınca ölçer sönümlenir ve akış tavanı tabana iner.
   *
   *  ÜÇ KURAL:
   *   1. Tempo YALNIZ YUKARI çalışır — hiçbir terimi 1'in altına indirmez.
   *      Boştaki düşüş personel katkısının kısılmasından gelir, tempodan
   *      değil ("asla cezalandırma": ölçer bir ceza değil bir bonustur).
   *   2. Saniyelik dolum tavanı vardır ve AŞAN PAY ATILIR (kuyruğa
   *      alınmaz). Kuyruk olsaydı spam yalnız gecikirdi, engellenmezdi.
   *   3. KAYDA GİRMEZ. Oturum başında 0'dan başlar; kaydetmek "kapatıp
   *      açtım, tempom kaçmış" tuhaflığı üretirdi.
   * ================================================================ */
  tempo: {
    /** Saniyelik sönüm. 0,04 → hiç eylem yoksa 25 saniyede tabana iner. */
    decayPerSecond: 0.04,
    /**
     * Saniyede eklenebilecek EN FAZLA pay. Sönümle birlikte net dolum
     * 0,06/sn, yani sürekli çalışan oyuncu ~17 saniyede tavana çıkar.
     * Bu tavan aynı eylemi arka arkaya yapmayı da sınırlar; doğal iş
     * (üst üste beş ürün dizmek) cezalanmaz, yalnız tavana vurur.
     */
    maxGainPerSecond: 0.1,
    /** Eylem başına ham pay (tavan uygulanmadan önce). */
    gain: {
      /** Rafa/kovaya bir birim bırakma — v5'in ana işi. */
      shelfDrop: 0.1,
      /** Kasadan bir tutam nakit toplama. */
      cashCollect: 0.05,
      /** Bulaşık, leke, süpürge darbesi, sarf, tuvalet ovma. */
      clean: 0.07,
      /** Makine başında "el ver" — saniyelik, küçük (durmak da iştir). */
      handsOnPerSecond: 0.05,
      /** Kaçak müşteri yakalama — nadir ve zor, bu yüzden büyük. */
      dasher: 0.25,
    },
    /**
     * "EL VER" KANCASININ TEK BAŞINA ÇIKABİLECEĞİ TAVAN.
     *
     * Ölçüm (2026-08-16): oyuncu bir makinenin yanına park edilip HİÇBİR
     * eylem yapılmadığında tempo 30 saniyede 1,0'a çıkıyor ve orada
     * kalıyordu — barda iki istasyon aynı anda menzile girdiği için
     * saniyelik bütçe tek başına doluyor, sönüm (0,04) yeniliyordu.
     * Telefonu bara yaslamak kafeyi %100 aktif gösteriyordu, yani turun
     * bütün amacı tek bir park hareketiyle geçersiz oluyordu.
     *
     * Katsayıyı düşürmek YETMEZ: N istasyon menzile girdiğinde katkı
     * N katına çıkar, hangi değer seçilirse seçilsin yeterince yakın
     * durmak sönümü yener. Çözüm bir TAVAN: makine başında durmak
     * tempoyu bu değere kadar taşır, üstünü yalnız GERÇEK İŞ (rafa koyma,
     * kasa toplama, temizlik, kaçak yakalama) açar.
     */
    handsOnCeiling: 0.5,
    /**
     * ASIL KALDIRAÇ — MEKÂN KAPASİTESİ TABANI.
     *
     * Kafenin gerçek gelir tavanı sipariş kuyruğu değil, aynı anda içeride
     * olabilen müşteri sayısıdır (`World.refreshCapacity`). Ölçüm bunu
     * doğruladı: sipariş tavanı ve doğuş aralığı oynatıldığında müşteri
     * sayısı 18'de sabit kaldı. Kod tabanı da yazmış (Quality.ts): sipariş
     * tavanı zamanın %0'ında bağlayıcıydı.
     *
     * Tempo 0 iken kapasite ham değerin bu payında kalır; tempo 1 iken tam
     * kapasiteye açılır. Yani personel kafeyi açık tutar, DOLDURAN oyuncudur.
     *
     * CEZA DEĞİL: tavan yumuşaktır — kapasite düşünce içerideki müşteri
     * atılmaz, yalnız yeni giriş durur. Kimse küsmez, kimse kapıdan dönmez;
     * kafe yalnızca sakinleşir. Isı bütçesi de iyileşir (tavan yükselmez,
     * boştaki kafe daha az karakter çizer).
     *
     * 0,55 → 0,40 (2026-08-15, ölçüldü). Aynı fikstürde 10 dakikalık
     * pencerelerle üç taban denendi — boşta müşteri · servis/dk · boşta
     * ₺/dk · boşta÷aktif oranı (aktif referans ₺75.000/dk: kasada duran +
     * tempo besleyen + rafları dolduran oyuncu vekili):
     *   0,55 → 10,7 · 23,2 · ₺40.587 · oran 0,541
     *   0,40 → 7,8  · 16,6 · ₺28.262 · oran 0,377 ✓ (hedef 0,30-0,40)
     *   0,30 → 5,9  · 13,6 · ₺33.046 · oran 0,441 ← denendi, GERİ ALINDI
     *
     * ORAN MONOTONİK DEĞİL: satış başına gelir sırasıyla ₺1.749 / ₺1.702 /
     * ₺2.430. Kafe çok sessizleşince personel raflara yetişiyor, müşteri
     * pahalı ürün buluyor ve satış başına gelir 0,30'da %43 fırlıyor — yani
     * tabanı daha da kısmak oranı geri yukarı iter. Bu yüzden 0,40 seçildi,
     * daha düşüğü değil.
     */
    venueFloor: 0.40,
    /** `maxPending` çarpanı: tempo 1 iken 1 + bu değer. */
    flowGain: 0.6,
    /** Doğuş aralığı böleni: tempo 1 iken 1 + bu değer. */
    spawnGain: 0.45,
  },

  /* --- genel --- */
  world: {
    maxDelta: 0.05,
    autosaveInterval: 6,
  },
} as const;

export type Balance = typeof BALANCE;

export function clampCustomerWalkSpeed(speed: number): number {
  return Math.max(0, Math.min(BALANCE.customers.walkSpeedCap, speed));
}
