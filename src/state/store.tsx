import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { encryptionAvailable, forgetKeys } from '../security/crypto';
import { hashPassword, needsRehash, verifyPassword } from '../security/passwords';
import { deleteDocument } from '../security/vault-files';
import { removeFile } from '../utils/files';
import { uid } from '../utils/ids';
import { kv } from '../utils/storage';
import { isEmail, passwordError } from '../utils/validation';
import {
  type Account, clearFailures, clearSession, createDataKey, getAccount, getDataKey, getSessionEmail, lockMessage, lockRemaining,
  migrateLegacyAccounts, normEmail, recordFailure, removeAccount, saveAccount, setSessionEmail,
} from './accounts';
import { createSaver, deleteData, loadData, saveData, UnreadableDataError } from './persistence';
import { emptyData, initialData, rollDay } from './seed';
import { type Data, DEFAULT_SETTINGS, type Result, type Settings } from './types';

const K_SETTINGS = 'liora:settings';

const WRONG_CREDENTIALS = 'Adresse e-mail ou mot de passe incorrect.';
const UNREADABLE = 'Vos données n’ont pas pu être lues sur cet appareil. Contactez l’assistance LIORA.';
const SAVE_FAILED = 'Vos dernières modifications ne sont pas enregistrées. Gardez LIORA ouverte et réessayez.';
const ENCRYPTION_REQUIRED = 'Le chiffrement est indisponible sur cet appareil. L’ouverture du compte est bloquée pour protéger vos données.';

export type EncryptionStatus = 'active' | 'unavailable';

type Store = {
  /** Faux tant que les réglages et la session ne sont pas chargés. */
  ready: boolean;
  user: { id: string; email: string } | null;
  data: Data;
  settings: Settings;
  /** Vrai si les animations doivent être réduites (réglage de l'application ou du téléphone). */
  reduceMotion: boolean;
  encryption: EncryptionStatus;
  storageError: string | null;
  retrySave: () => Promise<void>;
  setSettings: (patch: Partial<Settings>) => void;
  update: (fn: (d: Data) => Data) => void;
  login: (email: string, password: string, remember: boolean) => Promise<Result>;
  register: (firstName: string, email: string, password: string) => Promise<Result>;
  logout: () => Promise<Result>;
  changePassword: (current: string, next: string) => Promise<Result>;
  deleteAccount: (password: string) => Promise<Result>;
  /** Vérifie le mot de passe du compte connecté (déverrouillage du coffre-fort). */
  checkPassword: (password: string) => Promise<Result>;
  /** Clé de chiffrement du compte connecté, ou null si le chiffrement est indisponible. */
  getDataKey: () => string | null;
};

const Ctx = createContext<Store>(null as unknown as Store);
export const useStore = () => useContext(Ctx);

