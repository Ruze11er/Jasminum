import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button, Card, CardHeader, SegmentedControl } from '@/design-system';
import { setSetting, useSetting, type WeekStart } from '@/data/repos/settings';
import {
  notificationStatus,
  requestNotificationPermission,
  type NotificationStatus,
} from '@/platform/notifications';

const STATUS_TEXT: Record<NotificationStatus, string> = {
  granted: 'System notifications are on.',
  default: 'Reminders show inside the app. You can also allow system notifications.',
  denied: 'Notifications are blocked for this site in your browser settings.',
  unsupported: "This browser can't show system notifications. Reminders show inside the app.",
};

export function CalendarCard() {
  const weekStartsOn = useSetting('weekStartsOn');
  const [status, setStatus] = useState<NotificationStatus>(notificationStatus);

  return (
    <Card>
      <CardHeader title="Calendar" icon={<CalendarDays />} />
      <div className="divide-y divide-line">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <p className="font-semibold">Week starts on</p>
          <SegmentedControl<string>
            label="Week starts on"
            value={String(weekStartsOn)}
            onChange={(v) => void setSetting('weekStartsOn', Number(v) as WeekStart)}
            options={[
              { value: '1', label: 'Monday' },
              { value: '0', label: 'Sunday' },
              { value: '6', label: 'Saturday' },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Reminders</p>
            <p className="text-sm text-fg-muted">
              {STATUS_TEXT[status]} Reminders work while Jasminum is open.
            </p>
          </div>
          {status === 'default' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void requestNotificationPermission().then(setStatus)}
            >
              Allow notifications
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
