import { db } from '@/data/db';
import { eventsRepo } from '@/data/repos/events';
import { notesRepo } from '@/data/repos/notes';
import { getSetting, setSetting } from '@/data/repos/settings';
import { tagsRepo } from '@/data/repos/tags';
import { tasksRepo } from '@/data/repos/tasks';
import { clock } from '@/lib/clock';
import { addLocalDays, localDateOf, localDateTimeToIso } from '@/lib/dates';
import { formatRecurrence } from '@/lib/recurrence';

export const SAMPLE_TAG = 'Sample';

const text = (t: string) => ({ type: 'text', text: t });
const paragraph = (t: string) => ({ type: 'paragraph', content: [text(t)] });
const todo = (t: string, checked: boolean) => ({
  type: 'taskItem',
  attrs: { checked },
  content: [paragraph(t)],
});

/**
 * Adds a few example tasks, events and a note so a new user can look around. Everything
 * gets the "Sample" tag; `removeSampleData` moves it all to the Trash again.
 * Does nothing if sample data is already there.
 */
export async function addSampleData(now = clock.now()): Promise<boolean> {
  const existing = await getSetting('sampleData');
  if (existing && (await tagsRepo.get(existing.tagId))?.deletedAt === null) return false;

  const today = localDateOf(now);
  const tag = await tagsRepo.ensure(SAMPLE_TAG, 'lavender');
  const tagIds = [tag.id];

  await tasksRepo.create({
    title: 'Read chapter 3 for biology',
    dueDate: today,
    priority: 2,
    tagIds,
  });
  await tasksRepo.create({
    title: 'Water the plants',
    dueDate: today,
    rrule: formatRecurrence({ start: today, freq: 'WEEKLY', interval: 1, byDay: [], until: null }),
    tagIds,
  });
  const prep = await tasksRepo.create({
    title: 'Get ready for the study group',
    dueDate: addLocalDays(today, 1),
    tagIds,
  });
  await tasksRepo.saveChecklist(prep.id, [
    { text: 'Print the worksheet', done: false },
    { text: 'Bring snacks', done: false },
  ]);
  await tasksRepo.create({ title: 'Plan a weekend picnic', tagIds });

  const groupDay = addLocalDays(today, 1);
  await eventsRepo.create({
    title: 'Study group',
    start: localDateTimeToIso(groupDay, '16:00'),
    end: localDateTimeToIso(groupDay, '17:30'),
    location: 'Library, room 2',
    reminderMinutes: 30,
    tagIds,
  });
  const museumDay = addLocalDays(today, 3);
  await eventsRepo.create({
    title: 'Museum day',
    start: museumDay,
    end: museumDay,
    allDay: 1,
    tagIds,
  });

  await notesRepo.create({
    title: 'Welcome to your notes',
    contentText: [
      'Notes can hold headings, lists and checklists.',
      'Ideas for this week',
      'Try the search with Ctrl+K',
      'Pin a note to keep it on top',
    ].join('\n'),
    contentJson: {
      type: 'doc',
      content: [
        paragraph('Notes can hold headings, lists and checklists.'),
        { type: 'heading', attrs: { level: 2 }, content: [text('Ideas for this week')] },
        {
          type: 'taskList',
          content: [
            todo('Try the search with Ctrl+K', false),
            todo('Pin a note to keep it on top', false),
          ],
        },
      ],
    },
    tagIds,
  });

  await setSetting('sampleData', { tagId: tag.id });
  return true;
}

export interface RemovedSamples {
  tagId: string;
  tasks: string[];
  events: string[];
  notes: string[];
  count: number;
}

/**
 * Moves every active task, event and note with the sample tag to the Trash (including
 * repeats made since, and anything the user tagged "Sample"), then the tag itself.
 * Returns what was removed (for Undo), or null if there was no sample data.
 */
export async function removeSampleData(): Promise<RemovedSamples | null> {
  const sample = await getSetting('sampleData');
  if (!sample) return null;
  const { tagId } = sample;
  const tagged = <T extends { tagIds: string[]; deletedAt: number | null }>(row: T) =>
    !row.deletedAt && row.tagIds.includes(tagId);
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

  const [tasks, events, notes] = await Promise.all([
    db.tasks.where('tagIds').equals(tagId).filter(tagged).toArray().then(ids),
    db.events.where('tagIds').equals(tagId).filter(tagged).toArray().then(ids),
    db.notes.where('tagIds').equals(tagId).filter(tagged).toArray().then(ids),
  ]);
  for (const id of tasks) await tasksRepo.softDelete(id);
  for (const id of events) await eventsRepo.softDelete(id);
  for (const id of notes) await notesRepo.softDelete(id);
  if (await tagsRepo.get(tagId)) await tagsRepo.softDelete(tagId);
  await setSetting('sampleData', null);
  return { tagId, tasks, events, notes, count: tasks.length + events.length + notes.length };
}

/** Undo for `removeSampleData`. */
export async function restoreSampleData(removed: RemovedSamples): Promise<void> {
  if (await tagsRepo.get(removed.tagId)) await tagsRepo.restore(removed.tagId);
  for (const id of removed.tasks) await tasksRepo.restore(id);
  for (const id of removed.events) await eventsRepo.restore(id);
  for (const id of removed.notes) await notesRepo.restore(id);
  await setSetting('sampleData', { tagId: removed.tagId });
}
