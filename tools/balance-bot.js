/**
 * DENGE BOTU — ekonomi ölçümü için otomatik oyuncu.
 *
 * Ne yapar: oyunu gerçek zamandan bağımsız, sabit adımla (30 tik/sn)
 * ileri sarar; rehber okunun (guideCache) gösterdiği hedefe yürür, parası
 * yetiyorsa sıradaki bölge pedine gidip üstünde bekler, hedef zinciri
 * personel/yükseltme istediğinde satın alır. Her bölge açılışını, personel
 * alımını ve 30 saniyelik gelir örneklerini zaman damgasıyla kaydeder.
 *
 * Neden var: denge bu projede göz kararıyla değil ölçümle kabul edilir
 * (bkz. README "botla oynanan ölçüm"). Bölge fiyatı/ödül değişikliğinden
 * sonra bu bot koşulmadan denge değişikliği KABUL EDİLMEZ.
 *
 * Kullanım (vite dev + tarayıcı konsolu):
 *   const src = await (await fetch('/@fs/' + KÖK + '/tools/balance-bot.js')).text();
 *   eval(src); __runBalanceBot({ minutes: 45 });
 *   // bitince: __botReport (özet) ve __botRows (ham satırlar)
 *
 * Not: render kapatılır (scene3d.render no-op) — yalnız simülasyon koşar;
 * Ölçüm yalnız yeni ve yalıtılmış tarayıcı oturumunda çalıştırılır.
 * Bot kayıtları silmez; tools/acceptance.mjs geçici tarayıcıyı yönetir.
 */

