import type { SavedLink } from '../../state/types';
import { parseHttpsUrl } from '../../utils/validation';
import { OFFICIAL_LINKS } from './official-links';

/**
 * Retrouve le site à ouvrir à partir de son identifiant.
 * Le navigateur privé n'accepte que les sites de la liste ou les liens
 * enregistrés par la personne : une adresse quelconque, glissée dans un lien
 * reçu par message, ne peut pas s'y ouvrir.
 */
export function resolveLink(id: string | undefined, saved: SavedLink[]): { title: string; url: string } | null {
  if (!id) return null;
  const official = OFFICIAL_LINKS.find((link) => link.id === id);
  if (official) return { title: official.name, url: official.url };
  const personal = saved.find((link) => link.id === id);
  if (personal && parseHttpsUrl(personal.url)) return { title: personal.name, url: personal.url };
  return null;
}
