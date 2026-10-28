/**
 * MAĞAZA GÖRSELİ ÜRETİCİSİ — Play Store feature graphic.
 *
 * `make-assets.mjs` ile aynı ilkeye uyar: elde tasarım dosyası tutulmaz,
 * kaynak SVG burada tanımlıdır ve PNG ondan üretilir. Amblem, ikon ve
 * açılış görseliyle BİREBİR aynı fincandır — ikon, splash, bildirim
 * ikonu ve mağaza kartı tek görsel dil konuşur.
 *
 *   node tools/make-store-assets.mjs   →  cikti/magaza/feature-graphic.png
 *
 * PLAY ŞARTNAMESİ (support.google.com/googleplay/android-developer/answer/9866151)
 *   · 1024 × 500 piksel
 *   · JPEG veya 24-bit PNG — ALPHA KANALI OLMAZ
 * Bu yüzden çıktı `.flatten()` ile düz zemine basılır ve alpha atılır;
 * saydam PNG yüklenirse Play dosyayı reddeder.
 *
 * KADRAJ UYARISI: Play bu görseli bazı yerleşimlerde kırpar ve tanıtım
 * videosu varsa ORTASINA oynat düğmesi bindirir. Bu yüzden yazı solda
 * ~%55'lik bantta durur, kenarlardan 56 px güvenlik payı bırakılır ve
 * tam merkez görsel olarak boş tutulur.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/* ── marka renkleri — make-assets.mjs ve src/data/layouts.ts ile aynı ── */
const BRAND = '#376152'; // koyu yeşil
const BRAND_DEEP = '#24413a';
const BRAND_LIGHT = '#4c8069';
const CREAM = '#ffd9a0'; // fincan
const CREAM_HI = '#fff0d4';
const GOLD = '#ffc84a';
const TEXT = '#f5efe2';

const W = 1024;
const H = 500;
const OUT = resolve(process.cwd(), 'cikti', 'magaza');

/**
 * Fincan amblemi — make-assets.mjs'teki `cupSvg` ile aynı geometri.
 *
 * İki dosyada da tek kaynaktan üretmek için ortak bir modüle çıkarmak
 * doğru olurdu; ama `make-assets.mjs` ikon/splash zincirini besliyor ve
 * onu bölmek yayın öncesi gereksiz risk. Geometri değişirse İKİSİ de
 * güncellenmeli — ölçüler birebir kopyadır.
 *
 * @param cx  Amblem merkezinin x'i
 * @param cy  Amblem merkezinin y'si
 * @param s   Amblem kutusunun kenarı (100 birimlik çizim buna ölçeklenir)
 */
function cup(cx, cy, s, steam = true) {
  const u = s / 100;
  const p = (n) => (n * u).toFixed(2);
  const ox = cx - 50 * u;
  const oy = cy - 50 * u;
  const SH = -2; // kulp sağda; amblem görsel merkeze otursun diye sola kayar
  const X = (n) => n + SH;
  const T = (x, y) => `${(ox + X(x) * u).toFixed(2)},${(oy + y * u).toFixed(2)}`;

  const steamPath = steam
    ? `<g stroke="${CREAM_HI}" stroke-width="${p(4.6)}" stroke-linecap="round" fill="none" opacity="0.85">
         <path d="M ${T(35, 26)} C ${T(30, 18)} ${T(41, 15)} ${T(36, 6)}"/>
         <path d="M ${T(49, 23)} C ${T(44, 15)} ${T(55, 12)} ${T(50, 3)}"/>
         <path d="M ${T(63, 26)} C ${T(58, 18)} ${T(69, 15)} ${T(64, 6)}"/>
       </g>`
    : '';

  return `
    <path d="M ${T(72, 44)} h ${p(6)} a ${p(10.5)} ${p(10.5)} 0 0 1 0 ${p(21)} h ${p(-6)}"
          fill="none" stroke="${CREAM}" stroke-width="${p(7)}" stroke-linecap="round"/>
    <path d="M ${T(26, 36)} h ${p(46)} v ${p(13)} a ${p(23)} ${p(23)} 0 0 1 ${p(-46)} 0 z" fill="${CREAM}"/>
    <ellipse cx="${(ox + X(49) * u).toFixed(2)}" cy="${(oy + 36.5 * u).toFixed(2)}"
             rx="${p(23)}" ry="${p(5)}" fill="${BRAND_DEEP}" opacity="0.9"/>
    <rect x="${(ox + X(17) * u).toFixed(2)}" y="${(oy + 74 * u).toFixed(2)}"
          width="${p(64)}" height="${p(8)}" rx="${p(4)}" fill="${CREAM}"/>
    ${steamPath}`;
}

