import { sha256OfBlob, type HashMessage } from './hashing';

/** Hashes one file off the main thread. Receives a File/Blob, replies with HashMessages. */
self.onmessage = async (e: MessageEvent<Blob>) => {
  const post = (msg: HashMessage) => self.postMessage(msg);
  try {
    const hash = await sha256OfBlob(e.data, (done) => post({ type: 'progress', done }));
    post({ type: 'done', hash });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
