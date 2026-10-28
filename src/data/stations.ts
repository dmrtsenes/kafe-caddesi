import { tr } from "../core/I18n";
import { TOILET_LAYOUT } from './restrooms';
import type { ItemId } from './items';

export type StationKind =
  /**
   * MAKİNE — girdisiz üretir. Zincir yok: espresso makinesi espresso verir,
   * fırın kruvasan verir. Oyuncu makineye yaklaşır, hazır ürünü alır.
   */
  | 'machine'
  /** Depo: tuvalet sarfı üretir (peçete, kâğıt). */
  | 'supply'
  /**
   * TESLİM RAFI (v5) — HER ÜRÜNÜN KENDİ RAFI VAR (`item` alanı dolu).
   * Oyuncu/tezgâhtar arka yüzden doldurur; yalnız PAKET müşteri ön yüzden
   * kendi alır. Salonda oturan müşteriye doğru ürünü oyuncu götürür.
   */
  | 'pickup'
  /** SİPARİŞ TEZGÂHI: müşteri sıraya girer, sipariş verir. */
  | 'counter'
  /** Masa: müşteri oturur, siparişi buraya servis edilir, bulaşık bırakır. */
  | 'table'
  /** Kova: bulaşık buraya atılır. */
  | 'bin'
  /** Tuvalet: kullanıldıkça kirlenir, peçete/kâğıt tüketir. */
  | 'toilet'
  /**
   * SÜPÜRGE DOLABI. Yanına gidince süpürgeyi alırsın, tekrar gidince
   * bırakırsın. Elde süpürgeyle toz çok hızlı, normal leke daha hızlı
   * temizlenir — ama koşarken biraz yavaşlarsın.
   */
  | 'vacuum';

/** 3D görsel şablonu — world/StationView.ts bu ada göre mesh üretir. */
export type StationVisualKind =
  | 'samovar'
  | 'espresso'
  | 'steamer'
  | 'oven'
  | 'panini'
  | 'dessertbench'
  | 'wafflemaker'
  | 'coldbar'
  | 'blender'
  | 'icecream'
  | 'juicebar'
  | 'napkinbox'
  | 'papershelf'
  | 'pickup'
  | 'shelf'
  | 'counter'
  | 'table'
  | 'tablesq'
  | 'viptable'
  | 'vacuumdock'
  | 'bin'
  | 'toilet';

/**
 * GÖRSEL GÖVDE YARI-BOYUTLARI (birim). Çarpışma kutusu buradan gelir.
 *
 * Eskiden çarpışma 0,5'lik navigasyon ızgarası üstünden çözülüyordu ve her
 * makinenin arkasında/önünde ~0,45 birimlik görünmez bir duvar kalıyordu —
 * oyuncu "boşlukta koşarken bloklanıyorum" diyordu. Artık kutu doğrudan
 * `StationView`'daki gövdenin ölçüsüdür; ne görüyorsan ona çarparsın.
 *
 * StationView'daki `counterBase(g, w, d, …)` çağrılarıyla birebir eşleşir;
 * gövde ölçüsü orada değişirse burası da değişmeli.
 */
