import type { ItemId } from '../../data/items';
import type { StationVisualKind } from '../../data/stations';
import manifest from './manifest.json';

const FURNITURE = manifest.kenneyFurniture.files;
const FOOD = manifest.kenneyFood.files;

export type FurnitureId = keyof typeof FURNITURE;
export type FoodId = keyof typeof FOOD;
export type PackId = FurnitureId | FoodId;

export function isPackId(id: string): id is PackId {
  return id in FURNITURE || id in FOOD;
}

export function packFileName(id: PackId): string {
  if (id in FURNITURE) return FURNITURE[id as FurnitureId];
  return FOOD[id as FoodId];
}

export function packUrl(id: PackId): string {
  const base = import.meta.env.BASE_URL ?? './';
  const slash = base.endsWith('/') ? '' : '/';
  return `${base}${slash}packs/kenney/${packFileName(id)}`;
}

export const ALL_PACK_IDS: PackId[] = [
  ...(Object.keys(FURNITURE) as FurnitureId[]),
  ...(Object.keys(FOOD) as FoodId[]),
];

export interface StationPackSpec {
  id: FurnitureId;
  xz: number;
}

/** Görsel tür → pack. xz, STATION_BODY yatay ölçüsüyle aynı (tam genişlik). */
export const STATION_PACK: Partial<Record<StationVisualKind, StationPackSpec>> = {
  table: { id: 'table-round', xz: 1.44 },
  tablesq: { id: 'table-square', xz: 1.6 },
  viptable: { id: 'table-vip', xz: 1.72 },
  samovar: { id: 'coffee-machine', xz: 1.7 },
  espresso: { id: 'coffee-machine', xz: 2.1 },
  steamer: { id: 'coffee-machine', xz: 1.8 },
  oven: { id: 'stove', xz: 1.9 },
  panini: { id: 'toaster', xz: 1.8 },
  dessertbench: { id: 'cabinet', xz: 1.8 },
  wafflemaker: { id: 'waffle-iron', xz: 1.7 },
  coldbar: { id: 'fridge', xz: 2.0 },
  blender: { id: 'blender', xz: 1.7 },
  icecream: { id: 'fridge', xz: 1.78 },
  juicebar: { id: 'fridge', xz: 2.0 },
  napkinbox: { id: 'cabinet', xz: 1.5 },
  papershelf: { id: 'cabinet', xz: 1.5 },
  counter: { id: 'counter', xz: 2.54 },
  bin: { id: 'bin', xz: 0.88 },
  toilet: { id: 'toilet', xz: 2.0 },
};

export const ITEM_PACK: Partial<Record<ItemId, FoodId>> = {
  cay: 'cup-tea',
  latte: 'cup-coffee',
  tost: 'sandwich',
  waffle: 'waffle',
  frappe: 'frappe',
  smoothie: 'soda-glass',
  dondurma: 'ice-cream',
  milkshake: 'sundae',
  bulasik: 'plate',
};

export const CHAIR_HEIGHT = 0.92;
export const PRODUCT_XZ = 0.32;
export const PLANT_XZ = 0.22;
