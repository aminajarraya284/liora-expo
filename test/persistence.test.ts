import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { describe, test } from 'node:test';
import { createDataStorage, UnreadableDataError } from '../src/state/data-storage';
import { createSaver } from '../src/state/saver';
import type { Data } from '../src/state/types';
import { createJsonStorage, createMemoryStorage, StorageReadError } from '../src/utils/json-storage';

const data: Data = {
  profile: { firstName: 'Test', lastName: '', age: '', city: '', address: '', phone: '', email: 'test@example.fr' },
  health: { antecedents: '', allergies: '', doctor: '', doctorPhone: '', bloodType: '' },
  proches: [], docs: [], notes: [], treatments: [], appointments: [], moods: [], links: [],
  day: { date: '2026-11-16', waterMl: 0, meals: [], habits: [], taken: {} }, waterGoalMl: 1500,
};

// AES-GCM réel pour éprouver le stockage sans charger de module natif dans Node.
const cipher = {
  async encryptText(text: string, key: string) {
    const iv = randomBytes(12);
    const aes = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    const encrypted = Buffer.concat([aes.update(text, 'utf8'), aes.final()]);
    return Buffer.concat([iv, aes.getAuthTag(), encrypted]).toString('base64');
  },
  async decryptText(text: string, key: string) {
    const bytes = Buffer.from(text, 'base64');
    const aes = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), bytes.subarray(0, 12));
    aes.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([aes.update(bytes.subarray(28)), aes.final()]).toString('utf8');
  },
};

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('stockage : protection des données existantes', () => {
  test('seule une clé absente renvoie null ; les pannes et le JSON invalide remontent', async () => {
    const raw = createMemoryStorage();
    const storage = createJsonStorage(raw);
    assert.equal(await storage.get('absent'), null);
    for (const value of ['', '{', 'null']) {
      await raw.setItem('data', value);
      await assert.rejects(storage.get('data'), StorageReadError);
      assert.equal(await raw.getItem('data'), value);
    }
    const broken = createJsonStorage({ ...raw, getItem: async () => { throw new Error('disk'); } });
    await assert.rejects(broken.get('data'), StorageReadError);
  });

  test('sans clé ou si le chiffrement échoue, aucune écriture en clair', async () => {
    const raw = createMemoryStorage();
    const storage = createJsonStorage(raw);
    await raw.setItem('liora:data:1', 'previous');
    const store = createDataStorage(storage, cipher);
    await assert.rejects(store.saveData('1', data, null), /ENCRYPTION_REQUIRED/);
    const broken = createDataStorage(storage, { ...cipher, encryptText: async () => { throw new Error('crypto'); } });
    await assert.rejects(broken.saveData('1', data, 'key'));
    assert.equal(await raw.getItem('liora:data:1'), 'previous');
  });

  test('aller-retour chiffré, mauvaise clé et données altérées sans écrasement', async () => {
    const raw = createMemoryStorage();
    const storage = createJsonStorage(raw);
    const store = createDataStorage(storage, cipher);
    const key = randomBytes(32).toString('hex');
    await store.saveData('1', data, key);
    const saved = (await raw.getItem('liora:data:1'))!;
    assert.equal(saved.includes('test@example.fr'), false);
    assert.deepEqual((await store.loadData('1', key)).data, data);
    await assert.rejects(store.loadData('1', null), UnreadableDataError);
    await assert.rejects(store.loadData('1', randomBytes(32).toString('hex')), UnreadableDataError);
    assert.equal(await raw.getItem('liora:data:1'), saved);
    await storage.set('liora:data:1', { v: 2, enc: 'altered' });
    await assert.rejects(store.loadData('1', key), UnreadableDataError);
  });

  test('migration en clair acceptée seulement pour un compte valide', async () => {
    const storage = createJsonStorage(createMemoryStorage());
    const store = createDataStorage(storage, cipher);
    for (const value of [{}, [], false, { v: 3, enc: 'unknown' }, { ...data, day: null }]) {
      await storage.set('liora:data:1', value);
      await assert.rejects(store.loadData('1', 'key'), UnreadableDataError);
    }
    await storage.set('liora:data:1', data);
    assert.equal((await store.loadData('1', null)).plaintext, true);
    await storage.set('liora:data:1', { profile: data.profile });
    assert.deepEqual((await store.loadData('1', null)).data, { profile: data.profile });
    await store.saveData('1', data, randomBytes(32).toString('hex'));
    assert.equal((await storage.get<{ v: number }>('liora:data:1'))?.v, 2);
  });

  test('un nouvel aperçu web ne retrouve ni compte, ni clé, ni données', async () => {
    const firstPage = createMemoryStorage();
    await firstPage.setItem('account', 'secret');
    assert.equal(await firstPage.getItem('account'), 'secret');
    assert.equal(await createMemoryStorage().getItem('account'), null);
  });
});

describe('sauvegardes : panne et reprise', () => {
  test('un échec reste signalé ; flush refuse de réussir et réessaie les données conservées', async () => {
    let broken = true;
    let saved = 0;
    const states: boolean[] = [];
    const saver = createSaver(async (value: number) => {
      if (broken) throw new Error('disk full');
      saved = value;
    }, (failed) => states.push(failed));
    saver.schedule(1);
    await tick();
    await assert.rejects(saver.flush(), /disk full/);
    assert.equal(states.at(-1), true);
    broken = false;
    await saver.flush();
    assert.equal(saved, 1);
    assert.equal(states.at(-1), false);
  });

  test('une écriture lente en échec ne remplace pas les modifications plus récentes', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const written: number[] = [];
    const saver = createSaver(async (value: number) => {
      if (value === 1) { await gate; throw new Error('interrupted'); }
      written.push(value);
    });
    saver.schedule(1);
    await tick();
    saver.schedule(2);
    saver.schedule(3);
    release();
    await saver.flush();
    assert.deepEqual(written, [3]);
  });

  test('annuler puis attendre empêche une écriture échouée de ressusciter un compte supprimé', async () => {
    let reject!: (error: Error) => void;
    let attempts = 0;
    const gate = new Promise<void>((_resolve, fail) => { reject = fail; });
    const saver = createSaver(async () => { attempts += 1; await gate; });
    saver.schedule(1);
    await tick();
    saver.cancel();
    reject(new Error('disk'));
    await saver.flush();
    await saver.flush();
    assert.equal(attempts, 1);
  });
});
