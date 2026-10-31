import { expect, test, type Page } from '@playwright/test';

const quote = (page: Page) =>
  page.getByRole('heading', { name: 'Quote of the day' }).locator('..').getByRole('blockquote');

test('the daily quote stays the same all day and changes after midnight', async ({ page }) => {
  // A fake clock in the browser: 23:59:00 on Wednesday, Nov 4, 2026 (local time).
  await page.clock.install({ time: new Date('2026-11-04T23:59:00') });
  await page.goto('/');
  await expect(page.getByText('Wednesday, November 4')).toBeVisible();
  const first = await quote(page).textContent();
  expect(first).toBeTruthy();

  // Reopening the app the same day shows the same quote.
  await page.reload();
  await expect(quote(page)).toHaveText(first!);

  // Leave Home open past midnight: the midnight timer switches to a new day and quote.
  await page.clock.fastForward('02:00');
  await expect(page.getByText('Thursday, November 5')).toBeVisible();
  await expect(quote(page)).not.toHaveText(first!);
  const second = await quote(page).textContent();

  await page.reload();
  await expect(quote(page)).toHaveText(second!);
});

test('Home shows today’s events and the week in numbers', async ({ page }) => {
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'Add event on Today' }).click();
  const form = page.getByRole('dialog', { name: 'New event' });
  await form.getByLabel('Title').fill('Piano lesson');
  await form.getByText('All day').click();
  await form.getByRole('button', { name: 'Add event' }).click();
  await expect(form).toBeHidden();

  await page.goto('/tasks');
  await page.getByLabel('Add a task').fill('Water plants');
  await page.getByLabel('Add a task').press('Enter');
  await page.getByRole('checkbox', { name: 'Complete: Water plants' }).check();

  await page.goto('/');
  await expect(
    page.getByRole('list', { name: "Today's events" }).getByRole('button', {
      name: 'Edit event: Piano lesson',
    }),
  ).toBeVisible();
  const week = page.getByRole('region', { name: 'Your week' });
  await expect(week.getByText('1 day')).toBeVisible();
  await expect(week.getByText('Including today')).toBeVisible();
});
