/** Small original cafe icon family. No fonts, emoji rendering or network assets. */
const PATHS = {
  upgrade: 'M12 20V4m-6 6 6-6 6 6M5 20h14',
  staff: 'M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M4 21v-4a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v4M8 15v6m8-6v6',
  shop: 'M3 10h18l-2-7H5l-2 7Zm2 0v11h14V10M9 21v-7h6v7M3 7h18',
  settings: 'M4 5h16M4 12h16M4 19h16M8 3v4m8 3v4m-6 3v4',
  cup: 'M4 8h12v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm12 2h2a3 3 0 0 1 0 6h-2M7 3v2m5-2v2',
  tray: 'M3 15h18M5 15a7 7 0 0 1 14 0M12 8V5m-2 0h4M5 19h14',
  chair: 'M6 3h12v10H6V3ZM4 13h16v4H4v-4Zm2 4v5m12-5v5',
  clean: 'M15 3 9 13m-4 0 7 5 5-7-7-5M5 13l-3 6 7 3 3-4m-8-1 5 3',
  speed: 'm13 2-8 12h6l-1 8 9-13h-6l1-7Z',
  box: 'M3 7 12 3l9 4-9 4-9-4Zm0 0v12l9 3 9-3V7M12 11v11M7 5l10 4',
  lock: 'M5 10h14v11H5V10Zm3 0V6a4 4 0 0 1 8 0v4M12 14v3',
  target: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0Zm5 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 12l8-8',
  check: 'm4 12 5 5L20 6',
  gift: 'M3 8h18v5H3V8Zm2 5v9h14v-9M12 8v14M12 8C3 8 4 1 8 3l4 5Zm0 0c9 0 8-7 4-5l-4 5Z',
  trophy: 'M7 3h10v9a5 5 0 0 1-10 0V3Zm0 2H3v4a4 4 0 0 0 4 4m10-8h4v4a4 4 0 0 1-4 4M12 17v4m-4 0h8',
  palette: 'M12 3a9 9 0 0 0 0 18h2a2 2 0 0 0 1-4 2 2 0 0 1 2-3h2a3 3 0 0 0 2-3 9 9 0 0 0-9-8ZM7 8h.01M12 6h.01M17 9h.01M6 13h.01',
  coin: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M15 7h-5a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H9m3-10v14',
  ticket: 'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Zm12 1v3m0 3v2m0 3v2',
  heart: 'M12 21 3 12C-2 4 8-1 12 7c4-8 14-3 9 5l-9 9Z',
  warning: 'm12 3 10 18H2L12 3Zm0 6v5m0 3h.01',
  paper: 'M5 3h11l3 3v15H5V3Zm3 6h8m-8 4h8m-8 4h5',
  water: 'M12 2C9 7 4 12 4 16a8 8 0 0 0 16 0c0-4-5-9-8-14ZM8 15a4 4 0 0 0 4 5',
  tool: 'm4 3 5 5-1 3-3 1-4-5a7 7 0 0 0 8 9l7 7 4-4-7-7a7 7 0 0 0-9-9Z',
  shoe: 'M3 4h7v8l5 3 6 1v5H3V4Zm0 13h18m-9-5-2 3m6-1-2 3',
  hand: 'M7 13V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v9c0 9-12 10-14 3l-3-6a2 2 0 0 1 3-2l2 3Z',
  food: 'M3 8h18v11H3V8Zm0 3h18M5 8a4 4 0 0 1 7-3 4 4 0 0 1 7 3M6 15h12',
  sun: 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2',
  clock: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 6v7l4 2',
  audio: 'M3 9h4l5-5v16l-5-5H3V9Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16',
  screen: 'M3 4h18v13H3V4Zm9 13v4m-4 0h8',
} as const;
type IconName = keyof typeof PATHS;
const GROUPS: [IconName, string[]][] = [
  ['upgrade', ['⬆️','⬆','↑','🏃']], ['staff', ['👷','👨‍🍳','👩‍🍳','👥','👤','👋','🙌','🤝']],
  ['shop', ['🏪','🏬','🏠','🏖️','🏝️']], ['settings', ['⚙️','⚙','🎚️']],
  ['cup', ['☕','🍵','🫖','🥤','🧋']], ['tray', ['🍽️','🍽','🛎️']], ['chair', ['🪑']],
  ['clean', ['🧹','🧽','🧼','🤖']], ['speed', ['⚡']], ['box', ['📦','🧺','🛒']], ['lock', ['🔒']],
  ['target', ['🎯']], ['check', ['✅','✓','✔️']], ['gift', ['🎁','🎉','🎪','🎊']], ['trophy', ['🏆','⭐','🌟']],
  ['palette', ['🎨','🖌️']], ['coin', ['💰','💸','💵']], ['ticket', ['🎟️','🎫']], ['heart', ['💓','❤️','💔','😊']],
  ['warning', ['⚠️','🚨','😤','!']], ['paper', ['🧻','🧾','📋','📝','📜']], ['water', ['💧','🚻']],
  ['tool', ['🛠️','🔧','🔨']], ['shoe', ['👟']], ['hand', ['✋','🤲','👐']], ['food', ['🥪','🧇','🍦','🍔','🍰']],
  ['sun', ['☀️','🌞','🌅']], ['clock', ['⏱️','⏰','🕒']], ['audio', ['🔊','🔉','🔈','🎵','🎶']], ['screen', ['🎞️','📺','📱']],
];
const glyphNames = new Map(GROUPS.flatMap(([name, glyphs]) => glyphs.map(glyph => [glyph, name] as const)));
const GLYPH_KEYS = [...glyphNames.keys()];
const svgCache = new Map<IconName, SVGSVGElement>();

function createIconSvg(name: IconName): SVGSVGElement {
  let proto = svgCache.get(name);
  if (!proto) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'cafe-icon');
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', PATHS[name]); svg.appendChild(path);
    if (typeof svg.cloneNode === 'function') {
      svgCache.set(name, svg);
      return svg.cloneNode(true) as SVGSVGElement;
    }
    return svg;
  }
  return proto.cloneNode(true) as SVGSVGElement;
}

export function iconName(glyph: string): IconName | undefined { return glyphNames.get(glyph); }
export function setIconText(node: HTMLElement, text: string): void {
  node.replaceChildren();
  let prefix: string | undefined;
  let name = glyphNames.get(text);
  if (name) {
    prefix = text;
  } else {
    for (let i = 0; i < GLYPH_KEYS.length; i++) {
      const glyph = GLYPH_KEYS[i];
      if (text.startsWith(glyph + ' ')) {
        prefix = glyph;
        name = glyphNames.get(glyph);
        break;
      }
    }
  }
  if (!name) { node.textContent = text; return; }
  node.appendChild(createIconSvg(name));
  if (prefix && prefix !== text) node.appendChild(document.createTextNode(text.slice(prefix.length)));
}
