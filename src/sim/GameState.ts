import { bus } from '../core/EventBus';
import type { DailyMissionSave } from './Daily';
import { BALANCE } from '../data/balance';
import { BRANCH_STAFF_MULTIPLIER } from '../data/economy';
export { BRANCH_STAFF_MULTIPLIER };
import type { ItemId } from '../data/items';
import { clamp, lerp } from '../core/MathUtils';
import {
  charmMult,
  handsInterval,
  offlineCapHours,
  playerCapacity,
  playerSpeed,
  PLAYER_UPGRADE_MAP,
  upgradeCost,
  type PlayerUpgradeId,
} from '../data/upgrades';
import { hireCost, staffLevelCost, STAFF_ROLE_MAP, type StaffRole } from '../data/staff';
import { KOSE, LOCATIONS } from '../data/layouts';
import { stationsAt } from '../data/stations';
import {
  COSMETIC_AXES,
  cosmeticById,
  cosmeticKey,
  cosmeticOptions,
  defaultCosmetic,
  type CosmeticAxis,
} from '../data/cosmetics';

/** Bedava açılan bölgeler — yeni oyunda ve prestij sonrası hep açıktır. */
const KOSE_FREE_ZONES = KOSE.zones.filter((z) => z.cost <= 0).map((z) => z.id);
const STAFF_LOCATION_CAPS: Record<string, Record<StaffRole, number>> = {
  kose: { waiter: 5, cashier: 2, barista: 5, busser: 3 },
  sahil: { waiter: 3, cashier: 2, barista: 3, busser: 3 },
};
const ZONE_KEYS = new Map<string, Map<string, string>>();

export interface StaffHireDeposit {
  /** Deposit belongs to this next employee, never a later price tier. */
  count: number;
  paid: number;
}

export interface GameStateSave {
  money: number;
  totalEarned: number;
  /** v10: yalnız gerçek satış/aktif temizlik/offline işletme geliri. */
  revenueEarned?: number;
  reputation: number;
  upgrades: Partial<Record<PlayerUpgradeId, number>>;
  staffCount: Partial<Record<StaffRole, number>>;
  staffLevel: Partial<Record<StaffRole, number>>;
  /** v9: her şubenin kendi kadrosu. Eski iki alan aktif şube yedeğidir. */
  staffByLocation?: Record<string, Partial<Record<StaffRole, number>>>;
  staffLevelByLocation?: Record<string, Partial<Record<StaffRole, number>>>;
  staffHireDeposits?: Record<string, Partial<Record<StaffRole, StaffHireDeposit>>>;
  zones: string[];
  locations: string[];
  seenLocations?: string[];
  activeLocation: string;
  goalIndex: number;
  goalProgress: number;
  /** Sonsuz hedeflerin kümülatif sayaç tabanı (bkz. Goals.endlessGoal). */
  goalBase?: number;
  prestigePoints?: number;
  prestigeCount?: number;
  prestigeLevels?: Record<string, number>;
  dailyDay?: string;
  dailyStreak?: number;
  dailyClaimed?: boolean;
  vacuumHinted?: boolean;
  upgradeOnboarded?: boolean;
  staffOnboarded?: boolean;
  dailyMissionDone?: boolean[];
  dailyMissions?: DailyMissionSave[];
  dailyBase?: Record<string, number>;
  /* ---- v5.1 sadakat katmanı ---- */
  regularVisits?: Record<string, number>;
  regularMilestones?: Record<string, number>;
  coupons?: number;
  weekKey?: string;
  weekBase?: number;
  weekClaimed?: boolean;
  festivalWeek?: string;
  festivalBase?: number;
  festivalClaimed?: boolean;
  festivalGoalId?: string;
  festivalGoalTarget?: number;
  /** Reklam ödülü kalan süreleri — uygulama kapanınca buharlaşmasın. */
  adBuffs?: Record<string, number>;
  /* ---- v5.2: dönemsel hedeflerin kendi geçmişi ---- */
  /** Dünkü GERÇEKLEŞEN günlük sayaçlar (bugünkü hedefi kalibre eder). */
  dailyPrevDone?: Record<string, number>;
  /** Geçen hafta servis edilen ürün. */
  weekPrevServed?: number;
  /**
   * Geçen ÜRÜN festivalinde satılan adet. Yalnız ürün türü kendi
   * geçmişini tutar (bkz. Festival.festivalTarget) — temizlik
   * `weekPrevServed`'i kullanır, ayrı bir alana ihtiyacı yok. Misafir dalı
   * ise SABİT 12 döner (arz tavanlı, servis hacmiyle ölçeklenemez — bkz.
   * festivalTarget içindeki misafir yorumu); o da ayrı bir alana ihtiyaç
   * duymaz.
   */
  festPrevItem?: number;
  /** Real-day key for the in-play tip / found-change surprise. */
  changeDay?: string;
  changeCount?: number;
  /** playTime of the last surprise, so a reload cannot skip the gap. */
  changeAt?: number;
  stats: {
    sold: number;
    orders: number;
    served: number;
    dashers: number;
    angry: number;
    stationUpgrades: number;
    cleaned: number;
    tablesCleaned?: number;
    mopped: number;
    refills: number;
    produced: Partial<Record<ItemId, number>>;
    sale: Partial<Record<ItemId, number>>;
  };
  /** Son devirdeki kümülatif sayaç tabanları (bkz. statsBase). */
  statsBase?: Partial<Record<CounterStatKey, number>>;
  playTime: number;
  tutorialStep: number;
  /** Eksen → seçili kozmetik kimliği. Yoksa varsayılan (bkz. load). */
  cosmetics?: Partial<Record<CosmeticAxis, string>>;
  /** Satın alınmış kozmetikler, "eksen:kimlik" biçiminde. */
  cosmeticsOwned?: string[];
}

