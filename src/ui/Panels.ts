import { tr } from "../core/I18n";
import type {
  UIApi,
  UiAdKind,
  UiAdOffer,
  UiCosmeticOption,
  UiGoal,
  UiPanelId,
  UiPrestige,
  UiStationRow,
  UiFpsPreference,
  } from './api';
import { couponPrice } from './api';
import { bus, haptic, sfx } from '../core/EventBus';
import { el, makeRing, retrigger } from './HUD';
import { ModalFocus, CONTROL_SELECTOR } from './ModalFocus';
import { clamp01, formatPct } from '../core/MathUtils';
import { openPrivacyOptions } from '../core/Ads';
import { isIos } from '../core/Native';

/**
 * YAYINLANMIŞ GİZLİLİK POLİTİKASININ ADRESİ.
 *
 * Google Play'in "User Data" politikası bu bağlantıyı İKİ yerde birden
 * ister: Play Console'daki alanda VE uygulamanın kendi içinde. Console'a
 * yapıştırmak tek başına yetmez — bu yüzden Ayarlar panelinde bir bağlantı
 * durur.
 *
 * Sayfanın kaynağı depoda: `docs/gizlilik-politikasi.html`. Barındırma
 * adımları ve bu sabitin nasıl doldurulacağı `docs/YAYIN.md` §2'de.
 * Adres değişirse SADECE burası güncellenir ve yeni AAB alınır.
 *
 * ⚠ SAYFA HENÜZ YAYINDA DEĞİL. Adres, Google Sites'ta seçilecek site
 * yoluna göre ÖNCEDEN yazıldı: yayınlarken web adresi alanına birebir
 * `fincan-sokagi-gizlilik` girilmeli. O ad alınmışsa buradaki sabit de
 * değişmeli ve AAB yeniden derlenmeli — ölü bağlantı, Play'in uygulama
 * içi erişim şartını karşılamaz ve incelemede ret sebebidir.
 */
export const GIZLILIK_URL = 'https://sites.google.com/view/fincan-sokagi-gizlilik';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.fincansokagi.game';
export const APP_STORE_URL = (import.meta.env.VITE_IOS_APP_STORE_URL || '').trim();

/**
 * Künye sürümü. Android `versionName` ile ELLE eşlenir — paket sürümünü
 * derleme zamanında enjekte etmek Vite yapılandırması ister ve Capacitor
 * kabuğunda ayrıca `versionName` yine elle yazılıyor; tek satırlık bir
 * sabit iki kaynağı senkron tutmanın en ucuz yolu.
 */
import { APP_VERSION } from '../core/version';

const TITLES: Record<UiPanelId, string> = {
  upgrades: tr("Yükseltmeler"),
  stations: tr("İstasyonlar"),
  staff: tr("Personel"),
  locations: tr("Şubeler"),
  settings: tr("Ayarlar"),
  goals: tr("Hedefler"),
  prestige: tr("Sokağı Devret"),
  decor: tr("Dekorasyon"),
};

type BuyMode = 'ok' | 'poor' | 'maxed';

/**
 * Departman görsel kimliği. Sınıf adı DAİMA bu beyaz listeden gelir —
 * oyun verisinden gelen ham metin hiçbir zaman sınıfa yazılmaz.
 */
interface DeptSkin {
  cls: string;
  glyph: string;
}

const DEPT_SKIN: Record<string, DeptSkin | undefined> = {
  Bar: { cls: 'd-market', glyph: '☕' },
  Salon: { cls: 'd-cafe', glyph: '🪑' },
  Dining: { cls: 'd-cafe', glyph: '🪑' },
  Servis: { cls: 'd-servis', glyph: '🚻' },
  Service: { cls: 'd-servis', glyph: '🚻' },
};

const DEPT_FALLBACK: DeptSkin = { cls: 'd-market', glyph: '🏬' };

const FPS_CHOICES: { id: UiFpsPreference; readonly label: string }[] = [
  { id: 'auto', get label() { return tr("Otomatik"); } },
  { id: 30, label: '30 FPS' },
  { id: 45, label: '45 FPS' },
  { id: 60, label: '60 FPS' },
];

/** Etiket + altında fiyat taşıyan fiziksel buton. */
function actionBtn(label: string, sub: string | null, variant: string): HTMLButtonElement {
  const b = el('button', 'btn btn-sm ' + variant);
  b.type = 'button';
  const col = el('span', 'b-col');
  col.appendChild(el('span', undefined, label));
  if (sub !== null) col.appendChild(el('span', 'b-sub', sub));
  b.appendChild(col);
  return b;
}

/** Seviye göstergesi: az seviyede pips, çok seviyede metin. */
/**
 * SEVİYE GÖSTERGESİ — az seviyede nokta, çok seviyede yazı.
 *
 * Eşik 12'ydi ve ÖLÇÜLDÜ: tek bir nokta 7 px + 3 px aralık = 10 px yer
 * kaplıyor ve `.lvl` küçülmeyen bir kutu (`flex: 0 0 auto`). 10 seviyelik
 * bir yükseltmede 100 px yalnız noktalara gidiyor, kart genişliğinden
 * geriye ada ~60 px kalıyor ve ad kesiliyordu: "Rahat Ayakk…",
 * "Servis Te…". Yarım kelime, yarım bitmiş bir ekran demektir.
 *
 * Eşik 6'ya indirildi. Dayanağı işlevsel: nokta dizisi ancak TEK BAKIŞTA
 * SAYILABİLDİĞİ sürece bilgi taşır; on iki noktayı kimse saymaz, orada
 * "Sv 7/10" hem daha okunaklı hem ~40 px. Oyundaki dört oyuncu
 * yükseltmesinin dördü de (10, 12, 10, 10 seviye) artık yazıya düşer ve
 * adların tamamı sığar; nokta dizisi kısa merdivenlerde korunur.
 */
function levelPips(level: number, maxLevel: number): HTMLElement {
  if (maxLevel <= 0 || maxLevel > 6) return el('span', 'lvl-txt', tr('Sv {0}/{1}', level, maxLevel));
  const box = el('div', 'lvl');
  for (let i = 0; i < maxLevel; i++) {
    const p = el('i');
    if (i < level) p.classList.add('on');
    box.appendChild(p);
  }
  return box;
}

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function formatSingleTransition(cur: string, next: string): string {
  const a = cur.trim();
  const b = next.trim();
  if (!b || a === b) return a;
  const aSpace = a.indexOf(' ');
  const bSpace = b.indexOf(' ');
  if (aSpace > 0 && aSpace === bSpace) {
    const aPre = a.slice(0, aSpace);
    const bPre = b.slice(0, bSpace);
    if (aPre.toLowerCase() === bPre.toLowerCase() && !/\d/.test(aPre)) {
      return `${capitalizeFirst(aPre)} ${formatSingleTransition(a.slice(aSpace + 1), b.slice(bSpace + 1))}`;
    }
  }
  const aLast = a.lastIndexOf(' ');
  const bLast = b.lastIndexOf(' ');
  if (aLast > 0 && bLast > 0) {
    const aUnit = a.slice(aLast + 1);
    const bUnit = b.slice(bLast + 1);
    if (aUnit === bUnit && !/\d/.test(aUnit)) {
      return `${a.slice(0, aLast)} ➜ ${b.slice(0, bLast)} ${aUnit}`;
    }
  }
  return `${a} ➜ ${b}`;
}

function formatStatParts(cur: string, next: string, maxed = false): string[] {
  if (maxed || !next || cur === next) {
    return cur.includes(' · ') ? cur.split(' · ').map((p) => capitalizeFirst(p.trim())) : [cur];
  }
  if (cur.includes(' · ') && next.includes(' · ')) {
    const cParts = cur.split(' · ');
    const nParts = next.split(' · ');
    if (cParts.length === nParts.length) {
      return cParts.map((c, i) => formatSingleTransition(c, nParts[i]));
    }
  }
  return [formatSingleTransition(cur, next)];
}

/**
 * Tüm paneller tek kabuğu paylaşır: dar ekranda alt sheet, geniş ekranda
 * ortada kart. İçerik yalnızca açılışta ve 'ui:refresh' geldiğinde kurulur.
 */
export class Panels {
  readonly root: HTMLDivElement;

  /** UIRoot bağlar — HUD rozetlerini ve aktif buton vurgusunu tazeler. */
  onOpened: ((id: UiPanelId) => void) | null = null;
  onClosed: (() => void) | null = null;
  onChanged: (() => void) | null = null;

  private readonly api: UIApi;
  private readonly panel: HTMLDivElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly tabsBox: HTMLDivElement;
  private readonly tabUp: HTMLButtonElement;
  private readonly tabSt: HTMLButtonElement;
  private readonly tabStaff: HTMLButtonElement;
  private readonly tabUpBadge: HTMLSpanElement;
  private readonly tabStBadge: HTMLSpanElement;
  private readonly tabStaffBadge: HTMLSpanElement;
  private readonly body: HTMLDivElement;
  private readonly focus: ModalFocus;

  private current: UiPanelId | null = null;
  private tab: 'upgrades' | 'stations' | 'staff' = 'upgrades';

  private suppress = false;
  private rebuildTimer = 0;
  private confirmTimer = 0;
  private pendingFocusKey: string | undefined;

  private readonly offs: (() => void)[] = [];

