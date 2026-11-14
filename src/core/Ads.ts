import { tr } from "./I18n";
import { analytics } from "./Analytics";
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
   * ~300 saniyelik ölçülen gelire denk NAKİT (taban ₺1200).
   * İSTEK ANI: sıradaki pedin %60-90'ı ödenmişken — "az kaldı ama kasam
   * yetmiyor" ânı.
   */
  | 'cash_boost'
  /**
   * USTA MODU: süreli olarak "el ver" bonusu TÜM makinelerde + oyuncu
   * hızı ×1,25. İSTEK ANI: kasalarda toplam ≥4 müşteri beklerken.
   */
  | 'usta_mode'
  /**
   * MÜŞTERİ AKINI: süreli müşteri akışı ×1,6 + sabır ×1,2.
   * İSTEK ANI: raf doluluğu ≥ %70.
   */
  | 'rush_hour'
  /**
   * ARIZA SİGORTASI: aktif arıza anında tamir + süreli arıza bağışıklığı.
   */
  | 'repair_shield'
  /**
   * BAHŞİŞ YAĞMURU: süreli masa bahşişleri ×3.
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
  | 'free_upgrade'
  /**
   * SERİ KURTARMA (Streak Freeze): 1-2 gün ara verince kırılan günlük seriyi
   * ödüllü reklamla kaldığı yerden kurtarır (bkz. sim/Daily.ts).
   */
  | 'streak_freeze';

/* ================================================================ *
 *  2 · ÖDÜL BÜYÜKLÜKLERİ
 *
 *  Hepsi SÜRELİ ya da TEK SEFERLİK. Kalıcı güç veren tek bir ödül bile
 *  yok — bkz. yukarıdaki 2. şart.
 * ================================================================ */

/** Mutlu Saat: adım süresi (sn, 2 dakika), tavan (6 dakika) ve kazanç çarpanı. */
export const HAPPY_HOUR_SECONDS = 120;
export const HAPPY_HOUR_STEP_SECONDS = 120;
export const HAPPY_HOUR_MAX_SECONDS = 360;
export const HAPPY_HOUR_MULT = 2;

/**
 * Süpürge robotu: süre (sn, 2 dakika).
 */
export const ROBOT_SECONDS = 120;

/**
 * `zone_finish` teklifinin görüneceği EN DÜŞÜK ödeme oranı.
 */
export const ZONE_FINISH_MIN_PAID = 0.25;

/** Menü içi ücretsiz yükseltme (RV) bekleme süresi (sn). */
export const FREE_UPGRADE_COOLDOWN_SEC = 45;

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
 * görünür.
 */
export const CASH_BOOST_MIN_PAID = 0.35;
export const CASH_BOOST_MAX_PAID = 0.92;

/** Usta modu: süre (sn, 2 dakika), oyuncu hız çarpanı ve kuyruk eşiği (müşteri). */
export const USTA_SECONDS = 120;
export const USTA_SPEED_MULT = 1.25;
export const USTA_MIN_QUEUE = 3;

/** Müşteri akını: süre (sn, 2 dakika), akış ×, sabır × ve raf doluluk eşiği (0..1). */
export const RUSH_HOUR_SECONDS = 120;
export const RUSH_HOUR_SPAWN_MULT = 1.6;
export const RUSH_HOUR_PATIENCE_MULT = 1.2;
export const RUSH_HOUR_MIN_SHELF = 0.5;

/** Arıza sigortası: anında tamir + bu süre boyunca yeni arıza doğmaz (sn). */
export const REPAIR_SHIELD_SECONDS = 180;

/** Bahşiş yağmuru: süre (sn, 2 dakika) ve masa bahşişi çarpanı. */
export const TIP_RAIN_SECONDS = 120;
export const TIP_RAIN_MULT = 3;

/** Dönüş satışı: satılan stok payı (0..1) ve teklif eşiği (birim). */
export const COMEBACK_SHARE = 0.5;
export const COMEBACK_MIN_STOCK = 5;

/**
 * Dinamik Nakit Desteği (`cash_boost`): anlık gerçekleşen gelir geçici olarak
 * düşük olsa bile kafenin teorik kapasitesini (`estimatedIncomePerSec * 0.75`)
 * ve sıradaki pedin kalan borcunu dikkate alır — geç oyunda asla cimri hissettirmez.
 */
