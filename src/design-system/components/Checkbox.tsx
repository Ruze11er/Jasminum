import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  /** Strike the label through when checked (used for tasks). */
  strikeWhenChecked?: boolean;
}

/** Round, soft checkbox built on a native input so keyboard and screen readers just work. */
export function Checkbox({ label, strikeWhenChecked, className, id, ...props }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label
      htmlFor={inputId}
      className={cn('group inline-flex cursor-pointer items-center gap-3 select-none', className)}
    >
      <span className="relative flex size-6 shrink-0 items-center justify-center">
        <input
          id={inputId}
          type="checkbox"
          className="peer absolute inset-0 size-6 cursor-pointer appearance-none rounded-full border-2 border-line-strong bg-surface transition-colors checked:border-primary checked:bg-primary hover:border-brand"
          {...props}
        />
        <Check
          strokeWidth={3.2}
          className="pointer-events-none relative size-3.5 text-on-primary opacity-0 peer-checked:animate-pop peer-checked:opacity-100"
        />
      </span>
      {label && (
        <span
          className={cn(
            'text-fg transition-colors',
            strikeWhenChecked &&
              'group-has-[:checked]:text-fg-subtle group-has-[:checked]:line-through',
          )}
        >
          {label}
        </span>
      )}
    </label>
  );
}
