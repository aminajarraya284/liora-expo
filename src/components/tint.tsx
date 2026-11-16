import { createContext, useContext } from 'react';
import { SECTIONS, type SectionKey } from '../sections';
import { useStore } from '../state/store';
import { type Palette, type Tint, TINTS } from '../theme';

type SectionValue = { tint: Tint; section?: SectionKey };

/** Rubrique de l'écran en cours : les composants y lisent leur couleur par défaut. */
export const SectionContext = createContext<SectionValue>({ tint: 'bordeaux' });

export const useSection = () => useContext(SectionContext);

/** Couleur de la page, sauf si une couleur est demandée explicitement. */
export function useTint(explicit?: Tint): Tint {
  const { tint } = useContext(SectionContext);
  return explicit ?? tint;
}

/** Palette à utiliser, plus soutenue lorsque « Contraste renforcé » est activé. */
export function usePalette(explicit?: Tint): Palette {
  const tint = useTint(explicit);
  const { settings } = useStore();
  const p: Palette = TINTS[tint];
  if (!settings.highContrast) return p;
  return { ...p, btn: [p.btn[1], p.ink], grad: [p.grad[1], p.ink], onBtn: '#FFFFFF' };
}

export const sectionTint = (section: SectionKey): Tint => SECTIONS[section].tint;
