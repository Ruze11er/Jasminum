import { Smartphone } from 'lucide-react';
import { Card, CardHeader } from '@/design-system';
import { InstallSteps } from '@/features/install/InstallSteps';

/** Settings → Install the app. */
export function InstallCard() {
  return (
    <Card>
      <CardHeader title="Install the app" icon={<Smartphone />} />
      <p className="mb-3 text-sm text-fg-muted">
        Installed, Jasminum opens from your Home Screen or desktop like any app, works offline, and
        keeps its storage safer from automatic clean-up.
      </p>
      <InstallSteps />
    </Card>
  );
}
