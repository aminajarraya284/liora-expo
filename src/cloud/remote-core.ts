import type { Data } from '../state/types';
import { CLOUD_BUCKET, cloudPath, mapAssets, MAX_CLOUD_FILE, parseCloudPayload, parseLocalData, photoDataUri } from './payload';
import type { RemoteSnapshot, SyncRemote } from './sync-engine';
import type { CloudRequest } from './transport';

type AssetIndex = Record<string, string>;
type Options = {
  userId: string;
  transport: { operation(): Promise<CloudRequest>; cancel(): void };
  indexStore: { load(): Promise<unknown>; save(index: AssetIndex): Promise<void> };
  hash(value: string): Promise<string>;
  newId(): string;
  readAsset(uri: string, document: boolean, encrypted: boolean): Promise<Uint8Array>;
  cacheAsset(bytes: Uint8Array, document: boolean, path: string): Promise<string>;
  assetAvailable(uri: string, document: boolean): Promise<boolean>;
};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const references = (data: Data): Set<string> => new Set([
  data.profile.photo, ...data.proches.map((p) => p.photo), ...data.notes.map((n) => n.photo),
  ...data.day.meals.map((m) => m.photo), ...data.docs.map((d) => d.uri),
].filter((uri): uri is string => !!uri && uri.startsWith('cloud:')));

