import { tr } from "../core/I18n";
import type { GameState } from './GameState';
import { itemName, type ItemId } from '../data/items';
import { hashDay, weekKeyOf } from './Daily';
import { stationsOfLocation } from '../data/stations';

/**
 * FESTİVAL ROTASYONU — sunucusuz haftalık tema.
 *
 * Her ISO haftası deterministik bir festival taşır: anahtar hafta
 * numarasından türediği için AYNI HAFTA HER CİHAZDA AYNI festivaldir ve
 * uygulamayı kapatıp açmak festivali değiştirmez (günlük görevlerle aynı
 * ilke). Beş ürün festivali + iki genel tema; etkiler küçük ve olumlu —
 * festival bir kapı değil, haftaya renk veren bir çarpandır.
 *
 * Bu modül SAF veri + hesaptır: dünyaya hiçbir şey uygulamaz. Etki
 * muslukları World'e ana oturumda
 * bağlanır:
 *   · festivalValueMult(item)  → World.chargeOrder, satır başına
 *   · festivalCleanMult()      → World.cleanReward
 */

export type FestivalKind = 'item' | 'clean' | 'guest';

export interface FestivalDef {
  id: string;
  /** Panel başlığı: "ÇAY BAYRAMI". */
  title: string;
  /** HUD çipindeki kısa ad: "ÇAY". */
  short: string;
  glyph: string;
  /** Etki cümlesi — çarpanı oyuncu diliyle söyler. */
  desc: string;
  kind: FestivalKind;
  /** Yalnız ürün festivallerinde: değeri artan ürün. */
  itemId?: ItemId;
}

/** Ürün festivali: o ürünün geliri ×1,35 (World.chargeOrder'a bağlanır). */
export const FESTIVAL_ITEM_MULT = 1.35;
/** Temizlik haftası: temizlik ödülleri ×1,5 (World.cleanReward'a bağlanır). */
export const FESTIVAL_CLEAN_MULT = 1.5;
/** Servis haftası: tüm ürün geliri ×1,15. */
export const FESTIVAL_GUEST_VALUE_MULT = 1.15;

/**
 * Yedi festival — hashDay(haftaAnahtarı) % 7 seçer. Sıra ve adlar spec'ten
 * (v5.1 §2); ürün festivalleri Köşe menüsünün beş ürünü.
 */
export const FESTIVALS: readonly FestivalDef[] = [
  {
    id: 'f_cay', title: tr("ÇAY BAYRAMI"), short: tr("ÇAY"), glyph: '🍵', kind: 'item', itemId: 'cay',
    desc: tr("Çay bu hafta %35 fazla kazandırıyor."),
  },
  {
    id: 'f_kahve', title: tr("KAHVE HAFTASI"), short: tr("KAHVE"), glyph: '☕', kind: 'item', itemId: 'latte',
    desc: tr("Sütlü kahve bu hafta %35 fazla kazandırıyor."),
  },
  {
    id: 'f_tost', title: tr("TOST ŞENLİĞİ"), short: tr("TOST"), glyph: '🥪', kind: 'item', itemId: 'tost',
    desc: tr("Tost bu hafta %35 fazla kazandırıyor."),
  },
  {
    id: 'f_waffle', title: tr("VAFIL FESTİVALİ"), short: tr("VAFIL"), glyph: '🧇', kind: 'item', itemId: 'waffle',
    desc: tr("Vafıl bu hafta %35 fazla kazandırıyor."),
  },
  {
    id: 'f_frappe', title: tr("BUZLU KAHVE ÇILGINLIĞI"), short: tr("BUZLU KAHVE"), glyph: '🥤', kind: 'item', itemId: 'frappe',
    desc: tr("Buzlu kahve bu hafta %35 fazla kazandırıyor."),
  },
  {
    id: 'f_temizlik', title: tr("TEMİZLİK HAFTASI"), short: tr("TEMİZLİK"), glyph: '🧹', kind: 'clean',
    desc: tr("Temizlik ödülleri bu hafta %50 fazla."),
  },
  {
    id: 'f_misafir', title: tr("SERVİS HAFTASI"), short: tr("SERVİS"), glyph: '🤝', kind: 'guest',
    desc: tr("Tüm siparişler bu hafta %15 fazla kazandırıyor."),
  },
];

