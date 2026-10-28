import { tr } from "../core/I18n";
/** Offline café team: assigned shelf restocking, checkout, machine help, table care.
 * Staff owns a limited part of the café; carrying, sales and active floor cleaning
 * remain meaningful player work. Capacity and speed describe real implemented work.
 */

export type StaffRole = 'waiter' | 'cashier' | 'barista' | 'busser';

export interface StaffRoleDef {
  id: StaffRole;
  name: string;
  desc: string;
  glyph: string;
  hireCost: number;
  hireGrowth: number;
  maxCount: number;
  levelCost: number;
  levelGrowth: number;
  maxLevel: number;
  color: string;
}

export const STAFF_ROLES: StaffRoleDef[] = [
  {
    id: 'waiter',
    name: tr("Tezgâhtar"),
    desc: tr("Atandığı ürünün rafını düzenli doldurur. Seviye arttıkça taşıdığı parti büyür."),
    glyph: '🧺',
    hireCost: 400,
    // 1.85–2.15: next hire stays a few minutes. Waiter 1 = 400, waiter 6 = round(400×1.85^5) = 8668.
    hireGrowth: 1.85,
    maxCount: 6,
    levelCost: 320,
    levelGrowth: 1.72,
    maxLevel: 10,
    color: '#c9793f',
  },
  {
    id: 'cashier',
    name: tr("Kasiyer"),
    desc: tr("Siparişi alır ve sırayı akıtır. Kasada biriken parayı oyuncu toplar."),
    glyph: '🧾',
    hireCost: 2600,
    hireGrowth: 2.05,
    maxCount: 4,
    levelCost: 1800,
    levelGrowth: 1.8,
    maxLevel: 10,
    color: '#376152',
  },
  {
    id: 'busser',
    name: tr("Masa Görevlisi"),
    desc: tr("Sorumlu olduğu masaların bulaşığını toplar ve yüzeyini siler. Zemin ve tuvaleti oyuncu temizler."),
    glyph: '🧹',
    hireCost: 9000,
    hireGrowth: 2.0,
    maxCount: 5,
    levelCost: 6000,
    levelGrowth: 1.82,
    maxLevel: 10,
    color: '#5b9bd5',
  },
  {
    id: 'barista',
    name: tr("Kahve Ustası"),
    desc: tr("Seçildiği makinenin hazırlığını hızlandırır. Ürün taşımaz ve raf doldurmaz."),
    glyph: '👩‍🍳',
    hireCost: 18000,
    hireGrowth: 2.15,
    maxCount: 5,
    levelCost: 8000,
    levelGrowth: 1.52,
    maxLevel: 10,
    color: '#d8607a',
  },
];

export const STAFF_ROLE_MAP: Record<StaffRole, StaffRoleDef> = Object.fromEntries(
  STAFF_ROLES.map((r) => [r.id, r]),
) as Record<StaffRole, StaffRoleDef>;

export function hireCost(def: StaffRoleDef, owned: number): number {
  return Math.round(def.hireCost * Math.pow(def.hireGrowth, owned));
}

export function staffLevelCost(def: StaffRoleDef, level: number): number {
  return Math.round(def.levelCost * Math.pow(def.levelGrowth, level));
}

/* --------- rol türev değerleri (seviye 0 tabanlı) --------- */

export function waiterSpeed(level: number): number {
  return 2.25 + level * 0.15;
}
/** Aynı anda kaç ürün taşıyabilir (sepet). */
export function waiterCapacity(level: number): number {
  return 2 + Math.floor(level * 0.6);
}
/** Rafın gerçek hedef doluluk kapasitesi; tezgâhtarın tek seferlik taşıma sepetiyle sınırlandırılmaz. */
export function waiterShelfTarget(level: number, shelfCapacity?: number): number {
  if (shelfCapacity !== undefined) return Math.max(0, shelfCapacity);
  return Math.max(3, waiterCapacity(level));
}
/** Bir ürünü alma / rafa dizme süresi (sn). */
export function waiterHandInterval(level: number): number {
  return 0.75 * Math.pow(0.96, level);
}

export function cashierSpeed(level: number): number {
  return 2.0 + level * 0.1;
}
/** Bir siparişi alma süresi (sn). */
export function cashierOrderTime(level: number): number {
  return 2.4 * Math.pow(0.95, level);
}

export function baristaSpeed(level: number): number {
  return 2.15 + level * 0.12;
}
/** Visible +25% preparation at hire, +85% at level10; player help remains ×2. */
export function baristaBoost(level: number): number {
  return 1.25 + level * 0.06;
}
export function baristaCapacity(level: number): number {
  return 3 + Math.floor(level * 0.8);
}

export function busserSpeed(level: number): number {
  return 2.6 + level * 0.16;
}
export function busserCapacity(level: number): number {
  return 3 + Math.floor(level * 0.8);
}
/** Bir bulaşık toplama / bir leke silme adımı (sn). */
export function busserWorkTime(level: number): number {
  return 1.65 * Math.pow(0.94, level);
}

// Show which meaningful work remains with the player at every staffing level.
export const PLAYER_STAFF_WORK: Record<StaffRole, string> = {
  cashier: "Sen: masa servisi ve para toplama",
  waiter: "Sen: masalar ve özel siparişler",
  busser: "Sen: servis ve başladığın masa bakımı",
  barista: "Sen: ürün seçimi, taşıma ve servis",
};
export const STAFF_JOIN_BENEFIT: Record<StaffRole, string> = {
  cashier: "Sipariş sırasını alır; servis sende.",
  waiter: "Rafı doldurur; masalara sen servis yaparsın.",
  busser: "Diğer masaları toparlar; başladığın işi sana bırakır.",
  barista: "Hazırlığı hızlandırır; sen el verince daha da hızlanır.",
};
