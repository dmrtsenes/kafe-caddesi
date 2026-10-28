import { ZONE_COSTS, BRANCH_COSTS } from './economy';
import { CAFE_PRESENTATION } from './cafePresentation';
import { RESTROOM_SUITE } from './restrooms';
import { tr } from "../core/I18n";
import { stationsOfLocation, type DeptId, type StationDef } from './stations';
import type { StaffRole } from './staff';

export type { DeptId };

/**
 * Bir bölüm = mekânın PARA İLE AÇILAN bir parçası.
 *
 * Artık "duvarlı bay" yok. Kafe tek, açık bir mekândır; kilitli bölümün
 * eşyaları oradadır ama ÜSTÜ ÖRTÜLÜDÜR — beyaz koruma brandası altında
 * bekleyen makineler ve masalar. Ödeme pedine basınca branda uçar, eşya
 * ortaya çıkar. Dönüşüm hissi bundan gelir; şantiye panolarına, kemerlere,
 * departman tabelalarına gerek yok (ve onlar mekânı koridora çeviriyordu).
 */
/**
 * ODA — bir bölüme bağlı, duvarlarla çevrili mekân parçası.
 *
 * Duvarlar hem görsel (Environment) hem çarpışma (World.rebuildNav) olarak
 * AYNI veriden (`roomWalls`) kurulur; iki taraf birbirinden kopamaz.
 * Oda kilitliyken kapısı KAPALIDIR ve içindeki her şey gizlidir; bölüm
 * satın alınınca kapı boşluğu açılır, oda ortaya çıkar.
 */
export interface RoomDef {
  /** Oda zemin dikdörtgeni (duvar orta hattı bu kenarlardan geçer). */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /**
   * Kapı. `edge` hangi duvarda olduğunu söyler:
   *   'n' → KUZEY duvarı (z0 kenarı). Kapının geniş yüzü kameraya bakar —
   *         portre kamera kuzeye baktığı için OYUNCUNUN GÖRDÜĞÜ kapı budur.
   *   'e' → DOĞU duvarı (x1 kenarı). Kameraya kenardan görünür; ilk oda
   *         tasarımı bu yüzden "kapı yok" sanılmıştı. Sadece yan koridora
   *         açılması gereken istisnalar için durur.
   * `pos` kapı merkezinin dünya koordinatı (n → x, e → z).
   */
  door: {
    /**
     * 'w' → BATI duvarı (x0 kenarı). 'e'nin aynası; ana salonun DOĞUSUNA
     * yapışan ek yapının salona bakan portali budur.
     */
    edge: 'n' | 'e' | 'w';
    pos: number;
    w: number;

    wrap?: 'w' | 'e';
  };
  /**
   * Odanın zemin KOTU (birim). Yalnızca GÖRSELDİR: navigasyon ızgarası
   * iki boyutludur, A* ve gövde çarpışması bu değeri hiç görmez. Oda
   * girişine bir merdiven konur, oda içindeki mobilya/karakter/kir bu
   * kadar yükseltilir.
   *
   * Neden var: iki oda alt alta iki eş dikdörtgen olarak okunuyordu
   * ("3-5 basamaklı bir merdiven koyup farklı bir alan eklenebilirdi").
   * Kot farkı, mekânı tek düzlem olmaktan çıkaran en ucuz mimari araçtır.
   */
  lift?: number;

  style?: 'oda' | 'teras' | 'restroom';
}

/** Duvar kalınlığının yarısı (birim). Nav ve görsel aynı değeri kullanır. */
export const ROOM_WALL_HALF = 0.15;

export interface ZoneDef {
  id: string;
  /** Bölüm adı — ödeme pedinde ve bildirimde bu yazar */
  name: string;
  /** Açma bedeli (₺). 0 → başlangıçta açık. */
  cost: number;
  /** Bu bölüm açılmadan önce açılması gereken bölüm */
  requires?: string;
  dept: DeptId;
  /** Pedin ve açılış efektinin rengi */
  accent: number;
  /** Ödeme pedinin dünya konumu — açılacak eşyanın hemen yanında */
  padX: number;
  padZ: number;
  /** Bu bölüm bir ODAYI açar (duvar + kapı). */
  room?: RoomDef;
  blurb: string;
}

/** Bir oda duvar parçası — dünya uzayında eksenlere hizalı dikdörtgen. */
export interface RoomWallRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Hangi bölümün odasına ait — kapı kilidi görselinde kullanılır. */
  zone: string;
}

/**
 * Bir mekânın TÜM oda duvarlarını üretir: kuzey duvarı, kapı boşluklu doğu
 * duvarı ve (bitişik oda yoksa) güney duvarı. Mekân dış duvarlarıyla çakışan
 * kenarlara duvar örülmez; bitişik odaların ortak kenarı TEK duvar olur
 * (yoksa iki eş kutu üst üste biner ve z-fighting yapar).
 */
export function roomWalls(loc: LocationDef): RoomWallRect[] {
  const walls: RoomWallRect[] = [];
  const H = ROOM_WALL_HALF;
  const b = loc.bounds;
  const rooms = loc.zones.filter((z) => z.room);
  const nearEdge = (v: number, edge: number) => Math.abs(v - edge) < 0.5;
  const sharesLine = (z: number, other: ZoneDef) =>
    other.room !== undefined && Math.abs(other.room.z0 - z) < 0.3;

  for (const zone of rooms) {
    const r = zone.room!;
    const d = r.door;

    // Kuzey duvarı (z0) — mekân kenarında değilse. Kapı buradaysa iki parça.
    if (!nearEdge(r.z0, b.z0)) {
      if (d.edge === 'n') {
        const gx0 = d.pos - d.w / 2;
        const gx1 = d.pos + d.w / 2;
        if (gx0 > r.x0 + 0.2) {
          walls.push({ x0: r.x0, z0: r.z0 - H, x1: gx0, z1: r.z0 + H, zone: zone.id });
        }
        if (gx1 < r.x1 - 0.2) {
          walls.push({ x0: gx1, z0: r.z0 - H, x1: r.x1 + H, z1: r.z0 + H, zone: zone.id });
        }
      } else {
        walls.push({ x0: r.x0, z0: r.z0 - H, x1: r.x1 + H, z1: r.z0 + H, zone: zone.id });
      }
    }
    // Güney duvarı (z1) — mekân kenarında değilse ve başka odanın kuzeyi değilse.
    if (!nearEdge(r.z1, b.z1) && !rooms.some((o) => o !== zone && sharesLine(r.z1, o))) {
      walls.push({ x0: r.x0, z0: r.z1 - H, x1: r.x1 + H, z1: r.z1 + H, zone: zone.id });
    }
    // Batı duvarı (x0) — mekân kenarında değilse. Kapı buradaysa iki parça;
    // köşe girişi varsa (`wrap: 'w'`) kuzey ucundan `door.w` kadar geç başlar.
    if (!nearEdge(r.x0, b.x0)) {
      if (d.edge === 'w') {
        const gz0 = d.pos - d.w / 2;
        const gz1 = d.pos + d.w / 2;
        if (gz0 > r.z0 + 0.2) {
          walls.push({ x0: r.x0 - H, z0: r.z0 - H, x1: r.x0 + H, z1: gz0, zone: zone.id });
        }
        if (gz1 < r.z1 - 0.2) {
          walls.push({ x0: r.x0 - H, z0: gz1, x1: r.x0 + H, z1: r.z1 + H, zone: zone.id });
        }
      } else {
        const wz0 = d.wrap === 'w' ? r.z0 + d.w : r.z0 - H;
        if (wz0 < r.z1 - 0.2) {
          walls.push({ x0: r.x0 - H, z0: wz0, x1: r.x0 + H, z1: r.z1 + H, zone: zone.id });
        }
      }
    }
    // Doğu duvarı (x1) — mekân kenarında değilse. Kapı buradaysa iki parça.
    if (!nearEdge(r.x1, b.x1)) {
      if (d.edge === 'e') {
        const gz0 = d.pos - d.w / 2;
        const gz1 = d.pos + d.w / 2;
        if (gz0 > r.z0 + 0.2) {
          walls.push({ x0: r.x1 - H, z0: r.z0 - H, x1: r.x1 + H, z1: gz0, zone: zone.id });
        }
        if (gz1 < r.z1 - 0.2) {
          walls.push({ x0: r.x1 - H, z0: gz1, x1: r.x1 + H, z1: r.z1 + H, zone: zone.id });
        }
      } else {
        // Köşe girişi (`wrap: 'e'`) doğu duvarını kuzey ucundan kısaltır.
        const ez0 = d.wrap === 'e' ? r.z0 + d.w : r.z0 - H;
        if (ez0 < r.z1 - 0.2) {
          walls.push({ x0: r.x1 - H, z0: ez0, x1: r.x1 + H, z1: r.z1 + H, zone: zone.id });
        }
      }
    }
  }
  return walls;
}

