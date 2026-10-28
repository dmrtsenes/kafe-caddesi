import * as THREE from 'three';
import { Rng } from '../core/Rng';
import { clamp } from '../core/MathUtils';
import { mix, shade } from '../world/Materials';
import { uniformSkin } from '../data/cosmetics';
import { FINCAN_PLAYER_WORKWEAR } from './Workwear';
import type { CharRole, CharacterOpts } from './types';

/**
 * Rol/varyanta göre **silüet reçetesi**. CharacterRig bunu okuyup mesh kurar.
 * Amaç: aynı iskeletten türeyen ama 30 birim uzaktan bile ayırt edilebilen tipler.
 */

export type HatKind =
  | 'none'
  | 'capBack'
  | 'beanie'
  | 'visor'
  | 'bandana'
  | 'flatCap'
  | 'helmet'
  | 'straw'
  | 'sweatband'
  | 'scarf'
  | 'hood';

export type HairKind = 'none' | 'short' | 'fringe' | 'mop' | 'bun' | 'ponytail';

export type OverKind =
  | 'none'
  | 'vest'
  | 'jacket'
  | 'chef'
  | 'hoodie'
  | 'suit'
  | 'cardigan'
  | 'dress'
  | 'patterned';

export type BackKind = 'none' | 'crate' | 'backpack' | 'deliveryBox' | 'tote';
export type HandKind = 'none' | 'basket' | 'briefcase';

export interface Palette {
  skin: number;
  /** Kafa malzemesi — genelde skin, kapüşonlu hırsızda gölgeli koyu ton. */
  face: number;
  hair: number;
  /** Gövde taban rengi (tişört / gömlek). */
  shirt: number;
  /** Üst giysi (yelek, ceket, hırka) rengi. */
  over: number;
  /** Üst giysinin ikinci rengi (reflektif bant, düğme, desen). */
  overAlt: number;
  apron: number;
  /** Üst kol rengi. */
  sleeve: number;
  /** Alt kol — sıvalı kolda ten rengi olur. */
  forearm: number;
  pants: number;
  shoe: number;
  hat: number;
  accent: number;
  eye: number;
  mouth: number;
  brow: number;
}

export interface AppearanceSpec {
  role: CharRole;
  variant: number;
  /** Nominal 1.75 boya uygulanan çarpan (opts.scale ile çarpılır). */
  heightMul: number;
  girthMul: number;
  /** Kafa büyüklüğü — mobil okunurluk ile doğal oran arasındaki stil çarpanı. */
  headMul: number;
  shoulderMul: number;
  pal: Palette;
  hat: HatKind;
  hair: HairKind;
  over: OverKind;
  back: BackKind;
  hand: HandKind;
  /** Reflektif / kontrast bant sayısı (hi-vis). */
  bands: number;
  /** Omuz rütbesi 0..3 */
  stripes: number;
  apron: boolean;
  pocketLogo: boolean;
  pencil: boolean;
  buttons: boolean;
  tie: boolean;
  nameTag: boolean;
  keyring: boolean;
  headphones: boolean;
  camera: boolean;
  wristbands: boolean;
  mustache: boolean;
  blush: boolean;
  legStripe: boolean;
  stripedShirt: boolean;
  boots: boolean;
  /** Varsayılan gövde öne eğimi (radyan) — sinsi duruş. */
  hunch: number;
}

/* ---------------------------------------------------------------- palet */

const MINT = 0x4fb59a;
const GOLD = 0xffc84a;
const NAVY = 0x243349;
const CREAM = 0xf4ead6;

const SKINS = [0xf7d5b0, 0xf1c39a, 0xe6b083, 0xd39a6e, 0xbc8154, 0x9f6545, 0x7d4b38, 0x573528];
const HAIRS = [0x17120f, 0x2b1d16, 0x46301f, 0x6e4829, 0x9b6b35, 0xd0a55d, 0x7e3426, 0x77736d];
const PANTS = [0x26364d, 0x343b48, 0x493e37, 0x354557, 0x272d37, 0x56616e];
const GLOBAL_TOPS = [0x31857e, 0xd96755, 0x4c70a7, 0xd29a32, 0x765aa1, 0x4f7a5d, 0xe7e1d6, 0x343941];
const GLOBAL_OVERS = [0x286d68, 0xb95448, 0x3f628e, 0xb27d2d, 0x665186, 0x486b54, 0xd7d1c6, 0x454b55];
const GLOBAL_SHOES = [0xf1efe9, 0x242930, 0x5a4b41, 0xd8dce1];

