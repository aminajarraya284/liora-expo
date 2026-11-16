import React from 'react';
import { View } from 'react-native';
import { type Settings, useStore } from '../../store';
import { Card, CircleBtn, Header, Hero, Row, Screen, Toggle, useDialog } from '../../ui';

const OPTIONS: { key: keyof Settings; icon: string; title: string; subtitle: string }[] = [
  { key: 'bigText', icon: 'mc:format-size', title: 'Grand texte', subtitle: 'Augmente la taille des textes pour une meilleure lecture' },
  { key: 'highContrast', icon: 'contrast-outline', title: 'Contraste renforcé', subtitle: 'Des couleurs plus contrastées pour une meilleure visibilité' },
  { key: 'speech', icon: 'volume-high-outline', title: 'Lecture vocale', subtitle: 'Faire lire les textes par l’Assistant LIORA' },
  { key: 'reduceMotion', icon: 'play-outline', title: 'Animations réduites', subtitle: 'Limiter les mouvements et effets visuels' },
  { key: 'simple', icon: 'layers-outline', title: 'Mode simplifié', subtitle: 'Une interface allégée et encore plus facile à utiliser' },
];

export default function Accessibilite() {
  const { settings, setSettings } = useStore();
  const dialog = useDialog();
  return (
    <Screen section="accessibilite" speak="Accessibilité. Adaptez l’application à votre confort.">
      <Header title="Accessibilité" right={<CircleBtn icon="help-circle-outline" label="Aide" onPress={() => dialog.alert('Aide', 'Activez ou désactivez chaque option en touchant son interrupteur. Les réglages s’appliquent immédiatement à toute l’application.')} />} />
      <Hero center icon="accessibility" title="Accessibilité" subtitle="Adaptez l’application à votre confort" />
      <View style={{ gap: 12 }}>
        {OPTIONS.map((option) => (
          <Card key={option.key} pad={10}>
            <Row big icon={option.icon} title={option.title} subtitle={option.subtitle} right={<Toggle value={!!settings[option.key]} onChange={(value) => setSettings({ [option.key]: value })} label={option.title} />} />
          </Card>
        ))}
      </View>
    </Screen>
  );
}
