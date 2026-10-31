import { describe, expect, it } from 'vitest';
import type { ActivityEntry, Category, DailyStats, LibraryDocument, Task } from '@/data/types';
import { DAY_MS } from '@/lib/clock';
import { addLocalDays } from '@/lib/dates';
import {
  backupReminder,
  deadlineSoon,
  evaluateRules,
  frequentDocument,
  heavyDay,
  oftenPostponed,
  overdue,
  productivePattern,
  RULES,
  stale,
  storageHigh,
  streakOrWin,
  summary,
  unorganized,
  unread,
  untaggedLibrary,
} from './rules';
import type { InsightContext } from './types';

// ---------- fixtures ----------
// "Now" is Wednesday, Nov 4, 2026 at 10:00 local time; weeks start on Monday (Nov 2).
const TODAY = '2026-11-04';
const at = (date: string, time = '10:00') => new Date(`${date}T${time}:00`).getTime();
const NOW = at(TODAY);

let seq = 0;
function task(extra: Partial<Task> = {}): Task {
  seq++;
  return {
    id: `t${seq}`,
    title: `Task ${seq}`,
    description: '',
    status: 'todo',
    priority: 0,
    dueDate: null,
    dueTime: null,
    scheduledDate: null,
    completedAt: null,
    categoryId: null,
    tagIds: [],
    rrule: null,
    seriesId: null,
    postponeCount: 0,
    originalDueDate: null,
    reminderAt: null,
    order: seq,
    createdAt: NOW - DAY_MS,
    updatedAt: NOW - DAY_MS,
    deletedAt: null,
    ...extra,
  };
}
const doneOn = (date: string, time = '10:00', extra: Partial<Task> = {}) =>
  task({ status: 'done', completedAt: at(date, time), ...extra });

function doc(extra: Partial<LibraryDocument> = {}): LibraryDocument {
  seq++;
  return {
    id: `d${seq}`,
    title: `File ${seq}`,
    originalFilename: `file${seq}.pdf`,
    mimeType: 'application/pdf',
    ext: 'pdf',
    kind: 'pdf',
    size: 1000,
    hash: 'a'.repeat(64),
    storageKey: `sha256-${'a'.repeat(64)}`,
    thumbKey: null,
    folderId: null,
    tagIds: [],
    description: '',
    favorite: 0,
    addedAt: NOW - DAY_MS,
    lastOpenedAt: null,
    openCount: 0,
    fileMissing: 0,
    createdAt: NOW - DAY_MS,
    updatedAt: NOW - DAY_MS,
    deletedAt: null,
    ...extra,
  };
}

const opened = (documentId: string, when: number): ActivityEntry => ({
  id: `a${++seq}`,
  at: when,
  type: 'document.opened',
  entityType: 'document',
  entityId: documentId,
});

const stats = (date: string, tasksCompleted: number): DailyStats => ({
  date,
  tasksCreated: 0,
  tasksCompleted,
  tasksDue: 0,
  tasksOverdue: 0,
  tasksPostponed: 0,
  notesEdited: 0,
  docsAdded: 0,
  docsOpened: 0,
});

function ctx(extra: Partial<InsightContext> = {}): InsightContext {
  return {
    now: NOW,
    today: TODAY,
    weekStartsOn: 1,
    tasks: [],
    documents: [],
    categories: [],
    activity: [],
    dailyStats: [],
    lastBackupAt: null,
    firstDataAt: null,
    lastDataChangeAt: null,
    storage: null,
    ...extra,
  };
}

// ---------- tests ----------

describe('a new user', () => {
  it('sees no insights at all', () => {
    expect(evaluateRules(ctx())).toEqual([]);
    expect(evaluateRules(ctx({ storage: { usage: 1_000, quota: 10_000_000 } }))).toEqual([]);
  });

  it('sees nothing on day one with a few fresh tasks and files', () => {
    const tasks = [task({ dueDate: TODAY }), task(), doneOn(TODAY)];
    expect(
      evaluateRules(
        ctx({ tasks, documents: [doc()], firstDataAt: NOW - 3600_000, lastDataChangeAt: NOW }),
      ),
    ).toEqual([]);
  });
});

