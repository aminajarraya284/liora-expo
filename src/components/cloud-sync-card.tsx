import React, { useState } from 'react';
import { View } from 'react-native';
import type { SyncState } from '../cloud/sync-engine';
import { useStore } from '../store';
import { C } from '../theme';
import { OutlineBtn } from './controls';
import { useDialog } from './dialog';
import { Icon } from './icons';
import { Card } from './layout';
import { T } from './text';

const MESSAGES: Record<SyncState, string> = {
  synced: 'La copie de ce téléphone est à jour avec la copie en ligne.',
  pending: 'Des modifications attendent leur envoi. Elles seront synchronisées lorsque la connexion sera disponible.',
  syncing: 'La synchronisation est en cours. Gardez l’application ouverte.',
  offline: 'La synchronisation est indisponible pour le moment. Les modifications enregistrées sur ce téléphone restent en attente.',
  'auth-error': 'Reconnectez-vous pour reprendre la synchronisation. Vos modifications locales restent en attente.',
  conflict: 'Plusieurs versions existent. Choisissez celle à conserver avant de poursuivre la synchronisation.',
  'local-error': 'Les dernières modifications ne sont pas enregistrées sur ce téléphone. Gardez l’application ouverte et réessayez.',
  stopped: 'La synchronisation est arrêtée pour cette session.',
};

export function CloudSyncCard() {
  const { accountMode, syncStatus, syncNow, resolveSyncConflict, cloudError } = useStore();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = syncStatus?.state;
  const retry = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try { await syncNow(); }
    catch { setError('La synchronisation n’a pas pu se terminer. Réessayez après avoir vérifié votre connexion.'); }
    finally { setBusy(false); }
  };
  const choose = async (choice: 'local' | 'remote') => {
    if (busy) return;
    const local = choice === 'local';
    const confirmed = await dialog.confirm({
      title: local ? 'Garder ce téléphone ?' : 'Garder la copie en ligne ?',
      message: local
        ? 'Les informations de ce téléphone remplaceront la version en ligne. Les modifications présentes uniquement sur un autre téléphone pourront être perdues.'
        : 'Les informations en ligne remplaceront la copie de ce téléphone. Ses modifications qui n’ont pas été envoyées seront perdues.',
      ok: local ? 'Garder ce téléphone' : 'Prendre la copie en ligne',
      danger: true,
    });
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try { await resolveSyncConflict(choice); }
    catch { setError('Le choix n’a pas pu être appliqué. Les versions existantes sont conservées ; réessayez.'); }
    finally { setBusy(false); }
  };
  if (accountMode === 'local') return (
    <Card>
      <T v="h3">Compte sur ce téléphone</T>
      <T style={{ marginTop: 6 }}>Ce compte conserve ses informations sur cet appareil. Il ne possède pas de sauvegarde en ligne.</T>
      <T v="small" style={{ marginTop: 6 }}>Les comptes en ligne d’essai se créent séparément depuis l’écran de connexion.</T>
    </Card>
  );
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name={state === 'synced' ? 'cloud-done-outline' : state === 'conflict' || state === 'local-error' ? 'alert-circle-outline' : 'cloud-outline'} size={30} color={state === 'local-error' ? C.danger : C.title} />
        <T v="h3" style={{ flex: 1 }}>Synchronisation d’essai</T>
      </View>
      <T style={{ marginTop: 8 }} accessibilityLiveRegion="polite">{state ? MESSAGES[state] : 'Préparation de la synchronisation…'}</T>
      {!!syncStatus?.lastSyncedAt && <T v="small" style={{ marginTop: 6 }}>Dernière synchronisation : {new Date(syncStatus.lastSyncedAt).toLocaleString('fr-FR')}</T>}
      <T v="small" style={{ marginTop: 8 }}>Données fictives uniquement. La copie locale est chiffrée ; la copie en ligne est réservée à votre compte.</T>
      {!!(error ?? cloudError) && <T c={C.danger} style={{ marginTop: 8 }} accessibilityRole="alert">{error ?? cloudError}</T>}
      {state === 'conflict' ? (
        <View style={{ gap: 8, marginTop: 14 }}>
          <OutlineBtn small label="Garder ce téléphone" onPress={() => choose('local')} disabled={busy} />
          <OutlineBtn small label="Garder la copie en ligne" onPress={() => choose('remote')} disabled={busy} />
        </View>
      ) : (
        <OutlineBtn small label={busy || state === 'syncing' ? 'Synchronisation en cours…' : 'Synchroniser maintenant'} icon="sync-outline" onPress={retry} disabled={busy || state === 'syncing' || state === 'stopped' || !state} style={{ marginTop: 14 }} />
      )}
    </Card>
  );
}
