import { Directory, File, Paths } from 'expo-file-system';
import { decryptBytes, encryptBytes } from '../security/crypto';
import { decodeBase64, MAX_CLOUD_FILE, photoDataUri } from './payload';
import { persistFile } from '../utils/files';
import { cloudScope } from './cache';

export async function readAsset(uri: string, document: boolean, encrypted: boolean, key: string): Promise<Uint8Array> {
  if (!document) {
    const photo = uri.startsWith('data:image/jpeg;base64,') ? uri : await persistFile(uri, 'photo.jpg');
    const bytes = decodeBase64(photo.slice(23));
    photoDataUri(bytes);
    return bytes;
  }
  if (!uri.startsWith('file:')) throw new Error('INVALID_LOCAL_FILE');
  const file = new File(uri);
  if (!file.exists || file.size > MAX_CLOUD_FILE + 64) throw new Error('LOCAL_FILE_MISSING');
  const bytes = await file.bytes();
  return document && encrypted ? decryptBytes(bytes, key) : bytes;
}

export async function cacheAsset(bytes: Uint8Array, document: boolean, path: string, key: string): Promise<string> {
  if (!document) return photoDataUri(bytes);
  const dir = new Directory(Paths.document, 'cloud-files', cloudScope, path.split('/')[0]);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, `${path.split('/')[1]}.liora`);
  // Both the old and new file contain authenticated ciphertext, never a plaintext copy.
  const encrypted = await encryptBytes(bytes, key);
  file.create({ overwrite: true });
  await file.write(encrypted);
  return file.uri;
}
