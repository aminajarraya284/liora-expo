import type { Data } from './types';

type JsonStorage = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
};
type Cipher = {
  encryptText(text: string, key: string): Promise<string>;
  decryptText(text: string, key: string): Promise<string>;
};
export class UnreadableDataError extends Error {}
export type Loaded = { data: Partial<Data> | null; plaintext: boolean };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Vérifie le format sans refuser les anciennes versions qui omettaient certaines rubriques. */
function isSavedData(value: unknown): value is Partial<Data> {
  if (!isObject(value) || 'v' in value || !isObject(value.profile)) return false;
  const strings = (record: Record<string, unknown>, keys: string[]) => keys.every((key) => typeof record[key] === 'string');
  if (!strings(value.profile, ['firstName', 'lastName', 'age', 'city', 'address', 'phone', 'email'])) return false;
  if ('health' in value && (!isObject(value.health) || !strings(value.health, ['antecedents', 'allergies', 'doctor', 'doctorPhone', 'bloodType']))) return false;
  if (!['proches', 'docs', 'notes', 'treatments', 'appointments', 'moods', 'links'].every((key) => !(key in value) || Array.isArray(value[key]))) return false;
  if ('day' in value) {
    const day = value.day;
    if (!isObject(day) || typeof day.date !== 'string' || typeof day.waterMl !== 'number' || !Number.isFinite(day.waterMl)
      || !Array.isArray(day.meals) || !Array.isArray(day.habits) || !isObject(day.taken)) return false;
  }
  return !('waterGoalMl' in value) || (typeof value.waterGoalMl === 'number' && Number.isFinite(value.waterGoalMl));
}

export function createDataStorage(storage: JsonStorage, cipher: Cipher) {
  const dataKey = (userId: string) => `liora:data:${userId}`;
  return {
    async loadData(userId: string, key: string | null): Promise<Loaded> {
      try {
        const stored = await storage.get<unknown>(dataKey(userId));
        if (stored === null) return { data: null, plaintext: false };
        if (isObject(stored) && stored.v === 2 && typeof stored.enc === 'string') {
          if (!key) throw new UnreadableDataError();
          const data: unknown = JSON.parse(await cipher.decryptText(stored.enc, key));
          if (!isSavedData(data)) throw new UnreadableDataError();
          return { data, plaintext: false };
        }
        if (!isSavedData(stored)) throw new UnreadableDataError();
        return { data: stored, plaintext: true };
      } catch {
        throw new UnreadableDataError();
      }
    },
    async saveData(userId: string, data: Data, key: string | null): Promise<void> {
      if (!key) throw new Error('ENCRYPTION_REQUIRED');
      const envelope = { v: 2, enc: await cipher.encryptText(JSON.stringify(data), key) };
      await storage.set(dataKey(userId), envelope);
    },
    deleteData: (userId: string): Promise<void> => storage.del(dataKey(userId)),
  };
}
