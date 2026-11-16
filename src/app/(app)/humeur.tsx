import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { buildMoodAdvice, type MoodActionKey } from '../../features/mood/advice';
import { moodOfToday, moodsByDay, withMood } from '../../features/mood/log';
import { MoodFace } from '../../features/mood/MoodFace';
import { MoodScene } from '../../features/mood/MoodScene';
import { MOOD_KEYS, type MoodKey, MOODS } from '../../features/mood/moods';
import { addDays, dayPart, frDayInitial, frTime, openLink, telUrl, todayISO, uid } from '../../lib';
import { useStore } from '../../store';
import { Btn, Card, CardTitle, CircleBtn, Header, Hero, Icon, OutlineBtn, Pop, PressableScale, Screen, T, tap, useColors, useDialog, usePalette } from '../../ui';

/** Numéro national de prévention du suicide : gratuit, jour et nuit. */
const HELPLINE = '3114';

const WEEK = 7;

export default function Humeur() {
  const { data, update } = useStore();
  const router = useRouter();
  const dialog = useDialog();
  const colors = useColors();
  const palette = usePalette('amber');
  const [choosing, setChoosing] = useState(false);

  const today = todayISO();
  const current = moodOfToday(data);
  const showPicker = choosing || !current;
  const mainContact = data.proches.find((p) => p.primary) ?? data.proches[0];
  const week = moodsByDay(data, Array.from({ length: WEEK }, (_, i) => addDays(today, i - (WEEK - 1))));

  const choose = (mood: MoodKey) => {
    tap();
    update((d) => withMood(d, mood, 'manuel', uid()));
    setChoosing(false);
  };

  /** Au retour du scan, on montre l'humeur validée, et non la grille de choix. */
  const openScan = () => {
    setChoosing(false);
    router.push('/humeur-scan');
  };

  const call = async (phone: string) => {
    if (!(await openLink(telUrl(phone)))) dialog.alert('Appel impossible', `Cet appareil ne peut pas passer d’appel. Composez le ${phone}.`);
  };

  const actions: Record<MoodActionKey, { label: string; icon: string; run: () => void }> = {
    appeler: { label: `Appeler ${mainContact?.name ?? 'un proche'}`, icon: 'call-outline', run: () => (mainContact ? call(mainContact.phone) : router.push('/proches')) },
    respiration: { label: 'Respiration apaisante', icon: 'mc:lungs', run: () => router.push('/seance?type=respiration') },
    sommeil: { label: 'Séance « Sommeil serein »', icon: 'moon-outline', run: () => router.push('/seance?type=sommeil') },
    journal: { label: 'Écrire dans mon journal', icon: 'book-outline', run: () => router.push('/journal') },
    radio: { label: 'Écouter la radio', icon: 'radio-outline', run: () => router.push('/radio') },
    musique: { label: 'Musique relaxante', icon: 'headset-outline', run: () => router.push('/relaxation') },
    assistant: { label: 'Parler à LIORA', icon: 'sparkles-outline', run: () => router.push('/assistant') },
    eau: { label: 'Boire un verre d’eau', icon: 'water-outline', run: () => router.push('/nutrition') },
  };

  const advice = current
    ? buildMoodAdvice(
        current,
        data.moods.filter((entry) => entry.id !== current.id),
        dayPart(),
        data.moods.length + new Date().getDate(),
        !!mainContact,
      )
    : null;

  const help = () => dialog.alert('Aide', 'Choisissez le visage qui correspond à ce que vous ressentez. LIORA vous propose alors un message et quelques idées. Vous pouvez changer d’humeur autant de fois que vous le souhaitez.');

  return (
    <Screen section="humeur" speak={current ? `Humeur. Aujourd’hui, ${MOODS[current.mood].feeling}.` : 'Humeur. Comment vous sentez-vous aujourd’hui ?'}>
      <Header title="Humeur" right={<CircleBtn icon="help-circle-outline" label="Aide" onPress={help} />} />
      <Hero title="Mon humeur" subtitle="Comment vous sentez-vous aujourd’hui ?" />

      {showPicker && (
        <Card>
          <T v="h3" center style={{ marginBottom: 12 }}>Comment vous sentez-vous ?</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
            {MOOD_KEYS.map((mood) => (
              <PressableScale
                key={mood}
                onPress={() => choose(mood)}
                accessibilityRole="button"
                accessibilityLabel={MOODS[mood].label}
                scaleTo={0.94}
                style={{ width: '48.5%' }}
                contentStyle={{ alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 20, backgroundColor: MOODS[mood].card }}>
                <MoodFace mood={mood} size={88} />
                <T v="bodyBold" center c={colors.title}>{MOODS[mood].label}</T>
              </PressableScale>
            ))}
          </View>
          <OutlineBtn label="Scanner mon visage" icon="scan-outline" onPress={openScan} style={{ marginTop: 16 }} />
          {choosing && <OutlineBtn small label="Annuler" onPress={() => setChoosing(false)} style={{ marginTop: 10 }} />}
        </Card>
      )}

      {!showPicker && current && advice && (
        <Card>
          <MoodScene mood={current.mood} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 }}>
            <Pop trigger={current.id}><MoodFace mood={current.mood} size={68} /></Pop>
            <View style={{ flex: 1 }}>
              <T v="h3">Aujourd’hui, {MOODS[current.mood].feeling}</T>
              <T v="small">Noté à {frTime(current.time)}{current.source === 'scan' ? ' • scan du visage' : ''}</T>
            </View>
          </View>
          <View style={{ marginTop: 12, gap: 8 }} accessibilityLiveRegion="polite">
            {!!advice.lead && <T v="bodyBold" c={palette.ink}>{advice.lead}</T>}
            <T style={{ fontSize: 17, lineHeight: 25 }}>{advice.message}</T>
            {!!advice.closing && <T>{advice.closing}</T>}
          </View>
          <View style={{ gap: 10, marginTop: 14 }}>
            {advice.actions.map((key) => (
              <OutlineBtn key={key} small label={actions[key].label} icon={actions[key].icon} onPress={actions[key].run} />
            ))}
          </View>
          {advice.showHelpline && (
            <View style={{ marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: palette.soft, gap: 10 }}>
              <T>Besoin de parler à quelqu’un ? Le {HELPLINE} est gratuit et répond jour et nuit.</T>
              <Btn small label={`Appeler le ${HELPLINE}`} icon="call" onPress={() => call(HELPLINE)} />
            </View>
          )}
          <OutlineBtn small label="Changer mon humeur" icon="create-outline" onPress={() => setChoosing(true)} style={{ marginTop: 14 }} />
        </Card>
      )}

      <Card style={{ marginTop: 14 }}>
        <CardTitle icon="calendar-outline">Mes 7 derniers jours</CardTitle>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {week.map(({ date, entry }) => (
            <View key={date} style={{ alignItems: 'center', gap: 6, flex: 1 }} accessible accessibilityLabel={`${date === today ? 'Aujourd’hui' : frDayInitial(date)} : ${entry ? MOODS[entry.mood].label : 'non renseigné'}`}>
              <T v="small" c={date === today ? palette.ink : colors.muted} style={date === today ? { fontWeight: '700' } : undefined}>{frDayInitial(date)}</T>
              {entry ? (
                <MoodFace mood={entry.mood} size={36} />
              ) : (
                <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="remove" size={14} color={colors.muted} />
                </View>
              )}
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
