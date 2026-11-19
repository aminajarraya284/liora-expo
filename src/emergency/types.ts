export type EmergencyStatus = 'waiting' | 'active' | 'denied' | 'revoked' | 'expired';

export type EmergencyKey = {
  id: string;
  procheId: string;
  procheName: string;
  recipientEmail: string;
  documentIds: string[];
  createdAt: string;
  revokedAt: string | null;
};

export type EmergencyRequest = {
  id: string;
  keyId: string;
  ownerName: string;
  procheName: string;
  reason: string;
  requestedAt: string;
  opensAt: string;
  expiresAt: string;
  status: EmergencyStatus;
  role: 'owner' | 'recipient';
};

export type EmergencyState = {
  keys: EmergencyKey[];
  requests: EmergencyRequest[];
  serverNow: string;
};

export type CreateEmergencyKey = {
  procheId: string;
  recipientEmail: string;
  documentIds: string[];
};

export type EmergencyDocument = {
  id: string;
  name: string;
  kind: string;
  size: number;
  date: string;
  path: string;
};

export type EmergencyDocuments = {
  ownerName: string;
  expiresAt: string;
  documents: EmergencyDocument[];
};

export const EMERGENCY_STATUS_LABEL: Record<EmergencyStatus, string> = {
  waiting: 'En attente — délai de 48 h',
  active: 'Accès ouvert',
  denied: 'Demande refusée',
  revoked: 'Clé révoquée',
  expired: 'Accès expiré',
};
