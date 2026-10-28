import type { ItemId } from '../data/items';

/**
 * UI ile oyun çekirdeği arasındaki TEK sözleşme.
 * UI katmanı three.js'i veya simülasyonu asla doğrudan import etmez.
 */

export interface UiUpgradeRow {
  id: string;
  name: string;
  desc: string;
  glyph: string;
  level: number;
  maxLevel: number;
  cost: number;
  affordable: boolean;
  maxed: boolean;
  /** Mevcut değer, ör. "5 slot" */
  valueText: string;
  /** Bir sonraki seviyedeki değer, ör. "6 slot" */
  nextText: string;
  /** Somut katkı rozeti, ör. "+%14 Hız" veya "+1 Kapasite" */
  deltaBadge?: string;
}

export interface UiUpgradeAdvice {
  id: string; kind: 'speed' | 'cap'; name: string; reason: string;
  current: string; next: string; cost: number; affordable: boolean;
}
export interface UiCollection {
  recipes: { id: string; name: string; glyph: string; count: number; stars: number; next: number | null }[];
  places: { name: string; seen: boolean }[];
}

export interface UiStaffRow {
  id: string;
  name: string;
  desc: string;
  glyph: string;
  color: string;
  count: number;
  maxCount: number;
  hireCost: number;
  hirePaid?: number;
  hireTotalCost?: number;
  canHire: boolean;
  hireMaxed: boolean;
  locked?: boolean;
  unlockHint?: string;
  level: number;
  maxLevel: number;
  levelCost: number;
  canLevel: boolean;
  levelMaxed: boolean;
  /** "Hız 5.4 · Kapasite 6" gibi özet */
  effectText: string;
  nextEffectText: string;
  deltaBadge?: string;
  levelDeltaBadge?: string;
  scopeText?: string;
}

export interface UiStationRow {
  id: string;
  name: string;
  glyph: string;
  /** Bulunduğu bölge adı */
  zoneName: string;
  /** Departman etiketi: "Bar" / "Salon" / "Servis" */
  deptName: string;
  locked: boolean;
  unlockHint?: string;
  speedLevel: number;
  speedMaxLevel: number;
  speedCost: number;
  canSpeed: boolean;
  speedText: string;
  nextSpeedText: string;
  speedDeltaBadge?: string;
  hasSpeed: boolean;
  capLevel: number;
  capMaxLevel: number;
  capCost: number;
  canCap: boolean;
  capText: string;
  nextCapText: string;
  capDeltaBadge?: string;
  capBlockedReason?: string;
  /** Kapasite butonunun adı: makinede "Depo", masada "Sandalye". */
  capLabel: string;
  hasCap: boolean;
}

export interface UiLocationRow {
  id: string;
  name: string;
  tagline: string;
  unlocked: boolean;
  active: boolean;
  cost: number;
  canBuy: boolean;
  /** 0..1 tamamlanma */
  progress: number;
  /** Kilitliyse neden kilitli */
  requirementText: string;
}

/** Günlük ödül merdiveni ve günün görevleri (bkz. sim/Daily.ts). */
export interface UiDaily {
  /** Arka arkaya giriş günü (0 tabanlı). */
  streak: number;
  /** Merdivenin toplam basamağı. */
  ladder: number;
  /** Bugünün ödülü alındı mı. */
  claimed: boolean;
  reward: number;
  missions: {
    glyph: string;
    title: string;
    current: number;
    target: number;
    reward: number;
    claimed: boolean;
  }[];
  /** Alınmayı bekleyen bir şey var mı — rozet için. */
  pending: number;
}

/* ================================================================ *
 *  v5.1 sadakat katmanı (bkz. sim/Daily.ts + sim/Festival.ts)
 * ================================================================ */

/** Haftalık büyük hedef — ISO haftası; Pazartesi yenilenir, ceza yok. */
export interface UiWeekly {
  /** "Bu hafta 320 ürün servis et" — hedef cümlesi. */
  title: string;
  current: number;
  target: number;
  reward: number;
  /** Ödülle gelen kupon adedi. */
  coupon: number;
  claimed: boolean;
  canClaim: boolean;
  /** Haftanın kalan günü, bugün dahil (1-7). */
  daysLeft: number;
}

