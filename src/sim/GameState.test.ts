import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GameState, BRANCH_STAFF_MULTIPLIER } from './GameState.ts';
import { BRANCH_COSTS } from '../data/economy.ts';

describe('branch-specific staff', () => {
  it('offers starter roles when their visible work points already exist', () => {
    const state = new GameState();
    state.money = 1_000_000;
    assert.equal(state.canHire('waiter'), true);
    assert.equal(state.canHire('cashier'), true);
    assert.equal(state.canHire('barista'), false);
    state.unlockedZones.add('kose:a3');
    assert.equal(state.canHire('barista'), true);
  });

  it('keeps each branch roster separate and preserves it through save/load', () => {
    const state = new GameState();
    state.money = 1_000_000;
    state.activeLocation = 'kose';
    state.useStaffLocation('kose');
    state.unlockedZones.add('kose:a3');
    assert.equal(state.hire('waiter'), true);
    assert.equal(state.staffCountAt('kose').waiter, 1);

    state.activeLocation = 'sahil';
    state.useStaffLocation('sahil');
    assert.equal(state.staffCount.waiter, 0);

    const loaded = new GameState();
    loaded.load(state.save());
    assert.equal(loaded.staffCountAt('kose').waiter, 1);
    assert.equal(loaded.staffCountAt('sahil').waiter, 0);
  });

  it('clamps legacy shared rosters to each branch cap', () => {
    const state = new GameState();
    state.load({
      locations: ['kose', 'sahil'],
      activeLocation: 'kose',
      staffCount: { waiter: 9, cashier: 9, barista: 9, busser: 9 },
      staffLevel: { waiter: 99, cashier: 99, barista: 99, busser: 99 },
    });
    assert.deepEqual(state.staffCountAt('kose'), { waiter: 5, cashier: 2, barista: 5, busser: 3 });
    assert.deepEqual(state.staffCountAt('sahil'), { waiter: 3, cashier: 1, barista: 3, busser: 1 });
    assert.equal(state.staffLevelAt('kose').waiter, 10);
  });

  it('grows hire capacity only when real work points open', () => {
    const state = new GameState();
    state.money = 1_000_000;
    state.unlockedZones.add('kose:a3');
    assert.equal(state.activeStaffCapFor('waiter'), 1);
    assert.equal(state.hire('waiter'), true);
    assert.equal(state.canHire('waiter'), false);

    state.unlockedZones.add('kose:a4');
    assert.equal(state.activeStaffCapFor('waiter'), 2);
    assert.equal(state.canHire('waiter'), true);

    assert.equal(state.activeStaffCapFor('cashier'), 1);
    state.unlockedZones.add('kose:a5');
    assert.equal(state.activeStaffCapFor('cashier'), 2);
  });
});

describe('real revenue', () => {
  it('keeps gifts out of earned revenue and prestige progress', () => {
    const state = new GameState();
    state.grant(5_000);
    assert.equal(state.money, 5_000);
    assert.equal(state.revenueEarned, 0);
    state.earn(320);
    assert.equal(state.money, 5_320);
    assert.equal(state.revenueEarned, 320);
  });
});


