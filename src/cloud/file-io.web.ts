import { MAX_CLOUD_FILE, photoDataUri } from './payload';

export async function readAsset(uri: string, _document: boolean, _encrypted: boolean, _key: string): Promise<Uint8Array> {
  if (!uri.startsWith('blob:') && !uri.startsWith('data:')) throw new Error('INVALID_LOCAL_FILE');
  const response = await fetch(uri);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_CLOUD_FILE) throw new Error('FILE_TOO_LARGE');
  return bytes;
}
export async function cacheAsset(bytes: Uint8Array, document: boolean, _path: string, _key: string): Promise<string> {
  return document ? URL.createObjectURL(new Blob([new Uint8Array(bytes)])) : photoDataUri(bytes);
}
