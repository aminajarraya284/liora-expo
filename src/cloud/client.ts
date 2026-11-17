import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { decryptText, encryptText, generateKey } from '../security/crypto';
import { kv, secure } from '../utils/storage';
import { type AuthStorageProblem, createAuthStorage } from './auth-storage';

const rawUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const publishableKey = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const trial = (process.env.EXPO_PUBLIC_CLOUD_TRIAL ?? '').trim().toLowerCase() === 'true';

function configuration(): { url: string; tag: string; error: string | null } {
  if (!rawUrl && !publishableKey && !trial) return { url: '', tag: 'disabled', error: null };
  if (!trial) return { url: '', tag: 'disabled', error: 'La synchronisation est réservée au mode d’essai avec des données fictives.' };
  if (!rawUrl || !publishableKey) return { url: '', tag: 'disabled', error: 'Renseignez l’adresse Supabase et sa clé publique pour activer les comptes en ligne.' };
  let url: URL;
  try { url = new URL(rawUrl); } catch { return { url: '', tag: 'disabled', error: 'L’adresse Supabase doit être une adresse HTTPS valide.' }; }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    return { url: '', tag: 'disabled', error: 'L’adresse Supabase doit être une adresse HTTPS sans identifiants ni chemin.' };
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(publishableKey)) {
    return { url: '', tag: 'disabled', error: 'Utilisez uniquement une clé Supabase publique « sb_publishable_… ». Une clé secrète ne doit jamais être placée dans l’application.' };
  }
  return { url: url.origin, tag: url.host.replace(/[^a-zA-Z0-9.-]/g, '-'), error: null };
}

const config = configuration();

/** Le délai couvre aussi les appels Auth/Storage qui ne proposent pas de timeout propre. */
const boundedFetch: typeof fetch = async (input, init) => {
  const callerSignal = init?.signal ?? (typeof input === 'object' && input !== null && 'signal' in input ? input.signal : null);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (callerSignal?.aborted) abort();
  else callerSignal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 60_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abort);
  }
};

let storageProblem: AuthStorageProblem = null;
const authStorage = createAuthStorage({
  namespace: `liora.cloud.auth.${config.tag}`,
  durable: kv,
  keys: secure,
  cipher: { encryptText, decryptText, generateKey },
  memoryOnly: Platform.OS === 'web',
  onError: (problem) => { storageProblem = problem; },
});

let initializationError: string | null = null;
let client: SupabaseClient | null = null;
if (config.url && !config.error) {
  try {
    client = createClient(config.url, publishableKey, {
      global: { fetch: boundedFetch },
      auth: {
        storage: authStorage.storage,
        storageKey: `liora.cloud.auth.session.${config.tag}`,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    // Le SDK lance déjà initialize ; rattacher un rejet protège également les erreurs du stockage natif.
    void client.auth.initialize().catch(() => {});
  } catch {
    initializationError = 'Les comptes en ligne n’ont pas pu être initialisés. Vérifiez la configuration Supabase.';
  }
}

export const cloudClient = client;
export const cloudConfigurationError = config.error ?? initializationError;
export const cloudConfigured = cloudClient !== null;
export const setCloudPersistence = authStorage.setPersistence;
export const cloudPersistenceEnabled = authStorage.persistenceEnabled;
export const clearCloudSessionStorage = authStorage.clear;

/** Message sans jeton, adresse ou autre donnée de session. */
export function getCloudAuthStorageError(): string | null {
  if (storageProblem === 'unreadable') return 'La connexion mémorisée est illisible sur cet appareil. Sa copie existante a été conservée.';
  if (storageProblem === 'write-failed') return 'La connexion n’a pas pu être mémorisée de façon sécurisée sur cet appareil.';
  return null;
}

let bindings = 0;
let subscription: ReturnType<typeof AppState.addEventListener> | null = null;
let refreshWork: Promise<void> = Promise.resolve();
const refresh = (active: boolean) => {
  const auth = cloudClient?.auth;
  if (!auth) return;
  refreshWork = refreshWork.then(() => active ? auth.startAutoRefresh() : auth.stopAutoRefresh()).catch(() => {});
};

/** À appeler une fois depuis le provider ; le navigateur gère lui-même sa visibilité. */
export function bindCloudAppState(): () => void {
  if (!cloudClient || Platform.OS === 'web') return () => {};
  bindings += 1;
  if (bindings === 1) {
    refresh(AppState.currentState === 'active');
    subscription = AppState.addEventListener('change', (state) => refresh(state === 'active'));
  }
  let bound = true;
  return () => {
    if (!bound) return;
    bound = false;
    bindings -= 1;
    if (!bindings) {
      subscription?.remove();
      subscription = null;
      refresh(false);
    }
  };
}
