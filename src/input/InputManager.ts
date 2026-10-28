import { clamp, clamp01 } from '../core/MathUtils';

export interface MoveInput {
  /** -1..1, ekran sağı */
  x: number;
  /** -1..1, ekran yukarısı */
  y: number;
  /** 0..1 büyüklük (ölü bölge yeniden eşlenmiş, tepki eğrisi uygulanmış) */
  mag: number;
  active: boolean;
}

/**
 * Ölü bölge. Sert kesme yerine YENİDEN EŞLEME yapılır: eşiğin hemen üstünde
 * 0'dan başlayıp büyür. Sert kesmede parmak eşiği geçtiği an karakter
 * 0'dan %14 hıza sıçrıyordu.
 */
const DEAD_ZONE = 0.075;

/** Parmak jitter'ını süzen yumuşatma (120Hz ve 60Hz ekranlarda çevik tepki için 20ms). */
const SMOOTH_TIME = 0.020;

/**
 * Klavye + dokunmatik girişini tek bir yön vektörüne indirger.
 *
 * GÖRÜNMEZ SÜRÜKLEME — sabit ya da yüzen bir joystick GÖRSELİ yoktur.
 * Ekranın HERHANGİ bir noktasına (HUD öğeleri hariç, `[data-ui]` ile
 * korunur) dokunup sürüklemek karakteri yürütür; parmağın nerede olduğunu
 * gösteren bir taban/topuz çizilmez. Bu bilinçli bir tercih: görünür
 * joystick hem ekranın belirli bir bölgesine hapsedilmeye ("başparmak
 * bölgesi" kısıtı) hem de HUD'un üstüne taşmamak için kelepçelenmeye
 * ihtiyaç duyuyordu — ikisi de kaldırıldı, "her yerden hareket edilsin"
 * isteğiyle. Parmak yarıçapı aştığında MERKEZ PARMAĞI TAKİP EDER (aşağıdaki
 * dinamik yeniden-merkezleme): sabit merkezli joystick'te oyuncu parmağını
 * 200 px sağa götürüp 60 px geri çektiğinde hâlâ tam sağ okunuyordu —
 * kontrol "geç tepki veriyor" hissi veren en büyük kusur buydu. Görsel
 * gitse de bu matematik aynı kalır.
 */
export class InputManager {
  readonly move: MoveInput = { x: 0, y: 0, mag: 0, active: false };

  private keys = new Set<string>();
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private curX = 0;
  private curY = 0;
  private dragActive = false;
  /** Sürükleme yarıçapı — görsel değil, yalnızca hassasiyet ölçeği. */
  private radius = 62;

  /** Yumuşatılmış ham vektör (ekran uzayı). */
  private smoothX = 0;
  private smoothY = 0;

  private touchSeen = false;
  private enabled = true;

  private detach: (() => void)[] = [];
  onFirstInteraction: (() => void) | null = null;
  private firstDone = false;

  constructor(private surface: HTMLElement) {
    this.updateRadius();
    this.bind();
  }

  /**
   * Yarıçap ekran boyutuna göre ölçeklenir — küçük telefonda parmağın az
   * hareketiyle tam hız, tablette orantılı biraz daha fazla hareket gerekir.
   */
  private updateRadius(): void {
    const shortest = Math.min(window.innerWidth, window.innerHeight);
    this.radius = clamp(shortest * 0.135, 46, 92);
  }

