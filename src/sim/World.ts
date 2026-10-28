import { separateCrowd } from './CrowdSeparation';
import { arrivalPressure, checkoutQueueLimit } from './ArrivalPacing';
import { SideActivities, type SideActivitiesSave, type SideActivityCompletion } from './SideActivities';
import { SIDE_ACTIVITY_DEFS, SIDE_ACTIVITY_IDS, type SideActivityId } from '../data/sideActivities';
import { SIDE_GARDEN_LAYOUT, sideGardenObstacles, sideGardenGate } from '../data/sideGardenLayout';
import { createSideActivityView } from '../world/SideActivityView';
import type { UiSideActivityRow } from '../ui/api';
import { MOP_FORWARD } from '../world/FloorMop';
import { tr, localeTag } from "../core/I18n";
import * as THREE from 'three';
import { VisibilityRoot } from '../world/VisibilityRoot';
import {seatAngle,seatRadius,CHAIR_BODY,CHAIR_SIT} from '../data/seating';
import { ITEMS, isProduct, isSupply, type ItemId } from '../data/items';
import { decorHalf, floorLiftAt, locationDef, roomDoorPlugs, roomWalls, type LocationDef, type ZoneDef } from '../data/layouts';
import { STATION_BODY, stationsOfLocation } from '../data/stations';
import { syncRenderMembership } from '../world/RenderMembership';
import { BALANCE, clampCustomerWalkSpeed } from '../data/balance';
import type { GoalDef } from '../data/goals';
import type { CustomerAngerReason } from '../data/customerFeedback';
import { advanceApproachArrival, advancePickupArrival } from './customerArrival';
import {
  CUSTOMER_ARCHETYPES,
  DASHER_ARCHETYPE,
  INFLUENCER_ARCHETYPE,
  INVESTOR_ARCHETYPE,
  pickArchetype,
} from '../data/customers';
import { STAFF_ROLE_MAP, baristaBoost, busserWorkTime, waiterShelfTarget, waiterSpeed, type StaffRole } from '../data/staff';
import { STATION_CAP_MAX, STATION_SPEED_MAX, stationSpeedMult } from '../data/upgrades';
import { bus, haptic, sfx } from '../core/EventBus';
import { QUALITY } from '../core/Quality';
import { Rng } from '../core/Rng';
import { clamp, clamp01, dist, formatCompactMoney } from '../core/MathUtils';
import { NavGrid } from './Navigation';
import { StationEntity, type StationSave } from './Station';
import { Order, type OrderLine } from './Orders';
import { festivalCleanMult, festivalValueMult } from './Festival';
import { todayKey } from './Daily';
import {
  FOUND_CHANGE_CHANCE,
  FOUND_CHANGE_DAILY_CAP,
  FOUND_CHANGE_GAP,
  foundChangeAmount,
  foundChangeRoll,
} from './FoundChange';
import { TUTORIAL_STEP_COUNT } from './Tutorial';
import { SpillField, type SpillSave } from './Spills';
import { GrimeField, type GrimeSave } from './Grime';
import type { GameState } from './GameState';
import { Customer } from '../entities/Customer';
import { Staff } from '../entities/Staff';
import type { Player } from '../entities/Player';
import { ZONE_PURCHASE_HALF } from '../world/ZonePurchasePad';
import { createHeldVacuum, createStationVisual, setTableSkin, type StationVisual } from '../world/StationView';
import { floorSkin, tableSkin, wallSkin } from '../data/cosmetics';
import { ContactShadows } from '../world/ContactShadows';
import { createGuideMarker, type GuideMarker, type GuideTarget } from '../world/GuideMarker';
import { createArmRing, type ArmRing } from '../world/ArmRing';
import { createPickupVisual, type PickupVisual } from '../world/PickupView';
import { createEnvironment, type EnvironmentView } from '../world/Environment';
import { createSpillView, type SpillView } from '../world/SpillView';
import { createGrimeView, type GrimeView } from '../world/GrimeView';
import type { VFXSystem } from '../world/VFX';
import { markDynamic } from '../world/layers';
import { CHAR_CULL_RADIUS, CHAR_CULL_Y, extractCullPlanes, pointInView, sphereHitsFrustum, type CullPlane } from '../world/viewCull';
import { createGroundShadowBatch, type GroundShadowBatch } from '../world/GroundShadow';
import { createStaffHirePad, STAFF_HIRE_PAD_HALF, type StaffHirePad } from '../world/StaffHirePad';
import { RESTROOM_SUITE, TOILET_LAYOUT, canVisitRestroom, restroomPoint, restroomUseFee } from '../data/restrooms';

const _pt = { x: 0, z: 0 };
const _seat = { x: 0, y: 0, z: 0 };
/**
 * Gösterici yazısı kameraya döner. Sim katmanı kamerayı bilmez; Game her
 * kare `World.setCameraQuat()` ile buraya yazar.
 */
const GUIDE_QUAT = new THREE.Quaternion();
const STAFF_HIRE_BENEFITS: Record<StaffRole, string> = {
  cashier: 'Siparişleri alır', waiter: 'Boş raflara ürün koyar',
  busser: 'Kirli masaları hazırlar', barista: 'Üretimi hızlandırır',
};
const _v3 = new THREE.Vector3();
const _ray = new THREE.Vector3();
const _caster = new THREE.Raycaster();
const _frustum = new THREE.Frustum();
const _projScreen = new THREE.Matrix4();
const _stationPoint = new THREE.Vector3();
const SEAT_HEIGHT = 0.5;

export interface EventModifiers {
  spawnMult: number;
  valueMult: number;
  /** v5.1 — sabır çarpanı (rush_hour reklam ödülü ×1,2 vb.). 1 = etkisiz. */
  patienceMult: number;
  /** v5.1 — masa bahşişi çarpanı (tip_rain reklam ödülü ×3). 1 = etkisiz. */
  tipMult: number;
}

/** Gerçekleşen gelir ölçümünün unutma zaman sabiti (saniye). */
const REVENUE_TAU = 240;

/**
 * ÖLÇÜLEREK GÜVENLİ BULUNMUŞ DAR BOŞLUKLAR.
 *
 * Doğrulayıcı geometriye bakar, NİYETE bakmaz: dar bir boşluk ancak
 * birinin oradan GEÇMESİ gerekiyorsa sorundur. Aşağıdaki üç çift duvara
 * ya da masaya sokulmuş demirbaşların KÖR tarafındadır; kimsenin oradan
 * geçmesi gerekmez.
 *
 * Bunu deneyerek öğrendim. Üçünü de "düzeltmeyi" iki farklı şekilde
 * denedim ve 20 dakikalık soak testi her seferinde daha kötü çıktı:
 *
 *   duvara yaslama  → komi 349 sn takıldı (servis noktası cebe düştü)
 *   açığa taşıma    → üç garson 1152 sn takıldı, hijyen sıfırlandı
 *   ORİJİNAL        → en uzun takılma 81 sn, hijyen 100, 1 leke kaldı
 *
 * Bu yüzden konumlar orijinalinde bırakıldı ve uyarı susturuldu. Listeye
 * yeni bir çift eklemeden ÖNCE aynı soak testi çalıştırılmalı.
 */
const KNOWN_SAFE_GAPS: [string, string][] = [
  [tr("Masa 1"), tr("Bulaşık Kovası")],
  [tr("Süpürge Dolabı"), 'Batı duvarı'],
  [tr("Salon Kovası"), 'Güney duvarı'],
];

function isKnownSafeGap(a: string, b: string): boolean {
  for (const [x, y] of KNOWN_SAFE_GAPS) {
    if ((a === x && b === y) || (a === y && b === x)) return true;
  }
  return false;
}

export interface WorldSave {
  sideActivities?: SideActivitiesSave;
  stations: Record<string, StationSave>;
  spills?: SpillSave;
  /**
   * Trafik kiri. Izgara ölçüsü kayıttakinden farklıysa (mekân planı
   * değiştiyse) sessizce atılır — zemin temiz başlar, oyuncu kaybetmez.
   */
  grime?: GrimeSave;
  hygiene?: number;
  /** Ölçülen ₺/sn (bkz. World.realizedIncome) — offline hesabı buna dayanır. */
  income?: number;
  /**
   * Pedlere yapılmış yarım ödemeler (zoneId → ödenen ₺). Kaydedilmediği
   * dönemde pahalı bir bölüme yatırılan para kayıttan dönüşte buharlaşıyordu.
   */
  pads?: Record<string, number>;
}

/**
 * Bir şubenin tüm simülasyonu ve görselleri.
 *
 * ZİNCİR YOK: makineler girdisiz üretir. Oyuncunun zamanı istasyonlar arası
 * mekik dokumakla değil, SİPARİŞİ MASAYA YETİŞTİRMEK ve MEKÂNI TEMİZ TUTMAKLA
 * geçer. Temizlik bir ceza değil, ikinci gelir kalemidir.
 */
export class World {
  readonly sideActivities: SideActivities;
  selectedSideActivity: SideActivityId | null = null;
  private readonly sideWorkViews = new Map<SideActivityId, ReturnType<typeof createSideActivityView>>();
  private readonly sidePurchasePads = new Map<SideActivityId, StaffHirePad>();
  private readonly sidePurchaseArm = new Map<SideActivityId, number>();
  private readonly sidePurchaseExit = new Set<SideActivityId>();

  private inSideLandscape(x:number,z:number): boolean {
    const restroom = x >= RESTROOM_SUITE.x0 && x <= RESTROOM_SUITE.x1 &&
      z >= RESTROOM_SUITE.z0 && z <= RESTROOM_SUITE.z1;
    return this.loc.id === 'kose' && Math.abs(x)>9.2 && z<9.3 && !restroom;
  }

  private sideAvailable(id: SideActivityId): boolean {
    return this.loc.id === 'kose' && (this.sideActivities.peek(id).level > 0 || this.zoneUnlocked(SIDE_ACTIVITY_DEFS[id].requires));
  }

  focusSideActivity(id: SideActivityId): void {
    if (!SIDE_ACTIVITY_IDS.includes(id) || !this.sideAvailable(id)) return;
    this.selectedSideActivity = this.selectedSideActivity === id ? null : id;
    this.guideCache = null;
    this.guideTimer = 0;
  }

  getSideActivityRows(player?: Player): UiSideActivityRow[] {
    if (this.loc.id !== 'kose' || this.state.tutorialStep < TUTORIAL_STEP_COUNT) return [];
    return SIDE_ACTIVITY_IDS.filter(id => this.sideAvailable(id)).map(id => {
      const s = this.sideActivities.get(id);
      const missing = s.lines.filter(line => line.delivered < line.quantity);
      const blockedHands = this.selectedSideActivity === id && !!player && !player.isEmpty && (s.phase === 'packing' || s.phase === 'cleaning');
      const summary = blockedHands ? tr('Önce tepsiyi boşalt') : s.level === 0 ? tr('Karede dur · ₺{0}', formatShort(s.purchaseRemaining))
        : s.phase === 'packing' ? tr('Paketi hazırla')
        : s.phase === 'cleaning' ? tr('Tezgâhı toparla')
        : s.phase === 'waiting' ? tr('Menü açılmasını bekliyor')
        : missing.map(line => `${ITEMS[line.item].name} ×${line.quantity - line.delivered}`).join(' + ');
      const total = s.lines.reduce((n,l) => n + l.quantity, 0);
      const delivered = s.lines.reduce((n,l) => n + l.delivered, 0);
      const progress = s.level === 0 ? s.purchaseDeposit / Math.max(1,s.nextCost)
        : s.phase === 'packing' ? s.workProgress : s.phase === 'cleaning' ? s.cleanProgress : delivered / Math.max(1,total);
      return { id, title: tr(SIDE_ACTIVITY_DEFS[id].title), level: s.level, summary,
        reward: s.phase === 'cleaning' ? 0 : s.reward + s.bonus, progress, selected: this.selectedSideActivity === id };
    });
  }

  private syncSideArchitecture(): void {
    if (this.loc.id !== 'kose') return;
    for (const id of SIDE_ACTIVITY_IDS) {
      const level = this.sideActivities.peek(id).level;
      const gate = this.env?.root.getObjectByName('sideGate_' + id);
      if (gate) gate.visible = level === 0;
      for (let n = 2; n <= 4; n++) {
        const detail = this.env?.root.getObjectByName(`sideLevel_${id}_${n}`);
        if (detail) detail.visible = level >= n;
      }
    }
  }

  private completeSideOrder(event: SideActivityCompletion): void {
    const point = SIDE_GARDEN_LAYOUT[event.id].bench;
    this.state.earn(event.amount, point.x, point.z, 1.5);
    this.state.grant(event.bonus, point.x, point.z, 1.9);
    this.revenueAcc += event.amount;
    for (const line of event.lines) this.state.addSale(line.item, line.quantity);
    this.bumpTempo(BALANCE.tempo.gain.handsOnPerSecond * 3, 1);
    this.vfx?.coinBurst(point.x, 1.25, point.z, 3);
    this.vfx?.ring(point.x, 0.12, point.z, SIDE_ACTIVITY_DEFS[event.id].color, 1.6);
    sfx('sell'); haptic('success');
    bus.emit('toast', { text: tr('{0} · Sipariş tamamlandı', tr(SIDE_ACTIVITY_DEFS[event.id].title)), tone: 'good', glyph: '✓' });
    bus.emit('side:changed', { immediate: true });
  }

  private updateSideInteraction(dt: number, player: Player): boolean {
    if (this.loc.id !== 'kose' || !this.active || player.hasVacuum || player.interacting) return false;
    for (const id of SIDE_ACTIVITY_IDS) {
      const point = SIDE_GARDEN_LAYOUT[id].service;
      const state = this.sideActivities.peek(id);
      if (state.level === 0 || dist(player.x,player.z,point.x,point.z) > 0.88) continue;
      if (player.planarSpeed >= 1) return false;
      const item = player.distinctItems().find(item => this.sideActivities.needs(id,item));
      if (state.phase === 'delivery' && !item) return false;
      if ((state.phase === 'packing' || state.phase === 'cleaning') && !player.isEmpty) return false;
      if (!this.armGate('sidework:' + id,dt,0.25,SIDE_ACTIVITY_DEFS[id].color,player)) return true;
      player.interacting = true;
      const bench = SIDE_GARDEN_LAYOUT[id].bench;
      player.faceTowards(bench.x,bench.z,dt,10);
      player.interactionKind = state.phase === 'cleaning' ? 'wipe' : 'reach';
      if (state.phase === 'delivery' && item && player.tryHandContact('side:'+id+':'+item,'reach',dt,this.state.handInterval)) {
        if (this.sideActivities.deposit(id,item)) {
          player.takeItem(item);
          sfx('produce',0.4); haptic('light');
          this.vfx?.puff(point.x,1.0,point.z,SIDE_ACTIVITY_DEFS[id].color,2);
          bus.emit('side:changed', { immediate: true });
        }
      } else if (state.phase === 'packing') {
        player.tryHandContact('sidepack:'+id,'reach',dt,0.5);
        const event = this.sideActivities.work(id,dt);
        if (event) this.completeSideOrder(event);
      } else if (state.phase === 'cleaning') {
        player.tryHandContact('sideclean:'+id,'wipe',dt,0.45);
        if (this.sideActivities.clean(id,dt,this.menuItems())) {
          sfx('clean');
          bus.emit('side:changed', { immediate: true });
        }
      }
      return true;
    }
    return false;
  }

  private updateSideActivities(dt: number, player: Player | null): void {
    if (this.loc.id !== 'kose') return;
    if (this.active) for (const completion of this.sideActivities.update(dt)) this.completeSideOrder(completion);
    for (const id of SIDE_ACTIVITY_IDS) {
      const state = this.sideActivities.get(id), def = SIDE_ACTIVITY_DEFS[id], layout = SIDE_GARDEN_LAYOUT[id];
      const visible = this.sideAvailable(id) && this.state.tutorialStep >= TUTORIAL_STEP_COUNT;
      const pad = this.sidePurchasePads.get(id);
      const near = !!player && dist(player.x,player.z,layout.purchase.x,layout.purchase.z) < 3;
      const on = !!player && Math.abs(player.x-layout.purchase.x)<0.55 && Math.abs(player.z-layout.purchase.z)<0.55;
      if (!on) this.sidePurchaseExit.delete(id);
      const benefit = state.level === 0 ? tr('Yan siparişler açılır') : state.level === 1 ? tr('Daha değerli siparişler')
        : state.level === 2 ? tr('Otomatik paketleme · 6 sn') : tr('Her 3 siparişte seri bonusu');
      if (pad) {
        pad.root.visible = visible && state.nextCost > 0;
        pad.setLabel(`${tr(def.title)} · ${state.level === 0 ? tr('AÇ') : '↑ ' + (state.level+1)} · ₺${formatShort(Math.ceil(state.purchaseRemaining))}`);
        pad.setHint(near ? benefit : '');
        pad.setProgress(state.purchaseDeposit / Math.max(1,state.nextCost));
        pad.setActive(on && !this.sidePurchaseExit.has(id));
        pad.update(dt,GUIDE_QUAT);
      }
      const board = this.sideWorkViews.get(id);
      if (board) {
        board.root.visible = visible && state.level > 0;
        board.update({...state,blockedByCarry:!!player && !player.isEmpty},!!player && dist(player.x,player.z,layout.service.x,layout.service.z)<3.8,GUIDE_QUAT);
      }
      if (!visible || !on || !this.active || !player || player.hasVacuum || player.interacting || player.planarSpeed >= 1 || state.nextCost <= 0 || this.sidePurchaseExit.has(id)) {
        this.sidePurchaseArm.set(id,0); pad?.setArmed(0); continue;
      }
      const charge = (this.sidePurchaseArm.get(id) ?? 0) + dt;
      this.sidePurchaseArm.set(id,charge); pad?.setArmed(charge / 0.9);
      if (charge < 0.9 || this.state.money <= 0) continue;
      const amount = Math.min(this.state.money,state.purchaseRemaining,Math.max(100,state.nextCost*0.65)*dt);
      const purchase = this.sideActivities.depositPurchase(id,amount,this.menuItems());
      if (purchase.spent > 0) {
        this.state.spend(purchase.spent);
        if (purchase.upgraded) {
          // Leaving the square is required before paying toward another level.
          this.sidePurchaseExit.add(id);
          this.selectedSideActivity = id;
          this.syncSideArchitecture(); this.rebuildNav();
          sfx('upgrade'); haptic('success');
          this.vfx?.ring(layout.purchase.x,0.1,layout.purchase.z,def.color,2);
          bus.emit('toast',{text:tr('{0} · Seviye {1}',tr(def.title),purchase.level),glyph:'✓',tone:'good'});
        }
        bus.emit('side:changed',{structural:purchase.upgraded,immediate:purchase.upgraded});
      }
    }
  }

  private sideGuideTarget(player: Player): GuideTarget | null {
    const id = this.selectedSideActivity;
    if (!id || !this.sideAvailable(id)) return null;
    const state=this.sideActivities.peek(id), def=SIDE_ACTIVITY_DEFS[id], layout=SIDE_GARDEN_LAYOUT[id];
    if (state.level===0) return {...layout.purchase,label:tr('ALANI AÇ') + ' · ' + tr(def.title),color:def.color};
    if (player.hasVacuum) {
      const dock=this.vacuums.find(d=>!d.locked); return dock ? this.guideVacuumReturn(dock,player) : null;
    }
    if (state.phase==='cleaning' || state.phase==='packing') {
      return player.isEmpty ? {...layout.service,label:state.phase==='cleaning'?tr('Tezgâhı toparla'):tr('Paketi hazırla'),color:def.color} : null;
    }
    const missing=state.lines.filter(l=>l.delivered<l.quantity);
    if (missing.some(l=>player.hasItem(l.item))) return {...layout.service,label:tr('Yan siparişi teslim et'),color:def.color};
    if (player.isFull || player.slots.some(i=>!isProduct(i))) return null;
    const next=missing.find(l=>(this.machineFor(l.item)?.output ?? 0)>0) ?? missing[0];
    const machine=next && this.machineFor(next.item);
    return machine ? this.guideAt(machine,tr('{0} al',ITEMS[next.item].name),def.color) : null;
  }

  readonly loc: LocationDef;
  readonly root = new VisibilityRoot();
  readonly nav: NavGrid;
  /** Aktörlerin yere basma lekeleri (tek çizim çağrısı). */
  private contact: ContactShadows | null = null;
  private groundShadows: GroundShadowBatch | null = null;
  private viewReady = false;
  private readonly cullPlanes: CullPlane[] = [];
  private highlightBusy = false;

  readonly stations: StationEntity[] = [];
  readonly byId = new Map<string, StationEntity>();
  /** Girdisiz üreten istasyonlar (menü makineleri + sarf deposu) */
  readonly machines: StationEntity[] = [];
  /** Teslim bankoları — her ürünü kabul eden ortak tampon */
  readonly pickups: StationEntity[] = [];
  readonly counters: StationEntity[] = [];
  readonly tables: StationEntity[] = [];
  readonly bins: StationEntity[] = [];
  readonly toilets: StationEntity[] = [];
  /**
   * ZORLUK ÖLÇERİ — 0 (yeni başlangıç) … 1 (her şey açık).
   *
   * Oyuncunun isteği: "yeni başlayanlar için kolay ve hızlı olsun ama
   * ilerledikçe zorlaşsın, hep aynı basitlikte devam etmesin." Tek bir
   * ilerleme oranı üç şeyi birden sıkar: sabır, kir ve tuvalet kirliliği.
   * Bölüm satın almak yalnız ödül değil, aynı zamanda taahhüttür.
   */
  get difficulty(): number {
    const zones = this.loc.zones;
    if (zones.length <= 1) return 0;
    let open = 0;
    for (const z of zones) if (this.state.isZoneUnlocked(this.loc.id, z.id)) open++;
    return clamp01((open - 1) / (zones.length - 1));
  }

  /** Sabır çarpanı: 1,00 → 0,76 (zorluk arttıkça misafir daha çabuk küser). */
  /** v5.1 — reklam ödülü + MÜZİK KÖŞESİ sabır bonusları buradan biner. */
  get patienceScaleBoosted(): number {
    return this.patienceScaleBase * this.patienceBoost;
  }

  private get patienceScale(): number {
    return this.patienceScaleBoosted;
  }

  private get patienceScaleBase(): number {
    const d = BALANCE.difficulty;
    return d.patienceStart + (d.patienceEnd - d.patienceStart) * this.difficulty;
  }

  /** Kir çarpanı: 1,00 → 1,55 (büyük kafe daha çabuk kirlenir). */
  private get dirtScale(): number {
    const d = BALANCE.difficulty;
    return d.dirtStart + (d.dirtEnd - d.dirtStart) * this.difficulty;
  }

  /** Süpürge dolapları (genelde bir tane). */
  readonly vacuums: StationEntity[] = [];

  readonly spills = new SpillField();
  /** Zeminin kullanım izi — trafikle birikir, süpürgeyle silinir. */
  grime!: GrimeField;
  private grimeView: GrimeView | null = null;
  /** Ödül eşiğine kadar biriken temizlenmiş kir. */
  private grimeRewardAcc = 0;

  /** Mekân temizliği 0..100 */
  hygiene: number = BALANCE.hygiene.start;

  readonly customers: Customer[] = [];
  readonly staff: Staff[] = [];

  private stationVisuals = new Map<string, StationVisual>();
  private pickupVisuals = new Map<string, PickupVisual>();
  private env: EnvironmentView | null = null;
  private spillView: SpillView | null = null;
  /** false = sahne kurulmaz (test). */
  private readonly draw3d: boolean;

  private state: GameState;
  private vfx: VFXSystem | null = null;
  private rng = new Rng((Math.random() * 0xffffffff) >>> 0);

  /** Yol gösterici — "şimdi ne yapacağım" sorusunun kalıcı cevabı. */
  private guide: GuideMarker | null = null;
  private armRing: ArmRing | null = null;
  private readonly staffHirePads = new Map<StaffRole, StaffHirePad>();
  private readonly staffHireCharge = new Map<StaffRole, number>();
  private readonly staffHireWaitExit = new Set<StaffRole>();
  private readonly staffHireCountSeen = new Map<StaffRole, number>();
  /** Aynı anda oyuncuya sunulan en fazla üç satın alma seçeneği. */
  private readonly visiblePadIds = new Set<string>();
  private guideTimer = 0;
  private guideCache: GuideTarget | null = null;
  get currentAction(): GuideTarget | null { return this.guideOverride ?? this.guideCache; }
  private assistPlayer: Player | null = null;
  private readonly assistAccess = { x: 0, z: 0 };
  private readonly interactionContact = { x: 0, z: 0 };
  private playerCare: { id: string; remaining: number } | null = null;
  guideGoal: GoalDef | null = null;
  /** Progress of guideGoal, written by Game before each sim step. */
  guideGoalCurrent = 0;
  /** Goal is more than ~30s away, so a nearer payout may take the action line. */
  nearWinWanted = false;
  /** Extra gray covers: one purchase past the next buy, on the open bar and first table row. */
  private readonly nearCoverIds = new Set<string>();
  private guideCare: { kind: 'table' | 'spill'; id: string | number; startedAt: number } | null = null;
  private lastGuideCareAt = -60;
  private guideSpillWait = 0;
  private guideFocusId = '';
  private guideFocusUntil = 0;
  /**
   * Öğretici devredeyken yönlendirmeyi o yönetir: tek işaret dili vardır
   * (3D ok + halka). Eskiden öğreticinin ayrı bir DOM 👇 işaretçisi vardı
   * ve iki sistem aynı anda iki farklı yere işaret edebiliyordu.
   */
  guideOverride: GuideTarget | null = null;
  private spawnTimer = 1.5;
  /** Boş masa bulunamayan kesintisiz süre (sn) — kapıyı sonsuza kilitlememek için. */
  /** Bir sonraki toz birikmesine kalan süre (sn). */
  private dustTimer = 22;
  private customerSeq = 0;
  private padProgress = new Map<string, number>();
  private activeAdZone: { zone: ZoneDef; tier: 'finish' | 'pay_half'; remaining: number } | null = null;

  /** Bir bölgenin pedine şu ana kadar akıtılmış para (yarım ödeme kaydolur). */
  padPaid(zoneId: string): number {
    return this.padProgress.get(zoneId) ?? 0;
  }

  getActiveAdZone(): { zone: ZoneDef; tier: 'finish' | 'pay_half'; remaining: number } | null {
    return this.activeAdZone;
  }

  payZoneAd(zoneId: string, amount: number): void {
    const zone = this.loc.zones.find((z) => z.id === zoneId);
    if (!zone) return;
    const cur = this.padProgress.get(zoneId) ?? 0;
    const next = Math.min(zone.cost, cur + amount);
    this.padProgress.set(zoneId, next);
    this.vfx?.coinBurst(zone.padX, 1.1, zone.padZ, 10);
    sfx('levelup');
    if (next >= zone.cost - 0.01) {
      this.padProgress.set(zoneId, zone.cost);
      this.unlockZone(zoneId, 'pad');
      sfx('unlock');
    }
  }
  private padCharge = new Map<string, number>();

  /**
   * NİYET KAPISI durumu — tek slot: aynı anda tek etkileşim adayı olur
   * (updatePlayerInteraction ilk eşleşmede döner). Aday değişince sayaç
   * sıfırlanır; aynı adayın yanında geçirilen süre biriktikçe ayak dibindeki
   * halka dolar, dolunca işlem başlar.
   */
  private armKey: string | null = null;
  private armT = 0;
  private armTouched = false;

  /** playerStart'tan erişilebilir hücreler — rebuildNav her seferinde tazeler. */
  private reachMask: Uint8Array | null = null;

  active = false;
  automation = 0;
  /**
   * Aynı anda mekânda bulunabilecek müşteri sayısı.
   *
   * ARTIK MEKÂNIN KENDİSİ BELİRLİYOR (bkz. refreshCapacity): açık masa
   * sayısı arttıkça kafe daha çok misafir alır. Kalite kademesi yalnızca
   * ÜST SINIR koyar, ekonomiyi belirlemez.
   *
   * Eskiden doğrudan kademeden geliyordu ve ölçüm bunun gerçek gelir
   * tavanı olduğunu gösterdi (zamanın %55,9'unda doluydu). İki sonucu
   * vardı: (1) oyuncunun telefonu kazancını belirliyordu, (2) masa
   * açılımları 74 koltuk yaratıyor ama mekân 16 kişiden fazlasını hiç
   * almadığı için son beş açılımın dördü hiçbir şey değiştirmiyordu.
   */
  maxCustomers = 8;
  /**
   * Masalardan türeyen HAM mekân kapasitesi — tempo uygulanmadan önceki
   * değer. `maxCustomers` bundan her kare türetilir (bkz. applyTempoCapacity).
   */
  venueCapacity = 8;

  constructor(locationId: string, state: GameState, vfx: VFXSystem | null, draw3d = true) {
    this.root.matrixAutoUpdate = false;
    this.loc = locationDef(locationId);
    this.state = state;
    this.vfx = vfx;
    this.draw3d = draw3d;
    this.sideActivities = new SideActivities(item => this.itemValue(item) * this.state.saleMultiplier);

    this.nav = new NavGrid(this.loc.bounds, 2);
    this.nav.markStaticWalls(this.loc.bounds);
    const d = this.loc.door;
    this.nav.carveDoor(d.x - 1.8, d.z - 2.2, d.x + 1.8, d.z + 1.6);

    for (const def of stationsOfLocation(this.loc.id)) {
      const st = new StationEntity(def);
      st.locked = !state.isZoneUnlocked(this.loc.id, def.zone);
      this.stations.push(st);
      this.byId.set(st.id, st);
      switch (def.kind) {
        case 'pickup':
          this.pickups.push(st);
          break;
        case 'counter':
          this.counters.push(st);
          break;
        case 'table':
          this.tables.push(st);
          break;
        case 'bin':
          this.bins.push(st);
          break;
        case 'toilet':
          this.toilets.push(st);
          break;
        case 'vacuum':
          st.output = 1; // süpürge başlangıçta dolabında durur
          this.vacuums.push(st);
          break;
        default:
          if (def.id === 'k_semaver') st.output = 2;
          this.machines.push(st);
          break;
      }
    }

    this.sideActivities.syncMenu(this.menuItems());
    this.hasLift = this.loc.zones.some((z) => (z.room?.lift ?? 0) > 0);
    this.grime = new GrimeField(this.loc.bounds);
    this.grime.walkable = (x, z) => !this.inSideLandscape(x,z) && !this.nav.solidBlocked(x, z, 0.18);

    if (this.draw3d) {
      this.contact = new ContactShadows();
      this.env = createEnvironment(this.loc);
      this.root.add(this.env.root);
      if (this.loc.id === 'kose') for (const id of SIDE_ACTIVITY_IDS) {
        const def=SIDE_ACTIVITY_DEFS[id],layout=SIDE_GARDEN_LAYOUT[id];
        const view=createSideActivityView(id,tr(def.title),def.color);
        view.root.position.set(layout.bench.x,0.1,layout.bench.z);
        view.root.visible=false; markDynamic(view.root);this.root.add(view.root);this.sideWorkViews.set(id,view);
        const pad=createStaffHirePad(def.color,tr(id === 'garden' ? 'Bahçe' : 'Avlu'));pad.root.name='sidePurchase_'+id;
        pad.root.position.set(layout.purchase.x,0,layout.purchase.z);pad.root.visible=false;
        markDynamic(pad.root);this.root.add(pad.root);this.sidePurchasePads.set(id,pad);
      }


      this.groundShadows = createGroundShadowBatch(this.stations.length);
      this.root.add(this.groundShadows.mesh);

      for (const st of this.stations) {
        // Yükseltilmiş odadaki mobilya podyumun ÜSTÜNE oturur (görsel kot).
        const lift = floorLiftAt(this.loc, st.x, st.z);
        if (st.def.kind === 'pickup') {
          const v = createPickupVisual(st.def, this.loc.palette);
          v.root.position.set(st.x, lift, st.z);
          v.root.rotation.y = (st.def.rot * Math.PI) / 180;
          v.setLocked(st.locked);
          this.pickupVisuals.set(st.id, v);
          this.root.add(v.root);
        } else {
          const v = createStationVisual(st.def, this.loc.palette);
          v.root.position.set(st.x, lift, st.z);
          v.root.rotation.y = (st.def.rot * Math.PI) / 180;
          v.setLocked(st.locked);
          this.stationVisuals.set(st.id, v);
          this.root.add(v.root);
        }
      }

      this.spillView = createSpillView();
      markDynamic(this.spillView.root);
      this.root.add(this.spillView.root);

      /**
       * TRAFİK KİRİ. Leke katmanının ALTINA serilir (y 0,008 < 0,012).
       * Yükseltilmiş odalar kendi düzlemlerini alır; tek düzlem podyumun
       * altında kalıp görünmezdi.
       */
      this.grimeView = createGrimeView(
        this.grime,
        this.loc.bounds,
        this.loc.zones
          .filter((z) => (z.room?.lift ?? 0) > 0)
          .map((z) => ({ x0: z.room!.x0, z0: z.room!.z0, x1: z.room!.x1, z1: z.room!.z1, lift: z.room!.lift! })),
      );
      this.root.add(this.grimeView.root);
      markDynamic(this.grimeView.root);
      markDynamic(this.contact.mesh);
      this.root.add(this.contact.mesh);

      // Yol gösterici: hedef üstünde ok + zeminde halka (tek yönlendirme dili).
      this.guide = createGuideMarker();
      markDynamic(this.guide.root);
      this.root.add(this.guide.root);

      // Niyet halkası: alma/satın alma bekleyişinin dolum göstergesi.
      this.armRing = createArmRing();
      markDynamic(this.armRing.root);
      this.root.add(this.armRing.root);

      for (const role of Object.keys(this.loc.staffHirePads) as StaffRole[]) {
        const point = this.loc.staffHirePads[role];
        const color = Number.parseInt(STAFF_ROLE_MAP[role].color.slice(1), 16);
        const pad = createStaffHirePad(color);
        pad.root.name = 'staffHirePad:' + role;
        pad.root.position.set(point.x, floorLiftAt(this.loc, point.x, point.z), point.z);
        pad.root.visible = false;
        this.staffHirePads.set(role, pad);
        this.staffHireCountSeen.set(role, this.state.staffCountAt(this.loc.id)[role]);
        markDynamic(pad.root);
        this.root.add(pad.root);
      }
    }

    for (const zone of this.loc.zones) {
      const unlocked = state.isZoneUnlocked(this.loc.id, zone.id);
      this.env?.setZoneUnlocked(zone.id, unlocked, false);
      this.padProgress.set(zone.id, 0);
      this.padCharge.set(zone.id, 0);
    }

    /**
     * Seçili dekorasyon daha kurulum anında uygulanır. Sonradan çağırmak
     * "kafe bir kare krem açılıp sonra boyanıyor" demek olurdu; ayrıca
     * ikinci şube satın alındığında da doğru görünümle doğar.
     */
    if (this.draw3d) {
      this.applyCosmetics();
      this.env?.optimizeStatic();
      this.rebuildGroundShadows();
    }

    this.rebuildNav();
    /**
     * Leke yalnızca ULAŞILABİLİR zemine düşebilir. "Yürünebilir" yetmez:
     * kilitli odanın içi ızgarada boş görünür ama kapısı tıkalıdır —
     * oraya düşen lekeye komi asla ulaşamaz ve sonsuza dek yürümeye
     * çalışırdı (stall-soak bunu 600 sn'lik donma olarak yakalamıştı).
     * Maske her nav yenilenişinde tazelenir (rebuildNav).
     */
    this.spills.walkable = (x, z) =>
      !this.inSideLandscape(x,z) && !this.nav.isBlocked(x, z) && (this.reachMask === null || this.nav.maskHas(this.reachMask, x, z, 0));
    this.root.visible = false;

    /**
     * DOĞRULAMA AÇILIŞTA ÇALIŞIR.
     *
     * `validateLayout()` tam da 240 saniyelik "komi cebe sıkıştı" hatasını
     * bir daha yaşamamak için yazılmıştı — ama kodda hiçbir yerden
     * ÇAĞRILMIYORDU. Yazılıp çalıştırılmayan bir güvenlik ağı, olmayan bir
     * güvenlik ağıdır. Artık her dünya kurulumunda geliştirme derlemesinde
     * çalışır ve sorunları konsola basar; üretim derlemesinde tamamen
     * ağaçtan düşer.
     */
    if (import.meta.env.DEV) {
      const problems = this.validateLayout();
      if (problems.length > 0) {
        console.warn(
          `[Yerleşim] "${this.loc.name}" şubesinde ${problems.length} sorun:\n` +
            problems.map((p) => '  • ' + p).join('\n'),
        );
      }
    }
  }

  setVfx(v: VFXSystem): void {
    this.vfx = v;
  }

  /* ============================================================ *
   *  Navigasyon
   * ============================================================ */

  rebuildNav(): void {
    this.refreshNearCovers();
    this.nav.beginRebuild();
    const cashierPad = this.loc.staffHirePads.cashier;
    // The hire square sits on the bar line. A straight walk from the west
    // must enter it; charging still waits for padArmTime while the player moves.
    const block = (x0: number, z0: number, x1: number, z1: number): void => {
      for (const part of rectsExceptHireCrossing(x0, z0, x1, z1, cashierPad))
        this.nav.blockRect(part[0], part[1], part[2], part[3]);
    };
    this.chairSolids.clear();
    this.toiletSeatSolids.clear();
    this.seatApproaches.clear();
    for (const st of this.stations) {
      /**
       * GÖRÜNMEYEN İSTASYON ENGEL DEĞİLDİR. Uzaktaki kilitli bölümün
       * eşyası sahnede hiç yok; yine de engel yazılınca oyuncu boş
       * zeminde görünmez duvarlara tosluyordu ("görünmeyen yerler de
       * bloklanıyor"). Brandalı olan görünür, o engel kalır.
       */
      if (this.furnitureVisibility(st) === 'hidden') continue;
      const half = footprint(st);
      if (st.def.kind === 'table') {
        const corner = st.def.visual === 'table' ? half.x : 0.06;
        this.nav.blockRoundedRect(st.x - half.x, st.z - half.z, st.x + half.x, st.z + half.z, corner);
        for (let i = 0; i < st.seats; i++) {
          this.seatPoint(st, i, _seat);
          const angle = seatAngle(st.def.visual, st.seats, i) + st.def.rot * Math.PI / 180 + Math.PI;
          const solid = this.nav.blockOrientedRect(_seat.x, _seat.z, CHAIR_BODY.halfWidth,
            CHAIR_BODY.halfDepth, angle, CHAIR_BODY.corner);
          this.chairSolids.set(st.id + '/' + i, solid);
        }
      } else if (st.def.kind === 'toilet' && !st.locked) {
        // Only the actual walls and fittings are solid. The customer walks
        // through the open front, then sits over this bowl just like a chair.
        for (const fixture of TOILET_LAYOUT.fixtures) {
          restroomPoint(st.def, fixture, _pt);
          const solid = this.nav.blockOrientedRect(_pt.x, _pt.z, fixture.hx, fixture.hz, st.def.rot * Math.PI / 180, 0);
          if (fixture.id === 'bowl') this.toiletSeatSolids.set(st.id, solid);
        }
      } else block(st.x - half.x, st.z - half.z, st.x + half.x, st.z + half.z);
    }

    /**
     * ODA DUVARLARI — veri güdümlü. Görsel duvar (Environment) ile
     * çarpışma AYNI `roomWalls()` çıktısından kurulur; iki taraf
     * birbirinden kopamaz. Kilitli odanın kapı boşluğu ayrıca TIPALANIR:
     * kapalı kapının içinden geçilmez.
     */
    for (const w of roomWalls(this.loc)) {
      block(w.x0, w.z0, w.x1, w.z1);
    }
    /**
     * BÖLME DUVARLARI — ana salonu yan ek yapılardan ayırır ve oda
     * kilidinden BAĞIMSIZDIR (portal boşluğu hep açıktır; kapalı tutan şey
     * odanın kendi kapı tıpasıdır).
     */
    for (const w of this.loc.partitions ?? []) {
      block(w.x0, w.z0, w.x1, w.z1);
    }
    for (const w of sideGardenObstacles(this.loc)) block(w.x0,w.z0,w.x1,w.z1);
    if (this.loc.id === 'kose') for (const id of SIDE_ACTIVITY_IDS) {
      if (this.sideActivities.peek(id).level > 0) continue;
      const gate = sideGardenGate(id);
      block(gate.x0,gate.z0,gate.x1,gate.z1);
    }


    /**
     * DEKOR ARTIK GERÇEK ENGEL (2026-08-19).
     *
     * Bu döngü daha önce YOKTU: `DECOR_BOX` yalnızca yerleşim
     * doğrulayıcısını besliyordu, oyunun kendisi dekoru hiç okumuyordu.
     * Sonuç, oyuncunun bildirdiği hataydı — "süsler, ağaçlar, lamba"nın
     * içinden yürünebiliyordu. Ağacın içinden geçen bir karakter, mekânı
     * tek hamlede oyuncak seviyesine indirir.
     *
     * `blockRect` HEM ızgaraya HEM gövde listesine yazar; ikisinden birini
     * atlamak bu dosyada iki kez ısırdı (bkz. Navigation'daki "ince duvar
     * tuzağı" ve "bant/gövde uyuşmazlığı" notları): A* geçit görürken
     * gövde geçirmezse aktör orada sonsuza dek titrer.
     *
     * Gizli bölümün dekoru sahnede yok — engel de değil.
     */
    for (const d of this.loc.decor ?? []) {
      const half = decorHalf(d);
      if (!half) continue;
      if (d.zone && this.zoneVisibility(d.zone) === 'hidden') continue;
      block(d.x - half.x, d.z - half.z, d.x + half.x, d.z + half.z);
    }
    for (const zone of this.loc.zones) {
      if (!zone.room || this.zoneUnlocked(zone.id)) continue;
      for (const plug of roomDoorPlugs(zone)) {
        block(plug.x0, plug.z0, plug.x1, plug.z1);
      }
    }

    /**
     * KORİDOR GARANTİSİ. Kilitli bölüm zemini kapatmıyor (eşyası brandalı
     * ama yerinde), bu yüzden koruma gereken şey personel koridoru ile
     * sipariş sırası koridoru.
     *
     * (Eski tuvalet nişi duvarları buradaydı — DOOR_X sabitleriyle elle
     * yazılmıştı; oda sistemi veriye taşındı, niş kullanan kalmadı.)
     */

    const a = this.loc.aisle;
    const bx0 = this.loc.bounds.x0 + 1;
    const bx1 = this.loc.bounds.x1 - 1;
    this.nav.unblockRect(bx0, a.z0, bx1, a.z1);
    const fa = this.loc.frontAisle;
    this.nav.unblockRect(bx0, fa.z0, bx1, fa.z1);
    this.nav.unblockRect(this.loc.door.x - 2, this.loc.door.z - 3.4, this.loc.door.x + 2, this.loc.door.z + 0.6);
    // Bantlar gerçek bir gövdenin hücrelerini açmış olabilir — geri kapat
    // (A* yürünür sanıyor, gövde geçirmiyordu; bkz. Navigation.restampSolids).
    this.nav.restampSolids();
    this.nav.finishRebuild();
    // Chairs can occupy an old fixed work point; shift that point a few cm
    // into free floor without moving the station or changing interaction reach.
    for (const st of this.stations) {
      st.serviceAccess = null;
      if (this.furnitureVisibility(st) === 'hidden') continue;
      st.servicePoint(_pt);
      if (!this.nav.solidBlocked(_pt.x, _pt.z, .34)) continue;
      const x = _pt.x, z = _pt.z;
      this.nav.resolve(_pt, .36);
      if (!this.nav.solidBlocked(_pt.x, _pt.z, .34) && dist(x, z, _pt.x, _pt.z) <= .6)
        st.serviceAccess = { x: _pt.x, z: _pt.z };
    }
    // Erişim maskesini tazele — leke doğuşu ve doğrulayıcı buna bakar.
    this.reachMask = this.nav.reachableMask(this.loc.playerStart.x, this.loc.playerStart.z);
    /**
     * Trafik kirinin engel maskesi de tazelenir: bölge açılınca yeni tezgâh
     * gelir ve altında kalan kir artık süpürülemez olurdu (fırça oraya
     * ulaşamaz, hijyen sonsuza dek eksik kalır). O hücreler temizlenip
     * kilitlenir.
     */
    this.grime?.rebuildMask();
    /**
     * HEDEF KORUNUR, YOL TAZELENİR. Eskiden `c.stop()` çağrılıyordu ve
     * `stop()` `arrived`'ı anında true yaptığı için her bölge açılışında
     * (oyunun en kutlamalık anında) yürüyen misafirler sandalyeye
     * ışınlanıyor, çıkanlar salonun ortasında buharlaşıyor, tuvalete
     * gidenler olduğu yerde "tuvaleti kullanıyordu".
     */
    // A* for every walking guest in the unlock frame was a visible freeze;
    // the searches are spread over the next frames (~1-2 per frame).
    let replans = 0;
    for (const c of this.customers) {
      if (c.table && c.state === 'seated') {
        this.sitOnChair(c, c.table);
      } else if (c.table && c.state === 'toTable') {
        if (this.seatApproach(c.table, c.seatIndex, _pt)) c.moveTo(this.nav, _pt.x, _pt.z, true);
      } else c.scheduleReplan(0.02 * replans++);
    }
    for (const s of this.staff) s.clearJob();
  }

  /**
   * YERLEŞİM DOĞRULAMASI (geliştirme aracı) — üç ayrı denetim:
   * erişilebilirlik, koridor genişliği ve BOĞAZ genişliği.
   */
  validateLayout(): string[] {
    const problems: string[] = [];
    const mask = this.nav.reachableMask(this.loc.playerStart.x, this.loc.playerStart.z);

    const check = (label: string, x: number, z: number) => {
      if (!this.nav.maskHas(mask, x, z)) problems.push(`ERİŞİLEMEZ: ${label} (${x.toFixed(1)}, ${z.toFixed(1)})`);
    };

    /**
     * SERVİS NOKTASI İÇİN TOLERANSSIZ DENETİM.
     *
     * `maskHas` varsayılan olarak 1 hücrelik (0,5 birim) tolerans uygular;
     * yani "erişilebilir" aslında "erişilebilir bir yerin 0,5 birim
     * yakınında" demektir. Personelin DURMASI gereken nokta için bu yeterli
     * değil: bir kova duvara yaslandığında servis noktası duvarın içine
     * düşüyor, tolerans yüzünden denetimden geçiyor, ama komi oraya asla
     * varamıyordu. Soak testinde iki komi elinde bulaşıkla 20 dakika
     * boyunca kovanın 0,85 birim ötesinde kilitli kaldı.
     */
    const checkStrict = (label: string, x: number, z: number) => {
      if (!this.nav.maskHas(mask, x, z, 0)) {
        problems.push(`SERVİS NOKTASI ERİŞİLEMEZ: ${label} (${x.toFixed(1)}, ${z.toFixed(1)})`);
      }
    };

    for (const st of this.stations) {
      /**
       * GİZLİ istasyon dünyada yoktur: engel yazmaz, servis alamaz.
       * (Kilitli odanın içindekiler böyle.) Onun denetimi, göründüğü
       * kilit kombinasyonunda yapılır — her unlockZone sonrası
       * validateLayout yeniden koşar.
       */
      if (this.furnitureVisibility(st) === 'hidden') continue;
      st.servicePoint(_pt);
      checkStrict(`${st.def.name} · servis`, _pt.x, _pt.z);
      const k = st.def.kind;
      if (k === 'pickup' || k === 'counter' || k === 'toilet') {
        st.frontPoint(_pt);
        check(`${st.def.name} · müşteri`, _pt.x, _pt.z);
      }
      if (k === 'counter') {
        /**
         * Sıra TAMAMEN taranır. Eskiden yalnızca ilk 4 slot bakılıyordu
         * ama `maxQueue` 6'dır ve üstüne taşma slotları vardır — yani
         * sıranın sonu hiç denetlenmiyordu. Bu, gerçek bir hatayı
         * gizliyordu: bir tezgâhın 6. slotu bir masanın GÖVDESİNİN
         * içine düşüyor, müşteri her karede dışarı itiliyordu.
         */
        const maxSlot = BALANCE.customers.maxQueue + 2;
        for (let i = 0; i <= maxSlot; i++) {
          st.queueSlot(i, _pt);
          check(`${st.def.name} · sıra ${i}`, _pt.x, _pt.z);
          // Slot bir istasyonun gövdesine giriyor mu?
          for (const other of this.stations) {
            if (other === st) continue;
            const f = footprint(other);
            const dx = Math.abs(_pt.x - other.x) - f.x;
            const dz = Math.abs(_pt.z - other.z) - f.z;
            if (dx < 0.1 && dz < 0.1) {
              problems.push(
                `SIRA ÇAKIŞMASI: ${st.def.name} sıra ${i} (${_pt.x.toFixed(1)}, ${_pt.z.toFixed(1)}) ` +
                  `→ ${other.def.name} gövdesinin içinde`,
              );
            }
          }
        }
      }
      if (k === 'table') {
        for (let i = 0; i < st.seats; i++) {
          if (this.seatApproach(st, i, _pt)) check(`${st.def.name} · sandalye yaklaşımı ${i}`, _pt.x, _pt.z);
          else problems.push(`SANDALYE ERİŞİLEMEZ: ${st.id}/${i}`);
        }
      }
    }
    check('Kapı', this.loc.door.x, this.loc.door.z);
    check('Personel dinlenme', this.loc.staffRest.x, this.loc.staffRest.z);

    /**
     * KAPI KORİDORU — nokta denetimi yetmez.
     *
     * `check('Kapı', …)` yalnızca kapının merkezinin erişilebilir olduğunu
     * sorar ve 0,5 birimlik toleransı vardır; kapının tam önüne konan bir
     * kitaplığı GÖRMEZ. Gerçekte olan şuydu: giriş tıkanınca çıkmak isteyen
     * müşteriler kapıya varamadı, `done` hiç true olmadı, 16'sı birden
     * nüfus tavanını sonsuza kadar tuttu ve kafe sessizce kazanmayı bıraktı.
     * Ekranda hiçbir hata yoktu — yalnızca gelir sıfırlanıyordu.
     *
     * Bu yüzden kapının önündeki koridorun BOŞ olduğu ayrıca ölçülür.
     */
    const door = this.loc.door;
    const inward = door.z > (this.loc.bounds.z0 + this.loc.bounds.z1) / 2 ? -1 : 1;
    for (const s of this.collectSolids()) {
      if (!s.station && s.name.startsWith('dekor:') === false) continue;
      for (let step = 0; step <= 3; step++) {
        const px = door.x;
        const pz = door.z + inward * step * 1.2;
        const dx = Math.abs(px - s.x) - s.hx;
        const dz = Math.abs(pz - s.z) - s.hz;
        // Kapı ekseninde 1,1 birimlik yarı genişlikte serbest koridor şart.
        if (dx < 1.1 && dz < 1.1) {
          problems.push(
            `KAPI TIKALI: ${s.name} girişin ${(step * 1.2).toFixed(1)} birim önünde — ` +
              `çıkamayan müşteri nüfus tavanını kilitler`,
          );
          break;
        }
      }
    }

    const a = this.loc.aisle;
    const aisleGap = this.nav.narrowestGap(a.z0, a.z1, this.loc.bounds.x0 + 1, this.loc.bounds.x1 - 1);
    if (aisleGap < 2.5) problems.push(`PERSONEL KORİDORU DAR: ${aisleGap.toFixed(1)} birim (>= 2,5 olmalı)`);

    const fa = this.loc.frontAisle;
    const frontGap = this.nav.narrowestGap(fa.z0, fa.z1, this.loc.bounds.x0 + 1, this.loc.bounds.x1 - 1);
    if (frontGap < 1.8) problems.push(`ÖN KORİDOR DAR: ${frontGap.toFixed(1)} birim (>= 1,8 olmalı)`);

    problems.push(...this.validateClearances(), ...this.validateStaffHirePads());
    return problems;
  }

  /**
   * BOĞAZ DENETİMİ — erişilebilirlik yeterli değil.
   *
   * Taşma testi 0,5 birimlik bir çatlağı bile "erişilebilir" sayar: A*
   * oradan yol bulur ama karakter DİREKSİYONU geçemez ve sonsuza kadar
   * kenarda salınır. (Soak testinde bir komi tam olarak böyle bir cebe
   * sıkışıp 240 saniye kıpırdayamadı.) O yüzden yan yana duran her
   * istasyon çiftinin gövde arası boşluğu ölçülür.
   */
  /** Ground markers stay clear of real work points, queues and purchase circles. */
  validateStaffHirePads(): string[] {
    const issues: string[] = [];
    const mask = this.nav.reachableMask(this.loc.playerStart.x, this.loc.playerStart.z);
    const half = STAFF_HIRE_PAD_HALF;
    const pads = Object.entries(this.loc.staffHirePads) as [StaffRole, { x: number; z: number; station: string }][];
    for (const [role, point] of pads) {
      const tag = this.loc.id + '/' + role;
      if (!this.nav.maskHas(mask, point.x, point.z, 0) || this.nav.solidBlocked(point.x, point.z, 0.32))
        issues.push('İŞE ALIM ERİŞİLEMEZ: ' + tag);
      const anchor = this.byId.get(point.station);
      if (!anchor || dist(point.x, point.z, anchor.x, anchor.z) > 5)
        issues.push('İŞE ALIM İŞTEN UZAK: ' + tag);
      for (const solid of this.collectSolids()) {
        if (Math.abs(point.x - solid.x) < half + solid.hx && Math.abs(point.z - solid.z) < half + solid.hz)
          issues.push('İŞE ALIM GÖVDE ÇAKIŞMASI: ' + tag + ' / ' + solid.name);
      }
      for (const station of this.stations) {
        station.servicePoint(_pt);
        if (Math.abs(point.x - _pt.x) < half + 0.2 && Math.abs(point.z - _pt.z) < half + 0.2)
          issues.push('İŞE ALIM SERVİS ÇAKIŞMASI: ' + tag + ' / ' + station.id);
        if (station.def.kind !== 'counter') continue;
        for (let i = 0; i <= BALANCE.customers.maxQueue + 2; i++) {
          station.queueSlot(i, _pt);
          if (Math.abs(point.x - _pt.x) < half + 0.4 && Math.abs(point.z - _pt.z) < half + 0.4)
            issues.push('İŞE ALIM SIRA ÇAKIŞMASI: ' + tag + ' / ' + station.id);
        }
      }
      for (const zone of this.loc.zones) {
        if (zone.cost <= 0) continue;
        const dx = Math.max(0, Math.abs(point.x - zone.padX) - half);
        const dz = Math.max(0, Math.abs(point.z - zone.padZ) - half);
        if (Math.hypot(dx, dz) < 2) issues.push('İŞE ALIM ÖDEME ÇAKIŞMASI: ' + tag + ' / ' + zone.id);
      }
    }
    return issues;
  }

  private validateClearances(): string[] {
    const problems: string[] = [];
    /**
     * ÜÇ BÖLGE — "dar" tek başına hata değildir.
     *
     * İlk sürüm her 1,5 birimin altındaki boşluğu uyarı sayıyordu ve 28
     * uyarı üretiyordu; bunların çoğu duvara DAYALI dolap, tuvalet ya da
     * masaya ait şemsiye gibi kasıtlı yerleşimlerdi. Uyarı listesi
     * eyleme dönüşmüyorsa yoktur.
     *
     * Bu denetimin var oluş sebebi tek bir hata sınıfıdır: A*'ın yol
     * bulduğu ama karakter direksiyonunun geçemediği aralık — komiyi 240
     * saniye cebe kilitleyen şey buydu. O yüzden ölçek üçe ayrılır:
     *
     *   boşluk < 0,15  → fiilen kapalı. A* zaten oradan geçmez; kasıtlı
     *                    dayalı yerleşimdir, sorun değil.
     *   0,15 – 0,95    → TUZAK. Izgarada geçit görünür, gövde sığmaz.
     *                    (Karakter gövde çapı 0,60.)
     *   0,95 – 1,50    → geçilir ama sıkışık; yalnızca bilgi notu.
     */
    const SEALED = 0.15;
    /**
     * TUZAK EŞİĞİ ÖLÇÜLEREK 1,25'E YÜKSELTİLDİ.
     *
     * İlk değer 0,60 (gövde çapı) mantığıyla 0,95 seçilmişti ve YANLIŞ
     * çıktı: bir kova ile duvar arasında 0,96 birim bırakıldığında beş
     * garson üst üste o aralıkta kilitlendi. Sebep, gövdenin tek başına
     * geçmesi yetmiyor olması — `nav.resolve(actor, 0.3)` her karede 0,3
     * yarıçapla dışarı iter, yani 0,96'lık aralıkta kullanılabilir orta
     * hat yalnızca 0,96 − 2×0,3 = 0,36 birim kalıyor ve yönlendirme
     * salınıma giriyor. Geçiş için gerçek gereksinim ≈ çap + iki yandan
     * itme payı ≈ 1,2.
     */
    /**
     * TUZAK eşiği GÖVDE ÇAPINDAN türetilir: karakter 0,60 birim, direksiyon
     * payı ~0,35 → 0,95. Bunun üstü fiilen geçilebilir. Bir ara 1,25'e
     * çıkmıştı ve 1,22 birimlik rahat geçitleri "tuzak" diye bildiriyordu;
     * yanlış alarm, doğrulayıcıyı işe yaramaz hâle getirir.
     */
    const TRAP = 0.95;
    const COMFORT = 1.5;
    /** Bar hattı KASITLI olarak süreklidir — arasından geçilmez. */
    const onBar = (k: string) => k === 'pickup' || k === 'counter';

    /**
     * Denetim dört noktada kördü, dördü de kapatıldı:
     *
     *  1. `gap < 0` durumunda `continue` ediliyordu — yani GERÇEKTEN
     *     ÇAKIŞAN iki gövde, mümkün olan en gürültülü hata, sessizce
     *     yutuluyordu.
     *  2. `gapX >= 0 && gapZ >= 0` ile ÇAPRAZ çiftler atlanıyordu; oysa
     *     0,3/0,3'lük çapraz bir boğaz gerçekte 0,42 birimdir ve
     *     karakter oradan geçemez.
     *  3. Yalnızca istasyon↔istasyon bakılıyordu; çevre duvarları ve
     *     dekor görünmezdi.
     *  4. Boğaz "eksen hizalı" varsayılıyordu.
     */
    const solids = this.collectSolids();
    const enclosures = new Map(this.stations.map(st => [st.def.name,
      this.loc.zones.find(z => z.id === st.def.zone)?.room]));
    const screenedFromOuterNorth = (station: typeof solids[number], wall: typeof solids[number]): boolean => {
      if (!station.station || wall.name !== 'Kuzey duvarı') return false;
      const room = enclosures.get(station.name);
      // A closed room wall already seals this side. Its own station clearance
      // is still checked; the building wall behind it cannot form a second aisle.
      return !!room && room.door.edge !== 'n' && room.z0 > this.loc.bounds.z0 + .5 &&
        station.z - station.hz >= room.z0 + .15 - 1e-6;
    };

    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) {
        const a = solids[i];
        const b = solids[j];
        if (a.bar && b.bar) continue;
        // Aynı istasyonun parçaları / duvarların birbiriyle ilişkisi anlamsız.
        if (!a.station && !b.station) continue;
        if (screenedFromOuterNorth(a, b) || screenedFromOuterNorth(b, a)) continue;

        const gapX = Math.abs(a.x - b.x) - (a.hx + b.hx);
        const gapZ = Math.abs(a.z - b.z) - (a.hz + b.hz);

        if (gapX < 0 && gapZ < 0) {
          problems.push(
            `ÇAKIŞMA: ${a.name} ↔ ${b.name} — gövdeler ` +
              `${Math.min(-gapX, -gapZ).toFixed(2)} birim iç içe`,
          );
          continue;
        }
        // Gerçek boşluk: bir eksende ayrıksa o eksenin boşluğu, ikisinde de
        // ayrıksa köşegen mesafe.
        const gap =
          gapX >= 0 && gapZ >= 0 ? Math.hypot(gapX, gapZ) : gapX >= 0 ? gapX : gapZ;
        if (gap < SEALED) continue; // kasıtlı dayalı yerleşim
        if (isKnownSafeGap(a.name, b.name)) continue;
        if (gap < TRAP) {
          problems.push(
            `TUZAK RİSKİ: ${a.name} ↔ ${b.name} arası ${gap.toFixed(2)} birim — ` +
              `A* geçit görür, gövde (0,60) sığmaz`,
          );
        } else if (gap < COMFORT) {
          problems.push(`SIKIŞIK: ${a.name} ↔ ${b.name} arası ${gap.toFixed(2)} birim`);
        }
      }
    }
    return problems;
  }

  /**
   * Denetim için tek bir katı gövde listesi: istasyonlar + çevre duvarları
   * + dekor ayak izleri. Duvarlar ince ama uzun dikdörtgenler olarak
   * modellenir; VIP loca gibi kenara yaslanmış istasyonların duvarla
   * arasında bıraktığı boğaz ancak böyle görünür.
   */
  private collectSolids(): { name: string; x: number; z: number; hx: number; hz: number; bar: boolean; station: boolean }[] {
    const out: { name: string; x: number; z: number; hx: number; hz: number; bar: boolean; station: boolean }[] = [];
    for (const st of this.stations) {
      // Gizli istasyon sahnede yok — engel de değil, boğaz da yaratamaz.
      if (this.furnitureVisibility(st) === 'hidden') continue;
      const f = footprint(st);
      out.push({
        name: st.def.name,
        x: st.x,
        z: st.z,
        hx: f.x,
        hz: f.z,
        bar: st.def.kind === 'pickup' || st.def.kind === 'counter',
        station: true,
      });
    }
    /**
     * ODA DUVARLARI da katıdır: masayla oda duvarı arasındaki boğaz ancak
     * böyle görünür. Duvar↔duvar çifti anlamsızdır; `station:false`
     * verilir ve çift döngüsündeki `!a.station && !b.station` bunları atlar.
     */
    for (const w of roomWalls(this.loc)) {
      out.push({
        name: `oda duvarı (${w.zone})`,
        x: (w.x0 + w.x1) / 2,
        z: (w.z0 + w.z1) / 2,
        hx: (w.x1 - w.x0) / 2,
        hz: (w.z1 - w.z0) / 2,
        bar: false,
        station: false,
      });
    }
    const b = this.loc.bounds;
    const T = 0.5; // duvar yarı kalınlığı
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const hx = (b.x1 - b.x0) / 2;
    const hz = (b.z1 - b.z0) / 2;
    out.push({ name: 'Kuzey duvarı', x: cx, z: b.z0 - T, hx, hz: T, bar: false, station: false });
    out.push({ name: 'Güney duvarı', x: cx, z: b.z1 + T, hx, hz: T, bar: false, station: false });
    out.push({ name: 'Batı duvarı', x: b.x0 - T, z: cz, hx: T, hz, bar: false, station: false });
    out.push({ name: 'Doğu duvarı', x: b.x1 + T, z: cz, hx: T, hz, bar: false, station: false });
    for (const d of this.loc.decor ?? []) {
      // Yalnızca yerde gerçekten yer kaplayan dekor sayılır; halı, duvar
      // resmi ve asma bitki engel değildir (bkz. DECOR_BOX).
      const half = decorHalf(d);
      if (!half) continue;
      // Gizli bölümün dekoru sahnede yok (kilitli odanın içi).
      if (d.zone && this.zoneVisibility(d.zone) === 'hidden') continue;
      out.push({ name: `dekor:${d.kind}`, x: d.x, z: d.z, hx: half.x, hz: half.z, bar: false, station: false });
    }
    return out;
  }

  /** GÖRÜŞ HATTI DENETİMİ — mimari bir istasyonun önüne düşüyor mu? */
  validateSightlines(camera: THREE.Camera): string[] {
    const problems: string[] = [];
    camera.updateMatrixWorld(true);
    this.root.updateMatrixWorld(true);

    const blockers: THREE.Object3D[] = [];
    for (const child of this.root.children) {
      const n = child.name ?? '';
      if (!n.startsWith('env_') && !n.startsWith('decor')) continue;
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.visible) blockers.push(m);
      });
    }
    if (blockers.length === 0) return problems;

    const cam = camera.getWorldPosition(_v3).clone();
    const proj = camera as THREE.PerspectiveCamera;
    proj.updateProjectionMatrix();
    _projScreen.multiplyMatrices(proj.projectionMatrix, proj.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreen);

    for (const st of this.stations) {
      /**
       * HEDEF YÜKSEKLİĞİ KOTU İÇERMEK ZORUNDA.
       *
       * `y = 1.2` sabitti ve kot farkını yok sayıyordu: VIP terası 0,9
       * birim yükseltilmiş bir podyumun üstünde durduğu için oradaki bir
       * masanın 1,2'si terasın KENDİ zemininin 30 cm altına düşüyor. Işın
       * doğal olarak podyumun kendisine çarpıyor ve doğrulayıcı üç VIP
       * masası için "GÖRÜŞ KAPALI" diye YANLIŞ ALARM veriyordu.
       *
       * Yanlış alarm bu projede tek başına bir hata sınıfıdır: doğrulayıcı
       * gerçek bulguyla gürültüyü ayıramaz hâle gelir ve okuyan kişi
       * listeyi tümden yok saymaya başlar (bkz. `validateClearances`'ta
       * 28 uyarılık ilk sürüm). Kot artık `floorLiftAt` ile okunuyor —
       * çizime giren her şeyin zaten kullandığı fonksiyon.
       */
      const eyeY = floorLiftAt(this.loc, st.x, st.z) + 1.2;
      _stationPoint.set(st.x, eyeY, st.z);
      if (!_frustum.containsPoint(_stationPoint)) continue;
      _ray.set(st.x, eyeY, st.z).sub(cam);
      const distance = _ray.length();
      if (distance < 0.1) continue;
      _ray.normalize();
      _caster.set(cam, _ray);
      _caster.near = 0;
      _caster.far = distance - 0.6;
      const hits = _caster.intersectObjects(blockers, false);
      if (hits.length > 0) {
        const first = hits[0].object;
        let label = first.name;
        let parent: THREE.Object3D | null = first.parent;
        let depth = 0;
        while (!label && parent && depth++ < 4) {
          label = parent.name;
          parent = parent.parent;
        }
        problems.push(`GÖRÜŞ KAPALI: ${st.def.name} ← ${label || '(isimsiz mesh)'}`);
      }
    }
    return problems;
  }

  /* ============================================================ *
   *  Bölüm kilidi
   * ============================================================ */

  unlockZone(zoneId: string, method: 'pad' | 'menu' | 'unknown' = 'unknown'): void {
    const zone = this.loc.zones.find((z) => z.id === zoneId);
    if (!zone || this.zoneUnlocked(zoneId)) return;
    const refund = Math.max(0, (this.padProgress.get(zoneId) ?? 0) - zone.cost);
    this.padProgress.set(zoneId, zone.cost);
    if (refund > 0) {
      this.state.grant(refund);
      bus.emit('toast', { text: tr('Önceki ödemenden ₺{0} iade edildi', formatShort(refund)), glyph: '↩', tone: 'good' });
    }
    this.state.unlockZone(this.loc.id, zoneId, zone.name, method);
    const opening = this.stations
      .filter((st) => st.def.zone === zoneId)
      .sort((a, b) => dist(a.x, a.z, zone.padX, zone.padZ) - dist(b.x, b.z, zone.padX, zone.padZ));
    for (let i = 0; i < opening.length; i++) {
      const st = opening[i];
      st.locked = false;
      const visual = this.stationVisuals.get(st.id);
      visual?.setLocked(false);
      visual?.playUnlock(Math.min(i * 0.04, 0.12));
      const pickupVisual = this.pickupVisuals.get(st.id);
      pickupVisual?.setLocked(false);
      pickupVisual?.playUnlock(Math.min(i * 0.04, 0.12));
      // Branda uçarken eşyanın üstünde küçük bir toz bulutu
      this.vfx?.puff(st.x, 0.25, st.z, zone.accent, 2);

    }
    this.env?.setZoneUnlocked(zoneId, true, true);
    // Açılan bölümün ardındaki bölüm artık "sıradaki" olur: brandası ve pedi belirir.
    this.syncLocks();
    /**
     * Her açılım geometriyi DEĞİŞTİRİR (özellikle oda kapıları). Açılış
     * doğrulaması yalnız başlangıç kombinasyonunu görür; burada her yeni
     * kombinasyon da denetlenir — kilitliyken görünmeyen bir tuzak,
     * açıldığı anda yakalansın.
     */
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('validateLayout')) {
      const problems = this.validateLayout();
      if (problems.length > 0) {
        console.warn(`[Yerleşim] "${zone.name}" açıldıktan sonra ${problems.length} sorun:\n` + problems.map((p) => '  • ' + p).join('\n'));
      }
    }
    this.vfx?.ring(zone.padX, 0.15, zone.padZ, zone.accent, 5);
    for (let i = 0; i < 4; i++) {
      this.vfx?.sparkle(
        zone.padX + this.rng.range(-2, 2),
        this.rng.range(0.5, 2.2),
        zone.padZ + this.rng.range(-2, 2),
        zone.accent,
      );
    }
  }

  zoneUnlocked(zoneId: string): boolean {
    return this.state.isZoneUnlocked(this.loc.id, zoneId);
  }

  nextLockedZone(): ZoneDef | null {
    for (const z of this.loc.zones) {
      if (this.zoneUnlocked(z.id)) continue;
      if (z.requires && !this.zoneUnlocked(z.requires)) continue;
      return z;
    }
    return null;
  }

  /* ============================================================ *
   *  İlerleme
   * ============================================================ */

  get progress(): number {
    const zones = this.loc.zones;
    const zoneRatio = zones.filter((z) => this.zoneUnlocked(z.id)).length / zones.length;
    let levels = 0;
    let maxLevels = 0;
    for (const st of this.stations) {
      if (st.canUpgradeSpeed || st.speedLevel > 0) {
        levels += st.speedLevel;
        maxLevels += STATION_SPEED_MAX;
      }
      if (st.canUpgradeCap || st.capLevel > 0) {
        levels += st.capLevel;
        maxLevels += STATION_CAP_MAX;
      }
    }
    const upgradeRatio = maxLevels > 0 ? levels / maxLevels : 0;
    return clamp01(zoneRatio * 0.55 + upgradeRatio * 0.45);
  }

  /* ============================================================ *
   *  Sorgular
   * ============================================================ */

  /** Açık menü makineleri (sarf deposu hariç). */
  openMachines(): StationEntity[] {
    return this.machines.filter((m) => !m.locked && m.def.item && isProduct(m.def.item));
  }

  /** MENÜ = açık makinelerin ürettiği ürünler. */
  menuItems(): ItemId[] {
    return this.openMachines()
      .slice()
      .sort((a, b) => (a.def.menuOrder ?? 99) - (b.def.menuOrder ?? 99))
      .map((m) => m.def.item!)
      .filter((i): i is ItemId => !!i);
  }

  machineFor(item: ItemId): StationEntity | null {
    for (const m of this.machines) if (!m.locked && m.def.item === item) return m;
    return null;
  }

  openPickups(): StationEntity[] {
    return this.pickups.filter((p) => !p.locked);
  }

  openCounters(): StationEntity[] {
    return this.counters.filter((c) => !c.locked);
  }

  /** Bu ürünü kabul edebilecek istasyonlar: teslim bankosu ve (sarfsa) tuvalet. */
  consumersOf(item: ItemId): StationEntity[] {
    const out: StationEntity[] = [];
    if (isProduct(item)) {
      for (const p of this.pickups) if (!p.locked && p.canAccept(item)) out.push(p);
    } else if (isSupply(item)) {
      for (const wc of this.toilets) if (!wc.locked && wc.canAccept(item)) out.push(wc);
    }
    return out;
  }

  itemValue(item: ItemId): number {
    return ITEMS[item].price * this.loc.valueMult * (this.valueBonus.get(item) ?? 1);
  }

  /** Ürün başına istasyon yükseltme değer çarpanı (bkz. refreshValueBonus). */
  private valueBonus = new Map<ItemId, number>();

  /**
   * İSTASYON YÜKSELTMESİ ÜRÜNÜN DEĞERİNİ ARTIRIR.
   *
   * Ölçüm zinciri şuraya vardı: istasyon hız yükseltmelerini 0'dan 8'e
   * çıkarmak geliri hiç değiştirmiyordu (A/B/A, üçer koşu: %−7 ve %−6).
   * Sebebi arayınca üretimin ZATEN darboğaz olmadığı çıktı — bankolar
   * sürekli dolu, gecikme serviste. Yani makineyi hızlandırmak yapısal
   * olarak hiçbir şeye yaramıyordu; oyuncu milyarlarca lirayı görünmeyen
   * bir şeye harcıyordu.
   *
   * Bu yüzden yükseltme ikinci bir etki kazandı: daha iyi makine daha
   * DEĞERLİ ürün yapar. Hız seviyesi başına +%6, depo seviyesi başına
   * +%3 — tam yükseltilmiş bir makinenin ürünü 1,72 katına çıkar. Bu etki
   * darboğazdan bağımsızdır, yani oyuncu parasının karşılığını her zaman
   * görür.
   */
  refreshValueBonus(): void {
    // Kalıcı prestij hızı da burada tazelenir (aynı tetikleyiciler).
    const ps = this.state.prestigeSpeedMult;
    for (const st of this.stations) st.prestigeSpeed = ps;
    this.valueBonus.clear();
    for (const m of this.machines) {
      if (!m.def.item) continue;
      this.valueBonus.set(m.def.item, 1 + m.speedLevel * 0.06 + m.capLevel * 0.03);
    }
  }

  /** Menünün ortalama fiyatı. */
  get averageMenuValue(): number {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < this.machines.length; i++) {
      const m = this.machines[i];
      if (!m.locked && m.def.item && isProduct(m.def.item)) {
        sum += this.itemValue(m.def.item);
        count++;
      }
    }
    return count > 0 ? sum / count : ITEMS.cay.price;
  }

  /**
   * Menünün EN UCUZ ürünü — temizlik ödülleri buna göre ölçeklenir.
   *
   * Eskiden ortalama kullanılıyordu ve bu Sahil şubesinde çöküyordu:
   * oradaki menü ortalaması ₺3.733 olduğu için tek bir tuvalet
   * fırçalaması ₺5.500'den fazla ödüyor, yani servis edilen bir
   * siparişten daha kârlı hâle geliyordu. Temizlik ikinci gelir kalemi
   * olmalı, birinci değil.
   */
  get cheapestMenuValue(): number {
    let min = Infinity;
    for (let i = 0; i < this.machines.length; i++) {
      const m = this.machines[i];
      if (!m.locked && m.def.item && isProduct(m.def.item)) {
        const v = this.itemValue(m.def.item);
        if (v < min) min = v;
      }
    }
    return Number.isFinite(min) ? min : ITEMS.cay.price;
  }

  /* ---------------- salon & hijyen ---------------- */

  get salonOpen(): boolean {
    return this.tables.some((t) => !t.locked);
  }

  get hygieneActive(): boolean {
    return this.salonOpen;
  }

  /** Temizlik ÇARPANI: 0,85–1,25. Ceza değil, bonus. */
  get hygieneMult(): number {
    if (!this.hygieneActive) return 1;
    const h = BALANCE.hygiene;
    return h.minMult + (h.maxMult - h.minMult) * clamp01(this.hygiene / 100);
  }

  get dirtyTableCount(): number {
    let n = 0;
    for (const t of this.tables) if (!t.locked && t.dishes > 0) n++;
    return n;
  }

  get spillCount(): number {
    return this.spills.count;
  }

  get seatsUsed(): number {
    let n = 0;
    for (const t of this.tables) if (!t.locked) n += t.seatedGuests.length;
    return n;
  }

  get seatsTotal(): number {
    let n = 0;
    for (const t of this.tables) if (!t.locked) n += t.seats;
    return n;
  }

  /** Oturulabilir (temiz ve boş) sandalye sayısı. */
  get freeSeats(): number {
    let n = 0;
    for (const t of this.tables) {
      if (t.locked || t.dishes > 0 || t.soil > 0.02) continue;
      for (let i = 0; i < t.seats; i++) if (!t.seatTaken[i]) n++;
    }
    return n;
  }

  get toiletOpen(): boolean {
    return this.toilets.some((t) => !t.locked);
  }

  get supplyLevel(): number {
    let have = 0;
    let cap = 0;
    for (const wc of this.toilets) {
      if (wc.locked || !wc.def.supplies) continue;
      for (const s of wc.def.supplies) {
        have += wc.supplyOf(s.item);
        cap += wc.supplyCap(s.item);
      }
    }
    return cap > 0 ? clamp01(have / cap) : 1;
  }

  get pendingOrders(): number {
    // v5: servis boru hattı = rafa yürüyen ya da rafta bekleyen müşteri.
    // Masada YEMEK YİYEN müşteri boru hattında değildir (masa baskısını
    // noSeatGrace yönetir); toTable'daki müşteri ürününü almıştır ama
    // hâlâ sahnede yer tutar, sayılır.
    let n = 0;
    for (const c of this.customers) {
      if (
        c.order &&
        (c.state === 'pickup' || c.state === 'toPickup' || c.state === 'toTable' || (c.state === 'seated' && !c.eating))
      ) n++;
    }
    return n;
  }

  /**
   * TOZ BİRİKMESİ — kafenin ikinci ritmi.
   *
   * Müşteriye bağlı değil: düzenli aralıklarla, açılmış bölümlerin rastgele
   * bir noktasında birikir. Kafe büyüdükçe sıklaşır (daha çok yer = daha çok
   * toz), ama toplam sayısı sınırlıdır ki oyuncu boğulmasın.
   */
  private updateDust(dt: number): void {
    if (!this.salonOpen) return;
    this.dustTimer -= dt;
    if (this.dustTimer > 0) return;
    const v = BALANCE.vacuum;
    const openTables = this.tables.filter((t) => !t.locked);
    const scale = Math.max(0.45, 1 - openTables.length * 0.05);

    /**
     * BOŞA GİDEN TUR HATASI. Zamanlayıcı eskiden kontrollerden ÖNCE tam
     * aralığa kuruluyordu: doğum noktası sınır dışına düşerse ya da tavan
     * doluysa o tur TAMAMEN kayboluyor, fiili toz üretimi ayarlanan
     * aralığın belirgin altında kalıyordu. Başarısızlıkta kısa bir tekrar
     * denemesi kurulur; yalnız gerçekten toz doğduğunda tam aralık.
     *
     * Ayrıca zorluk çarpanı (`dirtScale`, 1,00 → 1,28) artık toza da
     * uygulanıyor — "kafe büyüdükçe daha çabuk kirlenir" vaadi toz için
     * yalnızca dolaylı (masa sayısı) işliyordu.
     */
    const retry = (): void => {
      this.dustTimer = 2.5;
    };
    const full = (): void => {
      this.dustTimer = (this.rng.range(v.spawnInterval[0], v.spawnInterval[1]) * scale) / this.dirtScale;
    };

    let dust = 0;
    for (const s of this.spills.list) if (s.kind === 'toz') dust++;
    if (dust >= v.maxDust) {
      // Tavan dolu: kısa aralıklarla değil, tam aralıkla yeniden bak
      // (oyuncu temizleyene kadar denemenin anlamı yok).
      full();
      return;
    }

    /**
     * DOĞUM NOKTASI. Eskiden yalnız açık masaların 1,6-3,0 birimlik
     * halkasıydı: koridor, giriş, bar önü ve teras geçidi HİÇ tozlanmıyor,
     * "bütün kafe tozlanır" fantezisi kırılıyordu. Artık üçte iki masa
     * çevresi, üçte bir mekânın rastgele yürünebilir bir noktası.
     */
    const b = this.loc.bounds;
    let x = 0;
    let z = 0;
    const t = openTables[Math.floor(this.rng.next() * openTables.length)];
    if (t && this.rng.chance(0.62)) {
      const a = this.rng.range(0, Math.PI * 2);
      const rad = this.rng.range(1.6, 3.0);
      x = t.x + Math.cos(a) * rad;
      z = t.z + Math.sin(a) * rad;
    } else {
      x = this.rng.range(b.x0 + 1.4, b.x1 - 1.4);
      z = this.rng.range(b.z0 + 1.4, b.z1 - 1.4);
      // Erişilemez nokta (kilitli oda içi, masa gövdesi) `spawn` içindeki
      // `snapToWalkable` tarafından elenir; null dönerse aşağıda tekrar denenir.
    }
    if (x < b.x0 + 1.2 || x > b.x1 - 1.2 || z < b.z0 + 1.2 || z > b.z1 - 1.2) {
      retry();
      return;
    }
    const s = this.spills.spawn(x, z, 'toz');
    if (!s) {
      retry();
      return;
    }
    full();
    this.vfx?.puff(x, 0.2, z, 0xd8cfbb, 4);
  }

  /**
   * TRAFİK KİRİ BİRİKİMİ.
   *
   * Yalnız YÜRÜYEN aktör kirletir: oturan misafir ayak izi bırakmaz, yoksa
   * masaların altı mekânın en kara yeri olur ve iz "yol" değil "leke"
   * anlamına gelirdi. Oyuncu da kirletir — kendi koşturmacası da mekânı
   * yıpratır, bu adil.
   */
  private updateTraffic(dt: number, player: Player | null): void {
    if (!this.hygieneActive) return;
    const amt = BALANCE.dirt.traffic * dt;
    for (const c of this.customers) {
      if (c.planarSpeed > 0.4) this.grime.addTraffic(c.x, c.z, amt);
    }
    for (const s of this.staff) {
      if (s.planarSpeed > 0.4) this.grime.addTraffic(s.x, s.z, amt);
    }
    if (player && this.active && player.planarSpeed > 0.4) {
      this.grime.addTraffic(player.x, player.z, amt);
    }
    this.grime.settle(dt, BALANCE.dirt.settleRate);
  }

  /** Actual load components for UI and local tuning; each source can be tested separately. */
  get hygieneLoad() {
    const h = BALANCE.hygiene;
    let dishes = 0, surfaces = 0, toilets = 0, supplies = 0;
    for (const t of this.tables) if (!t.locked) {
      dishes += t.dishes * h.dropPerDish;
      surfaces += t.soil * h.dropPerDish;
    }
    for (const wc of this.toilets) if (!wc.locked) {
      toilets += wc.soil * h.dropPerToiletSoil;
      supplies += wc.supplyShortfall * BALANCE.toilet.emptySupplyHygieneDrop;
    }
    const spills = this.spills.totalAmount * h.dropPerSpill;
    const traffic = this.grime.heavyCoverage * BALANCE.dirt.grimeHygieneWeight;
    const total = dishes + surfaces + spills + traffic + toilets + supplies;
    return { dishes, surfaces, spills, traffic, toilets, supplies, total,
      target: this.hygieneActive ? 100 * (1 - clamp01(total / h.loadForZero)) : h.start };
  }

  private updateHygiene(dt: number): void {
    if (!this.hygieneActive) {
      this.hygiene = BALANCE.hygiene.start;
      return;
    }
    const h = BALANCE.hygiene;
    const target = this.hygieneLoad.target;
    this.hygiene += (target - this.hygiene) * Math.min(1, dt * h.settleRate);
    this.hygiene = clamp(this.hygiene, 0, 100);
    // Hijyen artık HUD'daki bir sayı değil: zemine yayılan kir katmanını sürer.
    this.env?.setHygiene(this.hygiene);
  }

  /**
   * Temizlik ödülü — menünün EN UCUZ ürününe göre ölçeklenir (bkz.
   * cheapestMenuValue). 1,5 katsayısı, ortalamaya göre düşen ödülü
   * telafi eder: temizlik hâlâ anlamlı para kazandırır, ama serviste
   * kazanılandan fazlasını asla ödemez.
   */
  private cleanReward(rate: number): number {
    // festivalCleanMult: TEMİZLİK HAFTASI'nda temizlik ödülleri ×1,5.
    return Math.max(
      1,
      Math.round(this.cheapestMenuValue * rate * 1.5 * this.state.saleMultiplier * festivalCleanMult()),
    );
  }

  /**
   * @param byPlayer Bu temizliği OYUNCU mu yaptı. Tempo yalnız oyuncu
   *   eylemlerinden beslenir; komi de `payClean` çağırıyor (bkz.
   *   updateBusser) ve o çağrılar tempoyu BESLEMEMELİ.
   */
  private payClean(rate: number, x: number, z: number, byPlayer = false): void {
    const v = this.cleanReward(rate);
    this.state.earn(v, x, z, 1.3);
    this.vfx?.coinBurst(x, 1.1, z, 2);
    if (byPlayer) this.bumpTempo(BALANCE.tempo.gain.clean);
  }

  /** Bir sandalyenin dünya konumu. */
  seatPoint(table: StationEntity, index: number, out: { x: number; y: number; z: number }): void {
    const angle=seatAngle(table.def.visual,table.seats,index)+(table.def.rot*Math.PI/180);
    const radius = seatRadius(table.id, table.seats);
    out.x=table.x+Math.sin(angle)*radius;
    out.z=table.z+Math.cos(angle)*radius;
    out.y=floorLiftAt(this.loc,table.x,table.z)+SEAT_HEIGHT+0.1;
  }

  /**
   * KÖK YÜKSEKLİĞİ = zemin − `CHAIR_SIT.drop`. `_seat.y` zemin + 0,6'dır;
   * oturma klibinde kalça altı kökün ~0,6 üstünde durur, minder üstü 0,55.
   * Kalibrasyon olmadan misafir minderin üstünde havada, sırtı arkalıktan
   * bir karış önde kalıyordu.
   */
  sitOnChair(c: Customer, table: StationEntity): void {
    this.seatPoint(table, c.seatIndex, _seat);
    c.sitAt(_seat.x, _seat.y - SEAT_HEIGHT - 0.1 - CHAIR_SIT.drop, _seat.z, table.x, table.z, CHAIR_SIT.back);
  }

  private chairSolids = new Map<string, number>();
  private toiletSeatSolids = new Map<string, number>();
  private seatApproaches = new Map<string, { x: number; z: number }>();

  /** Walking ends beside the chair. Only the seated transition enters that chair. */
  seatApproach(table: StationEntity, index: number, out: { x: number; z: number }): boolean {
    const key = table.id + '/' + index, cached = this.seatApproaches.get(key);
    if (cached) { out.x = cached.x; out.z = cached.z; return true; }
    const solid = this.chairSolids.get(key);
    if (solid === undefined) return false;
    const a = seatAngle(table.def.visual, table.seats, index) + table.def.rot * Math.PI / 180;
    const radius = seatRadius(table.id, table.seats);
    const sx = table.x + Math.sin(a) * radius, sz = table.z + Math.cos(a) * radius;
    const side = CHAIR_BODY.halfWidth + .34 + .06, back = CHAIR_BODY.halfDepth + .34 + .06;
    const path: number[] = [];
    for (const [lateral, outward] of [[side, 0], [-side, 0], [0, back], [side, back * .6], [-side, back * .6]]) {
      const x = sx + Math.cos(a) * lateral + Math.sin(a) * outward;
      const z = sz - Math.sin(a) * lateral + Math.cos(a) * outward;
      if (this.nav.solidBlocked(x, z, .34) || !this.nav.bodyLineClear(x, z, sx, sz, .3, solid)) continue;
      if (!this.nav.findPath(this.loc.playerStart.x, this.loc.playerStart.z, x, z, path) ||
          Math.hypot(path[path.length - 2] - x, path[path.length - 1] - z) > .02) continue;
      this.seatApproaches.set(key, { x, z }); out.x = x; out.z = z; return true;
    }
    return false;
  }

  /**
   * Boş masa seçimi. "EN YAKIN boş masa" kuralı odalı planda çürüdü:
   * sıra barın dibinde olduğu için ön salon masaları her zaman kazanıyor,
   * 10 dakikalık soak'ta SALON ODASI ve VIP masalara TEK misafir bile
   * oturmuyordu — oyuncunun ₺650.000 verdiği oda ölü yatırım görünüyordu.
   *
   * Yeni kural: (1) boş VIP masa varsa misafirlerin bir kısmı bilerek
   * oraya gider (2,4× hesap ödeyen masa boş kalmasın); (2) kalanlar
   * 1/(4+mesafe) ağırlıklı rastgele seçer — yakın masa hâlâ avantajlı
   * ama tekel değil, odalar organik dolar.
   */
  findFreeTable(fromX: number, fromZ: number): StationEntity | null {
    TABLE_PICK.length = 0;
    let vipCount = 0;
    for (const t of this.tables) {
      if (!t.canSeat) continue;
      TABLE_PICK.push(t);
      if (t.def.vip) vipCount++;
    }
    if (TABLE_PICK.length === 0) return null;
    /**
     * VIP kanalı: boş VIP masa varsa misafirlerin ~%10'u doğrudan oraya
     * gider. %25 denendi ve fazla geldi: en UZAK oda en çok trafiği alıp
     * garsonları eritiyordu. %10, sekiz VIP koltuğu "boş yatırım" olmaktan
     * çıkarmaya yetiyor (soak: VIP'te sürekli 1-2 dolu masa).
     */
    if (vipCount > 0 && this.rng.chance(0.1)) {
      let k = Math.floor(this.rng.range(0, vipCount));
      for (const t of TABLE_PICK) {
        if (t.def.vip && k-- === 0) return t;
      }
    }
    /**
     * Mesafe KARESİYLE sönen ağırlık: hafif yükte misafirler bara yakın
     * oturur (servis kısa, oyuncu az yürür), yoğunlukta yakın masalar
     * adaylıktan düşünce taşma DOĞAL olarak odalara akar. Düz 1/(4+d)
     * denemesi herkesi mekâna eşit dağıttı ve 10 dakikalık soak'ta servis
     * 269'dan 82'ye düştü — üç garson yolda eridi.
     */
    const weight = (t: StationEntity) => {
      const d = dist(fromX, fromZ, t.x, t.z);
      return 1 / (2 + d * d * 0.12);
    };
    let total = 0;
    for (const t of TABLE_PICK) total += weight(t);
    let r = this.rng.range(0, total);
    for (const t of TABLE_PICK) {
      r -= weight(t);
      if (r <= 0) return t;
    }
    return TABLE_PICK[TABLE_PICK.length - 1];
  }

  nearestBin(fromX: number, fromZ: number, uid?: string): StationEntity | null {
    let best: StationEntity | null = null;
    let bestD = Infinity;
    for (const b of this.bins) {
      if (b.locked) continue;
      if (uid && b.isReservedByOther(uid)) continue;
      const d = dist(fromX, fromZ, b.x, b.z);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  dirtiestTable(fromX: number, fromZ: number, uid?: string, minDirtyAge = 0): StationEntity | null {
    let best: StationEntity | null = null;
    let bestScore = 0;
    for (const t of this.tables) {
      if (t.locked || (t.dishes <= 0 && t.soil <= 0.02)) continue;
      if (t.dirtyAge < minDirtyAge) continue;
      // Oyuncunun başladığı iş için kısa bir sahiplik penceresi vardır;
      // yarım bırakılan masa sonsuza dek komiye yasaklanmaz.
      if (t.cleanValue > 0 && t.dirtyAge < 12) continue;
      if (uid && t.isReservedByOther(uid)) continue;
      const d = dist(fromX, fromZ, t.x, t.z);
      const score = (t.dishes + t.soil) / (3 + d * 0.25);
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  /** Bu ürünü şu an bekleyen toplam adet. */
  demandFor(item: ItemId): number {
    let n = 0;
    for (const c of this.customers) {
      if (c.eating || !c.order) continue;
      for (const l of c.order.lines) if (l.item === item) n += l.qty - l.served;
    }
    return n;
  }

  /* ============================================================ *
   *  Güncelleme
   * ============================================================ */

  /* ---- v5.1 reklam ödülü / yan-dal çarpan durumu (Game + syncLocks yazar) ---- */
  /** "Usta Modu" reklam ödülü: el-ver bonusu TÜM makinelerde. */
  ustaMode = false;
  /** Kare başına gelen sabır/bahşiş çarpanları (mods'tan kopyalanır). */
  private patienceBoost = 1;
  private tipBoost = 1;
  /** Yan-dal bölgelerinin kalıcı küçük bonusları (refreshSideBonuses). */
  private sidePatienceMult = 1;
  private sideValueMult = 1;
  sideSpawnMult = 1;
  /** Yoğun saatte normal otomasyon durur; siparişi ve ikmali oyuncu yönetir. */
  private rushPlayerOnly = false;

  update(dt: number, player: Player | null, mods: EventModifiers): void {
    this.assistPlayer = this.active ? player : null;
    if (this.playerCare) {
      this.playerCare.remaining -= dt;
      if (this.playerCare.remaining <= 0) this.playerCare = null;
    }
    this.updateTempo(dt);
    this.applyTempoCapacity();
    this.eventValueMult = mods.valueMult;
    this.rushPlayerOnly = mods.spawnMult > 1.2;
    this.patienceBoost = mods.patienceMult * this.sidePatienceMult;
    this.tipBoost = mods.tipMult;
    /**
     * v5 — "EL VER": oyuncu bir makinenin 2,4 birim yakınındaysa o makine
     * 2× hızlı çalışır (Station.update okur). Oyuncunun istasyon başında
     * durması, otomasyon büyüdükçe de anlamlı kalan bir katkıdır.
     */
    for (const st of this.stations) {
      const boostable = !st.locked && (st.def.kind === 'machine' || st.def.kind === 'supply');
      // Oyuncunun GERÇEK mesafeye dayalı yakınlığı — playerNear'dan ayrı
      // tutulur çünkü playerNear Usta Modu'nda TÜM istasyonlarda true olur
      // (aşağıya bkz). nearPlayer bu OR'u içermez, yalnız gerçek mesafeyi okur.
      const nearPlayer = boostable && player !== null && dist(player.x, player.z, st.x, st.z) < 2.4;
      st.playerNear = boostable && (this.ustaMode || nearPlayer);
      /**
       * Tempo YALNIZ `nearPlayer`'ı okur, `st.playerNear`'ı DEĞİL.
       *
       * Usta Modu satın alınmış 180 sn'lik PASİF bir zamanlayıcıdır (bkz.
       * Game.ts) — o an oyuncunun yaptığı bir iş değil, geçmişte alınmış
       * bir ödül. `playerNear`'ı okusaydı: buff açıkken haritadaki HER
       * kilitsiz makine/sarf istasyonu playerNear=true raporlar, oyuncu
       * haritanın öbür ucunda hatta tamamen hareketsiz olsa bile — tempo
       * saniyeler içinde tavana kilitlenir ve 3 dakika boyunca orada
       * kalırdı ("asla cezalandırma" değil ama "asla sahte doldurma" da
       * bir kural: ölçer yalnız GERÇEK eylemi göstermeli). Usta Modu'nun
       * kendi ödülü (makine hızı ×2, TÜM istasyonlarda) bundan etkilenmez
       * — yalnız tempo beslemesi gerçek mesafeye bağlanır.
       *
       * TAVANLI: bu kanca `handsOnCeiling`'i geçemez (bkz. BALANCE.tempo
       * notu) — park edip durmak tek başına tempoyu doyuramaz, yalnız
       * GERÇEK İŞ (diğer dört kanca) tavanın üstüne taşır.
       */
      if (nearPlayer) this.bumpTempo(BALANCE.tempo.gain.handsOnPerSecond * dt, BALANCE.tempo.handsOnCeiling);
    }
    for (const st of this.stations) {
      st.update(dt);
      if (st.def.kind === 'table') {
        if (st.isDirty) st.dirtyAge += dt;
        else st.dirtyAge = 0;
      }
    }
    this.spills.update(dt);

    this.updateStaff(dt);
    this.updateCounters(dt, player);
    this.updateCustomers(dt, player);
    this.spawnCustomers(dt, mods);
    this.updateDust(dt);
    this.updateTraffic(dt, player);
    this.updateHygiene(dt);
    if (player && this.active) this.updatePlayerInteraction(dt, player);
    this.updatePads(dt, player);
    this.updateStaffHirePad(dt, player);
    this.updateSideActivities(dt,player);
    // Niyet kapısı defteri: bu karede kimse kapıya dokunmadıysa sayaç sıfır.
    if (!this.armTouched) {
      this.armKey = null;
      this.armT = 0;
    }
    this.armTouched = false;
    this.armRing?.endFrame();
    this.updateFloorLift(dt, player);
    this.updateVisuals(dt);
    this.updateGuide(dt, player);
    this.separateActors(player);
    this.env?.update(dt);
    for (const pad of this.staffHirePads.values()) if (pad.root.visible) pad.update(dt, GUIDE_QUAT);
    this.updateContactShadows(player);
    this.computeAutomation();

    this.trackRealizedIncome(dt);
  }

  /**
   * KARAKTERLER ARASI İTME.
   *
   * Simülasyonda hiç yoktu: karakterler birbirinin içinden geçiyor,
   * kalabalıkta üç dört gövde tek bir yığına dönüşüyordu. Görsel olarak
   * kötü olmasının yanında GERÇEK bir kilitlenme kaynağı: doğrulayıcının
   * göremeyeceği türden, çünkü ortada geometri sorunu yok — garsonu
   * müşteriler kutuya alıyor ve yol bulsa bile ilerleyemiyor.
   *
   * Çözüm ucuz: her kare, birbirine çok yaklaşan çiftleri simetrik olarak
   * ayır. Oturan misafirler hariç tutulur (sandalyeler kasıtlı olarak
   * yakındır). ~40 aktörde 1600 karşılaştırma — ölçülemeyecek kadar ucuz.
   */
  /** Kamera kadrajında mı — ekran dışı animasyonu atlamak için. */
  private isNearCamera(x: number, z: number): boolean {
    if (this.viewReady) {
      return pointInView(x, z, this.cullPlanes);
    }
    const dx = x - this.focusX;
    const dz = z - this.focusZ;
    return dx * dx + dz * dz < 26 * 26;
  }

  syncActorRender(root:THREE.Object3D, visible:boolean):void {
    syncRenderMembership(root,this.root,visible);
  }

  /** Loading screen: paint pad captions that would otherwise wait for play. */
  flushPadCaptions(): void {
    this.env?.flushPadCaptions();
  }

  setViewFromCamera(camera: THREE.Camera): void {
    camera.updateMatrixWorld();
    _projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreen);
    extractCullPlanes(_frustum, this.cullPlanes);
    this.viewReady = true;
  }

  hasVisibleCharacters(): boolean {
    for (const c of this.customers) if (c.char.root.visible) return true;
    for (const s of this.staff) if (s.char.root.visible) return true;
    return false;
  }

  hasBusyVisuals(): boolean {
    if (this.highlightBusy) return true;
    for (const st of this.stations) {
      if (st.locked) continue;
      if (st.broken) return true;
      if (st.working) return true;
      if (st.def.kind === 'toilet' && st.occupied) return true;
      if (st.def.kind === 'table' && st.progress01 > 0.002) return true;
    }
    return false;
  }

  /** Kamera odağı (Game her karede yazar). */
  focusX = 0;
  focusZ = 0;

  private readonly _separateList: (Customer | Staff | Player)[] = [];

  private separateActors(player: Player | null): void {
    const list = this._separateList;
    list.length = 0;
    // Seated guests remain anchored at the shared seat coordinates.
    for (const c of this.customers) if (!c.sitting && !c.standingUp && !c.done) list.push(c);
    for (const staff of this.staff) list.push(staff);
    if (player && this.active) list.push(player);
    const bounds = this.loc.bounds;
    const constrain = (actor: {x:number;z:number}, fromX?: number, fromZ?: number): void => {
      const radius = actor === player ? BALANCE.player.radius : 0.3;
      if (fromX !== undefined && fromZ !== undefined) {
        const dx = actor.x - fromX, dz = actor.z - fromZ;
        actor.x = fromX; actor.z = fromZ;
        this.nav.slideMove(actor, dx, dz, radius);
      }
      const pad = actor === player ? 0.7 : 0.4;
      actor.x = clamp(actor.x, bounds.x0 + pad, bounds.x1 - pad);
      actor.z = clamp(actor.z, bounds.z0 + pad, actor === player ? bounds.z1 - pad : bounds.z1 + 1.6);
      this.nav.resolve(actor, radius);
    };
    separateCrowd(list, constrain, 0.86, 12, player ?? undefined);
    // Actor.step ran before separation. Without this sync the renderer keeps
    // drawing the pre-collision pose, even while simulation positions are apart.
    for (const actor of list) {
      constrain(actor);
      actor.char.root.position.x = actor.x;
      actor.char.root.position.z = actor.z;
    }
  }
  /**
   * YÜKSELTİLMİŞ ODA KOTU — yalnız görsel.
   *
   * Navigasyon iki boyutludur; VIP odasının podyumu A*'ı hiç ilgilendirmez.
   * Aktörün çizim yüksekliği burada yazılır ve YUMUŞATILIR: merdivenin
   * eşiğinde 0,4 birimlik ani sıçrama olmasın, karakter basamakları
   * çıkıyormuş gibi süzülsün. (Kot farkı olmayan mekânda bu döngü hiçbir
   * şey yapmaz: `hasLift` false ise erken döner.)
   */
  private updateFloorLift(dt: number, player: Player | null): void {
    if (!this.hasLift) return;
    const k = Math.min(1, dt * 9);
    const apply = (a: { x: number; z: number; floorY: number }): void => {
      const target = floorLiftAt(this.loc, a.x, a.z);
      a.floorY += (target - a.floorY) * k;
    };
    for (const c of this.customers) apply(c);
    for (const s of this.staff) apply(s);
    if (player && this.active) apply(player);
  }

  /**
   * Mekânda kot farkı olan bir oda var mı — yoksa lift döngüsü hiç koşmaz.
   * (Alan başlatıcısı `this.loc`'tan ÖNCE çalıştığı için kurucuda atanır.)
   */
  private hasLift = false;
  /** Kir görselinin de podyuma oturması için (bkz. SpillView.sync). */
  private readonly liftAt = (x: number, z: number): number => floorLiftAt(this.loc, x, z);

  /**
   * Aktörlerin yere basma lekelerini tazeler. Hepsi tek InstancedMesh
   * olduğu için 40 karakter tek çizim çağrısı eder.
   */
  private updateContactShadows(player: Player | null): void {
    const cs = this.contact;
    if (!cs) return;
    cs.begin();
    for (const c of this.customers) if (c.char.root.visible) cs.add(c.x, c.z, 0.4, c.char.root.position.y);
    for (const s of this.staff) if (s.char.root.visible) cs.add(s.x, s.z, 0.4, s.char.root.position.y);
    if (player && this.active) cs.add(player.x, player.z, 0.46, player.char.root.position.y);
    cs.end();
  }

  updateBackground(dt: number): void {
    for (const st of this.stations) st.update(dt);
    this.computeAutomation();
    if (this.staffCountFor('waiter') > 0) this.abstractService(dt);
    // Ölçüm burada İLERLETİLMEZ: arka planda satış hasılatı sayılmadığı
    // için üstel unutma ölçümü sıfıra doğru söndürür ve uzun süre kapalı
    // kalan şube yavaşça kazanmayı bırakırdı. Şube arka plandayken son
    // aktif ölçüm dondurulur.
  }

  /* ================================================================ *
   *  Gerçekleşen gelir ölçümü
   * ================================================================ */

  /**
   * Saniyede fiilen kazanılan paranın üstel hareketli ortalaması.
   *
   * Neden gerekli: offline kazanç eskiden `estimateIncomePerSecond()`
   * kullanıyordu; o ise makinelerin TEORİK üretim hızını fiyatla çarpıyor,
   * sipariş tavanını, sandalye sayısını ve müşteri sabrını hiç görmüyordu.
   * Sonuç: tam yükseltilmiş bir kafede saniyede ₺22.832 "kazanç" — 16
   * saatlik bir dönüş ₺789 milyon ödüyordu, yani oyunun bütün harcama
   * havuzunun onda birini tek dokunuşta. Artık ödeme, oyuncunun gerçekten
   * ürettiği hızla sınırlanıyor.
   */
  private trackRealizedIncome(dt: number): void {
    /**
     * ÜSTEL UNUTMALI ORTALAMA.
     *
     * Hasılat patlamalıdır: siparişler kümelenir, tek bir saniyede dört
     * sipariş birden bitebilir. Saniyelik örnek üzerinden EMA denendi ve
     * ölçüm gerçek hızın 4 katına kadar sapıyordu (₺58/sn'lik kafede
     * ₺246/sn okuyordu) — offline ödemesi buna dayanamaz.
     *
     * Bunun yerine hem hasılat hem süre aynı katsayıyla unutulur; oran
     * daima ağırlıklı ORTALAMA hızdır, ani sıçramadan etkilenmez.
     * Zaman sabiti 4 dakika: kafe büyüdükçe ölçüm takip eder, ama tek
     * bir yoğun saniye onu zıplatmaz.
     */
    const k = Math.exp(-dt / REVENUE_TAU);
    this.revenueTotal = this.revenueTotal * k + this.revenueAcc;
    this.revenueTime = this.revenueTime * k + dt;
    this.revenueAcc = 0;
    // İlk saniyelerde bölme gürültülü olur; 5 saniyeden önce raporlama.
    this.realizedIncome = this.revenueTime > 5 ? this.revenueTotal / this.revenueTime : this.realizedIncome;
  }

  /** Bu karede gerçekleşen satış hasılatı (bkz. trackRealizedIncome). */
  private revenueAcc = 0;
  private revenueTotal = 0;
  private revenueTime = 0;
  /** Ölçülen ₺/sn. Kayıtta saklanır; yoksa offline ilk dönüşte 0 olurdu. */
  realizedIncome = 0;

  /**
   * KAFENİN RİTMİ (0..1) — bkz. BALANCE.tempo. Oyuncunun eylemleri
   * doldurur, boşta sönümlenir. KAYDA GİRMEZ (oturum başında 0).
   */
  tempo = 0;
  /** İçinde bulunulan saniyede tempoya eklenen toplam pay. */
  private tempoGainThisSecond = 0;
  /** Saniyelik bütçe penceresi. */
  private tempoWindow = 0;

  /**
   * Oyuncunun bir eylemi tempoyu besler. YALNIZ OYUNCU YOLUNDAN çağrılır —
   * personel yolundan çağrılırsa mekanik kendi kendini yer (personel zaten
   * boştaki tabanı üretiyor).
   *
   * Saniyelik bütçeyi aşan pay ATILIR, kuyruğa alınmaz: kuyruk spam'i
   * engellemez, yalnız geciktirirdi.
   *
   * @param ceiling Bu çağrının TEK BAŞINA çıkabileceği en yüksek tempo
   *   (varsayılan 1 — tavansız). "El ver" kancası burayı `handsOnCeiling`
   *   ile geçer (bkz. `BALANCE.tempo.handsOnCeiling` notu): makine başında
   *   park edip durmak tek başına dolum kaynağı DEĞİLDİR, yalnız gerçek iş
   *   (rafa koyma, kasa, temizlik, kaçak) tavanın üstüne taşır. Tempo
   *   zaten tavanın üstündeyse bu çağrı onu DÜŞÜRMEZ — yalnızca
   *   yükseltmeyi bırakır (erken çıkış).
   */
  bumpTempo(amount: number, ceiling = 1): void {
    const cap = Math.min(1, ceiling);
    if (ceiling >= 1 && amount >= BALANCE.tempo.gain.cashCollect) this.noteServiceBeat();
    if (this.tempo >= cap) return;
    const room = BALANCE.tempo.maxGainPerSecond - this.tempoGainThisSecond;
    const applied = Math.min(amount, room, cap - this.tempo);
    if (applied <= 0) return;
    this.tempoGainThisSecond += applied;
    this.tempo = Math.min(cap, this.tempo + applied);
  }

  /**
   * Four real jobs (shelf, till, clean, catch) pay a small visible bonus.
   * Standing at a machine does not count. Twenty-two idle seconds reset it,
   * so the next payout stays close while the player is actually working.
   */
  private serviceStreak = 0;
  private serviceStreakAt = 0;
  private noteServiceBeat(): void {
    if (this.state.tutorialStep < TUTORIAL_STEP_COUNT) return;
    const now = this.state.playTime;
    if (now - this.serviceStreakAt > 22) this.serviceStreak = 0;
    this.serviceStreakAt = now;
    this.serviceStreak += 1;
    if (this.serviceStreak < 4) return;
    this.serviceStreak = 0;
    const amount = Math.max(8, Math.round(this.cheapestMenuValue * 0.45));
    const player = this.assistPlayer;
    const x = player?.x ?? this.loc.playerStart.x;
    const z = player?.z ?? this.loc.playerStart.z;
    this.state.earn(amount, x, z, 1.6);
    this.vfx?.coinBurst(x, 1.3, z, 4);
    bus.emit('toast', { text: tr("Seri tamam +₺{0}", formatCompactMoney(amount)), glyph: '🔥', tone: 'good' });
  }

  get streakNow(): number {
    return this.serviceStreak;
  }

  private updateTempo(dt: number): void {
    this.tempoWindow += dt;
    if (this.tempoWindow >= 1) {
      this.tempoWindow = 0;
      this.tempoGainThisSecond = 0;
    }
    this.tempo = Math.max(0, this.tempo - BALANCE.tempo.decayPerSecond * dt);
  }

  private staffCountFor(role: StaffRole): number {
    return this.state.staffCountAt(this.loc.id)[role];
  }

  /** Kamera dönüşünü sim'e taşır — gösterici yazısı hep ekrana bakar. */
  setCameraQuat(q: THREE.Quaternion): void {
    GUIDE_QUAT.copy(q);
  }

  /** Ayarlardan yol göstericiyi kapat/aç. */
  setGuideEnabled(on: boolean): void {
    this.guide?.setEnabled(on);
  }

  /* ================================================================ *
   *  YOL GÖSTERİCİ
   *
   *  Oyuncunun kafasındaki tek soru şudur: "şimdi ne yapayım?" Öğretici
   *  bunu ilk altı adımda anlatıyor ama bitince oyuncu ortada kalıyordu.
   *  Bu yüzden ekranda HER AN tek bir hedef işaretlidir ve üstünde ne
   *  yapacağı fiil olarak yazar.
   *
   *  Öncelik sırası, kafenin gerçek aciliyet sırasıdır:
   *    1. elin doluysa → bekleyen masa (yoksa kova/tuvalet)
   *    2. oturan misafirin istediği ürün hazırsa → o makine / banko
   *    3. kirli masa → topla
   *    4. yerdeki leke → sil
   *    5. boşalan tuvalet sarfı → doldur
   *    6. hiçbiri yoksa → sipariş tezgâhı (orada durmak siparişi hızlandırır)
   * ================================================================ */

  private guideFloorUntil = 0;
  private guideFloorStartCoverage = 0;
  private lastGuideFloorAt = 0;

  /** A bounded cleaning turn can finish even when ordinary shelf work continues. */
  private guideFloorCare(player: Player): GuideTarget | null {
    if (this.guideFloorUntil <= 0) return null;
    if (this.state.playTime >= this.guideFloorUntil
      || this.grime.heavyCoverage <= Math.max(BALANCE.dirt.grimeGuideCoverage * .6, this.guideFloorStartCoverage * .55)) {
      this.guideFloorUntil = 0;
      this.lastGuideFloorAt = this.state.playTime;
      return null;
    }
    if (!player.hasVacuum) {
      if (!player.isEmpty) return null;
      const dock = this.vacuums.find(d => !d.locked);
      return dock ? this.guideAt(dock, tr("SÜPÜRGEYİ AL"), 0xd8cfbb) : null;
    }
    const spot = this.grime.worstSpot(BALANCE.dirt.grimeGuideMin);
    if (spot) return { x: spot.x, z: spot.z, label: tr("ZEMİNİ SÜPÜR"), color: 0xd8cfbb };
    this.guideFloorUntil = 0;
    this.lastGuideFloorAt = this.state.playTime;
    return null;
  }

  private updateGuide(dt: number, player: Player | null): void {
    if (!this.guide || !player || !this.active) return;
    if (this.guideOverride) {
      this.guide.set(this.guideOverride, player.x, player.z);
      this.guide.update(dt, GUIDE_QUAT);
      return;
    }
    this.guideSpillWait = this.spills.count > 0 ? this.guideSpillWait + dt : 0;
    this.guideTimer -= dt;
    if (this.guideTimer <= 0) {
      this.guideTimer = 0.25;
      this.guideCache = this.applyNearWin(player, this.pickGuideTarget(player));
    }
    this.guide.set(this.guideCache, player.x, player.z);
    this.guide.update(dt, GUIDE_QUAT);
  }

  /**
   * When the goal is more than ~30s away, the action line names a payout
   * the player can finish now: the counter, a dirty table, or the goal's
   * own remaining count. The register sentence stays word for word.
   */
  private applyNearWin(player: Player, chosen: GuideTarget | null): GuideTarget | null {
    if (!this.nearWinWanted || this.state.tutorialStep < TUTORIAL_STEP_COUNT) return chosen;
    if (player.carryCount > 0 || player.hasVacuum) return chosen;
    const label = chosen?.label ?? '';
    if (
      label === tr("Kasada dur; sipariş orada alınır")
      || label === tr("SİPARİŞ AL")
      || label === tr("BÖLÜMÜ AÇ")
    ) return chosen;
    if (
      label === tr("LEKEYİ SİL")
      || label === tr("TOZU SÜPÜR")
      || label === tr("ZEMİNİ SÜPÜR")
      || label === tr("KOVAYA AT")
    ) return chosen;
    if (label === tr("KASA DOLU · TOPLA") || label === tr("BULAŞIĞI TOPLA") || label === tr("MASAYI PARLAT")) {
      return this.nearestPayoutGuide(player) ?? chosen;
    }
    const payout = this.nearestPayoutGuide(player);
    if (payout) return payout;
    if (!chosen || !this.guideGoal) return chosen;
    const left = Math.max(0, Math.ceil(this.guideGoal.target - this.guideGoalCurrent));
    if (left <= 0) return chosen;
    return {
      ...chosen,
      hud: tr("{0} · {1} kaldı · +₺{2}", chosen.label, left, formatCompactMoney(this.guideGoal.reward)),
    };
  }

  /** Closest money already waiting: a full till first, then cash or dishes. */
  private nearestPayoutGuide(player: Player): GuideTarget | null {
    const gold = 0xffc84a;
    for (const co of this.counters) {
      if (co.locked || co.cash < BALANCE.money.counterCap) continue;
      return this.guideAt(co, tr("Kasayı topla · +₺{0}", formatCompactMoney(co.cashValue)), gold);
    }
    let best: StationEntity | null = null;
    let bestD = Infinity;
    let bestKind: 'cash' | 'dish' = 'cash';
    for (const co of this.counters) {
      if (co.locked || co.cash <= 0) continue;
      const d = dist(player.x, player.z, co.x, co.z);
      if (d < bestD) {
        best = co;
        bestD = d;
        bestKind = 'cash';
      }
    }
    for (const t of this.tables) {
      if (t.locked || t.dishes <= 0) continue;
      const d = dist(player.x, player.z, t.x, t.z);
      if (d < bestD) {
        best = t;
        bestD = d;
        bestKind = 'dish';
      }
    }
    if (!best) return null;
    if (bestKind === 'cash') {
      return this.guideAt(best, tr("Kasayı topla · +₺{0}", formatCompactMoney(best.cashValue)), gold);
    }
    const pay = this.cleanReward(BALANCE.dirt.dishRewardRate * Math.max(1, best.dishes));
    return this.guideAt(best, tr("Bulaşığı temizle · +₺{0}", formatCompactMoney(pay)), gold);
  }

  /**
   * Bekleyen GERÇEK servis işi var mı: sipariş sırası ya da masada
   * karşılanmamış sipariş. Süpürge kapanını açmak için var (aşağıya bkz.).
   */
  private hasServiceWork(): boolean {
    // v5 servis işi: sırada müşteri, kasada toplanmamış nakit, rafta
    // bekleyen müşteri ya da "makinede var, rafta yer var" ikmal işi.
    for (const co of this.counters) {
      if (!co.locked && (queueOf(co).length > 0 || co.cash > 0)) return true;
    }
    for (const c of this.customers) {
      if (c.state === 'pickup' && c.waiting) return true;
      if (c.dineIn && !c.eating && c.order && !c.orderComplete) return true;
    }
    for (const m of this.machines) {
      if (m.locked || m.output <= 0 || !m.def.item || !isProduct(m.def.item)) continue;
      const shelf = this.shelfFor(m.def.item);
      if (shelf && shelf.def.item === m.def.item && shelf.output < shelf.outputCap) return true;
    }
    return false;
  }

  private guideAt(station: StationEntity, label: string, color: number): GuideTarget {
    const player=this.assistPlayer;
    if (station.def.kind === 'vacuum' && player) {
      return { x: player.x, z: player.z, label: tr("SÜPÜRGEYİ AL düğmesine dokun"), color };
    }
    station.servicePoint(_pt);
    if (player && (station.def.kind==='table' || station.def.kind==='bin') && dist(player.x,player.z,station.x,station.z)<4) {
      station.playerPoint(player.x,player.z,this.assistAccess);
      station.playerPoint(player.x,player.z,this.interactionContact,0.01);
      if (!this.nav.solidBlocked(this.assistAccess.x,this.assistAccess.z,0.32) &&
        this.nav.interactionLineClear(player.x,player.z,this.interactionContact.x,this.interactionContact.z)) {
        _pt.x=this.assistAccess.x; _pt.z=this.assistAccess.z;
      }
    }
    return {x: _pt.x, z: _pt.z, label, color};
  }



  private guideVacuumReturn(_dock: StationEntity, player: Player): GuideTarget {
    return { x: player.x, z: player.z, label: tr("SÜPÜRGEYİ BIRAK düğmesine dokun"), color: 0xffc84a };
  }

  /** Explicit equipment intent works anywhere in the active venue.
   *  Hidden until the first order: the opening minute has one verb. */
  vacuumAvailable(player: Player): boolean {
    if (!this.active) return false;
    if (player.hasVacuum) return true;
    if (this.state.stats.orders < 1) return false;
    return this.vacuums.some(dock => !dock.locked && dock.output > 0);
  }

  toggleVacuum(player: Player): boolean {
    if (!this.vacuumAvailable(player) || (!player.hasVacuum && !player.isEmpty)) return false;
    const holding = !player.hasVacuum;
    const dock = this.vacuums.find(d => !d.locked && (!holding || d.output > 0));
    if (holding && !dock) return false;
    const tool = holding ? createHeldVacuum(this.loc.palette.accent) : null;
    player.setVacuumMesh(tool);
    player.hasVacuum = holding;
    if (dock) {
      dock.output = holding ? 0 : 1;
      this.stationVisuals.get(dock.id)?.setOutput(dock.output, 1, null);
      // A button press next to the dock must not immediately reverse itself.
      if (dist(player.x, player.z, dock.x, dock.z) <= 2.6) player.noTakeFrom = dock.id;
    }
    // Start a new brush stroke here: do not clean a segment from the previous tool position.
    const brush = this.brushPoint(player, holding);
    this.brushPrevX = brush.x; this.brushPrevZ = brush.z;
    this.armKey = null; this.armT = 0; this.armTouched = false;
    this.guideCache = null; this.guideTimer = 0;
    if (this.armRing) this.armRing.root.visible = false;
    this.vacuumTone = 0;
    player.interacting = false; player.interactionKind = 'generic';
    player.handTimer = 0.2;
    if (holding) this.state.vacuumHinted = true;
    sfx('pickup', 0.5); haptic('light');
    return true;
  }

  private updateVacuumDock(dt: number, player: Player): boolean {
    if (!this.active || (!player.hasVacuum && !player.isEmpty)) return false;
    for (const dock of this.vacuums) {
      if (dock.locked || dist(player.x, player.z, dock.x, dock.z) > 2.15) continue;
      if (player.noTakeFrom === dock.id || player.handTimer > 0) return false;
      if (!player.hasVacuum && dock.output <= 0) continue;
      // Reach the nearest physical edge from every direction; never reach through a wall.
      const dx = player.x - dock.x, dz = player.z - dock.z;
      const distance = Math.hypot(dx, dz);
      const reach = Math.min(0.64, distance);
      const x = distance > 0 ? dock.x + dx / distance * reach : dock.x;
      const z = distance > 0 ? dock.z + dz / distance * reach : dock.z;
      if (!this.nav.interactionLineClear(player.x, player.z, x, z)) continue;
      if (player.planarSpeed >= 0.8) return false;
      if (!this.armGate(`vac:${dock.id}`, dt, 0.28, 0xd8cfbb, player)) {
        player.interacting = true; player.interactionKind = 'reach';
        return true;
      }
      this.toggleVacuum(player);
      return true;
    }
    return false;
  }

  /** A short, complete maintenance job survives new shelf demand. */
  private guideCareTarget(player: Player): GuideTarget | null {
    const care = this.guideCare;
    if (!care) return null;
    const table = care.kind === 'table' ? this.byId.get(String(care.id)) : null;
    const spill = care.kind === 'spill' ? this.spills.byId(Number(care.id)) : null;
    const complete = care.kind === 'table'
      ? !table || table.locked || !table.isDirty
      : !spill;
    if (complete || this.state.playTime - care.startedAt > 50) {
      this.guideCare = null;
      this.lastGuideCareAt = this.state.playTime;
      return null;
    }

    // Finish the chosen table's dishes -> bin -> polish cycle with empty hands.
    if (player.hasItem('bulasik')) {
      const bin = this.bins.filter((b) => !b.locked)
        .sort((a, b) => dist(player.x, player.z, a.x, a.z) - dist(player.x, player.z, b.x, b.z))[0];
      if (bin) return this.guideAt(bin, tr("KOVAYA AT"), 0x5b9bd5);
    }
    if (player.hasVacuum && table) {
      const dock = this.vacuums.find((d) => !d.locked);
      return dock ? this.guideVacuumReturn(dock, player) : null;
    }
    if ((table || spill) && player.carryCount > 0) {
      for (const item of player.distinctItems()) {
        const dest = this.bestConsumer(item, player.x, player.z, 'player');
        if (dest && dest.def.kind !== 'bin') {
          return this.guideAt(dest, dest.def.kind === 'table' ? tr("MASAYA SERVİS") : tr("RAFA KOY"), 0x6aa84f);
        }
      }
      // Never throw away valuable products merely to follow an automatic hint.
      this.guideCare = null;
      this.lastGuideCareAt = this.state.playTime;
      return null;
    }
    if (table) return this.guideAt(table, table.dishes > 0 ? tr("BULAŞIĞI TOPLA") : tr("MASAYI PARLAT"), 0xe2703a);
    if (spill) return { x: spill.x, z: spill.z, label: spill.kind === 'toz' ? tr("TOZU SÜPÜR") : tr("LEKEYİ SİL"), color: 0x5b9bd5 };
    return null;
  }

  private beginGuideCare(player: Player, criticalOrder: boolean): GuideTarget | null {
    if (this.state.playTime - this.lastGuideCareAt < 8) return null;
    const dirty = this.tables
      .filter((t) => !t.locked && t.isDirty)
      .sort((a, b) => (b.dirtyAge - dist(player.x, player.z, b.x, b.z) * 0.6)
        - (a.dirtyAge - dist(player.x, player.z, a.x, a.z) * 0.6))[0];
    const spill = this.spills.nearest(player.x, player.z, 999);
    const goal = this.guideGoal?.kind;
    const waitingForTable = this.customers.some((c) => !c.done && c.state === 'toTable' && c.dineIn && !c.table);
    const blockedDining = !!dirty && (!this.tables.some((t) => t.canSeat) || waitingForTable);
    // Urgent guests get served, but the current cleaning goal and a blocked
    // dining room cannot be postponed forever by a permanently empty shelf.
    const goalTable = (goal === 'clean' || goal === 'cleanTable') && dirty;
    const goalSpill = goal === 'mop' && spill;
    let kind: 'table' | 'spill' | null = null;
    if (goalTable && (!criticalOrder || dirty.dirtyAge >= 45)) kind = 'table';
    else if (goalSpill && (!criticalOrder || this.guideSpillWait >= 45)) kind = 'spill';
    else if (blockedDining) kind = 'table';
    else if (spill && this.guideSpillWait >= 45 && !criticalOrder) kind = 'spill';
    else if (dirty && dirty.dirtyAge >= 35 && !criticalOrder) kind = 'table';
    if (!kind) return null;
    this.guideCare = { kind, id: kind === 'table' ? dirty!.id : spill!.id, startedAt: this.state.playTime };
    if (kind === 'spill') this.guideSpillWait = 0;
    return this.guideCareTarget(player);
  }

  /** Goal routing reuses real interaction points and never unlocks anything. */
  private guideGoalTarget(player: Player): GuideTarget | null {
    const goal = this.guideGoal;
    if (!goal) return null;
    const focused = this.guideFocusId === goal.id && this.state.playTime < this.guideFocusUntil;
    if (goal.kind === 'zone' || goal.kind === 'expand') {
      const candidates = this.loc.zones.filter((z) => !this.zoneUnlocked(z.id)
        && z.cost > 0 && (!z.requires || this.zoneUnlocked(z.requires))
        && (goal.kind === 'expand' ? z.id === 't1' || z.id === 'a3' : z.id === goal.zone));
      for (const zone of candidates) {
        const remaining = Math.max(0, zone.cost - this.padPaid(zone.id));
        if (this.state.money >= remaining || focused) {
          // A focused goal may sit outside the three cheapest choices.
          // Reveal its real pad without changing cost, locks or deposits.
          if (!this.visiblePadIds.has(zone.id)) {
            if (this.visiblePadIds.size >= 3) {
              const fresh = [...this.visiblePadIds].filter(id => this.padPaid(id) <= 0);
              const last = fresh[fresh.length - 1];
              if (last) {
                this.visiblePadIds.delete(last);
                this.env?.setPadVisible(last, false);
              }
            }
            this.visiblePadIds.add(zone.id);
            this.env?.setPadVisible(zone.id, true);
          }
          return { x: zone.padX, z: zone.padZ, label: tr("BÖLÜMÜ AÇ"), color: 0x6aa84f };
        }
      }
    }
    if (goal.kind === 'produce' && goal.item) {
      const source = this.machineFor(goal.item);
      const shelf = this.shelfFor(goal.item);
      if (source && !source.locked && shelf && shelf.canAccept(goal.item)) {
        if (player.hasItem(goal.item)) return this.guideAt(shelf, tr("RAFA KOY"), 0x6aa84f);
        if (player.carryCount === 0 && source.id !== player.noTakeFrom && source.output > 0)
          return this.guideAt(source, tr("{0} AL", ITEMS[goal.item].name.toLocaleUpperCase(localeTag())), 0x6aa84f);
      }
    }
    if (goal.kind === 'refill') {
      for (const source of this.machines) {
        const item = source.def.item;
        if (source.locked || !item || !isSupply(item)) continue;
        const dest = this.toilets.find((t) => !t.locked && t.canAccept(item));
        if (!dest) continue;
        if (player.hasItem(item)) return this.guideAt(dest, tr("TUVALETE KOY"), 0x5b9bd5);
        if (player.carryCount === 0 && source.id !== player.noTakeFrom)
          return this.guideAt(source, tr("{0} AL", ITEMS[item].name.toLocaleUpperCase(localeTag())), 0x5b9bd5);
      }
    }
    if (goal.kind === 'hire' && goal.role) {
      const point = this.loc.staffHirePads[goal.role];
      const pad = this.staffHirePads.get(goal.role);
      const remaining = this.state.hireCostFor(goal.role);
      if (point && pad?.root.visible && (this.state.money >= remaining || focused)) {
        const roleName = STAFF_ROLE_MAP[goal.role].name.toLocaleUpperCase(localeTag());
        return { x: point.x, z: point.z, label: tr("{0} İŞE AL", roleName), color: 0xffc84a };
      }
    }
    return null;
  }

  focusCurrentGoal(): void {
    this.guideFocusId = this.guideGoal?.id ?? '';
    this.guideFocusUntil = this.state.playTime + 45;
    this.guideTimer = 0;
  }

  private pickGuideTarget(player: Player): GuideTarget | null {
    const GOLD = 0xffc84a;
    const GREEN = 0x6aa84f;
    const BLUE = 0x5b9bd5;
    const RED = 0xe2703a;

    /**
     * SÜPÜRGE ELDEYKEN YALNIZ TEMİZLİK GÖSTERİLİR.
     *
     * Alet-münhasır mod geldikten sonra rehber ürün/bulaşık göstermeye
     * devam etseydi oyuncuyu alamayacağı şeye yönlendirirdi — kodun başka
     * yerde özenle kapattığı tuzağın (bkz. `noTakeFrom` notu) aynısı.
     * Yerde iş kalmadığında ok dolabı gösterir: alet döngüsü kapanır.
     */
    const sideTarget = this.sideGuideTarget(player);
    if (sideTarget) return sideTarget;
    const ongoingCare = this.guideCareTarget(player);
    if (ongoingCare) return ongoingCare;
    const floorCare = this.guideFloorCare(player);
    if (floorCare) return floorCare;

    if (player.hasVacuum) {
      /**
       * SÜPÜRGE BİR KAPAN OLMAMALI.
       *
       * Alet-münhasır mod yüzünden süpürge eldeyken ürün taşınamaz; rehber
       * de yalnız temizlik gösterir. Trafik kiri (çöken toz) HİÇ bitmediği
       * için ok sonsuza dek "zemini süpür" demeye devam ediyor, oyuncu bir
       * daha servise dönmüyordu. Ölçüldü: 50 dakikalık bot koşusunda kazanç
       * ₺2,74M'den ₺973K'ya düştü (%64), `a3` 1:25 yerine 10:46'da açıldı,
       * VIP hiç açılmadı. Bot rehberi izlediği için bunu yakaladı ama tuzak
       * gerçek oyuncu için de aynen geçerli.
       *
       * Kural: müşteri bekliyorsa temizlik BEKLER. Sıra ya da karşılanmamış
       * sipariş varsa ok doğrudan dolabı gösterir — aleti bırak, işine dön.
       */
      if (this.hasServiceWork()) {
        for (const dock of this.vacuums) {
          if (dock.locked) continue;
          return this.guideVacuumReturn(dock, player);
        }
      }
      const sp = this.spills.nearest(player.x, player.z, 999);
      if (sp) {
        return {
          x: sp.x,
          z: sp.z,
          label: sp.kind === 'toz' ? tr("TOZU SÜPÜR") : tr("LEKEYİ SİL"),
          color: sp.kind === 'toz' ? 0xd8cfbb : BLUE,
        };
      }
      /**
       * LEKE BİTTİ AMA ZEMİN KİRLİ: dolabı değil, kiri göster.
       *
       * Bu satırlar olmadan trafik kiri KEŞFEDİLEMEZ bir mekanikti: rehber
       * süpürge eldeyken leke kalmayınca doğrudan "SÜPÜRGEYİ BIRAK" diyor,
       * yani oyuncuyu tam da süpürgenin asıl işinden geri çağırıyordu.
       */
      const spot = this.grime.worstSpot(BALANCE.dirt.grimeGuideMin);
      if (spot) return { x: spot.x, z: spot.z, label: tr("ZEMİNİ SÜPÜR"), color: 0xd8cfbb };
      for (const dock of this.vacuums) {
        if (dock.locked) continue;
        return this.guideVacuumReturn(dock, player);
      }
      return null;
    }

    // Engelleyici durum her şeyden önce gelir: dolu kasa sipariş akışını
    // tamamen durdurur ve oyuncuya tek, açık çözüm gösterilmelidir.
    for (const co of this.counters) {
      if (co.locked || co.cash < BALANCE.money.counterCap) continue;
      co.servicePoint(_pt);
      return { x: _pt.x, z: _pt.z, label: tr("KASA DOLU · TOPLA"), color: RED };
    }

    /** En yakın değil, sabır oranı en düşük müşterinin yapılabilir işi. */
    const urgent = this.customers
      .filter((c) => !c.done && c.order && c.waiting && c.state !== 'angry' && c.state !== 'leave')
      .sort((a, b) => a.patience / Math.max(0.01, a.maxPatience) - b.patience / Math.max(0.01, b.maxPatience));

    // Elde doğru ürün varsa önce en acil müşterinin gerçek teslim noktasına git.
    for (const c of urgent) {
      const want = c.order?.nextWanted();
      if (!want || !player.hasItem(want)) continue;
      const itemName = ITEMS[want].name.toLocaleUpperCase(localeTag());
      if (c.dineIn && c.table) {
        return this.guideAt(c.table, tr("{0}'E {1} GÖTÜR", c.table.def.serviceCode ?? tr("MASA"), itemName), RED);
      }
      if (!c.dineIn && c.targetDisplay) {
        c.targetDisplay.servicePoint(_pt);
        return { x: _pt.x, z: _pt.z, label: tr("{0} RAFA KOY", itemName), color: RED };
      }
    }

    // Carrying waste is a committed delivery; do not send the player to
    // take another product before their hands are usable again.
    if (player.hasItem('bulasik')) {
      const bin = this.bins.filter((b) => !b.locked)
        .sort((a, b) => dist(player.x, player.z, a.x, a.z) - dist(player.x, player.z, b.x, b.z))[0];
      if (bin) return this.guideAt(bin, tr("KOVAYA AT"), BLUE);
    }
    const register = this.unattendedRegisterGuide(player);
    if (register) return register;
    const criticalOrder = this.customers.some((c) => !c.done && c.waiting && c.state !== 'angry' && c.state !== 'leave'
      && c.patience / Math.max(0.01, c.maxPatience) < 0.3);
    if (!criticalOrder && player.isEmpty && this.state.tutorialStep >= TUTORIAL_STEP_COUNT
      && this.state.stats.orders > 0
      && this.state.playTime - this.lastGuideFloorAt >= 90
      && this.grime.heavyCoverage > BALANCE.dirt.grimeGuideCoverage) {
      this.guideFloorUntil = this.state.playTime + 30;
      this.guideFloorStartCoverage = this.grime.heavyCoverage;
      const floor = this.guideFloorCare(player);
      if (floor) return floor;
    }
    const maintenance = this.state.stats.orders > 0 ? this.beginGuideCare(player, criticalOrder) : null;
    if (maintenance) return maintenance;
    const goalTarget = this.guideGoalTarget(player);
    if (goalTarget && (!criticalOrder || (this.guideFocusId === this.guideGoal?.id && this.state.playTime < this.guideFocusUntil))) return goalTarget;

    // Eli boş oyuncuya, en acil müşteri için hazır ürün / üretim eylemi göster.
    if (player.carryCount < player.capacity) {
      for (const c of urgent) {
        if (c.state === 'queue' || c.state === 'order') {
          const co = c.counter;
          if (!co || co.locked || (this.cashierReady(co) && !this.rushPlayerOnly)) continue;
          co.servicePoint(_pt);
          return { x: _pt.x, z: _pt.z, label: tr("SİPARİŞ AL"), color: RED };
        }
        const want = c.order?.nextWanted();
        if (!want) continue;
        // Paket müşterinin rafında ürün varsa kendisi alır; oyuncuyu gereksiz
        // yere oraya göndermek yerine sıradaki gerçekten yapılabilir işi ara.
        if (!c.dineIn && c.targetDisplay?.hasItem(want)) continue;
        const machine = this.machineFor(want);
        if (!machine || machine.locked || machine.id === player.noTakeFrom) continue;
        machine.servicePoint(_pt);
        const name = ITEMS[want].name.toLocaleUpperCase(localeTag());
        const label = machine.broken
          ? tr("{0} MAKİNESİNİ ONAR", name)
          : machine.output > 0
            ? tr("{0} AL", name)
            : tr("{0} HIZLANDIR", name);
        return { x: _pt.x, z: _pt.z, label, color: RED };
      }
    }

    /* --- 1. eldekini yerine koy: ürün RAFINA, sarf tuvalete, atık kovaya --- */
    if (player.carryCount > 0) {
      for (const item of player.distinctItems()) {
        if (isProduct(item)) {
          let table: StationEntity | null = null;
          let tableD = Infinity;
          for (const t of this.tables) {
            if (t.locked || !t.guestNeeds(item)) continue;
            const d = dist(player.x, player.z, t.x, t.z);
            if (d < tableD) {
              table = t;
              tableD = d;
            }
          }
          if (table) return this.guideAt(table, tr("MASAYA SERVİS"), GOLD);
        }
        const dest = this.bestConsumer(item, player.x, player.z, 'player');
        if (!dest) continue;
        const label =
          dest.def.kind === 'bin' ? tr("KOVAYA AT") : dest.def.kind === 'toilet' ? tr("TUVALETE KOY") : tr("RAFA KOY");
        return this.guideAt(dest, label, dest.def.kind === 'pickup' ? GREEN : BLUE);
      }
      /**
       * TIKANMA SİGORTASI: eldeki atık/sarfın tüketicisi yoksa (bulaşık
       * için liste hep boş; sarf için tuvaletler dolu olabilir) kovayı
       * göster. Bu satırlar yokken elinde yalnız bulaşık taşıyan oyuncuya
       * rehber hiç "KOVAYA AT" demiyor, ürün kaynağına yönlendiriyordu.
       */
      for (const item of player.distinctItems()) {
        if (isProduct(item)) continue;
        let bin: StationEntity | null = null;
        let binD = Infinity;
        for (const b of this.bins) {
          if (b.locked) continue;
          const d = dist(player.x, player.z, b.x, b.z);
          if (d < binD) {
            binD = d;
            bin = b;
          }
        }
        if (bin) return this.guideAt(bin, tr("KOVAYA AT"), BLUE);
      }
    }

    /* --- 2. RAF İKMALİ — v5'in ana işi ---
     *
     * (a) Rafın önünde ELİ BOŞ bekleyen müşteri en acil iştir: onun
     *     ürününü üreten makine kırmızı okla gösterilir.
     * (b) Kimse beklemiyorsa en boş raf beslenir — ama raflar dolu
     *     sayılırken (eşik) oyuncu temizlik/bulaşık işlerine bırakılır.
     * `noTakeFrom` kilidi açık kaynak gösterilmez (bkz. eski banko dersi:
     * oyuncu dibinde durduğu hâlde alamıyor, ok asılı kalıyordu).
     */
    if (player.carryCount < player.capacity) {
      let urgentM: StationEntity | null = null;
      let urgentD = Infinity;
      const tableDemand = this.demandSet(this._demand);
      for (const want of tableDemand) {
        const m = this.machineFor(want);
        if (!m || m.output <= 0 || m.id === player.noTakeFrom) continue;
        const d = dist(player.x, player.z, m.x, m.z);
        if (d < urgentD) {
          urgentD = d;
          urgentM = m;
        }
      }
      for (const c of this.customers) {
        if (c.state !== 'pickup' || !c.waiting) continue;
        const want = c.order?.nextWanted();
        if (!want) continue;
        const m = this.machineFor(want);
        if (!m || m.output <= 0 || m.id === player.noTakeFrom) continue;
        const d = dist(player.x, player.z, m.x, m.z);
        if (d < urgentD) {
          urgentD = d;
          urgentM = m;
        }
      }
      if (urgentM?.def.item) {
        const name = ITEMS[urgentM.def.item].name.toLocaleUpperCase(localeTag());
        return this.guideAt(urgentM, tr("{0} AL", name), RED);
      }

      let bestM: StationEntity | null = null;
      let bestScore = 0.34; // raflar ~%66 doluysa ikmal diğer işlere yol verir
      for (const m of this.openMachines()) {
        if (m.output <= 0 || !m.def.item || m.id === player.noTakeFrom) continue;
        const shelf = this.shelfFor(m.def.item);
        if (!shelf || shelf.def.item !== m.def.item) continue;
        const free = shelf.outputCap - shelf.output;
        if (free <= 0) continue;
        const score = free / Math.max(1, shelf.outputCap) + (m.output / Math.max(1, m.outputCap)) * 0.25;
        if (score > bestScore) {
          bestScore = score;
          bestM = m;
        }
      }
      if (bestM?.def.item) {
        const name = ITEMS[bestM.def.item].name.toLocaleUpperCase(localeTag());
        return this.guideAt(bestM, tr("{0} AL", name), GOLD);
      }
    }

    /* --- 2b. Gerçek teslimatla tezgâhta biriken para. Kasiyer de olsa
     * nakdi oyuncu toplar; yığın %50'yi geçince rehber kasayı gösterir. */
    for (const c of this.counters) {
      if (c.locked) continue;
      if (c.cash >= BALANCE.money.counterCap * 0.5) {
        return this.guideAt(c, tr("PARAYI TOPLA"), GOLD);
      }
    }

    /* --- 2c. sipariş sırası — kasada durmak siparişi hızlandırır --- */
    {
      let co: StationEntity | null = null;
      let coD = Infinity;
      for (const c of this.counters) {
        if (c.locked || (this.cashierReady(c) && !this.rushPlayerOnly)) continue;
        const d = dist(player.x, player.z, c.x, c.z);
        if (queueOf(c).length > 0 && d < coD) {
          coD = d;
          co = c;
        }
      }
      if (co) return this.guideAt(co, tr("SİPARİŞ AL"), GOLD);
    }

    /* --- 3. kirli masa --- */
    /**
     * Oyuncunun ŞU AN alamayacağı bulaşık GÖSTERİLMEZ.
     *
     * Etkileşim tarafında bir kural var: ürün taşırken bulaşık ancak
     * ardında boş slot kalacaksa alınır (son slotu bulaşığa kaptırmamak
     * için). Rehber bu kuralı bilmeyince oyuncuyu alamayacağı masaya
     * yönlendiriyor, oyuncu orada bekliyor ve oyun sessizce duruyordu —
     * bot koşusunda erken oyun üç kat yavaşladı. Rehber ile etkileşim
     * AYNI kuralı okumalı (kodun `noTakeFrom` için zaten koyduğu ilke).
     */
    const carryingProduct = player.slots.some((it) => isProduct(it));
    const dishRoom = player.capacity - player.slots.length - 1;
    if (!player.hasVacuum && !player.hasItem('bulasik')) {
      let dirty: StationEntity | null = null;
      let dirtyD = Infinity;
      for (const t of this.tables) {
        if (t.locked || (t.dishes <= 0 && t.soil <= 0.02)) continue;
        if (t.dishes > 0 && (!player.canTake('bulasik') || (carryingProduct && dishRoom < 1))) continue;
        const d = dist(player.x, player.z, t.x, t.z);
        if (d < dirtyD) {
          dirtyD = d;
          dirty = t;
        }
      }
      if (dirty) {
        const label = dirty.dishes > 0 ? tr("BULAŞIĞI TOPLA") : tr("MASAYI PARLAT");
        return this.guideAt(dirty, label, RED);
      }
    }

    // Stocked shelves can leave useful products in the player's hands.
    // Take/accelerate the next order while preserving them; cleaning requires
    // empty hands and must never become an impossible fallback instruction.
    if (!player.isEmpty) {
      const counters = this.openCounters();
      const cash = counters.filter(c => c.cash > 0).sort((a,b) => b.cash-a.cash)[0];
      if (cash) return this.guideAt(cash, tr("PARAYI TOPLA"), GOLD);
      const counter = counters.sort((a,b) => b.queue.length-a.queue.length ||
        dist(player.x,player.z,a.x,a.z)-dist(player.x,player.z,b.x,b.z))[0];
      return counter ? this.guideAt(counter, counter.queue.length ? tr("SİPARİŞ AL") : tr("YENİ SİPARİŞİ BEKLE"), GOLD) : null;
    }

    /* --- 4. yerdeki leke ---
     *
     * TOZ SÜPÜRGE İŞİDİR, REHBER DE BUNU BİLMELİ.
     *
     * Denge tarafında toz elle bilerek zahmetlidir (`dustMopScrubRadius`
     * dar, `dustMopScrubSeconds` uzun) ama rehber bunu bilmiyordu: süpürgesiz
     * oyuncuyu doğrudan tozun üstüne yolluyordu. Ovma süresi lekenin alanıyla
     * ölçeklenince bu ölümcül hâle geldi — elle toz temizlemek 16,5 saniye
     * sürüyor ve ok orayı gösterdiği için oyuncu her toz lekesinde çakılıp
     * kalıyordu. Ölçüm: `totalEarned` 1:30 ile 3:30 arasında 681'de DONDU,
     * yani kafe iki dakika boyunca hiç kazanmadı; `a3` 1:25 yerine 4:21'de
     * açıldı.
     *
     * Doğru davranış: süpürgesizken önce SİLİNEBİLİR lekeyi göster; ortada
     * yalnız toz varsa oyuncuyu tozun değil DOLABIN üstüne yolla.
     */
    let spill = null as ReturnType<typeof this.spills.nearest>;
    let bestSpillD = Infinity;
    for (const s of this.spills.list) {
      if (s.kind === 'toz') continue;
      const d = dist(player.x, player.z, s.x, s.z);
      if (d < bestSpillD) {
        bestSpillD = d;
        spill = s;
      }
    }
    if (this.state.stats.orders > 0 && spill) return { x: spill.x, z: spill.z, label: tr("LEKEYİ SİL"), color: RED };
    /**
     * TOZ DA BURADA GÖSTERİLİR — ama lekeden SONRA.
     *
     * İki yanlış deneme oldu, ikisi de ölçümle yakalandı:
     *
     * 1) Burada "SÜPÜRGEYİ AL" demek SALINIM yarattı: ok yüksek öncelikte
     *    dolabı gösteriyor, süpürge ele geçer geçmez kapan-kırıcı kural
     *    (`hasServiceWork`) "SÜPÜRGEYİ BIRAK" diyor, toz durduğu için ok
     *    yine dolabı gösteriyordu. Oyun tamamen kilitlendi — 50 dakikada
     *    yalnız `t1` açıldı, kazanç 329'da dondu.
     *
     * 2) Tozu tamamen zincirin sonuna (`!hasServiceWork()` arkasına) atmak
     *    da yanlıştı: İŞLEYEN bir kafede servis işi hiç bitmez, yani ok
     *    süpürgeyi hiç önermez ve toz TEMİZLENEMEZ hâle gelir. İzde toz
     *    2→5 diye biriktti, hijyen 87'den 43'e indi — görünmeyen, sessiz
     *    bir gelir kaybı.
     *
     * Doğrusu: toz elle de temizlenebilir kalmalı (bkz. dustMopScrubSeconds)
     * ve ok onu göstermeli; süpürge "zorunlu" değil, belirgin biçimde DAHA
     * İYİ olan yoldur (geniş başlık: 0,42'ye karşı 0,13). Sıralama lekeden
     * sonra: silinebilir leke daha acildir.
     */
    const dust = this.state.stats.orders > 0 ? this.spills.nearest(player.x, player.z, 999) : null;
    if (dust) return { x: dust.x, z: dust.z, label: tr("TOZU SÜPÜR"), color: RED };

    /* --- 5. boşalan tuvalet sarfı --- */
    for (const wc of this.toilets) {
      if (wc.locked) continue;
      if (wc.supplyShortfall > 0.4) return this.guideAt(wc, tr("SARF DOLDUR"), BLUE);
    }

    /* --- 6. parası hazır sıradaki bölüm — "BÖLÜMÜ AÇ" ---
     * Kilitli alanların keşfi için düşük öncelikli işaret: acil iş
     * kalmadıysa ve oyuncunun parası sıradaki pedin KALANINI karşılıyorsa
     * ok pedi gösterir. (Kullanıcı isteği: "ne açılacağını bilmeden onu
     * açmak için uğraşmam" — etiketler pedde, ok da yolu gösterir.) */
    {
      let pad: { x: number; z: number } | null = null;
      let padCost = Infinity;
      for (const zone of this.loc.zones) {
        if (this.zoneUnlocked(zone.id) || zone.cost <= 0) continue;
        if (zone.requires !== undefined && !this.zoneUnlocked(zone.requires)) continue;
        const remaining = Math.max(0, zone.cost - this.padPaid(zone.id));
        if (remaining > this.state.money) continue;
        if (remaining < padCost) {
          padCost = remaining;
          pad = { x: zone.padX, z: zone.padZ };
        }
      }
      if (pad) return { x: pad.x, z: pad.z, label: tr("BÖLÜMÜ AÇ"), color: GREEN };
    }

    /* --- 6b. parası hazır personel karesi — "PERSONEL İŞE AL" --- */
    {
      let bestPoint: { x: number; z: number } | null = null;
      let bestRole: StaffRole | null = null;
      let bestCost = Infinity;
      for (const role of STAFF_HIRE_ROLES) {
        const point = this.loc.staffHirePads[role];
        const pad = this.staffHirePads.get(role);
        if (!point || !pad?.root.visible) continue;
        const remaining = this.state.hireCostFor(role);
        if (remaining > this.state.money) continue;
        if (remaining < bestCost) {
          bestCost = remaining;
          bestPoint = point;
          bestRole = role;
        }
      }
      if (bestPoint && bestRole) {
        const roleName = STAFF_ROLE_MAP[bestRole].name.toLocaleUpperCase(localeTag());
        return { x: bestPoint.x, z: bestPoint.z, label: tr("{0} İŞE AL", roleName), color: GOLD };
      }
    }

    /* --- 7. zemin kirlendi → süpürgeyi al ---
     *
     * EN DÜŞÜK ÖNCELİK, bilerek. Trafik kiri acil bir iş değil: sipariş,
     * servis, bulaşık ve leke hepsi önce gelir. Ama zincirin sonunda
     * "yapacak bir şey yok" dönmek yerine burayı göstermek mekaniği
     * ÖĞRETİR — yoksa oyuncu süpürgenin zemin için de olduğunu hiç
     * öğrenemez (sistemin tek keşif yolu budur; ne öğreticide ne HUD'da
     * başka bir işaret var).
     *
     * Eşik `heavyCoverage` üzerinden: çöken ince toz filmi oku tetiklemez,
     * yalnız çok basılan yerlerde biriken ağır kir tetikler.
     */
    /**
     * `hasServiceWork()` şartı SALINIMI önler: masada karşılanmamış sipariş
     * varken (ama hazır ürün yokken) zincirin 2-6. adımları boş döner ve
     * burası oyuncuyu dolaba yollardı; süpürgeyi alır almaz da yukarıdaki
     * kapan-kırıcı "SÜPÜRGEYİ BIRAK" derdi — ok iki hedef arasında gidip
     * gelirdi.
     */
    if (this.grime.heavyCoverage > BALANCE.dirt.grimeGuideCoverage && !this.hasServiceWork()) {
      for (const dock of this.vacuums) {
        if (dock.locked) continue;
        return this.guideAt(dock, tr("SÜPÜRGEYİ AL"), 0xd8cfbb);
      }
    }
    return null;
  }

  /* ---------------- görseller ---------------- */

  private readonly visualElapsed=new Map<string,number>();
  private updateVisuals(dt: number): void {
    if (!this.draw3d) return;
    for (const st of this.stations) {
      /**
       * GÖRÜNMEYENİ GÜNCELLEME.
       *
       * Tüm bölgeler açılana kadar istasyonların yarısından çoğu ya
       * brandalı ya gizli. Buna rağmen her kare hepsi için setActive /
       * setProgress / setOutput çağrılıyordu; bunların içinde her seferinde
       * yeniden kurulan malzeme önbellek anahtarları ve metin birleştirmeleri
       * var. Kilitli istasyonun ilerleme halkasını hesaplamanın hiçbir
       * karşılığı yok.
       */
      const sv = this.stationVisuals.get(st.id);
      const pv = this.pickupVisuals.get(st.id);
      const half=STATION_BODY[st.def.visual]??{x:1,z:1};
      const visible=this.furnitureVisibility(st)!=='hidden'&&(!this.viewReady||sphereHitsFrustum(st.x,(sv?.root.position.y??pv?.root.position.y??0)+1.4,st.z,Math.hypot(half.x,half.z)+2.4,this.cullPlanes));
      if(sv)sv.root.visible=visible;if(pv)pv.root.visible=visible;
      const elapsed=Math.min(1.5,(this.visualElapsed.get(st.id)??0)+dt);
      if(!visible){this.visualElapsed.set(st.id,elapsed);continue;}
      this.visualElapsed.delete(st.id);
      if (st.locked) continue;
      if (sv) {
        const kind = st.def.kind;
        sv.setActive(kind === 'toilet' ? st.occupied : st.working && !st.broken);
        sv.setProgress(kind === 'toilet' ? st.soil : kind === 'table' ? (st.soil > 0.02 && st.dishes <= 0 ? st.progress01 : 0) : st.working ? st.progress01 : 0);
        sv.setBroken(st.broken);
        if (kind === 'table') {
          // Bulaşık ve yüzey kiri bilgisi (dishes + soil)
          sv.setOutput(st.dishes, Math.round(st.soil * 100), (st.dishes > 0 || st.soil > 0.02) ? 'bulasik' : null);
          TABLE_SCRATCH.length = 0;
          TABLE_COUNTS.clear();
          for (const guest of guestsOf(st)) {
            for (const item of guest.carriedItems) TABLE_COUNTS.set(item, (TABLE_COUNTS.get(item) ?? 0) + 1);
          }
          let ti = 0;
          for (const [item, count] of TABLE_COUNTS) {
            const slot = (TABLE_POOL[ti] ??= { item, count: 0, cap: 0 });
            slot.item = item;
            slot.count = count;
            slot.cap = st.seats;
            TABLE_SCRATCH.push(slot);
            ti++;
          }
          sv.setInput(TABLE_SCRATCH);
        } else if (kind === 'toilet') {
          SUPPLY_SCRATCH.length = 0;
          const supplies = st.def.supplies;
          if (supplies) {
            for (let si = 0; si < supplies.length; si++) {
              const s = supplies[si];
              const slot = (SUPPLY_POOL[si] ??= { item: s.item, count: 0, cap: 0 });
              slot.item = s.item;
              slot.count = Math.floor(st.supplyOf(s.item));
              slot.cap = st.supplyCap(s.item);
              SUPPLY_SCRATCH.push(slot);
            }
          }
          sv.setInput(SUPPLY_SCRATCH);
          sv.setOutput(restroomUseFee(this.averageMenuValue, this.state.saleMultiplier, st.soil, st.toiletSupplied), 0, null);
        } else {
          sv.setOutput(kind === 'counter' ? st.cash : st.output, st.outputCap, st.def.item ?? null);
        }
        sv.update(elapsed);
      }
      if (pv) {
        pv.setContents(st.contents, st.outputCap);
        pv.update(elapsed);
      }
    }
    this.spillView?.sync(this.spills, this.hasLift ? this.liftAt : undefined);
    this.grimeView?.sync(this.grime);
  }

  highlightNear(x: number, z: number, radius: number): void {
    this.highlightBusy = false;
    for (const st of this.stations) {
      const near = !st.locked && dist(x, z, st.x, st.z) < radius + 1.4;
      if (near) this.highlightBusy = true;
      this.stationVisuals.get(st.id)?.setHighlight(near);
      this.pickupVisuals.get(st.id)?.setHighlight(near);
    }
  }

  /* ---------------- ödeme pedleri ---------------- */

  private readonly _purchaseRows: import('../core/PurchaseMetrics').PurchaseObservation[] = [];
  private readonly _purchasePool: import('../core/PurchaseMetrics').PurchaseObservation[] = [];

  /** Screen-presented purchase targets; this measures exposure, not eye fixation. */
  purchaseObservations(player: Player): import('../core/PurchaseMetrics').PurchaseObservation[] {
    const rows = this._purchaseRows;
    rows.length = 0;
    if (!this.active || !this.root.visible) return rows;
    const pool = this._purchasePool;
    let pi = 0;
    const location = this.loc.id, cycle = this.state.prestigeCount;
    const stationary = player.planarSpeed < 1;
    const inFrame = (x: number, z: number): boolean =>
      this.viewReady && _frustum.containsPoint(_v3.set(x, floorLiftAt(this.loc, x, z) + 0.1, z));
    for (const zone of this.loc.zones) {
      if (zone.cost <= 0 || this.zoneUnlocked(zone.id)) continue;
      const visible = this.visiblePadIds.has(zone.id) && inFrame(zone.padX, zone.padZ);
      const row = (pool[pi] ??= { id: '', kind: 'zone', location, cycle, visible: false, onPad: false, stationary: false, paid: 0, total: 0 });
      pi++;
      row.id = zone.id;
      row.kind = 'zone';
      row.location = location;
      row.cycle = cycle;
      row.visible = visible;
      row.onPad = visible && Math.abs(player.x - zone.padX) < ZONE_PURCHASE_HALF - 0.1 &&
        Math.abs(player.z - zone.padZ) < ZONE_PURCHASE_HALF - 0.1;
      row.stationary = stationary;
      row.paid = this.padProgress.get(zone.id) ?? 0;
      row.total = zone.cost;
      rows.push(row);
    }
    const staffCounts = this.state.staffCountAt(location);
    for (const role of STAFF_HIRE_ROLES) {
      const point = this.loc.staffHirePads[role], pad = this.staffHirePads.get(role);
      const count = staffCounts[role];
      const visible = !!pad?.root.visible && inFrame(point.x, point.z);
      const row = (pool[pi] ??= { id: '', kind: 'staff', location, cycle, visible: false, onPad: false, stationary: false, paid: 0, total: 0 });
      pi++;
      row.id = role + ':' + count;
      row.kind = 'staff';
      row.location = location;
      row.cycle = cycle;
      row.visible = visible;
      row.onPad = visible && Math.abs(player.x - point.x) < STAFF_HIRE_PAD_HALF - 0.06 &&
        Math.abs(player.z - point.z) < STAFF_HIRE_PAD_HALF - 0.06;
      row.stationary = stationary;
      row.paid = this.state.hirePaidFor(role, location);
      row.total = this.state.hireTotalCostFor(role, location);
      rows.push(row);
    }
    return rows;
  }

  private updatePads(dt: number, player: Player | null): void {
    this.activeAdZone = null;
    for (const zone of this.loc.zones) {
      if (!this.visiblePadIds.has(zone.id)) {
        this.env?.setPadActive(zone.id, false);
        this.env?.setPadNear(zone.id, false);
        this.env?.setPadAdOffer(zone.id, null);
        continue;
      }
      if (this.zoneUnlocked(zone.id)) {
        this.env?.setPadAdOffer(zone.id, null);
        continue;
      }
      const blocked = zone.requires !== undefined && !this.zoneUnlocked(zone.requires);
      const paid = this.padProgress.get(zone.id) ?? 0;
      const remaining = Math.max(0, zone.cost - paid);
      this.env?.setPadProgress(zone.id, zone.cost > 0 ? paid / zone.cost : 0);

      const isInsufficient = remaining > 0.01 && this.state.money < remaining;
      const paidRatio = zone.cost > 0 ? paid / zone.cost : 0;
      const adTier: 'finish' | 'pay_half' = remaining <= zone.cost * 0.65 ? 'finish' : 'pay_half';
      // A half-price ad at ₺0 sells the expansion itself. The player must
      // already have paid 25% before that offer, and 35% before "finish".
      const offerAd = !blocked && isInsufficient && this.zoneDepth(zone.id) === 0
        && paidRatio >= (adTier === 'finish' ? 0.35 : 0.25);
      this.env?.setPadAdOffer(zone.id, offerAd ? adTier : null);

      /**
       * Etiket metni KADEMELİ yuvarlanır.
       *
       * `setPadLabel` metin değişmediyse erken çıkıyor, ama oyuncu pedin
       * üstünde beklerken `remaining` her kare değiştiği için metin de her
       * kare değişiyordu — sonuç: 512×192'lik bir canvas'ın yeniden
       * boyanıp GPU'ya yüklenmesi, saniyede 60 kez, hem de oyunun en
       * kutlamalı anında. Kalanı bin/yüzde birine yuvarlamak sayacı hâlâ
       * akıyor gösterir ama boyamayı ~%98 azaltır.
       */
      const step = remaining > 100_000 ? 1000 : remaining > 1000 ? 100 : 5;
      const shown = Math.ceil(remaining / step) * step;
      this.env?.setPadLabel(zone.id, blocked ? tr("KİLİTLİ") : `₺${formatShort(shown)}`);

      if (blocked || !player || !this.active) {
        this.env?.setPadActive(zone.id, false);
        continue;
      }

      const distance = dist(player.x, player.z, zone.padX, zone.padZ);
      this.env?.setPadNear(zone.id, distance < 3.6);
      const on = Math.abs(player.x - zone.padX) < ZONE_PURCHASE_HALF - 0.1 && Math.abs(player.z - zone.padZ) < ZONE_PURCHASE_HALF - 0.1;
      this.env?.setPadActive(zone.id, on);

      if (offerAd && on && !player.hasVacuum) {
        this.activeAdZone = { zone, tier: adTier, remaining };
      }

      const adInstruction = adTier === 'finish' ? tr("📺 REKLAMLA TAMAMLA") : tr("📺 %50 ÖDE");
      this.env?.setPadInstruction(zone.id, !on ? '' : player.hasVacuum ? tr("SÜPÜRGEYİ BIRAK") : remaining <= 0.01 ? tr("Açmak için dur") : isInsufficient && this.state.money <= 0
        ? adInstruction
        : player.planarSpeed >= 1 ? tr("Ödeme için dur") : tr("Üzerinde dur"));
      if (!on) {
        this.padCharge.set(zone.id, 0);
        continue;
      }

      /**
       * NİYET KAPISI. Eski eşik 0,25 sn'ydi ve pedin üstünden KOŞARAK
       * geçerken bile para akmaya başlıyordu — oyuncunun parasını istemeden
       * harcatmak en güven kırıcı hataydı. Şimdi ped üstünde padArmTime
       * kadar DURULMALI (koşarken şarj birikmez, hızla boşalır); bekleyiş
       * ayak dibindeki halkayla gösterilir, dolunca ödeme hızlı akar.
       */
      // An operating/cleaning contact is never consent to a nearby purchase.
      if (player.interacting || player.hasVacuum) {
        this.padCharge.set(zone.id, 0);
        this.env?.setPadActive(zone.id, false);
        continue;
      }
      const still = player.planarSpeed < 1.0;
      const prev = this.padCharge.get(zone.id) ?? 0;
      const charge = still ? prev + dt : Math.max(0, prev - dt * 2);
      this.padCharge.set(zone.id, charge);
      const arm = BALANCE.player.padArmTime;
      if (charge < arm) {
        const ringColor = (this.state.money <= 0 && remaining > 0.01)
          ? (adTier === 'finish' ? 0x10b981 : 0xf59e0b)
          : 0xffc84a;
        this.armRing?.show(player.x, player.z, charge / arm, ringColor);
        continue;
      }
      // A lower price can fully cover a previously partial deposit. Claim it
      // through the same standing gesture, returning only money already paid.
      if (remaining <= 0.01) {
        this.unlockZone(zone.id, 'pad');
        sfx('unlock');
        continue;
      }
      // Ödeme akışı hızlı: bekleyiş bir "yükleme çubuğu" olmamalı.
      const rate = Math.max(zone.cost * 0.4, 60) * Math.min(5, 1 + (charge - arm) * 2.2);
      const want = Math.min(remaining, rate * dt);
      const pay = Math.min(want, this.state.money);
      if (pay <= 0) {
        if (offerAd && still) {
          bus.emit('pad:ad_offer', { zoneId: zone.id, tier: adTier, remaining });
        }
        continue;
      }
      this.state.spend(pay);
      const next = paid + pay;
      this.padProgress.set(zone.id, next);
      this.vfx?.coinBurst(player.x, 1.1, player.z, 1);
      if (Math.random() < 0.3) sfx('coin', 0.4);
      if (next >= zone.cost - 0.01) {
        this.padProgress.set(zone.id, zone.cost);
        this.unlockZone(zone.id, 'pad');
        sfx('unlock');
      }
    }
  }

  /** Each role has its own small floor square beside that role's workplace. */
  private updateStaffHirePad(dt: number, player: Player | null): void {
    for (const role of Object.keys(this.loc.staffHirePads) as StaffRole[]) {
      const point = this.loc.staffHirePads[role];
      const pad = this.staffHirePads.get(role);
      const count = this.state.staffCountAt(this.loc.id)[role];
      const on = !!player && this.active && this.state.activeLocation === this.loc.id &&
        Math.abs(player.x - point.x) < STAFF_HIRE_PAD_HALF - 0.06 &&
        Math.abs(player.z - point.z) < STAFF_HIRE_PAD_HALF - 0.06;
      const previousCount = this.staffHireCountSeen.get(role) ?? count;
      this.staffHireCountSeen.set(role, count);
      // Menu hiring while standing here must not start another employee purchase.
      if (on && previousCount !== count) this.staffHireWaitExit.add(role);
      if (!on) this.staffHireWaitExit.delete(role);
      const visible = this.state.tutorialStep >= TUTORIAL_STEP_COUNT &&
        this.state.stats.orders > 0 &&
        this.state.staffRoleUnlocked(role, this.loc.id) &&
        count < this.state.activeStaffCapFor(role, this.loc.id) &&
        this.byId.get(point.station)?.locked === false;
      if (pad) { pad.root.visible = visible; pad.setHint(''); }
      if (!visible || !on || !player || this.staffHireWaitExit.has(role)) {
        this.staffHireCharge.set(role, 0);
        pad?.setArmed(0);
        pad?.setActive(false);
      }
      if (!visible) continue;
      const def = STAFF_ROLE_MAP[role];
      const total = this.state.hireTotalCostFor(role, this.loc.id);
      const paid = this.state.hirePaidFor(role, this.loc.id);
      const remaining = Math.max(0, total - paid);
      const step = remaining > 100_000 ? 1000 : remaining > 1000 ? 100 : 5;
      pad?.setLabel(def.name + ' · ₺' + formatShort(Math.ceil(remaining / step) * step));
      pad?.setProgress(total > 0 ? paid / total : 0);
      if (player && dist(player.x, player.z, point.x, point.z) < 2.5) {
        const benefit = tr(STAFF_HIRE_BENEFITS[role]);
        const message = on
          ? this.staffHireWaitExit.has(role) ? tr("Ekibe katıldı!")
            : this.state.money <= 0 ? (paid > 0 ? tr("Biriken ödeme korunur") : tr("Önce para topla"))
            : tr("İşe almak için dur")
          : benefit + ' · ' + tr("Karede dur");
        pad?.setHint(message);
      }
      if (!on || !player || this.staffHireWaitExit.has(role)) continue;
      if (player.interacting || player.hasVacuum) {
        this.staffHireCharge.set(role, 0);
        pad?.setArmed(0); pad?.setActive(false);
        continue;
      }
      pad?.setActive(true);
      // Crossing a square never contributes, even after an interrupted hold.
      const charge = player.planarSpeed < 1.0 ? (this.staffHireCharge.get(role) ?? 0) + dt : 0;
      this.staffHireCharge.set(role, charge);
      const arm = BALANCE.player.padArmTime;
      pad?.setArmed(charge / arm);
      if (charge < arm) continue;
      const rate = Math.max(80, total * 0.45) * Math.min(3, 1 + (charge - arm) * 1.5);
      const contributed = this.state.payStaffHire(role, rate * dt);
      if (contributed > 0) {
        pad?.setProgress(this.state.hirePaidFor(role) / total);
        this.vfx?.coinBurst(point.x, 0.35, point.z, 1);
      }
      if (this.state.staffCount[role] !== count) {
        this.staffHireWaitExit.add(role);
        this.staffHireCountSeen.set(role, this.state.staffCount[role]);
        this.staffHireCharge.set(role, 0);
        pad?.setProgress(1);
        pad?.setArmed(0);
        this.vfx?.puff(point.x, 0.25, point.z, Number.parseInt(def.color.slice(1), 16), 5);
        sfx('hire');
        haptic('medium');
      }
    }
  }

  /* ============================================================ *
   *  Oyuncu etkileşimi
   * ============================================================ */

  /**
   * Niyet kapısı: `key` adayının yanında DURARAK geçirilen süreyi biriktirir
   * ve 0..1 dolum döndürür. Aday değişirse sayaç sıfırlanır. 1'e ulaşınca
   * işlem serbesttir; oyuncu adayın menzilinde kaldığı sürece dolu kalır
   * (her ürün için yeniden bekletmek işkence olurdu).
   *
   * DURAKSAMA ŞARTI: sayaç yalnız oyuncu neredeyse dururken birikir,
   * koşarken hızla geri boşalır. İlk sürüm "menzil içinde geçen süre"yi
   * sayıyordu — 2,9'luk yarıçapı çaprazlamasına koşarak geçmek ~1 sn
   * sürdüğü için "yanından geçerken süpürgeyi kapıyor" şikâyeti aynen
   * geri gelmişti. Süre değil, NİYET ölçülmeli; niyetin göstergesi durmaktır.
   */
  private armGate(key: string, dt: number, need: number, color: number, player: Player): boolean {
    this.armTouched = true;
    if (this.armKey !== key) {
      this.armKey = key;
      this.armT = 0;
    }
    if (player.planarSpeed < 2.2) {
      this.armT = Math.min(need, this.armT + dt);
    } else {
      this.armT = Math.max(0, this.armT - dt * 2);
    }
    const t01 = need <= 0 ? 1 : this.armT / need;
    if (t01 < 1) {
      // Halka yalnız gerçekten dolarken görünsün; koşarken titreşen bir
      // halka "bir şey mi oluyor?" diye kafa karıştırır.
      if (player.planarSpeed < 2.2 || this.armT > 0) {
        this.armRing?.show(player.x, player.z, t01, color);
      }
      return false;
    }
    return true;
  }

  /* ---------------------------------------------------------------- *
   *  Temizlik fırçası
   * ---------------------------------------------------------------- */

  /** Fırçanın bir önceki karedeki konumu — iz bu iki nokta arasına çizilir. */
  private brushPrevX = 0;
  private brushPrevZ = 0;
  private readonly brushOut = { x: 0, z: 0 };

  /** The simulation follows the visible tool head, including actor scale and yaw. */
  private brushPoint(player: Player, vac: boolean): { x: number; z: number } {
    const out = this.brushOut;
    const d = vac ? BALANCE.vacuum.brushForward : MOP_FORWARD;
    const localX = Math.sin(vac ? player.vacuumYaw : 0) * d * player.char.root.scale.x;
    const localZ = Math.cos(vac ? player.vacuumYaw : 0) * d * player.char.root.scale.z;
    out.x = player.x + Math.cos(player.angle) * localX + Math.sin(player.angle) * localZ;
    out.z = player.z - Math.sin(player.angle) * localX + Math.cos(player.angle) * localZ;
    return out;
  }

  /** Empty hands use the floor mop after station work; the vacuum has its own mode. */
  private updateFloorCleaning(dt: number, player: Player): boolean {
    const vac = player.hasVacuum;
    const V = BALANCE.vacuum;
    const brush = this.brushPoint(player, vac);
    const bx = brush.x;
    const bz = brush.z;
    if (!vac && (!player.isEmpty || player.interacting)) {
      this.brushPrevX = bx;
      this.brushPrevZ = bz;
      this.vacuumTone = 0;
      return false;
    }
    // Teleports and tool switches must never draw a long cleaning stroke.
    if (Math.hypot(bx - this.brushPrevX, bz - this.brushPrevZ) > 1.2) {
      this.brushPrevX = bx;
      this.brushPrevZ = bz;
    }
    let cleared = 0;
    let touching = false;

    for (let i = this.spills.list.length - 1; i >= 0; i--) {
      const s = this.spills.list[i];
      const br = vac ? V.brushRadius : s.kind === 'toz' ? V.dustMopBrushRadius : V.mopBrushRadius;
      // Kaba eleme: fırça bu lekeye bu karede hiç yaklaşmadıysa atla
      // (önceki konumdan bu yana en fazla ~1,2 birim yol var).
      const reach = s.radius + br + 1.2;
      if (Math.abs(s.x - bx) > reach || Math.abs(s.z - bz) > reach) continue;
      const near = dist(s.x, s.z, bx, bz) < s.radius + br;
      if (near) touching = true;
      let n = this.spills.carveStroke(s, this.brushPrevX, this.brushPrevZ, bx, bz, br);
      /**
       * FIRÇA + OVMA. Hareket ederken iz bırakılır; lekenin üstünde
       * DURURKEN merkezden dışa doğru aşınır. İkincisi olmadan oyuncu
       * lekenin başında sonsuza dek kalıyordu (fırça aynı hücreleri
       * tarıyor, ilerleme sıfır) — bot 50 dakikada tek leke bitiremedi.
       */
      if (near) {
        const sec = vac
          ? V.scrubSeconds
          : s.kind === 'toz'
            ? V.dustMopScrubSeconds
            : V.mopScrubSeconds;
        n += this.spills.scrubAt(s, bx, bz, dt, 1 / sec);
      }
      if (n <= 0) continue;
      cleared += n;
      if (s.cellsLeft <= 0) {
        this.spills.remove(s);
        this.state.stats.mopped++;
        this.payClean(
          s.kind === 'toz' ? BALANCE.dirt.dustRewardRate : BALANCE.dirt.spillRewardRate,
          s.x,
          s.z,
          true,
        );
        this.vfx?.ring(s.x, 0.06, s.z, vac ? 0xd8cfbb : 0x4fb59a, 1.8);
        this.vfx?.puff(s.x, 0.3, s.z, 0xefe7d6, 6);
        sfx('goal', 0.35);
        haptic('success');
      }
    }
    /**
     * TRAFİK KİRİ DE AYNI FIRÇAYLA SİLİNİR — ama YALNIZ SÜPÜRGEYLE.
     *
     * `grimeMopMult` sıfırdır ve öyle kalmalı: fırça pasif bir katmandır,
     * oyuncu zaten sürekli koşar. Süpürgesizken de silseydi oyuncunun kendi
     * yürüyüşü izleri temizler, mekanik kendi kendini yerdi.
     */
    const gMult = vac ? 1 : BALANCE.dirt.grimeMopMult;
    if (gMult > 0) {
      const removed = this.grime.cleanStroke(
        this.brushPrevX,
        this.brushPrevZ,
        bx,
        bz,
        V.brushRadius,
        BALANCE.dirt.grimeBrushStrength * gMult,
      );
      if (removed > 0) {
        player.interacting = true;
        player.interactionKind = 'mop';
        this.grimeRewardAcc += removed;
        const unit = BALANCE.dirt.grimeRewardUnit;
        while (this.grimeRewardAcc >= unit) {
          this.grimeRewardAcc -= unit;
          this.payClean(BALANCE.dirt.dustRewardRate, bx, bz, true);
        }
        if (this.rng.chance(dt * 10)) {
          this.vfx?.sparkle(bx + this.rng.range(-0.3, 0.3), 0.16, bz, 0xd8cfbb);
        }
      }
    }

    this.brushPrevX = bx;
    this.brushPrevZ = bz;

    /**
     * Emiş sesi lekeye DEĞDİĞİ sürece çalar (hücre açmasa bile): oyuncu
     * lekenin üstünde duruyorsa ses kesilmemeli, yoksa "bozuldu" hissi olur.
     */
    this.vacuumTone = touching ? 1 : 0;

    if (cleared > 0) {
      player.interacting = true;
      player.interactionKind = 'mop';
      // Sabun köpüğü ve pırıltı fırçanın ucunda doğar (Clean It tatmini)
      if (this.rng.chance(dt * (vac ? 16 : 9))) {
        this.vfx?.foamBurst(bx, 0.04, bz, vac ? 2 : 4);
      }
      if (this.rng.chance(dt * (vac ? 18 : 7))) {
        const a = this.rng.range(0, Math.PI * 2);
        const rr = this.rng.range(0.1, 0.45);
        this.vfx?.sparkle(
          bx + Math.cos(a) * rr,
          0.18 + this.rng.range(0, 0.35),
          bz + Math.sin(a) * rr,
          vac ? 0xd8cfbb : 0x9fe0f5,
        );
      }
      return true;
    }
    if (touching) {
      player.interacting = true;
      player.interactionKind = 'mop';
      return true;
    }
    return false;
  }

  /** Emiş sesi yoğunluğu 0..1 — Game ses katmanına aktarır. */
  vacuumTone = 0;

  private updatePlayerInteraction(dt: number, player: Player): void {
    this.updateStationInteraction(dt, player);
    if (this.updateSideInteraction(dt,player)) return;
    if (!player.hasVacuum) this.updateFloorCleaning(dt, player);
  }

  private updateStationInteraction(dt: number, player: Player): void {
    const r = BALANCE.player.interactRadius;
    this.highlightNear(player.x, player.z, r);
    this.releaseStaleLocks(player, r);

    player.handTimer -= dt;

    /**
     * 0) Taşıdıklarından birini kabul eden EN YAKIN istasyon → bırak
     *    (masaya SERVİS de budur). Yığın karma olduğu için her farklı ürün
     *    için aday bakılır; en yakın kabul eden kazanır.
     *
     * SÜPÜRGE KONTROLÜNDEN ÖNCE gelir — BİLEREK. Kova ile süpürge dolabı
     * yerleşimde yakın durabiliyor; bulaşığı kovaya atmaya giden oyuncu
     * süpürgenin de menziline giriyordu ve eskiden süpürge kontrolü ÖNCE
     * çalıştığı için elindekini bırakamadan süpürgeyi kapıyordu. Elde bir
     * şey varsa niyet bellidir (teslim etmek); süpürgeye bakılmaz.
     */
    if (player.carryCount > 0) {
      let target: StationEntity | null = null;
      let serveItem: ItemId | null = null;
      let bestD = Infinity;
      for (const it of player.distinctItems()) {
        const cand = this.nearestAccepting(player.x, player.z, r, it, player.noDropTo);
        if (!cand) continue;
        const d = dist(player.x, player.z, cand.x, cand.z);
        if (d < bestD) {
          bestD = d;
          target = cand;
          serveItem = it;
        }
      }
      if (target && serveItem) {
        if (!this.playerAccess(target, player.x, player.z, 1.35, _pt)) return;
        player.interacting = true;
        player.interactionKind = 'reach';
        player.faceTowards(target.x, target.z, dt, 10);
        const serveKey = `serve:${target.id}:${serveItem}`;
        const serveArmed = this.armGate(serveKey, dt, 0.36, ITEMS[serveItem].color, player);
        if (
          serveArmed &&
          player.tryHandContact(serveKey, 'reach', dt, this.state.handInterval) &&
          target.accept(serveItem)
        ) {
          player.takeItem(serveItem);
          player.noTakeFrom = target.id;
          this.onItemPlaced(target, serveItem, true);
        }
        return;
      }
    }

    // Deliver held orders first; then collect visible earnings before taking more products.
    if (!player.hasVacuum && this.collectCounterCash(dt,player)) return;

    // A brief stop anywhere around the tool also works; no fixed service point.
    if (this.updateVacuumDock(dt, player)) return;

    // A held vacuum excludes station work; the mop yields to it.
    if (player.hasVacuum) this.updateFloorCleaning(dt, player);

    /**
     * SÜPÜRGE BİR ALETTİR, MOD DEĞİL.
     *
     * Eskiden süpürge taşıma yığınını hiç işgal etmiyordu ("yoksa oyuncu
     * süpürgeyle servis yapamazdı" gerekçesiyle): karakter önünde süpürge
     * iterken göğsünde çay+tost kulesi yükseliyordu. Tür standardı (Clean
     * It dahil) alet-münhasırdır: alet eldeyken alet işi yapılır.
     */
    if (player.hasVacuum) return;

    /**
     * 2) Kirli masayı topla — temizlik PARA KAZANDIRIR.
     *
     * SON SLOT KORUMASI: bulaşık toplama kapısızdır ve 3,7 birim menzilde
     * anında tetiklenir; elinde 2/3 çayla sipariş masasına yürürken kirli
     * bir masanın yanından geçmek SON slotu bulaşıkla dolduruyor, üçüncü
     * çay alınamıyor ve rehber oyuncuyu kovaya yolluyordu.
     *
     * Çözüm niyet kapısı DEĞİL: kapı tek slotludur (`armKey`) ve ödeme
     * pediyle yarışıp ikisini birden kilitliyor — denetimin "gizil" dediği
     * tuzak tam olarak böyle tetiklendi (bot 50 dakikada 4 bölge açabildi).
     * Bunun yerine basit bir kural: ürün taşırken bulaşık ancak ARDINDA
     * hâlâ boş slot kalacaksa alınır. Eller boşken kural yok, temizlik akıcı.
     */
    const dirty = this.nearestDirtyTable(player.x, player.z, r);
    if (dirty) {
      if (!this.playerAccess(dirty, player.x, player.z, 1.4, _pt)) return;
      const carryingProduct = player.slots.some((it) => isProduct(it));
      const roomAfter = player.capacity - player.slots.length - 1;

      if (dirty.dishes > 0 && player.canTake('bulasik') && !(carryingProduct && roomAfter < 1)) {
        player.interacting = true;
        player.interactionKind = 'reach';
        player.faceTowards(dirty.x, dirty.z, dt, 10);
        const dishKey = `dish:${dirty.id}`;
        const dishArmed = this.armGate(dishKey, dt, 0.34, 0x8a7f74, player);
        if (
          dishArmed &&
          player.tryHandContact(dishKey, 'reach', dt, this.state.handInterval) &&
          dirty.takeDish() &&
          player.give('bulasik')
        ) {
          this.state.stats.cleaned++;
          dirty.cleanValue++;
          this.playerCare = { id: dirty.id, remaining: 35 };

          // Masadan oyuncunun ellerine doğru uçan tabak yayı (lerp arc)
          this.vfx?.flyDish(
            dirty.x + this.rng.range(-0.12, 0.12),
            1.04,
            dirty.z + this.rng.range(-0.12, 0.12),
            player.x,
            this.liftAt(player.x, player.z) + 0.88,
            player.z,
          );
          // Tok porselen tıkırtısı ve minik beyaz hava patlaması
          this.vfx?.puff(dirty.x, 1.12, dirty.z, 0xf0ece2, 4);
          sfx('dish_clatter', 0.65);

          if (dirty.dishes === 0 && dirty.soil <= 0.02) {
            this.assignWaitingCustomersToTables();
          }
        }
        return;
      }

      // Bulaşık veya süpürge taşırken masa silinmez; elde yalnız ürün varken masa parlatılabilir.
      if (dirty.dishes <= 0 && dirty.soil > 0.02 && !player.hasVacuum && !player.hasItem('bulasik')) {
        this.playerCare = { id: dirty.id, remaining: 35 };
        player.interacting = true;
        player.interactionKind = 'wipe';
        player.faceTowards(dirty.x, dirty.z, dt, 10);
        const before = dirty.soil;
        dirty.soil = Math.max(0, dirty.soil - dt / BALANCE.dirt.playerTablePolishTime);
        dirty.progress = 1 - dirty.soil / Math.max(0.01, dirty.cleanStartSoil || dirty.soil);

        this.stationVisuals.get(dirty.id)?.onWipe?.(dt);

        if (this.rng.chance(dt * 7)) {
          const wipeX = player.x + (dirty.x - player.x) * 0.68 + this.rng.range(-0.14, 0.14);
          const wipeZ = player.z + (dirty.z - player.z) * 0.68 + this.rng.range(-0.14, 0.14);
          this.vfx?.foamBurst(wipeX, 1.01, wipeZ, 3);
          this.vfx?.puff(wipeX, 1.06, wipeZ, 0xbfe8ff, 1);
          sfx(this.rng.chance(0.35) ? 'squeak' : 'wipe', 0.4);
        }
        if (before > 0.02 && dirty.soil <= 0.02) {
          dirty.soil = 0;
          dirty.progress = 0;
          dirty.cleanStartSoil = 0;
          this.state.stats.tablesCleaned++;
          this.playerCare = null;

          // Tamamlanma: parlama süpürmesi + altın/turkuaz ışıltı + neon halka + kristal zil
          this.stationVisuals.get(dirty.id)?.playGleam?.();
          this.vfx?.sparkleBurst(dirty.x, 1.15, dirty.z, 12, 0xfff3c4);
          this.vfx?.sparkleBurst(dirty.x, 1.3, dirty.z, 8, 0x7ff0e0);
          this.vfx?.ring(dirty.x, 1.02, dirty.z, 0x7ff0e0, 1.4);
          this.vfx?.ring(dirty.x, 1.02, dirty.z, 0xffffff, 1.1);
          sfx('clean_chime', 0.7);
          sfx('coin', 0.45);
          haptic('success');

          // 4. Floating UI / Ödül: +₺[KAZANÇ] ve TERTEMİZ! ✨ metinleri + cüzdana uçan paralar
          bus.emit('table:cleaned', { id: dirty.id, x: dirty.x, z: dirty.z, byPlayer: true });
          const completedWork = Math.max(1, dirty.cleanValue);
          dirty.cleanValue = 0;
          this.payClean(BALANCE.dirt.dishRewardRate * completedWork, dirty.x, dirty.z, true);
          this.assignWaitingCustomersToTables();
        }
        return;
      }
    }

    // Floor mopping runs after this interaction dispatcher when the hands are free.

    // 4) Kirli tuvaleti ov
    for (const wc of this.toilets) {
      if (wc.locked || wc.soil <= 0 || wc.occupied) continue;
      wc.playerPoint(player.x, player.z, _pt, 0.4);
      if (dist(player.x, player.z, _pt.x, _pt.z) > 1.45) continue;
      player.interacting = true;
      player.interactionKind = 'wipe';
      player.faceTowards(wc.x, wc.z, dt, 10);
      const before = wc.soil;
      wc.soil = Math.max(0, wc.soil - dt / BALANCE.toilet.playerScrubTime);
      if (wc.soil <= .02) wc.soil = 0;
      if (this.rng.chance(dt * 4)) {
        this.vfx?.sparkle(wc.x + this.rng.range(-0.6, 0.6), 1.3, wc.z + 0.6, 0x9fe0f5);
        sfx('repair', 0.25);
      }
      if (before > 0 && wc.soil <= 0) {
        this.payClean(BALANCE.dirt.scrubRewardRate, wc.x, wc.z, true);
        this.vfx?.ring(wc.x, 0.2, wc.z, 0x4fb59a, 2.2);
        sfx('goal', 0.5);
      }
      return;
    }

    /**
     * 5) ELDEKİNİ BOŞALT (bilinçli). İki hedef:
     *   · teslim bankosunun ARKA yüzü → ürünü rafa bırak (garson taşısın),
     *   · kova → üründen kurtul (değer kaybı oyuncunun bilinçli seçimi).
     * İkisi de niyet kapılıdır: yanından geçerken olmaz, durunca halka
     * dolar, sonra teker teker boşalır. "Elimize aldığımızı geri
     * boşaltamıyoruz" çıkmazının cevabı bu adımdır.
     */
    if (player.carryCount > 0) {
      let target: StationEntity | null = null;
      let dropItem: ItemId | null = null;
      let bestD = Infinity;
      for (const it of player.distinctItems()) {
        // Ürün VE sarf niyet kapısından boşaltılabilir. Sarf kovaya
        // atılamayınca (iki tuvalet de doluyken) el kilitleniyordu.
        if (!isProduct(it) && !isSupply(it)) continue;
        for (const st of this.stations) {
          if (st.locked || st.id === player.noDropTo) continue;
          const pickupBack =
            st.def.kind === 'pickup' && st.canAccept(it) && st.sideOf(player.x, player.z) < 0;
          const bin = st.def.kind === 'bin' && st.canAccept(it);
          if ((!pickupBack && !bin) || !this.playerAccess(st,player.x,player.z,1.35,_pt)) continue;
          const d = dist(player.x,player.z,_pt.x,_pt.z);
          if (d > r || d >= bestD) continue;
          bestD = d;
          target = st;
          dropItem = it;
        }
      }
      if (target && dropItem) {
        if (!this.playerAccess(target, player.x, player.z, 1.35, _pt)) return;
        player.interacting = true;
        player.interactionKind = 'reach';
        const tint = target.def.kind === 'bin' ? 0xd23b2e : ITEMS[dropItem].color;
        const unloadKey = `unload:${target.id}:${dropItem}`;
        const unloadArmed = this.armGate(unloadKey, dt, 0.55, tint, player);
        if (unloadArmed && player.tryHandContact(unloadKey, 'reach', dt, this.state.handInterval)) {
          if (target.accept(dropItem)) {
            player.takeItem(dropItem);
              player.noTakeFrom = target.id;
            this.pickupVisuals.get(target.id)?.pop();
            this.vfx?.puff(target.x, 1.1, target.z, ITEMS[dropItem].color, 3);
            sfx('drop', 0.45);
            this.bumpTempo(BALANCE.tempo.gain.shelfDrop);
          }
        }
        return;
      }
    }

    // 6) Yakında çıkışı olan bir istasyondan al — niyet kapısından geçince
    const src = this.nearestWithOutput(player.x, player.z, r, player);
    if (src) {
      if (!this.playerAccess(src,player.x,player.z,1.3,_pt,true)) return;
      player.interacting = true;
      player.interactionKind = 'reach';
      player.faceTowards(src.x, src.z, dt, 10);
      const itemColor = src.def.item ? ITEMS[src.def.item].color : 0xffc84a;
      const takeKey = `take:${src.id}`;
      if (!this.armGate(takeKey, dt, BALANCE.player.pickupArmTime, itemColor, player)) return;
      if (player.tryHandContact(takeKey, 'reach', dt, this.state.handInterval)) {
        /**
         * BANKODAN GEREKEN ÜRÜN ALINIR — sıradaki değil.
         *
         * HATA (oyuncu bildirdi: "kruvasan alıp masaya götürmek isterken
         * çay alıyor"): teslim bankosu ortak bir tampon ve `takeOutput()`
         * `contents.shift()` yapıyordu, yani FIFO. Bankoda [çay, kruvasan]
         * varken kruvasan isteyen oyuncuya çay veriliyordu ve oyuncunun
         * bunu düzeltmesinin hiçbir yolu yoktu.
         *
         * Garsonlar bu sorunu zaten çözmüştü (`Staff.fetchItem` →
         * `Station.takeItem`); eksik olan oyuncuya aynı yeteneğin
         * verilmesiydi. Artık masada BEKLEYEN siparişlerin istediği bir
         * ürün bankoda varsa o alınır; talep yoksa eski FIFO davranışı
         * korunur (banko boşaltmak da geçerli bir eylemdir).
         *
         * Ürün BAŞINA AYRI BANKO yapmak yanlış cevap olurdu: v3.0'da dokuz
         * özdeş vitrin tek bankoya indirilmişti çünkü bar "dokuz özdeş
         * dolaptan oluşan bir duvar" gibi okunuyordu. Sorun banko sayısı
         * değil SEÇİM mantığıydı.
         */
        const item = src.def.kind === 'pickup' ? this.takeWanted(src) : src.takeOutput();
        if (item) {
          if (player.give(item)) {
              player.noDropTo = src.id;
            bus.emit('item:picked', { item, x: src.x, z: src.z });
            this.vfx?.puff(src.x, 1.0, src.z + 0.7, ITEMS[item].color, 3);
            sfx('pickup', 0.5);
          } else if (src.def.kind === 'pickup') {
            src.accept(item);
          } else {
            // Geri koyarken tavanı aş(ma): output > cap makineyi süresiz durduruyordu.
            src.output = Math.min(src.outputCap, src.output + 1);
          }
        }
      }
      return;
    }


  }

  /** Clear the visible till before taking another product at overlapping work areas. */
  private collectCounterCash(dt: number, player: Player): boolean {
    for (const co of this.counters) {
      if (co.locked || co.cash <= 0) continue;
      if (!this.playerAccess(co,player.x,player.z,1.3,_pt)) continue;
      player.interacting = true;
      player.interactionKind = 'cash';
      player.faceTowards(co.x, co.z, dt, 10);
      const cashKey = `cash:${co.id}`;
      const cashArmed = this.armGate(cashKey, dt, 0.14, 0xffc84a, player);
      if (cashArmed && player.tryHandContact(cashKey, 'cash', dt, Math.max(0.09, BALANCE.money.pickupInterval * 0.5))) {
        const before = co.cash;
        const batch = Math.min(before, Math.max(1, Math.ceil(before / 2)));
        const amount = (co.cashValue / before) * batch;
        co.cash -= batch;
        co.cashValue = Math.max(0, co.cashValue - amount);
        if (co.cash === 0) co.cashValue = 0;
        this.state.earn(amount, co.x, co.z, 1.5);
        // Öğretici "PARAYI TOPLA" adımı bunu dinler: leke/bulaşık ödülü
        // değil, TEZGÂHTAN toplama sayılmalı (bkz. sim/Tutorial.ts).
        bus.emit('counter:collected', { amount });
        this.bumpTempo(BALANCE.tempo.gain.cashCollect);
        this.vfx?.coinBurst(co.x, 1.3, co.z, Math.min(8, 2 + batch));
        sfx('coin', 0.5);
        if (co.cash === 0) haptic('success');
      }
      return true;
    }
    return false;
  }

  /**
   * PİNG-PONG KİLİDİ. Banko hem alınacak hem bırakılacak bir istasyondur;
   * kilit olmasa oyuncu önünde durduğu sürece "al → bırak → al" döngüsüne
   * girerdi. Kilit yalnızca oyuncu menzilden çıkınca açılır.
   */
  private releaseStaleLocks(player: Player, r: number): void {
    const far = (id: string | null): boolean => {
      if (!id) return false;
      const st = this.byId.get(id);
      if (st?.def.kind === 'vacuum') {
        return dist(player.x, player.z, st.x, st.z) > 2.6;
      }
      return !st || dist(player.x, player.z, st.x, st.z) > r + 1.4;
    };
    /**
     * BANKO İSTİSNASI: bankoda alma ve bırakma zaten AYRI yüzlerdedir,
     * yani yüz değiştirmek başlı başına yeni bir niyettir — ping-pong bu
     * yolla kurulamaz (bırakılan yüzden alınamaz, alınan yüzden
     * bırakılamaz). Kilidi yüz geçişinde hemen açmazsak şu tuzak doğuyor:
     * oyuncu arka yüze ürün bırakır, sipariş gelir, ön yüze koşar ve
     * 4+ birim uzaklaşana kadar raftaki ürünü alamaz.
     */
    if (player.noTakeFrom) {
      const st = this.byId.get(player.noTakeFrom);
      if (st && st.def.kind === 'pickup' && st.sideOf(player.x, player.z) > 0) player.noTakeFrom = null;
    }
    if (player.noDropTo) {
      const st = this.byId.get(player.noDropTo);
      if (st && st.def.kind === 'pickup' && st.sideOf(player.x, player.z) < 0) player.noDropTo = null;
    }
    if (far(player.noTakeFrom)) player.noTakeFrom = null;
    if (far(player.noDropTo)) player.noDropTo = null;
  }

  /**
   * @param byPlayer Bu yerleştirmeyi OYUNCU mu yaptı — yalnız 'toilet'
   *   dalında önemli: `payClean`'e iletilir. Komi de aynı metodu çağırır
   *   (bkz. doDeliver, updateBusser'ın sarf teslimi) ve o yol tempoyu
   *   BESLEMEMELİ, bu yüzden varsayılan `false`.
   */
  private onItemPlaced(target: StationEntity, item: ItemId, byPlayer = false): void {
    switch (target.def.kind) {
      case 'table': {
        const guest = target.takeLastServedGuest() as Customer | null;
        if (!guest) break;
        this.settleDeliveredItem(guest, item, target.x, target.z);
        this.state.stats.served++;
        this.state.addReputation(BALANCE.orders.servedRepGain);
        bus.emit('item:served', { item, x: target.x, z: target.z });
        this.vfx?.puff(target.x, 1.2, target.z, ITEMS[item].color, 4);
        if (byPlayer) this.bumpTempo(BALANCE.tempo.gain.shelfDrop);
        const left = guest.order?.remainingOf(item) ?? 0;
        if (left > 0) guest.showItem(item, left);
        else if (guest.orderComplete) this.startEating(guest);
        sfx('drop', 0.55);
        break;
      }
      case 'pickup':
        bus.emit('item:stocked', { item, x: target.x, z: target.z });
        this.pickupVisuals.get(target.id)?.pop();
        this.vfx?.puff(target.x, 1.1, target.z + 0.6, ITEMS[item].color, 4);
        sfx('stock', 0.55);
        break;
      case 'toilet':
        this.state.stats.refills++;
        this.payClean(BALANCE.dirt.refillRewardRate, target.x, target.z, byPlayer);
        bus.emit('item:refilled', { item, x: target.x, z: target.z });
        this.vfx?.sparkle(target.x, 1.4, target.z + 0.5, 0xffffff);
        sfx('drop', 0.5);
        break;
      case 'bin': {
        /**
         * KOVA EFEKTİ — üç katman: kapak çarpması, içeri düşen bulaşık ve
         * kenardan taşan toz. Tek bir gri puf "bir şey oldu" bile demiyordu;
         * temizlik oyunun gelir kalemiyse en tatmin edici an burası olmalı.
         */
        this.vfx?.puff(target.x, 1.15, target.z, 0xbfc7cc, 5);
        this.vfx?.puff(target.x, 0.55, target.z, 0x8a949b, 4);
        this.vfx?.ring(target.x, 0.06, target.z, 0x8a949b, 1.1);
        this.vfx?.sparkle(target.x, 1.35, target.z, 0xdfe6ea);
        sfx('drop', 0.55);
        break;
      }
      default:
        break;
    }
  }

  /** All player candidate selection and execution share the same reachable approach. */
  private playerAccess(station: StationEntity, x: number, z: number, limit: number, out: {x: number; z: number}, pickup = false): boolean {
    station.playerPoint(x, z, out);
    const range = Math.max(limit, 1.45);
    const d = dist(x, z, out.x, out.z);
    if (d > range) return false;
    // When directly at or touching the station (d <= 0.55m), allow immediate direct contact
    if (d <= 0.55) return true;
    return this.nav.interactionLineClear(x, z, out.x, out.z);
  }

  private nearestDirtyTable(x: number, z: number, r: number): StationEntity | null {
    let best: StationEntity | null = null;
    let bestD = (r + 0.8) * (r + 0.8);
    for (const t of this.tables) {
      if (t.locked || (t.dishes <= 0 && t.soil <= 0.02)) continue;
      if ((t.x - x) ** 2 + (t.z - z) ** 2 > (r + 0.8) ** 2) continue;
      if (!this.playerAccess(t, x, z, 1.4, _pt)) continue;
      const d = (_pt.x - x) ** 2 + (_pt.z - z) ** 2;
      // Choose an actionable service face; a closer table body behind the
      // player must not swallow interaction with the table in front of them.
      if (d <= 1.4 ** 2 && d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  /**
   * OYUNCU İÇİN bırakma hedefi arar — TESLİM BANKOSU HARİÇ.
   *
   * Banko (`pickup`) her ürünü kabul eder ve genelde tam da mutfaktan
   * masaya giden yol üstündedir; oyuncu buraya "isteyerek" değil sırf
   * yakınından geçtiği için ürünü bırakıyordu. Sonra bankonun önüne
   * dolaşıp AYNI ürünü GERİ ALIP gerçek hedefe (masaya) taşımak zorunda
   * kalıyordu — "neden teslim noktasına bırakıp geri alıyoruz" şikâyeti
   * buradan geliyordu. Banko personelin tamponu; oyuncu makineden
   * DOĞRUDAN masaya taşır. Kova/tuvalet gibi tekil-amaçlı hedefler
   * (bulaşık, sarf) etkilenmez — onlar zaten tek bir doğru hedef.
   */
  private nearestAccepting(x: number, z: number, r: number, item: ItemId, skipId: string | null): StationEntity | null {
    let best: StationEntity | null = null;
    let bestD = Infinity;
    for (const st of this.stations) {
      if (st.id === skipId) continue;
      if (st.def.kind === 'pickup') continue;
      // Ürünün ve sarfın kovaya atılması BİLİNÇLİ boşaltma adımının işi
      // (niyet kapılı); anlık bırakma yolundan ürün/sarf çöpe düşmez.
      // (Sarf: tuvalete peçete taşırken kovanın yanından geçmek eldeki
      // peçeteyi çöpe boşaltmamalı.)
      if (st.def.kind === 'bin' && (isProduct(item) || isSupply(item))) continue;
      if (!st.canAccept(item)) continue;
      // Masaya servis ve kovaya atma biraz daha uzaktan yapılabilsin —
      // kova için "önüne gelmeden boşaltmıyor" hissinin ilacı budur.
      const range = st.def.kind === 'table' || st.def.kind === 'bin' ? r + 0.8 : r;
      if ((st.x - x) ** 2 + (st.z - z) ** 2 > range * range) continue;
      if (!this.playerAccess(st, x, z, 1.35, _pt)) continue;
      const d = (_pt.x - x) ** 2 + (_pt.z - z) ** 2;
      if (d <= 1.35 ** 2 && d < bestD) {
        bestD = d;
        best = st;
      }
    }
    return best;
  }

  private nearestWithOutput(x: number, z: number, r: number, player: Player): StationEntity | null {
    let best: StationEntity | null = null;
    let bestD = r * r;
    const consider = (st: StationEntity, item: ItemId | null) => {
      if (st.id === player.noTakeFrom) return;
      if (st.locked || st.output <= 0 || !item) return;
      if (!player.canTake(item)) return;
      if ((st.x-x)**2 + (st.z-z)**2 > r*r || !this.playerAccess(st,x,z,1.3,_pt,true)) return;
      const d = (_pt.x-x)**2 + (_pt.z-z)**2;
      if (d < bestD) {
        bestD = d;
        best = st;
      }
    };
    for (const st of this.machines) consider(st, st.def.item ?? null);
    // Bankodan yalnız ÖN yüzden alınır; arka yüz bırakma tarafıdır.
    // Aynı yüzde hem al hem bırak olsaydı niyet ayrıştırılamazdı.
    const need = this.demandSet(this._demand);
    for (const st of this.pickups) {
      if (st.sideOf(x, z) > 0) consider(st, this.peekWanted(st, need, player));
    }
    return best;
  }

  /* ============================================================ *
   *  Sipariş tezgâhları
   * ============================================================ */

  private updateCounters(dt: number, player: Player | null): void {
    for (const co of this.counters) {
      if (co.locked) continue;

      // Kasiyer yalnız sipariş alır. Nakit, oyuncunun dünyada yaptığı
      // ana işlerden biridir ve hiçbir personel tarafından süpürülmez.

      /**
       * SIRAYI TEMİZLE. Kuyruğun başında ölü ya da artık sırada olmayan bir
       * müşteri kalırsa tezgâh sonsuza dek kilitlenir; bu yüzden her karede
       * geçersiz kayıtlar süpürülür. Ucuz bir işlem (kuyruk en fazla 6 kişi).
       */
      const q = queueOf(co);
      let pruned = false;
      for (let i = q.length - 1; i >= 0; i--) {
        const c = q[i];
        if (!c || c.done || (c.state !== 'toCounter' && c.state !== 'queue' && c.state !== 'order')) {
          q.splice(i, 1);
          pruned = true;
        }
      }
      if (pruned) this.reindexQueue(co);

      const head = q[0] as Customer | undefined;
      if (!head || head.state !== 'order') {
        co.orderTimer = 0;
        continue;
      }

      const staffed = this.cashierReady(co) && !this.rushPlayerOnly;
      let take = staffed ? co.counterOrderTime('cashier', this.state.staffLevelAt(this.loc.id).cashier) : 0;
      if (player && this.active && !player.hasVacuum) {
        co.playerPoint(player.x, player.z, _pt, 0.4);
        if (dist(player.x, player.z, _pt.x, _pt.z) < 1.45) {
          const manual = co.counterOrderTime('player');
          take = take > 0 ? Math.min(take, manual) : manual;
          player.interacting = true;
          player.interactionKind = 'cash';
          player.faceTowards(co.x, co.z, dt, 10);
        }
      }
      if (take <= 0) {
        co.orderTimer = 0;
        continue;
      }

      co.orderTimer += dt;
      if (co.orderTimer < take) continue;
      co.orderTimer = Math.max(0, co.orderTimer - take);
      this.placeOrder(co, head);
    }
  }

  private placeOrder(co: StationEntity, c: Customer): void {
    // Paket/masada yeme niyeti sipariş anında bellidir. Masa o anda dolu
    // olsa bile paket müşteriler içeri girebilir; masada yiyecek olanlar
    // ürününü aldıktan sonra kısa süre yer bekler.
    const tutorialService = this.state.tutorialStep < TUTORIAL_STEP_COUNT;
    c.dineIn =
      this.salonOpen &&
      (tutorialService || this.rng.chance(clamp01((this.loc.dineInChance ?? BALANCE.orders.dineInChance) * c.arch.dineInBias)));

    const order = this.buildOrder(c);
    queueOf(co).shift();
    this.reindexQueue(co);
    c.queueIndex = -1;

    if (!order) {
      this.makeAngry(c, 'no_menu', false);
      return;
    }

    c.order = order;
    c.waiting = false;
    /** Sipariş burada yalnız fiyatlanır; para her gerçek teslimatta kasaya düşer. */
    this.quoteOrder(c);
    const want = order.nextWanted();
    if (want) c.showItem(want, order.remainingOf(want));
    c.showBubble(true);
    bus.emit('order:placed', { id: order.id, lines: order.lines.length, x: co.x, z: co.z });
    this.vfx?.emote(co.x, 1.9, co.z, 'happy');

    // Aktif-idle hibrit servis: paket müşteri raftan kendi alır; salonda
    // yiyecek müşteri sipariş anında sandalye ayırır ve oyuncunun masaya
    // getirmesini bekler. Personel masaya servis yapamaz.
    if (c.dineIn) {
      this.routeToTable(c);
      c.state = 'toTable';
      c.tableWait = 0;
      if (c.table) {
        c.maxPatience = c.arch.patience * c.patienceMult * BALANCE.orders.seatedPatienceMult * this.patienceScale;
        c.patience = c.maxPatience;
      } else {
        c.maxPatience = BALANCE.orders.waitForTable * c.patienceMult * this.patienceScale;
        c.patience = c.maxPatience;
        c.waiting = true;
        c.showWaitingTable();
        this.routeWaitingCustomerToSalon(c);
      }
      return;
    }
    this.startPickupRun(c);
  }

  /**
   * Müşterinin menüden sipariş oluşturması.
   *
   * Paket müşteriler TEK rafa gider, alır, çıkar (tek kalem).
   * Masada oturan (dineIn) müşteriler ise 2+ ürün açıkken %28 ihtimalle
   * 2 farklı kalemlik kombo sipariş (örn. çay + tost) verebilir — oyuncunun
   * karışık tepsi taşıma kapasitesi tam anlamıyla değer kazanır.
   *
   * Seçim STOKTAN yapılır: rafında ya da makinesinde ürün olan kalemler
   * havuzdur (boş dükkânda menüden ilk ürün — çıkmaz yok).
   */
  private buildOrder(c: Customer): Order | null {
    const menu = this.openMachines();
    if (menu.length === 0) return null;
    const ready = menu.filter((m) => m.output > 0 || this.pickupHas(m.def.item!));
    const arch = c.arch;
    const qty = this.state.tutorialStep < TUTORIAL_STEP_COUNT ? 1 : this.rng.int(arch.minQty, arch.maxQty);

    const pool = ready.length > 0 ? ready : menu;
    const sorted = pool.slice().sort((a, b) => this.itemValue(a.def.item!) - this.itemValue(b.def.item!));
    const bias = clamp01(arch.tasteBias + this.rng.range(-0.3, 0.3));
    const pickIdx = Math.round(bias * (sorted.length - 1));
    const pick = sorted[pickIdx] ?? menu[0];
    if (!pick?.def.item) return null;

    if (c.dineIn && this.state.tutorialStep >= TUTORIAL_STEP_COUNT && sorted.length >= 2 && this.rng.chance(0.28)) {
      const altIdx = (pickIdx + 1 + Math.floor(this.rng.next() * (sorted.length - 1))) % sorted.length;
      const second = sorted[altIdx];
      if (second?.def.item && second.def.item !== pick.def.item) {
        return new Order([
          { item: pick.def.item, qty: Math.min(2, qty), served: 0 },
          { item: second.def.item, qty: 1, served: 0 },
        ]);
      }
    }
    return new Order([{ item: pick.def.item, qty, served: 0 }]);
  }

  private pickupHas(item: ItemId): boolean {
    for (const p of this.pickups) if (!p.locked && p.hasItem(item)) return true;
    return false;
  }

  /** v5: ürünün KENDİ rafı. Raflar ürünle aynı bölgede açıldığı için
   *  menüdeki her ürünün açık bir rafı vardır; yedekler yalnız sigorta. */
  private shelfFor(item: ItemId): StationEntity | null {
    let fallback: StationEntity | null = null;
    for (const p of this.pickups) {
      if (p.locked) continue;
      if (p.def.item === item) return p;
      if (!fallback || p.hasItem(item)) fallback = p;
    }
    return fallback;
  }

  /** Sipariş verildi, para ödendi → müşteri ürününün rafına yürür. */
  private startPickupRun(c: Customer): void {
    c.dineIn = false;
    c.serviceCode = '';
    const want = c.order?.nextWanted();
    if (!want) {
      this.completeOrder(c, c.x, c.z);
      this.afterService(c);
      return;
    }
    const best = this.shelfFor(want);
    if (!best) {
      // Rafsız sipariş satış değildir. Para yazmadan müşteriyi çıkar.
      this.makeAngry(c, 'no_shelf');
      return;
    }
    c.targetDisplay = best;
    c.pickupApproachTimer = 0;
    c.state = 'toPickup';
    c.showItem(want, c.order?.remainingOf(want) ?? 1);
    c.showBubble(true);
    c.maxPatience = c.arch.patience * c.patienceMult * BALANCE.orders.takeawayPatienceMult * this.patienceScale;
    c.patience = c.maxPatience;
    best.frontPoint(_pt);
    c.moveTo(this.nav, _pt.x + c.lateral, _pt.z + Math.abs(c.lateral) * 0.15, true);
  }

  private routeToTable(c: Customer): void {
    if (c.table) return;
    const table = this.findFreeTable(c.x, c.z);
    if (!table) return;
    const seat = table.freeSeat;
    if (seat < 0) return;
    table.takeSeat(seat);
    c.table = table;
    c.seatIndex = seat;
    c.serviceCode = table.def.serviceCode ?? tr("MASA");
    const want = c.order?.nextWanted();
    if (want) c.showItem(want, c.order?.remainingOf(want) ?? 1);
    c.decisionTimer = 0.58;
    c.stop();
  }

  private routeWaitingCustomerToSalon(c: Customer): void {
    const unlockedTables = this.tables.filter((t) => !t.locked);
    if (unlockedTables.length === 0) return;

    const dirtyTables = unlockedTables.filter((t) => t.dishes > 0 || t.soil > 0.02);
    const pool = dirtyTables.length > 0 ? dirtyTables : unlockedTables;
    pool.sort((a, b) => dist(c.x, c.z, a.x, a.z) - dist(c.x, c.z, b.x, b.z));
    const target = pool[0];

    const angle = c.lateral * 1.5;
    const sampleX = target.x + Math.sin(angle) * 1.6;
    const sampleZ = target.z + Math.cos(angle) * 1.6;
    target.playerPoint(sampleX, sampleZ, _pt, 1.1);

    if (!this.nav.solidBlocked(_pt.x, _pt.z, 0.3)) {
      c.moveTo(this.nav, _pt.x, _pt.z, true);
    } else {
      c.moveTo(this.nav, target.x, target.z, true);
    }
  }

  private assignWaitingCustomersToTables(): void {
    let hasFreeSeat = false;
    for (let i = 0; i < this.tables.length; i++) {
      if (this.tables[i].canSeat) {
        hasFreeSeat = true;
        break;
      }
    }
    if (!hasFreeSeat) return;

    const waiting = this.customers
      .filter((c) => !c.done && c.state === 'toTable' && c.dineIn && !c.table)
      .sort((a, b) => b.tableWait - a.tableWait);

    for (const c of waiting) {
      this.routeToTable(c);
      if (c.table) {
        c.waiting = false;
        c.maxPatience = c.arch.patience * c.patienceMult * BALANCE.orders.seatedPatienceMult * this.patienceScale;
        c.patience = c.maxPatience;
        const want = c.order?.nextWanted();
        if (want) c.showItem(want, c.order?.remainingOf(want) ?? 1);
        c.showBubble(true);
      }
    }
  }

  private leaveTable(c: Customer): void {
    const t = c.table;
    this.standFromChair(c);
    if (t) {
      t.releaseSeat(c.seatIndex);
      const i = t.seatedGuests.indexOf(c);
      if (i >= 0) t.seatedGuests.splice(i, 1);
      t.dishes = Math.min(BALANCE.dirt.maxDishesPerTable, t.dishes + BALANCE.dirt.dishesPerGuest);
      t.soil = clamp01(t.soil + BALANCE.dirt.tableSoilPerUse);
      t.cleanStartSoil = t.soil;
      t.dirtyAge = 0;
      t.progress = 0;
      t.servedVisual = Math.max(0, t.servedVisual - 1);
      this.vfx?.puff(t.x, 1.1, t.z, 0x8a7f74, 3);
      if (this.rng.chance(BALANCE.dirt.spillOnLeaveChance * this.dirtScale)) {
        this.spills.spawn(
          t.x + this.rng.range(-1.6, 1.6),
          t.z + this.rng.range(-1.6, 1.6),
          this.rng.chance(0.45) ? 'crumbs' : 'liquid',
        );
      }
    }
    c.table = null;
    c.seatIndex = -1;
    c.finishMeal();
    this.afterService(c);
  }

  private standFromChair(c: Customer): void {
    if (c.state !== 'seated' || !c.table) return;
    if (this.seatApproach(c.table, c.seatIndex, _pt)) c.standUp(_pt.x, _pt.z);
    else c.standUp();
  }

  /** Siparişin fiyatını kilitler; henüz para veya satış yazmaz. */
  private quoteOrder(c: Customer): void {
    const order = c.order;
    if (!order) return;

    let mult =
      this.state.saleMultiplier * c.arch.payMult * this.eventValueMult * this.hygieneMult * this.sideValueMult;
    if (c.isInfluencer) mult *= BALANCE.events.influencerTipMult;

    const modeMult = c.dineIn ? BALANCE.orders.dineInPriceMult : BALANCE.orders.takeawayPriceMult;
    mult *= modeMult;

    let value = 0;
    // festivalValueMult: haftanın ürün festivali o ürünün gelirini ×1,35 yapar.
    for (const l of order.lines) value += this.itemValue(l.item) * festivalValueMult(l.item) * l.qty;
    const total = Math.max(1, Math.round(value * mult));
    c.paid = 0;
    c.quotedTotal = total;
    c.unitCharge = total / Math.max(1, order.totalQty);
    this.state.stats.orders++;
  }

  private cashierReady(counter: StationEntity): boolean {
    return this.staff.some((s) => s.role === 'cashier' && s.assigned === counter && s.atStation);
  }

  /** Queue is waiting and no cashier is at the register. From a distance, say
   *  that standing there is what takes the order — not a separate button. */
  private unattendedRegisterGuide(player: Player): GuideTarget | null {
    let best: StationEntity | null = null;
    let bestD = Infinity;
    for (const co of this.counters) {
      if (co.locked || (this.cashierReady(co) && !this.rushPlayerOnly)) continue;
      if (queueOf(co).length === 0) continue;
      const d = dist(player.x, player.z, co.x, co.z);
      if (d < bestD) {
        best = co;
        bestD = d;
      }
    }
    if (!best) return null;
    best.playerPoint(player.x, player.z, _pt, 0.4);
    if (dist(player.x, player.z, _pt.x, _pt.z) < 1.45) return null;
    return this.guideAt(best, tr("Kasada dur; sipariş orada alınır"), 0xffc84a);
  }

  /**
   * Para yalnız GERÇEKTEN teslim edilen ürün için kasaya düşer. Böylece
   * boş raf, kızgın müşteri veya yarım sipariş hiçbir zaman tam satış
   * yazamaz. Kasiyer olsa da nakdi oyuncu toplar.
   */
  private settleDeliveredItem(c: Customer, item: ItemId, x: number, z: number): void {
    const co = c.counter && !c.counter.locked ? c.counter : this.openCounters()[0];
    if (!co) return;
    const delivered = c.itemsReceived;
    const totalQty = c.order?.totalQty ?? delivered;
    const finalUnit = delivered >= totalQty;
    const amount = Math.max(
      1,
      finalUnit
        ? c.quotedTotal - c.paid
        : Math.floor(c.unitCharge || this.itemValue(item)),
    );
    c.paid += amount;
    co.cash++;
    co.cashValue += amount;
    this.revenueAcc += amount;
    this.state.addSale(item, 1);
    bus.emit('sale:done', { item, amount, x, z });
    this.vfx?.emote(co.x, 1.9, co.z, 'money');
  }

  /** Siparişin yolculuğu bitti: itibar ve hak edilmiş bahşiş burada işlenir. */
  private completeOrder(c: Customer, x: number, z: number): void {
    const order = c.order;
    if (!order) return;
    c.order = null;

    /** Masa/VIP bahşişi de kasaya düşer; cüzdana yalnız oyuncu toplar. */
    let tipFactor = 0;
    if (c.dineIn || c.table) tipFactor += BALANCE.orders.tableTipRate;
    if (c.table?.def.outdoor) tipFactor += BALANCE.orders.outdoorTipMult - 1;
    if (c.table?.def.vip) tipFactor += BALANCE.orders.vipTipMult - 1;
    const fast = order.completedAt >= 0 && order.completedAt < c.maxPatience * 0.55;
    if (fast) tipFactor += BALANCE.orders.fullServeTipRate;
    if (tipFactor > 0 && c.paid > 0 && order.servedQty > 0) {
      // tipBoost: "Bahşiş Yağmuru" reklam ödülü (süreli ×3).
      const tip = Math.max(1, Math.round(c.paid * tipFactor * this.tipBoost));
      const co = c.counter && !c.counter.locked ? c.counter : this.openCounters()[0];
      if (co) {
        co.cash++;
        co.cashValue += tip;
        this.revenueAcc += tip;
      }
      this.vfx?.coinBurst(x, 1.15, z, c.table?.def.vip ? 8 : 5);
      this.vfx?.emote(x, 1.9, z, 'money');
    }

    if (c.isInfluencer) {
      this.state.addReputation(BALANCE.events.influencerRepGain);
      bus.emit('influencer:served', { x, z });
      this.vfx?.ring(x, 0.2, z, 0xffc84a, 4);
      for (let i = 0; i < 6; i++) {
        this.vfx?.sparkle(x + this.rng.range(-1.5, 1.5), this.rng.range(0.6, 2.4), z + this.rng.range(-1.5, 1.5), 0xffd76a);
      }
    } else {
      this.state.addReputation(BALANCE.reputation.happyGain);
    }
    bus.emit('customer:happy', { x, z });
    this.vfx?.emote(x, c.char.height + 0.5, z, 'happy');
    c.celebrate();
    c.showCheck();
    c.order = null;
    if (c.paid > 0) this.tryFoundChange(x, z, c.char.height + 0.6);
  }

  /**
   * Rare tip or found change. Seeded from the day and order count, capped
   * at a few times per real day, and worth one cheap item up to one latte.
   */
  private tryFoundChange(x: number, z: number, y: number): void {
    if (this.state.tutorialStep < TUTORIAL_STEP_COUNT) return;
    const day = todayKey();
    if (this.state.changeDay !== day) {
      this.state.changeDay = day;
      this.state.changeCount = 0;
      this.state.changeAt = 0;
    }
    if (this.state.changeCount >= FOUND_CHANGE_DAILY_CAP) return;
    if (this.state.playTime - this.state.changeAt < FOUND_CHANGE_GAP) return;
    const orders = this.state.stats.orders;
    if (foundChangeRoll(day, orders, 'tip') >= FOUND_CHANGE_CHANCE) return;
    const amount = foundChangeAmount(this.cheapestMenuValue, foundChangeRoll(day, orders, 'amt'));
    this.state.changeCount += 1;
    this.state.changeAt = this.state.playTime;
    this.state.earn(amount, x, z, y);
    const text = tr("Bahşiş +₺{0}", formatCompactMoney(amount));
    bus.emit('toast', { text, glyph: '🪙', tone: 'good' });
    bus.emit('found:change', { amount });
  }

  /* ============================================================ *
   *  v5.1 — reklam ödülü yardımcıları (Game çağırır)
   * ============================================================ */

  /** Açık rafların toplam doluluk oranı 0..1 (rush_hour koşulu). */
  shelfFillRatio(): number {
    let have = 0;
    let cap = 0;
    for (const p of this.pickups) {
      if (p.locked) continue;
      have += p.output;
      cap += p.outputCap;
    }
    return cap > 0 ? have / cap : 0;
  }

  /** Tüm kasa sıralarındaki toplam müşteri (usta_mode koşulu). */
  queueTotal(): number {
    let n = 0;
    for (const co of this.counters) if (!co.locked) n += queueOf(co).length;
    return n;
  }

  /**
   * "Dönüş Satışı" (comeback_sale): makine + raf stoğunun `share` payını
   * anında satar, hasılatı hesaba yazar. Ödül reklamla açılır; bedava
   * offline para DEĞİLDİR — satılan şey oyuncunun kendi ürettiği stoktur.
   */
  sellStockShare(share: number, mult: number = 1): number {
    let total = 0;
    const sell = (st: StationEntity, count: number, item: ItemId | null) => {
      if (count <= 0 || !item) return;
      total += this.itemValue(item) * count;
    };
    for (const m of this.machines) {
      if (m.locked || !m.def.item || m.output <= 0) continue;
      const n = Math.floor(m.output * share);
      sell(m, n, m.def.item);
      m.output -= n;
    }
    for (const p of this.pickups) {
      if (p.locked || p.output <= 0) continue;
      let n = Math.floor(p.output * share);
      while (n-- > 0) {
        const it = p.takeOutput();
        if (!it) break;
        total += this.itemValue(it);
      }
    }
    if (total > 0) {
      const t = Math.round(total * this.state.saleMultiplier * this.hygieneMult * mult);
      this.revenueAcc += t;
      this.state.earn(t, this.loc.playerStart.x, this.loc.playerStart.z, 1.8);
      return t;
    }
    return 0;
  }

  /** Toplam stok birimi (comeback_sale eşiği için). */
  stockTotal(): number {
    let n = 0;
    for (const m of this.machines) if (!m.locked) n += m.output;
    for (const p of this.pickups) if (!p.locked) n += p.output;
    return n;
  }

  /**
   * v5.1 — YAN DAL bölge bonusları. Zincir dışı üç küçük bölge kalıcı,
   * mütevazı çarpanlar verir (MÜZİK KÖŞESİ sabır ×1,06 · VİTRİN IŞIKLARI
   * değer ×1,04 · SOKAK TABELASI akış ×1,05). syncLocks sonrası çağrılır.
   */
  private refreshSideBonuses(): void {
    const sahilMusic = this.zoneUnlocked('p6');
    this.sidePatienceMult = this.zoneUnlocked('z_muzik') || sahilMusic ? 1.06 : 1;
    this.sideValueMult = this.zoneUnlocked('z_vitrin') || sahilMusic ? 1.04 : 1;
    this.sideSpawnMult = this.zoneUnlocked('z_tabela') || sahilMusic ? 1.05 : 1;
  }

  private afterService(c: Customer): void {
    const wc = canVisitRestroom(c) ? this.freeToilet() : null;
    if (c.needsToilet && wc) {
      c.needsToilet = false;
      c.toilet = wc;
      wc.occupied = true;
      c.toiletTimer = wc.def.time;
      c.state = 'toToilet';
      c.waiting = false;
      c.showBubble(false);
      c.patience = Math.max(c.patience, 45);
      wc.frontPoint(_pt);
      c.moveTo(this.nav, _pt.x, _pt.z, true);
      return;
    }
    c.state = 'leave';
    c.showBubble(false);
    c.speed = clampCustomerWalkSpeed(c.arch.speed * 1.15);
    c.moveTo(this.nav, this.loc.door.x, this.loc.door.z, true);
  }

  private freeToilet(): StationEntity | null {
    for (const wc of this.toilets) if (wc.canUseToilet) return wc;
    return null;
  }

  private finishRestroomVisit(c: Customer, completed: boolean): void {
    const wc = c.toilet;
    if (wc) {
      wc.frontPoint(_pt);
      if (c.state === 'inToilet') c.standUp(_pt.x, _pt.z);
      wc.occupied = false;
      if (completed) {
        const fee = restroomUseFee(this.averageMenuValue, this.state.saleMultiplier, wc.soil, wc.toiletSupplied);
        wc.soil = clamp01(wc.soil + BALANCE.toilet.soilPerUse * this.dirtScale);
        const shortage = wc.consumeSupplies(BALANCE.toilet.supplyPerUse);
        if (!shortage && fee > 0) {
          this.revenueAcc += fee;
          this.state.earn(fee, wc.x, wc.z, 1.7);
        } else if (shortage) {
          this.state.addReputation(-BALANCE.toilet.emptySupplyRepLoss);
          bus.emit('supply:empty', { x: wc.x, z: wc.z });
        }
      }
    }
    c.toilet = null;
    c.state = 'leave'; c.waiting = false; c.showBubble(false);
    c.speed = clampCustomerWalkSpeed(c.arch.speed * 1.15);
    c.moveTo(this.nav, this.loc.door.x, this.loc.door.z, true);
  }

  private reindexQueue(co: StationEntity): void {
    const q = queueOf(co);
    for (let i = 0; i < q.length; i++) q[i].queueIndex = i;
  }

  private eventValueMult = 1;

  /* ============================================================ *
   *  Müşteriler
   * ============================================================ */

  private spawnCustomers(dt: number, mods: EventModifiers): void {
    // Keep the first complete service loop readable; normal demand starts afterwards.
    if (this.state.tutorialStep < TUTORIAL_STEP_COUNT && this.customers.some(c => !c.done)) return;
    if (this.customers.length >= this.maxCustomers) return;

    let menuCount = 0;
    let ready = 0;
    let totalStock = 0;
    for (let i = 0; i < this.machines.length; i++) {
      const m = this.machines[i];
      if (!m.locked && m.def.item && isProduct(m.def.item)) {
        menuCount++;
        if (m.output > 0) ready++;
        totalStock += m.output;
      }
    }
    if (menuCount === 0) return;

    let openCount = 0;
    let belowCapCount = 0;
    let hasRoomBelowCap = false;
    let hasRoomAny = false;
    for (let i = 0; i < this.counters.length; i++) {
      const co = this.counters[i];
      if (co.locked) continue;
      openCount++;
      const limit = Math.min(
        BALANCE.customers.maxQueue,
        checkoutQueueLimit(this.cashierReady(co) && !this.rushPlayerOnly),
      );
      const room = co.queue.length < limit;
      if (room) hasRoomAny = true;
      if (co.cash < BALANCE.money.counterCap) {
        belowCapCount++;
        if (room) hasRoomBelowCap = true;
      }
    }
    if (openCount === 0) return;
    // Masa doluluğu kapıyı kapatmaz: paket müşterisi oturma kapasitesinden
    // bağımsızdır. İçerideki toplam kalabalığı `maxCustomers` yönetir.
    /**
     * SIRA DOLUYSA MÜŞTERİ ÇAĞIRMA. Uzayan kuyruk oyuncunun elinden hiçbir
     * şeyin gelmediği bir ceza yığınıdır: hepsi sırayla küsüp itibarı yakar.
     * Kafe doluysa yeni müşteri kapıdan hiç girmez.
     */
    const hasQueueRoom = belowCapCount > 0 ? hasRoomBelowCap : hasRoomAny;
    if (!hasQueueRoom) return;
    /**
     * `maxPending` — SİPARİŞ/AKIŞ TAVANI, ASIL TAVAN DEĞİL.
     *
     * GERÇEK TAVAN MEKÂN KAPASİTESİDİR (`World.maxCustomers`, bkz.
     * `refreshCapacity`), BURASI DEĞİL. Ölçüm (`Quality.ts`):
     * mekândaki müşteri sayısı zamanın %55,9'unda KENDİ tavanına
     * yapışıktı, `maxPending` ise ölçülen pencerede HİÇ (%0) bağlayıcı
     * olmadı. Kafeye kimin gireceğine asıl karar mekân kapasitesi verir;
     * bu değer yalnız sipariş KUYRUĞUNUN ne kadar şişebileceğini sınırlar.
     *
     * YİNE DE SİLİNMEDİ: erken oyunda (masa/personel az, mekân kapasitesi
     * henüz küçük) `maxPending` hâlâ bağlayıcı olabiliyor. İki tavan
     * BİRLİKTE çalışır — geç oyunda biri (mekân) öne geçer, erken oyunda
     * öbürü de iş görür.
     *
     * TAVANI DOLDURAN KALDIRAÇLARIN TAM LİSTESİ:
     *  - MUTFAK: makine hız yükseltmeleri (kitchenSpeedFactor).
     *  - İKMAL/PERSONEL: tezgâhtar (makine → raf) ve barista (makine hızı)
     *    katkısı — v5.2'de düşürüldü (0,8→0,45 / 0,4→0,25): dört tezgâhtar
     *    + bir barista ile ölçüldüğünde (2026-08-15) oyuncunun boşta/kasada
     *    olması kapasiteyi HİÇ değiştirmiyordu (45,8 servis/dk sabit) —
     *    personel artık yalnız TABANI üretir.
     *  - OYUNCU YÜKSELTMELERİ (`playerBoost`): hız / el kapasitesi / el
     *    hızı. SATIN ALINMIŞ ve kalıcıdır — "oyuncu" burada geçmişte
     *    verilmiş bir karardır.
     *  - RAF SAYISI (`openShelves`): açık her raf akışa küçük bir pay ekler.
     *  - TEMPO (`tempoFlow`, aşağıda): OYUNCUNUN O ANKİ AKTİVİTESİ. Bir
     *    üstteki `playerBoost` ile AYNI KELİMEYİ ("oyuncu") taşır ama ters
     *    çalışır — satın alınmış değil, ANLIK; makine başında durmak, rafa
     *    ürün koymak, kasa toplamak gibi o saniyeki emekle dolar. Bu iki
     *    "oyuncu" terimini birbirine karıştırmak bu turun kendi hatasıydı
     *    (bkz. `BALANCE.tempo.handsOnCeiling`) — biri yükseltme, diğeri
     *    emek.
     *
     * Eski (v4) formül garson sayısına bağlıydı; v5'te garson yok, formül
     * kalsaydı tezgâhtar almak "hiçbir şey yapmayan para deliği" olurdu.
     */
    let servers = 1.2;
    for (const s of this.staff) {
      if (s.role === 'waiter') servers += 0.45;
      else if (s.role === 'barista') servers += 0.25;
    }
    let openShelves = 0;
    for (let i = 0; i < this.pickups.length; i++) {
      const p = this.pickups[i];
      if (!p.locked) {
        openShelves++;
        totalStock += p.output;
      }
    }
    const kitchen = this.kitchenSpeedFactor();
    const up = this.state.upgrades;
    const playerBoost = 1 + (up.speed ?? 0) * 0.045 + (up.capacity ?? 0) * 0.055 + (up.hands ?? 0) * 0.03;
    /**
     * Tempo YALNIZ YUKARI çalışır: tempo 0 iken çarpan tam 1'dir, yani
     * boştaki kafe cezalandırılmaz — sadece personel tabanında kalır.
     */
    const tempoFlow = 1 + this.tempo * BALANCE.tempo.flowGain;
    const maxPending = Math.ceil(
      (1 + servers) * kitchen * playerBoost * tempoFlow * (0.8 + openShelves * 0.2) * this.state.prestigeFlowMult,
    );
    if (this.pendingOrders >= maxPending) return;

    const c = BALANCE.customers;

    let interval = c.baseSpawnInterval * Math.pow(c.perItemFactor, Math.max(0, ready - 1));
    interval /= 1 + Math.min(c.stockPull, totalStock * 0.014);
    interval /= 1 + this.state.repRatio * c.repSpawnBoost;
    interval /= Math.max(0.2, mods.spawnMult);
    interval /= this.sideSpawnMult; // SOKAK TABELASI yan dalı (×1,05)
    // Ritim yükseldikçe kapı daha sık çalar (tempo 0 iken bölen tam 1).
    interval /= 1 + this.tempo * BALANCE.tempo.spawnGain;
    interval /= Math.max(0.5, this.hygieneMult);
    let pendingUnits = 0, oldestWait = 0;
    for (const guest of this.customers) {
      if (guest.done || !guest.dineIn || guest.eating || !guest.order || guest.orderComplete) continue;
      pendingUnits += Math.max(0,guest.order.totalQty-guest.order.servedQty);
      oldestWait = Math.max(oldestWait,1-guest.patience/Math.max(1,guest.maxPatience));
    }
    interval = Math.max(c.minSpawnInterval, interval) *
      arrivalPressure(pendingUnits,this.assistPlayer?.capacity ?? 3,oldestWait);

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = interval * this.rng.range(0.8, 1.2);
    this.spawnCustomer('normal');
  }

  spawnCustomer(kind: 'normal' | 'dasher' | 'influencer' | 'investor'): Customer | null {
    if (this.openMachines().length === 0) return null;

    const arch =
      kind === 'dasher'
        ? DASHER_ARCHETYPE
        : kind === 'influencer'
          ? INFLUENCER_ARCHETYPE
          : kind === 'investor'
            ? INVESTOR_ARCHETYPE
            : pickArchetype(this.rng.next());
    const c = new Customer(arch, `c${this.customerSeq++}`, kind);
    c.setPosition(this.loc.door.x + this.rng.range(-0.7, 0.7), this.loc.door.z + 0.6);
    c.angle = Math.PI;
    markDynamic(c.char.root);
    this.root.add(c.char.root);
    this.customers.push(c);

    if (kind === 'investor') {
      c.showInvestor();
      // Kafenin kapısından içeriye doğru yürür: açık tezgâhın veya ilk makinenin önüne yönelir
      const targetCounter = this.openCounters()[0] ?? this.openMachines()[0];
      if (targetCounter) {
        targetCounter.frontPoint(_pt);
        c.moveTo(this.nav, _pt.x + this.rng.range(-0.4, 0.4), _pt.z + 1.2, false);
      } else {
        c.moveTo(this.nav, this.loc.door.x, this.loc.door.z + 4, false);
      }
      return c;
    }

    if (kind === 'dasher') {
      const targets = this.openPickups().filter((p) => p.output > 0);
      const target = targets.length > 0 ? targets[0] : this.openPickups()[0];
      if (!target) {
        c.done = true;
        return c;
      }
      c.state = 'grab';
      c.targetDisplay = target;
      target.frontPoint(_pt);
      c.moveTo(this.nav, _pt.x + c.lateral * 0.4, _pt.z, true);
      c.grabTimer = BALANCE.events.dasherGrabInterval;
      return c;
    }

    c.needsToilet = this.toiletOpen && this.rng.chance(BALANCE.toilet.useChance);
    this.sendToCounter(c);
    return c;
  }

  private sendToCounter(c: Customer): void {
    const all = this.openCounters();
    if (all.length === 0) {
      this.makeAngry(c, 'no_counter', false);
      return;
    }
    const working = all.filter((r) => r.cash < BALANCE.money.counterCap);
    const candidates = working.length > 0 ? working : all;
    const withRoom = candidates.filter(co => co.queue.length < Math.min(BALANCE.customers.maxQueue,
      checkoutQueueLimit(this.cashierReady(co) && !this.rushPlayerOnly)));
    const usable = withRoom.length > 0 ? withRoom : candidates;

    let best = usable[0];
    let bestLen = queueOf(best).length;
    for (const r of usable) {
      const len = queueOf(r).length;
      if (len < bestLen || (len === bestLen && c.distanceTo(r.x, r.z) < c.distanceTo(best.x, best.z))) {
        best = r;
        bestLen = len;
      }
    }
    c.counter = best;
    const q = queueOf(best);
    q.push(c);
    c.queueIndex = q.length - 1;
    c.state = 'toCounter';
    c.counterApproachTimer = 0;
    /**
     * v5 — kapıdan giren müşteri BALONSUZ yürür. Sipariş daha kasada
     * oluşmadığı için eski "fiş" balonu hiçbir bilgi taşımıyordu
     * ("üzerinde kâğıt gibi bir şey var, ne alaka"). Balon ilk kez
     * sipariş verilince, ürün ikonuyla açılır (placeOrder).
     */
    c.showBubble(false);
    best.queueSlot(c.queueIndex, _pt);
    c.moveTo(this.nav, _pt.x, _pt.z, true);
  }

  private makeAngry(c: Customer, reason: CustomerAngerReason, penalty = true): void {
    if (c.state === 'angry' || c.state === 'leave') return;
    const unresolved = c.order?.nextWanted() ?? null;
    const remaining = unresolved ? c.order?.remainingOf(unresolved) ?? 1 : 1;
    this.releaseCustomerHolds(c);
    c.state = 'angry';
    c.complaintTimer = 1.25;
    c.stop();
    c.waiting = false;
    if (reason === 'dirty_table') c.showAngry();
    else if (unresolved) c.showItem(unresolved, remaining);
    else c.showAngry();
    c.showBubble(true);
    c.speed = clampCustomerWalkSpeed(c.arch.speed * 1.35);
    if (c.counter) {
      const q = queueOf(c.counter);
      const i = q.indexOf(c);
      if (i >= 0) q.splice(i, 1);
      this.reindexQueue(c.counter);
      c.counter = null;
    }
    if (penalty) {
      this.state.stats.angry++;
      this.state.addReputation(-BALANCE.reputation.angryLoss);
      if (c.isInfluencer) {
        this.state.addReputation(-BALANCE.events.influencerRepLoss);
        bus.emit('influencer:lost', { x: c.x, z: c.z });
      }
      bus.emit('customer:angry', { x: c.x, z: c.z, reason });
      this.vfx?.emote(c.x, c.char.height + 0.5, c.z, 'angry');
      sfx('customer_angry', 0.5);
    }
    c.order = null;
  }

  private releaseCustomerHolds(c: Customer): void {
    /**
     * SIRADAN DA ÇIKAR. Bu satır olmadan, kuyrukta beklerken sahneden silinen
     * bir müşteri dizide hayalet bir kayıt bırakıyordu; kuyruğun başı ölü bir
     * nesne olduğu için tezgâh bir daha hiç sipariş almıyor ve arkadaki
     * herkes sırayla küsüyordu. (Soak testinde 33 kişilik hayalet kuyruk.)
     */
    if (c.counter) {
      const q = queueOf(c.counter);
      const i = q.indexOf(c);
      if (i >= 0) {
        q.splice(i, 1);
        this.reindexQueue(c.counter);
      }
      c.counter = null;
    }
    if (c.table) {
      this.standFromChair(c);
      c.table.releaseSeat(c.seatIndex);
      const i = c.table.seatedGuests.indexOf(c);
      if (i >= 0) c.table.seatedGuests.splice(i, 1);
      c.table = null;
      c.seatIndex = -1;
    }
    if (c.toilet) {
      if (c.state === 'inToilet') {
        c.toilet.frontPoint(_pt);
        c.standUp(_pt.x, _pt.z);
      }
      c.toilet.occupied = false;
      c.toilet = null;
    }
  }

  private updateCustomers(dt: number, player: Player | null): void {
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      if (c.order) c.order.age += dt;
      this.updateCustomer(c, dt, player);
      if (
        c.waiting &&
        c.state !== 'angry' &&
        c.state !== 'leave' &&
        c.patience > 0 &&
        c.patience / Math.max(0.01, c.maxPatience) < 0.28 &&
        c.lastWarningState !== c.state
      ) {
        c.lastWarningState = c.state;
        const text = c.state === 'pickup'
          ? tr("RAF BOŞ!")
          : c.state === 'seated'
            ? tr("SERVİS GECİKİYOR!")
            : c.state === 'queue' || c.state === 'order'
              ? tr("KASA BEKLİYOR!")
              : tr("MÜŞTERİ BEKLİYOR!");
        bus.emit('customer:impatient', { x: c.x, z: c.z, text });
      }
      // EKRAN DIŞI KARAKTER: animasyon atlanır, yalnızca konum işlenir.
      // Her karakterin animatörü ~131 trigonometrik işlem + ~64 matris
      // güncellemesi yapıyor; kadraj dışındaki 20 müşteri için bu tamamen
      // israf. Konum yine işlenir, yani sim davranışı hiç değişmez.
      const animate = this.isNearCamera(c.x, c.z);
      c.step(dt, this.nav, animate);
      this.syncActorRender(c.char.root,animate);
      if (c.done) {
        this.releaseCustomerHolds(c);
        c.dispose();
        this.customers.splice(i, 1);
      }
    }
  }

  private updateCustomer(c: Customer, dt: number, player: Player | null): void {
    switch (c.state) {
      case 'toCounter': {
        c.waiting = false;
        const co = c.counter;
        if (!co || co.locked) {
          this.makeAngry(c, 'counter_closed');
          break;
        }
        co.queueSlot(c.queueIndex, _pt);
        const approach = advanceApproachArrival(c.counterApproachTimer, dt, {
          arrived: c.arrived,
          onApproachSide: co.sideOf(c.x, c.z) > 0,
          distanceToTarget: c.distanceToTarget,
          distanceToPoint: dist(c.x, c.z, _pt.x, _pt.z),
          targetRadius: 1.05,
          pointRadius: 1.35,
        });
        c.counterApproachTimer = approach.timer;
        if (approach.ready) {
          c.stop();
          c.counterApproachTimer = 0;
          c.state = 'queue';
        }
        break;
      }

      case 'queue': {
        const co = c.counter;
        if (!co || co.locked) {
          this.makeAngry(c, 'counter_closed');
          break;
        }
        c.waiting = true;
        c.patience -= dt * 0.45;
        if (c.patience <= 0) {
          this.makeAngry(c, 'counter_queue');
          break;
        }
        co.queueSlot(c.queueIndex, _pt);
        if (c.distanceTo(_pt.x, _pt.z) > 0.7) c.moveTo(this.nav, _pt.x, _pt.z);
        c.faceTowards(co.x, co.z, dt, 5);
        if (c.queueIndex === 0 && c.distanceTo(_pt.x, _pt.z) < 0.9) {
          c.state = 'order';
          c.maxPatience = c.arch.patience * c.patienceMult * this.patienceScale;
          c.patience = c.maxPatience;
        }
        break;
      }

      case 'order': {
        const co = c.counter;
        if (!co || co.locked) {
          this.makeAngry(c, 'counter_closed');
          break;
        }
        c.waiting = true;
        c.patience -= dt * 0.3;
        if (c.patience <= 0) this.makeAngry(c, 'counter_service');
        else c.faceTowards(co.x, co.z, dt, 6);
        break;
      }

      case 'toTable': {
        // Salon müşterisi ürünü değil masa rezervasyonunu taşır; oyuncunun
        // doğru ürünü masaya getirmesini bekleyecektir.
        c.waiting = !c.table;
        if (!c.table) {
          c.patience -= dt;
          c.tableWait += dt;
          if (c.patience <= 0) {
            this.makeAngry(c, 'dirty_table');
            break;
          }
          this.assignWaitingCustomersToTables();
          if (c.table) break;

          if (c.arrived) {
            let nearestDirty: StationEntity | null = null;
            let bestDist = Infinity;
            for (let i = 0; i < this.tables.length; i++) {
              const t = this.tables[i];
              if (t.locked || (t.dishes <= 0 && t.soil <= 0.02)) continue;
              const d = dist(c.x, c.z, t.x, t.z);
              if (d < bestDist) {
                bestDist = d;
                nearestDirty = t;
              }
            }
            if (nearestDirty) {
              c.faceTowards(nearestDirty.x, nearestDirty.z, dt, 4);
            }
          }
          break;
        }
        if (c.decisionTimer > 0) {
          c.decisionTimer = Math.max(0, c.decisionTimer - dt);
          const look = Math.sin(c.decisionTimer * 14) * 0.8;
          c.faceTowards(c.x + look, c.z + 1, dt, 7);
          if (c.decisionTimer <= 0) {
            if (this.seatApproach(c.table, c.seatIndex, _pt)) c.moveTo(this.nav, _pt.x, _pt.z, true);
          }
          break;
        }
        if (!this.seatApproach(c.table, c.seatIndex, _pt)) break;
        this.seatPoint(c.table, c.seatIndex, _seat);
        const chairSolid = this.chairSolids.get(c.table.id + '/' + c.seatIndex)!;
        // Enter only the assigned chair, from its reachable side. Never sit
        // through a table, another chair, or a wall because a timer expired.
        if (dist(c.x, c.z, _pt.x, _pt.z) > .45 ||
            !this.nav.bodyLineClear(c.x, c.z, _seat.x, _seat.z, .3, chairSolid)) {
          if (c.arrived) c.moveTo(this.nav, _pt.x, _pt.z, true);
          break;
        }
        // Rezervasyon sırasında başka bir misafir kalkıp masayı kirletmiş
        // olabilir. Kirli masaya oturmak yerine koltuğu bırakıp temiz bir
        // masa arar; böylece müşteri-temizlik çakışması oluşmaz.
        if (c.table.dishes > 0 || c.table.soil > 0.02) {
          c.table.releaseSeat(c.seatIndex);
          c.table = null;
          c.seatIndex = -1;
          this.routeToTable(c);
          if (!c.table) {
            c.waiting = true;
            c.maxPatience = BALANCE.orders.waitForTable * c.patienceMult * this.patienceScale;
            c.patience = Math.min(c.patience, c.maxPatience);
            c.showWaitingTable();
            this.routeWaitingCustomerToSalon(c);
          }
          break;
        }
        this.sitOnChair(c, c.table);
        c.table.seatedGuests.push(c);
        c.state = 'seated';
        c.eating = false;
        c.maxPatience = c.arch.patience * c.patienceMult * BALANCE.orders.seatedPatienceMult * this.patienceScale;
        c.patience = c.maxPatience;
        const want = c.order?.nextWanted();
        if (want) c.showItem(want, c.order?.remainingOf(want) ?? 1);
        break;
      }

      case 'seated': {
        const t = c.table;
        if (!c.eating) {
          c.waiting = true;
          c.patience -= dt;
          const want = c.order?.nextWanted();
          if (want) c.showItem(want, c.order?.remainingOf(want) ?? 1);
          if (c.orderComplete) {
            this.startEating(c);
            break;
          }
          if (c.patience <= 0) {
            this.makeAngry(c, 'table_service');
          }
          break;
        }
        c.waiting = false;
        c.eatTimer -= dt;
        if (t && !t.isDirty) t.progress = clamp01(1 - c.eatTimer / Math.max(0.01, c.eatTotal));
        if (c.eatTimer <= 0) {
          this.completeOrder(c, c.x, c.z);
          this.leaveTable(c);
        }
        break;
      }

      case 'toPickup': {
        c.waiting = false;
        const raf = c.targetDisplay;
        if (!raf) {
          this.makeAngry(c, 'no_shelf');
          break;
        }
        raf.frontPoint(_pt);
        const arrival = advancePickupArrival(c.pickupApproachTimer, dt, {
          arrived: c.arrived,
          onFront: raf.sideOf(c.x, c.z) > 0,
          distanceToTarget: c.distanceToTarget,
          distanceToFront: dist(c.x, c.z, _pt.x, _pt.z),
        });
        c.pickupApproachTimer = arrival.timer;
        if (arrival.ready) {
          c.stop();
          c.state = 'pickup';
          c.takeTimer = 0.2;
          c.pickupApproachTimer = 0;
          c.faceTowards(raf.x, raf.z, dt, 10);
        }
        break;
      }

      case 'pickup': {
        const raf = c.targetDisplay;
        const want = c.order?.nextWanted();
        if (!raf || !want) {
          this.completeOrder(c, c.x, c.z);
          this.afterService(c);
          break;
        }
        c.faceTowards(raf.x, raf.z, dt);
        if (raf.hasItem(want)) {
          c.waiting = false;
          c.takeTimer -= dt;
          if (c.takeTimer <= 0 && raf.takeItem(want) && c.receiveItem(want)) {
            c.takeTimer = 0.35;
            this.settleDeliveredItem(c, want, raf.x, raf.z);
            /**
             * v5 — SATIŞ SAYACI BURADA ATAR. `stats.served` eskiden masaya
             * servis anında artıyordu; self-serviste "servis" müşterinin
             * rafından aldığı birimdir. Hedef zinciri, sonsuz hedefler ve
             * günlük görevler bu sayacı okumaya devam eder.
             */
            this.state.stats.served++;
            this.state.addReputation(BALANCE.orders.servedRepGain);
            bus.emit('item:served', { item: want, x: raf.x, z: raf.z });
            this.pickupVisuals.get(raf.id)?.pop();
            this.vfx?.puff(raf.x, 1.2, raf.z + 0.8, ITEMS[want].color, 3);
            sfx('pickup', 0.34);
            const left = c.order?.remainingOf(want) ?? 0;
            if (left > 0) c.showItem(want, left);
          }
          if (c.orderComplete) {
            /**
             * Ürün elde — masa kararı ŞİMDİ verilir. Boş masa varsa ve
             * canı istiyorsa oturup yer (masa bahşişi + bulaşık döngüsü);
             * yoksa ürünüyle memnun çıkar. Kızgınlık yolu yok.
             */
            if (c.dineIn) {
              c.state = 'toTable';
              c.tableWait = 0;
              this.routeToTable(c);
              if (c.table) {
                c.showCheck();
              } else {
                c.waiting = true;
                c.maxPatience = BALANCE.orders.waitForTable * c.patienceMult * this.patienceScale;
                c.patience = c.maxPatience;
                c.showWaitingTable();
                this.routeWaitingCustomerToSalon(c);
              }
            } else {
              this.completeOrder(c, c.x, c.z);
              this.afterService(c);
            }
          }
        } else {
          c.waiting = true;
          c.patience -= dt;
          if (c.patience <= 0) {
            if (c.itemsReceived > 0) {
              // Teslim edilen birimler ücretlidir; fakat eksik sipariş
              // mutlu tamamlanmış sayılmaz ve müşteri hizmete tepki verir.
              this.makeAngry(c, 'partial_order');
            } else {
              this.makeAngry(c, 'pickup_stock');
            }
          }
        }
        break;
      }

      case 'toToilet': {
        const wc = c.toilet;
        if (!wc || wc.locked || !canVisitRestroom(c)) {
          this.finishRestroomVisit(c, false);
          break;
        }
        c.waiting = true;
        c.patience -= dt * 0.25;
        /**
         * ÇIKIŞ SİGORTASI. Bu, zaman aşımı OLMAYAN tek bekleme durumuydu:
         * yol tıkanır da müşteri tuvalete hiç varamazsa `wc.occupied`
         * sonsuza dek true kalıyor, o tuvalet komiye ve diğer müşterilere
         * ebediyen kapanıyordu. Sabır biterse tuvalet bırakılır ve çıkışa
         * yürünür (diğer tüm durumlarla aynı kural).
         */
        if (c.patience <= 0) {
          this.finishRestroomVisit(c, false);
          break;
        }
        wc.frontPoint(_pt);
        if (c.standingUp || dist(c.x, c.z, _pt.x, _pt.z) > .24) {
          if (c.arrived) c.moveTo(this.nav, _pt.x, _pt.z, true);
          break;
        }
        wc.toiletSeatPoint(_seat);
        const bowl = this.toiletSeatSolids.get(wc.id);
        if (bowl === undefined || !this.nav.bodyLineClear(c.x, c.z, _seat.x, _seat.z, .3, bowl)) break;
        const a = wc.def.rot * Math.PI / 180;
        c.sitAt(_seat.x, floorLiftAt(this.loc, wc.x, wc.z) + _seat.y - .66, _seat.z,
          _seat.x + Math.sin(a), _seat.z + Math.cos(a));
        c.state = 'inToilet';
        c.waiting = false;
        c.showBubble(false);
        break;
      }

      case 'inToilet': {
        if (!c.toilet || c.toilet.locked || !canVisitRestroom(c)) {
          this.finishRestroomVisit(c, false);
          break;
        }
        c.toiletTimer -= dt;
        if (c.toiletTimer <= 0) {
          this.finishRestroomVisit(c, true);
        }
        break;
      }

      case 'angry': {
        c.waiting = false;
        c.complaintTimer -= dt;
        c.showBubble(true);
        if (c.complaintTimer > 0) break;
        c.state = 'leave';
        c.showBubble(false);
        c.moveTo(this.nav, this.loc.door.x, this.loc.door.z, true);
        break;
      }

      case 'leave': {
        c.waiting = false;
        c.showBubble(false);
        if (c.arrived || c.distanceTo(this.loc.door.x, this.loc.door.z) < BALANCE.customers.despawnDist) {
          c.done = true;
          break;
        }
        /**
         * ÇIKIŞ SİGORTASI.
         *
         * Çıkışa yönelen müşteri kapıya varamazsa `done` hiç true olmaz ve
         * nüfus tavanında SONSUZA KADAR yer tutar. Gerçekten yaşandı: kapının
         * önüne konan bir dekor yüzünden 16 müşterinin tamamı (1, 8)
         * noktasında yığıldı, yeni müşteri giremedi ve kafenin geliri sessizce
         * sıfırlandı — ekranda hiçbir hata yoktu.
         *
         * Yerleşim doğrulaması artık bu tıkanmayı yakalıyor (KAPI TIKALI) ama
         * simülasyonun kendisi de kendini kurtarabilmeli: 25 saniye içinde
         * çıkamayan müşteri sahneden silinir. Bu bir ceza değil, kilit kırıcı.
         */
        c.exitTimer = (c.exitTimer ?? 0) + dt;
        if (c.exitTimer > 25) c.done = true;
        break;
      }

      case 'grab': {
        const banko = c.targetDisplay;
        if (!banko) {
          c.state = 'flee';
          c.moveTo(this.nav, this.loc.door.x, this.loc.door.z, true);
          break;
        }
        c.faceTowards(banko.x, banko.z, dt);
        banko.frontPoint(_pt);
        const approach = advanceApproachArrival(c.grabApproachTimer, dt, {
          arrived: c.arrived,
          onApproachSide: banko.sideOf(c.x, c.z) > 0,
          distanceToTarget: c.distanceToTarget,
          distanceToPoint: dist(c.x, c.z, _pt.x, _pt.z),
          targetRadius: 1.15,
          pointRadius: 1.65,
        });
        c.grabApproachTimer = approach.timer;
        if (!approach.ready) break;
        c.stop();
        c.grabApproachTimer = 0;
        c.grabTimer -= dt;
        if (c.grabTimer <= 0) {
          c.grabTimer = BALANCE.events.dasherGrabInterval;
          if (banko.output > 0) {
            banko.takeOutput();
            c.stolen++;
            this.pickupVisuals.get(banko.id)?.pop();
            this.vfx?.puff(banko.x, 1.2, banko.z + 0.8, 0x333333, 4);
            sfx('thief', 0.4);
            this.state.addReputation(-BALANCE.reputation.theftLoss);
          }
          if (c.stolen >= 3 || banko.output <= 0) {
            c.state = 'flee';
            // İlk seviyedeki oyuncu da kaçak müşteriyi gerçekten yakalayabilmeli.
            c.speed = clampCustomerWalkSpeed(
              Math.min(c.arch.speed * 1.45, player ? player.speed * 0.9 : c.arch.speed * 1.15),
            );
            c.moveTo(this.nav, this.loc.door.x, this.loc.door.z, true);
          }
        }
        break;
      }

      case 'flee': {
        c.exitTimer += dt;
        if (c.arrived || c.distanceTo(this.loc.door.x, this.loc.door.z) < BALANCE.customers.despawnDist || c.exitTimer > 25) {
          c.done = true;
          if (!c.caught) {
            this.state.addReputation(-BALANCE.events.dasherEscapeRepLoss);
            bus.emit('dasher:escaped', {});
          }
        }
        break;
      }

      default:
        break;
    }
  }

  private startEating(c: Customer): void {
    const t = c.table;
    c.eating = true;
    c.waiting = false;
    c.showCheck();
    c.placeCarriedItemsOnTable();
    if (t) t.servedVisual = Math.min(6, t.servedVisual + 1);
    const base = (t?.def.time ?? 11) * (c.order?.dwell ?? 1) * c.arch.dwellMult;
    c.eatTotal = base * this.rng.range(1 - BALANCE.orders.eatTimeJitter, 1 + BALANCE.orders.eatTimeJitter);
    c.eatTimer = c.eatTotal;
    this.vfx?.emote(c.x, c.char.height + 0.4, c.z, 'happy');
  }

  tryCatchDasher(player: Player): boolean {
    for (const c of this.customers) {
      if (!c.isDasher || c.caught || c.done) continue;
      if (dist(player.x, player.z, c.x, c.z) > BALANCE.player.catchRadius) continue;
      c.caught = true;
      c.done = true;
      this.state.stats.dashers++;
      // Ödül ömür boyu kazancın %1,5'iydi ve TAVANSIZDI: ₺2 milyar kazanmış
      // bir oyuncuda tek yakalama ₺30 milyon ediyor, 220-340 saniyede bir
      // tekrarlıyordu. Artık menü değerine bağlı bir tavan var — ödül
      // oyunun geri kalanıyla aynı ölçekte kalıyor.
      const cap = this.averageMenuValue * 40 * this.state.saleMultiplier;
      const reward = Math.max(200, Math.min(Math.round(this.state.revenueEarned * 0.015), Math.round(cap)));
      this.state.grant(reward, c.x, c.z, 1.4);
      this.bumpTempo(BALANCE.tempo.gain.dasher);
      this.state.addReputation(4);
      this.vfx?.coinBurst(c.x, 1.5, c.z, 8);
      this.vfx?.ring(c.x, 0.2, c.z, 0xffc84a, 3);
      bus.emit('dasher:caught', { reward, x: c.x, z: c.z });
      sfx('catch');
      return true;
    }
    return false;
  }

  hasDasher(): boolean {
    return this.customers.some((c) => c.isDasher && !c.done);
  }

  checkInvestorInteraction(player: Player): Customer | null {
    for (const c of this.customers) {
      if (!c.isInvestor || c.done || c.state === 'leave') continue;
      const d = dist(player.x, player.z, c.x, c.z);
      if (d <= (BALANCE.events.investorInteractRadius ?? 2.2)) {
        c.stop();
        c.angle = Math.atan2(player.x - c.x, player.z - c.z);
        c.char.root.rotation.y = c.angle;
        return c;
      }
    }
    return null;
  }

  hasInvestor(): boolean {
    return this.customers.some((c) => c.isInvestor && !c.done && c.state !== 'leave');
  }

  dismissInvestor(rewarded = false): void {
    for (const c of this.customers) {
      if (c.isInvestor && !c.done && c.state !== 'leave') {
        if (rewarded) {
          c.waveAndLeave(this.loc.door.x, this.loc.door.z + 2, this.nav);
        } else {
          c.state = 'leave';
          c.moveTo(this.nav, this.loc.door.x, this.loc.door.z + 2, false);
        }
      }
    }
  }

  /* ============================================================ *
   *  Dekorasyon (bkz. data/cosmetics.ts)
   * ============================================================ */

  /**
   * Seçili görünümleri mekâna uygular. Panel AÇIKKEN çağrılır: oyuncu bir
   * renge dokunduğu an kafe değişir — sistemin bütün değeri o anda.
   *
   * Üç eksen bedavaya yakın (malzeme rengi / doku haritası; mesh eklenmez,
   * çizim çağrısı değişmez). Dördüncüsü (üniforma) rig'i yeniden kurmayı
   * gerektirir — o yüzden yalnız DEĞİŞTİĞİNDE yapılır, her çağrıda değil.
   */
  applyCosmetics(selection = this.state.cosmetics): void {
    if (!this.draw3d) return;
    const c = selection;
    this.env?.setCosmetics(wallSkin(c.wall), floorSkin(c.floor));
    setTableSkin(tableSkin(c.table));
    if (this.appliedUniform !== c.uniform) {
      this.appliedUniform = c.uniform;
      this.rebuildStaffCharacters();
    }
  }

  /** Personel rig'lerinin hâlihazırda taşıdığı üniforma kimliği. */
  private appliedUniform = '';

  /* ============================================================ *
   *  Personel
   * ============================================================ */

  syncStaff(): void {
    const localCount = this.state.staffCountAt(this.loc.id);
    const localLevel = this.state.staffLevelAt(this.loc.id);
    const want: { role: StaffRole; count: number }[] = [
      { role: 'waiter', count: localCount.waiter },
      { role: 'cashier', count: localCount.cashier },
      { role: 'busser', count: localCount.busser },
      { role: 'barista', count: localCount.barista },
    ];

    for (const { role, count } of want) {
      const have = this.staff.filter((s) => s.role === role);
      for (let i = have.length; i < count; i++) {
        const s = new Staff(role, i, localLevel[role], this.appliedUniform || this.state.cosmetics.uniform);
        s.setPosition(this.loc.staffRest.x + (i % 3) * 1.2, this.loc.staffRest.z - Math.floor(i / 3) * 1.2);
        markDynamic(s.char.root);
        this.root.add(s.char.root);
        this.staff.push(s);
      }
      for (let i = have.length - 1; i >= count; i--) {
        const s = have[i];
        s.clearJob();
        s.dispose();
        const idx = this.staff.indexOf(s);
        if (idx >= 0) this.staff.splice(idx, 1);
      }
      for (const s of this.staff) {
        if (s.role === role && s.level !== localLevel[role]) s.setLevel(localLevel[role]);
      }
    }
    this.assignFixedRoles();
  }

  rebuildStaffCharacters(): void {
    /**
     * KONUM KORUNUR. Kalite kademesi tam cihaz zorlanırken değişir; tüm
     * personeli dinlenme köşesinde yeniden doğurmak, yoğun saatte "bütün
     * garsonlar buharlaşıp köşede belirdi" olarak görünüyordu. Rig yeniden
     * kurulur (LOD bunu gerektirir) ama herkes durduğu yerde, baktığı
     * yönde kalır; görev zaten bir sonraki karede yeniden atanır.
     */
    const keep = this.staff.map((s) => ({ role: s.role, x: s.x, z: s.z, angle: s.angle,
      item: s.carryItem, count: s.carryCount, job: s.job, source: s.source, dest: s.dest,
      fetchItem: s.fetchItem, handTimer: s.handTimer }));
    for (const s of this.staff) {
      s.clearJob();
      s.dispose();
    }
    this.staff.length = 0;
    this.syncStaff();
    for (const s of this.staff) {
      const i = keep.findIndex((k) => k.role === s.role);
      if (i < 0) continue;
      const k = keep.splice(i, 1)[0];
      s.setPosition(k.x, k.z);
      s.angle = k.angle;
      if (k.item) for (let n = 0; n < k.count; n++) s.give(k.item);
      s.job = k.job; s.source = k.source; s.dest = k.dest;
      s.fetchItem = k.fetchItem; s.handTimer = k.handTimer;
      s.source?.reserve(s.uid); s.dest?.reserve(s.uid);
    }
  }

  private assignFixedRoles(): void {
    for (const co of this.counters) co.hasCashier = false;
    for (const m of this.machines) m.baristaBoost = 1;

    const cos = this.openCounters();
    let ri = 0;
    for (const s of this.staff) {
      if (s.role !== 'cashier') continue;
      s.assigned = cos[ri] ?? null;
      if (s.assigned) {
        s.assigned.hasCashier = true;
        ri = (ri + 1) % Math.max(1, cos.length);
      }
    }

    // Tezgâhtarlar tek bir ürüne kilitlenmez; açık olan tüm üretim makinelerini ve rafları dinamik paylaşırlar.
    for (const s of this.staff) if (s.role === 'waiter') s.assigned = null;

    // Baristalar en değerli makinelere atanır.
    const procs = this.openMachines().sort((a, b) => this.itemValue(b.def.item!) - this.itemValue(a.def.item!));
    let ci = 0;
    for (const s of this.staff) {
      if (s.role !== 'barista') continue;
      s.assigned = procs[ci] ?? null;
      ci++;
    }
  }

  /**
   * TAKILMA BEKÇİSİ — bütün roller ve bütün işler için tek güvenlik ağı.
   *
   * Yerleşim doğrulaması geometriyi kanıtlar ama her kilitlenmeyi göremez:
   * personeli müşteriler kutuya alabilir, navigasyon ızgarasının 0,5
   * çözünürlüğü gerçek geçidi yanlış okuyabilir. Soak testlerinde bunların
   * hepsi görüldü — 600, 349, 1174 ve 166 saniyelik takılmalar.
   *
   * `Staff.stallTimer` zaten "işi var, istasyonda değil, kıpırdamıyor"
   * durumunu ölçüyor ve 1,5 saniyeden sonra uzanma mesafesini açıyordu.
   * Burada aynı sayaç ikinci bir eşikle kullanılır: 15 saniye sonra iş
   * tamamen bırakılır ve personel dinlenmeye gider. Dinlenme noktası her
   * zaman erişilebilir olduğundan bu, sebebi ne olursa olsun kilidi kırar.
   */
  /** Bounded local diagnostics; contains no player data and performs no network write. */
  readonly staffRecovery = { count: 0, last: [] as Array<{
    time: number; role: StaffRole; index: number; reason: 'reposition' | 'reassign';
    from: { x: number; z: number }; to: { x: number; z: number };
  }> };

  private recordStaffRecovery(s: Staff, reason: 'reposition' | 'reassign', x: number, z: number): void {
    this.staffRecovery.count++;
    this.staffRecovery.last.push({ time: this.state.playTime, role: s.role, index: s.index, reason,
      from: { x: s.x, z: s.z }, to: { x, z } });
    if (this.staffRecovery.last.length > 16) this.staffRecovery.last.shift();
  }

  private watchdogStaff(s: Staff): void {
    if (s.stallTimer > 6 && s.job === 'station' && s.assigned && !s.assigned.locked) {
      // Sabit görevli için aynı bozuk yolu tekrar tekrar seçmek çözüm
      // değildir. Nadir güvenlik anında erişilebilir çalışma noktasına al.
      s.assigned.servicePoint(_pt);
      this.recordStaffRecovery(s, 'reposition', _pt.x, _pt.z);
      s.setPosition(_pt.x, _pt.z);
      s.atStation = true;
      s.stallTimer = 0;
      return;
    }
    if (s.stallTimer > 8) {
      this.recordStaffRecovery(s, 'reassign', this.loc.staffRest.x, this.loc.staffRest.z);
      s.stallTimer = 0;
      this.goRest(s);
    }
  }

  /** The teammate may take spare stock, but the next player pickup stays available. */
  private playerStockFloor(source: StationEntity): number {
    const player = this.assistPlayer;
    if (!this.active || !player || player.hasVacuum || player.isFull ||
      player.noTakeFrom === source.id || !source.def.item) return 0;
    source.servicePoint(this.assistAccess);
    const distance = dist(player.x, player.z, this.assistAccess.x, this.assistAccess.z);
    const action = this.currentAction;
    const approaching = action && distance < 3.5 &&
      dist(action.x, action.z, this.assistAccess.x, this.assistAccess.z) < 0.7;
    return distance < 1.55 || approaching ? 1 : 0;
  }

  /** Reserve a started clean-up long enough for the player to visit the bin. */
  private playerClaimsTable(table: StationEntity): boolean {
    if (!this.active || table.def.kind !== 'table' || !table.isDirty) return false;
    if (this.playerCare?.id === table.id && this.playerCare.remaining > 0) return true;
    const player = this.assistPlayer;
    if (!player || player.hasVacuum || player.planarSpeed >= 1 ||
      player.slots.some(item => item !== 'bulasik') || player.isFull) return false;
    return this.playerAccess(table,player.x,player.z,1.55,this.assistAccess);
  }

  private updateStaff(dt: number): void {
    for (const s of this.staff) {
      s.thinkTimer -= dt;
      s.handTimer -= dt;
      s.workingVisual = false;
      this.watchdogStaff(s);
      switch (s.role) {
        case 'cashier':
          this.updateCashier(s, dt);
          break;
        case 'barista':
          this.updateBaristaAssist(s, dt);
          break;
        case 'busser':
          this.updateBusserAssist(s, dt);
          break;
        default:
          this.updateWaiter(s, dt);
          break;
      }
      if (s.role !== 'cashier' && s.role !== 'barista') s.workingVisual = s.atStation && s.job !== 'rest';
      const animate = this.isNearCamera(s.x, s.z);
      s.step(dt, this.nav, animate);
      this.syncActorRender(s.char.root,animate);
      const fixedWaiting = (s.role === 'cashier' || s.role === 'barista') && !s.assigned;
      const status = s.stallTimer > 2.5
        ? 'blocked'
        : fixedWaiting
          ? 'waiting'
          : s.job === 'rest'
            ? 'rest'
            : s.job === 'deliver' || s.job === 'collect'
              ? 'deliver'
              : s.workingVisual
                ? 'working'
                : 'moving';
      s.setStatus(status, dt);
    }
  }

  private updateCashier(s: Staff, dt: number): void {
    const co = s.assigned;
    if (!co || co.locked) {
      this.goRest(s);
      return;
    }
    s.job = 'station';
    s.char.setWorkKind('cash');
    co.servicePoint(_pt);
    s.moveTo(this.nav, _pt.x, _pt.z);
    s.atStation = s.distanceTo(_pt.x, _pt.z) < 0.9 + s.reachBonus;
    if (s.atStation) {
      s.faceTowards(co.x, co.z + 2, dt, 8);
      s.workingVisual = queueOf(co).some((customer) => customer.state === 'order');
    }
  }

  /** Barista yalnız üretim hızına yardım eder; ürün boşaltıp taşımaz. */
  private updateBaristaAssist(s: Staff, dt: number): void {
    const st = s.assigned;
    if (!st || st.locked) {
      this.goRest(s);
      return;
    }
    if (s.carryCount > 0) s.dropAll();
    s.job = 'station';
    s.char.setWorkKind('machine');
    st.servicePoint(_pt);
    s.moveTo(this.nav, _pt.x, _pt.z);
    s.atStation = s.distanceTo(_pt.x, _pt.z) < 1.0 + s.reachBonus;
    s.workingVisual = s.atStation && st.working && st.output < st.outputCap;
    st.baristaBoost = s.workingVisual ? baristaBoost(s.level) : 1;
    if (s.atStation) s.faceTowards(st.x, st.z, dt, 8);
  }

  /**
   * Komi yalnız kirli masanın tıkanmasını önler. Leke, trafik kiri,
   * tuvalet ve sarf oyuncunun aktif işidir; kominin topladığı bulaşık
   * para veya görev ilerlemesi üretmez.
   */
  private updateBusserAssist(s: Staff, dt: number): void {
    s.char.setWorkKind('generic');
    if (s.carryCount > 0 && s.carryItem !== 'bulasik') s.dropAll();

    // Aynı masada birden fazla tabak varsa kapasitesi dolana kadar toplar;
    // tek tabak için sürekli masa-kova mekik dokumaz.
    if (s.source && this.playerClaimsTable(s.source)) {
      s.source.clearReserve(s.uid); s.source = null;
    }
    const activeTable = s.source;
    if (
      s.carryCount > 0 &&
      activeTable?.def.kind === 'table' &&
      !activeTable.locked &&
      activeTable.dishes > 0 &&
      !s.isFull
    ) {
      s.job = 'fetch';
      s.char.setWorkKind('reach');
      activeTable.reserve(s.uid);
      activeTable.servicePoint(_pt);
      s.moveTo(this.nav, _pt.x, _pt.z);
      s.atStation = s.distanceTo(_pt.x, _pt.z) < 1.4 + s.reachBonus;
      if (s.atStation && s.handTimer <= 0 && activeTable.takeDish() && s.give('bulasik')) {
        s.handTimer = busserWorkTime(s.level);
        this.vfx?.puff(activeTable.x, 1.15, activeTable.z, 0x8a7f74, 3);
        if (activeTable.dishes === 0 && activeTable.soil <= 0.02) this.assignWaitingCustomersToTables();
        sfx('pickup', 0.25);
      }
      return;
    }

    if (s.carryCount > 0) {
      if (s.source) {
        s.source.clearReserve(s.uid);
        s.source = null;
      }
      const bin = this.nearestBin(s.x, s.z, s.uid);
      if (!bin) {
        // Başka komi kovayı kullanıyorsa bulaşık yok edilmez; kısa süre
        // elde bekler ve bir sonraki tikte tekrar dener.
        s.job = 'collect';
        s.atStation = true;
        s.stop();
        return;
      }
      s.job = 'collect';
      s.char.setWorkKind('reach');
      s.dest = bin;
      bin.reserve(s.uid);
      bin.servicePoint(_pt);
      s.moveTo(this.nav, _pt.x, _pt.z);
      s.atStation = s.distanceTo(_pt.x, _pt.z) < 1.1 + s.reachBonus;
      if (s.atStation) {
        s.faceTowards(bin.x, bin.z, dt, 8);
        if (s.handTimer <= 0) {
          const item = s.take();
          if (item) {
            bin.accept(item);
            if (s.carryCount === 0) { bin.clearReserve(s.uid); s.dest = null; }
            s.handTimer = s.handInterval;
            this.vfx?.puff(bin.x, 1.0, bin.z, 0x6b7a83, 3);
            sfx('drop', 0.25);
          }
        }
      }
      return;
    }

    // Every open table has one responsible busser. A hire regularly frees
    // its own tables; it does not wait for the entire café to become blocked.
    let busserCount = 0;
    for (let i = 0; i < this.staff.length; i++) {
      if (this.staff[i].role === 'busser') busserCount++;
    }
    const teamSize = Math.max(1, busserCount);
    let table: StationEntity | null = null;
    let bestScore = -Infinity;
    let openIdx = 0;
    for (let i = 0; i < this.tables.length; i++) {
      const t = this.tables[i];
      if (t.locked) continue;
      const myTurn = openIdx % teamSize === s.index;
      openIdx++;
      if (
        !myTurn ||
        !t.isDirty ||
        this.playerClaimsTable(t) ||

        t.isReservedByOther(s.uid) ||
        (t.cleanValue > 0 && t.dirtyAge < 12)
      ) {
        continue;
      }
      const score = t.dirtyAge - dist(s.x, s.z, t.x, t.z) * 0.6;
      if (score > bestScore) {
        bestScore = score;
        table = t;
      }
    }
    if (!table) {
      this.goRest(s);
      return;
    }
    table.reserve(s.uid);
    s.job = 'fetch';
    s.char.setWorkKind(table.dishes > 0 ? 'reach' : 'wipe');
    s.source = table;
    table.servicePoint(_pt);
    s.moveTo(this.nav, _pt.x, _pt.z);
    s.atStation = s.distanceTo(_pt.x, _pt.z) < 1.4 + s.reachBonus;
    if (!s.atStation) return;
    s.faceTowards(table.x, table.z, dt, 8);
    if (table.dishes > 0) {
      if (s.handTimer <= 0 && table.takeDish() && s.give('bulasik')) {
        s.handTimer = busserWorkTime(s.level);
        this.vfx?.puff(table.x, 1.15, table.z, 0xf0ece2, 3);
        sfx('dish_clatter', 0.35);
        if (table.dishes === 0 && table.soil <= 0.02) {
          this.assignWaitingCustomersToTables();
        }
      }
      return;
    }

    // Düzenli masa temizliği: para, zemin işi veya oyuncu görevi üretmez.
    // Para, görev ve aktif tempo üretmez; oyuncunun işini ödülsüz biçimde devralmaz.
    if (table.soil > 0.02) {
      const before = table.soil;
      table.soil = Math.max(0, table.soil - dt / (busserWorkTime(s.level) * 1.8));
      table.progress = 1 - table.soil / Math.max(0.01, table.cleanStartSoil || table.soil);
      if (this.rng.chance(dt * 3.5)) {
        this.vfx?.foamBurst(table.x, 1.01, table.z, 2);
        this.vfx?.sparkle(table.x, 1.0, table.z, 0xbadbd2);
      }
      if (before > 0.02 && table.soil <= 0.02) {
        table.soil = 0;
        table.progress = 0;
        table.cleanStartSoil = 0;
        const completedWork = Math.max(1, table.cleanValue);
        table.cleanValue = 0;
        table.dirtyAge = 0;
        table.clearReserve(s.uid);

        this.stationVisuals.get(table.id)?.playGleam?.();
        sfx('clean_chime', 0.22);
        this.payClean(BALANCE.dirt.dishRewardRate * completedWork * 0.5, table.x, table.z, false);
        bus.emit('table:cleaned', { id: table.id, x: table.x, z: table.z, byPlayer: false });
        this.assignWaitingCustomersToTables();
      }
      return;
    }
    table.cleanValue = 0;
    table.dirtyAge = 0;
    table.progress = 0;
    table.clearReserve(s.uid);
  }

  private readonly _tableServePick: { source: StationEntity | null; dest: StationEntity | null; item: ItemId } = {
    source: null,
    dest: null,
    item: 'cay',
  };
  private readonly _relayPick: { source: StationEntity | null; dest: StationEntity | null } = {
    source: null,
    dest: null,
  };

  /**
   * TEZGÂHTAR / GARSON:
   * 1. Masada oturan ve sipariş bekleyen müşterilere servis (masaya teslimat).
   * 2. Tüm açık makinelerden ürünü alıp ilgili rafları tam kapasiteye dizme (ikmal).
   * Oyuncuyu gölgede bırakmamak için masaya servis yaparken bilerek daha yavaş hareket eder.
   */
  private updateWaiter(s: Staff, dt: number): void {
    if (this.rushPlayerOnly) {
      this.goRest(s);
      return;
    }
    if (s.job !== 'deliver' || s.dest?.def.kind !== 'table') {
      s.speed = waiterSpeed(s.level);
    }
    if (s.job === 'fetch' && s.source) {
      this.doFetch(s, dt);
    } else if (s.job === 'deliver' && s.dest) {
      this.doDeliver(s, dt);
    }
    if (s.job === 'fetch' || s.job === 'deliver') return;

    if (s.carryCount > 0 && s.carryItem) {
      // Masada bekleyen müşteriye teslimat (öncelikli)
      const tableDest = this.findTableNeedingItem(s.carryItem, s);
      if (tableDest) {
        s.dest = tableDest;
        if (!tableDest.isReservedByOther(s.uid)) tableDest.reserve(s.uid);
        s.job = 'deliver';
        tableDest.servicePoint(_pt);
        s.moveTo(this.nav, _pt.x, _pt.z);
        return;
      }
      // Personel tavanı HEDEF SEÇME kuralıdır, elde kalanı imha etme
      // sebebi değil (bkz. updateBarista'daki aynı desen). dropAll'dan
      // ÖNCE tavansız bir kez daha dene.
      const back = this.bestConsumer(s.carryItem, s.x, s.z, s.uid, false);
      if (back) {
        s.dest = back;
        if (!back.isReservedByOther(s.uid)) back.reserve(s.uid);
        s.job = 'deliver';
        back.servicePoint(_pt);
        s.moveTo(this.nav, _pt.x, _pt.z);
        return;
      }
      // Hedef raf tamamen dolduysa ve hiçbir masa bu ürünü istemiyorsa:
      // Başka bir hatta bekleyen aktif iş varsa ürünü makinesine iade et ki
      // tezgâhtar elinde ürünle kilitlenmesin; yoksa elindekini koru ve bekle.
      const hasOtherWork =
        this.findTableServeJob(s) !== null || this.findRelayJob(s) !== null;
      if (!hasOtherWork) {
        this.goRest(s);
        return;
      }
      const mach = this.machineFor(s.carryItem);
      if (mach) {
        mach.output = Math.min(mach.outputCap, mach.output + s.carryCount);
      }
      s.dropAll();
    }

    // 1. Masada oturan ve sipariş bekleyen müşteriye raf veya makineden teslimat
    const tableServe = this.findTableServeJob(s);
    if (tableServe) {
      s.source = tableServe.source;
      s.dest = tableServe.dest;
      s.fetchItem = tableServe.item;
      if (!tableServe.source.isReservedByOther(s.uid)) tableServe.source.reserve(s.uid);
      if (!tableServe.dest.isReservedByOther(s.uid)) tableServe.dest.reserve(s.uid);
      s.job = 'fetch';
      tableServe.source.servicePoint(_pt);
      s.moveTo(this.nav, _pt.x, _pt.z);
      return;
    }

    // 2. Dolan makineleri kendi raflarına boşaltma (çoklu ürün ikmali)
    const relay = this.findRelayJob(s);
    if (relay) {
      s.source = relay.source;
      s.dest = relay.dest;
      s.fetchItem = relay.source.def.item ?? null;
      if (!relay.source.isReservedByOther(s.uid)) relay.source.reserve(s.uid);
      if (!relay.dest.isReservedByOther(s.uid)) relay.dest.reserve(s.uid);
      s.job = 'fetch';
      relay.source.servicePoint(_pt);
      s.moveTo(this.nav, _pt.x, _pt.z);
      return;
    }

    this.goRest(s);
  }

  /** Masada bekleyen misafirlerin belirli bir üründen toplam kaç adet beklediği. */
  private tableNeedCount(t: StationEntity, item: ItemId): number {
    let needed = 0;
    const guests = guestsOf(t);
    for (let i = 0; i < guests.length; i++) {
      const g = guests[i];
      if (!g.order || g.orderComplete || g.eating) continue;
      needed += g.order.remainingOf(item);
    }
    return needed;
  }

  /** Bankoda başka tezgâhtarların alacağı düşüldükten sonra kalan ürün adedi. */
  private availableOnPickupForWaiter(p: StationEntity, item: ItemId, uid: string): number {
    let count = 0;
    for (let i = 0; i < p.contents.length; i++) {
      if (p.contents[i] === item) count++;
    }
    if (count <= 0) return 0;
    for (let i = 0; i < this.staff.length; i++) {
      const other = this.staff[i];
      if (other.uid === uid || other.role !== 'waiter') continue;
      if (other.job === 'fetch' && other.source === p && (other.fetchItem ?? other.carryItem) === item) {
        const targetNeed = other.dest?.def.kind === 'table'
          ? Math.max(1, this.tableNeedCount(other.dest, item))
          : other.capacity;
        count -= Math.max(0, Math.min(other.capacity, targetNeed) - other.carryCount);
      }
    }
    return count;
  }

  /** Başka tezgâhtarların aynı makineden almak üzere yolda olduğu toplam adet. */
  private waiterClaimedFromMachine(m: StationEntity, uid: string): number {
    let claimed = 0;
    for (let i = 0; i < this.staff.length; i++) {
      const other = this.staff[i];
      if (other.uid === uid || other.role !== 'waiter') continue;
      if (other.job === 'fetch' && other.source === m) {
        let wantCount = other.capacity - other.carryCount;
        if (other.dest?.def.kind === 'pickup') {
          const missing = Math.max(0, this.staffShelfTarget(other.dest) - other.dest.output);
          wantCount = Math.min(wantCount, Math.max(0, missing - other.carryCount));
        } else if (other.dest?.def.kind === 'table' && m.def.item) {
          const needed = Math.max(1, this.tableNeedCount(other.dest, m.def.item));
          wantCount = Math.min(wantCount, Math.max(0, needed - other.carryCount));
        }
        claimed += Math.max(1, wantCount);
      }
    }
    return claimed;
  }

  /** Başka tezgâhtarların hedef rafa halihazırda taşımakta olduğu ürün adedi. */
  private waiterIncomingToShelf(dest: StationEntity, item: ItemId, uid: string, deliverOnly = false): number {
    let incoming = 0;
    for (let i = 0; i < this.staff.length; i++) {
      const other = this.staff[i];
      if (other.uid === uid || other.role !== 'waiter') continue;
      if (other.dest !== dest) continue;
      if (other.job === 'deliver' && other.carryItem === item) {
        incoming += other.carryCount;
      } else if (!deliverOnly && other.job === 'fetch') {
        const src = other.source;
        const srcItem = other.fetchItem ?? other.carryItem ?? src?.def.item ?? null;
        if (srcItem === item) {
          const srcAvail = src ? Math.max(0, src.output - this.playerStockFloor(src)) : 0;
          incoming += Math.min(other.capacity, other.carryCount + srcAvail);
        }
      }
    }
    return incoming;
  }

  /** Masada bekleyen müşterinin ihtiyacı olan ürünü teslim edebilecek masa. */
  private findTableNeedingItem(item: ItemId, s: Staff): StationEntity | null {
    let bestTable: StationEntity | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < this.tables.length; i++) {
      const t = this.tables[i];
      if (t.locked || t.isReservedByOther(s.uid)) continue;
      if (!t.guestNeeds(item)) continue;
      let hasWaiting = false;
      const guests = guestsOf(t);
      for (let j = 0; j < guests.length; j++) {
        const c = guests[j];
        if (c.order && !c.orderComplete && !c.eating) {
          hasWaiting = true;
          break;
        }
      }
      if (!hasWaiting) continue;
      const d = dist(s.x, s.z, t.x, t.z);
      if (d < bestDist) {
        bestDist = d;
        bestTable = t;
      }
    }
    return bestTable;
  }

  /**
   * Masada bekleyen müşteriye yiyecek/içecek getirme işi:
   * Oturan müşterinin beklediği ürünü raf veya makineden alıp masaya götürür.
   */
  private findTableServeJob(s: Staff): { source: StationEntity; dest: StationEntity; item: ItemId } | null {
    let bestSrc: StationEntity | null = null;
    let bestDest: StationEntity | null = null;
    let bestItem: ItemId = 'cay';
    let bestScore = Infinity;

    for (let ti = 0; ti < this.tables.length; ti++) {
      const t = this.tables[ti];
      if (t.locked || t.isReservedByOther(s.uid)) continue;

      const guests = guestsOf(t);
      for (let gi = 0; gi < guests.length; gi++) {
        const guest = guests[gi];
        if (!guest.order || guest.orderComplete || guest.eating) continue;
        const lines = guest.order.lines;
        for (let li = 0; li < lines.length; li++) {
          const line = lines[li];
          if (line.served >= line.qty) continue;
          const want = line.item;

          // Raf (pickup) kontrolü
          for (let pi = 0; pi < this.pickups.length; pi++) {
            const p = this.pickups[pi];
            if (p.locked || this.availableOnPickupForWaiter(p, want, s.uid) <= 0) continue;
            const score = dist(s.x, s.z, p.x, p.z) + dist(p.x, p.z, t.x, t.z);
            if (score < bestScore) {
              bestScore = score;
              bestSrc = p;
              bestDest = t;
              bestItem = want;
            }
          }

          // Makine kontrolü
          for (let mi = 0; mi < this.machines.length; mi++) {
            const m = this.machines[mi];
            if (m.locked || m.def.item !== want) continue;
            const avail = m.output - this.playerStockFloor(m) - this.waiterClaimedFromMachine(m, s.uid);
            if (avail <= 0) continue;
            const penalty = m.isReservedByOther(s.uid) ? 6.0 : 1.2;
            const score = dist(s.x, s.z, m.x, m.z) + dist(m.x, m.z, t.x, t.z) + penalty;
            if (score < bestScore) {
              bestScore = score;
              bestSrc = m;
              bestDest = t;
              bestItem = want;
            }
          }
        }
      }
    }

    if (!bestSrc || !bestDest) return null;
    this._tableServePick.source = bestSrc;
    this._tableServePick.dest = bestDest;
    this._tableServePick.item = bestItem;
    return this._tableServePick as { source: StationEntity; dest: StationEntity; item: ItemId };
  }

  /** Dolan makineleri ilgili raflarına boşaltma işi — tüm açık ürünleri dinamik öncelikle besler. */
  private findRelayJob(s: Staff): { source: StationEntity; dest: StationEntity } | null {
    let bestM: StationEntity | null = null;
    let bestDest: StationEntity | null = null;
    let bestScore = 0;

    for (let i = 0; i < this.machines.length; i++) {
      const m = this.machines[i];
      const item = m.def.item;
      if (m.locked || !item || !isProduct(item)) continue;
      const floor = this.playerStockFloor(m);
      const avail = m.output - floor;
      if (avail <= 0) continue;

      const claimedFromM = this.waiterClaimedFromMachine(m, s.uid);
      const unclaimedAvail = avail - claimedFromM;
      if (unclaimedAvail <= 0) continue;

      const dest = this.bestConsumer(item, m.x, m.z, s.uid, true);
      if (!dest) continue;

      const targetCap = Math.max(1, this.staffShelfTarget(dest));
      const rawMissing = targetCap - dest.output;
      if (rawMissing <= 0) continue;

      const incoming = this.waiterIncomingToShelf(dest, item, s.uid, false);
      const unclaimedMissing = rawMissing - incoming;
      const d = dist(s.x, s.z, m.x, m.z) + dist(m.x, m.z, dest.x, dest.z);

      let score: number;
      if (unclaimedMissing > 0) {
        const shelfNeed = unclaimedMissing / targetCap;
        const emptyBonus = dest.output === 0 && incoming === 0 ? 1.5 : 0;
        const demand = this.demandFor(item);
        const customerDeficit = Math.max(0, demand - (dest.output + incoming));
        const demandBonus = customerDeficit > 0 ? 3.0 + Math.min(3, customerDeficit) : 0;
        const fullness = m.output / Math.max(1, m.outputCap);
        score = (shelfNeed * 3.0 + emptyBonus + demandBonus + fullness * 0.8 + 0.2) / (4 + d * 0.25);
        if (m.isReservedByOther(s.uid) || dest.isReservedByOther(s.uid)) {
          score *= 0.2;
        }
      } else {
        // Başka bir tezgâhtar yoldayken bile makinede hâlâ sahipsiz ürün ve rafta boş yer varsa
        // tamamen başka iş kalmadığında boşta beklememek için en düşük öncelikli yedek olarak tut.
        score = 0.001 / (4 + d * 0.25);
      }

      if (score > bestScore) {
        bestScore = score;
        bestM = m;
        bestDest = dest;
      }
    }

    if (!bestM || !bestDest) return null;
    this._relayPick.source = bestM;
    this._relayPick.dest = bestDest;
    return this._relayPick as { source: StationEntity; dest: StationEntity };
  }

  /**
   * Masalarda BEKLEYEN siparişlerin istediği ürünler.
   *
   * Hem rehber oku hem oyuncunun bankodan alması bunu kullanır: ikisi de
   * aynı soruyu sorar ("şu an neye ihtiyaç var"), farklı cevap vermeleri
   * oyuncuyu yanıltır.
   */
  private demandSet(out: Set<ItemId>): Set<ItemId> {
    out.clear();
    for (const t of this.tables) {
      if (t.locked) continue;
      for (const c of guestsOf(t)) {
        if (!c.order) continue;
        for (const l of c.order.lines) if (l.served < l.qty) out.add(l.item);
      }
    }
    return out;
  }

  private readonly _demand = new Set<ItemId>();

  /** Bankodan talep edilen ürünü al; talep yoksa sıradakini ver. */
  private takeWanted(src: StationEntity): ItemId | null {
    const item=this.peekWanted(src,this.demandSet(this._demand));
    return item && src.takeItem(item) ? item : null;
  }

  /** Match the selected job and useful carried batch; never overfill a covered order. */
  private peekWanted(src: StationEntity, need: ReadonlySet<ItemId>, player = this.assistPlayer): ItemId | null {
    const carried = (item: ItemId): number => {
      let count = 0;
      for (const held of player?.slots ?? []) if (held === item) count++;
      return count;
    };
    let sidePending = false;
    if (this.selectedSideActivity) {
      const side = this.sideActivities.peek(this.selectedSideActivity);
      if (side.level > 0) for (const line of side.lines) {
        const remaining = line.quantity - line.delivered;
        if (remaining <= 0) continue;
        sidePending = true;
        if (remaining > carried(line.item) && src.hasItem(line.item)) return line.item;
      }
    }
    const useful = (item: ItemId): boolean => {
      if (!need.has(item) || !src.hasItem(item)) return false;
      let remaining = 0;
      for (const table of this.tables) if (!table.locked)
        for (const guest of guestsOf(table)) remaining += guest.order?.remainingOf(item) ?? 0;
      return remaining > carried(item);
    };
    for (const item of player?.slots ?? []) if (useful(item)) return item;
    for (const item of src.contents) if (useful(item)) return item;
    // With a live job, having its items is a cue to deliver, not take surplus stock.
    return need.size || sidePending ? null : src.contents[0] ?? null;
  }

  /**
   * Mola: yapacak iş kalmadığında (masalar tok, makineler boş ya da
   * bankolar dolu) personel dinlenme köşesine çekilir. Donuk tek noktada
   * durmak "eleman bozuldu, boş boş duruyor" diye okunuyordu — molada
   * küçük bir alanda ağır ağır gezinirler; canlı ama meşgul değil.
   */
  private goRest(s: Staff): void {
    if (s.role === 'waiter') s.speed = waiterSpeed(s.level);
    const entering = s.job !== 'rest';
    if (entering) s.clearJob();
    else s.job = 'rest';
    s.atStation = false;
    // Aynı dinlenme hedefini her kare yeniden seçmek yön seğirmesi ve
    // gereksiz yol hesabı üretiyordu. Hedefe gidene kadar koru, varınca bekle.
    if (!entering && s.hasTarget) return;
    if (!entering && s.thinkTimer > 0) return;
    const roleSlot = (['waiter', 'cashier', 'barista', 'busser'] as StaffRole[]).indexOf(s.role);
    const globalSlot = s.index * 4 + Math.max(0, roleSlot);
    const bx = this.loc.staffRest.x + (globalSlot % 4) * 1.05;
    const bz = this.loc.staffRest.z + Math.floor(globalSlot / 4) * 0.9;
    if (this.rng.chance(0.3)) {
      const a = this.rng.range(0, Math.PI * 2);
      const rr = this.rng.range(0.2, 0.9);
      s.moveTo(this.nav, bx + Math.cos(a) * rr, bz + Math.sin(a) * rr);
    } else {
      s.moveTo(this.nav, bx, bz);
    }
    s.thinkTimer = this.rng.range(3, 6);
  }

  private doFetch(s: Staff, dt: number): void {
    const src = s.source;
    if (!src || src.locked) {
      s.clearJob();
      return;
    }
    const want = s.fetchItem ?? s.carryItem ?? src.def.item ?? null;
    // Yolda yürürken hedef masa veya raf ihtiyacı kapandıysa (veya kaynak boşaldıysa)
    // boşuna kaynağa kadar yürümek yerine işi hemen tazele.
    if (s.role === 'waiter' && s.carryCount === 0) {
      const srcHasStock =
        src.def.kind === 'pickup'
          ? (want ? src.hasItem(want) : src.output > 0)
          : src.output > this.playerStockFloor(src);
      const destValid = !s.dest
        ? false
        : s.dest.locked
          ? false
          : s.dest.def.kind === 'pickup'
            ? s.dest.output < this.staffShelfTarget(s.dest)
            : s.dest.def.kind === 'table'
              ? !!want && s.dest.guestNeeds(want)
              : true;
      if (!srcHasStock || !destValid) {
        s.clearJob();
        return;
      }
    }
    // Rezervasyon YÜRÜRKEN tazelenir: 5 sn'lik zaman aşımı, 20+ birimlik
    // VIP yolculuklarında yolda düşüyor ve ikinci garson aynı işi kapıyordu.
    if (!src.isReservedByOther(s.uid)) src.reserve(s.uid);
    if (s.dest && !s.dest.isReservedByOther(s.uid)) s.dest.reserve(s.uid);
    src.servicePoint(_pt);
    s.moveTo(this.nav, _pt.x, _pt.z);
    s.atStation = s.distanceTo(_pt.x, _pt.z) < 1.1 + s.reachBonus;
    if (!s.atStation) return;
    s.faceTowards(src.x, src.z, dt, 8);

    // v5: garson yok — tezgâhtar da barista gibi rafa teslim eder.
    const nextJob = s.role === 'busser' ? 'supply' : 'deliver';

    if (s.handTimer <= 0) {
      /**
       * Banko KARMA tampondur: garson masaya götüreceği BELİRLİ ürünü
       * çeker (fetchItem). "Üstteki her neyse" almak iki hataya yol
       * açıyordu: yanlış ürünle yola çıkmak ve eldekiyle uyuşmayan ürünü
       * alıp geri koyarak bankonun başında sonsuz dönmek.
       */
      const canGet =
        src.def.kind === 'pickup' ? (want ? src.hasItem(want) : src.output > 0) : src.output > this.playerStockFloor(src);
      if (canGet && !s.isFull) {
        let item: ItemId | null = null;
        if (src.def.kind === 'pickup' && want) {
          item = src.takeItem(want) ? want : null;
        } else {
          item = src.takeOutput();
        }
        if (item && s.give(item)) {
          s.handTimer = s.handInterval;
          sfx('pickup', 0.22);
        } else if (item) {
          // Eline sığmadı/uyuşmadı: geri koy ve eldekiyle yola çık —
          // bankonun başında bekleyip durma.
          if (src.def.kind === 'pickup') src.accept(item);
          else src.output = Math.min(src.outputCap, src.output + 1);
          src.clearReserve(s.uid);
          s.source = null;
          s.fetchItem = null;
          s.job = s.carryCount > 0 ? nextJob : 'rest';
        }
      } else {
        src.clearReserve(s.uid);
        s.source = null;
        s.fetchItem = null;
        if (s.carryCount > 0) {
          s.job = nextJob;
        } else {
          s.job = 'rest';
          s.dest?.clearReserve(s.uid);
          s.dest = null;
        }
      }
    }
    if (s.isFull) {
      src.clearReserve(s.uid);
      s.source = null;
      s.fetchItem = null;
      s.job = nextJob;
    }
    /** Tezgâhtar rafın gerçek kapasite hedefinin eksiğini, kendi taşıma kapasitesi kadar yükler. */
    if (s.role === 'waiter' && s.carryCount > 0 && s.dest && s.dest.def.kind === 'pickup') {
      const incomingDeliver = s.carryItem ? this.waiterIncomingToShelf(s.dest, s.carryItem, s.uid, true) : 0;
      const missing = Math.max(0, this.staffShelfTarget(s.dest) - s.dest.output - incomingDeliver);
      if (missing <= 0 || s.carryCount >= Math.min(missing, s.capacity)) {
        src.clearReserve(s.uid);
        s.source = null;
        s.fetchItem = null;
        s.job = 'deliver';
      }
    }
    if (s.role === 'waiter' && s.carryCount > 0 && s.dest && s.dest.def.kind === 'table') {
      const needed = s.carryItem ? Math.max(1, this.tableNeedCount(s.dest, s.carryItem)) : 1;
      if (s.carryCount >= Math.min(needed, s.capacity)) {
        src.clearReserve(s.uid);
        s.source = null;
        s.fetchItem = null;
        s.job = 'deliver';
      }
    }
  }

  private doDeliver(s: Staff, dt: number): void {
    let dest = s.dest;
    // Oyuncu personel yoldayken rafı doldurmuş olabilir. Tezgâhtar hedefi
    // aşmaz; elindekini başka acil masaya/rafa taşımayı anında dener.
    if (s.role === 'waiter' && dest?.def.kind === 'pickup' && dest.output >= this.staffShelfTarget(dest)) {
      const altTable = s.carryItem ? this.findTableNeedingItem(s.carryItem, s) : null;
      const alt = altTable ?? (s.carryItem ? this.bestConsumer(s.carryItem, s.x, s.z, s.uid, false) : null);
      if (alt && alt !== dest) {
        dest.clearReserve(s.uid);
        s.dest = alt;
        if (!alt.isReservedByOther(s.uid)) alt.reserve(s.uid);
        dest = alt;
      } else {
        dest.clearReserve(s.uid);
        s.dest = null;
        s.fetchItem = null;
        s.job = 'rest';
        s.thinkTimer = 0;
        return;
      }
    }
    if (!dest || dest.locked || (s.carryItem && !dest.canAccept(s.carryItem))) {
      if (s.carryItem) {
        const altTable = s.role === 'waiter' ? this.findTableNeedingItem(s.carryItem, s) : null;
        const alt = altTable ?? this.bestConsumer(s.carryItem, s.x, s.z, s.uid, false);
        if (alt && alt !== dest) {
          dest?.clearReserve(s.uid);
          s.dest = alt;
          if (!alt.isReservedByOther(s.uid)) alt.reserve(s.uid);
          dest = alt;
        } else {
          if (s.role === 'waiter') s.speed = waiterSpeed(s.level);
          dest?.clearReserve(s.uid);
          s.dest = null;
          s.fetchItem = null;
          s.job = 'rest';
          s.thinkTimer = 0;
          return;
        }
      } else {
        if (s.role === 'waiter') s.speed = waiterSpeed(s.level);
        dest?.clearReserve(s.uid);
        s.dest = null;
        s.fetchItem = null;
        s.job = 'rest';
        s.thinkTimer = 0;
        return;
      }
    }
    if (!dest) {
      if (s.role === 'waiter') s.speed = waiterSpeed(s.level);
      s.clearJob();
      return;
    }
    // Yürüyüş boyunca rezervasyonu canlı tut (bkz. doFetch'teki not).
    if (!dest.isReservedByOther(s.uid)) dest.reserve(s.uid);
    dest.servicePoint(_pt);
    s.moveTo(this.nav, _pt.x, _pt.z);
    const isTable = dest.def.kind === 'table';
    if (s.role === 'waiter') {
      // Masaya giderken oyuncuyu gölgede bırakmamak için bilerek sakin/yavaş yürür
      s.speed = isTable ? waiterSpeed(s.level) * 0.65 : waiterSpeed(s.level);
    }
    const reach = isTable ? 1.7 : 1.1;
    s.atStation = s.distanceTo(_pt.x, _pt.z) < reach + s.reachBonus;
    if (!s.atStation) return;
    s.faceTowards(dest.x, dest.z, dt, 8);

    if (s.handTimer > 0) return;
    if (s.carryCount <= 0) {
      if (s.role === 'waiter') s.speed = waiterSpeed(s.level);
      dest.clearReserve(s.uid);
      s.dest = null;
      s.fetchItem = null;
      s.job = 'rest';
      s.thinkTimer = 0;
      return;
    }
    const item = s.carryItem!;
    if (dest.canAccept(item)) {
      s.take();
      dest.accept(item);
      s.handTimer = isTable ? s.handInterval * 1.8 : s.handInterval;
      this.onItemPlaced(dest, item);
      if (s.carryCount === 0 || !dest.canAccept(item)) {
        if (s.role === 'waiter') s.speed = waiterSpeed(s.level);
        dest.clearReserve(s.uid);
        s.dest = null;
        s.fetchItem = null;
        s.job = 'rest';
        s.thinkTimer = 0;
      }
    } else {
      if (s.role === 'waiter') s.speed = waiterSpeed(s.level);
      dest.clearReserve(s.uid);
      s.dest = null;
      s.fetchItem = null;
      s.job = 'rest';
      s.thinkTimer = 0;
    }
  }

  /**
   * @param forStaff İsteyen personel mi. Personel rafları gerçek raf
   *   kapasitesine (`dest.outputCap`) kadar doldurur.
   */
  bestConsumer(
    item: ItemId,
    fromX: number,
    fromZ: number,
    uid: string,
    forStaff = false,
  ): StationEntity | null {
    let best: StationEntity | null = null;
    let bestScore = 0;
    const list = isProduct(item) ? this.pickups : isSupply(item) ? this.toilets : null;
    if (!list) return null;
    for (let i = 0; i < list.length; i++) {
      const dest = list[i];
      if (dest.locked || !dest.canAccept(item)) continue;
      const isShelf = dest.def.kind === 'pickup';
      if (!isShelf && dest.isReservedByOther(uid)) continue;
      const cap = isShelf ? dest.outputCap : 6;
      const have = isShelf ? dest.output : dest.supplyOf(item);
      if (forStaff && isShelf && have >= this.staffShelfTarget(dest)) continue;
      const need = 1 - have / Math.max(1, cap);
      const d = dist(fromX, fromZ, dest.x, dest.z);
      let score = (need * 2 + 0.6) / (4 + d * 0.3);
      if (isShelf && dest.isReservedByOther(uid)) score *= 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = dest;
      }
    }
    return best;
  }

  staffShelfTarget(shelf: StationEntity): number {
    return Math.max(shelf.outputCap, waiterShelfTarget(this.state.staffLevelAt(this.loc.id).waiter, shelf.outputCap));
  }

  /* ============================================================ *
   *  Otomasyon / arka plan
   * ============================================================ */

  refreshAutomation(): void {
    this.computeAutomation();
  }

  private computeAutomation(): void {
    const local = this.state.staffCountAt(this.loc.id);
    const waiters = local.waiter;
    const cashiers = local.cashier;
    const bussers = local.busser;
    const baristas = local.barista;
    if (waiters <= 0 || cashiers <= 0) {
      this.automation = 0;
      return;
    }
    const service = clamp01(waiters / 3);
    const checkout = clamp01(cashiers / 1.5);
    const clean = clamp01(bussers / 2);
    const prod = clamp01(0.6 + baristas * 0.12);
    this.automation = clamp01(service * 0.45 + checkout * 0.25 + clean * 0.2 + prod * 0.1);
  }

  /**
   * Arka plan şubesinde: soyut servis + tahsilat.
   *
   * TAVAN ŞART. Eski hâli `0,8 × garson × (1 + seviye×0,14)` idi ve
   * hiçbir şeye tabi değildi: ne sipariş tavanına, ne otomasyona, ne
   * müşteri sabrına. Altı garson ve 10. seviyede saniyede 11,52 ürün
   * satıyordu — yani KAPALI şube, oyuncunun bizzat koşturduğu AÇIK
   * şubeden daha çok kazandırıyordu (₺277 bin/dk'ya karşı ₺161 bin/dk).
   * Bu, oyunun kendisini oynamamayı optimal strateji yapıyordu.
   *
   * Artık şubenin kendi ÖLÇÜLEN aktif gelirinin bir payıyla sınırlı —
   * arka planda kazanmak iyi olmalı ama oynamaktan iyi olmamalı.
   */
  private abstractService(dt: number): void {
    /**
     * Tavan PARA cinsindendir, adet cinsinden değil.
     *
     * Önce adet tavanı denendi ve iki uçta da çöktü: en ucuz ürünü satınca
     * şube aktifin %9'unu, en pahalıyı satınca %356'sını kazanıyordu. Adet
     * sabit tutulduğunda gelir tamamen hangi ürünün seçildiğine bağlı
     * kalıyor — yani ölçü değil.
     *
     * Doğru bağ, şubenin KENDİ ölçülen aktif geliridir: arka planda o
     * hızın yarısı kazanılır. Böylece "kapalı şube açık şubeden çok
     * kazanır" istismarı yapısal olarak imkânsız hâle gelir ve oyuncu
     * şubeyi geliştirdikçe arka plan geliri kendiliğinden büyür.
     */
    if (this.automation <= 0) {
      this.bgBudget = 0;
      return;
    }
    const measured = this.realizedIncome > 0 ? this.realizedIncome : this.estimateIncomePerSecond() * 0.25;
    const budgetPerSec = measured * BALANCE.offline.backgroundShare * clamp(this.automation, 0, 1);
    const counter = this.openCounters()[0];
    if (!counter) return;
    // Kapalı şube parayı ortak cüzdana ışınlamaz. En fazla beş dakikalık
    // kendi aktif gelirini kasasında tutar; oyuncu şubeye gidip toplar.
    const storedCap = Math.max(1, measured * 300);
    if (counter.cashValue >= storedCap) {
      this.bgBudget = 0;
      return;
    }
    this.bgBudget = Math.min(storedCap - counter.cashValue, this.bgBudget + budgetPerSec * dt);

    let guard = 24; // tek karede sonsuz döngü olmasın
    while (this.bgBudget > 0 && guard-- > 0) {
      // Stoku olan EN DEĞERLİ ürünü sat. `find` ilk bulduğunu alıyordu ve
      // bu pratikte hep en ucuz ürün (çay) oluyordu; kapalı şube menüsünü
      // hiç satmadığı için gelirinin %90'ını kaybediyordu.
      let m: StationEntity | null = null;
      let bestValue = -1;
      for (const x of this.machines) {
        if (x.locked || x.output <= 0 || !x.def.item || !isProduct(x.def.item)) continue;
        const v = this.itemValue(x.def.item);
        if (v > bestValue) {
          bestValue = v;
          m = x;
        }
      }
      if (!m || !m.def.item) break;
      const v = this.itemValue(m.def.item) * this.state.saleMultiplier;
      // Bütçe bu ürünü karşılamıyorsa bekle — böylece pahalı ürün satmak
      // geliri artırmaz, yalnızca satış SIKLIĞINI düşürür.
      if (v > this.bgBudget) break;
      if (counter.cashValue + v > storedCap) break;
      this.bgBudget -= v;
      m.output--;
      counter.cash++;
      counter.cashValue += v;
      // Arka plan satışı aktif görev/festival ilerlemesi üretmez.
    }
  }
  /** Arka plan satış bütçesi (₺). Bkz. abstractService. */
  private bgBudget = 0;

  /**
   * Mutfağın hız çarpanı — akış tavanına girer (bkz. maxPending).
   *
   * `stationSpeedMult` bir SÜRE çarpanıdır (0,89^seviye), yani küçüldükçe
   * makine hızlanır; tersi alınıp ortalaması bulunur. Tam yükseltilmiş bir
   * mutfakta ham değer ~2,54 olur; 0,6 üssüyle sönümlenerek ~1,73'e iner.
   * Sönümleme şart: ham değer doğrudan kullanılsaydı yalnızca istasyon
   * yükseltmeleri geliri 2,5 katına çıkarır ve diğer kaldıraçları gölgede
   * bırakırdı.
   */
  /**
   * Mekânın taşıyabileceği HAM müşteri sayısını tazeler (`venueCapacity`)
   * — tempo bu değere henüz uygulanmamıştır. Açık masa başına 1,15 kişi +
   * 6 taban. Böylece her masa açılımı akışı gerçekten büyütür — masa
   * bölgeleri artık "sandalye ekleyen ama gelir getirmeyen" harcamalar
   * olmaktan çıkar. Kalite kademesi tavanı kesmeye yalnızca en üstte
   * devreye girer.
   *
   * ETKİN tavan (`maxCustomers`, fiilen kullanılan değer) buradan değil
   * `applyTempoCapacity`'den gelir — o, tempo sürekli değiştiği için HER
   * KARE ayrıca çağrılır (bkz. `update`). Bu fonksiyon onu yalnızca HAM
   * değer değiştiğinde (masa açıldığında/kilitlendiğinde) bir kez tetikler.
   */
  refreshCapacity(): void {
    let seats = 0;
    for (const t of this.tables) if (!t.locked) seats += t.seats;
    // Kapasite artık MASA SAYISINDAN değil gerçek sandalye sayısından
    // doğar. İki sandalye yükseltmesi yaklaşık bir ek müşteri alanı açar;
    // oyuncu satın aldığı koltuğun karşılığını doğrudan görür.
    // Başlangıçtaki iki sandalye taban 6 müşteriyi taşır; sonrasındaki her
    // gerçek sandalye bir müşteri alanı açar. Tekli yükseltme boşa gitmez.
    const venue = 4 + seats;
    this.venueCapacity = clamp(
      Math.min(venue, QUALITY.maxCustomers),
      BALANCE.customers.minVenue,
      BALANCE.customers.maxActive,
    );
    this.applyTempoCapacity();
  }

  /** Sandalye yükseltmesinden sonra masa modelini yeni koltuk sayısıyla yeniler. */
  refreshTableVisual(id: string, rebuildNavigation = true): void {
    const st = this.byId.get(id);
    if (!st || st.def.kind !== 'table') return;
    if (rebuildNavigation) this.rebuildNav();
    if (!this.draw3d) return;
    const old = this.stationVisuals.get(id);
    if (old) {
      old.root.removeFromParent();
      old.dispose();
    }
    const visualDef = { ...st.def, seats: st.seats };
    const v = createStationVisual(visualDef, this.loc.palette);
    const lift = floorLiftAt(this.loc, st.x, st.z);
    v.root.position.set(st.x, lift, st.z);
    v.root.rotation.y = (st.def.rot * Math.PI) / 180;
    v.setLocked(st.locked);
    this.stationVisuals.set(id, v);
    this.root.add(v.root);
  }

  /**
   * Etkin müşteri tavanını tempodan türetir. Her kare çağrılır: tempo
   * sürekli değiştiği için kapasite de sürekli değişmeli.
   */
  private applyTempoCapacity(): void {
    const f = BALANCE.tempo.venueFloor;
    this.maxCustomers = Math.max(
      BALANCE.customers.minVenue,
      Math.round(this.venueCapacity * (f + this.tempo * (1 - f))),
    );
  }

  private kitchenSpeedFactor(): number {
    let sum = 0;
    let n = 0;
    for (const m of this.machines) {
      if (m.locked || !m.def.item || !isProduct(m.def.item)) continue;
      sum += 1 / stationSpeedMult(m.speedLevel);
      n++;
    }
    if (n === 0) return 1;
    return Math.pow(sum / n, 0.6);
  }

  /**
   * Saniyede beklenen gelir — TEORİK ÜST SINIR.
   *
   * Makinelerin üretim hızını fiyatla çarpar; sipariş tavanını, sandalye
   * sayısını ve müşteri sabrını görmez. Bu yüzden HUD göstergesi için
   * uygundur ama offline ödemesi için TEK BAŞINA kullanılamaz — bkz.
   * offlineIncomePerSecond().
   */
  estimateIncomePerSecond(): number {
    let total = 0;
    for (let i = 0; i < this.machines.length; i++) {
      const m = this.machines[i];
      if (!m.locked && m.def.item && isProduct(m.def.item)) {
        total += m.theoreticalRate() * this.itemValue(m.def.item);
      }
    }
    return total * this.state.saleMultiplier * clamp(this.automation, 0, 1);
  }

  /*
   * `offlineIncomePerSecond()` SİLİNDİ — ölü koddu.
   *
   * Offline PARA kazancı bilerek kaldırılmıştı (bkz. sim/Offline.ts) ama
   * bu fonksiyon ayrıntılı yorumuyla birlikte duruyor ve hiçbir yerden
   * çağrılmıyordu. Tek okuyucusu olduğu `prestigeOfflineMult` yüzünden de
   * prestij mağazasındaki "Gece Vardiyası" yükseltmesi sıfır etkili
   * görünüyordu; o çarpan artık dönüş stoğu tavanına bağlı (Offline.ts).
   * Ölü kodu bırakmak, ileride "zaten var" diye yanlış yere bağlanmasına
   * davetiye çıkarıyordu.
   */

  /* ============================================================ *
   *  Görünürlük / kayıt
   * ============================================================ */

  setActive(active: boolean): void {
    this.active = active;
    this.root.visible = active;
    if (!active) {
      for (let i = this.customers.length - 1; i >= 0; i--) {
        this.releaseCustomerHolds(this.customers[i]);
        this.customers[i].dispose();
      }
      this.customers.length = 0;
      for (const co of this.counters) co.queue.length = 0;
      for (const s of this.staff) s.clearJob();
    } else if (this.loc.id === 'kose' && this.customers.length === 0 && this.state.tutorialStep < 2) {
      const c = this.spawnCustomer('normal');
      if (c) {
        c.setPosition(3.0, 0.8);
        c.replan(this.nav);
      }
    }
  }

  save(): WorldSave {
    const stations: Record<string, StationSave> = {};
    for (const st of this.stations) stations[st.id] = st.save();
    const pads: Record<string, number> = {};
    for (const zone of this.loc.zones) {
      const paid = this.padProgress.get(zone.id) ?? 0;
      if (paid > 0 && !this.zoneUnlocked(zone.id)) pads[zone.id] = paid;
    }
    return {
      stations,
      spills: this.spills.save(),
      grime: this.grime.save(),
      hygiene: this.hygiene,
      income: this.realizedIncome,
      pads,
      sideActivities: this.sideActivities.snapshot(),
    };
  }

  load(s: Partial<WorldSave> | undefined): void {
    this.padProgress.clear();
    this.sideActivities.restore(s?.sideActivities);
    this.sideActivities.syncMenu(this.menuItems());
    this.syncSideArchitecture();
    if (!s?.stations) {
      this.syncLocks();
      return;
    }
    for (const st of this.stations) {
      st.load(s.stations[st.id]);
      if (st.def.kind === 'table' && st.capLevel > 0) this.refreshTableVisual(st.id, false);
    }
    this.spills.load(s.spills);
    this.grime.load(s.grime);
    if (s.pads) {
      for (const zone of this.loc.zones) {
        const paid = s.pads[zone.id];
        if (typeof paid === 'number' && Number.isFinite(paid) && paid > 0) {
          // Retain old-version deposits until the player claims the new price.
          this.padProgress.set(zone.id, paid);
        }
      }
    }
    if (typeof s.hygiene === 'number' && Number.isFinite(s.hygiene)) {
      this.hygiene = clamp(s.hygiene, 0, 100);
    }
    if (typeof s.income === 'number' && Number.isFinite(s.income) && s.income > 0) {
      // Ölçümü kayıttan devral: birikimleri 60 saniyelik bir geçmişmiş
      // gibi doldur ki oyun açılır açılmaz doğru hızı bilsin.
      this.realizedIncome = s.income;
      this.revenueTime = 60;
      this.revenueTotal = s.income * 60;
    }
    this.syncLocks();
  }

  /**
   * Kilitli bir bölümün açık bölümlere olan uzaklığı (0 = şimdi satın
   * alınabilir, 1 = ondan sonraki, …). Açık bölüm için -1.
   */
  private zoneDepth(zoneId: string): number {
    if (this.state.isZoneUnlocked(this.loc.id, zoneId)) return -1;
    let depth = 0;
    let cur = this.loc.zones.find((z) => z.id === zoneId);
    while (cur && cur.requires) {
      if (this.state.isZoneUnlocked(this.loc.id, cur.requires)) return depth;
      depth += 1;
      cur = this.loc.zones.find((z) => z.id === cur!.requires);
      if (depth > 16) break;
    }
    return depth;
  }

  /**
   * Bölüm, kilitli bir ODANIN içinde mi? Kapısı kapalı odanın içi
   * görünmez — duvarın ardındaki eşyayı brandalamak bile fazla bilgidir
   * ve "göz korkutan kalabalık" yaratır. Bölümün gereksinim zinciri
   * yukarı yürünür; odalı bir ata kilitliyse içerideyiz demektir.
   * (Yerleşim kuralı: bir odanın içindeki her bölüm, zincirde o odadan
   * SONRA gelir.)
   */
  private insideLockedRoom(zoneId: string): boolean {
    let cur = this.loc.zones.find((z) => z.id === zoneId);
    let hops = 0;
    while (cur && hops++ < 20) {
      if (cur.room && !this.state.isZoneUnlocked(this.loc.id, cur.id)) {
        // Odanın kendisi kilitliyse yalnız İÇİ gizlenir; oda bölümünün
        // kendi istasyonları da içeride sayılır (kapı ardında).
        return true;
      }
      cur = cur.requires ? this.loc.zones.find((z) => z.id === cur!.requires) : undefined;
    }
    return false;
  }

  private get padsUnlocked(): boolean {
    return this.loc.id !== 'kose' || this.state.tutorialStep >= TUTORIAL_STEP_COUNT - 1;
  }

  /** Next purchasable zone keeps a gray cover. Farther zones and locked rooms stay hidden. */
  private zoneVisibility(zoneId: string): 'open' | 'sheet' | 'hidden' {
    if (this.zoneUnlocked(zoneId)) return 'open';
    if (this.insideLockedRoom(zoneId)) return 'hidden';
    if (!this.padsUnlocked && this.padPaid(zoneId) <= 0) return 'hidden';
    return this.zoneDepth(zoneId) === 0 ? 'sheet' : 'hidden';
  }

  /**
   * Zone cover, plus a capped set of furniture one purchase further along
   * the open bar line and the first table row. VIP rooms and the far coast stay hidden.
   */
  private furnitureVisibility(st: { id: string; def: { zone: string } }): 'open' | 'sheet' | 'hidden' {
    const zone = this.zoneVisibility(st.def.zone);
    if (zone !== 'hidden') return zone;
    return this.nearCoverIds.has(st.id) ? 'sheet' : 'hidden';
  }

  /** Nearest locked bar/table pieces at depth 1. Rebuilt on nav, not per frame. */
  private refreshNearCovers(): void {
    this.nearCoverIds.clear();
    if (!this.padsUnlocked) return;
    const rowSlack = 0.5;
    let rowZ = 0;
    let rowKnown = false;
    let rowDist = Infinity;
    for (const st of this.stations) {
      if (st.def.kind !== 'table' || this.zoneDepth(st.def.zone) !== -1) continue;
      if (this.insideLockedRoom(st.def.zone)) continue;
      const d = Math.abs(st.z - this.loc.barZ);
      if (d < rowDist) {
        rowDist = d;
        rowZ = st.z;
        rowKnown = true;
      }
    }
    const start = this.loc.playerStart;
    const picks: { id: string; d: number }[] = [];
    for (const st of this.stations) {
      const depth = this.zoneDepth(st.def.zone);
      if (depth !== 1 || this.insideLockedRoom(st.def.zone)) continue;
      const onBar = (st.def.kind === 'pickup' || st.def.kind === 'counter')
        && Math.abs(st.z - this.loc.barZ) <= rowSlack;
      const onRow = rowKnown && st.def.kind === 'table' && Math.abs(st.z - rowZ) <= rowSlack;
      if (!onBar && !onRow) continue;
      const dx = st.x - start.x;
      const dz = st.z - start.z;
      picks.push({ id: st.id, d: dx * dx + dz * dz });
    }
    picks.sort((a, b) => a.d - b.d);
    const cap = 2;
    for (let i = 0; i < picks.length && this.nearCoverIds.size < cap; i++) this.nearCoverIds.add(picks[i].id);
  }

  syncLocks(): void {
    // Bölge açılınca mekânın müşteri kapasitesi de büyür.
    this.refreshCapacity();
    this.refreshValueBonus();
    this.refreshNearCovers();
    for (const st of this.stations) {
      const vis = this.furnitureVisibility(st);
      st.locked = vis !== 'open';
      const sheet = vis === 'sheet';
      this.stationVisuals.get(st.id)?.setLocked(st.locked, vis === 'hidden', sheet);
      this.pickupVisuals.get(st.id)?.setLocked(st.locked, vis === 'hidden', sheet);
    }
    this.visiblePadIds.clear();
    const available = this.loc.zones.filter(zone => zone.cost > 0 && this.zoneDepth(zone.id) === 0);
    // A funded purchase must remain visible across saves and price changes.
    for (const zone of available) if (this.padPaid(zone.id) > 0) this.visiblePadIds.add(zone.id);
    if (this.padsUnlocked) {
      for (const zone of available.sort((a,b) => a.cost-b.cost)) {
        if (this.visiblePadIds.size >= 2) break;
        this.visiblePadIds.add(zone.id);
      }
    }
    for (const zone of this.loc.zones) {
      const vis = this.zoneVisibility(zone.id);
      this.env?.setZoneUnlocked(zone.id, vis === 'open', false);
      // Ped YALNIZCA şimdi alınabilen bölümde yanar; bir sonrakinin eşyası
      // brandalı görünse de pedi görünmez, yoksa hangisine basacağı karışır.
      this.env?.setPadVisible(zone.id, this.visiblePadIds.has(zone.id));
      if (vis === 'open') this.padProgress.set(zone.id, zone.cost);
    }
    this.refreshSideBonuses();
    this.sideActivities.syncMenu(this.menuItems());
    this.syncSideArchitecture();
    this.rebuildNav();
    this.env?.optimizeStatic();
    this.rebuildGroundShadows();
  }

  private rebuildGroundShadows(): void {
    const batch = this.groundShadows;
    if (!batch) return;
    let i = 0;
    const DEG = Math.PI / 180;
    for (const st of this.stations) {
      if (this.furnitureVisibility(st) === 'hidden') continue;
      const lift = floorLiftAt(this.loc, st.x, st.z);
      const half = STATION_BODY[st.def.visual] ?? { x: 0.9, z: 0.5 };
      batch.set(i, st.x, lift + 0.042, st.z, half.x * 2, half.z * 2, st.def.rot * DEG);
      i++;
    }
    batch.setCount(i);
  }

  dispose(): void {
    for (const c of this.customers) c.dispose();
    this.customers.length = 0;
    for (const s of this.staff) s.dispose();
    this.staff.length = 0;
    for (const v of this.stationVisuals.values()) v.dispose();
    for (const v of this.pickupVisuals.values()) v.dispose();
    this.spillView?.dispose();
    this.grimeView?.dispose();
    this.armRing?.dispose();
    for (const pad of this.staffHirePads.values()) pad.dispose();
    this.staffHirePads.clear();
    for (const view of this.sideWorkViews.values()) view.dispose();
    for (const pad of this.sidePurchasePads.values()) pad.dispose();
    this.sideWorkViews.clear(); this.sidePurchasePads.clear();
    /**
     * Yol gösterici ve temas gölgesi de bırakılır. Eskiden atlanıyorlardı:
     * `doPrestige` her dünyayı dispose edip yeniden kurduğu için her
     * devirde bir etiket dokusu (GuideMarker) ve bir gölge dokusu
     * (ContactShadows) sızıyordu — küçük ama birikimli.
     */
    this.guide?.dispose();
    this.contact?.dispose();
    this.groundShadows?.dispose();
    this.env?.dispose();
    this.root.removeFromParent();
  }
}

/* ==================================================================== */

const STAFF_HIRE_ROLES: readonly StaffRole[] = ['cashier', 'waiter', 'busser', 'barista'];
const SUPPLY_SCRATCH: { item: ItemId; count: number; cap: number }[] = [];
const SUPPLY_POOL: { item: ItemId; count: number; cap: number }[] = [];
/** findFreeTable aday tamponu — her çağrıda yeniden kullanılır. */
const TABLE_PICK: StationEntity[] = [];
const TABLE_SCRATCH: { item: ItemId; count: number; cap: number }[] = [];
const TABLE_POOL: { item: ItemId; count: number; cap: number }[] = [];
const TABLE_COUNTS = new Map<ItemId, number>();

function queueOf(co: StationEntity): Customer[] {
  return co.queue as Customer[];
}

function guestsOf(t: StationEntity): Customer[] {
  return t.seatedGuests as Customer[];
}

/**
 * Keep a straight eastbound walk through the cashier hire square.
 * Thick furniture loses only the overlapping east-west span, so no narrow
 * slot is cut through a counter. A thin wall east of the square keeps a lip
 * and stays closed.
 */
function rectsExceptHireCrossing(
  x0: number, z0: number, x1: number, z1: number,
  pad: { x: number; z: number },
): Array<[number, number, number, number]> {
  const loX = Math.min(x0, x1), hiX = Math.max(x0, x1);
  const loZ = Math.min(z0, z1), hiZ = Math.max(z0, z1);
  const clear = BALANCE.player.radius + 0.06;
  const cut = {
    x0: pad.x - 1.4 - clear,
    x1: pad.x + 1 + clear,
    z0: pad.z - clear,
    z1: pad.z + clear,
  };
  const overlapX = Math.min(hiX, cut.x1) - Math.max(loX, cut.x0);
  const overlapZ = Math.min(hiZ, cut.z1) - Math.max(loZ, cut.z0);
  if (overlapX <= 1e-4 || overlapZ <= 1e-4) return [[loX, loZ, hiX, hiZ]];
  const parts: Array<[number, number, number, number]> = [];
  const thinX = hiX - loX < 0.5;
  if (thinX && loX > pad.x - 0.2) {
    const face = Math.min(cut.x1, hiX - 0.08);
    if (face > loX + 1e-4 && face < hiX - 1e-4) {
      if (loZ < cut.z0 - 1e-4) parts.push([loX, loZ, hiX, Math.min(hiZ, cut.z0)]);
      if (hiZ > cut.z1 + 1e-4) parts.push([loX, Math.max(loZ, cut.z1), hiX, hiZ]);
      parts.push([face, Math.max(loZ, cut.z0), hiX, Math.min(hiZ, cut.z1)]);
      return parts;
    }
  }
  if (loX < cut.x0 - 1e-4) parts.push([loX, loZ, Math.min(hiX, cut.x0), hiZ]);
  if (hiX > cut.x1 + 1e-4) parts.push([Math.max(loX, cut.x1), loZ, hiX, hiZ]);
  return parts;
}

/**
 * Engel YARI-boyutları = görsel gövdenin kendisi (`STATION_BODY`), istasyonun
 * kendi dönüşü uygulanmış hâlde. 90°/270° dönmüş bir tezgâhta x ve z yer
 * değiştirir; eskiden bu yok sayıldığı için döndürülmüş istasyonların kutusu
 * gövdeyle çapraz duruyordu.
 */
function footprint(st: StationEntity): { x: number; z: number } {
  const b = STATION_BODY[st.def.visual] ?? { x: 0.9, z: 0.5 };
  const q = Math.round(((st.def.rot % 360) + 360) / 90) % 4;
  return q === 1 || q === 3 ? { x: b.z, z: b.x } : { x: b.x, z: b.z };
}

const formatShort = formatCompactMoney;

export { CUSTOMER_ARCHETYPES };
