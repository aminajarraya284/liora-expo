import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Equalizer } from '../../features/radio/Equalizer';
import { type RadioStatus, useRadio } from '../../features/radio/RadioProvider';
import { type Station, STATIONS } from '../../features/radio/stations';
import { C, shadow, TINTS } from '../../theme';
import { Card, CircleBtn, Header, Icon, Screen, SectionTitle, T, useColors, useDialog, usePalette } from '../../ui';

const STATUS_TEXT: Record<RadioStatus, string> = {
  idle: 'Choisissez une station',
  loading: 'Connexion à la station…',
  playing: 'En direct',
  paused: 'En pause',
  error: 'Station momentanément indisponible',
};

function Badge({ station, size = 52 }: { station: Station; size?: number }) {
  const palette = TINTS[station.tint];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.btn[1], alignItems: 'center', justifyContent: 'center' }}>
      <T v="bodyBold" c="#fff" style={{ fontSize: size * 0.26 }} numberOfLines={1}>{station.badge}</T>
    </View>
  );
}

const WOOD = '#8A5226';
const WOOD_DARK = '#6B3E1B';
const CREAM = '#FBF3E2';

/**
 * Le poste de radio : un coffret en bois, un cadran crème qui affiche la
 * station, et un grand bouton Lecture / Pause accompagné de son texte.
 */
function RadioSet({ station, status, onToggle, onStop }: { station: Station | null; status: RadioStatus; onToggle: () => void; onStop: () => void }) {
  const active = status === 'playing' || status === 'loading';
  return (
    <View style={[{ backgroundColor: WOOD, borderRadius: 28, padding: 14, borderWidth: 2, borderColor: WOOD_DARK }, shadow(0.3)]}>
      <View style={{ backgroundColor: CREAM, borderRadius: 18, borderWidth: 2, borderColor: C.gold, paddingVertical: 14, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T v="small" c={WOOD_DARK} style={{ letterSpacing: 1 }}>STATION</T>
            <T v="h2" c={WOOD_DARK} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{station?.name ?? 'Aucune station'}</T>
            <T c={WOOD_DARK} accessibilityLiveRegion="polite">{STATUS_TEXT[status]}</T>
          </View>
          {status === 'loading' ? <ActivityIndicator color={WOOD_DARK} /> : <Equalizer playing={status === 'playing'} color={WOOD} />}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 14 }}>
        {/* Haut-parleur : simple décor */}
        <View accessible={false} style={{ flex: 1, gap: 6 }}>
          {[0, 1, 2, 3].map((line) => <View key={line} style={{ height: 4, borderRadius: 2, backgroundColor: WOOD_DARK }} />)}
        </View>
        <Pressable
          onPress={onToggle}
          disabled={!station}
          accessibilityRole="button"
          accessibilityLabel={active ? 'Pause' : 'Lecture'}
          accessibilityState={{ disabled: !station }}
          style={({ pressed }) => [{ alignItems: 'center', opacity: !station ? 0.55 : pressed ? 0.8 : 1 }]}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: CREAM, borderWidth: 3, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={active ? 'pause' : 'play'} size={40} color={WOOD_DARK} />
          </View>
          <T v="bodyBold" c={CREAM} style={{ marginTop: 6 }}>{active ? 'Pause' : 'Lecture'}</T>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {!!station && (
            <Pressable onPress={onStop} accessibilityRole="button" accessibilityLabel="Arrêter" style={({ pressed }) => [{ alignItems: 'center', minWidth: 64, opacity: pressed ? 0.7 : 1 }]}>
              <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: CREAM, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="stop" size={22} color={CREAM} />
              </View>
              <T v="small" c={CREAM} style={{ marginTop: 6 }}>Arrêter</T>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export default function Radio() {
  const radio = useRadio();
  const dialog = useDialog();
  const colors = useColors();
  const palette = usePalette('copper');
  const { station, status } = radio;
  const active = status === 'playing' || status === 'loading';

  const help = () => dialog.alert('Aide', 'Touchez une station pour l’écouter en direct. Le grand bouton rond met en pause ou relance la lecture. La radio continue pendant que vous utilisez le reste de l’application. Elle a besoin d’une connexion à Internet.');

  return (
    <Screen section="radio" speak={station ? `Radio. ${station.name}. ${STATUS_TEXT[status]}.` : 'Radio. Vos stations en direct.'}>
      <Header title="Radio" right={<CircleBtn icon="help-circle-outline" label="Aide" onPress={help} />} />
      <RadioSet station={station} status={status} onToggle={radio.toggle} onStop={radio.stop} />

      <View>
        <SectionTitle>Choisir une station</SectionTitle>
        <View style={{ gap: 10 }}>
          {STATIONS.map((item) => {
            const current = station?.id === item.id;
            return (
              <Card key={item.id} pad={12} style={current ? { borderColor: palette.ink } : undefined}>
                <Pressable
                  onPress={() => (current && active ? radio.toggle() : radio.play(item))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current }}
                  accessibilityLabel={`${item.name}. ${item.tagline}${current && active ? '. En cours d’écoute' : ''}`}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14 }, pressed && { opacity: 0.6 }]}>
                  <Badge station={item} />
                  <View style={{ flex: 1 }}>
                    <T v="title">{item.name}</T>
                    <T v="small">{item.tagline}</T>
                  </View>
                  <Icon name={current && active ? 'pause-circle' : 'play-circle'} size={40} color={current ? palette.ink : colors.muted} />
                </Pressable>
              </Card>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}
