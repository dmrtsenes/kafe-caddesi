import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Capacitor } from '@capacitor/core';
import { setFirebaseAnalyticsBridgeForTest } from './Native';
import {
  AnalyticsService,
  computeDayCohort,
  deviceInEuConsentRegion,
  MAX_FIREBASE_SESSION_SECONDS,
  sanitizeFirebaseEventName,
  sanitizeFirebaseParams,
} from './Analytics';

describe('Firebase Analytics Sanitization & Segmentation', () => {
  it('maps reserved names, cleans invalid characters, and enforces 40-char limit', () => {
    assert.equal(sanitizeFirebaseEventName('session_start'), 'game_session_start');
    assert.equal(sanitizeFirebaseEventName('first_open'), 'game_first_open');
    assert.equal(sanitizeFirebaseEventName('user_engagement'), 'game_engagement');
    assert.equal(sanitizeFirebaseEventName('ad:ilrd:rewarded'), 'ad_ilrd_rewarded');
    assert.equal(sanitizeFirebaseEventName('firebase_custom'), 'g_firebase_custom');
    assert.equal(sanitizeFirebaseEventName('123_step'), 'g_123_step');
    const longName = sanitizeFirebaseEventName('a'.repeat(60));
    assert.equal(longName.length, 40);
  });

  it('sanitizes parameter types, precision, NaN values, string caps, and key count', () => {
    const clean = sanitizeFirebaseParams({
      resumed: true,
      skipped: false,
      value: 0.012345678,
      duration_sec: 42.126,
      bad: Number.NaN,
      inf: Number.POSITIVE_INFINITY,
      empty: undefined,
      note: 'x'.repeat(150),
    });
    assert.equal(clean.resumed, 1);
    assert.equal(clean.skipped, 0);
    assert.equal(clean.value, 0.012346);
    assert.equal(clean.duration_sec, 42.13);
    assert.equal('bad' in clean, false);
    assert.equal('inf' in clean, false);
    assert.equal('empty' in clean, false);
    assert.equal(String(clean.note).length, 100);

    const many: Record<string, number> = {};
    for (let i = 0; i < 35; i++) many[`k_${i}`] = i;
    assert.equal(Object.keys(sanitizeFirebaseParams(many)).length, 25);
  });

  it('maps install age days to stable retention cohorts', () => {
    assert.equal(computeDayCohort(0), 'day_0');
    assert.equal(computeDayCohort(1), 'day_1_3');
    assert.equal(computeDayCohort(3), 'day_1_3');
    assert.equal(computeDayCohort(4), 'day_4_7');
    assert.equal(computeDayCohort(7), 'day_4_7');
    assert.equal(computeDayCohort(8), 'day_8_plus');
  });
});

