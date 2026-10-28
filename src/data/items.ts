import { tr } from "../core/I18n";
/**
 * Ürün tanımları.
 *
 * ZİNCİR YOK. Her menü ürünü kendi makinesinden DOĞRUDAN çıkar; "su al →
 * semavere koy → çayı al" gibi üç adımlı hatlar bilerek kaldırıldı. Oyuncunun
 * zamanı istasyonlar arası mekik dokumakla değil, SİPARİŞİ MASAYA YETİŞTİRMEK
 * ve MEKÂNI TEMİZ TUTMAKLA geçmeli.
 *
 * Geriye üç kademe kaldı: menü ürünü, tuvalet sarfı, bulaşık.
 */

export type ItemId =
  /* --- menü (Köşe Şubesi) — v5: raf başına bir ürün, 5 SKU --- */
  | 'cay'
  | 'latte'
  | 'tost'
  | 'waffle'
  | 'frappe'
  /* --- menü (Sahil Şubesi) --- */
  | 'smoothie'
  | 'dondurma'
  | 'milkshake'
  /* --- sarf malzemesi (tuvalet) --- */
  | 'pecete'
  | 'kagit'
  /* --- atık --- */
  | 'bulasik';

export type ItemTier = 'product' | 'supply' | 'waste';

/** 3D mesh üretiminde kullanılan kaba biçim ipucu. */
export type ItemShape =
  | 'teaglass' // ince belli çay bardağı
  | 'espressocup'
  | 'lattecup'
  | 'croissant'
  | 'sandwich'
  | 'cakeslice'
  | 'waffle'
  | 'tallglass'
  | 'frappeglass'
  | 'smoothieglass'
  | 'cone'
  | 'shake'
  | 'napkin'
  | 'roll'
  | 'dirtydish';

export interface ItemDef {
  id: ItemId;
  /** Türkçe görünen ad */
  name: string;
  tier: ItemTier;
  shape: ItemShape;
  /** Ana gövde rengi */
  color: number;
  /** İkincil detay rengi */
  accent: number;
  /** UI'da kullanılan emoji rozeti */
  glyph: string;
  /** Menüdeyse taban fiyat (₺). Değilse 0. */
  price: number;
  /**
   * Masada tüketilme süresi çarpanı — çay hızlı içilir, cheesecake oyalanır.
   * Masa devir hızını bu belirler: pahalı ürünün gizli maliyeti budur.
   */
  dwell?: number;
}

const D = (d: ItemDef) => d;

export const ITEMS: Record<ItemId, ItemDef> = {
  /* ---------------- menü: Köşe Şubesi ---------------- */
  cay:        { id: 'cay',        get name() { return tr("Çay"); },        tier: 'product', shape: 'teaglass',      color: 0xc2551f, accent: 0xf2d9a8, glyph: '🫖', price: 25,   dwell: 0.75 },
  latte:      { id: 'latte',      get name() { return tr("Sütlü Kahve"); }, tier: 'product', shape: 'lattecup',      color: 0xf3efe6, accent: 0xc08a4e, glyph: '☕', price: 82,   dwell: 1.0 },
  tost:       { id: 'tost',       get name() { return tr("Tost"); },       tier: 'product', shape: 'sandwich',      color: 0xd9a55c, accent: 0xf2c94c, glyph: '🥪', price: 210,  dwell: 1.2 },
  waffle:     { id: 'waffle',     get name() { return tr("Vafıl"); },       tier: 'product', shape: 'waffle',        color: 0xe8bd72, accent: 0xd8567a, glyph: '🧇', price: 520,  dwell: 1.3 },
  frappe:     { id: 'frappe',     get name() { return tr("Buzlu Kahve"); }, tier: 'product', shape: 'frappeglass',   color: 0xc8a077, accent: 0xfff4e2, glyph: '🥤', price: 1150, dwell: 1.05 },

  /* ---------------- menü: Sahil Şubesi ---------------- */
  smoothie:   { id: 'smoothie',   get name() { return tr("Meyve Karışımı"); }, tier: 'product', shape: 'smoothieglass', color: 0xff8fa8, accent: 0x7ed957, glyph: '🥤', price: 2400, dwell: 0.95 },
  dondurma:   { id: 'dondurma',   get name() { return tr("Dondurma"); },   tier: 'product', shape: 'cone',          color: 0xfff2f6, accent: 0xffb0c4, glyph: '🍦', price: 3600, dwell: 0.8 },
  milkshake:  { id: 'milkshake',  get name() { return tr("Sütlü Kokteyl"); }, tier: 'product', shape: 'shake',         color: 0xffd9e2, accent: 0xd8567a, glyph: '🥤', price: 5200, dwell: 1.1 },

  /* ---------------- sarf ---------------- */
  pecete:     { id: 'pecete',     get name() { return tr("Peçete"); },     tier: 'supply', shape: 'napkin', color: 0xfdfbf5, accent: 0xd8c9a8, glyph: '🧻', price: 0 },
  kagit:      { id: 'kagit',      get name() { return tr("Tuvalet Kâğıdı"); }, tier: 'supply', shape: 'roll',   color: 0xffffff, accent: 0xd0d7db, glyph: '🧻', price: 0 },

  /* ---------------- atık ---------------- */
  bulasik:    { id: 'bulasik',    get name() { return tr("Bulaşık"); },    tier: 'waste',  shape: 'dirtydish', color: 0xbfc7cc, accent: 0x7d8a92, glyph: '🍽️', price: 0 },
};

export const ALL_ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export function item(id: ItemId): ItemDef {
  return ITEMS[id];
}

export function itemName(id: ItemId): string {
  return ITEMS[id].name;
}

/** Menüye girebilen ürünler. */
export const MENU_ITEMS: ItemId[] = ALL_ITEM_IDS.filter((i) => ITEMS[i].tier === 'product');

/** Tuvalete konan sarf malzemeleri. */
export const SUPPLY_ITEMS: ItemId[] = ALL_ITEM_IDS.filter((i) => ITEMS[i].tier === 'supply');

export function isSupply(id: ItemId): boolean {
  return ITEMS[id].tier === 'supply';
}

export function isProduct(id: ItemId): boolean {
  return ITEMS[id].tier === 'product';
}

/** Masada bu ürünle geçirilen süre çarpanı. */
export function dwellMult(id: ItemId): number {
  return ITEMS[id].dwell ?? 1;
}
