/**
 * Contenu d'exemple (proches, documents, notes, rendez-vous…) ajouté à chaque
 * nouveau compte, pour découvrir l'application.
 *
 * - Pendant le développement (Expo Go, `expo start`) : activé.
 * - Dans une application publiée : désactivé, les personnes démarrent avec un
 *   compte vide.
 * - `EXPO_PUBLIC_DEMO_DATA=true` ou `false` force l'un ou l'autre.
 */
const FLAG = (process.env.EXPO_PUBLIC_DEMO_DATA ?? '').trim().toLowerCase();
export const SEED_DEMO_DATA = FLAG === 'true' ? true : FLAG === 'false' ? false : typeof __DEV__ !== 'undefined' && __DEV__;

export const APP_VERSION = '1.5.0';
