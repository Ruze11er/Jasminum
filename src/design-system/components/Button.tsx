import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary shadow-soft-sm hover:bg-primary-hover',
  secondary: 'bg-primary-soft text-primary-soft-fg hover:bg-primary-soft-hover',
  ghost: 'text-fg-muted hover:bg-surface-muted hover:text-fg',
  danger: 'bg-danger text-on-danger shadow-soft-sm hover:brightness-95',
};

// Touch targets stay at least 44px tall on small screens.
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 max-md:h-11',
  md: 'h-10 px-4 text-[0.95rem] gap-2 max-md:h-11',
  lg: 'h-12 px-6 text-base gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, fullWidth, className, children, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl font-semibold whitespace-nowrap',
        'transition-[background-color,box-shadow,transform,filter] duration-150 active:scale-[0.98]',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {icon && <span className="flex size-[1.15em] items-center [&>svg]:size-full">{icon}</span>}
      {children}
    </button>
  );
});
