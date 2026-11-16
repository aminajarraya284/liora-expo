import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useCallback, useMemo } from 'react';
import { Image, type ImageSourcePropType, Pressable, ScrollView, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SECTIONS, type SectionKey, type TabGroup, TABS } from '../sections';
import { sectionPhoto } from '../photos';
import { useStore } from '../state/store';
import { TAB_ICONS } from '../tab-icons';
import { C, F, shadow, type Tint, TINTS } from '../theme';
import { Icon, IconTile, SectionIcon } from './icons';
import { Appear, Pop, tap } from './motion';
import { PhotoBanner, usePhotosEnabled } from './photo-banner';
import { T, useColors } from './text';
import { SectionContext, usePalette, useSection } from './tint';

/** Lit le texte à voix haute à l'ouverture de l'écran si « Lecture vocale » est activée. */
export function useSpeak(text?: string) {
  const { settings } = useStore();
  useFocusEffect(
    useCallback(() => {
      if (!settings.speech || !text) return;
      Speech.stop();
      Speech.speak(text, { language: 'fr-FR', rate: 0.95 });
      return () => {
        Speech.stop();
      };
    }, [settings.speech, text]),
  );
}

/** Retour à l'écran précédent, ou à l'accueil si l'écran a été ouvert directement. */
export function useBack(fallback = '/accueil') {
  const router = useRouter();
  return useCallback(() => (router.canGoBack() ? router.back() : router.replace(fallback as never)), [router, fallback]);
}

