import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LIMITS } from '../../../shared/assistant-contract';
import { contextLine, type Message, runTurn, type TurnEnd } from '../../features/assistant/agent';
import { assistantConfigured, RELAY_MESSAGES, RelayError, sendConversation } from '../../features/assistant/relay';
import { createToolRunner } from '../../features/assistant/tools';
import { nowHHMM, openLink, telUrl, todayISO, uid } from '../../lib';
import { useStore } from '../../store';
import { C, F } from '../../theme';
import { Btn, Card, CircleBtn, Header, Icon, NATIVE_DRIVER, OutlineBtn, PressableScale, Screen, T, useBack, useColors, useDialog, usePalette } from '../../ui';
import { useAnimatedValue } from '../../components/motion';

type ChatItem =
  | { id: string; kind: 'user' | 'assistant'; text: string }
  | { id: string; kind: 'action'; text: string; ok: boolean }
  | { id: string; kind: 'notice'; text: string };

/** Au-delà, on repart sur une nouvelle conversation pour rester rapide. */
const LONG_CONVERSATION = 60;

const SUGGESTIONS = ['Quels sont mes rendez-vous ?', 'Ai-je pris mes médicaments ?', 'Ajoute un verre d’eau', 'Ouvre la radio'];

const END_NOTICES: Record<Exclude<TurnEnd, 'done'>, string> = {
  refused: 'Je ne peux pas répondre à cette demande. Essayez de la formuler autrement.',
  truncated: 'Ma réponse a été interrompue. Pouvez-vous reposer votre question ?',
  too_long: 'Cette demande m’a demandé trop d’étapes. Essayez une demande plus simple.',
};

/** Trois points qui clignotent pendant que l'assistant prépare sa réponse. */
function Typing() {
  const { reduceMotion } = useStore();
  const pulse = useAnimatedValue(0.4);
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0.4, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);
  return (
    <Animated.View style={[st.bubble, st.fromAssistant, { opacity: pulse }]} accessibilityLabel="LIORA écrit" accessibilityLiveRegion="polite">
      <T v="h3">•  •  •</T>
    </Animated.View>
  );
}

