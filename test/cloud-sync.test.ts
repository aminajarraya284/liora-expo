import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ConflictError, createSyncEngine, LocalPersistenceError, type RemoteSnapshot, SessionError, type SyncRecord, type SyncRemote } from '../src/cloud/sync-engine';
import type { Data } from '../src/state/types';

const data = (name = 'Essai'): Data => ({
  profile: { firstName: name, lastName: '', age: '', city: '', address: '', phone: '', email: 'demo@example.fr' },
  health: { antecedents: '', allergies: '', doctor: '', doctorPhone: '', bloodType: '' },
  proches: [], docs: [], notes: [], treatments: [], appointments: [], moods: [], links: [],
  day: { date: '2026-11-16', waterMl: 0, meals: [], habits: [], taken: {} }, waterGoalMl: 1500,
});
const initial = (name = 'Essai'): SyncRecord => ({ data: data(name), revision: 0, dirty: true, changeId: `${name}-initial` });
const rename = (name: string) => (current: Data): Data => ({ ...current, profile: { ...current.profile, firstName: name } });
const clone = <T,>(value: T): T => structuredClone(value);
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

/** Two clients use the same atomic store, scoped by authenticated account. */
function server() {
  const snapshots = new Map<string, RemoteSnapshot>();
  let writes = 0;
  return {
    snapshots,
    get writes() { return writes; },
    client(owner: string): SyncRemote {
      return {
        load: async () => clone(snapshots.get(owner) ?? null),
        async save(next, expectedRevision, changeId) {
          const previous = snapshots.get(owner);
          if ((previous?.revision ?? 0) !== expectedRevision) throw new ConflictError();
          const revision = expectedRevision + 1;
          snapshots.set(owner, { data: clone(next), revision, changeId });
          writes += 1;
          return { revision };
        },
      };
    },
  };
}

