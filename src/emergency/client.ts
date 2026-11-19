import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytesAsync } from 'expo-crypto';
import { cloudClient } from '../cloud/client';
import { createCloudTransport } from '../cloud/transport';
import { toHex } from '../security/utf8';
import { uid } from '../utils/ids';
import { createEmergencyService } from './service';

export function emergencyClient(userId: string) {
  if (!cloudClient) throw new Error('Le service en ligne n’est pas encore configuré.');
  const client = cloudClient;
  return createEmergencyService({
    transport: createCloudTransport({
      url: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim(),
      publishableKey: (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim(),
      userId,
      getSession: async () => {
        const { data, error } = await client.auth.getSession();
        if (error || !data.session) return null;
        return { userId: data.session.user.id, accessToken: data.session.access_token };
      },
    }),
    newId: uid,
    randomCode: async () => toHex(await getRandomBytesAsync(16)),
    hash: (code) => digestStringAsync(CryptoDigestAlgorithm.SHA256, code),
  });
}
