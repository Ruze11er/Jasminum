import { Lightbulb } from 'lucide-react';
import { CardHeader, EmptyState, LinkCard } from '@/design-system';
import { InsightCard } from '@/features/insights/components/InsightCard';
import { useActiveInsights } from '@/features/insights/useInsights';

const ON_HOME = 3;

/** Home's top three insights; the card opens the rest. */
export function InsightsCard({ className }: { className?: string }) {
  const insights = useActiveInsights();
  const more = (insights?.length ?? 0) - ON_HOME;
  return (
    <LinkCard className={className}>
      <CardHeader title="Insights" icon={<Lightbulb />} to="/insights" />
      {insights === undefined ? (
        <div aria-busy="true" className="h-20" />
      ) : insights.length === 0 ? (
        <EmptyState
          className="flex-1 justify-center py-4"
          icon={<Lightbulb />}
          title="Getting to know you"
          description="Helpful tips appear as you use Jasminum. Everything stays on your device."
        />
      ) : (
        <div className="space-y-3" aria-label="Top insights" role="group">
          {insights.slice(0, ON_HOME).map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
          {more > 0 && (
            <p className="text-center text-sm font-semibold text-fg-muted">{more} more</p>
          )}
        </div>
      )}
    </LinkCard>
  );
}