describe('cloud : synchronisation et conservation des modifications', () => {
  test('une copie propre prend les chemins de médias réparés sans créer une nouvelle révision ni réécrire à chaque poll', async () => {
    const old = data();
    old.docs = [{ id: 'd', name: 'Essai', category: 'administratif', kind: 'PDF', date: '2026-11-16', size: 10, uri: 'file:///old.liora', encrypted: true }];
    const repaired = clone(old);
    repaired.docs[0].uri = 'file:///restored.liora';
    let writes = 0;
    const engine = createSyncEngine({
      initial: { data: old, revision: 1, dirty: false, changeId: 'base' },
      persist: async () => { writes += 1; },
      remote: { load: async () => ({ data: clone(repaired), revision: 1, changeId: 'base' }), save: async () => { throw new Error('clean copy must not upload'); } },
    });
    await engine.sync();
    assert.equal(engine.snapshot.data.docs[0].uri, 'file:///restored.liora');
    assert.equal(engine.snapshot.revision, 1);
    assert.equal(engine.snapshot.dirty, false);
    assert.equal(writes, 1);
    await engine.sync();
    assert.equal(writes, 1);
  });

  test('une réparation de média à la même révision ne remplace pas une saisie devenue sale pendant le téléchargement', async () => {
    const old = data();
    old.docs = [{ id: 'd', name: 'Essai', category: 'administratif', kind: 'PDF', date: '2026-11-16', size: 10, uri: 'file:///old.liora', encrypted: true }];
    const repaired = clone(old); repaired.docs[0].uri = 'file:///restored.liora';
    const started = deferred(); const download = deferred<RemoteSnapshot>();
    const engine = createSyncEngine({
      initial: { data: old, revision: 1, dirty: false, changeId: 'base' }, persist: async () => {},
      remote: {
        load: async () => { started.resolve(); return download.promise; },
        save: async (saved) => { assert.equal(saved.profile.firstName, 'Nouvelle saisie'); assert.equal(saved.docs[0].uri, 'file:///old.liora'); return { revision: 2 }; },
      },
    });
    const syncing = engine.sync();
    await started.promise;
    engine.update(rename('Nouvelle saisie'));
    download.resolve({ data: repaired, revision: 1, changeId: 'base' });
    await syncing;
    assert.equal(engine.snapshot.data.profile.firstName, 'Nouvelle saisie');
    assert.equal(engine.snapshot.data.docs[0].uri, 'file:///old.liora');
    assert.equal(engine.snapshot.revision, 2);
  });

  test('une révision identique avec un autre identifiant de changement demande une résolution explicite', async () => {
    let writes = 0;
    const engine = createSyncEngine({
      initial: { data: data(), revision: 1, dirty: false, changeId: 'base' }, persist: async () => { writes += 1; },
      remote: { load: async () => ({ data: data('Inattendu'), revision: 1, changeId: 'different' }), save: async () => ({ revision: 2 }) },
    });
    await engine.sync();
    assert.equal(engine.status.state, 'conflict');
    assert.equal(engine.snapshot.data.profile.firstName, 'Essai');
    assert.equal(writes, 0);
  });

  test('les changements hors ligne sont persistés puis repris après un redémarrage', async () => {
    const cloud = server();
    let disk = initial();
    let online = false;
    const client = cloud.client('a');
    const remote: SyncRemote = {
      load: async () => { if (!online) throw new Error('offline'); return client.load(); },
      save: client.save,
    };
    const first = createSyncEngine({ initial: disk, remote, persist: async (value) => { disk = clone(value); } });
    first.update(rename('Hors ligne'));
    await first.sync();
    assert.equal(first.status.state, 'offline');
    assert.equal(disk.data.profile.firstName, 'Hors ligne');
    assert.equal(disk.dirty, true);
    assert.equal(cloud.writes, 0);
    await first.stop();

    online = true;
    const second = createSyncEngine({ initial: disk, remote, persist: async (value) => { disk = clone(value); } });
    await second.sync();
    assert.equal(second.status.state, 'synced');
    assert.equal(disk.revision, 1);
    assert.equal(disk.dirty, false);
    assert.equal(cloud.snapshots.get('a')?.data.profile.firstName, 'Hors ligne');
  });

  test('une panne du stockage local interdit l’envoi et ne perd pas la dernière saisie', async () => {
    const cloud = server();
    let broken = true;
    let disk: SyncRecord | null = null;
    const engine = createSyncEngine({
      initial: initial(), remote: cloud.client('a'),
      persist: async (record) => { if (broken) throw new Error('disk full'); disk = clone(record); },
    });
    engine.update(rename('Non sauvegardé'));
    await engine.sync();
    assert.equal(engine.status.state, 'local-error');
    assert.equal(cloud.writes, 0);
    await assert.rejects(engine.flushLocal(), LocalPersistenceError);
    assert.equal(engine.snapshot.data.profile.firstName, 'Non sauvegardé');
    broken = false;
    await engine.sync();
    assert.equal(engine.status.state, 'synced');
    assert.equal((disk as unknown as SyncRecord).data.profile.firstName, 'Non sauvegardé');
  });

  test('deux appareils ne peuvent pas écraser silencieusement leurs modifications', async () => {
    const cloud = server();
    const first = createSyncEngine({ initial: initial(), remote: cloud.client('a'), persist: async () => {} });
    await first.sync();
    const second = createSyncEngine({ initial: clone(first.snapshot), remote: cloud.client('a'), persist: async () => {} });
    first.update(rename('Téléphone A'));
    await first.sync();
    second.update(rename('Téléphone B'));
    await second.sync();
    assert.equal(second.status.state, 'conflict');
    assert.equal(second.snapshot.data.profile.firstName, 'Téléphone B');
    assert.equal(cloud.snapshots.get('a')?.data.profile.firstName, 'Téléphone A');

    await second.resolveConflict('local');
    assert.equal(second.status.state, 'synced');
    assert.equal(cloud.snapshots.get('a')?.data.profile.firstName, 'Téléphone B');
    await first.sync();
    assert.equal(first.snapshot.data.profile.firstName, 'Téléphone B');
  });

  test('restaurer la version en ligne exige une résolution explicite du conflit', async () => {
    const cloud = server();
    cloud.snapshots.set('a', { data: data('Serveur'), revision: 2, changeId: 'remote-2' });
    const engine = createSyncEngine({ initial: { ...initial('Local'), revision: 1 }, remote: cloud.client('a'), persist: async () => {} });
    await engine.sync();
    assert.equal(engine.status.state, 'conflict');
    assert.equal(engine.snapshot.data.profile.firstName, 'Local');
    await engine.resolveConflict('remote');
    assert.equal(engine.snapshot.data.profile.firstName, 'Serveur');
    assert.equal(engine.snapshot.dirty, false);
    assert.equal(cloud.writes, 0);
  });

  test('une écriture concurrente entre la lecture et l’envoi déclenche un conflit explicite', async () => {
    const cloud = server();
    const client = cloud.client('a');
    const engine = createSyncEngine({
      initial: initial('Local'), persist: async () => {},
      remote: {
        load: client.load,
        async save(...args) {
          await client.save(data('Concurrent'), 0, 'other-device');
          return client.save(...args);
        },
      },
    });
    await engine.sync();
    assert.equal(engine.status.state, 'conflict');
    assert.equal(engine.status.conflict?.data.profile.firstName, 'Concurrent');
    assert.equal(engine.snapshot.data.profile.firstName, 'Local');
    assert.equal(cloud.writes, 1);
  });

  test('une suppression distante ne recrée pas automatiquement le compte depuis le cache', async () => {
    const cloud = server();
    const engine = createSyncEngine({ initial: { ...initial('Cache'), revision: 1, dirty: false }, remote: cloud.client('a'), persist: async () => {} });
    await engine.sync();
    assert.equal(engine.status.state, 'conflict');
    assert.equal(engine.status.conflict, null);
    await engine.resolveConflict('remote');
    assert.equal(engine.snapshot.data.profile.firstName, 'Cache');
    assert.equal(cloud.writes, 0);
    await engine.resolveConflict('local');
    assert.equal(engine.status.state, 'synced');
    assert.equal(cloud.writes, 1);
  });

  test('une réponse perdue après acceptation est reconnue après redémarrage sans doubler l’envoi', async () => {
    const cloud = server();
    const client = cloud.client('a');
    let disk = initial();
    const first = createSyncEngine({
      initial: disk, persist: async (value) => { disk = clone(value); },
      remote: { load: client.load, save: async (...args) => { await client.save(...args); throw new Error('reply lost'); } },
    });
    await first.sync();
    assert.equal(first.status.state, 'offline');
    assert.ok(disk.attempt);
    assert.equal(cloud.writes, 1);
    await first.stop();

    const second = createSyncEngine({ initial: disk, remote: client, persist: async (value) => { disk = clone(value); } });
    await second.sync();
    assert.equal(second.status.state, 'synced');
    assert.equal(disk.revision, 1);
    assert.equal(disk.attempt, undefined);
    assert.equal(cloud.writes, 1);
  });

  test('une modification pendant l’envoi reste en attente après son accusé de réception', async () => {
    const cloud = server();
    const client = cloud.client('a');
    const started = deferred();
    const release = deferred();
    let delay = true;
    let disk = initial('Premier');
    const engine = createSyncEngine({
      initial: disk, persist: async (value) => { disk = clone(value); },
      remote: { load: client.load, save: async (...args) => { if (delay) { started.resolve(); await release.promise; } return client.save(...args); } },
    });
    const syncing = engine.sync();
    await started.promise;
    engine.update(rename('Pendant l’envoi'));
    await engine.flushLocal();
    release.resolve();
    await syncing;
    assert.equal(engine.snapshot.dirty, true);
    assert.equal(disk.revision, 1);
    assert.equal(disk.data.profile.firstName, 'Pendant l’envoi');
    assert.equal(cloud.snapshots.get('a')?.data.profile.firstName, 'Premier');
    delay = false;
    await engine.sync();
    assert.equal(engine.snapshot.dirty, false);
    assert.equal(cloud.snapshots.get('a')?.data.profile.firstName, 'Pendant l’envoi');
  });

  test('réponse perdue avec saisie plus récente : reprise sans conflit artificiel après fermeture', async () => {
    const cloud = server();
    const client = cloud.client('a');
    const started = deferred();
    const release = deferred();
    let disk = initial('Avant');
    const first = createSyncEngine({
      initial: disk, persist: async (value) => { disk = clone(value); },
      remote: { load: client.load, save: async (...args) => { started.resolve(); await release.promise; await client.save(...args); throw new Error('reply lost'); } },
    });
    const syncing = first.sync();
    await started.promise;
    first.update(rename('Après'));
    await first.stop();
    assert.notEqual(disk.attempt?.changeId, disk.changeId);
    release.resolve();
    await syncing;

    const second = createSyncEngine({ initial: disk, remote: client, persist: async (value) => { disk = clone(value); } });
    await second.sync();
    assert.equal(second.status.state, 'synced');
    assert.equal(cloud.writes, 2);
    assert.equal(cloud.snapshots.get('a')?.data.profile.firstName, 'Après');
    assert.equal(disk.revision, 2);
  });

  test('une édition pendant le téléchargement ne peut pas être remplacée par le serveur', async () => {
    const loaded = deferred<RemoteSnapshot | null>();
    const started = deferred();
    const remote: SyncRemote = { load: async () => { started.resolve(); return loaded.promise; }, save: async () => { throw new Error('must not upload'); } };
    const engine = createSyncEngine({ initial: { ...initial(), revision: 1, dirty: false }, remote, persist: async () => {} });
    const syncing = engine.sync();
    await started.promise;
    engine.update(rename('Nouvelle saisie'));
    loaded.resolve({ data: data('Autre appareil'), revision: 2, changeId: 'remote' });
    await syncing;
    assert.equal(engine.snapshot.data.profile.firstName, 'Nouvelle saisie');
    assert.equal(engine.status.state, 'conflict');
  });

  test('un arrêt pendant le téléchargement empêche les envois et rappels tardifs', async () => {
    const loaded = deferred<RemoteSnapshot | null>();
    const started = deferred();
    let emitted = 0;
    let uploads = 0;
    const engine = createSyncEngine({
      initial: initial(), persist: async () => {}, onChange: () => { emitted += 1; },
      remote: { load: async () => { started.resolve(); return loaded.promise; }, save: async () => { uploads += 1; return { revision: 1 }; } },
    });
    const syncing = engine.sync();
    await started.promise;
    await engine.stop();
    const count = emitted;
    loaded.resolve(null);
    await syncing;
    engine.update(rename('Tardif'));
    await engine.sync();
    assert.equal(emitted, count);
    assert.equal(uploads, 0);
    assert.equal(engine.status.state, 'stopped');
  });

  test('les écritures locales restent ordonnées et conservent le dernier état', async () => {
    const release = deferred();
    let first = true;
    let disk = initial();
    const saved: string[] = [];
    const engine = createSyncEngine({
      initial: disk, remote: server().client('a'),
      persist: async (value) => { if (first) { first = false; await release.promise; } disk = clone(value); saved.push(value.data.profile.firstName); },
    });
    engine.update(rename('1'));
    await tick();
    engine.update(rename('2'));
    engine.update(rename('3'));
    release.resolve();
    await engine.flushLocal();
    assert.deepEqual(saved, ['1', '3']);
    assert.equal(disk.data.profile.firstName, '3');
  });

  test('sessions expirées et réponses invalides ne nettoient jamais les données en attente', async () => {
    const unauthorized = createSyncEngine({
      initial: initial(), persist: async () => {},
      remote: { load: async () => { throw new SessionError(); }, save: async () => ({ revision: 1 }) },
    });
    await unauthorized.sync();
    assert.equal(unauthorized.status.state, 'auth-error');
    assert.equal(unauthorized.snapshot.dirty, true);
    const malformed = createSyncEngine({
      initial: initial(), persist: async () => {},
      remote: { load: async () => null, save: async () => ({ revision: 99 }) },
    });
    await malformed.sync();
    assert.equal(malformed.status.state, 'offline');
    assert.equal(malformed.snapshot.dirty, true);
  });

  test('les moteurs de deux comptes ne partagent ni état local ni données distantes', async () => {
    const cloud = server();
    const disks = new Map<string, SyncRecord>();
    const first = createSyncEngine({ initial: initial('Compte A'), remote: cloud.client('a'), persist: async (value) => { disks.set('a', clone(value)); } });
    const second = createSyncEngine({ initial: initial('Compte B'), remote: cloud.client('b'), persist: async (value) => { disks.set('b', clone(value)); } });
    await Promise.all([first.sync(), second.sync()]);
    await first.stop();
    second.update(rename('Compte B modifié'));
    await second.sync();
    assert.equal(cloud.snapshots.get('a')?.data.profile.firstName, 'Compte A');
    assert.equal(cloud.snapshots.get('b')?.data.profile.firstName, 'Compte B modifié');
    assert.equal(disks.get('a')?.data.profile.firstName, 'Compte A');
    assert.equal(disks.get('b')?.data.profile.firstName, 'Compte B modifié');
  });
});
