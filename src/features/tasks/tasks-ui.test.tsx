import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { db } from '@/data/db';
import { tasksRepo } from '@/data/repos/tasks';
import { clock } from '@/lib/clock';
import { useTaskEditor } from './editorStore';

const TODAY = '2026-10-30';

beforeEach(() => {
  clock.set(new Date(`${TODAY}T10:00:00`).getTime());
});
afterEach(() => {
  useTaskEditor.setState({ open: false, taskId: null, defaults: {} });
});

function renderApp(path = '/tasks') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const group = (name: string | RegExp) => screen.findByRole('region', { name });

describe('tasks page', () => {
  it('quick-adds a task for today with #tags', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(await screen.findByLabelText('Add a task'), 'Revise notes #biology{Enter}');

    const today = await group(/^Today/);
    expect(within(today).getByText('Revise notes')).toBeInTheDocument();
    expect(within(today).getByText('#biology')).toBeInTheDocument();
    const [task] = await db.tasks.toArray();
    expect(task).toMatchObject({ title: 'Revise notes', dueDate: TODAY });
    expect(screen.getByLabelText('Add a task')).toHaveValue('');
  });

  it('completes a task, shows it under "Done today", and undoes', async () => {
    const user = userEvent.setup();
    const t = await tasksRepo.create({ title: 'Call mom', dueDate: TODAY });
    renderApp();
    await user.click(await screen.findByRole('checkbox', { name: 'Complete: Call mom' }));
    expect(await screen.findByText('Task done')).toBeInTheDocument();
    expect(within(await group(/Done today/)).getByText('Call mom')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await db.tasks.get(t.id))?.status).toBe('todo'));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Complete: Call mom' })).not.toBeChecked(),
    );
  });

  it('creates a repeating task with a checklist through the form', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole('button', { name: 'New task' }));
    const dialog = await screen.findByRole('dialog', { name: 'New task' });

    await user.type(await within(dialog).findByLabelText('Title'), 'Morning routine');
    await user.click(within(dialog).getByRole('radio', { name: 'High' }));
    await user.selectOptions(within(dialog).getByLabelText('Repeat'), 'daily');
    await user.type(
      within(dialog).getByLabelText('New checklist item'),
      'Stretch{Enter}Water{Enter}',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));

    expect(await screen.findByText('Task added')).toBeInTheDocument();
    const [task] = await db.tasks.toArray();
    expect(task).toMatchObject({ title: 'Morning routine', priority: 3, dueDate: TODAY });
    expect(task?.rrule).toContain('FREQ=DAILY');
    expect((await tasksRepo.checklist(task!.id)).map((i) => i.text)).toEqual(['Stretch', 'Water']);

    // Completing it schedules tomorrow's copy.
    await user.click(await screen.findByRole('checkbox', { name: 'Complete: Morning routine' }));
    expect(await screen.findByText('Done! Next one: Tomorrow')).toBeInTheDocument();
  });

  it('shows form errors without closing', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole('button', { name: 'New task' }));
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    await user.click(await within(dialog).findByRole('button', { name: 'Add task' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Give your task a title');
  });

  it('moves overdue tasks to today', async () => {
    const user = userEvent.setup();
    await tasksRepo.create({ title: 'Old essay', dueDate: '2026-10-27' });
    renderApp();
    const overdue = await group(/^Overdue/);
    await user.click(within(overdue).getByRole('button', { name: 'Move to today' }));
    expect(within(await group(/^Today/)).getByText('Old essay')).toBeInTheDocument();
    expect(await db.tasks.toArray()).toEqual([
      expect.objectContaining({ dueDate: TODAY, postponeCount: 1, originalDueDate: '2026-10-27' }),
    ]);
  });

  it('edits and deletes a task, with Undo', async () => {
    const user = userEvent.setup();
    const t = await tasksRepo.create({ title: 'Draft', dueDate: TODAY });
    renderApp();
    await user.click(await screen.findByRole('button', { name: 'Edit task: Draft' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit task' });
    const title = await within(dialog).findByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Final draft');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Final draft')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit task: Final draft' }));
    await user.click(
      await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Delete' }),
    );
    expect(await screen.findByText('Moved to Trash')).toBeInTheDocument();
    expect((await db.tasks.get(t.id))?.deletedAt).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Final draft')).toBeInTheDocument();
  });

  it('switches views and filters by priority', async () => {
    const user = userEvent.setup();
    await tasksRepo.create({ title: 'Big exam', dueDate: '2026-11-02', priority: 3 });
    await tasksRepo.create({ title: 'Small chore', dueDate: '2026-11-02' });
    renderApp();
    await user.click(await screen.findByRole('radio', { name: /Upcoming/ }));
    expect(await screen.findByText('Big exam')).toBeInTheDocument();
    expect(screen.getByText('Small chore')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    await user.selectOptions(screen.getByLabelText('Priority'), '3');
    expect(screen.queryByText('Small chore')).not.toBeInTheDocument();
    expect(screen.getByText('Big exam')).toBeInTheDocument();
  });
});

describe('home and global add', () => {
  it("shows today's tasks on Home and opens the task form from the + menu", async () => {
    const user = userEvent.setup();
    await tasksRepo.create({ title: 'Buy flowers', dueDate: TODAY });
    renderApp('/');
    const list = await screen.findByRole('list', { name: "Today's tasks" });
    expect(within(list).getByText('Buy flowers')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '0 of 1 tasks done today' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Create new' })[0]!);
    await user.click(await screen.findByRole('button', { name: /^Task/ }));
    expect(await screen.findByRole('dialog', { name: 'New task' })).toBeInTheDocument();
  });
});

describe('tasks selection', () => {
  it('selects tasks and marks them done, with Undo, then moves them to tomorrow', async () => {
    const user = userEvent.setup();
    for (const title of ['Read', 'Write', 'Rest'])
      await tasksRepo.create({ title, dueDate: TODAY });
    renderApp();
    await group(/^Today/);
    await user.click(screen.getByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('button', { name: /^Read/ }));
    await user.click(screen.getByRole('button', { name: /^Write/ }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('2 tasks done')).toBeInTheDocument();
    await waitFor(async () =>
      expect((await db.tasks.toArray()).filter((t) => t.status === 'done')).toHaveLength(2),
    );
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () =>
      expect((await db.tasks.toArray()).every((t) => t.status !== 'done')).toBe(true),
    );

    await user.click(screen.getByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    await user.selectOptions(screen.getByLabelText('Move to day'), 'Tomorrow');
    await waitFor(async () =>
      expect((await db.tasks.toArray()).every((t) => t.dueDate === '2026-10-31')).toBe(true),
    );
  });
});
