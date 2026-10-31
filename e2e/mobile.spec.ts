import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';

async function waitForServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('the manifest offers a share target and shortcuts', async ({ page }) => {
  const res = await page.request.get('/manifest.webmanifest');
  const manifest = await res.json();
  expect(manifest.share_target).toMatchObject({
    action: '/share-target',
    method: 'POST',
    enctype: 'multipart/form-data',
  });
  expect(manifest.share_target.params.files[0].accept).toContain('application/pdf');
  expect(manifest.shortcuts.map((s: { name: string }) => s.name)).toEqual([
    'New task',
    'New note',
    'Calendar',
    'Library',
  ]);
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
});

test(
  'files shared into the app (Android share target) land in the library',
  { tag: '@files' },
  async ({ page }) => {
    await page.goto('/library');
    await waitForServiceWorker(page);

    // Exactly what Android does: a form POST navigation to /share-target with the files.
    await page.evaluate(() => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/share-target';
      form.enctype = 'multipart/form-data';
      const input = document.createElement('input');
      input.type = 'file';
      input.name = 'files';
      input.multiple = true;
      const dt = new DataTransfer();
      dt.items.add(
        new File(['%PDF-1.4 shared'], 'Shared lecture.pdf', { type: 'application/pdf' }),
      );
      dt.items.add(new File(['Milk, eggs'], 'Shopping.txt', { type: 'text/plain' }));
      input.files = dt.files;
      form.append(input);
      document.body.append(form);
      form.submit();
    });

    await expect(page).toHaveURL(/\/library$/);
    // Any website could send this request, so nothing is added until the user says so.
    const dialog = page.getByRole('dialog', { name: 'Add 2 shared files?' });
    await expect(dialog.getByText('Shared lecture.pdf')).toBeVisible();
    await expect(page.getByRole('link', { name: /Shared lecture/ })).toHaveCount(0);
    // This dialog needs the service worker, so it's audited here rather than in a11y.spec.ts.
    await page.waitForTimeout(400); // let the dialog finish fading in
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await dialog.getByRole('button', { name: 'Add to Library' }).click();
    await expect(page.getByRole('link', { name: /Shared lecture/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Shopping/ })).toBeVisible();
    // The service worker's temporary cache is emptied once imported.
    await expect
      .poll(() =>
        page.evaluate(
          async () => (await (await caches.open('jasminum-share-target')).keys()).length,
        ),
      )
      .toBe(0);
  },
);

test('the app lock survives a reload and needs the PIN', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Turn on app lock' }).click();
  await page.getByLabel('PIN', { exact: true }).fill('2580');
  await page.getByLabel('Type it again').fill('2580');
  await page.getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(page.getByText('App lock is on')).toBeVisible();

  await page.reload();
  const lock = page.getByRole('dialog', { name: 'Jasminum is locked' });
  await expect(lock).toBeVisible();
  // Nothing behind the lock can be reached: the app is inert, so Tab never leaves the lock.
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    const where = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return 'outside the page';
      return el.closest('[aria-labelledby="lock-title"]') ? 'lock' : el.outerHTML.slice(0, 120);
    });
    // Focus cycles through the lock's own controls and the browser's, never the app.
    expect(['lock', 'outside the page']).toContain(where);
  }
  await lock.getByLabel('PIN').fill('1111');
  await lock.getByRole('button', { name: 'Unlock' }).click();
  await expect(lock.getByRole('alert')).toContainText('Wrong PIN');
  await lock.getByLabel('PIN').fill('2580');
  await lock.getByRole('button', { name: 'Unlock' }).click();
  await expect(lock).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
});

test('swiping a task right completes it on a touch screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch gesture');
  await page.goto('/tasks');
  await page.getByLabel('Add a task').fill('Water plants');
  await page.getByLabel('Add a task').press('Enter');
  const row = page.getByRole('button', { name: 'Edit task: Water plants' }).locator('..');
  const box = (await row.boundingBox())!;
  const y = box.y + box.height / 2;
  const at = (x: number) => ({
    pointerType: 'touch',
    pointerId: 3,
    isPrimary: true,
    clientX: x,
    clientY: y,
    bubbles: true,
  });
  await row.dispatchEvent('pointerdown', at(box.x + 20));
  await row.dispatchEvent('pointermove', at(box.x + 80));
  await row.dispatchEvent('pointermove', at(box.x + 160));
  await row.dispatchEvent('pointerup', at(box.x + 160));
  await expect(page.getByText('Task done')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Complete: Water plants' })).toBeChecked();
});

test('the "New task" home-screen shortcut opens the task form', async ({ page }) => {
  await page.goto('/tasks?new=1');
  await expect(page.getByRole('dialog', { name: 'New task' })).toBeVisible();
});
