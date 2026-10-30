import { describe, expect, it } from 'vitest';
import { ValidationError } from '@/lib/validation';
import { db } from '../db';
import { getSetting, setSetting } from './settings';

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await getSetting('profile')).toEqual({ displayName: '' });
    expect(await getSetting('lastBackupAt')).toBeNull();
  });

  it('validates, normalizes and persists values', async () => {
    await setSetting('profile', { displayName: '  Jas  ' });
    expect(await getSetting('profile')).toEqual({ displayName: 'Jas' });
    await expect(setSetting('profile', { displayName: 'x'.repeat(41) })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(await getSetting('profile')).toEqual({ displayName: 'Jas' });
  });

  it('falls back to the default if a stored value is invalid', async () => {
    await db.settings.put({ key: 'profile', value: { displayName: 42 }, updatedAt: 0 });
    expect(await getSetting('profile')).toEqual({ displayName: '' });
  });
});
