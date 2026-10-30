import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Bottom sheet on phones, centered dialog on larger screens.
 * Built on Radix Dialog for focus trapping, Escape to close and screen-reader support.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-pink-900/25 backdrop-blur-[2px] data-[state=open]:animate-fade-in dark:bg-black/50" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex max-h-[90dvh] flex-col bg-surface-raised text-fg shadow-soft-lg outline-none',
            // phone: bottom sheet
            'inset-x-0 bottom-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))] data-[state=open]:animate-sheet-up',
            // tablet/desktop: centered dialog
            'md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg md:rounded-3xl md:pb-0 md:data-[state=open]:animate-zoom-in',
            className,
          )}
        >
          <div
            className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line md:hidden"
            aria-hidden="true"
          />
          <div className="flex items-start gap-3 px-5 pt-4 pb-2 md:px-6 md:pt-6">
            <div className="flex-1">
              <Dialog.Title className="font-display text-xl font-bold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-fg-muted">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mt-1 -mr-2 flex size-10 items-center justify-center rounded-full text-fg-muted hover:bg-surface-muted hover:text-fg"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 md:px-6 md:pb-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