/** Kilitli odanın kapı boşluğunu kapatan tıpa — nav bunu ayrıca bloklar. */
/**
 * Bir dünya noktasının GÖRSEL zemin kotu.
 *
 * Navigasyon iki boyutludur; kot yalnızca çizime uygulanır (mobilya,
 * karakter, kir). Oda kilitliyken de kot geçerlidir: brandalar da yükseltide
 * durur, yoksa açılış anında her şey zıplar.
 */
/**
 * Merdivenin toplam ilerlemesi — `Environment` ile AYNI olmak ZORUNDA
 * (5 basamak × 0,34 birim). İkisi ayrışırsa karakter ya basamağın içine
 * gömülür ya havada yürür.
 */
export const STAIR_RUN = 1.7;

export function floorLiftAt(loc: LocationDef, x: number, z: number): number {
  for (const zone of loc.zones) {
    const r = zone.room;
    if (!r || !r.lift) continue;
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.lift;


    const d = r.door;
    if (!d) continue;
    if (d.edge === 'n') {
      // Basamaklar odanın kuzeyinde, dışa doğru iner.
      const q = r.z0 - z;
      if (q >= 0 && q <= STAIR_RUN && Math.abs(x - d.pos) <= d.w / 2) {
        return r.lift * (1 - q / STAIR_RUN);
      }
      continue;
    }
    // Yan kapı: basamaklar x ekseninde, odadan dışarı doğru.
    const dx = d.edge === 'w' ? r.x0 : r.x1;
    const side = d.edge === 'w' ? -1 : 1;
    const q = (x - dx) * side;
    if (q >= 0 && q <= STAIR_RUN && Math.abs(z - d.pos) <= d.w / 2) {
      return r.lift * (1 - q / STAIR_RUN);
    }
  }
  if (loc.id === 'kose' && Math.abs(x) >= 9.3 && Math.abs(x) <= 17.3 && z >= -17.5 && z <= 9.2) return 0.1;
  return 0;
}

/**
 * Kilitli odanın kapı boşluğunu kapatan tıpa(lar).
 *
 * KÖŞE GİRİŞİNDE İKİ PARÇA döner: kuzey boşluğu ve yan duvardaki boşluk.
 * Tek parça dönseydi kilitli odaya YANDAN girilebilirdi — duvarın o ucu
 * `roomWalls` tarafından zaten açık bırakılıyor.
 */
export function roomDoorPlugs(zone: ZoneDef): RoomWallRect[] {
  const r = zone.room;
  if (!r) return [];
  const H = ROOM_WALL_HALF;
  const d = r.door;
  const out: RoomWallRect[] = [];
  if (d.wrap === 'w') {
    out.push({ x0: r.x0 - H, z0: r.z0 - H, x1: r.x0 + H, z1: r.z0 + d.w, zone: zone.id });
  } else if (d.wrap === 'e') {
    out.push({ x0: r.x1 - H, z0: r.z0 - H, x1: r.x1 + H, z1: r.z0 + d.w, zone: zone.id });
  }
  if (d.edge === 'n') {
    out.push({
      x0: d.pos - d.w / 2,
      z0: r.z0 - H,
      x1: d.pos + d.w / 2,
      z1: r.z0 + H,
      zone: zone.id,
    });
    return out;
  }
  if (d.edge === 'w') {
    out.push({
      x0: r.x0 - H,
      z0: d.pos - d.w / 2,
      x1: r.x0 + H,
      z1: d.pos + d.w / 2,
      zone: zone.id,
    });
    return out;
  }
  out.push({
    x0: r.x1 - H,
    z0: d.pos - d.w / 2,
    x1: r.x1 + H,
    z1: d.pos + d.w / 2,
    zone: zone.id,
  });
  return out;
}

export type DecorKind =
  | 'plant'
  | 'hangplant'
  | 'sofa'
  | 'chalkboard'
  | 'wallart'
  | 'flowerpot'
  | 'coffeesack'
  | 'crate'
  | 'bookshelf'
  | 'umbrella'
  | 'palm'
  | 'heater'
  | 'stool'
  | 'rug'
  | 'neon'
  | 'bench'
  | 'planter'
  | 'topiary'
  | 'lantern'
  | 'bikerack'
  | 'gramofon'
  | 'tabela';


export interface DecorBox {
  x: number;
  z: number;
}

export const DECOR_BOX: Record<DecorKind, DecorBox | null> = {
  plant: { x: 0.34, z: 0.34 }, // saksı r 0,28 + yapraklar
  hangplant: null, // tavanda
  sofa: { x: 1.02, z: 0.45 }, // gövde 2,0 × 0,85 + kolçaklar
  /**
   * Ayaklı tebeşir tahtası ARTIK ENGEL. "Duvara asılı" diye 0 verilmişti
   * ama iki örneği de yerde duruyor (bar yanı ve giriş): oyuncu içinden
   * geçebiliyordu. Kapı koridoru denetimi bunu ayrıca ölçer.
   */
  chalkboard: { x: 0.7, z: 0.28 },
  wallart: null, // duvarda
  flowerpot: { x: 0.28, z: 0.28 },
  // Kahve çuvalı ve şemsiye KASITLI olarak istasyona yaslanır/üstüne
  // kurulur (bar dekoru, teras masasının şemsiyesi). Engel sayılırlarsa
  // doğrulayıcı kendi set dekorunu hata olarak bildirir.
  coffeesack: null,
  crate: { x: 0.4, z: 0.4 },
  bookshelf: { x: 0.76, z: 0.24 },
  umbrella: null,
  palm: { x: 0.3, z: 0.3 }, // yalnız gövde; yapraklar baş hizasının üstünde
  heater: { x: 0.33, z: 0.33 },
  stool: { x: 0.27, z: 0.27 },
  rug: null, // zemine serili
  neon: null, // duvarda
  /**
   * Dolgu mobilyası — hepsi gerçekten yer kaplar, hepsi duvar dibinde
   * durur. Uzun eksenleri yerel +X'tir ve `rot` ile birlikte döner;
   * çarpışma kutusu dönmüş AABB olarak hesaplanır.
   */
  bench: { x: 0.78, z: 0.32 },
  planter: { x: 0.92, z: 0.32 },
  topiary: { x: 0.32, z: 0.32 },
  lantern: { x: 0.19, z: 0.19 },
  bikerack: { x: 0.62, z: 0.26 },
  /**
   * v5.1 yan dal dekorları. Kutu yalnız KATI parçayı sayar: gramofonda
   * çalar dolabı (kilim halı gibi serilidir), tabelada kaide+direk (pano
   * karakter boyunun üstünde, y ≈ 1,7-2,5).
   */
  gramofon: { x: 0.33, z: 0.27 },
  tabela: { x: 0.26, z: 0.26 },
};

/**
 * Bir dekor parçasının DÜNYA eksenine hizalı yarı boyutu.
 * Dönmüş dikdörtgenin AABB'si: |hx·cos| + |hz·sin| (ve simetriği).
 * Engel değilse `null`.
 */
