import type { SideActivityId } from '../data/sideActivities';
import { tr } from "./I18n";
import { boundedCameraLead } from '../world/CameraFraming';
import { PLAYER_STAFF_WORK, STAFF_JOIN_BENEFIT } from '../data/staff';
import { VisibilityGate } from './VisibilityGate';
import { debounce } from './debounce';
import { chooseUpgradePressure } from '../ui/UpgradeAdvice';
import type { UiUpgradeAdvice, UiCollection } from '../ui/api';
import { Scene3D, type ScreenPoint } from '../world/Scene3D';
import { markDynamic } from '../world/layers';
import { createVFX, type VFXSystem } from '../world/VFX';
import { InputManager } from '../input/InputManager';
import { createAudio, type AudioManager, type SfxId } from '../audio/AudioManager';
import { createUI } from '../ui/UIRoot';
import { GameplayTelemetry } from './Telemetry';
import { formatDecimal, getLanguage, setLanguage, LANGUAGE_KEY, type Language } from './I18n';
import { mirrorStorage,flushStorage,onNativeThermalStatus } from './Native';
import { setNativeThermalStatus } from './Quality';
import type {
  UIApi,
  UIRoot,
  UiAdRewardKind,
  UiAdOffers,
  UiGoal,
  UiHudState,
  UiLocationRow,
  UiOfflineReport,
  UiSettings,
  UiSettingFlag,
  UiStaffRow,
  UiStationRow,
  UiUpgradeRow,
  UiDaily,
  UiPrestige,
  UiCosmeticAxis,
  UiFpsPreference,
  } from '../ui/api';
import { GameState } from '../sim/GameState';
import { World, type EventModifiers, type WorldSave } from '../sim/World';
import { GoalTracker, goalWorkSeconds } from '../sim/Goals';
import { EventManager, type ChaosEventId } from '../sim/Events';
import { Tutorial } from '../sim/Tutorial';
import { applyOfflineStock, computeOfflineEarnings } from '../sim/Offline';
import { Player } from '../entities/Player';
import { SaveManager } from './SaveManager';
import { clearCrashDiagnostics } from './CrashReporter';
import { haptic, isAppExiting, isNative, onAppStateChange, onBackButton, requestNotificationPermission, scheduleReminders } from './Native';
import {
  dailyReward,
  missionProgress,
  missionReward,
  missionsFor,
  rollDay,
  rollWeek,
  weekDaysLeft,
  weeklyProgress,
  weeklyReward,
  weeklyTarget,
} from '../sim/Daily';
import {
  currentFestival,
  festivalCleanMult,
  festivalGoalTitle,
  festivalGoalDefinition,
  festivalProgress,
  festivalReward,
  festivalTarget,
  festivalValueMult,
  rollFestival,
} from '../sim/Festival';
import { couponPrice, type UiAlbumRow, type UiFestival, type UiWeekly } from '../ui/api';
import {
  PRESTIGE_MAP,
  PRESTIGE_MIN_EARNED,
  PRESTIGE_UPGRADES,
  prestigePointsFor,
  prestigeUpgradeCost,
} from '../data/prestige';
import { Settings } from './Settings';
import {
  CASH_BOOST_FLOOR,
  CASH_BOOST_INCOME_SECONDS,
  CASH_BOOST_MAX_PAID,
  CASH_BOOST_MIN_PAID,
  COMEBACK_MIN_STOCK,
  COMEBACK_SHARE,
  DAILY_DOUBLE_MULT,
  FREE_UPGRADE_COOLDOWN_SEC,
  HAPPY_HOUR_MULT,
  HAPPY_HOUR_SECONDS,
  HAPPY_HOUR_STEP_SECONDS,
  HAPPY_HOUR_MAX_SECONDS,
  REPAIR_SHIELD_SECONDS,
  ROBOT_SECONDS,
  RUSH_HOUR_MIN_SHELF,
  RUSH_HOUR_PATIENCE_MULT,
  RUSH_HOUR_SECONDS,
  RUSH_HOUR_SPAWN_MULT,
  TIP_RAIN_MULT,
  TIP_RAIN_SECONDS,
  USTA_MIN_QUEUE,
  USTA_SECONDS,
  USTA_SPEED_MULT,
  ZONE_FINISH_MIN_PAID,
  adReady,
  showRewarded,
  tryInterstitial,
  canShowInterstitial,
  INTERSTITIAL_GOAL_WARMUP,
  type InterstitialSafetyContext,
} from './Ads';
export { ZONE_FINISH_MIN_PAID };
import { TUTORIAL_STEP_COUNT } from '../sim/Tutorial';
import { RobotVacuum } from '../sim/RobotVacuum';
import { bus } from './EventBus';
import { CUSTOMER_ANGER_COPY } from '../data/customerFeedback';
import { applyTier, QUALITY, detectTier, evaluateHeat, onHeatChange, setAutoQuality, type QualityTier } from './Quality';
import { installPerfHud } from './PerfHud';
import { detectRefreshHz, frameFps, isMobileDevice, pacedFps } from './framePolicy';
import { FramePacer, FrameRateMeter, RefreshRateEstimator } from './FrameClock';
import { attachCpuPressure } from './thermal';
import { cameraMoveEpsilon, cameraMovedEnough } from '../world/staticBake';
import { BALANCE } from '../data/balance';
import { ITEMS, itemName, type ItemId } from '../data/items';
import { LOCATION_ORDER, locationDef, zoneDef } from '../data/layouts';
import { GOALS } from '../data/goals';
import { PLAYER_UPGRADES, PLAYER_UPGRADE_MAP, type PlayerUpgradeId, STATION_CAP_MAX, STATION_SPEED_MAX } from '../data/upgrades';
import {
  STAFF_ROLES,
  baristaBoost,
  busserCapacity,
  busserWorkTime,
  cashierOrderTime,
  waiterCapacity,
  waiterShelfTarget,
  waiterSpeed,
  type StaffRole,
} from '../data/staff';
import { clamp, formatMoney, formatDuration, formatCompactMoney } from './MathUtils';
import { Customer, disposeCustomerIcons } from '../entities/Customer';
import { COSMETIC_AXES, COSMETIC_AXIS_DEFS, cosmeticOptions, type CosmeticAxis } from '../data/cosmetics';

const _screen: ScreenPoint = { x: 0, y: 0, behind: false };

/** Arayüzden gelen ham metni bilinen eksenlere daraltır (beyaz liste). */
function asAxis(v: string): CosmeticAxis | null {
  return (COSMETIC_AXES as readonly string[]).includes(v) ? (v as CosmeticAxis) : null;
}

function cssHex(c: number): string {
  return '#' + (c & 0xffffff).toString(16).padStart(6, '0');
}

export class Game implements UIApi {
  private cosmeticPreview: Partial<Record<CosmeticAxis, string>> = {};
  private scene3d: Scene3D;
  private vfx: VFXSystem;
  private input: InputManager;
  private audio: AudioManager;
  private ui: UIRoot;
  private save = new SaveManager();
  private settings = new Settings();

  private state = new GameState();
  private telemetry!: GameplayTelemetry;
  private worlds = new Map<string, World>();
  private world!: World;
  private player: Player;
  private goals: GoalTracker;
  private events: EventManager;
  private tutorial: Tutorial;

  private raf = 0;
  private lastTime = 0;
  private paused = false;
  /** Uygulamanın arka plana alındığı an (ms); 0 = ön planda. */
  private appHidden = false;
  private autosaveTimer = 0;
  private incomeTimer = 0;
  private purchaseObservationTime = 0;
  private cachedIncome = 0;
  /** Süzülmüş kamera öne-bakışı (bkz. balance.lookAheadTau). */
  private lookX = 0;
  private lookZ = 0;
  private readonly cameraLead = { x: 0, z: 0 };
  private persistDisabled = false;
  public adVisualTick: ((rawDt: number) => void) | null = null;
  public adSimPaused = false;
  private unsubs: (() => void)[] = [];
  private running = false;

  constructor(canvas: HTMLCanvasElement, uiHost: HTMLElement) {
    this.persistDisabled = new URLSearchParams(window.location.search).get('ad') === '1';
    // Kademe renderer'dan ÖNCE belirlenmeli: `antialias` yalnızca WebGL
    // bağlamı kurulurken seçilebilir, sonradan değiştirilemez.
    const bootTier: QualityTier = this.settings.get('lowQuality') ? 'low'
      : this.settings.get('qualityAuto') ? detectTier() : this.settings.get('quality');
    this.scene3d = new Scene3D(
      canvas,
      bootTier,
      this.mobileDevice,
    );
    this.vfx = createVFX();
    markDynamic(this.vfx.root);
    this.scene3d.scene.add(this.vfx.root);

    this.audio = createAudio();
    this.input = new InputManager(canvas);
    this.ui = createUI(this, uiHost);

    this.player = new Player();
    this.goals = new GoalTracker(this.state);
    this.events = new EventManager(this.state);
    this.tutorial = new Tutorial(this.state);

    this.loadGame();
    this.tutorial.resume(this.world);
    this.bindEvents();
    this.applySettings();
    if (!this.persistDisabled) this.checkDaily();
    this.telemetry = new GameplayTelemetry(() => ({location: this.state.activeLocation, step:this.tutorial.step, play_seconds:this.state.playTime, served:this.state.stats.served, orders:this.state.stats.orders, fps:this.measuredFps, quality:QUALITY.tier,language:getLanguage()}));
    const testQuery = new URLSearchParams(window.location.search);
    const participant = testQuery.get('playtest');
    if (participant === 'human' || participant === 'bot' || participant === 'unknown') {
      this.telemetry.setTestContext({ participant,
        condition: testQuery.get('condition') ?? 'clear-unlocks-v1',
        label: testQuery.get('participant') ?? undefined });
    } else if (testQuery.has('testRun')) {
      this.telemetry.setTestContext({ participant: 'bot', condition: 'clear-unlocks-v1',
        label: testQuery.get('testRun') ?? undefined });
    }


    /**
     * ISI MERDİVENİ DEĞİŞİNCE renderer ayarları yeniden uygulanır.
     * Bilerek `rebuildStaffCharacters` YOK: cihaz tam zorlanırken tüm
     * rig'leri söküp yeniden kurmak, kısmanın amacını baltalayan bir
     * yük patlamasıydı (keşif raporu bunu ayrıca işaretledi). charLod
     * yeni doğan karakterlere uygulanır, mevcutlar doğal döngüde yenilenir.
     */
    this.unsubs.push(onHeatChange(() => {
      this.scene3d.applyQuality(QUALITY);
      for (const w of this.worlds.values()) w.refreshCapacity();
      this.applyGradeClass();
    }));

    // `?perf=1` — geliştirici perf yazısı (cihazda da çalışır).
    if (new URLSearchParams(window.location.search).has('perf')) {
      installPerfHud(() => ({
        fps: this.measuredFps,
        calls: this.scene3d.renderer.info.render.calls,
        tris: this.scene3d.renderer.info.render.triangles,
        tier: QUALITY.tier,
        heat: QUALITY.heatLevel,
      }));
    }

    const unlockGestures = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'] as const;
    const unlockHandler = () => {
      this.audio.unlock();
      this.audio.setMuted(this.settings.get('muted'));
      this.audio.setMusicEnabled(this.settings.get('music') && !this.settings.get('muted'));
      for (const ev of unlockGestures) {
        window.removeEventListener(ev, unlockHandler, true);
      }
    };
    for (const ev of unlockGestures) {
      window.addEventListener(ev, unlockHandler, { capture: true, passive: true });
    }
    this.unsubs.push(() => {
      for (const ev of unlockGestures) {
        window.removeEventListener(ev, unlockHandler, true);
      }
    });

    this.input.onFirstInteraction = unlockHandler;

    this.unsubs.push(attachCpuPressure((hot) => {
      this.pressureHot = hot;
    }));
    this.unsubs.push(onNativeThermalStatus(setNativeThermalStatus));
  }

  /* ================================================================
   *  Kurulum
   * ================================================================ */

  private loadGame(): void {
    const data = this.persistDisabled ? null : this.save.read();
    this.returningPlayer = data !== null;
    if (data) this.state.load(data.state);

    for (const id of LOCATION_ORDER) {
      if (!this.state.isLocationUnlocked(id)) continue;
      this.createWorld(id, data?.worlds?.[id]);
    }
    if (!this.worlds.has('kose')) this.createWorld('kose', undefined);

    const active = this.worlds.get(this.state.activeLocation) ?? this.worlds.get('kose')!;
    this.state.activeLocation = active.loc.id;
    this.world = active;

    markDynamic(this.player.char.root);
    this.scene3d.scene.add(this.player.char.root);
    this.player.setPosition(this.world.loc.playerStart.x, this.world.loc.playerStart.z);
    this.applyPlayerStats();
    this.activateWorld(this.world, false);

    for (const w of this.worlds.values()) {
      w.syncStaff();
      w.refreshAutomation();
    }

    // v5.1 — satın alınmış reklam ödülleri kayıttan geri gelir; kapanan
    // uygulama ödülü buharlaştırmaz (bkz. restoreAdBuffs / state.adBuffs).
    this.restoreAdBuffs();

    if (data) {
      // Para YOK — yalnız makineler beklerken üretmiş olur. Popup ise
      // gerçekten bir şey biriktiyse açılır (bkz. applyOfflineAndReport).
      const elapsed = (Date.now() - data.t) / 1000;
      this.applyOfflineAndReport(elapsed);
    }
  }

  /**
   * Uzakta geçen süreyi makine depolarına işler ve dönen oyuncuya ne
   * bulduğunu anlatır.
   *
   * Rapor `applyOfflineStock`'un DÖNÜŞ DEĞERİNDEN değil, çağrının iki
   * yanında alınan stok fotoğrafının farkından üretilir: `sim/` katmanı bu
   * kolun sahipliğinde değil ve imzasını değiştirmek için bir sebep de yok
   * — fark almak aynı bilgiyi tek fazladan döngüyle veriyor.
   *
   * Modal iki durumda AÇILMAZ:
   *   • kısa yokluk (BALANCE.offline.minSeconds altı) — zaten hiçbir şey
   *     birikmez, üstelik her sekme değişiminde pencere açılması işkence
   *     olurdu;
   *   • hiçbir şey birikmediyse (depolar zaten doluydu) — söyleyecek bir
   *     haber yokken kutlama penceresi açmak oyuncuyu boşuna durdurur.
   */
  private applyOfflineAndReport(seconds: number): void {
    if (!(seconds >= BALANCE.offline.minSeconds)) return;
    const worlds = [...this.worlds.values()];

    /* Önce fotoğraf: her makinenin mevcut stoğu. */
    const before = new Map<string, number>();
    for (const w of worlds) for (const m of w.machines) before.set(w.loc.id + '/' + m.id, m.output);

    applyOfflineStock(seconds, worlds, this.state.prestigeOfflineMult);

    /* Sonra fark: ürün başına kaç adet eklendi. */
    const perItem = new Map<ItemId, number>();
    let stocked = 0;
    let machines = 0;
    let stockValue = 0;
    for (const w of worlds) {
      for (const m of w.machines) {
        const add = m.output - (before.get(w.loc.id + '/' + m.id) ?? 0);
        if (add <= 0) continue;
        stocked += add;
        machines++;
        const item = m.def.item;
        if (item) {
          perItem.set(item, (perItem.get(item) ?? 0) + add);
          stockValue += Math.round(add * ITEMS[item].price * this.state.saleMultiplier);
        }
      }
    }

    const hasStaff = worlds.some((w) => {
      const sc = this.state.staffCountAt(w.loc.id);
      return sc.waiter > 0 || sc.cashier > 0;
    });
    const offlineCash = computeOfflineEarnings(
      seconds,
      this.rewardIncomePerSec(),
      hasStaff,
      this.state.prestigeOfflineMult,
    );
    this.lastOfflineCash = offlineCash;
    if (offlineCash > 0) {
      this.state.earn(offlineCash);
    }

    if (stocked <= 0 && offlineCash <= 0) return;
    // Öğretici sürerken pencere açılmaz: ilk dakikadaki akışı bölmek,
    // oyuncuya anlamadığı bir raporu okutmaktan daha pahalı.
    if (!this.tutorial.finished) return;

    /* En çok üretilen ürün üstte — rapor tek bakışta okunmalı. */
    const lines = [...perItem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([item, n]) => ({ glyph: ITEMS[item].glyph, text: `${n} · ${ITEMS[item].name}` }));
    if (offlineCash > 0) {
      lines.unshift({
        glyph: '🌙',
        text: tr('Personel gece vardiyası: +₺{0}', formatMoney(offlineCash)),
      });
    }

    this.lastOfflineSeconds = seconds;
    const rewardMultiplier = seconds >= BALANCE.offline.longOfflineThresholdSeconds
      ? BALANCE.offline.rewardedLongOfflineMultiplier
      : BALANCE.offline.rewardedMultiplier;

    const report: UiOfflineReport = {
      seconds,
      stocked,
      machines,
      lines,
      earned: stockValue + offlineCash,
      offlineCash,
      stockValue,
      /**
       * v5.1 dönüş satışı: buton yalnız reklam envanteri GERÇEKTEN doluyken
       * ve ortada satılacak stok veya vardiya kazancı varken görünür (aktif
       * şube — satışı da `watchAd('comeback_sale')` aynı şubeden yapar).
       */
      comebackReady: adReady('comeback_sale') && (this.world.stockTotal() >= COMEBACK_MIN_STOCK || offlineCash > 0),
      rewardMultiplier,
      nextGoal: GOALS[this.state.goalIndex]?.title ?? tr('Kafeyi büyütmeye devam et.'),
    };
    this.ui.showOffline(report);
  }

  private createWorld(id: string, saved: WorldSave | undefined): World {
    const w = new World(id, this.state, this.vfx);
    w.load(saved);
    this.scene3d.scene.add(w.root);
    this.worlds.set(id, w);
    // Boot warms through prepareForPlay; a branch opened or rebuilt in play
    // gets the same idle preparation for its locked rooms.
    if (this.running) this.scene3d.warmHiddenContent(500);
    return w;
  }

