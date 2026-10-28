import { tr } from "./I18n";
import { AdMob, AdmobConsentStatus, RewardAdPluginEvents, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import type { PluginListenerHandle } from '@capacitor/core';
import type { AdProvider } from './Ads';
import { setAdProvider, setAdStatusSource, setPrivacyOptionsHandler } from './Ads';
import { isNative, isIos } from './Native';
import { bus } from './EventBus';

/**
 * ADMOB SAĞLAYICISI — `Ads.ts`'teki soyut arayüzün gerçek karşılığı.
 *
 * `Ads.ts` bilerek SDK'sız kaldı: oyun kodu hangi reklam ağının
 * kullanıldığını bilmez. Bu dosya o ağı bağlayan TEK yerdir; kaldırılırsa
 * oyun eksiksiz ve reklamsız çalışmaya devam eder.
 *
 * ================================================================
 *  ŞU AN GOOGLE'IN RESMÎ TEST KİMLİKLERİ KULLANILIYOR.
 * ================================================================
 * Bu kimlikler herkese açıktır, AdMob hesabı GEREKTİRMEZ ve her zaman
 * dolu bir test reklamı döndürür — yani reklam akışı gerçek cihazda
 * uçtan uca denenebilir. Test reklamı kullanmak Google'ın geliştirme için
 * ÖNERDİĞİ yoldur; kendi gerçek reklamlarını kendin izlemek/tıklamak
 * hesap kapatma sebebidir.
 *
 * YAYINA ÇIKARKEN YAPILACAKLAR (hesap işlemleri kullanıcıya ait):
 *  1. admob.google.com'da uygulama kaydı aç → App ID ve ödüllü Ad Unit
 *     ID'lerini al.
 *  2. Kaynak kodu değiştirmeden `.env.example` içindeki üretim değişkenlerini
 *     derleme ortamına gir. Android App ID `ADMOB_APP_ID`, reklam birimleri
 *     `VITE_ADMOB_*` üzerinden alınır; eksik değer test kimliğine düşer.
 *  3. `docs/gizlilik-politikasi.html`'e reklam bölümü ekle ve Play Data
 *     Safety formunu güncelle: "Device or other IDs → Advertising ID,
 *     collected, shared (ads)". (Oyun içi gizlilik metni `hasAdProvider()`
 *     ile kendiliğinden düzelir, mağazadaki sayfa DÜZELMEZ.)
 *
 * ================================================================
 *  TASARIM: TEK ÖDÜLLÜ YUVA.
 * ================================================================
 * Eski sürüm 5 yerleşimi ayrı ayrı "yüklü" sayıyordu ama hepsi AYNI test
 * birimine bakıyordu; native katman reklamları adUnitId ile sakladığı için
 * ilk gösterimden sonra kalan 4 kayıt HAYALETE dönüşüyordu — teklif
 * görünüyor, İZLE sessizce boşa basıyordu. Artık tek bir `rewardedLoaded`
 * bayrağı var: bir reklam yüklüyse HER yerleşim gösterilebilir (hangi
 * teklifin ne zaman çıkacağına zaten Game.getAdOffers karar veriyor).
 * Gerçek hesapta yerleşim başına AYRI birim istenirse yuva yönetimi de
 * birim başına çoğaltılmalı — raporlama dışında oyunda karşılığı yok.
 */

/** Kimlik verilmediyse güvenli biçimde Google test birimlerine düşer (Android / iOS ayrı). */
const TEST_REWARDED = isIos
  ? 'ca-app-pub-3940256099942544/1712485313'
  : 'ca-app-pub-3940256099942544/5224354917';
const TEST_INTERSTITIAL = isIos
  ? 'ca-app-pub-3940256099942544/4411468910'
  : 'ca-app-pub-3940256099942544/1033173712';
const PRODUCTION_ADS = import.meta.env.VITE_ADMOB_MODE === 'production';

function resolveAdUnitId(envKey: string, envVal: string | undefined, testFallback: string, name: string): string {
  if (PRODUCTION_ADS) {
    if (envVal && envVal.trim().length > 0) {
      return envVal.trim();
    }
    if (isIos) {
      console.info(`[Reklam] iOS üretim derlemesinde ${envKey} henüz tanımlı değil; ${name} devre dışı (reklamsız mod).`);
      return '';
    }
    console.error(`[Reklam] KRİTİK HATA: VITE_ADMOB_MODE=production fakat ${envKey} tanımlı değil! Test ID'ye düşülmedi; ${name} yüklenmeyecek.`);
    return '';
  }
  return testFallback;
}

const REWARDED_ID = resolveAdUnitId(
  isIos ? 'VITE_IOS_ADMOB_REWARDED_ID' : 'VITE_ADMOB_REWARDED_ID',
  isIos
    ? (import.meta.env.VITE_IOS_ADMOB_REWARDED_ID || import.meta.env.VITE_ADMOB_IOS_REWARDED_ID)
    : import.meta.env.VITE_ADMOB_REWARDED_ID,
  TEST_REWARDED,
  'ödüllü reklam'
);

const INTERSTITIAL_ID = resolveAdUnitId(
  isIos ? 'VITE_IOS_ADMOB_INTERSTITIAL_ID' : 'VITE_ADMOB_INTERSTITIAL_ID',
  isIos
    ? (import.meta.env.VITE_IOS_ADMOB_INTERSTITIAL_ID || import.meta.env.VITE_ADMOB_IOS_INTERSTITIAL_ID)
    : import.meta.env.VITE_ADMOB_INTERSTITIAL_ID,
  TEST_INTERSTITIAL,
  'geçiş reklamı'
);

/* ── Geri çekilme (backoff) ayarları ─────────────────────────────── */

/** Başlatma yeniden denemeleri: 5→15→30→60, sonra hep 60 sn. */
const INIT_BACKOFF = [5, 15, 30, 60];
const INIT_MAX_ATTEMPTS = 10;
/** Yükleme yeniden denemeleri: 5→15→30→60 sn. */
const PRELOAD_BACKOFF = [5, 15, 30, 60];
/** Tekrarlayan başarısızlıklarda arka plan sakin deneme aralığı (sn). */
const RELAXED_RETRY_SECONDS = 90;
/** Bekçi: yuva boşken bu aralıkla yeniden yükleme denenir (sn). */
const WATCHDOG_SECONDS = 30;
/**
 * Tam ekran reklamın KAPANMA olayı için emniyet ağı (ms). Normal akışta
 * hiç tetiklenmez — oyun Dismissed/FailedToShow ile devam eder. Yalnız
 * native olay kaybolursa oyunun sonsuza dek duraklı kalmasını önler.
 */
const AD_DISMISS_SAFETY_MS = 180_000;
/** Rıza (UMP) bilgisi alınamazsa yeniden deneme aralıkları (sn). */
const CONSENT_RETRY_BACKOFF = [15, 30, 60, 120];

/* ── Durum ───────────────────────────────────────────────────────── */

type Evre = 'kapali' | 'baslatiliyor' | 'riza_bekliyor' | 'calisiyor' | 'olu';
let evre: Evre = 'kapali';
/** TEK ödüllü yuva — bkz. yukarıdaki tasarım notu. */
let rewardedLoaded = false;
let preloading = false;
let preloadFailures = 0;
let preloadTimer: ReturnType<typeof setTimeout> | null = null;

let interstitialLoaded = false;
let interstitialPreloading = false;
let interstitialFailures = 0;
let interstitialTimer: ReturnType<typeof setTimeout> | null = null;

let sonHata = '';
/**
 * RIZA KAPISI. Varsayılan HAYIR: Google UMP `canRequestAds` true demeden
 * hiçbir reklam istenmez/gösterilmez (AB/UK'de GDPR şartı). Eskiden
 * varsayılan true idi ve rıza akışı hata verdiğinde reklamlar rızasız
 * açılıyordu.
 */
let consentAllowsAds = false;
let consentRetryTimer: ReturnType<typeof setTimeout> | null = null;
let consentRetryCount = 0;
let listenersInstalled = false;

function kisaHata(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err ?? 'bilinmeyen hata');
  return m.length > 64 ? m.slice(0, 61) + '…' : m;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * İnsan-okur reklam durumu — Ayarlar panelindeki "Reklam durumu" satırı.
 * Ads.adStatus() buraya bağlanır (bkz. initAds → setAdStatusSource).
 */
export function adStatus(): string {
  if (!isNative) return tr("kapalı (tarayıcı)");
  switch (evre) {
    case 'kapali':
    case 'baslatiliyor':
      return tr("başlatılıyor…");
    case 'riza_bekliyor':
      return tr("gizlilik tercihi nedeniyle kapalı");
    case 'olu':
      return `hata: ${sonHata || tr("başlatılamadı")}`;
    case 'calisiyor':
      if (!consentAllowsAds) return tr("gizlilik tercihi nedeniyle kapalı");
      if (rewardedLoaded) return tr("hazır");
      if (preloadFailures >= 4) return `hata: ${sonHata || tr("reklam yüklenemedi")}`;
      return tr("yükleniyor…");
  }
}

/* ── Yükleme döngüsü ─────────────────────────────────────────────── */

/**
 * Tek zamanlayıcılı `setTimeout` zinciri — `setInterval` YOK, yani hata
 * tavanına ulaşıldığında geride işleyen sayaç kalmaz. Her `schedulePreload`
 * öncekini iptal eder; çifte planlama zararsızdır.
 */
function schedulePreload(seconds: number): void {
  if (preloadTimer !== null) clearTimeout(preloadTimer);
  preloadTimer = setTimeout(() => {
    preloadTimer = null;
    void preloadTick();
  }, seconds * 1000);
}

async function preloadTick(): Promise<void> {
  if (evre !== 'calisiyor' || !consentAllowsAds) return;
  if (!REWARDED_ID) {
    sonHata = tr("Canlı ödüllü reklam ID tanımlı değil");
    return;
  }
  if (rewardedLoaded) {
    // Yuva dolu: bekçi turu. (Süresi dolan reklamı native bildirmez; o
    // durum show() başarısızlığında yakalanır ve yuva yeniden doldurulur.)
    schedulePreload(WATCHDOG_SECONDS);
    return;
  }
  if (preloading) return; // uçuştaki istek bitince kendi planlamasını yapar
  preloading = true;
  try {
    await AdMob.prepareRewardVideoAd({ adId: REWARDED_ID });
    rewardedLoaded = true;
    preloadFailures = 0;
    schedulePreload(WATCHDOG_SECONDS);
  } catch (err) {
    preloadFailures++;
    sonHata = kisaHata(err);
    console.warn(`[Reklam] Ödüllü reklam yüklenemedi (${preloadFailures}):`, err);
    // Hata durumunda kademeli geri çekilme; tavan sonrasında kalıcı ölmek yerine sakin arka plan bekçisi (90s)
    const delay = preloadFailures <= PRELOAD_BACKOFF.length
      ? PRELOAD_BACKOFF[preloadFailures - 1]
      : RELAXED_RETRY_SECONDS;
    schedulePreload(delay);
  } finally {
    preloading = false;
  }
}

function scheduleInterstitialPreload(seconds: number): void {
  if (interstitialTimer !== null) clearTimeout(interstitialTimer);
  interstitialTimer = setTimeout(() => {
    interstitialTimer = null;
    void preloadInterstitialTick();
  }, seconds * 1000);
}

async function preloadInterstitialTick(): Promise<void> {
  if (evre !== 'calisiyor' || !consentAllowsAds) return;
  if (!INTERSTITIAL_ID) return;
  if (interstitialLoaded) {
    scheduleInterstitialPreload(WATCHDOG_SECONDS);
    return;
  }
  if (interstitialPreloading) return;
  interstitialPreloading = true;
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Interstitial yükleme zaman aşımı (8s)')), 8000)
    );
    await Promise.race([
      AdMob.prepareInterstitial({ adId: INTERSTITIAL_ID }),
      timeoutPromise,
    ]);
    interstitialLoaded = true;
    interstitialFailures = 0;
    scheduleInterstitialPreload(WATCHDOG_SECONDS);
  } catch (err) {
    interstitialFailures++;
    console.warn(`[Reklam] Geçiş reklamı yüklenemedi (${interstitialFailures}):`, err);
    const delay = interstitialFailures <= PRELOAD_BACKOFF.length
      ? PRELOAD_BACKOFF[interstitialFailures - 1]
      : RELAXED_RETRY_SECONDS;
    scheduleInterstitialPreload(delay);
  } finally {
    interstitialPreloading = false;
  }
}