/** Haftanın festivali — tarihten türetilir, her cihazda aynı hafta aynı. */
export interface UiFestival {
  id: string;
  title: string;
  /** HUD çipindeki kısa ad. */
  short: string;
  glyph: string;
  /** Etki cümlesi ("Çay bu hafta %35 fazla kazandırıyor."). */
  desc: string;
  /** Hedef cümlesi ("120 Çay sat"). */
  goalTitle: string;
  current: number;
  target: number;
  reward: number;
  coupon: number;
  claimed: boolean;
  canClaim: boolean;
  daysLeft: number;
}

/** Müdavim Albümü satırı (yedi müdavim — bkz. data/customers.ts). */
export interface UiAlbumRow {
  id: string;
  name: string;
  /** Kısa kimlik: "mahallenin haber merkezi". */
  title: string;
  /** "Her zamanki" ürününün rozeti. */
  glyph: string;
  visits: number;
  /** Sıradaki eşik (5/20/60); albüm tamamsa null. */
  next: number | null;
  /** Önceki eşik — ilerleme çubuğunun sıfır noktası. */
  prev: number;
  reward: number;
  ready: boolean;
  /** Ödülü alınmış eşik sayısı (0-3). */
  stars: number;
}

/**
 * Kozmetik kuponu indirimi — TEK doğruluk kaynağı: hem çekirdek
 * (Game.buyCosmeticCoupon) hem panel fiyat etiketi bu hesabı kullanır,
 * yoksa ekranda yazan ile kasadan çıkan ayrışır.
 */
export const COUPON_DISCOUNT = 0.4;

/** Kuponlu fiyat: %40 düşülmüş, en az ₺1. */
export function couponPrice(cost: number): number {
  return Math.max(1, cost - Math.round(cost * COUPON_DISCOUNT));
}

export interface UiGoal {
  id: string;
  title: string;
  hint: string;
  current: number;
  target: number;
  reward: number;
  index: number;
  total: number;
}

export interface UiSideActivityRow {
  id: 'garden' | 'courtyard';
  title: string;
  level: number;
  summary: string;
  reward: number;
  progress: number;
  selected: boolean;
}

export interface UiHudState {
  vacuum?: { available: boolean; holding: boolean; canTake: boolean };
  /** Same immediate action as the world guide; the long-term goal stays separate. */
  actionLabel?: string;
  /** Jobs toward the next small streak bonus. 0 hides the chip. */
  streak?: number;
  streakNeed?: number;
  /** Available side businesses, ordered left garden then right courtyard. */
  sideActivities: UiSideActivityRow[];
  money: number;
  /** 0..100 */
  reputation: number;
  repMult: number;
  /** 0..100 mekân temizliği (Tuvalet & Hijyen bölgesi açılana kadar false) */
  hygiene: number;
  hygieneMult: number;
  hygieneActive: boolean;
  /**
   * Kafenin ritmi 0..1 — oyuncunun eylemleriyle dolar, boşta söner
   * (bkz. World.tempo / BALANCE.tempo). Ceza değil bonus: düşükken
   * uyarı tonu YOK (bkz. HUD `.pill-tempo`).
   */
  tempo: number;
  /** Toplanmayı bekleyen kirli masa sayısı */
  dirtyTables: number;
  /** Zeminde silinmeyi bekleyen leke sayısı */
  spills: number;
  /** Masada servis bekleyen sipariş sayısı — kafenin en kritik göstergesi */
  pendingOrders: number;
  /** Tuvalet sarf doluluğu 0..1 (tuvalet yoksa 1) */
  supplyLevel: number;
  /** Tuvalet bölümü açık mı */
  toiletOpen: boolean;
  /** Salon açık mı — kapalıysa kafe göstergeleri gizlenir */
  cafeOpen: boolean;
  /** Dolu sandalye / toplam sandalye */
  seatsUsed: number;
  seatsTotal: number;
  carry: number;
  carryMax: number;
  /** En üstteki ürün (tekil rozet için). */
  carryItem: ItemId | null;
  /** Eldeki slotlar alttan üste — karma taşıma göstergesi bunları boyar. */
  carrySlots: readonly ItemId[];
  locationName: string;
  /** 0..1 şube tamamlanma */
  progress: number;
  goal: UiGoal | null;
  /** Saniyede otomatik gelir tahmini */
  incomePerSec: number;
  /** Öğretici sürüyor mu — aşamalı HUD buna bakar (bkz. HUD.tickIntro). */
  tutorialActive: boolean;
  /** En az bir personel var mı — gelir/sn pili o zaman belirir. */
  staffHired: boolean;
  /** İlk yükseltme ve personel mikro-rehberleri tamamlandı mı */
  upgradeOnboarded?: boolean;
  staffOnboarded?: boolean;
  /** x2 Gelir (Mutlu Saat) boost durumu */
  boostLeft?: number;
  boostMultiplier?: number;
  boostMax?: number;
  boostReady?: boolean;
}

