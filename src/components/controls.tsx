import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Animated, Image, Platform, Pressable, type StyleProp, StyleSheet, Text, TextInput, type TextInputProps, View, type ViewStyle,
} from 'react-native';
import { useStore } from '../state/store';
import { C, F, shadow, type Tint } from '../theme';
import { imgSource } from '../utils/images';
import { Icon, IconTile } from './icons';
import { Card } from './layout';
import { NATIVE_DRIVER, Pop, PressableScale, tap , useAnimatedValue } from './motion';
import { T, useColors } from './text';
import { usePalette } from './tint';

/** Bouton principal : dégradé dans la couleur de la page. */
export function Btn({
  label, icon, onPress, tint, loading, disabled, chevron, style, small,
}: {
  label: string; icon?: string; onPress?: () => void; tint?: Tint; loading?: boolean; disabled?: boolean; chevron?: boolean;
  style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const palette = usePalette(tint);
  const inactive = disabled || loading;
  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}>
      <View style={[st.btn, small && st.btnSmall, { backgroundColor: palette.btn[1] }, shadow(0.18)]}>
        {loading ? <ActivityIndicator color={palette.onBtn} /> : !!icon && <Icon name={icon} size={small ? 20 : 26} color={palette.onBtn} />}
        <T v={small ? 'bodyBold' : 'btn'} c={palette.onBtn} style={chevron ? { flex: 1 } : undefined} numberOfLines={1}>{label}</T>
        {chevron && <Icon name="chevron-forward" size={22} color={palette.onBtn} />}
      </View>
    </PressableScale>
  );
}

/** Bouton secondaire : contour ou fond clair. */
export function OutlineBtn({
  label, icon, onPress, style, small, color, fill, disabled,
}: {
  label: string; icon?: string; onPress?: () => void; style?: StyleProp<ViewStyle>; small?: boolean; color?: string; fill?: string; disabled?: boolean;
}) {
  const palette = usePalette();
  const ink = color ?? palette.ink;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
      contentStyle={[st.outline, { borderColor: fill ? 'transparent' : ink, backgroundColor: fill ?? C.ivorySoft }, small && st.outlineSmall]}>
      {!!icon && <Icon name={icon} size={small ? 20 : 26} color={ink} />}
      <T v={small ? 'small' : 'btn'} c={C.title} style={{ fontFamily: small ? F.semi : F.bold }} numberOfLines={1}>{label}</T>
    </PressableScale>
  );
}

/** Champ de saisie avec icône, œil pour les mots de passe et message d'erreur. */
export function Field({ icon, secure, error, style, ...props }: TextInputProps & { icon?: string; secure?: boolean; error?: string | null }) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const { settings } = useStore();
  const colors = useColors();
  const palette = usePalette();
  return (
    <View style={{ marginBottom: 12 }}>
      <View
        style={[
          st.field,
          { borderColor: error ? C.danger : focused ? palette.ink : colors.fieldBorder },
          props.multiline && { alignItems: 'flex-start', minHeight: 110, paddingVertical: 10 },
        ]}>
        {!!icon && <Icon name={icon} size={24} color={colors.title} />}
        <TextInput
          placeholderTextColor={colors.muted}
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? props.placeholder}
          secureTextEntry={secure && !show}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[st.input, { color: colors.text, fontSize: settings.bigText ? 19 : 16.5 }, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, style]}
        />
        {secure && (
          <Pressable onPress={() => setShow((s) => !s)} hitSlop={10} accessibilityRole="button" accessibilityLabel={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
            <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={24} color={colors.title} />
          </Pressable>
        )}
      </View>
      {!!error && <T v="small" c={C.danger} style={{ marginTop: 4, marginLeft: 6 }} accessibilityLiveRegion="polite">{error}</T>}
    </View>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const colors = useColors();
  const palette = usePalette();
  const toggle = () => {
    tap();
    onChange(!checked);
  };
  return (
    <Pressable onPress={toggle} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} hitSlop={6} style={st.checkboxRow}>
      <View style={[st.checkbox, { borderColor: colors.title }, checked && { backgroundColor: palette.ink, borderColor: palette.ink }]}>
        {checked && <Icon name="checkmark" size={18} color="#fff" />}
      </View>
      <T style={{ flex: 1 }}>{label}</T>
    </Pressable>
  );
}

