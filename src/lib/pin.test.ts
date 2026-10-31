// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hashPin, lockoutMs, PIN_PATTERN, verifyPin } from './pin';

describe('PIN', () => {
  it('stores only a salted hash and verifies the right PIN', async () => {
    const record = await hashPin('2580', 20_000);
    expect(JSON.stringify(record)).not.toContain('2580');
    expect(record.iterations).toBe(20_000);
    expect(await verifyPin('2580', record)).toBe(true);
    expect(await verifyPin('2581', record)).toBe(false);
    expect(await verifyPin('', record)).toBe(false);
  });

  it('uses a fresh salt every time', async () => {
    const a = await hashPin('1234', 20_000);
    const b = await hashPin('1234', 20_000);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('accepts 4 to 8 digits', () => {
    for (const ok of ['1234', '12345678']) expect(PIN_PATTERN.test(ok)).toBe(true);
    for (const bad of ['123', '123456789', '12a4', '']) expect(PIN_PATTERN.test(bad)).toBe(false);
  });

  it('makes you wait longer after repeated wrong PINs', () => {
    expect([1, 4].map(lockoutMs)).toEqual([0, 0]);
    expect(lockoutMs(5)).toBe(30_000);
    expect(lockoutMs(6)).toBe(60_000);
    expect(lockoutMs(20)).toBe(15 * 60_000);
  });
});
