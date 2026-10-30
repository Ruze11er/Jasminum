import { ListChecks } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/design-system';

export default function TasksPage() {
  return (
    <>
      <PageHeader title="Tasks" subtitle="Today, upcoming and everything in between." />
      <Card>
        <EmptyState
          icon={<ListChecks />}
          title="No tasks yet"
          description="Task lists, checklists, priorities and recurring tasks are built in an upcoming phase."
        />
      </Card>
    </>
  );
}
