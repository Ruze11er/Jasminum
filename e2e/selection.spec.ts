import { expect, test, type Page } from './fixtures';

async function addNote(page: Page, title: string) {
  await page.goto('/notes/new');
  await page.getByLabel('Title').fill(title);
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}/);
  await page.getByRole('button', { name: 'Back to notes' }).click();
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
}

test('select several notes and delete them together, with Undo', async ({ page, isMobile }) => {
  for (const title of ['First note', 'Second note', 'Third note']) await addNote(page, title);
  const notes = page.getByRole('list', { name: 'Notes' });

  if (isMobile) {
    // Phones: the Select button, then tap cards.
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await notes.getByRole('button', { name: /Third note/ }).click();
    await notes.getByRole('button', { name: /First note/ }).click();
    await notes.getByRole('button', { name: /Second note/ }).click();
  } else {
    // Computers: the check that appears on hover, then Shift-click for a range.
    await notes.getByRole('link', { name: /Third note/ }).hover();
    await page.getByRole('button', { name: 'Select Third note' }).click();
    await notes.getByRole('button', { name: /First note/ }).click({ modifiers: ['Shift'] });
  }

  const bar = page.getByRole('region', { name: 'Selection' });
  await expect(bar.getByText('3 selected')).toBeVisible();
  await bar.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('3 notes moved to Trash')).toBeVisible();
  await expect(page.getByText('No notes yet')).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(notes.getByRole('link')).toHaveCount(3);
});
