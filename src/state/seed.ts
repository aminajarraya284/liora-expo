import { SEED_DEMO_DATA } from '../config';
import { addDays, todayISO } from '../utils/dates';
import { uid } from '../utils/ids';
import type { Data, Day, Habit, Meal, MoodEntry } from './types';

const defaultMeals = (): Meal[] => [
  { id: 'pdj', name: 'Petit-déjeuner', desc: '', done: false },
  { id: 'dej', name: 'Déjeuner', desc: '', done: false },
  { id: 'din', name: 'Dîner', desc: '', done: false },
];

const defaultHabits = (): Habit[] => [
  { id: 'fruits', label: 'Manger des fruits et légumes (5 portions)', done: false },
  { id: 'frais', label: 'Privilégier les produits frais et de saison', done: false },
];

/** Nouvelle journée : on garde la liste des repas et des habitudes, on remet les compteurs à zéro. */
export const freshDay = (previous?: Day): Day => ({
  date: todayISO(),
  waterMl: 0,
  meals: (previous?.meals ?? defaultMeals()).map((m) => ({ ...m, done: false })),
  habits: (previous?.habits ?? defaultHabits()).map((h) => ({ ...h, done: false })),
  taken: {},
});

/** Passe à la journée du jour si la date a changé depuis la dernière utilisation. */
export const rollDay = (data: Data): Data => (data.day.date === todayISO() ? data : { ...data, day: freshDay(data.day) });

export function emptyData(firstName: string, email: string): Data {
  return {
    profile: { firstName, lastName: '', age: '', city: '', address: '', phone: '', email },
    health: { antecedents: '', allergies: '', doctor: '', doctorPhone: '', bloodType: '' },
    proches: [],
    docs: [],
    notes: [],
    treatments: [],
    appointments: [],
    moods: [],
    links: [],
    day: freshDay(),
    waterGoalMl: 1500,
  };
}

/** Contenu d'exemple repris des maquettes, pour découvrir l'application. */
function demoData(firstName: string, email: string): Data {
  const today = todayISO();
  const base = emptyData(firstName, email);
  const mood = (daysAgo: number, value: MoodEntry['mood']): MoodEntry => ({
    id: uid(), date: addDays(today, -daysAgo), time: '09:30', mood: value, source: 'manuel',
  });
  return {
    ...base,
    profile: { ...base.profile, lastName: 'Martin', city: 'Lyon (69)', address: '12 rue des Lilas, 69003 Lyon', phone: '06 12 34 56 78' },
    proches: [
      { id: uid(), name: 'Sophie', relation: 'Ma fille', phone: '06 12 34 56 78', primary: true, emergency: true },
      { id: uid(), name: 'Marc', relation: 'Mon fils', phone: '06 98 76 54 32', primary: false, emergency: true },
      { id: uid(), name: 'Élise', relation: 'Ma sœur', phone: '06 45 67 89 01', primary: false, emergency: false },
    ],
    docs: [
      { id: uid(), name: 'Avis d’imposition', category: 'administratif', size: 248 * 1024, kind: 'PDF', date: today },
      { id: uid(), name: 'Contrat d’assurance', category: 'administratif', size: 1.2 * 1024 * 1024, kind: 'PDF', date: addDays(today, -3) },
      { id: uid(), name: 'Carte d’identité', category: 'administratif', size: 621 * 1024, kind: 'PDF', date: addDays(today, -10) },
    ],
    notes: [
      { id: uid(), title: 'Belle promenade', text: 'Une agréable marche au parc ce matin, le temps était magnifique !', date: today, photo: 'seed:j1' },
      { id: uid(), title: 'Déjeuner en famille', text: 'Un très bon moment autour d’une grande table.', date: addDays(today, -2), photo: 'seed:j2' },
      { id: uid(), title: 'Projet de voyage', text: 'Réfléchir à un séjour en Provence cet été.', date: addDays(today, -5), photo: 'seed:j3' },
    ],
    // Aucun médicament d'exemple : la liste des traitements n'est remplie que par l'utilisateur.
    appointments: [
      { id: uid(), title: 'Déjeuner avec Sophie', date: addDays(today, 3), time: '12:30', place: 'Brasserie des Lilas, Lyon 3e' },
      { id: uid(), title: 'Atelier d’aquarelle', date: addDays(today, 9), time: '14:00', place: 'Maison des associations' },
    ],
    moods: [mood(5, 'serein'), mood(4, 'neutre'), mood(3, 'neutre'), mood(2, 'joyeux'), mood(1, 'serein')],
    day: {
      date: today,
      waterMl: 1200,
      meals: [
        { id: 'pdj', name: 'Petit-déjeuner', desc: 'Yaourt, fruits rouges, céréales', done: true, photo: 'seed:m1' },
        { id: 'dej', name: 'Déjeuner', desc: 'Saumon, légumes vapeur, quinoa', done: true, photo: 'seed:m2' },
        { id: 'din', name: 'Dîner', desc: 'Soupe de légumes, salade verte', done: false, photo: 'seed:m3' },
      ],
      habits: [
        { id: 'fruits', label: 'Manger des fruits et légumes (5 portions)', done: true },
        { id: 'frais', label: 'Privilégier les produits frais et de saison', done: false },
      ],
      taken: {},
    },
  };
}

export const initialData = (firstName: string, email: string): Data =>
  SEED_DEMO_DATA ? demoData(firstName, email) : emptyData(firstName, email);
