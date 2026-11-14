import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HandActionClock } from './HandActionClock.ts';
import { GameState } from './GameState.ts';
import { GoalTracker } from './Goals.ts';
import { StationEntity } from './Station.ts';
import { ALL_STATIONS } from '../data/stations.ts';
import { GOALS } from '../data/goals.ts';
import { handsInterval } from '../data/upgrades.ts';
import { baristaBoost, waiterCapacity, waiterShelfTarget } from '../data/staff.ts';
import { SpillField } from './Spills.ts';
import { World } from './World.ts';
import { Player } from '../entities/Player.ts';
import { TUTORIAL_STEP_COUNT } from './Tutorial.ts';
import { Quaternion } from 'three';
import { adSpotPositionFor, createAdSpotView, pickAdSpotPosition } from '../world/AdSpotView.ts';
import { HAPPY_HOUR_SECONDS, HAPPY_HOUR_STEP_SECONDS, ROBOT_SECONDS, decayAdBuffMap } from '../core/Ads.ts';
import { EventManager } from './Events.ts';
import { Order } from './Orders.ts';
import { Customer } from '../entities/Customer.ts';
import { CUSTOMER_ARCHETYPES } from '../data/customers.ts';

describe('promised upgrade effects', () => {
  for (const hz of [30, 45, 60]) it('delivers every hand speed level at ' + hz + ' Hz without plateau', () => {
    let previous = 0;
    for (let level = 0; level <= 10; level++) {
      const clock = new HandActionClock();
      let count = 0;
      const duration = handsInterval(level);
      for (let frame = 0; frame < hz * 60; frame++) if (clock.contact('same shelf', 1 / hz, duration)) count++;
      assert.ok(Math.abs(count - 60 / duration) <= 1, 'level ' + level + ': ' + count);
      assert.ok(count > previous, 'every level must improve actual throughput');
      previous = count;
    }
  });
  it('does not replay a completed transfer after leaving or changing its target', () => {
    const clock = new HandActionClock();
    assert.equal(clock.contact('a', .25, .52), true);
    assert.equal(clock.contact('b', .01, .52), false);
    clock.reset();
    assert.equal(clock.contact('a', .01, .52), false);
  });
  it('keeps phase continuous when hands are upgraded during an action', () => {
    const clock = new HandActionClock();
    clock.contact('a', .1, .5);
    assert.equal(clock.contact('a', .01, .2), false);
    assert.ok(Math.abs(clock.phase - .25) < 1e-9);
  });
  it('makes every checkout speed upgrade reduce both real operator durations', () => {
    const counter = new StationEntity(ALL_STATIONS.find(st => st.kind === 'counter')!);
    for (const actor of ['player', 'cashier'] as const) {
      let last = Infinity;
      for (let level = 0; level <= 8; level++) {
        counter.speedLevel = level;
        const seconds = counter.counterOrderTime(actor, 0);
        assert.ok(seconds < last); last = seconds;
        assert.equal(counter.cycleTime, counter.cycleTimeAt(level));
      }
    }
    counter.speedLevel = 0;
    const before = counter.counterOrderTime('cashier');
    counter.prestigeSpeed = .8;
    assert.ok(Math.abs(counter.counterOrderTime('cashier') - before * .8) < 1e-9);
  });
  it('uses the full shelf capacity as a shelf target, independent of hand carry capacity', () => {
    for (let level = 0; level <= 10; level++) {
      assert.equal(waiterShelfTarget(level, 8), 8);
      assert.equal(waiterShelfTarget(level, 4), 4);
      assert.equal(waiterShelfTarget(level, 3), 3);
    }
    assert.equal(waiterShelfTarget(10, 8), 8);
  });
});