/**
 * DÖNÜŞ ÖZETİ — "Sen yokken…"
 *
 * Bu rapor PARA ANLATMAZ ve para vaat etmez. Offline kazanç bilerek yok
 * (bkz. sim/Offline.ts); oyuncu uzaktayken olan tek şey makinelerin
 * depolarını doldurmasıdır. Ekran da tam olarak onu söyler: dönen oyuncuyu
 * boş bir kafe değil, servise hazır raflar karşılıyor.
 */
export interface UiOfflineReport {
  /** Uzakta geçen süre (sn). */
  seconds: number;
  /** Raflara eklenen toplam ürün adedi. */
  stocked: number;
  /** Kaç makine üretmiş. */
  machines: number;
  /** Ürün kırılımı: "6 · Filtre Kahve" gibi satırlar. */
  lines: { glyph: string; text: string }[];
  /**
   * v5.1 — "dönüş satışı" (comeback_sale) butonu görünsün mü.
   * Game modal açılırken karar verir: reklam envanteri gerçekten dolu
   * (`adReady`) VE aktif şubede satılacak stok var. Buton yalnız EKTİR;
   * izlemeyen oyuncunun stoğu raflarda aynen bekler (bkz. core/Ads.ts
   * 3. kural) — bu yüzden false olduğunda modal hiçbir boşluk hissettirmez.
   */
  comebackReady: boolean;
  rewardMultiplier?: number;
  nextGoal?: string;
  /** Toplam dönüş kazancı (gece vardiyası nakdi + stok değeri). */
  earned?: number;
  /** Personelin gece vardiyasında ürettiği doğrudan nakit. */
  offlineCash?: number;
  /** Üretilen stoğun nakit karşılığı. */
  stockValue?: number;
}

export interface UiEventBanner {
  id: string;
  title: string;
  desc: string;
  glyph: string;
  /** Kalan saniye */
  remaining: number;
  duration: number;
  tone: 'good' | 'bad' | 'info';
}

export type UiFpsPreference = 'auto' | 30 | 45 | 60;

export interface UiSettings {
  muted: boolean;
  music: boolean;
  reducedMotion: boolean;
  paused: boolean;
  lowQuality: boolean;
  /** Titreşim — artık "sessiz" anahtarından bağımsız. */
  haptics: boolean;
  /** 0..1 kaydırıcılar (bkz. GameApi.setVolume). */
  sfxVolume: number;
  musicVolume: number;
  /** Oyuncunun seçtiği kare hızı; Otomatik cihaz politikasını kullanır. */
  fps: UiFpsPreference;
}

/** `setSetting` yalnız BOOLE alanları taşır; seviyeler `setVolume` ile. */
export type UiSettingFlag = 'muted' | 'music' | 'reducedMotion' | 'paused' | 'lowQuality' | 'haptics';

export interface UiTutorialStep {
  text: string;
  index: number;
  total: number;
}

export interface UiPrestigeRow {
  id: string;
  name: string;
  glyph: string;
  desc: string;
  level: number;
  maxLevel: number;
  cost: number;
  maxed: boolean;
  canBuy: boolean;
  effectText: string;
  nextText: string;
}

export interface UiPrestige {
  /** Harcanmamış Fincan Puanı. */
  points: number;
  /** Kaç tur devredildi. */
  count: number;
  /** Şimdi devredilse kazanılacak puan. */
  gain: number;
  canPrestige: boolean;
  minEarned: number;
  totalEarned: number;
  /**
   * Devir sistemi oyuncuya GÖSTERİLMELİ mi.
   *
   * Kademeli açılış: eşiğe yaklaşmadan (veya bir kez devretmeden) prestij
   * arayüzde hiç görünmez. İlk saatlerinde olan oyuncuya "kafeni sıfırla"
   * diyen bir kart göstermek korkutur; bu kart ancak kafe o büyüklüğe
   * geldiğinde bir cevap olur.
   */
  visible: boolean;
  rows: UiPrestigeRow[];
}

