import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { BackupError } from '@/data/backup/format';
import { tasksRepo } from '@/data/repos/tasks';
import { clock } from '@/lib/clock';

/*
 * jsdom Blobs can't be streamed, so the zip/crypto modules are stubbed here and these
 * tests check the dialogs' behavior. Real backups and restores are tested in
 * src/data/backup/backup.test.ts (Node) and e2e/backup.spec.ts (browser).
 */
const backup = vi.hoisted(() => ({
  createBackupBlob: vi.fn(),
  writeBackup: vi.fn(),
  readBackup: vi.fn(),
  applyBackup: vi.fn(),
  discardStaged: vi.fn(),
}));
vi.mock('@/data/backup/exportBackup', () => ({
  createBackupBlob: backup.createBackupBlob,
  writeBackup: backup.writeBackup,
}));
vi.mock('@/data/backup/restore', () => ({
  readBackup: backup.readBackup,
  applyBackup: backup.applyBackup,
  discardStaged: backup.discardStaged,
}));

const summary = {
  counts: { tasks: 3, notes: 1, documents: 2 },
  files: 2,
  missingFiles: 0,
  bytes: 2048,
};
const staged = {
  manifest: {
    createdAt: new Date('2026-10-30T09:00:00').getTime(),
    counts: { tasks: 3, notes: 1 },
  },
  tables: {},
  filesStored: new Set(),
  filesMissing: [],
};

beforeEach(() => {
  clock.set(new Date('2026-11-04T10:00:00').getTime());
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
  backup.createBackupBlob.mockResolvedValue({ blob: new Blob(['zip']), summary });
  backup.applyBackup.mockResolvedValue({
    counts: {},
    filesMissing: 0,
    snapshotKey: 'snapshot-1.json',
  });
});
afterEach(() => vi.clearAllMocks());

function renderSettings() {
  const router = createMemoryRouter(routes, { initialEntries: ['/settings'] });
  render(<RouterProvider router={router} />);
}

describe('backup & data', () => {
  it('makes a passphrase-protected backup and downloads it', async () => {
    const user = userEvent.setup();
    renderSettings();
    expect(await screen.findByText(/No backup yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back up now' }));
    const dialog = await screen.findByRole('dialog', { name: 'Back up your data' });

    await user.click(await within(dialog).findByLabelText('Protect with a passphrase'));
    await user.type(within(dialog).getByLabelText('Passphrase'), 'short');
    await user.click(within(dialog).getByRole('button', { name: 'Create backup' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('at least 8 characters');

    await user.clear(within(dialog).getByLabelText('Passphrase'));
    await user.type(within(dialog).getByLabelText('Passphrase'), 'pink jasmine');
    await user.type(within(dialog).getByLabelText('Type it again'), 'pink jasmin');
    await user.click(within(dialog).getByRole('button', { name: 'Create backup' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent("don't match");

    await user.type(within(dialog).getByLabelText('Type it again'), 'e');
    await user.click(within(dialog).getByRole('button', { name: 'Create backup' }));
    expect(await within(dialog).findByText(/Backup ready/)).toBeInTheDocument();
    expect(within(dialog).getByText('3 tasks, 1 note, 2 files')).toBeInTheDocument();
    expect(backup.createBackupBlob).toHaveBeenCalledWith(
      expect.objectContaining({ passphrase: 'pink jasmine' }),
    );

    await user.click(within(dialog).getByRole('button', { name: 'Download backup' }));
    expect(await screen.findByText('Backup downloaded')).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('restores a protected backup after asking for its passphrase', async () => {
    const user = userEvent.setup();
    backup.readBackup
      .mockRejectedValueOnce(new BackupError('Protected', 'needs-passphrase'))
      .mockRejectedValueOnce(new BackupError('Wrong passphrase.', 'wrong-passphrase'))
      .mockResolvedValueOnce(staged);
    renderSettings();
    await user.upload(
      await screen.findByLabelText('Restore from file'),
      new File(['x'], 'jasminum-backup-2026-10-30.jasminum'),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Restore from backup' });

    await user.type(await within(dialog).findByLabelText('Passphrase'), 'guess');
    await user.click(within(dialog).getByRole('button', { name: 'Unlock' }));
    expect(await within(dialog).findByText('Wrong passphrase. Try again.')).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('Passphrase'));
    await user.type(within(dialog).getByLabelText('Passphrase'), 'pink jasmine');
    await user.click(within(dialog).getByRole('button', { name: 'Unlock' }));
    expect(await within(dialog).findByText('3 tasks · 1 note')).toBeInTheDocument();
    expect(backup.readBackup).toHaveBeenLastCalledWith(expect.any(File), 'pink jasmine');

    await user.click(within(dialog).getByLabelText(/Replace everything/));
    await user.click(within(dialog).getByRole('button', { name: 'Replace everything' }));
    expect(await screen.findByText('Backup restored')).toBeInTheDocument();
    expect(backup.applyBackup).toHaveBeenCalledWith(staged, 'replace');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('explains when a file is not a backup and changes nothing', async () => {
    const user = userEvent.setup();
    backup.readBackup.mockRejectedValueOnce(
      new BackupError('This file is not a Jasminum backup, or it is damaged.', 'not-a-backup'),
    );
    renderSettings();
    await user.upload(
      await screen.findByLabelText('Restore from file'),
      new File(['x'], 'photo.jpg'),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Restore from backup' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('not a Jasminum backup');
    expect(within(dialog).getByText('Nothing on this device was changed.')).toBeInTheDocument();
    expect(backup.applyBackup).not.toHaveBeenCalled();
  });

  it('exports tasks as CSV', async () => {
    const user = userEvent.setup();
    await tasksRepo.create({ title: 'Pay rent' });
    renderSettings();
    await user.click(await screen.findByRole('button', { name: 'Tasks (CSV)' }));
    expect(await screen.findByText('1 task exported')).toBeInTheDocument();
  });

  it('checks for problems', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(await screen.findByRole('button', { name: 'Check now' }));
    const dialog = await screen.findByRole('dialog', { name: 'Check for problems' });
    expect(await within(dialog).findByText('Everything looks good.')).toBeInTheDocument();
  });

  it('shows when the last backup was made', async () => {
    const { setSetting } = await import('@/data/repos/settings');
    await setSetting('lastBackupAt', clock.now() - 3 * 86_400_000);
    renderSettings();
    await waitFor(() => expect(screen.getByText('Last backup 3 days ago.')).toBeInTheDocument());
  });
});
