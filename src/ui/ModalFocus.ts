/** Keeps keyboard and assistive navigation inside an open sheet. */
export const CONTROL_SELECTOR = 'button, a[href], input, select, textarea, summary, [tabindex]';
export class ModalFocus {
  private previous: HTMLElement | null = null;
  private active = false;
  private readonly onKey = (event: KeyboardEvent): void => {
    if (!this.active || event.key !== 'Tab') return;
    const controls = [...this.root.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)].filter(node =>
      node.tabIndex >= 0 && !node.matches(':disabled, [hidden]') && !node.closest('[inert]') && node.getClientRects().length > 0);
    const first = controls[0] ?? this.initial;
    const last = controls[controls.length - 1] ?? this.initial;
    const focused = document.activeElement;
    if (!this.root.contains(focused) || (event.shiftKey ? focused === first || focused === this.initial : focused === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  };
  constructor(private readonly root: HTMLElement, private readonly initial: HTMLElement) {
    root.inert = true;
    root.setAttribute('aria-hidden', 'true');
    document.addEventListener('keydown', this.onKey);
  }
  open(): void {
    if (!this.active) this.previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.active = true;
    this.root.inert = false;
    this.root.removeAttribute('aria-hidden');
    this.initial.focus({ preventScroll: true });
  }
  close(): void {
    if (!this.active) return;
    this.active = false;
    this.root.inert = true;
    this.root.setAttribute('aria-hidden', 'true');
    if (this.previous?.isConnected && !this.previous.closest('[inert]')) this.previous.focus({ preventScroll: true });
    this.previous = null;
  }
  dispose(): void {
    this.active = false;
    this.previous = null;
    document.removeEventListener('keydown', this.onKey);
  }
}