/* ================================================================ *
 *  Ödüllü reklam teklifleri (bkz. core/Ads.ts)
 * ================================================================ */

/** Tek bir ödüllü reklam teklifi. */
export interface UiAdOffer {
  /**
   * Teklif gösterilebilir mi. Sağlayıcı bağlı DEĞİLSE (bugünkü varsayılan)
   * daima false döner ve arayüzde hiçbir reklam öğesi çizilmez — oyun
   * tamamen reklamsız ve eksiksiz oynanır.
   */
  ready: boolean;
  /** Kartın üstünde görünen kısa vaat. */
  text: string;
}

export interface UiAdOffers {
  /** Geçici kazanç çarpanı — "Mutlu Saat". */
  happyHour: UiAdOffer;
  /** Sıradaki bölgenin KALAN ödemesini tamamlar. */
  zoneFinish: UiAdOffer;
  /** Süreli otomatik temizlik robotu. */
  robotVacuum: UiAdOffer;
  /** Tüm makine depolarını anında doldurur. */
  stockRefill: UiAdOffer;
  /** Günlük ödülü ikiye katlar. */
  dailyDouble: UiAdOffer;
  /* ── v5.1 — yalnız teklif çipiyle gelen yerleşimler (panel kartı yok) ── */
  /** ~90 sn gelire denk nakit (ped %60-90 ödenmişken). */
  cashBoost: UiAdOffer;
  /** Süreli "el ver" bonusu tüm makinelerde + oyuncu hızı ×1,25. */
  ustaMode: UiAdOffer;
  /** Süreli müşteri akışı ×1,6 + sabır ×1,2. */
  rushHour: UiAdOffer;
  /** Aktif arızayı tamir eder + süreli arıza bağışıklığı. */
  repairShield: UiAdOffer;
  /** Süreli masa bahşişleri ×3. */
  tipRain: UiAdOffer;
  /** Zengin Yatırımcı VIP nakit hibesi. */
  investor?: UiAdOffer;
  /** Menü içi ücretsiz yükseltme (RV) durumu ve kalan bekleme süresi (sn). */
  freeUpgrade?: { ready: boolean; cooldown: number };
}

/**
 * PANEL kartı olan ödüllü reklam yerleşimleri.
 *
 * Bu union BİLEREK beş üyede kalır: Panels.ts teklif kartlarını
 * `Record<UiAdKind, …>` ile kurar; v5.1'in çip-tabanlı yerleşimleri buraya
 * eklenseydi o tablo her yeni yerleşimde kart zorunlu kılardı. Çip ve
 * modal yolundan gelen tam küme aşağıdaki `UiAdRewardKind`.
 */
export type UiAdKind = 'happy_hour' | 'zone_finish' | 'robot_vacuum' | 'stock_refill' | 'daily_double';

/**
 * `watchAd`'ın kabul ettiği TÜM yerleşimler (v5.1): panel kartlıların
 * üstüne çip-tabanlı beş buff + yalnız dönüş modalında görünen
 * `comeback_sale`. `core/Ads.AdPlacement` ile bire bir aynı adlar —
 * arada çeviri katmanı yok.
 */
export type UiAdRewardKind =
  | UiAdKind
  | 'cash_boost'
  | 'usta_mode'
  | 'rush_hour'
  | 'repair_shield'
  | 'tip_rain'
  | 'investor'
  | 'comeback_sale'
  | 'free_upgrade';

/* ================================================================ *
 *  Dekorasyon (bkz. data/cosmetics.ts)
 * ================================================================ */

export interface UiCosmeticOption {
  id: string;
  name: string;
  desc: string;
  cost: number;
  /** Panelde çizilen renk çipi — '#rrggbb' dizisi (1-3 renk). */
  swatch: string[];
  owned: boolean;
  selected: boolean;
  previewed?: boolean;
  /** Sahip değil ve parası yetiyor mu. */
  affordable: boolean;
}

export interface UiCosmeticAxis {
  id: string;
  name: string;
  glyph: string;
  desc: string;
  options: UiCosmeticOption[];
}

export type UiPanelId =
  | 'upgrades'
  | 'staff'
  | 'stations'
  | 'locations'
  | 'settings'
  | 'goals'
  | 'prestige'
  | 'decor';

