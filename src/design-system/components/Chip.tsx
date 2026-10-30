import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { chipColorClasses as colors, type ChipColor } from './chipColors';

export function Chip({
  children,
  color = 'pink',
  icon,
  onRemove,
  className,
}: {
  children: ReactNode;
  color?: ChipColor;
  icon?: ReactNode;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-sm font-semibold [&>svg]:size-3.5',
        colors[color],
        className,
      )}
    >
      {icon}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${typeof children === 'string' ? children : 'tag'}`}
          className="-mr-1 ml-0.5 flex size-5 items-center justify-center rounded-full hover:bg-black/10"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}
