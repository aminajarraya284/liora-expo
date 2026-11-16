import React, { useState } from 'react';
import { View } from 'react-native';
import { AuthShell } from '../../auth-shell';
import { PASSWORD_RULE } from '../../lib';
import { PHOTOS } from '../../photos';
import { useStore } from '../../store';
import { C } from '../../theme';
import { Btn, Field, Icon, T, useColors } from '../../ui';

export default function Register() {
  const { register } = useStore();
  const colors = useColors();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await register(firstName, email, password);
    setBusy(false);
    if (!result.ok) setError(result.error);
  };

  return (
    <AuthShell
      title="Créer un compte"
      photo={PHOTOS.inscription}
      tint="gold"
      back
      speak="Créer un compte. Rejoignez LIORA en quelques étapes."
      badgeIcon="person-add-outline"
      cardTitle="Rejoignez LIORA"
      cardText="Créez votre compte en quelques étapes pour profiter pleinement de nos services.">
      <Field icon="person-outline" placeholder="Prénom" value={firstName} onChangeText={setFirstName} autoComplete="given-name" textContentType="givenName" returnKeyType="next" maxLength={40} />
      <Field icon="mail-outline" placeholder="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="next" maxLength={120} />
      <Field icon="lock-closed-outline" placeholder="Mot de passe" value={password} onChangeText={setPassword} secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit} maxLength={128} />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: -4, marginBottom: 6 }}>
        <Icon name="information-circle-outline" size={20} color={colors.text} />
        <T v="small" style={{ flex: 1 }}>{PASSWORD_RULE}</T>
      </View>
      {!!error && <T c={C.danger} style={{ marginTop: 6 }} accessibilityLiveRegion="polite">{error}</T>}
      <Btn label="Créer mon compte" icon="person-add-outline" onPress={submit} loading={busy} style={{ marginTop: 18 }} />
    </AuthShell>
  );
}
