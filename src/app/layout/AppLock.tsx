import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock } from 'lucide-react';
import { Button, Input } from '@/design-system';
import { clock } from '@/lib/clock';
import { lockoutMs, verifyPin, type PinRecord } from '@/lib/pin';
import { useLockStore } from '@/stores/lockStore';
import { LogoMark } from '../Logo';

const ATTEMPTS_KEY = 'jasminum:lock-attempts';

interface Attempts {
  count: number;
  until: number;
}

const readAttempts = (): Attempts => {
  try {
    const v = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? 'null') as Attempts | null;
    return v && typeof v.count === 'number' ? v : { count: 0, until: 0 };
  } catch {
    return { count: 0, until: 0 };
  }
};
const writeAttempts = (a: Attempts) => {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(a));
  } catch {
    // Private mode: the wait only lasts for this visit.
  }
};

/** The lock screen: enter the PIN to continue. */
export function LockScreen({ record }: { record: PinRecord | null | undefined }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(readAttempts);
  const [now, setNow] = useState(() => clock.now());
  const inputId = useId();
  const waitMs = Math.max(0, attempts.until - now);

  useEffect(() => {
    if (waitMs <= 0) return;
    const t = setInterval(() => setNow(clock.now()), 1000);
    return () => clearInterval(t);
  }, [waitMs]);

  const submit = async () => {
    if (!record || waitMs > 0 || !pin) return;
    setChecking(true);
    const ok = await verifyPin(pin, record);
    setChecking(false);
    setPin('');
    if (ok) {
      writeAttempts({ count: 0, until: 0 });
      setAttempts({ count: 0, until: 0 });
      useLockStore.getState().unlock();
      return;
    }
    const count = attempts.count + 1;
    const next = { count, until: clock.now() + lockoutMs(count) };
    writeAttempts(next);
    setAttempts(next);
    setNow(clock.now());
    setError('Wrong PIN. Try again.');
  };

  // Everything else on the page (the app and any open dialogs) is made inert, so it can't
  // be reached by keyboard or screen reader. Open forms keep their unsaved input.
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const others = [...document.body.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !el.contains(layer.current),
    );
    for (const el of others) el.inert = true;
    return () => {
      for (const el of others) el.inert = false;
    };
  }, []);

  return createPortal(
    <div
      ref={layer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-bg p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <form
        className="w-full max-w-xs space-y-4 text-center"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <LogoMark className="mx-auto size-14" />
        <div>
          <h1 id="lock-title" className="flex items-center justify-center gap-2 text-2xl">
            <Lock className="size-5" aria-hidden="true" />
            Jasminum is locked
          </h1>
          <p className="mt-1 text-fg-muted">Enter your PIN to continue.</p>
        </div>
        <label htmlFor={inputId} className="sr-only">
          PIN
        </label>
        <Input
          id={inputId}
          autoFocus
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={pin}
          disabled={waitMs > 0}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''));
            setError(undefined);
          }}
          className="text-center text-2xl tracking-[0.5em]"
          aria-describedby={error || waitMs ? `${inputId}-msg` : undefined}
          aria-invalid={!!error}
        />
        {(error || waitMs > 0) && (
          <p id={`${inputId}-msg`} role="alert" className="text-sm font-semibold text-danger">
            {waitMs > 0 ? `Too many tries. Wait ${Math.ceil(waitMs / 1000)} seconds.` : error}
          </p>
        )}
        <Button type="submit" fullWidth disabled={!pin || checking || waitMs > 0 || !record}>
          Unlock
        </Button>
        <details className="text-left text-sm text-fg-muted">
          <summary className="cursor-pointer font-semibold">Forgot your PIN?</summary>
          <p className="mt-2">
            The lock can't be removed without the PIN. To start over, clear this site's data in your
            browser settings. That erases everything on this device, so restore a backup afterwards.
          </p>
        </details>
      </form>
    </div>,
    document.body,
  );
}
