import React, { useState } from 'react';
import { View } from 'react-native';
import { C } from '../theme';
import { Btn, Card, CardTitle, Checkbox, Field, OutlineBtn, T } from '../ui';

const DEMO_CODE = 'DEMO-48H';
const DOCUMENTS = ['Attestation de mutuelle', 'Contrat d’assurance habitation'];
type Step = 'prepare' | 'code' | 'waiting' | 'active' | 'denied' | 'revoked' | 'expired';

/** Parcours fictif indépendant des comptes, documents et autorisations réels. */
export function EmergencyDemo() {
  const [step, setStep] = useState<Step>('prepare');
  const [selected, setSelected] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const [automatic, setAutomatic] = useState(false);

  const reset = () => {
    setStep('prepare');
    setSelected([]);
    setCode('');
    setError(null);
    setShowDocuments(false);
    setAutomatic(false);
  };

  return (
    <Card style={{ marginTop: 18 }}>
      <CardTitle icon="play-circle-outline">Essayer la Clé 48h</CardTitle>
      <T v="small" style={{ marginBottom: 14 }}>Démonstration avec Sophie et des documents fictifs. Les boutons ci-dessous permettent de parcourir les étapes sur cet appareil.</T>

      {step === 'prepare' && <View style={{ gap: 10 }}>
        <T v="title">Les documents confiés à Sophie</T>
        {DOCUMENTS.map((name) => <Checkbox key={name} label={name} checked={selected.includes(name)} onChange={(checked) => setSelected((current) => checked ? [...current, name] : current.filter((item) => item !== name))} />)}
        <Btn label="Créer le code de démo" icon="key-outline" disabled={!selected.length} onPress={() => setStep('code')} />
      </View>}

      {step === 'code' && <View style={{ gap: 10 }}>
        <T>Le code de démonstration à remettre à Sophie est</T>
        <T v="h2" selectable center>{DEMO_CODE}</T>
        <T v="small">Jouez maintenant le rôle de Sophie et saisissez ce code.</T>
        <Field placeholder="Code de démonstration" value={code} onChangeText={(value) => { setCode(value); setError(null); }} autoCapitalize="characters" autoCorrect={false} maxLength={24} error={error} />
        <Btn label="Demander l’accès (démo)" onPress={() => {
          if (code.trim().toUpperCase() !== DEMO_CODE) return setError('Saisissez le code DEMO-48H affiché plus haut.');
          setStep('waiting');
          setCode('');
        }} />
      </View>}

      {step === 'waiting' && <View style={{ gap: 12 }}>
        <T v="title">Sophie demande l’accès</T>
        <T>« J’ai besoin de retrouver les papiers que vous m’avez autorisée à consulter. »</T>
        <T v="bodyBold">Il vous reste 48 heures pour refuser.</T>
        <T v="small">Dans le parcours en ligne, cette demande apparaît dans Liora lorsque vous ouvrez l’application.</T>
        <Btn label="Autoriser maintenant (démo)" onPress={() => { setAutomatic(false); setStep('active'); }} />
        <OutlineBtn label="Refuser la demande (démo)" color={C.danger} onPress={() => setStep('denied')} />
        <OutlineBtn label="Avancer de 48 h (démo)" icon="time-outline" onPress={() => { setAutomatic(true); setStep('active'); }} />
      </View>}

      {step === 'active' && <View style={{ gap: 12 }}>
        <T v="title">Accès ouvert pour 24 heures</T>
        <T>{automatic ? 'Les 48 heures se sont écoulées sans refus. Sophie peut maintenant consulter les documents sélectionnés.' : 'Vous avez accepté la demande. Sophie peut maintenant consulter les documents sélectionnés.'}</T>
        <OutlineBtn label="Voir les documents fictifs" icon="documents-outline" onPress={() => setShowDocuments(true)} />
        {showDocuments && <View style={{ gap: 8 }}>
          {selected.map((name) => <View key={name} style={{ backgroundColor: C.ivory, borderRadius: 12, padding: 12 }}>
            <T v="bodyBold">{name}</T>
            <T v="small">Document de démonstration, sans valeur administrative.</T>
          </View>)}
        </View>}
        <OutlineBtn label="Révoquer la clé (démo)" color={C.danger} onPress={() => { setShowDocuments(false); setStep('revoked'); }} />
        <OutlineBtn label="Avancer de 24 h (démo)" icon="time-outline" onPress={() => { setShowDocuments(false); setStep('expired'); }} />
      </View>}

      {step === 'denied' && <T accessibilityLiveRegion="polite">La demande de Sophie est refusée. L’accès reste fermé.</T>}
      {step === 'revoked' && <T accessibilityLiveRegion="polite">La clé est révoquée. Toute nouvelle consultation avec cette clé est bloquée.</T>}
      {step === 'expired' && <T accessibilityLiveRegion="polite">Les 24 heures d’accès sont écoulées. Une nouvelle clé sera nécessaire.</T>}
      {step !== 'prepare' && <OutlineBtn small label="Recommencer la démonstration" onPress={reset} style={{ marginTop: 16 }} />}
    </Card>
  );
}
