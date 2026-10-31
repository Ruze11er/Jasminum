import { describe, expect, it } from 'vitest';
import { uuidv7, UUID_RE } from './ids';
import { formatBytes, formatRelative } from './format';
import { clock } from './clock';
import { isIsoDateTime, localDateTimeToIso, splitIso, toOffsetIso } from './dates';

describe('uuidv7', () => {
  it('produces valid, unique v7 ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7()));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id).toMatch(UUID_RE);
  });

  it('sorts by creation time', () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    const c = uuidv7(1_800_000_000_000);
    expect([c, a, b].sort()).toEqual([a, b, c]);
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1536, '1.5 KB'],
    [5 * 1024 ** 2, '5.0 MB'],
    [250 * 1024 ** 3, '250 GB'],
  ])('%i → %s', (n, out) => expect(formatBytes(n)).toBe(out));
});

describe('formatRelative', () => {
  const now = 1_700_000_000_000;
  it('describes past and future times', () => {
    expect(formatRelative(now - 10_000, now)).toBe('just now');
    expect(formatRelative(now - 3 * 86_400_000, now)).toMatch(/3 days ago/);
    expect(formatRelative(now + 27 * 86_400_000, now)).toMatch(/in 4 weeks/);
  });
});

describe('clock', () => {
  it('can be frozen and reset', () => {
    clock.set(42);
    expect(clock.now()).toBe(42);
    clock.reset();
    expect(clock.now()).toBeGreaterThan(42);
  });
});

describe('timed values', () => {
  it('round-trips a local date and time through an ISO string with offset', () => {
    const iso = localDateTimeToIso('2026-11-02', '14:30');
    expect(iso).toMatch(/^2026-11-02T14:30:00[+-]\d{2}:\d{2}$/);
    expect(isIsoDateTime(iso)).toBe(true);
    expect(splitIso(iso)).toEqual({ date: '2026-11-02', time: '14:30' });
    expect(Date.parse(toOffsetIso(new Date(Date.parse(iso))))).toBe(Date.parse(iso));
  });

  it('rejects malformed values', () => {
    for (const bad of ['2026-11-02', '2026-11-02T14:30', '2026-13-02T14:30:00Z', 'soon']) {
      expect(isIsoDateTime(bad)).toBe(false);
    }
    expect(isIsoDateTime('2026-11-02T14:30:00Z')).toBe(true);
  });
});

describe('file kinds', () => {
  it('sorts files by extension, then MIME type', async () => {
    const { kindOf, extensionOf, baseName, previewTypeOf } = await import('./fileKinds');
    expect(kindOf('Lecture.PDF', '')).toBe('pdf');
    expect(kindOf('essay.docx', '')).toBe('word');
    expect(kindOf('deck.pptx', '')).toBe('slides');
    expect(kindOf('novel.epub', '')).toBe('ebook');
    expect(kindOf('budget.csv', 'text/csv')).toBe('sheet');
    expect(kindOf('scan', 'image/jpeg')).toBe('image');
    expect(kindOf('mystery', 'application/octet-stream')).toBe('other');
    expect(extensionOf('archive.tar.GZ')).toBe('gz');
    expect(extensionOf('.hidden')).toBe('');
    expect(extensionOf('trailing.')).toBe('');
    expect(baseName('Lecture 3.pdf')).toBe('Lecture 3');
    expect(baseName('.env')).toBe('.env');
    expect(previewTypeOf('image', 'heic')).toBe('none');
    expect(previewTypeOf('image', 'png')).toBe('image');
    expect(previewTypeOf('sheet', 'csv')).toBe('text');
    expect(previewTypeOf('word', 'docx')).toBe('none');
  });
});