const _c = new THREE.Color();
const _hsl = { h: 0, s: 0, l: 0 };

/**
 * Rengi 5 bitlik kanallara yuvarlar. Rastgele varyasyon istiyoruz ama her
 * karakterin bambaşka bir hex üretmesi Materials önbelleğini şişirirdi —
 * kuantalama sayesinde benzer tonlar aynı malzemeyi paylaşır.
 */
function quant(hex: number): number {
  const r = ((hex >> 16) & 0xff) & 0xf8;
  const g = ((hex >> 8) & 0xff) & 0xf8;
  const b = (hex & 0xff) & 0xf8;
  return (r << 16) | (g << 8) | b;
}

/** Rengin tonunu/parlaklığını hafifçe kaydırır — aynı arketipten iki kişi aynı görünmesin. */
function jitter(color: number, r: Rng, hue = 0.03, sat = 0.1, light = 0.07): number {
  _c.setHex(color);
  _c.getHSL(_hsl);
  _c.setHSL(
    (_hsl.h + r.range(-hue, hue) + 1) % 1,
    clamp(_hsl.s * (1 + r.range(-sat, sat)), 0, 1),
    clamp(_hsl.l * (1 + r.range(-light, light)), 0.04, 0.97),
  );
  return quant(_c.getHex());
}

/** Doygunluğu artırır — personel seviyesi yükseldikçe renkler canlanır. */
function saturate(color: number, amount: number): number {
  if (amount <= 0) return color;
  _c.setHex(color);
  _c.getHSL(_hsl);
  _c.setHSL(_hsl.h, clamp(_hsl.s * (1 + amount), 0, 1), clamp(_hsl.l * (1 + amount * 0.12), 0, 0.96));
  return quant(_c.getHex());
}

function basePalette(r: Rng): Palette {
  const skin = jitter(r.pick(SKINS), r, 0.012, 0.12, 0.05);
  const hair = jitter(r.pick(HAIRS), r, 0.02, 0.2, 0.18);
  return {
    skin,
    face: skin,
    hair,
    shirt: 0xd8d2c4,
    over: 0x9aa3ad,
    overAlt: 0xe8ecef,
    apron: MINT,
    sleeve: 0xd8d2c4,
    forearm: 0xd8d2c4,
    pants: r.pick(PANTS),
    shoe: 0x36302a,
    hat: 0x8f9296,
    accent: GOLD,
    eye: 0x1b1712,
    mouth: 0x7a3b34,
    brow: shade(hair, 0.8),
  };
}

function baseSpec(role: CharRole, variant: number, pal: Palette): AppearanceSpec {
  return {
    role,
    variant,
    heightMul: 1,
    girthMul: 1,
    headMul: 1,
    shoulderMul: 1,
    pal,
    hat: 'none',
    hair: 'short',
    over: 'none',
    back: 'none',
    hand: 'none',
    bands: 0,
    stripes: 0,
    apron: false,
    pocketLogo: false,
    pencil: false,
    buttons: false,
    tie: false,
    nameTag: false,
    keyring: false,
    headphones: false,
    camera: false,
    wristbands: false,
    mustache: false,
    blush: false,
    legStripe: false,
    stripedShirt: false,
    boots: false,
    hunch: 0,
  };
}

/* ------------------------------------------------------------ personel */

/** Seviye 0..8 → 0–3 altın çizgi (3 seviyede bir). */
function rankStripes(level: number): number {
  return clamp(Math.round(level / 3), 0, 3);
}

const STAFF_HAIRS: readonly HairKind[] = ['short', 'fringe', 'mop', 'bun', 'ponytail'];

