/**
 * Version web du coffre-fort, pour l'aperçu dans un navigateur uniquement :
 * un navigateur ne donne pas accès à un dossier privé, les documents ne sont
 * donc ni chiffrés ni conservés après la fermeture de la page.
 */

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export type StoredDocument = { uri: string; encrypted: boolean };

export async function storeDocument(sourceUri: string, _extension: string, _key: string | null): Promise<StoredDocument> {
  return { uri: sourceUri, encrypted: false };
}

export async function openDocument(
  doc: { uri: string; name: string; kind: string; encrypted?: boolean },
  _key: string | null,
): Promise<void> {
  if (!doc.uri.startsWith('blob:') && !doc.uri.startsWith('data:')) throw new Error('DOCUMENT_MISSING');
  // Le document vient de l'utilisateur lui-même : on l'affiche dans un nouvel onglet.
  if (!window.open(doc.uri, '_blank')) throw new Error('NO_VIEWER');
}

export function clearPreviews(): void {}

export function deleteDocument(uri?: string): void {
  if (uri?.startsWith('blob:')) URL.revokeObjectURL(uri);
}

export const DOCUMENTS_PERSIST = false;