export function computeCashBoostAmount(
  realizedIncomePerSec: number,
  estimatedIncomePerSec = 0,
  nextTargetRemaining = 0,
): number {
  const effectiveRate = realizedIncomePerSec > 0
    ? Math.max(realizedIncomePerSec, Math.min(realizedIncomePerSec * 1.35, estimatedIncomePerSec * 0.3))
    : Math.max(0, estimatedIncomePerSec * 0.75);
  const byIncome = Math.round(effectiveRate * CASH_BOOST_INCOME_SECONDS);
  const byTarget = nextTargetRemaining > 0
    ? Math.min(Math.round(Math.max(effectiveRate * CASH_BOOST_INCOME_SECONDS * 1.6, CASH_BOOST_FLOOR)), Math.round(nextTargetRemaining * 0.35))
    : 0;
  return Math.max(CASH_BOOST_FLOOR, byIncome, byTarget);
}

/**
 * Dinamik VIP Yatırımcı Hibesi (`investor`): `computeCashBoostAmount` tabanının
 * 1,8× katı (veya aktif hedefin %50'sine kadar), geç oyunda gerçek sıçrama sağlar.
 */
export function computeInvestorOfferAmount(
  realizedIncomePerSec: number,
  estimatedIncomePerSec = 0,
  nextTargetRemaining = 0,
  multiplier = 1.8,
): number {
  const base = computeCashBoostAmount(realizedIncomePerSec, estimatedIncomePerSec, nextTargetRemaining);
  return Math.max(Math.round(CASH_BOOST_FLOOR * 1.5), Math.round(base * Math.max(1.2, multiplier)));
}

/**
 * Süreli reklam ödüllerini gerçek duvar saatine (wall-clock) göre düşürür.
 * Oyun açık da olsa, arka plana da atılsa, tamamen kapatılıp saatler sonra da
 * girilse geçen gerçek saniye düşülür; süresi dolan bufflar 0'a iner.
 */
export function decayAdBuffMap(
  buffs: Readonly<Record<string, number>> | undefined,
  elapsedSeconds: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!buffs) return out;
  const dt = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : 0;
  for (const [k, raw] of Object.entries(buffs)) {
    const val = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    const next = val - dt;
    out[k] = next > 0.05 ? next : 0;
  }
  return out;
}

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
  /** Soğuk açılış sonrası ikincil reklam biçimlerini (banner, mola, açılış) ısıtır. */
  warmSecondaryAds?(): void;
  /** Aktif oyun ekranındaki alt uyarlanabilir banner görünürlüğünü ayarlar. */
  setBannerVisible?(visible: boolean): void;
  /** Ödüllü geçiş reklamı (rewarded interstitial) hazır mı. */
  isRewardedInterstitialReady?(): boolean;
  /** Ödüllü geçiş reklamını gösterir; ödül hak edildiyse true döner. */
  showRewardedInterstitial?(): Promise<boolean>;
  /** Uygulama açılış reklamı (app open) hazır mı. */
  isAppOpenReady?(): boolean;
  /** Uygulama açılış reklamını gösterir; gösterildiyse true döner. */
  showAppOpen?(): Promise<boolean>;
}

/**
 * Varsayılan sağlayıcı: hiçbir reklam yok.
 */
const noAds: AdProvider = {
  isReady: () => false,
  show: async () => false,
};

let provider: AdProvider = noAds;
let privacyOptionsHandler: (() => Promise<void>) | null = null;
let secondaryWarmed = false;
let bannerDesired = false;

/** Mağaza derlemesinde SDK bağlandığında çağrılır. */
export function setAdProvider(p: AdProvider): void {
  provider = p;
  if (secondaryWarmed) {
    try { provider.warmSecondaryAds?.(); } catch {}
  }
  if (bannerDesired) {
    try { provider.setBannerVisible?.(interstitialEnabled); } catch {}
  }
}

/**
 * BİR REKLAM SAĞLAYICISI KURULU MU.
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

let statusSource: (() => string) | null = null;

/** Sağlayıcı modülü kendi durum üreticisini takar (bkz. AdMobProvider.adStatus). */
export function setAdStatusSource(fn: (() => string) | null): void {
  statusSource = fn;
}

/**
 * Reklam sağlayıcısının insan-okur durumu.
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
    analytics.trackRewardedShow(placement);
    const ok = await provider.show(placement);
    if (ok) {
      notifyRewardedWatched();
      analytics.trackRewardedWatched(placement);
    } else {
      analytics.trackRewardedFailed(placement);
    }
    return ok;
  } catch (err) {
    analytics.trackRewardedFailed(placement);
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
 *      (D1 ilk oturumlarda `INTERSTITIAL_D1_WARMUP` = 120 sn).
 *   5. İki reklam arası en az `INTERSTITIAL_MIN_GAP` saniye
 *      (D1 ilk günde `INTERSTITIAL_D1_MIN_GAP` = 120 sn).
 *   6. Oturum başına en fazla `INTERSTITIAL_SESSION_CAP` gösterim.
 *   7. İlk `INTERSTITIAL_GOAL_WARMUP` hedef tamamlanmadan gösterilmez
 *      (`goalsCompleted`, yani `state.goalIndex`).
 *   8. Sağlık puanı düşükse (`healthScore < INTERSTITIAL_MIN_HEALTH`)
 *      churn koruması devreye girer ve geçiş reklamı susturulur.
 * ================================================================ */

