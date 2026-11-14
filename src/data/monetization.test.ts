import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GameState } from '../sim/GameState';
import { World } from '../sim/World';
import { PLAYER_UPGRADES, PLAYER_UPGRADE_MAP, offlineCapHours } from './upgrades';
import {
  computeOfflineEarnings,
  computeOfflineOfferBreakdown,
  computeComebackGift,
  COMEBACK_GIFT_MIN_SECONDS,
} from '../sim/Offline';
import {
  setAdProvider,
  resetAdSession,
  canShowInterstitial,
  tryInterstitial,
  canShowRewardedInterstitial,
  tryRewardedInterstitial,
  notifyBreakPromptSkipped,
  canShowAppOpen,
  tryAppOpen,
  showRewarded,
  computeCashBoostAmount,
  computeInvestorOfferAmount,
  CASH_BOOST_FLOOR,
} from '../core/Ads';
import { analytics } from '../core/Analytics';
import { computePlayerHealthScore } from '../core/Telemetry';
import { PurchaseMetrics } from '../core/PurchaseMetrics';

describe('Layout & Pad Clearance Validation', () => {
  it('validates both kose and sahil layouts with zero pad or solid overlaps', () => {
    const state = new GameState();
    const kose = new World('kose', state, null, false);
    const sahil = new World('sahil', state, null, false);
    assert.deepEqual(kose.validateLayout(), []);
    assert.deepEqual(sahil.validateLayout(), []);
    kose.dispose();
    sahil.dispose();
  });
});

describe('Privacy-First Analytics Gate', () => {
  it('remains inactive on web cold boot without explicit consent', () => {
    analytics.setConsent(false);
    analytics.init('dummy_game_key', 'dummy_secret_key');
    assert.equal(analytics.isActive, false);
  });
});

describe('Vault Upgrade & Offline Monetization Math', () => {
  it('defines vault in PLAYER_UPGRADE_MAP and exposes it in PLAYER_UPGRADES', () => {
    assert.ok(PLAYER_UPGRADE_MAP.vault);
    assert.ok(PLAYER_UPGRADES.some((u) => u.id === 'vault'));
    const state = new GameState();
    assert.ok(state.playerUpgradeCost('vault') > 0);
    assert.equal(offlineCapHours(0), 4);
    assert.equal(offlineCapHours(6), 16);
  });

  it('scales offline shift earnings conservatively with vault capacity, automation, and prestige capMult', () => {
    assert.equal(computeOfflineEarnings(30, 50, true), 0);
    assert.equal(computeOfflineEarnings(120, 50, true), 0);
    assert.equal(computeOfflineEarnings(3600, 50, false), 0);
    const partialStaffShift = computeOfflineEarnings(14400, 50, true, 1, 14400, 0.38);
    const shortShift = computeOfflineEarnings(3600, 50, true, 1, 14400, 1);
    const fourHourShift = computeOfflineEarnings(14400, 50, true, 1, 14400, 1);
    const upgradedVaultShift = computeOfflineEarnings(36000, 50, true, 1, 16 * 3600, 1);
    assert.ok(shortShift > 0);
    assert.ok(partialStaffShift < fourHourShift);
    assert.ok(fourHourShift > shortShift);
    assert.ok(upgradedVaultShift > fourHourShift);
    // 16h shift must never exceed ~24 minutes (1440s) of active income:
    assert.ok(upgradedVaultShift <= 50 * 1440);
  });

  it('keeps lump-sum comeback stock sales out of realizedIncome and matches preview value', () => {
    const state = new GameState();
    const kose = new World('kose', state, null, false);
    const machine = kose.machines.find((m) => !m.locked && m.def.item);
    assert.ok(machine);
    machine.output = 12;
    const beforeIncome = kose.realizedIncome;
    const preview = kose.estimateStockShareValue(0.5, 3);
    const sold = kose.sellStockShare(0.5, 3);
    assert.equal(sold, preview);
    assert.equal(kose.realizedIncome, beforeIncome);
    kose.dispose();
  });

  it('computes 2x vs 3x loss-aversion breakdown and 48h+ comeback gift', () => {
    const shortOffer = computeOfflineOfferBreakdown(1800, 2000, 500);
    assert.equal(shortOffer.multiplier, 2);
    assert.equal(shortOffer.rewardedTotalCash, 5000);
    assert.equal(shortOffer.forfeitedBonusCash, 3000);

    const longOffer = computeOfflineOfferBreakdown(7200, 4000, 1000);
    assert.equal(longOffer.multiplier, 3);
    assert.equal(longOffer.rewardedTotalCash, 15000);
    assert.equal(longOffer.forfeitedBonusCash, 11000);

    assert.equal(computeComebackGift(3600, 100).eligible, false);
    const gift = computeComebackGift(COMEBACK_GIFT_MIN_SECONDS + 60, 100);
    assert.equal(gift.eligible, true);
    assert.ok(gift.cashGift >= 60000);
    assert.equal(gift.happyHourSeconds, 300);
  });
});

