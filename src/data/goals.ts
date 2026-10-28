import { zoneReward, BRANCH_COSTS } from './economy';
import { tr, localeTag } from "../core/I18n";
import type { ItemId } from './items';
import type { PlayerUpgradeId } from './upgrades';
import type { StaffRole } from './staff';

export type GoalKind =
  | 'produce'
  | 'serve'
  | 'sell'
  | 'earn'
  | 'cash'
  | 'zone'
  | 'expand'
  | 'hire'
  | 'upgrade'
  | 'stationLevel'
  | 'catchDasher'
  | 'clean'
  | 'cleanTable'
  | 'mop'
  | 'refill'
  | 'location';

export interface GoalDef {
  id: string;
  kind: GoalKind;
  title: string;
  hint: string;
  target: number;
  item?: ItemId;
  zone?: string;
  role?: StaffRole;
  upgrade?: PlayerUpgradeId;
  location?: string;
  reward: number;
}

/**
 * Hedef zinciri, oyunun ritmini tutan metronomdur.
 *
 * İlk beş hedef TOPLAM bir dakikadan kısa sürer; oyuncu daha ısınmadan
 * dört kez "tamamlandı" sesi duyar. Sonrası kademeli uzar ama hiçbir adım
 * "git ve 10 dakika bekle" demez — her hedef bir sonraki MEKANİĞİ açar.
 */
