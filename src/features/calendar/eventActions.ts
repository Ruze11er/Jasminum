import { toast } from '@/design-system';
import { eventsRepo } from '@/data/repos/events';
import type { CalendarEvent, LocalDate } from '@/data/types';

/** Shared event actions with friendly feedback. */

/** Deletes the whole event (every repeat) to the Trash. */
export async function deleteEvent(event: CalendarEvent) {
  await eventsRepo.softDelete(event.id);
  toast({
    message: 'Moved to Trash',
    action: { label: 'Undo', onClick: () => void eventsRepo.restore(event.id) },
  });
}

/** Removes one date from a repeating event; the rest of the series stays. */
export async function deleteOccurrence(event: CalendarEvent, date: LocalDate) {
  await eventsRepo.skipOccurrence(event.id, date);
  toast({
    message: 'Event removed from this day',
    action: { label: 'Undo', onClick: () => void eventsRepo.unskipOccurrence(event.id, date) },
  });
}
