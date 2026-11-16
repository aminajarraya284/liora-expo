import React from 'react';
import { type ImageSourcePropType, KeyboardAvoidingView, Platform, View } from 'react-native';
import { type Tint, TINTS } from './theme';
import { Card, CircleBtn, Icon, Logo, PhotoBanner, Screen, T, useBack, usePhotosEnabled } from './ui';

/** Gabarit commun aux écrans Connexion, Créer un compte et Mot de passe oublié. */
export function AuthShell({
  title, photo, tint, back, speak, badgeIcon, cardTitle, cardText, children, below,
}: {
  title: string;
  /** Photo du bandeau, en haut de l'écran. */
  photo: ImageSourcePropType;
  /** Couleur de l'écran : rose pour la connexion, or pour l'inscription, violet pour le mot de passe oublié. */
  tint: Tint;
  back?: boolean;
  speak: string;
  badgeIcon: string;
  cardTitle: string;
  cardText: string;
  children: React.ReactNode;
  below?: React.ReactNode;
}) {
  const goBack = useBack('/login');
  const photosEnabled = usePhotosEnabled();
  const palette = TINTS[tint];
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen tint={tint} speak={speak}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, marginBottom: 6 }}>
          <View style={{ width: 44 }}>{back && <CircleBtn icon="chevron-back" onPress={goBack} label="Retour" />}</View>
          <View style={{ flex: 1, alignItems: 'center' }}><Logo size={30} /></View>
          <View style={{ width: 44 }} />
        </View>
        {photosEnabled ? (
          <PhotoBanner photo={photo} title={title} height={150} />
        ) : (
          <T v="h1" style={{ fontSize: 32, marginLeft: 6, marginVertical: 18 }} accessibilityRole="header">{title}</T>
        )}
        <Card pad={18}>
          <View style={{ flexDirection: 'row', gap: 14, marginBottom: 18 }}>
            <View style={{ width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.soft }}>
              <Icon name={badgeIcon} size={36} color={palette.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="h2">{cardTitle}</T>
              <T style={{ marginTop: 4 }}>{cardText}</T>
            </View>
          </View>
          {children}
        </Card>
        {below}
      </Screen>
    </KeyboardAvoidingView>
  );
}
