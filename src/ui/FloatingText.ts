import { el } from './HUD';
import { easeOutCubic } from '../core/MathUtils';

export type FloatTone = 'money' | 'item' | 'bad' | 'good';

const LIFE = 0.9;
const RISE = 70;

interface Slot {
  root: HTMLDivElement;
  span: HTMLSpanElement;
  x: number;
  y: number;
  drift: number;
  t: number;
  live: boolean;
  tone: string;
  text: string;
  alpha: number;
  /** Pop animasyonunu yeniden tetiklemek için a/b sınıfı dönüşümlü. */
  pop: boolean;
}

/**
 * Saniyede onlarca kez çağrılır: düğümler havuzlanır, kare başına yalnızca
 * transform + opacity yazılır (layout tetiklenmez).
 */
export class FloatingTextPool {
  readonly root: HTMLDivElement;
  private readonly slots: Slot[] = [];
  private cursor = 0;
  private liveCount = 0;

  constructor(size = 28) {
    this.root = el('div', 'floats');
    for (let i = 0; i < size; i++) {
      const node = el('div', 'ft money');
      const span = el('span');
      node.appendChild(span);
      this.root.appendChild(node);
      this.slots.push({
        root: node,
        span,
        x: 0,
        y: 0,
        drift: 0,
        t: 0,
        live: false,
        tone: 'money',
        text: '',
        alpha: 1,
        pop: false,
      });
    }
  }

  spawn(x: number, y: number, text: string, tone: FloatTone = 'money'): void {
    const s = this.take();
    if (s.text !== text) {
      s.text = text;
      s.span.textContent = text;
    }
    if (s.tone !== tone) {
      s.root.classList.remove(s.tone);
      s.root.classList.add(tone);
      s.tone = tone;
    }
    s.x = x;
    s.y = y;
    s.drift = (Math.random() * 2 - 1) * 16;
    s.t = 0;
    s.alpha = 1;
    s.root.style.opacity = '1';
    // Kökte scale YOK (netlik notu ui.css'te); pop, span'deki keyframe'de.
    s.root.style.transform = 'translate3d(' + (x | 0) + 'px,' + (y | 0) + 'px,0)';
    s.pop = !s.pop;
    s.root.classList.toggle('ft-pop-a', s.pop);
    s.root.classList.toggle('ft-pop-b', !s.pop);
    if (!s.live) {
      s.live = true;
      this.liveCount++;
      s.root.classList.add('live');
    }
  }

  private take(): Slot {
    const n = this.slots.length;
    for (let i = 0; i < n; i++) {
      const s = this.slots[(this.cursor + i) % n];
      if (!s.live) {
        this.cursor = (this.cursor + i + 1) % n;
        return s;
      }
    }
    // havuz doluysa en eskisini çal
    let oldest = this.slots[0];
    for (let i = 1; i < n; i++) if (this.slots[i].t > oldest.t) oldest = this.slots[i];
    return oldest;
  }

  update(dt: number): void {
    if (this.liveCount === 0) return;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.live) continue;
      s.t += dt;
      if (s.t >= LIFE) {
        s.live = false;
        this.liveCount--;
        s.root.classList.remove('live');
        continue;
      }
      const k = s.t / LIFE;
      const px = (s.x + s.drift * k) | 0;
      const py = (s.y - RISE * easeOutCubic(k)) | 0;
      s.root.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';

      const a = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      if (a < s.alpha - 0.03 || a > s.alpha + 0.03) {
        s.alpha = a;
        s.root.style.opacity = a.toFixed(2);
      }
    }
  }

  dispose(): void {
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }
}
