import type { ItemId } from '../data/items';
import type { CustomerAngerReason } from '../data/customerFeedback';

/** Oyun genelinde yayınlanan olaylar. UI ve ses bunları dinler. */
export interface GameEvents {
  'render:structure': Record<string, never>;
  'side:changed': { structural?: boolean; immediate?: boolean };
  'money:earn': { amount: number; x: number; z: number; y?: number };
  'money:spend': { amount: number };
  'money:changed': { total: number };
  'item:picked': { item: ItemId; x: number; z: number };
  /** Vitrine (ya da hazırlık istasyonuna) kondu */
  'item:stocked': { item: ItemId; x: number; z: number };
  /** Masaya servis edildi — kafenin asıl "iş bitti" olayı */
  'item:served': { item: ItemId; x: number; z: number };
  /** Tuvalete peçete/kâğıt kondu */
  'table:cleaned': { id: string; x?: number; z?: number; byPlayer?: boolean };
  'item:refilled': { item: ItemId; x: number; z: number };
  'item:produced': { item: ItemId; stationId: string };
  /** Tezgâhta sipariş alındı */
  'order:placed': { id: number; lines: number; x: number; z: number };
  'sale:done': { item: ItemId; amount: number; x: number; z: number };
  'customer:happy': { x: number; z: number };
  'customer:angry': { x: number; z: number; reason: CustomerAngerReason };
  'customer:impatient': { x: number; z: number; text: string };
  /** Tuvalette peçete/kâğıt bitti — müşteri kızdı */
  'supply:empty': { x: number; z: number };
  'reputation:changed': { value: number };
  'goal:progress': { id: string; current: number; target: number };
  'goal:complete': { id: string; title: string; reward: number };
  'zone:unlocked': { location: string; zone: string; name: string; method?: 'pad' | 'menu' | 'unknown' };
  'location:unlocked': { location: string; name: string };
  'location:changed': { location: string };
  'upgrade:bought': { kind: 'player' | 'station' | 'staff'; id: string; level: number };
  /**
   * Görünüm seçimi değişti (bkz. data/cosmetics.ts). SADECE GÖRSELDİR —
   * simülasyon bu olayı dinlemez, yalnız Game görünümü tazeler.
   */
  'cosmetic:changed': { axis: string; id: string; bought: boolean };
  'staff:hired': { role: string; count: number; location?: string; totalCost?: number; method?: 'pad' | 'menu' };
  'event:start': { id: string; title: string; desc: string; duration: number; glyph: string };
  'event:end': { id: string };
  'dasher:spawn': Record<string, never>;
  'dasher:caught': { reward: number; x: number; z: number };
  'dasher:escaped': Record<string, never>;
  /** Fenomen zamanında servis edildi / küsüp gitti */
  'influencer:served': { x: number; z: number };
  'influencer:lost': { x: number; z: number };
  'investor:spawn': { x: number; z: number };
  'investor:interact': { investor: any; x: number; z: number };
  'station:repaired': { stationId: string };
  'tutorial:step': { index: number; skipped?: boolean; complete?: boolean };
  'celebrate:end': Record<string, never>;
  'toast': { text: string; glyph?: string; tone?: 'good' | 'bad' | 'info' };
  'ui:float': { x: number; y: number; text: string; tone?: 'money' | 'item' | 'bad' | 'good' };
  /** Rare in-play tip. Persisted immediately so a reload cannot pass the daily cap. */
  'found:change': { amount: number };
  'ui:refresh': Record<string, never>;
  /** Oyuncu tezgâhtan para topladı (öğretici bunu dinler). */
  'counter:collected': { amount: number };
  'sfx': { id: string; vol?: number; rate?: number };
  /** Dokunsal geri bildirim isteği — Native katmanı dinler. */
  'haptic': { kind: 'light' | 'medium' | 'heavy' | 'success' | 'warning' };
  'pad:ad_offer': { zoneId: string; tier: 'finish' | 'pay_half'; remaining: number };
  'ad:revenue': {
    value: number;
    currency: string;
    precision: number;
    adUnit: string;
    format: 'rewarded' | 'interstitial';
  };
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

export class EventBus {
  private map = new Map<string, Set<(p: unknown) => void>>();

  on<K extends keyof GameEvents>(key: K, fn: Handler<K>): () => void {
    let set = this.map.get(key as string);
    if (!set) {
      set = new Set();
      this.map.set(key as string, set);
    }
    set.add(fn as (p: unknown) => void);
    return () => set!.delete(fn as (p: unknown) => void);
  }

  off<K extends keyof GameEvents>(key: K, fn: Handler<K>): void {
    this.map.get(key as string)?.delete(fn as (p: unknown) => void);
  }

  emit<K extends keyof GameEvents>(key: K, payload: GameEvents[K]): void {
    const set = this.map.get(key as string);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[EventBus] "${String(key)}" dinleyicisi hata verdi:`, err);
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}

export const bus = new EventBus();

/** Kısayol: ses efekti tetikle. */
export function sfx(id: string, vol?: number, rate?: number): void {
  bus.emit('sfx', { id, vol, rate });
}

/**
 * Kısayol: titreşim iste.
 *
 * `sim/` katmanı Capacitor'ü doğrudan çağıramaz (web/native ayrımı
 * `core/Native.ts`'te toplanır); istek olay yoluyla geçer — `sfx` ile
 * birebir aynı kalıp.
 */
export function haptic(kind: GameEvents['haptic']['kind'] = 'light'): void {
  bus.emit('haptic', { kind });
}
