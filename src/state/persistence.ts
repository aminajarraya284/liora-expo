import { decryptText, encryptText } from '../security/crypto';
import { kv } from '../utils/storage';
import { createDataStorage } from './data-storage';
export { UnreadableDataError, type Loaded } from './data-storage';
export { createSaver } from './saver';

/**
 * Enregistrement des données d'un compte.
 * Format actuel : { v: 2, enc: "<données chiffrées en base64>" }.
 * La première version enregistrait les données en clair : elles sont lues
 * une dernière fois, puis réécrites chiffrées.
 */

export const { loadData, saveData, deleteData } = createDataStorage(kv, { encryptText, decryptText });

