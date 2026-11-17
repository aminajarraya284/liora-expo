import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, test } from 'node:test';
import { createRemoteCore } from '../src/cloud/remote-core';
import { cloudPath, photoDataUri, type CloudPayload } from '../src/cloud/payload';
import { ConflictError, createSyncEngine, SessionError, type SyncRecord } from '../src/cloud/sync-engine';
import { createCloudTransport } from '../src/cloud/transport';
import type { Data } from '../src/state/types';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9);
const PDF = Uint8Array.of(37, 80, 68, 70, 45, 49);
const PHOTO = photoDataUri(JPEG);
const DOC = 'file:///private/document.liora';
const hash = async (value: string) => createHash('sha256').update(value).digest('hex');
const sample = (): Data => ({
  profile: { firstName: 'Essai', lastName: '', age: '', city: '', address: '', phone: '', email: 'essai@example.org', photo: PHOTO },
  health: { antecedents: '', allergies: '', doctor: '', doctorPhone: '', bloodType: '' },
  proches: [], notes: [], treatments: [], appointments: [], moods: [], links: [],
  docs: [{ id: 'doc', name: 'Exemple', category: 'administratif', kind: 'PDF', date: '2026-11-16', size: PDF.length, uri: DOC, encrypted: true }],
  day: { date: '2026-11-16', waterMl: 0, meals: [], habits: [], taken: {} }, waterGoalMl: 1500,
});

function bench() {
  let snapshot: { payload: CloudPayload; revision: number } | null = null;
  let nextId = 0;
  let loseReply = false;
  let failCleanup = false;
  let failCommit = false;
  const cloudFiles = new Map<string, Uint8Array>();
  const requests: { path: string; method: string }[] = [];
  const deleted: string[][] = [];
  const fetchFn: typeof fetch = async (url, init) => {
    const target = new URL(String(url));
    const method = init?.method ?? 'GET';
    const path = target.pathname;
    requests.push({ path, method });
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer owner-session');
    assert.equal(target.origin, 'https://project.supabase.co');
    if (path === '/rest/v1/liora_snapshots') return Response.json(snapshot ? [structuredClone(snapshot)] : []);
    if (path === '/rest/v1/rpc/liora_save_snapshot') {
      const { p_expected_revision: expected, p_payload: payload } = JSON.parse(String(init?.body));
      if (failCommit || expected !== (snapshot?.revision ?? 0)) return Response.json({ code: '40001' }, { status: 409 });
      snapshot = { payload, revision: expected + 1 };
      if (loseReply) { loseReply = false; throw new TypeError('reply lost'); }
      return Response.json([{ revision: snapshot.revision }]);
    }
    if (method === 'DELETE' && path === '/storage/v1/object/liora-files') {
      const { prefixes } = JSON.parse(String(init?.body)) as { prefixes: string[] };
      if (failCleanup) return Response.json({ error: 'temporary failure' }, { status: 503 });
      assert.ok(prefixes.every((p) => p.startsWith(`${USER}/`)));
      deleted.push(prefixes);
      prefixes.forEach((p) => cloudFiles.delete(p));
      return Response.json([]);
    }
    const uploadPrefix = '/storage/v1/object/liora-files/';
    const downloadPrefix = '/storage/v1/object/authenticated/liora-files/';
    if (method === 'POST' && path.startsWith(uploadPrefix)) {
      const key = path.slice(uploadPrefix.length);
      assert.equal(cloudFiles.has(key), false);
      cloudFiles.set(key, new Uint8Array(init!.body as ArrayBuffer));
      return Response.json({ Key: key });
    }
    if (method === 'GET' && path.startsWith(downloadPrefix)) {
      const found = cloudFiles.get(path.slice(downloadPrefix.length));
      return found ? new Response(new Uint8Array(found)) : Response.json({ error: 'not found' }, { status: 404 });
    }
    throw new Error('Unexpected test endpoint');
  };

  function device(existingIndex: Record<string, string> = {}) {
    let index: Record<string, string> = structuredClone(existingIndex);
    let failIndex = false;
    const local = new Map<string, Uint8Array>([[DOC, PDF]]);
    const transport = createCloudTransport({ url: 'https://project.supabase.co', publishableKey: 'sb_publishable_example1234567890', userId: USER, getSession: async () => ({ userId: USER, accessToken: 'owner-session' }), fetchFn });
    const remote = createRemoteCore({
      userId: USER, transport, hash,
      indexStore: {
        load: async () => structuredClone(index),
        save: async (next) => { if (failIndex) throw new Error('disk full'); index = structuredClone(next); },
      },
      newId: () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
      readAsset: async (uri, document, encrypted) => {
        if (!document && uri === PHOTO) return JPEG;
        if (document) assert.equal(encrypted, true);
        const bytes = local.get(uri);
        if (!bytes) throw new Error('Local asset missing');
        return bytes;
      },
      cacheAsset: async (bytes, document, path) => {
        const uri = document ? `file:///cache/${path.split('/')[1]}.liora` : photoDataUri(bytes);
        local.set(uri, new Uint8Array(bytes));
        return uri;
      },
      assetAvailable: async (uri) => uri === PHOTO || local.has(uri),
    });
    return { remote, local, get index() { return structuredClone(index); }, set failIndex(value: boolean) { failIndex = value; } };
  }

  return {
    device, cloudFiles, requests, deleted,
    get snapshot() { return snapshot; },
    set snapshot(value) { snapshot = value; },
    set loseReply(value: boolean) { loseReply = value; },
    set failCleanup(value: boolean) { failCleanup = value; },
    set failCommit(value: boolean) { failCommit = value; },
    get downloads() { return requests.filter((r) => r.path.includes('/object/authenticated/')).length; },
    get uploads() { return requests.filter((r) => r.method === 'POST' && r.path.startsWith('/storage/')).length; },
    get commits() { return requests.filter((r) => r.path.endsWith('/liora_save_snapshot')).length; },
  };
}

