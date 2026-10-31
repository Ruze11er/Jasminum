import { expect, test } from '@playwright/test';

test('create a repeating event, page through months and keep it after reload', async ({ page }) => {
  await page.goto('/calendar');
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();

  // All day, so the test doesn't depend on the current time of day.
  await page.getByRole('button', { name: 'Add event on Today' }).click();
  const dialog = page.getByRole('dialog', { name: 'New event' });
  await dialog.getByLabel('Title').fill('Piano lesson');
  await dialog.getByText('All day').click();
  await dialog.getByLabel('Repeat').selectOption('weekly');
  await dialog.getByLabel('Place').fill('Music school');
  await dialog.getByRole('button', { name: 'Add event' }).click();
  await expect(dialog).toBeHidden();

  const today = page.getByRole('list', { name: 'Plans for Today' });
  await expect(today.getByRole('button', { name: 'Edit event: Piano lesson' })).toContainText(
    'Music school',
  );

  // Every week next month has a lesson.
  await page.getByRole('button', { name: 'Next month' }).click();
  // Poll: right after the click the old month can still be on screen.
  await expect
    .poll(() => page.getByRole('button', { name: /, 1 item$/ }).count())
    .toBeGreaterThanOrEqual(4);

  // Tapping a day shows its agenda below the grid.
  await page
    .getByRole('button', { name: /, 1 item$/ })
    .first()
    .click();
  await expect(
    page.getByRole('list', { name: /^Plans for/ }).getByRole('button', {
      name: 'Edit event: Piano lesson',
    }),
  ).toBeVisible();

  // The place in the calendar survives a reload, and so does the event.
  const url = page.url();
  await page.reload();
  expect(page.url()).toBe(url);
  await expect(
    page.getByRole('list', { name: /^Plans for/ }).getByRole('button', {
      name: 'Edit event: Piano lesson',
    }),
  ).toBeVisible();
});

test('week and day views show tasks and events together', async ({ page }) => {
  await page.goto('/tasks');
  await page.getByLabel('Add a task').fill('Pack bag');
  await page.getByLabel('Add a task').press('Enter');
  await expect(page.getByRole('button', { name: 'Edit task: Pack bag' })).toBeVisible();

  await page.goto('/calendar?view=day');
  await page.getByRole('button', { name: /^Add event on/ }).click();
  const dialog = page.getByRole('dialog', { name: 'New event' });
  await dialog.getByLabel('Title').fill('School trip');
  await dialog.getByText('All day').click();
  await dialog.getByRole('button', { name: 'Add event' }).click();
  await expect(dialog).toBeHidden();

  const plans = page.getByRole('list', { name: /^Plans for/ });
  await expect(plans.getByRole('button', { name: /^Edit/ })).toHaveText([
    /School trip/,
    /Pack bag/,
  ]);

  await page.getByRole('radio', { name: 'Week' }).click();
  await expect(page.getByRole('button', { name: 'Edit event: School trip' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit task: Pack bag' })).toBeVisible();
});
