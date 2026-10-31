import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { Button, Card, Input, Sparkle, toast } from '@/design-system';
import { setSetting, useSetting } from '@/data/repos/settings';
import { clock } from '@/lib/clock';
import { firstIssue } from '@/lib/validation';
import { isStoragePersisted, requestPersistentStorage } from '@/platform/storage';
import { InstallSteps } from '@/features/install/InstallSteps';
import { addSamples, removeSamples } from '@/features/onboarding/sampleActions';

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-fg"
      >
        {done ? <CheckCircle2 className="size-4" /> : n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-semibold">
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </p>
        {children}
      </div>
    </li>
  );
}

/**
 * First-run welcome on Home: a gentle checklist (name, install, protect storage, where
 * data lives, optional examples) instead of a blocking wizard. Hidden for good once finished or skipped.
 */
export function WelcomeCard() {
  const onboarding = useSetting('onboarding');
  const profile = useSetting('profile');
  const sample = useSetting('sampleData');
  const [name, setName] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const nameId = useId();

  useEffect(() => {
    void isStoragePersisted().then(setPersisted);
  }, []);

  if (onboarding.completedAt !== null) return null;

  const saveName = async () => {
    try {
      await setSetting('profile', { displayName: name });
    } catch (err) {
      toast({ tone: 'error', message: firstIssue(err) ?? "Couldn't save your name" });
    }
  };
  const protect = async () => {
    const ok = await requestPersistentStorage();
    setPersisted(ok);
    toast({
      tone: ok ? 'success' : 'info',
      message: ok
        ? 'Storage protected'
        : 'The browser said not yet. Installing the app usually helps.',
    });
  };
  const finish = () => void setSetting('onboarding', { completedAt: clock.now() });

  return (
    <Card aria-labelledby="welcome-title" className="relative overflow-hidden">
      <Sparkle className="absolute top-4 right-5 size-4 text-pink-300" />
      <h2 id="welcome-title" className="text-xl">
        Welcome to Jasminum
      </h2>
      <p className="mt-1 text-fg-muted">A few things to get you set up. It takes half a minute.</p>

      <ol className="mt-4 space-y-4">
        <Step n={1} title="What should we call you?" done={!!profile.displayName}>
          {profile.displayName ? (
            <p className="text-sm text-fg-muted">Hi, {profile.displayName}!</p>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void saveName();
              }}
            >
              <label htmlFor={nameId} className="sr-only">
                Your name
              </label>
              <Input
                id={nameId}
                value={name}
                maxLength={40}
                placeholder="Your name (optional)"
                onChange={(e) => setName(e.target.value)}
              />
              <Button type="submit" variant="secondary" disabled={!name.trim()}>
                Save
              </Button>
            </form>
          )}
        </Step>

        <Step n={2} title="Install the app">
          <InstallSteps compact />
        </Step>

        <Step n={3} title="Protect your data" done={persisted === true}>
          {persisted ? (
            <p className="text-sm text-fg-muted">The browser won't clear it to free up space.</p>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              icon={<ShieldCheck />}
              onClick={() => void protect()}
            >
              Protect my data
            </Button>
          )}
        </Step>

        <Step n={4} title="Know where your data lives">
          <p className="text-sm text-fg-muted">
            Everything stays in this browser, on this device. Nothing is uploaded. A browser tab and
            the installed app can have separate storage, so pick one. Make a{' '}
            <Link to="/settings?backup=1" className="font-semibold text-link underline">
              backup
            </Link>{' '}
            now and then to keep it safe or move it to another device. Read the{' '}
            <Link to="/privacy" className="font-semibold text-link underline">
              privacy promise
            </Link>
            .
          </p>
        </Step>

        <Step n={5} title="Look around with examples (optional)" done={!!sample}>
          {sample ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-fg-muted">
                A few example tasks, events and a note are in. They have the “Sample” tag.
              </p>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 />}
                onClick={() => void removeSamples()}
              >
                Remove examples
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              icon={<Sparkles />}
              onClick={() => void addSamples()}
            >
              Add examples
            </Button>
          )}
        </Step>
      </ol>

      <div className="mt-5 flex justify-end">
        <Button onClick={finish}>I'm all set</Button>
      </div>
    </Card>
  );
}
