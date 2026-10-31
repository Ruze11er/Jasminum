import type { WeekStart } from '@/data/repos/settings';
import type {
  ActivityEntry,
  Category,
  DailyStats,
  LibraryDocument,
  LocalDate,
  Task,
} from '@/data/types';

/**
 * Everything a rule may look at: a snapshot taken by the runner. Rules are pure
 * functions of this, so they're easy to test with fixtures and never read the clock.
 */
export interface InsightContext {
  /** "Now" (epoch ms) and the local day it falls on. */
  now: number;
  today: LocalDate;
  weekStartsOn: WeekStart;
  /** Not in the Trash. */
  tasks: Task[];
  documents: LibraryDocument[];
  categories: Category[];
  /** Recent activity (the last 60 days is plenty for every rule). */
  activity: ActivityEntry[];
  /** One row per local day (see data/dailyStats.ts). */
  dailyStats: DailyStats[];
  lastBackupAt: number | null;
  /** The oldest and newest change to any task, event, note or document, or null if none. */
  firstDataAt: number | null;
  lastDataChangeAt: number | null;
  /** Browser storage, or null if the browser can't tell. */
  storage: { usage: number; quota: number } | null;
}

/** What a button on an insight does. Plain data, so insights can be stored and replayed. */
export type InsightAction =
  | { type: 'move-overdue-today'; label: string }
  | { type: 'open-tasks'; view: 'overdue' | 'all' | 'upcoming'; label: string }
  | { type: 'open-task'; taskId: string; label: string }
  | { type: 'lower-priority'; taskId: string; label: string }
  | { type: 'delete-task'; taskId: string; label: string }
  | { type: 'spread-day'; date: LocalDate; label: string }
  | { type: 'open-calendar-day'; date: LocalDate; label: string }
  | { type: 'favorite-document'; documentId: string; label: string }
  | { type: 'open-document'; documentId: string; label: string }
  | { type: 'open-library'; view: 'untagged' | 'all'; label: string }
  | { type: 'backup'; label: string }
  | { type: 'manage-storage'; label: string };

/** How an insight should feel: something to do, something to know, or a well done. */
export type InsightTone = 'action' | 'info' | 'positive';

export interface InsightCandidate {
  ruleId: RuleId;
  /**
   * Identifies "the same insight" across runs, so a dismissal sticks. It includes what
   * makes it new (a date, a week, a count): e.g. dismissing today's overdue reminder
   * doesn't hide tomorrow's.
   */
  fingerprint: string;
  /** 1 (nice to know) to 5 (urgent). */
  severity: number;
  tone: InsightTone;
  title: string;
  /** The "why" hint under the title. */
  why: string;
  actions: InsightAction[];
}

export type RuleId =
  | 'R1'
  | 'R2'
  | 'R3'
  | 'R4'
  | 'R5'
  | 'R6'
  | 'R7'
  | 'R8'
  | 'R9'
  | 'R10'
  | 'R11'
  | 'R12'
  | 'R13'
  | 'R14';

export type Rule = (ctx: InsightContext) => InsightCandidate[];
