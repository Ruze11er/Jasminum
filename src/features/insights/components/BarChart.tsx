import { useId } from 'react';
import { cn } from '@/lib/cn';
import type { Bar } from '../charts';

/**
 * A single-series bar chart in plain HTML (no chart library).
 * Following the dataviz rules: one validated color (--chart-1), thin marks capped at
 * 24px with 4px rounded data-ends, a hairline baseline, values labeled selectively (the
 * largest and the current period), a tooltip on hover and keyboard focus for every bar,
 * and a table view so nothing depends on color or hovering.
 */
export function BarChart({
  title,
  subtitle,
  bars,
  layout = 'columns',
  emptyText = 'Nothing to show yet.',
}: {
  title: string;
  subtitle?: string;
  bars: Bar[];
  layout?: 'columns' | 'rows';
  emptyText?: string;
}) {
  const id = useId();
  const max = Math.max(0, ...bars.map((b) => b.value));
  const labelled = (b: Bar) => b.value > 0 && (b.value === max || b.current);

  return (
    <figure aria-labelledby={`${id}-title`} className="space-y-3">
      <figcaption>
        <h3 id={`${id}-title`} className="font-sans text-base font-bold">
          {title}
        </h3>
        {subtitle && <p className="text-sm text-fg-muted">{subtitle}</p>}
      </figcaption>

      {max === 0 ? (
        <p className="rounded-xl bg-surface-muted px-4 py-6 text-center text-sm text-fg-muted">
          {emptyText}
        </p>
      ) : layout === 'columns' ? (
        <div>
          <ul aria-label={title} className="flex h-36 items-end border-b border-line">
            {bars.map((b) => (
              <li
                key={b.key}
                tabIndex={0}
                aria-label={b.description}
                className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none"
              >
                {labelled(b) && (
                  <span className="mb-1 text-xs font-bold text-fg" aria-hidden="true">
                    {b.value}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className="w-3/5 max-w-6 rounded-t-[4px] bg-chart-1 group-focus-visible:ring-[3px] group-focus-visible:ring-ring"
                  style={{ height: b.value ? `max(2px, ${(b.value / max) * 85}%)` : 0 }}
                />
                <Tooltip text={b.description} />
              </li>
            ))}
          </ul>
          <div aria-hidden="true" className="mt-1.5 flex">
            {bars.map((b) => (
              <span
                key={b.key}
                className={cn(
                  'flex-1 truncate px-0.5 text-center text-[0.7rem]',
                  b.current ? 'font-bold text-fg' : 'text-fg-muted',
                )}
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <ul aria-label={title} className="space-y-2">
          {bars.map((b) => (
            <li
              key={b.key}
              tabIndex={0}
              aria-label={b.description}
              className="group relative flex items-center gap-3 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              <span aria-hidden="true" className="w-28 shrink-0 truncate text-sm text-fg">
                {b.label}
              </span>
              <span aria-hidden="true" className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="h-4 rounded-r-[4px] bg-chart-1"
                  style={{ width: `max(2px, ${(b.value / max) * 85}%)` }}
                />
                <span className="text-sm font-bold text-fg">{b.value}</span>
              </span>
              <Tooltip text={b.description} />
            </li>
          ))}
        </ul>
      )}

      {max > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-link">Show as table</summary>
          <table className="mt-2 w-full text-left">
            <thead>
              <tr className="border-b border-line text-fg-muted">
                <th scope="col" className="py-1 font-semibold">
                  {layout === 'columns' ? 'When' : 'What'}
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Tasks done
                </th>
              </tr>
            </thead>
            <tbody>
              {bars.map((b) => (
                <tr key={b.key} className="border-b border-line last:border-0">
                  <th scope="row" className="py-1 font-normal">
                    {b.description.split(':')[0]}
                  </th>
                  <td className="py-1 text-right font-semibold">{b.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}

/** Shown on hover and keyboard focus. The same value is in the table, so it never gates. */
function Tooltip({ text }: { text: string }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-lg bg-fg px-2 py-1 text-xs font-semibold whitespace-nowrap text-bg opacity-0 shadow-soft-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {text}
    </span>
  );
}
