import { tr } from "./I18n";
/**
 * REKLAM KATMANI — yerleşimler, ödüller ve gösterim disiplini.
 *
 * Burada REKLAM SDK'SI YOKTUR ve olmamalıdır. Bu dosya yalnızca oyunun
 * hangi anlarda reklam teklif edeceğini tanımlar ve tek bir arayüzün
 * arkasına alır. AdMob / Unity Ads / ironSource hangisi seçilirse
 * `provider` oraya bağlanır; oyun kodunun geri kalanı değişmez.
 *
 * ================================================================
 *  TASARIM KURALI: REKLAM ASLA BİR KAPI DEĞİLDİR.
 * ================================================================
 * Hiçbir içerik reklam arkasında kilitli değil, hiçbir ilerleme reklam
 * izlemeden yavaşlamıyor. Teklif edilen her şey bir HIZLANDIRICI:
 * oyuncu izlemezse oyun aynı hızda akmaya devam eder. Projenin "asla
 * cezalandırma" kuralı burada da geçerli.
 *
 * Bu kural ödüllerin SEÇİMİNİ de belirler. Ödül üç şarttan geçmeli:
 *   1. Oyuncunun elle yapabileceği bir şeyi HIZLANDIRIR (yerine geçmez).
 *   2. Süreli ya da tek seferliktir — kalıcı güç vermez, yoksa izlemeyen
 *      oyuncu kalıcı olarak geri kalır ve reklam fiilen kapıya dönüşür.
 *   3. İzlenmediğinde oyuncu bir şey KAYBETMİŞ hissetmez; yalnızca ek bir
 *      şey kazanmamış olur.
 */

/* ================================================================ *
 *  1 · ÖDÜLLÜ YERLEŞİMLER
 *
 *  Her yerleşim bir İSTEK ANINA bağlıdır. Doğru an, ödülün kendisinden
 *  daha önemlidir: oyuncu bir şeyi zaten istediği anda teklif edilen
 *  reklam gönüllü izlenir, rastgele bir anda teklif edilen reklam
 *  rahatsız eder ve teklif körlüğü yaratır.
 * ================================================================ */