/**
 * Arka plandaki komşu bina — KOYU siluet, üstünde küçük sıcak pencereler.
 *
 * Bunlar bilerek detaysız: kadrajın konusu ortadaki kafe cephesi, komşular
 * yalnızca "burası bir sokak" bilgisini taşır. İlk denemede bu binalar
 * kafeyle aynı parlaklıktaydı ve kadraj boş yeşil kutular dizisi gibi
 * okunuyordu — kontrast tek taşıyıcı.
 */
function neighbour(x, y, w, h, windows) {
  const win = windows
    .map(
      ([wx, wy, ww, wh, o]) =>
        `<rect x="${x + wx}" y="${y + wy}" width="${ww}" height="${wh}" rx="2" fill="${GOLD}" opacity="${o}"/>`,
    )
    .join('');
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#16291f" opacity="0.85"/>${win}`;
}

/**
 * Vitrinde ARKADAN aydınlanan figür: sıcak camın önünde koyu siluet.
 *
 * Kafa/omuz oranı önemli: ilk denemede kafa yarıçapı gövde genişliğine
 * fazla yakındı ve figürler insan değil oyuncak ayı gibi okunuyordu.
 * Kafa küçültüldü, araya boyun kondu, omuz eğimi verildi.
 */
function figure(x, y, s) {
  const u = s / 100;
  const p = (n) => (n * u).toFixed(2);
  return `
    <g transform="translate(${x},${y})" fill="#43301f" opacity="0.93">
      <!-- omuzdan bele inen gövde: düz kutu değil, hafif eğimli -->
      <path d="M ${p(-20)} ${p(92)} v ${p(-28)} c 0 ${p(-16)} ${p(7)} ${p(-24)} ${p(20)} ${p(-24)}
               c ${p(13)} 0 ${p(20)} ${p(8)} ${p(20)} ${p(24)} v ${p(28)} z"/>
      <rect x="${p(-5)}" y="${p(34)}" width="${p(10)}" height="${p(10)}"/>
      <circle cx="0" cy="${p(28)}" r="${p(14)}"/>
    </g>`;
}

/**
 * KAFE CEPHESİ — kadrajın konusu.
 *
 * Fikir: alacakaranlıkta sokaktan bakılan aydınlık bir kafe. Dışarısı
 * markanın soğuk yeşili, içerisi sıcak kehribar; "sıcak kafe" hissini
 * bu tek kontrast taşıyor. Vitrindeki her şey (bar, fincanlar, iki figür)
 * kehribarın ÖNÜNDE koyu siluet olarak durur — böylece hem okunur hem de
 * kaba vektör karakter çizmek gerekmez.
 */
