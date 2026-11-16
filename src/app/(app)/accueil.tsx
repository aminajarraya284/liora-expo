import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { moodOfToday, withMood } from '../../features/mood/log';
import { MoodFace } from '../../features/mood/MoodFace';
import { MOOD_KEYS, type MoodKey, MOODS } from '../../features/mood/moods';
import { NEWS_SOURCES } from '../../features/news/parse';
import { loadNews, useNews } from '../../features/news/store';
import { Equalizer } from '../../features/radio/Equalizer';
import { useRadio } from '../../features/radio/RadioProvider';
import { frLong, frTime, nowHHMM, todayISO, uid } from '../../lib';
import { PHOTOS } from '../../photos';
import { HOME_GROUPS, SECTIONS, type SectionKey } from '../../sections';
import { useStore } from '../../store';
import { TINTS } from '../../theme';
import { Card, CircleBtn, Divider, Icon, IconTile, Logo, MenuBtn, PhotoBanner, PressableScale, Row, Screen, SectionIcon, SectionTitle, SosBtn, T, tap, useColors, usePhotosEnabled } from '../../ui';

/** Humeur du jour : un geste pour la noter, ou un rappel de ce qui a été noté. */
function MoodCard({ today, onPick, onOpen }: { today?: MoodKey; onPick: (mood: MoodKey) => void; onOpen: () => void }) {
  if (today) {
    return (
      <Card pad={10} style={{ marginBottom: 12, paddingVertical: 4 }}>
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Humeur du jour : ${MOODS[today].label}. Ouvrir le suivi de l’humeur.`} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 }, pressed && { opacity: 0.6 }]}>
          <MoodFace mood={today} size={48} />
          <View style={{ flex: 1 }}>
            <T v="title">Mon humeur du jour</T>
            <T v="small">{MOODS[today].label}</T>
          </View>
          <Icon name="chevron-forward" size={22} color={TINTS.amber.ink} />
        </Pressable>
      </Card>
    );
  }
  return (
    <Card style={{ marginBottom: 12 }}>
      <T v="title" style={{ marginBottom: 10 }}>Comment vous sentez-vous aujourd’hui ?</T>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {MOOD_KEYS.map((mood, index) => (
          <PressableScale key={mood} onPress={() => onPick(mood)} accessibilityRole="button" accessibilityLabel={MOODS[mood].label} scaleTo={0.88} hitSlop={4}>
            <MoodFace mood={mood} size={46} />
          </PressableScale>
        ))}
      </View>
    </Card>
  );
}

/** Rappel de la radio en cours, avec lecture / pause sans quitter l'accueil. */
function RadioCard({ onOpen }: { onOpen: () => void }) {
  const radio = useRadio();
  const palette = TINTS.copper;
  if (!radio.station) return null;
  const playing = radio.status === 'playing';
  const active = playing || radio.status === 'loading';
  return (
    <Card pad={10} style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Radio : ${radio.station.name}. Ouvrir la radio.`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile icon="radio-outline" tint="copper" size={46} />
        <View style={{ flex: 1 }}>
          <T v="title" numberOfLines={1}>{radio.station.name}</T>
          <T v="small">{playing ? 'En direct' : radio.status === 'loading' ? 'Connexion…' : radio.status === 'error' ? 'Station indisponible' : 'En pause'}</T>
        </View>
        <Equalizer playing={playing} color={palette.ink} />
      </Pressable>
      <CircleBtn icon={active ? 'pause' : 'play'} label={active ? 'Mettre la radio en pause' : 'Reprendre la radio'} onPress={radio.toggle} />
      <CircleBtn icon="close" label="Arrêter la radio" onPress={radio.stop} />
    </Card>
  );
}

function SectionTile({ section, wide, onPress }: { section: SectionKey; wide: boolean; onPress: () => void }) {
  const colors = useColors();
  const { label, hint } = SECTIONS[section];
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}. ${hint}`} style={{ flexBasis: wide ? '100%' : '47%', flexGrow: 1 }}>
      {wide ? (
        <Card pad={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <SectionIcon section={section} size={58} />
          <View style={{ flex: 1 }}>
            <T v="h3">{label}</T>
            <T v="small">{hint}</T>
          </View>
          <Icon name="chevron-forward" size={22} color={colors.title} />
        </Card>
      ) : (
        <Card pad={12} style={{ alignItems: 'center', gap: 8, paddingVertical: 16 }}>
          <SectionIcon section={section} size={66} />
          <T v="title" numberOfLines={1}>{label}</T>
        </Card>
      )}
    </PressableScale>
  );
}

export default function Accueil() {
  const { data, update, settings } = useStore();
  const router = useRouter();
  const colors = useColors();
  const photosEnabled = usePhotosEnabled();
  const today = todayISO();
  const now = nowHHMM();
  const open = (href: string) => router.push(href as never);

  const pending = data.treatments
    .flatMap((t) => t.times.map((time) => ({ key: `${t.id}@${time}`, time, name: t.name, dose: t.dose })))
    .filter((dose) => !data.day.taken[dose.key])
    .sort((a, b) => a.time.localeCompare(b.time));
  const nextDose = pending.find((dose) => dose.time >= now) ?? pending[0];
  const nextVisit = [...data.appointments].filter((a) => a.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];

  // Titre du jour : chargé en arrière-plan, affiché seulement s'il est disponible.
  const headline = useNews().items[0];
  useEffect(() => {
    loadNews();
  }, []);

  const hello = `Bonjour ${data.profile.firstName}`.trim();

  const pickMood = (mood: MoodKey) => {
    tap();
    update((d) => withMood(d, mood, 'manuel', uid()));
    open('/humeur');
  };

  return (
    <Screen section="accueil" tab="main" speak={`${hello}. Nous sommes le ${frLong(today)}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MenuBtn />
          <Logo size={24} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <SosBtn />
          <CircleBtn icon="notifications-outline" label="Notifications" onPress={() => open('/reglages/notifications')} />
        </View>
      </View>

      {photosEnabled ? (
        <PhotoBanner photo={PHOTOS.accueil} title={hello} subtitle={frLong(today)} height={160} />
      ) : (
        <View style={{ marginTop: 10, marginBottom: 14 }}>
          <T v="h1" style={{ fontSize: 32 }} accessibilityRole="header">{hello}</T>
          <T style={{ fontSize: 17 }}>{frLong(today)}</T>
        </View>
      )}

      <MoodCard today={moodOfToday(data)?.mood} onPick={pickMood} onOpen={() => open('/humeur')} />
      <RadioCard onOpen={() => open('/radio')} />

      <Card pad={10} style={{ paddingVertical: 4 }}>
        <Row
          icon={SECTIONS.traitements.icon}
          tint="green"
          title={nextDose ? `${nextDose.name} à ${frTime(nextDose.time)}` : 'Traitements du jour'}
          subtitle={nextDose ? nextDose.dose || 'Prochaine prise' : data.treatments.length ? 'Toutes les prises sont faites' : 'Aucun traitement enregistré'}
          onPress={() => open('/traitements')}
        />
        <Divider />
        <Row
          icon={SECTIONS.agenda.icon}
          tint="sky"
          title={nextVisit ? nextVisit.title : 'Agenda'}
          subtitle={nextVisit ? `${nextVisit.date === today ? 'Aujourd’hui' : frLong(nextVisit.date)} à ${frTime(nextVisit.time)}` : 'Aucun rendez-vous à venir'}
          onPress={() => open('/agenda')}
        />
        {!!headline && (
          <>
            <Divider />
            <Row icon={SECTIONS.actualites.icon} tint="petrol" title="À la une" subtitle={`${headline.title} (${NEWS_SOURCES[headline.source].label})`} onPress={() => open('/actualites')} />
          </>
        )}
      </Card>

      {HOME_GROUPS.map((group) => (
        <View key={group.title}>
          <SectionTitle>{group.title}</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {group.sections.map((section, index) => {
              // En mode simplifié, une rubrique par ligne. Sinon deux par ligne, la dernière occupant la ligne si elle est seule.
              const alone = group.sections.length % 2 === 1 && index === group.sections.length - 1;
              return <SectionTile key={section} section={section} wide={settings.simple || alone} onPress={() => open(SECTIONS[section].href)} />;
            })}
          </View>
        </View>
      ))}

      <View>
        <SectionTitle>Réglages</SectionTitle>
        <Card pad={10} style={{ paddingVertical: 4 }}>
          <Row icon={SECTIONS.parametres.icon} tint="blue" title="Paramètres" subtitle={SECTIONS.parametres.hint} onPress={() => open('/parametres')} />
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <Row icon={SECTIONS.accessibilite.icon} tint="teal" title="Accessibilité" subtitle={SECTIONS.accessibilite.hint} onPress={() => open('/accessibilite')} />
        </Card>
      </View>
    </Screen>
  );
}
