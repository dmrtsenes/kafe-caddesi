/**
 * İKON VE AÇILIŞ GÖRSELİ ÜRETİCİSİ
 *
 * Mağaza ikonu ve açılış ekranı, oyunun geri kalanının aksine GERÇEK PNG
 * dosyası olmak zorundadır (Play Store ve App Store bunları paketin içinde
 * ister). Bu yüzden "tüm varlıklar kodla üretilir" kuralı burada da
 * korunur ama farklı bir biçimde: kaynak SVG bu dosyada tanımlıdır ve
 * PNG'ler ondan üretilir. Amblemi değiştirmek için SVG'yi düzenleyip
 * `npm run assets:make` çalıştırmak yeterli — elde bir tasarım dosyası
 * tutmaya gerek yok.
 *
 * Üretim zinciri:
 *   npm run assets:make   → assets/*.png  (bu dosya)
 *   npm run assets        → android/ios içindeki tüm boyutlar
 *
 * Amblem: index.html'deki favicon ile AYNI fincan; marka her yerde tek.
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* ---------------- marka renkleri (src/data/layouts.ts ile aynı) ------- */
const BRAND = '#376152'; // koyu yeşil — kafenin markası
const BRAND_DEEP = '#24413a';
const CREAM = '#ffd9a0'; // fincan
const CREAM_HI = '#fff0d4';
const GOLD = '#ffc84a';

const OUT = resolve(process.cwd(), 'assets');
const PUB = resolve(process.cwd(), 'public');

/**
 * Fincan amblemi.
 *
 * @param s      Tuval kenarı
 * @param scale  Amblemin tuvale oranı. Android uyarlanabilir ikonda
 *               ÖN PLAN katmanı kırpılır: güvenli alan iç %66'dır, bu
 *               yüzden ön plan için küçük bir ölçek verilir.
 * @param steam  Buhar çizilsin mi (küçük boyutlarda karmaşa yapar).
 */
function cupSvg(s, scale = 0.56, steam = true) {
  const c = s / 2;
  const u = (s * scale) / 100; // amblem birimi
  const p = (n) => (n * u).toFixed(2);
  // Amblem, kendi 100×100 kutusunda ortalanmış olarak çizilir.
  const ox = c - 50 * u;
  const oy = c - 50 * u;
  const T = (x, y) => `${(ox + x * u).toFixed(2)},${(oy + y * u).toFixed(2)}`;

  /*
   * Amblem 100×100 kutusunda çizilir. Ölçüler birbirine BAĞLI tutulur ki
   * ölçek değişince kompozisyon bozulmasın:
   *   gövde x 26..72 (genişlik 46, yarıçap 23)
   *   düz kenar y 36..49, sonra 23 yarıçaplı yay → alt uç y = 72
   *   tabak y 74..82 ve gövdeden geniş → alt uç tabağın İÇİNE girmez
   * Kulp sağda olduğu için amblem 2 birim sola kaydırılarak görsel
   * merkez tuvalin merkezine oturtulur.
   */
  const SH = -2; // yatay denge kaydırması
  const X = (n) => n + SH;

  const steamPath = steam
    ? `
    <g stroke="${CREAM_HI}" stroke-width="${p(4.6)}" stroke-linecap="round" fill="none" opacity="0.9">
      <path d="M ${T(X(35), 26)} C ${T(X(30), 18)} ${T(X(41), 15)} ${T(X(36), 6)}"/>
      <path d="M ${T(X(49), 23)} C ${T(X(44), 15)} ${T(X(55), 12)} ${T(X(50), 3)}"/>
      <path d="M ${T(X(63), 26)} C ${T(X(58), 18)} ${T(X(69), 15)} ${T(X(64), 6)}"/>
    </g>`
    : '';

  return `
    <!-- kulp: gövdenin sağ kenarına oturur -->
    <path d="M ${T(X(72), 44)} h ${p(6)} a ${p(10.5)} ${p(10.5)} 0 0 1 0 ${p(21)} h ${p(-6)}"
          fill="none" stroke="${CREAM}" stroke-width="${p(7)}" stroke-linecap="round"/>
    <!-- gövde -->
    <path d="M ${T(X(26), 36)} h ${p(46)} v ${p(13)} a ${p(23)} ${p(23)} 0 0 1 ${p(-46)} 0 z"
          fill="${CREAM}"/>
    <!-- kahve yüzeyi: gövde genişliğiyle birebir -->
    <ellipse cx="${(ox + X(49) * u).toFixed(2)}" cy="${(oy + 36.5 * u).toFixed(2)}"
             rx="${p(23)}" ry="${p(5)}" fill="${BRAND_DEEP}" opacity="0.9"/>
    <!-- tabak: gövdeden geniş, gövdenin ALTINDA -->
    <rect x="${(ox + X(17) * u).toFixed(2)}" y="${(oy + 74 * u).toFixed(2)}"
          width="${p(64)}" height="${p(8)}" rx="${p(4)}" fill="${CREAM}"/>
    ${steamPath}`;
}

