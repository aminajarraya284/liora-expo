import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';
import { persistFile } from '../utils/files';
import { imgSource } from '../utils/images';
import { Btn, Field, OutlineBtn, Toggle } from './controls';
import { Icon } from './icons';
import { CircleBtn } from './layout';
import { T } from './text';

export type FormValues = Record<string, any>;

export type FormField = {
  key: string;
  label: string;
  type?: 'text' | 'multiline' | 'phone' | 'number' | 'email' | 'password' | 'url' | 'choice' | 'bool' | 'image';
  placeholder?: string;
  /** Texte d'aide affiché sous le champ. */
  help?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  maxLength?: number;
  /** Renvoie un message d'erreur, ou null si la valeur convient. */
  validate?: (value: any, all: FormValues) => string | null;
};

type FormSheetProps = {
  visible: boolean;
  title: string;
  fields: FormField[];
  initial?: FormValues;
  onClose: () => void;
  /** Peut renvoyer un message d'erreur à afficher dans le formulaire. */
  onSubmit: (values: FormValues) => void | string | null | Promise<void | string | null>;
  onDelete?: () => void;
  submitLabel?: string;
  deleteLabel?: string;
};

const DEFAULT_MAX_LENGTH = { text: 120, multiline: 2000, phone: 24, number: 6, email: 120, password: 128, url: 300 } as const;

const KEYBOARD = { phone: 'phone-pad', number: 'number-pad', email: 'email-address', url: 'url' } as const;

/** Formulaire présenté dans une feuille qui monte du bas de l'écran. */
export function FormSheet({ visible, onClose, ...form }: FormSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fermer" />
        {/* Le contenu n'existe que lorsque la feuille est ouverte : chaque ouverture repart des valeurs initiales. */}
        {visible && <FormBody {...form} onClose={onClose} />}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormBody({ title, fields, initial, onClose, onSubmit, onDelete, submitLabel = 'Enregistrer', deleteLabel = 'Supprimer' }: Omit<FormSheetProps, 'visible'>) {
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<FormValues>(() => ({ ...initial }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: unknown) => setValues((current) => ({ ...current, [key]: value }));

  const pickImage = async (key: string) => {
    try {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) set(key, await persistFile(asset.uri, asset.fileName ?? 'photo.jpg'));
    } catch { setFormError('La photo n’a pas pu être préparée. Choisissez une image plus petite.'); }
  };

  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {};
    for (const field of fields) {
      const raw = values[field.key];
      const value = typeof raw === 'string' && field.type !== 'password' ? raw.trim() : raw;
      const empty = value === undefined || value === null || value === '';
      if (field.required && empty) found[field.key] = 'Ce champ est obligatoire.';
      else if (field.validate && !empty) {
        const message = field.validate(value, values);
        if (message) found[field.key] = message;
      }
    }
    return found;
  };

  const submit = async () => {
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    const clean: FormValues = {};
    for (const field of fields) {
      const value = values[field.key];
      clean[field.key] = typeof value === 'string' && field.type !== 'password' ? value.trim() : value;
    }
    setBusy(true);
    try {
      const message = await onSubmit(clean);
      if (typeof message === 'string') setFormError(message);
    } catch {
      setFormError('L’enregistrement a échoué. Veuillez réessayer.');
    } finally {
      setBusy(false);
    }
  };

  const renderField = (field: FormField) => {
    const type = field.type ?? 'text';
    if (type === 'bool') {
      return (
        <View key={field.key} style={st.boolRow}>
          <T v="bodyBold" style={{ flex: 1 }}>{field.label}</T>
          <Toggle value={!!values[field.key]} onChange={(v) => set(field.key, v)} label={field.label} color={C.primary} />
        </View>
      );
    }
    if (type === 'choice') {
      return (
        <View key={field.key} style={{ marginBottom: 12 }}>
          <T v="bodyBold" style={st.label}>{field.label}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
            {field.options?.map((option) => {
              const selected = values[field.key] === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => set(field.key, option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                  style={[st.chip, selected && { backgroundColor: C.primary, borderColor: C.primary }]}>
                  <T v="bodyBold" c={selected ? '#fff' : C.title}>{option.label}</T>
                </Pressable>
              );
            })}
          </View>
          {!!errors[field.key] && <T v="small" c={C.danger} style={{ marginTop: 4 }}>{errors[field.key]}</T>}
        </View>
      );
    }
    if (type === 'image') {
      const source = imgSource(values[field.key]);
      return (
        <View key={field.key} style={st.imageRow}>
          {source ? <Image source={source} style={st.image} /> : <View style={[st.image, st.imageEmpty]}><Icon name="image-outline" size={28} color={C.muted} /></View>}
          <OutlineBtn small label={source ? 'Changer la photo' : field.label} icon="image-outline" color={C.primary} onPress={() => pickImage(field.key)} style={{ flex: 1 }} />
          {!!source && <CircleBtn icon="trash-outline" label="Retirer la photo" onPress={() => set(field.key, undefined)} />}
        </View>
      );
    }
    const secret = type === 'password';
    const plain = type === 'text' || type === 'multiline';
    return (
      <View key={field.key}>
        <T v="bodyBold" style={st.label}>{field.label}{field.required ? ' *' : ''}</T>
        <Field
          value={values[field.key] ?? ''}
          onChangeText={(text) => set(field.key, text)}
          placeholder={field.placeholder ?? field.label}
          accessibilityLabel={field.label}
          error={errors[field.key]}
          multiline={type === 'multiline'}
          secure={secret}
          maxLength={field.maxLength ?? DEFAULT_MAX_LENGTH[type]}
          autoCapitalize={plain ? 'sentences' : 'none'}
          autoCorrect={plain}
          keyboardType={type in KEYBOARD ? KEYBOARD[type as keyof typeof KEYBOARD] : 'default'}
        />
        {!!field.help && !errors[field.key] && <T v="small" style={{ marginTop: -6, marginBottom: 10, marginLeft: 6 }}>{field.help}</T>}
      </View>
    );
  };

  return (
    <View style={[st.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <T v="h2" style={{ flex: 1 }} accessibilityRole="header">{title}</T>
        <CircleBtn icon="close" onPress={onClose} label="Fermer" />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {fields.map(renderField)}
        {!!formError && <T c={C.danger} style={{ marginBottom: 10 }} accessibilityLiveRegion="polite">{formError}</T>}
        <Btn label={submitLabel} icon="checkmark" tint="bordeaux" onPress={submit} loading={busy} style={{ marginTop: 4 }} />
        {!!onDelete && <OutlineBtn label={deleteLabel} icon="trash-outline" color={C.danger} onPress={onDelete} style={{ marginTop: 10 }} />}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(60,20,35,0.35)' },
  sheet: { backgroundColor: C.ivory, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '88%', width: '100%', maxWidth: 520, alignSelf: 'center' },
  label: { marginBottom: 6, marginLeft: 4 },
  boolRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, paddingHorizontal: 4 },
  chip: { paddingHorizontal: 16, minHeight: 48, justifyContent: 'center', borderRadius: 23, borderWidth: 1.5, borderColor: C.fieldBorder, backgroundColor: '#fff' },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  image: { width: 64, height: 64, borderRadius: 14 },
  imageEmpty: { backgroundColor: '#F3E4E6', alignItems: 'center', justifyContent: 'center' },
});
