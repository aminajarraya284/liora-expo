import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ImageBackground, type ImageSourcePropType, Pressable, View } from 'react-native';
import { AMBIENCE_KEYS, AMBIENCES, type AmbienceKey, BREATHING, dailyIdea, GUIDED, LISTEN_MINUTES, MOVEMENT, MOVEMENT_ADVICE, type Session, type SessionKey, sessionMinutes, SESSIONS } from '../../features/relax/content';
import { useAmbience } from '../../features/relax/useAmbience';
import { mmss, todayISO } from '../../lib';
import { C } from '../../theme';
import { Btn, Card, CircleBtn, Divider, Header, Hero, Icon, PressableScale, Screen, SectionTitle, T, tap, useColors, useDialog, usePalette } from '../../ui';

/** Une séance en ligne : son illustration, son nom, ce qu'elle apporte, sa durée, et un bouton pour commencer. */
function SessionRow({ id, onOpen }: { id: SessionKey; onOpen: (id: SessionKey) => void }) {
  const palette = usePalette();
  const session: Session = SESSIONS[id];
  const minutes = sessionMinutes(session);
  return (
    <Pressable
      onPress={() => onOpen(id)}
      accessibilityRole="button"
      accessibilityLabel={`Commencer ${session.title}, ${minutes} minutes. ${session.summary}`}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 72 }, pressed && { opacity: 0.6 }]}>
      {!!session.art && <Image source={session.art} style={{ width: 58, height: 58 }} resizeMode="contain" accessible={false} />}
      <View style={{ flex: 1 }}>
        <T v="title">{session.title}</T>
        <T v="small">{session.summary}</T>
        <T v="small" c={palette.ink} style={{ marginTop: 2 }}>{minutes} minutes</T>
      </View>
      <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: palette.btn[1], alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="play" size={24} color="#fff" />
      </View>
    </Pressable>
  );
}

/** Liste de séances dans une même carte, séparées par un filet. */
function SessionList({ ids, onOpen }: { ids: SessionKey[]; onOpen: (id: SessionKey) => void }) {
  return (
    <Card pad={14} style={{ paddingVertical: 6 }}>
      {ids.map((id, index) => (
        <View key={id}>
          {index > 0 && <Divider />}
          <SessionRow id={id} onOpen={onOpen} />
        </View>
      ))}
    </Card>
  );
}

/** Une séance guidée : une image, son nom et sa durée. */
function SessionTile({ id, onOpen }: { id: SessionKey; onOpen: (id: SessionKey) => void }) {
  const session: Session = SESSIONS[id];
  const minutes = sessionMinutes(session);
  return (
    <PressableScale
      onPress={() => onOpen(id)}
      accessibilityRole="button"
      accessibilityLabel={`${session.title}, ${minutes} minutes. ${session.summary}`}
      style={{ width: '48%' }}>
      <ImageBackground source={session.image} resizeMode="cover" style={{ height: 168, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end' }}>
        <LinearGradient colors={['rgba(45,30,75,0)', 'rgba(45,30,75,0.88)']} style={{ padding: 12, paddingTop: 44 }}>
          <T v="bodyBold" c="#fff" style={{ fontSize: 17, lineHeight: 22 }}>{session.title}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <Icon name="time-outline" size={16} color="#fff" />
            <T v="small" c="#fff">{minutes} min</T>
          </View>
        </LinearGradient>
      </ImageBackground>
    </PressableScale>
  );
}

/**
 * Choix entre plusieurs possibilités : celle qui est retenue est remplie de la
 * couleur de la page. Avec une illustration, le texte se place dessous.
 */
function Choice({ label, art, selected, onPress, hint }: { label: string; art?: ImageSourcePropType; selected: boolean; onPress: () => void; hint?: string }) {
  const palette = usePalette();
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => [
        { alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 52, paddingHorizontal: 8, paddingVertical: art ? 10 : 0, borderRadius: 18, borderWidth: 2, flexGrow: 1 },
        { backgroundColor: selected ? palette.btn[1] : C.ivory, borderColor: selected ? C.gold : colors.fieldBorder },
        pressed && { opacity: 0.7 },
      ]}>
      {!!art && <Image source={art} style={{ width: 54, height: 54 }} resizeMode="contain" accessible={false} />}
      <T v="bodyBold" center c={selected ? '#fff' : colors.title} style={{ fontSize: 16.5 }}>{label}</T>
    </Pressable>
  );
}

type Mode = 'detente' | 'bouger';
const MODES: { key: Mode; label: string; hint: string; art: ImageSourcePropType }[] = [
  { key: 'detente', label: 'Se détendre', hint: 'Respiration, séances guidées et ambiances sonores', art: require('../../../assets/icons/relaxation.png') },
  { key: 'bouger', label: 'Bouger', hint: 'Gym douce, équilibre et étirements', art: require('../../../assets/icons/relax/force.png') },
];