describe('completed table state and migration', () => {
  it('does not finish the full-table goal by merely collecting dishes', () => {
    const state = new GameState(); state.goalIndex = GOALS.findIndex(g => g.id === 'g03');
    const tracker = new GoalTracker(state);
    const index = state.goalIndex;
    state.stats.cleaned = 30; tracker.update();
    assert.equal(state.goalIndex, index);
    state.stats.tablesCleaned = 1; tracker.update();
    assert.equal(state.goalIndex, index + 1); tracker.dispose();
  });
  it('saves table completions separately and resets only their goal baseline at prestige', () => {
    const state = new GameState(); state.stats.cleaned = 8; state.stats.tablesCleaned = 3;
    state.festivalGoalId = 'tea'; state.festivalGoalTarget = 50;
    const loaded = new GameState(); loaded.load(state.save());
    assert.equal(loaded.stats.tablesCleaned, 3); assert.equal(loaded.stats.cleaned, 8);
    assert.equal(loaded.festivalGoalId, 'tea'); assert.equal(loaded.festivalGoalTarget, 50);
    loaded.prestigeReset(1);
    assert.equal(loaded.statSinceReset('tablesCleaned'), 0); assert.equal(loaded.stats.tablesCleaned, 3);
    const legacy = state.save(); delete legacy.stats.tablesCleaned;
    loaded.load(legacy); assert.equal(loaded.stats.tablesCleaned, 0);
  });
});

describe('real two-minute production contribution', () => {
  for (const hz of [30, 45, 60]) it('delivers promised barista production and preserves player help at ' + hz + ' Hz', () => {
    const def = ALL_STATIONS.find(st => st.kind === 'machine' && st.item === 'cay')!;
    const measure = (boost: number, player: boolean) => {
      const machine = new StationEntity(def); machine.locked = false;
      machine.baristaBoost = boost; machine.playerNear = player;
      for (let f = 0; f < hz * 120; f++) { machine.output = 0; machine.update(1 / hz); }
      return machine.producedTotal;
    };
    const baseline = measure(1, false), hired = measure(baristaBoost(0), false), max = measure(baristaBoost(10), false);
    assert.ok(Math.abs(hired - 120 / def.time * 1.25) <= 1);
    assert.ok(Math.abs(max - 120 / def.time * 1.85) <= 1);
    assert.ok(hired > baseline); assert.ok(max > hired);
    assert.equal(measure(baristaBoost(10), true), measure(1, true), 'player ×2 replaces boost, never stacks invisibly');
  });
  it('keeps visited branches across prestige and ignores unknown saved locations', () => {
    const state = new GameState(); state.seenLocations.add('sahil'); state.prestigeReset(1);
    const save = state.save(); save.seenLocations!.push('other');
    const loaded = new GameState(); loaded.load(save);
    assert.equal(loaded.seenLocations.has('sahil'), true); assert.equal(loaded.seenLocations.has('other'), false);
  });
});

