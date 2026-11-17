import type { SupabaseClient } from '@supabase/supabase-js';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { uid } from '../utils/ids';
import { cloudCacheName, encryptedCache } from './cache';
import { cacheAsset, readAsset } from './file-io';
import { createRemoteCore } from './remote-core';
import { createCloudTransport } from './transport';

/** Native bindings; all network/file coordination is covered by the native-free core tests. */
export function createRemote(client: SupabaseClient, userId: string, key: string) {
  const transport = createCloudTransport({
    url: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim(),
    publishableKey: (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim(),
    userId,
    getSession: async () => {
      const { data, error } = await client.auth.getSession();
      if (error?.name === 'AuthRetryableFetchError') throw new Error('CLOUD_OFFLINE');
      if (error || !data.session) return null;
      return { userId: data.session.user.id, accessToken: data.session.access_token };
    },
  });
  return createRemoteCore({
    userId, transport,
    indexStore: encryptedCache<Record<string, string>>(cloudCacheName('assets', userId), key),
    hash: (value) => digestStringAsync(CryptoDigestAlgorithm.SHA256, value),
    newId: uid,
    readAsset: (uri, document, encrypted) => readAsset(uri, document, encrypted, key),
    cacheAsset: (bytes, document, path) => cacheAsset(bytes, document, path, key),
    assetAvailable: async (uri) => {
      if (uri.startsWith('data:image/jpeg;base64,')) return true;
      if (Platform.OS !== 'web') return uri.startsWith('file:') && new File(uri).exists;
      if (!uri.startsWith('blob:')) return false;
      try {
        const response = await fetch(uri);
        void response.body?.cancel().catch(() => {});
        return response.ok;
      } catch { return false; }
    },
  });
}
