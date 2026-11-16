import { Medication, Appointment, SecureDocument, PasswordEntry, RelativeContact, AppAccessLog, JournalEntry } from './types';

export const INITIAL_MEDICATIONS: Medication[] = [
  {
    id: 'med-1',
    nom: 'Kardegic',
    dosage: '75 mg',
    frequence: '1 sachet le matin',
    duree: 'Traitement de fond',
    prisAujourdhui: true,
    horaire: '08:00',
    stock: 24,
    stockMax: 30
  },
  {
    id: 'med-2',
    nom: 'Levothyrox',
    dosage: '100 µg',
    frequence: '1 comprimé à jeun',
    duree: 'Traitement de fond',
    prisAujourdhui: false,
    horaire: '07:30',
    stock: 5,
    stockMax: 30
  },
  {
    id: 'med-3',
    nom: 'Doliprane',
    dosage: '1000 mg',
    frequence: 'Si douleurs (max 3/jour)',
    duree: 'Ponctuel',
    prisAujourdhui: false,
    horaire: 'À la demande',
    stock: 14,
    stockMax: 16
  }
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'app-1',
    titre: 'Dr. Martin (Cardiologue)',
    date: '2026-07-04',
    heure: '10:00',
    categorie: 'médical',
    description: 'Visite de contrôle annuelle. Apporter la dernière ordonnance.',
    documentAssocie: 'Ordonnance_Controle_Cardio.pdf',
    partageAvecProche: true
  },
  {
    id: 'app-2',
    titre: 'Déjeuner de famille Sophie',
    date: '2026-07-05',
    heure: '12:30',
    categorie: 'familial',
    description: 'Au bistrot du coin avec les petits-enfants.',
    partageAvecProche: false
  },
  {
    id: 'app-3',
    titre: 'Rendez-vous conseiller Mutuelle',
    date: '2026-07-08',
    heure: '14:30',
    categorie: 'administratif',
    description: 'Mise au point sur les remboursements optiques.',
    documentAssocie: 'Contrat_Mutuelle_Sante.pdf',
    partageAvecProche: true
  }
];

export const INITIAL_DOCUMENTS: SecureDocument[] = [
  {
    id: 'doc-1',
    titre: 'Attestation de Mutuelle 2026',
    categorie: 'assurance',
    dateAjout: '2026-01-15',
    urlSimulee: 'Attestation_Mutuelle.pdf',
    partageSelectif: true
  },
  {
    id: 'doc-2',
    titre: 'Contrat Assurance Habitation',
    categorie: 'assurance',
    dateAjout: '2025-11-20',
    urlSimulee: 'Assurance_Habitation.pdf',
    partageSelectif: false
  },
  {
    id: 'doc-3',
    titre: 'Dernière Ordonnance Cardio',
    categorie: 'santé',
    dateAjout: '2026-05-10',
    urlSimulee: 'Ordonnance_Cardio_Mai26.pdf',
    partageSelectif: true
  },
  {
    id: 'doc-4',
    titre: 'Justificatif de Domicile EDF',
    categorie: 'facture',
    dateAjout: '2026-06-01',
    urlSimulee: 'EDF_Facture_Juin26.pdf',
    partageSelectif: false
  }
];

export const INITIAL_PASSWORDS: PasswordEntry[] = [
  {
    id: 'pwd-1',
    service: 'Mon Espace Santé (Ameli)',
    identifiant: 'pierre.dupond@orange.fr',
    motDePasse: 'Sante2026!Securise'
  },
  {
    id: 'pwd-2',
    service: 'Impots Gouv',
    identifiant: '1234567890123',
    motDePasse: 'ImpotsPierre99*'
  },
  {
    id: 'pwd-3',
    service: 'Compte EDF',
    identifiant: 'pierre.dupond@orange.fr',
    motDePasse: 'SoleilBleu12%'
  }
];

export const INITIAL_RELATIVES: RelativeContact[] = [
  {
    id: 'rel-1',
    nom: 'Jean-Marc Dupond (Fils)',
    relation: 'Fils',
    telephone: '06 12 34 56 78',
    partages: {
      agenda: true,
      documents: false,
      sante: true
    }
  },
  {
    id: 'rel-2',
    nom: 'Sophie Bernard (Fille)',
    relation: 'Fille',
    telephone: '06 98 76 54 32',
    partages: {
      agenda: true,
      documents: true,
      sante: true
    }
  }
];

