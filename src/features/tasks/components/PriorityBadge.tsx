import { Flag } from 'lucide-react';
import type { Priority } from '@/data/types';
import { cn } from '@/lib/cn';

const META: Record<Priority, { label: string; className: string } | null> = {
  0: null,
  1: { label: 'Low', className: 'bg-sky/50 text-sky-fg dark:bg-sky/15 dark:text-sky' },
  2: { label: 'Medium', className: 'bg-peach/55 text-peach-fg dark:bg-peach/15 dark:text-peach' },
  3: { label: 'High', className: 'bg-danger-soft text-danger' },
};

/** Flag icon plus a word, so priority never relies on color alone. */
export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = META[priority];
  if (!meta) return null;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-bold',
        meta.className,
      )}
    >
      <Flag className="size-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
