import { BackupError } from './format';

/**
 * Passphrase encryption for backup files (AES-256-GCM, key from PBKDF2-SHA256).
 *
 * File layout:
 *   "JSMNENC1"                      8-byte magic
 *   u32 (little-endian) n            header length
 *   n bytes                          header JSON: { v, iterations, salt, nonce, chunkSize }
 *   repeated: u32 len + len bytes    encrypted chunks (ciphertext + 16-byte tag)
 *
 * Each chunk of up to `chunkSize` plaintext bytes is encrypted on its own, so big backups
 * never sit in memory twice. Chunk i uses IV = 8-byte random prefix + u32 i, and its
 * additional data is the header plus a "last chunk" flag, so chunks can't be reordered,
 * dropped or cut off at the end without decryption failing.
 */

const MAGIC = new TextEncoder().encode('JSMNENC1');
export const DEFAULT_ITERATIONS = 600_000;
export const CHUNK_SIZE = 1024 * 1024;

interface Header {
  v: 1;
  iterations: number;
  salt: string;
  nonce: string;
  chunkSize: number;
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const u32 = (n: number) => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, true);
  return out;
};
const readU32 = (bytes: Uint8Array, at = 0) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(at, true);

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

const ivFor = (nonce: Uint8Array, index: number) => concat(nonce, u32(index));
const aadFor = (headerBytes: Uint8Array, last: boolean) =>
  concat(headerBytes, new Uint8Array([last ? 1 : 0]));

/** Starts with the encryption magic? */
export async function isEncrypted(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, MAGIC.length).arrayBuffer());
  return head.length === MAGIC.length && head.every((b, i) => b === MAGIC[i]);
}

/**
 * Wraps a byte sink with encryption. Write plaintext with `write`, then call `finish`.
 * Output goes to `out` as encrypted bytes, in order.
 */
export async function createEncryptor(
  passphrase: string,
  out: (chunk: Uint8Array) => void | Promise<void>,
  iterations = DEFAULT_ITERATIONS,
) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(8));
  const header: Header = {
    v: 1,
    iterations,
    salt: b64(salt),
    nonce: b64(nonce),
    chunkSize: CHUNK_SIZE,
  };
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const key = await deriveKey(passphrase, salt, iterations);
  await out(concat(MAGIC, u32(headerBytes.length), headerBytes));

  let buffer = new Uint8Array(0);
  let index = 0;
  // One full chunk is held back, so the final one can be flagged as last.
  let pending: Uint8Array | null = null;

  const seal = async (plain: Uint8Array, last: boolean) => {
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: ivFor(nonce, index++) as BufferSource,
          additionalData: aadFor(headerBytes, last) as BufferSource,
        },
        key,
        plain as BufferSource,
      ),
    );
    await out(concat(u32(sealed.length), sealed));
  };

  return {
    async write(data: Uint8Array) {
      buffer = buffer.length ? concat(buffer, data) : data.slice();
      while (buffer.length >= CHUNK_SIZE) {
        if (pending) await seal(pending, false);
        pending = buffer.slice(0, CHUNK_SIZE);
        buffer = buffer.slice(CHUNK_SIZE);
      }
    },
    async finish() {
      if (pending && buffer.length) {
        await seal(pending, false);
        await seal(buffer, true);
      } else if (pending) {
        await seal(pending, true);
      } else {
        await seal(buffer, true);
      }
    },
  };
}

/** Decrypts a backup file chunk by chunk. Wrong passphrase or damage throws a BackupError. */
export async function* decryptChunks(file: Blob, passphrase: string): AsyncGenerator<Uint8Array> {
  if (!(await isEncrypted(file)))
    throw new BackupError('This backup is not encrypted.', 'not-a-backup');
  const read = async (from: number, length: number) =>
    new Uint8Array(await file.slice(from, from + length).arrayBuffer());

  let at = MAGIC.length;
  const headerLength = readU32(await read(at, 4));
  at += 4;
  if (headerLength > 4096) throw new BackupError('This backup file is damaged.', 'damaged');
  const headerBytes = await read(at, headerLength);
  at += headerLength;
  let header: Header;
  try {
    header = JSON.parse(new TextDecoder().decode(headerBytes)) as Header;
  } catch {
    throw new BackupError('This backup file is damaged.', 'damaged');
  }
  if (header.v !== 1 || header.iterations < 1000 || header.iterations > 10_000_000) {
    throw new BackupError('This backup file is damaged.', 'damaged');
  }
  const key = await deriveKey(passphrase, unb64(header.salt), header.iterations);
  const nonce = unb64(header.nonce);

  let index = 0;
  while (at < file.size) {
    const length = readU32(await read(at, 4));
    at += 4;
    if (length < 16 || length > header.chunkSize + 16 || at + length > file.size) {
      throw new BackupError('This backup file is damaged or incomplete.', 'damaged');
    }
    const sealed = await read(at, length);
    at += length;
    const last = at >= file.size;
    try {
      yield new Uint8Array(
        await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: ivFor(nonce, index) as BufferSource,
            additionalData: aadFor(headerBytes, last) as BufferSource,
          },
          key,
          sealed as BufferSource,
        ),
      );
    } catch {
      throw index === 0
        ? new BackupError('Wrong passphrase.', 'wrong-passphrase')
        : new BackupError('This backup file is damaged or incomplete.', 'damaged');
    }
    index++;
  }
  if (index === 0) throw new BackupError('This backup file is damaged or incomplete.', 'damaged');
}
