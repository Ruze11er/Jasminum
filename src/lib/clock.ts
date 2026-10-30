/**
 * The app's single source of "now". Logic that depends on time (trash expiry, insights,
 * recurrence, daily quotes) reads from here so tests can freeze or move time.
 */
let nowFn: () => number = () => Date.now();

export const clock = {
  now: (): number => nowFn(),
  /** Test helper: pass a fixed time (ms) or a function. Call `reset()` afterwards. */
  set(value: number | (() => number)) {
    nowFn = typeof value === 'number' ? () => value : value;
  },
  reset() {
    nowFn = () => Date.now();
  },
};

export const DAY_MS = 24 * 60 * 60 * 1000;
