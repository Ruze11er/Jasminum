/**
 * Stored record shapes. See docs/PLAN.md §7.
 * Conventions: UUIDv7 ids, epoch-ms timestamps, `deletedAt` drives the Trash,
 * indexed booleans are 0 | 1, all-day dates are local "YYYY-MM-DD" strings.
 */

export type Flag = 0 | 1;
export type LocalDate = string; // "YYYY-MM-DD"

export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Set when moved to Trash; null while active. Purged for good after 30 days. */
  deletedAt: number | null;
}

export type EntityType =
  'task' | 'checklistItem' | 'event' | 'note' | 'folder' | 'document' | 'tag' | 'category';

export type TaskStatus = 'todo' | 'done';
export type Priority = 0 | 1 | 2 | 3; // none, low, medium, high

export interface Task extends BaseEntity {
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: LocalDate | null;
  dueTime: string | null; // "HH:mm"
  scheduledDate: LocalDate | null;
  completedAt: number | null;
  categoryId: string | null;
  tagIds: string[];
  rrule: string | null;
  seriesId: string | null;
  postponeCount: number;
  originalDueDate: LocalDate | null;
  reminderAt: number | null;
  order: number;
}

export interface ChecklistItem extends BaseEntity {
  taskId: string;
  text: string;
  done: Flag;
  order: number;
}

export interface CalendarEvent extends BaseEntity {
  title: string;
  description: string;
  start: string; // ISO with offset, or LocalDate when allDay
  end: string;
  allDay: Flag;
  location: string;
  categoryId: string | null;
  tagIds: string[];
  rrule: string | null;
  exdates: string[];
  reminderAt: number | null;
}

export interface Note extends BaseEntity {
  title: string;
  contentJson: unknown;
  contentText: string;
  folderId: string | null;
  tagIds: string[];
  pinned: Flag;
  favorite: Flag;
}

export type FolderScope = 'notes' | 'documents';

export interface Folder extends BaseEntity {
  name: string;
  parentId: string | null;
  scope: FolderScope;
  order: number;
  color: string | null;
  icon: string | null;
}

export type DocumentKind =
  'pdf' | 'word' | 'slides' | 'ebook' | 'image' | 'text' | 'sheet' | 'other';

export interface LibraryDocument extends BaseEntity {
  title: string;
  originalFilename: string;
  mimeType: string;
  ext: string;
  kind: DocumentKind;
  size: number;
  hash: string;
  storageKey: string;
  thumbKey: string | null;
  folderId: string | null;
  tagIds: string[];
  description: string;
  favorite: Flag;
  addedAt: number;
  lastOpenedAt: number | null;
  openCount: number;
  fileMissing: Flag;
}

export interface Tag extends BaseEntity {
  name: string;
  normalizedName: string;
  color: string;
}

export interface Category extends BaseEntity {
  name: string;
  color: string;
  icon: string;
  order: number;
}

export interface Link {
  id: string;
  fromType: EntityType;
  fromId: string;
  toType: EntityType;
  toId: string;
  createdAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
  updatedAt: number;
}

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'restored'
  | 'purged'
  | 'completed'
  | 'postponed'
  | 'opened'
  | 'added';

/** e.g. "task.completed", "document.opened", "app.opened". */
export type ActivityType = `${EntityType}.${ActivityAction}` | 'app.opened';

export interface ActivityEntry {
  id: string;
  at: number;
  type: ActivityType;
  entityType: EntityType | 'app';
  entityId: string | null;
  meta?: Record<string, unknown>;
}

export interface DailyStats {
  date: LocalDate;
  tasksCreated: number;
  tasksCompleted: number;
  tasksDue: number;
  tasksOverdue: number;
  tasksPostponed: number;
  notesEdited: number;
  docsAdded: number;
  docsOpened: number;
}

export type InsightStatus = 'active' | 'dismissed' | 'acted' | 'snoozed';

export interface Insight {
  id: string;
  ruleId: string;
  fingerprint: string;
  severity: number;
  payload: Record<string, unknown>;
  status: InsightStatus;
  snoozedUntil: number | null;
  createdAt: number;
}

/** File bytes for the IndexedDB fallback FileStore (used only when OPFS is unavailable). */
export interface FileBlobRow {
  key: string;
  blob: Blob;
  size: number;
  updatedAt: number;
}