function cafeFront(x, y, w, h) {
  const winX = x + 22;
  const winY = y + 54;
  const winW = w - 44;
  const winH = h - 96;
  const barY = winY + winH - 62;

  const stripeN = 9;
  const stripe = w / stripeN;
  const awning = Array.from(
    { length: stripeN },
    (_, i) =>
      `<rect x="${(x + i * stripe).toFixed(1)}" y="${y + 16}" width="${stripe.toFixed(1)}" height="32"
             fill="${i % 2 === 0 ? CREAM_HI : '#c9553f'}"/>`,
  ).join('');

  const cups = [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const cx = winX + 34 + i * ((winW - 68) / 5);
      return `<g fill="#43301f" opacity="0.85">
        <rect x="${(cx - 7).toFixed(1)}" y="${barY - 15}" width="14" height="11" rx="2"/>
        <rect x="${(cx - 10).toFixed(1)}" y="${barY - 4}" width="20" height="4" rx="2"/>
      </g>`;
    })
    .join('');

  return `
    <!-- cephe gövdesi -->
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="#1d3a30"/>
    <!-- vitrin camı: sıcak kehribar -->
    <rect x="${winX}" y="${winY}" width="${winW}" height="${winH}" rx="4" fill="url(#warm)"/>
    <!-- iç mekân: bar hattı + fincanlar + iki figür, hepsi siluet -->
    ${figure(winX + winW * 0.36, winY + 24, 96)}
    ${figure(winX + winW * 0.66, winY + 16, 104)}
    <rect x="${winX}" y="${barY}" width="${winW}" height="13" fill="#5a3d24" opacity="0.9"/>
    <rect x="${winX + 8}" y="${barY + 13}" width="${winW - 16}" height="${winH - (barY - winY) - 13}"
          fill="#43301f" opacity="0.55"/>
    ${cups}
    <!-- cam kayıtları -->
    <rect x="${winX + winW / 2 - 3}" y="${winY}" width="6" height="${winH}" fill="#1d3a30" opacity="0.85"/>
    <rect x="${winX}" y="${winY}" width="${winW}" height="${winH}" rx="4"
          fill="none" stroke="#14261f" stroke-width="7"/>
    <!-- tente -->
    ${awning}
    <rect x="${x - 6}" y="${y + 10}" width="${w + 12}" height="8" rx="4" fill="${CREAM_HI}"/>
    <!--
      SARKIT LAMBALAR — camın çeyrek noktalarında.
      Tek lamba ortadayken cam kayıdının üstüne biniyor ve ikisi birlikte
      tek bir direk gibi okunuyordu; çift lamba hem o çakışmayı kaldırıyor
      hem kafe hissini güçlendiriyor.
    -->
    ${[0.25, 0.75]
      .map((f) => {
        const lx = winX + winW * f;
        return `<g fill="#14261f">
          <rect x="${(lx - 1.5).toFixed(1)}" y="${winY + 4}" width="3" height="16"/>
          <path d="M ${(lx - 13).toFixed(1)} ${winY + 34} l 13 -14 l 13 14 z"/>
        </g>
        <circle cx="${lx.toFixed(1)}" cy="${winY + 39}" r="7" fill="${CREAM_HI}"/>`;
      })
      .join('')}`;
}

