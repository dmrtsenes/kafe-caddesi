import { tr } from "./I18n";
import {
  AdMob,
  AdmobConsentStatus,
  AppOpenAdPluginEvents,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  RewardAdPluginEvents,
  RewardInterstitialAdPluginEvents,
} from '@capacitor-community/admob';
import type { PluginListenerHandle } from '@capacitor/core';
import type { AdProvider } from './Ads';
import { setAdProvider, setAdStatusSource, setPrivacyOptionsHandler } from './Ads';
import { isNative, isIos, isPreviewBuild } from './Native';
import { bus, type AdRevenueFormat } from './EventBus';
import { analytics, deviceInEuConsentRegion } from './Analytics';

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
const TEST_BANNER = isIos
  ? 'ca-app-pub-3940256099942544/2934735716'
  : 'ca-app-pub-3940256099942544/6300978111';
const TEST_APP_OPEN = isIos
  ? 'ca-app-pub-3940256099942544/5575463023'
  : 'ca-app-pub-3940256099942544/9257395921';
const TEST_REWARDED_INTERSTITIAL = isIos
  ? 'ca-app-pub-3940256099942544/6978759866'
  : 'ca-app-pub-3940256099942544/5354046379';

let PRODUCTION_ADS = import.meta.env.VITE_ADMOB_MODE === 'production';

function resolveAdUnitId(
  envKey: string,
  envVal: string | undefined,
  testFallback: string,
  name: string,
  optional = false,
): string {
  if (PRODUCTION_ADS) {
    if (envVal && envVal.trim().length > 0) {
      return envVal.trim();
    }
    if (isIos) {
      console.info(`[Reklam] iOS üretim derlemesinde ${envKey} henüz tanımlı değil; ${name} devre dışı (reklamsız mod).`);
      return '';
    }
    const log = optional ? console.warn : console.error;
    log(`[Reklam] ${optional ? 'UYARI' : 'KRİTİK HATA'}: VITE_ADMOB_MODE=production fakat ${envKey} tanımlı değil! Test ID'ye düşülmedi; ${name} yüklenmeyecek.`);
    return '';
  }
  return testFallback;
}

let REWARDED_ID = TEST_REWARDED;
let INTERSTITIAL_ID = TEST_INTERSTITIAL;
let BANNER_ID = TEST_BANNER;
let APP_OPEN_ID = TEST_APP_OPEN;
let REWARDED_INTERSTITIAL_ID = TEST_REWARDED_INTERSTITIAL;

function syncAdUnitIds(): void {
  REWARDED_ID = resolveAdUnitId(
    isIos ? 'VITE_IOS_ADMOB_REWARDED_ID' : 'VITE_ADMOB_REWARDED_ID',
    isIos
      ? (import.meta.env.VITE_IOS_ADMOB_REWARDED_ID || import.meta.env.VITE_ADMOB_IOS_REWARDED_ID)
      : import.meta.env.VITE_ADMOB_REWARDED_ID,
    TEST_REWARDED,
    'ödüllü reklam',
  );
  INTERSTITIAL_ID = resolveAdUnitId(
    isIos ? 'VITE_IOS_ADMOB_INTERSTITIAL_ID' : 'VITE_ADMOB_INTERSTITIAL_ID',
    isIos
      ? (import.meta.env.VITE_IOS_ADMOB_INTERSTITIAL_ID || import.meta.env.VITE_ADMOB_IOS_INTERSTITIAL_ID)
      : import.meta.env.VITE_ADMOB_INTERSTITIAL_ID,
    TEST_INTERSTITIAL,
    'geçiş reklamı',
    true,
  );
  BANNER_ID = resolveAdUnitId(
    isIos ? 'VITE_IOS_ADMOB_BANNER_ID' : 'VITE_ADMOB_BANNER_ID',
    isIos
      ? (import.meta.env.VITE_IOS_ADMOB_BANNER_ID || import.meta.env.VITE_ADMOB_IOS_BANNER_ID)
      : import.meta.env.VITE_ADMOB_BANNER_ID,
    TEST_BANNER,
    'banner reklamı',
    true,
  );
  APP_OPEN_ID = resolveAdUnitId(
    isIos ? 'VITE_IOS_ADMOB_APP_OPEN_ID' : 'VITE_ADMOB_APP_OPEN_ID',
    isIos
      ? (import.meta.env.VITE_IOS_ADMOB_APP_OPEN_ID || import.meta.env.VITE_ADMOB_IOS_APP_OPEN_ID)
      : import.meta.env.VITE_ADMOB_APP_OPEN_ID,
    TEST_APP_OPEN,
    'uygulama açılış reklamı',
    true,
  );
  REWARDED_INTERSTITIAL_ID = resolveAdUnitId(
    isIos ? 'VITE_IOS_ADMOB_REWARDED_INTERSTITIAL_ID' : 'VITE_ADMOB_REWARDED_INTERSTITIAL_ID',
    isIos
      ? (import.meta.env.VITE_IOS_ADMOB_REWARDED_INTERSTITIAL_ID || import.meta.env.VITE_ADMOB_IOS_REWARDED_INTERSTITIAL_ID)
      : import.meta.env.VITE_ADMOB_REWARDED_INTERSTITIAL_ID,
    TEST_REWARDED_INTERSTITIAL,
    'ödüllü geçiş reklamı',
    true,
  );
}

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
let secondaryAdsArmed = false;

