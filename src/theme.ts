/** Couleurs communes à toute l'application. */
export const C = {
  title: '#2A2420',
  text: '#3F3833',
  muted: '#6E655D',
  primary: '#2A2420',
  bg1: '#FBF7EF',
  card: '#FFFDF9',
  cardBorder: '#EBE2D2',
  line: '#EBE2D2',
  field: '#FFFFFF',
  fieldBorder: '#CFC4B2',
  danger: '#B3261E',
  ok: '#4F7A54',
  okSoft: '#E3ECE0',
  /** Surfaces claires (barre du bas, fenêtres, boutons ronds) : blanc porcelaine. */
  ivory: '#FFFDF9',
  ivorySoft: '#FFFDF9',
  /** Touche dorée, discrète : filets et contours. */
  gold: '#C9A961',
  goldSoft: '#E9DCBD',
};

export type Grad = readonly [string, string];

/**
 * Palette d'une couleur :
 * - grad  : dégradé des pastilles d'icônes et des en-têtes ;
 * - btn   : dégradé des boutons, un peu plus soutenu pour un texte bien lisible ;
 * - soft  : fond très clair (étiquettes, onglet actif) ;
 * - ink   : couleur du texte et des icônes sur fond clair ;
 * - onBtn : couleur du texte posé sur le bouton ;
 * - wash  : fond d'écran, nettement teinté de la couleur de la page en haut, plus clair en bas.
 */
export type Palette = { grad: Grad; btn: Grad; soft: string; ink: string; onBtn: string; wash: readonly [string, string, string] };

/** Mélange deux couleurs #RRGGBB : `part` = part de `a` (0 à 1). */
const mix = (a: string, b: string, part: number): string => {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(ch(a, i) * part + ch(b, i) * (1 - part)).toString(16).padStart(2, '0')).join('')}`;
};

/** Construit toute la palette d'une rubrique à partir de sa couleur principale. */
const tone = (base: string): Palette => ({
  grad: [mix(base, '#FFFFFF', 0.72), base],
  btn: [mix(base, '#FFFFFF', 0.85), base],
  soft: mix(base, '#FFFFFF', 0.15),
  ink: mix(base, '#000000', 0.88),
  onBtn: '#FFFFFF',
  wash: [mix(base, '#FBF7EF', 0.24), mix(base, '#FBF7EF', 0.12), mix(base, '#FBF7EF', 0.06)],
});

/**
 * Une couleur par rubrique, pour reconnaître chaque écran au premier regard.
 * Toutes sont assez soutenues pour porter un texte blanc bien lisible et se
 * posent sur le même fond ivoire.
 */
export const TINTS = {
  bordeaux: tone('#7A5230'), // accueil : bois clair, lumineux
  green: tone('#4F7A54'), // traitements : vert sauge
  sky: tone('#3F73A8'), // agenda : bleu doux
  amber: tone('#96690C'), // humeur : ambre et champagne
  gold: tone('#A8506A'), // journal : rose poudré
  orange: tone('#B8621C'), // nutrition : abricot
  purple: tone('#7560A8'), // relaxation : lavande
  copper: tone('#8A5226'), // radio : bois et cuivre
  coral: tone('#C4504A'), // proches : corail
  navy: tone('#3D4A9A'), // démarches : indigo
  indigo: tone('#4B2A73'), // coffre-fort : violet profond
  red: tone('#A3262A'), // urgence : rouge
  rose: tone('#6B5B4B'), // profil : taupe
  blue: tone('#5E6652'), // paramètres : olive gris
  teal: tone('#4A6660'), // accessibilité : vert de gris
  orchid: tone('#7A3F86'), // assistant : prune
  petrol: tone('#17687A'), // actualités : bleu pétrole
} as const satisfies Record<string, Palette>;

export type Tint = keyof typeof TINTS;

export const F = {
  /** Titres : la même police sans empattement que le texte, en gras, pour une lecture facile. */
  serif: 'Nunito_700Bold',
  serifSemi: 'Nunito_700Bold',
  reg: 'Nunito_400Regular',
  semi: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
};

/** Ombre très légère : les cartes se détachent sans effet décoratif. */
export const shadow = (opacity = 0.1) => ({ boxShadow: `0 2px 10px rgba(74,52,30,${opacity * 0.8})` });
