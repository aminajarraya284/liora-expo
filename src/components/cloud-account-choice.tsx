import React from 'react';
import { Pressable, View } from 'react-native';
import { useStore } from '../store';
import { C } from '../theme';
import { Icon } from './icons';
import { T, useColors } from './text';

/** Les anciens comptes restent locaux : choisir le mode ne transfère aucune donnée. */
export function CloudAccountChoice({ disabled = false, onChange }: { disabled?: boolean; onChange?: (mode: 'local' | 'cloud') => void }) {
  const { accountMode, setAccountMode, cloudAvailable, cloudError } = useStore();
  const colors = useColors();
  return (
    <View style={{ gap: 8, marginBottom: 18 }} accessibilityRole="radiogroup" accessibilityLabel="Type de compte">
      {([
        { mode: 'local', label: 'Sur ce téléphone', description: 'Pour les comptes créés sur cet appareil.' },
        { mode: 'cloud', label: 'En ligne · essai', description: 'Pour retrouver les données fictives sur plusieurs téléphones.' },
      ] as const).map(({ mode, label, description }) => {
        const selected = mode === accountMode;
        const unavailable = disabled || (mode === 'cloud' && !cloudAvailable);
        return (
          <Pressable key={mode} accessibilityRole="radio" accessibilityLabel={label}
            accessibilityState={{ checked: selected, disabled: unavailable }}
            disabled={unavailable} onPress={() => { if (mode !== accountMode) { onChange?.(mode); setAccountMode(mode); } }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, padding: 12, borderRadius: 16, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.title : colors.fieldBorder, backgroundColor: selected ? C.goldSoft : colors.card, opacity: unavailable ? 0.6 : pressed ? 0.75 : 1 })}>
            <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size={24} color={colors.title} />
            <View style={{ flex: 1 }}>
              <T v="bodyBold">{label}</T>
              <T v="small">{description}</T>
            </View>
          </Pressable>
        );
      })}
      {accountMode === 'cloud' && <T v="small">Essai uniquement : n’ajoutez pas de vraies données de santé. Les comptes locaux ne sont pas transférés automatiquement.</T>}
      {!cloudAvailable && <T v="small" c={cloudError ? C.danger : colors.muted}>{cloudError ?? 'Le mode en ligne n’est pas encore configuré.'}</T>}
    </View>
  );
}
