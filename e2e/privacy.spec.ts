// Uses the plain Playwright test (not ./fixtures), so the privacy agreement shows.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const consent = (page: Page) => page.getByRole('dialog', { name: 'Welcome to Jasminum' });
// A cold first load can take several seconds in Firefox and WebKit on a busy machine.
const FIRST_LOAD = { timeout: 20_000 };

test('the privacy policy is agreed to once, after the welcome splash', async ({ page }) => {
  // Three cold page loads plus the 4-second splash: too tight for 30s in slower browsers.
  test.setTimeout(90_000);
  await page.goto('/');
  // The splash comes first and leaves by itself; the agreement is waiting underneath.
  await expect(page.getByTestId('welcome')).toBeVisible(FIRST_LOAD);
  await expect(page.getByTestId('welcome')).toHaveCount(0, { timeout: 10_000 });

  const dialog = consent(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Privacy Policy' })).toBeFocused();
  await expect(dialog.getByRole('heading', { name: 'Where your data lives' })).toBeVisible();

  // The app behind can't be reached: Tab stays inside the agreement.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(
      () =>
        !document.activeElement ||
        document.activeElement === document.body ||
        !!document.activeElement.closest('[aria-labelledby="privacy-consent-title"]'),
    );
    expect(inside).toBe(true);
  }

  const agree = dialog.getByRole('button', { name: 'I agree' });
  await expect(agree).toBeDisabled();
  await dialog.getByText('I have read and agree to the Privacy Policy').click();
  await agree.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Quote of the day')).toBeVisible();

  // Remembered: not asked again, even in a new tab.
  await page.reload();
  await expect(page.getByText('Quote of the day')).toBeVisible(FIRST_LOAD);
  await expect(consent(page)).toHaveCount(0);
  const other = await page.context().newPage();
  await other.goto('/tasks');
  await expect(other.getByRole('heading', { name: 'Tasks', level: 1 })).toBeVisible(FIRST_LOAD);
  await expect(consent(other)).toHaveCount(0);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the privacy agreement has no accessibility violations (${scheme})`, async ({ page }) => {
    test.setTimeout(60_000); // a cold load plus axe
    await page.addInitScript(() => sessionStorage.setItem('jasminum:welcome-seen', '1'));
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(consent(page).getByRole('button', { name: 'I agree' })).toBeVisible(FIRST_LOAD);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
