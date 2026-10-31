import { Sparkle } from '@/design-system';
import { useSetting } from '@/data/repos/settings';
import { clock } from '@/lib/clock';
import { parseLocalDate } from '@/lib/dates';
import { useToday } from '@/lib/useToday';
import { InsightsCard } from './InsightsCard';
import { QuoteCard } from './QuoteCard';
import { ScheduleCard } from './ScheduleCard';
import { StatsRow } from './StatsRow';
import { TodayCard } from './TodayCard';
import { WelcomeCard } from './WelcomeCard';

function greeting(hour: number) {
  if (hour < 5) return 'Hello, night owl';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Home: greeting, today's quote, tasks and events, the week in numbers, insights. */
export default function HomePage() {
  const profile = useSetting('profile');
  const today = useToday();
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(parseLocalDate(today));

  return (
    <div className="space-y-5">
      <header className="relative">
        <p className="text-sm font-semibold text-fg-muted">{dateLabel}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl md:text-3xl">
          {greeting(new Date(clock.now()).getHours())}
          {profile.displayName && `, ${profile.displayName}`}
          <Sparkle className="size-5 text-pink-300" />
        </h1>
      </header>

      <WelcomeCard />

      <QuoteCard />

      {/* Both columns stretch to the same height, so neither leaves a gap under its card. */}
      <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <TodayCard />
        <div className="flex flex-col gap-5">
          <ScheduleCard today={today} />
          <InsightsCard className="flex flex-1 flex-col" />
        </div>
      </div>

      <StatsRow today={today} />
    </div>
  );
}