export type AdPlacement =
  /**
   * 4 dakikalık "Mutlu Saat": kazanç ×2.
   * İSTEK ANI: kafe tam kapasite dönerken — çarpanın değeri en yüksek
   * olduğu an. Boş kafede teklif edilmez, yoksa ödül değersizleşir.
   */
  | 'happy_hour'
  /**
   * Sıradaki bölümün KALAN ödemesini tamamla.
   * İSTEK ANI: oyuncu pedin üstünde para akıtmış ama bitirememişken.
   * Türün en güçlü "az kaldı" anıdır. Eşik `ZONE_FINISH_MIN_PAID`:
   * hiç ödeme yapılmamış bir bölümü bedava vermek ilerlemeyi satmak
   * olurdu — burada satılan şey SON ADIM.
   */
  | 'zone_finish'
  /**
   * OTOMATİK SÜPÜRGE ROBOTU — belirli bir süre zemini kendi temizler.
   * İSTEK ANI: zemin gözle görülür kirlendiğinde.
   *
   * Neden bu ödül iyi: oyunun tek gerçek ANGARYASINI geçici olarak
   * devralır. Oyuncu temizliği elle de yapabilir (kapı değil), ama o
   * sırada servise dönebilmek gerçek bir rahatlama. Ayrıca ekranda
   * GÖRÜNÜR — çalışan robotu izlemek ödülün kendisini hissettirir;
   * görünmeyen çarpanların yapamadığı şey budur.
   */
  | 'robot_vacuum'
  /**
   * Tüm makine depolarını anında doldur.
   * İSTEK ANI: depolar boşken ya da oyuncu oyuna yeni döndüğünde —
   * "hazırlıksız yakalandım" hissinin tam karşılığı.
   */
  | 'stock_refill'
  /**
   * Günlük ödülü ikiye katla.
   * İSTEK ANI: ödül alınırken. Türde en yüksek gönüllü izlenme oranına
   * sahip yerleşim: oyuncu zaten kazandığı bir şeyi büyütüyor.
   */
  | 'daily_double'
  /* ── v5.1 "Sadakat" turu yerleşimleri ─────────────────────────── */
  /**
   * ~90 saniyelik ölçülen gelire denk NAKİT (taban ₺400).
   * İSTEK ANI: sıradaki pedin %60-90'ı ödenmişken — "az kaldı ama kasam
   * yetmiyor" ânı. Üç kural: ped birikimini yalnız HIZLANDIRIR (oyuncu
   * aynı parayı servisle de kazanır); tek seferliktir; teklif ödeme
   * bandına bağlı olduğu için izlemeyen oyuncu hiçbir eşiği kaçırmaz.
   * `zone_finish`ten farkı: orada kalan borç silinir, burada kasaya
   * ölçülü bir destek girer; %90 üstünde doğru teklif zaten zone_finish.
   */
  | 'cash_boost'
  /**
   * USTA MODU: süreli olarak "el ver" bonusu TÜM makinelerde + oyuncu
   * hızı ×1,25. İSTEK ANI: kasalarda toplam ≥4 müşteri beklerken —
   * oyuncunun her yerde birden olmak İSTEDİĞİ an. Kural gereği süreli;
   * ödül oyuncunun kendi mekaniğini (makine başında durmak) büyütür,
   * yerine geçmez — izlemeyen aynı bonusu makine makine gezerek alır.
   */
  | 'usta_mode'
  /**
   * MÜŞTERİ AKINI: süreli müşteri akışı ×1,6 + sabır ×1,2.
   * İSTEK ANI: raf doluluğu ≥ %70 — üretim satıştan hızlıyken ekstra
   * müşteri gerçek değer taşır; boş rafla akın ceza olurdu. Sabır çarpanı
   * akının kendi yükünü dengeler: davet ettiğimiz kalabalık müşteri
   * küstürerek cezaya dönüşmesin (asla cezalandırma).
   */
  | 'rush_hour'
  /**
   * ARIZA SİGORTASI: aktif arıza anında tamir + süreli arıza bağışıklığı.
   * İSTEK ANI: en az bir makine gerçekten arızalıyken — tamiri usta zaten
   * 75 sn'de kendisi yapar (kapı değil), satılan şey bekleme + kısa bir
   * dinginlik. Süreli olduğu için kalıcı güç vermez; izlemeyen oyuncu
   * yalnız o beklemeyi yaşar, hiçbir şey kaybetmez.
   */
  | 'repair_shield'
  /**
   * BAHŞİŞ YAĞMURU: süreli masa bahşişleri ×3.
   * İSTEK ANI: VIP salon (r2) açıkken — masa servisi ekonominin görünür
   * bir kolu olduğunda. Bahşiş zaten oyuncunun servis hızının ödülü;
   * çarpan onu büyütür, yerine geçmez ve süre bitince iz bırakmaz.
   */
  | 'tip_rain'
  /**
   * ZENGİN YATIRIMCI: Kafeye gelen VIP yatırımcıdan nakit hibe.
   */
  | 'investor'
  | 'comeback_sale'
  /**
   * ÜCRETSİZ YÜKSELTME: Nakit yetmediğinde menüden 1 seviye yükseltme.
   * Oyun dengesini bozmamak için 60 sn bekleme süresi (cooldown) vardır.
   */
  | 'free_upgrade';

/* ================================================================ *
 *  2 · ÖDÜL BÜYÜKLÜKLERİ
 *
 *  Hepsi SÜRELİ ya da TEK SEFERLİK. Kalıcı güç veren tek bir ödül bile
 *  yok — bkz. yukarıdaki 2. şart.
 * ================================================================ */

/** Mutlu Saat: adım süresi (sn, 5 dakika), tavan (20 dakika) ve kazanç çarpanı. */
export const HAPPY_HOUR_SECONDS = 300;
export const HAPPY_HOUR_STEP_SECONDS = 300;
export const HAPPY_HOUR_MAX_SECONDS = 1200;
export const HAPPY_HOUR_MULT = 2;

/**
 * Süpürge robotu: süre (sn, 5 dakika).
 */
export const ROBOT_SECONDS = 300;

