import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { APP_VERSION } from '../../config';
import { Card, CircleBtn, Header, Hero, Row, Screen, T, useDialog } from '../../ui';

export default function Parametres() {
  const router = useRouter();
  const dialog = useDialog();
  const go = (section: string) => () => router.push(`/reglages/${section}` as never);
  return (
    <Screen section="parametres" speak="Paramètres. Personnalisez LIORA selon vos besoins.">
      <Header title="Paramètres" right={<CircleBtn icon="help-circle-outline" label="Aide" onPress={() => dialog.alert('Aide', 'Touchez une rubrique pour régler les notifications, la confidentialité, la langue ou l’assistant.')} />} />
      <Hero center icon="settings-outline" title="Paramètres" subtitle="Personnalisez LIORA selon vos besoins" />
      <View style={{ gap: 12 }}>
        <Card pad={10}><Row big icon="notifications-outline" title="Notifications" subtitle="Rappels, alertes et messages" onPress={go('notifications')} /></Card>
        <Card pad={10}><Row big icon="shield-checkmark-outline" title="Confidentialité" subtitle="Données personnelles et sécurité" onPress={go('confidentialite')} /></Card>
        <Card pad={10}>
          <Row big icon="globe-outline" title="Langue" onPress={go('langue')} right={<View style={{ backgroundColor: '#EFE6E6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 }}><T>Français</T></View>} />
        </Card>
        <Card pad={10}><Row big icon="sparkles" title="Assistant LIORA" subtitle="Préférences et mode de réponse" onPress={go('assistant')} /></Card>
        <Card pad={10} style={{ marginTop: 12 }}><Row big plainIcon icon="information-circle-outline" title="À propos de LIORA" subtitle={`Version ${APP_VERSION}`} onPress={go('a-propos')} /></Card>
      </View>
    </Screen>
  );
}
