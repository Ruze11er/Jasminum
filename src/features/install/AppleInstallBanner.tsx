import { useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { IconButton, Sheet } from '@/design-system';
import { useInstallMethod } from '@/platform/install';
import { InstallSteps } from './InstallSteps';

const DISMISSED_KEY = 'jasminum:apple-install-banner-dismissed';

const wasDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * iPhone and iPad in a Safari tab: Safari may delete a website's data after about a week
 * without visits; Home Screen apps are exempt. A gentle, dismissible nudge to install.
 */
export function AppleInstallBanner() {
  const method = useInstallMethod();
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [open, setOpen] = useState(false);
  if (method !== 'apple' || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Private mode: it just shows again next time.
    }
  };

  return (
    <>
      <div
        role="region"
        aria-label="Install Jasminum"
        className="mb-4 flex items-center gap-3 rounded-2xl bg-primary-soft p-3 text-primary-soft-fg"
      >
        <Smartphone className="size-5 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm font-semibold">
          Add Jasminum to your Home Screen to keep your data safe.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold underline max-md:min-h-11"
        >
          How?
        </button>
        <IconButton label="Hide this tip" icon={<X />} onClick={dismiss} className="-mr-1 size-9" />
      </div>
      <Sheet open={open} onOpenChange={setOpen} title="Add to Home Screen">
        <div className="pb-4">
          <InstallSteps />
        </div>
      </Sheet>
    </>
  );
}
