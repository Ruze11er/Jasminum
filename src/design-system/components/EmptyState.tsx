import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Friendly placeholder with one clear next step. One of the few places decoration is allowed. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <div className="relative mb-4">
        <div className="flex size-16 items-center justify-center rounded-3xl bg-primary-soft text-primary-soft-fg [&>svg]:size-7">
          {icon}
        </div>
        <Sparkle className="absolute -top-2 -right-3 size-4 text-pink-300" />
        <Sparkle className="absolute -bottom-1 -left-3 size-3 text-pink-200 dark:text-pink-700" />
      </div>
      <h3 className="text-lg">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0Z" />
    </svg>
  );
}