/** Aynı rolden işe alınan kişiler kopya değil, aynı üniformayı giyen farklı insanlardır. */
function finishStaffIdentity(s: AppearanceSpec, r: Rng): void {
  // Clean It dilinde personel de uzun/ince değil: kısa bacak okuması,
  // dolgun gövde ve uzaktan seçilen iri kafa ortak silüet kuralıdır.
  s.heightMul *= r.range(0.93, 0.99);
  s.girthMul *= r.range(1.03, 1.13);
  s.headMul *= r.range(1.06, 1.13);
  s.shoulderMul *= r.range(0.98, 1.04);
  if (s.hair !== 'none') s.hair = r.pick(STAFF_HAIRS);
  s.mustache = r.chance(0.08);
  s.blush = r.chance(0.18);
  s.nameTag = false;
}

function buildStaff(role: CharRole, s: AppearanceSpec, r: Rng, level: number): void {
  const p = s.pal;
  const boost = level * 0.035;
  s.stripes = rankStripes(level);
  p.pants = jitter(NAVY, r, 0.01, 0.1, 0.08);
  p.shoe = 0x1a2130;

  if (role === 'runner') {
    // Lacivert tulum + turuncu güvenlik yeleği + sarı bere, sırtta boş kasa.
    s.heightMul = 1.04;
    s.girthMul = 1.09;
    s.headMul = 1.03;
    s.shoulderMul = 1.08;
    p.shirt = p.pants;
    p.sleeve = p.pants;
    p.forearm = p.pants;
    p.over = saturate(jitter(0xf0862c, r, 0.012, 0.06, 0.05), boost);
    p.overAlt = 0xdfe6ec;
    p.hat = saturate(0xf2c94c, boost);
    p.shoe = 0x3a2a1c;
    s.over = 'vest';
    s.bands = 2;
    s.hat = 'beanie';
    s.hair = 'none';
    s.back = 'crate';
    s.boots = true;
    finishStaffIdentity(s, r);
    return;
  }

  if (role === 'waiter') {
    /**
     * Beyaz gömlek, SIVALI KOL, uzun KOYU YEŞİL ÖNLÜK, kulak arkasında
     * kalem. Silüetin ayırt edici parçası uzun önlük: baristanın krem aşçı
     * ceketiyle uzaktan bile karışmaz.
     */
    s.heightMul = 1.03;
    s.girthMul = 0.99;
    s.shoulderMul = 1.0;
    p.shirt = 0xf9f6ef;
    p.sleeve = 0xf9f6ef;
    p.forearm = p.skin; // sıvalı kol
    p.apron = saturate(jitter(0x2f5a4c, r, 0.01, 0.08, 0.06), boost);
    p.over = p.apron;
    p.overAlt = 0xf9f6ef;
    p.hair = jitter(0x2c2018, r, 0.02, 0.2, 0.14);
    p.shoe = 0x22262c;
    s.over = 'none';
    s.hat = 'none';
    s.hair = 'short';
    s.apron = true;
    s.pencil = true;
    finishStaffIdentity(s, r);
    return;
  }

  if (role === 'busser') {
    // Açık mavi iş ceketi, kasket, SARI LASTİK ELDİVEN ve çizme.
    // Eldiven silüetin en ayırt edici parçası: uzaktan bile "temizlikçi" okunur.
    s.heightMul = 1.02;
    s.girthMul = 1.0;
    s.shoulderMul = 1.02;
    p.shirt = jitter(0x6fb3dd, r, 0.012, 0.1, 0.08);
    p.sleeve = p.shirt;
    p.forearm = saturate(0xf5c542, boost); // eldiven
    p.over = saturate(jitter(0x3f7fae, r, 0.012, 0.08, 0.06), boost);
    p.overAlt = 0xdfe6ec;
    p.hat = p.over;
    p.hair = jitter(0x2c2018, r, 0.02, 0.2, 0.14);
    p.shoe = 0x2b3440;
    s.over = 'jacket';
    s.hat = 'flatCap';
    s.hair = 'short';
    s.back = 'none';
    s.boots = true;
    finishStaffIdentity(s, r);
    return;
  }

  if (role === 'cashier') {
    // Beyaz gömlek + nane yelek + vizör.
    s.heightMul = 0.99;
    s.girthMul = 1.0;
    s.shoulderMul = 0.95;
    p.shirt = 0xf7f4ee;
    p.sleeve = 0xf7f4ee;
    p.forearm = 0xf7f4ee;
    p.over = saturate(jitter(MINT, r, 0.012, 0.08, 0.06), boost);
    p.overAlt = 0xf7f4ee;
    p.hat = p.over;
    p.hair = jitter(0x3a2818, r, 0.02, 0.2, 0.16);
    s.over = 'vest';
    s.hat = 'visor';
    s.hair = 'ponytail';
    finishStaffIdentity(s, r);
    return;
  }

  // Krem aşçı ceketi (çift sıra düğme), bordo bandana, önlük, sıvalı kol.
  s.heightMul = 0.98;
  s.girthMul = 1.02;
  p.shirt = CREAM;
  p.over = saturate(jitter(CREAM, r, 0.008, 0.1, 0.03), boost * 0.5);
  p.overAlt = 0x2b3440;
  p.sleeve = p.over;
  p.forearm = p.skin;
  p.apron = 0xe6dcc6;
  p.hat = saturate(jitter(0x7d2b3d, r, 0.012, 0.1, 0.08), boost);
  p.hair = jitter(0x241a12, r, 0.02, 0.2, 0.12);
  p.shoe = 0xeeeae0;
  s.over = 'chef';
  s.buttons = true;
  s.apron = true;
  s.hat = 'bandana';
  s.hair = 'short';
  finishStaffIdentity(s, r);
}

