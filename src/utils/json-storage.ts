/** Une lecture en échec ne doit jamais être confondue avec une clé absente. */
export class StorageReadError extends Error {
  constructor() {
    super('STORAGE_UNREADABLE');
  }
}

export type StringStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export function createJsonStorage(storage: StringStorage) {
  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const raw = await storage.getItem(key);
        if (raw === null) return null;
        const value: unknown = JSON.parse(raw);
        if (value === null) throw new StorageReadError();
        return value as T;
      } catch {
        throw new StorageReadError();
      }
    },
    async set(key: string, value: unknown): Promise<void> {
      await storage.setItem(key, JSON.stringify(value));
    },
    del: (key: string): Promise<void> => storage.removeItem(key),
  };
}

/** Aperçu web : aucune donnée ni clé n'est écrite dans le navigateur. */
export function createMemoryStorage(): StringStorage {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  };
}
