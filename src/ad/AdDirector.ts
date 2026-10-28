import * as THREE from 'three';
import './ad-overlay.css';
import type { Game } from '../core/Game';
import type { ItemId } from '../data/items';
import { clamp01 } from '../core/MathUtils';
import { Order } from '../sim/Orders';
import { markDynamic } from '../world/layers';

type AdLang = 'tr' | 'en';
type AdStage = 'chaos' | 'clean' | 'tycoon' | 'endcard';

interface CopySet {
  hookChaos: string;
  hookClean: string;
  hookTycoon: string;
  statusChaos: string;
  statusClean: string;
  statusTycoon: string;
  cardCleanTitle: string;
  cardCleanSub: string;
  cardCleanPrice: string;
  cardSpeedTitle: string;
  cardSpeedSub: string;
  cardSpeedPrice: string;
  cardGoldTitle: string;
  cardGoldSub: string;
  cardGoldPrice: string;
  cardMaxed: string;
  vipUnlockBtn: string;
  vipUnlockedBtn: string;
  floatAngry1: string;
  floatAngry2: string;
  floatAngry3: string;
  floatClean: string;
  floatSpeed: string;
  floatGold: string;
  floatVip: string;
  endTitle: string;
  endSubtitle: string;
  endRating: string;
  endCta: string;
  googleTop: string;
  appleTop: string;
  btnReplay: string;
  btnPause: string;
  btnResume: string;
  btnRecord: string;
  btnRecording: string;
}

const COPY: Record<AdLang, CopySet> = {
  tr: {
    hookChaos: 'YETİŞEMİYORUM! 😡',
    hookClean: '10X HIZ & TEMİZLİK! ✨',
    hookTycoon: 'KENDİ KAFE İMPARATORLUĞUNU KUR! ☕',
    statusChaos: '⚠️ 6 Masa Kirli · Hijyen %18',
    statusClean: '✨ %100 Hijyen · 10X Hız Aktif',
    statusTycoon: '👑 VIP Teras Açık · ₺18.500/sn',
    cardCleanTitle: 'ASMR TEMİZLİK',
    cardCleanSub: 'Tüm Kafe Tek Dalga',
    cardCleanPrice: 'ÜCRETSİZ ✨',
    cardSpeedTitle: '10X HIZ & EKİP',
    cardSpeedSub: '+8 Uzman Personel',
    cardSpeedPrice: '₺250 ⚡',
    cardGoldTitle: 'ALTIN MAKİNELER',
    cardGoldSub: 'Lv.5 Tam Otomasyon',
    cardGoldPrice: '₺500 👑',
    cardMaxed: 'MAKS ✓',
    vipUnlockBtn: '🏛️ LÜKS VIP & TERASI AÇ (₺25.000)',
    vipUnlockedBtn: '👑 VIP KAFE İMPARATORLUĞU AÇILDI!',
    floatAngry1: 'MASA ÇOK KİRLİ! 😡',
    floatAngry2: 'SİPARİŞİM NEREDE?! 💢',
    floatAngry3: 'ÇOK YAVAŞ! 😤',
    floatClean: 'TERTEMİZ! ✨',
    floatSpeed: '10X HIZ & EKİP! ⚡',
    floatGold: 'ALTIN SEVİYE! 👑',
    floatVip: 'VIP SALON AÇILDI! 🏛️✨',
    endTitle: 'Kafe Caddesi',
    endSubtitle: 'Fincan Sokağı · 3D Kafe İmparatorluğu',
    endRating: '★★★★★ 4.9  ·  120B+ Oyuncu',
    endCta: 'HEMEN İNDİR — ÜCRETSİZ',
    googleTop: "Google Play'DEN ALIN",
    appleTop: "App Store'dan İndirin",
    btnReplay: 'Baştan (R)',
    btnPause: 'Duraklat',
    btnResume: 'Devam',
    btnRecord: '60 FPS',
    btnRecording: 'Kayıtta...',
  },
  en: {
    hookChaos: "I CAN'T KEEP UP! 😡",
    hookClean: '10X SPEED & ASMR CLEAN! ✨',
    hookTycoon: 'BUILD YOUR CAFE EMPIRE! ☕',
    statusChaos: '⚠️ 6 Dirty Tables · Hygiene 18%',
    statusClean: '✨ 100% Hygiene · 10X Speed',
    statusTycoon: '👑 VIP Lounge Open · ₺18.5K/s',
    cardCleanTitle: 'ASMR CLEAN WAVE',
    cardCleanSub: 'Instant Sparkle Polish',
    cardCleanPrice: 'FREE ✨',
    cardSpeedTitle: '10X SPEED & SQUAD',
    cardSpeedSub: '+8 Pro Staff Team',
    cardSpeedPrice: '₺250 ⚡',
    cardGoldTitle: 'GOLDEN MACHINES',
    cardGoldSub: 'Lv.5 Max Automation',
    cardGoldPrice: '₺500 👑',
    cardMaxed: 'MAX ✓',
    vipUnlockBtn: '🏛️ UNLOCK VIP LOUNGE & TERRACE (₺25K)',
    vipUnlockedBtn: '👑 VIP CAFE EMPIRE UNLOCKED!',
    floatAngry1: 'TABLE IS FILTHY! 😡',
    floatAngry2: 'TAKING FOREVER! 💢',
    floatAngry3: 'SO SLOW! 😤',
    floatClean: 'SPARKLING CLEAN! ✨',
    floatSpeed: '10X SPEED & SQUAD! ⚡',
    floatGold: 'GOLDEN LEVEL! 👑',
    floatVip: 'VIP LOUNGE UNLOCKED! 🏛️✨',
    endTitle: 'Kafe Caddesi',
    endSubtitle: 'Cup Street · 3D Cafe Tycoon',
    endRating: '★★★★★ 4.9  ·  120K+ Players',
    endCta: 'DOWNLOAD NOW — FREE',
    googleTop: 'GET IT ON',
    appleTop: 'Download on the',
    btnReplay: 'Replay (R)',
    btnPause: 'Pause',
    btnResume: 'Resume',
    btnRecord: '60 FPS',
    btnRecording: 'Rec...',
  },
};

/* ── Sıfır-GC Önceden Tahsisli Yardımcı Nesneler ────────────────────────── */
const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _screenPt = { x: 0, y: 0, behind: false };
const _pt2 = { x: 0, z: 0 };

const TOWER_COLS = 5;
const TOWER_ROWS = 4;
const TOWER_LAYERS = 9;
const TOWER_MAX_BILLS = TOWER_COLS * TOWER_ROWS * TOWER_LAYERS; // 180 adet 3D banknot destesi
const FLY_BILL_COUNT = 36;

const FRONT_TABLE_IDS = [
  'k_masa_1',
  'k_masa_2',
  'k_masa_3',
  'k_masa_4',
  'k_masa_5',
  'k_masa_6',
] as const;

const MACHINE_IDS = [
  'k_semaver',
  'k_sutbar',
  'k_tost',
  'k_waffle',
  'k_frappe',
] as const;

const SHELF_IDS: Array<{ id: string; item: ItemId }> = [
  { id: 'k_raf_cay', item: 'cay' },
  { id: 'k_raf_latte', item: 'latte' },
  { id: 'k_raf_tost', item: 'tost' },
  { id: 'k_raf_waffle', item: 'waffle' },
  { id: 'k_raf_frappe', item: 'frappe' },
];

