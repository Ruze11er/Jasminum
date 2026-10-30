import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  tone?: 'default' | 'muted' | 'pink';
}

const tones = {
  default: 'bg-surface border-line',
  muted: 'bg-surface-muted border-transparent',
  pink: 'bg-primary-soft border-transparent text-primary-soft-fg',
};

export function Card({ interactive, tone = 'default', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 shadow-soft-sm md:p-5',
        tones[tone],
        interactive && 'cursor-pointer transition-shadow hover:shadow-soft-md',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-center gap-2', className)}>
      {icon && (
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg [&>svg]:size-4">
          {icon}
        </span>
      )}
      <h2 className="flex-1 text-base">{title}</h2>
      {action}
    </div>
  );
}