describe('R1 overdue', () => {
  it('counts open tasks before today', () => {
    const tasks = [
      task({ dueDate: '2026-11-01' }),
      task({ dueDate: '2026-11-03', title: 'Pay rent' }),
      task({ dueDate: TODAY }),
      task({ dueDate: '2026-11-01', status: 'done', completedAt: NOW }),
      task({ dueDate: '2026-11-01', deletedAt: NOW }),
    ];
    const [insight] = overdue(ctx({ tasks }));
    expect(insight).toMatchObject({
      ruleId: 'R1',
      fingerprint: `R1:${TODAY}`,
      title: '2 tasks are overdue',
    });
    expect(insight!.actions.map((a) => a.type)).toEqual(['move-overdue-today', 'open-tasks']);
    expect(overdue(ctx({ tasks: [tasks[1]!] }))[0]!.title).toBe('“Pay rent” is overdue');
  });

  it('is quiet when nothing is late', () => {
    expect(overdue(ctx({ tasks: [task({ dueDate: TODAY }), task()] }))).toEqual([]);
  });
});

describe('R2 often postponed', () => {
  it('flags tasks moved three or more times, most moved first', () => {
    const a = task({ postponeCount: 3, priority: 2, title: 'Read ch. 4' });
    const b = task({ postponeCount: 5, priority: 0 });
    const result = oftenPostponed(ctx({ tasks: [a, b, task({ postponeCount: 2 })] }));
    expect(result.map((r) => r.fingerprint)).toEqual([`R2:${b.id}:5`, `R2:${a.id}:3`]);
    expect(result[1]!.title).toBe('“Read ch. 4” was moved 3 times');
    expect(result[1]!.actions.map((x) => x.type)).toEqual([
      'open-task',
      'lower-priority',
      'delete-task',
    ]);
    // No "lower priority" when it's already none.
    expect(result[0]!.actions.map((x) => x.type)).toEqual(['open-task', 'delete-task']);
  });

  it('ignores finished tasks', () => {
    expect(oftenPostponed(ctx({ tasks: [doneOn(TODAY, '09:00', { postponeCount: 6 })] }))).toEqual(
      [],
    );
  });
});

describe('R3 heavy day ahead', () => {
  const day = addLocalDays(TODAY, 2); // Friday
  it('flags a day with more than max(8, 1.5 × the 28-day average)', () => {
    const tasks = Array.from({ length: 9 }, () => task({ dueDate: day }));
    const [insight] = heavyDay(ctx({ tasks }));
    expect(insight).toMatchObject({
      fingerprint: `R3:${day}`,
      title: 'Friday looks packed (9 tasks)',
    });
    expect(insight!.actions.map((a) => a.type)).toEqual(['spread-day', 'open-calendar-day']);
  });

  it('allows more on a day when you usually finish a lot', () => {
    // An average of 10 a day raises the limit to 15.
    const dailyStats = Array.from({ length: 28 }, (_, i) => stats(addLocalDays(TODAY, -1 - i), 10));
    const tasks = Array.from({ length: 12 }, () => task({ dueDate: day }));
    expect(heavyDay(ctx({ tasks, dailyStats }))).toEqual([]);
    const more = Array.from({ length: 16 }, () => task({ dueDate: day }));
    expect(heavyDay(ctx({ tasks: more, dailyStats }))).toHaveLength(1);
  });

  it('only looks at the next seven days', () => {
    const tasks = Array.from({ length: 12 }, () => task({ dueDate: addLocalDays(TODAY, 8) }));
    expect(heavyDay(ctx({ tasks }))).toEqual([]);
  });
});