describe('tactile cleaning and VIP investor simulation integrity', () => {
  it('snaps remaining <=12% spill rim crumbs cleanly to zero so no 1-pixel hunt occurs', () => {
    const field = new SpillField();
    const spill = field.spawn(0, 0, 'liquid');
    assert.ok(spill);
    assert.ok(spill.cellsTotal > 20);
    // Sweep wide strokes until <=12% remains; snapTail must finish the spill cleanly.
    const step = 0.22;
    for (let z = -spill.radius; z <= spill.radius && spill.cellsLeft > 0; z += step) {
      field.carveStroke(spill, -spill.radius, z, spill.radius, z, 0.28);
      if (spill.cellsLeft > 0) {
        assert.ok(
          spill.cellsLeft > Math.max(2, Math.ceil(spill.cellsTotal * 0.12)),
          'any non-zero remainder must be strictly above the 12% magnetic snap threshold',
        );
      }
    }
    assert.equal(spill.cellsLeft, 0);
    assert.equal(spill.amount, 0);
  });

  it('keeps Rich Investor calm in investor state and waves deterministically on dismiss without timer leaks', () => {
    const state = new GameState();
    state.tutorialStep = 99;
    const world = new World('kose', state, null, false);
    world.setActive(true);
    const repBefore = state.reputation;
    const inv = world.spawnCustomer('investor');
    assert.ok(inv);
    assert.equal(inv.state, 'investor');
    assert.equal(world.hasInvestor(), true);

    const mods = { spawnMult: 0, valueMult: 1, patienceMult: 1, tipMult: 1 };
    for (let i = 0; i < 120; i++) {
      world.update(1 / 30, null, mods);
    }
    assert.equal(inv.state, 'investor');
    assert.equal(state.stats.angry, 0);
    assert.equal(state.reputation, repBefore);

    world.dismissInvestor(true);
    assert.equal(inv.waving, true);
    assert.equal(world.hasInvestor(), false);

    // Advance 2.0s of deterministic simulation time -> transitions from wave to leave without setTimeout.
    for (let i = 0; i < 65; i++) {
      world.update(1 / 30, null, mods);
    }
    assert.equal(inv.waving, false);
    assert.equal(inv.state, 'leave');
    world.dispose();
    assert.equal(inv.done, true);
  });

  it('completes dishes -> bin -> polish table care cycle and blocks polish hints when hands hold products', () => {
    const state = new GameState();
    state.tutorialStep = TUTORIAL_STEP_COUNT;
    state.playTime = 100;
    const world = new World('kose', state, null, false);
    world.setActive(true);
    const player = new Player();
    const w = world as any;
    w.customers.length = 0;

    const table = world.tables.find((t) => !t.locked)!;
    const bin = world.bins.find((b) => !b.locked)!;
    const machine = world.openMachines().find((m) => m.def.item === 'cay')!;
    const shelf = world.shelfFor('cay')!;
    const idle = { x: 0, y: 0, mag: 0, active: false };
    const step = () => {
      state.playTime += 1 / 30;
      player.update(1 / 30, idle, world.nav, world.loc.bounds);
      w.updatePlayerInteraction(1 / 30, player);
    };

    table.dishes = 1;
    table.soil = 1;
    table.dirtyAge = 80;
    w.guideGoal = GOALS.find((g) => g.kind === 'clean') ?? null;
    const tablePt = { x: 0, z: 0 };
    table.servicePoint(tablePt);
    player.setPosition(tablePt.x, tablePt.z);

    // Even with stats.orders === 0, completed tutorial enables beginGuideCare.
    const begin = w.pickGuideTarget(player);
    assert.ok(begin);
    assert.equal(w.guideCare?.id, table.id);

    for (let i = 0; i < 300 && !player.hasItem('bulasik'); i++) step();
    assert.equal(player.hasItem('bulasik'), true);
    assert.equal(table.dishes, 0);
    assert.ok(table.soil > 0.5, 'dish pickup must preserve table soil for polishing');

    // New shelf demand must not interrupt waste delivery -> polish cycle.
    machine.output = 3;
    shelf.contents.length = 0;
    shelf.output = 0;
    const toBin = w.pickGuideTarget(player);
    const binPt = { x: 0, z: 0 };
    bin.servicePoint(binPt);
    assert.ok(Math.hypot(toBin.x - binPt.x, toBin.z - binPt.z) < 0.01);

    player.setPosition(binPt.x, binPt.z);
    for (let i = 0; i < 300 && player.hasItem('bulasik'); i++) step();
    assert.equal(player.hasItem('bulasik'), false);

    const toPolish = w.pickGuideTarget(player);
    assert.equal(w.guideCare?.id, table.id);
    assert.ok(Math.hypot(toPolish.x - tablePt.x, toPolish.z - tablePt.z) < 0.01);

    player.setPosition(tablePt.x, tablePt.z);
    for (let i = 0; i < 600 && table.isDirty; i++) step();
    assert.equal(table.isDirty, false);
    assert.equal(table.soil, 0);

    // Full shelves + held product must not instruct impossible polishing.
    for (const pickup of world.openPickups()) {
      pickup.contents = Array(pickup.outputCap).fill(pickup.def.item!);
      pickup.output = pickup.contents.length;
    }
    assert.equal(player.give('cay'), true);
    table.dishes = 0;
    table.soil = 1;
    w.guideCare = null;
    w.guideGoal = null;
    const polishBlocked = w.pickGuideTarget(player);
    assert.equal(polishBlocked?.label, 'YENİ SİPARİŞİ BEKLE');

    // When tableSoilPerUse === 0 (live gameplay: dishes = 1, soil = 0), picking up the final dish completes the table immediately.
    player.dropAll();
    const cleanedBefore = state.stats.tablesCleaned;
    table.dishes = 1;
    table.soil = 0;
    table.dirtyAge = 20;
    player.setPosition(tablePt.x, tablePt.z);
    for (let i = 0; i < 300 && !player.hasItem('bulasik'); i++) step();
    assert.equal(table.dishes, 0);
    assert.equal(table.isDirty, false);
    assert.equal(state.stats.tablesCleaned, cleanedBefore + 1);

    world.dispose();
  });

  it('picks up and returns vacuum next to stocked shelves while guarding guided floor spills', () => {
    const state = new GameState();
    state.tutorialStep = TUTORIAL_STEP_COUNT;
    state.playTime = 100;
    const world = new World('kose', state, null, false);
    world.setActive(true);
    const player = new Player();
    const w = world as any;
    w.unlockZone('a3');
    w.customers.length = 0;
    for (const pickup of world.openPickups()) {
      pickup.contents.splice(0, pickup.contents.length, ...Array(pickup.outputCap).fill(pickup.def.item!));
      pickup.output = pickup.contents.length;
    }
    const dock = world.vacuums.find((d) => !d.locked)!;
    const dockPt = { x: 0, z: 0 };
    dock.servicePoint(dockPt);
    const idle = { x: 0, y: 0, mag: 0, active: false };
    const step = () => {
      state.playTime += 1 / 30;
      player.update(1 / 30, idle, world.nav, world.loc.bounds);
      w.updatePlayerInteraction(1 / 30, player);
    };

    // Stocked coffee shelf overlaps (dockPt.x + 0.2, dockPt.z - 0.18); dock pickup must still succeed.
    player.setPosition(dockPt.x + 0.2, dockPt.z - 0.18);
    for (let i = 0; i < 180 && !player.hasVacuum; i++) step();
    assert.equal(player.hasVacuum, true);
    assert.equal(player.noTakeFrom, dock.id);

    // Create shelf demand so hasServiceWork() triggers vacuum return guidance.
    const machine = world.openMachines().find((m) => m.def.item === 'cay')!;
    const shelf = world.shelfFor('cay')!;
    machine.output = 3;
    shelf.contents.length = 0;
    shelf.output = 0;

    const walkTo = (target: { x: number; z: number }) => {
      const path: number[] = [];
      world.nav.findPath(player.x, player.z, target.x, target.z, path);
      assert.ok(path.length > 0, 'guide target must have a navigable path');
      let index = 0;
      let frames = 0;
      while (Math.hypot(player.x - target.x, player.z - target.z) > 0.16 && frames++ < 600) {
        while (index + 1 < path.length && Math.hypot(player.x - path[index], player.z - path[index + 1]) < 0.18) {
          index += 2;
        }
        const tx = index + 1 < path.length ? path[index] : target.x;
        const tz = index + 1 < path.length ? path[index + 1] : target.z;
        const dx = tx - player.x;
        const dz = tz - player.z;
        const dist = Math.hypot(dx, dz) || 1;
        state.playTime += 1 / 30;
        player.update(
          1 / 30,
          { x: dx / dist, y: -dz / dist, mag: Math.min(1, dist / 0.5), active: true },
          world.nav,
          world.loc.bounds,
        );
        w.updatePlayerInteraction(1 / 30, player);
      }
      for (let i = 0; i < 6; i++) step();
    };

    const clearanceTarget = w.pickGuideTarget(player);
    assert.equal(clearanceTarget?.label, 'BİR ADIM UZAKLAŞ');
    walkTo(clearanceTarget);
    assert.notEqual(player.noTakeFrom, dock.id);
    assert.equal(player.hasVacuum, true);

    const returnTarget = w.pickGuideTarget(player);
    assert.equal(returnTarget?.label, 'SÜPÜRGEYİ BIRAK');
    assert.ok(Math.hypot(returnTarget.x - dockPt.x, returnTarget.z - dockPt.z) < 0.001);
    walkTo(returnTarget);
    for (let i = 0; i < 180 && player.hasVacuum; i++) step();
    assert.equal(player.hasVacuum, false);
    assert.equal(dock.output, 1);

    let repicked = false;
    for (let i = 0; i < 180; i++) {
      step();
      if (player.hasVacuum) repicked = true;
    }
    assert.equal(repicked, false);

    // Guided spill overlapping the dock must be mopped without picking up the vacuum.
    player.noTakeFrom = null;
    const spill = world.spills.spawn(dockPt.x, dockPt.z, 'liquid')!;
    assert.ok(spill);
    w.guideGoal = GOALS.find((g) => g.kind === 'mop') ?? null;
    w.pickGuideTarget(player);
    assert.equal(w.guideCare?.kind, 'spill');
    let grabbedVacuum = false;
    for (let i = 0; i < 600 && world.spills.byId(spill.id); i++) {
      step();
      if (player.hasVacuum) grabbedVacuum = true;
    }
    assert.equal(grabbedVacuum, false);
    assert.equal( Boolean(world.spills.byId(spill.id)), false);

    world.dispose();
  });

  it('never grabs the broom when throwing dishes or items into the trash bin', () => {
    const state = new GameState();
    state.tutorialStep = TUTORIAL_STEP_COUNT;
    state.playTime = 120;
    const world = new World('kose', state, null, false);
    world.setActive(true);
    const player = new Player();
    const w = world as any;
    w.customers.length = 0;

    const bin = world.bins.find((b) => !b.locked)!;
    const dock = world.vacuums.find((v) => !v.locked)!;
    assert.ok(Math.hypot(bin.x - dock.x, bin.z - dock.z) > 5, 'bin and vacuum dock must be spatially separated');

    const binPt = { x: 0, z: 0 };
    bin.servicePoint(binPt);
    const idle = { x: 0, y: 0, mag: 0, active: false };
    const step = () => {
      state.playTime += 1 / 30;
      player.update(1 / 30, idle, world.nav, world.loc.bounds);
      w.updatePlayerInteraction(1 / 30, player);
    };

    assert.equal(player.give('bulasik'), true);
    assert.equal(player.give('cay'), true);
    player.setPosition(binPt.x, binPt.z);
    for (let i = 0; i < 240; i++) step();
    assert.equal(player.carryCount, 0);
    assert.equal(player.hasVacuum, false);

    // Even if a dock were placed adjacent (1.2m) to a bin, bin proximity + post-bin cooldown prevent accidental pickup.
    dock.x = bin.x + 0.1;
    dock.z = bin.z + 1.2;
    assert.equal(player.give('bulasik'), true);
    player.setPosition(binPt.x, binPt.z + 0.25);
    for (let i = 0; i < 120; i++) step();
    assert.equal(player.carryCount, 0);
    assert.equal(player.hasVacuum, false);

    world.dispose();
  });

  it('keeps multi-angle vacuum dock approach working and exposes 3D ad beacon state cleanly', () => {
    const state = new GameState();
    state.tutorialStep = TUTORIAL_STEP_COUNT;
    state.playTime = 180;
    state.money = 0;
    const world = new World('kose', state, null, false);
    world.setActive(true);
    const player = new Player();
    const w = world as any;
    w.syncLocks();

    const dock = world.vacuums.find((v) => !v.locked)!;
    assert.ok(Math.hypot(1.5 - dock.x, -1.3 - dock.z) > 6);
    assert.ok(dock.x > -8.2, 'vacuum dock rear handle must clear the x=-8.85 west partition mullion');

    const idle = { x: 0, y: 0, mag: 0, active: false };
    let unblockedAngles = 0;
    let firstPoint: { x: number; z: number } | null = null;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const x = dock.x + Math.cos(a) * 1.35;
      const z = dock.z + Math.sin(a) * 1.35;
      if (world.nav.solidBlocked(x, z, 0.32)) continue;
      if (!firstPoint) firstPoint = { x, z };
      unblockedAngles++;
      player.hasVacuum = false;
      player.noTakeFrom = null;
      player.noDropTo = null;
      player.handTimer = 0;
      w.armKey = null;
      w.armT = 0;
      dock.output = 1;
      player.setPosition(x, z);
      player.planarSpeed = 0;
      for (let f = 0; f < 45; f++) {
        w.updatePlayerInteraction(1 / 30, player);
      }
      assert.equal(player.hasVacuum, true, `angle ${i} must acquire vacuum`);
      player.noTakeFrom = null;
      for (let f = 0; f < 45; f++) {
        w.updatePlayerInteraction(1 / 30, player);
      }
      assert.equal(player.hasVacuum, false, `angle ${i} must return vacuum`);
    }
    assert.ok(unblockedAngles >= 3);

    // Running past the dock must not pick up the vacuum.
    player.setPosition(firstPoint!.x, firstPoint!.z);
    player.noTakeFrom = null;
    player.handTimer = 0;
    w.armKey = null;
    w.armT = 0;
    player.planarSpeed = 4;
    for (let f = 0; f < 40; f++) w.updatePlayerInteraction(1 / 30, player);
    assert.equal(player.hasVacuum, false);
    player.planarSpeed = 0;

    // Zone ad beacon eligibility: 25% -> pay_half, 40% (remaining 60% <= 65%) -> finish.
    const nextZone = world.nextLockedZone()!;
    w.padProgress.set(nextZone.id, nextZone.cost * 0.28);
    w.syncLocks();
    w.updatePads(1 / 30, player);
    assert.equal(world.getOfferedAdZone()?.zone.id, nextZone.id);
    assert.equal(world.getOfferedAdZone()?.tier, 'pay_half');

    w.padProgress.set(nextZone.id, nextZone.cost * 0.4);
    w.updatePads(1 / 30, player);
    assert.equal(world.getOfferedAdZone()?.tier, 'finish');

    // 3D AdSpotView walkable coordinates, multi-spot rotation, and bespoke 3D showcase props.
    const spotPos = adSpotPositionFor('kose');
    assert.equal(world.nav.solidBlocked(spotPos.x, spotPos.z, 0.32), false);

    const seenSpots = new Set<string>();
    let prevSpot: { x: number; z: number } | null = null;
    for (let i = 0; i < 8; i++) {
      const nextSpot = pickAdSpotPosition(world, 0, 3, 'robot_vacuum', prevSpot, () => (i * 0.37) % 1);
      assert.equal(world.nav.solidBlocked(nextSpot.x, nextSpot.z, 0.32), false, `spot ${i} must be walkable`);
      if (prevSpot) {
        assert.ok(
          Math.hypot(nextSpot.x - prevSpot.x, nextSpot.z - prevSpot.z) >= 1.25,
          'consecutive ad spots must not spawn on the exact same spot',
        );
      }
      seenSpots.add(`${nextSpot.x.toFixed(1)},${nextSpot.z.toFixed(1)}`);
      prevSpot = nextSpot;
    }
    assert.ok(seenSpots.size >= 3, 'ad spots must rotate across multiple distinct cafe positions');

    const beacon = createAdSpotView();
    const quat = new Quaternion();
    for (const kind of [
      'robot_vacuum',
      'zone_finish',
      'happy_hour',
      'cash_boost',
      'usta_mode',
      'rush_hour',
      'tip_rain',
      'repair_shield',
      'stock_refill',
    ] as const) {
      beacon.show(spotPos.x, 0, spotPos.z, 'Ödül', 'default', kind);
      assert.equal(beacon.isVisible(), true);
      beacon.setCountdown(0.75, 0.5);
      beacon.update(1 / 60, quat);
    }
    beacon.hide();
    assert.equal(beacon.isVisible(), false);
    beacon.dispose();

    world.dispose();
  });

  it('expires timed ad buffs by real wall-clock time when closed or backgrounded', () => {
    assert.equal(HAPPY_HOUR_SECONDS, 120);
    assert.equal(HAPPY_HOUR_STEP_SECONDS, 120);
    assert.equal(ROBOT_SECONDS, 120);
    // 1 minute buff -> play 30s (30s left) -> close for 3 hours (10,800s) -> 0s remaining.
    const expired = decayAdBuffMap(
      { happy: 30, robot: 45, usta: 20, rush: 15, tip: 25, shield: 120 },
      3 * 3600,
    );
    assert.deepEqual(expired, { happy: 0, robot: 0, usta: 0, rush: 0, tip: 0, shield: 0 });

    // Partial away time subtracts exact elapsed seconds and zeroes only expired buffs.
    const partial = decayAdBuffMap({ happy: 180, robot: 25, shield: 300 }, 60);
    assert.equal(partial.happy, 120);
    assert.equal(partial.robot, 0);
    assert.equal(partial.shield, 240);

    // Breakdown shield inside EventManager also decays on background wall-clock resume.
    const events = new EventManager();
    events.setBreakdownShield(180);
    assert.equal(events.breakdownShieldLeft, 180);
    events.decayBreakdownShield(50);
    assert.equal(events.breakdownShieldLeft, 130);
    events.decayBreakdownShield(500);
    assert.equal(events.breakdownShieldLeft, 0);
  });

  it('keeps fresh/VIP table orders and floor/toilet care with the player while allowing delayed waiter backup', () => {
    const state = new GameState();
    state.tutorialStep = TUTORIAL_STEP_COUNT;
    state.playTime = 240;
    const world = new World('kose', state, null, false);
    world.setActive(true);
    const w = world as any;
    for (const zone of world.loc.zones) {
      if (!world.zoneUnlocked(zone.id)) world.unlockZone(zone.id);
    }
    state.staffCount.waiter = 1;
    state.staffLevel.waiter = 10;
    state.staffCount.busser = 1;
    state.staffLevel.busser = 10;
    world.syncStaff();

    const player = new Player();
    player.setPosition(-20, -20);
    w.assistPlayer = player;
    w.customers.length = 0;

    const waiter = world.staff.find((s) => s.role === 'waiter')!;
    const busser = world.staff.find((s) => s.role === 'busser')!;
    const teaMachine = world.machines.find((m) => m.def.item === 'cay' && !m.locked)!;
    const teaShelf = world.pickups.find((p) => !p.locked && p.def.item === 'cay')!;
    teaMachine.output = 3;
    teaShelf.contents.length = 0;

    const regularTable = world.tables.find((t) => !t.locked && !t.def.vip)!;
    const vipTable = world.tables.find((t) => !t.locked && t.def.vip) ?? regularTable;
    regularTable.dishes = 0;
    regularTable.soil = 0;
    vipTable.dishes = 0;
    vipTable.soil = 0;

    // 1) Taze oturan normal masaya ve VIP masaya tezgâhtar dokunmaz; önce rafa ikmal yapar.
    const freshGuest = new Customer(CUSTOMER_ARCHETYPES[0], 'fresh-guest');
    freshGuest.dineIn = true;
    freshGuest.table = regularTable;
    freshGuest.state = 'seated';
    freshGuest.order = new Order([{ item: 'cay', qty: 1, served: 0 }]);
    freshGuest.maxPatience = 100;
    freshGuest.patience = 80; // > 0.45 eşiği: oyuncunun hızlı bahşiş penceresi
    regularTable.seatedGuests.push(freshGuest);
    w.customers.push(freshGuest);

    const vipGuest = new Customer(CUSTOMER_ARCHETYPES[0], 'vip-guest');
    vipGuest.dineIn = true;
    vipGuest.table = vipTable;
    vipGuest.state = 'seated';
    vipGuest.order = new Order([{ item: 'cay', qty: 1, served: 0 }]);
    vipGuest.maxPatience = 100;
    vipGuest.patience = 10; // çok düşük sabır ama VIP masa oyuncuda kalır
    if (vipTable !== regularTable) {
      vipTable.seatedGuests.push(vipGuest);
    } else {
      vipTable.def = { ...vipTable.def, vip: true };
    }
    w.customers.push(vipGuest);

    assert.equal(w.findTableServeJob(waiter), null, 'fresh and VIP table orders must not be taken by waiter');
    const relay = w.findRelayJob(waiter);
    assert.ok(relay, 'waiter must prioritize shelf restocking');
    assert.equal(relay.dest.def.kind, 'pickup');

    // 2) Normal masada sabır <= %45'e düşerse ve oyuncu uzaktaysa tezgâhtar gecikmeli yedek servisi alır.
    freshGuest.patience = 40;
    assert.ok(w.findTableServeJob(waiter), 'long-waiting regular table gets delayed backup when player is away');
    // Oyuncu masanın yanındayken tezgâhtar araya girmez.
    player.setPosition(regularTable.x + 1.0, regularTable.z);
    assert.equal(w.findTableServeJob(waiter), null, 'waiter must not steal a table when player is nearby');

    // 3) Masa Görevlisi kirli masa yokken zemin lekesini veya tuvaleti temizlemez ('mop' işine girmez).
    player.setPosition(-20, -20);
    for (const t of world.tables) {
      t.dishes = 0;
      t.soil = 0;
      t.cleanValue = 0;
    }
    w.spills.spawn(2, 2, 'kahve');
    const toilet = world.toilets.find((t) => !t.locked);
    if (toilet) {
      toilet.soil = 0.85;
      toilet.occupied = false;
    }
    busser.clearJob();
    busser.thinkTimer = 0;
    const mods = { spawnMult: 0, valueMult: 1, patienceMult: 1, tipMult: 1 };
    for (let i = 0; i < 90; i++) {
      world.update(1 / 30, player, mods);
    }
    assert.notEqual(busser.job, 'mop', 'busser must never enter mop job for floor spills or toilets');
    assert.equal(toilet ? toilet.soil >= 0.85 : true, true, 'toilet soil stays for the player to clean');

    world.dispose();
  });
});
