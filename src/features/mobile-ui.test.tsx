import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { db } from '@/data/db';
import { getSetting, setSetting } from '@/data/repos/settings';
import { tasksRepo } from '@/data/repos/tasks';
import { clock } from '@/lib/clock';
import { hashPin } from '@/lib/pin';
import { useLockStore, writeLockHint } from '@/stores/lockStore';
import { useImportQueue } from '@/features/library/importStore';
import { SHARE_CACHE } from '@/features/library/sharedFiles';

// jsdom has no PointerEvent: a MouseEvent with the pointer fields is enough here.
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class PointerEventStub extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? 'mouse';
      }
    }
    Object.assign(window, { PointerEvent: PointerEventStub });
  }
});

beforeEach(() => {
  clock.set(new Date('2026-11-04T10:00:00').getTime());
});
afterEach(() => {
  writeLockHint(false);
  localStorage.removeItem('jasminum:lock-attempts');
});

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('welcome card', () => {
  it('guides a new user, then goes away for good', async () => {
    const user = userEvent.setup();
    const persist = vi.fn(async () => true);
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persist,
        persisted: async () => false,
        estimate: async () => ({ usage: 0, quota: 1e9 }),
      },
    });
    renderApp();
    const card = await screen.findByRole('heading', { name: 'Welcome to Jasminum' });
    const region = card.closest('div')!.parentElement!;
    await user.type(within(region).getByLabelText('Your name'), 'Jas');
    await user.click(within(region).getByRole('button', { name: 'Save' }));
    expect(await within(region).findByText('Hi, Jas!')).toBeInTheDocument();

    await user.click(within(region).getByRole('button', { name: 'Protect my data' }));
    expect(persist).toHaveBeenCalled();
    expect(await screen.findByText('Storage protected')).toBeInTheDocument();

    await user.click(within(region).getByRole('button', { name: "I'm all set" }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Welcome to Jasminum' })).toBeNull(),
    );
    expect((await getSetting('onboarding')).completedAt).toBe(clock.now());
    delete (navigator as unknown as Record<string, unknown>).storage;
  });
});

describe('install guidance', () => {
  it('nudges iPhone users in Safari to add the app to the Home Screen', async () => {
    const user = userEvent.setup();
    const realUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1',
    });
    renderApp('/tasks');
    const banner = await screen.findByRole('region', { name: 'Install Jasminum' });
    await user.click(within(banner).getByRole('button', { name: 'How?' }));
    const steps = await screen.findByRole('dialog', { name: 'Add to Home Screen' });
    expect(
      within(steps).getByText(/Add to Home Screen/, { selector: 'strong' }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(within(banner).getByRole('button', { name: 'Hide this tip' }));
    expect(screen.queryByRole('region', { name: 'Install Jasminum' })).toBeNull();
    expect(localStorage.getItem('jasminum:apple-install-banner-dismissed')).toBe('1');
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: realUA });
    localStorage.removeItem('jasminum:apple-install-banner-dismissed');
  });
});

describe('app lock', () => {
  const enterPin = async (user: ReturnType<typeof userEvent.setup>, pin: string) => {
    const field = await screen.findByLabelText('PIN', { selector: 'input' });
    await user.clear(field);
    await user.type(field, pin);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
  };

  it('turns on from Settings, locks, and unlocks only with the right PIN', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Turn on app lock' }));
    await user.type(screen.getByLabelText('PIN'), '12');
    await user.type(screen.getByLabelText('Type it again'), '12');
    await user.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(await screen.findByText('Use 4 to 8 digits.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('PIN'), '58');
    await user.type(screen.getByLabelText('Type it again'), '58');
    await user.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(await screen.findByText('App lock is on')).toBeInTheDocument();
    const stored = await getSetting('appLock');
    expect(stored).toMatchObject({ lockAfterMinutes: 1 });
    expect(JSON.stringify(stored)).not.toContain('1258');

    await user.click(screen.getByRole('button', { name: 'Lock now' }));
    expect(await screen.findByRole('dialog', { name: 'Jasminum is locked' })).toBeInTheDocument();
    await enterPin(user, '0000');
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong PIN');
    await enterPin(user, '1258');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Jasminum is locked' })).toBeNull(),
    );
  });

  it('starts locked when the lock is on, and makes you wait after five wrong PINs', async () => {
    const user = userEvent.setup();
    await setSetting('appLock', { ...(await hashPin('2580', 10_000)), lockAfterMinutes: 0 });
    writeLockHint(true);
    useLockStore.setState({ locked: true });
    renderApp();
    for (let i = 0; i < 5; i++) await enterPin(user, '1111');
    expect(await screen.findByText(/Too many tries. Wait 30 seconds/)).toBeInTheDocument();
    expect(screen.getByLabelText('PIN', { selector: 'input' })).toBeDisabled();
  });

  it('locks again after the app was in the background', async () => {
    await setSetting('appLock', { ...(await hashPin('2580', 10_000)), lockAfterMinutes: 1 });
    renderApp();
    await screen.findByRole('heading', { level: 1 });
    // The setting loads and locks once; unlock to start from an open app.
    await waitFor(() => expect(useLockStore.getState().locked).toBe(true));
    act(() => useLockStore.getState().unlock());

    const visibility = (state: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
      act(() => document.dispatchEvent(new Event('visibilitychange')));
    };
    visibility('hidden');
    clock.set(clock.now() + 30_000);
    visibility('visible');
    expect(useLockStore.getState().locked).toBe(false); // back within a minute
    visibility('hidden');
    clock.set(clock.now() + 61_000);
    visibility('visible');
    expect(await screen.findByRole('dialog', { name: 'Jasminum is locked' })).toBeInTheDocument();
  });
});

