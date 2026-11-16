import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRadio } from '../radio/RadioProvider';
import { AMBIENCES, type AmbienceKey } from './content';

/**
 * Ambiance sonore jouée en boucle (pluie, vagues, feu, carillon).
 * Elle s'arrête d'elle-même quand on quitte l'écran, et coupe la radio
 * lorsqu'elle démarre pour ne pas superposer deux sons.
 */
export function useAmbience() {
  const { stop: stopRadio } = useRadio();
  const player = useRef<AudioPlayer | null>(null);
  const loaded = useRef<AmbienceKey | null>(null);
  const [playing, setPlaying] = useState(false);

  const release = useCallback(() => {
    try {
      player.current?.remove();
    } catch {
      /* lecteur déjà libéré */
    }
    player.current = null;
    loaded.current = null;
  }, []);

  const stop = useCallback(() => {
    try {
      player.current?.pause();
    } catch {
      /* lecteur déjà libéré */
    }
    setPlaying(false);
  }, []);

  /** Lance l'ambiance choisie. Renvoie false si le son ne peut pas être lu sur cet appareil. */
  const start = useCallback((ambience: AmbienceKey = 'pluie'): boolean => {
    try {
      stopRadio();
      if (loaded.current !== ambience) {
        release();
        player.current = createAudioPlayer(AMBIENCES[ambience].source);
        player.current.loop = true;
        loaded.current = ambience;
        setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
      }
      player.current?.play();
      setPlaying(true);
      return true;
    } catch {
      setPlaying(false);
      return false;
    }
  }, [stopRadio, release]);

  useEffect(() => release, [release]);

  return { playing, start, stop };
}