/* ----------------------------------------------------- üniforma kozmetiği */

/**
 * EV RENGİ — takımı birleştirir, silüeti BOZMAZ.
 *
 * Roller uzaktan biçimden ayrılır (uzun önlük / yelek+vizör / ceket+sarı
 * eldiven / aşçı ceketi+bandana); renk yalnız "aynı kafede çalışıyorlar"
 * bilgisini taşır. Yine de her rol ev renginin FARKLI BİR DEĞERİNİ alır:
 * dört kişi bir kadraja girdiğinde tek bir renk lekesi olmasınlar.
 *
 * Buradaki hiçbir satır `r` (Rng) OKUMAZ ve okumamalıdır — bu fonksiyon
 * `buildStaff` bittikten SONRA çalışır. `Appearance` tohum sözleşmesi
 * (isimli müdavimlerin yüzü) rastgele okuma SIRASINA bağlı; sıraya
 * dokunmadığı için üniforma seçimi hiçbir müşterinin görünüşünü
 * değiştirmez. Ayrıca müşteri/kaçak rolleri buraya hiç uğramaz.
 */
function applyUniform(role: CharRole, s: AppearanceSpec, house: number, trim: number): void {
  const p = s.pal;
  const deep = shade(house, 0.74);
  const light = mix(house, 0xffffff, 0.3);

  if (role === 'waiter') {
    // Uzun önlük ev rengini TAM taşır (silüetin en büyük yüzeyi).
    p.apron = house;
    p.over = house;
    p.overAlt = trim;
    p.shirt = trim;
    p.sleeve = trim;
    return;
  }
  if (role === 'cashier') {
    // Yelek + vizör; garsondan AÇIK olsun diye açık değer.
    p.over = light;
    p.hat = light;
    p.overAlt = trim;
    p.shirt = trim;
    p.sleeve = trim;
    p.forearm = trim;
    return;
  }
  if (role === 'busser') {
    /**
     * Ceket + kasket koyu değer alır, gömlek açık kalır.
     * SARI ELDİVEN (p.forearm) DOKUNULMAZ: "temizlikçi" okumasının tek
     * uzak mesafe işareti o, üniformayla birlikte kaybolursa komi
     * kalabalıkta garsondan ayırt edilemez hâle gelir.
     */
    p.over = deep;
    p.hat = deep;
    p.shirt = light;
    p.sleeve = light;
    p.overAlt = trim;
    return;
  }
  if (role === 'barista') {
    /**
     * AŞÇI CEKETİ KREM KALIR (mutfak beyazı bir meslek işareti,
     * koyu renge boyanınca barista "garson" gibi okunuyor). Ev rengi
     * bandanaya, düğme sırasına ve önlüğe gider.
     */
    p.hat = deep;
    p.overAlt = deep;
    /**
     * Önlük KREME YAKIN kalır (%78 krem). İlk deneme %62 beyazdı ve
     * 375×812'de ölçüldü: bordo takımda barista ile kasiyer neredeyse aynı
     * pembe lekeye dönüşüyordu — ikisi de gövdesi açık tonlu, farkları
     * yalnız baş parçası. Önlük mutfak beyazında kalınca barista yine
     * "aşçı" okunuyor, ev rengini bandana ve düğme sırası taşıyor.
     */
    p.apron = mix(house, 0xe6dcc6, 0.78);
    return;
  }
  if (role === 'runner') {
    // Güvenlik yeleği; reflektif bant görünürlük için krem kalır.
    p.over = house;
    p.hat = light;
  }
}

