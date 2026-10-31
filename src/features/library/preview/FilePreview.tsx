import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { FileQuestion } from 'lucide-react';
import type { LibraryDocument } from '@/data/types';
import { formatBytes } from '@/lib/format';
import { previewTypeOf } from '@/lib/fileKinds';

// pdf.js is large: downloaded only when a PDF is opened.
const PdfPreview = lazy(() => import('./PdfPreview'));

/** Text previews show the start of the file, so a huge log can't freeze the page. */
export const TEXT_PREVIEW_BYTES = 512 * 1024;

/** The built-in preview for images, PDFs and text. Other types get a short note instead. */
export function FilePreview({ doc, blob }: { doc: LibraryDocument; blob: Blob }) {
  const type = previewTypeOf(doc.kind, doc.ext);
  if (type === 'image') return <ImagePreview blob={blob} title={doc.title} />;
  if (type === 'text') return <TextPreview blob={blob} />;
  if (type === 'pdf') {
    return (
      <Suspense
        fallback={
          <div
            aria-busy="true"
            aria-label="Loading PDF"
            className="h-96 animate-pulse rounded-xl bg-surface-muted"
          />
        }
      >
        <PdfPreview blob={blob} title={doc.title} />
      </Suspense>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-surface-muted px-6 py-12 text-center">
      <FileQuestion className="size-8 text-fg-muted" aria-hidden="true" />
      <p className="font-semibold">No preview for this type of file</p>
      <p className="max-w-xs text-sm text-fg-muted">
        Use Download or Share to open it in another app.
      </p>
    </div>
  );
}

function ImagePreview({ blob, title }: { blob: Blob; title: string }) {
  const img = useRef<HTMLImageElement>(null);
  // The object URL is created and freed with the element, so nothing leaks.
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    if (img.current) img.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  // SVGs are safe here: scripts never run inside an <img>.
  return (
    <div className="flex justify-center rounded-xl bg-surface-muted p-2">
      <img ref={img} alt={title} className="max-h-[70vh] max-w-full object-contain" />
    </div>
  );
}

function TextPreview({ blob }: { blob: Blob }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void blob
      .slice(0, TEXT_PREVIEW_BYTES)
      .text()
      .then((t) => !cancelled && setText(t));
    return () => {
      cancelled = true;
    };
  }, [blob]);
  return (
    <div className="space-y-2">
      <pre
        tabIndex={0}
        aria-label="File contents"
        className="max-h-[70vh] overflow-auto rounded-xl bg-surface-muted p-4 font-mono text-sm break-words whitespace-pre-wrap"
      >
        {text ?? 'Loading…'}
      </pre>
      {blob.size > TEXT_PREVIEW_BYTES && (
        <p className="text-sm text-fg-muted">
          Showing the first {formatBytes(TEXT_PREVIEW_BYTES)} of {formatBytes(blob.size)}.
        </p>
      )}
    </div>
  );
}
