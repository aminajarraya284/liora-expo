import type { Data, MoodEntry } from '../../state/types';
import { nowHHMM, todayISO } from '../../utils/dates';
import type { MoodKey } from './moods';

/** On garde environ un an d'historique. */
const MAX_ENTRIES = 400;

/** Ajoute une humeur à l'historique. */
export function withMood(data: Data, mood: MoodKey, source: MoodEntry['source'], id: string): Data {
  const entry: MoodEntry = { id, date: todayISO(), time: nowHHMM(), mood, source };
  return { ...data, moods: [...data.moods, entry].slice(-MAX_ENTRIES) };
}

/** Dernière humeur saisie aujourd'hui, s'il y en a une. */
export function moodOfToday(data: Data): MoodEntry | undefined {
  return lastOn(data, todayISO());
}

/** Dernière humeur de chacun des `count` derniers jours (du plus ancien au plus récent), avec les jours sans saisie. */
export function moodsByDay(data: Data, days: string[]): { date: string; entry?: MoodEntry }[] {
  return days.map((date) => ({ date, entry: lastOn(data, date) }));
}

function lastOn(data: Data, date: string): MoodEntry | undefined {
  const entries = data.moods.filter((entry) => entry.date === date);
  return entries[entries.length - 1];
}
