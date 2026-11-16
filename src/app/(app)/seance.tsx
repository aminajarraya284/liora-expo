import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { AMBIENCES, GUIDED, type Session, type SessionKey, sessionSeconds, SESSIONS, stepAt } from '../../features/relax/content';
import { useAmbience } from '../../features/relax/useAmbience';
import { mmss } from '../../lib';
import { useStore } from '../../store';
import { Btn, Header, NATIVE_DRIVER, OutlineBtn, Screen, T, Toggle, useBack, usePalette } from '../../ui';
import { useAnimatedValue } from '../../components/motion';

const SMALL = 0.62;

export default function Seance() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const session: Session = SESSIONS[type as SessionKey] ?? SESSIONS.respiration;
  const { settings, reduceMotion } = useStore();
  const goBack = useBack('/relaxation');
  const palette = usePalette();
  const { start, stop } = useAmbience();
  const total = sessionSeconds(session);
  const breathing = !!session.loopMinutes;
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  // L'ambiance accompagne d'office les séances guidées ; pour la respiration et la gym, elle se choisit.
  const [sound, setSound] = useState(GUIDED.includes(type as SessionKey));
  const seconds = useRef(0);
  const scale = useAnimatedValue(SMALL);
  const done = elapsed >= total;
  const { index, inStep } = stepAt(session, elapsed);
  const step = session.steps[index];

  useEffect(() => () => { Speech.stop(); }, []);

  // Minuteur : il s'arrête de lui-même à la fin de la séance.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      seconds.current += 1;
      setElapsed(seconds.current);
      if (seconds.current >= total) setRunning(false);
    }, 1000);
    return () => clearInterval(timer);
  }, [running, total]);

  // Son d'ambiance pendant la séance.
  useEffect(() => {
    if (running && sound) start(session.ambience);
    else stop();
  }, [running, sound, start, stop, session.ambience]);

  // À chaque nouvelle étape : consigne vocale et mouvement du cercle.
  useEffect(() => {
    if (!running) {
      scale.stopAnimation();
      return;
    }
    if (settings.speech) {
      Speech.stop();
      Speech.speak(step.text, { language: 'fr-FR', rate: 0.9 });
    }
    if (reduceMotion) return;
    const smooth = Easing.inOut(Easing.sin);
    const animation =
      step.grow === undefined
        ? Animated.loop(
            Animated.sequence([
              Animated.timing(scale, { toValue: 1, duration: 6000, easing: smooth, useNativeDriver: NATIVE_DRIVER }),
              Animated.timing(scale, { toValue: SMALL, duration: 6000, easing: smooth, useNativeDriver: NATIVE_DRIVER }),
            ]),
          )
        : Animated.timing(scale, { toValue: step.grow ? 1 : SMALL, duration: (step.seconds - inStep) * 1000, easing: smooth, useNativeDriver: NATIVE_DRIVER });
    animation.start();
    return () => animation.stop();
    // Le mouvement ne repart qu'au changement d'étape, pas à chaque seconde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, index, reduceMotion, settings.speech]);

  /** Passe tout de suite à l'étape suivante (ou termine la séance après la dernière). */
  const nextStep = () => {
    const next = Math.min(total, elapsed - inStep + step.seconds);
    seconds.current = next;
    setElapsed(next);
    if (next >= total) setRunning(false);
  };

  const restart = () => {
    seconds.current = 0;
    setElapsed(0);
    scale.setValue(SMALL);
    setRunning(true);
  };

  return (
    <Screen section="relaxation" speak={`${session.title}. ${session.intro}`} scroll={false} voice={false}>
      <Header title={session.title} fallback="/relaxation" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, transform: [{ scale }] }}>
            <LinearGradient colors={['#D9C6EC', '#A487C2']} style={{ flex: 1, borderRadius: 100, opacity: 0.9 }} />
          </Animated.View>
          <T v="h1" c="#3F2A5C" style={{ fontSize: 34 }} accessibilityLabel={`Temps restant : ${mmss(Math.max(0, total - elapsed))}`}>{mmss(Math.max(0, total - elapsed))}</T>
        </View>
        <T v="small" c={palette.ink} style={{ marginTop: 16, letterSpacing: 1, minHeight: 22 }}>
          {done ? 'SÉANCE TERMINÉE' : !breathing && (running || elapsed > 0) ? `ÉTAPE ${index + 1} SUR ${session.steps.length}` : ''}
        </T>
        <T v="h2" center style={{ marginTop: 4, minHeight: 96, paddingHorizontal: 8 }} accessibilityLiveRegion="polite">
          {done ? session.outro : running || elapsed > 0 ? step.text : session.intro}
        </T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 14, paddingHorizontal: 6 }}>
        <T v="bodyBold" style={{ flex: 1 }}>Ambiance : {AMBIENCES[session.ambience].label}</T>
        <Toggle value={sound} onChange={setSound} label={`Ambiance sonore : ${AMBIENCES[session.ambience].label}`} />
      </View>
      {done ? (
        <View style={{ gap: 10 }}>
          <Btn label="Terminer" icon="checkmark" onPress={goBack} />
          <OutlineBtn label="Recommencer" icon="refresh-outline" onPress={restart} />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Btn label={running ? 'Pause' : elapsed > 0 ? 'Reprendre' : 'Commencer'} icon={running ? 'pause' : 'play'} onPress={() => setRunning((r) => !r)} />
          {!breathing && elapsed > 0 && <OutlineBtn small label="Étape suivante" icon="play-skip-forward-outline" onPress={nextStep} />}
        </View>
      )}
    </Screen>
  );
}
