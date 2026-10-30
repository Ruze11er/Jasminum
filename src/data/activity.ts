import { clock } from '@/lib/clock';
import { uuidv7 } from '@/lib/ids';
import { db } from './db';
import type { ActivityEntry, ActivityType, EntityType } from './types';

/**
 * Records something the user did, for insights and summaries. Local only, never sent anywhere.
 * Call inside a transaction that includes `db.activity` so the log and the change commit together.
 */
export async function logActivity(
  type: ActivityType,
  entityType: EntityType | 'app',
  entityId: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  const now = clock.now();
  const entry: ActivityEntry = { id: uuidv7(now), at: now, type, entityType, entityId };
  if (meta) entry.meta = meta;
  await db.activity.add(entry);
}

/** Most recent activity first. */
export function recentActivity(limit = 50) {
  return db.activity.orderBy('at').reverse().limit(limit).toArray();
}
