import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";
const before = process.argv.includes("--before"),
  out = ".devshots/service-balance-2026-09-07/" + (before ? "before" : "after");
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  optimizeDeps: { noDiscovery: true },
  server: {
    host: "127.0.0.1",
    port: 5351,
    strictPort: true,
    hmr: false,
    open: false,
  },
});
let browser;
const errors = [];
try {
  await server.listen();
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5351/?characters=quaternius", {
    waitUntil: "commit",
    timeout: 90000,
  });
  await page.waitForFunction(() => !!window.__fincan, undefined, {
    timeout: 90000,
  });
  await page.locator("#boot-screen").waitFor({ state: "detached" });
  const report = await page.evaluate(async (before) => {
    const g = window.__fincan;
    g.stop();
    const p = g.player;
    const { BALANCE } = await import("/src/data/balance.ts");
    const { Order } = await import("/src/sim/Orders.ts");
    const { Customer } = await import("/src/entities/Customer.ts");
    const { CUSTOMER_ARCHETYPES } = await import("/src/data/customers.ts");
    g.state.tutorialStep = 99;
    g.ui.setTutorial(null);
    const result = {
      branches: {},
      money: null,
      admission: null,
      pacing: null,
      cycles: [],
      bins: [],
      walls: [],
      queue: null,
      mixedShelf: null,
    };
    for (const location of ["kose", "sahil"]) {
      if (location === "sahil") {
        g.state.unlockedLocations.add("sahil");
        g.state.unlockedZones.add("sahil:p1");
        g.switchLocation("sahil");
        g.stop();
      }
      const w = g.world;
      for (const zone of w.loc.zones)
        if (!w.zoneUnlocked(zone.id)) w.unlockZone(zone.id);
      g.ui.endCelebrate();
      w.assistPlayer = p;
      for (const t of w.tables) {
        t.seatedGuests.length = 0;
        t.seatTaken.fill(false);
        t.dishes = 0;
        t.soil = 0;
        t.cleanValue = 0;
      }
      const points = [],
        failures = [];
      for (const t of w.tables.filter((t) => !t.locked)) {
        for (let angle = 0; angle < 360; angle += 15) {
          const a = (angle * Math.PI) / 180,
            x = t.x + Math.sin(a) * 1.85,
            z = t.z + Math.cos(a) * 1.85;
          if (
            w.nav.solidBlocked(x, z, 0.32) ||
            !w.nav.maskHas(w.reachMask, x, z, 0)
          )
            continue;
          const point = { x: 0, z: 0 };
          if (t.playerPoint) {
            t.playerPoint(x, z, point);
            if (!w.nav.interactionLineClear(x, z, point.x, point.z)) continue;
          }
          t.seatedGuests.push({
            needsItem: (item) => item === "cay",
            receiveItem: () => true,
          });
          const serve =
            w.nearestAccepting(x, z, BALANCE.player.interactRadius, "cay", null)
              ?.id === t.id;
          t.seatedGuests.length = 0;
          t.dishes = 1;
          t.soil = 0.6;
          const clean =
            w.nearestDirtyTable(x, z, BALANCE.player.interactRadius)?.id ===
            t.id;
          t.dishes = 0;
          t.soil = 0;
          points.push({ table: t.id, angle, serve, clean });
          if (!serve || !clean)
            failures.push({ table: t.id, angle, x, z, serve, clean });
        }
      }
      if (!before) {
        w.vfx = null;
        for (const c of w.customers) c.dispose();
        w.customers.length = 0;
        for (const co of w.counters) {
          co.queue.length = 0;
          co.cash = co.cashValue = 0;
        }
        for (const m of w.machines) m.output = 0;
        const co = w.counters.find((c) => !c.locked),
          bin = w.bins.find((b) => !b.locked),
          bp = { x: 0, z: 0 };
        bin.servicePoint(bp);
        const reset = (x, z) => {
          p.dropAll();
          p.noTakeFrom = p.noDropTo = null;
          p.hasVacuum = false;
          p.planarSpeed = 0;
          p.handAction.reset();
          p.setPosition(x, z);
        };
        const stepUntil = (predicate) => {
          for (let n = 0; n < 180 && predicate(); n++)
            w.updateStationInteraction(1 / 30, p);
        };
        for (const sample of points.filter((p) => p.angle % 90 === 0)) {
          const table = w.byId.get(sample.table),
            a = (sample.angle * Math.PI) / 180,
            x = table.x + Math.sin(a) * 1.85,
            z = table.z + Math.cos(a) * 1.85;
          const c = new Customer(
            CUSTOMER_ARCHETYPES[0],
            "edge-" + location + "-" + result.cycles.length,
          );
          c.dineIn = true;
          c.table = table;
          c.counter = co;
          c.state = "seated";
          c.order = new Order([{ item: "cay", qty: 2, served: 0 }]);
          c.patience = c.maxPatience = 999;
          table.takeSeat(0);
          c.seatIndex = 0;
          table.seatedGuests.push(c);
          w.customers.push(c);
          w.root.add(c.char.root);
          w.quoteOrder(c);
          co.cash = co.cashValue = 0;
          const wallet = g.state.money,
            quote = c.quotedTotal;
          reset(x, z);
          p.give("cay");
          stepUntil(() => p.hasItem("cay"));
          const partial = {
            qty: c.order.servedQty,
            paid: c.paid,
            cash: co.cash,
            value: co.cashValue,
            wallet: g.state.money - wallet,
          };
          p.give("cay");
          stepUntil(() => p.hasItem("cay"));
          const sale = {
            qty: c.order.servedQty,
            paid: c.paid,
            cash: co.cash,
            value: co.cashValue,
            wallet: g.state.money - wallet,
          };
          // A further item cannot be sold twice to the completed order.
          const duplicate = table.accept("cay");
          table.seatedGuests.length = 0;
          table.seatTaken.fill(false);
          w.customers.splice(w.customers.indexOf(c), 1);
          c.dispose();
          table.dishes = 2;
          table.soil = table.cleanStartSoil = 0.65;
          table.cleanValue = 0;
          const dishesBefore = g.state.stats.cleaned;
          reset(x, z);
          stepUntil(() => table.dishes > 0);
          const held = p.carryCount,
            dishesTaken = g.state.stats.cleaned - dishesBefore;
          p.setPosition(bp.x, bp.z);
          stepUntil(() => p.hasItem("bulasik"));
          const disposed = p.carryCount === 0;
          p.setPosition(x, z);
          const cleaned = g.state.stats.tablesCleaned;
          stepUntil(() => table.isDirty);
          const completed = g.state.stats.tablesCleaned - cleaned;
          result.cycles.push({
            location,
            table: table.id,
            angle: sample.angle,
            quote,
            partial,
            sale,
            duplicate,
            held,
            dishesTaken,
            disposed,
            completed,
            dirty: table.isDirty,
          });
          co.cash = co.cashValue = 0;
        }
        for (const bin of w.bins.filter((b) => !b.locked))
          for (let angle = 0; angle < 360; angle += 45) {
            const a = (angle * Math.PI) / 180,
              x = bin.x + Math.sin(a) * 1.45,
              z = bin.z + Math.cos(a) * 1.45;
            if (
              w.nav.solidBlocked(x, z, 0.32) ||
              !w.nav.maskHas(w.reachMask, x, z, 0)
            )
              continue;
            const pt = { x: 0, z: 0 };
            bin.playerPoint(x, z, pt);
            if (!w.nav.interactionLineClear(x, z, pt.x, pt.z)) continue;
            reset(x, z);
            p.give("bulasik");
            stepUntil(() => p.hasItem("bulasik"));
            result.bins.push({
              location,
              bin: bin.id,
              angle,
              disposed: p.carryCount === 0,
            });
          }
        // Regression: arrival just outside the old bin point must remain actionable.
        bin.servicePoint(bp);
        const dx = bp.x - bin.x,
          dz = bp.z - bin.z,
          len = Math.hypot(dx, dz);
        reset(bp.x + (dx / len) * 0.3, bp.z + (dz / len) * 0.3);
        p.give("bulasik");
        stepUntil(() => p.hasItem("bulasik"));
        result.bins.push({
          location,
          bin: bin.id,
          angle: "arrival-tolerance",
          disposed: p.carryCount === 0,
        });
        const t = w.tables.find((t) => !t.locked),
          wx = t.x + 1.5,
          wz = t.z;
        w.nav.addSolid(wx - 0.015, wz - 0.6, wx + 0.015, wz + 0.6);
        t.dishes = 1;
        t.soil = 0.6;
        reset(t.x + 1.85, t.z);
        stepUntil(() => !p.hasItem("bulasik"));
        result.walls.push({ location, held: p.carryCount, dishes: t.dishes });
        w.rebuildNav();
        const contact = { x: 0, z: 0 },
          standing = { x: 0, z: 0 };
        t.playerPoint(t.x + 1.85, t.z, contact, 0.01);
        t.playerPoint(t.x + 1.85, t.z, standing);
        const nearWall = (contact.x + standing.x) / 2;
        w.nav.addSolid(nearWall - 0.01, t.z - 0.6, nearWall + 0.01, t.z + 0.6);
        reset(t.x + 1.85, t.z);
        stepUntil(() => !p.hasItem("bulasik"));
        result.walls.push({
          location,
          held: p.carryCount,
          dishes: t.dishes,
          kind: "between-contact-and-standing",
        });
        t.dishes = 0;
        t.soil = 0;
        w.rebuildNav();
      }
      result.branches[location] = {
        samples: points.length,
        served: points.filter((p) => p.serve).length,
        cleaned: points.filter((p) => p.clean).length,
        failures,
        layout: w.validateLayout(),
      };
    }
    g.switchLocation("kose");
    g.stop();
    const w = g.world;
    w.assistPlayer = p;
    w.vfx = null;
    for (const c of w.customers) c.dispose();
    w.customers.length = 0;
    for (const co of w.counters) {
      co.queue.length = 0;
      co.cash = 0;
      co.cashValue = 0;
    }
    const co = w.counters[0],
      source = w.machines.find((m) => !m.locked && m.def.item === "cay"),
      pt = { x: 0, z: 0 };
    co.servicePoint(pt);
    p.setPosition(pt.x, pt.z);
    p.dropAll();
    p.hasVacuum = false;
    p.planarSpeed = 0;
    p.noTakeFrom = null;
    p.noDropTo = null;
    co.cash = 6;
    co.cashValue = 600;
    source.output = 10;
    const oldNearest = w.nearestWithOutput,
      oldTake = source.takeOutput,
      oldPoint = source.servicePoint;
    const sequence = [];
    let taken = 0;
    w.nearestWithOutput = () => source;
    source.servicePoint = (out) => {
      out.x = pt.x;
      out.z = pt.z;
    };
    source.takeOutput = () => {
      taken++;
      sequence.push("product");
      return oldTake.call(source);
    };
    const initial = g.state.money;
    for (let n = 0; n < 90; n++) {
      const cash = co.cash;
      w.updateStationInteraction(1 / 30, p);
      if (co.cash < cash) sequence.push("cash");
    }
    result.money = {
      collected: g.state.money - initial,
      cashLeft: co.cash,
      productsTaken: taken,
      sequence,
    };
    w.nearestWithOutput = oldNearest;
    source.takeOutput = oldTake;
    source.servicePoint = oldPoint;
    p.dropAll();
    // A cafe whose tills cannot accept payments must not invite another queue.
    for (const c of w.counters) {
      c.cash = BALANCE.money.counterCap;
      c.cashValue = 1000;
      c.queue.length = 0;
    }
    w.spawnTimer = 0;
    const customerCount = w.customers.length;
    w.spawnCustomers(1, {
      spawnMult: 1,
      valueMult: 1,
      patienceMult: 1,
      tipMult: 1,
    });
    result.admission = {
      spawnedWithFullTills: w.customers.length - customerCount,
    };
    if (!before) {
      for (const c of w.counters) {
        c.cash = c.cashValue = 0;
        c.queue.length = 0;
      }
      const counters = w.counters.filter((c) => !c.locked),
        unattended = counters[0],
        ready = counters[1];
      unattended.queue.push(...Array.from({ length: 3 }, () => ({})));
      ready.queue.push(...Array.from({ length: 4 }, () => ({})));
      const original = w.cashierReady;
      w.cashierReady = (c) => c === ready;
      const guest = new Customer(CUSTOMER_ARCHETYPES[0], "queue-room");
      w.sendToCounter(guest);
      result.queue = {
        selected: guest.counter.id,
        expected: ready.id,
        length: ready.queue.length,
      };
      w.cashierReady = original;
      for (const c of counters) c.queue.length = 0;
      guest.dispose();
      const spawn = w.spawnCustomer,
        range = w.rng.range;
      w.spawnCustomer = () => null;
      w.rng.range = (a, b) => (a + b) / 2;
      const interval = () => {
        w.spawnTimer = 0;
        w.spawnCustomers(1, {
          spawnMult: 1,
          valueMult: 1,
          patienceMult: 1,
          tipMult: 1,
        });
        return w.spawnTimer;
      };
      const light = interval();
      const pending = new Customer(CUSTOMER_ARCHETYPES[0], "pressure");
      pending.dineIn = true;
      pending.state = "seated";
      pending.order = new Order([{ item: "cay", qty: 12, served: 0 }]);
      pending.maxPatience = 100;
      pending.patience = 20;
      w.customers.push(pending);
      const busy = interval();
      w.customers.splice(w.customers.indexOf(pending), 1);
      pending.dispose();
      w.spawnCustomer = spawn;
      w.rng.range = range;
      result.pacing = { light, busy, multiplier: busy / light };
      const shelf = w.pickups.find((s) => !s.locked);
      shelf.contents = ["latte", "cay"];
      shelf.output = 2;
      p.give("cay");
      const t = w.tables.find((t) => !t.locked);
      t.seatedGuests.push({
        order: new Order([
          { item: "latte", qty: 1, served: 0 },
          { item: "cay", qty: 2, served: 0 },
        ]),
      });
      const expected = w.peekWanted(shelf, new Set(["latte", "cay"])),
        taken = w.takeWanted(shelf);
      p.give("cay");
      shelf.contents = ["cay", "latte"];
      shelf.output = 2;
      const nextBatch = w.peekWanted(shelf, new Set(["cay", "latte"]));
      p.give("latte");
      const covered = w.peekWanted(shelf, new Set(["cay", "latte"]));
      t.seatedGuests.length = 0;
      p.dropAll();
      const getSide = w.sideActivities.get;
      w.selectedSideActivity = "test";
      w.sideActivities.get = () => ({
        level: 1,
        lines: [{ item: "latte", quantity: 2, delivered: 0 }],
      });
      const selected = w.peekWanted(shelf, new Set(["cay"]));
      w.sideActivities.get = getSide;
      w.selectedSideActivity = null;
      result.mixedShelf = { expected, taken, selected, nextBatch, covered };
      p.dropAll();
    }
    return result;
  }, before);
  await writeFile(
    out + "/results.json",
    JSON.stringify({ report, errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      branches: Object.fromEntries(
        Object.entries(report.branches).map(([k, v]) => [
          k,
          {
            samples: v.samples,
            served: v.served,
            cleaned: v.cleaned,
            misses: v.failures.length,
          },
        ]),
      ),
      money: report.money,
      admission: report.admission,
      pacing: report.pacing,
      cycles: report.cycles.length,
      bins: report.bins.length,
      walls: report.walls,
      queue: report.queue,
      mixedShelf: report.mixedShelf,
    }),
  );
  if (!before) {
    for (const branch of Object.values(report.branches)) {
      assert.equal(
        branch.failures.length,
        0,
        JSON.stringify(branch.failures.slice(0, 6)),
      );
      assert.deepEqual(branch.layout, []);
    }
    for (const row of report.cycles) {
      assert.equal(row.partial.qty, 1, JSON.stringify(row));
      assert.equal(row.partial.cash, 1);
      assert.ok(row.partial.paid < row.quote);
      assert.equal(row.partial.value, row.partial.paid);
      assert.equal(row.partial.wallet, 0);
      assert.equal(row.sale.qty, 2);
      assert.equal(row.sale.cash, 2);
      assert.equal(row.sale.paid, row.quote);
      assert.equal(row.sale.value, row.quote);
      assert.equal(row.sale.wallet, 0);
      assert.equal(row.duplicate, false);
      assert.equal(row.dishesTaken, 2, JSON.stringify(row));
      assert.ok(row.held > 0 && row.held <= 2, JSON.stringify(row));
      assert.equal(row.disposed, true);
      assert.equal(row.completed, 1);
      assert.equal(row.dirty, false);
    }
    assert.ok(report.cycles.length >= 60);
    assert.ok(report.bins.length >= 10);
    for (const row of report.bins)
      assert.equal(row.disposed, true, JSON.stringify(row));
    for (const row of report.walls) {
      assert.equal(row.held, 0);
      assert.equal(row.dishes, 1);
    }
    assert.ok(report.pacing.light > 0);
    assert.ok(
      report.pacing.multiplier > 1.5 && report.pacing.multiplier <= 2.5,
    );
    assert.equal(report.queue.selected, report.queue.expected);
    assert.equal(report.queue.length, 5);
    assert.deepEqual(report.mixedShelf, {
      expected: "cay",
      taken: "cay",
      selected: "latte",
      nextBatch: "latte",
      covered: null,
    });
    assert.equal(report.money.sequence[0], "cash");
    assert.ok(report.money.sequence.includes("product"));
    assert.equal(
      report.money.sequence.lastIndexOf("cash") <
        report.money.sequence.indexOf("product"),
      true,
    );
    assert.equal(report.money.collected, 600);
    assert.equal(report.money.cashLeft, 0);
    assert.equal(report.admission.spawnedWithFullTills, 0);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await server.close();
}
