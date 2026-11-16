import {
  ASSISTANT_TOOLS, type MoodValue, type ScreenValue, type ToolName, type ToolSpec, type TopicValue,
} from '../../../shared/assistant-contract';
import type { Data } from '../../state/types';
import { frLong, frTime, isISODate, normTime, todayISO } from '../../utils/dates';
import { withMood } from '../mood/log';
import { MOODS } from '../mood/moods';
import type { ToolOutcome } from './agent';
import { checkToolInput } from './schema';

/**
 * Exécution, sur le téléphone, des outils que l'assistant demande.
 *
 * - Chaque appel est vérifié (forme, dates, longueurs) avant d'agir.
 * - Les outils qui modifient des données importantes passent par une
 *   confirmation de la personne : l'assistant propose, elle décide.
 * - L'assistant ne reçoit que ce qu'il demande, rubrique par rubrique, sans
 *   numéro de téléphone ni adresse, et jamais le contenu du coffre-fort.
 */

export type ToolEnv = {
  getData: () => Data;
  update: (change: (data: Data) => Data) => void;
  /** Demande l'accord de la personne. Renvoie true si elle accepte. */
  confirm: (title: string, message: string) => Promise<boolean>;
  /** Ouvre un écran de l'application. */
  open: (href: string) => void;
  /** Lance l'appel vers un numéro. Renvoie false si l'appareil ne peut pas appeler. */
  call: (phone: string) => Promise<boolean>;
  newId: () => string;
};

const GLASS_ML = 250;
const SPECS = new Map<string, ToolSpec>(ASSISTANT_TOOLS.map((spec) => [spec.name, spec]));

const SCREENS: Record<ScreenValue, { href: string; label: string }> = {
  accueil: { href: '/accueil', label: 'Accueil' },
  traitements: { href: '/traitements', label: 'Traitements' },
  agenda: { href: '/agenda', label: 'Agenda' },
  humeur: { href: '/humeur', label: 'Humeur' },
  nutrition: { href: '/nutrition', label: 'Nutrition' },
  proches: { href: '/proches', label: 'Proches' },
  urgence: { href: '/urgence', label: 'Urgence' },
  'coffre-fort': { href: '/coffre-fort', label: 'Coffre-fort' },
  demarches: { href: '/demarches', label: 'Démarches' },
  journal: { href: '/journal', label: 'Journal' },
  relaxation: { href: '/relaxation', label: 'Relaxation' },
  respiration: { href: '/seance?type=respiration', label: 'Respiration guidée' },
  radio: { href: '/radio', label: 'Radio' },
  parametres: { href: '/parametres', label: 'Paramètres' },
  accessibilite: { href: '/accessibilite', label: 'Accessibilité' },
  profil: { href: '/profil', label: 'Profil' },
};

const done = (result: unknown, summary?: string): ToolOutcome => ({ ok: true, result: JSON.stringify(result), summary });
const fail = (message: string): ToolOutcome => ({ ok: false, result: message });
const declined = (): ToolOutcome => ({ ok: true, result: 'La personne a refusé cette action. Ne pas la refaire sans nouvelle demande de sa part.', summary: 'Action annulée' });

/** Nettoie un texte reçu du modèle : espaces superflus retirés, longueur bornée. */
const clean = (value: string, max: number): string => value.replace(/\s+/g, ' ').trim().slice(0, max);
const cleanParagraph = (value: string, max: number): string => value.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const shorten = (value: string, max: number): string => (value.length > max ? `${value.slice(0, max)}…` : value);

