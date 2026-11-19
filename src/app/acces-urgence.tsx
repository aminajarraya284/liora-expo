import { useFocusEffect, useRouter } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { openEmergencyDocument } from '../emergency/document-preview';
import { EMERGENCY_STATUS_LABEL, type EmergencyDocuments } from '../emergency/types';
import { useEmergencyKeys } from '../emergency/use-emergency';
import { useStore } from '../store';
import { Btn, Card, Field, Header, Hero, OutlineBtn, Screen, T, useDialog } from '../ui';
import { C } from '../theme';

const when = (date: string) => new Date(date).toLocaleString('fr-FR');

export default function EmergencyAccess() {
  const { user } = useStore();
  return <EmergencyAccessScreen key={`${user?.mode}:${user?.id}`} />;
}

function EmergencyAccessScreen() {
  const { user, cloudAvailable, logout } = useStore();
  const { service, state, error, refresh } = useEmergencyKeys();
  const router = useRouter();
  const dialog = useDialog();
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ requestId: string; data: EmergencyDocuments } | null>(null);
  const actionVersion = useRef(0);
  const inFlight = useRef(false);
  const activeService = useRef(service);
  useEffect(() => { activeService.current = service; }, [service]);
  const recipientRequests = state.requests.filter((request) => request.role === 'recipient');
  const visibleOpened = opened && !error && recipientRequests.some((request) => request.id === opened.requestId && request.status === 'active') ? opened : null;

  const clear = useCallback(() => { actionVersion.current += 1; setOpened(null); setCode(''); setFeedback(null); }, []);
  useFocusEffect(useCallback(() => () => clear(), [clear]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => { if (status !== 'active') clear(); });
    return () => subscription.remove();
  }, [clear]);
  useEffect(() => {
    if (!opened || Platform.OS === 'web') return;
    void ScreenCapture.preventScreenCaptureAsync('urgence-proche').catch(() => {});
    return () => { void ScreenCapture.allowScreenCaptureAsync('urgence-proche').catch(() => {}); };
  }, [opened]);

  const run = async (action: (version: number) => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFeedback(null);
    const version = ++actionVersion.current;
    try { await action(version); }
    catch (caught) {
      if (version === actionVersion.current) {
        setOpened(null);
        setFeedback(caught instanceof Error ? caught.message : 'Action impossible. Réessayez en ligne.');
      }
    } finally { inFlight.current = false; setBusy(false); }
  };

  const connect = () => run(async () => {
    if (user) {
      const accepted = await dialog.confirm({ title: 'Utiliser votre compte en ligne', message: 'Votre session actuelle sera fermée pour vous connecter avec l’adresse e-mail désignée par votre proche.', ok: 'Continuer' });
      if (!accepted) return;
      const result = await logout();
      if (!result.ok) throw new Error(result.error);
    }
    router.replace({ pathname: '/login', params: { mode: 'cloud' } });
  });

  return (
    <Screen tint="red" voice={false}>
      <Header title="Accès d’urgence" fallback={user ? '/proches' : '/login'} />
      <Hero icon="key-outline" title="J’ai une clé" subtitle="Demander les documents que votre proche a choisis pour vous." />
      {user?.mode !== 'cloud' ? (
        <Card>
          <T v="h3">Votre compte personnel</T>
          <T style={{ marginTop: 8 }}>Utilisez le compte en ligne dont l’adresse e-mail a été désignée par votre proche, puis revenez ici pour saisir le code.</T>
          {cloudAvailable ? <Btn label="Me connecter" loading={busy} onPress={connect} style={{ marginTop: 16 }} /> : <T style={{ marginTop: 12 }}>L’accès à distance sera disponible une fois le service en ligne activé.</T>}
          <OutlineBtn label="Voir la démonstration" onPress={() => router.push(user ? '/cle-urgence' : '/demo-urgence')} style={{ marginTop: 12 }} />
        </Card>
      ) : (
        <>
          <Card>
            <T v="small" style={{ marginBottom: 12 }}>Compte utilisé : {user.email}</T>
            <Field placeholder="Code transmis par votre proche" accessibilityLabel="Code d’urgence" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={64} editable={!busy} />
            <Field placeholder="Pourquoi avez-vous besoin de ces documents ?" accessibilityLabel="Motif de la demande" value={reason} onChangeText={setReason} multiline maxLength={500} editable={!busy} />
            <T v="small" style={{ marginBottom: 12 }}>Votre proche verra cette demande dans Liora. Il dispose de 48 heures pour la refuser. L’accès autorisé dure ensuite 24 heures.</T>
            <Btn label="Demander l’accès" icon="key-outline" loading={busy} disabled={!service} onPress={() => run(async (version) => {
              if (!service) return;
              await service.request(code, reason);
              if (version !== actionVersion.current || service !== activeService.current) return;
              setCode(''); setReason('');
              setFeedback('Demande enregistrée. Retrouvez son état ci-dessous.');
              await refresh();
            })} />
          </Card>
          <View style={{ gap: 12, marginTop: 16 }}>
            <T v="h3">Mes demandes</T>
            {!recipientRequests.length && <T>Aucune demande pour le moment.</T>}
            {recipientRequests.map((request) => (
              <Card key={request.id}>
                <T v="h3">Documents de {request.ownerName || 'votre proche'}</T>
                <T style={{ marginTop: 6 }}>{EMERGENCY_STATUS_LABEL[request.status]}</T>
                {request.status === 'waiting' && <T v="small" style={{ marginTop: 6 }}>Ouverture prévue le {when(request.opensAt)} si votre proche accepte ce fonctionnement et ne refuse pas la demande.</T>}
                {request.status === 'active' && <>
                  <T v="small" style={{ marginTop: 6 }}>Accès valable jusqu’au {when(request.expiresAt)}.</T>
                  <Btn small label="Consulter les documents" disabled={busy} style={{ marginTop: 12 }} onPress={() => run(async (version) => {
                    if (!service) return;
                    const data = await service.documents(request.id);
                    if (version === actionVersion.current && service === activeService.current) setOpened({ requestId: request.id, data });
                  })} />
                </>}
              </Card>
            ))}
            <OutlineBtn label="Actualiser mes demandes" disabled={busy} onPress={refresh} />
          </View>
        </>
      )}
      {(feedback || error) && <T accessibilityRole="alert" c={C.title} style={{ marginTop: 14 }}>{feedback || error}</T>}
      {visibleOpened && <Card style={{ marginTop: 16 }}>
        <T v="h3">Documents autorisés</T>
        {!visibleOpened.data.documents.length && <T>Les documents ont été retirés par votre proche.</T>}
        {visibleOpened.data.documents.map((doc) => <View key={doc.id} style={{ marginTop: 12 }}>
          <T v="title">{doc.name}</T>
          <T v="small">{doc.kind} · {doc.date}</T>
          <OutlineBtn small label={Platform.OS === 'web' ? 'Télécharger' : 'Ouvrir le document'} disabled={busy} onPress={() => run(async (version) => {
            if (!service) return;
            const file = await service.download(visibleOpened.requestId, doc.id);
            if (version === actionVersion.current && service === activeService.current) await openEmergencyDocument(file.bytes, file.document);
          })} style={{ marginTop: 6 }} />
        </View>)}
        <OutlineBtn small label="Fermer les documents" onPress={clear} style={{ marginTop: 16 }} />
      </Card>}
    </Screen>
  );
}
