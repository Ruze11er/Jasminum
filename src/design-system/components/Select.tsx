import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Styled native <select>. Native pickers are the most accessible option and give phones
 * their own familiar wheel/list UI.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className={cn('relative', className)}>
        <select
          ref={ref}
          className={cn(
            'h-11 w-full cursor-pointer appearance-none rounded-xl border-[1.5px] border-line bg-surface pr-9 pl-3.5 text-fg',
            'transition-[border-color,box-shadow] outline-none focus:border-brand focus:ring-[3px] focus:ring-ring',
            'disabled:opacity-60',
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted"
          aria-hidden="true"
        />
      </div>
    );
  },
);