export const GOALS: GoalDef[] = [
  { id: 'g01', kind: 'sell', title: tr("İlk siparişini al"), hint: tr("Kasanın arkasında dur — sıradaki müşteri siparişini versin."), target: 1, reward: 30 },
  { id: 'g02', kind: 'serve', title: tr("2 çay sat"), hint: tr("Masada bekleyen müşteriye çayı sen götür; paket sipariş için ÇAY RAFI’nı doldur."), target: 2, reward: 50 },
  { id: 'g03', kind: 'cleanTable', title: tr("İlk masanı tamamen temizle"), hint: tr("Bulaşığı kovaya bırakıp masayı sil. Ödül, masa tamamen hazır olunca gelir."), target: 1, reward: 70 },
  { id: 'g04', kind: 'expand', title: tr("İlk geliştirmeyi seç"), hint: tr("İkinci masa daha çok müşteri alır; Kahve yeni ürün açar. Turuncu pedlerden istediğini seç."), target: 1, reward: 120 },
  { id: 'g05', kind: 'serve', title: tr("10 ürün sat"), hint: tr("Masadakilere sen servis et; paket müşteriler için raflarda stok bırak."), target: 10, reward: 200 },
  { id: 'g06', kind: 'hire', title: tr("Bir tezgâhtar işe al"), hint: tr("Atandığı rafı düzenli doldursun; masaya servis yine sende."), target: 1, role: 'waiter', reward: 300 },
  { id: 'g07', kind: 'mop', title: tr("3 zemin lekesi sil"), hint: tr("Lekenin üstünde bekle. Silmek anında bozuk para verir."), target: 3, reward: 350 },
  { id: 'g08', kind: 'zone', title: tr("KAHVE bölümünü aç"), hint: tr("Kahve Barı ve Kahve Rafı — sütlü kahve menüye girsin."), target: 1, zone: 'a3', reward: zoneReward('a3') },
  { id: 'g09', kind: 'upgrade', title: tr("Servis Tepsisi’ni yükselt"), hint: tr("Tek seferde daha çok bardak taşı."), target: 1, upgrade: 'capacity', reward: 600 },

  { id: 'g10', kind: 'produce', title: tr("25 sütlü kahve hazırla"), hint: tr("Süt Barı kendi kendine üretir; sen boşaltmayı unutma, dolunca durur."), target: 25, item: 'latte', reward: 500 },
  { id: 'g11', kind: 'hire', title: tr("Bir kasiyer işe al"), hint: tr("Sipariş sırasını o akıtsın; biriken parayı kasadan yine sen topla."), target: 1, role: 'cashier', reward: 800 },
  { id: 'g12', kind: 'zone', title: tr("TOST bölümünü aç"), hint: tr("Tost makinesi ve tost rafı. Menü üçe çıkar."), target: 1, zone: 'a4', reward: zoneReward('a4') },
  { id: 'g13', kind: 'serve', title: tr("80 ürün sat"), hint: tr("İkinci tezgâhtar yükü yarıya böler."), target: 80, reward: 1600 },
  { id: 'g14', kind: 'clean', title: tr("40 bulaşık topla"), hint: tr("Masa devri kafenin gerçek kapasitesidir."), target: 40, reward: 2000 },
  { id: 'g15', kind: 'zone', title: tr("SALON HATTI’nı aç"), hint: tr("İkinci kasa ve salon kovası — sıra ikiye bölünür."), target: 1, zone: 'a5', reward: zoneReward('a5') },
  { id: 'g16', kind: 'stationLevel', title: tr("6 istasyon yükseltmesi al"), hint: tr("İstasyonlar panelinden hız ve depo yükselt."), target: 6, reward: 4500 },
  { id: 'g17', kind: 'hire', title: tr("Bir masa görevlisi işe al"), hint: tr("Masaların bulaşığını toplar ve yüzeyini siler; zemin ve tuvalet sende."), target: 1, role: 'busser', reward: 7000 },
  { id: 'g18', kind: 'earn', title: tr("₺20.000 kazan"), hint: tr("Tuvalet için kasa gerekiyor."), target: 20000, reward: 7500 },
  { id: 'g19', kind: 'zone', title: tr("Lavaboları aç"), hint: tr("Temiz lavabolar her tamamlanan kullanımda ek gelir sağlar."), target: 1, zone: 'a6', reward: zoneReward('a6') },
  { id: 'g20', kind: 'refill', title: tr("Tuvalete 10 kez sarf koy"), hint: tr("Peçete Kutusu’ndan al, tuvalete götür. Bu da para kazandırır."), target: 10, reward: 4000 },
  { id: 'g21', kind: 'catchDasher', title: tr("Bir kaçak müşteri yakala"), hint: tr("Hesabı ödemeden kaçanın üstüne koş."), target: 1, reward: 5000 },
  /**
   * Alan ödülleri ortak fiyat kaynağının %30'una bağlıdır. Üretim ve
   * geliştirme hedefleri ayrı işlere karşılık gelir. Şube biriktirme
   * hedefi ve satın alma ödülü de gerçek şube fiyatını izler.
   */
  { id: 'g22', kind: 'hire', title: tr("Bir kahve ustası işe al"), hint: tr("Başında durduğu makineyi hızlandırır."), target: 1, role: 'barista', reward: 7500 },
  { id: 'g23', kind: 'zone', title: tr("SALON ODASI’nı aç"), hint: tr("Kapının ardında yepyeni bir salon seni bekliyor. Kapının önündeki pede bas."), target: 1, zone: 'r1', reward: zoneReward('r1') },
  { id: 'g24', kind: 'zone', title: tr("VAFIL bölümünü aç"), hint: tr("Menünün tatlı yıldızı."), target: 1, zone: 'a7', reward: zoneReward('a7') },
  { id: 'g25', kind: 'produce', title: tr("20 vafıl hazırla"), hint: tr("Vafıl makinesi yavaş ama pahalı."), target: 20, item: 'waffle', reward: 9000 },
  { id: 'g26', kind: 'zone', title: tr("BUZLU KAHVE bölümünü aç"), hint: tr("Buzlu kahve — menünün en pahalı satırı."), target: 1, zone: 'a8', reward: zoneReward('a8') },
  { id: 'g27', kind: 'zone', title: tr("VIP SALON’u aç"), hint: tr("Mermer masalar, 2,4 kat hesap. Kafenin en özel odası."), target: 1, zone: 'r2', reward: zoneReward('r2') },
  { id: 'g28', kind: 'produce', title: tr("30 buzlu kahve hazırla"), hint: tr("Menünün en pahalı satırı."), target: 30, item: 'frappe', reward: 18000 },
  { id: 'g29', kind: 'stationLevel', title: tr("18 istasyon yükseltmesi al"), hint: tr("Hız ve depo birikir."), target: 18, reward: 30000 },
  // The revenue goal and branch reward follow the actual branch price.
  { id: 'g30', kind: 'earn', title: tr("Toplam ₺{0} ciroya ulaş", BRANCH_COSTS.sahil.toLocaleString(localeTag())), hint: tr("VIP salon ve buzlu kahve satışlarıyla Sahil şubesi sermayesini hazırla."), target: BRANCH_COSTS.sahil, reward: Math.round(BRANCH_COSTS.sahil * 0.15) },
  { id: 'g31', kind: 'location', title: tr("Sahil Şubesi’ni aç"), hint: tr("Şubeler panelinden ikinci kafeyi satın al."), target: 1, location: 'sahil', reward: Math.round(BRANCH_COSTS.sahil * 0.3) },
  { id: 'g32', kind: 'produce', title: tr("40 meyve karışımı hazırla"), hint: tr("Sahilde meyve her zaman satar."), target: 40, item: 'smoothie', reward: 60000 },
  // Seaside expansions retain the same 30% completion reward.
  { id: 'g33', kind: 'zone', title: tr("DONDURMA bölümünü aç"), hint: tr("Sahilin yıldızı."), target: 1, zone: 'p2', reward: zoneReward('p2') },
  { id: 'g34', kind: 'zone', title: tr("TERAS'ı aç"), hint: tr("Sütlü kokteyl barı ve iki büyük masa."), target: 1, zone: 'p3', reward: zoneReward('p3') },
  { id: 'g35', kind: 'zone', title: tr("SAHİL HATTI'nı aç"), hint: tr("Sahilde ikinci kasa — sipariş kuyruğu ikiye bölünür."), target: 1, zone: 'p4', reward: zoneReward('p4') },
  { id: 'g36', kind: 'zone', title: tr("İSKELE VIP LOCA'yı aç"), hint: tr("Sahilin en özel mermer masaları — 2,4 kat hesap ve bahşiş."), target: 1, zone: 'p5', reward: zoneReward('p5') },
  { id: 'g37', kind: 'serve', title: tr("2.000 ürün sat"), hint: tr("Artık iki kafe birden tam kapasite dönüyor."), target: 2000, reward: 280000 },
  { id: 'g38', kind: 'earn', title: tr("₺6.000.000 kazan"), hint: tr("Kafe Caddesi artık bir zincir — Sokağı Devret açılıyor!"), target: 6000000, reward: 500000 },
];

