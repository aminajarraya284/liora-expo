import React, { useState } from 'react';
import { View } from 'react-native';
import { AuthShell } from '../../auth-shell';
import { isEmail } from '../../lib';
import { PHOTOS } from '../../photos';
import { requestPasswordReset } from '../../services/password-reset';
import { TINTS } from '../../theme';
import { Btn, Field, Icon, T } from '../../ui';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setSent(false);
    if (!isEmail(email)) return setError('Veuillez saisir une adresse e-mail valide.');
    setBusy(true);
    const result = await requestPasswordReset(email.trim().toLowerCase());
    setBusy(false);
    if (result.ok) setSent(true);
    else setError(result.error);
  };

  return (
    <AuthShell
      title="Mot de passe oublié"
      photo={PHOTOS.motDePasseOublie}
      tint="purple"
      back
      speak="Mot de passe oublié. Pas d’inquiétude ! Saisissez votre adresse e-mail pour recevoir un lien sécurisé."
      badgeIcon="lock-closed-outline"
      cardTitle="Pas d’inquiétude !"
      cardText="Saisissez votre adresse e-mail pour recevoir un lien sécurisé afin de réinitialiser votre mot de passe.">
      <Field icon="mail-outline" placeholder="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={submit} error={error} maxLength={120} />
      <Btn label="Envoyer le lien" icon="paper-plane-outline" onPress={submit} loading={busy} style={{ marginTop: 14, marginBottom: 22 }} />
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: TINTS.purple.soft, borderRadius: 20, padding: 14 }}>
        <Icon name={sent ? 'checkmark-circle-outline' : 'information-circle-outline'} size={30} color={TINTS.purple.ink} />
        <T style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {sent
            ? 'Si un compte existe pour cette adresse, un e-mail vient d’être envoyé. Pensez à vérifier votre dossier « Courrier indésirable ».'
            : 'Vous recevrez un e-mail dans quelques minutes. Pensez à vérifier votre dossier « Courrier indésirable » si vous ne le voyez pas.'}
        </T>
      </View>
    </AuthShell>
  );
}
