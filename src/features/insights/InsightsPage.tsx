import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarRange, CheckCircle2, Lightbulb, TrendingUp } from 'lucide-react';
import { Card, CardHeader, EmptyState, PageHeader } from '@/design-system';
import { db } from '@/data/db';
import { useSetting } from '@/data/repos/settings';
import { addLocalDays } from '@/lib/dates';
import { useToday } from '@/lib/useToday';
import { startOfWeek } from '@/features/calendar/selectors';
import { compareWeeks } from '@/features/dashboard/stats';
import {
  completionsByCategory,
  completionsByWeek,
  completionsByWeekday,
  periodTotals,
} from './charts';
import { BarChart } from './components/BarChart';
import { InsightCard } from './components/InsightCard';
import { useActiveInsights } from './useInsights';

function Summary({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft-sm">
      <dt className="text-sm font-semibold text-fg-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold">{value}</dd>
      <dd className="text-xs text-fg-muted">{hint}</dd>
    </div>
  );
}

/** All active insights, this week and month in numbers, and charts of what you finish. */
export default function InsightsPage() {
  const today = useToday();
  const weekStartsOn = useSetting('weekStartsOn');
  const insights = useActiveInsights();
  const data = useLiveQuery(async () => {
    const [tasks, categories] = await Promise.all([
      db.tasks.where('status').equals('done').toArray(),
      db.categories.filter((c) => !c.deletedAt).toArray(),
    ]);
    const weekStart = startOfWeek(today, weekStartsOn);
    const monthStart = `${today.slice(0, 8)}01`;
    const prevMonthEnd = addLocalDays(monthStart, -1);
    const prevMonthStart = `${prevMonthEnd.slice(0, 8)}01`;
    return {
      week: periodTotals(tasks, weekStart, today),
      lastWeek: periodTotals(tasks, addLocalDays(weekStart, -7), addLocalDays(weekStart, -1)),
      month: periodTotals(tasks, monthStart, today),
      lastMonth: periodTotals(tasks, prevMonthStart, prevMonthEnd),
      byWeek: completionsByWeek(tasks, today, weekStartsOn),
      byWeekday: completionsByWeekday(tasks, today, weekStartsOn),
      byCategory: completionsByCategory(tasks, categories, today),
      total: tasks.filter((t) => !t.deletedAt).length,
    };
  }, [today, weekStartsOn]);

  return (
    <>
      <PageHeader
        title="Insights"
        subtitle="Tips from your own habits. Worked out on this device; nothing is sent anywhere."
      />
      <div className="space-y-6">
        <section aria-labelledby="active-insights" className="space-y-3">
          <h2 id="active-insights" className="text-lg">
            For you now
          </h2>
          {insights === undefined ? (
            <div aria-busy="true" className="h-24 animate-pulse rounded-2xl bg-surface-muted" />
          ) : insights.length === 0 ? (
            <Card>
              <EmptyState
                className="py-6"
                icon={<Lightbulb />}
                title="All clear"
                description="Tips appear here as you use Jasminum: overdue tasks, busy days, streaks and more."
              />
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {insights.map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}
            </div>
          )}
        </section>

        {data && (
          <>
            <section aria-labelledby="summary-heading">
              <h2 id="summary-heading" className="mb-3 text-lg">
                Tasks done
              </h2>
              <dl className="grid grid-cols-2 gap-3">
                <Summary
                  label="This week"
                  value={data.week}
                  hint={compareWeeks(data.week, data.lastWeek)}
                />
                <Summary
                  label="This month"
                  value={data.month}
                  hint={compareWeeks(data.month, data.lastMonth, 'month')}
                />
              </dl>
            </section>

            <section aria-labelledby="charts-heading" className="space-y-4">
              <h2 id="charts-heading" className="sr-only">
                Charts
              </h2>
              {data.total === 0 ? (
                <Card>
                  <EmptyState
                    className="py-6"
                    icon={<TrendingUp />}
                    title="Charts appear as you finish tasks"
                    description="See your weekly progress, your best days and where your time goes."
                  />
                </Card>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="lg:col-span-2">
                    <CardHeader title="Progress" icon={<TrendingUp />} />
                    <BarChart
                      title="Tasks done per week"
                      subtitle="The last 8 weeks"
                      bars={data.byWeek}
                    />
                  </Card>
                  <Card>
                    <CardHeader title="Your best days" icon={<CalendarRange />} />
                    <BarChart
                      title="Tasks done by weekday"
                      subtitle="The last 12 weeks"
                      bars={data.byWeekday}
                    />
                  </Card>
                  <Card>
                    <CardHeader title="Where it goes" icon={<CheckCircle2 />} />
                    <BarChart
                      title="Tasks done by category"
                      subtitle="The last 30 days"
                      bars={data.byCategory}
                      layout="rows"
                      emptyText="Nothing finished in the last 30 days."
                    />
                  </Card>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
