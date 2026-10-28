import { el } from './HUD';
import { clamp01 } from '../core/MathUtils';

/**
 * PARA UÇMA YAYI
 *
 * Idle oyunların imza geri bildirimi: kazanılan para, kazanıldığı dünya
 * noktasından HUD'daki cüzdan rozetine doğru bir yay çizerek uçar ve
 * vardığında rozet zıplar. Oyuncunun "kazandım" hissini bu bağ kurar —
 * yalnızca sayının artması bunu vermez.
 *
 * Tamamen DOM katmanındadır, WebGL'e hiç dokunmaz. Düğümler havuzlanır ve
 * kare başına yalnızca `transform` + `opacity` yazılır, yani düzen
 * (layout) hiç tetiklenmez.
 */

const LIFE = 0.52;
/** Aynı anda uçabilecek en fazla jeton. */
const POOL = 30;

interface Coin {
  node: HTMLDivElement;
  live: boolean;
  t: number;
  delay: number;
  x0: number;
  y0: number;
  /** Yayın tepe noktası (kontrol noktası). */
  cx: number;
  cy: number;
  alpha: number;
  rot: number;
  rotSpeed: number;
}

export class CoinFlightPool {
  readonly root: HTMLDivElement;
  private coins: Coin[] = [];
  private cursor = 0;
  private liveCount = 0;
  /** Hedef (cüzdan rozeti) ekran koordinatı. */
  private tx = 60;
  private ty = 40;
  private onArrive: (() => void) | null = null;

  constructor() {
    this.root = el('div', 'coinfly');
    for (let i = 0; i < POOL; i++) {
      const node = el('div', 'cf');
      this.root.appendChild(node);
      this.coins.push({ node, live: false, t: 0, delay: 0, x0: 0, y0: 0, cx: 0, cy: 0, alpha: 1, rot: 0, rotSpeed: 0 });
    }
  }

  /** Cüzdan rozetinin ekrandaki yeri; pencere yeniden boyutlanınca tazelenir. */
  setTarget(x: number, y: number): void {
    this.tx = x;
    this.ty = y;
  }

  /** Jeton hedefe vardığında çağrılır (rozeti zıplatmak için). */
  setArriveHandler(fn: () => void): void {
    this.onArrive = fn;
  }

  /**
   * @param n Kaç jeton uçsun. Miktar büyüdükçe artar ama 6'yı geçmez —
   *          fazlası ekranı doldurur, okunurluğu düşürür.
   */
  spawn(x: number, y: number, n = 4): void {
    for (let i = 0; i < n; i++) {
      const c = this.take();
      c.t = 0;
      // Kademeli kalkış: hepsi aynı anda çıkarsa tek bir blob gibi görünür.
      c.delay = i * 0.04;
      c.x0 = x;
      c.y0 = y;
      /**
       * Kontrol noktası kaynağın YUKARISINDA ve hedefe doğru kaydırılmış:
       * jeton önce yukarı fırlar, sonra cüzdana düşer. Düz çizgi "uçuş"
       * hissi vermez.
       */
      c.cx = x + (this.tx - x) * 0.35 + (Math.random() - 0.5) * 70;
      c.cy = Math.min(y, this.ty) - 70 - Math.random() * 50;
      c.rot = (Math.random() - 0.5) * 35;
      c.rotSpeed = (Math.random() > 0.5 ? 1 : -1) * (140 + Math.random() * 100);
      c.alpha = 1;
      c.node.style.transform = 'translate3d(' + (x | 0) + 'px,' + (y | 0) + 'px,0) rotate(' + c.rot.toFixed(1) + 'deg) scale(1)';
      c.node.style.opacity = '1';
      c.node.classList.add('live');
    }
  }

  private take(): Coin {
    for (let i = 0; i < POOL; i++) {
      const c = this.coins[this.cursor];
      this.cursor = (this.cursor + 1) % POOL;
      if (!c.live) {
        c.live = true;
        this.liveCount++;
        return c;
      }
    }
    // Havuz dolu: en eskisini geri al.
    const c = this.coins[this.cursor];
    this.cursor = (this.cursor + 1) % POOL;
    return c;
  }

  update(dt: number): void {
    if (this.liveCount === 0) return;
    for (let i = 0; i < POOL; i++) {
      const c = this.coins[i];
      if (!c.live) continue;
      c.t += dt;
      const t = c.t - c.delay;
      if (t < 0) continue;
      if (t >= LIFE) {
        c.live = false;
        this.liveCount--;
        c.node.classList.remove('live');
        this.onArrive?.();
        continue;
      }
      const progress = clamp01(t / LIFE);
      // İlk %22'de yaylanarak yükselir, ardından mıknatıs gibi cüzdana hızla çekilir.
      const k = progress < 0.22
        ? (progress / 0.22) * 0.14
        : 0.14 + Math.pow((progress - 0.22) / 0.78, 1.85) * 0.86;

      // İkinci dereceden Bézier: (1-k)²·P0 + 2(1-k)k·C + k²·P1
      const u = 1 - k;
      const px = (u * u * c.x0 + 2 * u * k * c.cx + k * k * this.tx) | 0;
      const py = (u * u * c.y0 + 2 * u * k * c.cy + k * k * this.ty) | 0;
      // Fırlarken hafif büyür, cüzdana girerken hızla küçülür.
      const sc = progress < 0.2 ? 1 + progress * 1.1 : Math.max(0.55, 1.22 - 0.67 * progress);
      const rot = c.rot + k * c.rotSpeed;
      c.node.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0) rotate(' + rot.toFixed(1) + 'deg) scale(' + sc.toFixed(2) + ')';
      // Cüzdana toslayana kadar tam görünür kalır; son %4'lük temasta söner.
      const a = progress > 0.96 ? 1 - (progress - 0.96) / 0.04 : 1;
      if (a < c.alpha - 0.05 || a > c.alpha + 0.05) {
        c.alpha = a;
        c.node.style.opacity = a.toFixed(2);
      }
    }
  }

  dispose(): void {
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }
}
