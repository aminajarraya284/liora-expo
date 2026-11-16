const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const p2 = (n: number) => String(n).padStart(2, '0');

/** Date locale au format « AAAA-MM-JJ ». */
export const toISO = (d: Date): string => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const todayISO = (): string => toISO(new Date());
export const nowHHMM = (d: Date = new Date()): string => `${p2(d.getHours())}:${p2(d.getMinutes())}`;

export const fromISO = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (iso: string, n: number): string => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

const dayNumber = (d: Date) => `${d.getDate()}${d.getDate() === 1 ? 'er' : ''}`;

/** « Mardi 15 avril 2025 » */
export const frLong = (iso: string): string => {
  const d = fromISO(iso);
  return `${DAYS[d.getDay()]} ${dayNumber(d)} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** « 15 avril 2025 » */
export const frShort = (iso: string): string => {
  const d = fromISO(iso);
  return `${dayNumber(d)} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** Initiale du jour de la semaine : « L », « M », « M », « J », « V », « S », « D ». */
export const frDayInitial = (iso: string): string => DAYS[fromISO(iso).getDay()][0];

/** « 2025-04-15 » → « 15/04/2025 » */
export const isoToFr = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/** Vrai pour une date « AAAA-MM-JJ » qui existe réellement dans le calendrier. */
export const isISODate = (iso: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
};

/** « 15/04/2025 » → « 2025-04-15 », ou null si la date est invalide. */
export const frToISO = (fr: string): string | null => {
  const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(fr.trim());
  if (!m) return null;
  const iso = `${m[3]}-${p2(Number(m[2]))}-${p2(Number(m[1]))}`;
  return isISODate(iso) ? iso : null;
};

/** « 8h30 », « 08:30 », « 8 » → « 08:30 », ou null si l'heure est invalide. */
export const normTime = (t: string): string | null => {
  const m = /^(\d{1,2})(?:\s*[:hH]\s*(\d{2})?)?$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2] ?? 0);
  if (h > 23 || mi > 59) return null;
  return `${p2(h)}:${p2(mi)}`;
};

/** « 08:30 » → « 8 h 30 » */
export const frTime = (hhmm: string): string => {
  const [h, m] = hhmm.split(':');
  return `${Number(h)} h ${m}`;
};

/** Durée « mm:ss » à partir d'un nombre de secondes. */
export const mmss = (seconds: number): string => `${p2(Math.floor(seconds / 60))}:${p2(Math.floor(seconds % 60))}`;

/** Moment de la journée, pour adapter les messages. */
export type DayPart = 'matin' | 'apres-midi' | 'soir' | 'nuit';
export const dayPart = (d: Date = new Date()): DayPart => {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'matin';
  if (h >= 12 && h < 18) return 'apres-midi';
  if (h >= 18 && h < 23) return 'soir';
  return 'nuit';
};
