import { tr,localeTag } from "../core/I18n";
import { HAPPY_HOUR_STEP_SECONDS } from '../core/Ads';
import type { UIApi, UiAdKind, UiEventBanner, UiHudState, UiPanelId, UiSideActivityRow } from './api';
import { bus, sfx } from '../core/EventBus';
import { clamp01, damp, formatPct } from '../core/MathUtils';

import { setIconText } from './Icons';

/** Küçük DOM yardımcısı — tüm UI modülleri bunu kullanır. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) setIconText(n, text);
  return n;
}

/** 0xrrggbb → "#rrggbb" */
export function hexColor(n: number): string {
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}

/** Yay/halka bileşeni. Yüzde `--p` custom property'si ile yazılır. */
export function makeRing(cls: string, txt: string): { root: HTMLSpanElement; text: HTMLSpanElement } {
  const root = el('span', 'ring ' + cls);
  root.appendChild(el('i', 'ring-arc'));
  const text = el('span', 'ring-txt', txt);
  root.appendChild(text);
  return { root, text };
}

/**
 * UI'ya yapılan dokunuş canvas'a sızmasın — aksi halde butona basarken
 * joystick de doğuyor. Sadece pointerdown durdurulur, click akmaya devam eder.
 */
export function blockPointer(node: HTMLElement): void {
  node.addEventListener('pointerdown', (e) => e.stopPropagation());
}

/** Animasyonu reflow okumadan yeniden tetikler (a/b sınıf takası). */
export function retrigger(node: HTMLElement, a: string, b: string): void {
  if (node.classList.contains(a)) {
    node.classList.remove(a);
    node.classList.add(b);
  } else {
    node.classList.remove(b);
    node.classList.add(a);
  }
}

const MAX_PIPS = 20;

/** Hijyen halkasının renk kademeleri — indeks 0 iyi, 2 kritik. */
const HYG_CLS: readonly string[] = ['h-ok', 'h-mid', 'h-low'];

interface SideDef {
  id: UiPanelId;
  glyph: string;
  cap: string;
  label: string;
}

const SIDE: readonly SideDef[] = [
  { id: 'upgrades', glyph: '⬆️', cap: tr("YÜKSELT"), label: tr("Yükseltmeler") },
  { id: 'staff', glyph: '👷', cap: tr("PERSONEL"), label: tr("Personel") },
  { id: 'locations', glyph: '🏪', cap: tr("ŞUBE"), label: tr("Şubeler") },
  { id: 'settings', glyph: '⚙️', cap: tr("AYAR"), label: tr("Ayarlar") },
];

interface SideJobSlot {
  id: UiSideActivityRow['id'];
  root: HTMLButtonElement;
  title: HTMLSpanElement;
  summary: HTMLSpanElement;
  reward: HTMLSpanElement;
  fill: HTMLElement;
  signature: string;
}

interface EventSlot {
  id: string;
  root: HTMLDivElement;
  bar: HTMLElement;
  remaining: number;
  duration: number;
  lastW: number;
  dying: boolean;
  deathT: number;
  priority: number;
}

/**
 * Üst bar, hedef şeridi, şube halkası, sağ-alt buton yığını,
 * taşıma göstergesi ve olay bandı.
 */
export class HUD {
  readonly root: HTMLDivElement;
  private readonly vacuumButton: HTMLButtonElement;
  private readonly vacuumLabel: HTMLSpanElement;
  private readonly vacuumHint: HTMLSpanElement;
  private vacuumSignature = '';

  private readonly api: UIApi;
  private readonly onPanel: (id: UiPanelId) => void;

  // --- önbelleğe alınmış düğümler (update asla DOM sorgulamaz) ---
  private readonly moneyPill: HTMLDivElement;
  private readonly moneyVal: HTMLSpanElement;
  private readonly repRing: HTMLSpanElement;
  private readonly repVal: HTMLSpanElement;
  private readonly repMultEl: HTMLSpanElement;
  private readonly incomeVal: HTMLSpanElement;

  private readonly hygPill: HTMLDivElement;
  private readonly hygRing: HTMLSpanElement;
  private readonly hygVal: HTMLSpanElement;
  private readonly hygMultEl: HTMLSpanElement;

  /** Tempo pili (v5.2) — hijyenin kardeşi, bkz. `.pill-tempo` kurulumu. */
  private readonly tempoPill: HTMLDivElement;
  private readonly tempoRing: HTMLSpanElement;
  private readonly tempoVal: HTMLSpanElement;

  private readonly cafeChip: HTMLDivElement;
  private readonly cafeSeats: HTMLSpanElement;
  private readonly cafeDirty: HTMLSpanElement;
  private readonly cafeDirtyNum: HTMLSpanElement;
  private readonly cafeOrders: HTMLSpanElement;
  private readonly cafeOrdersNum: HTMLSpanElement;
  private readonly cafeSpill: HTMLSpanElement;
  private readonly cafeSpillNum: HTMLSpanElement;
  private readonly cafeSupply: HTMLSpanElement;

  private readonly actionLine: HTMLDivElement;
  private readonly streakLine: HTMLDivElement;
  private readonly sideJobsToggle: HTMLButtonElement;
  private sideJobsExpanded = false;
  private readonly sideJobs: HTMLDivElement;
  private readonly sideJobSlots: SideJobSlot[] = [];
  private sideJobsVisible = false;

  private readonly goalBtn: HTMLButtonElement;
  private readonly goalTitle: HTMLSpanElement;
  private readonly goalCount: HTMLSpanElement;
  private readonly goalReward: HTMLSpanElement;
  private readonly goalFill: HTMLElement;
  /** Hedef şeridinin bildirim noktası — alınmayı bekleyen ödül varken yanar. */
  private readonly goalDot: HTMLSpanElement;

  /** Üst şeritteki festival çipi (v5.1) — tıklayınca Hedefler açılır. */
  private readonly festChip: HTMLButtonElement;
  private readonly festChipGlyph: HTMLSpanElement;
  private readonly festChipName: HTMLSpanElement;

  private readonly locBtn: HTMLButtonElement;
  private readonly locName: HTMLSpanElement;
  private readonly locRing: HTMLSpanElement;
  private readonly locPct: HTMLSpanElement;

  private readonly dots: HTMLSpanElement[] = [];
  private readonly sideBtns: HTMLButtonElement[] = [];
  private readonly sideSubs: HTMLSpanElement[] = [];
  private readonly onboardBox: HTMLDivElement;
  private readonly onboardTitle: HTMLDivElement;
  private readonly onboardText: HTMLDivElement;
  private activeOnboard: 'upgrade' | 'staff' | null = null;
  private lastUpOnboarded = false;
  private lastStaffOnboarded = false;
  private lastTutorialActive = true;

  private readonly carry: HTMLDivElement;
  private readonly carryGlyph: HTMLSpanElement;
  private readonly carryNum: HTMLSpanElement;
  private readonly pips: HTMLElement[] = [];

  private readonly eventsBox: HTMLDivElement;
  private readonly adChip: HTMLDivElement;
  /** Çipteki geri sayım halkası — her gösterimde yeniden kurulur. */
  private adChipRing: HTMLElement | null = null;
  /** Halkaya son yazılan oran; yalnız görünür değişimde stile yazılır. */
  private adChipP = -1;
  /** Çipe basılınca çağrılır; UIRoot bağlar. */
  onAdChip: ((kind: UiAdKind) => void) | null = null;
  private readonly events: EventSlot[] = [];

