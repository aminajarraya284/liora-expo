import React from 'react';
import { View } from 'react-native';
import { Btn, OutlineBtn } from '../../components/controls';
import { Icon } from '../../components/icons';
import { T } from '../../components/text';
import { TINTS } from '../../theme';
import { displayHost, parseHttpsUrl } from '../../utils/validation';

/**
 * Version web : un navigateur ne peut pas en contenir un autre de façon
 * privée (les sites officiels refusent d'être affichés dans une autre page).
 * On ouvre donc le site dans un nouvel onglet, sans lui transmettre d'où l'on vient.
 */
export function PrivateBrowser({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const host = parseHttpsUrl(url)?.host ?? '';
  const open = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: TINTS.navy.wash[0] }}>
      <Icon name="lock-closed" size={48} color={TINTS.navy.ink} />
      <T v="h2" center style={{ marginTop: 12 }}>{title}</T>
      <T center style={{ marginTop: 6 }}>{displayHost(host)}</T>
      <T center style={{ marginTop: 14, marginBottom: 22 }}>
        Sur téléphone, ce site s’ouvre dans le navigateur privé de LIORA. Dans cet aperçu web, il s’ouvre dans un nouvel onglet.
      </T>
      <Btn label="Ouvrir le site" icon="open-outline" tint="navy" onPress={open} style={{ alignSelf: 'stretch' }} />
      <OutlineBtn label="Retour" icon="chevron-back" onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 12 }} />
    </View>
  );
}
