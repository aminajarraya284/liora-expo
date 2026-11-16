import { mergeNews, NEWS_SOURCE_KEYS, NEWS_SOURCES, type NewsItem, type NewsSourceKey, parseFeed } from '../../shared/news.ts';

/**
 * Actualités servies par le relais.
 *
 * Le serveur lit lui-même les flux des sources, les nettoie et les garde dix
 * minutes en mémoire. Les sites d'actualités ne voient donc jamais l'adresse
 * des téléphones, et une source peut être changée ici sans mettre à jour
 * l'application. Le serveur n'appelle que les adresses écrites dans la liste
 * des sources : aucune adresse ne vient de l'application.
 */

export type NewsPayload = { items: NewsItem[]; updatedAt: number; failed: NewsSourceKey[] };

const CACHE_MS = 10 * 60_000;
const TIMEOUT_MS = 8_000;
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;

/** Adresse https vers l'un des sites de la source : la seule forme que le serveur accepte d'appeler. */
function allowedUrl(raw: string, source: NewsSourceKey): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
  const host = url.hostname.toLowerCase();
  return NEWS_SOURCES[source].hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)) ? url : null;
}

/** Lit le corps d'une réponse en s'arrêtant à la taille maximale. */
async function readCapped(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error('flux trop volumineux');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function download(fetchFn: typeof fetch, source: NewsSourceKey): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let target = allowedUrl(NEWS_SOURCES[source].feed, source);
    // Les redirections sont suivies à la main : chacune doit rester sur un site de la source.
    for (let hop = 0; target && hop <= MAX_REDIRECTS; hop += 1) {
      const response = await fetchFn(target, { redirect: 'manual', signal: controller.signal, headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'LIORA/1.0 (lecteur de flux)' } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        target = location ? allowedUrl(new URL(location, target).toString(), source) : null;
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const items = parseFeed(await readCapped(response), source);
      if (!items.length) throw new Error('flux vide');
      return items;
    }
    throw new Error('redirection refusée');
  } finally {
    clearTimeout(timer);
  }
}

export function createNewsService({ fetchFn = fetch, now = Date.now }: { fetchFn?: typeof fetch; now?: () => number } = {}) {
  const lastGood = new Map<NewsSourceKey, NewsItem[]>();
  let cached: NewsPayload | null = null;
  let pending: Promise<NewsPayload> | null = null;

  async function refresh(): Promise<NewsPayload> {
    const results = await Promise.allSettled(NEWS_SOURCE_KEYS.map((source) => download(fetchFn, source)));
    const failed: NewsSourceKey[] = [];
    results.forEach((result, index) => {
      const source = NEWS_SOURCE_KEYS[index];
      if (result.status === 'fulfilled') lastGood.set(source, result.value);
      else failed.push(source);
    });
    if (failed.length === NEWS_SOURCE_KEYS.length && !cached) throw new Error('aucune source disponible');
    // Une source muette garde ses derniers titres plutôt que de disparaître.
    cached = { items: mergeNews(NEWS_SOURCE_KEYS.map((source) => lastGood.get(source) ?? [])), updatedAt: failed.length === NEWS_SOURCE_KEYS.length ? cached!.updatedAt : now(), failed };
    return cached;
  }

  let checkedAt = 0;
  return {
    /** Titres du moment : relus auprès des sources au plus une fois toutes les dix minutes. */
    get(): Promise<NewsPayload> {
      if (cached && now() - checkedAt < CACHE_MS) return Promise.resolve(cached);
      pending ??= refresh().finally(() => {
        checkedAt = now();
        pending = null;
      });
      return pending;
    },
  };
}

export type NewsService = ReturnType<typeof createNewsService>;
