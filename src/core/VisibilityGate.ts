/** Merges DOM and native lifecycle signals into one suspend/resume interval. */
export class VisibilityGate {
  private dom = false;
  private native = false;
  private hidden = false;
  private since = 0;
  update(source: 'dom' | 'native', hidden: boolean, now: number): { hidden: boolean; awaySeconds: number } | null {
    this[source] = hidden;
    const next = this.dom || this.native;
    if (next === this.hidden) return null;
    this.hidden = next;
    if (next) { this.since = now; return { hidden: true, awaySeconds: 0 }; }
    const awaySeconds = Math.max(0, (now - this.since) / 1000);
    this.since = 0;
    return { hidden: false, awaySeconds };
  }
}
