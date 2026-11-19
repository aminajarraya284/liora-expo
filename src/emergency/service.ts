import type { CloudRequest } from '../cloud/transport';
import { MAX_CLOUD_FILE as MAX_DOCUMENT_BYTES } from '../cloud/payload';
import { isEmail } from '../utils/validation';
import type { CreateEmergencyKey, EmergencyDocument, EmergencyDocuments, EmergencyKey, EmergencyRequest, EmergencyState } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FILE_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.bin$/;
const STATUSES = ['waiting', 'active', 'denied', 'revoked', 'expired'];
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 4000): value is string => typeof value === 'string' && value.length <= max;
const date = (value: unknown): value is string => text(value, 64) && Number.isFinite(Date.parse(value));
const uuid = (value: unknown): value is string => text(value, 36) && UUID.test(value);
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.length <= 20
  && value.every((id) => text(id, 128) && !!id) && new Set(value).size === value.length;
const invalid = () => new Error('La réponse du service d’urgence est illisible. Réessayez.');

export function normalizeEmergencyCode(value: string): string {
  const code = value.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-F0-9]{32}$/.test(code)) throw new Error('Saisissez le code complet de 32 caractères transmis par votre proche.');
  return code;
}

export function parseEmergencyKey(value: unknown): EmergencyKey {
  if (!record(value) || !uuid(value.id) || !text(value.procheId, 128) || !value.procheId
    || !text(value.procheName) || !text(value.recipientEmail, 254) || !isEmail(value.recipientEmail)
    || !ids(value.documentIds) || !date(value.createdAt) || (value.revokedAt !== null && !date(value.revokedAt))) throw invalid();
  return value as EmergencyKey;
}

export function parseEmergencyRequest(value: unknown): EmergencyRequest {
  if (!record(value) || !uuid(value.id) || !uuid(value.keyId) || !text(value.ownerName) || !text(value.procheName)
    || !text(value.reason, 500) || !date(value.requestedAt) || !date(value.opensAt) || !date(value.expiresAt)
    || !STATUSES.includes(String(value.status)) || !['owner', 'recipient'].includes(String(value.role))) throw invalid();
  return value as EmergencyRequest;
}

export function parseEmergencyState(value: unknown): EmergencyState {
  if (!record(value) || !date(value.serverNow) || !Array.isArray(value.keys) || value.keys.length > 1000
    || !Array.isArray(value.requests) || value.requests.length > 1000) throw invalid();
  return { serverNow: value.serverNow, keys: value.keys.map(parseEmergencyKey), requests: value.requests.map(parseEmergencyRequest) };
}

export function parseEmergencyDocuments(value: unknown): EmergencyDocuments {
  if (!record(value) || !text(value.ownerName) || !date(value.expiresAt) || !Array.isArray(value.documents) || value.documents.length > 20) throw invalid();
  const documents = value.documents.map((doc): EmergencyDocument => {
    if (!record(doc) || !text(doc.id, 128) || !doc.id || !text(doc.name) || !text(doc.kind, 8) || !/^[A-Z0-9]{1,8}$/.test(doc.kind)
      || !date(doc.date) || typeof doc.size !== 'number' || !Number.isFinite(doc.size) || doc.size < 0 || doc.size > MAX_DOCUMENT_BYTES
      || !text(doc.path, 80) || !FILE_PATH.test(doc.path)) throw invalid();
    return doc as EmergencyDocument;
  });
  return { ownerName: value.ownerName, expiresAt: value.expiresAt, documents };
}

type Options = {
  transport: { operation(): Promise<CloudRequest>; cancel(): void };
  newId(): string;
  randomCode(): Promise<string>;
  hash(code: string): Promise<string>;
};

