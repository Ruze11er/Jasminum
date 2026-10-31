import type { Table } from 'dexie';
import { db } from './db';
import { getFileStore } from './files';
import type { ChecklistItem, EntityType, LibraryDocument, Link } from './types';

/**
 * Finds things that don't add up, so Settings can offer to fix them:
 * - stored file bytes no document uses (wasted space, e.g. after an interrupted import),
 * - documents whose bytes are gone (e.g. the browser cleared storage),
 * - links pointing at items that were erased,
 * - checklist items whose task was erased.
 */

export interface IntegrityReport {
  orphanFiles: { key: string; size: number }[];
  missingFiles: LibraryDocument[];
  danglingLinks: Link[];
  orphanChecklistItems: ChecklistItem[];
}

export const isClean = (r: IntegrityReport) =>
  !r.orphanFiles.length &&
  !r.missingFiles.length &&
  !r.danglingLinks.length &&
  !r.orphanChecklistItems.length;

const linkTables: Partial<Record<EntityType, () => Table<{ id: string }, string>>> = {
  task: () => db.tasks,
  event: () => db.events,
  note: () => db.notes,
  document: () => db.documents,
  folder: () => db.folders,
  tag: () => db.tags,
  category: () => db.categories,
  checklistItem: () => db.checklistItems,
};

export async function checkIntegrity(): Promise<IntegrityReport> {
  const store = await getFileStore();
  const docs = await db.documents.toArray();
  const used = new Set(docs.map((d) => d.storageKey));

  const orphanFiles: IntegrityReport['orphanFiles'] = [];
  for (const key of await store.keys()) {
    // Only file bytes are checked; snapshots and other internal files are left alone.
    if (!key.startsWith('sha256-') || used.has(key)) continue;
    orphanFiles.push({ key, size: (await store.get(key))?.size ?? 0 });
  }

  const missingFiles: LibraryDocument[] = [];
  for (const d of docs) if (!(await store.has(d.storageKey))) missingFiles.push(d);

  const exists = async (type: EntityType, id: string) => {
    const table = linkTables[type];
    return table ? (await table().get(id)) !== undefined : false;
  };
  const danglingLinks: Link[] = [];
  for (const link of await db.links.toArray()) {
    if (!(await exists(link.fromType, link.fromId)) || !(await exists(link.toType, link.toId))) {
      danglingLinks.push(link);
    }
  }

  const taskIds = new Set(await db.tasks.toCollection().primaryKeys());
  const orphanChecklistItems = (await db.checklistItems.toArray()).filter(
    (i) => !taskIds.has(i.taskId),
  );

  return { orphanFiles, missingFiles, danglingLinks, orphanChecklistItems };
}

export interface IntegrityFixResult {
  removedFiles: number;
  freedBytes: number;
  flaggedMissing: number;
  removedLinks: number;
  removedChecklistItems: number;
}

/** Fixes what `checkIntegrity` found. Documents with missing bytes are flagged, not deleted. */
export async function fixIntegrity(report: IntegrityReport): Promise<IntegrityFixResult> {
  const store = await getFileStore();
  // Re-check each orphan right before deleting it, in case a file was imported meanwhile.
  const used = new Set((await db.documents.toArray()).map((d) => d.storageKey));
  let removedFiles = 0;
  let freedBytes = 0;
  for (const f of report.orphanFiles) {
    if (used.has(f.key)) continue;
    await store.delete(f.key);
    removedFiles++;
    freedBytes += f.size;
  }
  await db.transaction('rw', [db.documents, db.links, db.checklistItems], async () => {
    for (const d of report.missingFiles) await db.documents.update(d.id, { fileMissing: 1 });
    await db.links.bulkDelete(report.danglingLinks.map((l) => l.id));
    await db.checklistItems.bulkDelete(report.orphanChecklistItems.map((i) => i.id));
  });
  return {
    removedFiles,
    freedBytes,
    flaggedMissing: report.missingFiles.length,
    removedLinks: report.danglingLinks.length,
    removedChecklistItems: report.orphanChecklistItems.length,
  };
}
