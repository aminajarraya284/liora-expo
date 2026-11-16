import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const safeName = (name: string) => name.replace(/[^\w.\-]/g, '_').slice(-80);

/** Copie une photo choisie par l'utilisateur dans le dossier permanent de l'application. */
export async function persistFile(uri: string, name: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  try {
    const dest = new File(Paths.document, `${Date.now()}-${safeName(name)}`);
    await new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
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
