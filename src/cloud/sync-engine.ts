import type { Data } from '../state/types';

/** Persist this entire record in the encrypted account storage, including `attempt`. */
export type SyncRecord = {
  data: Data;
  /** Last server revision acknowledged by this device. Zero means no snapshot yet. */
  revision: number;
  dirty: boolean;
  changeId: string;
  /** Allows recovery when the server accepted an upload but its reply was lost. */
  attempt?: { changeId: string; revision: number };
};

export type RemoteSnapshot = { data: Data; revision: number; changeId: string };
export type SyncState = 'synced' | 'pending' | 'syncing' | 'offline' | 'auth-error' | 'conflict' | 'local-error' | 'stopped';
export type SyncStatus = { state: SyncState; conflict?: RemoteSnapshot | null; lastSyncedAt?: number };

export class ConflictError extends Error {
  constructor() { super('SYNC_CONFLICT'); }
}

export class SessionError extends Error {
  constructor() { super('SYNC_SESSION_REQUIRED'); }
}

export class LocalPersistenceError extends Error {
  constructor() { super('SYNC_LOCAL_WRITE_FAILED'); }
}

export type SyncRemote = {
  load(): Promise<RemoteSnapshot | null>;
  save(data: Data, expectedRevision: number, changeId: string): Promise<{ revision: number }>;
};

type Options = {
  initial: SyncRecord;
  remote: SyncRemote;
  persist(record: SyncRecord): Promise<void>;
  onChange?(record: SyncRecord, status: SyncStatus): void;
  newId?(): string;
};

const copy = (record: SyncRecord): SyncRecord => ({ ...record, ...(record.attempt ? { attempt: { ...record.attempt } } : {}) });
const validRemote = (value: RemoteSnapshot | null): boolean => value === null
  || (Number.isSafeInteger(value.revision) && value.revision > 0 && typeof value.changeId === 'string' && value.changeId.length > 0);

/**
 * One engine belongs to one authenticated account. Local writes are serialized;
 * the remote adapter must use an atomic compare-and-swap on expectedRevision.
 * Timers, connectivity listeners and user-facing messages belong to the caller.
 */
