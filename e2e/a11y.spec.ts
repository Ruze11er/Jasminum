import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';

/*
 * Automated accessibility audit (axe-core, WCAG 2.2 A and AA) of every page and the main
 * dialogs, in light and dark mode, with realistic data. Manual keyboard and screen-reader
 * passes are still part of the release checklist; axe catches what can be checked by code.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Puts a little of everything straight into the database, then reloads. */
async function seed(page: Page) {
  await page.goto('/tasks');
  await expect(page.getByLabel('Add a task')).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('jasminum');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d;
    };
    const ld = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const now = Date.now();
    const base = { createdAt: now - 864e5 * 40, updatedAt: now - 864e5, deletedAt: null };
    const task = (id: string, extra: Record<string, unknown>) => ({
      id,
      title: id,
      description: '',
      status: 'todo',
      priority: 0,
      dueDate: null,
      dueTime: null,
      scheduledDate: null,
      completedAt: null,
      categoryId: null,
      tagIds: [],
      rrule: null,
      seriesId: null,
      postponeCount: 0,
      originalDueDate: null,
      reminderAt: null,
      order: 1,
      ...base,
      ...extra,
    });
    const rows: Record<string, unknown[]> = {
      categories: [
        { id: 'c1', name: 'School', color: 'lavender', icon: 'circle', order: 0, ...base },
      ],
      tags: [{ id: 'g1', name: 'biology', normalizedName: 'biology', color: 'pink', ...base }],
      tasks: [
        task('Pay rent', { dueDate: ld(day(-2)), priority: 3 }),
        task('Read chapter 4', {
          dueDate: ld(day(0)),
          categoryId: 'c1',
          tagIds: ['g1'],
          postponeCount: 4,
          priority: 2,
        }),
        task('Finished essay', { status: 'done', completedAt: now - 3600e3, dueDate: ld(day(0)) }),
        ...Array.from({ length: 6 }, (_, i) =>
          task(`Done ${i}`, { status: 'done', completedAt: day(-i).getTime(), categoryId: 'c1' }),
        ),
      ],
      events: [
        {
          id: 'e1',
          title: 'Study group',
          description: '',
          start: ld(day(0)),
          end: ld(day(0)),
          allDay: 1,
          location: 'Library',
          categoryId: 'c1',
          tagIds: [],
          rrule: null,
          exdates: [],
          reminderMinutes: null,
          ...base,
        },
      ],
      // One document folder per color, so every folder tile color is checked.
      folders: ['School', 'Travel', 'Money', 'Recipes', 'Health', 'Music'].map((name, i) => ({
        id: `fd${i}`,
        name,
        parentId: null,
        scope: 'documents',
        order: i,
        color: null,
        icon: null,
        ...base,
      })),
      notes: [
        {
          id: 'n1',
          title: 'Lecture notes',
          folderId: null,
          tagIds: ['g1'],
          pinned: 1,
          favorite: 0,
          contentText: 'Photosynthesis\nLight reactions',
          contentJson: {
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: 'Photosynthesis' }],
              },
              {
                type: 'taskList',
                content: [
                  {
                    type: 'taskItem',
                    attrs: { checked: true },
                    content: [
                      { type: 'paragraph', content: [{ type: 'text', text: 'Light reactions' }] },
                    ],
                  },
                ],
              },
            ],
          },
          ...base,
        },
      ],
    };
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(Object.keys(rows), 'readwrite');
      for (const [store, list] of Object.entries(rows))
        for (const r of list) tx.objectStore(store).put(r);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  });
  // A text file through the real import, so the library and file page have content.
  await page.goto('/library');
  await page
    .getByLabel('Add files')
    .first()
    .setInputFiles({
      name: 'Reading list.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Dune\nEmma\nThe Hobbit'),
    });
  await expect(page.getByRole('link', { name: /Reading list/ })).toBeVisible();
}

async function audit(page: Page, name: string, found: string[]) {
  // Let lazy content and animations settle.
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const v of results.violations) {
    const targets = v.nodes
      .slice(0, 3)
      .map((n) => n.target.join(' '))
      .join(' | ');
    found.push(`[${name}] ${v.id} (${v.impact}): ${v.help} → ${targets}`);
  }
}

for (const scheme of ['light', 'dark'] as const) {
  test(
    `no accessibility violations on any page (${scheme})`,
    { tag: '@files' },
    async ({ page }) => {
      // About 20 audits per run; slower browsers need more than the default time.
      test.setTimeout(240_000);
      // No animations: axe would otherwise measure a notice halfway through its fade-in.
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await seed(page);
      const found: string[] = [];

      const pages: [string, string][] = [
        ['home', '/'],
        ['tasks', '/tasks'],
        ['calendar month', '/calendar'],
        ['calendar week', '/calendar?view=week'],
        ['calendar day', '/calendar?view=day'],
        ['notes', '/notes'],
        ['note', '/notes/n1'],
        ['library', '/library'],
        ['library folder', '/library?in=folder:fd0'],
        ['insights', '/insights'],
        ['settings', '/settings'],
        ['trash', '/trash'],
        ['privacy', '/privacy'],
        ['design', '/design'],
      ];
      for (const [name, url] of pages) {
        await page.goto(url);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await audit(page, name, found);
      }

      await page.goto('/library');
      await page.getByRole('link', { name: /Reading list/ }).click();
      await expect(page.getByLabel('File contents')).toContainText('Dune');
      await audit(page, 'file', found);

      // Dialogs.
      await page.goto('/tasks');
      await page.getByRole('button', { name: 'Edit task: Read chapter 4' }).click();
      await expect(
        page.getByRole('dialog', { name: 'Edit task' }).getByLabel('Title'),
      ).toBeVisible();
      await audit(page, 'task form', found);
      await page.keyboard.press('Escape');

      await page.goto('/calendar');
      await page
        .getByRole('button', { name: /^Add event on/ })
        .first()
        .click();
      await expect(
        page.getByRole('dialog', { name: 'New event' }).getByLabel('Title'),
      ).toBeVisible();
      await audit(page, 'event form', found);
      await page.keyboard.press('Escape');

      await page.keyboard.press('Control+k');
      await page.getByRole('combobox', { name: 'Search everything' }).fill('read');
      await audit(page, 'search', found);
      await page.keyboard.press('Escape');

      await page.goto('/settings');
      await page.getByRole('button', { name: 'Back up now' }).click();
      await expect(page.getByRole('dialog', { name: 'Back up your data' })).toBeVisible();
      await audit(page, 'backup dialog', found);

      expect(found, found.join('\n')).toEqual([]);
    },
  );
}
