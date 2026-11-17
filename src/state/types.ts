import type { MoodKey } from '../features/mood/moods';

export type Profile = {
  firstName: string;
  lastName: string;
  age: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  photo?: string;
};

export type Health = { antecedents: string; allergies: string; doctor: string; doctorPhone: string; bloodType: string };

export type Proche = { id: string; name: string; relation: string; phone: string; primary: boolean; emergency: boolean; photo?: string };

export type DocCategory = 'ordonnances' | 'analyses' | 'administratif';
export type Doc = {
  id: string;
  name: string;
  category: DocCategory;
  /** Absent pour les documents d'exemple. */
  uri?: string;
  size: number;
  /** Extension en majuscules : « PDF », « JPG »… */
  kind: string;
  date: string;
  /** Vrai si le fichier est chiffré sur l'appareil. */
  encrypted?: boolean;
};

export type Note = { id: string; title: string; text: string; date: string; photo?: string };
export type Treatment = { id: string; name: string; dose: string; times: string[] };
export type Appointment = { id: string; title: string; date: string; time: string; place: string };
export type Meal = { id: string; name: string; desc: string; done: boolean; photo?: string };
export type Habit = { id: string; label: string; done: boolean };

/** État remis à zéro chaque jour : hydratation, repas, habitudes et prises de médicaments. */
export type Day = { date: string; waterMl: number; meals: Meal[]; habits: Habit[]; taken: Record<string, boolean> };

export type MoodEntry = { id: string; date: string; time: string; mood: MoodKey; source: 'manuel' | 'scan' | 'assistant' };

/** Lien personnel ouvert dans le navigateur privé (mutuelle, banque…). */
export type SavedLink = { id: string; name: string; url: string };

export type Data = {
  profile: Profile;
  health: Health;
  proches: Proche[];
  docs: Doc[];
  notes: Note[];
  treatments: Treatment[];
  appointments: Appointment[];
  moods: MoodEntry[];
  links: SavedLink[];
  day: Day;
  waterGoalMl: number;
};

/** Réglages de l'appareil : ils s'appliquent aussi avant la connexion. */
export type Settings = {
  bigText: boolean;
  highContrast: boolean;
  speech: boolean;
  reduceMotion: boolean;
  simple: boolean;
  notifRappels: boolean;
  notifAlertes: boolean;
  notifMessages: boolean;
  /** Accord pour envoyer les messages et les données utiles à l'assistant. */
  assistantConsent: boolean;
  /** Accord pour analyser une photo du visage lors du scan d'humeur. */
  faceScanConsent: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  bigText: false,
  highContrast: false,
  speech: false,
  reduceMotion: false,
  simple: false,
  notifRappels: true,
  notifAlertes: true,
  notifMessages: true,
  assistantConsent: false,
  faceScanConsent: false,
};

export type Result = { ok: true; message?: string } | { ok: false; error: string };
