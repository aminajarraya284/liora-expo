import type { DayPart } from '../../utils/dates';
import { type MoodKey, MOODS } from './moods';

/**
 * Choix du message et des gestes proposés après la saisie d'une humeur.
 * Tout est décidé ici, sans accès à l'écran, pour pouvoir être testé.
 *
 * Les textes s'adressent à tout le monde : ils évitent les adjectifs qui
 * s'accordent (« fatigué », « seul »…) puisque l'application ne demande pas
 * le genre de la personne.
 */

export type MoodActionKey = 'appeler' | 'respiration' | 'sommeil' | 'journal' | 'radio' | 'musique' | 'assistant' | 'eau';

export type MoodAdvice = {
  /** Phrase d'ouverture liée à l'évolution des derniers jours (absente s'il n'y a rien de notable). */
  lead?: string;
  /** Message principal, propre à l'humeur du moment. */
  message: string;
  /** Phrase de fin liée au moment de la journée. */
  closing?: string;
  /** Gestes proposés, du plus utile au moins utile. */
  actions: MoodActionKey[];
  /** Vrai s'il faut rappeler le numéro d'écoute 3114. */
  showHelpline: boolean;
};

type PastMood = { date: string; mood: MoodKey };

const MESSAGES: Record<MoodKey, string[]> = {
  joyeux: [
    'Quelle belle énergie aujourd’hui ! Profitez pleinement de ce moment, vous le méritez.',
    'Votre joie fait plaisir à voir. Et si vous la partagiez avec quelqu’un que vous aimez ?',
    'Les bons jours comptent double. Gardez-en une trace dans votre journal pour y revenir plus tard.',
    'Belle journée en perspective. Savourez-la, un instant après l’autre.',
  ],
  serein: [
    'Ce calme est précieux. Prenez le temps de le savourer.',
    'Vous voilà en paix avec votre journée. Continuez à votre rythme.',
    'Un moment de sérénité est un cadeau. Une musique douce peut le prolonger.',
    'Tout est à sa place aujourd’hui. Gardez cette tranquillité près de vous.',
  ],
  neutre: [
    'Une journée ordinaire a aussi du bon. Un petit plaisir peut l’éclairer : une promenade, une musique, un appel.',
    'Rien de particulier aujourd’hui, et c’est très bien ainsi. Prenez soin de vous comme d’habitude.',
    'Les journées tranquilles reposent. Et si vous en profitiez pour faire quelque chose qui vous plaît ?',
    'Tout suit son cours. Un verre d’eau, un peu d’air frais, et la journée continue.',
  ],
  fatigue: [
    'La fatigue demande simplement du repos. Accordez-vous une pause, sans culpabilité.',
    'Votre corps vous demande de ralentir. Écoutez-le : un moment de calme vous fera du bien.',
    'Les jours de fatigue passent. Buvez un peu d’eau, respirez doucement et allez à votre rythme.',
    'Il n’y a rien à rattraper aujourd’hui. Reposez-vous, le reste attendra.',
  ],
  inquiet: [
    'L’inquiétude est une réaction normale. Respirez lentement : vous n’avez pas à tout résoudre maintenant.',
    'Vous n’avez pas à porter cela sans aide. En parler à un proche allège souvent le poids.',
    'Une chose à la fois. Ce qui vous préoccupe semblera plus clair après quelques respirations calmes.',
    'Vos inquiétudes méritent d’être entendues. Confiez-les à quelqu’un de confiance, ou écrivez-les pour y voir plus clair.',
  ],
  triste: [
    'La tristesse a le droit d’être là. Accordez-vous de la douceur aujourd’hui.',
    'Les jours gris finissent par passer. En attendant, un proche sera heureux de vous entendre.',
    'Ce que vous ressentez compte. Prenez le temps qu’il vous faut, un pas après l’autre.',
    'Après la pluie revient toujours une éclaircie. D’ici là, entourez-vous de ce qui vous réconforte.',
  ],
};