/** The service carries only the permitted document list. It never opens the owner's account. */
export function createEmergencyService({ transport, newId, randomCode, hash }: Options) {
  let pendingCreate: { signature: string; id: string; code: string } | null = null;
  const rpc = async (name: string, body: Record<string, unknown> = {}) => {
    try {
      const request = await transport.operation();
      const result: unknown = await request(`/rest/v1/rpc/liora_emergency_${name}`, 'POST', JSON.stringify(body));
      if (record(result) && result.error === 'RATE_LIMITED') throw new Error('Trop de tentatives. Patientez quelques minutes avant de réessayer.');
      if (record(result) && result.error) throw new Error('Code indisponible pour ce compte. Vérifiez le code et l’adresse e-mail choisie par votre proche.');
      return result;
    } catch (error) {
      if (error instanceof Error && !/^[A-Z_]+$/.test(error.message)) throw error;
      throw new Error('Action impossible. Vérifiez votre connexion, votre compte en ligne et la disponibilité de la clé.');
    }
  };
  const validId = (id: string) => { if (!UUID.test(id)) throw invalid(); };

  return {
    async list(): Promise<EmergencyState> { return parseEmergencyState(await rpc('list')); },
    async create(input: CreateEmergencyKey): Promise<{ code: string }> {
      const email = input.recipientEmail.trim().toLowerCase();
      if (!isEmail(email) || email.length > 254 || !input.procheId || input.procheId.length > 128 || !ids(input.documentIds)) {
        throw new Error('Choisissez un proche, son adresse e-mail et entre 1 et 20 documents.');
      }
      const signature = JSON.stringify([input.procheId, email, [...input.documentIds].sort()]);
      if (pendingCreate?.signature !== signature) {
        pendingCreate = { signature, id: newId(), code: normalizeEmergencyCode(await randomCode()) };
      }
      const { code, id } = pendingCreate;
      validId(id);
      parseEmergencyKey(await rpc('create', {
        p_id: id, p_proche_id: input.procheId, p_recipient_email: email,
        p_document_ids: [...input.documentIds].sort(), p_code_hash: await hash(code),
      }));
      pendingCreate = null;
      return { code: code.match(/.{4}/g)!.join('-') };
    },
    async request(code: string, reason: string): Promise<EmergencyRequest> {
      if (!reason.trim() || reason.trim().length > 500) throw new Error('Indiquez le motif de votre demande en 500 caractères maximum.');
      return parseEmergencyRequest(await rpc('request', { p_code_hash: await hash(normalizeEmergencyCode(code)), p_reason: reason.trim() }));
    },
    async decide(requestId: string, decision: 'approve' | 'deny'): Promise<void> {
      validId(requestId);
      if (!['approve', 'deny'].includes(decision)) throw invalid();
      await rpc('decide', { p_request_id: requestId, p_decision: decision });
    },
    async revoke(keyId: string): Promise<void> { validId(keyId); await rpc('revoke', { p_key_id: keyId }); },
    async documents(requestId: string): Promise<EmergencyDocuments> {
      validId(requestId);
      return parseEmergencyDocuments(await rpc('documents', { p_request_id: requestId }));
    },
    async download(requestId: string, documentId: string): Promise<{ document: EmergencyDocument; bytes: Uint8Array }> {
      validId(requestId);
      // Fetch authorization again immediately before every download, including repeated opens.
      const allowed = parseEmergencyDocuments(await rpc('documents', { p_request_id: requestId }));
      const document = allowed.documents.find((doc) => doc.id === documentId);
      if (!document) throw new Error('Ce document n’est plus accessible avec cette clé.');
      const request = await transport.operation();
      let bytes: unknown;
      try { bytes = await request(`/storage/v1/object/authenticated/liora-files/${document.path}`, 'GET', undefined, true); }
      catch { throw new Error('Le téléchargement a été interrompu. Vérifiez votre connexion ou demandez à votre proche si l’accès est toujours autorisé.'); }
      if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_DOCUMENT_BYTES) throw invalid();
      return { document, bytes };
    },
    cancel: transport.cancel,
  };
}

export type EmergencyService = ReturnType<typeof createEmergencyService>;
