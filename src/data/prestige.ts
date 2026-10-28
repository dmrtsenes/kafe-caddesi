import { tr, localeTag } from "../core/I18n";
/**
 * PRESTİJ — "Sokağı Devret"
 *
 * Oyunun geç oyun uçurumuna verilen cevap. Hedef zinciri bittiğinde,
 * bütün bölgeler açıldığında ve bütün personel alındığında elde yapacak
 * bir şey kalmıyordu; idle oyunların kaldırılma sebebi tam olarak budur.
 *
 * Devretmek kafeyi sıfırlar ama KALICI bir para birimi bırakır: Fincan
 * Puanı. Puanlar bir daha kaybolmayan çarpanlara yatırılır, böylece her
 * tur bir öncekinden hızlı geçer — asıl ilerleme buraya taşınır.
 *
 * "Asla cezalandırma" kuralı burada da geçerli: devretmek zorunlu değil,
 * bir tercih. Oyuncu istemezse mevcut kafesinde sonsuz hedeflerle
 * oynamaya devam eder.
 */

export type PrestigeUpgradeId = 'gain' | 'speed' | 'start' | 'offline' | 'charm';

export interface PrestigeUpgradeDef {
  id: PrestigeUpgradeId;
  name: string;
  glyph: string;
  desc: string;
  /** Seviye başına maliyet artışı. */
  baseCost: number;
  growth: number;
  maxLevel: number;
  /** Seviye başına etki (yüzde olarak gösterilir). */
  step: number;
  format: (level: number) => string;
}

export const PRESTIGE_UPGRADES: PrestigeUpgradeDef[] = [
  {
    id: 'gain',
    name: tr("Sokağın İtibarı"),
    glyph: '⭐',
    desc: tr("Bütün kazancın kalıcı olarak artar."),
    baseCost: 1,
    /**
     * v5.2 — İLK DEVİR GERÇEKTEN BİR SIÇRAMA OLMALI.
     *
     * Eski değerlerle (step 0,12 · growth 1,55) ilk devir +%12 veriyordu:
     * 21 bölge, 10 personel ve bütün yükseltmeler karşılığında. Kabul eden
     * oyuncu pişman oluyordu — oyunun "asla cezalandırma" ilkesindeki tek
     * gerçek delik buydu. Yeni eğriyle ilk devir (6 puan) gain L3 alır:
     * +%60 kalıcı kazanç.
     */
    growth: 1.45,
    maxLevel: 25,
    step: 0.2,
    format: (l) => tr("+%{0} kazanç", Math.round(l * 20)),
  },
  {
    id: 'speed',
    name: tr("Usta Eller"),
    glyph: '⚡',
    desc: tr("Bütün istasyonlar kalıcı olarak hızlanır."),
    baseCost: 1,
    growth: 1.6,
    maxLevel: 20,
    step: 0.04,
    format: (l) => tr("İstasyonlar %{0} hızlı", Math.round((1 - Math.pow(1 - 0.04, l)) * 100)),
  },
  {
    id: 'start',
    name: tr("Devir Sermayesi"),
    glyph: '💼',
    desc: tr("Yeni tura başlarken kasanda para olur."),
    baseCost: 2,
    growth: 1.7,
    maxLevel: 15,
    step: 1,
    format: (l) => tr("₺{0} başlangıç", (l * 2500).toLocaleString(localeTag())),
  },
  {
    id: 'offline',
    name: tr("Gece Vardiyası"),
    glyph: '🌙',
    /**
     * Metin ile etki AYNI şeyi söylemek zorunda. Eski metin "sen yokken
     * kazanılan para artar" diyordu ama offline para bilinçli olarak
     * kaldırılmıştı (Offline.ts) — çarpan hiçbir yerden çağrılmayan ölü
     * bir fonksiyona bağlıydı; oyuncu en kıymetli meta parasını sıfır
     * etkili bir yükseltmeye harcayabiliyordu. Etki artık gerçek: dönüşte
     * makine depoları normal tavanın üstüne, çarpan kadar taşar.
     */
    desc: tr("Makineler sen yokken depo tavanının üstüne üretir."),
    baseCost: 2,
    growth: 1.65,
    maxLevel: 12,
    step: 0.08,
    format: (l) => tr("+%{0} dönüş stoğu", Math.round(l * 8)),
  },
  {
    id: 'charm',
    name: tr("Sokağın Şöhreti"),
    glyph: '🎺',
    desc: tr("Müşteriler daha sık gelir."),
    baseCost: 3,
    growth: 1.7,
    maxLevel: 12,
    step: 0.06,
    format: (l) => tr("+%{0} müşteri akışı", Math.round(l * 6)),
  },
];

export const PRESTIGE_MAP: Record<string, PrestigeUpgradeDef> = Object.fromEntries(
  PRESTIGE_UPGRADES.map((u) => [u.id, u]),
);

export function prestigeUpgradeCost(def: PrestigeUpgradeDef, level: number): number {
  return Math.max(1, Math.round(def.baseCost * Math.pow(def.growth, level)));
}

/**
 * Devretmenin getireceği puan.
 *
 * Karekök ölçek: kazanç katlanarak büyüdüğü için doğrusal bir formül ilk
 * turda binlerce puan verirdi. Karekök, her turun bir öncekinden ANLAMLI
 * ama abartısız daha fazla puan getirmesini sağlar.
 */
export function prestigePointsFor(totalEarned: number): number {
  if (totalEarned < PRESTIGE_MIN_EARNED) return 0;
  return Math.floor(Math.sqrt(totalEarned / 150_000));
}

/**
 * Devretmenin açılması için gereken en az ömür kazancı.
 *
 * 1,5M → 12M (v5.2). Ölçüm: 1,5M eşiği 40. dakikada geliyordu ve o anda
 * teklif 4 puan/+%12 ediyordu — açıkça kabul edilmemesi gereken bir
 * teklif. 6M dengelenmiş Sahil sonu bandıdır ve 6 puan verir.
 */
export const PRESTIGE_MIN_EARNED = 6_000_000;