function iconOnly(s) {
  const r = s * 0.22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <defs>
      <radialGradient id="bg" cx="0.5" cy="0.36" r="0.78">
        <stop offset="0" stop-color="#43705f"/><stop offset="1" stop-color="${BRAND_DEEP}"/>
      </radialGradient>
    </defs>
    <rect width="${s}" height="${s}" rx="${r}" fill="url(#bg)"/>
    ${cupSvg(s, 0.56, true)}
  </svg>`;
}

function iconBackground(s) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <defs>
      <radialGradient id="bg" cx="0.5" cy="0.36" r="0.8">
        <stop offset="0" stop-color="#43705f"/><stop offset="1" stop-color="${BRAND_DEEP}"/>
      </radialGradient>
    </defs>
    <rect width="${s}" height="${s}" fill="url(#bg)"/>
  </svg>`;
}

/** Uyarlanabilir ikon ön planı: güvenli alan iç %66, amblem küçük tutulur. */
function iconForeground(s) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    ${cupSvg(s, 0.4, true)}
  </svg>`;
}

/**
 * Açılış ekranı.
 *
 * Capacitor kare görseli CENTER_CROP ile yerleştirir: uzun bir telefonda
 * görsel yüksekliğe göre büyütülür ve KENARLAR KIRPILIR. 9:19.5 bir
 * ekranda karenin yalnızca orta ~%46'sı görünür. Bu yüzden amblem ve
 * yazı, karenin orta %40'lık bandını aşmayacak biçimde küçük tutulur.
 */
function splash(s, dark) {
  const top = dark ? '#1b2f2a' : '#43705f';
  const bot = dark ? '#0f1d1a' : BRAND_DEEP;
  const wordY = s / 2 + s * 0.155;
  const fs = s * 0.038;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/>
      </linearGradient>
    </defs>
    <rect width="${s}" height="${s}" fill="url(#sky)"/>
    <circle cx="${s / 2}" cy="${s / 2 - s * 0.02}" r="${s * 0.155}" fill="${GOLD}" opacity="0.10"/>
    <g transform="translate(0, ${-s * 0.02})">${cupSvg(s, 0.2, true)}</g>
    <text x="${s / 2}" y="${wordY}" text-anchor="middle"
          font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif"
          font-size="${fs}" font-weight="700" letter-spacing="${fs * 0.10}"
          fill="${CREAM}">KAFE CADDESİ</text>
    <text x="${s / 2}" y="${wordY + fs * 1.5}" text-anchor="middle"
          font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif"
          font-size="${fs * 0.52}" fill="${CREAM}" opacity="0.66">Sokağın en sıcak kafesi</text>
  </svg>`;
}

/**
 * Maskelenebilir PWA ikonu: Android/Chrome ikonu daire, damla veya kare
 * olarak kırpabilir. Güvenli alan iç %80'dir, bu yüzden amblem küçük
 * tutulur ve arka plan kenardan kenara dolar (yuvarlatılmış köşe YOK).
 */
