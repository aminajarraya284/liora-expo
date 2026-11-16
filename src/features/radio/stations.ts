import type { Tint } from '../../theme';

export type Station = {
  id: string;
  name: string;
  /** Ce que l'on y entend, en quelques mots. */
  tagline: string;
  /** Adresse du flux audio en direct. Toujours en https. */
  url: string;
  /** Couleur de la pastille. */
  tint: Tint;
  /** Lettres affichées dans la pastille. */
  badge: string;
};

/**
 * Stations proposées : les flux publics de Radio France.
 * Pour ajouter une station, ajoutez une ligne avec l'adresse https de son flux.
 * Avant une publication sur les stores, vérifiez auprès de chaque radio les
 * conditions de reprise de son flux dans une application.
 */
export const STATIONS: Station[] = [
  { id: 'franceinter', name: 'France Inter', tagline: 'Actualité, débats et humour', url: 'https://icecast.radiofrance.fr/franceinter-midfi.mp3', tint: 'red', badge: 'Inter' },
  { id: 'franceinfo', name: 'franceinfo', tagline: 'L’information en continu', url: 'https://icecast.radiofrance.fr/franceinfo-midfi.mp3', tint: 'orange', badge: 'Info' },
  { id: 'franceculture', name: 'France Culture', tagline: 'Idées, histoire et littérature', url: 'https://icecast.radiofrance.fr/franceculture-midfi.mp3', tint: 'purple', badge: 'Cult.' },
  { id: 'francemusique', name: 'France Musique', tagline: 'Musique classique et jazz', url: 'https://icecast.radiofrance.fr/francemusique-midfi.mp3', tint: 'navy', badge: 'Mus.' },
  { id: 'fip', name: 'FIP', tagline: 'Musique variée, sans publicité', url: 'https://icecast.radiofrance.fr/fip-midfi.mp3', tint: 'orchid', badge: 'FIP' },
];
