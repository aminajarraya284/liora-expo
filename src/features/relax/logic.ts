/** Règles des séances de relaxation, sans image ni son : faciles à tester. */

/**
 * Une étape de séance. `grow` anime le cercle : il grandit à l'inspiration
 * (true) et rétrécit à l'expiration (false).
 */
export type Step = { text: string; seconds: number; grow?: boolean };

export type Session = {
  title: string;
  /** Ce que la séance apporte, en quelques mots. */
  summary: string;
  /** Consigne affichée avant de commencer. */
  intro: string;
  /** Phrase affichée à la fin. */
  outro: string;
  steps: Step[];
  /** Les exercices de respiration répètent leurs étapes pendant cette durée ; les séances guidées se déroulent une seule fois. */
  loopMinutes?: number;
};

/** Durée totale d'une séance, en secondes. */
export const sessionSeconds = (session: Session): number =>
  session.loopMinutes ? session.loopMinutes * 60 : session.steps.reduce((sum, step) => sum + step.seconds, 0);

export const sessionMinutes = (session: Session): number => Math.round(sessionSeconds(session) / 60);

/** Étape en cours et temps déjà passé dans cette étape, pour un nombre de secondes écoulées. */
export function stepAt(session: Session, elapsed: number): { index: number; inStep: number } {
  const cycle = session.steps.reduce((sum, step) => sum + step.seconds, 0);
  const last = session.steps.length - 1;
  if (!session.loopMinutes && elapsed >= cycle) return { index: last, inStep: session.steps[last].seconds };
  let inStep = elapsed % cycle;
  let index = 0;
  while (inStep >= session.steps[index].seconds) {
    inStep -= session.steps[index].seconds;
    index += 1;
  }
  return { index, inStep };
}

/** Petites idées pour se détendre : une par jour, à tour de rôle. */
export const DAILY_IDEAS = [
  'Ouvrez la fenêtre et prenez trois grandes respirations.',
  'Buvez un verre d’eau lentement, en savourant chaque gorgée.',
  'Écoutez un morceau de musique que vous aimez, les yeux fermés.',
  'Marchez quelques minutes, sans but, en regardant autour de vous.',
  'Appelez quelqu’un simplement pour prendre de ses nouvelles.',
  'Étirez les bras vers le ciel, puis relâchez d’un coup.',
  'Regardez le ciel une minute entière.',
  'Rangez un seul tiroir : un petit ordre fait un grand bien.',
  'Préparez-vous une boisson chaude et buvez-la sans rien faire d’autre.',
  'Notez une belle chose de la journée dans votre journal.',
] as const;

/** Idée du jour pour une date AAAA-MM-JJ : la même toute la journée. */
export const dailyIdea = (isoDate: string): string => {
  const day = Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / 86400000);
  return DAILY_IDEAS[((day % DAILY_IDEAS.length) + DAILY_IDEAS.length) % DAILY_IDEAS.length];
};
