import { tr } from '../core/I18n';
import type { UiAdRewardKind } from './api';

const NS = 'http://www.w3.org/2000/svg';

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

export interface RewardOfferCopy {
  badge: string;
  cta: string;
  subCta: string;
}

/**
 * AdMob ödüllü reklam politikasına %100 uyumlu, aksiyon odaklı CTA metinleri.
 * Kullanıcı ne kazanacağını büyük ana başlıkta, kısa reklam izleyeceğini ise
 * hemen altındaki açık bildirim satırında net biçimde görür.
 */
export function rewardOfferCopy(
  kind: UiAdRewardKind,
  variant: 'default' | 'urgent' | 'vip',
  isPartialZone = false,
): RewardOfferCopy {
  const badge =
    variant === 'vip'
      ? tr('VIP FIRSAT')
      : variant === 'urgent'
        ? tr('ACİL DESTEK')
        : tr('ÖZEL ÖDÜL');
  const subCta = tr('Kısa Video · Ücretsiz Ödül');

  switch (kind) {
    case 'robot_vacuum':
      return { badge, cta: tr('ROBOTU ÇALIŞTIR'), subCta };
    case 'zone_finish':
      return {
        badge: isPartialZone ? tr('HIZLI AÇILIM') : tr('ANINDA AÇILIM'),
        cta: isPartialZone ? tr('%50 HIZLI ÖDE') : tr('BÖLÜMÜ HEMEN AÇ'),
        subCta,
      };
    case 'happy_hour':
      return { badge: tr('KAZANÇ ÇARPANI'), cta: tr('2× KAZANCI BAŞLAT'), subCta };
    case 'cash_boost':
      return { badge, cta: tr('NAKİT DESTEĞİNİ AL'), subCta };
    case 'investor':
      return { badge: tr('VIP YATIRIMCI'), cta: tr('YATIRIMI KASAYA AL'), subCta };
    case 'usta_mode':
      return { badge, cta: tr('USTA MODUNU AÇ'), subCta };
    case 'rush_hour':
      return { badge, cta: tr('AKINI BAŞLAT'), subCta };
    case 'tip_rain':
      return { badge, cta: tr('BAHŞİŞLERİ ×3 YAP'), subCta };
    case 'repair_shield':
      return { badge: tr('ACİL TAMİR'), cta: tr('ANINDA TAMİR ET'), subCta };
    case 'stock_refill':
      return { badge, cta: tr('DEPOLARI DOLDUR'), subCta };
    case 'daily_double':
      return { badge, cta: tr('ÖDÜLÜ ×2 AL'), subCta };
    default:
      return { badge, cta: tr('ÖDÜLÜ AL'), subCta };
  }
}

/** CTA butonunun solundaki sinema klapeti + oynat vektör rozeti (YouTube/TV ekranı DEĞİL). */
export function createClapperPlaySvg(): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24',
    class: 'adchip-cta-svg',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  // Klapet gövdesi
  svg.appendChild(
    svgEl('rect', {
      x: 2.5,
      y: 7.5,
      width: 19,
      height: 13.5,
      rx: 3,
      fill: 'currentColor',
      opacity: '0.22',
    }),
  );
  svg.appendChild(
    svgEl('path', {
      d: 'M4.5 4.2h15a2 2 0 0 1 2 2v2.6h-19V6.2a2 2 0 0 1 2-2Z',
      fill: 'currentColor',
    }),
  );
  svg.appendChild(
    svgEl('path', {
      d: 'M7.5 4.2 5.7 8.8M13 4.2l-1.8 4.6M18.5 4.2l-1.8 4.6',
      stroke: '#241a06',
      'stroke-width': 1.7,
      'stroke-linecap': 'round',
    }),
  );
  // İç oynat üçgeni
  svg.appendChild(
    svgEl('path', {
      d: 'M10.2 11.4 16 14.6l-5.8 3.2v-6.4Z',
      fill: 'currentColor',
    }),
  );
  return svg;
}

