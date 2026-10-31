import { Link } from 'react-router';
import { ChevronRight, Database, Info, Monitor, Moon, Palette, Sun, Trash2 } from 'lucide-react';
import { Card, CardHeader, PageHeader, SegmentedControl } from '@/design-system';
import { useUiStore, type ThemePreference } from '@/stores/uiStore';
import { ProfileCard } from './ProfileCard';
import { StorageCard } from './StorageCard';
import { OrganizeCard } from './OrganizeCard';
import { CalendarCard } from './CalendarCard';

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

        <OrganizeCard />

        <StorageCard />

        <Card>
          <CardHeader title="Data" icon={<Database />} />
          <Link
            to="/trash"
            className="flex items-center gap-3 rounded-xl px-1 py-2.5 font-semibold hover:text-link"
          >
            <Trash2 className="size-5 text-fg-muted" aria-hidden="true" />
            <span className="flex-1">Trash</span>
            <ChevronRight className="size-4 text-fg-muted" aria-hidden="true" />
          </Link>
          <p className="mt-1 text-sm text-fg-muted">
            Backup, restore and export arrive in a later update.
          </p>
        </Card>

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
