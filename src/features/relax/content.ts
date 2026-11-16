import type { ImageSourcePropType } from 'react-native';
import type { Session as BaseSession, Step } from './logic';

export { dailyIdea, sessionMinutes, sessionSeconds, stepAt } from './logic';

/** Ambiances sonores, jouées en boucle. */
export const AMBIENCES = {
  pluie: { label: 'Pluie douce', hint: 'Pluie légère et oiseaux', icon: 'rainy-outline', art: require('../../../assets/icons/relax/pluie.png'), source: require('../../../assets/audio/pluie.wav') },
  vagues: { label: 'Vagues', hint: 'Le va-et-vient de la mer', icon: 'water-outline', art: require('../../../assets/icons/relax/vagues.png'), source: require('../../../assets/audio/vagues.wav') },
  feu: { label: 'Feu de cheminée', hint: 'Un feu qui crépite', icon: 'flame-outline', art: require('../../../assets/icons/relax/feu.png'), source: require('../../../assets/audio/feu.wav') },
  carillon: { label: 'Carillon', hint: 'Quelques notes dans le vent', icon: 'musical-notes-outline', art: require('../../../assets/icons/relax/carillon.png'), source: require('../../../assets/audio/carillon.wav') },
} as const;

export type AmbienceKey = keyof typeof AMBIENCES;
export const AMBIENCE_KEYS = Object.keys(AMBIENCES) as AmbienceKey[];

/** Durées d'écoute proposées, en minutes. */
export const LISTEN_MINUTES = [10, 20, 30] as const;

/** Une séance, avec son ambiance sonore et son image. */
export type Session = BaseSession & {
  ambience: AmbienceKey;
  /** Illustration en relief (respirations et exercices). */
  art?: ImageSourcePropType;
  /** Photo de la tuile (séances guidées). */
  image?: ImageSourcePropType;
};

const breath = (inhale: number, exhale: number): Step[] => [
  { text: 'Inspirez doucement par le nez', seconds: inhale, grow: true },
  { text: 'Expirez lentement par la bouche', seconds: exhale, grow: false },
];

/** Étapes de même durée : il suffit d'écrire les consignes. */
const guided = (seconds: number, texts: string[]): Step[] => texts.map((text) => ({ text, seconds }));