describe('swipe gestures', () => {
  const swipe = (el: Element, dx: number) => {
    fireEvent.pointerDown(el, { pointerType: 'touch', pointerId: 7, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(el, {
      pointerType: 'touch',
      pointerId: 7,
      clientX: 200 + dx / 2,
      clientY: 102,
    });
    fireEvent.pointerMove(el, {
      pointerType: 'touch',
      pointerId: 7,
      clientX: 200 + dx,
      clientY: 103,
    });
    fireEvent.pointerUp(el, {
      pointerType: 'touch',
      pointerId: 7,
      clientX: 200 + dx,
      clientY: 103,
    });
  };
  const row = async (title: string) =>
    (await screen.findByRole('button', { name: `Edit task: ${title}` })).parentElement!;

  it('completes a task when swiped right and deletes it when swiped left', async () => {
    const a = await tasksRepo.create({ title: 'Water plants', dueDate: '2026-11-04' });
    const b = await tasksRepo.create({ title: 'Old idea', dueDate: '2026-11-04' });
    renderApp('/tasks');
    swipe(await row('Water plants'), 120);
    expect(await screen.findByText('Task done')).toBeInTheDocument();
    await waitFor(async () => expect((await db.tasks.get(a.id))?.status).toBe('done'));

    swipe(await row('Old idea'), -120);
    expect(await screen.findByText('Moved to Trash')).toBeInTheDocument();
    await waitFor(async () => expect((await db.tasks.get(b.id))?.deletedAt).not.toBeNull());
  });

  it('ignores short swipes, vertical scrolls and the mouse', async () => {
    const t = await tasksRepo.create({ title: 'Stay put', dueDate: '2026-11-04' });
    renderApp('/tasks');
    const el = await row('Stay put');
    swipe(el, 40); // too short
    fireEvent.pointerDown(el, { pointerType: 'touch', pointerId: 8, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(el, { pointerType: 'touch', pointerId: 8, clientX: 215, clientY: 180 });
    fireEvent.pointerUp(el, { pointerType: 'touch', pointerId: 8, clientX: 330, clientY: 260 }); // scrolling
    fireEvent.pointerDown(el, { pointerType: 'mouse', pointerId: 9, clientX: 200, clientY: 100 });
    fireEvent.pointerUp(el, { pointerType: 'mouse', pointerId: 9, clientX: 400, clientY: 100 });
    await new Promise((r) => setTimeout(r, 100));
    expect((await db.tasks.get(t.id))?.status).toBe('todo');
    expect((await db.tasks.get(t.id))?.deletedAt).toBeNull();
  });
});

describe('sharing files into the app', () => {
  // A stand-in for the Cache API (jsdom has none), holding one shared PDF.
  function fakeShareCache() {
    const stored = new Map<string, () => Response>();
    const cache = {
      keys: async () => [...stored.keys()].map((k) => new Request(`http://localhost${k}`)),
      match: async (r: Request) => stored.get(new URL(r.url).pathname)?.(),
      delete: async (r: Request) => stored.delete(new URL(r.url).pathname),
    };
    const open = vi.fn(async () => cache);
    const remove = vi.fn(async () => {
      stored.clear();
      return true;
    });
    Object.assign(globalThis, {
      caches: { open, has: async () => stored.size > 0, delete: remove },
    });
    stored.set(
      '/__shared__/1-0',
      () =>
        new Response('%PDF-1.7', {
          headers: {
            'content-type': 'application/pdf',
            'x-file-name': encodeURIComponent('Lecture notes.pdf'),
          },
        }),
    );
    const enqueue = vi.fn();
    useImportQueue.setState({ enqueue });
    return { stored, open, remove, enqueue };
  }
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).caches;
  });

  it('asks first, then imports the files the service worker received', async () => {
    const user = userEvent.setup();
    const { stored, open, enqueue } = fakeShareCache();

    const router = renderApp('/library?shared=1');
    const dialog = await screen.findByRole('dialog', { name: 'Add a shared file?' });
    expect(within(dialog).getByText('Lecture notes.pdf')).toBeInTheDocument();
    expect(enqueue).not.toHaveBeenCalled();
    await waitFor(() => expect(router.state.location.search).toBe(''));

    await user.click(within(dialog).getByRole('button', { name: 'Add to Library' }));
    await waitFor(() => expect(enqueue).toHaveBeenCalled());
    expect(open).toHaveBeenCalledWith(SHARE_CACHE);
    const [files] = enqueue.mock.calls[0]! as [File[]];
    expect(files.map((f) => [f.name, f.type])).toEqual([['Lecture notes.pdf', 'application/pdf']]);
    expect(stored.size).toBe(0); // the cache is emptied
  });

  it('throws the files away when the user did not share them', async () => {
    const user = userEvent.setup();
    const { stored, remove, enqueue } = fakeShareCache();

    renderApp('/library?shared=1');
    const dialog = await screen.findByRole('dialog', { name: 'Add a shared file?' });
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(SHARE_CACHE));
    expect(stored.size).toBe(0);
    expect(enqueue).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('offers waiting files on any visit, and closing the question keeps them waiting', async () => {
    const user = userEvent.setup();
    const { stored, enqueue } = fakeShareCache();

    renderApp('/library');
    await screen.findByRole('dialog', { name: 'Add a shared file?' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(enqueue).not.toHaveBeenCalled();
    expect(stored.size).toBe(1);
  });
});

describe('home-screen shortcuts', () => {
  it('"New task" opens the task form', async () => {
    renderApp('/tasks?new=1');
    expect(await screen.findByRole('dialog', { name: 'New task' })).toBeInTheDocument();
  });
});
