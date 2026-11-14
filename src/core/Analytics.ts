import { APP_VERSION } from './version';
import type { AdRevenueFormat } from './EventBus';
import {
  hasNativeFirebaseAnalytics,
  isNative,
  nativeAnalyticsLogEvent,
  nativeAnalyticsSetConsent,
  nativeAnalyticsSetUserProperty,
} from './Native';

const WEB_CONSENT_KEY = 'fincan-sokagi:metrics-sharing:v1';
const UMP_CONSENT_KEY = 'fincan-sokagi:ump-consent:v1';

/** Max foreground duration credited to a single game session (45 min, matching keep-screen-on cap). */
export const MAX_FIREBASE_SESSION_SECONDS = 45 * 60;
/** Accidental instant closes below 3s are ignored to keep averages clean. */
export const MIN_FIREBASE_SESSION_SECONDS = 3;
const MAX_QUEUED_EVENTS = 24;

type ParamValue = string | number | boolean;
export type AnalyticsParams = Record<string, ParamValue | undefined | null>;
export type SanitizedAnalyticsParams = Record<string, string | number>;

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

/** Returns true if the device timezone falls in EEA, UK, or Switzerland (GDPR/UMP region). */
export function deviceInEuConsentRegion(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    return EU_CONSENT_TIMEZONES.has(tz);
  } catch {
    return false;
  }
}

const RESERVED_EVENT_RENAMES: Readonly<Record<string, string>> = {
  session_start: 'game_session_start',
  first_open: 'game_first_open',
  user_engagement: 'game_engagement',
};

/**
 * Sanitizes event names to satisfy GA4 / Firebase Analytics limits:
 * ASCII letters/digits/underscores, starts with a letter, avoids reserved prefixes, <= 40 chars.
 */
export function sanitizeFirebaseEventName(raw: string): string {
  const mapped = RESERVED_EVENT_RENAMES[raw] ?? raw;
  let clean = mapped.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!clean) clean = 'game_event';
  if (!/^[a-zA-Z]/.test(clean) || /^(firebase_|google_|ga_)/i.test(clean)) {
    clean = `g_${clean}`;
  }
  return clean.slice(0, 40);
}

/**
 * Sanitizes GA4 / Firebase Analytics parameters:
 * booleans -> 1|0, finite numbers (6 decimals for `value`), strings <= 100 chars, <= 25 entries.
 */
export function sanitizeFirebaseParams(params?: AnalyticsParams): SanitizedAnalyticsParams {
  const clean: SanitizedAnalyticsParams = {};
  if (!params) return clean;
  let count = 0;
  for (const [rawKey, val] of Object.entries(params)) {
    if (count >= 25 || val === undefined || val === null) continue;
    let key = rawKey.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    if (!key || !/^[a-zA-Z]/.test(key)) continue;
    if (typeof val === 'boolean') {
      clean[key] = val ? 1 : 0;
      count++;
    } else if (typeof val === 'number') {
      if (!Number.isFinite(val)) continue;
      clean[key] =
        key === 'value'
          ? Math.round(val * 1_000_000) / 1_000_000
          : Math.round(val * 100) / 100;
      count++;
    } else if (typeof val === 'string') {
      clean[key] = val.slice(0, 100);
      count++;
    }
  }
  return clean;
}

export function computeDayCohort(ageDays: number): 'day_0' | 'day_1_3' | 'day_4_7' | 'day_8_plus' {
  const d = Math.max(0, Math.floor(ageDays));
  if (d <= 0) return 'day_0';
  if (d <= 3) return 'day_1_3';
  if (d <= 7) return 'day_4_7';
  return 'day_8_plus';
}

function readStorage(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {}
}

