import { MAX_CLOUD_FILE } from '../cloud/payload';
import type { EmergencyDocument } from './types';

/** Explicit download; files obtained by the recipient cannot subsequently be recalled. */
export async function openEmergencyDocument(bytes: Uint8Array, doc: EmergencyDocument): Promise<void> {
  if (bytes.length > MAX_CLOUD_FILE || !/^[A-Z0-9]{1,8}$/.test(doc.kind)) throw new Error('Format de document invalide.');
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${doc.name.replace(/[^\p{L}\p{N} ._-]/gu, '_').slice(0, 60) || 'document'}.${doc.kind.toLowerCase()}`;
  document.body.appendChild(link);
  try { link.click(); }
  finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