describe('R4 deadline soon', () => {
  it('flags high-priority tasks due within 48 hours', () => {
    const today = task({ priority: 3, dueDate: TODAY, title: 'Essay' });
    const tomorrow = task({ priority: 3, dueDate: addLocalDays(TODAY, 1) });
    const later = task({ priority: 3, dueDate: addLocalDays(TODAY, 3) });
    const low = task({ priority: 2, dueDate: TODAY });
    const result = deadlineSoon(ctx({ tasks: [later, tomorrow, low, today] }));
    expect(result.map((r) => r.fingerprint)).toEqual([
      `R4:${today.id}:${TODAY}`,
      `R4:${tomorrow.id}:2026-11-05`,
    ]);
    expect(result[0]).toMatchObject({ severity: 5, title: '“Essay” is due today' });
    expect(result[1]!.severity).toBe(4);
  });

  it('uses the time when there is one', () => {
    const in49h = task({ priority: 3, dueDate: addLocalDays(TODAY, 2), dueTime: '11:00' });
    const in47h = task({ priority: 3, dueDate: addLocalDays(TODAY, 2), dueTime: '09:00' });
    expect(deadlineSoon(ctx({ tasks: [in49h, in47h] })).map((r) => r.fingerprint)).toEqual([
      `R4:${in47h.id}:2026-11-06`,
    ]);
  });
});

describe('R5 unorganized', () => {
  const old = (extra: Partial<Task> = {}) => task({ createdAt: NOW - 8 * DAY_MS, ...extra });
  it('needs five old tasks with no date and no category', () => {
    const five = Array.from({ length: 5 }, () => old());
    expect(unorganized(ctx({ tasks: five }))).toMatchObject([
      { ruleId: 'R5', title: '5 tasks need a home', fingerprint: 'R5:2026-11-02' },
    ]);
    expect(unorganized(ctx({ tasks: five.slice(0, 4) }))).toEqual([]);
    const notReally = [...five.slice(0, 4), old({ categoryId: 'c' }), task()];
    expect(unorganized(ctx({ tasks: notReally }))).toEqual([]);
  });
});

describe('R6 stale', () => {
  it('flags open tasks untouched for 30 days', () => {
    const forgotten = task({ updatedAt: NOW - 31 * DAY_MS, title: 'Fix bike' });
    const [one] = stale(ctx({ tasks: [forgotten, task()] }));
    expect(one).toMatchObject({
      title: '“Fix bike” hasn’t been touched in a month'.replace('’', "'"),
    });
    expect(one!.actions.map((a) => a.type)).toEqual(['open-task', 'delete-task']);
    const many = stale(ctx({ tasks: [forgotten, task({ updatedAt: NOW - 40 * DAY_MS })] }));
    expect(many[0]!.title).toBe("2 tasks haven't been touched in a month");
    expect(stale(ctx({ tasks: [task({ updatedAt: NOW - 29 * DAY_MS })] }))).toEqual([]);
  });
});

describe('R7 productive pattern', () => {
  it('needs 20 completions over 14 days, then names the best day and time', () => {
    // Tuesdays (Oct 6 … Nov 3) in the morning, plus some other days.
    const tuesdays = ['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27', '2026-11-03'];
    const tasks = [
      ...tuesdays.flatMap((d) => [doneOn(d, '09:00'), doneOn(d, '10:30')]),
      ...Array.from({ length: 10 }, (_, i) => doneOn(addLocalDays('2026-10-08', i * 2), '15:00')),
    ];
    const [insight] = productivePattern(ctx({ tasks }));
    expect(insight).toMatchObject({ ruleId: 'R7', tone: 'info' });
    expect(insight!.title).toMatch(/Tuesdays, usually in the morning/);
    expect(productivePattern(ctx({ tasks: tasks.slice(0, 19) }))).toEqual([]);
  });

  it('stays quiet when the completions are bunched into a few days', () => {
    const tasks = Array.from({ length: 30 }, (_, i) =>
      doneOn(addLocalDays(TODAY, -(i % 5)), '09:00'),
    );
    expect(productivePattern(ctx({ tasks }))).toEqual([]);
  });
});