/** Hedeflerin okuduğu, prestijde tabanlanması gereken kümülatif sayaçlar. */
export type CounterStatKey = 'served' | 'tablesCleaned' | 'cleaned' | 'mopped' | 'refills' | 'dashers' | 'stationUpgrades';
export const COUNTER_STAT_KEYS: readonly CounterStatKey[] = [
  'served',
  'cleaned',
  'tablesCleaned',
  'mopped',
  'refills',
  'dashers',
  'stationUpgrades',
];

/** Kalıcı oyun durumu. Görsel hiçbir şey içermez → kayıt/yükleme kolay. */
export class GameState {
  money = 0;
  totalEarned = 0;
  revenueEarned = 0;
  reputation: number = BALANCE.reputation.start;

  upgrades: Record<PlayerUpgradeId, number> = {
    speed: 0,
    capacity: 0,
    hands: 0,
    charm: 0,
    vault: 0,
  };

  staffCount: Record<StaffRole, number> = { waiter: 0, cashier: 0, barista: 0, busser: 0 };
  staffLevel: Record<StaffRole, number> = { waiter: 0, cashier: 0, barista: 0, busser: 0 };
  private staffByLocation: Record<string, Record<StaffRole, number>> = { kose: this.staffCount };
  private staffLevelByLocation: Record<string, Record<StaffRole, number>> = { kose: this.staffLevel };
  private staffHireDeposits: Record<string, Partial<Record<StaffRole, StaffHireDeposit>>> = {};

  /** "kose:a1" biçiminde anahtarlar */
  unlockedZones = new Set<string>();
  unlockedLocations = new Set<string>(['kose']);
  seenLocations = new Set<string>(['kose']);
  activeLocation = 'kose';

  goalIndex = 0;
  goalProgress = 0;
  /**
   * Hedef zinciri bittikten sonra üretilen hedefler kümülatif sayaçları
   * kullanır; bu alan o sayacın hedef başladığı andaki değerini tutar.
   */
  goalBase = 0;

  /* ---------------- prestij (bkz. data/prestige.ts) ---------------- */
  /** Harcanmamış Fincan Puanı. */
  prestigePoints = 0;
  /** Kaç kez devredildi — arayüzde "tur" olarak gösterilir. */
  prestigeCount = 0;
  prestigeLevels: Record<string, number> = {};

  /** Kalıcı kazanç çarpanı (Sokağın İtibarı). Katsayı prestige.ts `step` ile aynı olmalı. */
  get prestigeGainMult(): number {
    return 1 + (this.prestigeLevels.gain ?? 0) * 0.2;
  }
  /** Kalıcı istasyon hız çarpanı — SÜRE çarpanı, küçüldükçe hızlı. */
  get prestigeSpeedMult(): number {
    return Math.pow(1 - 0.04, this.prestigeLevels.speed ?? 0);
  }
  get prestigeOfflineMult(): number {
    return 1 + (this.prestigeLevels.offline ?? 0) * 0.08;
  }
  get prestigeFlowMult(): number {
    return 1 + (this.prestigeLevels.charm ?? 0) * 0.06;
  }
  get prestigeStartMoney(): number {
    return (this.prestigeLevels.start ?? 0) * 2500;
  }

  /* ---------------- günlük döngü (bkz. sim/Daily.ts) ---------------- */
  /** Son işlenen yerel gün, 'YYYY-MM-DD'. Boş = hiç açılmadı. */
  dailyDay = '';
  /** Arka arkaya giriş serisi (0-6). Kırılınca sıfırlanır, ceza yoktur. */
  dailyStreak = 0;
  dailyClaimed = false;
  /**
   * SÜPÜRGE TANITIMI YAPILDI MI (tek seferlik).
   *
   * Süpürge oyunun en keşfedilmeyen mekaniğiydi: rehber oku onu yalnız
   * "servis işi YOKKEN" öneriyor (bkz. World.pickGuideTarget) ve geç
   * oyunda kafe hiç boşalmadığı için ok fiilen hiç oraya bakmıyor.
   * Yani mekanik var, oyuncu farkında değil — sessiz bir kayıp.
   */
  vacuumHinted = false;
  upgradeOnboarded = false;
  staffOnboarded = false;
  dailyMissionDone: boolean[] = [false, false, false];
  /** Frozen identities and targets for dailyDay; empty in legacy saves. */
  dailyMissions: DailyMissionSave[] = [];
  /** Günün başındaki kümülatif sayaçlar — görevler farkı ölçer. */
  dailyBase: Record<string, number> = {};
  /* ---- v5.1 sadakat katmanı ---- */
  /** Müdavim Albümü: müdavim başına tamamlanan ziyaret sayısı. */
  regularVisits: Record<string, number> = {};
  /** Müdavim başına ödülü ALINMIŞ kilometre taşı sayısı (0-3). */
  regularMilestones: Record<string, number> = {};
  /** Kozmetik indirim kuponları (yalnız Dekorasyon panelinde geçer). */
  coupons = 0;
  /** Haftalık hedef: ISO hafta anahtarı + hafta başındaki served tabanı. */
  weekKey = '';
  weekBase = 0;
  weekClaimed = false;
  /** Festival: hafta anahtarı + festival sayacının hafta başı tabanı. */
  festivalWeek = '';
  festivalBase = 0;
  festivalClaimed = false;
  festivalGoalId = '';
  festivalGoalTarget = 0;
  /** Reklam ödülü kalan süreleri (happy/robot/usta/tip/shield/rush). */
  adBuffs: Record<string, number> = {};

