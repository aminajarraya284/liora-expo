import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenCapture from 'expo-screen-capture';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';
import { fmtSize, frShort, todayISO, uid } from '../../lib';
import { authenticateOnDevice } from '../../security/device-auth';
import { clearPreviews, deleteDocument, DOCUMENTS_PERSIST, MAX_DOCUMENT_BYTES, openDocument, storeDocument } from '../../security/vault-files';
import { type Doc, type DocCategory, useStore } from '../../store';
import { C, F, shadow } from '../../theme';
import { Btn, Card, CircleBtn, Empty, type FormField, FormSheet, Header, Hero, Icon, OutlineBtn, Screen, T, useColors, useDialog, usePalette } from '../../ui';

const CATEGORIES: { key: DocCategory; label: string; icon: string }[] = [
  { key: 'ordonnances', label: 'Ordonnances', icon: 'document-text-outline' },
  { key: 'analyses', label: 'Analyses', icon: 'mc:microscope' },
  { key: 'administratif', label: 'Pièces administratives', icon: 'folder-outline' },
];

const DOCUMENT_FIELDS: FormField[] = [
  { key: 'name', label: 'Nom du document', required: true, maxLength: 80 },
  { key: 'category', label: 'Catégorie', type: 'choice', required: true, options: CATEGORIES.map((c) => ({ value: c.key, label: c.label })) },
];

type Picked = { uri: string; name: string; size: number; kind: string };