/** Tous les fichiers appartenant à un compte (photos et documents). */
function ownedFiles(data: Data): { photos: string[]; documents: string[] } {
  const photos = [data.profile.photo, ...data.proches.map((p) => p.photo), ...data.notes.map((n) => n.photo), ...data.day.meals.map((m) => m.photo)];
  return {
    photos: photos.filter((p): p is string => !!p && !p.startsWith('seed:')),
    documents: data.docs.map((d) => d.uri).filter((u): u is string => !!u),
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Store['user']>(null);
  const [data, setData] = useState<Data>(() => emptyData('', ''));
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [osReduceMotion, setOsReduceMotion] = useState(false);
  const [encryption, setEncryption] = useState<EncryptionStatus>('active');
  const keyRef = useRef<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [saver] = useState(() => createSaver(
    (job: { userId: string; data: Data; key: string | null }) => saveData(job.userId, job.data, job.key),
    (failed) => setStorageError(failed ? SAVE_FAILED : null),
  ));

  /** Ouvre la session d'un compte : récupère sa clé, déchiffre ses données. */
  const openSession = useCallback(async (account: Account, firstData?: Data) => {
    const canEncrypt = await encryptionAvailable();
    setEncryption(canEncrypt ? 'active' : 'unavailable');
    if (!canEncrypt) throw new Error(ENCRYPTION_REQUIRED);
    let key = await getDataKey(account.id);
    const loaded = firstData ? { data: firstData, plaintext: false } : await loadData(account.id, key);
    if (canEncrypt && !key) key = await createDataKey(account.id);
    const opened = rollDay({ ...emptyData('', account.email), ...loaded.data });
    // Tout nouveau compte, ou données de la première version : on écrit tout de suite la version chiffrée.
    if (firstData || (loaded.plaintext && key)) await saveData(account.id, opened, key);
    keyRef.current = key;
    setStorageError(null);
    setData(opened);
    setUser({ id: account.id, email: account.email });
  }, []);

  const closeSession = useCallback(() => {
    keyRef.current = null;
    forgetKeys();
    setUser(null);
    setData(emptyData('', ''));
  }, []);

  // Démarrage : réglages, reprise des anciens comptes, session mémorisée.
  useEffect(() => {
    (async () => {
      try {
        const stored = await kv.get<Partial<Settings>>(K_SETTINGS);
        if (stored) setSettingsState({ ...DEFAULT_SETTINGS, ...stored });
        setEncryption((await encryptionAvailable()) ? 'active' : 'unavailable');
        await migrateLegacyAccounts();
        const email = await getSessionEmail();
        const account = email ? await getAccount(email) : null;
        if (account) await openSession(account);
        else if (email) await clearSession();
      } catch {
        // Session illisible : on revient à l'écran de connexion sans rien effacer.
        setStorageError('Impossible de lire le stockage. Vos données existantes sont conservées. Réessayez de vous connecter.');
      } finally {
        setReady(true);
      }
    })();
  }, [openSession]);

  // Réglage « Réduire les animations » du téléphone.
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setOsReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOsReduceMotion);
    return () => sub.remove();
  }, []);

  // Au retour dans l'application, on vérifie si la journée a changé.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setData((d) => rollDay(d));
      void saver.flush().catch(() => {}); // L'échec reste affiché par le saver.
    });
    return () => sub.remove();
  }, [saver]);

  // Sauvegarde automatique à chaque modification.
  useEffect(() => {
    if (user) saver.schedule({ userId: user.id, data, key: keyRef.current });
  }, [data, user, saver]);

  const update = useCallback((fn: (d: Data) => Data) => setData((d) => fn(rollDay(d))), []);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((current) => {
      const next = { ...current, ...patch };
      kv.set(K_SETTINGS, next).catch(() => {});
      return next;
    });
  }, []);

  /** Vérifie un mot de passe en respectant la limitation des tentatives. */
  const authenticate = useCallback(async (email: string, password: string): Promise<{ account: Account } | { error: string }> => {
    const wait = await lockRemaining(email);
    if (wait > 0) return { error: lockMessage(wait) };
    const account = await getAccount(email);
    if (!account || !(await verifyPassword(password, account.password))) {
      await recordFailure(email);
      const locked = await lockRemaining(email);
      return { error: locked > 0 ? lockMessage(locked) : WRONG_CREDENTIALS };
    }
    await clearFailures(email);
    if (needsRehash(account.password)) {
      account.password = await hashPassword(password);
      await saveAccount(account);
    }
    return { account };
  }, []);

  const login: Store['login'] = useCallback(async (emailRaw, password, remember) => {
    const email = normEmail(emailRaw);
    if (!isEmail(email)) return { ok: false, error: 'Veuillez saisir une adresse e-mail valide.' };
    if (!password) return { ok: false, error: 'Veuillez saisir votre mot de passe.' };
    try {
      const auth = await authenticate(email, password);
      if ('error' in auth) return { ok: false, error: auth.error };
      if (remember) await setSessionEmail(email);
      else await clearSession();
      await openSession(auth.account);
    } catch (e) {
      return { ok: false, error: e instanceof UnreadableDataError ? UNREADABLE : e instanceof Error && e.message === ENCRYPTION_REQUIRED ? ENCRYPTION_REQUIRED : 'La connexion a échoué. Veuillez réessayer.' };
    }
    return { ok: true };
  }, [authenticate, openSession]);

  const register: Store['register'] = useCallback(async (firstNameRaw, emailRaw, password) => {
    const firstName = firstNameRaw.trim();
    const email = normEmail(emailRaw);
    if (!firstName) return { ok: false, error: 'Veuillez saisir votre prénom.' };
    if (firstName.length > 40) return { ok: false, error: 'Ce prénom est trop long.' };
    if (!isEmail(email)) return { ok: false, error: 'Veuillez saisir une adresse e-mail valide.' };
    const pwError = passwordError(password);
    if (pwError) return { ok: false, error: `Mot de passe trop faible. ${pwError}` };
    let account: Account | null = null;
    try {
      if (!(await encryptionAvailable())) return { ok: false, error: ENCRYPTION_REQUIRED };
      if (await getAccount(email)) return { ok: false, error: 'Un compte existe déjà avec cette adresse e-mail.' };
      account = { id: uid(), email, password: await hashPassword(password) };
      await saveAccount(account);
      await setSessionEmail(email);
      await openSession(account, initialData(firstName, email));
    } catch {
      if (account) await removeAccount(account).catch(() => {});
      return { ok: false, error: 'Le compte n’a pas pu être créé. Veuillez réessayer.' };
    }
    return { ok: true };
  }, [openSession]);

  const retrySave = useCallback(async () => {
    await saver.flush().catch(() => {});
  }, [saver]);

  const logout: Store['logout'] = useCallback(async () => {
    try {
      await saver.flush();
      await clearSession();
      closeSession();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Déconnexion interrompue : vos dernières informations n’ont pas pu être enregistrées. Réessayez.' };
    }
  }, [saver, closeSession]);

  const checkPassword: Store['checkPassword'] = useCallback(async (password) => {
    if (!user) return { ok: false, error: 'Vous n’êtes pas connecté.' };
    const auth = await authenticate(user.email, password);
    return 'error' in auth ? { ok: false, error: auth.error === WRONG_CREDENTIALS ? 'Mot de passe incorrect.' : auth.error } : { ok: true };
  }, [user, authenticate]);

  const changePassword: Store['changePassword'] = useCallback(async (current, next) => {
    if (!user) return { ok: false, error: 'Vous n’êtes pas connecté.' };
    const pwError = passwordError(next);
    if (pwError) return { ok: false, error: pwError };
    const auth = await authenticate(user.email, current);
    if ('error' in auth) return { ok: false, error: auth.error === WRONG_CREDENTIALS ? 'Le mot de passe actuel est incorrect.' : auth.error };
    await saveAccount({ ...auth.account, password: await hashPassword(next) });
    return { ok: true };
  }, [user, authenticate]);

  const deleteAccount: Store['deleteAccount'] = useCallback(async (password) => {
    if (!user) return { ok: false, error: 'Vous n’êtes pas connecté.' };
    const auth = await authenticate(user.email, password);
    if ('error' in auth) return { ok: false, error: auth.error === WRONG_CREDENTIALS ? 'Mot de passe incorrect.' : auth.error };
    // On efface tout ce qui appartient au compte : fichiers, données, clé et empreinte.
    saver.cancel();
    await saver.flush();
    const files = ownedFiles(data);
    files.photos.forEach(removeFile);
    files.documents.forEach(deleteDocument);
    await deleteData(user.id);
    await removeAccount(auth.account);
    await clearSession();
    closeSession();
    return { ok: true };
  }, [user, data, authenticate, saver, closeSession]);

  const value = useMemo<Store>(
    () => ({
      ready, user, data, settings, encryption, storageError, retrySave,
      reduceMotion: settings.reduceMotion || osReduceMotion,
      setSettings, update, login, register, logout, changePassword, deleteAccount, checkPassword,
      getDataKey: () => keyRef.current,
    }),
    [ready, user, data, settings, encryption, storageError, retrySave, osReduceMotion, setSettings, update, login, register, logout, changePassword, deleteAccount, checkPassword],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
