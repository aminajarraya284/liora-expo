import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import React, { useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { assistantConfigured, RELAY_MESSAGES, RelayError, requestMoodScan } from '../../features/assistant/relay';
import { withMood } from '../../features/mood/log';
import { MoodFace } from '../../features/mood/MoodFace';
import { type MoodKey, MOODS } from '../../features/mood/moods';
import { removeFile, uid } from '../../lib';
import { useStore } from '../../store';
import { Btn, Card, Header, Icon, OutlineBtn, Pop, Screen, T, useBack, usePalette } from '../../ui';

/** Largeur de la photo envoyée : suffisante pour lire une expression, et légère à transmettre. */
const PHOTO_WIDTH = 640;

type Step =
  | { name: 'camera' }
  | { name: 'analysing' }
  | { name: 'result'; mood: MoodKey | null }
  | { name: 'error'; message: string };

/** Réduit la photo et la renvoie en JPEG encodé en base64, puis efface les fichiers temporaires. */
async function prepare(uri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(uri).resize({ width: PHOTO_WIDTH }).renderAsync();
  const saved = await image.saveAsync({ base64: true, compress: 0.6, format: SaveFormat.JPEG });
  removeFile(uri);
  removeFile(saved.uri);
  if (!saved.base64) throw new Error('PHOTO_UNREADABLE');
  return saved.base64;
}

function Message({ icon, title, text, children }: { icon: string; title: string; text: string; children?: React.ReactNode }) {
  const palette = usePalette();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 24, marginTop: 8 }}>
      <Icon name={icon} size={52} color={palette.ink} />
      <T v="h2" center style={{ marginTop: 10 }}>{title}</T>
      <T center style={{ marginTop: 8, marginBottom: 18 }}>{text}</T>
      <View style={{ alignSelf: 'stretch', gap: 10 }}>{children}</View>
    </Card>
  );
}

export default function HumeurScan() {
  const { settings, setSettings, update } = useStore();
  const goBack = useBack('/humeur');
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>({ name: 'camera' });

  const scan = async () => {
    if (!camera.current) return;
    setStep({ name: 'analysing' });
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.6, shutterSound: false });
      const reading = await requestMoodScan({ image: await prepare(photo.uri) });
      setStep({ name: 'result', mood: reading.mood });
    } catch (error) {
      const message = error instanceof RelayError ? RELAY_MESSAGES[error.kind] : 'La photo n’a pas pu être prise.';
      setStep({ name: 'error', message });
    }
  };

  const accept = (mood: MoodKey) => {
    update((d) => withMood(d, mood, 'scan', uid()));
    goBack();
  };

  const body = () => {
    if (!assistantConfigured) {
      return (
        <Message icon="cloud-offline-outline" title="Scan pas encore disponible" text="Le scan du visage a besoin du service d’assistant, qui n’est pas encore connecté sur cet appareil. Vous pouvez choisir votre humeur vous-même.">
          <Btn label="Choisir mon humeur" icon="happy-outline" onPress={goBack} />
        </Message>
      );
    }
    if (!settings.faceScanConsent) {
      return (
        <Message
          icon="scan-outline"
          title="Scanner mon visage"
          text="LIORA prend une photo de votre visage et l’envoie à son service d’intelligence artificielle, qui propose une humeur d’après votre expression. La photo n’est pas conservée, et c’est toujours vous qui validez le résultat.">
          <Btn label="J’accepte" icon="checkmark" onPress={() => setSettings({ faceScanConsent: true })} />
          <OutlineBtn label="Non merci" onPress={goBack} />
        </Message>
      );
    }
    if (!permission) return null;
    if (!permission.granted) {
      return (
        <Message icon="camera-outline" title="Autoriser la caméra" text="LIORA a besoin de la caméra, uniquement le temps de prendre la photo.">
          {permission.canAskAgain ? (
            <Btn label="Autoriser la caméra" icon="camera-outline" onPress={requestPermission} />
          ) : (
            <Btn label="Ouvrir les réglages" icon="settings-outline" onPress={() => Linking.openSettings().catch(() => {})} />
          )}
          <OutlineBtn label="Choisir moi-même" onPress={goBack} />
        </Message>
      );
    }
    if (step.name === 'result') {
      const mood = step.mood;
      if (!mood) {
        return (
          <Message icon="help-circle-outline" title="Expression difficile à lire" text="Je n’arrive pas à lire votre expression sur cette photo. Vous pouvez réessayer avec plus de lumière, ou choisir vous-même.">
            <Btn label="Réessayer" icon="refresh-outline" onPress={() => setStep({ name: 'camera' })} />
            <OutlineBtn label="Choisir moi-même" onPress={goBack} />
          </Message>
        );
      }
      return (
        <Card style={{ alignItems: 'center', paddingVertical: 24, marginTop: 8 }}>
          <Pop trigger={mood}><MoodFace mood={mood} size={110} /></Pop>
          <T v="h2" center style={{ marginTop: 12 }}>{MOODS[mood].label}</T>
          <T center style={{ marginTop: 8, marginBottom: 18, fontSize: 17 }}>Il me semble lire {MOODS[mood].reading} sur votre visage. Est-ce bien cela ?</T>
          <View style={{ alignSelf: 'stretch', gap: 10 }}>
            <Btn label="Oui, c’est cela" icon="checkmark" onPress={() => accept(mood)} />
            <OutlineBtn label="Non, je choisis moi-même" onPress={goBack} />
          </View>
        </Card>
      );
    }
    if (step.name === 'error') {
      return (
        <Message icon="alert-circle-outline" title="Le scan n’a pas fonctionné" text={step.message}>
          <Btn label="Réessayer" icon="refresh-outline" onPress={() => setStep({ name: 'camera' })} />
          <OutlineBtn label="Choisir moi-même" onPress={goBack} />
        </Message>
      );
    }
    const analysing = step.name === 'analysing';
    return (
      <>
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <View style={{ width: 250, height: 330, borderRadius: 125, overflow: 'hidden', borderWidth: 4, borderColor: '#fff', backgroundColor: '#2B2430' }}>
            <CameraView ref={camera} style={{ flex: 1 }} facing="front" mirror onCameraReady={() => setReady(true)} onMountError={() => setStep({ name: 'error', message: 'La caméra ne peut pas être utilisée sur cet appareil.' })} />
          </View>
        </View>
        <T v="h3" center style={{ marginTop: 16 }} accessibilityLiveRegion="polite">
          {analysing ? 'Lecture de votre expression…' : 'Placez votre visage dans l’ovale'}
        </T>
        <T center style={{ marginTop: 4, marginBottom: 18 }}>Restez face à la lumière, sans lunettes de soleil.</T>
        <Btn label={analysing ? 'Un instant…' : 'Scanner'} icon="scan-outline" onPress={scan} loading={analysing} disabled={!ready} />
        <OutlineBtn label="Choisir moi-même" onPress={goBack} style={{ marginTop: 10 }} />
      </>
    );
  };

  return (
    <Screen section="humeur" speak="Scanner mon visage pour proposer une humeur.">
      <Header title="Scan du visage" fallback="/humeur" />
      {body()}
    </Screen>
  );
}
