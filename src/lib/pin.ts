/**
 * PIN hashing for the app lock. Only a salted PBKDF2-SHA256 hash is stored, never the
 * PIN. It's a privacy screen, not encryption: the data itself isn't locked.
 */

export const PIN_ITERATIONS = 210_000;
export const PIN_PATTERN = /^\d{4,8}$/;

export interface PinRecord {
  salt: string;
  hash: string;
  iterations: number;
}

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPin(pin: string, iterations = PIN_ITERATIONS): Promise<PinRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toB64(salt), hash: toB64(await derive(pin, salt, iterations)), iterations };
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  const actual = await derive(pin, fromB64(record.salt), record.iterations);
  const expected = fromB64(record.hash);
  if (actual.length !== expected.length) return false;
  // Compare every byte so timing doesn't hint at how much matched.
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

/**
 * Wait after repeated wrong PINs: none for the first 5, then 30 s, doubling, capped at
 * 15 minutes.
 */
export function lockoutMs(failedAttempts: number): number {
  if (failedAttempts < 5) return 0;
  return Math.min(15 * 60_000, 30_000 * 2 ** (failedAttempts - 5));
}
