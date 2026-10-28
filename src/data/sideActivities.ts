import type { ItemId } from './items';
import { SIDE_GARDEN_LAYOUT } from './sideGardenLayout';

export type SideActivityId = 'garden' | 'courtyard';
export interface SideActivityRecipeLine { item: ItemId; quantity: number }
export interface SideActivityDef {
  id: SideActivityId;
  name: string;
  requires: string;
  accent: number;
  workbench: { x: number; z: number };
  service: { x: number; z: number };
  purchase: { x: number; z: number };
  costs: readonly number[];
  recipes: readonly (readonly SideActivityRecipeLine[])[];
}

/** Side work uses the existing production menu and never introduces another currency. */
export const SIDE_ACTIVITIES: readonly SideActivityDef[] = [
  {
    id: 'garden', name: 'Bahçe Çay Evi', requires: 'a3', accent: 0x57966e,
    workbench: SIDE_GARDEN_LAYOUT.garden.bench, service: SIDE_GARDEN_LAYOUT.garden.service,
    purchase: SIDE_GARDEN_LAYOUT.garden.purchase, costs: [800, 1600, 3600, 7200],
    recipes: [
      [{ item: 'cay', quantity: 2 }],
      [{ item: 'cay', quantity: 2 }, { item: 'tost', quantity: 1 }],
      [{ item: 'latte', quantity: 1 }, { item: 'cay', quantity: 2 }],
      [{ item: 'cay', quantity: 2 }, { item: 'waffle', quantity: 1 }],
    ],
  },
  {
    id: 'courtyard', name: 'Avlu Paket Servisi', requires: 'a5', accent: 0xc38d6b,
    workbench: SIDE_GARDEN_LAYOUT.courtyard.bench, service: SIDE_GARDEN_LAYOUT.courtyard.service,
    purchase: SIDE_GARDEN_LAYOUT.courtyard.purchase, costs: [2200, 3600, 7500, 15000],
    recipes: [
      [{ item: 'tost', quantity: 2 }],
      [{ item: 'latte', quantity: 1 }, { item: 'tost', quantity: 2 }],
      [{ item: 'waffle', quantity: 1 }, { item: 'latte', quantity: 1 }],
      [{ item: 'frappe', quantity: 1 }, { item: 'tost', quantity: 1 }],
    ],
  },
];
export const SIDE_ACTIVITY_IDS: readonly SideActivityId[] = ['garden', 'courtyard'];
export const SIDE_ACTIVITY_BY_ID = Object.fromEntries(SIDE_ACTIVITIES.map(d => [d.id, d])) as Record<SideActivityId, SideActivityDef>;
export const SIDE_ACTIVITY_MAX_LEVEL = 4;
export const SIDE_ACTIVITY_CLEAN_SECONDS = 1.4;
export const SIDE_ACTIVITY_AUTO_SECONDS = 6;
export const SIDE_ACTIVITY_VALUE_MULT = [0, 1.5, 1.65, 1.65, 1.8] as const;
export const SIDE_ACTIVITY_BONUS_RATE = 0.25;
/** A suspended page cannot convert one oversized frame into hours of work. */
export const SIDE_ACTIVITY_MAX_DT = 0.25;

/** Named presentation aliases keep the model and the world adapter on one definition. */
export const SIDE_ACTIVITY_DEFS = Object.fromEntries(SIDE_ACTIVITIES.map(def => [def.id, { ...def, title: def.name, color: def.accent }])) as Record<SideActivityId, SideActivityDef & { title: string; color: number }>;