/* ------------------------------------------------------------ müşteri */

function buildCustomer(s: AppearanceSpec, r: Rng): void {
  const p = s.pal;
  const top = jitter(r.pick(GLOBAL_TOPS), r, 0.025, 0.08, 0.07);
  const outer = jitter(r.pick(GLOBAL_OVERS), r, 0.025, 0.08, 0.07);
  const outfit = r.pick<OverKind>(['none', 'none', 'hoodie', 'jacket', 'cardigan', 'vest', 'patterned']);

  // Davranış profili görünüş belirlemez: her doğuş bağımsız bir modüler kişi.
  s.heightMul = r.range(0.92, 0.99);
  s.girthMul = r.range(1.02, 1.16);
  s.headMul = r.range(1.06, 1.14);
  s.shoulderMul = r.range(0.96, 1.06);
  s.over = outfit;
  s.hair = r.pick<HairKind>(['short', 'short', 'fringe', 'mop', 'bun', 'ponytail']);

  p.shirt = top;
  p.over = outer;
  p.overAlt = mix(outer, 0xffffff, 0.28);
  p.pants = jitter(r.pick(PANTS), r, 0.018, 0.08, 0.08);
  p.shoe = jitter(r.pick(GLOBAL_SHOES), r, 0.01, 0.05, 0.04);
  p.accent = jitter(r.pick(GLOBAL_TOPS), r, 0.025, 0.08, 0.07);

  const longSleeve = outfit === 'hoodie' || outfit === 'jacket' || outfit === 'cardigan' || outfit === 'vest';
  p.sleeve = longSleeve ? outer : top;
  p.forearm = longSleeve ? outer : p.skin;

  if (r.chance(0.18)) {
    s.hat = r.pick<HatKind>(['capBack', 'beanie', 'visor']);
    p.hat = p.accent;
    if (s.hat === 'beanie') s.hair = 'none';
  }
  if (r.chance(0.2)) s.back = r.pick<BackKind>(['backpack', 'tote']);
  s.headphones = r.chance(0.08) && s.hat === 'none';
  s.stripedShirt = r.chance(0.12);
  s.legStripe = r.chance(0.1);
  s.wristbands = r.chance(0.06);
  s.mustache = r.chance(0.07);
  s.blush = r.chance(0.18);
}

/* --------------------------------------------------------------- giriş */

/**
 * TOHUM SÖZLEŞMESİ — rastgele kalabalık tekrar üretilebilir kalır.
 *
 * Aşağıdaki fonksiyon SAF'tır: verilen `(role, variant, level, seed)`
 * dördülü için her zaman bire bir aynı reçeteyi üretir. Tek rastgelelik
 * kaynağı `new Rng(seed)`; `basePalette` ve `buildCustomer` içindeki tüm
 * `jitter`/`pick` çağrıları o diziden SIRAYLA okur. `Math.random()` bu
 * dosyada hiç kullanılmaz.
 *
 * Sabit tohum aynı modüler kişiyi üretir; sıradan müşteriler her doğuşta
 * yeni tohum aldığı için görünüş hiçbir davranış profiline ya da isme bağlı değildir.
 */
