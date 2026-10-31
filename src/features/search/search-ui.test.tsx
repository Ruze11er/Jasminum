import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { notesRepo } from '@/data/repos/notes';
import { tagsRepo } from '@/data/repos/tags';
import { tasksRepo } from '@/data/repos/tasks';
import { clock } from '@/lib/clock';
import { useTaskEditor } from '@/features/tasks/editorStore';

beforeEach(() => {
  clock.set(new Date('2026-11-04T10:00:00').getTime());
});
afterEach(() => {
  useTaskEditor.setState({ open: false, taskId: null, defaults: {} });
});

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const openPalette = async () => {
  const user = userEvent.setup();
  await screen.findByRole('heading', { level: 1 });
  await user.keyboard('{Control>}k{/Control}');
  const dialog = await screen.findByRole('dialog', { name: 'Search' });
  const input = await within(dialog).findByRole('combobox', { name: 'Search everything' });
  return { user, dialog, input };
};

describe('command palette', () => {
  it('opens with Ctrl+K, finds a task and opens it', async () => {
    await tasksRepo.create({ title: 'Write lab report' });
    renderApp();
    const { user, dialog, input } = await openPalette();
    expect(input).toHaveFocus();
    await user.type(input, 'lab rep');
    const option = await within(dialog).findByRole('option', { name: /Write lab report/ });
    expect(option).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Edit task' })).toBeInTheDocument();
  });

  it('finds a note by words in its text', async () => {
    const note = await notesRepo.create({
      title: 'Biology',
      contentText: 'Photosynthesis in leaves',
    });
    const router = renderApp();
    const { user, dialog, input } = await openPalette();
    await user.type(input, 'photosynth');
    await user.click(await within(dialog).findByRole('option', { name: /Biology/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/notes/${note.id}`));
  });

  it('lists everything with a tag', async () => {
    const bio = await tagsRepo.ensure('biology');
    await tasksRepo.create({ title: 'Lab report', tagIds: [bio.id] });
    await notesRepo.create({ title: 'Cells', tagIds: [bio.id] });
    await tasksRepo.create({ title: 'Groceries' });
    renderApp();
    const { user, dialog, input } = await openPalette();
    await user.type(input, '#biology');
    await within(dialog).findByText('Tagged #biology');
    const options = within(dialog).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Lab reportTask', 'CellsNote']);
  });

  it('runs actions and moves with the arrow keys', async () => {
    const router = renderApp();
    const { user, dialog, input } = await openPalette();
    // With nothing typed, the first option is "New task"; ArrowDown moves to "New event".
    await user.keyboard('{ArrowDown}');
    expect(within(dialog).getByRole('option', { name: /New event/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(input).toHaveAttribute('aria-activedescendant');
    await user.type(input, 'new note');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/notes/new'));
  });

  it('opens from a search button', async () => {
    const user = userEvent.setup();
    renderApp('/tasks');
    // Both the sidebar and the phone header have one (CSS hides one of them).
    await user.click((await screen.findAllByRole('button', { name: 'Search' }))[0]!);
    expect(await screen.findByRole('dialog', { name: 'Search' })).toBeInTheDocument();
  });
});
