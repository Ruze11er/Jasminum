import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { db } from '@/data/db';
import { documentsRepo, type DocumentInput } from '@/data/repos/documents';
import { foldersRepo } from '@/data/repos/folders';
import { tagsRepo } from '@/data/repos/tags';
import type { FileStore } from '@/data/files/FileStore';
import { clock } from '@/lib/clock';

/*
 * jsdom Blobs can't go into the in-memory IndexedDB and have no stream(), so these UI
 * tests use an in-memory file store and a simple content hash. The real store and
 * SHA-256 are covered in src/data/files/*.test.ts (Node).
 */
const files = vi.hoisted(() => new Map<string, Blob>());
vi.mock('@/data/files', () => {
  const store: FileStore = {
    kind: 'idb',
    put: async (key, data) => void files.set(key, data),
    get: async (key) => files.get(key) ?? null,
    has: async (key) => files.has(key),
    delete: async (key) => void files.delete(key),
    keys: async () => [...files.keys()],
  };
  return {
    getFileStore: async () => store,
    FileStoreError: class extends Error {},
    resetFileStoreForTests: () => undefined,
  };
});
vi.mock('@/data/files/hashing', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/data/files/hashing')>();
  return {
    ...real,
    hashFile: async (file: Blob) => {
      const text = await file.text();
      let h = 2166136261;
      for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
      return (h >>> 0).toString(16).padStart(8, '0').repeat(8);
    },
  };
});

beforeEach(() => {
  files.clear();
  clock.set(new Date('2026-11-04T10:00:00').getTime());
});
afterEach(() => files.clear());

function renderApp(path = '/library') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const fileOf = (name: string, content: string, type = 'text/plain') =>
  new File([content], name, { type });

/** A document with its bytes in the fake store. */
async function addDoc(patch: Partial<DocumentInput> & { title: string }, content = 'hello') {
  const hash = (patch.title.length.toString(16) + 'ab').padEnd(64, '0');
  const storageKey = `sha256-${hash}`;
  files.set(storageKey, new Blob([content]));
  return documentsRepo.create({
    originalFilename: `${patch.title}.txt`,
    ext: 'txt',
    kind: 'text',
    size: content.length,
    hash,
    storageKey,
    addedAt: clock.now(),
    ...patch,
  });
}

const fileList = () => screen.findByRole('list', { name: 'Files' });

