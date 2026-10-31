import { clock, DAY_MS } from '@/lib/clock';
import { uuidv7 } from '@/lib/ids';
import { db } from '../db';
import type { Insight } from '../types';

/**
 * Stored insights and what the user decided about them. The rule engine produces
 * candidates; `sync` turns them into rows:
 * - new fingerprint → a new active insight,
 * - dismissed or acted on → stays hidden (the fingerprint changes when it's news again),
 * - snoozed → hidden until the snooze ends,
 * - active but no longer produced (e.g. the overdue tasks were done) → removed.
 * Old decisions are forgotten after 90 days.
 */

export interface InsightInput {
  ruleId: string;
  fingerprint: string;
  severity: number;
  payload: Record<string, unknown>;
}

export const SNOOZE_DAYS = 7;
const FORGET_AFTER = 90 * DAY_MS;

export const insightsRepo = {
  async sync(candidates: InsightInput[], now = clock.now()): Promise<void> {
    await db.transaction('rw', db.insights, async () => {
      const existing = await db.insights.toArray();
      const byFingerprint = new Map(existing.map((i) => [i.fingerprint, i]));
      const produced = new Set<string>();
      for (const c of candidates) {
        if (produced.has(c.fingerprint)) continue;
        produced.add(c.fingerprint);
        const row = byFingerprint.get(c.fingerprint);
        if (!row) {
          await db.insights.add({
            id: uuidv7(now),
            ruleId: c.ruleId,
            fingerprint: c.fingerprint,
            severity: c.severity,
            payload: c.payload,
            status: 'active',
            snoozedUntil: null,
            createdAt: now,
          });
          continue;
        }
        if (row.status === 'dismissed' || row.status === 'acted') continue;
        if (row.status === 'snoozed' && (row.snoozedUntil ?? 0) > now) continue;
        // Still relevant: refresh the wording (counts change) and wake it if snoozed.
        await db.insights.put({
          ...row,
          severity: c.severity,
          payload: c.payload,
          status: 'active',
          snoozedUntil: null,
        });
      }
      for (const row of existing) {
        const gone = row.status === 'active' && !produced.has(row.fingerprint);
        const forgotten = row.status !== 'active' && now - row.createdAt > FORGET_AFTER;
        if (gone || forgotten) await db.insights.delete(row.id);
      }
    });
  },

  /** Active insights, most important first, then newest. */
  async active(): Promise<Insight[]> {
    const rows = await db.insights.where('status').equals('active').toArray();
    return rows.sort((a, b) => b.severity - a.severity || b.createdAt - a.createdAt);
  },

  dismiss: (id: string) => db.insights.update(id, { status: 'dismissed' }),

  snooze: (id: string, now = clock.now()) =>
    db.insights.update(id, { status: 'snoozed', snoozedUntil: now + SNOOZE_DAYS * DAY_MS }),

  /** The user did what it suggested; it won't come back for the same situation. */
  markActed: (id: string) => db.insights.update(id, { status: 'acted' }),

  /** Undo for dismiss/snooze. */
  reactivate: (id: string) => db.insights.update(id, { status: 'active', snoozedUntil: null }),

  /** Removes every stored insight of a rule (when the user switches the rule off). */
  removeRule: (ruleId: string) => db.insights.filter((i) => i.ruleId === ruleId).delete(),
};