/** Oyun çekirdeğinin UI'ya sunduğu arayüz. */
export interface UIApi {
  getHud(): UiHudState;
  toggleVacuum(): boolean;
  /** Toggle a world route to the next action for this side business. */
  focusSideActivity(id: 'garden' | 'courtyard'): void;

  getPlayerUpgrades(): UiUpgradeRow[];
  getUpgradeAdvice(): UiUpgradeAdvice | null;
  getCollection(): UiCollection;
  buyPlayerUpgrade(id: string): boolean;
  watchFreePlayerUpgrade?(id: string): Promise<boolean>;

  getStaff(): UiStaffRow[];
  hireStaff(id: string): boolean;
  levelStaff(id: string): boolean;
  watchFreeStaffUpgrade?(id: string, kind: 'hire' | 'level'): Promise<boolean>;

  getStations(): UiStationRow[];
  buyStationUpgrade(id: string, kind: 'speed' | 'cap'): boolean;
  watchFreeStationUpgrade?(id: string, kind: 'speed' | 'cap'): Promise<boolean>;

  getLocations(): UiLocationRow[];
  buyLocation(id: string): boolean;
  switchLocation(id: string): boolean;

  getGoals(): UiGoal[];
  /** Focus the current playable task or its purchase panel. */
  followGoal?(): void;

  getLanguage(): 'tr'|'en';
  changeLanguage(language:'tr'|'en'):Promise<void>;
  getDiagnostics(): {sharing:boolean; available:boolean};
  setDiagnosticsSharing(value:boolean):void;
  exportDiagnostics():string;
  clearDiagnostics():void;
  getSettings(): UiSettings;
  setSetting(key: UiSettingFlag, value: boolean): void;
  /** Ses efekti / müzik seviyesi (0..1). Ses motoruna anında yazılır. */
  setVolume(kind: 'sfx' | 'music', value: number): void;
  /** Oyuncunun test edebileceği kare hızı seçimi. */
  setFps?(fps: UiFpsPreference): void;
  /**
   * 🎚️ Grafik seçici (Ayarlar). İSTEĞE BAĞLI: oyun tarafı bu kancaları

   * bağlamadıysa panel eski "Düşük Kalite" anahtarına geri düşer.
   * 'auto' = ısı merdiveni kademeyi cihaza göre kendisi yönetir.
   */
  getQualityTier?(): 'auto' | 'high' | 'medium' | 'low';
  setQualityTier?(t: 'auto' | 'high' | 'medium' | 'low'): void;
  resetProgress(): Promise<void>;
  /** Günlük ödül ve görevlerin durumu. */
  getDaily(): UiDaily;
  /** Günün giriş ödülünü al. */
  claimDaily(): void;
  /** Tamamlanmış bir günlük görevin ödülünü al. */
  claimMission(index: number): void;

  /* ---- v5.1 sadakat (bkz. sim/Daily.ts + sim/Festival.ts) ---- */
  /** Haftalık hedefin durumu. */
  getWeekly(): UiWeekly;
  /** Haftalık hedef ödülünü al (nakit + kupon). */
  claimWeekly(): void;
  /** Haftanın festivali — HUD çipi ve Hedefler şeridi aynı kaynaktan okur. */
  getFestival(): UiFestival;
  /** Festival hedef ödülünü al (nakit + kupon). */
  claimFestival(): void;
  /** Müdavim Albümü satırları. */
  getAlbum(): UiAlbumRow[];
  /** Hazır bir albüm eşiğinin ödülünü al. */
  claimAlbum(regularId: string): void;
  /** Hedefler panelinde alınmayı bekleyen ödül sayısı — hedef rozeti. */
  loyaltyPending(): number;
  /** Kupon sayısı + kasa (kuponlu fiyatın alınabilirlik kontrolü için). */
  getCoupons(): { count: number; money: number };
  /** Kupon varsa %40 indirimle satın alır; yoksa normal satın almaya düşer. */
  buyCosmeticCoupon(axis: string, id: string): boolean;

  /** Kaydı taşınabilir metne çevirir (null = kayıt yok / erişilemiyor). */
  exportSave(): string | null;
  /** Metinden kaydı geri yükler; başarılıysa true. Oyun yeniden başlar. */
  importSave(text: string): Promise<boolean>;
  getPrestige(): UiPrestige;
  buyPrestigeUpgrade(id: string): boolean;
  doPrestige(): boolean;

