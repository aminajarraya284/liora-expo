import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { AuthShell } from '../../auth-shell';
import { CloudAccountChoice } from '../../components/cloud-account-choice';
import { isEmail, passwordError, PASSWORD_RULE } from '../../lib';
import { PHOTOS } from '../../photos';
import { requestPasswordReset } from '../../services/password-reset';
import { useStore } from '../../store';
import { C, TINTS } from '../../theme';
import { Btn, Field, Icon, OutlineBtn, T } from '../../ui';

export default function Forgot() {
  const router = useRouter();
  const { accountMode, resetCloudPassword } = useStore();
  const cloud = accountMode === 'cloud';
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setSent(false);
    if (!isEmail(email)) return setError('Veuillez saisir une adresse e-mail valide.');
    setBusy(true);
    try {
      const result = await requestPasswordReset(email.trim().toLowerCase(), accountMode);
      if (result.ok) setSent(true);
      else setError(result.error);
    } catch {
      setError('L’envoi du code n’a pas pu aboutir. Veuillez réessayer.');
    } finally { setBusy(false); }
  };

  const reset = async () => {
    if (busy) return;
    setError(null);
    if (!/^\d{6,10}$/.test(code.trim())) return setError('Saisissez le code reçu par e-mail.');
    const weak = passwordError(password);
    if (weak) return setError(weak);
    if (password !== again) return setError('Les deux mots de passe sont différents.');
    setBusy(true);
    try {
      const result = await resetCloudPassword(email.trim().toLowerCase(), code.trim(), password);
      if (!result.ok) setError(result.error);
      else { setDone(true); setPassword(''); setAgain(''); setCode(''); }
    } catch {
      setError('Le mot de passe n’a pas pu être modifié. Veuillez réessayer.');
    } finally { setBusy(false); }
  };

  return (
    <AuthShell
      title="Mot de passe oublié"
      photo={PHOTOS.motDePasseOublie}
      tint="purple"
      back
      speak={cloud ? 'Mot de passe oublié. Recevez un code par e-mail pour réinitialiser le mot de passe de votre compte en ligne.' : 'Mot de passe oublié. Les comptes locaux ne disposent pas de réinitialisation par e-mail.'}
      badgeIcon="lock-closed-outline"
      cardTitle="Pas d’inquiétude !"
      cardText={cloud ? 'Recevez un code par e-mail pour choisir un nouveau mot de passe.' : 'Le mot de passe de ce compte est vérifié uniquement sur le téléphone où il a été créé.'}>
      <CloudAccountChoice disabled={busy || sent} onChange={() => { setError(null); setSent(false); setCode(''); setPassword(''); setAgain(''); setDone(false); }} />
      {!cloud ? (
        <>
          <T>Ce compte ne dispose pas de réinitialisation par e-mail. Son mot de passe local ne peut pas être récupéré par un serveur.</T>
          <OutlineBtn label="Retour à la connexion" onPress={() => router.replace('/login')} style={{ marginTop: 16 }} />
        </>
      ) : done ? (
        <>
          <T accessibilityLiveRegion="polite">Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.</T>
          <Btn label="Se connecter" onPress={() => router.replace('/login')} style={{ marginTop: 16 }} />
        </>
      ) : (
        <>
          <Field icon="mail-outline" placeholder="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={sent ? undefined : submit} maxLength={120} editable={!busy && !sent} />
          {sent ? (
            <>
              <Field icon="keypad-outline" placeholder="Code reçu par e-mail" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={10} editable={!busy} />
              <Field icon="lock-closed-outline" placeholder="Nouveau mot de passe" value={password} onChangeText={setPassword} secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" maxLength={128} editable={!busy} />
              <Field icon="lock-closed-outline" placeholder="Confirmer le mot de passe" value={again} onChangeText={setAgain} secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" maxLength={128} editable={!busy} returnKeyType="go" onSubmitEditing={reset} />
              <T v="small" style={{ marginBottom: 12 }}>{PASSWORD_RULE}</T>
              <Btn label="Enregistrer" icon="key-outline" onPress={reset} loading={busy} style={{ marginBottom: 16 }} />
              <OutlineBtn small label="Modifier l’adresse e-mail" onPress={() => { setSent(false); setCode(''); setPassword(''); setAgain(''); setError(null); }} disabled={busy} style={{ marginBottom: 16 }} />
            </>
          ) : <Btn label="Envoyer le code" icon="paper-plane-outline" onPress={submit} loading={busy} style={{ marginTop: 14, marginBottom: 22 }} />}
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: TINTS.purple.soft, borderRadius: 20, padding: 14 }}>
            <Icon name={sent ? 'checkmark-circle-outline' : 'information-circle-outline'} size={30} color={TINTS.purple.ink} />
            <T style={{ flex: 1 }} accessibilityLiveRegion="polite">{sent ? 'Si un compte existe pour cette adresse, un code vient d’être envoyé. Vérifiez aussi le courrier indésirable.' : 'Le code reçu par e-mail sera saisi directement dans LIORA.'}</T>
          </View>
        </>
      )}
      {!!error && <T c={C.danger} style={{ marginTop: 10 }} accessibilityRole="alert">{error}</T>}
    </AuthShell>
  );
}
