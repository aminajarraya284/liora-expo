import type { ImageSourcePropType } from 'react-native';
import type { SectionKey } from './sections';

/**
 * Illustrations en relief des rubriques (barre du bas, tuiles de l'accueil,
 * menu).
 */
export const TAB_ICONS: Partial<Record<SectionKey, ImageSourcePropType>> = {
  accueil: require('../assets/icons/accueil.png'),
  traitements: require('../assets/icons/traitements.png'),
  agenda: require('../assets/icons/agenda.png'),
  profil: require('../assets/icons/profil.png'),
  journal: require('../assets/icons/journal.png'),
  nutrition: require('../assets/icons/nutrition.png'),
  relaxation: require('../assets/icons/relaxation.png'),
  proches: require('../assets/icons/proches.png'),
  'coffre-fort': require('../assets/icons/coffre-fort.png'),
  urgence: require('../assets/icons/urgence.png'),
  radio: require('../assets/icons/radio.png'),
  actualites: require('../assets/icons/actualites.png'),
  demarches: require('../assets/icons/demarches.png'),
  humeur: require('../assets/moods/joyeux.png'),
  assistant: require('../assets/icons/assistant.png'),
  parametres: require('../assets/icons/parametres.png'),
  accessibilite: require('../assets/icons/accessibilite.png'),
};
