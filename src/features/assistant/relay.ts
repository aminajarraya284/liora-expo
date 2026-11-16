import { getRandomBytesAsync } from 'expo-crypto';
import type { AssistantRequest, AssistantResponse, MoodScanRequest, MoodScanResponse } from '../../../shared/assistant-contract';
import { toHex } from '../../security/utf8';
import { secure } from '../../utils/storage';

/**
 * Appels au serveur relais de LIORA (assistant, scan d'humeur, actualités).
 *
 * L'application ne contient aucune clé de l'API : elle parle uniquement à ce
 * serveur, dont l'adresse et le jeton viennent du fichier « .env »
 * (EXPO_PUBLIC_ASSISTANT_URL et EXPO_PUBLIC_ASSISTANT_TOKEN).
 *
 * Le jeton commun ne sert qu'à ouvrir une session. Chaque appareil tire au
 * hasard son propre identifiant, sans lien avec la personne ni avec son
 * compte, et reçoit un jeton de session que le serveur peut limiter ou
 * bloquer sans toucher aux autres appareils.
 */

const RAW_URL = (process.env.EXPO_PUBLIC_ASSISTANT_URL ?? '').trim().replace(/\/+$/, '');
const TOKEN = (process.env.EXPO_PUBLIC_ASSISTANT_TOKEN ?? '').trim();

/** Adresses d'un réseau local, pour les essais entre un téléphone et un ordinateur du même Wi-Fi. */
const LOCAL_HOST = /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

/**
 * Le chiffrement https est exigé, sauf vers un ordinateur du réseau local
 * pendant les essais : sur Internet, rien ne circule en clair.
 */
const BASE_URL = RAW_URL.startsWith('https://') || LOCAL_HOST.test(RAW_URL) ? RAW_URL : '';

/** Vrai si un serveur d'assistant est renseigné et utilisable. */
export const assistantConfigured = BASE_URL !== '' && TOKEN !== '';

export type RelayFailure = 'not_configured' | 'offline' | 'timeout' | 'unauthorized' | 'busy' | 'daily_limit' | 'rejected' | 'unavailable';

export class RelayError extends Error {
  readonly kind: RelayFailure;
  constructor(kind: RelayFailure) {
    super(kind);
    this.kind = kind;
  }
}

/** Message à afficher à la personne pour chaque type d'échec. */
export const RELAY_MESSAGES: Record<RelayFailure, string> = {
  not_configured: 'L’assistant n’est pas encore connecté.',
  offline: 'Impossible de joindre l’assistant. Vérifiez votre connexion à Internet.',
  timeout: 'L’assistant met trop de temps à répondre. Veuillez réessayer.',
  unauthorized: 'L’assistant a refusé la connexion de l’application.',
  busy: 'L’assistant est très demandé en ce moment. Réessayez dans une minute.',
  daily_limit: 'Vous avez beaucoup utilisé l’assistant aujourd’hui. Il sera de nouveau disponible demain.',
  rejected: 'Cette conversation ne peut pas continuer. Commencez une nouvelle conversation.',
  unavailable: 'L’assistant est momentanément indisponible. Veuillez réessayer plus tard.',
};

const failureFor = (status: number, code?: string): RelayFailure => {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 429) return code === 'daily_limit' ? 'daily_limit' : 'busy';
  if (status === 400 || status === 413) return 'rejected';
  return 'unavailable';
};

type Session = { token: string; expiresAt: number };

const DEVICE_KEY = 'liora.relais.appareil';
// Ne pas confondre avec « liora.session », qui garde la connexion de la personne à son compte.
const SESSION_KEY = 'liora.relais.session';
/** Une session est renouvelée un jour avant sa fin, pour ne jamais expirer en pleine conversation. */
const RENEW_MARGIN_S = 86_400;

let session: Session | null = null;
let opening: Promise<string> | null = null;

/** Requête vers le relais, avec délai maximal. Renvoie la réponse, même en erreur. */
async function request(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${BASE_URL}${path}`, { ...init, signal: controller.signal });
  } catch {
    throw new RelayError(controller.signal.aborted ? 'timeout' : 'offline');
  } finally {
    clearTimeout(timer);
  }
}

/** Identifiant de l'appareil : 256 bits tirés au hasard à la première utilisation, gardés dans le trousseau. */
async function deviceId(): Promise<string> {
  const saved = await secure.get(DEVICE_KEY);
  if (saved && /^[a-f0-9]{64}$/.test(saved)) return saved;
  const fresh = toHex(await getRandomBytesAsync(32));
  await secure.set(DEVICE_KEY, fresh);
  return fresh;
}

const usable = (candidate: Session | null): candidate is Session =>
  !!candidate && typeof candidate.token === 'string' && typeof candidate.expiresAt === 'number' && candidate.expiresAt - RENEW_MARGIN_S > Date.now() / 1000;

async function openSession(): Promise<string> {
  const response = await request('/v1/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ device: await deviceId() }) }, 20_000);
  if (!response.ok) throw new RelayError(failureFor(response.status));
  const opened = (await response.json().catch(() => null)) as Session | null;
  if (!opened || typeof opened.token !== 'string' || typeof opened.expiresAt !== 'number') throw new RelayError('unavailable');
  session = { token: opened.token, expiresAt: opened.expiresAt };
  await secure.setJSON(SESSION_KEY, session).catch(() => {});
  return session.token;
}

/** Jeton de session en cours : celui en mémoire, sinon celui du trousseau, sinon une nouvelle session. */
async function sessionToken(): Promise<string> {
  if (usable(session)) return session.token;
  const saved = await secure.getJSON<Session>(SESSION_KEY);
  if (usable(saved)) {
    session = saved;
    return saved.token;
  }
  // Plusieurs appels simultanés partagent la même ouverture de session.
  opening ??= openSession().finally(() => {
    opening = null;
  });
  return opening;
}

async function forgetSession(): Promise<void> {
  session = null;
  await secure.del(SESSION_KEY).catch(() => {});
}

async function call<T>(method: 'GET' | 'POST', path: string, body: unknown, timeoutMs: number): Promise<T> {
  if (!assistantConfigured) throw new RelayError('not_configured');
  const send = async () => {
    const headers: Record<string, string> = { Authorization: `Bearer ${await sessionToken()}` };
    if (method === 'POST') headers['Content-Type'] = 'application/json';
    return request(path, { method, headers, body: method === 'POST' ? JSON.stringify(body) : undefined }, timeoutMs);
  };
  let response = await send();
  if (response.status === 401) {
    // Session expirée ou secret du serveur renouvelé : on en ouvre une autre, une seule fois.
    await forgetSession();
    response = await send();
  }
  if (!response.ok) {
    const code = ((await response.json().catch(() => null)) as { error?: string } | null)?.error;
    throw new RelayError(failureFor(response.status, code));
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new RelayError('unavailable');
  }
}

/** Envoie la conversation et reçoit la suite : une réponse, ou des actions à exécuter. */
export const sendConversation = (request: AssistantRequest): Promise<AssistantResponse> => call('POST', '/v1/assistant', request, 150_000);

/** Envoie une photo du visage et reçoit une proposition d'humeur. */
export const requestMoodScan = (request: MoodScanRequest): Promise<MoodScanResponse> => call('POST', '/v1/humeur', request, 60_000);

/** Titres du jour préparés par le serveur. Le contenu est revérifié par l'application avant affichage. */
export const requestNews = (): Promise<unknown> => call('GET', '/v1/actualites', undefined, 15_000);
