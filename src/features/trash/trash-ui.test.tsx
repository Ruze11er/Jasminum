import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { db } from '@/data/db';
import { notesRepo } from '@/data/repos/notes';
import { tasksRepo } from '@/data/repos/tasks';

function renderApp(path = '/trash') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('trash selection', () => {
  it('restores selected items, and deletes the rest forever after confirming', async () => {
    const user = userEvent.setup();
    const task = await tasksRepo.create({ title: 'Old task' });
    const note = await notesRepo.create({ title: 'Old note' });
    const scrap = await notesRepo.create({ title: 'Scrap' });
    await tasksRepo.softDelete(task.id);
    await notesRepo.softDelete(note.id);
    await notesRepo.softDelete(scrap.id);
    renderApp();
    const list = await screen.findByRole('list', { name: 'Deleted items' });
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(3));

    await user.click(screen.getByRole('button', { name: 'Select' }));
    await user.click(within(list).getByRole('button', { name: /Old task/ }));
    await user.click(within(list).getByRole('button', { name: /Old note/ }));
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(await screen.findByText('Restored 2 items')).toBeInTheDocument();
    await waitFor(async () => expect((await db.tasks.get(task.id))?.deletedAt).toBeNull());
    expect((await db.notes.get(note.id))?.deletedAt).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    await user.click(screen.getByRole('button', { name: 'Delete forever' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete forever?' });
    expect(dialog).toHaveTextContent('1 item will be erased for good');
    await user.click(within(dialog).getByRole('button', { name: 'Delete forever' }));
    await waitFor(async () => expect(await db.notes.get(scrap.id)).toBeUndefined());
  });
});