export const GOAL_MAP: Record<string, GoalDef> = Object.fromEntries(GOALS.map((g) => [g.id, g]));

/* ==================================================================== *
 *  SONSUZ HEDEFLER — zincir bittikten sonra
 *
 *  g36'dan sonra `current` null dönüyordu; HUD'daki hedef şeridi de
 *  sessizce KAYBOLUYORDU (HUD.tickGoal, `if (!g)` dalı). Yani oyunun
 *  "şimdi ne yapayım" göstergesi, oyuncunun her şeyi bitirdiği anda —
 *  tam da ona en çok ihtiyaç duyduğu anda — ortadan kalkıyordu.
 *
 *  Bu şablonlar sırayla dönüp her turda hedefi büyüterek zinciri sürdürür.
 *  Ödül SABİT DEĞİL, oyuncunun ömür boyu kazancına oranlıdır: hedef
 *  zincirinin sonundaki beş ödül tek başına ₺450 milyon ödüyordu ve son
 *  bölge ₺110 milyondu — yani zincir kendi kendini finanse ediyordu.
 * ==================================================================== */

export interface EndlessTemplate {
  kind: GoalKind;
  title: (n: number) => string;
  hint: string;
  /** Tur başına hedef adedi (tur 0 için taban). */
  base: number;
  /** Finite action budget: later rounds must not become unbounded chores. */
  cap: number;
}

export const ENDLESS_TEMPLATES: EndlessTemplate[] = [
  { kind: 'serve', title: (n) => tr("{0} ürün daha sat", n), hint: tr("Raflar hiç boş kalmasın."), base: 150, cap: 450 },
  { kind: 'clean', title: (n) => tr("{0} bulaşık daha topla", n), hint: tr("Temiz masa, dolu masa."), base: 35, cap: 90 },
  { kind: 'mop', title: (n) => tr('{0} leke daha temizle', n), hint: tr("Zemin pırıl pırıl kalsın."), base: 18, cap: 45 },
  { kind: 'refill', title: (n) => tr('{0} sarf malzemesi doldur', n), hint: tr("Peçete biterse müşteri küser."), base: 20, cap: 60 },
  { kind: 'catchDasher', title: (n) => tr("{0} kaçak müşteri yakala", n), hint: tr("Hesabı ödemeden kaçana göz açtırma."), base: 2, cap: 3 },
];

/** Her turda hedef bu oranda büyür. */
export const ENDLESS_GROWTH = 1.45;

/** Every round rotates jobs; the action budget stops growing at a finite ceiling. */
export function endlessTarget(template: EndlessTemplate, round: number): number {
  return Math.min(template.cap, Math.round(template.base * Math.pow(ENDLESS_GROWTH, Math.min(20, Math.max(0, round)))));
}
