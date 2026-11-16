import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as Crypto from 'expo-crypto';
import { constantTimeEqual, toHex, utf8Encode } from './utf8';

/**
 * Empreinte d'un mot de passe. Le mot de passe lui-même n'est jamais stocké.
 * - v2 : PBKDF2-HMAC-SHA256, sel aléatoire de 128 bits.
 * - v1 : ancien format (SHA-256 salé), accepté à la connexion puis remplacé.
 */
export type PasswordRecord =
  | { v: 2; salt: string; hash: string; iter: number }
  | { v: 1; salt: string; hash: string };

/**
 * Nombre d'itérations. Le calcul se fait en JavaScript sur le téléphone :
 * au-delà, la connexion prendrait plusieurs secondes. La valeur est stockée
 * avec chaque empreinte, on peut donc l'augmenter sans casser les comptes.
 */
export const PBKDF2_ITERATIONS = 20_000;

/** Même mot de passe quel que soit le clavier : « é » saisi en un ou deux caractères donne la même empreinte. */
const normalize = (password: string): string => {
  try {
    return password.normalize('NFKC');
  } catch {
    return password;
  }
};

const derive = async (password: string, salt: string, iter: number): Promise<string> =>
  toHex(await pbkdf2Async(sha256, utf8Encode(normalize(password)), utf8Encode(salt), { c: iter, dkLen: 32 }));

const legacyHash = (password: string, salt: string): Promise<string> =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);

export async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = toHex(Crypto.getRandomBytes(16));
  return { v: 2, salt, iter: PBKDF2_ITERATIONS, hash: await derive(password, salt, PBKDF2_ITERATIONS) };
}

export async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
  const hash = record.v === 2 ? await derive(password, record.salt, record.iter) : await legacyHash(password, record.salt);
  return constantTimeEqual(hash, record.hash);
}

/** Vrai si l'empreinte doit être recalculée avec les réglages actuels. */
export const needsRehash = (record: PasswordRecord): boolean => record.v !== 2 || record.iter < PBKDF2_ITERATIONS;
