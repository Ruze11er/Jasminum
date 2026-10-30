import Dexie, { type Table } from 'dexie';
import type {
  ActivityEntry,
  CalendarEvent,
  Category,
  ChecklistItem,
  DailyStats,
  FileBlobRow,
  Folder,
  Insight,
  LibraryDocument,
  Link,
  Note,
  SettingRow,
  Tag,
  Task,
} from './types';

export const DB_NAME = 'jasminum';

export class JasminumDB extends Dexie {
  tasks!: Table<Task, string>;
  checklistItems!: Table<ChecklistItem, string>;
  events!: Table<CalendarEvent, string>;
  notes!: Table<Note, string>;
  folders!: Table<Folder, string>;
  documents!: Table<LibraryDocument, string>;
  tags!: Table<Tag, string>;
  categories!: Table<Category, string>;
  links!: Table<Link, string>;
  settings!: Table<SettingRow, string>;
  activity!: Table<ActivityEntry, string>;
  dailyStats!: Table<DailyStats, string>;
  insights!: Table<Insight, string>;
  fileBlobs!: Table<FileBlobRow, string>;

  constructor(name = DB_NAME) {
    super(name);

    /*
     * Schema history. NEVER edit a released version: add a new `this.version(n)` with an
     * `.upgrade()` instead, and add a fixture test for it. Only indexed fields are listed.
     * Note: null values are not indexed, so `where('deletedAt').above(0)` lists the Trash.
     */
    this.version(1).stores({
      tasks:
        'id, status, dueDate, scheduledDate, categoryId, *tagIds, [status+dueDate], seriesId, updatedAt, deletedAt',
      checklistItems: 'id, taskId',
      events: 'id, start, end, categoryId, *tagIds, deletedAt',
      notes: 'id, folderId, *tagIds, pinned, favorite, updatedAt, deletedAt',
      folders: 'id, scope, parentId, deletedAt',
      documents:
        'id, folderId, kind, *tagIds, favorite, addedAt, lastOpenedAt, hash, title, deletedAt',
      tags: 'id, &normalizedName, deletedAt',
      categories: 'id, order, deletedAt',
      links: 'id, [fromType+fromId], [toType+toId]',
      settings: 'key',
      activity: 'id, at, [type+at], entityId',
      dailyStats: 'date',
      insights: 'id, &fingerprint, status, createdAt',
      fileBlobs: 'key',
    });
  }
}

export const db = new JasminumDB();