  private activateWorld(w: World, animate: boolean): void {
    for (const other of this.worlds.values()) {
      if (other !== w) other.setActive(false);
    }
    w.setActive(true);
    this.world = w;
    this.state.activeLocation = w.loc.id;
    this.state.useStaffLocation(w.loc.id);
    this.scene3d.applyPalette(w.loc.palette);
    w.syncStaff();
    this.player.setPosition(w.loc.playerStart.x, w.loc.playerStart.z);
    this.player.dropAll();
    /**
     * SÜPÜRGE ŞUBEDE KALIR. `dropAll` yalnız taşıma yığınını boşaltıyordu;
     * `hasVacuum` ve mesh el değmeden duruyordu. Sonuç: prestij sonrası hem
     * elde hem dolapta süpürge görünüyor, ayrıca süpürge dolabı OLMAYAN
     * sahil şubesine bonuslarıyla taşınabiliyordu.
     */
    this.player.hasVacuum = false;
    this.player.setVacuumMesh(null);
    for (const st of w.vacuums) if (!st.locked) st.output = 1;
    if (!animate) this.scene3d.snapTo(this.player.x, this.player.z);
    else this.scene3d.setFocus(this.player.x, this.player.z);
    this.scene3d.snapTo(this.player.x, this.player.z);
    // Gölge kamerasını bu şubenin ortasına oturt ve haritayı bir kez çiz.
    const b = w.loc.bounds;
    this.scene3d.setVenueCenter((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    this.events.reset();
    bus.emit('location:changed', { location: w.loc.id });
    bus.emit('ui:refresh', {});
  }

  private applyPlayerStats(): void {
    // Usta modu (v5.1 reklam ödülü) hız çarpanını hızın yazıldığı TEK
    // satırda bindirir; buff başlarken/biterken bu fonksiyon yeniden çağrılır.
    this.player.speed = this.state.playerSpeed * (this.ustaLeft > 0 ? USTA_SPEED_MULT : 1);
    this.player.setCapacity(this.state.playerCapacity);
    this.player.setCarrierLevel(this.state.upgrades.capacity);
    // Usta modu geçici sprinttir; düşük seviye yürüyüş pozu yüksek hızda
    // kaymasın diye animasyon da buff süresince koşu kademesine çıkar.
    this.player.setLocomotionLevel(this.state.upgrades.speed + (this.ustaLeft > 0 ? 6 : 0));
    this.player.setUpgradeMilestones(
      this.state.upgrades.speed,
      this.state.upgrades.hands,
      this.state.upgrades.charm,
    );
  }

  /**
   * Kalite kademesini uygular. Karakter LOD'u kurulum anında okunduğu için
   * kademe değişince mevcut karakterlerin yeniden kurulması gerekir:
   * personel `syncStaff` ile, müşteriler doğal döngüde yenilenir.
   */
  private applyQualityTier(tier: QualityTier, auto = false): void {
    const previousCharacterLod = QUALITY.charLod;
    /**
     * `force` — DÜZELTME: applyTier aynı kademede erken dönünce renderer
     * ayarları HİÇ uygulanmıyordu; `high` kayıtlı oyuncu dprCap 1,5'te
     * kalıyordu (yani en yüksek kademe, ortadan DÜŞÜK çözünürlükte).
     * Manuel çağrılar artık zorlar; yalnız otomatik ısı geçişleri
     * değişiklik yoksa sessizce döner.
     */
    if (!applyTier(tier, !auto)) return;
    this.scene3d.applyQuality(QUALITY);
    for (const w of this.worlds.values()) {
      // Kademe yalnızca TAVAN koyar; asıl kapasite mekândan gelir.
      w.refreshCapacity();
      if (QUALITY.charLod !== previousCharacterLod) w.rebuildStaffCharacters();
    }
    this.applyGradeClass();
    /**
     * OTOMATİK düşüşte toast yok. Cihaz tam zorlanırken hem karakterleri
     * yeniden kurup hem "Grafik: Düşük" bandı basmak, takılmanın üstüne
     * bir de "oyun telefonumda bozuk" izlenimi bindiriyordu. Sessiz uyum
     * bu türün normudur; bildirim yalnızca oyuncunun kendi seçiminde.
     */
    if (!auto && this.running) this.ui.toast(tr("Grafik: {0}", TIER_LABEL[tier]), '⚙️', 'info');
  }

  /**
   * Tam ekran vinyet/renk bindirmesi (soft-light) düşük kademede kapatılır.
   * CSS'te kapatma kancası (`#app.low-fx`) baştan beri vardı ama hiçbir
   * kod sınıfı yazmıyordu — bindirme en zayıf cihazda bile her kare tam
   * ekran karışım maliyeti ödetiyordu.
   */
  private applyGradeClass(): void {
    const app = document.getElementById('app');
    if (app) app.classList.toggle('low-fx', this.settings.get('lowQuality'));
  }

  /** Ayarlar panelindeki 4'lü Grafik seçicisi (ui/api.ts opsiyonel kancaları). */
  getQualityTier(): 'auto' | 'high' | 'medium' | 'low' {
    return this.settings.get('qualityAuto') ? 'auto' : this.settings.get('quality');
  }

  setQualityTier(t: 'auto' | 'high' | 'medium' | 'low'): void {
    if (t === 'auto') {
      this.settings.set('qualityAuto', true);
      // set() dinleyicisi applySettings'i çağırır; taban kademe saptamadan.
      return;
    }
    this.settings.set('quality', t);
    this.settings.set('qualityAuto', false);
  }

  private applySettings(changedKey?: keyof import('./Settings').SettingsData): void {
    const s = this.settings.all;
    if (!changedKey || changedKey === 'quality' || changedKey === 'qualityAuto' || changedKey === 'lowQuality') {
      setAutoQuality(s.qualityAuto);
      // "Düşük Kalite" anahtarı en alt kademeye zorlar; kapalıyken saptanan
      // kademeye dönülür. Otomatik modda taban kademe cihaz saptamasından.
      this.applyQualityTier(s.lowQuality ? 'low' : s.qualityAuto ? detectTier() : s.quality);
      this.applyGradeClass();
      this.scene3d.setLowQuality(s.lowQuality);
    }
    this.scene3d.setReducedMotion(s.reducedMotion);
    this.audio.setMuted(s.muted);
    this.audio.setMusicEnabled(s.music && !s.muted);
    this.audio.setSfxVolume(s.sfxVolume);
    this.audio.setMusicVolume(s.musicVolume);
    // Kalabalık sınırı YALNIZCA kalite kademesinden gelir (applyQualityTier).
    // Burada ayrıca yazılıyordu ve kademenin değerini eziyordu: "düşük"
    // kademede 9 olması gereken sınır 16'ya çıkıyor, yani mobilin en
    // güçlü performans kolu hiç çalışmıyordu. Karakter başına ~41 mesh
    // düştüğü için bu tek satır ~290 çizim çağrısı demekti.
  }

  /* ================================================================
   *  Olay bağlantıları
   * ================================================================ */

  private bindEvents(): void {
    this.unsubs.push(
      bus.on('render:structure', () => {
        this.scene3d.invalidateStaticCache();
        this.forceRender = true;
      }),
      // NOT: burada ayrıca bir `bus.on('sfx')` aboneliği VARDI. AudioManager
      // kendi kurucusunda zaten aynı olaya abone oluyor, yani her ses iki kez
      // çalınıyordu; yalnızca ses motorunun kimlik başına hız sınırlayıcısı
      // bunu maskeliyordu. Tek abonelik AudioManager'da kalır.

      bus.on('side:changed', ({structural,immediate}) => {
        if (structural) {this.scene3d.invalidateStatic();this.scene3d.invalidateShadows();this.forceRender=true;}
        if (immediate) this.persist();
        else this.autosaveTimer=Math.max(this.autosaveTimer,BALANCE.world.autosaveInterval-0.5);
        bus.emit('ui:refresh',{});
      }),
      bus.on('found:change', () => this.persist()),
      bus.on('money:earn', ({ amount, x, z, y }) => {
        this.scene3d.project(x, y ?? 1.4, z, _screen);
        if (_screen.behind) return;
        this.ui.floatText(_screen.x, _screen.y, `+₺${formatMoney(amount)}`, 'money');
        /**
         * Jeton sayısı miktarla ölçeklenir ama 6'da durur: küçük bozuk
         * paralar tek jeton, büyük tahsilatlar bir avuç. Kazancın
         * BÜYÜKLÜĞÜ böylece sayıyı okumadan da hissedilir.
         */
        const n = amount < 60 ? 1 : amount < 400 ? 2 : amount < 2000 ? 3 : amount < 20000 ? 4 : 6;
        this.ui.flyCoins(_screen.x, _screen.y, n);
      }),
      bus.on('table:cleaned', ({ x, z, byPlayer }) => {
        if (byPlayer && x !== undefined && z !== undefined) {
          this.scene3d.project(x, 1.5, z, _screen);
          if (!_screen.behind) {
            this.ui.floatText(_screen.x, _screen.y - 34, tr("TERTEMİZ! ✨"), 'good');
          }
        }
      }),

      /* --- Kodda tanımlı olup hiç çalınmayan sesler --------------------
         'produce', 'sell', 'customer_happy' ve 'customer_angry' ses
         kimlikleri AudioManager'da sentezlenmiş hâlde duruyordu ama hiçbir
         yerden tetiklenmiyordu: makineler sessizce üretiyor, servis sessizce
         tamamlanıyor, müşteri sessizce seviniyor ve sessizce küsüyordu. */

      /**
       * Titreşim. `sim/` katmanı Capacitor'ü çağıramaz (web/native ayrımı
       * `core/Native.ts`'te toplanır), istek olay yoluyla gelir — `sfx` ile
       * aynı kalıp. Altyapı yazılıydı ama oyunda hiçbir yerden çağrılmıyordu.
       */
      bus.on('haptic', ({ kind }) => {
        // Titreşim artık KENDİ ayarına bağlı. Eskiden "sessiz" anahtarına
        // bağlıydı: sesi kapatan oyuncu titreşimi de kaybediyordu, oysa
        // ikisi farklı ihtiyaç (toplu taşımada ses kapalı + titreşim açık).
        if (this.settings.get('haptics')) haptic(kind);
      }),

      bus.on('item:produced', () => this.audio.play('produce', { vol: 0.32 })),
      bus.on('item:served', () => this.audio.play('sell', { vol: 0.75 })),
      bus.on('sale:done', ({ item, amount, x, z }) => {
        const count = this.state.stats.sale[item] ?? 0;
        const stars = count >= 150 ? 3 : count >= 50 ? 2 : count >= 10 ? 1 : 0;
        if (stars > 0 && amount > 0) {
          const masteryBonus = Math.max(1, Math.round(amount * (stars * 0.05)));
          this.state.earn(masteryBonus);
        }
        if (count === 10 || count === 50 || count === 150) {
          this.ui.toast('⭐ ' + tr('{0} Ustalığı ({1}/3): +{2}% değer!', itemName(item), stars, stars * 5), '⭐', 'good');
          this.audio.play('milestone' as SfxId);
          this.audio.play('goal');
          this.state.grant(Math.round(stars * 150 * this.state.saleMultiplier), x, z, 1.5);
          this.vfx.sparkle(x, 1.4, z, 0xffc84a);
          bus.emit('ui:refresh', {});
        }
      }),
      bus.on('customer:happy', () => this.audio.play('customer_happy', { vol: 0.5 })),
      bus.on('customer:angry', ({ x, z, reason }) => {
        const copy = CUSTOMER_ANGER_COPY[reason];
        this.audio.play('customer_angry', { vol: 0.55 });
        this.floatWorld(x, 1.8, z, copy.message, 'bad');
        this.ui.toast(copy.action, '!', 'bad');
      }),
      bus.on('customer:impatient', ({ x, z, text }) => {
        this.floatWorld(x, 2.05, z, text, 'bad');
        this.audio.play('customer_angry', { vol: 0.22, rate: 1.25 });
      }),

      bus.on('goal:complete', ({ title, reward }) => {
        this.ui.toast(`${title} ✓  +₺${formatMoney(reward)}`, '🎯', 'good');
        this.audio.play('goal');
        this.player.celebrate();
        this.vfx.ring(this.player.x, 0.2, this.player.z, 0xffc84a, 3.2);
        this.scene3d.project(this.player.x, 1.6, this.player.z, _screen);
        if (!_screen.behind) {
          this.ui.floatText(_screen.x, _screen.y, `+₺${formatMoney(reward)}`, 'money');
          const n = reward < 60 ? 1 : reward < 400 ? 2 : reward < 2000 ? 3 : reward < 20000 ? 4 : 6;
          this.ui.flyCoins(_screen.x, _screen.y, n);
        }
        bus.emit('ui:refresh', {});
        if (this.tutorial.finished && this.adChipTimer > 4) this.adChipTimer = 4;
        /* goalIndex olaydan önce artar. İlk 8 tamamlanan hedefin
         * kutlamasında geçiş yok; dokuzuncu ve sonrası doğal ara sayılır. */
        if (this.state.goalIndex > INTERSTITIAL_GOAL_WARMUP) void this.trySmartBreak();
      }),
      bus.on('tutorial:step', ({ complete }) => {
        this.world.syncLocks();
        if (complete) this.adChipTimer = Math.min(this.adChipTimer, 6);
      }),

      bus.on('zone:unlocked', ({ name, zone, location, method }) => {
        const def = zoneDef(location, zone);
        this.telemetry?.completePurchase({
          id: zone, kind: 'zone', location, cycle: this.state.prestigeCount,
          total: def.cost, ...(method === 'pad' ? { paid: def.cost } : {}),
        }, method ?? 'unknown');
        this.ui.toast(tr("{0} açıldı!", name), '✓', 'good');
        this.audio.play('unlock');
        // Mimari değişti: dondurulmuş gölge haritasını kurulum animasyonu
        // (en çok 0,12 sn gecikme + 0,32 sn) bitince bir kez yenile.
        this.scene3d.invalidateShadowsAfter(0.5);
        this.scene3d.invalidateStatic();
        this.forceRender = true;
        bus.emit('ui:refresh', {});
      }),

      bus.on('location:unlocked', ({ name }) => {
        this.ui.celebrate(tr("YENİ ŞUBE"), name, '🏖️');
        this.audio.play('levelup');
      }),

      bus.on('staff:hired', ({ role, count, location, totalCost, method }) => {
        this.telemetry?.completePurchase({
          id: role + ':' + Math.max(0, count - 1), kind: 'staff',
          location: location ?? this.state.activeLocation, cycle: this.state.prestigeCount,
          total: totalCost, paid: totalCost,
        }, method ?? 'unknown');
        const label = STAFF_ROLES.find((r) => r.id === role)?.name ?? '';
        this.ui.toast(tr("{0} ekibe katıldı!", label) + ' ' + tr(STAFF_JOIN_BENEFIT[role as StaffRole]), '👋', 'good');
        this.audio.play('hire');
        if (this.settings.get('haptics')) haptic('medium');
        this.player.celebrate();
        this.vfx.ring(this.player.x, 0.2, this.player.z, 0xffc84a, 1.6);
        this.vfx.sparkleBurst(this.player.x, 1.1, this.player.z, 10, 0xffd166);
        for (const w of this.worlds.values()) w.syncStaff();
        this.persist();
        bus.emit('ui:refresh', {});
      }),

      bus.on('upgrade:bought', ({ kind }) => {
        this.audio.play('upgrade');
        if (this.settings.get('haptics')) haptic('medium');
        this.player.celebrate();
        this.vfx.ring(this.player.x, 0.2, this.player.z, 0x4fb59a, 1.5);
        this.vfx.sparkleBurst(this.player.x, 1.1, this.player.z, 8, 0xffd166);
        if (kind === 'player') this.applyPlayerStats();
        if (kind === 'staff') for (const w of this.worlds.values()) w.syncStaff();
        this.persist();
        bus.emit('ui:refresh', {});
      }),

      bus.on('dasher:caught', ({ reward, x, z }) => {
        this.ui.toast(tr("Kaçak müşteri yakalandı! +₺{0}", formatMoney(reward)), '🚨', 'good');
        this.scene3d.shake(0.5);
        void x;
        void z;
      }),

      bus.on('dasher:escaped', () => {
        this.ui.toast(tr("Kaçak müşteri kaçtı… İtibar düştü."), '😤', 'bad');
      }),

      bus.on('influencer:served', () => {
        this.ui.celebrate(tr("FENOMEN MEMNUN"), tr("Kafe sosyal medyada patladı!"), '⭐');
        this.audio.play('levelup');
      }),

      bus.on('celebrate:end', () => {
        void this.trySmartBreak();
      }),

      bus.on('ad:revenue', ({ value, currency, precision, adUnit, format }) => {
        this.telemetry.record('ad_revenue', {
          value,
          currency,
          precision,
          adUnit,
          format,
        });
      }),

      bus.on('pad:ad_offer', ({ zoneId, tier, remaining }) => {
        const zone = this.world.loc.zones.find(z => z.id === zoneId);
        if (!zone) return;
        this.ui.showAdChip(
          'zone_finish',
          '📺',
          tier === 'finish' ? tr("Bölümü Reklamla Tamamla") : tr("Bölümün %50'sini Öde"),
          tier === 'finish'
            ? tr("Tek reklamla kalan ₺{0} kapansın!", formatCompactMoney(remaining))
            : tr("Tek reklamla ₺{0} ödensin!", formatCompactMoney(zone.cost * 0.5)),
        );
        this.ui.setAdChipProgress(1);
        this.adChipLife = 12;
        this.adChipMaxLife = 12;
      }),

      bus.on('investor:spawn', () => {
        this.ui.toast(tr("Kafene bir yatırımcı girdi!"), '💰', 'info');
        this.audio.play('clean_chime');
      }),

      bus.on('influencer:lost', () => {
        this.ui.toast(tr("Fenomen beklemekten sıkıldı… Kötü yorum yedin."), '💔', 'bad');
      }),

      bus.on('supply:empty', () => {
        this.ui.toast(tr("Tuvalette peçete bitti! Sarf deposundan taşı."), '🧻', 'bad');
      }),

      bus.on('event:start', ({ id, title, desc, duration, glyph }) => {
        this.ui.showEvent({
          id,
          title,
          desc,
          glyph,
          remaining: duration,
          duration,
          tone: this.events.info(id as ChaosEventId).tone,
        });
      }),

      bus.on('event:end', ({ id }) => this.ui.hideEvent(id)),

    );

    this.unsubs.push(
      this.settings.onChange((_s, key) => {
        this.applySettings(key);
        if (key !== 'sfxVolume' && key !== 'musicVolume') {
          bus.emit('ui:refresh', {});
        }
      }),
    );

    const onResize = debounce(() => {
      this.scene3d.resize();
      this.forceRender = true;
    }, 120);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    /**
     * Arka plana alma / geri dönme.
     *
     * ÖNEMLİ: offline kazanç eskiden yalnızca `loadGame()` içinde, yani
     * SOĞUK açılışta hesaplanıyordu. Oyuncu uygulamayı iki saat arka
     * planda bıraktığında süreç öldürülmediyse geri döndüğünde hiçbir
     * şey kazanmıyordu — idle bir oyunun tam da vaadi olan şey
     * çalışmıyordu. Artık görünürlük değişimi de sayılıyor.
     */
    const visibility = new VisibilityGate();
    const setVisibility = (source: 'dom' | 'native', hidden: boolean): void => {
      const transition = visibility.update(source, hidden, Date.now());
      if (!transition) return;
      this.appHidden = transition.hidden;
      if (transition.hidden) {
        this.persist();
        void flushStorage();
        this.refreshReminders();
        this.audio.setSuspended(true);
        this.input.setEnabled(false);
        this.stop();
        return;
      }
      if (!this.adShowing) {
        this.audio.setSuspended(false);
        this.input.setEnabled(true);
        this.start();
        this.checkDaily();
        this.applyOfflineAndReport(transition.awaySeconds);
      }
    };
    const onVisibility = () => setVisibility('dom', document.hidden);
    const detachAppState = onAppStateChange(active => setVisibility('native', !active));
    document.addEventListener('visibilitychange', onVisibility);

    const onUnload = () => {
      if (isAppExiting()) return;
      this.persist();
      void flushStorage();
      this.refreshReminders();
    };
    const onFreeze = () => setVisibility('dom', true);
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('freeze', onFreeze);

    // Android donanım/jest geri tuşu. Bağlanmazsa geri tuşu oyunu ANINDA
    // kapatır — panel kapatmak isteyen oyuncu kendini ana ekranda bulur.
    const detachBack = onBackButton(
      () => this.ui.handleBack(),
      () => {
        haptic('light');
        this.ui.toast(tr("Çıkmak için tekrar bas"), '👋', 'info');
      },
      () => this.persist(),
    );

    this.unsubs.push(() => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      onResize.cancel();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('freeze', onFreeze);
      detachBack();
      detachAppState();
    });
  }

  private floatWorld(x: number, y: number, z: number, text: string, tone: 'money' | 'item' | 'good' | 'bad'): void {
    this.scene3d.project(x, y, z, _screen);
    if (_screen.behind) return;
    this.ui.floatText(_screen.x, _screen.y, text, tone);
  }

  /* ================================================================
   *  Döngü
   * ================================================================ */

  /** Compile dormant furniture shaders while the loading screen is visible. */
  async prepareForPlay(): Promise<void> {
    for (const w of this.worlds.values()) w.flushPadCaptions();
    await this.scene3d.prepareForPlay();
    this.scene3d.warmHiddenContent();
  }

  start(): void {
    if (this.running || this.appHidden) return;
    this.running = true;
    this.lastTime = performance.now();
    this.framePacer.reset(this.lastTime);
    this.refreshEstimator.reset(this.refreshHz);
    this.fpsMeter.reset();
    this.measuredFps = 0;
    const loop = (now: number) => {
      this.raf = 0;
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.refreshHz = this.refreshEstimator.sample(now);
      /**
       * Kare tavanı ekran yenilemesine TAM adım. 45@60Hz 3:2 takılır;
       * 30 her ikinci vsync — o yüzden 30 daha akıcı durur.
       * Mobil otomatik hedef 60; sürekli yükte önce kare bütçesi azaltılır.
       */
      const uiBlocked = this.paused || this.ui.isPanelOpen();
      const fpsPreference = this.settings.get('fps');
      const cap = frameFps({
        native: isNative,
        mobile: this.mobileDevice,
        heat: QUALITY.heatLevel,
        tier: QUALITY.tier,
        uiBlocked,
        preference: fpsPreference === 'auto' ? undefined : fpsPreference,
      });
      const presented = cap > 0 ? pacedFps(this.refreshHz, cap) : 0;
      if (!this.framePacer.due(now, presented)) return;
      // A queued first RAF may predate start()'s performance.now(), especially
      // after shader warmup. Never send negative time into saveable progress.
      const raw = Math.max(0, Math.min((now - this.lastTime) / 1000, 0.1));
      this.lastTime = now;
      const workStart = performance.now();
      this.tick(raw);
      if (!this.bootHidden) {
        this.bootHidden = true;
        this.ui.hideBoot();
      }
      this.measuredFps = this.fpsMeter.sample(now, presented);
      evaluateHeat(Math.min(performance.now() - workStart, 80), this.measuredFps, presented, {
        pressureHot: this.pressureHot,
        samplingPaused: uiBlocked,
        dt: raw,
      });
    };
    this.raf = requestAnimationFrame(loop);
  }

  private mobileDevice = isMobileDevice(navigator.userAgent, window.matchMedia?.('(pointer: coarse)').matches);
  private bootHidden = false;
  private refreshHz = detectRefreshHz();
  private readonly framePacer = new FramePacer();
  private readonly refreshEstimator = new RefreshRateEstimator();
  private loopTimer: ReturnType<typeof setTimeout> | 0 = 0;
  private forceRender = true;
  private lastPanelOpen = false;
  private pressureHot = false;
  private lastCamX = Number.POSITIVE_INFINITY;
  private lastCamY = 0;
  private lastCamZ = 0;
  private readonly fpsMeter = new FrameRateMeter();
  /** Son 1 sn penceresinde ulaşılan gerçek fps. */
  private measuredFps = 0;
  /** Bildirim izni bu oturumda soruldu mu (tutorial bitince, bir kez). */
  private notifAsked = false;
  /** Bu oturum bir KAYITLA mı açıldı — bildirim izni yalnız o zaman istenir. */
  private returningPlayer = false;

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = 0;
    }
  }

  private tick(rawDt: number): void {
    if(this.scene3d.isContextLost)return;
    const uiBlocked = this.paused || this.ui.isPanelOpen();
    if (this.lastPanelOpen && !uiBlocked) {
      this.forceRender = true;
    }
    this.lastPanelOpen = uiBlocked;
    this.input.setEnabled(!uiBlocked);
    this.input.update(Math.min(rawDt, 0.05));

    if (uiBlocked) {
      this.updateUiFrame(rawDt);
      this.audio.setVacuum(0, 0);
      this.audio.update(rawDt);
      if(this.forceRender||this.scene3d.consumeForcePresent()){this.forceRender=false;this.scene3d.render();}
      return;
    } else if (!this.adSimPaused) {
      this.stepSim(Math.min(rawDt, BALANCE.world.maxDelta));
    }

    this.stepVisual(rawDt);

    const force = this.forceRender || this.scene3d.consumeForcePresent();
    this.forceRender = false;
    if (!force && this.shouldSkipRender()) return;
    this.rememberCamera();
    this.scene3d.render();
  }

  private stepSim(dt: number): void {
    this.state.playTime += dt;
    this.player.update(dt, this.input.move, this.world.nav, this.world.loc.bounds);
    this.world.setViewFromCamera(this.scene3d.camera);
    this.world.setCameraQuat(this.scene3d.camera.quaternion);
    const goalNow = this.tutorial.finished ? this.goals.current : null;
    this.world.guideGoal = goalNow;
    this.world.guideGoalCurrent = goalNow ? Math.min(this.goals.currentValue(), goalNow.target) : 0;
    this.world.nearWinWanted = !!goalNow && goalWorkSeconds(goalNow, this.world.guideGoalCurrent, this.cachedIncome) > 30;
    this.world.update(dt, this.player, this.tickMods(dt));
    this.world.tryCatchDasher(this.player);
    const investor = this.world.checkInvestorInteraction(this.player);
    if (investor) this.handleInvestorProximity(investor);
    this.purchaseObservationTime += dt;
    if (this.purchaseObservationTime >= 0.1) {
      this.telemetry?.observePurchases(this.world.purchaseObservations(this.player), this.purchaseObservationTime);
      this.purchaseObservationTime = 0;
    }
    // Eğitim sırasında rastgele olaylar ana döngünün üstüne binmez; olay
    // ısınma sayacı da eğitim bittikten sonra başlar.
    if (this.tutorial.finished) this.events.update(dt, this.world, this.player, this.vfx);
    this.goals.update();
    this.tutorial.update(dt, this.world, this.player);

    for (const w of this.worlds.values()) {
      if (w !== this.world) w.updateBackground(dt);
    }

    this.autosaveTimer += dt;
    if (this.autosaveTimer >= BALANCE.world.autosaveInterval) {
      this.autosaveTimer = 0;
      this.persist();
    }

    this.incomeTimer += dt;
    if (this.incomeTimer > 0.5) {
      this.incomeTimer = 0;
      let total = 0;
      for (const w of this.worlds.values()) total += w.estimateIncomePerSecond();
      this.cachedIncome = total;
      this.audio.setIntensity(clamp(this.world.customers.length / 12, 0, 1) * (this.events.isActive('rush') ? 1 : 0.7));
      this.checkPrestigeUnlock();
    }
  }

  private stepVisual(rawDt: number): void {
    const la = BALANCE.camera.lookAhead;
    const laMax = this.scene3d.framing.maxLead;
    let lxT = this.player.velX * la;
    let lzT = this.player.velZ * la;
    const lLen = Math.hypot(lxT, lzT);
    if (lLen > laMax) {
      lxT = (lxT / lLen) * laMax;
      lzT = (lzT / lLen) * laMax;
    }
    const lk = 1 - Math.exp(-rawDt / BALANCE.camera.lookAheadTau);
    this.lookX += (lxT - this.lookX) * lk;
    this.lookZ += (lzT - this.lookZ) * lk;
    const lx = this.lookX;
    const lz = this.lookZ;
    let fz = this.player.z + lz;
    // Reveal a side room gradually on approach; movement orientation stays fixed.
    let fx = this.player.x + lx;
    for (const zone of this.world.loc.zones) {
      const r = zone.room;
      if (!r) continue;
      const dx = this.player.x < r.x0 ? r.x0 - this.player.x : this.player.x > r.x1 ? this.player.x - r.x1 : 0;
      const dz = this.player.z < r.z0 ? r.z0 - this.player.z : this.player.z > r.z1 ? this.player.z - r.z1 : 0;
      const weight = Math.max(0, 1 - Math.hypot(dx, dz) / 2.4);
      if (weight <= 0) continue;
      const offset = ((r.x0 + r.x1) * 0.5 - this.player.x) * 0.4;
      fx += Math.max(-1.6, Math.min(1.6, offset)) * weight;
      break;
    }
    // Glance toward a nearby action; never pan toward a distant task or a helper.
    const opening = this.state.tutorialStep < 2 && this.world.loc.id === 'kose';
    const action = this.world.currentAction ?? (opening ? this.world.counters.find(co => !co.locked) : null);
    if (action && this.player.planarSpeed < 1.2) {
      const dx = action.x - this.player.x, dz = action.z - this.player.z;
      if (Math.hypot(dx, dz) < 4) {
        fx += dx * (opening ? 0.6 : 0.14);
        fz += dz * (opening ? 0.35 : 0.14);
      }
    }
    const lead = boundedCameraLead(fx - this.player.x, fz - this.player.z, opening ? Math.max(laMax, 1.5) : laMax, this.cameraLead);
    const bounds = this.world.loc.bounds;
    const fr = this.scene3d.framing;
    fx = this.player.x + lead.x;
    fz = clamp(
      this.player.z + lead.z + fr.focusZOffset,
      bounds.z0 + fr.northPad,
      bounds.z1 - fr.southPad,
    );
    this.scene3d.setFocus(fx, fz, this.player.char.root.position.y, this.player.x, this.player.z);
    this.world.focusX = fx;
    this.world.focusZ = fz;
    this.scene3d.update(Math.min(rawDt, 0.1));
    if (this.adVisualTick) {
      this.adVisualTick(rawDt);
      this.forceRender = true;
    }
    this.vfx.update(Math.min(rawDt, 0.1), this.scene3d.camera.quaternion);
    this.audio.setVacuum(this.player.hasVacuum && !this.paused ? 1 : 0, this.world.vacuumTone);
    this.audio.update(rawDt);
    this.updateUiFrame(rawDt);
  }

  getAdContext() {
    return {
      scene3d: this.scene3d,
      vfx: this.vfx,
      audio: this.audio,
      ui: this.ui,
      state: this.state,
      getWorld: () => this.world,
      player: this.player,
      tutorial: this.tutorial,
      events: this.events,
      input: this.input,
      applyPlayerStats: () => this.applyPlayerStats(),
      forceRender: () => { this.forceRender = true; },
    };
  }

  private shouldSkipRender(): boolean {
    const cam = this.scene3d.camera.position;
    const eps = cameraMoveEpsilon(QUALITY.heatLevel);
    if (cameraMovedEnough(cam.x, cam.y, cam.z, this.lastCamX, this.lastCamY, this.lastCamZ, eps)) return false;
    if (this.player.char.root.visible) return false;
    if (this.world.hasVisibleCharacters()) return false;
    if (this.vfx.hasLive()) return false;
    if (this.world.hasBusyVisuals()) return false;
    if (this.robot && this.robotLeft > 0) return false;
    return true;
  }

  private rememberCamera(): void {
    const cam = this.scene3d.camera.position;
    this.lastCamX = cam.x;
    this.lastCamY = cam.y;
    this.lastCamZ = cam.z;
  }

  /* ================================================================ *
   *  Kazanç çarpanları ve Mutlu Saat
   * ================================================================ */

  /** Ödüllü reklamla açılan Mutlu Saat'in kalan süresi (sn). */
  private happyLeft = 0;
  /** Süpürge robotunun kalan süresi (sn) ve canlı örneği. */
  private robotLeft = 0;
  private robot: RobotVacuum | null = null;
  /**
   * v5.1 reklam bufları (kalan sn): usta modu (el ver bonusu her makinede
   * + hız ×1,25) · müşteri akını (akış ×1,6, sabır ×1,2) · bahşiş yağmuru
   * (masa bahşişi ×3). Arıza sigortası burada DEĞİL — o sayaç Events'te
   * yaşar (breakdown zamanlayıcısının yanında olmak zorunda).
   */
  private ustaLeft = 0;
  private rushLeft = 0;
  private tipLeft = 0;
  private freeUpgradeCooldown = 0;
  /** `world.update`'e giden birleşik çarpanlar — her karede yeniden yazılır. */
  private readonly mods: EventModifiers = { spawnMult: 1, valueMult: 1, patienceMult: 1, tipMult: 1 };

  /**
   * Kare başına geçerli çarpanları tek nesnede toplar.
   *
   * Kaos olaylarının çarpanını `EventManager` kendi nesnesine yazar; Mutlu
   * Saat ise reklamla açılan geçici bir kazanç çarpanı ve onun ÜSTÜNE
   * biner. `events.mods` doğrudan çarpılmıyor: o nesne her `events.update`
   * çağrısında sıfırlanıp baştan yazılıyor, üstüne yazmak bir kare sonra
   * silinir ve olay sisteminin kendi hesabını kirletirdi.
   */
  private tickMods(dt: number): EventModifiers {
    if (this.freeUpgradeCooldown > 0) {
      this.freeUpgradeCooldown = Math.max(0, this.freeUpgradeCooldown - dt);
    }
    if (this.happyLeft > 0) {
      this.happyLeft = Math.max(0, this.happyLeft - dt);
      if (this.happyLeft === 0) this.ui.hideEvent(HAPPY_BANNER);
    }
    /**
     * SÜPÜRGE ROBOTU. Süresi dolunca sahneden ve bellekten çıkar —
     * ödüllü reklamın verdiği hiçbir şey KALICI olmamalı (bkz. core/Ads.ts).
     */
    if (this.robotLeft > 0) {
      this.robotLeft = Math.max(0, this.robotLeft - dt);
      this.robot?.update(dt);
      if (this.robotLeft === 0) {
        this.robot?.dispose();
        this.robot = null;
        this.ui.hideEvent(ROBOT_BANNER);
        this.ui.toast(tr("Robot işini bitirdi ve yerine döndü."), '🤖', 'info');
      }
    }
    /**
     * v5.1 REKLAM BUFLARI — üçü de Mutlu Saat kalıbını izler: sayaç iner,
     * biterken bandı kapatıp kısa bir veda söylenir. Usta modunda ayrıca
     * hız çarpanı geri alınır (applyPlayerStats hızın yazıldığı tek yer).
     */
    if (this.ustaLeft > 0) {
      this.ustaLeft = Math.max(0, this.ustaLeft - dt);
      if (this.ustaLeft === 0) {
        this.ui.hideEvent(USTA_BANNER);
        this.ui.toast(tr('Usta modu bitti.'), '🛠️', 'info');
        this.applyPlayerStats();
      }
    }
    if (this.rushLeft > 0) {
      this.rushLeft = Math.max(0, this.rushLeft - dt);
      if (this.rushLeft === 0) {
        this.ui.hideEvent(RUSH_BANNER);
        this.ui.toast(tr("Müşteri akını dindi."), '🙌', 'info');
      }
    }
    if (this.tipLeft > 0) {
      this.tipLeft = Math.max(0, this.tipLeft - dt);
      if (this.tipLeft === 0) {
        this.ui.hideEvent(TIP_BANNER);
        this.ui.toast(tr("Bahşiş yağmuru dindi."), '💸', 'info');
      }
    }
    /* El-ver bonusunu tüm makinelere yayan bayrak — Station.update okur.
     * Her kare AKTİF dünyaya yazılır; şube değişse bile ilk karede doğru
     * değeri alır (arka plan dünyaları update() koşmaz, bayrağı okumaz). */
    this.world.ustaMode = this.ustaLeft > 0;
    const em = this.events.mods;
    /* Buff çarpanları events.mods ÜZERİNE ÇARPILIR (üstüne yazmak olay
     * sisteminin kendi hesabını silerdi — bkz. fonksiyon yorumu). */
    this.mods.spawnMult = em.spawnMult * (this.rushLeft > 0 ? RUSH_HOUR_SPAWN_MULT : 1);
    this.mods.valueMult = em.valueMult * (this.happyLeft > 0 ? HAPPY_HOUR_MULT : 1);
    this.mods.patienceMult = em.patienceMult * (this.rushLeft > 0 ? RUSH_HOUR_PATIENCE_MULT : 1);
    this.mods.tipMult = em.tipMult * (this.tipLeft > 0 ? TIP_RAIN_MULT : 1);
    /**
     * Buff kalanları HER KARE kayda senkronlanır: `persist` Game'in birçok
     * yerinden tetiklenir (otosave, pagehide, satın almalar) ve hepsinin
     * güncel değeri görmesinin tek güvenli yolu bu. Böylece uygulama
     * kapanınca satın alınan ödül buharlaşmaz (bkz. GameState.adBuffs +
     * restoreAdBuffs). Sigorta süresi Events'te sayılır, buradan okunur.
     */
    const ab = this.state.adBuffs;
    ab.happy = this.happyLeft;
    ab.robot = this.robotLeft;
    ab.usta = this.ustaLeft;
    ab.rush = this.rushLeft;
    ab.tip = this.tipLeft;
    ab.shield = this.events.breakdownShieldLeft;
    return this.mods;
  }

  /**
   * SÜPÜRGEYİ BİR KEZ TANIT — sessiz kaybı kapatan tek seferlik dokunuş.
   *
   * Sorun: süpürge oyunun en görünmez mekaniğiydi. Rehber oku onu yalnız
   * `!hasServiceWork()` iken önerir (bu şart bilinçli ve KALMALI: kaldırınca
   * ölçümde oyuncu süpürgeyi alıp servise bir daha dönmemiş, kazanç %64
   * düşmüştü). Ama yan etkisi şu: kafe büyüdükçe servis işi hiç bitmez,
   * yani ok süpürgeyi FİİLEN HİÇ göstermez. Mekanik var, oyuncu yok.
   *
   * Çözüm okun kuralını değil, KEŞFİ hedefliyor: zemin ilk kez gerçekten
   * kirlendiğinde bir kez söylenir ve bir daha söylenmez. Öğretici
   * bitmeden tetiklenmez — FTUE tek seferde tek mekanik öğretir.
   */
  private maybeHintVacuum(): void {
    const s = this.state;
    if (s.vacuumHinted) return;
    if (!this.tutorial.finished) return;
    if (this.player.hasVacuum) {
      // Kendi bulduysa tanıtıma gerek yok; bir daha sorulmaz.
      s.vacuumHinted = true;
      return;
    }
    if (this.world.vacuums.every((v) => v.locked)) return;
    if (this.world.grime.heavyCoverage < 0.09) return;
    s.vacuumHinted = true;
    this.ui.toast(tr("Zemin kirlendi — SÜPÜRGEYİ AL düğmesine dokun, kirin üstünden geç."), '🧹', 'info');
    if (this.settings.get('haptics')) haptic('light');
    this.persist();
  }

  /* Teklif çipi zamanlaması — bkz. maybeOfferAd. İlk teklif 40. saniyede. */
  private static readonly AD_OFFER_MAX_SHOWN = 12;
  private adOfferShownCount = 0;
  private adChipTimer = 40;
  private adChipLife = 0;
  /**
   * Açık çipin TOPLAM ömrü (sn). Halka `adChipLife / adChipMaxLife` ile
   * çizilir; çipi açan her yol bunu kendi ömrüyle yazar (yatırımcı 14 sn,
   * ped teklifi 12 sn, kendiliğinden teklif 35 sn).
   */
  private adChipMaxLife = 35;

  /**
   * ÖDÜL TEKLİFİNİ KENDİLİĞİNDEN GÖSTER.
   *
   * Geri bildirim: "reklamlı ödüllü şeyleri göremedim, kendiliğinden ara
   * ara belirmesi gerekiyordu." Teklifler yalnız panellerin içindeydi;
   * paneli açmayan oyuncu sistemin varlığını hiç öğrenmiyordu.
   *
   * Sıklık disiplini teklifin kendisi kadar önemli: her zaman ekranda
   * duran bir teklif TEKLİF KÖRLÜĞÜ yaratır ve gönüllü izlenme oranını
   * düşürür. Kurallar:
   *  · Öğretici bitmeden hiç gösterilmez (FTUE tek seferde tek şey öğretir).
   *  · İki teklif arası ~80 sn (±15 sn seğirtme); çip `OMUR` saniye sonra
   *    kendiliğinden kapanır (yanıt vermeyen oyuncuyu rahatsız etmez) ve
   *    kalan ömür simgenin çevresindeki halkada GÖRÜNÜR geri sayılır.
   *  · Panel/dönüş ekranı açıkken gösterilmez — oyuncunun odağı orada.
   *  · Yalnız GERÇEKTEN hazır bir yerleşim gösterilir; hazır olması
   *    "istek anı" koşulunu da içerir (bkz. getAdOffers).
   */
  private maybeOfferAd(dt: number): void {
    const OMUR = 35;
    if (this.ui.adChipOpen) {
      this.adChipLife -= dt;
      // Geri sayım halkası her kare tazelenir (HUD zaten küçük adımlar).
      this.ui.setAdChipProgress(Math.max(0, this.adChipLife) / Math.max(0.001, this.adChipMaxLife));
      if (this.adChipLife <= 0) this.ui.hideAdChip();
      return;
    }
    if (this.adOfferShownCount >= Game.AD_OFFER_MAX_SHOWN) return;
    if (!this.tutorial.finished || this.ui.isPanelOpen()) return;
    this.adChipTimer -= dt;
    if (this.adChipTimer > 0) return;

    const o = this.getAdOffers();
    /**
     * ÖNCELİK SIRASI (v5.1): acilden genele. Arıza sigortası en önde —
     * makine ŞU AN duruyor; nakit desteği ve robot somut bir derdi çözer;
     * süreli çarpanlar (akın/usta/mutlu saat/bahşiş) ortada; depo ve
     * günlük katlama "her zaman iyi" oldukları için en sonda. comeback_sale
     * BİLEREK listede yok: o teklif yalnız dönüş modalında yaşar.
     */
    const aday: { k: UiAdRewardKind; g: string; t: string; d: string }[] = [
      { k: 'repair_shield', g: '🛡️', t: tr("Arıza Sigortası"), d: o.repairShield.ready ? o.repairShield.text : '' },
      { k: 'cash_boost', g: '💰', t: tr("Nakit Desteği"), d: o.cashBoost.ready ? o.cashBoost.text : '' },
      { k: 'robot_vacuum', g: '🤖', t: tr("Süpürge Robotu"), d: o.robotVacuum.ready ? o.robotVacuum.text : '' },
      { k: 'zone_finish', g: '🚧', t: tr("Bölümü Tamamla"), d: o.zoneFinish.ready ? o.zoneFinish.text : '' },
      { k: 'rush_hour', g: '🙌', t: tr("Müşteri Akını"), d: o.rushHour.ready ? o.rushHour.text : '' },
      { k: 'usta_mode', g: '🛠️', t: tr("Usta Modu"), d: o.ustaMode.ready ? o.ustaMode.text : '' },
      { k: 'happy_hour', g: '🎉', t: tr("Mutlu Saat"), d: o.happyHour.ready ? o.happyHour.text : '' },
      { k: 'tip_rain', g: '💸', t: tr("Bahşiş Yağmuru"), d: o.tipRain.ready ? o.tipRain.text : '' },
      { k: 'stock_refill', g: '📦', t: tr("Depoları Doldur"), d: o.stockRefill.ready ? o.stockRefill.text : '' },
      { k: 'daily_double', g: '🎁', t: tr("Ödülü İkiye Katla"), d: o.dailyDouble.ready ? o.dailyDouble.text : '' },
    ];
    const secilen = aday.find((a) => a.d !== '');
    if (!secilen) {
      // Hazır teklif yok: kısa süre sonra tekrar bak, sayacı boşa harcama.
      this.adChipTimer = 20;
      return;
    }
    this.adOfferShownCount++;
    this.ui.showAdChip(secilen.k, secilen.g, secilen.t, secilen.d);
    this.ui.setAdChipProgress(1);
    this.adChipLife = OMUR;
    this.adChipMaxLife = OMUR;
    /**
     * Sonraki teklif 80 sn ± 15 seğirtme: SABİT aralık ritmi tahmin
     * edilebilir kılıyor ve teklif körlüğünü hızlandırıyordu; ufak
     * rastgelelik çipi "canlı" tutar ama sıklık disiplinini bozmaz.
     */
    this.adChipTimer = 80 + (Math.random() * 30 - 15);
  }

  private updateUiFrame(dt: number): void {
    /**
     * MUTLU SAAT BANDI. Kalan süre olay bandının kendi sayacında görünür;
     * HUD'a yeni bir gösterge EKLENMEDİ. Üst yığın telefonda bilerek iki
     * satırda tutuluyor, geçici bir çarpan için onu şişirmek gerileme olur.
     */
    if (this.happyLeft > 0) {
      this.ui.showEvent({
        id: HAPPY_BANNER,
        title: tr("MUTLU SAAT"),
        desc: tr("Bütün kazancın ×{0}", HAPPY_HOUR_MULT),
        glyph: '🎉',
        remaining: this.happyLeft,
        duration: Math.max(HAPPY_HOUR_SECONDS, this.happyLeft),
        tone: 'good',
      });
    }
    this.maybeHintVacuum();
    this.maybeOfferAd(dt);
    if (this.robotLeft > 0) {
      this.ui.showEvent({
        id: ROBOT_BANNER,
        title: tr("SÜPÜRGE ROBOTU"),
        desc: tr("Zemini o topluyor"),
        glyph: '🤖',
        remaining: this.robotLeft,
        duration: ROBOT_SECONDS,
        tone: 'good',
      });
    }
    /* v5.1 buff bantları — Mutlu Saat'le aynı yol: süre olay bandının
     * kendi sayacında görünür, HUD'a yeni gösterge eklenmez. */
    if (this.ustaLeft > 0) {
      this.ui.showEvent({
        id: USTA_BANNER,
        title: tr("USTA MODU"),
        // Metin kodla eşit: USTA_SPEED_MULT 1,25 (ondalık virgülle yazılır).
        desc: tr("El ver bonusu her makinede · hız ×1,25"),
        glyph: '🛠️',
        remaining: this.ustaLeft,
        duration: USTA_SECONDS,
        tone: 'good',
      });
    }
    if (this.rushLeft > 0) {
      this.ui.showEvent({
        id: RUSH_BANNER,
        title: tr("MÜŞTERİ AKINI"),
        desc: tr("Akış ×1,6 · sabır ×1,2"),
        glyph: '🙌',
        remaining: this.rushLeft,
        duration: RUSH_HOUR_SECONDS,
        tone: 'good',
      });
    }
    if (this.tipLeft > 0) {
      this.ui.showEvent({
        id: TIP_BANNER,
        title: tr("BAHŞİŞ YAĞMURU"),
        desc: tr("Masa bahşişleri ×{0}", TIP_RAIN_MULT),
        glyph: '💸',
        remaining: this.tipLeft,
        duration: TIP_RAIN_SECONDS,
        tone: 'good',
      });
    }

    // Olay bantlarının kalan süresi
    for (const b of this.events.activeBanners()) {
      const info = this.events.info(b.id as ChaosEventId);
      this.ui.showEvent({
        id: b.id,
        title: info.title,
        desc: info.desc,
        glyph: info.glyph,
        remaining: b.remaining,
        duration: b.duration,
        tone: info.tone,
      });
    }

    // Tutorial — hedefi DOM işaretçisi yerine 3D ok/halka gösterir (tek dil).
    if (!this.tutorial.finished) {
      const text = this.player.hasVacuum ? tr('Süpürgeyi bırakmak için SÜPÜRGEYİ BIRAK düğmesine dokun; sonra işine devam et.') : this.tutorial.currentText;
      if (text) this.ui.setTutorial({ text, index: this.tutorial.step, total: this.tutorial.total });
      const t = this.tutorial.pointerTarget;
      this.world.guideOverride = t
        ? { x: t.x, z: t.z, label: this.tutorial.pointerVerb ?? tr("BURAYA GEL"), color: 0xffc84a }
        : null;
    } else {
      this.ui.setTutorial(null);
      this.world.guideOverride = null;
      /**
       * Bildirim izni TUTORIAL BİTİNCE istenir, açılışta değil.
       *
       * Oyunu daha görmeden izin isteyen uygulama reddedilir ve iOS'ta bir
       * daha SORULAMAZ — tek şansı harcamış olur. Oyuncu döngüyü öğrenip
       * ilk açılımını yaptıktan sonra sorulunca kabul oranı çok daha yüksek.
       */
      /**
       * ...ve İLK OTURUMDA HİÇ istenmez. Öğreticinin hemen ardından bile
       * sistem popup'ı akışı bölüyordu; oyuna dönen oyuncu ("kayıtla
       * açılan ikinci oturum") zaten oyunu sevmiş demektir — kabul oranı
       * en yüksek an odur.
       */
      if (!this.notifAsked && this.returningPlayer) {
        this.notifAsked = true;
        void requestNotificationPermission().then((ok) => {
          if (ok) this.refreshReminders();
        });
      }
    }

    this.ui.update(dt);
  }

  /** Üst üste başarısız kayıt sayısı — üçüncüde oyuncu bir kez uyarılır. */
  private saveFailStreak = 0;
  private saveFailToasted = false;

  private persist(): void {
    if (this.persistDisabled) return;
    const worlds: Record<string, ReturnType<World['save']>> = {};
    for (const [id, w] of this.worlds) worlds[id] = w.save();
    const ok = this.save.write({ state: this.state.save(), worlds });
    /**
     * SESSİZ KAYIP OLMAZ. Kota dolduğunda `write` false döner ve eskiden
     * bunu kimse okumuyordu: oyuncu saatlerce oynayıp hiçbir şeyin
     * kaydedilmediğini kapatınca öğreniyordu. Bir kez, açık Türkçeyle
     * söylenir; düzelirse sayaç sıfırlanır.
     */
    if (ok) {
      this.saveFailStreak = 0;
    } else if (++this.saveFailStreak >= 3 && !this.saveFailToasted) {
      this.saveFailToasted = true;
      this.ui.toast(tr("İlerleme kaydedilemiyor — cihaz depolaması dolu olabilir."), '⚠️', 'bad');
    }
    // Gece yarısı oturum içinde geçerse günlük ödül beklemeden yenilensin.
    this.checkDaily();
    /**
     * Bildirim planlaması KAYITTAN AYRILDI. Her 6 sn'de bir iki
     * AlarmManager alarmını iptal edip yeniden kurmak (saatte ~1.200
     * native köprü çağrısı) Android'in pil denetimlerine takılan bir
     * desendir; içerik yalnızca offline tavanına bağlı olduğu için
     * arka plana geçişte kurmak yeterli (bkz. bindEvents).
     */
  }

  /**
   * Hatırlatmaları tazeler. Her kayıtta çağrılır — oyuncu oyunu açtıysa
   * eski hatırlatmalar artık yanlış zamana kuruludur.
   *
   * İki hatırlatma: kasa dolduğunda (offline tavanı) ve ertesi gün. Metin
   * suçlayıcı değil, davetkâr: "kaçırdın" değil "seni bekliyor".
   */
  private refreshReminders(): void {
    const capH = Math.max(2, Math.round(this.state.offlineCapSeconds / 3600));
    void scheduleReminders([
      {
        hours: capH,
        /**
         * DOĞRU VAAT. Oyun bilerek offline PARA vermez (bkz. Offline.ts);
         * beklerken yalnız makineler stok biriktirir. Eski metin "kasayı
         * topla" diyordu — dönen oyuncu kasada tek kuruş bulamayınca
         * bildirim yalancı çıkıyordu. Metin artık gerçek jesti anlatıyor.
         */
        title: tr("Raflar doldu ☕"),
        body: tr("Makineler senin için üretti. Servise hazır raflar seni bekliyor."),
      },
      {
        hours: 24,
        title: tr("Günün ödülü hazır 🎁"),
        body: tr("Masalar toplanmayı bekliyor. Bugünün görevleri de seni bekliyor."),
      },
    ]);
  }

  /**
   * Yerel günü ilerletir ve yeni gün başladıysa oyuncuya haber verir.
   * Hem açılışta hem de gece yarısını geçen oturumda (görünürlük dönüşü)
   * çağrılır. Hafta devri (haftalık hedef + festival) de burada döner:
   * aynı takvim sorusu, aynı çağrı noktaları.
   */
  private checkDaily(): void {
    const s = this.state;

    /* ---- hafta devri (v5.1) ---- */
    const newWeek = rollWeek(s);
    if (rollFestival(s)) {
      const f = currentFestival();
      this.ui.toast(tr("{0} başladı — {1}", f.title, f.desc), f.glyph, 'info');
      bus.emit('ui:refresh', {});
    } else if (newWeek) {
      bus.emit('ui:refresh', {});
    }

    /* ---- gün devri ---- */
    const prevStreak = s.dailyStreak;
    const r = rollDay(s);
    if (!r.newDay) return;
    /**
     * 7. GÜN KUPONU. Streak'in 5→6 geçişi serinin yedinci sabahıdır ve
     * kırılmadan yalnız BİR KEZ yaşanır (merdiven 6'da doyar, sonraki
     * günler 6→6). Kupon claim'e değil serinin kendisine bağlanır:
     * oyuncu o sabah butona basmasa da hak edilmiş olan buharlaşmaz.
     */
    if (!r.streakBroken && prevStreak === 5 && s.dailyStreak === 6) {
      s.coupons++;
      this.ui.celebrate(tr("7 GÜN SERİ!"), tr("Kozmetik kuponu kazandın — Dekorasyon panelinde %40 indirim"), '🎟️');
      this.persist();
    }
    bus.emit('ui:refresh', {});
    if (r.streakBroken) {
      // "Asla cezalandırma": seri kırıldı ama kaybedilen bir şey yok.
      this.ui.toast(tr("Seri sıfırlandı — sorun değil, bugün baştan!"), '🔄', 'info');
    }
    const reward = dailyReward(this.state.dailyStreak, this.rewardIncomePerSec());
    this.ui.toast(tr("Günlük ödül hazır: +₺{0}", formatMoney(reward)), '🎁', 'good');
  }

  /* ================================================================
   *  UIApi
   * ================================================================ */

  followGoal(): void {
    const goal = this.goals.current;
    if (!goal || !this.tutorial.finished) return;
    const help = goal.kind === 'hire' && goal.role
      ? { kind: 'staff', id: goal.role + ':' + this.state.staffCount[goal.role] }
      : goal.kind === 'zone' && goal.zone ? { kind: 'zone', id: goal.zone }
      : { kind: 'goal', id: goal.id };
    this.telemetry.useHelp({ ...help, location: this.state.activeLocation });
    this.ui.closePanels();
    if (goal.kind === 'hire') this.ui.openPanel('staff');
    else if (goal.kind === 'upgrade') this.ui.openPanel('upgrades');
    else if (goal.kind === 'stationLevel') this.ui.openPanel('stations');
    else if (goal.kind === 'location') this.ui.openPanel('locations');
    else {
      this.world.guideGoal = goal;
      this.world.focusCurrentGoal();
      this.ui.toast(goal.hint, '🎯', 'info');
    }
  }

  focusSideActivity(id: SideActivityId): void {
    this.world.focusSideActivity(id);
    bus.emit('ui:refresh',{});
  }

  toggleVacuum(): boolean {
    if (this.paused || this.ui.isPanelOpen()) return false;
    const changed = this.world.toggleVacuum(this.player);
    if (changed) {
      // HUD clicks do not reach the movement surface's first-gesture handler.
      this.audio.unlock();
      this.audio.setVacuum(this.player.hasVacuum ? 1 : 0, 0);
      bus.emit('ui:refresh', {});
    }
    return changed;
  }

  getHud(): UiHudState {
    const g = this.goals.current;
    let goal: UiGoal | null = null;
    if (g) {
      goal = {
        id: g.id,
        title: g.title,
        hint: g.hint,
        current: Math.min(this.goals.currentValue(), g.target),
        target: g.target,
        reward: g.reward,
        index: this.goals.index,
        total: this.goals.total,
      };
    }
    return {
      actionLabel: this.world.currentAction?.hud ?? this.world.currentAction?.label ?? '',
      streak: this.world.streakNow,
      streakNeed: 4,
      vacuum: { available: this.world.vacuumAvailable(this.player), holding: this.player.hasVacuum, canTake: this.player.isEmpty },
      sideActivities: this.world.getSideActivityRows(this.player),
      money: this.state.money,
      reputation: this.state.reputation,
      repMult: this.state.repMultiplier,
      hygiene: this.world.hygiene,
      hygieneMult: this.world.hygieneMult,
      hygieneActive: this.world.hygieneActive,
      tempo: this.world.tempo,
      dirtyTables: this.state.stats.orders > 0 ? this.world.dirtyTableCount : 0,
      spills: this.state.stats.orders > 0 ? this.world.spillCount : 0,
      pendingOrders: this.world.pendingOrders,
      supplyLevel: this.world.supplyLevel,
      toiletOpen: this.world.toiletOpen,
      cafeOpen: this.world.salonOpen,
      seatsUsed: this.world.seatsUsed,
      seatsTotal: this.world.seatsTotal,
      carry: this.player.carryCount,
      carryMax: this.player.capacity,
      carryItem: this.player.carryItem,
      carrySlots: this.player.slots,
      locationName: this.world.loc.name,
      progress: this.world.progress,
      goal,
      incomePerSec: this.cachedIncome,
      tutorialActive: !this.tutorial.finished,
      staffHired: Object.values(this.state.staffCount).some((n) => n > 0),
      upgradeOnboarded: this.state.upgradeOnboarded,
      staffOnboarded: this.state.staffOnboarded,
      boostLeft: this.happyLeft,
      boostMultiplier: HAPPY_HOUR_MULT,
      boostMax: HAPPY_HOUR_MAX_SECONDS,
      boostReady: adReady('happy_hour') && this.happyLeft < HAPPY_HOUR_MAX_SECONDS,
    };
  }

  getUpgradeAdvice(): UiUpgradeAdvice | null {
    if (!this.tutorial.finished) return null;
    const choice = chooseUpgradePressure(this.world.stations.filter(st=>!st.locked).map(st=>{
      let usedSeats = 0;
      for (let i = 0; i < st.seatTaken.length; i++) if (st.seatTaken[i]) usedSeats++;
      return {
        id: st.id, kind: st.def.kind, upgradeableSpeed: st.canUpgradeSpeed,
        upgradeableCap: st.canUpgradeCap, stock: st.output, capacity: st.outputCap,
        demand: st.def.item ? this.world.demandFor(st.def.item) : 0, queue: st.queue.length,
        seats: st.seats, usedSeats,
      };
    }));
    if (!choice) return null;
    const st = this.world.byId.get(choice.id);
    if (!st) return null;
    const row = this.toStationRow(st);
    const speed = choice.kind === 'speed';
    const reasons = { queue: tr('Kasada sıra birikti. Siparişleri daha çabuk al.'), production: tr('Bu ürünü bekleyen sipariş var, makine boş. Üretimi hızlandır.'), seating: tr('Salon dolmak üzere. Boş masaya sandalye ekle.') };
    return { id: row.id, kind: choice.kind, name: row.name, reason: reasons[choice.reason],
      current: speed ? row.speedText : row.capText, next: speed ? row.nextSpeedText : row.nextCapText,
      cost: speed ? row.speedCost : row.capCost, affordable: speed ? row.canSpeed : row.canCap };
  }

  getCollection(): UiCollection {
    const milestones = [10, 50, 150];
    return {
      recipes: Object.values(ITEMS).filter(item=>item.tier==='product').map(item=>{
        const count = this.state.stats.sale[item.id] ?? 0;
        return { id: item.id, name: item.name, glyph: item.glyph, count,
          stars: milestones.filter(m=>count>=m).length, next: milestones.find(m=>count<m) ?? null };
      }),
      places: LOCATION_ORDER.map(id=>({ name: locationDef(id).name, seen: this.state.seenLocations.has(id) })),
    };
  }

  getPlayerUpgrades(): UiUpgradeRow[] {
    const deltaMap: Record<PlayerUpgradeId, string> = {
      speed: tr("+%14 Hız"),
      capacity: tr("+1 Kapasite"),
      hands: tr("+%11 El Hızı"),
      charm: tr("+%9 Kazanç"),
      vault: '',
    };
    return PLAYER_UPGRADES.map((def) => {
      const level = this.state.upgrades[def.id];
      const maxed = level >= def.maxLevel;
      const cost = this.state.playerUpgradeCost(def.id);
      return {
        id: def.id,
        name: def.name,
        desc: def.desc,
        glyph: def.glyph,
        level,
        maxLevel: def.maxLevel,
        cost,
        affordable: !maxed && this.state.canAfford(cost),
        maxed,
        valueText: def.format(level),
        nextText: maxed ? def.format(level) : def.format(level + 1),
        deltaBadge: maxed ? undefined : deltaMap[def.id],
      };
    });
  }

  buyPlayerUpgrade(id: string): boolean {
    if (!(id in PLAYER_UPGRADE_MAP)) return false;
    return this.state.buyPlayerUpgrade(id as PlayerUpgradeId);
  }

  private async runFreeUpgradeAd(apply: () => boolean): Promise<boolean> {
    if (this.adRewardInFlight || this.freeUpgradeCooldown > 0) return false;
    this.adRewardInFlight = true;
    this.telemetry.record('ad_requested', { placement: 'free_upgrade' });
    let rewarded = false;
    try {
      if (!(await this.showRewardedOrExplain('free_upgrade'))) return false;
      rewarded = apply();
      if (rewarded) {
        this.freeUpgradeCooldown = FREE_UPGRADE_COOLDOWN_SEC;
        this.ui.toast(tr("🎉 Ücretsiz yükseltme alındı!"), '📺', 'good');
        this.persist();
      }
      return rewarded;
    } finally {
      this.adRewardInFlight = false;
      this.telemetry.record('ad_result', { placement: 'free_upgrade', rewarded });
    }
  }

  async watchFreePlayerUpgrade(id: string): Promise<boolean> {
    if (!(id in PLAYER_UPGRADE_MAP)) return false;
    const pid = id as PlayerUpgradeId;
    if (this.state.upgrades[pid] >= PLAYER_UPGRADE_MAP[pid].maxLevel) return false;
    return this.runFreeUpgradeAd(() => this.state.buyPlayerUpgrade(pid, true));
  }

  getStaff(): UiStaffRow[] {
    const locId = this.world.loc.id;
    const reqZoneFor = (role: StaffRole): string => {
      if (locId === 'sahil') return role === 'busser' ? 's_t1' : role === 'barista' ? 's_a2' : 's_a1';
      if (role === 'busser') return 't1';
      if (role === 'barista') return 'a3';
      return 'a1';
    };
    const levelDeltaFor = (role: StaffRole, lvl: number): string => {
      if (role === 'waiter') return waiterCapacity(lvl + 1) > waiterCapacity(lvl) ? tr("+%7 Hız · +1 Sepet") : tr("+%7 Hız");
      if (role === 'cashier') return tr("+%5 Sipariş Hızı");
      if (role === 'busser') return busserCapacity(lvl + 1) > busserCapacity(lvl) ? tr("+%6 Hız · +1 Bulaşık") : tr("+%6 Temizlik Hızı");
      return tr("+%6 Hazırlık Hızı");
    };
    return STAFF_ROLES.map((def) => {
      const unlocked = this.state.staffRoleUnlocked(def.id) || this.state.staffCount[def.id] > 0;
      const count = this.state.staffCount[def.id];
      const level = this.state.staffLevel[def.id];
      const activeCap = unlocked ? this.state.activeStaffCapFor(def.id) : this.state.staffCapFor(def.id);
      const hireMaxed = unlocked && count >= activeCap;
      const levelMaxed = level >= def.maxLevel;
      const shelfCapacity = Math.max(0, ...this.world.stations.filter(st=>!st.locked && st.def.kind==='pickup').map(st=>st.outputCap));
      const assignments = [...new Set(this.world.staff.filter(st=>st.role===def.id && st.assigned).map(st=>st.assigned!.def.name))];
      const reqZone = zoneDef(locId, reqZoneFor(def.id));
      return {
        id: def.id,
        name: def.name,
        desc: hireMaxed && count < this.state.staffCapFor(def.id)
          ? tr("{0} Yeni istasyon açılınca kadro büyür.", def.desc)
          : def.desc,
        glyph: def.glyph,
        color: def.color,
        count,
        maxCount: activeCap,
        hireCost: this.state.hireCostFor(def.id),
        hirePaid: this.state.hirePaidFor(def.id),
        hireTotalCost: this.state.hireTotalCostFor(def.id),
        canHire: unlocked && this.state.canHire(def.id),
        hireMaxed,
        locked: !unlocked,
        unlockHint: !unlocked ? tr("🔒 “{0}” (₺{1}) bölümü açılınca aktif", reqZone.name, formatMoney(reqZone.cost)) : undefined,
        level,
        maxLevel: def.maxLevel,
        levelCost: this.state.staffLevelCostFor(def.id),
        canLevel: unlocked && this.state.canLevelStaff(def.id),
        levelMaxed,
        effectText: staffEffectText(def.id, level, shelfCapacity),
        nextEffectText: staffEffectText(def.id, Math.min(def.maxLevel, level + 1), shelfCapacity),
        deltaBadge: !hireMaxed ? tr("+1 {0}", def.name) : undefined,
        levelDeltaBadge: !levelMaxed ? levelDeltaFor(def.id, level) : undefined,
        scopeText: (assignments.length ? tr('Görev yeri: {0}', assignments.join(', ')) + ' · ' : '') + tr(PLAYER_STAFF_WORK[def.id]),
      };
    });
  }

  hireStaff(id: string): boolean {
    return this.state.hire(id as StaffRole);
  }

  levelStaff(id: string): boolean {
    return this.state.levelStaff(id as StaffRole);
  }

  async watchFreeStaffUpgrade(id: string, kind: 'hire' | 'level'): Promise<boolean> {
    const role = id as StaffRole;
    if (kind === 'hire') {
      if (!this.state.staffRoleUnlocked(role) || this.state.staffCount[role] >= this.state.activeStaffCapFor(role)) return false;
      return this.runFreeUpgradeAd(() => this.state.hire(role, 'menu', true));
    }
    const def = STAFF_ROLES.find((r) => r.id === role);
    if (!def || this.state.staffCount[role] <= 0 || this.state.staffLevel[role] >= def.maxLevel) return false;
    return this.runFreeUpgradeAd(() => this.state.levelStaff(role, true));
  }

  private toStationRow(st: import('../sim/Station').StationEntity): UiStationRow {
    const zone = zoneDef(this.world.loc.id, st.def.zone);
    const speedCost = st.speedUpgradeCost;
    const capCost = st.capUpgradeCost;
    const tableOccupied = st.def.kind === 'table' && st.seatTaken.some(Boolean);
    const capLabel = st.def.kind === 'table' ? tr('Sandalye') : st.def.kind === 'toilet' ? tr('Sarf') : tr('Depo');
    return {
      id: st.id,
      name: st.def.name,
      glyph: stationGlyph(st.def.kind, st.def.item),
      zoneName: zone.name,
      deptName: DEPT_NAMES[st.def.dept ?? 'market'],
      locked: st.locked,
      unlockHint: st.locked ? tr("🔒 “{0}” bölümü açılınca aktif", zone.name) : undefined,
      speedLevel: st.speedLevel,
      speedMaxLevel: STATION_SPEED_MAX,
      speedCost,
      canSpeed: !st.locked && st.canUpgradeSpeed && this.state.canAfford(speedCost),
      speedText: this.stationSpeedText(st, st.speedLevel),
      nextSpeedText: this.stationSpeedText(st, Math.min(STATION_SPEED_MAX, st.speedLevel + 1)),
      speedDeltaBadge: st.def.speedCost !== undefined && st.speedLevel < STATION_SPEED_MAX ? tr("+%12 Hız") : undefined,
      hasSpeed: st.def.speedCost !== undefined,
      capLevel: st.capLevel,
      /**
       * GERÇEK tavan gönderilir. Sabit 8 gönderilince masalarda (tavan 2)
       * panel sonsuza dek fiyatlı ama işlevsiz bir "Depo 2/8" butonu
       * gösteriyor, MAKS'a hiç dönmüyordu.
       */
      capMaxLevel: st.capMax,
      capCost,
      canCap: !st.locked && st.canUpgradeCap && !tableOccupied && this.state.canAfford(capCost),
      // Masada "depo" değil sandalye satın alınıyor — etiket öyle desin.
      capText: this.stationCapText(st, st.capLevel),
      nextCapText: this.stationCapText(st, Math.min(st.capMax, st.capLevel + 1)),
      capDeltaBadge: st.def.capCost !== undefined && st.capLevel < st.capMax
        ? (st.def.kind === 'table' ? tr("+1 Sandalye") : tr("+2 {0}", capLabel))
        : undefined,
      capBlockedReason: tableOccupied ? tr('Masa boşalınca sandalye ekleyebilirsin.') : undefined,
      capLabel,
      hasCap: st.def.capCost !== undefined,
    };
  }

  getStations(): UiStationRow[] {
    const rows: UiStationRow[] = [];
    for (const st of this.world.stations) {
      if (!st.canUpgradeSpeed && !st.canUpgradeCap && st.speedLevel === 0 && st.capLevel === 0) continue;
      rows.push(this.toStationRow(st));
    }
    return rows;
  }

  private stationSpeedText(st: import('../sim/Station').StationEntity, level: number): string {
    const fmt = (n: number) => formatDecimal(n, 2, getLanguage() === 'en' ? 'en-US' : 'tr-TR');
    if (st.def.kind === 'counter') {
      const manual = st.counterOrderTime('player', 0, level);
      const cashier = st.counterOrderTime('cashier', this.state.staffLevel.cashier, level);
      return tr('Sen {0} sn · kasiyer {1} sn', fmt(manual), fmt(cashier));
    }
    return tr('{0} sn', fmt(st.cycleTimeAt(level)));
  }

  private stationCapText(st: import('../sim/Station').StationEntity, level: number): string {
    if (st.def.kind === 'table') return tr('{0} sandalye', st.seatsAt(level));
    if (st.def.kind === 'toilet') return (st.def.supplies ?? []).map(supply =>
      tr('{0} {1}', st.supplyCapAt(supply.item, level), ITEMS[supply.item].name)).join(' + ');
    return tr('{0} ürün', st.outputCapAt(level));
  }

  buyStationUpgrade(id: string, kind: 'speed' | 'cap', free = false): boolean {
    const st = this.world.byId.get(id);
    if (!st || st.locked) return false;
    if (kind === 'speed') {
      if (!st.canUpgradeSpeed) return false;
      if (!free && !this.state.spend(st.speedUpgradeCost)) return false;
      st.speedLevel++;
    } else {
      if (!st.canUpgradeCap) return false;
      if (st.def.kind === 'table' && st.seatTaken.some(Boolean)) return false;
      if (!free && !this.state.spend(st.capUpgradeCost)) return false;
      st.capLevel++;
    }
    this.state.stats.stationUpgrades++;
    this.state.upgradeOnboarded = true;
    // Yükseltme ürünün değerini de artırır — çarpanı tazele.
    this.world.refreshValueBonus();
    if (kind === 'cap' && st.def.kind === 'table') {
      this.world.refreshCapacity();
      this.world.refreshTableVisual(st.id);
    }
    bus.emit('upgrade:bought', { kind: 'station', id, level: kind === 'speed' ? st.speedLevel : st.capLevel });
    this.vfx.ring(st.x, 0.2, st.z, 0x4fb59a, 2.2);
    return true;
  }

  async watchFreeStationUpgrade(id: string, kind: 'speed' | 'cap'): Promise<boolean> {
    const st = this.world.byId.get(id);
    if (!st || st.locked) return false;
    if (kind === 'speed' && !st.canUpgradeSpeed) return false;
    if (kind === 'cap' && (!st.canUpgradeCap || (st.def.kind === 'table' && st.seatTaken.some(Boolean)))) return false;
    return this.runFreeUpgradeAd(() => this.buyStationUpgrade(id, kind, true));
  }

  getLocations(): UiLocationRow[] {
    return LOCATION_ORDER.map((id) => {
      const def = locationDef(id);
      const unlocked = this.state.isLocationUnlocked(id);
      const w = this.worlds.get(id);
      let requirementText = '';
      let canBuy = false;
      if (!unlocked) {
        const req = def.requiresProgress;
        const reqWorld = req ? this.worlds.get(req.location) : undefined;
        const reqMet = !req || (reqWorld ? reqWorld.progress >= req.pct : false);
        if (!reqMet && req) {
          const pct = Math.floor(req.pct * 100);
          requirementText = tr("{0} %{1} tamamlanmalı", locationDef(req.location).name, pct);
        } else if (!this.state.canAfford(def.unlockCost)) {
          requirementText = tr('₺{0} gerekiyor', formatMoney(def.unlockCost));
          canBuy = false;
        } else {
          canBuy = true;
        }
        if (reqMet && this.state.canAfford(def.unlockCost)) canBuy = true;
      }
      return {
        id,
        name: def.name,
        tagline: def.tagline,
        unlocked,
        active: this.world.loc.id === id,
        cost: def.unlockCost,
        canBuy,
        progress: w ? w.progress : 0,
        requirementText,
      };
    });
  }

  buyLocation(id: string): boolean {
    if (!LOCATION_ORDER.includes(id) || this.state.isLocationUnlocked(id)) return false;
    const def = locationDef(id);
    const req = def.requiresProgress;
    if (req) {
      const w = this.worlds.get(req.location);
      if (!w || w.progress < req.pct) return false;
    }
    if (!this.state.spend(def.unlockCost)) return false;
    this.state.unlockLocation(id);
    const w = this.createWorld(id, undefined);
    w.syncStaff();
    bus.emit('location:unlocked', { location: id, name: def.name });
    this.switchLocation(id);
    return true;
  }

  switchLocation(id: string): boolean {
    if (!this.state.isLocationUnlocked(id)) return false;
    this.state.seenLocations.add(id);
    const w = this.worlds.get(id) ?? this.createWorld(id, undefined);
    if (w === this.world) return true;
    /**
     * Robot şubede kalmaz: mekân değişince zaten görünmez olurdu ve
     * oyuncu ödülünü kaybetmiş sanırdı. Süre de sıfırlanır — yarım kalan
     * bir ödülü sessizce sürdürmek yerine açıkça bitirmek dürüst olan.
     */
    this.robot?.dispose();
    this.robot = null;
    this.robotLeft = 0;
    this.ui.hideEvent(ROBOT_BANNER);
    this.activateWorld(w, true);
    this.ui.toast(tr("{0}’ne geçildi", w.loc.name), '🚚', 'info');
    /**
     * DOĞAL ARA — akıllı geçiş reklamı için uygun an (bkz. core/Ads.ts).
     * Oyuncu dururken ve elleri boşken, oturum ve süre kuralı uygunsa açılır.
     */
    this.trySmartBreak();
    return true;
  }

  private getInterstitialContext(): InterstitialSafetyContext {
    return {
      isPlayerIdle: this.player.planarSpeed < 0.25 && !this.player.interacting,
      isPlayerHandsEmpty: this.player.carryCount === 0,
      isTutorialDone: this.state.tutorialStep >= TUTORIAL_STEP_COUNT,
      hasActiveCrisis: false,
      goalsCompleted: this.state.goalIndex,
    };
  }

  private async trySmartBreak(): Promise<boolean> {
    if (this.adShowing) return false;
    const ctx = this.getInterstitialContext();
    if (!canShowInterstitial(ctx)) return false;

    const wasRunning = this.running;
    this.adShowing = true;
    this.audio.setSuspended(true);
    this.input.setEnabled(false);
    if (wasRunning) this.stop();
    let shown = false;
    try {
      shown = await tryInterstitial(ctx);
      return shown;
    } finally {
      this.adShowing = false;
      this.audio.setSuspended(false);
      this.input.setEnabled(true);
      if (wasRunning && !this.appHidden) this.start();
      if (shown) {
        const bonus = Math.max(50, Math.round(this.rewardIncomePerSec() * 15));
        this.state.grant(bonus);
        this.ui.toast(tr("☕ Kahve Molası İkramı +₺{0}", formatMoney(bonus)), '☕', 'good');
        bus.emit('ui:refresh', {});
      }
    }
  }

  getGoals(): UiGoal[] {
    return GOALS.map((g, i) => ({
      id: g.id,
      title: g.title,
      hint: g.hint,
      current: i < this.state.goalIndex ? g.target : i === this.state.goalIndex ? Math.min(this.goals.currentValue(), g.target) : 0,
      target: g.target,
      reward: g.reward,
      index: i,
      total: GOALS.length,
    }));
  }

  getLanguage(): Language {return getLanguage();}
  async changeLanguage(language:Language):Promise<void> {
    if(language!== 'tr' && language!=='en')return;
    this.persist();setLanguage(language);await mirrorStorage(LANGUAGE_KEY,language);await flushStorage();window.location.reload();
  }

  getDiagnostics(): {sharing:boolean; available:boolean} {return {sharing:this.telemetry.sharing,available:this.telemetry.available};}
  setDiagnosticsSharing(value:boolean):void {this.telemetry.setSharing(value);}
  exportDiagnostics():string {return this.telemetry.exportText();}
  clearDiagnostics():void {this.telemetry.clear();clearCrashDiagnostics();}

  getSettings(): UiSettings {
    const s = this.settings.all;
    return {
      muted: s.muted,
      music: s.music,
      reducedMotion: s.reducedMotion,
      lowQuality: s.lowQuality,
      haptics: s.haptics,
      paused: this.paused,
      sfxVolume: s.sfxVolume,
      musicVolume: s.musicVolume,
      fps: s.fps,
      };
  }

  setSetting(key: UiSettingFlag, value: boolean): void {
    if (key === 'paused') {
      this.paused = value;
      return;
    }
    this.settings.set(key, value);
  }

  setFps(fps: UiFpsPreference): void {
    if (fps !== 'auto' && fps !== 30 && fps !== 45 && fps !== 60) return;
    this.settings.set('fps', fps);
    this.framePacer.reset(performance.now());
    this.fpsMeter.reset();
    this.measuredFps = 0;
  }

  /**
   * Kaydırıcı ayarları. Ayrı bir kanca çünkü `setSetting` boole sözleşmesi
   * taşıyor; seviyeyi ona sıkıştırmak tip güvenliğini kaybettirirdi.
   * Ses motoruna ANINDA yazılır — kaydırırken duyulmayan bir ses ayarı
   * ayar değil tahmindir.
   */
  setVolume(kind: 'sfx' | 'music', value: number): void {
    const v = value < 0 ? 0 : value > 1 ? 1 : value;
    if (kind === 'sfx') {
      this.settings.set('sfxVolume', v);
      this.audio.setSfxVolume(v);
    } else {
      this.settings.set('musicVolume', v);
      this.audio.setMusicVolume(v);
    }
  }

  async resetProgress(): Promise<void> {
    this.persistDisabled = true;
    this.stop();
    await this.save.clear();
    clearCrashDiagnostics();
    window.location.reload();
  }

  /* ================================================================ *
   *  Günlük döngü
   * ================================================================ */

  /**
   * ÖDÜL ÇAPASI — ölçülen ₺/sn.
   *
   * Ödüller eskiden `totalEarned`'in yüzdesiydi. Üstel bir idle ekonomide
   * ömür kazancı dakikalık gelirin çok gerisinde kalır: ölçümde birinci
   * oturumun sonunda BÜTÜN sadakat katmanı ~10 dakikalık gelir ediyordu.
   *
   * Kaynak `cash_boost` ile AYNI (bkz. Game.ts cashBoostAmount): şubenin
   * kendi ölçtüğü `realizedIncome`, ölçüm oturmadıysa `estimate × 0,25`.
   * İki sistemin aynı şubeye farklı gelir biçmemesi bilinçli.
   */
  private rewardIncomePerSec(): number {
    const w = this.world;
    return w.realizedIncome > 0 ? w.realizedIncome : w.estimateIncomePerSecond() * 0.25;
  }

  getDaily(): UiDaily {
    const s = this.state;
    const inc = this.rewardIncomePerSec();
    const defs = missionsFor(s.dailyDay, s);
    const mReward = missionReward(inc);
    const missions = defs.map((m, i) => {
      const cur = missionProgress(s, m);
      return {
        glyph: m.glyph,
        title: m.title,
        current: Math.min(cur, m.target),
        target: m.target,
        reward: mReward,
        claimed: s.dailyMissionDone[i] === true,
      };
    });
    let pending = s.dailyClaimed ? 0 : 1;
    for (const m of missions) if (!m.claimed && m.current >= m.target) pending++;
    return {
      streak: s.dailyStreak,
      ladder: 7,
      claimed: s.dailyClaimed,
      reward: dailyReward(s.dailyStreak, inc),
      missions,
      pending,
    };
  }

  claimDaily(): void {
    const s = this.state;
    if (s.dailyClaimed) return;
    s.dailyClaimed = true;
    const amount = dailyReward(s.dailyStreak, this.rewardIncomePerSec());
    s.grant(amount);
    this.audio.play('cashout');
    this.ui.toast(tr("Günlük ödül alındı! +₺{0}", formatMoney(amount)), '🎁', 'good');
    bus.emit('ui:refresh', {});
    this.persist();
  }

  claimMission(index: number): void {
    const s = this.state;
    if (index < 0 || index > 2 || s.dailyMissionDone[index]) return;
    const defs = missionsFor(s.dailyDay, s);
    const m = defs[index];
    if (!m || missionProgress(s, m) < m.target) return;
    s.dailyMissionDone[index] = true;
    const amount = missionReward(this.rewardIncomePerSec());
    s.grant(amount);
    this.audio.play('goal');
    this.ui.toast(tr("Görev tamam! +₺{0}", formatMoney(amount)), m.glyph, 'good');
    bus.emit('ui:refresh', {});
    this.persist();
  }

  /* ================================================================ *
   *  v5.1 sadakat: haftalık hedef · festival · müdavim albümü · kupon
   *  (mantık sim/Daily.ts + sim/Festival.ts; alanlar GameState'te hazır)
   * ================================================================ */

  getWeekly(): UiWeekly {
    const s = this.state;
    const target = weeklyTarget(s);
    const cur = weeklyProgress(s);
    return {
      title: tr("Bu hafta {0} ürün sat", target),
      current: Math.min(cur, target),
      target,
      reward: weeklyReward(this.rewardIncomePerSec()),
      coupon: 1,
      claimed: s.weekClaimed,
      canClaim: !s.weekClaimed && cur >= target,
      daysLeft: weekDaysLeft(),
    };
  }

  claimWeekly(): void {
    const s = this.state;
    // Gece yarısı sınırı: bayat haftanın üstünden alma olmasın. Hafta tam
    // bu anda devrildiyse hedef sıfırdan başlar ve aşağıdaki kapı tutar.
    rollWeek(s);
    if (s.weekClaimed || weeklyProgress(s) < weeklyTarget(s)) return;
    s.weekClaimed = true;
    const amount = weeklyReward(this.rewardIncomePerSec());
    s.grant(amount);
    s.coupons++;
    this.audio.play('levelup');
    this.ui.toast(tr("Haftalık hedef tamam! +₺{0} ve 1 kupon", formatMoney(amount)), '🎟️', 'good');
    bus.emit('ui:refresh', {});
    this.persist();
  }

  getFestival(): UiFestival {
    const s = this.state;
    const def = currentFestival();
    const goalDef = festivalGoalDefinition(s);
    const target = festivalTarget(s, goalDef);
    const cur = festivalProgress(s, goalDef);
    return {
      id: def.id,
      title: def.title,
      short: def.short,
      glyph: def.glyph,
      desc: def.desc,
      goalTitle: festivalGoalTitle(goalDef, target),
      current: Math.min(cur, target),
      target,
      reward: festivalReward(this.rewardIncomePerSec()),
      coupon: 1,
      claimed: s.festivalClaimed,
      canClaim: !s.festivalClaimed && cur >= target,
      daysLeft: weekDaysLeft(),
    };
  }

  claimFestival(): void {
    const s = this.state;
    /**
     * claimWeekly İLE AYNI DESEN: rollWeek ÖNCE. Görev 6'dan sonra
     * festivalTarget'ın clean dalı weekPrevServed okuyor (bkz.
     * sim/Festival.ts — misafir dalı SABİT 12'ye geri alındı, artık bu
     * alana bağlı değil) ama o alanı yalnız rollWeek tazeler — rollFestival
     * ona hiç dokunmaz. Uygulama gece yarısını açıkken geçip de oyuncu
     * bir sonraki checkDaily'den ÖNCE buraya basarsa weekPrevServed bir
     * hafta bayat kalır ve hedef yanlış hesaplanır. rollWeek(s) burada da
     * çağrılınca pencere kapanır (rollWeek zaten aynı haftaysa no-op).
     */
    rollWeek(s);
    rollFestival(s);
    const def = currentFestival();
    if (s.festivalClaimed || festivalProgress(s) < festivalTarget(s)) return;
    s.festivalClaimed = true;
    const amount = festivalReward(this.rewardIncomePerSec());
    s.grant(amount);
    s.coupons++;
    this.audio.play('goal');
    this.ui.toast(tr("{0} ödülü: +₺{1} ve 1 kupon", def.title, formatMoney(amount)), def.glyph, 'good');
    bus.emit('ui:refresh', {});
    this.persist();
  }

  getAlbum(): UiAlbumRow[] {
    return [];
  }

  claimAlbum(_regularId: string): void {
    // İsimli/sabit müşteri sistemi kaldırıldı; arayüz uyumluluğu için no-op.
  }

  /** Hedefler panelinde alınmayı bekleyen her şey — hedef şeridi rozeti. */
  loyaltyPending(): number {
    const s = this.state;
    let n = this.getDaily().pending;
    if (!s.weekClaimed && weeklyProgress(s) >= weeklyTarget(s)) n++;
    if (!s.festivalClaimed && festivalProgress(s) >= festivalTarget(s)) n++;
    return n;
  }

  getCoupons(): { count: number; money: number } {
    return { count: this.state.coupons, money: this.state.money };
  }

  /**
   * 🎟️ KUPONLU KOZMETİK KÖPRÜSÜ.
   *
   * GameState.buyCosmetic tam fiyat çeker ve o dosyaya dokunulmuyor.
   * İndirim farkı önce kasaya yatırılır; satın alma tam fiyatı çekince
   * net ödeme = kuponlu fiyat olur. Başarısızlıkta fark ve kupon geri
   * alınır. Kupon yalnız GERÇEK bir satın alımda yanar: sahip olunan /
   * ücretsiz seçenekler ve kuponsuz durum normal akışa düşer.
   */
  buyCosmeticCoupon(axis: string, id: string): boolean {
    const s = this.state;
    const a = asAxis(axis);
    if (!a) return false;
    const def = cosmeticOptions(a).find((o) => o.id === id);
    if (!def || def.cost <= 0 || s.ownsCosmetic(a, id) || s.coupons <= 0) {
      return this.buyCosmetic(axis, id);
    }
    const price = couponPrice(def.cost);
    if (!s.canAfford(price)) return false;
    const discount = def.cost - price;
    s.coupons--;
    s.money += discount;
    if (!this.buyCosmetic(axis, id)) {
      s.coupons++;
      s.money -= discount;
      return false;
    }
    // buyCosmetic içindeki applyCosmetics kaydı ve arayüz tazelemeyi yaptı;
    // kupon düşümü de o kayda girdi (yukarıda, satın almadan önce).
    this.ui.toast(tr("Kupon kullanıldı: %40 indirim (−₺{0})", formatMoney(discount)), '🎟️', 'good');
    return true;
  }

  /* ---------------------------------------------------------------- *
   *  Festival etki muslukları (World.ts sim/Festival üzerinden bağlı)
   * ---------------------------------------------------------------- */

  festivalValueMultFor(item: ItemId): number {
    return festivalValueMult(item);
  }

  festivalCleanRewardMult(): number {
    return festivalCleanMult();
  }

  /* ================================================================ *
   *  Prestij
   * ================================================================ */

  getPrestige(): UiPrestige {
    const gain = prestigePointsFor(this.state.revenueEarned);
    return {
      points: this.state.prestigePoints,
      count: this.state.prestigeCount,
      gain,
      canPrestige: gain > 0,
      minEarned: PRESTIGE_MIN_EARNED,
      totalEarned: this.state.revenueEarned,
      /**
       * KADEMELİ AÇILIŞ. Devir kartı ancak eşiğe YAKLAŞINCA belirir; bir
       * kez devretmiş ya da harcanmamış puanı olan oyuncuda ise daima
       * durur (puanını harcayacak bir yer bulamamak beterdir).
       */
      visible:
        this.state.prestigeCount > 0 ||
        this.state.prestigePoints > 0 ||
        this.state.revenueEarned >= PRESTIGE_MIN_EARNED * PRESTIGE_TEASE,
      rows: PRESTIGE_UPGRADES.map((u) => {
        const level = this.state.prestigeLevels[u.id] ?? 0;
        const maxed = level >= u.maxLevel;
        const cost = prestigeUpgradeCost(u, level);
        return {
          id: u.id,
          name: u.name,
          glyph: u.glyph,
          desc: u.desc,
          level,
          maxLevel: u.maxLevel,
          cost,
          maxed,
          canBuy: !maxed && this.state.prestigePoints >= cost,
          effectText: u.format(level),
          nextText: maxed ? '' : u.format(level + 1),
        };
      }),
    };
  }

  buyPrestigeUpgrade(id: string): boolean {
    const def = PRESTIGE_MAP[id];
    if (!def) return false;
    const level = this.state.prestigeLevels[id] ?? 0;
    if (level >= def.maxLevel) return false;
    const cost = prestigeUpgradeCost(def, level);
    if (this.state.prestigePoints < cost) return false;
    this.state.prestigePoints -= cost;
    this.state.prestigeLevels[id] = level + 1;
    for (const w of this.worlds.values()) w.refreshValueBonus();
    this.audio.play('upgrade');
    this.ui.toast(`${def.name} · ${def.format(level + 1)}`, def.glyph, 'good');
    bus.emit('ui:refresh', {});
    this.persist();
    return true;
  }

  /** Devir eşiğinin aşıldığı bu oturumda duyuruldu mu. */
  private prestigeAnnounced = false;

  /**
   * Devir eşiği ilk kez aşıldığında bir kez haber verilir.
   *
   * Prestij paneline Yükseltmeler panelindeki karttan giriliyor; oyuncu o
   * panele bakmıyorsa yeni sistemin açıldığını hiç fark etmeyebilir. Uyarı
   * yalnızca HİÇ devretmemiş oyuncuya ve oturum başına bir kez çıkar —
   * bir kez devretmiş oyuncu sistemi zaten biliyor, ona hatırlatmak nag olur.
   */
  private checkPrestigeUnlock(): void {
    if (this.prestigeAnnounced || this.state.prestigeCount > 0 || !this.state.seenLocations.has('sahil')) return;
    if (!this.tutorial.finished) return;
    if (prestigePointsFor(this.state.revenueEarned) <= 0) return;
    this.prestigeAnnounced = true;
    // Toast tek satır ve taşan yazıyı kırpıyor: bu metin 375 px'de ölçüldü
    // (256 px / 274 px kullanılabilir genişlik), üç nokta ile kesilmiyor.
    this.ui.toast(tr("Sokağı devretebilirsin! Yükseltmeler’de."), '🏆', 'good');
  }

  /**
   * Sokağı devret. Kafe sıfırlanır, Fincan Puanı kalır.
   *
   * Dünyalar tamamen yeniden kurulur: istasyon seviyeleri, stok, kir ve
   * müşteriler sıfırdan başlamalı — yalnızca `state` sıfırlamak eski
   * dünyaların üstünde tutarsız bir durum bırakırdı.
   */
  doPrestige(): boolean {
    const gain = prestigePointsFor(this.state.revenueEarned);
    if (gain <= 0) return false;

    this.state.prestigeReset(gain);

    /**
     * Robot devirde ölür. Dünyalar birazdan tamamen yeniden kurulacak;
     * eski dünyanın köküne bağlı bir mesh'i yaşatmak sızıntı olurdu.
     */
    this.robot?.dispose();
    this.robot = null;
    this.robotLeft = 0;
    this.ui.hideEvent(ROBOT_BANNER);

    for (const w of this.worlds.values()) {
      this.scene3d.scene.remove(w.root);
      w.dispose?.();
    }
    this.worlds.clear();
    this.createWorld('kose', undefined);
    const active = this.worlds.get('kose')!;
    this.world = active;
    this.player.setPosition(active.loc.playerStart.x, active.loc.playerStart.z);
    this.applyPlayerStats();
    this.activateWorld(active, false);
    for (const w of this.worlds.values()) {
      w.syncStaff();
      w.refreshAutomation();
      w.refreshValueBonus();
    }
    /**
     * Eski izleyici DISPOSE EDİLMEDEN yenisi kurulursa bus abonelikleri
     * yaşamaya devam eder: her devirden sonra üretim/satış olayları bir kez
     * fazla sayılır ("25 latte" hedefi 13 lattede biter) ve closure'lar
     * birikimli sızıntı yapar.
     */
    this.goals.dispose();
    this.goals = new GoalTracker(this.state);
    this.events.reset();
    this.persist();

    this.ui.celebrate(tr("SOKAK DEVREDİLDİ"), tr("+{0} ☕ Fincan Puanı", gain), '🏆');
    this.audio.play('levelup');
    bus.emit('ui:refresh', {});
    return true;
  }

  /* ================================================================ *
   *  Dekorasyon (bkz. data/cosmetics.ts)
   *
   *  Bu blokta tek bir istatistik okunmaz/yazılmaz: kozmetikler oyunun
   *  hiçbir sayısına dokunmaz. Yaptığı tek şey `state.cosmetics`'i
   *  değiştirip AÇIK OLAN bütün şubelere görünümü uygulatmak.
   * ================================================================ */

  getCosmetics(): UiCosmeticAxis[] {
    return COSMETIC_AXIS_DEFS.map((axis) => ({
      id: axis.id,
      name: axis.name,
      glyph: axis.glyph,
      desc: axis.desc,
      options: cosmeticOptions(axis.id).map((o) => {
        const owned = this.state.ownsCosmetic(axis.id, o.id);
        return {
          id: o.id,
          name: o.name,
          desc: o.desc,
          cost: o.cost,
          swatch: o.swatch.map(cssHex),
          owned,
          selected: this.state.cosmetics[axis.id] === o.id,
          previewed: this.cosmeticPreview[axis.id] === o.id,
          affordable: owned || this.state.canAfford(o.cost),
        };
      }),
    }));
  }

  previewCosmetic(axis: string, id: string): boolean {
    const a = asAxis(axis);
    if (!a || !cosmeticOptions(a).some(option => option.id === id)) return false;
    this.cosmeticPreview[a] = id;
    this.renderCosmetics();
    bus.emit('ui:refresh', {});
    return true;
  }

  cancelCosmeticPreview(): void {
    if (!Object.keys(this.cosmeticPreview).length) return;
    this.cosmeticPreview = {};
    this.renderCosmetics();
  }

  buyCosmetic(axis: string, id: string): boolean {
    const a = asAxis(axis);
    if (!a || !this.state.buyCosmetic(a, id)) return false;
    delete this.cosmeticPreview[a];
    this.applyCosmetics();
    return true;
  }

  selectCosmetic(axis: string, id: string): boolean {
    const a = asAxis(axis);
    if (!a || !this.state.selectCosmetic(a, id)) return false;
    delete this.cosmeticPreview[a];
    this.applyCosmetics();
    return true;
  }

  cosmeticProgress(): { owned: number; total: number } {
    let owned = 0;
    let total = 0;
    for (const axis of COSMETIC_AXIS_DEFS) {
      for (const o of cosmeticOptions(axis.id)) {
        total++;
        if (this.state.ownsCosmetic(axis.id, o.id)) owned++;
      }
    }
    return { owned, total };
  }

  /**
   * Görünümü BÜTÜN şubelere uygular — yalnız aktif olana değil. Oyuncu
   * "kafemin rengi" diye düşünür, "Köşe'nin rengi" diye değil; ikinci
   * şubeye geçince eski görünümü bulmak seçimin sahiplik hissini bozardı.
   * Kayıt hemen yazılır: bu satın alma da bir ilerleme.
   */
  private renderCosmetics(): void {
    const selection = { ...this.state.cosmetics, ...this.cosmeticPreview };
    for (const w of this.worlds.values()) w.applyCosmetics(selection);
    this.scene3d.invalidateStatic();
    this.scene3d.invalidateShadows();
    this.forceRender = true;
  }

  private applyCosmetics(): void {
    this.renderCosmetics();
    this.persist();
    bus.emit('ui:refresh', {});
  }

  /**
   * Kaydı dışa aktarmadan ÖNCE mevcut durumu yazar; oyuncu son 6 saniyelik
   * ilerlemesini kaybetmiş bir yedek almasın.
   */
  exportSave(): string | null {
    this.persist();
    return this.save.exportText();
  }

  async importSave(text: string): Promise<boolean> {
    if (!this.save.importText(text)) return false;
    // İçe aktarılan kayıt diskteki hâliyle yüklensin: mevcut oturum onu
    // ezmeden önce yazma kapatılır ve sayfa yeniden başlatılır.
    this.persistDisabled = true;
    this.stop();
    await flushStorage();
    window.location.reload();
    return true;
  }

  /* ================================================================ *
   *  Ödüllü reklam kancaları (bkz. core/Ads.ts)
   *
   *  İki kural burada da geçerli:
   *   1. Reklam ASLA kapı değildir. Her iki teklif de yalnız hızlandırıcı;
   *      izlemeyen oyuncu aynı içeriğe aynı hızda ulaşır.
   *   2. Sağlayıcı yokken (bugünkü varsayılan) `adReady` daima false döner,
   *      dolayısıyla arayüzde tek bir reklam öğesi bile çizilmez.
   * ================================================================ */

  /**
   * TEKLİFLER İSTEK ANINA BAĞLIDIR.
   *
   * Her yerleşimin `ready` koşulu yalnız "reklam envanteri var mı" değil,
   * "oyuncu şu an bunu İSTER Mİ" sorusunu da içerir. Doğru an, ödülün
   * kendisinden daha önemlidir: her zaman ekranda duran bir teklif teklif
   * körlüğü yaratır ve gönüllü izlenme oranını düşürür.
   */
  getAdOffers(): UiAdOffers {
    const activeOffer = this.world.getActiveAdZone();
    const zone = activeOffer ? activeOffer.zone : this.world.nextLockedZone();
    /**
     * `zone_finish` yalnız ödemenin ÇOĞU yapılmışken belirir.
     * Eşiksiz hâli "bölümü reklamla satın al" demek olurdu ve reklam bir
     * kapıya dönüşürdü; burada satılan şey ilerleme değil SON ADIMIN
     * beklemesi (bkz. Ads.ZONE_FINISH_MIN_PAID).
     */
    const paidRatio = zone && zone.cost > 0 ? this.world.padPaid(zone.id) / zone.cost : 0;
    /** Robot ancak ortalık gerçekten kirliyken anlamlı. */
    const kirli = this.world.grime.heavyCoverage > 0.08 || this.world.spills.list.length >= 3;
    /**
     * Depolar dolu ise "doldur" ödülü sıfır değer taşır — hatta zararlıdır:
     * izlenip hiçbir şey değiştirmeyen bir reklam, sonraki tekliflere olan
     * güveni de yakar. İlk eşik "herhangi bir makine yarıdan boş" idi ve
     * ölçümde teklifi neredeyse hep açık tutuyordu (toplam 143 → 148,
     * yani kazanç yok). Ölçü artık TOPLAM doluluk.
     */
    const acik = this.world.machines.filter((m) => !m.locked);
    const doluluk = acik.length
      ? acik.reduce((a, m) => a + m.output, 0) / Math.max(1, acik.reduce((a, m) => a + m.outputCap, 0))
      : 1;
    const bosDepo = doluluk < 0.6;
    const s = this.state;
    return {
      happyHour: {
        ready: this.happyLeft < HAPPY_HOUR_MAX_SECONDS && adReady('happy_hour'),
        text: tr("{0} dakika boyunca bütün kazancın ×{1}", Math.round(HAPPY_HOUR_STEP_SECONDS / 60), HAPPY_HOUR_MULT),
      },
      zoneFinish: {
        ready: ((activeOffer !== null) || (zone !== null && zone.cost - this.world.padPaid(zone.id) > 0.01 && paidRatio >= ZONE_FINISH_MIN_PAID)) && adReady('zone_finish'),
        text: activeOffer
          ? (activeOffer.tier === 'finish'
            ? tr("“{0}” bölümünün kalan ödemesi kapansın", activeOffer.zone.name)
            : tr("“{0}” bölümünün %50 ödemesi tamamlansın", activeOffer.zone.name))
          : (zone ? tr("“{0}” bölümünün kalan ödemesi kapansın", zone.name) : ''),
      },
      robotVacuum: {
        ready: this.robotLeft <= 0 && kirli && adReady('robot_vacuum'),
        text: tr("{0} dakika boyunca zemini robot süpürsün", Math.round(ROBOT_SECONDS / 60)),
      },
      stockRefill: {
        ready: bosDepo && adReady('stock_refill'),
        text: tr("Bütün makine depoları anında dolsun"),
      },
      dailyDouble: {
        // Yalnız ödül HENÜZ ALINMAMIŞKEN: alınmış bir ödülü ikiye katlamak
        // geriye dönük bir vaat olurdu.
        ready: !s.dailyClaimed && adReady('daily_double'),
        text: tr("Günlük ödülün ×{0} olsun", DAILY_DOUBLE_MULT),
      },
      /* ── v5.1 yerleşimleri (yalnız çip yoluyla görünürler) ────────── */
      cashBoost: {
        /**
         * Yalnız ödeme bandında (%60-90): altında teklif "ilerlemeyi satmak"
         * olurdu, üstünde doğru teklif zaten zone_finish. Kaynak zone_finish
         * ile AYNI ped/oran hesabı — iki teklif aynı gerçeği okusun.
         */
        ready:
          zone !== null &&
          paidRatio >= CASH_BOOST_MIN_PAID &&
          paidRatio <= CASH_BOOST_MAX_PAID &&
          adReady('cash_boost'),
        text: tr("Kasana anında +₺{0} girsin", formatMoney(this.cashBoostAmount())),
      },
      ustaMode: {
        // Kuyruk gerçekten kabarıkken: boş kafede "her makinede el ver"
        // bonusu hiçbir şey hızlandırmaz, teklif değersizleşirdi.
        ready: this.ustaLeft <= 0 && this.world.queueTotal() >= USTA_MIN_QUEUE && adReady('usta_mode'),
        // Metin kodla eşit: USTA_SPEED_MULT 1,25 (ondalık virgülle yazılır).
        text: tr("{0} dakika: el ver bonusu bütün makinelerde + hız ×1,25", Math.round(USTA_SECONDS / 60)),
      },
      rushHour: {
        // Raflar doluyken: üretim satıştan hızlıysa ekstra müşteri gerçek
        // değerdir; boş rafla akın müşteri küstürür, ödül cezaya dönerdi.
        ready: this.rushLeft <= 0 && this.world.shelfFillRatio() >= RUSH_HOUR_MIN_SHELF && adReady('rush_hour'),
        text: tr("{0} saniye: müşteri akışı ×1,6 · sabır ×1,2", RUSH_HOUR_SECONDS),
      },
      repairShield: {
        // Yalnız GERÇEK bir arıza varken; sigorta sürerken tekrar satmak
        // "sürerken ikinci reklam" tuzağına girerdi (bkz. happyHour notu).
        ready:
          this.events.isActive('breakdown') && this.events.breakdownShieldLeft <= 0 && adReady('repair_shield'),
        text: tr("Arıza anında tamir olsun + {0} dakika arıza bağışıklığı", Math.round(REPAIR_SHIELD_SECONDS / 60)),
      },
      tipRain: {
        // VIP salon (r2 veya p5) açıkken: masa servisi ekonominin görünür bir kolu
        // olmadan bahşiş çarpanı soyut bir sayı olarak kalırdı.
        ready: this.tipLeft <= 0 && (this.world.zoneUnlocked('r2') || this.world.zoneUnlocked('p5')) && adReady('tip_rain'),
        text: tr("{0} dakika boyunca masa bahşişleri ×{1}", Math.round(TIP_RAIN_SECONDS / 60), TIP_RAIN_MULT),
      },
      investor: {
        ready: this.world.hasInvestor() && adReady('investor'),
        text: tr("Yatırımcıdan +₺{0} nakit destek al", formatMoney(this.investorCashAmount())),
      },
      freeUpgrade: {
        ready: this.freeUpgradeCooldown <= 0 && adReady('free_upgrade'),
        cooldown: Math.ceil(this.freeUpgradeCooldown),
      },
    };
  }

  /**
   * Zengin Yatırımcı VIP nakit desteği tutarı — cash_boost'un en az 1.5 katı
   * veya sıradaki kilitli alanın kalan maliyetinin %55'i (cash_boost × 3.2 tavanlı).
   */
  private investorCashAmount(): number {
    const mult = BALANCE.events.investorCashMultiplier ?? 1.5;
    const base = this.cashBoostAmount();
    const z = this.world.nextLockedZone();
    const rem = z ? Math.max(0, z.cost - this.world.padPaid(z.id)) : 0;
    return Math.max(1000, Math.min(Math.round(base * 3.2), Math.max(Math.round(base * mult), Math.round(rem * 0.55))));
  }

  private investorOfferActive = false;
  private handleInvestorProximity(inv: Customer): void {
    if (this.investorOfferActive || this.adRewardInFlight || this.adShowing) return;
    this.investorOfferActive = true;
    const amount = this.investorCashAmount();
    this.ui.showAdChip(
      'investor',
      '💰',
      tr("Zengin Yatırımcı"),
      tr("Kafene +₺{0} teklif ediyor!", formatCompactMoney(amount)),
    );
    this.ui.setAdChipProgress(1);
    this.adChipLife = 14;
    this.adChipMaxLife = 14;
    this.audio.play('coin');
    this.vfx?.sparkle(inv.x, 1.8, inv.z, 0xffc84a);
    setTimeout(() => {
      this.investorOfferActive = false;
    }, 15000);
  }

  /**
   * `cash_boost` ödül tutarı — ~90 sn ölçülen gelire denk nakit, taban ₺400.
   *
   * Kaynak şubenin KENDİ ölçtüğü ₺/sn (`realizedIncome`); ölçüm henüz
   * oturmadıysa `abstractService` ile aynı geri düşüş (estimate × 0,25)
   * kullanılır — iki sistem aynı şubeye farklı gelir biçmesin. Teklif
   * metni ve ödeme anı aynı fonksiyonu çağırır; küçük sapma (reklam
   * izlenirken gelirin oynaması) kabul edilir, vaat büyüklük sınıfıdır.
   */
  private cashBoostAmount(): number {
    const w = this.world;
    const inc = w.realizedIncome > 0 ? w.realizedIncome : w.estimateIncomePerSecond() * 0.25;
    return Math.max(CASH_BOOST_FLOOR, Math.round(inc * CASH_BOOST_INCOME_SECONDS));
  }

  /**
   * Ödüllü reklamı göster; GÖSTERİLEMEDİYSE oyuncuya söyle.
   *
   * Eski davranış sessiz başarısızlıktı: çip UIRoot'ta çoktan gizlenmiş
   * oluyor, İZLE'ye basan oyuncu hiçbir şeyin olmadığını görüyordu —
   * "reklam sistemi bozuk" izleniminin ta kendisi. Şimdi kısa bir
   * açıklama çıkar ve bir sonraki teklif yakına (30 sn) çekilir; sağlayıcı
   * bu arada yuvayı yeniden doldurur (bkz. AdMobProvider yükleme zinciri).
   */
  private adShowing = false;
  private lastOfflineSeconds = 0;
  private lastOfflineCash = 0;
  private adRewardInFlight = false;

  private async showRewardedOrExplain(p: UiAdRewardKind): Promise<boolean> {
    const wasRunning = this.running;
    this.adShowing = true;
    this.audio.setSuspended(true);
    this.input.setEnabled(false);
    if (wasRunning) this.stop();
    try {
      if (await showRewarded(p)) return true;
      this.ui.toast(tr("Reklam şu an hazır değil"), '📺', 'info');
      this.adChipTimer = 30;
      return false;
    } finally {
      this.adShowing = false;
      this.audio.setSuspended(false);
      this.input.setEnabled(true);
      if (wasRunning && !this.appHidden) this.start();
    }
  }

  async watchAd(kind: UiAdRewardKind): Promise<boolean> {
    if(this.adRewardInFlight)return false;
    this.adRewardInFlight=true;
    this.telemetry.record('ad_requested',{placement:kind});
    let rewarded=false;
    try {rewarded=await this.applyAdReward(kind);return rewarded;}
    finally {this.adRewardInFlight=false;this.telemetry.record('ad_result',{placement:kind,rewarded});}
  }

  private async applyAdReward(kind: UiAdRewardKind): Promise<boolean> {
    if (kind === 'happy_hour') {
      if (this.happyLeft >= HAPPY_HOUR_MAX_SECONDS) return false;
      if (!(await this.showRewardedOrExplain('happy_hour'))) return false;
      const wasActive = this.happyLeft > 0;
      this.happyLeft = Math.min(HAPPY_HOUR_MAX_SECONDS, this.happyLeft + HAPPY_HOUR_STEP_SECONDS);
      this.audio.play('levelup');
      if (wasActive) {
        this.ui.toast(
          tr("Mutlu Saat +{0} dk uzatıldı! ({1})", Math.round(HAPPY_HOUR_STEP_SECONDS / 60), formatDuration(this.happyLeft)),
          '🎉',
          'good',
        );
      } else {
        this.ui.toast(tr("Mutlu Saat başladı — kazancın ×{0}!", HAPPY_HOUR_MULT), '🎉', 'good');
      }
      bus.emit('ui:refresh', {});
      return true;
    }

    if (kind === 'robot_vacuum') {
      if (this.robotLeft > 0) return false;
      if (!(await this.showRewardedOrExplain('robot_vacuum'))) return false;
      this.robotLeft = ROBOT_SECONDS;
      this.robot?.dispose();
      this.robot = new RobotVacuum(this.world);
      this.audio.play('levelup');
      this.ui.toast(tr("Süpürge robotu işbaşında!"), '🤖', 'good');
      bus.emit('ui:refresh', {});
      return true;
    }

    if (kind === 'stock_refill') {
      if (!(await this.showRewardedOrExplain('stock_refill'))) return false;
      /**
       * Depoları doldurmak için offline stok yolu yeniden kullanılır:
       * aynı tavanları ve aynı `theoreticalRate` hesabını kullanır, yani
       * "reklamla dolan depo" ile "yokken dolan depo" arasında hiçbir
       * tutarsızlık kalmaz. Süre olarak tavan (7200 sn) verilir; fonksiyon
       * zaten `outputCap` ile sınırlar.
       */
      applyOfflineStock(7200, [this.world], this.state.prestigeOfflineMult);
      this.audio.play('levelup');
      this.ui.toast(tr("Bütün depolar doldu!"), '📦', 'good');
      bus.emit('ui:refresh', {});
      this.persist();
      return true;
    }

    if (kind === 'daily_double') {
      const s = this.state;
      if (s.dailyClaimed) return false;
      if (!(await this.showRewardedOrExplain('daily_double')) || s.dailyClaimed) return false;
      s.dailyClaimed = true;
      const amount = dailyReward(s.dailyStreak, this.rewardIncomePerSec()) * DAILY_DOUBLE_MULT;
      s.grant(amount);
      this.audio.play('cashout');
      this.ui.toast(tr("Günlük ödül ×{0}! +₺{1}", DAILY_DOUBLE_MULT, formatMoney(amount)), '🎁', 'good');
      bus.emit('ui:refresh', {});
      this.persist();
      return true;
    }

    /* ── v5.1 yerleşimleri ─────────────────────────────────────────── */

    if (kind === 'cash_boost') {
      /* Tutar reklamdan ÖNCE sabitlenir: teklifte görülen vaat, izleme
       * sırasında gelir oynasa da tutulur. */
      const amount = this.cashBoostAmount();
      if (!(await this.showRewardedOrExplain('cash_boost'))) return false;
      this.state.grant(amount);
      this.audio.play('goal');
      this.ui.toast(tr("+₺{0} — nakit desteği!", formatMoney(amount)), '💰', 'good');
      bus.emit('ui:refresh', {});
      this.persist();
      return true;
    }

    if (kind === 'usta_mode') {
      if (this.ustaLeft > 0) return false;
      if (!(await this.showRewardedOrExplain('usta_mode'))) return false;
      this.ustaLeft = USTA_SECONDS;
      // tickMods bayrağı zaten her kare yazar; ödül ilk kareyi beklemesin.
      this.world.ustaMode = true;
      this.applyPlayerStats();
      this.audio.play('goal');
      this.ui.toast(tr('Usta modu! El ver bonusu her makinede.'), '🛠️', 'good');
      bus.emit('ui:refresh', {});
      return true;
    }

    if (kind === 'rush_hour') {
      if (this.rushLeft > 0) return false;
      if (!(await this.showRewardedOrExplain('rush_hour'))) return false;
      this.rushLeft = RUSH_HOUR_SECONDS;
      this.audio.play('goal');
      this.ui.toast(tr("Müşteri akını başladı!"), '🙌', 'good');
      bus.emit('ui:refresh', {});
      return true;
    }

    if (kind === 'repair_shield') {
      if (!(await this.showRewardedOrExplain('repair_shield'))) return false;
      /* Tamir + sigorta TEK ödüldür: arıza reklam sırasında usta eliyle
       * bittiyse bile (fixBreakdown false döner) sigorta yine kurulur —
       * izlenen reklam asla boşa gitmez. */
      const fixed = this.events.fixBreakdown();
      this.events.setBreakdownShield(REPAIR_SHIELD_SECONDS);
      const dk = Math.round(REPAIR_SHIELD_SECONDS / 60);
      this.audio.play('goal');
      this.ui.toast(
        fixed ? tr("Makine tamir edildi — {0} dakika arıza yok!", dk) : tr("{0} dakika boyunca arıza yok!", dk),
        '🛡️',
        'good',
      );
      bus.emit('ui:refresh', {});
      return true;
    }

    if (kind === 'tip_rain') {
      if (this.tipLeft > 0) return false;
      if (!(await this.showRewardedOrExplain('tip_rain'))) return false;
      this.tipLeft = TIP_RAIN_SECONDS;
      this.audio.play('goal');
      this.ui.toast(tr("Bahşiş yağmuru — masa bahşişleri ×{0}!", TIP_RAIN_MULT), '💸', 'good');
      return true;
    }

    if (kind === 'investor') {
      const amount = this.investorCashAmount();
      if (!(await this.showRewardedOrExplain('investor'))) return false;
      this.state.grant(amount);
      this.audio.play('cashout');
      this.audio.play('goal');
      this.vfx?.coinBurst(this.player.x, 1.5, this.player.z, 24);
      this.vfx?.ring(this.player.x, 0.2, this.player.z, 0xd4af37, 2.8);
      this.ui.toast(tr("Yatırımcıdan +₺{0} nakit destek!", formatMoney(amount)), '💰', 'good');
      this.world.dismissInvestor(true);
      this.events.endEvent('investor', this.world);
      this.ui.hideAdChip();
      bus.emit('ui:refresh', {});
      this.persist();
      return true;
    }

    /**
     * DÖNÜŞ SATIŞI — çipte asla görünmez; tek giriş dönüş modalındaki
     * buton (bkz. UIRoot.showOffline). Satılan şey oyuncunun kendi
     * ürettiği stok; kazanç normal satış yolundan (sellStockShare →
     * state.earn) akar, yani çarpanlar ve ölçümlerle tutarlıdır.
     */
    if (kind === 'comeback_sale') {
      if (this.world.stockTotal() < COMEBACK_MIN_STOCK && this.lastOfflineCash <= 0) return false;
      const mult = this.lastOfflineSeconds >= BALANCE.offline.longOfflineThresholdSeconds
        ? BALANCE.offline.rewardedLongOfflineMultiplier
        : BALANCE.offline.rewardedMultiplier;
      if (!(await this.showRewardedOrExplain('comeback_sale'))) return false;
      const stockEarned = this.world.stockTotal() > 0 ? this.world.sellStockShare(COMEBACK_SHARE, mult) : 0;
      const shiftBonus = this.lastOfflineCash > 0 ? Math.round(this.lastOfflineCash * Math.max(0, mult - 1)) : 0;
      if (shiftBonus > 0) {
        this.state.earn(shiftBonus);
        this.lastOfflineCash = 0;
      }
      const earned = stockEarned + shiftBonus;
      this.audio.play('goal');
      this.ui.toast(tr("+₺{0} — dönüş satışı (×{1})!", formatMoney(earned), mult), '📦', 'good');
      bus.emit('ui:refresh', {});
      this.persist();
      return true;
    }

    const activeOffer = this.world.getActiveAdZone();
    const zone = activeOffer ? activeOffer.zone : this.world.nextLockedZone();
    if (!zone) return false;
    const paid = this.world.padPaid(zone.id);
    const remaining = Math.max(0, zone.cost - paid);
    if (remaining <= 0.01) return false;
    if (!activeOffer && (paid / Math.max(1, zone.cost) < ZONE_FINISH_MIN_PAID)) return false;

    if (!(await this.showRewardedOrExplain('zone_finish'))) return false;

    if (remaining <= zone.cost * 0.5) {
      this.world.unlockZone(zone.id, 'pad');
      this.audio.play('levelup');
      this.ui.toast(tr("“{0}” reklamla açıldı!", zone.name), '🎉', 'good');
    } else {
      const pay50 = zone.cost * 0.5;
      this.world.payZoneAd(zone.id, pay50);
      this.audio.play('levelup');
      this.ui.toast(tr("“{0}” ödemesinin %50’si tamamlandı!", zone.name), '📺', 'good');
    }
    bus.emit('ui:refresh', {});
    this.persist();
    return true;
  }

  /**
   * KAYITTAN BUFF GERİ YÜKLEME — "bilinen açık" kapanır: uygulama tam
   * kapanınca satın alınmış süreli ödüller buharlaşıyordu. `state.adBuffs`
   * her kare tickMods'ta yazılır (tek yazıcı), burada tek seferlik okunur.
   *
   * Robot yeniden YARATILIR: kayda mesh değil yalnız süre girer; canlı
   * örnek watchAd('robot_vacuum') ile aynı yoldan kurulur. Sigorta süresi
   * Events'e devredilir, usta modu hız çarpanı applyPlayerStats ile döner.
   * Bantlar ayrıca kurulmaz — updateUiFrame kalan süresi olan her buffın
   * bandını zaten her kare gösterir.
   */
  private restoreAdBuffs(): void {
    const ab = this.state.adBuffs;
    this.happyLeft = Math.max(0, ab.happy ?? 0);
    this.robotLeft = Math.max(0, ab.robot ?? 0);
    this.ustaLeft = Math.max(0, ab.usta ?? 0);
    this.rushLeft = Math.max(0, ab.rush ?? 0);
    this.tipLeft = Math.max(0, ab.tip ?? 0);
    const shield = Math.max(0, ab.shield ?? 0);
    if (shield > 0) this.events.setBreakdownShield(shield);
    if (this.robotLeft > 0) {
      this.robot?.dispose();
      this.robot = new RobotVacuum(this.world);
    }
    if (this.ustaLeft > 0) this.applyPlayerStats();
  }

  skipTutorial(): void {
    this.tutorial.skip();
  }

  dismissOnboarding(kind: 'upgrade' | 'staff'): void {
    if (kind === 'upgrade') this.state.upgradeOnboarded = true;
    else this.state.staffOnboarded = true;
    this.persist();
    bus.emit('ui:refresh', {});
  }

  formatMoney(v: number): string {
    return formatMoney(v);
  }

  itemInfo(id: ItemId): { name: string; glyph: string; color: number } {
    const it = ITEMS[id];
    return { name: it.name, glyph: it.glyph, color: it.color };
  }

  /* ================================================================ */

  dispose(): void {
    this.telemetry?.dispose();
    this.stop();
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
    this.goals.dispose();
    this.tutorial.dispose();
    this.events.dispose();
    for (const w of this.worlds.values()) w.dispose();
    this.worlds.clear();
    this.player.dispose();
    this.vfx.dispose();
    this.ui.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.scene3d.dispose();
    disposeCustomerIcons();
  }
}