function maskable(s) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <defs>
      <radialGradient id="bg" cx="0.5" cy="0.36" r="0.8">
        <stop offset="0" stop-color="#43705f"/><stop offset="1" stop-color="${BRAND_DEEP}"/>
      </radialGradient>
    </defs>
    <rect width="${s}" height="${s}" fill="url(#bg)"/>
    ${cupSvg(s, 0.44, true)}
  </svg>`;
}

/**
 * Bildirim durum çubuğu ikonu (Android smallIcon).
 *
 * Android bu ikonu yalnızca ALFA maskesi olarak çizer: renk kanalı
 * yok sayılır, şekil beyaz + saydam olmak zorundadır. Renkli launcher
 * ikonu verilirse durum çubuğunda gri/beyaz bir kare görünür — bu
 * yüzden fincan silüetinin düz beyaz bir varyantı üretilir.
 * capacitor-assets bildirim ikonu üretmediği için res/drawable-* içine
 * doğrudan buradan yazılır; Native.ts `smallIcon: 'ic_stat_notify'`
 * ile kullanır.
 */
function notifyIcon(s) {
  const c = s / 2;
  const u = (s * 0.86) / 100;
  const p = (n) => (n * u).toFixed(2);
  const ox = c - 50 * u;
  const oy = c - 50 * u;
  const T = (x, y) => `${(ox + x * u).toFixed(2)},${(oy + y * u).toFixed(2)}`;
  const SH = -2;
  const X = (n) => n + SH;
  // Gövde/kulp/tabak oranları cupSvg ile aynı; buhar küçük boyutta
  // çamurlaştığı için tek kısa çizgiye indirildi.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <g fill="#ffffff" stroke="none">
      <path d="M ${T(X(72), 40)} h ${p(6)} a ${p(11)} ${p(11)} 0 0 1 0 ${p(24)} h ${p(-6)} v ${p(-7)} h ${p(4)} a ${p(5)} ${p(5)} 0 0 0 0 ${p(-10)} h ${p(-4)} z"/>
      <path d="M ${T(X(26), 32)} h ${p(46)} v ${p(17)} a ${p(23)} ${p(23)} 0 0 1 ${p(-46)} 0 z"/>
      <rect x="${(ox + X(17) * u).toFixed(2)}" y="${(oy + 78 * u).toFixed(2)}" width="${p(64)}" height="${p(9)}" rx="${p(4.5)}"/>
      <path d="M ${T(X(46), 22)} C ${T(X(41), 15)} ${T(X(52), 11)} ${T(X(47), 3)}" fill="none" stroke="#ffffff" stroke-width="${p(6)}" stroke-linecap="round"/>
    </g>
  </svg>`;
}

const RES = resolve(process.cwd(), 'android/app/src/main/res');
/** Yoğunluk → piksel: bildirim ikonu tabanı 24dp'dir. */
const NOTIFY_DENSITIES = [
  ['drawable-mdpi', 24],
  ['drawable-hdpi', 36],
  ['drawable-xhdpi', 48],
  ['drawable-xxhdpi', 72],
  ['drawable-xxxhdpi', 96],
];

const JOBS = [
  [OUT, 'icon-only.png', iconOnly(1024), 1024],
  [OUT, 'icon-background.png', iconBackground(1024), 1024],
  [OUT, 'icon-foreground.png', iconForeground(1024), 1024],
  [OUT, 'splash.png', splash(2732, false), 2732],
  [OUT, 'splash-dark.png', splash(2732, true), 2732],
  // PWA / web manifest ikonları — aynı amblemden, tek marka.
  [PUB, 'pwa-192.png', iconOnly(512), 192],
  [PUB, 'pwa-512.png', iconOnly(512), 512],
  [PUB, 'pwa-maskable-512.png', maskable(512), 512],
  // Android bildirim ikonu — beyaz-alfa, yoğunluk başına bir dosya.
  ...NOTIFY_DENSITIES.map(([dir, px]) => [resolve(RES, dir), 'ic_stat_notify.png', notifyIcon(256), px]),
];

mkdirSync(OUT, { recursive: true });
mkdirSync(PUB, { recursive: true });
for (const [dir, name, svg, size] of JOBS) {
  mkdirSync(dir, { recursive: true });
  const png = await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(resolve(dir, name), png);
  console.log(`${name.padEnd(24)} ${size}×${size}  ${(png.length / 1024).toFixed(0)} KB`);
}
console.log('\nassets/, public/ ve res/drawable-* yenilendi. Şimdi: npm run assets');