/* ── Sağlayıcı ───────────────────────────────────────────────────── */

const admobProvider: AdProvider = {
  /** Yerleşim seçimi Game.getAdOffers'ta; burada tek soru "yuva dolu mu". */
  isReady(_placement) {
    return consentAllowsAds && rewardedLoaded;
  },

  async show(_placement) {
    if (!consentAllowsAds || !rewardedLoaded) return false;
    /**
     * YUVA GÖSTERİMDEN ÖNCE TÜKETİLİR. Bayrak gösterim sonrasında
     * temizlenseydi, gösterim sırasında düşen bir teklif çipi aynı reklamı
     * "hazır" sanmaya devam ederdi — hayalet teklif hatasının kökü buydu.
     */
    rewardedLoaded = false;
    let earned = false;
    let sub: PluginListenerHandle | null = null;
    /**
     * ÖDÜL YALNIZ 'Rewarded' OLAYIYLA VERİLİR.
     *
     * `showRewardVideoAd()`'in dönmesi reklamın İZLENDİĞİ anlamına gelmez:
     * oyuncu erken kapatırsa da döner. Ödülü olaya bağlamak, kapatan
     * oyuncuya ödül gitmesini engeller — ve bu bir ceza değildir, oyun
     * zaten reklamsız aynı hızda akar.
     */
    let dismissSub: PluginListenerHandle | null = null;
    let failedSub: PluginListenerHandle | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      let onDismiss: () => void = () => {};
      let onFailed: (err: unknown) => void = () => {};
      const dismissPromise = new Promise<void>((resolve) => { onDismiss = resolve; });
      const failedPromise = new Promise<void>((_, reject) => { onFailed = reject; });
      // Emniyet ağı: oyun reklam KAPANANA kadar duraklı kalır (bkz. showInterstitial notu).
      const timeoutPromise = new Promise<void>((_, reject) => {
        safetyTimer = setTimeout(
          () => reject(new Error(`Ödüllü reklam kapanma olayı gelmedi (${AD_DISMISS_SAFETY_MS / 1000}s)`)),
          AD_DISMISS_SAFETY_MS,
        );
      });

      sub = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        earned = true;
      });
      dismissSub = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => onDismiss());
      failedSub = await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (err) => onFailed(err));

      await AdMob.showRewardVideoAd();
      await Promise.race([dismissPromise, failedPromise, timeoutPromise]).catch((e) => {
        console.warn('[Reklam] Ödüllü reklam bekleme/kapanma uyarısı:', e);
      });
    } catch (err) {
      sonHata = kisaHata(err);
      console.warn('[Reklam] Ödüllü reklam gösterilemedi:', err);
      earned = false;
    } finally {
      if (safetyTimer !== null) clearTimeout(safetyTimer);
      if (sub) {
        try { await sub.remove(); } catch {}
      }
      if (dismissSub) {
        try { await dismissSub.remove(); } catch {}
      }
      if (failedSub) {
        try { await failedSub.remove(); } catch {}
      }
      // Bir sonraki teklif için yuvayı hemen doldurmaya başla.
      schedulePreload(1);
    }
    return earned;
  },

  isInterstitialReady() {
    return consentAllowsAds && interstitialLoaded;
  },

  /**
   * GEÇİŞ REKLAMI: Hazır değilse BEKLEMEZ, oyunu bölmemek için hemen atlar.
   * Oyun reklam kapanana kadar duraklı kalır; kapandığında bir sonraki
   * reklam arka planda otomatik yüklenir.
   */
  async showInterstitial() {
    if (!consentAllowsAds || !interstitialLoaded) {
      console.info('[Reklam] Geçiş reklamı hazır değil, gösterim atlandı.');
      return;
    }
    interstitialLoaded = false;
    let dismissSub: PluginListenerHandle | null = null;
    let failedSub: PluginListenerHandle | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      let onDismiss: () => void = () => {};
      let onFailed: (err: unknown) => void = () => {};
      const dismissPromise = new Promise<void>((resolve) => { onDismiss = resolve; });
      const failedPromise = new Promise<void>((_, reject) => { onFailed = reject; });
      /**
       * OYUN, REKLAM KAPANANA KADAR DURAKLATILMIŞ KALIR.
       * Eskiden 8 sn'lik zaman aşımı vardı; 15-30 sn'lik video reklamda oyun
       * sesi ve dokunuşu reklam hâlâ ekrandayken geri açılıyordu. Artık tek
       * sinyal Dismissed / FailedToShow. Bu süre yalnız native olayın hiç
       * gelmediği arıza durumu için bir emniyet ağıdır.
       */
      const safetyPromise = new Promise<void>((_, reject) => {
        safetyTimer = setTimeout(
          () => reject(new Error(`Geçiş reklamı kapanma olayı gelmedi (${AD_DISMISS_SAFETY_MS / 1000}s)`)),
          AD_DISMISS_SAFETY_MS,
        );
      });

      dismissSub = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => onDismiss());
      failedSub = await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (err) => onFailed(err));

      await AdMob.showInterstitial();
      await Promise.race([dismissPromise, failedPromise, safetyPromise]).catch((e) => {
        console.warn('[Reklam] Geçiş reklamı bekleme uyarısı:', e);
      });
    } catch (err) {
      console.warn('[Reklam] Geçiş reklamı gösterilemedi:', err);
    } finally {
      if (safetyTimer !== null) clearTimeout(safetyTimer);
      if (dismissSub) {
        try { await dismissSub.remove(); } catch {}
      }
      if (failedSub) {
        try { await failedSub.remove(); } catch {}
      }
      scheduleInterstitialPreload(1);
    }
  },
};

