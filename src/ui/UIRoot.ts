import { setIconText } from './Icons';
import { tr } from "../core/I18n";
import type {
  UIApi,
  UIRoot,
  UiAdKind,
  UiEventBanner,
  UiOfflineReport,
  UiPanelId,
  UiTutorialStep,
} from './api';
import { bus, sfx } from '../core/EventBus';
import { HUD, blockPointer, el, retrigger } from './HUD';
import { Panels } from './Panels';
import { ToastStack, type ToastTone } from './Toast';
import { FloatingTextPool, type FloatTone } from './FloatingText';
import { CoinFlightPool } from './CoinFlight';
import { TutorialLayer } from './Tutorial';
import { ModalFocus } from './ModalFocus';
import { damp, formatDuration } from '../core/MathUtils';

const CONFETTI = 24;
const CONFETTI_COLORS = ['#ffc84a', '#e2703a', '#4fb59a', '#f5ead6', '#64a9d8', '#ffdd8a'];
const CELEBRATE_LIFE = 2.6;

class UIRootImpl implements UIRoot {
  private readonly api: UIApi;
  private readonly host: HTMLElement;
  private readonly root: HTMLDivElement;

  private readonly hud: HUD;
  private readonly panels: Panels;
  private readonly toasts: ToastStack;
  private readonly floats: FloatingTextPool;
  private readonly coins: CoinFlightPool;
  private hudTimer = 0;
  private hudCache: import('./api').UiHudState | null = null;
  private readonly tut: TutorialLayer;

  // dönüş özeti ("Sen yokken…")
  private readonly mw: HTMLDivElement;
  private readonly offlineModal: HTMLDivElement;
  private readonly offlineFocus: ModalFocus;
  private readonly offTime: HTMLDivElement;
  private readonly offCount: HTMLDivElement;
  private readonly offUnit: HTMLDivElement;
  private readonly offMachines: HTMLDivElement;
  private readonly offLines: HTMLDivElement;
  /** v5.1 — "dönüş satışı" reklam butonu; yalnız teklif hazırken görünür. */
  private readonly offAdBtn: HTMLButtonElement;
  private offOpen = false;
  private offShown = 0;
  private offTarget = 0;
  private offLastInt = -1;
  private offIsMoney = false;

  // kutlama
  private readonly cel: HTMLDivElement;
  private readonly celGlyph: HTMLDivElement;
  private readonly celTitle: HTMLDivElement;
  private readonly celSub: HTMLDivElement;
  private readonly confetti: HTMLElement[] = [];
  private celT = 0;
  private celOn = false;

  private readonly boot: HTMLElement | null;
  private bootTimer = 0;

  private lastT = 0;
  private tutorialVisible = true;
  private lastReduced: boolean | null = null;
  private readonly offs: (() => void)[] = [];
  private readonly onKey: (e: KeyboardEvent) => void;

