import { endlessTarget, ENDLESS_TEMPLATES, GOALS, type GoalDef } from '../data/goals';
import { bus } from '../core/EventBus';
import type { GameState } from './GameState';

/**
 * Hedef zinciri. Sayaç tabanlı hedefler olay yoluyla birikir,
 * durum tabanlı olanlar her karede okunur.
 */
export class GoalTracker {
  private state: GameState;
  private unsubs: (() => void)[] = [];
  private lastEmitted = -1;

  constructor(state: GameState) {
    this.state = state;

    this.unsubs.push(
      bus.on('item:produced', ({ item }) => {
        const g = this.current;
        if (g?.kind === 'produce' && g.item === item) this.bump(1);
      }),
      bus.on('sale:done', () => {
        const g = this.current;
        if (g?.kind === 'sell') this.bump(1);
      }),
      bus.on('order:placed', () => {
        // "İlk siparişini al" hedefi tezgâhta tamamlanır, servis beklenmez.
        const g = this.current;
        if (g?.kind === 'sell' && g.target <= 1) this.bump(1);
      }),
    );
  }

  /**
   * Sıradaki hedef. Zincir bittiğinde ARTIK NULL DÖNMEZ: sonsuz hedef
   * üreteci devreye girer, böylece HUD'daki "şimdi ne yapayım" göstergesi
   * hiçbir zaman kaybolmaz.
   */
  get current(): GoalDef | null {
    if (this.state.goalIndex < GOALS.length) return GOALS[this.state.goalIndex];
    return this.endlessGoal(this.state.goalIndex - GOALS.length);
  }

  /** `current` is read several times per frame; one object per endless index. */
  private endless: GoalDef | null = null;
  private endlessIndex = -1;

  /** Zincir bittiyse üretilen hedef (i = 0'dan başlar). */
  private endlessGoal(i: number): GoalDef {
    /**
     * Ödül ömür boyu kazancın %1,5'i. Sabit bir sayı olamaz: oyuncu bu
     * noktada saatte yüz milyonlar kazanıyor olabilir, sabit ödül anlamsız
     * kalır; ama kazancın büyük bir payı olursa hedefler ekonomiyi ele
     * geçirir (zincirin son beş ödülü tam da bunu yapıyordu).
     */
    const reward = Math.max(500, Math.round(this.state.revenueEarned * 0.015));
    if (this.endless && this.endlessIndex === i) {
      this.endless.reward = reward;
      return this.endless;
    }
    const t = ENDLESS_TEMPLATES[i % ENDLESS_TEMPLATES.length];
    const round = Math.floor(i / ENDLESS_TEMPLATES.length);
    const target = endlessTarget(t, round);
    this.endlessIndex = i;
    this.endless = {
      id: `ge${i}`,
      kind: t.kind,
      title: t.title(target),
      hint: t.hint,
      target,
      reward,
    };
    return this.endless;
  }

  /** Şu anki hedef üretilmiş (sonsuz) bir hedef mi? */
  private get isEndless(): boolean {
    return this.state.goalIndex >= GOALS.length;
  }

  get index(): number {
    return this.state.goalIndex;
  }

  get total(): number {
    return GOALS.length;
  }

  private bump(n: number): void {
    this.state.goalProgress += n;
  }

  /** Durum tabanlı hedeflerin anlık değeri. */
  currentValue(): number {
    const g = this.current;
    if (!g) return 0;
    /**
     * Sonsuz hedefler KÜMÜLATİF sayaçlar üzerine kurulur (toplam servis,
     * toplam bulaşık…). Taban çıkarılmazsa "400 ürün servis et" hedefi,
     * oyuncu zaten 50.000 servis yapmış olduğu için doğar doğmaz tamamlanır
     * ve zincir saniyede bir ödül basar.
     */
    if (this.isEndless) return Math.max(0, this.rawValue(g) - this.state.goalBase);
    return this.rawValue(g);
  }

  /**
   * Kümülatif sayaçlar `statSinceReset` üzerinden okunur: istatistikler
   * ömür boyudur ama hedef zinciri prestijde başa sarar. Ham sayaç okunsa
   * devirden sonra serve/clean/mop/refill/dasher/stationLevel hedefleri
   * sıra kendilerine gelir gelmez otomatik tamamlanır ve devir turu
   * bedava ödül zincirine dönerdi (tek başına g29 = 1,1M).
   */
  private rawValue(g: GoalDef): number {
    switch (g.kind) {
      case 'earn':
        return this.state.revenueEarned;
      case 'cash':
        return this.state.money;
      case 'zone':
        return g.zone && this.state.isZoneUnlocked(zoneLocation(g.zone), g.zone) ? 1 : 0;
      case 'expand':
        return this.state.isZoneUnlocked('kose', 't1') || this.state.isZoneUnlocked('kose', 'a3') ? 1 : 0;
      case 'hire':
        return g.role ? this.state.staffCount[g.role] : 0;
      case 'upgrade':
        return g.upgrade ? this.state.upgrades[g.upgrade] : 0;
      case 'stationLevel':
        return this.state.statSinceReset('stationUpgrades');
      case 'catchDasher':
        return this.state.statSinceReset('dashers');
      case 'cleanTable':
        return this.state.statSinceReset('tablesCleaned');
      case 'clean':
        return this.state.statSinceReset('cleaned');
      case 'mop':
        return this.state.statSinceReset('mopped');
      case 'refill':
        return this.state.statSinceReset('refills');
      case 'serve':
        return this.state.statSinceReset('served');
      case 'location':
        return g.location && this.state.isLocationUnlocked(g.location) ? 1 : 0;
      default:
        return this.state.goalProgress;
    }
  }

  update(): void {
    const g = this.current;
    if (!g) return;
    const value = this.currentValue();

    if (value !== this.lastEmitted) {
      this.lastEmitted = value;
      bus.emit('goal:progress', { id: g.id, current: Math.min(value, g.target), target: g.target });
    }

    if (value >= g.target) {
      this.state.goalIndex++;
      this.state.goalProgress = 0;
      this.lastEmitted = -1;
      this.state.grant(g.reward);
      bus.emit('goal:complete', { id: g.id, title: g.title, reward: g.reward });
      // Sıradaki hedef sonsuz zincirdeyse kümülatif sayacın tabanını al.
      const next = this.current;
      if (next && this.isEndless) this.state.goalBase = this.rawValue(next);
    }
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
  }
}

/**
 * Bölge kimliğinden lokasyonu türet. Sahil şubesinin bölgeleri bilerek "p"
 * ile başlar (p1/p2/p3); köşe şubesinde b/s/w ön ekleri kullanılır.
 */
export function zoneLocation(zoneId: string): string {
  return zoneId.startsWith('p') ? 'sahil' : 'kose';
}

/**
 * Rough seconds of work left on the current goal.
 * Used only to decide when a nearer payout should take the action line.
 */
export function goalWorkSeconds(goal: GoalDef, current: number, incomePerSec = 0): number {
  const left = Math.max(0, goal.target - current);
  if (left <= 0) return 0;
  switch (goal.kind) {
    case 'sell':
    case 'serve':
      return left * 10;
    case 'produce':
      return left * 4;
    case 'clean':
    case 'cleanTable':
      return left * 8;
    case 'mop':
      return left * 4;
    case 'refill':
      return left * 6;
    case 'earn':
    case 'cash':
      return incomePerSec > 0.05 ? left / incomePerSec : 90;
    default:
      return 40;
  }
}
