import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { expandEvents } from '@/data/repos/events';
import type { LocalDate } from '@/data/types';
import { useTasksData, type TasksData } from '@/features/tasks/useTasksData';
import { itemsByDay, type CalendarItem } from './selectors';

export interface CalendarData extends TasksData {
  byDay: Map<LocalDate, CalendarItem[]>;
}

/** Live events and tasks for the visible days, grouped by day. */
export function useCalendarData(from: LocalDate, to: LocalDate): CalendarData | undefined {
  const tasksData = useTasksData();
  const events = useLiveQuery(() => db.events.filter((e) => !e.deletedAt).toArray(), []);
  return useMemo(() => {
    if (!tasksData || !events) return undefined;
    const occurrences = expandEvents(events, from, to);
    return { ...tasksData, byDay: itemsByDay(occurrences, tasksData.tasks, from, to) };
  }, [tasksData, events, from, to]);
}
