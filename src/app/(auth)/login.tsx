import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { AuthShell } from '../../auth-shell';
import { PHOTOS } from '../../photos';
import { useStore } from '../../store';
import { C, F } from '../../theme';
import { Btn, Checkbox, Field, OutlineBtn, T } from '../../ui';

export default function Login() {
  const { login } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await login(email, password, remember);
    setBusy(false);
    if (!result.ok) setError(result.error);
  };

  return (
    <AuthShell
      title="Connexion"
      photo={PHOTOS.connexion}
      tint="bordeaux"
      speak="Connexion. Bienvenue sur LIORA. Connectez-vous à votre espace personnel."
      badgeIcon="person-outline"
      cardTitle={'Bienvenue\nsur LIORA'}
      cardText="Connectez-vous à votre espace personnel pour gérer votre bien-être et vos traitements."
      below={
        <View style={{ marginTop: 22, alignItems: 'center' }}>
          <T style={{ marginBottom: 12 }}>Vous n’avez pas encore de compte ?</T>
          <OutlineBtn label="Créer un compte" icon="person-add-outline" onPress={() => router.push('/register')} style={{ alignSelf: 'stretch', marginHorizontal: 12 }} />
        </View>
      }>
      <Field icon="mail-outline" placeholder="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="next" maxLength={120} />
      <Field icon="lock-closed-outline" placeholder="Mot de passe" value={password} onChangeText={setPassword} secure autoCapitalize="none" autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} error={error} maxLength={128} />
      <Checkbox checked={remember} onChange={setRemember} label="Se souvenir de moi" />
      <Btn label="Se connecter" icon="log-in-outline" onPress={submit} loading={busy} style={{ marginTop: 12 }} />
      <Link href="/forgot" style={{ alignSelf: 'center', marginTop: 16, padding: 6 }} accessibilityRole="link">
        <T c={C.primary} style={{ textDecorationLine: 'underline', fontFamily: F.semi }}>Mot de passe oublié ?</T>
      </Link>
    </AuthShell>
  );
}