/** Snapshot/file protocol without native imports, so account isolation and fault recovery are testable. */
export function createRemoteCore({ userId, transport, indexStore, hash, newId, readAsset, cacheAsset, assetAvailable }: Options): SyncRemote & { cancel(): void; prime(data: Data): Promise<void> } {
  let index: AssetIndex | null = null;
  let observedRevision: number | undefined;
  let acknowledged = new Set<string>();
  let hydrated: RemoteSnapshot | null = null;
  let awaitingReply: { revision: number; changeId: string; previous: Set<string> } | null = null;
  const media = new Map<string, string>();
  const pendingCleanup = new Set<string>();
  const mediaKey = (uri: string, document: boolean) => `${document ? 'document' : 'photo'}:${uri}`;

  const assets = async (): Promise<AssetIndex> => {
    if (index) return index;
    const saved = await indexStore.load();
    if (saved === null) return index = {};
    if (!object(saved) || Object.keys(saved).length > 50000) throw new Error('INVALID_ASSET_INDEX');
    for (const [key, uri] of Object.entries(saved)) {
      if (!/^[a-f0-9]{64}$/.test(key) || typeof uri !== 'string') throw new Error('INVALID_ASSET_INDEX');
      cloudPath(uri, userId);
    }
    return index = { ...saved } as AssetIndex;
  };
  const remember = async (local: string, remote: string, document: boolean): Promise<void> => {
    const next = { ...await assets(), [await hash(local)]: remote };
    await indexStore.save(next);
    index = next;
    media.set(mediaKey(remote, document), local);
  };
  const available = async (uri: string, document: boolean): Promise<boolean> => {
    try { return await assetAvailable(uri, document); } catch { return false; }
  };

  /** Only references removed by our acknowledged CAS enter this queue. Never sweep the bucket. */
  const cleanup = async (request: CloudRequest) => {
    const obsolete = [...pendingCleanup].filter((uri) => !acknowledged.has(uri));
    for (let offset = 0; offset < obsolete.length; offset += 100) {
      const batch = obsolete.slice(offset, offset + 100);
      try {
        await request(`/storage/v1/object/${CLOUD_BUCKET}`, 'DELETE', JSON.stringify({ prefixes: batch.map((uri) => cloudPath(uri, userId)) }));
      } catch {
        // The snapshot is already committed. Keep private orphans queued for a later retry.
        return;
      }
      for (const uri of batch) {
        pendingCleanup.delete(uri);
        media.delete(mediaKey(uri, false));
        media.delete(mediaKey(uri, true));
      }
      const removed = new Set(batch);
      const next = Object.fromEntries(Object.entries(await assets()).filter(([, uri]) => !removed.has(uri)));
      try { await indexStore.save(next); index = next; } catch {
        // Reuse still requires membership in the current snapshot, even if this index cannot be pruned.
      }
    }
  };

  return {
    async prime(data) {
      parseLocalData(data);
      const entries = await assets();
      await mapAssets(data, async (uri, document) => {
        const remote = entries[await hash(uri)];
        if (remote && await available(uri, document)) media.set(mediaKey(remote, document), uri);
        return uri;
      });
    },
    async load() {
      const request = await transport.operation();
      const rows: unknown = await request(`/rest/v1/liora_snapshots?user_id=eq.${encodeURIComponent(userId)}&select=payload,revision`);
      if (!Array.isArray(rows) || rows.length > 1) throw new Error('INVALID_CLOUD_DATA');
      if (!rows.length) {
        observedRevision = 0;
        acknowledged = new Set();
        hydrated = null;
        return null;
      }
      const row = rows[0] as { payload?: unknown; revision?: unknown } | null;
      if (!row || !['number', 'string'].includes(typeof row.revision) || (typeof row.revision === 'string' && !/^\d+$/.test(row.revision))) throw new Error('INVALID_CLOUD_REVISION');
      const revision = Number(row.revision);
      if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('INVALID_CLOUD_REVISION');
      const payload = parseCloudPayload(row.payload, userId);
      if (awaitingReply && revision === awaitingReply.revision + 1 && payload.changeId === awaitingReply.changeId) {
        const committed = references(payload.data);
        for (const uri of awaitingReply.previous) if (!committed.has(uri)) pendingCleanup.add(uri);
        awaitingReply = null;
      }
      if (hydrated?.revision === revision && hydrated.changeId === payload.changeId) {
        let reusable = true;
        await mapAssets(hydrated.data, async (uri, document) => {
          if (!(await available(uri, document))) reusable = false;
          return uri;
        });
        if (reusable) { await cleanup(request); return hydrated; }
      }
      const local = await mapAssets(payload.data, async (uri, document) => {
        const cached = media.get(mediaKey(uri, document));
        if (cached && await available(cached, document)) return cached;
        const path = cloudPath(uri, userId);
        const bytes: unknown = await request(`/storage/v1/object/authenticated/${CLOUD_BUCKET}/${path}`, 'GET', undefined, true);
        if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_CLOUD_FILE) throw new Error('INVALID_CLOUD_FILE');
        const result = await cacheAsset(bytes, document, path);
        await remember(result, uri, document);
        return result;
      });
      parseLocalData(local);
      observedRevision = revision;
      acknowledged = references(payload.data);
      hydrated = { data: local, revision, changeId: payload.changeId };
      await cleanup(request);
      return hydrated;
    },
    async save(data, revision, changeId) {
      parseLocalData(data);
      if (!Number.isSafeInteger(revision) || revision < 0 || (revision > 0 && observedRevision !== revision)) throw new Error('CLOUD_BASE_REQUIRED');
      const request = await transport.operation();
      const previous = new Set(acknowledged);
      const createdThisAttempt = new Set<string>();
      const uploaded = await mapAssets(data, async (uri, document, encrypted) => {
        const found = (await assets())[await hash(uri)];
        // A deleted old object must never be resurrected by another device's stale index.
        if (found && (acknowledged.has(found) || createdThisAttempt.has(found))) {
          cloudPath(found, userId);
          media.set(mediaKey(found, document), uri);
          return found;
        }
        const bytes = await readAsset(uri, document, encrypted);
        if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_CLOUD_FILE) throw new Error('FILE_TOO_LARGE');
        if (!document) photoDataUri(bytes);
        const path = `${userId}/${newId()}.bin`;
        const remote = `cloud:${path}`;
        cloudPath(remote, userId);
        await request(`/storage/v1/object/${CLOUD_BUCKET}/${path}`, 'POST', new Uint8Array(bytes).buffer);
        await remember(uri, remote, document);
        createdThisAttempt.add(remote);
        return remote;
      });
      const payload = parseCloudPayload({ v: 1, data: uploaded, changeId }, userId);
      awaitingReply = { revision, changeId, previous };
      const result: unknown = await request('/rest/v1/rpc/liora_save_snapshot', 'POST', JSON.stringify({ p_expected_revision: revision, p_payload: payload }));
      const row = Array.isArray(result) ? result[0] : result;
      if (!object(row) || Number(row.revision) !== revision + 1) throw new Error('INVALID_CLOUD_REVISION');
      observedRevision = revision + 1;
      awaitingReply = null;
      acknowledged = references(uploaded);
      hydrated = { data, revision: observedRevision, changeId };
      for (const uri of previous) if (!acknowledged.has(uri)) pendingCleanup.add(uri);
      await cleanup(request);
      return { revision: observedRevision };
    },
    cancel() { transport.cancel(); },
  };
}
