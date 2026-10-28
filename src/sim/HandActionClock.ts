/** One clock drives both the visible contact and the repeated item transfer. */
export class HandActionClock {
  private key: string | null = null;
  private elapsed = 0;
  private cycle = -1;
  phase = -1;

  reset(): void { this.key = null; this.elapsed = 0; this.cycle = -1; this.phase = -1; }

  contact(key: string, dt: number, duration: number): boolean {
    if (this.key !== key) { this.reset(); this.key = key; }
    const period = Math.max(0.08, duration);
    this.elapsed += Math.max(0, dt) / period;
    this.phase = this.elapsed % 1;
    // Keep the fractional remainder: rounding every cycle loses speed at 30 Hz.
    const contactCycle = Math.floor(this.elapsed + 0.52 + 1e-9) - 1;
    if (contactCycle <= this.cycle) return false;
    this.cycle = contactCycle;
    return true;
  }
}