describe('R8 streak or win', () => {
  it('celebrates three or more days in a row', () => {
    const tasks = ['2026-11-02', '2026-11-03', TODAY].map((d) => doneOn(d));
    expect(streakOrWin(ctx({ tasks }))).toMatchObject([
      {
        tone: 'positive',
        title: '3 days in a row with something done',
        fingerprint: `R8:streak:${TODAY}`,
      },
    ]);
    // Without today yet, it encourages keeping it alive.
    const yesterday = streakOrWin(ctx({ tasks: tasks.slice(0, 2).concat(doneOn('2026-11-01')) }));
    expect(yesterday[0]!.why).toMatch(/keep the streak alive/);
  });

  it('celebrates beating last week', () => {
    const lastWeek = ['2026-10-26', '2026-10-28', '2026-10-30'].map((d) => doneOn(d));
    const thisWeek = ['2026-11-02', '2026-11-02', '2026-11-02', '2026-11-02'].map((d) => doneOn(d));
    expect(streakOrWin(ctx({ tasks: [...lastWeek, ...thisWeek] }))).toMatchObject([
      {
        fingerprint: 'R8:week:2026-11-02',
        title: '4 tasks done this week, more than all of last week',
      },
    ]);
    expect(streakOrWin(ctx({ tasks: lastWeek }))).toEqual([]);
  });
});

describe('R9 frequently used document', () => {
  it('suggests a favorite after five opens in two weeks', () => {
    const d = doc({ title: 'Timetable' });
    const activity = Array.from({ length: 5 }, (_, i) => opened(d.id, NOW - i * DAY_MS));
    expect(frequentDocument(ctx({ documents: [d], activity }))).toMatchObject([
      { fingerprint: `R9:${d.id}`, title: "You've opened “Timetable” 5 times lately" },
    ]);
    expect(frequentDocument(ctx({ documents: [{ ...d, favorite: 1 }], activity }))).toEqual([]);
    const oldOpens = activity.map((a) => ({ ...a, at: NOW - 20 * DAY_MS }));
    expect(frequentDocument(ctx({ documents: [d], activity: oldOpens }))).toEqual([]);
  });
});

describe('R10 unread material', () => {
  it('mentions files added a month ago and never opened', () => {
    const old = doc({ addedAt: NOW - 31 * DAY_MS, title: 'Syllabus' });
    expect(unread(ctx({ documents: [old, doc()] }))[0]!.title).toBe(
      "You added “Syllabus” a month ago and haven't opened it",
    );
    expect(unread(ctx({ documents: [{ ...old, openCount: 1 }] }))).toEqual([]);
    const two = unread(ctx({ documents: [old, doc({ addedAt: NOW - 40 * DAY_MS })] }));
    expect(two[0]!.title).toBe("2 files you added a month ago haven't been opened");
  });
});

describe('R11 untagged library', () => {
  it('needs ten files with neither tags nor folder', () => {
    const loose = Array.from({ length: 10 }, () => doc());
    expect(untaggedLibrary(ctx({ documents: loose }))[0]!.title).toBe(
      '10 files have no tags or folder',
    );
    const tidy = [...loose.slice(0, 9), doc({ tagIds: ['t'] }), doc({ folderId: 'f' })];
    expect(untaggedLibrary(ctx({ documents: tidy }))).toEqual([]);
  });
});

