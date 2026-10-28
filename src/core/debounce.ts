/**
 * Trailing-edge debounce. Collapses a burst of calls (window resize drag,
 * orientation animation) into one call `waitMs` after the last event.
 * `cancel()` must run on teardown so a pending timer cannot touch a disposed scene.
 */
export interface Debounced {
  (): void;
  cancel(): void;
}

export function debounce(fn: () => void, waitMs: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | 0 = 0;
  const run = (() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = 0;
      fn();
    }, waitMs);
  }) as Debounced;
  run.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = 0;
  };
  return run;
}
