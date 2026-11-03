import { expect, test, type Page } from './fixtures';

const editorText = (page: Page) => page.getByRole('textbox', { name: 'Note text' });

test('write a formatted note, find it by its content and keep it after reload', async ({
  page,
}) => {
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New note' }).first().click();

  await page.getByLabel('Title').fill('Biology lecture');
  await page.getByLabel('Title').press('Enter'); // moves into the text
  await page.keyboard.type('Photosynthesis turns light into sugar.');
  await page.keyboard.press('Enter');

  // A heading, a bold word and a checklist from the toolbar.
  await page.getByRole('button', { name: 'Checklist' }).click();
  await page.keyboard.type('Revise chapter 3');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Ask about chlorophyll');
  await expect(editorText(page).getByRole('checkbox')).toHaveCount(2);
  await editorText(page).getByRole('checkbox').first().check();

  await expect(page.getByText(/^Edited/)).toBeVisible({ timeout: 5000 });
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}/);

  await page.reload();
  await expect(page.getByLabel('Title')).toHaveValue('Biology lecture');
  await expect(editorText(page)).toContainText('Photosynthesis turns light into sugar.');
  await expect(editorText(page).getByRole('checkbox').first()).toBeChecked();

  // Search finds it by a word in the text, not the title.
  await page.goto('/notes');
  await page.getByLabel('Search notes').fill('chlorophyll');
  await expect(page.getByRole('list', { name: 'Notes' }).getByRole('link')).toHaveCount(1);
  await page.getByLabel('Search notes').fill('mitochondria');
  await expect(page.getByText('No notes match')).toBeVisible();
});

test('link a note to a task and open it from the task', async ({ page }) => {
  await page.goto('/tasks');
  await page.getByLabel('Add a task').fill('Write lab report');
  await page.getByLabel('Add a task').press('Enter');
  await expect(page.getByRole('button', { name: 'Edit task: Write lab report' })).toBeVisible();

  await page.goto('/notes/new');
  await page.getByLabel('Title').fill('Lab notes');
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}/);
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Link a task, event or file' });
  await picker.getByRole('button', { name: /Write lab report/ }).click();
  await expect(page.getByRole('button', { name: 'Open task: Write lab report' })).toBeVisible();

  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Edit task: Write lab report' }).click();
  await page
    .getByRole('dialog', { name: 'Edit task' })
    .getByRole('link', { name: 'Lab notes' })
    .click();
  await expect(page.getByLabel('Title')).toHaveValue('Lab notes');
});

test('notes open and save offline', { tag: '@offline' }, async ({ page, context }) => {
  await page.goto('/notes/new');
  await page.getByLabel('Title').fill('Offline ideas');
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}/);
  const url = page.url();

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.route('**/*', (route) => route.abort('internetdisconnected'));

  // The editor (a separate download) comes from the offline cache.
  await page.goto(url);
  await editorText(page).click();
  await page.keyboard.type('Written on a plane');
  await expect(page.getByText(/^Edited/)).toBeVisible({ timeout: 5000 });
  await page.reload();
  await expect(editorText(page)).toContainText('Written on a plane');
});

test('keeps text typed right before a reload', async ({ page }) => {
  await page.goto('/notes/new');
  await page.getByLabel('Title').fill('Quick thought');
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}/);
  await expect(page.getByText(/^Edited/)).toBeVisible();

  await editorText(page).click();
  await page.keyboard.type('Saved by the backup');
  await page.reload(); // no waiting for the autosave
  await expect(editorText(page)).toContainText('Saved by the backup');
});

test('links in a note open in a new tab', async ({ page, context }) => {
  // Answer for the outside site so the test never goes online.
  await context.route('https://example.com/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<title>Guide</title>' }),
  );
  await page.goto('/notes/new');
  await page.getByLabel('Title').fill('Reading list');
  await page.getByLabel('Title').press('Enter');
  await page.keyboard.type('Read https://example.com/guide today');
  const link = editorText(page).getByRole('link', { name: 'https://example.com/guide' });
  await expect(link).toBeVisible();

  // Clicking the link opens it; the app stays on the note.
  const opened = context.waitForEvent('page');
  await link.click();
  const tab = await opened;
  await expect(tab).toHaveURL('https://example.com/guide');
  await tab.close();
  await expect(page).toHaveURL(/\/notes\//);
  await expect(page.getByLabel('Title')).toHaveValue('Reading list');

  // The toolbar button does the same for keyboard users, once the cursor is in a link.
  const openButton = page.getByRole('button', { name: 'Open link' });
  await editorText(page).press('End');
  await expect(openButton).toBeDisabled();
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft');
  await expect(openButton).toBeEnabled();
  const again = context.waitForEvent('page');
  await openButton.click();
  await expect(await again).toHaveURL('https://example.com/guide');
});