/**
 * `zone_finish` teklifinin görüneceği EN DÜŞÜK ödeme oranı.
 *
 * Bu eşik olmadan teklif "bölüm satın al" hâline gelir ve reklam bir
 * kapıya dönüşür. %35 ile teklif ancak oyuncu işin bir kısmını kendi
 * yaptığında belirir; satılan şey ilerleme değil, son adımın beklemesi.
 */
export const ZONE_FINISH_MIN_PAID = 0.35;

/** Menü içi ücretsiz yükseltme (RV) bekleme süresi (sn). */
export const FREE_UPGRADE_COOLDOWN_SEC = 60;

/** Günlük ödül çarpanı. */
export const DAILY_DOUBLE_MULT = 2;

/* ── v5.1 "Sadakat" turu ödül büyüklükleri ─────────────────────────── */

/**
 * Nakit desteği: ~300 saniyelik ölçülen gelire denk nakit (taban ₺1200).
 */
export const CASH_BOOST_INCOME_SECONDS = 300;
export const CASH_BOOST_FLOOR = 1200;

/**
 * `cash_boost` teklif bandı: sıradaki pedin ödenme oranı bu aralıktayken
 * görünür. Alt eşik `ZONE_FINISH_MIN_PAID` ile aynı gerekçeyi taşır
 * (ilerlemenin kendisi satılmaz); üst eşik zone_finish ile çakışmayı
 * sınırlar — %90'dan sonra doğru teklif nakit değil "son adımı kapat"tır.
 */
export const CASH_BOOST_MIN_PAID = 0.6;
export const CASH_BOOST_MAX_PAID = 0.9;

/** Usta modu: süre (sn, 5 dakika), oyuncu hız çarpanı ve kuyruk eşiği (müşteri). */
export const USTA_SECONDS = 300;
export const USTA_SPEED_MULT = 1.25;
export const USTA_MIN_QUEUE = 4;

/** Müşteri akını: süre (sn), akış ×, sabır × ve raf doluluk eşiği (0..1). */
export const RUSH_HOUR_SECONDS = 150;
export const RUSH_HOUR_SPAWN_MULT = 1.6;
export const RUSH_HOUR_PATIENCE_MULT = 1.2;
export const RUSH_HOUR_MIN_SHELF = 0.7;

/** Arıza sigortası: anında tamir + bu süre boyunca yeni arıza doğmaz (sn). */
export const REPAIR_SHIELD_SECONDS = 300;

/** Bahşiş yağmuru: süre (sn, 5 dakika) ve masa bahşişi çarpanı. */
export const TIP_RAIN_SECONDS = 300;
export const TIP_RAIN_MULT = 3;

/** Dönüş satışı: satılan stok payı (0..1) ve teklif eşiği (birim). */
export const COMEBACK_SHARE = 0.5;
export const COMEBACK_MIN_STOCK = 10;

/* ================================================================ *
 *  3 · SAĞLAYICI ARAYÜZÜ
 * ================================================================ */

export interface AdProvider {
  /** Bu yerleşim için gösterilecek ödüllü reklam hazır mı. */
  isReady(placement: AdPlacement): boolean;
  /** Ödüllü reklamı göster. Ödül hak edildiyse true döner. */
  show(placement: AdPlacement): Promise<boolean>;
  /**
   * GEÇİŞ REKLAMI (interstitial). İsteğe bağlı: sağlayıcı bunu
   * uygulamazsa oyun yalnızca ödüllü reklamla çalışır ve hiçbir şey
   * bozulmaz.
   */
  showInterstitial?(): Promise<void>;
  /** Geçiş reklamı önceden yüklendi mi ve gösterime hazır mı. */
  isInterstitialReady?(): boolean;
}

/**
 * Varsayılan sağlayıcı: hiçbir reklam yok.
 *
 * Web derlemesinde ve SDK bağlanmadan önce bu kullanılır; `isReady`
 * daima false döndüğü için arayüzde reklam butonu HİÇ görünmez. Yani
 * oyun SDK'sız da eksiksiz oynanır — bu bir yedek plan değil, DESTEKLENEN
 * bir yayın biçimi.
 */
const noAds: AdProvider = {
  isReady: () => false,
  show: async () => false,
};

