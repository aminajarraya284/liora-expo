import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { mkdtemp, readFile, readdir, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileBackedStorage, FILE_POINTER_PREFIX, type StorageFiles } from '../src/utils/file-backed-storage';
import type { StringStorage } from '../src/utils/json-storage';

const large = (mark = 'ciphertext') => JSON.stringify({ v: 2, enc: `${mark}:${'A'.repeat(3 * 1024 * 1024)}` });
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

function fixture() {
  const metadata = new Map<string, string>();
  const contents = new Map<string, string>();
  let counter = 0;
  let createFailure = false;
  let commitFailure: 'before' | 'after' | null = null;
  let deleteFailure: 'before' | 'after' | null = null;
  let cleanupFailure = false;
  let reads = 0;
  const backend: StringStorage = {
    async getItem(key) { return metadata.get(key) ?? null; },
    async setItem(key, value) {
      // Model a bounded key-value database; the 3 MiB value must never reach it.
      if (value.length > 128 * 1024) throw new Error('row too large');
      if (commitFailure === 'before') throw new Error('commit failed');
      metadata.set(key, value);
      if (commitFailure === 'after') throw new Error('acknowledgement lost');
    },
    async removeItem(key) {
      if (deleteFailure === 'before') throw new Error('delete failed');
      metadata.delete(key);
      if (deleteFailure === 'after') throw new Error('acknowledgement lost');
    },
  };
  const files: StorageFiles = {
    async create(value) {
      if (createFailure) throw new Error('disk full');
      counter += 1;
      const name = `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}.json`;
      assert.equal(contents.has(name), false);
      contents.set(name, value);
      return name;
    },
    async read(name) {
      reads += 1;
      const content = contents.get(name);
      if (content === undefined) throw new Error('file missing');
      return content;
    },
    async remove(name) {
      if (cleanupFailure) throw new Error('cleanup failed');
      contents.delete(name);
    },
  };
  return {
    metadata, contents, backend, files,
    get reads() { return reads; },
    set createFailure(value: boolean) { createFailure = value; },
    set commitFailure(value: 'before' | 'after' | null) { commitFailure = value; },
    set deleteFailure(value: 'before' | 'after' | null) { deleteFailure = value; },
    set cleanupFailure(value: boolean) { cleanupFailure = value; },
    storage: () => createFileBackedStorage(backend, files),
  };
}

