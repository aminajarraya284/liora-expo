export const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

export const isPhone = (s: string): boolean => /^\+?[\d\s.\-()]{6,20}$/.test(s.trim()) && s.replace(/\D/g, '').length >= 2;

export const PASSWORD_RULE = 'Au moins 8 caractères, avec une lettre et un chiffre.';

export const passwordError = (pw: string): string | null =>
  pw.length >= 8 && pw.length <= 128 && /[A-Za-zÀ-ÿ]/.test(pw) && /\d/.test(pw) ? null : PASSWORD_RULE;

const HTTPS_URL = /^https:\/\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)(?::\d{1,5})?(?:[/?#][^\s]*)?$/i;

/**
 * N'accepte que des adresses « https:// » vers un nom de domaine.
 * Refuse http, les adresses IP, les identifiants dans l'adresse (« user@ »)
 * et tout autre schéma (javascript:, file:, data:…).
 */
export const parseHttpsUrl = (raw: string): { url: string; host: string } | null => {
  const url = raw.trim();
  if (url.length > 2000 || url.includes('@') || url.includes('\\')) return null;
  const m = HTTPS_URL.exec(url);
  if (!m) return null;
  const host = m[1].toLowerCase();
  if (/^[\d.]+$/.test(host)) return null;
  return { url, host };
};

/** Ajoute « https:// » à une adresse saisie sans schéma (« ma-mutuelle.fr »). */
export const normalizeUrlInput = (raw: string): string => {
  const s = raw.trim();
  if (!s) return s;
  return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
};

/** Retire « www. » pour l'affichage. */
export const displayHost = (host: string): string => host.replace(/^www\./, '');
