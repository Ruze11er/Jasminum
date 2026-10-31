import { useEffect, useId, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CircleAlert, Download, ExternalLink, Share2, Star, Trash2 } from 'lucide-react';
import { Button, IconButton, Input, Select, Textarea, toast } from '@/design-system';
import { db } from '@/data/db';
import { documentsRepo, type DocumentInput } from '@/data/repos/documents';
import { foldersRepo } from '@/data/repos/folders';
import { tagsRepo } from '@/data/repos/tags';
import type { LibraryDocument } from '@/data/types';
import { cn } from '@/lib/cn';
import { KIND_LABELS } from '@/lib/fileKinds';
import { formatBytes } from '@/lib/format';
import { firstIssue } from '@/lib/validation';
import { canOpenInTab, canShareFiles, downloadFile, openInTab, shareFile } from '@/platform/share';
import { LinkedNotes } from '@/features/notes/LinkedNotes';
import { TagInput } from '@/features/tasks/editor/TagInput';
import { KindIcon } from '../components/KindIcon';
import { FilePreview } from '../preview/FilePreview';

/** One file: preview, details you can edit, and Open / Download / Share / Delete. */
export function DocumentDetail({ docId, onClose }: { docId: string; onClose: () => void }) {
  const doc = useLiveQuery(async () => (await db.documents.get(docId)) ?? null, [docId]);
  const [blob, setBlob] = useState<Blob | null | undefined>(undefined);
  const counted = useRef<string | null>(null);
  const exists = !!doc && !doc.deletedAt;

  // Load the bytes once per file (not on every metadata change), and count an open.
  const openId = exists ? doc.id : null;
  useEffect(() => {
    if (!openId) return;
    let cancelled = false;
    void (async () => {
      const current = await db.documents.get(openId);
      if (!current) return;
      const b = await documentsRepo.file(current);
      if (!cancelled) setBlob(b);
    })();
    if (counted.current !== openId) {
      counted.current = openId;
      void documentsRepo.markOpened(openId);
    }
    return () => {
      cancelled = true;
    };
  }, [openId]);

  if (doc === undefined) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading file"
        className="h-96 animate-pulse rounded-2xl bg-surface-muted"
      />
    );
  }
  if (!exists) {
    return (
      <div className="space-y-4">
        <IconButton label="Back to library" icon={<ArrowLeft />} onClick={onClose} />
        <p className="rounded-2xl border border-line bg-surface px-4 py-10 text-center text-fg-muted">
          This file no longer exists.
        </p>
      </div>
    );
  }

  return (
    <article aria-labelledby="doc-title" className="space-y-4">
      <div className="flex items-center gap-2">
        <IconButton label="Back to library" icon={<ArrowLeft />} onClick={onClose} />
        <KindIcon kind={doc.kind} className="size-9" />
        <h1 id="doc-title" className="min-w-0 flex-1 truncate text-xl md:text-2xl">
          {doc.title}
        </h1>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {blob === undefined ? (
            <div
              aria-busy="true"
              aria-label="Loading preview"
              className="h-80 animate-pulse rounded-xl bg-surface-muted"
            />
          ) : blob === null ? (
            <div
              role="alert"
              className="flex flex-col items-center gap-2 rounded-xl bg-danger-soft px-6 py-10 text-center"
            >
              <CircleAlert className="size-8 text-danger" aria-hidden="true" />
              <p className="font-semibold text-danger">This file's contents are missing</p>
              <p className="max-w-sm text-sm text-fg">
                The browser may have cleared them to free up space. Restore them from a backup, or
                delete this entry.
              </p>
            </div>
          ) : (
            <FilePreview doc={doc} blob={blob} />
          )}
        </div>
        <DetailsPanel doc={doc} blob={blob ?? null} onDeleted={onClose} />
      </div>
    </article>
  );
}

