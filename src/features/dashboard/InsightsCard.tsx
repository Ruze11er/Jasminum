import { Link } from 'react-router';
import { ChevronRight, Lightbulb } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/design-system';
import { InsightCard } from '@/features/insights/components/InsightCard';
import { useActiveInsights } from '@/features/insights/useInsights';

const ON_HOME = 3;

/** Home's top three insights, with a link to the rest. */
export function InsightsCard() {
  const insights = useActiveInsights();
  const more = (insights?.length ?? 0) - ON_HOME;
  return (
    <Card>
      <CardHeader
        title="Insights"
        icon={<Lightbulb />}
        action={
          <Link
            to="/insights"
            className="flex items-center gap-0.5 text-sm font-bold text-link hover:underline"
          >
            {more > 0 ? `See all (${insights!.length})` : 'See all'}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        }
      />
      {insights === undefined ? (
        <div aria-busy="true" className="h-20" />
      ) : insights.length === 0 ? (
        <EmptyState
          className="py-4"
          icon={<Lightbulb />}
          title="Getting to know you"
          description="Helpful tips appear as you use Jasminum. Everything stays on your device."
        />
      ) : (
        <div className="space-y-3" aria-label="Top insights" role="group">
          {insights.slice(0, ON_HOME).map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      )}
    </Card>
  );
}
