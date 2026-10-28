import { tr } from "../core/I18n";
/* ==================================================================== *
 *  KOZMETİK — DEKORASYON / KİŞİSELLEŞTİRME
 *
 *  Dört eksen: duvar boyası · salon zemini · masa tablası · üniforma.
 *
 *  ÜÇ KURAL, ÜÇÜ DE TASARIM KARARI:
 *
 *  1) KOZMETİK OYUNU ETKİLEMEZ. Hiçbir seçeneğin hıza, gelire, sabra,
 *     hijyene, kapasiteye dokunan tek bir alanı yoktur — bu dosyada sayısal
 *     olarak yalnızca RENK ve FİYAT vardır. Sebebi "asla cezalandırma"
 *     ilkesi: bir görünüme istatistik bağlamak oyuncuyu beğendiğini değil
 *     güçlü olanı seçmeye zorlar ve kişiselleştirmeyi ilk günde öldürür.
 *
 *  2) SET KÜRATÖRLÜ, "her renk serbest" DEĞİL. Mekânın sıcak kimliği ve
 *     PORTRE OKUNAKLILIĞI seçenek listesinin sınırıdır:
 *       · duvarlar L* 85-95 bandında kalır (ölçüldü, aşağıda yazılı).
 *         Karakterler koyu siluetlidir; duvar bu bandın altına inerse
 *         375×812'de silüet fona gömülür.
 *       · zeminler L* 48-91 bandında kalır (en koyu: ceviz 55/48, en açık:
 *         damalı 91/68). Dikey kadrajda piksellerin ~yarısı zemindir;
 *         L* 45 altı bir zemin lacivert pantolonlu karakteri yutar,
 *         L* 92 üstü duvarla birleşip mekânı düzler.
 *       · vurgu rengi DOZU düşük tutulur. Bu projede ölçülmüş bir hata
 *         var: bölge vurgusu %34-45 karıştırılınca oda "leylak kutu"ya
 *         dönmüştü, doz %13-20'ye indirilmişti. Buradaki renkler doygun
 *         değil KIRIK tonlardır (S ≤ 0,52), aynı dersin devamı.
 *
 *  3) HER ŞEY KODLA ÜRETİLİR. Tek bir ikili varlık yok: bu dosya yalnızca
 *     mevcut canvas üreticilerinin (Environment.plankTexture /
 *     tileTexture, StationView.woodRingTexture / terrazzoTexture)
 *     PARAMETRELERİNİ taşır. Yeni doku üreticisi yazılmadı.
 *
 *  ÇİZİM ÇAĞRISI: dördü de yalnız doku/renk değiştirir, tek bir mesh
 *  eklemez → çizim çağrısı bütçesi (geç oyun ~570-1100) değişmez.
 *  Ölçüldü: dört eksenin 16 kombinasyonunda da 703 çizim çağrısı, 3489
 *  mesh — fark 0,0%.
 *
 *  --------------------------------------------------------------------
 *  FİYATLAR EKRAN PAYINDAN TÜRETİLDİ — "büyük duruyor" tahmininden değil.
 *
 *  375×812 portre kadrajda, seçenek değiştirildiğinde DEĞİŞEN PİKSEL
 *  ORANI ölçüldü (geç oyun, 18 bölge açık, 4 konum):
 *
 *      konum          zemin    duvar   masa   üniforma
 *      mutfak         20,1 %    2,1 %   0,0 %   1,5 %
 *      bar            26,2 %    1,9 %   1,5 %   1,8 %
 *      salon          31,6 %    0,0 %   1,8 %   1,2 %
 *      salon odası    36,4 %    8,5 %   3,2 %   0,0 %
 *      ORTALAMA       28,6 %    3,1 %   1,6 %   1,1 %
 *
 *  Sonuç şaşırtıcı ve fiyatları BAŞTAN YAZDIRDI: bu mekânda kamera
 *  aşağı bakar (pitch 48°, portrede yatayda ~12,5 birim görünür), yani
 *  duvarlar çoğu kadrajda HİÇ ekranda değil — salon ortasında %0. Duvar
 *  boyası bu yüzden panelin EN UCUZ ekseni; zemin ise en pahalısı.
 *  Ölçmeden yazılsaydı tam tersi olurdu ve oyuncu ₺200.000'i göremediği
 *  bir duvara vermiş olurdu.
 *
 *  Masa ve üniforma piksel payı küçük ama fiyatları saf orandan biraz
 *  YUKARIDA: ikisi de oyuncunun sürekli BAKTIĞI şey (servis döngüsü
 *  masada geçer, personel ekranda hep hareket hâlinde), yani dikkat payı
 *  piksel payından büyük.
 * ==================================================================== */

