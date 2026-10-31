import type { LocalDate, Task } from '@/data/types';
import { DAY_MS } from '@/lib/clock';
import { addLocalDays, dayLabel, localDateOf, parseLocalDate } from '@/lib/dates';
import { startOfWeek } from '@/features/calendar/selectors';
import type { InsightCandidate, InsightContext, Rule, RuleId } from './types';

/*
 * The insight rules (docs/PLAN.md §10). Each is a pure function of the context and stays
 * quiet until there's enough data, so a new user sees nothing.
 */

const open = (t: Task) => t.status === 'todo' && !t.deletedAt;
const isDone = (t: Task) => t.status === 'done' && !t.deletedAt && t.completedAt !== null;
const quoted = (title: string) => `“${title.length > 40 ? `${title.slice(0, 39)}…` : title}”`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const weekdayName = (date: LocalDate) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(parseLocalDate(date));

/** Completions per local day, from tasks that are done now. */
function completionDays(ctx: InsightContext) {
  const days = new Map<LocalDate, Task[]>();
  for (const t of ctx.tasks) {
    if (!isDone(t)) continue;
    const day = localDateOf(t.completedAt!);
    const list = days.get(day);
    if (list) list.push(t);
    else days.set(day, [t]);
  }
  return days;
}

function doneBetween(ctx: InsightContext, from: LocalDate, to: LocalDate) {
  return ctx.tasks.filter((t) => {
    if (!isDone(t)) return false;
    const day = localDateOf(t.completedAt!);
    return day >= from && day <= to;
  });
}

// ---------- R1 Overdue ----------
export const overdue: Rule = (ctx) => {
  const late = ctx.tasks.filter((t) => open(t) && t.dueDate !== null && t.dueDate < ctx.today);
  if (!late.length) return [];
  return [
    {
      ruleId: 'R1',
      fingerprint: `R1:${ctx.today}`,
      severity: 4,
      tone: 'action',
      title:
        late.length === 1
          ? `${quoted(late[0]!.title)} is overdue`
          : `${late.length} tasks are overdue`,
      why: 'Moving them to today keeps your list honest and your plans realistic.',
      actions: [
        { type: 'move-overdue-today', label: 'Move to today' },
        { type: 'open-tasks', view: 'overdue', label: 'Review' },
      ],
    },
  ];
};

// ---------- R2 Often postponed ----------
export const POSTPONE_LIMIT = 3;
export const oftenPostponed: Rule = (ctx) =>
  ctx.tasks
    .filter((t) => open(t) && t.postponeCount >= POSTPONE_LIMIT)
    .sort((a, b) => b.postponeCount - a.postponeCount)
    .slice(0, 3)
    .map((t) => ({
      ruleId: 'R2' as const,
      fingerprint: `R2:${t.id}:${t.postponeCount}`,
      severity: 3,
      tone: 'action' as const,
      title: `${quoted(t.title)} was moved ${t.postponeCount} times`,
      why: 'A task that keeps slipping is often too big or not that important. Small steps help.',
      actions: [
        { type: 'open-task' as const, taskId: t.id, label: 'Break into steps' },
        ...(t.priority > 0
          ? [{ type: 'lower-priority' as const, taskId: t.id, label: 'Lower priority' }]
          : []),
        { type: 'delete-task' as const, taskId: t.id, label: 'Delete' },
      ],
    }));

// ---------- R3 Heavy day ahead ----------
export const heavyDay: Rule = (ctx) => {
  const from = addLocalDays(ctx.today, -28);
  const recent = ctx.dailyStats.filter((d) => d.date >= from && d.date < ctx.today);
  const average = recent.reduce((n, d) => n + d.tasksCompleted, 0) / 28;
  const limit = Math.max(8, 1.5 * average);
  const out: InsightCandidate[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addLocalDays(ctx.today, i);
    const count = ctx.tasks.filter((t) => open(t) && t.dueDate === date).length;
    if (count <= limit) continue;
    out.push({
      ruleId: 'R3',
      fingerprint: `R3:${date}`,
      severity: 3,
      tone: 'action',
      title: `${dayLabel(date, ctx.today)} looks packed (${count} tasks)`,
      why: `That's more than you usually finish in a day (about ${Math.max(1, Math.round(average))}). Spreading the small ones out makes it doable.`,
      actions: [
        { type: 'spread-day', date, label: 'Spread low-priority tasks' },
        { type: 'open-calendar-day', date, label: 'See the day' },
      ],
    });
  }
  return out.slice(0, 2);
};

