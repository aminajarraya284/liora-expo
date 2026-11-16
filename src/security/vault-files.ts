import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { decryptBytes, encryptBytes } from './crypto';

/**
 * Rangement des documents du coffre-fort (iOS et Android).
 *
 * Chaque document est chiffré avant d'être écrit dans le dossier de
 * l'application. Pour le consulter, on en déchiffre une copie temporaire,
 * effacée dès que le coffre-fort se verrouille.
 */

/** Le chiffrement se fait en mémoire : on limite la taille pour ne pas saturer le téléphone. */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

const vaultDir = () => new Directory(Paths.document, 'coffre-fort');
const previewDir = () => new Directory(Paths.cache, 'coffre-fort-apercu');

const ensureDir = (dir: Directory) => {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
};

const safeName = (name: string) => name.replace(/[^\p{L}\p{N} ._-]/gu, '_').trim().slice(0, 60) || 'document';

export type StoredDocument = { uri: string; encrypted: boolean };

/**
 * Chiffre le document choisi. Sans clé, l'import est refusé.
 */
export async function storeDocument(sourceUri: string, _extension: string, key: string | null): Promise<StoredDocument> {
  if (!key) throw new Error('ENCRYPTION_REQUIRED');
  const source = new File(sourceUri);
  if (source.size > MAX_DOCUMENT_BYTES) throw new Error('DOCUMENT_TOO_LARGE');
  ensureDir(vaultDir());
  const id = `${Date.now()}-${Math.round(source.size)}`;
  const dest = new File(vaultDir(), `${id}.liora`);
  dest.create({ overwrite: true });
  await dest.write(await encryptBytes(await source.bytes(), key));
  discardPickedCopy(source);
  return { uri: dest.uri, encrypted: true };
}

/** Le sélecteur de fichiers laisse une copie en clair dans le cache : on l'efface une fois le document chiffré. */
function discardPickedCopy(source: File): void {
  try {
    if (source.uri.startsWith(Paths.cache.uri) && source.exists) source.delete();
  } catch {
    /* le système nettoiera le cache */
  }
}

/** Ouvre un document dans la visionneuse du téléphone. */
export async function openDocument(
  doc: { uri: string; name: string; kind: string; encrypted?: boolean },
  key: string | null,
): Promise<void> {
  let file = new File(doc.uri);
  if (!file.exists) throw new Error('DOCUMENT_MISSING');
  if (doc.encrypted) {
    if (!key) throw new Error('KEY_MISSING');
    ensureDir(previewDir());
    const copy = new File(previewDir(), `${safeName(doc.name)}.${doc.kind.toLowerCase()}`);
    copy.create({ overwrite: true });
    await copy.write(await decryptBytes(await file.bytes(), key));
    file = copy;
  }
  if (await file.canPreview()) await file.preview({ title: doc.name });
  else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { dialogTitle: doc.name });
  else throw new Error('NO_VIEWER');
}

/** Efface les copies déchiffrées. Appelé à chaque verrouillage du coffre-fort. */
export function clearPreviews(): void {
  try {
    const dir = previewDir();
    if (dir.exists) dir.delete();
  } catch {
    /* rien à effacer */
  }
}

export function deleteDocument(uri?: string): void {
  if (!uri || !uri.startsWith('file:')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* déjà supprimé */
  }
}

/** Les documents restent-ils disponibles après la fermeture de l'application ? */
export const DOCUMENTS_PERSIST = true;
