import * as Crypto from 'expo-crypto';

/** Identifiant unique d'un élément (proche, note, document…). */
export const uid = (): string => Crypto.randomUUID();
