import { useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useState } from 'react';
import { type ImageSourcePropType, View } from 'react-native';
import { APP_VERSION } from '../../../config';
import { assistantConfigured } from '../../../features/assistant/relay';
import { passwordError } from '../../../lib';
import { PHOTOS } from '../../../photos';
import { type Settings, useStore } from '../../../store';
import { C } from '../../../theme';
import { Btn, Card, Divider, FormSheet, Header, Icon, Logo, OutlineBtn, PhotoBanner, Row, Screen, T, Toggle, useDialog, usePalette, usePhotosEnabled } from '../../../ui';

const TITLES: Record<string, string> = {
  notifications: 'Notifications',
  confidentialite: 'Confidentialité',
  langue: 'Langue',
  assistant: 'Assistant LIORA',
  'a-propos': 'À propos',
};

function ToggleRow({ setting, icon, title, subtitle }: { setting: keyof Settings; icon: string; title: string; subtitle: string }) {
  const { settings, setSettings } = useStore();
  return <Row icon={icon} title={title} subtitle={subtitle} right={<Toggle value={!!settings[setting]} onChange={(value) => setSettings({ [setting]: value })} label={title} />} />;
}

function Notifications() {
  return (
    <Card pad={12} style={{ paddingVertical: 4 }}>
      <ToggleRow setting="notifRappels" icon="alarm-outline" title="Rappels" subtitle="Traitements et rendez-vous" />
      <Divider />
      <ToggleRow setting="notifAlertes" icon="warning-outline" title="Alertes" subtitle="Informations importantes" />
      <Divider />
      <ToggleRow setting="notifMessages" icon="chatbubble-outline" title="Messages" subtitle="Messages de vos proches" />
    </Card>
  );
}

function Confidentialite() {
  const { logout, changePassword, deleteAccount, user, encryption } = useStore();
  const dialog = useDialog();
  const palette = usePalette();
  const [sheet, setSheet] = useState<null | 'password' | 'delete'>(null);
  const encrypted = encryption === 'active';

  const signOut = async () => {
    if (await dialog.confirm({ title: 'Se déconnecter ?', message: 'Vos informations restent enregistrées sur cet appareil.', ok: 'Se déconnecter' })) {
      const result = await logout();
      if (!result.ok) await dialog.alert('Sauvegarde nécessaire', result.error);
    }
  };
  const askDelete = async () => {
    const sure = await dialog.confirm({ title: 'Supprimer le compte ?', message: 'Toutes vos données et tous vos documents seront effacés de cet appareil. Cette action est irréversible.', ok: 'Continuer', danger: true });
    if (sure) setSheet('delete');
  };

  return (
    <>
      <Card>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Icon name="shield-checkmark-outline" size={34} color={palette.ink} />
          <T style={{ flex: 1 }}>Vos informations sont enregistrées sur cet appareil uniquement. Elles ne sont transmises à aucun tiers.</T>
        </View>
      </Card>
      <Card pad={12} style={{ marginTop: 12, paddingVertical: 4 }}>
        <Row
          plainIcon
          icon={encrypted ? 'lock-closed-outline' : 'lock-open-outline'}
          title="Chiffrement des données"
          subtitle={encrypted ? 'Actif : vos données sont illisibles sans ce téléphone' : 'Indisponible sur cet appareil'}
          right={<Icon name={encrypted ? 'checkmark-circle' : 'alert-circle'} size={26} color={encrypted ? C.ok : C.danger} />}
        />
        <Divider />
        <Row plainIcon icon="mail-outline" title="Compte" subtitle={user?.email} />
        <Divider />
        <Row plainIcon icon="key-outline" title="Changer mon mot de passe" onPress={() => setSheet('password')} />
      </Card>
      <OutlineBtn label="Se déconnecter" icon="log-out-outline" style={{ marginTop: 18 }} onPress={signOut} />
      <OutlineBtn label="Supprimer mon compte" icon="trash-outline" color={C.danger} style={{ marginTop: 12 }} onPress={askDelete} />

      <FormSheet
        visible={sheet === 'password'}
        title="Changer mon mot de passe"
        onClose={() => setSheet(null)}
        submitLabel="Changer le mot de passe"
        fields={[
          { key: 'current', label: 'Mot de passe actuel', type: 'password', required: true },
          { key: 'next', label: 'Nouveau mot de passe', type: 'password', required: true, validate: passwordError },
          { key: 'again', label: 'Confirmer le nouveau mot de passe', type: 'password', required: true, validate: (value, all) => (value === all.next ? null : 'Les deux mots de passe sont différents.') },
        ]}
        onSubmit={async (values) => {
          const result = await changePassword(values.current, values.next);
          if (!result.ok) return result.error;
          setSheet(null);
          dialog.alert('Mot de passe modifié', 'Votre nouveau mot de passe est enregistré.');
        }}
      />
      <FormSheet
        visible={sheet === 'delete'}
        title="Supprimer mon compte"
        onClose={() => setSheet(null)}
        submitLabel="Supprimer définitivement"
        fields={[{ key: 'password', label: 'Saisissez votre mot de passe pour confirmer', type: 'password', required: true }]}
        onSubmit={async (values) => {
          const result = await deleteAccount(values.password);
          if (!result.ok) return result.error;
        }}
      />
    </>
  );
}