interface FullscreenSlot {
  readonly label: string;
  readonly adUnit: () => string;
  readonly timeoutMs: number;
  readonly secondary: boolean;
  readonly missingError?: () => string;
  readonly recordError?: boolean;
  readonly onBecameReady?: () => void;
  readonly prepare: (adId: string) => Promise<unknown>;
  loaded: boolean;
  loading: boolean;
  failures: number;
  timer: ReturnType<typeof setTimeout> | null;
}

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

let bannerCreated = false;
let bannerVisible = false;
let bannerWanted = false;
let bannerHeightPx = 0;
let lastCssBannerHeight = -1;
let bannerSyncing = false;
let bannerSyncDirty = false;

function kisaHata(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err ?? 'bilinmeyen hata');
  return m.length > 64 ? m.slice(0, 61) + '…' : m;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function setBannerHeightCss(px: number): void {
  const clamped = Math.max(0, Math.round(px));
  if (clamped === lastCssBannerHeight) return;
  lastCssBannerHeight = clamped;
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--banner-h', `${clamped}px`);
  }
}

async function syncBanner(): Promise<void> {
  bannerSyncDirty = true;
  if (bannerSyncing) return;
  bannerSyncing = true;
  try {
    while (bannerSyncDirty) {
      bannerSyncDirty = false;
      const shouldShow =
        consentAllowsAds &&
        evre === 'calisiyor' &&
        secondaryAdsArmed &&
        Boolean(BANNER_ID) &&
        bannerWanted;
      if (shouldShow && !bannerVisible) {
        if (!bannerCreated) {
          bannerCreated = true;
          bannerVisible = true;
          await AdMob.showBanner({
            adId: BANNER_ID,
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: 0,
          });
          if (bannerVisible && bannerHeightPx > 0) {
            setBannerHeightCss(bannerHeightPx);
          }
        } else {
          bannerVisible = true;
          await AdMob.resumeBanner();
          setBannerHeightCss(bannerHeightPx);
        }
      } else if (!shouldShow && bannerVisible) {
        bannerVisible = false;
        setBannerHeightCss(0);
        if (bannerCreated) {
          try {
            await AdMob.hideBanner();
          } catch (err) {
            const msg = String(err ?? '');
            if (msg.includes('never shown')) bannerCreated = false;
            else throw err;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Reklam] Banner senkron hatası:', err);
    bannerVisible = false;
    setBannerHeightCss(0);
  } finally {
    bannerSyncing = false;
    if (bannerSyncDirty) void syncBanner();
  }
}

function emitRevenue(
  format: AdRevenueFormat,
  adUnit: string,
  data: { valueMicros?: number; currencyCode?: string; precision?: number } | null | undefined,
): void {
  const value = (data?.valueMicros ?? 0) / 1_000_000;
  analytics.trackAdRevenue(format, adUnit, value);
  bus.emit('ad:revenue', {
    value,
    currency: data?.currencyCode ?? 'USD',
    precision: data?.precision ?? 0,
    adUnit,
    format,
  });
}

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
      if (rewardedSlot.loaded) return tr("hazır");
      if (rewardedSlot.failures >= 4) return `hata: ${sonHata || tr("reklam yüklenemedi")}`;
      return tr("yükleniyor…");
  }
}

/* ── Yükleme döngüsü ─────────────────────────────────────────────── */

/**
 * Tek zamanlayıcılı `setTimeout` zinciri — `setInterval` YOK, yani hata
 * tavanına ulaşıldığında geride işleyen sayaç kalmaz. Her `scheduleSlot`
 * öncekini iptal eder; çifte planlama zararsızdır.
 */
const PRELOAD_TIMEOUT_MS = 10_000;

const rewardedSlot: FullscreenSlot = {
  label: 'Ödüllü reklam',
  adUnit: () => REWARDED_ID,
  timeoutMs: PRELOAD_TIMEOUT_MS,
  secondary: false,
  missingError: () => tr("Canlı ödüllü reklam ID tanımlı değil"),
  recordError: true,
  onBecameReady: () => bus.emit('ui:refresh', {}),
  prepare: (adId) => AdMob.prepareRewardVideoAd({ adId }),
  loaded: false,
  loading: false,
  failures: 0,
  timer: null,
};

const interstitialSlot: FullscreenSlot = {
  label: 'Geçiş reklamı',
  adUnit: () => INTERSTITIAL_ID,
  timeoutMs: 8000,
  secondary: true,
  prepare: (adId) => AdMob.prepareInterstitial({ adId }),
  loaded: false,
  loading: false,
  failures: 0,
  timer: null,
};

const rewardedInterstitialSlot: FullscreenSlot = {
  label: 'Ödüllü geçiş reklamı',
  adUnit: () => REWARDED_INTERSTITIAL_ID,
  timeoutMs: PRELOAD_TIMEOUT_MS,
  secondary: true,
  prepare: (adId) => AdMob.prepareRewardInterstitialAd({ adId }),
  loaded: false,
  loading: false,
  failures: 0,
  timer: null,
};

const appOpenSlot: FullscreenSlot = {
  label: 'Açılış reklamı',
  adUnit: () => APP_OPEN_ID,
  timeoutMs: PRELOAD_TIMEOUT_MS,
  secondary: true,
  prepare: (adId) => AdMob.loadAppOpen({ adId }),
  loaded: false,
  loading: false,
  failures: 0,
  timer: null,
};

function jitteredDelay(baseSeconds: number): number {
  const jitter = 0.85 + Math.random() * 0.3;
  return Math.max(1, Math.round(baseSeconds * jitter * 10) / 10);
}

function scheduleSlot(slot: FullscreenSlot, seconds: number): void {
  if (slot.timer !== null) clearTimeout(slot.timer);
  slot.timer = setTimeout(() => {
    slot.timer = null;
    void preloadSlot(slot);
  }, seconds * 1000);
}

async function preloadSlot(slot: FullscreenSlot): Promise<void> {
  if (evre !== 'calisiyor' || !consentAllowsAds) return;
  if (slot.secondary && !secondaryAdsArmed) return;
  const adId = slot.adUnit();
  if (!adId) {
    if (slot.missingError) sonHata = slot.missingError();
    return;
  }
  if (slot.loaded) {
    scheduleSlot(slot, WATCHDOG_SECONDS);
    return;
  }
  if (slot.loading) return;
  slot.loading = true;
  let loadTimeout: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      loadTimeout = setTimeout(
        () => reject(new Error(`${slot.label} yükleme zaman aşımı (${slot.timeoutMs / 1000}s)`)),
        slot.timeoutMs,
      );
    });
    await Promise.race([slot.prepare(adId), timeoutPromise]);
    const wasLoaded = slot.loaded;
    slot.loaded = true;
    slot.failures = 0;
    if (!wasLoaded) slot.onBecameReady?.();
    scheduleSlot(slot, WATCHDOG_SECONDS);
  } catch (err) {
    slot.failures++;
    if (slot.recordError) sonHata = kisaHata(err);
    console.warn(`[Reklam] ${slot.label} yüklenemedi (${slot.failures}):`, err);
    const baseDelay = slot.failures <= PRELOAD_BACKOFF.length
      ? PRELOAD_BACKOFF[slot.failures - 1]
      : RELAXED_RETRY_SECONDS;
    scheduleSlot(slot, jitteredDelay(baseDelay));
  } finally {
    if (loadTimeout !== null) clearTimeout(loadTimeout);
    slot.loading = false;
  }
}

