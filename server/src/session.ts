import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Sessions d'appareil.
 *
 * L'application contient un jeton commun à tous les téléphones : il peut être
 * extrait du paquet de l'application, il ne sert donc qu'à demander une
 * session. Chaque appareil reçoit ensuite son propre jeton, signé par le
 * serveur avec un secret qui ne quitte jamais celui-ci. On peut ainsi limiter
 * et bloquer un appareil sans toucher aux autres, et sans base de données :
 * le serveur ne garde aucune information sur les personnes.
 */

const DEVICE_ID = /^[a-f0-9]{32,64}$/;
const VERSION = 'v1';

export const isDeviceId = (value: unknown): value is string => typeof value === 'string' && DEVICE_ID.test(value);

const sign = (secret: string, payload: string) => createHmac('sha256', secret).update(`${VERSION}.${payload}`).digest();

/** Jeton de session : « v1.<contenu>.<signature> ». Le contenu ne porte que l'identifiant de l'appareil et la date de fin. */
export function issueSession(secret: string, device: string, ttlSeconds: number, now = Date.now()): { token: string; expiresAt: number } {
  const expiresAt = Math.floor(now / 1000) + ttlSeconds;
  const payload = Buffer.from(JSON.stringify({ d: device, e: expiresAt })).toString('base64url');
  return { token: `${VERSION}.${payload}.${sign(secret, payload).toString('base64url')}`, expiresAt };
}

/** Renvoie l'identifiant de l'appareil si le jeton est authentique et encore valable, sinon null. */
export function verifySession(secret: string, token: string, now = Date.now()): string | null {
  if (token.length > 400) return null;
  const [version, payload, signature, ...rest] = token.split('.');
  if (version !== VERSION || !payload || !signature || rest.length) return null;
  const expected = sign(secret, payload);
  const given = Buffer.from(signature, 'base64url');
  // Comparaison en temps constant : la durée de la réponse ne renseigne pas sur la signature.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { d, e } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { d?: unknown; e?: unknown };
    if (!isDeviceId(d) || typeof e !== 'number' || e * 1000 <= now) return null;
    return d;
  } catch {
    return null;
  }
}