  /**
   * DEKORASYON. Dört eksen (duvar · zemin · masa tablası · üniforma).
   * Seçimler oyunu HİÇ etkilemez; yalnız görünümü değiştirir.
   */
  getCosmetics(): UiCosmeticAxis[];
  /** Satın al (ve seç). Zaten sahipse yalnız seçer. */
  buyCosmetic(axis: string, id: string): boolean;
  /** Sahip olunan bir görünümü seç — mekân ANINDA değişir. */
  selectCosmetic(axis: string, id: string): boolean;
  /** Temporary appearance only; no currency, ownership or save changes. */
  previewCosmetic(axis: string, id: string): boolean;
  cancelCosmeticPreview(): void;
  /** Kaç görünüm alındı / toplam kaç var — giriş kartındaki sayaç. */
  cosmeticProgress(): { owned: number; total: number };

  /*
   * `claimOffline` YOK ve olmayacak: offline PARA kazancı bilerek
   * kaldırıldı (bkz. sim/Offline.ts). Dönüş ekranı artık toplanacak bir
   * kasa değil, dolan rafları anlatır — bu yüzden "topla" diye bir çağrı
   * gerekmiyor; modal yalnızca haber verir (bkz. UIRoot.showOffline).
   */

  /**
   * Ödüllü reklam tekliflerinin güncel durumu. Sağlayıcı yokken her
   * teklif `ready:false` döner; arayüz de hiçbir reklam öğesi çizmez.
   */
  getAdOffers(): UiAdOffers;
  /** Reklamı göster; ödül hak edildiyse uygula ve true döndür. */
  watchAd(kind: UiAdRewardKind): Promise<boolean>;

  skipTutorial(): void;
  dismissOnboarding?(kind: 'upgrade' | 'staff'): void;

  formatMoney(v: number): string;
  itemInfo(id: ItemId): { name: string; glyph: string; color: number };
}

/** UI katmanının dışarıya verdiği kontrol yüzeyi. */
export interface UIRoot {
  /** Her karede çağrılır. */
  update(dt: number): void;
  /** Offline özet penceresini aç. */
  showOffline(report: UiOfflineReport): void;
  /** Olay bandını göster / güncelle. */
  showEvent(banner: UiEventBanner): void;
  /**
   * Kendiliğinden beliren ödül teklifi çipi.
   *
   * Teklifler yalnız panellerin İÇİNDE duruyordu; paneli açmayan oyuncu
   * ödüllü reklam sisteminin varlığını hiç fark etmiyordu. Çip HUD'a yeni
   * bir buton eklemeden (üst yığın 88 px'de sabit) sol kolonda belirir.
   */
  /* Parametre tipi `UiAdRewardKind`: çip v5.1 buff yerleşimlerini de
   * gösterir. Uygulayıcı (HUD) kind'ı yalnız geri çağrıya taşır; metod
   * parametreleri TS'te çift yönlü denetlendiği için HUD'un dar imzası
   * bu sözleşmeyi karşılamaya devam eder. */
  showAdChip(kind: UiAdRewardKind, glyph: string, title: string, text: string): void;
  hideAdChip(): void;
  /** Çipteki geri sayım halkası: 1 → 0 (kalan ömür oranı). Game her kare yazar. */
  setAdChipProgress(t01: number): void;
  readonly adChipOpen: boolean;
  hideEvent(id: string): void;
  /** Kısa bildirim. */
  toast(text: string, glyph?: string, tone?: 'good' | 'bad' | 'info'): void;
  /** Ekran uzayında yüzen yazı (para pop, +ürün). */
  floatText(screenX: number, screenY: number, text: string, tone?: 'money' | 'item' | 'bad' | 'good'): void;
  /** Kazanılan parayı ekran noktasından cüzdana doğru uçurur. */
  flyCoins(screenX: number, screenY: number, count: number): void;
  /** Tutorial balonu (null → gizle). */
  setTutorial(step: UiTutorialStep | null): void;
  /** Bir panel açıksa true — oyun girişini kısmak için. */
  isPanelOpen(): boolean;
  openPanel(id: UiPanelId): void;
  closePanels(): void;
  /** Android donanım geri tuşu ve Escape için LIFO geri yöneticisi. Olay tüketildiyse true döner. */
  handleBack(): boolean;
  /** Açılış perdesini kaldır. */
  hideBoot(): void;
  /** Zafer / şube açılış kutlaması. */
  celebrate(title: string, subtitle: string, glyph: string): void;
  dispose(): void;
}
