import React, { createContext, useContext, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { C, shadow } from '../theme';
import { Icon } from './icons';
import { T } from './text';

type DialogButton = { label: string; icon?: string; danger?: boolean; primary?: boolean; onPress?: () => void };
type DialogState = { title: string; message?: string; buttons: DialogButton[]; vertical?: boolean } | null;

type DialogApi = {
  /** Message d'information avec un bouton « OK ». */
  alert: (title: string, message?: string) => Promise<void>;
  /** Question à deux réponses. La promesse vaut true si la personne confirme. */
  confirm: (options: { title: string; message?: string; ok?: string; cancel?: string; danger?: boolean }) => Promise<boolean>;
  /** Liste d'actions présentées l'une sous l'autre. */
  menu: (title: string, items: DialogButton[]) => void;
};

const DialogContext = createContext<DialogApi>(null as unknown as DialogApi);
export const useDialog = () => useContext(DialogContext);

/** iOS ne peut pas ouvrir une fenêtre pendant qu'une autre se ferme : on laisse le temps à la fermeture. */
const IOS_MODAL_DELAY = Platform.OS === 'ios' ? 400 : 0;

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(null);

  const api = useMemo<DialogApi>(() => {
    const show = (next: DialogState) => setTimeout(() => setState(next), IOS_MODAL_DELAY);
    return {
      alert: (title, message) => new Promise((resolve) => show({ title, message, buttons: [{ label: 'OK', primary: true, onPress: () => resolve() }] })),
      confirm: ({ title, message, ok = 'Confirmer', cancel = 'Annuler', danger }) =>
        new Promise((resolve) =>
          show({
            title,
            message,
            buttons: [
              { label: cancel, onPress: () => resolve(false) },
              { label: ok, primary: !danger, danger, onPress: () => resolve(true) },
            ],
          }),
        ),
      menu: (title, items) => show({ title, vertical: true, buttons: [...items, { label: 'Fermer' }] }),
    };
  }, []);

  const press = (button: DialogButton) => {
    setState(null);
    if (button.onPress) setTimeout(button.onPress, IOS_MODAL_DELAY);
  };

  /** Fermeture par le fond ou le bouton « retour » : équivaut au bouton neutre (Annuler, Fermer). */
  const dismiss = () => {
    const neutral = state?.buttons.find((b) => !b.primary && !b.danger && !b.icon);
    setState(null);
    neutral?.onPress?.();
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal visible={!!state} transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
        <Pressable style={st.backdrop} onPress={dismiss} accessibilityLabel="Fermer">
          <Pressable style={[st.dialog, shadow(0.25)]} onPress={() => {}} accessibilityViewIsModal>
            <T v="h3" center accessibilityRole="header">{state?.title}</T>
            {!!state?.message && <T center style={{ marginTop: 8 }}>{state.message}</T>}
            <View style={{ flexDirection: state?.vertical ? 'column' : 'row', gap: 10, marginTop: 18 }}>
              {state?.buttons.map((button) => {
                const filled = button.primary || (button.danger && !state.vertical);
                return (
                  <Pressable
                    key={button.label}
                    onPress={() => press(button)}
                    accessibilityRole="button"
                    accessibilityLabel={button.label}
                    style={({ pressed }) => [
                      st.button,
                      !state.vertical && { flex: 1 },
                      button.primary && { backgroundColor: C.primary, borderColor: C.primary },
                      button.danger && !state.vertical && { backgroundColor: C.danger, borderColor: C.danger },
                      pressed && { opacity: 0.75 },
                    ]}>
                    {!!button.icon && <Icon name={button.icon} size={20} color={button.danger ? C.danger : C.primary} />}
                    <T v="bodyBold" c={filled ? '#fff' : button.danger ? C.danger : C.title}>{button.label}</T>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(60,20,35,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 400, backgroundColor: C.ivory, borderRadius: 24, padding: 22 },
  button: {
    minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 12,
  },
});
