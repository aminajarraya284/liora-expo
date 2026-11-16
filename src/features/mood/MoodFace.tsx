import React from 'react';
import { Image } from 'react-native';
import type { MoodKey } from './moods';

/** Visages d'humeur en relief. Purement décoratifs : le libellé est donné à côté. */
const FACES: Record<MoodKey, number> = {
  joyeux: require('../../../assets/moods/joyeux.png'),
  serein: require('../../../assets/moods/serein.png'),
  neutre: require('../../../assets/moods/neutre.png'),
  fatigue: require('../../../assets/moods/fatigue.png'),
  inquiet: require('../../../assets/moods/inquiet.png'),
  triste: require('../../../assets/moods/triste.png'),
};

export function MoodFace({ mood, size = 64 }: { mood: MoodKey; size?: number }) {
  return <Image source={FACES[mood]} style={{ width: size, height: size }} resizeMode="contain" accessible={false} />;
}
