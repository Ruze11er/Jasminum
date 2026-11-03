import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Checkbox } from '@/design-system';
import { LogoMark } from '@/app/Logo';
import { clock } from '@/lib/clock';
import { writeAcceptance } from './consent';
import { PolicySections, PolicySummary } from './PolicyContent';
import { policyUpdatedLabel } from './version';

/**
 * The first-run privacy agreement: read the policy, tick the box, press "I agree".
 * Covers the whole app until then. Loaded on demand by `PrivacyGate`.
 */
export default function PrivacyConsent({
  ready,
  onAccept,
}: {
  /** False while the welcome splash is on top: a tap to skip it mustn't land in here. */
  ready: boolean;
  onAccept: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const policy = useRef<HTMLDivElement>(null);

  // Like the app lock: everything else on the page is inert, so it can't be reached by
  // keyboard or screen reader until the policy is accepted.
  useEffect(() => {
    const others = [...document.body.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !el.contains(layer.current),
    );
    for (const el of others) el.inert = true;
    return () => {
      for (const el of others) el.inert = false;
    };
  }, []);

  // Focus the policy once it can be used, so arrow keys scroll it straight away.
  useEffect(() => {
    if (ready) policy.current?.focus();
  }, [ready]);

  const accept = () => {
    if (!agreed) return;
    writeAcceptance(clock.now());
    onAccept();
  };

  return createPortal(
    <div
      ref={layer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-consent-title"
      aria-describedby="privacy-consent-intro"
      inert={!ready}
      className="fixed inset-0 z-[85] flex justify-center bg-bg px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8 md:py-8"
    >
      <form
        className="flex min-h-0 w-full max-w-2xl flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          accept();
        }}
      >
        <header className="flex items-center gap-3">
          <LogoMark className="size-11 shrink-0 md:size-12" />
          <div>
            <h1 id="privacy-consent-title" className="text-2xl">
              Welcome to Jasminum
            </h1>
            <p id="privacy-consent-intro" className="text-fg-muted">
              Before you start, please read how your data is handled.
            </p>
          </div>
        </header>

        <div
          ref={policy}
          role="region"
          aria-label="Privacy Policy"
          tabIndex={0}
          className="min-h-0 flex-1 space-y-6 overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-soft-sm outline-none focus-visible:ring-2 focus-visible:ring-primary md:p-6"
        >
          <div>
            <h2 className="text-xl">Privacy Policy</h2>
            <p className="text-sm text-fg-muted">Last updated {policyUpdatedLabel()}</p>
          </div>
          <PolicySummary />
          <PolicySections links={false} />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Checkbox
            label="I have read and agree to the Privacy Policy"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="min-h-11 flex-1"
          />
          <Button type="submit" disabled={!agreed} className="max-md:w-full">
            I agree
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
