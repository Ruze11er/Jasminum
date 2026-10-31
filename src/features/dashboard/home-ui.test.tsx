import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { db } from '@/data/db';
import { eventsRepo } from '@/data/repos/events';
import { getSetting } from '@/data/repos/settings';
import { tasksRepo } from '@/data/repos/tasks';
import { clock } from '@/lib/clock';
import { localDateTimeToIso } from '@/lib/dates';
import { quoteById } from '@/features/quotes/quotes';

const local = (date: string, time = '10:00') => new Date(`${date}T${time}:00`).getTime();

beforeEach(() => {
  clock.set(local('2026-11-04', '10:00'));
});

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

const quoteText = async () => {
  const card = (await screen.findByRole('heading', { name: 'Quote of the day' })).parentElement!;
  const quote = await within(card).findByRole('blockquote');
  return quote.textContent;
};

describe('home', () => {
  it("shows today's quote, the same one after reopening", async () => {
    const first = renderApp();
    const text = await quoteText();
    const saved = await getSetting('dailyQuote');
    expect(saved?.date).toBe('2026-11-04');
    expect(text).toContain(quoteById(saved!.quoteId)!.text.split('\n')[0]);
    first.unmount();

    clock.set(local('2026-11-04', '22:00'));
    renderApp();
    expect(await quoteText()).toBe(text);
  });

  it('changes the quote and date after midnight while Home stays open', async () => {
    renderApp();
    const before = await quoteText();
    expect(screen.getByText(/Wednesday, November 4/)).toBeInTheDocument();

    clock.set(local('2026-11-05', '00:00'));
    // Coming back to the app (or the midnight timer) refreshes the day.
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(await screen.findByText(/Thursday, November 5/)).toBeInTheDocument();
    await waitFor(async () => expect(await quoteText()).not.toBe(before));
    expect((await getSetting('dailyQuote'))?.date).toBe('2026-11-05');
  });

  it("lists today's events and opens one", async () => {
    const user = userEvent.setup();
    await eventsRepo.create({
      title: 'Dentist',
      start: localDateTimeToIso('2026-11-04', '15:00'),
      end: localDateTimeToIso('2026-11-04', '15:30'),
    });
    await eventsRepo.create({
      title: 'Tomorrow thing',
      allDay: 1,
      start: '2026-11-05',
      end: '2026-11-05',
    });
    renderApp();
    const list = await screen.findByRole('list', { name: "Today's events" });
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    await user.click(within(list).getByRole('button', { name: 'Edit event: Dentist' }));
    expect(await screen.findByRole('dialog', { name: 'Edit event' })).toBeInTheDocument();
  });

  it('shows the week in numbers', async () => {
    for (const [title, day] of [
      ['A', '2026-11-02'],
      ['B', '2026-11-03'],
      ['C', '2026-11-04'],
    ]) {
      clock.set(local(day!, '09:00'));
      const t = await tasksRepo.create({ title: title! });
      await tasksRepo.complete(t.id);
    }
    clock.set(local('2026-11-04', '10:00'));
    renderApp();
    const stats = await screen.findByRole('region', { name: 'Your week' });
    await waitFor(() => expect(within(stats).getByText('3 days')).toBeInTheDocument());
    expect(within(stats).getByText('Including today')).toBeInTheDocument();
    expect(within(stats).getByText('3 more than last week')).toBeInTheDocument();
    expect(within(stats).getByText('No files yet')).toBeInTheDocument();
  });
});

describe('quote settings', () => {
  it('chooses kinds of quotes, keeping at least one', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    const group = await screen.findByRole('group', { name: 'Kinds of quotes' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.every((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true);

    for (const name of ['Keep going', 'Learning', 'Calm', 'Kindness']) {
      await user.click(within(group).getByRole('button', { name }));
    }
    await waitFor(async () => expect(await getSetting('quoteCategories')).toEqual(['joy']));
    await user.click(within(group).getByRole('button', { name: 'Joy & wonder' }));
    expect(await screen.findByText('Keep at least one kind of quote.')).toBeInTheDocument();
    expect(await getSetting('quoteCategories')).toEqual(['joy']);

    // Turning everything back on stores "all".
    for (const name of ['Keep going', 'Learning', 'Calm', 'Kindness']) {
      await user.click(within(group).getByRole('button', { name }));
    }
    await waitFor(async () => expect(await getSetting('quoteCategories')).toEqual([]));
    expect(await db.settings.get('quoteCategories')).toBeDefined();
  });
});
