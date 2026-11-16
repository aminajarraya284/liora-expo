import * as Crypto from 'expo-crypto';
import { generateKey } from '../security/crypto';
import type { PasswordRecord } from '../security/passwords';
import { kv, secure } from '../utils/storage';

/**
 * Registre des comptes de l'appareil. Tout est rangé dans le trousseau du
 * système : empreinte du mot de passe, clé de chiffrement des données et
 * compteur de tentatives.
 */

export type Account = { id: string; email: string; password: PasswordRecord };

const SESSION = 'liora.session';
const LEGACY_ACCOUNTS = 'liora:accounts';

export const normEmail = (email: string): string => email.trim().toLowerCase();

/** Les clés du trousseau n'acceptent pas « @ » : on utilise une empreinte de l'adresse. */
const emailTag = async (email: string): Promise<string> =>
  (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normEmail(email))).slice(0, 40);

const accountKey = async (email: string) => `liora.compte.${await emailTag(email)}`;
const throttleKey = async (email: string) => `liora.essais.${await emailTag(email)}`;
const dataKeyName = (userId: string) => `liora.cle.${userId}`;

export const getAccount = async (email: string): Promise<Account | null> => secure.getJSON<Account>(await accountKey(email));
export const saveAccount = async (account: Account): Promise<void> => secure.setJSON(await accountKey(account.email), account);

export async function removeAccount(account: Account): Promise<void> {
  await secure.del(await accountKey(account.email));
  await secure.del(await throttleKey(account.email));
  await secure.del(dataKeyName(account.id));
}

/* ---------- Session ---------- */
export const getSessionEmail = (): Promise<string | null> => secure.get(SESSION);
export const setSessionEmail = (email: string): Promise<void> => secure.set(SESSION, email);
export const clearSession = (): Promise<void> => secure.del(SESSION);

/* ---------- Clé de chiffrement des données ---------- */
export async function getDataKey(userId: string): Promise<string | null> {
  return secure.get(dataKeyName(userId));
}

export async function createDataKey(userId: string): Promise<string> {
  const key = await generateKey();
  await secure.set(dataKeyName(userId), key);
  return key;
}

/* ---------- Limitation des tentatives ---------- */
type Throttle = { fails: number; until: number };

const FREE_ATTEMPTS = 5;
const LOCK_SECONDS = [30, 60, 120, 300, 900];

/** Nombre de secondes à attendre avant un nouvel essai (0 si l'essai est permis). */
export async function lockRemaining(email: string): Promise<number> {
  const t = await secure.getJSON<Throttle>(await throttleKey(email));
  if (!t) return 0;
  return Math.max(0, Math.ceil((t.until - Date.now()) / 1000));
}

/** Enregistre un échec. Après cinq échecs, chaque nouvel échec bloque de plus en plus longtemps. */
export async function recordFailure(email: string): Promise<void> {
  const key = await throttleKey(email);
  const fails = ((await secure.getJSON<Throttle>(key))?.fails ?? 0) + 1;
  const over = fails - FREE_ATTEMPTS;
  const lock = over >= 0 ? LOCK_SECONDS[Math.min(over, LOCK_SECONDS.length - 1)] : 0;
  await secure.setJSON(key, { fails, until: Date.now() + lock * 1000 } satisfies Throttle);
}

export const clearFailures = async (email: string): Promise<void> => secure.del(await throttleKey(email));

export const lockMessage = (seconds: number): string =>
  seconds >= 60
    ? `Trop de tentatives. Réessayez dans ${Math.ceil(seconds / 60)} minute${seconds >= 120 ? 's' : ''}.`
    : `Trop de tentatives. Réessayez dans ${seconds} secondes.`;

/* ---------- Reprise des comptes créés avec la première version ---------- */
type LegacyAccounts = Record<string, { id: string; salt: string; hash: string }>;

/**
 * La première version rangeait les comptes dans le stockage ordinaire.
 * On les déplace dans le trousseau, puis on efface l'ancien emplacement.
 * L'empreinte est remplacée par le nouveau format à la prochaine connexion.
 */
export async function migrateLegacyAccounts(): Promise<void> {
  const legacy = await kv.get<LegacyAccounts>(LEGACY_ACCOUNTS);
  if (!legacy) return;
  for (const [email, old] of Object.entries(legacy)) {
    if (!(await getAccount(email))) {
      await saveAccount({ id: old.id, email: normEmail(email), password: { v: 1, salt: old.salt, hash: old.hash } });
    }
  }
  await kv.del(LEGACY_ACCOUNTS);
}