function Notice({ icon, title, text, children }: { icon: string; title: string; text: string; children?: React.ReactNode }) {
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

export default function Assistant() {
  const { data, update, settings, setSettings } = useStore();
  const router = useRouter();
  const dialog = useDialog();
  const goBack = useBack();
  const colors = useColors();
  const palette = usePalette('orchid');
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const history = useRef<Message[]>([]);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Copie à jour des données : un outil peut lire ce qu'un outil précédent vient d'écrire, sans attendre l'écran.
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  }, [data]);

  /** Outils de l'assistant, branchés sur les données et la navigation de l'application. */
  const toolRunner = () =>
    createToolRunner({
      getData: () => latest.current,
      update: (change) => {
        latest.current = change(latest.current);
        update(change);
      },
      confirm: (title, message) => dialog.confirm({ title, message, ok: 'Confirmer' }),
      open: (href) => router.push(href as never),
      call: (phone) => openLink(telUrl(phone)),
      newId: uid,
    });

  useEffect(() => () => { Speech.stop(); }, []);

  const add = (item: ChatItem) => setItems((current) => [...current, item]);

  const restart = () => {
    Speech.stop();
    history.current = [];
    setItems([]);
  };

  const send = async (raw: string) => {
    const text = raw.trim().slice(0, LIMITS.maxUserText);
    if (!text || busy) return;
    setDraft('');
    setBusy(true);
    add({ id: uid(), kind: 'user', text });
    try {
      const turn = await runTurn({
        history: history.current,
        context: contextLine(new Date(), todayISO(), nowHHMM(), latest.current.profile.firstName),
        userText: text,
        send: (messages) => sendConversation({ messages }),
        runTool: toolRunner(),
        onAction: (summary, ok) => add({ id: uid(), kind: 'action', text: summary, ok }),
      });
      history.current = turn.messages;
      if (turn.end === 'done') {
        const reply = turn.reply || 'C’est fait.';
        add({ id: uid(), kind: 'assistant', text: reply });
        if (settings.speech) Speech.speak(reply, { language: 'fr-FR', rate: 0.95 });
      } else {
        add({ id: uid(), kind: 'notice', text: END_NOTICES[turn.end] });
      }
      if (history.current.length > LONG_CONVERSATION) {
        history.current = [];
        add({ id: uid(), kind: 'notice', text: 'Cette conversation devient longue : je repars sur une nouvelle conversation.' });
      }
    } catch (error) {
      const kind = error instanceof RelayError ? error.kind : 'unavailable';
      // Une conversation refusée par le serveur ne peut pas être reprise : on repart de zéro.
      if (kind === 'rejected') history.current = [];
      add({ id: uid(), kind: 'notice', text: RELAY_MESSAGES[kind] });
    } finally {
      setBusy(false);
    }
  };

  if (!assistantConfigured) {
    return (
      <Screen section="assistant">
        <Header title="Assistant" />
        <Notice icon="cloud-offline-outline" title="Assistant pas encore connecté" text="L’assistant LIORA a besoin de son service en ligne, qui n’est pas encore relié à cet appareil. Le reste de l’application fonctionne normalement.">
          <Btn label="Retour à l’accueil" icon="home-outline" onPress={goBack} />
        </Notice>
      </Screen>
    );
  }

  if (!settings.assistantConsent) {
    return (
      <Screen section="assistant">
        <Header title="Assistant" />
        <Notice
          icon="sparkles-outline"
          title="Parler à LIORA"
          text="Pour vous répondre, LIORA envoie vos messages à son service d’intelligence artificielle, ainsi que les informations que vous lui demandez de consulter : traitements, rendez-vous, humeur… Jamais vos documents du coffre-fort ni vos numéros de téléphone. Avant toute modification importante, LIORA vous demande votre accord.">
          <Btn label="J’accepte" icon="checkmark" onPress={() => setSettings({ assistantConsent: true })} />
          <OutlineBtn label="Non merci" onPress={goBack} />
        </Notice>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen section="assistant" scroll={false} speak="Assistant LIORA. Posez votre question.">
        <Header title="Assistant" right={items.length > 0 ? <CircleBtn icon="refresh-outline" label="Nouvelle conversation" onPress={restart} /> : undefined} />
        <ScrollView
          ref={scroll}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 12, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {items.length === 0 && (
            <View style={{ alignItems: 'center', marginTop: 12, gap: 8 }}>
              <Icon name="sparkles" size={44} color={palette.ink} />
              <T v="h2" center>Bonjour {data.profile.firstName}</T>
              <T center style={{ marginBottom: 8 }}>Je suis LIORA. Que puis-je faire pour vous ?</T>
              <View style={{ alignSelf: 'stretch', gap: 10 }}>
                {SUGGESTIONS.map((suggestion) => (
                  <OutlineBtn key={suggestion} small label={suggestion} icon="chatbubble-outline" onPress={() => send(suggestion)} />
                ))}
              </View>
            </View>
          )}
          {items.map((item) => {
            if (item.kind === 'user') return <View key={item.id} style={[st.bubble, st.fromUser, { backgroundColor: palette.btn[1] }]}><T c="#fff" style={st.text}>{item.text}</T></View>;
            if (item.kind === 'assistant') return <View key={item.id} style={[st.bubble, st.fromAssistant]}><T style={st.text}>{item.text}</T></View>;
            if (item.kind === 'action') {
              return (
                <View key={item.id} style={[st.action, { backgroundColor: item.ok ? C.okSoft : palette.soft }]}>
                  <Icon name={item.ok ? 'checkmark-circle' : 'alert-circle'} size={20} color={item.ok ? C.ok : C.danger} />
                  <T v="small" style={{ flex: 1, fontFamily: F.semi }}>{item.text}</T>
                </View>
              );
            }
            return <T key={item.id} v="small" center c={colors.muted} style={{ paddingHorizontal: 12 }} accessibilityLiveRegion="polite">{item.text}</T>;
          })}
          {busy && <Typing />}
        </ScrollView>

        <View style={[st.inputBar, { borderColor: colors.fieldBorder }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Écrivez votre message…"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Votre message"
            multiline
            maxLength={LIMITS.maxUserText}
            style={[st.input, { color: colors.text, fontSize: settings.bigText ? 19 : 16.5 }]}
          />
          <PressableScale onPress={() => send(draft)} disabled={busy || !draft.trim()} accessibilityRole="button" accessibilityLabel="Envoyer" accessibilityState={{ disabled: busy || !draft.trim() }} scaleTo={0.9}>
            <View style={[st.send, { backgroundColor: palette.btn[1], opacity: busy || !draft.trim() ? 0.4 : 1 }]}>
              <Icon name="arrow-up" size={24} color="#fff" />
            </View>
          </PressableScale>
        </View>
        <T v="small" center c={colors.muted} style={{ marginTop: 6 }}>LIORA ne remplace pas un médecin. En cas d’urgence, appelez le 15.</T>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  bubble: { maxWidth: '86%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  fromUser: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  fromAssistant: { alignSelf: 'flex-start', backgroundColor: C.ivory, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: C.line },
  text: { fontSize: 16.5, lineHeight: 24 },
  action: { alignSelf: 'flex-start', maxWidth: '92%', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, backgroundColor: '#fff', borderRadius: 26, borderWidth: 1.5, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontFamily: F.reg, maxHeight: 120, minHeight: 40, paddingVertical: 8, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