export type CosmeticAxis = 'wall' | 'floor' | 'table' | 'uniform';

export const COSMETIC_AXES: readonly CosmeticAxis[] = ['wall', 'floor', 'table', 'uniform'];

export interface CosmeticAxisDef {
  id: CosmeticAxis;
  name: string;
  glyph: string;
  /** Panelde eksenin altındaki tek satırlık açıklama. */
  desc: string;
}

export const COSMETIC_AXIS_DEFS: readonly CosmeticAxisDef[] = [
  { id: 'wall', name: tr("Duvar"), glyph: '🎨', desc: tr("Salonun sıvası. Ahşap süpürgelik ve bordür mekânın kendi rengini korur.") },
  { id: 'floor', name: tr("Zemin"), glyph: '🪵', desc: tr("Salon döşemesi. Mutfak karosu ve odaların kendi zemini değişmez.") },
  { id: 'table', name: tr("Masa Tablası"), glyph: '🪑', desc: tr("Yuvarlak masalar ahşap, kare masalar taş kalır — malzeme karşıtlığı korunur.") },
  { id: 'uniform', name: tr("Üniforma"), glyph: '👕', desc: tr("Personelin imza parçası. Siluet (önlük / yelek / ceket / bandana) hep aynı, yalnız renk değişir.") },
];

/** Bütün eksenlerin ortak alanları. */
interface CosmeticBase {
  id: string;
  name: string;
  desc: string;
  /** ₺ — 0 ise baştan açıktır. */
  cost: number;
  /** Panelde gösterilen renk çipi (1-3 renk, soldan sağa). */
  swatch: readonly number[];
}

/* ------------------------------------------------------------ duvar */

export interface WallSkin extends CosmeticBase {
  /**
   * Duvar sıvasının rengi. Lambri ve bordür bundan TÜRETİLİR.
   *
   * `null` = MEKÂNIN KENDİ TONU. Varsayılan seçenek sabit bir hex olamaz:
   * her şubenin kendi paleti var (Köşe #f5efe2, Sahil #fdf8ef) ve sabit
   * bir renk "varsayılan"ı seçen oyuncuya Sahil'de yanlış duvar verirdi.
   */
  color: number | null;
}

/**
 * Ölçülen L* değerleri satır sonlarında. Hepsi 85-95 arasında: duvar
 * aydınlık fon olarak kalır, karakter silueti üstüne oturur.
 *
 * FİYAT BANDI EN UCUZ OLAN — ölçüm bunu söylüyor (ekran payı ort. %3,1;
 * salon ortasında %0). Sıva mekânın kimliğini taşır ama portre kamerada
 * çoğu zaman kadraj dışındadır; oyuncu göremediği bir şeye para vermemeli.
 * Duvar oynadığı yerler: mutfak/bar hattı ve odaların içi.
 */
