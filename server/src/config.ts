/** Réglages du serveur, lus dans les variables d'environnement. */

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

export type Config = {
  port: number;
  host: string;
  /** Secret commun à toutes les copies de l'application : il ne sert qu'à demander une session. */
  appToken: string;
  /** Secret connu du serveur seul : il signe les sessions des appareils. */
  sessionSecret: string;
  sessionTtlDays: number;
  /** Nombre de serveurs intermédiaires de confiance devant le relais (0 si le relais est joint directement). */
  trustProxy: number;
  /** Sites web autorisés à appeler le serveur depuis un navigateur (aperçu web). */
  allowedOrigins: string[];
  /** Appareils dont les sessions sont refusées. */
  blockedDevices: string[];
  model: string;
  effort: Effort;
  /** Requêtes par minute et par appareil. */
  assistantPerMinute: number;
  moodPerMinute: number;
  newsPerMinute: number;
  /** Plafonds par jour et par appareil : ils bornent la dépense. */
  assistantPerDay: number;
  moodPerDay: number;
  /** Plafond par jour pour tous les appareils réunis : le coupe-circuit de la facture. */
  globalPerDay: number;
  /** Demandes de session par heure et par adresse. */
  sessionsPerHour: number;
  redisRestUrl: string;
  redisRestToken: string;
};

export class ConfigError extends Error {}

const MIN_TOKEN_LENGTH = 24;
const MIN_SECRET_LENGTH = 32;
const GENERATE = `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`;

function integer(value: string | undefined, fallback: number, name: string, min = 1): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) throw new ConfigError(`${name} doit être un nombre entier${min > 0 ? ' positif' : ' positif ou nul'}.`);
  return n;
}

const list = (value: string | undefined): string[] => (value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const appToken = env.LIORA_APP_TOKEN ?? '';
  if (appToken.length < MIN_TOKEN_LENGTH) {
    throw new ConfigError(`LIORA_APP_TOKEN est obligatoire et doit contenir au moins ${MIN_TOKEN_LENGTH} caractères. Générez-le avec : ${GENERATE}`);
  }
  const sessionSecret = env.LIORA_SESSION_SECRET ?? '';
  if (sessionSecret.length < MIN_SECRET_LENGTH) {
    throw new ConfigError(`LIORA_SESSION_SECRET est obligatoire et doit contenir au moins ${MIN_SECRET_LENGTH} caractères. Générez-le avec : ${GENERATE}`);
  }
  if (sessionSecret === appToken) throw new ConfigError('LIORA_SESSION_SECRET doit être différent de LIORA_APP_TOKEN.');
  const effort = (env.LIORA_EFFORT ?? 'medium') as Effort;
  if (!EFFORTS.includes(effort)) throw new ConfigError(`LIORA_EFFORT doit valoir ${EFFORTS.join(', ')}.`);
  const redisRestUrl = (env.LIORA_REDIS_REST_URL ?? '').trim().replace(/\/+$/, '');
  const redisRestToken = (env.LIORA_REDIS_REST_TOKEN ?? '').trim();
  if (!!redisRestUrl !== !!redisRestToken) throw new ConfigError('Renseignez LIORA_REDIS_REST_URL et LIORA_REDIS_REST_TOKEN ensemble.');
  if (redisRestUrl) {
    let url: URL;
    try { url = new URL(redisRestUrl); } catch { throw new ConfigError('LIORA_REDIS_REST_URL doit être une adresse HTTPS.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new ConfigError('LIORA_REDIS_REST_URL doit être une adresse HTTPS sans identifiants ni paramètres.');
  }
  if (env.NODE_ENV === 'production' && !redisRestUrl) throw new ConfigError('Les plafonds de production nécessitent LIORA_REDIS_REST_URL et LIORA_REDIS_REST_TOKEN.');
  return {
    port: integer(env.PORT, 8787, 'PORT'),
    host: env.HOST || '0.0.0.0',
    appToken,
    sessionSecret,
    sessionTtlDays: integer(env.LIORA_SESSION_DAYS, 30, 'LIORA_SESSION_DAYS'),
    trustProxy: integer(env.LIORA_TRUST_PROXY, 0, 'LIORA_TRUST_PROXY', 0),
    allowedOrigins: list(env.LIORA_ALLOWED_ORIGINS),
    blockedDevices: list(env.LIORA_BLOCKED_DEVICES),
    model: env.LIORA_MODEL || 'claude-opus-5-5',
    effort,
    assistantPerMinute: integer(env.LIORA_ASSISTANT_PER_MINUTE, 30, 'LIORA_ASSISTANT_PER_MINUTE'),
    moodPerMinute: integer(env.LIORA_MOOD_PER_MINUTE, 6, 'LIORA_MOOD_PER_MINUTE'),
    newsPerMinute: integer(env.LIORA_NEWS_PER_MINUTE, 20, 'LIORA_NEWS_PER_MINUTE'),
    assistantPerDay: integer(env.LIORA_ASSISTANT_PER_DAY, 150, 'LIORA_ASSISTANT_PER_DAY'),
    moodPerDay: integer(env.LIORA_MOOD_PER_DAY, 20, 'LIORA_MOOD_PER_DAY'),
    globalPerDay: integer(env.LIORA_GLOBAL_PER_DAY, 5000, 'LIORA_GLOBAL_PER_DAY'),
    sessionsPerHour: integer(env.LIORA_SESSIONS_PER_HOUR, 20, 'LIORA_SESSIONS_PER_HOUR'),
    redisRestUrl,
    redisRestToken,
  };
}
