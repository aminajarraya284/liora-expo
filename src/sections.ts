import type { Tint } from './theme';

/**
 * Les rubriques de l'application. Chacune a sa couleur, son icône et sa
 * courte description : c'est la seule source pour l'accueil, les onglets et
 * les en-têtes.
 */
export const SECTIONS = {
  accueil: { label: 'Accueil', icon: 'home-outline', iconOn: 'home', tint: 'bordeaux', href: '/accueil', hint: 'Votre journée en un coup d’œil' },
  profil: { label: 'Profil', icon: 'person-outline', iconOn: 'person', tint: 'rose', href: '/profil', hint: 'Vos informations' },
  traitements: { label: 'Traitements', icon: 'mc:pill', iconOn: 'mc:pill', tint: 'green', href: '/traitements', hint: 'Vos médicaments du jour' },
  agenda: { label: 'Agenda', icon: 'calendar-outline', iconOn: 'calendar', tint: 'sky', href: '/agenda', hint: 'Vos rendez-vous' },
  humeur: { label: 'Humeur', icon: 'happy-outline', iconOn: 'happy', tint: 'amber', href: '/humeur', hint: 'Comment vous sentez-vous ?' },
  nutrition: { label: 'Nutrition', icon: 'nutrition-outline', iconOn: 'nutrition', tint: 'orange', href: '/nutrition', hint: 'Repas et hydratation' },
  proches: { label: 'Proches', icon: 'people-outline', iconOn: 'people', tint: 'coral', href: '/proches', hint: 'Appeler ou écrire à vos proches' },
  urgence: { label: 'Urgence', icon: 'mc:alarm-light-outline', iconOn: 'mc:alarm-light', tint: 'red', href: '/urgence', hint: 'Contacts et informations vitales' },
  'coffre-fort': { label: 'Coffre-fort', icon: 'lock-closed-outline', iconOn: 'lock-closed', tint: 'indigo', href: '/coffre-fort', hint: 'Vos documents protégés' },
  demarches: { label: 'Démarches', icon: 'mc:bank-outline', iconOn: 'mc:bank', tint: 'navy', href: '/demarches', hint: 'Ameli, impôts, retraite…' },
  journal: { label: 'Journal', icon: 'book-outline', iconOn: 'book', tint: 'gold', href: '/journal', hint: 'Vos notes et souvenirs' },
  relaxation: { label: 'Relaxation', icon: 'mc:spa-outline', iconOn: 'mc:spa', tint: 'purple', href: '/relaxation', hint: 'Détente et respiration' },
  actualites: { label: 'Actualités', icon: 'newspaper-outline', iconOn: 'newspaper', tint: 'petrol', href: '/actualites', hint: 'Les titres du jour' },
  radio: { label: 'Radio', icon: 'radio-outline', iconOn: 'radio', tint: 'copper', href: '/radio', hint: 'Vos stations en direct' },
  assistant: { label: 'Assistant', icon: 'sparkles-outline', iconOn: 'sparkles', tint: 'orchid', href: '/assistant', hint: 'Posez une question à LIORA' },
  parametres: { label: 'Paramètres', icon: 'settings-outline', iconOn: 'settings', tint: 'blue', href: '/parametres', hint: 'Notifications, confidentialité' },
  accessibilite: { label: 'Accessibilité', icon: 'accessibility-outline', iconOn: 'accessibility', tint: 'teal', href: '/accessibilite', hint: 'Grand texte, contraste, lecture vocale' },
} as const satisfies Record<string, { label: string; icon: string; iconOn: string; tint: Tint; href: string; hint: string }>;

export type SectionKey = keyof typeof SECTIONS;

/**
 * Barre du bas : quatre destinations fixes, toujours dans le même ordre,
 * quel que soit l'écran affiché.
 */
export const TABS = ['accueil', 'agenda', 'proches', 'profil'] as const satisfies readonly SectionKey[];

/** Conservé pour les écrans existants : toutes les barres sont identiques. */
export const TAB_GROUPS = { main: TABS, social: TABS, bienetre: TABS } as const satisfies Record<string, readonly SectionKey[]>;

export type TabGroup = keyof typeof TAB_GROUPS;

/** Rubriques de l'accueil, regroupées par besoin. */
export const HOME_GROUPS: { title: string; sections: SectionKey[] }[] = [
  { title: 'Ma santé', sections: ['traitements', 'agenda', 'nutrition', 'humeur'] },
  { title: 'Mes proches et mes papiers', sections: ['proches', 'urgence', 'coffre-fort', 'demarches'] },
  { title: 'Mes moments', sections: ['journal', 'relaxation', 'radio', 'actualites'] },
];