export default function Relaxation() {
  const router = useRouter();
  const dialog = useDialog();
  const palette = usePalette('purple');
  const { playing, stop, start } = useAmbience();
  const [mode, setMode] = useState<Mode>('detente');
  const [ambience, setAmbience] = useState<AmbienceKey>('pluie');
  const [minutes, setMinutes] = useState<(typeof LISTEN_MINUTES)[number]>(20);
  const [elapsed, setElapsed] = useState(0);
  const seconds = useRef(0);
  const total = minutes * 60;

  // On coupe le son quand on quitte l'écran.
  useFocusEffect(useCallback(() => stop, [stop]));

  // Minuteur : l'ambiance s'arrête d'elle-même à la fin de la durée choisie.
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      seconds.current += 1;
      if (seconds.current >= total) {
        seconds.current = 0;
        stop();
      }
      setElapsed(seconds.current);
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, stop, total]);

  const reset = () => {
    seconds.current = 0;
    setElapsed(0);
  };
  const listen = (key: AmbienceKey) => {
    if (!start(key)) dialog.alert('Lecture impossible', 'Le son ne peut pas être lu sur cet appareil.');
  };
  const toggle = () => (playing ? stop() : listen(ambience));
  const pickAmbience = (key: AmbienceKey) => {
    setAmbience(key);
    if (playing) listen(key);
  };
  const pickMinutes = (value: (typeof LISTEN_MINUTES)[number]) => {
    setMinutes(value);
    reset();
  };
  const pickMode = (next: Mode) => {
    if (next !== 'detente') stop();
    setMode(next);
  };
  const openSession = (type: SessionKey) => router.push({ pathname: '/seance', params: { type } } as never);

  const help = () =>
    dialog.alert(
      'Aide',
      `« Se détendre » réunit la respiration, les séances guidées et les ambiances sonores. « Bouger » propose une gym douce, à faire chez soi. Chaque séance vous guide pas à pas et s’arrête toute seule.\n\n${MOVEMENT_ADVICE}`,
    );

  const remaining = Math.max(0, total - elapsed);

  return (
    <Screen section="relaxation" speak="Relaxation. Se détendre, ou bouger en douceur.">
      <Header title="Relaxation" right={<CircleBtn icon="help-circle-outline" label="Aide" onPress={help} />} />
      <Hero title="Relaxation" subtitle="Détente, calme et bien-être" />

      <View accessibilityRole="radiogroup" accessibilityLabel="Que souhaitez-vous faire ?" style={{ flexDirection: 'row', gap: 10 }}>
        {MODES.map((item) => (
          <View key={item.key} style={{ flex: 1 }}>
            <Choice label={item.label} hint={item.hint} art={item.art} selected={mode === item.key} onPress={() => pickMode(item.key)} />
          </View>
        ))}
      </View>

      {mode === 'detente' ? (
        <View key="detente">
          <Card style={{ borderColor: C.goldSoft, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Icon name="sunny-outline" size={30} color={C.gold} />
              <View style={{ flex: 1 }}>
                <T v="small" c={palette.ink} style={{ letterSpacing: 1 }}>L’IDÉE DU JOUR</T>
                <T v="title" style={{ marginTop: 2 }}>{dailyIdea(todayISO())}</T>
              </View>
            </View>
          </Card>

          <SectionTitle>Respirer</SectionTitle>
          <SessionList ids={BREATHING} onOpen={openSession} />

          <SectionTitle>Séances guidées</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
            {GUIDED.map((id) => <SessionTile key={id} id={id} onOpen={openSession} />)}
          </View>

          <SectionTitle>Ambiances sonores</SectionTitle>
          <Card>
            <T>Choisissez un son et une durée. Il s’arrête tout seul.</T>
            <View accessibilityRole="radiogroup" accessibilityLabel="Ambiance sonore" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {AMBIENCE_KEYS.map((key) => (
                <View key={key} style={{ width: '48%', flexGrow: 1 }}>
                  <Choice label={AMBIENCES[key].label} hint={AMBIENCES[key].hint} art={AMBIENCES[key].art} selected={ambience === key} onPress={() => pickAmbience(key)} />
                </View>
              ))}
            </View>
            <View accessibilityRole="radiogroup" accessibilityLabel="Durée d’écoute" style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {LISTEN_MINUTES.map((value) => (
                <View key={value} style={{ flex: 1 }}>
                  <Choice label={`${value} min`} selected={minutes === value} onPress={() => pickMinutes(value)} />
                </View>
              ))}
            </View>
            <View style={{ marginTop: 14 }}>
              <Btn label={playing ? 'Arrêter' : `Écouter : ${AMBIENCES[ambience].label}`} icon={playing ? 'stop' : 'play'} onPress={toggle} />
            </View>
            {(playing || elapsed > 0) && (
              <T center style={{ marginTop: 10 }} accessibilityLiveRegion="polite" accessibilityLabel={`Temps restant : ${mmss(remaining)}`}>
                {AMBIENCES[ambience].hint} · reste {mmss(remaining)}
              </T>
            )}
          </Card>
        </View>
      ) : (
        <View key="bouger">
          <Card style={{ borderColor: C.goldSoft, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Icon name="shield-checkmark-outline" size={30} color={C.gold} />
              <View style={{ flex: 1 }}>
                <T v="small" c={palette.ink} style={{ letterSpacing: 1 }}>AVANT DE COMMENCER</T>
                <T style={{ marginTop: 2 }}>{MOVEMENT_ADVICE}</T>
              </View>
            </View>
          </Card>

          <View style={{ marginTop: 14 }}>
            <Btn label="S’échauffer d’abord" icon="play" onPress={() => openSession('echauffement')} />
          </View>

          <SectionTitle>Gym douce</SectionTitle>
          <SessionList ids={MOVEMENT} onOpen={openSession} />
        </View>
      )}
    </Screen>
  );
}
