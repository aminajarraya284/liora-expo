import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { isStorageFileName, type StorageFiles } from './file-backed-storage';

/** Created lazily: the web preview never instantiates or calls this backend. */
export function createStorageFiles(): StorageFiles {
  const directory = () => new Directory(Paths.document, 'liora-storage-v1');
  const fileFor = (name: string) => {
    if (!isStorageFileName(name)) throw new Error('INVALID_STORAGE_FILE_REFERENCE');
    return new File(directory(), name);
  };
  return {
    async create(value) {
      const dir = directory();
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      const name = `${randomUUID()}.json`;
      const file = fileFor(name);
      // Exclusive creation means a collision can never overwrite a live file.
      file.create({ overwrite: false });
      try { await file.write(value); }
      catch (error) {
        try { if (file.exists) await file.delete(); } catch { /* Preserve the original write failure. */ }
        throw error;
      }
      return name;
    },
    async read(name) {
      const file = fileFor(name);
      if (!file.exists) throw new Error('STORAGE_FILE_MISSING');
      return file.text();
    },
    async remove(name) {
      const file = fileFor(name);
      if (file.exists) await file.delete();
    },
  };
}
