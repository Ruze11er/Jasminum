import { useEffect, useState } from 'react';
import type { LocalDate } from '@/data/types';
import { clock } from './clock';
import { localDateOf } from './dates';

/**
 * Today's local date, updated just after midnight and whenever the app comes back to the
 * front (timers sleep while a phone is locked). Use it for anything that should change
 * when the day does, like the daily quote.
 */
export function useToday(): LocalDate {
  const [today, setToday] = useState(() => localDateOf(clock.now()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => setToday(localDateOf(clock.now()));
    const schedule = () => {
      const now = clock.now();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 1, 0);
      timer = setTimeout(
        () => {
          refresh();
          schedule();
        },
        Math.max(1000, midnight.getTime() - now),
      );
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return today;
}
