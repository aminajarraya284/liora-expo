import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useId } from 'react';
import { Image, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { SECTIONS, type SectionKey } from '../sections';
import { TAB_ICONS } from '../tab-icons';
import { C, F, shadow, type Tint } from '../theme';
import { Float } from './motion';
import { usePalette } from './tint';

/** Icône. Nom Ionicons, ou « mc:nom » pour MaterialCommunityIcons. */
export function Icon({ name, size = 24, color = C.primary }: { name: string; size?: number; color?: string }) {
  if (name.startsWith('mc:')) return <MaterialCommunityIcons name={name.slice(3) as never} size={size} color={color} />;
  return <Ionicons name={name as never} size={size} color={color} />;
}

/** Pastille claire contenant une icône dans la couleur de la page. */
export function IconTile({ icon, tint, size = 48, radius }: { icon: string; tint?: Tint; size?: number; radius?: number }) {
  const palette = usePalette(tint);
  return (
    <View style={{ width: size, height: size, borderRadius: radius ?? size * 0.3, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.5} color={palette.ink} />
    </View>
  );
}

/**
 * Icône d'une rubrique : l'illustration en relief posée sur un fond doux de sa
 * couleur, ou, à défaut, la pastille colorée avec son pictogramme.
 */
export function SectionIcon({ section, size = 56, float, phase = 0 }: { section: SectionKey; size?: number; float?: boolean; phase?: number }) {
  const { icon, tint } = SECTIONS[section];
  const palette = usePalette(tint);
  const art = TAB_ICONS[section];
  const tile = art ? (
    <View style={[{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: C.ivory, borderWidth: 1.5, borderColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' }, shadow(0.12)]}>
      <Image source={art} style={{ width: size * 0.84, height: size * 0.84 }} resizeMode="contain" accessible={false} />
    </View>
  ) : (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: palette.btn[1], alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.52} color="#FFFFFF" />
    </View>
  );
  return float ? <Float delay={phase}>{tile}</Float> : tile;
}

const PETAL = 'M0 0 C -9 -10 -9 -24 0 -34 C 9 -24 9 -10 0 0 Z';

/** Fleur de lotus du logo, seule. */
export function LotusMark({ size = 28 }: { size?: number }) {
  // Identifiant unique : plusieurs écrans peuvent afficher le logo en même temps.
  const gradientId = `lotus${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size * 1.35} height={size} viewBox="-30 -36 60 38">
      <Defs>
        <SvgGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#E0707A" />
          <Stop offset="1" stopColor="#F8C39A" />
        </SvgGradient>
      </Defs>
      <Path d={PETAL} fill={`url(#${gradientId})`} transform="rotate(-52) scale(0.8)" />
      <Path d={PETAL} fill={`url(#${gradientId})`} transform="rotate(52) scale(0.8)" />
      <Path d={PETAL} fill={`url(#${gradientId})`} />
    </Svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.2 }} accessibilityRole="header" accessibilityLabel="LIORA">
      <LotusMark size={size} />
      <Text style={{ fontFamily: F.serifSemi, fontSize: size, color: C.title, letterSpacing: 1 }}>LIORA</Text>
    </View>
  );
}
