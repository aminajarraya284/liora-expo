export interface Medication {
  id: string;
  nom: string;
  dosage: string;
  frequence: string;
  duree: string;
  prisAujourdhui: boolean;
  horaire: string;
  stock: number;
  stockMax: number;
}

export interface Appointment {
  id: string;
  titre: string;
  date: string;
  heure: string;
  categorie: 'médical' | 'familial' | 'administratif' | 'autre';
  description?: string;
  documentAssocie?: string;
  partageAvecProche: boolean;
}

export interface SecureDocument {
  id: string;
  titre: string;
  categorie: 'santé' | 'assurance' | 'contrat' | 'facture' | 'administratif';
  dateAjout: string;
  urlSimulee: string;
  partageSelectif: boolean;
}

export interface PasswordEntry {
  id: string;
  service: string;
  identifiant: string;
  motDePasse: string;
  logoUrl?: string;
}

export interface RelativeContact {
  id: string;
  nom: string;
  relation: string;
  telephone: string;
  photoUrl?: string;
  partages: {
    agenda: boolean;
    documents: boolean;
    sante: boolean;
  };
}

export interface AppAccessLog {
  id: string;
  date: string;
  acteur: string;
  action: string;
  statut: 'success' | 'warning' | 'info';
}

export interface JournalEntry {
  id: string;
  date: string;
  humeur: 'excellent' | 'bien' | 'moyen' | 'triste';
  note: string;
}
