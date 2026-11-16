/** Humeurs proposées, de la plus légère à la plus lourde. */
export const MOOD_KEYS = ['joyeux', 'serein', 'neutre', 'fatigue', 'inquiet', 'triste'] as const;
export type MoodKey = (typeof MOOD_KEYS)[number];

export type MoodInfo = {
  key: MoodKey;
  /** Libellé affiché sous le visage. Des noms, pour convenir à tout le monde sans accord au féminin ou au masculin. */
  label: string;
  /** Suite de la phrase « Aujourd'hui, … ». */
  feeling: string;
  /** Suite de la phrase « Il me semble lire … sur votre visage ». */
  reading: string;
  /** De +2 (très bien) à −2 (très difficile), pour suivre l'évolution. */
  valence: number;
  /** Couleurs de la pastille : des tons doux, peu saturés. */
  color: string;
  colorDark: string;
  /** Fond de la carte de choix. */
  card: string;
};

export const MOODS: Record<MoodKey, MoodInfo> = {
  joyeux: { key: 'joyeux', label: 'Joie', feeling: 'vous ressentez de la joie', reading: 'de la joie', valence: 2, color: '#E8C27A', colorDark: '#C99A3F', card: '#FBEFDF' },
  serein: { key: 'serein', label: 'Sérénité', feeling: 'vous ressentez de la sérénité', reading: 'de la sérénité', valence: 1, color: '#A9C7A6', colorDark: '#6F9B77', card: '#E6F0E7' },
  neutre: { key: 'neutre', label: 'Comme d’habitude', feeling: 'vous vous sentez comme d’habitude', reading: 'une humeur égale', valence: 0, color: '#D9C2A6', colorDark: '#B4946C', card: '#F3EBE2' },
  fatigue: { key: 'fatigue', label: 'Fatigue', feeling: 'vous ressentez de la fatigue', reading: 'de la fatigue', valence: -1, color: '#ADA9CF', colorDark: '#7C76AE', card: '#EEE9F5' },
  inquiet: { key: 'inquiet', label: 'Inquiétude', feeling: 'vous ressentez de l’inquiétude', reading: 'de l’inquiétude', valence: -1, color: '#A3BBD0', colorDark: '#6C8DAB', card: '#E7EEF6' },
  triste: { key: 'triste', label: 'Tristesse', feeling: 'vous ressentez de la tristesse', reading: 'de la tristesse', valence: -2, color: '#A9B3C0', colorDark: '#74808F', card: '#E9ECF1' },
};

export const isMoodKey = (value: unknown): value is MoodKey =>
  typeof value === 'string' && (MOOD_KEYS as readonly string[]).includes(value);