const TIER_LABEL: Record<QualityTier, string> = {
  high: tr("Yüksek"),
  medium: tr("Orta"),
  low: tr("Düşük"),
};

/** Mutlu Saat bandının kimliği — HUD olay bandıyla aynı yolu kullanır. */
const HAPPY_BANNER = 'happy_hour';
const ROBOT_BANNER = 'robot_vacuum';
/* v5.1 buff bantları. Kaos olayı 'rush' ile çakışmasın diye 'rush_hour'
 * (ikisi aynı anda ekranda olabilir ve ayrı bantlardır). */
const USTA_BANNER = 'usta_mode';
const RUSH_BANNER = 'rush_hour';
const TIP_BANNER = 'tip_rain';

/**
 * Devir kartının "ufukta belirme" eşiği: ömür kazancı, devir sınırının
 * %70'ine geldiğinde kart görünür olur. Tam eşikte belirmesi sistemi
 * sürpriz yapardı; çok erken belirmesi yeni oyuncuyu korkuturdu.
 */
const PRESTIGE_TEASE = 0.7;

const DEPT_NAMES: Record<string, string> = {
  bar: 'Bar',
  salon: tr("Salon"),
  servis: tr("Servis"),
};

function stationGlyph(kind: string, item: ItemId | undefined): string {
  switch (kind) {
    case 'table':
      return '🪑';
    case 'bin':
      return '🗑️';
    case 'toilet':
      return '🚻';
    case 'counter':
      return '🧾';
    case 'display':
      return item ? ITEMS[item].glyph : '🥐';
    default:
      return item ? ITEMS[item].glyph : '☕';
  }
}

function staffEffectText(role: StaffRole, level: number, shelfCapacity: number): string {
  const fmt = (n: number) => formatDecimal(n, 2, getLanguage() === 'en' ? 'en-US' : 'tr-TR');
  switch (role) {
    case 'waiter':
      return tr("Hız {0} · taşıma {1} adet · raf hedefi en çok {2}", fmt(waiterSpeed(level)), waiterCapacity(level), waiterShelfTarget(level, shelfCapacity));
    case 'cashier':
      return tr("Temel {0} sn/sipariş · kasa yükseltmesi ayrıca hızlandırır", fmt(cashierOrderTime(level)));
    case 'barista':
      return tr("Hazırlık ×{0}", fmt(baristaBoost(level)));
    case 'busser':
      return tr("{0} sn/iş · {1} bulaşık", fmt(busserWorkTime(level)), busserCapacity(level));
    default:
      return '';
  }
}