function Langue() {
  const palette = usePalette();
  return (
    <>
      <Card pad={12}>
        <Row plainIcon icon="globe-outline" title="Français" subtitle="Langue de l’application" right={<Icon name="checkmark-circle" size={28} color={palette.ink} />} />
      </Card>
      <T center style={{ marginTop: 14 }}>LIORA est disponible en français.</T>
    </>
  );
}

function Assistant() {
  const sample = 'Bonjour, je suis l’Assistant LIORA. Je peux lire les textes de l’application à voix haute.';
  const listen = () => {
    Speech.stop();
    Speech.speak(sample, { language: 'fr-FR', rate: 0.95 });
  };
  return (
    <>
      <Card pad={12} style={{ paddingVertical: 4 }}>
        <Row
          plainIcon
          icon={assistantConfigured ? 'cloud-done-outline' : 'cloud-offline-outline'}
          title="Service d’assistant"
          subtitle={assistantConfigured ? 'Connecté' : 'Pas encore connecté sur cet appareil'}
        />
        <Divider />
        <ToggleRow setting="assistantConsent" icon="chatbubbles-outline" title="Conversation avec LIORA" subtitle="Autoriser l’envoi de vos messages au service d’assistant" />
        <Divider />
        <ToggleRow setting="faceScanConsent" icon="scan-outline" title="Scan du visage" subtitle="Autoriser l’analyse d’une photo pour proposer une humeur" />
      </Card>
      <Card pad={12} style={{ marginTop: 12, paddingVertical: 4 }}>
        <ToggleRow setting="speech" icon="volume-high-outline" title="Réponse vocale" subtitle="L’assistant lit chaque écran et ses réponses à voix haute" />
        <Divider />
        <ToggleRow setting="bigText" icon="mc:format-size" title="Grand texte" subtitle="Des textes plus faciles à lire" />
      </Card>
      <Btn label="Écouter la voix" icon="play" style={{ marginTop: 18 }} onPress={listen} />
      <T v="small" center style={{ marginTop: 14 }}>
        L’assistant ne voit que ce que vous lui demandez de consulter. Il n’a jamais accès au coffre-fort ni à vos numéros de téléphone.
      </T>
    </>
  );
}

function APropos() {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
      <Logo size={34} />
      <T center style={{ marginTop: 10, fontStyle: 'italic' }}>Bien-être, santé et assistance au quotidien</T>
      <T v="bodyBold" style={{ marginTop: 14 }}>Version {APP_VERSION}</T>
      <T center style={{ marginTop: 14 }}>LIORA vous aide à suivre vos traitements, garder le lien avec vos proches et prendre soin de vous, jour après jour.</T>
      <T v="small" center style={{ marginTop: 14 }}>LIORA ne remplace pas un avis médical. En cas d’urgence, appelez le 15 ou le 112.</T>
    </Card>
  );
}

const BANNERS: Record<string, { photo: ImageSourcePropType; subtitle: string } | undefined> = {
  notifications: { photo: PHOTOS.notifications, subtitle: 'Rappels, alertes et messages' },
  confidentialite: { photo: PHOTOS.confidentialite, subtitle: 'Données personnelles et sécurité' },
};

const PAGES: Record<string, () => React.JSX.Element> = { notifications: Notifications, confidentialite: Confidentialite, langue: Langue, assistant: Assistant };

export default function Reglage() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const title = TITLES[section] ?? 'Paramètres';
  const Page = PAGES[section] ?? APropos;
  const banner = BANNERS[section];
  const photosEnabled = usePhotosEnabled();
  return (
    <Screen section="parametres" speak={title}>
      <Header title={title} fallback="/parametres" />
      {!!banner && photosEnabled && <PhotoBanner photo={banner.photo} title={title} subtitle={banner.subtitle} height={150} />}
      <View style={{ marginTop: 8 }}>
        <Page />
      </View>
    </Screen>
  );
}