export const WALL_SKINS: readonly WallSkin[] = [
  { id: 'krem', name: tr("Krem Sıva"), desc: tr("Şubenin kendi sıvası."), cost: 0, color: null, swatch: [0xf5efe2] }, // Köşe: L* 94,6
  { id: 'adacayi', name: tr("Adaçayı"), desc: tr("Soluk yeşil sıva; ahşapla akraba durur."), cost: 0, color: 0xe6ecdd, swatch: [0xe6ecdd] }, // L* 92,6
  { id: 'gulkurusu', name: tr("Gül Kurusu"), desc: tr("Tozlu pembe — sabah ışığında sıcaklar."), cost: 2500, color: 0xf3e2d9, swatch: [0xf3e2d9] }, // L* 91,0
  { id: 'deniz', name: tr("Deniz Tuzu"), desc: tr("Serin gri-mavi; sıcak zeminle karşıtlık kurar."), cost: 9000, color: 0xdfeaef, swatch: [0xdfeaef] }, // L* 92,0
  { id: 'bal', name: tr("Bal Küpü"), desc: tr("Koyu krem sarısı; akşam ışığını tutar."), cost: 24000, color: 0xf4e6c6, swatch: [0xf4e6c6] }, // L* 91,6
  { id: 'kil', name: tr("Kil Sıva"), desc: tr("Elde sıvanmış toprak tonu. En koyu duvar."), cost: 60000, color: 0xdfd3c3, swatch: [0xdfd3c3] }, // L* 85,1
];

/* ------------------------------------------------------------ zemin */

export interface FloorSkin extends CosmeticBase {
  /**
   * `native` → şubenin kendi parkesi (palet renkleriyle, bugünkü hâl),
   * `plank`  → balık sırtı parke, `tile` → kare karo.
   * Üçü de MEVCUT üreticiler: Environment.plankTexture / tileTexture.
   */
  kind: 'native' | 'plank' | 'tile';
  base: number;
  alt: number;
  seam: number;
  /** Dokunun dünya birimi cinsinden tekrar aralığı. */
  repeat: number;
}

/**
 * Zemin, dikey kadrajın en büyük yüzeyi. Bu yüzden burada seçenek sayısı
 * değil DEĞER ARALIĞI kontrol edilir (ölçülen L*, taban/ikincil):
 *   ceviz 55/48 · meşe 77/72 · zeytin 90/65 · damalı 91/68 · kavak 85/79.
 * Ana salonun bugünkü değeri 77/72; yani en koyu seçenek 22 L* aşağı,
 * en açık 14 L* yukarı gider — mekân değişir, siluet kaybolmaz.
 *
 * PANELİN EN PAHALI EKSENİ. Ölçülen ekran payı ortalama %28,6 (salon
 * odasında %36,4) — yani dört eksenin toplamının on katından fazlası.
 * Oyuncu burada gerçekten "mekânı değiştirdim" diyor; fiyat da onu
 * yansıtır. Sıralama artan fiyat: dükkân listesi böyle okunur.
 */
export const FLOOR_SKINS: readonly FloorSkin[] = [
  {
    id: 'mese', name: tr("Şube Zemini"), desc: tr("Şubenin özgün taş ve ahşap döşemesi."), cost: 0,
    kind: 'native', base: 0xd8bb92, alt: 0xc9ab80, seam: 0x6f5a42, repeat: 2.4, // Köşe: L* 77,4 / 71,6
    swatch: [0xe2dccd, 0x285d50],
  },
  {
    id: 'kavak', name: tr("Ağartılmış Kavak"), desc: tr("Açık, İskandinav ahşabı. Mekân genişler."), cost: 12000,
    kind: 'plank', base: 0xe2d3b8, alt: 0xd3c2a4, seam: 0x8a7860, repeat: 2.4, // L* 85,1 / 79,1
    swatch: [0xe2d3b8, 0xd3c2a4],
  },
  {
    id: 'ceviz', name: tr("Ceviz Balıksırtı"), desc: tr("Koyu ahşap; mobilya ve karakterler öne çıkar."), cost: 45000,
    kind: 'plank', base: 0xa87a4c, alt: 0x96693e, seam: 0x4a3320, repeat: 2.4, // L* 54,8 / 48,2
    swatch: [0xa87a4c, 0x96693e],
  },
  {
    id: 'zeytin', name: tr("Zeytin Karosu"), desc: tr("Krem üstüne mat zeytin yeşili karo."), cost: 140000,
    kind: 'tile', base: 0xe9e3cf, alt: 0x8fa382, seam: 0x9a9382, repeat: 2.8, // L* 90,2 / 64,7
    swatch: [0xe9e3cf, 0x8fa382],
  },
  {
    id: 'damali', name: tr("Damalı Karo"), desc: tr("Klasik kahvehane şahmatı — krem ve kiremit."), cost: 380000,
    kind: 'tile', base: 0xefe4cf, alt: 0xcf9a72, seam: 0xa08f78, repeat: 2.8, // L* 90,9 / 67,7
    swatch: [0xefe4cf, 0xcf9a72],
  },
];

