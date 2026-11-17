import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Photo réduite, intégrée à la sauvegarde chiffrée plutôt que conservée en clair. */
export async function persistFile(uri: string, _name: string): Promise<string> {
  const image = await ImageManipulator.manipulate(uri).resize({ width: 640 }).renderAsync();
  const saved = await image.saveAsync({ base64: true, compress: 0.65, format: SaveFormat.JPEG });
  if (Platform.OS !== 'web') {
    if (uri.startsWith(Paths.cache.uri)) removeFile(uri);
    removeFile(saved.uri);
  }
  if (!saved.base64 || saved.base64.length > 1_398_104) throw new Error('PHOTO_TOO_LARGE');
  return `data:image/jpeg;base64,${saved.base64}`;
}

/** Supprime un fichier appartenant à l'application. Sans effet pour toute autre adresse. */
export function removeFile(uri?: string): void {
  if (!uri || Platform.OS === 'web' || !uri.startsWith('file:')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* fichier déjà supprimé */
  }
}
