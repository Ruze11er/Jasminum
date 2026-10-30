import { Library } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/design-system';

export default function LibraryPage() {
  return (
    <>
      <PageHeader title="Library" subtitle="Your PDFs, slides, ebooks and study materials." />
      <Card>
        <EmptyState
          icon={<Library />}
          title="Your library is empty"
          description="Importing and organizing files, saved safely on this device, is built in an upcoming phase."
        />
      </Card>
    </>
  );
}