  /**
   * v5.2 — DÖNEMSEL HEDEFLER KENDİ GEÇMİŞİNE GÖRE KALİBRE OLUR.
   *
   * Eski ölçek `sqrt(served/60)` idi: karekök sönümü, üretim doğrusal
   * artarken hedefi ZAMANLA KOLAYLAŞTIRIYORDU. Ölçüldü (2026-08-15):
   * "haftalık" hedefi boştaki kafe 40 dakikada bitiriyordu.
   *
   * Yeni kural: hedef = 0,9 × geçen dönemin GERÇEKLEŞENİ. Böylece hedef
   * her zaman oyuncunun kendi temposunun ~%90'ı olur ve kafe büyüdükçe
   * kendiliğinden büyür; sihirli sabit kalmaz.
   */
  dailyPrevDone: Record<string, number> = {};
  weekPrevServed = 0;
  festPrevItem = 0;
  /** Happy-customer surprise: day key, awards today, playTime of the last one. */
  changeDay = '';
  changeCount = 0;
  changeAt = 0;

  bumpRegularVisit(id: string): void {
    this.regularVisits[id] = (this.regularVisits[id] ?? 0) + 1;
  }

  stats = {
    /** Servis edilen toplam ürün adedi (satış kalemi) */
    sold: 0,
    /** Tamamlanan sipariş sayısı */
    orders: 0,
    /** Masaya taşınan ürün adedi */
    served: 0,
    /** Yakalanan kaçak müşteri */
    dashers: 0,
    /** Küsüp çıkan müşteri — denge ölçümünün en önemli sayacı */
    angry: 0,
    stationUpgrades: 0,
    /** Oyuncunun topladığı bulaşık */
    cleaned: 0,
    tablesCleaned: 0,
    /** Silinen zemin lekesi */
    mopped: 0,
    /** Tuvalete konan sarf malzemesi */
    refills: 0,
    produced: {} as Partial<Record<ItemId, number>>,
    sale: {} as Partial<Record<ItemId, number>>,
  };

  /**
   * İstatistikler ömür boyudur ve prestijde SIFIRLANMAZ; ama hedef zinciri
   * devirde başa sarar. Taban alınmazsa serve/clean/mop/refill/dasher/
   * stationLevel hedefleri sıra kendilerine gelir gelmez otomatik tamamlanır
   * ve devir turu bedava ödül zincirine döner (tek başına g29 = 1,1M).
   * Hedefler bu tabanı düşerek okur (Goals.rawValue).
   */
  statsBase: Record<CounterStatKey, number> = {
    served: 0,
    cleaned: 0,
    tablesCleaned: 0,
    mopped: 0,
    refills: 0,
    dashers: 0,
    stationUpgrades: 0,
  };

  /** Hedeflerin gördüğü, devir tabanı düşülmüş sayaç değeri. */
  statSinceReset(key: CounterStatKey): number {
    return Math.max(0, this.stats[key] - this.statsBase[key]);
  }

  playTime = 0;
  tutorialStep = 0;

  /* ---------------- kozmetik (bkz. data/cosmetics.ts) ---------------- */
  /**
   * Seçili görünüm — eksen başına bir kimlik. GÖRSELDİR: hiçbir okuyucusu
   * hız/gelir/sabır/hijyen hesaplamaz (bkz. cosmetics.ts, kural 1).
   */
  cosmetics: Record<CosmeticAxis, string> = {
    wall: defaultCosmetic('wall'),
    floor: defaultCosmetic('floor'),
    table: defaultCosmetic('table'),
    uniform: defaultCosmetic('uniform'),
  };
  /** Satın alınmış görünümler. Ücretsizler (cost 0) burada TUTULMAZ. */
  cosmeticsOwned = new Set<string>();

  constructor() {
    this.unlockedZones.add('kose:a1');
  }

  /* ---------------- kozmetik ---------------- */

  ownsCosmetic(axis: CosmeticAxis, id: string): boolean {
    return cosmeticById(axis, id).cost <= 0 || this.cosmeticsOwned.has(cosmeticKey(axis, id));
  }

  /**
   * Satın alma. Başarılıysa SEÇİM DE YAPILIR — oyuncu parayı görünümü
   * hemen görmek için veriyor; ayrı bir "şimdi seç" adımı ödülü geciktirir.
   */
  buyCosmetic(axis: CosmeticAxis, id: string): boolean {
    const def = cosmeticOptions(axis).find((o) => o.id === id);
    if (!def) return false;
    if (this.ownsCosmetic(axis, id)) return this.selectCosmetic(axis, id);
    if (!this.spend(def.cost)) return false;
    this.cosmeticsOwned.add(cosmeticKey(axis, id));
    this.cosmetics[axis] = id;
    bus.emit('cosmetic:changed', { axis, id, bought: true });
    return true;
  }

