import type { User } from '@supabase/supabase-js';
import { encryptionAvailable } from '../security/crypto';
import { hashPassword, verifyPassword, type PasswordRecord } from '../security/passwords';
import { createDataKey, getDataKey } from '../state/accounts';
import { initialData } from '../state/seed';
import { uid } from '../utils/ids';
import { kv, secure } from '../utils/storage';
import { cloudClient, cloudPersistenceEnabled } from './client';
import { accountCache, cloudCacheName, cloudScope } from './cache';
import { parseLocalRecord } from './local-record';
import { createRemote } from './remote';
import { createSyncEngine, type SyncRecord, type SyncStatus } from './sync-engine';

export type CloudIdentity = { id: string; email: string; firstName: string };
const IDENTITY = `liora.cloud.identity.${cloudScope}`;
const passwordKey = (id: string) => `liora.cloud.password.${cloudScope}.${id}`;
const keyId = (id: string) => `cloud.${cloudScope}.${id}`;
export const cloudIdentity = (user: User): CloudIdentity => ({ id: user.id, email: user.email ?? '', firstName: typeof user.user_metadata?.first_name === 'string' ? user.user_metadata.first_name.slice(0, 40) : '' });
export const clearCloudIdentity = () => secure.del(IDENTITY);
export async function rememberedCloudIdentity(): Promise<CloudIdentity | null> {
  if (!(await cloudPersistenceEnabled())) return null;
  const identity = await secure.getJSON<CloudIdentity>(IDENTITY);
  if (!identity) return null;
  if (!/^[0-9a-f-]{36}$/.test(identity.id) || typeof identity.email !== 'string' || typeof identity.firstName !== 'string') throw new Error('CLOUD_IDENTITY_UNREADABLE');
  return identity;
}
export async function rememberCloudPassword(id: string, password: string) {
  await secure.setJSON(passwordKey(id), await hashPassword(password));
}
export async function verifyCloudPassword(id: string, password: string): Promise<boolean> {
  const record = await secure.getJSON<PasswordRecord>(passwordKey(id));
  return !!record && verifyPassword(password, record);
}

export async function openCloudAccount(identity: CloudIdentity, password: string | null, remember: boolean, onChange: (record: SyncRecord, status: SyncStatus) => void) {
  if (!cloudClient || !(await encryptionAvailable())) throw new Error('CLOUD_ENCRYPTION_REQUIRED');
  let key = await getDataKey(keyId(identity.id));
  if (!key && await kv.get(cloudCacheName('data', identity.id)) !== null) throw new Error('CLOUD_KEY_MISSING');
  key ??= await createDataKey(keyId(identity.id));
  const cache = accountCache(identity.id, key);
  const remote = createRemote(cloudClient, identity.id, key);
  const saved = await cache.load();
  let initial: SyncRecord;
  if (saved !== null) initial = parseLocalRecord(saved);
  else {
    // A first login on another device must finish the download before opening an empty account.
    const downloaded = await remote.load();
    initial = downloaded ? { ...downloaded, dirty: false } : { data: initialData(identity.firstName, identity.email), revision: 0, dirty: true, changeId: uid() };
    await cache.save(initial);
  }
  await remote.prime(initial.data);
  if (password) await rememberCloudPassword(identity.id, password);
  if (remember) await secure.setJSON(IDENTITY, identity);
  else await clearCloudIdentity();
  const engine = createSyncEngine({ initial, remote, persist: cache.save, onChange, newId: uid });
  return { engine, remote, key, identity };
}

export async function removeCloudLocal(identity: CloudIdentity, key: string): Promise<void> {
  await accountCache(identity.id, key).remove();
  await kv.del(cloudCacheName('assets', identity.id));
  await secure.del(passwordKey(identity.id));
  await secure.del(`liora.cle.${keyId(identity.id)}`);
  await clearCloudIdentity();
}