/** Interrupteur. */
export function Toggle({ value, onChange, label, color }: { value: boolean; onChange: (v: boolean) => void; label: string; color?: string }) {
  const { reduceMotion } = useStore();
  const palette = usePalette();
  const position = useAnimatedValue(value ? 1 : 0);
  useEffect(() => {
    Animated.timing(position, { toValue: value ? 1 : 0, duration: reduceMotion ? 0 : 160, useNativeDriver: NATIVE_DRIVER }).start();
  }, [value, position, reduceMotion]);
  const toggle = () => {
    tap();
    onChange(!value);
  };
  return (
    <Pressable onPress={toggle} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} hitSlop={8}>
      <View style={[st.track, { backgroundColor: value ? (color ?? palette.btn[1]) : '#D9CDD0' }]}>
        <Animated.View style={[st.knob, { transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) }] }]} />
      </View>
    </Pressable>
  );
}

/** Pastille ronde « fait / à faire » (prise de médicament, repas, habitude). */
export function Check({ on, round = true }: { on: boolean; round?: boolean }) {
  return (
    <Pop trigger={on}>
      <View style={[st.check, { borderRadius: round ? 16 : 9 }, on ? { backgroundColor: C.okSoft } : st.checkOff]}>
        {on && <Icon name="checkmark" size={22} color={C.ok} />}
      </View>
    </Pop>
  );
}

/** Étiquette courte sur fond clair (heure, lien de parenté…). */
export function Pill({ label, tint, icon }: { label: string; tint?: Tint; icon?: string }) {
  const palette = usePalette(tint);
  return (
    <View style={[st.pill, { backgroundColor: palette.soft }]}>
      {!!icon && <Icon name={icon} size={14} color={palette.ink} />}
      <T v="bodyBold" c={palette.ink}>{label}</T>
    </View>
  );
}

/** Ligne d'une liste : icône, titre, sous-titre, et chevron si la ligne s'ouvre. */
export function Row({
  icon, tint, plainIcon, title, subtitle, right, onPress, chevron = true, big,
}: {
  icon?: string; tint?: Tint; plainIcon?: boolean; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void;
  chevron?: boolean; big?: boolean;
}) {
  const colors = useColors();
  const palette = usePalette(tint);
  const content = (
    <>
      {!!icon &&
        (plainIcon ? (
          <View style={{ width: 36, alignItems: 'center' }}><Icon name={icon} size={28} color={palette.ink} /></View>
        ) : (
          <IconTile icon={icon} tint={tint} size={big ? 58 : 48} />
        ))}
      <View style={{ flex: 1 }}>
        <T v={big ? 'h3' : 'title'} style={big ? { fontFamily: F.bold } : undefined}>{title}</T>
        {!!subtitle && <T v={big ? 'body' : 'small'}>{subtitle}</T>}
      </View>
      {right}
      {chevron && !!onPress && <Icon name="chevron-forward" size={22} color={colors.title} />}
    </>
  );
  if (!onPress) return <View style={st.row}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [st.row, pressed && { opacity: 0.6 }]}>
      {content}
    </Pressable>
  );
}

/** Photo ronde, ou initiales sur fond coloré s'il n'y a pas de photo. */
export function Avatar({ photo, name, size = 64 }: { photo?: string; name: string; size?: number }) {
  const source = imgSource(photo);
  const palette = usePalette();
  const frame = { width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: C.goldSoft };
  if (source) return <Image source={source} style={frame} accessibilityLabel={`Photo de ${name}`} />;
  const initials = name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <View style={[frame, { alignItems: 'center', justifyContent: 'center', backgroundColor: palette.btn[1] }]}>
      <Text style={{ fontFamily: F.serif, fontSize: size * 0.38, color: '#fff' }}>{initials}</Text>
    </View>
  );
}

/** Message affiché lorsqu'une liste est vide. */
export function Empty({ icon, text }: { icon: string; text: string }) {
  const palette = usePalette();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={36} color={palette.ink} />
      </View>
      <T center style={{ marginTop: 10 }}>{text}</T>
    </Card>
  );
}

const st = StyleSheet.create({
  btn: { minHeight: 60, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 22 },
  btnSmall: { minHeight: 50, borderRadius: 14, paddingHorizontal: 14 },
  outline: { minHeight: 56, borderRadius: 18, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  outlineSmall: { minHeight: 50, borderRadius: 14, paddingHorizontal: 10 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderRadius: 16, borderWidth: 1.5, backgroundColor: C.field, paddingHorizontal: 16 },
  input: { flex: 1, fontFamily: F.reg, paddingVertical: 10, minWidth: 0, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  checkbox: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  track: { width: 56, height: 32, borderRadius: 16, padding: 3 },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' },
  check: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  checkOff: { borderWidth: 2, borderColor: '#B9A9AD', backgroundColor: '#fff' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, minHeight: 56 },
});