/* ------------------------------------------------------------ masa */

export interface TableSkin extends CosmeticBase {
  /** true → şubenin bugünkü takımı (taş tonu paletten türer). */
  native?: boolean;
  /** Yuvarlak tablalar: yıllık halkalı ahşap (woodRingTexture). */
  wood: { base: number; ring: number };
  /** Kare tablalar: terrazzo taş (terrazzoTexture). */
  stone: { base: number; chips: readonly number[] };
}

/**
 * MALZEME KARŞITLIĞI HER SEÇENEKTE KORUNUR.
 *
 * "Kare masalar taş, yuvarlaklar ahşap" kuralı mobilyanın pahalı
 * okunmasının ve masa tiplerinin tek bakışta ayrılmasının sebebi. Bu
 * yüzden hiçbir seçenek "her masa mermer" demez; her seçenek İKİ malzeme
 * birden tanımlar. VIP masalar kozmetiğe DAHİL DEĞİL: ₺230.000'lik mermer
 * onların satın alma vaadi, kozmetikle sulandırılmaz.
 */
export const TABLE_SKINS: readonly TableSkin[] = [
  {
    id: 'bal', name: tr("Bal Meşe"), desc: tr("Ahşap tabla + traverten. Şubenin ilk takımı."), cost: 0,
    native: true,
    wood: { base: 0xcb8f56, ring: 0x4a2c14 },
    stone: { base: 0xd9cfbb, chips: [0x2b4438, 0xa4623a, 0x4b3a2a, 0xfaf3e6] },
    swatch: [0xcb8f56, 0xd9cfbb],
  },
  {
    id: 'ceviz', name: tr("Koyu Ceviz"), desc: tr("Koyu ahşap + antrasit terrazzo. Sakin, ağır bir takım."), cost: 0,
    wood: { base: 0x8a5c34, ring: 0x33200f },
    stone: { base: 0x6f6a63, chips: [0x2c2a27, 0xb8ac96, 0x8a6a4a, 0xe8e2d4] },
    swatch: [0x8a5c34, 0x6f6a63],
  },
  {
    id: 'kiraz', name: tr("Kiraz Ağacı"), desc: tr("Kızıl ahşap + kiremit çipli taş."), cost: 8000,
    wood: { base: 0xb26a44, ring: 0x5a2416 },
    stone: { base: 0xe3d2c2, chips: [0xa8492c, 0x6d4230, 0x3c3630, 0xfbf2e6] },
    swatch: [0xb26a44, 0xe3d2c2],
  },
  {
    id: 'kum', name: tr("Kum Diş Budak"), desc: tr("Soluk sarı ahşap + fildişi terrazzo. En aydınlık takım."), cost: 26000,
    wood: { base: 0xdcc292, ring: 0x8a6b3f },
    stone: { base: 0xece4d2, chips: [0x8fa382, 0xc7b48c, 0x6b6255, 0xffffff] },
    swatch: [0xdcc292, 0xece4d2],
  },
  {
    id: 'gece', name: tr("Gece & Pirinç"), desc: tr("Koyu abanoz + pirinç çipli taş. Salonun en gösterişli takımı."), cost: 70000,
    wood: { base: 0x5b4632, ring: 0x2a1d12 },
    stone: { base: 0x4a4a52, chips: [0xd4a017, 0x2b2b31, 0x8d8a86, 0xe8dcc0] },
    swatch: [0x5b4632, 0x4a4a52],
  },
];

