import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { describe, test } from 'node:test';
import { CloudAuthStorageError, createAuthStorage, type AuthStorageProblem } from '../src/cloud/auth-storage';

const cipher = {
  async generateKey() { return randomBytes(32).toString('hex'); },
  async encryptText(value: string, key: string) {
    const iv = randomBytes(12);
    const aes = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    const encrypted = Buffer.concat([aes.update(value, 'utf8'), aes.final()]);
    return Buffer.concat([iv, aes.getAuthTag(), encrypted]).toString('base64');
  },
  async decryptText(value: string, key: string) {
    const bytes = Buffer.from(value, 'base64');
    const aes = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), bytes.subarray(0, 12));
    aes.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([aes.update(bytes.subarray(28)), aes.final()]).toString('utf8');
  },
};

function bench() {
  const json = new Map<string, unknown>();
  const secrets = new Map<string, string>();
  let brokenRead = false;
  let brokenWrite = false;
  const problems: AuthStorageProblem[] = [];
  const durable = {
    async get<T>(key: string): Promise<T | null> {
      if (brokenRead) throw new Error('read failure');
      return (json.get(key) as T | undefined) ?? null;
    },
    async set(key: string, value: unknown) {
      if (brokenWrite) throw new Error('write failure');
      json.set(key, value);
    },
    async del(key: string) {
      if (brokenWrite) throw new Error('write failure');
      json.delete(key);
    },
  };
  const keys = {
    get: async (key: string) => secrets.get(key) ?? null,
    set: async (key: string, value: string) => { secrets.set(key, value); },
    del: async (key: string) => { secrets.delete(key); },
  };
  const make = (memoryOnly = false) => createAuthStorage({ namespace: 'liora.cloud.auth.test', durable, keys, cipher, memoryOnly, onError: (problem) => problems.push(problem) });
  return { json, secrets, problems, make, breakRead: (value: boolean) => { brokenRead = value; }, breakWrite: (value: boolean) => { brokenWrite = value; } };
}

describe('sessions Supabase chiffrées', () => {
  test('une grande session reste chiffrée et seule la courte clé va dans le trousseau', async () => {
    const b = bench();
    const session = JSON.stringify({ access_token: 'test-' + 'x'.repeat(5000), refresh_token: 'test-refresh' });
    await b.make().storage.setItem('session', session);
    assert.equal(JSON.stringify([...b.json.values()]).includes('test-refresh'), false);
    assert.equal(b.secrets.size, 1);
    assert.equal([...b.secrets.values()][0].length, 64);
    assert.equal(await b.make().storage.getItem('session'), session);
  });

  test('ne pas mémoriser conserve la session en mémoire et efface sa copie durable', async () => {
    const b = bench();
    const current = b.make();
    await current.storage.setItem('session', 'test-original');
    await current.setPersistence(false);
    assert.equal(await current.persistenceEnabled(), false);
    assert.equal(b.json.has('liora.cloud.auth.test.data'), false);
    assert.equal(b.secrets.size, 0);
    await current.storage.setItem('session', 'test-new');
    assert.equal(await current.storage.getItem('session'), 'test-new');
    assert.equal(await b.make().storage.getItem('session'), null);
    assert.equal(await b.make().persistenceEnabled(), false);
    await current.setPersistence(true);
    assert.equal(await b.make().persistenceEnabled(), true);
    assert.equal(await b.make().storage.getItem('session'), 'test-new');
  });

  test('le web ne touche ni au stockage durable ni au trousseau', async () => {
    const b = bench();
    b.breakRead(true);
    b.breakWrite(true);
    const current = b.make(true);
    await current.setPersistence(true);
    await current.storage.setItem('session', 'test-session');
    assert.equal(await current.storage.getItem('session'), 'test-session');
    assert.equal(await b.make(true).storage.getItem('session'), null);
    await current.storage.removeItem('session');
    assert.equal(await current.storage.getItem('session'), null);
    assert.equal(b.json.size, 0);
    assert.equal(b.secrets.size, 0);
  });

  test('clé perdue, enveloppe altérée et panne de lecture ne deviennent jamais une session absente', async () => {
    const b = bench();
    await b.make().storage.setItem('session', 'test-session');
    const saved = b.json.get('liora.cloud.auth.test.data');
    b.secrets.clear();
    await assert.rejects(b.make().storage.getItem('session'), CloudAuthStorageError);
    assert.deepEqual(b.json.get('liora.cloud.auth.test.data'), saved);
    b.json.set('liora.cloud.auth.test.data', { v: 1, enc: 'damaged' });
    await assert.rejects(b.make().storage.getItem('session'), CloudAuthStorageError);
    b.breakRead(true);
    await assert.rejects(b.make().storage.getItem('session'), /CLOUD_SESSION_UNREADABLE/);
    assert.equal(b.problems.at(-1), 'unreadable');
  });

  test('une panne d’écriture remonte sans perdre le jeton tournant en mémoire', async () => {
    const b = bench();
    const current = b.make();
    await current.storage.setItem('session', 'test-old');
    const oldEnvelope = b.json.get('liora.cloud.auth.test.data');
    b.breakWrite(true);
    await assert.rejects(current.storage.setItem('session', 'test-rotated'), /CLOUD_SESSION_WRITE_FAILED/);
    assert.equal(await current.storage.getItem('session'), 'test-rotated');
    assert.deepEqual(b.json.get('liora.cloud.auth.test.data'), oldEnvelope);
    assert.equal(b.problems.at(-1), 'write-failed');
    b.breakWrite(false);
    await current.storage.setItem('session', 'test-rotated');
    assert.equal(await b.make().storage.getItem('session'), 'test-rotated');
  });

  test('les écritures simultanées sont ordonnées et la suppression efface aussi la clé', async () => {
    const b = bench();
    const current = b.make();
    await Promise.all([
      current.storage.setItem('session', 'test-old'),
      current.storage.setItem('session', 'test-new'),
      current.storage.setItem('verifier', 'test-verifier'),
      current.storage.removeItem('verifier'),
    ]);
    assert.equal(await b.make().storage.getItem('session'), 'test-new');
    assert.equal(await b.make().storage.getItem('verifier'), null);
    await current.storage.removeItem('session');
    assert.equal(b.json.has('liora.cloud.auth.test.data'), false);
    assert.equal(b.secrets.size, 0);
  });

  test('une copie illisible peut être effacée explicitement, sans jamais écraser les autres espaces', async () => {
    const b = bench();
    b.json.set('liora.cloud.auth.test.data', { v: 999 });
    b.json.set('liora.session', 'local-account');
    b.json.set('liora.relais.session', 'relay-session');
    const current = b.make();
    await assert.rejects(current.storage.getItem('session'), CloudAuthStorageError);
    await current.clear();
    assert.equal(await current.storage.getItem('session'), null);
    assert.equal(b.json.get('liora.session'), 'local-account');
    assert.equal(b.json.get('liora.relais.session'), 'relay-session');
  });
});
