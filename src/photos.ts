import type { ImageSourcePropType } from 'react-native';

/**
 * Photos d'ambiance de l'application : une par page.
 * Pour changer une photo, remplacez le fichier dans `assets/photos`
 * (format paysage, idéalement 1200 px de large ou plus).
 */
export const PHOTOS = {
  // Rubriques
  accueil: require('../assets/photos/bienvenue.jpg'),
  agenda: require('../assets/photos/agenda.jpg'),
  humeur: require('../assets/photos/bien-etre.jpg'),
  journal: require('../assets/photos/journal.jpg'),
  nutrition: require('../assets/photos/nutrition.jpg'),
  relaxation: require('../assets/photos/relaxation.jpg'),
  proches: require('../assets/photos/famille.jpg'),
  'coffre-fort': require('../assets/photos/coffre-fort.jpg'),
  urgence: require('../assets/photos/urgence.jpg'),
  profil: require('../assets/photos/profil.jpg'),
  parametres: require('../assets/photos/reglages.jpg'),
  accessibilite: require('../assets/photos/accessibilite.jpg'),
  radio: require('../assets/photos/radio.jpg'),
  demarches: require('../assets/photos/demarches.jpg'),
  // Connexion
  connexion: require('../assets/photos/connexion.jpg'),
  inscription: require('../assets/photos/inscription.jpg'),
  motDePasseOublie: require('../assets/photos/mot-de-passe-oublie.jpg'),
  // Pages de réglages et encarts
  notifications: require('../assets/photos/notifications.jpg'),
  confidentialite: require('../assets/photos/confidentialite.jpg'),
  hydratation: require('../assets/photos/hydratation.jpg'),
} as const satisfies Record<string, ImageSourcePropType>;

export type PhotoKey = keyof typeof PHOTOS;

/** Photo d'une rubrique, s'il y en a une. */
export const sectionPhoto = (section?: string): ImageSourcePropType | undefined =>
  section && section in PHOTOS ? PHOTOS[section as PhotoKey] : undefined;