  private bind(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      this.markInteraction();
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (MOVEMENT_KEYS.has(k) || MOVEMENT_KEYS.has(e.code)) {
        this.keys.add(normalizeKey(e));
        if (k.startsWith('arrow') || k === ' ') e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(normalizeKey(e));
    };
    const onBlur = () => this.keys.clear();

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.detach.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    });

    const onResize = () => this.updateRadius();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    this.detach.push(() => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    });

    const onDown = (e: PointerEvent) => {
      this.markInteraction();
      if (!this.enabled) return;
      if (this.pointerId !== null) return;
      const t = e.target as HTMLElement | null;
      if (t && t.closest('#ui-root, [data-ui]')) return;
      if (e.pointerType === 'touch') {
        this.touchSeen = true;
        // Sentetik fare olaylarını ve dokunma callout'larını engelle
        e.preventDefault();
      }
      this.pointerId = e.pointerId;
      this.originX = e.clientX;
      this.originY = e.clientY;
      this.curX = e.clientX;
      this.curY = e.clientY;
      this.smoothX = 0;
      this.smoothY = 0;
      this.dragActive = true;
      this.surface.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.curX = e.clientX;
      this.curY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.dragActive = false;
    };

    this.surface.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    const onContext = (e: Event) => e.preventDefault();
    this.surface.addEventListener('contextmenu', onContext);
    this.detach.push(() => {
      this.surface.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      this.surface.removeEventListener('contextmenu', onContext);
    });

    // iOS'ta çift dokunuş/kıstırma ile zoom'u engelle.
    const preventGesture = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', preventGesture);
    document.addEventListener('gesturechange', preventGesture);
    this.detach.push(() => {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
    });
  }

  private markInteraction(): void {
    if (this.firstDone) return;
    this.firstDone = true;
    this.onFirstInteraction?.();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      this.pointerId = null;
      this.dragActive = false;
      this.smoothX = 0;
      this.smoothY = 0;
    }
  }

  get isTouch(): boolean {
    return this.touchSeen;
  }

  update(dt: number): MoveInput {
    let x = 0;
    let y = 0;

    if (this.dragActive) {
      let dx = this.curX - this.originX;
      let dy = this.curY - this.originY;
      const len = Math.hypot(dx, dy);

      // DİNAMİK MERKEZ: parmak yarıçapı aştıysa merkez peşinden sürüklenir,
      // böylece geri çekiş anında tepki verir. Viewport sınırına hafifçe
      // kelepçeli — salt sayısal savunma, görsel bir taşma söz konusu değil.
      if (len > this.radius) {
        const pull = (len - this.radius) / len;
        this.originX = clamp(this.originX + dx * pull, 0, window.innerWidth);
        this.originY = clamp(this.originY + dy * pull, 0, window.innerHeight);
        dx = this.curX - this.originX;
        dy = this.curY - this.originY;
      }

      const k = dt > 0 ? 1 - Math.exp(-dt / SMOOTH_TIME) : 1;
      this.smoothX += (dx / this.radius - this.smoothX) * k;
      this.smoothY += (dy / this.radius - this.smoothY) * k;
      x = this.smoothX;
      y = -this.smoothY; // ekran y'si aşağı pozitif
    } else {
      this.smoothX = 0;
      this.smoothY = 0;
      if (this.keys.has('left')) x -= 1;
      if (this.keys.has('right')) x += 1;
      if (this.keys.has('up')) y += 1;
      if (this.keys.has('down')) y -= 1;
    }

    const raw = Math.hypot(x, y);
    if (raw <= 1e-4) {
      this.move.x = 0;
      this.move.y = 0;
      this.move.mag = 0;
      this.move.active = false;
      return this.move;
    }

    // Ölü bölgeyi yeniden eşle: eşikte 0'dan başla, 1'de 1'e ulaş.
    const remapped = clamp01((Math.min(raw, 1) - DEAD_ZONE) / (1 - DEAD_ZONE));
    if (remapped <= 0) {
      this.move.x = 0;
      this.move.y = 0;
      this.move.mag = 0;
      this.move.active = false;
      return this.move;
    }

    // Hafif tepki eğrisi: düşük itişte ince kontrol, tam itişte tam hız.
    const mag = remapped * (0.72 + 0.28 * remapped);
    this.move.x = (x / raw) * mag;
    this.move.y = (y / raw) * mag;
    this.move.mag = mag;
    this.move.active = true;
    return this.move;
  }

  dispose(): void {
    for (const d of this.detach) d();
    this.detach.length = 0;
  }
}

const MOVEMENT_KEYS = new Set([
  'w', 'a', 's', 'd',
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

function normalizeKey(e: KeyboardEvent): string {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      return 'up';
    case 'KeyS':
    case 'ArrowDown':
      return 'down';
    case 'KeyA':
    case 'ArrowLeft':
      return 'left';
    case 'KeyD':
    case 'ArrowRight':
      return 'right';
  }
  switch (e.key.toLowerCase()) {
    case 'w':
      return 'up';
    case 's':
      return 'down';
    case 'a':
      return 'left';
    case 'd':
      return 'right';
  }
  return e.key.toLowerCase();
}