/* --------------------------------------------------------- üniforma */

export interface UniformSkin extends CosmeticBase {
  /**
   * Ekibin ev rengi. `null` → herkes kendi klasik rengini korur
   * (garson yeşil önlük, kasiyer nane yelek, komi mavi ceket,
   * barista bordo bandana).
   *
   * Renk verildiğinde her rol AYNI tondan ama FARKLI değerde bir parça
   * alır: silüeti ayıran şey zaten biçimdir (uzun önlük / yelek+vizör /
   * ceket+eldiven / aşçı ceketi+bandana), renk yalnız takımı birleştirir.
   */
  house: number | null;
  /** İkinci renk: bant, düğme, biye. */
  trim: number;
}

export const UNIFORM_SKINS: readonly UniformSkin[] = [
  { id: 'sokak', name: tr("Sokak Klasiği"), desc: tr("Herkes kendi renginde: yeşil önlük, nane yelek, mavi ceket, bordo bandana."), cost: 0, house: null, trim: 0xf7f4ee, swatch: [0x2f5a4c, 0x4fb59a, 0x3f7fae] },
  { id: 'bakir', name: tr("Bakır"), desc: tr("Tuğla kırmızısı takım; kafenin turuncu vurgusuyla akraba."), cost: 9000, house: 0xc4622f, trim: 0xf7efe2, swatch: [0xc4622f, 0xf7efe2] },
  { id: 'lacivert', name: tr("Lacivert"), desc: tr("Denizci laciverti; krem biye ile."), cost: 28000, house: 0x2f4a72, trim: 0xf2ede2, swatch: [0x2f4a72, 0xf2ede2] },
  { id: 'bordo', name: tr("Bordo"), desc: tr("Koyu şarap tonu; klasik otel servisi."), cost: 75000, house: 0x8c2f42, trim: 0xf0e4d2, swatch: [0x8c2f42, 0xf0e4d2] },
  { id: 'gece', name: tr("Antrasit & Altın"), desc: tr("Koyu gri takım, altın biye. Ekibin en gösterişli hâli."), cost: 190000, house: 0x39414d, trim: 0xd4a017, swatch: [0x39414d, 0xd4a017] },
];

/* ------------------------------------------------------------ erişim */

export type AnyCosmetic = WallSkin | FloorSkin | TableSkin | UniformSkin;

const BY_AXIS: Record<CosmeticAxis, readonly AnyCosmetic[]> = {
  wall: WALL_SKINS,
  floor: FLOOR_SKINS,
  table: TABLE_SKINS,
  uniform: UNIFORM_SKINS,
};

export function cosmeticOptions(axis: CosmeticAxis): readonly AnyCosmetic[] {
  return BY_AXIS[axis];
}

/** Eksenin varsayılanı = listenin ilk öğesi (daima ₺0). */
export function defaultCosmetic(axis: CosmeticAxis): string {
  return BY_AXIS[axis][0].id;
}

export function cosmeticById(axis: CosmeticAxis, id: string): AnyCosmetic {
  return BY_AXIS[axis].find((o) => o.id === id) ?? BY_AXIS[axis][0];
}

export function wallSkin(id: string): WallSkin {
  return (WALL_SKINS.find((o) => o.id === id) ?? WALL_SKINS[0]) as WallSkin;
}
export function floorSkin(id: string): FloorSkin {
  return (FLOOR_SKINS.find((o) => o.id === id) ?? FLOOR_SKINS[0]) as FloorSkin;
}
export function tableSkin(id: string): TableSkin {
  return (TABLE_SKINS.find((o) => o.id === id) ?? TABLE_SKINS[0]) as TableSkin;
}
export function uniformSkin(id: string): UniformSkin {
  return (UNIFORM_SKINS.find((o) => o.id === id) ?? UNIFORM_SKINS[0]) as UniformSkin;
}

/** Sahiplik anahtarı — kayıtta düz metin dizi olarak saklanır. */
export function cosmeticKey(axis: CosmeticAxis, id: string): string {
  return `${axis}:${id}`;
}