/* ── Rıza (UMP / GDPR) ───────────────────────────────────────────── */

/**
 * Google UMP formunun zorunlu olduğu saat dilimleri: AB, İngiltere, İsviçre.
 * Türkiye (`Europe/Istanbul`) bu listede yoktur. Form hiç yayınlanmamışsa
 * UMP bölgeyi söyleyemez; o durumda liste dışındaki cihaz reklam ister.
 */
const EU_CONSENT_TIMEZONES = new Set([
  'Europe/Amsterdam', 'Europe/Athens', 'Europe/Berlin', 'Europe/Bratislava',
  'Europe/Brussels', 'Europe/Bucharest', 'Europe/Budapest', 'Europe/Busingen',
  'Europe/Copenhagen', 'Europe/Dublin', 'Europe/Gibraltar', 'Europe/Guernsey',
  'Europe/Helsinki', 'Europe/Isle_of_Man', 'Europe/Jersey', 'Europe/Lisbon',
  'Europe/Ljubljana', 'Europe/London', 'Europe/Luxembourg', 'Europe/Madrid',
  'Europe/Malta', 'Europe/Mariehamn', 'Europe/Nicosia', 'Europe/Oslo',
  'Europe/Paris', 'Europe/Prague', 'Europe/Riga', 'Europe/Rome',
  'Europe/Sofia', 'Europe/Stockholm', 'Europe/Tallinn', 'Europe/Vaduz',
  'Europe/Vienna', 'Europe/Vilnius', 'Europe/Warsaw', 'Europe/Zagreb',
  'Europe/Zurich', 'Atlantic/Canary', 'Atlantic/Faroe', 'Atlantic/Madeira',
  'Atlantic/Reykjavik', 'Arctic/Longyearbyen',
]);

