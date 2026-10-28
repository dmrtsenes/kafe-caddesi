import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SideActivities, type SideActivityCompletion } from './SideActivities.ts';
import { SIDE_ACTIVITY_DEFS, SIDE_ACTIVITY_IDS, type SideActivityId } from '../data/sideActivities.ts';
import { SIDE_COURTYARD, SIDE_GARDEN_LAYOUT, SIDE_GARDEN_SECTIONS, sideGardenGate, sideGardenObstacles } from '../data/sideGardenLayout.ts';
import { NavGrid } from './Navigation.ts';
import { ITEMS, type ItemId } from '../data/items.ts';

const menu: ItemId[] = ['cay', 'latte', 'tost', 'waffle', 'frappe'];
function unlock(model: SideActivities, id: SideActivityId, level = 1, available = menu): void {
  while (model.get(id).level < level) {
    const before = model.get(id);
    const result = model.depositPurchase(id, before.purchaseRemaining, available);
    assert.equal(result.upgraded, true);
  }
}
function fill(model: SideActivities, id: SideActivityId): void {
  for (const line of model.get(id).lines) {
    for (let n = line.delivered; n < line.quantity; n++) assert.equal(model.deposit(id, line.item), true);
  }
  assert.equal(model.get(id).phase, 'packing');
}
function finish(model: SideActivities, id: SideActivityId, hz = 60): { event: SideActivityCompletion; seconds: number } {
  for (let frame = 1; frame <= hz * 10; frame++) {
    const event = model.work(id, 1 / hz);
    const auto = model.update(1 / hz);
    assert.equal(auto.length, 0, 'manual packing must not receive a second auto increment');
    if (event) return { event, seconds: frame / hz };
  }
  throw new Error('Manual work failed to complete');
}
function wipe(model: SideActivities, id: SideActivityId, available = menu, hz = 60): number {
  for (let frame = 1; frame <= hz * 3; frame++) if (model.clean(id, 1 / hz, available)) return frame / hz;
  throw new Error('Wiping failed to complete');
}

 describe('optional side activity ledger', () => {
  it('uses shared navigation and scenery coordinates', () => {
    for (const id of SIDE_ACTIVITY_IDS) {
      assert.equal(SIDE_ACTIVITY_DEFS[id].workbench, SIDE_GARDEN_LAYOUT[id].bench);
      assert.equal(SIDE_ACTIVITY_DEFS[id].service, SIDE_GARDEN_LAYOUT[id].service);
      assert.equal(SIDE_ACTIVITY_DEFS[id].purchase, SIDE_GARDEN_LAYOUT[id].purchase);
    }
  });

  it('preserves partial purchase payments and only consumes the exact outstanding balance', () => {
    const a = new SideActivities();
    assert.equal(a.deposit('garden', 'cay'), false);
    assert.deepEqual(a.depositPurchase('garden', 250, menu), { spent: 250, upgraded: false, level: 0 });
    const b = new SideActivities(); b.restore(a.snapshot());
    assert.equal(b.get('garden').purchaseRemaining, 550);
    assert.deepEqual(b.depositPurchase('garden', 10000, menu), { spent: 550, upgraded: true, level: 1 });
    assert.equal(b.get('garden').purchaseDeposit, 0);
    assert.equal(b.get('garden').nextCost, 1600);
    assert.equal(b.get('garden').phase, 'delivery');
    assert.equal(b.get('courtyard').level, 0);
  });

  it('rejects incorrect, excess and foreign items without changing progress', () => {
    const m = new SideActivities(); unlock(m, 'garden');
    const initial = m.snapshot();
    for (const wrong of ['latte', 'bulasik', 'pecete', 'kagit', '__proto__', 'missing']) {
      assert.equal(m.deposit('garden', wrong as ItemId), false);
    }
    assert.deepEqual(m.snapshot(), initial);
    assert.equal(m.deposit('garden', 'cay'), true);
    assert.equal(m.needs('garden', 'cay'), true);
    assert.equal(m.deposit('garden', 'cay'), true);
    assert.equal(m.get('garden').phase, 'packing');
    assert.equal(m.deposit('garden', 'cay'), false);
    assert.equal(m.needs('garden', 'cay'), false);
  });

  for (const hz of [30, 45, 60, 120]) it(`completes manual packing once after three seconds at ${hz} Hz`, () => {
    const m = new SideActivities(); unlock(m, 'garden'); fill(m, 'garden');
    const { event, seconds } = finish(m, 'garden', hz);
    assert.ok(Math.abs(seconds - 3) <= 1 / hz + 1e-9);
    assert.equal(event.amount, Math.round(2 * ITEMS.cay.price * 1.5));
    assert.equal(event.bonus, 0);
    assert.equal(m.get('garden').completed, 1);
    for (let n = 0; n < hz * 10; n++) {
      assert.equal(m.work('garden', 1 / hz), null);
      assert.deepEqual(m.update(1 / hz), []);
    }
    assert.equal(m.get('garden').completed, 1);
  });

  it('requires deliberate wiping before another rotating recipe can start', () => {
    const m = new SideActivities(); unlock(m, 'garden'); fill(m, 'garden');
    finish(m, 'garden');
    const old = m.get('garden');
    assert.equal(m.deposit('garden', 'cay'), false);
    for (let i = 0; i < 120; i++) m.update(1 / 60);
    assert.equal(m.get('garden').cleanProgress, 0);
    assert.equal(wipe(m, 'garden'), 1.4);
    assert.equal(m.get('garden').order, old.order + 1);
    assert.equal(m.get('garden').phase, 'delivery');
    assert.notDeepEqual(m.get('garden').lines, old.lines);
  });

  it('resumes delivered products, half-finished packing and half-finished cleaning without a second payment', () => {
    const a = new SideActivities(); unlock(a, 'garden'); a.deposit('garden', 'cay');
    const b = new SideActivities(); b.restore(a.snapshot());
    assert.equal(b.get('garden').lines[0].delivered, 1);
    b.deposit('garden', 'cay');
    for (let n = 0; n < 60; n++) { assert.equal(b.work('garden', 1 / 60), null); b.update(1 / 60); }
    const c = new SideActivities(); c.restore(b.snapshot());
    assert.ok(Math.abs(c.get('garden').workProgress - 1 / 3) < 1e-8);
    assert.ok(Math.abs(finish(c, 'garden').seconds - 2) < 1e-8);
    for (let n = 0; n < 42; n++) assert.equal(c.clean('garden', 1 / 60, menu), false);
    const d = new SideActivities(); d.restore(c.snapshot());
    assert.equal(d.get('garden').phase, 'cleaning');
    assert.ok(Math.abs(d.get('garden').cleanProgress - .5) < 1e-8);
    assert.equal(d.work('garden', .25), null);
    assert.deepEqual(d.update(.25), []);
    assert.equal(wipe(d, 'garden'), .7);
    assert.equal(d.get('garden').completed, 1);
    assert.equal(d.get('garden').order, 2);
  });

  it('filters new recipes to currently producible goods and preserves committed recipes when the menu expands', () => {
    const m = new SideActivities(); unlock(m, 'garden', 1, []);
    assert.equal(m.get('garden').phase, 'waiting');
    m.syncMenu(['cay', 'bulasik']);
    assert.equal(m.get('garden').phase, 'delivery');
    assert.deepEqual(m.get('garden').lines.map(x => x.item), ['cay']);
    const first = m.get('garden');
    m.syncMenu(menu); assert.deepEqual(m.get('garden'), first);
    fill(m, 'garden'); finish(m, 'garden'); wipe(m, 'garden', ['latte']);
    assert.ok(m.get('garden').lines.every(x => x.item === 'latte'));
  });

  it('alternates complete tea and latte recipes early without requesting locked toast or repeating the same order', () => {
    const early: ItemId[] = ['cay', 'latte'];
    const m = new SideActivities(); unlock(m, 'garden', 1, early);
    const patterns: string[] = [];
    for (let i = 0; i < 8; i++) {
      const order = m.get('garden');
      assert.ok(order.lines.every(line => early.includes(line.item)), 'locked products must never be requested');
      assert.ok(order.lines.reduce((count, line) => count + line.quantity, 0) <= 3, 'the first tray can carry the complete early order');
      patterns.push(order.lines.map(line => `${line.item}:${line.quantity}`).sort().join('|'));
      if (i > 0) assert.notEqual(patterns[i], patterns[i - 1]);
      fill(m, 'garden'); finish(m, 'garden'); wipe(m, 'garden', early);
    }
    assert.deepEqual([...new Set(patterns)].sort(), ['cay:2', 'cay:2|latte:1']);
  });

  it('avoids an immediate recipe repeat when a new menu item changes the cycle, including after reload', () => {
    const early: ItemId[] = ['cay', 'latte'];
    const expanded: ItemId[] = ['cay', 'latte', 'tost'];
    const m = new SideActivities(); unlock(m, 'garden', 1, early);
    // Tea, mixed tea/latte, tea. Adding toast now changes the eligible list
    // length, so indexing by completed-count alone would select tea again.
    for (let i = 0; i < 2; i++) { fill(m, 'garden'); finish(m, 'garden'); wipe(m, 'garden', early); }
    assert.deepEqual(m.get('garden').lines.map(({ item, quantity }) => ({ item, quantity })), [{ item: 'cay', quantity: 2 }]);
    fill(m, 'garden'); finish(m, 'garden');
    const restored = new SideActivities(); restored.restore(m.snapshot());
    wipe(restored, 'garden', expanded);
    const next = restored.get('garden');
    assert.ok(next.lines.some(line => line.item === 'tost'));
    assert.ok(next.lines.every(line => expanded.includes(line.item)));
    assert.equal(next.completed, 3);
    assert.equal(next.order, 4);
  });

  it('uses menu fallbacks only when no complete recipe is available and permits the sole eligible recipe', () => {
    const m = new SideActivities(); unlock(m, 'garden', 1, ['latte', 'smoothie']);
    assert.deepEqual(m.get('garden').lines.map(line => line.item), ['latte']);
    fill(m, 'garden'); finish(m, 'garden'); wipe(m, 'garden', ['latte', 'smoothie']);
    assert.deepEqual(m.get('garden').lines.map(line => line.item), ['smoothie']);
    fill(m, 'garden'); finish(m, 'garden'); wipe(m, 'garden', ['cay', 'smoothie']);
    assert.deepEqual(m.get('garden').lines.map(line => line.item), ['cay'], 'the real tea recipe wins over a fallback smoothie');
    fill(m, 'garden'); finish(m, 'garden'); wipe(m, 'garden', ['cay', 'smoothie']);
    assert.deepEqual(m.get('garden').lines.map(line => line.item), ['cay'], 'one complete recipe may repeat instead of inventing another');
  });

  it('never rewrites the in-flight recipe or quote when an upgrade or price multiplier changes', () => {
    let value = 25;
    const m = new SideActivities(() => value); unlock(m, 'garden');
    m.deposit('garden', 'cay');
    const before = m.get('garden');
    value = 500;
    unlock(m, 'garden', 4);
    assert.deepEqual(m.get('garden').lines, before.lines);
    assert.equal(m.get('garden').reward, before.reward);
    assert.equal(m.get('garden').bonus, before.bonus);
    fill(m, 'garden'); assert.equal(finish(m, 'garden').event.amount, before.reward);
    wipe(m, 'garden');
    assert.ok(m.get('garden').reward > before.reward);
    assert.ok(m.get('garden').lines.reduce((n, x) => n + x.quantity, 0) > before.lines.reduce((n, x) => n + x.quantity, 0));
  });

  for (const hz of [30, 60]) it(`packs automatically in six seconds at L3 and manually in two at ${hz} Hz`, () => {
    const m = new SideActivities(); unlock(m, 'garden', 3);
    // No autonomous delivery, including a long idle period before stocking.
    for (let n = 0; n < hz * 20; n++) assert.deepEqual(m.update(1 / hz), []);
    assert.equal(m.get('garden').workProgress, 0);
    fill(m, 'garden');
    let auto: SideActivityCompletion[] = [], seconds = 0;
    for (let n = 1; n <= hz * 8; n++) {
      auto = m.update(1 / hz);
      if (auto.length > 0) { seconds = n / hz; break; }
    }
    assert.equal(auto.length, 1);
    assert.ok(Math.abs(seconds - 6) < 1 / hz + 1e-9);
    wipe(m, 'garden'); fill(m, 'garden');
    assert.ok(Math.abs(finish(m, 'garden', hz).seconds - 2) < 1 / hz + 1e-9);
  });

  it('L1/L2 never pack automatically and L3 never cleans or delivers automatically', () => {
    for (const level of [1, 2]) {
      const m = new SideActivities(); unlock(m, 'garden', level); fill(m, 'garden');
      for (let i = 0; i < 600; i++) assert.deepEqual(m.update(.1), []);
      assert.equal(m.get('garden').workProgress, 0);
    }
    const m = new SideActivities(); unlock(m, 'garden', 3); fill(m, 'garden'); finish(m, 'garden');
    for (let i = 0; i < 600; i++) m.update(.1);
    assert.equal(m.get('garden').phase, 'cleaning');
    assert.equal(m.get('garden').cleanProgress, 0);
  });

  it('grants the L4 gift only on each third completed order and never after reload', () => {
    const m = new SideActivities(); unlock(m, 'garden', 4);
    for (let order = 1; order <= 6; order++) {
      fill(m, 'garden');
      const event = finish(m, 'garden').event;
      assert.equal(event.bonus, order % 3 === 0 ? Math.round(event.amount * .25) : 0);
      const restored = new SideActivities(); restored.restore(m.snapshot());
      assert.equal(restored.work('garden', .25), null);
      assert.deepEqual(restored.update(.25), []);
      assert.equal(restored.get('garden').completed, order);
      wipe(m, 'garden');
    }
  });

  it('does not mutate internal progress through a view, save snapshot or completion receipt', () => {
    const m = new SideActivities(); unlock(m, 'garden');
    const view = m.get('garden'), save = m.snapshot();
    view.lines[0].delivered = 900; save.activities.garden.lines[0].quantity = 999;
    assert.equal(m.get('garden').lines[0].delivered, 0);
    assert.equal(m.get('garden').lines[0].quantity, 2);
    fill(m, 'garden');
    const event = finish(m, 'garden').event; event.lines[0].quantity = 999;
    assert.equal(m.get('garden').lines[0].quantity, 2);
    const restored = new SideActivities(); restored.restore(m.snapshot());
    m.clean('garden', .25, menu);
    assert.equal(restored.get('garden').cleanProgress, 0);
  });

  it('recovers missing and malformed saves without foreign goods or non-finite progress', () => {
    const m = new SideActivities();
    for (const input of [undefined, null, [], 'bad', { activities: null }]) {
      m.restore(input); assert.equal(m.get('garden').level, 0);
    }
    m.restore({ activities: { garden: { level: 3, completed: Infinity, order: -1, phase: 'packing',
      purchaseDeposit: Infinity, workProgress: NaN, cleanProgress: Infinity, reward: Infinity, bonus: NaN,
      lines: [{ item: '__proto__', quantity: 999 }, { item: 'cay', quantity: 2, delivered: -3 }] },
      courtyard: { level: -10, lines: [{ item: 'tost', quantity: 2, delivered: 2 }] } } });
    const g = m.get('garden');
    assert.equal(g.phase, 'delivery');
    assert.deepEqual(g.lines, [{ item: 'cay', quantity: 2, delivered: 0 }]);
    assert.equal(g.workProgress, 0); assert.equal(g.purchaseDeposit, 0); assert.equal(g.completed, 0);
    for (const value of Object.values(g)) if (typeof value === 'number') assert.ok(Number.isFinite(value));
    assert.equal(m.get('courtyard').phase, 'locked'); assert.deepEqual(m.get('courtyard').lines, []);
  });

  it('ignores invalid time and cash and caps a resumed frame instead of creating offline work', () => {
    const m = new SideActivities();
    for (const amount of [NaN, Infinity, -Infinity, -100, 0]) assert.equal(m.depositPurchase('garden', amount, menu).spent, 0);
    unlock(m, 'garden', 3); fill(m, 'garden');
    const before = m.snapshot();
    for (const dt of [NaN, Infinity, -Infinity, -1, 0]) {
      assert.equal(m.work('garden', dt), null); assert.deepEqual(m.update(dt), []);
    }
    assert.deepEqual(m.snapshot(), before);
    assert.deepEqual(m.update(86400), []);
    assert.ok(m.get('garden').workProgress < .05);
  });

  it('caps upgrades, keeps both workbenches independent and supports separate location ledgers', () => {
    const m = new SideActivities(); unlock(m, 'garden', 4); unlock(m, 'courtyard');
    assert.deepEqual(m.depositPurchase('garden', 1000000, menu), { spent: 0, upgraded: false, level: 4 });
    const court = m.get('courtyard'); fill(m, 'garden'); finish(m, 'garden');
    assert.deepEqual(m.get('courtyard'), court);
    const otherLocation = new SideActivities();
    assert.equal(otherLocation.get('garden').level, 0);
    assert.equal(otherLocation.get('garden').completed, 0);
  });
});


