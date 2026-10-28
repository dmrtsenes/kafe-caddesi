import { tr, formatDecimal } from "../core/I18n";

const number = (value: number, maximumFractionDigits = 1) => formatDecimal(value, maximumFractionDigits);
export type PlayerUpgradeId = 'speed' | 'capacity' | 'hands' | 'charm' | 'vault';

export interface PlayerUpgradeDef {
  id: PlayerUpgradeId;
  name: string;
  desc: string;
  glyph: string;
  maxLevel: number;
  baseCost: number;
  growth: number;
  /** Seviye başına gösterilecek değer metni */
  format: (level: number) => string;
}

export const PLAYER_UPGRADES: PlayerUpgradeDef[] = [
  {
    id: 'speed',
    name: tr("Rahat Ayakkabı"),
    desc: tr("Salonda daha hızlı hareket et."),
    glyph: '👟',
    maxLevel: 10,
    baseCost: 180,
    growth: 1.7,
    format: (l) => tr("{0} hız", number(playerSpeed(l))),
  },
  {
    id: 'capacity',
    name: tr("Servis Tepsisi"),
    desc: tr("Tek seferde daha çok bardak ve tabak taşı."),
    glyph: '🍽️',
    maxLevel: 12,
    baseCost: 260,
    growth: 1.62,
    format: (l) => tr("{0} adet", playerCapacity(l)),
  },
  {
    id: 'hands',
    name: tr("Usta Eller"),
    desc: tr("Alma ve bırakma çok daha hızlı."),
    glyph: '🤲',
    maxLevel: 10,
    baseCost: 320,
    growth: 1.65,
    format: (l) => tr("{0} adet/sn", number(1 / handsInterval(l))),
  },
  {
    id: 'charm',
    name: tr("Güler Yüz"),
    desc: tr("Bütün satışların hesap değerini artırır."),
    glyph: '😊',
    maxLevel: 10,
    baseCost: 700,
    growth: 1.58,
    format: (l) => tr("+%{0} hesap", Math.round((charmMult(l) - 1) * 100)),
  },
  /**
   * 'vault' (Kasa Deposu) LİSTEDE YOK. Offline para kazancı oyundan
   * tamamen çıkarıldı ("sadece oyundayken kazanılsın") — süreyi uzatan
   * bir yükseltmenin satılacak şeyi kalmadı. Tip birliği ve eski kayıt
   * uyumu için kimlik `PlayerUpgradeId`de duruyor; UI bu listeden
   * beslendiği için oyuncuya hiç görünmüyor.
   */
];

export const PLAYER_UPGRADE_MAP: Record<PlayerUpgradeId, PlayerUpgradeDef> = Object.fromEntries(
  PLAYER_UPGRADES.map((u) => [u.id, u]),
) as Record<PlayerUpgradeId, PlayerUpgradeDef>;

/* ---------------- türev değerler ---------------- */

export function playerSpeed(level: number): number {
  // L0 2.7 → L10 6.5; +0.38 per level. Balanced progression.
  return 2.7 + level * 0.38;
}

export function playerCapacity(level: number): number {
  return 3 + level;
}

/** Bir birim alma/bırakma arasındaki süre (sn) */
export function handsInterval(level: number): number {
  return 0.52 * Math.pow(0.904, level);
}

export function charmMult(level: number): number {
  return 1 + level * 0.09;
}

export function offlineCapHours(level: number): number {
  // Taban 2 saatti: bir gün sonra dönen oyuncu yalnızca 2 saatlik kazanç
  // alıyordu. Tür normu 4-8 saat; taban 4'e çekildi.
  return [4, 6, 8, 10, 12, 14, 16][level] ?? 16;
}

export function upgradeCost(def: PlayerUpgradeDef, level: number): number {
  return Math.round(def.baseCost * Math.pow(def.growth, level));
}

/* ---------------- istasyon yükseltmeleri ---------------- */

export const STATION_SPEED_GROWTH = 1.52;
export const STATION_CAP_GROWTH = 1.46;
export const STATION_SPEED_MAX = 8;
export const STATION_CAP_MAX = 8;

/** Her seviye hazırlık süresini %11 kısaltır. */
export function stationSpeedMult(level: number): number {
  return Math.pow(0.89, level);
}

/** Her seviye çıkış/giriş kapasitesine +2 ekler (masada +1 sandalye). */
export function stationCapBonus(level: number): number {
  return level * 2;
}

export function stationUpgradeCost(base: number, level: number, growth: number): number {
  return Math.round(base * Math.pow(growth, level));
}
