import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { EmergencyDemo } from '../../emergency/demo';
import { EMERGENCY_STATUS_LABEL, type EmergencyKey, type EmergencyRequest } from '../../emergency/types';
import { useEmergencyKeys } from '../../emergency/use-emergency';
import { useStore } from '../../store';
import { C } from '../../theme';
import { Btn, Card, CardTitle, Checkbox, Field, FormSheet, Header, Hero, Icon, OutlineBtn, Screen, T, useDialog } from '../../ui';
import { isEmail } from '../../utils/validation';

const dateTime = (value: string) => new Date(value).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function EmergencyKeys() {
  const { user } = useStore();
  // Une nouvelle session repart sans code ni formulaire d’un autre compte.
  return <EmergencyKeysScreen key={`${user?.mode}:${user?.id}`} />;
}

function EmergencyKeysScreen() {
  const { data, user, checkPassword, cloudAvailable, syncStatus, syncNow } = useStore();
  const { state, loading, error, refresh, create, decide, revoke } = useEmergencyKeys();
  const router = useRouter();
  const dialog = useDialog();
  const online = user?.mode === 'cloud' && cloudAvailable;
  const [formOpen, setFormOpen] = useState(false);
  const [procheId, setProcheId] = useState('');
  const [email, setEmail] = useState('');
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const mounted = useRef(true);
  const focused = useRef(true);
  const documents = data.docs.filter((doc) => !!doc.uri);
  const ownerRequests = state.requests.filter((request) => request.role === 'owner');
  const selectedProche = data.proches.find((proche) => proche.id === procheId);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; setCode(null); };
  }, []));

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        setCode(null);
        if (!operation.current) setPasswordOpen(false);
      }
    });
    return () => { mounted.current = false; subscription.remove(); };
  }, []);

  const run = async (action: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setActionError(null);
    try { await action(); }
    catch (failure) {
      if (mounted.current) setActionError(failure instanceof Error ? failure.message : 'L’action a échoué. Réessayez en ligne.');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const prepare = () => {
    setActionError(null);
    if (!selectedProche) return setActionError('Choisissez le proche qui recevra la clé.');
    if (!isEmail(email)) return setActionError('Renseignez l’adresse e-mail du compte Liora de ce proche.');
    if (email.trim().toLowerCase() === user?.email.trim().toLowerCase()) return setActionError('Utilisez l’adresse du proche qui recevra la clé.');
    if (!documentIds.length || documentIds.length > 20) return setActionError('Choisissez entre 1 et 20 documents.');
    if (documentIds.some((id) => !documents.some((doc) => doc.id === id))) return setActionError('Un document sélectionné a été retiré. Vérifiez votre sélection.');
    if (!consent) return setActionError('Confirmez l’autorisation d’accès automatique après 48 heures.');
    setPasswordOpen(true);
  };

  const decision = async (request: EmergencyRequest, choice: 'approve' | 'deny') => {
    if (operation.current) return;
    const approved = choice === 'approve';
    const confirmed = await dialog.confirm({
      title: approved ? `Autoriser ${request.procheName} ?` : 'Refuser cette demande ?',
      message: approved ? 'Les documents sélectionnés seront accessibles pendant 24 heures à compter de votre accord.' : 'Cette demande sera refusée et les documents resteront inaccessibles avec cette demande.',
      ok: approved ? 'Autoriser 24 h' : 'Refuser', danger: !approved,
    });
    if (confirmed && mounted.current) await run(() => decide(request.id, choice));
  };

  const revokeKey = async (key: EmergencyKey) => {
    if (operation.current) return;
    if (await dialog.confirm({ title: `Révoquer la clé de ${key.procheName} ?`, message: 'Les prochaines consultations seront bloquées. Les copies déjà récupérées par le proche restent en sa possession.', ok: 'Révoquer', danger: true })) {
      if (mounted.current) await run(() => revoke(key.id));
    }
  };

  return (
    <Screen section="urgence" tab="social" voice={false}>
      <Header title="Clé d’urgence" />
      <Hero icon="key-outline" title="La Clé 48h" subtitle="Confier les documents utiles à un proche choisi" />

      <View style={{ backgroundColor: '#182D40', borderRadius: 22, padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#653044', alignItems: 'center', justifyContent: 'center' }}><Icon name="time-outline" size={28} color="#FFA1BC" /></View>
          <T v="h2" c="#FFFFFF" style={{ flex: 1 }}>Comment fonctionne la Clé 48h ?</T>
        </View>
        <T c="#EDF3F8">Vous choisissez un proche et les documents qu’il pourra consulter. Avec votre code et son compte Liora, il peut demander l’accès si vous êtes indisponible.</T>
        <T c="#EDF3F8">Vous avez 48 heures pour refuser. Vous pouvez aussi accepter immédiatement. À l’ouverture, l’accès dure 24 heures et vous pouvez révoquer la clé à tout moment.</T>
        <T v="small" c="#D0DEE9">Les demandes apparaissent dans Liora quand l’application est ouverte.</T>
      </View>

      {!online && <>
        <Card style={{ marginTop: 16 }}>
          <CardTitle icon="cloud-outline">Accès depuis le téléphone du proche</CardTitle>
          <T>La création d’une clé demande un compte en ligne et des documents synchronisés. L’activation du service en ligne permettra de relier les deux comptes.</T>
        </Card>
        <EmergencyDemo />
      </>}

      {online && <View style={{ gap: 16, marginTop: 16 }}>
        {!!error && <T c={C.danger} accessibilityRole="alert">{error}</T>}
        {!!actionError && <T c={C.danger} accessibilityRole="alert">{actionError}</T>}
        <OutlineBtn small label="Actualiser les demandes" icon="refresh-outline" disabled={busy || loading} onPress={() => run(refresh)} />

        {code && <Card>
          <CardTitle icon="key-outline">Votre code est prêt</CardTitle>
          <T selectable center v="bodyBold" style={{ marginVertical: 14, letterSpacing: 1 }}>{code}</T>
          <T>Remettez ce code personnellement au proche choisi. Il devra se connecter avec l’adresse e-mail autorisée.</T>
          <T v="small" style={{ marginTop: 10 }}>Copiez-le maintenant. Il sera masqué en quittant cet écran ou l’application. Si vous le perdez, révoquez cette clé et créez-en une nouvelle.</T>
          <OutlineBtn label="J’ai conservé le code" style={{ marginTop: 14 }} onPress={() => setCode(null)} />
        </Card>}

        {ownerRequests.length > 0 && <View style={{ gap: 12 }}>
          <T v="h2" accessibilityRole="header">Demandes de mes proches</T>
          {ownerRequests.map((request) => <Card key={request.id}>
            <T v="title">{request.procheName}</T>
            <T v="small" style={{ marginTop: 4 }}>{EMERGENCY_STATUS_LABEL[request.status]} · {dateTime(request.requestedAt)}</T>
            <T style={{ marginTop: 10 }}>{request.reason}</T>
            {request.status === 'waiting' && <>
              <T v="bodyBold" style={{ marginTop: 10 }}>Vous pouvez refuser jusqu’au {dateTime(request.opensAt)}.</T>
              <View style={{ gap: 10, marginTop: 14 }}>
                <Btn label="Autoriser maintenant" disabled={busy} onPress={() => decision(request, 'approve')} />
                <OutlineBtn label="Refuser la demande" color={C.danger} disabled={busy} onPress={() => decision(request, 'deny')} />
              </View>
            </>}
            {request.status === 'active' && <T v="bodyBold" style={{ marginTop: 10 }}>Accès ouvert jusqu’au {dateTime(request.expiresAt)}.</T>}
          </Card>)}
        </View>}

        <T v="h2" accessibilityRole="header">Mes clés</T>
        {!state.keys.length && <T>Vous pouvez créer une clé après avoir choisi un proche et les documents à lui confier.</T>}
        {state.keys.map((key) => <Card key={key.id}>
          <T v="title">{key.procheName}</T>
          <T v="small">{key.recipientEmail}</T>
          <T style={{ marginTop: 8 }}>{key.documentIds.length} document{key.documentIds.length > 1 ? 's' : ''} autorisé{key.documentIds.length > 1 ? 's' : ''}</T>
          <T v="small">Créée le {dateTime(key.createdAt)}{key.revokedAt ? ' · Révoquée' : ''}</T>
          {!key.revokedAt && <OutlineBtn small label="Révoquer cette clé" icon="lock-closed-outline" color={C.danger} disabled={busy} style={{ marginTop: 12 }} onPress={() => revokeKey(key)} />}
        </Card>)}

        {!formOpen && <Btn label="Créer une clé" icon="key-outline" disabled={busy || loading || !!code} onPress={() => setFormOpen(true)} />}
        {formOpen && <Card>
          <CardTitle icon="person-outline">Choisir mon proche</CardTitle>
          {!data.proches.length && <OutlineBtn label="Ajouter un proche" onPress={() => router.push('/proches')} />}
          <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
            {data.proches.map((proche) => <Pressable key={proche.id} accessibilityRole="radio" accessibilityState={{ selected: proche.id === procheId }} accessibilityLabel={`${proche.name}, ${proche.relation}`} onPress={() => { if (!busy) setProcheId(proche.id); }} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 56, padding: 12, borderRadius: 14, backgroundColor: proche.id === procheId ? C.goldSoft : C.ivory }}>
              <Icon name={proche.id === procheId ? 'radio-button-on' : 'radio-button-off'} size={24} color={C.title} />
              <View style={{ flex: 1 }}><T v="bodyBold">{proche.name}</T><T v="small">{proche.relation}</T></View>
            </Pressable>)}
          </View>
          <T v="bodyBold" style={{ marginTop: 16, marginBottom: 8 }}>Adresse e-mail du compte du proche</T>
          <Field placeholder="Adresse e-mail du proche" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" maxLength={120} editable={!busy} />
          <T v="small">Le proche devra confirmer cette adresse dans son propre compte Liora.</T>
          <T v="h3" style={{ marginTop: 20, marginBottom: 10 }}>Documents autorisés</T>
          {!documents.length && <>
            <T>Ajoutez les documents à confier dans votre coffre-fort, puis synchronisez-les.</T>
            <OutlineBtn label="Ouvrir le coffre-fort" onPress={() => router.push('/coffre-fort')} style={{ marginTop: 10 }} />
          </>}
          {documents.map((doc) => <Checkbox key={doc.id} label={`${doc.name} (${doc.kind})`} checked={documentIds.includes(doc.id)} onChange={(checked) => {
            if (busy) return;
            if (checked && documentIds.length >= 20) return setActionError('Une clé peut autoriser jusqu’à 20 documents.');
            setDocumentIds((current) => checked ? [...current, doc.id] : current.filter((id) => id !== doc.id));
          }} />)}
          {syncStatus?.state !== 'synced' && <View style={{ gap: 10, marginTop: 14 }}>
            <T v="small">Synchronisez vos documents avant de créer la clé.</T>
            <OutlineBtn small label="Synchroniser maintenant" icon="cloud-upload-outline" disabled={busy} onPress={() => run(syncNow)} />
          </View>}
          <View style={{ marginTop: 18 }}>
            <Checkbox checked={consent} onChange={(value) => { if (!busy) setConsent(value); }} label="J’autorise l’accès automatique aux documents cochés après 48 heures sans refus de ma part, pour une durée de 24 heures." />
          </View>
          <T v="small" style={{ marginTop: 10 }}>Les demandes sont signalées dans Liora lorsque l’application est ouverte. Le proche pourra conserver les copies qu’il consulte.</T>
          <Btn label="Confirmer la création" icon="key-outline" disabled={busy || !consent || !documentIds.length || !selectedProche || syncStatus?.state !== 'synced'} onPress={prepare} style={{ marginTop: 18 }} />
          <OutlineBtn label="Annuler" disabled={busy} style={{ marginTop: 10 }} onPress={() => setFormOpen(false)} />
        </Card>}
      </View>}

      <FormSheet visible={passwordOpen} title="Créer la clé d’urgence" submitLabel="Créer la clé" fields={[{ key: 'password', label: 'Mot de passe de votre compte Liora', type: 'password', required: true }]} onClose={() => { if (!operation.current) setPasswordOpen(false); }} onSubmit={async (values) => {
        if (operation.current) return 'Une opération est déjà en cours.';
        operation.current = true;
        setBusy(true);
        try {
          const verified = await checkPassword(values.password);
          if (!verified.ok) return verified.error;
          if (!mounted.current) return;
          const result = await create({ procheId, recipientEmail: email.trim().toLowerCase(), documentIds });
          if (!mounted.current) return;
          if (focused.current && AppState.currentState === 'active') setCode(result.code);
          setPasswordOpen(false);
          setFormOpen(false);
          setConsent(false);
          setDocumentIds([]);
          setEmail('');
          setProcheId('');
        } catch (failure) {
          return failure instanceof Error ? failure.message : 'La création a échoué. Réessayez en ligne.';
        } finally {
          operation.current = false;
          if (mounted.current) setBusy(false);
        }
      }} />
    </Screen>
  );
}