// ---------- R4 Deadline soon ----------
export const deadlineSoon: Rule = (ctx) => {
  const limit = ctx.now + 48 * 60 * 60 * 1000;
  return ctx.tasks
    .filter((t) => {
      if (!open(t) || t.priority !== 3 || !t.dueDate || t.dueDate < ctx.today) return false;
      const due = parseLocalDate(t.dueDate);
      if (t.dueTime) {
        const [h, m] = t.dueTime.split(':').map(Number);
        due.setHours(h!, m!);
      } else {
        due.setHours(23, 59);
      }
      return due.getTime() <= limit;
    })
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 3)
    .map((t) => ({
      ruleId: 'R4' as const,
      fingerprint: `R4:${t.id}:${t.dueDate}`,
      severity: t.dueDate === ctx.today ? 5 : 4,
      tone: 'action' as const,
      title: `${quoted(t.title)} is due ${dayLabel(t.dueDate!, ctx.today).toLowerCase()}`,
      why: "It's high priority and the deadline is close.",
      actions: [{ type: 'open-task' as const, taskId: t.id, label: 'Open' }],
    }));
};

// ---------- R5 Unorganized ----------
export const unorganized: Rule = (ctx) => {
  const weekAgo = ctx.now - 7 * DAY_MS;
  const loose = ctx.tasks.filter(
    (t) => open(t) && !t.dueDate && !t.categoryId && t.createdAt <= weekAgo,
  );
  if (loose.length < 5) return [];
  return [
    {
      ruleId: 'R5',
      fingerprint: `R5:${startOfWeek(ctx.today, ctx.weekStartsOn)}`,
      severity: 2,
      tone: 'action',
      title: `${loose.length} tasks need a home`,
      why: "They've waited over a week with no date or category. A date or a category keeps them from getting lost.",
      actions: [{ type: 'open-tasks', view: 'all', label: 'Organize' }],
    },
  ];
};

// ---------- R6 Stale ----------
export const stale: Rule = (ctx) => {
  const monthAgo = ctx.now - 30 * DAY_MS;
  const old = ctx.tasks.filter((t) => open(t) && t.updatedAt <= monthAgo);
  if (!old.length) return [];
  const one = old.length === 1 ? old[0]! : null;
  return [
    {
      ruleId: 'R6',
      fingerprint: `R6:${startOfWeek(ctx.today, ctx.weekStartsOn)}`,
      severity: 2,
      tone: 'action',
      title: one
        ? `${quoted(one.title)} hasn't been touched in a month`
        : `${old.length} tasks haven't been touched in a month`,
      why: 'Give them a new date, or let them go. A shorter list is easier to trust.',
      actions: one
        ? [
            { type: 'open-task', taskId: one.id, label: 'Reschedule' },
            { type: 'delete-task', taskId: one.id, label: 'Delete' },
          ]
        : [{ type: 'open-tasks', view: 'all', label: 'Review' }],
    },
  ];
};

// ---------- R7 Productive pattern ----------
export const PATTERN_MIN_COMPLETIONS = 20;
export const PATTERN_MIN_DAYS = 14;
const BUCKETS = ['night', 'morning', 'afternoon', 'evening'] as const;
const bucketOf = (hour: number) =>
  hour >= 5 && hour < 12
    ? 'morning'
    : hour >= 12 && hour < 17
      ? 'afternoon'
      : hour >= 17 && hour < 22
        ? 'evening'
        : 'night';