function DetailsPanel({
  doc,
  blob,
  onDeleted,
}: {
  doc: LibraryDocument;
  blob: Blob | null;
  onDeleted: () => void;
}) {
  const ids = { title: useId(), description: useId(), folder: useId(), tags: useId() };
  const [title, setTitle] = useState(doc.title);
  const [description, setDescription] = useState(doc.description);
  const lookups = useLiveQuery(async () => {
    const [folders, tags] = await Promise.all([
      foldersRepo.list('documents'),
      db.tags
        .orderBy('normalizedName')
        .filter((t) => !t.deletedAt)
        .toArray(),
    ]);
    return { folders, tags, tagById: new Map(tags.map((t) => [t.id, t.name])) };
  }, []);

  const save = async (patch: Partial<DocumentInput>) => {
    try {
      await documentsRepo.update(doc.id, patch);
      return true;
    } catch (err) {
      toast({ tone: 'error', message: firstIssue(err) ?? "Couldn't save the change" });
      return false;
    }
  };

  const asFile = () => blob && new File([blob], doc.originalFilename, { type: doc.mimeType });
  const file = asFile();
  const tagNames = doc.tagIds.map((id) => lookups?.tagById.get(id)).filter((n): n is string => !!n);

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-soft-sm">
      <div className="flex flex-wrap gap-2">
        {blob && canOpenInTab(doc.ext) && (
          <Button
            variant="secondary"
            size="sm"
            icon={<ExternalLink />}
            onClick={() => openInTab(blob, doc.ext)}
          >
            Open
          </Button>
        )}
        {blob && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Download />}
            onClick={() => downloadFile(blob, doc.originalFilename)}
          >
            Download
          </Button>
        )}
        {file && canShareFiles(file) && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Share2 />}
            onClick={() =>
              void shareFile(file, doc.title).catch(() =>
                toast({ tone: 'error', message: "Couldn't share this file" }),
              )
            }
          >
            Share
          </Button>
        )}
        <IconButton
          label={doc.favorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={!!doc.favorite}
          icon={<Star className={cn(doc.favorite && 'fill-current')} />}
          className={cn('ml-auto', doc.favorite && 'text-warning')}
          onClick={() => void documentsRepo.toggleFavorite(doc)}
        />
      </div>

      <div>
        <label htmlFor={ids.title} className="mb-1.5 block text-sm font-semibold">
          Name
        </label>
        <Input
          id={ids.title}
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() !== doc.title)
              void save({ title }).then((ok) => !ok && setTitle(doc.title));
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </div>

      <div>
        <label htmlFor={ids.description} className="mb-1.5 block text-sm font-semibold">
          Description
        </label>
        <Textarea
          id={ids.description}
          value={description}
          maxLength={2000}
          placeholder="What is it? Searchable."
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== doc.description && void save({ description })}
          className="min-h-20"
        />
      </div>

      <div>
        <label htmlFor={ids.folder} className="mb-1.5 block text-sm font-semibold">
          Folder
        </label>
        <Select
          id={ids.folder}
          value={doc.folderId ?? ''}
          onChange={(e) => void save({ folderId: e.target.value || null })}
        >
          <option value="">No folder</option>
          {lookups?.folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label htmlFor={ids.tags} className="mb-1.5 block text-sm font-semibold">
          Tags
        </label>
        <TagInput
          id={ids.tags}
          value={tagNames}
          suggestions={lookups?.tags.map((t) => t.name) ?? []}
          onChange={(names) =>
            void Promise.all(names.map((n) => tagsRepo.ensure(n))).then((tags) =>
              save({ tagIds: tags.map((t) => t.id) }),
            )
          }
        />
      </div>

      <dl className="divide-y divide-line text-sm">
        {[
          ['Type', `${KIND_LABELS[doc.kind].one}${doc.ext ? ` (.${doc.ext})` : ''}`],
          ['Size', formatBytes(doc.size)],
          ['Added', new Date(doc.addedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })],
          ['File name', doc.originalFilename],
          ['Opened', `${doc.openCount} ${doc.openCount === 1 ? 'time' : 'times'}`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 py-2">
            <dt className="text-fg-muted">{k}</dt>
            <dd className="min-w-0 text-right font-semibold break-words">{v}</dd>
          </div>
        ))}
      </dl>

      <LinkedNotes item={{ type: 'document', id: doc.id }} onOpen={() => undefined} />

      <Button
        variant="ghost"
        icon={<Trash2 />}
        className="text-danger hover:text-danger"
        onClick={() => {
          onDeleted();
          void documentsRepo.softDelete(doc.id).then(() =>
            toast({
              message: 'File moved to Trash',
              action: { label: 'Undo', onClick: () => void documentsRepo.restore(doc.id) },
            }),
          );
        }}
      >
        Delete
      </Button>
    </div>
  );
}