/** Écran affiché tant que le coffre-fort n'est pas déverrouillé. */
function LockedVault({ onUnlocked }: { onUnlocked: () => void }) {
  const { checkPassword } = useStore();
  const [askPassword, setAskPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const unlock = async () => {
    setBusy(true);
    const result = await authenticateOnDevice('Déverrouiller le coffre-fort');
    setBusy(false);
    if (result === 'ok') onUnlocked();
    // Pas de Face ID ni de code sur l'appareil : on demande le mot de passe du compte.
    else if (result === 'unavailable') setAskPassword(true);
  };

  return (
    <>
      <Card style={{ alignItems: 'center', paddingVertical: 28, marginTop: 8 }}>
        <Icon name="lock-closed" size={56} color={C.title} />
        <T v="h2" center style={{ marginTop: 12 }}>Coffre-fort verrouillé</T>
        <T center style={{ marginTop: 6, marginBottom: 20 }}>Pour protéger vos documents, confirmez que c’est bien vous.</T>
        <Btn label="Déverrouiller" icon="lock-open-outline" onPress={unlock} loading={busy} style={{ alignSelf: 'stretch' }} />
        <OutlineBtn label="Utiliser mon mot de passe" icon="key-outline" onPress={() => setAskPassword(true)} style={{ alignSelf: 'stretch', marginTop: 10 }} />
      </Card>
      <FormSheet
        visible={askPassword}
        title="Déverrouiller le coffre-fort"
        submitLabel="Déverrouiller"
        fields={[{ key: 'password', label: 'Mot de passe de votre compte LIORA', type: 'password', required: true }]}
        onClose={() => setAskPassword(false)}
        onSubmit={async (values) => {
          const result = await checkPassword(values.password);
          if (!result.ok) return result.error;
          setAskPassword(false);
          onUnlocked();
        }}
      />
    </>
  );
}

export default function CoffreFort() {
  const { data, update, getDataKey, encryption } = useStore();
  const dialog = useDialog();
  const colors = useColors();
  const palette = usePalette('indigo');
  const [unlocked, setUnlocked] = useState(false);
  const [category, setCategory] = useState<DocCategory>('ordonnances');
  const [showAll, setShowAll] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [edit, setEdit] = useState<Doc | null>(null);
  /** Vrai pendant qu'une fenêtre du système (sélecteur, visionneuse) est ouverte par le coffre-fort lui-même. */
  const systemSheetOpen = useRef(false);

  const lock = useCallback(() => {
    clearPreviews();
    setUnlocked(false);
    setPicked(null);
    setEdit(null);
  }, []);

  // Le coffre-fort se referme dès que l'on quitte l'application, et les copies déchiffrées sont effacées.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' && !systemSheetOpen.current) lock();
    });
    return () => {
      subscription.remove();
      clearPreviews();
    };
  }, [lock]);

  // Tant que le coffre-fort est ouvert, les captures d'écran sont bloquées.
  useEffect(() => {
    if (!unlocked || Platform.OS === 'web') return;
    ScreenCapture.preventScreenCaptureAsync('coffre-fort').catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync('coffre-fort').catch(() => {});
    };
  }, [unlocked]);

  /** Garde le coffre-fort ouvert pendant qu'une fenêtre du système est affichée. */
  const withSystemSheet = async <R,>(action: () => Promise<R>): Promise<R> => {
    systemSheetOpen.current = true;
    try {
      return await action();
    } finally {
      systemSheetOpen.current = false;
    }
  };

  const sorted = [...data.docs].sort((a, b) => b.date.localeCompare(a.date));
  const shown = showAll ? sorted.filter((d) => d.category === category) : sorted.slice(0, 3);
  const count = (key: DocCategory) => data.docs.filter((d) => d.category === key).length;

  const pick = async () => {
    try {
      const result = await withSystemSheet(() => DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true }));
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      if ((asset.size ?? 0) > MAX_DOCUMENT_BYTES) return dialog.alert('Document trop volumineux', `La taille maximale est de ${fmtSize(MAX_DOCUMENT_BYTES)}.`);
      const extension = (asset.name.split('.').pop() ?? '').toUpperCase();
      setPicked({ uri: asset.uri, name: asset.name.replace(/\.[^.]+$/, ''), size: asset.size ?? 0, kind: /^[A-Z0-9]{1,4}$/.test(extension) ? extension : 'PDF' });
    } catch {
      dialog.alert('Ajout impossible', 'Le document n’a pas pu être ouvert. Veuillez réessayer.');
    }
  };

  const addPicked = async (values: Record<string, any>) => {
    if (!picked) return;
    try {
      const stored = await storeDocument(picked.uri, picked.kind.toLowerCase(), getDataKey());
      const doc: Doc = { id: uid(), name: values.name, category: values.category, uri: stored.uri, encrypted: stored.encrypted, size: picked.size, kind: picked.kind, date: todayISO() };
      update((d) => ({ ...d, docs: [...d.docs, doc] }));
      setPicked(null);
    } catch {
      return 'Le document n’a pas pu être enregistré. Veuillez réessayer.';
    }
  };

  const view = async (doc: Doc) => {
    if (!doc.uri) return dialog.alert(doc.name, 'Ceci est un document d’exemple. Ajoutez vos propres documents avec le bouton « Ajouter un document ».');
    try {
      await withSystemSheet(() => openDocument({ uri: doc.uri!, name: doc.name, kind: doc.kind, encrypted: doc.encrypted }, getDataKey()));
    } catch {
      dialog.alert('Ouverture impossible', 'Ce document ne peut pas être ouvert sur cet appareil.');
    }
  };

  const remove = async (doc: Doc) => {
    if (await dialog.confirm({ title: 'Supprimer ce document ?', message: `« ${doc.name} » sera retiré de votre coffre-fort.`, ok: 'Supprimer', danger: true })) {
      deleteDocument(doc.uri);
      update((d) => ({ ...d, docs: d.docs.filter((x) => x.id !== doc.id) }));
    }
  };

  const options = (doc: Doc) =>
    dialog.menu(doc.name, [
      { label: 'Ouvrir', icon: 'open-outline', onPress: () => view(doc) },
      { label: 'Renommer ou classer', icon: 'create-outline', onPress: () => setEdit(doc) },
      { label: 'Supprimer', icon: 'trash-outline', danger: true, onPress: () => remove(doc) },
    ]);

  const help = () => dialog.alert('Aide', 'Rangez ici vos ordonnances, analyses et papiers importants. Touchez un document pour l’ouvrir, le renommer ou le supprimer. Le coffre-fort se referme dès que vous quittez l’application.');
  const protection = !DOCUMENTS_PERSIST
    ? 'Aperçu web : les documents ne sont pas conservés après la fermeture de la page.'
    : encryption === 'active'
      ? 'Vos documents sont chiffrés sur cet appareil et protégés par un verrou.'
      : 'Vos documents restent sur cet appareil et sont protégés par un verrou.';

  return (
    <Screen
      section="coffre-fort"
      tab="social"
      speak="Mon coffre-fort. Mes documents importants, sécurisés et toujours accessibles."
      footer={unlocked ? <Btn label="Ajouter un document" icon="cloud-upload-outline" onPress={pick} /> : undefined}>
      <Header title="Coffre-fort" right={unlocked ? <CircleBtn icon="lock-closed-outline" label="Verrouiller le coffre-fort" onPress={lock} /> : <CircleBtn icon="help-circle-outline" label="Aide" onPress={help} />} />
      <Hero title="Mon coffre-fort" subtitle="Mes documents importants, sécurisés et toujours accessibles" />

      {!unlocked && <LockedVault onUnlocked={() => setUnlocked(true)} />}

      {unlocked && (
        <View style={{ flexDirection: 'row', gap: 10 }} accessibilityRole="tablist">
          {CATEGORIES.map((item) => {
            const selected = showAll && category === item.key;
            const active = selected || (!showAll && item.key === 'ordonnances');
            const ink = active ? '#fff' : colors.title;
            const content = (
              <>
                <Icon name={item.icon} size={36} color={active ? '#fff' : palette.ink} />
                <T v="small" center c={ink} style={{ fontFamily: F.semi, marginTop: 4 }}>{item.label}</T>
                <T v="small" center c={ink}>({count(item.key)})</T>
              </>
            );
            const box = { borderRadius: 18, padding: 10, alignItems: 'center' as const, minHeight: 116, justifyContent: 'center' as const };
            return (
              <Pressable
                key={item.key}
                style={{ flex: 1 }}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${item.label}, ${count(item.key)} documents`}
                onPress={() => {
                  if (selected) return setShowAll(false);
                  setCategory(item.key);
                  setShowAll(true);
                }}>
                {active ? (
                  <LinearGradient colors={palette.btn} style={[box, shadow(0.2)]}>{content}</LinearGradient>
                ) : (
                  <View style={[box, { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.cardBorder }, shadow(0.07)]}>{content}</View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {unlocked && (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8, paddingHorizontal: 4 }}>
            <T v="h3" accessibilityRole="header">{showAll ? CATEGORIES.find((c) => c.key === category)!.label : 'Mes documents récents'}</T>
            <Pressable onPress={() => setShowAll((all) => !all)} hitSlop={10} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <T c={palette.ink} style={{ fontFamily: F.semi }}>{showAll ? 'Récents' : 'Tout voir'}</T>
              <Icon name="chevron-forward" size={18} color={palette.ink} />
            </Pressable>
          </View>
          <View style={{ gap: 10 }}>
            {shown.length === 0 && <Empty icon="folder-open-outline" text="Aucun document dans cette rubrique." />}
            {shown.map((doc) => (
              <Card key={doc.id} pad={12}>
                <Pressable
                  onPress={() => options(doc)}
                  accessibilityRole="button"
                  accessibilityLabel={`${doc.name}, ${doc.kind} ${fmtSize(doc.size)}`}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14 }, pressed && { opacity: 0.6 }]}>
                  <View>
                    <Icon name="document-text-outline" size={36} color={palette.ink} />
                    <View style={{ position: 'absolute', right: -4, bottom: -2, backgroundColor: palette.ink, borderRadius: 8, padding: 2 }}>
                      <Icon name="lock-closed" size={11} color="#fff" />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="title" numberOfLines={2}>{doc.category === 'ordonnances' && doc.name === 'Ordonnance' ? `Ordonnance – ${frShort(doc.date)}` : doc.name}</T>
                    <T v="small">{[doc.kind, fmtSize(doc.size)].filter(Boolean).join(' • ')}</T>
                  </View>
                  <Icon name="chevron-forward" size={22} color={colors.title} />
                </Pressable>
              </Card>
            ))}
          </View>
        </View>
      )}

      <View style={{ borderRadius: 20, padding: 16, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: palette.soft }}>
        <Icon name="shield-checkmark-outline" size={44} color={C.title} />
        <View style={{ flex: 1 }}>
          <T v="title">Documents protégés</T>
          <T>{protection}</T>
        </View>
      </View>

      <FormSheet visible={!!picked} title="Ajouter un document" fields={DOCUMENT_FIELDS} initial={{ name: picked?.name, category }} onClose={() => setPicked(null)} submitLabel="Ajouter" onSubmit={addPicked} />
      <FormSheet
        visible={!!edit}
        title="Modifier le document"
        fields={DOCUMENT_FIELDS}
        initial={edit ?? undefined}
        onClose={() => setEdit(null)}
        onSubmit={(values) => {
          update((d) => ({ ...d, docs: d.docs.map((x) => (x.id === edit!.id ? { ...x, name: values.name, category: values.category } : x)) }));
          setEdit(null);
        }}
      />
    </Screen>
  );
}