export const INITIAL_LOGS: AppAccessLog[] = [
  {
    id: 'log-1',
    date: '2026-07-02 18:45',
    acteur: 'Sophie Bernard (Fille)',
    action: 'A consulté l\'agenda partagé',
    statut: 'success'
  },
  {
    id: 'log-2',
    date: '2026-07-02 14:12',
    acteur: 'Liora App',
    action: 'Sauvegarde automatique sécurisée des mots de passe',
    statut: 'info'
  },
  {
    id: 'log-3',
    date: '2026-07-01 09:30',
    acteur: 'Jean-Marc Dupond (Fils)',
    action: 'Demande d\'accès d\'urgence aux documents d\'assurance initiée',
    statut: 'warning'
  }
];

export const INITIAL_JOURNAL: JournalEntry[] = [
  {
    id: 'j-1',
    date: '2026-07-02',
    humeur: 'excellent',
    note: 'Excellente journée avec les enfants hier au parc. Très en forme.'
  },
  {
    id: 'j-2',
    date: '2026-07-01',
    humeur: 'bien',
    note: 'Petite marche d\'une heure ce matin, pas de douleur.'
  }
];

export const OFFICIAL_SITES = [
  { name: "Impôts Gouv", url: "https://www.impots.gouv.fr", desc: "Déclarer vos revenus et payer vos taxes.", logo: "🏛️" },
  { name: "Ameli Assurance Maladie", url: "https://www.ameli.fr", desc: "Suivre vos remboursements de santé.", logo: "🏥" },
  { name: "L'Assurance Retraite", url: "https://www.lassuranceretraite.fr", desc: "Consulter votre espace retraite personnel.", logo: "👵" },
  { name: "Mon Espace Santé", url: "https://www.monespacesante.fr", desc: "Dossier médical partagé et ordonnances.", logo: "🧬" },
  { name: "La Banque Postale", url: "https://www.labanquepostale.fr", desc: "Suivi sécurisé de vos comptes bancaires.", logo: "🏦" }
];

export const RADIOS = [
  { id: 'rad-1', name: 'France Inter', freq: 'Direct', url: 'https://stream.radiofrance.fr/franceinter/franceinter.m3u8?id=radiofrance' },
  { id: 'rad-2', name: 'France Culture', freq: 'Direct', url: 'https://stream.radiofrance.fr/franceculture/franceculture.m3u8?id=radiofrance' },
  { id: 'rad-3', name: 'RTL', freq: 'Direct', url: 'https://stream.rtl.fr/rtl.mp3' },
  { id: 'rad-4', name: 'Radio Classique', freq: 'Direct', url: 'https://radioclassique.ice.infomaniak.ch/radioclassique-high.mp3' },
  { id: 'rad-5', name: 'Nostalgie', freq: 'Direct', url: 'https://audio.nrj.fr/fr/30601/mp3_128.mp3' }
];

export const PHYSICAL_EXERCISES = [
  {
    id: 'ex-1',
    name: 'Équilibre sur une jambe',
    duration: '2 minutes',
    desc: 'Renforce les chevilles et améliore la stabilité au quotidien.',
    steps: ['Tenez-vous debout près d\'une chaise.', 'Levez doucement le pied gauche.', 'Maintenez la position 30 secondes.', 'Changez de jambe.'],
    emoji: '🧘‍♂️'
  },
  {
    id: 'ex-2',
    name: 'Étirement du haut du corps',
    duration: '3 minutes',
    desc: 'Détend le cou, les épaules et améliore la posture respiratoire.',
    steps: ['Asseyez-vous bien droit.', 'Entrelacez vos doigts et étirez vos bras vers le ciel.', 'Inclinez-vous doucement à gauche puis à droite.'],
    emoji: '🤸‍♀️'
  },
  {
    id: 'ex-3',
    name: 'Mobilité des hanches et genoux',
    duration: '4 minutes',
    desc: 'Idéal pour faciliter la marche et les montées d\'escalier.',
    steps: ['Assis, levez alternativement un genou vers la poitrine.', 'Effectuez des rotations douces des chevilles.', 'Répétez 10 fois par jambe.'],
    emoji: '🚶‍♀️'
  }
];
