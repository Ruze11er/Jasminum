import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { db } from '@/data/db';
import { eventsRepo } from '@/data/repos/events';
import { setSetting } from '@/data/repos/settings';
import { tasksRepo } from '@/data/repos/tasks';
import { clock } from '@/lib/clock';
import { localDateTimeToIso } from '@/lib/dates';
import { formatRecurrence } from '@/lib/recurrence';
import { useTaskEditor } from '@/features/tasks/editorStore';
import { useEventEditor } from './eventEditorStore';

const TODAY = '2026-11-04'; // a Wednesday

beforeEach(() => {
  clock.set(new Date(`${TODAY}T10:20:00`).getTime());
});
afterEach(() => {
  useTaskEditor.setState({ open: false, taskId: null, defaults: {} });
  useEventEditor.setState({ open: false, eventId: null, occurrenceDate: null, defaults: {} });
});

function renderApp(path = '/calendar') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const day = (name: RegExp) => screen.findByRole('button', { name });
const agenda = (name: string | RegExp) => screen.findByRole('list', { name });

describe('calendar page', () => {
  it('shows the month with today selected and an empty agenda', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: /November 2026/ })).toBeInTheDocument();
    const today = await day(/November 4, 2026, today/);
    expect(today).toHaveAttribute('aria-pressed', 'true');
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(screen.getByText('Nothing planned.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeDisabled();
  });

  it('creates an event through the form and shows it on its day', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole('button', { name: 'Add event on Today' }));
    const dialog = await screen.findByRole('dialog', { name: 'New event' });
    await user.type(await within(dialog).findByLabelText('Title'), 'Study group');
    // Starts at the next full hour, for one hour.
    expect(within(dialog).getByLabelText('Starts at')).toHaveValue('11:00');
    expect(within(dialog).getByLabelText('Ends at')).toHaveValue('12:00');
    await user.type(within(dialog).getByLabelText('Place'), 'Library');
    await user.selectOptions(within(dialog).getByLabelText('Reminder'), '15');
    await user.click(within(dialog).getByRole('button', { name: 'Add event' }));

    expect(await screen.findByText('Event added')).toBeInTheDocument();
    const list = await agenda('Plans for Today');
    expect(within(list).getByRole('button', { name: 'Edit event: Study group' })).toHaveTextContent(
      /Library/,
    );
    const [event] = await db.events.toArray();
    expect(event).toMatchObject({
      title: 'Study group',
      location: 'Library',
      reminderMinutes: 15,
      start: localDateTimeToIso(TODAY, '11:00'),
    });
    expect(await day(/November 4, 2026, today, 1 item/)).toBeInTheDocument();
  });

  it('shows inline errors and keeps the form open', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole('button', { name: 'Add event on Today' }));
    const dialog = await screen.findByRole('dialog', { name: 'New event' });
    await user.type(await within(dialog).findByLabelText('Title'), 'Backwards');
    const end = within(dialog).getByLabelText('Ends at');
    await user.clear(end);
    await user.type(end, '09:00');
    await user.click(within(dialog).getByRole('button', { name: 'Add event' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "The event can't end before it starts",
    );
    expect(await db.events.count()).toBe(0);
  });

  it('shows tasks and events together, and opens the right editor', async () => {
    const user = userEvent.setup();
    await tasksRepo.create({ title: 'Hand in essay', dueDate: '2026-11-06', dueTime: '09:00' });
    await eventsRepo.create({
      title: 'Holiday',
      allDay: 1,
      start: '2026-11-06',
      end: '2026-11-06',
    });
    renderApp();
    await user.click(await day(/November 6, 2026, 2 items/));
    const list = await agenda(/^Plans for Friday/);
    const rows = within(list).getAllByRole('button', { name: /^Edit/ });
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Edit event: Holiday',
      'Edit task: Hand in essay',
    ]);
    // Tasks can be completed right from the calendar.
    await user.click(within(list).getByRole('checkbox', { name: 'Complete: Hand in essay' }));
    expect(await screen.findByText('Task done')).toBeInTheDocument();

    await user.click(within(list).getByRole('button', { name: 'Edit task: Hand in essay' }));
    expect(await screen.findByRole('dialog', { name: 'Edit task' })).toBeInTheDocument();
  });

  it('expands repeating events and deletes just one day with Undo', async () => {
    const user = userEvent.setup();
    const e = await eventsRepo.create({
      title: 'Yoga',
      start: localDateTimeToIso('2026-11-02', '18:00'),
      end: localDateTimeToIso('2026-11-02', '19:00'),
      rrule: formatRecurrence({
        start: '2026-11-02',
        freq: 'WEEKLY',
        interval: 1,
        byDay: ['MO', 'WE'],
        until: null,
      }),
    });
    renderApp();
    for (const d of [2, 4, 9, 11, 30]) {
      expect(await day(new RegExp(`November ${d}, 2026.*1 item`))).toBeInTheDocument();
    }

    await user.click(
      within(await agenda('Plans for Today')).getByRole('button', { name: 'Edit event: Yoga' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit event' });
    expect(
      await within(dialog).findByText('Changes apply to every repeat of this event.'),
    ).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await user.click(within(dialog).getByRole('button', { name: 'Only Today' }));

    expect(await screen.findByText('Event removed from this day')).toBeInTheDocument();
    await waitFor(async () => expect((await db.events.get(e.id))?.exdates).toEqual([TODAY]));
    expect(await screen.findByText('Nothing planned.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /November 9, 2026, 1 item/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await db.events.get(e.id))?.exdates).toEqual([]));
  });

  it('deletes a whole repeating series to the Trash', async () => {
    const user = userEvent.setup();
    const e = await eventsRepo.create({
      title: 'Standup',
      start: localDateTimeToIso(TODAY, '09:00'),
      end: localDateTimeToIso(TODAY, '09:15'),
      rrule: formatRecurrence({ start: TODAY, freq: 'DAILY', interval: 1, byDay: [], until: null }),
    });
    renderApp();
    await user.click(
      within(await agenda('Plans for Today')).getByRole('button', { name: 'Edit event: Standup' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit event' });
    await user.click(await within(dialog).findByRole('button', { name: 'Delete' }));
    await user.click(within(dialog).getByRole('button', { name: 'All repeats' }));
    expect(await screen.findByText('Moved to Trash')).toBeInTheDocument();
    await waitFor(async () => expect((await db.events.get(e.id))?.deletedAt).not.toBeNull());
  });

  it('pages between months and keeps the place in the URL', async () => {
    const user = userEvent.setup();
    const router = renderApp('/calendar?view=month&date=2026-01-31');
    expect(await screen.findByRole('heading', { name: /January 2026/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(await screen.findByRole('heading', { name: /February 2026/ })).toBeInTheDocument();
    expect(router.state.location.search).toContain('date=2026-02-28');
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(await screen.findByRole('heading', { name: /November 2026/ })).toBeInTheDocument();
  });

  it('moves the selected day with arrow keys', async () => {
    const user = userEvent.setup();
    renderApp();
    (await day(/November 4, 2026, today/)).focus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /November 11, 2026/ })).toHaveFocus(),
    );
    await user.keyboard('{ArrowRight}');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /November 12, 2026/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('shows the week as a list of days on phones, starting on the chosen day', async () => {
    await setSetting('weekStartsOn', 0);
    await eventsRepo.create({ title: 'Brunch', allDay: 1, start: '2026-11-01', end: '2026-11-01' });
    renderApp('/calendar?view=week&date=2026-11-04');
    // The saved week start loads right after the first render.
    expect(await screen.findByRole('heading', { level: 2, name: /^Nov 1/ })).toBeInTheDocument();
    expect(await agenda(/^Plans for/)).toHaveTextContent('Brunch');
    expect(screen.getAllByRole('button', { name: /^Add event on/ })).toHaveLength(7);
  });

  it('day view adds a task on that day', async () => {
    const user = userEvent.setup();
    renderApp('/calendar?view=day&date=2026-11-20');
    expect(await screen.findByRole('heading', { name: /Friday, November 20/ })).toBeVisible();
    await user.click(await screen.findByRole('button', { name: /^Add task on/ }));
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    expect(await within(dialog).findByLabelText('Date')).toHaveValue('2026-11-20');
  });
});

describe('quick add', () => {
  it('opens the event form from the "+" menu', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await user.click((await screen.findAllByRole('button', { name: 'Create new' }))[0]!);
    const menu = await screen.findByRole('dialog', { name: 'Create new' });
    await user.click(within(menu).getByRole('button', { name: /Event/ }));
    expect(await screen.findByRole('dialog', { name: 'New event' })).toBeInTheDocument();
  });
});
