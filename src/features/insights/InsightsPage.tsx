import { Lightbulb } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/design-system';

export default function InsightsPage() {
  return (
    <>
      <PageHeader
        title="Insights"
        subtitle="Gentle tips and summaries, worked out privately on your device."
      />
      <Card>
        <EmptyState
          icon={<Lightbulb />}
          title="Not enough activity yet"
          description="Once you've used Jasminum for a few days, productivity summaries and tips will appear here."
        />
      </Card>
    </>
  );
}