describe('cloud : transfert des médias et instantanés', () => {
  test('les fichiers deviennent des références privées sans changer la copie locale', async () => {
    const api = bench(); const a = api.device(); const data = sample();
    assert.deepEqual(await a.remote.save(data, 0, 'change-1'), { revision: 1 });
    assert.equal(api.uploads, 2);
    assert.equal(data.profile.photo, PHOTO);
    assert.equal(data.docs[0].uri, DOC);
    assert.ok(api.snapshot!.payload.data.profile.photo!.startsWith(`cloud:${USER}/`));
    assert.ok(api.snapshot!.payload.data.docs[0].uri!.startsWith(`cloud:${USER}/`));
    assert.equal(JSON.stringify(api.snapshot).includes('file:///'), false);
    assert.equal(JSON.stringify(api.snapshot).includes('data:image/'), false);
    assert.equal((await a.remote.load())?.data, data);
    assert.equal(api.downloads, 0);
  });

  test('un second téléphone restaure les médias puis ne retélécharge que le document manquant', async () => {
    const api = bench(); await api.device().remote.save(sample(), 0, 'first');
    const b = api.device(); const first = (await b.remote.load())!;
    assert.equal(api.downloads, 2);
    assert.equal(first.data.profile.photo, PHOTO);
    assert.ok(first.data.docs[0].uri!.startsWith('file:///cache/'));
    await b.remote.load(); assert.equal(api.downloads, 2);
    b.local.delete(first.data.docs[0].uri!);
    const restored = (await b.remote.load())!;
    assert.equal(api.downloads, 3);
    assert.deepEqual(b.local.get(restored.data.docs[0].uri!), PDF);
  });

  test('une même photo utilisée plusieurs fois ne coûte qu’un transfert pendant une sauvegarde', async () => {
    const api = bench(); const data = sample();
    data.notes = [{ id: 'note', title: 'Essai', text: '', date: '2026-11-16', photo: PHOTO }];
    data.day.meals = [{ id: 'meal', name: 'Essai', desc: '', done: false, photo: PHOTO }];
    await api.device().remote.save(data, 0, 'shared-photo');
    assert.equal(api.uploads, 2);
    const remote = api.snapshot!.payload.data;
    assert.equal(remote.profile.photo, remote.notes[0].photo);
    assert.equal(remote.profile.photo, remote.day.meals[0].photo);
  });

  test('le redémarrage réutilise l’index chiffré pour éviter de nouveaux téléchargements', async () => {
    const api = bench(); const a = api.device(); const original = sample();
    await a.remote.save(original, 0, 'first');
    const restarted = api.device(a.index);
    await restarted.remote.prime(original);
    await restarted.remote.load();
    assert.equal(api.downloads, 0);
    restarted.local.delete(DOC);
    await restarted.remote.load();
    assert.equal(api.downloads, 1);
  });

  test('le moteur conserve le chemin réparé d’un document même sans nouvelle révision distante', async () => {
    const api = bench(); const a = api.device(); const data = sample();
    await a.remote.save(data, 0, 'first');
    a.local.delete(DOC);
    let persisted: SyncRecord | null = null;
    const engine = createSyncEngine({ initial: { data, revision: 1, dirty: false, changeId: 'first' }, remote: a.remote, persist: async (record) => { persisted = record; } });
    await engine.sync();
    assert.notEqual(engine.snapshot.data.docs[0].uri, DOC);
    assert.deepEqual(a.local.get(engine.snapshot.data.docs[0].uri!), PDF);
    assert.equal(engine.snapshot.dirty, false);
    assert.equal(engine.snapshot.revision, 1);
    assert.equal((persisted as SyncRecord | null)?.data.docs[0].uri, engine.snapshot.data.docs[0].uri);
  });

  test('une référence appartenant à un autre compte est refusée avant le téléchargement', async () => {
    const api = bench(); await api.device().remote.save(sample(), 0, 'first');
    api.snapshot!.payload.data.docs[0].uri = api.snapshot!.payload.data.docs[0].uri!.replace(USER, OTHER);
    await assert.rejects(api.device().remote.load(), /INVALID_CLOUD_FILE/);
    assert.equal(api.downloads, 0);
    const badIndex = { [await hash(PHOTO)]: `cloud:${OTHER}/00000000-0000-4000-8000-000000000001.bin` };
    await assert.rejects(api.device(badIndex).remote.save(sample(), 0, 'bad'));
  });

  test('un conflit CAS ne supprime aucun fichier de la version existante', async () => {
    const api = bench(); const a = api.device(); await a.remote.save(sample(), 0, 'first');
    const oldDoc = cloudPath(api.snapshot!.payload.data.docs[0].uri!, USER);
    api.failCommit = true;
    await assert.rejects(a.remote.save({ ...sample(), docs: [] }, 1, 'remove'), ConflictError);
    assert.equal(api.deleted.length, 0);
    assert.equal(api.cloudFiles.has(oldDoc), true);
  });

  test('après suppression validée, un index ancien ne ressuscite pas un objet effacé', async () => {
    const api = bench(); const a = api.device(); await a.remote.save(sample(), 0, 'first');
    const oldDoc = cloudPath(api.snapshot!.payload.data.docs[0].uri!, USER);
    const b = api.device(); const stale = (await b.remote.load())!.data;
    await a.remote.save({ ...sample(), docs: [] }, 1, 'remove');
    assert.deepEqual(api.deleted.flat(), [oldDoc]);
    assert.equal(api.cloudFiles.has(oldDoc), false);
    await b.remote.load();
    await b.remote.save(stale, 2, 'restore-explicitly');
    const newDoc = cloudPath(api.snapshot!.payload.data.docs[0].uri!, USER);
    assert.notEqual(newDoc, oldDoc);
    assert.equal(api.cloudFiles.has(newDoc), true);
    assert.equal(api.uploads, 3);
  });

  test('un nettoyage indisponible ne transforme pas un instantané validé en échec', async () => {
    const api = bench(); const a = api.device(); await a.remote.save(sample(), 0, 'first');
    const oldDoc = cloudPath(api.snapshot!.payload.data.docs[0].uri!, USER);
    api.failCleanup = true;
    assert.deepEqual(await a.remote.save({ ...sample(), docs: [] }, 1, 'remove'), { revision: 2 });
    assert.equal(api.cloudFiles.has(oldDoc), true);
    api.failCleanup = false;
    await a.remote.load();
    assert.equal(api.cloudFiles.has(oldDoc), false);
  });

  test('une réponse CAS perdue ne lance pas le nettoyage avant son accusé de réception', async () => {
    const api = bench(); const a = api.device(); await a.remote.save(sample(), 0, 'first');
    const oldDoc = cloudPath(api.snapshot!.payload.data.docs[0].uri!, USER);
    api.loseReply = true;
    await assert.rejects(a.remote.save({ ...sample(), docs: [] }, 1, 'lost-reply'));
    assert.equal(api.snapshot!.revision, 2);
    assert.equal(api.deleted.length, 0);
    assert.equal((await a.remote.load())!.changeId, 'lost-reply');
    assert.equal(api.cloudFiles.has(oldDoc), false);
  });

  test('une panne de l’index local empêche la validation distante ; annuler arrête le réseau', async () => {
    const api = bench(); const a = api.device(); a.failIndex = true;
    await assert.rejects(a.remote.save(sample(), 0, 'not-durable'), /disk full/);
    assert.equal(api.commits, 0);
    assert.equal(api.snapshot, null);
    a.remote.cancel();
    const calls = api.requests.length;
    await assert.rejects(a.remote.load(), SessionError);
    assert.equal(api.requests.length, calls);
  });
});
