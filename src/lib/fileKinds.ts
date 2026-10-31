import type { DocumentKind } from '@/data/types';

/**
 * Sorting imported files into kinds by extension (most reliable) and MIME type (fallback).
 * The kind picks the icon, the type filter and which preview is used.
 */

// prettier-ignore
const BY_EXT: Record<string, DocumentKind> = {
  pdf: 'pdf',
  doc: 'word', docx: 'word', odt: 'word', rtf: 'word', pages: 'word',
  ppt: 'slides', pptx: 'slides', odp: 'slides', key: 'slides',
  epub: 'ebook', mobi: 'ebook', azw: 'ebook', azw3: 'ebook', fb2: 'ebook', djvu: 'ebook',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', avif: 'image',
  svg: 'image', bmp: 'image', ico: 'image', heic: 'image', heif: 'image', tif: 'image', tiff: 'image',
  txt: 'text', md: 'text', markdown: 'text', json: 'text', log: 'text', xml: 'text',
  html: 'text', htm: 'text', css: 'text', js: 'text', ts: 'text', py: 'text', yaml: 'text', yml: 'text',
  xls: 'sheet', xlsx: 'sheet', ods: 'sheet', csv: 'sheet', tsv: 'sheet', numbers: 'sheet',
};

/** "Lecture 3.PDF" → "pdf". Empty when there is no extension. */
export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0 || dot === filename.length - 1) return '';
  return filename
    .slice(dot + 1)
    .toLowerCase()
    .slice(0, 12);
}

/** "Lecture 3.pdf" → "Lecture 3". */
export function baseName(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const name = dot > 0 ? filename.slice(0, dot) : filename;
  return name.trim() || filename.trim() || 'Untitled';
}

export function kindOf(filename: string, mimeType: string): DocumentKind {
  const byExt = BY_EXT[extensionOf(filename)];
  if (byExt) return byExt;
  const mime = mimeType.toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('text/')) return 'text';
  if (mime.includes('epub')) return 'ebook';
  if (mime.includes('word') || mime.includes('opendocument.text')) return 'word';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'slides';
  if (mime.includes('sheet') || mime.includes('excel')) return 'sheet';
  return 'other';
}

export const KIND_LABELS: Record<DocumentKind, { one: string; many: string }> = {
  pdf: { one: 'PDF', many: 'PDFs' },
  word: { one: 'Document', many: 'Documents' },
  slides: { one: 'Slides', many: 'Slides' },
  ebook: { one: 'Ebook', many: 'Ebooks' },
  image: { one: 'Image', many: 'Images' },
  text: { one: 'Text', many: 'Text files' },
  sheet: { one: 'Spreadsheet', many: 'Spreadsheets' },
  other: { one: 'File', many: 'Other files' },
};

export const DOCUMENT_KINDS = Object.keys(KIND_LABELS) as DocumentKind[];

/** Images the browser can show in an <img>. HEIC and TIFF usually can't. */
const VIEWABLE_IMAGES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico']);

export type PreviewType = 'image' | 'pdf' | 'text' | 'none';

/** Which built-in preview a file gets. Everything else offers Open / Download / Share. */
export function previewTypeOf(kind: DocumentKind, ext: string): PreviewType {
  if (kind === 'pdf') return 'pdf';
  if (kind === 'image') return VIEWABLE_IMAGES.has(ext) ? 'image' : 'none';
  if (kind === 'text' || ext === 'csv' || ext === 'tsv') return 'text';
  return 'none';
}
