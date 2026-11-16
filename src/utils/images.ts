import type { ImageSourcePropType } from 'react-native';

/** Images embarquées du contenu d'exemple. */
const SEED_IMG: Record<string, number> = {
  av_claire: require('../../assets/img/av_claire.png'),
  av_sophie: require('../../assets/img/av_sophie.png'),
  av_marc: require('../../assets/img/av_marc.png'),
  av_elise: require('../../assets/img/av_elise.png'),
  j1: require('../../assets/img/j1.png'),
  j2: require('../../assets/img/j2.png'),
  j3: require('../../assets/img/j3.png'),
  m1: require('../../assets/img/m1.png'),
  m2: require('../../assets/img/m2.png'),
  m3: require('../../assets/img/m3.png'),
};

/** Une photo est soit une adresse de fichier, soit « seed:nom » pour une image embarquée. */
export const imgSource = (photo?: string | null): ImageSourcePropType | null => {
  if (!photo) return null;
  if (photo.startsWith('seed:')) return SEED_IMG[photo.slice(5)] ?? null;
  return { uri: photo };
};
