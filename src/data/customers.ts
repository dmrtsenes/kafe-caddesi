import { tr } from "../core/I18n";
/**
 * Müşteri arketipleri — görünüm + sipariş davranışı birlikte tanımlanır.
 *
 * SABIR YÜKSEK, SİPARİŞ KÜÇÜK. Servis oyununda her ek ürün garsona ayrı bir
 * mutfak turu demek; üç kalemlik bir sipariş 20 saniyelik iş yaratıyor ve
 * müşterilerin yarısı masada beklerken küsüyordu. Artık kimse ikiden fazla
 * kalem ve ikiden fazla adet istemiyor.
 *
 * Arketip yalnız davranış üretir. Görünüş her doğuşta bağımsız ve rastgele
 * kurulur; hiçbir müşteri adı, sabit yüzü veya ülkeye özgü kimliği taşımaz.
 */

export interface CustomerArchetype {
  id: string;
  name: string;
  /** chars/Appearance.ts bu numarayı alarak farklı bir görünüm kurar (0..8) */
  variant: number;
  /** Boy çarpanı */
  scale: number;
  /** Gövde genişliği çarpanı */
  girth: number;
  /** Yürüme hızı (birim/sn) */
  speed: number;
  /** Sırada / masada bekleyebileceği toplam süre (sn) */
  patience: number;
  /** Siparişteki farklı ürün sayısı aralığı */
  minLines: number;
  maxLines: number;
  /** Ürün başına adet aralığı */
  minQty: number;
  maxQty: number;
  /** Ödeme çarpanı (bahşiş dahil) */
  payMult: number;
  /** Spawn ağırlığı */
  weight: number;
  /** Ucuz/pahalı ürün tercihi: 0 = en ucuzu sever, 1 = en pahalıyı sever */
  tasteBias: number;
  /** Oturma eğilimi (BALANCE.orders.dineInChance ile çarpılır) */
  dineInBias: number;
  /** Masada oyalanma çarpanı — laptopçu uzun oturur, kurye hiç oturmaz */
  dwellMult: number;
}

export const CUSTOMER_ARCHETYPES: CustomerArchetype[] = [
  {
    id: 'ogrenci', name: tr("Öğrenci"), variant: 1,
    scale: 1.05, girth: 0.9, speed: 2.1, patience: 36,
    minLines: 1, maxLines: 2, minQty: 1, maxQty: 2, payMult: 0.9, weight: 17, tasteBias: 0.22,
    dineInBias: 1.15, dwellMult: 1.4,
  },
  {
    id: 'ofisli', name: tr("Ofis Çalışanı"), variant: 6,
    scale: 1.07, girth: 0.94, speed: 2.3, patience: 21,
    minLines: 1, maxLines: 2, minQty: 1, maxQty: 2, payMult: 1.4, weight: 13, tasteBias: 0.85,
    dineInBias: 0.5, dwellMult: 0.7,
  },
  {
    id: 'emekli', name: tr("Kıdemli Misafir"), variant: 0,
    scale: 0.94, girth: 1.16, speed: 1.4, patience: 53,
    minLines: 1, maxLines: 2, minQty: 1, maxQty: 2, payMult: 0.92, weight: 14, tasteBias: 0.1,
    dineInBias: 1.3, dwellMult: 1.5,
  },
  {
    id: 'arkadaslar', name: tr("Sosyal Misafir"), variant: 2,
    scale: 1.0, girth: 1.02, speed: 1.8, patience: 42,
    minLines: 1, maxLines: 2, minQty: 1, maxQty: 2, payMult: 1.15, weight: 13, tasteBias: 0.5,
    dineInBias: 1.25, dwellMult: 1.25,
  },
  {
    id: 'freelancer', name: tr("Uzaktan Çalışan"), variant: 3,
    scale: 1.03, girth: 0.95, speed: 1.9, patience: 48,
    minLines: 1, maxLines: 2, minQty: 1, maxQty: 2, payMult: 1.1, weight: 11, tasteBias: 0.55,
    dineInBias: 1.4, dwellMult: 1.85,
  },
  {
    id: 'turist', name: tr("Gezgin"), variant: 4,
    scale: 1.03, girth: 1.06, speed: 1.6, patience: 56,
    minLines: 1, maxLines: 2, minQty: 1, maxQty: 2, payMult: 1.5, weight: 9, tasteBias: 0.8,
    dineInBias: 1.2, dwellMult: 1.3,
  },
  {
    id: 'sporcu', name: tr("Sporcu"), variant: 5,
    scale: 1.09, girth: 0.96, speed: 2.5, patience: 25,
    minLines: 1, maxLines: 2, minQty: 1, maxQty: 2, payMult: 1.05, weight: 10, tasteBias: 0.6,
    dineInBias: 0.7, dwellMult: 0.8,
  },
  {
    id: 'komsu', name: tr("Günlük Misafir"), variant: 7,
    scale: 0.92, girth: 1.12, speed: 1.5, patience: 62,
    minLines: 1, maxLines: 2, minQty: 1, maxQty: 2, payMult: 1.0, weight: 12, tasteBias: 0.3,
    dineInBias: 1.3, dwellMult: 1.45,
  },
  {
    id: 'kurye', name: tr("Kurye"), variant: 8,
    scale: 1.02, girth: 0.98, speed: 2.8, patience: 18,
    minLines: 1, maxLines: 1, minQty: 1, maxQty: 2, payMult: 1.3, weight: 9, tasteBias: 0.45,
    dineInBias: 0, dwellMult: 0.6,
  },
];

