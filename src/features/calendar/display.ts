import { chipColors, type ChipColor } from '@/design-system';
import { chipColorClasses } from '@/design-system/components/chipColors';
import type { Category, LocalDate } from '@/data/types';
import { dayLabel, timeLabel } from '@/lib/dates';
import type { CalendarItem } from './selectors';

export type EventItem = Extract<CalendarItem, { kind: 'event' }>;

/** Events take their category's color (pink without one). */
export const categoryColor = (category: Category | undefined): ChipColor =>
  category && chipColors.includes(category.color as ChipColor)
    ? (category.color as ChipColor)
    : 'pink';

/** Chip classes for an item: its category color for events, neutral for tasks. */
export function itemColorClasses(item: CalendarItem, categoryById: Map<string, Category>) {
  if (item.kind === 'task') return chipColorClasses.neutral;
  const id = item.occ.event.categoryId;
  return chipColorClasses[categoryColor(id ? categoryById.get(id) : undefined)];
}

/** "9:00 AM – 10:00 AM", "All day, until Tuesday", "Until 11:00 AM" (later days of long events). */
export function whenText(item: EventItem, today: LocalDate): string {
  const { occ, continued, day } = item;
  if (!occ.startTime) {
    return occ.endDate !== occ.date ? `All day, until ${dayLabel(occ.endDate, today)}` : 'All day';
  }
  const endDay = occ.endDate !== day ? `, ${dayLabel(occ.endDate, today)}` : '';
  const end = `${timeLabel(occ.endTime!)}${endDay}`;
  return continued ? `Until ${end}` : `${timeLabel(occ.startTime)} – ${end}`;
}

/** Solid accent for the thin color bar on event rows (the soft chip colors are too faint there). */
export const barColorClasses: Record<ChipColor, string> = {
  pink: 'bg-brand',
  lavender: 'bg-lavender',
  mint: 'bg-mint',
  peach: 'bg-peach',
  butter: 'bg-butter',
  sky: 'bg-sky',
  neutral: 'bg-line-strong',
};
