import type { Data } from '../state/types';
import { isISODate } from '../utils/dates';
import { parseHttpsUrl } from '../utils/validation';

export type CloudPayload = { v: 1; data: Data; changeId: string };
export const CLOUD_BUCKET = 'liora-files';
export const MAX_CLOUD_FILE = 20 * 1024 * 1024;
export const MAX_CLOUD_PHOTO = 1024 * 1024;
export const MAX_CLOUD_PAYLOAD = 2 * 1024 * 1024;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CLOUD_PATH = new RegExp(`^${UUID}/${UUID}\\.bin$`);
const OWNER = new RegExp(`^${UUID}$`);
export const cloudPath = (uri: string, userId: string): string => {
  const path = uri.startsWith('cloud:') ? uri.slice(6) : '';
  if (!OWNER.test(userId) || !path.startsWith(`${userId}/`) || !CLOUD_PATH.test(path)) throw new Error('INVALID_CLOUD_FILE');
  return path;
};

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const text = (v: unknown): v is string => typeof v === 'string' && v.length <= 4000;
const keys = (v: unknown, required: string[], optional: string[] = []) => object(v)
  && required.every((key) => Object.hasOwn(v, key)) && Object.keys(v).every((key) => required.includes(key) || optional.includes(key));
const fields = (v: unknown, names: string[], optional: string[] = []) => keys(v, names, optional) && object(v) && names.every((key) => text(v[key]));
const list = (v: unknown, valid: (item: unknown) => boolean) => Array.isArray(v) && v.length <= 2000 && Array.from(v).every(valid);
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const id = (v: unknown) => text(v) && v.length > 0 && v.length <= 128;
const date = (v: unknown) => text(v) && isISODate(v);
const time = (v: unknown) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

function parseData(raw: unknown, asset: (uri: string, document: boolean) => boolean): Data {
  if (!keys(raw, ['profile', 'health', 'proches', 'docs', 'notes', 'treatments', 'appointments', 'moods', 'links', 'day', 'waterGoalMl']) || !object(raw)) throw new Error('INVALID_CLOUD_DATA');
  const d = raw;
  const photo = (v: unknown) => v === undefined || (typeof v === 'string' && (/^seed:[a-z0-9_]{1,80}$/.test(v) || asset(v, false)));
  const withPhoto = (v: unknown, names: string[]) => fields(v, names, ['photo']) && object(v) && photo(v.photo);
  if (!withPhoto(d.profile, ['firstName', 'lastName', 'age', 'city', 'address', 'phone', 'email'])
    || !fields(d.health, ['antecedents', 'allergies', 'doctor', 'doctorPhone', 'bloodType'])
    || !list(d.proches, (p) => fields(p, ['id', 'name', 'relation', 'phone'], ['photo', 'primary', 'emergency']) && object(p) && id(p.id) && photo(p.photo) && typeof p.primary === 'boolean' && typeof p.emergency === 'boolean')
    || !list(d.notes, (n) => withPhoto(n, ['id', 'title', 'text', 'date']) && object(n) && id(n.id) && date(n.date))
    || !list(d.treatments, (t) => fields(t, ['id', 'name', 'dose'], ['times']) && object(t) && id(t.id) && list(t.times, time))
    || !list(d.appointments, (a) => fields(a, ['id', 'title', 'date', 'time', 'place']) && object(a) && id(a.id) && date(a.date) && time(a.time))
    || !list(d.moods, (m) => fields(m, ['id', 'date', 'time', 'mood', 'source']) && object(m) && id(m.id) && date(m.date) && time(m.time)
      && ['joyeux', 'serein', 'neutre', 'triste', 'inquiet', 'fatigue'].includes(String(m.mood)) && ['manuel', 'scan', 'assistant'].includes(String(m.source)))
    || !list(d.links, (l) => fields(l, ['id', 'name', 'url']) && object(l) && id(l.id) && typeof l.url === 'string' && !!parseHttpsUrl(l.url))
    || !list(d.docs, (doc) => fields(doc, ['id', 'name', 'category', 'kind', 'date'], ['uri', 'size', 'encrypted']) && object(doc) && id(doc.id) && date(doc.date) && number(doc.size) && Number(doc.size) <= MAX_CLOUD_FILE
      && ['ordonnances', 'analyses', 'administratif'].includes(String(doc.category)) && /^[A-Z0-9]{1,8}$/.test(String(doc.kind))
      && (doc.encrypted === undefined || typeof doc.encrypted === 'boolean') && (doc.uri === undefined || (typeof doc.uri === 'string' && asset(doc.uri, true))))
    || !keys(d.day, ['date', 'waterMl', 'meals', 'habits', 'taken']) || !object(d.day) || !date(d.day.date) || !number(d.day.waterMl)
    || !list(d.day.meals, (m) => fields(m, ['id', 'name', 'desc'], ['photo', 'done']) && object(m) && id(m.id) && photo(m.photo) && typeof m.done === 'boolean')
    || !list(d.day.habits, (h) => fields(h, ['id', 'label'], ['done']) && object(h) && id(h.id) && typeof h.done === 'boolean')
    || !object(d.day.taken) || Object.keys(d.day.taken).length > 10000 || !Object.entries(d.day.taken).every(([key, v]) => key.length > 0 && key.length <= 256 && typeof v === 'boolean') || !number(d.waterGoalMl)) throw new Error('INVALID_CLOUD_DATA');
  return raw as Data;
}