  constructor(api: UIApi, host: HTMLElement) {
    this.api = api;
    this.host = host;
    host.classList.add('ui-host');

    this.root = el('div', 'ui');

    // --- katmanlar (DOM sırası = boyama sırası) ---
    this.panels = new Panels(api);
    this.hud = new HUD(api, (id) => this.togglePanel(id));
    this.floats = new FloatingTextPool(28);
    this.coins = new CoinFlightPool();
    // Jeton cüzdana varınca rozeti zıplat ve parlak merdiven çanını çal
    this.coins.setArriveHandler(() => {
      this.hud.punchMoney();
      sfx('coin', 0.65);
    });
    this.tut = new TutorialLayer(() => {
      this.api.skipTutorial();
      this.setTutorial(null);
    });
    this.toasts = new ToastStack(6);

    this.root.appendChild(this.hud.root);
    this.root.appendChild(this.coins.root);
    this.root.appendChild(this.tut.root);
    this.root.appendChild(this.panels.root);
    this.root.appendChild(this.floats.root);
    this.root.appendChild(this.toasts.root);

    /* --- dönüş özeti: "Raflar hazır!" ------------------------------
     * PARA VAAT ETMEZ. Oyun bilerek offline kazanç vermiyor (bkz.
     * sim/Offline.ts); bu pencere yalnızca DOLAN RAFI haber verir ve
     * servise çağırır. Büyük sayının başında ₺ yok, rengi de altın değil
     * nane: altın bu oyunun dilinde "para" demek. */
    this.mw = el('div', 'mw');
    const modal = el('div', 'modal');
    this.offlineModal = modal;
    // Eski sepet emojisi (🧺) market temasından kalmıştı; burası kafe.
    modal.appendChild(el('div', 'off-basket', '☕'));
    const offlineTitle = el('h2', 'off-title', tr('Raflar hazır!'));
    offlineTitle.id = 'fincan-offline-title';
    offlineTitle.tabIndex = -1;
    modal.appendChild(offlineTitle);
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', offlineTitle.id);
    this.offTime = el('div', 'off-time', '');
    modal.appendChild(this.offTime);
    this.offCount = el('div', 'off-earn off-stock', '0');
    modal.appendChild(this.offCount);
    this.offUnit = el('div', 'off-unit', tr("ürün rafta — dokun ve servis et"));
    modal.appendChild(this.offUnit);
    this.offMachines = el('div', 'off-sold', '');
    modal.appendChild(this.offMachines);
    this.offLines = el('div', 'off-lines');
    modal.appendChild(this.offLines);
    /* v5.1 — DÖNÜŞ SATIŞI (comeback_sale). Stok raporunun hemen altında,
     * yalnız Game rapora `comebackReady` yazdıysa görünür: dolan stoğun
     * yarısını reklamla anında satar. İzlemeyen HİÇBİR ŞEY kaybetmez —
     * ürünler zaten raflarda servis edilmeyi bekler; buton yalnız ektir.
     * Kazanç toast'ı Game'den gelir; başarıda modalın işi biter, kapanır. */
    this.offAdBtn = el('button', 'btn btn-mint btn-wide', tr("📺 İZLE — stoğun yarısını hemen sat"));
    this.offAdBtn.type = 'button';
    this.offAdBtn.style.display = 'none';
    this.offAdBtn.style.marginBottom = '10px';
    this.offAdBtn.addEventListener('click', () => {
      if (this.offAdBtn.disabled) return;
      /* Reklam asenkron: buton beklerken kilitlenir; ödül gelmezse (kapatıldı /
       * gösterilemedi) açılır ve yeniden denenebilir — ceza yok. */
      this.offAdBtn.disabled = true;
      sfx('ui_click');
      void this.api.watchAd('comeback_sale').then((ok) => {
        this.offAdBtn.disabled = false;
        if (ok) this.closeOffline();
      });
    });
    modal.appendChild(this.offAdBtn);
    const claim = el('button', 'btn btn-gold btn-wide', tr("SERVİSE BAŞLA"));
    claim.type = 'button';
    claim.addEventListener('click', () => this.closeOffline());
    modal.appendChild(claim);
    this.mw.appendChild(modal);
    this.offlineFocus = new ModalFocus(this.mw, offlineTitle);
    // Butondan başka hiçbir yolla kapanmaz
    blockPointer(this.mw);
    this.root.appendChild(this.mw);

    // --- kutlama ---
    this.cel = el('div', 'cel');
    const conf = el('div', 'confetti');
    for (let i = 0; i < CONFETTI; i++) {
      const c = el('i', 'cfi');
      c.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      conf.appendChild(c);
      this.confetti.push(c);
    }
    this.cel.appendChild(conf);
    this.celGlyph = el('div', 'cel-glyph', '🎉');
    this.cel.appendChild(this.celGlyph);
    this.celTitle = el('div', 'cel-title', '');
    this.cel.appendChild(this.celTitle);
    this.celSub = el('div', 'cel-sub', '');
    this.cel.appendChild(this.celSub);
    this.cel.addEventListener('click', () => this.endCelebrate());
    blockPointer(this.cel);
    this.root.appendChild(this.cel);

    host.appendChild(this.root);

    // --- bağlantılar ---
    /*
     * `panel-on` sınıfı toast yığınını üst şeride taşır (bkz. ui.css).
     * Panel ekranın altına yaslı olduğu için bildirimin varsayılan yeri
     * tam panelin buton alanına düşüyor ve içeriği kapatıyordu.
     */
    /* Çipe basınca ödüllü reklam akışı başlar; sonuç ne olursa olsun çip
     * kapanır — teklif tüketildi, ekranda asılı kalmamalı. */
    this.hud.onAdChip = (kind) => {
      this.hud.hideAdChip();
      void this.api.watchAd(kind);
    };

    this.panels.onOpened = (id) => {
      this.hud.setActivePanel(id);
      this.root.classList.add('panel-on');
      this.hud.root.inert = true;
      this.tut.root.inert = true;
      this.hud.hideAdChip();
    };
    this.panels.onClosed = () => {
      this.hud.setActivePanel(null);
      this.hud.markBadgesDirty();
      this.applySettings();
      this.root.classList.remove('panel-on');
      this.hud.root.inert = this.offOpen;
      this.tut.root.inert = this.offOpen;
    };
    this.panels.onChanged = () => {
      this.hud.markBadgesDirty();
      this.applySettings();
    };

    this.offs.push(
      bus.on('toast', (p) => this.toast(p.text, p.glyph, p.tone)),
      bus.on('ui:float', (p) => this.floatText(p.x, p.y, p.text, p.tone)),
      bus.on('ui:refresh', () => this.applySettings()),
    );

    this.onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.handleBack()) {
          e.preventDefault();
        }
        return;
      }
      if (e.key >= '1' && e.key <= '5') {
        if (this.root.querySelector('.side.hide') || this.offOpen || this.celOn || this.tutorialVisible) return;
        const ids: UiPanelId[] = ['upgrades', 'staff', 'locations', 'goals', 'settings'];
        const id = ids[Number(e.key) - 1];
        if (id) {
          e.preventDefault();
          this.togglePanel(id);
        }
      }
    };
    window.addEventListener('keydown', this.onKey);

    this.boot = document.getElementById('boot-screen');
    this.applySettings();
  }

  // ------------------------------------------------------------------
  // Kare döngüsü
  // ------------------------------------------------------------------

  update(dt: number): void {
    const d = this.uiDt(dt);
    /**
     * HUD durumu 12 Hz'de toplanır, her karede değil.
     *
     * `getHud()` yirmi alanlı bir nesne kurar ve içinde bölge/istasyon/masa
     * üzerinde ~150 yinelemelik döngüler var. HUD'un kendi yazımları zaten
     * kirli-kontrolü yaptığı için her karede toplamak saf israftı; 12 Hz
     * gözle fark edilmez (sayaçlar zaten yumuşak akıyor).
     */
    this.hudTimer += d;
    let fresh = false;
    if (this.hudTimer >= 1 / 12 || this.hudCache === null) {
      this.hudTimer = 0;
      this.hudCache = this.api.getHud();
      fresh = true;
    }
    this.hud.update(d, this.hudCache, fresh);
    this.coins.setTarget(this.hud.moneyAnchorX(), this.hud.moneyAnchorY());
    this.coins.update(d);
    this.floats.update(d);
    this.toasts.update(d);

    if (this.offOpen && this.offShown !== this.offTarget) {
      this.offShown =
        Math.abs(this.offTarget - this.offShown) < 1 ? this.offTarget : damp(this.offShown, this.offTarget, 5.5, d);
      const n = Math.floor(this.offShown);
      if (n !== this.offLastInt) {
        this.offLastInt = n;
        this.offCount.textContent = this.offIsMoney ? `₺${this.api.formatMoney(n)}` : String(n);
      }
    }

    if (this.celOn) {
      this.celT -= d;
      if (this.celT <= 0) this.endCelebrate();
    }
  }

  /** Oyun duraklasa bile arayüz akıcı kalsın diye duvar saati kullanılır. */
  private uiDt(dt: number): number {
    const now = performance.now();
    let d = this.lastT === 0 ? dt : (now - this.lastT) / 1000;
    this.lastT = now;
    if (!(d > 0)) d = dt > 0 ? dt : 0.016;
    return d > 0.1 ? 0.1 : d;
  }

  // ------------------------------------------------------------------
  // Sözleşme yüzeyi
  // ------------------------------------------------------------------

  showOffline(report: UiOfflineReport): void {
    this.panels.close();
    this.offTime.textContent = tr("{0} sonra raflar doldu", formatDuration(report.seconds));
    this.offMachines.textContent =
      report.machines === 1 ? tr("1 makine rafları doldurdu") : tr("{0} makine rafları doldurdu", report.machines);
    this.offLines.textContent = '';
    this.offLines.appendChild(el('p', 'c-desc', tr('Raflar hazır. Dokun, al ve servis et.')));
    if (report.nextGoal) this.offLines.appendChild(el('p', 'off-next-goal', tr('Sıradaki hedef: {0}', report.nextGoal)));
    if (report.offlineCash && report.offlineCash > 0) {
      const cashRow = el('div', 'off-line');
      cashRow.appendChild(el('span', 'g', '💰'));
      cashRow.appendChild(el('span', undefined, tr("Gece vardiyası nakdi: +₺{0}", this.api.formatMoney(report.offlineCash))));
      this.offLines.appendChild(cashRow);
    }
    for (const line of report.lines) {
      const row = el('div', 'off-line');
      row.appendChild(el('span', 'g', line.glyph));
      row.appendChild(el('span', undefined, line.text));
      this.offLines.appendChild(row);
    }
    const totalMoney = report.earned ?? 0;
    this.offIsMoney = totalMoney > 0;
    this.offTarget = Math.max(0, this.offIsMoney ? totalMoney : report.stocked);
    this.offUnit.textContent = this.offIsMoney
      ? tr("toplam dönüş değeri · {0} ürün rafta hazır", report.stocked)
      : tr("ürün rafta — dokun ve servis et");
    this.offShown = 0;
    this.offLastInt = -1;
    this.offCount.textContent = this.offIsMoney ? '₺0' : '0';
    // v5.1 — dönüş satışı butonu her açılışta rapora göre kurulur.
    const mult = report.rewardMultiplier ?? 2;
    this.offAdBtn.textContent = tr("📺 İZLE — Stoğu ×{0} Değerinde Sat", mult);
    this.offAdBtn.style.display = report.comebackReady ? '' : 'none';
    this.offAdBtn.disabled = false;
    this.offOpen = true;
    this.mw.classList.add('open');
    this.offlineModal.scrollTop = 0;
    this.offlineFocus.open();
    this.hud.root.inert = true;
    this.tut.root.inert = true;
    // Dönüş ekranı da bir paneldir: toast onun da üstüne düşmesin.
    this.root.classList.add('panel-on');
    sfx('ui_open');
  }

  /**
   * Pencereyi kapatır. "Topla" DEĞİL — toplanacak bir şey yok, ürünler
   * zaten makinelerin deposunda duruyor. Bu yüzden para sesi de çalmaz.
   */
  private closeOffline(): void {
    if (!this.offOpen) return;
    sfx('ui_close');
    this.offOpen = false;
    this.mw.classList.remove('open');
    // Panel de açık DEĞİLSE toast yığını normal yerine dönsün.
    if (!this.panels.isOpen()) this.root.classList.remove('panel-on');
    this.hud.root.inert = this.panels.isOpen();
    this.tut.root.inert = this.panels.isOpen();
    this.offlineFocus.close();
  }

  showAdChip(kind: UiAdKind, glyph: string, title: string, text: string): void {
    if (this.panels.isOpen() || this.offOpen || this.celOn || this.tutorialVisible) return;
    this.hud.showAdChip(kind, glyph, title, text);
  }

  hideAdChip(): void {
    this.hud.hideAdChip();
  }

  setAdChipProgress(t01: number): void {
    this.hud.setAdChipProgress(t01);
  }

  get adChipOpen(): boolean {
    return this.hud.adChipOpen;
  }

  showEvent(banner: UiEventBanner): void {
    this.hud.showEvent(banner);
  }

  hideEvent(id: string): void {
    this.hud.hideEvent(id);
  }

  toast(text: string, glyph?: string, tone: ToastTone = 'good'): void {
    if (this.tutorialVisible) return;
    this.toasts.push(text, glyph, tone);
  }

  floatText(screenX: number, screenY: number, text: string, tone: FloatTone = 'money'): void {
    this.floats.spawn(screenX, screenY, text, tone);
  }

  flyCoins(screenX: number, screenY: number, count: number): void {
    this.coins.spawn(screenX, screenY, count);
  }

  setTutorial(step: UiTutorialStep | null): void {
    this.tutorialVisible = step !== null;
    this.tut.setStep(step);
    this.root.classList.toggle('tut-on', step !== null);
  }

  isPanelOpen(): boolean {
    return this.panels.isOpen() || this.offOpen;
  }

  openPanel(id: UiPanelId): void {
    if (this.offOpen) return;
    this.endCelebrate();
    this.panels.open(id);
  }

  closePanels(): void {
    this.panels.close();
    this.closeOffline();
  }

  /** Android donanım geri tuşu ve Escape için LIFO geri yöneticisi. */
  handleBack(): boolean {
    // 1. Kutlama / konfeti katmanı
    if (this.celOn) {
      this.endCelebrate();
      return true;
    }
    // 2. Çevrimdışı kazanç modalı
    if (this.offOpen) {
      this.closeOffline();
      return true;
    }
    // 3. Paneller ve alt panel geçmişi
    if (this.panels.isOpen()) {
      return this.panels.handleBack();
    }
    // 4. Genişletilmiş yan işler çekmecesi
    if (this.hud.isSideJobsExpanded()) {
      this.hud.collapseSideJobs();
      return true;
    }
    return false;
  }

  private togglePanel(id: UiPanelId): void {
    if (this.offOpen) return;
    if (this.panels.currentId() === id) this.panels.close();
    else this.panels.open(id);
  }

  hideBoot(): void {
    const boot = this.boot;
    if (!boot || boot.classList.contains('boot-hide')) return;
    boot.classList.add('boot-hide');
    this.bootTimer = window.setTimeout(() => {
      this.bootTimer = 0;
      if (boot.parentNode) boot.parentNode.removeChild(boot);
    }, 520);
  }

  celebrate(title: string, subtitle: string, glyph: string): void {
    if (this.panels.isOpen() || this.offOpen) { this.toast(title + ' · ' + subtitle, glyph, 'good'); return; }
    this.hud.hideAdChip();
    setIconText(this.celGlyph, glyph);
    this.celTitle.textContent = title;
    this.celSub.textContent = subtitle;
    for (let i = 0; i < this.confetti.length; i++) {
      const c = this.confetti[i];
      const spread = (i / this.confetti.length) * 2 - 1;
      c.style.setProperty('--cx', (spread * 46 + (Math.random() * 14 - 7)).toFixed(1) + 'vw');
      c.style.setProperty('--cd', (Math.random() * 0.5).toFixed(2) + 's');
      c.style.setProperty('--cr', (Math.random() * 900 - 450).toFixed(0) + 'deg');
      retrigger(c, 'fly-a', 'fly-b');
    }
    this.celT = CELEBRATE_LIFE;
    this.celOn = true;
    this.cel.classList.add('on');
    // 'celebrate' diye bir ses kimliği YOK — `sfx()` düz string aldığı için
    // tip kontrolünden geçiyor ama AudioManager onu bulamıyordu: oyunun en
    // büyük kutlama anı tamamen sessizdi.
    sfx('levelup');
  }

  private endCelebrate(): void {
    if (!this.celOn) return;
    this.celOn = false;
    this.celT = 0;
    this.cel.classList.remove('on');
    bus.emit('celebrate:end', {});
  }

  /** Az hareket ayarını köke yansıtır. */
  private applySettings(): void {
    let reduced = false;
    try {
      reduced = this.api.getSettings().reducedMotion;
    } catch {
      return; // çekirdek henüz hazır değilse sessizce geç
    }
    if (reduced === this.lastReduced) return;
    this.lastReduced = reduced;
    this.root.classList.toggle('reduced-motion', reduced);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    for (const off of this.offs) off();
    this.offs.length = 0;
    if (this.bootTimer !== 0) window.clearTimeout(this.bootTimer);
    this.offlineFocus.dispose();
    this.hud.dispose();
    this.panels.dispose();
    this.coins.dispose();
    this.toasts.dispose();
    this.floats.dispose();
    this.tut.dispose();
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.host.classList.remove('ui-host');
  }
}

/** Oyun çekirdeği yalnızca bunu çağırır. */
export function createUI(api: UIApi, host: HTMLElement): UIRoot {
  return new UIRootImpl(api, host);
}