const SPILL_SPOTS: Array<{ x: number; z: number; kind: 'liquid' | 'crumbs' | 'toz' }> = [
  { x: -3.2, z: 1.5, kind: 'liquid' },
  { x: -1.4, z: 3.1, kind: 'crumbs' },
  { x: 1.8, z: 1.8, kind: 'liquid' },
  { x: 3.6, z: 3.4, kind: 'toz' },
  { x: -2.5, z: 4.8, kind: 'liquid' },
  { x: 0.4, z: 5.0, kind: 'crumbs' },
  { x: 2.9, z: 5.6, kind: 'liquid' },
  { x: -0.2, z: 0.2, kind: 'toz' },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(0.0001, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function formatAdCash(n: number): string {
  const v = Math.max(0, Math.round(n));
  return '₺' + v.toLocaleString('tr-TR');
}

export class AdDirector {
  private readonly game: Game;
  private readonly ctx: ReturnType<Game['getAdContext']>;
  private lang: AdLang = 'tr';
  private time = 0;
  private stage: AdStage = 'chaos';
  private paused = false;

  /* ── Senaryo Olay Bayrakları ── */
  private cleanedTableMask = 0;
  private cleanWaveTriggered = false;
  private speedSquadTriggered = false;
  private goldenMachinesTriggered = false;
  private vipPromptShown = false;
  private vipEmpireTriggered = false;
  private endcardTriggered = false;
  private lastPulseQuarter = -1;

  /* ── Görünen Para Sayacı ── */
  private displayedMoney = 120;
  private targetMoney = 120;
  private visibleTowerBills = 0;

  /* ── 3D Özel Reklam Nesneleri (Sıfır-GC Havuzlu) ── */
  private readonly adGroup = new THREE.Group();
  private readonly cleanWaveRing: THREE.Mesh;
  private readonly cleanWaveMat: THREE.MeshBasicMaterial;
  private readonly towerMesh: THREE.InstancedMesh;
  private readonly towerBandMesh: THREE.InstancedMesh;
  private readonly flyBillsMesh: THREE.InstancedMesh;
  private readonly flyPhase = new Float32Array(FLY_BILL_COUNT);
  private readonly crownsGroup = new THREE.Group();
  private readonly crownMeshes: THREE.Mesh[] = [];

  /* ── DOM Referansları ── */
  private readonly rootEl: HTMLDivElement;
  private readonly progressFillEl: HTMLDivElement;
  private readonly hookBannerEl: HTMLDivElement;
  private readonly cashPillEl: HTMLDivElement;
  private readonly cashTextEl: HTMLSpanElement;
  private readonly statusPillEl: HTMLDivElement;
  private readonly vipBtnEl: HTMLDivElement;
  private readonly cards: Record<'clean' | 'speed' | 'gold', {
    el: HTMLDivElement;
    lvlEl: HTMLSpanElement;
    titleEl: HTMLDivElement;
    subEl: HTMLDivElement;
    priceEl: HTMLDivElement;
  }>;
  private readonly handEl: HTMLDivElement;
  private readonly handSvgWrapEl: HTMLDivElement;
  private readonly rippleEl: HTMLDivElement;
  private readonly endcardEl: HTMLDivElement;
  private readonly endTitleEl: HTMLHeadingElement;
  private readonly endSubEl: HTMLParagraphElement;
  private readonly endRatingEl: HTMLDivElement;
  private readonly endCtaEl: HTMLButtonElement;
  private readonly googleTopEl: SVGTextElement;
  private readonly appleTopEl: SVGTextElement;

  /* ── Araç Çubuğu & 60 FPS Kaydedici ── */
  private readonly toolbarEl: HTMLDivElement;
  private readonly timeReadoutEl: HTMLSpanElement;
  private readonly replayBtnEl: HTMLButtonElement;
  private readonly pauseBtnEl: HTMLButtonElement;
  private readonly langBtnEl: HTMLButtonElement;
  private readonly recordBtnEl: HTMLButtonElement;
  private recorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording = false;

  constructor(game: Game) {
    this.game = game;
    this.ctx = game.getAdContext();

    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang === 'en') this.lang = 'en';

    document.body.classList.add('ad-mode-body');
    this.ctx.scene3d.hideSurfaceLabels = true;

    /* ── 1. Sıfır-GC 3D Görsel Havuzları Kurulumu ── */
    markDynamic(this.adGroup);
    this.ctx.scene3d.scene.add(this.adGroup);

    // ASMR Temizlik Dalgası Halkası
    const ringGeo = new THREE.RingGeometry(0.65, 1.35, 48);
    ringGeo.rotateX(-Math.PI / 2);
    this.cleanWaveMat = new THREE.MeshBasicMaterial({
      color: 0x56f7e8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.cleanWaveRing = new THREE.Mesh(ringGeo, this.cleanWaveMat);
    this.cleanWaveRing.position.set(0, 0.16, 4.0);
    this.cleanWaveRing.visible = false;
    this.adGroup.add(this.cleanWaveRing);

    // 3D Mega Para Kulesi (180 Banknot Destesi — Tek Çizim Çağrısı)
    const billGeo = new THREE.BoxGeometry(0.42, 0.11, 0.24);
    const billMat = new THREE.MeshLambertMaterial({
      color: 0x2ecc71,
      emissive: 0x0b3d1c,
    });
    this.towerMesh = new THREE.InstancedMesh(billGeo, billMat, TOWER_MAX_BILLS);
    this.towerMesh.count = 0;
    this.towerMesh.frustumCulled = false;
    this.adGroup.add(this.towerMesh);

    const bandGeo = new THREE.BoxGeometry(0.14, 0.116, 0.248);
    const bandMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });
    this.towerBandMesh = new THREE.InstancedMesh(bandGeo, bandMat, TOWER_MAX_BILLS);
    this.towerBandMesh.count = 0;
    this.towerBandMesh.frustumCulled = false;
    this.adGroup.add(this.towerBandMesh);

    // Uçuşan Mıknatıs Banknot Havuzu (36 Banknot)
    this.flyBillsMesh = new THREE.InstancedMesh(billGeo, billMat, FLY_BILL_COUNT);
    this.flyBillsMesh.count = 0;
    this.flyBillsMesh.frustumCulled = false;
    this.adGroup.add(this.flyBillsMesh);
    for (let i = 0; i < FLY_BILL_COUNT; i++) {
      this.flyPhase[i] = i / FLY_BILL_COUNT;
    }

    // Altın Makine Haleleri / Taçları
    const crownGeo = new THREE.TorusGeometry(0.48, 0.065, 10, 28);
    crownGeo.rotateX(Math.PI / 2);
    const crownMat = new THREE.MeshBasicMaterial({ color: 0xffd740 });
    this.crownsGroup.visible = false;
    this.adGroup.add(this.crownsGroup);
    for (let i = 0; i < MACHINE_IDS.length; i++) {
      const m = new THREE.Mesh(crownGeo, crownMat);
      this.crownsGroup.add(m);
      this.crownMeshes.push(m);
    }

    /* ── 2. DOM & SVG Katmanları Kurulumu ── */
    const dom = this.buildDOM();
    this.rootEl = dom.rootEl;
    this.progressFillEl = dom.progressFillEl;
    this.hookBannerEl = dom.hookBannerEl;
    this.cashPillEl = dom.cashPillEl;
    this.cashTextEl = dom.cashTextEl;
    this.statusPillEl = dom.statusPillEl;
    this.vipBtnEl = dom.vipBtnEl;
    this.cards = dom.cards;
    this.handEl = dom.handEl;
    this.handSvgWrapEl = dom.handSvgWrap;
    this.rippleEl = dom.rippleEl;
    this.endcardEl = dom.endcardEl;
    this.endTitleEl = dom.endTitleEl;
    this.endSubEl = dom.endSubEl;
    this.endRatingEl = dom.endRatingEl;
    this.endCtaEl = dom.endCtaEl;
    this.googleTopEl = dom.googleTopEl;
    this.appleTopEl = dom.appleTopEl;
    this.toolbarEl = dom.toolbarEl;
    this.timeReadoutEl = dom.timeReadoutEl;
    this.replayBtnEl = dom.replayBtnEl;
    this.pauseBtnEl = dom.pauseBtnEl;
    this.langBtnEl = dom.langBtnEl;
    this.recordBtnEl = dom.recordBtnEl;

    const uiRoot = document.getElementById('ui-root') ?? document.body;
    uiRoot.appendChild(this.rootEl);
    document.body.appendChild(this.toolbarEl);

    this.applyCopy();
    this.syncViewport9x16();
    window.addEventListener('resize', () => this.syncViewport9x16());
    window.addEventListener('keydown', (e) => this.onKeyDown(e));

    /* ── 3. Senaryoyu 0.0 Saniyeden Başlat ── */
    this.restart();
    this.game.adVisualTick = (rawDt: number) => this.tick(rawDt);
  }

  /* ==========================================================================
   *  9:16 DİKEY ÇERÇEVE & KAMERA PROJEKSİYON SENKRONİZASYONU
   * ========================================================================== */

  private syncViewport9x16(): void {
    const app = document.getElementById('app');
    if (!app) return;
    const rect = app.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width));
    const h = Math.max(568, Math.round(rect.height));
    const s3d = this.ctx.scene3d as unknown as {
      renderer: THREE.WebGLRenderer;
      camera: THREE.PerspectiveCamera;
      width: number;
      height: number;
    };
    s3d.width = w;
    s3d.height = h;
    s3d.renderer.setSize(w, h, false);
    s3d.camera.clearViewOffset();
    s3d.camera.aspect = w / h;
    s3d.camera.updateProjectionMatrix();
    this.ctx.forceRender();
  }

  /* ==========================================================================
   *  SENARYO SIFIRLAMA & AŞAMA 1 (0–3s KAOS / DARBOĞAZ) KURULUMU
   * ========================================================================== */

  public restart(): void {
    this.time = 0;
    this.stage = 'chaos';
    this.cleanedTableMask = 0;
    this.cleanWaveTriggered = false;
    this.speedSquadTriggered = false;
    this.goldenMachinesTriggered = false;
    this.vipPromptShown = false;
    this.vipEmpireTriggered = false;
    this.endcardTriggered = false;
    this.lastPulseQuarter = -1;

    this.displayedMoney = 120;
    this.targetMoney = 120;
    this.visibleTowerBills = 0;
    this.towerMesh.count = 0;
    this.towerBandMesh.count = 0;
    this.flyBillsMesh.count = 0;
    this.cleanWaveRing.visible = false;
    this.crownsGroup.visible = false;

    const world = this.ctx.getWorld();
    const state = this.ctx.state;
    const player = this.ctx.player;

    // Öğreticiyi kapat, başlangıç parasını ₺120 yap
    this.ctx.tutorial.skip();
    state.tutorialStep = 99;
    state.money = 120;
    state.reputation = 28;

    // Oyuncu yükseltmelerini başlangıç (yavaş/darboğaz) seviyesine çek
    state.upgrades.speed = 0;
    state.upgrades.capacity = 0;
    state.upgrades.hands = 0;
    state.upgrades.charm = 0;
    this.ctx.applyPlayerStats();
    player.speed = 2.4;

    // Tüm personeli temizle (İlk 3 saniyede oyuncu tek başına yetişemiyor!)
    const staffCount = state.staffCountAt('kose');
    staffCount.waiter = 0;
    staffCount.cashier = 0;
    staffCount.busser = 0;
    staffCount.barista = 0;
    world.syncStaff();

    // Yalnızca ön salon masaları (t1..t5) ve temel bar açık olsun; VIP kilitli başlasın
    state.unlockedZones.clear();
    for (const z of ['start', 'a1', 'a2', 't1', 't2', 't3', 't4', 't5']) {
      state.unlockedZones.add('kose:' + z);
    }
    world.syncLocks();

    // İstasyon seviyelerini sıfırla; tüm ön salon masalarını bulaşık ve kirle doldur!
    for (const st of world.stations) {
      st.speedLevel = 1;
      st.capLevel = 1;
      st.cash = 0;
      st.cashValue = 0;
      st.cleanValue = 0;
      st.cleanStartSoil = 0;
    }

    for (const id of FRONT_TABLE_IDS) {
      const table = world.byId.get(id);
      if (table) {
        table.locked = false;
        table.dishes = 4;
        table.soil = 0.95;
        table.dirtyAge = 28;
      }
    }

    // Zemin lekeleri ve ağır trafik kiri (Kaos görüntüsü)
    world.spills.list.length = 0;
    for (const s of SPILL_SPOTS) {
      const sp = world.spills.spawn(s.x, s.z, s.kind);
      if (sp) sp.grow = 1;
    }
    world.spills.dirtyVisual = true;

    world.grime.cleanAt(0, 2, 40, 255);
    for (let gx = -5; gx <= 5; gx += 1.2) {
      for (let gz = -2; gz <= 6.5; gz += 1.2) {
        world.grime.addTraffic(gx, gz, 215);
      }
    }
    world.hygiene = 18;

    // Mevcut müşterileri temizle ve 12 kızgın/bekleyen müşteri diz
    for (let i = world.customers.length - 1; i >= 0; i--) {
      world.customers[i].dispose();
    }
    world.customers.length = 0;
    for (const co of world.counters) co.queue.length = 0;

    // Kasada uzayan kızgın kuyruk (7 müşteri)
    const counter = world.byId.get('k_tezgah_1') ?? world.counters[0];
    for (let i = 0; i < 7; i++) {
      const c = world.spawnCustomer('normal');
      if (!c || !counter) continue;
      counter.queueSlot(i, _pt2);
      c.setPosition(_pt2.x, _pt2.z);
      c.stop();
      c.state = i === 0 ? 'order' : 'queue';
      c.waiting = true;
      c.maxPatience = 100;
      c.patience = 15 + (i % 3) * 3;
      c.showAngry();
      c.showBubble(true);
      c.faceTowards(counter.x, counter.z, 1, 20);
    }

    // Kirli masaların başında bekleyen ve öfkelenen 5 müşteri
    const tableWaitSpots = [
      { id: 'k_masa_1', x: -4.1, z: 2.2, item: 'cay' as ItemId },
      { id: 'k_masa_2', x: -1.1, z: 2.2, item: 'cay' as ItemId },
      { id: 'k_masa_3', x: 4.1, z: 2.2, item: 'cay' as ItemId },
      { id: 'k_masa_4', x: -4.1, z: 5.8, item: 'cay' as ItemId },
      { id: 'k_masa_5', x: 1.1, z: 5.8, item: 'cay' as ItemId },
    ];
    for (let i = 0; i < tableWaitSpots.length; i++) {
      const spot = tableWaitSpots[i];
      const c = world.spawnCustomer('normal');
      if (!c) continue;
      if (c.counter) {
        const q = c.counter.queue as unknown[];
        const idx = q.indexOf(c);
        if (idx >= 0) q.splice(idx, 1);
        c.counter = null;
      }
      const tbl = world.byId.get(spot.id) ?? null;
      c.table = tbl;
      c.seatIndex = 0;
      if (tbl && !tbl.seatedGuests.includes(c)) {
        tbl.seatedGuests.push(c);
        tbl.seatTaken[0] = true;
      }
      c.setPosition(spot.x, spot.z);
      c.stop();
      c.state = 'seated';
      c.eating = false;
      c.waiting = true;
      c.order = new Order([{ item: spot.item, qty: 2, served: 0 }]);
      c.maxPatience = 100;
      c.patience = 14 + (i % 3) * 3;
      c.showAngry();
      c.showBubble(true);
      if (tbl) c.faceTowards(tbl.x, tbl.z, 1, 20);
    }

    // Oyuncuyu kirli masaların ortasına, elinde bulaşıklarla yerleştir
    player.dropAll();
    player.give('bulasik');
    player.give('bulasik');
    player.give('bulasik');
    player.setPosition(-1.8, 1.2);

    // 3D rehber okunu gizle ve tüm karakterlerin iskelet pozunu ilk kareden oturt (T-pose önleme)
    const guideObj = (world as unknown as { guide?: { root: THREE.Object3D } }).guide;
    if (guideObj?.root) guideObj.root.visible = false;
    for (const c of world.customers) c.step(0.05, world.nav, true);
    for (const s of world.staff) s.step(0.05, world.nav, true);

    // UI Kartlarını Sıfırla
    this.rootEl.dataset.stage = 'chaos';
    for (const key of ['clean', 'speed', 'gold'] as const) {
      const card = this.cards[key];
      card.el.classList.remove('target-glow', 'pressed', 'upgraded');
      card.lvlEl.textContent = 'LV.1';
    }
    this.vipBtnEl.classList.remove('visible', 'done');
    this.handEl.classList.remove('visible', 'tapping');
    this.rippleEl.classList.remove('active');
    this.applyCopy();
    this.updateCashUI(false);
    this.ctx.scene3d.invalidateStatic();
    this.ctx.scene3d.invalidateShadows();
    this.ctx.forceRender();
  }

  /* ==========================================================================
   *  HER KARE DETERMINISTIK KOREOGRAFİ & KAMERA YÖNETMENİ
   * ========================================================================== */

  private tick(rawDt: number): void {
    const dt = this.paused ? 0 : Math.min(rawDt, 0.05);
    this.time += dt;

    // 22 saniyelik reklam tamamlandığında kayıttaysa kaydı bitir, değilse 24.2s'de başa sar
    if (this.time >= 22.0 && this.isRecording) {
      this.stopRecording();
    }
    if (this.time >= 24.2 && !this.isRecording) {
      this.restart();
      return;
    }

    const t = this.time;
    const progressPct = Math.min(100, (t / 22.0) * 100);
    this.progressFillEl.style.width = `${progressPct.toFixed(1)}%`;
    this.timeReadoutEl.textContent = `${Math.min(22, t).toFixed(1)}s / 22.0s`;

    // Aşama (Stage) Geçişleri
    const nextStage: AdStage =
      t < 3.0 ? 'chaos' : t < 10.0 ? 'clean' : t < 18.0 ? 'tycoon' : 'endcard';
    if (nextStage !== this.stage) {
      this.stage = nextStage;
      this.rootEl.dataset.stage = nextStage;
      this.updateBannerForStage();
    }

    if (!this.paused) {
      this.stepChoreography(t, dt);
    }

    this.stepCamera(t);
    this.step3DProps(t, dt);
    this.stepHandCursor(t);
  }

  private stepChoreography(t: number, dt: number): void {
    const world = this.ctx.getWorld();
    const player = this.ctx.player;
    const vfx = this.ctx.vfx;
    const c = COPY[this.lang];

    const guideObj = (world as unknown as { guide?: { root: THREE.Object3D } }).guide;
    if (guideObj?.root) guideObj.root.visible = false;

    if (t >= 3.0) {
      for (let i = 0; i < world.customers.length; i++) {
        const cust = world.customers[i];
        cust.waiting = false;
        cust.maxPatience = 100;
        cust.patience = 99;
        cust.showBubble(false);
        cust.step(dt, world.nav, true);
      }
      for (let i = 0; i < world.staff.length; i++) {
        world.staff[i].step(dt, world.nav, true);
      }
    }

    const quarter = Math.floor(t * 4);
    const isNewQuarter = quarter !== this.lastPulseQuarter;
    if (isNewQuarter) this.lastPulseQuarter = quarter;

    /* ── AŞAMA 1: 0.0s – 3.0s (KAOS & DARBOĞAZ HOOK) ───────────────────── */
    if (t < 3.0) {
      // Oyuncu masalar arasında yavaşça sağa sola koşturup yetişemiyor
      const targetX = Math.sin(t * 3.4) * 2.4;
      const targetZ = 1.1 + Math.cos(t * 2.2) * 1.1;
      const dx = targetX - player.x;
      const dz = targetZ - player.z;
      player.setPosition(player.x + dx * dt * 2.8, player.z + dz * dt * 2.8);
      player.faceTowards(targetX, targetZ, dt, 10);

      // Müşterilerin sabır barlarını kırmızı/titrek bölgede tut ve kızgın balonlarını göster
      for (let i = 0; i < world.customers.length; i++) {
        const cust = world.customers[i];
        cust.waiting = true;
        cust.maxPatience = 100;
        cust.patience = 15 + ((i * 3) % 7);
        cust.showAngry();
        cust.showBubble(true);
      }

      // Her 0.5 saniyede bir öfke emojisi, kırmızı duman ve şikayet yazısı patlat
      if (isNewQuarter && quarter % 2 === 0) {
        const idx = quarter % Math.max(1, world.customers.length);
        const cust = world.customers[idx];
        if (cust) {
          vfx.emote(cust.x, 2.15, cust.z, 'angry');
          const msg =
            quarter % 6 === 0
              ? c.floatAngry1
              : quarter % 4 === 0
                ? c.floatAngry2
                : c.floatAngry3;
          this.float3DText(cust.x, 2.2, cust.z, msg, 'bad');
        }
        // Kirli masalardan koku/duman çıkışı
        const dirtyTbl = world.byId.get(FRONT_TABLE_IDS[quarter % FRONT_TABLE_IDS.length]);
        if (dirtyTbl && dirtyTbl.dishes > 0) {
          vfx.puff(dirtyTbl.x, 1.1, dirtyTbl.z, 0x6e5536, 4);
        }
      }
      return;
    }

    /* ── AŞAMA 2: 3.0s – 10.0s (ASMR TEMİZLİK & HIZLI UPGRADE DOPAMİNİ) ── */
    if (t >= 3.0 && t < 3.55) {
      this.cards.clean.el.classList.add('target-glow');
    }

    // 3.55s: 1. DOKUNUŞ -> ASMR Temizlik Dalgası Başlat
    if (t >= 3.55 && !this.cleanWaveTriggered) {
      this.cleanWaveTriggered = true;
      this.triggerCardUpgrade('clean', c.cardMaxed);
      this.ctx.audio.play('upgrade');
      this.ctx.audio.play('clean_chime');
      player.dropAll();
      player.celebrate();
      this.cleanWaveRing.visible = true;
    }

    // 3.55s – 4.55s: Masaların soldan sağa ASMR dalgasıyla sırayla parlayarak temizlenmesi
    if (t >= 3.55 && t <= 4.75) {
      const waveProg = clamp01((t - 3.55) / 0.95);
      for (let i = 0; i < FRONT_TABLE_IDS.length; i++) {
        const bit = 1 << i;
        if ((this.cleanedTableMask & bit) !== 0) continue;
        if (waveProg >= i / FRONT_TABLE_IDS.length) {
          this.cleanedTableMask |= bit;
          const tbl = world.byId.get(FRONT_TABLE_IDS[i]);
          if (tbl) {
            tbl.dishes = 0;
            tbl.soil = 0;
            tbl.dirtyAge = 0;
            tbl.cleanValue = 0;
            tbl.cleanStartSoil = 0;
            const vis = (world as unknown as { stationVisuals: Map<string, { playGleam: () => void }> }).stationVisuals.get(tbl.id);
            vis?.playGleam();
            vfx.foamBurst(tbl.x, 1.05, tbl.z, 20);
            vfx.sparkleBurst(tbl.x, 1.3, tbl.z, 16, 0x7ef7ff);
            vfx.ring(tbl.x, 0.16, tbl.z, 0x48f5d2, 2.4);
            this.ctx.audio.play('clean_chime');
            this.float3DText(tbl.x, 1.75, tbl.z, c.floatClean, 'good');
            this.addAdCash(450, tbl.x, tbl.z);
          }
        }
      }

      // Dalga ortasında tüm zemin lekelerini ve kiri pırıl pırıl sil
      if (waveProg >= 0.45 && world.spills.list.length > 0) {
        for (const sp of world.spills.list) {
          vfx.foamBurst(sp.x, 0.3, sp.z, 10);
          vfx.sparkleBurst(sp.x, 0.5, sp.z, 8, 0x9dffea);
        }
        world.spills.list.length = 0;
        world.spills.dirtyVisual = true;
        world.grime.cleanAt(0, 2, 45, 255);
        world.hygiene = 100;
      }
    }

    if (t >= 4.9 && t < 5.75 && !this.speedSquadTriggered) {
      this.cards.speed.el.classList.add('target-glow');
    }

    // 5.75s: 2. DOKUNUŞ -> 10X Hız & Uzman Personel Ordusu Girişi
    if (t >= 5.75 && !this.speedSquadTriggered) {
      this.speedSquadTriggered = true;
      this.triggerCardUpgrade('speed', 'LV.10');
      const state = this.ctx.state;
      state.upgrades.speed = 10;
      state.upgrades.capacity = 8;
      state.upgrades.hands = 8;
      state.upgrades.charm = 8;
      this.ctx.applyPlayerStats();
      player.speed = 9.5;
      player.celebrate();

      const sc = state.staffCountAt('kose');
      const sl = state.staffLevelAt('kose');
      sc.waiter = 4;
      sc.cashier = 2;
      sc.busser = 2;
      sc.barista = 2;
      sl.waiter = 5;
      sl.cashier = 5;
      sl.busser = 5;
      sl.barista = 5;
      world.syncStaff();

      // Personelleri sahnenin görünür noktalarına zıplayarak yerleştir
      const spawnSpots = [
        { x: -2.6, z: -0.4 },
        { x: 0.0, z: -0.2 },
        { x: 2.6, z: -0.4 },
        { x: -2.4, z: 3.6 },
        { x: 2.4, z: 3.6 },
        { x: 3.0, z: -3.2 },
        { x: -3.8, z: -2.8 },
        { x: 0.4, z: 3.8 },
      ];
      for (let i = 0; i < world.staff.length; i++) {
        const stf = world.staff[i];
        const pt = spawnSpots[i % spawnSpots.length];
        stf.setPosition(pt.x, pt.z);
        vfx.ring(pt.x, 0.16, pt.z, 0xffd166, 1.9);
        vfx.sparkleBurst(pt.x, 1.2, pt.z, 14, 0xffe066);
      }

      // Müşterilerin kızgınlığını mutluluğa çevir
      for (const cust of world.customers) {
        cust.waiting = false;
        cust.maxPatience = 100;
        cust.patience = 98;
        cust.showBubble(false);
        vfx.emote(cust.x, 2.1, cust.z, 'happy');
      }

      this.ctx.audio.play('hire');
      this.ctx.audio.play('levelup');
      this.float3DText(player.x, 2.1, player.z, c.floatSpeed, 'good');
      this.addAdCash(1800, player.x, player.z);
    }

    if (t >= 7.0 && t < 7.95 && !this.goldenMachinesTriggered) {
      this.cards.gold.el.classList.add('target-glow');
    }

    // 7.95s: 3. DOKUNUŞ -> Altın Makineler (Lv.5) & Dolu Raflar
    if (t >= 7.95 && !this.goldenMachinesTriggered) {
      this.goldenMachinesTriggered = true;
      this.triggerCardUpgrade('gold', c.cardMaxed);

      for (const z of ['a3', 'a4', 'a5', 'a7', 'a8']) {
        this.ctx.state.unlockedZones.add('kose:' + z);
      }
      world.syncLocks();

      const stationVisuals = (world as unknown as {
        stationVisuals: Map<string, { playUnlock: (delay?: number) => void; playGleam: () => void }>;
      }).stationVisuals;

      for (let i = 0; i < MACHINE_IDS.length; i++) {
        const m = world.byId.get(MACHINE_IDS[i]);
        if (!m) continue;
        m.locked = false;
        m.speedLevel = 5;
        m.capLevel = 5;
        m.output = m.outputCap;
        stationVisuals.get(m.id)?.playUnlock(i * 0.03);
        vfx.sparkleBurst(m.x, 1.5, m.z, 18, 0xffd700);
        vfx.ring(m.x, 0.15, m.z, 0xffc837, 2.2);
        this.crownMeshes[i].position.set(m.x, 2.15, m.z);
      }
      this.crownsGroup.visible = true;

      for (const sh of SHELF_IDS) {
        const shelf = world.byId.get(sh.id);
        if (!shelf) continue;
        shelf.locked = false;
        shelf.capLevel = 5;
        while (shelf.output < shelf.outputCap) {
          if (!shelf.accept(sh.item)) break;
        }
        vfx.sparkleBurst(shelf.x, 1.3, shelf.z, 10, 0xffe57f);
      }

      this.ctx.audio.play('levelup');
      this.ctx.audio.play('goal');
      this.float3DText(0, 2.3, -3.5, c.floatGold, 'money');
      this.addAdCash(4200, 0, -3.5);
      this.ctx.scene3d.invalidateStatic();
      this.ctx.scene3d.invalidateShadows();
    }

    /* ── AŞAMA 3: 10.0s – 18.0s (PARA YIĞINI PATLAMASI & TYCOON PAYOFF) ── */
    if (t >= 10.0 && t < 18.0) {
      // 10.0s – 13.0s: Orta koridorda 180 blokluk 3D Mega Banknot Kulesi hızla yükselir!
      if (t < 13.0) {
        const towerRatio = clamp01((t - 10.0) / 2.6);
        const wantBills = Math.floor(towerRatio * TOWER_MAX_BILLS);
        if (wantBills > this.visibleTowerBills) {
          this.visibleTowerBills = wantBills;
          this.rebuildCashTower(this.visibleTowerBills);
          if (isNewQuarter) {
            vfx.coinBurst(-0.25, 1.2 + towerRatio * 1.4, -1.1, 8);
            this.addAdCash(3200, -0.25, -1.1);
          }
        }
      }

      if (t >= 11.2 && !this.vipPromptShown) {
        this.vipPromptShown = true;
        this.vipBtnEl.classList.add('visible');
      }

      // 13.0s: 4. DOKUNUŞ -> Mıknatıs Para Çekimi & Lüks VIP + Teras Açılışı!
      if (t >= 13.0 && !this.vipEmpireTriggered) {
        this.vipEmpireTriggered = true;
        this.vipBtnEl.textContent = c.vipUnlockedBtn;
        this.vipBtnEl.classList.add('done');

        // Oyuncuyu para kulesinin yanına getir
        player.setPosition(-0.25, -0.15);
        player.celebrate();

        // VIP Salonu (r2, v1, v2) ve ön/yan bölgeleri aç
        for (const z of ['r2', 'v1', 'v2', 't6', 't7', 'a6', 'z_muzik', 'z_vitrin', 'z_tabela']) {
          this.ctx.state.unlockedZones.add('kose:' + z);
        }
        world.syncLocks();

        // VIP masalarda mutlu müşteriler ve kutlama efektleri
        const vipTables = ['k_vip_1', 'k_vip_2', 'k_vip_3'];
        for (const vid of vipTables) {
          const vt = world.byId.get(vid);
          if (!vt) continue;
          vfx.ring(vt.x, 0.2, vt.z, 0xffd700, 3.2);
          vfx.sparkleBurst(vt.x, 1.5, vt.z, 22, 0xffdf6b);
          vfx.coinBurst(vt.x, 1.6, vt.z, 12);
        }

        vfx.ring(-0.25, 0.2, -1.1, 0x38ef7d, 4.0);
        vfx.coinBurst(-0.25, 1.8, -1.1, 28);
        this.ctx.audio.play('cashout');
        this.ctx.audio.play('levelup');
        this.ctx.scene3d.shake(0.45);
        this.float3DText(player.x, 2.3, player.z, c.floatVip, 'money');
        this.addAdCash(125000, -0.25, -1.1);
        this.ctx.scene3d.invalidateStatic();
        this.ctx.scene3d.invalidateShadows();
      }

      // 13.0s – 17.8s: Mıknatıs etkisiyle kule erirken paralar oyuncunun sırtına ve VIP'ye akar
      if (t >= 13.0) {
        const drain = 1 - clamp01((t - 13.0) / 2.2);
        const remain = Math.floor(drain * TOWER_MAX_BILLS);
        if (remain !== this.visibleTowerBills) {
          this.visibleTowerBills = remain;
          this.rebuildCashTower(this.visibleTowerBills);
        }
        // Oyuncu VIP koridoruna doğru gururla yürür
        const walkT = clamp01((t - 13.4) / 3.8);
        player.setPosition(lerp(-0.25, -6.2, walkT), lerp(-0.15, 8.2, walkT));
        player.faceTowards(-11.5, 12.5, dt, 8);

        if (isNewQuarter) {
          this.addAdCash(18500, player.x, player.z);
          for (let i = 0; i < world.customers.length; i += 3) {
            const cust = world.customers[i];
            if (cust) {
              const kind = (i + quarter) % 3 === 0 ? 'money' : (i + quarter) % 2 === 0 ? 'star' : 'happy';
              vfx.emote(cust.x, 2.1, cust.z, kind);
            }
          }
        }
      } else if (isNewQuarter) {
        // 10–13s arası mutlu müşteri emojileri
        const cust = world.customers[quarter % Math.max(1, world.customers.length)];
        if (cust) {
          vfx.emote(cust.x, 2.1, cust.z, quarter % 2 === 0 ? 'happy' : 'money');
        }
      }
    }

    /* ── AŞAMA 4: 18.0s – 22.0s (MAĞAZA CTA ENDCARD) ────────────────────── */
    if (t >= 18.0 && !this.endcardTriggered) {
      this.endcardTriggered = true;
      this.flyBillsMesh.count = 0;
      this.ctx.audio.play('goal');
    }

    // Görünen para sayacını yumuşak ve hızlıca hedefe yaklaştır
    if (this.displayedMoney < this.targetMoney) {
      const diff = this.targetMoney - this.displayedMoney;
      this.displayedMoney += Math.max(25, diff * Math.min(1, dt * 10));
      if (this.displayedMoney > this.targetMoney) this.displayedMoney = this.targetMoney;
      this.cashTextEl.textContent = formatAdCash(this.displayedMoney);
    }
  }

  /* ==========================================================================
   *  SİNEMATİK 9:16 KAMERA YÖNETMENİ
   * ========================================================================== */

  private stepCamera(t: number): void {
    const cam = this.ctx.scene3d.camera;

    if (t < 3.0) {
      // Aşama 1: Kaos / Darboğaz yakın-orta plan + stres sarsıntısı
      const p = t / 3.0;
      const shakeX = Math.sin(t * 34) * 0.085;
      const shakeY = Math.cos(t * 41) * 0.065;
      _camPos.set(lerp(5.2, 6.2, p) + shakeX, lerp(11.8, 12.6, p) + shakeY, lerp(12.2, 13.0, p));
      _camLook.set(lerp(0.6, 0.2, p) + shakeX * 0.5, 0.65, lerp(0.8, 1.5, p));
      cam.fov = lerp(31, 33, p);
    } else if (t < 10.0) {
      // Aşama 2: ASMR Temizlik (salona odak) -> Bar & Altın Makineler (bara yumuşak geçiş)
      if (t < 6.8) {
        const p = smoothstep(3.0, 6.5, t);
        _camPos.set(lerp(6.2, 7.8, p), lerp(12.6, 14.8, p), lerp(13.0, 15.2, p));
        _camLook.set(lerp(0.2, 0.0, p), 0.55, lerp(1.5, 2.2, p));
        cam.fov = lerp(33, 35, p);
      } else {
        const p = smoothstep(6.8, 9.6, t);
        _camPos.set(lerp(7.8, 6.4, p), lerp(14.8, 13.2, p), lerp(15.2, 10.8, p));
        _camLook.set(lerp(0.0, 0.2, p), 0.75, lerp(2.2, -2.6, p));
        cam.fov = lerp(35, 32, p);
      }
    } else if (t < 18.0) {
      // Aşama 3: Kasa Mega Para Kulesi yakın plan -> VIP & İmparatorluk geniş açı
      if (t < 13.0) {
        const p = smoothstep(10.0, 12.6, t);
        _camPos.set(lerp(6.4, 5.2, p), lerp(13.2, 11.8, p), lerp(10.8, 10.2, p));
        _camLook.set(lerp(0.2, -0.1, p), 0.85, lerp(-2.6, -1.1, p));
        cam.fov = lerp(32, 31, p);
      } else {
        const p = smoothstep(13.0, 17.5, t);
        _camPos.set(lerp(5.2, 10.5, p), lerp(11.8, 19.5, p), lerp(10.2, 22.5, p));
        _camLook.set(lerp(-0.1, -3.8, p), 0.6, lerp(-1.1, 6.2, p));
        cam.fov = lerp(31, 38, p);
      }
    } else {
      // Aşama 4: Endcard — tüm kafe imparatorluğu üzerinde yumuşak sinematik yükselme
      const p = smoothstep(18.0, 22.0, t);
      _camPos.set(lerp(10.5, 13.5, p), lerp(19.5, 24.0, p), lerp(22.5, 26.5, p));
      _camLook.set(lerp(-3.8, -2.2, p), 0.5, lerp(6.2, 4.5, p));
      cam.fov = lerp(38, 40, p);
    }

    cam.position.copy(_camPos);
    cam.lookAt(_camLook);
    cam.updateProjectionMatrix();
    const world = this.ctx.getWorld();
    world.focusX = _camLook.x;
    world.focusZ = _camLook.z;
    world.setViewFromCamera(cam);
    world.setCameraQuat(cam.quaternion);
    for (let i = 0; i < world.customers.length; i++) {
      world.customers[i].step(0.016, world.nav, true);
    }
    for (let i = 0; i < world.staff.length; i++) {
      world.staff[i].step(0.016, world.nav, true);
    }
  }

  /* ==========================================================================
   *  3D EFEKTLER: TEMİZLİK DALGASI, MEGA PARA KULESİ & MIKNATIS AKIŞI
   * ========================================================================== */

  private step3DProps(t: number, dt: number): void {
    // 1. ASMR Temizlik Dalgası Halkası (3.55s – 4.65s)
    if (this.cleanWaveRing.visible) {
      const p = (t - 3.55) / 1.05;
      if (p >= 0 && p <= 1) {
        const scale = lerp(0.5, 11.5, p);
        this.cleanWaveRing.scale.set(scale, 1, scale);
        this.cleanWaveRing.position.set(0, 0.18, lerp(1.8, 4.4, p));
        this.cleanWaveMat.opacity = (1 - p) * 0.85;
      } else {
        this.cleanWaveRing.visible = false;
      }
    }

    // 2. Altın Makine Taçlarının Dönüşü
    if (this.crownsGroup.visible) {
      for (let i = 0; i < this.crownMeshes.length; i++) {
        const m = this.crownMeshes[i];
        m.rotation.z = t * 2.6 + i * 0.7;
        m.position.y = 2.15 + Math.sin(t * 4.2 + i) * 0.08;
      }
    }

    // 3. Mıknatıs Banknot Akışı (13.0s – 16.5s arası kasadan oyuncunun sırtına parabolik yay)
    if (t >= 13.0 && t <= 16.5) {
      this.flyBillsMesh.count = FLY_BILL_COUNT;
      const player = this.ctx.player;
      const startX = -0.25;
      const startY = 1.1;
      const startZ = -1.1;
      for (let i = 0; i < FLY_BILL_COUNT; i++) {
        this.flyPhase[i] = (this.flyPhase[i] + dt * 2.4) % 1;
        const u = this.flyPhase[i];
        const arc = Math.sin(u * Math.PI) * (1.6 + (i % 3) * 0.35);
        _pos.set(
          lerp(startX, player.x, u) + Math.sin(u * 6 + i) * 0.18,
          lerp(startY, 1.35, u) + arc,
          lerp(startZ, player.z, u) + Math.cos(u * 6 + i) * 0.18,
        );
        _euler.set(u * 4.5, u * 6.2 + i, u * 3.1);
        _quat.setFromEuler(_euler);
        _scale.setScalar(0.95 - u * 0.25);
        _mat4.compose(_pos, _quat, _scale);
        this.flyBillsMesh.setMatrixAt(i, _mat4);
      }
      this.flyBillsMesh.instanceMatrix.needsUpdate = true;
    } else if (this.flyBillsMesh.count !== 0) {
      this.flyBillsMesh.count = 0;
    }
  }

  private rebuildCashTower(count: number): void {
    const clamped = Math.max(0, Math.min(TOWER_MAX_BILLS, count));
    this.towerMesh.count = clamped;
    this.towerBandMesh.count = clamped;
    const baseX = -0.25;
    const baseZ = -1.1;
    const perLayer = TOWER_COLS * TOWER_ROWS;
    _scale.set(1, 1, 1);

    for (let i = 0; i < clamped; i++) {
      const layer = Math.floor(i / perLayer);
      const rem = i % perLayer;
      const col = rem % TOWER_COLS;
      const row = Math.floor(rem / TOWER_COLS);
      const x = baseX + (col - (TOWER_COLS - 1) * 0.5) * 0.45;
      const z = baseZ + (row - (TOWER_ROWS - 1) * 0.5) * 0.27;
      const y = 0.08 + layer * 0.125;
      _pos.set(x, y, z);
      _euler.set(0, ((i * 17) % 7 - 3) * 0.025, 0);
      _quat.setFromEuler(_euler);
      _mat4.compose(_pos, _quat, _scale);
      this.towerMesh.setMatrixAt(i, _mat4);
      this.towerBandMesh.setMatrixAt(i, _mat4);
    }
    this.towerMesh.instanceMatrix.needsUpdate = true;
    this.towerBandMesh.instanceMatrix.needsUpdate = true;
  }

  /* ==========================================================================
   *  SAHTE EL İMLECİ (HAND CURSOR) & RIPPLE ANİMASYONU
   * ========================================================================== */

  private stepHandCursor(t: number): void {
    // Endcard deterministik opaklık/ölçek (18.0s – 22.0s)
    if (t >= 18.0) {
      const ep = smoothstep(18.0, 18.45, t);
      this.endcardEl.style.opacity = ep.toFixed(3);
      this.endcardEl.style.transform = `scale(${lerp(1.06, 1.0, ep).toFixed(4)})`;
    } else {
      this.endcardEl.style.opacity = '0';
      this.endcardEl.style.transform = 'scale(1.06)';
    }

    // 1. Kart Dokunuşu (3.05s – 4.2s): Sol Kart (ASMR Temizlik, tap @ 3.55s)
    if (t >= 3.05 && t < 4.2) {
      this.animateHandAt(this.cards.clean.el, t, 3.05, 3.55, 4.2);
      return;
    }
    // 2. Kart Dokunuşu (5.2s – 6.35s): Orta Kart (10X Hız & Ekip, tap @ 5.75s)
    if (t >= 5.2 && t < 6.35) {
      this.animateHandAt(this.cards.speed.el, t, 5.2, 5.75, 6.35);
      return;
    }
    // 3. Kart Dokunuşu (7.4s – 8.55s): Sağ Kart (Altın Makineler, tap @ 7.95s)
    if (t >= 7.4 && t < 8.55) {
      this.animateHandAt(this.cards.gold.el, t, 7.4, 7.95, 8.55);
      return;
    }
    // 4. VIP & Teras Mega Buton Dokunuşu (12.2s – 13.6s, tap @ 13.0s)
    if (t >= 12.2 && t < 13.6) {
      this.animateHandAt(this.vipBtnEl, t, 12.2, 13.0, 13.6);
      return;
    }
    // 5. Endcard CTA Butonu Üzerinde Nabız Dokunuşu (18.5s – 22.0s)
    if (t >= 18.5) {
      const cycleStart = 18.5 + Math.floor((t - 18.5) / 1.4) * 1.4;
      this.animateHandAt(this.endCtaEl, t, cycleStart, cycleStart + 0.55, cycleStart + 1.35);
      return;
    }

    this.handEl.style.opacity = '0';
    this.rippleEl.style.opacity = '0';
  }

  private animateHandAt(
    targetEl: HTMLElement,
    t: number,
    enterT: number,
    tapT: number,
    exitT: number,
  ): void {
    const rootRect = this.rootEl.getBoundingClientRect();
    const rect = targetEl.getBoundingClientRect();
    if (rect.width <= 0 || rootRect.width <= 0) return;

    const tx = rect.left - rootRect.left + rect.width * 0.56;
    const ty = rect.top - rootRect.top + rect.height * 0.58;
    const moveIn = smoothstep(enterT, tapT - 0.1, t);
    const fadeOut = 1 - smoothstep(exitT - 0.2, exitT, t);
    const alpha = Math.min(smoothstep(enterT, enterT + 0.18, t), fadeOut);

    const x = lerp(tx + 42, tx, moveIn);
    const y = lerp(ty + 68, ty, moveIn);
    this.handEl.style.transition = 'none';
    this.handEl.style.opacity = alpha.toFixed(3);
    this.handEl.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;

    // Basma (press) darbesi
    const tapDist = Math.abs(t - tapT);
    const press = tapDist < 0.18 ? Math.cos((tapDist / 0.18) * (Math.PI * 0.5)) : 0;
    const scale = lerp(1, 0.8, press);
    const rot = lerp(0, -10, press);
    this.handSvgWrapEl.style.transition = 'none';
    this.handSvgWrapEl.style.transform = `scale(${scale.toFixed(3)}) rotate(${rot.toFixed(1)}deg)`;

    // Ripple dalgası (tapT -> tapT + 0.52s)
    const rp = (t - tapT) / 0.52;
    if (rp >= 0 && rp <= 1) {
      this.rippleEl.style.animation = 'none';
      this.rippleEl.style.opacity = ((1 - rp) * 0.95).toFixed(3);
      this.rippleEl.style.transform = `scale(${lerp(0.3, 2.85, rp).toFixed(3)})`;
    } else {
      this.rippleEl.style.opacity = '0';
    }
  }

  /* ==========================================================================
   *  UI YARDIMCILARI (BAŞLIK, PARA SAYACI, UÇUŞAN YAZILAR & KARTLAR)
   * ========================================================================== */

  private triggerCardUpgrade(key: 'clean' | 'speed' | 'gold', badgeText: string): void {
    const card = this.cards[key];
    card.el.classList.remove('target-glow');
    card.el.classList.add('pressed', 'upgraded');
    card.lvlEl.textContent = badgeText;
    card.priceEl.textContent = COPY[this.lang].cardMaxed;
    setTimeout(() => card.el.classList.remove('pressed'), 180);
  }

  private addAdCash(amount: number, worldX: number, worldZ: number): void {
    this.targetMoney += amount;
    this.ctx.state.money = this.targetMoney;
    this.updateCashUI(true);
    this.ctx.scene3d.project(worldX, 1.5, worldZ, _screenPt);
    if (!_screenPt.behind) {
      this.ctx.ui.flyCoins(_screenPt.x, _screenPt.y, 4);
    }
  }

  private updateCashUI(bump: boolean): void {
    this.cashTextEl.textContent = formatAdCash(this.displayedMoney);
    if (bump) {
      this.cashPillEl.classList.add('bump');
      setTimeout(() => this.cashPillEl.classList.remove('bump'), 160);
    }
  }

  private float3DText(x: number, y: number, z: number, text: string, tone: 'good' | 'bad' | 'money'): void {
    this.ctx.scene3d.project(x, y, z, _screenPt);
    if (!_screenPt.behind) {
      this.ctx.ui.floatText(_screenPt.x, _screenPt.y, text, tone);
    }
  }

  private updateBannerForStage(): void {
    const c = COPY[this.lang];
    this.hookBannerEl.classList.add('pop');
    setTimeout(() => this.hookBannerEl.classList.remove('pop'), 240);

    if (this.stage === 'chaos') {
      this.hookBannerEl.textContent = c.hookChaos;
      this.statusPillEl.textContent = c.statusChaos;
    } else if (this.stage === 'clean') {
      this.hookBannerEl.textContent = c.hookClean;
      this.statusPillEl.textContent = c.statusClean;
    } else {
      this.hookBannerEl.textContent = c.hookTycoon;
      this.statusPillEl.textContent = c.statusTycoon;
    }
  }

  public setLang(lang: AdLang): void {
    this.lang = lang;
    this.applyCopy();
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    this.game.adSimPaused = paused;
    const c = COPY[this.lang];
    this.pauseBtnEl.textContent = paused ? `▶ ${c.btnResume}` : `⏸ ${c.btnPause}`;
  }

  public seek(seconds: number): void {
    this.restart();
    const world = this.ctx.getWorld();
    const steps = Math.min(440, Math.max(0, Math.floor(seconds / 0.05)));
    for (let i = 0; i < steps; i++) {
      this.time += 0.05;
      const nextStage: AdStage =
        this.time < 3.0 ? 'chaos' : this.time < 10.0 ? 'clean' : this.time < 18.0 ? 'tycoon' : 'endcard';
      if (nextStage !== this.stage) {
        this.stage = nextStage;
        this.rootEl.dataset.stage = nextStage;
        this.updateBannerForStage();
      }
      this.stepChoreography(this.time, 0.05);
      this.ctx.vfx.update(0.05, this.ctx.scene3d.camera.quaternion);
    }
    world.update(0.016, this.ctx.player, { spawnMult: 1, valueMult: 1, patienceMult: 1, tipMult: 1 });
    this.stepCamera(this.time);
    this.step3DProps(this.time, 0.05);
    this.stepHandCursor(this.time);
    this.ctx.forceRender();
  }

  public getTime(): number {
    return this.time;
  }

  public getStage(): AdStage {
    return this.stage;
  }

  /** Kare-kare (frame-by-frame) 60 FPS deterministik video kaydı hazırlığı. */
  public prepareForCapture(lang: AdLang = 'tr'): void {
    this.game.stop();
    this.setLang(lang);
    this.setPaused(false);
    document.body.classList.add('ad-recording-active');
    this.toolbarEl.classList.add('recording-hidden');
    this.syncViewport9x16();
    this.restart();
  }

  /** Tek bir kareyi (ör. 1/60 sn) deterministik olarak ilerletir ve sahneyi çizer. */
  public stepCaptureFrame(dt = 1 / 60): { time: number; stage: AdStage; money: number } {
    (this.game as unknown as { tick: (rawDt: number) => void }).tick(dt);
    return {
      time: this.time,
      stage: this.stage,
      money: Math.round(this.displayedMoney),
    };
  }

  private applyCopy(): void {
    const c = COPY[this.lang];
    this.updateBannerForStage();

    this.cards.clean.titleEl.textContent = c.cardCleanTitle;
    this.cards.clean.subEl.textContent = c.cardCleanSub;
    this.cards.clean.priceEl.textContent = this.cleanWaveTriggered ? c.cardMaxed : c.cardCleanPrice;

    this.cards.speed.titleEl.textContent = c.cardSpeedTitle;
    this.cards.speed.subEl.textContent = c.cardSpeedSub;
    this.cards.speed.priceEl.textContent = this.speedSquadTriggered ? c.cardMaxed : c.cardSpeedPrice;

    this.cards.gold.titleEl.textContent = c.cardGoldTitle;
    this.cards.gold.subEl.textContent = c.cardGoldSub;
    this.cards.gold.priceEl.textContent = this.goldenMachinesTriggered ? c.cardMaxed : c.cardGoldPrice;

    this.vipBtnEl.textContent = this.vipEmpireTriggered ? c.vipUnlockedBtn : c.vipUnlockBtn;

    this.endTitleEl.textContent = c.endTitle;
    this.endSubEl.textContent = c.endSubtitle;
    this.endRatingEl.textContent = c.endRating;
    this.endCtaEl.textContent = c.endCta;
    this.googleTopEl.textContent = c.googleTop;
    this.appleTopEl.textContent = c.appleTop;

    this.replayBtnEl.textContent = `↺ ${c.btnReplay}`;
    this.pauseBtnEl.textContent = this.paused ? `▶ ${c.btnResume}` : `⏸ ${c.btnPause}`;
    this.langBtnEl.textContent = `🌐 ${this.lang.toUpperCase()}`;
    this.recordBtnEl.textContent = this.isRecording ? `⏹ ${c.btnRecording}` : `🔴 ${c.btnRecord}`;
  }

  /* ==========================================================================
   *  KLAVYE KISAYOLLARI & 60 FPS VİDEO KAYDEDİCİ
   * ========================================================================== */

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'KeyR') {
      e.preventDefault();
      this.restart();
    } else if (e.code === 'Space') {
      e.preventDefault();
      this.setPaused(!this.paused);
    } else if (e.code === 'KeyL') {
      e.preventDefault();
      this.setLang(this.lang === 'tr' ? 'en' : 'tr');
    }
  }

  private toggleRecording(): void {
    if (this.isRecording) {
      this.stopRecording();
      return;
    }
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (!canvas || typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      return;
    }

    this.recordedChunks = [];
    const stream = canvas.captureStream(60);
    const mimeCandidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    let mimeType = '';
    for (const m of mimeCandidates) {
      if (MediaRecorder.isTypeSupported(m)) {
        mimeType = m;
        break;
      }
    }

    try {
      this.recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 })
        : new MediaRecorder(stream);
    } catch {
      return;
    }

    this.recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) this.recordedChunks.push(ev.data);
    };
    this.recorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kafe-caddesi-ad-9x16-60fps.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };

    this.isRecording = true;
    document.body.classList.add('ad-recording-active');
    this.toolbarEl.classList.add('recording-hidden');
    this.setPaused(false);
    this.restart();
    this.recorder.start(100);
    this.applyCopy();
  }

  private stopRecording(): void {
    if (!this.isRecording) return;
    this.isRecording = false;
    document.body.classList.remove('ad-recording-active');
    this.toolbarEl.classList.remove('recording-hidden');
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    this.recorder = null;
    this.applyCopy();
  }

  /* ==========================================================================
   *  DOM İNŞASI (SAF SVG ROZETLER, EL İMLECİ VE KARTLAR)
   * ========================================================================== */

  private buildDOM() {
    const rootEl = document.createElement('div');
    rootEl.className = 'ad-director-root';
    rootEl.dataset.stage = 'chaos';

    const screenFx = document.createElement('div');
    screenFx.className = 'ad-screen-fx';
    rootEl.appendChild(screenFx);

    /* ── Üst Bölge: Zaman Çubuğu + Hook Başlığı + Para Sayacı ── */
    const topZone = document.createElement('div');
    topZone.className = 'ad-top-zone';

    const progressTrack = document.createElement('div');
    progressTrack.className = 'ad-progress-track';
    const progressFillEl = document.createElement('div');
    progressFillEl.className = 'ad-progress-fill';
    progressTrack.appendChild(progressFillEl);
    topZone.appendChild(progressTrack);

    const hookBannerEl = document.createElement('div');
    hookBannerEl.className = 'ad-hook-banner';
    topZone.appendChild(hookBannerEl);

    const hudRow = document.createElement('div');
    hudRow.className = 'ad-hud-row';

    const cashPillEl = document.createElement('div');
    cashPillEl.className = 'ad-cash-pill';
    const cashIcon = document.createElement('span');
    cashIcon.className = 'ad-cash-icon';
    cashIcon.textContent = '₺';
    const cashTextEl = document.createElement('span');
    cashTextEl.textContent = '₺120';
    cashPillEl.append(cashIcon, cashTextEl);

    const statusPillEl = document.createElement('div');
    statusPillEl.className = 'ad-status-pill';
    hudRow.append(cashPillEl, statusPillEl);
    topZone.appendChild(hudRow);
    rootEl.appendChild(topZone);

    /* ── Alt Bölge: VIP Butonu + 3 Upgrade Kartı ── */
    const bottomZone = document.createElement('div');
    bottomZone.className = 'ad-bottom-zone';

    const vipBtnEl = document.createElement('div');
    vipBtnEl.className = 'ad-vip-unlock-btn';
    bottomZone.appendChild(vipBtnEl);

    const cardsRow = document.createElement('div');
    cardsRow.className = 'ad-cards-row';

    const makeCard = (icon: string) => {
      const el = document.createElement('div');
      el.className = 'ad-upgrade-card';
      const lvlEl = document.createElement('span');
      lvlEl.className = 'ad-card-level';
      lvlEl.textContent = 'LV.1';
      const iconEl = document.createElement('div');
      iconEl.className = 'ad-card-icon';
      iconEl.textContent = icon;
      const titleEl = document.createElement('div');
      titleEl.className = 'ad-card-title';
      const subEl = document.createElement('div');
      subEl.className = 'ad-card-sub';
      const priceEl = document.createElement('div');
      priceEl.className = 'ad-card-price';
      el.append(lvlEl, iconEl, titleEl, subEl, priceEl);
      cardsRow.appendChild(el);
      return { el, lvlEl, titleEl, subEl, priceEl };
    };

    const cards = {
      clean: makeCard('✨'),
      speed: makeCard('⚡'),
      gold: makeCard('👑'),
    };

    bottomZone.appendChild(cardsRow);
    rootEl.appendChild(bottomZone);

    /* ── Animasyonlu El İmleci & Ripple ── */
    const handEl = document.createElement('div');
    handEl.className = 'ad-hand-cursor';
    const rippleEl = document.createElement('div');
    rippleEl.className = 'ad-tap-ripple';
    handEl.appendChild(rippleEl);

    const handSvgWrap = document.createElement('div');
    handSvgWrap.className = 'ad-hand-svg';
    handSvgWrap.innerHTML = `
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 8C20 4.686 22.686 2 26 2C29.314 2 32 4.686 32 8V24H35C37.761 24 40 26.239 40 29V30H43C45.761 30 48 32.239 48 35V37H50C52.761 37 55 39.239 55 42V49C55 56.732 48.732 63 41 63H25C18.5 63 13.5 58.5 11.2 52.4L6.4 39.6C5.2 36.4 6.9 32.8 10.1 31.6C13.1 30.5 16.5 31.9 17.9 34.8L20 39V8Z" fill="#FFF8EE" stroke="#2B1708" stroke-width="3.2" stroke-linejoin="round"/>
        <circle cx="26" cy="8" r="3" fill="#FFD1A6"/>
      </svg>
    `;
    handEl.appendChild(handSvgWrap);
    rootEl.appendChild(handEl);

    /* ── 4. Aşama (18–22s) Mağaza Endcard Katmanı ── */
    const endcardEl = document.createElement('div');
    endcardEl.className = 'ad-endcard';

    const endcardCard = document.createElement('div');
    endcardCard.className = 'ad-endcard-card';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'ad-endcard-icon-wrap';
    iconWrap.innerHTML = `
      <div class="ad-endcard-icon-inner">
        <svg viewBox="0 0 64 64" width="58" height="58" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 14C22 10 25 8 25 4" stroke="#FFD666" stroke-width="3" stroke-linecap="round"/>
          <path d="M32 12C32 8 35 6 35 2" stroke="#FFD666" stroke-width="3" stroke-linecap="round"/>
          <path d="M42 14C42 10 45 8 45 4" stroke="#FFD666" stroke-width="3" stroke-linecap="round"/>
          <path d="M12 22H48V38C48 47.941 39.941 56 30 56C20.059 56 12 47.941 12 38V22Z" fill="url(#cupGrad)" stroke="#FFF3D1" stroke-width="2.8"/>
          <path d="M48 26H53C56.866 26 60 29.134 60 33C60 36.866 56.866 40 53 40H48" stroke="#FFD666" stroke-width="4" stroke-linecap="round"/>
          <ellipse cx="30" cy="22" rx="18" ry="4.5" fill="#6E3B1E" stroke="#FFF3D1" stroke-width="2.2"/>
          <defs>
            <linearGradient id="cupGrad" x1="12" y1="22" x2="48" y2="56" gradientUnits="userSpaceOnUse">
              <stop stop-color="#FFCF4B"/>
              <stop offset="1" stop-color="#D96B00"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    `;

    const endTitleEl = document.createElement('h1');
    endTitleEl.className = 'ad-endcard-title';
    const endSubEl = document.createElement('p');
    endSubEl.className = 'ad-endcard-subtitle';
    const endRatingEl = document.createElement('div');
    endRatingEl.className = 'ad-endcard-rating';

    const endCtaEl = document.createElement('button');
    endCtaEl.className = 'ad-endcard-cta';
    endCtaEl.type = 'button';
    endCtaEl.addEventListener('click', () => this.restart());

    const badgesWrap = document.createElement('div');
    badgesWrap.className = 'ad-store-badges';

    // Resmi Google Play Store SVG Rozeti
    const googleBadge = document.createElement('a');
    googleBadge.className = 'ad-store-badge';
    googleBadge.href = '#google-play';
    googleBadge.setAttribute('aria-label', 'Google Play Store');
    googleBadge.addEventListener('click', (e) => {
      e.preventDefault();
      this.restart();
    });
    googleBadge.innerHTML = `
      <svg viewBox="0 0 155 44" xmlns="http://www.w3.org/2000/svg">
        <path d="M10.4 7.5C10.1 7.9 9.9 8.5 9.9 9.3V34.7C9.9 35.5 10.1 36.1 10.4 36.5L10.6 36.7L24.8 22.5V22.2V21.9L10.6 7.7L10.4 7.5Z" fill="#00D2FF"/>
        <path d="M29.5 27.2L24.8 22.5V22.2V21.9L29.5 17.2L29.7 17.3L35.3 20.5C36.9 21.4 36.9 22.9 35.3 23.8L29.7 27L29.5 27.2Z" fill="#FFCE00"/>
        <path d="M29.7 27L24.8 22.2L10.4 36.5C10.9 37.1 11.8 37.2 12.8 36.6L29.7 27Z" fill="#FF3A44"/>
        <path d="M29.7 17.3L12.8 7.7C11.8 7.1 10.9 7.2 10.4 7.8L24.8 22.2L29.7 17.3Z" fill="#00F076"/>
        <text class="ad-google-top" x="44" y="15" fill="#D9D9D9" font-size="8.2" font-weight="700" font-family="Nunito, sans-serif">GET IT ON</text>
        <text x="44" y="31" fill="#FFFFFF" font-size="15.5" font-weight="900" font-family="Nunito, sans-serif">Google Play</text>
      </svg>
    `;
    const googleTopEl = googleBadge.querySelector('.ad-google-top') as SVGTextElement;

    // Resmi App Store SVG Rozeti
    const appleBadge = document.createElement('a');
    appleBadge.className = 'ad-store-badge';
    appleBadge.href = '#app-store';
    appleBadge.setAttribute('aria-label', 'App Store');
    appleBadge.addEventListener('click', (e) => {
      e.preventDefault();
      this.restart();
    });
    appleBadge.innerHTML = `
      <svg viewBox="0 0 155 44" xmlns="http://www.w3.org/2000/svg">
        <path d="M28.2 23.3C28.2 19.6 31.2 17.8 31.4 17.7C29.6 15.1 26.9 14.8 25.9 14.7C23.6 14.5 21.3 16.1 20.2 16.1C19 16.1 17.2 14.7 15.3 14.8C12.8 14.8 10.5 16.2 9.2 18.5C6.6 23 8.5 29.7 11.1 33.4C12.3 35.2 13.8 37.2 15.8 37.1C17.7 37 18.5 35.9 20.8 35.9C23.1 35.9 23.8 37.1 25.8 37.1C27.9 37.1 29.1 35.3 30.4 33.5C31.9 31.4 32.5 29.3 32.5 29.2C32.4 29.1 28.2 27.5 28.2 23.3ZM24.4 12.2C25.4 10.9 26.1 9.2 25.9 7.4C24.4 7.5 22.5 8.4 21.4 9.7C20.5 10.7 19.7 12.5 19.9 14.2C21.6 14.3 23.3 13.4 24.4 12.2Z" fill="#FFFFFF"/>
        <text class="ad-apple-top" x="40" y="15" fill="#D9D9D9" font-size="8.2" font-weight="700" font-family="Nunito, sans-serif">Download on the</text>
        <text x="40" y="31" fill="#FFFFFF" font-size="16" font-weight="900" font-family="Nunito, sans-serif">App Store</text>
      </svg>
    `;
    const appleTopEl = appleBadge.querySelector('.ad-apple-top') as SVGTextElement;

    badgesWrap.append(googleBadge, appleBadge);
    endcardCard.append(iconWrap, endTitleEl, endSubEl, endRatingEl, endCtaEl, badgesWrap);
    endcardEl.appendChild(endcardCard);
    rootEl.appendChild(endcardEl);

    /* ── Kontrol & 60 FPS Video Kayıt Araç Çubuğu ── */
    const toolbarEl = document.createElement('div');
    toolbarEl.className = 'ad-toolbar';

    const timeReadoutEl = document.createElement('span');
    timeReadoutEl.className = 'ad-tool-btn time-readout';
    timeReadoutEl.textContent = '0.0s / 22.0s';

    const replayBtnEl = document.createElement('button');
    replayBtnEl.className = 'ad-tool-btn';
    replayBtnEl.type = 'button';
    replayBtnEl.addEventListener('click', () => this.restart());

    const pauseBtnEl = document.createElement('button');
    pauseBtnEl.className = 'ad-tool-btn';
    pauseBtnEl.type = 'button';
    pauseBtnEl.addEventListener('click', () => this.setPaused(!this.paused));

    const langBtnEl = document.createElement('button');
    langBtnEl.className = 'ad-tool-btn';
    langBtnEl.type = 'button';
    langBtnEl.addEventListener('click', () => this.setLang(this.lang === 'tr' ? 'en' : 'tr'));

    const recordBtnEl = document.createElement('button');
    recordBtnEl.className = 'ad-tool-btn record-btn';
    recordBtnEl.type = 'button';
    recordBtnEl.addEventListener('click', () => this.toggleRecording());

    toolbarEl.append(timeReadoutEl, replayBtnEl, pauseBtnEl, langBtnEl, recordBtnEl);

    return {
      rootEl,
      progressFillEl,
      hookBannerEl,
      cashPillEl,
      cashTextEl,
      statusPillEl,
      vipBtnEl,
      cards,
      handEl,
      handSvgWrap,
      rippleEl,
      endcardEl,
      endTitleEl,
      endSubEl,
      endRatingEl,
      endCtaEl,
      googleTopEl,
      appleTopEl,
      toolbarEl,
      timeReadoutEl,
      replayBtnEl,
      pauseBtnEl,
      langBtnEl,
      recordBtnEl,
    };
  }
}

export function installAdDirector(game: Game): AdDirector {
  const director = new AdDirector(game);
  (window as unknown as { __adDirector?: AdDirector }).__adDirector = director;
  return director;
}
