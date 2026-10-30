import { clock } from './clock';

const hex = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/**
 * UUIDv7: 48-bit millisecond timestamp + random bits. IDs sort roughly by creation time
 * and never collide across devices, which keeps the door open for sync later.
 */
export function uuidv7(now: number = clock.now()): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[0] = Math.floor(now / 2 ** 40) & 0xff;
  b[1] = Math.floor(now / 2 ** 32) & 0xff;
  b[2] = Math.floor(now / 2 ** 24) & 0xff;
  b[3] = Math.floor(now / 2 ** 16) & 0xff;
  b[4] = Math.floor(now / 2 ** 8) & 0xff;
  b[5] = now & 0xff;
  b[6] = (b[6]! & 0x0f) | 0x70; // version 7
  b[8] = (b[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const h = Array.from(b, (x) => hex[x]).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