function deviceInEuConsentRegion(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    return EU_CONSENT_TIMEZONES.has(tz);
  } catch {
    return false;
  }
}

/** AdMob'da Avrupa formu yayınlanmamış. Bu bir oyuncu reddi değil. */
function umpMissingPrivacyForm(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return m.includes('no form') && m.includes('configured');
}

/**
 * Google UMP akışı: rıza bilgisini tazeler, gerekiyorsa formu gösterir ve
 * "reklam istenebilir mi" cevabını döndürür. Hata FIRLATIR — çağıran karar
 * verir.
 */
async function runConsentFlow(): Promise<boolean> {
  let info = await AdMob.requestConsentInfo();
  if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
    info = await AdMob.showConsentForm();
  }
  return info.canRequestAds;
}

/** Yeni rıza kararını uygular; izin geldiyse SDK'yı başlatır ya da yuvaları doldurur. */
function applyConsent(allowed: boolean): void {
  consentAllowsAds = allowed;
  if (!allowed) return; // kapılar (isReady/show/preload) gerisini halleder
  if (evre === 'riza_bekliyor') {
    void startSdk();
  } else if (evre === 'calisiyor') {
    schedulePreload(0.2);
    scheduleInterstitialPreload(0.2);
  }
}

/**
 * Rıza bilgisi ALINAMADIYSA kademeli yeniden denenir. Oyuncu rızayı
 * REDDETTİYSE bu çağrılmaz — o karar Ayarlar → gizlilik tercihleri ile değişir.
 * Form hiç yoksa ve cihaz AB/UK/İsviçre dışındaysa reklam açık kalır.
 */
