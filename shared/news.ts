/**
 * Lecture des flux d'actualités (format RSS), sans image ni réseau : facile à tester.
 * Ce fichier sert à l'application et au serveur : il ne doit rien importer.
 *
 * Un flux vient d'Internet : on ne lui fait pas confiance. On n'en garde que
 * du texte nu, de longueur limitée, et des liens https vers le site de la
 * source. Rien d'autre ne peut atteindre l'écran ni le navigateur.
 */

export type NewsSourceKey = 'franceinfo' | 'yahoo';

export type NewsSource = {
  label: string;
  /** Nom court, pour les boutons étroits. */
  short: string;
  /** Adresse du flux de titres. */
  feed: string;
  /** Sites vers lesquels un article de cette source a le droit de pointer. */
  hosts: readonly string[];
};

export const NEWS_SOURCES: Record<NewsSourceKey, NewsSource> = {
  franceinfo: { label: 'franceinfo', short: 'franceinfo', feed: 'https://www.francetvinfo.fr/titres.rss', hosts: ['francetvinfo.fr', 'franceinfo.fr'] },
  yahoo: { label: 'Yahoo Actualités', short: 'Yahoo', feed: 'https://fr.news.yahoo.com/rss', hosts: ['yahoo.com'] },
};

export const NEWS_SOURCE_KEYS = Object.keys(NEWS_SOURCES) as NewsSourceKey[];

export type NewsItem = {
  /** Identifiant stable : il sert à ouvrir l'article, jamais l'adresse elle-même. */
  id: string;
  source: NewsSourceKey;
  title: string;
  summary: string;
  url: string;
  /** Date de parution, en millisecondes ; 0 si le flux ne la donne pas. */
  time: number;
};

const MAX_FEED_CHARS = 2_000_000;
const MAX_ITEMS_PER_SOURCE = 12;
const MAX_TITLE = 180;
const MAX_SUMMARY = 260;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '’', nbsp: ' ', laquo: '«', raquo: '»', hellip: '…', rsquo: '’', lsquo: '‘', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê', ocirc: 'ô', ucirc: 'û', icirc: 'î', acirc: 'â', ugrave: 'ù', euro: '€' };

const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 31 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });

/** Texte nu : sans balise, sans caractère invisible, espaces resserrés, longueur limitée. */
export function plainText(raw: string, max: number): string {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  // Les entités sont décodées avant de retirer les balises : « &lt;b&gt; » ne doit pas survivre.
  const text = decodeEntities(decodeEntities(unwrapped))
    .replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 40)).trimEnd()}…`;
}

const HTTPS_URL = /^https:\/\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)(?:[/?#][^\s<>"'`\\]*)?$/i;

/** Adresse https d'un article, seulement si elle pointe vers le site de la source. */
export function articleUrl(raw: string, source: NewsSourceKey): string | null {
  const url = decodeEntities(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
  if (url.length > 1200 || url.includes('@')) return null;
  const match = HTTPS_URL.exec(url);
  if (!match) return null;
  const host = match[1].toLowerCase();
  return NEWS_SOURCES[source].hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)) ? url : null;
}

const tag = (block: string, name: string): string => new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}\\s*>`, 'i').exec(block)?.[1] ?? '';

/** Petit identifiant tiré de l'adresse : court, sans caractère spécial. */
const idOf = (source: NewsSourceKey, url: string): string => {
  let hash = 5381;
  for (let i = 0; i < url.length; i += 1) hash = ((hash * 33) ^ url.charCodeAt(i)) >>> 0;
  return `${source}-${hash.toString(36)}`;
};

/** Titres d'un flux RSS. Les articles sans titre ou au lien douteux sont écartés. */
export function parseFeed(xml: string, source: NewsSourceKey): NewsItem[] {
  if (typeof xml !== 'string' || xml.length > MAX_FEED_CHARS) return [];
  const items: NewsItem[] = [];
  const seen = new Set<string>();
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item\s*>/gi)) {
    if (items.length >= MAX_ITEMS_PER_SOURCE) break;
    const block = match[1];
    const title = plainText(tag(block, 'title'), MAX_TITLE);
    const url = articleUrl(tag(block, 'link'), source);
    if (!title || !url) continue;
    const id = idOf(source, url);
    if (seen.has(id)) continue;
    seen.add(id);
    const parsed = Date.parse(plainText(tag(block, 'pubDate'), 60));
    items.push({ id, source, title, summary: plainText(tag(block, 'description'), MAX_SUMMARY), url, time: Number.isFinite(parsed) ? parsed : 0 });
  }
  return items;
}

const sameTitle = (title: string) => title.toLowerCase().replace(/[^a-zà-ÿ0-9]+/g, ' ').trim();

/** Réunit plusieurs sources : les plus récents d'abord, sans deux fois le même titre. */
export function mergeNews(lists: NewsItem[][]): NewsItem[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .sort((a, b) => b.time - a.time)
    .filter((item) => {
      const key = sameTitle(item.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** « à l'instant », « il y a 2 h », « hier »… */
export function sinceLabel(time: number, now: number): string {
  if (!time) return '';
  const minutes = Math.floor((now - time) / 60000);
  if (minutes < 2) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hier' : `il y a ${days} jours`;
}