/* eslint-disable no-console */
function __runBalanceBot(opts = {}) {
  const minutes = opts.minutes ?? 45;
  /**
   * SENKRON MOD. Varsayılan (parçalı) mod `setTimeout` ile ilerler ve
   * tarayıcı sekmesi ARKA PLANA düştüğünde saniyede bire kısılır: 50
   * dakikalık ölçüm saatlerce sürüyor, "takıldı" sanılıyordu. `sync: true`
   * her şeyi tek çağrıda döndürür (50 dk ≈ 10 sn CPU) — ölçüm sekmenin
   * görünürlüğünden bağımsız olur. Tek maliyeti: o sırada sayfa donar.
   */
  const sync = opts.sync === true;
  const policy = opts.policy ?? 'guide';
  if (!['guide', 'investor', 'cleaner'].includes(policy)) throw new Error('Unknown bot policy: ' + policy);
  const investmentFactor = policy === 'investor' ? 1.4 : policy === 'cleaner' ? 2.5 : 4;
  const g = window.__fincan;
  if (!g) throw new Error('window.__fincan yok — oyun açılmadı mı?');
  g.telemetry?.setTestContext({participant:'bot',condition:'release-flow-v2',label:'balance-bot-' + policy});

  const DT = 1 / 30;
  const rows = [];
  const report = {
    minutes,
    policy,
    simulation: 'accelerated-real-actions',
    locationTimes: {},
    upgradeTimes: [],
    zoneTimes: {},
    staffTimes: {},
    goalTimes: {},
    incomeSamples: [],
    gaps: [],
    inactivitySamples: [],
    done: false,
  };
  window.__botRows = rows;
  window.__botReport = report;

  // --- temiz başlangıç ---
  if (!opts.resume && (g.state.stats.orders > 0 || g.state.totalEarned > 0)) throw new Error('Run the balance bot in a fresh, isolated browser context.');
  const noop = () => undefined;
  const origRender = g.scene3d.render.bind(g.scene3d);
  g.scene3d.render = noop;
  const botMove = { x: 0, y: 0, mag: 0, active: false };
  const origInputUpdate = g.input.update.bind(g.input);
  g.input.update = () => Object.assign(g.input.move, botMove);
  g.stop(); // rAF döngüsü bizim pompayla yarışmasın

  let t = 0; // simülasyon saniyesi
  let lastMoneySample = 0;
  let lastBuyCheck = 0;
  let lastPurchaseAt = 0;
  const seenZones = new Set();
  const tableWasDirty = new Map();
  let tableCleanups = 0;
  let lastActivityAt = 0;
  let lastActivity = '';
  let longestInactivity = 0;
  let lastIdleSample = -99;
  const seenStaff = new Map();
  const seenUpgrades = new Map();
  const seenLocations = new Set(['kose']);
  let careUntil = 0;
  let nextCare = 120;
  let lastGoalFocus = -99;
  let lastGoal = -1;

  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /**
   * A* TAKİPLİ yürüyüş. Düz çizgi steering bar tezgâhına takılıp kalıyordu
   * (ölçüldü: bot 4 dakika tezgâhın mutfak yüzüne itip durdu, 106 müşteri
   * küstü). Oyunun kendi nav ızgarası kullanılır; yol düz dizidir
   * [x0,z0,x1,z1,...], ara noktada yavaşlanır ve 0,18 birim yaklaşınca sonraki parçaya geçilir.
   */
  const nav = { path: [], idx: 0, tx: NaN, tz: NaN, at: -9 };

  function steerTo(x, z, stopDist) {
    const p = g.player;
    const d0 = Math.hypot(x - p.x, z - p.z);
    if (d0 < stopDist) {
      botMove.active = false;
      botMove.mag = 0;
      botMove.x = 0;
      botMove.y = 0;
      return true;
    }
    const moved = Math.hypot(x - nav.tx, z - nav.tz) > 0.8;
    if (moved || t - nav.at > 1.0) {
      nav.path.length = 0;
      nav.idx = 0;
      nav.tx = x;
      nav.tz = z;
      nav.at = t;
      g.world.nav.findPath(p.x, p.z, x, z, nav.path);
    }
    let wx = x;
    let wz = z;
    while (nav.idx * 2 < nav.path.length) {
      wx = nav.path[nav.idx * 2];
      wz = nav.path[nav.idx * 2 + 1];
      if (Math.hypot(wx - p.x, wz - p.z) < 0.18) {
        nav.idx++;
        continue;
      }
      break;
    }
    if (nav.idx * 2 >= nav.path.length) {
      wx = x;
      wz = z;
    }
    const dx = wx - p.x;
    const dz = wz - p.z;
    const d = Math.hypot(dx, dz) || 1;
    // Kamera yaw 0 (portre kilidi): ekran x = dünya x, ekran y = -dünya z.
    botMove.x = dx / d;
    botMove.y = -dz / d;
    // The player has inertia. Slow before corners instead of cutting past
    // a valid path at full speed and repeatedly steering into its obstacle.
    botMove.mag = Math.min(1, d / Math.max(0.35, p.speed * 0.22));
    botMove.active = true;
    return false;
  }

  /** Bir pedin KALAN bedeli (yarım ödeme kaydedilir, bkz. World.padPaid). */
  function remainingCost(z) {
    const paid = typeof g.world.padPaid === 'function' ? g.world.padPaid(z.id) : 0;
    return Math.max(0, z.cost - paid);
  }

  /** Parası hazır, gereksinimi açık, kilitli bölgeler (ucuz önce). */
  function affordablePads() {
    const w = g.world;
    const out = [];
    for (const z of w.loc.zones) {
      if (z.cost <= 0 || w.zoneUnlocked(z.id)) continue;
      if (z.requires && !w.zoneUnlocked(z.requires)) continue;
      out.push(z);
    }
    const goalZone = g.goals.current?.zone;
    out.sort((a, b) => Number(b.id === goalZone) - Number(a.id === goalZone)
      || Number(a.id.startsWith('z_')) - Number(b.id.startsWith('z_')) || remainingCost(a) - remainingCost(b));
    return out.filter((z) => g.state.money >= remainingCost(z));
  }

  /** Hedef zinciri + makul oyuncu politikası satın alımları. */
  function tryPurchases() {
    const st = g.state;
    const goal = g.goals.current;

    // Guide saves for the next reachable goal; investors may buy actual bottleneck relief.
    const reachable = g.world.loc.zones.filter(z => z.cost > 0 && !g.world.zoneUnlocked(z.id)
      && (!z.requires || g.world.zoneUnlocked(z.requires)) && !z.id.startsWith('z_'));
    const targetPad = reachable.find(z => z.id === goal?.zone);
    let reserve = targetPad ? remainingCost(targetPad)
      : reachable.length ? Math.min(...reachable.map(remainingCost)) : 0;
    if (goal?.kind === 'cash') reserve = goal.target;
    if (policy === 'investor' && goal?.kind !== 'cash') reserve *= 0.35;
    if (goal?.kind === 'location' && goal.location && g.buyLocation(goal.location)) {
      nav.at = -99; return;
    }
    const spare = () => st.money - reserve;

    if (goal?.kind === 'hire' && goal.role && st.canHire(goal.role)) st.hire(goal.role);
    if (goal?.kind === 'upgrade' && goal.upgrade && st.canBuyPlayerUpgrade(goal.upgrade)) {
      st.buyPlayerUpgrade(goal.upgrade);
    }

    // İstasyon yükseltmesi: hedef istiyorsa gevşek, yoksa temkinli eşik.
    const wantStation = goal?.kind === 'stationLevel';
    let cheapest = null;
    for (const s of g.world.stations) {
      if (s.locked) continue;
      if (s.canUpgradeSpeed && s.speedUpgradeCost > 0) {
        if ((s.def.kind !== 'machine' || s.output < s.outputCap) && (!cheapest || s.speedUpgradeCost < cheapest.cost)) {
          cheapest = { st: s, kind: 'speed', cost: s.speedUpgradeCost };
        }
      }
      if (s.canUpgradeCap && s.capUpgradeCost > 0) {
        if ((s.def.kind !== 'table' || g.world.seatsUsed >= g.world.seatsTotal * 0.7) && (!cheapest || s.capUpgradeCost < cheapest.cost)) {
          cheapest = { st: s, kind: 'cap', cost: s.capUpgradeCost };
        }
      }
    }
    if (cheapest && (wantStation ? st.money >= cheapest.cost * 1.1 : spare() >= cheapest.cost * investmentFactor)) {
      g.buyStationUpgrade(cheapest.st.id, cheapest.kind);
    }

    const CAPS = { waiter: 4, busser: 4, cashier: 2, barista: 2 };
    const dirtyTables = g.world.tables.filter(table => !table.locked && table.isDirty).length;
    for (const role of Object.keys(CAPS)) {
      if (st.staffCount[role] >= CAPS[role] || !st.canHire(role)) continue;
      // A table busser never fixes floor dirt. Do not buy one for spills.
      const urgent = role === 'busser' && dirtyTables >= 2;
      if (urgent ? st.money >= st.hireCostFor(role) : spare() >= st.hireCostFor(role) * investmentFactor) st.hire(role);
    }
    for (const id of ['capacity', 'hands', 'speed', 'charm']) {
      if (st.upgrades[id] < (policy === 'investor' ? 10 : 6) && st.canBuyPlayerUpgrade(id)
        && spare() >= st.playerUpgradeCost(id) * investmentFactor) st.buyPlayerUpgrade(id);
    }
    for (const role of ['waiter', 'cashier', 'busser', 'barista']) {
      if (st.staffCount[role] > 0 && st.staffLevel[role] < (policy === 'investor' ? 8 : 4)
        && st.canLevelStaff(role) && spare() >= st.staffLevelCostFor(role) * investmentFactor) st.levelStaff(role);
    }

  }

  function recordEvents() {
    const st = g.state;
    const activity = [st.stats.orders, st.stats.served, st.stats.cleaned, st.stats.mopped,
      st.totalEarned, st.unlockedZones.size].join(':');
    if (activity !== lastActivity) {
      lastActivity = activity;
      lastActivityAt = t;
    } else longestInactivity = Math.max(longestInactivity, t - lastActivityAt);
    if(t-lastActivityAt>90 && t-lastIdleSample>60){
      lastIdleSample=t;const w=g.world,p=g.player,point={x:0,z:0};
      report.inactivitySamples.push({t:Math.round(t),idle:Math.round(t-lastActivityAt),guide:w.guideOverride??w.guideCache,steer:{x:nav.tx,z:nav.tz},position:{x:p.x,z:p.z},carry:[...p.slots],vacuum:p.hasVacuum,speed:p.planarSpeed,interaction:p.interactionKind,arm:{key:w.armKey,t:w.armT},hands:{...p.handAction},
       tables:w.tables.filter(t=>!t.locked&&t.seatedGuests.length).map(t=>({id:t.id,guests:t.seatedGuests.map(c=>({order:c.order?.lines,eating:c.eating,waiting:c.waiting})),reachable:w.playerAccess(t,p.x,p.z,1.35,point),point:{...point},accept:p.slots.map(item=>[item,t.canAccept(item)])}))});
    }
    for (const z of g.world.loc.zones) {
      if (z.cost > 0 && g.world.zoneUnlocked(z.id) && !seenZones.has(z.id)) {
        seenZones.add(z.id);
        report.zoneTimes[z.id] = mmss(t);
        rows.push({ t: Math.round(t), ev: 'bölge', id: z.id, name: z.name, para: Math.round(st.money) });
        if (t - lastPurchaseAt > 120) {
          report.gaps.push({ from: mmss(lastPurchaseAt), to: mmss(t), sn: Math.round(t - lastPurchaseAt) });
        }
        lastPurchaseAt = t;
      }
    }
    for (const role of ['waiter', 'cashier', 'barista', 'busser']) {
      const key = st.activeLocation + ':' + role;
      if (st.staffCount[role] > (seenStaff.get(key) ?? 0)) {
        seenStaff.set(key, st.staffCount[role]);
        report.staffTimes[key + st.staffCount[role]] = mmss(t);
        rows.push({ t: Math.round(t), ev: 'personel', location: st.activeLocation, id: role, n: st.staffCount[role] });
        lastPurchaseAt = t;
      }
    }
    for (const [key, level] of Object.entries(st.upgrades)) {
      if (level > (seenUpgrades.get(key) ?? 0)) {
        seenUpgrades.set(key, level);
        report.upgradeTimes.push({ t: Math.round(t), id: key, level });
        lastPurchaseAt = t;
      }
    }
    for (const id of st.unlockedLocations) if (!seenLocations.has(id)) {
      seenLocations.add(id); report.locationTimes[id] = mmss(t); lastPurchaseAt = t;
    }
    if (st.goalIndex !== lastGoal) {
      lastGoal = st.goalIndex;
      report.goalTimes[`g${String(st.goalIndex).padStart(2, '0')}`] = mmss(t);
    }
  }

  function botThink() {
    if (g.tutorial.step === 0) {
      steerTo(g.world.loc.playerStart.x + 3.5, g.world.loc.playerStart.z, 0.25);
      return;
    }
    // 1. rehber oku (öğretici geçersiz kılması dahil)
    let target = g.world.guideOverride ?? g.world.guideCache;
    if (g.tutorial.finished && policy !== 'guide') {
      if (t >= nextCare) { careUntil = t + (policy === 'cleaner' ? 35 : 15); nextCare = t + (policy === 'cleaner' ? 90 : 180); }
      if (t < careUntil && g.player.carryCount === 0 && !g.player.hasVacuum) {
        const spill = g.world.spills.nearest(g.player.x, g.player.z, 999);
        if (spill) target = {x: spill.x, z: spill.z};
      }
    }
    if (g.tutorial.finished && t - lastGoalFocus > 30 && g.goals.current?.kind === 'catchDasher') {
      g.world.focusCurrentGoal(); lastGoalFocus = t;
    }
    // 2. parası hazır bir ped varsa ped kazanır (rehber pedleri göstermez)
    const pads = affordablePads();
    if (pads.length > 0 && !g.player.hasVacuum) {
      steerTo(pads[0].padX, pads[0].padZ, 0.25);
      return;
    }
    if (target) {
      steerTo(target.x, target.z, 0.3);
      return;
    }
    botMove.active = false;
    botMove.mag = 0;
  }

  const totalTicks = Math.round((minutes * 60) / DT);
  let done = 0;
  let checkpoint = false;
  const t0 = performance.now();

  function pump() {
    /**
     * Kare başına iş bütçesi. 40 ms idi: sekme ARKA PLANA düştüğünde
     * tarayıcı `setTimeout`'u saniyede bire kısıyor ve 50 dakikalık ölçüm
     * saatler sürüyordu. Senkron modda bütçe yok, hepsi tek seferde koşar.
     */
    const budgetEnd = sync ? Infinity : performance.now() + 250;
    while (done < totalTicks && !checkpoint && performance.now() < budgetEnd) {
      /**
       * HATA YAKALA VE BİLDİR. Try/catch yokken `g.tick` içinde atılan bir
       * istisna pompayı sessizce öldürüyor, `done` hiç true olmuyor ve
       * ölçüm "sonsuza kadar sürüyor" gibi görünüyordu — hatayı bulmak
       * yerine bekliyorduk.
       */
      try {
        botThink();
        g.tick(DT);
        for (const table of g.world.tables) {
          if (tableWasDirty.get(table.id) && !table.isDirty) tableCleanups++;
          tableWasDirty.set(table.id, table.isDirty);
        }
      } catch (err) {
        report.error = String(err && err.stack ? err.stack : err);
        report.errorAt = mmss(t);
        report.done = true;
        console.error('[bot] tick hatasi', err);
        g.scene3d.render = origRender;
        g.input.update = origInputUpdate;
        return;
      }
      t += DT;
      done++;
      if(Number.isInteger(opts.untilTutorialStep) && g.tutorial.step>=opts.untilTutorialStep)checkpoint=true;
      if(Number.isInteger(opts.untilGoal) && g.state.goalIndex>=opts.untilGoal)checkpoint=true;
      if (t - lastBuyCheck >= 1) {
        lastBuyCheck = t;
        tryPurchases();
        recordEvents();
      }
      if (t - lastMoneySample >= 30) {
        lastMoneySample = t;
        report.incomeSamples.push({ t: mmss(t), para: Math.round(g.state.money), toplam: Math.round(g.state.totalEarned), revenue: Math.round(g.state.revenueEarned), goal: g.state.goalIndex, hygiene: Math.round(g.world.hygiene), dirtyTables: g.world.dirtyTableCount, spills: g.world.spills.count, heavyFloor: g.world.grime.heavyCoverage, hygieneLoad: g.world.hygieneLoad, recoveries: g.world.staffRecovery.count });
      }
    }
    if (done < totalTicks && !checkpoint) {
      if (!sync) setTimeout(pump, 0);
      return;
    }
    // --- bitiş: gerçek döngüyü ve girdiyi geri ver ---
    g.scene3d.render = origRender;
    g.input.update = origInputUpdate;
    report.done = true;
    report.wallSeconds = Math.round((performance.now() - t0) / 1000);
    report.trailingPurchaseGap = Math.round(t - lastPurchaseAt);
    report.activeLocation = g.state.activeLocation;
    report.playerLevels = {...g.state.upgrades};
    report.staffLevels = {...g.state.staffLevel};
    report.finalMoney = Math.round(g.state.money);
    report.finalEarned = Math.round(g.state.totalEarned);
    report.angry = g.state.stats.angry;
    report.served = g.state.stats.served;
    report.tutorialComplete = g.tutorial.finished;
    report.cleaned = g.state.stats.cleaned;
    report.mopped = g.state.stats.mopped;
    report.tableCleanups = tableCleanups;
    report.longestInactivity = Math.round(longestInactivity);
    report.goalIndex = g.state.goalIndex;
    report.hygiene = g.world.hygiene;
    report.hygieneLoad = g.world.hygieneLoad;
    report.staffRecovery = g.world.staffRecovery;
    report.dirtyTables = g.world.tables.filter(t => !t.locked && t.isDirty).length;
    report.lastTarget = g.world.guideOverride ?? g.world.guideCache;
    report.lastPosition = {x:g.player.x,z:g.player.z};
    report.lastSteeringTarget = {x:nav.tx,z:nav.tz};
    report.hasVacuum = g.player.hasVacuum;
    report.carried = [...g.player.slots];
    report.lock = {take:g.player.noTakeFrom,drop:g.player.noDropTo};
    report.customerStates = g.world.customers.map(c=>({state:c.state,wanted:c.order?.nextWanted(),table:c.table?.id}));
    // The harness owns its isolated context. Never erase user storage.
    console.log('[bot] bitti', report);
  }

  console.log(`[bot] ${minutes} dk simülasyon başladı…`);
  if (sync) {
    pump();
    return report;
  }
  setTimeout(pump, 0);
  return 'başladı — sonuç: window.__botReport';
}

window.__runBalanceBot = __runBalanceBot;
