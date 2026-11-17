import type { StringStorage } from './json-storage';

/** A private file store. `create` must allocate a new immutable file exclusively. */
export type StorageFiles = {
  create(value: string): Promise<string>;
  read(name: string): Promise<string>;
  remove(name: string): Promise<void>;
};

export const FILE_POINTER_PREFIX = '!liora-file:v1:';
const RESERVED_PREFIX = '!liora-file:';
const INLINE_BYTES = 64 * 1024;
export const isStorageFileName = (name: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/.test(name);

function reference(raw: string | null): string | null {
  if (raw === null || !raw.startsWith(RESERVED_PREFIX)) return null;
  const name = raw.startsWith(FILE_POINTER_PREFIX) ? raw.slice(FILE_POINTER_PREFIX.length) : '';
  if (!isStorageFileName(name)) throw new Error('INVALID_STORAGE_FILE_REFERENCE');
  return name;
}

/** Count only up to the inline bound, without allocating a second large buffer. */
function fitsInline(value: string, limit: number): boolean {
  if (value.length > limit || value.startsWith(RESERVED_PREFIX)) return false;
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length
      && value.charCodeAt(i + 1) >= 0xdc00 && value.charCodeAt(i + 1) <= 0xdfff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
    if (bytes > limit) return false;
  }
  return true;
}

/**
 * Large opaque values live in immutable files; the key-value database holds a
 * small pointer. Callers still encrypt sensitive content before passing it here.
 * Old inline values remain readable and migrate on their next write.
 */
export function createFileBackedStorage(metadata: StringStorage, files: StorageFiles, inlineBytes = INLINE_BYTES): StringStorage {
  if (!Number.isSafeInteger(inlineBytes) || inlineBytes < 1) throw new Error('INVALID_STORAGE_INLINE_LIMIT');
  const queues = new Map<string, Promise<void>>();
  const serial = <T>(key: string, action: () => Promise<T>): Promise<T> => {
    const work = (queues.get(key) ?? Promise.resolve()).then(action);
    const tail = work.then(() => {}, () => {});
    queues.set(key, tail);
    void tail.then(() => { if (queues.get(key) === tail) queues.delete(key); });
    return work;
  };
  const discard = async (name: string | null) => {
    if (name) await files.remove(name).catch(() => {});
  };

  /** Never delete a possibly committed file when a storage acknowledgement is lost. */
  const commit = async (key: string, next: string | null, action: () => Promise<void>): Promise<void> => {
    try { await action(); }
    catch (error) {
      let observed: string | null | undefined;
      try { observed = await metadata.getItem(key); } catch { /* Commit outcome remains unknown. */ }
      if (observed === next) return;
      if (next !== null && observed !== undefined) await discard(reference(next));
      throw error;
    }
  };

  return {
    getItem: (key) => serial(key, async () => {
      let raw = await metadata.getItem(key);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const name = reference(raw);
        if (name === null) return raw;
        try { return await files.read(name); }
        catch (error) {
          // Another instance can replace/delete the file after this read saw its
          // pointer. Retry the current pointer, but preserve genuine read errors.
          const current = await metadata.getItem(key);
          if (current === raw) throw error;
          raw = current;
        }
      }
      throw new Error('STORAGE_FILE_READ_INTERRUPTED');
    }),
    setItem: (key, value) => serial(key, async () => {
      const old = await metadata.getItem(key);
      const oldName = reference(old);
      let next = value;
      if (!fitsInline(value, inlineBytes)) {
        const name = await files.create(value);
        if (!isStorageFileName(name)) throw new Error('INVALID_STORAGE_FILE_REFERENCE');
        next = `${FILE_POINTER_PREFIX}${name}`;
      }
      await commit(key, next, () => metadata.setItem(key, next));
      if (old !== next) await discard(oldName);
    }),
    removeItem: (key) => serial(key, async () => {
      let name: string | null = null;
      // An explicit deletion must also recover an unreadable pointer. Never
      // follow a malformed name; at worst an unreachable file remains behind.
      try { name = reference(await metadata.getItem(key)); } catch { /* Delete the key only. */ }
      await commit(key, null, () => metadata.removeItem(key));
      await discard(name);
    }),
  };
}