export const STATION_BODY: Record<StationVisualKind, { x: number; z: number }> = {
  samovar: { x: 0.85, z: 0.5 }, // counterBase 1,7 × 1,0
  espresso: { x: 1.05, z: 0.53 }, // 2,1 × 1,05
  steamer: { x: 0.9, z: 0.5 }, // 1,8 × 1,0
  oven: { x: 0.95, z: 0.8 }, // taban 1,9 × 1,6
  panini: { x: 0.9, z: 0.5 },
  dessertbench: { x: 0.9, z: 0.5 },
  wafflemaker: { x: 0.85, z: 0.48 }, // 1,7 × 0,95
  coldbar: { x: 1.0, z: 0.5 }, // 2,0 × 1,0
  blender: { x: 0.85, z: 0.48 }, // 1,7 × 0,95
  icecream: { x: 0.89, z: 0.51 }, // 1,78 × 1,02
  juicebar: { x: 1.0, z: 0.5 },
  napkinbox: { x: 0.75, z: 0.45 }, // 1,5 × 0,9
  papershelf: { x: 0.75, z: 0.45 },
  pickup: { x: 1.28, z: 0.5 }, // taş tabla 2,55 × 1,0
  /** v5 ürün rafı: dar gövde — beş raf + iki kasa tek bar hattına sığar. */
  shelf: { x: 0.75, z: 0.5 }, // 1,5 × 1,0
  counter: { x: 1.27, z: 0.6 }, // 2,54 × 1,19
  /** Tabla ölçüsü; sandalyeler World tarafından ayrı döndürülmüş gövdeler olarak eklenir. */
  table: { x: 0.72, z: 0.72 },
  /** Kare masa: dört ayaklı, tablası yuvarlaktan biraz geniş. */
  tablesq: { x: 0.8, z: 0.8 },
  viptable: { x: 0.86, z: 0.86 },
  bin: { x: 0.44, z: 0.44 },
  /** Park pedi: yalnız süpürgenin durduğu küçük daire engel sayılır. */
  vacuumdock: { x: 0.4, z: 0.4 },
  toilet: { x: TOILET_LAYOUT.halfWidth, z: TOILET_LAYOUT.halfDepth },
};

export type DeptId = 'bar' | 'salon' | 'servis';

export interface StationDef {
  /** Benzersiz örnek kimliği (kayıt anahtarı olarak da kullanılır). */
  id: string;
  name: string;
  kind: StationKind;
  visual: StationVisualKind;
  location: string;
  /** Hangi bölüm ile birlikte açılır */
  zone: string;
  x: number;
  z: number;
  /**
   * Y ekseni etrafında derece cinsinden dönüş.
   * Yaklaşma noktaları (müşteri önü / personel arkası) BU AÇIYA GÖRE döner,
   * böylece tezgâh duvara paralel olmak zorunda değildir.
   */
  rot: number;

  /** machine → ürettiği menü ürünü · supply → ürettiği sarf */
  item?: ItemId;
  /** Bir çevrim süresi (sn) · table → masada geçirilen taban süre · toilet → kullanım süresi */
  time: number;
  outputCap: number;

  speedCost?: number;
  capCost?: number;

  /** table → kaç kişilik */
  seats?: number;
  /** Masada ve müşteri balonunda görünen kalıcı servis kodu. */
  serviceCode?: string;
  /** table → dış mekân masası mı (teras: daha yüksek bahşiş) */
  /** VIP masa mı — pahalı açılır, hesabı ve bahşişi çok yüksektir */
  vip?: boolean;
  outdoor?: boolean;
  /** toilet → tükettiği sarf malzemeleri ve her birinin stok tavanı */
  supplies?: { item: ItemId; cap: number }[];
  dept: DeptId;
  /** Menüdeki sıra — UI ve sipariş listesinde kullanılır */
  menuOrder?: number;
}

const S = (d: StationDef) => d;