describe('Smart Interstitial Pacing & Dynamic RV Scaling', () => {
  it('scales cash_boost and investor offers with estimated income and target remaining', () => {
    assert.equal(computeCashBoostAmount(0, 0, 0), CASH_BOOST_FLOOR);
    // Momentarily 0 realized income in Sahil, but 3000/s estimated capacity:
    const sahilBoost = computeCashBoostAmount(0, 3000, 200_000);
    assert.ok(sahilBoost >= 600_000);
    const investor = computeInvestorOfferAmount(0, 3000, 200_000);
    assert.ok(investor > sahilBoost);
    // When realized income is measured (e.g. 120/s), uncapped theoretical machine sum (10,000/s) must not 10x boost:
    const boundedActiveBoost = computeCashBoostAmount(120, 10_000, 50_000);
    assert.ok(boundedActiveBoost <= 60_000);
  });

  it('protects D1 warmup, low health score, busy player, and post-RV grace period', async () => {
    let interstitialShown = 0;
    setAdProvider({
      isReady: () => true,
      isInterstitialReady: () => true,
      show: async () => true,
      showInterstitial: async () => { interstitialShown++; },
    });

    const now = Date.now();
    // 60s into session: D2+ (45s warmup) allowed, D1 (75s warmup) blocked!
    resetAdSession(now - 60_000);
    const baseCtx = {
      isTutorialDone: true,
      isPlayerHandsEmpty: true,
      isPlayerIdle: true,
      hasActiveCrisis: false,
      goalsCompleted: 12,
      healthScore: 75,
    };
    assert.equal(canShowInterstitial({ ...baseCtx, ageDays: 0 }), false);
    assert.equal(canShowInterstitial({ ...baseCtx, ageDays: 2 }), true);

    // Low player health score (< 35) suppresses interstitials (churn shield):
    assert.equal(canShowInterstitial({ ...baseCtx, ageDays: 2, healthScore: 25 }), false);

    // Busy hands or crisis suppresses interstitials:
    assert.equal(canShowInterstitial({ ...baseCtx, ageDays: 2, isPlayerHandsEmpty: false }), false);
    assert.equal(canShowInterstitial({ ...baseCtx, ageDays: 2, hasActiveCrisis: true }), false);

    // Watching a Rewarded Video silences interstitials for 60s:
    assert.equal(await showRewarded('happy_hour'), true);
    assert.equal(canShowInterstitial({ ...baseCtx, ageDays: 2 }), false);

    // Fresh D2+ session after 130s shows interstitial and enforces gap:
    resetAdSession(now - 130_000);
    assert.equal(await tryInterstitial({ ...baseCtx, ageDays: 2, placement: 'zone_unlock' }), true);
    assert.equal(interstitialShown, 1);
    assert.equal(canShowInterstitial({ ...baseCtx, ageDays: 2 }), false);
  });

  it('supports rewarded interstitial, break prompt skip cooldown, and app open pacing', async () => {
    let riShown = 0;
    let aoShown = 0;
    setAdProvider({
      isReady: () => true,
      isInterstitialReady: () => true,
      isRewardedInterstitialReady: () => true,
      isAppOpenReady: () => true,
      show: async () => true,
      showInterstitial: async () => {},
      showRewardedInterstitial: async () => {
        riShown++;
        return true;
      },
      showAppOpen: async () => {
        aoShown++;
        return true;
      },
    });

    const now = Date.now();
    resetAdSession(now - 100_000);
    const ctx = {
      isTutorialDone: true,
      isPlayerHandsEmpty: true,
      isPlayerIdle: true,
      hasActiveCrisis: false,
      goalsCompleted: 4,
      ageDays: 0,
      healthScore: 80,
      placement: 'panel_close',
    };

    assert.equal(canShowRewardedInterstitial(ctx), true);
    // Skipping break prompt cools down both break formats without counting an impression:
    notifyBreakPromptSkipped();
    assert.equal(canShowRewardedInterstitial(ctx), false);
    assert.equal(canShowInterstitial(ctx), false);

    resetAdSession(now - 100_000);
    const res = await tryRewardedInterstitial(ctx);
    assert.deepEqual(res, { shown: true, rewarded: true });
    assert.equal(riShown, 1);
    // Break cooldown active right after showing a rewarded interstitial:
    assert.equal(canShowRewardedInterstitial(ctx), false);
    // App Open suppressed right after break (< 60s) and cooldown enforced after showing:
    assert.equal(canShowAppOpen(ctx), false);

    resetAdSession(now - 100_000);
    assert.equal(canShowAppOpen(ctx), true);
    assert.equal(await tryAppOpen(ctx), true);
    assert.equal(aoShown, 1);
    assert.equal(canShowAppOpen(ctx), false);

    // Watching rewarded video silences App Open for 60s:
    resetAdSession(now - 100_000);
    await showRewarded('happy_hour');
    assert.equal(canShowAppOpen(ctx), false);
  });
});

describe('Player Health Score & Zero-GC PurchaseMetrics', () => {
  it('computes bounded 0-100 health score and avoids array allocation on idle observe ticks', () => {
    const healthy = computePlayerHealthScore({
      sessionSeconds: 600,
      goalsCompleted: 10,
      rewardedWatched: 2,
      dailyStreak: 4,
      hygiene: 92,
      secondsSinceLastUnlock: 45,
    });
    const frustrated = computePlayerHealthScore({
      sessionSeconds: 30,
      goalsCompleted: 1,
      rewardedWatched: 0,
      dailyStreak: 0,
      hygiene: 10,
      secondsSinceLastUnlock: 450,
    });
    assert.ok(healthy >= 80 && healthy <= 100);
    assert.ok(frustrated < 35 && frustrated >= 0);

    const pm = new PurchaseMetrics();
    const a = pm.observe([], 0.016);
    const b = pm.observe([], 0.016);
    assert.equal(a, b);
    assert.equal(a.length, 0);
  });
});