function TabBar({ active }: { active?: SectionKey }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  return (
    <View style={[st.tabbar, { paddingBottom: Math.max(insets.bottom, 10), borderTopColor: colors.line }]} accessibilityRole="tablist">
      {TABS.map((key) => {
        const section = SECTIONS[key];
        // Chaque onglet a sa propre couleur, qu'il soit sélectionné ou non.
        const palette = TINTS[section.tint];
        const on = key === active;
        const picture = TAB_ICONS[key];
        const open = () => {
          if (on) return;
          tap();
          // L'accueil existe déjà sous les autres écrans : on y revient au lieu d'en empiler un second.
          if (key === 'accueil') router.dismissTo('/accueil');
          else router.replace(section.href as never);
        };
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={section.label}
            onPress={open}
            style={[st.tab, on && { backgroundColor: palette.soft, borderColor: palette.btn[1] }]}>
            {on && <View style={[st.tabMark, { backgroundColor: palette.btn[1] }]} />}
            {picture ? (
              on ? (
                <Pop trigger={key}><Image source={picture} style={{ width: 38, height: 38 }} resizeMode="contain" accessible={false} /></Pop>
              ) : (
                <Image source={picture} style={{ width: 34, height: 34 }} resizeMode="contain" accessible={false} />
              )
            ) : (
              <View style={[st.tabIcon, { backgroundColor: on ? palette.btn[1] : palette.soft }]}>
                <Icon name={section.iconOn} size={20} color={on ? '#fff' : palette.ink} />
              </View>
            )}
            <T v="small" c={on ? palette.ink : colors.text} style={{ fontFamily: on ? F.bold : F.semi }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {section.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Cadre commun à tous les écrans : fond dans la couleur de la rubrique,
 * contenu défilant dont les blocs apparaissent l'un après l'autre,
 * bouton principal fixe (`footer`) et barre d'onglets.
 */
export function Screen({
  children, section, tint, tab, speak, footer, scroll = true, voice = true,
}: {
  children: React.ReactNode;
  /** Rubrique affichée : donne la couleur de la page et l'onglet actif. La barre du bas s'affiche sur toutes les rubriques. */
  section?: SectionKey;
  /** Couleur de la page lorsqu'elle n'appartient à aucune rubrique (écrans de connexion). */
  tint?: Tint;
  tab?: TabGroup;
  /** Phrase lue à l'ouverture lorsque la lecture vocale est activée. */
  speak?: string;
  footer?: React.ReactNode;
  scroll?: boolean;
  /** Affiche le bouton de l'assistant vocal. À retirer sur un écran qui demande toute l'attention, comme une séance. */
  voice?: boolean;
}) {
  const insets = useSafeAreaInsets();
  useSpeak(speak);
  const pageTint: Tint = tint ?? (section ? SECTIONS[section].tint : 'bordeaux');
  const context = useMemo(() => ({ tint: pageTint, section }), [pageTint, section]);
  const bar = !!tab || (!!section && section !== 'assistant');
  const fab = voice && !!section && section !== 'assistant';
  const padding = { paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: bar || footer ? (fab ? 84 : 16) : insets.bottom + 20 };
  return (
    <SectionContext.Provider value={context}>
      <LinearGradient colors={TINTS[pageTint].wash} style={{ flex: 1 }}>
        <View style={st.frame}>
          {scroll ? (
            <ScrollView contentContainerStyle={padding} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {React.Children.toArray(children).map((child, index) => (
                <Appear key={React.isValidElement(child) && child.key != null ? child.key : index} index={index}>
                  {child}
                </Appear>
              ))}
            </ScrollView>
          ) : (
            <View style={[padding, { flex: 1 }]}>{children}</View>
          )}
          {!!footer && <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: bar ? 10 : insets.bottom + 12 }}>{footer}</View>}
          {bar && <TabBar active={section} />}
          {fab && <VoiceFab bottom={(bar ? 100 : insets.bottom + 16) + (footer ? 78 : 0)} />}
        </View>
      </LinearGradient>
    </SectionContext.Provider>
  );
}

/**
 * Assistant vocal, toujours à portée de main : un petit bouton rond, discret,
 * en bas à droite de chaque écran. Il ouvre la conversation ; un appui long
 * lit à voix haute ce que fait la page.
 */
function VoiceFab({ bottom }: { bottom: number }) {
  const router = useRouter();
  const { settings } = useStore();
  const { section } = useSection();
  const palette = usePalette();
  const hint = section ? `${SECTIONS[section].label}. ${SECTIONS[section].hint}.` : '';
  return (
    <Pressable
      onPress={() => {
        tap();
        router.push('/assistant');
      }}
      onLongPress={() => {
        Speech.stop();
        Speech.speak(`${hint} Je vous écoute : touchez pour me parler.`, { language: 'fr-FR', rate: 0.95 });
      }}
      accessibilityRole="button"
      accessibilityLabel="Parler à LIORA"
      accessibilityHint="Ouvre l’assistant. Appui long : lecture de la page."
      hitSlop={8}
      style={({ pressed }) => [st.fab, { bottom, backgroundColor: palette.btn[1], opacity: pressed ? 0.75 : settings.simple ? 1 : 0.92 }, shadow(0.3)]}>
      <Icon name="mic" size={24} color="#FFFFFF" />
    </Pressable>
  );
}

export function CircleBtn({ icon, onPress, label }: { icon: string; onPress?: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [st.circleBtn, shadow(0.12), pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={22} color={C.title} />
    </Pressable>
  );
}

/**
 * Barre du haut, dans la couleur de la rubrique : un bouton « Retour » écrit
 * en toutes lettres, le titre de la page et, au besoin, un bouton d'action.
 */
export function Header({ title, right, back = true, fallback, left }: { title?: string; right?: React.ReactNode; back?: boolean; fallback?: string; left?: React.ReactNode }) {
  const goBack = useBack(fallback);
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  return (
    <View style={[st.header, { backgroundColor: palette.btn[1], marginTop: -(insets.top + 8), paddingTop: insets.top + 10 }]}>
      {left ?? (back ? (
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={6} style={({ pressed }) => [st.backBtn, pressed && { opacity: 0.7 }]}>
          <Icon name="chevron-back" size={22} color={palette.ink} />
          <T v="bodyBold" c={palette.ink}>Retour</T>
        </Pressable>
      ) : null)}
      <View style={{ flex: 1, paddingHorizontal: 8 }}>
        {/* Taille fixe : le titre reste entier même avec « Grand texte ». */}
        {!!title && <T v="h2" c="#FFFFFF" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 22, lineHeight: 30 }} accessibilityRole="header">{title}</T>}
      </View>
      {right}
    </View>
  );
}

/**
 * Présentation de la page. Si la rubrique a une photo, elle s'affiche en
 * bandeau avec le titre ; sinon (ou en mode simplifié / contraste renforcé),
 * une grande icône dans la couleur de la rubrique accompagne le titre.
 */
export function Hero({
  icon, tint, title, subtitle, center, photo,
}: {
  icon?: string; tint?: Tint; title: string; subtitle: string; center?: boolean;
  /** Photo du bandeau. Par défaut, celle de la rubrique. */
  photo?: ImageSourcePropType;
}) {
  const { section } = useSection();
  const photosEnabled = usePhotosEnabled();
  const glyph = icon ?? (section ? SECTIONS[section].icon : 'ellipse-outline');
  const banner = photosEnabled ? (photo ?? sectionPhoto(section)) : undefined;
  if (banner) return <PhotoBanner photo={banner} title={title} subtitle={subtitle} icon={glyph} tint={tint} />;
  // Sans icône imposée, la rubrique montre son illustration en relief.
  const art = !icon && !tint && section ? section : undefined;
  if (center) {
    return (
      <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 22 }}>
        {art ? <SectionIcon section={art} size={88} /> : <IconTile icon={glyph} tint={tint} size={84} radius={42} />}
        <T v="h1" style={{ marginTop: 10 }}>{title}</T>
        <T center style={{ marginTop: 4 }}>{subtitle}</T>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6, marginBottom: 18, minHeight: 86 }}>
      {art ? <SectionIcon section={art} size={80} /> : <IconTile icon={glyph} tint={tint} size={76} />}
      <View style={{ flex: 1 }}>
        <T v="h1">{title}</T>
        <T style={{ marginTop: 2 }}>{subtitle}</T>
      </View>
    </View>
  );
}

export function Card({ children, style, pad = 18 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: number }) {
  const colors = useColors();
  return <View style={[st.card, shadow(0.08), { padding: pad, backgroundColor: colors.card, borderColor: colors.cardBorder }, style]}>{children}</View>;
}

export function Divider() {
  const colors = useColors();
  return <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 2 }} />;
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={st.sectionTitle}>
      <T v="h3" accessibilityRole="header">{children}</T>
      {right}
    </View>
  );
}

