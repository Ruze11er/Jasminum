import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

const fieldBase =
  'w-full rounded-xl border-[1.5px] border-line bg-surface px-3.5 text-fg placeholder:text-fg-subtle ' +
  'transition-[border-color,box-shadow] outline-none ' +
  'focus:border-brand focus:ring-[3px] focus:ring-ring ' +
  'aria-[invalid=true]:border-danger disabled:opacity-60';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leadingIcon, ...props },
  ref,
) {
  if (!leadingIcon) {
    return <input ref={ref} className={cn(fieldBase, 'h-11', className)} {...props} />;
  }
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle [&>svg]:size-[18px]">
        {leadingIcon}
      </span>
      <input ref={ref} className={cn(fieldBase, 'h-11 pl-10', className)} {...props} />
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-24 py-2.5', className)} {...props} />;
});

/** Label + control + optional hint/error, wired up for screen readers. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }) => ReactNode;
}) {
  const id = useId();
  const descId = hint || error ? `${id}-desc` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-fg">
        {label}
      </label>
      {children({ id, 'aria-describedby': descId, 'aria-invalid': error ? true : undefined })}
      {(hint || error) && (
        <p id={descId} className={cn('text-sm', error ? 'text-danger' : 'text-fg-muted')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
