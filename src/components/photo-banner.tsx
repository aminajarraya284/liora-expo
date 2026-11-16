import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Animated, Easing, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import { useStore } from '../state/store';
import { shadow, type Tint } from '../theme';
import { IconTile } from './icons';
import { NATIVE_DRIVER, useAnimatedValue } from './motion';
import { T } from './text';

/**
 * Bandeau photo placé en haut d'une page : la photo occupe tout le bandeau,
 * le titre s'inscrit en blanc dans le bas, sur un voile sombre qui garantit
 * sa lisibilité quelle que soit la photo.
 */
export function PhotoBanner({
  photo, title, subtitle, icon, tint, height = 172,
}: {
  photo: ImageSourcePropType;
  title: string;
  subtitle?: string;
  /** Pastille de la rubrique, affichée à gauche du titre. */
  icon?: string;
  tint?: Tint;
  /** Hauteur minimale : le bandeau grandit si le texte prend plus de place. */
  height?: number;
}) {
  const { reduceMotion } = useStore();
  const zoom = useAnimatedValue(0);
  // Lent zoom de la photo, aller et retour, pour donner de la vie au bandeau.
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(zoom, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(zoom, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, zoom]);
  return (
    <View style={[st.frame, { minHeight: height }, shadow(0.16)]}>
      {/* Largeur et hauteur explicites : sans elles, une image embarquée garde sa taille d'origine et déborde du bandeau. */}
      <Animated.Image source={photo} style={[st.photo, { transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }] }]} resizeMode="cover" accessible={false} />
      <LinearGradient colors={['rgba(20,28,46,0)', 'rgba(20,28,46,0.25)', 'rgba(20,28,46,0.7)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      <View style={st.caption}>
        {!!icon && <IconTile icon={icon} tint={tint} size={54} />}
        <View style={{ flex: 1 }}>
          <T v="h1" c="#FFFFFF" style={st.title} accessibilityRole="header">{title}</T>
          {!!subtitle && <T c="#FFFFFF" style={st.subtitle}>{subtitle}</T>}
        </View>
      </View>
    </View>
  );
}

/** Les photos sont masquées en mode simplifié et en contraste renforcé : le texte passe avant le décor. */
export function usePhotosEnabled(): boolean {
  const { settings } = useStore();
  return !settings.simple && !settings.highContrast;
}

const st = StyleSheet.create({
  photo: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  frame: { borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', marginTop: 4, marginBottom: 20, backgroundColor: '#3A4253' },
  caption: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 72 },
  title: { fontSize: 28, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  subtitle: { marginTop: 2, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
});