  // --- son yazılan değerler (yalnızca değişince yaz) ---
  private moneyShown = 0;
  private moneyReal = -1;
  private lastMoneyInt = -1;
  private lastMoneyTxt = '';
  private bumpCd = 0;

  private lastRep = -1;
  private lastRepMult = -1;
  private lastIncomeInt = -1;

  private lastHyg = -1;
  private lastHygMult = -1;
  /** Kurucu pili 'h-ok' ile açar — takas mantığı buradan başlar. */
  private lastHygLvl = 0;
  private hygActive: boolean | null = null;

  /** Son yazılan tempo yüzdesi (0-100) — yalnız değişince DOM'a yazılır. */
  private lastTempo = -1;

  private cafeVisible: boolean | null = null;
  private lastSeatsU = -1;
  private lastSeatsT = -1;
  private seatsFull: boolean | null = null;
  private lastDirty = -1;
  private dirtyHot: boolean | null = null;
  private lastOrders = -1;
  private ordersHot: boolean | null = null;
  private lastSpills = -1;
  private lastLowSupply: boolean | null = null;

  private lastGoalId = '';
  private lastGoalCur = -1;
  private lastGoalTgt = -1;
  private lastGoalP = -1;
  private goalVisible = true;

  private lastLocName = '';
  private lastProg = -1;

  private lastCarry = -1;
  private lastCarryMax = -1;
  private lastCarryItem = '';
  private lastCarrySlots = '';

  /** Aşamalı HUD bayrakları (tickIntro) — belirince bir daha gizlenmez. */
  private introRep = false;
  private introSide = false;
  private introIncome = false;
  private introLoc = false;
  private introFest = false;
  private introTempo = false;
  /** Çipe son yazılan festival — haftada bir değişir, her karede yazılmaz. */
  private lastFestId = '';
  private goalDotOn: boolean | null = null;
  private repPill!: HTMLDivElement;
  private incomePill!: HTMLDivElement;
  private sideBox!: HTMLDivElement;
  private readonly boostBtn: HTMLButtonElement;
  private readonly boostVal: HTMLSpanElement;
  private readonly boostSub: HTMLSpanElement;
  private lastBoostShown: boolean | null = null;
  private lastBoostSec = -1;
  private lastBoostActive: boolean | null = null;
  private lastBoostMax: boolean | null = null;
  private lastBoostUrgent: boolean | null = null;
  private boostInFlight = false;
  private lastAction: string | null = null;
  private lastStreak: string | null = null;

  private badgeDirty = true;
  private badgeCd = 0;
  private readonly dotState: boolean[] = [false, false, false, false];
  private readonly dotCountState: number[] = [0, 0, 0, 0];
  private readonly subTxtState: string[] = ['', '', '', ''];
  private readonly subProgState: number[] = [-1, -1, -1, -1];

  private readonly offs: (() => void)[] = [];

