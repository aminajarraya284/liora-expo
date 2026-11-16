import { useSyncExternalStore } from 'react';
import { assistantConfigured, requestNews } from '../assistant/relay';
import { kv } from '../../utils/storage';
import { articleUrl, mergeNews, NEWS_SOURCE_KEYS, NEWS_SOURCES, type NewsItem, type NewsSourceKey, parseFeed, plainText } from './parse';

/**
 * Actualités du jour : préparées par le serveur de LIORA quand il est
 * configuré (les sites d'actualités ne voient alors pas le téléphone), sinon
 * lues directement dans les flux publics des sources. Elles sont gardées en
 * mémoire et sur l'appareil pour rester lisibles sans connexion.
 * Ce ne sont pas des données personnelles : elles ne sont pas chiffrées.
 */

export type NewsState = {
  items: NewsItem[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Sources qui n'ont pas répondu au dernier chargement. */
  failed: NewsSourceKey[];
  /** Heure du dernier chargement réussi, en millisecondes. */
  updatedAt: number;
};

const STORAGE_KEY = 'liora.actualites.v1';
const TIMEOUT_MS = 12_000;
/** En dessous de ce délai, on ne recharge pas : inutile de solliciter les sites à chaque visite. */
const FRESH_MS = 20 * 60_000;

let state: NewsState = { items: [], status: 'idle', failed: [], updatedAt: 0 };
const listeners = new Set<() => void>();
let hydrated: Promise<void> | null = null;
let loading: Promise<void> | null = null;

const set = (next: Partial<NewsState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

/** Ce qui revient du stockage est revérifié comme s'il venait d'Internet. */
function sanitize(raw: unknown): NewsItem[] {
  if (!Array.isArray(raw)) return [];
  const items: NewsItem[] = [];
  for (const entry of raw.slice(0, 60)) {
    const { id, source, title, summary, url, time } = (entry ?? {}) as Record<string, unknown>;
    if (typeof id !== 'string' || !/^[a-z]+-[a-z0-9]{1,12}$/.test(id)) continue;
    if (typeof source !== 'string' || !(source in NEWS_SOURCES)) continue;
    if (typeof title !== 'string' || typeof url !== 'string') continue;
    const safeUrl = articleUrl(url, source as NewsSourceKey);
    const safeTitle = plainText(title, 180);
    if (!safeUrl || !safeTitle) continue;
    items.push({ id, source: source as NewsSourceKey, title: safeTitle, summary: typeof summary === 'string' ? plainText(summary, 260) : '', url: safeUrl, time: typeof time === 'number' && Number.isFinite(time) ? time : 0 });
  }
  return items;
}

const hydrate = (): Promise<void> => {
  hydrated ??= kv
    .get<{ items: unknown; updatedAt: unknown }>(STORAGE_KEY)
    .then((saved) => {
      const items = sanitize(saved?.items);
      if (items.length && !state.items.length) set({ items, updatedAt: typeof saved?.updatedAt === 'number' ? saved.updatedAt : 0, status: 'ready' });
    })
    .catch(() => {});
  return hydrated;
};

async function fetchSource(source: NewsSourceKey): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Ni cookie ni identifiant : la source ne reçoit rien qui désigne la personne.
    const response = await fetch(NEWS_SOURCES[source].feed, { signal: controller.signal, credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = parseFeed(await response.text(), source);
    if (!items.length) throw new Error('flux vide');
    return items;
  } finally {
    clearTimeout(timer);
  }
}

/** Charge les actualités. Sans `force`, ne fait rien si elles viennent d'être chargées. */
export function loadNews(force = false): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    await hydrate();
    if (!force && state.items.length && Date.now() - state.updatedAt < FRESH_MS) return;
    set({ status: 'loading' });
    if (assistantConfigured) {
      try {
        const served = (await requestNews()) as { items?: unknown; failed?: unknown } | null;
        // Même venant de notre serveur, le contenu est revérifié avant d'atteindre l'écran.
        const items = sanitize(served?.items);
        if (items.length) {
          const failed = NEWS_SOURCE_KEYS.filter((source) => Array.isArray(served?.failed) && served.failed.includes(source));
          const updatedAt = Date.now();
          set({ items, updatedAt, status: 'ready', failed });
          kv.set(STORAGE_KEY, { items, updatedAt }).catch(() => {});
          return;
        }
      } catch {
        // Serveur injoignable : on essaie les sources directement.
      }
    }
    const results = await Promise.allSettled(NEWS_SOURCE_KEYS.map(fetchSource));
    const failed = NEWS_SOURCE_KEYS.filter((_, index) => results[index].status === 'rejected');
    const fresh = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    if (!fresh.length) {
      // Aucune source n'a répondu : on garde les derniers titres reçus.
      set({ status: state.items.length ? 'ready' : 'error', failed });
      return;
    }
    // Une source muette garde ses anciens titres plutôt que de disparaître.
    const kept = failed.map((source) => state.items.filter((item) => item.source === source));
    const items = mergeNews([...fresh, ...kept]);
    const updatedAt = Date.now();
    set({ items, updatedAt, status: 'ready', failed });
    kv.set(STORAGE_KEY, { items, updatedAt }).catch(() => {});
  })().finally(() => {
    loading = null;
  });
  return loading;
}

/** Article à ouvrir, retrouvé par son identifiant : seule une adresse lue dans un flux peut s'ouvrir. */
export const findNews = (id: string | undefined): NewsItem | undefined => (id ? state.items.find((item) => item.id === id) : undefined);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => state;

export const useNews = (): NewsState => useSyncExternalStore(subscribe, snapshot, snapshot);
