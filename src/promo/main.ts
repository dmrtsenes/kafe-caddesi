/** Local art-direction film. Separate document, separate in-memory world. */
import { installCanvasCompat } from "../core/CanvasCompat";
import { CAFE_PRESENTATION } from '../data/cafePresentation';
import { TrafficAudit } from "./TrafficAudit";
import { composeFlagshipFrame } from "./FlagshipTitles";
import { composePremiumFrame } from "./PremiumTitles";
const W = 1080,
  H = 1920,
  FPS = 30,
  DURATION = 25;
const manual = new URLSearchParams(location.search).has("capture");
const query = new URLSearchParams(location.search);
const utopia = query.get("concept") === "utopia";
const premium = !query.has("concept") || query.get("concept") === "premium";
const imza = premium || query.get("concept") === "imza";
query.set("characters", "local");
history.replaceState(null, "", `${location.pathname}?${query}`);
let seed = 417;
Math.random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
installCanvasCompat();
async function boot() {
  if (!import.meta.env.DEV)
    throw new Error(
      "Bu tasarım provası yerel karakterlerini kullanır. promo:preview ile aç.",
    );
  const [
    T,
    { Scene3D },
    { World },
    { GameState },
    { Player },
    { Customer },
    { Order },
    { CUSTOMER_ARCHETYPES },
    { createVFX },
    { markDynamic },
    { loadPacks },
    { loadCharacterPack },
    { bus },
    { BALANCE },
    { installConceptLayout, dressConceptCafe },
  ] = await Promise.all([
    import("three"),
    import("../world/Scene3D"),
    import("../sim/World"),
    import("../sim/GameState"),
    import("../entities/Player"),
    import("../entities/Customer"),
    import("../sim/Orders"),
    import("../data/customers"),
    import("../world/VFX"),
    import("../world/layers"),
    import("../world/packs/library"),
    import("../chars"),
    import("../core/EventBus"),
    import("../data/balance"),
    premium
      ? import("./PremiumCafe")
      : imza
        ? import("./FlagshipCafe")
        : utopia
          ? import("./UtopiaCafe")
          : import("./ConceptCafe"),
  ]);
  await Promise.all([loadPacks(), loadCharacterPack()]);
  const loc = installConceptLayout();
  const canvas = document.querySelector<HTMLCanvasElement>("#stage")!,
    film = document.querySelector<HTMLCanvasElement>("#film")!,
    ctx = film.getContext("2d", { alpha: false })!;
  const scene = new Scene3D(canvas, "high", false);
  scene.renderer.setPixelRatio(1);
  scene.renderer.setSize(W, H, false);
  scene.camera.aspect = W / H;
  scene.camera.clearViewOffset();
  scene.camera.fov = 38;
  scene.camera.updateProjectionMatrix();
  scene.scene.background = new T.Color(
    imza ? 0x829893 : utopia ? 0xabc8cf : 0x8ebaa4,
  );
  scene.hemi.color.setHex(imza ? 0xf5f5ef : utopia ? 0xf3f6ff : 0xf5ffef);
  scene.hemi.groundColor.setHex(imza ? 0x9caea8 : utopia ? 0xa7bdc7 : 0x95b4a4);
  scene.hemi.intensity = imza ? 0.98 : 1.15;
  scene.sun.color.setHex(imza ? 0xffeed6 : utopia ? 0xfff0dc : 0xfff7e8);
  scene.sun.intensity = imza ? 2.15 : 2.35;
  scene.ambient.intensity = 0.12;
  scene.rim.intensity = 0.45;
  scene.renderer.toneMappingExposure = imza ? 1.04 : utopia ? 0.99 : 1.05;
  if (premium) scene.applyPalette({ ...loc.palette, ...CAFE_PRESENTATION });
  const state = new GameState();
  state.money = 0;
  state.tutorialStep = 99;
  state.upgrades.speed = 2;
  state.upgrades.capacity = 4;
  for (const z of loc.zones) state.unlockedZones.add(`kose:${z.id}`);
  Object.assign(state.staffCount, {
    waiter: 2,
    cashier: 2,
    barista: 2,
    busser: 0,
  });
  const vfx = createVFX();
  markDynamic(vfx.root);
  scene.scene.add(vfx.root);
  const world = new World("kose", state, vfx);
  world.setActive(true);
  scene.scene.add(world.root);
  scene.setVenueCenter(0, 2);
  for (const m of world.machines) {
    m.speedLevel = 2;
    m.capLevel = 2;
    m.output = Math.min(5, m.outputCap);
  }
  for (const shelf of world.pickups)
    for (
      let n = 0;
      n < (shelf.def.item === "cay" ? 3 : shelf.def.item === "latte" ? 1 : 6);
      n++
    )
      shelf.accept(shelf.def.item!);
  const decor = dressConceptCafe(world);
  const player = new Player();
  player.speed = state.playerSpeed;
  player.setCapacity(state.playerCapacity);
  player.setCarrierLevel(state.upgrades.capacity);
  if (player.char.root.userData.characterModel !== "PlayerS01")
    throw new Error("Yanlış karakter paketi: çekim durduruldu.");
  markDynamic(player.char.root);
  scene.scene.add(player.char.root);
  world.syncStaff();
  const shelf = world.byId.get("k_raf_cay")!,
    waffle = world.byId.get("k_raf_waffle")!,
    table = world.byId.get("k_masa_1")!,
    dirty = world.byId.get("k_masa_4")!,
    vip = world.byId.get("k_masa_8")!,
    counter = world.counters[0],
    bin = world.bins[0];
  dirty.dishes = 2;
  dirty.soil = dirty.cleanStartSoil = 0.95;
  const fixture = world as unknown as {
    quoteOrder(c: InstanceType<typeof Customer>): void;
    startEating(c: InstanceType<typeof Customer>): void;
  };
  let guestSequence = 0;
  function guestAt(
    t: typeof table,
    seatIndex: number,
    item: "cay" | "latte" | "tost" | "waffle" | "frappe",
    qty = 1,
    served = true,
  ) {
    if (t.seatTaken[seatIndex]) return;
    // Vary the existing customer cast despite the fixed generator's alternating low bit.
    if (premium && guestSequence % 2 === 0) Math.random();
    const c = new Customer(
      CUSTOMER_ARCHETYPES[guestSequence % CUSTOMER_ARCHETYPES.length],
      `film-${guestSequence++}`,
    );
    c.dineIn = true;
    c.table = t;
    c.counter = counter;
    c.serviceCode = t.def.serviceCode ?? "";
    c.order = new Order([{ item, qty, served: 0 }]);
    c.patience = c.maxPatience = 60;
    t.takeSeat(seatIndex);
    c.seatIndex = seatIndex;
    t.seatedGuests.push(c);
    world.customers.push(c);
    world.root.add(c.char.root);
    const p = { x: 0, y: 0, z: 0 };
    world.seatPoint(t, seatIndex, p);
    c.setPosition(p.x, p.z);
    world.sitOnChair(c, t);
    c.state = "seated";
    fixture.quoteOrder(c);
    if (served) {
      for (let n = 0; n < qty; n++) c.receiveItem(item);
      fixture.startEating(c);
    }
    for (let n = 0; n < 20; n++) c.step(1 / 60, world.nav);
  }
  guestAt(table, 0, "cay", 2, false);
  guestAt(table, 1, "cay", 1, false);
  const menu = ["latte", "tost", "waffle", "frappe"] as const;
  for (const t of world.tables) {
    if (t === table || t === dirty || t === vip) continue;
    for (let n = 0; n < Math.min(premium ? 3 : 2, t.seats); n++)
      guestAt(t, n, menu[(guestSequence + n) % 4], 2, true);
  }
  guestAt(vip, 0, "waffle", 2, false);
  // Resolve the actual assignment first; fixed employees begin at their own
  // station, instead of crossing the entire kitchen from invented start points.
  for (const staff of world.staff) {
    if (
      (staff.role === "cashier" || staff.role === "barista") &&
      staff.assigned
    ) {
      const point = { x: 0, z: 0 };
      staff.assigned.servicePoint(point);
      staff.setPosition(point.x, point.z);
      staff.angle = Math.atan2(
        staff.assigned.x - point.x,
        staff.assigned.z - point.z,
      );
      staff.char.root.rotation.y = staff.angle;
    } else staff.setPosition(-7 + staff.index * 2, imza ? -6.3 : -7.2);
  }
  let frame = 0,
    time = 0,
    phase = -1,
    task = "",
    picked = false,
    collected = 0,
    discarded = false,
    wafflePicked = false,
    lastAction = "",
    badge = "",
    badgeAt = -20;
  const traffic = new TrafficAudit();
  let gardenIntrusions = 0;
  let refillStaged = false;
  const events: Array<{ time: number; kind: string; data: unknown }> = [];
  const log = (kind: string, data: unknown) =>
    events.push({ time: +time.toFixed(4), kind, data });
  bus.on("sfx", (e) => log("sfx", e));
  bus.on("item:picked", (e) => log("picked", e));
  bus.on("item:served", (e) => {
    log("served", e);
    badge = e.item === "waffle" ? "Tatlı bir başarı!" : "Servis tamam!";
    badgeAt = time;
  });
  bus.on("counter:collected", (e) => {
    collected += e.amount;
    log("collected", e);
    badge = `+₺${Math.round(collected)}`;
    badgeAt = time;
  });
  bus.on("table:cleaned", (e) => {
    log("cleaned", e);
    badge = "Yeni misafire hazır";
    badgeAt = time;
  });
  bus.on("money:earn", (e) => log("earned", e));
  const front = { x: 0, z: 0 },
    cashPoint = { x: 0, z: 0 },
    binPoint = { x: 0, z: 0 },
    wafflePoint = { x: 0, z: 0 };
  shelf.frontPoint(front);
  counter.servicePoint(cashPoint);
  cashPoint.x -= 1.05; // Separate till collection from the cashier, within the real 1.3 m reach.
  bin.servicePoint(binPoint);
  waffle.frontPoint(wafflePoint);
  const servePoint = { x: table.x, z: table.z - 1.65 },
    cleanPoint = { x: dirty.x + 1.35, z: dirty.z + 1.35 },
    vipPoint = { x: vip.x, z: vip.z - 1.65 };
  let path: number[] = [],
    waypoint = 0;
  const move = { x: 0, y: 0, mag: 0, active: false },
    yaw = (BALANCE.camera.yaw * Math.PI) / 180;
  const focus = new T.Vector3(0, 0.5, 2.4),
    goal = new T.Vector3();
  function target(key: string, x: number, z: number) {
    if (task === key) return;
    task = key;
    path = [];
    waypoint = 0;
    if (!world.nav.findPath(player.x, player.z, x, z, path))
      throw new Error("Ulaşılamayan çekim hedefi: " + key);
    if (!path.length) path.push(x, z);
    log("task", { key, x, z });
  }
  function cut(next: number) {
    phase = next;
    task = "";
    path = [];
    waypoint = 0;
    move.active = false;
    move.mag = 0;
    if (next === 0 || next === 1) player.setPosition(front.x, front.z + 0.8);
    if (next === 2) player.setPosition(cashPoint.x - 1.2, cashPoint.z);
    if (next === 3) player.setPosition(cleanPoint.x + 0.5, cleanPoint.z + 0.1);
    if (next === 4) {
      player.setPosition(wafflePoint.x + 0.7, wafflePoint.z + 0.4);
      if (!refillStaged) {
        refillStaged = true;
        for (const machine of world.machines) machine.output = 0;
        world.spills.clear();
        world.grime.clear();
        for (const t of world.tables.filter(
          (t) => t !== table && t !== dirty && t !== vip,
        )) {
          for (const c of [...world.customers]) {
            if (c.table === t) {
              world.customers.splice(world.customers.indexOf(c), 1);
              c.dispose();
            }
          }
          t.seatedGuests.length = 0;
          t.seatTaken.fill(false);
          t.dishes = 0;
          t.soil = 0;
          t.servedVisual = 0;
          for (let n = 0; n < Math.min(premium ? 3 : 2, t.seats); n++)
            guestAt(t, n, menu[guestSequence % 4], 2, true);
        }
      }
    }
    player.noTakeFrom = player.noDropTo = null;
    if (next === 1 || next === 2 || next === 3)
      focus.set(player.x, 0.65, player.z);
    if (next === 4) focus.set(0, 0.55, -7);
    if (next === 5) focus.set(0, 0.5, 11.4);
    if (next === 6) focus.set(0, 0.55, 3.2);
    log("cut", { phase: next });
  }
  function tick() {
    const next =
      time < 2.7
        ? 0
        : time < 8
          ? 1
          : time < 10.5
            ? 2
            : time < 16.5
              ? 3
              : time < 19.5
                ? 4
                : time < 22.5
                  ? 5
                  : 6;
    if (next !== phase) cut(next);
    if (phase === 1) {
      if (player.slots.filter((i) => i === "cay").length >= 3) picked = true;
      if (!picked) target("tea", front.x, front.z);
      else if (state.stats.served < 3)
        target("serve", servePoint.x, servePoint.z);
      else target("service-out", 1.5, -1.6);
    } else if (phase === 2) target("cash", cashPoint.x, cashPoint.z);
    else if (phase === 3) {
      if (dirty.dishes > 0) target("dishes", cleanPoint.x, cleanPoint.z);
      else if (player.hasItem("bulasik")) target("bin", binPoint.x, binPoint.z);
      else {
        discarded = true;
        target("polish", cleanPoint.x, cleanPoint.z);
      }
    } else if (phase === 4 || phase === 5) {
      if (player.slots.filter((i) => i === "waffle").length >= 2)
        wafflePicked = true;
      if (!wafflePicked) target("waffle", wafflePoint.x, wafflePoint.z);
      else target("vip-service", vipPoint.x, vipPoint.z);
    }
    move.active = false;
    move.mag = 0;
    move.x = move.y = 0;
    if (phase > 0 && phase < 6 && waypoint < path.length / 2) {
      let dx = path[waypoint * 2] - player.x,
        dz = path[waypoint * 2 + 1] - player.z;
      let d = Math.hypot(dx, dz);
      if (d < (waypoint === path.length / 2 - 1 ? 0.12 : 0.25)) waypoint++;
      if (waypoint < path.length / 2) {
        dx = path[waypoint * 2] - player.x;
        dz = path[waypoint * 2 + 1] - player.z;
        d = Math.hypot(dx, dz);
        move.x = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
        move.y = -Math.sin(yaw) * dx - Math.cos(yaw) * dz;
        move.mag = Math.min(1, d * 2.8);
        move.active = true;
      }
    }
    state.playTime += 1 / 60;
    player.update(1 / 60, move, world.nav, world.loc.bounds);
    world.setViewFromCamera(scene.camera);
    world.setCameraQuat(scene.camera.quaternion);
    world.update(1 / 60, phase === 0 ? null : player, {
      spawnMult: 0.6,
      valueMult: 1,
      patienceMult: 1,
      tipMult: 1,
    });
    decor.hide();
    traffic.sample(time, [
      ...world.staff.map((a) => ({
        id: a.uid,
        staff: true,
        x: a.x,
        z: a.z,
        renderedX: a.char.root.position.x,
        renderedZ: a.char.root.position.z,
      })),
      ...world.customers
        .filter((a) => a.state !== "seated" && !a.done)
        .map((a) => ({
          id: a.uid,
          staff: false,
          x: a.x,
          z: a.z,
          renderedX: a.char.root.position.x,
          renderedZ: a.char.root.position.z,
        })),
      ...(phase === 0
        ? []
        : [
            {
              id: "player",
              staff: false,
              x: player.x,
              z: player.z,
              renderedX: player.char.root.position.x,
              renderedZ: player.char.root.position.z,
            },
          ]),
    ]);
    if (utopia) {
      const walkers = [
        ...world.staff,
        ...world.customers.filter((c) => c.state !== "seated" && !c.done),
        player,
      ];
      for (const a of walkers)
        if (a.x > -1.65 && a.x < 1.65 && a.z > 2.7 && a.z < 11.1)
          gardenIntrusions++;
    }
    vfx.root.visible = phase > 0;
    const action = player.interacting ? player.interactionKind : "";
    if (action !== lastAction) {
      log("action", { kind: action });
      lastAction = action;
    }
    vfx.update(1 / 60, scene.camera.quaternion);
    time += 1 / 60;
  }
  function camera(draw = true) {
    let distance = 19,
      azimuth = 0.035,
      elevation = (55 * Math.PI) / 180;
    if (phase === 0) {
      goal.set(0, 0.5, 2.4);
      distance = 56 - time * 2.1;
      azimuth = -0.09 + time * 0.018;
      elevation = (60 * Math.PI) / 180;
    } else if (phase === 4) {
      goal.set(-0.4, 0.8, -6.4);
      distance = 29;
      azimuth = -0.07;
    } else if (phase === 5) {
      goal.set(0, 0.6, 11.15);
      distance = 35;
      azimuth = 0.03 + Math.sin(time * 0.6) * 0.06;
      elevation = (57 * Math.PI) / 180;
    } else if (phase === 6) {
      goal.set(0, 0.7, 3.2);
      distance = 51 + (time - 22.5) * 1.2;
      azimuth = -0.035;
      elevation = (60 * Math.PI) / 180;
    } else {
      const action =
        phase === 1 ? (picked ? table : shelf) : phase === 2 ? counter : dirty;
      const dx = (action.x - player.x) * 0.2,
        dz = (action.z - player.z) * 0.2,
        k = Math.min(1, 0.6 / Math.max(0.0001, Math.hypot(dx, dz)));
      goal.set(player.x + dx * k, 0.7, player.z + dz * k);
      distance = phase === 2 ? 17.5 : 19.5;
    }
    if (utopia) {
      if (phase === 0) {
        goal.set(0, 0.7, 2.0);
        distance = 59 - time * 1.65;
        azimuth = 0.22 - time * 0.025;
        elevation = (53 * Math.PI) / 180;
      }
      if (phase === 4) {
        goal.set(-0.25, 0.8, -7.6);
        distance = 31;
        azimuth = 0.025;
      }
      if (phase === 5) {
        goal.set(0, 0.6, 11.55);
        distance = 36;
        azimuth = -0.12 + (time - 19.5) * 0.025;
        elevation = (60 * Math.PI) / 180;
      }
      if (phase === 6) {
        goal.set(0, 0.7, 2.0);
        distance = 57 + (time - 22.5) * 1.0;
        azimuth = 0.05;
        elevation = (53 * Math.PI) / 180;
      }
    }
    if (imza) {
      if (phase === 0) {
        goal.set(-4.2, 0.75, -1.2);
        distance = 27 - time * 0.9;
        azimuth = -0.12 + time * 0.025;
        elevation = (52 * Math.PI) / 180;
      } else if (phase >= 1 && phase <= 3) {
        distance = phase === 2 ? 14.7 : 16.0;
        azimuth = -0.09;
        elevation = (52 * Math.PI) / 180;
      } else if (phase === 4) {
        goal.set(-2.5 + (time - 16.5) * 1.65, 0.85, -7.3);
        distance = 27.5;
        azimuth = -0.07;
        elevation = (51 * Math.PI) / 180;
      } else if (phase === 5) {
        goal.set(0, 0.6, 9.4);
        distance = 31.5;
        azimuth = -0.04;
        elevation = (55 * Math.PI) / 180;
      } else {
        goal.set(0, 0.7, 1.5);
        distance = 55 + (time - 22.5) * 0.65;
        azimuth = -0.055;
        elevation = (59 * Math.PI) / 180;
      }
    }
    if (premium) {
      if (phase === 0) {
        goal.set(0, 0.75, 1.7);
        distance = 52 - time * 1.7;
        azimuth = -0.15 + time * 0.025;
        elevation = (57 * Math.PI) / 180;
      } else if (phase === 4) {
        goal.set(-4.1 + (time - 16.5) * 2.45, 0.8, -6.2);
        distance = 32;
        elevation = (53 * Math.PI) / 180;
      } else if (phase === 5) {
        goal.set(0, 0.65, 8.0);
        distance = 36;
        azimuth = -0.1 + (time - 19.5) * 0.025;
      } else if (phase === 6) {
        goal.set(0, 0.7, 1.5);
        distance = 53 + (time - 22.5) * 0.55;
        elevation = (57 * Math.PI) / 180;
      }
    }
    focus.lerp(goal, frame === 0 ? 1 : 0.22);
    scene.setFocus(focus.x, focus.z, 0, player.x, player.z);
    scene.camera.position.set(
      focus.x + Math.sin(azimuth) * distance * Math.cos(elevation),
      focus.y + distance * Math.sin(elevation),
      focus.z + Math.cos(azimuth) * distance * Math.cos(elevation),
    );
    scene.camera.lookAt(focus);
    scene.camera.updateMatrixWorld();
    world.focusX = focus.x;
    world.focusZ = focus.z;
    if (draw) {
      scene.invalidateShadows();
      scene.render();
    }
  }
  const cream = utopia ? "#f9f6ee" : "#fff9e9",
    green = utopia ? "#203c4c" : "#153f37",
    gold = utopia ? "#b9e5df" : "#f1cc77";
  function text(s: string, y: number, size = 74, color = cream) {
    ctx.font = `900 ${size}px 'Segoe UI',sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.strokeStyle = green;
    ctx.lineWidth = utopia ? 6 : 9;
    ctx.strokeText(s, 540, y);
    ctx.fillStyle = color;
    ctx.fillText(s, 540, y);
  }
  function pill(
    s: string,
    y: number,
    width = 700,
    color = green,
    fg = cream,
    size = 31,
  ) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(540 - width / 2, y, width, 65, 24);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = `800 ${size}px 'Segoe UI',sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s, 540, y + 32);
  }
  function compose() {
    ctx.globalAlpha = 1;
    ctx.drawImage(canvas, 0, 0, W, H);
    if (premium) {
      composePremiumFrame(ctx, phase, time, badge, badgeAt);
      return;
    }
    if (imza) {
      composeFlagshipFrame(ctx, phase, time, badge, badgeAt);
      return;
    }
    const wash = ctx.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, "rgba(14,43,34,.52)");
    wash.addColorStop(0.2, "rgba(14,43,34,0)");
    wash.addColorStop(0.82, "rgba(14,43,34,0)");
    wash.addColorStop(1, "rgba(14,43,34,.58)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
    if (phase < 6) {
      pill(
        utopia ? "KAFE CADDESİ · ÜTOPYA" : "KAFE CADDESİ",
        83,
        utopia ? 526 : 356,
        cream,
        green,
        28,
      );
      const copy = (
        utopia
          ? [
              ["BİR KAFE.", "BAŞKA BİR DÜNYA."],
              ["SICAK BİR KARŞILAMA.", "KUSURSUZ BİR SERVİS."],
              ["HER FİNCANDA", "YENİ BİR KAZANÇ."],
              ["İYİ BAK.", "IŞIL IŞIL KALSIN."],
              ["BEŞ AYRI LEZZET.", "TEK BİR EKİP."],
              ["SUYUN YANINDA", "KÜÇÜK BİR MOLA."],
            ]
          : [
              ["HAYALİNDEKİ KAFE.", "İŞTE BÖYLE."],
              ["TEPSİNİ DOLDUR.", "MİSAFİRİNİ MUTLU ET."],
              ["HER SERVİS,", "YENİ BİR KAZANÇ."],
              ["TOPLA. TEMİZLE.", "YENİDEN HAZIR."],
              ["MENÜN BÜYÜSÜN.", "EKİBİN ÇALIŞSIN."],
              ["DAHA FAZLA MASA.", "DAHA BÜYÜK HAYALLER."],
            ]
      )[phase];
      text(copy[0], 224, utopia ? 60 : phase === 5 ? 65 : 70);
      text(copy[1], 312, utopia ? 62 : phase === 1 || phase === 5 ? 64 : 70);
      const sub = [
        "BİR KAFEDEN DAHA FAZLASI",
        "SICAK ÇAY · GERÇEK SERVİS",
        "KAZANCINI TOPLA",
        "HER DETAY TERTEMİZ",
        "ÇAY · LATTE · TOST · WAFFLE · FRAPPE",
        utopia ? "AVLU · SALON · LOUNGE" : "YENİ SALONLAR · YENİ MİSAFİRLER",
      ][phase];
      pill(sub, 1690, 920, green, cream, 29);
      const elapsed = time - badgeAt;
      if (elapsed >= 0 && elapsed < 1.25) {
        ctx.globalAlpha = Math.min(1, elapsed * 10, (1.25 - elapsed) * 4);
        pill(badge, 1570 - elapsed * 18, 510, gold, green, 37);
        ctx.globalAlpha = 1;
      }
      for (let n = 0; n < 6; n++) {
        ctx.fillStyle = n <= phase ? gold : "rgba(255,249,233,.4)";
        ctx.beginPath();
        ctx.roundRect(300 + n * 82, 1800, 67, 6, 3);
        ctx.fill();
      }
    } else {
      // Keep the designed venue visible behind a compact brand finish.
      const fade = Math.min(1, (time - 22.5) * 3);
      ctx.globalAlpha = fade;
      ctx.fillStyle = utopia ? "rgba(32,60,76,.94)" : "rgba(21,63,55,.94)";
      ctx.beginPath();
      ctx.roundRect(100, 114, 880, 260, 42);
      ctx.fill();
      text("KAFE CADDESİ", 228, 84, gold);
      ctx.font = "500 33px 'Segoe UI',sans-serif";
      ctx.fillStyle = cream;
      ctx.fillText(
        utopia
          ? "ÜTOPYA · Hayalindeki kafeye bir adım."
          : "Küçük bir kafe. Senin büyük hikâyen.",
        540,
        320,
      );
      pill("KAFENİ KUR. BÜYÜT. YÖNET.", 1640, 880, gold, green, 43);
      ctx.globalAlpha = 1;
    }
  }
  cut(0);
  camera();
  world.update(0, null, {
    spawnMult: 0,
    valueMult: 1,
    patienceMult: 1,
    tipMult: 1,
  });
  decor.hide();
  vfx.root.visible = phase > 0;
  await scene.prepareForPlay();
  function stepFrame(draw = true) {
    if (frame >= 750) return false;
    tick();
    tick();
    camera(draw);
    if (draw) compose();
    frame++;
    return true;
  }
  function framing() {
    return {
      head: player.char.headTop
        .getWorldPosition(new T.Vector3())
        .project(scene.camera)
        .toArray(),
      feet: player.char.root
        .getWorldPosition(new T.Vector3())
        .project(scene.camera)
        .toArray(),
      check: phase >= 1 && phase <= 3,
    };
  }
  function report() {
    return {
      frame,
      time,
      task,
      phase,
      player: {
        x: player.x,
        z: player.z,
        held: [...player.slots],
        action: player.interactionKind,
        model: player.char.root.userData.characterModel,
        pack: player.char.root.userData.characterPack,
      },
      stats: { ...state.stats },
      collected,
      discarded,
      dirty: { dishes: dirty.dishes, soil: dirty.soil },
      cash: counter.cash,
      shelf: shelf.output,
      events,
      resolution: [canvas.width, canvas.height],
      cast: "local-current-game",
      storage: "memory-only",
      ready: true,
      concept: true,
      design: premium
        ? "premium"
        : imza
          ? "imza"
          : utopia
            ? "utopia"
            : "classic",
      gardenIntrusions,
      rendering: {
        calls: scene.renderer.info.render.calls,
        triangles: scene.renderer.info.render.triangles,
      },
      tableCount: world.tables.length,
      staffCount: world.staff.length,
      customers: world.customers.length,
      menu: world.menuItems(),
      stationCount: world.stations.length,
      layoutProblems: world.validateLayout(),
      traffic: traffic.report(),
    };
  }
  Object.assign(window, {
    __reklam: {
      stepFrame,
      report,
      framing,
      staffSnapshot: () =>
        world.staff.map((s) => ({
          id: s.uid,
          assigned: s.assigned?.id,
          x: s.x,
          z: s.z,
          job: s.job,
          speed: s.planarSpeed,
          stall: s.stallTimer,
        })),
      roomPng: () => {
        camera(true);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      png: () => film.toDataURL("image/png").split(",")[1],
    },
  });
  document.querySelector("#status")!.remove();
  if (!manual) {
    let last = performance.now(),
      accumulator = 0;
    const animate = (now: number) => {
      accumulator += Math.min(0.2, (now - last) / 1000);
      last = now;
      while (accumulator >= 1 / FPS && frame < 750) {
        stepFrame();
        accumulator -= 1 / FPS;
      }
      if (frame < 750) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
}
void boot().catch((error) => {
  console.error(error);
  document.querySelector("#status")!.textContent =
    `Çekim açılamadı: ${error.message}`;
});