  selectCosmetic(axis: CosmeticAxis, id: string): boolean {
    if (!this.ownsCosmetic(axis, id)) return false;
    if (this.cosmetics[axis] === id) return false;
    this.cosmetics[axis] = id;
    bus.emit('cosmetic:changed', { axis, id, bought: false });
    return true;
  }

  /* ---------------- para ---------------- */

  canAfford(v: number): boolean {
    return this.money >= v;
  }

  spend(v: number): boolean {
    if (this.money < v) return false;
    this.money -= v;
    bus.emit('money:spend', { amount: v });
    bus.emit('money:changed', { total: this.money });
    return true;
  }

  /** Satıştan/ödülden gelen para. `x/z` verilirse dünyada uçan yazı gösterilir. */
  earn(v: number, x?: number, z?: number, y?: number): void {
    if (v <= 0) return;
    this.money += v;
    this.totalEarned += v;
    this.revenueEarned += v;
    if (x !== undefined && z !== undefined) bus.emit('money:earn', { amount: v, x, z, y });
    bus.emit('money:changed', { total: this.money });
  }

  /** Hedef/günlük/reklam hediyesi işletme geliri ve prestiji şişirmez. */
  grant(v: number, x?: number, z?: number, y?: number): void {
    if (v <= 0) return;
    this.money += v;
    if (x !== undefined && z !== undefined) bus.emit('money:earn', { amount: v, x, z, y });
    bus.emit('money:changed', { total: this.money });
  }

  /* ---------------- itibar ---------------- */

  get repRatio(): number {
    const r = BALANCE.reputation;
    return clamp((this.reputation - r.min) / (r.max - r.min), 0, 1);
  }

  get repMultiplier(): number {
    const r = BALANCE.reputation;
    return lerp(r.minMult, r.maxMult, this.repRatio);
  }

  addReputation(v: number): void {
    const r = BALANCE.reputation;
    const next = clamp(this.reputation + v, r.min, r.max);
    if (next !== this.reputation) {
      this.reputation = next;
      bus.emit('reputation:changed', { value: next });
    }
  }

  /* ---------------- oyuncu yükseltmeleri ---------------- */

  get playerSpeed(): number {
    return playerSpeed(this.upgrades.speed);
  }

  get playerCapacity(): number {
    return playerCapacity(this.upgrades.capacity);
  }

  get handInterval(): number {
    return handsInterval(this.upgrades.hands);
  }

  /** Satış çarpanı: cazibe × itibar */
  get saleMultiplier(): number {
    // Prestij çarpanı KALICIDIR: devretmede sıfırlanmaz, her turu hızlandırır.
    return charmMult(this.upgrades.charm) * this.repMultiplier * this.prestigeGainMult;
  }

  get offlineCapSeconds(): number {
    return offlineCapHours(this.upgrades.vault) * 3600;
  }

  /**
   * Prestij sıfırlaması. Kafe baştan kurulur ama Fincan Puanı, alınan
   * kalıcı yükseltmeler ve günlük seri KORUNUR.
   */
  prestigeReset(gained: number): void {
    this.prestigePoints += gained;
    this.prestigeCount++;
    this.money = this.prestigeStartMoney;
    this.totalEarned = 0;
    this.revenueEarned = 0;
    this.unlockedZones.clear();
    // Bedava bölgeler (cost 0) yeniden açılır; aksi hâlde devirden sonra
    // hiçbir istasyon açık olmaz ve oyun oynanamaz hâle gelir.
    for (const z of KOSE_FREE_ZONES) this.unlockedZones.add(`kose:${z}`);
    this.unlockedLocations = new Set(['kose']);
    this.activeLocation = 'kose';
    this.staffCount = this.emptyStaff();
    this.staffLevel = this.emptyStaff();
    this.staffByLocation = { kose: this.staffCount };
    this.staffLevelByLocation = { kose: this.staffLevel };
    this.staffHireDeposits = {};
    this.upgrades = { speed: 0, capacity: 0, hands: 0, charm: 0, vault: 0 };
    this.reputation = 70;
    this.goalIndex = 0;
    this.goalProgress = 0;
    this.goalBase = 0;
    // İstatistikler ömür boyudur; sıfırlanmaz (başarımlar ve görevler onları
    // kullanır). Hedef zinciri için o anki değerleri TABAN olarak dondur.
    for (const k of COUNTER_STAT_KEYS) this.statsBase[k] = this.stats[k];
    /**
     * KOZMETİKLER DEVİRDE KALIR — bilinçli.
     *
     * Görünümler oyunu hiç etkilemediği için sıfırlanmalarının denge
     * gerekçesi yok; geriye yalnız ceza kalırdı ("asla cezalandırma").
     * Üstelik kozmetik geç oyunun para gideri: her turda yeniden satın
     * aldırmak onu bir gidere değil bir vergiye çevirir. `cosmetics` ve
     * `cosmeticsOwned` bu yüzden burada HİÇ ELLENMEZ.
     */
  }

  playerUpgradeCost(id: PlayerUpgradeId): number {
    return upgradeCost(PLAYER_UPGRADE_MAP[id], this.upgrades[id]);
  }

  canBuyPlayerUpgrade(id: PlayerUpgradeId): boolean {
    const def = PLAYER_UPGRADE_MAP[id];
    return this.upgrades[id] < def.maxLevel && this.canAfford(this.playerUpgradeCost(id));
  }

