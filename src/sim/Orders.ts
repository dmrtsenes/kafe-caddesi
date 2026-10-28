import { ITEMS, dwellMult, type ItemId } from '../data/items';

/** Siparişin tek bir satırı: "2 latte". */
export interface OrderLine {
  item: ItemId;
  qty: number;
  /** Kaç tanesi müşteriye ulaştı */
  served: number;
}

let SEQ = 1;

/**
 * SİPARİŞ — kafenin çekirdek nesnesi.
 *
 * Tezgâhta fiyatlanır; her teslim edilen ürünün ücreti kasaya eklenir. Aradaki
 * her saniye oyuncunun koşturması gereken süredir: `age` bekleme süresini,
 * `waitRatio` ise müşterinin ne kadar sabırsızlandığını verir.
 */
export class Order {
  readonly id: number;
  readonly lines: OrderLine[];
  /** Çarpansız hesap tutarı (₺) — bahşiş ve itibar çarpanları sonra uygulanır. */
  readonly value: number;
  /** Sipariş verildiğinden beri geçen süre (sn) */
  age = 0;
  /** Servis tamamlandığı andaki yaş; −1 → henüz tamamlanmadı */
  completedAt = -1;

  constructor(lines: OrderLine[]) {
    this.id = SEQ++;
    this.lines = lines;
    let v = 0;
    for (const l of lines) v += ITEMS[l.item].price * l.qty;
    this.value = v;
  }

  get totalQty(): number {
    let n = 0;
    for (const l of this.lines) n += l.qty;
    return n;
  }

  get servedQty(): number {
    let n = 0;
    for (const l of this.lines) n += l.served;
    return n;
  }

  get complete(): boolean {
    for (const l of this.lines) if (l.served < l.qty) return false;
    return true;
  }

  /** Bu üründen daha var mı beklenen? */
  needs(item: ItemId): boolean {
    for (const l of this.lines) if (l.item === item && l.served < l.qty) return true;
    return false;
  }

  /** Bir birim teslim et. Kabul edildiyse true. */
  receive(item: ItemId): boolean {
    for (const l of this.lines) {
      if (l.item === item && l.served < l.qty) {
        l.served++;
        if (this.complete) this.completedAt = this.age;
        return true;
      }
    }
    return false;
  }

  /** Hâlâ beklenen ilk ürün — balon ikonu ve garson hedefi bunu kullanır. */
  nextWanted(): ItemId | null {
    for (const l of this.lines) if (l.served < l.qty) return l.item;
    return null;
  }

  /** Bu üründen kaç adet daha bekleniyor — balondaki ×N rozeti için. */
  remainingOf(item: ItemId): number {
    let n = 0;
    for (const l of this.lines) if (l.item === item) n += l.qty - l.served;
    return n;
  }

  /** Bekleyen tüm ürünler (garson tepsisini doldururken kullanılır). */
  pending(out: ItemId[]): ItemId[] {
    out.length = 0;
    for (const l of this.lines) {
      for (let i = l.served; i < l.qty; i++) out.push(l.item);
    }
    return out;
  }

  /**
   * Masada geçirilecek süre çarpanı: siparişteki ürünlerin `dwell`
   * değerlerinin adet ağırlıklı ortalaması. Çay içen çabuk kalkar,
   * cheesecake yiyen oyalanır — masa devir hızını bu belirler.
   */
  get dwell(): number {
    let sum = 0;
    let n = 0;
    for (const l of this.lines) {
      sum += dwellMult(l.item) * l.qty;
      n += l.qty;
    }
    return n > 0 ? sum / n : 1;
  }

  /** "2× Latte · 1× Kruvasan" */
  summary(): string {
    return this.lines.map((l) => `${l.qty}× ${ITEMS[l.item].name}`).join(' · ');
  }
}

/** Kayıt için sadeleştirilmiş sipariş (masada oturan müşteri kaydedilmez;
 *  yalnız istatistik amaçlı kullanılır). */
export interface OrderSnapshot {
  lines: { item: ItemId; qty: number; served: number }[];
  value: number;
  age: number;
}

export function snapshotOrder(o: Order): OrderSnapshot {
  return {
    lines: o.lines.map((l) => ({ item: l.item, qty: l.qty, served: l.served })),
    value: o.value,
    age: o.age,
  };
}