export function createSyncEngine({ initial, remote, persist, onChange, newId }: Options) {
  let record = copy(initial);
  let sequence = 0;
  let idSequence = 0;
  let stopped = false;
  let syncing = false;
  let offline = false;
  let authError = false;
  let localFailed = false;
  let conflict: RemoteSnapshot | null | undefined;
  let lastSyncedAt: number | undefined;
  let localPending: SyncRecord | null = null;
  let localRunning: Promise<void> | null = null;
  let remoteRunning: Promise<void> | null = null;

  const status = (): SyncStatus => ({
    state: stopped ? 'stopped' : localFailed ? 'local-error' : conflict !== undefined ? 'conflict'
      : authError ? 'auth-error' : syncing ? 'syncing' : offline ? 'offline' : record.dirty ? 'pending' : 'synced',
    ...(conflict !== undefined ? { conflict } : {}),
    ...(lastSyncedAt !== undefined ? { lastSyncedAt } : {}),
  });
  const emit = () => { if (!stopped) onChange?.(copy(record), status()); };
  const changeId = () => newId?.() ?? `${Date.now().toString(36)}-${(++idSequence).toString(36)}-${Math.random().toString(36).slice(2)}`;

  const runLocal = (): Promise<void> => {
    localRunning ??= Promise.resolve().then(async () => {
      while (localPending) {
        const next = localPending;
        localPending = null;
        try {
          await persist(copy(next));
          localFailed = false;
          emit();
        } catch {
          // The latest queued state supersedes this one, but an error never drops both.
          localPending ??= next;
          localFailed = true;
          emit();
          break;
        }
      }
    }).finally(() => {
      localRunning = null;
      // An update can arrive after the drain loop finishes but before this microtask.
      if (localPending && !localFailed) void runLocal();
    });
    return localRunning;
  };
  const queueLocal = () => {
    localPending = copy(record);
    void runLocal();
  };
  const flushLocal = async (): Promise<void> => {
    if (localRunning) await localRunning;
    if (localPending) await runLocal();
    // Include any successful follow-up drain started while the first one completed.
    while (localRunning) await localRunning;
    if (localFailed) throw new LocalPersistenceError();
  };
  const replace = (next: SyncRecord) => {
    record = next;
    sequence += 1;
    queueLocal();
    emit();
  };
  const setConflict = (snapshot: RemoteSnapshot | null) => { conflict = snapshot; emit(); };

  const loadRemote = async (): Promise<RemoteSnapshot | null> => {
    const snapshot = await remote.load();
    if (!validRemote(snapshot)) throw new Error('SYNC_INVALID_REMOTE');
    return snapshot;
  };

  const synchronize = async () => {
    await flushLocal();
    if (stopped || conflict !== undefined) return;
    const snapshot = await loadRemote();
    if (stopped) return;

    // `record` is read after the network await: edits made during a download win locally.
    const attempt = record.attempt;
    const appliedAttempt = snapshot && attempt && snapshot.changeId === attempt.changeId && snapshot.revision === attempt.revision + 1;
    const appliedCurrent = snapshot && !attempt && record.dirty && snapshot.changeId === record.changeId && snapshot.revision === record.revision + 1;
    if (appliedAttempt || appliedCurrent) {
      const acknowledgedId = attempt?.changeId ?? record.changeId;
      replace({ data: record.data, revision: snapshot!.revision, dirty: record.changeId !== acknowledgedId, changeId: record.changeId });
      await flushLocal();
      if (stopped) return;
    }

    if (!record.dirty) {
      if (snapshot === null) {
        if (record.revision > 0) setConflict(null);
      } else if (snapshot.revision < record.revision) {
        setConflict(snapshot);
      } else if (snapshot.revision > record.revision) {
        replace({ data: snapshot.data, revision: snapshot.revision, dirty: false, changeId: snapshot.changeId });
        await flushLocal();
      } else if (snapshot.changeId !== record.changeId) {
        // Equal revisions must identify the same committed snapshot.
        setConflict(snapshot);
      } else if (snapshot.data !== record.data && JSON.stringify(snapshot.data) !== JSON.stringify(record.data)) {
        // A remote adapter can repair missing local media without changing cloud content.
        // Apply its new device paths only to an unchanged, clean copy.
        replace({ ...record, data: snapshot.data });
        await flushLocal();
      }
      if (conflict === undefined && !stopped) { lastSyncedAt = Date.now(); emit(); }
      return;
    }

    const remoteRevision = snapshot?.revision ?? 0;
    if (remoteRevision !== record.revision) { setConflict(snapshot); return; }

    // Wait until the durable marker describes the exact version about to be sent.
    // An edit during disk I/O is kept and gets its own marker before any upload.
    for (;;) {
      const markedId = record.changeId;
      replace({ ...record, attempt: { changeId: record.changeId, revision: record.revision } });
      await flushLocal();
      if (stopped) return;
      if (record.changeId === markedId) break;
    }
    const sent = copy(record);
    const sentRevision = sent.revision;
    const saved = await remote.save(sent.data, sentRevision, sent.changeId);
    if (stopped) return;
    if (!Number.isSafeInteger(saved.revision) || saved.revision !== sentRevision + 1) throw new Error('SYNC_INVALID_REVISION');
    replace({ data: record.data, revision: saved.revision, dirty: record.changeId !== sent.changeId, changeId: record.changeId });
    await flushLocal();
    if (!stopped) { lastSyncedAt = Date.now(); emit(); }
  };

  const handleRemoteError = async (error: unknown) => {
    if (stopped) return;
    if (error instanceof LocalPersistenceError) { localFailed = true; }
    else if (error instanceof SessionError) { authError = true; }
    else if (error instanceof ConflictError) {
      // A second device may have changed the snapshot between our read and write.
      try { setConflict(await loadRemote()); }
      catch (loadError) {
        if (loadError instanceof SessionError) authError = true;
        else offline = true;
      }
    } else { offline = true; }
    emit();
  };

  const runRemote = (work: () => Promise<void>): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (remoteRunning) return remoteRunning;
    syncing = true;
    offline = false;
    authError = false;
    emit();
    remoteRunning = Promise.resolve().then(work).catch(handleRemoteError).finally(() => {
      syncing = false;
      remoteRunning = null;
      emit();
    });
    return remoteRunning;
  };

  return {
    get snapshot(): SyncRecord { return copy(record); },
    get status(): SyncStatus { return status(); },
    update(fn: (data: Data) => Data): void {
      if (stopped) return;
      const next = fn(record.data);
      if (next === record.data) return;
      replace({ ...record, data: next, dirty: true, changeId: changeId() });
    },
    sync(): Promise<void> { return runRemote(synchronize); },
    flushLocal,
    async resolveConflict(choice: 'local' | 'remote'): Promise<void> {
      if (remoteRunning) await remoteRunning;
      if (stopped || conflict === undefined) return;
      return runRemote(async () => {
        await flushLocal();
        if (stopped) return;
        const before = sequence;
        const latest = await loadRemote();
        if (stopped) return;
        if (sequence !== before) { setConflict(latest); return; }
        if (choice === 'remote') {
          // A deleted server snapshot has no data to restore. Keep the local copy.
          if (!latest) { setConflict(null); return; }
          conflict = undefined;
          replace({ data: latest.data, revision: latest.revision, dirty: false, changeId: latest.changeId });
          await flushLocal();
          if (!stopped) { lastSyncedAt = Date.now(); emit(); }
        } else {
          conflict = undefined;
          replace({ data: record.data, revision: latest?.revision ?? 0, dirty: true, changeId: changeId() });
          await synchronize();
        }
      });
    },
    /** Stop callbacks/network work immediately; await this result before discarding local state. */
    stop(): Promise<void> {
      stopped = true;
      return flushLocal();
    },
  };
}
