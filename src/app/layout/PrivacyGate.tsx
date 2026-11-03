import { lazy, Suspense, useEffect, useState } from 'react';
import { hasAcceptedPolicy, PRIVACY_ACCEPTED_KEY } from '@/features/privacy/consent';

// The policy text and agreement screen are only downloaded when they're needed.
const PrivacyConsent = lazy(() => import('@/features/privacy/PrivacyConsent'));

/**
 * Asks for agreement to the privacy policy on first use (and after the policy changes).
 * The check is synchronous, so the app never shows before the screen does.
 */
export function PrivacyGate({ ready }: { ready: boolean }) {
  const [accepted, setAccepted] = useState(hasAcceptedPolicy);

  // Agreed in another tab: let this one in too.
  useEffect(() => {
    if (accepted) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === PRIVACY_ACCEPTED_KEY && hasAcceptedPolicy()) setAccepted(true);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [accepted]);

  if (accepted) return null;
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[85] bg-bg" />}>
      <PrivacyConsent ready={ready} onAccept={() => setAccepted(true)} />
    </Suspense>
  );
}