let provider: AdProvider = noAds;
let privacyOptionsHandler: (() => Promise<void>) | null = null;

/** Mağaza derlemesinde SDK bağlandığında çağrılır. */
export function setAdProvider(p: AdProvider): void {
  provider = p;
}

/**
 * BİR REKLAM SAĞLAYICISI KURULU MU.
 *
 * `adReady()` ile karıştırma: o "şu an gösterilecek dolu reklam var mı"
 * sorusudur ve envanter boşken sağlayıcı kuruluyken de false döner.
 * Buradaki soru "bu derleme reklam SDK'sı taşıyor mu" — cevabı Ayarlar
 * panelindeki gizlilik beyanını belirler (bkz. ui/Panels gizlilik bloğu).
 */
export function hasAdProvider(): boolean {
  return provider !== noAds;
}

export function setPrivacyOptionsHandler(handler: (() => Promise<void>) | null): void {
  privacyOptionsHandler = handler;
}

/** Google UMP gizlilik seçeneklerini yeniden açar. */
export async function openPrivacyOptions(): Promise<boolean> {
  if (!privacyOptionsHandler) return false;
  try {
    await privacyOptionsHandler();
    return true;
  } catch (err) {
    console.warn('[Reklam] Gizlilik seçenekleri açılamadı:', err);
    return false;
  }
}

export function adReady(placement: AdPlacement): boolean {
  try {
    return provider.isReady(placement);
  } catch {
    return false;
  }
}

/* ── Reklam durumu — Ayarlar panelindeki "Reklam durumu" satırı ──── */

/**
 * İnsan-okur durum metninin ÜRETİCİSİ. Bu dosya SDK'sız kaldığı için
 * durumu kendisi bilemez; sağlayıcı modülü (AdMobProvider ya da
 * DevAdProvider) kendi durum kaynağını buraya takar. Kaynak yoksa cevap
 * "sağlayıcı yok" — tarayıcı üretim derlemesinin normal hâli.
 */
let statusSource: (() => string) | null = null;

/** Sağlayıcı modülü kendi durum üreticisini takar (bkz. AdMobProvider.adStatus). */
export function setAdStatusSource(fn: (() => string) | null): void {
  statusSource = fn;
}

/**
 * Reklam sağlayıcısının insan-okur durumu. Olası değerler sağlayıcıya
 * göre: 'sağlayıcı yok' | 'kapalı (tarayıcı)' | 'başlatılıyor…' |
 * 'hazır' | 'yükleniyor…' | 'hata: <kısa mesaj>' |
 * 'hazır (DEV sahte reklamı)'.
 */
export function adStatus(): string {
  if (statusSource) {
    try {
      return statusSource();
    } catch {
      return tr("hata: durum okunamadı");
    }
  }
  return tr("sağlayıcı yok");
}

/**
 * Ödüllü reklamı göster ve ödülün hak edilip edilmediğini döndür.
 * Hata durumunda daima false — oyuncuya ödül verilmez ama oyun da bozulmaz.
 */
export async function showRewarded(placement: AdPlacement): Promise<boolean> {
  try {
    const ok = await provider.show(placement);
    if (ok) {
      notifyRewardedWatched();
    }
    return ok;
  } catch (err) {
    console.warn('[Reklam] Gösterilemedi:', err);
    return false;
  }
}

/* ================================================================ *
 *  4 · AKILLI GEÇİŞ REKLAMI (SMART INTERSTITIAL)
 *
 *  DİSİPLİN — YALNIZCA DOĞAL VE GÜVENLİ ANLARDA:
 *   1. Yalnız DOĞAL ARALARDA (şube değişimi, devir sonrası, kutlama
 *      bitişi, panel kapanışı).
 *   2. Oyuncu hareket halindeyken veya elinde ürün taşırken ASLA.
 *   3. Ödüllü reklam izlendiyse `REWARDED_TO_INTERSTITIAL_GAP` saniye
 *      geçiş reklamı SUSTURULUR.
 *   4. Oturumun ilk `INTERSTITIAL_WARMUP` saniyesinde hiç gösterilmez
 *      (öğretici zaten ayrıca korunuyor: isTutorialDone).
 *   5. İki reklam arası en az `INTERSTITIAL_MIN_GAP` saniye.
 *   6. Oturum başına en fazla `INTERSTITIAL_SESSION_CAP` gösterim.
 *   7. İlk `INTERSTITIAL_GOAL_WARMUP` hedef tamamlanmadan gösterilmez
 *      (`goalsCompleted`, yani `state.goalIndex`).
 * ================================================================ */

