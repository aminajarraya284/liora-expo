import Anthropic from '@anthropic-ai/sdk';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LIMITS } from '../../shared/assistant-contract.ts';
import { readMood, runAssistant } from './anthropic.ts';
import type { Config } from './config.ts';
import { type DailyBudget, memoryBudget, redisBudget } from './budget.ts';
import { createNewsService, type NewsService } from './news.ts';
import { RateLimiter, secondsUntilTomorrow } from './rate-limit.ts';
import { isDeviceId, issueSession, verifySession } from './session.ts';
import { parseConversation, parseMoodScan, ValidationError } from './validation.ts';

/**
 * Traitement des requêtes HTTP du relais.
 *
 *   GET  /health         état du serveur (sans authentification)
 *   POST /v1/session     ouvre la session d'un appareil (jeton de l'application)
 *   GET  /v1/actualites  titres du jour (session)
 *   POST /v1/assistant   un tour de conversation avec l'assistant (session)
 *   POST /v1/humeur      proposition d'humeur à partir d'une photo (session)
 *
 * Aucun contenu de conversation, aucune photo et aucun identifiant d'appareil
 * n'est écrit dans les journaux.
 */

type Deps = { config: Config; client: Anthropic; news?: NewsService; budget?: DailyBudget; log?: (line: string) => void };