type QueuedItem =
  | { kind: 'event'; name: string; params: SanitizedAnalyticsParams }
  | { kind: 'prop'; name: string; value: string | null };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export class AnalyticsService {
  private initialized = false;
  private nativeReady = false;
  private webGtagReady = false;
  private consentDecision: boolean | null = null;
  private analyticsCollectionAllowed = false;
  private measurementId = '';
  private queue: QueuedItem[] = [];
  private lastUserProps: Record<string, string> = {};

  get isActive(): boolean {
    return this.initialized && this.analyticsCollectionAllowed && (this.nativeReady || this.webGtagReady);
  }

  /**
   * Initializes Firebase Analytics.
   * - Native Android: activates `FirebaseAnalyticsBridge` with GDPR-safe consent rules
   *   (anonymous first-party measurement active offline outside EU; EU waits for UMP consent).
   * - Web: strictly opt-in via `fincan-sokagi:metrics-sharing:v1 === 'yes'` or explicit `setConsent(true)`.
   */
  init(measurementId?: string, _legacySecret?: string): void {
    if (measurementId && measurementId.trim()) {
      this.measurementId = measurementId.trim();
    } else if (!this.measurementId) {
      this.measurementId = (import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID ?? '').trim();
    }

    if (this.initialized) return;
    if (typeof window === 'undefined' && !hasNativeFirebaseAnalytics()) return;

    this.initialized = true;

    if (hasNativeFirebaseAnalytics()) {
      const storedUmp = readStorage(UMP_CONSENT_KEY);
      if (storedUmp === 'yes') this.consentDecision = true;
      else if (storedUmp === 'no') this.consentDecision = false;

      this.nativeReady = true;
      this.applyNativeConsentState();
      return;
    }

    // Privacy gate: web builds NEVER load or transmit external analytics before explicit opt-in.
    if (this.consentDecision === null && readStorage(WEB_CONSENT_KEY) === 'yes') {
      this.consentDecision = true;
    }
    if (this.consentDecision === true) {
      this.analyticsCollectionAllowed = true;
      this.bootWebGtag();
    } else {
      this.analyticsCollectionAllowed = false;
    }
  }

  /**
   * Updates privacy consent.
   * `explicitChoice = true` indicates a resolved UMP/UI consent decision (persisted across boots).
   * `explicitChoice = false` indicates a fallback/transient state (e.g. offline UMP timeout):
   * outside EEA/UK/CH, anonymous aggregate analytics keeps running while ad personalization stays off.
   */
  setConsent(allowed: boolean, explicitChoice = true): void {
    if (!hasNativeFirebaseAnalytics()) {
      this.consentDecision = allowed;
      this.analyticsCollectionAllowed = allowed;
      if (!allowed) {
        this.queue = [];
        return;
      }
      if (!this.initialized) {
        this.init(this.measurementId);
      } else if (this.measurementId && !this.webGtagReady) {
        this.bootWebGtag();
      }
      this.flushQueue();
      return;
    }

    if (explicitChoice) {
      this.consentDecision = allowed;
      writeStorage(UMP_CONSENT_KEY, allowed ? 'yes' : 'no');
    } else if (!allowed && this.consentDecision === null) {
      // Transient UMP lookup failure before any refusal: leave consentDecision null.
      this.analyticsCollectionAllowed = !deviceInEuConsentRegion();
    }

    if (!this.initialized) {
      this.init(this.measurementId);
      return;
    }
    this.applyNativeConsentState();
  }

  private applyNativeConsentState(): void {
    if (!this.nativeReady) return;
    if (this.consentDecision === false) {
      this.analyticsCollectionAllowed = false;
      this.queue = [];
      nativeAnalyticsSetConsent({
        analyticsStorage: false,
        adStorage: false,
        adUserData: false,
        adPersonalization: false,
        enabled: false,
      });
      return;
    }

    if (this.consentDecision === true) {
      this.analyticsCollectionAllowed = true;
      nativeAnalyticsSetConsent({
        analyticsStorage: true,
        adStorage: true,
        adUserData: true,
        adPersonalization: true,
        enabled: true,
      });
      this.flushQueue();
      return;
    }

    // Undecided UMP state: EU/UK/CH waits for UMP; rest of world keeps first-party session/DAU telemetry active offline.
    const allowAggregate = !deviceInEuConsentRegion();
    this.analyticsCollectionAllowed = allowAggregate;
    nativeAnalyticsSetConsent({
      analyticsStorage: allowAggregate,
      adStorage: false,
      adUserData: false,
      adPersonalization: false,
      enabled: allowAggregate,
    });
    if (allowAggregate) {
      this.flushQueue();
    }
  }

  private bootWebGtag(): void {
    if (this.webGtagReady || !this.measurementId || typeof document === 'undefined') return;
    try {
      window.dataLayer = window.dataLayer || [];
      if (typeof window.gtag !== 'function') {
        window.gtag = function gtag(...args: unknown[]) {
          window.dataLayer!.push(args);
        };
      }
      window.gtag('js', new Date());
      window.gtag('config', this.measurementId, {
        anonymize_ip: true,
        send_page_view: false,
      });
      if (typeof document.createElement === 'function' && document.head?.appendChild) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(this.measurementId)}`;
        document.head.appendChild(script);
      }
      this.webGtagReady = true;
      this.flushQueue();
    } catch {
      this.webGtagReady = false;
    }
  }

  private canBufferForPendingConsent(): boolean {
    return (
      hasNativeFirebaseAnalytics() &&
      this.consentDecision === null &&
      deviceInEuConsentRegion() &&
      this.queue.length < MAX_QUEUED_EVENTS
    );
  }

  private enqueue(item: QueuedItem): void {
    if (this.queue.length >= MAX_QUEUED_EVENTS) return;
    this.queue.push(item);
  }

  private flushQueue(): void {
    if (!this.isActive || this.queue.length === 0) return;
    const pending = this.queue.splice(0, this.queue.length);
    for (const item of pending) {
      if (item.kind === 'prop') {
        this.dispatchUserProperty(item.name, item.value);
      } else {
        this.dispatchEvent(item.name, item.params);
      }
    }
  }

  private dispatchEvent(name: string, params: SanitizedAnalyticsParams): void {
    if (this.nativeReady) {
      nativeAnalyticsLogEvent(name, params);
    } else if (this.webGtagReady && typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
  }

  private dispatchUserProperty(name: string, value: string | null): void {
    if (this.nativeReady) {
      nativeAnalyticsSetUserProperty(name, value);
    } else if (this.webGtagReady && typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('set', 'user_properties', { [name]: value });
    }
  }

  setUserProperty(name: string, value: string | null): void {
    const cleanName = name.replace(/[^a-zA-Z0-9_]+/g, '_').slice(0, 24);
    if (!cleanName) return;
    const cleanValue = value === null ? null : String(value).slice(0, 36);
    if (cleanValue !== null && this.lastUserProps[cleanName] === cleanValue) return;
    if (cleanValue === null) delete this.lastUserProps[cleanName];
    else this.lastUserProps[cleanName] = cleanValue;

    if (this.isActive) {
      this.dispatchUserProperty(cleanName, cleanValue);
    } else if (this.canBufferForPendingConsent()) {
      this.enqueue({ kind: 'prop', name: cleanName, value: cleanValue });
    }
  }

  trackEvent(rawName: string, params?: AnalyticsParams): void {
    const name = sanitizeFirebaseEventName(rawName);
    const cleanParams = sanitizeFirebaseParams(params);
    if (this.isActive) {
      this.dispatchEvent(name, cleanParams);
    } else if (this.canBufferForPendingConsent()) {
      this.enqueue({ kind: 'event', name, params: cleanParams });
    }
  }

  syncPlayerSegments(info: { language: string; branch: string; ageDays: number }): void {
    this.setUserProperty('app_language', info.language);
    this.setUserProperty('current_branch', info.branch);
    this.setUserProperty('day_cohort', computeDayCohort(info.ageDays));
    this.setUserProperty('app_build', APP_VERSION);
  }

  trackSessionStart(location: string, resumed: boolean): void {
    this.trackEvent('game_session_start', { location, resumed });
  }

  trackSessionEnd(
    durationSec: number,
    playSeconds: number,
    location: string,
    recovered = false,
    served = 0,
    orders = 0,
  ): void {
    if (!Number.isFinite(durationSec)) return;
    const rounded = Math.round(durationSec);
    if (rounded < MIN_FIREBASE_SESSION_SECONDS) return;
    const capped = Math.min(rounded, MAX_FIREBASE_SESSION_SECONDS);
    this.trackEvent(recovered ? 'game_session_recovered' : 'game_session_end', {
      duration_sec: rounded,
      capped_duration_sec: capped,
      play_seconds: Math.max(0, Math.round(playSeconds)),
      location,
      served: Math.max(0, Math.round(served)),
      orders: Math.max(0, Math.round(orders)),
    });
  }

  trackActiveDay(day: string, ageDays: number): void {
    this.trackEvent('active_day', { day, age_days: Math.max(0, Math.floor(ageDays)) });
  }

  trackRewardedShow(placement: string): void {
    this.trackEvent('ad_rewarded_show', { ad_platform: 'admob', placement });
  }

  trackRewardedWatched(placement: string): void {
    this.trackEvent('ad_rewarded_complete', { ad_platform: 'admob', placement });
  }

  trackRewardedFailed(placement: string): void {
    this.trackEvent('ad_rewarded_failed', { ad_platform: 'admob', placement });
  }

  trackInterstitialShow(placement = 'interval'): void {
    this.trackEvent('ad_interstitial_show', { ad_platform: 'admob', placement });
  }

  trackAppOpenShow(placement = 'app_resume'): void {
    this.trackEvent('ad_app_open_show', { ad_platform: 'admob', placement });
  }

  trackRewardedInterstitialShow(placement = 'natural_break', rewarded = false): void {
    this.trackEvent('ad_rewarded_interstitial_show', {
      ad_platform: 'admob',
      placement,
      rewarded,
    });
  }

  trackAdRevenue(format: AdRevenueFormat, adUnit: string, valueUsd: number): void {
    if (!Number.isFinite(valueUsd) || valueUsd <= 0) return;
    this.trackEvent('ad_impression', {
      ad_platform: 'admob',
      ad_source: 'admob',
      ad_format: format,
      ad_unit_name: adUnit,
      currency: 'USD',
      value: Math.round(valueUsd * 1_000_000) / 1_000_000,
    });
  }

  trackProgression(status: 'Start' | 'Complete', location: string, zone: string, score?: number): void {
    this.trackEvent('zone_progression', {
      status: status.toLowerCase(),
      location,
      zone,
      ...(typeof score === 'number' && Number.isFinite(score) ? { score } : {}),
    });
  }

  trackDesignEvent(eventId: string, value?: number): void {
    this.trackEvent(eventId, typeof value === 'number' && Number.isFinite(value) ? { value } : undefined);
  }
}

export const analytics = new AnalyticsService();
