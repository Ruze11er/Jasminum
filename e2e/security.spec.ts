import { expect, test } from './fixtures';

/** A one-page PDF, to exercise pdf.js (it runs in a worker) under the policy. */
function makePdf(): Buffer {
  const stream = 'BT /F1 24 Tf 40 100 Td (Policy check) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

test(
  'the Content-Security-Policy is in place and nothing in the app breaks it',
  { tag: '@files' },
  async ({ page }) => {
    // Record every policy violation on every page load.
    await page.addInitScript(() => {
      const w = window as unknown as { cspViolations: string[] };
      w.cspViolations = [];
      document.addEventListener('securitypolicyviolation', (e) =>
        w.cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`),
      );
    });
    const consoleCsp: string[] = [];
    page.on('console', (m) => {
      if (/Content Security Policy/i.test(m.text())) consoleCsp.push(m.text());
    });
    const violations = async () =>
      page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);

    await page.goto('/');
    const policy = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).not.toContain('unsafe-eval');

    // Rich-text editor (Tiptap/ProseMirror).
    await page.goto('/notes/new');
    await page.getByLabel('Title').fill('Policy note');
    await page.getByLabel('Title').press('Enter');
    await page.keyboard.type('Bold text');
    await page.getByRole('button', { name: 'Checklist' }).click();
    await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}/);
    expect(await violations()).toEqual([]);

    // File import (hashing worker) and PDF preview (pdf.js worker).
    await page.goto('/library');
    await page.getByLabel('Add files').first().setInputFiles({
      name: 'Policy.pdf',
      mimeType: 'application/pdf',
      buffer: makePdf(),
    });
    await page.getByRole('link', { name: /Policy/ }).click();
    await expect(page.getByText('Page 1 of 1')).toBeVisible();
    expect(await violations()).toEqual([]);

    // Calendar, insights charts, search palette.
    await page.goto('/calendar');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/insights');
    await expect(page.getByRole('heading', { name: 'Insights', level: 1 })).toBeVisible();
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Search everything' }).fill('policy');
    await expect(page.getByRole('option', { name: /Policy note/ })).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await violations()).toEqual([]);

    // Encrypted backup (WebCrypto + zip).
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Back up now' }).click();
    const dialog = page.getByRole('dialog', { name: 'Back up your data' });
    await dialog.getByText('Protect with a passphrase').click();
    await dialog.getByLabel('Passphrase', { exact: true }).fill('pink jasmine');
    await dialog.getByLabel('Type it again').fill('pink jasmine');
    await dialog.getByRole('button', { name: 'Create backup' }).click();
    await expect(dialog.getByText(/Backup ready/)).toBeVisible({ timeout: 30_000 });

    expect(await violations()).toEqual([]);
    expect(consoleCsp).toEqual([]);
  },
);

test('the deploy files are served with the build', async ({ page }) => {
  const headers = await (await page.request.get('/_headers')).text();
  expect(headers).toContain('Content-Security-Policy:');
  expect(headers).toContain("frame-ancestors 'none'");
  expect(headers).toContain('X-Content-Type-Options: nosniff');
  const redirects = await (await page.request.get('/_redirects')).text();
  expect(redirects).toMatch(/\/\*\s+\/index\.html\s+200/);
});
