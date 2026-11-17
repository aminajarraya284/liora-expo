import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createJsonStorage, createMemoryStorage } from './json-storage';
import { createFileBackedStorage } from './file-backed-storage';
import { createStorageFiles } from './storage-files';

/** Stockage simple (non chiffré par l'application) de valeurs JSON. */
const previewStorage = createMemoryStorage();
export const kv = createJsonStorage(Platform.OS === 'web'
  ? previewStorage
  : createFileBackedStorage(AsyncStorage, createStorageFiles()));

/**
 * Les secrets ne quittent pas l'appareil : ils ne sont lisibles que lorsque
 * le téléphone est déverrouillé et ne sont pas repris dans les sauvegardes.
 */
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * Trousseau du système (Keychain sur iOS, Keystore sur Android).
 * Sur le web, les secrets restent uniquement en mémoire jusqu'au rechargement.
 */
export const secure = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return previewStorage.getItem(key);
    return SecureStore.getItemAsync(key, SECURE_OPTIONS);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return previewStorage.setItem(key, value);
    return SecureStore.setItemAsync(key, value, SECURE_OPTIONS);
  },
  async del(key: string): Promise<void> {
    if (Platform.OS === 'web') return previewStorage.removeItem(key);
    return SecureStore.deleteItemAsync(key, SECURE_OPTIONS);
  },
  async getJSON<T>(key: string): Promise<T | null> {
    return createJsonStorage({ getItem: secure.get, setItem: secure.set, removeItem: secure.del }).get<T>(key);
  },
  async setJSON(key: string, value: unknown): Promise<void> {
    await secure.set(key, JSON.stringify(value));
  },
};