export const INTERSTITIAL_WARMUP = 45;
export const INTERSTITIAL_D1_WARMUP = 75;
export const INTERSTITIAL_MIN_GAP = 75;
export const INTERSTITIAL_D1_MIN_GAP = 90;
export const INTERSTITIAL_D1_SESSION_CAP = 8;
export const INTERSTITIAL_MIN_HEALTH = 35;
export const REWARDED_TO_INTERSTITIAL_GAP = 60;
export const INTERSTITIAL_SESSION_CAP = 12;
/** Bu kadar hedef bitmeden geçiş reklamı yok (`g03`). */
export const INTERSTITIAL_GOAL_WARMUP = 3;
export const BREAK_SKIP_COOLDOWN = 45;
export const APP_OPEN_MIN_GAP = 180;

let interstitialEnabled = true;
let sessionStart = Date.now();
let lastInterstitial = 0;
let lastRewardedWatched = 0;
let lastAppOpen = 0;
let lastBreakSkippedAt = 0;
let interstitialCount = 0;
let rewardedWatchedCount = 0;

export interface InterstitialSafetyContext {
  isPlayerIdle?: boolean;
  isPlayerHandsEmpty?: boolean;
  isTutorialDone?: boolean;
  hasActiveCrisis?: boolean;
  /** Tamamlanmış hedef sayısı (`state.goalIndex`). */
  goalsCompleted?: number;
  /** Kurulumdan bu yana geçen gün (`0` = D1 koruma modu). */
  ageDays?: number;
  /** Cihaz içi oyuncu sağlık puanı (0–100). `< 35` ise geçiş gösterilmez. */
  healthScore?: number;
  /** Raporlama etiketi (ör. `'zone_unlock'`, `'branch_switch'`). */
  placement?: string;
}

/** İkincil reklam biçimlerini (banner / geçiş / açılış) ısıtır. */
export function warmSecondaryAds(): void {
  secondaryWarmed = true;
  try {
    provider.warmSecondaryAds?.();
  } catch {}
}

/** Uyarlanabilir alt banner görünürlüğünü kontrol eder. */
export function setBannerVisible(visible: boolean): void {
  bannerDesired = visible;
  try {
    provider.setBannerVisible?.(visible && interstitialEnabled);
  } catch {}
}

/** Oyuncu 2.8 sn kahve molası kartında [Geç] seçtiğinde nezaket soğuması başlatır. */
export function notifyBreakPromptSkipped(): void {
  lastBreakSkippedAt = Date.now();
}

/** Oyuncu kendi rızasıyla ödüllü reklam izlediğinde geçiş reklamını erteler. */
export function notifyRewardedWatched(): void {
  lastRewardedWatched = Date.now();
  rewardedWatchedCount++;
}

export function sessionRewardedWatchedCount(): number {
  return rewardedWatchedCount;
}

/**
 * Geçiş reklamlarını açar/kapatır. "Reklamları Kaldır" satın alması
 * yapıldığında buradan KAPATILIR — tek anahtar.
 */
export function setInterstitialEnabled(on: boolean): void {
  interstitialEnabled = on;
  if (!on) {
    try {
      provider.setBannerVisible?.(false);
    } catch {}
  }
}

export function interstitialsOn(): boolean {
  return interstitialEnabled;
}

/** Oturum sayaçlarını sıfırlar (soğuk açılışta). */
export function resetAdSession(customStartMs?: number): void {
  sessionStart = customStartMs ?? Date.now();
  lastInterstitial = 0;
  lastRewardedWatched = 0;
  lastAppOpen = 0;
  lastBreakSkippedAt = 0;
  interstitialCount = 0;
  rewardedWatchedCount = 0;
}