  buyPlayerUpgrade(id: PlayerUpgradeId, free = false): boolean {
    const def = PLAYER_UPGRADE_MAP[id];
    if (this.upgrades[id] >= def.maxLevel) return false;
    if (!free && !this.spend(this.playerUpgradeCost(id))) return false;
    this.upgrades[id]++;
    this.upgradeOnboarded = true;
    bus.emit('upgrade:bought', { kind: 'player', id, level: this.upgrades[id] });
    return true;
  }

  /* ---------------- personel ---------------- */

  private emptyStaff(): Record<StaffRole, number> {
    return { waiter: 0, cashier: 0, barista: 0, busser: 0 };
  }

  staffCountAt(location: string): Record<StaffRole, number> {
    return (this.staffByLocation[location] ??= this.emptyStaff());
  }

  staffLevelAt(location: string): Record<StaffRole, number> {
    return (this.staffLevelByLocation[location] ??= this.emptyStaff());
  }

  /** UI ve satın alma işlemlerini bulunulan şubenin kadrosuna bağlar. */
  useStaffLocation(location: string): void {
    this.staffCount = this.staffCountAt(location);
    this.staffLevel = this.staffLevelAt(location);
  }

  hireTotalCostFor(role: StaffRole, location = this.activeLocation): number {
    const branchMult = location === 'sahil' ? BRANCH_STAFF_MULTIPLIER : 1;
    return Math.round(hireCost(STAFF_ROLE_MAP[role], this.staffCountAt(location)[role]) * branchMult);
  }

  hirePaidFor(role: StaffRole, location = this.activeLocation): number {
    const deposit = this.staffHireDeposits[location]?.[role];
    if (!deposit || deposit.count !== this.staffCountAt(location)[role]) return 0;
    return Math.min(this.hireTotalCostFor(role, location), Math.max(0, deposit.paid));
  }

  /** Menu and world pads share exactly the same outstanding price. */
  hireCostFor(role: StaffRole): number {
    return Math.max(0, Math.round((this.hireTotalCostFor(role) - this.hirePaidFor(role)) * 1000) / 1000);
  }

