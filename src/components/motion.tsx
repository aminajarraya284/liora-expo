import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useStore } from '../state/store';

/** Les animations « natives » n'existent pas dans un navigateur. */
export const NATIVE_DRIVER = Platform.OS !== 'web';

/** Valeur animée, créée une seule fois pour toute la vie du composant (fonctionne aussi dans un navigateur). */
export function useAnimatedValue(initial: number): Animated.Value {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}

/** Légère vibration pour confirmer un geste. Sans effet sur le web ou si le téléphone ne vibre pas. */
export function tap(): void {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

/**
 * Fait apparaître son contenu en douceur (fondu + léger glissement).
 * `index` décale l'apparition pour que les blocs arrivent l'un après l'autre.
 * Sans animation si « Animations réduites » est activé.
 */
export function Appear({ index = 0, dx = 0, style, children }: { index?: number; dx?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const { reduceMotion } = useStore();
  const progress = useAnimatedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 380,
      delay: Math.min(index, 8) * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion, index]);
  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [dx ? 0 : 16, 0] }) }, { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/**
 * Zone tactile qui s'enfonce légèrement sous le doigt.
 * `style` place la zone dans la page ; `contentStyle` habille son contenu.
 */
export function PressableScale({
  children, style, contentStyle, scaleTo = 0.96, haptic = true, onPress, onPressIn, onPressOut, ...props
}: Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; scaleTo?: number; haptic?: boolean;
}) {
  const { reduceMotion } = useStore();
  const scale = useAnimatedValue(1);
  const animateTo = (value: number) => {
    if (reduceMotion) return;
    Animated.spring(scale, { toValue: value, speed: 40, bounciness: 5, useNativeDriver: NATIVE_DRIVER }).start();
  };
  return (
    <Pressable
      {...props}
      style={style}
      onPress={(e) => {
        if (haptic) tap();
        onPress?.(e);
      }}
      onPressIn={(e) => {
        animateTo(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        onPressOut?.(e);
      }}>
      <Animated.View style={[contentStyle, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Fait « rebondir » son contenu à chaque fois que `trigger` change (case cochée, humeur choisie…). */
export function Pop({ trigger, children, style }: { trigger: unknown; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { reduceMotion } = useStore();
  const scale = useAnimatedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    scale.setValue(0.8);
    const animation = Animated.spring(scale, { toValue: 1, speed: 18, bounciness: 12, useNativeDriver: NATIVE_DRIVER });
    animation.start();
    return () => animation.stop();
  }, [trigger, scale, reduceMotion]);
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

/** Lance une boucle d'animation tant que le composant est affiché, sauf si les animations sont réduites. */
function useLoop(build: () => Animated.CompositeAnimation, deps: unknown[]) {
  const { reduceMotion } = useStore();
  useEffect(() => {
    if (reduceMotion) return;
    const loop = build();
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, ...deps]);
}

/** Flotte doucement de haut en bas, comme une bulle. `delay` décale le départ pour que les éléments ne bougent pas ensemble. */
export function Float({ children, delay = 0, amplitude = 4, style }: { children: React.ReactNode; delay?: number; amplitude?: number; style?: StyleProp<ViewStyle> }) {
  const y = useAnimatedValue(0);
  useLoop(
    () =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(y, { toValue: -amplitude, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
            Animated.timing(y, { toValue: amplitude, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
          ]),
        ),
      ]),
    [y, delay, amplitude],
  );
  return <Animated.View style={[style, { transform: [{ translateY: y }] }]}>{children}</Animated.View>;
}

/** Bat doucement, comme un cœur : attire l'œil vers un bouton important. */
export function Pulse({ children, scaleTo = 1.1, style }: { children: React.ReactNode; scaleTo?: number; style?: StyleProp<ViewStyle> }) {
  const scale = useAnimatedValue(1);
  useLoop(
    () =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: scaleTo, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
          Animated.timing(scale, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
          Animated.delay(500),
        ]),
      ),
    [scale, scaleTo],
  );
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

/** Reflet de lumière qui traverse régulièrement son parent (qui doit couper ce qui dépasse). */
export function Shine({ width = 70 }: { width?: number }) {
  const x = useAnimatedValue(0);
  useLoop(
    () =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(1800),
          Animated.timing(x, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: NATIVE_DRIVER }),
          Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: NATIVE_DRIVER }),
        ]),
      ),
    [x],
  );
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: -40, bottom: -40, left: 0, width, backgroundColor: 'rgba(255,255,255,0.22)', transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-120, 520] }) }, { rotate: '18deg' }] }}
    />
  );
}
