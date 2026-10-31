import { toast } from '@/design-system';
import { ImportError, importFile } from '@/data/files/importer';
import { useImportQueue } from './importStore';

let running = false;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Imports waiting files one at a time (hashing runs in a worker, so the page stays
 * responsive). Safe to call repeatedly: only one run is active, and it picks up files
 * added while it works.
 */
export async function runImports(): Promise<void> {
  if (running) return;
  running = true;
  let added = 0;
  let duplicates = 0;
  let failed = 0;
  const { update } = useImportQueue.getState();
  try {
    for (;;) {
      const item = useImportQueue.getState().items.find((i) => i.status === 'waiting');
      if (!item) break;
      update(item.id, { status: 'hashing', progress: 0, error: undefined });
      try {
        const result = await importFile(item.file, {
          folderId: item.folderId,
          tagIds: item.tagIds,
          allowDuplicate: item.allowDuplicate,
          knownHash: item.allowDuplicate ? item.duplicate?.hash : undefined,
          onProgress: (stage, fraction) => update(item.id, { status: stage, progress: fraction }),
        });
        if (result.status === 'added') {
          added++;
          update(item.id, { status: 'done', progress: 1, documentId: result.document.id });
        } else {
          duplicates++;
          const existing = result.existing[0]!;
          update(item.id, {
            status: 'duplicate',
            progress: null,
            duplicate: {
              hash: result.hash,
              existingId: existing.id,
              existingTitle: existing.title,
            },
          });
        }
      } catch (err) {
        failed++;
        update(item.id, {
          status: 'error',
          progress: null,
          error: err instanceof ImportError ? err.message : "Couldn't add this file.",
        });
      }
    }
  } finally {
    running = false;
  }

  const parts = [
    added && plural(added, 'file added', 'files added'),
    duplicates && plural(duplicates, 'duplicate', 'duplicates'),
    failed && `${failed} couldn't be added`,
  ].filter(Boolean);
  if (parts.length) toast({ tone: failed ? 'error' : 'success', message: parts.join(' · ') });

  // Files queued in the moment between the loop ending and `running` resetting.
  if (useImportQueue.getState().items.some((i) => i.status === 'waiting')) await runImports();
}