export const productivePattern: Rule = (ctx) => {
  const done = ctx.tasks.filter(isDone);
  const days = new Set(done.map((t) => localDateOf(t.completedAt!)));
  if (done.length < PATTERN_MIN_COMPLETIONS || days.size < PATTERN_MIN_DAYS) return [];
  const byWeekday = new Array<number>(7).fill(0);
  const byBucket = new Map<string, number>();
  for (const t of done) {
    const d = new Date(t.completedAt!);
    byWeekday[d.getDay()]!++;
    const b = bucketOf(d.getHours());
    byBucket.set(b, (byBucket.get(b) ?? 0) + 1);
  }
  const bestDay = byWeekday.indexOf(Math.max(...byWeekday));
  const bestBucket = [...BUCKETS].sort(
    (a, b) => (byBucket.get(b) ?? 0) - (byBucket.get(a) ?? 0),
  )[0]!;
  // 2026-11-01 is a Sunday; getDay() 0 = Sunday.
  const dayName = weekdayName(addLocalDays('2026-11-01', bestDay));
  return [
    {
      ruleId: 'R7',
      fingerprint: `R7:${startOfWeek(ctx.today, ctx.weekStartsOn)}:${bestDay}:${bestBucket}`,
      severity: 1,
      tone: 'info',
      title: `You get the most done on ${dayName}s, usually in the ${bestBucket === 'night' ? 'late evening' : bestBucket}`,
      why: `Based on ${done.length} finished tasks. Try putting important work there.`,
      actions: [],
    },
  ];
};

// ---------- R8 Streak / win ----------
export const STREAK_MIN = 3;
export const streakOrWin: Rule = (ctx) => {
  const days = completionDays(ctx);
  let day = days.has(ctx.today) ? ctx.today : addLocalDays(ctx.today, -1);
  let streak = 0;
  for (; days.has(day); day = addLocalDays(day, -1)) streak++;
  if (streak >= STREAK_MIN) {
    return [
      {
        ruleId: 'R8',
        fingerprint: `R8:streak:${ctx.today}`,
        severity: 1,
        tone: 'positive',
        title: `${streak} days in a row with something done`,
        why: days.has(ctx.today)
          ? 'Lovely consistency. Keep it going tomorrow!'
          : 'Finish one task today to keep the streak alive.',
        actions: [],
      },
    ];
  }
  const weekStart = startOfWeek(ctx.today, ctx.weekStartsOn);
  const thisWeek = doneBetween(ctx, weekStart, ctx.today).length;
  const lastWeek = doneBetween(
    ctx,
    addLocalDays(weekStart, -7),
    addLocalDays(weekStart, -1),
  ).length;
  if (lastWeek >= 3 && thisWeek > lastWeek) {
    return [
      {
        ruleId: 'R8',
        fingerprint: `R8:week:${weekStart}`,
        severity: 1,
        tone: 'positive',
        title: `${thisWeek} tasks done this week, more than all of last week`,
        why: `Last week you finished ${lastWeek}. Nice progress!`,
        actions: [],
      },
    ];
  }
  return [];
};

// ---------- R9 Frequently used document ----------
export const frequentDocument: Rule = (ctx) => {
  const since = ctx.now - 14 * DAY_MS;
  const opens = new Map<string, number>();
  for (const a of ctx.activity) {
    if (a.type === 'document.opened' && a.at >= since && a.entityId) {
      opens.set(a.entityId, (opens.get(a.entityId) ?? 0) + 1);
    }
  }
  return ctx.documents
    .filter((d) => !d.deletedAt && !d.favorite && (opens.get(d.id) ?? 0) >= 5)
    .sort((a, b) => opens.get(b.id)! - opens.get(a.id)!)
    .slice(0, 2)
    .map((d) => ({
      ruleId: 'R9' as const,
      fingerprint: `R9:${d.id}`,
      severity: 2,
      tone: 'action' as const,
      title: `You've opened ${quoted(d.title)} ${opens.get(d.id)} times lately`,
      why: 'Make it a favorite so it’s always one tap away.',
      actions: [
        { type: 'favorite-document' as const, documentId: d.id, label: 'Add to favorites' },
        { type: 'open-document' as const, documentId: d.id, label: 'Open' },
      ],
    }));
};

// ---------- R10 Unread material ----------
export const unread: Rule = (ctx) => {
  const monthAgo = ctx.now - 30 * DAY_MS;
  const unopened = ctx.documents.filter(
    (d) => !d.deletedAt && d.addedAt <= monthAgo && d.openCount === 0,
  );
  if (!unopened.length) return [];
  const one = unopened.length === 1 ? unopened[0]! : null;
  return [
    {
      ruleId: 'R10',
      fingerprint: `R10:${startOfWeek(ctx.today, ctx.weekStartsOn)}`,
      severity: 1,
      tone: 'info',
      title: one
        ? `You added ${quoted(one.title)} a month ago and haven't opened it`
        : `${unopened.length} files you added a month ago haven't been opened`,
      why: 'Take a look, or tidy up what you no longer need.',
      actions: one
        ? [{ type: 'open-document', documentId: one.id, label: 'Review now' }]
        : [{ type: 'open-library', view: 'all', label: 'Review now' }],
    },
  ];
};