/** Titre d'une carte, précédé d'une icône dans la couleur de la page. */
export function CardTitle({ icon, children, right }: { icon: string; children: string; right?: React.ReactNode }) {
  const palette = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <Icon name={icon} size={28} color={palette.ink} />
      <T v="h3" style={{ flex: 1, fontSize: 21 }} accessibilityRole="header">{children}</T>
      {right}
    </View>
  );
}

const st = StyleSheet.create({
  frame: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  tabbar: {
    flexDirection: 'row', paddingTop: 8, paddingHorizontal: 8, gap: 4, backgroundColor: C.ivory,
    borderTopWidth: 1,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderRadius: 18, gap: 2, minHeight: 68, borderWidth: 1.5, borderColor: 'transparent' },
  tabIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 48, marginBottom: 16, marginHorizontal: -20, paddingHorizontal: 12, paddingBottom: 12, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, borderBottomWidth: 3, borderBottomColor: C.gold },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 48, paddingLeft: 8, paddingRight: 16, borderRadius: 24, backgroundColor: C.ivory },
  tabMark: { position: 'absolute', top: 0, width: 28, height: 3, borderRadius: 2 },
  circleBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.ivory, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 20, borderWidth: 1 },
  fab: { position: 'absolute', right: 14, width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: C.goldSoft, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 10, paddingHorizontal: 4 },
});