/** Her ödül türü için özel çizilmiş çok katmanlı 64×64 SVG vitrin illüstrasyonu. */
export function createRewardHeroSvg(kind: UiAdRewardKind): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: '0 0 64 64',
    class: 'adchip-hero-svg',
    'aria-hidden': 'true',
    focusable: 'false',
  });

  if (kind === 'robot_vacuum') {
    // Yan döner fırçalar (sol-üst ve sağ-üst bıyıklar)
    svg.appendChild(
      svgEl('path', {
        d: 'M17 18 9 11M17 18 8 19M17 18 14 9M47 18l8-7M47 18l9 1M47 18l-3-9',
        stroke: '#6ee7d8',
        'stroke-width': 2.4,
        'stroke-linecap': 'round',
      }),
    );
    // Alt gölge & gövde diski
    svg.appendChild(svgEl('ellipse', { cx: 32, cy: 36.5, rx: 20.5, ry: 18.5, fill: '#1a2730' }));
    svg.appendChild(svgEl('ellipse', { cx: 32, cy: 33.5, rx: 20, ry: 18, fill: '#3f515e', stroke: '#e8dfc9', 'stroke-width': 2.4 }));
    // Ön tampon yay şeridi
    svg.appendChild(
      svgEl('path', {
        d: 'M14.5 28a18.5 16.5 0 0 1 35 0',
        fill: 'none',
        stroke: '#ffd978',
        'stroke-width': 2.8,
        'stroke-linecap': 'round',
      }),
    );
    // İç metal halka
    svg.appendChild(svgEl('ellipse', { cx: 32, cy: 33.5, rx: 13.5, ry: 12, fill: '#2c3b46', stroke: '#6fd6ff', 'stroke-width': 1.3, opacity: '0.9' }));
    // Üst LiDAR lazer kulesi
    svg.appendChild(svgEl('ellipse', { cx: 32, cy: 32, rx: 6.8, ry: 6.2, fill: '#e8dfc9' }));
    svg.appendChild(svgEl('circle', { cx: 32, cy: 31.5, r: 3.6, fill: '#38bdf8' }));
    // Ön optik sensör ışığı + parıltılar
    svg.appendChild(svgEl('circle', { cx: 32, cy: 20.5, r: 2.3, fill: '#7dd3fc' }));
    svg.appendChild(svgEl('path', { d: 'M51 44l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4ZM11 42l1.4 3 3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4 1.4-3Z', fill: '#ffd978' }));
    return svg;
  }

  if (kind === 'zone_finish') {
    // Altın Mimari Kilit Açma Anahtarı + Zümrüt Taş + Işıltı Tacı
    svg.appendChild(svgEl('circle', { cx: 32, cy: 32, r: 23, fill: '#f5b942', opacity: '0.14' }));
    svg.appendChild(
      svgEl('path', {
        d: 'M28.5 34.5 48 15l4.5 4.5-3.8 3.8 3.4 3.4-4 4-3.4-3.4-3.2 3.2 3.2 3.2-4 4-3.2-3.2-6.5 6.5',
        fill: 'none',
        stroke: '#ffd463',
        'stroke-width': 4.6,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
    );
    svg.appendChild(svgEl('circle', { cx: 22.5, cy: 40.5, r: 10.5, fill: '#2a3d47', stroke: '#ffd463', 'stroke-width': 4.4 }));
    svg.appendChild(svgEl('circle', { cx: 22.5, cy: 40.5, r: 4.4, fill: '#34d399' }));
    svg.appendChild(svgEl('path', { d: 'M16 14l2.2 4.6L23 20.8l-4.8 2.2L16 27.6l-2.2-4.6L9 20.8l4.8-2.2L16 14ZM49 39l1.6 3.4 3.4 1.6-3.4 1.6L49 49l-1.6-3.4-3.4-1.6 3.4-1.6L49 39Z', fill: '#ffe89e' }));
    return svg;
  }

  if (kind === 'happy_hour') {
    // Altın Kafe Fincanı + 2× Kraliyet Rozeti + Buhar Parıltısı
    svg.appendChild(svgEl('ellipse', { cx: 30, cy: 49, rx: 18, ry: 4.5, fill: '#d99b26' }));
    svg.appendChild(
      svgEl('path', {
        d: 'M16 25h26v13a13 13 0 0 1-26 0V25Z',
        fill: '#f5b942',
        stroke: '#fff3c4',
        'stroke-width': 2.2,
      }),
    );
    svg.appendChild(
      svgEl('path', {
        d: 'M42 28h4.5a5.5 5.5 0 0 1 0 11H42',
        fill: 'none',
        stroke: '#ffd978',
        'stroke-width': 3.4,
        'stroke-linecap': 'round',
      }),
    );
    svg.appendChild(svgEl('ellipse', { cx: 29, cy: 25.5, rx: 12, ry: 3.4, fill: '#6b3e26' }));
    svg.appendChild(
      svgEl('path', {
        d: 'M24 18c0-3 2.5-3.5 2.5-6.5M30 17c0-3 2.5-3.5 2.5-6.5M36 18c0-3 2.5-3.5 2.5-6.5',
        fill: 'none',
        stroke: '#ffe89e',
        'stroke-width': 2.2,
        'stroke-linecap': 'round',
      }),
    );
    svg.appendChild(svgEl('circle', { cx: 46, cy: 18, r: 10, fill: '#10b981', stroke: '#fffbeb', 'stroke-width': 2 }));
    const txt = svgEl('text', {
      x: 46,
      y: 22,
      'text-anchor': 'middle',
      fill: '#ffffff',
      'font-size': 11,
      'font-weight': 900,
      'font-family': 'system-ui, sans-serif',
    });
    txt.textContent = '2×';
    svg.appendChild(txt);
    return svg;
  }

  if (kind === 'cash_boost' || kind === 'investor') {
    // VIP Evrak Çantası / Zümrüt Banknot Destesi + Altın Sikkeler
    if (kind === 'investor') {
      svg.appendChild(svgEl('rect', { x: 11, y: 22, width: 42, height: 28, rx: 6, fill: '#5c3a21', stroke: '#ffd463', 'stroke-width': 2.4 }));
      svg.appendChild(svgEl('path', { d: 'M25 22v-4a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4', fill: 'none', stroke: '#ffd463', 'stroke-width': 2.8 }));
      svg.appendChild(svgEl('rect', { x: 11, y: 31, width: 42, height: 4, fill: '#3d2514' }));
      svg.appendChild(svgEl('rect', { x: 28, y: 29, width: 8, height: 8, rx: 2, fill: '#ffd463' }));
    } else {
      svg.appendChild(svgEl('rect', { x: 11, y: 26, width: 36, height: 21, rx: 4, fill: '#059669', stroke: '#a7f3d0', 'stroke-width': 2 }));
      svg.appendChild(svgEl('rect', { x: 15, y: 20, width: 36, height: 21, rx: 4, fill: '#10b981', stroke: '#ecfdf5', 'stroke-width': 2.2 }));
      svg.appendChild(svgEl('rect', { x: 29, y: 20, width: 8, height: 21, fill: '#fef3c7' }));
    }
    svg.appendChild(svgEl('circle', { cx: 47, cy: 44, r: 9.5, fill: '#f5b942', stroke: '#fffbeb', 'stroke-width': 2 }));
    const tl = svgEl('text', {
      x: 47,
      y: 48,
      'text-anchor': 'middle',
      fill: '#3b2506',
      'font-size': 12,
      'font-weight': 900,
      'font-family': 'system-ui, sans-serif',
    });
    tl.textContent = '₺';
    svg.appendChild(tl);
    return svg;
  }

  if (kind === 'usta_mode') {
    // Şef/Barista Tacı + Altın Yıldırım
    svg.appendChild(
      svgEl('path', {
        d: 'M18 36c-4.5-1-7-5-6-9.5 1-4.2 5-6.8 9.2-6 2.2-4.2 6.5-6.5 10.8-6.5s8.6 2.3 10.8 6.5c4.2-.8 8.2 1.8 9.2 6 1 4.5-1.5 8.5-6 9.5v9H18v-9Z',
        fill: '#fffbeb',
        stroke: '#f5b942',
        'stroke-width': 2.4,
      }),
    );
    svg.appendChild(svgEl('rect', { x: 18, y: 41, width: 28, height: 6, rx: 2, fill: '#f5b942' }));
    svg.appendChild(svgEl('path', { d: 'M35 19 25 34h7l-2 13 11-16h-7l1-12Z', fill: '#ff9f1c', stroke: '#3b2506', 'stroke-width': 1.4 }));
    return svg;
  }

  if (kind === 'rush_hour') {
    // Altın Resepsiyon/Servis Çanı + Ses Dalgaları
    svg.appendChild(svgEl('path', { d: 'M14 44h36', stroke: '#ffd463', 'stroke-width': 4, 'stroke-linecap': 'round' }));
    svg.appendChild(svgEl('path', { d: 'M17 44a15 15 0 0 1 30 0H17Z', fill: '#f5b942', stroke: '#fff3c4', 'stroke-width': 2.2 }));
    svg.appendChild(svgEl('circle', { cx: 32, cy: 25, r: 3.2, fill: '#ffe89e' }));
    svg.appendChild(svgEl('path', { d: 'M13 24a20 20 0 0 1 7-9M51 24a20 20 0 0 0-7-9', fill: 'none', stroke: '#5eead4', 'stroke-width': 2.8, 'stroke-linecap': 'round' }));
    return svg;
  }

  if (kind === 'tip_rain') {
    // Bahşiş Kavanozu + Yağan Altın Sikkeler
    svg.appendChild(svgEl('rect', { x: 20, y: 26, width: 24, height: 26, rx: 6, fill: '#14b8a6', opacity: '0.35', stroke: '#99f6e4', 'stroke-width': 2.2 }));
    svg.appendChild(svgEl('rect', { x: 22, y: 22, width: 20, height: 4.5, rx: 2, fill: '#ffd463' }));
    svg.appendChild(svgEl('circle', { cx: 26, cy: 15, r: 5, fill: '#f5b942', stroke: '#fffbeb', 'stroke-width': 1.5 }));
    svg.appendChild(svgEl('circle', { cx: 38, cy: 12, r: 5.5, fill: '#ffd463', stroke: '#fffbeb', 'stroke-width': 1.5 }));
    svg.appendChild(svgEl('circle', { cx: 32, cy: 39, r: 6.5, fill: '#f5b942', stroke: '#fffbeb', 'stroke-width': 1.6 }));
    return svg;
  }

  if (kind === 'repair_shield') {
    // Zümrüt-Altın Koruma Kalkanı + Anahtar
    svg.appendChild(
      svgEl('path', {
        d: 'M32 10 14 17v14c0 12 7.8 19.6 18 22 10.2-2.4 18-10 18-22V17L32 10Z',
        fill: '#0f766e',
        stroke: '#ffd463',
        'stroke-width': 2.8,
      }),
    );
    svg.appendChild(
      svgEl('path', {
        d: 'm24 32 5.5 5.5L41 26',
        fill: 'none',
        stroke: '#ecfdf5',
        'stroke-width': 4,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
    );
    return svg;
  }

  // stock_refill & daily_double — Kurdeleli Hediye / Tedarik Sandığı
  svg.appendChild(svgEl('rect', { x: 15, y: 24, width: 34, height: 26, rx: 5, fill: '#d97706', stroke: '#fde68a', 'stroke-width': 2.2 }));
  svg.appendChild(svgEl('rect', { x: 13, y: 19, width: 38, height: 8, rx: 3, fill: '#f59e0b', stroke: '#fef3c7', 'stroke-width': 2 }));
  svg.appendChild(svgEl('rect', { x: 29, y: 19, width: 6, height: 31, fill: '#fef3c7' }));
  svg.appendChild(
    svgEl('path', {
      d: 'M32 19c-7 0-9-7-4-9 3-1 6 3 4 9Zm0 0c7 0 9-7 4-9-3-1-6 3-4 9Z',
      fill: 'none',
      stroke: '#fde68a',
      'stroke-width': 2.6,
    }),
  );
  return svg;
}
