import type { ReactNode } from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToasts } from './toastStore';

const icons = { success: CheckCircle2, error: CircleAlert, info: Info };
const iconTone = { success: 'text-success', error: 'text-danger', info: 'text-info' };

/**
 * The one notification area: above the phone bottom bar, or at the bottom on desktop.
 * `children` are longer-lived notices (e.g. "new version ready") stacked above the toasts
 * so nothing overlaps.
 */
export function Toaster({ children }: { children?: ReactNode }) {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 md:bottom-6 [&>*]:pointer-events-auto"
    >
      {children}
      {toasts.map((t) => {
        const Icon = icons[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-md animate-fade-in items-center gap-3 rounded-2xl border border-line bg-surface-raised py-2.5 pr-2 pl-4 shadow-soft-lg"
          >
            <Icon className={cn('size-5 shrink-0', iconTone[t.tone])} aria-hidden="true" />
            <p className="flex-1 text-sm font-semibold">{t.message}</p>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  dismiss(t.id);
                  void t.action!.onClick();
                }}
                className="h-9 rounded-xl px-3 text-sm font-bold text-link hover:bg-primary-soft max-md:h-11"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="flex size-9 items-center justify-center rounded-full text-fg-muted hover:bg-surface-muted max-md:size-11"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
