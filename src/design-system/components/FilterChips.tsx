import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface FilterChip<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: ReactNode;
}

/**
 * One row of pill buttons that pick what a list shows (All, Recent, Favorites…). It
 * scrolls sideways instead of wrapping, so it stays one tidy line on phones.
 */
export function FilterChips<T extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: {
  label: string;
  items: FilterChip<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        '-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0',
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:bg-surface-muted not-aria-pressed:text-fg-muted not-aria-pressed:hover:text-fg max-md:h-10 [&_svg]:size-4"
        >
          {item.icon && <span aria-hidden="true">{item.icon}</span>}
          {item.label}
          {item.count !== undefined && <span className="text-xs">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
