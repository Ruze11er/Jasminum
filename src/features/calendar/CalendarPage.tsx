import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Card, EmptyState, PageHeader, SegmentedControl } from '@/design-system';

type View = 'day' | 'week' | 'month';

export default function CalendarPage() {
  const [view, setView] = useState<View>('month');
  return (
    <>
      <PageHeader
        title="Calendar"
        actions={
          <SegmentedControl
            label="Calendar view"
            value={view}
            onChange={setView}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
        }
      />
      <Card>
        <EmptyState
          icon={<CalendarDays />}
          title="Your calendar is coming together"
          description="Day, week and month views with your tasks and events are built in an upcoming phase."
        />
      </Card>
    </>
  );
}
