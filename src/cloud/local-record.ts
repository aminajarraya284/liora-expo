import type { SyncRecord } from './sync-engine';
import { parseLocalData } from './payload';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const revision = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;

/** A corrupt cache must fail before it can be mistaken for a fresh cloud account. */
export function parseLocalRecord(raw: unknown): SyncRecord {
  if (!object(raw) || !Object.keys(raw).every((key) => ['data', 'revision', 'dirty', 'changeId', 'attempt'].includes(key))
    || !revision(raw.revision) || typeof raw.dirty !== 'boolean' || !id(raw.changeId)) throw new Error('INVALID_LOCAL_SYNC_RECORD');
  parseLocalData(raw.data);
  if (raw.attempt !== undefined) {
    if (!raw.dirty || !object(raw.attempt) || Object.keys(raw.attempt).length !== 2 || !id(raw.attempt.changeId)
      || !revision(raw.attempt.revision) || raw.attempt.revision !== raw.revision) throw new Error('INVALID_LOCAL_SYNC_RECORD');
  }
  return raw as SyncRecord;
}