describe('R12 summaries', () => {
  const school: Category = {
    id: 'c1',
    name: 'School',
    color: 'pink',
    icon: 'x',
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  };
  it('sums up last week on Monday and Tuesday', () => {
    const tasks = [
      ...['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'].map((d) =>
        doneOn(d, '10:00', { categoryId: 'c1' }),
      ),
      ...['2026-10-20', '2026-10-21'].map((d) => doneOn(d)),
    ];
    const monday = summary(
      ctx({ tasks, categories: [school], today: '2026-11-02', now: at('2026-11-02') }),
    );
    // Nov 2 is also the 2nd of the month, so October's summary appears too.
    expect(monday.map((m) => m.fingerprint)).toEqual(['R12:week:2026-10-26', 'R12:month:2026-10']);
    expect(monday[0]).toMatchObject({
      title: 'Last week: 4 tasks done',
      why: "That's up 100% on the period before. Most were in School.",
    });
    expect(summary(ctx({ tasks, categories: [school] }))).toEqual([]); // Wednesday
  });

  it('sums up last month on the 1st and 2nd', () => {
    const tasks = [doneOn('2026-10-10'), doneOn('2026-10-20'), doneOn('2026-09-15')];
    const result = summary(
      ctx({ tasks, today: '2026-11-01', now: at('2026-11-01'), weekStartsOn: 1 }),
    );
    const month = result.find((r) => r.fingerprint.startsWith('R12:month'));
    expect(month).toMatchObject({
      fingerprint: 'R12:month:2026-10',
      title: 'October: 2 tasks done',
    });
    expect(month!.why).toBe("That's up 100% on the period before.");
  });

  it('stays quiet without any finished tasks', () => {
    expect(summary(ctx({ today: '2026-11-02', now: at('2026-11-02') }))).toEqual([]);
  });
});

describe('R13 backup reminder', () => {
  it('reminds two weeks after the first data if there was never a backup', () => {
    const base = { firstDataAt: NOW - 15 * DAY_MS, lastDataChangeAt: NOW - DAY_MS };
    expect(backupReminder(ctx(base))[0]!.title).toBe("You haven't made a backup yet");
    expect(backupReminder(ctx({ ...base, firstDataAt: NOW - 10 * DAY_MS }))).toEqual([]);
  });

  it('reminds when the last backup is old and data changed since', () => {
    const base = { firstDataAt: NOW - 60 * DAY_MS, lastBackupAt: NOW - 20 * DAY_MS };
    expect(backupReminder(ctx({ ...base, lastDataChangeAt: NOW - DAY_MS }))[0]!.title).toBe(
      'Your last backup was 20 days ago',
    );
    expect(backupReminder(ctx({ ...base, lastDataChangeAt: NOW - 25 * DAY_MS }))).toEqual([]);
    expect(
      backupReminder(ctx({ ...base, lastBackupAt: NOW - 5 * DAY_MS, lastDataChangeAt: NOW })),
    ).toEqual([]);
  });
});

describe('R14 storage high', () => {
  it('warns above 80% of the quota', () => {
    expect(storageHigh(ctx({ storage: { usage: 85, quota: 100 } }))[0]!.title).toBe(
      'Storage is 85% full',
    );
    expect(storageHigh(ctx({ storage: { usage: 80, quota: 100 } }))).toEqual([]);
    expect(storageHigh(ctx({ storage: { usage: 5, quota: 0 } }))).toEqual([]);
  });
});

describe('ranking and switching rules off', () => {
  it('puts the most important first and skips disabled rules', () => {
    const tasks = [
      task({ dueDate: '2026-11-01' }), // R1, severity 4
      task({ priority: 3, dueDate: TODAY }), // R4, severity 5
      ...['2026-11-02', '2026-11-03'].map((d) => doneOn(d)),
      doneOn(TODAY), // R8, severity 1
    ];
    const all = evaluateRules(ctx({ tasks }));
    expect(all.map((i) => i.ruleId)).toEqual(['R4', 'R1', 'R8']);
    expect(evaluateRules(ctx({ tasks }), ['R4', 'R8']).map((i) => i.ruleId)).toEqual(['R1']);
  });

  it('has fourteen rules with names', () => {
    expect(RULES.map((r) => r.id)).toEqual(Array.from({ length: 14 }, (_, i) => `R${i + 1}`));
    for (const r of RULES) expect(r.name.length).toBeGreaterThan(3);
  });
});
