import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { openLink, telUrl } from '../lib';
import { useStore } from '../state/store';
import { F, shadow, TINTS } from '../theme';
import { useDialog } from './dialog';
import { tap } from './motion';

/**
 * Bouton d'urgence, rouge, à côté de la cloche. Il n'appelle jamais tout
 * seul : il ouvre d'abord un choix (proche principal, 15, 112), pour éviter
 * un appel lancé par erreur.
 */
export function SosBtn() {
  const router = useRouter();
  const dialog = useDialog();
  const { data } = useStore();
  const main = data.proches.find((p) => p.primary) ?? data.proches.find((p) => p.emergency) ?? data.proches[0];

  const call = async (phone: string) => {
    if (!(await openLink(telUrl(phone)))) dialog.alert('Appel impossible', `Cet appareil ne peut pas passer d’appel. Composez le ${phone}.`);
  };

  const open = () => {
    tap();
    dialog.menu('Urgence', [
      ...(main ? [{ label: `Appeler ${main.name}`, icon: 'call', onPress: () => call(main.phone) }] : []),
      { label: 'Appeler le 15 (SAMU)', icon: 'medkit-outline', danger: true, onPress: () => call('15') },
      { label: 'Appeler le 112', icon: 'call-outline', danger: true, onPress: () => call('112') },
      { label: 'Ma fiche d’urgence', icon: 'mc:alarm-light-outline', onPress: () => router.push('/urgence') },
    ]);
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel="Urgence"
      accessibilityHint="Ouvre le choix des numéros à appeler"
      hitSlop={6}
      style={({ pressed }) => [st.btn, shadow(0.25), pressed && { opacity: 0.75 }]}>
      {/* Taille fixe : « SOS » doit rester entier dans le rond, même avec « Grand texte ». */}
      <Text style={st.text} allowFontScaling={false}>SOS</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  btn: { width: 52, height: 52, borderRadius: 26, backgroundColor: TINTS.red.btn[1], borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: F.bold, fontSize: 16, letterSpacing: 0.5, color: '#FFFFFF' },
});