  /** Pay a small part from the actual wallet; completion uses the normal hire path. */
  payStaffHire(role: StaffRole, amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0 || !this.staffRoleUnlocked(role) ||
      this.staffCount[role] >= this.activeStaffCapFor(role)) return 0;
    const remaining = this.hireCostFor(role);
    if (remaining <= 0) { this.hire(role, 'pad'); return 0; }
    const paid = Math.min(remaining, Math.floor(amount * 1000) / 1000, Math.max(0, this.money));
    if (paid <= 0 || !this.spend(paid)) return 0;
    const deposits = (this.staffHireDeposits[this.activeLocation] ??= {});
    deposits[role] = {
      count: this.staffCount[role],
      paid: Math.round((this.hirePaidFor(role) + paid) * 1000) / 1000,
    };
    if (this.hireCostFor(role) <= 0) this.hire(role, 'pad');
    return paid;
  }

  staffCapFor(role: StaffRole): number {
    return this.staffCapAt(this.activeLocation, role);
  }

  /** Satın alınabilir kadro, gerçekten açık iş noktalarının sayısını aşmaz. */
  activeStaffCapFor(role: StaffRole, location = this.activeLocation): number {
    // Read by hire pads every frame: count in place instead of filter chains.
    const kind = role === 'cashier' ? 'counter' : role === 'waiter' ? 'pickup' : role === 'barista' ? 'machine' : 'table';
    let open = 0;
    for (const st of stationsAt(location)) if (st.kind === kind && this.isZoneUnlocked(location, st.zone)) open++;
    const jobs = role === 'cashier' ? open : Math.ceil(open / (role === 'busser' ? 4 : 2));
    return Math.min(this.staffCapAt(location, role), Math.max(0, jobs));
  }

  private staffCapAt(location: string, role: StaffRole): number {
    return Math.min(STAFF_ROLE_MAP[role].maxCount, STAFF_LOCATION_CAPS[location]?.[role] ?? STAFF_ROLE_MAP[role].maxCount);
  }

  staffRoleUnlocked(role: StaffRole, location = this.activeLocation): boolean {
    if (location === 'sahil') return this.isLocationUnlocked('sahil');
    if (role === 'waiter' || role === 'cashier') return this.isZoneUnlocked('kose', 'a1');
    if (role === 'busser') return this.isZoneUnlocked('kose', 't1');
    return this.isZoneUnlocked('kose', 'a3');
  }

  canHire(role: StaffRole): boolean {
    return (
      this.staffRoleUnlocked(role) &&
      this.staffCount[role] < this.activeStaffCapFor(role) &&
      this.canAfford(this.hireCostFor(role))
    );
  }

  hire(role: StaffRole, method: 'pad' | 'menu' = 'menu', free = false): boolean {
    if (!this.staffRoleUnlocked(role) || this.staffCount[role] >= this.activeStaffCapFor(role)) return false;
    const totalCost = this.hireTotalCostFor(role);
    if (!free && !this.spend(this.hireCostFor(role))) return false;
    delete this.staffHireDeposits[this.activeLocation]?.[role];
    this.staffCount[role]++;
    this.staffOnboarded = true;
    bus.emit('staff:hired', {
      role,
      count: this.staffCount[role],
      location: this.activeLocation,
      totalCost,
      method,
    });
    return true;
  }

  staffLevelCostFor(role: StaffRole): number {
    const branchMult = this.activeLocation === 'sahil' ? BRANCH_STAFF_MULTIPLIER : 1;
    return Math.round(staffLevelCost(STAFF_ROLE_MAP[role], this.staffLevel[role]) * branchMult);
  }

  canLevelStaff(role: StaffRole): boolean {
    const def = STAFF_ROLE_MAP[role];
    return (
      this.staffCount[role] > 0 &&
      this.staffLevel[role] < def.maxLevel &&
      this.canAfford(this.staffLevelCostFor(role))
    );
  }

  levelStaff(role: StaffRole, free = false): boolean {
    const def = STAFF_ROLE_MAP[role];
    if (this.staffCount[role] <= 0 || this.staffLevel[role] >= def.maxLevel) return false;
    if (!free && !this.spend(this.staffLevelCostFor(role))) return false;
    this.staffLevel[role]++;
    this.staffOnboarded = true;
    bus.emit('upgrade:bought', { kind: 'staff', id: role, level: this.staffLevel[role] });
    return true;
  }

  /* ---------------- kilitler ---------------- */

  zoneKey(location: string, zone: string): string {
    // Every station asks this every frame; reuse one string per pair.
    let byZone = ZONE_KEYS.get(location);
    if (!byZone) ZONE_KEYS.set(location, byZone = new Map());
    let key = byZone.get(zone);
    if (key === undefined) byZone.set(zone, key = `${location}:${zone}`);
    return key;
  }

  isZoneUnlocked(location: string, zone: string): boolean {
    return this.unlockedZones.has(this.zoneKey(location, zone));
  }

  unlockZone(location: string, zone: string, name: string, method: 'pad' | 'menu' | 'unknown' = 'unknown'): void {
    const key = this.zoneKey(location, zone);
    if (this.unlockedZones.has(key)) return;
    this.unlockedZones.add(key);
    bus.emit('zone:unlocked', { location, zone, name, method });
  }

  isLocationUnlocked(id: string): boolean {
    return this.unlockedLocations.has(id);
  }

  /** Buying a branch includes its free starter bar; paid areas stay locked. */
  unlockLocation(id: string): void {
    const location = LOCATIONS[id];
    if (!location) return;
    this.unlockedLocations.add(id);
    for (const zone of location.zones) if (zone.cost <= 0)
      this.unlockedZones.add(this.zoneKey(id, zone.id));
  }

  /* ---------------- istatistik ---------------- */

  addProduced(item: ItemId, n = 1): void {
    this.stats.produced[item] = (this.stats.produced[item] ?? 0) + n;
  }

  addSale(item: ItemId, n = 1): void {
    this.stats.sale[item] = (this.stats.sale[item] ?? 0) + n;
    this.stats.sold += n;
  }

  /* ---------------- kayıt ---------------- */

  save(): GameStateSave {
    return {
      money: this.money,
      totalEarned: this.totalEarned,
      revenueEarned: this.revenueEarned,
      reputation: this.reputation,
      upgrades: { ...this.upgrades },
      staffCount: { ...this.staffCount },
      staffLevel: { ...this.staffLevel },
      staffByLocation: Object.fromEntries(
        Object.entries(this.staffByLocation).map(([id, v]) => [id, { ...v }]),
      ),
      staffLevelByLocation: Object.fromEntries(
        Object.entries(this.staffLevelByLocation).map(([id, v]) => [id, { ...v }]),
      ),
      staffHireDeposits: Object.fromEntries(Object.entries(this.staffHireDeposits).map(([location, deposits]) => [
        location, Object.fromEntries(Object.entries(deposits).map(([role, deposit]) => [role, { ...deposit }])),
      ])),
      zones: [...this.unlockedZones],
      locations: [...this.unlockedLocations],
      seenLocations: [...this.seenLocations],
      activeLocation: this.activeLocation,
      goalIndex: this.goalIndex,
      goalProgress: this.goalProgress,
      goalBase: this.goalBase,
      prestigePoints: this.prestigePoints,
      prestigeCount: this.prestigeCount,
      prestigeLevels: { ...this.prestigeLevels },
      dailyDay: this.dailyDay,
      dailyStreak: this.dailyStreak,
      dailyClaimed: this.dailyClaimed,
      vacuumHinted: this.vacuumHinted,
      upgradeOnboarded: this.upgradeOnboarded,
      staffOnboarded: this.staffOnboarded,
      dailyMissionDone: [...this.dailyMissionDone],
      dailyMissions: this.dailyMissions.map((mission) => ({ ...mission })),
      dailyBase: { ...this.dailyBase },
      regularVisits: { ...this.regularVisits },
      regularMilestones: { ...this.regularMilestones },
      coupons: this.coupons,
      weekKey: this.weekKey,
      weekBase: this.weekBase,
      weekClaimed: this.weekClaimed,
      festivalWeek: this.festivalWeek,
      festivalBase: this.festivalBase,
      festivalClaimed: this.festivalClaimed,
      festivalGoalId: this.festivalGoalId,
      festivalGoalTarget: this.festivalGoalTarget,
      adBuffs: { ...this.adBuffs },
      dailyPrevDone: { ...this.dailyPrevDone },
      weekPrevServed: this.weekPrevServed,
      festPrevItem: this.festPrevItem,
      changeDay: this.changeDay,
      changeCount: this.changeCount,
      changeAt: this.changeAt,
      stats: {
        sold: this.stats.sold,
        orders: this.stats.orders,
        served: this.stats.served,
        dashers: this.stats.dashers,
        angry: this.stats.angry,
        stationUpgrades: this.stats.stationUpgrades,
        cleaned: this.stats.cleaned,
        tablesCleaned: this.stats.tablesCleaned,
        mopped: this.stats.mopped,
        refills: this.stats.refills,
        produced: { ...this.stats.produced },
        sale: { ...this.stats.sale },
      },
      statsBase: { ...this.statsBase },
      playTime: this.playTime,
      tutorialStep: this.tutorialStep,
      cosmetics: { ...this.cosmetics },
      cosmeticsOwned: [...this.cosmeticsOwned],
    };
  }

  load(s: Partial<GameStateSave> | undefined): void {
    if (!s) return;
    this.money = num(s.money, 0);
    this.totalEarned = num(s.totalEarned, 0);
    this.revenueEarned = num(s.revenueEarned, this.totalEarned);
    this.reputation = clamp(num(s.reputation, BALANCE.reputation.start), BALANCE.reputation.min, BALANCE.reputation.max);
    for (const k of Object.keys(this.upgrades) as PlayerUpgradeId[]) {
      this.upgrades[k] = Math.max(0, Math.floor(num(s.upgrades?.[k], 0)));
    }
    this.unlockedZones = new Set(Array.isArray(s.zones) ? s.zones : ['kose:a1']);
    this.unlockedZones.add('kose:a1');
    this.unlockedLocations = new Set(Array.isArray(s.locations) ? s.locations : ['kose']);
    this.unlockedLocations.add('kose');
    // Repair older saves whose purchased branch omitted its included starter area.
    for (const id of this.unlockedLocations) this.unlockLocation(id);
    this.activeLocation = this.unlockedLocations.has(s.activeLocation ?? '')
      ? (s.activeLocation as string)
      : 'kose';
    this.staffByLocation = {};
    this.staffLevelByLocation = {};
    const roles = ['waiter', 'cashier', 'barista', 'busser'] as StaffRole[];
    if (s.staffByLocation && typeof s.staffByLocation === 'object') {
      for (const [id, saved] of Object.entries(s.staffByLocation)) {
        const row = this.emptyStaff();
        for (const role of roles) row[role] = Math.min(this.staffCapAt(id, role), Math.max(0, Math.floor(num(saved?.[role], 0))));
        this.staffByLocation[id] = row;
      }
    }
    if (s.staffLevelByLocation && typeof s.staffLevelByLocation === 'object') {
      for (const [id, saved] of Object.entries(s.staffLevelByLocation)) {
        const row = this.emptyStaff();
        for (const role of roles) row[role] = Math.min(STAFF_ROLE_MAP[role].maxLevel, Math.max(0, Math.floor(num(saved?.[role], 0))));
        this.staffLevelByLocation[id] = row;
      }
    }
    // Eski ortak kadro: oyuncu güncelleme öncesinde açtığı her şubede bu
    // ekibi görüyordu; bir defalık geçişte mevcut şubelere kopyalanır.
    if (!s.staffByLocation) {
      for (const id of this.unlockedLocations) {
        const counts = this.emptyStaff();
        const levels = this.emptyStaff();
        for (const role of roles) {
          counts[role] = Math.min(this.staffCapAt(id, role), Math.max(0, Math.floor(num(s.staffCount?.[role], 0))));
          levels[role] = Math.min(STAFF_ROLE_MAP[role].maxLevel, Math.max(0, Math.floor(num(s.staffLevel?.[role], 0))));
        }
        this.staffByLocation[id] = counts;
        this.staffLevelByLocation[id] = levels;
      }
    }
    this.useStaffLocation(this.activeLocation);
    this.staffHireDeposits = {};
    if (s.staffHireDeposits && typeof s.staffHireDeposits === 'object') {
      for (const location of this.unlockedLocations) {
        const saved = s.staffHireDeposits[location];
        if (!saved || typeof saved !== 'object') continue;
        for (const role of roles) {
          const deposit = saved[role];
          if (!deposit || deposit.count !== this.staffCountAt(location)[role] ||
            typeof deposit.paid !== 'number' || !Number.isFinite(deposit.paid) || deposit.paid <= 0) continue;
          (this.staffHireDeposits[location] ??= {})[role] = {
            count: deposit.count,
            paid: Math.min(this.hireTotalCostFor(role, location), Math.round(deposit.paid * 1000) / 1000),
          };
        }
      }
    }
    this.goalIndex = Math.max(0, Math.floor(num(s.goalIndex, 0)));
    this.goalProgress = Math.max(0, num(s.goalProgress, 0));
    this.goalBase = Math.max(0, num(s.goalBase, 0));
    this.prestigePoints = Math.max(0, Math.floor(num(s.prestigePoints, 0)));
    this.prestigeCount = Math.max(0, Math.floor(num(s.prestigeCount, 0)));
    this.prestigeLevels =
      s.prestigeLevels && typeof s.prestigeLevels === 'object' ? { ...s.prestigeLevels } : {};
    this.dailyDay = typeof s.dailyDay === 'string' ? s.dailyDay : '';
    this.dailyStreak = Math.max(0, Math.floor(num(s.dailyStreak, 0)));
    this.dailyClaimed = s.dailyClaimed === true;
    this.vacuumHinted = s.vacuumHinted === true;
    const anyUpgrade = Object.values(this.upgrades).some((lvl) => lvl > 0) || Math.floor(num(s.stats?.stationUpgrades, 0)) > 0;
    const anyStaff = Object.values(this.staffByLocation).some((row) => Object.values(row).some((n) => n > 0));
    this.upgradeOnboarded = s.upgradeOnboarded === true || anyUpgrade;
    this.staffOnboarded = s.staffOnboarded === true || anyStaff;
    this.dailyMissionDone = Array.isArray(s.dailyMissionDone)
      ? [0, 1, 2].map((i) => s.dailyMissionDone![i] === true)
      : [false, false, false];
    this.dailyMissions = Array.isArray(s.dailyMissions) && s.dailyMissions.length === 3 &&
      s.dailyMissions.every((mission) => mission && typeof mission.counter === 'string' &&
        Number.isSafeInteger(mission.target) && mission.target > 0)
      ? s.dailyMissions.map((mission) => ({ counter: mission.counter, target: mission.target }))
      : [];
    this.dailyBase = s.dailyBase && typeof s.dailyBase === 'object' ? { ...s.dailyBase } : {};
    this.regularVisits = s.regularVisits && typeof s.regularVisits === 'object' ? { ...s.regularVisits } : {};
    this.regularMilestones =
      s.regularMilestones && typeof s.regularMilestones === 'object' ? { ...s.regularMilestones } : {};
    this.coupons = Math.max(0, Math.floor(num(s.coupons, 0)));
    this.weekKey = typeof s.weekKey === 'string' ? s.weekKey : '';
    this.weekBase = Math.max(0, num(s.weekBase, 0));
    this.weekClaimed = s.weekClaimed === true;
    this.festivalWeek = typeof s.festivalWeek === 'string' ? s.festivalWeek : '';
    this.festivalBase = Math.max(0, num(s.festivalBase, 0));
    this.festivalClaimed = s.festivalClaimed === true;
    this.festivalGoalId = typeof s.festivalGoalId === 'string' ? s.festivalGoalId : '';
    this.festivalGoalTarget = Math.max(0, Math.floor(num(s.festivalGoalTarget, 0)));
    this.adBuffs = s.adBuffs && typeof s.adBuffs === 'object' ? { ...s.adBuffs } : {};
    this.dailyPrevDone = s.dailyPrevDone && typeof s.dailyPrevDone === 'object' ? { ...s.dailyPrevDone } : {};
    this.weekPrevServed = Math.max(0, num(s.weekPrevServed, 0));
    this.festPrevItem = Math.max(0, num(s.festPrevItem, 0));
    this.changeDay = typeof s.changeDay === 'string' ? s.changeDay : '';
    this.changeCount = Math.max(0, Math.floor(num(s.changeCount, 0)));
    this.changeAt = Math.max(0, num(s.changeAt, 0));
    this.stats.sold = Math.max(0, Math.floor(num(s.stats?.sold, 0)));
    this.stats.orders = Math.max(0, Math.floor(num(s.stats?.orders, 0)));
    this.stats.served = Math.max(0, Math.floor(num(s.stats?.served, 0)));
    this.stats.dashers = Math.max(0, Math.floor(num(s.stats?.dashers, 0)));
    this.stats.angry = Math.max(0, Math.floor(num(s.stats?.angry, 0)));
    this.stats.stationUpgrades = Math.max(0, Math.floor(num(s.stats?.stationUpgrades, 0)));
    this.stats.cleaned = Math.max(0, Math.floor(num(s.stats?.cleaned, 0)));
    this.stats.tablesCleaned = Math.max(0, Math.floor(num(s.stats?.tablesCleaned, 0)));
    this.stats.mopped = Math.max(0, Math.floor(num(s.stats?.mopped, 0)));
    this.stats.refills = Math.max(0, Math.floor(num(s.stats?.refills, 0)));
    this.stats.produced = { ...(s.stats?.produced ?? {}) };
    this.stats.sale = { ...(s.stats?.sale ?? {}) };
    for (const k of COUNTER_STAT_KEYS) {
      this.statsBase[k] = Math.max(0, Math.floor(num(s.statsBase?.[k], 0)));
    }
    this.seenLocations = new Set(['kose', ...this.unlockedLocations,
      ...(Array.isArray(s.seenLocations) ? s.seenLocations.filter(id => id === 'kose' || id === 'sahil') : [])]);
    this.playTime = Math.max(0, num(s.playTime, 0));
    this.tutorialStep = Math.max(0, Math.floor(num(s.tutorialStep, 0)));
    /**
     * KOZMETİK — ESKİ KAYIT UYUMU.
     *
     * Alanlar SAVE_VERSION 7'den sonra eklendi ve şema kırıcı değil: eksik
     * alan varsayılana düşer, bilinmeyen bir kimlik `cosmeticById` içinde
     * listenin ilk (ücretsiz) öğesine düşer. Bu yüzden sürüm YÜKSELTİLMEDİ
     * — eski kayıt tam olarak eskisi gibi, varsayılan görünümle açılır.
     */
    this.cosmeticsOwned = new Set(
      Array.isArray(s.cosmeticsOwned) ? s.cosmeticsOwned.filter((k) => typeof k === 'string') : [],
    );
    for (const axis of COSMETIC_AXES) {
      const want = s.cosmetics?.[axis];
      const id = typeof want === 'string' ? cosmeticById(axis, want).id : defaultCosmetic(axis);
      // Sahip olunmayan bir seçim (bozuk/elle kurcalanmış kayıt) varsayılana düşer.
      this.cosmetics[axis] = this.ownsCosmetic(axis, id) ? id : defaultCosmetic(axis);
    }
  }
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