const ACTIONS: Record<MoodKey, MoodActionKey[]> = {
  joyeux: ['journal', 'appeler', 'radio'],
  serein: ['musique', 'journal', 'radio'],
  neutre: ['radio', 'appeler', 'respiration'],
  fatigue: ['sommeil', 'eau', 'respiration'],
  inquiet: ['respiration', 'appeler', 'assistant'],
  triste: ['appeler', 'respiration', 'journal'],
};

/** Nombre de jours difficiles, parmi les derniers jours renseignés, à partir duquel on encourage à demander de l'aide. */
const LOW_DAYS_ALERT = 3;
const RECENT_DAYS = 5;

/** Humeur la plus récente de chaque jour, du plus récent au plus ancien. */
function lastMoodPerDay(entries: PastMood[]): PastMood[] {
  const byDay = new Map<string, PastMood>();
  for (const entry of entries) byDay.set(entry.date, entry);
  return [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Vrai si la personne traverse plusieurs jours difficiles d'affilée ou presque. */
export function isLowPeriod(current: PastMood, previous: PastMood[]): boolean {
  const days = lastMoodPerDay([...previous, current]).slice(0, RECENT_DAYS);
  return days.filter((d) => MOODS[d.mood].valence < 0).length >= LOW_DAYS_ALERT;
}

function leadFor(current: PastMood, previous: PastMood[], lowPeriod: boolean): string | undefined {
  const valence = MOODS[current.mood].valence;
  if (lowPeriod && valence < 0) {
    return 'Cela fait plusieurs jours que c’est difficile. Vous n’avez pas à rester avec cela sans aide : parlez-en à votre médecin ou à un proche.';
  }
  const last = previous[previous.length - 1];
  if (!last) return undefined;
  const before = MOODS[last.mood].valence;
  if (before < 0 && valence >= 0) return 'Vous allez mieux que la dernière fois, et c’est une très bonne nouvelle.';
  if (before > 0 && valence < 0) return 'La dernière fois, tout allait mieux. Les hauts et les bas font partie de la vie.';
  const goodDays = lastMoodPerDay([...previous, current]).slice(0, 3);
  if (goodDays.length === 3 && goodDays.every((d) => MOODS[d.mood].valence > 0)) return 'Voilà plusieurs jours que tout va bien : continuez ainsi !';
  return undefined;
}

function closingFor(mood: MoodKey, part: DayPart): string | undefined {
  const evening = part === 'soir' || part === 'nuit';
  if (mood === 'fatigue') return evening ? 'Il se fait tard : une bonne nuit de sommeil est le meilleur des remèdes.' : 'Allez-y doucement pour le reste de la journée.';
  if (mood === 'inquiet' && evening) return 'Le soir grossit souvent les soucis. Demain, ils paraîtront plus légers.';
  if (mood === 'triste' && evening) return 'Une soirée au calme et une bonne nuit aident à retrouver des forces.';
  if (mood === 'joyeux' && part === 'matin') return 'La journée commence bien !';
  return undefined;
}

/**
 * @param current  humeur qui vient d'être saisie
 * @param previous humeurs saisies auparavant, de la plus ancienne à la plus récente
 * @param part     moment de la journée
 * @param variant  nombre quelconque servant à varier le message d'une fois sur l'autre
 * @param canCall  vrai si un proche peut être appelé
 */
export function buildMoodAdvice(current: PastMood, previous: PastMood[], part: DayPart, variant: number, canCall: boolean): MoodAdvice {
  const lowPeriod = isLowPeriod(current, previous);
  const messages = MESSAGES[current.mood];
  const actions = ACTIONS[current.mood].filter((action) => action !== 'appeler' || canCall);
  return {
    lead: leadFor(current, previous, lowPeriod),
    message: messages[Math.abs(Math.trunc(variant)) % messages.length],
    closing: closingFor(current.mood, part),
    actions,
    showHelpline: current.mood === 'triste' || (lowPeriod && MOODS[current.mood].valence < 0),
  };
}