/** Hesabı ödemeden kaçan müşteri (kaos olayı). */
export const DASHER_ARCHETYPE: CustomerArchetype = {
  id: 'kacak', name: tr("Kaçak Müşteri"), variant: 8,
  scale: 1.04, girth: 0.95, speed: 2.6, patience: 999,
  minLines: 1, maxLines: 1, minQty: 3, maxQty: 5, payMult: 0, weight: 0, tasteBias: 1,
  dineInBias: 0, dwellMult: 1,
};

/** Sosyal medya fenomeni (kaos olayı) — hızlı servis edilirse itibar patlar. */
export const INFLUENCER_ARCHETYPE: CustomerArchetype = {
  id: 'fenomen', name: tr("Sosyal Medya Fenomeni"), variant: 4,
  scale: 1.06, girth: 0.92, speed: 2.1, patience: 48,
  minLines: 1, maxLines: 2, minQty: 1, maxQty: 2, payMult: 2.2, weight: 0, tasteBias: 0.95,
  dineInBias: 2, dwellMult: 1.2,
};

/** Zengin Yatırımcı (VIP karakter — reklamla nakit destek hibe eder). */
export const INVESTOR_ARCHETYPE: CustomerArchetype = {
  id: 'yatirimci', name: tr("Zengin Yatırımcı"), variant: 7,
  scale: 1.10, girth: 1.05, speed: 2.0, patience: 999,
  minLines: 0, maxLines: 0, minQty: 0, maxQty: 0, payMult: 0, weight: 0, tasteBias: 1,
  dineInBias: 0, dwellMult: 1,
};

const TOTAL_WEIGHT = CUSTOMER_ARCHETYPES.reduce((s, a) => s + a.weight, 0);

export function pickArchetype(r: number): CustomerArchetype {
  let acc = r * TOTAL_WEIGHT;
  for (const a of CUSTOMER_ARCHETYPES) {
    acc -= a.weight;
    if (acc <= 0) return a;
  }
  return CUSTOMER_ARCHETYPES[0];
}

export function archetypeById(id: string): CustomerArchetype {
  if (id === 'yatirimci') return INVESTOR_ARCHETYPE;
  if (id === 'kacak') return DASHER_ARCHETYPE;
  if (id === 'fenomen') return INFLUENCER_ARCHETYPE;
  for (const a of CUSTOMER_ARCHETYPES) if (a.id === id) return a;
  return CUSTOMER_ARCHETYPES[0];
}
