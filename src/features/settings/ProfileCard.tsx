import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { Card, CardHeader, Field, Input, toast } from '@/design-system';
import { setSetting, useSetting } from '@/data/repos/settings';
import { firstIssue } from '@/lib/validation';

export function ProfileCard() {
  const profile = useSetting('profile');
  return (
    <Card>
      <CardHeader title="Profile" icon={<UserRound />} />
      {/* Re-mount when the stored name loads or changes elsewhere. */}
      <NameField key={profile.displayName} initial={profile.displayName} />
    </Card>
  );
}

function NameField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string>();

  const save = async () => {
    if (value.trim() === initial) return;
    try {
      await setSetting('profile', { displayName: value });
      setError(undefined);
      toast({ message: 'Name saved' });
    } catch (err) {
      setError(firstIssue(err) ?? "Couldn't save your name. Please try again.");
    }
  };

  return (
    <Field label="Your name" hint="Used for your greeting. It stays on this device." error={error}>
      {(p) => (
        <Input
          {...p}
          value={value}
          maxLength={60}
          autoComplete="given-name"
          placeholder="What should we call you?"
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      )}
    </Field>
  );
}
