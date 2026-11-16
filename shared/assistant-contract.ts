/**
 * Contrat partagé entre l'application et le serveur relais de l'assistant.
 *
 * Ce fichier est la seule source pour la liste des outils de l'assistant :
 * le serveur les déclare au modèle, l'application les exécute sur le
 * téléphone. Il ne dépend d'aucune bibliothèque, pour pouvoir être lu des
 * deux côtés.
 */

export const MOOD_VALUES = ['joyeux', 'serein', 'neutre', 'fatigue', 'inquiet', 'triste'] as const;
export type MoodValue = (typeof MOOD_VALUES)[number];

/** Rubriques que l'assistant peut consulter. Le coffre-fort n'en fait volontairement pas partie. */
export const TOPIC_VALUES = ['traitements', 'agenda', 'proches', 'journal', 'nutrition', 'humeur', 'sante', 'profil'] as const;
export type TopicValue = (typeof TOPIC_VALUES)[number];

/** Écrans que l'assistant peut ouvrir. */
export const SCREEN_VALUES = [
  'accueil', 'traitements', 'agenda', 'humeur', 'nutrition', 'proches', 'urgence', 'coffre-fort', 'demarches',
  'journal', 'relaxation', 'respiration', 'radio', 'parametres', 'accessibilite', 'profil',
] as const;
export type ScreenValue = (typeof SCREEN_VALUES)[number];

export const GLASS_VALUES = [1, 2, 3, 4] as const;

type StringSchema = { type: 'string'; description: string; enum?: readonly string[] };
type IntegerSchema = { type: 'integer'; description: string; enum: readonly number[] };
type BooleanSchema = { type: 'boolean'; description: string };
type StringArraySchema = { type: 'array'; description: string; items: { type: 'string' } };
export type PropertySchema = StringSchema | IntegerSchema | BooleanSchema | StringArraySchema;

/**
 * Définition d'un outil, au format attendu par l'API.
 * `strict: true` garantit que les arguments reçus respectent ce schéma ; il
 * impose que tous les champs soient obligatoires et qu'aucun autre ne soit accepté.
 */
export type ToolSpec = {
  name: string;
  description: string;
  strict: true;
  input_schema: {
    type: 'object';
    properties: Record<string, PropertySchema>;
    required: readonly string[];
    additionalProperties: false;
  };
};

const tool = (name: string, description: string, properties: Record<string, PropertySchema>): ToolSpec => ({
  name,
  description,
  strict: true,
  input_schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
});

const DATE = 'Date au format AAAA-MM-JJ, par exemple 2026-11-17.';
const TIME = 'Heure au format HH:MM sur 24 heures, par exemple 08:30.';