describe('side garden circulation', () => {
  const bounds = { x0: -17.8, z0: -18, x1: 17.8, z1: 21.2 };
  function gardenNav(closed = false): NavGrid {
    const nav = new NavGrid(bounds, 2);
    nav.markStaticWalls(bounds); nav.beginRebuild();
    for (const wall of sideGardenObstacles({ id: 'kose' })) nav.blockRect(wall.x0, wall.z0, wall.x1, wall.z1);
    if (closed) for (const id of SIDE_ACTIVITY_IDS) {
      const gate = sideGardenGate(id); nav.blockRect(gate.x0, gate.z0, gate.x1, gate.z1);
    }
    nav.finishRebuild(); return nav;
  }
  it('keeps the two pool walks wider than the nav body, with the decorative pots inside beds', () => {
    const pool = SIDE_COURTYARD.pool, planting = SIDE_COURTYARD.planting;
    assert.ok(pool.x - pool.width / 2 - 9.5 >= .9 - 1e-9);
    assert.ok(planting.x - planting.width / 2 - (pool.x + pool.width / 2) >= 1);
    const nav = gardenNav();
    for (const x of [SIDE_COURTYARD.innerWalkX, SIDE_COURTYARD.outerWalkX]) {
      for (let z = -16.3; z <= 8.2; z += .1) assert.equal(nav.solidBlocked(x, z, .34), false, 'continuous east walk at ' + x + ',' + z);
    }
  });
  it('routes from each purchase square to both faces of every garden section and safely back to the cafe', () => {
    const nav = gardenNav(); let routes = 0;
    for (const id of SIDE_ACTIVITY_IDS) {
      const layout = SIDE_GARDEN_LAYOUT[id];
      const points = [layout.purchase, layout.service,
        ...SIDE_GARDEN_SECTIONS.flatMap(z => (id === 'garden' ? [-10, -12] : [SIDE_COURTYARD.innerWalkX, SIDE_COURTYARD.outerWalkX]).map(x => ({ x, z })))];
      for (let from = 0; from < points.length; from++) for (let to = 0; to < points.length; to++) {
        if (from === to) continue;
        const a = points[from], b = points[to], path: number[] = [];
        assert.equal(nav.solidBlocked(a.x, a.z, .34), false);
        assert.equal(nav.findPath(a.x, a.z, b.x, b.z, path), true, id + ' route ' + from + ' to ' + to);
        assert.deepEqual(path.slice(-2), [b.x, b.z], 'must reach the actual target, not a substitute cell');
        let x = a.x, z = a.z;
        for (let index = 0; index < path.length; index += 2) {
          const tx = path[index], tz = path[index + 1], n = Math.max(1, Math.ceil(Math.hypot(tx - x, tz - z) / .025));
          for (let step = 1; step <= n; step++) assert.equal(nav.solidBlocked(x + (tx - x) * step / n, z + (tz - z) * step / n, .34), false, id + ' full body route clearance');
          x = tx; z = tz;
        }
        routes++;
      }
    }
    assert.equal(routes, 112);
  });
  it('keeps locked side gates physical while opening them restores a route in both directions', () => {
    const locked = gardenNav(true), open = gardenNav();
    for (const id of SIDE_ACTIVITY_IDS) {
      const layout = SIDE_GARDEN_LAYOUT[id];
      const from = { x: layout.sign * 8, z: -8.6 }, to = { x: layout.sign * 10, z: -8.6 };
      const path: number[] = [];
      assert.equal(locked.interactionLineClear(from.x, from.z, to.x, to.z), false);
      assert.equal(open.findPath(from.x, from.z, to.x, to.z, path), true);
      assert.deepEqual(path.slice(-2), [to.x, to.z]);
      assert.equal(open.findPath(to.x, to.z, from.x, from.z, path), true);
      assert.deepEqual(path.slice(-2), [from.x, from.z]);
    }
  });
});
