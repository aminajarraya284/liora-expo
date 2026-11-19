import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MAX_CLOUD_FILE } from '../cloud/payload';
import { uid } from '../utils/ids';
import type { EmergencyDocument } from './types';

/** A temporary viewer copy, removed when the native viewer closes. */
export async function openEmergencyDocument(bytes: Uint8Array, doc: EmergencyDocument): Promise<void> {
  if (bytes.length > MAX_CLOUD_FILE || !/^[A-Z0-9]{1,8}$/.test(doc.kind)) throw new Error('Format de document invalide.');
  const file = new File(Paths.cache, `liora-urgence-${uid()}.${doc.kind.toLowerCase()}`);
  try {
    file.create();
    await file.write(bytes);
    if (await file.canPreview()) await file.preview({ title: doc.name });
    else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { dialogTitle: doc.name });
    else throw new Error('Aucune visionneuse de document n’est disponible sur cet appareil.');
  } finally {
    try { if (file.exists) file.delete(); } catch { /* The OS also clears its temporary cache. */ }
  }
}
