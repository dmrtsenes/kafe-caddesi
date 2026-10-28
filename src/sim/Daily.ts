import { tr } from "../core/I18n";
import { stationsOfLocation, type StationKind } from '../data/stations';
import type { GameState } from './GameState';

/**
 * GÜNLÜK DÖNGÜ — geri dönmek için bir sebep.
 *
 * Oyunun geri dönme kancası şu ana kadar TEK bir şeydi: offline kazanç
 * ekranı. Tür lideri oyunlarda bu yeterli değil; oyuncu ertesi gün
 * uygulamayı açtığında onu bekleyen somut bir şey olmalı.
 *
 * İki parça:
 *  1. GÜNLÜK ÖDÜL — 7 günlük merdiven, seri büyüdükçe artar.
 *  2. GÜNLÜK GÖREV — 3 adet, günün tarihinden türetilir (her cihazda aynı
 *     gün aynı görevler; sunucu gerekmez).
 *
 * "ASLA CEZALANDIRMA" kuralı burada da geçerli: seri kırılınca hiçbir şey
 * kaybedilmez, yalnızca merdiven baştan başlar ve metin bunu suçlayıcı
 * olmayan bir dille söyler.
 */

/** Yerel takvim günü — saat dilimi kaymasın diye UTC değil YEREL alınır. */
export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** İki gün anahtarı arasındaki fark (gün). */
export function daysBetween(a: string, b: string): number {
  const pa = Date.parse(a + 'T00:00:00');
  const pb = Date.parse(b + 'T00:00:00');
  if (!Number.isFinite(pa) || !Number.isFinite(pb)) return 99;
  return Math.round((pb - pa) / 86_400_000);
}

/**
 * 7 günlük ödül merdiveni — ÖLÇÜLEN GELİRİN DAKİKASI cinsinden.
 *
 * Sabit sayı olamaz (birinci günün oyuncusu için ₺500 büyük para, yirminci
 * saatin oyuncusu için hiçbir şey); `totalEarned` yüzdesi de olamaz (ölçüm:
 * bütün katman ~10 dakikalık gelir ediyordu). Tür normu tek başına günlük
 * ödül için 15 dk – 2 saat; merdiven bu bandın altına, oyunun kendi
 * temposuna göre yerleştirildi.
 */
const LADDER_MINUTES = [3, 4, 5, 7, 9, 12, 16];

export function dailyReward(streakDay: number, incomePerSec: number): number {
  const mins = LADDER_MINUTES[Math.min(streakDay, LADDER_MINUTES.length - 1)];
  return Math.max(400, Math.round(incomePerSec * 60 * mins));
}

/* ================================================================ *
 *  Görevler
 * ================================================================ */

export type MissionCounter = 'served' | 'cleaned' | 'mopped' | 'refills' | 'dashers' | 'orders';

/** Only the counter and target persist; titles follow the current language. */
export interface DailyMissionSave {
  counter: MissionCounter;
  target: number;
}

export interface MissionDef {
  counter: MissionCounter;
  /**
   * Hedef adedi. `missionsFor` bunu dünkü GERÇEKLEŞENDEN (dailyPrevDone)
   * türetir — sabit bir ölçek değil, oyuncunun kendi dünkü temposunun
   * %55'i (v5.2). `base` tabanının altına asla inmez.
   */
  target: number;
  title: string;
  glyph: string;
}

interface MissionTemplate {
  counter: MissionCounter;
  /**
   * Hedefin inemeyeceği TABAN (v5.2) — artık ÇARPAN DEĞİL. Eski formül
   * `hedef = ceil(taban × ölçek)` idi (`ölçek` = computeScale, silindi);
   * yeni formül hedefi dünkü gerçekleşenden türetiyor ve `base` yalnız ALT
   * SINIRI belirliyor (bkz. missionsFor). Kaçak (`dashers`) bu hesaba hiç
   * girmez — hedefi dünkü sayıdan bağımsız her zaman sabit 1'dir.
   */
  base: number;
  title: (n: number) => string;
  glyph: string;
}