describe('Firebase Analytics Consent Gate & Session Duration Capping', () => {
  it('stays inactive on web without consent and activates after opt-in when measurementId exists', () => {
    const origWindow = (globalThis as any).window;
    const origDoc = (globalThis as any).document;
    const origStorage = (globalThis as any).localStorage;
    const calls: unknown[][] = [];
    (globalThis as any).window = { dataLayer: [], gtag: (...a: unknown[]) => calls.push(a) };
    (globalThis as any).document = { head: {} };
    (globalThis as any).localStorage = { getItem: () => null, setItem: () => {} };
    const svc = new AnalyticsService();
    try {
      svc.setConsent(false);
      svc.init('G-TEST123456');
      assert.equal(svc.isActive, false);
      svc.trackSessionEnd(120, 120, 'kose');
      assert.equal(calls.length, 0);

      svc.setConsent(true);
      assert.equal(svc.isActive, true);
      svc.trackSessionEnd(2, 2, 'kose');
      assert.equal(calls.some((c) => c[0] === 'event' && c[1] === 'game_session_end'), false);

      svc.trackSessionEnd(3600, 3500, 'sahil', false, 15, 20);
      const ev = calls.find((c) => c[0] === 'event' && c[1] === 'game_session_end');
      assert.ok(ev);
      assert.equal((ev![2] as Record<string, number>).duration_sec, 3600);
      assert.equal((ev![2] as Record<string, number>).capped_duration_sec, MAX_FIREBASE_SESSION_SECONDS);
    } finally {
      svc.setConsent(false);
      (globalThis as any).window = origWindow;
      (globalThis as any).document = origDoc;
      (globalThis as any).localStorage = origStorage;
    }
  });

  it('enables aggregate analytics offline outside EU and gates EU undecided users until UMP consent', async () => {
    const origIsNative = Capacitor.isNativePlatform;
    const origGetPlatform = Capacitor.getPlatform;
    const origStorage = (globalThis as any).localStorage;
    const origIntl = Intl.DateTimeFormat;
    const nativeCalls: Array<{ fn: string; arg: any }> = [];

    (Capacitor as any).isNativePlatform = () => true;
    (Capacitor as any).getPlatform = () => 'android';
    setFirebaseAnalyticsBridgeForTest({
      async setConsent(opts: unknown) {
        nativeCalls.push({ fn: 'setConsent', arg: opts });
      },
      async logEvent(opts: unknown) {
        nativeCalls.push({ fn: 'logEvent', arg: opts });
      },
      async setUserProperty(opts: unknown) {
        nativeCalls.push({ fn: 'setUserProperty', arg: opts });
      },
    });
    const mem = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
    };

    try {
      // Simulate non-EU timezone (Istanbul): undecided offline should still collect anonymous analytics
      (Intl as any).DateTimeFormat = function () {
        return { resolvedOptions: () => ({ timeZone: 'Europe/Istanbul' }) };
      };
      assert.equal(deviceInEuConsentRegion(), false);

      const nonEuSvc = new AnalyticsService();
      nonEuSvc.init();
      assert.equal(nonEuSvc.isActive, true);
      const lastConsent = [...nativeCalls].reverse().find((c) => c.fn === 'setConsent');
      assert.equal(lastConsent?.arg.analyticsStorage, true);
      assert.equal(lastConsent?.arg.adPersonalization, false);

      // Simulate EU timezone with undecided UMP -> queued until consent granted
      (Intl as any).DateTimeFormat = function () {
        return { resolvedOptions: () => ({ timeZone: 'Europe/Berlin' }) };
      };
      assert.equal(deviceInEuConsentRegion(), true);
      const euSvc = new AnalyticsService();
      euSvc.init();
      assert.equal(euSvc.isActive, false);
      euSvc.trackAdRevenue('rewarded', 'unit-queued', 0.0025);
      assert.equal(nativeCalls.some((c) => c.fn === 'logEvent' && c.arg.params?.ad_unit_name === 'unit-queued'), false);

      // Explicit UMP grant -> enables full analytics and flushes queued events
      euSvc.setConsent(true, true);
      assert.equal(euSvc.isActive, true);
      const queuedFlushed = nativeCalls.find((c) => c.fn === 'logEvent' && c.arg.name === 'ad_impression' && c.arg.params?.ad_unit_name === 'unit-queued');
      assert.ok(queuedFlushed);
      assert.equal(queuedFlushed!.arg.params.value, 0.0025);

      // Explicit UMP refusal -> disables collection
      euSvc.setConsent(false, true);
      assert.equal(euSvc.isActive, false);
      const euDenied = [...nativeCalls].reverse().find((c) => c.fn === 'setConsent');
      assert.equal(euDenied?.arg.analyticsStorage, false);
      assert.equal(euDenied?.arg.enabled, false);
    } finally {
      setFirebaseAnalyticsBridgeForTest(null);
      (Capacitor as any).isNativePlatform = origIsNative;
      (Capacitor as any).getPlatform = origGetPlatform;
      (globalThis as any).localStorage = origStorage;
      (Intl as any).DateTimeFormat = origIntl;
    }
  });
});
