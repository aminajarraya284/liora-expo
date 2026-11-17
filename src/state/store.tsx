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
import { bindCloudAppState, clearCloudSessionStorage, cloudClient, cloudConfigured, cloudConfigurationError, cloudPersistenceEnabled, getCloudAuthStorageError, setCloudPersistence } from '../cloud/client';
import { clearCloudIdentity, cloudIdentity, openCloudAccount, rememberedCloudIdentity, rememberCloudPassword, removeCloudLocal, verifyCloudPassword, type CloudIdentity } from '../cloud/account';
import type { SyncStatus } from '../cloud/sync-engine';

const K_SETTINGS = 'liora:settings';

const WRONG_CREDENTIALS = 'Adresse e-mail ou mot de passe incorrect.';
const UNREADABLE = 'Vos données n’ont pas pu être lues sur cet appareil. Contactez l’assistance LIORA.';
const SAVE_FAILED = 'Vos dernières modifications ne sont pas enregistrées. Gardez LIORA ouverte et réessayez.';
const ENCRYPTION_REQUIRED = 'Le chiffrement est indisponible sur cet appareil. L’ouverture du compte est bloquée pour protéger vos données.';

export type EncryptionStatus = 'active' | 'unavailable';

type Store = {
  /** Faux tant que les réglages et la session ne sont pas chargés. */
  ready: boolean;
  user: { id: string; email: string; mode?: 'local' | 'cloud' } | null;
  accountMode: 'local' | 'cloud';
  setAccountMode: (mode: 'local' | 'cloud') => void;
  cloudAvailable: boolean;
  cloudError: string | null;
  syncStatus: SyncStatus | null;
  syncNow: () => Promise<void>;
  resolveSyncConflict: (choice: 'local' | 'remote') => Promise<void>;
  confirmSignup: (email: string, code: string, password: string) => Promise<Result>;
  resetCloudPassword: (email: string, code: string, next: string) => Promise<Result>;
  resetCloudConnection: () => Promise<Result>;
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
  register: (firstName: string, email: string, password: string, trialAccepted?: boolean) => Promise<Result>;
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
  const [accountMode, setAccountModeState] = useState<'local' | 'cloud'>(cloudConfigured ? 'cloud' : 'local');
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const cloudRef = useRef<Awaited<ReturnType<typeof openCloudAccount>> | null>(null);
  const sessionVersion = useRef(0);
  const authBusy = useRef(false);
  const keyRef = useRef<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [saver] = useState(() => createSaver(
    (job: { userId: string; data: Data; key: string | null }) => saveData(job.userId, job.data, job.key),
    (failed) => setStorageError(failed ? SAVE_FAILED : null),
  ));

  const setAccountMode = useCallback((mode: 'local' | 'cloud') => {
    if (user || authBusy.current || (mode === 'cloud' && !cloudConfigured)) return;
    setAccountModeState(mode);
    void kv.set('liora:auth-mode', mode).catch(() => {});
  }, [user]);

  const openCloud = useCallback(async (identity: CloudIdentity, password: string | null, remember: boolean) => {
    const version = ++sessionVersion.current;
    const opened = await openCloudAccount(identity, password, remember, (record, status) => {
      if (sessionVersion.current !== version) return;
      setData(record.data);
      setSyncStatus(status);
      setStorageError(status.state === 'local-error' ? SAVE_FAILED : null);
    });
    if (sessionVersion.current !== version) { opened.remote.cancel(); await opened.engine.stop(); return; }
    try { await kv.set('liora:auth-mode', 'cloud'); }
    catch (error) { opened.remote.cancel(); await opened.engine.stop(); throw error; }
    if (sessionVersion.current !== version) { opened.remote.cancel(); await opened.engine.stop(); return; }
    cloudRef.current = opened;
    keyRef.current = opened.key;
    setData(opened.engine.snapshot.data);
    setSyncStatus(opened.engine.status);
    setStorageError(null);
    setAccountModeState('cloud');
    setUser({ id: identity.id, email: identity.email, mode: 'cloud' });
    opened.engine.update(rollDay);
    void opened.engine.sync();
  }, []);

  /** Ouvre la session d'un compte : récupère sa clé, déchiffre ses données. */
  const openSession = useCallback(async (account: Account, firstData?: Data) => {
    const version = ++sessionVersion.current;
    if (cloudRef.current) {
      await cloudRef.current.engine.flushLocal();
      cloudRef.current.remote.cancel();
      await cloudRef.current.engine.stop();
      cloudRef.current = null;
      setSyncStatus(null);
    }
    const canEncrypt = await encryptionAvailable();
    setEncryption(canEncrypt ? 'active' : 'unavailable');
    if (!canEncrypt) throw new Error(ENCRYPTION_REQUIRED);
    let key = await getDataKey(account.id);
    const loaded = firstData ? { data: firstData, plaintext: false } : await loadData(account.id, key);
    if (canEncrypt && !key) key = await createDataKey(account.id);
    const opened = rollDay({ ...emptyData('', account.email), ...loaded.data });
    // Tout nouveau compte, ou données de la première version : on écrit tout de suite la version chiffrée.
    if (firstData || (loaded.plaintext && key)) await saveData(account.id, opened, key);
    await kv.set('liora:auth-mode', 'local');
    if (sessionVersion.current !== version) return;
    keyRef.current = key;
    setStorageError(null);
    setData(opened);
    setUser({ id: account.id, email: account.email, mode: 'local' });
  }, []);

  const closeSession = useCallback(() => {
    sessionVersion.current += 1;
    cloudRef.current?.remote.cancel();
    void cloudRef.current?.engine.stop().catch(() => {});
    cloudRef.current = null;
    setSyncStatus(null);
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
        const mode = await kv.get<string>('liora:auth-mode');
        if (cloudConfigured && (mode === 'cloud' || (!mode && !email))) {
          setAccountModeState('cloud');
          const savedCloud = await rememberedCloudIdentity();
          const response = await cloudClient!.auth.getSession();
          const identity = response.data.session ? cloudIdentity(response.data.session.user)
            : response.error?.name === 'AuthRetryableFetchError' ? savedCloud : null;
          if (identity) await openCloud(identity, null, await cloudPersistenceEnabled());
          return;
        }
        setAccountModeState('local');
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
  }, [openSession, openCloud]);

  useEffect(() => bindCloudAppState(), []);

  useEffect(() => {
    if (user?.mode !== 'cloud') return;
    const engine = cloudRef.current?.engine;
    const timer = setTimeout(() => void engine?.sync(), 1000);
    return () => clearTimeout(timer);
  }, [data, user]);

  useEffect(() => {
    if (user?.mode !== 'cloud') return;
    const retry = () => { if (AppState.currentState === 'active') void cloudRef.current?.engine.sync(); };
    const timer = setInterval(retry, 30_000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') { cloudRef.current?.engine.update(rollDay); retry(); } });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [user]);

  // Réglage « Réduire les animations » du téléphone.
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setOsReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOsReduceMotion);
    return () => sub.remove();
  }, []);

  // Au retour dans l'application, on vérifie si la journée a changé.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !cloudRef.current) setData((d) => rollDay(d));
      void saver.flush().catch(() => {}); // L'échec reste affiché par le saver.
    });
    return () => sub.remove();
  }, [saver]);

  // Sauvegarde automatique à chaque modification.
  useEffect(() => {
    if (user && user.mode !== 'cloud') saver.schedule({ userId: user.id, data, key: keyRef.current });
  }, [data, user, saver]);

  const update = useCallback((fn: (d: Data) => Data) => {
    if (cloudRef.current) cloudRef.current.engine.update((d) => fn(rollDay(d)));
    else setData((d) => fn(rollDay(d)));
  }, []);

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
    if (authBusy.current) return { ok: false, error: 'Une connexion est déjà en cours.' };
    authBusy.current = true;
    try {
      if (accountMode === 'cloud') {
        if (!cloudClient) return { ok: false, error: 'Les comptes en ligne ne sont pas configurés.' };
        await setCloudPersistence(remember);
        const response = await cloudClient.auth.signInWithPassword({ email, password });
        if (response.error || !response.data.user) return { ok: false, error: 'Connexion impossible. Vérifiez vos identifiants, la confirmation de votre e-mail et votre accès à Internet.' };
        await openCloud(cloudIdentity(response.data.user), password, remember);
        return { ok: true };
      }
      const auth = await authenticate(email, password);
      if ('error' in auth) return { ok: false, error: auth.error };
      if (remember) await setSessionEmail(email);
      else await clearSession();
      await openSession(auth.account);
    } catch (e) {
      return { ok: false, error: e instanceof UnreadableDataError ? UNREADABLE : e instanceof Error && e.message === ENCRYPTION_REQUIRED ? ENCRYPTION_REQUIRED : 'La connexion a échoué. Veuillez réessayer.' };
    } finally { authBusy.current = false; }
    return { ok: true };
  }, [authenticate, openSession, accountMode, openCloud]);

  const register: Store['register'] = useCallback(async (firstNameRaw, emailRaw, password, trialAccepted = false) => {
    const firstName = firstNameRaw.trim();
    const email = normEmail(emailRaw);
    if (!firstName) return { ok: false, error: 'Veuillez saisir votre prénom.' };
    if (firstName.length > 40) return { ok: false, error: 'Ce prénom est trop long.' };
    if (!isEmail(email)) return { ok: false, error: 'Veuillez saisir une adresse e-mail valide.' };
    const pwError = passwordError(password);
    if (pwError) return { ok: false, error: `Mot de passe trop faible. ${pwError}` };
    if (authBusy.current) return { ok: false, error: 'Une connexion est déjà en cours.' };
    authBusy.current = true;
    let account: Account | null = null;
    try {
      if (!(await encryptionAvailable())) return { ok: false, error: ENCRYPTION_REQUIRED };
      if (accountMode === 'cloud') {
        if (!trialAccepted) return { ok: false, error: 'Cet essai est réservé aux données fictives. Confirmez votre accord.' };
        if (!cloudClient) return { ok: false, error: 'Les comptes en ligne ne sont pas configurés.' };
        await setCloudPersistence(true);
        const response = await cloudClient.auth.signUp({ email, password, options: { data: { first_name: firstName } } });
        if (response.error || !response.data.user) return { ok: false, error: 'Le compte en ligne n’a pas pu être créé. Vérifiez votre connexion ou réessayez plus tard.' };
        if (!response.data.session) return { ok: true, message: 'Confirmez votre adresse avec le code reçu par e-mail.' };
        await openCloud(cloudIdentity(response.data.user), password, true);
        return { ok: true };
      }
      if (await getAccount(email)) return { ok: false, error: 'Un compte existe déjà avec cette adresse e-mail.' };
      account = { id: uid(), email, password: await hashPassword(password) };
      await saveAccount(account);
      await setSessionEmail(email);
      await openSession(account, initialData(firstName, email));
    } catch {
      if (account) await removeAccount(account).catch(() => {});
      return { ok: false, error: 'Le compte n’a pas pu être créé. Veuillez réessayer.' };
    } finally { authBusy.current = false; }
    return { ok: true };
  }, [openSession, accountMode, openCloud]);

  const confirmSignup: Store['confirmSignup'] = useCallback(async (email, code, password) => {
    if (!cloudClient || !/^\d{6,8}$/.test(code.trim())) return { ok: false, error: 'Saisissez le code reçu par e-mail.' };
    if (authBusy.current) return { ok: false, error: 'Une connexion est déjà en cours.' };
    authBusy.current = true;
    try {
      const response = await cloudClient.auth.verifyOtp({ email: normEmail(email), token: code.trim(), type: 'signup' });
      if (response.error || !response.data.user || !response.data.session) return { ok: false, error: 'Le code est incorrect ou expiré.' };
      await openCloud(cloudIdentity(response.data.user), password, true);
      return { ok: true };
    } catch { return { ok: false, error: 'La confirmation n’a pas pu être terminée. Réessayez de vous connecter.' }; }
    finally { authBusy.current = false; }
  }, [openCloud]);

  const resetCloudPassword: Store['resetCloudPassword'] = useCallback(async (email, code, next) => {
    const invalid = passwordError(next);
    if (invalid) return { ok: false, error: invalid };
    if (!cloudClient || !/^\d{6,8}$/.test(code.trim())) return { ok: false, error: 'Saisissez le code reçu par e-mail.' };
    if (authBusy.current) return { ok: false, error: 'Une connexion est déjà en cours.' };
    authBusy.current = true;
    try {
      const verified = await cloudClient.auth.verifyOtp({ email: normEmail(email), token: code.trim(), type: 'recovery' });
      if (verified.error || !verified.data.user) return { ok: false, error: 'Le code est incorrect ou expiré.' };
      const changed = await cloudClient.auth.updateUser({ password: next });
      if (changed.error) return { ok: false, error: 'Le mot de passe n’a pas pu être modifié. Réessayez.' };
      try {
        await rememberCloudPassword(verified.data.user.id, next);
        await cloudClient.auth.signOut({ scope: 'local' });
        await clearCloudSessionStorage();
        await clearCloudIdentity();
      } catch { setStorageError('Le mot de passe a été modifié en ligne. Reconnectez-vous avec le nouveau mot de passe pour actualiser cet appareil.'); }
      return { ok: true, message: 'Mot de passe modifié. Reconnectez-vous avec le nouveau mot de passe.' };
    } catch { return { ok: false, error: 'Vérifiez votre connexion et réessayez.' }; }
    finally { authBusy.current = false; }
  }, []);

  const syncNow = useCallback(async () => { await cloudRef.current?.engine.sync(); }, []);
  const resolveSyncConflict = useCallback(async (choice: 'local' | 'remote') => { await cloudRef.current?.engine.resolveConflict(choice); }, []);
  const resetCloudConnection = useCallback(async (): Promise<Result> => {
    if (user) return { ok: false, error: 'Déconnectez-vous avant de réinitialiser la connexion.' };
    try {
      await cloudClient?.auth.stopAutoRefresh();
      await clearCloudSessionStorage();
      await clearCloudIdentity();
      return { ok: true, message: 'Connexion mémorisée effacée. Fermez puis rouvrez LIORA avant de vous reconnecter. Les données chiffrées de vos comptes sont conservées.' };
    } catch { return { ok: false, error: 'La connexion mémorisée n’a pas pu être effacée. Réessayez lorsque le stockage du téléphone est disponible.' }; }
  }, [user]);

  const retrySave = useCallback(async () => {
    if (cloudRef.current) {
      try { await cloudRef.current.engine.flushLocal(); await cloudRef.current.engine.sync(); } catch { setStorageError(SAVE_FAILED); }
      return;
    }
    await saver.flush().catch(() => {});
  }, [saver]);

  const logout: Store['logout'] = useCallback(async () => {
    try {
      if (cloudRef.current) {
        await cloudRef.current.engine.flushLocal();
        cloudRef.current.remote.cancel();
        await cloudRef.current.engine.stop();
        // The encrypted offline copy is kept for the next login to this same account.
        await cloudClient?.auth.signOut({ scope: 'local' }).catch(() => {});
        await clearCloudSessionStorage();
        await clearCloudIdentity();
      }
      await saver.flush();
      await clearSession();
      closeSession();
      return { ok: true };
    } catch {
      const opened = cloudRef.current;
      if (opened?.engine.status.state === 'stopped') {
        try { await openCloud(opened.identity, null, await cloudPersistenceEnabled()); } catch { closeSession(); }
      }
      return { ok: false, error: 'Déconnexion interrompue : vos dernières informations n’ont pas pu être enregistrées. Réessayez.' };
    }
  }, [saver, closeSession, openCloud]);

  const checkPassword: Store['checkPassword'] = useCallback(async (password) => {
    if (!user) return { ok: false, error: 'Vous n’êtes pas connecté.' };
    if (user.mode === 'cloud') {
      try {
        const wait = await lockRemaining(`cloud:${user.id}`);
        if (wait > 0) return { ok: false, error: lockMessage(wait) };
        if (!(await verifyCloudPassword(user.id, password))) {
          await recordFailure(`cloud:${user.id}`);
          return { ok: false, error: 'Mot de passe incorrect, ou première connexion en ligne nécessaire sur cet appareil.' };
        }
        await clearFailures(`cloud:${user.id}`);
        return { ok: true };
      } catch { return { ok: false, error: 'Vérification impossible sur cet appareil.' }; }
    }
    const auth = await authenticate(user.email, password);
    return 'error' in auth ? { ok: false, error: auth.error === WRONG_CREDENTIALS ? 'Mot de passe incorrect.' : auth.error } : { ok: true };
  }, [user, authenticate]);

  const changePassword: Store['changePassword'] = useCallback(async (current, next) => {
    if (!user) return { ok: false, error: 'Vous n’êtes pas connecté.' };
    const pwError = passwordError(next);
    if (pwError) return { ok: false, error: pwError };
    if (user.mode === 'cloud') {
      try {
        const response = await cloudClient!.auth.signInWithPassword({ email: user.email, password: current });
        if (response.error || response.data.user?.id !== user.id) return { ok: false, error: 'Le mot de passe actuel est incorrect ou le serveur est injoignable.' };
        const changed = await cloudClient!.auth.updateUser({ password: next });
        if (changed.error) return { ok: false, error: 'Modification impossible. Réessayez en ligne.' };
        try { await rememberCloudPassword(user.id, next); }
        catch {
          setStorageError('Mot de passe modifié en ligne. Reconnectez-vous avec le nouveau mot de passe pour actualiser le verrou local.');
          return { ok: true, message: 'Mot de passe modifié en ligne. Reconnectez-vous avec le nouveau mot de passe.' };
        }
        return { ok: true };
      } catch { return { ok: false, error: 'Modification impossible. Vérifiez votre connexion.' }; }
    }
    const auth = await authenticate(user.email, current);
    if ('error' in auth) return { ok: false, error: auth.error === WRONG_CREDENTIALS ? 'Le mot de passe actuel est incorrect.' : auth.error };
    await saveAccount({ ...auth.account, password: await hashPassword(next) });
    return { ok: true };
  }, [user, authenticate]);

  const deleteAccount: Store['deleteAccount'] = useCallback(async (password) => {
    if (!user) return { ok: false, error: 'Vous n’êtes pas connecté.' };
    if (user.mode === 'cloud') {
      const opened = cloudRef.current;
      if (!opened || !cloudClient) return { ok: false, error: 'Reconnectez-vous avant de supprimer ce compte.' };
      let remoteDeleted = false;
      try {
        await opened.engine.flushLocal();
        opened.remote.cancel();
        await opened.engine.stop();
        const response = await cloudClient.functions.invoke('delete-account', { body: { password } });
        if (response.error || !response.data?.ok) throw new Error('CLOUD_DELETE_FAILED');
        remoteDeleted = true;
        const files = ownedFiles(opened.engine.snapshot.data);
        files.photos.forEach(removeFile);
        files.documents.forEach(deleteDocument);
        await removeCloudLocal(opened.identity, opened.key);
        await cloudClient.auth.signOut({ scope: 'local' }).catch(() => {});
        await clearCloudSessionStorage();
        closeSession();
        return { ok: true };
      } catch {
        if (remoteDeleted) {
          closeSession();
          setStorageError('Le compte en ligne a été supprimé. Le nettoyage de certaines copies locales a échoué sur cet appareil.');
          return { ok: true, message: 'Compte en ligne supprimé ; nettoyage local incomplet.' };
        }
        if (opened.engine.status.state === 'stopped') {
          try { await openCloud(opened.identity, null, await cloudPersistenceEnabled()); } catch { closeSession(); }
        }
        return { ok: false, error: 'La suppression n’a pas pu être terminée. Vos données locales sont conservées. Réessayez en ligne.' };
      }
    }
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
  }, [user, data, authenticate, saver, closeSession, openCloud]);

  const value = useMemo<Store>(
    () => ({
      ready, user, data, settings, encryption, storageError, retrySave,
      accountMode, setAccountMode, cloudAvailable: cloudConfigured, cloudError: cloudConfigurationError ?? getCloudAuthStorageError(),
      syncStatus, syncNow, resolveSyncConflict, confirmSignup, resetCloudPassword, resetCloudConnection,
      reduceMotion: settings.reduceMotion || osReduceMotion,
      setSettings, update, login, register, logout, changePassword, deleteAccount, checkPassword,
      getDataKey: () => keyRef.current,
    }),
    [ready, user, data, settings, encryption, storageError, retrySave, accountMode, setAccountMode, syncStatus, syncNow, resolveSyncConflict, confirmSignup, resetCloudPassword, resetCloudConnection, osReduceMotion, setSettings, update, login, register, logout, changePassword, deleteAccount, checkPassword],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