class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter?: number;
  constructor(status: number, code: string, retryAfter?: number) {
    super(code);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

const sha256 = (value: string) => createHash('sha256').update(value).digest();

/** Comparaison en temps constant : la durée de la réponse ne renseigne pas sur le secret. */
const sameSecret = (a: string, b: string) => timingSafeEqual(sha256(a), sha256(b));

async function readJson(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'unsupported_media_type');
  if (Number(req.headers['content-length'] ?? 0) > maxBytes) throw new HttpError(413, 'payload_too_large');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, 'payload_too_large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

/** Traduit une erreur de l'API en réponse pour l'application, sans rien révéler de la configuration du serveur. */
function fromApiError(error: unknown): HttpError {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return new HttpError(503, 'assistant_unavailable');
  if (error instanceof Anthropic.RateLimitError) return new HttpError(429, 'busy', 30);
  if (error instanceof Anthropic.BadRequestError) return new HttpError(400, 'conversation_rejected');
  if (error instanceof Anthropic.APIConnectionError) return new HttpError(502, 'upstream_unreachable');
  if (error instanceof Anthropic.APIError) return new HttpError(502, 'upstream_error');
  return new HttpError(500, 'internal_error');
}

/**
 * Adresse de l'appelant. Derrière un hébergeur, la connexion vient de son
 * serveur intermédiaire : la vraie adresse est alors dans « X-Forwarded-For ».
 * On ne lit cet en-tête que si la configuration dit combien d'intermédiaires
 * sont de confiance, sinon n'importe qui pourrait se faire passer pour un autre.
 */
export function clientAddress(req: IncomingMessage, trustProxy: number): string {
  const direct = req.socket.remoteAddress ?? 'unknown';
  if (trustProxy <= 0) return direct;
  const header = req.headers['x-forwarded-for'];
  const chain = (Array.isArray(header) ? header.join(',') : header ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  const address = chain[chain.length - trustProxy];
  return address && address.length <= 45 ? address : direct;
}

export function createHandler({ config, client, news = createNewsService(), budget = config.redisRestUrl ? redisBudget(config.redisRestUrl, config.redisRestToken) : memoryBudget(), log = () => {} }: Deps) {
  const assistantLimit = new RateLimiter(config.assistantPerMinute);
  const moodLimit = new RateLimiter(config.moodPerMinute);
  const newsLimit = new RateLimiter(config.newsPerMinute);
  const sessionLimit = new RateLimiter(config.sessionsPerHour, 3_600_000);
  const blocked = new Set(config.blockedDevices);

  const send = (res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      ...extra,
    });
    res.end(JSON.stringify(body));
  };

  /** Autorise un site web seulement s'il figure dans la liste. Renvoie false si la requête doit être refusée. */
  const applyCors = (req: IncomingMessage, res: ServerResponse): boolean => {
    const origin = req.headers.origin;
    if (!origin) return true; // l'application mobile n'envoie pas d'en-tête Origin
    if (!config.allowedOrigins.includes(origin)) return false;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
    return true;
  };

  const bearer = (req: IncomingMessage): string => {
    const header = req.headers.authorization ?? '';
    return header.startsWith('Bearer ') ? header.slice(7) : '';
  };

  /** Jeton commun de l'application : il ne donne droit qu'à l'ouverture d'une session. */
  const requireAppToken = (req: IncomingMessage) => {
    const token = bearer(req);
    if (!token || !sameSecret(token, config.appToken)) throw new HttpError(401, 'unauthorized');
  };

  /** Session d'un appareil : renvoie son identifiant, ou refuse la requête. */
  const requireSession = (req: IncomingMessage): string => {
    const device = verifySession(config.sessionSecret, bearer(req));
    if (!device) throw new HttpError(401, 'unauthorized');
    if (blocked.has(device)) throw new HttpError(403, 'device_blocked');
    return device;
  };

  const throttle = (limiter: RateLimiter, key: string) => {
    const wait = limiter.check(key);
    if (wait > 0) throw new HttpError(429, 'too_many_requests', wait);
  };

  /** Plafonds du jour : d'abord celui de l'appareil, puis celui de tous les appareils réunis. */
  const spend = async (kind: 'assistant' | 'mood', device: string) => {
    const result = await budget.take({ kind, device, deviceLimit: kind === 'assistant' ? config.assistantPerDay : config.moodPerDay, globalLimit: config.globalPerDay })
      .catch(() => { throw new HttpError(503, 'assistant_unavailable'); });
    if (result === 'device') throw new HttpError(429, 'daily_limit', secondsUntilTomorrow());
    if (result === 'global') throw new HttpError(429, 'busy', secondsUntilTomorrow());
  };

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const started = Date.now();
    const path = (req.url ?? '/').split('?')[0];
    let status = 200;
    try {
      if (!applyCors(req, res)) throw new HttpError(403, 'origin_not_allowed');
      if (req.method === 'OPTIONS') {
        status = 204;
        res.writeHead(204).end();
        return;
      }
      if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true });

      if (req.method === 'POST' && path === '/v1/session') {
        throttle(sessionLimit, clientAddress(req, config.trustProxy));
        requireAppToken(req);
        const body = (await readJson(req, 1024)) as { device?: unknown } | null;
        if (!isDeviceId(body?.device)) throw new HttpError(400, 'invalid_request');
        if (blocked.has(body.device)) throw new HttpError(403, 'device_blocked');
        return send(res, 200, issueSession(config.sessionSecret, body.device, config.sessionTtlDays * 86_400));
      }

      if (req.method === 'GET' && path === '/v1/actualites') {
        throttle(newsLimit, requireSession(req));
        return send(res, 200, await news.get().catch(() => { throw new HttpError(502, 'news_unavailable'); }));
      }

      if (req.method === 'POST' && path === '/v1/assistant') {
        const device = requireSession(req);
        throttle(assistantLimit, device);
        const messages = parseConversation(await readJson(req, LIMITS.maxConversationBytes));
        await spend('assistant', device);
        return send(res, 200, await runAssistant(client, config, messages).catch((e) => { throw fromApiError(e); }));
      }

      if (req.method === 'POST' && path === '/v1/humeur') {
        const device = requireSession(req);
        throttle(moodLimit, device);
        const image = parseMoodScan(await readJson(req, LIMITS.maxImageBase64 + 1024));
        await spend('mood', device);
        return send(res, 200, await readMood(client, config, image).catch((e) => { throw fromApiError(e); }));
      }

      throw new HttpError(404, 'not_found');
    } catch (error) {
      const http = error instanceof HttpError ? error : error instanceof ValidationError ? new HttpError(400, 'invalid_request') : new HttpError(500, 'internal_error');
      status = http.status;
      const detail = error instanceof ValidationError ? { detail: error.message } : {};
      send(res, http.status, { error: http.code, ...detail }, http.retryAfter ? { 'Retry-After': String(http.retryAfter) } : {});
    } finally {
      log(`${req.method} ${path} ${status} ${Date.now() - started}ms`);
    }
  };
}