export const SESSIONS = {
  // ----- Respirer
  respiration: {
    title: 'Respiration apaisante',
    summary: 'Pour retrouver le calme',
    intro: 'Installez-vous confortablement et suivez le cercle : il grandit quand vous inspirez.',
    outro: 'Votre souffle est plus calme. Reprenez à votre rythme.',
    steps: breath(4, 6),
    loopMinutes: 5,
    ambience: 'pluie',
    art: require('../../../assets/icons/relax/souffle.png'),
  },
  coherence: {
    title: 'Souffle régulier',
    summary: 'Cinq secondes pour inspirer, cinq pour expirer',
    intro: 'Asseyez-vous le dos droit. Inspirez et expirez sur le même rythme que le cercle.',
    outro: 'Bravo. Vous pouvez refaire cet exercice plusieurs fois dans la journée.',
    steps: breath(5, 5),
    loopMinutes: 5,
    ambience: 'vagues',
    art: require('../../../assets/icons/relax/regulier.png'),
  },
  soir: {
    title: 'Souffle du soir',
    summary: 'Une expiration longue, avant de dormir',
    intro: 'Allongez-vous. Laissez l’expiration durer deux fois plus longtemps que l’inspiration.',
    outro: 'Gardez ce souffle lent, et laissez venir le sommeil.',
    steps: breath(4, 8),
    loopMinutes: 3,
    ambience: 'pluie',
    art: require('../../../assets/icons/relax/soir.png'),
  },

  // ----- Séances guidées
  corps: {
    title: 'Détente du corps',
    summary: 'Relâcher les tensions, de la tête aux pieds',
    intro: 'Allongez-vous ou asseyez-vous confortablement, les bras posés.',
    outro: 'Tout votre corps est détendu. Relevez-vous sans vous presser.',
    steps: guided(50, [
      'Fermez les yeux. Respirez calmement, sans forcer.',
      'Relâchez le front, les yeux et la mâchoire.',
      'Laissez la nuque s’assouplir, la tête bien soutenue.',
      'Laissez tomber les épaules, loin des oreilles.',
      'Détendez les bras, jusqu’au bout des doigts.',
      'Sentez votre poitrine se soulever, puis redescendre.',
      'Relâchez le ventre à chaque expiration.',
      'Laissez le dos s’appuyer de tout son poids.',
      'Détendez les hanches et les cuisses.',
      'Relâchez les mollets, les chevilles et les pieds.',
      'Parcourez tout votre corps : il est lourd et détendu.',
      'Bougez doucement les mains, puis ouvrez les yeux.',
    ]),
    ambience: 'pluie',
    image: require('../../../assets/img/s1.png'),
  },
  conscience: {
    title: 'Pleine conscience',
    summary: 'Revenir à l’instant présent',
    intro: 'Asseyez-vous confortablement, les mains posées sur les cuisses.',
    outro: 'Gardez ce calme avec vous pour la suite de la journée.',
    steps: guided(60, [
      'Posez votre attention sur l’air qui entre et qui sort.',
      'Sentez le contact de vos pieds avec le sol.',
      'Écoutez les sons autour de vous, proches puis lointains.',
      'Remarquez les sensations du corps, sans chercher à les changer.',
      'Une pensée passe ? Laissez-la filer comme un nuage.',
      'Revenez à votre souffle, simplement.',
      'Comptez dix respirations, à votre rythme.',
      'Élargissez votre attention à toute la pièce.',
      'Remerciez-vous pour ce moment.',
      'Étirez-vous doucement avant de reprendre votre journée.',
    ]),
    ambience: 'carillon',
    image: require('../../../assets/img/s2.png'),
  },
  mer: {
    title: 'Au bord de l’eau',
    summary: 'Un voyage immobile, pour s’évader',
    intro: 'Fermez les yeux et laissez-vous guider par les images.',
    outro: 'Vous pouvez revenir sur cette plage quand vous le souhaitez.',
    steps: guided(60, [
      'Imaginez une plage tranquille, en fin de journée.',
      'Le sable est tiède sous vos pieds.',
      'Écoutez les vagues : elles arrivent, puis se retirent.',
      'Un vent léger passe sur votre visage.',
      'Le ciel se teinte de rose et d’orangé.',
      'À chaque vague, vos soucis s’éloignent un peu plus.',
      'Restez là, simplement, à regarder l’horizon.',
      'Respirez profondément, puis revenez doucement ici.',
    ]),
    ambience: 'vagues',
    image: require('../../../assets/img/r_lake.png'),
  },
  reveil: {
    title: 'Réveil en douceur',
    summary: 'Délier le corps, assis, sans forcer',
    intro: 'Asseyez-vous sur une chaise, les pieds à plat. Chaque geste se fait lentement.',
    outro: 'Votre corps est réveillé. Belle journée !',
    steps: guided(50, [
      'Inspirez en grandissant le dos, puis relâchez.',
      'Roulez doucement les épaules vers l’arrière.',
      'Tournez lentement la tête, à droite puis à gauche.',
      'Ouvrez et fermez les mains plusieurs fois.',
      'Dessinez de petits cercles avec les chevilles.',
      'Prenez une grande inspiration, et souriez.',
    ]),
    ambience: 'carillon',
    image: require('../../../assets/img/j1.png'),
  },
  gratitude: {
    title: 'Trois belles choses',
    summary: 'Se souvenir de ce qui fait du bien',
    intro: 'Installez-vous au calme. Il n’y a rien à réussir, seulement à se souvenir.',
    outro: 'Vous pouvez noter ces trois belles choses dans votre journal.',
    steps: guided(60, [
      'Respirez calmement et laissez la journée se poser.',
      'Pensez à un moment agréable, même tout petit.',
      'Pensez à une personne qui compte pour vous.',
      'Pensez à une chose dont vous êtes fier.',
      'Gardez ces trois images, et souriez-leur.',
    ]),
    ambience: 'feu',
    image: require('../../../assets/photos/bienvenue.jpg'),
  },
  sommeil: {
    title: 'Sommeil serein',
    summary: 'Se préparer à une nuit paisible',
    intro: 'Allongez-vous, baissez la lumière et posez votre téléphone près de vous.',
    outro: 'Bonne nuit.',
    steps: guided(100, [
      'Respirez lentement. Il n’y a plus rien à faire aujourd’hui.',
      'Laissez votre tête s’enfoncer dans l’oreiller.',
      'Relâchez le visage, la mâchoire et les épaules.',
      'Vos bras deviennent lourds, posés sur le lit.',
      'Votre ventre se soulève doucement, comme une vague.',
      'Vos jambes deviennent lourdes à leur tour.',
      'Imaginez une maison calme, à la tombée du soir.',
      'Une lumière douce éclaire la pièce.',
      'Tout est rangé, tout est en ordre.',
      'Vos pensées ralentissent, l’une après l’autre.',
      'Laissez vos paupières se fermer complètement.',
      'Laissez venir le sommeil, sans le chercher.',
    ]),
    ambience: 'pluie',
    image: require('../../../assets/img/s3.png'),
  },
  // ----- Bouger en douceur
  echauffement: {
    title: 'Échauffement',
    summary: 'Réveiller les articulations',
    intro: 'Asseyez-vous sur une chaise stable, le dos droit, les pieds à plat.',
    outro: 'Vos articulations sont prêtes. Vous pouvez enchaîner avec une autre séance.',
    steps: guided(50, [
      'Haussez les épaules vers les oreilles, puis relâchez. Dix fois.',
      'Dessinez de grands cercles avec les épaules, vers l’arrière.',
      'Tournez lentement la tête, à droite puis à gauche.',
      'Faites tourner vos poignets, dans un sens puis dans l’autre.',
      'Levez un genou, puis l’autre, comme une marche assise.',
      'Dessinez des cercles avec chaque cheville.',
    ]),
    ambience: 'carillon',
    art: require('../../../assets/icons/relax/echauffement.png'),
  },
  chaise: {
    title: 'Gym sur chaise',
    summary: 'Tout le corps, en restant assis',
    intro: 'Asseyez-vous au bord d’une chaise stable, sans roulettes, les pieds à plat.',
    outro: 'Bravo ! Buvez un verre d’eau et reposez-vous un instant.',
    steps: guided(60, [
      'Marchez sur place, assis, en balançant les bras.',
      'Tendez une jambe devant vous, tenez trois secondes, reposez. Changez de jambe.',
      'Levez les deux bras en inspirant, baissez-les en expirant.',
      'Mains sur les épaules : dessinez des cercles avec les coudes.',
      'Penchez doucement le buste à droite, puis à gauche.',
      'Tournez le buste d’un côté, puis de l’autre, sans forcer.',
      'Serrez les genoux l’un contre l’autre cinq secondes, puis relâchez.',
      'Reprenez la marche assise, de plus en plus lentement.',
    ]),
    ambience: 'carillon',
    art: require('../../../assets/icons/relax/chaise.png'),
  },
  jambes: {
    title: 'Jambes solides',
    summary: 'Pour se lever et marcher avec assurance',
    intro: 'Placez une chaise stable contre un mur. Gardez toujours une main sur le dossier.',
    outro: 'Bravo ! Des jambes solides, c’est un pas plus sûr.',
    steps: guided(60, [
      'Assis, levez-vous lentement, puis rasseyez-vous en douceur. Aidez-vous des mains si besoin.',
      'Reposez-vous, assis, en respirant calmement.',
      'Debout, mains sur le dossier : montez sur la pointe des pieds, puis redescendez.',
      'Debout, mains sur le dossier : écartez une jambe sur le côté. Changez.',
      'Debout, mains sur le dossier : pliez un peu les genoux, puis remontez.',
      'Asseyez-vous et secouez doucement les jambes.',
    ]),
    ambience: 'carillon',
    art: require('../../../assets/icons/relax/force.png'),
  },
  equilibre: {
    title: 'Équilibre',
    summary: 'Garder un pas sûr',
    intro: 'Tenez-vous debout près d’une table ou d’un mur, une main posée dessus.',
    outro: 'Bravo ! Un peu chaque jour, et l’équilibre progresse.',
    steps: guided(60, [
      'Pieds joints, tenez-vous droit et fixez un point devant vous.',
      'Placez un pied juste devant l’autre et tenez. Changez de pied.',
      'Soulevez un pied de quelques centimètres et tenez. Changez de pied.',
      'Passez lentement le poids du corps d’un pied sur l’autre.',
      'Marchez le long de la table, en posant le talon devant la pointe de l’autre pied.',
    ]),
    ambience: 'carillon',
    art: require('../../../assets/icons/relax/equilibre.png'),
  },
  souplesse: {
    title: 'Étirements',
    summary: 'Gagner en souplesse',
    intro: 'Asseyez-vous confortablement. Chaque étirement se fait lentement, sans à-coup.',
    outro: 'Votre corps est délié. Gardez ce dos droit et ces épaules basses.',
    steps: guided(60, [
      'Entrelacez les doigts et poussez les paumes vers l’avant.',
      'Levez un bras et penchez-vous doucement du côté opposé. Changez de bras.',
      'Approchez l’oreille de l’épaule, sans lever l’épaule. Changez de côté.',
      'Tendez une jambe, talon au sol, et penchez-vous un peu vers l’avant. Changez de jambe.',
      'Arrondissez le dos en croisant les bras, puis ouvrez grand la poitrine.',
      'Respirez profondément et relâchez tout le corps.',
    ]),
    ambience: 'vagues',
    art: require('../../../assets/icons/relax/souplesse.png'),
  },
  marche: {
    title: 'Marche sur place',
    summary: 'Faire travailler le cœur, en douceur',
    intro: 'Debout près d’un appui, ou assis si vous préférez. Gardez un rythme qui vous permet de parler.',
    outro: 'Bravo ! Buvez un verre d’eau et reprenez votre souffle.',
    steps: guided(60, [
      'Marchez sur place, lentement.',
      'Levez un peu plus les genoux et balancez les bras.',
      'Ralentissez et respirez profondément.',
      'Reprenez un pas plus vif, à votre rythme.',
      'Ralentissez peu à peu, jusqu’à l’arrêt.',
    ]),
    ambience: 'carillon',
    art: require('../../../assets/icons/relax/marche.png'),
  },
  mains: {
    title: 'Mains et poignets',
    summary: 'Garder des doigts agiles',
    intro: 'Asseyez-vous, les avant-bras posés sur les cuisses ou sur une table.',
    outro: 'Vos mains sont déliées.',
    steps: guided(60, [
      'Ouvrez grand les mains, puis fermez le poing. Dix fois.',
      'Touchez le pouce avec chaque doigt, l’un après l’autre.',
      'Faites tourner lentement les poignets.',
      'Secouez doucement les mains, puis massez vos paumes.',
    ]),
    ambience: 'carillon',
    art: require('../../../assets/icons/relax/mains.png'),
  },
} as const satisfies Record<string, Session>;

export type SessionKey = keyof typeof SESSIONS;

export const BREATHING: SessionKey[] = ['respiration', 'coherence', 'soir'];
export const GUIDED: SessionKey[] = ['corps', 'conscience', 'mer', 'reveil', 'gratitude', 'sommeil'];
export const MOVEMENT: SessionKey[] = ['echauffement', 'chaise', 'jambes', 'equilibre', 'souplesse', 'marche', 'mains'];

/** Rappel de prudence affiché avant les exercices. */
export const MOVEMENT_ADVICE = 'Utilisez une chaise stable, sans roulettes. Allez à votre rythme, sans forcer. Arrêtez-vous en cas de douleur, de vertige ou d’essoufflement, et demandez l’avis de votre médecin si vous avez un doute.';
