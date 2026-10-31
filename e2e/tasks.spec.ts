import { expect, test } from '@playwright/test';

test('create, edit, complete and keep tasks across reloads', async ({ page }) => {
  await page.goto('/tasks');

  // Quick add with a tag.
  const quickAdd = page.getByLabel('Add a task');
  await quickAdd.fill('Read chapter 4 #biology');
  await quickAdd.press('Enter');
  await expect(page.getByRole('button', { name: 'Edit task: Read chapter 4' })).toBeVisible();
  await expect(page.getByText('#biology')).toBeVisible();

  // Open the form, make it repeat weekly and add a checklist.
  await page.getByRole('button', { name: 'Edit task: Read chapter 4' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await dialog.getByLabel('Repeat').selectOption('weekly');
  await dialog.getByRole('radio', { name: 'Medium' }).click();
  await dialog.getByLabel('New checklist item').fill('Take notes');
  await dialog.getByLabel('New checklist item').press('Enter');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Medium')).toBeVisible();
  await expect(page.getByText('0/1')).toBeVisible();

  // Tick the checklist item from the list.
  await page.getByRole('button', { name: 'Show checklist for Read chapter 4' }).click();
  await page.getByRole('checkbox', { name: 'Take notes' }).check();
  await expect(page.getByText('1/1')).toBeVisible();

  // Complete it: next week's copy appears in Upcoming.
  await page.getByRole('checkbox', { name: 'Complete: Read chapter 4' }).check();
  await expect(page.getByText(/Done! Next one:/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('region', { name: /Done today/ })).toContainText('Read chapter 4');
  await page.getByRole('radio', { name: /Upcoming/ }).click();
  await expect(page.getByRole('button', { name: 'Edit task: Read chapter 4' })).toBeVisible();
  await expect(page.getByText('0/1')).toBeVisible(); // the copy's checklist starts unticked
});

test('Home shows today’s progress', async ({ page }) => {
  await page.goto('/tasks');
  for (const title of ['Water plants', 'Pay bills']) {
    await page.getByLabel('Add a task').fill(title);
    await page.getByLabel('Add a task').press('Enter');
    await expect(page.getByRole('button', { name: `Edit task: ${title}` })).toBeVisible();
  }
  await page.getByRole('checkbox', { name: 'Complete: Pay bills' }).check();
  // The box ticks instantly; the toast shows once the change is saved.
  await expect(page.getByText('Task done')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('img', { name: '1 of 2 tasks done today' })).toBeVisible();
  await expect(page.getByRole('list', { name: "Today's tasks" })).toContainText('Water plants');
});