describe('offline staff hire deposits', () => {
  it('keeps a partial contribution and makes the panel price the remaining amount', () => {
    const state = new GameState();
    state.money = 100;
    assert.equal(state.payStaffHire('waiter', 37.125), 37.125);
    assert.equal(state.hirePaidFor('waiter'), 37.125);
    assert.equal(state.hireCostFor('waiter'), 362.875);
    assert.equal(state.money, 62.875);
    const loaded = new GameState();
    loaded.load(JSON.parse(JSON.stringify(state.save())));
    assert.equal(loaded.hirePaidFor('waiter'), 37.125);
    assert.equal(loaded.hireCostFor('waiter'), 362.875);
    assert.equal(loaded.money, 62.875);
  });

  it('finishes via the ordinary menu without charging the deposit twice', () => {
    const state = new GameState();
    state.money = 2000;
    state.payStaffHire('waiter', 37.125);
    assert.equal(state.hire('waiter'), true);
    assert.equal(state.money, 1600);
    assert.equal(state.staffCount.waiter, 1);
    assert.equal(state.hirePaidFor('waiter'), 0);
    assert.equal(state.hireTotalCostFor('waiter'), 740);
    assert.equal(state.hireCostFor('waiter'), 740);
    assert.equal(state.hire('waiter'), false, 'one starter shelf supports one assistant');
    assert.equal(state.money, 1600);
  });

  it('finishes a deposited hire once and starts the next price tier with no deposit', () => {
    const state = new GameState();
    state.unlockedZones.add('kose:a3');
    state.unlockedZones.add('kose:a4');
    state.money = 3000;
    state.payStaffHire('waiter', 37.125);
    assert.equal(state.payStaffHire('waiter', 1000), 362.875);
    assert.equal(state.staffCount.waiter, 1);
    assert.equal(state.money, 2600);
    assert.equal(state.hirePaidFor('waiter'), 0);
    assert.equal(state.hireCostFor('waiter'), 740);
    state.payStaffHire('waiter', 100);
    assert.equal(state.hirePaidFor('waiter'), 100);
    assert.equal(state.hireCostFor('waiter'), 640);
  });

  it('does not pay locked roles, exhausted staff slots or invalid contribution values', () => {
    const state = new GameState();
    state.money = 100_000;
    assert.equal(state.payStaffHire('barista', 50), 0);
    assert.equal(state.payStaffHire('waiter', Number.NaN), 0);
    assert.equal(state.payStaffHire('waiter', Number.POSITIVE_INFINITY), 0);
    assert.equal(state.payStaffHire('waiter', -10), 0);
    assert.equal(state.money, 100_000);
    state.hire('waiter');
    const money = state.money;
    assert.equal(state.payStaffHire('waiter', 50), 0);
    assert.equal(state.money, money);
  });

  it('keeps branch and role deposits separate through reload', () => {
    const state = new GameState();
    state.money = 100_000;
    state.payStaffHire('waiter', 75);
    state.payStaffHire('cashier', 120);
    state.unlockedLocations.add('sahil');
    state.unlockedZones.add('sahil:p1');
    state.activeLocation = 'sahil';
    state.useStaffLocation('sahil');
    state.payStaffHire('waiter', 33.125);
    const loaded = new GameState();
    loaded.load(JSON.parse(JSON.stringify(state.save())));
    assert.equal(loaded.hirePaidFor('waiter'), 33.125);
    assert.equal(loaded.hireCostFor('waiter'), loaded.hireTotalCostFor('waiter') - 33.125);
    assert.equal(loaded.hirePaidFor('waiter', 'kose'), 75);
    assert.equal(loaded.hirePaidFor('cashier', 'kose'), 120);
    assert.equal(loaded.hirePaidFor('cashier', 'sahil'), 0);
  });

  it('ignores stale deposits for an older hire count and clamps malformed amounts', () => {
    const state = new GameState();
    state.load({ staffHireDeposits: { kose: {
      waiter: { count: 1, paid: 100 },
      cashier: { count: 0, paid: 999999 },
      barista: { count: 0, paid: Number.NaN },
    } } });
    assert.equal(state.hirePaidFor('waiter'), 0);
    assert.equal(state.hirePaidFor('cashier'), state.hireTotalCostFor('cashier'));
    assert.equal(state.hirePaidFor('barista'), 0);
    assert.equal(state.hire('cashier'), true, 'a fully paid restored contract needs no extra money');
    assert.equal(state.money, 0);
    assert.equal(state.staffCount.cashier, 1);
  });

  it('clears contract deposits with the rebuilt cafe on prestige', () => {
    const state = new GameState();
    state.money = 1000;
    state.payStaffHire('waiter', 37.125);
    state.prestigeReset(1);
    assert.equal(state.hirePaidFor('waiter'), 0);
    assert.equal(state.hireCostFor('waiter'), 400);
    assert.deepEqual(state.save().staffHireDeposits, {});
  });

  it('prices the sixth waiter as a few minutes of play, not an hour', () => {
    const state = new GameState();
    assert.equal(state.hireCostFor('waiter'), 400);
    state.staffCount.waiter = 5;
    assert.equal(state.hireCostFor('waiter'), 8668);
  });
});


