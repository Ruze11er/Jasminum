import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { IconButton } from '@/design-system';

// The PDF engine runs in its own worker. Both are lazy chunks, precached for offline use.
GlobalWorkerOptions.workerSrc = workerUrl;

const ZOOMS = [0.75, 1, 1.25, 1.5, 2];

/**
 * One page at a time, fitted to the width. Light on memory for big textbooks. No font or
 * CMap URLs are set, so pdf.js never reaches for the network.
 */
export default function PdfPreview({ blob, title }: { blob: Blob; title: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof getDocument> | null = null;
    void (async () => {
      try {
        const data = new Uint8Array(await blob.arrayBuffer());
        if (cancelled) return;
        task = getDocument({ data, enableXfa: false });
        const loaded = await task.promise;
        if (!cancelled) setDoc(loaded);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      // Frees the worker's copy of the document.
      void task?.destroy();
    };
  }, [blob]);

  // Re-render when the available width changes (rotation, resizing).
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry!.contentRect.width)),
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !width || !canvasRef.current) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    void (async () => {
      const p = await doc.getPage(page);
      if (cancelled) return;
      const base = p.getViewport({ scale: 1 });
      const scale = (width / base.width) * zoom;
      const ratio = window.devicePixelRatio || 1;
      const viewport = p.getViewport({ scale: scale * ratio });
      const canvas = canvasRef.current!;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
      canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
      task = p.render({ canvas, viewport });
      await task.promise.catch(() => undefined);
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, width, zoom]);

  if (error) {
    return (
      <p className="px-4 py-10 text-center text-fg-muted">
        This PDF couldn't be shown. Try Download or Open instead.
      </p>
    );
  }

  const pages = doc?.numPages ?? 0;
  const zoomIndex = ZOOMS.indexOf(zoom);
  return (
    <div className="flex flex-col gap-2">
      <div
        role="toolbar"
        aria-label="PDF pages"
        className="flex items-center gap-1 rounded-xl bg-surface-muted p-1"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setPage((n) => Math.min(pages, n + 1));
          if (e.key === 'ArrowLeft') setPage((n) => Math.max(1, n - 1));
        }}
      >
        <IconButton
          label="Previous page"
          icon={<ChevronLeft />}
          disabled={page <= 1}
          onClick={() => setPage((n) => n - 1)}
        />
        <span className="min-w-20 text-center text-sm font-semibold" aria-live="polite">
          {pages ? `Page ${page} of ${pages}` : 'Loading…'}
        </span>
        <IconButton
          label="Next page"
          icon={<ChevronRight />}
          disabled={page >= pages}
          onClick={() => setPage((n) => n + 1)}
        />
        <span className="flex-1" />
        <IconButton
          label="Zoom out"
          icon={<Minus />}
          disabled={zoomIndex <= 0}
          onClick={() => setZoom(ZOOMS[zoomIndex - 1]!)}
        />
        <IconButton
          label="Zoom in"
          icon={<Plus />}
          disabled={zoomIndex >= ZOOMS.length - 1}
          onClick={() => setZoom(ZOOMS[zoomIndex + 1]!)}
        />
      </div>
      <div ref={boxRef} className="overflow-auto rounded-xl bg-surface-muted">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${title}, page ${page}`}
          className="mx-auto block bg-white"
        />
      </div>
    </div>
  );
}