/* ── Sağlayıcı ───────────────────────────────────────────────────── */

const admobProvider: AdProvider = {
  /** Yerleşim seçimi Game.getAdOffers'ta; burada tek soru "yuva dolu mu". */
  isReady(_placement) {
    return consentAllowsAds && rewardedSlot.loaded;
  },

  async show(_placement) {
    if (!consentAllowsAds || !rewardedSlot.loaded) return false;
    /**
     * YUVA GÖSTERİMDEN ÖNCE TÜKETİLİR. Bayrak gösterim sonrasında
     * temizlenseydi, gösterim sırasında düşen bir teklif çipi aynı reklamı
     * "hazır" sanmaya devam ederdi — hayalet teklif hatasının kökü buydu.
     */
    rewardedSlot.loaded = false;
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

      void AdMob.showRewardVideoAd().catch((err) => onFailed(err));
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
      scheduleSlot(rewardedSlot, 1);
    }
    return earned;
  },

  isInterstitialReady() {
    return consentAllowsAds && interstitialSlot.loaded;
  },

  /**
   * GEÇİŞ REKLAMI: Hazır değilse BEKLEMEZ, oyunu bölmemek için hemen atlar.
   * Oyun reklam kapanana kadar duraklı kalır; kapandığında bir sonraki
   * reklam arka planda otomatik yüklenir.
   */
  async showInterstitial() {
    if (!consentAllowsAds || !interstitialSlot.loaded) {
      console.info('[Reklam] Geçiş reklamı hazır değil, gösterim atlandı.');
      return;
    }
    interstitialSlot.loaded = false;
    let dismissSub: PluginListenerHandle | null = null;
    let failedSub: PluginListenerHandle | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      let onDismiss: () => void = () => {};
      let onFailed: (err: unknown) => void = () => {};
      const dismissPromise = new Promise<void>((resolve) => { onDismiss = resolve; });
      const failedPromise = new Promise<void>((_, reject) => { onFailed = reject; });
      const safetyPromise = new Promise<void>((_, reject) => {
        safetyTimer = setTimeout(
          () => reject(new Error(`Geçiş reklamı kapanma olayı gelmedi (${AD_DISMISS_SAFETY_MS / 1000}s)`)),
          AD_DISMISS_SAFETY_MS,
        );
      });

      dismissSub = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => onDismiss());
      failedSub = await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (err) => onFailed(err));

      void AdMob.showInterstitial().catch((err) => onFailed(err));
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
      scheduleSlot(interstitialSlot, 1);
    }
  },

  warmSecondaryAds() {
    if (secondaryAdsArmed) return;
    secondaryAdsArmed = true;
    if (evre === 'calisiyor' && consentAllowsAds) {
      scheduleSlot(rewardedInterstitialSlot, 0.2);
      scheduleSlot(interstitialSlot, 0.8);
      scheduleSlot(appOpenSlot, 2.0);
      void syncBanner();
    }
  },

  setBannerVisible(visible: boolean) {
    bannerWanted = visible;
    void syncBanner();
  },

  isRewardedInterstitialReady() {
    return consentAllowsAds && rewardedInterstitialSlot.loaded;
  },

  async showRewardedInterstitial() {
    if (!consentAllowsAds || !rewardedInterstitialSlot.loaded) {
      throw new Error('Ödüllü geçiş reklamı hazır değil');
    }
    rewardedInterstitialSlot.loaded = false;
    let earned = false;
    let rewardSub: PluginListenerHandle | null = null;
    let dismissSub: PluginListenerHandle | null = null;
    let failedSub: PluginListenerHandle | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      let onDismiss: () => void = () => {};
      let onFailed: (err: unknown) => void = () => {};
      const dismissPromise = new Promise<void>((resolve) => { onDismiss = resolve; });
      const failedPromise = new Promise<void>((_, reject) => { onFailed = reject; });
      const safetyPromise = new Promise<void>((_, reject) => {
        safetyTimer = setTimeout(
          () => reject(new Error(`Ödüllü geçiş kapanma olayı gelmedi (${AD_DISMISS_SAFETY_MS / 1000}s)`)),
          AD_DISMISS_SAFETY_MS,
        );
      });

      rewardSub = await AdMob.addListener(RewardInterstitialAdPluginEvents.Rewarded, () => {
        earned = true;
      });
      dismissSub = await AdMob.addListener(RewardInterstitialAdPluginEvents.Dismissed, () => onDismiss());
      failedSub = await AdMob.addListener(RewardInterstitialAdPluginEvents.FailedToShow, (err) => onFailed(err));

      void AdMob.showRewardInterstitialAd().catch((err) => onFailed(err));
      await Promise.race([dismissPromise, failedPromise, safetyPromise]);
      return earned;
    } finally {
      if (safetyTimer !== null) clearTimeout(safetyTimer);
      if (rewardSub) {
        try { await rewardSub.remove(); } catch {}
      }
      if (dismissSub) {
        try { await dismissSub.remove(); } catch {}
      }
      if (failedSub) {
        try { await failedSub.remove(); } catch {}
      }
      scheduleSlot(rewardedInterstitialSlot, 1);
    }
  },

  isAppOpenReady() {
    return consentAllowsAds && appOpenSlot.loaded;
  },

  async showAppOpen() {
    if (!consentAllowsAds || !appOpenSlot.loaded) return false;
    appOpenSlot.loaded = false;
    let closedSub: PluginListenerHandle | null = null;
    let failedSub: PluginListenerHandle | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      let onClosed: () => void = () => {};
      let onFailed: (err: unknown) => void = () => {};
      const closedPromise = new Promise<void>((resolve) => { onClosed = resolve; });
      const failedPromise = new Promise<void>((_, reject) => { onFailed = reject; });
      const safetyPromise = new Promise<void>((_, reject) => {
        safetyTimer = setTimeout(
          () => reject(new Error(`Açılış reklamı kapanma olayı gelmedi (${AD_DISMISS_SAFETY_MS / 1000}s)`)),
          AD_DISMISS_SAFETY_MS,
        );
      });

      closedSub = await AdMob.addListener(AppOpenAdPluginEvents.Closed, () => onClosed());
      failedSub = await AdMob.addListener(AppOpenAdPluginEvents.FailedToShow, (err) => onFailed(err));

      void AdMob.showAppOpen().catch((err) => onFailed(err));
      await Promise.race([closedPromise, failedPromise, safetyPromise]);
      return true;
    } catch (err) {
      console.warn('[Reklam] Açılış reklamı gösterilemedi:', err);
      return false;
    } finally {
      if (safetyTimer !== null) clearTimeout(safetyTimer);
      if (closedSub) {
        try { await closedSub.remove(); } catch {}
      }
      if (failedSub) {
        try { await failedSub.remove(); } catch {}
      }
      scheduleSlot(appOpenSlot, 2);
    }
  },
};