it('does not strand a fractional wallet remainder during repeated square contributions', () => {
  for (const request of [6.123, 2.713, 0.117]) {
    const state = new GameState();
    state.money = 37.125;
    for (let i = 0; i < 1000 && state.money > 0; i++) state.payStaffHire('waiter', request);
    assert.equal(state.money, 0, 'all available money remains payable');
    assert.equal(state.hirePaidFor('waiter'), 37.125);
    assert.equal(state.staffCount.waiter, 0);
  }
});


describe('included branch starter areas', () => {
  it('opens only the included bar when a branch is acquired', () => {
    const state=new GameState();
    assert.equal(state.isZoneUnlocked('sahil','p1'),false);
    state.unlockLocation('sahil');
    assert.equal(state.isLocationUnlocked('sahil'),true);
    assert.equal(state.isZoneUnlocked('sahil','p1'),true);
    assert.equal(state.isZoneUnlocked('sahil','p2'),false);
    assert.equal(state.isZoneUnlocked('sahil','p3'),false);
  });
  it('repairs an owned empty branch on load without charging or opening paid content', () => {
    const state=new GameState(),save=state.save();
    save.locations.push('sahil');save.activeLocation='sahil';save.money=123;
    state.load(save);
    assert.equal(state.money,123);
    assert.equal(state.isZoneUnlocked('sahil','p1'),true);
    assert.equal(state.isZoneUnlocked('sahil','p2'),false);
    const restored=new GameState();restored.load(state.save());
    assert.equal(restored.money,123);assert.equal(restored.isZoneUnlocked('sahil','p1'),true);
  });

  it('eases staff inflation shock at sahil with 3.5x multiplier instead of 20x', () => {
    assert.equal(BRANCH_STAFF_MULTIPLIER, 3.5);
    const state = new GameState();
    const koseWaiter = state.hireTotalCostFor('waiter', 'kose');
    const sahilWaiter = state.hireTotalCostFor('waiter', 'sahil');
    assert.equal(sahilWaiter, Math.round(koseWaiter * 3.5));
    assert.equal(sahilWaiter, 1400); // 400 * 3.5, down from 8000
  });

  it('deducts only the actual branch price leaving savings intact', () => {
    const state = new GameState();
    const initialSavings = 250_000;
    state.money = initialSavings;
    const branchPrice = BRANCH_COSTS.sahil;
    assert.equal(branchPrice, 180_000);
    assert.ok(state.canAfford(branchPrice));
    assert.equal(state.spend(branchPrice), true);
    state.unlockLocation('sahil');
    assert.equal(state.isLocationUnlocked('sahil'), true);
    assert.equal(state.money, initialSavings - branchPrice);
    assert.equal(state.money, 70_000);
  });
});

describe('upgrade and staff onboarding persistence', () => {
  it('marks onboarding completed when buying first player upgrade or hiring staff and persists across save/load', () => {
    const state = new GameState();
    state.money = 2_000;
    assert.equal(state.upgradeOnboarded, false);
    assert.equal(state.staffOnboarded, false);

    assert.equal(state.buyPlayerUpgrade('speed'), true);
    assert.equal(state.upgradeOnboarded, true);
    assert.equal(state.staffOnboarded, false);

    assert.equal(state.hire('waiter'), true);
    assert.equal(state.staffOnboarded, true);

    const loaded = new GameState();
    loaded.load(JSON.parse(JSON.stringify(state.save())));
    assert.equal(loaded.upgradeOnboarded, true);
    assert.equal(loaded.staffOnboarded, true);
  });

  it('auto-migrates legacy saves that already have upgrades or staff so returning players are not re-prompted', () => {
    const state = new GameState();
    state.load({
      playerUpgrades: { speed: 2, carry: 0, tip: 0, magnet: 0 },
      staffCount: { waiter: 1, cashier: 0, barista: 0, busser: 0 },
    });
    assert.equal(state.upgradeOnboarded, true);
    assert.equal(state.staffOnboarded, true);
  });
});

