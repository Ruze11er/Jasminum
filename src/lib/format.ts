const units = ['B', 'KB', 'MB', 'GB', 'TB'];

/** 1536 → "1.5 KB". Uses 1024 steps, like file managers do. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

/** "3 days ago", "in 2 hours", "just now". */
export function formatRelative(ms: number, now: number): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  if (abs < 45_000) return 'just now';
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60_000],
    ['hour', 3_600_000],
    ['day', 86_400_000],
    ['week', 604_800_000],
    ['month', 2_592_000_000],
    ['year', 31_536_000_000],
  ];
  let chosen = steps[0]!;
  for (const step of steps) if (abs >= step[1]) chosen = step;
  return rtf.format(Math.round(diff / chosen[1]), chosen[0]);
}
