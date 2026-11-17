import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { AuthShell } from '../../auth-shell';
import { CloudAccountChoice } from '../../components/cloud-account-choice';
import { PHOTOS } from '../../photos';
import { useStore } from '../../store';
import { C, F } from '../../theme';
import { Btn, Checkbox, Field, OutlineBtn, T, useDialog } from '../../ui';

export default function Login() {
  const { login, accountMode, resetCloudConnection } = useStore();
  const dialog = useDialog();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await login(email, password, remember);
      if (!result.ok) setError(result.error);
    } catch {
      setError('La connexion n’a pas pu aboutir. Veuillez réessayer.');
    } finally { setBusy(false); }
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
      <CloudAccountChoice disabled={busy} onChange={() => { setError(null); setPassword(''); }} />
      <Field icon="mail-outline" placeholder="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="next" maxLength={120} editable={!busy} />
      <Field icon="lock-closed-outline" placeholder="Mot de passe" value={password} onChangeText={setPassword} secure autoCapitalize="none" autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} error={error} maxLength={128} editable={!busy} />
      <Checkbox checked={remember} onChange={(value) => { if (!busy) setRemember(value); }} label="Se souvenir de moi" />
      <Btn label="Se connecter" icon="log-in-outline" onPress={submit} loading={busy} style={{ marginTop: 12 }} />
      {accountMode === 'cloud' && <OutlineBtn small label="Réinitialiser la connexion mémorisée" disabled={busy} style={{ marginTop: 12 }} onPress={async () => {
        if (!(await dialog.confirm({ title: 'Oublier la connexion ?', message: 'La connexion mémorisée sera effacée. Les données chiffrées de vos comptes resteront sur cet appareil.', ok: 'Oublier la connexion' }))) return;
        setBusy(true);
        try {
          const result = await resetCloudConnection();
          await dialog.alert(result.ok ? 'Connexion réinitialisée' : 'Réinitialisation impossible', result.ok ? result.message : result.error);
        } finally { setBusy(false); }
      }} />}
      <Link href="/forgot" style={{ alignSelf: 'center', marginTop: 16, padding: 6 }} accessibilityRole="link">
        <T c={C.primary} style={{ textDecorationLine: 'underline', fontFamily: F.semi }}>Mot de passe oublié ?</T>
      </Link>
    </AuthShell>
  );
}