/* ── Rıza (UMP / GDPR) ───────────────────────────────────────────── */

/**
 * Google UMP formunun zorunlu olduğu saat dilimleri: AB, İngiltere, İsviçre.
 * Türkiye (`Europe/Istanbul`) bu listede yoktur. Form hiç yayınlanmamışsa
 * UMP bölgeyi söyleyemez; o durumda liste dışındaki cihaz reklam ister.
 */
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
  analytics.setConsent(allowed, true);
  if (!allowed) {
    void syncBanner();
    return; // kapılar (isReady/show/preload) gerisini halleder
  }
  if (evre === 'riza_bekliyor') {
    void startSdk();
  } else if (evre === 'calisiyor') {
    scheduleSlot(rewardedSlot, 0.2);
    if (secondaryAdsArmed) {
      scheduleSlot(rewardedInterstitialSlot, 0.4);
      scheduleSlot(interstitialSlot, 0.8);
      scheduleSlot(appOpenSlot, 1.5);
      void syncBanner();
    }
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

  // Debug / önizleme (.preview) APK'larında geliştirici cihazında canlı AdMob
  // gösterimi geçersiz trafik riski doğurur; yalnızca yayın paketinde canlı kalır.
  if (PRODUCTION_ADS && (await isPreviewBuild())) {
    PRODUCTION_ADS = false;
    console.info('[Reklam] Önizleme (.preview) paketi algılandı; Google test reklam birimleri etkin.');
  }
  syncAdUnitIds();

  // Üretim derlemesinde henüz canlı reklam birimleri girilmemişse (ör. ilk App Store
  // incelemesi), ATT kontrolünden sonra SDK ve UMP başlatılmaz; oyun %100 reklamsız çalışır.
  if (
    PRODUCTION_ADS &&
    !REWARDED_ID &&
    !INTERSTITIAL_ID &&
    !BANNER_ID &&
    !APP_OPEN_ID &&
    !REWARDED_INTERSTITIAL_ID
  ) {
    evre = 'riza_bekliyor';
    return;
  }

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

  setPrivacyOptionsHandler(async () => {
    await AdMob.showPrivacyOptionsForm();
    const info = await AdMob.requestConsentInfo();
    applyConsent(info.canRequestAds);
  });

  let allowed = false;
  let consentResolved = false;
  try {
    allowed = await runConsentFlow();
    consentResolved = true;
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
  analytics.setConsent(allowed, consentResolved);
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
    void preloadSlot(rewardedSlot);
    if (secondaryAdsArmed) {
      scheduleSlot(rewardedInterstitialSlot, 0.3);
      scheduleSlot(interstitialSlot, 0.8);
      scheduleSlot(appOpenSlot, 1.5);
      void syncBanner();
    }
    return;
  }
  listenersInstalled = true;

  // 4) Kemer-pantolon askısı: native taraf yükleme hatası bildirirse yuvayı
  // boşalt ve (zincir boştaysa) kısa süre sonra yeniden dene.
  try {
    await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (err) => {
      rewardedSlot.loaded = false;
      sonHata = kisaHata(err?.message ?? err);
      if (!rewardedSlot.loading && rewardedSlot.timer === null) scheduleSlot(rewardedSlot, 5);
    });
  } catch (err) {
    console.warn('[Reklam] Reward FailedToLoad dinleyicisi takılamadı:', err);
  }

  try {
    await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
      interstitialSlot.loaded = false;
      if (secondaryAdsArmed && !interstitialSlot.loading && interstitialSlot.timer === null) {
        scheduleSlot(interstitialSlot, 5);
      }
    });
  } catch (err) {
    console.warn('[Reklam] Interstitial FailedToLoad dinleyicisi takılamadı:', err);
  }

  try {
    await AdMob.addListener(RewardInterstitialAdPluginEvents.FailedToLoad, () => {
      rewardedInterstitialSlot.loaded = false;
      if (secondaryAdsArmed && !rewardedInterstitialSlot.loading && rewardedInterstitialSlot.timer === null) {
        scheduleSlot(rewardedInterstitialSlot, 5);
      }
    });
  } catch (err) {
    console.warn('[Reklam] RewardInterstitial FailedToLoad dinleyicisi takılamadı:', err);
  }

  try {
    await AdMob.addListener(AppOpenAdPluginEvents.FailedToLoad, () => {
      appOpenSlot.loaded = false;
      if (secondaryAdsArmed && !appOpenSlot.loading && appOpenSlot.timer === null) {
        scheduleSlot(appOpenSlot, 10);
      }
    });
  } catch (err) {
    console.warn('[Reklam] AppOpen FailedToLoad dinleyicisi takılamadı:', err);
  }

  try {
    await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info) => {
      const h = Math.max(0, Math.min(110, Math.round(info?.height ?? 0)));
      if (h > 0) bannerHeightPx = h;
      setBannerHeightCss(bannerVisible ? bannerHeightPx : 0);
    });
    await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
      bannerCreated = false;
      bannerVisible = false;
      bannerHeightPx = 0;
      setBannerHeightCss(0);
    });
  } catch (err) {
    console.warn('[Reklam] Banner dinleyicisi takılamadı:', err);
  }

  // 5) ILRD / Gelir telemetrisi (Paid Event / Impression-Level Revenue)
  try {
    await AdMob.addListener(RewardAdPluginEvents.AdImpression, (data) => {
      emitRevenue('rewarded', data?.adUnitId ?? REWARDED_ID, data);
    });
  } catch (err) {
    console.warn('[Reklam] Rewarded AdImpression dinleyicisi takılamadı:', err);
  }

  try {
    await AdMob.addListener(InterstitialAdPluginEvents.AdImpression, (data) => {
      emitRevenue('interstitial', data?.adUnitId ?? INTERSTITIAL_ID, data);
    });
  } catch (err) {
    console.warn('[Reklam] Interstitial AdImpression dinleyicisi takılamadı:', err);
  }

  try {
    await AdMob.addListener(RewardInterstitialAdPluginEvents.AdImpression, (data) => {
      emitRevenue('rewarded_interstitial', data?.adUnitId ?? REWARDED_INTERSTITIAL_ID, data);
    });
  } catch (err) {
    console.warn('[Reklam] RewardInterstitial AdImpression dinleyicisi takılamadı:', err);
  }

  try {
    await AdMob.addListener(AppOpenAdPluginEvents.AdImpression, (data) => {
      emitRevenue('app_open', data?.adUnitId ?? APP_OPEN_ID, data);
    });
  } catch (err) {
    console.warn('[Reklam] AppOpen AdImpression dinleyicisi takılamadı:', err);
  }

  try {
    await AdMob.addListener(BannerAdPluginEvents.AdPaid, (data) => {
      emitRevenue('banner', data?.adUnitId ?? BANNER_ID, data);
    });
  } catch (err) {
    console.warn('[Reklam] Banner AdPaid dinleyicisi takılamadı:', err);
  }

  // 6) Uygulama arka plandan döndüğünde boş yuvaları doldurmaya çalış
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && evre === 'calisiyor' && consentAllowsAds) {
        if (!rewardedSlot.loaded && !rewardedSlot.loading) {
          rewardedSlot.failures = 0;
          scheduleSlot(rewardedSlot, 1);
        }
        if (secondaryAdsArmed) {
          if (!rewardedInterstitialSlot.loaded && !rewardedInterstitialSlot.loading) {
            rewardedInterstitialSlot.failures = 0;
            scheduleSlot(rewardedInterstitialSlot, 1);
          }
          if (!interstitialSlot.loaded && !interstitialSlot.loading) {
            interstitialSlot.failures = 0;
            scheduleSlot(interstitialSlot, 1.5);
          }
          if (!appOpenSlot.loaded && !appOpenSlot.loading) {
            appOpenSlot.failures = 0;
            scheduleSlot(appOpenSlot, 2);
          }
        }
      }
    });
  }

  // 7) İlk yükleme: soğuk açılışta bant genişliği yalnızca REWARDED için
  // ayrılır; ikincil biçimler öğretici bittiğinde (warmSecondaryAds) açılır.
  if (consentAllowsAds) {
    void preloadSlot(rewardedSlot);
    if (secondaryAdsArmed) {
      scheduleSlot(rewardedInterstitialSlot, 0.3);
      scheduleSlot(interstitialSlot, 0.8);
      scheduleSlot(appOpenSlot, 2.0);
      void syncBanner();
    }
  }
}
