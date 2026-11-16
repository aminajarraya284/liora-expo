import React, { useEffect, useId } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { NATIVE_DRIVER, useAnimatedValue } from '../../components/motion';
import { useStore } from '../../state/store';
import type { MoodKey } from './moods';

/**
 * Bandeau qui accompagne chaque humeur : un fond en dégradé et un seul motif
 * abstrait au trait fin (le même langage que les pastilles d'humeur), sans
 * scène dessinée ni personnage. Un mouvement discret anime le motif, sauf si
 * les animations sont réduites.
 */

const W = 320;
const H = 130;
const INK = 'rgba(255,255,255,0.9)';
const line = { stroke: INK, strokeWidth: 2.2, strokeLinecap: 'round' as const, fill: 'none' };

type Scene = { label: string; sky: readonly [string, string] };

const SCENES: Record<MoodKey, Scene> = {
  joyeux: { label: 'Un soleil clair sur un fond chaleureux', sky: ['#E8C27A', '#D9A354'] },
  serein: { label: 'Des lignes calmes comme une eau tranquille', sky: ['#A9C7A6', '#86AD88'] },
  neutre: { label: 'Un horizon uni et stable', sky: ['#D9C2A6', '#C4A97F'] },
  fatigue: { label: 'Un croissant de lune sur un fond assombri', sky: ['#9A95BF', '#746DA0'] },
  inquiet: { label: 'Un ciel couvert de nuages', sky: ['#93ABC2', '#6F8CA6'] },
  triste: { label: 'Une pluie fine et régulière', sky: ['#98A3B2', '#76828F'] },
};

/** Lance une animation en boucle, arrêtée si le composant disparaît ou si les animations sont réduites. */
function useLoop(value: Animated.Value, build: () => Animated.CompositeAnimation, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(build());
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, value]);
}

function Motif({ mood, drift, glowId }: { mood: MoodKey; drift: Animated.Value; glowId: string }) {
  const cx = W / 2;
  const cy = H / 2;
  switch (mood) {
    case 'joyeux':
      return (
        <>
          <Circle cx={cx} cy={cy} r={64} fill={`url(#${glowId})`} />
          <Circle cx={cx} cy={cy} r={20} {...line} strokeWidth={2.6} />
          {Array.from({ length: 10 }, (_, i) => (
            <Line key={i} x1={cx} y1={cy - 30} x2={cx} y2={cy - 40} {...line} transform={`rotate(${i * 36} ${cx} ${cy})`} />
          ))}
        </>
      );
    case 'serein':
      return (
        <>
          {[0, 1, 2].map((row) => (
            <Path key={row} d={`M${cx - 110} ${cy - 10 + row * 16} Q${cx - 70} ${cy - 24 + row * 16} ${cx - 30} ${cy - 10 + row * 16} T${cx + 50} ${cy - 10 + row * 16} T${cx + 130} ${cy - 10 + row * 16}`} {...line} opacity={1 - row * 0.22} />
          ))}
        </>
      );
    case 'neutre':
      return <Line x1={cx - 120} y1={cy} x2={cx + 120} y2={cy} {...line} strokeWidth={2} opacity={0.9} />;
    case 'fatigue':
      return (
        <>
          <Circle cx={cx} cy={cy} r={58} fill={`url(#${glowId})`} opacity={0.5} />
          <Path d={`M${cx + 16} ${cy - 26} A26 26 0 1 0 ${cx + 10} ${cy + 24} A20 20 0 0 1 ${cx + 16} ${cy - 26} Z`} {...line} strokeWidth={2.4} fill={INK} fillOpacity={0.14} />
        </>
      );
    case 'inquiet':
      return (
        <G>
          <Path d={`M${cx - 70} ${cy + 14} H${cx - 6} A18 18 0 0 0 ${cx - 6} ${cy - 22} A24 24 0 0 0 ${cx - 54} ${cy - 24} A19 19 0 0 0 ${cx - 70} ${cy + 14} Z`} {...line} strokeWidth={2.3} fill={INK} fillOpacity={0.1} />
          <Path d={`M${cx + 20} ${cy + 22} H${cx + 70} A14 14 0 0 0 ${cx + 70} ${cy - 4} A18 18 0 0 0 ${cx + 32} ${cy - 6} A15 15 0 0 0 ${cx + 20} ${cy + 22} Z`} {...line} strokeWidth={2} opacity={0.75} />
        </G>
      );
    case 'triste':
      return (
        <G>
          <Path d={`M${cx - 54} ${cy - 10} H${cx + 10} A18 18 0 0 0 ${cx + 10} ${cy - 46} A24 24 0 0 0 ${cx - 38} ${cy - 48} A19 19 0 0 0 ${cx - 54} ${cy - 10} Z`} {...line} strokeWidth={2.3} fill={INK} fillOpacity={0.12} />
          {[-40, -14, 12, 38].map((x) => (
            <Line key={x} x1={cx + x} y1={cy + 6} x2={cx + x - 8} y2={cy + 30} {...line} strokeWidth={1.8} opacity={0.7} />
          ))}
        </G>
      );
  }
}

export function MoodScene({ mood }: { mood: MoodKey }) {
  const scene = SCENES[mood];
  const { reduceMotion } = useStore();
  const ids = useId().replace(/[^a-zA-Z0-9]/g, '');
  const skyId = `moodsky${ids}`;
  const glowId = `moodglow${ids}`;
  const animated = !reduceMotion;
  const drift = useAnimatedValue(0);

  useLoop(
    drift,
    () =>
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(drift, { toValue: 0, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
      ]),
    animated,
  );

  return (
    <View style={st.frame} accessible accessibilityRole="image" accessibilityLabel={scene.label}>
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={skyId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={scene.sky[0]} />
            <Stop offset="1" stopColor={scene.sky[1]} />
          </LinearGradient>
          <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.3} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={`url(#${skyId})`} />
      </Svg>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] }) }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [-3, 3] }) }] },
        ]}>
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
          <Motif mood={mood} drift={drift} glowId={glowId} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  frame: { width: '100%', aspectRatio: W / H, borderRadius: 20, overflow: 'hidden' },
});
