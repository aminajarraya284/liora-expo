import React, { useState } from 'react';
import { View } from 'react-native';
import { AuthShell } from '../../auth-shell';
import { CloudAccountChoice } from '../../components/cloud-account-choice';
import { PASSWORD_RULE } from '../../lib';
import { PHOTOS } from '../../photos';
import { useStore } from '../../store';
import { C } from '../../theme';
import { Btn, Checkbox, Field, Icon, OutlineBtn, T, useColors } from '../../ui';

export default function Register() {
  const { register, confirmSignup, accountMode } = useStore();
  const colors = useColors();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trialAccepted, setTrialAccepted] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (accountMode === 'cloud' && !trialAccepted) return setError('Confirmez que vous utiliserez uniquement des données fictives pour cet essai.');
      const result = await register(firstName, email, password, trialAccepted);
      if (!result.ok) setError(result.error);
      else if (result.message) setConfirmation(result.message);
    } catch {
      setError('Le compte n’a pas pu être créé. Veuillez réessayer.');
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    if (busy) return;
    setError(null);
    if (!/^\d{6,10}$/.test(code.trim())) return setError('Saisissez le code reçu par e-mail.');
    setBusy(true);
    try {
      const result = await confirmSignup(email.trim().toLowerCase(), code.trim(), password);
      if (!result.ok) setError(result.error);
    } catch {
      setError('Le code n’a pas pu être confirmé. Vérifiez votre connexion et réessayez.');
    } finally { setBusy(false); }
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
      <CloudAccountChoice disabled={busy || !!confirmation} onChange={() => { setError(null); setPassword(''); setCode(''); setConfirmation(null); setTrialAccepted(false); }} />
      {confirmation ? (
        <>
          <T style={{ marginBottom: 12 }}>{confirmation}</T>
          <T v="small" style={{ marginBottom: 12 }}>Adresse : {email.trim().toLowerCase()}. Vérifiez aussi le courrier indésirable.</T>
          <Field icon="keypad-outline" placeholder="Code reçu par e-mail" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" returnKeyType="go" onSubmitEditing={confirm} maxLength={10} editable={!busy} />
          <Btn label="Confirmer le code" icon="checkmark-circle-outline" onPress={confirm} loading={busy} />
          <OutlineBtn small label="Retour au formulaire" onPress={() => { setConfirmation(null); setCode(''); setError(null); }} disabled={busy} style={{ marginTop: 10 }} />
        </>
      ) : (
        <>
          <Field icon="person-outline" placeholder="Prénom" value={firstName} onChangeText={setFirstName} autoComplete="given-name" textContentType="givenName" returnKeyType="next" maxLength={40} editable={!busy} />
          <Field icon="mail-outline" placeholder="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="next" maxLength={120} editable={!busy} />
          <Field icon="lock-closed-outline" placeholder="Mot de passe" value={password} onChangeText={setPassword} secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit} maxLength={128} editable={!busy} />
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: -4, marginBottom: 6 }}>
            <Icon name="information-circle-outline" size={20} color={colors.text} />
            <T v="small" style={{ flex: 1 }}>{PASSWORD_RULE}</T>
          </View>
          {accountMode === 'cloud' && <Checkbox checked={trialAccepted} onChange={(value) => { if (!busy) setTrialAccepted(value); }} label="J’utiliserai uniquement des données fictives pour cet essai en ligne." />}
          <Btn label="Créer mon compte" icon="person-add-outline" onPress={submit} loading={busy} style={{ marginTop: 18 }} />
        </>
      )}
      {!!error && <T c={C.danger} style={{ marginTop: 6 }} accessibilityLiveRegion="polite">{error}</T>}
    </AuthShell>
  );
}
