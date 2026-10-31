import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A button that opens the file picker. It's a <label> around a visually hidden input, so
 * the click is a real user gesture (required by Safari) and keyboard users can still tab
 * to the input.
 */
export function FilePickerButton({
  onFiles,
  children,
  className,
  accept,
  multiple = true,
}: {
  onFiles: (files: File[]) => void;
  children: ReactNode;
  className?: string;
  accept?: string;
  multiple?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn('cursor-pointer focus-within:ring-[3px] focus-within:ring-ring', className)}
    >
      <input
        id={id}
        type="file"
        multiple={multiple}
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ''; // so picking the same file again still fires
          onFiles(files);
        }}
      />
      {children}
    </label>
  );
}

/** Same look as the primary <Button>. */
export const primaryButtonClasses =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[0.95rem] font-semibold whitespace-nowrap text-on-primary shadow-soft-sm transition-colors hover:bg-primary-hover max-md:h-11 [&_svg]:size-[1.15em]';
