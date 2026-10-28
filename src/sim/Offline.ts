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
export function applyOfflineStock(elapsedSeconds: number, worlds: World[], stockMult = 1): void {
  if (elapsedSeconds < BALANCE.offline.minSeconds) return;
  // Stok birikimi 2 saatlik üretimle sınırlı: haftalarca kapalı kalmak
  // farklı bir şey kazandırmaz, sadece depolar dolu başlar.
  const effective = Math.min(elapsedSeconds, 7200) * BALANCE.offline.efficiency;
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

export function computeOfflineEarnings(elapsedSeconds: number, incomePerSec: number, hasStaff: boolean, capMult = 1): number {
  if (elapsedSeconds < BALANCE.offline.minSeconds || !hasStaff) return 0;
  // Maksimum 2 saatlik vardiya kazancı (%18 verimlilikle) - oyunu kırmaz, dönüş sevinci verir.
  const effective = Math.min(elapsedSeconds, 7200 * capMult) * 0.18;
  return Math.round(effective * Math.max(4, incomePerSec));
}