  constructor(api: UIApi, onPanel: (id: UiPanelId) => void) {
    this.api = api;
    this.onPanel = onPanel;

    const root = el('div', 'hud');
    this.root = root;

    // ---- üst yığın (bar + hedef şeridi akışta durur) ----
    const stack = el('div', 'hud-stack');
    root.appendChild(stack);

    // ---- üst bar ----
    const top = el('div', 'hud-top');
    const brand = el('div', 'brand');
    brand.appendChild(el('span', 'brand-a', 'KAFE'));
    brand.appendChild(el('span', 'brand-b', 'CADDESİ'));
    top.appendChild(brand);

    this.moneyPill = el('div', 'pill pill-money');
    this.moneyPill.appendChild(el('span', 'pill-icon', '☕'));
    this.moneyVal = el('span', 'pill-val', '₺0');
    this.moneyPill.appendChild(this.moneyVal);
    top.appendChild(this.moneyPill);

    const inc = el('div', 'pill pill-income hide');
    this.incomePill = inc;
    inc.appendChild(el('span', 'pill-icon', '⚡'));
    this.incomeVal = el('span', 'pill-val', tr('₺{0}/sn', 0));
    inc.appendChild(this.incomeVal);
    top.appendChild(inc);

    // İtibar + hijyen kardeş göstergeler: dar ekranda birlikte alt satıra iner.
    const pair = el('div', 'pill-pair');

    /**
     * AŞAMALI HUD. İlk açılışta ekranda yalnız para pili + hedef şeridi
     * kalır; itibar, gelir/sn, yan butonlar ve şube kutusu ilgili sistem
     * devreye girince belirir (tickIntro). "İlk ekranda 10 gösterge"
     * yeni oyuncunun 'çok karışık' şikâyetinin ana kaynağıydı.
     */
    /**
     * İTİBAR PİLİ EKRANDA YOK. "Yıldızlı 86 ne, hiç anlamadım" — haklı:
     * itibar oyuncunun DOĞRUDAN yönetmediği türetilmiş bir çarpan; ona
     * ayrı bir sayaç göstermek kafa karıştırmaktan başka iş görmüyordu.
     * Mekanik aynen çalışmaya devam eder (memnun müşteri → daha çok
     * müşteri/gelir), yalnızca ayrı bir gösterge işgal etmez. Öğeler
     * kuruluyor ama HUD'a EKLENMİYOR — tick yolları dokunmadan çalışsın.
     */
    const repPill = el('div', 'pill pill-rep hide');
    this.repPill = repPill;
    const rep = makeRing('', '★');
    this.repRing = rep.root;
    repPill.appendChild(this.repRing);
    this.repVal = el('span', 'pill-val', '0');
    repPill.appendChild(this.repVal);
    this.repMultEl = el('span', 'pill-sub', '1,00×');
    repPill.appendChild(this.repMultEl);

    // Hijyen — "Tuvalet & Hijyen" bölgesi açılana kadar tamamen gizli.
    this.hygPill = el('div', 'pill pill-hyg h-ok hide');
    this.hygPill.title = tr("Mekân temizliği");
    const hyg = makeRing('', '🧹');
    this.hygRing = hyg.root;
    this.hygPill.appendChild(this.hygRing);
    this.hygVal = el('span', 'pill-val', '0');
    this.hygPill.appendChild(this.hygVal);
    this.hygMultEl = el('span', 'pill-sub', '1,00×');
    this.hygPill.appendChild(this.hygMultEl);

    /**
     * TEMPO PİLİ (v5.2). Hijyenin kardeşi — aynı `pill-pair` içinde durur,
     * dar ekranda onunla birlikte alt satıra iner. Beşinci yuvarlak yan
     * buton eklenmediği gibi burada da ÜÇÜNCÜ SATIR açılmaz: telefonda
     * üst yığın iki satırda kalır (mevcut kural).
     *
     * Hijyeninkinden FARKLI olarak bir sistemin aktifliğine değil öğretici
     * bitimine bağlı (bkz. tickIntro/introTempo) — kafenin ritmi ayrı bir
     * bölge açılışını beklemeden en baştan akan bir kavram.
     *
     * Simge 💓, ⚡ DEĞİL: gelir/sn pili (aşağıda, `incomePill`) zaten ⚡
     * taşıyor — aynı simge iki farklı ölçeri okunmaz kılardı. Kalp,
     * README'nin kendi cümlesiyle de örtüşüyor: "kimse senden hızlı değil;
     * kafenin kalbi hep sensin."
     */
    this.tempoPill = el('div', 'pill pill-tempo hide');
    this.tempoPill.title = tr("Kafenin ritmi — sen çalıştıkça yükselir");
    const tmp = makeRing('', '💓');
    this.tempoRing = tmp.root;
    this.tempoPill.appendChild(this.tempoRing);
    this.tempoVal = el('span', 'pill-val', '%0');
    this.tempoPill.appendChild(this.tempoVal);
    pair.appendChild(this.tempoPill);

    pair.appendChild(this.hygPill);

    top.appendChild(pair);

    /**
     * FESTİVAL ÇİPİ (v5.1). Haftanın festivali HUD'da küçük bir çip olarak
     * hedef şeridinin sağındaki `hud-aside` bloğunda durur. Beşinci
     * yuvarlak yan buton BİLEREK eklenmedi — o yığın dörtte tutuluyor;
     * çip zaten Hedefler panelinin bir kısayolu.
     */
    this.festChip = el('button', 'fest-chip hide');
    this.festChip.type = 'button';
    this.festChip.setAttribute('aria-label', tr("Haftanın festivali"));
    this.festChipGlyph = el('span', 'fest-chip-glyph', '🎪');
    this.festChip.appendChild(this.festChipGlyph);
    this.festChipName = el('span', 'fest-chip-name', '');
    this.festChip.appendChild(this.festChipName);
    this.festChip.addEventListener('click', () => {
      sfx('ui_click');
      this.onPanel('goals');
    });
    blockPointer(this.festChip);

    // ---- x2 GELİR Boost Butonu ----
    this.boostBtn = el('button', 'boost-btn hide');
    this.boostBtn.type = 'button';
    this.boostBtn.setAttribute('aria-label', tr("x2 Gelir"));
    const boostIcon = el('span', 'boost-icon', '⚡');
    this.boostBtn.appendChild(boostIcon);
    const boostText = el('span', 'boost-text');
    this.boostVal = el('span', 'boost-val', tr('x2 GELİR'));
    this.boostSub = el('span', 'boost-sub', tr('İZLE'));
    boostText.append(this.boostVal, this.boostSub);
    this.boostBtn.appendChild(boostText);
    blockPointer(this.boostBtn);

    this.boostBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (this.boostInFlight) return;
      const s = this.api.getHud();
      if ((s.boostLeft ?? 0) >= (s.boostMax ?? 1200)) {
        sfx('ui_click');
        return;
      }
      this.boostInFlight = true;
      this.boostBtn.classList.add('loading');
      sfx('ui_click');
      try {
        await this.api.watchAd('happy_hour');
      } finally {
        this.boostInFlight = false;
        this.boostBtn.classList.remove('loading');
      }
    });
    top.appendChild(this.boostBtn);

    stack.appendChild(top);
    this.actionLine = el('div', 'hud-action hide');
    stack.appendChild(this.actionLine);

    // ---- hedef şeridi + şube ----
    const sub = el('div', 'hud-sub');

    this.goalBtn = el('button', 'goal');
    this.goalBtn.type = 'button';
    const gTop = el('span', 'goal-top');
    this.goalTitle = el('span', 'goal-title', tr("Hedef yükleniyor…"));
    this.goalCount = el('span', 'goal-count', '');
    this.goalReward = el('span', 'goal-reward', '');
    gTop.appendChild(this.goalTitle);
    gTop.appendChild(this.goalCount);
    gTop.appendChild(this.goalReward);
    this.goalBtn.appendChild(gTop);
    const gBar = el('span', 'goal-bar');
    this.goalFill = el('i');
    gBar.appendChild(this.goalFill);
    this.goalBtn.appendChild(gBar);
    /* Bildirim noktası: yan butonların side-dot kalıbının aynısı — panelde
     * alınmayı bekleyen ödül (günlük/haftalık/festival/albüm) varken yanar. */
    this.goalDot = el('span', 'goal-dot');
    this.goalBtn.appendChild(this.goalDot);
    this.goalBtn.addEventListener('click', () => {
      sfx('ui_click');
      this.onPanel('goals');
    });
    blockPointer(this.goalBtn);
    sub.appendChild(this.goalBtn);

    // Sağ blok: festival çipi + kafe rozeti + şube kutusu. Dar ekranda birlikte
    // sağa yaslanır, böylece hedef şeridiyle veya şube halkasıyla çakışmaz.
    const aside = el('div', 'hud-aside');
    aside.appendChild(this.festChip);

    /**
     * KAFE ROZETİ — dört acil işi tek satırda gösterir:
     * dolu sandalye · SERVİS BEKLEYEN sipariş · kirli masa · zemin lekesi,
     * en sağda tuvalet sarfı azaldığında beliren uyarı.
     * Sıra bilinçli: oyuncunun önce bakması gereken şey bekleyen siparişdir.
     */
    this.cafeChip = el('div', 'cafe hide');
    this.cafeChip.title = tr("Salon durumu");
    const seatBox = el('span', 'cafe-seats');
    seatBox.appendChild(el('span', 'cafe-g', '🪑'));
    this.cafeSeats = el('span', 'cafe-num', '0/0');
    seatBox.appendChild(this.cafeSeats);
    this.cafeChip.appendChild(seatBox);

    this.cafeOrders = el('span', 'cafe-orders hide');
    this.cafeOrders.title = tr("Servis bekleyen sipariş");
    this.cafeOrders.appendChild(el('span', 'cafe-g', '🧾'));
    this.cafeOrdersNum = el('span', 'cafe-num', '0');
    this.cafeOrders.appendChild(this.cafeOrdersNum);
    this.cafeChip.appendChild(this.cafeOrders);

    this.cafeDirty = el('span', 'cafe-dirty hide');
    this.cafeDirty.title = tr("Toplanmayı bekleyen masa");
    this.cafeDirty.appendChild(el('span', 'cafe-g', '🍽️'));
    this.cafeDirtyNum = el('span', 'cafe-num', '0');
    this.cafeDirty.appendChild(this.cafeDirtyNum);
    this.cafeChip.appendChild(this.cafeDirty);

    this.cafeSpill = el('span', 'cafe-spill hide');
    this.cafeSpill.title = tr("Zemindeki leke");
    this.cafeSpill.appendChild(el('span', 'cafe-g', '🧽'));
    this.cafeSpillNum = el('span', 'cafe-num', '0');
    this.cafeSpill.appendChild(this.cafeSpillNum);
    this.cafeChip.appendChild(this.cafeSpill);

    this.cafeSupply = el('span', 'cafe-supply hide');
    this.cafeSupply.title = tr("Tuvalet sarf malzemesi azaldı");
    this.cafeSupply.appendChild(el('span', 'cafe-g', '🧻'));
    this.cafeChip.appendChild(this.cafeSupply);

    aside.appendChild(this.cafeChip);

    this.locBtn = el('button', 'loc hide');
    this.locBtn.type = 'button';
    const lr = makeRing('', '%0');
    this.locRing = lr.root;
    this.locPct = lr.text;
    this.locBtn.appendChild(this.locRing);
    this.locName = el('span', 'loc-name', '');
    this.locBtn.appendChild(this.locName);
    this.locBtn.addEventListener('click', () => {
      sfx('ui_click');
      this.onPanel('locations');
    });
    blockPointer(this.locBtn);
    aside.appendChild(this.locBtn);

    sub.appendChild(aside);
    stack.appendChild(sub);

    this.streakLine = el('div', 'hud-streak hide');
    stack.appendChild(this.streakLine);

    // Side businesses stay in one compact row; buttons guide the next real action.
    this.sideJobsToggle = el('button', 'side-jobs-toggle hide', tr("Yan işler"));
    this.sideJobsToggle.type = 'button';
    this.sideJobsToggle.setAttribute('aria-expanded', 'false');
    this.sideJobsToggle.setAttribute('aria-controls', 'side-jobs');
    this.sideJobsToggle.addEventListener('click', () => {
      sfx('ui_click'); this.setSideJobsExpanded(!this.sideJobsExpanded);
    });
    blockPointer(this.sideJobsToggle);
    top.appendChild(this.sideJobsToggle);
    this.sideJobs = el('div', 'side-jobs hide collapsed');
    this.sideJobs.id = 'side-jobs';
    this.sideJobs.setAttribute('role', 'group');
    this.sideJobs.setAttribute('aria-label', tr("Yan işler"));
    for (const id of ['garden', 'courtyard'] as const) {
      const button = el('button', 'side-job hide');
      button.type = 'button';
      button.dataset.activity = id;
      const heading = el('span', 'side-job-heading');
      const title = el('span', 'side-job-title');
      const reward = el('span', 'side-job-reward');
      heading.append(title, reward);
      const summary = el('span', 'side-job-summary');
      const bar = el('span', 'side-job-bar');
      const fill = el('i');
      bar.setAttribute('aria-hidden', 'true');
      bar.appendChild(fill);
      button.append(heading, summary, bar);
      button.addEventListener('click', () => {
        sfx('ui_click');
        this.api.focusSideActivity(id);
        this.setSideJobsExpanded(false);
      });
      blockPointer(button);
      this.sideJobs.appendChild(button);
      this.sideJobSlots.push({ id, root: button, title, summary, reward, fill, signature: '' });
    }
    stack.appendChild(this.sideJobs);

    // ---- sağ alt buton yığını ----
    const side = el('div', 'side hide');
    this.sideBox = side;
    for (let i = 0; i < SIDE.length; i++) {
      const def = SIDE[i];
      const isPrimary = def.id === 'upgrades' || def.id === 'staff';
      const b = el('button', 'side-btn' + (isPrimary ? ' side-btn-hero' : ''));
      b.type = 'button';
      b.dataset.sideId = def.id;
      b.setAttribute('aria-label', def.label);
      b.title = def.label;
      b.appendChild(el('span', 'side-glyph', def.glyph));
      b.appendChild(el('span', 'side-cap', def.cap));
      const sub = el('span', 'side-sub', '');
      if (!isPrimary) sub.style.display = 'none';
      b.appendChild(sub);
      const dot = el('span', 'side-dot');
      b.appendChild(dot);
      b.addEventListener('click', () => {
        sfx('ui_click');
        this.onPanel(def.id);
      });
      blockPointer(b);
      this.dots.push(dot);
      this.sideSubs.push(sub);
      this.sideBtns.push(b);
      side.appendChild(b);
    }

    // ---- sağ alt mikro-rehber (onboarding) balonu ----
    this.onboardBox = el('div', 'onboard-callout hide');
    const obBody = el('button', 'onboard-body');
    obBody.type = 'button';
    this.onboardTitle = el('div', 'onboard-title', '');
    this.onboardText = el('div', 'onboard-text', '');
    obBody.append(this.onboardTitle, this.onboardText);
    obBody.addEventListener('click', () => {
      sfx('ui_click');
      if (this.activeOnboard === 'staff') this.onPanel('staff');
      else this.onPanel('upgrades');
    });
    const obSkip = el('button', 'onboard-skip', tr('Atla ✕'));
    obSkip.type = 'button';
    obSkip.addEventListener('click', (e) => {
      e.stopPropagation();
      sfx('ui_click');
      if (this.activeOnboard) {
        this.api.dismissOnboarding?.(this.activeOnboard);
        this.setOnboarding(null);
      }
    });
    const obArrow = el('span', 'onboard-arrow', '👉');
    obArrow.setAttribute('aria-hidden', 'true');
    this.onboardBox.append(obBody, obSkip, obArrow);
    blockPointer(this.onboardBox);
    side.appendChild(this.onboardBox);

    root.appendChild(side);

    this.vacuumButton = el('button', 'vacuum-toggle hide');
    this.vacuumButton.type = 'button';
    this.vacuumButton.setAttribute('aria-pressed', 'false');
    this.vacuumButton.appendChild(el('span', 'vacuum-glyph', '🧹'));
    const vacuumText = el('span', 'vacuum-text');
    this.vacuumLabel = el('span', 'vacuum-label');
    this.vacuumHint = el('span', 'vacuum-hint');
    vacuumText.append(this.vacuumLabel, this.vacuumHint);
    this.vacuumButton.appendChild(vacuumText);
    blockPointer(this.vacuumButton);
    this.vacuumButton.addEventListener('click', () => {
      if (this.api.toggleVacuum()) this.tickVacuum(this.api.getHud());
    });
    root.appendChild(this.vacuumButton);

    // ---- taşıma göstergesi ----
    this.carry = el('div', 'carry hide');
    this.carryGlyph = el('span', 'carry-glyph', '🧺');
    this.carry.appendChild(this.carryGlyph);
    const pipBox = el('div', 'carry-pips');
    for (let i = 0; i < MAX_PIPS; i++) {
      const p = el('i', 'pip hide');
      this.pips.push(p);
      pipBox.appendChild(p);
    }
    this.carry.appendChild(pipBox);
    this.carryNum = el('span', 'carry-num hide', '');
    this.carry.appendChild(this.carryNum);
    root.appendChild(this.carry);

    // ---- olay bandı ----
    this.eventsBox = el('div', 'events');
    root.appendChild(this.eventsBox);

    this.adChip = el('div', 'adchip');
    this.adChip.style.display = 'none';
    blockPointer(this.adChip);
    root.appendChild(this.adChip);

    // rozetler para/yenileme olaylarında bayrağa alınır, update'te işlenir
    this.offs.push(bus.on('money:changed', () => (this.badgeDirty = true)));
    this.offs.push(bus.on('ui:refresh', () => (this.badgeDirty = true)));
    this.offs.push(bus.on('upgrade:bought', () => (this.badgeDirty = true)));
    this.offs.push(bus.on('staff:hired', () => (this.badgeDirty = true)));
  }

  /**
   * Açık panelin butonunu vurgular.
   *
   * Alt panellerin (İstasyonlar, Prestij, Dekorasyon) kendi HUD butonu YOK
   * — hepsi bir üst panelin içinden açılıyor. Vurgu o üst butonda kalır,
   * yoksa panel açıkken hiçbir düğme yanmıyor ve oyuncu nereden geldiğini
   * kaybediyor.
   */
  setActivePanel(id: UiPanelId | null): void {
    if (id !== null) this.setSideJobsExpanded(false);
    const parent: UiPanelId | null =
      id === 'stations' ? 'upgrades' : id === 'prestige' ? 'upgrades' : id === 'decor' ? 'locations' : id;
    for (let i = 0; i < SIDE.length; i++) {
      this.sideBtns[i].classList.toggle('on', SIDE[i].id === parent);
    }
  }

  private tickVacuum(s: UiHudState): void {
    const v = s.vacuum;
    const visible = !!v?.available;
    const holding = !!v?.holding;
    const blocked = !holding && !v?.canTake;
    const signature = `${visible}|${holding}|${blocked}`;
    if (signature === this.vacuumSignature) return;
    this.vacuumSignature = signature;
    this.vacuumButton.classList.toggle('hide', !visible);
    this.vacuumButton.classList.toggle('holding', holding);
    this.vacuumButton.disabled = blocked;
    this.vacuumButton.setAttribute('aria-pressed', String(holding));
    const label = holding ? tr('SÜPÜRGEYİ BIRAK') : tr('SÜPÜRGEYİ AL');
    const hint = blocked ? tr('Önce tepsiyi boşalt') : holding ? tr('Servise dön') : tr('Her yerden al');
    this.vacuumLabel.textContent = label;
    this.vacuumHint.textContent = hint;
    this.vacuumButton.setAttribute('aria-label', `${label}. ${hint}`);
  }

  markBadgesDirty(): void {
    this.badgeDirty = true;
  }

  // ------------------------------------------------------------------
  // Kare döngüsü — DOM sorgusu yok, düğüm üretimi yok.
  // ------------------------------------------------------------------
  update(dt: number, s: UiHudState, fresh = true): void {
    this.refreshAnchor(dt);
    if (fresh) {
      this.lastUpOnboarded = s.upgradeOnboarded === true;
      this.lastStaffOnboarded = s.staffOnboarded === true;
      this.lastTutorialActive = s.tutorialActive;
      this.tickIntro(s);
      this.tickVacuum(s);
      this.tickBoost(s);
      this.tickGoal(s);
      this.tickCarry(s);
    }
    this.tickMoney(dt, s.money);
    this.tickEvents(dt);
    this.tickBadges(dt);
  }

  isSideJobsExpanded(): boolean {
    return false;
  }

  collapseSideJobs(): void {
    if (this.sideJobsExpanded) this.setSideJobsExpanded(false);
  }

  private setSideJobsExpanded(on: boolean): void {
    this.sideJobsExpanded = on;
    this.sideJobs.classList.toggle('collapsed', !on);
    this.sideJobsToggle.setAttribute('aria-expanded', String(on));
  }

  private tickIntro(s: UiHudState): void {
    const pop = (elm: HTMLElement) => {
      elm.classList.remove('hide');
      elm.classList.add('intro-pop');
    };
    if (!this.introSide && !s.tutorialActive) {
      this.introSide = true;
      pop(this.sideBox);
    }
  }

  /**
   * x2 GELİR — yalnız reklam gerçekten hazırken, ya da süre işlerken.
   * Hazır olmayan bir "İZLE" düğmesi her basışta "reklam yok" der.
   */
  private tickBoost(s: UiHudState): void {
    const left = s.boostLeft ?? 0;
    const max = s.boostMax ?? 1200;
    const active = left > 0;
    const show = !s.tutorialActive && (active || s.boostReady === true);
    if (show !== this.lastBoostShown) {
      const wasHidden = this.lastBoostShown === null ? this.boostBtn.classList.contains('hide') : !this.lastBoostShown;
      this.lastBoostShown = show;
      this.boostBtn.classList.toggle('hide', !show);
      if (show && wasHidden) this.boostBtn.classList.add('intro-pop');
    }
    if (!show) {
      this.lastBoostSec = -1;
      return;
    }

    const isMax = left >= max;
    const sec = Math.ceil(left);
    const isUrgent = active && sec <= 30;

    if (active !== this.lastBoostActive) {
      this.lastBoostActive = active;
      this.boostBtn.classList.toggle('active', active);
      this.boostBtn.classList.toggle('idle', !active);
    }

    if (isMax !== this.lastBoostMax) {
      this.lastBoostMax = isMax;
      this.boostBtn.classList.toggle('maxed', isMax);
    }
    if (isUrgent !== this.lastBoostUrgent) {
      this.lastBoostUrgent = isUrgent;
      this.boostBtn.classList.toggle('urgent', isUrgent);
    }

    if (sec !== this.lastBoostSec) {
      this.lastBoostSec = sec;
      const mult = s.boostMultiplier ?? 2;
      if (active) {
        const m = Math.floor(sec / 60);
        const remS = sec % 60;
        const timeStr = `${m}:${remS < 10 ? '0' : ''}${remS}`;
        this.boostVal.textContent = tr('x{0} GELİR', mult);
        this.boostSub.textContent = isMax
          ? tr('MAKS {0}', timeStr)
          : tr('{0} (+{1}dk)', timeStr, Math.round(HAPPY_HOUR_STEP_SECONDS / 60));
        this.boostBtn.setAttribute('aria-label', tr("x2 Gelir aktif: {0} kaldı", timeStr));
      } else {
        this.boostVal.textContent = tr('x{0} GELİR', mult);
        this.boostSub.textContent = tr('İZLE');
        this.boostBtn.setAttribute('aria-label', tr("x2 Gelir başlatmak için reklam izle"));
      }
    }
  }

  /**
   * Hijyen pili — kapalıyken tamamen gizlenir, boş yer bırakmaz.
   * SERVİS bölümü (tuvaletler) açılana dek de gizli kalır: hijyen çarpanı
   * sim'de daha erken işlese de yeni oyuncunun ekranında yeri yok.
   */
  private tickHygiene(s: UiHudState): void {
    const show = s.hygieneActive && s.toiletOpen;
    if (show !== this.hygActive) {
      this.hygActive = show;
      this.hygPill.classList.toggle('hide', !show);
    }
    if (!show) return;

    const h = Math.round(s.hygiene);
    if (h !== this.lastHyg) {
      this.lastHyg = h;
      this.hygVal.textContent = String(h);
      this.hygRing.style.setProperty('--p', (clamp01(h / 100) || 0).toFixed(3));
      const lvl = h >= 70 ? 0 : h >= 40 ? 1 : 2;
      if (lvl !== this.lastHygLvl) {
        this.hygPill.classList.remove(HYG_CLS[this.lastHygLvl]);
        this.lastHygLvl = lvl;
        this.hygPill.classList.add(HYG_CLS[lvl]);
      }
    }

    const m = Math.round(s.hygieneMult * 100);
    if (m !== this.lastHygMult) {
      this.lastHygMult = m;
      this.hygMultEl.textContent = (m / 100).toLocaleString(localeTag(),{minimumFractionDigits:2,maximumFractionDigits:2}) + '×';
    }
  }

  /**
   * Tempo pili — hijyenin kardeşi, aynı ring+val yapısını kullanır.
   * Görünürlüğü burada DEĞİL `tickIntro`de yönetilir (bkz. introTempo);
   * bu metot yalnızca değeri tazeler, hijyenin `tickHygiene`si gibi.
   * `formatPct` `.loc` ile aynı yardımcı (floor tabanlı); `lastTempo`
   * önbelleği de aynı floor formülüyle hesaplanır ki gösterilen metinle
   * birebir tutarlı kalsın.
   */
  private tickTempo(s: UiHudState): void {
    const t = Math.floor(clamp01(s.tempo) * 100);
    if (t !== this.lastTempo) {
      this.lastTempo = t;
      this.tempoVal.textContent = formatPct(s.tempo);
      this.tempoRing.style.setProperty('--p', (clamp01(s.tempo) || 0).toFixed(3));
    }
  }

  /** Kafe rozeti — dolu masa sayacı + toplanmayı bekleyen masa uyarısı.
   *  Öğretici bitene kadar gizli: beş emojili sayaç ilk dakikada gürültü. */
  private tickCafe(s: UiHudState): void {
    const show = s.cafeOpen && !s.tutorialActive;
    if (show !== this.cafeVisible) {
      this.cafeVisible = show;
      this.cafeChip.classList.toggle('hide', !show);
    }
    if (!show) return;

    const used = Math.max(0, Math.floor(s.seatsUsed));
    const total = Math.max(0, Math.floor(s.seatsTotal));
    if (used !== this.lastSeatsU || total !== this.lastSeatsT) {
      this.lastSeatsU = used;
      this.lastSeatsT = total;
      this.cafeSeats.textContent = used + '/' + total;
      const full = total > 0 && used >= total;
      if (full !== this.seatsFull) {
        this.seatsFull = full;
        this.cafeChip.classList.toggle('full', full);
      }
    }

    const dirty = Math.max(0, Math.floor(s.dirtyTables));
    if (dirty !== this.lastDirty) {
      this.lastDirty = dirty;
      this.cafeDirty.classList.toggle('hide', dirty <= 0);
      if (dirty > 0) this.cafeDirtyNum.textContent = String(dirty);
      const hot = dirty >= 3;
      if (hot !== this.dirtyHot) {
        this.dirtyHot = hot;
        this.cafeDirty.classList.toggle('hot', hot);
      }
    }

    const orders = Math.max(0, Math.floor(s.pendingOrders));
    if (orders !== this.lastOrders) {
      this.lastOrders = orders;
      this.cafeOrders.classList.toggle('hide', orders <= 0);
      if (orders > 0) this.cafeOrdersNum.textContent = String(orders);
      const hot = orders >= 3;
      if (hot !== this.ordersHot) {
        this.ordersHot = hot;
        this.cafeOrders.classList.toggle('hot', hot);
      }
    }

    const spills = Math.max(0, Math.floor(s.spills));
    if (spills !== this.lastSpills) {
      this.lastSpills = spills;
      this.cafeSpill.classList.toggle('hide', spills <= 0);
      if (spills > 0) this.cafeSpillNum.textContent = String(spills);
      this.cafeSpill.classList.toggle('hot', spills >= 4);
    }

    // Sarf uyarısı yalnızca gerçekten azaldığında görünür (%35 altı).
    const lowSupply = s.toiletOpen && s.supplyLevel < 0.35;
    if (lowSupply !== this.lastLowSupply) {
      this.lastLowSupply = lowSupply;
      this.cafeSupply.classList.toggle('hide', !lowSupply);
      this.cafeSupply.classList.toggle('hot', s.supplyLevel < 0.12);
    }
  }

  /* ================================================================ *
   *  Para uçma yayının hedefi
   * ================================================================ */

  /**
   * Cüzdan rozetinin ekran merkezi. Ölçüm önbelleklenir: `getBoundingClientRect`
   * her karede okunursa düzen yeniden hesaplanır (layout thrashing). Rozetin
   * yeri yalnızca pencere boyutlanınca değişir, o yüzden 0,5 saniyede bir
   * tazelemek fazlasıyla yeterli.
   */
  private anchorX = 60;
  private anchorY = 40;
  private anchorAge = 99;

  moneyAnchorX(): number {
    return this.anchorX;
  }

  moneyAnchorY(): number {
    return this.anchorY;
  }

  private refreshAnchor(dt: number): void {
    this.anchorAge += dt;
    if (this.anchorAge < 0.5) return;
    this.anchorAge = 0;
    const r = this.moneyPill.getBoundingClientRect();
    if (r.width > 0) {
      this.anchorX = r.left + r.width / 2;
      this.anchorY = r.top + r.height / 2;
    }
  }

  /** Jeton varınca rozeti zıplat (CoinFlight bunu çağırır). */
  punchMoney(): void {
    retrigger(this.moneyPill, 'bump-a', 'bump-b');
  }

  private tickMoney(dt: number, money: number): void {
    if (money !== this.moneyReal) {
      if (money > this.moneyReal && this.moneyReal >= 0 && this.bumpCd <= 0) {
        this.bumpCd = 0.34;
        retrigger(this.moneyPill, 'bump-a', 'bump-b');
      }
      this.moneyReal = money;
    }
    if (this.bumpCd > 0) this.bumpCd -= dt;

    // sayaç gerçek değere doğru yumuşak akar
    const diff = this.moneyReal - this.moneyShown;
    if (diff !== 0) {
      if (Math.abs(diff) < 1.5) this.moneyShown = this.moneyReal;
      else this.moneyShown = damp(this.moneyShown, this.moneyReal, 11, dt);
    }

    const n = Math.floor(this.moneyShown);
    if (n !== this.lastMoneyInt) {
      this.lastMoneyInt = n;
      const txt = '₺' + this.api.formatMoney(n);
      if (txt !== this.lastMoneyTxt) {
        this.lastMoneyTxt = txt;
        this.moneyVal.textContent = txt;
      }
    }
  }

  private tickGoal(s: UiHudState): void {
    const g = s.goal;
    if (!g) {
      if (this.goalVisible) {
        this.goalVisible = false;
        this.goalBtn.classList.add('hide');
      }
      return;
    }
    if (!this.goalVisible) {
      this.goalVisible = true;
      this.goalBtn.classList.remove('hide');
    }

    if (g.id !== this.lastGoalId) {
      const hadPrev = this.lastGoalId !== '';
      this.lastGoalId = g.id;
      this.goalTitle.textContent = g.title;
      this.goalReward.textContent = '+₺' + this.api.formatMoney(g.reward);
      this.lastGoalCur = -1;
      this.lastGoalTgt = -1;
      if (hadPrev) {
        // biten hedef altın parlar, yenisi kayarak girer
        retrigger(this.goalBtn, 'done-a', 'done-b');
        retrigger(this.goalBtn, 'goal-in-a', 'goal-in-b');
        sfx('goal');
      }
    }

    const cur = Math.floor(g.current);
    const tgt = Math.floor(g.target);
    if (cur !== this.lastGoalCur || tgt !== this.lastGoalTgt) {
      this.lastGoalCur = cur;
      this.lastGoalTgt = tgt;
      this.goalCount.textContent = this.num(cur) + '/' + this.num(tgt);
    }

    const p = tgt > 0 ? clamp01(cur / tgt) : 0;
    if (Math.abs(p - this.lastGoalP) > 0.002) {
      this.lastGoalP = p;
      this.goalFill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }
  }

  private tickLocation(s: UiHudState): void {
    if (s.locationName !== this.lastLocName) {
      this.lastLocName = s.locationName;
      this.locName.textContent = s.locationName;
    }
    const p = clamp01(s.progress);
    if (Math.abs(p - this.lastProg) > 0.004) {
      this.lastProg = p;
      this.locRing.style.setProperty('--p', p.toFixed(3));
      this.locPct.textContent = formatPct(p);
    }
  }

  private tickCarry(s: UiHudState): void {
    const max = Math.max(0, Math.floor(s.carryMax));
    const cur = Math.max(0, Math.min(Math.floor(s.carry), max));

    if (max !== this.lastCarryMax) {
      const shown = Math.min(max, MAX_PIPS);
      for (let i = 0; i < MAX_PIPS; i++) this.pips[i].classList.toggle('hide', i >= shown);
      this.carryNum.classList.toggle('hide', max <= MAX_PIPS);
      this.lastCarryMax = max;
      this.lastCarry = -1;
    }

    if (cur !== this.lastCarry) {
      const shown = Math.min(max, MAX_PIPS);
      const filled = max > 0 ? Math.round((cur / max) * shown) : 0;
      for (let i = 0; i < shown; i++) this.pips[i].classList.toggle('on', i < filled);
      if (max > MAX_PIPS) this.carryNum.textContent = cur + '/' + max;
      this.lastCarry = cur;
      this.carry.classList.toggle('hide', cur <= 0);
    }

    const itemKey = s.carryItem === null ? '' : s.carryItem;
    if (itemKey !== this.lastCarryItem) {
      this.lastCarryItem = itemKey;
      if (s.carryItem === null) {
        setIconText(this.carryGlyph, '🧺');
        this.carryGlyph.style.color = '';
      } else {
        const info = this.api.itemInfo(s.carryItem);
        setIconText(this.carryGlyph, info.glyph);
        this.carryGlyph.style.color = hexColor(info.color);
      }
    }

    // KARMA YIĞIN: her dolu pip kendi slotunun ürün rengini alır — oyuncu
    // elinde "1 çay + 2 tost" olduğunu göstergeden okuyabilsin.
    const slotsKey = s.carrySlots.join(',');
    if (slotsKey !== this.lastCarrySlots) {
      this.lastCarrySlots = slotsKey;
      if (max <= MAX_PIPS) {
        for (let i = 0; i < Math.min(max, MAX_PIPS); i++) {
          const it = s.carrySlots[i];
          this.pips[i].style.background = it ? hexColor(this.api.itemInfo(it).color) : '';
        }
      }
    }
  }

  // ---- olaylar ------------------------------------------------------

  showEvent(b: UiEventBanner): void {
    const found = this.find(b.id);
    if (found) {
      found.remaining = b.remaining;
      found.duration = Math.max(0.001, b.duration);
      found.dying = false;
      return;
    }
    const card = el('div', 'ev ' + b.tone);
    card.appendChild(el('span', 'ev-glyph', b.glyph));
    const body = el('div', 'ev-body');
    body.appendChild(el('div', 'ev-title', b.title));
    body.appendChild(el('div', 'ev-desc', b.desc));
    const bar = el('div', 'ev-bar');
    const fill = el('i');
    bar.appendChild(fill);
    body.appendChild(bar);
    card.appendChild(body);
    this.eventsBox.appendChild(card);
    this.events.push({
      id: b.id,
      root: card,
      bar: fill,
      remaining: b.remaining,
      duration: Math.max(0.001, b.duration),
      lastW: -1,
      dying: false,
      deathT: 0,
      priority: b.tone === 'bad' ? 2 : b.tone === 'info' ? 1 : 0,
    });
    this.focusEvent();
  }

  /**
   * Teklif çipini göster. Aynı çip zaten açıksa hiçbir şey yapmaz —
   * yeniden kurmak yanıp sönmeye ve yanlış basmaya yol açar.
   */
  showAdChip(kind: UiAdKind, glyph: string, title: string, text: string): void {
    if (this.adChip.dataset.kind === kind && this.adChip.style.display !== 'none') return;
    this.adChip.dataset.kind = kind;
    this.adChip.textContent = '';
    /**
     * GERİ SAYIM HALKASI simgeyi sarar. Çip `OMUR` saniye sonra kendi
     * kendine kapanıyor (bkz. Game.maybeOfferAd) ama bu eskiden görünmezdi:
     * oyuncu "az önce buradaydı, kayboldu" yaşıyordu. Kalan ömrü halka
     * gösterir; Game her kare `setAdChipProgress` ile `--p`yi yazar.
     */
    const wrap = el('span', 'adchip-ringwrap');
    const ring = el('i', 'adchip-ring');
    wrap.appendChild(ring);
    wrap.appendChild(el('span', 'adchip-glyph', glyph));
    this.adChip.appendChild(wrap);
    this.adChipRing = ring;
    this.adChipP = -1;
    this.setAdChipProgress(1);
    const body = el('div', 'adchip-body');
    body.appendChild(el('div', 'adchip-title', title));
    body.appendChild(el('div', 'adchip-desc', text));
    this.adChip.appendChild(body);
    const go = el('button', 'adchip-go', tr("İZLE"));
    go.type = 'button';
    go.addEventListener('click', (e) => {
      e.stopPropagation();
      sfx('ui_click');
      if (this.onAdChip) this.onAdChip(kind);
    });
    this.adChip.appendChild(go);
    /* Kapatma: teklifi istemeyen oyuncu onu ekrandan kaldırabilmeli.
     * "Reddedilemeyen teklif" bir tekliftir değil, bir engeldir. */
    const x = el('button', 'adchip-x', '✕');
    x.type = 'button';
    x.setAttribute('aria-label', tr("Kapat"));
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideAdChip();
    });
    this.adChip.appendChild(x);
    /* display none → '' geçişi pop-in animasyonunu her belirişte yeniden
     * oynatır (bkz. ui.css `adchip-pop`). */
    this.adChip.style.display = '';
    /* Beliriş duyulur da: kısa, davetkâr bir tını + hafif titreşim.
     * HUD'un ses yolu bus üstünden (bkz. EventBus.sfx); titreşim de aynı
     * kalıpla olay olarak gider — Game dinleyicisi sessize saygı duyar. */
    sfx('chip', 0.8);
    bus.emit('haptic', { kind: 'light' });
  }

  hideAdChip(): void {
    if (this.adChip.style.display === 'none') return;
    this.adChip.style.display = 'none';
    delete this.adChip.dataset.kind;
    this.adChipRing = null;
  }

  /** Geri sayım halkası: 1 → 0. Yalnız görünür değişimde stile yazar. */
  setAdChipProgress(t01: number): void {
    if (!this.adChipRing) return;
    const p = Math.round(clamp01(t01) * 200) / 200; // %0,5 adım — stil çalkantısı olmasın
    if (p === this.adChipP) return;
    this.adChipP = p;
    this.adChipRing.style.setProperty('--p', String(p));
  }

  /** Çip şu an ekranda mı — Game gereksiz yere yeniden teklif etmesin. */
  get adChipOpen(): boolean {
    return this.adChip.style.display !== 'none';
  }

  hideEvent(id: string): void {
    const s = this.find(id);
    if (!s || s.dying) return;
    s.dying = true;
    s.deathT = 0.24;
    s.root.classList.add('out');
    this.focusEvent();
  }

  private find(id: string): EventSlot | null {
    for (let i = 0; i < this.events.length; i++) if (this.events[i].id === id) return this.events[i];
    return null;
  }

  private focusEvent(): void {
    // An urgent service problem leads; ties keep the older event stable.
    let foreground: EventSlot | undefined;
    for (const event of this.events) {
      if (!event.dying && (!foreground || event.priority > foreground.priority)) foreground = event;
    }
    for (const event of this.events) event.root.hidden = event !== foreground;
    if (foreground) this.hideAdChip();
  }

  private tickEvents(dt: number): void {
    if (this.events.length === 0) return;
    let changed = false;
    for (let i = this.events.length - 1; i >= 0; i--) {
      const s = this.events[i];
      if (s.dying) {
        s.deathT -= dt;
        if (s.deathT <= 0) {
          if (s.root.parentNode) s.root.parentNode.removeChild(s.root);
          this.events.splice(i, 1);
          changed = true;
        }
        continue;
      }
      s.remaining -= dt;
      if (s.remaining <= 0) {
        this.hideEvent(s.id);
        continue;
      }
      const w = clamp01(s.remaining / s.duration);
      if (Math.abs(w - s.lastW) > 0.006) {
        s.lastW = w;
        s.bar.style.transform = 'scaleX(' + w.toFixed(3) + ')';
      }
    }
    if (changed) this.focusEvent();
  }

  // ---- rozetler -----------------------------------------------------

  private tickBadges(dt: number): void {
    if (this.badgeCd > 0) this.badgeCd -= dt;
    if (!this.badgeDirty || this.badgeCd > 0) return;
    this.badgeDirty = false;
    this.badgeCd = 0.45;

    let upCount = 0;
    let minUpCost = Infinity;
    const ups = this.api.getPlayerUpgrades();
    for (let i = 0; i < ups.length; i++) {
      const u = ups[i];
      if (u.maxed) continue;
      if (u.affordable) upCount++;
      if (u.cost < minUpCost) minUpCost = u.cost;
    }

    const sts = this.api.getStations();
    for (let i = 0; i < sts.length; i++) {
      const s = sts[i];
      if (s.locked) continue;
      if (s.hasSpeed && s.speedLevel < s.speedMaxLevel) {
        if (s.canSpeed) upCount++;
        if (s.speedCost < minUpCost) minUpCost = s.speedCost;
      }
      if (s.hasCap && s.capLevel < s.capMaxLevel && !s.capBlockedReason) {
        if (s.canCap) upCount++;
        if (s.capCost < minUpCost) minUpCost = s.capCost;
      }
    }

    const pres = this.api.getPrestige();
    if (pres.visible) {
      for (let i = 0; i < pres.rows.length; i++) {
        if (pres.rows[i].canBuy) upCount++;
      }
    }

    let staffCount = 0;
    let minStaffCost = Infinity;
    const stf = this.api.getStaff();
    for (let i = 0; i < stf.length; i++) {
      const s = stf[i];
      if (s.locked) continue;
      if (!s.hireMaxed) {
        if (s.canHire) staffCount++;
        if (s.hireCost < minStaffCost) minStaffCost = s.hireCost;
      }
      if (s.count > 0 && !s.levelMaxed) {
        if (s.canLevel) staffCount++;
        if (s.levelCost < minStaffCost) minStaffCost = s.levelCost;
      }
    }

    let locCount = 0;
    const ls = this.api.getLocations();
    for (let i = 0; i < ls.length; i++) {
      if (ls[i].canBuy) locCount++;
    }

    this.setBadge(0, upCount, minUpCost, this.moneyReal);
    this.setBadge(1, staffCount, minStaffCost, this.moneyReal);
    this.setBadge(2, locCount, Infinity, this.moneyReal);

    // ---- İlk Yükseltme & İlk Personel Mikro-Rehberi ----
    let wantOnboard: 'upgrade' | 'staff' | null = null;
    if (!this.lastTutorialActive && this.introSide) {
      if (!this.lastUpOnboarded && upCount > 0) {
        wantOnboard = 'upgrade';
      } else if (this.lastUpOnboarded && !this.lastStaffOnboarded && staffCount > 0) {
        wantOnboard = 'staff';
      }
    }
    this.setOnboarding(wantOnboard);

    /* ---- v5.1: festival çipi + hedef rozeti ---- */
    const fest = this.api.getFestival();
    if (fest.id !== this.lastFestId) {
      this.lastFestId = fest.id;
      setIconText(this.festChipGlyph, fest.glyph);
      this.festChipName.textContent = fest.short;
      this.festChip.title = fest.title;
    }
    const pend = this.api.loyaltyPending() > 0;
    if (pend !== this.goalDotOn) {
      this.goalDotOn = pend;
      this.goalDot.classList.toggle('on', pend);
    }
  }

  private setBadge(i: number, count: number, minCost: number, money: number): void {
    const on = count > 0;
    if (this.dotState[i] !== on) {
      this.dotState[i] = on;
      this.dots[i].classList.toggle('on', on);
      this.sideBtns[i].classList.toggle('is-ready', on);
    }
    if (this.dotCountState[i] !== count) {
      this.dotCountState[i] = count;
      this.dots[i].textContent = count > 9 ? '9+' : count > 0 ? String(count) : '';
    }
    if (i === 0 || i === 1) {
      const subTxt = on
        ? tr("AÇIK!")
        : Number.isFinite(minCost)
          ? '₺' + this.num(minCost)
          : '';
      if (this.subTxtState[i] !== subTxt) {
        this.subTxtState[i] = subTxt;
        this.sideSubs[i].textContent = subTxt;
      }
      const progPct = on
        ? 100
        : Number.isFinite(minCost) && minCost > 0
          ? Math.min(99, Math.max(0, Math.floor((Math.max(0, money) / minCost) * 100)))
          : 0;
      if (this.subProgState[i] !== progPct) {
        this.subProgState[i] = progPct;
        this.sideBtns[i].style.setProperty('--side-prog', progPct + '%');
      }
    }
  }

  private setOnboarding(kind: 'upgrade' | 'staff' | null): void {
    if (this.activeOnboard === kind) return;
    const wasNull = this.activeOnboard === null;
    this.activeOnboard = kind;
    this.sideBtns[0]?.classList.toggle('onboard-pulse', kind === 'upgrade');
    this.sideBtns[1]?.classList.toggle('onboard-pulse', kind === 'staff');
    if (kind === null) {
      this.onboardBox.classList.add('hide');
      delete this.onboardBox.dataset.target;
      return;
    }
    this.onboardBox.dataset.target = kind;
    if (kind === 'upgrade') {
      this.onboardTitle.textContent = tr("⚡ İlk Yükseltmen Hazır!");
      this.onboardText.textContent = tr("Hızını ve tepsi kapasiteni artırmak için dokun.");
    } else {
      this.onboardTitle.textContent = tr("👷 Yardımcı Zamanı!");
      this.onboardText.textContent = tr("Tezgâhtar işe al, ürünleri raflara otomatik taşısın.");
    }
    this.onboardBox.classList.remove('hide');
    if (wasNull) sfx('goal', 0.45);
  }

  private num(v: number): string {
    return v >= 10000 ? this.api.formatMoney(v) : String(v);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }
}