const TEMPLATES: MissionTemplate[] = [
  { counter: 'served', base: 40, title: (n) => tr("{0} ürün sat", n), glyph: '🛒' },
  { counter: 'cleaned', base: 15, title: (n) => tr("{0} bulaşık topla", n), glyph: '🧽' },
  { counter: 'mopped', base: 10, title: (n) => tr("{0} leke temizle", n), glyph: '🧹' },
  { counter: 'refills', base: 6, title: (n) => tr("{0} sarf malzemesi doldur", n), glyph: '🧻' },
  { counter: 'dashers', base: 1, title: (n) => tr("{0} kaçak müşteri yakala", n), glyph: '🏃' },
  { counter: 'orders', base: 25, title: (n) => tr("{0} sipariş al", n), glyph: '📝' },
];

/**
 * Tarihten türetilen deterministik karıştırıcı (sunucu gerekmez).
 * Festival rotasyonu da aynı karıştırıcıyı HAFTA anahtarıyla kullanır
 * (bkz. sim/Festival.ts) — o yüzden dışa açık.
 */
export function hashDay(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mechanics reachable in any owned branch; daily counters are global. */
function availableCounters(state: GameState): Set<MissionCounter> {
  const available = new Set<MissionCounter>();
  for (const location of state.unlockedLocations) {
    const open = stationsOfLocation(location).filter((st) => state.isZoneUnlocked(location, st.zone));
    const has = (kind: StationKind): boolean => open.some((st) => st.kind === kind);
    const canServe = has('machine') && has('counter') && (has('table') || has('pickup'));
    if (canServe) {
      available.add('served');
      available.add('orders');
      if (has('table') && has('bin')) available.add('cleaned');
    }
    // Floor dust appears as soon as the salon is open; no paid tool is required.
    if (has('table')) available.add('mopped');
    if (has('pickup') && has('machine')) available.add('dashers');
    if (has('toilet') && has('supply')) available.add('refills');
  }
  return available;
}

export const DAILY_TARGET_CAPS: Record<MissionCounter, number> = { served: 150, cleaned: 60, mopped: 45, refills: 40, dashers: 1, orders: 100 };

function targetFor(template: MissionTemplate, state: GameState): number {
  if (template.counter === 'dashers') return 1;
  const previous = state.dailyPrevDone[template.counter];
  const done = Number.isFinite(previous) ? Math.max(0, previous) : 0;
  return Math.min(DAILY_TARGET_CAPS[template.counter], Math.max(template.base, Math.ceil(done * 0.55)));
}

function pickTemplate(
  dayKey: string,
  index: number,
  used: Set<MissionCounter>,
  available?: Set<MissionCounter>,
): MissionTemplate | undefined {
  const start = (hashDay(dayKey) >>> (index * 5)) % TEMPLATES.length;
  for (let offset = 0; offset < TEMPLATES.length; offset++) {
    const template = TEMPLATES[(start + offset) % TEMPLATES.length];
    if (!used.has(template.counter) && (!available || available.has(template.counter))) return template;
  }
  return undefined;
}

function selectMissions(dayKey: string, state: GameState, available?: Set<MissionCounter>): DailyMissionSave[] {
  const used = new Set<MissionCounter>();
  const result: DailyMissionSave[] = [];
  for (let i = 0; i < 3; i++) {
    const template = pickTemplate(dayKey, i, used, available);
    if (!template) break;
    used.add(template.counter);
    result.push({ counter: template.counter, target: targetFor(template, state) });
  }
  return result;
}

/**
 * Freeze today's identities and targets. Purchases, branch switches, changing
 * language and reloads must not move a claimed reward to another mission.
 * Old saves have only slot-based claims: migrate those slots in place, replacing
 * only unfinished tasks whose mechanic is locked (also handles a cafe reset).
 */
export function missionsFor(dayKey: string, state: GameState): MissionDef[] {
  const available = availableCounters(state);
  const activeDay = dayKey !== '' && dayKey === state.dailyDay;
  const legacy = selectMissions(dayKey, state);
  const assignments = activeDay && state.dailyMissions.length === 3
    ? state.dailyMissions.map((mission) => ({ ...mission }))
    : activeDay ? legacy : selectMissions(dayKey, state, available);

  if (activeDay) {
    const used = new Set<MissionCounter>();
    const kept = new Set<number>();
    const valid = (mission: DailyMissionSave | undefined): boolean =>
      !!mission && TEMPLATES.some((template) => template.counter === mission.counter) &&
      Number.isSafeInteger(mission.target) && mission.target > 0;

    // Reserve claimed slots first, including any completed mechanic now locked.
    // Never clear their flags or offer a second reward after migrating a save.
    for (let i = 0; i < 3; i++) {
      if (!state.dailyMissionDone[i]) continue;
      if (!valid(assignments[i])) assignments[i] = legacy[i];
      used.add(assignments[i].counter);
      kept.add(i);
    }
    for (let i = 0; i < 3; i++) {
      if (kept.has(i)) continue;
      const mission = assignments[i];
      if (valid(mission) && available.has(mission.counter) && !used.has(mission.counter)) {
        used.add(mission.counter);
        kept.add(i);
      }
    }
    for (let i = 0; i < 3; i++) {
      if (kept.has(i)) continue;
      const template = pickTemplate(dayKey, i, used, available);
      // Every supported cafe starts with five eligible mechanics. Retain the
      // slot in a malformed custom save rather than shifting claim indices.
      assignments[i] = template
        ? { counter: template.counter, target: targetFor(template, state) }
        : legacy[i];
      used.add(assignments[i].counter);
    }
    state.dailyMissions = assignments;
  }

  return assignments.map((mission) => {
    const template = TEMPLATES.find((entry) => entry.counter === mission.counter)!;
    return { ...mission, title: template.title(mission.target), glyph: template.glyph };
  });
}

export function missionReward(incomePerSec: number): number {
  return Math.max(200, Math.round(incomePerSec * 60 * 3));
}

/* ================================================================ *
 *  Gün devri
 * ================================================================ */

export interface DailyRollResult {
  /** Yeni bir gün başladı mı (ödül alınabilir). */
  newDay: boolean;
  /** Seri kırıldı mı (ceza yok, yalnızca metin için). */
  streakBroken: boolean;
}

/**
 * Günü ilerletir. Oyun açılışında ve gece yarısını geçen oturumlarda
 * çağrılır; aynı gün içinde tekrar çağrılması zararsızdır.
 */
export function rollDay(state: GameState, now = new Date()): DailyRollResult {
  const key = todayKey(now);
  if (state.dailyDay === key) {
    // Capture an upgraded legacy save before the player can buy more rooms.
    if (state.dailyMissions.length !== 3) missionsFor(key, state);
    return { newDay: false, streakBroken: false };
  }

  // DİKKAT: bu iki değer dailyDay yazılmadan ÖNCE okunmalı.
  const firstEver = state.dailyDay === '';
  const gap = firstEver ? 99 : daysBetween(state.dailyDay, key);
  /**
   * GERİYE ALINAN SAAT YENİ GÜN DEĞİLDİR. `gap < 0` (cihaz tarihi geri
   * çekilmiş) eskiden "yeni gün" sayılıyordu: tarihi bir gün geri alıp
   * tekrar ileri almak, her seferinde toplam kazancın %12-14'ünü ödeyen
   * sınırsız bir para musluğu açıyordu. Geri tarih artık gün devri
   * tetiklemez; oyuncu gerçek takvime dönene kadar mevcut gün sürer.
   */
  if (gap < 0) {
    if (state.dailyMissions.length !== 3) missionsFor(state.dailyDay, state);
    return { newDay: false, streakBroken: false };
  }
  const broken = !firstEver && gap > 1;

  state.dailyDay = key;
  if (firstEver || broken) state.dailyStreak = 0;
  // LADDER_MINUTES ile aynı uzunluk (7): merdivenin son basamağı bu index.
  else state.dailyStreak = Math.min(state.dailyStreak + 1, LADDER_MINUTES.length - 1);
  state.dailyClaimed = false;
  state.dailyMissionDone = [false, false, false];
  /**
   * DÜNÜN GERÇEKLEŞENİ. `dailyBase` günün BAŞINDAKİ fotoğrafı tuttuğu için
   * tek başına dünün toplamını veremez; farkı burada, taban ezilmeden önce
   * almak zorundayız.
   */
  const prev: Record<string, number> = {};
  for (const k of ['served', 'cleaned', 'mopped', 'refills', 'dashers', 'orders'] as const) {
    prev[k] = Math.max(0, (state.stats[k] ?? 0) - (state.dailyBase[k] ?? 0));
  }
  if (!firstEver) state.dailyPrevDone = prev;
  // Günün sayaç tabanı: görevler "bugün" yapılanı ölçer.
  state.dailyBase = {
    served: state.stats.served,
    cleaned: state.stats.cleaned,
    mopped: state.stats.mopped,
    refills: state.stats.refills,
    dashers: state.stats.dashers,
    orders: state.stats.orders,
  };
  state.dailyMissions = selectMissions(key, state, availableCounters(state));
  return { newDay: true, streakBroken: broken };
}

/** Bir görevin bugünkü ilerlemesi. */
export function missionProgress(state: GameState, m: MissionDef): number {
  const now = state.stats[m.counter] ?? 0;
  const base = state.dailyBase[m.counter] ?? 0;
  return Math.max(0, now - base);
}

/* ================================================================ *
 *  Haftalık hedef (v5.1) — ISO haftası, Pazartesi başlar.
 *
 *  Günlük görevlerin bir üst oktavı: hafta boyunca dolan TEK büyük
 *  hedef. Hafta değişince sıfırlanır, alınmamış ödül sessizce düşer —
 *  ceza yok, yalnızca yeni bir hafta ve yeni bir hedef vardır.
 * ================================================================ */

/**
 * ISO-8601 hafta anahtarı: "2026-W33". Pazartesi başlar; haftanın hangi
 * yıla ait olduğunu o haftanın PERŞEMBESİ belirler (ISO kuralı — yılbaşı
 * haftası iki yıla yayılınca anahtar cihazlar arasında oynamaz).
 * `todayKey` ile aynı gerekçeyle YEREL saat kullanılır.
 */
export function weekKeyOf(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // bu haftanın perşembesi
  const week1 = new Date(d.getFullYear(), 0, 4); // 4 Ocak daima 1. haftadadır
  const week =
    1 + Math.round(((d.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Haftanın kalan günü, bugün dahil: Pazartesi 7 … Pazar 1. */
export function weekDaysLeft(now = new Date()): number {
  return 7 - ((now.getDay() + 6) % 7);
}

/**
 * Haftayı ilerletir; anahtar değiştiyse true. Aynı hafta içinde tekrar
 * çağrılması zararsızdır. Geri alınan tarih burada da musluk açmaz:
 * anahtar değişimi tabanı O ANKİ sayaca kurar, hedef sıfırdan dolar.
 */
export function rollWeek(state: GameState, now = new Date()): boolean {
  const key = weekKeyOf(now);
  if (state.weekKey === key) return false;
  // Geçen haftanın gerçekleşeni, taban ezilmeden önce saklanır.
  if (state.weekKey !== '') state.weekPrevServed = Math.max(0, state.stats.served - state.weekBase);
  state.weekKey = key;
  state.weekBase = state.stats.served;
  state.weekClaimed = false;
  return true;
}

/**
 * Haftalık hedef: geçen haftanın GERÇEKLEŞENİNİN %90'ı, en az 300.
 *
 * Eski formül `sqrt(weekBase/60) × 7 × 40` idi ve karekök sönümü yüzünden
 * kafe büyüdükçe kolaylaşıyordu (ölçüm: boştaki kafe 1835 hedefini 40
 * dakikada bitiriyordu). Kendi geçmişine bakan hedef bu tuzağı yapısal
 * olarak kapatır: hedef her zaman "geçen hafta yaptığının biraz altı".
 */
export function weeklyTarget(state: GameState): number {
  return Math.min(1500, Math.max(300, Math.ceil(state.weekPrevServed * 0.9)));
}

/** Bu hafta servis edilen ürün. */
export function weeklyProgress(state: GameState): number {
  return Math.max(0, state.stats.served - state.weekBase);
}

/** Haftalık büyük nakit: 25 dakikalık gelir. */
export function weeklyReward(incomePerSec: number): number {
  return Math.max(2000, Math.round(incomePerSec * 60 * 25));
}