function scheduleConsentRetry(): void {
  if (consentRetryTimer !== null) return;
  const delay = CONSENT_RETRY_BACKOFF[Math.min(consentRetryCount, CONSENT_RETRY_BACKOFF.length - 1)];
  consentRetryCount++;
  consentRetryTimer = setTimeout(async () => {
    consentRetryTimer = null;
    try {
      const allowed = await runConsentFlow();
      consentRetryCount = 0;
      applyConsent(allowed);
    } catch (err) {
      sonHata = kisaHata(err);
      if (PRODUCTION_ADS && umpMissingPrivacyForm(err) && !deviceInEuConsentRegion()) {
        console.warn('[Reklam] AB gizlilik formu hâlâ yok; bu cihaz form bölgesinde değil, reklam isteği sürüyor.', err);
        if (!consentAllowsAds) applyConsent(true);
      } else {
        console.warn(`[Reklam] Rıza bilgisi yine alınamadı (${consentRetryCount}).`, err);
      }
      scheduleConsentRetry();
    }
  }, delay * 1000);
}

/* ── Başlatma ────────────────────────────────────────────────────── */

/**
 * Reklam ağını başlatır ve sağlayıcıyı takar.
 *
 * WEB DERLEMESİNDE HİÇBİR ŞEY YAPMAZ: eklenti yalnız native platformda
 * çalışır, tarayıcıda `setAdProvider` çağrılmaz ve oyun tamamen reklamsız
 * kalır (DEV tarayıcıda sahte sağlayıcı devrededir — bkz. DevAdProvider).
 *
 * SIRA (Google UMP kuralı): ÖNCE rıza, SONRA `initialize`.
 *  · Rıza verildi ya da gerekmiyor → SDK başlar, reklamlar yüklenir.
 *  · Rıza reddedildi               → SDK başlamaz; Ayarlar'dan değiştirilebilir.
 *  · Form hiç yayınlanmamış        → Yalnız AB/UK/İsviçre kapalı kalır.
 *                                    Türkiye dahil diğer bölgeler reklam ister.
 *                                    Form yalnızca o üç bölge içindir.
 *  · Ağ / UMP hatası               → Üretimde reklam kapalı kalır ve akış
 *                                    yeniden denenir. Test derlemesinde açılır.
 */