// ---------- R11 Untagged library ----------
export const untaggedLibrary: Rule = (ctx) => {
  const loose = ctx.documents.filter((d) => !d.deletedAt && !d.tagIds.length && !d.folderId);
  if (loose.length < 10) return [];
  return [
    {
      ruleId: 'R11',
      fingerprint: `R11:${startOfWeek(ctx.today, ctx.weekStartsOn)}`,
      severity: 2,
      tone: 'action',
      title: `${loose.length} files have no tags or folder`,
      why: 'A folder or a tag makes them much quicker to find later.',
      actions: [{ type: 'open-library', view: 'untagged', label: 'Organize library' }],
    },
  ];
};

// ---------- R12 Weekly / monthly summary ----------
const trend = (now: number, before: number) =>
  before === 0
    ? now > 0
      ? 'a great start'
      : 'a quiet one'
    : now === before
      ? 'the same as the period before'
      : `${now > before ? 'up' : 'down'} ${Math.round((Math.abs(now - before) / before) * 100)}% on the period before`;

function topCategory(ctx: InsightContext, tasks: Task[]) {
  const counts = new Map<string, number>();
  for (const t of tasks)
    if (t.categoryId) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  return best ? ctx.categories.find((c) => c.id === best[0])?.name : undefined;
}

export const summary: Rule = (ctx) => {
  const out: InsightCandidate[] = [];
  // Weekly: shown on the first two days of the week, about the week before.
  const weekStart = startOfWeek(ctx.today, ctx.weekStartsOn);
  if (ctx.today <= addLocalDays(weekStart, 1)) {
    const prevStart = addLocalDays(weekStart, -7);
    const prev = doneBetween(ctx, prevStart, addLocalDays(weekStart, -1));
    const before = doneBetween(ctx, addLocalDays(prevStart, -7), addLocalDays(prevStart, -1));
    if (prev.length || before.length) {
      const top = topCategory(ctx, prev);
      out.push({
        ruleId: 'R12',
        fingerprint: `R12:week:${prevStart}`,
        severity: 1,
        tone: 'info',
        title: `Last week: ${plural(prev.length, 'task', 'tasks')} done`,
        why: `That's ${trend(prev.length, before.length)}.${top ? ` Most were in ${top}.` : ''}`,
        actions: [],
      });
    }
  }
  // Monthly: shown on the 1st and 2nd, about last month.
  const dayOfMonth = Number(ctx.today.slice(8));
  if (dayOfMonth <= 2) {
    const monthStart = `${ctx.today.slice(0, 8)}01`;
    const prevEnd = addLocalDays(monthStart, -1);
    const prevStart = `${prevEnd.slice(0, 8)}01`;
    const beforeEnd = addLocalDays(prevStart, -1);
    const prev = doneBetween(ctx, prevStart, prevEnd);
    const before = doneBetween(ctx, `${beforeEnd.slice(0, 8)}01`, beforeEnd);
    if (prev.length || before.length) {
      const month = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(
        parseLocalDate(prevStart),
      );
      const top = topCategory(ctx, prev);
      out.push({
        ruleId: 'R12',
        fingerprint: `R12:month:${prevStart.slice(0, 7)}`,
        severity: 1,
        tone: 'info',
        title: `${month}: ${plural(prev.length, 'task', 'tasks')} done`,
        why: `That's ${trend(prev.length, before.length)}.${top ? ` Most were in ${top}.` : ''}`,
        actions: [],
      });
    }
  }
  return out;
};