export { weekDaysLeft, weekKeyOf } from './Daily';

/** Haftanın festivali — tarihten türetilir, kayda bakmaz. */
export function currentFestival(now = new Date()): FestivalDef {
  return FESTIVALS[hashDay(weekKeyOf(now)) % FESTIVALS.length];
}

/**
 * Festivalin saydığı KÜMÜLATİF sayaç. Hepsi kayıtta zaten var:
 *   · ürün    → stats.sale[itemId]  (chargeOrder → addSale, satır başına)
 *   · temizlik→ cleaned + mopped    (bulaşık + leke)
 *   · servis   → tamamlanan sipariş sayısı
 * İlerleme = sayaç − festivalBase (hafta başı fotoğrafı).
 */
export function festivalCounter(state: GameState, def: FestivalDef): number {
  if (def.kind === 'item') return def.itemId ? (state.stats.sale[def.itemId] ?? 0) : 0;
  if (def.kind === 'clean') return state.stats.cleaned + state.stats.mopped;
  return state.stats.orders;
}

/**
 * Festival haftasını ilerletir; anahtar değiştiyse true. Taban o anki
 * sayaca kurulur — tarih oynatmak hedefi baştan doldurtur, bedava ödül
 * üretmez (rollDay/rollWeek ile aynı ilke).
 */
function accessible(state: GameState, def: FestivalDef): boolean {
  return def.kind !== 'item' || [...state.unlockedLocations].some(location =>
    stationsOfLocation(location).some(st => st.item === def.itemId && st.kind === 'machine' &&
      state.isZoneUnlocked(location, st.zone)));
}

/** The weekly bonus stays global; the reward task is selected once for this cafe. */
export function festivalGoalDefinition(state: GameState, now = new Date()): FestivalDef {
  const saved = FESTIVALS.find(def => def.id === state.festivalGoalId);
  if (state.festivalWeek === weekKeyOf(now) && saved) return saved;
  const theme = currentFestival(now);
  const eligible = theme.kind !== 'item' || [...state.unlockedLocations].some(location =>
    stationsOfLocation(location).some(st => st.item === theme.itemId && st.kind === 'machine' &&
      state.isZoneUnlocked(location, st.zone)));
  return eligible ? theme : FESTIVALS.find(def => def.kind === 'guest')!;
}

export function rollFestival(state: GameState, now = new Date()): boolean {
  const key = weekKeyOf(now);
  const sameWeek = state.festivalWeek === key;
  const saved = FESTIVALS.find(def => def.id === state.festivalGoalId);
  if (sameWeek && saved && accessible(state, saved) && state.festivalGoalTarget > 0) return false;
  if (!sameWeek && state.festivalWeek !== '') {
    const prev = saved ?? FESTIVALS[hashDay(state.festivalWeek) % FESTIVALS.length];
    if (prev.kind === 'item') state.festPrevItem = Math.max(0, festivalCounter(state, prev) - state.festivalBase);
  }
  const oldTheme = currentFestival(now);
  state.festivalGoalId = '';
  const def = festivalGoalDefinition(state, now);
  // Existing accessible missions keep their counter baseline and claimed status.
  // Inaccessible legacy item tasks become service tasks with a fresh baseline.
  const preserveBase = sameWeek && !saved && def.id === oldTheme.id;
  state.festivalWeek = key;
  state.festivalGoalId = def.id;
  state.festivalGoalTarget = targetFor(state, def);
  if (!preserveBase) state.festivalBase = festivalCounter(state, def);
  if (!sameWeek) state.festivalClaimed = false;
  return true;
}

/**
 * Festival hedefi — türe göre farklı kaynaktan türer (bkz. rollFestival ve
 * alttaki yorumlar): ürün kendi geçmişinin %90'ı, temizlik her hafta
 * tazelenen servis geçmişinin bir payı, misafir SABİT (arz tavanlı — bkz.
 * aşağıdaki yorum). Ürün/temizlik taban altına inmez.
 */