function featureGraphic() {
  /* Alacakaranlık gökyüzündeki uzak ışıklar. */
  const bokeh = [
    [706, 74, 5, 0.5],
    [868, 52, 4, 0.42],
    [968, 96, 5, 0.46],
    [786, 38, 3.5, 0.4],
    [612, 60, 4, 0.36],
    [922, 34, 3, 0.34],
  ]
    .map(([cx, cy, r, o]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${CREAM_HI}" opacity="${o}"/>`)
    .join('');

  /*
   * Kaldırımdaki teras takımı — ışık havuzunun içinde duran yuvarlak masa
   * ve iki sandalye. Ön plan olarak derinlik veriyor; ilk denemede
   * ayrık dikdörtgenlerdi ve rastgele çubuk gibi okunuyordu, bu yüzden
   * masa tablası elips, sandalyeler açık arkalıklı çizildi.
   */
  const terrace = `
    <g fill="#14261f" opacity="0.92">
      <!-- sol sandalye: arkalık + oturak + AYAK (ayaksız hâli "Γ" gibi okunuyordu) -->
      <rect x="606" y="380" width="5" height="38" rx="2"/>
      <rect x="606" y="380" width="26" height="5" rx="2.5"/>
      <rect x="604" y="414" width="34" height="5" rx="2.5"/>
      <rect x="606" y="419" width="4" height="22"/>
      <rect x="632" y="419" width="4" height="22"/>
      <!-- masa -->
      <ellipse cx="676" cy="392" rx="34" ry="8"/>
      <rect x="672" y="396" width="8" height="44"/>
      <rect x="658" y="438" width="36" height="6" rx="3"/>
      <!-- sağ sandalye -->
      <rect x="740" y="376" width="5" height="42" rx="2"/>
      <rect x="719" y="376" width="26" height="5" rx="2.5"/>
      <rect x="715" y="414" width="34" height="5" rx="2.5"/>
      <rect x="717" y="419" width="4" height="22"/>
      <rect x="743" y="419" width="4" height="22"/>
    </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#5b8d75"/>
        <stop offset="0.5" stop-color="${BRAND}"/>
        <stop offset="1" stop-color="#152720"/>
      </linearGradient>
      <!-- vitrin camının kehribarı: kadrajdaki TEK sıcak kaynak -->
      <linearGradient id="warm" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0" stop-color="#ffe7b0"/>
        <stop offset="0.55" stop-color="#ffc472"/>
        <stop offset="1" stop-color="#f0a24e"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.78" cy="0.46" r="0.46">
        <stop offset="0" stop-color="${GOLD}" stop-opacity="0.42"/>
        <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
      </radialGradient>
      <!-- camdan kaldırıma dökülen ışık havuzu -->
      <linearGradient id="spill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${GOLD}" stop-opacity="0.5"/>
        <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="leftFade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#0f1f19" stop-opacity="0.95"/>
        <stop offset="0.58" stop-color="#0f1f19" stop-opacity="0.6"/>
        <stop offset="1" stop-color="#0f1f19" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#24413a"/>
        <stop offset="1" stop-color="#12231d"/>
      </linearGradient>
    </defs>

    <!-- gökyüzü -->
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${bokeh}
    <rect width="${W}" height="${H}" fill="url(#glow)"/>

    <!-- komşu binalar: koyu siluet -->
    ${neighbour(552, 118, 104, 250, [[18, 26, 20, 26, 0.5], [58, 26, 20, 26, 0.28], [18, 74, 20, 26, 0.34]])}
    ${neighbour(946, 96, 118, 272, [[22, 30, 22, 28, 0.42], [66, 30, 22, 28, 0.6], [22, 84, 22, 28, 0.3], [66, 84, 22, 28, 0.46]])}

    <!-- kaldırım -->
    <rect x="512" y="368" width="${W - 512}" height="${H - 368}" fill="url(#floor)"/>
    <rect x="512" y="368" width="${W - 512}" height="5" fill="${CREAM}" opacity="0.2"/>

    <!-- KAFE CEPHESİ -->
    ${cafeFront(646, 108, 300, 260)}

    <!-- vitrinden kaldırıma dökülen ışık -->
    <path d="M 668 368 L 924 368 L 976 462 L 616 462 Z" fill="url(#spill)"/>
    ${terrace}

    <!-- SOL BLOK: markanın okunması için zemini karart -->
    <rect x="0" y="0" width="660" height="${H}" fill="url(#leftFade)"/>

    <!-- amblem -->
    ${cup(126, 190, 150, true)}

    <!-- başlık -->
    <text x="216" y="176"
          font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="62" font-weight="700"
          letter-spacing="1.5" fill="${TEXT}">FİNCAN</text>
    <text x="216" y="244"
          font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="62" font-weight="700"
          letter-spacing="1.5" fill="${TEXT}">SOKAĞI</text>

    <!-- ayraç -->
    <rect x="60" y="292" width="86" height="5" rx="2.5" fill="${GOLD}"/>

    <!-- slogan -->
    <text x="60" y="348"
          font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="31" font-weight="600"
          fill="${CREAM}">Sokağın en sıcak kafesi</text>

    <!-- tür ifadesi: mağaza kartında adın anlatamadığı işi bu satır yapar -->
    <text x="60" y="396"
          font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="23" font-weight="400"
          letter-spacing="2.2" fill="${TEXT}" opacity="0.82">SİPARİŞ AL · YETİŞTİR · KAFENİ BÜYÜT</text>
  </svg>`;
}

mkdirSync(OUT, { recursive: true });

const svg = featureGraphic();
await sharp(Buffer.from(svg))
  .png()
  // ALPHA ATILIR: Play 24-bit PNG ister, saydam dosyayı reddeder.
  .flatten({ background: BRAND_DEEP })
  .toFile(resolve(OUT, 'feature-graphic.png'));

/* Mağaza simgesi: Play 512×512 32-bit PNG ister (bu ALPHA'LI olabilir). */
await sharp(resolve(process.cwd(), 'assets', 'icon-only.png'))
  .resize(512, 512, { fit: 'cover' })
  .png()
  .toFile(resolve(OUT, 'store-icon-512.png'));

console.log('cikti/magaza/feature-graphic.png (1024x500) + store-icon-512.png yazildi');
