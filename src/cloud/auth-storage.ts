/** Stockage des sessions du SDK, séparé des comptes locaux et du relais. */
type JsonStorage = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
};
type KeyStorage = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
};
type Cipher = {
  generateKey(): Promise<string>;
  encryptText(text: string, key: string): Promise<string>;
  decryptText(text: string, key: string): Promise<string>;
};
export type AuthStorageProblem = 'unreadable' | 'write-failed' | null;
type Options = {
  namespace: string;
  durable: JsonStorage;
  keys: KeyStorage;
  cipher: Cipher;
  memoryOnly?: boolean;
  onError?: (problem: AuthStorageProblem) => void;
};

export class CloudAuthStorageError extends Error {
  constructor(readonly problem: Exclude<AuthStorageProblem, null>) {
    super(problem === 'unreadable' ? 'CLOUD_SESSION_UNREADABLE' : 'CLOUD_SESSION_WRITE_FAILED');
  }
}

/**
 * Seule la courte clé AES va dans le trousseau. Une session complète peut
 * dépasser les limites de SecureStore : son enveloppe chiffrée va dans kv.
 * Le web et « ne pas se souvenir » utilisent uniquement la mémoire.
 */
export function createAuthStorage({ namespace, durable, keys, cipher, memoryOnly = false, onError = () => {} }: Options) {
  const dataKey = `${namespace}.data`;
  const keyKey = `${namespace}.key`;
  const preferenceKey = `${namespace}.remember`;
  let initialized = false;
  let remember = true;
  let values = new Map<string, string>();
  let serial: Promise<void> = Promise.resolve();

  // Toutes les lectures et écritures sont ordonnées, même pendant une rotation du jeton.
  const run = <T>(action: () => Promise<T>): Promise<T> => {
    const result = serial.then(action);
    serial = result.then(() => {}, () => {});
    return result;
  };

  const initialize = async () => {
    if (initialized) return;
    if (memoryOnly) { initialized = true; return; }
    try {
      const choice = await durable.get<unknown>(preferenceKey);
      if (choice !== null && typeof choice !== 'boolean') throw new Error('Invalid preference');
      remember = choice ?? true;
      if (remember) {
        const saved = await durable.get<unknown>(dataKey);
        if (saved !== null) {
          if (typeof saved !== 'object' || Array.isArray(saved) || !('v' in saved) || saved.v !== 1 || !('enc' in saved) || typeof saved.enc !== 'string') throw new Error('Invalid envelope');
          const key = await keys.get(keyKey);
          if (!key) throw new Error('Missing key');
          const decoded: unknown = JSON.parse(await cipher.decryptText(saved.enc, key));
          if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded) || !Object.values(decoded).every((value) => typeof value === 'string')) throw new Error('Invalid items');
          values = new Map(Object.entries(decoded) as [string, string][]);
        }
      }
      initialized = true;
      onError(null);
    } catch {
      onError('unreadable');
      throw new CloudAuthStorageError('unreadable');
    }
  };

  const persist = async () => {
    if (memoryOnly || !remember) return;
    try {
      if (!values.size) {
        await durable.del(dataKey);
        await keys.del(keyKey);
      } else {
        let key = await keys.get(keyKey);
        if (!key) {
          key = await cipher.generateKey();
          await keys.set(keyKey, key);
        }
        const enc = await cipher.encryptText(JSON.stringify(Object.fromEntries(values)), key);
        await durable.set(dataKey, { v: 1, enc });
      }
      onError(null);
    } catch {
      onError('write-failed');
      throw new CloudAuthStorageError('write-failed');
    }
  };

  return {
    storage: {
      getItem: (key: string): Promise<string | null> => run(async () => {
        await initialize();
        return values.get(key) ?? null;
      }),
      setItem: (key: string, value: string): Promise<void> => run(async () => {
        await initialize();
        values.set(key, value);
        // Une panne d'écriture ne détruit pas le nouveau jeton en mémoire.
        await persist();
      }),
      removeItem: (key: string): Promise<void> => run(async () => {
        await initialize();
        values.delete(key);
        await persist();
      }),
    },
    setPersistence: (next: boolean): Promise<void> => run(async () => {
      await initialize();
      if (memoryOnly) { remember = next; return; }
      try {
        if (!next) {
          // Ne jamais annoncer une session non mémorisée si l'ancienne copie n'a pas été effacée.
          await durable.del(dataKey);
          await keys.del(keyKey);
          await durable.set(preferenceKey, false);
          remember = false;
        } else {
          remember = true;
          await persist();
          await durable.set(preferenceKey, true);
        }
        onError(null);
      } catch {
        onError('write-failed');
        throw new CloudAuthStorageError('write-failed');
      }
    }),
    persistenceEnabled: (): Promise<boolean> => run(async () => {
      await initialize();
      return remember;
    }),
    /** Effacement explicite de la session locale, même si sa copie est illisible. */
    clear: (): Promise<void> => run(async () => {
      try {
        if (!memoryOnly) {
          await durable.del(dataKey);
          await keys.del(keyKey);
          await durable.set(preferenceKey, remember);
        }
        values.clear();
        initialized = true;
        onError(null);
      } catch {
        onError('write-failed');
        throw new CloudAuthStorageError('write-failed');
      }
    }),
  };
}