export const ASSISTANT_TOOLS: readonly ToolSpec[] = [
  tool(
    'consulter',
    'Lit ce qui est enregistré dans l’application pour une rubrique. À appeler avant de répondre à toute question sur les traitements, les rendez-vous, les proches, le journal, la nutrition, l’humeur, la santé ou le profil, et avant toute action qui demande un identifiant. Ne jamais deviner ces informations.',
    { rubrique: { type: 'string', description: 'Rubrique à lire.', enum: TOPIC_VALUES } },
  ),
  tool(
    'ajouter_rendez_vous',
    'Ajoute un rendez-vous à l’agenda. L’application demande elle-même la confirmation à la personne avant d’enregistrer.',
    {
      titre: { type: 'string', description: 'Intitulé du rendez-vous, par exemple « Dentiste ».' },
      date: { type: 'string', description: DATE },
      heure: { type: 'string', description: TIME },
      lieu: { type: 'string', description: 'Lieu du rendez-vous. Chaîne vide s’il n’a pas été précisé.' },
    },
  ),
  tool(
    'supprimer_rendez_vous',
    'Supprime un rendez-vous de l’agenda. L’application demande elle-même la confirmation à la personne.',
    { id: { type: 'string', description: 'Identifiant du rendez-vous, obtenu avec l’outil consulter (rubrique agenda).' } },
  ),
  tool(
    'ajouter_traitement',
    'Ajoute un médicament à la liste des traitements, avec ses heures de prise, tel que la personne le dicte. Ne jamais proposer soi-même une dose ou des horaires. L’application demande elle-même la confirmation.',
    {
      nom: { type: 'string', description: 'Nom du médicament.' },
      dose: { type: 'string', description: 'Dose indiquée par la personne, par exemple « 500 mg – 1 comprimé ». Chaîne vide si elle n’a pas été précisée.' },
      heures: { type: 'array', description: `Heures de prise. ${TIME}`, items: { type: 'string' } },
    },
  ),
  tool(
    'marquer_prise',
    'Coche ou décoche la prise d’un médicament pour aujourd’hui. L’application demande elle-même la confirmation.',
    {
      traitement_id: { type: 'string', description: 'Identifiant du traitement, obtenu avec l’outil consulter (rubrique traitements).' },
      heure: { type: 'string', description: `Heure de prise prévue pour ce traitement. ${TIME}` },
      prise: { type: 'boolean', description: 'true si le médicament a été pris, false pour annuler.' },
    },
  ),
  tool(
    'ajouter_note',
    'Ajoute une note datée d’aujourd’hui dans le journal. L’application demande elle-même la confirmation.',
    {
      titre: { type: 'string', description: 'Titre court de la note.' },
      texte: { type: 'string', description: 'Texte de la note, avec les mots de la personne.' },
    },
  ),
  tool(
    'ajouter_eau',
    'Ajoute des verres d’eau au suivi d’hydratation du jour (un verre = 25 cl).',
    { verres: { type: 'integer', description: 'Nombre de verres à ajouter.', enum: GLASS_VALUES } },
  ),
  tool(
    'enregistrer_humeur',
    'Enregistre l’humeur du moment dans le suivi de l’humeur, lorsque la personne dit comment elle se sent.',
    { humeur: { type: 'string', description: 'Humeur la plus proche de ce que la personne exprime.', enum: MOOD_VALUES } },
  ),
  tool(
    'appeler_proche',
    'Prépare un appel téléphonique vers un proche : le téléphone demande ensuite à la personne de valider l’appel.',
    { proche_id: { type: 'string', description: 'Identifiant du proche, obtenu avec l’outil consulter (rubrique proches).' } },
  ),
  tool(
    'ouvrir_ecran',
    'Ouvre un écran de l’application, par exemple la radio, la relaxation ou un exercice de respiration.',
    { ecran: { type: 'string', description: 'Écran à ouvrir.', enum: SCREEN_VALUES } },
  ),
];

export type ToolName =
  | 'consulter' | 'ajouter_rendez_vous' | 'supprimer_rendez_vous' | 'ajouter_traitement' | 'marquer_prise' | 'ajouter_note'
  | 'ajouter_eau' | 'enregistrer_humeur' | 'appeler_proche' | 'ouvrir_ecran';

/** Outils qui modifient des données importantes : l'application demande toujours l'accord de la personne avant de les exécuter. */
export const CONFIRM_TOOLS: readonly ToolName[] = ['ajouter_rendez_vous', 'supprimer_rendez_vous', 'ajouter_traitement', 'marquer_prise', 'ajouter_note'];

/** Limites appliquées des deux côtés. */
export const LIMITS = {
  /** Nombre maximal de messages d'une conversation envoyée au serveur. */
  maxMessages: 120,
  /** Taille maximale d'une requête de conversation, en octets. */
  maxConversationBytes: 600_000,
  /** Longueur maximale d'un message saisi par la personne. */
  maxUserText: 2000,
  /** Nombre maximal d'allers-retours d'outils pour une seule demande. */
  maxToolRounds: 8,
  /** Taille maximale de la photo du scan d'humeur, en caractères base64. */
  maxImageBase64: 1_600_000,
} as const;

/* ---------- Format des échanges application ⇄ serveur ---------- */

/** POST /v1/assistant — la conversation complète, telle que renvoyée par le serveur aux tours précédents. */
export type AssistantRequest = { messages: unknown[] };

/** Réponse : les blocs de contenu du modèle, à renvoyer tels quels au tour suivant. */
export type AssistantResponse = { content: unknown[]; stop_reason: string | null };

/** POST /v1/humeur — une photo du visage, en JPEG encodé en base64. */
export type MoodScanRequest = { image: string };

export const CONFIDENCE_VALUES = ['faible', 'moyenne', 'elevee'] as const;

export type MoodScanResponse = {
  /** null si aucun visage n'est visible ou si l'expression n'est pas lisible. */
  mood: MoodValue | null;
  confidence: (typeof CONFIDENCE_VALUES)[number];
};

export type RelayError = { error: string };
