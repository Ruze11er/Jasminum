import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { db } from '@/data/db';
import { foldersRepo } from '@/data/repos/folders';
import { linksRepo } from '@/data/repos/links';
import { notesRepo } from '@/data/repos/notes';
import { tasksRepo } from '@/data/repos/tasks';
import { clock } from '@/lib/clock';
import { useTaskEditor } from '@/features/tasks/editorStore';

beforeEach(() => {
  clock.set(new Date('2026-11-04T10:00:00').getTime());
});
afterEach(() => {
  useTaskEditor.setState({ open: false, taskId: null, defaults: {} });
});

function renderApp(path = '/notes') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const noteList = () => screen.findByRole('list', { name: 'Notes' });

describe('notes page', () => {
  it('starts empty and creates a note once it has a title', async () => {
    const user = userEvent.setup();
    const router = renderApp();
    expect(await screen.findByText('No notes yet')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'New note' })[0]!);
    const title = await screen.findByLabelText('Title');
    expect(await db.notes.count()).toBe(0); // nothing saved until there's content
    await user.type(title, 'Biology lecture');

    await waitFor(async () => expect(await db.notes.count()).toBe(1), { timeout: 5000 });
    const [note] = await db.notes.toArray();
    expect(note).toMatchObject({ title: 'Biology lecture', folderId: null });
    await waitFor(() => expect(router.state.location.pathname).toBe(`/notes/${note!.id}`));
    // Same editor, still focused on the title: the URL change didn't reload it.
    expect(screen.getByLabelText('Title')).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Back to notes' }));
    expect(within(await noteList()).getByRole('link', { name: /Biology lecture/ })).toBeVisible();
  });

  it('opens an existing note with its formatted content', async () => {
    const n = await notesRepo.create({
      title: 'Recipes',
      contentJson: doc('Pancakes need eggs'),
      contentText: 'Pancakes need eggs',
    });
    renderApp(`/notes/${n.id}`);
    expect(await screen.findByLabelText('Title')).toHaveValue('Recipes');
    const body = await screen.findByRole('textbox', { name: 'Note text' });
    expect(body).toHaveTextContent('Pancakes need eggs');
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
  });

  it('searches titles and text, and filters by folder', async () => {
    const user = userEvent.setup();
    const school = await foldersRepo.add('notes', 'School');
    await notesRepo.create({
      title: 'Algebra',
      contentText: 'quadratic formula',
      folderId: school.id,
    });
    await notesRepo.create({ title: 'Groceries', contentText: 'eggs, flour' });
    renderApp();

    const list = await noteList();
    expect(within(list).getAllByRole('link')).toHaveLength(2);

    await user.type(screen.getByLabelText('Search notes'), 'quadratic');
    await waitFor(() =>
      expect(within(screen.getByRole('list', { name: 'Notes' })).getAllByRole('link')).toHaveLength(
        1,
      ),
    );
    expect(screen.getByRole('link', { name: /Algebra/ })).toBeVisible();
    await user.clear(screen.getByLabelText('Search notes'));

    await user.click(screen.getByRole('button', { name: /^School/ }));
    expect(await screen.findByRole('heading', { name: 'School' })).toBeInTheDocument();
    await waitFor(() =>
      expect(within(screen.getByRole('list', { name: 'Notes' })).getAllByRole('link')).toHaveLength(
        1,
      ),
    );

    // A new note from inside a folder goes into that folder.
    await user.click(screen.getByRole('button', { name: 'New note' }));
    await user.type(await screen.findByLabelText('Title'), 'Geometry');
    await waitFor(async () =>
      expect((await db.notes.filter((x) => x.title === 'Geometry').first())?.folderId).toBe(
        school.id,
      ),
    );
  });

  it('creates a folder from the list', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole('button', { name: 'Folder' }));
    await user.type(screen.getByLabelText('New folder name'), 'Recipes{Enter}');
    expect(await screen.findByRole('heading', { name: 'Recipes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Recipes/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect((await foldersRepo.list('notes')).map((f) => f.name)).toEqual(['Recipes']);
  });

  it('pins, favorites and deletes with Undo', async () => {
    const user = userEvent.setup();
    const n = await notesRepo.create({ title: 'Ideas' });
    renderApp(`/notes/${n.id}`);
    await user.click(await screen.findByRole('button', { name: 'Pin to top' }));
    await waitFor(async () => expect((await db.notes.get(n.id))?.pinned).toBe(1));
    expect(await screen.findByRole('button', { name: 'Unpin' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Add to favorites' }));
    await waitFor(async () => expect((await db.notes.get(n.id))?.favorite).toBe(1));

    await user.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(await screen.findByText('Note moved to Trash')).toBeInTheDocument();
    await waitFor(async () => expect((await db.notes.get(n.id))?.deletedAt).not.toBeNull());
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await db.notes.get(n.id))?.deletedAt).toBeNull());
  });

  it('links a task, and the task form shows the note back', async () => {
    const user = userEvent.setup();
    const n = await notesRepo.create({ title: 'Lab notes' });
    await tasksRepo.create({ title: 'Write lab report', dueDate: '2026-11-05' });
    renderApp(`/notes/${n.id}`);

    await user.click(await screen.findByRole('button', { name: 'Link' }));
    const picker = await screen.findByRole('dialog', { name: 'Link a task or event' });
    await user.type(within(picker).getByLabelText('Search tasks and events'), 'lab');
    await user.click(await within(picker).findByRole('button', { name: /Write lab report/ }));

    const linked = await screen.findByRole('list', { name: 'Linked items' });
    expect(
      within(linked).getByRole('button', { name: 'Open task: Write lab report' }),
    ).toBeVisible();
    expect(await linksRepo.linksOf({ type: 'note', id: n.id })).toHaveLength(1);

    // The other direction: the task form lists the note.
    await user.click(within(linked).getByRole('button', { name: 'Open task: Write lab report' }));
    const form = await screen.findByRole('dialog', { name: 'Edit task' });
    expect(await within(form).findByRole('link', { name: 'Lab notes' })).toHaveAttribute(
      'href',
      `/notes/${n.id}`,
    );
  });

  it('opens a new note from the "+" menu', async () => {
    const user = userEvent.setup();
    const router = renderApp('/');
    await user.click((await screen.findAllByRole('button', { name: 'Create new' }))[0]!);
    const menu = await screen.findByRole('dialog', { name: 'Create new' });
    await user.click(within(menu).getByRole('button', { name: /Note/ }));
    expect(await screen.findByLabelText('Title')).toHaveFocus();
    expect(router.state.location.pathname).toBe('/notes/new');
  });

  it('recovers changes that were still saving when the tab closed', async () => {
    const n = await notesRepo.create({ title: 'Draft' });
    localStorage.setItem(
      `jasminum:note-draft:${n.id}`,
      JSON.stringify({ at: n.updatedAt + 1000, patch: { title: 'Draft, finished' } }),
    );
    renderApp(`/notes/${n.id}`);
    expect(await screen.findByLabelText('Title')).toHaveValue('Draft, finished');
    await waitFor(async () => expect((await db.notes.get(n.id))?.title).toBe('Draft, finished'));
    await waitFor(() => expect(localStorage.getItem(`jasminum:note-draft:${n.id}`)).toBeNull());
  });

  it('ignores a backup older than the saved note', async () => {
    const n = await notesRepo.create({ title: 'Newer' });
    localStorage.setItem(
      `jasminum:note-draft:${n.id}`,
      JSON.stringify({ at: n.updatedAt - 1000, patch: { title: 'Older' } }),
    );
    renderApp(`/notes/${n.id}`);
    expect(await screen.findByLabelText('Title')).toHaveValue('Newer');
    expect(localStorage.getItem(`jasminum:note-draft:${n.id}`)).toBeNull();
  });

  it('says so when a note no longer exists', async () => {
    renderApp('/notes/missing-id');
    expect(await screen.findByText('This note no longer exists.')).toBeInTheDocument();
  });
});