export async function initAds(): Promise<void> {
  if (!isNative) return;
  if (evre !== 'kapali') return; // çifte çağrı koruması
  evre = 'baslatiliyor';
  // Durum satırı daha ilk saniyeden anlamlı olsun ('başlatılıyor…').
  setAdStatusSource(adStatus);

  // iOS App Store Guideline 5.1.2(i): Info.plist içinde NSUserTrackingUsageDescription
  // tanımlıysa, sahne aktif olduktan sonra sistem ATT izni (ATTrackingManager)
  // istenmelidir. 1.5 sn gecikme açılış ekranının kapanmasını garantiler.
  if (isIos) {
    await sleep(1500);
    try {
      const att = await AdMob.trackingAuthorizationStatus();
      if (att.status === 'notDetermined') {
        await AdMob.requestTrackingAuthorization();
      }
    } catch (err) {
      console.warn('[Reklam] iOS ATT izni sorgulanamadı:', err);
    }
  }

  // Üretim derlemesinde henüz canlı reklam birimleri girilmemişse (ör. ilk App Store
  // incelemesi), ATT kontrolünden sonra SDK ve UMP başlatılmaz; oyun %100 reklamsız çalışır.
  if (PRODUCTION_ADS && !REWARDED_ID && !INTERSTITIAL_ID) {
    evre = 'riza_bekliyor';
    return;
  }

  setPrivacyOptionsHandler(async () => {
    await AdMob.showPrivacyOptionsForm();
    const info = await AdMob.requestConsentInfo();
    applyConsent(info.canRequestAds);
  });

  let allowed = false;
  try {
    allowed = await runConsentFlow();
  } catch (err) {
    sonHata = kisaHata(err);
    if (PRODUCTION_ADS && umpMissingPrivacyForm(err) && !deviceInEuConsentRegion()) {
      console.warn('[Reklam] AB gizlilik formu tanımlı değil. Form yalnızca AB, İngiltere ve İsviçre için gerekir; bu cihaz o bölgede olmadığı için reklam isteniyor.', err);
      allowed = true;
      scheduleConsentRetry();
    } else if (PRODUCTION_ADS) {
      console.warn('[Reklam] Rıza bilgisi alınamadı; rıza netleşene kadar reklam KAPALI.', err);
      scheduleConsentRetry();
    } else {
      console.warn('[Reklam] Rıza akışı hata verdi; TEST derlemesi olduğu için reklamlar açık.', err);
      allowed = true;
    }
  }

  consentAllowsAds = allowed;
  if (!allowed) {
    evre = 'riza_bekliyor';
    return;
  }
  await startSdk();
}

