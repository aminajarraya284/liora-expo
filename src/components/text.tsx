import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useStore } from '../state/store';
import { C, F } from '../theme';

const VARIANTS = {
  h1: { font: F.serif, size: 30, title: true },
  h2: { font: F.serif, size: 23, title: true },
  h3: { font: F.serifSemi, size: 21, title: true },
  title: { font: F.bold, size: 19, title: true },
  body: { font: F.reg, size: 18, title: false },
  bodyBold: { font: F.bold, size: 18, title: false },
  small: { font: F.semi, size: 16, title: false },
  btn: { font: F.bold, size: 19, title: false },
} as const;

export type TextVariant = keyof typeof VARIANTS;

/** Agrandissement appliqué par le réglage « Grand texte ». */
export const BIG_TEXT_SCALE = 1.18;

/** Couleurs de texte et de cadre, plus marquées avec « Contraste renforcé ». */
export function useColors() {
  const { settings } = useStore();
  const hc = settings.highContrast;
  return {
    hc,
    title: hc ? '#14100D' : C.title,
    text: hc ? '#1C1714' : C.text,
    muted: hc ? '#3A332D' : C.muted,
    card: hc ? '#FFFFFF' : C.card,
    cardBorder: hc ? '#6E655D' : C.cardBorder,
    line: hc ? '#6E655D' : C.line,
    fieldBorder: hc ? '#3F3833' : C.fieldBorder,
  };
}

/** Texte de l'application : police, taille et couleur cohérentes partout. */
export function T({ v = 'body', c, center, style, ...props }: TextProps & { v?: TextVariant; c?: string; center?: boolean }) {
  const { settings } = useStore();
  const colors = useColors();
  const variant = VARIANTS[v];
  const size = variant.size * (settings.bigText ? BIG_TEXT_SCALE : 1);
  return (
    <Text
      {...props}
      style={[
        { fontFamily: variant.font, fontSize: size, lineHeight: Math.round(size * 1.38), color: c ?? (variant.title ? colors.title : colors.text) },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}
