import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { db } from '@/data/db';
import { getSetting } from '@/data/repos/settings';
import { tasksRepo } from '@/data/repos/tasks';
import { clock, DAY_MS } from '@/lib/clock';
import { runInsightsNow } from './runner';

const NOW = new Date('2026-11-04T10:00:00').getTime();

beforeEach(() => {
  clock.set(NOW);
});

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

async function withOverdueTask() {
  clock.set(NOW - 3 * DAY_MS);
  const t = await tasksRepo.create({ title: 'Pay rent', dueDate: '2026-11-01' });
  clock.set(NOW);
  await runInsightsNow(NOW);
  return t;
}

const insight = (title: string | RegExp) => screen.findByRole('article', { name: title });

describe('insights for a new user', () => {
  it('shows a friendly placeholder on Home and an empty Insights page', async () => {
    renderApp();
    expect(await screen.findByText('Getting to know you')).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBeNull();

    renderApp('/insights');
    expect(await screen.findByText('All clear')).toBeInTheDocument();
    expect(screen.getByText('Charts appear as you finish tasks')).toBeInTheDocument();
  });
});

describe('insight cards', () => {
  it('shows an insight on Home and acts on it', async () => {
    const user = userEvent.setup();
    const t = await withOverdueTask();
    renderApp();
    const card = await insight('“Pay rent” is overdue');
    expect(within(card).getByText(/keeps your list honest/)).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Move to today' }));
    expect(await screen.findByText('Task moved')).toBeInTheDocument();
    await waitFor(async () => expect((await db.tasks.get(t.id))?.dueDate).toBe('2026-11-04'));
    await waitFor(() => expect(screen.queryByRole('article')).toBeNull());
  });

  it('dismisses with Undo', async () => {
    const user = userEvent.setup();
    await withOverdueTask();
    renderApp('/insights');
    const card = await insight(/is overdue/);
    await user.click(within(card).getByRole('button', { name: /More options/ }));
    await user.click(within(card).getByRole('button', { name: 'Dismiss' }));
    expect(await screen.findByText('Insight dismissed')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('article')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await insight(/is overdue/)).toBeInTheDocument();
  });

  it('turns a kind of tip off from the card', async () => {
    const user = userEvent.setup();
    await withOverdueTask();
    renderApp('/insights');
    const card = await insight(/is overdue/);
    await user.click(within(card).getByRole('button', { name: /More options/ }));
    await user.click(within(card).getByRole('button', { name: "Don't show this type" }));
    expect(await screen.findByText(/"Overdue tasks" tips are off/)).toBeInTheDocument();
    await waitFor(async () =>
      expect((await getSetting('insightPrefs')).disabledRules).toEqual(['R1']),
    );
    await waitFor(() => expect(screen.queryByRole('article')).toBeNull());
  });

  it('opens Review on the overdue view', async () => {
    const user = userEvent.setup();
    await withOverdueTask();
    const router = renderApp();
    await user.click(within(await insight(/is overdue/)).getByRole('button', { name: 'Review' }));
    await waitFor(() => expect(router.state.location.search).toBe('?view=overdue'));
    expect(await screen.findByRole('radio', { name: /Overdue/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});

describe('insights page charts', () => {
  it('shows finished tasks per week with a table view', async () => {
    const user = userEvent.setup();
    for (const day of ['2026-11-02', '2026-11-03', '2026-10-27']) {
      clock.set(new Date(`${day}T09:00:00`).getTime());
      const t = await tasksRepo.create({ title: `Done ${day}` });
      await tasksRepo.complete(t.id);
    }
    clock.set(NOW);
    renderApp('/insights');
    const chart = await screen.findByRole('list', { name: 'Tasks done per week' });
    expect(within(chart).getByRole('listitem', { name: 'This week: 2 tasks' })).toBeInTheDocument();
    const figure = chart.closest('figure')!;
    await user.click(within(figure).getByText('Show as table'));
    expect(within(figure).getByRole('rowheader', { name: 'This week' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Tasks done by category' })).toBeInTheDocument();
  });
});

describe('insight settings', () => {
  it('switches rules on and off', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    const box = await screen.findByRole('checkbox', { name: /Overdue tasks/ });
    expect(box).toBeChecked();
    await user.click(box);
    await waitFor(async () =>
      expect((await getSetting('insightPrefs')).disabledRules).toEqual(['R1']),
    );
    await user.click(screen.getByRole('checkbox', { name: /Overdue tasks/ }));
    await waitFor(async () => expect((await getSetting('insightPrefs')).disabledRules).toEqual([]));
  });

  it('opens the backup dialog from the backup reminder', async () => {
    renderApp('/settings?backup=1');
    expect(await screen.findByRole('dialog', { name: 'Back up your data' })).toBeInTheDocument();
  });
});
