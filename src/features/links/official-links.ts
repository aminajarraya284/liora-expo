export type OfficialLink = {
  id: string;
  name: string;
  /** À quoi sert le site, en quelques mots. */
  purpose: string;
  url: string;
  icon: string;
};

/**
 * Sites utiles ouverts dans le navigateur privé. Les adresses sont écrites
 * ici une fois pour toutes : l'utilisateur n'a pas à les saisir, ce qui évite
 * de tomber sur un faux site.
 */
export const OFFICIAL_LINKS: OfficialLink[] = [
  { id: 'ameli', name: 'Ameli', purpose: 'Assurance Maladie : remboursements, attestations', url: 'https://www.ameli.fr/', icon: 'mc:medical-bag' },
  { id: 'monespacesante', name: 'Mon espace santé', purpose: 'Votre carnet de santé numérique', url: 'https://www.monespacesante.fr/', icon: 'mc:heart-pulse' },
  { id: 'impots', name: 'Impôts', purpose: 'Déclarer et payer vos impôts', url: 'https://www.impots.gouv.fr/', icon: 'mc:file-document-outline' },
  { id: 'retraite', name: 'Info Retraite', purpose: 'Tous vos régimes de retraite', url: 'https://www.info-retraite.fr/', icon: 'mc:piggy-bank-outline' },
  { id: 'servicepublic', name: 'Service-Public', purpose: 'Vos démarches administratives', url: 'https://www.service-public.fr/', icon: 'mc:bank-outline' },
  { id: 'doctolib', name: 'Doctolib', purpose: 'Prendre un rendez-vous médical', url: 'https://www.doctolib.fr/', icon: 'mc:stethoscope' },
];
