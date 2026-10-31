import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button, Card, CardHeader, Field, Input, Select, toast } from '@/design-system';
import { setSetting, useSetting } from '@/data/repos/settings';
import { hashPin, PIN_PATTERN, verifyPin } from '@/lib/pin';
import { useLockStore, writeLockHint } from '@/stores/lockStore';

type Mode = null | 'set' | 'change' | 'off';
type LockAfter = 0 | 1 | 5 | 15;

const pinInput =
  (value: string, onChange: (v: string) => void) =>
  (p: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => (
    <Input
      {...p}
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={8}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
    />
  );

/** Settings → App lock: an optional PIN screen. Honest about what it does and doesn't do. */
export function AppLockCard() {
  const record = useSetting('appLock');
  const [mode, setMode] = useState<Mode>(null);
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMode(null);
    setCurrent('');
    setPin('');
    setConfirm('');
    setError(undefined);
  };

  const submit = async () => {
    setError(undefined);
    setBusy(true);
    try {
      if (
        (mode === 'change' || mode === 'off') &&
        !(record && (await verifyPin(current, record)))
      ) {
        setError('That’s not your current PIN.');
        return;
      }
      if (mode === 'off') {
        await setSetting('appLock', null);
        writeLockHint(false);
        toast({ message: 'App lock is off' });
        reset();
        return;
      }
      if (!PIN_PATTERN.test(pin)) {
        setError('Use 4 to 8 digits.');
        return;
      }
      if (pin !== confirm) {
        setError("The PINs don't match.");
        return;
      }
      const hashed = await hashPin(pin);
      await setSetting('appLock', { ...hashed, lockAfterMinutes: record?.lockAfterMinutes ?? 1 });
      writeLockHint(true);
      toast({ message: mode === 'change' ? 'PIN changed' : 'App lock is on' });
      reset();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="App lock" icon={<Lock />} />
      <p className="mb-3 text-sm text-fg-muted">
        Asks for a PIN when you open Jasminum, so someone picking up your device can't browse it.
        It's a privacy screen, not encryption: it doesn't scramble your data. There's no way to
        recover a forgotten PIN except erasing this site's data, so keep a backup.
      </p>

      {mode === null ? (
        record ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="lock-after" className="font-semibold">
                Lock when away for
              </label>
              <Select
                id="lock-after"
                className="w-48"
                value={String(record.lockAfterMinutes)}
                onChange={(e) =>
                  void setSetting('appLock', {
                    ...record,
                    lockAfterMinutes: Number(e.target.value) as LockAfter,
                  })
                }
              >
                <option value="0">Immediately</option>
                <option value="1">1 minute</option>
                <option value="5">5 minutes</option>
                <option value="15">15 minutes</option>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => useLockStore.getState().lock()}>
                Lock now
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode('change')}>
                Change PIN
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode('off')}>
                Turn off
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setMode('set')}>
            Turn on app lock
          </Button>
        )
      ) : (
        <form
          className="space-y-3 rounded-xl bg-surface-muted p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {(mode === 'change' || mode === 'off') && (
            <Field label="Current PIN">{pinInput(current, setCurrent)}</Field>
          )}
          {mode !== 'off' && (
            <>
              <Field label={mode === 'change' ? 'New PIN' : 'PIN'} hint="4 to 8 digits.">
                {pinInput(pin, setPin)}
              </Field>
              <Field label="Type it again">{pinInput(confirm, setConfirm)}</Field>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {mode === 'off' ? 'Turn off app lock' : mode === 'change' ? 'Change PIN' : 'Turn on'}
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