function passesSharedBreakRules(ctx?: InterstitialSafetyContext): boolean {
  if (!interstitialEnabled) return false;

  const isDayOne = ctx?.ageDays === 0;
  if (ctx) {
    if (ctx.isTutorialDone === false) return false;
    if (ctx.isPlayerHandsEmpty === false) return false;
    if (ctx.isPlayerIdle === false) return false;
    if (ctx.hasActiveCrisis === true) return false;
    if (ctx.goalsCompleted !== undefined && ctx.goalsCompleted < INTERSTITIAL_GOAL_WARMUP) return false;
    if (ctx.healthScore !== undefined && ctx.healthScore < INTERSTITIAL_MIN_HEALTH) return false;
  }

  const now = Date.now();
  const warmupSec = isDayOne ? INTERSTITIAL_D1_WARMUP : INTERSTITIAL_WARMUP;
  const minGapSec = isDayOne ? INTERSTITIAL_D1_MIN_GAP : INTERSTITIAL_MIN_GAP;
  const sessionCap = isDayOne ? INTERSTITIAL_D1_SESSION_CAP : INTERSTITIAL_SESSION_CAP;

  if (now - sessionStart < warmupSec * 1000) return false;
  if (lastInterstitial > 0 && now - lastInterstitial < minGapSec * 1000) return false;
  if (lastBreakSkippedAt > 0 && now - lastBreakSkippedAt < BREAK_SKIP_COOLDOWN * 1000) return false;
  if (lastRewardedWatched > 0 && now - lastRewardedWatched < REWARDED_TO_INTERSTITIAL_GAP * 1000) return false;
  if (interstitialCount >= sessionCap) return false;

  return true;
}

/**
 * Geçiş reklamının şu an gösterilip gösterilemeyeceğini denetler.
 */
export function canShowInterstitial(ctx?: InterstitialSafetyContext): boolean {
  if (!provider.showInterstitial) return false;
  if (provider.isInterstitialReady && !provider.isInterstitialReady()) return false;
  return passesSharedBreakRules(ctx);
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
      analytics.trackInterstitialShow(ctx?.placement ?? (ctx ? 'safe_context' : 'interval'));
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

/** Ödüllü geçiş reklamının (rewarded interstitial) şu an gösterilip gösterilemeyeceğini denetler. */
export function canShowRewardedInterstitial(ctx?: InterstitialSafetyContext): boolean {
  if (!provider.showRewardedInterstitial) return false;
  if (provider.isRewardedInterstitialReady && !provider.isRewardedInterstitialReady()) return false;
  return passesSharedBreakRules(ctx);
}

/** Doğal aradan sonra ödüllü geçiş reklamını gösterir. */
export async function tryRewardedInterstitial(
  ctx?: InterstitialSafetyContext,
): Promise<{ shown: boolean; rewarded: boolean }> {
  if (!canShowRewardedInterstitial(ctx)) return { shown: false, rewarded: false };

  try {
    if (!provider.showRewardedInterstitial) return { shown: false, rewarded: false };
    const rewarded = await provider.showRewardedInterstitial();
    const placement = ctx?.placement ?? 'natural_break';
    analytics.trackRewardedInterstitialShow(placement, rewarded);
    lastInterstitial = Date.now();
    interstitialCount++;
    return { shown: true, rewarded };
  } catch (err) {
    console.warn('[Reklam] Ödüllü geçiş reklamı gösterilemedi:', err);
    return { shown: false, rewarded: false };
  }
}

/** Arka plandan dönüşte App Open reklamı gösterilebilir mi denetler. */
export function canShowAppOpen(ctx?: InterstitialSafetyContext): boolean {
  if (!interstitialEnabled) return false;
  if (!provider.showAppOpen) return false;
  if (provider.isAppOpenReady && !provider.isAppOpenReady()) return false;
  if (ctx?.isTutorialDone === false) return false;
  if (ctx?.hasActiveCrisis === true) return false;
  if (ctx?.healthScore !== undefined && ctx.healthScore < INTERSTITIAL_MIN_HEALTH) return false;

  const now = Date.now();
  if (now - sessionStart < 45_000) return false;
  if (lastAppOpen > 0 && now - lastAppOpen < APP_OPEN_MIN_GAP * 1000) return false;
  if (lastRewardedWatched > 0 && now - lastRewardedWatched < REWARDED_TO_INTERSTITIAL_GAP * 1000) return false;
  if (lastInterstitial > 0 && now - lastInterstitial < 60_000) return false;

  return true;
}

/** Arka plandan ön plana dönüşte App Open reklamını gösterir. */
export async function tryAppOpen(ctx?: InterstitialSafetyContext): Promise<boolean> {
  if (!canShowAppOpen(ctx)) return false;

  try {
    if (!provider.showAppOpen) return false;
    const shown = await provider.showAppOpen();
    if (!shown) return false;
    lastAppOpen = Date.now();
    analytics.trackAppOpenShow(ctx?.placement ?? 'app_resume');
    return true;
  } catch (err) {
    console.warn('[Reklam] Açılış reklamı gösterilemedi:', err);
    return false;
  }
}