export function createAppearance(role: CharRole, opts: CharacterOpts = {}): AppearanceSpec {
  const level = clamp(Math.floor(opts.level ?? 0), 0, 8);
  const requestedVariant = Math.max(0, Math.floor(opts.variant ?? 0));
  const seed = (opts.seed ?? requestedVariant * 7919 + 0x3c6ef35f) >>> 0;
  const variant = opts.variant === undefined ? seed % 9 : requestedVariant;
  const r = new Rng(seed);

  const pal = basePalette(r);
  const s = baseSpec(role, variant, pal);

  switch (role) {
    case 'player': {
      // Sabit ana kahraman: petrol kumaş, krem detaylar ve bakır vurgu.
      // Renkler yalnız kıyafete uygulanır; ten, saç ve yüz değişmez.
      // Tohum yalnız animasyon fazını etkiler; görünüş yenilemede değişmez.
      pal.skin = 0xf1c39a;
      pal.face = pal.skin;
      pal.hair = 0x33231b;
      pal.brow = 0x2a1c15;
      pal.shirt = FINCAN_PLAYER_WORKWEAR.main;
      pal.sleeve = FINCAN_PLAYER_WORKWEAR.edge;
      pal.forearm = pal.skin;
      pal.apron = FINCAN_PLAYER_WORKWEAR.edge;
      pal.accent = FINCAN_PLAYER_WORKWEAR.badge;
      pal.hat = pal.hair;
      pal.pants = FINCAN_PLAYER_WORKWEAR.pants;
      pal.shoe = FINCAN_PLAYER_WORKWEAR.shoes;
      s.heightMul = 0.93;
      s.girthMul = 1.13;
      s.headMul = 1.16;
      s.shoulderMul = 1.03;
      s.hat = 'none';
      s.hair = 'bun';
      s.apron = false;
      s.pocketLogo = false;
      s.pencil = false;
      s.keyring = true;
      s.blush = true;
      break;
    }

    case 'runner':
    case 'waiter':
    case 'cashier':
    case 'barista':
    case 'busser': {
      buildStaff(role, s, r, level);
      // Üniforma kozmetiği: rastgele okuma bittikten SONRA, tohum
      // sözleşmesine dokunmadan (bkz. applyUniform).
      const u = uniformSkin(opts.uniform ?? '');
      if (u.house !== null) applyUniform(role, s, u.house, u.trim);
      break;
    }

    case 'dasher': {
      // Kaçak müşteri — kapüşon KAPALI, yüz gölgede, sinsi öne eğik duruş.
      const dark = jitter(0x2b3038, r, 0.02, 0.15, 0.14);
      pal.face = 0x241d1a;
      pal.hair = dark;
      pal.shirt = dark;
      pal.over = dark;
      pal.overAlt = 0xe4e0d8;
      pal.sleeve = dark;
      pal.forearm = dark;
      pal.hat = dark;
      pal.pants = shade(dark, 0.82);
      pal.shoe = 0x191c22;
      pal.eye = 0xd8d2c4;
      pal.brow = dark;
      pal.mouth = 0x3a2a26;
      s.heightMul = 0.96;
      s.girthMul = 1.1;
      s.headMul = 1.1;
      s.over = 'hoodie';
      s.hat = 'hood';
      s.hair = 'none';
      s.stripedShirt = true;
      s.hunch = 0.24;
      break;
    }

    case 'investor': {
      // Zengin Yatırımcı VIP — altın takım elbise, kravat, evrak çantası.
      const gold = 0xd4af37;
      pal.shirt = 0xffffff;
      pal.over = gold;
      pal.overAlt = 0xb45309;
      pal.sleeve = gold;
      pal.forearm = pal.skin;
      pal.pants = 0x292524;
      pal.shoe = 0x1c1917;
      pal.accent = gold;
      s.heightMul = 1.08;
      s.girthMul = 1.05;
      s.headMul = 1.05;
      s.over = 'suit';
      s.hand = 'briefcase';
      s.tie = true;
      s.buttons = true;
      s.hair = 'short';
      s.hat = 'none';
      break;
    }

    default:
      buildCustomer(s, r);
      break;
  }

  s.heightMul *= opts.scale ?? 1;
  s.girthMul *= opts.girth ?? 1;
  return s;
}
