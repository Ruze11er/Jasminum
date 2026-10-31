import { expect, test } from '@playwright/test';

const localDate = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

test('a new user sees no insights', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Getting to know you')).toBeVisible();
  await page.goto('/insights');
  await expect(page.getByText('All clear')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('an overdue task becomes an insight you can act on, and charts appear', async ({ page }) => {
  // A task that was due two days ago.
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'New task' }).click();
  const form = page.getByRole('dialog', { name: 'New task' });
  await form.getByLabel('Title').fill('Pay rent');
  await form.getByLabel('Date').fill(localDate(-2));
  await form.getByRole('button', { name: 'Add task' }).click();
  await expect(form).toBeHidden();

  await page.goto('/');
  const card = page.getByRole('article', { name: '“Pay rent” is overdue' });
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.getByRole('button', { name: 'Move to today' }).click();
  await expect(page.getByText('Task moved')).toBeVisible();
  await expect(card).toBeHidden();

  // Finish it: the charts on the Insights page pick it up.
  await page.getByRole('checkbox', { name: 'Complete: Pay rent' }).check();
  await page.goto('/insights');
  const chart = page.getByRole('list', { name: 'Tasks done per week' });
  await expect(chart.getByRole('listitem', { name: 'This week: 1 task' })).toBeVisible();
  await chart.getByRole('listitem', { name: 'This week: 1 task' }).focus();
  await expect(page.getByText('This week: 1 task', { exact: true })).toBeVisible();
});