export const INTERSTITIAL_WARMUP = 60;
export const INTERSTITIAL_MIN_GAP = 90;
export const REWARDED_TO_INTERSTITIAL_GAP = 60;
export const INTERSTITIAL_SESSION_CAP = 4;
/** Bu kadar hedef bitmeden geçiş reklamı yok. `goalIndex` tamamlanan sayıdır. */
export const INTERSTITIAL_GOAL_WARMUP = 8;

let interstitialEnabled = true;
let sessionStart = Date.now();
let lastInterstitial = 0;
let lastRewardedWatched = 0;
let interstitialCount = 0;

export interface InterstitialSafetyContext {
  isPlayerIdle?: boolean;
  isPlayerHandsEmpty?: boolean;
  isTutorialDone?: boolean;
  hasActiveCrisis?: boolean;
  /** Tamamlanmış hedef sayısı (`state.goalIndex`). */
  goalsCompleted?: number;
}

/** Oyuncu kendi rızasıyla ödüllü reklam izlediğinde geçiş reklamını erteler. */
export function notifyRewardedWatched(): void {
  lastRewardedWatched = Date.now();
}

/**
 * Geçiş reklamlarını açar/kapatır. "Reklamları Kaldır" satın alması
 * yapıldığında buradan KAPATILIR — tek anahtar.
 */
export function setInterstitialEnabled(on: boolean): void {
  interstitialEnabled = on;
}

export function interstitialsOn(): boolean {
  return interstitialEnabled;
}

/** Oturum sayaçlarını sıfırlar (soğuk açılışta). */
export function resetAdSession(): void {
  sessionStart = Date.now();
  lastInterstitial = 0;
  lastRewardedWatched = 0;
  interstitialCount = 0;
}

/**
 * Geçiş reklamının şu an gösterilip gösterilemeyeceğini denetler.
 */
export function canShowInterstitial(ctx?: InterstitialSafetyContext): boolean {
  if (!interstitialEnabled) return false;
  if (!provider.showInterstitial) return false;
  if (provider.isInterstitialReady && !provider.isInterstitialReady()) return false;

  // Güvenlik kontrolleri: Oyuncu meşgulken veya kriz anında reklam ASLA açılamaz.
  if (ctx) {
    if (ctx.isTutorialDone === false) return false;
    if (ctx.isPlayerHandsEmpty === false) return false;
    if (ctx.isPlayerIdle === false) return false;
    if (ctx.hasActiveCrisis === true) return false;
    if (ctx.goalsCompleted !== undefined && ctx.goalsCompleted < INTERSTITIAL_GOAL_WARMUP) return false;
  }

  const now = Date.now();
  if (now - sessionStart < INTERSTITIAL_WARMUP * 1000) return false;
  if (lastInterstitial > 0 && now - lastInterstitial < INTERSTITIAL_MIN_GAP * 1000) return false;
  if (lastRewardedWatched > 0 && now - lastRewardedWatched < REWARDED_TO_INTERSTITIAL_GAP * 1000) return false;
  if (interstitialCount >= INTERSTITIAL_SESSION_CAP) return false;

  return true;
}

/**
 * DOĞAL BİR ARADA geçiş reklamı göstermeyi dener.
 *
 * Güvenlik bağlamı (ctx) sağlanırsa oyuncunun meşgul olmadığı teyit edilir.
 */
export async function tryInterstitial(ctx?: InterstitialSafetyContext): Promise<boolean> {
  if (!canShowInterstitial(ctx)) return false;

  try {
    if (provider.showInterstitial) {
      await provider.showInterstitial();
      lastInterstitial = Date.now();
      interstitialCount++;
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[Reklam] Geçiş reklamı gösterilemedi:', err);
    return false;
  }
}
