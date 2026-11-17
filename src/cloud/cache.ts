import { decryptText, encryptText } from '../security/crypto';
import { kv } from '../utils/storage';
import { UnreadableDataError } from '../state/data-storage';
import type { SyncRecord } from './sync-engine';

export function encryptedCache<T>(name: string, key: string) {
  return {
    async load(): Promise<T | null> {
      const value = await kv.get<{ v: number; enc: string }>(name);
      if (value === null) return null;
      try {
        if (value.v !== 1 || typeof value.enc !== 'string') throw new Error();
        const parsed: unknown = JSON.parse(await decryptText(value.enc, key));
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        return parsed as T;
      } catch { throw new UnreadableDataError(); }
    },
    async save(value: T): Promise<void> { await kv.set(name, { v: 1, enc: await encryptText(JSON.stringify(value), key) }); },
    remove: () => kv.del(name),
  };
}

const scope = () => {
  try { return encodeURIComponent(new URL((process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim()).origin).replace(/%/g, '-'); }
  catch { return 'disabled'; }
};
export const cloudScope = scope();
export const cloudCacheName = (kind: string, id: string) => `liora:cloud:${cloudScope}:${kind}:${id}`;
export const accountCache = (id: string, key: string) => encryptedCache<SyncRecord>(cloudCacheName('data', id), key);