/**
 * SDK'yı başlatır, dinleyicileri (bir kez) takar ve ilk yüklemeyi yapar.
 * Yalnız rıza izin verdiğinde çağrılır (bkz. initAds / applyConsent).
 *
 * DAYANIKLILIK: `initialize` kendi geri çekilmeli yeniden denemesinde;
 * yükleme hataları FailedToLoad dinleyicisi + geri çekilme + 30 sn'lik
 * bekçi zinciriyle toparlanır.
 */
async function startSdk(): Promise<void> {
  if (evre === 'calisiyor' || evre === 'olu') return;
  evre = 'baslatiliyor';

  for (let deneme = 1; ; deneme++) {
    try {
      await AdMob.initialize({ initializeForTesting: !PRODUCTION_ADS });
      break;
    } catch (err) {
      sonHata = kisaHata(err);
      console.warn(`[Reklam] AdMob başlatılamadı (deneme ${deneme}/${INIT_MAX_ATTEMPTS}):`, err);
      if (deneme >= INIT_MAX_ATTEMPTS) {
        evre = 'olu';
        console.warn('[Reklam] Başlatma denemeleri tükendi; bu oturumda reklam yok.');
        return;
      }
      await sleep(INIT_BACKOFF[Math.min(deneme - 1, INIT_BACKOFF.length - 1)] * 1000);
    }
  }

  // `initialize` başarılıysa sağlayıcı takılır.
  evre = 'calisiyor';
  setAdProvider(admobProvider);

  if (listenersInstalled) {
    void preloadTick();
    void preloadInterstitialTick();
    return;
  }
  listenersInstalled = true;

  // 4) Kemer-pantolon askısı: native taraf yükleme hatası bildirirse yuvayı
  // boşalt ve (zincir boştaysa) kısa süre sonra yeniden dene.
  try {
    await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (err) => {
      rewardedLoaded = false;
      sonHata = kisaHata(err?.message ?? err);
      if (!preloading && preloadTimer === null) schedulePreload(5);
    });
  } catch (err) {
    console.warn('[Reklam] Reward FailedToLoad dinleyicisi takılamadı:', err);
  }

  try {
    await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
      interstitialLoaded = false;
      if (!interstitialPreloading && interstitialTimer === null) scheduleInterstitialPreload(5);
    });
  } catch (err) {
    console.warn('[Reklam] Interstitial FailedToLoad dinleyicisi takılamadı:', err);
  }

  // 5) ILRD / Gelir telemetrisi (Paid Event / Impression-Level Revenue)
  try {
    await AdMob.addListener(RewardAdPluginEvents.AdImpression, (data) => {
      const value = (data?.valueMicros ?? 0) / 1_000_000;
      bus.emit('ad:revenue', {
        value,
        currency: data?.currencyCode ?? 'USD',
        precision: data?.precision ?? 0,
        adUnit: data?.adUnitId ?? REWARDED_ID,
        format: 'rewarded',
      });
    });
  } catch (err) {
    console.warn('[Reklam] Rewarded AdImpression dinleyicisi takılamadı:', err);
  }

  try {
    await AdMob.addListener(InterstitialAdPluginEvents.AdImpression, (data) => {
      const value = (data?.valueMicros ?? 0) / 1_000_000;
      bus.emit('ad:revenue', {
        value,
        currency: data?.currencyCode ?? 'USD',
        precision: data?.precision ?? 0,
        adUnit: data?.adUnitId ?? INTERSTITIAL_ID,
        format: 'interstitial',
      });
    });
  } catch (err) {
    console.warn('[Reklam] Interstitial AdImpression dinleyicisi takılamadı:', err);
  }

  // 6) Uygulama arka plandan döndüğünde boş yuvaları doldurmaya çalış
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && evre === 'calisiyor' && consentAllowsAds) {
        if (!rewardedLoaded && !preloading) {
          preloadFailures = 0;
          schedulePreload(1);
        }
        if (!interstitialLoaded && !interstitialPreloading) {
          interstitialFailures = 0;
          scheduleInterstitialPreload(1);
        }
      }
    });
  }

  // 7) İlk yükleme
  if (consentAllowsAds) {
    void preloadTick();
    void preloadInterstitialTick();
  }
}