/* ==================================================================== *
 *  KÖŞE ŞUBESİ — DİKEY (portre) plan, 18 × 39 birim, ODA ODA
 *
 *  x: -9 ─────────── 9          Mekân üç kattan oluşur ve odalar
 *  z-18 ┌── AÇIK MUTFAK ──┐     DERİNLEMESİNE dizilir (portre kilidi,
 *       │ [M] [M] [M] [M] │     kamera yaw 0):
 *  z-13 │ [M] [M] [M] [M] │
 *  z-10 │ [KÂĞ] [WC] [WC] │      · ÖN SALON (hep açık): bar + 6 masa
 *  z -8 ══ personel koridoru ══   · SALON ODASI (r1): duvar + kapı ile
 *  z -4 ▬ RAFLAR + 2 KASA ▬▬▬       ayrı oda, 3 masa
 *  z -2 ── sipariş sırası ──      · VIP SALON (r2): en pahalı oda,
 *  z  2 │  ▣    ▣    ▣    │        mermer VIP masalar (hesap 2,4×)
 *  z  6 │  ▣    ▣    ▣    │
 *  z  9 ├── SALON ODASI ──┤╷     Doğu şeridi (x 4,4…9) ANA KORİDORDUR:
 *  z 12 │  ▣    ▣    ▣   [K]     sokak kapısından bara kesintisiz uzanır,
 *  z 14 ├── VIP SALON  ───┤O     oda kapıları bu koridora açılır. Odalar
 *  z 18 │  ♦    ♦    ♦   [R]     kilitliyken koridor sayesinde müşteri
 *  z 21 └───────── GİRİŞ ─┘╵     akışı hiç kesilmez.
 *
 *  Üç kural: 1. Bar hattı ızgarada süreklidir (gövdeler 0,15 bindirir).
 *  2. Masa gövdeleri arası ≥ 1,6 birim; 0,15–0,95 aralığı TUZAKTIR
 *     (bkz. validateClearances). 3. Her konum gövde yarı-boyutundan
 *     hesaplanır; World.validateLayout() açılışta kanıtlar.
 * ==================================================================== */

/** Mutfak sütunları — aralık 3,45; makine yarı-x ≤1,05 → boşluk ≥1,35. */
const KX = [-6.9, -3.45, 0, 3.45, 6.9];
/** Mutfak satırları. */
const KZ_BACK = -16.0;
const KZ_FRONT = -12.6;
/** Bar hattının z konumu. */
const BAR_Z = -4.4;

