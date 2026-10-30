import { NotebookPen } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/design-system';

export default function NotesPage() {
  return (
    <>
      <PageHeader
        title="Notes"
        subtitle="Ideas, lecture notes and everything you want to remember."
      />
      <Card>
        <EmptyState
          icon={<NotebookPen />}
          title="No notes yet"
          description="Rich-text notes with folders, tags and favorites are built in an upcoming phase."
        />
      </Card>
    </>
  );
}