export function decorHalf(d: DecorDef): DecorBox | null {
  const b = DECOR_BOX[d.kind];
  if (!b) return null;
  const s = d.scale ?? 1;
  const a = ((d.rot ?? 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const n = Math.abs(Math.sin(a));
  return { x: (b.x * c + b.z * n) * s, z: (b.x * n + b.z * c) * s };
}

export interface DecorDef {
  kind: DecorKind;
  x: number;
  z: number;
  rot?: number;
  scale?: number;
  /** Bağlı olduğu bölüm (kilitliyse gizlenir). Yoksa hep görünür. */
  zone?: string;
}

export interface LocationPalette {
  exposure?: number;
  hemiIntensity?: number;
  ambientIntensity?: number;
  rimIntensity?: number;
  rimColor?: number;
  ground: number;
  floor: number;
  floorAlt: number;
  wall: number;
  wallTrim: number;
  brand: number;
  accent: number;
  sky: number;
  fog: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
}

export interface LocationDef {
  id: string;
  name: string;
  tagline: string;
  unlockCost: number;
  requiresProgress?: { location: string; pct: number };
  valueMult: number;
  /** Share of seated orders. Sahil emphasizes takeaway shelf routes. */
  dineInChance?: number;
  palette: LocationPalette;
  /** Zemin sınırları (dış duvarlar bunun kenarında) */
  bounds: { x0: number; z0: number; x1: number; z1: number };

  /** Mutfak alanı — zemin karosu ve tezgâh bandı buraya kurulur. */
  kitchen: { x0: number; z0: number; x1: number; z1: number };
  /** Servis nişi (tuvalet + sarf). Yoksa null. */
  service: { x0: number; z0: number; x1: number; z1: number } | null;
  /** Personel koridoru — mutfakla bar arası, asla kapanmaz. */
  aisle: { z0: number; z1: number };
  /** Barın önündeki sipariş sırası koridoru. */
  frontAisle: { z0: number; z1: number };
  /** Bar hattının z konumu. */
  barZ: number;
  /** Bar hattının x aralığı — tezgâh gövdesi bu şeride oturur. */
  barX: { x0: number; x1: number };
  /** Bu x'ten sağı dış mekândır (teras). */
  terraceX: number;


  partitions?: { x0: number; z0: number; x1: number; z1: number }[];

  /**
   * AVLU — odalar arasındaki açık geçiş şeridi.
   *
   * İki odayı ayıran boşluk "artakalan yer" gibi görünmemeli; kendi
   * döşemesi, bordürü ve saksılarıyla TASARLANMIŞ bir geçit olmalı.
   * Yalnızca görseldir (Environment çizer), navigasyona hiç girmez.
   */
  courtyard?: { x0: number; z0: number; x1: number; z1: number };

  door: { x: number; z: number };
  playerStart: { x: number; z: number };
  staffRest: { x: number; z: number };
  /** Small floor squares beside each role's actual workplace. */
  staffHirePads: Record<StaffRole, { x: number; z: number; station: string }>;
  zones: ZoneDef[];
  decor: DecorDef[];
}

/* ==================================================================== *
 *  KÖŞE ŞUBESİ — 18 × 37 birim, DİKEY (portre) plan
 *
 *  Oyun dikey ekrana kilitli. Dikey telefonda ekranın yatayında ancak
 *  ~12,5 birim dünya görünür; eski 30 birimlik enine plan kadraja hiç
 *  sığmıyordu. Mekânın uzun ekseni artık EKRANA DOĞRU uzanıyor ve kamera
 *  yaw'ı sıfır — çünkü yaw, derinliğin yatay bütçeye sızmasına yol açar
 *  (gereken genişlik = W·cos(yaw) + D·sin(yaw)).
 *
 *  Ölçüm: masa başına en yakın bankoya ortalama 6,1 birim (eski enine
 *  planda 12,5), en uzak 9,0 birim.
 * ==================================================================== */

export const KOSE: LocationDef = {
  id: 'kose',
  name: tr("Köşe Şubesi"),
  tagline: tr("Sokağın başındaki ilk kafe"),
  unlockCost: 0,
  valueMult: 1,
  /**
   * DEĞER ARALIĞI ÖLÇÜLEREK KURULDU.
   *
   * Eski palette karenin ~%90'ını kaplayan dört yüzey 15 L* içinde
   * sıkışıyordu: zemin 87,2 · zeminAlt 80,6 · dış zemin 80,5 · duvar 95,7.
   * Bu aralıkta hiçbir şey zeminden ayrışamaz; sahne "her şey bej" görünür.
   * Yeni değerler 52 ile 95 arasına yayılır (43 L*): duvar aydınlık fon
   * olarak kalır, zemin belirgin biçimde iner, dış zemin mekânı çerçeveler.
   */
  palette: {
    ground: 0x849696,
    floor: 0xe2dccd, // Premium taş; satın alınmış zemin seçimi ayrıca uygulanır.
    floorAlt: 0xd4cbbb,
    wall: 0x263238,
    wallTrim: 0x926346,
    brand: 0x275c53,
    accent: 0xe3a64d,
    ...CAFE_PRESENTATION,
  },
  bounds: { x0: -17.8, z0: -18, x1: 17.8, z1: 21.2 },
  kitchen: { x0: -8.6, z0: -17.6, x1: 8.6, z1: -11.4 },
  /**
   * Dikey planda AYRI SERVİS NİŞİ YOK.
   *
   * Niş, bandının kenarına duvar ördürüyor; tam genişlikte bir bant
   * verildiğinde mutfağı salondan tamamen kesiyordu (doğrulayıcı 10
   * makinenin servis noktasını "erişilemez" diye yakaladı). Ayrıca nişin
   * kapı boşluğu Environment içinde eski mekâna göre sabit kodlu.
   * Avlu lavaboları a6 bölümünün kendi room tanımında yer alır.
   */
  service: null,
  aisle: { z0: -8.2, z1: -5.6 },
  frontAisle: { z0: -3.0, z1: -0.6 },
  barZ: -4.4,
  barX: { x0: -4.9, x1: 4.9 },
  /** Dikey planda ayri teras guvertesi yok; bayrak yalnizca bahsis carpani icin. */
  terraceX: 20,
  /**
   * Ana salon x -9..9 arasindadir; yan ek yapilar bunun DISINDA. Bolme
   * portal disinda kesintisizdir, yoksa salon yanlardaki bosluga acilir.
   * Bahce kapilari z -9,65..-7,55; oda portallari z 12,0..15,4. Odalar
   * birbirine bakar).
   */
  partitions: [
    { x0: -9.15, z0: -18, x1: -8.85, z1: -9.65 },
    { x0: -9.15, z0: -7.55, x1: -8.85, z1: 12.0 },
    { x0: -9.15, z0: 15.4, x1: -8.85, z1: 21.2 },
    { x0: 8.85, z0: -18, x1: 9.15, z1: RESTROOM_SUITE.door.pos - RESTROOM_SUITE.door.w / 2 },
    { x0: 8.85, z0: RESTROOM_SUITE.door.pos + RESTROOM_SUITE.door.w / 2, x1: 9.15, z1: -9.65 },
    { x0: 8.85, z0: -7.55, x1: 9.15, z1: 12.0 },
    { x0: 8.85, z0: 15.4, x1: 9.15, z1: 21.2 },
  ],
  /**
   * ORTA OMURGA — iki odanın arasındaki tören yolu.
   *
   * Artık "iki oda arasında artakalan boşluk" değil, kompozisyonun EKSENİ:
   * giriş omurganın güney ucunda, VIP batıda ve salon doğuda ona açılıyor,
   * kuzey ucunda bar var. Oyuncu düz bir eksen boyunca yürür, odalar sağında
   * ve solunda açılır. Yalnızca görseldir (Environment döşer), navigasyona
   * girmez — geçilebilirliği odaların duvarları belirler.
   */
  courtyard: { x0: -8.85, z0: 11.4, x1: 8.85, z1: 16.0 },
  /**
   * Giriş GÜNEY-BATI köşesinde.
   *
   * Eskiden güney-doğudaydı ve tek bir düz koridor mekânı boydan boya
   * kesiyordu; iki oda da o koridorun batısına, tam genişlikte iki yatay
   * bant hâlinde sırt sırta diziliyordu ("VIP ile salon dip dibe"). Yeni
   * planda giriş batıda, VIP doğuda: müşteri batı koridorundan girer,
   * odaların ARASINDAKİ açık geçitten doğuya kayar ve oradan kuzeye,
   * bara çıkar. Dolaşım düz bir hat değil yumuşak bir S — mekân tek
   * bakışta okunmaz, keşfedilir.
   */
  /**
   * Giriş GÜNEY-DOĞUDA (2026-08-11'de batıdan taşındı).
   *
   * Odalar aynalandı — VIP artık BATI kanadı, salon DOĞU kanadı — ve eski
   * giriş noktası (−6,0 · 20,6) VIP odasının tam içine düşüyordu. Dolaşım
   * da aynalandı: müşteri güney-doğudan girer, doğu koridorundan kuzeye
   * çıkar, avludan BATIYA geçer, salonun batısından kuzeye devam edip bara
   * varır. Yine düz bir hat değil yumuşak bir S.
   */
  door: { x: 0.0, z: 20.6 },
  /** Oyuncu barın arkasında, sipariş tezgâhının yanında başlar. */
  playerStart: { x: 0.5, z: -6.8 },
  staffRest: { x: -7.6, z: -6.8 },
  staffHirePads: {
    cashier: { x: 7.7, z: -4.4, station: 'k_tezgah_1' },
    waiter: { x: -8.1, z: -4.8, station: 'k_raf_cay' },
    busser: { x: -7.65, z: 3.55, station: 'k_kova_1' },
    barista: { x: -4.9, z: -14.0, station: 'k_sutbar' },
  },

  zones: [
    /*
     * BÖLÜM ZİNCİRİ — masalar TEK TEK, mekân ODA ODA açılır.
     *
     * İlk üç dakika: her 30–60 saniyede bir ucuz açılım (masa/makine).
     * Orta oyun: SALON ODASI — duvarın ardında yepyeni bir alan.
     * Geç oyun: VIP SALON — en pahalı oda, hesap 2,4×.
     * Her odanın masaları da ayrı ayrı satın alınır: her şey geliştirme
     * üzerine kuruludur, tek seferde hiçbir şey bedava dolmaz.
     */
    {
      id: 'a1', name: tr("KAFE"), dept: 'bar', cost: ZONE_COSTS.a1, accent: 0x8a5a33,
      padX: -5.0, padZ: -6.6,
      blurb: tr("Semaver, çay rafı, kasa ve ilk masa."),
    },
    {
      /**
       * v5 FİYAT NOTU: peşin ödeme (kasada tam tutar) erken kasayı eski
       * modelden belirgin hızlı doldurur — 150'lik ped 4. SANİYEDE
       * açılıyordu (ölçüldü). Erken bant GDD metronomuna (30-45 sn'de bir
       * açılım) göre yeniden fiyatlandı: t1 300 · a3 1100 · t2 1900 ·
       * a4 3400 · t3 4800. Ölçüm: temiz 50 dk bot koşusu.
       */
      id: 't1', name: tr("MASA 2"), dept: 'salon', cost: ZONE_COSTS.t1, requires: 'a1', accent: 0x376152,
      padX: 0.0, padZ: 4.1,
      blurb: tr("İkinci masa. İlk açılımın yarım dakika sürer."),
    },
    {
      id: 'a3', name: tr("KAHVE"), dept: 'bar', cost: ZONE_COSTS.a3, requires: 'a1', accent: 0x2f6f5e,
      padX: -3.45, padZ: -8.2,
      blurb: tr("Kahve barı ve kahve rafı. Sütlü kahve menüye girer."),
    },
    {
      id: 't2', name: tr("MASA 3"), dept: 'salon', cost: ZONE_COSTS.t2, requires: 't1', accent: 0x376152,
      padX: 5.2, padZ: 4.1,
      blurb: tr("Dört kişilik ilk büyük masa."),
    },
    {
      id: 'a4', name: tr("TOST"), dept: 'bar', cost: ZONE_COSTS.a4, requires: 'a3', accent: 0xc9793f,
      padX: 0.0, padZ: -7.8,
      blurb: tr("Tost makinesi ve tost rafı. Menü üçe çıkar."),
    },
    {
      id: 't3', name: tr("MASA 4"), dept: 'salon', cost: ZONE_COSTS.t3, requires: 't2', accent: 0x376152,
      padX: -5.2, padZ: 8.2,
      blurb: tr("İlk kare masa — dört kişilik."),
    },
    {
      id: 'a5', name: tr("SALON HATTI"), dept: 'bar', cost: ZONE_COSTS.a5, requires: 'a4', accent: 0x6a5aa8,
      padX: 1.7, padZ: -2.0,
      blurb: tr("İkinci kasa ve salon kovası — sipariş sırası ikiye bölünür."),
    },
    {
      id: 't4', name: tr("MASA 5"), dept: 'salon', cost: ZONE_COSTS.t4, requires: 't3', accent: 0x376152,
      padX: 0.0, padZ: 8.2,
      blurb: tr("İki kişilik kare masa."),
    },
    {
      id: 'a6', name: tr("LAVABOLAR"), dept: 'servis', cost: ZONE_COSTS.a6, requires: 'a5', accent: 0xb69a60,
      padX: 7.45, padZ: -9.85,
      room: RESTROOM_SUITE,
      blurb: tr("Kafe lavaboları uzun oturan misafirleri rahatlatır; peçeteyi tam, zemini pırıl pırıl tutarsan memnuniyet ve bahşiş artar."),
    },
    /**
     * ORTA BANT YENİDEN FİYATLANDI (denetim, 2026-08).
     *
     * GDD-v4 hedefi Oda 2'yi ~8-10. dakikaya koyar; eski fiyatlarla
     * (r1 80k, t6 190k, r2 650k, v1 900k, v2 1,3M) kalibre edilmiş model
     * Oda 2'yi ~26-34., VIP'i ~74-98. dakikaya itiyor ve 17. dakikadan
     * sonra 5-23 dakikalık satın alımsız boşluklar zinciri başlıyordu.
     * İkinci sorun sıralamaydı: geliri %127 artıran SOĞUK BAR 190k'lık
     * masaya, VIP 420k'lık masaya kilitliydi — en zayıf alımlar en
     * güçlülerin önünde zorunlu kapıydı. Masalar artık YAN DAL (a8 ve r2
     * doğrudan bir önceki bar bölümüne bağlanır), oda/masa fiyatları GDD
     * bandına çekildi. Ayar botla ölçülür: tools/balance-bot.js.
     */
    {
      id: 't5', name: tr("MASA 6"), dept: 'salon', cost: ZONE_COSTS.t5, requires: 'a6', accent: 0x376152,
      padX: 5.2, padZ: 8.2,
      blurb: tr("Ön salonun son masası."),
    },
    {
      // Vurgu MOR (0x9a6ad4) idi: mekânın sıcak bej-yeşil paletinde tek
      // soğuk-eflatun ada olarak duruyordu. Şişe yeşili hem bar panosuyla
      // hem markayla akraba, hem de VIP'in altınından net ayrı.
      id: 'r1', name: tr("SALON ODASI"), dept: 'salon', cost: ZONE_COSTS.r1, requires: 'a6', accent: 0x2f5d4e,
      padX: 7.8, padZ: 13.7,
      /**
       * DOĞU KANADI — geniş ve sığ.
       *
       * Eski planda r1 ve r2 tam genişlikte iki yatay banttı ve aralarında
       * yalnızca 2 birimlik bir dikiş vardı: portre kamerada "aynı şablonun
       * alt alta iki kopyası" olarak okunuyorlardı. Sonra salon batıya, VIP
       * doğuya alındı; 2026-08-11'de kullanıcı isteğiyle İKİSİ AYNALANDI —
       * VIP artık batıda, salon doğuda. Odalar hem farklı yanda hem farklı
       * derinlikte durur (salon z 9-14,2 · VIP z 16,4-20,8), üstüne farklı
       * kot, kapalılık ve malzemeyle ayrışırlar.
       */
      room: {
        /**
         * ÖLÇÜYLE BOYUTLANDI. Masa gövdesi 1,72 birim; tuzak bandından
         * (0,15-0,95) kaçmak için masa merkezi her duvar yüzünden en az
         * 1,81 uzakta olmalı, üstelik masanın SERVİS NOKTASI 1,6 birim
         * kuzeyindedir ve o da yürünebilir kalmalı. İlk deneme (6,6 × 6,8)
         * bu yüzden çöktü: Masa 8'in servis noktası kuzey duvarının içine
         * düştü ve doğrulayıcı "ERİŞİLEMEZ" verdi. 7,0 × 8,6 iki sıra masayı
         * güvenli paylarla alır.
         */
        x0: 9.0, z0: 9.6, x1: 17.5, z1: 18.4,
        /**
         * Kapı kuzey duvarının BATI ucunda ve `wrap: 'w'` ile batı duvarına
         * sarıyor: giriş L biçiminde, orta omurgaya bakıyor. Kuzeye bakan
         * yüzü olduğu için kamerada kapı olarak okunur (bkz. RoomDef.door).
         */
        door: { edge: 'w', pos: 13.7, w: 3.4 },
      },
      blurb: tr("Kapının ardındaki yepyeni salon — ilk masası hediye."),
    },
    {
      id: 'a7', name: tr("VAFIL"), dept: 'bar', cost: ZONE_COSTS.a7, requires: 'r1', accent: 0xd8567a,
      padX: 5.0, padZ: -11.6,
      blurb: tr("Vafıl makinesi ve vafıl rafı. Menünün tatlı yıldızı."),
    },
    {
      id: 't6', name: tr("MASA 8"), dept: 'salon', cost: ZONE_COSTS.t6, requires: 'r1', accent: 0x376152,
      padX: 10.4, padZ: 11.5,
      blurb: tr("Salon odasının orta masası."),
    },

    {
      id: 'a8', name: tr("BUZLU KAHVE"), dept: 'bar', cost: ZONE_COSTS.a8, requires: 'a7', accent: 0x6aa84f,
      padX: 5.4, padZ: -14.4,
      blurb: tr("Buzlu kahve blenderi ve rafı. Menünün zirvesi."),
    },
    {
      id: 't7', name: tr("MASA 9"), dept: 'salon', cost: ZONE_COSTS.t7, requires: 't6', accent: 0x376152,
      padX: 12.7, padZ: 13.8,
      blurb: tr("Salon odası tamamlanır."),
    },
    /* ================= YAN DAL — ARA-HEDEF BANDI (v5.1 §3) ================= *
     * Üç İSTASYONSUZ bölge: yalnız ped + dekor + kalıcı küçük bonus.
     * Etkiler tek noktadan okunur (World.refreshSideBonuses): z_muzik
     * sabır ×1,06 · z_vitrin değer ×1,04 · z_tabela akış ×1,05.
     *
     * Ana zinciri KAPILAMAZLAR: hiçbir bölge bunlara `requires` ile
     * bağlanmaz; ikisi a7'ye, tabela a8'e yaslanır ve ölçülen iki satın
     * alımsız boşluğu (17:51-22:20 ve 28:29-32:33) doldururlar. Dizideki
     * yerleri t7'nin ARDINDA: nextLockedZone ve eş-fiyat kılavuz oku
     * taramaları ana dalı önde bulmaya devam eder.
     *
     * Ped yerleşimi ÖLÇÜLEREK kondu (üçü de kadraj kuralı |x| ≲ 4,6
     * içinde; en yakın gövde kenarı ped diskinin (r 1,5) en az 1,1 birim
     * ötesinde — ped sıkışması ilerlemeyi SESSİZCE kilitler ve doğrulayıcı
     * pedleri denetlemez, bkz. proje hafızası). Spec'teki aday konumların
     * üçü de çapraz kontrolde çöktü ve kaydırıldı: (−4,0/11,6) avlu kapısı
     * teknesini diskin içine alıyordu, (4,2/−8,6) iki tuvaletin arasına
     * sıkışıyordu, (−3,2/17,6) palmiyeyi diskin içine alıyordu.           */
    {
      id: 'z_muzik', name: tr("MÜZİK KÖŞESİ"), dept: 'salon', cost: ZONE_COSTS.z_muzik, requires: 't6', accent: 0xa8743f,
      /**
       * Avlunun batı yakası, eşik sırası (saksı tekneleri z 10,4) ile batı
       * feneri (−4,4/15,4) arasındaki açık zemin. En yakın üç gövdenin
       * disk kenarına payı: fener 1,27 · şimşir 1,23 · tekne 1,58. Portal
       * ağızları (z 12-15,4) ve orta yürüme hattı serbest (ped yürünebilir,
       * engel değildir). Dekoru (gramofon −6,3/10,4) açılınca belirir.
       */
      padX: -2.3, padZ: 13.3,
      blurb: tr("Gramofon köşesi — misafirler daha sabırlı bekler."),
    },
    {
      id: 'z_vitrin', name: tr("VİTRİN IŞIKLARI"), dept: 'bar', cost: ZONE_COSTS.z_vitrin, requires: 'a7', accent: 0xe0a23c,
      /**
       * Sipariş koridorunun batı ucu — ışıklandırdığı raf vitrininin tam
       * önü. Koridor bandı (frontAisle) nav'da her zaman açık tutulur;
       * en yakın üç gövdenin disk kenarına payı: waffle rafı 1,20 · tost
       * rafı 1,22 · frappe rafı 1,35 (masalar 1,77). Spec adayı (4,2/−8,6)
       * iki tuvaletin gövdesini diskin İÇİNE alıyordu — buraya kaydırıldı.
       */
      padX: -2.6, padZ: -1.2,
      blurb: tr("Sıcak vitrin aydınlatması — her ürün daha değerli görünür."),
    },
    {
      id: 'z_tabela', name: tr("SOKAK TABELASI"), dept: 'salon', cost: ZONE_COSTS.z_tabela, requires: 'a8', accent: 0x3fa08a,
      /**
       * Giriş alanının DOĞU cebi. Batı cebi denendi ve 1,1 payını hiçbir
       * noktada veremedi (palmiye 18,4 + fener 15,4 + bank 20,5 üçgeni);
       * doğuda pay: fener 1,27 · bank 1,34 · güney duvarı 2,30. Kapı
       * koridoru (x ±1,1) engelsiz — ped yürünebilir, tabela dekoru ise
       * eksenden 4,0 birim uzakta. Dekor (4,3/18,9) açılınca belirir.
       */
      padX: 2.2, padZ: 17.4,
      blurb: tr("Sokağa ışıklı tabela — daha çok misafir uğrar."),
    },
    {
      id: 'r2', name: tr("VIP SALON"), dept: 'salon', cost: ZONE_COSTS.r2, requires: 'a8', accent: 0xd4a017,
      padX: -6.0, padZ: 16.5,
      /**
       * BATI KANADI — yükseltilmiş açık teras.
       *
       * Salon Odası'nın ARKASINDA değil ÇAPRAZINDA: salon DOĞUDA z 9-14,2,
       * VIP BATIDA z 16,4-20,8. (2026-08-11: kullanıcı isteğiyle iki oda
       * aynalandı; önceden salon batı, VIP doğuydu.) Aralarında tam
       * genişlikte açık bir AVLU şeridi var (bkz. `courtyard`). İki oda aynı
       * kadraja yan yana girmediği için "dip dibe" okuması ortadan kalkar;
       * doğu koridoru girişten avluya, batı koridoru avludan bara taşır.
       */
      /**
       * KOT 0,9 — merdiven GÖRÜNSÜN diye.
       *
       * 0,4 idi ve üç basamağa bölününce basamak başına 0,13 birim düşüyordu:
       * portre kamerada podyum "hafif kalın bir bordür" gibi okunuyor, kot
       * farkı hiç fark edilmiyordu. 0,9 / 5 basamak = 0,18 birim, yani
       * karakter boyunun (1,6) sekizde biri — gerçek bir basamak yüksekliği.
       * Nav 2B olduğu için A* etkilenmez; `World.updateFloorLift` kotu λ9 ile
       * yumuşattığından (~0,33 sn) karakter zıplamaz, basamakları çıkar.
       */
      room: {
        x0: -17.5, z0: 9.6, x1: -9.0, z1: 18.4,
        /** Salonun aynası: kapı kuzey duvarının DOĞU ucunda, doğu duvarına sarıyor. */
        door: { edge: 'e', pos: 13.7, w: 3.4 },
        lift: 0.9,
        style: 'teras',
      },
      blurb: tr("Kafenin en özel odası: mermer VIP masa, hesap ve bahşiş 2,4 katı."),
    },
    /**
     * v1/v2 SAHİLİN ALTINA ÇEKİLDİ: eski fiyatla VIP MASA 2 (900k) tam
     * Sahil Şubesi fiyatındaydı ve LOCA ondan pahalıydı — sahil ~₺120k/dk
     * ek gelir getirirken iki masa toplam birkaç bin/dk getiriyordu;
     * rasyonel oyuncu için ölü içerikti.
     */
    {
      id: 'v1', name: tr("VIP MASA 2"), dept: 'salon', cost: ZONE_COSTS.v1, requires: 'r2', accent: 0xd4a017,
      padX: -10.6, padZ: 11.5,
      blurb: tr("İkinci VIP masa. Zenginler sıra beklemesin."),
    },
    {
      /**
       * ₺380.000 → ₺285.000: zincirin SON alımıydı ve `v1`den sonra tek
       * kapı olarak duruyordu; ölçümde 33:41-39:54 arası **373 saniye**
       * satın alımsız geçti (o bandın geliri ~₺55.000/dk). Yeni fiyat aynı
       * gelirde ~5 dakikaya denk gelir.
       */
      id: 'v2', name: tr("VIP LOCA"), dept: 'salon', cost: ZONE_COSTS.v2, requires: 'v1', accent: 0xd4a017,
      padX: -13.0, padZ: 13.7,
      blurb: tr("Dört kişilik loca — kafenin en pahalı ve en kârlı masası."),
    },
  ],

  decor: [
    /* --- bar arkasi / mutfak --- */
    { kind: 'coffeesack', x: -6.9, z: -12.6, rot: 14 },

    /* --- on salon kenarlari: duvara yaslanik (gap < 0,15 = kasitli
     *     dayali) ya da bol paylı — 0,15–0,95 tuzak bandına asla girmez --- */
    /**
     * Saksı z 2,6 → 2,0. Doğrulayıcının tek kalan gerçek uyarısı buydu:
     * "SIKIŞIK: Bulaşık Kovası ↔ dekor:plant arası 1.16 birim". Kova
     * (z 4,16–5,04) kominin en sık gittiği istasyondur; oranın 1,5 birimin
     * altına düşmesi tuzak değil ama gereksiz sürtünmedir. Yeni boşluk
     * 1,76 birim (4,16 − 2,40).
     */
    { kind: 'plant', x: -8.2, z: 2.0 },
    { kind: 'plant', x: 8.2, z: 2.0 },
    { kind: 'rug', x: -5.2, z: 2.2 },
    { kind: 'rug', x: 0.0, z: 2.2 },
    { kind: 'rug', x: 2.8, z: -2.0 },
    { kind: 'rug', x: -1.8, z: -6.8 },

    /**
     * KİLİDE BAĞLI OLMAYAN DOLGU DEKOR.
     *
     * Ön salon 18×9,6 = 173 birimlik bir alan ve erken oyunda içinde tek
     * masa, iki saksı ve bir çöp kovası vardı — kadrajın yarısı dev boş
     * parke olarak okunuyordu. Rakipler boş dönemde bile pencere önü
     * bankları, ayaklı menü ve bitki kümeleriyle mekânı doldurur.
     *
     * Hepsi DUVAR DİBİNDE ve yürüme koridorunun dışında: yerleşim
     * doğrulayıcısının 0,15-0,95 "boğaz" bandına girmezler.
     */
    /* Kitaplık BATIDA kalır. Doğuya aynalanınca Salon Kovası ile arasında
     * 0,26 birim kalıyordu — doğrulayıcının "tuzak" bandı (0,15-0,95): A*
     * geçit görür, 0,60'lık gövde sığmaz. Odalara bağlı bir dekor değil,
     * aynalanması gerekmiyordu. */
    /* Sandık ve saksı BATI duvarında: salon odası doğuya taşındığı için
     * eski konumları (x 8,35) odanın İÇİNE düşüyordu. */
    /* Sandık KALDIRILDI: odalar orta omurga düzenine geçince batı duvarı
     * boyunca kovayla, doğu duvarı boyunca salon odasıyla, girişte palmiyeyle
     * hep 0,15-0,95 tuzak bandına düşüyordu. Tek bir dekor parçası için
     * yerleşimi zorlamaya değmez. */
    { kind: 'rug', x: -5.2, z: 6.0, zone: 't3' },
    { kind: 'wallart', x: -8.8, z: 5.0, rot: 90, zone: 'a5' },

    /* --- bati koridoru (avludan bara) --- */
    /* Saksı DOĞUDA kalır — batıya aynalanınca Bulaşık Kovası ile arası
     * 0,36 birime düşüyordu (tuzak bandı). Ön salon dekoru, oda taşımasıyla
     * ilgisi yok. */

    /* ================================================================ *
     *  ORTA OMURGA VE GİRİŞ — "boş ve yarım kalmış" hissinin merkezi
     *
     *  Ölçüm (375×812, geç oyun kareleri late_avlu / late_giris): oyuncunun
     *  EN ÇOK geçtiği yol olan giriş→avlu→bar ekseninde tek bir palmiye
     *  vardı; kadrajın alt yarısı çıplak zemindi. Salonun kendisi zengin,
     *  yolu bomboştu — mekân bu yüzden "yarım kalmış" okunuyordu.
     *
     *  KADRAJ ÖLÇÜLDÜ — "duvar dibi" tek başına yanlış cevap.
     *
     *  İlk deneme her şeyi bölme diplerine (x ±8,2–8,35) dizdi ve
     *  375×812'de ÇOĞU HİÇ GÖRÜNMEDİ. Ölçüm: kamera oyuncuyu takip ediyor
     *  ve portre kadrajın mekân düzlemindeki yatay yarı genişliği yalnızca
     *  ~4,3 birim (derinlikle daralıyor: oyuncu 0/19'dayken z=19'da
     *  x −3,9…3,8, z=15'te x −4,4…4,4). Yani ±8'deki bir bank, oyuncu tam
     *  o duvarın dibine gitmedikçe ekrana hiç girmiyor.
     *
     *  Doğru kural ikili: parça ya KADRAJ İÇİNDE (|x| ≲ 4,6) olmalı, ya da
     *  oyuncunun gerçekten yürüdüğü bir kanadın duvarında (r1/r2 pedlerine
     *  ve kovalara giden yollar) — ikisi de değilse o parça bedavaya
     *  çizim çağrısı yakar.
     *
     *  Doldurma kuralları (ihlal edilirse yerleşim bozulur):
     *   · Orta yürüme hattı (x −3…3) hiç kapatılmaz; "kapı" hissi
     *     karşılıklı iki kütleyle kurulur, aradaki boşluk 6,6 birim kalır.
     *   · Oda portalleri (z 12,0–15,4, iki yanda) TAMAMEN açık kalır.
     *   · Ödeme pedlerinin (r1 7,8/13,7 · r2 −7,8/13,7 · yarıçap 1,5)
     *     üstüne hiçbir şey konmaz — ped sıkışırsa ilerleme SESSİZCE
     *     kilitlenir ve doğrulayıcı bunu yakalamaz.
     *   · Kapı ekseninde (x 0, z 17,0–20,6) 1,1 birim yarı genişlikte
     *     koridor boş kalır; doğrulayıcı "KAPI TIKALI" ile denetliyor.
     * ================================================================ */

    /* --- eşik bandı (z ~9–11,4): salonla avlu arasındaki ölü şerit --- */
    /* Banklar bölme diplerinde KALIR: oyuncu bu iki kanadı gerçekten
     * yürüyor (batıda r2 pedi ve Bulaşık Kovası, doğuda r1 pedi ve Salon
     * Kovası), yani ekrana o yollarda giriyorlar. En yakın istasyona
     * boşluk 2,7–4,1 birim. */
    { kind: 'bench', x: -8.2, z: 9.5, rot: 90 },
    { kind: 'bench', x: 8.2, z: 9.5, rot: -90 },
    /**
     * AVLU KAPISI — karşılıklı iki bitki teknesi + iki şimşir.
     *
     * Salondan omurgaya geçiş eskiden hiçbir şeyle işaretlenmemişti; iki
     * alan tek bir uçsuz zemin gibi akıyordu. Teknelerin dış kenarı
     * x ±5,3'te, iç kenarı ±3,5'te: aradaki 7 birimlik açıklık ana yürüme
     * hattını olduğu gibi bırakır ama göz artık bir EŞİK görür.
     * Konum kadraj ölçüsüne göre: ±4,4 portre kadrajın kenarına denk
     * gelir, yani oyuncu omurgada yürürken en az biri daima ekranda.
     */
    /* z 11,0 → 10,4: kadrajın DİBİ ölçüldü — oyuncu z 4'teyken görünen en
     * uzak nokta z 11,6. Kapı 11,0'da kadrajın tam kenarında kalıyor ve
     * erken oyunda hiç görünmüyordu; 10,4 onu rahatça içeri alır. Masalara
     * boşluk hâlâ 3,2 birim, t3/t4/t5 pedlerinin (z 8,2 · yarıçap 1,5)
     * dışında. */
    { kind: 'planter', x: -4.4, z: 10.4 },
    { kind: 'planter', x: 4.4, z: 10.4 },
    { kind: 'topiary', x: -3.3, z: 10.4 },
    { kind: 'topiary', x: 3.3, z: 10.4 },
    /**
     * MÜZİK KÖŞESİ (z_muzik) — eşik sırasının batı ucu, açılınca belirir.
     *
     * Kadraj kuralının İKİNCİ koluyla yerleşir: |x| 6,3 kadraj dışı ama
     * oyuncunun gerçekten yürüdüğü batı kanadında (r2/v1 pedleri ve
     * Bulaşık Kovası yolu — banklarla aynı gerekçe). Ölçüler: tekne
     * kenarına 1,06 · banka 1,31 · Masa 4 gövdesine 3,26 (doğrulayıcı
     * çifti) — tuzak bandına (0,15-0,95) hiçbir komşu girmez. Kilim
     * üreticinin içindedir (yarıçap yalnız dolabı sayar) ve güneydoğuya,
     * kameraya döner (rot 12). Kendi pedine (−2,3/13,3) payı 3,02.
     */
    { kind: 'gramofon', x: -6.3, z: 10.4, rot: 12, zone: 'z_muzik' },

    /* --- avlu (z 11,4–16,0): geçidin ritmi --- */
    /* Fenerler avlunun KUZEY ucunda ve kadraj içinde. Ped dairelerinden
     * (±7,8 · 13,7 · yarıçap 1,5) ve portal ağızlarından (z 12,0–15,4)
     * uzaktalar; z 13–14,5 bandı odalara geçen çapraz trafiğe açık kalır. */
    { kind: 'lantern', x: -4.4, z: 15.4 },
    { kind: 'lantern', x: 4.4, z: 15.4 },

    /* --- giriş (z 16,0–21,2): oyuncunun ve her müşterinin ilk gördüğü yer --- */
    /**
     * Burada bir şimşir çifti daha (±2,6 · 17,6) denendi ve ÇİZİM ÇAĞRISI
     * BÜTÇESİNE kurban edildi: girişte zaten palmiye, saksı, iki bank,
     * tebeşir tahtası ve bisiklet standı var, yani boşluk sorunu çözülmüştü;
     * dört çizim çağrısı daha ise bütçeyi %5 sınırının üstüne taşıyordu.
     * Dolgu, bütçeyi aşınca dolgu olmaktan çıkar.
     */
    /**
     * Palmiye kapının TAM ÖNÜNDEN alındı: doğrulayıcı "KAPI TIKALI:
     * dekor:palm girişin 1.2 birim önünde" diyordu ve bu SÜSLEME DEĞİL
     * GERÇEK BİR İLERLEME HATASI — çıkamayan müşteri nüfus tavanını
     * kilitler, ekranda hiçbir uyarı çıkmaz, kafe sessizce kazanmayı
     * bırakır. Yeni yeri kapı ekseninden 4,2 birim uzakta ve kadrajın
     * içinde; girişin dikey aksanı oldu.
     */
    { kind: 'palm', x: -4.2, z: 18.4 },
    { kind: 'flowerpot', x: -8.35, z: 18.3 },
    { kind: 'plant', x: 8.3, z: 18.6 },
    /* Bekleme bankları güney duvarına sırtını verir (rot 180 → yüz kuzeye,
     * salona bakar). Tente x −2,2…2,2 arasını örttüğü için bankları 3,3'e
     * aldık: hem tentenin altında kaybolmuyorlar hem kapı koridoru boş. */
    { kind: 'bench', x: -3.3, z: 20.5, rot: 180 },
    { kind: 'bench', x: 3.3, z: 20.5, rot: 180 },
    /* Karşılama tabelası: YENİ BİR METİN PLAKASI DEĞİL — mevcut tebeşir
     * tahtası dekoru. Girişe hafif açıyla konur ki gelen misafire baksın. */
    { kind: 'chalkboard', x: 2.9, z: 19.3, rot: 195 },
    { kind: 'bikerack', x: -2.9, z: 20.4, rot: 8 },
    /**
     * SOKAK TABELASI (z_tabela) — girişin doğu cebi, açılınca belirir.
     *
     * Yüzü KADRAJA bakar (+z, hafif açı rot −10): kamera yaw'ı sıfır
     * olduğundan sokağa (güney duvarına paralel) dönük bir pano profilden
     * görünür ve okunmazdı — oda tabelalarında ödenen dersin aynısı.
     * Ölçüler: bank 1,18 · giriş saksısı 3,35 · fener 3,04; tebeşir
     * tahtasına görsel 1,46 (engelsiz, kot ayrık: pano y ≈ 2,1, şövale
     * 1,15). Kapı eksenine 4,0 birim — KAPI TIKALI bandının çok dışında.
     */
    { kind: 'tabela', x: 4.3, z: 18.9, rot: -10, zone: 'z_tabela' },

    /* --- salon odasi (r1): x 2,2..8,8 · z 9,4..16,2 — DOĞU kanadı --- */
    { kind: 'rug', x: 12.7, z: 13.8, zone: 'r1' },
    { kind: 'wallart', x: 13.0, z: 17.62, rot: 180, zone: 'r1' },
    /**
     * SALON ODASINA YER DEKORU KONMADI — ölçüldü, sığmıyor.
     *
     * Oda 7,5 × 8,2 ve içinde üç masa var; denenen her yer tuzak bandına
     * düştü: tekne (12,8/10,4) Masa 8 ile 0,42, köşe şimşiri (15,9/10,5)
     * 0,51 birim bırakıyordu (0,15–0,95 = A* geçit görür, gövde sığmaz).
     * Kuzey şeridi ise t6 pedinin (10,4/11,5 · yarıçap 1,5) içine düşüyor.
     * Odanın boşluk sorunu zaten ZEMİNDİ (dama tahtası) ve o düzeltildi;
     * kalan hacim asma bitkiyle doldurulur — tavanda yer kaplamaz.
     */

    /* --- vip terasi (r2): x -8,8..-2,2 · z 9,4..16,2 — BATI kanadı --- */
    { kind: 'rug', x: -12.9, z: 13.7, zone: 'r2' },
    { kind: 'wallart', x: -14.3, z: 17.05, rot: 180, zone: 'r2' },
    { kind: 'neon', x: -11.5, z: 17.05, rot: 180, zone: 'r2' },
  ],
};

/* ==================================================================== *
 *  SAHİL ŞUBESİ — daha da küçük, açık hava
 * ==================================================================== */

export const SAHIL: LocationDef = {
  id: 'sahil',
  name: tr("Sahil Şubesi"),
  tagline: tr("Martı sesli, tuz kokulu ikinci kafe"),
  /**
   * Şube fiyatı ortak ekonomi kaynağından gelir. Doğal açılış süreleri
   * docs/URUN-KALITESI-2026-09-08.md içindeki sabit tohumlu koşularla
   * izlenir; hazırlanmış yüksek gelirli durumlar fiyat kanıtı değildir.
   */
  unlockCost: BRANCH_COSTS.sahil,
  dineInChance: 0.45,
  requiresProgress: { location: 'kose', pct: 0.5 },
  valueMult: 1,
  palette: {
    // Sahil de aynı değer aralığı kuralına uyar; tonu daha soğuk ve açık
    // ama zemin-duvar farkı yine ~25 L*.
    ground: 0xc2ab84, // L* 71
    floor: 0xe3d3b4, // L* 85
    floorAlt: 0xcfdcd8, // L* 86 → soğuk kontrast (sıcak zeminle ayrışır)
    wall: 0xfdf8ef,
    wallTrim: 0x2f8fb8,
    brand: 0x2f8fb8,
    accent: 0xff8b6b,
    sky: 0x8fd6f0,
    fog: 0xd8f0f7,
    sunColor: 0xfff0d0,
    sunIntensity: 3.15,
    hemiSky: 0x9fe0f5,
    hemiGround: 0xcbb086,
  },
  bounds: { x0: -12, z0: -11, x1: 12, z1: 12 },
  kitchen: { x0: -9.5, z0: -10.4, x1: 2.0, z1: -6.4 },
  service: null,
  aisle: { z0: -5.4, z1: -2.6 },
  frontAisle: { z0: 0.8, z1: 2.6 },
  barZ: -1.0,
  barX: { x0: -8.6, x1: -1.8 },
  terraceX: -12,
  door: { x: 2.0, z: 11.4 },
  // Bar koridorunda başla; Dondurma ödeme alanında bekleyerek para harcanmasın.
  playerStart: { x: -5.4, z: -3.2 },
  staffRest: { x: -10.8, z: -3.6 },
  staffHirePads: {
    cashier: { x: -1.0, z: -1.5, station: 's_tezgah_1' },
    waiter: { x: -6.8, z: -4.9, station: 's_raf_smoothie' },
    busser: { x: -10.0, z: 3.3, station: 's_kova_1' },
    // Keep the whole square beside the tall cooler so its inset text is visible.
    barista: { x: -9.6, z: -8.6, station: 's_smoothie' },
  },

  zones: [
    {
      id: 'p1', name: tr("KUMSAL BARI"), dept: 'bar', cost: ZONE_COSTS.p1, accent: 0xf0913a,
      padX: -7.2, padZ: -4.0,
      blurb: tr("Meyve barı, meyve rafı, kasa ve iki masa."),
    },
    {

      id: 'p2', name: tr("DONDURMA"), dept: 'bar', cost: ZONE_COSTS.p2, requires: 'p1', accent: 0xffb0c4,
      padX: -3.6, padZ: -4.0,
      blurb: tr("Dondurma makinesi ve iki masa daha."),
    },
    {
      id: 'p3', name: tr("TERAS"), dept: 'salon', cost: ZONE_COSTS.p3, requires: 'p2', accent: 0x6aa84f,
      padX: 4.0, padZ: 2.0,
      blurb: tr("Sütlü kokteyl barı ve iki büyük teras masası."),
    },
    {
      id: 'p4', name: tr("SAHİL HATTI"), dept: 'bar', cost: ZONE_COSTS.p4, requires: 'p3', accent: 0x2f8fb8,
      padX: 4.4, padZ: -3.8,
      blurb: tr("İkinci kumsal kasası — sipariş sırası ikiye bölünür."),
    },
    {
      id: 'p5', name: tr("İSKELE VIP LOCA"), dept: 'salon', cost: ZONE_COSTS.p5, requires: 'p4', accent: 0xd4a017,
      padX: 6.2, padZ: 7.2,
      blurb: tr("Sahilin en özel mermer VIP masası — hesap ve bahşiş 2,4 katı."),
    },
    {
      id: 'p6', name: tr("SAHİL MÜZİĞİ"), dept: 'salon', cost: ZONE_COSTS.p6, requires: 'p2', accent: 0xa8743f,
      padX: 0.4, padZ: -3.8,
      blurb: tr("Akustik sahil müziği ve ışıklar — sabır, değer ve müşteri akışı artar."),
    },
  ],


  decor: [
    { kind: 'palm', x: -11.0, z: 8.0 },
    /* Palmiye z 8,6 → 6,2: Veranda Kovası (9,16–10,04) ile arası 0,39
     * birimdi (tuzak). Yeni boşluk 2,56 birim. */
    { kind: 'palm', x: 10.8, z: 6.2, scale: 1.15, zone: 'p3' },

    { kind: 'umbrella', x: -7.6, z: 3.0 },
    { kind: 'umbrella', x: 2.0, z: 3.2, zone: 'p2' },
    { kind: 'umbrella', x: 6.8, z: 3.4, zone: 'p3' },
    /* Saksı (−0,4 · 11,2) → (−4,6 · 11,9): Veranda 2 ile arası 0,93
     * birimdi (tuzak) ve üstelik kapı ekseninin dibindeydi. */
    { kind: 'flowerpot', x: -4.6, z: 11.9 },
    { kind: 'crate', x: -11.0, z: -9.6 },
    { kind: 'heater', x: 10.6, z: 1.6, zone: 'p3' },
    /* Saksı z 1,6 → 4,2: Kumsal Kovası ile ÇAKIŞIYORDU (0,04 iç içe).
     * Yeni boşluk 1,96 birim. */
    { kind: 'plant', x: -11.2, z: 4.2 },

    /**
     * DOLGU — sahilde de aynı iki boşluk vardı: barla masalar arasındaki
     * şerit (z 0–3) ve masalarla kapı arasındaki şerit (z 6–11).
     * Konumlar Köşe'deki dersle seçildi: portre kadrajın yarı genişliği
     * ~4,3 birim olduğu için x ±11'deki duvar dekoru hiç görünmüyor;
     * yenileri yürüme hattının 3–6 birim yanında, yani kadrajın içinde.
     * Hepsi istasyonlardan ≥1,5 birim uzakta (ölçülerek yerleştirildi).
     */
    /* Veranda 2 giriş koridorundan batıya çekilince (bkz. stations.ts) bu
     * fener masayla 0,88 birim kalıyordu — tam tuzak bandı. Kum Masası 4
     * ile Veranda 2 arasındaki 3,16 birimlik açıklığın ORTASINA alındı:
     * iki yana da 1,38 kalır, yani hiçbir yanı tuzak değil. (Her iki yana
     * 1,5 vermek bu açıklıkta geometrik olarak mümkün değil: 1,5+0,4+1,5
     * = 3,4 > 3,16.) */
    { kind: 'bench', x: -3.4, z: 11.6, rot: 180 },
  ],
};

export const LOCATIONS: Record<string, LocationDef> = {
  kose: KOSE,
  sahil: SAHIL,
};

export const LOCATION_ORDER = ['kose', 'sahil'];

export function locationDef(id: string): LocationDef {
  const l = LOCATIONS[id];
  if (!l) throw new Error(`Bilinmeyen lokasyon: ${id}`);
  return l;
}

export function zoneDef(locationId: string, zoneId: string): ZoneDef {
  const z = locationDef(locationId).zones.find((zz) => zz.id === zoneId);
  if (!z) throw new Error(`Bilinmeyen bölge: ${locationId}/${zoneId}`);
  return z;
}

export function locationStations(locationId: string): StationDef[] {
  return stationsOfLocation(locationId);
}