const KOSE: StationDef[] = [
  /* ================= a1 · KAFE (başlangıç) ================= *
   * Semaver + ÇAY RAFI + kasa + TEK masa. Yeni oyuncunun ekranında karar
   * gerektiren tek döngü: sipariş al → parayı topla → çayı al → RAFA KOY;
   * masada yiyecek müşteriye oyuncu servis eder; paket sipariş rafı kullanır.
   *
   * BAR HATTI (z −4,4), batıdan doğuya: 5 raf (1,5'lik gövde, 1,35
   * aralık — 0,15 bindirme kuralı) + 2 kasa. Batı ucunda duvara 1,9
   * birimlik PERSONEL geçidi kalır (≥1,6); müşteri trafiği doğu ana
   * koridorundan (x 4,4…9) akar. Her rafın makinesi mutfakta hemen
   * arkasındadır — ikmal yürüyüşü kısa.                                  */
  S({ id: 'k_semaver', name: tr("Semaver"), kind: 'machine', visual: 'samovar', location: 'kose', zone: 'a1', dept: 'bar',
      x: -6.9, z: -11.4, rot: 0, item: 'cay', time: 1.8, outputCap: 6, speedCost: 120, capCost: 90, menuOrder: 0 }),
  S({ id: 'k_raf_cay', name: tr("Çay Rafı"), kind: 'pickup', visual: 'shelf', location: 'kose', zone: 'a1', dept: 'bar',
      x: -6.45, z: -4.4, rot: 0, item: 'cay', time: 0, outputCap: 8, capCost: 200 }),
  S({ id: 'k_tezgah_1', name: tr("Kasa"), kind: 'counter', visual: 'counter', location: 'kose', zone: 'a1', dept: 'bar',
      x: 3.0, z: -4.4, rot: 0, time: 1.8, outputCap: 0, speedCost: 260 }),
  S({ id: 'k_masa_1', name: tr("Masa 1"), kind: 'table', visual: 'table', location: 'kose', zone: 'a1', dept: 'salon',
      x: -5.2, z: 2.2, rot: 0, time: 11, outputCap: 0, seats: 2, serviceCode: 'M1', capCost: 260 }),
  S({ id: 'k_supurge', name: tr("Süpürge Yeri"), kind: 'vacuum', visual: 'vacuumdock', location: 'kose', zone: 'a1', dept: 'salon',
      x: -7.4, z: -1.5, rot: 90, time: 0, outputCap: 0 }),
  /**
   * Kova bilerek süpürge dolabından UZAKTA durur (x aynı, z 6,1 birim
   * ötede — etkileşim yarıçapı 2,9'un iki katından fazla). Eskiden ikisi
   * 2,5 birim arayla yan yanaydı: bulaşığı kovaya atmaya giden oyuncu aynı
   * anda süpürgenin de menziline giriyor, yanlışlıkla süpürgeyi kapıyordu
   * ("yan yana duruyor karışıyor" geri bildirimi). Masa 1'e yakınlığını da
   * korur (dx 2,4 · dz 2,4).
   */
  /** Kova salona (doğuya) bakar: kapağı/pedalı oyuncunun geldiği yöndedir. */
  S({ id: 'k_kova_1', name: tr("Bulaşık Kovası"), kind: 'bin', visual: 'bin', location: 'kose', zone: 'a1', dept: 'salon',
      x: -8.5, z: 4.8, rot: 90, time: 0, outputCap: 0 }),

  /* ================= ÖN SALON MASALARI (t1…t5) ================= *
   * İki sıra: z 2,2 ve z 6,0. Sıra arası boşluk 3,8−1,44 = 2,36; sütun
   * arası 5,2−1,44 = 3,76 — tuzak bandının (0,15–0,95) çok üstünde.
   * İlk açılım bilerek çok ucuz: oyuncu ilk yarım dakikada "pede bas →
   * mekân büyüdü" hissini almalı.                                        */
  S({ id: 'k_masa_2', name: tr("Masa 2"), kind: 'table', visual: 'table', location: 'kose', zone: 't1', dept: 'salon',
      x: 0.0, z: 2.2, rot: 0, time: 11, outputCap: 0, seats: 2, serviceCode: 'M2', capCost: 260 }),
  S({ id: 'k_masa_3', name: tr("Masa 3"), kind: 'table', visual: 'table', location: 'kose', zone: 't2', dept: 'salon',
      x: 5.2, z: 2.2, rot: 0, time: 11, outputCap: 0, seats: 4, serviceCode: 'M3', capCost: 420 }),
  S({ id: 'k_masa_4', name: tr("Masa 4"), kind: 'table', visual: 'tablesq', location: 'kose', zone: 't3', dept: 'salon',
      x: -5.2, z: 6.0, rot: 0, time: 11, outputCap: 0, seats: 4, serviceCode: 'M4', capCost: 520 }),
  S({ id: 'k_masa_5', name: tr("Masa 5"), kind: 'table', visual: 'tablesq', location: 'kose', zone: 't4', dept: 'salon',
      x: 0.0, z: 6.0, rot: 0, time: 11, outputCap: 0, seats: 2, serviceCode: 'M5', capCost: 900 }),
  S({ id: 'k_masa_6', name: tr("Masa 6"), kind: 'table', visual: 'table', location: 'kose', zone: 't5', dept: 'salon',
      x: 5.2, z: 6.0, rot: 0, time: 11, outputCap: 0, seats: 4, serviceCode: 'M6', capCost: 900 }),

  /* ================= a3 · KAHVE ================= */
  S({ id: 'k_sutbar', name: tr("Kahve Barı"), kind: 'machine', visual: 'steamer', location: 'kose', zone: 'a3', dept: 'bar',
      x: -3.45, z: -11.4, rot: 0, item: 'latte', time: 3.0, outputCap: 6, speedCost: 850, capCost: 650, menuOrder: 1 }),
  S({ id: 'k_raf_latte', name: tr("Kahve Rafı"), kind: 'pickup', visual: 'shelf', location: 'kose', zone: 'a3', dept: 'bar',
      x: -4.85, z: -4.4, rot: 0, item: 'latte', time: 0, outputCap: 8, capCost: 750 }),

  /* ================= a4 · TOST ================= */
  S({ id: 'k_tost', name: tr("Tost Makinesi"), kind: 'machine', visual: 'panini', location: 'kose', zone: 'a4', dept: 'bar',
      x: 0.0, z: -11.4, rot: 0, item: 'tost', time: 4.2, outputCap: 5, speedCost: 2400, capCost: 1900, menuOrder: 2 }),
  S({ id: 'k_raf_tost', name: tr("Tost Rafı"), kind: 'pickup', visual: 'shelf', location: 'kose', zone: 'a4', dept: 'bar',
      x: -3.25, z: -4.4, rot: 0, item: 'tost', time: 0, outputCap: 8, capCost: 2100 }),

  /* ================= a5 · SALON HATTI ================= *
   * İkinci kasa: sıra ikiye bölünür, sipariş kuyruğu kısalır.            */
  S({ id: 'k_tezgah_2', name: tr("İkinci Kasa"), kind: 'counter', visual: 'counter', location: 'kose', zone: 'a5', dept: 'bar',
      x: 5.65, z: -4.4, rot: 0, time: 1.6, outputCap: 0, speedCost: 3600 }),
  /* Kova doğu duvarından 0,96 birim içeride: 8,1'deyken duvar gövdesiyle
   * arasında 0,46'lık TUZAK bandı kalıyordu (doğrulayıcı yakaladı).       */
  S({ id: 'k_kova_2', name: tr("Salon Kovası"), kind: 'bin', visual: 'bin', location: 'kose', zone: 'a5', dept: 'salon',
      x: 8.5, z: 4.8, rot: -90, time: 0, outputCap: 0 }),

  /* a6 · Courtyard restrooms: adjacent private stalls and supplies inside
   * the separate room. Stable station ids retain existing saved upgrades. */
  S({ id: 'k_wc_1', name: tr("Tuvalet A"), kind: 'toilet', visual: 'toilet', location: 'kose', zone: 'a6', dept: 'servis',
      x: 10.64, z: -15.72, rot: 0, time: 5, outputCap: 0, capCost: 6200,
      supplies: [{ item: 'pecete', cap: 6 }, { item: 'kagit', cap: 6 }] }),
  S({ id: 'k_wc_2', name: tr("Tuvalet B"), kind: 'toilet', visual: 'toilet', location: 'kose', zone: 'a6', dept: 'servis',
      x: 13.36, z: -15.72, rot: 0, time: 5, outputCap: 0, capCost: 6200,
      supplies: [{ item: 'pecete', cap: 6 }, { item: 'kagit', cap: 6 }] }),
  S({ id: 'k_pecete', name: tr("Peçete Kutusu"), kind: 'supply', visual: 'napkinbox', location: 'kose', zone: 'a6', dept: 'servis',
      x: 11.4, z: -10.82, rot: 180, item: 'pecete', time: 2.4, outputCap: 8, speedCost: 5800, capCost: 4600 }),
  S({ id: 'k_kagit', name: tr("Kâğıt Rafı"), kind: 'supply', visual: 'papershelf', location: 'kose', zone: 'a6', dept: 'servis',
      x: 14.7, z: -10.82, rot: 180, item: 'kagit', time: 2.8, outputCap: 8, speedCost: 5800, capCost: 4600 }),

  /* ================= r1 · SALON ODASI ================= *
   * İlk ODA: duvar + kapıyla ayrılır. Oda satın alındığında ilk masası
   * hediye gelir; kalan masalar tek tek açılır. (Bir ara odaya duvar
   * dibinde bir teslim bankosu kondu — doğrulayıcı servis noktasının
   * duvarın İÇİNE düştüğünü, müşteri noktasının da Masa 7'nin gövdesine
   * bindiğini yakaladı. Oda bankosuz daha ferah; servis ana bardan.)     */
  S({ id: 'k_masa_7', name: tr("Masa 7"), kind: 'table', visual: 'tablesq', location: 'kose', zone: 'r1', dept: 'salon',
      x: 15.0, z: 15.8, rot: 0, time: 11, outputCap: 0, seats: 4, serviceCode: 'M7', capCost: 8200 }),
  S({ id: 'k_masa_8', name: tr("Masa 8"), kind: 'table', visual: 'tablesq', location: 'kose', zone: 't6', dept: 'salon',
      x: 15.0, z: 12.1, rot: 0, time: 11, outputCap: 0, seats: 4, serviceCode: 'M8', capCost: 9500 }),
  S({ id: 'k_masa_9', name: tr("Masa 9"), kind: 'table', visual: 'table', location: 'kose', zone: 't7', dept: 'salon',
      x: 11.4, z: 15.8, rot: 0, time: 11, outputCap: 0, seats: 4, serviceCode: 'M9', capCost: 12500 }),

  /* ================= a7 · WAFFLE ================= */
  S({ id: 'k_waffle', name: tr("Vafıl Makinesi"), kind: 'machine', visual: 'wafflemaker', location: 'kose', zone: 'a7', dept: 'bar',
      x: 3.26, z: -11.4, rot: 0, item: 'waffle', time: 5.2, outputCap: 5, speedCost: 10500, capCost: 8500, menuOrder: 3 }),
  S({ id: 'k_raf_waffle', name: tr("Vafıl Rafı"), kind: 'pickup', visual: 'shelf', location: 'kose', zone: 'a7', dept: 'bar',
      x: -1.65, z: -4.4, rot: 0, item: 'waffle', time: 0, outputCap: 8, capCost: 9000 }),

  /* ================= a8 · FRAPPE ================= */
  S({ id: 'k_frappe', name: tr("Buzlu Kahve Blenderi"), kind: 'machine', visual: 'blender', location: 'kose', zone: 'a8', dept: 'bar',
      x: 6.49, z: -11.4, rot: 0, item: 'frappe', time: 6.0, outputCap: 5, speedCost: 18500, capCost: 15000, menuOrder: 4 }),
  S({ id: 'k_raf_frappe', name: tr("Buzlu Kahve Rafı"), kind: 'pickup', visual: 'shelf', location: 'kose', zone: 'a8', dept: 'bar',
      x: -0.05, z: -4.4, rot: 0, item: 'frappe', time: 0, outputCap: 8, capCost: 16000 }),

  /* ================= r2 / v1 / v2 · VIP SALON ================= *
   * En pahalı oda: mermer tablalı VIP masalar. Hesap ve bahşiş 2,4×.
   * Oda ile ilk masa birlikte gelir; diğer ikisi ayrı ayrı satın alınır. */
  S({ id: 'k_vip_1', name: tr("VIP Masa 1"), kind: 'table', visual: 'viptable', location: 'kose', zone: 'r2', dept: 'salon',
      x: -14.9, z: 15.8, rot: 0, time: 14, outputCap: 0, seats: 2, serviceCode: 'V1', vip: true, capCost: 32000 }),
  S({ id: 'k_vip_2', name: tr("VIP Masa 2"), kind: 'table', visual: 'viptable', location: 'kose', zone: 'v1', dept: 'salon',
      x: -14.9, z: 12.2, rot: 0, time: 14, outputCap: 0, seats: 2, serviceCode: 'V2', vip: true, capCost: 26000 }),
  S({ id: 'k_vip_3', name: tr("VIP Loca"), kind: 'table', visual: 'viptable', location: 'kose', zone: 'v2', dept: 'salon',
      x: -11.6, z: 15.8, rot: 0, time: 15, outputCap: 0, seats: 4, serviceCode: 'V3', vip: true, capCost: 34000 }),
];

