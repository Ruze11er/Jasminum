import { liveQuery } from 'dexie';
import { db } from '@/data/db';
import { refreshDailyStats } from '@/data/dailyStats';
import { insightsRepo } from '@/data/repos/insights';
import { getSetting } from '@/data/repos/settings';
import { clock, DAY_MS } from '@/lib/clock';
import { localDateOf } from '@/lib/dates';
import { setAppBadge } from '@/platform/badge';
import { getStorageEstimate } from '@/platform/storage';
import { evaluateRules } from './engine/rules';
import type { InsightCandidate, InsightContext } from './engine/types';

/** Gathers the snapshot the rules look at. */
export async function buildContext(now = clock.now()): Promise<InsightContext> {
  const [
    tasks,
    documents,
    categories,
    notes,
    events,
    activity,
    dailyStats,
    lastBackupAt,
    weekStartsOn,
    storage,
  ] = await Promise.all([
    db.tasks.toArray(),
    db.documents.toArray(),
    db.categories.filter((c) => !c.deletedAt).toArray(),
    db.notes.toArray(),
    db.events.toArray(),
    db.activity
      .where('at')
      .above(now - 60 * DAY_MS)
      .toArray(),
    refreshDailyStats(now),
    getSetting('lastBackupAt'),
    getSetting('weekStartsOn'),
    getStorageEstimate(),
  ]);
  const everything = [...tasks, ...documents, ...notes, ...events];
  return {
    now,
    today: localDateOf(now),
    weekStartsOn,
    tasks: tasks.filter((t) => !t.deletedAt),
    documents: documents.filter((d) => !d.deletedAt),
    categories,
    activity,
    dailyStats,
    lastBackupAt,
    firstDataAt: everything.length ? Math.min(...everything.map((e) => e.createdAt)) : null,
    lastDataChangeAt: everything.length ? Math.max(...everything.map((e) => e.updatedAt)) : null,
    storage: storage && { usage: storage.usage, quota: storage.quota },
  };
}

export const overdueCount = (ctx: InsightContext) =>
  ctx.tasks.filter((t) => t.status === 'todo' && t.dueDate !== null && t.dueDate < ctx.today)
    .length;

export const toPayload = (c: InsightCandidate) => ({
  tone: c.tone,
  title: c.title,
  why: c.why,
  actions: c.actions,
});

/** Runs every enabled rule now and stores the results. */
export async function runInsightsNow(now = clock.now()): Promise<InsightCandidate[]> {
  const [ctx, prefs] = await Promise.all([buildContext(now), getSetting('insightPrefs')]);
  const candidates = evaluateRules(ctx, prefs.disabledRules);
  // The app icon shows how many tasks are overdue (where the browser supports badges).
  void setAppBadge(overdueCount(ctx));
  await insightsRepo.sync(
    candidates.map((c) => ({
      ruleId: c.ruleId,
      fingerprint: c.fingerprint,
      severity: c.severity,
      payload: toPayload(c),
    })),
    now,
  );
  return candidates;
}

const DEBOUNCE_MS = 2000;

/**
 * Keeps insights fresh while the app is open: once at start, 2 seconds after any change
 * to tasks, events, notes, files or settings, after local midnight, and when the app comes
 * back to the front. Returns a function that stops it.
 */
export function startInsightRunner(): () => void {
  let stopped = false;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let midnight: ReturnType<typeof setTimeout> | undefined;
  let first = true;

  const run = () => {
    if (stopped) return;
    runInsightsNow().catch((err) => console.warn('Insights failed', err));
  };
  const soon = () => {
    clearTimeout(debounce);
    debounce = setTimeout(run, DEBOUNCE_MS);
  };
  const scheduleMidnight = () => {
    const now = clock.now();
    const next = new Date(now);
    next.setHours(24, 0, 5, 0);
    midnight = setTimeout(() => {
      run();
      scheduleMidnight();
    }, next.getTime() - now);
  };

  // Any write to these tables re-runs the observable, which (debounced) re-runs the rules.
  const subscription = liveQuery(() =>
    Promise.all([
      db.tasks.toCollection().primaryKeys(),
      db.tasks.orderBy('updatedAt').lastKey(),
      db.events.count(),
      db.notes.orderBy('updatedAt').lastKey(),
      db.documents.toArray(),
      db.settings.toArray(),
    ]),
  ).subscribe({
    next: () => {
      if (first) {
        first = false;
        run();
      } else soon();
    },
    error: (err) => console.warn('Insights watcher failed', err),
  });

  const onVisible = () => {
    if (document.visibilityState === 'visible') soon();
  };
  document.addEventListener('visibilitychange', onVisible);
  scheduleMidnight();

  return () => {
    stopped = true;
    subscription.unsubscribe();
    clearTimeout(debounce);
    clearTimeout(midnight);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
