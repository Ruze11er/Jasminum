import { strToU8, zipSync } from 'fflate';
import { db } from '../db';
import { noteTitle } from '../repos/notes';
import type { Note } from '../types';

/** Turns the notes editor's (Tiptap) JSON into Markdown. Unknown nodes keep their text. */

interface Node {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: Node[];
}

/** Escapes characters that would otherwise turn into formatting. */
const escapeText = (s: string) => s.replace(/([\\`*_[\]<>])/g, '\\$1');

function inline(nodes: Node[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '  \n';
      if (n.type !== 'text' || !n.text) return inline(n.content);
      const marks = new Set((n.marks ?? []).map((m) => m.type));
      if (marks.has('code')) return `\`${n.text.replace(/`/g, '\\`')}\``;
      let s = escapeText(n.text);
      if (marks.has('bold')) s = `**${s}**`;
      if (marks.has('italic')) s = `*${s}*`;
      if (marks.has('strike')) s = `~~${s}~~`;
      const link = n.marks?.find((m) => m.type === 'link');
      const href = typeof link?.attrs?.href === 'string' ? link.attrs.href : null;
      // Only web, mail and phone links survive, matching what the editor allows.
      if (href && /^(https?:|mailto:|tel:)/i.test(href))
        s = `[${s}](${href.replace(/\)/g, '%29')})`;
      return s;
    })
    .join('');
}

const indent = (text: string, prefix: string) =>
  text
    .split('\n')
    .map((line, i) => (i === 0 || !line ? line : prefix + line))
    .join('\n');

function block(node: Node): string {
  switch (node.type) {
    case 'paragraph':
      return inline(node.content);
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 2));
      return `${'#'.repeat(level)} ${inline(node.content)}`;
    }
    case 'bulletList':
      return (node.content ?? []).map((li) => `- ${indent(blocks(li.content), '  ')}`).join('\n');
    case 'orderedList': {
      const start = Number(node.attrs?.start) || 1;
      return (node.content ?? [])
        .map((li, i) => `${start + i}. ${indent(blocks(li.content), '   ')}`)
        .join('\n');
    }
    case 'taskList':
      return (node.content ?? [])
        .map((li) => `- [${li.attrs?.checked ? 'x' : ' '}] ${indent(blocks(li.content), '  ')}`)
        .join('\n');
    case 'blockquote':
      return blocks(node.content)
        .split('\n')
        .map((l) => (l ? `> ${l}` : '>'))
        .join('\n');
    case 'codeBlock': {
      const text = (node.content ?? []).map((t) => t.text ?? '').join('');
      const fence = text.includes('```') ? '~~~' : '```';
      const lang = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
      return `${fence}${lang}\n${text}\n${fence}`;
    }
    case 'horizontalRule':
      return '---';
    default:
      return node.content ? blocks(node.content) : inline([node]);
  }
}

/** List items hold their paragraphs tight; everything else is separated by a blank line. */
function blocks(nodes: Node[] = []): string {
  return nodes.map(block).join('\n\n');
}

export function tiptapToMarkdown(doc: unknown): string {
  const root = doc as Node | null;
  if (!root || typeof root !== 'object' || !Array.isArray(root.content)) return '';
  return blocks(root.content)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function noteToMarkdown(note: Note, tagNames: string[] = []): string {
  const title = noteTitle(note) || 'Untitled';
  const body = note.contentJson ? tiptapToMarkdown(note.contentJson) : escapeText(note.contentText);
  const tags = tagNames.length
    ? `\n\n${tagNames.map((t) => `#${t.replace(/\s+/g, '-')}`).join(' ')}`
    : '';
  return `# ${escapeText(title)}\n\n${body}${tags}\n`;
}

/** A safe file or folder name on every OS. */
export function safeFileName(name: string, fallback = 'Untitled') {
  const cleaned = name
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

/** All notes (not the Trash) as Markdown files in a zip, one folder per note folder. */
export async function exportNotesZip(): Promise<{ blob: Blob; count: number }> {
  const [notes, folders, tags] = await Promise.all([
    db.notes.filter((n) => !n.deletedAt).toArray(),
    db.folders.filter((f) => f.scope === 'notes' && !f.deletedAt).toArray(),
    db.tags.toArray(),
  ]);
  const folderName = new Map(folders.map((f) => [f.id, safeFileName(f.name, 'Folder')]));
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const files: Record<string, Uint8Array> = {};
  for (const note of notes.sort((a, b) => a.createdAt - b.createdAt)) {
    const dir = note.folderId ? folderName.get(note.folderId) : undefined;
    const base = safeFileName(noteTitle(note));
    let path = `${dir ? `${dir}/` : ''}${base}.md`;
    for (let n = 2; files[path]; n++) path = `${dir ? `${dir}/` : ''}${base} (${n}).md`;
    const names = note.tagIds.map((id) => tagName.get(id)).filter((t): t is string => !!t);
    files[path] = strToU8(noteToMarkdown(note, names));
  }
  const zip = zipSync(files, { level: 6 });
  return { blob: new Blob([zip], { type: 'application/zip' }), count: notes.length };
}
