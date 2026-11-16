import { usePathname, useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HOME_GROUPS, SECTIONS, type SectionKey } from '../sections';
import { C, F, shadow, TINTS } from '../theme';
import { Icon, SectionIcon } from './icons';
import { Appear, NATIVE_DRIVER, tap, useAnimatedValue } from './motion';
import { T } from './text';

const MenuContext = createContext<{ open: () => void }>({ open: () => {} });

/** Ouvre le menu latéral depuis n'importe quel écran. */
export const useSideMenu = () => useContext(MenuContext);

/** Rubriques du menu : celles de l'accueil, précédées des essentielles et suivies des réglages. */
const GROUPS: { title?: string; sections: SectionKey[] }[] = [
  { sections: ['accueil', 'assistant', 'profil'] },
  ...HOME_GROUPS,
  { title: 'Réglages', sections: ['parametres', 'accessibilite'] },
];

/** Ordre d'apparition des lignes, de haut en bas. */
const ROW_ORDER = GROUPS.flatMap((group) => group.sections);

function MenuRow({ section, active, onPress, index }: { section: SectionKey; active: boolean; onPress: () => void; index: number }) {
  const { label } = SECTIONS[section];
  const palette = TINTS[SECTIONS[section].tint];
  return (
    <Appear index={index + 2} dx={-30}>
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        st.row,
        { borderColor: active ? palette.ink : 'transparent', backgroundColor: active ? palette.soft : 'transparent' },
        pressed && { opacity: 0.6 },
      ]}>
      <SectionIcon section={section} size={44} />
      <T v="title" style={{ flex: 1 }} c={active ? palette.ink : undefined} numberOfLines={1}>{label}</T>
      {active && <Icon name="checkmark-circle" size={22} color={palette.ink} />}
    </Pressable>
    </Appear>
  );
}

/** Menu latéral : toutes les pages de l'application, chacune dans sa couleur. */
export function SideMenuProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, width * 0.84);
  const [visible, setVisible] = useState(false);
  const progress = useAnimatedValue(0);

  useEffect(() => {
    if (!visible) return;
    Animated.timing(progress, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER }).start();
  }, [visible, progress]);

  const close = useCallback((after?: () => void) => {
    Animated.timing(progress, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: NATIVE_DRIVER }).start(() => {
      setVisible(false);
      after?.();
    });
  }, [progress]);

  const open = useCallback(() => {
    tap();
    setVisible(true);
  }, []);

  const go = (section: SectionKey) => {
    tap();
    const { href } = SECTIONS[section];
    close(() => {
      if (pathname === href) return;
      // L'accueil existe déjà sous les autres écrans : on y revient au lieu d'en empiler un second.
      if (section === 'accueil') router.dismissTo('/accueil');
      else router.replace(href as never);
    });
  };

  const value = useMemo(() => ({ open }), [open]);

  return (
    <MenuContext.Provider value={value}>
      {children}
      <Modal visible={visible} transparent animationType="none" onRequestClose={() => close()} statusBarTranslucent>
        <View style={{ flex: 1 }}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(60,25,30,0.45)', opacity: progress }]}>
            <Pressable style={{ flex: 1 }} onPress={() => close()} accessibilityRole="button" accessibilityLabel="Fermer le menu" />
          </Animated.View>
          <Animated.View
            style={[
              st.panel,
              shadow(0.3),
              { width: panelWidth, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-panelWidth, 0] }) }] },
            ]}
            accessibilityViewIsModal>
            <View style={st.head}>
              <T v="h2" style={{ flex: 1 }}>Menu</T>
              <Pressable onPress={() => close()} accessibilityRole="button" accessibilityLabel="Fermer le menu" hitSlop={8} style={st.closeBtn}>
                <Icon name="close" size={24} color={C.title} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }} accessibilityRole="menu">
              {GROUPS.map((group, index) => (
                <View key={group.title ?? index}>
                  {!!group.title && <T v="small" style={st.groupTitle}>{group.title.toUpperCase()}</T>}
                  {group.sections.map((section) => (
                    <MenuRow key={section} section={section} index={ROW_ORDER.indexOf(section)} active={pathname === SECTIONS[section].href} onPress={() => go(section)} />
                  ))}
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </MenuContext.Provider>
  );
}

/** Bouton rond « trois traits » qui ouvre le menu. */
export function MenuBtn() {
  const { open } = useSideMenu();
  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Ouvrir le menu" hitSlop={8} style={({ pressed }) => [st.menuBtn, shadow(0.12), pressed && { opacity: 0.7 }]}>
      <Icon name="menu" size={26} color={C.title} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: C.ivory, borderTopRightRadius: 28, borderBottomRightRadius: 28 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  closeBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.05)' },
  groupTitle: { fontFamily: F.bold, letterSpacing: 1, marginTop: 14, marginBottom: 4, marginLeft: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 18, borderWidth: 1.5, minHeight: 56 },
  menuBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.ivory, alignItems: 'center', justifyContent: 'center' },
});
