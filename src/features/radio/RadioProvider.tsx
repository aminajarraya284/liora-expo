import { type AudioPlayer, type AudioStatus, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Station } from './stations';

/**
 * Lecteur de radio unique pour toute l'application : la station continue de
 * jouer quand on change d'écran, et se pilote depuis l'accueil ou la page Radio.
 */

export type RadioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

type Radio = {
  station: Station | null;
  status: RadioStatus;
  /** Lance une station (ou la relance si elle était en pause). */
  play: (station: Station) => void;
  /** Lecture / pause de la station en cours. */
  toggle: () => void;
  /** Arrête la radio et libère le lecteur. */
  stop: () => void;
};

const RadioContext = createContext<Radio>(null as unknown as Radio);
export const useRadio = () => useContext(RadioContext);

/** Au-delà de ce délai sans son, on considère que la station ne répond pas. */
const CONNECT_TIMEOUT_MS = 15000;

export function RadioProvider({ children }: { children: React.ReactNode }) {
  const [station, setStation] = useState<Station | null>(null);
  const [status, setStatus] = useState<RadioStatus>('idle');
  const player = useRef<AudioPlayer | null>(null);
  const subscription = useRef<{ remove: () => void } | null>(null);
  const wantsToPlay = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
  };

  const release = useCallback(() => {
    clearTimer();
    wantsToPlay.current = false;
    subscription.current?.remove();
    subscription.current = null;
    try {
      player.current?.pause();
      player.current?.remove();
    } catch {
      /* lecteur déjà libéré */
    }
    player.current = null;
  }, []);

  const onStatus = useCallback((update: AudioStatus) => {
    if (!wantsToPlay.current) return;
    if (update.error) {
      clearTimer();
      wantsToPlay.current = false;
      setStatus('error');
    } else if (update.playing && !update.isBuffering) {
      clearTimer();
      setStatus('playing');
    } else {
      setStatus('loading');
    }
  }, []);

  const play = useCallback((next: Station) => {
    release();
    wantsToPlay.current = true;
    setStation(next);
    setStatus('loading');
    try {
      // Un flux en direct se relance toujours depuis le début : on recrée le lecteur à chaque fois.
      const created = createAudioPlayer({ uri: next.url });
      player.current = created;
      subscription.current = created.addListener('playbackStatusUpdate', onStatus);
      setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
      created.play();
      try {
        created.setActiveForLockScreen(true, { title: next.name, artist: 'Radio LIORA' });
      } catch {
        /* commandes de l'écran verrouillé indisponibles : la radio joue quand même */
      }
      timeout.current = setTimeout(() => {
        if (!wantsToPlay.current) return;
        release();
        setStatus('error');
      }, CONNECT_TIMEOUT_MS);
    } catch {
      release();
      setStatus('error');
    }
  }, [onStatus, release]);

  const stop = useCallback(() => {
    release();
    setStation(null);
    setStatus('idle');
  }, [release]);

  const toggle = useCallback(() => {
    if (!station) return;
    if (status === 'playing' || status === 'loading') {
      release();
      setStatus('paused');
    } else {
      play(station);
    }
  }, [station, status, play, release]);

  useEffect(() => release, [release]);

  const value = useMemo<Radio>(() => ({ station, status, play, toggle, stop }), [station, status, play, toggle, stop]);
  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
}
