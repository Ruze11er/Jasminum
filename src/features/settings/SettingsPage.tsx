import { Link } from 'react-router';
import { ChevronRight, Info, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { Card, CardHeader, PageHeader, SegmentedControl } from '@/design-system';
import { useUiStore, type ThemePreference } from '@/stores/uiStore';
import { ProfileCard } from './ProfileCard';
import { StorageCard } from './StorageCard';
import { OrganizeCard } from './OrganizeCard';
import { DataCard } from './data/DataCard';
import { CalendarCard } from './CalendarCard';
import { QuotesCard } from './QuotesCard';
import { InsightsSettingsCard } from './InsightsSettingsCard';
import { InstallCard } from './InstallCard';
import { AppLockCard } from './AppLockCard';

export default function SettingsPage() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-5">
        <ProfileCard />

        <Card>
          <CardHeader title="Appearance" icon={<Palette />} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Theme</p>
              <p className="text-sm text-fg-muted">
                "System" follows your device's light or dark mode.
              </p>
            </div>
            <SegmentedControl<ThemePreference>
              label="Theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Light', icon: <Sun /> },
                { value: 'dark', label: 'Dark', icon: <Moon /> },
                { value: 'system', label: 'System', icon: <Monitor /> },
              ]}
            />
          </div>
        </Card>

        <CalendarCard />

        <QuotesCard />

        <InsightsSettingsCard />

        <OrganizeCard />

        <InstallCard />

        <StorageCard />

        <AppLockCard />

        <DataCard />

        <Card>
          <CardHeader title="About" icon={<Info />} />
          <dl className="divide-y divide-line">
            <div className="flex justify-between py-2.5">
              <dt className="text-fg-muted">Version</dt>
              <dd className="font-semibold">{__APP_VERSION__}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-fg-muted">Your data</dt>
              <dd className="text-right font-semibold">Stored only on this device</dd>
            </div>
          </dl>
          <Link
            to="/privacy"
            className="mt-2 flex items-center justify-between rounded-xl px-1 py-2.5 font-semibold text-link hover:underline"
          >
            Privacy
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            to="/design"
            className="mt-2 flex items-center justify-between rounded-xl px-1 py-2.5 font-semibold text-link hover:underline"
          >
            Design system
            <ChevronRight className="size-4" />
          </Link>
        </Card>
      </div>
    </>
  );
}