describe('fichiers privés pour les grandes sauvegardes', () => {
  test('le backend relit aussi une sauvegarde de 3 Mio depuis de vrais fichiers après recréation', async () => {
    const f = fixture();
    const directory = await mkdtemp(join(tmpdir(), 'liora-storage-test-'));
    const name = '00000000-0000-4000-8000-000000000001.json';
    const disk: StorageFiles = {
      create: async (value) => { await writeFile(join(directory, name), value, { encoding: 'utf8', flag: 'wx' }); return name; },
      read: (file) => readFile(join(directory, file), 'utf8'),
      remove: async (file) => { await unlink(join(directory, file)); },
    };
    try {
      const value = large();
      await createFileBackedStorage(f.backend, disk).setItem('data', value);
      assert.equal((await readdir(directory)).length, 1);
      assert.equal(await createFileBackedStorage(f.backend, disk).getItem('data'), value);
      await createFileBackedStorage(f.backend, disk).removeItem('data');
      assert.equal((await readdir(directory)).length, 0);
    } finally {
      // Only files created by this fixture are removed; no recursive deletion.
      for (const file of await readdir(directory)) await unlink(join(directory, file));
      await rmdir(directory);
    }
  });

  test('plus de 3 Mio restent hors de la base et sont relus après redémarrage du backend', async () => {
    const f = fixture();
    const value = large();
    const key = 'liora:data:person@example.fr';
    await f.storage().setItem(key, value);
    const raw = f.metadata.get(key)!;
    assert.ok(raw.startsWith(FILE_POINTER_PREFIX));
    assert.ok(raw.length < 100);
    assert.equal(raw.includes('person'), false);
    assert.equal([...f.contents.values()][0], value);
    assert.equal(await f.storage().getItem(key), value);
  });

  test('les anciennes valeurs inline restent lisibles puis migrent et les petites préférences restent inline', async () => {
    const f = fixture();
    f.metadata.set('data', '{"old":true}');
    const storage = f.storage();
    assert.equal(await storage.getItem('data'), '{"old":true}');
    await storage.setItem('data', large());
    assert.equal(f.contents.size, 1);
    await storage.setItem('data', '{"new":true}');
    assert.equal(f.metadata.get('data'), '{"new":true}');
    assert.equal(f.contents.size, 0);
    assert.equal(await storage.getItem('absent'), null);
  });

  test('le seuil est calculé en UTF-8 et une valeur ressemblant à un pointeur est échappée', async () => {
    const f = fixture();
    const storage = createFileBackedStorage(f.backend, f.files, 64);
    const nonAscii = '😀'.repeat(20);
    await storage.setItem('unicode', nonAscii);
    assert.ok(f.metadata.get('unicode')!.startsWith(FILE_POINTER_PREFIX));
    assert.equal(await storage.getItem('unicode'), nonAscii);
    const literal = `${FILE_POINTER_PREFIX}00000000-0000-4000-8000-000000000001.json`;
    await storage.setItem('literal', literal);
    assert.notEqual(f.metadata.get('literal'), literal);
    assert.equal(await storage.getItem('literal'), literal);
  });

  test('une panne d’écriture du nouveau fichier conserve l’ancienne sauvegarde', async () => {
    const f = fixture();
    const storage = f.storage();
    const previous = large('previous');
    await storage.setItem('data', previous);
    const pointer = f.metadata.get('data');
    f.createFailure = true;
    await assert.rejects(storage.setItem('data', large('new')), /disk full/);
    assert.equal(f.metadata.get('data'), pointer);
    assert.equal(await storage.getItem('data'), previous);
    assert.equal(f.contents.size, 1);
  });

  test('un échec de commit supprime le nouveau fichier et garde l’ancien état', async () => {
    const f = fixture();
    const storage = f.storage();
    const previous = large('previous');
    await storage.setItem('data', previous);
    const pointer = f.metadata.get('data');
    f.commitFailure = 'before';
    await assert.rejects(storage.setItem('data', large('new')), /commit failed/);
    assert.equal(f.metadata.get('data'), pointer);
    assert.equal(await storage.getItem('data'), previous);
    assert.equal(f.contents.size, 1);
  });

  test('une réponse de commit perdue ne supprime jamais le fichier réellement engagé', async () => {
    const f = fixture();
    const storage = f.storage();
    await storage.setItem('data', large('old'));
    f.commitFailure = 'after';
    const next = large('new');
    await storage.setItem('data', next);
    assert.equal(await storage.getItem('data'), next);
    assert.equal(f.contents.size, 1);
  });

  test('une issue de commit inconnue garde les deux fichiers plutôt que supprimer la copie engagée', async () => {
    const f = fixture();
    await f.storage().setItem('data', large('old'));
    let reads = 0;
    const backend = {
      ...f.backend,
      getItem: async (key: string) => {
        reads += 1;
        if (reads > 1) throw new Error('read failed');
        return f.backend.getItem(key);
      },
    };
    f.commitFailure = 'after';
    await assert.rejects(createFileBackedStorage(backend, f.files).setItem('data', large('new')), /acknowledgement lost/);
    assert.equal(f.contents.size, 2);
    assert.equal(await f.storage().getItem('data'), large('new'));
  });

  test('le nettoyage ancien peut échouer sans annuler une nouvelle sauvegarde durable', async () => {
    const f = fixture();
    const storage = f.storage();
    await storage.setItem('data', large('old'));
    f.cleanupFailure = true;
    const next = large('new');
    await storage.setItem('data', next);
    assert.equal(await storage.getItem('data'), next);
    assert.equal(f.contents.size, 2);
  });

  test('un pointeur absent, invalide ou traversant ne devient jamais une clé absente', async () => {
    const f = fixture();
    const storage = f.storage();
    for (const invalid of [`${FILE_POINTER_PREFIX}../secret.json`, '!liora-file:v2:unknown', `${FILE_POINTER_PREFIX}bad`, `${FILE_POINTER_PREFIX}00000000-0000-4000-8000-000000000099.json`]) {
      f.metadata.set('data', invalid);
      await assert.rejects(storage.getItem('data'));
      assert.equal(f.metadata.get('data'), invalid);
    }
    assert.equal(f.reads, 1);
  });

  test('une suppression explicite peut oublier un pointeur corrompu sans suivre son chemin', async () => {
    const f = fixture();
    f.metadata.set('data', `${FILE_POINTER_PREFIX}../secret.json`);
    await f.storage().removeItem('data');
    assert.equal(f.metadata.has('data'), false);
    assert.equal(f.reads, 0);
    f.metadata.set('data', 'unreadable old row');
    const storage = createFileBackedStorage({ ...f.backend, getItem: async () => { throw new Error('read blocked'); } }, f.files);
    await storage.removeItem('data');
    assert.equal(f.metadata.has('data'), false);
  });

  test('les écritures, lectures et suppressions d’une clé sont ordonnées, les autres clés restent disponibles', async () => {
    const f = fixture();
    const started = deferred();
    const release = deferred();
    const files = {
      ...f.files,
      create: async (value: string) => { started.resolve(); await release.promise; return f.files.create(value); },
    };
    const storage = createFileBackedStorage(f.backend, files);
    const write = storage.setItem('data', large());
    await started.promise;
    let readDone = false;
    const read = storage.getItem('data').then((value) => { readDone = true; return value; });
    const replace = storage.setItem('data', 'small');
    const remove = storage.removeItem('data');
    assert.equal(await storage.getItem('other'), null);
    assert.equal(readDone, false);
    release.resolve();
    await write;
    assert.equal(await read, large());
    await replace;
    await remove;
    assert.equal(await storage.getItem('data'), null);
    assert.equal(f.contents.size, 0);
  });

  test('une lecture concurrente d’une ancienne référence réessaie la référence actuelle', async () => {
    const f = fixture();
    const writer = f.storage();
    await writer.setItem('data', large('old'));
    const started = deferred();
    const release = deferred();
    let first = true;
    const reader = createFileBackedStorage(f.backend, {
      ...f.files,
      read: async (name) => {
        if (first) { first = false; started.resolve(); await release.promise; }
        return f.files.read(name);
      },
    });
    const reading = reader.getItem('data');
    await started.promise;
    await writer.setItem('data', large('new'));
    release.resolve();
    assert.equal(await reading, large('new'));
  });

  test('suppression ratée préserve le fichier, suppression engagée nettoie aussi après perte de réponse', async () => {
    const f = fixture();
    const storage = f.storage();
    const value = large();
    await storage.setItem('data', value);
    f.deleteFailure = 'before';
    await assert.rejects(storage.removeItem('data'), /delete failed/);
    assert.equal(await storage.getItem('data'), value);
    f.deleteFailure = 'after';
    await storage.removeItem('data');
    assert.equal(await storage.getItem('data'), null);
    assert.equal(f.contents.size, 0);
  });
});