/** Ce que l'assistant voit d'une rubrique. */
function read(data: Data, topic: TopicValue): unknown {
  const today = todayISO();
  switch (topic) {
    case 'traitements':
      return {
        date: today,
        traitements: data.treatments.map((t) => ({
          id: t.id, nom: t.name, dose: t.dose,
          prises_du_jour: t.times.map((heure) => ({ heure, prise: !!data.day.taken[`${t.id}@${heure}`] })),
        })),
      };
    case 'agenda': {
      const sorted = [...data.appointments].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      const view = (a: (typeof sorted)[number]) => ({ id: a.id, titre: a.title, date: a.date, heure: a.time, lieu: a.place });
      return { a_venir: sorted.filter((a) => a.date >= today).map(view), passes: sorted.filter((a) => a.date < today).slice(-5).map(view) };
    }
    case 'proches':
      return data.proches.map((p) => ({ id: p.id, prenom: p.name, lien: p.relation, contact_principal: p.primary, contact_urgence: p.emergency }));
    case 'journal':
      return [...data.notes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((n) => ({ date: n.date, titre: n.title, texte: shorten(n.text, 400) }));
    case 'nutrition':
      return {
        eau_bue_ml: data.day.waterMl, objectif_ml: data.waterGoalMl,
        repas: data.day.meals.map((m) => ({ nom: m.name, menu: m.desc, pris: m.done })),
        habitudes: data.day.habits.map((h) => ({ libelle: h.label, fait: h.done })),
      };
    case 'humeur':
      return data.moods.slice(-14).map((m) => ({ date: m.date, heure: m.time, humeur: MOODS[m.mood].label }));
    case 'sante':
      return { antecedents: data.health.antecedents, allergies: data.health.allergies, groupe_sanguin: data.health.bloodType, medecin_traitant: data.health.doctor };
    case 'profil':
      return { prenom: data.profile.firstName, age: data.profile.age, ville: data.profile.city };
  }
}

export function createToolRunner(env: ToolEnv) {
  const handlers: Record<ToolName, (input: any) => Promise<ToolOutcome> | ToolOutcome> = {
    consulter: ({ rubrique }: { rubrique: TopicValue }) => done(read(env.getData(), rubrique)),

    ajouter_rendez_vous: async (input: { titre: string; date: string; heure: string; lieu: string }) => {
      const title = clean(input.titre, 120);
      const time = normTime(input.heure);
      const place = clean(input.lieu, 160);
      if (!title) return fail('Le titre du rendez-vous est vide.');
      if (!isISODate(input.date)) return fail('Date invalide. Format attendu : AAAA-MM-JJ, pour une date qui existe.');
      if (!time) return fail('Heure invalide. Format attendu : HH:MM.');
      const when = `${frLong(input.date)} à ${frTime(time)}`;
      if (!(await env.confirm('Ajouter ce rendez-vous ?', [title, when, place].filter(Boolean).join('\n')))) return declined();
      const id = env.newId();
      env.update((d) => ({ ...d, appointments: [...d.appointments, { id, title, date: input.date, time, place }] }));
      return done({ ajoute: true, id }, `Rendez-vous ajouté : ${title}, ${when}`);
    },

    supprimer_rendez_vous: async ({ id }: { id: string }) => {
      const found = env.getData().appointments.find((a) => a.id === id);
      if (!found) return fail('Aucun rendez-vous ne porte cet identifiant. Relire l’agenda avec l’outil consulter.');
      const when = `${frLong(found.date)} à ${frTime(found.time)}`;
      if (!(await env.confirm('Supprimer ce rendez-vous ?', `${found.title}\n${when}`))) return declined();
      env.update((d) => ({ ...d, appointments: d.appointments.filter((a) => a.id !== id) }));
      return done({ supprime: true }, `Rendez-vous supprimé : ${found.title}`);
    },

    ajouter_traitement: async (input: { nom: string; dose: string; heures: string[] }) => {
      const name = clean(input.nom, 80);
      const dose = clean(input.dose, 80);
      const times = input.heures.map(normTime);
      if (!name) return fail('Le nom du médicament est vide.');
      if (times.length === 0 || times.length > 8 || times.some((t) => !t)) return fail('Indiquer entre une et huit heures de prise, au format HH:MM.');
      const sorted = [...new Set(times as string[])].sort();
      const detail = [dose ? `${name} — ${dose}` : name, `Prises : ${sorted.map(frTime).join(', ')}`].join('\n');
      if (!(await env.confirm('Ajouter ce traitement ?', detail))) return declined();
      const id = env.newId();
      env.update((d) => ({ ...d, treatments: [...d.treatments, { id, name, dose, times: sorted }] }));
      return done({ ajoute: true, id }, `Traitement ajouté : ${name}`);
    },

    marquer_prise: async (input: { traitement_id: string; heure: string; prise: boolean }) => {
      const treatment = env.getData().treatments.find((t) => t.id === input.traitement_id);
      const time = normTime(input.heure);
      if (!treatment) return fail('Aucun traitement ne porte cet identifiant. Relire les traitements avec l’outil consulter.');
      if (!time || !treatment.times.includes(time)) return fail(`Ce traitement n’a pas de prise à cette heure. Heures prévues : ${treatment.times.join(', ')}.`);
      const label = `${treatment.name}, prise de ${frTime(time)}`;
      if (!(await env.confirm(input.prise ? 'Noter cette prise comme faite ?' : 'Annuler cette prise ?', label))) return declined();
      env.update((d) => ({ ...d, day: { ...d.day, taken: { ...d.day.taken, [`${treatment.id}@${time}`]: input.prise } } }));
      return done({ enregistre: true }, input.prise ? `Prise notée : ${label}` : `Prise annulée : ${label}`);
    },

    ajouter_note: async (input: { titre: string; texte: string }) => {
      const title = clean(input.titre, 120);
      const text = cleanParagraph(input.texte, 2000);
      if (!title || !text) return fail('Le titre et le texte de la note sont obligatoires.');
      if (!(await env.confirm('Ajouter cette note au journal ?', `${title}\n\n${shorten(text, 300)}`))) return declined();
      const id = env.newId();
      env.update((d) => ({ ...d, notes: [...d.notes, { id, title, text, date: todayISO() }] }));
      return done({ ajoute: true }, `Note ajoutée au journal : ${title}`);
    },

    ajouter_eau: ({ verres }: { verres: number }) => {
      env.update((d) => ({ ...d, day: { ...d.day, waterMl: d.day.waterMl + verres * GLASS_ML } }));
      const total = env.getData().day.waterMl;
      return done({ eau_bue_ml: total, objectif_ml: env.getData().waterGoalMl }, verres === 1 ? 'Un verre d’eau ajouté' : `${verres} verres d’eau ajoutés`);
    },

    enregistrer_humeur: ({ humeur }: { humeur: MoodValue }) => {
      env.update((d) => withMood(d, humeur, 'assistant', env.newId()));
      return done({ enregistre: true }, `Humeur enregistrée : ${MOODS[humeur].label}`);
    },

    appeler_proche: async ({ proche_id }: { proche_id: string }) => {
      const proche = env.getData().proches.find((p) => p.id === proche_id);
      if (!proche) return fail('Aucun proche ne porte cet identifiant. Relire les proches avec l’outil consulter.');
      if (!(await env.call(proche.phone))) return fail('Cet appareil ne peut pas passer d’appel.');
      return done({ appel_propose: true }, `Appel vers ${proche.name}`);
    },

    ouvrir_ecran: ({ ecran }: { ecran: ScreenValue }) => {
      env.open(SCREENS[ecran].href);
      return done({ ouvert: true }, `Écran ouvert : ${SCREENS[ecran].label}`);
    },
  };

  return async function runTool(name: string, input: unknown): Promise<ToolOutcome> {
    const spec = SPECS.get(name);
    if (!spec) return fail(`Outil inconnu : ${name}.`);
    const problem = checkToolInput(spec, input);
    if (problem) return fail(problem);
    return handlers[name as ToolName](input);
  };
}

