import { mkdirSync, openSync, writeSync, closeSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/** A tiny valid one-page PDF that says "Hello Jasminum". */
function makePdf(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null, // content stream, filled below
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = 'BT /F1 24 Tf 40 100 Td (Hello Jasminum) Tj ET';
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
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

/** The "Add files" input in the page header. */
const addFilesInput = (page: Page) => page.getByLabel('Add files').first();

test(
  'importing 50 files and one over 100 MB keeps the page responsive',
  { tag: '@files' },
  async ({ page }, testInfo) => {
    test.slow();
    const dir = testInfo.outputPath('import');
    mkdirSync(dir, { recursive: true });

    // One 110 MB file (written in chunks, never held in memory) and 50 small ones.
    const big = join(dir, 'Big textbook.pdf');
    const fd = openSync(big, 'w');
    const chunk = Buffer.alloc(1024 * 1024, 7);
    for (let i = 0; i < 110; i++) writeSync(fd, chunk);
    closeSync(fd);
    const small = Array.from({ length: 50 }, (_, i) => {
      const path = join(dir, `Worksheet ${String(i + 1).padStart(2, '0')}.txt`);
      writeFileSync(path, `Worksheet number ${i + 1}\n`);
      return path;
    });

    await page.goto('/library');
    // Record any main-thread task that blocks the page for long.
    await page.evaluate(() => {
      (window as unknown as { longest: number }).longest = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          const w = window as unknown as { longest: number };
          w.longest = Math.max(w.longest, e.duration);
        }
      }).observe({ type: 'longtask', buffered: false });
    });

    await addFilesInput(page).setInputFiles([big, ...small]);
    await expect(page.getByText(/Adding files…/)).toBeVisible();

    // While the big file is being processed, the page still reacts straight away.
    const recent = page.getByRole('button', { name: /^Recent\s*\d/ });
    await recent.click();
    await expect(recent).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 });
    await page.getByRole('button', { name: /^All files/ }).click();

    await expect(page.getByRole('region', { name: 'Adding files' })).toContainText(
      '51 files added',
      {
        timeout: 120_000,
      },
    );
    await expect(page.getByRole('list', { name: 'Files' }).getByRole('link')).toHaveCount(51);
    const longest = await page.evaluate(() => (window as unknown as { longest: number }).longest);
    expect(longest).toBeLessThan(500);

    // Found in two interactions: type, then open.
    await page.getByLabel('Search files').fill('worksheet 37');
    await page.getByRole('link', { name: /Worksheet 37/ }).click();
    await expect(page.getByLabel('File contents')).toContainText('Worksheet number 37');
  },
);

test(
  'drop a PDF, preview it, and keep it available offline',
  { tag: '@files' },
  async ({ page, context }) => {
    await page.goto('/library');
    await expect(page.getByText('Your library is empty')).toBeVisible();

    // Drag and drop a PDF onto the page.
    const pdf = makePdf().toString('base64');
    await page.evaluate((b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], 'Hello.pdf', { type: 'application/pdf' }));
      document.body.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }));
      document.body.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
    }, pdf);
    await page.getByRole('link', { name: /Hello/ }).click();

    // pdf.js renders the page.
    await expect(page.getByText('Page 1 of 1')).toBeVisible();
    const canvas = page.getByRole('img', { name: 'Hello, page 1' });
    await expect.poll(async () => (await canvas.boundingBox())?.height ?? 0).toBeGreaterThan(50);
    const url = page.url();

    // Offline: the app, the file and the PDF engine all come from this device.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.route('**/*', (route) => route.abort('internetdisconnected'));
    await page.goto(url);
    await expect(page.getByText('Page 1 of 1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();
  },
);

test('a note links to a file, and the file shows the note', { tag: '@files' }, async ({ page }) => {
  await page.goto('/library');
  await addFilesInput(page).setInputFiles({
    name: 'Syllabus.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Week 1: cells'),
  });
  await expect(page.getByRole('link', { name: /Syllabus/ })).toBeVisible();

  await page.goto('/notes/new');
  await page.getByLabel('Title').fill('Course plan');
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}/);
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Link a task, event or file' })
    .getByRole('button', { name: /Syllabus/ })
    .click();
  await page.getByRole('button', { name: 'Open file: Syllabus' }).click();
  await expect(page.getByRole('heading', { name: 'Syllabus', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Course plan' })).toBeVisible();
});