  constructor(api: UIApi) {
    this.api = api;

    this.root = el('div', 'pw');
    this.panel = el('div', 'panel');
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');

    const head = el('div', 'panel-head');
    this.titleEl = el('h2', 'panel-title', '');
    this.titleEl.id = 'fincan-panel-title';
    this.panel.setAttribute('aria-labelledby', this.titleEl.id);
    head.appendChild(this.titleEl);
    const x = el('button', 'panel-x', '✕');
    x.type = 'button';
    x.setAttribute('aria-label', tr("Kapat"));
    x.addEventListener('click', () => this.close());
    head.appendChild(x);
    this.panel.appendChild(head);

    this.focus = new ModalFocus(this.root, x);
    this.tabsBox = el('div', 'tabs');
    this.tabsBox.setAttribute('role', 'tablist');

    const makeTab = (label: string): [HTMLButtonElement, HTMLSpanElement] => {
      const btn = el('button', 'tab');
      btn.type = 'button';
      btn.appendChild(el('span', 'tab-lbl', label));
      const badge = el('span', 'tab-badge hide', '');
      btn.appendChild(badge);
      return [btn, badge];
    };

    [this.tabUp, this.tabUpBadge] = makeTab('🏃 ' + tr("Karakter"));
    [this.tabSt, this.tabStBadge] = makeTab('🏪 ' + tr("İstasyonlar"));
    [this.tabStaff, this.tabStaffBadge] = makeTab('👷 ' + tr("Personel"));

    const tabOrder: readonly [HTMLButtonElement, 'upgrades' | 'stations' | 'staff'][] = [
      [this.tabUp, 'upgrades'],
      [this.tabSt, 'stations'],
      [this.tabStaff, 'staff'],
    ];
    for (let idx = 0; idx < tabOrder.length; idx++) {
      const [button, id] = tabOrder[idx];
      button.id = 'fincan-tab-' + id;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'fincan-panel-body');
      button.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const curIdx = tabOrder.findIndex(([, tid]) => tid === this.tab);
        const nextIdx =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabOrder.length - 1
              : event.key === 'ArrowRight'
                ? (curIdx + 1) % tabOrder.length
                : (curIdx - 1 + tabOrder.length) % tabOrder.length;
        const [nextBtn, nextId] = tabOrder[nextIdx];
        this.setTab(nextId);
        nextBtn.focus();
      });
      button.addEventListener('click', () => this.setTab(id));
      this.tabsBox.appendChild(button);
    }
    this.panel.appendChild(this.tabsBox);

    this.body = el('div', 'panel-body');
    this.body.id = 'fincan-panel-body';
    this.panel.appendChild(this.body);

    this.root.appendChild(this.panel);

    // Arka plana tıklayınca kapanır. Liste sürüklerken kazara kapanmaması
    // için basmanın da arka planda başlaması şart. Dokunuş canvas'a sızmaz.
    let downOnBackdrop = false;
    this.root.addEventListener('pointerdown', (e) => {
      downOnBackdrop = e.target === this.root;
      e.stopPropagation();
    });
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root && downOnBackdrop) this.close();
    });

    this.offs.push(
      bus.on('ui:refresh', () => {
        if (this.current !== null && !this.suppress) this.build(this.current);
      }),
    );
  }

  // ------------------------------------------------------------------
  // Aç / kapat
  // ------------------------------------------------------------------

  private history: UiPanelId[] = [];

  isOpen(): boolean {
    return this.current !== null;
  }

  currentId(): UiPanelId | null {
    return this.current;
  }

  open(id: UiPanelId, fromBack = false): void {
    const wasOpen = this.current !== null;
    if (!fromBack && this.current !== null && this.current !== id) {
      this.history.push(this.current);
    }
    if (this.current === 'decor' && id !== 'decor') this.api.cancelCosmeticPreview();
    if (id === 'stations') this.tab = 'stations';
    else if (id === 'upgrades') this.tab = 'upgrades';
    else if (id === 'staff') this.tab = 'staff';
    this.current = id;
    this.cancelConfirm();
    this.build(id, true);
    this.root.classList.add('open');
    this.root.classList.toggle('peek', id === 'decor');
    sfx(wasOpen ? 'ui_click' : 'ui_open');
    this.focus.open();
    if (this.onOpened) this.onOpened(id);
  }

  close(): void {
    if (this.current === null) return;
    if (this.current === 'decor') this.api.cancelCosmeticPreview();
    this.current = null;
    this.history.length = 0;
    this.pendingFocusKey = undefined;
    this.root.classList.remove('open');
    this.root.classList.remove('peek');
    this.cancelConfirm();
    sfx('ui_close');
    if (this.onClosed) this.onClosed();
    this.focus.close();
  }

  /** Donanım geri tuşu veya Escape basıldığında paneli katmanlı kapatır. */
  handleBack(): boolean {
    if (this.confirmTimer !== 0) {
      this.cancelConfirm();
      if (this.current !== null) this.build(this.current);
      sfx('ui_click');
      return true;
    }
    if (this.history.length > 0) {
      const prev = this.history.pop()!;
      this.open(prev, true);
      return true;
    }
    if (this.current !== null) {
      this.close();
      return true;
    }
    return false;
  }

  private setTab(t: 'upgrades' | 'stations' | 'staff'): void {
    if (this.tab === t) return;
    this.tab = t;
    this.current = t;
    sfx('ui_click');
    this.build(t, true);
    if (this.onOpened) this.onOpened(t);
  }

  private syncTabBadges(): void {
    let upCount = 0;
    for (const u of this.api.getPlayerUpgrades()) {
      if (u.affordable && !u.maxed) upCount++;
    }
    let stCount = 0;
    for (const s of this.api.getStations()) {
      if (s.locked) continue;
      if (s.hasSpeed && s.canSpeed && s.speedLevel < s.speedMaxLevel) stCount++;
      if (s.hasCap && s.canCap && s.capLevel < s.capMaxLevel && !s.capBlockedReason) stCount++;
    }
    let staffCount = 0;
    for (const s of this.api.getStaff()) {
      if (s.locked) continue;
      if (s.canHire && !s.hireMaxed) staffCount++;
      if (s.count > 0 && s.canLevel && !s.levelMaxed) staffCount++;
    }
    const setB = (elBadge: HTMLSpanElement, n: number): void => {
      elBadge.textContent = n > 0 ? String(n) : '';
      elBadge.classList.toggle('hide', n <= 0);
    };
    setB(this.tabUpBadge, upCount);
    setB(this.tabStBadge, stCount);
    setB(this.tabStaffBadge, staffCount);
  }

  // ------------------------------------------------------------------
  // İçerik kurulumu — sadece açılışta ve 'ui:refresh'te
  // ------------------------------------------------------------------

  private build(id: UiPanelId, resetScroll = false): void {
    const keep = resetScroll ? 0 : this.body.scrollTop;
    const active = document.activeElement instanceof HTMLElement && this.body.contains(document.activeElement) ? document.activeElement.dataset.focusKey : this.pendingFocusKey;
    this.pendingFocusKey = undefined;
    this.titleEl.textContent = TITLES[id];
    this.body.textContent = '';

    const tabbed = id === 'upgrades' || id === 'stations' || id === 'staff';
    this.tabsBox.style.display = tabbed ? '' : 'none';
    this.body.setAttribute('role', tabbed ? 'tabpanel' : 'region');
    this.body.setAttribute('aria-labelledby', tabbed ? 'fincan-tab-' + this.tab : this.titleEl.id);
    if (tabbed) {
      this.syncTabBadges();
      this.tabUp.classList.toggle('on', this.tab === 'upgrades');
      this.tabSt.classList.toggle('on', this.tab === 'stations');
      this.tabStaff.classList.toggle('on', this.tab === 'staff');
      for (const [button, tid] of [
        [this.tabUp, 'upgrades'],
        [this.tabSt, 'stations'],
        [this.tabStaff, 'staff'],
      ] as const) {
        button.setAttribute('aria-selected', String(this.tab === tid));
        button.tabIndex = this.tab === tid ? 0 : -1;
      }
    }

    switch (id) {
      case 'upgrades':
        this.buildUpgrades();
        break;
      case 'stations':
        this.buildStations();
        break;
      case 'staff':
        this.buildStaff();
        break;
      case 'locations':
        this.buildLocations();
        break;
      case 'settings':
        this.buildSettings();
        break;
      case 'goals':
        this.buildGoals();
        break;
      case 'prestige':
        this.buildPrestige();
        break;
      case 'decor':
        this.buildDecor();
        break;
    }

    const scopes = new Map<string, number>();
    const controls = [...this.body.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)];
    for (const control of controls) {
      const scope = control.closest<HTMLElement>('[data-ui-key]')?.dataset.uiKey ?? 'body';
      const index = scopes.get(scope) ?? 0;
      scopes.set(scope, index + 1);
      control.dataset.focusKey = id + ':' + scope + ':' + index;
    }
    this.body.scrollTop = keep;
    if (active && !resetScroll) {
      const replacement = controls.find(control => control.dataset.focusKey === active && !control.matches(':disabled'));
      if (replacement) replacement.focus({ preventScroll: true });
      else this.panel.querySelector<HTMLElement>('.panel-x')?.focus({ preventScroll: true });
    }
  }

  /** Satın alma sonrası: parlama görünsün diye yeniden kurulum ertelenir. */
  private afterBuy(): void {
    if (this.onChanged) this.onChanged();
    this.suppress = true;
    if (this.rebuildTimer !== 0) window.clearTimeout(this.rebuildTimer);
    this.rebuildTimer = window.setTimeout(() => {
      this.rebuildTimer = 0;
      this.suppress = false;
      if (this.current !== null) this.build(this.current);
    }, 260);
  }

  private wire(btn: HTMLButtonElement, mode: BuyMode, act: () => boolean, reason?: string, floatLabel?: string): void {
    if (mode !== 'ok') btn.classList.add('is-off');
    if (mode === 'maxed') btn.disabled = true;
    btn.addEventListener('click', () => {
      if (this.suppress || mode === 'maxed') return;
      if (mode === 'poor') {
        bus.emit('toast', { text: reason ?? tr('Paran yetmiyor. Biraz daha satış yapıp tekrar dene.'), tone: 'info' });
        sfx('error');
        haptic('warning');
        retrigger(btn, 'fx-shake-a', 'fx-shake-b');
        return;
      }
      sfx('ui_click');
      if (act()) {
        sfx('upgrade');
        sfx('coin', 0.45);
        haptic('medium');
        retrigger(btn, 'fx-ok-a', 'fx-ok-b');
        const card = btn.closest<HTMLElement>('.card, .st-row');
        if (card) card.classList.add('card-just-bought');
        const r = btn.getBoundingClientRect();
        if (r.width > 0) {
          bus.emit('ui:float', {
            x: r.left + r.width * 0.5,
            y: r.top,
            text: floatLabel ?? tr('YÜKSELTİLDİ! ✨'),
            tone: 'good',
          });
        }
        if (document.activeElement === btn) this.pendingFocusKey = btn.dataset.focusKey;
        btn.disabled = true;
        this.afterBuy();
      } else {
        bus.emit('toast', { text: reason ?? tr('Koşullar değişti. Güncel fiyatı kontrol edip tekrar dene.'), tone: 'info' });
        this.build(this.current!);
        sfx('error');
        haptic('warning');
        retrigger(btn, 'fx-shake-a', 'fx-shake-b');
      }
    });
  }

  private freeUpgradeBtn(act: () => Promise<boolean> | undefined): HTMLButtonElement | null {
    const fu = this.api.getAdOffers().freeUpgrade;
    if (!fu?.ready) return null;
    const btn = actionBtn('📺 ' + tr("Ücretsiz"), tr("İZLE"), 'btn-mint');
    btn.addEventListener('click', () => {
      if (this.suppress || btn.disabled) return;
      btn.disabled = true;
      sfx('ui_click');
      const p = act();
      if (!p) {
        btn.disabled = false;
        return;
      }
      void p.then((ok) => {
        btn.disabled = false;
        if (ok) {
          sfx('upgrade');
          this.afterBuy();
        }
      });
    });
    return btn;
  }

  private empty(text: string): void {
    this.body.appendChild(el('div', 'empty', text));
  }

  // ---- 1. Yükseltmeler ----------------------------------------------

  private upgradeAdvice(): void {
    const advice = this.api.getUpgradeAdvice();
    if (!advice) return;
    const card = el('div', 'card advice-card hl');
    const isSpeed = advice.kind === 'speed';
    card.appendChild(el('div', 'c-glyph', isSpeed ? '⚡' : '🪑'));

    const main = el('div', 'c-main');
    const top = el('div', 'c-row');
    top.appendChild(el('span', 'c-name', tr('Şimdi işine yarar: {0}', advice.name)));
    main.appendChild(top);
    main.appendChild(el('div', 'c-desc', advice.reason));

    const meta = el('div', 'st-meta');
    const glyph = isSpeed ? '⚡ ' : '🪑 ';
    const tagCls = isSpeed ? 'tag mint' : 'tag gold';
    for (const part of formatStatParts(advice.current, advice.next, false)) {
      meta.appendChild(el('span', tagCls, glyph + part));
    }
    main.appendChild(meta);
    card.appendChild(main);

    const acts = el('div', 'st-btns');
    const buy = actionBtn(tr('Yükselt'), '₺' + this.api.formatMoney(advice.cost), 'btn-mint');
    this.wire(buy, advice.affordable ? 'ok' : 'poor', () => this.api.buyStationUpgrade(advice.id, advice.kind));
    acts.appendChild(buy);
    if (!advice.affordable && this.api.watchFreeStationUpgrade) {
      const adBtn = this.freeUpgradeBtn(() => this.api.watchFreeStationUpgrade?.(advice.id, advice.kind));
      if (adBtn) acts.appendChild(adBtn);
    }
    card.appendChild(acts);
    this.body.appendChild(card);
  }

  private buildUpgrades(): void {
    // Reklam teklifi ve devir girişi listenin BAŞINDA durur; ikisi de
    // ancak hak edildiğinde çizilir, yoksa panel eskisiyle birebir aynıdır.
    this.adOffer('happy_hour');
    /* Robot teklifi burada: zemin kirlendiğinde `ready` olur (bkz.
     * Game.getAdOffers), yani oyuncu temizlik derdindeyken görünür. */
    this.adOffer('robot_vacuum');
    this.prestigeEntry();
    this.upgradeAdvice();

    const rows = this.api.getPlayerUpgrades();
    if (rows.length === 0) {
      this.empty(tr("Şimdilik yükseltme yok. Biraz para kazan bakalım!"));
      return;
    }
    const hud = this.api.getHud();
    let onboardFocused = false;
    for (const u of rows) {
      const isOnboardTarget = !hud.upgradeOnboarded && !hud.tutorialActive && u.affordable && !u.maxed && !onboardFocused;
      if (isOnboardTarget) onboardFocused = true;

      const card = el('div', 'card' + (isOnboardTarget ? ' card-onboard-focus' : ''));
      card.dataset.uiKey = 'player-' + u.id;
      card.appendChild(el('div', 'c-glyph', u.glyph));

      const main = el('div', 'c-main');
      if (isOnboardTarget) {
        main.appendChild(el('div', 'onboard-btn-tag', '👆 ' + tr('İlk yükseltmen!')));
      }
      const top = el('div', 'c-row');
      top.appendChild(el('span', 'c-name', u.name));
      top.appendChild(levelPips(u.level, u.maxLevel));
      main.appendChild(top);
      main.appendChild(el('div', 'c-desc', u.desc));

      const meta = el('div', 'st-meta');
      for (const part of formatStatParts(u.valueText, u.nextText, u.maxed)) {
        meta.appendChild(el('span', 'tag mint', '⚡ ' + part));
      }
      if (u.deltaBadge && !u.maxed) {
        meta.appendChild(el('span', 'delta-pill', u.deltaBadge));
      }
      main.appendChild(meta);
      card.appendChild(main);

      const btns = el('div', 'st-btns');
      const mode: BuyMode = u.maxed ? 'maxed' : u.affordable ? 'ok' : 'poor';
      const btn = u.maxed
        ? actionBtn(tr("MAKS"), null, 'btn-ghost')
        : actionBtn(tr("Yükselt"), '₺' + this.api.formatMoney(u.cost), 'btn-gold');
      const floatTxt = u.deltaBadge ? u.deltaBadge + ' ✨' : tr('SEVİYE {0}! ⚡', u.level + 1);
      this.wire(btn, mode, () => this.api.buyPlayerUpgrade(u.id), undefined, floatTxt);
      btns.appendChild(btn);
      if (mode === 'poor' && this.api.watchFreePlayerUpgrade) {
        const adBtn = this.freeUpgradeBtn(() => this.api.watchFreePlayerUpgrade?.(u.id));
        if (adBtn) btns.appendChild(adBtn);
      }
      card.appendChild(btns);

      this.body.appendChild(card);
    }
  }

  // ---- 3. İstasyonlar ------------------------------------------------

  /**
   * İki kademeli gruplama: departman (kendi vurgu rengiyle yapışkan ana başlık)
   * → bölge (aynı departmanda yeni bir bölge başladığında alt başlık) → istasyon satırları.
   */
  private buildStations(): void {
    /* Depo doldurma teklifi burada: bu panel makinelerin ekranı ve
     * teklif yalnız depolar boşalmışken hazır olur. */
    this.adOffer('stock_refill');

    const rows = this.api.getStations();
    if (rows.length === 0) {
      this.empty(tr("Henüz istasyon yok."));
      return;
    }
    let sect: HTMLDivElement | null = null;

    for (let i = 0; i < rows.length; i++) {
      const s = rows[i];
      const prev = i > 0 ? rows[i - 1] : null;
      const newDept = prev === null || prev.deptName !== s.deptName;

      if (sect === null || newDept) {
        const skin = DEPT_SKIN[s.deptName] ?? DEPT_FALLBACK;
        sect = el('div', 'dept ' + skin.cls);
        const head = el('div', 'dept-head');
        head.appendChild(el('span', 'dept-glyph', skin.glyph));
        head.appendChild(el('span', 'dept-name', s.deptName));
        if (s.zoneName) {
          head.appendChild(el('span', 'dept-zone', s.zoneName));
        }
        sect.appendChild(head);
        this.body.appendChild(sect);
      } else if (prev !== null && prev.zoneName !== s.zoneName) {
        sect.appendChild(el('div', 'zone-head', s.zoneName));
      }
      sect.appendChild(this.stationRow(s));
    }
  }

  private stationRow(s: UiStationRow): HTMLDivElement {
    const row = el('div', 'st-row' + (s.locked ? ' locked' : ''));
    row.dataset.uiKey = 'station-' + s.id;
    row.appendChild(el('div', 'st-glyph', s.glyph));

    const main = el('div', 'st-main');
    const headRow = el('div', 'c-row');
    headRow.appendChild(el('span', 'st-name', s.name));
    if (!s.locked && s.speedDeltaBadge && s.hasSpeed && s.speedLevel < s.speedMaxLevel) {
      headRow.appendChild(el('span', 'delta-pill', s.speedDeltaBadge));
    }
    if (!s.locked && s.capDeltaBadge && s.hasCap && s.capLevel < s.capMaxLevel) {
      headRow.appendChild(el('span', 'delta-pill gold', s.capDeltaBadge));
    }
    main.appendChild(headRow);

    const meta = el('div', 'st-meta');
    if (s.hasSpeed) {
      const spMaxed = s.speedLevel >= s.speedMaxLevel;
      for (const part of formatStatParts(s.speedText, s.nextSpeedText, spMaxed)) {
        meta.appendChild(el('span', 'tag mint', '⚡ ' + part));
      }
    }
    if (s.hasCap) {
      const capMaxed = s.capLevel >= s.capMaxLevel;
      const capGlyph = s.capLabel === tr('Sandalye') ? '🪑 ' : '📦 ';
      for (const part of formatStatParts(s.capText, s.nextCapText, capMaxed)) {
        meta.appendChild(el('span', 'tag gold', capGlyph + part));
      }
    }
    if (s.capBlockedReason) meta.appendChild(el('span', 'c-desc', s.capBlockedReason));
    if (s.locked) meta.appendChild(el('span', 'tag lock-tag', s.unlockHint ?? ('🔒 ' + tr('Kilitli'))));
    main.appendChild(meta);
    row.appendChild(main);

    const btns = el('div', 'st-btns');
    if (s.hasSpeed) {
      const maxed = s.speedLevel >= s.speedMaxLevel;
      const b = maxed
        ? actionBtn(tr("Hız MAKS"), null, 'btn-ghost')
        : actionBtn(tr("Hız {0}/{1}", s.speedLevel, s.speedMaxLevel), '₺' + this.api.formatMoney(s.speedCost), 'btn-mint');
      const mode: BuyMode = s.locked || maxed ? 'maxed' : s.canSpeed ? 'ok' : 'poor';
      const floatTxt = s.speedDeltaBadge ? s.speedDeltaBadge + ' ⚡' : tr('HIZLANDI! ⚡');
      this.wire(b, mode, () =>
        this.api.buyStationUpgrade(s.id, 'speed'),
        s.unlockHint,
        floatTxt,
      );
      btns.appendChild(b);
      if (mode === 'poor' && !s.locked && this.api.watchFreeStationUpgrade) {
        const adBtn = this.freeUpgradeBtn(() => this.api.watchFreeStationUpgrade?.(s.id, 'speed'));
        if (adBtn) btns.appendChild(adBtn);
      }
    }
    if (s.hasCap) {
      const maxed = s.capLevel >= s.capMaxLevel;
      const b = maxed
        ? actionBtn(tr('{0} MAKS', s.capLabel), null, 'btn-ghost')
        : actionBtn(`${s.capLabel} ${s.capLevel}/${s.capMaxLevel}`, '₺' + this.api.formatMoney(s.capCost), 'btn-gold');
      const mode: BuyMode = s.locked || maxed ? 'maxed' : s.canCap ? 'ok' : 'poor';
      const floatTxt = s.capDeltaBadge ? s.capDeltaBadge + ' ✨' : tr('{0} ARTTI! ✨', s.capLabel.toUpperCase());
      this.wire(b, mode, () =>
        this.api.buyStationUpgrade(s.id, 'cap'),
        s.capBlockedReason ?? s.unlockHint,
        floatTxt,
      );
      btns.appendChild(b);
      if (mode === 'poor' && !s.locked && !s.capBlockedReason && this.api.watchFreeStationUpgrade) {
        const adBtn = this.freeUpgradeBtn(() => this.api.watchFreeStationUpgrade?.(s.id, 'cap'));
        if (adBtn) btns.appendChild(adBtn);
      }
    }
    row.appendChild(btns);
    return row;
  }

  // ---- 2. Personel ---------------------------------------------------

  private buildStaff(): void {
    const rows = this.api.getStaff();
    if (rows.length === 0) {
      this.empty(tr("Personel listesi henüz boş."));
      return;
    }
    const hud = this.api.getHud();
    let onboardFocused = false;
    for (const s of rows) {
      const isOnboardTarget = !hud.staffOnboarded && !hud.tutorialActive && !s.locked && s.canHire && !s.hireMaxed && !onboardFocused;
      if (isOnboardTarget) onboardFocused = true;

      const card = el(
        'div',
        'card staff-card' +
          (s.locked ? ' locked' : '') +
          (isOnboardTarget ? ' card-onboard-focus' : ''),
      );
      card.dataset.uiKey = 'staff-' + s.id;

      if (isOnboardTarget) {
        card.appendChild(el('div', 'onboard-btn-tag', '👆 ' + tr('İlk yardımcı personelin!')));
      }

      const head = el('div', 'c-row staff-head');
      const portrait = el('div', 'staff-portrait', s.glyph);
      portrait.style.background = s.color;
      head.appendChild(portrait);

      const who = el('div', 'c-main staff-who');
      const titleRow = el('div', 'c-row');
      titleRow.appendChild(el('span', 'staff-role', s.name));
      titleRow.appendChild(el('span', 'tag gold', tr('Kadro {0}/{1}', s.count, s.maxCount)));
      titleRow.appendChild(levelPips(s.level, s.maxLevel));
      who.appendChild(titleRow);
      who.appendChild(el('div', 'c-desc staff-desc', s.desc));
      head.appendChild(who);
      card.appendChild(head);

      if (s.locked && s.unlockHint) {
        card.appendChild(el('div', 'tag lock-tag', s.unlockHint));
      } else if (s.scopeText) {
        card.appendChild(el('div', 'c-desc staff-scope', s.scopeText));
      }

      if (!s.locked && !s.hireMaxed && (s.hirePaid ?? 0) > 0 && (s.hireTotalCost ?? 0) > 0) {
        const paid = s.hirePaid!;
        const total = s.hireTotalCost!;
        const pct = Math.min(99, Math.max(1, Math.round((paid / total) * 100)));
        const padRow = el('div', 'staff-pad-prog');
        padRow.appendChild(
          el(
            'span',
            'staff-pad-txt',
            tr('Oyun içi karede ödenen: ₺{0} / ₺{1} (%{2})', this.api.formatMoney(paid), this.api.formatMoney(total), pct),
          ),
        );
        const bar = el('div', 'staff-pad-bar');
        const fill = el('i');
        fill.style.width = pct + '%';
        bar.appendChild(fill);
        padRow.appendChild(bar);
        card.appendChild(padRow);
      }

      const eff = el('div', 'st-meta staff-eff');
      for (const part of formatStatParts(s.effectText, s.nextEffectText, s.levelMaxed)) {
        eff.appendChild(el('span', 'tag mint', '⚡ ' + part));
      }
      if (!s.locked && s.deltaBadge && !s.hireMaxed) {
        eff.appendChild(el('span', 'delta-pill', s.deltaBadge));
      }
      if (!s.locked && s.count > 0 && s.levelDeltaBadge && !s.levelMaxed) {
        eff.appendChild(el('span', 'delta-pill gold', s.levelDeltaBadge));
      }
      card.appendChild(eff);

      const acts = el('div', 'c-actions');
      const hireMax = s.locked || s.hireMaxed || s.count >= s.maxCount;
      const hire = s.locked
        ? actionBtn(tr("Kilitli"), null, 'btn-ghost')
        : hireMax
          ? actionBtn(tr("Kadro Dolu"), null, 'btn-ghost')
          : actionBtn(tr("İşe Al (+1)"), '₺' + this.api.formatMoney(s.hireCost), 'btn-brand');
      this.wire(
        hire,
        hireMax ? 'maxed' : s.canHire ? 'ok' : 'poor',
        () => this.api.hireStaff(s.id),
        s.unlockHint,
        tr('+1 {0}! 👷', s.name.toUpperCase()),
      );
      acts.appendChild(hire);

      const lvlMax = s.locked || s.levelMaxed || s.level >= s.maxLevel;
      const lvl = s.locked
        ? actionBtn(tr("Eğitim Kilitli"), null, 'btn-ghost')
        : lvlMax
          ? actionBtn(tr("Seviye MAKS"), null, 'btn-ghost')
          : actionBtn(tr("Eğit (Sv {0})", s.level + 1), '₺' + this.api.formatMoney(s.levelCost), 'btn-gold');
      const lvlFloat = s.levelDeltaBadge ? s.levelDeltaBadge + ' ⭐' : tr('SEVİYE {0}! ⭐', s.level + 1);
      this.wire(
        lvl,
        lvlMax ? 'maxed' : s.canLevel ? 'ok' : 'poor',
        () => this.api.levelStaff(s.id),
        s.locked ? s.unlockHint : s.count === 0 ? tr('Önce bu rolden bir çalışan işe al.') : undefined,
        lvlFloat,
      );
      acts.appendChild(lvl);
      if (!lvlMax && !s.canLevel && s.count > 0 && this.api.watchFreeStaffUpgrade) {
        const adBtn = this.freeUpgradeBtn(() => this.api.watchFreeStaffUpgrade?.(s.id, 'level'));
        if (adBtn) acts.appendChild(adBtn);
      }

      card.appendChild(acts);
      this.body.appendChild(card);
    }
  }

  // ---- 4. Şubeler ----------------------------------------------------

  private buildLocations(): void {
    // Bölge tamamlama teklifi buraya ait: bu panel "mekân ne kadar açıldı"
    // sorusunun cevabı, halkalar da bölge ilerlemesini gösteriyor.
    this.adOffer('zone_finish');
    this.decorEntry();

    const rows = this.api.getLocations();
    if (rows.length === 0) {
      this.empty(tr("Şube bulunamadı."));
      return;
    }
    for (const l of rows) {
      const card = el('div', 'card loc-card' + (l.active ? ' active' : ''));

      const head = el('div', 'c-row');
      const ring = makeRing('', formatPct(l.progress));
      ring.root.style.setProperty('--p', clamp01(l.progress).toFixed(3));
      head.appendChild(ring.root);

      const main = el('div', 'c-main');
      const nameRow = el('div', 'c-row');
      nameRow.appendChild(el('span', 'c-name', l.name));
      if (l.active) nameRow.appendChild(el('span', 'tag mint', tr("BURADASIN")));
      main.appendChild(nameRow);
      main.appendChild(el('span', 'loc-tag', l.tagline));
      head.appendChild(main);
      card.appendChild(head);

      const acts = el('div', 'c-actions');
      if (!l.unlocked) {
        if (l.requirementText) card.appendChild(el('div', 'c-desc', '🔒 ' + l.requirementText));
        const b = actionBtn(tr("Aç"), '₺' + this.api.formatMoney(l.cost), 'btn-gold');
        this.wire(b, l.canBuy ? 'ok' : 'poor', () => this.api.buyLocation(l.id), l.requirementText || undefined);
        acts.appendChild(b);
      } else if (!l.active) {
        const b = actionBtn(tr("Geç"), null, 'btn-mint');
        this.wire(b, 'ok', () => this.api.switchLocation(l.id));
        acts.appendChild(b);
      } else {
        acts.appendChild(el('span', 'tag mint', tr("Aktif şube")));
      }
      card.appendChild(acts);
      this.body.appendChild(card);
    }
  }

  // ---- 5. Ayarlar ----------------------------------------------------

  private buildSettings(): void {
    const s = this.api.getSettings();

    /* ---------------- SES & TİTREŞİM ---------------- */
    this.body.appendChild(this.setSection('🔊', tr("Ses & Titreşim")));
    this.body.appendChild(
      this.setCard(
        this.setToggle('🔊', tr("Ses Efektleri"), tr("Sipariş, hazırlama ve para sesleri"), !s.muted, (v) =>
          this.api.setSetting('muted', !v),
        ),
        this.slider('🎚️', tr("Efekt Seviyesi"), s.sfxVolume, (v) => this.api.setVolume('sfx', v)),
        this.setToggle('🎵', tr("Müzik"), tr("Kafenin arka plan melodisi"), s.music, (v) =>
          this.api.setSetting('music', v),
        ),
        this.slider('🎚️', tr("Müzik Seviyesi"), s.musicVolume, (v) => this.api.setVolume('music', v)),
        this.setToggle('📳', tr("Titreşim"), tr("Dokunma ve ödül anlarında titreşim"), s.haptics, (v) =>
          this.api.setSetting('haptics', v),
        ),
      ),
    );

    /* ---------------- GÖRÜNTÜ & PERFORMANS ---------------- */
    this.body.appendChild(this.setSection('📱', tr("Görüntü & Performans")));
    const fps = this.fpsRow();
    this.body.appendChild(
      this.setCard(
        this.qualityRow(),
        fps ??
          this.setToggle('📉', tr("Düşük Kalite"), tr("Gölgeleri kapatır, pili korur."), s.lowQuality, (v) =>
            this.api.setSetting('lowQuality', v),
          ),
        this.setToggle(
          '🍃',
          tr("Az Hareket"),
          tr("Sarsıntı ve yoğun animasyon efektlerini hafifletir."),
          s.reducedMotion,
          (v) => this.api.setSetting('reducedMotion', v),
        ),
      ),
    );

    /* ---------------- OYUN & DİL ---------------- */
    this.body.appendChild(this.setSection('🌐', tr("Oyun & Dil")));
    this.body.appendChild(
      this.setCard(
        this.languageRow(),
        this.setToggle(
          '⏸️',
          tr("Oyunu Duraklat"),
          tr("Kafe durur; sen dönene kadar siparişler beklemede kalır."),
          s.paused,
          (v) => this.api.setSetting('paused', v),
        ),
      ),
    );

    /* ---------------- NASIL OYNANIR ---------------- */
    this.body.appendChild(this.setSection('🕹️', tr("Nasıl Oynanır?")));
    this.body.appendChild(this.gameplayGuideCard());

    /* ---------------- TOPLULUK & DESTEK ---------------- */
    this.body.appendChild(this.setSection('⭐', tr("Topluluk & Destek")));
    this.body.appendChild(this.communityBlock());

    /* ---------------- KAYIT YEDEĞİ ---------------- */
    this.body.appendChild(this.setSection('☁️', tr("Kayıt & Yedekleme")));
    this.body.appendChild(this.backupBlock());

    /* ---------------- GİZLİLİK ---------------- */
    this.body.appendChild(this.setSection('🛡️', tr("Gizlilik & Güvenlik")));
    this.body.appendChild(this.privacyBlock());

    /* ---------------- TEHLİKELİ BÖLGE ---------------- */
    this.body.appendChild(this.setSection('⚠️', tr("Tehlikeli Bölge")));
    this.body.appendChild(this.resetBlock());

    /* ---------------- KÜNYE ---------------- */
    this.body.appendChild(this.buildFooter());
  }

  private setSection(glyph: string, title: string): HTMLElement {
    const hdr = el('div', 'set-sec-hdr');
    if (glyph) hdr.appendChild(el('span', 'set-sec-glyph', glyph));
    hdr.appendChild(el('span', 'set-sec-title', title));
    return hdr;
  }

  private setGroup(title: string): HTMLElement {
    return this.setSection('', title);
  }

  private setCard(...children: (HTMLElement | null)[]): HTMLElement {
    const card = el('div', 'set-card');
    for (const child of children) {
      if (child) card.appendChild(child);
    }
    return card;
  }

  private languageRow(): HTMLElement {
    const card = el('div', 'set-row set-seg-row');
    card.appendChild(el('span', 'tog-glyph', '🌐'));

    const main = el('span', 'set-main');
    main.appendChild(el('span', 'tog-l', tr("Oyun Dili")));
    main.appendChild(
      el(
        'span',
        'set-desc',
        tr("Dil değiştirildiğinde oyun kaydedilip yenilenir."),
      ),
    );
    const acts = el('div', 'set-seg');
    const cur = this.api.getLanguage();
    for (const [code, label] of [['tr', '🇹🇷 Türkçe'], ['en', '🇬🇧 English']] as const) {
      const b = el('button', 'seg-b ' + (cur === code ? 'on' : ''), label);
      b.type = 'button';
      b.setAttribute('aria-pressed', cur === code ? 'true' : 'false');
      b.addEventListener('click', () => {
        if (cur === code) return;
        sfx('ui_click');
        b.disabled = true;
        void this.api.changeLanguage(code);
      });
      acts.appendChild(b);
    }
    main.appendChild(acts);
    card.appendChild(main);
    return card;
  }

  private gameplayGuideCard(): HTMLElement {
    const card = el('div', 'set-card');

    const r1 = el('div', 'set-row');
    r1.appendChild(el('span', 'tog-glyph', '👆'));
    const m1 = el('span', 'set-main');
    m1.appendChild(el('span', 'tog-l', tr("Dokunmatik Hareket")));
    m1.appendChild(
      el(
        'span',
        'set-desc',
        tr("Ekranın herhangi bir yerine dokunup parmağını sürükleyerek karakterini yürüt."),
      ),
    );
    r1.appendChild(m1);
    card.appendChild(r1);

    const r2 = el('div', 'set-row');
    r2.appendChild(el('span', 'tog-glyph', '⚡'));
    const m2 = el('span', 'set-main');
    m2.appendChild(el('span', 'tog-l', tr("Otomatik Etkileşim")));
    m2.appendChild(
      el(
        'span',
        'set-desc',
        tr("Butona basmak yok. İstasyonlara, tezgaha ve masalara yaklaşınca alma, hazırlama ve servis kendiliğinden olur."),
      ),
    );
    r2.appendChild(m2);
    card.appendChild(r2);

    return card;
  }

  private communityBlock(): HTMLElement {
    const card = el('div', 'set-card');
    const storeUrl = isIos ? APP_STORE_URL : PLAY_STORE_URL;

    const infoRow = el('div', 'set-row');
    infoRow.appendChild(el('span', 'tog-glyph', '🌟'));
    const main = el('span', 'set-main');
    main.appendChild(el('span', 'tog-l', tr("Kafe Caddesi'ni Sevdin mi?")));
    main.appendChild(
      el(
        'span',
        'set-desc',
        isIos
          ? tr("App Store'da 5 yıldız vererek veya arkadaşlarınla paylaşarak bağımsız geliştiriciye destek olabilirsin.")
          : tr("Google Play'de 5 yıldız vererek veya arkadaşlarınla paylaşarak bağımsız geliştiriciye destek olabilirsin."),
      ),
    );
    infoRow.appendChild(main);
    card.appendChild(infoRow);

    const acts = el('div', 'set-card-actions');
    if (storeUrl) {
      const rateBtn = el(
        'a',
        'btn btn-gold btn-sm',
        isIos ? tr("⭐ App Store'da Puanla") : tr("⭐ Play Store'da Puanla"),
      ) as HTMLAnchorElement;
      rateBtn.href = storeUrl;
      rateBtn.target = '_blank';
      rateBtn.rel = 'noopener noreferrer';
      rateBtn.addEventListener('click', () => sfx('ui_click'));
      acts.appendChild(rateBtn);
    }

    const shareBtn = el('button', 'btn btn-mint btn-sm', tr("📤 Arkadaşınla Paylaş"));
    shareBtn.type = 'button';
    shareBtn.addEventListener('click', () => {
      sfx('ui_click');
      const baseMsg = isIos
        ? tr("Kafe Caddesi'nde kendi kafemi büyütüyorum! Sen de ücretsiz indir.")
        : tr("Kafe Caddesi'nde kendi kafemi büyütüyorum! Sen de ücretsiz indir:");
      const shareText = storeUrl ? `${baseMsg} ${storeUrl}` : baseMsg;
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        void navigator
          .share({
            title: 'Kafe Caddesi',
            text: baseMsg,
            ...(storeUrl ? { url: storeUrl } : {}),
          })
          .catch(() => {});
        return;
      }
      void navigator.clipboard?.writeText(shareText).then(() => {
        bus.emit('toast', {
          text: storeUrl ? tr("Mağaza bağlantısı panoya kopyalandı!") : tr("Paylaşım metni panoya kopyalandı!"),
          glyph: '📋',
          tone: 'good',
        });
      });
    });

    acts.appendChild(shareBtn);
    card.appendChild(acts);
    return card;
  }

  private privacyBlock(): HTMLElement {
    const card = el('div', 'set-card');

    const infoRow = el('div', 'set-row');
    infoRow.appendChild(el('span', 'tog-glyph', '🛡️'));
    const main = el('span', 'set-main');
    main.appendChild(el('span', 'tog-l', tr("Kişisel Veri Güvenliği")));
    main.appendChild(
      el(
        'span',
        'set-desc',
        tr("Hesap açmanız gerekmez. Oyun ilerlemesi yalnızca bu cihazda saklanır; kişisel veri toplanmaz."),
      ),
    );
    infoRow.appendChild(main);
    card.appendChild(infoRow);

    const diag = this.api.getDiagnostics();
    if (diag.available) {
      card.appendChild(
        this.setToggle(
          '📊',
          tr("Anonim Hata Raporları"),
          tr("Oyun kararlılığını artırmak için anonim çökme raporlarını paylaşır."),
          diag.sharing,
          (v) => this.api.setDiagnosticsSharing(v),
        ),
      );
    }

    const acts = el('div', 'set-card-actions');
    const policyBtn = el('a', 'btn btn-ghost btn-sm', tr("Gizlilik Politikası ↗")) as HTMLAnchorElement;
    policyBtn.href = GIZLILIK_URL;
    policyBtn.target = '_blank';
    policyBtn.rel = 'noopener noreferrer';

    const consentBtn = el('button', 'btn btn-ghost btn-sm', tr("Reklam Tercihleri"));
    consentBtn.type = 'button';
    consentBtn.addEventListener('click', () => {
      sfx('ui_click');
      void openPrivacyOptions().then((opened) => {
        if (!opened) bus.emit('toast', { text: tr("Bu cihaz için tercih formu gerekmiyor."), glyph: '✓', tone: 'info' });
      });
    });

    acts.appendChild(policyBtn);
    acts.appendChild(consentBtn);
    card.appendChild(acts);

    return card;
  }

  private buildFooter(): HTMLElement {
    const foot = el('div', 'set-footer');
    foot.appendChild(el('div', 'set-foot-brand', '☕ KAFE CADDESİ'));
    foot.appendChild(el('div', 'set-foot-sub', tr("Sokağın En Sıcak Kahve Serüveni")));
    foot.appendChild(el('div', 'set-foot-ver', tr("Sürüm {0} · Mobil", APP_VERSION)));
    foot.appendChild(el('div', 'set-foot-copy', tr("Tüm hakları saklıdır.")));
    return foot;
  }

  /**
   * Ayar satırı: simge + (ad · açıklama) + anahtar.
   *
   * `toggle()`'dan farkı AÇIKLAMA taşımasıdır. Ayar panelinde bir anahtarın
   * ne yaptığını yazmamak, oyuncuyu denemeye zorlar — "Az Hareket" gibi
   * erişilebilirlik ayarlarında bu doğrudan kullanılmamak demektir.
   */
  private setToggle(
    glyph: string,
    label: string,
    desc: string,
    on: boolean,
    set: (v: boolean) => void,
  ): HTMLButtonElement {
    const b = el('button', 'set-row tog' + (on ? ' on' : ''));
    b.type = 'button';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.appendChild(el('span', 'tog-glyph', glyph));
    const main = el('span', 'set-main');
    main.appendChild(el('span', 'tog-l', label));
    main.appendChild(el('span', 'set-desc', desc));
    b.appendChild(main);
    const sw = el('span', 'sw');
    sw.appendChild(el('i'));
    b.appendChild(sw);
    b.addEventListener('click', () => {
      const next = !b.classList.contains('on');
      sfx('ui_click');
      b.classList.toggle('on', next);
      b.setAttribute('aria-pressed', next ? 'true' : 'false');
      set(next);
      if (this.onChanged) this.onChanged();
    });
    return b;
  }

  /**
   * Seviye kaydırıcısı (0..1).
   *
   * Yerli `<input type="range">` kullanılır: dokunmatik hedef boyu,
   * klavye erişimi ve ekran okuyucu desteği bedava gelir. Panelin kendi
   * kaydırmasıyla çakışmasın diye `touch-action: none` verilir — aksi
   * hâlde parmağı yana sürüklemek paneli kaydırıyor, ayar oynamıyordu.
   */
  private slider(
    glyph: string,
    label: string,
    value: number,
    set: (v: number) => void,
  ): HTMLElement {
    const row = el('div', 'set-row set-slider');
    row.appendChild(el('span', 'tog-glyph', glyph));
    const main = el('span', 'set-main');
    const top = el('span', 'set-slider-top');
    top.appendChild(el('span', 'tog-l', label));
    const val = el('span', 'set-val', tr("%{0}", Math.round(value * 100)));
    top.appendChild(val);
    main.appendChild(top);

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '5';
    input.value = String(Math.round(value * 100));
    input.setAttribute('aria-label', label);
    input.style.touchAction = 'none';
    const paint = (): void => {
      const p = Number(input.value);
      val.textContent = tr("%{0}", p);
      input.style.setProperty('--p', `${p}%`);
    };
    paint();
    input.addEventListener('input', () => {
      paint();
      set(Number(input.value) / 100);
    });
    // Bırakınca tek bir tık: sürüklerken her adımda ses çalmak gürültü olur.
    input.addEventListener('change', () => sfx('ui_click'));
    main.appendChild(input);
    row.appendChild(main);
    return row;
  }

  /** Modern yedek al / geri yükle kartı. */
  private backupBlock(): HTMLElement {
    const card = el('div', 'set-card');

    const head = el('div', 'set-row');
    head.appendChild(el('span', 'tog-glyph', '💾'));
    const main = el('span', 'set-main');
    const top = el('span', 'set-row-top');
    top.appendChild(el('span', 'tog-l', tr("Cihaz Kaydı")));
    top.appendChild(el('span', 'tag mint', tr("GÜVENDE")));
    main.appendChild(top);
    main.appendChild(
      el(
        'span',
        'set-desc',
        tr("İlerlemeniz cihazınızda anlık olarak saklanır. Cihaz değiştirirken yedek kodunuzu kopyalayabilirsiniz."),
      ),
    );
    head.appendChild(main);
    card.appendChild(head);

    const statusNote = el('div', 'set-backup-status', '');
    statusNote.style.display = 'none';

    const acts = el('div', 'set-card-actions');
    const copyBtn = el('button', 'btn btn-mint btn-sm', tr("Yedek Kodu Kopyala"));
    copyBtn.type = 'button';

    const drawer = el('div', 'set-backup-drawer');
    drawer.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'set-backup-input';
    input.placeholder = tr("Yedek kodunu buraya yapıştırın…");
    input.spellcheck = false;

    copyBtn.addEventListener('click', () => {
      sfx('ui_click');
      const code = this.api.exportSave();
      if (!code) {
        statusNote.textContent = tr("Kayıt bulunamadı.");
        statusNote.className = 'set-backup-status bad';
        statusNote.style.display = 'block';
        return;
      }
      void navigator.clipboard
        ?.writeText(code)
        .then(() => {
          bus.emit('toast', { text: tr("Yedek kodu panoya kopyalandı!"), glyph: '📋', tone: 'good' });
          statusNote.textContent = tr("✓ Yedek kodu panoya kopyalandı.");
          statusNote.className = 'set-backup-status good';
          statusNote.style.display = 'block';
        })
        .catch(() => {
          drawer.style.display = 'flex';
          input.value = code;
          input.select();
          statusNote.textContent = tr("Kod aşağıda hazır — kopyalayabilirsiniz.");
          statusNote.className = 'set-backup-status info';
          statusNote.style.display = 'block';
        });
    });

    const loadBtn = el('button', 'btn btn-ghost btn-sm', tr("Yedek Yükle"));
    loadBtn.type = 'button';
    loadBtn.addEventListener('click', () => {
      sfx('ui_click');
      const willOpen = drawer.style.display === 'none';
      drawer.style.display = willOpen ? 'flex' : 'none';
      if (willOpen) input.focus();
    });

    acts.appendChild(copyBtn);
    acts.appendChild(loadBtn);
    card.appendChild(acts);

    const drawerActs = el('div', 'set-drawer-actions');
    const cancelBtn = el('button', 'btn btn-ghost btn-sm', tr("Vazgeç"));
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', () => {
      sfx('ui_click');
      drawer.style.display = 'none';
      input.value = '';
      statusNote.style.display = 'none';
    });

    const applyBtn = el('button', 'btn btn-mint btn-sm', tr("Yükle ve Başlat"));
    applyBtn.type = 'button';
    applyBtn.addEventListener('click', async () => {
      const text = input.value.trim();
      if (!text) {
        statusNote.textContent = tr("Lütfen önce yedek kodunu girin.");
        statusNote.className = 'set-backup-status bad';
        statusNote.style.display = 'block';
        return;
      }
      applyBtn.disabled = true;
      const ok = await this.api.importSave(text);
      if (!ok) {
        applyBtn.disabled = false;
        statusNote.textContent = tr("Kod okunamadı veya bozuk.");
        statusNote.className = 'set-backup-status bad';
        statusNote.style.display = 'block';
        sfx('error');
      }
    });

    drawerActs.appendChild(cancelBtn);
    drawerActs.appendChild(applyBtn);
    drawer.appendChild(input);
    drawer.appendChild(drawerActs);

    card.appendChild(drawer);
    card.appendChild(statusNote);

    return card;
  }

  /** Günlük ödül merdiveni + günün üç görevi. */
  private buildDaily(): void {
    const d = this.api.getDaily();

    /* Ödülü ikiye katlama teklifi ödül ALINMADAN ÖNCE görünür — alınmış
     * bir ödülü geriye dönük büyütmek vaat edilemez. */
    this.adOffer('daily_double');

    this.body.appendChild(el('div', 'sec-title', tr("Günlük Ödül")));

    const box = el('div', 'daily');
    const ladder = el('div', 'daily-ladder');
    for (let i = 0; i < d.ladder; i++) {
      const cell = el('div', 'dl-cell' + (i < d.streak ? ' past' : i === d.streak ? ' now' : ''));
      cell.appendChild(el('span', 'dl-day', `${i + 1}`));
      cell.appendChild(el('span', 'dl-mark', i < d.streak ? '✓' : '🎁'));
      ladder.appendChild(cell);
    }
    box.appendChild(ladder);

    const streakLine = el(
      'p',
      'daily-streak',
      d.streak > 0 ? tr("{0} gündür üst üste geliyorsun", d.streak + 1) : tr("Bugün seri başlıyor"),
    );
    box.appendChild(streakLine);

    const claim = el('button', 'btn' + (d.claimed ? '' : ' btn-gold'));
    claim.type = 'button';
    claim.disabled = d.claimed;
    claim.textContent = d.claimed ? tr("Bugün alındı") : tr('AL  +₺{0}', this.api.formatMoney(d.reward));
    claim.addEventListener('click', () => {
      sfx('ui_click');
      this.api.claimDaily();
    });
    box.appendChild(claim);
    this.body.appendChild(box);

    /* ---------------- görevler ---------------- */
    this.body.appendChild(el('div', 'sec-title', tr("Bugünün Görevleri")));
    for (let i = 0; i < d.missions.length; i++) {
      const m = d.missions[i];
      const done = m.current >= m.target;
      const row = el('div', 'mission' + (m.claimed ? ' claimed' : done ? ' ready' : ''));
      row.appendChild(el('span', 'm-glyph', m.glyph));

      const mid = el('div', 'm-mid');
      mid.appendChild(el('span', 'm-title', m.title));
      const bar = el('span', 'm-bar');
      const fill = el('i');
      fill.style.width = `${clamp01(m.current / Math.max(1, m.target)) * 100}%`;
      bar.appendChild(fill);
      mid.appendChild(bar);
      mid.appendChild(el('span', 'm-count', `${m.current} / ${m.target}`));
      row.appendChild(mid);

      if (m.claimed) {
        row.appendChild(el('span', 'm-done', '✓'));
      } else {
        const b = el('button', 'btn btn-sm' + (done ? ' btn-gold' : ''));
        b.type = 'button';
        b.disabled = !done;
        b.textContent = done ? `+₺${this.api.formatMoney(m.reward)}` : '…';
        b.addEventListener('click', () => {
          sfx('ui_click');
          this.api.claimMission(i);
        });
        row.appendChild(b);
      }
      this.body.appendChild(row);
    }
  }

  /* ---- v5.1: festival şeridi + haftalık hedef + müdavim albümü ---- */

  /**
   * Haftanın festivali — panelin ilk karesi: tema, etkisi, hedefi ve
   * kalan gün. Etki çarpanı ödül alınsa da hafta boyu sürer; şerit bunu
   * "alındı" satırında açıkça söyler.
   */
  private festivalStrip(): void {
    const f = this.api.getFestival();

    const box = el('div', 'fest');
    const head = el('div', 'fest-head');
    head.appendChild(el('span', 'fest-glyph', f.glyph));
    const mid = el('div', 'fest-mid');
    const top = el('div', 'c-row');
    top.appendChild(el('span', 'fest-title', f.title));
    top.appendChild(el('span', 'tag gold', f.daysLeft === 1 ? tr("Son gün") : tr("{0} gün", f.daysLeft)));
    mid.appendChild(top);
    mid.appendChild(el('div', 'fest-desc', f.desc));
    head.appendChild(mid);
    box.appendChild(head);

    const goal = el('div', 'fest-goal');
    goal.appendChild(el('span', 'fest-goal-name', f.goalTitle));
    goal.appendChild(el('span', 'm-count', `${f.current} / ${f.target}`));
    box.appendChild(goal);

    const bar = el('div', 'goal-mini');
    const fill = el('i');
    fill.style.width = (clamp01(f.current / (f.target || 1)) * 100).toFixed(1) + '%';
    bar.appendChild(fill);
    box.appendChild(bar);

    if (f.claimed) {
      box.appendChild(el('div', 'fest-done', tr("✓ Festival ödülü alındı — etkisi hafta boyu sürüyor")));
    } else {
      const b = el('button', 'btn' + (f.canClaim ? ' btn-gold' : ''));
      b.type = 'button';
      b.disabled = !f.canClaim;
      b.textContent =
        (f.canClaim ? tr("AL  ") : tr("Ödül: ")) + this.couponReward(f.reward, f.coupon);
      b.addEventListener('click', () => {
        sfx('ui_click');
        this.api.claimFestival();
      });
      box.appendChild(b);
    }
    this.body.appendChild(box);
  }

  /** Shared cash and coupon label for festival and weekly rewards. */
  private couponReward(reward: number, coupons: number): string {
    const label = coupons === 1 ? tr('1 kupon') : tr('{0} kupon', coupons);
    return `+₺${this.api.formatMoney(reward)} · 🎟️ ${label}`;
  }

  /** Haftalık hedef — tek büyük çubuk; Pazartesi yenilenir, ceza yok. */
  private weeklyBlock(): void {
    const w = this.api.getWeekly();
    this.body.appendChild(el('div', 'sec-title', tr("Haftalık Hedef")));

    const box = el('div', 'wk');
    const top = el('div', 'c-row');
    top.appendChild(el('span', 'wk-title', w.title));
    top.appendChild(el('span', 'tag gold', `🎟️ +${w.coupon}`));
    box.appendChild(top);

    const bar = el('div', 'wk-bar');
    const fill = el('i');
    fill.style.width = (clamp01(w.current / (w.target || 1)) * 100).toFixed(1) + '%';
    bar.appendChild(fill);
    box.appendChild(bar);

    const meta = el('div', 'wk-meta');
    meta.appendChild(el('span', 'm-count', `${w.current} / ${w.target}`));
    meta.appendChild(
      el('span', 'wk-days', w.daysLeft === 1 ? tr("Son gün — Pazartesi yenilenir") : tr("{0} gün kaldı", w.daysLeft)),
    );
    box.appendChild(meta);

    const b = el('button', 'btn' + (w.canClaim ? ' btn-gold' : ''));
    b.type = 'button';
    b.disabled = !w.canClaim;
    b.textContent = w.claimed
      ? tr("Bu hafta alındı ✓")
      : (w.canClaim ? tr("AL  ") : tr("Ödül: ")) + this.couponReward(w.reward, w.coupon);
    b.addEventListener('click', () => {
      sfx('ui_click');
      this.api.claimWeekly();
    });
    box.appendChild(b);
    this.body.appendChild(box);
  }

  /**
   * Müdavim Albümü — yedi tanıdık, ziyaret sayacı ve 5/20/60 eşikleri.
   * Satır iskeleti görev satırıyla aynı (m-*): albüm de "birikerek dolan
   * bir şey", ayrı bir görsel dil icat etmek paneli kalabalıklaştırır.
   */
  private albumBlock(): void {
    const rows = this.api.getAlbum();
    if (rows.length === 0) return;
    this.body.appendChild(el('div', 'sec-title', tr("Müdavim Albümü")));

    for (const r of rows) {
      const done = r.next === null;
      const row = el('div', 'mission alb' + (r.ready ? ' ready' : ''));
      row.appendChild(el('span', 'm-glyph', r.glyph));

      const mid = el('div', 'm-mid');
      const top = el('div', 'alb-top');
      top.appendChild(el('span', 'm-title', r.name));
      if (r.stars > 0) top.appendChild(el('span', 'alb-stars', '⭐'.repeat(r.stars)));
      mid.appendChild(top);
      mid.appendChild(el('span', 'alb-sub', r.title));

      const bar = el('span', 'm-bar');
      const fill = el('i');
      const span = done ? 1 : Math.max(1, (r.next as number) - r.prev);
      const p = done ? 1 : clamp01((r.visits - r.prev) / span);
      fill.style.width = (p * 100).toFixed(1) + '%';
      bar.appendChild(fill);
      mid.appendChild(bar);
      mid.appendChild(
        el('span', 'm-count', done ? tr("{0} ziyaret · albüm tamam", r.visits) : tr('{0} / {1} ziyaret', r.visits, r.next as number)),
      );
      row.appendChild(mid);

      if (done) {
        row.appendChild(el('span', 'm-done', '✓'));
      } else if (r.ready) {
        const b = el('button', 'btn btn-sm btn-gold');
        b.type = 'button';
        b.textContent = `+₺${this.api.formatMoney(r.reward)}`;
        b.addEventListener('click', () => {
          sfx('ui_click');
          this.api.claimAlbum(r.id);
        });
        row.appendChild(b);
      }
      this.body.appendChild(row);
    }
  }

  // ---- 7. Sokağı Devret (prestij) ------------------------------------

  /**
   * Yükseltmeler panelinin başındaki devir girişi.
   *
   * NEDEN HUD'A YENİ BUTON KOYULMADI: telefonda üst gösterge yığını v3.1'de
   * 300 px'den 88 px'e indirilmişti; beşinci bir yuvarlak buton o kazanımı
   * geri verirdi. Devir zaten "kalıcı yükseltme" demek — yükseltme arayan
   * oyuncu doğal olarak bu panele bakıyor.
   *
   * Kart yalnızca `visible` iken çizilir (bkz. Game.getPrestige): yeni
   * oyuncu "kafeni sıfırla" diyen bir kartla hiç karşılaşmaz.
   */
  private prestigeEntry(): void {
    const p = this.api.getPrestige();
    if (!p.visible) return;

    const card = el('div', 'card pres-entry' + (p.canPrestige ? ' hl' : ''));
    card.appendChild(el('div', 'c-glyph', '🏆'));

    const main = el('div', 'c-main');
    const top = el('div', 'c-row');
    top.appendChild(el('span', 'c-name', tr("Sokağı Devret")));
    if (p.points > 0) top.appendChild(el('span', 'tag gold', `${p.points} ☕`));
    main.appendChild(top);

    if (p.canPrestige) {
      main.appendChild(
        el('div', 'c-desc', tr("Kafeyi devret, +{0} Fincan Puanı kazan. Puanlar kalıcı yükseltmelere gider.", p.gain)),
      );
    } else {
      // Ufuktaki hedef: ne kadar kaldığı SAYIYLA yazar, çubuk da onu çizer.
      main.appendChild(
        el(
          'div',
          'c-desc',
          tr("Devir için ₺{0} ömür kazancı gerekiyor · şu an ₺{1}", this.api.formatMoney(p.minEarned), this.api.formatMoney(
            Math.floor(p.totalEarned),
          )),
        ),
      );
      const bar = el('div', 'goal-mini');
      const fill = el('i');
      fill.style.width = (clamp01(p.totalEarned / (p.minEarned || 1)) * 100).toFixed(1) + '%';
      bar.appendChild(fill);
      main.appendChild(bar);
    }
    card.appendChild(main);

    const btn = actionBtn(p.canPrestige ? tr("Aç") : tr("Bak"), null, p.canPrestige ? 'btn-gold' : 'btn-ghost');
    btn.addEventListener('click', () => this.open('prestige'));
    card.appendChild(btn);

    this.body.appendChild(card);
  }

  private buildPrestige(): void {
    const p = this.api.getPrestige();

    /* Bu panel Yükseltmeler'in içinden açılıyor — geri dönüş yolu görünsün. */
    const back = el('button', 'btn btn-ghost btn-sm pres-back', tr("‹ Yükseltmeler"));
    back.type = 'button';
    back.addEventListener('click', () => this.open('upgrades'));
    this.body.appendChild(back);

    /* Elde ne var: harcanmamış puan + kaçıncı tur. */
    const head = el('div', 'pres-head');
    head.appendChild(el('div', 'pres-pts', `${p.points} ☕`));
    head.appendChild(el('div', 'pres-lbl', tr("Fincan Puanı")));
    head.appendChild(
      el(
        'p',
        'pres-note',
        p.count > 0
          ? tr("Sokağı {0} kez devrettin. Her tur bir öncekinden hızlı geçer.", p.count)
          : tr("Devrettiğinde kafe sıfırdan başlar ama Fincan Puanı sonsuza kadar kalır."),
      ),
    );
    this.body.appendChild(head);

    this.body.appendChild(el('div', 'sec-title', tr("Kalıcı Yükseltmeler")));
    for (const u of p.rows) {
      const card = el('div', 'card');
      card.appendChild(el('div', 'c-glyph', u.glyph));

      const main = el('div', 'c-main');
      const top = el('div', 'c-row');
      top.appendChild(el('span', 'c-name', u.name));
      /**
       * Seviye DAİMA metin olarak yazılır, pips değil.
       *
       * `levelPips` 12 basamağa kadar nokta çiziyor; prestij tavanları
       * 12–25 arası olduğu için "Gece Vardiyası" ve "Sokağın Şöhreti"
       * satırlarında 12 nokta (117 px) adı kırpıyordu — 375 px'de ölçüldü.
       * Metin biçimi hem sığıyor hem beş satırı aynı hizada tutuyor.
       */
      top.appendChild(el('span', 'lvl-txt', tr('Sv {0}/{1}', u.level, u.maxLevel)));
      main.appendChild(top);
      main.appendChild(el('div', 'c-desc', u.desc));

      const delta = el('div', 'c-delta');
      delta.appendChild(el('span', 'from', u.effectText));
      if (!u.maxed) {
        delta.appendChild(el('span', 'arrow', '→'));
        delta.appendChild(el('span', undefined, u.nextText));
      }
      main.appendChild(delta);
      card.appendChild(main);

      const mode: BuyMode = u.maxed ? 'maxed' : u.canBuy ? 'ok' : 'poor';
      const btn = u.maxed ? actionBtn(tr("MAKS"), null, 'btn-ghost') : actionBtn(tr("Al"), `${u.cost} ☕`, 'btn-gold');
      this.wire(btn, mode, () => this.api.buyPrestigeUpgrade(u.id));
      card.appendChild(btn);

      this.body.appendChild(card);
    }

    this.body.appendChild(el('div', 'sec-title', tr("Devir")));
    this.body.appendChild(this.prestigeBlock(p));
  }

  /**
   * DEVRETME — iki adımlı onay.
   *
   * Yıkıcı bir eylem, o yüzden Ayarlar'daki "İlerlemeyi Sıfırla" ile aynı
   * onay kalıbını kullanır (bkz. resetBlock): tek dokunuşla asla olmaz,
   * ne gittiği ve ne kaldığı onay ekranında açıkça yazar, 6 saniye
   * dokunulmazsa kendiliğinden vazgeçilmiş sayılır.
   *
   * "Asla cezalandırma": devretmek bir zorunluluk değil; oyuncu istemezse
   * mevcut kafesinde oynamaya devam eder ve hiçbir şey kaybetmez.
   */
  private prestigeBlock(p: UiPrestige): HTMLDivElement {
    const box = el('div', 'pres-do');

    if (!p.canPrestige) {
      box.appendChild(
        el(
          'p',
          'pres-wait',
          tr("Devretmek için ₺{0} ömür kazancı gerekiyor. Şu ana kadar ₺{1} kazandın — acelesi yok, kafen büyümeye devam ediyor.", this.api.formatMoney(p.minEarned), this.api.formatMoney(
            Math.floor(p.totalEarned),
          )),
        ),
      );
      return box;
    }

    const info = el('p', undefined, tr("Şimdi devredersen +{0} Fincan Puanı kazanırsın.", p.gain));
    box.appendChild(info);

    const row = el('div', 'c-actions');
    const first = actionBtn(tr("SOKAĞI DEVRET"), `+${p.gain} ☕`, 'btn-gold btn-wide');

    /* Ne gider / ne kalır — onay anında GÖRÜNÜR olur. */
    const lists = el('div', 'pres-lists hide');

    const reset = () => {
      this.cancelConfirm();
      info.textContent = tr("Şimdi devredersen +{0} Fincan Puanı kazanırsın.", p.gain);
      lists.classList.add('hide');
      row.textContent = '';
      row.appendChild(first);
    };

    const gone = el('div', 'pres-col bad');
    gone.appendChild(el('span', 'pres-col-h', tr("SIFIRLANIR")));
    gone.appendChild(el('span', undefined, tr("Kasandaki para")));
    gone.appendChild(el('span', undefined, tr('Oyuncu yükseltmeleri (hız, taşıma, eller, satış değeri)')));
    gone.appendChild(el('span', undefined, tr('Kısmi alan ve personel ödemeleri')));
    gone.appendChild(el('span', undefined, tr("Personel ve seviyeleri")));
    gone.appendChild(el('span', undefined, tr("İstasyon yükseltmeleri")));
    gone.appendChild(el('span', undefined, tr("Açtığın bölgeler ve şubeler")));
    gone.appendChild(el('span', undefined, tr("Hedef zinciri")));
    lists.appendChild(gone);

    const keep = el('div', 'pres-col good');
    keep.appendChild(el('span', 'pres-col-h', tr("KALIR")));
    keep.appendChild(el('span', undefined, tr("Fincan Puanı ({0} + {1})", p.points, p.gain)));
    keep.appendChild(el('span', undefined, tr("Bütün kalıcı yükseltmeler")));
    keep.appendChild(el('span', undefined, tr('Satın aldığın dekorlar ve seçili görünüm')));
    keep.appendChild(el('span', undefined, tr('Kuponlar ve ödül ilerlemesi')));
    keep.appendChild(el('span', undefined, tr("Günlük giriş serin")));
    keep.appendChild(el('span', undefined, tr("Ömür istatistiklerin")));
    lists.appendChild(keep);
    box.appendChild(lists);

    first.addEventListener('click', () => {
      sfx('ui_click');
      info.textContent = tr("Emin misin? Kafe sıfırdan kurulur.");
      lists.classList.remove('hide');
      row.textContent = '';

      const no = el('button', 'btn btn-ghost btn-sm', tr("Vazgeç"));
      no.type = 'button';
      no.addEventListener('click', () => {
        sfx('ui_click');
        reset();
      });

      const yes = el('button', 'btn btn-gold btn-sm', tr('Evet, devret (+{0} ☕)', p.gain));
      yes.type = 'button';
      yes.addEventListener('click', () => {
        this.cancelConfirm();
        yes.disabled = true;
        if (this.api.doPrestige()) {
          this.close();
        } else {
          sfx('error');
          reset();
        }
      });

      row.appendChild(no);
      row.appendChild(yes);
      this.confirmTimer = window.setTimeout(reset, 6000);
    });

    row.appendChild(first);
    box.appendChild(row);
    return box;
  }

  // ---- 8. Dekorasyon --------------------------------------------------

  /**
   * ŞUBELER PANELİNİN BAŞINDAKİ DEKORASYON GİRİŞİ.
   *
   * NEDEN HUD'A BEŞİNCİ YUVARLAK BUTON KOYULMADI: telefonda üst gösterge
   * yığını v3.1'de 300 px'den 88 px'e indirilmişti ve yan buton kolonu da
   * dörtte tutuluyor; beşinci bir buton o kazanımı geri verirdi. Prestij
   * de aynı sebeple Yükseltmeler'in içine konmuştu — bu, o kalıbın ikinci
   * uygulaması.
   *
   * NEDEN ŞUBELER PANELİ: dekorasyon "mekânın kendisi" hakkında; bu panel
   * zaten "mekânım ne durumda" sorusunun cevabı ve HUD'daki düğmesi de
   * (🏪 ŞUBE) mekânın kendi düğmesi.
   */
  private decorEntry(): void {
    const p = this.api.cosmeticProgress();

    const card = el('div', 'card decor-entry');
    card.appendChild(el('div', 'c-glyph', '🎨'));

    const main = el('div', 'c-main');
    const top = el('div', 'c-row');
    top.appendChild(el('span', 'c-name', tr("Dekorasyon")));
    top.appendChild(el('span', 'tag gold', `${p.owned}/${p.total}`));
    main.appendChild(top);
    main.appendChild(
      el('div', 'c-desc', tr("Duvar, zemin, masa tablası ve üniformayı seç. Hiçbiri oyunu etkilemez.")),
    );
    card.appendChild(main);

    const btn = actionBtn(tr("Aç"), null, 'btn-mint');
    btn.addEventListener('click', () => this.open('decor'));
    card.appendChild(btn);

    this.body.appendChild(card);
  }

  private buildDecor(): void {
    /* Bu panel Şubeler'in içinden açılıyor — geri dönüş yolu görünsün. */
    const back = el('button', 'btn btn-ghost btn-sm pres-back', tr("‹ Şubeler"));
    back.type = 'button';
    back.addEventListener('click', () => this.open('locations'));
    this.body.appendChild(back);

    /**
     * İLK SATIR SÖZLEŞMEYİ YAZAR.
     *
     * "Hangisi daha iyi?" sorusu bu sistemin en büyük riski: oyuncu gizli
     * bir istatistik arıyorsa beğendiğini değil güçlü sandığını seçer.
     * Cevap panelin ilk satırında, açıkça duruyor.
     */
    this.body.appendChild(
      el(
        'div',
        'decor-note',
        tr('Dene: satın almadan kafende gör. Al veya Seç ile uygula; paneli kapatınca denemeler geri alınır. Görünümler istatistikleri değiştirmez.'),
      ),
    );

    /**
     * 🎟️ KUPON ŞERİDİ. Kupon varken fiyat etiketleri İNDİRİMLİ yazar
     * (couponPrice — çekirdekle aynı hesap) ve satın alma kuponlu köprüden
     * geçer. Kupon yalnız kozmetikte geçer; oyunu etkileyen hiçbir şeye
     * dokunmaz (bkz. api.ts COUPON_DISCOUNT notu).
     */
    const coupon = this.api.getCoupons();
    if (coupon.count > 0) {
      this.body.appendChild(
        el(
          'div',
          'coupon-note',
          '🎟️ ' + (coupon.count > 1
            ? tr('{0} kuponun var: bir sonraki satın alımda %40 indirim. Fiyatlar indirimli gösteriliyor.', coupon.count)
            : tr('Kuponun var: bir sonraki satın alımda %40 indirim. Fiyatlar indirimli gösteriliyor.')),
        ),
      );
    }

    for (const axis of this.api.getCosmetics()) {
      this.body.appendChild(el('div', 'sec-title', `${axis.glyph} ${axis.name}`));
      this.body.appendChild(el('div', 'decor-axis', axis.desc));
      for (const o of axis.options) {
        this.body.appendChild(this.decorRow(axis.id, o, coupon));
      }
    }
  }

  private decorRow(axisId: string, o: UiCosmeticOption, coupon: { count: number; money: number }): HTMLDivElement {
    const card = el('div', 'card' + (o.selected ? ' hl' : ''));
    card.dataset.uiKey = 'cosmetic-' + axisId + '-' + o.id;

    /* Renk çipi, kartın ikon yuvasında durur: bir görünümün "ikonu"
     * yazı değil rengin kendisidir. İki renkli seçenekler eğik bant. */
    const chip = el('div', 'c-glyph swatch');
    chip.style.background =
      o.swatch.length > 1
        ? `linear-gradient(135deg, ${o.swatch[0]} 0 50%, ${o.swatch[1]} 50% 100%)`
        : o.swatch[0];
    card.appendChild(chip);

    const main = el('div', 'c-main');
    const top = el('div', 'c-row');
    top.appendChild(el('span', 'c-name', o.name));
    if (o.previewed) top.appendChild(el('span', 'tag gold', tr('DENEME')));
    else if (o.selected) top.appendChild(el('span', 'tag mint', tr("SEÇİLİ")));
    else if (o.owned) top.appendChild(el('span', 'tag', tr("ALINDI")));
    main.appendChild(top);
    main.appendChild(el('div', 'c-desc', o.desc));
    card.appendChild(main);

    const actions = el('div', 'decor-actions');
    const preview = actionBtn(o.previewed ? tr('Geri al') : tr('Dene'), null, 'btn-ghost');
    preview.addEventListener('click', () => {
      if (o.previewed) this.api.cancelCosmeticPreview();
      else this.api.previewCosmetic(axisId, o.id);
      this.build('decor');
    });
    if (!o.selected || o.previewed) actions.appendChild(preview);
    let btn: HTMLButtonElement;
    let mode: BuyMode;
    // Kuponlu fiyat yalnız GERÇEK bir satın almada geçer (ücretsizler hariç).
    const useCoupon = coupon.count > 0 && !o.owned && o.cost > 0;
    if (o.selected) {
      btn = actionBtn(tr("Seçili"), null, 'btn-ghost');
      mode = 'maxed';
    } else if (o.owned) {
      btn = actionBtn(tr("Seç"), null, 'btn-mint');
      mode = 'ok';
    } else if (useCoupon) {
      const price = couponPrice(o.cost);
      btn = actionBtn(tr("Al"), '🎟️ ₺' + this.api.formatMoney(price), 'btn-gold');
      // `affordable` tam fiyata göre gelir; kuponla eşik indirimli fiyattır.
      mode = coupon.money >= price ? 'ok' : 'poor';
    } else {
      btn = actionBtn(tr("Al"), '₺' + this.api.formatMoney(o.cost), 'btn-gold');
      mode = o.affordable ? 'ok' : 'poor';
    }
    this.wire(btn, mode, () =>
      o.owned
        ? this.api.selectCosmetic(axisId, o.id)
        : useCoupon
          ? this.api.buyCosmeticCoupon(axisId, o.id)
          : this.api.buyCosmetic(axisId, o.id),
    );
    actions.appendChild(btn);
    card.appendChild(actions);
    return card;
  }

  // ---- ödüllü reklam teklifleri --------------------------------------

  /**
   * Reklam teklifi kartı.
   *
   * Kart YALNIZCA sağlayıcı hazır olduğunda çizilir. Sağlayıcı yokken
   * (bugünkü varsayılan) `getAdOffers()` her teklife `ready:false` döner ve
   * bu fonksiyon tek bir düğüm bile eklemez — oyun tamamen reklamsız
   * görünür ve eksiksiz oynanır. Teklifin kendisi de bir kapı değil,
   * yalnızca hızlandırıcıdır.
   */
  /**
   * ÖDÜLLÜ REKLAM TEKLİF KARTI.
   *
   * Kart yalnız `ready` iken çizilir; sağlayıcı bağlı değilse hiçbir
   * yerleşim hazır olmadığı için arayüzde reklam kelimesi bile geçmez.
   * Teklifin hangi panelde durduğu rastgele değil: her biri oyuncunun o
   * ödülü İSTEDİĞİ ekrana konur (bkz. Game.getAdOffers'taki istek anı
   * koşulları). Her zaman ekranda duran teklif, teklif körlüğü yaratır.
   */
  private adOffer(kind: UiAdKind): void {
    const offers = this.api.getAdOffers();
    const META: Record<UiAdKind, { o: UiAdOffer; glyph: string; ad: string }> = {
      happy_hour: { o: offers.happyHour, glyph: '🎉', ad: tr("Mutlu Saat") },
      zone_finish: { o: offers.zoneFinish, glyph: '🚧', ad: tr("Bölümü Tamamla") },
      robot_vacuum: { o: offers.robotVacuum, glyph: '🤖', ad: tr("Süpürge Robotu") },
      stock_refill: { o: offers.stockRefill, glyph: '📦', ad: tr("Depoları Doldur") },
      daily_double: { o: offers.dailyDouble, glyph: '🎁', ad: tr("Ödülü İkiye Katla") },
    };
    const meta = META[kind];
    const o = meta.o;
    if (!o.ready || this.body.querySelector('.offer')) return;

    const card = el('div', 'card offer');
    card.appendChild(el('div', 'c-glyph', meta.glyph));

    const main = el('div', 'c-main');
    const top = el('div', 'c-row');
    top.appendChild(el('span', 'c-name', meta.ad));
    top.appendChild(el('span', 'tag mint', tr("HEDİYE")));
    main.appendChild(top);
    main.appendChild(el('div', 'c-desc', o.text));
    card.appendChild(main);

    /* Reklam asenkron: buton beklerken kilitlenir, ödül gelmezse açılır. */
    const btn = actionBtn(tr("İzle"), tr("REKLAM"), 'btn-mint');
    let busy = false;
    btn.addEventListener('click', () => {
      if (busy) return;
      busy = true;
      btn.disabled = true;
      sfx('ui_click');
      void this.api.watchAd(kind).then((ok) => {
        if (ok) {
          sfx('upgrade');
          retrigger(btn, 'fx-ok-a', 'fx-ok-b');
          this.afterBuy();
          return;
        }
        // Ödül hak edilmedi (reklam kapatıldı / gösterilemedi): CEZA YOK,
        // buton yeniden denenebilir hâle döner.
        busy = false;
        btn.disabled = false;
        retrigger(btn, 'fx-shake-a', 'fx-shake-b');
      });
    });
    card.appendChild(btn);

    this.body.appendChild(card);
  }

  private qualityRow(): HTMLElement {
    const card = el('div', 'set-row');
    card.appendChild(el('span', 'tog-glyph', '✨'));
    const main = el('span', 'set-main');
    const top = el('span', 'set-row-top');
    top.appendChild(el('span', 'tog-l', tr('Grafik Kalitesi')));
    top.appendChild(el('span', 'tag mint', tr("DENGELİ")));
    main.appendChild(top);
    main.appendChild(
      el(
        'span',
        'set-desc',
        tr("Cihazınızın gücüne ve ısısına göre dinamik olarak en yüksek akıcılığı sağlar."),
      ),
    );
    card.appendChild(main);
    return card;
  }

  private fpsRow(): HTMLElement | null {
    const set = this.api.setFps;
    if (!set) return null;
    const current = this.api.getSettings().fps;
    const card = el('div', 'set-row set-seg-row');
    card.appendChild(el('span', 'tog-glyph', '⚡'));

    const main = el('span', 'set-main');
    main.appendChild(el('span', 'tog-l', tr("Kare Hızı (FPS)")));
    main.appendChild(
      el(
        'span',
        'set-desc',
        tr("30 FPS pili korur; 60 FPS ultra akıcı oyun deneyimi sunar."),
      ),
    );
    const acts = el('div', 'set-seg');
    const buttons: { b: HTMLButtonElement; id: UiFpsPreference }[] = [];
    const paint = (active: UiFpsPreference): void => {
      for (const entry of buttons) {
        entry.b.classList.toggle('on', entry.id === active);
        entry.b.setAttribute('aria-pressed', entry.id === active ? 'true' : 'false');
      }
    };
    for (const choice of FPS_CHOICES) {
      const b = el('button', 'seg-b ' + (choice.id === current ? 'on' : ''), choice.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', choice.id === current ? 'true' : 'false');
      b.addEventListener('click', () => {
        sfx('ui_click');
        set.call(this.api, choice.id);
        paint(choice.id);
        if (this.onChanged) this.onChanged();
      });
      buttons.push({ b, id: choice.id });
      acts.appendChild(b);
    }
    main.appendChild(acts);
    card.appendChild(main);
    return card;
  }

  private toggle(
    glyph: string,
    label: string,
    on: boolean,
    set: (v: boolean) => void,
  ): HTMLButtonElement {
    const b = el('button', 'tog' + (on ? ' on' : ''));
    b.type = 'button';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.appendChild(el('span', 'tog-glyph', glyph));
    b.appendChild(el('span', 'tog-l', label));
    const sw = el('span', 'sw');
    sw.appendChild(el('i'));
    b.appendChild(sw);
    b.addEventListener('click', () => {
      const next = !b.classList.contains('on');
      sfx('ui_click');
      b.classList.toggle('on', next);
      b.setAttribute('aria-pressed', next ? 'true' : 'false');
      set(next);
      if (this.onChanged) this.onChanged();
    });
    return b;
  }

  /** İki adımlı güvenli sıfırlama kartı. */
  private resetBlock(): HTMLElement {
    const card = el('div', 'set-card set-card-danger');

    const row = el('div', 'set-row');
    row.appendChild(el('span', 'tog-glyph', '⚠️'));
    const main = el('span', 'set-main');
    main.appendChild(el('span', 'tog-l', tr("İlerlemeyi Sıfırla")));
    const desc = el(
      'span',
      'set-desc',
      tr("Bütün kafe ilerlemeniz, çalışanlarınız ve bakiyeniz kalıcı olarak silinir."),
    );
    main.appendChild(desc);
    row.appendChild(main);
    card.appendChild(row);

    const acts = el('div', 'set-card-actions');
    const first = el('button', 'btn btn-bad btn-sm', tr("İlerlemeyi Sıfırla"));
    first.type = 'button';

    const resetState = () => {
      this.cancelConfirm();
      desc.textContent = tr("Bütün kafe ilerlemeniz, çalışanlarınız ve bakiyeniz kalıcı olarak silinir.");
      acts.textContent = '';
      acts.appendChild(first);
    };

    first.addEventListener('click', () => {
      sfx('ui_click');
      desc.textContent = tr("Emin misiniz? Kafe sıfırlanacak ve baştan başlayacaksınız.");
      acts.textContent = '';
      const no = el('button', 'btn btn-ghost btn-sm', tr("Vazgeç"));
      no.type = 'button';
      no.addEventListener('click', () => {
        sfx('ui_click');
        resetState();
      });
      const yes = el('button', 'btn btn-bad btn-sm', tr("Evet, Tamamen Sıfırla"));
      yes.type = 'button';
      yes.addEventListener('click', () => {
        sfx('error');
        this.cancelConfirm();
        this.api.resetProgress();
        this.close();
      });
      acts.appendChild(no);
      acts.appendChild(yes);
      this.confirmTimer = window.setTimeout(resetState, 6000);
    });

    acts.appendChild(first);
    card.appendChild(acts);
    return card;
  }

  private cancelConfirm(): void {
    if (this.confirmTimer !== 0) {
      window.clearTimeout(this.confirmTimer);
      this.confirmTimer = 0;
    }
  }

  // ---- 6. Hedefler ---------------------------------------------------

  private collectionBlock(): void {
    const collection = this.api.getCollection();
    const details = el('details', 'collection');
    details.open = true;
    const summary = el('summary', 'sec-title', tr('Kafe Albümü'));
    details.appendChild(summary);
    details.appendChild(el('p', 'c-desc', tr('Tarif ustalığı: 10, 50 ve 150 satış. Her yıldız ustalık ödülü kazandırır ve albümünü tamamlar.')));
    for (const recipe of collection.recipes) {
      const row = el('div', 'collection-row');
      row.appendChild(el('span', 'c-glyph', recipe.glyph));
      const main = el('div', 'c-main');main.appendChild(el('span', 'c-name', recipe.name));
      main.appendChild(el('span', 'c-desc', recipe.next === null ? tr('{0} satış · usta', recipe.count) : tr('{0}/{1} satış', recipe.count, recipe.next)));
      row.appendChild(main);const badges = el('span', 'collection-badges');
      badges.setAttribute('aria-label', tr('{0}/3 rozet', recipe.stars));
      for(let i=0;i<3;i++){const badge=el('span', i<recipe.stars?'earned':'', '⭐');badges.appendChild(badge);}
      row.appendChild(badges);details.appendChild(row);
    }
    for(const place of collection.places)details.appendChild(el('div','c-desc collection-place',(place.seen?'✓ ':'🔒 ')+place.name));
    this.body.appendChild(details);
  }

  private buildGoals(): void {
    /**
     * Panel yukarıdan aşağı zaman ölçeğine göre akar: HAFTANIN teması
     * (festival şeridi) → BUGÜN (günlük ödül + görevler) → BU HAFTA
     * (haftalık hedef) → BİRİKEN (müdavim albümü) → KALICI (hedef
     * zinciri). Oyuncu zaten "şimdi ne yapayım" diye buraya bakıyor;
     * cevaplar en kısa vadeliden en uzuna sıralı.
     */
    this.festivalStrip();
    this.buildDaily();
    this.weeklyBlock();
    this.collectionBlock();

    const goals = this.api.getGoals();
    if (goals.length === 0) return;
    this.body.appendChild(el('div', 'sec-title', tr("Hedef Zinciri")));
    let activeIdx = goals.length;
    for (let i = 0; i < goals.length; i++) {
      if (goals[i].current < goals[i].target) {
        activeIdx = i;
        break;
      }
    }
    for (let i = 0; i < goals.length; i++) {
      this.body.appendChild(this.goalRow(goals[i], i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'future'));
    }
    this.body.appendChild(el('div', 'sec-title', tr("Topluluk & Destek")));
    this.body.appendChild(this.communityBlock());
  }

  private goalRow(g: UiGoal, state: 'done' | 'active' | 'future'): HTMLDivElement {
    const card = el(
      'div',
      'card goal-row ' + (state === 'done' ? 'done' : state === 'active' ? 'hl' : 'future'),
    );
    card.appendChild(el('div', 'c-glyph', state === 'done' ? '✅' : state === 'active' ? '🎯' : '🔒'));

    const main = el('div', 'c-main');
    const top = el('div', 'c-row');
    top.appendChild(el('span', 'c-name', g.title));
    top.appendChild(el('span', 'tag gold', '+₺' + this.api.formatMoney(g.reward)));
    main.appendChild(top);

    if (state === 'active') {
      if (g.hint) main.appendChild(el('div', 'goal-hint', g.hint));
      const bar = el('div', 'goal-mini');
      const fill = el('i');
      fill.style.width = (clamp01(g.current / (g.target || 1)) * 100).toFixed(1) + '%';
      bar.appendChild(fill);
      main.appendChild(bar);
      main.appendChild(
        el('div', 'c-desc', tr('{0} / {1} · {2}. hedef', Math.floor(g.current), Math.floor(g.target), g.index + 1)),
      );
      if (this.api.followGoal) {
        const actions = el('div', 'c-actions');
        const follow = actionBtn(tr('HEDEFE GİT'), null, 'btn-mint');
        follow.addEventListener('click', () => {
          sfx('ui_click');
          this.api.followGoal?.();
        });
        actions.appendChild(follow);
        main.appendChild(actions);
      }
    } else if (state === 'done') {
      main.appendChild(el('div', 'c-desc', tr("Tamamlandı")));
    } else {
      main.appendChild(el('div', 'c-desc', tr("Sırası gelince açılır")));
    }
    card.appendChild(main);
    return card;
  }

  dispose(): void {
    this.focus.dispose();
    this.api.cancelCosmeticPreview();
    for (const off of this.offs) off();
    this.offs.length = 0;
    if (this.rebuildTimer !== 0) window.clearTimeout(this.rebuildTimer);
    this.cancelConfirm();
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }
}
