import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import { utf8Decode, utf8Encode } from './utf8';

/**
 * Chiffrement AES-256-GCM (chiffrement authentifié) : les données sont
 * illisibles sans la clé, et toute modification est détectée au déchiffrement.
 * Un vecteur d'initialisation aléatoire est tiré à chaque chiffrement.
 */

const imported = new Map<string, AESEncryptionKey>();

async function importKey(keyBase64: string): Promise<AESEncryptionKey> {
  const cached = imported.get(keyBase64);
  if (cached) return cached;
  const key = await AESEncryptionKey.import(keyBase64, 'base64');
  imported.set(keyBase64, key);
  return key;
}

/** Oublie les clés gardées en mémoire (à la déconnexion). */
export function forgetKeys(): void {
  imported.clear();
}

/** Nouvelle clé aléatoire de 256 bits, encodée en base64 pour être rangée dans le trousseau. */
export async function generateKey(): Promise<string> {
  const key = await AESEncryptionKey.generate(256);
  return key.encoded('base64');
}

/** Chiffre des octets. Le résultat contient le vecteur d'initialisation, le texte chiffré et le sceau. */
export async function encryptBytes(bytes: Uint8Array, keyBase64: string): Promise<Uint8Array> {
  const sealed = await aesEncryptAsync(bytes, await importKey(keyBase64));
  return sealed.combined();
}

export async function decryptBytes(combined: Uint8Array, keyBase64: string): Promise<Uint8Array> {
  return aesDecryptAsync(AESSealedData.fromCombined(combined), await importKey(keyBase64));
}

/** Chiffre un texte et renvoie le résultat en base64. */
export async function encryptText(text: string, keyBase64: string): Promise<string> {
  const sealed = await aesEncryptAsync(utf8Encode(text), await importKey(keyBase64));
  return sealed.combined('base64');
}

export async function decryptText(combinedBase64: string, keyBase64: string): Promise<string> {
  const bytes = await aesDecryptAsync(AESSealedData.fromCombined(combinedBase64), await importKey(keyBase64));
  return utf8Decode(bytes);
}

let selfTestResult: Promise<boolean> | null = null;

/**
 * Vérifie une fois, au démarrage, que le chiffrement fonctionne sur cet
 * appareil : on chiffre un texte, on le déchiffre, on compare.
 */
export function encryptionAvailable(): Promise<boolean> {
  selfTestResult ??= (async () => {
    try {
      const key = await generateKey();
      const sample = 'LIORA – vérification du chiffrement é€😀';
      const ok = (await decryptText(await encryptText(sample, key), key)) === sample;
      imported.delete(key);
      return ok;
    } catch {
      return false;
    }
  })();
  return selfTestResult;
}