describe('library', () => {
  it('imports picked files and lists them', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByText('Your library is empty')).toBeInTheDocument();

    const [input] = screen.getAllByLabelText('Add files');
    await user.upload(input!, [
      fileOf('Lecture 3.pdf', '%PDF-1.7 lecture', 'application/pdf'),
      fileOf('reading list.txt', 'Dune\nEmma'),
    ]);

    expect(await screen.findAllByText('2 files added')).not.toHaveLength(0);
    const list = await fileList();
    expect(await within(list).findByRole('link', { name: /Lecture 3/ })).toHaveTextContent('PDF');
    expect(await within(list).findByRole('link', { name: /reading list/ })).toBeInTheDocument();
    expect((await db.documents.toArray()).map((d) => d.kind).sort()).toEqual(['pdf', 'text']);
    expect(files.size).toBe(2);
  });

  it('warns about a duplicate and can keep both', async () => {
    const user = userEvent.setup();
    renderApp();
    const [input] = await screen.findAllByLabelText('Add files');
    await user.upload(input!, fileOf('notes.txt', 'same'));
    expect(await screen.findAllByText('1 file added')).not.toHaveLength(0);

    await user.upload(input!, fileOf('notes copy.txt', 'same'));
    const warning = await screen.findByRole('list', { name: 'Needs your attention' });
    expect(warning).toHaveTextContent('notes copy.txt is already in your library as "notes".');
    await user.click(within(warning).getByRole('button', { name: 'Keep both' }));
    await waitFor(async () => expect(await db.documents.count()).toBe(2));
    expect(files.size).toBe(1); // the bytes are stored once
  });

  it('finds files by tag, description, type and smart view', async () => {
    const user = userEvent.setup();
    const bio = await tagsRepo.ensure('biology');
    await addDoc({ title: 'Cell structure', tagIds: [bio.id] });
    await addDoc({ title: 'Trip photo', kind: 'image', ext: 'jpg', favorite: 1 });
    await addDoc({ title: 'Essay', description: 'about trade routes', kind: 'word', ext: 'docx' });
    renderApp();
    const count = () =>
      within(screen.getByRole('list', { name: 'Files' })).getAllByRole('link').length;
    await fileList();
    expect(count()).toBe(3);

    await user.type(screen.getByLabelText('Search files'), '#biology');
    await waitFor(() => expect(count()).toBe(1));
    await user.clear(screen.getByLabelText('Search files'));
    await user.type(screen.getByLabelText('Search files'), 'trade');
    await waitFor(() => expect(count()).toBe(1));
    await user.clear(screen.getByLabelText('Search files'));

    await user.selectOptions(screen.getByLabelText('Type'), 'image');
    await waitFor(() => expect(count()).toBe(1));
    await user.selectOptions(screen.getByLabelText('Type'), '');

    await user.click(screen.getByRole('button', { name: /^Favorites/ }));
    await waitFor(() => expect(count()).toBe(1));
    expect(screen.getByRole('link', { name: /Trip photo/ })).toBeVisible();
  });

  it('imports into the folder being viewed', async () => {
    const user = userEvent.setup();
    const folder = await foldersRepo.add('documents', 'Papers');
    renderApp(`/library?in=folder:${folder.id}`);
    expect(await screen.findByRole('heading', { name: 'Papers' })).toBeInTheDocument();
    const [input] = screen.getAllByLabelText('Add files');
    await user.upload(input!, fileOf('paper.txt', 'abstract'));
    await waitFor(async () => expect((await db.documents.toArray())[0]?.folderId).toBe(folder.id));
  });

  it('shows a file with its preview, counts the open, and edits details', async () => {
    const user = userEvent.setup();
    const doc = await addDoc({ title: 'Recipe' }, 'Flour, eggs, milk');
    renderApp(`/library/${doc.id}`);
    expect(await screen.findByRole('heading', { name: 'Recipe', level: 1 })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText('File contents')).toHaveTextContent('Flour, eggs, milk'),
    );
    await waitFor(async () => expect((await db.documents.get(doc.id))?.openCount).toBe(1));

    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Pancakes{Enter}');
    await waitFor(async () => expect((await db.documents.get(doc.id))?.title).toBe('Pancakes'));

    await user.click(screen.getByRole('button', { name: 'Add to favorites' }));
    await waitFor(async () => expect((await db.documents.get(doc.id))?.favorite).toBe(1));
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });

  it('does not offer Open for files that could run scripts', async () => {
    const doc = await addDoc({ title: 'Page', ext: 'html', kind: 'text' }, '<script>x</script>');
    renderApp(`/library/${doc.id}`);
    await waitFor(() =>
      expect(screen.getByLabelText('File contents')).toHaveTextContent('<script>x</script>'),
    );
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open' })).toBeNull();
  });

  it('deletes a file to the Trash with Undo', async () => {
    const user = userEvent.setup();
    const doc = await addDoc({ title: 'Old notes' });
    const router = renderApp(`/library/${doc.id}`);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('File moved to Trash')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/library');
    await waitFor(async () => expect((await db.documents.get(doc.id))?.deletedAt).not.toBeNull());
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await db.documents.get(doc.id))?.deletedAt).toBeNull());
  });

  it('says so when the stored bytes are missing', async () => {
    const doc = await addDoc({ title: 'Lost' });
    files.clear();
    renderApp(`/library/${doc.id}`);
    expect(await screen.findByRole('alert')).toHaveTextContent("This file's contents are missing");
    await waitFor(async () => expect((await db.documents.get(doc.id))?.fileMissing).toBe(1));
  });

  it('imports from the "+" menu and goes to the library', async () => {
    const user = userEvent.setup();
    const router = renderApp('/');
    await user.click((await screen.findAllByRole('button', { name: 'Create new' }))[0]!);
    const menu = await screen.findByRole('dialog', { name: 'Create new' });
    await user.upload(within(menu).getByLabelText(/Import file/), fileOf('scan.txt', 'scan'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/library'));
    expect(await screen.findByRole('link', { name: /scan/ })).toBeInTheDocument();
  });
});
