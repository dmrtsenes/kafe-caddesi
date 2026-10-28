import { tr } from "../core/I18n";
import type { UiTutorialStep } from './api';
import { blockPointer, el } from './HUD';
import { sfx } from '../core/EventBus';

/**
 * Öğretici alt balonu. Hedef işaretleme BURADA DEĞİL: 3D ok + halka
 * (GuideMarker) tek yönlendirme dilidir — eskiden buradaki DOM 👇 ile
 * ikisi aynı anda iki ayrı yere işaret edebiliyordu.
 */
export class TutorialLayer {
  readonly root: HTMLDivElement;

  private readonly bubble: HTMLDivElement;
  private readonly textEl: HTMLDivElement;
  private readonly countEl: HTMLSpanElement;

  private lastText = '';
  private lastCount = '';
  private visible = false;

  constructor(onSkip: () => void) {
    this.root = el('div', 'ui-layer l-tut');

    this.bubble = el('div', 'tut');
    this.bubble.appendChild(el('div', 'tut-face', '🧢'));

    const body = el('div', 'tut-body');
    const top = el('div', 'tut-top');
    top.appendChild(el('span', 'tut-name', tr('Rehber')));
    this.countEl = el('span', 'tut-count', '');
    top.appendChild(this.countEl);
    body.appendChild(top);
    this.textEl = el('div', 'tut-text', '');
    this.textEl.setAttribute('role', 'status');
    this.textEl.setAttribute('aria-live', 'polite');
    this.textEl.setAttribute('aria-atomic', 'true');
    body.appendChild(this.textEl);
    this.bubble.appendChild(body);

    const skip = el('button', 'tut-skip', tr("Atla"));
    skip.type = 'button';
    skip.addEventListener('click', () => {
      sfx('ui_click');
      onSkip();
    });
    blockPointer(skip);
    this.bubble.appendChild(skip);
    this.root.appendChild(this.bubble);
  }

  setStep(step: UiTutorialStep | null): void {
    if (!step) {
      if (this.visible) {
        this.visible = false;
        this.bubble.classList.remove('on');
      }
      return;
    }
    if (step.text !== this.lastText) {
      this.lastText = step.text;
      this.textEl.textContent = step.text;
    }
    const c = `${step.index + 1}/${step.total}`;
    if (c !== this.lastCount) {
      this.lastCount = c;
      this.countEl.textContent = c;
    }
    if (!this.visible) {
      this.visible = true;
      this.bubble.classList.add('on');
    }
  }

  isActive(): boolean {
    return this.visible;
  }

  dispose(): void {
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }
}
