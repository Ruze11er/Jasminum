import { expect, test, type Page } from './fixtures';

/** Every table (as stored) and the SHA-256 of every stored file, read straight from the browser. */
async function deviceState(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('jasminum');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tables: Record<string, unknown[]> = {};
    for (const name of Array.from(db.objectStoreNames)) {
      if (name === 'fileBlobs') continue;
      tables[name] = await new Promise((resolve, reject) => {
        const req = db.transaction(name).objectStore(name).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    db.close();
    const files: Record<string, string> = {};
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('files', { create: true });
    for await (const [name, handle] of dir as unknown as AsyncIterable<
      [string, FileSystemFileHandle]
    >) {
      if (!name.startsWith('sha256-')) continue; // snapshots aren't user files
      const digest = await crypto.subtle.digest(
        'SHA-256',
        await (await handle.getFile()).arrayBuffer(),
      );
      files[name] = [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return { tables, files };
  });
}

/** A tiny one-page PDF. */
function makePdf(): Buffer {
  const stream = 'BT /F1 24 Tf 40 100 Td (Backed up) Tj ET';
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
  'export → wipe → restore gives identical data and files',
  { tag: '@files' },
  async ({ page }, testInfo) => {
    test.slow();

    // Some of everything: a tagged task, an event, a note and a PDF.
    await page.goto('/tasks');
    await page.getByLabel('Add a task').fill('Revise chapter 2 #biology');
    await page.getByLabel('Add a task').press('Enter');
    await expect(page.getByRole('button', { name: 'Edit task: Revise chapter 2' })).toBeVisible();

    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Add event on Today' }).click();
    const eventForm = page.getByRole('dialog', { name: 'New event' });
    await eventForm.getByLabel('Title').fill('Biology exam');
    await eventForm.getByText('All day').click();
    await eventForm.getByRole('button', { name: 'Add event' }).click();
    await expect(eventForm).toBeHidden();

    await page.goto('/notes/new');
    await page.getByLabel('Title').fill('Exam plan');
    await page.getByLabel('Title').press('Enter');
    await page.keyboard.type('Start with photosynthesis.');
    await expect(page.getByText(/^Edited/)).toBeVisible();

    await page.goto('/library');
    await page.getByLabel('Add files').first().setInputFiles({
      name: 'Lecture.pdf',
      mimeType: 'application/pdf',
      buffer: makePdf(),
    });
    await expect(page.getByRole('link', { name: /Lecture/ })).toBeVisible();

    // Back up, protected with a passphrase. (Loading a page logs "app opened", so the state
    // is recorded here, right before the backup.)
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'Back up now' })).toBeVisible();
    const before = await deviceState(page);
    expect(before.tables.tasks).toHaveLength(1);
    expect(Object.keys(before.files)).toHaveLength(1);
    await page.getByRole('button', { name: 'Back up now' }).click();
    const backupDialog = page.getByRole('dialog', { name: 'Back up your data' });
    await backupDialog.getByText('Protect with a passphrase').click();
    await backupDialog.getByLabel('Passphrase', { exact: true }).fill('pink jasmine');
    await backupDialog.getByLabel('Type it again').fill('pink jasmine');
    await backupDialog.getByRole('button', { name: 'Create backup' }).click();
    await expect(backupDialog.getByText(/Backup ready/)).toBeVisible({ timeout: 30_000 });
    const downloading = page.waitForEvent('download');
    await backupDialog.getByRole('button', { name: 'Download backup' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^jasminum-backup-\d{4}-\d{2}-\d{2}\.jasminum$/);
    const backupPath = testInfo.outputPath('backup.jasminum');
    await download.saveAs(backupPath);

    // Wipe this device: the database and every stored file.
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('jasminum');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      const root = await navigator.storage.getDirectory();
      for await (const [name] of root as unknown as AsyncIterable<[string, unknown]>) {
        await root.removeEntry(name, { recursive: true });
      }
    });
    await page.goto('/tasks');
    await page.getByRole('radio', { name: /^All/ }).click();
    await expect(page.getByRole('button', { name: /^Edit task:/ })).toHaveCount(0);

    // Restore it.
    await page.goto('/settings');
    await page.getByLabel('Restore from file').setInputFiles(backupPath);
    const restoreDialog = page.getByRole('dialog', { name: 'Restore from backup' });
    await restoreDialog.getByLabel('Passphrase').fill('pink jasmine');
    await restoreDialog.getByRole('button', { name: 'Unlock' }).click();
    await expect(restoreDialog.getByText(/1 task · 1 event · 1 note · 1 file/)).toBeVisible({
      timeout: 30_000,
    });
    await restoreDialog.getByText('Replace everything', { exact: true }).click();
    await restoreDialog.getByRole('button', { name: 'Replace everything' }).click();
    await expect(page.getByText('Backup restored')).toBeVisible();

    // Identical data and files.
    const after = await deviceState(page);
    expect(after).toEqual(before);

    // And it all works: the PDF previews and the note is searchable.
    await page.goto('/library');
    await page.getByRole('link', { name: /Lecture/ }).click();
    await expect(page.getByText('Page 1 of 1')).toBeVisible();
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Search everything' }).fill('photosynthesis');
    await page.getByRole('option', { name: /Exam plan/ }).click();
    await expect(page.getByLabel('Title')).toHaveValue('Exam plan');
  },
);

test('notes export as Markdown and tasks as CSV', async ({ page }) => {
  await page.goto('/tasks');
  await page.getByLabel('Add a task').fill('Pay rent');
  await page.getByLabel('Add a task').press('Enter');
  await expect(page.getByRole('button', { name: 'Edit task: Pay rent' })).toBeVisible();

  await page.goto('/settings');
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tasks (CSV)' }).click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toBe('jasminum-tasks.csv');
  const text = await (await csv.createReadStream()).toArray();
  expect(Buffer.concat(text).toString('utf8')).toContain('Pay rent,To do');

  const mdDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Notes (Markdown)' }).click();
  expect((await mdDownload).suggestedFilename()).toBe('jasminum-notes.zip');
});
