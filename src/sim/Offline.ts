import { BALANCE } from '../data/balance';
import type { World } from './World';

/**
 * İKİ KATMANLI DÖNÜŞ SİSTEMİ (STOK + PERSONEL GECE VARDİYASI).
 *
 * 1) Her oyuncuda açık makineler beklerken üretimlerini biriktirir (depoları
 *    dolana kadar, en fazla 2 saat × %18 verim). Dönen oyuncuyu boş bir kafe
 *    değil, servis edilmeye hazır raflar karşılar.
 * 2) Garson veya kasiyer işe alınmışsa (`computeOfflineEarnings`), personel
 *    yokluğunda da vardiyayı sürdürür ve 2 saat tavanlı (%18 verimle) nakit
 *    kazanç bırakır. Dönüş penceresinde (`UIRoot.showOffline`) reklam izlenirse
 *    hem hazır stok anında satılır hem de gece vardiyası kazancı ×2/×3 katlanır.
 */
/**
 * @param stockMult Dönüş stoğu tavan çarpanı (≥1). "Gece Vardiyası" prestij
 *   yükseltmesi buradan bağlanır: makine depoları dönüşte normal tavanın
 *   üstüne, çarpan kadar taşabilir. (Süreyi çarpmak işe yaramazdı: depolar
 *   saniyeler mertebesindeki üretimle zaten doluyor, bağlayıcı olan TAVAN.)
 *   Taşan stok kayıtta `min(o, cap)` ile kırpılır — bu bilinçli: fazlalık
 *   yalnızca dönüş jesti, kalıcı depo büyütmesi değil.
 */
export const COMEBACK_GIFT_MIN_SECONDS = 48 * 3600;

export interface OfflineOfferBreakdown {
  baseCash: number;
  multiplier: number;
  rewardedCash: number;
  stockSaleBonus: number;
  rewardedTotalCash: number;
  /** Loss-aversion framing: extra cash left on the table if skipping 3x/2x RV. */
  forfeitedBonusCash: number;
  isLongOffline: boolean;
}

export interface ComebackGift {
  eligible: boolean;
  cashGift: number;
  happyHourSeconds: number;
}

export function applyOfflineStock(elapsedSeconds: number, worlds: World[], stockMult = 1): void {
  if (elapsedSeconds < BALANCE.offline.minSeconds) return;
  const vaultCapSeconds = Math.max(7200, worlds[0]?.state?.offlineCapSeconds ?? 14400);
  const effective = Math.min(elapsedSeconds, vaultCapSeconds) * BALANCE.offline.efficiency;
  const capMult = Math.max(1, stockMult);

  for (const w of worlds) {
    for (const st of w.machines) {
      if (st.locked) continue;
      const produced = Math.floor(st.theoreticalRate() * effective);
      if (produced <= 0) continue;
      st.output = Math.min(Math.round(st.outputCap * capMult), st.output + produced);
    }
  }
}

export function computeOfflineEarnings(
  elapsedSeconds: number,
  incomePerSec: number,
  hasStaff: boolean,
  capMult = 1,
  vaultCapSeconds = 14400,
  automationFactor = 1,
): number {
  if (elapsedSeconds < BALANCE.offline.minSeconds || !hasStaff) return 0;
  const shiftCap = Math.max(7200, vaultCapSeconds) * Math.max(1, capMult);
  const cappedElapsed = Math.min(elapsedSeconds, shiftCap);
  const tier1 = Math.min(cappedElapsed, 7200);
  const tier2 = Math.min(Math.max(0, cappedElapsed - 7200), 21600);
  const tier3 = Math.max(0, cappedElapsed - 28800);
  const autoScale = Math.min(1, Math.max(0.35, automationFactor));
  const maxActiveSeconds = BALANCE.offline.maxActiveHours * 3600 * Math.max(1, capMult);
  const effective = Math.min(
    maxActiveSeconds,
    (tier1 * 0.055 + tier2 * 0.025 + tier3 * 0.014) * autoScale,
  );
  return Math.round(effective * Math.max(2, incomePerSec));
}

export function computeOfflineOfferBreakdown(
  elapsedSeconds: number,
  baseCash: number,
  readyStockValue = 0,
): OfflineOfferBreakdown {
  const safeBase = Math.max(0, Math.round(baseCash));
  const safeStock = Math.max(0, Math.round(readyStockValue));
  const isLongOffline = elapsedSeconds >= BALANCE.offline.longOfflineThresholdSeconds;
  const multiplier = isLongOffline
    ? BALANCE.offline.rewardedLongOfflineMultiplier
    : BALANCE.offline.rewardedMultiplier;
  const rewardedCash = safeBase * multiplier;
  const stockSaleBonus = safeStock * multiplier;
  const rewardedTotalCash = rewardedCash + stockSaleBonus;
  const forfeitedBonusCash = Math.max(0, rewardedTotalCash - safeBase);
  return {
    baseCash: safeBase,
    multiplier,
    rewardedCash,
    stockSaleBonus,
    rewardedTotalCash,
    forfeitedBonusCash,
    isLongOffline,
  };
}

export function computeComebackGift(elapsedSeconds: number, incomePerSec: number): ComebackGift {
  if (elapsedSeconds < COMEBACK_GIFT_MIN_SECONDS) {
    return { eligible: false, cashGift: 0, happyHourSeconds: 0 };
  }
  const safeIncome = Math.max(8, incomePerSec);
  const cashGift = Math.max(2500, Math.round(safeIncome * 600));
  return { eligible: true, cashGift, happyHourSeconds: 300 };
}

