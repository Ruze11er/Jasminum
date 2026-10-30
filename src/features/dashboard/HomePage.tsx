import { CalendarHeart, Lightbulb, ListChecks, Quote } from 'lucide-react';
import { Card, CardHeader, EmptyState, ProgressRing, Sparkle } from '@/design-system';

function greeting(hour: number) {
  if (hour < 5) return 'Hello, night owl';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomePage() {
  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now);

  return (
    <div className="space-y-5">
      <header className="relative">
        <p className="text-sm font-semibold text-fg-muted">{dateLabel}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl md:text-3xl">
          {greeting(now.getHours())}
          <Sparkle className="size-5 text-pink-300" />
        </h1>
      </header>

      {/* Daily quote: the real rotating collection arrives with the Dashboard phase. */}
      <Card tone="pink" className="relative overflow-hidden">
        <Quote
          className="absolute -top-1 -right-1 size-20 rotate-180 opacity-10"
          aria-hidden="true"
        />
        <p className="text-xs font-bold tracking-wider uppercase opacity-80">Quote of the day</p>
        <blockquote className="mt-2 font-display text-lg leading-snug font-semibold md:text-xl">
          “Well begun is half done.”
        </blockquote>
        <p className="mt-2 text-sm opacity-80">— Aristotle</p>
      </Card>

      <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Today" icon={<ListChecks />} />
          <div className="flex items-center gap-4 rounded-xl bg-surface-muted p-3">
            <ProgressRing value={0} size={56} stroke={6} label="0 of 0 tasks done">
              0/0
            </ProgressRing>
            <p className="text-sm text-fg-muted">
              Nothing planned yet. Your tasks for today will show up here.
            </p>
          </div>
          <EmptyState
            className="py-6"
            icon={<CalendarHeart />}
            title="A fresh, calm day"
            description="Tap + to add a task or event."
          />
        </Card>

        <Card>
          <CardHeader title="Insights" icon={<Lightbulb />} />
          <EmptyState
            className="py-6"
            icon={<Lightbulb />}
            title="Getting to know you"
            description="Helpful tips appear after a few days of use. Everything stays on your device."
          />
        </Card>
      </div>
    </div>
  );
}