export function festivalTarget(state: GameState, def: FestivalDef = festivalGoalDefinition(state)): number {
  return state.festivalGoalId === def.id && state.festivalGoalTarget > 0 ? state.festivalGoalTarget : targetFor(state, def);
}

function targetFor(state: GameState, def: FestivalDef): number {
  // ÜRÜN: kendi türünün geçmişinden — ürün haftaları 7'de 5 geldiği için
  // bu değer sık tazelenir ve tek bir SKU'nun gerçek hacmini taşır
  // (çay ile frappe'nin haftalık adedi çok farklı; toplam servisten
  // türetmek ucuz ürün haftasını kolay, pahalı ürün haftasını imkânsız
  // yapardı).
  if (def.kind === 'item') return Math.max(120, Math.ceil(state.festPrevItem * 0.9));
  // TEMİZLİK: bu tür 7 haftada bir geldiği için kendi geçmişi BAYATLIYOR —
  // hedef 7 hafta önceki kafeye göre kurulur ve bu, tam da bu görevin
  // kapattığı "hedef büyümenin gerisinde kalıyor" hatasının aynısıdır. Her
  // hafta tazelenen weekPrevServed'den türer: temizlik işi servis
  // hacmiyle birlikte büyür.
  //
  // KATSAYI 0,35 — ÖLÇÜLDÜ VE TUTUYOR (I3, bot koşumu, 2026-08-16): gerçek
  // oran (cleaned + mopped) / served = 0,696 — hedefin İKİ KATI arz var.
  // Katsayıyı büyütmeye gerek yok; bu not bir daha sorgulanmasın diye
  // düşüldü.
  if (def.kind === 'clean') return Math.max(60, Math.ceil(state.weekPrevServed * 0.35));
  // Servis hedefi doğrudan önceki haftanın gerçek sipariş hacmine ölçeklenir.
  return Math.max(100, Math.ceil(state.weekPrevServed * 0.9));
}

/** Bu haftaki ilerleme. Taban henüz bu haftaya kurulmadıysa 0 okunur. */
export function festivalProgress(
  state: GameState,
  def: FestivalDef = festivalGoalDefinition(state),
  now = new Date(),
): number {
  if (state.festivalWeek !== weekKeyOf(now)) return 0;
  return Math.max(0, festivalCounter(state, def) - state.festivalBase);
}

/** Festival ödülü: 20 dakikalık gelir (kupon Game tarafında eklenir). */
export function festivalReward(incomePerSec: number): number {
  return Math.max(1500, Math.round(incomePerSec * 60 * 20));
}

/** Hedef cümlesi — panelde çubuğun üstünde durur. */
export function festivalGoalTitle(def: FestivalDef, target: number): string {
  if (def.kind === 'item' && def.itemId) return tr('{0} {1} sat', target, tr(itemName(def.itemId)));
  if (def.kind === 'clean') return tr("{0} temizlik işi yap", target);
  return tr("{0} sipariş tamamla", target);
}

/* ================================================================ *
 *  Etki muslukları — ANA OTURUM BAĞLAYACAK (bkz. dosya başı notu).
 *  Tarihten türedikleri için state'siz çalışır ve festival ödülü
 *  alınsa da hafta boyunca sürerler.
 * ================================================================ */

/** Ürün değeri çarpanı — World.chargeOrder'da satır başına uygulanır. */
export function festivalValueMult(item: ItemId, now = new Date()): number {
  const f = currentFestival(now);
  if (f.kind === 'guest') return FESTIVAL_GUEST_VALUE_MULT;
  return f.kind === 'item' && f.itemId === item ? FESTIVAL_ITEM_MULT : 1;
}

/** Temizlik ödülü çarpanı — World.cleanReward'a uygulanır. */
export function festivalCleanMult(now = new Date()): number {
  return currentFestival(now).kind === 'clean' ? FESTIVAL_CLEAN_MULT : 1;
}
