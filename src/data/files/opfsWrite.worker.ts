/**
 * Writes a Blob into OPFS with a synchronous access handle. Used on browsers that support
 * OPFS but not `createWritable()` (older Safari). The data is streamed in chunks so a large
 * ebook never sits in memory twice. It is written to "<name>.partial" first, then copied
 * into place, so a crash mid-write never corrupts an existing file.
 */
interface WriteRequest {
  dir: string;
  name: string;
  data: Blob;
}

type SyncHandle = {
  write(buffer: BufferSource, options: { at: number }): number;
  read(buffer: BufferSource, options: { at: number }): number;
  truncate(size: number): void;
  getSize(): number;
  flush(): void;
  close(): void;
};
type FileHandleWithSync = FileSystemFileHandle & { createSyncAccessHandle(): Promise<SyncHandle> };

const COPY_CHUNK = 1024 * 1024;

async function writeStream(handle: SyncHandle, data: Blob) {
  handle.truncate(0);
  let at = 0;
  const reader = data.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    at += handle.write(value, { at });
  }
  handle.flush();
}

self.onmessage = async (e: MessageEvent<WriteRequest>) => {
  const { dir: dirName, name, data } = e.data;
  const partialName = `${name}.partial`;
  let partial: SyncHandle | null = null;
  let target: SyncHandle | null = null;
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(dirName, { create: true });

    const partialFile = (await dir.getFileHandle(partialName, {
      create: true,
    })) as FileHandleWithSync;
    partial = await partialFile.createSyncAccessHandle();
    await writeStream(partial, data);

    // Copy the finished partial into the real file, then remove the partial.
    const targetFile = (await dir.getFileHandle(name, { create: true })) as FileHandleWithSync;
    target = await targetFile.createSyncAccessHandle();
    target.truncate(0);
    const size = partial.getSize();
    const buf = new Uint8Array(Math.min(COPY_CHUNK, Math.max(size, 1)));
    for (let at = 0; at < size;) {
      const n = partial.read(buf, { at });
      target.write(buf.subarray(0, n), { at });
      at += n;
    }
    target.flush();
    target.close();
    target = null;
    partial.close();
    partial = null;
    await dir.removeEntry(partialName);
    self.postMessage({ ok: true });
  } catch (err) {
    target?.close();
    partial?.close();
    const error = err as { message?: string; name?: string };
    self.postMessage({ ok: false, error: error.message ?? String(err), errorName: error.name });
  }
};