/** Count serialized UTF-8 without allocating a second full copy of a large snapshot. */
function withinJsonBudget(raw: unknown, limit: number): boolean {
  let bytes = 0;
  const addString = (value: string) => {
    const json = JSON.stringify(value);
    for (let i = 0; i < json.length && bytes <= limit; i += 1) {
      const code = json.charCodeAt(i);
      if (code < 0x80) bytes += 1;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && i + 1 < json.length && json.charCodeAt(i + 1) >= 0xdc00 && json.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i += 1; }
      else bytes += 3;
    }
  };
  const visit = (value: unknown): void => {
    if (bytes > limit) return;
    if (typeof value === 'string') addString(value);
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) bytes += String(value).length;
    else if (Array.isArray(value)) {
      bytes += 2 + Math.max(0, value.length - 1);
      for (const child of value) { visit(child); if (bytes > limit) break; }
    } else if (object(value)) {
      bytes += 2;
      let entries = 0;
      for (const [key, child] of Object.entries(value)) {
        if (child === undefined) continue;
        if (entries++) bytes += 1;
        addString(key); bytes += 1; visit(child);
        if (bytes > limit) break;
      }
    }
  };
  visit(raw);
  return bytes <= limit;
}

/** Network snapshots never contain device paths, arbitrary media URLs or embedded files. */
export function parseCloudPayload(raw: unknown, userId: string): CloudPayload {
  if (!OWNER.test(userId) || !keys(raw, ['v', 'data', 'changeId']) || !object(raw) || raw.v !== 1 || !id(raw.changeId)) throw new Error('INVALID_CLOUD_DATA');
  parseData(raw.data, (uri) => !!cloudPath(uri, userId));
  if (!withinJsonBudget(raw, MAX_CLOUD_PAYLOAD)) throw new Error('CLOUD_DATA_TOO_LARGE');
  return raw as CloudPayload;
}

/** Local snapshots accept app-private files and temporary web blobs, never remote URLs. */
export function parseLocalData(raw: unknown): Data {
  return parseData(raw, (uri) => {
    if (uri.length <= 4000 && (/^file:\/\//.test(uri) || /^blob:https?:\/\//.test(uri))) return true;
    if (!uri.startsWith('data:image/jpeg;base64,')) return false;
    try { photoDataUri(decodeBase64(uri.slice(23), MAX_CLOUD_PHOTO)); return true; }
    catch { return false; }
  });
}

export const encodeBase64 = (bytes: Uint8Array): string => {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) parts.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  return btoa(parts.join(''));
};
export const decodeBase64 = (value: string, maxBytes = MAX_CLOUD_FILE): Uint8Array => {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || value.length > Math.ceil(maxBytes / 3) * 4
    || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('INVALID_BASE64');
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  if (bytes.length > maxBytes) throw new Error('FILE_TOO_LARGE');
  return bytes;
};
export const photoDataUri = (bytes: Uint8Array): string => {
  if (bytes.length > MAX_CLOUD_PHOTO || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error('INVALID_CLOUD_PHOTO');
  return `data:image/jpeg;base64,${encodeBase64(bytes)}`;
};

/** Only media locations are rewritten; the caller's local snapshot is never mutated. */
export async function mapAssets(data: Data, map: (uri: string, document: boolean, encrypted: boolean) => Promise<string>): Promise<Data> {
  const photo = async <T extends { photo?: string }>(item: T): Promise<T> => !item.photo || item.photo.startsWith('seed:') ? { ...item } : { ...item, photo: await map(item.photo, false, false) };
  const result: Data = {
    ...data, profile: await photo(data.profile),
    proches: [], notes: [], docs: [], day: { ...data.day, meals: [] },
  };
  // Sequential downloads bound memory on mobile devices.
  for (const item of data.proches) result.proches.push(await photo(item));
  for (const item of data.notes) result.notes.push(await photo(item));
  for (const item of data.day.meals) result.day.meals.push(await photo(item));
  for (const doc of data.docs) result.docs.push(doc.uri ? { ...doc, uri: await map(doc.uri, true, !!doc.encrypted), encrypted: true } : { ...doc });
  return result;
}