// ---------- R13 Backup reminder ----------
export const BACKUP_EVERY_DAYS = 14;
export const backupReminder: Rule = (ctx) => {
  if (ctx.firstDataAt === null || ctx.lastDataChangeAt === null) return [];
  const due = BACKUP_EVERY_DAYS * DAY_MS;
  const week = startOfWeek(ctx.today, ctx.weekStartsOn);
  if (ctx.lastBackupAt === null) {
    if (ctx.now - ctx.firstDataAt < due) return [];
    return [
      {
        ruleId: 'R13',
        fingerprint: `R13:${week}`,
        severity: 3,
        tone: 'action',
        title: "You haven't made a backup yet",
        why: 'Your data lives only in this browser. A backup file keeps it safe if the browser clears it, or when you change devices.',
        actions: [{ type: 'backup', label: 'Back up now' }],
      },
    ];
  }
  if (ctx.now - ctx.lastBackupAt < due || ctx.lastDataChangeAt <= ctx.lastBackupAt) return [];
  const daysAgo = Math.floor((ctx.now - ctx.lastBackupAt) / DAY_MS);
  return [
    {
      ruleId: 'R13',
      fingerprint: `R13:${week}`,
      severity: 3,
      tone: 'action',
      title: `Your last backup was ${daysAgo} days ago`,
      why: "You've made changes since then. A fresh backup keeps them safe.",
      actions: [{ type: 'backup', label: 'Back up now' }],
    },
  ];
};

// ---------- R14 Storage high ----------
export const STORAGE_HIGH = 0.8;
export const storageHigh: Rule = (ctx) => {
  if (!ctx.storage || ctx.storage.quota <= 0) return [];
  const ratio = ctx.storage.usage / ctx.storage.quota;
  if (ratio <= STORAGE_HIGH) return [];
  return [
    {
      ruleId: 'R14',
      fingerprint: `R14:${ctx.today}`,
      severity: 4,
      tone: 'action',
      title: `Storage is ${Math.round(ratio * 100)}% full`,
      why: 'When it runs out, new files can’t be added. Removing large files you no longer need frees space.',
      actions: [{ type: 'manage-storage', label: 'Manage storage' }],
    },
  ];
};

// ---------- all rules ----------

export interface RuleInfo {
  id: RuleId;
  name: string;
  description: string;
  run: Rule;
}

/** Every rule, with a name and description for Settings. */
export const RULES: RuleInfo[] = [
  { id: 'R1', name: 'Overdue tasks', description: 'Tasks past their date', run: overdue },
  {
    id: 'R2',
    name: 'Often postponed',
    description: 'Tasks moved three times or more',
    run: oftenPostponed,
  },
  {
    id: 'R3',
    name: 'Busy days ahead',
    description: 'Days with more than you usually finish',
    run: heavyDay,
  },
  {
    id: 'R4',
    name: 'Deadlines',
    description: 'High-priority tasks due within two days',
    run: deadlineSoon,
  },
  {
    id: 'R5',
    name: 'Tasks without a home',
    description: 'Old tasks with no date or category',
    run: unorganized,
  },
  { id: 'R6', name: 'Forgotten tasks', description: 'Tasks untouched for a month', run: stale },
  {
    id: 'R7',
    name: 'Your best times',
    description: 'When you get the most done',
    run: productivePattern,
  },
  { id: 'R8', name: 'Streaks and wins', description: 'Celebrating good runs', run: streakOrWin },
  {
    id: 'R9',
    name: 'Files you use a lot',
    description: 'Suggests favorites',
    run: frequentDocument,
  },
  {
    id: 'R10',
    name: 'Unread files',
    description: 'Files added a month ago, never opened',
    run: unread,
  },
  {
    id: 'R11',
    name: 'Untidy library',
    description: 'Many files without tags or folder',
    run: untaggedLibrary,
  },
  {
    id: 'R12',
    name: 'Weekly and monthly summary',
    description: 'How the last week or month went',
    run: summary,
  },
  {
    id: 'R13',
    name: 'Backup reminders',
    description: 'Every two weeks when data changed',
    run: backupReminder,
  },
  {
    id: 'R14',
    name: 'Storage space',
    description: 'When storage is over 80% full',
    run: storageHigh,
  },
];

/** Runs every enabled rule and ranks the results: most important first. */
export function evaluateRules(
  ctx: InsightContext,
  disabled: readonly string[] = [],
): InsightCandidate[] {
  const order = new Map(RULES.map((r, i) => [r.id, i]));
  return RULES.filter((r) => !disabled.includes(r.id))
    .flatMap((r) => r.run(ctx))
    .sort((a, b) => b.severity - a.severity || order.get(a.ruleId)! - order.get(b.ruleId)!);
}
