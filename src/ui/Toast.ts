import { el, retrigger } from './HUD';
import { setIconText } from './Icons';

export type ToastTone = 'good' | 'bad' | 'info';

const MAX_VISIBLE = 1;
const LIFE = 2.6;
const OUT = 0.22;

/** Temizlik uyarısının imzası — bu glif + 'bad' tonu daha güçlü kehribar olur. */
const CLEAN_GLYPH = '🧹';

interface Slot {
  root: HTMLDivElement;
  glyph: HTMLSpanElement;
  text: HTMLSpanElement;
  t: number;
  live: boolean;
  out: boolean;
  tone: string;
  clean: boolean;
}

/** Alt-orta bildirim yığını. Düğümler havuzlanır, aynı anda yalnız bir tanesi görünür. */
export class ToastStack {
  readonly root: HTMLDivElement;
  private readonly slots: Slot[] = [];
  private readonly pending: {text: string; glyph?: string; tone: ToastTone}[] = [];

  constructor(size = 6) {
    this.root = el('div', 'toasts');
    for (let i = 0; i < size; i++) {
      const node = el('div', 'toast');
      const glyph = el('span', 'toast-g', '');
      const text = el('span', 'toast-t', '');
      node.appendChild(glyph);
      node.appendChild(text);
      this.root.appendChild(node);
      this.slots.push({
        root: node,
        glyph,
        text,
        t: 0,
        live: false,
        out: false,
        tone: '',
        clean: false,
      });
    }
  }

  push(text: string, glyph?: string, tone: ToastTone = 'good'): void {
    if (this.slots.some(slot => slot.live && slot.text.textContent === text)) return;
    if (this.slots.some(s => s.live)) {
      if (!this.pending.some(p => p.text === text)) {
        if (this.pending.length >= 4) this.pending.shift();
        this.pending.push({text, glyph, tone});
      }
      return;
    }
    // görünür sayı sınırı: en eskisini erken kapat
    let liveCount = 0;
    let oldest: Slot | null = null;
    for (const s of this.slots) {
      if (!s.live || s.out) continue;
      liveCount++;
      if (!oldest || s.t > oldest.t) oldest = s;
    }
    if (liveCount >= MAX_VISIBLE && oldest) {
      oldest.out = true;
      oldest.t = LIFE;
      oldest.root.classList.add('out');
    }

    const slot = this.take();
    slot.text.textContent = text;
    if (glyph) {
      setIconText(slot.glyph, glyph);
      slot.glyph.style.display = '';
    } else {
      slot.glyph.textContent = '';
      slot.glyph.style.display = 'none';
    }
    if (slot.tone !== tone) {
      slot.root.classList.remove('good', 'bad', 'info');
      slot.root.classList.add(tone);
      slot.tone = tone;
    }
    // Temizlik ipuçları genel uyarılardan ayrışsın: kehribar gövde + süpürge tıkırtısı.
    const clean = tone === 'bad' && glyph === CLEAN_GLYPH;
    if (slot.clean !== clean) {
      slot.clean = clean;
      slot.root.classList.toggle('clean', clean);
    }
    slot.root.classList.remove('out');
    slot.root.classList.add('show');
    slot.t = 0;
    slot.live = true;
    slot.out = false;
    // en yeni en altta dursun
    this.root.appendChild(slot.root);
    retrigger(slot.root, 'in-a', 'in-b');
  }

  private take(): Slot {
    for (const s of this.slots) if (!s.live) return s;
    // hepsi doluysa en eskisini geri dönüştür
    let oldest = this.slots[0];
    for (const s of this.slots) if (s.t > oldest.t) oldest = s;
    return oldest;
  }

  update(dt: number): void {
    if (!this.slots.some(s => s.live) && this.pending.length) {
      const next = this.pending.shift()!;
      this.push(next.text, next.glyph, next.tone);
    }
    for (const s of this.slots) {
      if (!s.live) continue;
      s.t += dt;
      if (!s.out && s.t >= LIFE) {
        s.out = true;
        s.root.classList.add('out');
      } else if (s.out && s.t >= LIFE + OUT) {
        s.live = false;
        s.out = false;
        s.root.classList.remove('show', 'out');
      }
    }
  }

  dispose(): void {
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }
}