/* ==================================================================== *
 *  SAHİL ŞUBESİ — daha da küçük, üç makine, yedi masa, iki kasa.
 *
 *  Hız/kapasite tabanı, o istasyonun açıldığı bölgenin ~%60-70'i
 *  olacak şekilde dengelendi; böylece 2. şube açıldığında ilk yükseltmeler
 *  40 dakikalık duvar yerine akıcı bir ilerleme sunar. Kayıt seviye saklar
 *  (StationSave.s), fiyatı değil. Büyüme 1,52 aynı kalır.
 * ==================================================================== */

const SAHIL: StationDef[] = [
  S({ id: 's_smoothie', name: tr("Meyve Barı"), kind: 'machine', visual: 'juicebar', location: 'sahil', zone: 'p1', dept: 'bar',
      x: -7.2, z: -8.4, rot: 0, item: 'smoothie', time: 3.4, outputCap: 8, speedCost: 65000, capCost: 52000, menuOrder: 0 }),
  S({ id: 's_raf_smoothie', name: tr("Meyve Rafı"), kind: 'pickup', visual: 'shelf', location: 'sahil', zone: 'p1', dept: 'bar',
      x: -6.2, z: -1.0, rot: 0, item: 'smoothie', time: 0, outputCap: 10, capCost: 56000 }),
  S({ id: 's_tezgah_1', name: tr("Kumsal Tezgâhı"), kind: 'counter', visual: 'counter', location: 'sahil', zone: 'p1', dept: 'bar',
      x: -3.4, z: -1.0, rot: 0, time: 1.5, outputCap: 0, speedCost: 58000 }),
  S({ id: 's_masa_1', name: tr("Kum Masası 1"), kind: 'table', visual: 'table', location: 'sahil', zone: 'p1', dept: 'salon',
      x: -7.6, z: 4.2, rot: 0, time: 11, outputCap: 0, seats: 4, serviceCode: 'S1', outdoor: true, capCost: 48000 }),
  S({ id: 's_masa_2', name: tr("Kum Masası 2"), kind: 'table', visual: 'table', location: 'sahil', zone: 'p1', dept: 'salon',
      x: -2.8, z: 4.6, rot: 0, time: 11, outputCap: 0, seats: 2, serviceCode: 'S2', outdoor: true, capCost: 48000 }),
  S({ id: 's_supurge', name: tr("Sahil Süpürgesi"), kind: 'vacuum', visual: 'vacuumdock', location: 'sahil', zone: 'p1', dept: 'salon',
      x: 3.8, z: -8.4, rot: 0, time: 0, outputCap: 0 }),
  S({ id: 's_kova_1', name: tr("Kumsal Kovası"), kind: 'bin', visual: 'bin', location: 'sahil', zone: 'p1', dept: 'salon',
      x: -10.0, z: 1.6, rot: 90, time: 0, outputCap: 0 }),

  S({ id: 's_dondurma', name: tr("Dondurma Makinesi"), kind: 'machine', visual: 'icecream', location: 'sahil', zone: 'p2', dept: 'bar',
      x: -3.6, z: -8.4, rot: 0, item: 'dondurma', time: 4.2, outputCap: 6, speedCost: 82000, capCost: 66000, menuOrder: 1 }),
  S({ id: 's_raf_dondurma', name: tr("Dondurma Rafı"), kind: 'pickup', visual: 'shelf', location: 'sahil', zone: 'p2', dept: 'bar',
      x: -7.55, z: -1.0, rot: 0, item: 'dondurma', time: 0, outputCap: 8, capCost: 70000 }),
  S({ id: 's_masa_3', name: tr("Kum Masası 3"), kind: 'table', visual: 'table', location: 'sahil', zone: 'p2', dept: 'salon',
      x: 2.0, z: 4.4, rot: 0, time: 11, outputCap: 0, seats: 4, serviceCode: 'S3', outdoor: true, capCost: 64000 }),
  S({ id: 's_masa_4', name: tr("Kum Masası 4"), kind: 'table', visual: 'table', location: 'sahil', zone: 'p2', dept: 'salon',
      x: -5.2, z: 9.0, rot: 0, time: 11, outputCap: 0, seats: 4, serviceCode: 'S4', outdoor: true, capCost: 64000 }),

  S({ id: 's_shake', name: tr("Sütlü Kokteyl Barı"), kind: 'machine', visual: 'blender', location: 'sahil', zone: 'p3', dept: 'bar',
      x: 0.0, z: -8.4, rot: 0, item: 'milkshake', time: 5.0, outputCap: 6, speedCost: 135000, capCost: 110000, menuOrder: 2 }),
  S({ id: 's_raf_shake', name: tr("Sütlü Kokteyl Rafı"), kind: 'pickup', visual: 'shelf', location: 'sahil', zone: 'p3', dept: 'bar',
      x: -8.9, z: -1.0, rot: 0, item: 'milkshake', time: 0, outputCap: 8, capCost: 115000 }),
  S({ id: 's_masa_5', name: tr("Teras 1"), kind: 'table', visual: 'table', location: 'sahil', zone: 'p3', dept: 'salon',
      x: 6.8, z: 4.6, rot: 0, time: 13, outputCap: 0, seats: 4, serviceCode: 'S5', outdoor: true, capCost: 105000 }),
  /**
   * GİRİŞ KORİDORUNDAN ÇEKİLDİ (x 0,4 → −0,6).
   *
   * Kapı (2,0 / 11,4) ve doğrulayıcı kapı ekseninde 1,1 birimlik serbest
   * koridor istiyor; bu masa 0,72 gövdesiyle yalnız 0,88 bırakıyordu ve
   * `KAPI TIKALI` veriyordu. Ceza görünmez ama ağırdır: çıkamayan müşteri
   * nüfus tavanını kilitler, yani kafe sessizce müşteri almayı bırakır.
   *
   * Neden z'de değil x'te çözüldü: kapı kontrol noktaları 1,2 birim
   * aralıklı, masanın yarı gövdesi 0,72 → iki komşu noktadan aynı anda
   * 1,82 uzakta durmak imkânsız (1,2 < 2×1,82). Koridordan ancak yana
   * çekilerek çıkılır. Yeni boşluk 1,88 (gereken 1,1).
   */
  S({ id: 's_masa_6', name: tr("Teras 2"), kind: 'table', visual: 'table', location: 'sahil', zone: 'p3', dept: 'salon',
      x: -0.6, z: 9.2, rot: 0, time: 13, outputCap: 0, seats: 6, serviceCode: 'S6', outdoor: true, capCost: 105000 }),
  S({ id: 's_kova_2', name: tr("Teras Kovası"), kind: 'bin', visual: 'bin', location: 'sahil', zone: 'p3', dept: 'salon',
      x: 9.6, z: 9.6, rot: 0, time: 0, outputCap: 0 }),

  /* ================= p4 · SAHİL HATTI (İkinci Kasa) ================= */
  S({ id: 's_tezgah_2', name: tr("İkinci Kumsal Kasası"), kind: 'counter', visual: 'counter', location: 'sahil', zone: 'p4', dept: 'bar',
      x: 4.4, z: -1.0, rot: 0, time: 1.4, outputCap: 0, speedCost: 185000 }),

  /* ================= p5 · İSKELE VIP LOCA ================= */
  S({ id: 's_vip_1', name: tr("İskele VIP Loca"), kind: 'table', visual: 'viptable', location: 'sahil', zone: 'p5', dept: 'salon',
      x: 6.2, z: 8.8, rot: 0, time: 14, outputCap: 0, seats: 4, serviceCode: 'SV1', vip: true, outdoor: true, capCost: 260000 }),
];

export const ALL_STATIONS: StationDef[] = [...KOSE, ...SAHIL];

export const STATION_DEFS: Record<string, StationDef> = Object.fromEntries(
  ALL_STATIONS.map((s) => [s.id, s]),
);

export function stationsOfLocation(locationId: string): StationDef[] {
  return ALL_STATIONS.filter((s) => s.location === locationId);
}

const STATIONS_AT = new Map<string, readonly StationDef[]>();
/** Shared read-only list for per-frame callers; never mutate the result. */
export function stationsAt(locationId: string): readonly StationDef[] {
  let list = STATIONS_AT.get(locationId);
  if (!list) STATIONS_AT.set(locationId, list = stationsOfLocation(locationId));
  return list;
}

export function stationDef(id: string): StationDef {
  const d = STATION_DEFS[id];
  if (!d) throw new Error(`Bilinmeyen istasyon: ${id}`);
  return d;
}
