import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { PROCHE_FIELDS, saveProche } from '../../forms';
import { openLink, smsUrl, telUrl } from '../../lib';
import { type Proche, useStore } from '../../store';
import { C } from '../../theme';
import { Avatar, Btn, Card, CircleBtn, Divider, Empty, FormSheet, Header, Hero, Icon, OutlineBtn, Row, Screen, T, useDialog, usePalette } from '../../ui';

export default function Proches() {
  const { data, update } = useStore();
  const dialog = useDialog();
  const router = useRouter();
  const palette = usePalette('coral');
  const [edit, setEdit] = useState<Proche | 'new' | null>(null);
  const editing = edit && edit !== 'new' ? edit : null;

  const open = async (url: string, what: string) => {
    if (!(await openLink(url))) dialog.alert(`${what} impossible`, 'Cet appareil ne permet pas cette action.');
  };

  const remove = async (proche: Proche) => {
    setEdit(null); // on ferme la fiche avant de demander confirmation
    if (await dialog.confirm({ title: `Supprimer ${proche.name} ?`, message: 'Ce proche sera retiré de vos contacts.', ok: 'Supprimer', danger: true })) {
      update((d) => ({ ...d, proches: d.proches.filter((p) => p.id !== proche.id) }));
    }
  };

  return (
    <Screen section="proches" tab="social" speak="Mes proches. Rester en contact avec ceux qui comptent.">
      <Header title="Proches" right={<CircleBtn icon="person-add-outline" label="Ajouter un proche" onPress={() => setEdit('new')} />} />
      <Hero title="Mes proches" subtitle="Rester en contact avec ceux qui comptent" />

      <Card style={{ marginBottom: 14 }}>
        <Row icon="key-outline" title="Clé d’urgence 48h" subtitle="Confier des documents à un proche choisi" onPress={() => router.push('/cle-urgence')} />
        <Divider />
        <Row icon="enter-outline" title="J’ai reçu une clé" subtitle="Accéder aux documents autorisés par un proche" onPress={() => router.push('/acces-urgence')} />
      </Card>

      <View style={{ gap: 12 }}>
        {data.proches.length === 0 && <Empty icon="people-outline" text="Aucun proche pour le moment. Ajoutez les personnes qui comptent pour vous." />}
        {data.proches.map((proche) => (
          <Card key={proche.id}>
            <Pressable onPress={() => setEdit(proche)} accessibilityRole="button" accessibilityLabel={`Modifier ${proche.name}, ${proche.relation}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Avatar photo={proche.photo} name={proche.name} size={78} />
              <View style={{ flex: 1, alignItems: 'flex-start' }}>
                <T v="h2">{proche.name}</T>
                <T>{proche.relation}</T>
                {proche.primary && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: palette.soft, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 }}>
                    <Icon name="star" size={14} color={C.gold} />
                    <T v="small" c={C.title}>Contact principal</T>
                  </View>
                )}
              </View>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Btn small label="Appeler" icon="call" onPress={() => open(telUrl(proche.phone), 'Appel')} style={{ flex: 1 }} />
              <OutlineBtn small label="Message" icon="chatbubble-outline" fill="rgba(255,255,255,0.95)" color={C.title} onPress={() => open(smsUrl(proche.phone), 'Message')} style={{ flex: 1 }} />
            </View>
          </Card>
        ))}
        <OutlineBtn label="Ajouter un proche" icon="add" fill={palette.soft} color={C.title} onPress={() => setEdit('new')} />
      </View>

      <FormSheet
        visible={!!edit}
        title={editing ? 'Modifier le proche' : 'Ajouter un proche'}
        fields={PROCHE_FIELDS}
        initial={editing ?? { emergency: true, primary: data.proches.length === 0 }}
        onClose={() => setEdit(null)}
        onSubmit={(values) => { update((d) => ({ ...d, proches: saveProche(d.proches, values, editing?.id) })); setEdit(null); }}
        onDelete={editing ? () => remove(editing) : undefined}
      />
    </Screen>
  );
}
