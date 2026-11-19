import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useStore } from '../store';
import { emergencyClient } from './client';
import type { EmergencyService } from './service';
import type { CreateEmergencyKey, EmergencyState } from './types';

const EMPTY: EmergencyState = { keys: [], requests: [], serverNow: '' };
type EmergencyContext = {
  state: EmergencyState;
  loading: boolean;
  error: string | null;
  service: EmergencyService | null;
  refresh(): Promise<void>;
  create(input: CreateEmergencyKey): Promise<{ code: string }>;
  decide(requestId: string, decision: 'approve' | 'deny'): Promise<void>;
  revoke(keyId: string): Promise<void>;
};
const Context = createContext<EmergencyContext | null>(null);

/** One poller per signed-in account. Emergency documents are never added to its data cache. */
export function EmergencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useStore();
  const userId = user?.mode === 'cloud' ? user.id : null;
  return <AccountEmergencyProvider key={`${user?.mode}:${user?.id}`} userId={userId}>{children}</AccountEmergencyProvider>;
}

function AccountEmergencyProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const [saved, setSaved] = useState<{ userId: string | null; state: EmergencyState }>({ userId: null, state: EMPTY });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bound, setBound] = useState<{ userId: string; service: EmergencyService } | null>(null);
  const service = bound?.userId === userId ? bound.service : null;
  const current = useRef<EmergencyService | null>(null);
  const polling = useRef<EmergencyService | null>(null);
  const mutating = useRef(false);
  const version = useRef(0);

  useEffect(() => {
    const next = userId ? emergencyClient(userId) : null;
    current.current = next;
    if (next && userId) {
      void next.list().then((state) => {
        if (current.current === next) { setSaved({ userId, state }); setError(null); }
      }).catch(() => {
        if (current.current === next) setError('Le service des clés d’urgence est indisponible. Vérifiez votre connexion et sa configuration.');
      }).finally(() => {
        if (current.current === next) setBound({ userId, service: next });
      });
    }
    return () => { current.current = null; next?.cancel(); };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!service || polling.current === service) return;
    polling.current = service;
    const requestedVersion = ++version.current;
    setLoading(true);
    try {
      const result = await service.list();
      if (current.current === service && version.current === requestedVersion) { setSaved({ userId, state: result }); setError(null); }
    } catch (caught) {
      if (current.current === service && version.current === requestedVersion) {
        setError(caught instanceof Error ? caught.message : 'Les demandes d’urgence sont momentanément indisponibles.');
      }
    } finally {
      if (polling.current === service) polling.current = null;
      if (current.current === service) setLoading(false);
    }
  }, [service, userId]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, 20_000);
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void refresh();
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [service, refresh]);

  const mutate = useCallback(async <T,>(action: (client: EmergencyService) => Promise<T>): Promise<T> => {
    if (!service) throw new Error('Connectez-vous à un compte en ligne pour gérer les clés d’urgence.');
    if (mutating.current) throw new Error('Une opération est déjà en cours.');
    mutating.current = true;
    try {
      const result = await action(service);
      if (current.current !== service) throw new Error('Le compte a changé. Reconnectez-vous.');
      // A failed follow-up refresh must never hide a successfully generated one-time code.
      const requestedVersion = ++version.current;
      void service.list().then((state) => {
        if (current.current === service && version.current === requestedVersion) { setSaved({ userId, state }); setError(null); }
      }).catch(() => {
        if (current.current === service) setError('L’action a réussi. Actualisez la liste pour voir son nouvel état.');
      });
      return result;
    } finally { mutating.current = false; }
  }, [service, userId]);

  const value = useMemo<EmergencyContext>(() => ({
    state: userId && saved.userId === userId ? saved.state : EMPTY,
    loading: !!userId && (!service || loading), error: userId ? error : null, service, refresh,
    create: (input) => mutate((client) => client.create(input)),
    decide: (id, decision) => mutate((client) => client.decide(id, decision)),
    revoke: (id) => mutate((client) => client.revoke(id)),
  }), [saved, userId, loading, error, service, refresh, mutate]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useEmergencyKeys(): EmergencyContext {
  const value = useContext(Context);
  if (!value) throw new Error('EmergencyProvider missing');
  return value;
}
