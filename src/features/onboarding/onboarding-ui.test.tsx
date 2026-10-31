import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { db } from '@/data/db';
import { getSetting } from '@/data/repos/settings';
import { clock } from '@/lib/clock';

beforeEach(() => {
  clock.set(new Date('2026-11-04T10:00:00').getTime());
});

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const activeTasks = async () => (await db.tasks.toArray()).filter((t) => !t.deletedAt);

describe('examples from the welcome card', () => {
  it('adds examples to Home, and removes them again with Undo', async () => {
    const user = userEvent.setup();
    renderApp();
    const heading = await screen.findByRole('heading', { name: 'Welcome to Jasminum' });
    const card = heading.closest('section, div')!.parentElement!;

    await user.click(within(card).getByRole('button', { name: 'Add examples' }));
    expect(await screen.findByText(/Examples added/)).toBeInTheDocument();
    // Today's sample task shows on Home.
    expect(
      await screen.findByRole('button', { name: 'Edit task: Read chapter 3 for biology' }),
    ).toBeInTheDocument();

    await user.click(await within(card).findByRole('button', { name: 'Remove examples' }));
    expect(await screen.findByText(/examples moved to Trash/)).toBeInTheDocument();
    await waitFor(async () => expect(await activeTasks()).toEqual([]));
    expect(within(card).getByRole('button', { name: 'Add examples' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    // The setting is restored last, so this also waits for the whole Undo to finish.
    await waitFor(async () => expect(await getSetting('sampleData')).not.toBeNull());
    expect((await activeTasks()).length).toBeGreaterThan(0);
  });

  it('Settings offers to remove the examples once they are in', async () => {
    const user = userEvent.setup();
    const { addSampleData } = await import('./sampleData');
    await addSampleData();
    renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Remove examples' }));
    await waitFor(async () => expect(await activeTasks()).toEqual([]));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Remove examples' })).toBeNull(),
    );
  });
});

describe('moving to a new device', () => {
  it('Settings explains how to move data with a backup', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    const summary = await screen.findByText('Move to a new device');
    await user.click(summary);
    expect(screen.getByText('Send the file to the new device')).toBeVisible();
    expect(screen.getByText(/keep separate data/)).toBeInTheDocument();
  });
});
