import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need a text label for screen readers. */
  label: string;
  icon: ReactNode;
  variant?: 'ghost' | 'soft' | 'primary';
}

const variants = {
  ghost: 'text-fg-muted hover:bg-surface-muted hover:text-fg',
  soft: 'bg-primary-soft text-primary-soft-fg hover:bg-primary-soft-hover',
  primary: 'bg-primary text-on-primary hover:bg-primary-hover shadow-soft-md',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', className, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors max-md:size-11',
        'disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-5',
        variants[variant],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
});
