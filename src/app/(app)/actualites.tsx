import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { NEWS_SOURCE_KEYS, NEWS_SOURCES, type NewsItem, type NewsSourceKey, sinceLabel } from '../../features/news/parse';
import { loadNews, useNews } from '../../features/news/store';
import { frLong, frTime, nowHHMM, todayISO } from '../../lib';
import { C } from '../../theme';
import { Btn, Card, CircleBtn, Empty, Header, Hero, Icon, OutlineBtn, Screen, T, tap, useColors, useDialog, usePalette } from '../../ui';

type Filter = 'toutes' | NewsSourceKey;
const FILTERS: { key: Filter; label: string; short: string }[] = [
  { key: 'toutes', label: 'Toutes les sources', short: 'Toutes' },
  ...NEWS_SOURCE_KEYS.map((key) => ({ key, label: NEWS_SOURCES[key].label, short: NEWS_SOURCES[key].short })),
];

/** Nombre de titres lus à voix haute. */
const SPOKEN_TITLES = 5;

/** Choix de la source : celle qui est retenue est remplie de la couleur de la page. */
function FilterChoice({ label, short, selected, onPress }: { label: string; short: string; selected: boolean; onPress: () => void }) {
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
      accessibilityLabel={label}
      style={({ pressed }) => [
        { minHeight: 50, paddingHorizontal: 8, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flex: 1 },
        { backgroundColor: selected ? palette.btn[1] : C.ivory, borderColor: selected ? C.gold : colors.fieldBorder },
        pressed && { opacity: 0.7 },
      ]}>
      <T v="bodyBold" c={selected ? '#fff' : colors.title} style={{ fontSize: 16.5 }} numberOfLines={1}>{short}</T>
    </Pressable>
  );
}

/** Un titre : sa source, son ancienneté, puis le titre et quelques lignes de résumé. */
function NewsCard({ item, now, onOpen }: { item: NewsItem; now: number; onOpen: (item: NewsItem) => void }) {
  const palette = usePalette();
  const colors = useColors();
  const source = NEWS_SOURCES[item.source].label;
  const since = sinceLabel(item.time, now);
  return (
    <Card pad={0}>
      <Pressable
        onPress={() => onOpen(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${source}${since ? `, ${since}` : ''}. Ouvrir l’article.`}
        style={({ pressed }) => [{ padding: 16 }, pressed && { opacity: 0.6 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <View style={{ backgroundColor: palette.soft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }}>
            <T v="small" c={palette.ink} style={{ fontSize: 14.5 }}>{source}</T>
          </View>
          {!!since && <T v="small" c={colors.muted} style={{ fontSize: 14.5 }}>{since}</T>}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <T v="h3" numberOfLines={4}>{item.title}</T>
            {!!item.summary && <T numberOfLines={3} style={{ marginTop: 6 }}>{item.summary}</T>}
          </View>
          <Icon name="chevron-forward" size={24} color={palette.ink} />
        </View>
      </Pressable>
    </Card>
  );
}

export default function Actualites() {
  const router = useRouter();
  const dialog = useDialog();
  const palette = usePalette('petrol');
  const news = useNews();
  const [filter, setFilter] = useState<Filter>('toutes');
  const [speaking, setSpeaking] = useState(false);
  // L'heure de référence est prise à l'ouverture de l'écran, pas à chaque affichage.
  const [now, setNow] = useState(() => Date.now());

  // À chaque visite : on recharge si les titres ont plus de vingt minutes, et on coupe la lecture en partant.
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      loadNews();
      return () => {
        Speech.stop();
        setSpeaking(false);
      };
    }, []),
  );

  const shown = filter === 'toutes' ? news.items : news.items.filter((item) => item.source === filter);
  const loading = news.status === 'loading';
  const updated = news.updatedAt ? `${new Date(news.updatedAt).toDateString() === new Date(now).toDateString() ? 'aujourd’hui' : 'un autre jour'} à ${frTime(nowHHMM(new Date(news.updatedAt)))}` : '';

  const openArticle = (item: NewsItem) => router.push({ pathname: '/navigateur', params: { actu: item.id } } as never);

  const listen = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    const titles = shown.slice(0, SPOKEN_TITLES);
    if (!titles.length) return;
    setSpeaking(true);
    const text = `Voici les titres. ${titles.map((item, index) => `${index + 1}. ${item.title}.`).join(' ')}`;
    Speech.speak(text, { language: 'fr-FR', rate: 0.92, onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };

  const help = () =>
    dialog.alert(
      'Aide',
      'Les titres viennent de franceinfo et de Yahoo Actualités. Touchez un titre pour lire l’article sur le site du journal, dans le navigateur privé de LIORA. « Écouter les titres » lit les cinq premiers à voix haute. Les actualités ont besoin d’une connexion à Internet.',
    );

  return (
    <Screen section="actualites" speak={`Actualités. ${shown.length ? `${shown.length} titres.` : ''}`}>
      <Header title="Actualités" right={<CircleBtn icon="help-circle-outline" label="Aide" onPress={help} />} />
      <Hero title="Les actualités" subtitle={frLong(todayISO())} />

      <View accessibilityRole="radiogroup" accessibilityLabel="Source des actualités" style={{ flexDirection: 'row', gap: 8 }}>
        {FILTERS.map((item) => <FilterChoice key={item.key} label={item.label} short={item.short} selected={filter === item.key} onPress={() => setFilter(item.key)} />)}
      </View>

      <View style={{ marginTop: 12 }}>
        <Btn label={speaking ? 'Arrêter la lecture' : 'Écouter les titres'} icon={speaking ? 'stop' : 'volume-high'} onPress={listen} />
      </View>

      <View style={{ minHeight: 54, marginTop: 10, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {loading && <ActivityIndicator color={palette.ink} />}
        <T v="small" style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {loading ? 'Chargement des actualités…' : updated ? `Mis à jour ${updated}` : ''}
        </T>
        <OutlineBtn small label="Actualiser" icon="refresh" onPress={() => loadNews(true)} />
      </View>

      {!loading && news.failed.length > 0 && news.items.length > 0 && (
        <Card pad={14} style={{ marginBottom: 12, borderColor: C.goldSoft }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="cloud-offline-outline" size={26} color={palette.ink} />
            <T style={{ flex: 1 }}>
              {news.failed.length === NEWS_SOURCE_KEYS.length
                ? 'Pas de connexion pour le moment : voici les derniers titres reçus.'
                : `${news.failed.map((key) => NEWS_SOURCES[key].label).join(' et ')} ne répond pas pour le moment.`}
            </T>
          </View>
        </Card>
      )}

      <View style={{ gap: 12 }}>
        {shown.map((item) => <NewsCard key={item.id} item={item} now={now} onOpen={openArticle} />)}
        {!shown.length && !loading && (
          <View style={{ gap: 12 }}>
            <Empty
              icon={news.status === 'error' ? 'cloud-offline-outline' : 'newspaper-outline'}
              text={news.status === 'error' ? 'Les actualités ne sont pas disponibles. Vérifiez votre connexion à Internet, puis réessayez.' : 'Aucun titre à afficher pour le moment.'}
            />
            <Btn label="Réessayer" icon="refresh" onPress={() => loadNews(true)} />
          </View>
        )}
      </View>

      {shown.length > 0 && (
        <T v="small" center style={{ marginTop: 16 }}>
          Les articles appartiennent à leurs éditeurs. LIORA n’affiche que les titres et renvoie vers leur site.
        </T>
      )}
    </Screen>
  );
}
