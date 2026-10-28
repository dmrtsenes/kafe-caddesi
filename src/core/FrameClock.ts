import { stableRefreshRate } from './RenderBudget';

/** FPS belongs to the budget that produced it. A menu's 10 FPS must never be
 * judged against the resumed game's 60 FPS target. Zero means not sampled yet. */
export class FrameRateMeter {
  private target = 0;
  private start = 0;
  private frames = 0;
  private fps = 0;

  reset(): void { this.target = 0; this.start = this.frames = this.fps = 0; }

  sample(now: number, target: number): number {
    if (target !== this.target || now < this.start) {
      this.target = target;
      this.start = now;
      this.frames = this.fps = 0;
      return 0;
    }
    this.frames++;
    const elapsed = now - this.start;
    if (elapsed >= 1000) {
      this.fps = this.frames * 1000 / elapsed;
      this.frames = 0;
      this.start = now;
    }
    return this.fps;
  }
}

/** A wall-clock ceiling; callback frequency must never increase the selected FPS. */
export class FramePacer {
  private next = 0;
  private target = 0;
  private last = Number.NEGATIVE_INFINITY;

  reset(now: number): void { this.next=now; this.target=0; this.last=Number.NEGATIVE_INFINITY; }

  due(now: number, fps: number): boolean {
    if (!(fps > 0)) return true;
    const interval=1000/fps;
    if (fps !== this.target) {
      this.target=fps;
      this.next=Number.isFinite(this.last)?this.last+interval:now;
    }
    // rAF timestamps can land slightly before a vsync deadline due to browser scheduling.
    // Allow a realistic jitter margin (up to 1.5ms) so mobile does not drop every other frame.
    const tolerance = Math.min(1.5, interval * 0.06);
    if (now + tolerance < this.next) return false;
    this.last=now;
    if (now-this.next > interval) this.next=now+interval;
    else this.next+=interval;
    return true;
  }
}

/** Infer panel cadence from the faster samples, excluding work-induced missed vsyncs. */
export class RefreshRateEstimator {
  private readonly samples = new Float64Array(60);
  private readonly sorted = new Float64Array(60);
  private count=0;
  private cursor=0;
  private previous=0;
  private hz=60;

  reset(fallback: number): void {
    this.hz=fallback; this.previous=0; this.count=this.cursor=0;
    this.samples.fill(Number.POSITIVE_INFINITY);
  }

  sample(now: number): number {
    const gap=this.previous>0?now-this.previous:0;
    this.previous=now;
    // 240 Hz has 4.17 ms callbacks; ignoring gaps below 6 ms misread it as 90 Hz.
    if (gap >= 3 && gap <= 25) {
      this.samples[this.cursor]=gap;
      this.cursor=(this.cursor+1)%this.samples.length;
      this.count=Math.min(this.count+1,this.samples.length);
      if (this.count>=12 && this.cursor%12===0) {
        this.sorted.set(this.samples);
        this.sorted.sort();
        this.hz=stableRefreshRate(Math.min(240,Math.max(40,1000/this.sorted[Math.floor(this.count*.2)])));
      }
    }
    return this.hz;
  }
}
